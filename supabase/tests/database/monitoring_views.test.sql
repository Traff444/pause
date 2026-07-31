begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'app_states', 'app_states table exists');
select has_table('public', 'smoking_events', 'smoking_events table exists');
select ok(
  to_regclass('public.participant_smoking_timeline') is not null,
  'participant_smoking_timeline view exists'
);
select ok(
  to_regclass('public.participant_daily_summary') is not null,
  'participant_daily_summary view exists'
);
select policies_are(
  'public',
  'smoking_events',
  array[
    'smoking_events_select_own',
    'smoking_events_insert_own',
    'smoking_events_update_own'
  ],
  'smoking_events has only the intended owner policies'
);

delete from public.smoking_events
where id in (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
);
delete from auth.users
where id in (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'pilot-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'pilot-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.smoking_events (
  id,
  user_id,
  occurred_at,
  created_at,
  deleted_at,
  local_date,
  program_day
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    '33333333-3333-4333-8333-333333333333',
    '2026-07-31 09:00:00+00',
    '2026-07-31 09:00:00+00',
    null,
    '2026-07-31',
    1
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    '33333333-3333-4333-8333-333333333333',
    '2026-07-31 09:25:00+00',
    '2026-07-31 09:25:00+00',
    null,
    '2026-07-31',
    1
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    '33333333-3333-4333-8333-333333333333',
    '2026-07-31 10:05:00+00',
    '2026-07-31 10:05:00+00',
    null,
    '2026-07-31',
    1
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
    '33333333-3333-4333-8333-333333333333',
    '2026-07-31 10:30:00+00',
    '2026-07-31 10:30:00+00',
    now(),
    '2026-07-31',
    1
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '44444444-4444-4444-8444-444444444444',
    '2026-07-31 11:00:00+00',
    '2026-07-31 11:00:00+00',
    null,
    '2026-07-31',
    1
  );

select results_eq(
  $$
    select cigarette_number, interval_minutes
    from public.participant_smoking_timeline
    where user_id = '33333333-3333-4333-8333-333333333333'
    order by cigarette_number
  $$,
  $$
    values
      (1::integer, null::numeric),
      (2::integer, 25.0::numeric),
      (3::integer, 40.0::numeric)
  $$,
  'timeline exposes the exact same-day intervals and excludes a deleted event'
);

select results_eq(
  $$
    select
      cigarette_count,
      interval_count,
      total_interval_minutes,
      average_pause_minutes,
      longest_pause_minutes
    from public.participant_daily_summary
    where user_id = '33333333-3333-4333-8333-333333333333'
  $$,
  $$
    values (3::integer, 2::integer, 65.0::numeric, 32.5::numeric, 40.0::numeric)
  $$,
  'daily summary calculates 65 / 2 = 32.5 minutes'
);

select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass
  ),
  true,
  'profiles RLS is enabled'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.app_states'::regclass
  ),
  true,
  'app_states RLS is enabled'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.smoking_events'::regclass
  ),
  true,
  'smoking_events RLS is enabled'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-4333-8333-333333333333';

select results_eq(
  'select count(*) from public.smoking_events',
  'values (4::bigint)',
  'an authenticated user sees only their own raw events'
);
select results_eq(
  'select count(*) from public.participant_smoking_timeline',
  'values (3::bigint)',
  'an authenticated user sees only their own active timeline'
);
select results_eq(
  $$
    update public.smoking_events
    set program_day = 99
    where user_id = '44444444-4444-4444-8444-444444444444'
    returning program_day
  $$,
  'select 99::integer where false',
  'an authenticated user cannot update another user event'
);

update public.profiles
set email = 'spoofed@example.test'
where id = '33333333-3333-4333-8333-333333333333';

select is(
  (
    select email
    from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
  ),
  'pilot-one@example.test',
  'profile email is always derived from auth.users'
);

select * from finish();
rollback;
