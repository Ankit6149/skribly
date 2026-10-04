# Encrypted companion sync implementation boundary

**Date:** 4 October 2026  
**Status:** Reviewable implementation proposal. No production migration, network path, key enrollment or public sync claim is authorized by this document.

## Owner product decision

Android is intended to become a full companion: a signed-in person should see and edit the same Skribs and reminders on phone and desktop. General Skribs have no application context. Desktop-only application context may be displayed on mobile as optional source metadata, but mobile must not pretend it can restore a Windows window or overlay.

## Implemented in this branch

- `SharedSkrib` schema v2 with text, colour, lifecycle timestamps, optional portable context and an optional versioned reminder.
- An atomic mobile v1-to-v2 migration that preserves old records and fails closed on malformed/future data.
- Android reminder create, edit, repeat, list and complete flows stored with the Skrib in the same IndexedDB transaction.
- `EncryptedSyncEnvelope` v1 and an `EncryptedSyncTransport` that accepts ciphertext only.
- AES-256-GCM encrypt/decrypt helpers with a random 96-bit IV, authenticated envelope metadata and a ciphertext SHA-256 integrity precheck. AES-GCM binds routing, revision, deletion, device and key metadata to the ciphertext; the hash gives an early corruption check.

## Privacy boundary

The existing account service stores identity, trial and entitlement metadata only. This proposal does not change that deployed promise. A separate opt-in sync capability must be disclosed and approved before a migration is applied. Clients encrypt the complete Skrib before transport. The server may store only routing/version metadata and ciphertext. It must never receive a vault key, recovery secret, note text, reminder title, context label or locator.

Encryption does not hide all metadata. The sync service and its operators can still observe account ownership, document identifiers, schema/envelope versions, revision numbers, update/deletion times, device and key identifiers, payload size, traffic timing and IP/network metadata. This leakage must be disclosed in the threat model and privacy copy. Envelope v1 authenticates the stored routing metadata as AES-GCM additional data so a server or intermediary cannot alter it without decryption failing.

Keys require an approved design before implementation:

1. create a per-account vault key on the first enrolled device;
2. store it in Android Keystore / Windows protected storage, wrapped for each authorized device;
3. offer a separately generated recovery secret with clear lost-key behavior;
4. support device revocation and vault-key rotation;
5. never derive the vault key directly from an account password or entitlement token.

## Proposed server table (not a migration)

The following is a review sketch. It deliberately remains outside `supabase/migrations`. If approved, create the real migration with `supabase migration new`, add pgTAP allow/deny coverage, run local database tests and advisors, then request owner approval before deployment.

```sql
create table public.encrypted_sync_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  document_type text not null check (document_type in ('skrib')),
  envelope_version smallint not null check (envelope_version = 1),
  document_schema_version integer not null check (document_schema_version > 0),
  revision bigint not null check (revision > 0),
  updated_at_ms bigint not null check (updated_at_ms >= 0),
  deleted_at_ms bigint,
  device_id text not null,
  key_id text not null,
  algorithm text not null check (algorithm = 'AES-GCM-256'),
  iv_base64 text not null,
  ciphertext_base64 text not null,
  ciphertext_sha256 text not null check (ciphertext_sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

alter table public.encrypted_sync_documents enable row level security;
revoke all on table public.encrypted_sync_documents from anon, authenticated;
grant select, insert, update, delete on table public.encrypted_sync_documents to authenticated;

create policy "owners read their encrypted documents"
on public.encrypted_sync_documents for select to authenticated
using ((select auth.uid()) = user_id);

create policy "owners insert their encrypted documents"
on public.encrypted_sync_documents for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "owners update their encrypted documents"
on public.encrypted_sync_documents for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "owners delete their encrypted documents"
on public.encrypted_sync_documents for delete to authenticated
using ((select auth.uid()) = user_id);
```

The client must reject revision regression and surface simultaneous edits. A server-side `revision > current revision` constraint cannot be expressed safely by a plain upsert alone; choose and test a conditional mutation/RPC or compare-and-swap Edge endpoint before implementation. Any privileged function belongs in an unexposed schema, must validate `auth.uid()`, and needs an explicit execute grant. Do not add `security definer` merely to bypass RLS.

## Required acceptance before live sync

1. Approve the threat model, opt-in language, recovery/lost-key behavior, deletion retention, quotas and support policy.
2. Implement account authentication on Android and bind enrolled devices to the existing account identity without exposing a service-role key.
3. Implement secure key storage and device/recovery enrollment on Windows and Android.
4. Adapt the desktop Rust note record plus IndexedDB reminder/rich-content stores into the shared schema without losing data.
5. Add durable offline mutation queues, tombstones, retry bounds, compare-and-swap conflicts and a visible conflict review.
6. Create and locally test the Supabase migration and RLS tests. Current Supabase guidance requires explicit grants plus RLS for exposed tables and notes that update also requires a select policy.
7. Test two real devices, offline edits, clock skew, reinstall, revoked device, lost recovery secret, account deletion and rollback.
8. Update the privacy policy, network/capability registry, product truth and store disclosures before enabling the feature.

Until these gates pass, Android can use the shared local record and reminder UI, but cross-device sync is not live.
