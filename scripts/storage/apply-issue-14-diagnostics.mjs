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
      '#[derive(Debug, Clone, PartialEq, Eq)]',
      'pub struct SaveOutcome {',
      '    pub revision: u64,',
      '    pub written_at_ms: u64,',
      '}',
    ]),
    join([
      '#[derive(Debug, Clone, PartialEq, Eq)]',
      'pub struct SaveOutcome {',
      '    pub revision: u64,',
      '    pub written_at_ms: u64,',
      '}',
      '',
      '#[derive(Debug, Clone, Serialize, PartialEq, Eq)]',
      '#[serde(rename_all = "camelCase")]',
      'pub struct StorageFileDiagnostic {',
      '    pub source: StorageSource,',
      '    pub file_name: String,',
      '    pub exists: bool,',
      '    pub size_bytes: Option<u64>,',
      '    pub modified_at_ms: Option<u64>,',
      '    pub status: String,',
      '    pub revision: Option<u64>,',
      '    pub schema_version: Option<u32>,',
      '    pub error: Option<String>,',
      '}',
      '',
      '#[derive(Debug, Clone, Serialize, PartialEq, Eq)]',
      '#[serde(rename_all = "camelCase")]',
      'pub struct StorageDiagnostics {',
      '    pub generated_at_ms: u64,',
      '    pub current_schema_version: u32,',
      '    pub current_revision: u64,',
      '    pub writable: bool,',
      '    pub blocked_reason: Option<String>,',
      '    pub files: Vec<StorageFileDiagnostic>,',
      '}',
    ]),
    'diagnostics data types',
  );

  source = replaceExact(
    source,
    join([
      '    pub fn save(&mut self, skribs: &[SkribNote]) -> Result<SaveOutcome, StorageError> {',
      '        self.save_internal(skribs, SaveFault::None)',
      '    }',
    ]),
    join([
      '    pub fn save(&mut self, skribs: &[SkribNote]) -> Result<SaveOutcome, StorageError> {',
      '        self.save_internal(skribs, SaveFault::None)',
      '    }',
      '',
      '    pub fn diagnostics(&self) -> StorageDiagnostics {',
      '        let files = self',
      '            .candidate_paths()',
      '            .into_iter()',
      '            .map(|(source, path)| diagnose_candidate(source, &path))',
      '            .collect();',
      '',
      '        StorageDiagnostics {',
      '            generated_at_ms: now_millis(),',
      '            current_schema_version: CURRENT_SCHEMA_VERSION,',
      '            current_revision: self.revision,',
      '            writable: self.is_writable(),',
      '            blocked_reason: self.blocked_reason.clone(),',
      '            files,',
      '        }',
      '    }',
      '',
      '    pub fn export_diagnostics(&self) -> Result<PathBuf, StorageError> {',
      '        let parent = self',
      '            .primary_path',
      '            .parent()',
      '            .ok_or(StorageError::MissingParent)?;',
      '        fs::create_dir_all(parent)',
      '            .map_err(|error| io_error("create diagnostics directory", parent, error))?;',
      '        let file_name = format!(',
      '            "skribli-storage-diagnostics-{}.json",',
      '            now_millis()',
      '        );',
      '        let output = parent.join(file_name);',
      '        let payload = serde_json::to_vec_pretty(&self.diagnostics()).map_err(|error| {',
      '            StorageError::InvalidData {',
      '                path: file_name_for_display(&output),',
      '                reason: format!("failed to encode storage diagnostics: {error}"),',
      '            }',
      '        })?;',
      '        write_bytes_synced(&output, &payload)?;',
      '        Ok(output)',
      '    }',
    ]),
    'storage diagnostics methods',
  );

  source = replaceExact(
    source,
    join([
      'fn copy_verified_generation(',
    ]),
    join([
      'fn diagnose_candidate(source: StorageSource, path: &Path) -> StorageFileDiagnostic {',
      '    if !path.exists() {',
      '        return StorageFileDiagnostic {',
      '            source,',
      '            file_name: file_name_for_display(path),',
      '            exists: false,',
      '            size_bytes: None,',
      '            modified_at_ms: None,',
      '            status: "missing".to_string(),',
      '            revision: None,',
      '            schema_version: None,',
      '            error: None,',
      '        };',
      '    }',
      '',
      '    let metadata = fs::metadata(path).ok();',
      '    let size_bytes = metadata.as_ref().map(fs::Metadata::len);',
      '    let modified_at_ms = metadata',
      '        .and_then(|metadata| metadata.modified().ok())',
      '        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())',
      '        .and_then(|duration| duration.as_millis().try_into().ok());',
      '',
      '    match decode_candidate(path, source) {',
      '        Ok(candidate) => StorageFileDiagnostic {',
      '            source,',
      '            file_name: file_name_for_display(path),',
      '            exists: true,',
      '            size_bytes,',
      '            modified_at_ms,',
      '            status: "valid".to_string(),',
      '            revision: Some(candidate.revision),',
      '            schema_version: Some(',
      '                candidate',
      '                    .migrated_from_schema',
      '                    .unwrap_or(CURRENT_SCHEMA_VERSION),',
      '            ),',
      '            error: None,',
      '        },',
      '        Err(error @ StorageError::UnsupportedSchema { .. }) => StorageFileDiagnostic {',
      '            source,',
      '            file_name: file_name_for_display(path),',
      '            exists: true,',
      '            size_bytes,',
      '            modified_at_ms,',
      '            status: "unsupportedSchema".to_string(),',
      '            revision: None,',
      '            schema_version: None,',
      '            error: Some(error.to_string()),',
      '        },',
      '        Err(error) => StorageFileDiagnostic {',
      '            source,',
      '            file_name: file_name_for_display(path),',
      '            exists: true,',
      '            size_bytes,',
      '            modified_at_ms,',
      '            status: "invalid".to_string(),',
      '            revision: None,',
      '            schema_version: None,',
      '            error: Some(error.to_string()),',
      '        },',
      '    }',
      '}',
      '',
      'fn copy_verified_generation(',
    ]),
    'diagnose storage candidates without note contents',
  );

  source = replaceExact(
    source,
    join([
      '    #[test]',
      '    fn unsupported_schema_is_preserved_and_blocks_writes() {',
    ]),
    join([
      '    #[test]',
      '    fn exported_diagnostics_never_include_note_contents_or_target_titles() {',
      '        let path = test_path("diagnostics");',
      '        let mut storage = StorageService::new(path.clone());',
      '        storage.load().expect("empty load");',
      '        storage',
      '            .save(&[note("private", "Never include this private text")])',
      '            .expect("save diagnostics fixture");',
      '',
      '        let diagnostics_path = storage',
      '            .export_diagnostics()',
      '            .expect("diagnostics should export");',
      '        let diagnostics = fs::read_to_string(diagnostics_path)',
      '            .expect("diagnostics should be readable");',
      '        assert!(!diagnostics.contains("Never include this private text"));',
      '        assert!(!diagnostics.contains("Notes - Notepad"));',
      '        assert!(diagnostics.contains("currentSchemaVersion"));',
      '        assert!(diagnostics.contains("skribs.json"));',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn unsupported_schema_is_preserved_and_blocks_writes() {',
    ]),
    'content-free diagnostics regression test',
  );

  return source;
});

