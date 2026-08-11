import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import React, { useEffect, useMemo, useState } from 'react';
import skriblyMarkUrl from '../../../../../assets/branding/skribly-app-icon.svg?url';
import { useAccountStore } from '../../stores/accountStore';
import {
  completeOnboarding,
  markOnboardingShown,
  readOnboardingStatus,
} from '../onboarding/onboardingState';
import { OnboardingSurface } from '../onboarding/OnboardingSurface';

type AccountMode = 'signIn' | 'create';

async function openLibrary(): Promise<void> {
  const library = await Window.getByLabel('library');
  if (!library) throw new Error('All Skribs is unavailable. Restart Skribli and try again.');
  await library.unminimize();
  await library.show();
  await library.setFocus();
}

const BusySurface: React.FC<{ label: string }> = ({ label }) => (
  <div className="account-page account-page-centered" role="status" aria-live="polite">
    <img className="account-mark" src={skriblyMarkUrl} alt="" />
    <div className="account-spinner" aria-hidden="true" />
    <h1>{label}</h1>
    <p>Skribli keeps your Skrib content on this device while it verifies only your account and trial.</p>
  </div>
);

const AccountSetupSurface: React.FC = () => {
  const {
    phase,
    email: accountEmail,
    message,
    signIn,
    signUp,
    retry,
    resetToSignIn,
    clearMessage,
  } = useAccountStore();
  const [mode, setMode] = useState<AccountMode>('create');
  const [email, setEmail] = useState(accountEmail ?? '');
  const [password, setPassword] = useState('');
  const [updatesOptIn, setUpdatesOptIn] = useState(false);

  useEffect(() => {
    if (phase === 'verificationPending') setMode('signIn');
  }, [phase]);

  if (phase === 'configurationRequired') {
    return (
      <div className="account-page account-page-centered" role="alert">
        <img className="account-mark" src={skriblyMarkUrl} alt="" />
        <span className="account-kicker">SETUP COULD NOT START</span>
        <h1>Skribli account services are missing.</h1>
        <p>{message}</p>
        <p className="account-trust-copy">
          This build is intentionally blocked instead of opening silently or starting a resettable local trial.
        </p>
        <button className="account-primary" type="button" onClick={() => void retry()}>
          Check again
        </button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="account-page account-page-centered" role="alert">
        <img className="account-mark" src={skriblyMarkUrl} alt="" />
        <span className="account-kicker">ACCOUNT CHECK NEEDS ATTENTION</span>
        <h1>Skribli stayed visible so you can recover.</h1>
        <p>{message || 'The account and trial could not be verified.'}</p>
        <div className="account-inline-actions">
          <button className="account-secondary" type="button" onClick={resetToSignIn}>
            Back to sign in
          </button>
          <button className="account-primary" type="button" onClick={() => void retry()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'create') await signUp(email, password, updatesOptIn);
    else await signIn(email, password, updatesOptIn);
  };

  return (
    <div className="account-page">
      <header className="account-setup-header">
        <div className="account-brand-lockup">
          <img className="account-mark" src={skriblyMarkUrl} alt="" />
          <div>
            <strong>Skribli</strong>
            <span>Contextual annotations for Windows</span>
          </div>
        </div>
        <span className="account-step">SETUP · 1 OF 3</span>
      </header>

      <div className="account-setup-grid">
        <section className="account-story" aria-labelledby="account-title">
          <span className="account-kicker">ACCOUNT AND DEVICE</span>
          <h1 id="account-title">Set up Skribli on this PC.</h1>
          <p>
            Connect an account to verify owner access and keep this Windows device associated with
            the correct trial or licence.
          </p>
          <ul>
            <li>Skrib content remains local on this Windows device.</li>
            <li>Your account tracks trial access, app version, and update preferences.</li>
            <li>Changing accounts on this device does not restart its trial.</li>
          </ul>
          <aside className="account-local-note" aria-label="Local-first promise">
            <span>LOCAL-FIRST</span>
            <p>your thoughts stay on this PC</p>
          </aside>
        </section>

        <section className="account-card" aria-label="Skribli account">
          <div className="account-card-heading">
            <span>ACCOUNT ACCESS</span>
            <h2>Continue to Skribli</h2>
            <p>Create the owner account or sign in on this device.</p>
          </div>
          <div className="account-tabs" role="tablist" aria-label="Account action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              onClick={() => {
                setMode('create');
                clearMessage();
              }}
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signIn'}
              onClick={() => {
                setMode('signIn');
                clearMessage();
              }}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <label>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {mode === 'create' && <small>At least 12 characters.</small>}
            </label>

            <label className="account-consent">
              <input
                type="checkbox"
                checked={updatesOptIn}
                onChange={(event) => setUpdatesOptIn(event.target.checked)}
              />
              <span>
                Email me important product updates. Optional—you can change this later and
                account emails are otherwise limited to security and service messages.
              </span>
            </label>

            {message && (
              <div className="account-message" role="status">
                {message}
              </div>
            )}

            <button className="account-primary account-submit" type="submit">
              {mode === 'create' ? 'Create account and verify email' : 'Sign in to Skribli'}
            </button>
          </form>
          <p className="account-fine-print">
            Signing in never uploads your Skribs. Trial and account metadata are handled under the
            Skribli privacy policy.
          </p>
        </section>
      </div>
    </div>
  );
};

