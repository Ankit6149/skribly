# Skribli full product audit and execution plan

> **Historical audit snapshot — not a description of the current code tree.**
> This document preserves findings from 27 July 2026 so their reasoning and issue links remain auditable. Statements such as “the current implementation” below mean the repository state on that audit date. Use the root README, the [current interaction specification](../01-design/INTERACTION_SPEC.md), the [product backlog](PRODUCT_BACKLOG_AND_CONTRIBUTION_MAP.md), and the linked acceptance contracts for present behavior.

**Audit date:** 27 July 2026  
**Repository:** `Ankit6149/skribly`  
**Audited branch:** `main`  
**Canonical tracker:** [GitHub issue #34](https://github.com/Ankit6149/skribly/issues/34)

## Current reconciliation note — 9 August 2026

The following audit risks now have implemented foundations, although their parent launch gates may remain open for physical Windows or broader-scope evidence:

- hardened versioned JSON persistence, recovery generations, rollback, and metadata-only diagnostics;
- ordered/coalesced note saves with truthful save/retry state;
- one-process routing, bounded/coalesced WinEvent delivery, fail-closed target capture, and monitor/DPI-safe compact placement;
- deterministic create/reopen behavior in the compact transient editor;
- a normal non-floating All Skribs window with search and portable export;
- reversible Trash and note-specific permanent deletion inside Trash;
- strict portable JSON preview plus verified rollback backup and atomic import apply;
- truthful compact-editor website claims with public downloads disabled;
- a private-only Windows installer workflow and canonical Skribli branding gates.

The remaining release decision is still evidence-driven: physical Windows runtime/installer acceptance, context identity and lifecycle completion, accessibility, compatibility, security/privacy/legal readiness, signing/reproducibility, rollback, and supported public delivery must pass before distribution. Payments remain a separate later gate.

## 1. Executive verdict

Skribli is **not ready for a public download or paid launch**.

The compact-window rebuild removes the most dangerous visible behavior of the earlier full-screen overlay, but the repository still has release-blocking risks in persistence, save ordering, native event processing, context matching, multi-monitor placement, single-instance execution, recovery UX, release operations, and product truth.

The website, PRD, roadmap, README, FAQ, release notes, privacy/security documents, shared models, dormant components, licensing prototype, and commerce endpoints describe different versions of the product. This is not only documentation debt: these contradictions have repeatedly caused retired UI and architecture ideas to return to production work.

The correct execution order is:

1. prevent data loss and unsafe native behavior;
2. freeze the actual Windows MVP interaction contract;
3. simplify the implementation around that contract;
4. establish native runtime evidence and a signed release chain;
5. rebuild the site and legal/security baseline around the truthful product;
6. implement payments and licence enforcement only after the product is stable.

Do not add ink, arrows, highlights, reminders, browser anchoring, macOS, cloud sync, collaboration, AI, OCR, or additional monetization features before the release foundations are complete.

---

## 2. Audit scope

The audit covered the repository surfaces that can affect product behavior, user data, launch safety, or customer trust:

- React/Tauri desktop entry point and compact editor;
- Zustand stores, frontend/native event handling, geometry, licensing, and rich-content persistence;
- Rust coordinator, models, storage, licensing, application lifecycle, Tauri commands, and tray integration;
- Windows hotkey, WinEvent hooks, HWND inspection, focus, DPI, monitor positioning, process metadata, and window subclassing;
- macOS adapter status;
- Chromium extension placeholder and shared package models;
- desktop and native tests;
- npm/Rust workspace configuration;
- GitHub CI, release, and repository-cleanup workflows;
- Windows installer configuration and prior candidate-building path;
- landing page, FAQ, privacy, production notes, download pages, JavaScript, CSS, structured data, sitemap, robots, and `llms.txt` validation;
- checkout, download, and build-status API handlers;
- licence key generation and manual licence issuance scripts;
- product, engineering, security, roadmap, distribution, tax, contribution, and proprietary-notice documents.

Generated dependencies, binary assets, and third-party library internals were not treated as product source. They still require dependency, licence, supply-chain, and vulnerability scanning before release.

No source audit can honestly guarantee that no unknown defect exists. The purpose of this plan is to cover every material subsystem found in the repository and to add gates that reveal defects the source review cannot prove, especially native Windows runtime behavior.

---

## 3. Current architecture summary

### 3.1 Active desktop flow

The active UI renders `OverlayHost`, which initializes native listeners and renders a single `SkribComposer` when it detects a newly created or latest matching note. The compact editor is a hidden, borderless, transparent, always-on-top Tauri window configured at 420 × 360.

The global shortcut is registered through native Win32 `RegisterHotKey`. On invocation, Rust inspects the foreground window, positions and shows the compact window, selects the active target, creates a blank note when the context has none, builds a state payload, and emits an event to the frontend.

Notes are stored in a versioned JSON file in the application-data directory. Licence state is stored in a separate local JSON file. Dormant attachments/drawings use IndexedDB in the webview.

### 3.2 Dormant or contradictory architecture

Large portions of the repository still implement the retired full-screen overlay model:

- selective hit-test rectangles and full-overlay geometry;
- floating dots and note preview cards;
- drag and resize behavior;
- saved-notes floating widget;
- write/type composer modes;
- colour/collapse/position mutations;
- ink canvas and IndexedDB attachments;
- placement and browser-anchor shared models;
- placeholder Chromium extension;
- macOS package/dependency claims without implementation.

These paths are not harmless. They keep obsolete state and APIs alive, inflate tests and CSS, create migration/data questions, and make it easy to accidentally restore rejected UX.

---

## 4. Release-blocking findings

### 4.1 Persistence can silently appear empty after an interrupted save

`storage::save` creates a temporary file, copies the current primary to a backup, deletes the primary, and renames the temporary file. If the app or machine stops after deletion and before rename, the next launch sees a missing primary and returns an empty note collection. Because missing is treated as success, startup does not attempt the existing backup.

Additional risks:

- backup-copy failure is ignored;
- the last valid primary is removed before replacement is known durable;
- no parent-directory durability step is performed;
- corrupt files are not quarantined;
- no recovery UI exists;
- schema migration only rejects unknown versions;
- JSON notes and IndexedDB attachments are not transactionally coordinated.

**Execution issue:** [#14](https://github.com/Ankit6149/skribly/issues/14)

### 4.2 Multiple instances can corrupt state and duplicate native resources

There is no single-instance guard. Two Skribli processes can compete for the hotkey, install duplicate hooks, show multiple tray icons, and write the same note/licence files. Lifecycle behavior for a second launch, suspend/resume, session shutdown, installer upgrade, and pending writes is undefined.

**Execution issue:** [#15](https://github.com/Ankit6149/skribly/issues/15)

### 4.3 Editor writes can complete out of order

The editor debounces text updates but can have multiple native writes in flight. Each response replaces the full frontend note array. An older request can complete after a newer request and revert text. Incoming note props are copied into local textarea state and can overwrite a dirty draft.

The UI always displays “Saved locally” even when a request is pending or has failed. Current compact UI does not render the store’s native/storage error message. Done/Close/Escape can hide before durable success is confirmed.

**Execution issue:** [#16](https://github.com/Ankit6149/skribly/issues/16)

### 4.4 Global WinEvent delivery is overly broad and unbounded

The Windows adapter installs process-wide hooks for foreground, minimize, destroy, and every `EVENT_OBJECT_LOCATIONCHANGE` event. The callback does not first limit events to a top-level target window and sends them to an unbounded channel. Unrelated application scrolling, animation, caret, and accessibility events can generate unnecessary background work or queue growth.

**Execution issue:** [#17](https://github.com/Ankit6149/skribly/issues/17)

### 4.5 Shortcut targeting can fall back to a stale application

Normal shortcut capture uses the current foreground target and falls back to the previous active target when foreground inspection fails. Unsupported, elevated, transient shell, desktop, or protected windows can therefore cause the wrong note/context to open.

Durable matching relies mainly on process executable name and window-title equality/containment. Titles are dynamic, can expose private file names, and can cross-match incorrectly between windows from the same process. TypeScript and Rust contain overlapping matching logic.

**Execution issue:** [#18](https://github.com/Ankit6149/skribly/issues/18)

### 4.6 Compact placement is not monitor-work-area or mixed-DPI safe

The editor is sized in fixed physical pixels and clamped against the complete virtual-desktop bounding rectangle. That rectangle can contain gaps where no display exists and includes taskbar regions. Placement does not select the target window’s monitor work area or convert the desired logical size using that monitor’s scaling factor.

**Execution issue:** [#19](https://github.com/Ankit6149/skribly/issues/19)

---

## 5. Product and UX findings

### 5.1 The product does not have one approved note lifecycle

The repository simultaneously describes:

- a full contextual annotation overlay with multiple persistent notes;
- one compact note editor that fully hides;
- a note that closes into a persistent tab/dot;
- one note per context;
- multiple notes per context;
- text-only MVP;
- checklists, ink, attachments, arrows, highlights, reminders, and browser anchors.

Current native logic creates a note only when none matches. Current frontend logic opens a newly created note or the latest note after any note-array change. This behavior is implicit rather than defined through an explicit command/event state machine.

Required decisions include one-versus-many notes, create-versus-open shortcut behavior, close behavior, new-note action, target tracking while visible, empty-note behavior, trash/undo, and exact v1 fields.

**Execution issue:** [#20](https://github.com/Ankit6149/skribly/issues/20)

### 5.2 Saved notes have no active recovery surface

The old floating `NotesWidget` is no longer rendered, but no replacement exists. Users cannot reliably search all notes, find a note whose app is closed, export data, restore an accidental deletion, or re-anchor ambiguous context.

Immediate permanent deletion conflicts with the PRD and with licence copy promising read/export access after trial expiration.

**Execution issue:** [#21](https://github.com/Ankit6149/skribly/issues/21)

### 5.3 The active frontend/native contract is dominated by retired overlay state

The store and native payload still carry overlay metrics, hit-test rectangles, window lists, ambiguity flags, note geometry, colour, collapse, preview/widget state, and full arrays. Commands do not reliably fail when IDs are missing. Inputs are not consistently validated for size, enum, finite numbers, or malformed data.

**Execution issue:** [#22](https://github.com/Ankit6149/skribly/issues/22)

### 5.4 Retired prototype code remains production-adjacent

Dead/dormant components and stores include floating dots, note previews, drag/resize, saved-note widget, ink, attachments, rich-content IndexedDB, placeholder extension, and broad shared future models. Some code still includes obsolete commercial wording. CSS contains large unused sections for widgets, attachments, pricing, and persistent dots.

Any previously created IndexedDB content requires a deliberate migration/export/cleanup decision before code deletion.

**Execution issue:** [#23](https://github.com/Ankit6149/skribly/issues/23)

### 5.5 Accessibility and focus behavior are incomplete

The borderless always-on-top editor changes application focus but has no approved focus restoration behavior. Save/error states are not truthfully announced. The handwriting style may not be readable for every user, and high contrast, forced colors, Windows text scaling, keyboard-only use, and screen-reader behavior are not release-tested.

The website uses disabled anchors, very small labels, layered animation, and lacks a complete keyboard/mobile-navigation/accessibility gate.

**Execution issue:** [#31](https://github.com/Ankit6149/skribly/issues/31)

---

## 6. Native Windows findings

### 6.1 Native code still uses obsolete overlay concepts

The Windows adapter retains:

- full virtual-screen bounds verification;
- hit-test rectangle conversion and tests;
- `HTTRANSPARENT` imports and comments;
- a global coordinator used for retired selective interaction;
- overlay terminology in function and status names.

The window subclass now forces every `WM_NCHITTEST` result to `HTCLIENT`. The subclass is primarily being retained to receive `WM_HOTKEY`, mixing hotkey delivery with window hit testing. A Tauri global-shortcut implementation or a dedicated native/message window should be evaluated to reduce fragility.

### 6.2 Window inspection is incomplete

Process-name inspection requests permissions that can fail for protected/elevated processes. Empty process identity is not treated as an explicit unsupported result. Candidate enumeration does not comprehensively filter cloaked/tool/owned/transient Windows surfaces. `GetWindowRect` can include invisible resize borders rather than the desired client/extended frame/work area.

### 6.3 Worker lifecycle and diagnostics are weak

Native worker threads are not supervised and do not expose structured safe diagnostics. Mutex poisoning generally degrades into empty/false results instead of explicit failure. Once-initialized global senders cannot be replaced cleanly across retries or certain test/reinitialization paths.

These details are addressed across issues #15, #17, #18, #19, #22, #24, #29, and #30.

---

## 7. Storage and data-model findings

### 7.1 The domain model mixes persistent and transient concepts

`SkribNote` contains relative screen position, width, height, colour, and collapsed state from the overlay product. `TargetWindowInfo` contains transient HWND, live bounds, focus, minimized state, DPI, and class. Persistent context currently stores process and raw title without a versioned match strategy or confidence.

The final model should separate:

- durable note content and lifecycle state;
- durable privacy-conscious context identity;
- current Windows session/window observation;
- UI draft and editor state;
- optional future rich-content records.

### 7.2 Coordinator mutations hide failures

Coordinator methods often return `bool` or `Option`, but Tauri handlers ignore those outcomes and persist anyway. Mutex failures return empty/default values. HashMap iteration order is not a stable product ordering.

### 7.3 Attachment persistence is unsafe and disconnected

The dormant rich-content store uses IndexedDB separately from Rust JSON. It has no unified backup/export/migration, no transaction with note deletion, and no clear cleanup for orphaned records. File names/MIME values and storage limits require validation and UX if the feature is retained.

These changes are covered by #14, #20, #21, #22, and #23.

---

## 8. Licensing findings

The licence prototype uses Ed25519-signed offline grants, but the lifecycle is not launch-ready:

- installation/device ID is generated from time, process ID, and nanoseconds;
- deleting licence state can reset the trial and identity;
- reinstall/device replacement makes recovery difficult;
- invalid stored activation can silently fall back rather than clearly reporting corruption/tampering;
- update eligibility is stored but not used;
- no deactivation, transfer, recovery, revocation, refund, chargeback, or device-count policy exists;
- `LicenseGate` is not mounted in the active app;
- licence UI links to a pricing section that does not exist;
- manual issuance outputs customer and token data to a shell;
- public/private key operations are not integrated with checkout or audited administration.

Do not enable enforcement until the offer, perpetual-use promise, update period, trial, device policy, offline behavior, privacy, refund handling, and customer recovery flow are approved.

**Execution issue:** [#28](https://github.com/Ankit6149/skribly/issues/28)

---

## 9. Commerce and payment findings

No payment system currently exists. The checkout API is a redirect wrapper around an environment variable and falls back to `/#pricing`, although the site validator forbids pricing and the page has no pricing section. The redirect destination is not allowlisted. There are no webhooks, order database, idempotency, entitlement fulfilment, receipt/invoice delivery, refund/chargeback handling, reconciliation, customer recovery, support tooling, or failure monitoring.

Business documents correctly identify that Indian GST, inter-state sales, exports, Merchant of Record responsibilities, invoicing, refunds, and income-tax records require review. These notes are not an implementation or professional sign-off.

Payments must remain disabled until a complete sandbox-tested order-to-entitlement lifecycle and the actual CA/legal review are complete.

**Execution issue:** [#27](https://github.com/Ankit6149/skribly/issues/27)

---

## 10. Website findings

### 10.1 The site markets a different app

The landing demo, feature comparison, structured data, FAQ, and production notes still present:

- floating note dots;
- multiple visible notes;
- checklists;
- a compact attached tab after close;
- selective click-through transparent overlay space.

The compact app currently fully hides the window. Marketing claims must follow the approved lifecycle from #20.

### 10.2 Configuration is not a real source of truth

`commerce-config.js` says downloads/access are disabled, but `app.js` hardcodes behavior and does not drive the page from that object. Structured data is modified after load. Status, version, download, and commercial language are repeated across many files.

### 10.3 Site validation checks temporary wording instead of correctness

`site/validate.mjs` enforces exact phrases such as “Skribli is in production” and forbids commercial words. It does not validate `checkout.js` or `build-status.js`, full accessibility, security headers, response schemas, provider allowlists, structured-data consistency, or truthful feature mapping.

### 10.4 API concerns

- checkout redirect needs an allowlisted architecture or removal until commerce exists;
- build-status API has no explicit timeout, depends on GitHub display names, can expose commit/job URLs, and needs rate-limit/failure design;
- download API needs a signed release-manifest design before activation.

### 10.5 Performance/privacy/accessibility concerns

Multiple CSS layers and dead selectors increase complexity. Typography is dynamically injected and remote Google Fonts create an external request and possible layout shift. Disabled anchors are not the correct semantic control. Responsive navigation, focus behavior, contrast, reduced motion, and assistive-technology tests need completion.

**Execution issue:** [#26](https://github.com/Ankit6149/skribly/issues/26)

---

## 11. Security, privacy, and legal findings

The security/privacy baseline is incomplete and contains architecture drift:

- SECURITY claims SQLite although notes use JSON and dormant rich content uses IndexedDB;
- exact desktop network behavior has not been verified dynamically;
- window titles, process names, note text, licence email, and future order data need a data inventory and minimization policy;
- no complete desktop/site/commerce/licensing/update threat model exists;
- explicit Tauri v2 capability allowlists were not found in the active source review;
- CSP still permits inline styles and data/blob images without a documented minimum policy;
- no public/private vulnerability mailbox and incident runbook exist;
- no Terms/EULA, refund policy, support contact, complete retention/deletion plan, or generated third-party notice exists;
- proprietary/public repository posture is inconsistent.

**Execution issue:** [#29](https://github.com/Ankit6149/skribly/issues/29)

---

## 12. CI, testing, and release findings

### 12.1 Current strengths

Current CI provides useful baseline checks:

- TypeScript type-check;
- frontend unit tests;
- production frontend build;
- Rust formatting;
- Windows Rust check/tests;
- restricted licence-build compile;
- static site marker validation.

### 12.2 Missing gates

It does not yet provide:

- a real JavaScript/TypeScript lint configuration;
- Rust clippy gate;
- frontend/Rust coverage thresholds;
- dependency vulnerability and licence checks;
- SBOM/provenance;
- CodeQL/static analysis;
- capability/IPC audit;
- secret/workflow-permission validation;
- native installer smoke/runtime automation;
- accessibility/performance budgets;
- safe diagnostics and event/resource regression tests;
- macOS compile/test decision;
- protected release approvals.

### 12.3 Release is intentionally non-functional

The committed release workflow is a production-hold placeholder. There is no permanent signed candidate/stable pipeline, update channel, stable manifest, rollback, emergency withdrawal, or website integration.

**Execution issues:** [#24](https://github.com/Ankit6149/skribly/issues/24), [#25](https://github.com/Ankit6149/skribly/issues/25), and [#30](https://github.com/Ankit6149/skribly/issues/30)

---

## 13. Repository governance findings

The repository is public, while `NOTICE.md` describes private commercial work and grants no reuse permission. This mismatch must be resolved intentionally; making the repository private later cannot reverse prior public exposure.

The `Repository Finalization` workflow deletes every branch except `main` when `tauri.conf.json` or the workflow changes. This can destroy unrelated active work and contradicts `CONTRIBUTING.md`, which documents feature/fix/spike branches.

Missing governance includes branch protection, CODEOWNERS, protected workflow/release changes, issue/PR templates, release ownership, secret-history audit, repository backup/mirror, and a vulnerability-reporting channel.

**Execution issue:** [#33](https://github.com/Ankit6149/skribly/issues/33)

---

## 14. Platform and future-feature findings

### macOS

Cargo metadata and product documents mention macOS, but the macOS adapter explicitly returns an unimplemented error. The Windows-specific channel types and runtime architecture also need conditional design review before a macOS build can be truthful.

For the MVP, either:

- declare Windows-only everywhere and remove macOS production metadata/dependencies where possible; or
- create a separate later milestone with real accessibility permission, panel behavior, signing, notarization, testing, and distribution work.

### Browser extension

The Chromium extension is a placeholder that logs a message. There is no local authenticated bridge, origin limitation protocol, URL/DOM anchoring model implementation, desktop pairing, permission UX, or security review. It must not be represented as active functionality.

### Ink, attachments, checklists, reminders, annotations

Prototype and shared models exist, but the current product has not approved their data model, editor UX, persistence, export, migration, accessibility, performance, or privacy impact. They remain future work after the Windows text-note MVP is stable.

**Execution issues:** [#23](https://github.com/Ankit6149/skribly/issues/23) and [#32](https://github.com/Ankit6149/skribly/issues/32)

---

## 15. Detailed execution sequence

## Phase 0 — Immediate safety foundation

### 0A. Repository safety
Start [#33](https://github.com/Ankit6149/skribly/issues/33) immediately so normal branches and reviewed work cannot be deleted by automation. Resolve repository visibility/licensing posture and protect `main`/workflows.

### 0B. Persistence and lifecycle
Implement [#14](https://github.com/Ankit6149/skribly/issues/14) and [#15](https://github.com/Ankit6149/skribly/issues/15). Choose persistence architecture before expanding the schema. Add single-instance ownership before relying on one writer.

### 0C. Ordered edit path
Implement [#16](https://github.com/Ankit6149/skribly/issues/16) using revisioned/coalesced per-note writes and truthful save state.

### 0D. Native targeting and resource safety
Implement [#17](https://github.com/Ankit6149/skribly/issues/17), [#18](https://github.com/Ankit6149/skribly/issues/18), and [#19](https://github.com/Ankit6149/skribly/issues/19). These establish bounded event delivery, fail-closed target capture, and correct display placement.

### Phase 0 exit criteria

- storage fault injection cannot silently empty data;
- only one instance owns data/hotkey/hooks;
- final text survives rapid typing and immediate close;
- unsupported targets never fall back to stale context;
- event processing and memory stay bounded;
- editor placement passes supported display/scaling configurations.

## Phase 1 — Product contract and clean architecture

### 1A. Approve the state machine
Complete [#20](https://github.com/Ankit6149/skribly/issues/20) first. No UI expansion should begin until one-versus-many notes, create/open behavior, close behavior, trash, and exact v1 fields are approved.

### 1B. Rebuild recovery and API
Implement [#21](https://github.com/Ankit6149/skribly/issues/21) and [#22](https://github.com/Ankit6149/skribly/issues/22) against the approved domain model.

### 1C. Delete/quarantine retired systems
Complete [#23](https://github.com/Ankit6149/skribly/issues/23) after migrations for any shipped dormant data are ready.

### 1D. Accessibility and documentation truth
Complete [#31](https://github.com/Ankit6149/skribly/issues/31) and continuously update [#32](https://github.com/Ankit6149/skribly/issues/32).

### Phase 1 exit criteria

- one PRD/state machine matches code and site;
- every note can be found, recovered, exported, and safely deleted;
- API is typed, minimal, validated, and revision-aware;
- retired production code is absent;
- accessibility baseline passes;
- platform/status claims are truthful.

## Phase 2 — Evidence and release engineering

### 2A. Expand CI early
Begin [#30](https://github.com/Ankit6149/skribly/issues/30) during Phase 0 and finish after architecture cleanup.

### 2B. Build real native evidence
Complete [#24](https://github.com/Ankit6149/skribly/issues/24) against the exact candidate binary.

### 2C. Establish signed release chain
Complete [#25](https://github.com/Ankit6149/skribly/issues/25). Do not connect the public download until signature, hashes, provenance, runtime evidence, update/rollback, and withdrawal controls exist.

### Phase 2 exit criteria

- protected CI and runtime matrix pass;
- exact binary is signed and traceable;
- install/upgrade/uninstall/rollback preserve data;
- emergency withdrawal and rollback are tested.

## Phase 3 — Truthful launch surface

Complete [#26](https://github.com/Ankit6149/skribly/issues/26) and [#29](https://github.com/Ankit6149/skribly/issues/29). Generate visible product/status/release facts from canonical configuration and the stable release manifest.

### Phase 3 exit criteria

- site demo exactly matches released app;
- schema/FAQ/privacy/release notes/README agree;
- site accessibility, performance, and security checks pass;
- data inventory, threat model, policies, support contact, and incident process are approved.

## Phase 4 — Commercial implementation

Only after product and release stability:

1. approve the sales/merchant/tax/support model in [#27](https://github.com/Ankit6149/skribly/issues/27);
2. implement entitlement lifecycle in [#28](https://github.com/Ankit6149/skribly/issues/28);
3. complete sandbox order, webhook, fulfilment, activation, refund, transfer, reconciliation, and support tests;
4. obtain professional CA/legal review for the actual flow;
5. enable checkout through controlled production configuration.

Payment must remain disabled if Phase 4 is incomplete, even if downloads reopen for a free/private tester cohort.

---

## 16. Public-download go/no-go gate

A public installer must not be exposed unless all of the following are true:

- [ ] Issues #14–#19 are closed with evidence.
- [ ] Product lifecycle #20 is approved and implemented.
- [ ] Recovery/export/trash #21 is available.
- [ ] Native runtime evidence #24 passes for the exact installer hash.
- [ ] Signed release/rollback #25 is complete.
- [ ] Site truth #26 is complete.
- [ ] Security/privacy/legal baseline #29 is complete.
- [ ] Accessibility #31 is complete.
- [ ] Documentation/platform truth #32 is complete.
- [ ] Repository governance #33 is complete.
- [ ] No open P0 defect exists.
- [ ] No unresolved data migration or orphaned attachment risk exists.
- [ ] The website download endpoint resolves only an allowlisted stable manifest.
- [ ] Withdrawal and rollback have been rehearsed.

Payment additionally requires #27 and #28 plus professional review.

---

## 17. Execution rules for every issue

Every implementation issue is complete only when it includes:

1. code and architecture change;
2. unit/integration tests;
3. native runtime evidence where behavior depends on Windows;
4. data migration and recovery path for persistent changes;
5. privacy/security impact review;
6. accessibility impact review for UI changes;
7. performance/resource measurement for background/native changes;
8. documentation and customer-facing truth updates;
9. exact commit/build/artifact linkage;
10. explicit acceptance criteria verification.

Compilation is evidence of buildability, not evidence of product correctness.

---

## 18. GitHub issue index

### P0 foundations

- [#14 — Make local note storage crash-safe and recoverable](https://github.com/Ankit6149/skribly/issues/14)
- [#15 — Enforce single-instance execution and safe background lifecycle](https://github.com/Ankit6149/skribly/issues/15)
- [#16 — Make note editing ordered, observable, and lossless](https://github.com/Ankit6149/skribly/issues/16)
- [#17 — Filter and coalesce Windows event tracking](https://github.com/Ankit6149/skribly/issues/17)
- [#18 — Make foreground target capture fail closed and use durable context identity](https://github.com/Ankit6149/skribly/issues/18)
- [#19 — Correct compact editor placement for multi-monitor and mixed-DPI Windows setups](https://github.com/Ankit6149/skribly/issues/19)

### Product and architecture

- [#20 — Define and implement the canonical note lifecycle and compact-window UX](https://github.com/Ankit6149/skribly/issues/20)
- [#21 — Build a non-floating note recovery, search, export, and trash surface](https://github.com/Ankit6149/skribly/issues/21)
- [#22 — Replace legacy overlay state with a validated compact-note native API](https://github.com/Ankit6149/skribly/issues/22)
- [#23 — Remove or quarantine retired overlay, widget, ink, attachment, and extension prototypes](https://github.com/Ankit6149/skribly/issues/23)

### Release and quality

- [#24 — Add release-blocking native Windows runtime validation and evidence](https://github.com/Ankit6149/skribly/issues/24)
- [#25 — Build a signed, reproducible Windows release and rollback pipeline](https://github.com/Ankit6149/skribly/issues/25)
- [#30 — Expand CI with lint, coverage, dependency security, performance, and observability gates](https://github.com/Ankit6149/skribly/issues/30)
- [#31 — Make the desktop app and website fully keyboard and accessibility usable](https://github.com/Ankit6149/skribly/issues/31)

### Site, commerce, security, and governance

- [#26 — Rebuild the website around truthful product behavior and production-ready UX](https://github.com/Ankit6149/skribly/issues/26)
- [#27 — Design and implement checkout, fulfilment, refund, and support](https://github.com/Ankit6149/skribly/issues/27)
- [#28 — Harden licence activation, device transfer, trial, and entitlement lifecycle](https://github.com/Ankit6149/skribly/issues/28)
- [#29 — Complete security, privacy, data-handling, and legal launch baseline](https://github.com/Ankit6149/skribly/issues/29)
- [#32 — Reconcile product documentation, platform scope, and roadmap with actual code](https://github.com/Ankit6149/skribly/issues/32)
- [#33 — Fix repository governance, proprietary-code exposure, and destructive branch automation](https://github.com/Ankit6149/skribly/issues/33)

### Canonical epic

- [#34 — Skribli production-readiness execution plan](https://github.com/Ankit6149/skribly/issues/34)

---

## 19. What to start first

Start with **#33 repository governance**, then **#14 storage safety**.

Reason:

- #33 prevents the current branch-cleanup workflow from deleting future implementation work and resolves the public/proprietary contradiction.
- #14 protects the most valuable user asset: local notes.
- #15 and #16 should begin immediately after the storage design is chosen.
- #17–#19 can proceed in parallel with clearly coordinated native interfaces.
- #20 is the first product-design task and must finish before recovery UI, API cleanup, or site redesign is finalized.

The first coding milestone should therefore be:

1. safely remove/replace destructive branch automation and protect `main`;
2. write the persistence ADR and fault-injection tests;
3. implement atomic recovery and backup handling;
4. implement single-instance ownership;
5. implement ordered editor commits and real save/error state;
6. validate the resulting build before moving to target/event/display work.
