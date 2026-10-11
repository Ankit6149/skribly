// Presentation only: retain the original captured title for context matching and return.
export function contextDisplayTitle(title: string, processName: string): string {
  const process = processName.trim().toLowerCase().replace(/\.exe$/u, '');
  const clean = title.trim().replace(/^[●•*]\s*/u, '');
  if (!process && !clean) return 'General';
  const appSuffix = /\s+[-–—|]\s+(?:Visual Studio Code(?:\s+\[[^\]]+\])?|Google Chrome|Microsoft Edge|Mozilla Firefox|File Explorer|Windows Explorer)\s*$/iu;
  const withoutApp = clean.replace(appSuffix, '').trim();
  if (process === 'code' || process === 'code - insiders') {
    const parts = withoutApp.split(/\s+[-–—]\s+/u);
    const workspace = parts.length > 1 ? parts[parts.length - 1]!.trim() : withoutApp;
    if (workspace && !/^Visual Studio Code$/iu.test(workspace)) return workspace;
    return 'Visual Studio Code';
  }
  if (withoutApp && !/^(Google Chrome|Microsoft Edge|Mozilla Firefox|File Explorer|Windows Explorer)$/iu.test(withoutApp)) {
    return withoutApp;
  }
  if (/chrome/u.test(process)) return 'Chrome';
  if (/msedge/u.test(process)) return 'Edge';
  if (/firefox/u.test(process)) return 'Firefox';
  if (process === 'explorer') return 'File Explorer';
  return clean || processName.replace(/\.exe$/iu, '') || 'General';
}
