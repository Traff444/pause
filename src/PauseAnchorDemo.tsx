import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  Circle,
  Gamepad2,
  Heart,
  Lightbulb,
  RotateCcw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { FallingBlocksGame } from './FallingBlocksGame';
import { Merge2048Game } from './Merge2048Game';
import { PauseStoryViewer } from './PauseStories';
import { PuzzleDialog } from './PuzzleExperience';
import { formatTimer } from './domain';
import { pauseStoryById, type PauseStoryId } from './pause-stories';
import {
  TACTILE_PUZZLES,
  createPuzzleSession,
  startOrResumePuzzle,
  type LocalPuzzleState,
  type PuzzleSession,
} from './puzzles';
import './pause-anchor-demo.css';

export const DEMO_GOAL_SECONDS = 17 * 60;

export type DemoDayStats = {
  cigarettes: number;
  measuredPauses: number;
  reachedPauses: number;
};

type DemoSmokeOutcome = {
  stats: DemoDayStats;
  elapsedSeconds: number;
  reachedGoal: boolean;
  message: string;
};

const INITIAL_DEMO_STATS: DemoDayStats = {
  cigarettes: 6,
  measuredPauses: 5,
  reachedPauses: 4,
};

type DemoMode = 'ready' | 'running';
type ActiveGame = 'blocks' | 'merge';

type DemoSmokeSnapshot = {
  mode: DemoMode;
  remainingSeconds: number;
  stats: DemoDayStats;
  puzzleSession?: PuzzleSession;
  puzzleOpen: boolean;
  readerOpen: boolean;
  gameChooserOpen: boolean;
};

type DemoToast = {
  message: string;
  snapshot: DemoSmokeSnapshot;
};

type DemoMessage = {
  eyebrow: string;
  title: string;
  copy: string;
};

type DemoContent = {
  kind: 'fact' | 'technology' | 'article' | 'puzzle';
  label: string;
  title: string;
  duration: string;
  copy: string;
};

function cigaretteWord(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сигарета';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сигареты';
  return 'сигарет';
}

function pauseDurationLabel(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ПАУЗА НУЖНОЙ ДЛИТЕЛЬНОСТИ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'ПАУЗЫ НУЖНОЙ ДЛИТЕЛЬНОСТИ';
  }
  return 'ПАУЗ НУЖНОЙ ДЛИТЕЛЬНОСТИ';
}

export function pauseDurationSummary(value: number) {
  return `${value} ${pauseDurationLabel(value)}`;
}

export function recordDemoSmoke(
  stats: DemoDayStats,
  remainingSeconds: number,
  goalSeconds = DEMO_GOAL_SECONDS,
): DemoSmokeOutcome {
  const safeGoal = Math.max(1, goalSeconds);
  const safeRemaining = Math.max(0, Math.min(safeGoal, remainingSeconds));
  const elapsedSeconds = safeGoal - safeRemaining;
  const reachedGoal = safeRemaining <= 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const goalMinutes = Math.round(safeGoal / 60);

  return {
    stats: {
      cigarettes: stats.cigarettes + 1,
      measuredPauses: stats.measuredPauses + 1,
      reachedPauses: stats.reachedPauses + (reachedGoal ? 1 : 0),
    },
    elapsedSeconds,
    reachedGoal,
    message: reachedGoal
      ? `Пауза ${goalMinutes} минут — цель достигнута. Новая пауза началась`
      : `Сигарета отмечена · пауза ${elapsedMinutes} из ${goalMinutes} минут. Новая пауза началась`,
  };
}

export function pauseDemoMessage(progress: number): DemoMessage {
  if (progress >= 100) {
    return {
      eyebrow: 'ПАУЗА ЗАВЕРШЕНА',
      title: 'Решение по-прежнему за тобой',
      copy: 'Кнопка снова доступна.',
    };
  }
  if (progress >= 80) {
    return {
      eyebrow: 'УЖЕ 80% ПАУЗЫ ПОЗАДИ',
      title: 'Осталось совсем немного',
      copy: 'Можно переключиться на головоломку.',
    };
  }
  if (progress >= 50) {
    return {
      eyebrow: 'ПОЛОВИНА ПАУЗЫ ПОЗАДИ',
      title: 'Продолжай в своём темпе',
      copy: 'Необязательно следить за каждой минутой.',
    };
  }
  if (progress >= 30) {
    return {
      eyebrow: 'УЖЕ 30% ПАУЗЫ ПОЗАДИ',
      title: 'Хорошее начало — без спешки',
      copy: 'Время идёт, пока ты занимаешь мысли.',
    };
  }
  return {
    eyebrow: 'ПАУЗА НАЧАЛАСЬ',
    title: 'Просто побудь здесь',
    copy: '',
  };
}

