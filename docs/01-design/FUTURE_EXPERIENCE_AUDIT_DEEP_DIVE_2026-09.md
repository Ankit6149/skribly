# Skribli Future Experience Audit — Corrected Deep Dive

Date: 2026-09-14  
Repository baseline reviewed: `a3f5b3aedbc368bd46a768043fff9001f7e67b99` (`v0.1.24`)  
Status: future-design gate; **not** a production UI implementation spec yet.

This document is the authoritative correction/deepening layer for `FUTURE_EXPERIENCE_AUDIT_2026-09.md`. If an older audit statement conflicts with this file or the current repository, this file wins.

## 1. Product question

Skribli should not become another place a user must maintain. The core test for every surface is:

> Does this help the thought disappear back into the user's work, or does it create another management surface?

The product has grown beyond a sticky-note editor. The current application includes contextual capture, local-first persistence and recovery, rich text, ink, files, recurring reminders, Archive/Trash lifecycle, manual native resize, a persistent My Skribs Rail, a full local Library, account/trial enforcement and bounded return-to-context behavior. The redesign therefore has to solve **hierarchy**, **presence**, **semantic clarity**, and **future extensibility**, not merely styling.

## 2. Corrections to the first audit

### 2.1 Complete Task is not a normal footer peer

Current `SkribComposer.tsx` renders the normal footer as:

- save state;
- Trash;
- Done.

`Complete task` is currently exposed inside the **delete-confirmation branch**, alongside Cancel and Move to Trash. Completing the task archives the Skrib and completes linked active reminders.

This changes the diagnosis. The current issue is not “remove Complete from the normal footer.” The issue is that **task completion is coupled to a destructive-intent state**. The future model needs an explicit actionable-note state and must expose completion only when that state exists.

### 2.2 Current visible command bar is four controls

The current permanent command bar contains:

- Draw;
- Reminder;
- Text size;
- Surface size.

Colour is a header control. Attachments are integrated through the rich editor/paste path and `NoteAttachmentPanel`; they are not another permanent command-bar icon.

Future redesigns should not add an Attach icon merely for visual symmetry. The real problem is that creative/temporal tools and view preferences are peers in the same row.

### 2.3 Tool-driven expansion already exists

Current behavior already establishes a useful pattern:

- Drawing forces the editor to Large;
- Reminder expands Compact to Medium;
- the attachment drawer expands Compact to Medium.

The future system should formalize this as **temporary workspace expansion**:

1. remember the user's current size;
2. expand only as much as the requested tool needs;
3. keep the thought and context identity continuous;
4. restore the previous size when the tool closes unless the user manually changed it during the expanded state.

### 2.4 Done has different semantics by open mode

For a normal contextual editor, Done safely saves and collapses the note back to My Skribs. For a detached/open-here editor, the note saves and closes. Empty notes are discarded only when they have no persisted rich extras.

The future UI must preserve this difference without making users learn implementation terms such as “detached.”

## 3. Current runtime truth that the design must respect

### Capture

`Ctrl + Shift + Space` is the fresh-capture path. It creates a new contextual Skrib after foreground validation. Existing Skribs are retrieved from Rail/Library rather than silently hijacking the fresh-capture gesture.

### Save safety

Text, rich text, ink, attachments and reminder operations can block leaving if persistence is not safe. This fail-closed behavior is a product strength. UI refinement should make it calmer and clearer, not weaken it.

### One active contextual editor

Skribli deliberately does not behave like an unlimited floating-canvas app. Note switching coordinates persistence before opening another note.

### Local content vs account state

Account/trial metadata can control write eligibility, but signing in is not content sync. Local-content trust and account trust must stay visually distinct.

### Context return is bounded

Skribli can return toward saved applications/windows and can start allowlisted applications, but the current context model does not truthfully guarantee restoration of a closed browser URL, Explorer path, document cursor, DOM position or other deep application state.

Any future Context Thread animation must communicate continuity **without overstating precision**.

## 4. Skrib audit

### 4.1 Four competing regions

The note's complexity is distributed across four layers:

1. **Header** — context identity, colour, reposition, close/save-collapse.
2. **Command bar** — Draw, Reminder, text size, surface size.
3. **Unified content workspace** — rich text, pasted files, attachment panel, ink overlay, reminder panel.
4. **Lifecycle/footer** — save state, Trash, Done, delete confirmation, and the currently misplaced Complete-task path.

