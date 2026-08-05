import type { SkribNote } from '../../lib/geometry';

export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_SECONDS = TRASH_RETENTION_DAYS * 24 * 60 * 60;

export type LibraryLifecycleView = 'notes' | 'trash';

export interface TrashRetentionInfo {
  state: 'retained' | 'expired' | 'invalid';
  deletedAt: number | null;
  expiresAt: number | null;
  daysRemaining: number | null;
}

export function isTrashedNote(note: SkribNote): boolean {
  return note.deleted_at !== null && note.deleted_at !== undefined;
}

export function filterNotesForLifecycle(
  notes: SkribNote[],
  view: LibraryLifecycleView
): SkribNote[] {
  return notes.filter((note) =>
    view === 'trash' ? isTrashedNote(note) : !isTrashedNote(note)
  );
}

export function trashRetentionInfo(
  deletedAt: number | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): TrashRetentionInfo {
  if (
    typeof deletedAt !== 'number' ||
    !Number.isFinite(deletedAt) ||
    deletedAt <= 0 ||
    !Number.isSafeInteger(deletedAt)
  ) {
    return {
      state: 'invalid',
      deletedAt: null,
      expiresAt: null,
      daysRemaining: null,
    };
  }

  const safeNow = Number.isFinite(nowSeconds) && nowSeconds >= 0
    ? Math.floor(nowSeconds)
    : deletedAt;
  const expiresAt = deletedAt + TRASH_RETENTION_SECONDS;
  const secondsRemaining = expiresAt - safeNow;

  if (secondsRemaining <= 0) {
    return {
      state: 'expired',
      deletedAt,
      expiresAt,
      daysRemaining: 0,
    };
  }

  return {
    state: 'retained',
    deletedAt,
    expiresAt,
    daysRemaining: Math.ceil(secondsRemaining / (24 * 60 * 60)),
  };
}

export function trashRetentionLabel(info: TrashRetentionInfo): string {
  if (info.state === 'invalid') {
    return 'Deletion time unavailable — kept until reviewed';
  }
  if (info.state === 'expired') {
    return 'Retention period ended — review before permanent deletion';
  }
  if (info.daysRemaining === 1) return '1 day remaining in Trash';
  return `${info.daysRemaining ?? TRASH_RETENTION_DAYS} days remaining in Trash`;
}
