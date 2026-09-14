# Skribli — Final UI & Interaction Blueprint

Status: final design contract candidate before production implementation
Baseline: current v0.1.24 product truth + Living Paper direction + September 2026 visual audit
Scope: Windows-first desktop product. This document intentionally separates the desktop presence layer, Skrib layer, main app, and Windows/system layer.

> Product promise: **Leave a thought where it happened. Keep working. Skribli remembers the rest.**

This document supersedes earlier Living Paper statements when there is a conflict.

---

# 0. Final product model

Skribli has four UI systems. Do not merge them visually or structurally.

1. **Desktop Presence — Context Ribbon**
   - Small three-colour desktop widget attached to/following the active app or a safe screen edge.
   - Only answers: “Do I have thoughts here?” and “Show me the thoughts that matter here.”
   - It is **not** the Skribli app navigation.

2. **Skrib — Living Paper Canvas**
   - One contextual note window.
   - Text, images, documents, video, checklist items, reminders and ink coexist on one surface.
   - There is no separate Draw page or permanent feature toolbar.

3. **Main Skribli App**
   - Library, Reminders, Settings and Account.
   - Used for retrieval, planning, configuration and recovery.
   - It is an occasional control room, not the place where the user does their daily work.

4. **Windows/System Layer**
   - Global shortcut, tray, native notifications, quick hide, startup, focus/placement, unsupported-context errors and update/account states.

Everything below must preserve this separation.

---

# 1. Final visual grammar

## 1.1 Tokens

- app canvas: `#F4EFE3` / `#EFEDE5`
- paper: `#FFFDF7`
- ink: `#262923`
- muted: `#73766F`
- olive: `#536A4F`
- yellow: `#F8DF78`
- peach: `#FFD5C4`
- mint: `#DCEADF`
- sky: `#DCE8F7`
- lavender: `#E8DEF8`
- UI font: DM Sans
- display font: Manrope
- handwritten content/accent: Kalam, configurable under Appearance

## 1.2 Physicality rules

- User-owned objects may feel tactile.
- System chrome must stay precise and restrained.
- One physical metaphor per object.
- No “scrapbook wall” or decorative stationery overload.
- Shadows are short, soft and physically plausible.
- Paper texture is nearly zero; character comes from shape, overlap and motion.
- Daily interfaces cannot depend on hover.

## 1.3 Object language

- Skrib → sheet of paper
- photo → print/photo
- document → paper sheet/ticket
- video → framed still
- reminder → dated slip
- checklist → marks embedded in the thought
- saved place → small attached context tab
- desktop presence → three-colour layered Context Ribbon

---

# 2. Startup and application lifecycle

## 2.1 Normal startup

After onboarding, Skribli starts in the background.

- No main window opens automatically unless the user enables that preference.
- Context Ribbon becomes available when a valid foreground context exists.
- Global shortcut remains active.
- Tray icon remains available.

## 2.2 Opening the main app

Opening Skribli from the Start menu, desktop shortcut, tray, or `Open Skribli` command lands on **Library**, not a dashboard.

There is no permanent `Ready` navigation destination after onboarding.

A lightweight “Skribli is running · Ctrl+Shift+Space” education block may appear in Library only when:

- the library is empty;
- the user has not successfully created a Skrib yet;
- or the user explicitly opens Quick Guide.

## 2.3 First run

Onboarding has three primary steps:

1. **Keep a thought where it happened** — explain local-first contextual model.
2. **Try the shortcut** — focus another app and use `Ctrl + Shift + Space`.
3. **Meet My Skribs** — explain the three-colour Context Ribbon and Open Here vs Return.

Account/trial setup may follow, but should not dilute the core loop.

---

# 3. Desktop Presence — Context Ribbon

## 3.1 Resting shape

The canonical desktop widget is a small horizontal layered-paper object.

Approximate logical size:

- front strip: `118–126 × 30–32 px`
- two rear layers visible by `3–9 px`
- minimum interactive target: `32 px` high

Visual layers:

- front: yellow
- rear 1: mint
- rear 2: peach

Normal valid-context label:

- `2 here`
- secondary label: `Chrome`

Zero relevant Skribs:

- do **not** show `0 here` permanently;
- use neutral `My Skribs` + current app label or only the layered shape, depending available width.

Unsupported/system context:

- widget becomes neutral `My Skribs` at its safe screen-edge fallback;
- it does not pretend the unsupported surface is a contextual match.

