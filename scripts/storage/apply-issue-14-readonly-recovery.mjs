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
      '',
      '        valid.sort_by(|left, right| {',
      '            right',
      '                .revision',
      '                .cmp(&left.revision)',
      '                .then_with(|| right.source.priority().cmp(&left.source.priority()))',
      '                .then_with(|| right.written_at_ms.cmp(&left.written_at_ms))',
      '        });',
      '        let selected = valid.remove(0);',
      '',
      '        let needs_restore =',
      '            selected.source != StorageSource::Primary || selected.migrated_from_schema.is_some();',
      '        if needs_restore {',
      '            self.restore_candidate(&selected)?;',
      '        }',
    ]),
    join([
      '        valid.sort_by(|left, right| {',
      '            right',
      '                .revision',
      '                .cmp(&left.revision)',
      '                .then_with(|| right.source.priority().cmp(&left.source.priority()))',
      '                .then_with(|| right.written_at_ms.cmp(&left.written_at_ms))',
      '        });',
      '        let selected = valid.remove(0);',
      '',
      '        let mut quarantined_files = Vec::new();',
      '        for (index, candidate) in invalid.into_iter().enumerate() {',
      '            match quarantine_file(&candidate.path, candidate.source, index) {',
      '                Ok(path) => quarantined_files.push(file_name_for_display(&path)),',
      '                Err(error) if candidate.source == StorageSource::Primary => {',
      '                    let reason = format!(',
      '                        "The damaged primary file could not be quarantined safely: {error}"',
      '                    );',
      '                    return Ok(self.read_only_recovery_outcome(',
      '                        &selected,',
      '                        reason,',
      '                        quarantined_files,',
      '                    ));',
      '                }',
      '                Err(error) => invalid_details.push(error.to_string()),',
      '            }',
      '        }',
      '',
      '        let needs_restore =',
      '            selected.source != StorageSource::Primary || selected.migrated_from_schema.is_some();',
      '        if needs_restore {',
      '            if let Err(error) = self.restore_candidate(&selected) {',
      '                return Ok(self.read_only_recovery_outcome(',
      '                    &selected,',
      '                    format!("The verified recovery generation could not be restored: {error}"),',
      '                    quarantined_files,',
      '                ));',
      '            }',
      '        }',
    ]),
    'load verified notes read-only when primary restoration fails',
  );

  source = replaceExact(
    source,
    join([
      '            let mut message = if selected.source == StorageSource::Primary {',
      '                "Skribli upgraded the local note database safely.".to_string()',
      '            } else {',
      '                format!(',
      '                    "Skribli recovered local notes from the {} and restored the primary database.",',
      '                    selected.source',
      '                )',
      '            };',
    ]),
    join([
      '            let mut message = if selected.migrated_from_schema.is_some() {',
      '                "Skribli upgraded the local note database safely.".to_string()',
      '            } else if selected.source != StorageSource::Primary {',
      '                format!(',
      '                    "Skribli recovered local notes from the {} and restored the primary database.",',
      '                    selected.source',
      '                )',
      '            } else {',
      '                "Skribli verified the primary database and preserved damaged recovery files."',
      '                    .to_string()',
      '            };',
    ]),
    'accurate recovery notice message',
  );

  source = replaceExact(
    source,
    join([
      '    pub fn save(&mut self, skribs: &[SkribNote]) -> Result<SaveOutcome, StorageError> {',
    ]),
    join([
      '    fn read_only_recovery_outcome(',
      '        &mut self,',
      '        selected: &DecodedCandidate,',
      '        reason: String,',
      '        quarantined_files: Vec<String>,',
      '    ) -> LoadOutcome {',
      '        self.revision = selected.revision;',
      '        self.blocked_reason = Some(reason.clone());',
      '        LoadOutcome {',
      '            skribs: selected.skribs.clone(),',
      '            revision: selected.revision,',
      '            notice: Some(StorageNotice {',
      '                message: format!(',
      '                    "Skribli opened verified notes from the {} in read-only recovery mode. {reason}",',
      '                    selected.source',
      '                ),',
      '                source: selected.source,',
      '                revision: selected.revision,',
      '                migrated_from_schema: selected.migrated_from_schema,',
      '                quarantined_files,',
      '                backup_directory: parent_directory_for_display(&self.primary_path),',
      '            }),',
      '        }',
      '    }',
      '',
      '    fn block_writes(&mut self, reason: String) -> StorageError {',
      '        self.blocked_reason = Some(reason.clone());',
      '        StorageError::WriteBlocked { reason }',
      '    }',
      '',
      '    pub fn save(&mut self, skribs: &[SkribNote]) -> Result<SaveOutcome, StorageError> {',
    ]),
    'read-only recovery and protective block helpers',
  );

  source = replaceExact(
    source,
    join([
      '        let committed = decode_candidate(&self.primary_path, StorageSource::Primary)?;',
      '        if committed.revision != revision || committed.skribs != skribs {',
      '            let reason = "the committed primary generation could not be verified".to_string();',
      '            self.blocked_reason = Some(reason.clone());',
      '            return Err(StorageError::WriteBlocked { reason });',
      '        }',
    ]),
    join([
      '        let committed = match decode_candidate(&self.primary_path, StorageSource::Primary) {',
      '            Ok(committed) => committed,',
      '            Err(error) => {',
      '                return Err(self.block_writes(format!(',
      '                    "The committed primary generation could not be verified: {error}"',
      '                )));',
      '            }',
      '        };',
      '        if committed.revision != revision || committed.skribs != skribs {',
      '            return Err(self.block_writes(',
      '                "The committed primary generation did not match the requested revision"',
      '                    .to_string(),',
      '            ));',
      '        }',
    ]),
    'block writes after committed-primary verification failure',
  );

  source = replaceExact(
    source,
    '    fn restore_candidate(&self, selected: &DecodedCandidate) -> Result<(), StorageError> {',
    '    fn restore_candidate(&mut self, selected: &DecodedCandidate) -> Result<(), StorageError> {',
    'mutable recovery service',
  );
  source = replaceExact(
    source,
    '    fn rotate_backups(&self) -> Result<(), StorageError> {',
    '    fn rotate_backups(&mut self) -> Result<(), StorageError> {',
    'mutable backup rotation',
  );

  source = replaceExact(
    source,
    join([
      '                Err(error @ StorageError::UnsupportedSchema { .. }) => return Err(error),',
    ]),
    join([
      '                Err(error @ StorageError::UnsupportedSchema { .. }) => {',
      '                    return Err(self.block_writes(error.to_string()));',
      '                }',
    ]),
    'block writes for unsupported rolling backup',
  );

  source = replaceExact(
    source,
    join([
      '        if self.primary_path.exists() {',
      '            let stage1 = sibling_path(&self.primary_path, ".bak.1.stage");',
      '            copy_verified_generation(&self.primary_path, &stage1, StorageSource::Primary)?;',
      '            atomic_replace(&stage1, &backup1)?;',
      '        }',
    ]),
    join([
      '        if self.primary_path.exists() {',
      '            if let Err(error) = decode_candidate(&self.primary_path, StorageSource::Primary) {',
      '                return Err(self.block_writes(format!(',
      '                    "The existing primary generation changed or became invalid before backup rotation: {error}"',
      '                )));',
      '            }',
      '            let stage1 = sibling_path(&self.primary_path, ".bak.1.stage");',
      '            copy_verified_generation(&self.primary_path, &stage1, StorageSource::Primary)?;',
      '            atomic_replace(&stage1, &backup1)?;',
      '        }',
    ]),
    'block writes if primary changes during a running session',
  );

  source = replaceExact(
    source,
    join([
      '    #[test]',
      '    fn exported_diagnostics_never_include_note_contents_or_target_titles() {',
    ]),
    join([
      '    #[test]',
      '    fn read_only_recovery_outcome_exposes_verified_notes_and_blocks_writes() {',
      '        let path = test_path("read-only-recovery");',
      '        let mut storage = StorageService::new(path.clone());',
      '        let selected = DecodedCandidate {',
      '            source: StorageSource::Backup1,',
      '            path: storage.backup1_path(),',
      '            revision: 7,',
      '            written_at_ms: 10,',
      '            skribs: vec![note("safe", "Verified recovery text")],',
      '            migrated_from_schema: None,',
      '        };',
      '',
      '        let outcome = storage.read_only_recovery_outcome(',
      '            &selected,',
      '            "Primary replacement was denied".to_string(),',
      '            Vec::new(),',
      '        );',
      '        assert_eq!(outcome.skribs, selected.skribs);',
      '        assert_eq!(outcome.revision, 7);',
      '        assert!(!storage.is_writable());',
      '        assert!(storage',
      '            .save(&[note("new", "Must remain blocked")])',
      '            .is_err());',
      '        assert!(outcome',
      '            .notice',
      '            .expect("read-only notice")',
      '            .message',
      '            .contains("read-only recovery mode"));',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn unsupported_backup_generation_blocks_further_writes() {',
      '        let path = test_path("unsupported-backup");',
      '        let mut storage = StorageService::new(path.clone());',
      '        storage.load().expect("empty load");',
      '        storage.save(&[note("one", "One")]).expect("save one");',
      '        storage.save(&[note("two", "Two")]).expect("save two");',
      '        write_bytes_synced(',
      '            &storage.backup1_path(),',
      '            br#"{"schema_version":99,"revision":50,"written_at_ms":1,"integrity":"future","skribs":[]}"#,',
      '        )',
      '        .expect("future backup fixture");',
      '',
      '        let error = storage',
      '            .save(&[note("three", "Three")])',
      '            .expect_err("future backup must block writes");',
      '        assert!(matches!(error, StorageError::WriteBlocked { .. }));',
      '        assert!(!storage.is_writable());',
      '        cleanup(&path);',
      '    }',
      '',
      '    #[test]',
      '    fn exported_diagnostics_never_include_note_contents_or_target_titles() {',
    ]),
    'read-only and protective block tests',
  );

  return source;
});

