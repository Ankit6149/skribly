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
import { ReadySurface, SettingsSurface, WorkspaceSidebar } from './features/account/HomeHost';
import { LibraryHost } from './features/library/LibraryHost';
import type { SkribNote } from './features/notes/model/noteTypes';
import { installReadonlyPreviewBridge } from './source-preview/readonlyBridge';
import { useAccountStore } from './features/account/state/accountStore';

// Source-only fixture: no account initialization or real note storage is accessed.
const previewNotes: SkribNote[] = [
  { id:'ux-preview-code', target_process_name:'Code.exe', target_title:'Project notes - Visual Studio Code', text:'Keep this implementation easy to understand.', color:'peach' },
  { id:'ux-preview-browser', target_process_name:'chrome.exe', target_title:'Research - Google Chrome', text:'Compare the examples before choosing.', color:'lavender' },
  { id:'ux-preview-general', target_process_name:'', target_title:'', text:'A thought for later.', color:'mint' },
].map((note,index) => ({ ...note, rel_x:0,rel_y:0,width:420,height:360,collapsed:false,created_at:Math.floor(Date.now()/1000)-index*86400,updated_at:Math.floor(Date.now()/1000) } as SkribNote));
const disposePreviewBridge = installReadonlyPreviewBridge(previewNotes);
useAccountStore.setState({
  phase: 'ready', email: 'preview@skribli.test', announcements: [],
  signOut:async () => undefined,
  entitlement: {
    mode: 'licensed', enforcementEnabled: true, canWrite: true,
    trialDaysTotal: 7, trialDaysRemaining: 0, trialExpiresAt: null,
    deviceId: 'SOURCE-PREVIEW', licensedEmail: 'preview@skribli.test',
    updatesUntil: null, message: 'Synthetic preview entitlement.',
  },
});
const previewStatus = { activeCount: previewNotes.length, writable: true };
function WorkspacePreview() {
  const [notice, setNotice] = useState('Read-only source preview · synthetic account and notes · native actions unavailable');
  const [destination, setDestination] = useState<'ready'|'find'|'reminders'|'settings'>('ready');
  const [findView,setFindView] = useState<'notes'|'archive'|'trash'>('notes');
  const navigate = (destination: 'ready' | 'find' | 'reminders' | 'settings') => {
    setDestination(destination);
  };
  const guide = () => setNotice('Ctrl+Shift+Space captures in Windows. This read-only browser fixture registers no shortcuts or native actions.');
  return <>
    <div className="desktop-workspace-shell desktop-app-v2">
      <WorkspaceSidebar active={destination} onNavigate={navigate} onShowGuide={guide} />
      <div className="desktop-workspace-content">
        {destination === 'ready' ? <ReadySurface onNavigate={navigate} previewStatus={previewStatus}
          onPreviewHide={() => setNotice('Hiding the native window requires the Windows app.')} />
          : destination === 'settings' ? <SettingsSurface onShowGuide={guide} onOpenFindView={(view) => { setFindView(view);setDestination('find'); }} />
          : <LibraryHost mode={destination === 'reminders' ? 'reminders':'find'} request={{view:findView}} onViewChange={(view) => { if(view!=='calendar')setFindView(view); }} />}
      </div>
    </div>
    <div role="status" style={{ position: 'fixed', bottom: 8, left: 210, right: 16, fontSize: 10, color: '#52594e', pointerEvents: 'none' }}>{notice}</div>
  </>;
}
const root = ReactDOM.createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => { root.unmount(); disposePreviewBridge(); });
root.render(<WorkspacePreview />);
