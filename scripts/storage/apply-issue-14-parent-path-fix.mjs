import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src-tauri/src/core/storage.rs';
const before = await readFile(path, 'utf8');
let after = before;

function replaceExact(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(oldValue, newValue);
}

const borrowedParent = `        let parent = self
            .primary_path
            .parent()
            .ok_or(StorageError::MissingParent)?;
        fs::create_dir_all(parent)
            .map_err(|error| io_error("create data directory", parent, error))?;`;

const ownedParent = `        let parent = self
            .primary_path
            .parent()
            .ok_or(StorageError::MissingParent)?
            .to_path_buf();
        fs::create_dir_all(&parent)
            .map_err(|error| io_error("create data directory", &parent, error))?;`;

const occurrences = after.split(borrowedParent).length - 1;
if (occurrences !== 2) {
  throw new Error(`owned parent conversion: expected two matches, found ${occurrences}`);
}
after = after.replaceAll(borrowedParent, ownedParent);

const syncCall = '        sync_parent_directory(parent)?;';
const syncOccurrences = after.split(syncCall).length - 1;
if (syncOccurrences !== 2) {
  throw new Error(`parent sync conversion: expected two matches, found ${syncOccurrences}`);
}
after = after.replaceAll(syncCall, '        sync_parent_directory(&parent)?;');

if (after === before) throw new Error('No parent path changes produced');
await writeFile(path, after, 'utf8');
console.log('Converted save/recovery parent paths to owned PathBuf values.');
