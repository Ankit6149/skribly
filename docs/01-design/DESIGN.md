---
name: Skribli - Soft Paper Play, curved card extension
description: Scoped desktop ticket and note-paper tokens inherited from Soft Paper Play.
colors:
  paper: "#fffdf7"
  ink: "#262923"
  muted: "#6d7069"
  olive: "#536a4f"
  panel: "rgb(248 247 242 / 82%)"
  panel-solid: "#f8f7f2"
  panel-ink: "#262923"
  panel-muted: "#52594e"
  panel-label: "#424242"
  panel-accent: "#4b643d"
  note-yellow: "#f9df5b"
  ink-yellow: "#171b18"
  note-peach: "#ffb792"
  ink-peach: "#171b18"
  note-mint: "#a9dfb6"
  ink-mint: "#171b18"
  note-sky: "#a8c7f4"
  ink-sky: "#171b18"
  note-lavender: "#c6acf0"
  ink-lavender: "#171b18"
  note-rose: "#f5a9bf"
  ink-rose: "#171b18"
  note-aqua: "#96ddd2"
  ink-aqua: "#171b18"
  note-sand: "#e6c18e"
  ink-sand: "#171b18"
  note-green: "#1cac43"
  ink-green: "#101b11"
  note-orange: "#fa6c2b"
  ink-orange: "#191910"
  note-lime: "#d8f64a"
  ink-lime: "#161c12"
  note-olive: "#96a75c"
  ink-olive: "#11180d"
  note-charcoal: "#292c25"
  ink-charcoal: "#edf4be"
  note-cobalt: "#637fea"
  ink-cobalt: "#111928"
  note-cream: "#e7e4b3"
  ink-cream: "#171b18"
  note-red: "#ee3033"
  ink-red: "#17100f"
  note-stone: "#d3d0bf"
  ink-stone: "#171b18"
  note-wine: "#8c2937"
  ink-wine: "#fff0d8"
  note-black: "#20211f"
  ink-black: "#e9ebd6"
  note-coral: "#ff836c"
  ink-coral: "#171b18"
  note-lemon: "#ffe750"
  ink-lemon: "#171b18"
  note-amber: "#ffbf53"
  ink-amber: "#171b18"
  note-apricot: "#ffb46b"
  ink-apricot: "#171b18"
  note-sage: "#bbcd80"
  ink-sage: "#171b18"
  note-teal: "#49c5ba"
  ink-teal: "#102321"
  note-turquoise: "#53dcd7"
  ink-turquoise: "#102321"
  note-azure: "#79b6f2"
  ink-azure: "#111b2a"
  note-periwinkle: "#a0a1f3"
  ink-periwinkle: "#17172c"
  note-orchid: "#d29be6"
  ink-orchid: "#211626"
  note-pink: "#ff95cf"
  ink-pink: "#211620"
  note-ruby: "#a52c51"
  ink-ruby: "#fff0d8"
  note-indigo: "#3c4192"
  ink-indigo: "#f4f1df"
typography:
  display:
    fontFamily: '"Manrope", "DM Sans", system-ui, sans-serif'
    fontSize: "clamp(16px, 1.4vw, 21px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: '"DM Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: '"DM Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
  label:
    fontFamily: '"DM Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.1
  handwriting:
    fontFamily: '"Kalam", "Segoe Print", "Bradley Hand", cursive'
    fontSize: "19px"
rounded:
  ticket: "20px 20px 44px 20px"
  paper: "14px 14px 20px 14px"
  pill: "999px"
  filter: "12px"
spacing:
  ticket-gap: "12px"
  narrow-ticket-gap: "8px"
  ticket-inset: "18px"
  narrow-ticket-inset: "14px"
  swatch-gap: "6px"
