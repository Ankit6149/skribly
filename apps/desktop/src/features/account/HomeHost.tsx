import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CircleHelp,
  Database,
  HardDrive,
  House,
  Info,
  Keyboard,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import skriblyMarkUrl from '../../../../../assets/branding/skribly-app-icon.svg?url';
import type { SkribNote } from '../../lib/geometry';
import type { StorageHealthPayload } from '../../stores/skribStore';
import { useAccountStore } from '../../stores/accountStore';
import { useLicenseStore } from '../../stores/licenseStore';
import {
  completeOnboarding,
  markOnboardingShown,
  readOnboardingStatus,
} from '../onboarding/onboardingState';
import { OnboardingSurface } from '../onboarding/OnboardingSurface';
import { ReminderNotificationMonitor } from '../skribs/ReminderNotificationMonitor';
import { LibraryHost } from '../library/LibraryHost';
import { LibraryImportPanel } from '../library/LibraryImportPanel';
import {
  createLibraryExportRequest,
  isLibraryExportResult,
  LIBRARY_EXPORT_REQUEST_EVENT,
  LIBRARY_EXPORT_RESULT_EVENT,
} from '../library/libraryExport';

type AccountMode = 'signIn' | 'create';
type WorkspaceDestination = 'ready' | 'find' | 'reminders' | 'settings';
type LibraryView = 'notes' | 'calendar' | 'archive' | 'trash';
type SettingsSection = 'general' | 'privacy' | 'data' | 'account' | 'about';

const EXPORT_RESPONSE_TIMEOUT_MS = 15_000;

const WORKSPACE_ITEMS = [
  { id: 'ready' as const, label: 'Ready', detail: 'Status and shortcut', icon: House },
  { id: 'find' as const, label: 'Find', detail: 'Search every Skrib', icon: Search },
  { id: 'reminders' as const, label: 'Reminders', detail: 'What is coming back', icon: Bell },
  { id: 'settings' as const, label: 'Settings', detail: 'Control and recovery', icon: Settings },
];

const SETTINGS_ITEMS = [
  { id: 'general', label: 'General', icon: Keyboard },
  { id: 'privacy', label: 'Context & privacy', icon: ShieldCheck },
  { id: 'data', label: 'Data & recovery', icon: Database },
  { id: 'account', label: 'Account & device', icon: UserRound },
  { id: 'about', label: 'About & updates', icon: Info },
] as const;

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
        <h1>Skribli account services are unavailable.</h1>
        <p>{message}</p>
        <p className="account-trust-copy">
          Your local Skrib data is separate from this account-service problem.
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
        <h1>We could not verify this account.</h1>
        <p>{message || 'The account and trial could not be verified.'}</p>
        <p className="account-trust-copy">
          This does not delete or upload your local Skribs.
        </p>
        <div className="account-inline-actions">
          <button className="account-secondary" type="button" onClick={resetToSignIn}>
            Back to sign in
          </button>
          <button className="account-primary" type="button" onClick={() => void retry()}>
            Retry verification
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
    <div className="account-page desktop-account-setup">
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
            Connect the owner account to verify access. Your actual Skrib content remains local on
            this computer.
          </p>
          <ul>
            <li>Skrib content stays on this Windows device.</li>
            <li>The account stores entitlement and update preferences, not note content.</li>
            <li>Changing accounts on this device does not restart its trial.</li>
          </ul>
          <aside className="account-local-note" aria-label="Local-first promise">
            <span>LOCAL-FIRST</span>
            <p>Your thoughts stay on this PC.</p>
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
                Email me important product updates. Optional; security and service messages remain
                separate.
              </span>
            </label>

            {message && <div className="account-message" role="status">{message}</div>}

            <button className="account-primary account-submit" type="submit">
              {mode === 'create' ? 'Create account and verify email' : 'Sign in to Skribli'}
            </button>
          </form>
          <p className="account-fine-print">
            Signing in never uploads your Skribs.
          </p>
        </section>
      </div>
    </div>
  );
};

