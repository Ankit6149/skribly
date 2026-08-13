import { getCurrentWindow } from '@tauri-apps/api/window';
import React from 'react';
import '../../styles/target-capture-error.css';
import { hideOverlayThen } from './overlayWindowLifecycle';
import { captureErrorTitle, TargetCaptureErrorPayload } from './targetCaptureError';

interface TargetCaptureErrorSurfaceProps {
  error: TargetCaptureErrorPayload;
  onDismiss: () => void;
}

export const TargetCaptureErrorSurface: React.FC<TargetCaptureErrorSurfaceProps> = ({
  error,
  onDismiss,
}) => {
  const dismiss = async () => {
    await hideOverlayThen(() => getCurrentWindow().hide(), onDismiss);
  };

  return (
    <div className="target-capture-error-backdrop">
      <section
        className="target-capture-error-panel"
        role="alert"
        aria-labelledby="target-capture-error-title"
        aria-describedby="target-capture-error-message target-capture-error-next"
      >
        <header className="target-capture-error-header" data-tauri-drag-region>
          <div data-tauri-drag-region>
            <span className="target-capture-error-kicker" data-tauri-drag-region>
              NO NOTE WAS OPENED
            </span>
            <h1 id="target-capture-error-title" data-tauri-drag-region>
              {captureErrorTitle(error.code)}
            </h1>
          </div>
          <button
            type="button"
            className="target-capture-error-close"
            onClick={() => void dismiss().catch(() => undefined)}
            aria-label="Hide this message"
            title="Hide"
          >
            ✕
          </button>
        </header>

        <div className="target-capture-error-body">
          <p id="target-capture-error-message">{error.message}</p>
          <div className="target-capture-error-safety" aria-label="Safety result">
            <span aria-hidden="true">✓</span>
            <p>Skribli cleared the previous target and did not create, reopen, or move a note.</p>
          </div>
          <div className="target-capture-error-next" id="target-capture-error-next">
            <span>Next</span>
            <p>
              Focus the application you want, then press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> +{' '}
              <kbd>Space</kbd>.
            </p>
          </div>
        </div>

        <footer className="target-capture-error-footer">
          <button
            type="button"
            className="primary"
            onClick={() => void dismiss().catch(() => undefined)}
            autoFocus
          >
            Got it
          </button>
        </footer>
      </section>
    </div>
  );
};
