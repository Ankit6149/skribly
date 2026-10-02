import { ArchiveRestore, MapPin, Search, StickyNote } from 'lucide-react';
import type { RailScope } from '../model/railTypes';

export function GlobalWidgetControls({
  scope,
  query,
  onScope,
  onQuery,
}: {
  scope: RailScope;
  query: string;
  onScope: (scope: RailScope) => void;
  onQuery: (query: string) => void;
}) {
  return (
    <>
      <nav className="global-shelf-scopes" aria-label="Which Skribs to show">
        <button type="button" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>
          <StickyNote size={15} aria-hidden="true" />
          All notes
        </button>
        <button type="button" aria-pressed={scope === 'context'} onClick={() => onScope('context')}>
          <MapPin size={15} aria-hidden="true" />
          Here
        </button>
        <button type="button" aria-pressed={scope === 'archive'} onClick={() => onScope('archive')}>
          <ArchiveRestore size={15} aria-hidden="true" />
          Archived
        </button>
      </nav>
      <label className="global-shelf-search">
        <Search size={17} aria-hidden="true" />
        <input
          aria-label="Search saved Skribs"
          placeholder="Find a thought…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
    </>
  );
}

export function ContextWidgetScopeMenu({
  open,
  scope,
  contextCount,
  activeCount,
  archivedCount,
  onScope,
}: {
  open: boolean;
  scope: RailScope;
  contextCount: number;
  activeCount: number;
  archivedCount: number;
  onScope: (scope: RailScope) => void;
}) {
  if (!open) return null;

  return (
    <nav className="ribbon-scope-menu" aria-label="Which Skribs to show">
      <button
        className={scope === 'context' ? 'active' : ''}
        type="button"
        onClick={() => onScope('context')}
      >
        <MapPin size={14} aria-hidden="true" /> Here <span>{contextCount}</span>
      </button>
      <button
        className={scope === 'all' ? 'active' : ''}
        type="button"
        onClick={() => onScope('all')}
      >
        <Search size={14} aria-hidden="true" /> Everything <span>{activeCount}</span>
      </button>
      <button
        className={scope === 'archive' ? 'active' : ''}
        type="button"
        onClick={() => onScope('archive')}
      >
        <ArchiveRestore size={14} aria-hidden="true" /> Archived <span>{archivedCount}</span>
      </button>
    </nav>
  );
}
