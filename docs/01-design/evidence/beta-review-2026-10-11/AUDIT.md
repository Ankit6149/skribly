# Current panel source verification — 11 October 2026

Part of ARC-66. Executor: Codex. Existing React source, synthetic preview notes, Chrome. The in-app browser was unavailable; the same source preview was inspected through the connected Chrome browser. No installed Windows acceptance is claimed.

| Check | Observation |
| --- | --- |
| Native-width source preview, 388×800 | Five equal 88 px note cards; header, scopes, search, app filters and shortcut footer fit |
| Search for timeline | Only Questions for Friday is displayed |
| Unmatched search | No thoughts match your search; no unrelated cards displayed |
| VS Code filter | Two Code notes displayed; both measured 333.8×88 px |
| Empty Archive | Zero saved thoughts; Completed thoughts will rest here |
| Narrow preview, 320×600 | All five cards measured 265.8×88 px; document width 320 px; no horizontal overflow |
| Escape | Closing state disabled header actions, then panel collapsed and focus returned to Open My Skribs |

Retained screenshots: current-panel-388x800.png, panel-search-result.png and current-panel-320x600.png. Native calls, actual note opening/Return, real attachment dragging, physical monitor changes, compositor blur and installed data/account flows were not exercised. Calendar/Settings visual acceptance and exhaustive keyboard/screen-reader checks remain open.

Correction after the ticket-panel implementation: native backdrop was already wired through DwmSetWindowAttribute (DWMSBT_TRANSIENTWINDOW while expanded); the earlier claim of no native blur wiring was incorrect. The former heavy pastel tint obscured the effect. The owner rejected the Image Gen concepts and selected a saturated ticket-grid reference, now implemented in source. Browser captures prove the layout only; installed native blur, full-work-area expansion and focus acceptance remain pending.
