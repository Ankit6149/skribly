export function NoteDeleteConfirmation({
  visible,
  isFinishing,
  hasPendingRichOperation,
  hasUnsavedInk,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  isFinishing: boolean;
  hasPendingRichOperation: boolean;
  hasUnsavedInk: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      className="composer-delete-confirmation composer-attached-confirmation"
      role="alert"
      aria-live="assertive"
    >
      <div className="composer-delete-copy">
        <strong>Move this note to Trash?</strong>
        <small id="composer-delete-warning">
          You can restore it from All Skribs for 30 days.
        </small>
      </div>
      <div className="composer-footer-actions">
        <button type="button" className="secondary" autoFocus disabled={isFinishing} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="danger-confirm"
          disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk}
          onClick={onConfirm}
        >
          {isFinishing ? 'Moving…' : 'Move to Trash'}
        </button>
      </div>
    </div>
  );
}
