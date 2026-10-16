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
| Compact attachment cards | Image/caption cards and notebook-edge file cards live on the shared note page; small default, three sizes, drag/keyboard placement and adjustable rotation. Action icons remain upright in one row. The separate footer is hidden during normal editing. | Card controls, read-without-rewrite, safe rotation, save/reopen, move/undo and explicit collection access tests. |

## Attachment-card follow-up

The owner's two image references set the direction: a rounded image above a caption, and a paper/notebook edge for files. The owner then specified small, adjustable, movable and rotatable cards. Cards use the note paper and foreground, retain the original image without cropping, and keep filename/type/size readable. File cards show local metadata and an Iconify file mark; they do not invent document contents or imply PDF/Office parsing.

Small/medium/large card widths are 108/166/238 px before rotation, constrained to available note space. A measured bounding frame reserves room for the rotated card and scales it to fit the page; the controls remain upright. Rotation is adjustable from -180 to 180 degrees with reset. Size, angle and writing position persist in sanitized rich-text attachment references; live blob URLs, preview markup and controls remain excluded from saved HTML and plain text. Invalid rotation values are stripped. Read-only and Draw mode disable placement changes.

Existing files with no text placement appear as compact cards after the writing, inside the same scrolling note surface. Reading them does not rewrite text or mark a draft dirty. Adjusting/dragging a card creates its text placement; new uploads use the existing cursor insertion. Removing a text placement retains the saved file as an unplaced card; deleting the saved file still requires the existing confirmation. The collection remains available through the explicit Files command and for recovery/errors. The ordinary separate bottom attachment handle is hidden. Shared-page height includes these cards so More space continues to add blank drawing room below them.

Movement uses existing note-scoped HTML drag/drop to writing positions, with keyboard placement and earlier/later controls. This does not introduce free-floating canvas coordinates or a content-storage migration. Legacy installers may discard the new optional rotation attribute when editing rich text; downgrade appearance equivalence is not claimed.

Follow-up verification: 64 desktop files / 408 tests pass, including actual size/rotation controls, reopening, move/undo, unchanged typed text, no duplicated cards, safe angle sanitization and explicit collection access. TypeScript, lint, production build/CSS fixture and product/lifecycle/Trash/import validators pass. The layout detector reports no findings. Source review covers narrow sizing, long filenames, viewport fitting, forced-colour handling and aligned icon controls. No visual/native app session or new installer was performed, following the owner's existing test preference. Windows visual/touch drag acceptance remains with the owner.

## Drawing and persistence boundary

Each new stroke optionally carries a validated `coordinateSpace` width/height. Points remain normalized and retain existing limits. The million-pixel height is a logical coordinate range: only a viewport-sized bitmap is allocated, with device pixel ratio capped at two. Stroke extents are memoized across scrolling; text and ink use the same page offset.

Legacy strokes remain unchanged on read. They adopt their measured viewport coordinate space only when the user edits ink. Saved page coordinates preserve physical drawing positions through scrolling and window resizing. Existing save, discard and transition barriers remain in place. This is a Flow-note ink repair, not the future Creative canvas or sync/storage project.

Older installers do not understand the new optional page coordinates; drawing equivalence on downgrade is not promised. Text reflow after changing fonts or width can change where text sits relative to ink: strokes are page-positioned, not anchored to words. Extra blank room with no ink is temporary view state; persisted stroke extents restore needed room on reopen. No rich text is moved or rewritten to make drawing space.

## Verification and remaining acceptance

16 October source follow-up: the owner reports a small logo and an outlined circle in their screenshot. Increase the note header mark from 24 to 32 px inside the same 48 px circle (8 px padding). Explicitly suppress border, outline and shadow in normal, hover and keyboard-focus states. Keyboard focus is indicated by an underline on the adjacent context title and the existing place detail, rather than a ring around the circle. Circle colours, icon ink, note colours and widget marks remain unchanged. The normal border removal was already in unreleased source; the published v0.1.54 installer predates it. This remains a source-only change, with installed visual acceptance pending.

Desktop: 64 test files / 404 tests pass; TypeScript, lint and production frontend build pass. The production CSS fixture checks transparent native surfaces and emitted CSS. Governance, product-truth, lifecycle, Trash and import validators pass. Impeccable's mechanical detector reports no findings on the changed editing surfaces. The pre-existing large JavaScript chunk advisory remains.

This evidence is automated/source evidence, not installed Windows or visual acceptance. Owner acceptance still needs long-note wheel/touch hand scrolling, draw over text, add space, select/move ink, save/reopen, font changes, highlight changes on dark/saturated paper, and reduced-motion behaviour. No Android UI implementation or runtime acceptance is claimed by this update. Font preferences are local device settings, not account sync.