## 3.2 Smart Anchor placement — default

Default presence mode: **Smart Anchor**.

When foreground window changes:

1. Read foreground window bounds and monitor work area.
2. Wait roughly `180 ms` to avoid chasing rapid Alt+Tab transitions.
3. If there is at least ~`170 px` safe free space to the right of the foreground window, place the Ribbon just outside its right edge, around `20–28 px` below the title bar.
4. Otherwise if equivalent space exists on the left, place it outside the left edge and mirror the fan direction.
5. Otherwise dock it to the nearest safe screen edge inside the monitor work area.
6. Maximized/fullscreen windows use the screen-edge placement immediately.
7. Never cover the Windows taskbar.
8. On multi-monitor setups only the focused monitor gets the active Ribbon by default.

Movement behavior:

- old Ribbon fades out ~`80 ms`;
- position changes without visible travel across the screen;
- new Ribbon fades in ~`120 ms`.

Do **not** animate the Ribbon flying across the monitor.

Settings alternatives:

- Smart Anchor — default
- Fixed Right Edge
- Fixed Left Edge
- Hidden until shortcut/tray

## 3.3 Ribbon hover/focus

Hover or keyboard focus may reveal two tiny adjacent controls:

- Search
- More

These controls are enrichment only; the main click path cannot depend on hover.

## 3.4 Opening the Ribbon

Clicking/tapping/focusing and activating the front strip opens the **Context Fan**.

The front three-colour Ribbon remains visible and acts as the anchor.

The Context Fan:

- has no enclosing card/background panel;
- shows at most 4 relevant paper strips at once;
- strips unfold from the Ribbon toward the available screen space;
- desktop/app content remains visible between the strips;
- rows may be slightly staggered horizontally to keep physical character without harming scanning.

Approximate dimensions:

- strip width: `270–310 px`
- strip height: `42–46 px`
- return end-cap: `38–42 px`
- gap: `5–7 px`
- maximum visible strips: 4

## 3.5 Context Fan row anatomy

Each strip contains:

- Skrib title / first meaningful line;
- one-line human context (`Chrome · checkout flow`);
- optional tiny reminder indicator;
- optional actionable/checklist indicator;
- separate Return end-cap `↗`.

Click behavior:

- **Main strip** → Open Here.
- **Return end-cap** → Return to saved place, then open the Skrib there if return succeeds.
- **Reminder indicator** → Open Here and focus reminder controls.
- **Keyboard Enter on main strip** → Open Here.
- **Keyboard shortcut/action on end-cap** → Return.

Open Here never rewrites the saved context anchor merely because the note is being viewed here.

## 3.6 Many results

If more than four relevant Skribs exist:

- show up to 4 high-relevance/recent strips;
- show a final `+N more · Find here` strip;
- clicking it opens Main App → Library with current-context filter already applied.

The desktop fan never grows into a long scrolling card.

## 3.7 Zero results

Opening the neutral Ribbon with no relevant Skribs reveals one small attached strip:

`No Skribs here`

Actions:

- `New Skrib`
- `Search everything`

The zero state is not a large empty panel.

## 3.8 Search and More

Search control:

- opens Main App → Library;
- focuses search field;
- does not open a second floating search panel on the desktop.

More control opens a small anchored menu containing:

- Show all Skribs
- Past
- Hide My Skribs
- Presence settings
- Refresh only if a recovery case requires it

## 3.9 Auto-hide / hidden

Presence options:

- Always visible
- Auto-hide
- Hidden until shortcut/tray

Auto-hide state may leave an `6–8 px` three-colour seam at the safe edge.

The Ribbon must always be recoverable through:

- tray → Show My Skribs;
- configured shortcut;
- Settings → My Skribs.

## 3.10 Ribbon motion

- open: `180–220 ms`
- each strip: `15–25 ms` stagger
- close: `140–180 ms`
- selected strip: `1–2 px` lift/straighten
- reduced motion: immediate reveal + opacity only

---

# 4. Skrib window placement and native behavior

## 4.1 New Skrib placement

`Ctrl + Shift + Space` creates a **fresh** Skrib for the current valid foreground context.

Placement algorithm:

