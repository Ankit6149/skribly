import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const fixturePath = path.join(
  repositoryRoot,
  'apps/desktop/src-tauri/tests/trash_schema_migration.rs'
);
const fixture = await readFile(fixturePath, 'utf8');

const failures = [];
for (const marker of [
  'struct SchemaV2Note',
  'struct SchemaV2Integrity',
  'struct SchemaV2Envelope',
  'fn crc32(bytes: &[u8]) -> u32',
  'write_schema_v2_database',
  'authentic_schema_v2_database_migrates_to_active_schema_v3_records',
  'StorageService::new(primary.clone())',
  '.load()\n        .expect("an authentic schema-v2 database should migrate")',
  'assert_eq!(loaded.skribs[0].deleted_at, None)',
  'and_then(|notice| notice.migrated_from_schema)',
  'Some(2)',
  'Some(3)',
  'let reloaded = reopened.load().expect("schema-v3 primary should reopen")',
]) {
  if (!fixture.includes(marker)) {
    failures.push(`Authentic schema-v2 migration fixture is missing: ${marker}`);
  }
}

for (const unsafe of [
  'integrity: "future"',
  'deleted_at: None,',
  'serde_json::json!({',
]) {
  if (fixture.includes(unsafe)) {
    failures.push(`Schema-v2 fixture must preserve the original shape and CRC input: ${unsafe}`);
  }
}

if (failures.length > 0) {
  console.error('Trash schema migration fixture validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Trash schema migration fixture validation passed.');
