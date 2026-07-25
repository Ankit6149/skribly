# Skribly Payments and Installer Delivery Architecture

_Last updated: July 2026_

No live payment provider is integrated yet. The landing page is intentionally payment-ready but runs in `public_release` mode until the complete server-side flow below exists.

## Objectives

- sell a one-time Windows Founder Alpha licence;
- keep payment secrets out of the browser and repository;
- verify every payment through a signed webhook;
- issue a product entitlement only after server-side verification;
- deliver the installer through a short-lived or account-bound URL when downloads become gated;
- preserve a public GitHub Release flow while Founder Alpha remains openly downloadable;
- allow the payment provider to change without redesigning the landing page.

## Current public mode

`site/commerce-config.js` uses:

```js
download.mode = 'public_release'
checkout.enabled = false
```

The website sends users to the latest public GitHub Release. No payment is implied or collected.

## Future paid mode

The frontend configuration will become:

```js
download.mode = 'checkout_gated'
checkout.enabled = true
checkout.provider = '<provider-key>'
checkout.checkoutUrl = '<hosted-checkout-url>'
checkout.entitlementApiUrl = '/api/entitlement'
```

Only public product IDs and hosted checkout URLs belong in this file. Secret keys never do.

## Recommended flow

```text
Landing page
  -> hosted checkout
  -> provider payment page
  -> success redirect with opaque checkout/session reference
  -> Skribly /download-success page
  -> POST /api/entitlement
  -> server verifies session with provider
  -> server checks webhook-confirmed payment record
  -> server creates or retrieves entitlement
  -> server returns short-lived installer URL
```

## Server-side components

### 1. Checkout session service

Creates or validates hosted checkout sessions when the chosen provider requires server-side session creation.

Inputs:
- product ID;
- price ID;
- buyer email when required;
- success URL;
- cancel URL.

Outputs:
- hosted checkout URL;
- opaque checkout/session reference.

### 2. Payment webhook

A same-origin serverless endpoint such as:

```text
/api/webhooks/payments
```

Responsibilities:
- read the raw request body;
- verify the provider signature before parsing business data;
- reject replayed webhook IDs;
- store the provider event ID;
- record payment status and amount;
- create an entitlement only for the exact expected product and paid amount;
- process refunds and chargebacks by revoking or flagging the entitlement;
- return quickly and perform email delivery asynchronously where supported.

### 3. Entitlement endpoint

A same-origin endpoint such as:

```text
POST /api/entitlement
```

Request:

```json
{
  "sessionId": "opaque-provider-session-reference",
  "productId": "skribly-founder-alpha-windows"
}
```

The endpoint must:
- validate the product ID against server configuration;
- query the provider server-to-server when necessary;
- require a paid, non-refunded payment record;
- rate-limit repeated attempts;
- never return payment details;
- return a short-lived installer URL or signed release token.

Example response:

```json
{
  "downloadUrl": "https://download.example/signed-path",
  "expiresAt": "2026-07-25T12:00:00Z"
}
```

### 4. Entitlement store

Minimum fields:

- internal entitlement ID;
- product ID;
- provider name;
- provider customer ID when available;
- provider checkout/session ID;
- provider payment ID;
- normalized buyer email hash or encrypted email;
- payment status;
- entitlement status;
- created timestamp;
- refunded or revoked timestamp;
- licence key hash when licence keys are introduced.

Do not store complete card, UPI, bank, or wallet details.

### 5. Installer storage

While downloads are public:
- GitHub Releases can host NSIS and MSI installers.

When downloads become checkout-gated:
- do not expose the gated installer as a predictable public GitHub asset;
- upload installers to private object storage or a private release channel;
- return short-lived signed URLs from `/api/entitlement`;
- keep checksums and version metadata server-side;
- preserve an emergency manual-delivery path for support.

## Payment provider adapter

Keep provider-specific logic behind an interface:

```ts
interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<PaymentEvent>;
  verifySession(sessionId: string): Promise<VerifiedPayment>;
  refund?(paymentId: string): Promise<RefundResult>;
}
```

The rest of Skribly should consume normalized values such as:

```ts
type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'chargeback' | 'failed';
```

This prevents pricing pages, entitlement logic, and installer delivery from depending directly on one provider SDK.

## Security rules

- Never place secret keys in `site/commerce-config.js`.
- Never trust price, currency, product name, or payment status sent by the browser.
- Never grant access from a success-page redirect alone.
- Verify webhook signatures using the raw request body.
- Enforce idempotency on webhook event IDs and checkout/session IDs.
- Compare the paid amount and currency to server-side product configuration.
- Use short-lived download URLs.
- Log entitlement decisions without logging sensitive payment data.
- Add rate limits to checkout creation and entitlement verification.
- Revoke access after verified refunds or chargebacks according to the published policy.

## Documents required before taking payment

- privacy policy;
- terms of use;
- Founder Alpha limitations;
- refund and cancellation policy;
- support contact that actually exists;
- business name and billing identity;
- tax and invoicing review for the launch jurisdiction.

## Activation checklist

1. Select the payment provider after checking India support, payout requirements, taxes, fees, refund support, and software-product policies.
2. Create the product and hosted checkout in test mode.
3. Implement the provider adapter server-side.
4. Implement signed webhook verification.
5. Create the entitlement store.
6. Move gated installers to private storage.
7. Implement `/api/entitlement`.
8. Test paid, failed, duplicate, refunded, and chargeback paths.
9. Publish privacy, terms, limitations, and refund policy.
10. Enable checkout only after a real end-to-end sandbox purchase succeeds.
