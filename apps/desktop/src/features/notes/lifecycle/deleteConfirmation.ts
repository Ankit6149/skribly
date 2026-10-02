export type DeleteConfirmationState = 'idle' | 'confirming';

export type DeleteConfirmationEvent =
  | 'request'
  | 'cancel'
  | 'delete-failed'
  | 'note-changed';

export const INITIAL_DELETE_CONFIRMATION_STATE: DeleteConfirmationState = 'idle';

export function reduceDeleteConfirmation(
  state: DeleteConfirmationState,
  event: DeleteConfirmationEvent
): DeleteConfirmationState {
  switch (event) {
    case 'request':
      return 'confirming';
    case 'cancel':
    case 'delete-failed':
    case 'note-changed':
      return 'idle';
    default: {
      const exhaustiveEvent: never = event;
      return exhaustiveEvent;
    }
  }
}
