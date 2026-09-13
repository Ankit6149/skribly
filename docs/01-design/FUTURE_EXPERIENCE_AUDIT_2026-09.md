# Skribli Future Experience Audit

**Audit date:** 2026-09-14  
**Repository baseline:** `a3f5b3aedbc368bd46a768043fff9001f7e67b99` (`v0.1.24`)  
**Purpose:** Future-product UI/UX redesign contract. This is not a request to cosmetically restyle the current build.

---

## 0. Executive diagnosis

Skribli's engineering capability has outgrown its original interface hierarchy.

The current product is no longer a small contextual sticky-note utility. One Skrib can now carry rich text, ink, files, reminders/repeating schedules, task completion/archive behavior, colour, text-size preferences, window size, context metadata, save/recovery state, and lifecycle actions. The Rail now owns Here/All/Archive, app-context switching, saved-context return, current-note feedback, and a persistent desktop presence. Home has also become a workspace shell containing Home, All Skribs, Calendar, Archive, Trash, account state, onboarding/help, announcements, trial status, and the Rail entry point.

The result is not primarily a colour, typography, or spacing problem. It is a **hierarchy and product-presence problem**:

1. too many capabilities sit at the same visual level;
2. transient work and low-frequency management are mixed;
3. product state is exposed where the user only wants to leave a thought;
4. the desktop presence can feel like another object to manage rather than a helper that disappears;
5. the normal app window is drifting toward a conventional productivity dashboard;
6. context, reminder, task, archive, and lifecycle concepts are starting to overlap semantically;
7. visual treatment relies too often on rectangular cards, rows, tabs, borders, and panels even though the product metaphor is spatial/tactile;
8. current CSS volume and accumulated refinements make visual intent harder to reason about than the underlying interaction model.

The redesign should therefore not ask, "How do we fit every feature into the note?" It should ask:

> **What is the smallest visible interface that makes the user's current intention obvious, while keeping the rest one gesture away?**

Skribli should feel like part of the user's existing work, not a second workplace.

---

## 1. Product truth to preserve

These are the current/future constraints the redesign should respect unless the product itself is intentionally changed.

### 1.1 Core promise

**Put a thought directly on anything on your computer. It will be waiting when you return.**

The emotional product is a quiet contextual memory layer, not a project-management system and not a dashboard-first note app.

### 1.2 Current runtime truth

- `Ctrl + Shift + Space` creates a fresh contextual Skrib after foreground-context validation.
- Only one native contextual editor is active at a time.
- Done/Close/Escape durably settle pending state before the editor hides.
- Completed task-like Skribs move into recoverable Archive; linked reminders are completed.
- Ordinary deletion moves to reversible Trash.
- The single movable **My Skribs** Rail replaces the earlier per-note floating-dot model.
- Rail scopes are **Here / All / Archive**.
- A saved note can be opened beside the current place or returned toward its saved application/window.
- Exact closed browser URL, folder, document, or DOM restoration is not currently guaranteed.
- Skrib content remains local; account/trial data is separate.
- Current rich content includes rich text, ink, attachments, and reminders/repeating schedules.
- Current note window supports compact/medium/large modes and native manual resizing within bounded monitor-safe geometry.

### 1.3 Future capabilities already implied by the roadmap

The experience architecture must be able to absorb these without becoming another ribbon editor:

- shapes;
- arrows;
- pins;
- labels;
- checklists/check-off objects;
- richer context confidence;
- re-anchor/move/detach flows;
- context rules;
- touch/stylus gestures;
- revision history/undo-redo;
- browser precision anchoring;
- macOS parity;
- possible optional sync later.

The design must therefore solve extensibility **before** more icons are added to the current toolbar.

---

## 2. Experience principles for the future redesign

### P1 — Zero management tax

The user should not need to organize Skribli in order to benefit from Skribli. Context should do the organizational work by default.

### P2 — Quiet until intention

Resting UI should expose only what is needed for the current action. Capability appears progressively after a gesture, selection, hover/focus, or explicit mode change.

### P3 — One visible intention per region