export function pauseDemoContent(progress: number): DemoContent {
  if (progress >= 80) {
    return {
      kind: 'puzzle',
      label: 'ФИНАЛЬНЫЕ 20%',
      title: 'Собери плитки по порядку',
      duration: 'около 3 минут',
      copy: 'Подвигай плитки и незаметно проведи последние минуты.',
    };
  }
  if (progress >= 50) {
    return {
      kind: 'article',
      label: 'СТАТЬЯ',
      title: 'Почему желание приходит волнами',
      duration: '3 минуты',
      copy: 'Небольшой материал на середину паузы.',
    };
  }
  if (progress >= 30) {
    return {
      kind: 'technology',
      label: 'ТЕХНОЛОГИИ',
      title: 'Как телефон узнаёт, где мы',
      duration: '4 минуты',
      copy: 'Спутники, вышки и Wi‑Fi объяснены простыми словами.',
    };
  }
  return {
    kind: 'fact',
    label: 'ИНТЕРЕСНЫЙ ФАКТ',
    title: 'Почему запах возвращает воспоминания',
    duration: '2 минуты',
    copy: 'Короткая история для начала паузы.',
  };
}

function ContentIcon({ kind }: { kind: DemoContent['kind'] }) {
  if (kind === 'puzzle') return <BrainCircuit />;
  if (kind === 'technology') return <Sparkles />;
  if (kind === 'article') return <BookOpen />;
  return <Lightbulb />;
}

type PauseAnchorScreenProps = {
  cigarettes: number;
  reachedPauses: number;
  goalSeconds?: number;
  remainingSeconds: number;
  now: number;
  pauseAnchor?: number;
  puzzleState: LocalPuzzleState;
  onPuzzleStateChange: (recipe: (current: LocalPuzzleState) => LocalPuzzleState) => void;
  onOpenSettings: () => void;
  onSmoke: () => void;
};

function storyForProgress(progress: number): PauseStoryId {
  if (progress >= 50) return 'music';
  if (progress >= 30) return 'moon';
  return 'scent';
}

