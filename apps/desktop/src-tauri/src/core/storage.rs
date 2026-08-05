use crate::core::license;
use crate::core::models::SkribNote;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

const CURRENT_SCHEMA_VERSION: u32 = 3;
const PREVIOUS_SCHEMA_VERSION: u32 = 2;
const LEGACY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StorageSource {
    Primary,
    Temporary,
    Backup1,
    LegacyBackup,
    Backup2,
}

impl StorageSource {
    fn priority(self) -> u8 {
        match self {
            Self::Primary => 50,
            Self::Temporary => 40,
            Self::Backup1 => 30,
            Self::LegacyBackup => 20,
            Self::Backup2 => 10,
        }
    }
}

impl fmt::Display for StorageSource {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Primary => "primary",
            Self::Temporary => "temporary recovery file",
            Self::Backup1 => "latest backup",
            Self::LegacyBackup => "legacy backup",
            Self::Backup2 => "older backup",
        };
        formatter.write_str(value)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageNotice {
    pub message: String,
    pub source: StorageSource,
    pub revision: u64,
    pub migrated_from_schema: Option<u32>,
    pub quarantined_files: Vec<String>,
    pub backup_directory: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LoadOutcome {
    pub skribs: Vec<SkribNote>,
    pub revision: u64,
    pub notice: Option<StorageNotice>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaveOutcome {
    pub revision: u64,
    pub written_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageFileDiagnostic {
    pub source: StorageSource,
    pub file_name: String,
    pub exists: bool,
    pub size_bytes: Option<u64>,
    pub modified_at_ms: Option<u64>,
    pub status: String,
    pub revision: Option<u64>,
    pub schema_version: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostics {
    pub generated_at_ms: u64,
    pub current_schema_version: u32,
    pub current_revision: u64,
    pub writable: bool,
    pub blocked_reason: Option<String>,
    pub files: Vec<StorageFileDiagnostic>,
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Local Skrib storage path has no parent directory")]
    MissingParent,
    #[error("{operation} failed for {path}: {message}")]
    Io {
        operation: &'static str,
        path: String,
        message: String,
    },
    #[error("Local Skrib data is damaged in {path}: {reason}")]
    InvalidData { path: String, reason: String },
    #[error("Local Skrib data uses unsupported schema version {version} in {path}; the file was preserved and writes are blocked")]
    UnsupportedSchema { path: String, version: u64 },
    #[error("Local Skrib recovery found storage files but none were valid: {details}")]
    NoRecoverableData { details: String },
    #[error("Local Skrib writes are blocked to protect existing data: {reason}")]
    WriteBlocked { reason: String },
    #[error("Injected storage interruption at {stage}")]
    InjectedFailure { stage: &'static str },
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredSkribsV1 {
    version: u32,
    skribs: Vec<SkribNote>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredSkribsV2 {
    schema_version: u32,
    revision: u64,
    written_at_ms: u64,
    integrity: String,
    skribs: Vec<SkribNote>,
}

#[derive(Serialize)]
struct IntegrityPayload<'a> {
    schema_version: u32,
    revision: u64,
    written_at_ms: u64,
    skribs: &'a [SkribNote],
}

#[derive(Debug, Clone)]
struct DecodedCandidate {
    source: StorageSource,
    path: PathBuf,
    revision: u64,
    written_at_ms: u64,
    skribs: Vec<SkribNote>,
    migrated_from_schema: Option<u32>,
}

#[derive(Debug)]
struct InvalidCandidate {
    source: StorageSource,
    path: PathBuf,
    error: StorageError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SaveFault {
    None,
    AfterTemporarySync,
    AfterBackupRotation,
    BeforePrimaryReplace,
    AfterPrimaryReplace,
}

#[derive(Debug)]
pub struct StorageService {
    primary_path: PathBuf,
    revision: u64,
    blocked_reason: Option<String>,
}

impl StorageService {
    pub fn new(primary_path: PathBuf) -> Self {
        let _ = license::initialize_from_skrib_path(&primary_path);
        Self {
            primary_path,
            revision: 0,
            blocked_reason: None,
        }
    }

    pub fn primary_path(&self) -> &Path {
        &self.primary_path
    }

    pub fn current_revision(&self) -> u64 {
        self.revision
    }

    pub fn blocked_reason(&self) -> Option<&str> {
        self.blocked_reason.as_deref()
    }

    pub fn is_writable(&self) -> bool {
        self.blocked_reason.is_none()
    }

    pub fn load(&mut self) -> Result<LoadOutcome, StorageError> {
        self.blocked_reason = None;

        let candidates = self.candidate_paths();
        let mut found_any_file = false;
        let mut valid = Vec::new();
        let mut invalid = Vec::new();
        let mut unsupported = Vec::new();

        for (source, path) in candidates {
            if !path.exists() {
                continue;
            }
            found_any_file = true;

            match decode_candidate(&path, source) {
                Ok(candidate) => valid.push(candidate),
                Err(error @ StorageError::UnsupportedSchema { .. }) => {
                    unsupported.push(error);
                }
                Err(error) => invalid.push(InvalidCandidate {
                    source,
                    path,
                    error,
                }),
            }
        }

        let unsupported_reason = (!unsupported.is_empty()).then(|| {
            unsupported
                .iter()
                .map(ToString::to_string)
                .collect::<Vec<_>>()
                .join("; ")
        });

        if !found_any_file {
            self.revision = 0;
            return Ok(LoadOutcome {
                skribs: Vec::new(),
                revision: 0,
                notice: None,
            });
        }

        let mut invalid_details = invalid
            .iter()
            .map(|candidate| candidate.error.to_string())
            .collect::<Vec<_>>();

        if valid.is_empty() {
            if let Some(reason) = unsupported_reason {
                self.blocked_reason = Some(reason.clone());
                return Err(StorageError::WriteBlocked { reason });
            }

            let details = if invalid_details.is_empty() {
                "No valid primary, temporary, or backup generation was found".to_string()
            } else {
                format!(
                    "{}. Damaged files were preserved in place for recovery.",
                    invalid_details.join("; ")
                )
            };
            self.blocked_reason = Some(details.clone());
            return Err(StorageError::NoRecoverableData { details });
        }

        valid.sort_by(|left, right| {
            right
                .revision
                .cmp(&left.revision)
                .then_with(|| right.source.priority().cmp(&left.source.priority()))
                .then_with(|| right.written_at_ms.cmp(&left.written_at_ms))
        });
        let selected = valid.remove(0);

        if let Some(reason) = unsupported_reason {
            return Ok(self.read_only_recovery_outcome(
                &selected,
                format!(
                    "A newer unsupported storage generation was preserved and writes are blocked: {reason}"
                ),
                Vec::new(),
            ));
        }

        let mut quarantined_files = Vec::new();
        for (index, candidate) in invalid.into_iter().enumerate() {
            match quarantine_file(&candidate.path, candidate.source, index) {
                Ok(path) => quarantined_files.push(file_name_for_display(&path)),
                Err(error) if candidate.source == StorageSource::Primary => {
                    let reason = format!(
                        "The damaged primary file could not be quarantined safely: {error}"
                    );
                    return Ok(self.read_only_recovery_outcome(
                        &selected,
                        reason,
                        quarantined_files,
                    ));
                }
                Err(error) => invalid_details.push(error.to_string()),
            }
        }

        let needs_restore =
            selected.source != StorageSource::Primary || selected.migrated_from_schema.is_some();
        if needs_restore {
            if let Err(error) = self.restore_candidate(&selected) {
                return Ok(self.read_only_recovery_outcome(
                    &selected,
                    format!("The verified recovery generation could not be restored: {error}"),
                    quarantined_files,
                ));
            }
        }

        self.revision = selected.revision;
        cleanup_stale_temporary(&self.temporary_path());

        let notice = if needs_restore || !quarantined_files.is_empty() {
            let mut message = if selected.migrated_from_schema.is_some() {
                "Skribli upgraded the local note database safely.".to_string()
            } else if selected.source != StorageSource::Primary {
                format!(
                    "Skribli recovered local notes from the {} and restored the primary database.",
                    selected.source
                )
            } else {
                "Skribli verified the primary database and preserved damaged recovery files."
                    .to_string()
            };
            if !quarantined_files.is_empty() {
                message.push_str(" Damaged files were preserved in quarantine.");
            }

            Some(StorageNotice {
                message,
                source: selected.source,
                revision: selected.revision,
                migrated_from_schema: selected.migrated_from_schema,
                quarantined_files,
                backup_directory: parent_directory_for_display(&self.primary_path),
            })
        } else {
            None
        };

        Ok(LoadOutcome {
            skribs: selected.skribs,
            revision: selected.revision,
            notice,
        })
    }

    fn read_only_recovery_outcome(
        &mut self,
        selected: &DecodedCandidate,
        reason: String,
        quarantined_files: Vec<String>,
    ) -> LoadOutcome {
        self.revision = selected.revision;
        self.blocked_reason = Some(reason.clone());
        LoadOutcome {
            skribs: selected.skribs.clone(),
            revision: selected.revision,
            notice: Some(StorageNotice {
                message: format!(
                    "Skribli opened verified notes from the {} in read-only recovery mode. {reason}",
                    selected.source
                ),
                source: selected.source,
                revision: selected.revision,
                migrated_from_schema: selected.migrated_from_schema,
                quarantined_files,
                backup_directory: parent_directory_for_display(&self.primary_path),
            }),
        }
    }

    fn block_writes(&mut self, reason: String) -> StorageError {
        self.blocked_reason = Some(reason.clone());
        StorageError::WriteBlocked { reason }
    }

    pub fn save(&mut self, skribs: &[SkribNote]) -> Result<SaveOutcome, StorageError> {
        self.save_internal(skribs, SaveFault::None)
    }

    pub fn diagnostics(&self) -> StorageDiagnostics {
        let files = self
            .candidate_paths()
            .into_iter()
            .map(|(source, path)| diagnose_candidate(source, &path))
            .collect();

        StorageDiagnostics {
            generated_at_ms: now_millis(),
            current_schema_version: CURRENT_SCHEMA_VERSION,
            current_revision: self.revision,
            writable: self.is_writable(),
            blocked_reason: self.blocked_reason.clone(),
            files,
        }
    }

    pub fn export_diagnostics(&self) -> Result<PathBuf, StorageError> {
        let parent = self
            .primary_path
            .parent()
            .ok_or(StorageError::MissingParent)?;
        fs::create_dir_all(parent)
            .map_err(|error| io_error("create diagnostics directory", parent, error))?;
        let file_name = format!("skribli-storage-diagnostics-{}.json", now_millis());
        let output = parent.join(file_name);
        let payload = serde_json::to_vec_pretty(&self.diagnostics()).map_err(|error| {
            StorageError::InvalidData {
                path: file_name_for_display(&output),
                reason: format!("failed to encode storage diagnostics: {error}"),
            }
        })?;
        write_bytes_synced(&output, &payload)?;
        Ok(output)
    }

    fn save_internal(
        &mut self,
        skribs: &[SkribNote],
        fault: SaveFault,
    ) -> Result<SaveOutcome, StorageError> {
        if let Some(reason) = &self.blocked_reason {
            return Err(StorageError::WriteBlocked {
                reason: reason.clone(),
            });
        }
        license::require_global_write_access()
            .map_err(|reason| StorageError::WriteBlocked { reason })?;

        let parent = self
            .primary_path
            .parent()
            .ok_or(StorageError::MissingParent)?
            .to_path_buf();
        fs::create_dir_all(&parent)
            .map_err(|error| io_error("create data directory", &parent, error))?;

        let revision = self
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::WriteBlocked {
                reason: "The local storage revision counter is exhausted".to_string(),
            })?;
        let written_at_ms = now_millis();
        let envelope = build_envelope(revision, written_at_ms, skribs)?;
        let payload =
            serde_json::to_vec_pretty(&envelope).map_err(|error| StorageError::InvalidData {
                path: file_name_for_display(&self.primary_path),
                reason: format!("failed to encode the storage envelope: {error}"),
            })?;

        let temporary = self.temporary_path();
        write_bytes_synced(&temporary, &payload)?;
        let temporary_candidate = decode_candidate(&temporary, StorageSource::Temporary)?;
        if temporary_candidate.revision != revision || temporary_candidate.skribs != skribs {
            return Err(StorageError::InvalidData {
                path: file_name_for_display(&temporary),
                reason: "the durable temporary generation did not verify after writing".to_string(),
            });
        }
        maybe_fail(
            fault,
            SaveFault::AfterTemporarySync,
            "after temporary file sync",
        )?;

        self.rotate_backups()?;
        maybe_fail(
            fault,
            SaveFault::AfterBackupRotation,
            "after backup rotation",
        )?;
        maybe_fail(
            fault,
            SaveFault::BeforePrimaryReplace,
            "before primary replacement",
        )?;

        atomic_replace(&temporary, &self.primary_path)?;
        sync_parent_directory(&parent)?;
        maybe_fail(
            fault,
            SaveFault::AfterPrimaryReplace,
            "after primary replacement",
        )?;

        let committed = match decode_candidate(&self.primary_path, StorageSource::Primary) {
            Ok(committed) => committed,
            Err(error) => {
                return Err(self.block_writes(format!(
                    "The committed primary generation could not be verified: {error}"
                )));
            }
        };
        if committed.revision != revision || committed.skribs != skribs {
            return Err(self.block_writes(
                "The committed primary generation did not match the requested revision".to_string(),
            ));
        }

        self.revision = revision;
        Ok(SaveOutcome {
            revision,
            written_at_ms,
        })
    }

    fn restore_candidate(&mut self, selected: &DecodedCandidate) -> Result<(), StorageError> {
        let parent = self
            .primary_path
            .parent()
            .ok_or(StorageError::MissingParent)?
            .to_path_buf();
        fs::create_dir_all(&parent)
            .map_err(|error| io_error("create data directory", &parent, error))?;

        if self.primary_path.exists() {
            let _ = decode_candidate(&self.primary_path, StorageSource::Primary)?;
            self.rotate_backups()?;
        }

        let envelope = build_envelope(
            selected.revision,
            selected.written_at_ms.max(now_millis()),
            &selected.skribs,
        )?;
        let payload =
            serde_json::to_vec_pretty(&envelope).map_err(|error| StorageError::InvalidData {
                path: file_name_for_display(&self.primary_path),
                reason: format!("failed to encode the recovered storage envelope: {error}"),
            })?;
        let recovery_temporary = sibling_path(&self.primary_path, ".recovery.tmp");
        write_bytes_synced(&recovery_temporary, &payload)?;
        let verified = decode_candidate(&recovery_temporary, selected.source)?;
        if verified.revision != selected.revision || verified.skribs != selected.skribs {
            return Err(StorageError::InvalidData {
                path: file_name_for_display(&recovery_temporary),
                reason: "the recovered generation did not verify before replacement".to_string(),
            });
        }
        atomic_replace(&recovery_temporary, &self.primary_path)?;
        sync_parent_directory(&parent)?;
        let _ = decode_candidate(&self.primary_path, StorageSource::Primary)?;
        Ok(())
    }

    fn rotate_backups(&mut self) -> Result<(), StorageError> {
        let backup1 = self.backup1_path();
        let backup2 = self.backup2_path();

        if backup1.exists() {
            match decode_candidate(&backup1, StorageSource::Backup1) {
                Ok(_) => {
                    let stage2 = sibling_path(&self.primary_path, ".bak.2.stage");
                    copy_verified_generation(&backup1, &stage2, StorageSource::Backup1)?;
                    atomic_replace(&stage2, &backup2)?;
                }
                Err(error @ StorageError::UnsupportedSchema { .. }) => {
                    return Err(self.block_writes(error.to_string()));
                }
                Err(_) => {
                    quarantine_file(&backup1, StorageSource::Backup1, 0)?;
                }
            }
        }

        if self.primary_path.exists() {
            if let Err(error) = decode_candidate(&self.primary_path, StorageSource::Primary) {
                return Err(self.block_writes(format!(
                    "The existing primary generation changed or became invalid before backup rotation: {error}"
                )));
            }
            let stage1 = sibling_path(&self.primary_path, ".bak.1.stage");
            copy_verified_generation(&self.primary_path, &stage1, StorageSource::Primary)?;
            atomic_replace(&stage1, &backup1)?;
        }

        if let Some(parent) = self.primary_path.parent() {
            sync_parent_directory(parent)?;
        }
        Ok(())
    }

    fn candidate_paths(&self) -> Vec<(StorageSource, PathBuf)> {
        vec![
            (StorageSource::Primary, self.primary_path.clone()),
            (StorageSource::Temporary, self.temporary_path()),
            (StorageSource::Backup1, self.backup1_path()),
            (StorageSource::LegacyBackup, self.legacy_backup_path()),
            (StorageSource::Backup2, self.backup2_path()),
        ]
    }

    fn temporary_path(&self) -> PathBuf {
        sibling_path(&self.primary_path, ".tmp")
    }

    fn backup1_path(&self) -> PathBuf {
        sibling_path(&self.primary_path, ".bak.1")
    }

    fn backup2_path(&self) -> PathBuf {
        sibling_path(&self.primary_path, ".bak.2")
    }

    fn legacy_backup_path(&self) -> PathBuf {
        sibling_path(&self.primary_path, ".bak")
    }
}

fn build_envelope(
    revision: u64,
    written_at_ms: u64,
    skribs: &[SkribNote],
) -> Result<StoredSkribsV2, StorageError> {
    let integrity = calculate_integrity(revision, written_at_ms, skribs)?;
    Ok(StoredSkribsV2 {
        schema_version: CURRENT_SCHEMA_VERSION,
        revision,
        written_at_ms,
        integrity,
        skribs: skribs.to_vec(),
    })
}

fn calculate_integrity(
    revision: u64,
    written_at_ms: u64,
    skribs: &[SkribNote],
) -> Result<String, StorageError> {
    calculate_integrity_for_schema(CURRENT_SCHEMA_VERSION, revision, written_at_ms, skribs)
}

fn calculate_integrity_for_schema(
    schema_version: u32,
    revision: u64,
    written_at_ms: u64,
    skribs: &[SkribNote],
) -> Result<String, StorageError> {
    let bytes = serde_json::to_vec(&IntegrityPayload {
        schema_version,
        revision,
        written_at_ms,
        skribs,
    })
    .map_err(|error| StorageError::InvalidData {
        path: "in-memory storage envelope".to_string(),
        reason: format!("failed to calculate integrity data: {error}"),
    })?;
    Ok(format!("crc32:{:08x}", crc32(&bytes)))
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff_u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = 0_u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }
    !crc
}

fn decode_candidate(path: &Path, source: StorageSource) -> Result<DecodedCandidate, StorageError> {
    let mut file =
        File::open(path).map_err(|error| io_error("open storage generation", path, error))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| io_error("read storage generation", path, error))?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|error| StorageError::InvalidData {
            path: file_name_for_display(path),
            reason: format!("invalid JSON: {error}"),
        })?;

    if let Some(schema_value) = value.get("schema_version") {
        let schema_version = schema_value
            .as_u64()
            .ok_or_else(|| StorageError::InvalidData {
                path: file_name_for_display(path),
                reason: "schema_version must be an unsigned integer".to_string(),
            })?;
        if schema_version != u64::from(CURRENT_SCHEMA_VERSION)
            && schema_version != u64::from(PREVIOUS_SCHEMA_VERSION)
        {
            return Err(StorageError::UnsupportedSchema {
                path: file_name_for_display(path),
                version: schema_version,
            });
        }

        let stored: StoredSkribsV2 =
            serde_json::from_value(value).map_err(|error| StorageError::InvalidData {
                path: file_name_for_display(path),
                reason: format!("invalid schema-v{} envelope: {error}", schema_version),
            })?;
        let expected = calculate_integrity_for_schema(
            stored.schema_version,
            stored.revision,
            stored.written_at_ms,
            &stored.skribs,
        )?;
        if stored.integrity != expected {
            return Err(StorageError::InvalidData {
                path: file_name_for_display(path),
                reason: "integrity digest mismatch".to_string(),
            });
        }

        return Ok(DecodedCandidate {
            source,
            path: path.to_path_buf(),
            revision: stored.revision,
            written_at_ms: stored.written_at_ms,
            skribs: stored.skribs,
            migrated_from_schema: (stored.schema_version != CURRENT_SCHEMA_VERSION)
                .then_some(stored.schema_version),
        });
    }

    if let Some(version_value) = value.get("version") {
        let version = version_value
            .as_u64()
            .ok_or_else(|| StorageError::InvalidData {
                path: file_name_for_display(path),
                reason: "legacy version must be an unsigned integer".to_string(),
            })?;
        if version != u64::from(LEGACY_SCHEMA_VERSION) {
            return Err(StorageError::UnsupportedSchema {
                path: file_name_for_display(path),
                version,
            });
        }
        let stored: StoredSkribsV1 =
            serde_json::from_value(value).map_err(|error| StorageError::InvalidData {
                path: file_name_for_display(path),
                reason: format!("invalid legacy storage envelope: {error}"),
            })?;
        return Ok(DecodedCandidate {
            source,
            path: path.to_path_buf(),
            revision: 0,
            written_at_ms: file_modified_millis(path),
            skribs: stored.skribs,
            migrated_from_schema: Some(LEGACY_SCHEMA_VERSION),
        });
    }

    Err(StorageError::InvalidData {
        path: file_name_for_display(path),
        reason: "missing schema_version/version field".to_string(),
    })
}

fn diagnose_candidate(source: StorageSource, path: &Path) -> StorageFileDiagnostic {
    if !path.exists() {
        return StorageFileDiagnostic {
            source,
            file_name: file_name_for_display(path),
            exists: false,
            size_bytes: None,
            modified_at_ms: None,
            status: "missing".to_string(),
            revision: None,
            schema_version: None,
            error: None,
        };
    }

    let metadata = fs::metadata(path).ok();
    let size_bytes = metadata.as_ref().map(fs::Metadata::len);
    let modified_at_ms = metadata
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_millis().try_into().ok());

    match decode_candidate(path, source) {
        Ok(candidate) => StorageFileDiagnostic {
            source,
            file_name: file_name_for_display(path),
            exists: true,
            size_bytes,
            modified_at_ms,
            status: "valid".to_string(),
            revision: Some(candidate.revision),
            schema_version: Some(
                candidate
                    .migrated_from_schema
                    .unwrap_or(CURRENT_SCHEMA_VERSION),
            ),
            error: None,
        },
        Err(error @ StorageError::UnsupportedSchema { .. }) => StorageFileDiagnostic {
            source,
            file_name: file_name_for_display(path),
            exists: true,
            size_bytes,
            modified_at_ms,
            status: "unsupportedSchema".to_string(),
            revision: None,
            schema_version: None,
            error: Some(error.to_string()),
        },
        Err(error) => StorageFileDiagnostic {
            source,
            file_name: file_name_for_display(path),
            exists: true,
            size_bytes,
            modified_at_ms,
            status: "invalid".to_string(),
            revision: None,
            schema_version: None,
            error: Some(error.to_string()),
        },
    }
}

fn copy_verified_generation(
    source: &Path,
    destination: &Path,
    source_kind: StorageSource,
) -> Result<(), StorageError> {
    let expected = decode_candidate(source, source_kind)?;
    let bytes =
        fs::read(source).map_err(|error| io_error("read known-good generation", source, error))?;
    write_bytes_synced(destination, &bytes)?;
    let copied = decode_candidate(destination, source_kind)?;
    if copied.revision != expected.revision || copied.skribs != expected.skribs {
        return Err(StorageError::InvalidData {
            path: file_name_for_display(destination),
            reason: "backup verification did not match its source generation".to_string(),
        });
    }
    Ok(())
}

fn write_bytes_synced(path: &Path, bytes: &[u8]) -> Result<(), StorageError> {
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|error| io_error("open durable temporary generation", path, error))?;
    file.write_all(bytes)
        .map_err(|error| io_error("write durable temporary generation", path, error))?;
    file.sync_all()
        .map_err(|error| io_error("flush durable temporary generation", path, error))?;
    drop(file);
    Ok(())
}

#[cfg(target_os = "windows")]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), StorageError> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination_wide = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();

    unsafe {
        MoveFileExW(
            PCWSTR(source_wide.as_ptr()),
            PCWSTR(destination_wide.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|error| StorageError::Io {
        operation: "atomically replace storage generation",
        path: file_name_for_display(destination),
        message: error.to_string(),
    })
}

#[cfg(not(target_os = "windows"))]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), StorageError> {
    fs::rename(source, destination)
        .map_err(|error| io_error("atomically replace storage generation", destination, error))
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) -> Result<(), StorageError> {
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| io_error("flush storage directory", parent, error))
}

