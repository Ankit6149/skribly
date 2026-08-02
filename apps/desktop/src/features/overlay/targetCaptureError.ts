export interface TargetCaptureErrorPayload {
  code:
    | 'noForegroundWindow'
    | 'skribliIsForeground'
    | 'desktopOrSystemSurface'
    | 'hiddenOrDestroyedWindow'
    | 'minimizedWindow'
    | 'missingProcessIdentity'
    | 'invalidWindowBounds'
    | 'foregroundChanged'
    | 'targetExpired'
    | 'processIdentityChanged'
    | 'unsupportedWindow';
  message: string;
}

export function captureErrorTitle(code: TargetCaptureErrorPayload['code']): string {
  switch (code) {
    case 'noForegroundWindow':
    case 'skribliIsForeground':
    case 'desktopOrSystemSurface':
      return 'Choose an application first';
    case 'minimizedWindow':
      return 'Restore the application';
    case 'foregroundChanged':
    case 'targetExpired':
    case 'processIdentityChanged':
    case 'hiddenOrDestroyedWindow':
      return 'The target window changed';
    case 'missingProcessIdentity':
    case 'invalidWindowBounds':
    case 'unsupportedWindow':
      return 'This window is not supported yet';
  }
}
