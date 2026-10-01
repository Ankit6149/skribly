# Note pill native mask correction — 1 October 2026

Part of ARC-13. Private owner candidate v0.1.49; installed acceptance remains open.

## Finding and change

The owner screenshot shows a white fringe outside the app-icon pill. The current CSS pill is a 40 × 52 px capsule (`border-radius:999px`), with a centered 22 × 22 px logo. Browser measurement confirms bounds relative to the note window: left 2 px, top 20 px, width 40 px, height 52 px. The native Windows region still used a fixed 22 px corner diameter, including transparent wedges outside that capsule. Its initial fallback also described the older 30 × 110 px tab.

The native tab now derives its corner diameter from the smaller measured physical dimension. Its initial fallback matches the current pill, including the 4 px upward shift for compact windows. CSS, logo placement, pill size, note curves, and user data are unchanged. The faint contained paper shadow remains a separate visual treatment.

## Evidence and limits

The Windows GDI regression test exercises the production region constructor through `PtInRegion`, excluding both formerly exposed wedges while retaining the capsule's top, left, and bottom at 100%, 125%, 150%, 175%, and 200% scaling in normal and compact layouts. All 24 placement tests passed; Rust formatting passed.

This establishes that the native clipping mask excludes the identified transparent wedges. It does not prove every WebView2 focus/compositor artifact is resolved. No installer was installed for this execution. The owner must over-install from the private website and check the pill after app switching, resizing, minimizing/restoring the target, and note close/reopen, preferably at the display scale used in the screenshot. The earlier unexplained AppHangB1 remains unclassified.

## Release and recovery

v0.1.48 was prepared but not published. v0.1.49 replaces that pending candidate and retains the merged desktop UI and existing account, entitlement, and storage behavior. Public download and signing gates remain unchanged. If the capsule clips the border or the fringe returns, keep ARC-13 open and record scale, preceding action, screenshot, and installed version. Revert this native-mask change through a PR if needed; do not reset account or local notes.
