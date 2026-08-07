import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, X } from 'lucide-react';
import { formatTimer } from './domain';
import {
  MERGE_BOARD_SIZE,
  advanceMergeGame,
  createMergeGameState,
  moveMergeGame,
  setMergeGamePaused,
  type MergeDirection,
  type MergeGameState,
} from './twenty-forty-eight';

type Merge2048GameProps = {
  remainingSeconds: number;
  onClose: () => void;
};

const TILE_COLORS: Record<number, { fill: string; text: string; stroke: string }> = {
  2: { fill: '#ffffff', text: '#1246b8', stroke: '#c8d3e8' },
  4: { fill: '#dceaf8', text: '#1246b8', stroke: '#b8d2ed' },
  8: { fill: '#a9cff4', text: '#0c399b', stroke: '#7cb7f1' },
  16: { fill: '#7cb7f1', text: '#092d7f', stroke: '#5b9fdf' },
  32: { fill: '#4f84d5', text: '#ffffff', stroke: '#356bbf' },
  64: { fill: '#225bc3', text: '#ffffff', stroke: '#1246b8' },
};

function tilePalette(value: number) {
  return TILE_COLORS[value] ?? { fill: '#1246b8', text: '#ffffff', stroke: '#0c399b' };
}

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

function drawMergeGame(canvas: HTMLCanvasElement, state: MergeGameState) {
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

  const outerPadding = Math.max(10, bounds.width * 0.035);
  const gap = Math.max(7, bounds.width * 0.025);
  const boardSize = Math.min(bounds.width, bounds.height) - outerPadding * 2;
  const cellSize = (boardSize - gap * (MERGE_BOARD_SIZE + 1)) / MERGE_BOARD_SIZE;
  const offsetX = (bounds.width - boardSize) / 2;
  const offsetY = (bounds.height - boardSize) / 2;

  roundedRect(context, offsetX, offsetY, boardSize, boardSize, 22);
  context.fillStyle = '#edf0f5';
  context.fill();

  state.board.forEach((row, y) => {
    row.forEach((value, x) => {
      const left = offsetX + gap + x * (cellSize + gap);
      const top = offsetY + gap + y * (cellSize + gap);
      roundedRect(context, left, top, cellSize, cellSize, Math.max(10, cellSize * 0.16));
      if (!value) {
        context.fillStyle = '#f8f7f3';
        context.fill();
        context.strokeStyle = '#dde1e8';
        context.lineWidth = 1;
        context.stroke();
        return;
      }

      const palette = tilePalette(value);
      context.fillStyle = palette.fill;
      context.fill();
      context.strokeStyle = palette.stroke;
      context.lineWidth = 1.6;
      context.stroke();
      context.fillStyle = palette.text;
      const digits = String(value).length;
      const fontSize = cellSize * (digits <= 2 ? 0.4 : digits === 3 ? 0.32 : 0.25);
      context.font = `800 ${fontSize}px 'Manrope Variable', 'Manrope', sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(value), left + cellSize / 2, top + cellSize / 2 + 1);
    });
  });

  if (state.mode === 'resetting') {
    context.fillStyle = 'rgba(248, 247, 243, 0.92)';
    roundedRect(context, offsetX + 20, offsetY + boardSize / 2 - 35, boardSize - 40, 70, 18);
    context.fill();
    context.fillStyle = '#1246b8';
    context.font = "700 16px 'Manrope Variable', 'Manrope', sans-serif";
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Поле обновилось', offsetX + boardSize / 2, offsetY + boardSize / 2);
  }
}

export function Merge2048Game({ remainingSeconds, onClose }: Merge2048GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const engineRef = useRef(createMergeGameState(Date.now()));
  const remainingRef = useRef(remainingSeconds);
  const [state, setState] = useState(engineRef.current);
  const goalReached = remainingSeconds <= 0;
  remainingRef.current = remainingSeconds;

  const commit = useCallback((next: MergeGameState) => {
    engineRef.current = next;
    setState(next);
  }, []);

  const update = useCallback(
    (recipe: (current: MergeGameState) => MergeGameState) => commit(recipe(engineRef.current)),
    [commit],
  );

  const move = useCallback(
    (direction: MergeDirection) => update((current) => moveMergeGame(current, direction)),
    [update],
  );

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (timestamp: number) => {
      const elapsed = Math.min(100, Math.max(0, timestamp - previous));
      previous = timestamp;
      if (!document.hidden) update((current) => advanceMergeGame(current, elapsed));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [update]);

  useEffect(() => {
    const onVisibilityChange = () => {
      update((current) => setMergeGamePaused(current, document.hidden));
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [update]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMergeGame(canvas, state);
    const observer = new ResizeObserver(() => drawMergeGame(canvas, engineRef.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    const previousRender = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = () => {
      const current = engineRef.current;
      return JSON.stringify({
        game: '2048',
        coordinateSystem: 'origin top-left; x increases right; y increases down; board 4x4',
        mode: current.mode,
        pauseTimer: {
          remainingSeconds: remainingRef.current,
          goalReached: remainingRef.current <= 0,
        },
        board: current.board,
        moves: current.moves,
        maxTile: current.maxTile,
        emptyCells: current.board.flat().filter((value) => value === 0).length,
        resetRemainingMs: Math.max(0, Math.round(current.resetRemainingMs)),
      });
    };
    window.advanceTime = (milliseconds: number) => {
      update((current) => advanceMergeGame(current, milliseconds));
    };
    return () => {
      window.render_game_to_text = previousRender;
      window.advanceTime = previousAdvance;
    };
  }, [update]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move('left');
      else if (event.key === 'ArrowRight') move('right');
      else if (event.key === 'ArrowUp') move('up');
      else if (event.key === 'ArrowDown') move('down');
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
  }, [move]);

  const finishPointerGesture = (x: number, y: number) => {
    const start = pointerStart.current;
    pointerStart.current = undefined;
    if (!start) return;
    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? 'right' : 'left');
    else move(deltaY > 0 ? 'down' : 'up');
  };

  return createPortal(
    <section
      ref={screenRef}
      className="blocks-game-screen merge-game-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Игра Пауза: 2048"
    >
      <header className="blocks-game-header">
        <button type="button" onClick={onClose} aria-label="Вернуться к выбору игры">
          <ChevronLeft />
        </button>
        <strong>ПАУЗА: 2048</strong>
        <button type="button" onClick={onClose} aria-label="Закрыть игру">
          <X />
        </button>
      </header>

      <section className={`blocks-goal-card ${goalReached ? 'complete' : ''}`} aria-live="polite">
        <span>{goalReached ? 'ЦЕЛЬ ПРОЙДЕНА' : 'ДО ЦЕЛИ'}</span>
        <strong>{goalReached ? 'Ты уже за ней' : formatTimer(remainingSeconds)}</strong>
        <div className="blocks-goal-line"><span /></div>
      </section>

      <div className="merge-summary" aria-label={`Максимальная плитка ${state.maxTile}`}>
        <span>СОБЕРИ ПАРЫ</span>
        <strong>{state.maxTile}</strong>
      </div>

      <div className="merge-board-card">
        <canvas
          ref={canvasRef}
          className="merge-canvas"
          aria-label="Игровое поле 2048 четыре на четыре. Свайпни в любую сторону."
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

      <div className="merge-controls" aria-label="Управление игрой">
        <button type="button" onClick={() => move('left')} aria-label="Сдвинуть влево"><ArrowLeft /></button>
        <button type="button" onClick={() => move('up')} aria-label="Сдвинуть вверх"><ArrowUp /></button>
        <button type="button" onClick={() => move('down')} aria-label="Сдвинуть вниз"><ArrowDown /></button>
        <button type="button" onClick={() => move('right')} aria-label="Сдвинуть вправо"><ArrowRight /></button>
      </div>

    </section>,
    document.body,
  );
}
