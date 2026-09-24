const TAG_COLORS = ['yellow', 'peach', 'mint', 'sky', 'lavender', 'rose', 'aqua', 'sand'] as const;

/** UUID-derived variation stays stable across renders and reopening, without storing new data. */
export function contextTagColor(noteId: string, paperColor: string): typeof TAG_COLORS[number] {
  let hash = 2166136261;
  for (let index = 0; index < noteId.length; index += 1) {
    hash = Math.imul(hash ^ noteId.charCodeAt(index), 16777619) >>> 0;
  }
  const index = hash % TAG_COLORS.length;
  const preferred = TAG_COLORS[index]!;
  return preferred === paperColor ? TAG_COLORS[(index + 1) % TAG_COLORS.length]! : preferred;
}
