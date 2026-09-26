# Quiet context presence — 17 September 2026

Status: local, uncommitted and unreleased. Baseline `43c298b`, version v0.1.26 unchanged. This is a follow-up to the refinement foundation, not a new installer or a claim of complete Windows acceptance.

Follow-up: the [18 September reopen pass](REOPEN_FLOW_2026-09-18.md) implements the initiating-list placement gap below and adds stale context-action guards. This report retains the earlier verification counts.

## Interaction contract

- One indicator per context, not one dot per note. No indicator when that context has no active notes.
- Entering a matching foreground context briefly reveals “N Skribs here” for three seconds, then settles to an 8px pastel dot inside a 28px native window/hit target. No continuous blinking or pulsing.
- Hover or keyboard focus reveals the count horizontally. Leaving both allows a 250ms grace period. Holding the pointer prevents the timer from shrinking the surface during a drag.
- Clicking opens a 300 × 320 compact list. Rows retain independent Open Here and return-to-app actions, using the existing unsaved-draft handoff.
- Escape dismisses the scope menu first, then collapses the list and returns keyboard focus to the launcher.
- Revealed count uses a 164 × 36 native window. Resizing preserves the right edge and vertical centre, clamped to the target bounds. The native hitbox shrinks with the UI rather than retaining a large invisible window.
- The existing global desktop seam remains separate, with horizontal pastel bands. Website tokens, logo and Kalam note content are unchanged.

## Native lifecycle

Foreground presence has its own target snapshot, independent of the note editor. Relevant foreground events are handled before detached/dismissed editor early returns. Movement/hide/minimize/destroy events can be delivered for the presence target even when there is no active editor target.

The first-note composition flow suppresses the redundant indicator until Done or leaving that context. Home/library focus hides the app-context presence. Arrival revisions prevent a stale hover/timer request from changing a different foreground arrival. Refreshes in the same context do not restart the arrival timer.

## Verification

- 32 frontend test files, 180 tests passed. New coverage includes arrival timing, repeated refreshes, new arrivals, hover/focus coordination, departure grace, Escape, disposal and held-pointer/unmounted-launcher cleanup.
- Native: 152 library tests, 3 executable tests, 37 migration/integration tests passed (192 total), including independent presence event filtering, arrival identity and anchored geometry.
- Workspace typecheck, production build, theme/runtime/compact-surface gates and whitespace checks passed. Existing large-bundle/dead-code warnings remain.
- An isolated browser fixture rendered the real ContextRail with mocked native commands and five synthetic notes. The collapsed state, compact list, click expansion and Escape transition were checked. This is not evidence of Windows HWND, focus or compositor behavior.
- React review retained effect cleanup, event/snapshot ordering, parallel independent note reads, accessible button labels and reduced-motion overrides.
- No installed application, local note store, account/session, website or release was modified.

## Still requires acceptance

- Physical Windows app switching, detached reads, minimized/closed targets, dragging at both edges, multi-monitor/DPI transitions and transparent background recovery.
- Open Here still uses the existing placement policy beside the global rail; positioning relative to the initiating context list remains a separate refinement.
- Browser site/origin identity and single-primary versus multiple-note preferences are not implemented here. Existing stored matching is preserved rather than inferring URLs from titles.
- Temporary tool-size crash recovery and the broader drawing/attachment/navigation acceptance items in the foundation report remain open.

## Local source handoff

The full GitHub repository was cloned to `C:/Users/ANKIT BHARDWAJ/Desktop/skribli-desktop`. The verified tracked changes and explicitly identified new source/test/report files from these two refinement passes are transferred there as uncommitted changes. Private environment files, account data, notes, dependency/build caches, screenshots and unrelated untracked files are not transferred. No new branch, commit, push or release is part of this handoff.
