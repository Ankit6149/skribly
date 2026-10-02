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
fn replace(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    unsafe { MoveFileExW(PCWSTR(source.as_ptr()), PCWSTR(destination.as_ptr()), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) }
        .map_err(|_| "Protected state could not be atomically replaced; the previous generation remains available.".into())
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
}
