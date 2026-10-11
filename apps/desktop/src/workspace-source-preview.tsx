import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './styles/global.css';
import './styles/accessibility.css';
import './styles/website-theme.css';
import { ReadySurface, WorkspaceSidebar } from './features/account/HomeHost';
import { useAccountStore } from './features/account/state/accountStore';

// Source-only fixture: no account initialization or real note storage is accessed.
useAccountStore.setState({
  phase: 'ready', email: 'preview@skribli.test', announcements: [],
  entitlement: {
    mode: 'licensed', enforcementEnabled: true, canWrite: true,
    trialDaysTotal: 7, trialDaysRemaining: 0, trialExpiresAt: null,
    deviceId: 'SOURCE-PREVIEW', licensedEmail: 'preview@skribli.test',
    updatesUntil: null, message: 'Synthetic preview entitlement.',
  },
});
const previewStatus = { activeCount: 18, writable: true };
function WorkspacePreview() {
  const [notice, setNotice] = useState('Source preview: synthetic account and storage status');
  const navigate = (destination: 'ready' | 'find' | 'reminders' | 'settings') => {
    if (destination === 'find') {
      window.location.assign('rail-source-preview.html');
      return;
    }
    setNotice(destination === 'ready' ? 'Source preview: synthetic account and storage status'
      : `${destination === 'settings' ? 'Settings' : 'Reminders'} uses the Windows app; this fixture previews Ready and the note panel.`);
  };
  return <>
    <div className="desktop-workspace-shell desktop-app-v2">
      <WorkspaceSidebar active="ready" onNavigate={navigate}
        onShowGuide={() => setNotice('Use Ctrl+Shift+Space in Windows to keep a thought with its app. This browser fixture does not register a shortcut.')} />
      <div className="desktop-workspace-content">
        <ReadySurface onNavigate={navigate} previewStatus={previewStatus}
          onPreviewHide={() => setNotice('Hiding the native window requires the Windows app.')} />
      </div>
    </div>
    <div role="status" style={{ position: 'fixed', bottom: 8, left: 210, right: 16, fontSize: 10, color: '#52594e', pointerEvents: 'none' }}>{notice}</div>
  </>;
}
const root = ReactDOM.createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => root.unmount());
root.render(<WorkspacePreview />);
