export type Phase = 'observation' | 'reduction' | 'preparation' | 'quit';
export type TabId = 'today' | 'plan' | 'health' | 'stats';
export type StatisticsPeriod = 'Неделя' | 'Месяц' | 'Всё время';

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

export function pauseStatistics(events: SmokingEvent[]) {
  const intervals = intervalsByLocalDay(events);
  const rawTotalMinutes = intervals.reduce((sum, value) => sum + value, 0);
  const totalMinutes = Math.round(rawTotalMinutes * 10) / 10;
  return {
    intervals,
    totalMinutes,
    averageMinutes: intervals.length
      ? Math.round(rawTotalMinutes / intervals.length)
      : undefined,
    longestMinutes: intervals.length ? Math.round(Math.max(...intervals)) : undefined,
  };
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
  const observationDays =
    startedAt === undefined || observationEnd === undefined
      ? 7
      : Math.max(1, (observationEnd - startedAt) / day);
  const daily = Math.round((valid.length / observationDays) * 10) / 10;
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
    measuredPauses: Math.max(0, todayEvents.length - 1),
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

export function baselineDailyRate(state: AppState) {
  if (!state.baseline) return 0;
  const recalculated = calculateBaseline(
    state.events,
    state.baseline.interval,
    state.startedAt,
  ).daily;
  return recalculated > 0 ? recalculated : state.baseline.daily;
}

function reductionTotals(state: AppState, now: number) {
  if (!state.baseline) return { expected: 0, actual: 0 };
  const reductionStart = reductionStartedAt(state.startedAt);
  const elapsed = Math.max(0, now - reductionStart);
  const expected = baselineDailyRate(state) * (elapsed / day);
  const actual = activeEvents(state.events).filter(
    (event) => event.occurredAt >= reductionStart && event.occurredAt <= now,
  ).length;
  return { expected, actual };
}

export function notSmokedExact(state: AppState, now = Date.now()) {
  const { expected, actual } = reductionTotals(state, now);
  return Math.max(0, expected - actual);
}

export function notSmoked(state: AppState, now = Date.now()) {
  return Math.round(notSmokedExact(state, now));
}

export function reductionPercent(state: AppState, now = Date.now()) {
  const { expected } = reductionTotals(state, now);
  if (expected <= 0) return 0;
  return Math.min(100, Math.max(0, (notSmokedExact(state, now) / expected) * 100));
}

export function expectedCigarettesSinceReduction(state: AppState, now = Date.now()) {
  if (!state.baseline) return 0;
  const elapsed = Math.max(0, now - reductionStartedAt(state.startedAt));
  return baselineDailyRate(state) * (elapsed / day);
}

export function savedMoney(state: AppState, now = Date.now()) {
  const { packPrice, cigarettesPerPack } = state.settings;
  if (!packPrice || !cigarettesPerPack) return undefined;
  return Math.round((notSmokedExact(state, now) * packPrice) / cigarettesPerPack);
}

export function lastSevenDayCounts(events: SmokingEvent[], now = Date.now()) {
  const result: Array<{ key: string; label: string; count: number }> = [];
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const valid = activeEvents(events).filter((event) => event.occurredAt <= now);
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

export function statisticsEvents(
  state: AppState,
  period: StatisticsPeriod,
  now = Date.now(),
) {
  const periodStart = new Date(now);
  if (period === 'Неделя') {
    periodStart.setDate(periodStart.getDate() - 6);
  } else if (period === 'Месяц') {
    periodStart.setDate(periodStart.getDate() - 29);
  } else {
    periodStart.setTime(state.startedAt);
  }
  if (period !== 'Всё время') periodStart.setHours(0, 0, 0, 0);

  return activeEvents(state.events).filter(
    (event) => event.occurredAt >= periodStart.getTime() && event.occurredAt <= now,
  );
}

const roundedDailyAverage = (count: number, elapsedDays: number) =>
  Math.round((count / Math.max(1, elapsedDays)) * 10) / 10;

const elapsedLocalDaysFromMidnight = (start: number, end: number) => {
  const endDayStart = new Date(end);
  endDayStart.setHours(0, 0, 0, 0);
  const nextDayStart = new Date(endDayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  const completeDays = localDayOrdinal(end) - localDayOrdinal(start);
  const currentDayFraction =
    (end - endDayStart.getTime()) / (nextDayStart.getTime() - endDayStart.getTime());
  return completeDays + currentDayFraction;
};

export function statisticsSeries(
  state: AppState,
  period: StatisticsPeriod,
  now = Date.now(),
) {
  if (period === 'Неделя') return lastSevenDayCounts(state.events, now);

  const events = activeEvents(state.events).filter((event) => event.occurredAt <= now);
  if (period === 'Месяц') {
    const firstBlockStart = new Date(now);
    firstBlockStart.setHours(0, 0, 0, 0);
    firstBlockStart.setDate(firstBlockStart.getDate() - 29);

    return Array.from({ length: 10 }, (_, index) => {
      const blockStartDate = new Date(firstBlockStart);
      blockStartDate.setDate(blockStartDate.getDate() + index * 3);
      const blockEndDate = new Date(blockStartDate);
      blockEndDate.setDate(blockEndDate.getDate() + 3);
      const blockStart = blockStartDate.getTime();
      const blockEnd = Math.min(blockEndDate.getTime(), now);
      const elapsedDays = Math.max(1, elapsedLocalDaysFromMidnight(blockStart, blockEnd));
      const count = events.filter(
        (event) => event.occurredAt >= blockStart && event.occurredAt < blockEnd,
      ).length;
      return {
        key: `month-${index}`,
        label: String(blockStartDate.getDate()),
        count: roundedDailyAverage(count, elapsedDays),
      };
    });
  }

  const elapsedWeeks = Math.max(1, Math.ceil((now - state.startedAt) / (7 * day)));
  const visibleWeeks = Math.min(16, elapsedWeeks);
  return Array.from({ length: visibleWeeks }, (_, index) => {
    const blockStart = state.startedAt + index * 7 * day;
    const blockEnd = Math.min(blockStart + 7 * day, now);
    const elapsedDays = Math.max(1, (blockEnd - blockStart) / day);
    const count = events.filter(
      (event) => event.occurredAt >= blockStart && event.occurredAt < blockEnd,
    ).length;
    return {
      key: `week-${index}`,
      label: `${index + 1}`,
      count: roundedDailyAverage(count, elapsedDays),
    };
  });
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
