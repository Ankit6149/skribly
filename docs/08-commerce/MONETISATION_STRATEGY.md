# Skribly Monetisation Strategy

_Last updated: July 2026_

## Decision

Skribly Personal for Windows will use:

- a seven-day full trial;
- no card required to start the trial;
- a ₹999 one-time launch licence;
- a planned ₹1,499 standard price after early validation;
- permanent use of the purchased version;
- twelve months of feature and maintenance updates;
- an optional ₹499 update pass after the included update period;
- no forced monthly subscription.

The current Windows beta remains free until licence activation, checkout, refund handling and installer validation pass end to end.

## Why this model

Skribly is a desktop productivity utility. People need to experience the overlay, note dots and application-context behaviour before deciding whether it fits their workflow. A full trial removes that uncertainty without making the entire commercial product permanently free.

A one-time licence matches user expectations for a local-first utility better than an immediate subscription. The optional update pass allows continued development revenue without disabling the version a customer already purchased.

## Funnel

### Stage 1 — validated free beta

Goal:
- prove the native Windows interaction;
- observe whether users create and return to contextual notes;
- collect bug reports and workflow feedback.

Rules:
- call it a beta, not a paid trial;
- do not claim licence enforcement exists;
- distribute through the same-site `/api/download` route;
- do not expose the source repository as the customer journey;
- keep the repository private before treating the application as proprietary paid software.

Target cohort:
- 20–50 invited or organically acquired Windows testers.

Exit criteria:
- stable installer;
- reliable shortcut, click-through and context lifecycle;
- clear onboarding;
- repeat usage from at least a meaningful subset of testers;
- licence activation tested offline and online.

### Stage 2 — paid personal launch

Offer:
- seven-day full trial;
- ₹999 one-time launch price;
- one Windows user;
- reasonable personal-device allowance;
- permanent access to the purchased version;
- twelve months of updates;
- local-first operation after activation with an offline grace model.

The trial begins in the desktop app on first successful launch. Reinstalling must not trivially reset the trial; trial state should be tied to a locally signed installation identity and optionally checked against the entitlement service when online.

### Stage 3 — standard personal price

After product reliability and demand are validated:
- raise the personal licence to ₹1,499;
- preserve the terms of existing buyers;
- offer the optional update pass only when a meaningful new version exists;
- do not manufacture annual renewals without delivering continued value.

### Stage 4 — team edition

Only after the personal product is stable:
- team purchase and central billing;
- shared annotation packs or templates;
- controlled export/import;
- admin deployment options;
- per-seat or small-team pricing.

Do not build team features before individual retention exists.

## Revenue reality

At ₹999 gross per personal licence:
- 14 sales produce ₹13,986 gross revenue;
- 25 sales produce ₹24,975 gross revenue;
- 50 sales produce ₹49,950 gross revenue.

Payment fees, taxes, refunds, currency conversion and support costs reduce net revenue. These figures are gross planning numbers, not guaranteed income.

## Installer versus licence

Hiding a public repository link is good customer experience, but it is not a licence system.

The correct commercial protection is:

```text
public or controlled installer
  -> desktop app starts full trial
  -> customer purchases licence
  -> signed entitlement is issued
  -> desktop app verifies entitlement
  -> app continues working after trial
```

A public installer can still be commercially viable because the useful product is gated by licence activation. Conversely, a private installer without in-app enforcement can be copied after one purchase.

Before paid launch:
- make the GitHub source repository private;
- keep customer downloads on the Skribly domain;
- use a signed licence token;
- verify the signature locally;
- support offline use after successful activation;
- allow a limited number of personal-device activations;
- provide a documented deactivate/reset process;
- do not require the app to contact the licence server for every launch.

## Payment provider direction

Primary target: Paddle as Merchant of Record for the global paid launch.

Reasons:
- designed for digital software products;
- supports one-time purchases;
- handles tax collection and remittance as Merchant of Record;
- supports localized pricing and payment methods;
- reduces the founder's immediate international tax and invoicing burden.

Domestic fallback: Razorpay for India-first sales if Merchant-of-Record onboarding is unavailable or unsuitable.

Do not activate either provider until:
- business and payout identity are ready;
- sandbox checkout succeeds;
- webhook signatures are verified;
- refund and chargeback events update entitlements;
- privacy, terms, refund policy and support contact are published.

## Licence architecture

Minimum signed licence claims:

```json
{
  "licenceId": "opaque-id",
  "productId": "skribly-personal-windows",
  "customerId": "opaque-provider-customer-id",
  "issuedAt": "ISO timestamp",
  "updateEntitlementUntil": "ISO timestamp",
  "deviceLimit": 3,
  "status": "active"
}
```

The server signs the canonical claims with a private key. The desktop application contains only the public verification key.

The desktop app must never contain:
- payment-provider secret keys;
- the licence signing private key;
- a hard-coded bypass code;
- trust in an unsigned browser success redirect.

## Trial behaviour

Recommended trial:
- seven calendar days after first successful app initialization;
- every core feature available;
- no card required;
- persistent reminder during the final two days;
- after expiry, notes remain readable and exportable;
- creation/editing becomes limited until activation;
- never hold a user's existing notes hostage.

This read-only-after-expiry model demonstrates value while reducing fear of data loss.

## Metrics worth collecting

Only after an explicit privacy decision, collect minimal product events such as:
- install completed;
- onboarding completed;
- first note created;
- note reopened on a later day;
- trial started;
- checkout opened;
- licence activated;
- uninstall feedback submitted.

Do not collect note text, attachment contents, window titles or application names by default.

## Launch gate

Paid launch remains blocked until all are true:

- Windows runtime gate passes;
- signed installer or clear unsigned-beta disclosure;
- trial enforcement exists in the desktop app;
- licence activation works online and offline;
- repository is private;
- payment sandbox purchase succeeds;
- signed webhook creates the correct entitlement;
- refund revokes or flags entitlement correctly;
- privacy policy, terms and refund policy are published;
- real support contact exists;
- installer download is delivered through the Skribly website;
- pricing copy matches actual behaviour.
