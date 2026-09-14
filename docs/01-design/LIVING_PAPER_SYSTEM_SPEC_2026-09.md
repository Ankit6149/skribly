# Skribli — Living Paper System v2

Status: selected future design direction / product interaction contract
Baseline: v0.1.24 product truth + September 2026 audit corrections + post-review decisions

## Purpose

Living Paper is the selected future-facing design direction for Skribli. It is not a scrapbook theme, not a skeuomorphic skin, and not a toolbar dressed up as paper.

The product test remains:

> Does Skribli help the thought disappear back into the user's work, or create another place the user has to manage?

The design must feel warm and recognisable while remaining exceptionally quiet during normal work.

## 1. Core system rules

### 1.1 The whole Skrib is one mixed canvas

A Skrib is not divided into Text mode, Draw mode, Attachment mode and Reminder mode.

The user may:

- type anywhere the text flow allows;
- paste or drop an image into the thought;
- write beside an image;
- scribble over an image;
- circle a sentence;
- draw an arrow from one text region to another;
- highlight text or a screenshot;
- add a document/video object;
- attach a reminder to the same thought.

Ink is therefore a layer of the whole Skrib surface, not a separate drawing section.

### 1.2 Precise system + imperfect objects

User-owned content may feel physical. System behavior stays exact.

- Skrib → paper sheet.
- Image → photo/print.
- Document → clipped/perforated sheet.
- Video → framed still.
- Reminder → dated slip.
- Saved place → small context tab.
- My Skribs presence → layered ribbon/tab.
- System search/settings/errors → conventional, legible UI.

One physical metaphor per object.

### 1.3 Quiet at rest

The resting note must not permanently show a footer like:

`+  Saved locally  Done`

and opening capability must not produce a row of visible labels like:

`Add  Mark  Bring back  More`

Those labels may exist in accessible menus, keyboard command search, and explicit secondary surfaces, but they do not form the visual resting composition.

### 1.4 No management tax

Skribli should organise through context, time and search before asking the user to maintain folders, projects, boards or taxonomies.

## 2. Motion grammar

Motion explains where an object went.

- Acknowledge: 100–160 ms.
- Reveal: 160–240 ms.
- Transform/fold/reconnect: 260–420 ms.
- No perpetual floating/breathing motion on app surfaces.
- Reduced motion: equivalent opacity/state swap without spatial travel.

Canonical motions:

- new Skrib: 6–10 px paper unfold/settle beside the active app;
- object drop: 80–120 ms settle with at most 1–2° correction;
- attachment fan: 140–180 ms;
- reminder: dated slip stamps/settles in 140–180 ms;
- save success: a tiny ink check appears for ~700–1000 ms and fades;
- Done/Put away: paper folds toward My Skribs presence over ~260–320 ms;
- ribbon open: layered tab separates and thought strips unfold with ~20 ms stagger;
- Return: selected strip retracts toward its location end and the target app is focused; never imply exact URL/path restoration unless the runtime actually knows it.

## 3. Resting Skrib — revised composition

The resting note has no permanent bottom toolbar.

### Always visible

1. human place/context tab;
2. thought/canvas;
3. a small secondary note menu (`•••`) in a quiet edge position;
4. a folded lower-right completion corner.

### Completion corner

The lower-right paper fold is the visual completion affordance.

- click → save and Put away;
- keyboard label / screen reader label → `Done — save and put this Skrib away`;
- contextual Skrib → returns to My Skribs presence;
- Open Here/detached Skrib → saves and closes;
- save failure → does not fold away.

The control may show a small `✓` mark. It does not need a permanent black `Done` pill.

### Save confidence

`Saved locally` is not permanent text.

- while saving → tiny edge status / subtle animated ink dash;
- on success → small check appears briefly and fades;
- on failure → explicit recovery message remains visible;
- user can inspect persistent storage/account status elsewhere.

### Secondary menu

`•••` contains low-frequency note-level controls:

- paper colour;
- text size/default style;
- Fit / Work size / Reset size;
- context details;
- Move / Re-anchor / Detach;
- Trash;
- note-specific attachment layout override;
- task/actionable state when relevant.

## 4. Insertion without a permanent `+` toolbar

Capability is invoked where the user is working.

### Text/caret insertion

When the caret is in text:

- `/` opens a small insertion command menu beside the caret;
- a subtle insertion tick appears in the left gutter on pointer proximity/focus;
- clicking that tick opens contextual insert choices.

Common choices:

- Photo;
- File;
- Video;
- Checklist/action;
- Reminder;
- Divider/structured object later.

### Paste/drop

- paste image → inserts immediately;
- drag file/photo onto note → drop target follows pointer and inserts where dropped;
- drag onto an existing photo cluster → adds to that cluster;
- unsupported/too-large files show the error at the drop location without replacing the thought.

