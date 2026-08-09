use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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
    }
}

use core::storage::StorageService;

#[derive(Clone, Serialize)]
struct SchemaV2Note {
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
}

#[derive(Serialize)]
struct SchemaV2Integrity<'a> {
    schema_version: u32,
    revision: u64,
    written_at_ms: u64,
    skribs: &'a [SchemaV2Note],
}

#[derive(Serialize)]
struct SchemaV2Envelope<'a> {
    schema_version: u32,
    revision: u64,
    written_at_ms: u64,
    integrity: String,
    skribs: &'a [SchemaV2Note],
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

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn temporary_directory(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "skribli-schema-v2-{name}-{}-{}",
        std::process::id(),
        now_millis()
    ))
}

fn write_schema_v2_database(path: &Path, notes: &[SchemaV2Note]) {
    let revision = 17;
    let written_at_ms = 1_725_000_000_123;
    let integrity_payload = SchemaV2Integrity {
        schema_version: 2,
        revision,
        written_at_ms,
        skribs: notes,
    };
    let integrity_bytes =
        serde_json::to_vec(&integrity_payload).expect("serialize schema-v2 integrity input");
    let envelope = SchemaV2Envelope {
        schema_version: 2,
        revision,
        written_at_ms,
        integrity: format!("crc32:{:08x}", crc32(&integrity_bytes)),
        skribs: notes,
    };

    fs::write(
        path,
        serde_json::to_vec_pretty(&envelope).expect("serialize schema-v2 envelope"),
    )
    .expect("write schema-v2 database");
}

#[test]
fn authentic_schema_v2_database_migrates_to_active_schema_v3_records() {
    let directory = temporary_directory("migration");
    fs::create_dir_all(&directory).expect("create migration fixture directory");
    let primary = directory.join("skribs.json");
    let legacy_notes = vec![
        SchemaV2Note {
            id: "legacy-alpha".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Alpha.txt - Notepad".into(),
            rel_x: 22.5,
            rel_y: 31.25,
            width: 420.0,
            height: 360.0,
            text: "Keep every original field".into(),
            color: "mint".into(),
            collapsed: true,
            created_at: 100,
            updated_at: 200,
        },
        SchemaV2Note {
            id: "legacy-beta".into(),
            target_process_name: "chrome.exe".into(),
            target_title: "Client portal".into(),
            rel_x: 1.0,
            rel_y: 2.0,
            width: 300.0,
            height: 240.0,
            text: "Second note".into(),
            color: "peach".into(),
            collapsed: false,
            created_at: 300,
            updated_at: 400,
        },
    ];
    write_schema_v2_database(&primary, &legacy_notes);

    let mut storage = StorageService::new(primary.clone());
    let loaded = storage
        .load()
        .expect("an authentic schema-v2 database should migrate");

    assert_eq!(loaded.revision, 17);
    assert_eq!(loaded.skribs.len(), 2);
    assert_eq!(loaded.skribs[0].id, legacy_notes[0].id);
    assert_eq!(
        loaded.skribs[0].target_process_name,
        legacy_notes[0].target_process_name
    );
    assert_eq!(loaded.skribs[0].target_title, legacy_notes[0].target_title);
    assert_eq!(loaded.skribs[0].rel_x, legacy_notes[0].rel_x);
    assert_eq!(loaded.skribs[0].rel_y, legacy_notes[0].rel_y);
    assert_eq!(loaded.skribs[0].width, legacy_notes[0].width);
    assert_eq!(loaded.skribs[0].height, legacy_notes[0].height);
    assert_eq!(loaded.skribs[0].text, legacy_notes[0].text);
    assert_eq!(loaded.skribs[0].color, legacy_notes[0].color);
    assert_eq!(loaded.skribs[0].collapsed, legacy_notes[0].collapsed);
    assert_eq!(loaded.skribs[0].created_at, legacy_notes[0].created_at);
    assert_eq!(loaded.skribs[0].updated_at, legacy_notes[0].updated_at);
    assert_eq!(loaded.skribs[0].deleted_at, None);
    assert_eq!(loaded.skribs[1].id, legacy_notes[1].id);
    assert_eq!(loaded.skribs[1].deleted_at, None);
    assert_eq!(
        loaded
            .notice
            .as_ref()
            .and_then(|notice| notice.migrated_from_schema),
        Some(2)
    );

    let upgraded: Value =
        serde_json::from_slice(&fs::read(&primary).expect("read upgraded primary"))
            .expect("decode upgraded primary");
    assert_eq!(
        upgraded.get("schema_version").and_then(Value::as_u64),
        Some(3)
    );
    assert!(upgraded["skribs"]
        .as_array()
        .expect("upgraded notes array")
        .iter()
        .all(|note| note.get("deleted_at").is_none()));

    let mut reopened = StorageService::new(primary);
    let reloaded = reopened.load().expect("schema-v3 primary should reopen");
    assert_eq!(reloaded.skribs, loaded.skribs);

    let _ = fs::remove_dir_all(directory);
}
