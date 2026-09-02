# Interface Lab Design QA

## Visual truth and implementation evidence

- Source visual truth: the previously published interface lab at `https://skribly-desktop.vercel.app/interface-lab` before this refinement.
- Source editor capture: `artifacts/interface-lab-refinement/08-before-editor-matched.png`
- Source rail capture: `artifacts/interface-lab-refinement/09-before-rail-matched.png`
- Refined editor capture: `artifacts/interface-lab-refinement/10-after-editor-matched.png`
- Refined draw capture: `artifacts/interface-lab-refinement/11-after-draw-matched.png`
- Refined rail capture: `artifacts/interface-lab-refinement/12-after-rail-matched.png`
- Circular-control editor capture: `artifacts/interface-lab-refinement/13-after-circular-editor.png`
- Readable magnetic-rail capture: `artifacts/interface-lab-refinement/14-after-readable-magnetic-rail.png`
- Expanded drawing capture: `artifacts/interface-lab-refinement/15-after-expanded-draw.png`
- In-note calendar capture: `artifacts/interface-lab-refinement/16-after-inline-calendar.png`
- CSS viewport: 1280 x 900 for every matched capture.
- Raster size: 1265 x 842 for every matched capture.
- Source device pixel ratio: 1.25. Local implementation device pixel ratio: 1.0. The browser output is normalized to the same raster dimensions for comparison.
- State alignment: note editor default state and pill-and-rail default state were captured after the same 180 ms settling interval.

## Comparison and iteration

The matched captures were reviewed together in the same comparison input.

- P2: The always-visible explanation panel made each surface feel like documentation instead of a calm product mock. Fixed by collapsing design rationale into an optional `Design notes` reveal below the active prototype.
- P2: The draw row exposed too many similar controls at once. Fixed by removing the redundant selection control and replacing three stroke-size dots with one cycling Thin / Medium / Thick control.
- P3: State changes felt static. Fixed with restrained 120–180 ms press, panel, selection, resize, color, collapse, rail, chip, and save feedback.
- P3: Prototype status repeated two ideas. Fixed by reducing it to one `Live mock` indicator.
- P3: The display heading competed with the prototypes. Fixed by slightly reducing its maximum scale while preserving the site typography and hierarchy.
- P2: Icon-only controls used inconsistent rounded-square containers. Fixed by making icon-only navigation, note, tray, rail, library, calendar, time, and state controls true circles while leaving text actions as pills.
- P2: Rail metadata was below a comfortable reading floor. Fixed with shared 10 px micro and 11 px small-text tokens, 12 px rail titles, and stronger hierarchy without widening the rail.
- P2: The rail could only sit against one fixed top position. Fixed with a draggable header: horizontal pull snaps back to the right edge, vertical position remains clamped inside the stage, and keyboard Home/End/arrow movement is supported.
- P3: Collapse, import, and export symbols were ambiguous. Fixed with minus, file-import, and file-export Phosphor icons plus descriptive hover titles.
- P2: Drawing and scheduling competed with the writing area at the comfortable note size. Fixed by enlarging the same note to its canvas preset when either tool opens, preserving typed content underneath.
- P2: Reminder scheduling previously read as a separate destination. Fixed with an inline month, time, repeat, summary, and save flow inside the enlarged note.
- P3: The Reminder navigation item could remain highlighted after switching to Draw. Fixed by synchronizing the active surface item with the currently visible editor state.

## Required-surface review

- Typography: Existing display and Kalam handwriting choices preserved; heading scale reduced without changing the brand voice.
- Spacing: The active surface is now full-width, tools reserve their own row, and optional notes no longer compress the prototype.
- Color: Existing cream, mint, yellow, peach, sky, lavender, green, and ink palette preserved.
- Assets: Existing Phosphor icons and local font assets preserved; no placeholder icons or fabricated visual assets introduced.
- Copy: Primary labels remain concise and action-oriented. Explanatory copy is available through progressive disclosure.

## Interaction verification

- Design notes expand and collapse with correct `aria-expanded` state.
- Draw tray opens without overlapping the canvas; stroke size cycles Thin → Medium → Thick.
- Draw automatically expands the note to 640 x 540 and exposes pen, highlighter, eraser, stroke, ink color, and clear actions without covering typed content.
- Note color, preset size, attachment, reminder chip, collapse, and reopen actions work.
- Rail remains visible after note selection and when switching Here / All scope.
- Rail header exposes a drag affordance, clamps vertical movement within the mock window, and resets horizontal pull to the docked edge on release.
- Library selection updates title, paper, and stored location.
- Reminder repeat choice updates its readable summary; Save shows a `Saved` state and success toast before restoring.
- Reminder-in-note automatically expands to 640 x 540; the calendar closes back to the writing canvas without opening a separate surface.
- No horizontally overflowing document state at the tested desktop viewport.
- No visible unlabeled icon-only buttons in the tested active surface.
- No browser console errors during the completed interaction pass.
- Circular controls were visually verified on editor, library, reminder, calendar, and time surfaces; no horizontal overflow was introduced.
- `prefers-reduced-motion` reduces animations and transitions to effectively instantaneous behavior.

