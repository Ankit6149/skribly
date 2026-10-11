# Private beta refinement — 7 October 2026

Part of ARC-66. Executor: Codex. Owner: Ankit Bhardwaj.

## Current boundary

The owner is testing the delivered Windows v0.1.53 while source refinement proceeds. Android v0.0.2 is a separate ARM64 preview. The 4 October production execution record confirms private website delivery and matching account deployment. Neither package has installed-device acceptance. Source changes in this branch are not present in the owner's installed v0.1.53.

## Execution register

| Work | State | Evidence / next execution |
| --- | --- | --- |
| Release reference reconciliation | Source changed | Root README, current index and product-truth validator name v0.1.53. |
| Library refresh feedback | Source changed | Every refresh displays busy state; failed reads leave storage verification in error, rather than checking indefinitely. Regression tests cover delayed refresh and failure/retry. |
| Export/import scope | Source changed | Library, Settings and import preview explain that JSON excludes ink, files and reminders. This does not implement a full backup. |
| Archive naming | Source changed | Library and Settings use Archive instead of Past. |
| Windows visual/native acceptance | Owner testing | Exact v0.1.53: opening/closing, blank flashes, focus, duplicate launch, mixed DPI, taskbar and shortcut behavior. |
| Windows data acceptance | Owner testing | Text/ink/files, save/close/Quit/restart, upgrade retention, reminders, Trash/restore, account outage and read-only export. |
| Complete rich-content backup | Design/implementation pending | Requires a reviewed format and cross-store snapshot/restore protocol, corruption handling and clean-profile restoration evidence. Persistent migration/security changes require owner approval under CONTRIBUTING.md. |
| Performance | Measurement pending | Record exact executable identity, startup, idle CPU and combined app/WebView memory. Existing budget values are targets, not results. |
| Accessibility / visual consistency | Runtime review pending | Keyboard, screen reader, text scaling, forced colours, reduced motion, narrow windows and all failure states. |
| Android durability | Real-phone acceptance pending | Save/restart, Back, keyboard insets, process death, TalkBack and storage lifecycle. Unsaved drafts remain vulnerable to process death. |
| Android OS notifications | Not implemented | Requires permission, durable scheduling and real-phone delivery tests. In-app reminder scheduling does not provide OS alerts. |
| Live encrypted sync | Approval/design boundary | No live transport, device enrollment or recovery keys. Follow the 4 October sync proposal; do not infer production approval. |
| Public release/signing/commerce | Approval boundary | Separate release, security, legal and commercial decisions; no publication authorized by this source pass. |

## Owner feedback format

Record the surface/action, expected behavior, observed behavior and whether it repeats. Include Windows scaling/monitor setup for placement problems. Keep private note content out of reports. A screenshot or short recording can supplement a visual report. Classify findings as data loss/hang, broken interaction, or visual refinement so reliability defects are addressed first.

## Next execution

Incorporate owner findings against v0.1.53, fix reproduced defects with relevant regression coverage, and visually inspect the changed source surfaces before preparing a replacement candidate. Build, installer, signing and runtime evidence remain distinct. Do not close ARC-66 on tests or source merge.

## Verification of this source pass

Root typecheck, required desktop lint (148 source files), root build, product-truth validation and governance validation passed. Full desktop suite: 55 files / 312 tests passed. Android: 24 frontend tests plus 3 packaging tests passed. The two new library regressions and existing import-dialog test passed. Production CSS fixtures passed. Vite retains its existing greater-than-500-kB chunk advisory.

No native code, persistent schema, backend, installer or production website changed. No installed Windows acceptance or fresh browser visual acceptance is claimed. GitHub CLI is unauthenticated, so a remote PR has not been created. The source pass remains reviewable on the local ARC-66 branch; the owner keeps testing delivered v0.1.53.

## Owner feedback follow-up — 8 October

The owner reports misplaced app identity, unmovable media, an unattractive attachment collection, confusing removal, bulky widget cards, overly colourful logos and cramped desktop/calendar layouts. They request optional Creative notes and Android control of PC settings.

