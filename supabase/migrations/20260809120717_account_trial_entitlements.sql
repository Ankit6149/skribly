create schema if not exists skribly_private authorization postgres;

revoke all on schema skribly_private from public, anon, authenticated;

create table skribly_private.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  product_updates_opt_in boolean not null default false,
  app_version text not null check (app_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$'),
  last_entitlement_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table skribly_private.account_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (trial_ends_at = trial_started_at + interval '7 days')
);

create table skribly_private.device_trials (
  device_claim text primary key check (device_claim ~ '^skd_[A-Za-z0-9_-]{43}$'),
  first_user_id uuid references auth.users(id) on delete set null,
  last_user_id uuid references auth.users(id) on delete set null,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (trial_ends_at = trial_started_at + interval '7 days')
);

create table skribly_private.product_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  action_label text check (action_label is null or char_length(action_label) between 1 and 40),
  action_url text check (action_url is null or action_url ~ '^https://'),
  minimum_app_version text check (
    minimum_app_version is null
    or minimum_app_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$'
  ),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

alter table skribly_private.account_profiles enable row level security;
alter table skribly_private.account_trials enable row level security;
alter table skribly_private.device_trials enable row level security;
alter table skribly_private.product_announcements enable row level security;

create index account_profiles_product_updates_opt_in_idx
  on skribly_private.account_profiles (updated_at desc)
  where product_updates_opt_in;

create index product_announcements_active_window_idx
  on skribly_private.product_announcements (starts_at, ends_at);

grant usage on schema skribly_private to service_role;
grant select, insert, update on skribly_private.account_profiles to service_role;
grant select, insert, update on skribly_private.account_trials to service_role;
grant select, insert, update on skribly_private.device_trials to service_role;
grant select on skribly_private.product_announcements to service_role;

create or replace function public.skribly_claim_trial(
  p_user_id uuid,
  p_device_claim text,
  p_app_version text,
  p_product_updates_opt_in boolean
)
returns table (
  trial_started_at bigint,
  trial_ends_at bigint,
  product_updates_opt_in boolean,
  active_announcements jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_email text;
  v_account_start timestamptz;
  v_device_start timestamptz;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_announcements jsonb;
begin
  if p_user_id is null then
    raise exception 'account id is required' using errcode = '22023';
  end if;
  if p_device_claim is null or p_device_claim !~ '^skd_[A-Za-z0-9_-]{43}$' then
    raise exception 'device claim is invalid' using errcode = '22023';
  end if;
  if p_app_version is null
     or p_app_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$'
     or char_length(p_app_version) > 64 then
    raise exception 'app version is invalid' using errcode = '22023';
  end if;

  select lower(trim(u.email))
    into v_email
    from auth.users as u
   where u.id = p_user_id
     and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'a verified account is required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_device_claim, 0));

  select t.trial_started_at
    into v_account_start
    from skribly_private.account_trials as t
   where t.user_id = p_user_id
   for update;

  select t.trial_started_at
    into v_device_start
    from skribly_private.device_trials as t
   where t.device_claim = p_device_claim
   for update;

  v_trial_start := least(
    coalesce(v_account_start, v_now),
    coalesce(v_device_start, v_now),
    v_now
  );
  v_trial_end := v_trial_start + interval '7 days';

  insert into skribly_private.account_profiles (
    user_id,
    email,
    product_updates_opt_in,
    app_version,
    last_entitlement_at,
    updated_at
  )
  values (
    p_user_id,
    v_email,
    p_product_updates_opt_in,
    p_app_version,
    v_now,
    v_now
  )
  on conflict (user_id) do update
  set email = excluded.email,
      product_updates_opt_in = excluded.product_updates_opt_in,
      app_version = excluded.app_version,
      last_entitlement_at = excluded.last_entitlement_at,
      updated_at = excluded.updated_at;

  insert into skribly_private.account_trials (user_id, trial_started_at, trial_ends_at)
  values (p_user_id, v_trial_start, v_trial_end)
  on conflict (user_id) do update
  set trial_started_at = least(
        skribly_private.account_trials.trial_started_at,
        excluded.trial_started_at
      ),
      trial_ends_at = least(
        skribly_private.account_trials.trial_ends_at,
        excluded.trial_ends_at
      );

  insert into skribly_private.device_trials (
    device_claim,
    first_user_id,
    last_user_id,
    trial_started_at,
    trial_ends_at,
    first_seen_at,
    last_seen_at
  )
  values (
    p_device_claim,
    p_user_id,
    p_user_id,
    v_trial_start,
    v_trial_end,
    v_now,
    v_now
  )
  on conflict (device_claim) do update
  set last_user_id = excluded.last_user_id,
      trial_started_at = least(
        skribly_private.device_trials.trial_started_at,
        excluded.trial_started_at
      ),
      trial_ends_at = least(
        skribly_private.device_trials.trial_ends_at,
        excluded.trial_ends_at
      ),
      last_seen_at = excluded.last_seen_at;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'body', a.body,
        'actionLabel', a.action_label,
        'actionUrl', a.action_url
      )
      order by a.starts_at desc
    ),
    '[]'::jsonb
  )
  into v_announcements
  from skribly_private.product_announcements as a
  where a.starts_at <= v_now
    and (a.ends_at is null or a.ends_at > v_now)
    and (
      a.minimum_app_version is null
      or string_to_array(p_app_version, '.')::int[]
         >= string_to_array(a.minimum_app_version, '.')::int[]
    );

  return query
  select
    floor(extract(epoch from v_trial_start))::bigint,
    floor(extract(epoch from v_trial_end))::bigint,
    p_product_updates_opt_in,
    v_announcements;
end;
$$;

revoke all on function public.skribly_claim_trial(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.skribly_claim_trial(uuid, text, text, boolean)
  to service_role;

comment on schema skribly_private is
  'Private account, device-trial, consent, and in-app announcement metadata. Skrib content is never stored here.';
comment on function public.skribly_claim_trial(uuid, text, text, boolean) is
  'Claims the earliest existing seven-day window across a verified account and privacy-minimized Windows device claim.';
