export type WindowKind = 'home' | 'rail' | 'overlay';

interface ResolveWindowLabelInput {
  nativeLabel: string;
  isDev: boolean;
  search: string;
}

export function resolveWindowLabel({
  nativeLabel,
  isDev,
  search,
}: ResolveWindowLabelInput): string {
  if (!isDev) return nativeLabel;

  const params = new URLSearchParams(search);
  const previewWindow = params.get('skriblyWindow');

  if (previewWindow === 'global-rail-handle') return 'global-rail-handle';
  if (previewWindow === 'rail') {
    return params.get('railMode') === 'context' ? 'context-rail' : 'rail';
  }

  return nativeLabel;
}

export function classifyWindow(windowLabel: string): WindowKind {
  if (windowLabel === 'home') return 'home';
  if (
    windowLabel === 'rail' ||
    windowLabel === 'context-rail' ||
    windowLabel === 'global-rail-handle'
  ) {
    return 'rail';
  }
  return 'overlay';
}
