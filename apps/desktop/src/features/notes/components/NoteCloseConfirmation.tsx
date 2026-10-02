import type React from 'react';

export function NoteCloseConfirmation({
  visible,
  created,
  isFinishing,
  isRepositioning,
  hasPendingRichOperation,
  hasUnsavedInk,
  storageWritable,
  onKeepEditing,
  onSaveAndClose,
  onDiscardAndClose,
}: {
  visible: boolean;
  created: boolean;
  isFinishing: boolean;
  isRepositioning: boolean;
  hasPendingRichOperation: boolean;
  hasUnsavedInk: boolean;
  storageWritable: boolean;
  onKeepEditing: () => void;
  onSaveAndClose: () => void;
  onDiscardAndClose: () => void;
}) {
  if (!visible) return null;

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    );
    if (event.shiftKey && document.activeElement === buttons[0]) {
      event.preventDefault();
      buttons.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
      event.preventDefault();
      buttons[0]?.focus();
    }
  };

  return (
    <div className="composer-discard-overlay">
      <div
        className="composer-discard-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="composer-close-title"
        aria-describedby="composer-close-detail"
        onKeyDown={trapFocus}
      >
        <strong id="composer-close-title">Close this note?</strong>
        <span id="composer-close-detail">
          {created
            ? 'Discard and close removes this new note and its files.'
            : 'Discard and close restores the previously saved note.'}
        </span>
        <div className="composer-discard-actions">
          <button type="button" autoFocus onClick={onKeepEditing}>
            Keep editing
          </button>
          <button
            type="button"
            className="primary"
            onClick={onSaveAndClose}
            disabled={
              isFinishing ||
              isRepositioning ||
              hasPendingRichOperation ||
              hasUnsavedInk ||
              !storageWritable
            }
          >
            Save and close
          </button>
          <button
            type="button"
            className="danger"
            onClick={onDiscardAndClose}
            disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
          >
            Discard and close
          </button>
        </div>
      </div>
    </div>
  );
}
