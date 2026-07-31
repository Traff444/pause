-- Пауза: authenticated profiles, offline-first state sync and normalized smoking log.
-- Run this migration only in the dedicated Supabase project for this product.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  participant_code text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.smoking_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  deleted_at timestamptz,
  local_date date not null,
  program_day integer not null check (program_day > 0),
  synced_at timestamptz not null default now()
);

create index if not exists smoking_events_user_occurred_idx
  on public.smoking_events (user_id, occurred_at);
create index if not exists smoking_events_user_local_date_idx
  on public.smoking_events (user_id, local_date)
  where deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists app_states_set_updated_at on public.app_states;
create trigger app_states_set_updated_at
before update on public.app_states
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select users.email
  into new.email
  from auth.users as users
  where users.id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before insert or update on public.profiles
for each row execute procedure public.protect_profile_identity();

alter table public.profiles enable row level security;
alter table public.app_states enable row level security;
alter table public.smoking_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "app_states_select_own" on public.app_states;
create policy "app_states_select_own"
on public.app_states for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "app_states_insert_own" on public.app_states;
create policy "app_states_insert_own"
on public.app_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "app_states_update_own" on public.app_states;
create policy "app_states_update_own"
on public.app_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "smoking_events_select_own" on public.smoking_events;
create policy "smoking_events_select_own"
on public.smoking_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "smoking_events_insert_own" on public.smoking_events;
create policy "smoking_events_insert_own"
on public.smoking_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "smoking_events_update_own" on public.smoking_events;
create policy "smoking_events_update_own"
on public.smoking_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
revoke all on public.app_states from anon;
revoke all on public.smoking_events from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.app_states to authenticated;
grant select, insert, update on public.smoking_events to authenticated;

create or replace view public.participant_daily_summary
with (security_invoker = true)
as
with ordered_events as (
  select
    user_id,
    local_date,
    occurred_at,
    extract(
      epoch from (
        occurred_at -
        lag(occurred_at) over (
          partition by user_id, local_date
          order by occurred_at
        )
      )
    ) / 60.0 as interval_minutes
  from public.smoking_events
  where deleted_at is null
),
daily as (
  select
    user_id,
    local_date,
    count(*)::integer as cigarette_count,
    count(interval_minutes)::integer as interval_count,
    round(sum(interval_minutes)::numeric, 1) as total_interval_minutes,
    round(avg(interval_minutes)::numeric, 1) as average_pause_minutes,
    round(max(interval_minutes)::numeric, 1) as longest_pause_minutes
  from ordered_events
  group by user_id, local_date
)
select
  daily.user_id,
  profiles.participant_code,
  profiles.email,
  daily.local_date,
  daily.cigarette_count,
  daily.interval_count,
  daily.total_interval_minutes,
  daily.average_pause_minutes,
  daily.longest_pause_minutes
from daily
join public.profiles on profiles.id = daily.user_id;

revoke all on public.participant_daily_summary from anon;
grant select on public.participant_daily_summary to authenticated;

comment on view public.participant_daily_summary is
  'Pilot dashboard: one row per user/local day. Average pause is sum of same-day intervals divided by interval count.';
