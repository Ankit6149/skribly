# Skribli Future Design Directions

**Date:** 2026-09-14  
**Baseline:** `v0.1.24` / `a3f5b3aedbc368bd46a768043fff9001f7e67b99`  
**Companion:** `FUTURE_EXPERIENCE_AUDIT_2026-09.md`

This document defines three genuinely different future experience directions for Skribli. They are not colour themes. Each one changes how the product reveals capability, occupies the desktop, represents context, and uses motion.

---

# 1. The three directions

## Direction A — Living Paper

### Thesis

**A thought feels like a small physical artefact that temporarily comes alive when touched.**

This is the strongest evolution of the existing Soft Paper Play identity.

### Visual language

- warm paper and ink;
- almost borderless resting surfaces;
- paper edges, slight asymmetry, torn/perforated/clipped media metaphors used sparingly;
- handwriting only for thought content or tiny human accents;
- functional controls remain crisp and modern;
- overlapping objects instead of grids where appropriate;
- shadows describe physical layering, not card elevation systems.

### Interaction language

- tools live under a paper edge / folded flap / tiny attached tray;
- attachments cluster like objects placed on a note;
- context appears as a small tab/label attached to the paper;
- completion can feel like stamping/folding a note into the past;
- Rail feels like a slim paper shelf rather than a sidebar.

### Motion

- gentle straighten/lift on hover;
- sheets slide/fan by a few pixels;
- tools unfold from the edge;
- re-anchor releases and settles the note;
- no bouncy cartoon physics.

### Risk

Can become scrapbook-like, childish, or visually noisy if every component gets a physical metaphor.

### Guardrail

**One tactile metaphor per object; precise invisible grid underneath everything.**

---

## Direction B — Quiet Ink

### Thesis

**Skribli is almost invisible software: editorial typography, ink, whitespace, and contextual commands.**

This is the most professional/minimal direction.

### Visual language

- warm off-white and ink, with pastel used mainly in actual Skribs;
- exceptional typography and spacing instead of containers;
- few borders;
- no dashboard cards;
- very small iconography;
- controls appear as text/icon commands in context;
- reading surfaces resemble a beautifully typeset notebook/editor rather than SaaS panels.

### Interaction language

- contextual command bubble on selection;
- one `+` gateway for non-text capabilities;
- keyboard/command search is first class;
- Rail collapses into a thin ink spine/index mark;
- app workspace is primarily search + reading, not navigation chrome.

### Motion

- direct opacity/position changes;
- ink underline/selection transitions;
- short shared-axis movement;
- almost no rotation or spring.

### Risk

Can become too austere or look like another tasteful text app, losing Skribli's physical personality.

### Guardrail

Keep tactile content objects and the strong contextual-place concept even when shell is minimal.

---

## Direction C — Context Thread

### Thesis

**The defining visual object is not the note—it is the relationship between a thought and a place.**

This is the most distinctive/future-facing direction.

### Visual language

- notes remain warm/paper-like, but shell uses thin contextual threads, nodes, anchors, and spatial transitions;
- app icons/places become nodes rather than tabs;
- colour is used to trace a thought's relationship to a context;
- navigation feels like following a thread rather than opening folders.

### Interaction language

- Rail is a vertical/edge context thread with app nodes and thought notches;
- selecting a node fans relevant thoughts into view;
- returning to context animates along the thread toward the target;
- context inspector is first-class and spatial;
- tool gateway can use a compact arc/radial fan around the pointer or note edge.

### Motion

- connected travel;
- lines shorten/extend as context changes;
- note moves toward context marker during return/re-anchor;
- state changes use path continuity.

### Risk

Can become conceptually clever but slower to learn, harder to implement accessibly, or visually over-designed.

### Guardrail

The thread is an orientation aid, never a mandatory navigation puzzle.

---

# 2. Recommended synthesis

The strongest long-term Skribli is probably **not one direction at 100%**.

Recommended blend:

- **Quiet Ink for the application shell and functional controls** — professional, low fatigue, scalable.
- **Living Paper for Skribs, media, reminders, and human content objects** — product identity and delight.
- **Context Thread for transitions, context confidence, Rail orientation, and re-anchor/return journeys** — differentiation.

Working name for the hybrid:

## **Quiet Paper / Living Context**

This gives Skribli personality without forcing every screen to be a scrapbook and gives context a visual identity without turning the product into a spatial experiment.

