# Skribli — Living Paper System

Status: design exploration / future product contract
Baseline: v0.1.24 product truth plus September 2026 audit corrections

## Purpose

Living Paper is the selected future-facing design direction for Skribli. It is not a scrapbook theme and not a skeuomorphic skin. The system uses tactile, recognisable content objects while keeping system behavior exact, quiet, and desktop-native.

The product test remains:

> Does Skribli help the thought disappear back into the user's work, or create another place the user has to manage?

If an interaction adds management tax, decorative weight, or persistent desktop occupation without earning it, it is rejected even if it looks attractive.

## 1. Core visual grammar

- Background/canvas: warm neutral `#f4efe3` / `#efede5`.
- Paper: `#fffdf7` plus note pastels.
- Ink: `#262923`.
- UI font: DM Sans.
- Display font: Manrope.
- Handwritten thought accent: Kalam, used selectively for note content and small tactile labels.
- Corners: paper objects can have a slightly larger/asymmetric lower-right corner.
- Shadows: short, soft, physically plausible. No floating glass-card stack.
- Texture: near-zero. Paper character comes from shape, edge, overlap, and motion—not noisy backgrounds.
- One physical metaphor per object.

### Object language

- Skrib → sheet of paper.
- Image → photograph/print.
- Document → clipped or perforated sheet.
- Video → framed still/film strip object.
- Reminder → dated slip attached to the thought.
- Checklist/actionable state → check strip embedded in the thought, not a project card.
- Saved place → small place tab / label attached to the paper edge.
- Rail → paper spine / edge index, never an enclosing panel.

## 2. Motion grammar

Motion must explain state change.

- Acknowledge: 100–160 ms.
- Reveal: 160–240 ms.
- Transform/reconnect: 260–420 ms.
- No perpetual bobbing, breathing, floating, or parallax on app surfaces.
- Reduced motion: all transitions become opacity/state swaps with no spatial travel.

Typical transforms:

- note opens: 8–12 px lift + settle;
- capability tray unfolds from paper edge;
- attachment stack fans slightly on focus;
- Rail spine opens and note strips slide from it;
- Return-to-place can use a short paper-strip retract/reappear continuity cue, but must not imply deep-link precision the runtime does not have.

## 3. Resting Skrib

The resting note is the primary product surface and must remain quiet.

Always visible:

1. place/context tab;
2. thought body;
3. one `+` capability gateway;
4. Done;
5. save confidence only when meaningful.

Not permanently visible:

- drawing;
- reminder;
- text size;
- surface size;
- colour;
- attachment administration;
- delete;
- task completion;
- diagnostics.

### Place tab

A small attached tab on the paper edge shows a human label such as `Chrome · Release checklist`.

- click/tab-focus: opens place/context details;
- degraded context: tab changes state and offers repair;
- never display process IDs in the normal state.

### Note body

- text is the visual centre;
- rich content flows as part of one thought;
- header chrome is reduced substantially from current implementation;
- selection-local text formatting appears near selected text only.

### Done

- normal contextual Skrib: saves and returns/collapses to My Skribs;
- Open Here/detached Skrib: saves and closes;
- save failure: note remains open and explains what still needs to save;
- empty note discard remains conditional on there being no persisted rich extras.

## 4. Capability gateway

Pressing `+` opens a small paper-edge tray with three semantic groups:

- **Add** — photo, file, video, checklist/structured content later;
- **Mark** — draw, highlight, arrow, shape, pin, selection tools;
- **Bring back** — later today, tomorrow, date/time, repeat.

A fourth low-emphasis `More` route contains appearance and note-level options:

- colour;
- text size;
- Fit / Work size / reset size;
- place/context details;
- move/re-anchor/detach;
- Trash.

Rules:

- future capabilities must be assigned to a semantic group rather than added as permanent toolbar peers;
- hover may enrich the tray, but opening it is explicit;
- keyboard order is linear and predictable;
- Escape closes the current layer.

## 5. Heavy Skrib

A rich Skrib can contain long text, photographs, documents, video, ink, checklist/actionable content, and a reminder without becoming a mini dashboard.

Structure:

- fixed context/header zone;
- internally scrollable thought/content region;
- fixed lifecycle/footer zone;
- capability tray remains closed at rest.

Compression rules:

