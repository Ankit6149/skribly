# Skribli Landing Site

This directory contains the Skribli product website. It uses plain HTML, CSS, JavaScript, and Vercel serverless routes so it remains independent from the Tauri desktop build.

## Current state

Skribli is in **Windows release-candidate validation**. Public installer access is disabled.

- Every visible download control is disabled and states that downloads are unavailable.
- `/api/download` redirects to `/download-unavailable?reason=validation` and never resolves a release asset.
- The landing demonstration shows only the implemented compact editor workflow.
- The site must not advertise floating dots, attached tabs, checklists, persistent widgets, full-screen overlays, or selective click-through as current behavior.
- No customer journey should send visitors to the source repository or a release file.

## Current product contract

1. Focus a supported Windows application.
2. Press `Ctrl + Shift + Space`.
3. Skribli validates the foreground target and creates or reopens the deterministic contextual note.
4. Write in the compact editor.
5. Choose Done, Escape, Ctrl+Enter, or close.
6. Skribli saves text and rich content, then folds the active note into a movable dot. An untouched empty note is discarded.

The background process remains in the tray. Nothing from the note remains floating after the editor hides.

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

1. the exact release executable opens quietly without a terminal window;
2. shortcut capture, deterministic create/reopen, save, close, hide, and quit behavior pass physical Windows checks;
3. the canonical note lifecycle and non-floating All Skribs recovery/library are complete;
4. reversible trash, restore, export/import, read-only access, and data cleanup are tested;
5. installer build, install, upgrade, repair, uninstall, rollback, icon, and signing checks pass;
6. accessibility, display scaling, suspend/resume, Remote Desktop, interruption, and long-session matrices pass;
7. the website, development notes, privacy policy, support information, compatibility statement, checksum, and binary all describe the same exact build.

Configuration lives in `site/commerce-config.js`. Never place provider secrets or release credentials in the site directory.
