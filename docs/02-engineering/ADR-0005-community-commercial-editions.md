# ADR-0005: explicit Community and commercial edition boundaries

Status: accepted source foundation, 17 October 2026. Part of ARC-66. Owner selected an open-core direction and confirmed original-work ownership. Native/platform acceptance remains separate.

## Decision

Use an explicit Cargo `community` feature for the local desktop edition. The default configuration retains existing account/trial behavior. Community returns native `LicenseMode::Community` with local writing enabled, no trial, no licensed identity and no device claim. It returns before licence-file reads/writes/initialization and rejects activation/deactivation. Account session/device-claim commands reject Community use. Storage read-only/error protections still independently govern mutations.

The frontend waits for a successfully received native status before starting account initialization. It derives Community workspace readiness separately from verified account phase; it does not set an account to `ready` or impersonate an owner. Sidebar/Settings show Community and no account controls. Ambiguous/failed native status must not cause an account-service request. The existing account-enabled build still initializes and verifies account access.

`community:build` pairs the feature and `tauri.community.conf.json`, with identifier `app.skribli.community`, a distinct binary and a separate profile. Its CSP permits self connections only and excludes external account endpoints. Enabling commercial trial enforcement in a Community compilation is a build error. The development builder has no bundling/publication path. Use the normal owner builder only for its original configuration.

Community and account-enabled builds currently share the Windows session instance guard/global shortcut. They are not supported concurrently. Launch-at-login entries are distinct; the operator must choose one edition. Installed cross-edition behavior still requires acceptance. No existing profile is copied or migrated automatically; native JSON alone is not a complete rich-content backup.

## Code and licensing

Original Community code is MPL-2.0 under the machine-readable licence map, with upstream exceptions preserved. Commercial backend/site/private-delivery areas retain proprietary terms. Existing client account integration is covered source, but grants no production service access. Private Pro implementation should consume pinned Community code through documented interfaces; do not maintain two full-app forks or put undisclosed proprietary files in covered roots. Physical repository separation is not a substitute for licence compatibility analysis.

Future team authorization belongs in a separate trusted service/domain. Personal local note capability, service entitlement, account identity, workspace membership and tenant roles are different concepts. Do not treat the current account `owner` role as an organization owner. Shared-data operations need operation-specific authorization and tenant-isolation tests; no new server, RLS rule or shared-storage schema is introduced by this ADR.

## Consequences and acceptance

Tests must show: no account initialization in Community; account-enabled initialization preserved; unknown native status does not guess an edition; local note access survives absent/corrupt commercial licence state; Community creates no trial/device state and cannot modify a commercial licence; compilation rejects mixed trial/Community settings. Test default, Community and restricted configurations independently.

The source grant cannot be recalled from complying recipients by simply reverting this commit. Code rollback can restore earlier application behavior but cannot undo already-granted open-source rights. Existing private installers keep their original bits and behavior. Public binary release remains blocked by exact-package/runtime/data/recovery/accessibility/performance/signing/support gates, including complete cross-edition backup and third-party notice packaging.

No backend or production entitlement changes, customer migration, plugin execution, screen capture, telemetry, cloud sync, payment activation, new installer or public release is part of this source foundation.
