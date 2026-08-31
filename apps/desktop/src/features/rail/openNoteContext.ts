import { invoke } from '@tauri-apps/api/core';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { applicationLabel, selectBestContextTarget } from './contextRailModel';

const TARGET_LAUNCH_POLL_ATTEMPTS = 12;
const TARGET_LAUNCH_POLL_DELAY_MS = 250;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function focusAndOpenNote(note: SkribNote, target: TargetWindowInfo): Promise<void> {
  await invoke('focus_target_window', { hwndVal: target.hwnd_val });
  await invoke('set_active_target', { target });
  await invoke('set_skrib_window_collapsed', { id: note.id, collapsed: false });
}

export async function openNoteInSavedContext(note: SkribNote): Promise<string> {
  let targets = await invoke<TargetWindowInfo[]>('list_target_windows');
  let target = selectBestContextTarget(note, targets);
  if (target) {
    await focusAndOpenNote(note, target);
    return `Opened in ${applicationLabel(note.target_process_name)}.`;
  }

  const application = await invoke<string>('launch_supported_target_application', {
    processName: note.target_process_name,
  });

  for (let attempt = 0; attempt < TARGET_LAUNCH_POLL_ATTEMPTS; attempt += 1) {
    await wait(TARGET_LAUNCH_POLL_DELAY_MS);
    targets = await invoke<TargetWindowInfo[]>('list_target_windows');
    target = selectBestContextTarget(note, targets);
    if (target) {
      await focusAndOpenNote(note, target);
      return `Opened in ${application}.`;
    }
  }

  throw new Error(
    `${application} started, but Skribli could not find the saved window. Open that tab or folder, then try again.`
  );
}
