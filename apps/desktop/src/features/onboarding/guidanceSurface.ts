import type { OverlayInitializationStatus } from '../../lib/geometry';
import type { StorageSurface } from '../overlay/storageSurface';

export type PrimaryWindowSurface =
  | 'composer'
  | 'recovery'
  | 'startupFailure'
  | 'captureError'
  | 'onboarding'
  | 'empty';

interface PrimaryWindowSurfaceInput {
  storageSurface: StorageSurface;
  initStatus: OverlayInitializationStatus;
  hasCaptureError: boolean;
  onboardingVisible: boolean;
}

export function selectPrimaryWindowSurface(
  input: PrimaryWindowSurfaceInput
): PrimaryWindowSurface {
  if (input.storageSurface === 'composer') return 'composer';
  if (input.storageSurface === 'recovery') return 'recovery';
  if (input.initStatus.type === 'Failed') return 'startupFailure';
  if (input.hasCaptureError) return 'captureError';
  if (input.onboardingVisible) return 'onboarding';
  return 'empty';
}
