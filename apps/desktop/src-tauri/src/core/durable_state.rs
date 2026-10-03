//! Small recoverable generation store for licence JSON and protected account bytes.
//! Callers serialize their complete read/modify/commit transaction and validate their own format.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static GENERATION: AtomicU64 = AtomicU64::new(0);

pub(crate) fn companion(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

/// After explicit session removal, recovery must not resurrect a removed credential.
pub(crate) fn replace_backup(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let staged = companion(path, ".bak.tmp");
    write_synced(&staged, bytes)?;
    replace(&staged, &companion(path, ".bak"))
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_replace_path(path: &Path) -> std::io::Result<Vec<u16>> {
    use std::os::windows::ffi::OsStrExt;

    let file_name = path.file_name().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "State path has no file name.",
        )
    })?;
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty());
    // Rust canonicalize returns an absolute extended-length Windows path, including
    // \\?\UNC\ for shares. Resolve only the existing directory: a new destination
    // need not exist, and resolving the file itself would follow a file symlink.
    let directory = fs::canonicalize(parent.unwrap_or_else(|| Path::new(".")))?;
    let mut wide: Vec<u16> = directory
        .join(file_name)
        .as_os_str()
        .encode_wide()
        .collect();
    if wide.contains(&0) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "State path contains a null character.",
        ));
    }
    wide.push(0);
    Ok(wide)
}

#[cfg(target_os = "windows")]
fn replace(source: &Path, destination: &Path) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let failure = || {
        "Protected state could not be atomically replaced; the previous generation remains available.".to_string()
    };
    let source = windows_replace_path(source).map_err(|_| failure())?;
    let destination = windows_replace_path(destination).map_err(|_| failure())?;
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(destination.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|_| failure())
}

#[cfg(not(target_os = "windows"))]
fn replace(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|_| "State generation could not be replaced.".into())
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|_| "State generation could not be staged.".to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "State generation could not be durably staged.".to_string())
}

pub(crate) fn save(
    path: &Path,
    bytes: &[u8],
    validate: impl Fn(&[u8]) -> Result<bool, String>,
) -> Result<(), String> {
    if !validate(bytes)? {
        return Err("Refusing to save invalid state.".into());
    }
    let parent = path.parent().ok_or("State path has no parent.")?;
    fs::create_dir_all(parent).map_err(|_| "State directory could not be created.".to_string())?;
    let staged = companion(path, ".tmp");
    write_synced(&staged, bytes)?;
    if path.exists() {
        let previous =
            fs::read(path).map_err(|_| "Previous state could not be read.".to_string())?;
        if !validate(&previous)? {
            return Err("Previous state is damaged; recovery is required before saving.".into());
        }
        let backup_staged = companion(path, ".bak.tmp");
        write_synced(&backup_staged, &previous)?;
        replace(&backup_staged, &companion(path, ".bak"))?;
    }
    replace(&staged, path)?;
    if fs::read(path).map_err(|_| "Committed state could not be verified.".to_string())? != bytes {
        return Err("Committed state did not match its staged generation.".into());
    }
    Ok(())
}

