# Skribli first-run and quick-guide acceptance

## Purpose

This runbook validates the account-first launch and first-Skrib guide. It exists to prevent a successful installation from appearing to do nothing, require a verified account before write access, and teach the real compact-Skrib workflow without sample data or a dense feature tour.

Parent issue 51 remains open for interactive shortcut-conflict detection, unsupported-runtime education, upgrade/interrupted-state migrations, Settings integration, complete permissions education, usability studies, and exact release-candidate evidence.

## Implemented contract

A fresh supported Windows profile must immediately receive the normal decorated **Skribli Home** window. Setup progresses through three visible stages:

1. create or sign in to a verified account and claim the server-owned account/device trial;
2. review the compact shortcut, privacy, and lifecycle guide;
3. land on the ready Home surface with trial status, **All Skribs**, and **Quick guide**.

No successful launch is allowed to depend on a hidden compact editor or tray discovery.

The guide must explain, in three scannable steps:

1. focus the application where the thought belongs;
2. press **Ctrl + Shift + Space**;
3. type and choose **Done**.

It must also state:

- Skrib content remains on the device;
- account metadata is limited to identity, trial/entitlement, app version, and update preference;
- changing account or reinstalling on the same device does not restart the device trial;
- Skribli uses limited window identity and geometry, not screen recording, for current contextual return;
- **Done** hides the editor while the background shortcut remains ready;
- **Quit Skribli** in the tray stops the process.

The guide never creates a sample Skrib, enumerates target windows, mutates Skrib storage, or persists application/document metadata.

## Versioned state model

The frontend stores only one non-sensitive onboarding record under:

```text
skribli.onboarding.v2
```

Valid states are:

- `unseen` — no valid current-version record exists; auto-show once when no higher-priority surface is active;
- `shown` — the guide was presented or dismissed; do not interrupt automatically again, but allow explicit tray reopening;
- `completed` — the user chose **Continue to Skribli home**; never downgrade to `shown`.

Malformed, incomplete, or unknown-version records fail safely to `unseen`.

## Window separation

The onboarding surface lives only in the normal Home window. The hidden compact editor remains reserved for a requested Skrib, storage recovery, native startup failure, or target-capture recovery. This prevents first-run education from competing with an active draft.

## First-run actions

### Continue to Skribli home

- write `completed` state;
- return to the ready Home surface;
- do not create a note;
- leave the tray process and shortcut ready.

### Review later

- retain `shown` rather than `completed` state;
- return to the ready Home surface;
- keep **Quick guide** available in the tray.

### Quick guide tray action

- emit the dedicated onboarding event;
- restore, show, and focus the Home window;
- show the guide inside Home;
- leave a current compact draft or recovery surface unchanged.

## Native initialization failure

When account configuration, sign-in, entitlement claim, Windows hotkey, hook, or window initialization fails, Skribli must remain visible with an actionable recovery surface. Existing local Skribs remain protected and are never overwritten by setup recovery. Native shortcut failures still provide:

- the exact safe native failure message;
- a statement that existing local Skribs remain protected;
- one primary **Retry setup** action;
- one secondary **Hide** action.

Onboarding must not appear until initialization becomes ready.

## Automated evidence

Frontend tests cover:

- fresh `unseen` state after account readiness;
- `shown` dismissal state;
- irreversible `completed` state unless the version changes;
- malformed and stale records;
- explicit tray re-entry independence from auto-show policy;
- account loading, signed-out, verification-pending, claiming, ready, and recoverable-error phases.

Rust and frontend compilation cover:

- tray event emission;
- Home-window restore/show/focus behavior;
- startup retry binding;
- local state imports and Tauri window methods.

Product-truth validation rejects:

- removal of the versioned onboarding state;
- removal of the `unseen`/`shown`/`completed` model;
- removal of the visible Home/account-first launch;
- removal of the tray quick guide;
- missing shortcut, local-first, Done/hide, or Quit guidance;
- a return to an invisible successful first launch;
- documentation that marks parent issue 51 complete.

## Physical Windows matrix

For a private Founder Alpha candidate, download the GitHub Actions artifact produced by
`Private Windows Test Artifact`, confirm its `manifest.json` `commit_sha` and SHA-256 before
installation, and record that artifact identity with every result below. This is private test
delivery only; it is not a signed public release.

Record exact commit, binary SHA-256, Windows version/build, scaling, screen-reader state, keyboard-only state, and outcome.

### Fresh profile

- remove only the onboarding key from the WebView profile;
- launch Skribli with writable empty note storage;
- confirm the guide is visible without clicking the tray;
- confirm no note or target metadata is created;
- choose **Continue to Skribli home** and confirm the ready Home surface appears;
- restart and confirm it does not interrupt automatically.

### Dismiss and reopen

- reset to `unseen`;
- choose **Review later**;
- confirm state is `shown`, not `completed`;
- reopen **Quick guide** from the tray;
- repeat after process restart.

### Priority conflicts

- open an unsaved draft, then invoke **Quick guide**;
- trigger a storage recovery notice, then invoke **Quick guide**;
- simulate native initialization failure on a fresh profile;
- trigger target-capture recovery while onboarding is eligible.

Expected: the higher-priority surface remains visible and unchanged.

### Accessibility and layout

- complete all actions with keyboard only;
- verify initial focus and visible focus indicators;
- test Narrator announcements for headings, ordered steps, shortcut, alert, and actions;
- test 100%, 150%, 200%, and Windows text-size enlargement;
- verify body scrolling without clipped footer actions;
- test high contrast/forced colors;
- test reduced motion;
- verify 320 × 280 minimum and normal compact window dimensions.

### Lifecycle wording

- choose **Done** after saving a note and confirm the process remains in the tray;
- choose **Quit Skribli** and confirm the process and shortcut stop;
- reopen the application and confirm state remains truthful.

## Completion boundary

Issue 110 may close after implementation, automated gates, and this runbook merge. Parent issue 51 remains open for broader onboarding, settings, conflict detection, migrations, permissions, studies, and signed release-binary evidence.
