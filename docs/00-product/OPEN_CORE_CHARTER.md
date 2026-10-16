# Skribli open-core product charter

17 October 2026. Owner-approved direction: partly open source, with a commercial product and future team/organization offerings. The owner confirmed ownership of the original work. This charter replaces the former proprietary-only source direction for the exact Community areas in [LICENSING.md](../../LICENSING.md). It does not approve public binary delivery, paid sales, cloud uploads or new permissions.

## Editions and product promise

| Offering | Product boundary | Current status |
| --- | --- | --- |
| Community | Useful local contextual notes; typing, current drawing/files/reminders, palette/fonts, search, Archive/Trash, accessibility and safe data access | Explicit desktop source build implemented; installed acceptance pending |
| Pro | Separately authored premium productivity workflows, advanced organization/publishing or a validated capability pack | Product discovery; no paid implementation or sale claimed |
| Team | Explicitly shared workspaces, invitation/membership, permissions and consolidated administration/billing | Architecture and discovery track; not implemented |
| Organization | Multi-workspace governance, managed deployment, SSO/provisioning, policy/audit/export controls and contractual support | Later customer-led track; not implemented |
| Optional hosted services | Sync, remote backup and sharing with an approved protocol, privacy/key/recovery model and operating budget | Deferred; no note-content cloud upload authorized |

Community includes the core reason to use Skribli. Safety, readable content, accessibility, security fixes and access to a person's existing notes are not premium scarcity mechanisms. Ordinary export remains available. Complete text/ink/file/reminder backup must be implemented and accepted before claiming it exists. Premium publishing formats and managed off-device services can be commercial additions.

Community local writing requires no account or trial. A Community status is not a verified identity, paid licence or authority to access a hosted endpoint. The existing account-enabled owner build remains a separate configuration; source licensing does not silently change its trial/entitlement contract or production backend.

## Commercial focus

Validate one specific recurring workflow with prospective customers before implementing an entire Pro/Team suite. Initial paid hypothesis: a self-contained productivity pack with clearly defined purchase/update rights. Ongoing hosted resources may justify subscriptions later. No final price, perpetual-update promise, lifetime unlimited storage, supported sales territory or SLA is established here.

Prioritize Windows acceptance and a useful Community contribution path. Android is a separate local-note foundation, not a desktop-parity or organization-ready application. Browser URL/DOM precision, collaboration, AI, cloud sync and marketplace execution remain future work requiring their respective architecture/security decisions.

## Team and organization design commitments

Personal notes remain personal by default. Joining an organization must not upload or transfer existing local notes automatically. A person explicitly chooses a shared workspace/destination, with clear consequences for ownership, retention and access. Leaving a team, losing a seat or ending a subscription must not destroy that person's unrelated Community notes.

Before shared storage, define workspace ownership, membership and roles separately from the existing account service's `owner`/`member` administration roles. Validate tenant membership and operation-specific authorization on the server. Client flags, email addresses and a local Community build cannot grant organization access.

Define owner/admin/editor/viewer capabilities, invitations, seat changes, user departure, offboarding/export and audit events before implementation. Decide who owns shared work and what happens on organization suspension/deletion. Data residency, retention, legal holds, SSO/SCIM, encryption/recovery and support commitments need customer and professional review. These are required design questions, not hidden schema additions or claims of available enterprise features.

## Release order

1. Scoped source licensing and Community build foundation.
2. Complete-backup design/implementation, accepted exact Windows candidate, support/privacy/signing/distribution decisions.
3. Bounded Community public binary beta when those gates pass.
4. One validated Pro pack with accepted payment/refund/downgrade behavior and approved seller/terms.
5. Team pilot with real shared-workspace authorization and data-isolation evidence.
6. Organization capabilities based on actual procurement/governance needs.

The [execution register](../06-planning/OPEN_CORE_EXECUTION_2026-10-17.md) distinguishes implementation, verification and open decisions. ARC-66 remains open. The [licensing boundary](../../LICENSING.md), [Community guide](../../COMMUNITY.md) and [edition ADR](../02-engineering/ADR-0005-community-commercial-editions.md) are current sources of truth for this transition; old research remains historical planning context.
