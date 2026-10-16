# Community development

Skribli Community source is MPL-2.0 under [LICENSING.md](LICENSING.md). This is a development edition, not an accepted public installer. Windows is the desktop target; Android remains a separate local-note foundation. Team, organization and Pro services are not implemented by this transition.

Use Node 22.23.1 / npm 10.9.8, stable Rust, Windows C++ build tools/SDK and WebView2. Install dependencies with `npm ci`. The public source build uses no production account, paid package or private signing key.

```powershell
npm ci
npm run community:validate
npm run typecheck
npm run test --workspace @skribly/desktop
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --features community -- --test-threads=1
npm run community:build
```

`community:build` pairs the Cargo `community` feature with `tauri.community.conf.json` and builds the desktop application **without bundling an installer**. It does not sign, upload or publish anything. `npm run community:dev` starts the Community development application; it uses the global shortcut and launch-at-login behavior of the desktop app, so run it only in an intentional development session. Native tests and frontend builds do not launch the application.

Community has `app.skribli.community` as its application identifier and its own data/WebView profile. The normal account-enabled configuration remains `app.skribly.desktop`. Community reads its edition from native status rather than a frontend query parameter or client role. It creates no account device claim or trial/licence file, skips sign-in setup and blocks external account endpoints in its CSP. Trial-enforced and Community compilation together are rejected. The Community status is not a paid entitlement and cannot authorize hosted services.

Both editions share the existing session instance guard/global shortcut; close the other edition before running Community. Concurrent edition operation and automatic migration of existing private-owner data are not supported. Community's launch-at-login entry is distinct. Do not copy a live WebView profile or commercial licence file into the Community profile.

Current native JSON import/export transfers text and note metadata, **not ink, attachment blobs or reminders**. A complete cross-edition backup/restore remains a release gate. Keep your original profile and use synthetic notes while evaluating the new edition. No storage migration or automatic copying occurs.

For the existing account-enabled build, keep using the normal desktop commands; its protected session, trial and server-signed entitlement checks remain. Its backend is outside the MPL grant. The no-account Community path does not change a server's authorization rules.

Build failures should be reported with the source revision, toolchain, operating system and sanitized errors. Do not attach notes, credentials, signing keys, full personal paths or licence tokens. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

Use `npm run licenses:inventory` for npm metadata. Cargo metadata can be generated with `cargo metadata --locked --format-version 1 --manifest-path apps/desktop/src-tauri/Cargo.toml` and passed to the inventory with `--cargo-metadata <file>`. Some packages for other targets may need downloading. Inventory metadata is not legal compatibility or vulnerability clearance.

Before a public binary: complete per-release third-party notices, accepted clean-profile install/upgrade/data/recovery/accessibility/performance checks, signing/distribution review, working support/privacy contacts and truthful release copy. Existing private packages are separate artifacts and do not acquire these Community changes automatically.
