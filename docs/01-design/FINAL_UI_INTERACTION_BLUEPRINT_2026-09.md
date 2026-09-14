# Skribli — Final UI & Interaction Blueprint

Status: corrected implementation contract candidate before production work  
Baseline: current v0.1.24 repo truth + Living Paper direction + September 2026 design review  
Scope: Windows-first desktop product

> **Product promise:** Leave a thought where it happened. Keep working. Skribli remembers the rest.

This document supersedes earlier final-blueprint statements when they conflict with the four-surface model below.

---

# 0. The corrected product model

Skribli has **four distinct UI surfaces**. Do not merge them visually, semantically, or technically.

## A. Global My Skribs Widget

A persistent desktop-level widget available across applications.

- lives at a monitor/screen edge;
- available regardless of the currently focused app unless the user hides/auto-hides it;
- represents **global active Skribs**, not the current app;
- opening it reveals the **Global Shelf**;
- Global Shelf gives quick cross-app access to recent Skribs and entry points to Library / Reminders;
- it is not `N Skribs here`.

## B. Per-app Context Bar

A separate contextual overlay associated with one target app/window where Skribs exist.

Example label:

`2 Skribs here   Chrome`

- perceptually lives with the target application/window;
- technically remains a separate transparent Tauri window/overlay positioned from HWND/window geometry;
- follows that target window when it moves/resizes;
- normally appears only while that target window is focused or otherwise explicitly configured;
- opening it reveals only the Skribs for that exact matching context;
- its `+` creates a new Skrib for that same context;
- it must never turn into global Library/Reminders/Settings navigation.

## C. Skrib Note

The actual contextual thought surface.

- one mixed canvas;
- text + inline media + free media + ink + reminder + optional checklist can coexist;
- no permanent feature toolbar;
- no separate Draw screen;
- user-owned content is tactile, while controls remain restrained.

## D. Main Skribli App

The normal application window.

Primary responsibilities:

- Library
- Reminders
- Settings
- Account
- lifecycle/recovery actions

It is deeper/global control. It is not the desktop widget and not the per-app context bar.

---

# 1. Current repo truth vs future model

Current v0.1.24 code has one global `ContextRail` (`apps/desktop/src/features/rail/ContextRail.tsx`).

That component currently mixes:

- collapsed count pill;
- Here / All / Archive scopes;
- grouped contexts;
- Open Here;
- Return to saved context;
- restore Archive;
- opening progress;
- loading/error states;
- persistent movable desktop presence.

The current Home window also exposes `My Skribs rail` and calls `show_global_note_rail`.

Therefore:

- **Global My Skribs Widget / Global Shelf** should reuse valid global rail data/event/open-context plumbing where appropriate.
- **Per-app Context Bar / Context Strip** is a **new surface to build**. Do not pretend the current rail already implements it.
- presentation responsibilities must be split without blindly rewriting proven persistence/context logic.

---

# 2. Global My Skribs Widget

## 2.1 Purpose

Answer:

- “Give me my Skribs from anywhere.”
- “What did I recently leave across my work?”
- “Take me to Library or Reminders.”

It does **not** answer “what exists in this exact app/window?” — that belongs to the Per-app Context Bar.

## 2.2 Resting visual

Living Paper visual:

- three small layered slips;
- front yellow;
- rear mint and peach;
- compact vertical/edge object around ~`38–44 px` wide and `68–84 px` tall;
- optional small global count badge (`12`, `99+`);
- no current-app label;
- no `here` wording.

## 2.3 Placement

Default:

- docked to a safe monitor edge;
- user may reposition/dock;
- stays independent of target-app window geometry;
- never covers the Windows taskbar.

Presence modes:

- Always visible
- Auto-hide
- Hidden until shortcut/tray

Auto-hide may leave a tiny three-colour edge seam.

## 2.4 Opening → Global Shelf

Click front slip → toggle Global Shelf.

Global Shelf:

- anchored to the desktop widget;
- shows 3–5 recent/high-value active Skribs across applications;
- rows show title + source app/context;
- main row click = Open Here;
- small `↗` = Return toward saved place;
- footer actions: Library, Reminders, More;
- no Here/All/Archive tabs inside the shelf;
- no huge floating card wall.

