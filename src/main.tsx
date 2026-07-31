import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import '@fontsource-variable/manrope';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cigarette,
  Circle,
  Clock3,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Heart,
  Info,
  LockKeyhole,
  LogOut,
  LogIn,
  Mail,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  UserPlus,
  X,
} from 'lucide-react';
import {
  activeEvents,
  averageSmokingInterval,
  calculateBaseline,
  createDemoState,
  createInitialState,
  day,
  dayResult,
  eventsToday,
  expectedCigarettesSinceReduction,
  formatMinutes,
  formatTimer,
  intervalsByLocalDay,
  lastSevenDayCounts,
  longestSmokingInterval,
  minute,
  minutesSinceLastSmoking,
  notSmoked,
  programDay,
  programWeek,
  reductionStartedAt,
  savedMoney,
  secondsUntilGoal,
  todayKey,
  type AppState,
  type SettingsState,
  type SmokingEvent,
  type TabId,
} from './domain';
import {
  cloudConfigured,
  getAuthSession,
  loadCloudState,
  mergeAppStates,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
  syncCloudState,
} from './cloud';
import {
  isValidEmail,
  normalizeEmail,
  passwordAuthErrorMessage,
  passwordValidationMessage,
  type PasswordAuthMode,
} from './auth';
import { clearAppState, loadAppState, saveAppState } from './storage';
import './style.css';

const WEEK_LABELS = [
  'Наблюдаем ритм',
  'Начинаем первую паузу',
  'Закрепляем новый ритм',
  'Тренируем паузу',
  'Укрепляем устойчивость',
  'Замечаем момент выбора',
  'Держим свой темп',
  'Два месяца пути',
  'Продолжаем спокойно',
  'Больше свободы в моменте',
  'Сохраняем движение',
  'Три месяца пути',
  'Готовимся к следующему этапу',
  'Закрепляем уверенность',
  'Подходим к финальной подготовке',
  'Неделя подготовки',
];

const WEEK_COPY = [
  'Первые семь дней просто отмечай каждую сигарету. Мы знакомимся с твоим ритмом.',
  'Перед привычным действием появляется первая небольшая пауза.',
  'Продолжаем без гонки: важнее повторение, а не идеальный день.',
  'Пауза становится заметной частью дня и возвращает момент выбора.',
  'Поддерживаем свой темп — без лишнего давления.',
  'Замечаем, что между желанием и действием уже есть пространство.',
  'Продолжаем путь в устойчивом, реальном для тебя ритме.',
  'Два месяца — большой отрезок. Оглянись на пройденное и спокойно иди дальше.',
  'Маленькие повторяющиеся шаги по-прежнему работают.',
  'Пауза помогает действовать не автоматически, а по своему решению.',
  'Бережно удерживаем уже найденный ритм.',
  'Три месяца пути — основа нового поведения уже стала крепче.',
  'Собираем уверенность перед финальной подготовкой.',
  'Продолжаем выбранный путь и доверяем своему темпу.',
  'Остался один шаг до решения о следующем этапе.',
  'Цель больше не растёт. В конце недели следующий шаг выберешь ты.',
];

const ACTIVITY_URL =
  'https://www.youtube.com/results?search_query=мягкая+разминка+спины+и+плеч+5+минут';

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

type SnackbarState =
  | { kind: 'undo'; eventId: string; message: string }
  | { kind: 'message'; message: string }
  | undefined;

type OnboardingPreview = 'entry' | 'intro' | 'price' | 'final';

