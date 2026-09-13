# Skribli Future Design Directions — Decision Guide

Date: 2026-09-14  
Repository baseline: `a3f5b3aedbc368bd46a768043fff9001f7e67b99` (`v0.1.24`)  
Companion to: `FUTURE_DESIGN_DIRECTIONS_2026-09.md` and `/interface-directions`

This guide explains **how to judge** the three visual/interaction systems. They are not themes or colourways.

## 1. The three systems

### A — Living Paper

Use physical familiarity to make digital content feel immediately legible:

- a Skrib feels like a note;
- an image feels like a photograph;
- a document feels like paper;
- a reminder feels like a dated slip;
- a collapsed object can feel folded/tucked rather than like another app button.

**Strengths:** recognisable, warm, tactile, memorable, strong product identity.  
**Risks:** scrapbook effect, novelty, excess rotation/tape/shadows, imprecision around dense controls.

Living Paper is strongest **inside user content**, not as the universal shell language.

### B — Quiet Ink

Use typography, whitespace, focus, lines and restrained direct controls before containers.

**Strengths:** professional, scalable, low-fatigue, accessible, good at dense information and recovery.  
**Risks:** can become generic, sterile or visually interchangeable with another modern note app.

Quiet Ink is strongest for **functional structure**.

### C — Context Thread

Visualize meaningful relationships between a thought and its place/time.

**Strengths:** uniquely aligned with Skribli's contextual value; excellent for Return/re-anchor/time continuity.  
**Risks:** abstract diagrams, mystery nodes, visual over-intellectualization, accidental replacement of normal navigation.

Context Thread should appear only when a real relationship benefits from being shown.

## 2. Recommended fourth direction

### Quiet Paper / Living Context

Do not select A, B or C globally.

Use:

- **Quiet Ink** for shell/navigation/search/Settings/recovery/account;
- **Living Paper** for the Skrib/media/reminder object/material identity;
- **Context Thread** for Return/re-anchor/degraded context/time continuity.

This avoids both extremes:

- a corporate/generic utility with no personality;
- a highly tactile scrapbook that becomes tiring during professional use.

## 3. Global interaction rules

### At rest

Show only what supports the user's current job. The resting note is the hardest acceptance test because every unnecessary control is visible repeatedly.

### On intent

Reveal capability after a meaningful action:

- `+` / Add;
- text selection;
- Mark mode;
- Bring back;
- pointer proximity for resize;
- explicit context inspection;
- search/filter request.

Hover can enrich, but must never be the only path to an essential action.

### Motion

- 100–160ms acknowledgement;
- 180–280ms object reveal/rearrangement;
- 300–450ms meaningful transformation;
- no looping ambience on persistent desktop surfaces;
- reduced-motion mode preserves causality through focus/state changes instead of travel.

### Failure

Use Quiet Ink by default. Failure surfaces are trust surfaces, not delight surfaces.

## 4. Surface-by-surface direction decisions

### 01. Resting Skrib

**A:** strongest identity. Context tab + tactile paper note.  
**B:** strongest hierarchy. Nearly blank with readable context.  
**C:** useful as a very subtle context anchor only.

**Recommended:** A content object inside B's restraint, with C only during Return/re-anchor.

**Must test:** new, reopened, detached/open-here, saving, failed, read-only, keyboard focus.

### 02. Heavy Skrib

**A:** excellent recognisable object clusters for photos/documents/reminder.  
**B:** strongest scan/read behavior under real density.  
**C:** useful only when relationships between rich objects genuinely matter.

**Recommended:** A objects inside B reading flow.

**Must test:** long text, mixed attachments, large drawing, recurring reminder, compact width, large width, max attachment state.

### 03. Tool gateway

Future capability must not become a ribbon.

Semantic groups:

- **Add** — photo/file/video/checklist/label as appropriate;
- **Mark** — pen/highlight/eraser/arrow/shape/pin;
- **Bring back** — quick reminder/exact date/repeat.

Text formatting appears from text selection. Appearance/lifecycle remains secondary.

**A:** best visual reveal.  
**B:** best mechanics/accessibility.  
**C:** can orient nested branches but must retain normal text labels.

**Recommended:** B interaction mechanics with a restrained A reveal.

### 04. Attachments

**A:** best inside Skrib: photographs, clipped document, visual video frame.  
**B:** best in Find/Library where metadata/scanning matters.  
**C:** reserve for ordered/relational media cases.

Never make “Open” or “Remove” hover-only.

**Must test:** saving, unsupported format, too large, capacity reached, remove confirmation, missing local file/recovery.

### 05. Drawing / structured marks

**A:** expressive tool roll works well with pen/stylus.  
**B:** strongest contextual property model.  
**C:** can inspire selection/anchor visuals but should not redefine transform handles.

**Recommended:** B behavior + A canvas character.

Selection changes properties rather than adding controls. Escape returns to thought mode.

### 06. Reminder / task

**Reminder** means resurface.  
**Task** means intentionally completable.

**A:** best exact-scheduler physicality.  
**B:** clearest semantics and field structure.  
**C:** strongest recurrence/time continuity accent.

**Recommended:** B semantics + A reminder object + C time continuity only where useful.

### 07. Manual resize

Keep native free resize.

**A:** paper-corner cue is a good first-use teaching affordance.  
**B:** invisible native edges are best for long-term professional use.  
**C:** context should not redefine standard resize mechanics.

**Recommended:** B mechanics + A subtle cue.

Meaningful commands should be `Fit`, `Work size`, possibly `Reset`; Compact/Medium/Large may remain implementation presets but should not necessarily be the user's mental model.

