import { createClient, type Session } from '@supabase/supabase-js';
import { programDay, todayKey, type AppState, type SmokingEvent } from './domain';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const cloudConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = cloudConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : undefined;

type RemoteStateRow = {
  state: unknown;
};

export type SmokingEventRow = {
  id: string;
  user_id: string;
  occurred_at: string;
  created_at: string;
  deleted_at: string | null;
  local_date: string;
  program_day: number;
};

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  return (
    candidate.version === 2 &&
    typeof candidate.onboarded === 'boolean' &&
    typeof candidate.startedAt === 'number' &&
    Array.isArray(candidate.events) &&
    Boolean(candidate.settings && typeof candidate.settings === 'object')
  );
}

function mergeEvents(local: SmokingEvent[], remote: SmokingEvent[]) {
  const events = new Map<string, SmokingEvent>();
  [...remote, ...local].forEach((event) => {
    const previous = events.get(event.id);
    if (!previous) {
      events.set(event.id, event);
      return;
    }

    events.set(event.id, {
      ...previous,
      ...event,
      deletedAt: Math.max(previous.deletedAt ?? 0, event.deletedAt ?? 0) || undefined,
    });
  });
  return [...events.values()].sort((a, b) => a.occurredAt - b.occurredAt);
}

export function mergeAppStates(local: AppState, remote: AppState | undefined): AppState {
  if (!remote) return local;
  const preferred = local.onboarded ? local : remote;
  const secondary = local.onboarded ? remote : local;

  return {
    ...secondary,
    ...preferred,
    settings: { ...secondary.settings, ...preferred.settings },
    dailyGoals: { ...secondary.dailyGoals, ...preferred.dailyGoals },
    events: mergeEvents(local.events, remote.events),
  };
}

export function buildSmokingEventRows(
  userId: string,
  state: AppState,
): SmokingEventRow[] {
  return state.events.map((event) => ({
    id: event.id,
    user_id: userId,
    occurred_at: new Date(event.occurredAt).toISOString(),
    created_at: new Date(event.createdAt).toISOString(),
    deleted_at: event.deletedAt ? new Date(event.deletedAt).toISOString() : null,
    local_date: todayKey(event.occurredAt),
    program_day: programDay(state.startedAt, event.occurredAt),
  }));
}

function requireCloud() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function getAuthSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  const client = requireCloud();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Сессия не создана');
  return data.session;
}

export async function signUpWithPassword(email: string, password: string) {
  const client = requireCloud();
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session) {
    if (data.user?.identities?.length === 0) {
      throw new Error('User already registered');
    }
    throw new Error('Email not confirmed');
  }
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadCloudState(userId: string): Promise<AppState | undefined> {
  const client = requireCloud();
  const { data, error } = await client
    .from('app_states')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle<RemoteStateRow>();
  if (error) throw error;
  return isAppState(data?.state) ? data.state : undefined;
}

export async function syncCloudState(userId: string, email: string, state: AppState) {
  const client = requireCloud();
  const profileResult = await client.from('profiles').upsert(
    {
      id: userId,
      email,
      participant_code: state.settings.participantCode || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    { onConflict: 'id' },
  );
  if (profileResult.error) throw profileResult.error;

  const stateResult = await client.from('app_states').upsert(
    {
      user_id: userId,
      state,
    },
    { onConflict: 'user_id' },
  );
  if (stateResult.error) throw stateResult.error;

  const events = buildSmokingEventRows(userId, state);
  if (events.length) {
    const eventsResult = await client
      .from('smoking_events')
      .upsert(events, { onConflict: 'id' });
    if (eventsResult.error) throw eventsResult.error;
  }
}
