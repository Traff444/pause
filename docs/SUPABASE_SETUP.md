# Подключение Supabase к «ПАУЗЕ»

Проект должен жить в отдельном Supabase-аккаунте и отдельной базе. Соседние
проекты, включая `genealogy`, не используются.

## 1. Создать проект

В нужном аккаунте Supabase создайте проект `pause` и сохраните:

- `Project ref` — идентификатор проекта, не секрет;
- `Project URL` — публичное значение;
- `Publishable key` (`sb_publishable_...`) — публичный браузерный ключ.

Пароль базы, secret key и `service_role` во фронтенд или GitHub не добавляются.

## 2. Привязать CLI без передачи токена в чат

На компьютере владельца:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Локальный `supabase/config.toml` находится внутри этого репозитория, поэтому CLI
не подхватит конфигурацию родительской папки.

## 3. Настроить вход по email и паролю

В Supabase Dashboard откройте:

`Authentication → Providers → Email`

Включите `Email` и `Allow new users to sign up`. Для закрытого пилота отключите
`Confirm email`: регистрация сразу создаст сессию и не потребует SMTP. В
настройках паролей установите минимальную длину `8`.

В `Authentication → URL Configuration`:

- Site URL: `https://traff444.github.io/pause/`
- Redirect URLs:
  - `https://traff444.github.io/pause/`
  - `http://127.0.0.1:5177/`

Пароль хранится только в `auth.users` в виде bcrypt-хеша. Таблицы `profiles`,
`app_states` и `smoking_events` пароль не получают.

Перед публичным запуском рекомендуется снова включить `Confirm email` и
подключить свой SMTP. SMTP также понадобится для самостоятельного
восстановления забытого пароля.

## 4. Локальный запуск

Создайте `.env.local`:

```dotenv
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

Затем:

```bash
npm install
npm run dev
```

## 5. GitHub Pages

В `Traff444/pause → Settings → Secrets and variables → Actions → Variables`
создайте две repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

В `Settings → Pages → Build and deployment` выберите `GitHub Actions`.
Workflow `.github/workflows/deploy-pages.yml` проверит проект, соберёт его с
базовым путём `/pause/` и опубликует Pages.

## 6. Где смотреть данные пилота

В Supabase Table Editor:

- `profiles` — участники, email и обезличенный код;
- `smoking_events` — полный журнал отметок и отмен;
- `app_states` — состояние приложения для восстановления;
- `participant_smoking_timeline` — активные отметки по порядку, предыдущая
  сигарета и интервал в минутах, использованный в расчёте;
- `participant_daily_summary` — готовая дневная сводка для наблюдения за пилотом.

`participant_daily_summary` агрегирует строки
`participant_smoking_timeline`: берёт только активные отметки одного локального
календарного дня и делит сумму интервалов на их число. Ночной переход и
отменённые отметки не учитываются.

RLS не позволяет пользователю прочитать чужие строки. Владелец проекта видит
данные через Supabase Dashboard; административный ключ в браузере не нужен.

Локальная автоматическая проверка формулы и RLS:

```bash
supabase test db --local
```