components:
  ticket:
    backgroundColor: "{colors.note-yellow}"
    textColor: "{colors.ink-yellow}"
    rounded: "{rounded.ticket}"
    padding: "{spacing.ticket-inset}"
    typography: "{typography.display}"
  put-away:
    backgroundColor: "{colors.ink-yellow}"
    textColor: "{colors.note-yellow}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  panel-search:
    textColor: "{colors.panel-ink}"
    height: "38px"
  application-filter:
    textColor: "{colors.panel-label}"
    rounded: "{rounded.filter}"
    padding: "8px 12px"
    height: "38px"
  palette-swatch:
    backgroundColor: "{colors.note-yellow}"
    textColor: "{colors.ink-yellow}"
    rounded: "{rounded.pill}"
    width: "28px"
    height: "28px"
  app-pill:
    backgroundColor: "var(--context-pill-paper)"
    textColor: "var(--context-pill-ink)"
    rounded: "{rounded.pill}"
    padding: "12px"
    width: "48px"
    height: "48px"
  editing-mode:
    rounded: "{rounded.pill}"
    padding: "2px"
---
# Design System: Skribli

## Overview

**Creative North Star: "Soft Paper Play"**

Soft Paper Play remains the incumbent product identity: warm paper, dark ink, quiet functional chrome and handwriting inside the note. The owner-selected ticket collection extends that world with stronger paper colours, smooth-sided cards with a bottom-right curve and a light frosted collection surface. It does not replace the light Home, library or contextual editing identity.

This snapshot records source implementation on 11 October 2026. Palette selections are durable across desktop note surfaces; curved card geometry and light material apply only to the expanded global collection. Browser evidence uses synthetic notes. Installed Windows acceptance and publication remain open.

**Key Characteristics:**

- Tactile note paper with explicit paired foregrounds.
- Crisp functional type; Kalam remains note content.
- Note-derived tonal cards inside the light collection; soft elevation for the editor.
- Application identity and captured context stay separate.

The canonical direction remains [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md). The surface contract and source verification live in [BRIEF.md](evidence/ticket-panel-2026-10-11/BRIEF.md) and [design-qa.md](evidence/ticket-panel-2026-10-11/design-qa.md). This file is intentionally under `docs/01-design` to keep the scoped documentation boundary; `.impeccable/design.json` extends its tokens. Source values take precedence when this snapshot becomes stale.

## Colors

### Primary

The warm note papers inherit the original eight colour IDs: yellow, peach, mint, sky, lavender, rose, aqua and sand. Their stronger saturation is the approved desktop extension. Creation continues rotating those eight; the picker offers the complete 32-name set in the frontmatter. Retain every existing ID. The additional colours extend note expression and are not category or status semantics.

### Secondary

The expanded global collection uses a light 82% off-white tint, dark interface ink and an olive focus accent. Reduced transparency restores solid #f8f7f2. Card washes, icon circles and app-filter fills derive from note papers rather than unrelated fixed accents.

### Neutral

Inherited warm paper, ink, muted text and olive remain the light interface vocabulary. Utility popovers inside dark notes restore the inherited light ink; note content and Done retain the selected paper/foreground pair.

**The Paired Paper Rule.** A `note-<id>` paper always uses the matching `ink-<id>` foreground. Palette-pair contrast checks require at least 4.5:1; they do not establish contrast for every mixed hover, popover or logo treatment.

## Typography

Display uses Manrope, functional labels use DM Sans with Windows system fallbacks, and writing uses Kalam with handwriting fallbacks. The frontmatter captures observed ticket, preview, context-title and action roles; it is not a replacement scale for every app screen.

Ticket titles use two lines of bold display type; previews use two lines of interface type, becoming one line in narrow layouts. The separate editor context title is one line with ellipsis. At the narrow ticket breakpoint, title and preview sizes become 17px and 13px. Handwritten note content remains distinct from control labels.

**The Functional Type Rule.** Use interface type for actions and context identity; reserve Kalam for note content and existing handwritten accents.

## Layout

The expanded global collection fills its available view. The reference viewport (1440px wide) uses six columns, with five at 1200px, four at 1000px, three at 760px and two at 520px. Its panel inset is 28px 32px 20px, becoming 16px at 760px. Equal-width rows derive their height from the container width and a .92 aspect ratio. Cards stay aligned, with vertical scrolling and no horizontal overflow.

Search and application filters remain available. At 520px search joins the normal flow and spans the available width. Empty and recovery messages span all columns. The palette popover uses eight 28px swatch columns and becomes seven at 360px; overflow scrolls within the bounded note. The contextual editor remains a compact separate surface.

## Elevation & Depth

