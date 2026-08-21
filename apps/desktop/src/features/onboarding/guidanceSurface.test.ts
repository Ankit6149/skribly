import { describe, expect, it } from 'vitest';
import { selectPrimaryWindowSurface } from './guidanceSurface';

const ready = { type: 'Ready', payload: {} as never } as const;
const failed = { type: 'Failed', payload: 'Shortcut unavailable' } as const;

describe('primary compact-window decision layer', () => {
  it('protects an active draft above every guidance or failure surface', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'composer',
        initStatus: failed,
        hasCaptureError: true,
        onboardingVisible: true,
      })
    ).toBe('composer');
  });

  it('shows storage recovery before startup, capture, or onboarding guidance', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'recovery',
        initStatus: failed,
        hasCaptureError: true,
        onboardingVisible: true,
      })
    ).toBe('recovery');
  });

  it('shows native startup failure before contextual capture guidance', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'empty',
        initStatus: failed,
        hasCaptureError: true,
        onboardingVisible: true,
      })
    ).toBe('startupFailure');
  });

  it('shows capture guidance before onboarding', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'empty',
        initStatus: ready,
        hasCaptureError: true,
        onboardingVisible: true,
      })
    ).toBe('captureError');
  });

  it('uses onboarding only when no work or recovery state is active', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'empty',
        initStatus: ready,
        hasCaptureError: false,
        onboardingVisible: true,
      })
    ).toBe('onboarding');
  });

  it('never selects a visually empty surface while the native window is visible', () => {
    expect(
      selectPrimaryWindowSurface({
        storageSurface: 'empty',
        initStatus: ready,
        hasCaptureError: false,
        onboardingVisible: false,
      })
    ).toBe('preparing');
  });
});