Global Shelf motion:

- rear slips separate slightly;
- shelf rows reveal from screen edge;
- `180–220 ms` total;
- reduced motion → opacity/state change only.

## 2.5 Global widget click destinations

- Widget front → open/close Global Shelf
- Global Shelf row → Open Here
- Row `↗` → Return
- Library → Main App → Library
- Reminders → Main App → Reminders
- More → global widget presence/settings menu

---

# 3. Per-app Context Bar

## 3.1 Purpose

Answer only:

> “What Skribs belong right here?”

Example:

`2 Skribs here   Chrome`

## 3.2 Scope

Context should use the strongest valid matching data available for the captured target.

Desired scope hierarchy:

1. exact saved target/window/page/file context when valid;
2. safe broader app/window match only when explicitly supported by context matching rules;
3. fail closed when confidence is insufficient.

Do not silently show unrelated notes merely because they share a process name.

## 3.3 Technical shape

“Inside the app” is a **perceptual** relationship.

Do not inject UI into arbitrary third-party applications.

Implement as a small transparent non-activating Tauri overlay/window positioned from native target-window bounds.

The bar:

- moves when the target window moves;
- recomputes on resize/DPI/monitor changes;
- hides/fades when target is no longer the relevant foreground context by default;
- never remains floating over unrelated applications.

## 3.4 Placement

Preferred:

- near upper-right content/title-bar-adjacent safe area of the target window;
- avoid native window controls;
- avoid covering the most important app content where possible;
- if right side lacks safe space, mirror to left or lower edge;
- maximized/fullscreen uses an internal-safe-edge overlay position;
- windowed app uses coordinates derived from that window, not the whole monitor.

## 3.5 Resting visual

Small horizontal Living Paper bar:

- yellow front slip;
- mint rear slip;
- `N Skribs here` main label;
- smaller app label;
- separate `+` action.

Suggested logical size:

- `126–150 px` width;
- `28–32 px` height;
- minimum `32 px` interactive target where possible.

## 3.6 Opening → Context Strip

Click `N Skribs here` → reveal only notes matching this exact context.

Context Strip:

- no global navigation;
- no Reminders/Settings;
- no All/Past/Archive tabs;
- max 3–4 local rows before a bounded `Show all N here` affordance;
- main row click opens the note in the same context;
- row More may expose note-specific actions;
- `+` on the bar creates a new Skrib for this exact context.

This surface should feel like the app has a small memory edge, not like a separate notes application opened over it.

## 3.7 Focus behavior

Default:

- focused matching target → full opacity;
- target remains visible but unfocused → fade strongly or hide after short debounce;
- unrelated foreground app → hidden;
- target minimized/closed → hidden;
- reopening matching target may restore the bar after safe revalidation.

Do not animate the bar flying across the screen when focus changes.

## 3.8 Motion

- open local strip: `140–180 ms`;
- close: `110–150 ms`;
- focus fade: ~`90–140 ms`;
- target-window move: position tracks directly or with negligible interpolation; never lag perceptibly behind native movement.

---

# 4. Skrib Note — polished mixed canvas

## 4.1 Resting hierarchy

The thought is the interface.

At rest show only:

1. paper surface;
2. compact human-readable context chip;
3. content;
4. quiet More control;
5. subtle Put Away control;
6. resize affordance only at the lower-right edge.

Do not show:

- permanent Add/Mark/Bring back toolbar;
- permanent Saved locally label;
- permanent Draw section;
- feature dashboard inside the note.

## 4.2 Context chip

Top-left compact chip, e.g.:

`Chrome · release preview`

Click → Context Inspector.

Context Inspector may contain:

- captured app/window/page/file summary;
- Return status;
- Re-anchor;
- Detach;
- context confidence/recovery states where needed.

No process IDs in normal UI.

## 4.3 Put Away

Use a subtle top-right fold/corner affordance.

Click:

