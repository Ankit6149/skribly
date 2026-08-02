import { describe, expect, it } from 'vitest';
import {
  INITIAL_DELETE_CONFIRMATION_STATE,
  reduceDeleteConfirmation,
} from './deleteConfirmation';

describe('delete confirmation state', () => {
  it('requires an explicit request before entering the destructive state', () => {
    expect(INITIAL_DELETE_CONFIRMATION_STATE).toBe('idle');
    expect(reduceDeleteConfirmation('idle', 'request')).toBe('confirming');
  });

  it.each(['cancel', 'delete-failed', 'note-changed'] as const)(
    'returns to a safe idle state after %s',
    (event) => {
      expect(reduceDeleteConfirmation('confirming', event)).toBe('idle');
    }
  );

  it('does not make repeated delete requests bypass confirmation', () => {
    expect(reduceDeleteConfirmation('confirming', 'request')).toBe('confirming');
  });
});
