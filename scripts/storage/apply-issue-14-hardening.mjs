import { readFile, writeFile } from 'node:fs/promises';

const join = (lines) => lines.join('\n');

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

async function edit(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: no changes produced`);
  await writeFile(path, after, 'utf8');
}

await edit('apps/desktop/src-tauri/src/core/storage.rs', (source) => {
  source = replaceExact(
    source,
    join([
      '        let mut quarantined_files = Vec::new();',
      '        let mut invalid_details = Vec::new();',
      '        for (index, candidate) in invalid.into_iter().enumerate() {',
      '            invalid_details.push(candidate.error.to_string());',
      '            match quarantine_file(&candidate.path, candidate.source, index) {',
      '                Ok(path) => quarantined_files.push(file_name_for_display(&path)),',
      '                Err(error) if candidate.source == StorageSource::Primary => {',
      '                    let reason = format!(',
      '                        "The damaged primary file could not be quarantined safely: {error}"',
      '                    );',
      '                    self.blocked_reason = Some(reason.clone());',
      '                    return Err(StorageError::WriteBlocked { reason });',
      '                }',
      '                Err(error) => invalid_details.push(error.to_string()),',
      '            }',
      '        }',
      '',
      '        if valid.is_empty() {',
      '            let details = if invalid_details.is_empty() {',
      '                "No valid primary, temporary, or backup generation was found".to_string()',
      '            } else {',
      '                invalid_details.join("; ")',
      '            };',
      '            self.blocked_reason = Some(details.clone());',
      '            return Err(StorageError::NoRecoverableData { details });',
      '        }',
    ]),
    join([
      '        let mut invalid_details = invalid',
      '            .iter()',
      '            .map(|candidate| candidate.error.to_string())',
      '            .collect::<Vec<_>>();',
      '',
      '        if valid.is_empty() {',
      '            let details = if invalid_details.is_empty() {',
      '                "No valid primary, temporary, or backup generation was found".to_string()',
      '            } else {',
      '                format!(',
      '                    "{}. Damaged files were preserved in place for recovery.",',
      '                    invalid_details.join("; ")',
      '                )',
      '            };',
      '            self.blocked_reason = Some(details.clone());',
      '            return Err(StorageError::NoRecoverableData { details });',
      '        }',
      '',
      '        let mut quarantined_files = Vec::new();',
      '        for (index, candidate) in invalid.into_iter().enumerate() {',
      '            match quarantine_file(&candidate.path, candidate.source, index) {',
      '                Ok(path) => quarantined_files.push(file_name_for_display(&path)),',
      '                Err(error) if candidate.source == StorageSource::Primary => {',
      '                    let reason = format!(',
      '                        "The damaged primary file could not be quarantined safely: {error}"',
      '                    );',
      '                    self.blocked_reason = Some(reason.clone());',
      '                    return Err(StorageError::WriteBlocked { reason });',
      '                }',
      '                Err(error) => invalid_details.push(error.to_string()),',
      '            }',
      '        }',
    ]),
    'preserve corrupt-only database across restarts',
  );

  source = replaceExact(
    source,
    join([
      '        if backup1.exists() {',
      '            let stage2 = sibling_path(&self.primary_path, ".bak.2.stage");',
      '            copy_verified_generation(&backup1, &stage2, StorageSource::Backup1)?;',
      '            atomic_replace(&stage2, &backup2)?;',
      '        }',
    ]),
    join([
      '        if backup1.exists() {',
      '            match decode_candidate(&backup1, StorageSource::Backup1) {',
      '                Ok(_) => {',
      '                    let stage2 = sibling_path(&self.primary_path, ".bak.2.stage");',
      '                    copy_verified_generation(&backup1, &stage2, StorageSource::Backup1)?;',
      '                    atomic_replace(&stage2, &backup2)?;',
      '                }',
      '                Err(error @ StorageError::UnsupportedSchema { .. }) => return Err(error),',
      '                Err(_) => {',
      '                    quarantine_file(&backup1, StorageSource::Backup1, 0)?;',
      '                }',
      '            }',
      '        }',
    ]),
    'quarantine damaged rolling backup without blocking a valid primary save',
  );

  source = replaceExact(
    source,
    join([
      '        assert!(matches!(error, StorageError::NoRecoverableData { .. }));',
      '        assert!(!storage.is_writable());',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn unsupported_schema_is_preserved_and_blocks_writes() {',
    ]),
    join([
      '        assert!(matches!(error, StorageError::NoRecoverableData { .. }));',
      '        assert!(!storage.is_writable());',
      '        assert!(path.exists());',
      '',
      '        let mut reopened = StorageService::new(path.clone());',
      '        let second_error = reopened',
      '            .load()',
      '            .expect_err("a second launch must not convert corruption into an empty store");',
      '        assert!(matches!(',
      '            second_error,',
      '            StorageError::NoRecoverableData { .. }',
      '        ));',
      '        assert!(!reopened.is_writable());',
      '        assert!(path.exists());',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn damaged_old_backup_is_quarantined_without_blocking_a_new_save() {',
      '        let path = test_path("damaged-backup");',
      '        let mut storage = StorageService::new(path.clone());',
      '        storage.load().expect("empty load");',
      '        storage.save(&[note("one", "One")]).expect("save one");',
      '        storage.save(&[note("two", "Two")]).expect("save two");',
      '        write_bytes_synced(&storage.backup1_path(), b"damaged")',
      '            .expect("damage backup fixture");',
      '',
      '        storage',
      '            .save(&[note("three", "Three")])',
      '            .expect("valid primary should still be saved");',
      '',
      '        let backup1 = decode_candidate(&storage.backup1_path(), StorageSource::Backup1)',
      '            .expect("latest known-good primary should replace the damaged backup");',
      '        assert_eq!(backup1.skribs, vec![note("two", "Two")]);',
      '        let quarantine_count = fs::read_dir(path.parent().expect("parent"))',
      '            .expect("read data directory")',
      '            .filter_map(Result::ok)',
      '            .filter(|entry| entry.file_name().to_string_lossy().contains(".bak.1.corrupt."))',
      '            .count();',
      '        assert_eq!(quarantine_count, 1);',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn unsupported_schema_is_preserved_and_blocks_writes() {',
    ]),
    'storage restart and damaged-backup regression tests',
  );

  return source;
});

await edit('apps/desktop/src-tauri/src/lib.rs', (source) => {
  source = replaceExact(
    source,
    join([
      '    pub init_status: Mutex<OverlayInitializationStatus>,',
      '    pub storage: Mutex<storage::StorageService>,',
    ]),
    join([
      '    pub init_status: Mutex<OverlayInitializationStatus>,',
      '    pub mutation_lock: Mutex<()>,',
      '    pub storage: Mutex<storage::StorageService>,',
    ]),
    'add native mutation serialization lock',
  );

  source = replaceExact(
    source,
    join([
      'fn persist_or_restore(state: &AppState, previous: Vec<SkribNote>) -> Result<(), String> {',
      '    if let Err(message) = persist_skribs(state) {',
      '        state.coordinator.replace_all_skribs(previous);',
      '        return Err(message);',
      '    }',
      '    Ok(())',
      '}',
    ]),
    join([
      'fn run_persisted_mutation<T>(',
      '    state: &AppState,',
      '    mutation: impl FnOnce(&Coordinator) -> Result<T, String>,',
      ') -> Result<T, String> {',
      '    let _mutation_guard = state',
      '        .mutation_lock',
      '        .lock()',
      '        .map_err(|_| "Local note mutation lock is unavailable".to_string())?;',
      '    let previous = state.coordinator.get_all_skribs();',
      '    let result = mutation(&state.coordinator)?;',
      '',
      '    if let Err(message) = persist_skribs(state) {',
      '        state.coordinator.replace_all_skribs(previous);',
      '        return Err(message);',
      '    }',
      '    Ok(result)',
      '}',
    ]),
    'serialize mutation, persistence, and rollback',
  );

  const handlerReplacements = [
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    state.coordinator.upsert_skrib(note);',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator.upsert_skrib(note);',
        '        Ok(())',
        '    })?;',
      ]),
      'serialized upsert',
    ],
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    if !state',
        '        .coordinator',
        '        .update_skrib_position(&id, rel_x, rel_y, width, height)',
        '    {',
        '        return Err("Skrib note was not found or is not writable".to_string());',
        '    }',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator',
        '            .update_skrib_position(&id, rel_x, rel_y, width, height)',
        '            .then_some(())',
        '            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())',
        '    })?;',
      ]),
      'serialized position update',
    ],
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    if !state.coordinator.update_skrib_text(&id, text) {',
        '        return Err("Skrib note was not found or is not writable".to_string());',
        '    }',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator',
        '            .update_skrib_text(&id, text)',
        '            .then_some(())',
        '            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())',
        '    })?;',
      ]),
      'serialized text update',
    ],
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    if !state.coordinator.update_skrib_color(&id, color) {',
        '        return Err("Skrib note was not found or is not writable".to_string());',
        '    }',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator',
        '            .update_skrib_color(&id, color)',
        '            .then_some(())',
        '            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())',
        '    })?;',
      ]),
      'serialized color update',
    ],
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    if state.coordinator.toggle_skrib_collapse(&id).is_none() {',
        '        return Err("Skrib note was not found or is not writable".to_string());',
        '    }',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator',
        '            .toggle_skrib_collapse(&id)',
        '            .map(|_| ())',
        '            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())',
        '    })?;',
      ]),
      'serialized collapse update',
    ],
    [
      join([
        '    let previous = state.coordinator.get_all_skribs();',
        '    if state.coordinator.remove_skrib(&id).is_none() {',
        '        return Err("Skrib note was not found or is not writable".to_string());',
        '    }',
        '    persist_or_restore(&state, previous)?;',
      ]),
      join([
        '    run_persisted_mutation(&state, |coordinator| {',
        '        coordinator',
        '            .remove_skrib(&id)',
        '            .map(|_| ())',
        '            .ok_or_else(|| "Skrib note was not found or is not writable".to_string())',
        '    })?;',
      ]),
      'serialized delete',
    ],
  ];

  for (const [before, after, label] of handlerReplacements) {
    source = replaceExact(source, before, after, label);
  }

  source = replaceExact(
    source,
    join([
      '        init_status: Mutex::new(OverlayInitializationStatus::Initializing),',
      '        storage: Mutex::new(storage::StorageService::new(storage_path)),',
    ]),
    join([
      '        init_status: Mutex::new(OverlayInitializationStatus::Initializing),',
      '        mutation_lock: Mutex::new(()),',
      '        storage: Mutex::new(storage::StorageService::new(storage_path)),',
    ]),
    'initialize mutation lock',
  );

  source = replaceExact(
    source,
    join([
      '                            let previous_skribs = coordinator_hk.get_all_skribs();',
      '                            coordinator_hk.upsert_skrib(new_note);',
      '                            if let Err(message) = persist_skribs(&state_hk) {',
      '                                coordinator_hk.replace_all_skribs(previous_skribs);',
      '                                let _ = app_handle_hk.emit("skribly://storage-error", message);',
      '                            }',
    ]),
    join([
      '                            if let Err(message) =',
      '                                run_persisted_mutation(&state_hk, |coordinator| {',
      '                                    coordinator.upsert_skrib(new_note);',
      '                                    Ok(())',
      '                                })',
      '                            {',
      '                                let _ = app_handle_hk.emit("skribly://storage-error", message);',
      '                            }',
    ]),
    'serialize hotkey-created note persistence',
  );

  source = source.replaceAll(
    '            init_status: Mutex::new(OverlayInitializationStatus::Initializing),\n            storage:',
    '            init_status: Mutex::new(OverlayInitializationStatus::Initializing),\n            mutation_lock: Mutex::new(()),\n            storage:',
  );

  source = replaceExact(
    source,
    join([
      '        assert!(visible_skribs(&coordinator, None).is_empty());',
      '        assert_eq!(coordinator.get_all_skribs().len(), 1);',
      '    }',
      '}',
    ]),
    join([
      '        assert!(visible_skribs(&coordinator, None).is_empty());',
      '        assert_eq!(coordinator.get_all_skribs().len(), 1);',
      '    }',
      '',
      '    #[test]',
      '    fn failed_persistence_restores_the_previous_coordinator_snapshot() {',
      '        let directory = std::env::temp_dir().join(format!(',
      '            "skribly-lib-storage-rollback-{}",',
      '            std::process::id()',
      '        ));',
      '        let _ = std::fs::remove_dir_all(&directory);',
      '        std::fs::create_dir_all(&directory).expect("create test directory");',
      '        let storage_path = directory.join("skribs.json");',
      '        std::fs::write(',
      '            &storage_path,',
      '            r#"{"schema_version":99,"revision":1,"written_at_ms":1,"integrity":"future","skribs":[]}"#,',
      '        )',
      '        .expect("write unsupported schema fixture");',
      '',
      '        let mut storage_service = storage::StorageService::new(storage_path);',
      '        assert!(storage_service.load().is_err());',
      '        let coordinator = Coordinator::new();',
      '        let original = SkribNote {',
      '            id: "note-a".into(),',
      '            target_process_name: "notepad.exe".into(),',
      '            target_title: "Document-A.txt - Notepad".into(),',
      '            rel_x: 20.0,',
      '            rel_y: 20.0,',
      '            width: 300.0,',
      '            height: 220.0,',
      '            text: "Original".into(),',
      '            color: "yellow".into(),',
      '            collapsed: false,',
      '            created_at: 1,',
      '            updated_at: 1,',
      '        };',
      '        coordinator.upsert_skrib(original.clone());',
      '        let app_state = AppState {',
      '            coordinator: coordinator.clone(),',
      '            running: Arc::new(AtomicBool::new(true)),',
      '            init_status: Mutex::new(OverlayInitializationStatus::Initializing),',
      '            mutation_lock: Mutex::new(()),',
      '            storage: Mutex::new(storage_service),',
      '            storage_notice: Mutex::new(None),',
      '            storage_error: Mutex::new(None),',
      '            #[cfg(target_os = "windows")]',
      '            win_event_sender: channel().0,',
      '        };',
      '',
      '        let result = run_persisted_mutation(&app_state, |coordinator| {',
      '            coordinator',
      '                .update_skrib_text("note-a", "Unsaved".to_string())',
      '                .then_some(())',
      '                .ok_or_else(|| "note missing".to_string())',
      '        });',
      '        assert!(result.is_err());',
      '        assert_eq!(coordinator.get_all_skribs(), vec![original]);',
      '        assert!(app_state.storage_health().error.is_some());',
      '        assert!(!app_state.storage_health().writable);',
      '        let _ = std::fs::remove_dir_all(&directory);',
      '    }',
      '}',
    ]),
    'native rollback regression test',
  );

  return source;
});

await edit('apps/desktop/src/stores/skribStore.ts', (source) => {
  source = replaceExact(
    source,
    join([
      '  errorMessage: string | null;',
      '  storageNotice: StorageNotice | null;',
    ]),
    join([
      '  errorMessage: string | null;',
      '  storageErrorMessage: string | null;',
      '  storageNotice: StorageNotice | null;',
    ]),
    'separate storage error field',
  );

  source = replaceExact(
    source,
    join([
      '  clearError: () => void;',
      '  dismissStorageNotice: () => void;',
    ]),
    join([
      '  clearError: () => void;',
      '  dismissStorageNotice: () => void;',
      '  refreshStorageHealth: () => Promise<void>;',
    ]),
    'storage health refresh action type',
  );

  source = replaceExact(
    source,
    join([
      '  errorMessage: null,',
      '  storageNotice: null,',
    ]),
    join([
      '  errorMessage: null,',
      '  storageErrorMessage: null,',
      '  storageNotice: null,',
    ]),
    'initial storage error state',
  );

  source = replaceExact(
    source,
    "    return storage.errorMessage || 'Local note storage is currently read-only to protect existing data.';",
    "    return storage.storageErrorMessage || 'Local note storage is currently read-only to protect existing data.';",
    'storage write-block source',
  );

  source = replaceExact(
    source,
    join([
      '  dismissStorageNotice: () => {',
      '    set({ storageNotice: null });',
      '  },',
    ]),
    join([
      '  dismissStorageNotice: () => {',
      '    set({ storageNotice: null });',
      '  },',
      '',
      '  refreshStorageHealth: async () => {',
      '    if (!get().isTauriAvailable) return;',
      '    try {',
      "      const storageHealth = await invoke<StorageHealthPayload>('get_storage_health');",
      '      set({',
      '        storageNotice: storageHealth.notice,',
      '        storageWritable: storageHealth.writable,',
      '        storageRevision: storageHealth.revision,',
      '        storageBackupDirectory: storageHealth.backupDirectory,',
      '        storageErrorMessage: storageHealth.error',
      '          ? `Local note storage needs attention: ${storageHealth.error}`',
      '          : null,',
      '      });',
      '    } catch (error) {',
      '      const message = error instanceof Error ? error.message : String(error);',
      '      set({ errorMessage: `Failed to read local storage health: ${message}` });',
      '    }',
      '  },',
    ]),
    'storage health action implementation',
  );

  source = source.replaceAll(
    '        errorMessage: null,\n      });',
    '        errorMessage: null,\n        storageErrorMessage: null,\n      });',
  );

  source = replaceExact(
    source,
    '      set({ skribs: previousSkribs, errorMessage: `Failed to save text: ${msg}` });\n      return false;',
    '      set({ skribs: previousSkribs, storageErrorMessage: `Failed to save text: ${msg}` });\n      await get().refreshStorageHealth();\n      return false;',
    'refresh health after text save failure',
  );

  source = replaceExact(
    source,
    '      set({ skribs: previousSkribs, errorMessage: `Failed to delete Skrib: ${msg}` });\n      return false;',
    '      set({ skribs: previousSkribs, storageErrorMessage: `Failed to delete Skrib: ${msg}` });\n      await get().refreshStorageHealth();\n      return false;',
    'refresh health after delete failure',
  );

  source = replaceExact(
    source,
    join([
      "        const storageErrorUnlisten = await listen<string>('skribly://storage-error', (event) => {",
      '          set({ errorMessage: `Failed to save locally: ${event.payload}` });',
      '        });',
    ]),
    join([
      "        const storageErrorUnlisten = await listen<string>('skribly://storage-error', (event) => {",
      '          set({ storageErrorMessage: `Failed to save locally: ${event.payload}` });',
      '          void get().refreshStorageHealth();',
      '        });',
    ]),
    'native storage error listener',
  );

  source = replaceExact(
    source,
    join([
      "        const storageHealth = await invoke<StorageHealthPayload>('get_storage_health');",
      '        set({',
      '          storageNotice: storageHealth.notice,',
      '          storageWritable: storageHealth.writable,',
      '          storageRevision: storageHealth.revision,',
      '          storageBackupDirectory: storageHealth.backupDirectory,',
      '          errorMessage: storageHealth.error',
      '            ? `Local note storage needs attention: ${storageHealth.error}`',
      '            : get().errorMessage,',
      '        });',
    ]),
    '        await get().refreshStorageHealth();',
    'reuse storage health action during startup',
  );

  return source;
});

await edit('apps/desktop/src/features/skribs/SkribComposer.tsx', (source) => {
  return replaceExact(
    source,
    '    errorMessage: storageErrorMessage,',
    '    storageErrorMessage,',
    'composer reads dedicated storage error',
  );
});

await edit('apps/desktop/src/stores/skribStore.test.ts', (source) => {
  source = replaceExact(
    source,
    join([
      '      isTauriAvailable: false,',
      '      errorMessage: null,',
    ]),
    join([
      '      isTauriAvailable: false,',
      '      errorMessage: null,',
      '      storageErrorMessage: null,',
      '      storageNotice: null,',
      '      storageWritable: true,',
      '      storageRevision: 0,',
      "      storageBackupDirectory: '',",
    ]),
    'reset storage state between tests',
  );

  source = replaceExact(
    source,
    join([
      "  it('creates a blank note when no initial text is supplied', async () => {",
    ]),
    join([
      "  it('keeps existing notes unchanged when storage is read only', async () => {",
      "    await useSkribStore.getState().addSkrib('Original text', 'yellow');",
      '    const note = useSkribStore.getState().skribs[0]!;',
      '    useSkribStore.setState({',
      '      storageWritable: false,',
      "      storageErrorMessage: 'Local note data needs recovery.',",
      '    });',
      '',
      "    const updated = await useSkribStore.getState().updateSkribText(note.id, 'Should not appear');",
      '    const deleted = await useSkribStore.getState().deleteSkrib(note.id);',
      '',
      '    expect(updated).toBe(false);',
      '    expect(deleted).toBe(false);',
      '    expect(useSkribStore.getState().skribs).toEqual([note]);',
      "    expect(useSkribStore.getState().errorMessage).toBe('Local note data needs recovery.');",
      '  });',
      '',
      "  it('dismisses a recovery notice without changing storage health', () => {",
      '    useSkribStore.setState({',
      '      storageNotice: {',
      "        message: 'Recovered notes.',",
      "        source: 'backup1',",
      '        revision: 2,',
      '        migratedFromSchema: null,',
      '        quarantinedFiles: [],',
      "        backupDirectory: 'C:/Skribli',",
      '      },',
      '      storageWritable: true,',
      '      storageRevision: 2,',
      '    });',
      '',
      '    useSkribStore.getState().dismissStorageNotice();',
      '    expect(useSkribStore.getState().storageNotice).toBeNull();',
      '    expect(useSkribStore.getState().storageWritable).toBe(true);',
      '    expect(useSkribStore.getState().storageRevision).toBe(2);',
      '  });',
      '',
      "  it('creates a blank note when no initial text is supplied', async () => {",
    ]),
    'storage read-only frontend tests',
  );
  return source;
});

console.log('Issue #14 hardening changes applied.');
