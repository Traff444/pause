export const BLOCKS_COLUMNS = 8;
export const BLOCKS_ROWS = 12;
export const BLOCKS_GRAVITY_MS = 680;
export const BLOCKS_RESET_MS = 800;

export type BlockCell = 0 | 1 | 2 | 3;
export type BlockBoard = BlockCell[][];

export type ActiveBlockPiece = {
  shapeIndex: number;
  rotation: number;
  x: number;
  y: number;
  color: Exclude<BlockCell, 0>;
};

export type FallingBlocksState = {
  board: BlockBoard;
  active: ActiveBlockPiece | null;
  seed: number;
  gravityElapsedMs: number;
  mode: 'playing' | 'paused' | 'resetting';
  resetRemainingMs: number;
  clearedRows: number;
  score: number;
};

type Point = readonly [x: number, y: number];

const BASE_SHAPES: ReadonlyArray<ReadonlyArray<Point>> = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0]],
];

export function createEmptyBlocksBoard(): BlockBoard {
  return Array.from({ length: BLOCKS_ROWS }, () =>
    Array.from({ length: BLOCKS_COLUMNS }, () => 0 as BlockCell),
  );
}

function normalizePoints(points: ReadonlyArray<Point>) {
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  return points
    .map(([x, y]) => [x - minX, y - minY] as Point)
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
}

function rotatePoints(points: ReadonlyArray<Point>, turns: number) {
  let rotated = [...points];
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn += 1) {
    rotated = rotated.map(([x, y]) => [-y, x] as Point);
  }
  return normalizePoints(rotated);
}

export function activePiecePoints(piece: ActiveBlockPiece) {
  return rotatePoints(BASE_SHAPES[piece.shapeIndex] ?? BASE_SHAPES[0], piece.rotation).map(
    ([x, y]) => ({ x: piece.x + x, y: piece.y + y }),
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

function canPlace(board: BlockBoard, piece: ActiveBlockPiece) {
  return activePiecePoints(piece).every(
    ({ x, y }) =>
      x >= 0 &&
      x < BLOCKS_COLUMNS &&
      y >= 0 &&
      y < BLOCKS_ROWS &&
      board[y]?.[x] === 0,
  );
}

function makeNextPiece(seed: number) {
  const shapeRandom = nextRandom(seed);
  const colorRandom = nextRandom(shapeRandom.seed);
  const shapeIndex = Math.floor(shapeRandom.value * BASE_SHAPES.length);
  const points = rotatePoints(BASE_SHAPES[shapeIndex], 0);
  const width = Math.max(...points.map(([x]) => x)) + 1;
  const active: ActiveBlockPiece = {
    shapeIndex,
    rotation: 0,
    x: Math.floor((BLOCKS_COLUMNS - width) / 2),
    y: 0,
    color: (Math.floor(colorRandom.value * 3) + 1) as ActiveBlockPiece['color'],
  };
  return { active, seed: colorRandom.seed };
}

function spawnNext(state: FallingBlocksState): FallingBlocksState {
  const next = makeNextPiece(state.seed);
  if (!canPlace(state.board, next.active)) {
    return {
      ...state,
      active: null,
      seed: next.seed,
      gravityElapsedMs: 0,
      mode: 'resetting',
      resetRemainingMs: BLOCKS_RESET_MS,
    };
  }
  return { ...state, active: next.active, seed: next.seed };
}

export function createFallingBlocksState(seed = Date.now()): FallingBlocksState {
  return spawnNext({
    board: createEmptyBlocksBoard(),
    active: null,
    seed,
    gravityElapsedMs: 0,
    mode: 'playing',
    resetRemainingMs: 0,
    clearedRows: 0,
    score: 0,
  });
}

export function moveFallingBlocks(
  state: FallingBlocksState,
  deltaX: number,
): FallingBlocksState {
  if (state.mode !== 'playing' || !state.active) return state;
  const active = { ...state.active, x: state.active.x + deltaX };
  return canPlace(state.board, active) ? { ...state, active } : state;
}

export function rotateFallingBlocks(state: FallingBlocksState): FallingBlocksState {
  if (state.mode !== 'playing' || !state.active) return state;
  const rotation = (state.active.rotation + 1) % 4;
  for (const kick of [0, -1, 1, -2, 2]) {
    const active = { ...state.active, rotation, x: state.active.x + kick };
    if (canPlace(state.board, active)) return { ...state, active };
  }
  return state;
}

function lockActivePiece(state: FallingBlocksState): FallingBlocksState {
  if (!state.active) return state;
  const board = state.board.map((row) => [...row]);
  activePiecePoints(state.active).forEach(({ x, y }) => {
    if (board[y]?.[x] !== undefined) board[y][x] = state.active!.color;
  });

  const remainingRows = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = BLOCKS_ROWS - remainingRows.length;
  const emptyRows = Array.from({ length: cleared }, () =>
    Array.from({ length: BLOCKS_COLUMNS }, () => 0 as BlockCell),
  );

  return spawnNext({
    ...state,
    board: [...emptyRows, ...remainingRows],
    active: null,
    gravityElapsedMs: 0,
    clearedRows: state.clearedRows + cleared,
    score: state.score + 5 + ([0, 100, 250, 450][cleared] ?? cleared * 200),
  });
}

export function dropFallingBlocksOneRow(state: FallingBlocksState): FallingBlocksState {
  if (state.mode !== 'playing' || !state.active) return state;
  const active = { ...state.active, y: state.active.y + 1 };
  return canPlace(state.board, active) ? { ...state, active } : lockActivePiece(state);
}

export function setFallingBlocksPaused(
  state: FallingBlocksState,
  paused: boolean,
): FallingBlocksState {
  if (state.mode === 'resetting') return state;
  return { ...state, mode: paused ? 'paused' : 'playing' };
}

export function advanceFallingBlocks(
  state: FallingBlocksState,
  elapsedMs: number,
): FallingBlocksState {
  const safeElapsed = Math.max(0, Math.min(elapsedMs, 10_000));
  if (!safeElapsed || state.mode === 'paused') return state;

  if (state.mode === 'resetting') {
    const resetRemainingMs = state.resetRemainingMs - safeElapsed;
    if (resetRemainingMs > 0) return { ...state, resetRemainingMs };
    return spawnNext({
      ...state,
      board: createEmptyBlocksBoard(),
      active: null,
      gravityElapsedMs: 0,
      mode: 'playing',
      resetRemainingMs: 0,
    });
  }

  let next = { ...state, gravityElapsedMs: state.gravityElapsedMs + safeElapsed };
  let safety = 0;
  while (next.mode === 'playing' && next.gravityElapsedMs >= BLOCKS_GRAVITY_MS && safety < 32) {
    next = {
      ...dropFallingBlocksOneRow(next),
      gravityElapsedMs: next.gravityElapsedMs - BLOCKS_GRAVITY_MS,
    };
    safety += 1;
  }
  return next;
}
