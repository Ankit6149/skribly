use crate::core::models::SkribNote;
use crate::desktop::library::{
    current_time_millis, sort_notes_for_library, write_library_export, LibraryExportEnvelope,
    LibraryExportScope, LIBRARY_WINDOW_LABEL,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use tauri::{App, AppHandle, Emitter, Listener, Manager, Runtime};

pub const LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT: &str = "skribly://library-import-preview-request";
pub const LIBRARY_IMPORT_PREVIEW_RESULT_EVENT: &str = "skribly://library-import-preview-result";
pub const LIBRARY_IMPORT_APPLY_REQUEST_EVENT: &str = "skribly://library-import-apply-request";
pub const LIBRARY_IMPORT_APPLY_RESULT_EVENT: &str = "skribly://library-import-apply-result";

const PORTABLE_IMPORT_SCHEMA_VERSION: u32 = 1;
const MAX_IMPORT_BYTES: usize = 10 * 1024 * 1024;
const MAX_IMPORT_NOTES: usize = 50_000;
const MAX_IMPORT_REQUEST_ID_CHARACTERS: usize = 128;
const MAX_NOTE_ID_CHARACTERS: usize = 256;
const MAX_PROCESS_NAME_CHARACTERS: usize = 512;
const MAX_CONTEXT_TITLE_CHARACTERS: usize = 4_096;
const MAX_NOTE_CHARACTERS: usize = 20_000;
const MAX_GEOMETRY_COORDINATE: f64 = 1_000_000.0;
const MAX_GEOMETRY_DIMENSION: f64 = 100_000.0;
const MAX_CONFLICT_DETAILS: usize = 50;
const ALLOWED_NOTE_COLORS: [&str; 5] = ["yellow", "peach", "mint", "sky", "lavender"];

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ImportPreviewRequest {
    request_id: String,
    raw_json: String,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ImportConflictMode {
    Skip,
    Replace,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ImportApplyRequest {
    request_id: String,
    raw_json: String,
    expected_fingerprint: String,
    expected_revision: u64,
    conflict_mode: ImportConflictMode,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
// Schema 1 deliberately preserves SkribNote's established snake_case field names inside the
// camelCase export envelope. Import must mirror the files produced by write_library_export.
#[serde(deny_unknown_fields)]
struct PortableSkribNote {
    id: String,
    target_process_name: String,
    target_title: String,
    rel_x: f64,
    rel_y: f64,
    width: f64,
    height: f64,
    text: String,
    color: String,
    collapsed: bool,
    created_at: u64,
    updated_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    deleted_at: Option<u64>,
}

impl From<PortableSkribNote> for SkribNote {
    fn from(note: PortableSkribNote) -> Self {
        Self {
            id: note.id,
            target_process_name: note.target_process_name,
            target_title: note.target_title,
            rel_x: note.rel_x,
            rel_y: note.rel_y,
            width: note.width,
            height: note.height,
            text: note.text,
            color: note.color,
            collapsed: note.collapsed,
            created_at: note.created_at,
            updated_at: note.updated_at,
            deleted_at: note.deleted_at,
        }
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PortableImportEnvelope {
    schema_version: u32,
    exported_at_ms: u64,
    scope: LibraryExportScope,
    note_count: usize,
    notes: Vec<PortableSkribNote>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportConflictDetail {
    note_id: String,
    existing_updated_at: u64,
    imported_updated_at: u64,
    existing_trashed: bool,
    imported_trashed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    request_id: String,
    fingerprint: String,
    schema_version: u32,
    source_scope: LibraryExportScope,
    total_count: usize,
    active_count: usize,
    trash_count: usize,
    new_count: usize,
    identical_count: usize,
    conflict_count: usize,
    conflict_details: Vec<ImportConflictDetail>,
    current_revision: u64,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ImportPreviewResult {
    request_id: String,
    preview: Option<ImportPreview>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ImportApplySummary {
    imported_count: usize,
    replaced_count: usize,
    identical_skipped_count: usize,
    conflict_skipped_count: usize,
    active_count: usize,
    trash_count: usize,
    rollback_path: Option<String>,
    revision: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ImportApplyResult {
    request_id: String,
    summary: Option<ImportApplySummary>,
    error: Option<String>,
}

#[derive(Debug, Clone)]
struct ParsedImport {
    fingerprint: String,
    schema_version: u32,
    source_scope: LibraryExportScope,
    notes: Vec<SkribNote>,
}

#[derive(Debug, Clone)]
struct ImportPlan {
    new_notes: Vec<SkribNote>,
    identical_count: usize,
    conflicts: Vec<(SkribNote, SkribNote)>,
}

pub fn install_library_import_bridge<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let preview_handle = app.handle().clone();
    app.listen(LIBRARY_IMPORT_PREVIEW_REQUEST_EVENT, move |event| {
        let request_id = request_id_from_payload(event.payload());
        let result = match serde_json::from_str::<ImportPreviewRequest>(event.payload()) {
            Ok(request) => match perform_preview(&preview_handle, request.clone()) {
                Ok(preview) => ImportPreviewResult {
                    request_id: request.request_id,
                    preview: Some(preview),
                    error: None,
                },
                Err(error) => ImportPreviewResult {
                    request_id: request.request_id,
                    preview: None,
                    error: Some(error),
                },
            },
            Err(_) => ImportPreviewResult {
                request_id,
                preview: None,
                error: Some("Skribli rejected an invalid import-preview request.".into()),
            },
        };
        let _ = preview_handle.emit_to(
            LIBRARY_WINDOW_LABEL,
            LIBRARY_IMPORT_PREVIEW_RESULT_EVENT,
            result,
        );
    });

    let apply_handle = app.handle().clone();
    app.listen(LIBRARY_IMPORT_APPLY_REQUEST_EVENT, move |event| {
        let request_id = request_id_from_payload(event.payload());
        let result = match serde_json::from_str::<ImportApplyRequest>(event.payload()) {
            Ok(request) => match perform_apply(&apply_handle, request.clone()) {
                Ok(summary) => ImportApplyResult {
                    request_id: request.request_id,
                    summary: Some(summary),
                    error: None,
                },
                Err(error) => ImportApplyResult {
                    request_id: request.request_id,
                    summary: None,
                    error: Some(error),
                },
            },
            Err(_) => ImportApplyResult {
                request_id,
                summary: None,
                error: Some("Skribli rejected an invalid import-apply request.".into()),
            },
        };
        let _ = apply_handle.emit_to(
            LIBRARY_WINDOW_LABEL,
            LIBRARY_IMPORT_APPLY_RESULT_EVENT,
            result,
        );
    });

    Ok(())
}

fn request_id_from_payload(payload: &str) -> String {
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("requestId")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_default()
}

fn perform_preview<R: Runtime>(
    app_handle: &AppHandle<R>,
    request: ImportPreviewRequest,
) -> Result<ImportPreview, String> {
    validate_request_id(&request.request_id)?;
    let parsed = parse_import(&request.raw_json)?;
    let state = app_handle.state::<crate::AppState>();
    let current_notes = state.coordinator.get_all_skribs();
    let current_revision = state
        .storage
        .lock()
        .map_err(|_| "Local storage service is unavailable".to_string())?
        .current_revision();
    let plan = build_import_plan(&current_notes, &parsed.notes);
    Ok(build_preview(
        request.request_id,
        parsed,
        plan,
        current_revision,
    ))
}

fn perform_apply<R: Runtime>(
    app_handle: &AppHandle<R>,
    request: ImportApplyRequest,
) -> Result<ImportApplySummary, String> {
    validate_request_id(&request.request_id)?;
    if request.expected_fingerprint.trim().is_empty() {
        return Err("Import preview fingerprint is missing. Preview the file again.".into());
    }

    let parsed = parse_import(&request.raw_json)?;
    if parsed.fingerprint != request.expected_fingerprint {
        return Err("The selected import file changed after preview. Preview it again.".into());
    }

    let state = app_handle.state::<crate::AppState>();
    let _mutation_guard = state
        .mutation_lock
        .lock()
        .map_err(|_| "Local note mutation lock is unavailable".to_string())?;

    crate::core::license::require_global_write_access()
        .map_err(|reason| format!("Import apply is unavailable: {reason}"))?;
    let (current_revision, storage_writable, blocked_reason) = {
        let storage = state
            .storage
            .lock()
            .map_err(|_| "Local storage service is unavailable".to_string())?;
        (
            storage.current_revision(),
            storage.is_writable(),
            storage.blocked_reason().map(ToString::to_string),
        )
    };
    if !storage_writable {
        return Err(
            blocked_reason.unwrap_or_else(|| "Local note storage is read-only.".to_string())
        );
    }
    validate_expected_revision(current_revision, request.expected_revision)?;

    let mut previous_notes = state.coordinator.get_all_skribs();
    sort_notes_for_library(&mut previous_notes);
    let plan = build_import_plan(&previous_notes, &parsed.notes);
    let conflict_skipped_count = if request.conflict_mode == ImportConflictMode::Skip {
        plan.conflicts.len()
    } else {
        0
    };
    let replaced_count = if request.conflict_mode == ImportConflictMode::Replace {
        plan.conflicts.len()
    } else {
        0
    };

    if plan.new_notes.is_empty() && replaced_count == 0 {
        let (active_count, trash_count) = lifecycle_counts(&previous_notes);
        return Ok(ImportApplySummary {
            imported_count: 0,
            replaced_count: 0,
            identical_skipped_count: plan.identical_count,
            conflict_skipped_count,
            active_count,
            trash_count,
            rollback_path: None,
            revision: current_revision,
        });
    }

    let backup_directory = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to locate the Skribli data folder: {error}"))?
        .join("import-backups");
    let rollback_path = write_library_export(
        &backup_directory,
        LibraryExportScope::CompleteBackup,
        previous_notes.clone(),
        current_time_millis(),
    )?;
    verify_rollback_backup(&rollback_path, &previous_notes)?;

    let merged_notes = merge_import_plan(&previous_notes, &plan, request.conflict_mode);
    let revision = persist_import_collection(&state, previous_notes, merged_notes.clone())?;
    let (active_count, trash_count) = lifecycle_counts(&merged_notes);
    Ok(ImportApplySummary {
        imported_count: plan.new_notes.len(),
        replaced_count,
        identical_skipped_count: plan.identical_count,
        conflict_skipped_count,
        active_count,
        trash_count,
        rollback_path: Some(rollback_path.to_string_lossy().into_owned()),
        revision,
    })
}

fn verify_rollback_backup(path: &Path, expected_notes: &[SkribNote]) -> Result<(), String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("Failed to read the pre-import rollback backup: {error}"))?;
    let envelope: LibraryExportEnvelope = serde_json::from_slice(&bytes)
        .map_err(|error| format!("The pre-import rollback backup did not verify: {error}"))?;
    if envelope.schema_version != 1
        || envelope.scope != LibraryExportScope::CompleteBackup
        || envelope.note_count != expected_notes.len()
        || envelope.notes != expected_notes
    {
        return Err(
            "The pre-import rollback backup did not match the authoritative local collection."
                .into(),
        );
    }
    Ok(())
}

fn validate_expected_revision(current_revision: u64, expected_revision: u64) -> Result<(), String> {
    if current_revision != expected_revision {
        return Err(
            "Local notes changed after preview. Refresh All Skribs and preview the file again."
                .into(),
        );
    }
    Ok(())
}

fn merge_import_plan(
    current: &[SkribNote],
    plan: &ImportPlan,
    conflict_mode: ImportConflictMode,
) -> Vec<SkribNote> {
    let mut merged_by_id: HashMap<String, SkribNote> = current
        .iter()
        .cloned()
        .map(|note| (note.id.clone(), note))
        .collect();
    for note in &plan.new_notes {
        merged_by_id.insert(note.id.clone(), note.clone());
    }
    if conflict_mode == ImportConflictMode::Replace {
        for (_, imported) in &plan.conflicts {
            merged_by_id.insert(imported.id.clone(), imported.clone());
        }
    }

    let mut merged_notes: Vec<SkribNote> = merged_by_id.into_values().collect();
    sort_notes_for_library(&mut merged_notes);
    merged_notes
}

fn persist_import_collection(
    state: &crate::AppState,
    previous_notes: Vec<SkribNote>,
    merged_notes: Vec<SkribNote>,
) -> Result<u64, String> {
    state.coordinator.replace_all_skribs(merged_notes.clone());
    let save_result = match state.storage.lock() {
        Ok(mut storage) => storage.save(&merged_notes),
        Err(_) => {
            state.coordinator.replace_all_skribs(previous_notes);
            return Err("Local storage service is unavailable".to_string());
        }
    };

    match save_result {
        Ok(outcome) => {
            if let Ok(mut storage_error) = state.storage_error.lock() {
                *storage_error = None;
            }
            Ok(outcome.revision)
        }
        Err(error) => {
            state.coordinator.replace_all_skribs(previous_notes);
            let message = error.to_string();
            if let Ok(mut storage_error) = state.storage_error.lock() {
                *storage_error = Some(message.clone());
            }
            Err(format!(
                "Skribli could not apply the import. Local notes were restored: {message}"
            ))
        }
    }
}

fn validate_request_id(request_id: &str) -> Result<(), String> {
    let length = request_id.chars().count();
    if length == 0
        || length > MAX_IMPORT_REQUEST_ID_CHARACTERS
        || request_id.chars().any(char::is_control)
    {
        return Err("Skribli rejected an invalid import request identifier.".into());
    }
    Ok(())
}

fn parse_import(raw_json: &str) -> Result<ParsedImport, String> {
    if raw_json.is_empty() {
        return Err("Choose a Skribli JSON export before previewing.".into());
    }
    if raw_json.len() > MAX_IMPORT_BYTES {
        return Err(format!(
            "The import file is larger than the {} MB safety limit.",
            MAX_IMPORT_BYTES / (1024 * 1024)
        ));
    }

    let envelope: PortableImportEnvelope = serde_json::from_str(raw_json)
        .map_err(|error| format!("The selected file is not a valid Skribli export: {error}"))?;
    if envelope.schema_version != PORTABLE_IMPORT_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported Skribli import schema {}. This build accepts schema {} only.",
            envelope.schema_version, PORTABLE_IMPORT_SCHEMA_VERSION
        ));
    }
    if envelope.note_count != envelope.notes.len() {
        return Err("The import note count does not match the file contents.".into());
    }
    if envelope.notes.len() > MAX_IMPORT_NOTES {
        return Err(format!(
            "The import contains more than the {MAX_IMPORT_NOTES} note safety limit."
        ));
    }

    let mut seen_ids = HashSet::with_capacity(envelope.notes.len());
    let mut notes = Vec::with_capacity(envelope.notes.len());
    for portable in envelope.notes {
        validate_portable_note(&portable)?;
        if !seen_ids.insert(portable.id.clone()) {
            return Err(format!(
                "The import contains the duplicate note ID '{}'. No notes were changed.",
                portable.id
            ));
        }
        notes.push(SkribNote::from(portable));
    }
    notes.sort_by(|left, right| left.id.cmp(&right.id));

    Ok(ParsedImport {
        fingerprint: import_fingerprint(raw_json.as_bytes()),
        schema_version: envelope.schema_version,
        source_scope: envelope.scope,
        notes,
    })
}

fn validate_portable_note(note: &PortableSkribNote) -> Result<(), String> {
    let id_length = note.id.chars().count();
    if id_length == 0
        || id_length > MAX_NOTE_ID_CHARACTERS
        || note
            .id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("The import contains an invalid note identifier.".into());
    }
    if note.target_process_name.chars().count() > MAX_PROCESS_NAME_CHARACTERS
        || note.target_process_name.chars().any(char::is_control)
    {
        return Err(format!(
            "Imported note '{}' has an invalid process name.",
            note.id
        ));
    }
    if note.target_title.chars().count() > MAX_CONTEXT_TITLE_CHARACTERS
        || note.target_title.chars().any(char::is_control)
    {
        return Err(format!(
            "Imported note '{}' has an invalid context title.",
            note.id
        ));
    }
    if note.text.chars().count() > MAX_NOTE_CHARACTERS {
        return Err(format!(
            "Imported note '{}' exceeds the {MAX_NOTE_CHARACTERS}-character text limit.",
            note.id
        ));
    }
    if !ALLOWED_NOTE_COLORS.contains(&note.color.as_str()) {
        return Err(format!(
            "Imported note '{}' uses an unsupported colour.",
            note.id
        ));
    }
    if ![note.rel_x, note.rel_y, note.width, note.height]
        .iter()
        .all(|value| value.is_finite())
        || note.rel_x.abs() > MAX_GEOMETRY_COORDINATE
        || note.rel_y.abs() > MAX_GEOMETRY_COORDINATE
        || note.width <= 0.0
        || note.height <= 0.0
        || note.width > MAX_GEOMETRY_DIMENSION
        || note.height > MAX_GEOMETRY_DIMENSION
    {
        return Err(format!(
            "Imported note '{}' contains unsafe geometry.",
            note.id
        ));
    }
    if note.deleted_at.is_some_and(|deleted_at| deleted_at == 0) {
        return Err(format!(
            "Imported note '{}' contains an invalid Trash timestamp.",
            note.id
        ));
    }
    Ok(())
}

fn build_import_plan(current: &[SkribNote], imported: &[SkribNote]) -> ImportPlan {
    let current_by_id: HashMap<&str, &SkribNote> = current
        .iter()
        .map(|note| (note.id.as_str(), note))
        .collect();
    let mut new_notes = Vec::new();
    let mut identical_count = 0;
    let mut conflicts = Vec::new();

    for imported_note in imported {
        match current_by_id.get(imported_note.id.as_str()) {
            None => new_notes.push(imported_note.clone()),
            Some(existing) if *existing == imported_note => identical_count += 1,
            Some(existing) => conflicts.push(((*existing).clone(), imported_note.clone())),
        }
    }
    new_notes.sort_by(|left, right| left.id.cmp(&right.id));
    conflicts.sort_by(|left, right| left.0.id.cmp(&right.0.id));

    ImportPlan {
        new_notes,
        identical_count,
        conflicts,
    }
}

fn build_preview(
    request_id: String,
    parsed: ParsedImport,
    plan: ImportPlan,
    current_revision: u64,
) -> ImportPreview {
    let (active_count, trash_count) = lifecycle_counts(&parsed.notes);
    let mut warnings = Vec::new();
    if parsed.source_scope == LibraryExportScope::Selected {
        warnings.push("This file is a selected-note export, not a complete backup.".into());
    }
    if plan.conflicts.len() > MAX_CONFLICT_DETAILS {
        warnings.push(format!(
            "Only the first {MAX_CONFLICT_DETAILS} conflict summaries are shown."
        ));
    }
    if parsed.notes.is_empty() {
        warnings.push("The import contains no notes.".into());
    }

    let conflict_details = plan
        .conflicts
        .iter()
        .take(MAX_CONFLICT_DETAILS)
        .map(|(existing, imported)| ImportConflictDetail {
            note_id: imported.id.clone(),
            existing_updated_at: existing.updated_at,
            imported_updated_at: imported.updated_at,
            existing_trashed: existing.deleted_at.is_some(),
            imported_trashed: imported.deleted_at.is_some(),
        })
        .collect();

    ImportPreview {
        request_id,
        fingerprint: parsed.fingerprint,
        schema_version: parsed.schema_version,
        source_scope: parsed.source_scope,
        total_count: parsed.notes.len(),
        active_count,
        trash_count,
        new_count: plan.new_notes.len(),
        identical_count: plan.identical_count,
        conflict_count: plan.conflicts.len(),
        conflict_details,
        current_revision,
        warnings,
    }
}

fn lifecycle_counts(notes: &[SkribNote]) -> (usize, usize) {
    let trash_count = notes
        .iter()
        .filter(|note| note.deleted_at.is_some())
        .count();
    (notes.len().saturating_sub(trash_count), trash_count)
}

fn import_fingerprint(bytes: &[u8]) -> String {
    format!("crc32:{:08x}:{}", crc32(bytes), bytes.len())
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

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str, text: &str, deleted_at: Option<u64>) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Project.txt - Notepad".into(),
            rel_x: 10.0,
            rel_y: 12.0,
            width: 400.0,
            height: 340.0,
            text: text.into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 100,
            updated_at: 200,
            deleted_at,
        }
    }

    fn export_json(notes: Vec<SkribNote>) -> String {
        serde_json::to_string(&serde_json::json!({
            "schemaVersion": 1,
            "exportedAtMs": 1234,
            "scope": "completeBackup",
            "noteCount": notes.len(),
            "notes": notes,
        }))
        .expect("serialize import fixture")
    }

    #[test]
    fn parses_active_and_trashed_notes_from_the_export_format() {
        let parsed = parse_import(&export_json(vec![
            note("active", "A", None),
            note("trash", "B", Some(300)),
        ]))
        .expect("valid export should parse");
        assert_eq!(lifecycle_counts(&parsed.notes), (1, 1));
        assert_eq!(parsed.schema_version, PORTABLE_IMPORT_SCHEMA_VERSION);
    }

    #[test]
    fn rejects_future_schema_duplicate_ids_and_unknown_fields() {
        let future = r#"{"schemaVersion":2,"exportedAtMs":1,"scope":"completeBackup","noteCount":0,"notes":[]}"#;
        assert!(parse_import(future)
            .expect_err("future schema must fail")
            .contains("Unsupported"));

        let duplicate = export_json(vec![note("same", "A", None), note("same", "A", None)]);
        assert!(parse_import(&duplicate)
            .expect_err("duplicate IDs must fail")
            .contains("duplicate note ID"));

        let unknown = r#"{"schemaVersion":1,"exportedAtMs":1,"scope":"completeBackup","noteCount":0,"notes":[],"extra":true}"#;
        assert!(parse_import(unknown).is_err());
    }

    #[test]
    fn rejects_unsafe_note_content_without_partial_results() {
        let invalid = export_json(vec![SkribNote {
            color: "transparent".into(),
            ..note("invalid", "A", None)
        }]);
        assert!(parse_import(&invalid)
            .expect_err("unsupported colour must fail")
            .contains("unsupported colour"));
    }

    #[test]
    fn planning_distinguishes_new_identical_and_conflicting_ids() {
        let existing = vec![note("same", "A", None), note("conflict", "old", None)];
        let imported = vec![
            note("new", "new", Some(500)),
            note("same", "A", None),
            note("conflict", "replacement", None),
        ];
        let plan = build_import_plan(&existing, &imported);
        assert_eq!(plan.new_notes.len(), 1);
        assert_eq!(plan.new_notes[0].id, "new");
        assert_eq!(plan.identical_count, 1);
        assert_eq!(plan.conflicts.len(), 1);
        assert_eq!(plan.conflicts[0].0.text, "old");
        assert_eq!(plan.conflicts[0].1.text, "replacement");
    }

    #[test]
    fn fingerprint_changes_when_the_exact_file_changes() {
        let first = import_fingerprint(b"one");
        let second = import_fingerprint(b"two");
        assert_ne!(first, second);
        assert_eq!(first, import_fingerprint(b"one"));
    }

    #[test]
    fn rollback_backup_is_read_back_and_rejects_tampering() {
        let directory = std::env::temp_dir().join(format!(
            "skribli-import-backup-verify-{}-{}",
            std::process::id(),
            current_time_millis()
        ));
        let mut expected = vec![
            note("active", "safe", None),
            note("trash", "recover", Some(500)),
        ];
        sort_notes_for_library(&mut expected);
        let path = write_library_export(
            &directory,
            LibraryExportScope::CompleteBackup,
            expected.clone(),
            1234,
        )
        .expect("write rollback fixture");
        verify_rollback_backup(&path, &expected).expect("valid backup should verify");

        std::fs::write(&path, b"{}\n").expect("tamper rollback fixture");
        assert!(verify_rollback_backup(&path, &expected)
            .expect_err("tampered backup must fail")
            .contains("did not verify"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn skip_mode_adds_new_records_and_preserves_existing_conflicts() {
        let current = vec![
            note("conflict", "local", None),
            note("unrelated", "keep", None),
        ];
        let imported = vec![
            note("conflict", "incoming", Some(400)),
            note("new", "add", None),
        ];
        let plan = build_import_plan(&current, &imported);
        let merged = merge_import_plan(&current, &plan, ImportConflictMode::Skip);
        let by_id: HashMap<_, _> = merged.iter().map(|note| (note.id.as_str(), note)).collect();
        assert_eq!(by_id["conflict"].text, "local");
        assert_eq!(by_id["conflict"].deleted_at, None);
        assert_eq!(by_id["new"].text, "add");
        assert_eq!(by_id["unrelated"].text, "keep");
    }

    #[test]
    fn replace_mode_changes_only_the_same_conflicting_ids() {
        let current = vec![
            note("conflict", "local", None),
            note("unrelated", "keep", None),
        ];
        let imported = vec![
            note("conflict", "incoming", Some(400)),
            note("new", "add", None),
        ];
        let plan = build_import_plan(&current, &imported);
        let merged = merge_import_plan(&current, &plan, ImportConflictMode::Replace);
        let by_id: HashMap<_, _> = merged.iter().map(|note| (note.id.as_str(), note)).collect();
        assert_eq!(by_id["conflict"].text, "incoming");
        assert_eq!(by_id["conflict"].deleted_at, Some(400));
        assert_eq!(by_id["new"].text, "add");
        assert_eq!(by_id["unrelated"].text, "keep");
    }

    #[test]
    fn revision_changes_require_a_new_preview() {
        assert!(validate_expected_revision(7, 7).is_ok());
        assert!(validate_expected_revision(8, 7)
            .expect_err("changed revision must fail")
            .contains("changed after preview"));
    }

    #[test]
    fn persisted_import_restores_the_complete_coordinator_on_save_failure() {
        use crate::core::coordinator::Coordinator;
        use crate::core::models::OverlayInitializationStatus;
        use crate::core::storage::StorageService;
        use std::sync::atomic::AtomicBool;
        use std::sync::{Arc, Mutex};

        let directory = std::env::temp_dir().join(format!(
            "skribli-import-rollback-{}-{}",
            std::process::id(),
            current_time_millis()
        ));
        std::fs::create_dir_all(&directory).expect("create rollback fixture directory");
        let blocked_parent = directory.join("blocked-parent");
        std::fs::write(&blocked_parent, b"not a directory").expect("create blocked parent file");

        let coordinator = Coordinator::new();
        let previous = vec![note("local", "safe", None)];
        coordinator.replace_all_skribs(previous.clone());
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) =
            crate::platform::windows_events::WinEventPipeline::new(
                crate::platform::windows_events::WIN_EVENT_QUEUE_CAPACITY,
            );
        let state = crate::AppState {
            coordinator: coordinator.clone(),
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(StorageService::new(blocked_parent.join("skribs.json"))),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
        };
        let merged = vec![
            note("local", "changed", None),
            note("new", "incoming", None),
        ];

        let error = persist_import_collection(&state, previous.clone(), merged)
            .expect_err("blocked storage must fail");
        assert!(error.contains("Local notes were restored"));
        assert_eq!(coordinator.get_all_skribs(), previous);
        assert!(state
            .storage_error
            .lock()
            .expect("storage error lock")
            .is_some());

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn persisted_import_saves_the_complete_merged_collection() {
        use crate::core::coordinator::Coordinator;
        use crate::core::models::OverlayInitializationStatus;
        use crate::core::storage::StorageService;
        use std::sync::atomic::AtomicBool;
        use std::sync::{Arc, Mutex};

        let directory = std::env::temp_dir().join(format!(
            "skribli-import-success-{}-{}",
            std::process::id(),
            current_time_millis()
        ));
        let primary = directory.join("skribs.json");
        let coordinator = Coordinator::new();
        let previous = vec![note("local", "safe", None)];
        coordinator.replace_all_skribs(previous.clone());
        #[cfg(target_os = "windows")]
        let (win_event_pipeline, _event_receiver) =
            crate::platform::windows_events::WinEventPipeline::new(
                crate::platform::windows_events::WIN_EVENT_QUEUE_CAPACITY,
            );
        let state = crate::AppState {
            coordinator: coordinator.clone(),
            running: Arc::new(AtomicBool::new(true)),
            init_status: Mutex::new(OverlayInitializationStatus::Initializing),
            mutation_lock: Mutex::new(()),
            storage: Mutex::new(StorageService::new(primary.clone())),
            storage_notice: Mutex::new(None),
            storage_error: Mutex::new(None),
            #[cfg(target_os = "windows")]
            win_event_pipeline,
        };
        let mut merged = vec![
            note("local", "safe", None),
            note("trash", "incoming", Some(500)),
        ];
        sort_notes_for_library(&mut merged);

        let revision = persist_import_collection(&state, previous, merged.clone())
            .expect("import persistence should succeed");
        assert_eq!(revision, 1);
        assert_eq!(coordinator.get_all_skribs().len(), 2);
        let mut reopened = StorageService::new(primary);
        assert_eq!(
            reopened.load().expect("reload imported collection").skribs,
            merged
        );

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn preview_is_deterministic_and_bounds_conflict_details() {
        let current: Vec<SkribNote> = (0..60)
            .map(|index| note(&format!("note-{index:02}"), "existing", None))
            .collect();
        let imported: Vec<SkribNote> = (0..60)
            .map(|index| note(&format!("note-{index:02}"), "imported", Some(300)))
            .collect();
        let parsed = ParsedImport {
            fingerprint: "fingerprint".into(),
            schema_version: 1,
            source_scope: LibraryExportScope::CompleteBackup,
            notes: imported,
        };
        let preview = build_preview(
            "request".into(),
            parsed,
            build_import_plan(
                &current,
                &current
                    .iter()
                    .map(|note| SkribNote {
                        text: "imported".into(),
                        deleted_at: Some(300),
                        ..note.clone()
                    })
                    .collect::<Vec<_>>(),
            ),
            4,
        );
        assert_eq!(preview.conflict_count, 60);
        assert_eq!(preview.conflict_details.len(), MAX_CONFLICT_DETAILS);
        assert!(!preview.warnings.is_empty());
    }
}
