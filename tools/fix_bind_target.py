from pathlib import Path

path = Path("apps/desktop/src/stores/skribStore.ts")
source = path.read_text(encoding="utf-8")
old = "  bindTarget: async (target: TargetWindowInfo | null) => {\n    if (!get().isTauriAvailable) return;\n"
new = "  bindTarget: async (target: TargetWindowInfo | null) => {\n    set({ activeTarget: target, isAmbiguous: false });\n    if (!get().isTauriAvailable) return;\n"
if old not in source:
    if new in source:
        raise SystemExit(0)
    raise SystemExit("Expected bindTarget block was not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
