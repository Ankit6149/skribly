# Skribli integration, operations and expansion plan

17 October 2026. Executor: Codex; accountable product owner: Ankit Bhardwaj. Part of ARC-66, with installed Windows acceptance under ARC-13. This is an execution proposal grounded in source at `5809a34c09175dca98fca29b0ddbaabd2c1bca05`, not proof of live integrations, legal approval or release readiness. Owner constraints: useful MPL Community core, private commercial differentiation, Android first, and **₹10,000 total for the first three months** excluding the existing computer/development subscriptions identified in the budget question. No expected revenue is needed to fund this plan.

## 1. Objective and order

Make the existing pieces operate as one understandable, recoverable product before adding more services. Keep shared code, identity, commercial entitlement, note data and release metadata distinct. A common brand or shared model does not mean two devices synchronize.

Order: reconcile contracts and costs -> prove complete local backup/restore -> accept an exact Windows candidate -> publish accurate policies/support and establish distribution -> bounded Community beta -> validate one paid Pro offer -> Android transfer/sync -> Team pilot -> Organization capabilities. Legal review and publisher verification run alongside engineering; they cannot be promised to finish on an engineering schedule.

Current source licensing is already approved. The private-repository split, production infrastructure/provider changes, final legal terms, cloud-content transfer, payment activation and public publication below are proposals with their existing decision boundaries. No new spend, account signup, deployment, repository extraction, schema change or policy publication occurs through this document.

## 2. Baseline: built, connected, accepted

| Part | Source evidence | Integration/acceptance gap |
| --- | --- | --- |
| Windows Community | Explicit native feature/config; separate profile; local writing without account; PR #299 | Clean development EXE built; no accepted signed Community installer; shared instance guard/shortcut means one edition at a time |
| Existing account-enabled Windows | Account/trial/entitlement client and native enforcement; private owner v0.1.54 package | Package predates latest source; exact installed acceptance remains open |
| Local data | Rust JSON notes plus WebView IndexedDB ink/files/reminders | No shared transaction across stores; portable JSON excludes rich content/reminders; complete backup is a launch dependency |
| Android | Separate local-note foundation; private ARM64 v0.0.2 preview; shared mobile models and encryption-envelope tests | No live desktop sync, account setup, ink/attachments or OS reminder alerts; actual-phone acceptance pending |
| Account backend | `supabase/` migrations and account-session service; no note-content sync in that flow | This inspection does not prove live deployed versions, region, billing, backup or deletion operations |
| Website | HTML/CSS/JS plus Vercel routes; encrypted owner delivery | Checkout explicitly returns 503; build-status reports CI, not product acceptance; public delivery held |
| Common packages | Shared design tokens and capability-gated mobile/sync models | Desktop and mobile storage models differ; shared types alone do not implement a migration or transport |
| Browser extension | Deferred source | No public precision anchoring or authenticated desktop bridge accepted |
| Pro / Team / Organization | [Open-core charter](../00-product/OPEN_CORE_CHARTER.md) | Product/architecture planning, not shipped services |

Evidence: [Community guide](../../COMMUNITY.md), [open-core register](OPEN_CORE_EXECUTION_2026-10-17.md), [private package record](../04-operations/OWNER_PLATFORM_REFRESH_2026-10-12.md), [Android README](../../apps/android/README.md), [account service](../../supabase/functions/account-session/README.md), [checkout](../../site/api/checkout.js), [CI status endpoint](../../site/api/build-status.js). Runtime claims need exact-artifact evidence; no production account rows or secrets were inspected.

## 3. Sources of truth and working rhythm

| Information | Canonical owner/location | Update trigger |
| --- | --- | --- |
| Product boundaries and exclusions | Owner; charter and decision log | Approved capability/business change |
| Current navigation | `docs/current/README.md` | New or superseded current contract |
| Implemented contracts | Versioned schemas/interfaces, code and meaningful tests | Every affected change |
| Work and acceptance | Existing Linear outcome; linked GitHub PR | Meaningful execution and actual acceptance |
| Binary identity and availability | Proposed reviewed release record, described below | Each candidate/promotion/withdrawal |
| Privacy/terms | Owner-approved versioned legal source, reviewed by appropriate professional | Actual data/processor/territory/offer change |
| Money | Owner's private expense/subscription ledger | Purchase, renewal, usage bill, payout, refund |

