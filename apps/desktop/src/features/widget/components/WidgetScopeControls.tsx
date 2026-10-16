import { useEffect, useRef } from 'react';
import { ArchiveRestore, MapPin, Search, StickyNote, X } from '../../../ui/icons';
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
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', find);
    return () => window.removeEventListener('keydown', find);
  }, []);
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
      <div className="global-shelf-search" role="search" aria-label="Find saved Skribs">
        <Search size={17} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          aria-label="Search saved Skribs"
          placeholder="Find a thought…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        {query && <button type="button" className="search-clear" aria-label="Clear search"
          onClick={() => { onQuery(''); searchRef.current?.focus(); }}><X size={15} aria-hidden="true" /></button>}
      </div>
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
        aria-pressed={scope === 'context'}
        type="button"
        onClick={() => onScope('context')}
      >
        <MapPin size={14} aria-hidden="true" /> Here <span>{contextCount}</span>
      </button>
      <button
        className={scope === 'all' ? 'active' : ''}
        aria-pressed={scope === 'all'}
        type="button"
        onClick={() => onScope('all')}
      >
        <Search size={14} aria-hidden="true" /> Everything <span>{activeCount}</span>
      </button>
      <button
        className={scope === 'archive' ? 'active' : ''}
        aria-pressed={scope === 'archive'}
        type="button"
        onClick={() => onScope('archive')}
      >
        <ArchiveRestore size={14} aria-hidden="true" /> Archived <span>{archivedCount}</span>
      </button>
    </nav>
  );
}
