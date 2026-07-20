# Product accessibility

Skribly uses accessibility APIs to understand window context, but Skribly itself must also be accessible.

## Requirements

- keyboard access for every tool and action
- screen-reader names for icons and controls
- visible focus states
- user-adjustable note text size
- minimum touch target in touch mode
- sufficient contrast for text on every note color
- color is never the only state indicator
- reduced-motion mode
- high-contrast compatibility investigation
- reminders exposed as ordinary system notifications

Handwritten content is not automatically screen-reader accessible. Users should be able to add optional alt text or a typed summary later; do not promise OCR in v1.
