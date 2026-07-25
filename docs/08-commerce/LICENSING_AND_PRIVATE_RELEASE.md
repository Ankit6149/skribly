# Skribly Licensing and Private Release

_Last updated: 25 July 2026_

## Commercial model

Skribly's planned personal Windows offer is:

- seven-day full trial;
- no card required for the trial;
- ₹999 one-time launch price;
- planned ₹1,499 standard price;
- permanent use of the purchased version;
- twelve months of feature and maintenance updates;
- optional ₹499 update pass after the included update period;
- no forced monthly subscription.

Paid checkout remains disabled until the enforced build, entitlement delivery, refund flow, legal pages and installer hosting have all passed validation.

## Current beta

The public Windows beta is intentionally compiled with:

```text
SKRIBLY_TRIAL_ENFORCED=0
```

In this mode:

- all application features remain available;
- no activation key is required;
- no trial clock starts;
- no payment is accepted;
- the site downloads the current beta from `/api/download`.

## Paid trial build

The paid build is compiled with:

```text
SKRIBLY_TRIAL_ENFORCED=1
SKRIBLY_LICENSE_PUBLIC_KEY=<base64url Ed25519 public key>
```

`SKRIBLY_LICENSE_PUBLIC_KEY` is a public verification key. It is safe to embed in the desktop binary.

The private Ed25519 signing key must never be committed, embedded in the app, placed in Vercel public configuration, or added to a client-side bundle.

The release workflow fails when trial enforcement is enabled without a public verification key.

## Trial behaviour

When enforcement is enabled:

1. The trial starts when Skribly first initializes its local licence state.
2. The start and expiry timestamps are written atomically to `license.json` beside local note storage.
3. The trial lasts seven calendar days.
4. A small remaining-days button opens licence activation during the trial.
5. After expiry, existing notes and attachments remain readable.
6. Creating, editing, moving, resizing, recolouring, collapsing and deleting notes becomes unavailable.
7. Attachment creation and deletion becomes unavailable.
8. Users can continue in read-only mode or activate a licence.
9. A backwards system-clock movement beyond the tolerance places the app in read-only clock-error mode.

The licence gate does not delete or encrypt user notes.

## Device-bound activation

Each installation creates a local device identifier.

A licence token contains:

```json
{
  "productId": "skribly-personal-windows",
  "licenseId": "unique entitlement ID",
  "email": "customer@example.com",
  "deviceId": "SKR-...",
  "issuedAt": 0,
  "updatesUntil": 0,
  "perpetual": true
}
```

The UTF-8 JSON payload is signed with Ed25519. The desktop accepts only a token whose:

- signature matches the embedded public key;
- product ID matches Skribly;
- device ID matches the local installation;
- issue time is not in the future;
- perpetual flag is true.

Token format:

```text
base64url(payload-json).base64url(ed25519-signature)
```

## Generate signing keys

Run on a trusted offline or secured machine:

```powershell
npm run license:keypair
```

Generated files:

```text
signing/skribly-license-private.pem
signing/skribly-license-public.txt
```

The entire `signing/` directory is ignored by Git.

Store the private PEM in the payment/licence backend secret store and an encrypted offline backup.

Add only the public value to the GitHub Actions secret:

```text
SKRIBLY_LICENSE_PUBLIC_KEY
```

Set the GitHub Actions repository variable only when an enforced release is intentionally being built:

```text
SKRIBLY_TRIAL_ENFORCED=1
```

Leave it unset or set to `0` for free beta builds.

## Issue a licence manually

Before checkout automation exists, a signed device-bound licence can be issued from a secured machine:

```powershell
npm run license:issue -- customer@example.com SKR-DEVICE-ID 2027-07-25
```

The command prints the signed token. Never send the private key to the customer.

Manual issuance is suitable only for internal validation and a very small controlled tester group.

## Payment integration

The production payment flow should be:

1. Customer completes hosted checkout.
2. Payment provider sends a signed server-to-server webhook.
3. Backend validates the webhook signature and payment status.
4. Backend creates or updates an entitlement record.
5. Customer enters or confirms the Skribly device ID.
6. Backend signs a device-bound licence token using the private Ed25519 key.
7. Customer receives the token through the success page and email.
8. Refund or chargeback revokes future token issuance and update entitlement according to the published terms.

The frontend must never decide that a payment succeeded based only on a query parameter or browser redirect.

## Repository privacy and installer hosting

The repository currently remains public because `/api/download` redirects to a public GitHub Release asset.

Making the repository private before moving the installer will break public downloads.

Required order:

1. Upload the validated installer and checksum to independent public delivery storage such as Cloudflare R2, Amazon S3, Vercel Blob or payment-provider fulfilment.
2. Configure `SKRIBLY_TRIAL_DOWNLOAD_URL` in Vercel to the new installer URL.
3. Verify `https://skribly-desktop.vercel.app/api/download` returns the installer without GitHub authentication.
4. Update checksum and release-note links when necessary.
5. Change the GitHub repository visibility to private.
6. Verify the website, download, Vercel deployment and private-repository CI integration again.

Do not make the repository private while the public installer still depends on GitHub Releases.

## Release versioning

The current public asset is beta `v0.1.0`.

Do not silently replace a released binary with different bytes under the same version after users may have downloaded it. The next validated binary containing the restored generated icons and licence architecture should be published as `v0.1.1` unless there is objective evidence that `v0.1.0` has never been distributed.

Every public build must include:

- NSIS installer;
- MSI installer;
- SHA-256 checksum file;
- exact release notes;
- correct Skribly icon generated from `assets/branding/skribly-app-icon.svg`;
- explicit beta or enforced-trial build mode.
