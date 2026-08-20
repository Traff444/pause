import { describe, expect, it } from 'vitest';
import { PAUSE_TIPS, pauseTipForProgress } from './pause-tips';

describe('pause tips', () => {
  it('contains thirty unique, short tips balanced across the pause stages', () => {
    expect(PAUSE_TIPS).toHaveLength(30);
    expect(new Set(PAUSE_TIPS.map(({ id }) => id)).size).toBe(30);
    expect(new Set(PAUSE_TIPS.map(({ text }) => text)).size).toBe(30);
    expect(PAUSE_TIPS.every(({ text }) => text.length <= 64)).toBe(true);
    expect(PAUSE_TIPS.filter(({ stage }) => stage === 'early')).toHaveLength(10);
    expect(PAUSE_TIPS.filter(({ stage }) => stage === 'middle')).toHaveLength(10);
    expect(PAUSE_TIPS.filter(({ stage }) => stage === 'late')).toHaveLength(10);
  });

  it('selects tips deterministically and only changes them at meaningful thresholds', () => {
    expect(pauseTipForProgress(5, 123)).toEqual(pauseTipForProgress(29.9, 123));
    expect(pauseTipForProgress(30, 123).stage).toBe('middle');
    expect(pauseTipForProgress(50, 123).stage).toBe('middle');
    expect(pauseTipForProgress(30, 123).id).not.toBe(pauseTipForProgress(50, 123).id);
    expect(pauseTipForProgress(80, 123).stage).toBe('late');
  });

  it.each([20, 40, 60, 90])('varies suggestions between realistic pause timestamps at %s%%', (progress) => {
    const base = new Date(2026, 6, 10, 8).getTime();
    const ids = Array.from(
      { length: 30 },
      (_, index) => pauseTipForProgress(progress, base + index * 60_000).id,
    );
    expect(new Set(ids).size).toBeGreaterThanOrEqual(5);
  });

  it('keeps medication and risky food advice out of universal suggestions', () => {
    const allText = PAUSE_TIPS.map(({ text }) => text).join(' ').toLowerCase();
    expect(allText).not.toMatch(/доз|варениклин|бупропион|алкогол|обычн\w* сладост/);
  });
});