1. settle pending content/object/ink edit;
2. save;
3. if save succeeds → hide note;
4. if save fails → keep note open and show recovery strip.

Keyboard: `Ctrl + Enter`.

Lower-right is reserved for native resize and must never share Put Away semantics.

## 4.4 Save feedback

Success:

- small transient `✓ saved` / check;
- roughly `700–1000 ms`;
- no permanent status text.

Failure:

- persistent attached recovery strip;
- `This edit still needs to save.`
- actions: Retry / Details / safe recovery path.

## 4.5 Mixed canvas model

One coordinate system with layered behavior:

1. paper/background;
2. text + inline blocks;
3. free-position objects;
4. ink/highlighter/shapes;
5. selection chrome;
6. temporary tool popovers.

All layers scroll together and preserve annotation alignment.

## 4.6 Text

- click → caret;
- selection → compact floating formatting bubble;
- `/` at caret → insertion menu;
- no permanent rich-text toolbar.

## 4.7 Attachments

Setting: Attachment placement

- Smart — default
- Inline
- Free
- Ask each time

Smart behavior:

- paste at text caret → Inline;
- drop on insertion point → Inline;
- drop in free paper space → Free.

Image selection toolbar appears only when selected:

- Inline / Free
- Open
- Remove
- future crop/replace only if needed.

## 4.8 Ink

There is no Draw screen.

Stylus:

- draws directly anywhere on the note.

Mouse/trackpad:

- default pointer mode edits/selects;
- small edge Ink control or `Alt + I` enters temporary Mouse Ink;
- palette: Pen / Highlighter / Eraser / Select;
- Escape exits Mouse Ink before affecting note lifecycle.

Ink may cross text and images.

Moving an image does not move nearby ink unless explicitly grouped.

## 4.9 Reminder

Reminder means:

> Bring this thought back.

It does not make the note a task.

Reminder appears as a small dated chip/slip.

Quick choices:

- Later today
- Tomorrow
- Next week
- Exact…

Exact may temporarily expand the same note into a roomy date/time planner and then restore the prior note size.

## 4.10 Checklist / actionable content

A note becomes completable only after explicit actionable intent such as checklist/task conversion.

Do not couple normal Trash confirmation with task completion.

---

# 5. Main Skribli App

The main app remains a normal application window.

Primary navigation candidate:

- Library
- Reminders
- Settings
- Account

Library handles:

- global search;
- recent notes;
- context/app filters;
- Past;
- Trash/recovery;
- selected-note reading/detail;
- Open Here;
- Return.

Reminders handles:

- Agenda default;
- roomy Month mode;
- repeat/snooze controls;
- linked Skrib access.

Settings must separate behavior for the two desktop surfaces:

## Global Widget

- Always visible / Auto-hide / Hidden
- Left / Right dock
- show global count
- shelf row count
- shortcut to reveal

## Per-app Context Bars

- enabled/disabled
- focused-target-only (recommended default)
- show app label
- bar placement preference
- hide on presentation/screen share
- animation/reduced-motion behavior

## Note & Canvas

- attachment placement
- handwriting/text preference
- mouse Ink shortcut
- default note size
- paper color defaults
- stylus behavior

---

# 6. Exact destination contract

| Object | Action | Result |
|---|---|---|
| Global widget front | Click | Toggle Global Shelf |
| Global Shelf row | Click | Open that Skrib Here |
| Global Shelf `↗` | Click | Return toward saved place |
| Global Shelf Library | Click | Main App → Library |
| Global Shelf Reminders | Click | Main App → Reminders |
| Per-app Context Bar | Click | Toggle Context Strip for exact target |
| Per-app `+` | Click | Create fresh Skrib for current exact context |
| Context Strip row | Click | Open that note in the same context |
| Context Strip More | Click | Note-specific local actions only |
| Note context chip | Click | Context Inspector |
| Note top-right fold | Click | Save + Put Away |
| Note lower-right corner | Drag | Native resize |
| Image | Click | Select + local media controls |
| Stylus | Draw | Ink directly on same note |
| Mouse Ink control | Click / Alt+I | Temporary ink palette |
| Reminder chip | Click | Quick reminder controls / Exact planner |
| Library result | Click | Read/select in main app |
| Library Open Here | Click | Open note near current working context |
| Library Return | Click | Attempt saved-context journey |

