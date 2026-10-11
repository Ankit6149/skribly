import type { CSSProperties } from 'react';
import { noteColorStyle } from '../../notes/model/noteColors';
import { GENERIC_APP_ICON } from '../../notes/bundledAppIcon';
import type { NoteGroup } from '../model/contextRailModel';
import { WidgetContextIcon } from './WidgetContextIcon';

export function WidgetAppStrip({
  groups,
  selectedGroupKey,
  visibleNoteCount,
  appIcons,
  onSelect,
}: {
  groups: NoteGroup[];
  selectedGroupKey: string | null;
  visibleNoteCount: number;
  appIcons: Record<string, string>;
  onSelect: (key: string | null) => void;
}) {
  if (groups.length <= 1) return null;

  return (
    <nav className="ribbon-context-strip" aria-label="Apps with Skribs">
      <button
        type="button"
        className={selectedGroupKey === null ? 'active' : ''}
        onClick={() => onSelect(null)}
        aria-pressed={selectedGroupKey === null}
        aria-label="Show all apps"
        title="Every app in this view"
      >
        <img className="ribbon-app-icon flat-app-icon" src={GENERIC_APP_ICON} alt="" aria-hidden="true" />
        <span className="rail-app-label">All apps</span>
        <span>{visibleNoteCount}</span>
      </button>
      {groups.map((group) => {
        const processName = group.notes[0]?.target_process_name ?? group.key;
        return (
          <button
            type="button"
            key={group.key}
            style={noteColorStyle(group.notes[0]!.color) as CSSProperties}
            className={selectedGroupKey === group.key ? 'active' : ''}
            aria-pressed={selectedGroupKey === group.key}
            onClick={() => onSelect(group.key)}
            aria-label={`${group.label}, ${group.notes.length} Skribs`}
            title={`${group.label} · ${group.notes.length}`}
          >
            <WidgetContextIcon
              processName={processName}
              iconUrl={appIcons[processName.toLowerCase()]}
            />
            <span className="rail-app-label">{group.label}</span>
            <span>{group.notes.length}</span>
          </button>
        );
      })}
    </nav>
  );
}
