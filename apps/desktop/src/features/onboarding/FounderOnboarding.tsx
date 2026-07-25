import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'skribly:onboarding:founder-alpha-v1';

interface FounderOnboardingProps {
  onVisibilityChange?: (visible: boolean) => void;
}

const STEPS = [
  {
    eyebrow: 'STEP 1 · PLACE',
    title: 'Leave a note inside any app',
    body: 'Press Ctrl + Shift + Space or choose New, then select the open application where the note belongs.',
    visual: '⌘  →  app  →  note',
  },
  {
    eyebrow: 'STEP 2 · WRITE',
    title: 'Type normally or switch to Write',
    body: 'Type mode is fast and focused. Write mode expands the editor so you can sketch with a mouse, touch screen, or stylus and attach images or files.',
    visual: 'type  /  draw  /  attach',
  },
  {
    eyebrow: 'STEP 3 · RETURN',
    title: 'Close it into a small movable dot',
    body: 'The note stops covering your work. Click the dot to preview it, or use the saved-notes widget to return to its matching open app.',
    visual: 'note  →  ●  →  context',
  },
];

export const FounderOnboarding: React.FC<FounderOnboardingProps> = ({ onVisibilityChange }) => {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let shouldShow = true;
    try {
      shouldShow = localStorage.getItem(STORAGE_KEY) !== 'complete';
    } catch {
      shouldShow = true;
    }
    setVisible(shouldShow);
    onVisibilityChange?.(shouldShow);
  }, [onVisibilityChange]);

  const complete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'complete');
    } catch {
      // Onboarding can still close when browser storage is unavailable.
    }
    setVisible(false);
    onVisibilityChange?.(false);
  };

  if (!visible) return null;

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="founder-onboarding-backdrop">
      <section className="founder-onboarding" aria-label="Welcome to Skribly">
        <button type="button" className="onboarding-skip" onClick={complete}>Skip</button>
        <div className="onboarding-brand">S</div>
        <span className="onboarding-eyebrow">{step.eyebrow}</span>
        <h1>{step.title}</h1>
        <p>{step.body}</p>
        <div className="onboarding-visual" aria-hidden="true">{step.visual}</div>
        <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
          {STEPS.map((_, index) => (
            <span key={index} className={index === stepIndex ? 'active' : ''} />
          ))}
        </div>
        <footer className="onboarding-actions">
          <button
            type="button"
            className="secondary"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (isLast) complete();
              else setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
            }}
          >
            {isLast ? 'Start using Skribly' : 'Continue'}
          </button>
        </footer>
      </section>
    </div>
  );
};