---

# 7. Motion contract

Use motion to explain continuity, not decorate.

- Global widget open → layered slips separate + Global Shelf reveal: `180–220 ms`
- Global widget close: `140–180 ms`
- Per-app Context Strip open: `140–180 ms`
- New note: small paper settle/fade: `180–240 ms`
- Put Away: short fold/compress then hide: `220–300 ms`
- Selected attachment chrome: `90–120 ms`
- Mouse Ink palette reveal: `100–140 ms`
- Re-anchor: release old anchor → settle new: `260–420 ms`
- reduced motion: opacity/state only with equivalent focus movement.

No ambient wiggle.
No bouncing cards.
No widget flying across monitors.

---

# 8. Codex implementation order

## Phase 1 — preserve semantics and split responsibilities

Before redesigning visuals:

- preserve working note persistence;
- preserve reminder scheduling;
- preserve attachment storage;
- preserve open-note lifecycle;
- preserve context capture/revalidation;
- preserve Open Here / Return behavior where currently correct.

Explicitly document:

- Global Widget is global.
- Per-app Context Bar is contextual.
- Main App is deep/global control.
- Skrib Note is one thought.

## Phase 2 — Global Widget / Global Shelf

Refactor valid `ContextRail.tsx` plumbing into clearer responsibilities.

Suggested boundaries:

- `GlobalSkribsWidgetHost`
- `GlobalSkribsWidget`
- `GlobalShelf`
- `GlobalShelfRow`
- global recent/filter model

Do not retain Here/All/Archive tab UI merely because the current rail has it.

## Phase 3 — Per-app Context Bar

New components/services:

- `ContextBarHost`
- `ContextBar`
- `ContextStrip`
- `ContextStripRow`
- native target-window position tracker
- context-bar eligibility/matching model

Native responsibilities:

- foreground HWND/window bounds;
- move/resize/focus updates;
- monitor/DPI conversion;
- safe transparent overlay placement;
- no injection into third-party app processes.

## Phase 4 — Note shell

Split `SkribComposer.tsx` rather than rewriting all note domain logic at once.

Suggested presentation pieces:

- `SkribWindowShell`
- `SkribContextChip`
- `SkribCanvas`
- `InlineAttachment`
- `FreeAttachment`
- `InkLayer`
- `SelectionChrome`
- `ReminderChip`
- `PutAwayFold`
- `SaveRecoveryStrip`

## Phase 5 — Main app cleanup

Keep app responsibilities separate:

- Library
- Reminders
- Settings
- Account

Past/Trash may become Library lifecycle filters if approved.

---

# 9. Acceptance matrix

Do not call the migration complete until all are tested.

## Global Widget

- one / many / zero active Skribs;
- left/right dock;
- auto-hide and recovery;
- multi-monitor;
- 100/125/150% DPI;
- Global Shelf keyboard access;
- Return failure.

## Per-app Context Bar

- exact matching context with 1/2/many notes;
- window move/resize;
- maximize/restore;
- minimize/close;
- Alt+Tab focus change;
- multiple windows of same process;
- monitor crossing;
- unsupported context;
- context ambiguity;
- presentation/screen-share privacy option;
- 100/125/150% DPI.

## Note

- text only;
- long text;
- inline image;
- free image;
- multiple attachments;
- ink over text/media;
- reminder;
- checklist;
- save failure;
- read-only;
- resize min/max;
- keyboard only;
- stylus;
- reduced motion.

## Main App

- empty/new-user Library;
- large library;
- no search results;
- Reminders Agenda/Month;
- Past/Trash recovery;
- settings for both desktop surfaces;
- account/trial states.

---

# 10. Final rule

The interface should never make the user wonder whether the thing they clicked is global or contextual.

They should instantly understand:

> **The little desktop widget is mine everywhere. The little bar belongs to this app. The paper is this thought. The Skribli app is where I go when I need more control.**
