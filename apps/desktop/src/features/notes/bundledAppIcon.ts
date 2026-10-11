import vscodeIcon from '../../assets/supericons/vscode.svg';
import chromeIcon from '../../assets/supericons/googlechrome.svg';
import folderIcon from '../../assets/supericons/folder_fill.svg';
import documentIcon from '../../assets/supericons/document_fill.svg';
import firefoxIcon from '../../assets/supericons/firefox.svg';

export const GENERIC_APP_ICON = documentIcon;

// Supericons marks define the known-app appearance, independent of Windows logos.
export function bundledAppIcon(processName: string | null | undefined): string | null {
  switch (processName?.trim().toLowerCase()) {
    case 'explorer.exe':
      return folderIcon;
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