#[cfg(not(unix))]
fn sync_parent_directory(_parent: &Path) -> Result<(), StorageError> {
    Ok(())
}

fn quarantine_file(
    path: &Path,
    source: StorageSource,
    index: usize,
) -> Result<PathBuf, StorageError> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("skribs.json");
    let quarantine_name = format!(
        "{file_name}.corrupt.{}.{}.{}",
        now_millis(),
        source.priority(),
        index
    );
    let quarantine_path = path.with_file_name(quarantine_name);
    fs::rename(path, &quarantine_path)
        .map_err(|error| io_error("quarantine damaged storage generation", path, error))?;
    Ok(quarantine_path)
}

fn cleanup_stale_temporary(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn sibling_path(primary: &Path, suffix: &str) -> PathBuf {
    let name = primary
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("skribs.json");
    primary.with_file_name(format!("{name}{suffix}"))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn file_modified_millis(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_millis().try_into().ok())
        .unwrap_or(0)
}

fn parent_directory_for_display(path: &Path) -> String {
    path.parent()
        .map(|parent| parent.to_string_lossy().into_owned())
        .unwrap_or_else(|| ".".to_string())
}

fn file_name_for_display(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn io_error(operation: &'static str, path: &Path, error: std::io::Error) -> StorageError {
    StorageError::Io {
        operation,
        path: file_name_for_display(path),
        message: error.to_string(),
    }
}

fn maybe_fail(
    actual: SaveFault,
    expected: SaveFault,
    stage: &'static str,
) -> Result<(), StorageError> {
    if actual == expected {
        Err(StorageError::InjectedFailure { stage })
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn note(id: &str, text: &str) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Notes - Notepad".into(),
            rel_x: 10.0,
            rel_y: 20.0,
            width: 300.0,
            height: 220.0,
            text: text.into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 2,
            deleted_at: None,
        }
    }

    fn test_path(name: &str) -> PathBuf {
        let sequence = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "skribly-storage-{name}-{}-{sequence}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).expect("test directory should be created");
        directory.join("skribs.json")
    }

    fn cleanup(path: &Path) {
        if let Some(parent) = path.parent() {
            let _ = fs::remove_dir_all(parent);
        }
    }

    fn write_legacy(path: &Path, skribs: Vec<SkribNote>) {
        let payload = serde_json::to_vec_pretty(&StoredSkribsV1 {
            version: LEGACY_SCHEMA_VERSION,
            skribs,
        })
        .expect("legacy payload should encode");
        write_bytes_synced(path, &payload).expect("legacy payload should be written");
    }

    #[test]
    fn round_trips_integrity_checked_storage() {
        let path = test_path("roundtrip");
        let mut storage = StorageService::new(path.clone());
        assert_eq!(storage.load().expect("empty load").skribs, Vec::new());
        let saved = storage
            .save(&[note("a", "Persistent")])
            .expect("save should succeed");
        assert_eq!(saved.revision, 1);

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("load should succeed");
        assert_eq!(loaded.skribs, vec![note("a", "Persistent")]);
        assert_eq!(loaded.revision, 1);
        assert!(loaded.notice.is_none());
        cleanup(&path);
    }

    #[test]
    fn migrates_legacy_v1_without_losing_notes() {
        let path = test_path("legacy");
        write_legacy(&path, vec![note("legacy", "Old format")]);

        let mut storage = StorageService::new(path.clone());
        let loaded = storage.load().expect("legacy load should succeed");
        assert_eq!(loaded.skribs, vec![note("legacy", "Old format")]);
        assert_eq!(
            loaded
                .notice
                .as_ref()
                .and_then(|notice| notice.migrated_from_schema),
            Some(LEGACY_SCHEMA_VERSION)
        );
        let migrated = decode_candidate(&path, StorageSource::Primary)
            .expect("migrated primary should verify");
        assert_eq!(migrated.migrated_from_schema, None);
        cleanup(&path);
    }

    #[test]
    fn recovers_when_primary_is_missing_but_backup_exists() {
        let path = test_path("missing-primary");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "First")]).expect("first save");
        storage.save(&[note("two", "Second")]).expect("second save");
        fs::remove_file(&path).expect("primary should be removed for the test");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("backup recovery should succeed");
        assert_eq!(loaded.skribs, vec![note("one", "First")]);
        assert_eq!(
            loaded.notice.as_ref().map(|notice| notice.source),
            Some(StorageSource::Backup1)
        );
        assert!(path.exists());
        cleanup(&path);
    }

    #[test]
    fn quarantines_corrupt_primary_and_recovers_backup() {
        let path = test_path("corrupt-primary");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "First")]).expect("first save");
        storage.save(&[note("two", "Second")]).expect("second save");
        write_bytes_synced(&path, b"{not-json").expect("corruption fixture");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("backup recovery should succeed");
        assert_eq!(loaded.skribs, vec![note("one", "First")]);
        let notice = loaded.notice.expect("recovery notice should exist");
        assert_eq!(notice.source, StorageSource::Backup1);
        assert_eq!(notice.quarantined_files.len(), 1);
        assert!(path.exists());
        cleanup(&path);
    }

    #[test]
    fn interruption_after_temporary_sync_recovers_latest_revision() {
        let path = test_path("fault-temp");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "First")]).expect("first save");
        let error = storage
            .save_internal(&[note("two", "Newest")], SaveFault::AfterTemporarySync)
            .expect_err("fault should interrupt save");
        assert!(matches!(error, StorageError::InjectedFailure { .. }));

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("temporary recovery should succeed");
        assert_eq!(loaded.skribs, vec![note("two", "Newest")]);
        assert_eq!(
            loaded.notice.as_ref().map(|notice| notice.source),
            Some(StorageSource::Temporary)
        );
        cleanup(&path);
    }

    #[test]
    fn interruption_after_backup_rotation_keeps_latest_temporary_generation() {
        let path = test_path("fault-backup");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "First")]).expect("first save");
        storage
            .save_internal(&[note("two", "Newest")], SaveFault::AfterBackupRotation)
            .expect_err("fault should interrupt save");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("recovery should succeed");
        assert_eq!(loaded.skribs, vec![note("two", "Newest")]);
        cleanup(&path);
    }

    #[test]
    fn interruption_after_primary_replace_keeps_the_committed_revision() {
        let path = test_path("fault-after-replace");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "First")]).expect("first save");
        storage
            .save_internal(
                &[note("two", "Committed before interruption")],
                SaveFault::AfterPrimaryReplace,
            )
            .expect_err("fault should interrupt verification");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened
            .load()
            .expect("the replaced primary should verify on restart");
        assert_eq!(
            loaded.skribs,
            vec![note("two", "Committed before interruption")]
        );
        assert_eq!(loaded.revision, 2);
        cleanup(&path);
    }

    #[test]
    fn rotates_two_known_good_backup_generations() {
        let path = test_path("rotation");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "One")]).expect("save one");
        storage.save(&[note("two", "Two")]).expect("save two");
        storage.save(&[note("three", "Three")]).expect("save three");

        let backup1 = decode_candidate(&storage.backup1_path(), StorageSource::Backup1)
            .expect("backup1 should verify");
        let backup2 = decode_candidate(&storage.backup2_path(), StorageSource::Backup2)
            .expect("backup2 should verify");
        assert_eq!(backup1.skribs, vec![note("two", "Two")]);
        assert_eq!(backup2.skribs, vec![note("one", "One")]);
        cleanup(&path);
    }

    #[test]
    fn existing_corrupt_files_are_never_treated_as_empty_storage() {
        let path = test_path("no-silent-empty");
        write_bytes_synced(&path, b"not-json").expect("corruption fixture");

        let mut storage = StorageService::new(path.clone());
        let error = storage
            .load()
            .expect_err("corrupt-only storage must fail closed");
        assert!(matches!(error, StorageError::NoRecoverableData { .. }));
        assert!(!storage.is_writable());
        assert!(path.exists());

        let mut reopened = StorageService::new(path.clone());
        let second_error = reopened
            .load()
            .expect_err("a second launch must not convert corruption into an empty store");
        assert!(matches!(
            second_error,
            StorageError::NoRecoverableData { .. }
        ));
        assert!(!reopened.is_writable());
        assert!(path.exists());
        cleanup(&path);
    }

    #[test]
    fn damaged_old_backup_is_quarantined_without_blocking_a_new_save() {
        let path = test_path("damaged-backup");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "One")]).expect("save one");
        storage.save(&[note("two", "Two")]).expect("save two");
        write_bytes_synced(&storage.backup1_path(), b"damaged").expect("damage backup fixture");

        storage
            .save(&[note("three", "Three")])
            .expect("valid primary should still be saved");

        let backup1 = decode_candidate(&storage.backup1_path(), StorageSource::Backup1)
            .expect("latest known-good primary should replace the damaged backup");
        assert_eq!(backup1.skribs, vec![note("two", "Two")]);
        let quarantine_count = fs::read_dir(path.parent().expect("parent"))
            .expect("read data directory")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains(".bak.1.corrupt.")
            })
            .count();
        assert_eq!(quarantine_count, 1);
        cleanup(&path);
    }

    #[test]
    fn read_only_recovery_outcome_exposes_verified_notes_and_blocks_writes() {
        let path = test_path("read-only-recovery");
        let mut storage = StorageService::new(path.clone());
        let selected = DecodedCandidate {
            source: StorageSource::Backup1,
            path: storage.backup1_path(),
            revision: 7,
            written_at_ms: 10,
            skribs: vec![note("safe", "Verified recovery text")],
            migrated_from_schema: None,
        };

        let outcome = storage.read_only_recovery_outcome(
            &selected,
            "Primary replacement was denied".to_string(),
            Vec::new(),
        );
        assert_eq!(outcome.skribs, selected.skribs);
        assert_eq!(outcome.revision, 7);
        assert!(!storage.is_writable());
        assert!(storage.save(&[note("new", "Must remain blocked")]).is_err());
        assert!(outcome
            .notice
            .expect("read-only notice")
            .message
            .contains("read-only recovery mode"));
        cleanup(&path);
    }

    #[test]
    fn future_backup_with_valid_primary_opens_verified_notes_read_only() {
        let path = test_path("future-backup-startup");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage
            .save(&[note("one", "Verified primary")])
            .expect("save one");
        write_bytes_synced(
            &storage.backup1_path(),
            br#"{"schema_version":99,"revision":50,"written_at_ms":1,"integrity":"future","skribs":[]}"#,
        )
        .expect("future backup fixture");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened
            .load()
            .expect("verified primary should remain visible read-only");
        assert_eq!(loaded.skribs, vec![note("one", "Verified primary")]);
        assert!(!reopened.is_writable());
        assert!(loaded
            .notice
            .expect("future-schema recovery notice")
            .message
            .contains("newer unsupported storage generation"));
        assert!(storage.backup1_path().exists());
        cleanup(&path);
    }

    #[test]
    fn unsupported_backup_generation_blocks_further_writes() {
        let path = test_path("unsupported-backup");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "One")]).expect("save one");
        storage.save(&[note("two", "Two")]).expect("save two");
        write_bytes_synced(
            &storage.backup1_path(),
            br#"{"schema_version":99,"revision":50,"written_at_ms":1,"integrity":"future","skribs":[]}"#,
        )
        .expect("future backup fixture");

        let error = storage
            .save(&[note("three", "Three")])
            .expect_err("future backup must block writes");
        assert!(matches!(error, StorageError::WriteBlocked { .. }));
        assert!(!storage.is_writable());
        cleanup(&path);
    }

    #[test]
    fn exported_diagnostics_never_include_note_contents_or_target_titles() {
        let path = test_path("diagnostics");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage
            .save(&[note("private", "Never include this private text")])
            .expect("save diagnostics fixture");

        let diagnostics_path = storage
            .export_diagnostics()
            .expect("diagnostics should export");
        let diagnostics =
            fs::read_to_string(diagnostics_path).expect("diagnostics should be readable");
        assert!(!diagnostics.contains("Never include this private text"));
        assert!(!diagnostics.contains("Notes - Notepad"));
        assert!(diagnostics.contains("currentSchemaVersion"));
        assert!(diagnostics.contains("skribs.json"));
        cleanup(&path);
    }

    #[test]
    fn unsupported_schema_is_preserved_and_blocks_writes() {
        let path = test_path("unsupported");
        let bytes = br#"{
          "schema_version": 99,
          "revision": 20,
          "written_at_ms": 1,
          "integrity": "future",
          "skribs": []
        }"#;
        write_bytes_synced(&path, bytes).expect("future fixture");
        let original = fs::read(&path).expect("fixture should be readable");

        let mut storage = StorageService::new(path.clone());
        let error = storage
            .load()
            .expect_err("future schema must block downgrade");
        assert!(matches!(error, StorageError::WriteBlocked { .. }));
        assert!(storage.save(&[note("new", "Must not overwrite")]).is_err());
        assert_eq!(fs::read(&path).expect("future file remains"), original);
        cleanup(&path);
    }

    #[test]
    fn integrity_mismatch_falls_back_to_verified_backup() {
        let path = test_path("integrity");
        let mut storage = StorageService::new(path.clone());
        storage.load().expect("empty load");
        storage.save(&[note("one", "One")]).expect("save one");
        storage.save(&[note("two", "Two")]).expect("save two");

        let mut value: Value =
            serde_json::from_slice(&fs::read(&path).expect("read primary")).expect("primary JSON");
        value["skribs"][0]["text"] = Value::String("Tampered".into());
        write_bytes_synced(
            &path,
            &serde_json::to_vec_pretty(&value).expect("tampered JSON"),
        )
        .expect("write tampered primary");

        let mut reopened = StorageService::new(path.clone());
        let loaded = reopened.load().expect("backup should recover");
        assert_eq!(loaded.skribs, vec![note("one", "One")]);
        cleanup(&path);
    }
}
