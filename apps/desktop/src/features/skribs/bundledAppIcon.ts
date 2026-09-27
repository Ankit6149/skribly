import vscodeIcon from '../../assets/vscode-flat.svg';
import chromeIcon from '../../assets/supericons/googlechrome.svg';
import firefoxIcon from '../../assets/supericons/firefox.svg';

// Prefer the icon read from the running Windows app. These bundled marks keep
// common contexts identifiable when that app is closed or exposes no window icon.
export function bundledAppIcon(processName: string | null | undefined): string | null {
  switch (processName?.trim().toLowerCase()) {
    case 'code.exe':
      return vscodeIcon;
    case 'chrome.exe':
      return chromeIcon;
    case 'firefox.exe':
      return firefoxIcon;
    default:
      return null;
  }
}