Use one active engineering work package at a time for this solo-founder budget. Start each work session from the latest execution report, end it with changed/verified/unverified/next evidence, and keep an existing outcome open until its user outcome is accepted. Do not create a new Linear issue for every PR or copy the full backlog between systems.

Weekly owner review: remaining cash and next renewals; current candidate/known failures; security/support queue; next work package. Mark decisions Accepted, Proposed, Implemented or Accepted-on-device explicitly. Use Impeccable and the [UX principle matrix](../01-design/UX_PRINCIPLES_REVIEW_2026-10-16.md) for every subsequent UI change; shared appearance does not require copying platform-specific layouts.

## 4. Public/private code and keeping changes aligned

Proposed starting layout: retain the existing public Community repository and create **one private commercial repository**, with commercial modules, service code, website/delivery and private operational records together initially. Repository names are not reserved or created. Avoid a third repository until separate team permissions or deployments justify it.

- Community owns reusable core behavior and public contracts; commercial code consumes a pinned Community tag/commit/package version. Do not maintain a permanently divergent copy of the whole app or depend on a moving `main`.
- Separate modules implement Pro features through explicit interfaces. Public code must build/test without private dependencies, credentials or registry access. Client feature visibility is not server authorization.
- Public core fixes land once and are consumed by a private dependency-update PR. Private-only fixes stay private; modifications to MPL-covered files retain applicable source obligations on distribution. DCO is not copyright assignment.
- Private compatibility CI should exercise the pinned core and proposed updates against supported APIs, old fixtures and both edition configurations. Publish the corresponding covered source/notices with each distributed combined binary. Cross-repository orchestration is not implemented yet.
- Do not place proprietary implementations under the current Community-covered roots; use the [licensing map](../../licensing-map.json). Public visibility and proprietary licensing are different.

Extraction sequence: inventory deployment/config dependencies -> establish private repo/access/backups -> reproduce builds and previews against the pinned core -> validate account, webhook and delivery contracts -> deliberately cut over external repo/root references -> validate -> remove only redundant current public copies in a separate reviewed change. Preserve a rollback reference. Do not move `site/` or `supabase/` merely to tidy directories: external deployment settings may depend on them.

Previously public history remains exposed; deleting a current file or making a repo private does not undo copies or MPL grants. Any confirmed exposed secret needs rotation, not just deletion. A full history/IP/secret audit is still outstanding; this plan does not allege a credential leak.

## 5. Integration contracts and connectivity

| Connection | Required contract and proof before enabling |
| --- | --- |
| Desktop UI -> native core | Typed commands/events; native edition, persistence and context authority; recoverable errors; unknown state fails safely |
| Desktop -> Android | Versioned portable content model and capability matrix; explicit text/ink/file/reminder conversion; preserve unsupported data or reject clearly; round-trip fixtures before transport |
| Local stores -> backup | Consistent cross-store snapshot/revision strategy; manifest, lengths/hashes, schema versions, recovery journal and atomic staging/rollback semantics; an export is complete only when restoration proves it |
| Account -> service | Versioned authenticated API; expiry, refresh, revocation, timeout/offline behavior; keep protected sessions and native checks; no Community bypass grants hosted access |
| Checkout -> entitlement | Provider signature verification, server idempotency, transaction ledger, replay/out-of-order handling, refund/revocation and reconciliation; never trust a success redirect |
| App -> downloads/support/legal | Stable links and edition/version-specific policies; allowed URL handling; reachable contact; no note content in support URLs |
| Build -> website | Accepted release record drives availability; failed/missing/unaccepted candidate disables downloads; successful CI alone never means ready |
| Later shared workspace -> server | Tenant membership and operation authorization on every request; scoped files/links; deny cross-tenant reads/writes; audit tests |

