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

## Installer delivery

- Exact source commit: `197ea7a3a944d6e7048fa8d1c70104df3d41583a`.
- Windows workflow: `34028042167`.
- GitHub artifact: `9987851350`.
- NSIS installer: `Skribli_0.1.20_x64-setup.exe`, 3,479,620 bytes.
- Installer SHA-256: `6e33c3799e8f23a9b69c3b51ceeec7165a03121238adf7690f6457e026781056`.
- Encrypted website asset: 3,479,672 bytes, SHA-256 `baa84f9224280c7213679267af23f5fc7f31f917a8aaf93a6a6f3e80cf7e4071`.
