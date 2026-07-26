# Skribli Landing Site

This directory contains the Skribli product website. It uses plain HTML, CSS, JavaScript, and Vercel serverless routes so it remains independent from the Tauri desktop build.

## Current state

Skribli is in **active production development**. Installer access is disabled.

- Every visible download control is rendered as disabled.
- `/api/download` redirects to `/download-unavailable?reason=production` and never resolves a release asset.
- The status page explains why the previous beta was withdrawn.
- No customer journey should send visitors to the source repository or a release file.

## Local preview

From the repository root:

```powershell
python -m http.server 4173 --directory site
```

Then open `http://localhost:4173`.

Serverless routes require a Vercel preview or local Vercel runtime; a plain static server cannot execute `/api/*` handlers.

## Vercel deployment

Create a Vercel project from the same repository and set:

- **Root Directory:** `site`
- **Framework Preset:** Other
- **Build Command:** leave empty
- **Output Directory:** `.`
- **Install Command:** leave empty

`site/vercel.json` supplies security headers and clean URLs.

## Re-enabling downloads later

Do not restore installer delivery until all of the following are true:

1. the release executable opens without a terminal window;
2. empty overlay space remains click-through on Windows 10 and 11;
3. `Ctrl + Shift + Space` attaches exactly one note to the foreground app;
4. Show, Hide, Quit, save, close, and delete behaviour pass runtime checks;
5. the approved icon is regenerated into every Tauri bundle size;
6. CI, installer build, install, upgrade, and uninstall tests pass;
7. the website copy, release notes, privacy page, and checksum match the exact build.

Configuration lives in `site/commerce-config.js`. Never place provider secrets or release credentials in the site directory.
