# Security policy

Skribly is local-first software that will interact with application-window metadata and accessibility APIs. Treat this as sensitive system software.

## Initial security boundaries

- No screen recording in v1.
- No reading keystroke contents; typing activity may only be used when explicitly needed and must never capture text.
- No network access during normal use except an explicit update check.
- No cloud account or sync in v1.
- SQLite data remains in the user's application data directory.
- Browser-extension communication must be local, authenticated, origin-limited, and permission-minimal.
- Logs must not contain note content, document paths, page text, URLs with secrets, or accessibility-tree text by default.

## Reporting

Until a public security mailbox exists, report vulnerabilities privately to the repository owner. Do not open public issues containing exploit details or private user data.
