import { describe, expect, it } from 'vitest';
import {
  BLOCKS_COLUMNS,
  BLOCKS_GRAVITY_MS,
  BLOCKS_RESET_MS,
  BLOCKS_ROWS,
  activePiecePoints,
  advanceFallingBlocks,
  createEmptyBlocksBoard,
  createFallingBlocksState,
  dropFallingBlocksOneRow,
  moveFallingBlocks,
  rotateFallingBlocks,
  type ActiveBlockPiece,
  type FallingBlocksState,
} from './falling-blocks';

function withPiece(
  active: ActiveBlockPiece,
  board = createEmptyBlocksBoard(),
): FallingBlocksState {
  return {
    ...createFallingBlocksState(42),
    board,
    active,
    seed: 42,
    gravityElapsedMs: 0,
    mode: 'playing',
    resetRemainingMs: 0,
    clearedRows: 0,
    score: 0,
  };
}

describe('falling blocks engine', () => {
  it('is deterministic for a fixed seed', () => {
    expect(createFallingBlocksState(2026)).toEqual(createFallingBlocksState(2026));
  });

  it('moves inside the board and stops at both horizontal walls', () => {
    let state = withPiece({ shapeIndex: 1, rotation: 0, x: 3, y: 0, color: 1 });
    for (let index = 0; index < 20; index += 1) state = moveFallingBlocks(state, -1);
    expect(Math.min(...activePiecePoints(state.active!).map(({ x }) => x))).toBe(0);

    for (let index = 0; index < 20; index += 1) state = moveFallingBlocks(state, 1);
    expect(Math.max(...activePiecePoints(state.active!).map(({ x }) => x))).toBe(BLOCKS_COLUMNS - 1);
  });

  it('rotates with a wall kick and never crosses the board edge', () => {
    const state = withPiece({ shapeIndex: 3, rotation: 1, x: BLOCKS_COLUMNS - 1, y: 1, color: 2 });
    const rotated = rotateFallingBlocks(state);
    const points = activePiecePoints(rotated.active!);
    expect(rotated.active?.rotation).toBe(2);
    expect(points.every(({ x }) => x >= 0 && x < BLOCKS_COLUMNS)).toBe(true);
  });

  it('advances by deterministic gravity steps', () => {
    const state = withPiece({ shapeIndex: 0, rotation: 0, x: 3, y: 0, color: 1 });
    expect(advanceFallingBlocks(state, BLOCKS_GRAVITY_MS - 1).active?.y).toBe(0);
    expect(advanceFallingBlocks(state, BLOCKS_GRAVITY_MS).active?.y).toBe(1);
  });

  it('locks a piece and clears a completed row', () => {
    const board = createEmptyBlocksBoard();
    board[BLOCKS_ROWS - 1] = Array.from(
      { length: BLOCKS_COLUMNS },
      (_, index) => (index < BLOCKS_COLUMNS - 2 ? 1 : 0),
    );
    const state = withPiece(
      {
        shapeIndex: 1,
        rotation: 0,
        x: BLOCKS_COLUMNS - 2,
        y: BLOCKS_ROWS - 1,
        color: 2,
      },
      board,
    );

    const next = dropFallingBlocksOneRow(state);
    expect(next.clearedRows).toBe(1);
    expect(next.score).toBe(105);
    expect(next.board[0].every((cell) => cell === 0)).toBe(true);
    expect(next.active).not.toBeNull();
  });

  it('softly resets after a new piece cannot spawn', () => {
    const board = createEmptyBlocksBoard();
    board[0][3] = 1;
    board[0][4] = 1;
    const state = withPiece({ shapeIndex: 0, rotation: 0, x: 0, y: 1, color: 2 }, board);
    state.board[2][0] = 3;

    const resetting = dropFallingBlocksOneRow(state);
    expect(resetting.mode).toBe('resetting');
    expect(resetting.active).toBeNull();
    expect(resetting.resetRemainingMs).toBe(BLOCKS_RESET_MS);

    const restarted = advanceFallingBlocks(resetting, BLOCKS_RESET_MS);
    expect(restarted.mode).toBe('playing');
    expect(restarted.board.flat().every((cell) => cell === 0)).toBe(true);
    expect(restarted.active).not.toBeNull();
  });
});
