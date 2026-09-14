# v0.1.25 — Living Paper interface refinement

## Product direction

This refinement adopts the approved Living Paper direction without changing Skribli's local data, account, shortcut, reminder, attachment, or context-opening contracts.

- The persistent My Skribs control is now a narrow horizontal paper tab with horizontal pastel layers.
- One click unfolds independent colored note ribbons; there is no enclosing mini-dashboard card.
- A ribbon click opens the real note beside the ribbon. Its separate end cap returns to the saved application or the safest available app home.
- App filters remain horizontal and compact. Here, Everything, and Archived are available from the overflow instead of occupying permanent navigation rows.
- The main workspace uses a small count-aware Skribs bar to unfold the same ribbon surface.
- Note controls remain circular and quiet, the paper canvas stays primary, the color picker no longer overlaps the writing area, and reminder motion is reduced to short purposeful transitions.
- Selected calendar dates use circular marks in both the note scheduler and the full reminder calendar.

## Native surface contract

- Collapsed ribbon host: 164 × 50 logical pixels.
- Expanded ribbon host: 364 × 430 logical pixels.
- The rail stays non-resizable and non-maximizable, docks to the nearest horizontal work-area edge, preserves its Y position, and grows inward.
- Transparent space outside the paper strips remains unpainted.

## Verification contract

- Desktop TypeScript compilation and interface tests.
- Rust native and geometry tests.
- Production frontend build, product truth, compact-surface, site, and repository validation.
- Exact NSIS packaging and encrypted owner-download hashes are recorded after the candidate is built.

## Local candidate evidence

- NSIS installer: `Skribli_0.1.25_x64-setup.exe`, 3,504,674 bytes.
- NSIS SHA-256: `9ef7e17e1f7d4de5dd746195eb9f37542f5be6e6495df1aee878c900c9145386`.
- MSI installer: `Skribli_0.1.25_x64_en-US.msi`, 4,669,440 bytes.
- MSI SHA-256: `85ebfd9cf968a9055977efa2c2adb80bebb7fccdcf688e406d282f6189af5ed1`.
- Encrypted owner asset: 3,504,726 bytes.
- Encrypted asset SHA-256: `3790c915bbd5010c3444a5fdc8b51d1bafa7ec5ba3e89e68d3be6f9006b8cde8`.
- Installer identity and icon validation: passed.
- The package is not code signed; Windows SmartScreen reputation warnings remain expected until signing is added.
