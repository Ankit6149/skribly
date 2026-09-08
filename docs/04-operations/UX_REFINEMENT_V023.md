# v0.1.23 — note surface containment and attachment drawer

Issue: [#194](https://github.com/Ankit6149/skribly/issues/194)

## Product contract

- A Skrib can be moved to any usable display edge without Windows maximizing or snapping its transparent native host.
- Existing corner handles continue to resize the note within the supported 320×260 to 820×760 logical-size envelope.
- Crossing monitors refreshes the native rounded region for the destination display scale.
- The pastel paper fills the shaped window edge-to-edge; no transparent CSS gutter can expose a white, blue, or grey rectangle.
- Saved attachments use a 43px pull-up tray while closed so the writing canvas remains primary.
- The tray summarizes photo, video, and file counts, expands on request, and preserves the existing visual object previews and actions.
- Adding or pasting a file opens the tray so the user can immediately verify what was attached.

## Verification

- Desktop TypeScript compilation and interface tests.
- Native Rust unit and integration tests.
- Compact transparent-surface contract validation, including native Snap prevention and the attachment drawer.
- Production desktop and owner-download validation before installer publication.
