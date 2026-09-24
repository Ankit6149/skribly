# v0.1.27 owner candidate

This report supersedes the pending preference/tool-recovery items in the earlier refinement reports. This is an owner-test candidate, not a claim of release acceptance.

## Included

- A small global edge widget with horizontal pastel bands and a separate quiet in-app presence: brief count on arrival, then a small indicator that reveals its count on hover/focus and opens a compact list on click.
- Open Here uses the initiating rail and rejects stale context requests. Detached note sizing stays at the moved note position, subject to monitor work-area bounds.
- The shortcut reuses the oldest active note in its context by default. Settings can opt into a fresh note each time. Existing notes are preserved; archived and trashed notes are not reused.
- Native apps group by application. Browser matching remains page-title based; website-origin grouping is NOT implemented and titles are not treated as URLs.
- Calendar/Draw can borrow space without saving that temporary expansion as the note's permanent dimensions. Manual resize takes ownership of dimensions; normal editor bounds remain 320 × 260 through 820 × 760, constrained by usable display space.
- Drawing selection preserves a stroke's shape at canvas boundaries; pointer ownership, point limits, active-tool state and Undo after Clear are corrected.
- The attachment drawer stays tucked away until opened, exposes every photo through previous/next controls, and supports inline video playback. Download links are labelled Save copy. Individual remove actions retain confirmation.
- Reminder scheduling rejects past times and duplicate submissions while loading. Calendar dates remain circular; actions wrap on narrow surfaces.
- Website palette, existing logo and Kalam note text remain. React review checked hook cleanup, pointer ownership, busy guards and accessible control labels; it is not rendered-screen acceptance.

## Automated evidence

- Type checking: passed.
- Frontend: 32 test files, 189 tests passed.
- Rust: 165 library + 3 executable + 37 integration/migration tests, 205 passed.
- Product truth, note lifecycle, library, Trash, migration fixture, portable import, governance and private-artifact validators: passed.
- Production frontend build and runtime/theme/compact-surface validators: passed.
- Existing non-fatal bundle-size and Rust dead-code warnings remain.

## Packaging boundary

Version 0.1.27 is built from the Desktop checkout and retains the existing public account configuration, trial enforcement and license-verification public key. No owner password, account session, notes, license or production backend was reset or modified. No payment or code-signing purchase was made. It is not a website release.

Source baseline: `43c298b0b9f22c5ffd98155c545129df546c9e4d` plus the local, uncommitted refinement changes. This baseline alone does not identify the candidate source. The installer hash identifies the delivered binary.

No installation, live app launch, screenshot session or real Windows interaction test was performed, at the owner's request. Do not close runtime acceptance issues based on unit tests or installer creation.

## Still requires acceptance or implementation

1. Owner tests the exact installer: upgrade with existing notes/session, startup shortcut, save/reopen, rail/context switching, manual corner resizing, calendar/drawing transitions, mixed-DPI displays and screen-edge behavior.
2. Confirm no compositor/background artifacts, invisible hitbox, focus jumps, missing draft saves or blocked content in real Windows use. Automated geometry tests do not prove these outcomes.
3. Website-origin grouping and dependable browser navigation require real URL metadata; the current title fallback does not implement the requested site-level experience.
4. Code signing, payment integration, commercial licensing policy and public-release approval remain outside this candidate.

## Delivery evidence

Both installer builds completed successfully. Delivered locally in `C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.27/`:

- `Skribli_0.1.27_x64-setup.exe` — 3,528,702 bytes; SHA-256 `1213c280c5ae53d88cbea7f2c7b11c1e4ebef82b4314f0e03788b21170b3546e`.
- `Skribli_0.1.27_x64_en-US.msi` — 4,702,208 bytes; SHA-256 `f75c079908f8d90f4da35cad5d8c12ea44bbc2ccaa5ad6ccc9f2ac36d6739d1a`.

Static branding verification passed: product/version names and executable/installer icons match the existing Skribli logo; no Tauri branding detected. `branding-evidence.json` records `startup_smoke_status: not-requested`. Authenticode reports `NotSigned`, so Windows trust warnings are still possible. No website download key is needed for these local files; account sign-in/licensing remain enforced inside the app.
