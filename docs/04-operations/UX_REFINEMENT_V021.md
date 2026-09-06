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

## Installer delivery

- Exact source commit: `230f91a0cdeacbdb6796faaaec459d5e92adb1b8`.
- Windows workflow: `34030029602`.
- GitHub artifact: `9988461193`.
- NSIS installer: `Skribli_0.1.21_x64-setup.exe`, 3,478,405 bytes.
- Installer SHA-256: `0dc9f74c897667b58bb5d372894dad0baebb6c9d3bb941cd31e8f14855a1efa4`.
- Encrypted website asset: 3,478,457 bytes, SHA-256 `61633fb170d7f03c85d071c5177870b880f023ccc52c4dd1fb9b93a9cdbbc2d4`.
