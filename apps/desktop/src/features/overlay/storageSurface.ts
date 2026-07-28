export type StorageSurface = 'composer' | 'recovery' | 'empty';

export interface StorageSurfaceState {
  hasComposerNote: boolean;
  storageWritable: boolean;
  hasStorageError: boolean;
  hasStorageNotice: boolean;
}

export function selectStorageSurface(state: StorageSurfaceState): StorageSurface {
  if (state.hasComposerNote) return 'composer';
  if (!state.storageWritable || state.hasStorageError || state.hasStorageNotice) {
    return 'recovery';
  }
  return 'empty';
}
