import { useEffect, useState, type CSSProperties, type Ref } from 'react';
import { BundledAppMark } from './BundledAppMark';
import type { NoteColor } from '../model/noteColors';
import { chooseContextPillColor, previousContextPillColor, rememberContextPillColor } from '../model/contextPillColors';

export function NotePlaceHeader({
  contextTabRef,
  noteId,
  noteColor,
  contextLabel,
  contextFullAppLabel,
  appIconUrl,
  isNewNote,
  hasSavedContext,
  placeDetailOpen,
  onPlaceDetailOpen,
}: {
  contextTabRef: Ref<HTMLDivElement>;
  noteId: string;
  noteColor: NoteColor;
  contextLabel: string;
  contextFullAppLabel: string;
  appIconUrl: string | null;
  isNewNote: boolean;
  hasSavedContext: boolean;
  placeDetailOpen: boolean;
  onPlaceDetailOpen: (open: boolean) => void;
}) {
  const [choice, setChoice] = useState(() => ({
    noteId, noteColor, pill: chooseContextPillColor(noteColor, previousContextPillColor(noteId)),
  }));
  if (choice.noteId !== noteId || choice.noteColor !== noteColor) {
    setChoice({ noteId, noteColor, pill: chooseContextPillColor(noteColor, choice.noteId === noteId ? choice.pill.id : previousContextPillColor(noteId)) });
  }
  useEffect(() => { rememberContextPillColor(choice.noteId, choice.pill.id); }, [choice]);
  const pillStyle = {
    '--context-pill-paper': choice.pill.background,
    '--context-pill-ink': choice.pill.foreground,
    '--context-pill-icon-filter': choice.pill.iconFilter,
  } as CSSProperties;
  return (
    <>
      <header className="composer-paper-top" data-tauri-drag-region>
        {hasSavedContext && (
          <div
            ref={contextTabRef}
            className="composer-context-tab"
            style={pillStyle}
            data-pill-color={choice.pill.id}
            data-tauri-drag-region
            tabIndex={0}
            aria-label={`Place: ${contextLabel}`}
            aria-describedby="composer-place-detail"
            onPointerEnter={() => onPlaceDetailOpen(true)}
            onPointerLeave={() => onPlaceDetailOpen(false)}
            onFocus={() => onPlaceDetailOpen(true)}
            onBlur={() => onPlaceDetailOpen(false)}
          >
            <BundledAppMark className="composer-context-app-icon" src={appIconUrl} />
          </div>
        )}
        {hasSavedContext && <strong className="composer-context-title" title={contextLabel} data-tauri-drag-region>{contextLabel}</strong>}
        <span id="composer-open-state" className="sr-only">
          {hasSavedContext
            ? isNewNote
              ? 'Skribli created a new empty Skrib for this application context.'
              : 'Skribli reopened the existing Skrib for this application context.'
            : isNewNote
              ? 'Skribli created a new general Skrib without an application context.'
              : 'Skribli opened this general Skrib without an application context.'}
        </span>
      </header>
      {hasSavedContext && (
        <div
          id="composer-place-detail"
          className="composer-place-detail"
          role="note"
          data-open={placeDetailOpen}
        >
          <small>Saved place</small>
          <strong>{contextFullAppLabel}</strong>
          <span>{contextLabel}</span>
        </div>
      )}
    </>
  );
}
