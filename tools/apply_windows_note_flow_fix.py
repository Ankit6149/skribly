from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


lib_path = Path("apps/desktop/src-tauri/src/lib.rs")
lib = lib_path.read_text(encoding="utf-8")
lib = replace_once(
    lib,
    '''                            if let Some(window) = app_handle_hk.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }

                            let state_hk = app_handle_hk.state::<AppState>();
                            if let Some(ref target) = target_to_use {
                                coordinator_hk.set_active_target(Some(target.clone()));
''',
    '''                            let state_hk = app_handle_hk.state::<AppState>();
                            if let Some(ref target) = target_to_use {
                                if let Some(window) = app_handle_hk.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                                coordinator_hk.set_active_target(Some(target.clone()));
''',
    "show only after target capture",
)
lib = replace_once(
    lib,
    '                                    text: "New Skrib note".into(),\n',
    '                                    text: String::new(),\n',
    "blank note text",
)
lib = replace_once(
    lib,
    '''                            } else {
                                let mut payload =
                                    build_overlay_payload(&app_handle_hk, &state_hk, false);
                                payload.is_shortcut_active = true;
                                let _ = app_handle_hk.emit("skribly://global-shortcut", payload);
                            }
''',
    '''                            } else {
                                coordinator_hk.set_active_target(None);
                                let _ = app_handle_hk.emit(
                                    "skribly://hotkey-error",
                                    "Skribli could not detect the active application. Click the application and try the shortcut again.",
                                );
                            }
''',
    "no target fallback",
)
lib_path.write_text(lib, encoding="utf-8")

store_path = Path("apps/desktop/src/stores/skribStore.ts")
store = store_path.read_text(encoding="utf-8")
for old in [
    "  isPickingTarget: boolean;\n",
    "  setPickingTarget: (picking: boolean) => void;\n",
    "  isPickingTarget: false,\n",
    '''  setPickingTarget: (picking: boolean) => {
    set({ isPickingTarget: picking });
  },

''',
    "    set({ activeTarget: target, isPickingTarget: false, isAmbiguous: false });\n",
    "            isPickingTarget: payload.is_ambiguous ? true : get().isPickingTarget,\n",
    "            isPickingTarget: payload.active_target ? false : true,\n",
]:
    store = store.replace(old, "")
store = store.replace(
    "  addSkrib: async (text = 'New Sticky Note', color = 'yellow') => {",
    "  addSkrib: async (text = '', color = 'yellow') => {",
)
store_path.write_text(store, encoding="utf-8")

overlay_path = Path("apps/desktop/src/features/overlay/OverlayHost.tsx")
overlay = overlay_path.read_text(encoding="utf-8")
overlay = overlay.replace("    isPickingTarget,\n", "")
overlay = overlay.replace("    setPickingTarget,\n", "")
overlay = replace_once(
    overlay,
    '''  const message = errorMessage || (isPickingTarget
    ? 'Open the application you want to annotate, click it once, then press Ctrl + Shift + Space again.'
    : null);
''',
    "  const message = errorMessage;\n",
    "remove target picker message",
)
overlay = overlay.replace("              setPickingTarget(false);\n", "")
overlay_path.write_text(overlay, encoding="utf-8")

test_path = Path("apps/desktop/src/stores/skribStore.test.ts")
test = test_path.read_text(encoding="utf-8")
test = test.replace("      isPickingTarget: false,\n", "")
test = replace_once(
    test,
    '''  it('opens target selection when no target is bound', () => {
    useSkribStore.setState({ activeTarget: null, isPickingTarget: false });
    useSkribStore.getState().setPickingTarget(true);
    expect(useSkribStore.getState().isPickingTarget).toBe(true);
  });

''',
    '''  it('creates a blank note when no initial text is supplied', async () => {
    await useSkribStore.getState().bindTarget(sampleTarget);
    await useSkribStore.getState().addSkrib();
    expect(useSkribStore.getState().skribs[0]!.text).toBe('');
  });

''',
    "replace target picker test",
)
test_path.write_text(test, encoding="utf-8")

tauri_path = Path("apps/desktop/src-tauri/tauri.conf.json")
tauri = tauri_path.read_text(encoding="utf-8").replace(
    '"version": "0.1.1"', '"version": "0.1.2"', 1
)
tauri_path.write_text(tauri, encoding="utf-8")

cargo_path = Path("apps/desktop/src-tauri/Cargo.toml")
cargo = cargo_path.read_text(encoding="utf-8").replace(
    'version = "0.1.1"', 'version = "0.1.2"', 1
)
cargo_path.write_text(cargo, encoding="utf-8")

lock_path = Path("apps/desktop/src-tauri/Cargo.lock")
lock = lock_path.read_text(encoding="utf-8")
lock = lock.replace(
    'name = "skribly"\nversion = "0.1.1"',
    'name = "skribly"\nversion = "0.1.2"',
    1,
)
lock_path.write_text(lock, encoding="utf-8")
