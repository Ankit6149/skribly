export const ONBOARDING_VERSION = 2;
export const ONBOARDING_STORAGE_KEY = `skribli.onboarding.v${ONBOARDING_VERSION}`;

export type OnboardingStatus = 'unseen' | 'shown' | 'completed';

interface StoredOnboardingState {
  version: number;
  status: Exclude<OnboardingStatus, 'unseen'>;
  updatedAt: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isStoredState(value: unknown): value is StoredOnboardingState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredOnboardingState>;
  return (
    candidate.version === ONBOARDING_VERSION &&
    (candidate.status === 'shown' || candidate.status === 'completed') &&
    typeof candidate.updatedAt === 'number' &&
    Number.isFinite(candidate.updatedAt) &&
    candidate.updatedAt > 0
  );
}

export function readOnboardingStatus(storage: KeyValueStorage): OnboardingStatus {
  const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) return 'unseen';

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredState(parsed) ? parsed.status : 'unseen';
  } catch {
    return 'unseen';
  }
}

function writeStatus(
  storage: KeyValueStorage,
  status: StoredOnboardingState['status'],
  now = Date.now()
): void {
  const state: StoredOnboardingState = {
    version: ONBOARDING_VERSION,
    status,
    updatedAt: now,
  };
  storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}

export function markOnboardingShown(storage: KeyValueStorage, now = Date.now()): void {
  if (readOnboardingStatus(storage) === 'completed') return;
  writeStatus(storage, 'shown', now);
}

export function completeOnboarding(storage: KeyValueStorage, now = Date.now()): void {
  writeStatus(storage, 'completed', now);
}

export function shouldAutoShowOnboarding(status: OnboardingStatus): boolean {
  return status === 'unseen';
}