There are three separate meanings of synchronization: **code consistency** through pinned contracts/CI, **release consistency** through artifact records, and **user-data sync**, which is deferred. They must not share an ambiguous Done status.

The backup design must specify stable note/attachment/reminder IDs and relationships, rich text, strokes, file bytes and placement/rotation, colour/font metadata, Archive/Trash state and reminder recurrence/time-zone behavior. Exclude authentication sessions, trial/device claims and signing material. Specify backup confidentiality separately; no encrypted-backup claim exists yet. Treat imports as untrusted: bounded sizes/counts, safe paths, integrity/schema checks, non-mutating preview, conflict decisions and a verified rollback snapshot. Test source edits during export, missing blobs, insufficient disk, cancellation/crash and repeated restore without duplicate reminders. Do not present copying a live WebView profile as a portable backup.

Future data sync needs its own approved ADR: key creation/distribution/recovery, device trust/revocation, attachment transport, offline queues, deterministic conflicts, deletion tombstones, replay/rollback resistance, interrupted transfers and recovery. AES-GCM envelope tests are not a complete end-to-end encryption system. Run a two-device synthetic-data pilot before touching user content. Store OAuth/session/entitlement metadata separately from note ciphertext.

## 6. Release alignment and environments

First implement a small reviewed release record rather than a new dashboard. Proposed fields: edition/platform/channel, app version, source commit, core/module/API versions, data/backup schema compatibility, build job, exact package filename/bytes/SHA256, signing identity/status, source/notices location, installed acceptance evidence, known limits, policy versions, support URL, approval and availability/withdrawal status. The schema and consumers remain to be built; existing private manifests are evidence inputs, not automatic public promotion.

Keep development, synthetic-data staging and production separated by configuration, keys and resource identity. Community local beta should not require running paid service environments. Never copy production user data into tests. Inventory current hosting resources, regions, external repo/root references, permissions, billing owners and renewals privately; this pass has not inspected those accounts.

Promotion: reviewed PR and compatible fixtures -> build once -> identify/hash/sign exact artifact as applicable -> install/upgrade/recovery acceptance -> verify website/legal/support match -> explicit owner release decision -> enable only that accepted channel. An installer replacement or re-sign changes artifact identity and needs the relevant verification again. Keep rollback packages and schema compatibility records; a rollback must not open a newer data schema destructively.

Rollback by layer: withdraw download link; restore prior website release record; revert API/function only with schema compatibility; forward-fix irreversible migrations; preserve data/backup evidence. Test one withdrawn/corrupt/mismatched artifact scenario. Automatic updater and signed update-metadata verification remain a separate design gate. The current production-hold workflow remains unchanged.

## 7. Privacy and legal work: evidence before wording

Build a data register first. Each row records field/category, purpose, source/action, local/server location, recipient/provider, account/edition applicability, lawful basis/consent where applicable, retention and deletion, backup expiry, access controls, user-rights handling, evidence and reviewer. Unknown values remain Unknown, not invented promises.

Initial rows: note text/ink/files/reminders; app/window titles and paths; account email/IDs/session/device claim/entitlements; website IP and access/security logs; support tickets/attachments; optional marketing consent; future payment/customer records. Community no-account behavior is distinct from an account-enabled edition. Hosting providers may process website metadata even when notes stay local.

| Document/process | Required content/evidence | Gate and owner |
| --- | --- | --- |
| Privacy notice and data register | Edition-specific flows, identity/contact, providers/transfers, retention/deletion, rights, child policy, website logs and optional collection | Before relevant public collection; owner facts + privacy counsel review |
| Community licence/notices | Exact MPL source location, upstream notices and branding boundaries | Before binary distribution; maintainer review, legal advice where unresolved |
| Product/service terms | Actual seller, supported territories, supported edition, use/support/update limits; preserve Community source rights | Before relevant public service; owner + counsel |
| Pro sale/refund/cancellation terms | Exact offer, taxes, renewal/cancellation, refund and loss-of-entitlement behavior; access to existing local notes preserved | Before payment activation; owner + counsel/provider |
| Tax/invoices and records | Seller form, state, domestic/export classification, registrations, invoice/payout/refund records | Before taking money; Indian CA |
| Security disclosure and response | Working private channel, responsible maintainer, triage, restricted evidence and tested incident actions | Before public binary/service; owner + technical review |
| Team DPA/subprocessor terms | Controller/processor roles, customer instructions, deletion/export, subprocessors/transfers, incident obligations and support | Before hosted Team data; counsel + technical proof |