A region should not simultaneously communicate writing, formatting, drawing, scheduling, task completion, resizing, deletion, archive, context management, and storage health.

### P4 — Context is felt before it is managed

The user should intuitively feel where a Skrib belongs. Context-management machinery appears only when confidence degrades or the user asks to move/re-anchor it.

### P5 — Physical objects inside precise software

The shell can remain highly disciplined, but note/media/reminder objects may feel tactile. Avoid turning every concept into a rounded rectangle.

### P6 — Hover reveals; it never rescues discoverability

Hover/focus can expose secondary actions and richer feedback. Primary workflows remain available to keyboard, touch, and explicit controls.

### P7 — Motion explains continuity

Animation should answer: where did this thing come from, where did it go, and what changed? No decorative looping motion.

### P8 — Management lives away from capture

Import/export, backups, diagnostics, account, retention, permanent delete, history, context rules, and advanced settings do not belong in the compact capture surface.

### P9 — Feature capability is not toolbar entitlement

A feature can exist without earning a permanent toolbar button.

### P10 — Every persistent desktop element must justify its presence

If the Rail, notification, badge, icon, or widget is visible when the user is not using Skribli, it must be hideable, predictable, and extremely low-noise.

---

## 3. Current product surface map

### A. Desktop presence

1. Windows tray icon and menu
2. Collapsed My Skribs Rail launcher
3. Expanded My Skribs Rail
4. Windows reminder notifications
5. Opening/return-to-context journey

### B. Contextual editor

6. New Skrib
7. Reopened Skrib
8. Detached/open-here Skrib
9. Rich-text editing
10. Drawing/ink mode
11. Attachment interaction
12. Reminder/repeating-schedule interaction
13. Task completion / Archive action
14. Colour selection
15. Text-size control
16. Surface-size control
17. Manual resize
18. Reposition/context action
19. Save / recovery state
20. Delete / Trash action

### C. Desktop app workspace

21. Home
22. All Skribs / Notes
23. Selected-note reading/detail
24. Calendar / agenda
25. Archive
26. Trash
27. Import preview/apply
28. Export feedback
29. Account / trial / entitlement
30. Onboarding / quick guide
31. Announcements / update communication

### D. System and trust surfaces

32. Target-capture failure
33. Storage recovery/read-only
34. Startup failure
35. Licence/account blocked states
36. Missing/degraded saved context
37. Diagnostics/support detail
38. System notifications

### E. Future required surfaces

39. Settings
40. Context inspector
41. Re-anchor / move / detach flow
42. Context confidence / candidate chooser
43. Context rule manager
44. Data & backup center
45. Revision history / accidental-edit recovery
46. Structured annotation object controls
47. Privacy / screen-sharing quick-hide controls
48. Update surface

This is the minimum redesign inventory. A future UI spec that omits these will recreate fragmentation later.

---

# 4. Contextual Skrib audit

## 4.1 Current problem

The Skrib is carrying too many identities simultaneously:

- note;
- rich-text editor;
- drawing surface;
- attachment container;
- reminder scheduler;
- repeating-task editor;
- task object;
- contextual anchor;
- resizable native window;
- save/recovery surface;
- archive/delete lifecycle controller.

The current UI exposes too many of these identities at once. That makes a small paper object feel like a mini productivity application.

## 4.2 Future note hierarchy

A resting Skrib should have four layers only:

1. **Place** — subtle context identity / anchor cue.
2. **Thought** — text/ink/content itself.
3. **State** — only if saving failed, context degraded, or another exception needs attention.
4. **Leave** — one clear Done/close behavior.

Everything else is invoked contextually.

## 4.3 Header / context strip

### Current risks

- process/app/title/context information can become long and visually technical;
- drag/reposition/close actions compete with context label;
- future confidence/re-anchor controls could make this strip significantly worse.

### Redesign requirement

- Context is represented as a **place mark**, not a metadata banner.
- Default view shows app mark + one human-readable place label.
- Detailed window title/path/confidence appears only on hover/focus or through a context inspector.
- Re-anchor/move/detach must be handled by one context affordance, not three permanent buttons.
- Drag region stays generous and invisible enough to feel native.

