import { describe, expect, it } from 'vitest';
import {
  activeEvents,
  averageSmokingInterval,
  calculateBaseline,
  createInitialState,
  day,
  dayResult,
  formatTimer,
  expectedCigarettesSinceReduction,
  intervalsByLocalDay,
  longestSmokingInterval,
  minute,
  minutesSinceLastSmoking,
  notSmoked,
  notSmokedExact,
  pauseStatistics,
  programDay,
  reductionPercent,
  reductionStartedAt,
  savedMoney,
  secondsUntilGoal,
  statisticsEvents,
  statisticsSeries,
  todayPauseModel,
  todayKey,
  type SmokingEvent,
} from './domain';

function event(id: string, occurredAt: number): SmokingEvent {
  return { id, occurredAt, createdAt: occurredAt };
}

describe('baseline', () => {
  it('calculates a 2–5 minute daily step', () => {
    const start = new Date(2026, 6, 1, 8).getTime();
    const events = Array.from({ length: 7 }).flatMap((_, dayIndex) => [
      event(`${dayIndex}-1`, start + dayIndex * day),
      event(`${dayIndex}-2`, start + dayIndex * day + 25 * minute),
      event(`${dayIndex}-3`, start + dayIndex * day + 55 * minute),
      event(`${dayIndex}-4`, start + dayIndex * day + 95 * minute),
    ]);

    const result = calculateBaseline(events);
    expect(result.daily).toBe(4);
    expect(result.interval).toBe(32);
    expect(result.step).toBe(2);
  });

  it('keeps every real same-day interval instead of dropping the longest one', () => {
    const base = new Date(2026, 6, 1, 8).getTime();
    const events = [
      event('1', base),
      event('2', base + 20 * minute),
      event('3', base + 50 * minute),
      event('4', base + 110 * minute),
    ];

    expect(intervalsByLocalDay(events)).toEqual([20, 30, 60]);
    expect(averageSmokingInterval(events)).toBe(37);
    expect(longestSmokingInterval(events)).toBe(60);
  });

  it('does not count an overnight gap as a smoking interval', () => {
    const first = new Date(2026, 6, 1, 23, 50).getTime();
    const second = new Date(2026, 6, 2, 8, 10).getTime();

    expect(intervalsByLocalDay([event('night', first), event('morning', second)])).toEqual([]);
  });

  it('uses only the seven-day observation window', () => {
    const startedAt = new Date(2026, 6, 1, 8).getTime();
    const afterObservation = reductionStartedAt(startedAt) + minute;
    const events = [
      event('day-one', startedAt),
      event('day-one-2', startedAt + 30 * minute),
      event('too-late', afterObservation),
    ];

    expect(calculateBaseline(events, 25, startedAt)).toEqual({
      daily: 0.3,
      interval: 30,
      step: 2,
    });
  });

  it('does not treat the partial onboarding day as a complete observation day', () => {
    const startedAt = new Date(2026, 6, 1, 21).getTime();
    const events = [event('partial', new Date(2026, 6, 1, 22).getTime())];

    for (let date = 2; date <= 7; date += 1) {
      for (let index = 0; index < 10; index += 1) {
        events.push(event(`${date}-${index}`, new Date(2026, 6, date, 8 + index).getTime()));
      }
    }

    expect(calculateBaseline(events, 25, startedAt).daily).toBe(10);
  });

  it('uses a calm fallback with insufficient intervals', () => {
    expect(calculateBaseline([])).toEqual({ daily: 0, interval: 25, step: 2 });
  });
});

describe('daily result', () => {
  const base = new Date(2026, 6, 10, 8).getTime();
  const key = todayKey(base);

  it('treats zero cigarettes as success and one as neutral', () => {
    expect(dayResult([], key, 30)).toBe('success');
    expect(dayResult([event('one', base)], key, 30)).toBe('neutral');
  });

  it('requires at least half of intervals to reach the goal', () => {
    const items = [
      event('1', base),
      event('2', base + 35 * minute),
      event('3', base + 55 * minute),
    ];
    expect(dayResult(items, key, 30)).toBe('success');
    expect(dayResult(items, key, 40)).toBe('repeat');
  });
});