### Command search

`Ctrl + /` or a note-menu command search exposes the full capability vocabulary for keyboard users.

This replaces the visual need for a permanent `Add / Mark / Bring back / More` tray.

## 5. Unified text + image + ink canvas

### Default layout: Flow + free ink

The recommended default is a hybrid canvas:

- text flows naturally top-to-bottom;
- attachments inserted at the caret become inline content objects;
- users can scribble/highlight anywhere over the entire note;
- selected attachments can optionally be floated/free-positioned.

This gives normal users predictable writing while still enabling visual thinking.

### Image placement

Every image supports two placement states:

1. **Inline** — lives in the text flow and moves with surrounding content.
2. **Free placement** — may be dragged/resized anywhere in the Skrib canvas.

The placement switch is available only when an image is selected.

### Suggested defaults

- pasted image → Inline;
- drag/drop onto empty paper away from caret → Free placement;
- drag/drop at a visible insertion tick → Inline;
- multiple adjacent images → optional photo stack/cluster.

### Settings

`Settings → Note & Canvas → Attachment placement`:

- Smart (recommended);
- Inline by default;
- Free placement by default;
- Ask when inserted.

Per-note override remains available.

## 6. Ink interaction — not a separate Draw page

Ink is supported everywhere in the note.

### Pen/stylus

- pen input writes directly on the note without entering a separate mode;
- barrel/eraser input maps to configured ink actions;
- text/media remain selectable when pen is not contacting the surface.

### Mouse/trackpad

Because normal pointer movement cannot simultaneously mean selection and drawing, mouse users need an explicit temporary ink state.

Entry options:

- keyboard shortcut;
- small pen tab revealed on note focus/proximity;
- `Ink` from the caret/command menu.

When active:

- cursor changes clearly;
- one compact edge palette appears;
- pen/highlighter/eraser/select are available;
- palette can collapse to a thin edge handle while drawing;
- Escape returns to normal editing.

The note does **not** navigate to another Drawing section and does not replace the canvas.

### Ink over attachments

Ink sits above text/media visually.

- circles/arrows/highlight may cross image and text boundaries;
- image movement does not automatically drag ink unless the user explicitly groups/attaches selected strokes to that image;
- selected strokes may be moved/removed independently;
- future pin/shape/arrow objects use the same selection model.

## 7. Heavy Skrib

A heavy note can contain long text, inline images, floated images, document/video objects, free ink and a reminder.

Rules:

- fixed context edge/header affordances;
- internally scrollable canvas when content exceeds comfortable window height;
- completion corner stays reachable;
- content objects compact semantically rather than becoming generic file rows;
- photo clusters may fan on focus;
- reminder becomes one dated slip at rest;
- capacity warnings appear only near limits.

## 8. Reminder / Bring back

Reminder means temporal resurfacing.

Quick insertion near caret/note edge:

- Later today;
- Tomorrow;
- Next week;
- Exact…

### Exact scheduler

The previous calendar was too squeezed. The exact scheduler must have breathing room.

When Exact is chosen:

- the Skrib temporarily expands to a comfortable planner size;
- calendar target width is roughly 520–620 px where monitor space allows;
- 7-column month uses ~40–48 px date targets, not tiny compressed cells;
- time/repeat controls appear below or beside the month only when enough width exists;
- on narrow windows, month and time/repeat become sequential steps rather than squeezed columns;
- closing restores the prior user size.

### Task/actionable state

Reminder does not make a note a task.

Completion appears only after explicit actionable content/state such as a checklist/action object.

## 9. Manual resize

Keep direct native resize.

- invisible native edges/corners remain functional;
- one subtle lower-right paper fold teaches resize;
- active drag temporarily shows dimensions;
- size persists per Skrib;
- `Fit` and `Work size` live in secondary note controls;
- tool-driven temporary expansion never overwrites user size unless the user manually resizes during that session and confirms/continues at the new size.

## 10. My Skribs presence — revised from Paper Spine

The vertical spine concept is retained only as one possible open-state behavior. The preferred **collapsed widget** returns to the stronger three-colour layered idea from the earlier direction work.

### 10.1 Collapsed Context Ribbon

A small horizontal layered-paper ribbon replaces the old dot.

Visual anatomy:

- 3 staggered colour layers (for example yellow/mint/peach);
- foreground strip contains a concise count such as `2 here`;
- optional small app/place label such as `Chrome` appears only when useful;
- target height ~26–32 px;
- target width ~96–150 px depending on label;
- no enclosing card.

It should look like three paper slips tucked together, not a pill button.

### 10.2 Why horizontal

Not every application is full-screen. A horizontal ribbon can sit beside or near the focused app without pretending the screen edge is always the contextual edge.

