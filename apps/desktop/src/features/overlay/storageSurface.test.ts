import { describe, expect, it } from 'vitest';
import { selectStorageSurface } from './storageSurface';

describe('selectStorageSurface', () => {
  it('keeps a verified note visible even when storage is read only', () => {
    expect(
      selectStorageSurface({
        hasComposerNote: true,
        storageWritable: false,
        hasStorageError: true,
        hasStorageNotice: true,
      })
    ).toBe('composer');
  });

  it('shows recovery when no note can load and storage is blocked', () => {
    expect(
      selectStorageSurface({
        hasComposerNote: false,
        storageWritable: false,
        hasStorageError: true,
        hasStorageNotice: false,
      })
    ).toBe('recovery');
  });

  it('shows a successful recovery notice even without an active composer note', () => {
    expect(
      selectStorageSurface({
        hasComposerNote: false,
        storageWritable: true,
        hasStorageError: false,
        hasStorageNotice: true,
      })
    ).toBe('recovery');
  });

  it('renders nothing only when there is no note and storage needs no attention', () => {
    expect(
      selectStorageSurface({
        hasComposerNote: false,
        storageWritable: true,
        hasStorageError: false,
        hasStorageNotice: false,
      })
    ).toBe('empty');
  });
});