Separate local deletion, account deletion, payment record retention and support-ticket deletion. Confirm identity before account requests without demanding note content. Retention needs actual configured periods and backup expiry, not blanket instant-deletion wording. Test a synthetic account request from intake through authentication revocation, device claims/entitlements, retained lawful records and response. Local notes must not disappear just because an account ends.

The existing `site/privacy.html` account-required wording needs Community scope clarification before a Community public listing. Its under-13 statement does not establish an adequate age/consent policy for every country. Do not replace it with an invented age threshold: choose territories/audience and obtain applicability review. Final notices and terms are not drafted/published by this plan.

India's DPDP commencement is staged under the November 2025 notifications, rather than a single all-obligations-in-force date. Add a jurisdiction/effective-date register and legal recheck before launch and expansion; the one-year and eighteen-month stages require particular review. GDPR can apply to relevant offers/monitoring involving people in the EU even for a non-EU business and even without payment. Assess actual targeting and processing; do not claim that being free/local-first removes all obligations. CERT-In incident/reporting/log requirements need an applicability and deadline assessment for the actual operator/services. Preserve minimum lawful security evidence without enabling content surveillance. These are review tasks, not legal conclusions for Skribli.

## 8. Security and operational readiness

Use a scoped threat model and applicable OWASP ASVS controls for account/web services; include native IPC/local-storage threats separately. Maintain a control/evidence register, not a generic compliance badge.

Before public beta: dependency and full-history/asset review; sanitization of rich text/attachments; path/type/size validation; Tauri command/capability/CSP review; safe external links; local backup corruption/future-schema tests; metadata-redacted diagnostics; private vulnerability reporting/contact verification; maintainers' MFA and least privilege; no fork PR access to secrets; exact-artifact provenance/signing review. Inventory encryption boundaries honestly: Windows-protected sessions do not imply encrypted note storage.

Before online accounts/paid services: credential inventory and rotation/revocation procedure, server-only privileged keys, authorization/RLS checks, request throttling and abuse budget, session replay/expiry tests, secure webhook secrets, restore drill for service data, provider outage/offline tests and deletion runbook. Before Team: automated cross-tenant tests, scoped attachment access, membership revocation/offboarding, audit integrity, recovery and key-sharing review. Certifications and independent audits are not claimed.

Incident runbook: disable affected release/service access -> preserve restricted, redacted evidence -> assess scope and applicable legal/provider deadlines immediately -> rotate/revoke affected credentials -> fix and verify -> notify through approved channels when required -> restore and review. Assign Ankit as initial accountable contact; do not advertise a staffed 24/7 SLA. Do not wait for a weekly meeting to assess a suspected breach.

Operational checks: verify support/security inbox delivery and reply path; test one recovery and one incident tabletop; maintain known-issues/support versions; bound request/file/log retention and usage; monitor aggregate availability/error rates without collecting note content. Disclose and approve any later telemetry before adding it. Monthly restore/security/dependency review, plus immediate review for relevant vulnerabilities or data/provider changes.

## 9. Three-month cash plan

| Allocation | Ceiling | Condition |
| --- | ---: | --- |
| One ordinary domain, first year | ₹1,500 | Check name/trademark conflict, actual checkout and renewal; no premium purchase |
| Website/email/operational extras, all three months | ₹500 | Prefer bounded free/static options; review existing hosting bills first |
| Initial Indian CA consultation | ₹2,000 | Obtain quote; allowance is not a full legal/accounting/registration package |
| Uncommitted reserve | ₹6,000 | Remains cash, not a requirement to spend |
| Total | **₹10,000** | Assumes zero revenue; no new commitment exceeding available cash |

