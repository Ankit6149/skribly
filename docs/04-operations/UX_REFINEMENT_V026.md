# v0.1.26 — Global widget and in-app context bar

## Product contract

This revision implements the final distinction between Skribli's global and contextual note entry points.

- The global desktop widget is a quiet vertical edge tab made from yellow, peach, and lavender paper strips. It contains no note icon, letter, label, or count.
- The contextual widget is the existing horizontal paper bar with the local note count and the word `here`. It replaces per-note dots inside supported applications.
- Both controls unfold the existing ribbon experience, but they are independent native windows and can remain in their correct places at the same time.
- The global tab stays attached to a desktop edge and can be moved along the edge.
- The contextual bar starts near the upper-right corner of its active application, can be dragged within that application's bounds, follows the application when it moves or changes display scale, and hides when another application becomes active.
- Applications with no active Skribs do not receive a contextual bar. The global tab remains the fallback entry point.

## Visual source

- Owner-selected reference: `codex-clipboard-2d45a16d-5c50-4646-8114-3d48bb0a7652.png`.
- The reference establishes the slim vertical proportion, three horizontal colour regions across its width, rounded exposed edge, flush screen attachment, and absence of text or iconography.
- The accepted Living Paper ribbon and horizontal `Skribs here` language from v0.1.25 remains unchanged.

## Native surface contract

- Global collapsed host: 36 × 128 logical pixels; visible paper: 30 × 120 logical pixels; flush to the selected desktop edge.
- Context collapsed host: 164 × 50 logical pixels with an 8 logical-pixel application boundary margin.
- Expanded host for either entry point: 364 × 430 logical pixels.
- Global and contextual movement, placement, and expansion state are isolated from one another.
- Both windows remain transparent, non-resizable, non-maximizable, always-on-top, and outside Windows Snap Layouts.

## Verification contract

- TypeScript compilation, frontend tests, Rust tests, and production builds.
- Static configuration validation for both native windows and their distinct dimensions.
- Geometry regression coverage for app containment on positive- and negative-origin displays.
- Browser visual comparison of the global edge tab and contextual bar, including click-to-unfold behavior.
- Exact installer identity, hashes, and encrypted owner-download asset are recorded after packaging.

The Windows installer remains unsigned. Microsoft Defender SmartScreen reputation warnings are expected until a production code-signing certificate is added.

## Local candidate evidence

- NSIS installer: `Skribli_0.1.26_x64-setup.exe`, 3,455,110 bytes.
- NSIS SHA-256: `457a3d8b08827b4e6d84775e5c4fc20abcf4b01b66ad55aac0ba154f5ce0affd`.
- MSI installer: `Skribli_0.1.26_x64_en-US.msi`, 4,608,000 bytes.
- MSI SHA-256: `5f82b117920036d51863a0b142d6acf88d71707739a23b8d617274637d71612b`.
- Encrypted owner asset: 3,455,162 bytes.
- Encrypted asset SHA-256: `ed2524db85f76594383077099b70333a7f1c0be2893844904dbf7558e24d7431`.
- Installer identity and icon validation: passed.
