use crate::core::models::SkribNote;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;

const STORAGE_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct StoredSkribs {
    version: u32,
    skribs: Vec<SkribNote>,
}

pub fn load(path: &Path) -> Result<Vec<SkribNote>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = fs::read(path).map_err(|error| format!("Failed to read local Skribs: {error}"))?;
    let stored: StoredSkribs = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Local Skrib data is damaged: {error}"))?;
    if stored.version != STORAGE_VERSION {
        return Err(format!(
            "Unsupported local Skrib data version {}",
            stored.version
        ));
    }
    Ok(stored.skribs)
}

pub fn save(path: &Path, skribs: &[SkribNote]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Local Skrib data path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create local data directory: {error}"))?;

    let payload = serde_json::to_vec_pretty(&StoredSkribs {
        version: STORAGE_VERSION,
        skribs: skribs.to_vec(),
    })
    .map_err(|error| format!("Failed to encode local Skribs: {error}"))?;

    let temp_path = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temp_path)
        .map_err(|error| format!("Failed to open temporary Skrib data: {error}"))?;
    file.write_all(&payload)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Failed to safely write local Skribs: {error}"))?;

    if path.exists() {
        let backup_path = path.with_extension("json.bak");
        let _ = fs::copy(path, backup_path);
        fs::remove_file(path)
            .map_err(|error| format!("Failed to replace local Skrib data: {error}"))?;
    }
    fs::rename(&temp_path, path)
        .map_err(|error| format!("Failed to commit local Skrib data: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str) -> SkribNote {
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Notes - Notepad".into(),
            rel_x: 10.0,
            rel_y: 20.0,
            width: 300.0,
            height: 220.0,
            text: "Persistent".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1,
            updated_at: 2,
        }
    }

    #[test]
    fn round_trips_versioned_storage() {
        let dir = std::env::temp_dir().join(format!("skribly-storage-{}", std::process::id()));
        let path = dir.join("skribs.json");
        let _ = fs::remove_dir_all(&dir);
        save(&path, &[note("a")]).expect("save should succeed");
        assert_eq!(load(&path).expect("load should succeed"), vec![note("a")]);
        let _ = fs::remove_dir_all(dir);
    }
}
