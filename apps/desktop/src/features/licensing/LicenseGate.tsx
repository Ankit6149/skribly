import React, { useEffect, useState } from 'react';
import { useLicenseStore } from '../../stores/licenseStore';

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
  const [key, setKey] = useState('');
  const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (status.canWrite) setReadOnlyDismissed(false);
  }, [status.canWrite]);

  const copyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(status.deviceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The visible device ID can still be selected manually.
    }
  };

  const shouldShowBlockingPanel =
    isReady &&
    status.enforcementEnabled &&
    !status.canWrite &&
    !readOnlyDismissed;

  return (
    <>
      {children}

      {isReady && status.mode === 'trial' && (
        <div className="license-trial-badge" role="status">
          <strong>{status.trialDaysRemaining}</strong>
          <span>trial day{status.trialDaysRemaining === 1 ? '' : 's'} left</span>
        </div>
      )}

      {shouldShowBlockingPanel && (
        <div className="license-gate-backdrop">
          <section className="license-gate-panel" aria-label="Skribly licence">
            <span className="license-gate-kicker">
              {status.mode === 'clock_error' ? 'CLOCK CHECK REQUIRED' : 'TRIAL COMPLETE'}
            </span>
            <h1>
              {status.mode === 'clock_error'
                ? 'Correct your system clock to continue.'
                : 'Keep your notes. Unlock editing when you are ready.'}
            </h1>
            <p>{status.message}</p>

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
                placeholder="Paste the signed Skribly licence key"
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
              <button
                type="button"
                className="license-secondary"
                onClick={() => setReadOnlyDismissed(true)}
              >
                Continue read-only
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
