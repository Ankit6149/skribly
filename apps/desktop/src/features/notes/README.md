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
- Native shortcut, close, and quit requests quiesce editor mutations until the matching transition outcome. Pending ink cancels the transition with a retry error; this does not claim to flush ink.
- The footer offers one 30 px Type/Draw pill with Kalam labels, as requested by the founder. Other controls retain their UI typography. Selected text supports formatting, text color, and highlighting. Ctrl+Shift+F moves focus to the selection controls while retaining the range; Escape returns focus. Typed `/` remains until an enabled command is chosen. Inline-reference removal retains the stored file; deleting the stored file requires confirmation.
- The exact development preview route uses synthetic note IDs and memory rich-content/reminder repositories. It does not initialize persistent account state.

Verification: TypeScript passed; 23 note test files / 133 tests passed. Tests include mounted StrictMode editing, actual synthetic image/PDF ClipboardEvents through composer storage and rendering, older-write failure, shared repository interleavings, color write failure with a newer typed draft, corrupt/future recovery journals, and fault injection at every discard restore/commit stage.

Browser QA used the actual composer on the isolated synthetic preview at 320 and 420 px widths. It verified Type/Draw, bold/italic/underline, text color/highlight, retained selection keyboard focus, literal slash and date insertion, pasted image/file rendering, centered 22 px logo inside the 40 x 52 px pill, and a clear compact footer gap. Bundled font loading was verified: `document.fonts.check('20px Kalam')` and DM Sans were true. Note body/placeholder and Type/Draw labels use Kalam; the other controls use the existing UI font. The thin pill measures 30 px with 24 px buttons and a 22.7 px or greater gap from Done at the tested widths. An isolated worktree node_modules junction initially caused Vite font requests to return 403; those fallback-font captures were rejected and replaced using an ephemeral local preview allow list, without changing product typography/configuration.

Acceptance remains open for installed Windows WebView clipboard/IME/undo/pen behavior, native resize and DPI, shortcut/close/quit timing, real multi-WebView IndexedDB interleavings, quota/crash recovery, and owner runtime testing. Cross-store orphan reclamation needs a native deletion/tombstone protocol before automatic sweeping can be enabled. This implementation is not installer or release acceptance.
