import type { SkribReminder } from '../../reminders/persistence/reminderStore';
import type { StoredRichContent } from '../persistence/richContentStore';
import type { SkribNote } from '../model/noteTypes';

export interface NoteSessionSnapshot {
  text: string;
  color: SkribNote['color'];
  rich: Omit<StoredRichContent, 'discardRecovery'>;
  reminders: SkribReminder[];
}

export interface NoteDiscardRecovery {
  version: 1;
  current: NoteSessionSnapshot;
  baseline: NoteSessionSnapshot;
}

export interface DiscardRecoveryOperations {
  retain: (recovery: NoteDiscardRecovery) => Promise<void>;
  restoreRich: (snapshot: NoteSessionSnapshot) => Promise<void>;
  restoreReminders: (snapshot: NoteSessionSnapshot) => Promise<void>;
  restoreColor: (snapshot: NoteSessionSnapshot) => Promise<void>;
  restoreText: (snapshot: NoteSessionSnapshot) => Promise<void>;
  finish: () => Promise<void>;
  clear: () => Promise<void>;
}

/** Persist both sides before any cross-store replacement. Retain the intent if rollback fails. */
export async function discardWithRecovery(recovery: NoteDiscardRecovery, operations: DiscardRecoveryOperations) {
  await operations.retain(recovery);
  try {
    await restoreNoteSession(recovery.baseline, operations);
    await operations.clear();
  } catch (error) {
    try {
      await restoreNoteSession(recovery.current, operations);
      await operations.clear();
      return { discarded: false, recovered: true, closed: false, error };
    } catch {
      return { discarded: false, recovered: false, closed: false, error };
    }
  }
  // Intent removal is the commit. Closing/deleting afterwards cannot trigger rollback
  // into a native record that may already have been deleted or hidden.
  try {
    await operations.finish();
    return { discarded: true, recovered: true, closed: true, error: null };
  } catch (error) {
    return { discarded: true, recovered: true, closed: false, error };
  }
}

export async function restoreNoteSession(snapshot: NoteSessionSnapshot,
  operations: Pick<DiscardRecoveryOperations, 'restoreRich' | 'restoreReminders' | 'restoreColor' | 'restoreText'>) {
  // Restore files first; a failed later operation must still have both blob snapshots in the intent.
  await operations.restoreRich(snapshot);
  await operations.restoreReminders(snapshot);
  await operations.restoreColor(snapshot);
  await operations.restoreText(snapshot);
}
