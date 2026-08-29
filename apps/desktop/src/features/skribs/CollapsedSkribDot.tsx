import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import type { SkribNote } from '../../lib/geometry';
import { useSkribStore } from '../../stores/skribStore';

interface CollapsedSkribDotProps {
  note: SkribNote;
}

type CollapsedSkribError = {
  action: 'open' | 'dismiss';
  message: 'Could not reopen' | 'Could not hide';
};

type InvokeNativeCommand = (
  command: string,
  args?: Record<string, unknown>
) => Promise<unknown>;

export type DismissCollapsedSkribResult =
  | { ok: true }
  | { ok: false; message: 'Could not hide' };

export async function dismissCollapsedSkribWindow(
  id: string,
  invokeCommand: InvokeNativeCommand = invoke
): Promise<DismissCollapsedSkribResult> {
  try {
    await invokeCommand('dismiss_collapsed_skrib_window', { id });
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not hide' };
  }
}

export const CollapsedSkribDot: React.FC<CollapsedSkribDotProps> = ({ note }) => {
  const setSkribCollapsed = useSkribStore((state) => state.setSkribCollapsed);
  const [isOpening, setIsOpening] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<CollapsedSkribError | null>(null);

  const expand = async () => {
    if (isOpening || isDismissing) return;
    setIsOpening(true);
    setError(null);
    try {
      const opened = await setSkribCollapsed(note.id, false);
      if (opened) return;
      setError({ action: 'open', message: 'Could not reopen' });
    } catch {
      setError({ action: 'open', message: 'Could not reopen' });
    } finally {
      setIsOpening(false);
    }
  };

  const dismiss = async () => {
    if (isOpening || isDismissing) return;
    setIsDismissing(true);
    setError(null);
    try {
      const result = await dismissCollapsedSkribWindow(note.id);
      if (!result.ok) setError({ action: 'dismiss', message: result.message });
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="collapsed-skrib-surface" data-overlay-surface="collapsed">
      <section
        className={`collapsed-skrib-dot skrib-color-${note.color}`}
        data-error={error?.action}
        data-opening={isOpening || undefined}
        aria-label="Collapsed Skrib. Drag the pastel bubble to move it, select its centre to reopen it, or use the close badge to hide it."
        title="Drag the pastel bubble to move · select its centre to reopen"
      >
        <span className="collapsed-skrib-bubble" aria-hidden="true" />
        <span
          className="collapsed-skrib-drag-zone collapsed-skrib-drag-top"
          data-tauri-drag-region
          aria-hidden="true"
        />
        <span
          className="collapsed-skrib-drag-zone collapsed-skrib-drag-left"
          data-tauri-drag-region
          aria-hidden="true"
        />
        <span
          className="collapsed-skrib-drag-zone collapsed-skrib-drag-right"
          data-tauri-drag-region
          aria-hidden="true"
        />
        <span
          className="collapsed-skrib-drag-zone collapsed-skrib-drag-bottom"
          data-tauri-drag-region
          aria-hidden="true"
        />
        <button
          type="button"
          className="collapsed-skrib-open"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => void expand()}
          disabled={isOpening || isDismissing}
          aria-describedby={error?.action === 'open' ? 'collapsed-skrib-error' : undefined}
          aria-label={isOpening ? 'Reopening this Skrib' : 'Reopen this Skrib'}
          aria-busy={isOpening}
          title={error?.action === 'open' ? error.message : 'Reopen this Skrib'}
        />
        <button
          type="button"
          className="collapsed-skrib-dismiss"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void dismiss();
          }}
          disabled={isOpening || isDismissing}
          aria-describedby={error?.action === 'dismiss' ? 'collapsed-skrib-error' : undefined}
          aria-label="Hide this floating Skrib"
          title={error?.action === 'dismiss' ? error.message : 'Hide this floating Skrib'}
        >
          <X size={9} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </section>
      {error && (
        <span id="collapsed-skrib-error" className="sr-only" role="alert">
          {error.message}
        </span>
      )}
    </div>
  );
};