export function PauseAnchorScreen({
  cigarettes,
  reachedPauses,
  goalSeconds,
  remainingSeconds,
  now,
  pauseAnchor,
  puzzleState,
  onPuzzleStateChange,
  onOpenSettings,
  onSmoke,
}: PauseAnchorScreenProps) {
  const [activeGame, setActiveGame] = useState<ActiveGame>();
  const [gameChooserOpen, setGameChooserOpen] = useState(false);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [storyId, setStoryId] = useState<PauseStoryId>();
  const pauseActive = Boolean(pauseAnchor !== undefined && goalSeconds && goalSeconds > 0);
  const safeGoalSeconds = Math.max(1, goalSeconds ?? 1);
  const progress = pauseActive
    ? Math.min(100, Math.max(0, ((safeGoalSeconds - remainingSeconds) / safeGoalSeconds) * 100))
    : 0;
  const message = pauseActive
    ? pauseDemoMessage(progress)
    : {
        eyebrow: 'ТВОЯ ПАУЗА',
        title: 'Один жест перед сигаретой',
        copy: 'Круг останется на месте и проведёт через всё ожидание.',
      };
  const content = pauseDemoContent(progress);
  const featuredStory = pauseStoryById(storyForProgress(progress));
  const currentPuzzleSession =
    puzzleState.current?.pauseAnchor === pauseAnchor ? puzzleState.current : undefined;
  const puzzleFinished = content.kind === 'puzzle' &&
    currentPuzzleSession?.status !== undefined &&
    currentPuzzleSession.status !== 'active';
  const anchorAvailable = !pauseActive || remainingSeconds <= 0;
  const progressStyle = {
    '--anchor-progress': `${Math.max(0, Math.min(360, progress * 3.6))}deg`,
  } as CSSProperties;

  const closeActivities = () => {
    setActiveGame(undefined);
    setGameChooserOpen(false);
    setPuzzleOpen(false);
    setStoryId(undefined);
  };

  const recordSmoke = () => {
    closeActivities();
    onSmoke();
  };

  const openPuzzle = () => {
    if (pauseAnchor === undefined || !goalSeconds) return;
    onPuzzleStateChange((current) =>
      startOrResumePuzzle(current, pauseAnchor, pauseAnchor + goalSeconds * 1_000, now),
    );
    setPuzzleOpen(true);
  };

  const updatePuzzleSession = (nextSession: PuzzleSession) => {
    onPuzzleStateChange((current) =>
      current.current?.puzzleId === nextSession.puzzleId
        ? { ...current, current: nextSession }
        : current,
    );
  };

  if (activeGame) {
    const props = {
      remainingSeconds,
      onClose: () => setActiveGame(undefined),
    };
    return activeGame === 'blocks'
      ? <FallingBlocksGame {...props} />
      : <Merge2048Game {...props} />;
  }

  if (puzzleOpen && currentPuzzleSession) {
    return (
      <PuzzleDialog
        session={currentPuzzleSession}
        now={now}
        remainingSeconds={remainingSeconds}
        onChange={updatePuzzleSession}
        onClose={() => setPuzzleOpen(false)}
      />
    );
  }

  if (storyId) {
    return (
      <PauseStoryViewer
        story={pauseStoryById(storyId)}
        remainingSeconds={remainingSeconds}
        onClose={() => setStoryId(undefined)}
        onChangeStory={setStoryId}
      />
    );
  }

  return (
    <section className="anchor-live-screen">
      <header className="anchor-demo-header">
        <strong>ПАУЗА</strong>
        <span aria-hidden="true" />
        <button
          type="button"
          className="anchor-demo-settings"
          aria-label="Настройки"
          onClick={onOpenSettings}
        ><Settings /></button>
      </header>

      <section className="anchor-demo-hero">
        <section className="anchor-demo-today" aria-label="Статистика за сегодня">
          <p>СЕГОДНЯ</p>
          <div className="anchor-demo-today-grid">
            <span>
              <strong>{cigarettes}</strong>
              <small>{cigaretteWord(cigarettes)}</small>
            </span>
            <span>
              <strong>{reachedPauses}</strong>
              <small>{pauseDurationLabel(reachedPauses)}</small>
            </span>
          </div>
        </section>

        <section
          className={`anchor-demo-support${message.copy ? '' : ' compact'}`}
          aria-live="polite"
        >
          <p>{message.eyebrow}</p>
          <h1>{message.title}</h1>
          {message.copy && <span>{message.copy}</span>}
        </section>

        <div className="anchor-demo-center">
          {anchorAvailable ? (
            <button
              type="button"
              className={`anchor-demo-control available ${pauseActive ? 'completed' : 'ready'}`}
              style={progressStyle}
              aria-label={pauseActive
                ? 'Иду курить. Отметить сигарету и начать новую паузу'
                : 'Иду курить. Начать паузу'}
              onClick={recordSmoke}
            >
              <span className="anchor-demo-bezel">
                <span className="anchor-demo-core"><strong>ИДУ КУРИТЬ</strong></span>
              </span>
            </button>
          ) : (
            <div
              className="anchor-demo-control waiting"
              style={progressStyle}
              role="timer"
              aria-label={`До конца паузы ${formatTimer(remainingSeconds)}`}
              aria-live="off"
            >
              <span className="anchor-demo-bezel">
                <span className="anchor-demo-core">
                  <small>ОСТАЛОСЬ</small>
                  <strong>{formatTimer(remainingSeconds)}</strong>
                  <span>{Math.round(progress)}% пройдено</span>
                </span>
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="anchor-demo-smoke-slot">
        {pauseActive && remainingSeconds > 0 ? (
          <button
            type="button"
            className="anchor-demo-early-action"
            aria-label="Иду курить. Отметить сигарету сейчас и начать новую паузу"
            onClick={recordSmoke}
          >
            ИДУ КУРИТЬ
          </button>
        ) : (
          <p>{pauseActive ? 'ЦЕЛЬ-ПАУЗА ДОСТИГНУТА' : 'НАЖМИ ПЕРЕД СИГАРЕТОЙ'}</p>
        )}
      </div>

      <section className="anchor-demo-activities">
        <button
          type="button"
          className="anchor-demo-row anchor-demo-games"
          onClick={() => setGameChooserOpen(true)}
        >
          <span className="anchor-demo-row-icon"><Gamepad2 /></span>
          <span className="anchor-demo-row-copy">
            <small>ИГРЫ</small>
            <strong>Блоки и 2048</strong>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`anchor-demo-row anchor-demo-content ${content.kind} ${content.kind === 'puzzle' ? 'featured' : ''}`}
          onClick={content.kind === 'puzzle' ? openPuzzle : () => setStoryId(featuredStory.id)}
          disabled={content.kind === 'puzzle' && pauseAnchor === undefined}
        >
          <span className="anchor-demo-content-icon">
            {puzzleFinished ? <Check /> : <ContentIcon kind={content.kind} />}
          </span>
          <span className="anchor-demo-content-copy">
            <small>
              {puzzleFinished
                ? 'ГОТОВО'
                : content.kind === 'puzzle'
                  ? `${content.label} · ${content.duration.toUpperCase()}`
                  : `${featuredStory.category} · ${featuredStory.duration.toUpperCase()}`}
            </small>
            <strong>
              {puzzleFinished
                ? 'Головоломка пройдена'
                : content.kind === 'puzzle'
                  ? content.title
                  : featuredStory.title}
            </strong>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      {gameChooserOpen && (
        <div
          className="anchor-demo-game-overlay"
          role="presentation"
          onClick={() => setGameChooserOpen(false)}
        >
          <section
            className="anchor-demo-game-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="anchor-live-game-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <button
                type="button"
                aria-label="Закрыть выбор игр"
                onClick={() => setGameChooserOpen(false)}
              ><ArrowLeft /></button>
              <div>
                <p>НА ВСЮ ПАУЗУ</p>
                <h2 id="anchor-live-game-title">Выбери игру</h2>
              </div>
            </header>
            <button
              type="button"
              onClick={() => {
                setGameChooserOpen(false);
                setActiveGame('blocks');
              }}
            >
              <Gamepad2 />
              <span><strong>Блоки</strong><small>Спокойно собирай линии</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setGameChooserOpen(false);
                setActiveGame('merge');
              }}
            >
              <Sparkles />
              <span><strong>2048</strong><small>Соединяй одинаковые плитки</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

export function PauseAnchorDemo() {
  const [mode, setMode] = useState<DemoMode>('ready');
  const [remainingSeconds, setRemainingSeconds] = useState(DEMO_GOAL_SECONDS);
  const [activeGame, setActiveGame] = useState<ActiveGame>();
  const [gameChooserOpen, setGameChooserOpen] = useState(false);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [puzzleSession, setPuzzleSession] = useState<PuzzleSession>();
  const [readerOpen, setReaderOpen] = useState(false);
  const [dayStats, setDayStats] = useState<DemoDayStats>(INITIAL_DEMO_STATS);
  const [toast, setToast] = useState<DemoToast>();

  useEffect(() => {
    if (mode !== 'running' || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [mode, remainingSeconds]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 10_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const progress = mode === 'ready'
    ? 0
    : Math.min(100, ((DEMO_GOAL_SECONDS - remainingSeconds) / DEMO_GOAL_SECONDS) * 100);
  const message = useMemo(
    () => mode === 'ready'
      ? {
          eyebrow: 'ТВОЯ ПАУЗА',
          title: 'Один жест перед сигаретой',
          copy: 'Круг останется на месте и проведёт через всё ожидание.',
        }
      : pauseDemoMessage(progress),
    [mode, progress],
  );
  const content = pauseDemoContent(progress);
  const puzzleFinished = content.kind === 'puzzle' &&
    puzzleSession?.status !== undefined &&
    puzzleSession.status !== 'active';

  const recordSmokeAndRestart = (outcomeRemainingSeconds: number) => {
    const snapshot: DemoSmokeSnapshot = {
      mode,
      remainingSeconds,
      stats: dayStats,
      puzzleSession,
      puzzleOpen,
      readerOpen,
      gameChooserOpen,
    };
    const outcome = recordDemoSmoke(dayStats, outcomeRemainingSeconds);

    setDayStats(outcome.stats);
    setMode('running');
    setRemainingSeconds(DEMO_GOAL_SECONDS);
    setPuzzleSession(undefined);
    setPuzzleOpen(false);
    setReaderOpen(false);
    setGameChooserOpen(false);
    setToast({ message: outcome.message, snapshot });
  };

  const startPause = () => {
    recordSmokeAndRestart(mode === 'ready' ? 0 : remainingSeconds);
  };

  const undoSmoke = () => {
    if (!toast) return;
    const { snapshot } = toast;
    setMode(snapshot.mode);
    setRemainingSeconds(snapshot.remainingSeconds);
    setDayStats(snapshot.stats);
    setPuzzleSession(snapshot.puzzleSession);
    setPuzzleOpen(snapshot.puzzleOpen);
    setReaderOpen(snapshot.readerOpen);
    setGameChooserOpen(snapshot.gameChooserOpen);
    setToast(undefined);
  };

  const openPuzzle = () => {
    const now = Date.now();
    setPuzzleSession((current) => current ?? createPuzzleSession(
      TACTILE_PUZZLES[0],
      now,
      now + remainingSeconds * 1_000,
      now,
    ));
    setPuzzleOpen(true);
  };

  if (activeGame) {
    const props = {
      remainingSeconds,
      onClose: () => setActiveGame(undefined),
    };
    return activeGame === 'blocks'
      ? <FallingBlocksGame {...props} />
      : <Merge2048Game {...props} />;
  }

  if (puzzleOpen && puzzleSession) {
    return (
      <PuzzleDialog
        session={puzzleSession}
        now={Date.now()}
        remainingSeconds={remainingSeconds}
        onChange={setPuzzleSession}
        onClose={() => setPuzzleOpen(false)}
      />
    );
  }

  const progressStyle = {
    '--anchor-progress': `${Math.max(0, Math.min(360, progress * 3.6))}deg`,
  } as CSSProperties;
  const anchorAvailable = mode === 'ready' || remainingSeconds <= 0;

  return (
    <main className="anchor-demo-shell">
      <section className="anchor-demo-screen">
        <header className="anchor-demo-header">
          <strong>ПАУЗА</strong>
          <span aria-hidden="true" />
          <span className="anchor-demo-settings" aria-hidden="true"><Settings /></span>
        </header>

        <section className="anchor-demo-hero">
          <section className="anchor-demo-today" aria-label="Статистика за сегодня">
            <p>СЕГОДНЯ</p>
            <div className="anchor-demo-today-grid">
              <span>
                <strong>{dayStats.cigarettes}</strong>
                <small>{cigaretteWord(dayStats.cigarettes)}</small>
              </span>
              <span>
                <strong>{dayStats.reachedPauses}</strong>
                <small>{pauseDurationLabel(dayStats.reachedPauses)}</small>
              </span>
            </div>
          </section>

          <section
            className={`anchor-demo-support${message.copy ? '' : ' compact'}`}
            aria-live="polite"
          >
            <p>{message.eyebrow}</p>
            <h1>{message.title}</h1>
            {message.copy && <span>{message.copy}</span>}
          </section>

          <div className="anchor-demo-center">
            {anchorAvailable ? (
              <button
                type="button"
                className={`anchor-demo-control available ${mode === 'ready' ? 'ready' : 'completed'}`}
                style={progressStyle}
                aria-label={mode === 'ready'
                  ? 'Иду курить. Начать паузу'
                  : 'Иду курить. Отметить сигарету и начать новую паузу'}
                onClick={startPause}
              >
                <span className="anchor-demo-bezel">
                  <span className="anchor-demo-core">
                    <strong>ИДУ КУРИТЬ</strong>
                  </span>
                </span>
              </button>
            ) : (
              <div
                className="anchor-demo-control waiting"
                style={progressStyle}
                role="timer"
                aria-label={`До конца паузы ${formatTimer(remainingSeconds)}`}
                aria-live="off"
              >
                <span className="anchor-demo-bezel">
                  <span className="anchor-demo-core">
                    <small>ОСТАЛОСЬ</small>
                    <strong>{formatTimer(remainingSeconds)}</strong>
                    <span>{Math.round(progress)}% пройдено</span>
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="anchor-demo-smoke-slot">
          {mode === 'running' && remainingSeconds > 0 ? (
            <button
              type="button"
              className="anchor-demo-early-action"
              aria-label="Иду курить. Отметить сигарету сейчас и начать новую паузу"
              onClick={() => recordSmokeAndRestart(remainingSeconds)}
            >
              ИДУ КУРИТЬ
            </button>
          ) : (
            <p>ЦЕЛЬ-ПАУЗА ДОСТИГНУТА</p>
          )}
        </div>

        <section className="anchor-demo-activities">
            <button
              type="button"
              className="anchor-demo-row anchor-demo-games"
              onClick={() => setGameChooserOpen(true)}
            >
              <span className="anchor-demo-row-icon"><Gamepad2 /></span>
              <span className="anchor-demo-row-copy">
                <small>ИГРЫ</small>
                <strong>Блоки и 2048</strong>
              </span>
              <ArrowRight aria-hidden="true" />
            </button>

            <button
              type="button"
              className={`anchor-demo-row anchor-demo-content ${content.kind} ${content.kind === 'puzzle' ? 'featured' : ''}`}
              onClick={content.kind === 'puzzle' ? openPuzzle : () => setReaderOpen(true)}
            >
              <span className="anchor-demo-content-icon">
                {puzzleFinished ? <Check /> : <ContentIcon kind={content.kind} />}
              </span>
              <span className="anchor-demo-content-copy">
                <small>
                  {puzzleFinished ? 'ГОТОВО' : `${content.label} · ${content.duration.toUpperCase()}`}
                </small>
                <strong>{puzzleFinished ? 'Головоломка пройдена' : content.title}</strong>
              </span>
              <ArrowRight aria-hidden="true" />
            </button>

          </section>

        {readerOpen && (
          <section className="anchor-demo-reader" role="dialog" aria-modal="true">
            <button type="button" onClick={() => setReaderOpen(false)} aria-label="Вернуться к таймеру">
              <ArrowLeft />
            </button>
            <p>{content.label} · {content.duration}</p>
            <h2>{content.title}</h2>
            <div className="anchor-demo-reader-card">
              <ContentIcon kind={content.kind} />
              <strong>{content.copy}</strong>
              <span>
                В полноценной версии здесь будет короткий материал с иллюстрацией и понятным
                объяснением. Таймер паузы продолжает идти в фоне.
              </span>
            </div>
            <button type="button" className="anchor-demo-reader-return" onClick={() => setReaderOpen(false)}>
              ВЕРНУТЬСЯ К ПАУЗЕ · {formatTimer(remainingSeconds)}
            </button>
          </section>
        )}

        {gameChooserOpen && (
          <div
            className="anchor-demo-game-overlay"
            role="presentation"
            onClick={() => setGameChooserOpen(false)}
          >
            <section
              className="anchor-demo-game-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="anchor-demo-game-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <button
                  type="button"
                  aria-label="Закрыть выбор игр"
                  onClick={() => setGameChooserOpen(false)}
                >
                  <ArrowLeft />
                </button>
                <div>
                  <p>НА ВСЮ ПАУЗУ</p>
                  <h2 id="anchor-demo-game-title">Выбери игру</h2>
                </div>
              </header>
              <button
                type="button"
                onClick={() => {
                  setGameChooserOpen(false);
                  setActiveGame('blocks');
                }}
              >
                <Gamepad2 />
                <span><strong>Блоки</strong><small>Спокойно собирай линии</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameChooserOpen(false);
                  setActiveGame('merge');
                }}
              >
                <Sparkles />
                <span><strong>2048</strong><small>Соединяй одинаковые плитки</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            </section>
          </div>
        )}

        {toast && (
          <div className="anchor-demo-toast" role="status">
            <span>{toast.message}</span>
            <button type="button" onClick={undoSmoke}>ОТМЕНИТЬ</button>
          </div>
        )}
      </section>

      {mode === 'running' && (
        <aside className="anchor-demo-stages" aria-label="Быстрый просмотр этапов демо">
          <span>ДЕМО</span>
          {[0, 30, 50, 80, 100].map((stage) => (
            <button
              key={stage}
              type="button"
              className={Math.round(progress) === stage ? 'active' : ''}
              onClick={() => setRemainingSeconds(
                Math.max(0, Math.round(DEMO_GOAL_SECONDS * (1 - stage / 100))),
              )}
            >
              {stage === 0 ? 'Старт' : `${stage}%`}
            </button>
          ))}
          <button
            type="button"
            aria-label="Вернуть демо к началу"
            onClick={() => {
              setMode('ready');
              setRemainingSeconds(DEMO_GOAL_SECONDS);
              setDayStats(INITIAL_DEMO_STATS);
              setPuzzleSession(undefined);
              setPuzzleOpen(false);
              setReaderOpen(false);
              setGameChooserOpen(false);
              setToast(undefined);
            }}
          ><RotateCcw /></button>
        </aside>
      )}

      <nav className="anchor-demo-nav" aria-label="Демо навигации">
        {[
          { label: 'Сегодня', Icon: Circle, active: true },
          { label: 'План', Icon: CalendarDays },
          { label: 'Здоровье', Icon: Heart },
          { label: 'Статистика', Icon: BarChart3 },
        ].map(({ label, Icon, active }) => (
          <span key={label} className={active ? 'active' : ''}><Icon /><small>{label}</small></span>
        ))}
      </nav>
    </main>
  );
}
