import { describe, expect, it } from 'vitest';
import { captureErrorTitle, TargetCaptureErrorPayload } from './targetCaptureError';

describe('target capture error hierarchy', () => {
  it.each<
    [TargetCaptureErrorPayload['code'], string]
  >([
    ['noForegroundWindow', 'Choose an application first'],
    ['skribliIsForeground', 'Choose an application first'],
    ['desktopOrSystemSurface', 'Choose an application first'],
    ['minimizedWindow', 'Restore the application'],
    ['hiddenOrDestroyedWindow', 'The target window changed'],
    ['foregroundChanged', 'The target window changed'],
    ['targetExpired', 'The target window changed'],
    ['processIdentityChanged', 'The target window changed'],
    ['missingProcessIdentity', 'This window is not supported yet'],
    ['invalidWindowBounds', 'This window is not supported yet'],
    ['unsupportedWindow', 'This window is not supported yet'],
  ])('maps %s to one clear recovery decision', (code, expected) => {
    expect(captureErrorTitle(code)).toBe(expected);
  });
});
