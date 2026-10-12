import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/kalam/400.css';
import './styles/global.css';
import './styles/accessibility.css';
import './styles/website-theme.css';
import { ContextRail } from './features/widget/ContextRail';
import type { SkribNote } from './features/notes/model/noteTypes';

// Isolated, device-local design fixture. These are not saved or loaded into the real app.
const samples = [
  ['Code.exe', 'main.tsx — Skribli — Visual Studio Code', 'Make the shortcut feel instant.', 'green'],
  ['chrome.exe', 'Design notes · Figma - Google Chrome', 'Keep the first action easy to find.', 'orange'],
  ['chrome.exe', 'Release notes · GitHub - Google Chrome', 'Check the release timeline.', 'lime'],
  ['explorer.exe', 'References - File Explorer', 'Keep screenshots and notes together.', 'olive'],
  ['chrome.exe', 'Research paper - Google Chrome', 'Compare the two methods.', 'charcoal'],
  ['Code.exe', 'routes.ts — Website — Visual Studio Code', 'Check the download route.', 'cobalt'],
  ['explorer.exe', 'Project assets - File Explorer', 'Keep the final files here.', 'cream'],
  ['chrome.exe', 'Article draft - Google Chrome', 'Save the example from section two.', 'red'],
  ['Code.exe', 'schema.rs — Database — Visual Studio Code', 'Review the migration before shipping.', 'stone'],
  ['chrome.exe', 'Reading list - Google Chrome', 'Come back to this chapter.', 'orange'],
  ['chrome.exe', 'Prototype · Figma - Google Chrome', 'Try the wider spacing.', 'lime'],
  ['Code.exe', 'shortcuts.rs — Desktop — Visual Studio Code', 'Keep one shortcut for capture.', 'green'],
  ['chrome.exe', 'Lecture notes - Google Chrome', 'Look up the last example.', 'cobalt'],
  ['chrome.exe', 'Playlist - Google Chrome', 'Keep this for a quiet work session.', 'wine'],
  ['explorer.exe', 'Archive - File Explorer', 'Check the original version.', 'black'],
  ['chrome.exe', 'Sketchbook - Google Chrome', 'Keep the bright red.', 'red'],
  ['chrome.exe', 'Market research - Google Chrome', 'Review the three examples.', 'cream'],
  ['', '', 'An idea for later.', 'orange'],
] as const;
const notes: SkribNote[] = samples.map(([process, title, text, color], index) => ({
  id: `widget-preview-${index}`, target_process_name: process, target_title: title,
  rel_x: 0, rel_y: 0, width: 420, height: 360, text, color, collapsed: false,
  created_at: index, updated_at: index,
}));
document.documentElement.dataset.skriblyWindow = 'rail';
const options = new URLSearchParams(window.location.search);
const openPreviewNote = (note: SkribNote) => {
  const app = note.target_process_name.toLowerCase().includes('chrome') ? 'chrome'
    : note.target_process_name.toLowerCase().includes('explorer') ? 'explorer'
      : note.target_process_name ? 'code' : 'general';
  const query = new URLSearchParams({ app, title: note.target_title, text: note.text, color: note.color });
  window.location.assign(`note-source-preview.html?${query.toString()}`);
};
ReactDOM.createRoot(document.getElementById('root')!).render(<ContextRail contextual={false}
  previewNotes={options.get('empty') === 'true' ? [] : options.get('railMode') === 'context'
    ? notes.filter((note) => note.target_process_name === 'Code.exe') : notes} previewDockSide={options.get('side') === 'left' ? 'left' : 'right'}
  onPreviewOpen={openPreviewNote} />);
