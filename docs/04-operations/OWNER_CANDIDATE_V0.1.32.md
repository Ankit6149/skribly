# Skribli v0.1.32 — owner candidate

## Why this candidate exists

The owner installed v0.1.31 and, immediately after **Sign in**, saw: **“Licence activation is not enabled in this build.”** The successful-password account path obtains a Supabase session, invokes `account-session` for a signed entitlement, then sends the entitlement to native `apply_account_entitlement`. The quoted error comes from native licence verification when `SKRIBLY_LICENSE_PUBLIC_KEY` was absent at compile time. Inspection of the installed v0.1.31 executable found the error string and no verification key. The local build environment also had no such key. This is build configuration evidence, not an assumption about the owner's password or account.

The configured Supabase project `bccgutpkjxtogqbywsxr` was active. Its URL and publishable key matched the desktop client configuration, `account-session` was active, and the active server signing record supplied public verification key `mAiFdpM1Bo1Xt6-QBsORXVMRu1eGI-IWTxJZ_mj5_UY`. Only the public key is in this repository. No account, session, note, or server data was reset or deleted.

## Changes

- Enforced native builds now fail if the public verification key is missing or is not a 32-byte base64url value. The owner build script supplies the active public key and matching public Supabase connection settings. CI reads that same key file and derives the application version from the Tauri configuration.
- The actual `SkribComposer` note surface is closer to **A · Living Paper** in `site/interface-directions.html`: narrow left place tab, quiet pastel paper, writing space, Add gateway, Done action, and secondary controls in More. The original product logo, pastel theme, and selective Kalam handwriting remain. The context presence is a 14 px circle with a larger native hit area.
- The extensive prior local note, rail, account, and Windows refinements are preserved in this candidate. Neither the separate design experiment nor the website was changed for this pass.

## Verification

- The missing-key enforced `cargo check` was deliberately confirmed to fail; the same check with the active public key passed.
- Desktop frontend: 219 tests across 39 files passed before final small surface-copy adjustments; targeted Living Paper tests passed afterward. TypeScript, Vite build, Rust format check, and compact/theme/React runtime, private-artifact workflow, product truth, governance, and site validators passed.
- A 420 × 360 browser render of the actual `SkribComposer` was visually inspected with the place tab, Add, Done, circular dot, and open More panel. An initial overflow in More was corrected and re-inspected. This was a browser preview, not the Windows WebView.
- The Windows NSIS installer built from v0.1.32 with enforced entitlement and the active public key. The release executable contains that public key. The installer is unsigned (`NotSigned`).
- Native `cargo test`: 208 passed. The final full frontend rerun passed 219 tests across 39 files.

## Owner test still required

Install the candidate over v0.1.31 with the same Windows account and sign in normally. Confirm Home opens and existing notes are still present; do not reset the account or remove notes. If sign-in still fails, capture the **exact new error** and the step at which it appears. Then open both a new and existing note at small and medium size; check the left place tab, note corners, dot, Add, More, Done, typing, attachments, and reopening. Verify the context dot and note remain within the owning application while moving or resizing it. Report any visual mismatch with a screenshot of the whole note. The candidate is not a public website release or signed production package; owner sign-in, native visual, and upgrade acceptance remain open.

## Package

`C:/Users/ANKIT BHARDWAJ/Desktop/Skribli-v0.1.32/Skribli_0.1.32_x64-setup.exe`

SHA-256: `7E3894D1445561412BFD55D5AE63E301FED7BC85EB894B53D3E6B57C58575B75`

Rollback: retain the v0.1.31 installer and existing device data. This candidate does not migrate or clear notes. Downgrading after editing inline rich attachments can discard placement metadata in the older format, so preserve a backup before any downgrade.
