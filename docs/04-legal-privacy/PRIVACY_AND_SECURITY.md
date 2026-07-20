# Privacy and security requirements

## Public promise

Skribly is local-first. It should know where an annotation belongs without surveilling what the user is doing.

## v1 data policy

Stored locally:

- Skrib content
- ink strokes
- reminder data
- app identity and context anchors
- settings and backups

Not collected by default:

- screenshots
- screen recordings
- OCR output
- typed keystroke content
- full browsing history
- analytics
- cloud copies

## Sensitive metadata

Window titles, URLs, file paths, and accessibility labels can reveal private information. Minimize, normalize, hash, or redact them where raw values are not required. Logs must default to redacted identifiers.

## Browser extension

- least privileges
- no broad history collection
- page access only for active user actions or explicitly approved sites
- local authenticated channel
- no remote script loading

## Future telemetry

Any telemetry must be opt-in, documented, content-free, and disabled by default in early versions. A privacy impact review is required before implementation.
