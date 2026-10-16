# Third-party software and assets

Community licensing covers Skribli's original code, not upstream works. Keep each dependency's copyright/licence notices. This source inventory is not a complete notice bundle for a public installer; binary notice generation/review remains a release gate.

| Material | Licence / source | Existing record |
| --- | --- | --- |
| Iconify React renderer | MIT, [Iconify](https://github.com/iconify/iconify) | Installed package licence |
| Solar icon data by 480 Design | CC-BY-4.0, [Solar](https://github.com/480-Design/Solar-Icon-Set) | Desktop/Android `ui/icons.tsx`; attribution must accompany distributed icons |
| Plain plus/close glyphs | MIT, Microsoft Fluent UI System Icons | `apps/desktop/src/ui/FLUENT_LICENSE.txt`, Android equivalent |
| Site, Chrome and Firefox marks | CC0-1.0 project, [Simple Icons](https://github.com/simple-icons/simple-icons) | Desktop `src/assets/supericons/README.md` and override map |
| Code/folder/document marks | Apache-2.0, [MingCute](https://github.com/Richard9394/MingCute) | Desktop asset provenance and override map; preserve upstream licence/notice obligations |
| Kalam, DM Sans and Manrope | OFL-1.1, bundled through Fontsource | Respective locked package LICENSE files |
| npm and Rust dependencies | Their individual licence expressions and notices | Lockfiles plus the inventory command below |

`npm run licenses:inventory` produces a locked npm metadata inventory and can include previously generated Cargo metadata with `--cargo-metadata <path>`. Workspace links are identified separately from third-party packages. The report records missing licences; it never labels them approved. Metadata does not prove compatibility, provenance or fulfillment of binary notices. Review vendored code and modified assets separately.

Supported app/site marks identify context; they do not imply sponsorship. User-selected images and user notes are not covered by this repository's licence grant. Design-reference images and historical screenshots outside the Community map are not granted an open-source asset licence.
