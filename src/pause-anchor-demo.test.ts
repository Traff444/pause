import { describe, expect, it } from 'vitest';
import {
  DEMO_GOAL_SECONDS,
  pauseDurationSummary,
  pauseDemoContent,
  pauseDemoMessage,
  recordDemoSmoke,
  type DemoDayStats,
} from './PauseAnchorDemo';

describe('pause anchor demo stages', () => {
  it('changes support copy at the approved progress thresholds', () => {
    expect(pauseDemoMessage(0).eyebrow).toBe('ПАУЗА НАЧАЛАСЬ');
    expect(pauseDemoMessage(29.9).eyebrow).toBe('ПАУЗА НАЧАЛАСЬ');
    expect(pauseDemoMessage(30).eyebrow).toContain('30%');
    expect(pauseDemoMessage(50).eyebrow).toContain('ПОЛОВИНА');
    expect(pauseDemoMessage(80).eyebrow).toContain('80%');
    expect(pauseDemoMessage(100).eyebrow).toBe('ПАУЗА ЗАВЕРШЕНА');
  });

  it('promotes a tactile puzzle only during the final twenty percent', () => {
    expect(pauseDemoContent(79.9).kind).not.toBe('puzzle');
    expect(pauseDemoContent(80).kind).toBe('puzzle');
    expect(pauseDemoContent(100).kind).toBe('puzzle');
  });

  it('rotates fact, technology, and article before the final puzzle', () => {
    expect(pauseDemoContent(0).kind).toBe('fact');
    expect(pauseDemoContent(30).kind).toBe('technology');
    expect(pauseDemoContent(50).kind).toBe('article');
  });

  it('records an early cigarette without crediting the unfinished pause', () => {
    const initial: DemoDayStats = {
      cigarettes: 6,
      measuredPauses: 5,
      reachedPauses: 4,
    };
    const outcome = recordDemoSmoke(initial, 5 * 60);

    expect(outcome.stats).toEqual({
      cigarettes: 7,
      measuredPauses: 6,
      reachedPauses: 4,
    });
    expect(outcome.elapsedSeconds).toBe(12 * 60);
    expect(outcome.reachedGoal).toBe(false);
    expect(outcome.message).toContain('пауза 12 из 17 минут');
    expect(initial).toEqual({ cigarettes: 6, measuredPauses: 5, reachedPauses: 4 });
  });

  it('credits a cigarette recorded after the pause goal', () => {
    const outcome = recordDemoSmoke(
      { cigarettes: 6, measuredPauses: 5, reachedPauses: 4 },
      0,
      DEMO_GOAL_SECONDS,
    );

    expect(outcome.stats).toEqual({
      cigarettes: 7,
      measuredPauses: 6,
      reachedPauses: 5,
    });
    expect(outcome.elapsedSeconds).toBe(DEMO_GOAL_SECONDS);
    expect(outcome.reachedGoal).toBe(true);
    expect(outcome.message).toContain('цель достигнута');
  });

  it('describes achieved pauses without implying a pause quota', () => {
    expect(pauseDurationSummary(1)).toBe('1 ПАУЗА НУЖНОЙ ДЛИТЕЛЬНОСТИ');
    expect(pauseDurationSummary(3)).toBe('3 ПАУЗЫ НУЖНОЙ ДЛИТЕЛЬНОСТИ');
    expect(pauseDurationSummary(5)).toBe('5 ПАУЗ НУЖНОЙ ДЛИТЕЛЬНОСТИ');
    expect(pauseDurationSummary(11)).toBe('11 ПАУЗ НУЖНОЙ ДЛИТЕЛЬНОСТИ');
  });
});
