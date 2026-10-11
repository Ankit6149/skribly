# Selected design direction: Soft Paper Play

![Direction 1 — Soft Paper Play](../../assets/design/direction-1-soft-paper-play.webp)

## Intent

Skribli should feel tactile, warm, immediate, and lightweight—like physical paper translated carefully into a digital environment. It must remain playful without becoming childish or visually noisy.

## Visual characteristics

- warm paper/off-white base
- pale yellow as the default sticky color
- peach, mint, sky, and lavender alternatives
- dark ink rather than pure black
- soft elevation shadows
- small asymmetry and folded corners
- handwritten accents only where they add humanity
- crisp system typography for functional controls
- minimal chrome when a Skrib is inactive

## Motion

Current product motion is brief, functional, and reduced or removed when Windows requests reduced motion:

- compact surfaces appear without a long entrance sequence;
- button, selection, confirmation, loading, and save-state feedback remains subtle;
- All Skribs, Trash, onboarding, and import transitions remain restrained while the active collapsed Skrib uses one quiet pastel dot;
- no idle looping animations.

Collapse/restore and the drawing workspace use only short functional state changes. Peel/unfold, persistent-note hover animation, richer anchor-placement motion, and gesture choreography remain deferred research.

## Design constraints

- Never cover underlying content unnecessarily.
- The transient compact editor uses only its visible window bounds; there is no interactive full-screen overlay.
- Closing the editor durably saves and returns the Skrib to one movable My Skribs rail; completing a task moves it into recoverable Archive.
- The current single-window runtime shows one active editor and one rail, not an unlimited desktop widget layer.
- The blank folded-note mark keeps the warm paper/yellow/ink palette, uses soft rounded corners, and contains no letterform.
- Notes must remain readable at different DPI scales.
- Keyboard focus, forced colours, reduced motion, and larger text must remain legible without changing the brand language.
- Dark mode may be added later; the approved initial direction is light Soft Paper Play.


## Approved scoped extension ? 11 October 2026

The expanded global collection now uses the owner-selected saturated ticket treatment: rounded tickets with semicircular side cutouts over a dark frosted view, bold captured-context titles, readable note previews and actual application marks. This extends Soft Paper Play on that surface; the light Home/library and compact contextual-note identity remain inherited. Full-view collection expansion does not authorize persistent full-screen annotations or a desktop-sized writing overlay.

Desktop note paper now has 32 named picker choices with paired foregrounds. The original eight persisted IDs remain valid and gain stronger saturation; creation still rotates those eight. The contextual editor has a 48px app pill with a 32px app image and a separate display title derived from captured context. Raw native titles remain unchanged for matching and Return.

The token-bearing [DESIGN.md](DESIGN.md) and [Impeccable sidecar](../../.impeccable/design.json) record this scoped extension. The [surface brief](evidence/ticket-panel-2026-10-11/BRIEF.md), [source QA](evidence/ticket-panel-2026-10-11/design-qa.md) and [documentation record](evidence/ticket-panel-2026-10-11/DOCUMENTATION.md) preserve its evidence and open acceptance boundary. Browser screenshots are source previews with synthetic data; Windows compositor, monitor coverage, focus, docking and mixed-DPI acceptance remain pending.
