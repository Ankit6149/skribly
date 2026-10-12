disposition: fix
Missing inputs: the selected image has no local artifact, so this reviews the described contract rather than pixel fidelity; installed Windows captures and live interaction evidence were outside this source/browser review. This existing-product extension does not introduce a new identity or require a concept roll.

## persistence

Pass for the scoped extension. Canonical product and design context exist in docs/00-product/PRODUCT_VISION.md and docs/01-design/DESIGN_DIRECTION.md. The saved surface brief in docs/01-design/evidence/ticket-panel-2026-10-11/BRIEF.md records the owner's ticket direction, functional constraints, palette persistence, and evidence limits. The existing light paper editor identity remains recognizable; the owner-selected saturated global shelf is documented as a surface-specific extension. Root PRODUCT.md/DESIGN.md filenames are not used here. Detector input is [].

## fidelity

| Salient element | Verdict | Evidence |
|---|---|---|
| Full-view global shelf and 6 x 3 composition | match | desktop.png is 1440 x 1024, shows 18 visible tickets in six columns and three nonoverlapping rows, with the header and footer present. Native monitor-work-area coverage is excluded from this finding. |
| Narrow composition | adaptation | mobile.png is 390 x 844, shows two columns with remaining notes continuing below the viewport, as the brief requires. The search, scope controls, filters, and footer remain visible without horizontal overflow. |
| Ticket signature | match | Rounded paper rectangles, circular side cutouts, bold titles above note content, large app marks below, and small outlined Open actions are visible. CSS geometry is expressly authorized by the brief. |
| TYPE | match | Heavy compact functional titles, a clear title/body weight distinction, and restrained tracking preserve the described bold ticket language; no claim of exact reference-face matching is made. Existing product typography is appropriate to this Operate extension. |
| MATERIAL | match | The source supplies a dark translucent shelf with 32px backdrop blur; opaque saturated ticket papers sit above it. No photographic or physical asset promise is simulated. Actual Windows frosting remains unaccepted without installed evidence. |
| GROUND | match | Captured dark green charcoal ground and saturated orange, red, lime, cobalt, green, olive, cream, wine, and charcoal tickets follow the described world. Exact value/temperature comparison is unavailable without the original image artifact. |
| Search, scope, and application filtering | contradicted | Search and scopes remain visible and source retains filtering, but the Chrome and Code filter buttons have visually absent marks against the dark shelf in both captures. WidgetAppStrip.tsx provides no visible labels for these groups, so accessible labels alone do not make the controls discoverable. In desktop.png their mark regions differ from the background by at most 7 and 8 RGB channel levels respectively, while the visible General/Explorer glyphs exceed 210. WidgetContextIcon.tsx applies the default quiet-app-icon grayscale/opacity treatment; ticket-grid.css only lightens these marks inside dark tickets, leaving the dark filter-strip ground untreated. |
| Semantic actions and focus | match | WidgetNoteCard.tsx uses separate semantic Open/Restore and Return buttons, busy/disabled state, and meaningful accessible names. Mobile capture shows visible search focus; ticket and utility focus rings are authored in CSS. |
| Palette and stronger pastels | match | palette.png visibly exposes 32 swatches; noteColors.ts retains the original eight IDs and adds 24. Independent foreground/paper calculation passes all 32 pairs at >=4.5:1; the lowest is red at 4.569:1. |
| Larger note app pill and separate title | match | palette.png and note.png show the app mark beside the saved-context title. Final CSS declares a 48px pill and 32px image. The dark indigo note retains readable title, writing, tools, and Done action. |
| Automatic context titles | match | contextDisplayTitle.ts strips recognized app suffixes, extracts a Code workspace when available, preserves browser page-title content, and falls back meaningfully. It is presentation-only; raw note context continues to feed matching/Return. The supplied tests cover browser, workspace, Explorer, and General examples. |
| Accessibility fallbacks | match | Source includes reduced-transparency and forced-colour fallbacks, readable foreground tokens, themed scrollbars, and keyboard focus. Browser search caret inherits its authored light text color; Windows default selection is not a material defect on the provided existing-product evidence. |
| Global edge pill | adaptation | Deferred explicitly by the owner and brief; existing launcher behavior is outside this extension. |

## ceiling

The described ticket composition is reached; app-filter rendered presence requires one targeted repair. Installed Windows DWM blur, monitor work-area expansion, focus/foreground Return, DPI behavior, and collapse docking remain unverified acceptance work; this ship disposition does not cover an installed release. A live browser was unavailable to the reviewer, so source inspection and supplied captures establish appearance and implementation presence rather than end-to-end execution.

## material_fixes

1. Restore visible Chrome and Code filter marks on the dark shelf: add a shelf-filter-specific light monochrome treatment for .ribbon-context-strip .quiet-app-icon (with opacity:1), or provide an equivalently readable logo surface; keep genuine logos and retain accessible names. Recapture desktop.png and mobile.png to demonstrate every app filter, including Chrome and Code, is visible. This fixes the brief's discoverable application-filter requirement.

## keep

Keep the saturated ticket density, side cutouts, genuine app identity, visible note content, original persisted colour IDs, and untouched raw captured context while completing installed acceptance.
