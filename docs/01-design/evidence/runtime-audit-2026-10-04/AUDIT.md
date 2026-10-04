# Desktop runtime audit — 4 October 2026

## Scope

Reviewed the note composer, context identity pill, global rail, context rail, rail open/close handoff, and duplicate-launch startup behavior against the current source previews and Windows native code.

## Findings and repairs

| Area | Finding | Repair | Evidence |
| --- | --- | --- | --- |
| General Skribs | A currently focused application could appear as context on a general note. | Context UI now depends only on context saved with the Skrib. General Skribs clear native tab bounds and show no app pill. | `03-context-note-composer.png`; composer regression tests. |
| Context pill | The pill sat lower than the top action icons and left a native hit region behind when absent. | Aligned the pill with the top control row and added a native command to clear stale tab bounds. | Source geometry plus native placement test. |
| Global rail | A transient focus loss during panel handoff could immediately dismiss the rail. | Keep presentation busy through focus handoff and dismiss only after the expanded rail is open and genuinely unfocused. | Rust rail focus regression tests. |
| Rail motion | CSS and native clipping both animated the transition, producing a double close and occasional floating handle. | Native reveal owns installed-app motion; CSS motion remains only for browser preview/fallback. | `06-global-rail-closing-frame.png`; native reveal tests. |
| Rail paint | The native host could appear before React painted, exposing a dark/blank panel. | Show the host only after the web surface acknowledges its first paint. | Rail paint-ready tests. |
| Context rail | Cards expanded on hover, differed in geometry, duplicated text and left a large blank area. | Use a fixed-width vertical list with equal cards, real app icons, a three-colour background and no hover reflow. | `05-context-rail-open.png`; component tests. |
| Duplicate startup | Windows can restore the existing window while refusing foreground activation, which produced an alarming startup error. | Treat successful restore as success even when Windows declines forced foreground activation. | Windows single-instance tests. |

## Acceptance boundary

Automated tests and source-level visual review passed. Exact installed-window behavior, closing smoothness and taskbar activation still require owner verification on the packaged Windows build. Implementation evidence alone does not close ARC-66.

**Linear write-back pending:** Linear access was unavailable in this environment.
