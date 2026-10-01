# Desktop widget surface and motion — 2 October 2026

Part of ARC-66. Codex executor. Private Windows owner candidate; installed acceptance remains open.

## Reported problem and findings

The owner reported a nearly white, cheap-looking expanded panel, missing yellow/peach/lavender widget colours, generic app symbols, a bare black backdrop before content during opening/closing, and occasional floating or jumping placement.

The old panel used a weak yellow/mint/lavender tint, small metadata and dense rows. Its icon component ignored the existing bundled Supericons Chrome/Firefox marks and VS Code silhouette when no Windows icon was cached. Resizing and moving the native host were separate operations; the programmatic destination was recorded after the resize. CSS moved only WebView content, leaving the full-size Windows Acrylic backdrop in place. A compact-widget hover also changed its width/position.

## Changes and rationale

- Use the widget's actual yellow → peach → lavender tokens across the full-height panel, at 82–84% tint opacity. Keep Acrylic underneath, with readable paper cards rather than an almost-white surface.
- Clear heading, visible All notes/Here/Archived scopes, local search, app-logo filters, larger note previews and a quiet shortcut footer. Search does not write or send notes anywhere.
- Prefer actual Windows window icons; use the already-bundled app marks when known apps are closed or provide no icon. Generic symbols remain a truthful fallback for unknown applications. No complete icon pack, remote icon request or second UI framework was added.
- Stable widget dimensions on hover. Windows applies position and size in one `SetWindowPos` transaction, recording programmatic placement first.
- Reveal the native window region, including backdrop, content and hit region, from its docked edge. Do not animate content over a stationary native backdrop. Opening is 220 ms; closing is 180 ms, based on elapsed time rather than frame count. Reduced motion uses zero-duration reveal.
- A generation-bound acknowledgement waits for two frontend animation frames after a non-zero rendered surface; a 200 ms frontend fallback handles frame throttling. This is a DOM readiness heuristic, not a GPU presentation guarantee. A 900 ms native watchdog returns an unacknowledged expanded surface to compact mode. Old callbacks cannot complete a newer transition. Programmatic focus and region changes are excluded from drag/dismiss handling while the transition is active.
- Closing clips the expanded surface completely before compact sizing/backdrop restoration. The external handle stays hidden until opening finishes. A note refresh does not reposition/focus a host mid-transition. Preparation failure attempts to restore the still-rendered previous bounds.
- Reveal frames and watchdog recovery execute on the UI thread. They try the native operation gate without blocking; a busy frame retries using elapsed-time progress. The timing worker queues one frame at a time and holds no gate while awaiting its completion, avoiding a worker/UI lock dependency. This is a preventive correction; it does not diagnose the historical AppHangB1 report.

Microsoft documents that a window region restricts drawing/hits, sends window-position messages, and transfers ownership to Windows after successful application: [SetWindowRgn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn). Each new region is transferred on success or deleted on failure. Moving/sizing uses [SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos).

## Evidence and verification

- [Before](../01-design/evidence/arc-66/widget-before-open.png) and [after](../01-design/evidence/arc-66/widget-after-open.png): actual React component in an isolated 388 × 800 browser fixture with five non-persistent sample notes. These are not installed Windows screenshots.
- Browser search for `timeline` returns the matching Friday thought; app filtering, empty/archive and short left-docked layouts are checked separately.
- Desktop frontend: 241 tests across 40 files pass, including dismissal without CSS animation events, cancellation of stale paint acknowledgement, and paint fallback cleanup. TypeScript and production build pass; React/runtime/theme/compact validators pass. Existing large-chunk warning remains.
- Windows Rust library: 177 tests pass, including native GDI region inclusion/exclusion at 100%, 125%, 150% and 200% scaling, both dock sides, bounded reveal interpolation, compact paint handoff, stale acknowledgement and interrupted transition guards. These checks establish logic and region geometry, not DWM visual smoothness.
- No note schema, account, entitlement or local storage migration. No idle animation loop: motion workers end at completion/cancellation; watchdog workers sleep once and return. Installed idle CPU/RSS and compositor frame measurements have not been collected.

## Remaining gaps, owner decision and recovery

Windows Computer Use could not initialize: `failed to write kernel assets: The system cannot find the path specified (os error 3)`. No shell UI-automation fallback or local installation was used. The exact private website installer still needs owner verification on Windows: repeated open/close, outside click, interruption, both edges, previously dragged height, multiple monitors/DPI, minimise/restore, reduced motion, missing/closed app icons, and persistence after upgrade/restart. Record idle CPU/RSS and black-flash/frame/placement evidence before product acceptance.

Keep ARC-66 and ARC-13 open. CI or an installer build is implementation evidence. This does not establish public release, signing, historical AppHangB1 resolution, or installed smoothness. If the candidate regresses, restore the v0.1.49 encrypted site asset and version labels; its owner key remains outside the repository. Do not delete or reset notes/accounts during rollback. Next execution is exact installed owner testing, followed by a bounded correction to any reproducible failure.
