# v0.1.21 — rounded note boundary correction

## Owner-visible correction

- The blue/lavender band outside the note's rounded right and bottom edges is removed.
- Only the real note surface receives the selected pastel and ruled-paper texture.
- The 4 px native resize gutter is transparent again, preserving the intended contained shadow and rounded silhouette.

## Preserved behavior

- Continuous Windows rounded-region refresh remains active during manual resizing.
- The 320 × 260 minimum and 820 × 760 maximum remain enforced.
- The inline attachment object refinement from v0.1.20 is unchanged.
- Local notes, owner access, website styling, and the download key are unchanged.

## Visual verification boundary

The supplied owner screenshot identifies the exact faulty state and the CSS source was corrected directly. Installed-app visual acceptance remains with the owner, as explicitly requested.
