const TAG_COLORS = ['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand'] as const;
type TagColor = typeof TAG_COLORS[number];

// Keep the tab distinct from its paper, including when the owner changes paper colour.
const CONTRASTING_TABS: Record<TagColor, readonly TagColor[]> = {
  yellow: ['sky', 'lavender', 'mint', 'aqua'],
  peach: ['mint', 'sky', 'aqua', 'lavender'],
  mint: ['peach', 'rose', 'sand', 'lavender'],
  sky: ['peach', 'rose', 'yellow', 'sand'],
  lavender: ['yellow', 'mint', 'peach', 'aqua'],
  rose: ['mint', 'sky', 'yellow', 'aqua'],
  aqua: ['peach', 'rose', 'yellow', 'sand'],
  sand: ['sky', 'lavender', 'mint', 'rose'],
};

/** UUID-derived variation stays stable across renders and reopening, without storing new data. */
export function contextTagColor(noteId: string, paperColor: string): typeof TAG_COLORS[number] {
  let hash = 2166136261;
  for (let index = 0; index < noteId.length; index += 1) {
    hash = Math.imul(hash ^ noteId.charCodeAt(index), 16777619) >>> 0;
  }
  const paper = TAG_COLORS.includes(paperColor as TagColor) ? paperColor as TagColor : 'yellow';
  const choices = CONTRASTING_TABS[paper];
  return choices[hash % choices.length]!;
}
