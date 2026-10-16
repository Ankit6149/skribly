// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NoteCloseConfirmation } from './NoteCloseConfirmation';
import { NoteDeleteConfirmation } from './NoteDeleteConfirmation';

it('Escape recovers editing and cancels Trash without choosing a destructive action', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT:true });
  const host=document.createElement('div'); document.body.append(host);
  const root=createRoot(host);
  const keep=vi.fn(), discard=vi.fn(), save=vi.fn(), cancel=vi.fn(), remove=vi.fn();
  try {
    await act(async () => root.render(<NoteCloseConfirmation visible created={false} isFinishing={false}
      isRepositioning={false} hasPendingRichOperation={false} hasUnsavedInk={false} storageWritable
      onKeepEditing={keep} onSaveAndClose={save} onDiscardAndClose={discard} />));
    await act(async () => host.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(keep).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled();
    const renderDelete=async (isFinishing:boolean) => {
      await act(async () => root.render(<NoteDeleteConfirmation visible isFinishing={isFinishing}
        hasPendingRichOperation={false} hasUnsavedInk={false} onCancel={cancel} onConfirm={remove} />));
      await act(async () => host.querySelector('[role="alert"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    };
    await renderDelete(false); expect(cancel).toHaveBeenCalledOnce(); expect(remove).not.toHaveBeenCalled();
    await renderDelete(true); expect(cancel).toHaveBeenCalledOnce(); expect(remove).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
