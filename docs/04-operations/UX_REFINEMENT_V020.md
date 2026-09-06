# v0.1.20 — inline attachments and stable manual resizing

## Owner-visible changes

- Photos sit directly on the note as a compact polaroid object instead of filling a pale card.
- Attachment actions retain bottom breathing room and remain reachable at supported note sizes.
- Manual note resizing is bounded from 320 × 260 through 820 × 760 logical pixels.
- Windows refreshes the note's rounded native silhouette throughout a drag, preventing an exposed white rectangular backing.
- Resize-driven interface classification is frame-throttled; note geometry is still persisted only after the drag settles.

## Product constraints preserved

- The website and rejected interface-lab experiments are unchanged.
- Attachments remain local to the device and use the existing local quotas.
- The note continues to use the selected website pastel and Kalam for note content.
- The existing owner-key download gate and installer flow remain unchanged.

## Verification

- 161 frontend tests passed.
- 144 native library tests, 3 native binary tests, and 37 schema migration tests passed.
- TypeScript, Vite production build, compact-surface validation, and Rust compile checks passed.
- Installed-app visual acceptance remains with the owner, as explicitly requested.
