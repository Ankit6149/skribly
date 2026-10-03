# Current Windows test strategy

This is the current test contract for the Windows owner candidate. A command passing establishes only its listed software gate; it does not establish installed Windows, installer, accessibility, or release acceptance. Record owner-run evidence in `docs/07-validation/evidence/` and the linked outcome before calling an acceptance item complete.

## Required automated gates

| Area | Command / fixture | Expected result | Evidence | Status |
| --- | --- | --- | --- | --- |
| Repository and product truth | `npm run governance:validate` and `npm run product-truth:validate` | Governance and stable current product invariants pass | CI job `Repository governance and product truth` | Automated gate |
| Website delivery and copy | `npm run site:validate` | Required site files, live Interface Lab dependencies, public truth and owner-download states pass | CI job `Landing site validation` | Automated gate |
| Required frontend lint | `npm run lint` | Desktop TS/TSX is analyzed; valid hooks pass and the controlled conditional-hook fixture fails | CI job `Cross-platform frontend checks` | Automated gate |
| Frontend types and tests | `npm run typecheck` and `npm run test` | Workspace typechecks and deterministic unit/state fixtures pass | CI job `Cross-platform frontend checks` | Automated gate |
| Production bundles | `npm run build` | Desktop and explicitly scoped workspace build/typecheck commands pass | CI job `Cross-platform frontend checks` | Automated gate |
| Rust formatting and native rules | `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check` and `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1` | Formatting is clean and native unit fixtures pass | CI jobs `Rust formatting check` and `Windows native Rust validation` | Automated gate |

## Owner Windows acceptance still required

| Area | Fixture / environment | Expected result | Evidence to retain | Status |
| --- | --- | --- | --- | --- |
| Exact candidate identity | Installed candidate manifest plus installer SHA-256 | Runtime evidence identifies the measured executable path/hash and manifest source SHA independently of checkout HEAD | Candidate manifest, checksum, and run metadata | Owner run required |
| Shortcut and target lifecycle | Supported foreground app; press `Ctrl + Shift + Space` with and without an existing active contextual note; repeat with multiple-notes preference enabled | Default reopens the stable active context note or creates one; opt-in creates another; unsupported or changed targets fail closed | Target-capture acceptance report with app/OS/build and result | Owner run required |
| Note editing and persistence | Create, edit, close, reopen; exercise note text, checklist insertion, drawing, attachment, recurring reminder, Archive, Trash and restore | Current changes persist, failed saves preserve the draft, and restore returns the same record | Exact candidate, test record, and sanitized screenshots/logs | Owner run required |
| Native composition and accessibility | Installed WebView2 on Windows; keyboard, screen reader, high contrast, reduced motion, display scale and both rail edges | Focus, transparency, sizing, state announcements, and native movement meet current contracts | Exact-binary evidence and known gaps; screenshots alone are insufficient | Owner run required |
| Installer lifecycle and recovery | Install, upgrade, repair, uninstall, data retention, rollback, crash/restart and suspend/resume | The exact candidate completes the documented lifecycle without losing local content | Installer logs, before/after hashes where applicable, and recovery evidence | Owner run required |
| Runtime resources | At least 30 minutes idle and representative interaction on the exact installed executable | CPU, memory, handle growth and thread count remain within current budgets | Runtime CSV with executable path/hash, manifest identity and elapsed duration | Owner run required |

## Golden path

Create or reopen â†’ edit and save â†’ close/hide â†’ restart â†’ reopen the same contextual note â†’ archive â†’ restore from Archive. Re-anchor remains separate planned work and is not part of this current acceptance path.

## Deferred platform and scaffold coverage

The following are future work and are not required current Windows checks: macOS/Apple Silicon, Retina, TextEdit/Finder/Safari, browser URL/DOM anchoring, extension selector/fingerprint behavior, cloud sync, and re-anchor. The Chromium workspace is a deferred typecheck-only scaffold; it does not emit a loadable extension bundle or contain a production desktop bridge. Do not describe these as passing tests until an approved implementation adds executable fixtures and platform evidence.
