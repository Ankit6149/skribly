import { AppWindow, Code2, Folder, Globe2 } from 'lucide-react';
import { bundledAppIcon } from '../../skribs/bundledAppIcon';

interface ContextIconProps {
  processName: string;
  iconUrl?: string;
}

export function ContextIcon({ processName, iconUrl }: ContextIconProps) {
  const logo = iconUrl || bundledAppIcon(processName);
  if (logo) return <img className="ribbon-app-icon" src={logo} alt="" aria-hidden="true" />;

  const process = processName.toLowerCase();
  if (process === 'explorer.exe') return <Folder size={14} aria-hidden="true" />;
  if (process.includes('chrome') || process.includes('edge') || process.includes('firefox')) {
    return <Globe2 size={14} aria-hidden="true" />;
  }
  if (process.includes('code')) return <Code2 size={14} aria-hidden="true" />;
  return <AppWindow size={14} aria-hidden="true" />;
}