1. Prefer the side of the active window with the most safe visible workspace.
2. If outside-window space exists, place the Skrib adjacent to the active window with `12–18 px` gap.
3. Otherwise place it inside the active monitor near the upper-right of the active window, offset enough to avoid the title bar and taskbar.
4. Never place it mostly off-screen.
5. Keep a minimum `12 px` safe margin to work-area boundaries.
6. Remember a user-moved location per Skrib for subsequent Open Here in the same context when practical.

The window may remain top-most while focused/editing, but must not trap focus or block unrelated desktop interaction after being put away.

## 4.2 Default sizes

Logical target sizes before DPI scaling:

- Compact: `340 × 240`
- Work: `480 × 340`
- Large: `640 × 460`
- hard minimum around `280 × 190`
- maximum bounded to ~`72%` of monitor work area in either dimension

Manual resize is always allowed within safe bounds.

## 4.3 Move and resize

Move:

- top paper/tape region is draggable;
- cursor communicates move state;
- content selection must not accidentally drag the native window.

Resize:

- native edge/corner hit zones remain functional;
- lower-right corner has one subtle resize fold/cue;
- temporary dimensions appear only while dragging;
- no four persistent resize handles.

**Important:** lower-right belongs to resize. It is not the Done control.

---

# 5. Resting Skrib anatomy

The canonical Skrib has five visible concepts at rest:

1. paper surface;
2. human context tab;
3. thought/content;
4. quiet More control;
5. put-away control.

There is no permanent feature toolbar and no permanent `Saved locally` label.

## 5.1 Context tab

Small tab attached to the left paper edge.

Example:

`Chrome · release checklist`

Click → Context Inspector.

States:

- healthy → normal mint/neutral tab;
- degraded → subtle warning mark;
- unavailable → tab becomes actionable and opens repair state.

Never show process IDs or internal matching scores in normal UI.

## 5.2 Put-away control

Use a small **upper-right dog-ear/fold** distinct from the lower-right resize corner.

At rest:

- no large `Done` button;
- the dog-ear is visible enough to be discoverable;
- hover/focus tooltip says `Done — save and put away`.

Click:

1. settle pending text/ink/object edit;
2. save;
3. if save succeeds, hide/put away the Skrib;
4. if save fails, keep window open and show persistent recovery strip.

Keyboard equivalent: `Ctrl + Enter`.

`Escape` behavior:

- close current popover/tool first;
- then exit mouse Ink mode if active;
- when no transient layer remains, Escape may put away the Skrib only if the user has enabled that preference; default safer behavior is **not** to hide on first plain Escape.

## 5.3 Save feedback

Normal auto-save success:

- no permanent status label;
- tiny check/ink tick appears for `700–1000 ms` then disappears.

Saving:

- only show a status if the operation takes long enough to matter.

Failure:

- persistent attached strip: `This edit still needs to save.`
- actions: Retry / Details
- Done/put-away remains blocked until the user chooses a safe path.

---

# 6. One mixed canvas: text + media + ink

There is no separate Draw screen.

## 6.1 Conceptual canvas stack

Inside the scrollable Skrib content coordinate system:

1. paper/background;
2. flow content blocks (text, checklist, inline attachments);
3. free-position objects;
4. ink/highlighter/arrow/shape layer;
5. object selection chrome;
6. transient popovers/toolbars.

All layers use the same content coordinate system so annotations stay aligned while the note scrolls.

## 6.2 Text

- click → caret/edit;
- drag/select → text selection;
- formatting bubble appears near selection only;
- supported formatting can include bold, italic, heading, checklist conversion and link later;
- no permanent rich-text toolbar.

## 6.3 Contextual insertion

Ways to add content:

- paste directly;
- drag/drop directly;
- `/` command at the text caret;
- subtle insertion tick between/near blocks on hover/focus.

Insertion menu:

- Photo
- File
- Checklist
- Reminder

Future objects join this menu rather than the resting chrome.

## 6.4 Image placement model

Setting: `Attachment placement`

Options:

- Smart — default
- Inline
- Free
- Ask each time

Smart behavior:

- paste while editing text → Inline;
- drop on insertion marker/text gap → Inline;
- drop into open paper space → Free.

Selected image toolbar:

- Inline / Free
- Open/view
- Replace (later if useful)
- Remove

Resize handles appear only while selected.

Double-click image → viewer.

## 6.5 Documents and video

Documents:

- recognisable sheet/ticket;
- filename/type readable;
- click/select → Open / Export/Save copy / Remove.

Video:

- one framed still + duration;
- click → player/viewer;
- no permanent playback controls in the resting note.

## 6.6 Ink