---

# 3. Surface-by-surface direction matrix

Every surface below has a proposed implementation in all three directions.

---

## 3.1 New / resting Skrib

### A — Living Paper
- warm paper sheet with one subtle attached context tab;
- no visible toolbar at rest;
- `+`/tool edge appears when pointer enters lower paper edge or keyboard focus requests tools;
- Done appears as a small dark-ink stamp/button at lower edge;
- drag region is the top paper margin, not a permanent dotted grip.

### B — Quiet Ink
- clean sheet with very little texture;
- app icon + place name in 10–11px functional type;
- writing starts immediately;
- one `+` command and one Done action;
- everything else lives in command bubble / overflow.

### C — Context Thread
- note has a tiny coloured anchor node at top-left connected to a short line ending at app icon/place;
- tool gateway is an arc that appears from lower-right edge;
- Done retracts the line into Rail presence.

### Recommended hybrid
Quiet Ink shell + Living Paper surface + tiny Context Thread anchor only when it adds orientation.

---

## 3.2 Reopened / heavy Skrib

### A
- content scrolls inside one large paper object;
- photo/document/reminder clusters appear physically placed, not in bordered sections;
- section boundaries use spacing/ink marks;
- sticky footer remains extremely small.

### B
- rich content becomes a clean vertical document flow;
- media clusters are compact inline blocks;
- a slim contextual inspector appears only when selected;
- no permanent section cards.

### C
- content types appear as nodes on a subtle internal thread/timeline in left gutter;
- selecting node focuses media/reminder/drawing region;
- useful for very loaded notes but optional in light notes.

### Recommended hybrid
A/B. Avoid the thread gutter until a note is genuinely complex.

---

## 3.3 Tool gateway

### A
- lower paper edge lifts to reveal **Add / Mark / Bring back**;
- small labels are visible during first uses, then icons can compact;
- appearance lives in overflow.

### B
- one `+` button opens a compact command flyout grouped by intent;
- keyboard shortcut opens searchable command list;
- selected text/object gets its own local commands.

### C
- small radial/arc palette from cursor or note corner;
- three large semantic wedges: Add, Mark, Bring back;
- second ring only after a category is chosen.

### Recommended hybrid
A visually, B behaviorally. Radial palette can be optional pointer/stylus enhancement later.

---

## 3.4 Rich-text formatting

### A
- text selection grows a small paper-label strip above selection;
- Bold / Italic / Highlight / list/heading;
- strip dissolves when selection clears.

### B
- minimal command bar flyout directly over selection;
- typography-first, no visual metaphor;
- keyboard shortcuts prominent.

### C
- formatting commands orbit selected text in a small arc; only for pointer/pen;
- keyboard gets linear alternative.

### Recommended hybrid
B. Rich-text controls should be the least decorative part of the note.

---

## 3.5 Drawing / Mark mode

### A
- thin tool roll attached to paper edge;
- pen/highlighter/eraser icons resemble real implements very subtly;
- selected tool unrolls its width/colour choices;
- palette fades to a tiny handle while drawing.

### B
- floating 36–40px command strip near one note edge;
- only selected tool properties visible;
- object selection replaces brush properties with move/delete/order actions.

### C
- compact arc palette around pen/cursor on invocation;
- object anchors/handles use context-thread geometry;
- excellent for stylus, harder for keyboard.

### Recommended hybrid
B structure with A tactile details.

---

## 3.6 Future shapes / arrows / pins / labels / checklists

### A
- each is a physical annotation object: pin, label slip, check paper, drawn arrow;
- tool palette categories keep them off resting note chrome.

### B
- objects are visually restrained with precise handles and accessible labels;
- one object inspector appears only when selected.

### C
- objects attach to context/thread nodes; pins can visually indicate anchor relationships;
- potentially strongest future differentiation for spatial annotations.

### Recommended hybrid
B interaction contract + A visual character. Use C only for actual context anchors, not every object.

---

## 3.7 Attachments — images

### A
- Polaroid/contact-sheet stack;
- 1 image = single print;
- many images = stacked/fanned cluster;
- hover/focus fans subtly; actions appear at cluster edge.

### B
- borderless image preview with a small caption line;
- multiples become a compact contact sheet;
- filename hidden until details/open.

### C
- images appear as small nodes hanging from a media thread, expanding outward when selected.