Treating the problem as “too many toolbar icons” is incomplete. The future redesign must assign each capability to the correct **frequency and intention level**.

### 4.2 Proposed disclosure levels

**Always visible**
- readable place/context;
- thought/content;
- truthful save confidence when attention is needed;
- Done/close lifecycle.

**One intentional gesture away**
- Add;
- Mark;
- Bring back.

**Selection/tool contextual**
- rich-text formatting;
- brush/highlighter/eraser properties;
- object move/delete/order;
- attachment object actions;
- reminder repeat/time editing.

**Secondary note settings**
- paper colour;
- text-size preference;
- Fit/size actions;
- context inspector;
- lifecycle operations that are not part of the user's current job.

### 4.3 Heavy-load acceptance

A believable worst-case Skrib must remain usable with:

- long text;
- multiple photos;
- documents;
- video;
- substantial ink;
- a recurring reminder;
- future structured marks;
- a manually chosen size.

The note must not grow indefinitely. Prefer a stable header/lifecycle region plus a scrollable content body. Compact sizes can summarize rich objects, but must not hide their meaning.

## 5. Reminder vs task

Reminder and task are not the same semantic property.

**Reminder:** “Bring this thought back to me.”  
**Task:** “I explicitly made this thought actionable/completable.”

Adding a reminder must not automatically make a note look like a task. An actionable state may later be introduced by a checklist, explicit task toggle, or another deliberate user action. Only then should a strong Complete affordance appear.

Archive can remain the implementation/lifecycle store for completed Skribs, but the user-facing language may become “Past” or “Completed” where that better matches the mental model.

## 6. Manual resize

Keep native free resizing, but do not visually advertise four design-tool handles at all times.

Recommended model:

- retain native edge/corner hit zones;
- show one subtle paper-corner teaching cue on pointer proximity / first-use education;
- show dimensions only during active drag;
- remember size per Skrib;
- provide **Fit** and possibly **Work size** as meaningful commands rather than forcing Compact/Medium/Large as the only model;
- clamp to target monitor work area and remain correct across 100/125/150% scale;
- temporary tool expansion restores the previous size.

The visual cue must not falsely imply that only one corner can resize the window if the native surface supports more.

## 7. Rail audit

### Current responsibilities

The current Rail is simultaneously:

- persistent desktop launcher;
- note-count signal;
- movable/dockable object;
- Here/All/Archive scope selector;
- application/context group selector;
- note list;
- Open-here action surface;
- Return-to-saved-place surface;
- Archive restore surface;
- opening-progress surface;
- loading/empty/error/message surface;
- manual refresh surface.

The implementation is capable, but the UI has two permanent filtering dimensions before the notes: lifecycle/scope and application group.

### Protect

- Open here vs Return there;
- readable context metadata;
- Archive restore;
- opening-progress continuity;
- event-driven refresh;
- movable desktop placement.

### Reduce

- permanent application-switcher row;
- prominence of manual Refresh;
- persistent count/badge noise;
- equal visual weight for Archive in daily retrieval.

### Future target

Default to relevant thoughts for the current context. Search, Everything and Past are secondary modes. The Rail must also have an explicit **presence policy**:

- visible;
- auto-hide;
- hide until shortcut/tray restore;
- temporary quick-hide for sharing/presentation/privacy.

If the user ever asks “why can't I hide this thing?”, the persistent utility has failed regardless of visual quality.

## 8. App workspace / Home / Library audit

The current Home shell gives peer navigation weight to Home, All Skribs, Calendar, Archive and Trash, with Quick Guide, Rail access, account/trial state, updates and sign-out also present.

The Library combines reading/search with Refresh, Import, Export, Calendar, Archive, Trash and permanent-delete recovery.

This is the strongest source of “another productivity app” gravity.

Recommended future IA:

### Daily
Mostly outside the application window:
- fresh shortcut capture;
- My Skribs presence;
- notifications;
- Return/re-anchor journeys.

### Find
The primary occasional application job:
- search any Skrib;
- read rich content;
- Open here / Return;
- on-demand context/media/time filters;
- Past/Trash lifecycle filters.

### Control
Low-frequency administration:
- General;
- Appearance;
- Context & Privacy;
- Reminders;
- Data & Recovery;
- Account;
- About/updates.