const WorkspaceSidebar: React.FC<{
  active: WorkspaceDestination;
  onNavigate: (destination: WorkspaceDestination) => void;
  onShowGuide: () => void;
}> = ({ active, onNavigate, onShowGuide }) => {
  const { email, entitlement } = useAccountStore();

  const entitlementLabel = useMemo(() => {
    if (!entitlement) return 'Account verified';
    if (entitlement.mode === 'trial') {
      return `${entitlement.trialDaysRemaining} trial day${entitlement.trialDaysRemaining === 1 ? '' : 's'} left`;
    }
    if (entitlement.mode === 'expired') return 'Read and export available';
    if (entitlement.mode === 'licensed') return 'Personal licence active';
    return entitlement.message;
  }, [entitlement]);

  return (
    <aside className="home-sidebar desktop-app-sidebar" aria-label="Skribli navigation">
      <div className="desktop-sidebar-brand">
        <img src={skriblyMarkUrl} alt="" />
        <div>
          <strong>Skribli</strong>
          <span>Desktop</span>
        </div>
      </div>

      <nav className="home-navigation desktop-primary-navigation" aria-label="Main app">
        {WORKSPACE_ITEMS.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={active === id ? 'current' : ''}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <span className="home-navigation-icon" aria-hidden="true"><Icon size={16} /></span>
            <span className="home-navigation-copy"><strong>{label}</strong><small>{detail}</small></span>
          </button>
        ))}
      </nav>

      <div className="desktop-sidebar-spacer" />

      <button type="button" className="desktop-guide-button" onClick={onShowGuide}>
        <CircleHelp size={15} aria-hidden="true" />
        <span>Quick guide</span>
      </button>

      <div className="desktop-account-compact">
        <span className="desktop-account-avatar" aria-hidden="true">
          {(email?.trim().charAt(0) || 'S').toUpperCase()}
        </span>
        <div>
          <strong>{email || 'Skribli account'}</strong>
          <small>{entitlementLabel}</small>
        </div>
      </div>
    </aside>
  );
};

const ReadySurface: React.FC<{ onNavigate: (destination: WorkspaceDestination) => void }> = ({ onNavigate }) => {
  const { entitlement, announcements } = useAccountStore();
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealthPayload | null>(null);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      invoke<SkribNote[]>('get_all_skribs'),
      invoke<StorageHealthPayload>('get_storage_health'),
    ]).then(([notes, storage]) => {
      if (disposed) return;
      setActiveCount(notes.filter((note) => note.deleted_at == null && note.archived_at == null).length);
      setStorageHealth(storage);
    }).catch(() => {
      if (!disposed) {
        setActiveCount(null);
        setStorageHealth(null);
      }
    });
    return () => { disposed = true; };
  }, []);

  return (
    <main className="home-main desktop-ready-surface">
      <div className="desktop-ready-copy">
        <span className="account-kicker">SKRIBLI IS READY</span>
        <h1>Leave the window. Keep the thought.</h1>
        <p>
          The main app should stay out of the way. Focus the app where the thought belongs, then use
          the global shortcut.
        </p>

        <div className="desktop-shortcut-line" aria-label="Control plus Shift plus Space">
          <kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>Space</kbd>
        </div>

        <div className="desktop-ready-actions">
          <button
            className="account-primary"
            type="button"
            disabled={entitlement ? !entitlement.canWrite : true}
            onClick={() => void getCurrentWindow().hide()}
          >
            {entitlement?.canWrite ? 'Hide Skribli and return to work' : 'Writing is unavailable'}
          </button>
          <button className="account-secondary" type="button" onClick={() => onNavigate('find')}>
            Find a Skrib
          </button>
        </div>
      </div>

      <aside className="desktop-ready-status" aria-label="Skribli status">
        <span className="account-kicker">RIGHT NOW</span>
        <h2>{storageHealth?.writable === false ? 'Your content is protected.' : 'Nothing needs managing.'}</h2>
        <div className="desktop-status-row">
          <strong>{activeCount == null ? 'Local Skribs' : `${activeCount} active Skrib${activeCount === 1 ? '' : 's'}`}</strong>
          <span>Use Find only when context is not enough.</span>
        </div>
        <div className="desktop-status-row">
          <strong>{storageHealth?.writable === false ? 'Read-only protection' : 'Local storage healthy'}</strong>
          <span>{storageHealth?.writable === false ? 'Reading and export remain available.' : 'Your Skrib content stays on this PC.'}</span>
        </div>
        {announcements[0] && (
          <div className="desktop-ready-announcement">
            <small>WHAT'S NEW</small>
            <strong>{announcements[0].title}</strong>
            <span>{announcements[0].body}</span>
          </div>
        )}
      </aside>
    </main>
  );
};

