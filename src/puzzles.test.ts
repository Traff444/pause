import { describe, expect, it } from 'vitest';
import {
  PUZZLES,
  TACTILE_PUZZLES,
  PUZZLE_ANSWER_DELAY_MS,
  PUZZLE_HINT_DELAY_MS,
  canRevealPuzzleAnswer,
  canRevealPuzzleHint,
  createInitialPuzzleState,
  createPuzzleSession,
  isPuzzleResponseCorrect,
  moveSlideTile,
  puzzleById,
  revealPuzzleAnswer,
  revealPuzzleHint,
  startOrResumePuzzle,
  submitPuzzleResponse,
} from './puzzles';

describe('puzzle catalog', () => {
  it('keeps the legacy catalog locally and exposes eight tactile layouts', () => {
    expect(PUZZLES).toHaveLength(38);
    expect(new Set(PUZZLES.map((puzzle) => puzzle.id)).size).toBe(38);
    expect(PUZZLES.filter((puzzle) => puzzle.mechanic === 'choice')).toHaveLength(10);
    expect(PUZZLES.filter((puzzle) => puzzle.mechanic === 'order')).toHaveLength(10);
    expect(PUZZLES.filter((puzzle) => puzzle.mechanic === 'visual')).toHaveLength(10);
    expect(TACTILE_PUZZLES).toHaveLength(8);
    expect(TACTILE_PUZZLES.every((puzzle) => puzzle.mechanic === 'slide')).toBe(true);
  });

  it('has a valid answer and complete content for every puzzle', () => {
    PUZZLES.forEach((puzzle) => {
      expect(puzzle.title.length).toBeGreaterThan(3);
      expect(puzzle.hint.length).toBeGreaterThan(3);
      expect(puzzle.explanation.length).toBeGreaterThan(3);

      if (puzzle.mechanic === 'choice') {
        expect(puzzle.options.some((option) => option.id === puzzle.correctOptionId)).toBe(true);
      } else if (puzzle.mechanic === 'visual') {
        expect(puzzle.items.some((item) => item.id === puzzle.correctItemId)).toBe(true);
      } else if (puzzle.mechanic === 'order') {
        expect(new Set(puzzle.correctOrder)).toEqual(new Set(puzzle.items.map((item) => item.id)));
      } else {
        expect(puzzle.start).toHaveLength(puzzle.size ** 2);
        expect(new Set(puzzle.start)).toEqual(new Set(puzzle.correctOrder));
      }
    });
  });

  it('contains only solvable three-by-three layouts', () => {
    TACTILE_PUZZLES.forEach((puzzle) => {
      const tiles = puzzle.start.filter((tile) => tile !== '0').map(Number);
      let inversions = 0;
      tiles.forEach((tile, index) => {
        tiles.slice(index + 1).forEach((next) => {
          if (tile > next) inversions += 1;
        });
      });
      expect(inversions % 2).toBe(0);
      expect(puzzle.start).not.toEqual(puzzle.correctOrder);
    });
  });
});