await edit('apps/desktop/src-tauri/src/lib.rs', (source) => {
  source = replaceExact(
    source,
    join([
      '#[tauri::command]',
      'fn get_storage_health(state: State<\'_, AppState>) -> StorageHealthPayload {',
      '    state.storage_health()',
      '}',
    ]),
    join([
      '#[tauri::command]',
      'fn get_storage_health(state: State<\'_, AppState>) -> StorageHealthPayload {',
      '    state.storage_health()',
      '}',
      '',
      '#[tauri::command]',
      'fn export_storage_diagnostics(state: State<\'_, AppState>) -> Result<String, String> {',
      '    let storage = state',
      '        .storage',
      '        .lock()',
      '        .map_err(|_| "Local storage service is unavailable".to_string())?;',
      '    storage',
      '        .export_diagnostics()',
      '        .map(|path| path.to_string_lossy().into_owned())',
      '        .map_err(|error| error.to_string())',
      '}',
    ]),
    'diagnostics export command',
  );

  source = replaceExact(
    source,
    join([
      '            get_storage_health,',
      '            upsert_skrib_note,',
    ]),
    join([
      '            get_storage_health,',
      '            export_storage_diagnostics,',
      '            upsert_skrib_note,',
    ]),
    'register diagnostics command',
  );
  return source;
});

