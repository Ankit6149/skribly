import { beforeEach, describe, expect, it } from 'vitest';
import { TargetWindowInfo } from '../lib/geometry';
import { useLicenseStore } from './licenseStore';
import { useSkribStore } from './skribStore';

const DEFAULT_METRICS = {
  overlay_physical_x: 0,
  overlay_physical_y: 0,
  overlay_physical_width: 1920,
  overlay_physical_height: 1080,
  dpi: 96,
  scale_factor: 1,
};

const BETA_LICENSE = {
  mode: 'beta' as const,
  enforcementEnabled: false,
  canWrite: true,
  trialDaysTotal: 7,
  trialDaysRemaining: 7,
  trialExpiresAt: null,
  deviceId: 'SKR-TEST',
  licensedEmail: null,
  updatesUntil: null,
  message: 'Free beta',
};

describe('skribStore', () => {
  beforeEach(() => {
    useLicenseStore.setState({
      status: BETA_LICENSE,
      isReady: true,
      isActivating: false,
      errorMessage: null,
    });
    useSkribStore.setState({
      activeTarget: null,
      availableWindows: [],
      skribs: [],
      overlayMetrics: DEFAULT_METRICS,
      initStatus: { type: 'Initializing' },
      isAmbiguous: false,
      isTauriAvailable: false,
      errorMessage: null,
      storageErrorMessage: null,
      storageNotice: null,
      storageWritable: true,
      storageRevision: 0,
      storageBackupDirectory: '',
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

  it('adds a new active skrib note with explicit lifecycle metadata', async () => {
    await useSkribStore.getState().bindTarget(sampleTarget);
    await useSkribStore.getState().addSkrib('Note test content', 'peach');

    const skribs = useSkribStore.getState().skribs;
    expect(skribs).toHaveLength(1);
    expect(skribs[0]!.text).toBe('Note test content');
    expect(skribs[0]!.color).toBe('peach');
    expect(skribs[0]!.deleted_at).toBeNull();
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

    expect(await useSkribStore.getState().setSkribCollapsed(noteId, false)).toBe(true);
    expect(useSkribStore.getState().skribs[0]!.collapsed).toBe(false);

    await useSkribStore.getState().updateSkribPosition(noteId, 100, 120, 350, 240);
    expect(useSkribStore.getState().skribs[0]!.rel_x).toBe(100);
    expect(useSkribStore.getState().skribs[0]!.rel_y).toBe(120);
    expect(useSkribStore.getState().skribs[0]!.width).toBe(350);
    expect(useSkribStore.getState().skribs[0]!.height).toBe(240);
  });

  it('removes a note from the active compact-editor collection when moving it to Trash', async () => {
    await useSkribStore.getState().addSkrib('Move me to Trash');
    const noteId = useSkribStore.getState().skribs[0]!.id;

    const moved = await useSkribStore.getState().trashSkrib(noteId);
    expect(moved).toBe(true);
    expect(useSkribStore.getState().skribs).toHaveLength(0);
  });

  it('discards a newly created empty note through its separate constrained path', async () => {
    await useSkribStore.getState().addSkrib();
    const noteId = useSkribStore.getState().skribs[0]!.id;

    const discarded = await useSkribStore.getState().discardEmptySkrib(noteId);
    expect(discarded).toBe(true);
    expect(useSkribStore.getState().skribs).toHaveLength(0);
  });

  it('keeps existing notes unchanged when the licence is read only', async () => {
    await useSkribStore.getState().addSkrib('Original text', 'yellow');
    const note = useSkribStore.getState().skribs[0]!;

    useLicenseStore.setState({
      status: {
        ...BETA_LICENSE,
        mode: 'expired',
        enforcementEnabled: true,
        canWrite: false,
        trialDaysRemaining: 0,
        message: 'Your seven-day trial has ended.',
      },
    });

    await useSkribStore.getState().updateSkribText(note.id, 'Should not appear');
    await useSkribStore.getState().trashSkrib(note.id);
    await useSkribStore.getState().discardEmptySkrib(note.id);
    await useSkribStore.getState().addSkrib('Should not be created');

    expect(useSkribStore.getState().skribs).toEqual([note]);
    expect(useSkribStore.getState().errorMessage).toBe('Your seven-day trial has ended.');
  });

  it('keeps existing notes unchanged when storage is read only', async () => {
    await useSkribStore.getState().addSkrib('Original text', 'yellow');
    const note = useSkribStore.getState().skribs[0]!;
    useSkribStore.setState({
      storageWritable: false,
      storageErrorMessage: 'Local note data needs recovery.',
    });

    const updated = await useSkribStore.getState().updateSkribText(note.id, 'Should not appear');
    const moved = await useSkribStore.getState().trashSkrib(note.id);
    const discarded = await useSkribStore.getState().discardEmptySkrib(note.id);

    expect(updated).toBe(false);
    expect(moved).toBe(false);
    expect(discarded).toBe(false);
    expect(useSkribStore.getState().skribs).toEqual([note]);
    expect(useSkribStore.getState().errorMessage).toBe('Local note data needs recovery.');
  });

  it('dismisses a recovery notice without changing storage health', () => {
    useSkribStore.setState({
      storageNotice: {
        message: 'Recovered notes.',
        source: 'backup1',
        revision: 2,
        migratedFromSchema: null,
        quarantinedFiles: [],
        backupDirectory: 'C:/Skribli',
      },
      storageWritable: true,
      storageRevision: 2,
    });

    useSkribStore.getState().dismissStorageNotice();
    expect(useSkribStore.getState().storageNotice).toBeNull();
    expect(useSkribStore.getState().storageWritable).toBe(true);
    expect(useSkribStore.getState().storageRevision).toBe(2);
  });

  it('creates a blank note when no initial text is supplied', async () => {
    await useSkribStore.getState().bindTarget(sampleTarget);
    await useSkribStore.getState().addSkrib();
    expect(useSkribStore.getState().skribs[0]!.text).toBe('');
  });

  it('does not create a feedback error when hit-test sync is skipped outside Tauri', async () => {
    await useSkribStore.getState().updateHitTestRects([{ x: 0, y: 0, width: 100, height: 100 }]);
    expect(useSkribStore.getState().errorMessage).toBeNull();
  });
});