/// `Ok(None)` means damaged bytes; `Err` means unsupported format and blocks recovery.
pub(crate) fn load<T>(
    path: &Path,
    decode: impl Fn(&[u8]) -> Result<Option<T>, String>,
) -> Result<Option<T>, String> {
    let primary_exists = path.exists();
    if primary_exists {
        let bytes = fs::read(path)
            .map_err(|_| "State could not be read and was not overwritten.".to_string())?;
        if let Some(value) = decode(&bytes)? {
            return Ok(Some(value));
        }
    }
    for candidate in [companion(path, ".bak"), companion(path, ".tmp")] {
        if !candidate.exists() {
            continue;
        }
        let bytes =
            fs::read(&candidate).map_err(|_| "Recovery state could not be read.".to_string())?;
        let Some(value) = decode(&bytes)? else {
            continue;
        };
        if primary_exists {
            let quarantine = companion(
                path,
                &format!(
                    ".damaged-{}-{}",
                    std::process::id(),
                    GENERATION.fetch_add(1, Ordering::Relaxed)
                ),
            );
            fs::copy(path, quarantine)
                .map_err(|_| "Damaged state could not be preserved.".to_string())?;
        }
        let recovery = companion(path, ".recover");
        write_synced(&recovery, &bytes)?;
        replace(&recovery, path)?;
        return Ok(Some(value));
    }
    if primary_exists || companion(path, ".bak").exists() || companion(path, ".tmp").exists() {
        Err("State is damaged and no validated recovery generation is available; existing files were preserved.".into())
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn decode(bytes: &[u8]) -> Result<Option<Vec<u8>>, String> {
        if bytes == b"future" {
            return Err("unsupported version".into());
        }
        Ok(bytes.starts_with(b"valid").then(|| bytes.to_vec()))
    }
    #[test]
    fn missing_and_corrupt_primary_recover_validated_backup_without_destroying_it() {
        let directory = std::env::temp_dir().join(format!(
            "skribli-state-{}-{}",
            std::process::id(),
            GENERATION.fetch_add(1, Ordering::Relaxed)
        ));
        let path = directory.join("synthetic.json");
        save(&path, b"valid old", |b| Ok(decode(b)?.is_some())).unwrap();
        save(&path, b"valid new", |b| Ok(decode(b)?.is_some())).unwrap();
        fs::remove_file(&path).unwrap();
        assert_eq!(load(&path, decode).unwrap(), Some(b"valid old".to_vec()));
        fs::write(&path, b"damaged").unwrap();
        assert_eq!(load(&path, decode).unwrap(), Some(b"valid old".to_vec()));
        assert_eq!(fs::read(companion(&path, ".bak")).unwrap(), b"valid old");
        fs::write(&path, b"future").unwrap();
        assert!(load(&path, decode).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"future");
    }

    #[cfg(target_os = "windows")]
    fn long_test_directory() -> PathBuf {
        std::env::temp_dir()
            .join(format!(
                "skribli-long-state-{}-{}",
                std::process::id(),
                GENERATION.fetch_add(1, Ordering::Relaxed)
            ))
            .join("synthetic-long-component".repeat(4))
            .join("synthetic-long-component".repeat(4))
            .join("synthetic-long-component".repeat(4))
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn long_paths_commit_backup_redaction_and_recovery_generations() {
        use std::os::windows::ffi::OsStrExt;
        let directory = long_test_directory();
        let path = directory.join("synthetic.json");
        assert!(path.as_os_str().encode_wide().count() > 260);
        save(&path, b"valid old", |b| Ok(decode(b)?.is_some())).unwrap();
        save(&path, b"valid new", |b| Ok(decode(b)?.is_some())).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"valid new");
        assert_eq!(fs::read(companion(&path, ".bak")).unwrap(), b"valid old");
        fs::write(&path, b"damaged").unwrap();
        assert_eq!(load(&path, decode).unwrap(), Some(b"valid old".to_vec()));
        assert!(fs::read_dir(&directory).unwrap().any(|entry| entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .contains(".damaged-")));
        replace_backup(&path, b"valid redacted").unwrap();
        assert_eq!(
            fs::read(companion(&path, ".bak")).unwrap(),
            b"valid redacted"
        );
        fs::remove_file(&path).unwrap();
        assert_eq!(
            load(&path, decode).unwrap(),
            Some(b"valid redacted".to_vec())
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_extended_paths_use_existing_parent_and_keep_destination_file_name() {
        let directory = long_test_directory();
        fs::create_dir_all(&directory).unwrap();
        let missing = directory.join("new-destination.json");
        let wide = windows_replace_path(&missing).unwrap();
        let normalized = String::from_utf16(&wide[..wide.len() - 1]).unwrap();
        assert!(normalized.starts_with(r"\\?\"));
        assert!(normalized.ends_with(r"\new-destination.json"));
        assert!(!missing.exists());
        let explicit = fs::canonicalize(&directory)
            .unwrap()
            .join("new-destination.json");
        assert_eq!(windows_replace_path(&explicit).unwrap(), wide);
        let relative = Path::new("apps/desktop/src-tauri/Cargo.toml");
        // Resolve relative paths without forcing a process-global current-directory change.
        let path = relative.file_name().unwrap();
        assert!(windows_replace_path(Path::new(path)).is_ok());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn long_path_replacement_preserves_locked_and_read_only_primary() {
        use std::os::windows::fs::OpenOptionsExt;
        use windows::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};
        let directory = long_test_directory();
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("synthetic.json");
        let staged = directory.join("synthetic.tmp");
        fs::write(&path, b"valid old").unwrap();
        fs::write(&staged, b"valid new").unwrap();
        let lock = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ.0 | FILE_SHARE_WRITE.0)
            .open(&path)
            .unwrap();
        assert!(replace(&staged, &path).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"valid old");
        assert_eq!(fs::read(&staged).unwrap(), b"valid new");
        drop(lock);
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(replace(&staged, &path).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"valid old");
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        replace(&staged, &path).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"valid new");
    }
}
