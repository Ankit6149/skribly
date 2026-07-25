import { beforeEach, describe, expect, it } from 'vitest';
import { useSkribUiStore } from './skribUiStore';

describe('skribUiStore', () => {
  beforeEach(() => {
    useSkribUiStore.setState({
      previewNoteId: null,
      composerNoteId: null,
      composerMode: 'type',
      isNotesWidgetOpen: false,
      widgetNoteId: null,
    });
  });

  it('moves from dot to preview without opening the composer', () => {
    useSkribUiStore.getState().openPreview('note-a');
    expect(useSkribUiStore.getState().previewNoteId).toBe('note-a');
    expect(useSkribUiStore.getState().composerNoteId).toBeNull();
  });

  it('opens the focused composer and closes the preview', () => {
    useSkribUiStore.getState().openPreview('note-a');
    useSkribUiStore.getState().openComposer('note-a', 'write');

    expect(useSkribUiStore.getState().previewNoteId).toBeNull();
    expect(useSkribUiStore.getState().composerNoteId).toBe('note-a');
    expect(useSkribUiStore.getState().composerMode).toBe('write');
  });

  it('tracks widget visibility and selected note', () => {
    useSkribUiStore.getState().openNotesWidget('note-b');
    expect(useSkribUiStore.getState().isNotesWidgetOpen).toBe(true);
    expect(useSkribUiStore.getState().widgetNoteId).toBe('note-b');

    useSkribUiStore.getState().closeNotesWidget();
    expect(useSkribUiStore.getState().isNotesWidgetOpen).toBe(false);
  });
});
