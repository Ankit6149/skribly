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
    description: 'Skribli verifies that exact window before opening a typed Skrib.',
    shortcut: true,
  },
  {
    number: '03',
    title: 'Type, then choose Done',
    description: 'The Skrib saves locally and folds into a small dot you can move or reopen.',
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
          SETUP · 2 OF 3
        </span>
        <h1 id="onboarding-title" data-tauri-drag-region>
          Your first Skrib takes one shortcut.
        </h1>
        <p id="onboarding-summary" data-tauri-drag-region>
          Skribli stays quiet until a thought needs somewhere to return.
        </p>
      </header>

      <div className="onboarding-body">
        <ol className="onboarding-steps" aria-label="Create your first contextual Skrib">
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
            <p>Skrib content stays on this device. Skribli uses limited window identity and geometry, not screen recording, to return the right contextual Skrib.</p>
          </div>
        </aside>

        <p className="onboarding-lifecycle-note">
          <strong>Done</strong> folds the saved Skrib into a movable dot. Use{' '}
          <strong>Quit Skribli</strong> in the tray to stop the background process.
        </p>
      </div>

      <footer className="onboarding-footer">
        <button type="button" className="onboarding-secondary" onClick={onDismiss}>
          Review later
        </button>
        <button type="button" className="onboarding-primary" onClick={onComplete} autoFocus>
          Continue to Skribli home
        </button>
      </footer>
    </section>
  </div>
);
