# Living Paper v0.1.30 — design QA

Result: **blocked — live visual acceptance deferred to owner**.

Reference: owner screenshot `codex-clipboard-ba6e78d5-b006-4e37-a340-d9094d59ac06.png` and PR #203 head `a15f961`.

The image-to-code workflow was adapted to the existing desktop app. The selected paper-first design, fonts, palette and original product logo were preserved. Refinements target clipped Done geometry, action separation, tiny labels, bounded menus, focus/dismissal and selected-text toolbar overlap.

Follow-up follows the owner's explicit refinement of Direction A: contrasting pastel upper-right place label (varied across notes, stable on reopening, never matching the paper), compact icon ribbons, hover/focus labels, horizontal colour sub-ribbon and inline attachments with a collapsible all-files tray. The code reference is `site/interface-directions.html` / `site/interface-living-paper.html`, without modifying either prototype.

Automated evidence: 216 frontend tests including new DOM interaction tests; 208 native tests; TypeScript/build and repository validation. DOM tests do not prove rendered spacing, pixel parity or real WebView pointer/compositor behaviour.

No comparison screenshot exists for this candidate: the owner explicitly elected to install and test. No claim of passed visual QA or production readiness is made. Acceptance checklist is in `docs/04-operations/NOTE_RIBBONS_V0.1.30.md`.

Final result for v0.1.30: blocked — owner visual/runtime acceptance pending. Its installed note was inspected and showed the top-left completion circle and a larger-than-intended lower-right corner, so it was superseded by the v0.1.31 source changes documented in `docs/04-operations/LIVING_PAPER_V0.1.31.md`. The new source passes automated checks; final Windows visual/runtime acceptance remains pending.

## v0.1.33 note interaction pass

The current owner candidate adds the larger smooth bottom-right paper curve, an attached place tab with hover/focus detail, contrasting pastel tab colours, a compact right icon rail, direct inline attachment and checklist controls near the caret, optional heading text, and a `/` insert menu (with `Ctrl+/` available from any caret position). The actual `SkribComposer` was visually inspected at 420 x 360 and 320 x 280, including the open rail and insert menu. The desktop build and 223 frontend tests passed. Installed Windows WebView layout, sign-in, note persistence, and installer acceptance still require the owner test. See `docs/04-operations/OWNER_CANDIDATE_V0.1.33.md`.

## v0.1.32 owner candidate

The owner installed v0.1.31 and reported sign-in stopping at **“Licence activation is not enabled in this build.”** The installed executable lacks the verification key required by the native entitlement path. The v0.1.32 candidate embeds the active public verification key and blocks enforced packaging when it is absent or malformed. The actual compact note was inspected in a browser render of `SkribComposer` at a 420 × 360 viewport against A · Living Paper in `site/interface-directions.html`: the left place tab, quiet pastel paper, selective Kalam writing, Add gateway, Done action, and 14 px circular context dot are present. The More menu was corrected after its first visual pass overflowed. This browser render does not establish actual Windows WebView, placement, account, or installer-upgrade acceptance. See `docs/04-operations/OWNER_CANDIDATE_V0.1.32.md` for the build and acceptance record.
