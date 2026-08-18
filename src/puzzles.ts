export const PUZZLE_HINT_DELAY_MS = 2 * 60_000;
export const PUZZLE_ANSWER_DELAY_MS = 5 * 60_000;

export type PuzzleMechanic = 'choice' | 'order' | 'visual' | 'slide';
export type PuzzleStatus = 'active' | 'solved' | 'revealed';

type PuzzleBase = {
  id: string;
  mechanic: PuzzleMechanic;
  category: string;
  title: string;
  prompt: string;
  hint: string;
  answerText: string;
  explanation: string;
};

export type PuzzleOption = {
  id: string;
  text: string;
};

export type ChoicePuzzle = PuzzleBase & {
  mechanic: 'choice';
  options: readonly PuzzleOption[];
  correctOptionId: string;
};

export type OrderPuzzle = PuzzleBase & {
  mechanic: 'order';
  items: readonly PuzzleOption[];
  correctOrder: readonly string[];
};

export type VisualPuzzleItem = {
  id: string;
  label: string;
  rows: readonly string[];
};

export type VisualPuzzle = PuzzleBase & {
  mechanic: 'visual';
  items: readonly VisualPuzzleItem[];
  correctItemId: string;
  lead?: string;
};

export type SlidePuzzle = PuzzleBase & {
  mechanic: 'slide';
  size: 3;
  start: readonly string[];
  correctOrder: readonly string[];
};

export type PuzzleDefinition = ChoicePuzzle | OrderPuzzle | VisualPuzzle | SlidePuzzle;

export type PuzzleSession = {
  puzzleId: string;
  pauseAnchor: number;
  openedAt: number;
  hintUnlockAt: number;
  answerUnlockAt: number;
  response: string[];
  attempts: number;
  hintRevealed: boolean;
  status: PuzzleStatus;
  solvedAt?: number;
  revealedAt?: number;
};

export type LocalPuzzleState = {
  version: 1;
  current?: PuzzleSession;
  seenPuzzleIds: string[];
};

export const createInitialPuzzleState = (): LocalPuzzleState => ({
  version: 1,
  seenPuzzleIds: [],
});

const SLIDE_SOLUTION = ['1', '2', '3', '4', '5', '6', '7', '8', '0'] as const;

export const TACTILE_PUZZLES = [
  ['slide-classic-01', ['1', '2', '3', '8', '7', '4', '0', '6', '5']],
  ['slide-classic-02', ['7', '4', '2', '8', '0', '3', '5', '1', '6']],
  ['slide-classic-03', ['1', '3', '7', '8', '0', '4', '6', '2', '5']],
  ['slide-classic-04', ['8', '7', '5', '4', '1', '2', '0', '3', '6']],
  ['slide-classic-05', ['1', '3', '6', '2', '8', '7', '0', '5', '4']],
  ['slide-classic-06', ['0', '1', '2', '7', '5', '3', '8', '4', '6']],
  ['slide-classic-07', ['1', '3', '7', '0', '6', '8', '2', '5', '4']],
  ['slide-classic-08', ['7', '1', '5', '8', '3', '2', '0', '4', '6']],
].map(([id, start], index) => ({
  id: id as string,
  mechanic: 'slide' as const,
  category: 'ПЯТНАШКИ',
  title: `Собери порядок · ${index + 1}`,
  prompt: 'Передвигай плитки в свободную клетку и собери числа от 1 до 8. Плитку можно потянуть пальцем или просто нажать.',
  hint: 'Сначала собери верхний ряд, затем средний. Не пытайся сразу поставить последнюю плитку.',
  answerText: 'Числа идут по порядку, а свободная клетка остаётся справа внизу.',
  explanation: 'Готовая раскладка: 1–2–3, затем 4–5–6, затем 7–8 и свободная клетка.',
  size: 3 as const,
  start: start as readonly string[],
  correctOrder: SLIDE_SOLUTION,
})) satisfies readonly SlidePuzzle[];

