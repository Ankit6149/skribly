import React, { useEffect, useState } from 'react';
import { useLicenseStore } from '../../stores/licenseStore';
import { useSkribStore } from '../../stores/skribStore';

interface LicenseGateProps {
  children: React.ReactNode;
}

export const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const {
    status,
    isReady,
    isActivating,
    errorMessage,
    init,
    activate,
    clearError,
  } = useLicenseStore();
  const setActiveInteractionRect = useSkribStore((state) => state.setActiveInteractionRect);
  const [key, setKey] = useState('');
  const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (status.canWrite) setReadOnlyDismissed(false);
    if (status.mode === 'licensed') {
      setActivationOpen(false);
      setKey('');
    }
  }, [status.canWrite, status.mode]);

  const isBlocking =
    isReady &&
    status.enforcementEnabled &&
    !status.canWrite &&
    !readOnlyDismissed;
  const shouldShowPanel = isBlocking || (status.enforcementEnabled && activationOpen);

  useEffect(() => {
    if (!shouldShowPanel) {
      setActiveInteractionRect(null);
      return;
    }

    const syncRect = () => {
      setActiveInteractionRect({
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(window.innerWidth)),
        height: Math.max(1, Math.round(window.innerHeight)),
      });
    };

    syncRect();
    window.addEventListener('resize', syncRect);
    return () => {
      window.removeEventListener('resize', syncRect);
      setActiveInteractionRect(null);
    };
  }, [setActiveInteractionRect, shouldShowPanel]);

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(status.deviceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The visible device ID can still be selected manually.
    }
  };

  const closePanel = () => {
    clearError();
    setActivationOpen(false);
    if (isBlocking) setReadOnlyDismissed(true);
  };

  const panelKicker = status.mode === 'clock_error'
    ? 'CLOCK CHECK REQUIRED'
    : isBlocking
      ? 'TRIAL COMPLETE'
      : 'PERSONAL LICENCE';
  const panelHeading = status.mode === 'clock_error'
    ? 'Correct your system clock to continue.'
    : isBlocking
      ? 'Keep your notes. Unlock editing when you are ready.'
      : 'Already have a licence? Activate it on this device.';
  const panelMessage = isBlocking
    ? status.message
    : `Your full trial remains active for ${status.trialDaysRemaining} day${status.trialDaysRemaining === 1 ? '' : 's'}. Activation will not remove or move any notes.`;

  return (
    <>
      {children}

      {isReady && status.mode === 'trial' && (
        <button
          type="button"
          className="license-trial-badge"
          onClick={() => {
            clearError();
            setActivationOpen(true);
          }}
          aria-label={`${status.trialDaysRemaining} trial days remaining. Open licence activation.`}
          title="Open licence activation"
        >
          <strong>{status.trialDaysRemaining}</strong>
          <span>trial day{status.trialDaysRemaining === 1 ? '' : 's'} left</span>
        </button>
      )}

      {shouldShowPanel && (
        <div className="license-gate-backdrop">
          <section className="license-gate-panel" aria-label="Skribli licence">
            <span className="license-gate-kicker">{panelKicker}</span>
            <h1>{panelHeading}</h1>
            <p>{panelMessage}</p>

            <div className="license-device-card">
              <span>THIS DEVICE</span>
              <code>{status.deviceId}</code>
              <button type="button" onClick={() => void copyDeviceId()}>
                {copied ? 'Copied' : 'Copy device ID'}
              </button>
            </div>

            <label className="license-key-field">
              <span>Licence key</span>
              <textarea
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Paste the signed Skribli licence key"
                spellCheck={false}
              />
            </label>

            {errorMessage && (
              <div className="license-error" role="alert">
                <span>{errorMessage}</span>
                <button type="button" onClick={clearError}>Dismiss</button>
              </div>
            )}

            <div className="license-gate-actions">
              <button type="button" className="license-secondary" onClick={closePanel}>
                {isBlocking ? 'Continue read-only' : 'Back to trial'}
              </button>
              <button
                type="button"
                className="license-primary"
                disabled={isActivating}
                onClick={() => void activate(key)}
              >
                {isActivating ? 'Checking…' : 'Activate licence'}
              </button>
            </div>

            <a
              className="license-purchase-link"
              href="https://skribly-desktop.vercel.app/#pricing"
              target="_blank"
              rel="noopener noreferrer"
            >
              View personal licence details
            </a>
          </section>
        </div>
      )}
    </>
  );
};