### 10.3 Placement modes

Settings must support both:

**A. Follow active app**

- ribbon aligns near the outer top-right or bottom-right edge of the focused app window;
- if there is no space outside the window, it moves just inside the closest safe edge;
- focus changes wait briefly (~150–220 ms) before relocation so the ribbon does not chase every transient focus event;
- relocation uses fade/reposition rather than a long flying animation.

**B. Fixed screen edge**

- user chooses left/right/top/bottom area;
- ribbon remains stationary while its `here` count/context updates;
- recommended for users who dislike moving desktop UI.

Default should be tested in usability review; both are first-class, not hidden accessibility options.

### 10.4 Zero-note behavior

For a supported current app with no saved Skribs:

- ribbon may reduce to the three small layered tabs with no numeric badge;
- it must not show a loud `0 here` constantly;
- creating the first Skrib adds `1 here` with a small 100–160 ms acknowledgement.

For unsupported/no foreground context:

- ribbon falls back to an `All` state or remains hidden according to user preference.

## 11. My Skribs open view — revised again

The open Rail must still avoid a card/panel.

The preferred interaction is now a **Ribbon Fan / Paper Stream** rather than a tall side panel.

### Open from collapsed ribbon

Click the main `2 here` area:

1. foreground strip straightens slightly;
2. the three coloured layers separate by a few pixels;
3. 3–5 relevant Skrib strips unfold downward or inward from the ribbon;
4. no enclosing background appears;
5. desktop/application remains visible between strips.

If space below is insufficient, the fan opens upward. If side space is constrained, it flips inward automatically.

### Strip anatomy

Each thought strip contains:

- Skrib colour/material;
- title;
- one concise context line;
- reminder/action mark only when relevant;
- separate small location end-cap.

Behavior:

- main strip click → **Open Here**;
- location end-cap `↗` → **Return**;
- reminder mark click → opens that Skrib with reminder controls focused;
- actionable check mark click → only if the Skrib is explicitly actionable;
- keyboard focus exposes the same actions without hover.

### Ribbon controls

Do not place `Here / Everything / Past` as three permanent tabs in the open view.

Preferred model:

- main ribbon body = current-context (`Here`) results;
- search icon = search Everything;
- small overflow/chevron = Everything / Past / Hide / Presence settings;
- `+N more` strip = open Find already filtered to current context.

This keeps the everyday rail about nearby thoughts rather than lifecycle administration.

### Auto-collapse

Default:

- after Open Here/Return → fan closes;
- click outside → closes after a short forgiving delay;
- user may pin it open temporarily;
- `Esc` closes immediately.

### Motion

- fan open: 180–240 ms;
- strips stagger 15–25 ms;
- selected strip lifts 1–2 px, never floats continuously;
- close: 140–190 ms;
- reduced motion: strips appear/disappear without travel.

## 12. Click map — daily surfaces

### Context Ribbon

- click count/body → open relevant Skrib fan;
- click search icon → Rail search / Everything;
- click overflow → Everything / Past / Hide / Presence settings;
- drag grip → reposition when fixed/dock mode supports it;
- right click → same explicit menu as overflow, never unique functionality.

### Skrib strip

- click main body → Open Here;
- click `↗` end-cap → Return to saved place;
- click reminder mark → open note focused on reminder;
- click actionable mark → complete only after confirmation/state rules;
- middle click is not required for any core path.

### Skrib

- context tab → Context Inspector;
- text click → edit/select;
- selected text → local formatting bubble;
- inline image click → select image; second click/open action → viewer;
- free image drag → move;
- image corner/handle on selection → resize;
- ink pen contact → draw directly;
- mouse Ink shortcut/tab → temporary ink state;
- folded lower-right corner → Done / Put away;
- `•••` → note-level secondary controls;
- `/` at caret → insert menu;
- paste/drop → direct insertion.

### Find

- result row click → read selected Skrib in-place;
- Return → target saved place;
- Open Here → open actual Skrib near current place;
- double click result may default to Open Here only if clearly taught; do not make double-click the only path.

### Reminder agenda

- row click → read/open reminder Skrib;
- `Open` → Open Here;
- `Return` → saved context when meaningful;
- Snooze → small time menu;
- Month → full spacious month view;
- Past → completed/archived reminder-linked thoughts;
- Trash remains recovery/data, not a peer daily tab.

## 13. Global Reminders / Calendar

The global reminders surface is **agenda-first**.

### Agenda default

Large readable rows grouped by:

- overdue;
- today;
- tomorrow;
- later this week;
- repeating.

### Month view

Month is a separate roomy mode, not squeezed into a small card.

