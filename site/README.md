# Skribly Landing Site

This directory contains the public Skribly product website.

It is intentionally plain HTML, CSS, and JavaScript so the desktop workspace, package lock, and Tauri build remain independent.

## Local preview

From the repository root:

```powershell
python -m http.server 4173 --directory site
```

Then open:

```text
http://localhost:4173
```

Do not open `index.html` directly from the filesystem when testing redirects or the future entitlement endpoint.

## Vercel deployment

Create a Vercel project from the same GitHub repository and set:

- **Root Directory:** `site`
- **Framework Preset:** Other
- **Build Command:** leave empty
- **Output Directory:** `.`
- **Install Command:** leave empty

`site/vercel.json` supplies security headers and clean URLs.

## Public installer downloads

The current site uses:

```js
download.mode = 'public_release'
```

Every download button links to:

```text
https://github.com/Ankit6149/skribly/releases/latest
```

The workflow `.github/workflows/release.yml` publishes NSIS and MSI files when a version tag such as `v0.1.0` is pushed.

Before publishing a tag:

1. confirm the exact commit passes CI;
2. run the Windows runtime acceptance test;
3. install and uninstall both installer formats;
4. update version numbers consistently;
5. create and push the version tag.

## Future paid checkout

All public checkout configuration lives in:

```text
site/commerce-config.js
```

The payment and entitlement architecture is documented in:

```text
docs/08-commerce/PAYMENTS_ARCHITECTURE.md
```

Do not put provider secrets in the site directory.

Paid mode must not be enabled until:

- a server-side checkout or hosted checkout exists;
- signed webhooks are verified;
- an entitlement store exists;
- `/api/entitlement` verifies the payment server-to-server;
- gated installers are stored privately;
- privacy, terms, limitations, and refund documents are published;
- a real sandbox purchase and refund flow passes end to end.

## Product copy constraints

Keep claims honest:

- Windows Founder Alpha, not production-ready software;
- mixed-DPI multi-monitor support is experimental;
- no macOS download until a real macOS build exists;
- no cloud-sync claim;
- no claim that source-code implementation equals Windows runtime proof;
- local-first attachments currently belong to the local WebView profile.
