import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, RotateCw, X } from 'lucide-react';
import {
  BLOCKS_COLUMNS,
  BLOCKS_ROWS,
  activePiecePoints,
  advanceFallingBlocks,
  createFallingBlocksState,
  dropFallingBlocksOneRow,
  moveFallingBlocks,
  rotateFallingBlocks,
  setFallingBlocksPaused,
  type BlockCell,
  type FallingBlocksState,
} from './falling-blocks';
import { formatTimer } from './domain';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void | Promise<void>;
  }
}

type FallingBlocksGameProps = {
  remainingSeconds: number;
  onClose: () => void;
};

const CELL_COLORS: Record<Exclude<BlockCell, 0>, { fill: string; stroke: string }> = {
  1: { fill: '#1246b8', stroke: '#0c399b' },
  2: { fill: '#7cb7f1', stroke: '#5b9fdf' },
  3: { fill: '#fbfbfa', stroke: '#343943' },
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawGame(canvas: HTMLCanvasElement, state: FallingBlocksState) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(bounds.width * ratio);
  const pixelHeight = Math.round(bounds.height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, bounds.width, bounds.height);

  const padding = 9;
  const cellSize = Math.min(
    (bounds.width - padding * 2) / BLOCKS_COLUMNS,
    (bounds.height - padding * 2) / BLOCKS_ROWS,
  );
  const boardWidth = cellSize * BLOCKS_COLUMNS;
  const boardHeight = cellSize * BLOCKS_ROWS;
  const offsetX = (bounds.width - boardWidth) / 2;
  const offsetY = (bounds.height - boardHeight) / 2;

  context.strokeStyle = '#e7e8ea';
  context.lineWidth = 1;
  for (let column = 0; column <= BLOCKS_COLUMNS; column += 1) {
    const x = offsetX + column * cellSize;
    context.beginPath();
    context.moveTo(x, offsetY);
    context.lineTo(x, offsetY + boardHeight);
    context.stroke();
  }
  for (let row = 0; row <= BLOCKS_ROWS; row += 1) {
    const y = offsetY + row * cellSize;
    context.beginPath();
    context.moveTo(offsetX, y);
    context.lineTo(offsetX + boardWidth, y);
    context.stroke();
  }

  const drawCell = (x: number, y: number, color: Exclude<BlockCell, 0>, active = false) => {
    const inset = Math.max(3, cellSize * 0.09);
    const left = offsetX + x * cellSize + inset;
    const top = offsetY + y * cellSize + inset;
    const size = cellSize - inset * 2;
    const palette = CELL_COLORS[color];
    roundedRect(context, left, top, size, size, Math.max(5, cellSize * 0.14));
    context.fillStyle = palette.fill;
    context.fill();
    context.strokeStyle = palette.stroke;
    context.lineWidth = active ? 2.25 : 1.6;
    context.stroke();
  };

  state.board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawCell(x, y, cell);
    });
  });
  if (state.active) {
    activePiecePoints(state.active).forEach(({ x, y }) => drawCell(x, y, state.active!.color, true));
  }

  if (state.mode === 'resetting') {
    context.fillStyle = 'rgba(248, 247, 243, 0.9)';
    roundedRect(context, offsetX + 18, offsetY + boardHeight / 2 - 35, boardWidth - 36, 70, 18);
    context.fill();
    context.fillStyle = '#1246b8';
    context.font = "700 16px 'Manrope Variable', 'Manrope', sans-serif";
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Поле обновилось', offsetX + boardWidth / 2, offsetY + boardHeight / 2);
  }
}

