import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src-tauri/src/core/storage.rs';
const before = await readFile(path, 'utf8');
let after = before;

const join = (lines) => lines.join('\n');

function replaceExact(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(oldValue, newValue);
}

after = replaceExact(
  after,
  join([
    '    AfterBackupRotation,',
    '    BeforePrimaryReplace,',
  ]),
  join([
    '    AfterBackupRotation,',
    '    BeforePrimaryReplace,',
    '    AfterPrimaryReplace,',
  ]),
  'add post-replacement fault point',
);

after = replaceExact(
  after,
  join([
    '        if !unsupported.is_empty() {',
    '            let reason = unsupported',
    '                .iter()',
    '                .map(ToString::to_string)',
    '                .collect::<Vec<_>>()',
    '                .join("; ");',
    '            self.blocked_reason = Some(reason.clone());',
    '            return Err(StorageError::WriteBlocked { reason });',
    '        }',
    '',
    '        if !found_any_file {',
  ]),
  join([
    '        let unsupported_reason = (!unsupported.is_empty()).then(|| {',
    '            unsupported',
    '                .iter()',
    '                .map(ToString::to_string)',
    '                .collect::<Vec<_>>()',
    '                .join("; ")',
    '        });',
    '',
    '        if !found_any_file {',
  ]),
  'defer unsupported-schema decision until valid candidates are known',
);

after = replaceExact(
  after,
  join([
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
  ]),
  join([
    '        if valid.is_empty() {',
    '            if let Some(reason) = unsupported_reason {',
    '                self.blocked_reason = Some(reason.clone());',
    '                return Err(StorageError::WriteBlocked { reason });',
    '            }',
    '',
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
  ]),
  'preserve no-valid-candidate future schema behavior',
);

after = replaceExact(
  after,
  join([
    '        let selected = valid.remove(0);',
    '',
    '        let mut quarantined_files = Vec::new();',
  ]),
  join([
    '        let selected = valid.remove(0);',
    '',
    '        if let Some(reason) = unsupported_reason {',
    '            return Ok(self.read_only_recovery_outcome(',
    '                &selected,',
    '                format!(',
    '                    "A newer unsupported storage generation was preserved and writes are blocked: {reason}"',
    '                ),',
    '                Vec::new(),',
    '            ));',
    '        }',
    '',
    '        let mut quarantined_files = Vec::new();',
  ]),
  'show verified data read-only when a future generation also exists',
);

after = replaceExact(
  after,
  join([
    '        atomic_replace(&temporary, &self.primary_path)?;',
    '        sync_parent_directory(&parent)?;',
    '',
    '        let committed = match decode_candidate(&self.primary_path, StorageSource::Primary) {',
  ]),
  join([
    '        atomic_replace(&temporary, &self.primary_path)?;',
    '        sync_parent_directory(&parent)?;',
    '        maybe_fail(',
    '            fault,',
    '            SaveFault::AfterPrimaryReplace,',
    '            "after primary replacement",',
    '        )?;',
    '',
    '        let committed = match decode_candidate(&self.primary_path, StorageSource::Primary) {',
  ]),
  'inject failure after durable primary replacement',
);

after = replaceExact(
  after,
  join([
    '    #[test]',
    '    fn rotates_two_known_good_backup_generations() {',
  ]),
  join([
    '    #[test]',
    '    fn interruption_after_primary_replace_keeps_the_committed_revision() {',
    '        let path = test_path("fault-after-replace");',
    '        let mut storage = StorageService::new(path.clone());',
    '        storage.load().expect("empty load");',
    '        storage.save(&[note("one", "First")]).expect("first save");',
    '        storage',
    '            .save_internal(',
    '                &[note("two", "Committed before interruption")],',
    '                SaveFault::AfterPrimaryReplace,',
    '            )',
    '            .expect_err("fault should interrupt verification");',
    '',
    '        let mut reopened = StorageService::new(path.clone());',
    '        let loaded = reopened',
    '            .load()',
    '            .expect("the replaced primary should verify on restart");',
    '        assert_eq!(',
    '            loaded.skribs,',
    '            vec![note("two", "Committed before interruption")]',
    '        );',
    '        assert_eq!(loaded.revision, 2);',
    '        cleanup(&path);',
    '    }',
    '',
    '    #[test]',
    '    fn rotates_two_known_good_backup_generations() {',
  ]),
  'add post-replacement recovery regression test',
);

after = replaceExact(
  after,
  join([
    '    #[test]',
    '    fn unsupported_backup_generation_blocks_further_writes() {',
  ]),
  join([
    '    #[test]',
    '    fn future_backup_with_valid_primary_opens_verified_notes_read_only() {',
    '        let path = test_path("future-backup-startup");',
    '        let mut storage = StorageService::new(path.clone());',
    '        storage.load().expect("empty load");',
    '        storage.save(&[note("one", "Verified primary")]).expect("save one");',
    '        write_bytes_synced(',
    '            &storage.backup1_path(),',
    '            br#"{"schema_version":99,"revision":50,"written_at_ms":1,"integrity":"future","skribs":[]}"#,',
    '        )',
    '        .expect("future backup fixture");',
    '',
    '        let mut reopened = StorageService::new(path.clone());',
    '        let loaded = reopened',
    '            .load()',
    '            .expect("verified primary should remain visible read-only");',
    '        assert_eq!(loaded.skribs, vec![note("one", "Verified primary")]);',
    '        assert!(!reopened.is_writable());',
    '        assert!(loaded',
    '            .notice',
    '            .expect("future-schema recovery notice")',
    '            .message',
    '            .contains("newer unsupported storage generation"));',
    '        assert!(storage.backup1_path().exists());',
    '        cleanup(&path);',
    '    }',
    '',
    '    #[test]',
    '    fn unsupported_backup_generation_blocks_further_writes() {',
  ]),
  'add startup future-backup read-only regression test',
);

if (after === before) throw new Error('No future-schema recovery changes produced');
await writeFile(path, after, 'utf8');
console.log('Applied future-schema read-only recovery and post-replacement fault coverage.');