- multiple images collapse into a small overlapping photograph stack;
- documents remain recognisable sheets rather than generic file rows;
- video becomes one framed preview with duration;
- ink becomes a bounded canvas/preview;
- reminder becomes one dated slip;
- attachment limits/capacity are only shown when approaching a limit or when relevant.

## 6. Attachments

### Image

- looks like a lightweight print/photo;
- a stack of 2–5 images overlaps slightly;
- focus/click fans enough to select individual images;
- full viewer is a separate temporary layer, not a permanent inspector.

### Document

- a clipped/perforated paper object;
- filename and type are readable;
- open/download/remove actions appear on selection/focus;
- unsupported/too-large states remain legible and explicit.

### Video

- a framed still with duration;
- click opens player;
- no fake “film reel” decoration beyond one small visual cue.

## 7. Mark mode

Entering Mark temporarily expands a Compact Skrib to a comfortable working size.

- palette appears as a retractable paper-edge tool roll;
- pen/highlighter/eraser/select are primary current tools;
- future arrow/shape/pin/check objects join the same Mark mode;
- active tool properties replace generic tools contextually;
- Escape exits Mark and returns to the previous user size;
- manual user resize while in Mark updates the remembered work size only after explicit user drag, not because the tool auto-expanded.

## 8. Reminder / Bring back

Reminder means temporal resurfacing, not automatic task conversion.

Quick layer:

- later today;
- tomorrow;
- next week;
- exact…

Exact scheduler:

- unfolds as a planner sheet from the Skrib;
- date grid uses soft circular/organic date marks rather than square cells;
- repeat options remain conventional and readable;
- summary sentence confirms the result: `Weekdays at 09:30`.

When closed, the Skrib shows one dated reminder slip.

### Task/actionable state

A Skrib becomes completable only when the user explicitly makes it actionable (for example via checklist/action state). Reminder alone does not imply task.

- completion must never be discovered through delete confirmation;
- completion moves the actionable Skrib into Past/Archive according to product policy;
- linked reminders are resolved with that lifecycle intentionally.

## 9. Manual resize

Keep direct native resizing but remove constant resize chrome.

- native edge/corner hit areas remain functional;
- one subtle folded lower-right paper corner teaches the behavior;
- cue appears on proximity/focus/first-use education;
- active drag shows a temporary dimension chip;
- size remembers per Skrib;
- min/max bounds stay monitor-safe;
- `Fit` finds the smallest comfortable size for the current content;
- `Work size` opens the preferred editing size;
- auto-expansion for Mark/Reminder/attachments restores the user's previous size after the temporary tool closes.

## 10. My Skribs — Paper Spine / Ribbon Rail

This replaces the card/panel model.

### Rest state

A very narrow vertical paper seam sits at the chosen screen edge.

- approximately 4–7 px visual width;
- tiny layered colour edges can hint that thoughts are stored there;
- can auto-hide to zero visible pixels;
- tray/shortcut can always restore it;
- entire spine can be repositioned/docked according to current product constraints.

### Open state

Activating the spine does **not** reveal a card.

The spine widens to a slim binding bar (roughly 28–40 px visual body). Individual Skribs slide inward from the spine as independent narrow paper strips. The desktop remains visible between strips and around them.

No enclosing rectangle, panel background, header card, or big shell.

### Spine controls

Controls live on or directly attached to the spine:

- `Here` / `Everything` / `Past` as readable small spine tabs;
- Search as a top paper tag;
- Hide/collapse control;
- optional small grip for repositioning;
- manual Refresh only in a lower-frequency recovery menu.

### Skrib strips

Each result is a 34–46 px-high paper strip extending inward.

Anatomy:

- colour/paper identity;
- title;
- one-line human context;
- optional reminder mark;
- location end-cap.

Behavior:

- click main strip → **Open Here**;
- click/focus location end-cap → **Return** to saved place;
- keyboard focus reveals both actions explicitly;
- Archive/Past rows may expose Restore after selection;
- destructive actions never appear on hover-only.

### Density

For many results:

- visible stack remains bounded;
- wheel/keyboard scroll moves through strips;
- low-priority results compress into a small stacked stub such as `+7 more`;
- Search becomes the route for large libraries.

### Animation

- spine open: 180–240 ms widening;
- strips slide inward with 15–25 ms stagger;
- selected strip lifts 1–2 px and straightens slightly;
- collapse reverses quickly (140–190 ms);
- reduced motion: strips appear immediately with focus moving to the first result.

