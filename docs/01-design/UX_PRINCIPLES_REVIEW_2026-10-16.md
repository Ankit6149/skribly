# Skribli UX principles review — 16 October 2026

Executor: Codex. Tracking: Part of ARC-66. Unreleased source work.

The owner requested a complete principle review, beyond Fitts's and Hick's laws, and Impeccable for every UI task. `AGENTS.md` now preserves that instruction. The accepted visual direction remains [Soft Paper Play](DESIGN.md): saturated and pastel paper, Iconify marks, curved compact cards, frosted overlays and a borderless note logo circle. This review improves task completion within that direction.

There is no finite universal list of every design law. This pass assesses all 30 entries in the current [Laws of UX catalogue](https://lawsofux.com/), then Nielsen's ten heuristics, additional Gestalt relationships and accessibility requirements. These are evaluation lenses, not a claim that each needs a new feature. Recommendations below are our application to Skribli; behavioural effects require user evidence.

## Findings and implemented changes

| Observed problem | Source change | Evidence and limit |
| --- | --- | --- |
| Note Type/Draw targets measured 24 px high; southeast resize target 16 × 16 px | Mode targets at least 32 px; header actions 36 px; southeast handle 32 px; coarse-pointer rules enlarge applicable actions to 44 px. Glyphs and paper colours remain unchanged. | Baseline browser DOM measurements. Post-change CSS/source review; final rendered/coarse-pointer acceptance pending. |
| Search had no nearby recovery action in the widget; filtered results could conceal all notes | Explicit Clear search, empty-state reset of query/app filter, Ctrl/Cmd+F and restored search focus. Context scope is exposed with `aria-pressed`; result count is announced instead of the complete grid. | Widget control tests and source review; keyboard behaviour in installed overlay still pending. |
| Library General notes used the app-return path despite having no saved application | General notes use existing `openNoteHere`; linked notes use `openNoteInSavedContext`. Primary labels are “Open Skrib” and “Return to app”. Both retain save-before-switch protection. | Library regression test covers both routes. Native focus/return acceptance remains open. |
| App-logo load failures could look like an empty picker, and font feedback appeared in the logo section | Separate font feedback; local retry for failed app choices; dependent controls disabled; accepted image format/size and app prerequisite explained next to upload. | Settings test covers failed load, font success and retry recovery. |
| Fading text by one fixed opacity can break contrast on saturated paper | Placeholder ink is mixed separately for each of 32 papers, preserving at least 4.5:1 against its paper. Forced-colour override retained. Android light-paper placeholder strength increased. | All-32 desktop contrast test; full source foreground minimum approximately 4.57:1. No claim of full-app WCAG conformance. |
| Mobile pasted search whitespace hid matching notes; no explicit recovery; unsaved dialog had no programmatic name | Trim normalized query, Clear search/Escape and Show all results, focused search recovery, count/save status, labelled/described unsaved dialog. | Android UI tests. Existing mobile action targets were already at least 44 px in baseline; no target failure invented. |
| Settings repeated non-informative labels; calendar arrows bypassed the icon family | Remove duplicate settings eyebrows, clarify grouping/copy, strengthen settings control spacing; Iconify month arrows, `aria-current` for today, checking feedback during retry. | Source review and existing calendar tests. |
| Note confirmation had no explicit local Escape recovery | Escape keeps editing or cancels Trash; cancellation does not choose the destructive action. Existing focus trap and save gates retained. | Source review plus focused safe-cancellation tests. |

## Full catalogue assessment

“Changed” means source implemented; “Retained” means existing behaviour was reviewed and preserved; “Research” means the principle cannot be validated from source alone. None means installed acceptance is complete.

| Principle | Skribli application and disposition |
| --- | --- |
| Aesthetic-Usability Effect | **Retained / Research:** preserve the owner's paper and pastel identity. Attractive screenshots cannot establish usability; recovery, contrast and target defects receive independent attention. |
| Choice Overload | **Changed:** keep app selection dependent on available apps, explain upload requirements and separate font settings. Preserve the owner's full paper palette; do not remove desired colours to reduce a count. |
| Chunking | **Changed:** font, app-logo feedback and prerequisites stay in their own sections; retain grouped Type/Draw and ink tools. |
| Cognitive Bias | **Retained / Research:** no new preselected consent, forced urgency or manipulative defaults. Test first-use assumptions with people; avoid presenting this heuristic review as customer research. |
| Cognitive Load | **Changed:** clear filters in place, distinct open/return verbs, less redundant settings chrome. Preserve labels where they explain unfamiliar actions. |
| Doherty Threshold | **Retained / Research:** use existing loading/save/open progress; retry now says Checking while pending. Do not add artificial delays or claim a measured 400 ms response; native latency remains unmeasured. |
| Fitts's Law | **Changed:** enlarge the observed small note targets without enlarging all glyphs; keep recovery next to search. Baseline measurements are evidence, coarse-pointer CSS still needs device review. |
| Flow | **Changed:** focus returns to search after recovery; General notes open directly; Escape safely exits confirmation. Preserve one scrolling text/ink page and existing save barriers. |
| Goal-Gradient Effect | **Retained / Research:** existing real operation progress only. A freeform note has no truthful completion percentage, so no invented progress meter. |
| Hick's Law | **Changed:** distinguish the primary open/return operation from secondary export; prerequisites prevent unusable logo choices. Keep advanced choices available in their existing sections. |
| Jakob's Law | **Changed:** conventional Ctrl/Cmd+F, Escape, clear-search control and calendar arrows; retain familiar native select/dialog behaviour. |
| Law of Common Region | **Changed:** feedback belongs to font/logo sections; note actions stay within the note. Retain the owner's shared attachment page rather than adding a detached footer. |
| Law of Proximity | **Changed:** search reset with the search/empty state, upload guidance with the file picker, save feedback with the relevant setting. |
| Law of Prägnanz | **Retained:** one coherent card silhouette, stable paper and icon system. Do not add shapes to demonstrate a principle. |
| Law of Similarity | **Changed:** calendar arrows join Iconify; retain shared monochrome ink and controls. Selected scope also has a semantic pressed state. |
| Law of Uniform Connectedness | **Retained:** segmented Type/Draw control visibly associates modes; attachment actions remain grouped with their card. Avoid new connectors or ornamental lines. |
| Mental Model | **Changed:** General means open here; contextual means return to app. Privacy and sync copy must match actual local storage and platform capability. |
| Miller's Law | **Changed / Research:** externalize state through selected scope, query and result counts. Do not interpret a memory study as an exact seven-controls-per-screen rule. |
| Occam's Razor | **Changed:** remove redundant settings labels and clarify actions using existing components. No extra framework, palette or navigation layer. |
| Paradox of the Active User | **Changed:** immediate recovery and visible prerequisites reduce dependence on reading documentation. Existing guide remains optional; native first-use learnability needs testing. |
| Pareto Principle | **Research:** prioritize capture, write, find and return because they define the product. No usage analytics were collected, so no claim that these represent a measured 80% of activity. |
| Parkinson's Law | **Retained / Research:** do not impose deadlines or arbitrary character restrictions beyond existing safety limits on reflective writing. Speed targets need measured tasks. |
| Peak-End Rule | **Changed / Research:** clearer save feedback and safe confirmation exits support an understandable finish. Emotional response has not been measured. |
| Postel's Law | **Changed:** tolerate surrounding search whitespace while retaining strict file types, size limits, storage validation and licensing gates. Forgiving input does not mean trusting malformed data. |
| Selective Attention | **Changed:** one relevant status/count, local errors and a primary open action; whole-grid live announcement removed. Owner-requested colour remains useful identity. |
| Serial Position Effect | **Retained / Research:** core navigation remains stable and important actions have named placement. No arbitrary reordering based on assumed memorability; test real scan behaviour. |
| Tesler's Law | **Changed:** application handles query normalization and chooses the proper open path; users keep necessary explicit save/discard and file constraints. Complexity is handled, not hidden behind unsafe defaults. |
| Von Restorff Effect | **Changed:** primary open styling and focused/selected indicators identify the current task. Avoid making every control an accent; paper colours retain the owner's meaning. |
| Working Memory | **Changed:** selected scope, search results, nearby prerequisite and section-local feedback reduce remembering previous state. Existing saved app/title context remains visible. |
| Zeigarnik Effect | **Retained:** unsaved-change guards protect unfinished work; labelled mobile dialog clarifies recovery. No nagging badges or fake unfinished tasks. |

## Nielsen's ten heuristics

The [Nielsen Norman Group heuristic framework](https://www.nngroup.com/articles/ten-usability-heuristics/) complements the catalogue. These are product-specific observations, not a numerical usability score.

| Heuristic | Review outcome |
| --- | --- |
| Visibility of system status | Local settings feedback, result/save statuses and disabled pending retry; existing save/open progress preserved. |
| Match between system and real world | Open Skrib / Return to app; ordinary settings language; no implication of Android/desktop parity or cloud sync. |
| User control and freedom | Search reset, safe Escape, existing save/discard and reversible Trash. Permanent deletion guards unchanged. |
| Consistency and standards | Iconify arrows, conventional search shortcut, selected scope semantics, existing font/paper identity. |
| Error prevention | Disable dependent picker controls; retain busy gates, transaction validation and save-before-switch. |
| Recognition rather than recall | Visible scope and recovery; nearby upload formats; retained app/title context. |
| Flexibility and efficiency | Keyboard search, existing calendar keyboard navigation and direct General-note open; touch rules supplement pointer operation. |
| Aesthetic and minimalist design | Remove duplicate headings; preserve requested colours and cards rather than replacing the owner's visual world. |
| Help recognize, diagnose and recover from errors | App choices retry, meaningful library loading/error copy, empty-state filter reset. |
| Help and documentation | Existing guide retained; this matrix and current docs index make unresolved acceptance visible. |

## Additional grouping and accessibility review

Gestalt continuity/closure: preserve shared text/ink scroll coordinates and coherent card boundaries; no new cuts or borders. Figure/ground: keep the requested frosted overlay, opaque reduced-transparency fallback and readable note ink. Common fate: retain the single sliding Type/Draw indicator and reduced-motion treatment; do not add motion to every static region. These relationships guide source decisions; native compositing and actual animation remain unverified here.

The [WCAG 2.2 minimum target criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) evaluates size or spacing with exceptions; it is not a requirement that every icon be 44 px. This pass addresses measured small targets and adds coarse-pointer sizes, but does not certify all targets. Keyboard names remain when narrow mode hides Type/Draw text. Search focus restoration, scope semantics, named dialogs, today state, reduced-motion and forced-colour rules are retained or improved. Placeholder contrast is tested against all 32 desktop papers. Manual screen-reader, 200–400% zoom/reflow, touch, high-contrast and reduced-motion acceptance remain open.

## Evidence, safety and acceptance

Story: capture/write/find a thought → frontend controls → existing note/preference commands → existing persistence/save guards → clear result or recoverable error. Source tests verify the changed UI-to-helper boundaries; they do not establish native OS-to-window behaviour.

Baseline browser evidence covers desktop Ready, expanded widget, wine note and Android library/editor. Native minimum note size is 320 × 260. A local read-only workspace fixture now exposes real Ready/Settings/Library/Calendar components with synthetic notes; it rejects mutations, requires a development localhost origin and refuses to replace a native bridge. It is not a second storage path or a shipped native capability. The fixture's sample count changed from 18 to 3 to match its synthetic note list.

Final browser review encountered repeated browser-control timeouts before successful after-state inspection. Baseline captures are therefore **before only**; no after screenshot or visual acceptance is claimed. See [evidence notes](evidence/ux-principles-2026-10-16/design-qa.md). Code, tests and detector results are separate evidence. No customer notes, account credentials, telemetry, production backend writes or installed app state were accessed.

Remaining: restore browser review for final responsive layouts; installed Windows focus/drag/ink/scroll/save/reopen, physical Android keyboard/back/touch/persistence, screen-reader and OS appearance preferences, performance measurements and owner acceptance. No installer/APK rebuild, new download key, signing, website/backend deployment or release is part of this work. Private published packages remain Windows v0.1.54 and Android v0.0.2.

Automated results: full desktop suite 67 files / 413 tests passed, followed by one added safe-cancellation file / one passing test (68 files / 414 total covered). Android 4 files / 26 frontend tests and 3 manifest/build-preparation tests passed. Workspace TypeScript, desktop and Android lint, both production frontend builds, production CSS fixture, governance and product/lifecycle/Trash/import validators passed. Production output excludes the read-only workspace entry and bridge markers. The existing large desktop JavaScript chunk advisory remains; no latency or memory improvement is claimed. React review confirms cleanup of the search shortcut, stale-result cancellation on appearance reload, derived search/context state and unchanged save gates; no new package or data schema.