Record existing project hosting/service charges before committing anything: the budget question excluded existing computer/development subscriptions, not automatically every infrastructure bill. Do not cancel a live critical resource blindly. Ledger fields: vendor/resource, purpose, owner, currency/tax, paid date, recurring/annual/usage basis, renewal/cancellation date, cap/alerts, remaining committed cost and receipt. Keep financial and identity records private.

Current published comparison: ordinary Cloudflare `.com` $10.46/year; Vercel Pro starts $20/month; Supabase Pro starts $25/month. The latter pair is $45/month before taxes/overages and does not fit this lean plan comfortably. Vercel Hobby is non-commercial/personal only. A static Cloudflare route is a candidate requiring site/API verification, not a completed free migration. Community local use does not need a cloud note database.

Microsoft Store MSIX is the first signing/distribution route to evaluate within budget; free account creation does not eliminate publisher verification or packaging/acceptance work. Confirm commercial account/document eligibility. India is excluded from current Azure Public Trust signing jurisdictions; private trust is not a consumer substitute. Direct certificate total cost/eligibility is unknown; no purchase is budgeted. Google Play's $25 registration, paid signing, advertisements, new AI tools, company incorporation services and paid cloud sync are deferred until separately justified. No claim is made that every professional/public-launch expense fits ₹10,000.

Paid stage economics must include taxes, fees, refunds, payout timing, support and recurring resources. Evaluate one provider after seller/KYC approval; gateway and merchant-of-record responsibilities differ. Standard advertised examples are Razorpay 2% + GST and Paddle 5% + $0.50; verify applicable method/territory and low-order-value terms. No forecast revenue, donations, grant or customer commitment is assumed. If required compliance/distribution costs exceed the cap, keep the affected launch stage closed rather than spending the reserve on unrelated features.

Before hosted expansion, calculate an explicit low/expected/high usage budget: active accounts, storage per account including versions/backups, attachment download traffic, database/API calls, email/notification volume, monitoring, support time and abuse exposure. Set enforceable quotas and alerts; an alert alone is not a hard billing cap. Fund operations through the pilot even if no new sales arrive. Do not sell unlimited lifetime hosted storage or an enterprise SLA without the operating capacity to deliver it.

## 10. Work packages and exit evidence

Sequence uses one developer, not invented parallel staff. Durations and launch date remain uncommitted until scope, owner test availability and external verifications are known.

| Order | Package | Deliverable / exit evidence | Dependency and responsible party |
| --- | --- | --- | --- |
| P0 | Reconcile product, deployment and spend facts | One capability matrix; website/privacy/architecture drift recorded; privately verified environment/vendor/billing inventory; ranked blockers | Start now; Codex source analysis, Ankit account facts |
| P1 | Protect and connect local data | Approved backup/restore ADR; complete rich-content snapshot and round-trip into clean profile; interrupted/corrupt/future-version/rollback tests | P0; Codex implementation, Ankit installed acceptance |
| P2 | Prove exact Windows Community candidate | Built artifact record, profile/startup/hotkey/focus/DPI/accessibility/performance/install/upgrade/recovery acceptance | P1 plus ARC-13; Codex build/evidence, Ankit physical test |
| P3 | Legal/support/distribution readiness | Reviewed data register/notices/terms/contact, upstream notices/provenance, verified publisher route and affordable cost; exact package acceptance | Start fact gathering alongside P1; owner + relevant professionals/providers |
| P4 | Bounded Community beta | Accepted release record, accurate site/download/support, rollback drill and owner publication decision; feedback from actual users | P2 and relevant P3 requirements; no automatic launch |
| P5 | One paid Pro experiment | Evidence of willingness to pay; separately authored module; approved seller/provider/terms; successful payment/refund/reconciliation/downgrade tests | P4 stability + separate paid gates; no collecting money early |
| P6 | Android companion | Real-phone baseline, portable model adapter and explicit transfer; then separately approved encrypted-sync pilot | P1; no Android parity/notification/sync claims ahead of proof |
| P7 | Team pilot | Validated customer use case/budget; tenant permissions/invites/sharing/offboarding, DPA and isolation/recovery tests | P5 viability + funded service operation |
| P8 | Organization expansion | Procurement-led identity/governance/deployment/audit/support commitments and sustainable pricing | Successful Team pilot; no speculative enterprise rebuild |

