//! Small, versioned device preferences. This file never rewrites note records.
use crate::core::models::{SkribNote, TargetWindowInfo};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;

static PREFERENCE_IO: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NotePreferences {
    pub version: u32,
    pub multiple_notes_per_context: bool,
}

impl Default for NotePreferences {
    fn default() -> Self {
        Self {
            version: 1,
            multiple_notes_per_context: false,
        }
    }
}

fn read_unlocked(path: &Path) -> Result<NotePreferences, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(NotePreferences::default())
        }
        Err(_) => {
            return Err(
                "Skribli could not read your note preferences. Your notes are unchanged.".into(),
            )
        }
    };
    let value: NotePreferences = serde_json::from_slice(&bytes).map_err(|_| {
        "Your note preferences could not be read. The existing file has been preserved.".to_string()
    })?;
    if value.version != 1 {
        return Err(
            "These preferences belong to a newer Skribli version. They have not been changed."
                .into(),
        );
    }
    Ok(value)
}

pub fn load(path: &Path) -> Result<NotePreferences, String> {
    let _guard = PREFERENCE_IO
        .lock()
        .map_err(|_| "Note preferences are busy. Try again.")?;
    read_unlocked(path)
}

pub fn save(path: &Path, multiple_notes_per_context: bool) -> Result<NotePreferences, String> {
    let _guard = PREFERENCE_IO
        .lock()
        .map_err(|_| "Note preferences are busy. Try again.")?;
    // Refuse to overwrite damaged or future-version preferences.
    read_unlocked(path)?;
    let value = NotePreferences {
        multiple_notes_per_context,
        ..NotePreferences::default()
    };
    let bytes =
        serde_json::to_vec_pretty(&value).map_err(|_| "Could not prepare note preferences.")?;
    let parent = path
        .parent()
        .ok_or("Note preference storage is unavailable.")?;
    fs::create_dir_all(parent).map_err(|_| "Could not prepare note preference storage.")?;
    let temporary = path.with_extension("json.tmp");
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temporary)
        .map_err(|_| "Could not save your preference. Your previous choice is unchanged.")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Could not save your preference. Your previous choice is unchanged.")?;
    drop(file);
    replace(&temporary, path)?;
    Ok(value)
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
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(destination.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|_| {
        "Could not finish saving your preference. Your previous choice is unchanged.".into()
    })
}

#[cfg(not(target_os = "windows"))]
fn replace(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|_| {
        "Could not finish saving your preference. Your previous choice is unchanged.".into()
    })
}

pub fn is_browser(process_name: &str) -> bool {
    matches!(
        process_name.to_ascii_lowercase().as_str(),
        "chrome.exe"
            | "msedge.exe"
            | "firefox.exe"
            | "brave.exe"
            | "opera.exe"
            | "vivaldi.exe"
            | "arc.exe"
    )
}

/// App-level grouping for native apps; exact title fallback for browsers until URL metadata exists.
/// A title is never parsed as a URL, and matching titles are not claimed to be stable tab identity.
pub fn note_belongs_to_context(note: &SkribNote, target: &TargetWindowInfo) -> bool {
    if !note
        .target_process_name
        .eq_ignore_ascii_case(&target.process_name)
    {
        return false;
    }
    !is_browser(&target.process_name)
        || (!target.title.trim().is_empty()
            && note
                .target_title
                .trim()
                .eq_ignore_ascii_case(target.title.trim()))
}

/// Keep a stable primary note. Toggling the preference never deletes or merges existing notes.
pub fn primary_shortcut_note(
    notes: &[SkribNote],
    target: &TargetWindowInfo,
    preferences: &NotePreferences,
) -> Option<SkribNote> {
    if preferences.multiple_notes_per_context {
        return None;
    }
    notes
        .iter()
        .filter(|note| note.is_active() && note_belongs_to_context(note, target))
        .min_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.id.cmp(&right.id))
        })
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn note(id: &str, created_at: u64) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "old document".into(),
            rel_x: 0.0,
            rel_y: 0.0,
            width: 420.0,
            height: 360.0,
            text: "kept".into(),
            color: "mint".into(),
            collapsed: true,
            created_at,
            updated_at: created_at,
            archived_at: None,
            deleted_at: None,
        }
    }
    fn target(process: &str, title: &str) -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_val: 1,
            title: title.into(),
            process_name: process.into(),
            class_name: "test".into(),
            bounds: crate::core::models::WindowRect {
                x: 0,
                y: 0,
                width: 1000,
                height: 800,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        }
    }
    #[test]
    fn stable_primary_preserves_existing_multiple_notes() {
        let notes = vec![note("b", 2), note("a", 1)];
        let before = notes.clone();
        assert_eq!(
            primary_shortcut_note(
                &notes,
                &target("NOTEPAD.EXE", "new document"),
                &NotePreferences::default()
            )
            .unwrap()
            .id,
            "a"
        );
        assert_eq!(notes, before);
        assert!(primary_shortcut_note(
            &notes,
            &target("notepad.exe", "new"),
            &NotePreferences {
                multiple_notes_per_context: true,
                ..NotePreferences::default()
            }
        )
        .is_none());
    }
    #[test]
    fn archive_trash_and_other_apps_are_never_primary() {
        let mut archived = note("archive", 1);
        archived.archived_at = Some(3);
        let mut trashed = note("trash", 1);
        trashed.deleted_at = Some(3);
        let mut other = note("other", 1);
        other.target_process_name = "other.exe".into();
        assert!(primary_shortcut_note(
            &[archived, trashed, other],
            &target("notepad.exe", "new"),
            &NotePreferences::default()
        )
        .is_none());
    }
    #[test]
    fn browser_titles_do_not_imply_site_or_substring_identity() {
        let mut saved = note("browser", 1);
        saved.target_process_name = "chrome.exe".into();
        saved.target_title = "Example - Google Chrome".into();
        assert!(note_belongs_to_context(
            &saved,
            &target("chrome.exe", "Example - Google Chrome")
        ));
        assert!(!note_belongs_to_context(
            &saved,
            &target("chrome.exe", "Other Example - Google Chrome")
        ));
        assert!(!note_belongs_to_context(&saved, &target("chrome.exe", "")));
    }
    #[test]
    fn preferences_round_trip_and_refuse_corrupt_or_future_versions() {
        let folder = std::env::temp_dir().join(format!(
            "skribli-preferences-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("preferences.json");
        assert_eq!(load(&path).unwrap(), NotePreferences::default());
        save(&path, true).unwrap();
        assert!(load(&path).unwrap().multiple_notes_per_context);
        save(&path, false).unwrap();
        assert!(!load(&path).unwrap().multiple_notes_per_context);
        for invalid in ["broken", r#"{"version":2,"multipleNotesPerContext":true}"#] {
            fs::write(&path, invalid).unwrap();
            assert!(save(&path, false).is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), invalid);
        }
        fs::remove_file(path).unwrap();
        fs::remove_dir(folder).unwrap();
    }
}
