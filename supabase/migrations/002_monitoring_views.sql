-- Transparent pilot monitoring: every interval used by the daily calculation.

create or replace view public.participant_smoking_timeline
with (security_invoker = true)
as
with ordered_events as (
  select
    events.user_id,
    events.id as event_id,
    events.local_date,
    events.program_day,
    events.occurred_at,
    row_number() over (
      partition by events.user_id, events.local_date
      order by events.occurred_at, events.id
    )::integer as cigarette_number,
    lag(events.occurred_at) over (
      partition by events.user_id, events.local_date
      order by events.occurred_at, events.id
    ) as previous_occurred_at
  from public.smoking_events as events
  where events.deleted_at is null
)
select
  ordered_events.user_id,
  profiles.participant_code,
  profiles.email,
  ordered_events.local_date,
  ordered_events.program_day,
  ordered_events.event_id,
  ordered_events.cigarette_number,
  ordered_events.occurred_at,
  ordered_events.previous_occurred_at,
  round(
    (
      extract(
        epoch from (
          ordered_events.occurred_at - ordered_events.previous_occurred_at
        )
      ) / 60.0
    )::numeric,
    1
  ) as interval_minutes
from ordered_events
join public.profiles on profiles.id = ordered_events.user_id;

revoke all on public.participant_smoking_timeline from anon;
grant select on public.participant_smoking_timeline to authenticated;

comment on view public.participant_smoking_timeline is
  'Pilot audit trail: one active smoking event per row and the same-day interval used in summaries.';

create or replace view public.participant_daily_summary
with (security_invoker = true)
as
select
  timeline.user_id,
  timeline.participant_code,
  timeline.email,
  timeline.local_date,
  count(*)::integer as cigarette_count,
  count(timeline.interval_minutes)::integer as interval_count,
  round(sum(timeline.interval_minutes), 1) as total_interval_minutes,
  round(avg(timeline.interval_minutes), 1) as average_pause_minutes,
  round(max(timeline.interval_minutes), 1) as longest_pause_minutes
from public.participant_smoking_timeline as timeline
group by
  timeline.user_id,
  timeline.participant_code,
  timeline.email,
  timeline.local_date;

revoke all on public.participant_daily_summary from anon;
grant select on public.participant_daily_summary to authenticated;

comment on view public.participant_daily_summary is
  'Pilot dashboard: one row per user/local day. Average pause is total same-day interval minutes divided by interval count.';