function App() {
  const [state, setState] = useState<AppState>();
  const [session, setSession] = useState<Session | null | undefined>(
    cloudConfigured ? undefined : null,
  );
  const [loadedOwnerId, setLoadedOwnerId] = useState<string>();
  const [cloudUserId, setCloudUserId] = useState<string>();
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'offline' | 'error'>(
    cloudConfigured ? 'syncing' : 'local',
  );
  const [syncRevision, setSyncRevision] = useState(0);
  const cloudLoadingFor = useRef<string | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lapseOpen, setLapseOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>();
  const demoScene = useMemo(
    () => (import.meta.env.DEV ? new URLSearchParams(window.location.search).get('demo') : null),
    [],
  );
  const demoState = useMemo(
    () => (demoScene ? createDemoState(demoScene) : undefined),
    [demoScene],
  );
  const onboardingPreview = useMemo<OnboardingPreview | undefined>(() => {
    if (!import.meta.env.DEV) return undefined;
    const scene = new URLSearchParams(window.location.search).get('onboarding');
    return scene === 'entry' || scene === 'intro' || scene === 'price' || scene === 'final'
      ? scene
      : undefined;
  }, []);

  const ownerId = session?.user.id ?? 'local';

  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true;
    getAuthSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch(() => {
        if (active) setSession(null);
      });

    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session === undefined || loadedOwnerId === ownerId) return;
    let active = true;
    setState(undefined);
    setCloudUserId(undefined);
    loadAppState(ownerId).then((nextState) => {
      if (!active) return;
      setState(nextState);
      setLoadedOwnerId(ownerId);
    });
    return () => {
      active = false;
    };
  }, [loadedOwnerId, ownerId, session]);

  useEffect(() => {
    const retry = () => setSyncRevision((current) => current + 1);
    window.addEventListener('online', retry);
    window.addEventListener('offline', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('offline', retry);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (snackbar?.kind !== 'message') return;
    const timer = window.setTimeout(() => setSnackbar(undefined), 2_800);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  useEffect(() => {
    if (!state || demoState || loadedOwnerId !== ownerId) return;
    saveAppState(state, ownerId).catch(() =>
      setSnackbar({ kind: 'message', message: 'Не удалось сохранить изменение' }),
    );
  }, [state, demoState, loadedOwnerId, ownerId]);

  useEffect(() => {
    const userId = session?.user.id;
    if (
      !cloudConfigured ||
      !userId ||
      !state ||
      loadedOwnerId !== userId ||
      cloudUserId === userId ||
      cloudLoadingFor.current === userId
    ) {
      return;
    }

    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    let active = true;
    cloudLoadingFor.current = userId;
    setSyncStatus('syncing');
    loadCloudState(userId)
      .then((remote) => {
        if (!active) return;
        setState((current) => (current ? mergeAppStates(current, remote) : current));
        setCloudUserId(userId);
        setSyncStatus('synced');
      })
      .catch(() => {
        if (!active) return;
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        setSnackbar({
          kind: 'message',
          message: 'Облако пока недоступно — данные сохранены на устройстве',
        });
      })
      .finally(() => {
        if (cloudLoadingFor.current === userId) cloudLoadingFor.current = undefined;
      });

    return () => {
      active = false;
    };
  }, [cloudUserId, loadedOwnerId, session?.user.id, syncRevision]);

  useEffect(() => {
    const userId = session?.user.id;
    const email = session?.user.email;
    if (
      !userId ||
      !email ||
      !state ||
      demoState ||
      loadedOwnerId !== userId ||
      cloudUserId !== userId
    ) {
      return;
    }

    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    const timer = window.setTimeout(() => {
      setSyncStatus('syncing');
      syncCloudState(userId, email, state)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus(navigator.onLine ? 'error' : 'offline'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cloudUserId, demoState, loadedOwnerId, session?.user.email, session?.user.id, state, syncRevision]);

  useEffect(() => {
    if (!state || demoState || !state.onboarded) return;
    const currentDay = programDay(state.startedAt, now);
    if (currentDay >= 8 && !state.baseline) {
      const nextBaseline = calculateBaseline(state.events, 25, state.startedAt);
      const key = todayKey(now);
      const target = nextBaseline.interval + nextBaseline.step;
      setState((current) =>
        current
          ? {
              ...current,
              phase: 'reduction',
              baseline: nextBaseline,
              goal: target,
              dailyGoals: { ...current.dailyGoals, [key]: target },
            }
          : current,
      );
    }
  }, [state, now, demoState]);

  useEffect(() => {
    if (!state || demoState || !state.baseline || state.phase === 'observation' || state.phase === 'quit') {
      return;
    }
    const key = todayKey(now);
    if (state.dailyGoals[key]) return;
    const previousDate = new Date(now - day);
    const previousKey = todayKey(previousDate.getTime());
    const previousTarget = state.dailyGoals[previousKey] ?? state.goal ?? state.baseline.interval;
    const result = dayResult(state.events, previousKey, previousTarget);
    const week = programWeek(state.startedAt, now);
    const target =
      state.phase === 'preparation' || week >= 16 || result !== 'success'
        ? previousTarget
        : previousTarget + state.baseline.step;
    setState((current) =>
      current
        ? {
            ...current,
            goal: target,
            dailyGoals: { ...current.dailyGoals, [key]: target },
          }
        : current,
    );
  }, [state, now, demoState]);

  if (import.meta.env.PROD && !cloudConfigured) {
    return <CloudConfigurationScreen />;
  }

  if (onboardingPreview) {
    const initialStep =
      onboardingPreview === 'entry'
        ? 1
        : onboardingPreview === 'intro'
          ? 2
          : onboardingPreview === 'price'
            ? 3
            : 4;
    return (
      <Onboarding
        initialStep={initialStep}
        onDone={() => window.location.assign(window.location.pathname)}
      />
    );
  }

  if (cloudConfigured && session === undefined) return <LoadingScreen />;

  if (cloudConfigured && !session && !demoState) {
    return (
      <EntryScreen
        onSignIn={async (email, password) => {
          const nextSession = await signInWithPassword(email, password);
          setSession(nextSession);
        }}
        onSignUp={async (email, password) => {
          const nextSession = await signUpWithPassword(email, password);
          setSession(nextSession);
        }}
      />
    );
  }

  if (!state) return <LoadingScreen />;

  if (!state.onboarded && !demoState) {
    return (
      <Onboarding
        initialStep={cloudConfigured ? 2 : 1}
        onDone={(settings) =>
          setState({
            ...createInitialState(),
            onboarded: true,
            settings,
          })
        }
      />
    );
  }

  const shownState = demoState ?? state;
  const update = (patch: Partial<AppState>) => {
    if (demoState) return;
    setState((current) => (current ? { ...current, ...patch } : current));
  };

  const recordSmoke = () => {
    if (demoState) return;
    const timestamp = Date.now();
    setNow(timestamp);
    const event: SmokingEvent = {
      id: crypto.randomUUID(),
      occurredAt: timestamp,
      createdAt: timestamp,
    };
    setState((current) =>
      current
        ? {
            ...current,
            events: [...current.events, event],
            skipStartedAt: undefined,
          }
        : current,
    );
    setSnackbar({ kind: 'undo', eventId: event.id, message: 'Отмечено!' });
    window.setTimeout(
      () =>
        setSnackbar((current) =>
          current?.kind === 'undo' && current.eventId === event.id ? undefined : current,
        ),
      10_000,
    );
  };

  const recordLapse = () => {
    recordSmoke();
    setLapseOpen(true);
  };

  const undoEvent = (eventId: string) => {
    const timestamp = Date.now();
    setState((current) =>
      current
        ? {
            ...current,
            events: current.events.map((event) =>
              event.id === eventId ? { ...event, deletedAt: timestamp } : event,
            ),
          }
        : current,
    );
    setSnackbar({ kind: 'message', message: 'Последняя отметка отменена' });
  };

  const selectTab = (activeTab: TabId) => {
    if (demoState) return;
    update({ activeTab });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <main className="app-shell">
      <section className="screen" aria-live="polite">
        <div className="tab-panel" key={shownState.activeTab}>
          {shownState.activeTab === 'today' && (
            <TodayScreen
              state={shownState}
              now={now}
              onOpenSettings={() => setSettingsOpen(true)}
              onSmoke={recordSmoke}
              onSkip={() => {
                update({
                  skipStartedAt: Date.now(),
                  skippedCount: shownState.skippedCount + 1,
                });
                setSnackbar({ kind: 'message', message: 'Отлично, продолжаем паузу' });
              }}
              onRecordLapse={recordLapse}
            />
          )}
          {shownState.activeTab === 'plan' && <PlanScreen state={shownState} now={now} />}
          {shownState.activeTab === 'health' && (
            <HealthScreen
              state={shownState}
              now={now}
              onOpenSettings={() => setSettingsOpen(true)}
              onActivity={() => {
                const completed = shownState.activityDone === todayKey(now);
                update({ activityDone: completed ? undefined : todayKey(now) });
                setSnackbar({
                  kind: 'message',
                  message: completed
                    ? 'Отметка активности снята'
                    : 'Сегодня ты уделил время себе',
                });
              }}
            />
          )}
          {shownState.activeTab === 'stats' && <StatsScreen state={shownState} now={now} />}
        </div>
      </section>

      <BottomNav active={shownState.activeTab} onSelect={selectTab} />

      {snackbar && (
        <div className="snackbar" role="status">
          <span>{snackbar.message}</span>
          {snackbar.kind === 'undo' && (
            <button onClick={() => undoEvent(snackbar.eventId)}>ОТМЕНИТЬ</button>
          )}
        </div>
      )}

      {settingsOpen && (
        <SettingsSheet
          state={state}
          onClose={() => setSettingsOpen(false)}
          onChange={(settings) =>
            setState((current) => (current ? { ...current, settings } : current))
          }
          accountEmail={session?.user.email}
          syncStatus={syncStatus}
          onSignOut={
            session
              ? async () => {
                  await signOut();
                  setSettingsOpen(false);
                }
              : undefined
          }
          onScenario={(scene) => {
            setState(createScenario(scene));
            setSettingsOpen(false);
          }}
          onReset={async () => {
            await clearAppState(ownerId);
            setState(createInitialState());
            setSettingsOpen(false);
          }}
        />
      )}

      {lapseOpen && (
        <BottomSheet title="Одна сигарета не отменяет твой путь" onClose={() => setLapseOpen(false)}>
          <p>До этого момента ты уже прошёл важную часть пути. Выбери, что поможет продолжить.</p>
          <button
            className="button primary-button full"
            onClick={() => {
              update({ phase: 'quit', quitStartedAt: Date.now() });
              setLapseOpen(false);
            }}
          >
            ВЕРНУТЬСЯ К ОТКАЗУ
          </button>
          <button
            className="button secondary-button full"
            onClick={() => {
              update({ phase: 'preparation', quitStartedAt: undefined });
              setLapseOpen(false);
            }}
          >
            ВЗЯТЬ НЕДЕЛЮ ПОДГОТОВКИ
          </button>
        </BottomSheet>
      )}
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <p className="logo-word">ПАУЗА</p>
      <span>Загружаем твой путь…</span>
    </main>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 3.1 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.8 13.8 1 12.3c-1-.3-1.1-1 .2-1.5L20 3.6c.9-.3 1.7.2 1.6-.5Z"
      />
    </svg>
  );
}

function CloudConfigurationScreen() {
  return (
    <main className="configuration-screen">
      <span className="configuration-icon"><CloudOff /></span>
      <p className="section-label">ПАУЗА</p>
      <h1>Облачный вход ещё не настроен</h1>
      <p>
        Добавьте публичные Supabase URL и Publishable key в переменные сборки.
        Локальные данные и секретные ключи здесь не запрашиваются.
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3 7.5l3.4 2.6C7.2 7.7 9.4 5.9 12 5.9Z" />
    </svg>
  );
}

function EntryScreen({
  onContinue,
  onSignIn,
  onSignUp,
}: {
  onContinue?: () => void;
  onSignIn?: (email: string, password: string) => Promise<void>;
  onSignUp?: (email: string, password: string) => Promise<void>;
}) {
  const [legal, setLegal] = useState<'terms' | 'privacy'>();
  const [authMode, setAuthMode] = useState<PasswordAuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const emailAuth = Boolean(onSignIn && onSignUp);

  const submitPasswordAuth = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setAuthError('Введи корректный адрес почты');
      return;
    }
    const passwordError = passwordValidationMessage(password);
    if (passwordError) {
      setAuthError(passwordError);
      return;
    }

    const action = authMode === 'sign-up' ? onSignUp : onSignIn;
    if (!action) return;

    setBusy(true);
    setAuthError(undefined);
    try {
      setEmail(normalizedEmail);
      await action(normalizedEmail, password);
    } catch (error) {
      setAuthError(passwordAuthErrorMessage(error, authMode));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="entry-screen">
      <div className="entry-hero" aria-hidden="true">
        <img src={assetUrl('assets/entry-hands-v2.png')} alt="" />
      </div>

      <section className="entry-content" aria-labelledby="entry-title">
        <h1 className="entry-logo" id="entry-title">ПАУЗА</h1>

        {emailAuth ? (
          <form
            className="entry-email-auth"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPasswordAuth();
            }}
          >
            <div className="entry-auth-tabs" role="tablist" aria-label="Способ входа">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'sign-in'}
                onClick={() => {
                  setAuthMode('sign-in');
                  setAuthError(undefined);
                }}
              >
                Войти
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'sign-up'}
                onClick={() => {
                  setAuthMode('sign-up');
                  setAuthError(undefined);
                }}
              >
                Создать аккаунт
              </button>
            </div>
            <p className="entry-auth-intro">
              {authMode === 'sign-up'
                ? 'Создай аккаунт, чтобы прогресс сохранялся'
                : 'Войди — твой прогресс уже ждёт тебя'}
            </p>
            <label className="entry-auth-field">
              <Mail aria-hidden="true" />
              <input
                value={email}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                aria-label="Электронная почта"
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
              />
            </label>
            <label className="entry-auth-field">
              <LockKeyhole aria-hidden="true" />
              <input
                value={password}
                type={passwordVisible ? 'text' : 'password'}
                autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                placeholder="Пароль — минимум 8 символов"
                aria-label="Пароль"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="entry-password-toggle"
                aria-label={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setPasswordVisible((current) => !current)}
              >
                {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </label>
            {authError && <span className="entry-auth-error" role="alert">{authError}</span>}
            <button className="social-button telegram-button" type="submit" disabled={busy}>
              {authMode === 'sign-up' ? <UserPlus /> : <LogIn />}
              <span>
                {busy
                  ? 'Подождите…'
                  : authMode === 'sign-up'
                    ? 'Создать аккаунт'
                    : 'Войти'}
              </span>
            </button>
            <button
              className="entry-auth-switch"
              type="button"
              onClick={() => {
                setAuthMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in');
                setAuthError(undefined);
              }}
            >
              {authMode === 'sign-up'
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Создать'}
            </button>
          </form>
        ) : (
          <>
            <div className="entry-auth">
              <button className="social-button telegram-button" type="button" onClick={onContinue}>
                <TelegramIcon />
                <span>Продолжить с Telegram</span>
              </button>
              <button className="social-button google-button" type="button" onClick={onContinue}>
                <GoogleIcon />
                <span>Продолжить с Google</span>
              </button>
            </div>

            <div className="entry-divider" aria-hidden="true">
              <span />
              <b>или</b>
              <span />
            </div>

            <button className="entry-login" type="button" onClick={onContinue}>
              Уже есть аккаунт? Войти
            </button>
          </>
        )}

        <p className="entry-legal">
          Продолжая, вы принимаете
          <br />
          <button type="button" onClick={() => setLegal('terms')}>Условия использования</button>
          {' и '}
          <button type="button" onClick={() => setLegal('privacy')}>Политику конфиденциальности</button>
        </p>
      </section>

      {legal && (
        <BottomSheet
          title={legal === 'terms' ? 'Условия использования' : 'Политика конфиденциальности'}
          onClose={() => setLegal(undefined)}
        >
          <p className="legal-copy">
            Данные о прогрессе сохраняются на устройстве и, после входа, в защищённом
            аккаунте Supabase. Доступ к строкам ограничен политиками безопасности владельца.
          </p>
          <button className="button primary-button full" type="button" onClick={() => setLegal(undefined)}>
            ПОНЯТНО
          </button>
        </BottomSheet>
      )}
    </main>
  );
}

function OnboardingIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="intro-screen">
      <header className="intro-progress">
        <span>1 из 3</span>
        <div aria-label="Шаг 1 из 3">
          <i />
        </div>
      </header>

      <section className="intro-copy" aria-labelledby="intro-title">
        <h1 id="intro-title">
          <img src={assetUrl('assets/onboarding-title.png')} alt="" aria-hidden="true" />
          <span className="visually-hidden">НЕ ЗАПРЕЩАЕМ. ВОЗВРАЩАЕМ ВЫБОР.</span>
        </h1>
        <p>
          Курение часто происходит автоматически: с кофе, во время стресса или
          перерыва.
        </p>
        <p>
          Мы не запрещаем. Помогаем заметить момент, отложить сигарету и
          постепенно вернуть себе выбор.
        </p>
      </section>

      <div className="intro-illustration" aria-hidden="true">
        <img src={assetUrl('assets/onboarding-choice.png')} alt="" />
      </div>

      <button className="intro-continue" type="button" onClick={onContinue}>
        <span>Продолжить</span>
        <ArrowRight />
      </button>
    </main>
  );
}

function FinalOnboardingScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  return (
    <main className="final-screen">
      <div className="final-screen-reference">
        <img
          className="final-screen-reference-image"
          src={assetUrl('assets/final-screen.png')}
          alt=""
          aria-hidden="true"
        />

        <button
          className="final-back-hotspot"
          type="button"
          onClick={onBack}
          aria-label="Назад"
        />
      </div>

      <div className="final-path-steps" aria-label="Заметить, отложить, выбрать">
        <span className="final-path-step final-path-step-notice">Заметить</span>
        <ArrowRight aria-hidden="true" />
        <span className="final-path-step final-path-step-delay">Отложить</span>
        <ArrowRight aria-hidden="true" />
        <span className="final-path-step final-path-step-choose">Выбрать</span>
      </div>

      <div className="visually-hidden">
        <span>3 из 3. Шаг 3 из 3.</span>
        <h1>НАЧИНАЕМ ПУТЬ К СВОБОДЕ</h1>
        <p>
          Ты делаешь важный выбор. Мы поможем тебе откладывать сигареты,
          разрывать ритуалы и возвращать контроль. Шаг за шагом — к жизни без
          зависимости.
        </p>
      </div>

      <button
        className="final-ready-hotspot"
        type="button"
        onClick={onDone}
        aria-label="Я готов"
      >
        <span>Я ГОТОВ</span>
        <ArrowRight aria-hidden="true" />
      </button>
    </main>
  );
}

