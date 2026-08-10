import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronLeft, CircleHelp, X } from 'lucide-react';
import { formatTimer } from './domain';
import {
  MERGE_BOARD_SIZE,
  advanceMergeGame,
  createMergeGameState,
  createMergeTutorialState,
  moveMergeGame,
  setMergeGamePaused,
  type MergeDirection,
  type MergeGameState,
} from './twenty-forty-eight';

type Merge2048GameProps = {
  remainingSeconds: number;
  onClose: () => void;
};

type MergeTutorialMode = 'intro' | 'practice' | 'success';
type MergeTutorialSource = 'first-run' | 'help';

const MERGE_TUTORIAL_STORAGE_KEY = 'pauza:merge-2048-tutorial:v1';

function shouldShowMergeTutorial() {
  const override = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('mergeTutorial')
    : undefined;
  if (override === 'show') return true;
  if (override === 'skip') return false;
  try {
    return window.localStorage.getItem(MERGE_TUTORIAL_STORAGE_KEY) !== 'seen';
  } catch {
    return true;
  }
}

function rememberMergeTutorial() {
  try {
    window.localStorage.setItem(MERGE_TUTORIAL_STORAGE_KEY, 'seen');
  } catch {
    // The tutorial can still be completed when storage is unavailable.
  }
}

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
  const [showFirstTutorial] = useState(shouldShowMergeTutorial);
  const engineRef = useRef(
    showFirstTutorial ? createMergeTutorialState(Date.now()) : createMergeGameState(Date.now()),
  );
  const remainingRef = useRef(remainingSeconds);
  const [state, setState] = useState(engineRef.current);
  const [tutorialMode, setTutorialMode] = useState<MergeTutorialMode | undefined>(
    showFirstTutorial ? 'intro' : undefined,
  );
  const [tutorialSource, setTutorialSource] = useState<MergeTutorialSource>('first-run');
  const tutorialModeRef = useRef(tutorialMode);
  const goalReached = remainingSeconds <= 0;
  remainingRef.current = remainingSeconds;
  tutorialModeRef.current = tutorialMode;

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

  const moveWithTutorial = useCallback(
    (direction: MergeDirection) => {
      const mode = tutorialModeRef.current;
      if (mode === 'intro' || mode === 'success') return;
      if (mode === 'practice') {
        if (direction !== 'right') return;
        update((current) => moveMergeGame(current, direction));
        setTutorialMode('success');
        return;
      }
      move(direction);
    },
    [move, update],
  );

  const closeTutorial = useCallback(() => {
    rememberMergeTutorial();
    setTutorialMode(undefined);
  }, []);

  const openHelp = () => {
    setTutorialSource('help');
    setTutorialMode('intro');
  };

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
        score: current.score,
        maxTile: current.maxTile,
        tutorial: tutorialModeRef.current ?? 'closed',
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
      if (event.key === 'ArrowLeft') moveWithTutorial('left');
      else if (event.key === 'ArrowRight') moveWithTutorial('right');
      else if (event.key === 'ArrowUp') moveWithTutorial('up');
      else if (event.key === 'ArrowDown') moveWithTutorial('down');
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
  }, [moveWithTutorial]);

  const finishPointerGesture = (x: number, y: number) => {
    const start = pointerStart.current;
    pointerStart.current = undefined;
    if (!start) return;
    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) moveWithTutorial(deltaX > 0 ? 'right' : 'left');
    else moveWithTutorial(deltaY > 0 ? 'down' : 'up');
  };

  return createPortal(
    <section
      ref={screenRef}
      className="blocks-game-screen merge-game-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Игра Пауза: 2048"
    >
      <header className="blocks-game-header merge-game-header">
        <button type="button" onClick={onClose} aria-label="Вернуться к выбору игры">
          <ChevronLeft />
        </button>
        <strong>ПАУЗА: 2048</strong>
        <div className="merge-header-actions">
          <button type="button" onClick={openHelp} aria-label="Как играть в 2048">
            <CircleHelp />
          </button>
          <button type="button" onClick={onClose} aria-label="Закрыть игру">
            <X />
          </button>
        </div>
      </header>

      <section className={`blocks-goal-card ${goalReached ? 'complete' : ''}`} aria-live="polite">
        <span>{goalReached ? 'ЦЕЛЬ ПРОЙДЕНА' : 'ДО ЦЕЛИ'}</span>
        <strong>{goalReached ? 'Ты уже за ней' : formatTimer(remainingSeconds)}</strong>
        <div className="blocks-goal-line"><span /></div>
      </section>

      <div
        className="merge-summary"
        aria-label={`Очки ${state.score}. Лучшая плитка ${state.maxTile}`}
      >
        <div className="merge-stat">
          <span>ОЧКИ</span>
          <strong data-testid="merge-score">{state.score}</strong>
        </div>
        <div className="merge-stat">
          <span>ЛУЧШАЯ ПЛИТКА</span>
          <strong>{state.maxTile}</strong>
        </div>
      </div>

      <div className={`merge-board-card ${tutorialMode === 'intro' ? 'tutorial-dimmed' : ''}`}>
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
        {tutorialMode === 'practice' && (
          <div className="merge-practice-hint" role="status">
            <span>Свайпни вправо</span>
            <ArrowRight />
          </div>
        )}
      </div>

      <p className="merge-swipe-hint">СВАЙПАЙ ПО ПОЛЮ</p>

      {tutorialMode === 'intro' && (
        <div className="merge-tutorial-backdrop">
          <section
            className="merge-tutorial-card"
            role="dialog"
            aria-label="Как играть в 2048"
            data-testid="merge-tutorial-intro"
          >
            <span className="merge-tutorial-step">1 из 1</span>
            <div className="merge-tutorial-example" aria-label="Два плюс два объединяются">
              <span>2</span>
              <span>2</span>
              <ArrowRight />
            </div>
            <h2>Соединяй одинаковые числа</h2>
            <p>Свайпни в любую сторону — плитки сдвинутся, а одинаковые объединятся.</p>
            <button
              type="button"
              className="merge-tutorial-primary"
              onClick={() => {
                if (tutorialSource === 'help') setTutorialMode(undefined);
                else setTutorialMode('practice');
              }}
              autoFocus
            >
              {tutorialSource === 'help' ? 'ПОНЯТНО' : 'ПОПРОБОВАТЬ'}
            </button>
            {tutorialSource === 'first-run' && (
              <button type="button" className="merge-tutorial-skip" onClick={closeTutorial}>
                Пропустить
              </button>
            )}
          </section>
        </div>
      )}

      {tutorialMode === 'success' && (
        <div className="merge-tutorial-backdrop">
          <section
            className="merge-tutorial-card merge-tutorial-success"
            role="dialog"
            aria-label="Пробный ход выполнен"
            data-testid="merge-tutorial-success"
          >
            <span className="merge-success-icon"><Check /></span>
            <h2>Отлично! 2 + 2 = 4</h2>
            <p>Продолжай объединять плитки и доберись до 2048.</p>
            <button
              type="button"
              className="merge-tutorial-primary"
              onClick={closeTutorial}
              autoFocus
            >
              ИГРАТЬ
            </button>
          </section>
        </div>
      )}

    </section>,
    document.body,
  );
}
