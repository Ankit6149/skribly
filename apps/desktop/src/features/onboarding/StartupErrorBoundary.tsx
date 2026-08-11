import React from 'react';

interface StartupErrorBoundaryProps {
  children: React.ReactNode;
}

interface StartupErrorBoundaryState {
  error: Error | null;
}

export class StartupErrorBoundary extends React.Component<
  StartupErrorBoundaryProps,
  StartupErrorBoundaryState
> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): StartupErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Skribli interface failed after startup.', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="startup-recovery" role="alert" aria-labelledby="startup-recovery-title">
        <section className="startup-recovery-card">
          <div className="startup-recovery-mark" aria-hidden="true">S</div>
          <span className="startup-recovery-kicker">INTERFACE NEEDS ATTENTION</span>
          <h1 id="startup-recovery-title">Skribli stayed visible so you can recover.</h1>
          <p>
            The interface could not finish drawing. Your local Skribs were not changed. Reload the
            window, then reinstall the latest build if this continues.
          </p>
          <details>
            <summary>Technical detail</summary>
            <code>{this.state.error.message.slice(0, 500)}</code>
          </details>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Skribli
          </button>
        </section>
      </main>
    );
  }
}
