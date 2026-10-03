# Notes feature

This directory is the canonical home for the note editor and note-specific frontend domain logic.

Current ownership:

- `SkribComposer.tsx` — note lifecycle/state coordinator for the active editor;
- `components/` — composer sub-surfaces, rich text, ink, attachments, confirmations, collapsed note surface, and window controls;
- `lifecycle/` — save/delete/open lifecycle state and rules;
- `model/` — canonical Skrib note types plus context, ink, inline-attachment and temporary-surface models;
- `persistence/` — note-specific frontend persistence coordination and rich-content IndexedDB storage;
- `state/` — note/runtime Zustand state and note-window UI state;
- `styles/` — note-owned desktop styles.

The former `features/skribs/` compatibility namespace has been removed. New note/editor code belongs here.

## Editor reliability and interaction repairs (2026-10-03)

- Typed and rich drafts have separate serialized save controllers. A failed older rich write cannot replace a newer pending draft. React StrictMode cleanup suspends controllers rather than permanently disposing them.
- Rich-content mutations use one IndexedDB read/write transaction; adapters shared by multiple repositories serialize per note. Automatic orphan sweeps are disabled because native note existence and blob deletion cannot form one atomic transaction. Confirmed permanent deletion remains the only destructive cleanup path.
- Discard retains both session snapshots, including attachment Blobs, before restoring the baseline. The journal is cleared before final native visibility/deletion. Failed compensation preserves the journal for explicit recovery. Unknown or corrupt journals fail closed and remain stored.
- Trash flushes typed and rich content before deletion. Trash and Archive cancel recurring reminder rules through the note lifecycle API rather than advancing the next occurrence.
- Native shortcut, close, and quit requests synchronously seal drawing input, commit an in-progress pen stroke or selection move, drain serialized ink writes (retrying the latest failed snapshot once), and flush typed/rich text within a 3.5 s budget before the native 5 s deadline. A failed or timed-out save rejects the transition and retains the drawing. Late persistence success cannot change a rejected acknowledgement. Other editor mutations remain quiescent until the matching native outcome; a previously reserved paste still runs when preparation is refused before drawing work.
- The footer offers one 30 px Type/Draw pill with the existing UI font. Kalam remains reserved for note text and existing handwritten surfaces. Selected text supports formatting, text color, and highlighting. Ctrl+Shift+F moves focus to the selection controls while retaining the range; Escape returns focus. Typed `/` remains until an enabled command is chosen. Inline-reference removal retains the stored file; deleting the stored file requires confirmation.
- The exact development preview route uses synthetic note IDs and memory rich-content/reminder repositories. It does not initialize persistent account state.

Verification: TypeScript passed; 23 note test files / 133 tests passed. Tests include mounted StrictMode editing, actual synthetic image/PDF ClipboardEvents through composer storage and rendering, older-write failure, shared repository interleavings, color write failure with a newer typed draft, corrupt/future recovery journals, and fault injection at every discard restore/commit stage.

Browser QA used the actual composer on the isolated synthetic preview at 320 and 420 px widths. It verified Type/Draw, bold/italic/underline, text color/highlight, retained selection keyboard focus, literal slash and date insertion, pasted image/file rendering, centered 22 px logo inside the 40 x 52 px pill, and a clear compact footer gap. Bundled font loading was verified: `document.fonts.check('20px Kalam')` and DM Sans were true. Note body/placeholder use Kalam; controls including Type/Draw use the existing UI font. The thin pill measures 30 px with 24 px buttons and no overlap with Done at the tested widths. An isolated worktree node_modules junction initially caused Vite font requests to return 403; those fallback-font captures were rejected and replaced using an ephemeral local preview allow list, without changing product typography/configuration.

Acceptance remains open for installed Windows WebView clipboard/IME/undo/pen behavior, native resize and DPI, shortcut/close/quit timing, real multi-WebView IndexedDB interleavings, quota/crash recovery, and owner runtime testing. Cross-store orphan reclamation needs a native deletion/tombstone protocol before automatic sweeping can be enabled. This implementation is not installer or release acceptance.

### Final ink repair evidence (2026-10-03)

26 note test files / 149 tests passed. New regressions use the mounted real canvas and composer to verify active pointer preservation, synchronous input sealing before React renders disabled controls, ordered durable acknowledgement, quota failure and exact snapshot retry, a stalled write rejected at 3.5 s, and no later success acknowledgement. Existing queued image/PDF paste barrier tests pass. TypeScript and required lint pass with no warnings. These DOM/storage fixtures do not prove physical pen or installed WebView scheduling.

### Automatic orphan reclamation boundary

Inferred-orphan sweeping remains disabled; this removes the unsafe deletion race rather than guessing whether an absent native note ID is permanently dead. A later reclamation feature needs a versioned native permanent-deletion tombstone with an unrepeatable generation, durable cleanup intent/acknowledgement, an import/restore policy for reused IDs, and exclusion of concurrent writers across every WebView before deleting IndexedDB content. It also needs restart/retry and failed-cleanup recovery tests. Because this changes durable native state and import semantics, it requires a reviewed storage migration, not a frontend-only sweep or an extra IndexedDB store added without that protocol. Confirmed manual deletion remains the current product behavior; no automatic deletion or migration is introduced here.