Pen/stylus:

- `pointerType=pen` draws directly on the Skrib anywhere without entering a separate screen.

Mouse/trackpad:

- normal pointer state = text/object interaction;
- small right-edge pen tab toggles temporary Mouse Ink mode;
- configurable keyboard equivalent, default `Alt + I` while a Skrib is focused.

Mouse Ink tool palette appears only while active:

- Pen
- Highlighter
- Eraser
- Select
- future Arrow / Shape / Pin

Escape exits Mouse Ink before it affects note lifecycle.

Ink can cross text and media.

Moving an image does **not** automatically move nearby ink. Grouping ink with an object requires explicit grouping/selection.

## 6.7 Undo/redo

`Ctrl + Z` / `Ctrl + Y` should operate across the current mixed-canvas editing history where technically safe:

- text edits;
- object insert/move/resize;
- ink strokes;
- checklist changes.

Do not silently undo lifecycle actions such as permanent delete without an explicit recovery model.

---

# 7. Reminder model

Reminder means: **Bring this thought back.**

Reminder alone does not turn a Skrib into a task.

## 7.1 Quick reminder

From `/ Reminder`, reminder slip, or selected-note actions:

- Later today
- Tomorrow
- Next week
- Exact…

Quick selections finish in one click.

## 7.2 Exact planner

Exact expands the same Skrib temporarily if more room is needed.

Target planner size:

- width roughly `560–640 px`
- height roughly `440–520 px`

Planner UI:

- spacious month grid with `40–48 px` date targets;
- time;
- repeat;
- clear summary sentence.

If available width is too narrow, use sequential steps rather than compressing month/time/repeat columns.

Close planner → restore the user's prior Skrib size.

## 7.3 Reminder slip

After scheduling, one small dated slip appears in the note.

Click slip → reminder controls.

Actions:

- change time;
- snooze;
- remove reminder;
- repeat options.

---

# 8. Actionable/checklist semantics

A note becomes completable only through explicit user intent, such as:

- inserting a checklist;
- choosing `Mark as actionable` in note More menu if retained.

Normal reminder does not imply task.

Checklist interactions:

- checkbox click toggles one item;
- completed items remain readable;
- when all items are complete, surface a quiet `Move to Past` suggestion/action;
- do not auto-archive without explicit policy/confirmation.

Task completion must never be hidden inside delete confirmation.

Put Away and Complete are different concepts.

---

# 9. Note More menu

`•••` is quiet and low-frequency.

Recommended content:

Appearance:

- paper colour;
- text appearance/typeface;

Size:

- Compact;
- Work size;
- Large;
- Fit content.

Context:

- Context details;
- Return;
- Re-anchor;
- Detach.

Lifecycle:

- Move to Past when explicitly actionable;
- Trash.

Do not put every feature in this menu. It is for low-frequency note-level controls.

---

# 10. Context Inspector and Return

## 10.1 Healthy context

Healthy context stays quiet as the context tab.

Clicking the tab opens an attached inspector showing:

- application;
- human saved-place label;
- current status;
- Return;
- Open Here;
- Re-anchor;
- Detach.

## 10.2 Return

Return means best-effort movement toward the stored application/window context supported by the runtime.

It must not promise exact closed browser URL, Explorer path, document cursor, or DOM element unless that capability is actually implemented and verified.

Success:

- focus/open target application/window;
- open Skrib beside that place.

Failure:

- keep the Skrib safe;
- show `Saved place unavailable`;
- actions: Open Here / Start app / Re-anchor / Detach.

## 10.3 Re-anchor

Re-anchor flow:

1. user chooses Re-anchor;
2. Skribli shows candidate current windows/contexts;
3. user selects candidate;
4. confirmation updates the stored anchor;
5. subtle `260–420 ms` reconnect animation.

No fake confidence percentages in daily UI.

---

# 11. Main Skribli App — final navigation

After onboarding, final left navigation is:

- **Library**
- **Reminders**
- **Settings**

Bottom area:

- Account / trial status
- Help / About / Updates through Settings or account menu

There is no permanent Home/Ready dashboard destination.

Past and Trash are subviews/filters, not top-level navigation.

Default main window size:

- approx `960 × 680` logical px
- minimum around `760 × 520`

Sidebar:

- approx `170–190 px`

## 11.1 Library

Purpose: all retrieval.

Top area:

- search field;
- current filter chip if opened from context (`Here · Chrome · release checklist`);
- filter menu.

