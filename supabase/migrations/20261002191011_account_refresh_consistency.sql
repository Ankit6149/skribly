-- Preserve released formats and compare numeric cores without int4 overflow.
-- SemVer precedence: build metadata ignored, stable > prerelease, numeric identifiers < text.
-- Malformed publisher metadata simply excludes that announcement; it cannot block entitlement.
create or replace function skribly_private.version_at_least(client_version text, minimum_version text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  c text; m text; c_core numeric[]; m_core numeric[];
  c_pre text[]; m_pre text[]; ci text; mi text; i integer;
begin
  if client_version is null or minimum_version is null
     or char_length(client_version) > 64 or char_length(minimum_version) > 64
     or client_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?$'
     or minimum_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?$' then return false; end if;
  c := split_part(client_version, '+', 1); m := split_part(minimum_version, '+', 1);
  c_core := string_to_array(split_part(c, '-', 1), '.')::numeric[];
  m_core := string_to_array(split_part(m, '-', 1), '.')::numeric[];
  if c_core <> m_core then return c_core > m_core; end if;
  if strpos(c, '-') = 0 then return true; end if;
  if strpos(m, '-') = 0 then return false; end if;
  c_pre := string_to_array(substr(c, strpos(c, '-') + 1), '.');
  m_pre := string_to_array(substr(m, strpos(m, '-') + 1), '.');
  for i in 1..greatest(cardinality(c_pre), cardinality(m_pre)) loop
    ci := c_pre[i]; mi := m_pre[i];
    if ci is null then return false; end if;
    if mi is null then return true; end if;
    if ci = '' or mi = '' then return false; end if;
    if ci = mi then continue; end if;
    if ci ~ '^[0-9]+$' and mi ~ '^[0-9]+$' then
      if ci::numeric = mi::numeric then continue; end if;
      return ci::numeric > mi::numeric;
    end if;
    if ci ~ '^[0-9]+$' then return false; end if;
    if mi ~ '^[0-9]+$' then return true; end if;
    return (ci collate "C") > (mi collate "C");
  end loop;
  return true;
end;
$$;
revoke all on function skribly_private.version_at_least(text, text) from public, anon, authenticated;

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
  v_updates_opt_in boolean;
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

  -- Serialize each account identity even before its first row exists, then the device.
  -- Consistent account-before-device ordering avoids a cross-identity lock inversion.
  perform pg_advisory_xact_lock(hashtextextended('account:' || p_user_id::text, 0));
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
    coalesce(p_product_updates_opt_in, false),
    p_app_version,
    v_now,
    v_now
  )
  on conflict (user_id) do update
  set email = excluded.email,
      product_updates_opt_in = coalesce(p_product_updates_opt_in, skribly_private.account_profiles.product_updates_opt_in),
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
      or skribly_private.version_at_least(p_app_version, a.minimum_app_version)
    );

  select t.trial_started_at, t.trial_ends_at into v_trial_start, v_trial_end
    from skribly_private.account_trials t where t.user_id = p_user_id;
  select p.product_updates_opt_in into v_updates_opt_in
    from skribly_private.account_profiles p where p.user_id = p_user_id;

  return query
  select
    floor(extract(epoch from v_trial_start))::bigint,
    floor(extract(epoch from v_trial_end))::bigint,
    v_updates_opt_in,
    v_announcements;
end;
$$;

revoke all on function public.skribly_claim_trial(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.skribly_claim_trial(uuid, text, text, boolean)
  to service_role;

