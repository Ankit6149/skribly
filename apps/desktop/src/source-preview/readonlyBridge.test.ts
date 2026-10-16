// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { installReadonlyPreviewBridge } from './readonlyBridge';

it('refuses to replace a native bridge and never accepts mutations in a browser fixture', async () => {
  const target=window as unknown as Record<string,unknown>;
  const native={invoke:()=>{throw new Error('Real IPC must not be reached');}};
  target.__TAURI_INTERNALS__=native;
  expect(()=>installReadonlyPreviewBridge([])).toThrow('must not run inside the native app');
  expect(target.__TAURI_INTERNALS__).toBe(native);
  delete target.__TAURI_INTERNALS__;
  const dispose=installReadonlyPreviewBridge([]);
  try {
    const bridge=target.__TAURI_INTERNALS__ as {invoke:(command:string)=>Promise<unknown>};
    expect(await bridge.invoke('get_all_skribs')).toEqual([]);
    for(const command of ['save_skrib_note','delete_skrib_note','apply_portable_import','set_note_preferences','plugin:window|hide','unknown']) {
      await expect(bridge.invoke(command)).rejects.toThrow('read-only');
    }
  } finally {dispose();}
  expect(target.__TAURI_INTERNALS__).toBeUndefined();
});