### Recommended hybrid
A. This is one of the strongest places to use tactile metaphor.

---

## 3.8 Attachments — documents

### A
- clipped/perforated paper slip with title first, file metadata second;
- multi-doc stack resembles a small packet.

### B
- editorial file citation: icon, title, two-line excerpt/metadata, no enclosing card;
- opens Quick Look-like preview.

### C
- document becomes a contextual source node connected to note.

### Recommended hybrid
A for compact note; B in Find/reading surface.

---

## 3.9 Attachments — video

### A
- framed visual still with tiny duration mark;
- play control appears stronger on hover/focus.

### B
- clean poster frame, no decorative border;
- play inline; controls only while playing.

### C
- motion thumbnail connected to media node; preview expands from node.

### Recommended hybrid
A/B.

---

## 3.10 Reminder quick-add

### A
- small dated slip peeks from note edge after `Bring back`;
- quick choices look like handwritten/date stamps without becoming buttons-in-boxes.

### B
- compact text command: Later today / Tomorrow / Choose…;
- summary appears as one inline line beneath content.

### C
- time node appears on a thread extending downward from the thought.

### Recommended hybrid
B interaction + A reminder object after saved.

---

## 3.11 Exact reminder scheduler

### A
- note expands into a planner sheet attached to the original paper;
- calendar dates float in open space, selected date looks stamped/marked;
- repeat summary is a paper footer.

### B
- clean two-column scheduling sheet: date field/calendar + natural-language summary;
- virtually no boxed day cells.

### C
- time is represented as a vertical timeline; calendar opens only for precise date selection;
- recurrence is a repeated thread pattern.

### Recommended hybrid
A/B. Avoid making a full productivity calendar inside the note.

---

## 3.12 Task / completion behavior

### A
- a Skrib becomes explicitly task-like only after adding a check/checklist;
- completion uses a physical stamp/check stroke and then gently folds into Past.

### B
- task status is a quiet property exposed only when task-like;
- `Complete` replaces Done as primary lifecycle action when appropriate.

### C
- task-like Skrib gets an endpoint node; completion closes the context thread and moves it to Past.

### Recommended hybrid
B semantic model + A completion motion.

---

## 3.13 Note colour / appearance

### A
- tiny paper swatch fan in note menu;
- selected swatch looks like small layered paper samples.

### B
- one row of eight clean swatches with accessible selected mark;
- appearance menu contains text size and default fit behavior.

### C
- context thread inherits a very subtle tint from note colour; colour chooser remains linear.

### Recommended hybrid
B with A swatch texture.

---

## 3.14 Manual resize

### A
- invisible native edge hit zones;
- a tiny curled lower corner appears only on pointer approach as the teaching cue;
- double-click curl = Fit;
- dragging feels like stretching paper but actual geometry stays precise.

### B
- native edge/corner resizing with no persistent visual handles;
- one small size indicator appears during drag;
- Compact / Medium / Large / Fit live in overflow/keyboard command.

### C
- resize is represented by two anchor nodes on diagonal edge when pointer nears boundary;
- dimensions can snap to meaningful work modes.

### Recommended hybrid
B mechanics + A lower-corner discoverability. Never show four permanent decorative handles.

---

## 3.15 Save state

### A
- tiny ink dot briefly wets/pulses while saving, then dries/disappears;
- failure becomes an attached red/peach paper tab.

### B
- `Saving…` appears only after threshold; `Saved` fades quickly;
- error line stays until resolved.

### C
- anchor/thread pulses while pending, breaks visibly only on failure.

### Recommended hybrid
B. A tiny tactile animation may add character if not distracting.

---

## 3.16 Delete / lifecycle menu

### A
- small folded-corner menu contains Move to Trash, appearance, context details;
- irreversible permanent delete never lives here.

### B
- ellipsis/secondary command menu;
- no Delete button in default footer.

### C
- long-press/context-node menu; spatially connected to note anchor.

### Recommended hybrid
B with a subtle A visual cue.

---

# 4. Widgets & desktop presence

## 4.1 Collapsed My Skribs presence

### A — Paper Shelf Tab
- a 28–34px edge tab that looks like two or three paper edges, not a 64px floating widget;
- count appears only on hover/attention or when multiple relevant thoughts exist;
- can tuck fully off-screen with a 4px edge cue.

