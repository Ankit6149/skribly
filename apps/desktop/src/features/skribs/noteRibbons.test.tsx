// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkribComposer } from './SkribComposer';
import type { SkribNote } from '../../lib/geometry';

vi.mock('../../stores/licenseStore', () => ({ useLicenseStore: (select: (state: unknown) => unknown) => select({ status: { enforcementEnabled: false, canWrite: true } }) }));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined), listen: vi.fn(async () => () => undefined) }));
// These tests exercise ribbon/focus ownership, not a simulated drawing surface.
vi.mock('./InkCanvas', () => ({ InkCanvas: () => null }));
vi.mock('../../lib/richContentStore', async (original) => ({
  ...await original<typeof import('../../lib/richContentStore')>(),
  getRichContent: vi.fn(async () => ({ attachments: [], view: { textSize: 'medium' } })),
  getInkForNote: vi.fn(async () => ({ strokes: [] })),
  replaceRichTextForNote: vi.fn(async () => undefined),
}));
const note: SkribNote = { id: 'ribbon-test', target_process_name: 'chrome.exe', target_title: 'GitHub · Issue', rel_x: 0, rel_y: 0, width: 560, height: 440, text: '', color: 'yellow', collapsed: false, created_at: 1, updated_at: 1 };
let root: Root; let container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<SkribComposer note={note} target={null} openAction="created" />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(label: string) {
  await act(async () => (container.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click());
}

describe('note icon ribbons', () => {
  it('opens labelled icon actions from Add and closes them on a second click', async () => {
    await click('Add or mark this Skrib');
    for (const label of ['Draw on this note', 'Attach a photo, video or file', 'Add a checklist', 'Set a reminder']) {
      const button = container.querySelector(`[aria-label="${label}"]`)!;
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.querySelector('span')?.textContent).not.toBe('');
    }
    await click('Add or mark this Skrib');
    expect(container.querySelector('.composer-intent-tray')).toBeNull();
  });
  it('reveals the paper palette on click and dismisses it one layer at a time', async () => {
    await click('More note actions');
    expect(container.querySelector('[aria-label="Undo last edit"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Redo last edit"]')).not.toBeNull();
    const palette = container.querySelector('[aria-label="Paper colour"]')!;
    await act(async () => (palette as HTMLButtonElement).click());
    expect(container.querySelectorAll('.composer-color-popover button')).toHaveLength(8);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('.composer-color-popover')).toBeNull();
    expect(container.querySelector('.composer-note-menu')).not.toBeNull();
    expect(document.activeElement).toBe(palette);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[aria-label="Undo last edit"]')).toBeNull();
    expect(container.querySelector('.composer-note-menu')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('More note actions');
  });
  it('keeps only one primary ribbon open and dismisses it when writing resumes', async () => {
    await click('More note actions');
    await click('Add or mark this Skrib');
    expect(container.querySelector('.composer-note-menu')).toBeNull();
    expect(container.querySelector('.composer-intent-tray')).not.toBeNull();
    await act(async () => container.querySelector('[role="textbox"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(container.querySelector('.composer-intent-tray')).toBeNull();
  });
});