- full available content width;
- date targets ~40–48 px minimum where possible;
- no boxed dashboard cells;
- selected date uses tactile paper mark;
- reminder density shown by small dots/dashes, not tiny text in every cell;
- selected day’s agenda appears below the month on narrower widths and beside it only on sufficiently wide windows.

## 14. Home / Ready

After onboarding, Home should be sparse.

Primary content:

- Skribli is running;
- shortcut reminder;
- Find entry;
- recent/relevant thoughts only if useful;
- access to Reminders and Settings.

No permanent dashboard of product education/status cards.

## 15. Find / All Skribs

Functional search shell + tactile reading view.

- search/index remains precise;
- selected thought retains paper identity;
- Return and Open Here are explicit separate actions;
- filters are on demand;
- Import/Export move to Data & Recovery.

## 16. Settings — detailed contract

Settings exists so daily surfaces stay quiet.

### General

- launch at sign-in;
- global shortcut;
- startup behavior;
- default note work size;
- default action after Done.

### Note & Canvas

- attachment placement: Smart / Inline / Free / Ask;
- default paper colour;
- default text size/style;
- pen/stylus behavior;
- mouse Ink shortcut;
- whether selected image movement may optionally carry grouped ink;
- default photo cluster behavior.

### My Skribs / Presence

- Follow active app / Fixed screen edge;
- Always visible / Auto-hide / Hidden until shortcut;
- preferred fixed edge/position;
- show `N here` count yes/no;
- show app label yes/no;
- open behavior: auto-close after action yes/no;
- fan density (Comfortable/Compact) if needed;
- animation reduction follows system by default.

### Appearance

- paper theme/contrast;
- handwriting font usage level;
- note shadow strength (Normal/Reduced);
- UI scale where supported;
- high-contrast compatibility;
- reduced motion (System / On / Off).

### Context & Privacy

- supported apps/context rules;
- current context capture explanation;
- fail-closed matching behavior;
- re-anchor/manage context rules;
- Quick hide;
- screen-sharing/privacy mode;
- what account state is remote vs what content remains local.

### Reminders

- default quick reminder time;
- default snooze durations;
- notification actions;
- repeat behavior;
- optional quiet hours.

### Data & Recovery

- Export one/all;
- Import preview/conflicts;
- backup/recovery status;
- Trash retention policy;
- permanent-delete flow;
- diagnostics/recovery exports.

### Account

- sign in/out;
- verification/trial status;
- updates opt-in;
- explicit statement that note content is local unless future sync is separately enabled.

### About

- version;
- update status;
- release notes;
- diagnostics entry.

## 17. Context Inspector / Re-anchor

Healthy context remains a small human-readable tab.

When invoked/degraded, Inspector explains:

- application;
- saved place label;
- status;
- Open Here;
- Return;
- Start app when supported;
- Move / Detach / Re-anchor.

Do not imply exact deep restoration the runtime does not have.

## 18. Recovery

- `This edit still needs to save.` → Retry / Details;
- `This Skrib is read-only for now.` → readable/exportable;
- `Saved place unavailable.` → Open Here / Start app / Re-anchor.

Serious account/storage/startup failures use precise system UI, not playful paper metaphors.

## 19. Accessibility / input

- no primary journey depends on hover;
- all hidden/revealed controls are keyboard reachable;
- focus visible without colour alone;
- screen-reader labels use action language, not metaphor names;
- 100/125/150% Windows scaling is required acceptance;
- reduced motion preserves meaning;
- pen/stylus direct ink does not block keyboard/pointer operation;
- touch/stylus future targets use sufficiently large handles.

## 20. Acceptance matrix

Every major surface must be tested in:

- rest;
- hover/focus;
- active;
- loading/saving;
- empty;
- error;
- read-only;
- keyboard-only;
- reduced motion;
- 100/125/150% scaling.

Stress fixtures:

- 20k-character Skrib;
- long context label;
- 16 attachments;
- mixed inline and free-positioned images;
- ink over images + text;
- large ink document;
- repeat reminder;
- actionable/checklist note;
- Here empty;
- 1 / 3 / 10 / 100 relevant Rail results;
- windowed app with room outside edge;
- windowed app flush to screen edge;
- full-screen app;
- multi-monitor focus change;
- context unavailable;
- large local library;
- import/export failure.

## 21. Production migration order

1. Unified mixed Skrib canvas + Done fold + save feedback.
2. Inline/free attachments + direct ink + contextual insertion.
3. Reminder planner/calendar resize behavior.
4. Collapsed Context Ribbon.
5. Ribbon Fan / Paper Stream open Rail.
6. Find / Reminders / Settings.
7. Context repair / Return journey.
8. Recovery/account/onboarding refinements.
9. Website alignment after desktop interaction system stabilises.

No production implementation begins from a screenshot alone. Each surface needs approved click behavior, state, motion, keyboard, failure and native-window rules first.
