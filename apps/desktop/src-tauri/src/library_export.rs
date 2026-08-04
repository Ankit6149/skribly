use crate::core::models::SkribNote;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const LIBRARY_EXPORT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LibraryExportScope {
    Selected,
    CompleteBackup,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LibraryExportEnvelope {
    pub schema_version: u32,
    pub exported_at_ms: u64,
    pub scope: LibraryExportScope,
    pub note_count: usize,
    pub notes: Vec<SkribNote>,
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
        return Ok((LibraryExportScope::CompleteBackup, all_notes));
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
        return Err("One or more selected notes are no longer available. Refresh All Skribs and try again.".into());
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
        note_count: notes.len(),
        notes,
    };
    let prefix = match scope {
        LibraryExportScope::Selected => "skribli-notes",
        LibraryExportScope::CompleteBackup => "skribli-backup",
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
            return Err(format!("Failed to make the Skribli export durable: {error}"));
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
    fn complete_backup_is_sorted_deterministically() {
        let (_, notes) = select_notes_for_export(
            vec![note("z", 2, 5), note("newest", 1, 10), note("a", 2, 5)],
            None,
        )
        .expect("complete backup selection should succeed");

        assert_eq!(
            notes.into_iter().map(|note| note.id).collect::<Vec<_>>(),
            vec!["newest", "a", "z"]
        );
    }

    #[test]
    fn selected_export_deduplicates_ids_and_rejects_missing_notes() {
        let all = vec![note("a", 1, 1), note("b", 2, 2)];
        let (_, selected) = select_notes_for_export(
            all.clone(),
            Some(vec!["b".into(), "b".into(), "a".into()]),
        )
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
        assert_eq!(decoded.note_count, 1);
        assert_eq!(decoded.notes[0].id, "a");

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repeated_timestamp_never_overwrites_an_existing_export() {
        let directory = temporary_directory("create-new");
        let first = write_library_export(
            &directory,
            LibraryExportScope::CompleteBackup,
            vec![note("a", 1, 1)],
            5000,
        )
        .expect("first export should succeed");
        let second = write_library_export(
            &directory,
            LibraryExportScope::CompleteBackup,
            vec![note("b", 2, 2)],
            5000,
        )
        .expect("second export should use a new path");

        assert_ne!(first, second);
        assert!(first.exists());
        assert!(second.exists());

        let _ = fs::remove_dir_all(directory);
    }
}
