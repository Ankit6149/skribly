# Skribli public launch and business plan — 28 September 2026

**Status:** execution proposal, not an approved price, merchant, legal position, or release decision. This document describes a Windows-first launch for students and working professionals in India and internationally. Mobile is a separate product track; no mobile capability or release date is promised here.

## Recommendation in one page

1. Continue the private, invitation-only Windows alpha while the redesigned desktop app and the exact installed binary are accepted. The v0.1.47 owner download is already private and its installer is unsigned. The existing owner key is not a public access-control system.
2. Keep the existing website truthful while `/api/download` and checkout remain disabled. Because the owner reports the current name is taken, defer a new branded waitlist campaign until the replacement name is selected and cleared. A free public beta is a distinct later decision, after the public-installer gates below pass.
3. Test a **one-time personal Windows licence**, not a monthly subscription, for the initial local-first product. Proposed research prices are **₹1,499 in India** and **US$29 internationally**, with a seven-day trial and 12 months of updates. Test student affordability before committing to a separate discount. These are hypotheses, not posted offers.
4. For India and international buyers together, evaluate one merchant of record (MoR) first, with Paddle as the candidate. Obtain written confirmation of Indian seller onboarding, payout route, fees, INR/UPI checkout, contract and tax treatment. If it cannot serve the actual business, consider Razorpay for India and defer international paid checkout until the cross-border route is approved. Do not install two processors merely to get an early checkout button.
5. Keep card entry with the payment provider. The marketing site, entitlement API and verified payment webhook may share one domain and hosting project; a separate owned payment server or domain is not required. A reviewed custom brand domain is advisable before commerce.

The [release audit](FULL_PRODUCT_AUDIT_AND_EXECUTION_PLAN.md), [release legal checklist](../04-legal-privacy/RELEASE_LEGAL_CHECKLIST.md), [current owner candidate](../04-operations/OWNER_CANDIDATE_V0.1.47.md), and [India tax working notes](../03-business/INDIA_GST_TAX_NOTES.md) remain the repository's detailed execution context. The owner and qualified advisers must approve the relevant commercial and legal choices.

## Current product and launch reality

| Area | Confirmed in repository | Consequence |
| --- | --- | --- |
| Desktop | Windows Tauri app with local text/ink/attachments/reminders, recovery flows, and account sign-in. Native portable JSON export/import currently omits ink, attachment blobs, and reminders. Mobile and sync are deferred. | Market Windows capabilities actually present in the release binary. Do not promise complete backup, mobile, cloud backup or multi-device notes. |
| Access | Seven-day server-owned account/device trial and signed native entitlements. Expiry preserves read/export access. | A licence policy must preserve users' access to their local data. |
| Paid licence | `supabase/functions/account-session/index.ts` currently issues the perpetual `licensed` grant only to the `owner` role. Other verified accounts receive a trial grant. The native verifier requires a personal licence to be perpetual and carries `updatesUntil`. | A successful payment today would **not** unlock a buyer. Paid fulfilment, transfers, refunds, expiry/update semantics and recovery must be built and tested. |
| Checkout | `site/api/checkout.js` is an environment-URL redirect, with no allowlist, orders, verified webhooks, reconciliation or fulfilment. The site has no current pricing offer. | Do not point it at a live processor or treat a return-page visit as proof of payment. |
| Distribution | v0.1.47 is a private, unsigned NSIS owner installer. Public download and payment are intentionally disabled. | A website download is not release acceptance. Sign and test the exact public artifact first. |
| Data | Skrib content is local; the account service stores account/trial/entitlement metadata. | No note-content cloud storage is needed for the Windows launch. Revise privacy disclosures only for actual new data flows. |

The one-time purchase model in [the decision log](DECISION_LOG.md) is explicitly a **hypothesis**. No published consumer price or paid licence promise has been approved.

## Three distinct launch decisions