Next execution proposal: **P0 reconciliation and P1 backup/restore design**, with P3 factual data inventory in the same evidence trail. Do not begin with team sync, a payment button, a broad visual redesign or moving every folder. Reconcile the drift before claiming the parts are unified.

## 11. Known drift and unresolved decisions

| Finding at inspected source | Treatment |
| --- | --- |
| Repository governance still said wholly proprietary/not open source | Corrected in this planning PR to the already-approved scoped MPL posture |
| Architecture text still mentions five pastels/retired surface descriptions; site README forbids current widget/source links and names v0.1.53 | Record and reconcile against current code/interaction specification in P0; not silently declared fixed here |
| Privacy notice requires an account without edition qualification | P3 reviewed edition-specific correction before Community public publication |
| Historical launch plans discuss older names/artifacts and account-only assumptions | Preserve as dated context; this plan/charter and exact package record take precedence for their scopes |
| Private commercial repository, pinned-core pipeline and release record | Proposed; not created/implemented |
| Actual publisher/seller, launch territories/age policy, domain and contacts | Owner facts still needed; no fabricated contact, company or availability |
| Existing subscription bills, professional quotes and direct signing cost | Unknown; inspect/quote before commitment |

Stop conditions for a stage: data loss/unrecoverable save; unknown artifact identity; unresolved relevant security defect; missing required publisher/legal/provider acceptance; unclear supported-user/territory terms; cost beyond available cash. Keep working on independent documentation/testing while external decisions are pending. Do not mark ARC-66 complete merely because this plan or a source PR is merged.

## 12. References and review status

Internal current authorities: [index](../current/README.md), [licensing](../../LICENSING.md), [charter](../00-product/OPEN_CORE_CHARTER.md), [edition ADR](../02-engineering/ADR-0005-community-commercial-editions.md), [privacy/security requirements](../04-legal-privacy/PRIVACY_AND_SECURITY.md), [paid review holds](../04-legal-privacy/RELEASE_LEGAL_CHECKLIST.md), [repository governance](REPOSITORY_GOVERNANCE.md), [private Windows acceptance](../04-operations/PRIVATE_WINDOWS_TEST_ACCEPTANCE.md). Existing legal holds remain effective; this document adds neither approval nor a completed professional review.

Primary sources consulted 17 October 2026:

- [Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) — file-level obligations and larger works; the actual licence controls.
- [MeitY DPDP Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) and [DPDP Rules notification](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) — staged commencement; counsel must check later amendments/corrigenda and actual launch applicability.
- [European Commission GDPR scope](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en) — territorial/processing analysis, including relevant free offerings.
- [CERT-In directions and FAQs](https://www.cert-in.org.in/Directions70B.jsp) — applicability/deadline review; index search was available but direct documents could not be fetched in this pass, so no complete legal review is claimed.
- [OWASP ASVS](https://owasp.org/projects/asvs) — applicable web/service verification controls, not certification.
- [Cloudflare domain pricing](https://pricing.registrar.cloudflare.com/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Vercel pricing](https://vercel.com/pricing), [Hobby limits](https://vercel.com/docs/plans/hobby), [Supabase pricing](https://supabase.com/pricing) — advertised rates/limits, not account billing evidence.
- [Microsoft publisher onboarding](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account?tabs=individual), [Tauri MSIX guide](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri), [Azure signing eligibility](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) — external verification and exact-package acceptance remain.
- [Razorpay fees](https://razorpay.com/pricing/) and [Paddle fees](https://www.paddle.com/pricing) — advertised examples; no merchant account acceptance or professional tax determination.

Verification of this plan: source/document inspection, primary-source research, local link checks and repository/product-truth validators. No application code, live resource, final legal copy, public channel, credential or customer record changed. No new app/browser/phone runtime acceptance was performed.
