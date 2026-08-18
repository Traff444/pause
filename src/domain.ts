export type Phase = 'observation' | 'reduction' | 'preparation' | 'quit';
export type TabId = 'today' | 'plan' | 'health' | 'stats';

export type SmokingEvent = {
  id: string;
  occurredAt: number;
  createdAt: number;
  deletedAt?: number;
};

export type Baseline = {
  daily: number;
  interval: number;
  step: number;
};

export type SettingsState = {
  participantCode?: string;
  packPrice?: number;
  cigarettesPerPack?: number;
  goalTitle?: string;
  moneyGoal?: number;
};

export type AppState = {
  version: 2;
  onboarded: boolean;
  startedAt: number;
  phase: Phase;
  events: SmokingEvent[];
  activeTab: TabId;
  baseline?: Baseline;
  goal?: number;
  dailyGoals: Record<string, number>;
  dismissedGamePromptAnchor?: number;
  skipStartedAt?: number;
  skippedCount: number;
  activityDone?: string;
  quitStartedAt?: number;
  settings: SettingsState;
};

export const day = 86_400_000;
export const minute = 60_000;

export const createInitialState = (now = Date.now()): AppState => ({
  version: 2,
  onboarded: false,
  startedAt: now,
  phase: 'observation',
  events: [],
  activeTab: 'today',
  dailyGoals: {},
  skippedCount: 0,
  settings: {},
});

export const activeEvents = (events: SmokingEvent[]) =>
  events.filter((event) => !event.deletedAt).sort((a, b) => a.occurredAt - b.occurredAt);