### B — Ink Spine
- 3–5px edge line with a small notch;
- hover expands to icon + count;
- keyboard/tray can reveal Rail without any permanent visible tab.

### C — Context Node
- one small node on screen edge representing Skribli's context thread;
- nearby thought count appears as tiny ticks rather than badge.

### Recommended hybrid
B by default, A as optional branded presence. User must be able to auto-hide it completely.

---

## 4.2 Expanded Rail

### A — Shelf
- a narrow paper shelf slides from edge;
- thoughts appear as staggered slips/labels with readable titles;
- app/place group is shown as a small tab on shelf edge;
- one thought can expand slightly without becoming a card grid;
- Past is tucked behind a bottom divider/tab.

### B — Index
- 280–320px minimal text index;
- search at top, relevant thoughts first;
- no permanent Here/All/Archive + app switcher simultaneously;
- one quiet scope command and contextual grouping;
- row click = open here, small place arrow = return.

### C — Thread
- vertical line along edge with app nodes;
- selected app node fans its thought titles into a readable list;
- current context node glows subtly;
- Return action animates along line.

### Recommended hybrid
B information hierarchy with C context orientation and A tactile note markers.

---

## 4.3 Rail search

### A
- search field unfolds from shelf header only when requested.

### B
- `/` or typing while Rail focused opens prominent search; recent/relevant results replace groups.

### C
- search becomes a thread-wide command palette; results show context path visually.

### Recommended hybrid
B.

---

## 4.4 Rail Archive/Past

### A
- small tucked "Past" paper tab at bottom.

### B
- filter command or search scope; not equal primary tab.

### C
- faded lower segment of context thread; user scrolls/commands into it.

### Recommended hybrid
B/A.

---

## 4.5 Tray menu

### A
- standard Windows menu with small paper mark only; do not over-style system UI.

### B
- pure native minimal menu.

### C
- same as B; spatial experimentation does not belong in tray.

### Recommended hybrid
Native/boring. Tray is infrastructure.

---

## 4.6 Reminder notification

### A
- Windows notification content uses note colour thumbnail/mark and thought excerpt.

### B
- very clean title + place + Open/Snooze/Dismiss.

### C
- copy uses "Return to [place]" when context is available, reinforcing relationship.

### Recommended hybrid
B/C copy, native shell.

---

# 5. App Screens

## 5.1 Home / ready surface

### A — Desk Note
- no dashboard grid;
- one large paper-like status sheet says Skribli is ready, shows shortcut, and a few handwritten recent-context hints;
- Find/Settings are small edge links.

### B — Quiet Launch
- mostly empty window;
- brand, readiness, shortcut, universal search field;
- recent 3 thoughts below as text;
- Settings/account in footer;
- no cards.

### C — Context Map
- lightweight map of recently used application contexts with tiny thought counts;
- user can click a context to see thoughts;
- shortcut remains primary.

### Recommended hybrid
B. Home should be calm, not a showcase. A tactile accent can carry brand.

---

## 5.2 Main app navigation

### A
- paper bookmarks along left edge: Find, Reminders, Settings only;
- lifecycle filters live inside Find.

### B
- minimal adaptive navigation: Find, Reminders, Settings; labels collapse when narrow;
- Account/About in footer.

### C
- top context strip + command search; navigation is primarily command/search driven.

### Recommended hybrid
B, with only 3 top-level areas.

---

## 5.3 Find / All Skribs

### A — Archive Desk
- search sits on top like an index card;
- result list resembles paper index entries without full card borders;
- selected note opens as a large paper sheet on right;
- media appears physically.

### B — Reading Index
- strong search;
- left result index, right reading pane;
- typography/whitespace dominate;
- lifecycle/context filters in a compact filter drawer;
- no top Import/Export actions.

### C — Context Explorer
- left context/app thread, middle matching thoughts, right selected thought;
- strongest for research-heavy users but more complex.

### Recommended hybrid
B default; optional C context lens/filter for power users.

---

## 5.4 Search result row

### A
- coloured paper edge + title + one-line place label;
- hover lifts edge slightly.

### B
- plain text row with title, excerpt, place, modified time;
- subtle active ink bar.

### C
- node + short context path line + title.

### Recommended hybrid
B with A colour edge.

---

## 5.5 Selected note reading surface

### A
- full paper sheet, media arranged as objects, reminder slip, context tab.

### B
- beautiful reading document with media inline and small metadata rail.

