import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  LockKeyhole,
  X,
} from 'lucide-react';
import { formatTimer } from './domain';
import {
  TACTILE_PUZZLES,
  canRevealPuzzleAnswer,
  canRevealPuzzleHint,
  isPuzzleResponseCorrect,
  moveSlideTile,
  puzzleById,
  revealPuzzleAnswer,
  revealPuzzleHint,
  submitPuzzleResponse,
  type LocalPuzzleState,
  type PuzzleDefinition,
  type PuzzleSession,
} from './puzzles';

export function PuzzleEntryCard({
  puzzleState,
  compact = false,
  onOpen,
}: {
  puzzleState: LocalPuzzleState;
  compact?: boolean;
  onOpen: () => void;
}) {
  const current = puzzleState.current;
  const puzzle = current ? puzzleById(current.puzzleId) : undefined;
  const active = current?.status === 'active' && puzzle?.mechanic === 'slide';
  const seenTactileCount = TACTILE_PUZZLES.filter((candidate) =>
    puzzleState.seenPuzzleIds.includes(candidate.id),
  ).length;
  const exhausted =
    seenTactileCount >= TACTILE_PUZZLES.length && !active;

  const title = active
    ? 'Продолжить решение'
    : exhausted
      ? 'Все раскладки пройдены'
      : 'Подвигаем плитки?';
  const copy = active
    ? 'Твой вариант сохранён. Можно продолжить с того же места.'
    : exhausted
      ? `В локальном прототипе пока ${TACTILE_PUZZLES.length} разных раскладок.`
      : 'Передвигай плитки пальцем и собери порядок. Можно закрыть и продолжить позже.';
  const action = active
    ? 'ПРОДОЛЖИТЬ'
    : 'ОТКРЫТЬ ГОЛОВОЛОМКУ';

  return (
    <section className={`puzzle-entry-card ${compact ? 'compact' : ''}`}>
      <span className="puzzle-entry-icon" aria-hidden="true"><BrainCircuit /></span>
      <div className="puzzle-entry-copy">
        <p>ГОЛОВОЛОМКА НА ПАУЗУ</p>
        <h2>{title}</h2>
        {!compact && <span>{copy}</span>}
        {puzzle && active && !compact && <small>{puzzle.category} · около 5 минут</small>}
      </div>
      <button type="button" onClick={onOpen} disabled={exhausted}>
        {action}
      </button>
    </section>
  );
}