function PriceOnboardingScreen({
  value,
  onChange,
  onBack,
  onContinue,
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <main className="price-screen">
      <div className="price-screen-reference">
        <img
          className="price-screen-reference-image"
          src={assetUrl('assets/onboarding-price-screen.png')}
          alt=""
          aria-hidden="true"
        />

        <button
          className="price-back-hotspot"
          type="button"
          onClick={onBack}
          aria-label="Назад"
        />

        <label className="price-input-shell">
          <span className="visually-hidden">Средняя цена пачки</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            placeholder="250"
            onChange={handleChange}
            aria-describedby="price-later-hint"
          />
          <span aria-hidden="true">₽</span>
        </label>
      </div>

      <div className="visually-hidden">
        <span>2 из 3. Шаг 2 из 3.</span>
        <h1>ПОСЧИТАЕМ ТВОЮ ЭКОНОМИЮ?</h1>
        <p>
          Укажи среднюю цену пачки, чтобы мы посчитали, сколько ты сможешь
          сэкономить.
        </p>
      </div>

      <span id="price-later-hint" className="visually-hidden">
        Это поле можно заполнить позже
      </span>

      <button
        className="price-continue-hotspot"
        type="button"
        onClick={onContinue}
        aria-label="Продолжить"
      >
        <span>ПРОДОЛЖИТЬ</span>
        <ArrowRight aria-hidden="true" />
      </button>
    </main>
  );
}

function Onboarding({
  onDone,
  initialStep = 1,
}: {
  onDone: (settings: SettingsState) => void;
  initialStep?: 1 | 2 | 3 | 4;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [packPrice, setPackPrice] = useState('250');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [step]);

  useEffect(() => {
    [
      'assets/onboarding-title.png',
      'assets/onboarding-choice.png',
      'assets/onboarding-price-screen.png',
      'assets/final-screen.png',
    ].forEach((path) => {
      const image = new Image();
      image.src = assetUrl(path);
    });
  }, []);

  if (step === 1) {
    return <EntryScreen onContinue={() => setStep(2)} />;
  }

  if (step === 2) {
    return <OnboardingIntro onContinue={() => setStep(3)} />;
  }

  if (step === 3) {
    return (
      <PriceOnboardingScreen
        value={packPrice}
        onChange={setPackPrice}
        onBack={() => setStep(2)}
        onContinue={() => setStep(4)}
      />
    );
  }

  return (
    <FinalOnboardingScreen
      onBack={() => setStep(3)}
      onDone={() =>
        onDone({
          packPrice: optionalNumber(packPrice),
          cigarettesPerPack: 20,
        })
      }
    />
  );
}

function StageHeader({
  state,
  now,
  onSettings,
}: {
  state: AppState;
  now: number;
  onSettings: () => void;
}) {
  const currentDay = programDay(state.startedAt, now);
  const currentWeek = programWeek(state.startedAt, now);
  const quitElapsed = Math.max(0, now - (state.quitStartedAt ?? now));
  const quitDays = Math.floor(quitElapsed / day);
  const quitHours = Math.floor((quitElapsed % day) / (60 * minute));
  const observation = state.phase === 'observation';
  const preparation = state.phase === 'preparation';
  const quit = state.phase === 'quit';

  const label = observation
    ? 'НАБЛЮДЕНИЕ'
    : preparation
      ? 'ГОТОВИМСЯ К ОТКАЗУ'
      : quit
        ? 'БЕЗ СИГАРЕТ'
        : 'ТРЕНИРУЕМ ПАУЗУ';
  const title = observation
    ? `День ${Math.min(7, currentDay)} из 7`
    : preparation
      ? 'Неделя подготовки'
      : quit
        ? `День ${quitDays}`
        : `Неделя ${currentWeek} из 16`;
  const aside = observation
    ? `Осталось ${Math.max(0, 7 - currentDay)} ${pluralDays(Math.max(0, 7 - currentDay))}`
    : preparation
      ? 'Финальный этап'
      : quit
        ? `${quitHours} ч`
        : `Осталось ${Math.max(0, 16 - currentWeek)} недель`;
  const progress = observation
    ? Math.min(100, (currentDay / 7) * 100)
    : preparation || quit
      ? 100
      : (currentWeek / 16) * 100;

  return (
    <header className="stage-header">
      <button className="icon-button settings-button" onClick={onSettings} aria-label="Настройки">
        <Settings />
      </button>
      <p className="section-label">{label}</p>
      <div className="title-row">
        <h1>{title}</h1>
        <span>{aside}</span>
      </div>
      <Progress value={progress} />
    </header>
  );
}