const HomeSurface: React.FC<{ onShowGuide: () => void }> = ({ onShowGuide }) => {
  const { email, accountRole, entitlement, productUpdatesOptIn, announcements, signOut } = useAccountStore();
  const [actionError, setActionError] = useState<string | null>(null);
  const trialLabel = useMemo(() => {
    if (!entitlement) return 'Account verified';
    if (entitlement.mode === 'trial') {
      return `${entitlement.trialDaysRemaining} trial day${entitlement.trialDaysRemaining === 1 ? '' : 's'} left`;
    }
    if (entitlement.mode === 'expired') return 'Trial complete · read and export remain available';
    if (entitlement.mode === 'licensed') return 'Personal licence active';
    return entitlement.message;
  }, [entitlement]);

  return (
    <div className="account-page home-page">
      <header className="home-header">
        <div className="account-brand-lockup">
          <img className="account-mark" src={skriblyMarkUrl} alt="" />
          <div>
            <strong>Skribli</strong>
            <span>{trialLabel}</span>
          </div>
        </div>
        <div className="home-header-actions">
          <span className="account-step">READY · 3 OF 3</span>
          <button className="account-text-button" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="home-hero">
        <span className="account-kicker">DESKTOP STATUS</span>
        <h1>Skribli is ready.</h1>
        <p>Hide this window, focus a supported app, and use the shortcut to open the compact editor.</p>
        <div className="home-shortcut" aria-label="Control plus Shift plus Space">
          <kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>Space</kbd>
        </div>
        <button
          className="account-primary home-start"
          type="button"
          disabled={entitlement ? !entitlement.canWrite : true}
          onClick={() => void getCurrentWindow().hide()}
        >
          {entitlement?.canWrite ? 'Hide Skribli and use the shortcut' : 'Writing is unavailable'}
        </button>
      </section>

      {announcements[0] && (
        <section className="home-announcement" aria-label="Skribli update">
          <span className="account-kicker">WHAT'S NEW</span>
          <strong>{announcements[0].title}</strong>
          <p>{announcements[0].body}</p>
        </section>
      )}

      <section className="home-actions" aria-label="Skribli actions">
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            void openLibrary().catch((error) =>
              setActionError(error instanceof Error ? error.message : String(error))
            );
          }}
        >
          <strong>All Skribs</strong>
          <span>Search, restore, import, or export local Skribs.</span>
        </button>
        <button type="button" onClick={onShowGuide}>
          <strong>Quick guide</strong>
          <span>Review the shortcut, privacy, and background behavior.</span>
        </button>
      </section>

      {actionError && <div className="account-message" role="alert">{actionError}</div>}

      <footer className="home-footer">
        <span>{email}</span>
        <span>{accountRole === 'owner' ? 'Owner account' : 'Member account'}</span>
        <span>{productUpdatesOptIn ? 'Product update emails on' : 'Only essential account emails'}</span>
        <span>Skrib content stays local</span>
      </footer>
    </div>
  );
};

export const HomeHost: React.FC = () => {
  const { phase, init } = useAccountStore();
  const [guideVisible, setGuideVisible] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('skribly://show-onboarding', () => {
      if (!disposed) setGuideVisible(true);
    }).then((callback) => {
      if (disposed) callback();
      else unlisten = callback;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'ready' || typeof window === 'undefined') return;
    if (readOnboardingStatus(window.localStorage) !== 'completed') setGuideVisible(true);
  }, [phase]);

  if (phase === 'loading') return <BusySurface label="Opening Skribli…" />;
  if (phase === 'claiming') return <BusySurface label="Verifying this device…" />;
  if (phase !== 'ready') return <AccountSetupSurface />;

  if (guideVisible) {
    return (
      <OnboardingSurface
        onComplete={() => {
          if (typeof window !== 'undefined') completeOnboarding(window.localStorage);
          setGuideVisible(false);
        }}
        onDismiss={() => {
          if (typeof window !== 'undefined') markOnboardingShown(window.localStorage);
          setGuideVisible(false);
        }}
      />
    );
  }

  return <HomeSurface onShowGuide={() => setGuideVisible(true)} />;
};