## 4.4 Writing surface

### Current risks

- rich text increases editor complexity;
- permanent format controls would turn the note into Word-lite;
- mixed text/ink can create selection ambiguity.

### Redesign requirement

- No always-visible formatting toolbar.
- Text selection invokes a small contextual formatting bubble.
- Markdown-like shortcuts may be supported where intuitive, but should never be required.
- Empty note state is nearly blank.
- Ink should coexist with text without making the user choose a permanent "mode" before writing.
- A clear interaction contract must distinguish text selection from object/stroke selection.

## 4.5 Tool access

### Current problem

Attachment, drawing, reminder, colour, text size, note size, future checklists, arrows, labels, pins, and shapes cannot all remain peers in a compact toolbar.

### Redesign requirement

Use a **tool gateway** with three semantic groups:

- **Add** — photo/file/video, checklist/object/label later;
- **Mark** — pen/highlighter/arrow/shape/pin later;
- **Bring back** — reminder/schedule;

Appearance and window size belong to a quieter note menu or direct manipulation, not the creative tool row.

The gateway can be presented as a paper-edge tray, plus menu, radial/arc palette, or compact contextual command strip depending on chosen direction.

## 4.6 Attachments

### Current strengths

- visual photo-stack direction is aligned with the product;
- attachments are local and have real safety constraints;
- compact drawer can avoid full editor takeover.

### Current risks

- generic file-management controls can pull the note back toward technical UI;
- horizontal rows/grids can become another card strip;
- multiple media types can consume too much height.

### Redesign requirement

- image → photographic object;
- document → paper/clipping object;
- video → framed visual object;
- many items should **stack/cluster**, not form a permanent file browser;
- hover/focus reveals remove/open actions;
- click opens focused attachment view;
- technical name/type/size remain second-layer information;
- loaded notes should offer a compact cluster summary instead of rendering every attachment at full size.

## 4.7 Drawing and structured annotations

### Current risks

Ink already has Pen/Highlighter/Eraser/Select/width/colour/undo/clear. Future arrows, shapes, pins, labels, and checklist objects could produce a full design-editor ribbon.

### Redesign requirement

- enter a focused **Mark mode**;
- tools live in a detachable/minimal palette near the edge of the note;
- only selected tool properties appear;
- selected object gets local handles/actions;
- tool palette fades to a tiny handle while drawing;
- Escape returns to normal thought mode;
- future object types extend a palette registry instead of adding top-level note buttons.

## 4.8 Reminder vs task semantics

### Current problem

Reminder is described as "reminder or repeating task", while the note footer contains "Complete task" and completion archives the whole note. This risks redefining any note with a reminder as a task and gives the compact note project-management semantics.

### Recommendation

Separate the concepts:

- **Bring back** = temporal resurfacing. A thought can come back later without becoming a task.
- **Done with this** = lifecycle intent. Only after the user explicitly marks a Skrib as actionable/completable does a completion affordance become prominent.
- A reminder can be completed/dismissed independently from the Skrib unless the Skrib is explicitly a task/checklist object.
- Archive is a quiet lifecycle outcome, not a constantly advertised feature.

Future checklists can carry completion state without turning all Skribs into tasks.

## 4.9 Reminder scheduling UI

### Redesign requirement

Use two levels:

- quick natural choices in-place (later today, tomorrow, next week);
- exact date/time/repeat expands into a roomy attached scheduling sheet.

The calendar should not look like a grid of boxed app controls. Dates live in open space; selected day behaves like a small stamped/marked paper date. Recurrence is shown as plain language before Save.

## 4.10 Colour

Current code supports eight note colours while product documentation still foregrounds the original five. This is a small example of capability/UI drift.

### Redesign requirement

- colour is not a toolbar-level action;
- 5–8 swatches are fine inside appearance;
- colour should communicate personal distinction, not semantic status by default;
- avoid using the same pastel colours as exclusive state signals.

## 4.11 Text size

