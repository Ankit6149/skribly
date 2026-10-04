// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SkribComposer } from './SkribComposer';
import { getRichContent, replaceInkForNote } from './persistence/richContentStore';
import type { SkribNote } from './model/noteTypes';
import { useSkribStore } from './state/skribStore';

const nativeListeners = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => unknown>());
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined), listen: vi.fn(async (name, callback) => {
  nativeListeners.set(name, callback); return () => nativeListeners.delete(name);
}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ scaleFactor: async () => 1, onResized: async () => () => undefined }) }));
vi.mock('../licensing/state/licenseStore', () => ({ useLicenseStore: (select: (state: unknown) => unknown) => select({ status: { enforcementEnabled: false, canWrite: true } }) }));
vi.mock('../reminders/persistence/reminderStore', async (original) => ({ ...await original<typeof import('../reminders/persistence/reminderStore')>(), listReminders: vi.fn(async () => []) }));
vi.mock('./persistence/richContentStore', async (original) => {
  const module = await original<typeof import('./persistence/richContentStore')>();
  const repository = module.createRichContentRepository(module.createMemoryRichContentPersistence());
  return { ...module, getRichContent: repository.get, getInkForNote: repository.getInk,
    replaceInkForNote: vi.fn(repository.replaceInk), replaceRichTextForNote: vi.fn(repository.replaceRichText) };
});

function pointer(canvas: HTMLCanvasElement, type: string, x: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, pointerType: 'pen', button: 0, clientX: x, clientY: 40, pressure: 0.5 });
  canvas.dispatchEvent(event);
}
const noteFor = (id: string): SkribNote => ({ id, target_process_name: 'Code.exe', target_title: 'Synthetic fixture',
  rel_x: 0, rel_y: 0, width: 520, height: 500, text: 'Saved words', color: 'peach', collapsed: false, created_at: 1, updated_at: 1 });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useSkribStore.setState({ isTauriAvailable: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const context = { clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON() {} });
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false });
  vi.mocked(invoke).mockClear();
});
afterEach(() => { useSkribStore.setState({ isTauriAvailable: false }); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('composer native ink acknowledgements', () => {
  it('rejects a stalled drawing before native timeout and never acknowledges its late write as saved', async () => {
    const container = document.createElement('div'); const root = createRoot(container); const note = noteFor('native-stalled-ink');
    const actualReplace = vi.mocked(replaceInkForNote).getMockImplementation()!;
    let allowWrite!: () => void;
    vi.mocked(replaceInkForNote).mockImplementationOnce(async (id, strokes) => {
      await new Promise<void>((resolve) => { allowWrite = resolve; }); return actualReplace(id, strokes);
    });
    try {
      await act(async () => root.render(<SkribComposer note={note} target={null} openAction="reopened" />));
      vi.useFakeTimers();
      let prepare!: Promise<unknown>;
      await act(async () => {
        pointer(container.querySelector('canvas')!, 'pointerdown', 20);
        prepare = nativeListeners.get('skribly://prepare-native-transition')!({ payload: { noteId: note.id, requestId: 'ink-stalled', reason: 'close' } }) as Promise<unknown>;
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(3500); await prepare; });
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'ink-stalled', saved: false }));
      expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('true');
      expect(container.textContent).toContain('1 strokes');
      await act(async () => { allowWrite(); });
      expect((await getRichContent(note.id)).inkDocument!.strokes).toHaveLength(1);
      expect(invoke).not.toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'ink-stalled', saved: true }));
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
  it('acknowledges close only after the active stroke is durable and remains quiescent until outcome', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
    const note = noteFor('native-active-ink');
    const actualReplace = vi.mocked(replaceInkForNote).getMockImplementation()!;
    let allowWrite!: () => void;
    vi.mocked(replaceInkForNote).mockImplementationOnce(async (id, strokes) => {
      await new Promise<void>((resolve) => { allowWrite = resolve; });
      return actualReplace(id, strokes);
    });
    try {
      await act(async () => root.render(<SkribComposer note={note} target={null} openAction="reopened" />));
      let prepare!: Promise<unknown>;
      await act(async () => {
        const canvas = container.querySelector('canvas')!;
        pointer(canvas, 'pointerdown', 20); pointer(canvas, 'pointermove', 50);
        prepare = nativeListeners.get('skribly://prepare-native-transition')!({ payload: { noteId: note.id, requestId: 'ink-close', reason: 'close' } }) as Promise<unknown>;
        pointer(canvas, 'pointerup', 80);
      });
      expect(invoke).not.toHaveBeenCalledWith('acknowledge_native_transition', expect.anything());
      expect(vi.mocked(replaceInkForNote).mock.calls.at(-1)![1][0]!.points.map((point) => point.x)).toEqual([0.2, 0.5]);
      await act(async () => { allowWrite(); await prepare; });
      expect((await getRichContent(note.id)).inkDocument!.strokes).toHaveLength(1);
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'ink-close', saved: true }));
      expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('false');
      await act(async () => nativeListeners.get('skribly://native-transition-finished')!({ payload: { noteId: note.id, requestId: 'ink-close', completed: false } }));
      expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('true');
    } finally { await act(async () => root.unmount()); container.remove(); }
  });

  it('rejects failed ink durability and retains the drawing for retry', async () => {
    const container = document.createElement('div'); const root = createRoot(container); const note = noteFor('native-failed-ink');
    const actualReplace = vi.mocked(replaceInkForNote).getMockImplementation()!;
    vi.mocked(replaceInkForNote).mockImplementation(async () => { throw new Error('quota exhausted'); });
    try {
      await act(async () => root.render(<SkribComposer note={note} target={null} openAction="reopened" />));
      await act(async () => {
        pointer(container.querySelector('canvas')!, 'pointerdown', 20);
        await nativeListeners.get('skribly://prepare-native-transition')!({ payload: { noteId: note.id, requestId: 'ink-failed', reason: 'quit' } });
      });
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'ink-failed', saved: false }));
      expect(container.textContent).toContain('quota exhausted');
      expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('true');
      expect((await getRichContent(note.id)).inkDocument?.strokes ?? []).toHaveLength(0);
      vi.mocked(replaceInkForNote).mockImplementation(actualReplace);
      await act(async () => nativeListeners.get('skribly://prepare-native-transition')!({ payload: { noteId: note.id, requestId: 'ink-retry', reason: 'quit' } }));
      expect(invoke).toHaveBeenCalledWith('acknowledge_native_transition', expect.objectContaining({ requestId: 'ink-retry', saved: true }));
      expect((await getRichContent(note.id)).inkDocument!.strokes).toHaveLength(1);
    } finally { vi.mocked(replaceInkForNote).mockImplementation(actualReplace); await act(async () => root.unmount()); container.remove(); }
  });
});