function TodayScreen({
  state,
  now,
  onOpenSettings,
  onSmoke,
  onSkip,
  onRecordLapse,
}: {
  state: AppState;
  now: number;
  onOpenSettings: () => void;
  onSmoke: () => void;
  onSkip: () => void;
  onRecordLapse: () => void;
}) {
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSeconds, setSupportSeconds] = useState(180);
  const [supportRunning, setSupportRunning] = useState(false);
  const todayEvents = eventsToday(state.events, now);
  const sinceLast = minutesSinceLastSmoking(state.events, now);
  const goal = state.dailyGoals[todayKey(now)] ?? state.goal;
  const remaining = secondsUntilGoal(state.events, goal, now, state.skipStartedAt);

  useEffect(() => {
    if (!supportRunning || supportSeconds <= 0) return;
    const timer = window.setInterval(() => setSupportSeconds((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [supportRunning, supportSeconds]);

  const metrics = (
    <div className="metric-card">
      <div className="metric-row">
        <span className="metric-icon blue"><Cigarette /></span>
        <span>Количество сигарет</span>
        <strong>{todayEvents.length}</strong>
      </div>
      <div className="card-divider" />
      <div className="metric-row">
        <span className="metric-icon"><Clock3 /></span>
        <span>Последняя сигарета</span>
        <strong>{sinceLast === undefined ? 'Нет отметок' : `${sinceLast} мин. назад`}</strong>
      </div>
    </div>
  );

  if (state.phase === 'quit') {
    const elapsed = Math.max(0, now - (state.quitStartedAt ?? now));
    const daysWithout = Math.floor(elapsed / day);
    const hoursWithout = Math.floor((elapsed % day) / (60 * minute));
    const money = savedMoney(state, now);
    return (
      <>
        <StageHeader state={state} now={now} onSettings={onOpenSettings} />
        <section className="quit-hero card">
          <p className="section-label">ТВОЙ НОВЫЙ РИТМ</p>
          <h2>Без сигарет уже<br />{daysWithout} дней {hoursWithout} часов</h2>
          {money !== undefined && <p>Примерно сохранено {money.toLocaleString('ru-RU')} ₽</p>}
          <div className="milestone">
            <Sparkles />
            <span>Ближайшая веха</span>
            <strong>30 дней</strong>
          </div>
        </section>
        <button className="button primary-button full support-button" onClick={() => setSupportOpen(true)}>
          МНЕ СЕЙЧАС ТЯЖЕЛО
        </button>
        <button className="text-button lapse-button" onClick={onRecordLapse}>
          Отметить сигарету
        </button>
        {supportOpen && (
          <BottomSheet title="Переждём эту волну вместе" onClose={() => setSupportOpen(false)}>
            {supportSeconds > 0 ? (
              <>
                <div className="support-timer">{formatTimer(supportSeconds)}</div>
                <p>Сделай спокойный вдох и просто побудь здесь. Тяга меняется, даже если сейчас кажется сильной.</p>
                <button
                  className="button primary-button full"
                  onClick={() => setSupportRunning(true)}
                  disabled={supportRunning}
                >
                  {supportRunning ? 'ТАЙМЕР ИДЁТ' : 'НАЧАТЬ 3 МИНУТЫ'}
                </button>
              </>
            ) : (
              <>
                <p className="sheet-success">Ты переждал волну. Выбери, что поможет дальше.</p>
                <a className="sheet-action" href={ACTIVITY_URL} target="_blank" rel="noreferrer">
                  5 минут разминки <ChevronRight />
                </a>
                <span className="sheet-action">Короткая прогулка <ChevronRight /></span>
                <button className="button primary-button full" onClick={() => setSupportOpen(false)}>
                  ВЕРНУТЬСЯ НА СЕГОДНЯ
                </button>
              </>
            )}
          </BottomSheet>
        )}
      </>
    );
  }

  return (
    <>
      <StageHeader state={state} now={now} onSettings={onOpenSettings} />
      {metrics}

      {state.phase === 'observation' || !goal || sinceLast === undefined ? (
        <div className="main-action">
          <button className="smoke-button" onClick={onSmoke}>
            ИДУ КУРИТЬ
          </button>
          <div className="action-hint">
            <ArrowUp />
            <p>Нажми прямо перед сигаретой.</p>
          </div>
        </div>
      ) : remaining > 0 ? (
        <section className="timer-state">
          <p className="section-label">ДО СЛЕДУЮЩЕЙ ПАУЗЫ</p>
          <strong className="timer-value">{formatTimer(remaining)}</strong>
          <p>Сегодняшняя цель — {goal} минут</p>
          <div className="support-note">
            <Clock3 />
            <span>Ты уже держишь паузу. Кнопка появится, когда время закончится.</span>
          </div>
        </section>
      ) : (
        <section className="choice-state">
          <div className="choice-check"><Check /></div>
          <h2>Пауза уже пройдена</h2>
          <p>Ты подождал {goal} минут. Теперь решение снова у тебя.</p>
          <button className="button primary-button full" onClick={onSmoke}>ИДУ КУРИТЬ</button>
          <button className="button secondary-button full" onClick={onSkip}>ПРОПУСКАЮ</button>
        </section>
      )}
    </>
  );
}

function PlanScreen({ state, now }: { state: AppState; now: number }) {
  const currentWeek = programWeek(state.startedAt, now);
  const [openWeek, setOpenWeek] = useState(currentWeek - 1);
  const [howOpen, setHowOpen] = useState(false);
  const [sheet, setSheet] = useState<'after' | 'rewards'>();
  const currentProgramDay = programDay(state.startedAt, now);
  const quitDays = state.quitStartedAt
    ? Math.floor(Math.max(0, now - state.quitStartedAt) / day)
    : 0;
  const milestones = [
    { label: '7 дней пути', complete: currentProgramDay >= 7 },
    { label: '30 дней пути', complete: currentProgramDay >= 30 },
    { label: '2 месяца пути', complete: currentProgramDay >= 60 },
    { label: '3 месяца пути', complete: currentProgramDay >= 90 },
    { label: '16 недель подготовки', complete: currentProgramDay >= 112 },
    { label: '7 дней без сигарет', complete: quitDays >= 7 },
    { label: '30 дней без сигарет', complete: quitDays >= 30 },
  ];

  useEffect(() => setOpenWeek(currentWeek - 1), [currentWeek]);

  return (
    <>
      <header className="simple-header plan-header">
        <p className="section-label">ТВОЙ ПУТЬ</p>
        <h1>Неделя {currentWeek} из 16</h1>
        <p>Ты тренируешь паузу между сигаретами</p>
      </header>

      <button className={`how-card card ${howOpen ? 'expanded' : ''}`} onClick={() => setHowOpen(!howOpen)}>
        <span>
          <strong>Как работает путь</strong>
          {!howOpen && <small>Наблюдаем, увеличиваем паузу, выбираем следующий шаг</small>}
        </span>
        {howOpen ? <ChevronUp /> : <ChevronDown />}
        {howOpen && (
          <ul>
            <li>7 дней наблюдаем твой обычный ритм</li>
            <li>Пауза растёт постепенно</li>
            <li>Сложный день не обнуляет путь</li>
            <li>После подготовки следующий шаг выберешь ты</li>
          </ul>
        )}
      </button>

      <div className="roadmap">
        {WEEK_LABELS.map((label, index) => {
          const completed = index < currentWeek - 1;
          const current = index === currentWeek - 1;
          const open = index === openWeek;
          return (
            <button
              key={label}
              className={`week-card card ${current ? 'current' : ''} ${completed ? 'completed' : ''} ${open ? 'expanded' : ''}`}
              onClick={() => setOpenWeek(open ? -1 : index)}
              aria-expanded={open}
            >
              <span className="week-status">
                {completed ? <Check /> : <Circle />}
              </span>
              <span className="week-content">
                {current && <em>СЕЙЧАС</em>}
                <strong>Неделя {index + 1} · {label}</strong>
                {open && (
                  <span className="week-details">
                    {current && state.goal && (
                      <b>Сегодня цель-пауза: {state.goal} минут</b>
                    )}
                    <span>{WEEK_COPY[index]}</span>
                    {completed && <span>Ты уже прошёл этот этап. Это часть твоей работы над собой.</span>}
                    {!completed && !current && (
                      <span>Пауза станет немного длиннее, если текущая цель закрепится.</span>
                    )}
                  </span>
                )}
              </span>
              {open ? <ChevronUp /> : <ChevronDown />}
            </button>
          );
        })}
      </div>

      <button className="after-card card" onClick={() => setSheet('after')}>
        <span className="week-status future"><Circle /></span>
        <span>
          <em>ПОСЛЕ ПОДГОТОВКИ</em>
          <strong>Период без сигарет</strong>
          <small>Выбор всегда остаётся за тобой</small>
        </span>
        <ChevronRight />
      </button>

      <button className="rewards-card card" onClick={() => setSheet('rewards')}>
        <span className="metric-icon blue"><Sparkles /></span>
        <span><em>НАГРАДЫ</em><strong>Вехи твоего пути</strong></span>
        <ChevronRight />
      </button>

      {sheet === 'after' && (
        <BottomSheet title="После подготовки" onClose={() => setSheet(undefined)}>
          <p>
            После 16-й недели ты сам выберешь следующий шаг: начать период без
            сигарет или оставить ещё семь дней с уже достигнутой паузой.
          </p>
          <p>Автоматического перехода не будет — решение всегда остаётся за тобой.</p>
          <button
            className="button primary-button full"
            type="button"
            onClick={() => setSheet(undefined)}
          >
            ПОНЯТНО
          </button>
        </BottomSheet>
      )}

      {sheet === 'rewards' && (
        <BottomSheet title="Вехи твоего пути" onClose={() => setSheet(undefined)}>
          <ul className="rewards-list">
            {milestones.map((milestone) => (
              <li className={milestone.complete ? 'complete' : ''} key={milestone.label}>
                <span>{milestone.complete ? <Check /> : <Circle />}</span>
                <strong>{milestone.label}</strong>
              </li>
            ))}
          </ul>
          <button
            className="button primary-button full"
            type="button"
            onClick={() => setSheet(undefined)}
          >
            ПРОДОЛЖИТЬ
          </button>
        </BottomSheet>
      )}
    </>
  );
}

function HealthScreen({
  state,
  now,
  onOpenSettings,
  onActivity,
}: {
  state: AppState;
  now: number;
  onOpenSettings: () => void;
  onActivity: () => void;
}) {
  const reduced = notSmoked(state, now);
  const expected = expectedCigarettesSinceReduction(state, now);
  const money = savedMoney(state, now);
  const packs = reduced / (state.settings.cigarettesPerPack || 20);
  const reductionEvents = activeEvents(state.events).filter(
    (event) => event.occurredAt >= reductionStartedAt(state.startedAt) && event.occurredAt <= now,
  );
  const actualAveragePause =
    averageSmokingInterval(reductionEvents) ??
    averageSmokingInterval(state.events) ??
    state.baseline?.interval;
  const completed = state.activityDone === todayKey(now);
  const moneyProgress =
    money !== undefined && state.settings.moneyGoal
      ? Math.min(100, (money / state.settings.moneyGoal) * 100)
      : 0;

  return (
    <>
      <header className="simple-header with-action">
        <div>
          <p className="section-label">ЗДОРОВЬЕ</p>
          <h1>Твой прогресс</h1>
          <p>То, что меняется благодаря каждой паузе</p>
        </div>
        <button className="icon-button" onClick={onOpenSettings} aria-label="Настройки">
          <Settings />
        </button>
      </header>

      {!state.baseline ? (
        <section className="card collecting-card">
          <span className="metric-icon blue"><Target /></span>
          <p className="section-label">СОБИРАЕМ ТВОЙ РИТМ</p>
          <h2>Первые цифры появятся после недели наблюдения</h2>
          <p>А пока здесь есть одно небольшое действие для себя на сегодня.</p>
        </section>
      ) : (
        <>
          <section className="card health-hero">
            <p className="section-label">НЕ ВЫКУРЕНО</p>
            <strong>{reduced} {pluralCigarettes(reduced)}</strong>
            <p>На {expected ? Math.round((reduced / expected) * 100) : 0}% меньше, чем обычно</p>
            <svg viewBox="0 0 300 54" role="img" aria-label="Тенденция сокращения">
              <path d="M2 46C28 48 32 37 58 41s29-7 54-4 28-12 52-7 28-4 48-13 31 4 46-8 25 2 40-7" />
            </svg>
          </section>

          <div className="health-grid">
            <section className="card compact-health-card">
              <p className="section-label">СОКРАЩЕНИЕ</p>
              <strong>−{packs.toFixed(1).replace('.', ',')} пачки</strong>
              <p>примерно за время программы</p>
            </section>
            <section className="card compact-health-card">
              <p className="section-label">СЭКОНОМЛЕНО</p>
              <strong>{money === undefined ? '—' : `${money.toLocaleString('ru-RU')} ₽`}</strong>
              <p>{money === undefined ? 'Добавь цену пачки' : state.settings.moneyGoal ? `${Math.round(moneyProgress)}% от цели` : 'примерно'}</p>
            </section>
          </div>

          {money !== undefined && state.settings.moneyGoal && (
            <section className="card goal-card">
              <p className="section-label">ЦЕЛЬ</p>
              <h2>{state.settings.goalTitle || 'Личная цель'}</h2>
              <strong>{money.toLocaleString('ru-RU')} ₽ из {state.settings.moneyGoal.toLocaleString('ru-RU')} ₽</strong>
              <Progress value={moneyProgress} />
            </section>
          )}

          <section className="card pause-card">
            <p className="section-label">СРЕДНЯЯ ПАУЗА</p>
            <strong>{formatMinutes(actualAveragePause ?? state.baseline.interval)}</strong>
            <p>В начале: {state.baseline.interval} минут</p>
            <Progress value={Math.min(100, ((actualAveragePause ?? state.baseline.interval) / Math.max(1, state.baseline.interval * 4)) * 100)} />
          </section>
        </>
      )}

      <ActivityCard completed={completed} onActivity={onActivity} />

      <section className="card info-card">
        <Info />
        <span>Каждая невыкуренная сигарета — меньше воздействия табачного дыма сегодня.</span>
      </section>
    </>
  );
}

function ActivityCard({ completed, onActivity }: { completed: boolean; onActivity: () => void }) {
  return (
    <section className="card activity-card">
      <span className="metric-icon activity-icon"><Activity /></span>
      <p className="section-label">СЕГОДНЯШНЯЯ АКТИВНОСТЬ</p>
      <h2>Разминка спины и плеч</h2>
      <p>5 минут · мягкое движение</p>
      <div className="activity-actions">
        <a className="button primary-button" href={ACTIVITY_URL} target="_blank" rel="noreferrer">
          <Play /> ОТКРЫТЬ ВИДЕО
        </a>
        <button className="button secondary-button" onClick={onActivity}>
          {completed ? <><Check /> ГОТОВО</> : 'ГОТОВО'}
        </button>
      </div>
      <small>{completed ? 'Сегодня ты уделил время себе' : 'Видео откроется на YouTube'}</small>
    </section>
  );
}

function StatsScreen({ state, now }: { state: AppState; now: number }) {
  const [period, setPeriod] = useState<'Неделя' | 'Месяц' | 'Всё время'>('Неделя');
  const counts = statisticsSeries(state, period, now);
  const periodEvents = statisticsEvents(state, period, now);
  const max = Math.max(1, ...counts.map((item) => item.count));
  const reduced = notSmoked(state, now);
  const money = savedMoney(state, now);
  const measuredAveragePause = averageSmokingInterval(periodEvents);
  const averagePause =
    measuredAveragePause ??
    averageSmokingInterval(state.events) ??
    state.baseline?.interval;
  const longestPause =
    longestSmokingInterval(periodEvents) ??
    longestSmokingInterval(state.events) ??
    state.baseline?.interval;
  const periodIntervals = intervalsByLocalDay(periodEvents);
  const intervalTotal = Math.round(
    periodIntervals.reduce((sum, value) => sum + value, 0) * 10,
  ) / 10;

  return (
    <>
      <header className="simple-header stats-header">
        <p className="section-label">СТАТИСТИКА</p>
        <div className="segmented" role="group" aria-label="Период статистики">
          {(['Неделя', 'Месяц', 'Всё время'] as const).map((item) => (
            <button
              key={item}
              className={period === item ? 'selected' : ''}
              onClick={() => setPeriod(item)}
              aria-pressed={period === item}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {!state.baseline ? (
        <section className="card stats-empty">
          <span className="metric-icon blue"><BarChart3 /></span>
          <h1>Собираем твой личный ритм</h1>
          <p>Итоговую базу посчитаем через неделю, а текущие данные уже можно проверить.</p>
          <div className="observation-stats">
            <span>
              <small>Активных отметок</small>
              <strong>{periodEvents.length}</strong>
            </span>
            <span>
              <small>Интервалов</small>
              <strong>{periodIntervals.length}</strong>
            </span>
          </div>
          <div className="calculation-note">
            <b>Текущий расчёт средней паузы</b>
            {periodIntervals.length ? (
              <>
                <strong>
                  {intervalTotal} мин ÷ {periodIntervals.length} = {measuredAveragePause} мин
                </strong>
                <small>
                  Ночные переходы между календарными днями и отменённые отметки не учитываются.
                </small>
              </>
            ) : (
              <small>Добавь вторую отметку за день — появится первый интервал.</small>
            )}
          </div>
        </section>
      ) : (
        <>
          <h1 className="stats-statement">
            На {reduced} {pluralCigarettes(reduced)} меньше, чем в первую неделю
          </h1>
          <section className="card chart-card">
            <p>Сигареты в день</p>
            <div
              className="chart"
              style={{ gridTemplateColumns: `repeat(${counts.length}, minmax(0, 1fr))` }}
            >
              {counts.map((item) => (
                <div className="bar-column" key={item.key}>
                  <span className="bar-value">{item.count}</span>
                  <span className="bar" style={{ height: `${Math.max(12, (item.count / max) * 154)}px` }} />
                  <span className="bar-label">{item.label}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card stats-pause-card">
            <p className="section-label">СРЕДНЯЯ ПАУЗА</p>
            <strong>{formatMinutes(averagePause ?? state.baseline.interval)}</strong>
            <div className="stats-lines">
              <span>В начале <b>{state.baseline.interval} мин</b></span>
              <span>Цель сегодня <b>{state.goal ?? state.baseline.interval} мин</b></span>
            </div>
            <div className="calculation-note">
              <b>Как рассчитано</b>
              {periodIntervals.length ? (
                <>
                  <strong>
                    {intervalTotal} мин ÷ {periodIntervals.length} = {averagePause} мин
                  </strong>
                  <small>
                    Использованы интервалы между активными отметками одного календарного дня.
                  </small>
                </>
              ) : (
                <small>Нужны минимум две отметки за один день.</small>
              )}
            </div>
          </section>
          <div className="stats-summary">
            <section className="card">
              <Clock3 />
              <span>Самая длинная пауза</span>
              <strong>{formatMinutes(longestPause ?? state.baseline.interval)}</strong>
            </section>
            <section className="card">
              <Target />
              <span>Примерно сохранено</span>
              <strong>{money === undefined ? '—' : `${money.toLocaleString('ru-RU')} ₽`}</strong>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function SettingsSheet({
  state,
  onClose,
  onChange,
  accountEmail,
  syncStatus,
  onSignOut,
  onScenario,
  onReset,
}: {
  state: AppState;
  onClose: () => void;
  onChange: (settings: SettingsState) => void;
  accountEmail?: string;
  syncStatus: 'local' | 'syncing' | 'synced' | 'offline' | 'error';
  onSignOut?: () => Promise<void>;
  onScenario: (scene: 'observation' | 'reduction' | 'plan' | 'health' | 'stats' | 'quit') => void;
  onReset: () => void;
}) {
  const settings = state.settings;

  return (
    <BottomSheet title="Настройки" onClose={onClose}>
      <div className="settings-form">
        <label className="settings-participant">
          Код участника
          <input
            value={settings.participantCode ?? ''}
            placeholder="P-001"
            onChange={(event) =>
              onChange({ ...settings, participantCode: event.target.value.trimStart() })
            }
          />
        </label>
        <label>
          Цена пачки
          <input
            type="number"
            min="1"
            value={settings.packPrice ?? ''}
            placeholder="250"
            onChange={(event) => onChange({ ...settings, packPrice: optionalNumber(event.target.value) })}
          />
        </label>
        <label>
          Сигарет в пачке
          <input
            type="number"
            min="1"
            max="100"
            value={settings.cigarettesPerPack ?? ''}
            placeholder="20"
            onChange={(event) =>
              onChange({ ...settings, cigarettesPerPack: optionalNumber(event.target.value) })
            }
          />
        </label>
        <label>
          Название цели
          <input
            value={settings.goalTitle ?? ''}
            placeholder="Новый набор инструментов"
            onChange={(event) => onChange({ ...settings, goalTitle: event.target.value })}
          />
        </label>
        <label>
          Сумма цели
          <input
            type="number"
            min="1"
            value={settings.moneyGoal ?? ''}
            placeholder="5000"
            onChange={(event) => onChange({ ...settings, moneyGoal: optionalNumber(event.target.value) })}
          />
        </label>
      </div>

      {accountEmail && (
        <section className="account-panel">
          <p className="section-label">АККАУНТ И СИНХРОНИЗАЦИЯ</p>
          <div className="account-status">
            <span className={`account-status-icon ${syncStatus}`}>
              {syncStatus === 'offline' || syncStatus === 'error' ? <CloudOff /> : <Cloud />}
            </span>
            <span>
              <strong>{accountEmail}</strong>
              <small>
                {syncStatus === 'syncing' && 'Сохраняем изменения…'}
                {syncStatus === 'synced' && 'Все изменения сохранены в облаке'}
                {syncStatus === 'offline' && 'Нет сети — изменения ждут синхронизации'}
                {syncStatus === 'error' && 'Облако недоступно — локальная копия сохранена'}
              </small>
            </span>
          </div>
          <button
            className="account-signout"
            type="button"
            onClick={() => void onSignOut?.()}
          >
            <LogOut /> ВЫЙТИ ИЗ АККАУНТА
          </button>
        </section>
      )}

      {import.meta.env.DEV && (
        <section className="dev-panel">
          <p className="section-label">ТЕСТОВЫЙ РЕЖИМ</p>
          <p>Переключай состояния без ожидания дней. Этот блок не попадёт в production-сборку.</p>
          <div className="dev-grid">
            {[
              ['observation', 'День 4'],
              ['reduction', 'Таймер'],
              ['plan', 'План'],
              ['health', 'Здоровье'],
              ['stats', 'Статистика'],
              ['quit', 'Без сигарет'],
            ].map(([scene, label]) => (
              <button
                key={scene}
                className="dev-button"
                onClick={() => onScenario(scene as Parameters<typeof onScenario>[0])}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        className="reset-button"
        onClick={() => {
          if (window.confirm('Удалить локальные данные и заново пройти онбординг?')) onReset();
        }}
      >
        <RotateCcw /> СБРОСИТЬ ЛОКАЛЬНЫЕ ДАННЫЕ
      </button>
    </BottomSheet>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function BottomNav({ active, onSelect }: { active: TabId; onSelect: (tab: TabId) => void }) {
  const items: Array<{ id: TabId; label: string; icon: typeof Circle }> = [
    { id: 'today', label: 'Сегодня', icon: Circle },
    { id: 'plan', label: 'План', icon: CalendarDays },
    { id: 'health', label: 'Здоровье', icon: Heart },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
  ];
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? 'active' : ''}
          onClick={() => onSelect(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <span className="nav-icon"><Icon /></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress" aria-label={`Прогресс ${Math.round(value)}%`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function statisticsSeries(
  state: AppState,
  period: 'Неделя' | 'Месяц' | 'Всё время',
  now: number,
) {
  if (period === 'Неделя') return lastSevenDayCounts(state.events, now);

  const events = activeEvents(state.events);
  if (period === 'Месяц') {
    return Array.from({ length: 10 }, (_, index) => {
      const blockStart = now - (29 - index * 3) * day;
      const blockEnd = blockStart + 3 * day;
      const date = new Date(blockStart);
      return {
        key: `month-${index}`,
        label: String(date.getDate()),
        count: Math.round(
          events.filter((event) => event.occurredAt >= blockStart && event.occurredAt < blockEnd)
            .length / 3,
        ),
      };
    });
  }

  const elapsedWeeks = Math.max(1, Math.ceil((now - state.startedAt) / (7 * day)));
  const visibleWeeks = Math.min(16, elapsedWeeks);
  return Array.from({ length: visibleWeeks }, (_, index) => {
    const blockStart = state.startedAt + index * 7 * day;
    const blockEnd = blockStart + 7 * day;
    return {
      key: `week-${index}`,
      label: `${index + 1}`,
      count: Math.round(
        events.filter((event) => event.occurredAt >= blockStart && event.occurredAt < blockEnd)
          .length / 7,
      ),
    };
  });
}

function statisticsEvents(
  state: AppState,
  period: 'Неделя' | 'Месяц' | 'Всё время',
  now: number,
) {
  const periodStart = new Date(now);
  if (period === 'Неделя') {
    periodStart.setDate(periodStart.getDate() - 6);
  } else if (period === 'Месяц') {
    periodStart.setDate(periodStart.getDate() - 29);
  } else {
    periodStart.setTime(state.startedAt);
  }
  if (period !== 'Всё время') periodStart.setHours(0, 0, 0, 0);

  return activeEvents(state.events).filter(
    (event) => event.occurredAt >= periodStart.getTime() && event.occurredAt <= now,
  );
}

function createScenario(scene: 'observation' | 'reduction' | 'plan' | 'health' | 'stats' | 'quit') {
  const now = Date.now();
  if (scene === 'observation') return createDemoState('today', now);
  const base = createDemoState(scene === 'reduction' ? 'health' : scene, now);
  if (scene === 'reduction') {
    const lastEvent: SmokingEvent = {
      id: 'demo-live-last',
      occurredAt: now - 12 * minute,
      createdAt: now - 12 * minute,
    };
    return { ...base, activeTab: 'today' as const, events: [...base.events, lastEvent], goal: 38 };
  }
  if (scene === 'quit') {
    return {
      ...base,
      activeTab: 'today' as const,
      phase: 'quit' as const,
      quitStartedAt: now - 18 * day - 7 * 60 * minute,
    };
  }
  return base;
}

function optionalNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function pluralDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

function pluralCigarettes(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сигарета';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сигареты';
  return 'сигарет';
}

const rootContainer = document.getElementById('root')!;
const rootGlobal = globalThis as typeof globalThis & { __pauzaReactRoot?: Root };
const root = rootGlobal.__pauzaReactRoot ?? createRoot(rootContainer);
if (import.meta.env.DEV) rootGlobal.__pauzaReactRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