- Keep small/medium/large as accessibility/personal preference.
- Move to note appearance menu or contextual text selection.
- Persist per note if that matches current data model.
- Do not surface as a permanent icon beside creative tools.

## 4.12 Manual resizing

The current runtime supports compact/medium/large modes plus native corner resize behavior.

### UX problems to solve

- four visible corner handles make the paper look like a design tool;
- presets plus manual resizing can duplicate controls;
- roomy tools need temporary space without permanently changing a user's preferred size;
- very small sizes can crush rich content.

### Future contract

- resize should be discoverable through pointer proximity, not always visible chrome;
- preserve system-native edge/corner hit targets while allowing visual handles to remain hidden until hover/focus;
- direct resize is freeform within safe min/max bounds;
- `Fit`/double-click resize affordance finds a comfortable content size;
- remember user-set size per Skrib;
- temporary tool expansion remembers and restores the pre-tool size;
- clamp to monitor work area and mixed-DPI constraints;
- at minimum size, media and advanced content collapse into summaries instead of compressing illegibly.

## 4.13 Footer / lifecycle

### Current problem

Save + Delete + Complete task + Done can all compete at the bottom of a compact note.

### Redesign requirement

Resting footer should ideally contain only:

- quiet save confidence when relevant;
- one primary leave action.

Delete, archive/complete, note appearance, context details, and data actions belong in a secondary menu or become contextual based on note type.

If a Skrib is explicitly task-like, completion can temporarily replace Done or appear as the dominant action; both should not compete equally.

## 4.14 Save and recovery

Normal: no persistent "Saved locally" paragraph is necessary after the user trusts the product.

- Saving → subtle dot/ink pulse if it lasts long enough to notice.
- Saved → disappears after confirmation.
- Failed → visible inline strip that blocks Done/close until resolved or clearly explains safe recovery.
- Read-only → editing affordances disappear; content remains readable/exportable.

---

# 5. My Skribs Rail audit

## 5.1 Current responsibilities

The current Rail tries to be:

- persistent launcher;
- note count badge;
- Here/All/Archive switcher;
- application/context switcher;
- grouped note browser;
- current-note indicator;
- Open-here launcher;
- Return-to-saved-place launcher;
- archive restore surface;
- loading/error/status surface;
- movable desktop object.

That is too much conceptual weight for a narrow utility rail.

## 5.2 Primary future job

> **Get me back to a thought without making me manage a notes app.**

Everything in the Rail should support that sentence.

## 5.3 Persistent launcher

The user must be able to:

- move it;
- dock it;
- hide it;
- auto-hide it;
- reopen from tray/shortcut;
- choose whether it appears globally or only when Skribs exist nearby;
- understand count/attention without a permanent noisy badge.

A desktop utility that cannot disappear will eventually be perceived as clutter regardless of how pretty it is.

## 5.4 Filters/scopes

Here / All / Archive plus a horizontal application switcher creates two filtering dimensions before the user reaches a note.

### Recommendation

The primary Rail should use **one navigation dimension at a time**.

- Default = relevant/current-context thoughts.
- A lightweight scope switch reveals Everything / Past only when asked.
- Application grouping should be visual context, not a second permanent tab bar.
- Search can supersede explicit app filtering for large collections.

## 5.5 Row anatomy

A note row needs:

- recognisable thought/title;
- subtle place/app cue;
- one primary click target;
- optional return-to-place action;
- active/opening state.

It does not need permanent counts, multiple outlined buttons, group chrome, and redundant labels simultaneously.

## 5.6 Open here vs return there

This is a strong product distinction and should remain.

Recommendation:

- row click = open the Skrib here;
- a spatial/context affordance = return to its place;
- hover/focus can animate the context affordance toward the saved app/window;
- if exact context is unavailable, use a short attached recovery choice rather than a generic error block.

## 5.7 Archive in Rail

Archive is useful but low-frequency. It should not have equal visual priority with current thoughts.

Possible future treatment:

- "Past" or a tucked-away history edge at bottom;
- command/search access;
- optional scope when user explicitly asks.

Keep the underlying Archive behavior, reduce its daily visual cost.

---