function SlideBoard({
  puzzle,
  response,
  onChange,
}: {
  puzzle: Extract<PuzzleDefinition, { mechanic: 'slide' }>;
  response: readonly string[];
  onChange: (response: string[]) => void;
}) {
  const dragRef = useRef<{ tileId: string; x: number; y: number } | undefined>(undefined);
  const suppressClickRef = useRef(false);

  const move = (tileId: string) => {
    const next = moveSlideTile(puzzle, response, tileId);
    if (next.some((value, index) => value !== response[index])) onChange(next);
  };

  const finishDrag = (tileId: string, x: number, y: number) => {
    const start = dragRef.current;
    dragRef.current = undefined;
    if (!start || start.tileId !== tileId) return;

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.hypot(deltaX, deltaY) < 8) return;

    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 250);

    const tileIndex = response.indexOf(tileId);
    const blankIndex = response.indexOf('0');
    const tileRow = Math.floor(tileIndex / puzzle.size);
    const tileColumn = tileIndex % puzzle.size;
    const blankRow = Math.floor(blankIndex / puzzle.size);
    const blankColumn = blankIndex % puzzle.size;
    const rowDirection = blankRow - tileRow;
    const columnDirection = blankColumn - tileColumn;
    const movingTowardBlank = columnDirection !== 0
      ? Math.abs(deltaX) > Math.abs(deltaY) && Math.sign(deltaX) === columnDirection
      : Math.abs(deltaY) > Math.abs(deltaX) && Math.sign(deltaY) === rowDirection;

    if (movingTowardBlank) move(tileId);
  };

  return (
    <div className="puzzle-slide-wrap">
      <div
        className="puzzle-slide-board"
        role="group"
        aria-label="Поле пятнашек. Собери числа от одного до восьми."
      >
        {response.map((tileId, index) => {
          const row = Math.floor(index / puzzle.size);
          const column = index % puzzle.size;
          const positionStyle = {
            transform: `translate(calc(${column * 100}% + ${column * 8}px), calc(${row * 100}% + ${row * 8}px))`,
          };
          if (tileId === '0') {
            return <span key="blank" className="puzzle-slide-blank" style={positionStyle} />;
          }
          return (
            <button
              key={tileId}
              type="button"
              style={positionStyle}
              aria-label={`Плитка ${tileId}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { tileId, x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => finishDrag(tileId, event.clientX, event.clientY)}
              onPointerCancel={() => {
                dragRef.current = undefined;
              }}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                move(tileId);
              }}
            >
              <span>{tileId}</span>
            </button>
          );
        })}
      </div>
      <p><span aria-hidden="true">↔</span> Потяни соседнюю плитку в пустую клетку</p>
    </div>
  );
}

function ChoiceBoard({
  puzzle,
  response,
  onChange,
}: {
  puzzle: Extract<PuzzleDefinition, { mechanic: 'choice' }>;
  response: readonly string[];
  onChange: (response: string[]) => void;
}) {
  return (
    <div className="puzzle-choice-board" role="group" aria-label="Варианты ответа">
      {puzzle.options.map((option, index) => {
        const selected = response[0] === option.id;
        return (
          <button
            type="button"
            key={option.id}
            className={selected ? 'selected' : ''}
            aria-pressed={selected}
            onClick={() => onChange([option.id])}
          >
            <span>{String.fromCharCode(1040 + index)}</span>
            <strong>{option.text}</strong>
            {selected && <Check aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function OrderBoard({
  puzzle,
  response,
  onChange,
}: {
  puzzle: Extract<PuzzleDefinition, { mechanic: 'order' }>;
  response: readonly string[];
  onChange: (response: string[]) => void;
}) {
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= response.length) return;
    const next = [...response];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <ol className="puzzle-order-board" aria-label="Текущий порядок действий">
      {response.map((itemId, index) => {
        const item = puzzle.items.find((candidate) => candidate.id === itemId);
        if (!item) return null;
        return (
          <li key={item.id}>
            <span className="puzzle-order-number">{index + 1}</span>
            <strong>{item.text}</strong>
            <span className="puzzle-order-actions">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Поднять «${item.text}» выше`}
              ><ChevronUp /></button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === response.length - 1}
                aria-label={`Опустить «${item.text}» ниже`}
              ><ChevronDown /></button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function VisualBoard({
  puzzle,
  response,
  onChange,
}: {
  puzzle: Extract<PuzzleDefinition, { mechanic: 'visual' }>;
  response: readonly string[];
  onChange: (response: string[]) => void;
}) {
  return (
    <>
      {puzzle.lead && <pre className="puzzle-visual-lead">{puzzle.lead}</pre>}
      <div className="puzzle-visual-board" role="group" aria-label="Визуальные варианты">
        {puzzle.items.map((item, index) => {
          const selected = response[0] === item.id;
          return (
            <button
              type="button"
              key={item.id}
              className={selected ? 'selected' : ''}
              aria-label={`Вариант ${index + 1}: ${item.label}`}
              aria-pressed={selected}
              onClick={() => onChange([item.id])}
            >
              <small>{index + 1}</small>
              <span aria-hidden="true">
                {item.rows.map((row) => <i key={row}>{row}</i>)}
              </span>
              {selected && <Check aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function PuzzleDialog({
  session,
  now,
  remainingSeconds,
  onChange,
  onClose,
}: {
  session: PuzzleSession;
  now: number;
  remainingSeconds: number;
  onChange: (session: PuzzleSession) => void;
  onClose: () => void;
}) {
  const puzzle = puzzleById(session.puzzleId);
  const dialogRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [showWrong, setShowWrong] = useState(false);
  const [testClockOffsetMs, setTestClockOffsetMs] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
    const appRoot = document.getElementById('root');
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (appRoot) {
        appRoot.inert = false;
        if (previousAriaHidden == null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousAriaHidden);
      }
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [session.status]);

  const effectiveNow = now + testClockOffsetMs;
  const effectiveRemainingSeconds = Math.max(
    0,
    remainingSeconds - Math.floor(testClockOffsetMs / 1000),
  );
  const hintAvailable = canRevealPuzzleHint(session, effectiveNow);
  const answerAvailable = canRevealPuzzleAnswer(session, effectiveNow);

  useEffect(() => {
    if (!puzzle) return;
    const previousRender = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'origin top-left; three by three sliding grid',
      mode: 'sliding-puzzle',
      puzzleId: puzzle.id,
      status: session.status,
      tiles: session.response,
      solvedOrder: puzzle.mechanic === 'slide' ? puzzle.correctOrder : undefined,
      remainingSeconds: effectiveRemainingSeconds,
      hintAvailable,
      answerAvailable,
    });
    window.advanceTime = (milliseconds: number) => {
      setTestClockOffsetMs((current) => current + Math.max(0, milliseconds));
    };
    return () => {
      window.render_game_to_text = previousRender;
      window.advanceTime = previousAdvance;
    };
  }, [answerAvailable, effectiveRemainingSeconds, hintAvailable, puzzle, session]);

  if (!puzzle) return null;

  const hintSeconds = Math.max(0, Math.ceil((session.hintUnlockAt - effectiveNow) / 1000));
  const answerSeconds = Math.max(0, Math.ceil((session.answerUnlockAt - effectiveNow) / 1000));
  const answered = session.status !== 'active';
  const canSubmit = puzzle.mechanic === 'order' ||
    (puzzle.mechanic !== 'slide' && session.response.length > 0);

  const changeResponse = (response: string[]) => {
    setShowWrong(false);
    const next = { ...session, response };
    onChange(
      puzzle.mechanic === 'slide' && isPuzzleResponseCorrect(puzzle, response)
        ? submitPuzzleResponse(next, puzzle, effectiveNow)
        : next,
    );
  };

  const submit = () => {
    const next = submitPuzzleResponse(session, puzzle, effectiveNow);
    setShowWrong(next.status === 'active');
    onChange(next);
  };

  const board = puzzle.mechanic === 'choice'
    ? <ChoiceBoard puzzle={puzzle} response={session.response} onChange={changeResponse} />
    : puzzle.mechanic === 'order'
      ? <OrderBoard puzzle={puzzle} response={session.response} onChange={changeResponse} />
      : puzzle.mechanic === 'visual'
        ? <VisualBoard puzzle={puzzle} response={session.response} onChange={changeResponse} />
        : <SlideBoard puzzle={puzzle} response={session.response} onChange={changeResponse} />;

  return createPortal(
    <section
      ref={dialogRef}
      className="puzzle-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="puzzle-title"
      aria-describedby="puzzle-prompt"
    >
      <header className="puzzle-dialog-header">
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Вернуться к таймеру">
          <ArrowLeft />
        </button>
        <strong>
          ПАУЗА · {effectiveRemainingSeconds <= 0
            ? 'ЦЕЛЬ ПРОЙДЕНА'
            : formatTimer(effectiveRemainingSeconds)}
        </strong>
        <button type="button" onClick={onClose} aria-label="Закрыть головоломку"><X /></button>
      </header>

      <main ref={scrollRef} className="puzzle-dialog-scroll">
        <article className="puzzle-prompt">
          <p>{puzzle.category} · ОКОЛО 5 МИНУТ</p>
          <h1 id="puzzle-title">{puzzle.title}</h1>
          <div id="puzzle-prompt">{puzzle.prompt}</div>
        </article>

        {answered ? (
          <section className={`puzzle-result ${session.status}`} aria-live="polite">
            <span aria-hidden="true"><Check /></span>
            <p>{session.status === 'solved' ? 'ВЕРНО' : 'ОТВЕТ'}</p>
            <h2>{session.status === 'solved' ? 'Ты нашёл решение' : 'Вот как это решается'}</h2>
            <strong>{puzzle.answerText}</strong>
            <div>{puzzle.explanation}</div>
          </section>
        ) : (
          <>
            {board}
            <p className={`puzzle-feedback ${showWrong ? 'visible' : ''}`} aria-live="polite">
              {showWrong
                ? 'Пока не сходится. Можно попробовать ещё.'
                : puzzle.mechanic === 'slide'
                  ? 'Когда порядок соберётся, приложение заметит это само.'
                  : 'Выбери свой вариант — ошибаться здесь нормально.'}
            </p>
            {session.hintRevealed && (
              <aside className="puzzle-hint"><Lightbulb /><div><strong>Подсказка</strong><span>{puzzle.hint}</span></div></aside>
            )}
          </>
        )}
      </main>

      <footer className="puzzle-dialog-footer">
        {answered ? (
          <button type="button" className="button primary-button full" onClick={onClose}>
            {effectiveRemainingSeconds > 0
              ? `ВЕРНУТЬСЯ К ТАЙМЕРУ · ${formatTimer(effectiveRemainingSeconds)}`
              : 'ПАУЗА ЗАВЕРШЕНА'}
          </button>
        ) : (
          <>
            {!session.hintRevealed && (
              <button
                type="button"
                className="puzzle-gate-button"
                disabled={!hintAvailable}
                onClick={() => onChange(revealPuzzleHint(session, effectiveNow))}
              >
                {hintAvailable ? <Lightbulb /> : <LockKeyhole />}
                {hintAvailable ? 'ОТКРЫТЬ ПОДСКАЗКУ' : `ПОДСКАЗКА ЧЕРЕЗ ${formatTimer(hintSeconds)}`}
              </button>
            )}
            {puzzle.mechanic !== 'slide' && (
              <button
                type="button"
                className="button primary-button full puzzle-submit"
                disabled={!canSubmit}
                onClick={submit}
              >
                ПРОВЕРИТЬ ВЕРСИЮ
              </button>
            )}
            <button
              type="button"
              className="puzzle-gate-button"
              disabled={!answerAvailable}
              onClick={() => onChange(revealPuzzleAnswer(session, effectiveNow))}
            >
              {answerAvailable ? 'ПОКАЗАТЬ ОТВЕТ' : <><LockKeyhole /> ОТВЕТ ЧЕРЕЗ {formatTimer(answerSeconds)}</>}
            </button>
          </>
        )}
      </footer>
    </section>,
    document.body,
  );
}
