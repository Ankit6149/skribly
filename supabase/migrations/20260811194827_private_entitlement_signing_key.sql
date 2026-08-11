create table skribly_private.entitlement_signing_keys (
  key_id text primary key check (key_id ~ '^[a-z0-9_-]{3,64}$'),
  private_jwk text not null check (char_length(private_jwk) between 80 and 2048),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table skribly_private.entitlement_signing_keys enable row level security;

create unique index entitlement_signing_keys_one_active_idx
  on skribly_private.entitlement_signing_keys (active)
  where active;

revoke all on skribly_private.entitlement_signing_keys from public, anon, authenticated;

create or replace function public.skribly_get_entitlement_signing_jwk()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select k.private_jwk
    from skribly_private.entitlement_signing_keys as k
   where k.active
   order by k.created_at desc
   limit 1;
$$;

revoke all on function public.skribly_get_entitlement_signing_jwk()
  from public, anon, authenticated;
grant execute on function public.skribly_get_entitlement_signing_jwk()
  to service_role;

comment on table skribly_private.entitlement_signing_keys is
  'Private Ed25519 entitlement signing material. Values are provisioned out of band and never committed.';
comment on function public.skribly_get_entitlement_signing_jwk() is
  'Returns the active entitlement signing key only to the service role used by the account Edge Function.';