### 08. Collapsed Rail presence

**A:** memorable but potentially persistent-object fatigue.  
**B:** 3–5px Ink Spine / full auto-hide is lowest-friction.  
**C:** context node is interesting only if contextual relevance is highly reliable.

**Recommended:** B default with subtle A/C reveal character.

The presence contract must include Visible, Auto-hide, Hidden-until-restore, and Quick hide.

### 09. Expanded Rail

**A:** tactile shelf can humanize rows.  
**B:** Readable Index is strongest information hierarchy.  
**C:** excellent orientation accent for Return.

**Recommended:** B shell + very restrained A row identity + C Return continuity.

Default should prioritize relevant thoughts. Search, Everything and Past should not create two permanent navigation rows.

### 10. Tray / notification

Stay native/conventional.

**A:** a small note mark is enough personality.  
**B:** recommended overall.  
**C:** use “Return” context language only when the notification references a saved place.

Do not build custom fake Windows chrome.

### 11. Home / Ready

**A:** strong branded onboarding/first-run moment.  
**B:** best mature/default state: Ready + shortcut + universal Find + recent context.  
**C:** optional recent-context lens.

**Recommended:** B after onboarding; A can inform first-use delight.

Do not reintroduce dashboard status cards after the mental model is learned.

### 12. Find / All Skribs

**A:** tactile reading pane.  
**B:** strongest default reading/search architecture.  
**C:** optional context-explorer lens for users who think by app/place.

**Recommended:** B shell + A content rendering + optional C context filter/lens.

Import/export/recovery leave the primary reading header.

### 13. Calendar / reminders / Past

**A:** useful marked-date month view.  
**B:** Agenda-first is strongest daily answer to “what is coming back?”  
**C:** temporal thread can accent continuity.

**Recommended:** B default, A month chooser, C optional continuity.

Past and Trash are lifecycle/recovery filters rather than daily reminder peers.

### 14. Settings

**B** should dominate. Settings is where predictability matters more than metaphor.

Use normal sections:

- General;
- Appearance;
- Context & Privacy;
- Reminders;
- Data & Recovery;
- Account;
- About.

A may influence bookmarks/section accents. C may enrich Context & Privacy only.

### 15. Context inspector / re-anchor / Return

This is the strongest C surface.

**A:** place tab and attached sheet work well at the note level.  
**B:** explicit inspector is the accessible semantic base.  
**C:** reconnect motion communicates relationship change better than any other surface.

**Recommended:** B controls + C motion + A place-tab identity.

Truth boundary is mandatory: never imply exact deep restoration when unavailable.

### 16. Recovery

**B** is the default.

A is acceptable for note-local recovery only. C is appropriate only for actual context-relationship failure.

Recovery must distinguish:

- content unsafe / save failure;
- storage read-only/recovery;
- account entitlement;
- context unavailable;
- startup/configuration failure.

Never collapse them into one generic red card.

### 17. Micro-components

This is where the anti-boxy rule becomes real.

**A:** tactile accents only for content objects.  
**B:** everyday functional primitives: text action, icon action, baseline search, segmented control, toggle, focus ring, tooltip, divider.  
**C:** nodes/anchors only when there is a real relationship.

Rule: **cards are earned, not default**.

## 5. Motion-by-surface map

- Skrib rest → almost no motion;
- attachment stack → fan/reveal 180–240ms;
- tool gateway → reveal 160–220ms;
- reminder workspace → note expansion 280–380ms;
- Drawing workspace → expansion 280–380ms;
- Rail reveal → 180–260ms;
- Return/re-anchor → 300–450ms because spatial meaning is changing;
- Calendar selection → 100–160ms acknowledgement, not bouncing tiles;
- recovery/error → minimal/no travel.

## 6. Visual hierarchy contract

### Content colours

Pastels belong primarily to Skribs and content objects.

### Shell colours

Application shell should use paper/off-white, ink, muted neutrals and very restrained olive/blue contextual accents.

### Shape language

Avoid a universal “rounded rectangle around everything” system. Use:

- typography + whitespace for sections;
- lines/dividers for scanning;
- pills only for true compact states/filters;
- tactile asymmetric shapes only for content objects;
- circles only where an icon/control genuinely benefits from compact hit area.

## 7. Accessibility contract

Every final direction must support:

- visible keyboard focus;
- logical tab order;
- no hover-only essential control;
- readable targets at 100/125/150% DPI;
- reduced motion;
- semantic text labels for spatial/context icons;
- color-independent state meaning;
- screen-reader announcements for save/opening/recovery state;
- explicit confirmation for destructive actions.

## 8. Stress-test matrix before approval

Do not approve a surface from its prettiest empty state. Test:

- 20k-character note;
- 16 mixed attachments;
- long app/window titles;
- empty and no-result Rail;
- large library;
- many reminders in one day;
- overdue + recurring reminder;
- save failure while rich content is pending;
- read-only trial/storage state;
- context unavailable during Return;
- keyboard-only navigation;
- reduced motion;
- 100/125/150% scale;
- minimum/maximum manual note size.

## 9. Decision rule

When choosing between two attractive designs, prefer the one that:

1. exposes less at rest;
2. preserves the user's place in their real work;
3. requires less note/library maintenance;
4. states uncertainty truthfully;
5. still works under heavy content and failure states;
6. leaves room for future capability without another toolbar or navigation layer.

The goal is not “a beautiful notes app.” The goal is a contextual memory layer that feels almost absent until the user needs it—and unmistakably Skribli when it appears.