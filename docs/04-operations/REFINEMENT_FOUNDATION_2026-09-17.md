# Refinement foundation — 17 September 2026

Status: implemented in the local working tree; automated checks passed; Windows runtime acceptance pending. Not a release or a claim that all reported UX issues are resolved.

Follow-up: [Quiet context presence](QUIET_CONTEXT_PRESENCE_2026-09-17.md) supersedes the fixed app-bar dimensions and implements independent foreground presence tracking described below. This report preserves the earlier pass's verification results.

Baseline: `43c298b` / owner installer v0.1.26. Version, account, stored notes, website, logo, bundled Kalam font and shared pastel tokens are unchanged. No installer was built or installed and no release was published.

## Implemented

- Global desktop entry is smaller: native 28 × 80 logical pixels, visible tab 22 × 72, three horizontal pastel bands. The separate app bar remains 164 × 50. Ribbon titles/context labels have larger, more legible text.
- Native rail expansion state is now queryable and emitted to the relevant rail window. React subscribes before querying and rejects stale snapshots. Opening the rail from Home and resetting the app bar on context changes can no longer leave React unaware of the native state transition.
- A newly created note does not immediately show the redundant app bar. The existing Done path shows the saved-context bar. Zero active notes no longer show an empty app bar.
- Transparent note recovery keeps rounded clipping and native shadows disabled instead of resetting the HWND to a rectangular shadowed surface. Scale changes explicitly refresh clipping as well as resize/movement events.
- Reminder controls borrow a 640 × 660 logical-pixel workspace; drawing borrows 640 × 600. Neither shrinks a larger manually sized note. Closing a tool restores the exact prior size if the user has not manually resized it. Putting the note away closes the tool first as well.
- Exact native resizing validates finite dimensions inside 320 × 260–820 × 760 and checks the active note ID under the window-operation lock, preventing delayed requests from resizing a different note.
- The reminder panel has one scroll owner, circular date targets and flexible columns. A small writing preview remains above it; the formatting bar and attachment drawer do not crowd the scheduler while open. Closing restores those existing controls without removing their content.

## Verification

- Frontend: 31 test files, 173 tests passed, including native rail event/snapshot ordering, subscription disposal, exact tool-size restoration and manual-resize precedence.
- Native: 149 library tests, 3 executable tests and 37 migration/integration tests passed (189 total). Added finite-size bounds and surface recovery regressions, including 20 size/DPI combinations.
- Workspace typecheck and production frontend/workspace build passed.
- React runtime, desktop theme, compact-surface, product-truth, lifecycle, library, Trash, import, site and repository governance validators passed.
- Rust formatting and whitespace checks passed.
- Existing dead-code warnings and a large frontend bundle warning remain; they were not hidden or treated as runtime proof.
- No physical Windows interaction, screen-reader, multi-monitor, compositor, installer or owner acceptance evidence was collected in this slice.

## Still open

1. Test the exact Windows binary for background artifacts, edge dragging/Snap, resize smoothness and 100/125/150/200% scaling. The inconsistent native shadow/region policy was a confirmed source defect, not proof of the sole cause of every screenshot artifact.
2. Decouple foreground context-bar tracking from the active editor identity. The event loop still skips general foreground handling while an Open Here note is detached or in dismissed-note lifecycle handling. Do not call app switching fully fixed.
3. Persist/restore temporary tool geometry through interruption/crash paths, not only deliberate tool close/Done. Existing geometry persistence still records the expanded dimensions during the tool session.
4. Verify the full write → Done → bar → ribbon → Open Here/Open in App journey, including unsaved edits, failed writes, rapid clicks and both display edges. The left-docked tab's visual orientation still needs review.
5. Agree single-primary versus multiple-note defaults and browser site-level identity before implementing them. Preserve existing notes; do not infer real URLs from titles.
6. Finish broader navigation, drawing, attachment, accessibility and context-return acceptance. No issues were closed solely for passing this build.

## Next implementation boundary

Make the app-context bar follow the foreground application independently of the note being edited, with regression tests for detached reads, dismissed notes, zero matches and switching away during first-note composition. Then validate the new native surfaces on Windows before packaging an owner installer. Payments, signing/licensing purchases and public release remain out of scope.
