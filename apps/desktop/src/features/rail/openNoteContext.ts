import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import { applicationLabel, selectBestContextTarget } from './contextRailModel';

const TARGET_LAUNCH_POLL_ATTEMPTS = 12;
const TARGET_LAUNCH_POLL_DELAY_MS = 250;

export type OpenNoteProgressPhase =
  | 'preparing'
  | 'finding'
  | 'launching'
  | 'locating'
  | 'restoring'
  | 'complete';

export interface OpenNoteProgress {
  phase: OpenNoteProgressPhase;
  title: string;
  detail: string;
}

export type OpenNoteProgressHandler = (progress: OpenNoteProgress) => void;

function report(
  onProgress: OpenNoteProgressHandler | undefined,
  phase: OpenNoteProgressPhase,
  title: string,
  detail: string
): void {
  onProgress?.({ phase, title, detail });
}

export async function openNoteHere(note: SkribNote): Promise<void> {
  await prepareNoteSwitch();
  await invoke('open_skrib_note_here', { id: note.id });
}

// The main window is reused. Never replace its editor before its latest draft is safe.
export async function prepareNoteSwitch(): Promise<void> {
  const noteId = await invoke<string | null>('get_open_skrib_note_id');
  if (!noteId) return;
  const requestId = crypto.randomUUID();
  let dispose: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('The current note is still opening or saving. Please try again.')), 4000);
      void listen<{ requestId: string; ready: boolean; message?: string }>(
        'skribly://note-switch-ready',
        ({ payload }) => {
          if (payload.requestId !== requestId) return;
          if (payload.ready) resolve();
          else reject(new Error(payload.message || 'Finish saving the current note before opening another.'));
        }
      ).then((unlisten) => {
        if (finished) { unlisten(); return; }
        dispose = unlisten;
        return emitTo('main', 'skribly://prepare-note-switch', { requestId, noteId });
      }).catch(reject);
    });
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    dispose?.();
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function focusAndOpenNote(note: SkribNote, target: TargetWindowInfo): Promise<void> {
  await invoke('focus_target_window', { hwndVal: target.hwnd_val });
  await invoke('set_active_target', { target });
  await invoke('set_skrib_window_collapsed', { id: note.id, collapsed: false });
}

export async function openNoteInSavedContext(
  note: SkribNote,
  onProgress?: OpenNoteProgressHandler
): Promise<string> {
  const appName = applicationLabel(note.target_process_name);
  report(onProgress, 'preparing', 'Keeping this thought safe…', 'Finishing any note that is still saving.');
  await prepareNoteSwitch();
  report(onProgress, 'finding', `Looking for ${appName}…`, 'Checking the windows already open on this desktop.');
  let targets = await invoke<TargetWindowInfo[]>('list_target_windows');
  let target = selectBestContextTarget(note, targets);
  if (target) {
    report(onProgress, 'restoring', 'Found the right place.', 'Bringing the saved window forward and unfolding your Skrib.');
    await focusAndOpenNote(note, target);
    report(onProgress, 'complete', 'Your Skrib is ready.', `Opened where it belongs in ${appName}.`);
    return `Opened in ${appName}.`;
  }

  report(onProgress, 'launching', `Opening ${appName}…`, 'The saved window is not open yet, so Skribli is starting the app.');
  const application = await invoke<string>('launch_supported_target_application', {
    processName: note.target_process_name,
  });

  for (let attempt = 0; attempt < TARGET_LAUNCH_POLL_ATTEMPTS; attempt += 1) {
    report(
      onProgress,
      'locating',
      `Finding your place in ${application}…`,
      attempt < 4 ? 'Waiting for the app window to become ready.' : 'Matching the saved window title on this desktop.'
    );
    await wait(TARGET_LAUNCH_POLL_DELAY_MS);
    targets = await invoke<TargetWindowInfo[]>('list_target_windows');
    target = selectBestContextTarget(note, targets);
    if (target) {
      report(onProgress, 'restoring', 'Found the right place.', 'Bringing the saved window forward and unfolding your Skrib.');
      await focusAndOpenNote(note, target);
      report(onProgress, 'complete', 'Your Skrib is ready.', `Opened where it belongs in ${application}.`);
      return `Opened in ${application}.`;
    }
  }

  throw new Error(
    `${application} started, but Skribli could not find the saved window. Open that tab or folder, then try again.`
  );
}
