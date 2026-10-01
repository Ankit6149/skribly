# Desktop widget visual polish — 2 October 2026

Part of ARC-66. Executor: Codex. Bounded visual refinement after the owner found v0.1.50 better but insufficiently clean and polished.

## Findings and changes

The preceding panel combined boxed scope tabs, boxed app filters, count badges, coloured card edges, handwriting previews and interface typography. Those competing treatments made the library feel busy even after restoring the yellow/peach/lavender palette.

- Keep the visible three-colour surface; use softer paper cards and a restrained shadow.
- Replace the segmented scope control with plain text tabs and a small selected underline. Retain keyboard focus indicators and selected state.
- Remove frames from app logos. Keep one quiet selected treatment and expose counts through the existing accessible names/tooltips. Add explicit `aria-pressed` to app filters.
- Replace thick card accents with small note-colour dots. Use a consistent interface font for library previews; the note editor and contextual shelf retain their existing handwriting treatment.
- Refine header, search, card and footer spacing. Keep context titles available through tooltips and ellipsis.
- Explicitly preserve dark return-action icons on hover; the inherited white icon colour was inappropriate for the light card surface.
- Following the owner's clarification, restore the preceding card width, minimum height, content padding/line-height and icon dimensions. Keep the refined decoration and interface-font preview. The 388 px comparison fixture has identical measured card bounds before/after: width 334 px, first card 89.078125 px high and the remaining four 108.671875 px high. App-filter marks remain 20 × 20 px; card marks remain 18 × 18 px. This preserves the existing content-driven height model rather than imposing a new fixed height.

Native reveal, placement, account, entitlement and storage behaviour are unchanged. No new dependency, remote icon request, background task or schema migration.

## Evidence and verification

- [Before](../01-design/evidence/arc-66/widget-polish-before.png) and [after](../01-design/evidence/arc-66/widget-polish-after.png): the actual ContextRail component at 388 × 800, with five non-persistent sample notes. These are browser fixtures, not installed Windows screenshots.
- [320 × 480 layout](../01-design/evidence/arc-66/widget-polish-narrow.png): panel/scroll width 319 px, note area scrolls; controls remain within the viewport.
- [Measured bounds comparison](../01-design/evidence/arc-66/widget-polish-bounds.json): the same actual-component sample data, previous rail stylesheet compared with the final stylesheet after awaiting fonts. All five card rectangles and all six app-logo rectangles match at 388 × 800.
- Hover inspection: return icon `rgb(38, 41, 35)` against a light translucent background. App-filter `aria-pressed` reports only All apps selected in the default view.
- TypeScript, six global rail dismissal/focus tests, production build and React/runtime/theme/compact validators pass. Existing bundle-size warning remains. Full current-head CI and Windows storage acceptance are required before source/delivery merge.

## Acceptance and next execution

Prepare the exact v0.1.51 private owner installer and update the existing encrypted website delivery. Keep ARC-66/ARC-13 open for owner visual and installed Windows acceptance. The browser fixture does not establish native Acrylic appearance, DWM smoothness, black-flash elimination, historical AppHangB1 resolution or idle resource measurements. The earlier native motion report remains applicable.

The owner should download through `/v0-download`, over-install without resetting notes/accounts, review the visual refinement and repeat the opening/closing checks. Rollback restores the v0.1.50 encrypted website asset and matching labels from main `7fd7fa95f1d9d3bd9b7f9baab957abfd57e1edd8`, using the existing external owner key. Do not delete local data.