export function FallingBlocksGame({
  remainingSeconds,
  onClose,
}: FallingBlocksGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef(createFallingBlocksState(Date.now()));
  const remainingRef = useRef(remainingSeconds);
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const [state, setState] = useState(engineRef.current);
  const goalReached = remainingSeconds <= 0;
  remainingRef.current = remainingSeconds;

  const commit = useCallback((next: FallingBlocksState) => {
    engineRef.current = next;
    setState(next);
  }, []);

  const update = useCallback(
    (recipe: (current: FallingBlocksState) => FallingBlocksState) => {
      commit(recipe(engineRef.current));
    },
    [commit],
  );

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (timestamp: number) => {
      const elapsed = Math.min(100, Math.max(0, timestamp - previous));
      previous = timestamp;
      if (!document.hidden) update((current) => advanceFallingBlocks(current, elapsed));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [update]);

  useEffect(() => {
    const onVisibilityChange = () => {
      update((current) => setFallingBlocksPaused(current, document.hidden));
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [update]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGame(canvas, state);
    const observer = new ResizeObserver(() => drawGame(canvas, engineRef.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    const previousRender = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = () => {
      const current = engineRef.current;
      const settled = current.board.flatMap((row, y) =>
        row.flatMap((color, x) => (color ? [{ x, y, color }] : [])),
      );
      return JSON.stringify({
        coordinateSystem: 'origin top-left; x increases right; y increases down; board 8x12',
        mode: current.mode,
        pauseTimer: {
          remainingSeconds: remainingRef.current,
          goalReached: remainingRef.current <= 0,
        },
        active: current.active
          ? {
              ...current.active,
              cells: activePiecePoints(current.active),
            }
          : null,
        settled,
        clearedRows: current.clearedRows,
        score: current.score,
        stage: Math.floor(current.score / 500) + 1,
        resetRemainingMs: Math.max(0, Math.round(current.resetRemainingMs)),
      });
    };
    window.advanceTime = (milliseconds: number) => {
      update((current) => advanceFallingBlocks(current, milliseconds));
    };
    return () => {
      window.render_game_to_text = previousRender;
      window.advanceTime = previousAdvance;
    };
  }, [update]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') update((current) => moveFallingBlocks(current, -1));
      else if (event.key === 'ArrowRight') update((current) => moveFallingBlocks(current, 1));
      else if (event.key === 'ArrowUp' || event.key === ' ') update(rotateFallingBlocks);
      else if (event.key === 'ArrowDown') update(dropFallingBlocksOneRow);
      else if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void screenRef.current?.requestFullscreen();
      } else if (event.key === 'Escape' && document.fullscreenElement) {
        void document.exitFullscreen();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [update]);

  const finishPointerGesture = (x: number, y: number) => {
    const start = pointerStart.current;
    pointerStart.current = undefined;
    if (!start) return;
    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.abs(deltaX) > Math.max(28, Math.abs(deltaY))) {
      update((current) => moveFallingBlocks(current, deltaX > 0 ? 1 : -1));
    } else if (deltaY > 28) {
      update(dropFallingBlocksOneRow);
    } else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
      update(rotateFallingBlocks);
    }
  };

  return createPortal(
    <section
      ref={screenRef}
      className="blocks-game-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Игра Пауза: Блоки"
    >
      <header className="blocks-game-header">
        <button type="button" onClick={onClose} aria-label="Вернуться к таймеру">
          <ChevronLeft />
        </button>
        <strong>ПАУЗА: БЛОКИ</strong>
        <button type="button" onClick={onClose} aria-label="Закрыть игру">
          <X />
        </button>
      </header>

      <section className={`blocks-goal-card ${goalReached ? 'complete' : ''}`} aria-live="polite">
        <span>{goalReached ? 'ЦЕЛЬ ПРОЙДЕНА' : 'ДО ЦЕЛИ'}</span>
        <strong>{goalReached ? 'Ты уже за ней' : formatTimer(remainingSeconds)}</strong>
        <div className="blocks-goal-line"><span /></div>
      </section>

      <div className="blocks-score-summary" aria-label={`${state.score} очков, этап ${Math.floor(state.score / 500) + 1}`}>
        <span>ОЧКИ <strong>{state.score}</strong></span>
        <span>ЭТАП <strong>{Math.floor(state.score / 500) + 1}</strong></span>
      </div>

      <div className="blocks-board-card">
        <canvas
          ref={canvasRef}
          className="blocks-canvas"
          aria-label="Игровое поле 8 на 12. Свайпы двигают фигуру, касание поворачивает."
          onPointerDown={(event) => {
            pointerStart.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => finishPointerGesture(event.clientX, event.clientY)}
          onPointerCancel={() => {
            pointerStart.current = undefined;
          }}
        />
      </div>

      <div className="blocks-controls" aria-label="Управление игрой">
        <button type="button" onClick={() => update((current) => moveFallingBlocks(current, -1))} aria-label="Сдвинуть влево">
          <ArrowLeft />
        </button>
        <button type="button" onClick={() => update(rotateFallingBlocks)} aria-label="Повернуть фигуру">
          <RotateCw />
        </button>
        <button type="button" onClick={() => update((current) => moveFallingBlocks(current, 1))} aria-label="Сдвинуть вправо">
          <ArrowRight />
        </button>
      </div>

    </section>,
    document.body,
  );
}
