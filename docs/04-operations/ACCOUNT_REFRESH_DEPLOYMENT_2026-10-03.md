# Account refresh deployment proposal — 3 October 2026

**Status: awaiting repository-owner approval. Production mutation has not been performed.**

Part of ARC-66; source review is [PR #275](https://github.com/Ankit6149/skribly/pull/275).
This proposal is prepared against integration commit `0a9bfb74d2cc15858e78e3694b234f2a71cb7775`.
Source checkout: `C:\Users\ANKIT BHARDWAJ\Desktop\skribli-desktop`.
Later packaging/documentation commits do not authorize this backend execution.

## Observed production state and mismatch

The execution coordinator's read-only inventory reports project **`bccgutpkjxtogqbywsxr`**, PostgreSQL
**17.6**, and these three applied migrations:

- `20260809120717_account_trial_entitlements`
- `20260809122219_index_device_trial_account_links`
- `20260811194827_private_entitlement_signing_key`

The deployed `account-session` Edge Function is **v4**, with **`verify_jwt=true`**. Its boolean-only
request parser does not accept the new client's routine `productUpdatesOptIn: null` refresh.
The old RPC also cannot insert null into the non-null consent column. Deploying the client without
its matching backend can therefore fail account refresh. Defaulting null to false would incorrectly
change the user's stored consent.

## Reviewed source and evidence

| Source | Purpose |
| --- | --- |
| [`20261002191011_account_refresh_consistency.sql`](../../supabase/migrations/20261002191011_account_refresh_consistency.sql) | Preserve omitted/null consent, serialize account/device claims, return persisted trial/consent, safely compare validated release versions |
| [`account-session/index.ts`](../../supabase/functions/account-session/index.ts) | Bound streamed request bytes, return truthful 400/413 errors, forward null consent, validate the user through Auth |
| [`account_refresh_consistency.sql`](../../supabase/tests/account_refresh_consistency.sql) | Isolated version, malformed input, consent and trial assertions |
| [`account-session.test.mjs`](../../scripts/validation/account-session.test.mjs) | Five synthetic Edge tests, including rejection before account calls |

All four migrations and expanded assertions passed an isolated PostgreSQL **18.3 / PGlite 0.5.8**
fixture; the fixture transaction rolls back. The five Edge tests passed with synthetic Auth/RPC and
signing substitutes. Neither result establishes live PostgreSQL 17.6, multi-connection contention,
production signing, or installed-client acceptance. No PostgreSQL 18-only construct was found in
the reviewed migration. The existing client-version envelope remains stable, prerelease **or** build
metadata; combined prerelease plus build client versions remain unsupported.

## Proposed execution after approval

1. **Preflight, metadata only:** recheck the project reference, server version, migration history,
   Edge version/JWT setting, RPC signature/result columns, function owner/search path, execution
   grants, private-schema exposure, table RLS flags, and security advisors. Retain current claim-RPC
   definition/grants and Edge source as restricted rollback evidence. Do not query customer rows,
   session tokens, passwords, secret values, or signing-key rows; never call the signing-key getter
   during this check.
2. Apply **only** `20261002191011_account_refresh_consistency.sql` through the approved migration
   runner. It replaces functions; it does not rewrite existing account/trial/consent rows or provision
   signing material. If this fails, stop and retain the previous Edge deployment.
3. **Post-migration, metadata only:** confirm the migration entry, unchanged four RPC result columns,
   expected owner/search path and grants. Call only the pure private version-comparison helper with
   synthetic constants to check stable/build precedence and malformed-version rejection. Do not
   call `skribly_claim_trial` against any production account.
4. Deploy the reviewed **`supabase/functions/account-session/index.ts`**, retaining
   **`verify_jwt=true`**, existing secret configuration and fresh `getUser` validation. Account role
   remains derived from trusted `app_metadata`; the service role calls the restricted RPC. Do not
   rotate or retrieve signing material as part of deployment. Current [Supabase authentication
   documentation](https://supabase.com/docs/guides/functions/auth-headers) supports this user-JWT path.
5. **Post-Edge, metadata only:** record the deployed version and JWT setting, repeat grant/advisor
   checks, and verify that an unauthenticated request is rejected. This proposal contains no
   customer writes. Consent/trial acceptance uses the isolated fixture; any later live test account
   or laptop sign-in is a separately authorized action. Record remaining acceptance honestly.

Required grants remain narrow: `public.skribly_claim_trial(uuid,text,text,boolean)` and
`public.skribly_get_entitlement_signing_jwk()` are denied to `PUBLIC`, `anon` and `authenticated`,
with execution granted to `service_role`. The private comparison helper is denied to public/client
roles. RLS on private tables without client policies is intentional for this service-only design;
do not add public policies to silence an informational advisor finding.

## Compatible rollback and separate gates

If Edge deployment fails after the migration, retain the compatible database repair and stop client
publication until the reviewed Edge source is deployed. After null-sending clients are distributed,
**do not blindly restore the old RPC or boolean-only Edge parser**. An owner-reviewed replacement
migration and Edge version must preserve null-as-unchanged consent, explicit boolean changes, RPC
result columns, existing trial limits, Auth validation and service-only grants. Retain account,
device, consent and signing rows. No uninstall, row reset or signing-key replacement is proposed.

The observed leaked-password-protection advisor warning remains an owner decision before public
password-based launch. The current desktop offers password sign-in. Review enabling protection in
Auth settings or approve a documented alternative; Supabase currently makes its built-in leaked
password protection available on Pro and above. If password authentication is removed, verify that
backend password entry points are also unavailable before treating this warning as inapplicable.
See [Supabase password security](https://supabase.com/docs/guides/auth/password-security).
This proposal changes no Auth settings or paid plan.

PostgreSQL 17.11 upgrade decisions are also separate. The [current minor-release advisory](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
requires checks for certain extension indexes, legacy PGP encryption and custom operators; this
migration introduces none of those objects. Do not assume the entire project is unaffected solely
from repository source inspection.

**Human decision required:** approve this exact migration-then-Edge execution on the named project,
or keep production unchanged. Executor: Codex coordinator after approval. Windows/laptop account
acceptance remains open. **Linear write-back pending.**
