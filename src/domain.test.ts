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
  programDay,
  reductionStartedAt,
  savedMoney,
  secondsUntilGoal,
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

describe('timer and reduction', () => {
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
