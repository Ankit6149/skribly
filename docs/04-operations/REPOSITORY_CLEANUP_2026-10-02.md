# Repository cleanup follow-up — 2 October 2026

Executor: Codex. Owner requested correction of the review finding and removal of all branches except `main`.

## Review and correction

Reviewed structural commit `560904a05d9e3c921bdf144587b4783dfad353d0` for GitHub #229. Features now have clearer component, model, lifecycle, persistence, state and style ownership. Native application/rail state has separate modules. Current documentation has one entry index; deployment-sensitive roots remain unchanged.

The app entry imported `App` after theme/polish styles. Feature CSS loaded through App consequently overrode established theme rules. Restore App before those styles, preserving the original cascade. Production CSS again uses the established library typography, card corners, selection treatment and import-dialog 28/46 px corners instead of 22 px. Widget CSS moved unchanged and retains uniform 110 px cards.

Verification: 246 frontend tests and 177 Windows Rust library tests passed during the exact cleanup review; production build, product/governance/site validators and Rust formatting passed. The follow-up production build and compiled CSS inspection pass. Current-head CI is required before merging the correction. Existing large-bundle/compiler warnings remain.

## Branch preservation and removal

Before deletion, fetched all current remote heads and preserved all local/remote branch history in an external Git bundle. `git bundle verify` reports complete history. The owner backup folder is `Desktop/Skribli-repository-backup-2026-10-02`, outside the repository. It includes branch heads, unique-commit audit and worktree inventory. Bundle SHA-256: `74F1C18260676EB82A1C63106C0BC41EC96844F0D2CC0DA78F00AD5109FFEE23`.

Initial audit: 39 remote non-main branches and 13 old local non-main branches, plus the temporary correction branch. Unmerged design/dependency work is retained in the bundle rather than merged into production as part of cleanup. The seven open dependency PRs are intentionally abandoned under the owner's main-only instruction. Old release worktrees are detached at their existing commits; their files are preserved. Final branch deletion/verification is recorded in the external cleanup report after the correction merges.

Recover a removed branch with `git fetch <path-to-bundle> <recorded-ref>:refs/heads/<chosen-name>`. Use the external branch-head/audit inventory to select the exact saved ref. Do not reset `main` or local note/account data to restore branch work.

## Remaining boundary

This establishes repository organization and checked source correction. It does not establish installed Windows appearance/smoothness, historical AppHangB1 resolution, idle resource figures, upgrade/persistence acceptance, signing or public-launch readiness. Native `lib.rs` and the note composer still contain substantial coordination logic; further decomposition is separate work. The existing private v0.1.51 website installer is unchanged by this maintenance pass.
