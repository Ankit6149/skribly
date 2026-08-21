use crate::core::models::SkribNote;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{App, AppHandle, Emitter, Listener, Manager, Runtime, WindowEvent};

pub const LIBRARY_WINDOW_LABEL: &str = "library";
pub const LIBRARY_EXPORT_REQUEST_EVENT: &str = "skribly://library-export-request";
pub const LIBRARY_EXPORT_RESULT_EVENT: &str = "skribly://library-export-result";
pub const LIBRARY_EXPORT_SCHEMA_VERSION: u32 = 2;
const MAX_EXPORT_REQUEST_ID_CHARACTERS: usize = 128;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LibraryExportScope {
    #[serde(rename = "selected")]
    Selected,
    #[serde(rename = "allRecords", alias = "completeBackup")]
    AllRecords,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryExportContentCoverage {
    pub note_records: bool,
    pub drawings: bool,
    pub attachments: bool,
    pub reminders: bool,
}

impl Default for LibraryExportContentCoverage {
    fn default() -> Self {
        Self {
            note_records: true,
            drawings: false,
            attachments: false,
            reminders: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LibraryExportEnvelope {
    pub schema_version: u32,
    pub exported_at_ms: u64,
    pub scope: LibraryExportScope,
    pub content_coverage: LibraryExportContentCoverage,
    pub note_count: usize,
    pub notes: Vec<SkribNote>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LibraryExportRequest {
    request_id: String,
    note_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LibraryExportResult {
    request_id: String,
    path: Option<String>,
    error: Option<String>,
}

pub fn install_library_bridge<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(LIBRARY_WINDOW_LABEL) {
        let window_to_hide = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window_to_hide.hide();
            }
        });
    }

    let app_handle = app.handle().clone();
    app.listen(LIBRARY_EXPORT_REQUEST_EVENT, move |event| {
        let raw_payload = event.payload();
        let result = match serde_json::from_str::<LibraryExportRequest>(raw_payload) {
            Ok(request) => perform_export(&app_handle, request),
            Err(_) => LibraryExportResult {
                request_id: String::new(),
                path: None,
                error: Some("Skribli rejected an invalid export request.".into()),
            },
        };
        let _ = app_handle.emit_to(LIBRARY_WINDOW_LABEL, LIBRARY_EXPORT_RESULT_EVENT, result);
    });

    Ok(())
}

fn perform_export<R: Runtime>(
    app_handle: &AppHandle<R>,
    request: LibraryExportRequest,
) -> LibraryExportResult {
    if let Err(error) = validate_export_request(&request) {
        return LibraryExportResult {
            request_id: request.request_id,
            path: None,
            error: Some(error),
        };
    }

    let request_id = request.request_id;
    let outcome = (|| {
        let state = app_handle.state::<crate::AppState>();
        let all_notes = state.coordinator.get_all_skribs();
        let (scope, notes) = select_notes_for_export(all_notes, request.note_ids)?;
        let export_directory = app_handle
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to locate the Skribli data folder: {error}"))?
            .join("exports");
        let output = write_library_export(&export_directory, scope, notes, current_time_millis())?;
        Ok::<String, String>(output.to_string_lossy().into_owned())
    })();

    match outcome {
        Ok(path) => LibraryExportResult {
            request_id,
            path: Some(path),
            error: None,
        },
        Err(error) => LibraryExportResult {
            request_id,
            path: None,
            error: Some(error),
        },
    }
}

fn validate_export_request(request: &LibraryExportRequest) -> Result<(), String> {
    let request_id_length = request.request_id.chars().count();
    if request_id_length == 0
        || request_id_length > MAX_EXPORT_REQUEST_ID_CHARACTERS
        || request
            .request_id
            .chars()
            .any(|character| character.is_control())
    {
        return Err("Skribli rejected an invalid export request identifier.".into());
    }

    if request
        .note_ids
        .as_ref()
        .is_some_and(|ids| ids.len() > 10_000)
    {
        return Err("The export selection is too large to process safely.".into());
    }

    Ok(())
}

pub fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}

pub fn sort_notes_for_library(notes: &mut [SkribNote]) {
    notes.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
}

pub fn select_notes_for_export(
    mut all_notes: Vec<SkribNote>,
    note_ids: Option<Vec<String>>,
) -> Result<(LibraryExportScope, Vec<SkribNote>), String> {
    sort_notes_for_library(&mut all_notes);

    let Some(note_ids) = note_ids else {
        return Ok((LibraryExportScope::AllRecords, all_notes));
    };

    let requested: HashSet<String> = note_ids
        .into_iter()
        .filter(|id| !id.trim().is_empty())
        .collect();
    if requested.is_empty() {
        return Err("Select at least one note to export.".into());
    }

    let by_id: HashMap<String, SkribNote> = all_notes
        .into_iter()
        .map(|note| (note.id.clone(), note))
        .collect();

    let mut missing: Vec<String> = requested
        .iter()
        .filter(|id| !by_id.contains_key(*id))
        .cloned()
        .collect();
    missing.sort();
    if !missing.is_empty() {
        return Err(
            "One or more selected notes are no longer available. Refresh All Skribs and try again."
                .into(),
        );
    }

    let mut selected: Vec<SkribNote> = requested
        .into_iter()
        .filter_map(|id| by_id.get(&id).cloned())
        .collect();
    sort_notes_for_library(&mut selected);
    Ok((LibraryExportScope::Selected, selected))
}

pub fn write_library_export(
    export_directory: &Path,
    scope: LibraryExportScope,
    notes: Vec<SkribNote>,
    exported_at_ms: u64,
) -> Result<PathBuf, String> {
    fs::create_dir_all(export_directory)
        .map_err(|error| format!("Failed to create the Skribli export folder: {error}"))?;

    let envelope = LibraryExportEnvelope {
        schema_version: LIBRARY_EXPORT_SCHEMA_VERSION,
        exported_at_ms,
        scope: scope.clone(),
        content_coverage: LibraryExportContentCoverage::default(),
        note_count: notes.len(),
        notes,
    };
    let prefix = match scope {
        LibraryExportScope::Selected => "skribli-notes",
        LibraryExportScope::AllRecords => "skribli-note-records",
    };

    for suffix in 0..1_000_u16 {
        let filename = if suffix == 0 {
            format!("{prefix}-{exported_at_ms}.json")
        } else {
            format!("{prefix}-{exported_at_ms}-{suffix}.json")
        };
        let output_path = export_directory.join(filename);
        let file = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output_path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!("Failed to create the Skribli export file: {error}"));
            }
        };

        let mut writer = BufWriter::new(file);
        if let Err(error) = serde_json::to_writer_pretty(&mut writer, &envelope) {
            let _ = fs::remove_file(&output_path);
            return Err(format!("Failed to serialize the Skribli export: {error}"));
        }
        if let Err(error) = writer.write_all(b"\n") {
            let _ = fs::remove_file(&output_path);
            return Err(format!("Failed to finish the Skribli export: {error}"));
        }
        if let Err(error) = writer.flush() {
            let _ = fs::remove_file(&output_path);
            return Err(format!("Failed to flush the Skribli export: {error}"));
        }
        let file = writer
            .into_inner()
            .map_err(|error| format!("Failed to finalize the Skribli export: {error}"))?;
        if let Err(error) = file.sync_all() {
            let _ = fs::remove_file(&output_path);
            return Err(format!(
                "Failed to make the Skribli export durable: {error}"
            ));
        }

        return Ok(output_path);
    }

    Err("Skribli could not create a unique export filename. Try again in a moment.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str, created_at: u64, updated_at: u64) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Project brief — Notepad".into(),
            rel_x: 0.0,
            rel_y: 0.0,
            width: 400.0,
            height: 340.0,
            text: format!("Text for {id}"),
            color: "yellow".into(),
            collapsed: false,
            created_at,
            updated_at,
            deleted_at: None,
        }
    }

    fn temporary_directory(test_name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "skribli-library-export-{test_name}-{}-{}",
            std::process::id(),
            current_time_millis()
        ))
    }

    #[test]
    fn export_request_rejects_empty_or_oversized_identifiers() {
        assert!(validate_export_request(&LibraryExportRequest {
            request_id: String::new(),
            note_ids: None,
        })
        .is_err());
        assert!(validate_export_request(&LibraryExportRequest {
            request_id: "x".repeat(MAX_EXPORT_REQUEST_ID_CHARACTERS + 1),
            note_ids: None,
        })
        .is_err());
    }

    #[test]
    fn all_record_export_is_sorted_deterministically() {
        let (_, notes) = select_notes_for_export(
            vec![note("z", 2, 5), note("newest", 1, 10), note("a", 2, 5)],
            None,
        )
        .expect("all-record selection should succeed");

        assert_eq!(
            notes.into_iter().map(|note| note.id).collect::<Vec<_>>(),
            vec!["newest", "a", "z"]
        );
    }

    #[test]
    fn selected_export_deduplicates_ids_and_rejects_missing_notes() {
        let all = vec![note("a", 1, 1), note("b", 2, 2)];
        let (_, selected) =
            select_notes_for_export(all.clone(), Some(vec!["b".into(), "b".into(), "a".into()]))
                .expect("known selected notes should export");
        assert_eq!(selected.len(), 2);
        assert_eq!(selected[0].id, "b");

        let error = select_notes_for_export(all, Some(vec!["missing".into()]))
            .expect_err("missing notes must fail closed");
        assert!(error.contains("no longer available"));
    }

    #[test]
    fn export_round_trips_versioned_json() {
        let directory = temporary_directory("round-trip");
        let path = write_library_export(
            &directory,
            LibraryExportScope::Selected,
            vec![note("a", 1, 2)],
            1234,
        )
        .expect("export should be written");

        let content = fs::read_to_string(&path).expect("read export");
        let decoded: LibraryExportEnvelope =
            serde_json::from_str(&content).expect("decode export envelope");
        assert_eq!(decoded.schema_version, LIBRARY_EXPORT_SCHEMA_VERSION);
        assert_eq!(decoded.scope, LibraryExportScope::Selected);
        assert_eq!(
            decoded.content_coverage,
            LibraryExportContentCoverage::default()
        );
        assert_eq!(decoded.note_count, 1);
        assert_eq!(decoded.notes[0].id, "a");

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repeated_timestamp_never_overwrites_an_existing_export() {
        let directory = temporary_directory("create-new");
        let first = write_library_export(
            &directory,
            LibraryExportScope::AllRecords,
            vec![note("a", 1, 1)],
            5000,
        )
        .expect("first export should succeed");
        let second = write_library_export(
            &directory,
            LibraryExportScope::AllRecords,
            vec![note("b", 2, 2)],
            5000,
        )
        .expect("second export should use a new path");

        assert_ne!(first, second);
        assert!(first.exists());
        assert!(second.exists());
        assert!(first
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("skribli-note-records-")));
        let serialized = fs::read_to_string(&first).expect("read all-record export");
        assert!(serialized.contains(r#""scope": "allRecords""#));
        assert!(serialized.contains(r#""drawings": false"#));
        assert!(serialized.contains(r#""attachments": false"#));
        assert!(serialized.contains(r#""reminders": false"#));

        let _ = fs::remove_dir_all(directory);
    }
}