### C
- note plus side context thread showing origin/time/reminders.

### Recommended hybrid
B shell + A content objects + optional C context inspector.

---

## 5.6 Calendar / reminder lens

### A — Planner Sheet
- month appears as open paper with unboxed dates;
- days with reminders get tiny ink dots/stamps;
- agenda slips sit beside it.

### B — Agenda First
- upcoming agenda is dominant;
- month is a compact secondary navigator;
- useful even with only two reminders.

### C — Time Thread
- chronological vertical timeline of thoughts returning;
- month calendar opens as a chooser, not the main surface.

### Recommended hybrid
B/C. For Skribli, agenda/time thread is more aligned than a conventional calendar grid.

---

## 5.7 Archive / Past

### A
- faded paper stack labeled Past inside Find.

### B
- lifecycle filter `Past`; search continues to work normally.

### C
- past segment on context timeline.

### Recommended hybrid
B. Do not make Archive a major app page.

---

## 5.8 Trash

### A
- paper bin metaphor only as tiny illustration; rows remain readable.

### B
- Settings/Data or Find filter; simple retention label; Restore primary, permanent delete secondary/destructive.

### C
- no spatial metaphor needed.

### Recommended hybrid
B.

---

## 5.9 Import

### A
- file appears as a paper packet; preview shows what will be added/replaced/skipped like stamped labels.

### B
- step flow: Choose → Preview → Resolve → Apply; clean diff list.

### C
- context thread can show where imported notes will attach only if context data exists.

### Recommended hybrid
B with A visual affordances.

---

## 5.10 Export / backup

### A
- export bundle represented as a tied/stacked paper packet, but copy remains explicit about what is included.

### B
- Settings → Data flow with exact scope and destination; no decorative ambiguity.

### C
- context relationship summary can appear in export preview.

### Recommended hybrid
B.

---

## 5.11 Settings

### A — Preferences Notebook
- one continuous preferences sheet with paper bookmark sections;
- controls are clean/native, not cards.

### B — Preferences Document
- left minimal category index + scrolling document sections;
- General / Appearance / Context & Privacy / Reminders / Data & Recovery / Account / About;
- almost no containers.

### C — Capability Map
- settings grouped around what Skribli can see/do: Presence, Context, Time, Data, Account;
- visually distinctive but may be too conceptual.

### Recommended hybrid
B.

---

## 5.12 Account / trial

### A
- warm welcome sheet + simple account form card; local-first promise as a small attached note.

### B
- professional split layout for setup, then account moves entirely to Settings.

### C
- device/account relationship shown as two connected nodes during setup only.

### Recommended hybrid
B with one tactile local-first object.

---

## 5.13 Onboarding

### A
- three physical steps: app/window → little note → Rail edge; each animates as paper continuity.

### B
- one instruction per screen, large shortcut, real practice task; coach marks after success.

### C
- guided context thread visually connects focused app → note → Rail.

### Recommended hybrid
B interaction + C connected demonstration.

---

## 5.14 What's new / update state

### A
- occasional folded release note appears once, then disappears into About.

### B
- small non-blocking update line in Home/Settings; release notes page on demand.

### C
- no special spatial treatment.

### Recommended hybrid
B/A accent. Never a permanent feed.

---

# 6. Context and trust surfaces

## 6.1 Context marker on note

### A
- small physical tab attached to top edge with app mark/place.

### B
- one icon + human place label; full detail in inspector.

### C
- visible anchor node + short context thread.

### Recommended hybrid
A/B at rest, C only for degraded/active context operations.

---

## 6.2 Context inspector

### A
- small attached place card unfolds from context tab.

### B
- side popover/sheet: Current place, confidence, stored match information, Move/Re-anchor/Detach.

### C
- mini spatial diagram showing note node and app/window node; drag/re-anchor candidates can be selected.

### Recommended hybrid
B with C diagram when context is ambiguous.

---

## 6.3 Ambiguous context chooser

### A
- candidate windows appear as labelled paper slips; selected one gets pin mark.

### B
- simple list of candidate app/window names with confidence descriptions; no numeric percentages unless diagnostic.

### C
- candidates appear as nodes around current thought, user picks where thread should connect.

### Recommended hybrid
B/C.

---

## 6.4 Re-anchor / move

### A
- note visually lifts from old place tab and settles on new one.

### B
- choose new context, confirm stored scope, done; motion is short shared-axis transition.