await edit('apps/desktop/src-tauri/src/lib.rs', (source) => {
  source = replaceExact(
    source,
    join([
      '        let (writable, revision, backup_directory) = match self.storage.lock() {',
      '            Ok(storage) => (',
      '                storage.is_writable(),',
      '                storage.current_revision(),',
      '                storage',
      '                    .primary_path()',
      '                    .parent()',
      '                    .map(|path| path.to_string_lossy().into_owned())',
      '                    .unwrap_or_default(),',
      '            ),',
    ]),
    join([
      '        let (writable, revision, backup_directory) = match self.storage.lock() {',
      '            Ok(storage) => {',
      '                if error.is_none() {',
      '                    error = storage.blocked_reason().map(ToString::to_string);',
      '                }',
      '                (',
      '                    storage.is_writable(),',
      '                    storage.current_revision(),',
      '                    storage',
      '                        .primary_path()',
      '                        .parent()',
      '                        .map(|path| path.to_string_lossy().into_owned())',
      '                        .unwrap_or_default(),',
      '                )',
      '            }',
    ]),
    'surface storage-service blocked reason in health payload',
  );

  source = replaceExact(
    source,
    join([
      '        let result = run_persisted_mutation(&app_state, |coordinator| {',
    ]),
    join([
      '        let initial_health = app_state.storage_health();',
      '        assert!(!initial_health.writable);',
      '        assert!(initial_health.error.is_some());',
      '',
      '        let result = run_persisted_mutation(&app_state, |coordinator| {',
    ]),
    'blocked reason health regression assertion',
  );

  return source;
});

console.log('Issue #14 read-only recovery changes applied.');