# 6. Home / desktop app shell audit

## 6.1 Current problem

Home has evolved into a conventional sidebar workspace with:

- Home;
- All Skribs;
- Calendar;
- Archive;
- Trash;
- Quick guide;
- Rail entry;
- account/trial summary;
- sign out;
- shortcut hero;
- announcements;
- local-first explanation;
- library launch.

This creates the exact "another thing to manage" feeling the product vision tries to avoid.

## 6.2 Future role

The normal app window should be an **occasional control room**, not the centre of daily usage.

Default opening should answer:

1. Is Skribli ready?
2. What do I need to know right now?
3. Where can I find something if I intentionally came here?

Everything else is secondary.

## 6.3 Navigation

Avoid five equally weighted productivity destinations.

Recommended future top-level information architecture:

- **Find** — search/browse all Skribs, including context and past states.
- **Reminders** — only if the user intentionally manages time-based resurfacing.
- **Settings** — behavior, privacy, appearance, data, account.

Archive/Trash become filters or lifecycle lenses inside Find/Data rather than app-level destinations.

Home can be a transient ready/start surface or disappear entirely after setup in a future direction.

---

# 7. All Skribs / Find audit

## 7.1 Current strengths

- deterministic local search;
- detail pane;
- rich-content summaries;
- lifecycle safety;
- strict import preview and rollback;
- open saved context;
- keyboard `/` search.

## 7.2 Current problems

The surface combines two unrelated jobs:

### Job A — retrieve a thought

Search, browse, read, return to context.

### Job B — administer data

Import/export, Trash retention, permanent delete, recovery, diagnostics-adjacent messaging.

Job B visually contaminates Job A.

## 7.3 Redesign requirement

Make **Find** feel like a reading/search environment.

- Search is the dominant entry.
- Context, date, media and reminder filters appear progressively.
- Results are readable excerpts, not tiny management rows.
- Selecting a result reveals a calm reading surface.
- Open here / Return to place are the primary actions.
- Archive/Trash filters live in a lifecycle/filter drawer.
- Import/export moves to Settings → Data or an overflow menu.
- Permanent delete remains inside Trash only.

---

# 8. Calendar / reminders audit

The Calendar should not become a standalone calendar product.

### Future job

**Show which thoughts are coming back, and why.**

### Redesign requirements

- month view may remain, but agenda is more important than boxed grid chrome;
- reminder objects should visibly retain their Skrib colour/context;
- selecting a reminder opens the originating thought;
- completed/dismissed are lifecycle states, not separate productivity categories;
- recurrence should be readable in natural language;
- overdue state should be noticeable without aggressive red error UI;
- if reminder usage is light, the surface should collapse naturally rather than displaying a mostly empty calendar.

---

# 9. Archive audit

Current Archive is tied to task completion.

### Risk

A top-level Archive tab implies the user must regularly manage completed notes.

### Future recommendation

Treat Archive as **Past / Done** state behind Find rather than as a primary destination. Restore remains easy. Archive can also surface contextually when searching old work.

The user should never need to "clean Archive".

---

# 10. Trash audit

Trash is a safety feature, not a navigation destination.

### Future recommendation

- Move to Settings → Data / Find lifecycle filter.
- Show automatic retention clearly.
- Restore is primary.
- Permanent delete requires explicit note-specific confirmation.
- Rich-content cleanup state appears only if cleanup actually fails.

---

# 11. Import / export / backup audit

The current implementation has strong safety semantics but poor placement risk.

### Future architecture

**Settings → Data & Recovery** should distinguish:

1. Portable export/import
2. Internal crash recovery
3. User backup/restore
4. Future sync, if ever approved

These are not synonyms and must never be merged into one generic "Backup" button.

The UI should use calm step-based flows, not dense admin forms.

---

# 12. Account / trial / entitlement audit

Account is necessary for access enforcement but not part of the user's thought workflow.

### Requirements

- explain once that content remains local;
- after setup, move account/trial details to Settings/account footer;
- only surface trial/entitlement globally when it affects write capability;
- sign-out must clearly explain read/export availability without implying deletion;
- configuration and verification failures remain recoverable, focused surfaces rather than dashboard banners.

