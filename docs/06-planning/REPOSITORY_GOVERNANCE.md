# Skribli repository governance and recovery runbook

**Owner:** Ankit Bhardwaj (`@Ankit6149`)  
**Applies to:** `Ankit6149/skribly`  
**Status:** Active development governance baseline  
**Related issue:** [#33](https://github.com/Ankit6149/skribly/issues/33)

## 1. Repository posture

Skribli is proprietary software. The repository is currently publicly visible for development, issue tracking, and limited technical review, but it is not open source and does not grant reuse rights.

The operational choices are:

1. **Remain publicly visible and proprietary.** This supports public issue discussion but exposes all committed source and history.
2. **Change the repository to private.** This is recommended before adding commercially sensitive implementation, signing infrastructure, customer operations, or unreleased product differentiation.
3. **Adopt an explicit source licence.** This requires a deliberate business and legal decision and is not implied by current visibility.

Until the owner changes the GitHub visibility setting or adopts another licence, option 1 is the documented repository posture. Previous public exposure cannot be reversed; making the repository private only protects future access.

## 2. Authority and approvals

The repository owner is the final approver for all production work.

| Area | Required approval | Additional evidence |
| --- | --- | --- |
| Normal application changes | Repository owner | CI, linked issue, tests, incomplete-work statement |
| Persistent storage or migration | Repository owner | migration, fault-injection, backup and rollback evidence |
| Windows native hooks, hotkeys, focus, lifecycle, or permissions | Repository owner | exact Windows runtime evidence |
| GitHub workflows, permissions, branch rules, or automation | Repository owner | least-privilege review and safe rollback |
| Release, installer, signing, updater, or publishing | Repository owner | exact commit/binary identity and release checklist |
| Security boundaries, cryptography, licence signing, or secrets | Repository owner | threat review and secret-handling evidence |
| Commerce, customer data, refunds, taxes, or legal copy | Repository owner plus appropriate professional review | sandbox and legal/accounting evidence |

No workflow, bot, dependency updater, generated change, or passing CI result is authorized to approve or release code by itself.

## 3. Branch model

- `main` is the protected integration branch.
- `fix/<issue>-<slug>` is used for defects and safety work.
- `feature/<issue>-<slug>` is used for approved product changes.
- `spike/<slug>` is disposable and must not be released.

Every production change must be linked to an issue and merged through a pull request.

Branch deletion rules:

- Never delete every non-main branch through a workflow or script.
- Delete only the head branch of a merged or intentionally abandoned pull request.
- Confirm that no other open pull request uses that branch as its base.
- Preserve investigation, recovery, release, and security branches until their evidence is retained elsewhere.
- Force-pushes to `main` are prohibited.

## 4. Required GitHub repository settings

These settings are administrative controls and cannot be established by committing files alone. Record screenshots or exported ruleset configuration in issue #33 when enabled.

### 4.1 Main branch ruleset

Target: `main`

Enable:

- restrict branch deletion;
- block force pushes;
- require changes through a pull request;
- require all conversations to be resolved;
- require the branch to be up to date before merge;
- require the unique CI checks defined in `.github/workflows/ci.yml`;
- prevent bypass except for a documented emergency recovery;
- require signed commits only after every development and automation path supports them reliably.

Required CI checks should include the current job display names:

- `Landing site validation`;
- `Cross-platform frontend checks`;
- `Rust formatting check`;
- `Windows native Rust validation`;
- `Repository governance validation` after that job is merged.

Because the project currently has one maintainer, requiring an approving review from another person can deadlock all work. Use pull requests, required checks, resolved conversations, and the self-review checklist now. Enable at least one independent approval when a trusted second maintainer is added.

### 4.2 Pull request and merge settings

- Enable automatic deletion of a pull request head branch only after merge.
- Prefer squash merge for a focused issue history unless preserving commits is operationally valuable.
- Do not allow a workflow to merge its own changes.
- Do not enable auto-merge for storage, workflow, security, release, commerce, licensing, or legal changes.

### 4.3 Actions permissions

- Use read-only repository permissions by default.
- Grant write permissions only at the individual job level and only when required.
- Do not allow unreviewed third-party actions.
- Pin security-sensitive third-party actions to a full commit SHA before release hardening.
- Protect environment secrets and require approval for production publishing environments.
- Never expose secrets to pull requests from forks.

### 4.4 Security settings

Enable where available:

- Dependabot alerts;
- Dependabot security updates;
- secret scanning;
- push protection;
- private vulnerability reporting;
- security advisories for coordinated fixes.

A blocked secret must not be bypassed merely to make a push succeed. Determine whether it is a false positive; otherwise remove it from history where needed and rotate the credential before continuing.

## 5. Pull request completion standard

A pull request must use `.github/PULL_REQUEST_TEMPLATE.md` and include:

- linked issue and bounded scope;
- architecture and implementation summary;
- privacy/security and persistence impact;
- exact automated-test results;
- native runtime evidence where applicable;
- documentation and migration impact;
- rollback and recovery plan;
- explicit incomplete or blocked work.

An issue is closed only when every acceptance criterion and required evidence is complete. Partial implementation is commented on with these headings:

- **Completed**
- **Validated**
- **Remaining**
- **Blocked or manual**
- **Next action**

## 6. Secret and sensitive-material policy

Never commit:

- API keys, access tokens, passwords, cookies, session data, or webhook secrets;
- code-signing certificates, private keys, recovery phrases, or licence-signing private keys;
- production licence tokens or customer entitlement records;
- customer email addresses, payment data, invoices, support exports, or private logs;
- note content, private file paths, raw URLs containing secrets, accessibility-tree text, or screen captures containing personal data;
- `.env` files or local application data.

Use obvious test fixtures that cannot be mistaken for production credentials. Environment-variable names and public verification keys may be committed only when their security role is documented.

### 6.1 Current-tree review

Search the current tree for at least:

- private-key headers;
- provider token prefixes;
- generic secret/password assignments;
- certificate and keystore files;
- `.env` files;
- customer or licence exports;
- workflow logs and artifacts containing secrets.

Code search is a triage step, not proof that the history is clean.

### 6.2 Full-history scan

Before closing issue #33:

1. Create an authenticated mirror clone containing all refs.
2. Run a dedicated secret scanner across the full Git history with output redaction enabled.
3. Review every finding manually.
4. Rotate every real credential before rewriting history.
5. Remove sensitive material from reachable refs and artifacts where required.
6. Notify affected collaborators before any history rewrite.
7. Record scanner version, command, date, result summary, rotated secret identifiers, and remediation commits without exposing the secrets themselves.
8. Re-run the scan after remediation.

Do not attach an unredacted scanner report to a public issue.

## 7. Backup policy

A GitHub repository is not the only backup.

Maintain:

- an encrypted mirror clone containing branches, tags, and complete history;
- an encrypted export of repository issues, pull-request metadata, release notes, and ruleset settings;
- a separate protected copy of released installers, checksums, SBOMs, signatures, and runtime evidence;
- an inventory of external services and secrets required to restore CI and releases, without storing secret values in this repository.

Recommended cadence during active development:

- mirror after every production merge and before history surgery;
- metadata export at least weekly;
- release evidence at every candidate and final release;
- recovery drill after major repository or release-pipeline changes and at least quarterly once public distribution begins.

## 8. Recovery drill

The recovery drill must use a temporary private repository or isolated local remote.

1. Record the source commit and mirror timestamp.
2. Restore all refs from the encrypted mirror.
3. Confirm `main`, tags, active issue branches, and release references exist.
4. Run CI-equivalent local validation.
5. Compare the restored `main` tree to the source commit.
6. Verify repository governance files and release evidence are present.
7. Confirm that no production secret was required from the repository backup itself.
8. Record pass/fail results and destroy the temporary remote after evidence is retained.

A backup is not considered valid until this drill succeeds.

## 9. Release and signing control

Release work remains disabled until the release issues are complete.

When release work is enabled:

- signing keys must never be stored in the repository or general CI variables;
- release environments must require explicit owner approval;
- the published artifact must be traceable to an immutable commit;
- checksums, signature identity, SBOM, installer logs, and Windows runtime evidence must be retained;
- rollback must preserve the last known-good installer and prevent silent downgrade of user data;
- a workflow change cannot publish in the same unreviewed change that grants itself new permissions.

## 10. Dependency ownership

`.github/dependabot.yml` opens weekly update pull requests for npm, Cargo, and GitHub Actions.

Dependency changes follow the same pull-request and evidence rules as application code. Major upgrades, native dependencies, installer/updater changes, cryptography, and third-party GitHub Actions require explicit risk review. Automated update pull requests are never auto-merged solely because tests pass.

## 11. External collaboration

Public issues may be used for non-sensitive bug reports and technical feedback. External pull requests are accepted only by invitation. Before merging external code, confirm contributor identity, scope, provenance, licensing compatibility, and any required written contributor terms.

Do not request or accept code copied from another proprietary product, generated from leaked source, or supplied without clear rights.

## 12. Emergency procedure

An emergency direct change to `main` is allowed only when normal pull requests are technically unavailable and delay would materially increase active data-loss or security harm.

The owner must:

1. capture the pre-change commit;
2. make the smallest possible change;
3. preserve a rollback ref;
4. document why normal review was unavailable;
5. run required checks immediately afterward;
6. open a retrospective pull request or issue with complete evidence;
7. restore normal protections before other work continues.

Convenience, CI delay, or an unfinished feature is not an emergency.

## 13. Closure evidence for issue #33

Issue #33 remains open until all items below are evidenced:

- destructive branch workflow removed;
- public/proprietary wording aligned;
- CODEOWNERS, issue forms, pull-request template, and dependency update configuration merged;
- `main` ruleset or branch protection enabled and captured;
- automatic post-merge head-branch deletion configured safely;
- private vulnerability reporting and available secret protections enabled;
- full-history secret scan completed and remediated;
- controlled branch merge/deletion test proves an unrelated branch survives;
- encrypted backup created;
- recovery drill passes;
- legal/visibility decision is recorded if the repository posture changes.