### C
- strongest: old thread releases, new candidate thread highlights, user confirms, thread reconnects.

### Recommended hybrid
C motion on top of B interaction steps.

---

## 6.5 Missing saved context

### A
- context tab looks gently detached; attached recovery slip offers Open here / Start app / Re-anchor.

### B
- concise inline state with three actions; no error modal.

### C
- broken thread endpoint communicates place unavailable, then shows replacement nodes.

### Recommended hybrid
B/C.

---

## 6.6 Opening / return journey

### A
- note thumbnail slides toward app icon/place; if fallback occurs, it settles at app-level tab.

### B
- small progress surface with human phases and no spinner-heavy modal.

### C
- literal thread travel is the defining animation; path terminates at exact window or app-home fallback.

### Recommended hybrid
C motion + B copy.

---

# 7. Recovery and exceptional states

## 7.1 Save failure

### A
- small peach/red paper tab attached directly to note, never detached toast.

### B
- inline bottom strip: "This edit still needs to save" + Retry/Details.

### C
- thread/state node breaks only if context/save operation actually failed.

### Recommended hybrid
B with subtle A shape.

---

## 7.2 Storage read-only

### A
- note becomes slightly desaturated paper and editing edge folds closed; readable content remains normal.

### B
- clear read-only banner only once + lock indicator; Data & Recovery has detail.

### C
- no special spatial treatment.

### Recommended hybrid
B.

---

## 7.3 Startup failure

### A
- one large paper recovery sheet, minimal.

### B
- clean system-like recovery page: Retry, Open data location, Diagnostics.

### C
- not a place for conceptual design.

### Recommended hybrid
B.

---

## 7.4 Account/entitlement failure

### A
- local notes remain visually normal; account problem appears in a separate account slip.

### B
- focused account recovery surface; clearly states local data unaffected.

### C
- account/device nodes can explain relationship during trial issues, but only if genuinely helpful.

### Recommended hybrid
B.

---

# 8. Micro-component directions

## Buttons
- **A:** ink labels / small paper-edge actions; filled dark button only for one dominant action.
- **B:** minimal text/icon controls with precise focus/hover states.
- **C:** node/arc actions only in spatial surfaces; standard buttons elsewhere.

## Tabs
- **A:** bookmark tabs only when modes are truly peers.
- **B:** thin text tabs/segmented commands sparingly.
- **C:** nodes for contexts, not for generic page navigation.

## Search
- **A:** index-card feel, expands on demand.
- **B:** large command/search line with keyboard-first behavior.
- **C:** search results include contextual path visualization.

## Tooltip
- **A:** tiny paper label.
- **B:** standard unobtrusive tooltip.
- **C:** standard tooltip; spatial UI must still have explicit accessible names.

## Popover / flyout
- **A:** attached flap/sheet.
- **B:** clean floating command sheet.
- **C:** arc only for short tool sets; linear alternative always exists.

## Count badge
- **A:** stamped count only when useful.
- **B:** muted number in text, usually hidden at rest.
- **C:** ticks/nodes for contextual quantity; never cryptic for large counts.

## Empty state
- **A:** one small paper illustration/object + sentence.
- **B:** typography and whitespace; one action.
- **C:** empty thread only where context itself is the message.

## Loading
- **A:** tiny ink stroke / page-settle motion.
- **B:** preserve geometry, subtle progress text/skeleton.
- **C:** path progress for return-to-context only.

## Focus
- **A:** dark/olive hand-drawn-looking outline but geometrically precise.
- **B:** crisp 2px ink/olive focus ring.
- **C:** node glow plus standard ring; never glow only.

## Scrollbars
- **A:** paper/olive thumb, nearly invisible until hover.
- **B:** native/minimal.
- **C:** same as B.

---

# 9. Animation grammar by direction

| Meaning | Living Paper | Quiet Ink | Context Thread |
|---|---|---|---|
| Hover | 1–2px lift / straighten | contrast + 1px translate | node/line emphasis |
| Tool reveal | edge unfolds | command bubble fades/slides | arc fans open |
| Attachment open | stack fans then zooms | preview expands directly | node expands along line |
| Reminder open | scheduler sheet slides from note | note expands/shared-axis | time branch extends |
| Done | paper settles/hides into Rail | quick fade/scale toward Rail | thread retracts to Rail node |
| Complete | check/stamp then folds into Past | state crossfade + move | endpoint closes and moves down thread |
| Return | paper mini travels toward app | small progress + app focus | explicit path travel |
| Re-anchor | release/settle | chooser + connected transition | disconnect/reconnect thread |
| Error | attached tab | inline status | broken node only when spatially relevant |

