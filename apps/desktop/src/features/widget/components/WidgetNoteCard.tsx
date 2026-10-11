import type React from 'react';
import { LoaderCircle, MapPinned } from 'lucide-react';
import type { SkribNote } from '../../notes/model/noteTypes';
import { noteColorStyle } from '../../notes/model/noteColors';
import { contextDisplayTitle } from '../../notes/model/contextDisplayTitle';
import { applicationLabel } from '../model/contextRailModel';
import { WidgetContextIcon } from './WidgetContextIcon';

export function WidgetNoteCard({
  note, index, active, opening, anyOpening, contextual, archived, iconUrl, onRead, onReturn,
}: {
  note: SkribNote; index: number; active: boolean; opening: boolean; anyOpening: boolean;
  contextual: boolean; archived: boolean; iconUrl: string | undefined;
  onRead: () => void; onReturn: () => void;
}) {
  const firstLine = note.text.trim().split(/\r?\n/u, 1)[0]?.trim();
  const title = contextual
    ? firstLine || contextDisplayTitle(note.target_title, note.target_process_name)
    : contextDisplayTitle(note.target_title, note.target_process_name);
  const preview = contextual ? note.text.trim().split(/\r?\n/u).slice(1).join(' ').trim() : note.text.trim();
  const hasContext = Boolean(note.target_process_name.trim() || note.target_title.trim());
  return (
    <article className={`skrib-ribbon skrib-color-${note.color} ${active ? 'active' : ''}`}
      style={{ ...noteColorStyle(note.color), '--ribbon-index': index } as React.CSSProperties} aria-busy={opening}>
      <button type="button" className="skrib-ribbon-read" onClick={onRead} disabled={anyOpening}
        aria-label={`${archived ? 'Restore' : 'Open'} ${title}`}
        title={archived ? 'Return this Skrib to your active notes' : 'Open this Skrib here'}>
        <span className="skrib-ribbon-mark" aria-hidden="true">
          <WidgetContextIcon processName={note.target_process_name ?? ''} iconUrl={iconUrl} />
        </span>
        <span className="skrib-ribbon-copy">
          <strong title={title}>{title}</strong>
          <small title={note.target_title || undefined}>
            {contextual ? note.target_title || applicationLabel(note.target_process_name) : applicationLabel(note.target_process_name)}
          </small>
          {preview && <span className={contextual ? 'skrib-card-preview' : 'global-note-preview'}>{preview}</span>}
          {contextual && <span className="skrib-card-open">{archived ? 'Restore Skrib' : 'Open Skrib'}</span>}
        </span>
        {!contextual && <span className="ticket-open-label">{archived ? 'Restore' : 'Open'}</span>}
        {opening && <LoaderCircle className="rail-opening-spinner" size={16} aria-hidden="true" />}
      </button>
      {!archived && hasContext && <button type="button" className="skrib-ribbon-return"
        onClick={onReturn} disabled={anyOpening} aria-label={`Return to where ${title} was placed`}
        title="Return to the app where this Skrib was placed">
        <MapPinned size={16} strokeWidth={1.9} aria-hidden="true" />
        {!contextual && <span>Return</span>}
      </button>}
    </article>
  );
}