describe('puzzle session', () => {
  it('unlocks hint after two minutes and answer after five minutes', () => {
    const now = 1_000_000;
    const session = createPuzzleSession(PUZZLES[0], 10, now + 20 * 60_000, now);
    expect(session.hintUnlockAt).toBe(now + PUZZLE_HINT_DELAY_MS);
    expect(session.answerUnlockAt).toBe(now + PUZZLE_ANSWER_DELAY_MS);
    expect(canRevealPuzzleHint(session, session.hintUnlockAt - 1)).toBe(false);
    expect(canRevealPuzzleHint(session, session.hintUnlockAt)).toBe(true);
    expect(canRevealPuzzleAnswer(session, session.answerUnlockAt - 1)).toBe(false);
    expect(canRevealPuzzleAnswer(session, session.answerUnlockAt)).toBe(true);
  });

  it('uses the end of a shorter pause as the unlock boundary', () => {
    const now = 2_000_000;
    const pauseEndAt = now + 70_000;
    const session = createPuzzleSession(PUZZLES[0], 10, pauseEndAt, now);
    expect(session.hintUnlockAt).toBe(pauseEndAt);
    expect(session.answerUnlockAt).toBe(pauseEndAt);
  });

  it('does not reveal gated content early', () => {
    const now = 3_000_000;
    const session = createPuzzleSession(PUZZLES[0], 10, now + 10 * 60_000, now);
    expect(revealPuzzleHint(session, now + 1).hintRevealed).toBe(false);
    expect(revealPuzzleAnswer(session, now + 1).status).toBe('active');
    expect(revealPuzzleHint(session, session.hintUnlockAt).hintRevealed).toBe(true);
    expect(revealPuzzleAnswer(session, session.answerUnlockAt).status).toBe('revealed');
  });

  it('keeps the same active puzzle only within the same pause', () => {
    const now = 4_000_000;
    const first = startOrResumePuzzle(createInitialPuzzleState(), 100, now + 600_000, now);
    const resumed = startOrResumePuzzle(first, 100, now + 700_000, now + 10_000);
    expect(resumed).toEqual(first);

    const nextPause = startOrResumePuzzle(first, 200, now + 700_000, now + 10_000);
    expect(nextPause.current?.pauseAnchor).toBe(200);
    expect(nextPause.current?.puzzleId).not.toBe(first.current?.puzzleId);
  });

  it('does not repeat a puzzle before the local catalog is exhausted', () => {
    let state = createInitialPuzzleState();
    for (let index = 0; index < TACTILE_PUZZLES.length; index += 1) {
      const anchor = 10_000 + index * 1_000;
      state = startOrResumePuzzle(state, anchor, anchor + 600_000, anchor);
      expect(state.current).toBeDefined();
      expect(puzzleById(state.current!.puzzleId)!.mechanic).toBe('slide');
      state = {
        ...state,
        current: { ...state.current!, status: 'revealed', revealedAt: anchor + 300_000 },
      };
    }
    expect(state.seenPuzzleIds).toHaveLength(TACTILE_PUZZLES.length);
    expect(new Set(state.seenPuzzleIds).size).toBe(TACTILE_PUZZLES.length);

    const exhausted = startOrResumePuzzle(state, 999_999, 1_999_999, 999_999);
    expect(exhausted.current).toBeUndefined();
  });

  it('validates choice, visual, and order responses deterministically', () => {
    PUZZLES.forEach((puzzle) => {
      const correct = puzzle.mechanic === 'choice'
        ? [puzzle.correctOptionId]
        : puzzle.mechanic === 'visual'
          ? [puzzle.correctItemId]
          : [...puzzle.correctOrder];
      expect(isPuzzleResponseCorrect(puzzle, correct)).toBe(true);
    });
  });

  it('moves only a tile next to the free cell', () => {
    const puzzle = TACTILE_PUZZLES[0];
    const moved = moveSlideTile(puzzle, puzzle.start, '6');
    expect(moved).toEqual(['1', '2', '3', '8', '7', '4', '6', '0', '5']);
    expect(moveSlideTile(puzzle, puzzle.start, '1')).toEqual(puzzle.start);
  });

  it('replaces a saved legacy riddle with a tactile puzzle on open', () => {
    const legacy = puzzleById('choice-three-switches')!;
    const now = 4_500_000;
    const legacySession = createPuzzleSession(legacy, 100, now + 600_000, now);
    const next = startOrResumePuzzle(
      { version: 1, current: legacySession, seenPuzzleIds: [legacy.id] },
      100,
      now + 600_000,
      now + 1,
    );
    expect(next.current?.puzzleId).not.toBe(legacy.id);
    expect(puzzleById(next.current!.puzzleId)?.mechanic).toBe('slide');
  });

  it('records attempts and reveals a correct solution immediately', () => {
    const puzzle = puzzleById('choice-two-fathers')!;
    const now = 5_000_000;
    const session = createPuzzleSession(puzzle, 10, now + 600_000, now);
    const wrong = submitPuzzleResponse({ ...session, response: ['a'] }, puzzle, now + 1);
    expect(wrong.status).toBe('active');
    expect(wrong.attempts).toBe(1);

    const solved = submitPuzzleResponse({ ...wrong, response: ['b'] }, puzzle, now + 2);
    expect(solved.status).toBe('solved');
    expect(solved.attempts).toBe(2);
    expect(solved.solvedAt).toBe(now + 2);
  });
});
