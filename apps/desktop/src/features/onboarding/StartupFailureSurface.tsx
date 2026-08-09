import React from 'react';
import '../../styles/startup-failure.css';

interface StartupFailureSurfaceProps {
  message: string;
  onRetry: () => void;
  onHide: () => void;
}

export const StartupFailureSurface: React.FC<StartupFailureSurfaceProps> = ({
  message,
  onRetry,
  onHide,
}) => (
  <div className="startup-failure-backdrop">
    <section
      className="startup-failure-panel"
      role="alert"
      aria-labelledby="startup-failure-title"
      aria-describedby="startup-failure-message startup-failure-safety"
    >
      <header className="startup-failure-header" data-tauri-drag-region>
        <span className="startup-failure-kicker" data-tauri-drag-region>
          SETUP NEEDS ATTENTION
        </span>
        <h1 id="startup-failure-title" data-tauri-drag-region>
          The shortcut is not ready yet.
        </h1>
      </header>

      <div className="startup-failure-body">
        <p id="startup-failure-message">{message}</p>
        <div className="startup-failure-safety" id="startup-failure-safety">
          <span aria-hidden="true">✓</span>
          <p>Your existing local Skribs remain protected. Skribli will not open a Skrib until setup succeeds.</p>
        </div>
        <p className="startup-failure-next">
          Retry after closing another shortcut utility or resolving the Windows permission shown
          above. You can also hide this window and retry from the tray later.
        </p>
      </div>

      <footer className="startup-failure-footer">
        <button type="button" className="startup-failure-secondary" onClick={onHide}>
          Hide
        </button>
        <button type="button" className="startup-failure-primary" onClick={onRetry} autoFocus>
          Retry setup
        </button>
      </footer>
    </section>
  </div>
);