const LEGACY_PUZZLES: readonly PuzzleDefinition[] = [
  {
    id: 'choice-two-fathers',
    mechanic: 'choice',
    category: 'ЛОГИКА',
    title: 'Три яблока на всех',
    prompt: 'Два отца и два сына разделили три яблока так, что каждому досталось по одному. Как это возможно?',
    options: [
      { id: 'a', text: 'Одно яблоко разрезали пополам' },
      { id: 'b', text: 'Их было трое: дед, отец и сын' },
      { id: 'c', text: 'Один человек отказался от яблока' },
    ],
    correctOptionId: 'b',
    hint: 'Один человек может одновременно быть и отцом, и сыном.',
    answerText: 'Их было трое: дед, его сын и внук.',
    explanation: 'Дед и отец — два отца. Отец и внук — два сына. Поэтому трёх яблок достаточно.',
  },
  {
    id: 'choice-bat-ball',
    mechanic: 'choice',
    category: 'СЧЁТ',
    title: 'Ракетка и мяч',
    prompt: 'Ракетка и мяч стоят 1100 ₽. Ракетка на 1000 ₽ дороже мяча. Сколько стоит мяч?',
    options: [
      { id: 'a', text: '50 ₽' },
      { id: 'b', text: '100 ₽' },
      { id: 'c', text: '150 ₽' },
    ],
    correctOptionId: 'a',
    hint: 'Если мяч стоит x, то ракетка стоит x + 1000.',
    answerText: 'Мяч стоит 50 ₽.',
    explanation: '50 + 1050 = 1100, а разница между ценами равна 1000 ₽.',
  },
  {
    id: 'choice-three-pills',
    mechanic: 'choice',
    category: 'ВНИМАНИЕ',
    title: 'Три таблетки',
    prompt: 'Нужно принять три таблетки: по одной каждые полчаса. Через сколько времени будет принята последняя?',
    options: [
      { id: 'a', text: 'Через 30 минут' },
      { id: 'b', text: 'Через 1 час' },
      { id: 'c', text: 'Через 1,5 часа' },
    ],
    correctOptionId: 'b',
    hint: 'Первую таблетку принимают сразу, до первого ожидания.',
    answerText: 'Через один час.',
    explanation: 'Первая — сейчас, вторая — через 30 минут, третья — ещё через 30 минут.',
  },
  {
    id: 'choice-three-switches',
    mechanic: 'choice',
    category: 'ЛОГИКА',
    title: 'Три выключателя',
    prompt: 'Снаружи комнаты три выключателя, внутри — одна лампа. Войти можно только один раз. Как определить нужный выключатель?',
    options: [
      { id: 'a', text: 'Включить первый и сразу войти' },
      { id: 'b', text: 'По очереди быстро включить все три' },
      { id: 'c', text: 'Нагреть лампу первым, включить второй и войти' },
    ],
    correctOptionId: 'c',
    hint: 'У лампы можно проверить не только свет, но и температуру.',
    answerText: 'Использовать свет и тепло лампы.',
    explanation: 'Первый выключатель оставляют включённым на несколько минут и выключают, второй включают перед входом. Горящая лампа — второй, тёплая — первый, холодная — третий.',
  },
  {
    id: 'choice-water-jugs',
    mechanic: 'choice',
    category: 'ЛОГИКА',
    title: 'Ровно четыре литра',
    prompt: 'Есть ёмкости на 5 и 3 литра без делений. Как получить ровно 4 литра в пятилитровой?',
    options: [
      { id: 'a', text: 'Наполнить 5 л, перелить в 3 л, повторить с остатком' },
      { id: 'b', text: 'Дважды наполнить ёмкость 3 л' },
      { id: 'c', text: 'Наполнить обе и вылить половину на глаз' },
    ],
    correctOptionId: 'a',
    hint: 'После первого переливания в большой ёмкости останется 2 литра.',
    answerText: 'Дважды использовать остаток из пятилитровой ёмкости.',
    explanation: 'После первого переливания остаётся 2 л. Их переносят в ёмкость 3 л, снова наполняют 5 л и доливают в малую только 1 л — в большой остаётся 4 л.',
  },
  {
    id: 'choice-password',
    mechanic: 'choice',
    category: 'ТЕХНОЛОГИИ',
    title: 'Какой пароль устойчивее?',
    prompt: 'Какой из паролей обычно сложнее подобрать и легче запомнить владельцу?',
    options: [
      { id: 'a', text: 'Minsk2026!' },
      { id: 'b', text: '12345678' },
      { id: 'c', text: 'чай-облако-трамвай-север' },
    ],
    correctOptionId: 'c',
    hint: 'Длина часто важнее одной заглавной буквы и одного символа.',
    answerText: 'Длинная фраза из случайных слов.',
    explanation: 'Несвязанные слова дают большую длину и множество комбинаций. Для важных аккаунтов такой пароль всё равно должен быть уникальным, а лучше храниться в менеджере паролей.',
  },
  {
    id: 'choice-phishing-domain',
    mechanic: 'choice',
    category: 'ЦИФРОВАЯ БЕЗОПАСНОСТЬ',
    title: 'Найди подмену в адресе',
    prompt: 'Какой адрес выглядит подозрительно из-за замены буквы похожим символом?',
    options: [
      { id: 'a', text: 'paypal.com' },
      { id: 'b', text: 'paypaI.com' },
      { id: 'c', text: 'paypal.com/help' },
    ],
    correctOptionId: 'b',
    hint: 'Сравни последний знак перед точкой: строчную l и заглавную I.',
    answerText: 'paypaI.com — в нём заглавная I вместо строчной l.',
    explanation: 'Фишинговые адреса часто используют визуально похожие знаки. Надёжнее открывать важный сервис из закладки или вручную вводить известный адрес.',
  },
  {
    id: 'choice-binary-ten',
    mechanic: 'choice',
    category: 'КАК РАБОТАЕТ КОМПЬЮТЕР',
    title: 'Число на языке нулей и единиц',
    prompt: 'Какое обычное десятичное число записано как 1010 в двоичной системе?',
    options: [
      { id: 'a', text: '8' },
      { id: 'b', text: '10' },
      { id: 'c', text: '12' },
    ],
    correctOptionId: 'b',
    hint: 'Разряды справа налево означают 1, 2, 4 и 8.',
    answerText: 'Это число 10.',
    explanation: 'В записи 1010 включены разряды 8 и 2: 8 + 2 = 10.',
  },
  {
    id: 'choice-backup-rule',
    mechanic: 'choice',
    category: 'ТЕХНОЛОГИИ',
    title: 'Что означает правило 3–2–1?',
    prompt: 'Как надёжнее хранить важные фотографии по правилу резервного копирования 3–2–1?',
    options: [
      { id: 'a', text: '3 копии, 2 типа носителей, 1 копия отдельно' },
      { id: 'b', text: '3 пароля, 2 телефона, 1 аккаунт' },
      { id: 'c', text: 'Копировать всё раз в 3 месяца' },
    ],
    correctOptionId: 'a',
    hint: 'Цифры относятся к копиям, носителям и отдельному месту хранения.',
    answerText: 'Три копии на двух типах носителей, одна — отдельно.',
    explanation: 'Так одна поломка, потеря устройства или другая локальная проблема не уничтожит все копии сразу.',
  },
  {
    id: 'choice-ai-check',
    mechanic: 'choice',
    category: 'ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ',
    title: 'ИИ ответил уверенно',
    prompt: 'Помощник на основе ИИ назвал точную медицинскую дозировку без источника. Какое действие разумнее?',
    options: [
      { id: 'a', text: 'Принять ответ: уверенный тон означает точность' },
      { id: 'b', text: 'Попросить повторить ответ короче' },
      { id: 'c', text: 'Проверить по надёжному источнику и уточнить у специалиста' },
    ],
    correctOptionId: 'c',
    hint: 'ИИ может формулировать правдоподобно даже ошибочный ответ.',
    answerText: 'Проверить информацию по надёжному источнику.',
    explanation: 'Генеративные модели не гарантируют фактическую точность. В вопросах здоровья уверенный стиль не заменяет проверку и консультацию специалиста.',
  },
  {
    id: 'order-phone-update',
    mechanic: 'order',
    category: 'ТЕХНОЛОГИИ',
    title: 'Безопасное обновление телефона',
    prompt: 'Расставь действия в разумном порядке перед крупным обновлением системы.',
    items: [
      { id: 'backup', text: 'Сделать резервную копию важных данных' },
      { id: 'power', text: 'Подключить зарядку и стабильный Wi‑Fi' },
      { id: 'update', text: 'Запустить обновление' },
      { id: 'check', text: 'После перезапуска проверить основные приложения' },
    ],
    correctOrder: ['backup', 'power', 'update', 'check'],
    hint: 'Сначала защити данные и подготовь питание, только потом меняй систему.',
    answerText: 'Копия → питание и Wi‑Fi → обновление → проверка.',
    explanation: 'Резервная копия снижает риск потери данных, а питание и стабильная сеть уменьшают вероятность прерывания установки.',
  },
  {
    id: 'order-scan-document',
    mechanic: 'order',
    category: 'ПОЛЕЗНЫЙ НАВЫК',
    title: 'Скан документа телефоном',
    prompt: 'Расставь шаги, чтобы получить аккуратный цифровой документ.',
    items: [
      { id: 'place', text: 'Положить документ на ровную контрастную поверхность' },
      { id: 'scan', text: 'Открыть функцию сканирования в приложении' },
      { id: 'align', text: 'Проверить границы и читаемость кадра' },
      { id: 'save', text: 'Сохранить результат в PDF' },
    ],
    correctOrder: ['place', 'scan', 'align', 'save'],
    hint: 'Подготовка поверхности идёт раньше съёмки, сохранение — в самом конце.',
    answerText: 'Подготовить документ → сканировать → проверить → сохранить.',
    explanation: 'Контрастный фон помогает приложению найти края, а проверка до сохранения защищает от обрезанного или размытого результата.',
  },
  {
    id: 'order-share-file',
    mechanic: 'order',
    category: 'ЦИФРОВАЯ БЕЗОПАСНОСТЬ',
    title: 'Поделиться файлом без лишнего доступа',
    prompt: 'Расставь действия при отправке ссылки на личный документ.',
    items: [
      { id: 'select', text: 'Выбрать нужный файл в облачном хранилище' },
      { id: 'access', text: 'Открыть настройки доступа' },
      { id: 'limit', text: 'Указать конкретного получателя или режим «просмотр»' },
      { id: 'send', text: 'Скопировать и отправить ссылку' },
    ],
    correctOrder: ['select', 'access', 'limit', 'send'],
    hint: 'Права доступа лучше проверить до отправки ссылки.',
    answerText: 'Файл → доступ → ограничение прав → отправка.',
    explanation: 'Сначала задаются минимально необходимые права, и только после этого ссылка покидает приложение.',
  },
  {
    id: 'order-account-recovery',
    mechanic: 'order',
    category: 'ЦИФРОВАЯ БЕЗОПАСНОСТЬ',
    title: 'Подозрительный вход в аккаунт',
    prompt: 'В сервисе появился неизвестный вход. Расставь первые действия.',
    items: [
      { id: 'official', text: 'Открыть сервис через приложение или известный адрес' },
      { id: 'sessions', text: 'Завершить неизвестные активные сеансы' },
      { id: 'password', text: 'Сменить пароль на уникальный' },
      { id: 'twofactor', text: 'Включить двухфакторную защиту' },
    ],
    correctOrder: ['official', 'sessions', 'password', 'twofactor'],
    hint: 'Не переходи по ссылке из тревожного письма — начни с официального приложения.',
    answerText: 'Официальный вход → закрыть сеансы → сменить пароль → включить 2FA.',
    explanation: 'Так фишинговая ссылка не перехватит новый пароль, а неизвестные устройства потеряют доступ.',
  },
  {
    id: 'order-video-call',
    mechanic: 'order',
    category: 'ПОЛЕЗНЫЙ НАВЫК',
    title: 'Спокойный вход в видеозвонок',
    prompt: 'Расставь шаги, чтобы подключиться без суеты.',
    items: [
      { id: 'link', text: 'Открыть ссылку на встречу заранее' },
      { id: 'permissions', text: 'Разрешить доступ к микрофону и камере' },
      { id: 'test', text: 'Проверить звук и выбрать нужное устройство' },
      { id: 'join', text: 'Войти во встречу' },
    ],
    correctOrder: ['link', 'permissions', 'test', 'join'],
    hint: 'Проверка оборудования должна пройти до входа к другим участникам.',
    answerText: 'Ссылка → разрешения → проверка → вход.',
    explanation: 'Предварительная проверка позволяет исправить звук и камеру ещё до подключения.',
  },
  {
    id: 'order-tech-history',
    mechanic: 'order',
    category: 'ИСТОРИЯ ТЕХНОЛОГИЙ',
    title: 'От сигнала к сети',
    prompt: 'Расположи технологии от появившейся раньше к появившейся позже.',
    items: [
      { id: 'telegraph', text: 'Электрический телеграф' },
      { id: 'telephone', text: 'Телефон' },
      { id: 'radio', text: 'Радиосвязь' },
      { id: 'web', text: 'Всемирная паутина' },
    ],
    correctOrder: ['telegraph', 'telephone', 'radio', 'web'],
    hint: 'Телеграф передавал код раньше, чем телефон научился передавать голос.',
    answerText: 'Телеграф → телефон → радио → Всемирная паутина.',
    explanation: 'Практический телеграф появился в XIX веке до телефона и радио; Всемирная паутина возникла уже в конце XX века.',
  },
  {
    id: 'order-file-sizes',
    mechanic: 'order',
    category: 'КАК РАБОТАЕТ КОМПЬЮТЕР',
    title: 'От меньшего к большему',
    prompt: 'Расположи единицы объёма данных по возрастанию.',
    items: [
      { id: 'byte', text: 'Байт' },
      { id: 'kilobyte', text: 'Килобайт' },
      { id: 'megabyte', text: 'Мегабайт' },
      { id: 'gigabyte', text: 'Гигабайт' },
    ],
    correctOrder: ['byte', 'kilobyte', 'megabyte', 'gigabyte'],
    hint: 'После байта названия идут с приставками кило-, мега-, гига-.',
    answerText: 'Байт → килобайт → мегабайт → гигабайт.',
    explanation: 'Каждая следующая единица примерно в тысячу раз больше предыдущей; в двоичных расчётах часто используется множитель 1024.',
  },
  {
    id: 'order-photo-backup',
    mechanic: 'order',
    category: 'ПОЛЕЗНЫЙ НАВЫК',
    title: 'Освободить память без потерь',
    prompt: 'Расставь безопасные шаги перед удалением фотографий с телефона.',
    items: [
      { id: 'sync', text: 'Дождаться завершения резервного копирования' },
      { id: 'verify', text: 'Открыть несколько снимков на другом устройстве или в браузере' },
      { id: 'trash', text: 'Удалить выбранные оригиналы с телефона' },
      { id: 'space', text: 'Проверить освободившееся место' },
    ],
    correctOrder: ['sync', 'verify', 'trash', 'space'],
    hint: 'Значок синхронизации ещё не доказывает, что копии действительно открываются.',
    answerText: 'Дождаться копии → проверить её → удалить → проверить память.',
    explanation: 'Проверка нескольких файлов в облаке снижает риск удалить единственный сохранившийся экземпляр.',
  },
  {
    id: 'order-public-wifi',
    mechanic: 'order',
    category: 'ЦИФРОВАЯ БЕЗОПАСНОСТЬ',
    title: 'Покупка в общественной сети',
    prompt: 'Расставь более безопасный порядок действий, если нужно оплатить покупку вне дома.',
    items: [
      { id: 'mobile', text: 'Переключиться с открытого Wi‑Fi на мобильный интернет' },
      { id: 'official', text: 'Открыть официальное приложение магазина или банка' },
      { id: 'address', text: 'Проверить сумму и получателя' },
      { id: 'pay', text: 'Подтвердить платёж' },
    ],
    correctOrder: ['mobile', 'official', 'address', 'pay'],
    hint: 'Сначала выбери более доверенное соединение и официальный способ входа.',
    answerText: 'Мобильная сеть → официальное приложение → проверка → оплата.',
    explanation: 'Это уменьшает риск поддельной точки доступа и помогает заметить неверные реквизиты до подтверждения.',
  },
  {
    id: 'order-phishing-report',
    mechanic: 'order',
    category: 'ЦИФРОВАЯ БЕЗОПАСНОСТЬ',
    title: 'Подозрительное письмо',
    prompt: 'Расставь действия, если письмо просит срочно подтвердить пароль.',
    items: [
      { id: 'dontclick', text: 'Не нажимать ссылку и не открывать вложение' },
      { id: 'verify', text: 'Проверить сообщение через официальный сервис' },
      { id: 'report', text: 'Отметить письмо как фишинг' },
      { id: 'delete', text: 'Удалить письмо' },
    ],
    correctOrder: ['dontclick', 'verify', 'report', 'delete'],
    hint: 'Сначала останови взаимодействие с письмом, затем проверь ситуацию отдельно.',
    answerText: 'Не взаимодействовать → проверить отдельно → пожаловаться → удалить.',
    explanation: 'Жалоба помогает почтовому сервису защищать других пользователей, а независимая проверка не доверяет данным из самого письма.',
  },
  {
    id: 'visual-arrow-turn',
    mechanic: 'visual',
    category: 'ВИЗУАЛЬНАЯ ЛОГИКА',
    title: 'Продолжи поворот',
    prompt: 'Стрелка каждый раз поворачивается на четверть оборота вправо. Что будет дальше?',
    lead: '▲   ▶   ▼   ?',
    items: [
      { id: 'a', label: 'Стрелка влево', rows: ['◀'] },
      { id: 'b', label: 'Стрелка вверх', rows: ['▲'] },
      { id: 'c', label: 'Стрелка вправо', rows: ['▶'] },
      { id: 'd', label: 'Стрелка вниз', rows: ['▼'] },
    ],
    correctItemId: 'a',
    hint: 'После направления вниз следующий поворот вправо приведёт стрелку влево.',
    answerText: 'Стрелка влево.',
    explanation: 'Последовательность проходит четыре направления по часовой стрелке: вверх, вправо, вниз, влево.',
  },
  {
    id: 'visual-dot-alternation',
    mechanic: 'visual',
    category: 'ЗАКОНОМЕРНОСТЬ',
    title: 'Следующая точка',
    prompt: 'Какой знак продолжит чередование?',
    lead: '●   ○   ●   ○   ?',
    items: [
      { id: 'a', label: 'Закрашенная точка', rows: ['●'] },
      { id: 'b', label: 'Пустая точка', rows: ['○'] },
      { id: 'c', label: 'Квадрат', rows: ['■'] },
      { id: 'd', label: 'Треугольник', rows: ['▲'] },
    ],
    correctItemId: 'a',
    hint: 'Нечётные места заняты одинаковым знаком.',
    answerText: 'Закрашенная точка.',
    explanation: 'Последовательность попеременно меняется между закрашенной и пустой точкой.',
  },
  {
    id: 'visual-rotate-grid',
    mechanic: 'visual',
    category: 'ПРОСТРАНСТВО',
    title: 'Поверни карточку',
    prompt: 'Как будет выглядеть образец после поворота на 180°?',
    lead: 'Образец:  ▲  ·\n          ■  ○',
    items: [
      { id: 'a', label: 'Квадрат слева вверху, круг справа вверху', rows: ['■  ○', '▼  ·'] },
      { id: 'b', label: 'Круг слева вверху, квадрат справа вверху', rows: ['○  ■', '·  ▼'] },
      { id: 'c', label: 'Треугольник сверху, круг снизу', rows: ['▲  ·', '■  ○'] },
      { id: 'd', label: 'Квадрат и круг поменялись местами без поворота', rows: ['■  ○', '▲  ·'] },
    ],
    correctItemId: 'b',
    hint: 'Нижний правый круг после полуповорота окажется сверху слева, а треугольник развернётся вниз.',
    answerText: 'Карточка с кругом сверху слева и треугольником снизу справа.',
    explanation: 'При повороте на 180° каждый элемент переходит в противоположный угол, а направленный треугольник тоже поворачивается.',
  },
  {
    id: 'visual-one-per-line',
    mechanic: 'visual',
    category: 'ВНИМАНИЕ',
    title: 'По одной точке',
    prompt: 'В какой карточке ровно одна закрашенная точка в каждой строке и каждом столбце?',
    items: [
      { id: 'a', label: 'Закрашены обе точки верхней строки', rows: ['●  ●', '○  ○'] },
      { id: 'b', label: 'Закрашены точки по диагонали', rows: ['●  ○', '○  ●'] },
      { id: 'c', label: 'Закрашены три точки', rows: ['●  ●', '○  ●'] },
      { id: 'd', label: 'Закрашена одна точка', rows: ['○  ○', '●  ○'] },
    ],
    correctItemId: 'b',
    hint: 'Проверь отдельно две строки, затем два столбца.',
    answerText: 'Карточка с точками по диагонали.',
    explanation: 'В ней каждая строка и каждый столбец содержат одну закрашенную и одну пустую точку.',
  },
  {
    id: 'visual-symmetry',
    mechanic: 'visual',
    category: 'ПРОСТРАНСТВО',
    title: 'Вертикальная симметрия',
    prompt: 'Какая фигура совпадёт сама с собой при отражении слева направо?',
    items: [
      { id: 'a', label: 'Ступеньки вправо', rows: ['■ · ·', '■ ■ ·', '■ ■ ■'] },
      { id: 'b', label: 'Пирамида', rows: ['· ■ ·', '■ ■ ■', '■ ■ ■'] },
      { id: 'c', label: 'Угол', rows: ['■ ■ ■', '■ · ·', '■ · ·'] },
      { id: 'd', label: 'Диагональ', rows: ['■ · ·', '· ■ ·', '· · ■'] },
    ],
    correctItemId: 'b',
    hint: 'Мысленно проведи вертикальную линию через середину каждой карточки.',
    answerText: 'Пирамида.',
    explanation: 'Левая и правая половины пирамиды зеркально совпадают относительно вертикальной оси.',
  },
  {
    id: 'visual-muted-mic',
    mechanic: 'visual',
    category: 'ТЕХНОЛОГИИ',
    title: 'Микрофон выключен',
    prompt: 'Какой знак обычно означает, что собеседники сейчас не слышат твой микрофон?',
    items: [
      { id: 'a', label: 'Обычный микрофон', rows: ['🎙'] },
      { id: 'b', label: 'Микрофон, перечёркнутый линией', rows: ['🎙 ╱'] },
      { id: 'c', label: 'Динамик', rows: ['🔊'] },
      { id: 'd', label: 'Камера', rows: ['▣'] },
    ],
    correctItemId: 'b',
    hint: 'Перечёркнутый значок обычно означает отключённую функцию.',
    answerText: 'Перечёркнутый микрофон.',
    explanation: 'В большинстве приложений линия поверх микрофона означает mute: звук с твоего микрофона не передаётся.',
  },
  {
    id: 'visual-wifi-strength',
    mechanic: 'visual',
    category: 'ТЕХНОЛОГИИ',
    title: 'Самый сильный сигнал',
    prompt: 'Какой индикатор показывает самый сильный сигнал сети?',
    items: [
      { id: 'a', label: 'Одна полоса', rows: ['▂'] },
      { id: 'b', label: 'Две полосы', rows: ['▂ ▄'] },
      { id: 'c', label: 'Четыре возрастающие полосы', rows: ['▂ ▄ ▆ █'] },
      { id: 'd', label: 'Нет полос', rows: ['×'] },
    ],
    correctItemId: 'c',
    hint: 'Чем больше заполненных возрастающих полос, тем выше уровень сигнала.',
    answerText: 'Индикатор со всеми заполненными полосами.',
    explanation: 'Полный набор полос обычно обозначает наиболее сильный доступный радиосигнал.',
  },
  {
    id: 'visual-attachment',
    mechanic: 'visual',
    category: 'ТЕХНОЛОГИИ',
    title: 'Прикрепить файл',
    prompt: 'Какой знак чаще всего открывает добавление файла к письму или сообщению?',
    items: [
      { id: 'a', label: 'Скрепка', rows: ['📎'] },
      { id: 'b', label: 'Звезда', rows: ['☆'] },
      { id: 'c', label: 'Дом', rows: ['⌂'] },
      { id: 'd', label: 'Корзина', rows: ['⌫'] },
    ],
    correctItemId: 'a',
    hint: 'Иконка изображает предмет, которым скрепляют бумажные листы.',
    answerText: 'Значок скрепки.',
    explanation: 'Метафора бумажной скрепки десятилетиями используется в интерфейсах для вложений и прикреплённых файлов.',
  },
  {
    id: 'visual-odd-pattern',
    mechanic: 'visual',
    category: 'ВНИМАНИЕ',
    title: 'Одна карточка отличается',
    prompt: 'Найди карточку, в которой нарушено чередование фигур.',
    items: [
      { id: 'a', label: 'Круг, квадрат, круг, квадрат', rows: ['● ■ ● ■'] },
      { id: 'b', label: 'Квадрат, круг, квадрат, круг', rows: ['■ ● ■ ●'] },
      { id: 'c', label: 'Круг, квадрат, квадрат, круг', rows: ['● ■ ■ ●'] },
      { id: 'd', label: 'Квадрат, круг, квадрат, круг', rows: ['■ ● ■ ●'] },
    ],
    correctItemId: 'c',
    hint: 'У правильного чередования одинаковые фигуры не стоят рядом.',
    answerText: 'Карточка с двумя квадратами в середине.',
    explanation: 'Только в ней две одинаковые фигуры соседствуют и ритм «круг — квадрат» прерывается.',
  },
  {
    id: 'visual-diagonal-turn',
    mechanic: 'visual',
    category: 'ЗАКОНОМЕРНОСТЬ',
    title: 'Ещё один поворот',
    prompt: 'Стрелка поворачивается на 45° по часовой стрелке. Что будет дальше?',
    lead: '↗   →   ↘   ↓   ?',
    items: [
      { id: 'a', label: 'Вниз и влево', rows: ['↙'] },
      { id: 'b', label: 'Влево', rows: ['←'] },
      { id: 'c', label: 'Вверх и вправо', rows: ['↗'] },
      { id: 'd', label: 'Вверх', rows: ['↑'] },
    ],
    correctItemId: 'a',
    hint: 'Между направлением вниз и направлением влево есть диагональное положение.',
    answerText: 'Стрелка вниз и влево.',
    explanation: 'Каждый шаг добавляет поворот на 45°: после направления вниз идёт диагональ вниз-влево.',
  },
] as const;

