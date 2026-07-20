# Context anchoring strategy

Universal perfect anchoring is not realistic. Skribly stores multiple signals and degrades safely.

## Matching hierarchy

1. exact browser URL or document identity
2. exact accessibility element, where stable
3. application identity + normalized window-title rule
4. nearby semantic fingerprint
5. normalized window-relative coordinate
6. manual re-anchor

## Anchor record

An anchor may contain:

- platform
- executable path or macOS bundle ID
- display name
- window title pattern
- document-path hash, never necessarily raw path
- normalized x/y position
- accessibility role and label hash
- browser URL pattern
- DOM selector
- nearby-text hash
- confidence and last successful match

## Confidence behavior

- high: display normally
- medium: display collapsed with a context indicator
- low: do not place over content; ask the user to re-anchor

## Whole-window v1

Initial production work targets whole-window attachment. Exact UI-control and webpage anchoring follow only after reliable window-level behavior.

## Browser extension

The extension improves precision through DOM selection and scroll tracking. It must maintain fallback selectors and nearby-text fingerprints because websites change.
