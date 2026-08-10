import { describe, expect, it } from 'vitest';
import {
  MERGE_RESET_MS,
  advanceMergeGame,
  canMoveMergeBoard,
  createEmptyMergeBoard,
  createMergeGameState,
  createMergeTutorialState,
  moveMergeGame,
  type MergeGameState,
} from './twenty-forty-eight';

function withBoard(board: number[][]): MergeGameState {
  return {
    ...createMergeGameState(42),
    board,
    seed: 42,
    mode: 'playing',
    resetRemainingMs: 0,
    moves: 0,
    maxTile: Math.max(...board.flat()),
  };
}

describe('2048 merge engine', () => {
  it('starts deterministically with exactly two tiles', () => {
    const first = createMergeGameState(2048);
    const second = createMergeGameState(2048);
    expect(first).toEqual(second);
    expect(first.board.flat().filter(Boolean)).toHaveLength(2);
  });

  it('creates a predictable first swipe for the tutorial', () => {
    const tutorial = createMergeTutorialState(2048);
    expect(tutorial.board[0]).toEqual([2, 2, 0, 0]);
    expect(tutorial.board.flat().filter(Boolean)).toHaveLength(2);

    const moved = moveMergeGame(tutorial, 'right');
    expect(moved.score).toBe(4);
    expect(moved.maxTile).toBe(4);
  });

  it('merges equal pairs once per move', () => {
    const board = createEmptyMergeBoard();
    board[0] = [2, 2, 2, 2];
    const moved = moveMergeGame(withBoard(board), 'left');
    expect(moved.board[0].slice(0, 2)).toEqual([4, 4]);
    expect(moved.board.flat().filter(Boolean)).toHaveLength(3);
    expect(moved.score).toBe(8);
  });

  it('does not merge a freshly created tile twice', () => {
    const board = createEmptyMergeBoard();
    board[0] = [2, 2, 4, 0];
    const moved = moveMergeGame(withBoard(board), 'left');
    expect(moved.board[0].slice(0, 2)).toEqual([4, 4]);
    expect(moved.score).toBe(4);
  });

  it('adds the value of every newly merged tile to the score', () => {
    const board = createEmptyMergeBoard();
    board[0] = [4, 4, 8, 8];
    const moved = moveMergeGame(withBoard(board), 'left');
    expect(moved.score).toBe(24);
  });

  it('moves vertically in the requested direction', () => {
    const board = createEmptyMergeBoard();
    board[2][1] = 2;
    const up = moveMergeGame(withBoard(board), 'up');
    expect(up.board[0][1]).toBe(2);
  });

  it('does not spawn a tile when the board did not change', () => {
    const board = createEmptyMergeBoard();
    board[0][0] = 2;
    const state = withBoard(board);
    expect(moveMergeGame(state, 'left')).toBe(state);
  });

  it('detects a board with no remaining moves', () => {
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMoveMergeBoard(board)).toBe(false);
    const resetting = moveMergeGame(withBoard(board), 'left');
    expect(resetting.mode).toBe('resetting');
    expect(resetting.resetRemainingMs).toBe(MERGE_RESET_MS);

    const restarted = advanceMergeGame(resetting, MERGE_RESET_MS);
    expect(restarted.mode).toBe('playing');
    expect(restarted.board.flat().filter(Boolean)).toHaveLength(2);
  });

  it('keeps the session score after a soft board reset', () => {
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    const resetting = moveMergeGame({ ...withBoard(board), score: 256 }, 'left');
    const restarted = advanceMergeGame(resetting, MERGE_RESET_MS);
    expect(restarted.score).toBe(256);
  });
});
