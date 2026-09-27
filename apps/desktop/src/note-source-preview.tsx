import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-sans/800.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import { SkribComposer } from './features/skribs/SkribComposer';
import { useLicenseStore } from './stores/licenseStore';
import type { SkribNote } from './lib/geometry';
import './styles/global.css';
import './styles/accessibility.css';
import './styles/note-experience.css';
import './styles/opening-journey.css';
import './styles/account.css';
import './styles/trash.css';
import './styles/startup-recovery.css';
import './styles/website-theme.css';
import './styles/living-paper-polish.css';

const note: SkribNote = {
  id: 'source-preview-2026-09-27',
  target_process_name: 'Code.exe',
  target_title: 'Skribli — Visual Studio Code',
  rel_x: 0,
  rel_y: 0,
  width: 520,
  height: 500,
  text: '',
  color: 'peach',
  collapsed: false,
  created_at: 0,
  updated_at: 0,
};

useLicenseStore.getState().init();
document.documentElement.dataset.skriblyWindow = 'note';
const style = document.createElement('style');
style.textContent = `
  html, body, #root { background: #252722 !important; }
  #root { display: grid; place-items: center; }
  .skrib-composer-backdrop {
    position: relative; inset: auto;
    width: min(520px, 100vw); height: min(500px, 100vh);
  }
`;
document.head.appendChild(style);
ReactDOM.createRoot(document.getElementById('root')!).render(<SkribComposer note={note} target={null} openAction="created" />);
