# Desktop UI refactor audit — 29 September 2026

**Status:** design and source review for ARC-66. Browser-rendered desktop components have been checked visually; the installed Windows WebView, native window edges, motion, focus, and persistence still require owner acceptance on the exact installer. This work does not replace the private v0.1.47 candidate.

## Design contract

The selected [Soft Paper Play direction](DESIGN_DIRECTION.md) is the visual baseline. One note, its two tool rails, the global shelf, Find, Reminders, Ready, and Settings should read as one product: restrained paper surfaces, clear ink contrast, a single icon stroke weight, stable controls, readable UI text, and visible keyboard focus. Handwriting belongs to note content; navigation and settings use the UI typeface. The note's existing corner geometry and pill curves are intentionally unchanged after the owner's correction.

The owner specifically asked for consistent icon weight, three-dot placement, hover behavior, and a cohesive desktop app. This pass sets shared icon/control tokens, makes the note and rail action icons use that weight, removes hover motion from primary/navigation/rail controls, and raises undersized text throughout desktop navigation, Find, Reminders, and Settings. It gives the Ready surface a scrolling stacked layout at smaller desktop widths, and makes narrow Find, Reminders, and Settings usable without clipping. Icon-only navigation retains accessible names.

## Visual evidence

These are browser captures of the real React components with fixture data, not native Tauri screenshots. The controls rendered without page errors at the listed sizes. The 820 × 580 captures match the intended minimum desktop window stress case; the narrower Settings capture tests the responsive fallback.

| Surface | Evidence | Review result |
| --- | --- | --- |
| Ready overview | [1024 × 680](evidence/arc-66/home-1024x680.png), [820 × 580](evidence/arc-66/ready-820x580.png) | Heading, primary action, status, shortcut and account remain legible; narrow layout stacks and scrolls. |
| Settings | [656 × 464](evidence/arc-66/settings-656x464.png) | Navigation becomes an accessible icon rail; settings groups and controls scroll instead of squeezing into columns. |
| Find | [820 × 580](evidence/arc-66/find-820x580.png) | Search, note list, preview and actions fit with internal scrolling. |
| Reminders | [820 × 580](evidence/arc-66/reminders-820x580.png) | Agenda and calendar remain distinct and legible; narrow fallback stacks them. |
| Active note | [1024 × 680](evidence/arc-66/note-1024x680.png) | Tool glyphs and three dots share a steady stroke and aligned circular hit areas; the existing paper shape remains. |

The captures use fake content and do not demonstrate sign-in, native position, mixed DPI, app-context attachment, installed logo rendering, slash-menu behavior, or the close confirmation. Those flows belong to exact-build owner testing.

## Interaction and accessibility checks

- Hover feedback changes background or border without shifting controls. Pressed and disabled feedback is more consistent across note tools and the global rail.
- Lucide icons use the shared `--icon-stroke` value (1.9) and rounded joins; controls keep their existing semantic button labels. The paper-colour swatch remains a filled custom glyph and was given a stronger outline.
- The reduced-motion rule already removes rail and desktop animation. The responsive fallback was checked visually, but high-contrast Windows, keyboard order, screen readers, text scaling, and touch still need a real installed-app pass (public accessibility gate [#31](https://github.com/Ankit6149/skribly/issues/31)).
- The current note’s close dialog and slash input behavior were addressed in earlier source work; this visual pass did not change their logic or assert owner acceptance. Recheck both on the next installed candidate.

## Closing slide diagnosis (research only)

The owner said the **desktop edge widget closing** feels broken and asked for a solution without implementing motion changes yet. `ContextRail.tsx` sets `is-closing`, waits a fixed **170 ms** timer, then invokes the native collapse. `context-rail.css` animates the panel outward for **170 ms**. Native `size_and_dock_rail` then changes the WebView's size, position and Windows backdrop. A timer equal to the CSS duration can race the first painted frame or animation completion; the native resize/backdrop switch can therefore look like a snap. This is a code-based hypothesis, not a confirmed Windows trace.

Recommended next experiment: instrument `animationstart`/`animationend`, native invoke start/end, WebView resize, and DWM backdrop timing on the installed build at 100%, 125%, and 200% scale on both edges. Keep the expanded native host stable until an `animationend` signal (with a bounded fallback for reduced motion or lost events), then collapse it once; prevent duplicate close requests. Compare a transform-only exit, a brief opacity finish, and a native host transition in short recordings. Preserve keyboard focus and the compact widget's visible backdrop. Do not tune a CSS duration in isolation: this is a two-renderer handoff.

## Acceptance boundary

The desktop source build and unit tests passing demonstrate that the refactor compiles and preserves exercised logic. They do **not** establish native Windows appearance or a release. Before accepting this design, install a newly built candidate over the current owner version without resetting notes; check the note logo and three dots, all rail states, slash input, close confirmation, Find/Reminders/Settings at minimum window size, closing motion, keyboard focus, DPI and monitor edges, and persisted notes/attachments/reminders after restart. Record the exact installer hash and any screenshots/video. Keep ARC-66 and public release gates open until that result is known.

## 30 September source stability follow-up

The global rail now waits for its own `animationend` before requesting native collapse. A 350 ms fallback covers a lost WebView animation event, and a newer native rail revision cancels the delayed request. Reduced-motion users continue to collapse immediately. The earlier fixed 170 ms timer could race React paint and native resize; this change removes that known timing race in source. It does not prove the DWM backdrop and WebView handoff looks smooth on Windows.

The relevant rail interaction tests cover animation completion, lost-event fallback, and native collapse overtaking a pending close. TypeScript, the production frontend build, all 237 current frontend tests, and Rust unit tests passed locally; the focused rail suite has four passing tests. Windows Application Hang event 1002 confirms one v0.1.43 `AppHangB1` on 27 September, but its WER report contains no dump or call stack. No cause can be attributed from that event. A current installed candidate still needs owner-observed open/close repetitions on both dock sides, focus switching, scaling, and a hang capture if it recurs.

A local NSIS packaging check from source commit `94077e8` completed on Windows. Its diagnostic `Skribli_0.1.47_x64-setup.exe` is 3,574,187 bytes, SHA-256 `696515D6E119023D446D558134A75C2A15E2A4B6A3B83E4DCE2A92909D04409C`, and unsigned. It was not installed or published; its version string matches but its bytes differ from the website's older v0.1.47 owner candidate. The private owner download remains the older artifact until a separately identified and accepted next candidate is prepared.
