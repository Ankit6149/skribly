# Skribli v0.1.52 — prepared private owner candidate

3 October 2026. **Built and locally verified; website replacement awaits owner approval of the matching backend deployment.** The live owner page still serves v0.1.51. Public release and installed acceptance remain open.

## Exact build identity

- Clean source: `62f031ab8a98018c213a777dfefe8aa2f2eac44a`, reviewed in [draft PR #275](https://github.com/Ankit6149/skribly/pull/275).
- Candidate ID: `v0.1.52-62f031ab8a98-20261003T150509842Z-fef95f8c`.
- Node 22.23.1 / npm 10.9.8; Rust/Cargo 1.95.0; storage matrix executed with portable PowerShell 7.6.6.
- Trial enforcement and existing account function/public entitlement key enabled. No private signing or licence key provisioned.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Skribli_0.1.52_x64-setup.exe` | 3,756,851 | `bfa590f9c1a5f893a9a56c0ff5e98d01b76a85adc397533853f4346bacebffb8` |
| `Skribli_0.1.52_x64_en-US.msi` | 5,005,312 | `0750275965b57d3fce9669a030d52f7430df97b9683648fde13f8c99c49e880b` |
| `skribly.exe` | 13,933,056 | `642a2cb2b19eda60df92d00561fc77aa6bcafe45e9868cd015b2f26633b9f978` |
| Staged encrypted NSIS | 3,756,903 | `530afc85446a9975a73409552f3f29e87b3d458c870967ac3119ac59f77763d0` |

Application and both installers report **NotSigned**. A package build does not remove Windows trust warnings.
The immutable manifest, branding evidence and storage evidence are retained outside source control.
The pre-focus candidate from `c8796d3` is superseded and was not published.

## What passed

All **20 required build gates** passed, including **308 desktop tests / 54 files**, lint across **147 source files** with zero warnings/errors, typecheck, production build, Rust formatting and **229 native test executions**. The feature-gated release storage binary passed **15/15 Windows crash, lock, permission, corruption and recovery scenarios** in synthetic APPDATA, including paths longer than MAX_PATH. Candidate-source CI and its separate Windows release storage run passed.

NSIS/MSI branding checks passed. Local decryption of the staged owner artifact produced the exact NSIS bytes/hash above, using the existing external owner key. The key remains outside the repository and website. No local installer was executed, and no product-site deployment or downloaded-byte proof is claimed.

## Changes and design evidence

See the [audit follow-up](../06-planning/AUDIT_REPAIR_FOLLOWUP_2026-10-03.md) and [earlier repair snapshot](../06-planning/AUDIT_REPAIR_EXECUTION_2026-10-03.md). The package includes audit source repairs, active ink flushing before native transitions, additional native worker dispatch, Windows long-path replacement, modal focus restoration, literal slash retention, image/PDF paste, formatting controls and one thin Type/Draw pill. Note handwriting remains Kalam; controls retain DM Sans. Existing uniform widget cards and app-logo sizes remain.

The deferred autofocus fix preserves focus after dismissing a dialog and focuses the editor for a different note, following the [WAI-ARIA modal dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Windows replacement uses extended paths without changing registry settings, consistent with [Microsoft's MoveFileExW documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

## Required execution before website handoff

1. Obtain the owner decision for the [prepared backend migration-then-Edge proposal](ACCOUNT_REFRESH_DEPLOYMENT_2026-10-03.md). The old boolean-only parser cannot accept the new client's null-as-unchanged consent refresh.
2. Execute only that approved scope; retain JWT verification, restricted RPC grants and existing account/trial/signing data. Record metadata checks and remaining live acceptance honestly.
3. Replace the existing private website's encrypted artifact and version/filename labels with the staged candidate. Preserve existing owner-only delivery and disabled public commerce.
4. Fetch the deployed encrypted bytes and decrypt locally; compare the installer to the immutable manifest before providing the owner download handoff.
5. The owner downloads from the website with the existing key and tests install/upgrade/retention, saving/close/Quit, ink/clipboard/IME, focus, paint/white flashes, widget motion and mixed DPI/monitors. Retain existing notes/accounts.

## Recovery and tracking

Before website replacement, production delivery remains unchanged. After publication, retain the old encrypted installer/version labels for an explicit website rollback. Backend rollback after null-sending clients are distributed must preserve null-as-unchanged consent and RPC/grant compatibility; never reset notes, accounts or trials to roll back.

Part of ARC-66. Source merge, CI and packaging do not close installed acceptance. **Linear write-back pending** because the connector requires reauthentication. Android foundation remains separate in [PR #277](https://github.com/Ankit6149/skribly/pull/277), with 17 tests and no APK yet.
