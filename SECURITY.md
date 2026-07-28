# Security policy

Skribli is local-first system software that interacts with application-window metadata and Windows accessibility/runtime APIs. Treat reports, logs, builds, signing material, and user data as sensitive.

## Supported versions

Skribli is in active production development and no public installer is currently supported. Security fixes are applied to the active `main` development line unless a release notice states otherwise.

## Security boundaries

- No screen recording in v1.
- No capture of typed content outside Skribli.
- No cloud account or sync in v1.
- No network access during normal note use except an explicitly approved update, activation, or support flow.
- Application data remains in the user's local application-data directory by default.
- Browser-extension communication, if implemented later, must be local, authenticated, origin-limited, and permission-minimal.
- Logs must not contain note content, raw document paths, page text, secret-bearing URLs, accessibility-tree text, credentials, private keys, customer records, or production licence tokens by default.

## Reporting a vulnerability

Do **not** open a public issue containing exploit details, credentials, private user data, signing material, licence secrets, or a working proof of concept.

Use GitHub's private vulnerability reporting for this repository when the option is available. If the private-reporting button is not enabled, contact the repository owner privately through the contact method listed on the owner's GitHub profile and include only the minimum information needed to establish a secure follow-up channel.

A useful report includes:

- the affected commit or build identifier;
- the affected Windows version and architecture;
- a concise impact statement;
- minimal reproduction steps;
- whether user interaction or elevated privileges are required;
- sanitized evidence with private content removed;
- any temporary mitigation known to the reporter.

Do not test against another person's data or system, perform denial-of-service testing, publish the vulnerability before coordinated disclosure, or retain data obtained during testing.

## Maintainer handling

The repository owner must acknowledge the report privately, preserve evidence without exposing user content, assess severity, rotate any exposed secrets immediately, prepare the fix in a restricted branch or private advisory, and coordinate disclosure only after affected users can be protected.

Security fixes must include regression tests and an explicit review of logging, update delivery, signing, storage migration, and rollback impact where relevant.
