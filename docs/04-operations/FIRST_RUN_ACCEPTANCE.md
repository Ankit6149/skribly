# Skribli first-run and quick-guide acceptance

## Purpose

This runbook validates the first-note onboarding slice implemented for issue 110. It exists to prevent a successful installation from appearing to do nothing and to teach the real compact-note workflow without a wizard, account prompt, sample data, or dense feature tour.

Parent issue 51 remains open for interactive shortcut-conflict detection, unsupported-runtime education, upgrade/interrupted-state migrations, Settings integration, complete permissions education, usability studies, and exact release-candidate evidence.

## Implemented contract

A fresh supported Windows profile must receive one compact visible guide after native initialization and local storage loading succeed.

The guide must explain, in three scannable steps:

1. focus the application where the thought belongs;
2. press **Ctrl + Shift + Space**;
3. type and choose **Done**.

It must also state:

- notes remain on the device;
- Skribli uses limited window identity and geometry, not screen recording, for current contextual return;
- **Done** hides the editor while the background shortcut remains ready;
- **Quit Skribli** in the tray stops the process.

The guide never creates a sample note, enumerates target windows, mutates note storage, or persists application/document metadata.

## Versioned state model

The frontend stores only one non-sensitive onboarding record under:

```text
skribli.onboarding.v1
```

Valid states are:

- `unseen` — no valid current-version record exists; auto-show once when no higher-priority surface is active;
- `shown` — the guide was presented or dismissed; do not interrupt automatically again, but allow explicit tray reopening;
- `completed` — the user chose **Start using Skribli**; never downgrade to `shown`.

Malformed, incomplete, or unknown-version records fail safely to `unseen`.

## Compact-window decision hierarchy

Exactly one primary surface may occupy the main window. Automated tests pin this order:

1. active composer/draft;
2. storage recovery;
3. native startup failure;
4. target-capture recovery;
5. onboarding;
6. empty hidden window.

Onboarding must never replace an active draft, hide a storage fault, or mask a native shortcut failure.

## First-run actions

### Start using Skribli

- write `completed` state;
- hide the guide;
- do not create a note;
- leave the tray process and shortcut ready.

### Maybe later

- retain `shown` rather than `completed` state;
- hide the guide;
- keep **Quick guide** available in the tray.

### Quick guide tray action

- emit the dedicated onboarding event;
- center and show the compact window;
- focus the guide when no higher-priority surface is active;
- preserve a current draft or recovery surface instead of replacing it.

## Native initialization failure

When required Windows hotkey, hook, or window initialization fails and no draft/recovery surface is active, Skribli must show a compact alert with:

- the exact safe native failure message;
- a statement that existing local notes remain protected;
- one primary **Retry setup** action;
- one secondary **Hide** action.

Onboarding must not appear until initialization becomes ready.

## Automated evidence

Frontend tests cover:

- fresh `unseen` state;
- `shown` dismissal state;
- irreversible `completed` state unless the version changes;
- malformed and stale records;
- explicit tray re-entry independence from auto-show policy;
- composer, recovery, startup-failure, capture-error, onboarding, and empty surface priority.

Rust and frontend compilation cover:

- tray event emission;
- main-window center/show/focus behavior;
- startup retry binding;
- local state imports and Tauri window methods.

Product-truth validation rejects:

- removal of the versioned onboarding state;
- removal of the `unseen`/`shown`/`completed` model;
- removal of the tested surface hierarchy;
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
- choose **Start using Skribli** and confirm the window hides;
- restart and confirm it does not interrupt automatically.

### Dismiss and reopen

- reset to `unseen`;
- choose **Maybe later**;
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
