# Windows Store launch plan — India and international

**30 September 2026. Status: execution plan, not a release, tax ruling, approved price, or completed payment integration.** The owner intends to distribute the Windows app through Microsoft Store and collect payment with a separate provider. The replacement product name is undecided; domain research is paused.

## Decision that changes the release path

Microsoft Store permits non-game PC apps to use secure third-party checkout and recurring billing. Its share of transactions using the developer's own commerce is 0%; the provider still charges fees. The app must disclose the provider, pricing and trial terms, and begin browser checkout after installation. A commercial product should use a Company developer account, which requires business verification and a matching work email. The new Microsoft onboarding flow currently waives its registration fee.

**The present Tauri build cannot receive Microsoft's free signing merely by getting an EXE listing.** Tauri currently creates NSIS EXE and MSI. A Store listing for either still needs a trusted publisher signature and publisher-hosted binary. Microsoft's free signing/hosting route is a Store-submitted MSIX. Converting this app to MSIX is an engineering and Windows acceptance task: installation identity, existing local data, native overlays, foreground capture, global shortcut, tray, login startup, updates, and uninstall must be checked on the exact package. If that route fails, the fallback is a signed EXE/MSI Store listing or direct website download with its certificate cost.

Sources: [Microsoft Store policy](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies), [Store commerce](https://learn.microsoft.com/en-us/windows/apps/publish/get-started), [Store developer account](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account), [Microsoft signing comparison](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [Tauri Store guide](https://v2.tauri.app/distribute/microsoft-store/), [MSIX Packaging Tool](https://learn.microsoft.com/en-us/windows/msix/packaging-tool/create-app-package).

## Evidence at this commit

| Area | Verified in this checkout | Still needed |
| --- | --- | --- |
| Windows app | Tauri/React/Rust local text, ink, attachments, reminders, account sign-in, seven-day trial, native signed entitlements. See `README.md`. | Installed acceptance of the current desktop UI branch. The v0.1.47 owner installer predates it. Investigate rough edge-widget closing and prior `AppHangB1`. |
| Distribution | Private unsigned v0.1.47 owner NSIS candidate and hash in `docs/04-operations/OWNER_CANDIDATE_V0.1.47.md`; `apps/desktop/src-tauri/tauri.conf.json` targets NSIS/MSI. | MSIX proof, Store account/listing, Windows certification, exact-binary test, upgrade and recovery evidence. `.github/workflows/release.yml` intentionally publishes nothing. |
| Site | Encrypted owner download and pre-payment privacy page exist. `site/commerce-config.js` says `v0_owner_testing`. | New brand, truthful paid offer, support and privacy updates, approved public distribution path. Live deployment was not independently checked for this report. |
| Paid access | Supabase account service signs entitlements and has trial records. | `supabase/functions/account-session/index.ts` grants `licensed` only to `owner`; a buyer's payment cannot unlock it. `site/api/checkout.js` is only a redirect. Orders, verified webhooks, fulfilment, cancellation/refund handling, reconciliation and recovery do not exist. |
| Legal and operations | A planning GST memo and unchecked release legal checklist exist. | Actual seller identity, Store/payment KYC, CA decision, country coverage, terms/refunds/EULA/privacy, invoicing, backup, support and incident process. |

The newer UI source is on `feature/arc-66-desktop-ui-refactor` at `c8b7901`; the source/browser audit is in `docs/01-design/DESKTOP_UI_REFACTOR_AUDIT_2026-09-29.md`. No claim here means that this commit has passed installed Windows, live website, Store, or customer payment acceptance.

## Recommended offer and payment decision

The current licence contract and [28 September business plan](PUBLIC_LAUNCH_BUSINESS_PLAN_2026-09-28.md) are designed around a **one-time personal Windows licence** after a seven-day trial, with 12 months of updates. Its ₹1,499 India / US$29 elsewhere figures are research hypotheses, not posted prices. Because notes remain on one Windows device and cloud sync/mobile are not shipped, test this offer first. A monthly subscription would require a new licence contract and renewal, failed-payment, cancellation and reactivation paths; approve it only with a clearly stated recurring benefit. Do not switch an existing perpetual purchaser to recurring billing.

For India **and** international paid checkout, evaluate a single merchant of record (MoR) first, such as Paddle. It advertises seller support from India, INR/UPI for eligible Indian checkouts, one-time and subscription payments, and buyer-tax handling. Obtain account-specific written confirmation of seller acceptance, payout route, India treatment, fees, UPI eligibility, and allowed products before coding production fulfilment. A MoR handling buyer sales taxes does not decide the founder's Indian GST or income tax.

If MoR onboarding or economics fails, Razorpay is the direct-gateway candidate: start Indian KYC/domestic activation, then separately apply for international acceptance. As the direct seller, arrange country-specific indirect tax, invoices and refunds. Stripe is invite-only for new India-based accounts and cannot be the default launch dependency. Start with India plus an explicitly approved set of foreign markets; expand only when the payment route and tax treatment are confirmed. Payment provider credentials never belong in the desktop app.

Sources: [Paddle seller countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle), [Paddle UPI](https://developer.paddle.com/concepts/payment-methods/upi/), [Paddle tax](https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf), [Razorpay pricing](https://razorpay.com/pricing/), [Razorpay international approval](https://razorpay.com/learn/breaking-down-the-requirements-for-accepting-international-payments-through-razorpay/), [Stripe India availability](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india).

## Work in launch order

### 1. Decide the seller, brand and offer — before accounts or published prices

- Select and clear the replacement name, then obtain one domain and matching support/business email. Do not search for or buy domains under the taken name.
- Decide the legal seller and gather identity/business documents. Microsoft says a person publishing in relation to a trade or profession uses a Company account; confirm that the founder's actual business documents satisfy its verification. Align publisher, checkout, invoices, policies and bank details.
- Approve one-time or recurring, exact prices and currency/tax display, device count, transfer, trial, updates, expiry, refunds, cancellation, support and continued read/export access. Test prices with actual users before posting them.
- Have an Indian CA evaluate the chosen seller/provider contract, software classification, GST registration and rate, India invoices, exports, payouts, foreign remittance evidence and income tax. Do this before accepting money. The general service threshold is not a blanket exemption, and foreign buyers do not automatically make a transaction a zero-rated export.

### 2. Prove that Store MSIX works — before committing to the signing strategy

- Build an MSIX proof on a clean Windows VM with Microsoft tooling; create a test Store identity. Record source commit, package hash, manifest identity and exact Windows version.
- Install over or alongside the present owner NSIS build **without losing notes, ink, files, reminders, account state or trial state**. Verify launch at login, tray, global shortcut, foreground-window identification, overlay placement, DPI, window motion/close, notifications, read/export, upgrade, uninstall and reinstall. The package and local-data paths can differ under MSIX, so explicitly design any migration and rollback.
- Test Store update ownership; avoid competing Tauri updater and Store updater behavior. Keep a signed EXE/MSI fallback budget until MSIX and its installed runtime pass.
- Resolve the known widget closing complaint and prior hang with captured installed evidence. Pass the existing release audit and Windows acceptance gates against the exact candidate before submission.

### 3. Build commerce — only after the offer and merchant route are approved

- Host checkout with the provider in the user's browser. Authenticated server creates an order for an allowlisted price and stores account/order/provider IDs.
- Verify webhook signatures; process events idempotently and safely out of order. Issue the signed native entitlement only from a verified completed payment, never from a checkout return URL.
- Implement purchase restoration across devices, duplicate payments, refunds/chargebacks, failed renewals if recurring, cancellations, support recovery, audit logs, reconciliation alerts and a checkout kill switch. Read/export must survive licence loss.
- Test sandbox success, failure, replay, delayed capture, refund and restoration on the exact desktop build. Then test small live INR and foreign transactions where approved, their invoices, fees and payouts; refund the test purchases according to provider rules.

### 4. Finish legal, privacy and Store materials — before public availability

- Publish reviewed privacy, EULA/licence, sale terms, refund/cancellation policy, support and security contacts, third-party notices and account/data deletion instructions. Update the existing site's pre-payment privacy text to match the selected processor and real data flows.
- Apply India's current consumer, information-security and breach-response rules. Plan for the phased DPDP obligations; address under-18 customers before intentionally targeting school-age students. For the initial paid cohort, adults including college students are simpler.
- For direct international sales, review the selected countries' digital VAT/sales-tax and privacy rules. An MoR may assume buyer indirect-tax obligations under its contract; obtain the Indian CA's treatment of the seller-to-MoR transaction. Keep country evidence and records from the first sale.
- Create the Store listing with accurate screenshots, language/regions, trial/pricing range, third-party payment disclosure, privacy URL and support route. Microsoft certification, Store account verification, and payment onboarding are external gates, not code tasks.

### 5. Controlled launch and operation

- Private Store flight or limited cohort first, with owner acceptance of Store install, UI, account, checkout, entitlement, support, update and rollback. Keep the public release switch closed until this evidence is recorded.
- Enable only the countries and offer whose checkout, tax and support path have been tested. Monitor failed payments/webhooks, login/entitlement errors, crashes, refund requests and backup/restore health daily at first.
- Reconcile provider payouts with order and entitlement records and accountant records. Expand countries or introduce recurring billing only after actual conversion, support and refund data justify it.

## Lean cash budget and responsibility

| Item | Early planning treatment |
| --- | --- |
| Microsoft Store Company registration | New onboarding currently says **no registration fee**; identity/business verification and the MSIX work remain. MSIX Store signing and hosting are included if the package is accepted. |
| Domain | Wait for name selection; owner estimates about ₹1,000/year for a candidate TLD. Actual price is not checked. |
| Existing Vercel site/API | Vercel Hobby is limited to non-commercial use; Pro starts at about US$20/month. A Cloudflare Workers/Pages migration could reduce hosting cash (Workers Paid minimum US$5/month) but must be implemented/tested, especially webhooks and secrets. |
| Managed account service | Supabase Pro starts at US$25/month; Free projects can pause after low activity. Self-hosting trades this fee for VPS, backups, patching, SMTP and incident ownership. No cloud storage for note content is required for the Windows launch. |
| Payment | MoR or gateway charges per transaction, plus possible FX, disputes and refund effects. Get an account-specific quote. Store takes no share of permitted own-commerce transactions. |
| Professional and operations | CA/legal review, email, support and any taxes are real unquoted costs. Do not present the infrastructure subtotal as the full launch cost. |

An illustrative managed baseline after a Cloudflare migration is **US$30/month** (Workers Paid US$5 + Supabase Pro US$25), before domain, email, tax, provider fees, overages and professional work. Staying on Vercel Pro instead is about **US$45/month** with Supabase Pro. These are options, not a deployment decision or invoice.

Sources: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase pricing](https://supabase.com/pricing), [Supabase free pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Vercel Hobby terms](https://vercel.com/docs/plans/hobby), [Microsoft Store account](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account).

## Legal starting points for adviser review

India: [IP India trademark services](https://ipindia.gov.in/pages/e-services), [CBIC inter-state service threshold notification](https://cbic-gst.gov.in/hindi/pdf/integrated-tax/10_2017_IT.pdf), [IGST Act](https://www.indiacode.nic.in/indiacode/handle/123456789/2251), [CBIC export guidance](https://cbic-gst.gov.in/pdf/circular-cgst-125.pdf), [E-Commerce Rules](https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules_0.pdf), [DPDP commencement](https://egazette.gov.in/WriteReadData/2025/267647.pdf), [CERT-In directions](https://www.cert-in.org.in/Directions70B.jsp). International examples: [EU VAT OSS](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop/register-oss_en), [UK digital VAT](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers), [EU GDPR scope](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en).