const SettingsSurface: React.FC<{
  onOpenFindView: (view: Exclude<LibraryView, 'calendar'>) => void;
  onShowGuide: () => void;
}> = ({ onOpenFindView, onShowGuide }) => {
  const {
    email,
    accountRole,
    entitlement,
    productUpdatesOptIn,
    signOut,
  } = useAccountStore();
  const licenseStatus = useLicenseStore((state) => state.status);
  const [section, setSection] = useState<SettingsSection>('general');
  const [storage, setStorage] = useState<StorageHealthPayload | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const exportRequest = useRef<string | null>(null);
  const exportTimeout = useRef<number | null>(null);
  const canApplyImport = Boolean(storage?.writable) && (!licenseStatus.enforcementEnabled || licenseStatus.canWrite);

  const refreshStorage = useCallback(async () => {
    try {
      setStorage(await invoke<StorageHealthPayload>('get_storage_health'));
    } catch {
      setStorage(null);
    }
  }, []);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<unknown>(LIBRARY_EXPORT_RESULT_EVENT, (event) => {
      if (disposed || !isLibraryExportResult(event.payload)) return;
      if (event.payload.requestId !== exportRequest.current) return;
      if (exportTimeout.current !== null) window.clearTimeout(exportTimeout.current);
      exportTimeout.current = null;
      exportRequest.current = null;
      setExporting(false);
      setExportMessage(
        event.payload.path
          ? `Export saved to ${event.payload.path}`
          : event.payload.error || 'Skribli could not export your note records.'
      );
    }).then((callback) => {
      if (disposed) callback();
      else unlisten = callback;
    });
    return () => {
      disposed = true;
      if (exportTimeout.current !== null) window.clearTimeout(exportTimeout.current);
      unlisten?.();
    };
  }, []);

  const exportAll = async () => {
    if (exporting) return;
    const request = createLibraryExportRequest(null);
    exportRequest.current = request.requestId;
    setExporting(true);
    setExportMessage(null);
    exportTimeout.current = window.setTimeout(() => {
      if (exportRequest.current !== request.requestId) return;
      exportRequest.current = null;
      exportTimeout.current = null;
      setExporting(false);
      setExportMessage('Skribli did not receive an export result. Try again or restart the app.');
    }, EXPORT_RESPONSE_TIMEOUT_MS);
    try {
      await emit(LIBRARY_EXPORT_REQUEST_EVENT, request);
    } catch (error) {
      if (exportTimeout.current !== null) window.clearTimeout(exportTimeout.current);
      exportTimeout.current = null;
      exportRequest.current = null;
      setExporting(false);
      setExportMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const entitlementLabel = entitlement?.mode === 'trial'
    ? `${entitlement.trialDaysRemaining} trial day${entitlement.trialDaysRemaining === 1 ? '' : 's'} remaining`
    : entitlement?.mode === 'licensed'
      ? 'Personal licence active'
      : entitlement?.mode === 'expired'
        ? 'Read and export available'
        : entitlement?.message || 'Account verified';

  return (
    <main className="desktop-settings">
      <header className="desktop-section-header">
        <div>
          <span className="account-kicker">CONTROL SKRIBLI</span>
          <h1>Settings</h1>
          <p>Low-frequency controls, recovery and account details live here—not in the note or daily workflow.</p>
        </div>
      </header>

      <div className="desktop-settings-layout">
        <nav className="desktop-settings-nav" aria-label="Settings sections">
          {SETTINGS_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={section === id ? 'current' : ''}
              aria-current={section === id ? 'page' : undefined}
              onClick={() => setSection(id)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="desktop-settings-document">
          {section === 'general' && (
            <>
              <div className="desktop-settings-heading">
                <span className="account-kicker">GENERAL</span>
                <h2>Everyday behavior</h2>
                <p>Keep only the controls that affect how you enter and leave Skribli.</p>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Global shortcut</strong><span>Creates a contextual Skrib from the app you are using.</span></div>
                <kbd>Ctrl + Shift + Space</kbd>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Main window</strong><span>Closing or hiding the window does not quit the background process.</span></div>
                <button className="account-secondary" type="button" onClick={() => void getCurrentWindow().hide()}>Hide now</button>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Quick guide</strong><span>Revisit the capture → put away → return mental model.</span></div>
                <button className="account-secondary" type="button" onClick={onShowGuide}>Open guide</button>
              </div>
            </>
          )}

          {section === 'privacy' && (
            <>
              <div className="desktop-settings-heading">
                <span className="account-kicker">CONTEXT & PRIVACY</span>
                <h2>Enough context to return, no more.</h2>
                <p>Healthy context stays invisible. These are the boundaries Skribli currently follows.</p>
              </div>
              <div className="desktop-trust-list">
                <article><ShieldCheck size={17} /><div><strong>Skrib content stays local</strong><span>Your note text is not uploaded to the account service.</span></div></article>
                <article><ShieldCheck size={17} /><div><strong>No screen recording</strong><span>The shortcut uses bounded window identity and geometry rather than recording your screen.</span></div></article>
                <article><ShieldCheck size={17} /><div><strong>Return is honest</strong><span>If the exact saved place is unavailable, Skribli reports the fallback instead of pretending it restored deeper application state.</span></div></article>
              </div>
            </>
          )}

          {section === 'data' && (
            <>
              <div className="desktop-settings-heading">
                <span className="account-kicker">DATA & RECOVERY</span>
                <h2>Your local data, with a way back.</h2>
                <p>Portable import/export and lifecycle recovery are kept together here.</p>
              </div>

              <div className="desktop-storage-card" data-state={storage?.writable === false ? 'blocked' : 'healthy'}>
                <HardDrive size={18} aria-hidden="true" />
                <div>
                  <strong>{storage?.writable === false ? 'Skribli is protecting this store' : 'Local storage is healthy'}</strong>
                  <span>{storage?.writable === false ? 'Reading and export remain available while writes are blocked.' : 'Current note records are available on this device.'}</span>
                </div>
                <button className="account-secondary" type="button" onClick={() => void refreshStorage()}>Check again</button>
              </div>

              <div className="desktop-setting-row">
                <div><strong>Export note records</strong><span>Create a portable local JSON export of the native note records.</span></div>
                <button className="account-secondary" type="button" onClick={() => void exportAll()} disabled={exporting}>
                  {exporting ? 'Exporting…' : 'Export'}
                </button>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Import / restore</strong><span>Preview duplicates and conflicts before anything changes.</span></div>
                <LibraryImportPanel canApply={canApplyImport} onApplied={() => void refreshStorage()} />
              </div>
              <div className="desktop-setting-row">
                <div><strong>Past</strong><span>Completed or archived Skribs remain restorable.</span></div>
                <button className="account-secondary" type="button" onClick={() => onOpenFindView('archive')}>Open Past</button>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Trash</strong><span>Recently removed Skribs remain recoverable before permanent deletion.</span></div>
                <button className="account-secondary" type="button" onClick={() => onOpenFindView('trash')}>Open Trash</button>
              </div>
              {exportMessage && <div className="desktop-settings-message" role="status">{exportMessage}</div>}
            </>
          )}

          {section === 'account' && (
            <>
              <div className="desktop-settings-heading">
                <span className="account-kicker">ACCOUNT & DEVICE</span>
                <h2>Access is connected. Content stays local.</h2>
                <p>Account state controls entitlement; it does not imply note-content sync.</p>
              </div>
              <div className="desktop-account-panel">
                <span className="desktop-account-avatar large" aria-hidden="true">{(email?.trim().charAt(0) || 'S').toUpperCase()}</span>
                <div>
                  <strong>{email || 'Skribli account'}</strong>
                  <span>{accountRole === 'owner' ? 'Owner account' : 'Member account'} · {entitlementLabel}</span>
                  <small>{productUpdatesOptIn ? 'Product updates enabled' : 'Essential emails only'}</small>
                </div>
                <button className="account-secondary" type="button" onClick={() => void signOut()}>
                  <LogOut size={14} aria-hidden="true" /> Sign out
                </button>
              </div>
            </>
          )}

          {section === 'about' && (
            <>
              <div className="desktop-settings-heading">
                <span className="account-kicker">ABOUT & UPDATES</span>
                <h2>Skribli for Windows</h2>
                <p>Support information stays here instead of occupying the daily workspace.</p>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Product status</strong><span>The current owner build is connected to local-first storage and account entitlement.</span></div>
                <span className="desktop-setting-status">Ready</span>
              </div>
              <div className="desktop-setting-row">
                <div><strong>Diagnostics</strong><span>Storage or save failures expose safe diagnostics from the recovery surfaces where they occur.</span></div>
                <span className="desktop-setting-status">On demand</span>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export const HomeHost: React.FC = () => {
  const { phase, init } = useAccountStore();
  const [guideVisible, setGuideVisible] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceDestination>('ready');
  const [libraryRequest, setLibraryRequest] = useState<{ view: LibraryView; noteId?: string }>({ view: 'notes' });

  useEffect(() => {
    let disposed = false;
    const subscriptions = [
      listen<{ view?: string }>('skribly://library-view', ({ payload }) => {
        if (disposed) return;
        const view = payload?.view;
        const nextView: LibraryView = view === 'calendar' || view === 'archive' || view === 'trash' ? view : 'notes';
        setLibraryRequest({ view: nextView });
        setGuideVisible(false);
        setWorkspace(nextView === 'calendar' ? 'reminders' : 'find');
      }),
      listen('skribly://home-view', () => {
        if (!disposed) {
          setGuideVisible(false);
          setWorkspace('ready');
        }
      }),
    ];
    return () => {
      disposed = true;
      void Promise.all(subscriptions).then((callbacks) => callbacks.forEach((callback) => callback()));
    };
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('skribly://show-onboarding', () => {
      if (!disposed) {
        setWorkspace('ready');
        setGuideVisible(true);
      }
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

  const navigate = (destination: WorkspaceDestination) => {
    setGuideVisible(false);
    setWorkspace(destination);
    if (destination === 'find') setLibraryRequest((current) => ({ ...current, view: current.view === 'calendar' ? 'notes' : current.view }));
    if (destination === 'reminders') setLibraryRequest({ view: 'calendar' });
  };

  const openFindView = (view: Exclude<LibraryView, 'calendar'>) => {
    setGuideVisible(false);
    setLibraryRequest({ view });
    setWorkspace('find');
  };

  const handleLibraryViewChange = useCallback((view: LibraryView) => {
    setLibraryRequest((current) => current.view === view ? current : { view });
  }, []);

  const openReminderNote = useCallback((noteId: string) => {
    setLibraryRequest({ view: 'notes', noteId });
    setWorkspace('find');
  }, []);

  return (
    <>
      {phase === 'ready' && <ReminderNotificationMonitor />}
      {phase === 'loading' ? <BusySurface label="Opening Skribli…" />
        : phase === 'claiming' ? <BusySurface label="Verifying this device…" />
        : phase !== 'ready' ? <AccountSetupSurface />
        : (
          <div className="desktop-workspace-shell desktop-app-v2">
            <WorkspaceSidebar
              active={workspace}
              onNavigate={navigate}
              onShowGuide={() => setGuideVisible(true)}
            />
            <div className="desktop-workspace-content">
              {guideVisible ? (
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
              ) : workspace === 'ready' ? (
                <ReadySurface onNavigate={navigate} />
              ) : workspace === 'find' ? (
                <LibraryHost
                  active
                  mode="find"
                  request={libraryRequest}
                  onViewChange={handleLibraryViewChange}
                />
              ) : workspace === 'reminders' ? (
                <LibraryHost
                  active
                  mode="reminders"
                  request={{ view: 'calendar' }}
                  onOpenReminderNote={openReminderNote}
                />
              ) : (
                <SettingsSurface
                  onOpenFindView={openFindView}
                  onShowGuide={() => setGuideVisible(true)}
                />
              )}
            </div>
          </div>
        )}
    </>
  );
};