---

# 13. Onboarding audit

Onboarding should teach the mental model, not inventory features.

First-run success:

1. focus a real app;
2. press shortcut;
3. leave one thought;
4. Done;
5. see where that thought went and how to retrieve it.

Only after that should optional micro-coaching introduce attachments, marking, reminders, or Rail behavior.

Use contextual coach marks that permanently disappear after success. No feature carousel.

---

# 14. Settings — missing but now necessary

The current feature directory has no full Settings UI, but the product now needs one to prevent low-frequency controls from leaking into daily surfaces.

Recommended structure:

### General
- launch at sign-in;
- shortcut;
- Rail visibility / auto-hide;
- default note behavior.

### Appearance
- note palette;
- default text size;
- motion preference beyond OS reduced motion if desired;
- future theme.

### Context & Privacy
- context scope defaults;
- quick-hide/screen-sharing behavior;
- sensitive app exclusions;
- future saved rules and confidence behavior.

### Reminders
- notification permission/status;
- default time conventions;
- sound/quiet behavior.

### Data & Recovery
- local storage location/status;
- export/import;
- backup/restore when implemented;
- Trash retention;
- diagnostics.

### Account
- email;
- entitlement/trial;
- update email preference;
- sign out.

### About & Updates
- version;
- release notes;
- update status;
- support/diagnostics.

No settings page should be a wall of card components. Use a readable preferences document with clear sections and direct controls.

---

# 15. Context management — future critical surface

Issue #61 makes this a first-class future UX requirement.

### Context inspector

One place answers:

- Where does this Skrib belong?
- How confident is Skribli?
- What will be stored/matched?
- Can I move/re-anchor/detach it?

### Context degradation

Do not put confidence percentages in everyday note chrome.

Use progressive states:

- confident → no extra UI;
- changed but likely → subtle place marker needs attention;
- ambiguous → ask user to choose;
- unavailable → Open here / Start app / Re-anchor;
- deliberately detached → clearly marked as app-level or desktop-level.

### Re-anchor flow

Should feel spatial: old anchor releases, candidate context highlights, user confirms, then note visually settles into new place.

---

# 16. Tray and persistent presence audit

The tray should remain boring and dependable.

Recommended core actions:

- New Skrib / shortcut reminder
- Show My Skribs
- Find Skribs
- Settings
- Quick hide all visible Skribli surfaces
- Quit

Avoid mirroring every app page in the tray.

---

# 17. Notifications audit

Reminder notification should be actionable without demanding the app window.

Potential actions:

- Open thought
- Snooze
- Done/dismiss reminder

Task completion should only appear if that Skrib is explicitly task-like.

Notification copy should name the thought and place, not technical recurrence state.

---

# 18. Opening / return-to-context journey audit

The current OpeningJourney is a useful recognition of latency and uncertainty.

Future motion should visually connect:

Rail result → target app/context → note.

States:

- preparing;
- finding app/window;
- starting allowed app;
- found;
- fallback to app home;
- exact place unavailable;
- choose alternative.

Use one compact journey surface. Never stack toast + modal + Rail message for the same operation.

---

# 19. Error and recovery surfaces audit

### Target capture failure

Should explain what the user can do next, not what Win32 call failed.

### Save failure

Must remain attached to the note because it blocks leaving.

### Storage read-only

Belongs in app workspace / Data & Recovery, with a small note-level indicator when editing is impossible.

### Startup failure

Single calm recovery page with Retry / Data location / Diagnostics.

### Account failure

Separate from content/storage messaging.

### Context missing

Spatial recovery choice; not generic error banner.

---

# 20. Micro-component audit

Every future direction must define these, not only full screens.

