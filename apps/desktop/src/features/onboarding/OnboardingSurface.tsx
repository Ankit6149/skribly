import React from 'react';
import '../../styles/onboarding.css';

interface OnboardingSurfaceProps {
  onComplete: () => void;
  onDismiss: () => void;
}

interface OnboardingStep {
  number: string;
  title: string;
  description: string;
  shortcut?: boolean;
}

const STEPS: readonly OnboardingStep[] = [
  {
    number: '01',
    title: 'Focus the application',
    description: 'Open the window where this thought belongs.',
  },
  {
    number: '02',
    title: 'Press the shortcut',
    description: 'Skribli verifies that exact window before opening a note.',
    shortcut: true,
  },
  {
    number: '03',
    title: 'Type, then choose Done',
    description: 'The note saves locally, the editor hides, and Skribli stays in the tray.',
  },
];

export const OnboardingSurface: React.FC<OnboardingSurfaceProps> = ({
  onComplete,
  onDismiss,
}) => (
  <div className="onboarding-backdrop">
    <section
      className="onboarding-panel"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-summary onboarding-trust"
    >
      <header className="onboarding-header" data-tauri-drag-region>
        <span className="onboarding-kicker" data-tauri-drag-region>
          SKRIBLI IS READY
        </span>
        <h1 id="onboarding-title" data-tauri-drag-region>
          Your first note takes one shortcut.
        </h1>
        <p id="onboarding-summary" data-tauri-drag-region>
          Skribli stays quiet until a thought needs somewhere to return.
        </p>
      </header>

      <div className="onboarding-body">
        <ol className="onboarding-steps" aria-label="Create your first contextual note">
          {STEPS.map((step) => (
            <li key={step.number} className="onboarding-step">
              <span className="onboarding-step-number" aria-hidden="true">
                {step.number}
              </span>
              <div>
                <h2>{step.title}</h2>
                {step.shortcut && (
                  <div className="onboarding-shortcut" aria-label="Control plus Shift plus Space">
                    <kbd>Ctrl</kbd>
                    <span aria-hidden="true">+</span>
                    <kbd>Shift</kbd>
                    <span aria-hidden="true">+</span>
                    <kbd>Space</kbd>
                  </div>
                )}
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <aside className="onboarding-trust" id="onboarding-trust">
          <div className="onboarding-trust-mark" aria-hidden="true">
            ✓
          </div>
          <div>
            <h2>Private by default</h2>
            <p>
              Notes stay on this device. Skribli uses limited window identity and geometry—not
              screen recording—to return the right note.
            </p>
          </div>
        </aside>

        <p className="onboarding-lifecycle-note">
          <strong>Done</strong> hides the editor but keeps the shortcut ready. Use{' '}
          <strong>Quit Skribli</strong> in the tray to stop the background process.
        </p>
      </div>

      <footer className="onboarding-footer">
        <button type="button" className="onboarding-secondary" onClick={onDismiss}>
          Maybe later
        </button>
        <button type="button" className="onboarding-primary" onClick={onComplete} autoFocus>
          Start using Skribli
        </button>
      </footer>
    </section>
  </div>
);
