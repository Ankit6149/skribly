import { beforeEach, describe, expect, it } from 'vitest';
import { TargetWindowInfo } from '../lib/geometry';
import { useSkribStore } from './skribStore';

const DEFAULT_METRICS = {
  overlay_physical_x: 0,
  overlay_physical_y: 0,
  overlay_physical_width: 1920,
  overlay_physical_height: 1080,
  dpi: 96,
  scale_factor: 1,
};

describe('skribStore', () => {
  beforeEach(() => {
    useSkribStore.setState({
      activeTarget: null,
      availableWindows: [],
      skribs: [],
      overlayMetrics: DEFAULT_METRICS,
      initStatus: { type: 'Initializing' },
      isPickingTarget: false,
      isAmbiguous: false,
      isTauriAvailable: false,
      errorMessage: null,
    });
  });

  const sampleTarget: TargetWindowInfo = {
    hwnd_val: 12345,
    title: 'Untitled - Notepad',
    process_name: 'notepad.exe',
    class_name: 'Notepad',
    bounds: { x: 100, y: 100, width: 800, height: 600 },
    is_minimized: false,
    is_focused: true,
    dpi: 96,
    scale_factor: 1,
  };

  it('binds target window correctly', async () => {
    await useSkribStore.getState().bindTarget(sampleTarget);
    expect(useSkribStore.getState().activeTarget).toEqual(sampleTarget);
  });

  it('adds a new skrib note', async () => {
    await useSkribStore.getState().bindTarget(sampleTarget);
    await useSkribStore.getState().addSkrib('Note test content', 'peach');

    const skribs = useSkribStore.getState().skribs;
    expect(skribs).toHaveLength(1);
    expect(skribs[0]!.text).toBe('Note test content');
    expect(skribs[0]!.color).toBe('peach');
  });

  it('updates position, text, color, and collapse state', async () => {
    await useSkribStore.getState().addSkrib('Original text', 'yellow');
    const noteId = useSkribStore.getState().skribs[0]!.id;

    await useSkribStore.getState().updateSkribText(noteId, 'Updated text');
    expect(useSkribStore.getState().skribs[0]!.text).toBe('Updated text');

    await useSkribStore.getState().updateSkribColor(noteId, 'mint');
    expect(useSkribStore.getState().skribs[0]!.color).toBe('mint');

    await useSkribStore.getState().toggleSkribCollapse(noteId);
    expect(useSkribStore.getState().skribs[0]!.collapsed).toBe(true);

    await useSkribStore.getState().updateSkribPosition(noteId, 100, 120, 350, 240);
    expect(useSkribStore.getState().skribs[0]!.rel_x).toBe(100);
    expect(useSkribStore.getState().skribs[0]!.rel_y).toBe(120);
    expect(useSkribStore.getState().skribs[0]!.width).toBe(350);
    expect(useSkribStore.getState().skribs[0]!.height).toBe(240);
  });

  it('deletes a skrib note', async () => {
    await useSkribStore.getState().addSkrib('To be deleted');
    const noteId = useSkribStore.getState().skribs[0]!.id;

    await useSkribStore.getState().deleteSkrib(noteId);
    expect(useSkribStore.getState().skribs).toHaveLength(0);
  });

  it('opens target selection when no target is bound', () => {
    useSkribStore.setState({ activeTarget: null, isPickingTarget: false });
    useSkribStore.getState().setPickingTarget(true);
    expect(useSkribStore.getState().isPickingTarget).toBe(true);
  });

  it('does not create a feedback error when hit-test sync is skipped outside Tauri', async () => {
    await useSkribStore.getState().updateHitTestRects([{ x: 0, y: 0, width: 100, height: 100 }]);
    expect(useSkribStore.getState().errorMessage).toBeNull();
  });
});