| Component | Current/future problem | Required direction |
|---|---|---|
| Primary button | too easy to repeat rounded pills everywhere | reserve filled emphasis for one action per region |
| Icon button | tooltip dependence | recognisable icons + focus/hover label where semantics are uncommon |
| Tabs | overused for lifecycle and filters | use tabs only for true peer modes; use search/filter drawers for secondary dimensions |
| Cards | shell can become card-grid dashboard | use spacing, typography, paper edges, dividers and spatial grouping before boxes |
| Search | should be universal retrieval | command-like, fast, `/` shortcut, recent/filter suggestions |
| Context label | currently technical title text | app mark + human place; detail on demand |
| Count badge | persistent noise | only show when count helps decision or attention |
| Tooltips | too much semantic responsibility | supplementary only |
| Popover | risks nested floating boxes | use attached sheets/edge trays where spatial relation matters |
| Divider | too many bordered groups | use whitespace and tonal shifts first |
| Scrollbar | currently functional but visible | very quiet until hover; high contrast mode remains explicit |
| Colour swatch | appearance control | tactile chips; selected state not color-only |
| Note marker | row decoration | becomes context/identity cue, not arbitrary coloured bar |
| Reminder mark | generic bell/date | dated slip/stamp object |
| File object | generic card | photograph/paper/frame metaphor |
| Empty state | verbose panels | one sentence + one action, ample negative space |
| Loading | text blocks/spinners | preserve layout; tiny ink/paper motion where useful |
| Toast | can become notification spam | use only for completed global actions; local actions stay local |
| Confirmation | modal/popup fatigue | first use reversible lifecycle; explicit confirmation only for irreversible action |
| Focus ring | must survive soft aesthetic | clear ink/olive outline independent of shadow |
| Resize affordance | four permanent visual corners are noisy | invisible hit zones + one subtle discoverability cue on pointer approach |
| Drag affordance | dotted grip can look technical | generous drag region; grip appears only when pointer/focus needs teaching |

---

# 21. Motion audit

## Motion families

### A. Acknowledge — 90–160 ms
Button response, focus, hover lift, selected date, tool choice.

### B. Reveal — 160–240 ms
Contextual toolbar, attachment actions, filter drawer, Rail detail.

### C. Recompose — 220–360 ms
Note expanding for Mark/Reminder, Rail widening, reading pane transition.

### D. Travel / meaning change — 280–500 ms
Return to context, complete → Past, re-anchor, open selected Skrib.

### Rules

- no idle looping animation;
- no spring on every control;
- tactile objects may use slight spring/rotation;
- system/navigation movement uses direct easing;
- reduced motion removes travel/rotation while preserving state continuity;
- motion should not delay the user's next action.

---

# 22. Accessibility and input audit

Every direction must support:

- mouse;
- touchpad;
- touch;
- stylus;
- keyboard;
- screen reader;
- 100/125/150% display scaling and larger text;
- high contrast / forced colours;
- reduced motion.

### Specific design implications

- hover-only actions also appear on focus and have touch alternatives;
- 32–44px practical hit targets depending surface density;
- selection is not conveyed by pastel colour alone;
- handwritten font is content character, not the only font for functional labels;
- paper texture cannot reduce text contrast;
- drag/resize operations need keyboard alternatives;
- object selection needs accessible names and order;
- context confidence must not rely on colour.

---

# 23. Future information architecture recommendation

## Daily layer — almost invisible

- Shortcut → Skrib
- My Skribs presence / retrieval
- Reminder notification

## Find layer — intentional retrieval

- universal search
- context-aware results
- active + past lifecycle filters
- reading detail
- reminders lens

## Control layer — occasional

- Settings
- Context & Privacy
- Data & Recovery
- Account
- Updates/About

This replaces the current mental model of Home + All Skribs + Calendar + Archive + Trash as equal workspace destinations.

---

# 24. What should be removed from permanent visibility

Not necessarily removed as functionality — removed from the resting interface.

- permanent Complete Task on every ordinary Skrib;
- permanent Delete on every note footer;
- permanent note-size control beside creative tools;
- permanent text-size control beside creative tools;
- permanent Refresh in Rail/Library where background refresh can be trustworthy;
- Archive as equal daily Rail/app tab;
- Trash as equal app navigation destination;
- Import/export as top-of-library primary buttons;
- account/trial summary as constant workspace furniture;
- explanatory privacy cards after onboarding unless status changes;
- app grouping + scope tabs + note groups all simultaneously visible in Rail;
- technical save messages when everything is healthy.