---

# 10. Surface recommendation summary

| Surface | Recommended base |
|---|---|
| Resting Skrib | Hybrid A+B |
| Heavy Skrib | B shell + A objects |
| Tool gateway | A reveal + B commands |
| Rich text | B |
| Drawing | B structure + A character |
| Future annotations | B contract + A objects |
| Images | A |
| Documents | A/B |
| Video | A/B |
| Reminder quick-add | B + A result object |
| Scheduler | A/B |
| Task completion | B semantics + A motion |
| Resize | B mechanics + A discovery cue |
| Save/recovery | B |
| Rail launcher | B default / A optional |
| Expanded Rail | B hierarchy + C context |
| Rail search | B |
| Home | B |
| App navigation | B |
| Find | B + A content objects |
| Calendar | B/C |
| Archive/Past | B |
| Trash | B |
| Import/export | B |
| Settings | B |
| Account | B + A local-first accent |
| Onboarding | B + C motion |
| Context marker | A/B |
| Context inspector | B + C diagram |
| Re-anchor | B flow + C motion |
| Return journey | C motion + B messaging |
| Exceptional states | B |

---

# 11. The direction I would prototype first

## **Hybrid H1 — Quiet Paper / Living Context**

### Resting note

- warm tactile paper;
- app/place tab;
- content;
- one `+` gateway;
- one Done action;
- no permanent Delete / Complete / Text Size / Note Size / Colour / Draw / Reminder button row.

### Tool interaction

`+` reveals **Add · Mark · Bring back**.

- Add → Photo / File / Video / Checklist/Label later
- Mark → Pen / Highlight / Arrow / Shape / Pin later
- Bring back → quick reminder choices / exact schedule

Text formatting appears only on text selection. Appearance and lifecycle live in a quiet `…` menu.

### Rail

- default resting presence is a very thin edge spine and can auto-hide fully;
- expand into a clean searchable index;
- current-context thoughts appear first automatically;
- app/context filter is one secondary control, not a permanent second tab row;
- row click opens here;
- context arrow returns there;
- Past is secondary.

### App window

Three top-level destinations only:

1. **Find**
2. **Reminders**
3. **Settings**

Home can become a transient ready view rather than a permanent dashboard destination.

### Find

- search first;
- readable results;
- selected thought reading pane;
- context/media/reminder/lifecycle filters on demand;
- import/export/trash leave primary navigation.

### Context

Normal confidence is invisible. Only degraded context adds a visible state. Re-anchor is an intentional inspector workflow with connected thread motion.

### Emotional target

> The UI feels almost absent until the user reaches for it. When it appears, it feels crafted rather than generic.

---

# 12. What not to do in any direction

- Do not create a permanent toolbar containing every future capability.
- Do not turn each section into a rounded card.
- Do not keep Home/Notes/Calendar/Archive/Trash as five equally important app pages.
- Do not make every note a task.
- Do not make every reminder a task.
- Do not expose context-confidence machinery when the match is healthy.
- Do not require hover to discover primary behavior.
- Do not let the Rail become a second note library.
- Do not make the Rail impossible to hide.
- Do not use motion as decoration.
- Do not imitate Notion/Linear/ClickUp information architecture simply because they are polished.
- Do not use tactile metaphors on every control.
- Do not make functional typography handwritten.
- Do not let rich content break note size or monitor boundaries.
- Do not move technical storage/account terminology into the capture experience.

---

# 13. Next design gate

Before production refactoring, prototype these same stress cases in all three directions:

1. empty note;
2. heavy note with text + rich text + drawing + 8 attachments + reminder;
3. explicit task/checklist note;
4. min-size note;
5. exact reminder scheduler;
6. Rail with 1 / 10 / 40 notes across many contexts;
7. missing saved context;
8. Find with 1,000+ notes;
9. Reminder agenda with sparse and dense data;
10. Settings Data & Recovery;
11. read-only / expired / save-failure state;
12. 100 / 125 / 150% scaling;
13. keyboard-only and reduced-motion variants.

Only after these survive stress should the visual direction be considered approved.
