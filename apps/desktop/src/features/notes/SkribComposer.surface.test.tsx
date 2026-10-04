import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkribComposer } from './SkribComposer';
import { InkCanvas } from './components/InkCanvas';
import type { SkribNote } from './model/noteTypes';

const note: SkribNote = {
  id: 'paper-test', target_process_name: 'chrome.exe', target_title: 'GitHub · Issue #203',
  rel_x: 0, rel_y: 0, width: 560, height: 440, text: 'A quiet thought',
  color: 'yellow', collapsed: false, created_at: 1, updated_at: 1,
};

describe('Living Paper note structure', () => {
  it('keeps the area outside the selected paper transparent', () => {
    const html = renderToStaticMarkup(<SkribComposer note={{ ...note, color: 'rose' }} target={null} openAction="reopened" />);
    expect(html).toContain('class="skrib-composer-backdrop"');
    expect(html).toContain('class="skrib-composer skrib-color-rose"');
  });

  it('keeps the paper quiet until tools are requested', () => {
    const html = renderToStaticMarkup(<SkribComposer note={note} target={null} openAction="reopened" />);
    expect(html).toContain('GitHub · Issue #203');
    expect(html).toContain('Place: GitHub · Issue #203');
    expect(html).toContain('>Chrome</strong>');
    expect(html).toContain('aria-label="More note actions"');
    expect(html).toContain('id="composer-place-detail"');
    expect(html).toContain('aria-controls="composer-add-options"');
    expect(html).not.toContain('class="composer-format-bar"');
    expect(html).not.toContain('class="composer-note-menu"');
    expect(html).not.toContain('class="composer-intent-tray"');
    expect(html).not.toContain('class="composer-footer"');
  });

  it('keeps a general Skrib independent from whichever app is currently focused', () => {
    const generalNote = { ...note, target_process_name: '', target_title: '' };
    const focusedApp = {
      hwnd_val: 42,
      process_name: 'chrome.exe',
      title: 'Unrelated browser tab',
      class_name: 'Chrome_WidgetWin_1',
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      is_minimized: false,
      is_focused: true,
      dpi: 96,
      scale_factor: 1,
    };
    const html = renderToStaticMarkup(
      <SkribComposer note={generalNote} target={focusedApp} openAction="detached" />
    );

    expect(html).toContain('aria-label="View general note"');
    expect(html).toContain('opened this general Skrib without an application context');
    expect(html).not.toContain('class="composer-context-tab"');
    expect(html).not.toContain('id="composer-place-detail"');
    expect(html).not.toContain('Place: Unrelated browser tab');
  });

  it.each(['created', 'reopened', 'detached'] as const)('keeps Done labelled and manual resizing available for %s notes', (openAction) => {
    const html = renderToStaticMarkup(<SkribComposer note={note} target={null} openAction={openAction} />);
    expect(html).toContain(openAction === 'detached' ? 'Done — save and close this Skrib' : 'Done — save and put this Skrib away');
    expect(html).toMatch(/class="composer-put-away-fold"[^>]*>Done<\/button>/);
    expect(html.match(/aria-label="Resize this Skrib from/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Skrib text"');
    expect(html).toContain(openAction === 'created' ? 'created a new empty Skrib' : 'reopened the existing Skrib');
  });

  it('offers a direct way back to writing from the drawing toolbar', () => {
    const html = renderToStaticMarkup(<InkCanvas variant="overlay" onFinishDrawing={() => undefined} />);
    expect(html).toContain('aria-label="Finish drawing and return to text"');
    expect(html).toContain('aria-label="Undo last stroke"');
    expect(html).toContain('aria-label="Ink color"');
  });
});