### Empty / degraded states

No card-shaped empty state.

Use one or two attached paper strips:

- `No Skribs here · Everything`;
- `Saved place unavailable · Open here / Re-anchor`;
- `Past · 2` etc.

### Presence contract

Users must be able to:

- keep spine always visible;
- auto-hide it;
- hide it until shortcut/tray invocation;
- recover it predictably without restarting Skribli.

## 11. Tray and notifications

Windows system chrome remains native.

Skribli character appears through:

- icon/mark;
- wording;
- one small note-colour accent where platform APIs allow it.

Tray commands stay short:

- New Skrib;
- Show My Skribs;
- Find;
- Quick hide;
- Settings;
- Quit.

Reminder notification actions:

- Open thought;
- Return (when meaningful);
- Snooze;
- Dismiss.

## 12. Home / Ready

Home must not become a dashboard.

After onboarding, the default app window should be sparse:

- `Skribli is ready`;
- shortcut reminder;
- Find/search entry;
- a few recent/relevant thoughts if useful;
- Settings/Account access.

Education, announcements, privacy explanation, and trial detail progressively recede after first use.

## 13. Find / All Skribs

Functional shell, tactile reading.

- left side: precise search/index list;
- right side: selected Skrib rendered as a paper object/read view;
- Return is primary when saved context exists;
- Open Here is secondary;
- context/media/reminder/Past filters appear on demand;
- Import/Export leave the primary reading header and move to Data & Recovery.

## 14. Reminders / Past / Trash

### Reminders

Agenda-first.

`Coming back` shows upcoming resurfacing in chronological order. Month view is secondary.

### Past

Past/Archive is a retrieval filter, not a daily peer destination.

### Trash

Trash is a recovery/data view. Permanent deletion belongs only there with explicit confirmation.

## 15. Settings

Settings exists so low-frequency controls stop leaking into daily surfaces.

Recommended sections:

- General;
- Appearance;
- Context & Privacy;
- Reminders;
- Data & Recovery;
- Account;
- About.

The layout should be standard and predictable. Living Paper may appear as section tabs/bookmarks and content samples, but Settings itself must not become a notebook metaphor.

## 16. Context Inspector / Re-anchor

Healthy context stays a small place tab.

When invoked or degraded, an attached place inspector explains:

- application;
- saved human place label;
- scope/status;
- actions: Return, Open Here, Move, Detach, Re-anchor.

Candidate re-anchor results appear as individual paper slips attached to the note/place tab, not as a large modal card when avoidable.

Truth boundary remains explicit: current runtime does not guarantee exact closed URL/path/document-position/DOM restoration.

## 17. Recovery and read-only states

System failures use restrained typography and one attached recovery slip when the failure belongs to a specific Skrib.

Examples:

- `This edit still needs to save.` → Retry / Details;
- `This Skrib is read-only for now.` → content remains readable/exportable;
- `Saved place unavailable.` → Open Here / Start app / Re-anchor.

Storage/account/startup failures use normal system layout. Living Paper must not turn serious errors into playful stationery.

## 18. Accessibility and input

- no primary journey depends on hover;
- all reveal states are keyboard reachable;
- focus is visible without relying on colour alone;
- hit targets meet desktop accessibility expectations;
- 100/125/150% Windows scaling must be stress-tested;
- reduced-motion path is equivalent in meaning;
- screen-reader labels use action language (`Open here`, `Return to saved place`, `Hide My Skribs`) rather than metaphor-only names (`spine`, `slip`).

## 19. Acceptance matrix

Each major surface must be approved in:

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

Additional stress cases:

- 20k-character Skrib;
- 16 attachments;
- mixed image/PDF/video;
- large ink document;
- repeating reminder;
- actionable/checklist note;
- Here empty;
- large Rail result set;
- context unavailable;
- large local library;
- import/export failure.

## 20. Production migration order

1. Resting Skrib + capability gateway.
2. Heavy Skrib + attachments + Mark + Reminder + resize.
3. Paper Spine / Ribbon Rail.
4. Find / Reminders / Settings shell.
5. Context repair / Return journey.
6. Recovery/account/onboarding refinements.
7. Website alignment after the desktop interaction system is stable.

No production implementation should begin from screenshots alone. Each surface must have approved state, interaction, motion, keyboard, failure, and native-window behavior first.
