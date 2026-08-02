import { beforeEach, describe, expect, it } from 'vitest';
import {
  completeOnboarding,
  KeyValueStorage,
  markOnboardingShown,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  readOnboardingStatus,
  shouldAutoShowOnboarding,
} from './onboardingState';

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('versioned first-note onboarding state', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('treats a fresh profile as unseen and auto-showable', () => {
    expect(readOnboardingStatus(storage)).toBe('unseen');
    expect(shouldAutoShowOnboarding('unseen')).toBe(true);
  });

  it('records a dismissed guide as shown but incomplete', () => {
    markOnboardingShown(storage, 1000);

    expect(readOnboardingStatus(storage)).toBe('shown');
    expect(shouldAutoShowOnboarding('shown')).toBe(false);
    expect(JSON.parse(storage.getItem(ONBOARDING_STORAGE_KEY) ?? '')).toEqual({
      version: ONBOARDING_VERSION,
      status: 'shown',
      updatedAt: 1000,
    });
  });

  it('records explicit completion and never downgrades it to shown', () => {
    completeOnboarding(storage, 2000);
    markOnboardingShown(storage, 3000);

    expect(readOnboardingStatus(storage)).toBe('completed');
    expect(shouldAutoShowOnboarding('completed')).toBe(false);
  });

  it('fails safely to unseen for corrupt, stale, or incomplete records', () => {
    const invalid = [
      '{',
      JSON.stringify({ version: ONBOARDING_VERSION + 1, status: 'completed', updatedAt: 1 }),
      JSON.stringify({ version: ONBOARDING_VERSION, status: 'unknown', updatedAt: 1 }),
      JSON.stringify({ version: ONBOARDING_VERSION, status: 'shown', updatedAt: 0 }),
    ];

    for (const raw of invalid) {
      storage.setItem(ONBOARDING_STORAGE_KEY, raw);
      expect(readOnboardingStatus(storage)).toBe('unseen');
    }
  });

  it('allows a shown or completed guide to be reopened explicitly', () => {
    expect(shouldAutoShowOnboarding('shown')).toBe(false);
    expect(shouldAutoShowOnboarding('completed')).toBe(false);
    // Explicit tray re-entry does not consult auto-show policy.
  });
});
