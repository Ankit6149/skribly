import type { ResizeDirection } from '../model/noteSurfaceTypes';

const RESIZE_DIRECTIONS: ResizeDirection[] = [
  'NorthWest',
  'NorthEast',
  'SouthWest',
  'SouthEast',
];

export function NoteWindowControls({
  storageWritable,
  detached,
  isFinishing,
  isRepositioning,
  hasPendingRichOperation,
  hasUnsavedInk,
  deleteConfirming,
  cancelConfirmationOpen,
  onFinish,
  onResize,
}: {
  storageWritable: boolean;
  detached: boolean;
  isFinishing: boolean;
  isRepositioning: boolean;
  hasPendingRichOperation: boolean;
  hasUnsavedInk: boolean;
  deleteConfirming: boolean;
  cancelConfirmationOpen: boolean;
  onFinish: () => void;
  onResize: (direction: ResizeDirection) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="composer-put-away-fold"
        onClick={onFinish}
        disabled={
          isFinishing ||
          isRepositioning ||
          hasPendingRichOperation ||
          hasUnsavedInk ||
          deleteConfirming ||
          cancelConfirmationOpen
        }
        aria-label={
          storageWritable
            ? detached
              ? 'Done — save and close this Skrib'
              : 'Done — save and put this Skrib away'
            : 'Storage recovery required'
        }
        title={storageWritable ? 'Done — save and put away' : 'Storage recovery required'}
      >
        {isFinishing ? <span className="composer-button-spinner" aria-hidden="true" /> : 'Done'}
      </button>
      {RESIZE_DIRECTIONS.map((direction) => (
        <button
          key={direction}
          type="button"
          className={`composer-resize-handle ${direction.toLowerCase()}`}
          aria-label={`Resize this Skrib from the ${direction
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .toLowerCase()} corner`}
          title="Drag this corner until the Skrib feels right"
          onPointerDown={(event) => {
            event.preventDefault();
            onResize(direction);
          }}
        />
      ))}
    </>
  );
}
