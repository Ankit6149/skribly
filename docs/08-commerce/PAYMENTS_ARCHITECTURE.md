# Skribly Payments, Licensing and Installer Delivery Architecture

_Last updated: July 2026_

No live payment provider or desktop licence enforcement is integrated yet.

The current website uses a controlled beta download route:

```js
download.mode = 'controlled_trial'
download.endpoint = '/api/download'
checkout.enabled = false
trial.enforcedInApp = false
```

This is a truthful beta state. It is not a paid trial and it must not be marketed as one until the desktop application enforces the trial and verifies licences.

## Commercial product

Planned personal offer:

- product ID: `skribly-personal-windows`;
- seven-day full trial without a card;
- ₹999 one-time launch price;
- permanent use of the purchased version;
- twelve months of updates included;
- optional update pass later;
- no forced subscription.

## Core principle

The installer URL is not the security boundary.

The security boundary is a signed entitlement verified by the desktop application. A copied installer must still begin a trial or require a valid licence after the trial expires.

## Current beta flow

```text
Skribly website
  -> GET /api/download
  -> server checks configured installer location
  -> direct installer redirect when available
  -> branded unavailable page when no validated installer exists
```

The public pages do not send customers to the source repository or GitHub release page.

The direct asset can temporarily be hosted by a versioned release provider, but the customer-facing route stays on the Skribly domain.

## Paid launch flow

```text
Desktop trial or Skribly website
  -> GET /api/checkout
  -> hosted Paddle checkout
  -> provider webhook arrives server-side
  -> webhook signature and product/amount are verified
  -> payment and entitlement are stored idempotently
  -> signed licence token is issued
  -> customer receives activation instructions
  -> desktop app activates and stores signed entitlement
  -> desktop app verifies signature locally
```

A checkout success redirect alone never grants a licence.

## Provider direction

Primary target: Paddle as Merchant of Record.

Domestic fallback: Razorpay when an India-first payment flow is required.

Provider-specific code must remain behind an adapter:

```ts
interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<PaymentEvent>;
  verifySession(sessionId: string): Promise<VerifiedPayment>;
  refund?(paymentId: string): Promise<RefundResult>;
}
```

Normalized payment states:

```ts
type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'chargeback' | 'failed';
```

## Required server-side components

### 1. Checkout route

Public route:

```text
GET /api/checkout
```

Current behaviour:
- redirects back to pricing when checkout is disabled;
- redirects to the configured hosted checkout URL only when the server environment contains it.

Paid behaviour:
- create or resolve a hosted checkout session;
- use server-side product and price configuration;
- never accept amount or entitlement decisions from browser input.

### 2. Payment webhook

Suggested route:

```text
POST /api/webhooks/payments
```

Responsibilities:
- read raw request bytes;
- verify provider signature;
- reject replayed event IDs;
- confirm exact product, amount and currency;
- record payment state;
- create an entitlement only after confirmed payment;
- process refunds and chargebacks;
- return quickly and perform non-essential delivery work asynchronously.

### 3. Entitlement store

Minimum fields:

- internal entitlement ID;
- product ID;
- provider;
- provider event, checkout and payment IDs;
- customer identifier;
- encrypted or hashed buyer email where required;
- payment status;
- entitlement status;
- issued timestamp;
- included-update expiry;
- device activation limit;
- refunded, revoked or chargeback timestamp.

Do not store complete card, bank, UPI or wallet credentials.

### 4. Licence issuer

The server creates canonical licence claims and signs them with a private signing key.

Example claims:

```json
{
  "licenceId": "opaque-id",
  "productId": "skribly-personal-windows",
  "issuedAt": "2026-08-01T00:00:00Z",
  "updateEntitlementUntil": "2027-08-01T00:00:00Z",
  "deviceLimit": 3,
  "status": "active"
}
```

Rules:
- signing private key exists only server-side;
- desktop app embeds only the verification public key;
- claims are versioned;
- licence status can be refreshed when online;
- offline verification remains possible;
- refunds and chargebacks are enforced according to published terms.

### 5. Device activation

Recommended model:
- up to three reasonable personal-device activations;
- device identity derived from an application-generated installation key, not invasive hardware fingerprinting;
- online activation on first licence use;
- offline grace after successful activation;
- self-service deactivate/reset path later;
- rate limits and abuse monitoring without collecting note content.

### 6. Desktop trial

Recommended trial state:
- starts after first successful native initialization;
- seven calendar days;
- full features during trial;
- warning during final two days;
- after expiry, existing notes remain readable and exportable;
- creation and editing become limited until activation;
- reinstall should not trivially reset the trial;
- trial state must not depend on an editable browser local-storage value alone.

### 7. Installer delivery

Beta:
- same-site `/api/download` route;
- direct versioned installer asset;
- branded unavailable page when no validated installer exists.

Paid launch:
- installer may remain broadly downloadable because licence activation protects use;
- source repository must be private before proprietary launch;
- alternatively, private object storage can issue short-lived installer URLs;
- checksums and release metadata should remain accessible to legitimate customers.

Do not assume hiding a GitHub URL prevents copying.

## Security rules

- Never place provider secrets in `site/commerce-config.js`.
- Never place licence signing private keys in the desktop application.
- Never trust product, amount, currency or payment status from the browser.
- Never grant a licence from the success redirect alone.
- Verify webhook signatures over the raw body.
- Make webhook and checkout handling idempotent.
- Compare paid amount and currency to server-side configuration.
- Rate-limit checkout and activation routes.
- Log entitlement decisions without logging sensitive payment data.
- Do not collect note text, attachments or window titles for licensing.
- Revoke or flag entitlements after verified refunds and chargebacks according to policy.

## Documents required before taking payment

- privacy policy;
- terms of use;
- beta and platform limitations;
- refund policy;
- support contact that actually exists;
- business/billing identity;
- tax and invoicing review.

## Activation checklist

1. Make the source repository private.
2. Finish and validate desktop trial enforcement.
3. Add local public-key licence verification.
4. Complete provider onboarding and sandbox product setup.
5. Implement checkout creation or hosted checkout redirect.
6. Implement signed webhook verification.
7. Create payment and entitlement storage.
8. Implement signed licence issuance and device activation.
9. Test paid, failed, duplicate, refunded and chargeback paths.
10. Publish terms, refund policy and real support contact.
11. Run a complete sandbox purchase and activation on a clean Windows installation.
12. Only then set `checkout.enabled = true` and `trial.enforcedInApp = true`.
