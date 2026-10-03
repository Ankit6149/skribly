// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceRichTextForNote } from './persistence/richContentStore';
import { SkribComposer } from './SkribComposer';
import type { SkribNote } from './model/noteTypes';

vi.mock('../licensing/state/licenseStore', () => ({ useLicenseStore: (select: (state: unknown) => unknown) => select({ status: { enforcementEnabled: false, canWrite: true } }) }));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(async () => undefined), listen: vi.fn(async () => () => undefined) }));
vi.mock('../reminders/persistence/reminderStore', async (original) => ({
  ...await original<typeof import('../reminders/persistence/reminderStore')>(),
  listReminders: vi.fn(async () => []),
}));
// These tests exercise ribbon/focus ownership, not a simulated drawing surface.
vi.mock('./components/InkCanvas', () => ({ InkCanvas: () => null }));
vi.mock('./persistence/richContentStore', async (original) => ({
  ...await original<typeof import('./persistence/richContentStore')>(),
  getRichContent: vi.fn(async () => ({ attachments: [], view: { textSize: 'medium' } })),
  getInkForNote: vi.fn(async () => ({ strokes: [] })),
  replaceRichTextForNote: vi.fn(async () => undefined),
}));
const note: SkribNote = { id: 'ribbon-test', target_process_name: 'chrome.exe', target_title: 'GitHub · Issue', rel_x: 0, rel_y: 0, width: 560, height: 440, text: '', color: 'yellow', collapsed: false, created_at: 1, updated_at: 1 };
let root: Root; let container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<React.StrictMode><SkribComposer note={note} target={null} openAction="created" /></React.StrictMode>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(label: string) {
  await act(async () => (container.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click());
}

describe('note icon ribbons', () => {
  it('accepts and saves typing after the actual StrictMode effect replay', async () => {
    const editor = container.querySelector('[role="textbox"]') as HTMLDivElement;
    await act(async () => {
      editor.innerHTML = '<p>StrictMode draft</p>';
      editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
    });
    expect(editor.textContent).toBe('StrictMode draft');
    expect(container.textContent).not.toContain('already closing');
    await act(async () => editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(replaceRichTextForNote).toHaveBeenCalledWith(note.id, { html: '<p>StrictMode draft</p>', plainText: 'StrictMode draft' });
  });

  it('keeps the newer formatting draft when an older component write fails', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(replaceRichTextForNote).mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; }));
    const editor = container.querySelector('[role="textbox"]') as HTMLDivElement;
    await act(async () => {
      editor.innerHTML = '<p><strong>A</strong></p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await act(async () => {
      editor.innerHTML = '<p><em>B</em></p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      reject(new Error('Synthetic quota fault'));
    });
    expect(editor.innerHTML).toBe('<p><em>B</em></p>');
    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry saving')!;
    expect(retry).toBeTruthy();
    await act(async () => retry.click());
    expect(replaceRichTextForNote).toHaveBeenLastCalledWith(note.id, { html: '<p><em>B</em></p>', plainText: 'B' });
  });

  it('opens close choices in a modal and returns focus when editing continues', async () => {
    const close = container.querySelector('[aria-label="Close note options"]') as HTMLButtonElement;
    expect(close.disabled).toBe(false);
    await act(async () => close.click());
    const dialog = container.querySelector('[role="alertdialog"]') as HTMLDivElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.closest('.composer-discard-overlay')).not.toBeNull();
    expect(Array.from(dialog.querySelectorAll('button')).map((button) => button.textContent?.trim()))
      .toEqual(['Keep editing', 'Save and close', 'Discard and close']);
    expect(document.activeElement?.textContent).toBe('Keep editing');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(close);
  });

  it('opens labelled icon actions from Add and closes them on a second click', async () => {
    await click('Add or mark this Skrib');
    for (const label of ['Attach a photo, video or file', 'Add a checklist']) {
      const button = container.querySelector(`[aria-label="${label}"]`)!;
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.querySelector('span')?.textContent).not.toBe('');
    }
    expect(container.querySelector('.composer-intent-tray [aria-label="Set a reminder"]')).toBeNull();
    await click('Add or mark this Skrib');
    expect(container.querySelector('.composer-intent-tray')).toBeNull();
  });
  it('places colour and reminder in the header, with explicit text sizes in the labelled menu', async () => {
    expect(container.querySelector('.composer-side-tools [aria-label="Set a reminder"]')).not.toBeNull();
    const palette = container.querySelector('[aria-label="Paper colour"]')!;
    await act(async () => (palette as HTMLButtonElement).click());
    expect(container.querySelectorAll('.composer-color-popover button')).toHaveLength(8);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('.composer-color-popover')).toBeNull();
    expect(document.activeElement).toBe(palette);
    await click('More note actions');
    const menu = container.querySelector('.composer-note-menu')!;
    expect(menu.textContent).toContain('Expand note');
    expect(menu.textContent).toContain('Move to Trash');
    expect(menu.querySelector('[aria-label="Set a reminder"]')).toBeNull();
    expect(menu.querySelectorAll('.composer-size-options button')).toHaveLength(3);
    expect(menu.querySelector('[aria-label="medium text"]')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('.composer-note-menu')).toBeNull();
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