Default filter: All active Skribs.

Filter menu:

- All
- Here (when entered from a contextual deep-link)
- With reminders
- Actionable
- Past
- Trash

Desktop widget `+N more` opens Library with `Here` filter already active.

Layout at comfortable width:

- left result/index pane ~38–42%;
- right reading/detail pane ~58–62%.

Result click:

- reads selected Skrib in detail pane;
- does not automatically open the floating note.

Detail actions:

- Return — primary when meaningful;
- Open Here;
- Edit/open Skrib;
- More.

`Ctrl + F` focuses Library search.

## 11.2 Past

Past is a Library filter.

Contains completed/actionable archived Skribs.

Actions:

- Read;
- Restore;
- Return/Open Here when context still meaningful.

## 11.3 Trash

Trash is a recovery filter.

Actions:

- Restore;
- Delete permanently.

Permanent delete requires explicit confirmation.

No permanent destructive action exists outside Trash unless it is `Move to Trash`.

---

# 12. Reminders App Surface

Default mode: **Agenda**.

Agenda groups:

- Overdue
- Today
- Tomorrow
- Later

Each row:

- time/date;
- thought title;
- human context;
- Open;
- secondary Snooze/More as needed.

Top-right mode switch:

- Agenda
- Month

Month is spacious and separate; never squeeze it into a narrow card.

Click date:

- show that day's reminder list in adjacent/detail area;
- do not replace the whole month unnecessarily.

Click reminder row:

- read/open linked Skrib;
- user may then Return or Open Here.

---

# 13. Settings — final structure

Settings exists so daily UI can stay quiet.

## 13.1 General

- Launch at sign-in
- Global New Skrib shortcut
- Open main app at startup: Off by default
- Default Skrib size: Compact / Work
- `Ctrl+Enter` put-away behavior
- Escape put-away preference: Off by default

## 13.2 Appearance

- UI theme: Warm Light / System Light/Dark later if implemented correctly
- Note typeface: Handwritten / Clean
- Default paper colour
- Reduce motion — follows OS by default
- Higher contrast

## 13.3 Note & Canvas

- Attachment placement: Smart / Inline / Free / Ask
- Mouse Ink shortcut
- Default pen colour
- Default pen width
- Stylus draws directly: On
- Remember per-Skrib size: On
- Temporary tool expansion: On

## 13.4 My Skribs / Presence

- Placement: Smart Anchor / Fixed Right / Fixed Left
- Visibility: Always / Auto-hide / Hidden until shortcut
- Show `N here` count
- Show application label
- Auto-close fan after opening a Skrib: On by default
- Restore widget on current monitor

## 13.5 Context & Privacy

- Supported applications / context matching summary
- Quick Hide shortcut
- Hide Skribli during screen sharing when detectable / user-enabled
- Context repair rules
- Clear explanation of what Skribli stores locally

## 13.6 Reminders

- Notifications enabled
- Default quick times
- Snooze choices
- Reminder sound
- Optional quiet hours
- Repeat defaults

## 13.7 Data & Recovery

- Export all
- Export one from detail view
- Import preview
- Import conflict policy
- Trash retention
- Backup/recovery status
- Diagnostics export
- Clear local data — highly guarded action

## 13.8 Account

- identity;
- trial/entitlement;
- sign in/out;
- update channel;
- explicit statement that local Skrib content is not automatically cloud-synced unless a future sync feature is actually enabled.

Trial expiry policy recommendation:

- local content stays readable and exportable;
- retrieval remains available;
- create/edit behavior follows entitlement;
- never hold local content hostage.

---

# 14. Windows tray

Native tray menu:

1. New Skrib
2. Show My Skribs
3. Open Library
4. Quick Hide
5. Settings
6. Quit

Quick Hide:

- hides all open Skrib windows and Context Ribbon;
- keeps background service alive;
- is reversible from tray/shortcut;
- does not delete or alter content.

---

# 15. Notifications

Use native Windows notifications.

Reminder notification anatomy:

- title / first meaningful line;
- human context label;
- due time.

Actions:

- Open — Open Here;
- Return — only when a meaningful saved context exists;
- Snooze.

Dismiss uses native notification dismissal.

Do not expose internal IDs or context-debug language in notifications.

---

# 16. Unsupported target / capture errors

Shortcut on unsupported or unsafe target must fail closed.

Small local message near the active window:

