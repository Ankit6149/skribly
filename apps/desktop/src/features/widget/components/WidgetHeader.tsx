import { ChevronLeft, ChevronRight, GripHorizontal, MoreHorizontal, Plus } from 'lucide-react';
import skribliLogo from '../../../../src-tauri/icons/128x128.png';

export function WidgetHeader({
  contextual,
  title,
  noteCount,
  dockSide,
  menuOpen,
  closing,
  onCreate,
  onToggleMenu,
  onCollapse,
}: {
  contextual: boolean;
  title: string;
  noteCount: number;
  dockSide: 'left' | 'right';
  menuOpen: boolean;
  closing: boolean;
  onCreate?: () => void;
  onToggleMenu: () => void;
  onCollapse: () => void;
}) {
  return (
    <header className="ribbon-rail-head" data-tauri-drag-region>
      <span className="ribbon-rail-brand" data-tauri-drag-region>
        <GripHorizontal size={15} aria-hidden="true" data-tauri-drag-region />
        <img src={skribliLogo} alt="" aria-hidden="true" data-tauri-drag-region />
        <span data-tauri-drag-region>
          <strong data-tauri-drag-region>{title}</strong>
          <small data-tauri-drag-region>
            {noteCount} {noteCount === 1 ? 'saved thought' : 'saved thoughts'}
          </small>
        </span>
      </span>
      <span className="ribbon-rail-actions">
        {!contextual && onCreate && (
          <button
            type="button"
            disabled={closing}
            onClick={onCreate}
            aria-label="New general Skrib"
            title="New Skrib without an app"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        )}
        {contextual && (
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="Choose which Skribs to show"
            aria-expanded={menuOpen}
            title="Here, everything, or archived Skribs"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          disabled={closing}
          onClick={onCollapse}
          aria-label="Collapse Skrib ribbons"
          title="Keep your thoughts tucked away"
        >
          {dockSide === 'left' ? (
            <ChevronLeft size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>
      </span>
    </header>
  );
}
