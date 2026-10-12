# Note editing fixes — 13 October 2026

Executor: Codex. Tracking: Part of ARC-66. Owner request: implement and merge these source fixes, keep a fix register, and do not release.

This is an unreleased source update. Windows v0.1.54 and Android v0.0.2 remain the published private owner packages. No installer, APK, website, backend, signing or public release is included. The associated GitHub PR and dated ARC-66 execution report record merge evidence; installed acceptance remains pending.

## Fix register

| Request | Implemented source behaviour | Evidence |
| --- | --- | --- |
| Highlights follow note colour | Five highlight tones recompute from the selected paper, including existing saved highlights. Swatches show current colours and text contrast. | All 32 paper colours: fill/paper contrast at least 3:1; text/fill at least 4.5:1. Palette tests and existing rich-text persistence/sanitizer tests. |
| Softer icons | Context icons use softer dark ink; light pills retain at least 3:1 icon contrast. Draw tray colours are preserved. | Context pill contrast tests; CSS source review. |
| White Done text | White text on a consistent dark olive Done surface, including hover. | Production CSS build; source review. |
| Note font preference | Kalam remains default; Settings offers Kalam, DM Sans, Manrope, System, Georgia, Consolas and Segoe Print, with a preview. | Safe allowlist and persistence tests. Bundled fonts work offline; system choices use available fonts and fallbacks. |
| Remove logo-pill outline | Context pill border and shadow removed; circle size and padding retained. | Source review. |
| Type/Draw motion and clicks | One sliding selection indicator (220 ms); controls receive brief click feedback (160 ms). Reduced-motion preferences disable motion. | TypeScript/lint/build and listener lifetime review. Native motion acceptance pending. |
| Drawing with long text | Text and ink share document scroll coordinates. Draw over/between text without editing it. Wheel, keyboard and a hand tool scroll the page; More space extends blank room below text. | Coordinate projection/resize/reopen tests; pointer/wheel/hand-tool tests; existing note transition/save failure tests. |
| GitHub Sponsors | `.github/FUNDING.yml` targets the verified active `Ankit6149` Sponsors page. | GitHub sponsor configuration; https://github.com/sponsors/Ankit6149. |

## Drawing and persistence boundary

Each new stroke optionally carries a validated `coordinateSpace` width/height. Points remain normalized and retain existing limits. The million-pixel height is a logical coordinate range: only a viewport-sized bitmap is allocated, with device pixel ratio capped at two. Stroke extents are memoized across scrolling; text and ink use the same page offset.

Legacy strokes remain unchanged on read. They adopt their measured viewport coordinate space only when the user edits ink. Saved page coordinates preserve physical drawing positions through scrolling and window resizing. Existing save, discard and transition barriers remain in place. This is a Flow-note ink repair, not the future Creative canvas or sync/storage project.

Older installers do not understand the new optional page coordinates; drawing equivalence on downgrade is not promised. Text reflow after changing fonts or width can change where text sits relative to ink: strokes are page-positioned, not anchored to words. Extra blank room with no ink is temporary view state; persisted stroke extents restore needed room on reopen. No rich text is moved or rewritten to make drawing space.

## Verification and remaining acceptance

Desktop: 64 test files / 404 tests pass; TypeScript, lint and production frontend build pass. The production CSS fixture checks transparent native surfaces and emitted CSS. Governance, product-truth, lifecycle, Trash and import validators pass. Impeccable's mechanical detector reports no findings on the changed editing surfaces. The pre-existing large JavaScript chunk advisory remains.

This evidence is automated/source evidence, not installed Windows or visual acceptance. Owner acceptance still needs long-note wheel/touch hand scrolling, draw over text, add space, select/move ink, save/reopen, font changes, highlight changes on dark/saturated paper, and reduced-motion behaviour. No Android UI implementation or runtime acceptance is claimed by this update. Font preferences are local device settings, not account sync.