| Stage | Earliest defensible action | Gate |
| --- | --- | --- |
| Private alpha | Invite named testers to a limited pre-release, capture consent and issue-specific feedback. Preserve user data on upgrade. | Owner acceptance of a specific installer hash and a safe invitation/access method. Do not reuse the shared owner key as a general public gate. |
| Free public Windows beta or trial | Make one stable installer publicly available with accurate known limitations, access duration, and support/withdrawal process. | The exact-binary Windows, security, accessibility, signing, installer and legal baseline below; decide whether the existing seven-day trial or a separately implemented beta grant governs write access. |
| Paid Windows launch | Offer checkout and automatically grant/restore the advertised licence. | All public-download gates **plus** merchant/tax/legal approval and sandbox-tested order-to-entitlement lifecycle. |

No calendar launch date is supportable until the installed Windows tests and signing path pass. The existing website can describe the current product while downloads and payments stay off; new promotion should wait for the naming decision.

## Prioritized public-download gates

The canonical public gate is [§16 of the release audit](FULL_PRODUCT_AUDIT_AND_EXECUTION_PLAN.md#16-public-download-gono-go-gate) and [GitHub issue #34](https://github.com/Ankit6149/skribly/issues/34). In practical execution order:

1. **Freeze a candidate and test it on real Windows.** Exercise the exact installer hash across supported Windows builds, Chrome and other target apps, keyboard/mouse/touch, mixed DPI and monitor topology, accessibility, suspend/resume, long idle sessions, shortcut conflicts, and the edge widget. Resolve the reported closing motion and any reproducible hang or data-loss defect. Record the owner-observed result, not just CI status. [#24](https://github.com/Ankit6149/skribly/issues/24), [#17](https://github.com/Ankit6149/skribly/issues/17), [#19](https://github.com/Ankit6149/skribly/issues/19).
2. **Prove lifecycle and recovery.** Install, upgrade, repair, uninstall and rollback with existing accounts, text, ink, files and reminders. Test failed saves, interrupted writes, read-only licence mode, export/import and orphaned attachment handling. The [documented portable export limit](../04-operations/PORTABLE_IMPORT_KNOWN_LIMITATIONS.md) means a full-content backup/recovery contract is still needed for ink, attachments and reminders, or the public offer must state exactly what cannot be restored. No open P0 or unresolved migration/data-loss risk. [#20](https://github.com/Ankit6149/skribly/issues/20), [#21](https://github.com/Ankit6149/skribly/issues/21), [#15](https://github.com/Ankit6149/skribly/issues/15).
3. **Build a trusted release chain.** Sign executable and installer with an eligible trusted identity; retain source commit, CI run, build provenance, hashes and immutable release manifest. Make public download resolve only the allowlisted stable artifact. Rehearse withdrawal and rollback. [#25](https://github.com/Ankit6149/skribly/issues/25). Microsoft says unsigned direct installers draw strong SmartScreen warnings, while even newly signed files can initially lack reputation ([SmartScreen guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)).
4. **Make site and support statements true.** Match the public site's demo, FAQ, privacy page, release notes, compatibility, checksum, support route and screenshots to that candidate. Finish keyboard/screen-reader checks, dependency notices, vulnerability contact, data inventory and incident response. [#26](https://github.com/Ankit6149/skribly/issues/26), [#29](https://github.com/Ankit6149/skribly/issues/29), [#31](https://github.com/Ankit6149/skribly/issues/31), [#32](https://github.com/Ankit6149/skribly/issues/32).

The repository's generic legal checklist mentions Apple signing. That item belongs to a later macOS release, not this Windows gate.

## Additional gates before the first payment

1. **Approve the offer:** customer identity, price/currency/tax display, personal versus business use, device limit, transfer/reset rules, perpetual-use boundary, included update period, renewal/major-version treatment, trial outcome, refund window, cancellation/support route, and continued read/export access.
2. **Approve the merchant and tax model:** the real legal seller, business/KYC documents, Indian GST classification and registration, invoices and credit notes, international buyer taxes, export/payout records and income-tax bookkeeping. The [India working memo](../03-business/INDIA_GST_TAX_NOTES.md) assumes Delhi and lists questions for a Chartered Accountant; it is not a tax ruling. Confirm the owner's actual residence/entity and target countries.
3. **Complete policies and brand:** the owner says the current name is taken, so choose and clear a replacement name before a domain or customer-facing email. Then publish reviewed privacy, end-user licence, terms of sale and refund policy, third-party notices, support and vulnerability contact. The current [site privacy policy](../../site/privacy.html) describes a pre-payment build and must be updated when actual payment/customer data flows are known. [IP India's trademark search](https://ipindia.gov.in/pages/e-services) is a starting check, not a legal opinion.
4. **Build the complete purchase state machine:** authenticated checkout intent tied to account and price; allowlisted provider; server-side order record; verified, idempotent webhook; entitlement issuance by a protected signer; native claim/refresh; duplicate/late/out-of-order events; refund/chargeback revocation policy; device transfer; customer recovery; invoices/receipts; reconciliation and alerts. Test sandbox success, failure, refund and replay against the exact Windows build before switching production on. [#27](https://github.com/Ankit6149/skribly/issues/27), [#28](https://github.com/Ankit6149/skribly/issues/28).
5. **Control production:** least-privilege credentials, separate sandbox/production secrets, key rotation and backup, webhook failure queue, manual support tool with audit trail, finance reconciliation, and a checkout kill switch. No private signing key or customer record belongs in the public repository or site bundle.

## Pricing hypothesis and evidence

**Proposed research offer:** one personal Windows licence after the existing seven-day trial, with a target **₹1,499 total buyer price in India** and **US$29 before any checkout-calculated buyer tax internationally**. The Indian tax inclusion, merchant model and resulting margin require CA/provider approval before any price is advertised. The executable version purchased would remain usable after the 12-month included update period, subject to a clearly stated device/transfer and support policy. A later major upgrade could be optional and paid; do not silently switch a perpetual purchaser to a subscription. A verified student coupon may be tested if interviews reveal a meaningful affordability barrier. A single first offer is simpler to explain and fulfil for both students and working professionals.

| Published reference, checked 28 September 2026 | Current advertised offer | Relevance and limit |
| --- | --- | --- |
| [Notezilla](https://www.conceptworld.com/Notezilla/BuyNow) | $29.95 one time for Windows without sync; $19.95/year plus $10 first year for its sync plan. | Closest Windows sticky-note licence anchor; Skribli's contextual workflow differs. |
| [UpNote](https://getupnote.com/) | $1.99/month or $39.99 lifetime Premium with cross-device sync. | Affordability anchor, but includes multiple platforms and sync Skribli does not offer. |
| [Obsidian](https://obsidian.md/pricing) | Local app free; optional Sync $4/month annual billing or $5 monthly. | Shows that recurring money is easier to explain for a hosted service than for local-only notes. |
| [Bear](https://bear.app/faq/features-and-price-of-bear-pro/) | $2.99/month or $29.99/year Pro with iCloud sync, on Apple platforms. | Design-oriented note-app anchor, but not a Windows substitute. |

These are **verified competitor offers**, not evidence that Skribli buyers accept the proposed price. Before publishing, interview/observe roughly 20–30 students and working professionals in both India and international markets; ask them to use the real installer for a week and compare purchase intent at two or three price points. Record trial-to-active, active-to-pay, refund, support burden and reasons for refusal. Do not present interview intent as actual conversion.

**Monthly decision:** defer. A local-only single-platform application has limited ongoing server cost per user, and the current entitlement contract is perpetual. Subscription billing adds renewal, failed-payment, cancellation, tax and reactivation work. Reassess an optional recurring tier only if mobile/cloud sync or collaboration ships with a clear continuing benefit and measured costs. Do not promise those future features to sell today's Windows licence.

## Payment provider and licensing architecture

**First evaluation:** one MoR for India and international checkout if Indian seller onboarding and payouts pass. [Paddle's published rate](https://www.paddle.com/pricing) is **5% + US$0.50 per checkout**, with no platform monthly fee. It says it calculates/remits buyer sales tax and invoices as MoR ([Paddle tax explanation](https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf)); [INR UPI checkout has specific conditions](https://developer.paddle.com/concepts/payment-methods/upi/). Obtain provider confirmation for this founder's business form, India payout currency/FX/fees, cash timing, refund/dispute rules, approved selling domain, and supported one-time desktop software. Paddle documents a [minimum $100 payout threshold and monthly payout schedule](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid). MoR handling of buyer tax does **not** answer the Indian seller's income tax, export, GST on seller-to-MoR supply, or foreign-remittance documentation; the CA must evaluate the actual contract.

**Fallback:** [Razorpay publishes 2% plus GST for common domestic payment methods](https://razorpay.com/pricing/) and supports [recurring payments](https://razorpay.com/subscriptions/) if ever needed. A direct Indian payment gateway makes Skribli the seller responsible for applicable buyer tax/invoicing/refunds. Assess international acceptance, export and settlement separately; defer international paid checkout if the route is not approved. [Stripe India is invitation only](https://support.stripe.com/questions/india-faq?locale=en-GB), so it is not a dependable immediate default. Running MoR and domestic direct checkout together would create two legal/tax/entitlement flows and should need a demonstrated benefit.

**Domain and server:** there is no legal or technical rule that card payment must use a second domain or separate owned server. The simplest architecture is:

```text
Skribli site / signed Windows app
    -> authenticated purchase request on Skribli's server
    -> provider-hosted checkout (card/UPI entered only with provider)
    -> provider-signed webhook to Skribli's server
    -> verified, idempotent order record and signed entitlement
    -> Windows app refreshes grant for that account/device
```

The checkout return URL is display-only; it must never grant a licence. The provider's hosted page may use its own domain, while the checkout request and webhook can live under one eventual product domain (or an `api.` subdomain) with separate server-side credentials. The [PCI Security Standards Council](https://www.pcisecuritystandards.org/faqs/1439/) says a fully outsourced provider redirect can qualify for SAQ A when **all** criteria are met, and the merchant-controlled redirect mechanism still needs protection. [Paddle requires approval of the selling domain](https://www.paddle.com/help/start/account-verification/what-is-domain-verification). Have the processor/acquirer confirm the actual PCI scope; owning a separate domain does not by itself reduce it.

**Licence design proposal:** one named account, perhaps two concurrent personal devices if usability testing supports it, with secure self-service device replacement and a support recovery path. This is **not implemented or approved**. Define what happens after prolonged offline use, refunds, fraud, compromised keys, business use and expiry of included updates. A customer must always be able to read and export local Skribs after trial or write entitlement ends. Payment and licensing state should reside in a protected account database; Skrib content stays on the Windows device.

## Minimal infrastructure and first-year budget

| Item | Recommended timing | Public provider price or budget treatment |
| --- | --- | --- |
| Brand domain and email identity | Wait for the owner to select and clear a replacement name; then decide before provider domain verification/paid launch. | [Cloudflare Registrar charges the registry list price without markup](https://developers.cloudflare.com/registrar/account-options/renew-domains/); actual TLD availability and annual registration/renewal must be quoted after the name decision. No specific domain is assumed available. |
| Marketing site/API | Existing Vercel project. Upgrade to a commercial plan when the site becomes a commercial operation. | [Vercel Hobby is non-commercial; Pro developer seat is $20/month](https://vercel.com/pricing), plus usage/tax. Confirm the actual account's plan and spend limits. |
| Account, entitlement, order records | Continue the existing Supabase stack, with production ownership, backup and operational controls. | [Supabase Pro starts at $25/month](https://supabase.com/pricing). Free projects can pause after inactivity, so free is not a sensible paid-production assumption. Scale/overage and email delivery are additional. |
| Note content storage | Keep local in Windows v1. | No Cloudflare/Supabase note bucket is needed. The mobile/sync design requires a separate privacy, encryption, recovery and cost decision. |
| Public installer storage | Keep a signed allowlisted artifact and verified manifest. Move to object storage when traffic/operational needs justify it. | [Cloudflare R2 Standard has 10 GB-month, 1M Class A and 10M Class B operations free monthly; then $0.015/GB-month and no R2 egress charge](https://developers.cloudflare.com/r2/pricing/). This excludes other service costs. The current ~3.6 MB private asset alone does not require R2. |
| Windows signing | Required before direct public NSIS distribution, or assess a tested Store MSIX route. | [Microsoft estimates OV certificates at $150–300/year](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), worldwide. Azure Artifact Signing starts near $9.99/month but currently excludes India-based individuals and organizations. Microsoft Store MSIX signing is free, but switching packaging needs separate compatibility testing. |
| Commerce | Only after paid-flow gate. | [Paddle 5% + $0.50/checkout](https://www.paddle.com/pricing) if approved, or [Razorpay's domestic 2% + GST](https://razorpay.com/pricing/) plus Skribli's own tax/invoice operations. Refunds, disputes, FX and payout charges can add cost. |
| Professional and operating work | Before first paid order. | CA and legal review, third-party notices, customer support, transactional email, monitoring, security response, and any marketing spend need quotes. They are **not** included in the infrastructure baseline. |

The owner reports that Skribli is already taken and intends to choose a new name. Pause domain research, registration, customer-facing email setup, and provider domain verification until that name is selected and cleared. No candidate domain was reserved or purchased.

At the stated entry plans, **Vercel Pro + Supabase Pro ≈ US$45/month**, before overages and taxes. Adding a worldwide OV certificate gives a rough **US$690–840 first-year baseline** (`12 × $45 + $150–300`), **plus** domain, email, CA/legal, support, traffic, payments and tax. This is a planning range, not a quote. There is no financial reason to add cloud note storage or a second payment server for Windows v1.

### Illustrative per-sale contribution, not a tax calculation

For a **₹1,499 Indian direct sale** *if* the approved legal route requires **18% GST included** in that sticker price, the pre-GST amount is `1499 / 1.18 = ₹1,270.34`. At a hypothetical domestic [Razorpay 2% gateway fee plus 18% GST on that fee](https://razorpay.com/solutions/e-commerce/), the payment charge is about **₹35.38** on ₹1,499. Reserve an illustrative **5% of pre-GST revenue (₹63.52)** for refunds. This leaves **about ₹1,171.44 expected contribution per order** before support time, customer acquisition, hosting, income tax and any input-tax-credit adjustment. The actual tax base, registration and recoverability of fee GST need CA review; an MoR sale has a different calculation.

For a **US$29 international sale** at Paddle's headline 5% + $0.50, the fee is **$1.95**, leaving **$27.05 before buyer tax treatment, FX/payout cost, refunds, support and customer acquisition**. Paddle's contract and checkout settings determine the real remittance. Revenue per sale is not profit; monitor paid conversion, retention, refunds, support hours and acquisition cost against these assumptions.

## Owner decisions required before commercial implementation

1. Confirm the founder's actual legal residence/entity and authorize a CA to review **both Indian and international** flows, including MoR seller-to-provider documentation, GST/exports, invoices, refunds, payout records and income tax. The repository's Delhi assumption must be checked.
2. Approve or revise the licence hypothesis: one time versus recurring; price/currencies; student offer; permitted devices and transfer; perpetual use, 12-month updates, major upgrades, trial and refunds.
3. Choose whether to seek MoR onboarding first. Confirm provider acceptance and the real payout economics before writing production checkout.
4. Choose and clear the replacement product name, then decide on a matching domain at a reviewed price and establish support/security and transactional email identities.
5. Choose direct signed NSIS versus a separately validated Microsoft Store MSIX path; budget signing and release operations.
6. Define the first private tester cohort and acceptance threshold; decide separately when the exact build may become a free public beta and, later, paid.

Mobile planning can proceed in parallel as discovery and architecture. A mobile product must define what “same Skribs” means across devices, whether cloud sync is opt-in, encryption and key recovery, attachment storage, offline/conflict behavior, mobile-store policy and its own pricing effect. It should not hold the Windows-only private alpha hostage, and it should not be described as available in the first paid Windows offer.

## Source and change policy

Provider prices, eligibility, tax rules and platform policies above were checked against linked **primary** sources on 28 September 2026 and may change. Recheck them immediately before purchasing or publishing prices. Legal and tax examples are questions for the owner's qualified Indian and international advisers, not determinations. This proposal makes no change to the current public-download or checkout controls.