describe('statistics periods', () => {
  it('keeps the monthly daily average accurate in the final partial block', () => {
    const now = new Date(2026, 6, 31, 0, 0).getTime();
    const startedAt = new Date(2026, 6, 1, 0, 0).getTime();
    const events: SmokingEvent[] = [];
    for (let date = 2; date <= 30; date += 1) {
      for (let index = 0; index < 10; index += 1) {
        events.push(event(`${date}-${index}`, new Date(2026, 6, date, 1 + index).getTime()));
      }
    }
    const state = { ...createInitialState(startedAt), events };

    expect(statisticsSeries(state, 'Месяц', now).map(({ count }) => count)).toEqual(
      Array.from({ length: 10 }, () => 10),
    );
  });

  it('keeps calendar-day averages stable across daylight-saving changes', () => {
    const environment = (globalThis as unknown as {
      process: { env: Record<string, string | undefined> };
    }).process.env;
    const previousTimezone = environment.TZ;
    environment.TZ = 'America/New_York';
    try {
      const now = new Date(2026, 2, 11, 0, 0).getTime();
      const startedAt = new Date(2026, 1, 1, 0, 0).getTime();
      const events: SmokingEvent[] = [];
      const cursor = new Date(2026, 1, 10, 0, 0);
      while (cursor.getTime() < now) {
        for (let index = 0; index < 10; index += 1) {
          events.push(
            event(
              `${cursor.getMonth()}-${cursor.getDate()}-${index}`,
              new Date(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate(),
                8 + index,
              ).getTime(),
            ),
          );
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      const state = { ...createInitialState(startedAt), events };

      expect(statisticsSeries(state, 'Месяц', now).map(({ count }) => count)).toEqual(
        Array.from({ length: 10 }, () => 10),
      );
    } finally {
      environment.TZ = previousTimezone;
    }
  });

  it('divides the current all-time week by elapsed time and ignores future events', () => {
    const startedAt = new Date(2026, 6, 1, 0, 0).getTime();
    const now = new Date(2026, 6, 10, 0, 0).getTime();
    const events: SmokingEvent[] = [];
    for (let date = 1; date <= 9; date += 1) {
      for (let index = 0; index < 10; index += 1) {
        events.push(event(`${date}-${index}`, new Date(2026, 6, date, 1 + index).getTime()));
      }
    }
    events.push(event('future', new Date(2026, 6, 10, 1).getTime()));
    events.push({
      ...event('deleted', new Date(2026, 6, 9, 23).getTime()),
      deletedAt: now - minute,
    });
    const state = { ...createInitialState(startedAt), events };

    expect(statisticsSeries(state, 'Всё время', now).map(({ count }) => count)).toEqual([10, 10]);
  });

  it('uses local midnight for period boundaries and excludes deleted and future marks', () => {
    const now = new Date(2026, 6, 10, 0, 5).getTime();
    const state = {
      ...createInitialState(new Date(2026, 6, 1).getTime()),
      events: [
        event('included', new Date(2026, 6, 4, 0, 1).getTime()),
        event('too-old', new Date(2026, 6, 3, 23, 59).getTime()),
        event('future', now + minute),
        { ...event('deleted', new Date(2026, 6, 8, 12).getTime()), deletedAt: now - minute },
      ],
    };

    expect(statisticsEvents(state, 'Неделя', now).map(({ id }) => id)).toEqual(['included']);
  });

  it('does not substitute historical pauses when the selected period has no interval', () => {
    const selectedPeriodEvents = [event('only', new Date(2026, 6, 10, 12).getTime())];

    expect(pauseStatistics(selectedPeriodEvents)).toEqual({
      intervals: [],
      totalMinutes: 0,
      averageMinutes: undefined,
      longestMinutes: undefined,
    });
  });
});

describe('timer and reduction', () => {
  it('corrects a previously stored baseline built from a partial onboarding day', () => {
    const startedAt = new Date(2026, 6, 1, 21).getTime();
    const observationEvents = [event('partial', new Date(2026, 6, 1, 22).getTime())];
    for (let date = 2; date <= 7; date += 1) {
      for (let index = 0; index < 10; index += 1) {
        observationEvents.push(
          event(`${date}-${index}`, new Date(2026, 6, date, 8 + index).getTime()),
        );
      }
    }
    const state = {
      ...createInitialState(startedAt),
      onboarded: true,
      baseline: { daily: 8.7, interval: 25, step: 2 },
      events: observationEvents,
    };
    const now = reductionStartedAt(startedAt) + 10 * day;

    expect(expectedCigarettesSinceReduction(state, now)).toBe(100);
  });

  it('builds the live pause model from current-day events only', () => {
    const now = new Date(2026, 6, 10, 12).getTime();
    const previousNight = event('night', new Date(2026, 6, 9, 23, 40).getTime());
    const first = event('first', now - 70 * minute);
    const second = event('second', now - 30 * minute);
    const deleted = { ...event('deleted', now - 5 * minute), deletedAt: now - minute };
    const future = event('future', now + minute);

    expect(todayPauseModel([previousNight, first, second, deleted, future], 35, now)).toEqual({
      cigarettes: 2,
      measuredPauses: 1,
      reachedPauses: 1,
      anchor: second.occurredAt,
      remainingSeconds: 5 * 60,
      progress: expect.closeTo((30 / 35) * 100),
      status: 'running',
    });
  });

  it('keeps the first cigarette pause-neutral and exposes ready and completed states', () => {
    const now = new Date(2026, 6, 10, 12).getTime();
    expect(todayPauseModel([], 20, now)).toMatchObject({
      cigarettes: 0,
      measuredPauses: 0,
      reachedPauses: 0,
      anchor: undefined,
      status: 'ready',
    });

    expect(todayPauseModel([event('first', now - 25 * minute)], 20, now)).toMatchObject({
      cigarettes: 1,
      measuredPauses: 0,
      reachedPauses: 0,
      remainingSeconds: 0,
      progress: 100,
      status: 'completed',
    });
  });

  it('counts down from the latest event in seconds', () => {
    const now = new Date(2026, 6, 10, 12).getTime();
    const latest = event('latest', now - 10 * minute);
    expect(secondsUntilGoal([latest], 25, now)).toBe(15 * 60);
    expect(formatTimer(15 * 60)).toBe('15:00');
  });

  it('ignores a future event when choosing the countdown anchor', () => {
    const now = new Date(2026, 6, 10, 12).getTime();
    const events = [
      event('current', now - 10 * minute),
      event('future', now + 2 * 60 * minute),
    ];

    expect(secondsUntilGoal(events, 25, now)).toBe(15 * 60);
  });

  it('stays complete while the user waits longer and restarts only after a new cigarette', () => {
    const firstSmoke = new Date(2026, 6, 10, 8).getTime();
    const firstEvent = event('first', firstSmoke);

    expect(secondsUntilGoal([firstEvent], 60, firstSmoke + 56 * minute)).toBe(4 * 60);
    expect(secondsUntilGoal([firstEvent], 60, firstSmoke + 66 * minute)).toBe(0);
    expect(secondsUntilGoal([firstEvent], 60, firstSmoke + 90 * minute)).toBe(0);

    const secondSmoke = firstSmoke + 90 * minute;
    expect(
      secondsUntilGoal([firstEvent, event('second', secondSmoke)], 60, secondSmoke),
    ).toBe(60 * 60);
  });

  it('never returns a negative not-smoked count', () => {
    const now = new Date(2026, 6, 20, 12).getTime();
    const state = {
      ...createInitialState(now - 10 * day),
      onboarded: true,
      baseline: { daily: 10, interval: 25, step: 2 },
      events: Array.from({ length: 40 }, (_, index) =>
        event(String(index), now - index * 30 * minute),
      ),
    };
    expect(notSmoked(state, now)).toBeGreaterThanOrEqual(0);
  });

  it('uses elapsed reduction time instead of crediting a full day in advance', () => {
    const startedAt = new Date(2026, 6, 1, 12).getTime();
    const reductionStart = reductionStartedAt(startedAt);
    const now = reductionStart + 12 * 60 * minute;
    const state = {
      ...createInitialState(startedAt),
      onboarded: true,
      baseline: { daily: 10, interval: 25, step: 2 },
      events: [event('actual-1', reductionStart + 2 * 60 * minute)],
    };

    expect(expectedCigarettesSinceReduction(state, now)).toBe(5);
    expect(notSmoked(state, now)).toBe(4);
  });

  it('uses the precise avoided amount for money and caps the reduction percentage', () => {
    const startedAt = new Date(2026, 6, 1, 12).getTime();
    const now = reductionStartedAt(startedAt) + 2 * 60 * minute;
    const state = {
      ...createInitialState(startedAt),
      onboarded: true,
      baseline: { daily: 8, interval: 25, step: 2 },
      settings: { packPrice: 500, cigarettesPerPack: 20 },
    };

    expect(notSmokedExact(state, now)).toBeCloseTo(2 / 3);
    expect(notSmoked(state, now)).toBe(1);
    expect(reductionPercent(state, now)).toBe(100);
    expect(savedMoney(state, now)).toBe(17);
  });

  it('reports the actual distance from the latest valid mark', () => {
    const now = new Date(2026, 6, 10, 12).getTime();
    const events = [
      event('older', now - 45 * minute),
      { ...event('deleted', now - 5 * minute), deletedAt: now - minute },
      event('future', now + minute),
    ];

    expect(minutesSinceLastSmoking(events, now)).toBe(45);
    expect(minutesSinceLastSmoking([], now)).toBeUndefined();
  });

  it('moves to a new program day at local midnight', () => {
    const startedAt = new Date(2026, 6, 1, 23, 55).getTime();
    const shortlyAfterMidnight = new Date(2026, 6, 2, 0, 5).getTime();

    expect(programDay(startedAt, shortlyAfterMidnight)).toBe(2);
  });

  it('ignores deleted events and keeps active events ordered', () => {
    const base = new Date(2026, 6, 10, 12).getTime();
    const events = [
      event('later', base + minute),
      { ...event('deleted', base), deletedAt: base + 2 * minute },
      event('earlier', base - minute),
    ];

    expect(activeEvents(events).map(({ id }) => id)).toEqual(['earlier', 'later']);
  });

  it('connects a pack price with saved money using pack size', () => {
    const startedAt = new Date(2026, 6, 10, 12).getTime();
    const now = reductionStartedAt(startedAt) + 3 * day;
    const state = {
      ...createInitialState(startedAt),
      onboarded: true,
      baseline: { daily: 10, interval: 25, step: 2 },
      settings: { packPrice: 250, cigarettesPerPack: 20 },
    };

    expect(savedMoney(state, now)).toBe(375);
  });
});