export const todayKey = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateNumber = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateNumber}`;
};

const localDayOrdinal = (timestamp: number) => {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / day;
};

export const programDay = (startedAt: number, now = Date.now()) =>
  Math.max(1, localDayOrdinal(now) - localDayOrdinal(startedAt) + 1);

export const reductionStartedAt = (startedAt: number) => {
  const date = new Date(startedAt);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 7);
  return date.getTime();
};

export const programWeek = (startedAt: number, now = Date.now()) =>
  Math.min(16, Math.max(1, Math.ceil(programDay(startedAt, now) / 7)));

export const formatMinutes = (value: number) => {
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return hours ? `${hours} ч ${mins ? `${mins} мин` : ''}`.trim() : `${mins} мин`;
};

export const formatTimer = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export function intervalsByLocalDay(events: SmokingEvent[]) {
  const grouped = new Map<string, SmokingEvent[]>();
  activeEvents(events).forEach((event) => {
    const key = todayKey(event.occurredAt);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  });

  return [...grouped.values()].flatMap((dailyEvents) => {
    return dailyEvents
      .slice(1)
      .map((event, index) => (event.occurredAt - dailyEvents[index].occurredAt) / minute)
      .filter((value) => value > 0);
  });
}

export function averageSmokingInterval(events: SmokingEvent[]) {
  const intervals = intervalsByLocalDay(events);
  if (!intervals.length) return undefined;
  return Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
}

export function longestSmokingInterval(events: SmokingEvent[]) {
  const intervals = intervalsByLocalDay(events);
  return intervals.length ? Math.round(Math.max(...intervals)) : undefined;
}

export function minutesSinceLastSmoking(events: SmokingEvent[], now = Date.now()) {
  const latest = activeEvents(events).filter((event) => event.occurredAt <= now).at(-1);
  return latest ? Math.max(0, Math.floor((now - latest.occurredAt) / minute)) : undefined;
}

export function calculateBaseline(
  events: SmokingEvent[],
  fallbackInterval = 25,
  startedAt?: number,
): Baseline {
  const observationEnd = startedAt === undefined ? undefined : reductionStartedAt(startedAt);
  const valid = activeEvents(events).filter(
    (event) =>
      (startedAt === undefined || event.occurredAt >= startedAt) &&
      (observationEnd === undefined || event.occurredAt < observationEnd),
  );
  const daily = Math.round((valid.length / 7) * 10) / 10;
  const interval = averageSmokingInterval(valid) ?? fallbackInterval;
  const step = Math.max(2, Math.min(5, Math.round(interval * 0.05)));
  return { daily, interval, step };
}

export function eventsToday(events: SmokingEvent[], now = Date.now()) {
  const key = todayKey(now);
  return activeEvents(events).filter((event) => todayKey(event.occurredAt) === key);
}

export function secondsUntilGoal(
  events: SmokingEvent[],
  goalMinutes: number | undefined,
  now = Date.now(),
) {
  if (!goalMinutes) return 0;
  const eventsList = activeEvents(events).filter((event) => event.occurredAt <= now);
  const anchor = eventsList.at(-1)?.occurredAt;
  if (!anchor) return 0;
  return Math.max(0, Math.ceil((anchor + goalMinutes * minute - now) / 1000));
}

export function todayPauseModel(
  events: SmokingEvent[],
  goalMinutes: number,
  now = Date.now(),
) {
  const todayEvents = eventsToday(events, now).filter((event) => event.occurredAt <= now);
  const anchor = todayEvents.at(-1)?.occurredAt;
  const goalSeconds = Math.max(1, goalMinutes * 60);
  const remainingSeconds = anchor === undefined
    ? goalSeconds
    : Math.max(0, Math.ceil((anchor + goalMinutes * minute - now) / 1000));
  const reachedPauses = todayEvents
    .slice(1)
    .filter((event, index) => event.occurredAt - todayEvents[index].occurredAt >= goalMinutes * minute)
    .length;
  const progress = anchor === undefined
    ? 0
    : Math.min(100, Math.max(0, ((goalSeconds - remainingSeconds) / goalSeconds) * 100));

  return {
    cigarettes: todayEvents.length,
    reachedPauses,
    anchor,
    remainingSeconds,
    progress,
    status: anchor === undefined
      ? ('ready' as const)
      : remainingSeconds > 0
        ? ('running' as const)
        : ('completed' as const),
  };
}

export function dayResult(events: SmokingEvent[], localDate: string, targetMinutes: number) {
  const items = activeEvents(events).filter((event) => todayKey(event.occurredAt) === localDate);
  if (items.length === 0) return 'success' as const;
  if (items.length === 1) return 'neutral' as const;
  const intervals = items
    .slice(1)
    .map((event, index) => (event.occurredAt - items[index].occurredAt) / minute);
  const successful = intervals.filter((value) => value >= targetMinutes).length;
  return successful >= Math.ceil(intervals.length / 2) ? ('success' as const) : ('repeat' as const);
}

export function notSmoked(state: AppState, now = Date.now()) {
  if (!state.baseline) return 0;
  const reductionStart = reductionStartedAt(state.startedAt);
  const elapsed = Math.max(0, now - reductionStart);
  const expected = state.baseline.daily * (elapsed / day);
  const actual = activeEvents(state.events).filter(
    (event) => event.occurredAt >= reductionStart && event.occurredAt <= now,
  ).length;
  return Math.max(0, Math.round(expected - actual));
}

export function expectedCigarettesSinceReduction(state: AppState, now = Date.now()) {
  if (!state.baseline) return 0;
  const elapsed = Math.max(0, now - reductionStartedAt(state.startedAt));
  return state.baseline.daily * (elapsed / day);
}

export function savedMoney(state: AppState, now = Date.now()) {
  const { packPrice, cigarettesPerPack } = state.settings;
  if (!packPrice || !cigarettesPerPack) return undefined;
  return Math.round((notSmoked(state, now) * packPrice) / cigarettesPerPack);
}

export function lastSevenDayCounts(events: SmokingEvent[], now = Date.now()) {
  const result: Array<{ key: string; label: string; count: number }> = [];
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const valid = activeEvents(events);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = todayKey(date.getTime());
    result.push({
      key,
      label: labels[date.getDay()],
      count: valid.filter((event) => todayKey(event.occurredAt) === key).length,
    });
  }
  return result;
}

export function createDemoState(scene: string, now = Date.now()): AppState {
  if (scene === 'today') {
    const state = createInitialState(now - 3 * day);
    const offsets = [510, 405, 310, 205, 92, 18];
    return {
      ...state,
      onboarded: true,
      events: offsets.map((minutesAgo, index) => ({
        id: `demo-today-${index}`,
        occurredAt: now - minutesAgo * minute,
        createdAt: now - minutesAgo * minute,
      })),
    };
  }

  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const startedAt = startDate.getTime() - 24 * day;
  const events: SmokingEvent[] = [];
  const pushDay = (dayIndex: number, count: number) => {
    for (let index = 0; index < count; index += 1) {
      const occurredAt =
        startedAt + dayIndex * day + (8 * 60 + index * Math.floor((6 * 60) / Math.max(1, count))) * minute;
      events.push({ id: `demo-${dayIndex}-${index}`, occurredAt, createdAt: occurredAt });
    }
  };

  for (let index = 0; index < 7; index += 1) pushDay(index, 8);
  for (let index = 7; index < 18; index += 1) pushDay(index, 6);
  [8, 7, 6, 5, 4, 6, 6].forEach((count, index) => pushDay(18 + index, count));

  const activeTab: TabId =
    scene === 'plan' || scene === 'health' || scene === 'stats' ? scene : 'today';

  return {
    version: 2,
    onboarded: true,
    startedAt,
    phase: 'reduction',
    events,
    activeTab,
    baseline: { daily: 8, interval: 25, step: 2 },
    goal: 38,
    dailyGoals: { [todayKey(now)]: 38 },
    skippedCount: 0,
    settings: {
      packPrice: 500,
      cigarettesPerPack: 20,
      goalTitle: 'Новый набор инструментов',
      moneyGoal: 5_000,
    },
  };
}
