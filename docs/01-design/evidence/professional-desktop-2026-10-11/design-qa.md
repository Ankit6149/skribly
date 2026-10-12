# Professional desktop refinement - 11 October 2026

Result: **passed for the bounded source/browser UI pass**. Installed Windows material and runtime acceptance remain open.

Visual authority: the three owner-supplied phone references in this conversation (736x736 self-care, 1200x900 English learning and approximately 375x667 health tips). The task adapts their calm light canvas, readable headings, generous spacing and pastel surfaces to Skribli desktop; it does not clone their health content or phone frames. The later owner requests supersede the earlier ticket reference's side cuts and black marks. [BRIEF.md](BRIEF.md) records the final scope.

Implemented: light frosted collection material and opaque reduced-transparency fallback; cleaner Ready spacing/type/navigation; smooth card sides with a broader bottom-right curve; subtle note-derived washes; padded solid Supericons; soft #424242 marks; light icon circles; aligned app-name/count tabs with note-derived tints. The exact 32 base papers and foregrounds, title metadata, full-card Open, separate Return, Archive, search and native rail lifecycle remain intact. No new capabilities, release claims or phone UI were added.

Evidence captures (actual PNG dimensions, not inferred from the requested viewport):

| Capture | PNG size | Check |
| --- | --- | --- |
| [panel-desktop.png](panel-desktop.png) | 1536x639 | Six aligned columns, no side cuts, visible corner detail, app-name tabs and consistent padded marks. This capture precedes the final inline-count visibility fix; final counts are shown in the narrow capture and verified in current DOM. Remaining cards scroll vertically. |
| [panel-narrow.png](panel-narrow.png) | 390x843 | Two columns, normal-flow search, scrollable app filters, separated card text and icon/actions. Logical viewport was 390x844. |
| [workspace-desktop.png](workspace-desktop.png) | 1536x639 | Ready hierarchy, quiet sidebar, shortcut group, mint status area and styled Check again. |
| [workspace-narrow.png](workspace-narrow.png) | 640x800 | Ready and status stack without horizontal overflow. |
| [solid-note-icon.png](solid-note-icon.png) | 1536x639 | Actual composer: 48px circle, 24px solid Code mark, 12px padding, soft-charcoal filter, captured Database title. |

Browser comparison inspected overall composition and focused icon/card/control details against the supplied references. Panel cards measured approximately 233.3x253.6 at desktop and 169x183.9 at narrow width, with `mask:none` and a 44px bottom-right radius. DOM checks found no horizontal page overflow. The narrow app strip intentionally scrolls; selecting offscreen Code by keyboard-capable button reveals it. Selected count badges now participate in normal layout rather than overlapping their labels.

Interactions verified: workspace Find opens the panel fixture; Code filter has four notes; Database search produces one result; Open leads to the actual note composer; unmatched search presents its empty state; Escape clears the query; empty Archive presents its own state; General has no Return action. No native Return, restore mutation, global OS shortcut or hide action is simulated as successful by this fixture.

Automated verification: six relevant desktop test files / 59 tests pass, including all 32 light-pill contrast/color cases; desktop production build/typecheck, lint, product-truth/lifecycle validators and diff whitespace check pass. Softer #424242 icon contrast remains at least 4.5:1 against eligible light pills. Card washes move away from the paired ink, preserving the base paper contrast; note-derived card circles mix only 25% paper with white. Existing Vite bundle-size advisory remains.

Console: panel and note previews have no captured error logs. During live editing, the workspace fixture recorded duplicate-root hot-reload warnings; its entry now disposes the old root, and the final fresh-load check returned no new error logs. These are preview development warnings, not installed runtime acceptance.

The test browser requests reduced transparency, so screenshots show the intentional opaque fallback. CSS/native frost is retained in source; these captures do not establish native compositor blur, full monitor coverage, docking, focus, DPI or installed acceptance. The delivered private v0.1.53 installer has not been replaced, and no signing, publication or public release occurred.
