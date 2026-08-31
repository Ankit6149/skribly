import { describe, expect, it } from 'vitest';
import type { SkribNote, TargetWindowInfo } from '../../lib/geometry';
import {
  contextMatchScore,
  groupNotesForRail,
  railPillCount,
  selectBestContextTarget,
} from './contextRailModel';

function note(overrides: Partial<SkribNote> = {}): SkribNote {
  return {
    id: 'note-1',
    target_process_name: 'chrome.exe',
    target_title: 'Skribli — Google Chrome',
    rel_x: 10,
    rel_y: 20,
    width: 420,
    height: 360,
    text: 'Review the launch plan',
    color: 'yellow',
    collapsed: false,
    created_at: 1,
    updated_at: 2,
    deleted_at: null,
    ...overrides,
  };
}

function target(overrides: Partial<TargetWindowInfo> = {}): TargetWindowInfo {
  return {
    hwnd_val: 42,
    title: 'Skribli — Google Chrome',
    process_name: 'chrome.exe',
    class_name: 'Chrome_WidgetWin_1',
    bounds: { x: 0, y: 0, width: 1280, height: 720 },
    is_minimized: false,
    is_focused: true,
    dpi: 96,
    scale_factor: 1,
    ...overrides,
  };
}

describe('context note rail', () => {
  it('groups active notes by application and keeps newest groups first', () => {
    const groups = groupNotesForRail([
      note({ id: 'old-chrome', updated_at: 2 }),
      note({ id: 'new-chrome', updated_at: 5 }),
      note({ id: 'code', target_process_name: 'Code.exe', target_title: 'Skribli', updated_at: 8 }),
      note({ id: 'trashed', deleted_at: 9, updated_at: 10 }),
    ]);
    expect(groups.map(({ label }) => label)).toEqual(['Code', 'Chrome']);
    expect(groups[1]?.notes.map(({ id }) => id)).toEqual(['new-chrome', 'old-chrome']);
  });

  it('opens only the same live application context', () => {
    expect(contextMatchScore(note(), target())).toBe(100);
    expect(contextMatchScore(note(), target({ title: 'Skribli' }))).toBe(75);
    expect(contextMatchScore(note(), target({ title: 'Different tab — Google Chrome' }))).toBe(0);
    expect(contextMatchScore(note(), target({ process_name: 'Code.exe' }))).toBe(0);
  });

  it('selects an exact context and never substitutes another window from the same app', () => {
    const exact = target();
    const differentTab = target({ hwnd_val: 43, title: 'Different tab — Google Chrome' });
    expect(selectBestContextTarget(note(), [differentTab, exact])).toEqual(exact);
    expect(selectBestContextTarget(note(), [differentTab])).toBeNull();
    expect(
      selectBestContextTarget(note(), [differentTab, target({ hwnd_val: 44, title: 'Another tab' })])
    ).toBeNull();
  });

  it('shows the current context count when available and total notes otherwise', () => {
    expect(railPillCount(12, 3, true)).toBe(3);
    expect(railPillCount(12, 0, true)).toBe(12);
    expect(railPillCount(12, 3, false)).toBe(12);
  });
});
