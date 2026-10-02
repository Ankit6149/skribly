import {
  MAX_NOTE_CHARACTERS,
  type DraftSaveSnapshot,
} from '../lifecycle/draftSaveController';

export function NoteSaveIndicator({
  snapshot,
  showSavedPulse,
  saveLabel,
  saveDetail,
}: {
  snapshot: DraftSaveSnapshot;
  showSavedPulse: boolean;
  saveLabel: string;
  saveDetail: string;
}) {
  return (
    <div
      id="composer-save-status"
      className="composer-save-indicator"
      data-state={snapshot.status}
      data-visible={snapshot.status !== 'saved' || showSavedPulse || undefined}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden={snapshot.status === 'saved' && !showSavedPulse}>
        {snapshot.status === 'saving'
          ? 'Saving…'
          : snapshot.status === 'failed'
            ? 'Save failed'
            : snapshot.status === 'dirty'
              ? 'Unsaved'
              : 'Saved locally'}
      </span>
      <span className="sr-only">
        {saveLabel}. {saveDetail}
      </span>
      <small
        id="composer-character-count"
        className={
          snapshot.characterCount > MAX_NOTE_CHARACTERS * 0.9
            ? 'composer-character-count'
            : 'sr-only'
        }
      >
        {snapshot.characterCount.toLocaleString()} / {MAX_NOTE_CHARACTERS.toLocaleString()}
      </small>
    </div>
  );
}
