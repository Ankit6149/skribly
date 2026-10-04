import type { ResizeDirection } from '../model/noteSurfaceTypes';
import { useState } from 'react';

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
  onKeyboardResize,
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
  onKeyboardResize?: (key: string, largeStep: boolean) => void;
}) {
  const [resizeMode, setResizeMode] = useState<ResizeDirection | null>(null);
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
          title="Drag to resize. Keyboard: Enter, then arrows; Escape to finish."
          aria-describedby="composer-resize-instructions"
          aria-pressed={resizeMode === direction}
          disabled={isFinishing || hasPendingRichOperation || hasUnsavedInk || deleteConfirming || cancelConfirmationOpen}
          onBlur={() => setResizeMode(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault(); event.stopPropagation();
              setResizeMode((active) => active === direction ? null : direction);
            } else if (resizeMode === direction && event.key.startsWith('Arrow')) {
              event.preventDefault(); event.stopPropagation();
              onKeyboardResize?.(event.key, event.shiftKey);
            } else if (resizeMode === direction && event.key === 'Escape') {
              event.preventDefault(); event.stopPropagation(); setResizeMode(null);
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            onResize(direction);
          }}
        />
      ))}
      <span id="composer-resize-instructions" className="sr-only">Press Enter to resize. Left and right change width; up and down change height. Hold Shift for a larger step. Escape finishes resizing.</span>
      <span className="sr-only" role="status">{resizeMode ? 'Keyboard resize active' : ''}</span>
    </>
  );
}