export const PUZZLES: readonly PuzzleDefinition[] = [
  ...TACTILE_PUZZLES,
  ...LEGACY_PUZZLES,
];

export function puzzleById(id: string) {
  return PUZZLES.find((puzzle) => puzzle.id === id);
}

function stableIndex(seed: number, length: number) {
  if (length <= 1) return 0;
  let value = (Math.trunc(seed) ^ Math.trunc(seed / 0x1_0000_0000)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) % length;
}

export function selectNextPuzzle(seenPuzzleIds: readonly string[], seed: number) {
  const seen = new Set(seenPuzzleIds);
  const unseen = TACTILE_PUZZLES.filter((puzzle) => !seen.has(puzzle.id));
  if (!unseen.length) return undefined;
  return unseen[stableIndex(seed + seenPuzzleIds.length * 97, unseen.length)];
}

function initialResponse(puzzle: PuzzleDefinition, seed: number) {
  if (puzzle.mechanic === 'slide') return [...puzzle.start];
  if (puzzle.mechanic !== 'order') return [];
  const ids = puzzle.items.map((item) => item.id);
  const shift = 1 + stableIndex(seed, Math.max(1, ids.length - 1));
  return [...ids.slice(shift), ...ids.slice(0, shift)];
}

export function createPuzzleSession(
  puzzle: PuzzleDefinition,
  pauseAnchor: number,
  pauseEndAt: number,
  now: number,
): PuzzleSession {
  return {
    puzzleId: puzzle.id,
    pauseAnchor,
    openedAt: now,
    hintUnlockAt: Math.min(pauseEndAt, now + PUZZLE_HINT_DELAY_MS),
    answerUnlockAt: Math.min(pauseEndAt, now + PUZZLE_ANSWER_DELAY_MS),
    response: initialResponse(puzzle, pauseAnchor + now),
    attempts: 0,
    hintRevealed: false,
    status: 'active',
  };
}

