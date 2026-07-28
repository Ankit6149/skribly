import { readFile, writeFile } from 'node:fs/promises';

const path = 'apps/desktop/src-tauri/src/core/storage.rs';
const before = await readFile(path, 'utf8');

function transformFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`${signature}: function not found`);
  const nextFunction = source.indexOf('\n    fn ', start + signature.length);
  const end = nextFunction < 0 ? source.length : nextFunction;
  const originalFunction = source.slice(start, end);

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

  const parentCount = originalFunction.split(borrowedParent).length - 1;
  if (parentCount !== 1) {
    throw new Error(`${signature}: expected one borrowed parent block, found ${parentCount}`);
  }

  const syncCall = '        sync_parent_directory(parent)?;';
  const syncCount = originalFunction.split(syncCall).length - 1;
  if (syncCount !== 1) {
    throw new Error(`${signature}: expected one parent sync call, found ${syncCount}`);
  }

  const transformedFunction = originalFunction
    .replace(borrowedParent, ownedParent)
    .replace(syncCall, '        sync_parent_directory(&parent)?;');

  return `${source.slice(0, start)}${transformedFunction}${source.slice(end)}`;
}

let after = transformFunction(before, '    fn save_internal(');
after = transformFunction(after, '    fn restore_candidate(');

if (after === before) throw new Error('No parent path changes produced');
await writeFile(path, after, 'utf8');
console.log('Converted save/recovery parent paths to owned PathBuf values.');
