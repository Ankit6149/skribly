use serde_json::json;
use std::env;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

mod core {
    pub mod account {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/core/account.rs"));
    }

    pub mod models {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/core/models.rs"));
    }

    pub mod license {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/core/license.rs"));
    }

    pub mod storage {
        include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/core/storage.rs"));

        pub fn acceptance_save_with_interruption(
            primary_path: PathBuf,
            skribs: &[crate::core::models::SkribNote],
            stage: &str,
        ) -> Result<String, StorageError> {
            let mut storage = StorageService::new(primary_path);
            storage.load()?;
            let fault = match stage {
                "afterTemporarySync" => SaveFault::AfterTemporarySync,
                "afterBackupRotation" => SaveFault::AfterBackupRotation,
                "beforePrimaryReplace" => SaveFault::BeforePrimaryReplace,
                "afterPrimaryReplace" => SaveFault::AfterPrimaryReplace,
                _ => {
                    return Err(StorageError::InvalidData {
                        path: "acceptance stage".to_string(),
                        reason: format!("unsupported interruption stage: {stage}"),
                    })
                }
            };

            match storage.save_internal(skribs, fault) {
                Err(StorageError::InjectedFailure { stage }) => Ok(stage.to_string()),
                Err(error) => Err(error),
                Ok(_) => Err(StorageError::InvalidData {
                    path: "acceptance interruption".to_string(),
                    reason: "save unexpectedly completed without reaching the requested failpoint"
                        .to_string(),
                }),
            }
        }

        pub fn acceptance_write_partial_temporary(
            primary_path: PathBuf,
            skribs: &[crate::core::models::SkribNote],
        ) -> Result<PathBuf, StorageError> {
            let mut storage = StorageService::new(primary_path);
            storage.load()?;
            let revision = storage.current_revision().checked_add(1).ok_or_else(|| {
                StorageError::WriteBlocked {
                    reason: "The local storage revision counter is exhausted".to_string(),
                }
            })?;
            let envelope = build_envelope(revision, now_millis(), skribs)?;
            let bytes = serde_json::to_vec_pretty(&envelope).map_err(|error| {
                StorageError::InvalidData {
                    path: "partial temporary acceptance fixture".to_string(),
                    reason: error.to_string(),
                }
            })?;
            let temporary = storage.temporary_path();
            let partial_length = (bytes.len() / 2).max(1);
            let mut file = OpenOptions::new()
                .create(true)
                .truncate(true)
                .write(true)
                .open(&temporary)
                .map_err(|error| io_error("open partial temporary fixture", &temporary, error))?;
            file.write_all(&bytes[..partial_length])
                .map_err(|error| io_error("write partial temporary fixture", &temporary, error))?;
            file.sync_all()
                .map_err(|error| io_error("flush partial temporary fixture", &temporary, error))?;
            Ok(temporary)
        }

        pub fn acceptance_candidate_path(primary_path: &Path, source: &str) -> PathBuf {
            match source {
                "primary" => primary_path.to_path_buf(),
                "temporary" => sibling_path(primary_path, ".tmp"),
                "backup1" => sibling_path(primary_path, ".bak.1"),
                "backup2" => sibling_path(primary_path, ".bak.2"),
                "legacyBackup" => sibling_path(primary_path, ".bak"),
                _ => primary_path.to_path_buf(),
            }
        }
    }
}

use core::models::SkribNote;
use core::storage::{acceptance_candidate_path, StorageService};

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn note(marker: &str, payload_kib: usize) -> SkribNote {
    let prefix = format!("{marker}|");
    let target_bytes = payload_kib.saturating_mul(1024);
    let filler_length = target_bytes.saturating_sub(prefix.len());
    SkribNote {
        id: format!("acceptance-{marker}"),
        target_process_name: "notepad.exe".to_string(),
        target_title: "Skribli storage acceptance fixture".to_string(),
        rel_x: 10.0,
        rel_y: 20.0,
        width: 320.0,
        height: 230.0,
        text: format!("{prefix}{}", "x".repeat(filler_length)),
        color: "yellow".to_string(),
        collapsed: false,
        created_at: now_seconds(),
        updated_at: now_seconds(),
        deleted_at: None,
    }
}