export function startOrResumePuzzle(
  state: LocalPuzzleState,
  pauseAnchor: number,
  pauseEndAt: number,
  now: number,
): LocalPuzzleState {
  const currentPuzzle = state.current ? puzzleById(state.current.puzzleId) : undefined;
  const currentIsTactile = currentPuzzle?.mechanic === 'slide';
  if (currentIsTactile && state.current?.pauseAnchor === pauseAnchor) {
    return state;
  }
  const puzzle = selectNextPuzzle(state.seenPuzzleIds, pauseAnchor);
  if (!puzzle) return { ...state, current: undefined };
  return {
    ...state,
    current: createPuzzleSession(puzzle, pauseAnchor, pauseEndAt, now),
    seenPuzzleIds: [...state.seenPuzzleIds, puzzle.id],
  };
}

export function isPuzzleResponseCorrect(puzzle: PuzzleDefinition, response: readonly string[]) {
  if (puzzle.mechanic === 'choice') return response[0] === puzzle.correctOptionId;
  if (puzzle.mechanic === 'visual') return response[0] === puzzle.correctItemId;
  return (
    response.length === puzzle.correctOrder.length &&
    response.every((item, index) => item === puzzle.correctOrder[index])
  );
}

export function moveSlideTile(
  puzzle: SlidePuzzle,
  response: readonly string[],
  tileId: string,
) {
  const tileIndex = response.indexOf(tileId);
  const blankIndex = response.indexOf('0');
  if (tileIndex < 0 || blankIndex < 0 || tileId === '0') return [...response];

  const tileRow = Math.floor(tileIndex / puzzle.size);
  const tileColumn = tileIndex % puzzle.size;
  const blankRow = Math.floor(blankIndex / puzzle.size);
  const blankColumn = blankIndex % puzzle.size;
  const adjacent = Math.abs(tileRow - blankRow) + Math.abs(tileColumn - blankColumn) === 1;
  if (!adjacent) return [...response];

  const next = [...response];
  [next[tileIndex], next[blankIndex]] = [next[blankIndex], next[tileIndex]];
  return next;
}

export function submitPuzzleResponse(
  session: PuzzleSession,
  puzzle: PuzzleDefinition,
  now: number,
): PuzzleSession {
  if (session.status !== 'active') return session;
  const solved = isPuzzleResponseCorrect(puzzle, session.response);
  return {
    ...session,
    attempts: session.attempts + 1,
    status: solved ? 'solved' : 'active',
    solvedAt: solved ? now : undefined,
  };
}

export const canRevealPuzzleHint = (session: PuzzleSession, now: number) =>
  now >= session.hintUnlockAt;

export const canRevealPuzzleAnswer = (session: PuzzleSession, now: number) =>
  now >= session.answerUnlockAt;

export function revealPuzzleHint(session: PuzzleSession, now: number): PuzzleSession {
  if (!canRevealPuzzleHint(session, now) || session.status !== 'active') return session;
  return { ...session, hintRevealed: true };
}

export function revealPuzzleAnswer(session: PuzzleSession, now: number): PuzzleSession {
  if (!canRevealPuzzleAnswer(session, now) || session.status !== 'active') return session;
  return { ...session, status: 'revealed', revealedAt: now };
}