`Skribli can't safely attach a thought here.`

Actions:

- Create detached Skrib
- Cancel

Do not silently attach to the wrong app/context.

---

# 17. Motion contract

Motion explains continuity, not decoration.

- New Skrib: `180–240 ms`, small 8–12 px settle + fade.
- Put away: `220–300 ms`, slight fold/compress toward nearest Ribbon direction when meaningful; never travel across the entire monitor.
- Ribbon reveal: `180–220 ms`.
- Fan strips: `15–25 ms` stagger.
- Fan close: `140–180 ms`.
- Attachment drop: `80–120 ms` settle.
- Text selection bubble: `100–140 ms` reveal.
- Reminder slip: `140–180 ms` settle.
- Exact planner expansion: `220–300 ms`.
- Re-anchor: `260–420 ms` reconnect.
- Save success: tiny check visible `700–1000 ms`.
- Error/recovery: no bounce; `100–160 ms` reveal.

Reduced motion:

- spatial travel is removed;
- opacity/state changes remain;
- focus and meaning are equivalent.

No perpetual bobbing, floating or breathing animations.

---

# 18. Keyboard contract

Global:

- `Ctrl + Shift + Space` → fresh contextual Skrib.
- configurable Quick Hide shortcut.

Skrib focused:

- `Ctrl + Enter` → save + put away.
- `Alt + I` → toggle Mouse Ink by default, configurable.
- `Ctrl + Z` / `Ctrl + Y` → undo/redo.
- `Escape` → close transient popover/tool first; exit Mouse Ink before lifecycle effects.
- Tab/Shift+Tab → all visible controls in predictable order.

Main app:

- `Ctrl + F` → Library search.
- Enter → open/read selected result.
- keyboard actions expose Return and Open Here distinctly.

No primary journey is hover-only.

---

# 19. Accessibility

- minimum practical pointer targets around `32 px`; use `36–40 px` for primary controls when space permits.
- visible focus not dependent on colour alone.
- screen reader labels use action language, not metaphor-only names.
  - `Open this Skrib here`
  - `Return to saved place`
  - `Put this Skrib away`
  - `Show My Skribs`
- 100%, 125%, 150% Windows scale must be explicitly QA'd.
- high contrast must keep content readable even if paper colours flatten.
- reduced-motion path must preserve meaning.

---

# 20. Exact click/destination map

| Source | Click/action | Destination/result |
|---|---|---|
| Context Ribbon front | Click | Open/close contextual fan |
| Ribbon Search | Click | Main App → Library, search focused |
| Ribbon More | Click | Tiny presence menu |
| Fan main strip | Click | Open existing Skrib Here |
| Fan Return end-cap | Click | Return to saved place then open Skrib |
| Fan `+N more` | Click | Library filtered to current context |
| Context tab | Click | Context Inspector |
| Skrib dog-ear | Click | Save + put away |
| Lower-right corner | Drag | Native resize |
| Top/tape region | Drag | Move Skrib window |
| Text | Click | Caret/edit |
| Selected text | Selection | Contextual formatting bubble |
| `/` at caret | Type | Insert menu |
| Paste image | Paste | Inline in Smart mode |
| Drop image in open space | Drop | Free object in Smart mode |
| Image | Click | Select + object controls |
| Image | Double click | Image viewer |
| Pen/stylus | Draw | Ink directly on same Skrib |
| Mouse pen-tab / Alt+I | Toggle | Mouse Ink state |
| Reminder slip | Click | Reminder controls |
| Exact reminder | Click | Same-note expanded planner |
| Checklist checkbox | Click | Toggle item |
| All checklist items complete | State | Offer `Move to Past` |
| Main app icon/tray Open | Click | Library |
| Library result | Click | Read in detail pane |
| Library Return | Click | Return journey |
| Library Open Here | Click | Floating Skrib near current context |
| Reminder row | Click | Open/read linked Skrib |
| Past Restore | Click | Restore active Skrib |
| Trash Restore | Click | Restore active Skrib |
| Trash Delete permanently | Click | Explicit confirmation then delete |
| Tray New Skrib | Click | Fresh contextual Skrib |
| Tray Show My Skribs | Click | Reveal Ribbon on current monitor |
| Tray Quick Hide | Click | Hide Ribbon + Skrib windows |

---

# 21. Component boundaries for implementation

Do not rewrite working storage/context logic merely to match new visuals. Preserve domain behavior and replace presentation incrementally.

