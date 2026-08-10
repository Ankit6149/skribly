# Private Windows installer and branding acceptance

> **Status:** this runbook is for private Founder Alpha artifacts only. Passing it does not sign,
> publish, or approve a public Skribli release. Issue #136 remains open until a corrected artifact
> is produced and inspected; #24, #25, and #78 retain the broader runtime, signing, and installer
> lifecycle gates.

## Non-negotiable branding rule

No Tauri logo may appear during installation or on any installed Windows surface. The canonical
Skribli blank folded-note logo must be used by the NSIS installer, MSI installer experience,
installed executable, Start menu and desktop shortcuts, taskbar, tray icon, uninstaller, and the
Add or Remove Programs entry. A generic, stale, blank, or Tauri icon is a failed candidate.

The automated packaging gate compares the associated icon embedded in the release executable and
NSIS installer to `apps/desktop/src-tauri/icons/icon.ico`. It also checks the product name, package
name/version, explicit NSIS installer and uninstaller bindings, canonical icon hashes, and the
required 16, 24, 32, 48, 64, and 256 pixel ICO layers. It then silently installs the NSIS package
into a clean temporary directory, requires `skribly.exe` (and rejects the `storage_acceptance.exe`
test harness), verifies that the new Start menu shortcut targets that executable, and keeps the
installed app alive for five seconds when the validation host has an interactive Windows desktop.
Hosted GitHub runners have no such desktop, so they record the payload and shortcut evidence while
the physical checks below remain mandatory. MSI and broader installed-shell surfaces still require
the physical checks below.

## Obtain and identify the candidate

1. Open the repository's **Private Windows Test Artifact** Actions workflow.
2. Enter the exact merged commit SHA as `candidate_ref` and enter
   `BUILD_PRIVATE_TEST_ARTIFACT` as the acknowledgement.
3. Download the private artifact. Do not redistribute it or create a release/tag from it.
4. Open `manifest.json` and confirm:
   - `private_test_only` is `true`;
   - `commit_sha` is the exact requested and checked-out commit;
   - `product_name` is `Skribli`;
   - `version` matches the candidate version;
   - both NSIS `.exe` and MSI `.msi` files are listed;
   - `branding.canonical_icon_sha256` matches the repository asset; and
   - `retention_days` is 14.
5. From PowerShell in the extracted artifact directory, verify each installer:

   ```powershell
   Get-FileHash -Algorithm SHA256 .\Skribli_*.exe
   Get-FileHash -Algorithm SHA256 .\Skribli_*.msi
   ```

   Each result must match the corresponding `manifest.json` installer entry. Record the exact
   commit and installer hash with every result below.

## Clean install matrix

Run both NSIS and MSI paths on a clean supported Windows profile. Remove only the prior private
test build before switching installer formats; preserve and separately back up real Skribli data.

For each format, record Windows edition/build, architecture, display scaling, installer filename,
SHA-256, source commit, version, and pass/fail evidence.

### Installation surfaces

- Explorer shows the Skribli logo for the NSIS installer executable.
- The installer window, Alt+Tab entry, and taskbar show the Skribli logo while installation runs.
- Every installer page names the product **Skribli** and shows no Tauri name or logo.
- Windows consent/security surfaces identify the unsigned private build truthfully; lack of signing
  is expected here, but Tauri branding is not.
- The MSI installer names Skribli and shows no Tauri name or logo.
- Completion actions launch Skribli, not a framework-named executable.

### Installed surfaces

- `Skribli.exe` shows the Skribli logo and product name in Explorer properties.
- Start menu and any desktop shortcut show the Skribli logo.
- The running library window and Alt+Tab/taskbar entry show the Skribli logo.
- The background tray icon is the same blank folded-note Skribli mark.
- **Add or Remove Programs** lists Skribli with the Skribli logo and correct version.
- The uninstall entry and uninstaller executable show the Skribli logo; no Tauri logo appears in
  the uninstall wizard, taskbar, or completion state.

Capture a screenshot for every distinct installer/install/uninstall surface. Any Tauri, generic,
blank, or stale icon blocks #136 and must be reported with the exact installer SHA-256.

## Founder Alpha functional smoke test

Against the same installed hash:

- launch from the Start menu and confirm the first-run guide;
- press **Ctrl + Shift + Space**, type a Skrib, choose **Done**, and confirm the editor hides;
- reopen the target and confirm the note is restored;
- open **All Skribs** from the tray and exercise search;
- move a note to Trash, restore it, then permanently delete a disposable note;
- export a portable backup and import it into a disposable test profile;
- choose **Quit Skribli** and confirm the process/tray icon exits;
- relaunch, confirm saved data, then uninstall through Add or Remove Programs.

Record failures without private note text or other sensitive content. A successful build is not a
substitute for this physical Windows evidence.

## Completion boundary

Issue #136 may close only after the exact corrected commit produces both private installers, the
workflow's manifest and branding evidence pass inspection, and the founder confirms there is no
Tauri logo on the installation surfaces. Public downloads, payments, release tags, code signing,
and updater work remain outside this private acceptance slice.
