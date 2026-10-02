-- Run ONLY on an isolated PostgreSQL/Supabase fixture after the migrations.
-- No signing material, production account, or network request is needed. All fixture writes roll back.
begin;
do $$
declare
  fixture_user uuid := gen_random_uuid();
  fixture_device text := 'skd_' || repeat('t', 43);
  row_value record;
begin
  assert skribly_private.version_at_least('0.1.51', '0.1.51');
  assert skribly_private.version_at_least('0.1.51+build.1', '0.1.51');
  assert skribly_private.version_at_least('0.1.51', '0.1.51-beta.1');
  assert not skribly_private.version_at_least('0.1.51-beta.1', '0.1.51');
  assert skribly_private.version_at_least('0.1.51-beta.10', '0.1.51-beta.2');
  assert not skribly_private.version_at_least('0.1.51-beta.2', '0.1.51-beta.10');
  assert skribly_private.version_at_least('0.1.51-beta.2', '0.1.51-beta');
  assert not skribly_private.version_at_least('0.1.51-beta', '0.1.51-beta.2');
  assert skribly_private.version_at_least('0.1.51-beta', '0.1.51-1');
  assert not skribly_private.version_at_least('0.1.51-1', '0.1.51-beta');
  assert skribly_private.version_at_least('999999999999999999999999.0.0', '2147483648.0.0');
  assert not skribly_private.version_at_least('0.1.51', 'malformed');
  assert not skribly_private.version_at_least(null, '0.1.51');

  insert into auth.users(id, email, email_confirmed_at)
    values(fixture_user, 'synthetic-account@example.invalid', now());
  select * into row_value from public.skribly_claim_trial(fixture_user, fixture_device, '0.1.51-beta.1', null);
  assert not row_value.product_updates_opt_in;
  select * into row_value from public.skribly_claim_trial(fixture_user, fixture_device, '0.1.51+build.1', true);
  assert row_value.product_updates_opt_in;
  select * into row_value from public.skribly_claim_trial(fixture_user, fixture_device, '0.1.51', null);
  assert row_value.product_updates_opt_in;
  select * into row_value from public.skribly_claim_trial(fixture_user, fixture_device, '0.1.51', false);
  assert not row_value.product_updates_opt_in;
  assert row_value.trial_ends_at = (
    select floor(extract(epoch from trial_ends_at))::bigint
    from skribly_private.account_trials where user_id = fixture_user
  );
end;
$$;
rollback;
