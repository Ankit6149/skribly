import React, { useState } from 'react';
import type { SkribNote } from '../../lib/geometry';
import { useSkribStore } from '../../stores/skribStore';

interface CollapsedSkribDotProps {
  note: SkribNote;
}

export const CollapsedSkribDot: React.FC<CollapsedSkribDotProps> = ({ note }) => {
  const setSkribCollapsed = useSkribStore((state) => state.setSkribCollapsed);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expand = async () => {
    if (isOpening) return;
    setIsOpening(true);
    setError(null);
    const opened = await setSkribCollapsed(note.id, false);
    if (!opened) {
      setError('Could not reopen');
      setIsOpening(false);
    }
  };

  return (
    <div className="collapsed-skrib-surface">
      <section
        className={`collapsed-skrib-dot skrib-color-${note.color}`}
        data-tauri-drag-region
        aria-label="Collapsed Skrib. Drag the outer edge to move it, or activate the centre to reopen it."
        title="Drag to move · click to reopen"
      >
        <span className="collapsed-skrib-drag-ring" data-tauri-drag-region aria-hidden="true" />
        <button
          type="button"
          className="collapsed-skrib-open"
          onClick={() => void expand()}
          disabled={isOpening}
          aria-label="Reopen this Skrib"
          title="Reopen Skrib"
        >
          <span aria-hidden="true">{isOpening ? '…' : 'S'}</span>
        </button>
      </section>
      {error && <span className="collapsed-skrib-error" role="alert">{error}</span>}
    </div>
  );
};