Source repairs:

- App identity is a 32 × 32 header pill inside the paper, rather than a 40 × 52 object protruding from the corner. Native initial geometry and regression expectation match the revised layout; DOM bounds remain authoritative. Browser measured 32 × 32 with left 27.8/top 13.8 relative to the native surface.
- Inline objects and saved-file reinsertion buttons now start same-note attachment drags; the editor already supports validated note-scoped drops and keyboard earlier/later movement. The main note WebView uses `dragDropEnabled: false`, required for HTML drag/drop on Windows by Tauri's installed schema and official config reference. Files still pass existing type/size checks. Real Windows dragging remains unverified.
- Inline images use paper photo frames; the saved-file drawer uses a wider adaptive card grid with explicit saved-file count. “Remove from text” retains the source file, explained in Options; “Delete saved file…” invokes the existing named confirmation before removing both file and placements. No silent deletion was introduced.
- Widget cards remain equal-sized at 88 px with one-line previews, replacing the older 110 px density in response to current owner feedback. Browser fixture confirms equal heights without vertical card overflow; that capture used a full-width browser, not the installed 388 px native panel.
- Settings exposes quiet/original widget logos, bounded local PNG/JPEG/WebP overrides for apps with notes and automatic-logo reset. Existing native icon fetching remains first choice after explicit override. Settings are local to this PC's WebView origin, not synced to Android. Invalid/future preference versions and remote/SVG/oversized overrides fail safely.
- Calendar uses a roomy column or stacks month/agenda based on actual workspace width. Date rows have a 44 px minimum. Settings navigation/rows respond to width after the sidebar. Browser resize, Windows text scaling and native acceptance remain open.

Verification: final desktop suite 56 files / 317 tests passed; Android 24 + 3 passed. Root typecheck, lint, build/CSS fixtures, product truth, governance and rustfmt passed; 24 native Windows placement tests passed. Build retains its existing chunk-size advisory. The config regression initially failed due to a test-only URL/node typing mismatch; importing raw config through Vite repaired the fixture and targeted tests plus final full suite pass.

Source-preview screenshots were observed during this run. The browser preview tabs were no longer available when screenshot retention was attempted, so no saved screenshot artifact or native/narrow-window visual proof is claimed. Calendar/Settings CSS changes still require direct visual acceptance.

No replacement installer, backend, website publication or Android implementation is claimed. Native pill and WebView-config changes require an exact new Windows candidate and installed acceptance. No native personal notes were used for fixtures. GitHub PR remains pending authentication. ARC-66 remains open.

[ADR-005](../02-engineering/adr/ADR-005-creative-canvas-and-companion-settings.md) is the concrete review boundary for versioned Creative scenes and encrypted paired-device settings control. Normal Flow remains default; existing notes never auto-convert. Neither feature is implemented by these repairs. Owner approval has been requested under CONTRIBUTING.md's ADR/migration rules.

## Public deadline and panel mock follow-up — 11 October

The owner requests a public release on 12 October and a wider side panel overlapping the desktop with frosted blur. [Today's readiness report](PUBLIC_RELEASE_READINESS_2026-10-11.md) records the passing checks, exact unsigned v0.1.53 artifact, prepared portable build toolchain and still-open release decisions. ARC-66 and its latest reports were read; previous widget proposal selection and native acceptance remain open.

Retained source-panel screenshots and measured narrow-width, search, app-filter, empty-Archive and Escape/focus evidence are in [the source review](../01-design/evidence/beta-review-2026-10-11/AUDIT.md). Three new built-in Image Gen concepts are saved under ignored artifacts/frosted-panel-review-20261011. These are mock proposals only; no production panel or native blur implementation was changed.

Source/config inspection found no native blur-effect application despite historical Acrylic wording, and global-panel CSS disables backdrop-filter. The selected implementation must address native material and viewport geometry, not merely lower CSS opacity. Installed blur/motion/focus/DPI, Calendar/Settings visual review, complete-backup design, companion features and release acceptance remain open. Free beta versus paid launch and signing availability are awaiting owner answers.
