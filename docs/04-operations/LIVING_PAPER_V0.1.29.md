# Living Paper owner candidate — 20 September 2026

## Source and scope

The owner asked to refine their new note UI, especially the tick, without replacing the design, and to provide a normal Windows installer. Their screenshot matches PR #203, `design/living-paper-note-ui` at `a15f961381c9846c8cebf8e117096933d8bc59c3`, not the alternate PR #202.

Applied PR #203's composer, rich editor, note CSS and compact-surface marker to the existing Desktop checkout on baseline `43c298b`. Preserved prior v0.1.28 native rail/workspace corrections. Did not import the website preview file or change the website. This is a local combined candidate, not a claim that PR #203 or the prior local work is merged/pushed.

## Refinements

- Replaced the clipped triangular tick hit area with a 36px circular Done control, inset from the resize corner and separated from More. Done continues to flush saves before putting a note away; it does not archive it.
- Retained paper colour, Kalam text, context tab, quiet selection tools and bottom-left Add gateway. Increased tiny menu/context labels; bounded menus and palette to the note.
- Options close on outside press. Escape dismisses an open menu and restores focus before it can close a tool or note. Opening menus moves focus to their first enabled action. Added descriptive labels and visible keyboard resize focus.
- Selected text tools reserve their own row instead of overlapping text. Saved selection is restored for formatting/checklist actions after a menu takes focus.
- Added a direct return-to-writing button in drawing tools. Existing ink-save guards still block changing tools before pending ink is safe.
- Complete and archive now lives in More, separate from reversible Trash confirmation. Existing save/recovery, paste, reminders, attachment drawer and manual corner resize paths remain connected.
- Native note silhouette stays at 20px radius, with no new exterior note shadow. This is not evidence that all compositor issues are resolved.

## Verification

- 202 frontend tests passed, including five new server-rendered note/drawing structure checks. These do not exercise real pointer interactions.
- 208 native tests passed: 168 library, 3 executable, 37 integration.
- TypeScript, production frontend build, product/lifecycle/library/Trash/migration/import validators, compact surface, theme and repository governance passed.
- Known dead-code and bundle-size warnings remain.
- Normal NSIS EXE and MSI built successfully with the existing account configuration and native entitlement enforcement. Static installer branding passed: Skribli product name and canonical app/NSIS icons match; no Tauri branding.

Artifacts: `Desktop/Skribli-v0.1.29`. No website download key is needed for these local files. Account sign-in/entitlement remains unchanged. EXE signature status is `NotSigned`.

| Package | Bytes | SHA-256 |
| --- | ---: | --- |
| `Skribli_0.1.29_x64-setup.exe` | 3539402 | `a91cfd365acdf3d9c24c8afba49bb969556b89f82208cae9f8e59ca258c3f50b` |
| `Skribli_0.1.29_x64_en-US.msi` | 4698112 | `4345e5066f049c24630d613f862d1f5435a44e44fff97a0252c39857104cc12a` |

## Acceptance boundary

Per owner request, no installation, app launch, browser preview or live screenshot capture was performed. Visual parity and real Windows interaction testing remain owner acceptance, not passed QA. No data/account reset, website deployment, public release, signing or payment changes.

Owner test: small/medium/large note; Done vs More; Escape/outside click; colour palette; selection bold/highlight; checklist insertion; drawing return/save/reopen; attachment drawer; reminder at medium size; manual resize; rail/left-right docking. Keep native/UI acceptance issues open until tested.