## Production desktop rail and note QA

- User-selected collapsed rail reference: `artifacts/rail-redesign/04-user-selected-collapsed-pill.png`.
- Actual Tauri collapsed rail capture: `artifacts/rail-redesign/cdp-latest-collapsed/rail-64x64.png`.
- Actual Tauri expanded rail capture: `artifacts/rail-redesign/cdp-latest-expanded/rail-336x476.png`.
- Actual Tauri large note capture: `artifacts/rail-redesign/cdp-force-note-2/main-746x612.png`.
- Actual Tauri reminder capture: `artifacts/rail-redesign/cdp-force-note-large/main-760x620.png`.
- The reference and final collapsed rail were reviewed together. The final production rail preserves the layered yellow, peach, and sky paper silhouette, count badge, soft shadow, and note meaning while reducing the native footprint from 72 x 72 to 64 x 64.
- The expanded rail uses the unchanged packaged Skribli mark, a wider 336 px reading surface, singular/plural group grammar, and a separate explicit `Open in app` action.
- Note-row selection now opens and closes an in-rail reading view. Long note text remains readable with a themed internal scrollbar; selecting a note no longer navigates away.
- Opening the reminder no longer loses its active panel during the native resize. The calendar, quick picks, time, repeat, selected date, and save action remain visible together on the large note surface.
- Native edge-docking tests verify nearest-edge snapping, negative-origin monitors, growth inward from either wall, preservation of vertical position, and suppression of stale move events.
- Final automated verification: 27 desktop test files / 150 tests, 137 native library tests, 3 native binary tests, 37 schema migration tests, production build, desktop theme validation, compact-surface validation, and Rust format check all passed.

## v0.1.15 rail actions and calendar refinement — 2026-09-02

This section supersedes the in-rail reading interaction described above. The user rejected that interaction; previous screenshots are not evidence for this revision.

### Source and intended changes

- User screenshot: `codex-clipboard-33c38d0f-c556-4f35-86c1-2d1024a609ba.png`, supplied in this task. It shows note content consuming the bottom half of the rail.
- Remove the embedded reading panel. The row body and note icon open the actual note beside the rail, without navigating. The separate location icon opens the note in its matching saved application context.
- Keep the existing logo, pastel paper colours, typography, circular controls, and small collapsed rail.
- Preserve expanded rail state through note opens, saves, and context refreshes. Background refreshes no longer replace the list with a loading screen.
- Keep detached reading transient: opening, moving, or closing it must not rewrite its original location or collapse state. Flush pending text and block switching while rich content is unsaved.
- Give reminders a bounded 820 x 760 requested workspace (previous native maximum was 760 x 620), clamped to the monitor work area. Use fixed-size circular dates, readable labels, spaced time/repeat controls, and one outer scroll fallback on smaller displays.

### Automated evidence

- Desktop tests: 155 passing, including separate Open here/Open at location command paths and draft-save handshake success/failure.
- Native tests: 142 library tests, 3 binary tests, and 37 schema migration tests passed. The added side-by-side layout regression covers both rail sides, negative-origin monitors, and 100%/125%/150% scaling.
- TypeScript, production build, product lifecycle validation, theme/compact-surface checks, repository governance, site validation, and private-artifact workflow validation passed locally. The installer workflow repeats these checks against the exact committed candidate.
- No production account credentials, installed note data, or website design were changed for this revision.

### Visual verification limitation

The Windows Computer Use helper failed during initialization with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Resetting the session and retrying produced the same failure. No current-build screenshot or installed-app click-through was obtained. No old screenshot is presented as current evidence; no visual pass is claimed.

Pending owner testing: the user explicitly requested no further app checking and will download and test the installer. Open both row actions in Windows, compare the rail with the source screenshot, and check the calendar at 100%, 125%, and 150% display scaling. Exact closed browser-tab or folder reopening remains dependent on future durable URL/path context support; this revision uses the existing process/window-title matcher and reports missing contexts instead of guessing.

### Installer delivery

- Windows workflow `33653893600` succeeded for exact app commit `55b02f9d28f4c98845d89c4a412269f5bcf98a6b`.
- Installer: `Skribli_0.1.15_x64-setup.exe`, 3,468,583 bytes.
- Installer SHA-256: `7124aec1e61906720ad570c57ac77225553c16251022dce2fe32e2dc82b249c6`.
- GitHub artifact `9856379342`; installer encrypted into the existing owner-key website asset. The key and website layout are unchanged.
- Issue #177 remains open for the owner's visual/interaction acceptance; code and packaging are complete, not a claim of visual QA approval.

final result: blocked
