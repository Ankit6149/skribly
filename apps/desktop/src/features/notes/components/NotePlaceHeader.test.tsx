// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NotePlaceHeader } from './NotePlaceHeader';
import type { NoteColor } from '../model/noteColors';

it('keeps the pill steady through rerenders, changes for new paper, and avoids the previous pill on reopening', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const container = document.createElement('div');
  document.body.append(container);
  let root = createRoot(container);
  const header = (color: NoteColor, label: string) => <React.StrictMode><NotePlaceHeader
    noteId="pill-reopen-test" noteColor={color} contextTabRef={null}
    contextLabel={label} contextFullAppLabel="Code" appIconUrl={null}
    isNewNote={false} hasSavedContext placeDetailOpen={false} onPlaceDetailOpen={() => undefined}
  /></React.StrictMode>;
  const pill = () => container.querySelector('.composer-context-tab')!.getAttribute('data-pill-color');
  try {
    await act(async () => root.render(header('yellow', 'Project')));
    const first = pill();
    await act(async () => root.render(header('yellow', 'Project renamed')));
    expect(pill()).toBe(first);
    await act(async () => root.render(header('indigo', 'Project renamed')));
    expect(pill()).not.toBe(first);
    const beforeClosing = pill();
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(header('indigo', 'Project renamed')));
    expect(pill()).not.toBe(beforeClosing);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  }
});
