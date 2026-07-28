import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src-tauri/src/core/storage.rs';
const before = await readFile(path, 'utf8');
const legacyWrappers = `pub fn load(path: &Path) -> Result<Vec<SkribNote>, String> {
    let mut storage = StorageService::new(path.to_path_buf());
    storage
        .load()
        .map(|outcome| outcome.skribs)
        .map_err(|error| error.to_string())
}

pub fn save(path: &Path, skribs: &[SkribNote]) -> Result<(), String> {
    let mut storage = StorageService::new(path.to_path_buf());
    storage.load().map_err(|error| error.to_string())?;
    storage
        .save(skribs)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

`;

const count = before.split(legacyWrappers).length - 1;
if (count !== 1) {
  throw new Error(`Expected one legacy wrapper block, found ${count}`);
}

const after = before.replace(legacyWrappers, '');
await writeFile(path, after, 'utf8');
console.log('Removed obsolete standalone storage load/save wrappers.');
