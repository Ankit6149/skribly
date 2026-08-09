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

## First preview on a branch

Vercel does not provide `VERCEL_GIT_PREVIOUS_SHA` until a branch has a successful
deployment. For the first preview on a non-production branch, the command compares
the candidate tree with the repository's `main` tree. Vercel's clone does not retain
an `origin` remote, so the command fetches the `main` tip with depth one from the
repository's read-only public GitHub URL when its dedicated remote-tracking ref is
not present. Comparing the two trees captures the branch's complete web difference
even when several commits were pushed before the first preview.

This fallback is preview-only. It never substitutes the current `main` tree as its
own production baseline.

## Fail-open safety

The ignored-build command still continues the build when:

- `VERCEL_GIT_PREVIOUS_SHA` is unavailable on `main` or in production;
- the previous SHA is an all-zero sentinel and no safe preview baseline resolves;
- the current branch name is unavailable;
- the repository `main` tree cannot be resolved or fetched for a first preview;
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

## Fresh-branch acceptance protocol

The first-preview fallback must be verified against Vercel after any change to its
comparison logic. Create a new branch from the tested `main` commit, publish exactly
one commit that changes only a path from the intentionally skipped list, and open a
pull request without adding a deployable web change.

Acceptance requires all of the following evidence from that first provider
evaluation:

- the deployment is canceled by Vercel's Ignored Build Step rather than reaching
  READY or FAILED;
- the log states that the previous deployment SHA was unavailable and that the
  preview is being compared with the repository `main` tree;
- the log lists only the expected non-web paths;
- the command prints `no deployable web input changed; skip Vercel build`;
- GitHub reports the Vercel status as successful for the exact commit;
- the repository's normal GitHub Actions checks remain green.

Record the branch, exact commit, Vercel deployment ID, workflow run ID, and relevant
log lines on the tracking issue before closing it. A later commit on an established
preview branch is not sufficient evidence for this specific fallback.

The immutable provider-generated IDs belong on the tracking issue and probe pull
request rather than in this file: Vercel assigns them only after the candidate commit
exists, and adding them here would turn the evidence into a later branch evaluation.
