# Windows candidate provenance

These scripts preserve the existing private owner build boundary. They do not publish, sign, install, or accept a public release. Running the builder is an owner action; editing/testing the helpers does not authorize a build.

## Owner builder

From an approved, clean checkout on Windows, using Node 22.23.1 and npm 10.9.8:

```powershell
./scripts/windows/build-owner-installer.ps1 -SourceCommit <approved-full-40-character-sha> -Acknowledgement BUILD_PRIVATE_OWNER_CANDIDATE
```

The requested SHA must equal HEAD. Dirty tracked/untracked files, unsupported toolchain versions, local Vite env files, and unapproved build flags stop the builder before packaging. It runs locked dependency installation, repository/product/site/private-artifact/runtime/theme/compact/lint/type/test/build gates, full native formatting/tests, trial-enforced checking, provenance regressions, NSIS/MSI builds, and package-branding checks. Each gate's successful command, exit code, and UTC duration is recorded; source cleanliness and HEAD are rechecked around gates.

Outputs go into a unique candidate directory. An explicit `-OutputDirectory` must not exist. File copying and the final manifest use no-overwrite operations. A partial directory without a committed manifest is an incomplete candidate; do not use it as delivery evidence. Preserve it for diagnosis rather than silently replacing it. A repeated same-version build creates a separate identity.

The manifest records approved commit/tree, lock hash, toolchain, gate results, application/installer hashes and sizes, observed Authenticode states, and remaining acceptance. The copied application binary is included so installed process evidence can be compared to its exact hash. The manifest is local provenance, not a cryptographically signed attestation or proof that the installer embeds the expected executable. Owner install/upgrade/uninstall/data retention/rollback must confirm those same hashes. Signing/trust and distribution approval remain separate gates.

Local validation of this repair used synthetic fixtures only. The current development environment's Node 22.18.0 / npm 11.6.1 is deliberately rejected by the owner builder. No supported-toolchain candidate, installer, or signing operation has been executed as part of this repair.

## Runtime evidence

Select a specific process when more than one name matches, and provide the candidate manifest when available:

```powershell
./scripts/windows/capture-runtime-evidence.ps1 -ProcessId <pid> -CandidateManifestPath <candidate-directory/manifest.json> -OutputPath <new-local-evidence.csv>
```

The CSV records executable path, SHA-256, size, PID/start time, measured duration, candidate manifest/hash, and measured source identity. `CheckoutCommitSha` is independent context. Without a matching application hash in a valid manifest, measured source stays `unknown`; an older installed application never inherits a newer checkout's source SHA. A malformed or mismatched supplied manifest fails rather than silently asserting identity. Process reuse, path changes, or a changed executable at the end reject capture. Existing evidence paths are not overwritten.

The identity status `local-manifest-hash-match` means a supplied local manifest matches the measured application file; it is not signature validation. Keep evidence local: executable/manifest paths can include a Windows username. Share sanitized summaries rather than raw CSVs in public tracking. Capture covers the selected parent process only, excluding WebView child processes. The default 60 samples at 10 seconds is approximately 10 minutes, not the full runtime acceptance duration; registry scale is context, not per-monitor DPI proof.

## Safe regression check

```powershell
powershell.exe -NoProfile -File scripts/windows/candidate-provenance.test.ps1
```

Tests create non-executable synthetic files under a verified TEMP directory. They reject mismatched/future manifests, wrong/dirty source, unsupported tooling, failed gates, and evidence overwrites. They never inspect a founder process, execute an installer, sign, publish, or mutate a live backend.

Rollback: revert these script changes if required, while preserving all generated candidate/evidence directories. Reverting removes the new safety gates and must not be treated as approval to reuse mutable or unattributed evidence.