Recommended component split:

## Desktop presence

- `ContextRibbonHost`
- `ContextRibbonAnchor`
- `ContextFan`
- `ContextFanRow`
- `PresenceMenu`
- `SmartAnchorPositioner`

The current `ContextRail.tsx` data/event plumbing can be reused where correct, but its visual hierarchy should be replaced.

## Skrib

- `SkribWindowShell`
- `SkribCanvas`
- `FlowContentLayer`
- `FreeObjectLayer`
- `InkLayer`
- `CanvasSelectionLayer`
- `TextSelectionToolbar`
- `ObjectToolbar`
- `InsertMenu`
- `ReminderSlip`
- `ReminderPlanner`
- `ContextTab`
- `ContextInspector`
- `PutAwayControl`
- `SaveRecoveryStrip`

Current save/reminder/attachment code in `SkribComposer.tsx` should be preserved and decomposed, not blindly rewritten.

## Main app

- `LibraryHost`
- `LibrarySearch`
- `LibraryIndex`
- `SkribReadPane`
- `RemindersHost`
- `AgendaView`
- `MonthView`
- `SettingsHost`
- `AccountView`

`HomeHost.tsx` should not remain a permanent dashboard destination once onboarding migration is complete.

## Windows/system

- `TrayController`
- `NotificationController`
- `QuickHideController`
- `ForegroundContextController`
- `WindowPlacementController`

---

# 22. Production migration order

1. **Freeze semantics first**
   - Put Away vs Complete
   - Reminder vs Task
   - Open Here vs Return
   - Context truth boundaries

2. **Context Ribbon**
   - collapsed widget
   - Smart Anchor
   - contextual fan
   - many/zero/hidden states

3. **Skrib shell**
   - dog-ear put-away
   - lower-right resize
   - context tab
   - no permanent toolbar

4. **Mixed canvas**
   - flow text
   - inline/free attachment objects
   - ink overlay
   - selection and contextual insertion

5. **Reminder + actionable semantics**

6. **Main app IA**
   - Library
   - Reminders
   - Settings
   - Account
   - Past/Trash as subviews

7. **Windows integration**
   - tray
   - notifications
   - Quick Hide
   - startup behavior

8. **Context repair and recovery**

9. **Accessibility, DPI, multi-monitor and stress QA**

10. **Only then align marketing/landing visuals to the stable product UI.**

---

# 23. Acceptance gate before Codex implementation is considered complete

The design is not complete because one screenshot looks good.

Required visual/interaction QA:

### Context Ribbon

- zero / one / two / many here;
- windowed / maximized / fullscreen;
- left/right edge;
- multi-monitor;
- hidden / auto-hide / restored;
- keyboard-only;
- unsupported context.

### Skrib

- empty;
- text-only;
- 20k text;
- inline image;
- free image;
- 16 attachments;
- image + ink;
- document + video;
- checklist;
- reminder;
- repeating reminder;
- read-only;
- save failure;
- context unavailable;
- manual resize;
- 100/125/150% scaling;
- pen + mouse + keyboard.

### Main app

- empty library;
- large library;
- search/no-result;
- context-filter deep-link;
- agenda/month;
- dense reminder day;
- Past;
- Trash;
- Settings;
- Account/trial expiry;
- import/export/recovery failure.

### System

- shortcut while supported app focused;
- shortcut on unsupported target;
- Quick Hide;
- tray restore;
- notification open/return/snooze;
- startup/background behavior;
- focus changes without visual chasing.

---

# 24. Non-negotiable guardrails

- Do not turn the Context Ribbon into a card, sidebar, app navigation or mini dashboard.
- Do not reintroduce a permanent feature toolbar into the Skrib.
- Do not build Drawing as a separate page/surface.
- Do not equate Reminder with Task.
- Do not use the same physical corner for Done and resize.
- Do not put Past/Trash into the desktop widget's primary UI.
- Do not promise exact context restoration the runtime cannot truthfully provide.
- Do not let a rich Skrib grow infinitely; content scrolls inside stable window bounds.
- Do not hide destructive actions behind hover-only behavior.
- Do not rebuild working domain logic solely because the visual layer changes.

---

# 25. Final emotional test

At the end of the implementation, the user should feel:

> **I left a thought, kept working, and Skribli remembered where it belonged.**

They should not feel:

> **I opened another productivity system that I now have to organize.**
