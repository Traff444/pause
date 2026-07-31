import { describe, expect, it } from 'vitest';
import { buildSmokingEventRows, mergeAppStates } from './cloud';
import { createInitialState, minute } from './domain';

describe('cloud state', () => {
  it('keeps local progress but restores remote data on a new device', () => {
    const now = new Date(2026, 6, 31, 9).getTime();
    const local = createInitialState(now);
    const remote = {
      ...createInitialState(now - 3 * minute),
      onboarded: true,
      settings: { packPrice: 250, cigarettesPerPack: 20 },
      events: [{ id: 'remote', occurredAt: now - minute, createdAt: now - minute }],
    };

    const merged = mergeAppStates(local, remote);
    expect(merged.onboarded).toBe(true);
    expect(merged.settings.packPrice).toBe(250);
    expect(merged.events.map((event) => event.id)).toEqual(['remote']);
  });

  it('keeps tombstones so an undone event is not restored from cloud', () => {
    const now = new Date(2026, 6, 31, 9).getTime();
    const remote = {
      ...createInitialState(now),
      onboarded: true,
      events: [{ id: 'same', occurredAt: now, createdAt: now }],
    };
    const local = {
      ...remote,
      events: [{ ...remote.events[0], deletedAt: now + minute }],
    };

    expect(mergeAppStates(local, remote).events[0].deletedAt).toBe(now + minute);
  });

  it('serializes local date and program day for researcher reports', () => {
    const startedAt = new Date(2026, 6, 30, 23, 50).getTime();
    const occurredAt = new Date(2026, 6, 31, 8, 10).getTime();
    const state = {
      ...createInitialState(startedAt),
      events: [{ id: 'event', occurredAt, createdAt: occurredAt }],
    };

    const [row] = buildSmokingEventRows('user-id', state);
    expect(row.local_date).toBe('2026-07-31');
    expect(row.program_day).toBe(2);
    expect(row.user_id).toBe('user-id');
  });
});
