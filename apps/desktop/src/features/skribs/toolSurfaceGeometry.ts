export interface NoteSurfaceDimensions {
  width: number;
  height: number;
}

export interface TemporaryToolSurface {
  original: NoteSurfaceDimensions;
  expanded: NoteSurfaceDimensions;
}

/** Borrowing is native runtime state, never a new saved note size. */
export function temporaryToolResizeRequest(noteId: string, dimensions: NoteSurfaceDimensions) {
  return { noteId, ...dimensions, temporary: true as const };
}

export function borrowedSurfaceAfterResize(
  previous: TemporaryToolSurface | null,
  current: NoteSurfaceDimensions,
  expanded: NoteSurfaceDimensions
): TemporaryToolSurface {
  return {
    original: { ...(previous && sameSurfaceSize(previous.expanded, current) ? previous.original : current) },
    expanded: { ...expanded },
  };
}

/** Tools can borrow room, but never shrink a manually sized note. */
export function roomForNoteTool(
  current: NoteSurfaceDimensions,
  tool: 'draw' | 'reminder'
): NoteSurfaceDimensions {
  return {
    width: Math.max(current.width, 640),
    height: Math.max(current.height, tool === 'reminder' ? 660 : 600),
  };
}

export function sameSurfaceSize(a: NoteSurfaceDimensions, b: NoteSurfaceDimensions): boolean {
  return Math.abs(a.width - b.width) <= 2 && Math.abs(a.height - b.height) <= 2;
}

/** A resize made by the person wins over automatic restoration. */
export function sizeAfterToolClose(
  borrowed: TemporaryToolSurface | null,
  current: NoteSurfaceDimensions
): NoteSurfaceDimensions | null {
  if (!borrowed || !sameSurfaceSize(borrowed.expanded, current)) return null;
  const { width, height } = borrowed.original;
  // A small work area can clamp the actual native window below its configured
  // limits. Do not send those dimensions back through the bounded resize API.
  if (!Number.isFinite(width) || !Number.isFinite(height)
    || width < 320 || height < 260 || width > 820 || height > 760) return null;
  return borrowed.original;
}