---

# 25. What deserves stronger visibility

- where this thought belongs;
- thought content itself;
- failure to save;
- context mismatch when real;
- how to leave/close safely;
- how to retrieve/return;
- how to hide Skribli;
- reminder that is actually due;
- irreversible delete confirmation;
- account/trial limitation only when it changes what the user can do.

---

# 26. Design debt indicators from the current implementation

These are not code-quality accusations; they explain why visual coherence is becoming hard.

- `SkribComposer.tsx` is now a very large coordinator for many independent interaction domains.
- `note-experience.css` is over 50 KB and carries many successive refinements.
- `context-rail.css` and `library.css` are also substantial independent visual systems.
- Home/account and Library are combined through workspace destinations, increasing shell coupling.
- Settings does not yet exist as a real product surface, so low-frequency controls have nowhere clean to move.
- documentation still contains small remnants of the older dot model while current runtime has moved to the single Rail model.

The future redesign should introduce **experience-level component boundaries**, not only new CSS.

Suggested UI domains:

- `ThoughtSurface`
- `ContextMark` / `ContextInspector`
- `ToolGateway`
- `MarkPalette`
- `AttachmentCluster`
- `BringBackSheet`
- `SkribLifecycleMenu`
- `RailPresence`
- `RailBrowser`
- `FindSurface`
- `ReadingSurface`
- `DataRecoverySurface`
- `SettingsSurface`

---

# 27. Redesign acceptance tests

A direction is not approved because one screenshot looks attractive.

## Note stress cases

- empty new Skrib;
- one sentence;
- long rich-text note;
- rich text + ink;
- 1 attachment;
- 16 mixed attachments;
- drawing-heavy note;
- reminder-only note;
- repeating reminder;
- explicit task/checklist note;
- failed save;
- read-only;
- degraded context;
- min size;
- max size;
- 100/125/150% scaling.

## Rail stress cases

- zero notes;
- one relevant note;
- 30 notes across 8 apps;
- Archive-heavy account;
- one note opening;
- saved app missing;
- auto-hide;
- keyboard-only;
- touch target use.

## Find/app stress cases

- empty library;
- thousands of notes;
- mixed active/archive/trash;
- many reminders;
- search with no result;
- read-only storage;
- expired trial;
- import conflict;
- export failure;
- high contrast;
- narrow window.

---

# 28. Priority order for redesign

### Phase 1 — product hierarchy

1. Skrib anatomy and feature disclosure
2. Rail role/presence/retrieval model
3. Home/app-shell information architecture
4. Reminder vs task semantic model
5. Find/Library hierarchy

### Phase 2 — future capability architecture

6. Context inspector/re-anchor model
7. Tool gateway + annotation palette
8. Settings/Data & Recovery
9. Calendar/Archive/Trash lifecycle lenses
10. Account/onboarding/update/help

### Phase 3 — visual/motion system

11. tactile object grammar
12. typography/spacing system
13. hover/focus system
14. connected motion
15. accessibility and scaling fixtures

### Phase 4 — implementation planning

Only after one future direction is approved should the production component tree be refactored.

---

# 29. Audit conclusion

Skribli does not need fewer capabilities. It needs **far fewer capabilities visible at the same time**.

The most valuable future redesign is not a prettier toolbar or a cleaner sidebar. It is a product architecture in which:

- the note feels almost empty until the user asks it to do more;
- the Rail can disappear and return without becoming another desktop obligation;
- the app window is for finding and controlling Skribli, not where daily work migrates;
- task/reminder/archive behavior stays optional rather than redefining every thought;
- future arrows, pins, labels, checklists, history, and context management extend a coherent tool/inspector system instead of adding permanent buttons;
- technical trust mechanisms remain rigorous underneath and calm on the surface.

The target emotional reaction is:

> **“I leave a thought and keep working. Skribli remembers the rest.”**

Not:

> “I opened another productivity system that I now need to maintain.”