fn require_args(args: &[String], count: usize, usage: &str) -> Result<(), String> {
    if args.len() < count {
        Err(format!("usage: storage_acceptance {usage}"))
    } else {
        Ok(())
    }
}

fn parse_payload_kib(value: &str) -> Result<usize, String> {
    value
        .parse::<usize>()
        .map_err(|error| format!("invalid payload size {value}: {error}"))
}

fn load_service(path: &Path) -> Result<(StorageService, core::storage::LoadOutcome), String> {
    let mut storage = StorageService::new(path.to_path_buf());
    let outcome = storage.load().map_err(|error| error.to_string())?;
    Ok((storage, outcome))
}

fn write_ready_marker(path: &Path, stage: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        path,
        serde_json::to_vec_pretty(&json!({
            "stage": stage,
            "pid": std::process::id(),
            "timestampSeconds": now_seconds()
        }))
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn sleep_until_killed() -> ! {
    loop {
        thread::sleep(Duration::from_secs(60));
    }
}

fn command_seed(path: &Path) -> Result<(), String> {
    let mut storage = StorageService::new(path.to_path_buf());
    let _ = storage.load().map_err(|error| error.to_string())?;
    for marker in ["generation-1", "generation-2", "generation-3"] {
        storage
            .save(&[note(marker, 4)])
            .map_err(|error| error.to_string())?;
    }
    println!(
        "{}",
        json!({
            "command": "seed",
            "path": path,
            "revision": storage.current_revision(),
            "writable": storage.is_writable()
        })
    );
    Ok(())
}

fn command_save(path: &Path, marker: &str, payload_kib: usize) -> Result<(), String> {
    let (mut storage, _) = load_service(path)?;
    let outcome = storage
        .save(&[note(marker, payload_kib)])
        .map_err(|error| error.to_string())?;
    println!(
        "{}",
        json!({
            "command": "save",
            "path": path,
            "marker": marker,
            "revision": outcome.revision,
            "writable": storage.is_writable()
        })
    );
    Ok(())
}

fn command_interrupt(
    path: &Path,
    stage: &str,
    marker: &str,
    payload_kib: usize,
    ready_marker: &Path,
) -> Result<(), String> {
    let reached = core::storage::acceptance_save_with_interruption(
        path.to_path_buf(),
        &[note(marker, payload_kib)],
        stage,
    )
    .map_err(|error| error.to_string())?;
    write_ready_marker(ready_marker, &reached)?;
    sleep_until_killed();
}

fn command_partial_temp(
    path: &Path,
    marker: &str,
    payload_kib: usize,
    ready_marker: &Path,
) -> Result<(), String> {
    let temporary = core::storage::acceptance_write_partial_temporary(
        path.to_path_buf(),
        &[note(marker, payload_kib)],
    )
    .map_err(|error| error.to_string())?;
    write_ready_marker(ready_marker, "partialTemporarySynced")?;
    eprintln!(
        "partial temporary fixture written to {}",
        temporary.display()
    );
    sleep_until_killed();
}

fn command_verify(
    path: &Path,
    expected_marker: &str,
    expected_writable: bool,
) -> Result<(), String> {
    let (storage, outcome) = load_service(path)?;
    let actual_marker = outcome
        .skribs
        .first()
        .and_then(|note| note.text.split('|').next())
        .unwrap_or("");
    if actual_marker != expected_marker {
        return Err(format!(
            "expected marker {expected_marker}, loaded {actual_marker} at revision {}",
            outcome.revision
        ));
    }
    if storage.is_writable() != expected_writable {
        return Err(format!(
            "expected writable={expected_writable}, got {}",
            storage.is_writable()
        ));
    }
    println!(
        "{}",
        serde_json::to_string(&json!({
            "command": "verify",
            "path": path,
            "marker": actual_marker,
            "revision": outcome.revision,
            "writable": storage.is_writable(),
            "blockedReason": storage.blocked_reason(),
            "notice": outcome.notice
        }))
        .map_err(|error| error.to_string())?
    );
    Ok(())
}

fn command_expect_load_failure(path: &Path) -> Result<(), String> {
    let mut storage = StorageService::new(path.to_path_buf());
    match storage.load() {
        Ok(outcome) => Err(format!(
            "expected load failure, but loaded {} notes at revision {}",
            outcome.skribs.len(),
            outcome.revision
        )),
        Err(error) => {
            println!(
                "{}",
                json!({
                    "command": "expect-load-failure",
                    "path": path,
                    "error": error.to_string(),
                    "writable": storage.is_writable()
                })
            );
            if storage.is_writable() {
                Err("storage remained writable after unrecoverable data".to_string())
            } else {
                Ok(())
            }
        }
    }
}

fn command_corrupt(path: &Path, source: &str) -> Result<(), String> {
    let candidate = acceptance_candidate_path(path, source);
    if let Some(parent) = candidate.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&candidate, b"{corrupt-storage-generation").map_err(|error| error.to_string())?;
    println!(
        "{}",
        json!({ "command": "corrupt", "source": source, "path": candidate })
    );
    Ok(())
}

