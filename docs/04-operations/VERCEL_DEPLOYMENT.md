# Vercel deployment scope and ignored builds

## Purpose

The `skribly-desktop` Vercel project hosts the public website and any deployable web/API surface. Its configured project root is `site/`. It must not consume preview builds for Rust-only desktop work, native acceptance documentation, or unrelated repository maintenance.

Vercel therefore evaluates `site/vercel.json` before a build. Its `ignoreCommand` runs:

```bash
node ../scripts/validation/vercel-ignore.mjs
```

The repository-root `vercel.json` contains the equivalent root-relative command for a reviewed future project-root change. Deterministic tests require both configurations so moving the Vercel root cannot silently disable ignored-build evaluation again.

Vercel skips a deployment when the command exits with status `0` and continues when it exits with status `1`.

## Deployable inputs

A preview or production deployment continues when at least one changed path is:

- under `site/`;
- under `api/`;
- under `public/`;
- root `package.json`;
- root `package-lock.json`;
- root `.nvmrc`;
- `scripts/validation/vercel-ignore.mjs` because it controls the provider decision;
- `site/vercel.json`;
- root `vercel.json`.

The allowlist is intentionally small and explicit. Add a path only when it is genuinely consumed by the deployed web output.

## Intentionally skipped inputs

Examples that should not consume a Vercel preview:

- `apps/desktop/**` native or desktop frontend work;
- Rust sources and Cargo-only changes;
- Windows acceptance runbooks;
- repository planning documents;
- root `README.md`;
- GitHub workflow changes that do not alter the deployed output.

These changes still run the applicable GitHub Actions checks.

## Fail-open safety

The ignored-build command continues the build when:

- `VERCEL_GIT_PREVIOUS_SHA` is unavailable;
- the previous SHA is an all-zero sentinel;
- `git diff` fails;
- `SKRIBLY_FORCE_VERCEL_BUILD=1` is present.

An uncertain comparison must spend a build rather than suppress a potentially required deployment.

## Force a preview

When an indirect dependency genuinely affects the deployed output but is not yet represented by the allowlist, set this environment variable for the deployment:

```text
SKRIBLY_FORCE_VERCEL_BUILD=1
```

Then update the allowlist and its fixtures in the same pull request so future builds do not depend on a manual override.

## Local validation

Run the deterministic policy tests:

```bash
node --test scripts/validation/vercel-ignore.test.mjs
```

Inspect a specific changed-file set using the command’s fixture mode:

```bash
node scripts/validation/vercel-ignore.mjs --paths site/index.html
node scripts/validation/vercel-ignore.mjs --paths apps/desktop/src-tauri/src/lib.rs README.md
```

The first command exits `1` to continue a Vercel build. The second exits `0` to skip it.

## Change protocol

Any change to the deployment allowlist must update together:

1. both `vercel.json` and `site/vercel.json` when invocation or project-root behavior changes;
2. `scripts/validation/vercel-ignore.mjs`;
3. `scripts/validation/vercel-ignore.test.mjs`;
4. this runbook;
5. issue or pull-request evidence explaining why the new path affects deployed output.