await edit('apps/desktop/src/stores/skribStore.ts', (source) => {
  source = replaceExact(
    source,
    join([
      '  refreshStorageHealth: () => Promise<void>;',
      '  openLibrary: () => Promise<void>;',
    ]),
    join([
      '  refreshStorageHealth: () => Promise<void>;',
      '  exportStorageDiagnostics: () => Promise<string | null>;',
      '  openLibrary: () => Promise<void>;',
    ]),
    'frontend diagnostics action type',
  );

  source = replaceExact(
    source,
    join([
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
    join([
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
      '',
      '  exportStorageDiagnostics: async () => {',
      '    if (!get().isTauriAvailable) return null;',
      '    try {',
      "      return await invoke<string>('export_storage_diagnostics');",
      '    } catch (error) {',
      '      const message = error instanceof Error ? error.message : String(error);',
      '      set({ errorMessage: `Failed to export storage diagnostics: ${message}` });',
      '      return null;',
      '    }',
      '  },',
    ]),
    'frontend diagnostics action implementation',
  );

  const mutations = [
    [
      '        initStatus: payload.init_status || get().initStatus,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to create Skrib note: ${msg}` });',
      '        initStatus: payload.init_status || get().initStatus,\n        errorMessage: null,\n        storageErrorMessage: null,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to create Skrib note: ${msg}` });\n      await get().refreshStorageHealth();',
      'create mutation health handling',
    ],
    [
      '        initStatus: payload.init_status || get().initStatus,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to save Skrib position: ${msg}` });',
      '        initStatus: payload.init_status || get().initStatus,\n        errorMessage: null,\n        storageErrorMessage: null,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to save Skrib position: ${msg}` });\n      await get().refreshStorageHealth();',
      'position mutation health handling',
    ],
    [
      '        initStatus: payload.init_status || get().initStatus,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to change color: ${msg}` });',
      '        initStatus: payload.init_status || get().initStatus,\n        errorMessage: null,\n        storageErrorMessage: null,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to change color: ${msg}` });\n      await get().refreshStorageHealth();',
      'color mutation health handling',
    ],
    [
      '        initStatus: payload.init_status || get().initStatus,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to toggle collapse: ${msg}` });',
      '        initStatus: payload.init_status || get().initStatus,\n        errorMessage: null,\n        storageErrorMessage: null,\n      });\n    } catch (e) {\n      const msg = e instanceof Error ? e.message : String(e);\n      set({ skribs: previousSkribs, errorMessage: `Failed to toggle collapse: ${msg}` });\n      await get().refreshStorageHealth();',
      'collapse mutation health handling',
    ],
  ];
  for (const [before, after, label] of mutations) {
    source = replaceExact(source, before, after, label);
  }

  source = replaceExact(
    source,
    '      set({ skribs: previousSkribs, storageErrorMessage: `Failed to save text: ${msg}` });',
    '      set({\n        skribs: previousSkribs,\n        errorMessage: `Failed to save text: ${msg}`,\n        storageErrorMessage: `Failed to save text: ${msg}`,\n      });',
    'text failure remains visible even when health is writable',
  );
  source = replaceExact(
    source,
    '      set({ skribs: previousSkribs, storageErrorMessage: `Failed to delete Skrib: ${msg}` });',
    '      set({\n        skribs: previousSkribs,\n        errorMessage: `Failed to delete Skrib: ${msg}`,\n        storageErrorMessage: `Failed to delete Skrib: ${msg}`,\n      });',
    'delete failure remains visible even when health is writable',
  );

  return source;
});

await edit('apps/desktop/src/features/skribs/SkribComposer.tsx', (source) => {
  source = replaceExact(
    source,
    join([
      '    storageWritable,',
      '    dismissStorageNotice,',
    ]),
    join([
      '    storageWritable,',
      '    storageBackupDirectory,',
      '    dismissStorageNotice,',
      '    exportStorageDiagnostics,',
    ]),
    'composer diagnostics actions',
  );

  source = replaceExact(
    source,
    '  const [composerError, setComposerError] = useState<string | null>(null);',
    join([
      '  const [composerError, setComposerError] = useState<string | null>(null);',
      '  const [diagnosticsPath, setDiagnosticsPath] = useState<string | null>(null);',
    ]),
    'composer diagnostics result state',
  );

  source = replaceExact(
    source,
    join([
      '  const handleDelete = async () => {',
    ]),
    join([
      '  const handleExportDiagnostics = async () => {',
      '    const output = await exportStorageDiagnostics();',
      '    if (output) setDiagnosticsPath(output);',
      '  };',
      '',
      '  const handleDelete = async () => {',
    ]),
    'composer diagnostics handler',
  );

  source = replaceExact(
    source,
    join([
      '        {(composerError || storageErrorMessage) && (',
      '          <div className="composer-error" role="alert">',
      '            {composerError || storageErrorMessage}',
      '          </div>',
      '        )}',
    ]),
    join([
      '        {(composerError || storageErrorMessage) && (',
      '          <div className="composer-error" role="alert">',
      '            <span>{composerError || storageErrorMessage}</span>',
      '            {storageBackupDirectory && (',
      '              <small>Recovery folder: {storageBackupDirectory}</small>',
      '            )}',
      '            <button type="button" onClick={() => void handleExportDiagnostics()}>',
      '              Save safe diagnostics',
      '            </button>',
      '            {diagnosticsPath && <small>Diagnostics saved to: {diagnosticsPath}</small>}',
      '          </div>',
      '        )}',
    ]),
    'composer recovery diagnostics UI',
  );
  return source;
});

await edit('apps/desktop/src/styles/note-experience.css', (source) => {
  source = replaceExact(
    source,
    join([
      '.composer-error {',
      '  border: 1px solid rgba(146, 52, 52, 0.2);',
      '  background: rgba(255, 242, 242, 0.7);',
      '  color: #7f2929;',
      '}',
    ]),
    join([
      '.composer-error {',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: flex-start;',
      '  gap: 5px;',
      '  border: 1px solid rgba(146, 52, 52, 0.2);',
      '  background: rgba(255, 242, 242, 0.7);',
      '  color: #7f2929;',
      '}',
      '',
      '.composer-error small {',
      '  overflow-wrap: anywhere;',
      '  opacity: 0.82;',
      '}',
      '',
      '.composer-error button {',
      '  padding: 0;',
      '  border: 0;',
      '  background: transparent;',
      '  color: inherit;',
      '  cursor: pointer;',
      '  font: inherit;',
      '  font-weight: 700;',
      '  text-decoration: underline;',
      '  text-underline-offset: 2px;',
      '}',
    ]),
    'diagnostics UI styles',
  );
  return source;
});

console.log('Issue #14 diagnostics and UI consistency changes applied.');
