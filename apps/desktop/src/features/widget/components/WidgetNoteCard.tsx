import type React from 'react';
import { LoaderCircle, MapPinned } from 'lucide-react';
import type { SkribNote } from '../../notes/model/noteTypes';
import { applicationLabel } from '../model/contextRailModel';
import { WidgetContextIcon } from './WidgetContextIcon';

function noteTitle(note: SkribNote): string {
  const firstLine = note.text.trim().split(/\r?\n/, 1)[0]?.trim();
  return firstLine || note.target_title || applicationLabel(note.target_process_name);
}

export function WidgetNoteCard({
  note,
  index,
  active,
  opening,
  anyOpening,
  contextual,
  archived,
  iconUrl,
  onRead,
  onReturn,
}: {
  note: SkribNote;
  index: number;
  active: boolean;
  opening: boolean;
  anyOpening: boolean;
  contextual: boolean;
  archived: boolean;
  iconUrl: string | undefined;
  onRead: () => void;
  onReturn: () => void;
}) {
  const title = noteTitle(note);
  return (
    <article
      className={`skrib-ribbon skrib-color-${note.color} ${active ? 'active' : ''}`}
      style={{ '--ribbon-index': index } as React.CSSProperties}
      aria-busy={opening}
    >
      <button
        type="button"
        className="skrib-ribbon-read"
        onClick={onRead}
        disabled={anyOpening}
        title={archived ? 'Return this Skrib to your active notes' : 'Open this Skrib beside the ribbon'}
      >
        <span className="skrib-ribbon-mark" aria-hidden="true">
          <WidgetContextIcon processName={note.target_process_name ?? ''} iconUrl={iconUrl} />
        </span>
        <span className="skrib-ribbon-copy">
          <strong title={!contextual ? title : undefined}>{title}</strong>
          <small title={note.target_title || undefined}>
            {!contextual && <span className="global-note-tone" aria-hidden="true" />}
            <span className={!contextual ? 'global-note-context' : undefined}>
              {note.target_title || applicationLabel(note.target_process_name)}
            </span>
          </small>
          {!contextual && note.text.trim().includes('\n') && (
            <span className="global-note-preview">
              {note.text.trim().split(/\r?\n/).slice(1).join(' ')}
            </span>
          )}
          {contextual && (
            <span className="skrib-card-preview">
              {note.text.trim() || 'A little room for your next thought.'}
            </span>
          )}
          {contextual && (
            <span className="skrib-card-open">{archived ? 'Restore Skrib' : 'Open Skrib'}</span>
          )}
        </span>
        {opening && <LoaderCircle className="rail-opening-spinner" size={16} aria-hidden="true" />}
      </button>
      {!archived && (
        <button
          type="button"
          className="skrib-ribbon-return"
          onClick={onReturn}
          disabled={anyOpening}
          aria-label={`Return to where ${title} was placed`}
          title="Return to the app where this Skrib was placed"
        >
          <MapPinned size={16} strokeWidth={1.9} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