Cards retain no shadow, hover lift or entrance animation. Their subtle 8% tonal wash blends toward white on papers with dark paired ink and toward black on the five dark-paper variants, preserving readable paired ink. The collection uses a light translucent material with 32px CSS blur, and an opaque fallback when reduced transparency is requested. Existing native Windows backdrop handling is retained; browser blur does not prove the installed compositor result. The contextual paper keeps its inherited soft shadow and subtle inset highlight.

**The Scoped Material Rule.** Frost belongs to the expanded global collection; notes retain their own paper and the editor keeps its soft elevation.

Exact shadows, blur, state treatments and breakpoints live in the sidecar because the frontmatter schema does not represent them.

## Shapes

Cards have smooth sides with no semicircle masks. Corners are 20px except the broader 44px bottom-right corner, which carries a 36px note-derived curve detail. The detail ignores pointer input and disappears in forced colours, where cards restore an explicit system-colour border.

Small actions keep pill outlines. Note and desktop card app identities share a 48px circle, 24px mark and 12px padding. Narrow cards use a proportional 40px circle / 20px mark / 10px padding. Card circles blend the note's colour into white; editor circles keep the approved random, light, distinct-hue selection.

## Components

### Ticket cards

Bold captured-context titles sit above readable note previews. Application identity sits at the bottom, beside small Open and Return affordances. Open reads the saved note here; Return remains a separate explicit action. The full-card read button uses an inset current-colour keyboard outline; Return uses its own focus indicator. Dark paper variants provide their own foregrounds and app-mark treatment.

### Search and application filters

Search uses a pale rounded field with an olive focus-within outline. App filters show a solid mark, readable app name and inline count in one aligned row. Normal, hover and selected fills derive from the first note in each app group, blended with the panel canvas. Narrow widths scroll horizontally; keyboard focus reveals offscreen filters. All marks use softer #424242 charcoal on their light surfaces.

### Note app pill and context title

The 48px circle carries a padded 24px application mark, with the full app name in accessible/hover detail. Its paper is randomly chosen from light shared-palette accents (relative luminance at least 0.45) when the note opens or its paper changes, excluding dark colours, similar hues, the note colour itself, and the previous pill colour. Known applications use solid bundled Supericons marks (Code, Chrome, Firefox and Explorer) ahead of Windows icons. Marks render in softer #424242 charcoal against the light colourful pill; full-colour vendor logos are not used. Generic application fallbacks use the solid Supericons document mark. Widget fallback monochrome logos are on by default; explicit saved appearance preferences and custom widget icons remain respected. A thin ink outline separates the circle on light paper. All 32 note colours have multiple distinct-hue choices; both the dark icon and paired ink exceed 4.5:1 contrast against the pill. Light-on-light paper separation uses hue and the outline, replacing the former 3:1 circle/paper rule to honour the light-pill preference. The colour stays stable while writing and is transient appearance, never saved note metadata. The adjacent title derives only from the captured window title: Code uses the available workspace segment; known browser/app suffixes are removed for display. Keep raw metadata for matching and Return. This is presentation, not filesystem lookup or browser-origin validation.

### Palette and editor tools

The bounded picker exposes all 32 named papers in Vivid (18) and Pastel (14) groups, with the vivid ticket-reference colours first. Editor, collection and library paper share the same selected base paper/foreground pair; collection cards add a subtle derived tonal wash. Swatches are 28px and use their paired foregrounds. Done reverses the selected paper/foreground pair. Type / Draw keeps the thin inherited interface pill; light utility popovers remain legible on dark notes. State, save barriers, attachment behavior and note lifecycle inherit the existing interaction contract.

## Do's and Don'ts

### Do:

- **Do** inherit Soft Paper Play outside the scoped collection.
- **Do** apply each note paper together with its paired foreground.
- **Do** keep 32 picker choices while preserving the original eight persisted IDs and eight-colour creation rotation.
- **Do** use captured context only for presentation; retain raw native matching and Return metadata.
- **Do** preserve visible keyboard focus and opaque/system-colour fallbacks.

### Don't:

- **Don't** apply the dark collection material to every product surface.
- **Don't** substitute pale universal text on light papers or dark universal text on dark papers.
- **Don't** turn a cleaned title into a URL, verified origin or reconstructed folder path.
- **Don't** infer Windows blur, focus, docking or mixed-DPI acceptance from browser screenshots.
