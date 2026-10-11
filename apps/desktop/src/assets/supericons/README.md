# Bundled Supericons app marks

Chrome and Firefox SVGs were downloaded from the [Supericons](https://supericons.dev/) service on 2026-09-27. Code, Explorer and generic fallbacks use solid MingCute SVGs returned by Supericons get_icon on 2026-10-11 (`artifacts/supericons-solid-response.txt` and the folder/document response records). The full `@supericons/mcp` pack is for development lookup and is not redistributed in the app.

| File | Supericons reference | Upstream |
| --- | --- | --- |
| `googlechrome.svg` | `simpleicons:googlechrome` | [Simple Icons](https://github.com/simple-icons/simple-icons), CC0 project |
| `firefox.svg` | `simpleicons:firefox` | [Simple Icons](https://github.com/simple-icons/simple-icons), CC0 project |
| `vscode.svg` | `mingcute:vscode_fill` | [MingCute](https://github.com/Richard9394/MingCute), Apache-2.0 project |
| `folder_fill.svg` | `mingcute:folder_fill` | [MingCute](https://github.com/Richard9394/MingCute), Apache-2.0 project |
| `document_fill.svg` | `mingcute:document_fill` | [MingCute](https://github.com/Richard9394/MingCute), Apache-2.0 project |

Known apps prefer these marks over native logos in notes and the widget. Notes render the mark in soft #424242 charcoal inside the 48px light colourful circle, with a 24px mark and 12px padding. Random pill backgrounds use light shared-palette accents, excluding similar note hues and the previous pill colour. Icon/paired ink contrast exceeds 4.5:1; a thin outline distinguishes light-on-light surfaces. Explicit widget custom icons remain respected. Unknown applications retain the existing Windows/generic fallback. Brand rights may differ from the icon-library license.

Cards use the same padded proportions and a light tint derived from the selected note paper. Filter marks use the same soft charcoal. User-selected custom widget images remain overrides.

Plain plus and close glyphs use Microsoft Fluent UI System Icons via bundled offline Iconify data. These two unframed filled marks replace the circled glyphs. License: MIT; full notice is included in `src/ui/FLUENT_LICENSE.txt` in desktop and Android. Source: https://github.com/microsoft/fluentui-system-icons .
