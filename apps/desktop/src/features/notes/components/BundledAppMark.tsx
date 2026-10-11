import { Icon } from '@iconify/react/offline';
import document from '@iconify-icons/solar/document-text-bold';
import folder from '@iconify-icons/solar/folder-bold';
import { bundledAppIcon } from '../bundledAppIcon';
import codeSvg from '../../../assets/supericons/vscode.svg?raw';
import chromeSvg from '../../../assets/supericons/googlechrome.svg?raw';
import firefoxSvg from '../../../assets/supericons/firefox.svg?raw';
import siteIcons from '../../../assets/site-icons.json';
import { browserSiteMark } from '../model/browserSiteMark';

// Existing licensed app marks are rendered by Iconify offline, in one ink.
function svgData(source: string) {
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
  return { width: viewBox?.[2] ?? 24, height: viewBox?.[3] ?? 24,
    body: source.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '') };
}
const marks = new Map<string | null, typeof document>([
  [bundledAppIcon('code.exe'), svgData(codeSvg)],
  [bundledAppIcon('chrome.exe'), svgData(chromeSvg)],
  [bundledAppIcon('firefox.exe'), svgData(firefoxSvg)],
  [bundledAppIcon('explorer.exe'), folder],
]);

export function BundledAppMark({ src, className, processName = '', contextTitle = '' }: {
  src: string | null | undefined; className: string; processName?: string; contextTitle?: string;
}) {
  const site = browserSiteMark(processName, contextTitle);
  const siteGlyph = site ? siteIcons.icons[site as keyof typeof siteIcons.icons] : undefined;
  const icon = siteGlyph ? { ...siteGlyph, width:siteIcons.width, height:siteIcons.height } : marks.get(src ?? null) ?? document;
  return <Icon icon={icon} className={className} aria-hidden="true" data-tauri-drag-region />;
}
