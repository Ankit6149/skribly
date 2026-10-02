import { beforeEach, describe, expect, it } from 'vitest';
import { useSkribUiStore } from './skribUiStore';

describe('skribUiStore', () => {
  beforeEach(() => {
    useSkribUiStore.setState({
      composerNoteId: null,
      composerMode: 'type',
    });
  });

  it('opens the exact focused composer note', () => {
    useSkribUiStore.getState().openComposer('note-a', 'write');

    expect(useSkribUiStore.getState().composerNoteId).toBe('note-a');
    expect(useSkribUiStore.getState().composerMode).toBe('write');
  });

  it('closes the composer without retaining a retired preview or widget state', () => {
    useSkribUiStore.getState().openComposer('note-a');
    useSkribUiStore.getState().closeComposer();

    expect(useSkribUiStore.getState().composerNoteId).toBeNull();
    expect(useSkribUiStore.getState().composerMode).toBe('type');
  });
});
