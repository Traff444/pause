export const MERGE_BOARD_SIZE = 4;
export const MERGE_RESET_MS = 800;

export type MergeDirection = 'left' | 'right' | 'up' | 'down';
export type MergeBoard = number[][];

export type MergeGameState = {
  board: MergeBoard;
  seed: number;
  mode: 'playing' | 'paused' | 'resetting';
  resetRemainingMs: number;
  moves: number;
  score: number;
  maxTile: number;
};

export function createEmptyMergeBoard(): MergeBoard {
  return Array.from({ length: MERGE_BOARD_SIZE }, () =>
    Array.from({ length: MERGE_BOARD_SIZE }, () => 0),
  );
}

function nextRandom(seed: number) {
  let value = seed >>> 0 || 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const nextSeed = value >>> 0;
  return { seed: nextSeed, value: nextSeed / 0x1_0000_0000 };
}

function spawnTile(board: MergeBoard, seed: number) {
  const empty = board.flatMap((row, y) =>
    row.flatMap((value, x) => (value === 0 ? [{ x, y }] : [])),
  );
  if (!empty.length) return { board, seed, spawned: false };

  const positionRandom = nextRandom(seed);
  const valueRandom = nextRandom(positionRandom.seed);
  const position = empty[Math.floor(positionRandom.value * empty.length)];
  const nextBoard = board.map((row) => [...row]);
  nextBoard[position.y][position.x] = valueRandom.value < 0.9 ? 2 : 4;
  return { board: nextBoard, seed: valueRandom.seed, spawned: true };
}

function slideLine(line: number[]) {
  const compact = line.filter(Boolean);
  const merged: number[] = [];
  let score = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const mergedValue = compact[index] * 2;
      merged.push(mergedValue);
      score += mergedValue;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }
  return {
    line: [...merged, ...Array.from({ length: MERGE_BOARD_SIZE - merged.length }, () => 0)],
    score,
  };
}

function coordinates(direction: MergeDirection, line: number, offset: number) {
  if (direction === 'left') return { x: offset, y: line };
  if (direction === 'right') return { x: MERGE_BOARD_SIZE - 1 - offset, y: line };
  if (direction === 'up') return { x: line, y: offset };
  return { x: line, y: MERGE_BOARD_SIZE - 1 - offset };
}

export function canMoveMergeBoard(board: MergeBoard) {
  for (let y = 0; y < MERGE_BOARD_SIZE; y += 1) {
    for (let x = 0; x < MERGE_BOARD_SIZE; x += 1) {
      if (board[y][x] === 0) return true;
      if (x + 1 < MERGE_BOARD_SIZE && board[y][x] === board[y][x + 1]) return true;
      if (y + 1 < MERGE_BOARD_SIZE && board[y][x] === board[y + 1][x]) return true;
    }
  }
  return false;
}

export function createMergeGameState(seed = Date.now()): MergeGameState {
  const first = spawnTile(createEmptyMergeBoard(), seed);
  const second = spawnTile(first.board, first.seed);
  return {
    board: second.board,
    seed: second.seed,
    mode: 'playing',
    resetRemainingMs: 0,
    moves: 0,
    score: 0,
    maxTile: Math.max(...second.board.flat()),
  };
}

export function createMergeTutorialState(seed = Date.now()): MergeGameState {
  const state = createMergeGameState(seed);
  const board = createEmptyMergeBoard();
  board[0][0] = 2;
  board[0][1] = 2;
  return {
    ...state,
    board,
    maxTile: 2,
  };
}

export function moveMergeGame(
  state: MergeGameState,
  direction: MergeDirection,
): MergeGameState {
  if (state.mode !== 'playing') return state;
  const board = state.board.map((row) => [...row]);
  let scoreGain = 0;

  for (let line = 0; line < MERGE_BOARD_SIZE; line += 1) {
    const values = Array.from({ length: MERGE_BOARD_SIZE }, (_, offset) => {
      const { x, y } = coordinates(direction, line, offset);
      return state.board[y][x];
    });
    const moved = slideLine(values);
    scoreGain += moved.score;
    moved.line.forEach((value, offset) => {
      const { x, y } = coordinates(direction, line, offset);
      board[y][x] = value;
    });
  }

  const changed = board.some((row, y) => row.some((value, x) => value !== state.board[y][x]));
  if (!changed) {
    return canMoveMergeBoard(state.board)
      ? state
      : { ...state, mode: 'resetting', resetRemainingMs: MERGE_RESET_MS };
  }

  const spawned = spawnTile(board, state.seed);
  const next = {
    ...state,
    board: spawned.board,
    seed: spawned.seed,
    moves: state.moves + 1,
    score: state.score + scoreGain,
    maxTile: Math.max(state.maxTile, ...spawned.board.flat()),
  };
  return canMoveMergeBoard(next.board)
    ? next
    : { ...next, mode: 'resetting', resetRemainingMs: MERGE_RESET_MS };
}

export function setMergeGamePaused(state: MergeGameState, paused: boolean): MergeGameState {
  if (state.mode === 'resetting') return state;
  return { ...state, mode: paused ? 'paused' : 'playing' };
}

export function advanceMergeGame(state: MergeGameState, elapsedMs: number): MergeGameState {
  const safeElapsed = Math.max(0, Math.min(elapsedMs, 10_000));
  if (!safeElapsed || state.mode !== 'resetting') return state;
  const resetRemainingMs = state.resetRemainingMs - safeElapsed;
  if (resetRemainingMs > 0) return { ...state, resetRemainingMs };
  const restarted = createMergeGameState(state.seed);
  return {
    ...restarted,
    moves: state.moves,
    score: state.score,
    maxTile: Math.max(state.maxTile, restarted.maxTile),
  };
}
