import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/kalam/400.css';
import './styles/global.css';
import './styles/accessibility.css';
import './styles/website-theme.css';
import { ContextRail } from './features/rail/ContextRail';
import type { SkribNote } from './lib/geometry';

// Isolated, device-local design fixture. These are not saved or loaded into the real app.
const samples = [
  ['chrome.exe', 'Google Chrome', 'Follow up on the research paper\nCompare the two methods before the next review.', 'yellow'],
  ['Code.exe', 'Visual Studio Code', 'Simplify the onboarding flow\nMake the first useful action easy to find.', 'peach'],
  ['chrome.exe', 'Google Chrome', 'Questions for Friday\nAsk about the timeline and the smaller release.', 'lavender'],
  ['explorer.exe', 'File Explorer', 'Collect references for the project\nKeep the screenshots and notes together.', 'mint'],
  ['Code.exe', 'Visual Studio Code', 'A small idea for later\nMake the shortcut feel instant.', 'sky'],
] as const;
const notes: SkribNote[] = samples.map(([process, title, text, color], index) => ({
  id: `widget-preview-${index}`, target_process_name: process, target_title: title,
  rel_x: 0, rel_y: 0, width: 420, height: 360, text, color, collapsed: false,
  created_at: index, updated_at: index,
}));
document.documentElement.dataset.skriblyWindow = 'rail';
const options = new URLSearchParams(window.location.search);
ReactDOM.createRoot(document.getElementById('root')!).render(<ContextRail contextual={false}
  previewNotes={options.get('empty') === 'true' ? [] : notes} previewDockSide={options.get('side') === 'left' ? 'left' : 'right'} />);