Home then becomes a quiet **Ready + universal Find + recent context** state instead of a destination users need to manage.

## 9. Context and trust

Healthy context should be nearly invisible. The user needs a human-readable place label, not internal matching machinery.

When context is unavailable or ambiguous, Skribli needs one coherent repair model:

- Open here;
- Return;
- Start application when supported;
- choose candidate;
- Move;
- Detach;
- Re-anchor.

The UI should clearly distinguish:

- content is safe;
- saved place is unavailable;
- application is not running;
- return is approximate;
- storage/account state is unrelated.

Do not use one generic “error” treatment for all these domains.

## 10. State coverage contract

### Skrib
new, reopened, detached/open-here, empty, light, heavy, saving, save failed, read-only, drawing, reminder-open, attachment-busy, delete-confirming, free-resizing, minimum size, large size.

### Rail
collapsed, expanded, auto-hidden, Here empty, All, Archive/Past, loading, opening, opening failed, saved-place unavailable, archived restore, drag/dock, message.

### Find/Library
loading, empty, search no-result, selected note, rich content, calendar/time lens, Archive/Past, Trash, import preview, import conflict, export progress/success/failure, read-only.

### Account/system
first run, create account, sign in, verification pending, configuration required, trial active, licensed, expired/read-only, bounded offline state, storage recovery, startup failure.

### Context
matched, changed title, target closed, app start supported, app unsupported, ambiguous candidate, re-anchor, detach, open-here fallback.

### Accessibility/input
keyboard only, pointer, 100/125/150% scaling, reduced motion, high contrast, future touch/stylus, screen-sharing quick hide.

## 11. Cross-surface journeys

### Capture → disappear
work → shortcut → fresh contextual Skrib → write → Done → Rail → work

### Retrieve here
Rail/Find → Open here → real existing Skrib beside current work → save/close; saved anchor remains unchanged

### Return there
Rail/Find → Return → OpeningJourney → match/start/fallback → honest result

### Bring back later
Skrib → reminder → notification → Open / Return / Later

### Complete something
explicit actionable Skrib → Complete → Archive/Past → optional restore

### Recover safely
save/storage/account condition → remain open or read-only → retry/export/details → verified safe state

These transitions should be designed as carefully as individual screens.

## 12. Motion contract

Motion must communicate causality:

- **100–160ms** — acknowledgement: hover, focus, small state response;
- **180–280ms** — object reveal: attachment fan, Rail reveal, local panel transition;
- **300–450ms** — meaning change: temporary note expansion, Return continuity, re-anchor;
- **reduced motion** — replace spatial travel with immediate state update and clear focus relocation.

Avoid ambient looping motion on persistent desktop UI.

## 13. Future capability pressure

### Structured marks
Checks, arrows, shapes, pins and labels should extend a single **Mark** mode. Selected object type determines the property controls. Do not build a ribbon.

### Richer context
Browser/file-level precision, confidence and context rules belong in an Inspector/repair layer. Healthy context stays small and human-readable.

### More devices/platforms
macOS parity or future optional sync should not force cloud semantics into the note surface. Device/account/sync health belongs in Control.

## 14. Execution order

1. **Semantic decisions** — Reminder vs Task; Done vs Complete; Open here vs Return; Active/Past/Trash; Fit vs size presets; Rail visibility contract.
2. **P0 interaction systems** — resting/heavy Skrib; semantic tool gateway; Rail presence/expanded Rail; Home/Find shell; context repair; save/recovery.
3. **Object language** — attachments; reminder object; drawing/marks; calendar dates; micro-components; hover/focus/motion.
4. **Production migration** — implement approved primitives in React/Tauri surface by surface, with real keyboard, DPI, reduced-motion, native-window and failure-state acceptance.

## 15. Recommended design direction

The strongest starting point remains **Quiet Paper / Living Context**:

- **Quiet Ink** for application shell, navigation, search, Settings, functional controls, account and recovery;
- **Living Paper** for the Skrib, attachments, reminder object, colour/material and moments of tactile delight;
- **Context Thread** only for orientation, Return, re-anchor, degraded context and time continuity.

The system should feel professional without becoming corporate, creative without becoming decorative, and feature-rich without making users feel that Skribli itself is another job.