fn command_future(path: &Path, source: &str) -> Result<(), String> {
    let candidate = acceptance_candidate_path(path, source);
    if let Some(parent) = candidate.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        &candidate,
        br#"{"schema_version":99,"revision":999,"written_at_ms":1,"integrity":"future","skribs":[]}"#,
    )
    .map_err(|error| error.to_string())?;
    println!(
        "{}",
        json!({ "command": "future", "source": source, "path": candidate })
    );
    Ok(())
}

fn command_diagnostics(path: &Path) -> Result<(), String> {
    let (storage, _) = load_service(path)?;
    let output = storage
        .export_diagnostics()
        .map_err(|error| error.to_string())?;
    println!(
        "{}",
        json!({
            "command": "diagnostics",
            "path": output,
            "containsUserContent": false
        })
    );
    Ok(())
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    require_args(&args, 2, "<command> ...")?;
    match args[1].as_str() {
        "seed" => {
            require_args(&args, 3, "seed <primary-path>")?;
            command_seed(Path::new(&args[2]))
        }
        "save" => {
            require_args(&args, 5, "save <primary-path> <marker> <payload-kib>")?;
            command_save(Path::new(&args[2]), &args[3], parse_payload_kib(&args[4])?)
        }
        "interrupt" => {
            require_args(
                &args,
                7,
                "interrupt <primary-path> <stage> <marker> <payload-kib> <ready-marker>",
            )?;
            command_interrupt(
                Path::new(&args[2]),
                &args[3],
                &args[4],
                parse_payload_kib(&args[5])?,
                Path::new(&args[6]),
            )
        }
        "partial-temp" => {
            require_args(
                &args,
                6,
                "partial-temp <primary-path> <marker> <payload-kib> <ready-marker>",
            )?;
            command_partial_temp(
                Path::new(&args[2]),
                &args[3],
                parse_payload_kib(&args[4])?,
                Path::new(&args[5]),
            )
        }
        "verify" => {
            require_args(
                &args,
                5,
                "verify <primary-path> <expected-marker> <true|false>",
            )?;
            let expected_writable = args[4]
                .parse::<bool>()
                .map_err(|error| format!("invalid writable flag {}: {error}", args[4]))?;
            command_verify(Path::new(&args[2]), &args[3], expected_writable)
        }
        "expect-load-failure" => {
            require_args(&args, 3, "expect-load-failure <primary-path>")?;
            command_expect_load_failure(Path::new(&args[2]))
        }
        "corrupt" => {
            require_args(&args, 4, "corrupt <primary-path> <source>")?;
            command_corrupt(Path::new(&args[2]), &args[3])
        }
        "future" => {
            require_args(&args, 4, "future <primary-path> <source>")?;
            command_future(Path::new(&args[2]), &args[3])
        }
        "diagnostics" => {
            require_args(&args, 3, "diagnostics <primary-path>")?;
            command_diagnostics(Path::new(&args[2]))
        }
        command => Err(format!("unknown command: {command}")),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!(
            "{}",
            json!({
                "ok": false,
                "error": error,
                "pid": std::process::id()
            })
        );
        std::process::exit(1);
    }
}
