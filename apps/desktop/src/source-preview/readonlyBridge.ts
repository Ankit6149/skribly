import type { SkribNote } from '../features/notes/model/noteTypes';

/** Dev fixture only. Never forward IPC, accept writes, or replace a real native bridge. */
export function installReadonlyPreviewBridge(notes: SkribNote[]) {
  const target = window as unknown as Record<string, unknown>;
  if (!import.meta.env.DEV || !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Source preview requires a local development browser.');
  if (target.__TAURI_INTERNALS__) throw new Error('Source preview must not run inside the native app.');
  let sequence = 0;
  const readModels: Record<string, unknown> = {
    get_all_skribs: notes,
    get_storage_health: { writable:true, notice:null, error:null, revision:1, backupDirectory:'Synthetic preview only' },
    get_note_preferences: { version:1, multipleNotesPerContext:false },
  };
  const bridge = {
    metadata:{ currentWindow:{label:'source-preview'}, currentWebview:{label:'source-preview'} },
    transformCallback:() => ++sequence,
    unregisterCallback:() => undefined,
    invoke:async (command:string) => {
      if (command === 'plugin:event|listen') return ++sequence;
      if (command === 'plugin:event|unlisten') return undefined;
      if (Object.hasOwn(readModels,command)) return structuredClone(readModels[command]);
      throw new Error('This source preview is read-only. Use the Windows app for this action.');
    },
  };
  const previousEventBridge = target.__TAURI_EVENT_PLUGIN_INTERNALS__;
  const eventBridge = { unregisterListener:() => undefined };
  target.__TAURI_INTERNALS__ = bridge;
  target.__TAURI_EVENT_PLUGIN_INTERNALS__ = eventBridge;
  return () => {
    if (target.__TAURI_INTERNALS__ === bridge) delete target.__TAURI_INTERNALS__;
    if (target.__TAURI_EVENT_PLUGIN_INTERNALS__ === eventBridge) {
      if (previousEventBridge === undefined) delete target.__TAURI_EVENT_PLUGIN_INTERNALS__;
      else target.__TAURI_EVENT_PLUGIN_INTERNALS__ = previousEventBridge;
    }
  };
}
