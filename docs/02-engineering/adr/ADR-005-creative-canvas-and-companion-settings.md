# ADR-005 — optional creative canvas and companion settings

Date: 8 October 2026. Status: proposed for owner approval. Part of ARC-66.

The owner requested movable media, optional typing anywhere, matching desktop/Android design, and phone control of PC settings. These are related user experiences but require separate durable-content and remote-control contracts. This proposal does not enable a network service or rewrite existing notes.

## Creative canvas decision

Keep Flow as the default. Existing notes remain Flow with their original rich text, ink and attachment IDs. Add a per-note Creative choice and a default-for-new-notes preference. Changing the default never converts saved notes.

Creative notes store bounded text, photo, document and video objects with stable IDs, positions, dimensions and stacking order in a versioned scene. Coordinates belong to the note's logical canvas, not the physical monitor. Zoom and window resize affect the viewport, not the persisted arrangement. Files retain their existing local attachment IDs; scene objects never embed blob URLs or remote image sources.

Double-click/tap empty paper creates a text object at that point. Single-click selects an object; explicit handles move/resize it. Keyboard actions provide movement, resizing and ordering. Text selection remains text selection. Ink remains independently editable unless grouping is explicitly selected. Undo covers object edits and movement. Read-only state blocks every scene mutation.

New media defaults to inline in Flow. In Creative, media becomes a movable paper object. Photos use a clean paper frame; documents use a compact readable document card; video has a play affordance. Removing a placement retains the saved file, with an explicit explanation and reinsertion action. Deleting the saved file requires named confirmation and removes all its placements after storage succeeds.

Flow-to-Creative conversion is explicit and previewed. Creative-to-Flow conversion must preserve every text/media object or decline conversion; no silent flattening. Save, close, Quit, native shortcut transitions, discard recovery and full backup must include the scene. An older client must reject an unsupported scene version without rewriting it.

Implementation needs a versioned rich-store migration and desktop/mobile scene adapters. Before merging that migration, test old-note preservation, interruption, corrupt/future records, quota failure, undo, cross-window conflicts and clean-profile restore. Native mixed-DPI and real phone keyboard/pen acceptance remain separate.

## Companion settings decision

Separate portable preferences from device configuration. Portable preferences may include paper colour, text style, Flow/Creative defaults and quiet/original icon presentation. Custom logos are encrypted image content with bounded size, not public URLs. Use a shared validated schema and revision checks on both clients.

PC settings control requires explicitly paired devices using the approved encrypted-sync enrollment and recovery design. The phone shows the target PC, last confirmed revision, and whether the command is pending or applied. An offline PC leaves commands pending; the phone must never report success before acknowledgement. The PC validates the setting allowlist and expected revision, persists atomically, then acknowledges. Conflicts require review, not last-write-wins. Revocation cancels unapplied commands. Device and account changes invalidate stale acknowledgements.

Initial remote allowlist: note appearance, default layout for new notes, widget density and icon presentation. Exclude startup registration, OS permissions, executable paths, global shortcut registration, data deletion/import, licensing, account credentials, privacy/security controls and signing/update behavior. Extending the allowlist requires separate review.

Do not reuse account/trial metadata storage as plaintext settings transport. The account service retains its existing content-free promise. No settings network path ships before the sync ADR, secure enrollment, keys/recovery, server authorization, offline queue, conflict and real-two-device acceptance pass.

## Owner approval requested

Approve or amend: Flow default and explicit per-note Creative mode; versioned scene migration with fail-closed older clients; encrypted paired-device settings control limited to the allowlist above. This approves implementation design, not production migration/deployment, signing or publication. CONTRIBUTING.md separately requires explicit owner approval for storage migration merges and prohibits cloud sync without an approved ADR.

## Current source work

Drag sources for existing inline media, explicit confirmed saved-file deletion, responsive calendar/Settings layouts, compact equal-height widget cards, local automatic/custom app-logo choices and in-header context-pill placement are implemented separately. These repairs do not claim a Creative scene, Android settings transport, full backup or installed-device acceptance.
