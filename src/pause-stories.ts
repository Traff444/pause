export type PauseStoryId = 'moon' | 'music' | 'scent';

export type PauseStoryPage = {
  eyebrow: string;
  title: string;
  body: string;
  note?: string;
};

export type PauseStory = {
  id: PauseStoryId;
  category: string;
  title: string;
  shortTitle: string;
  duration: string;
  image: string;
  imageAlt: string;
  sourceLabel: string;
  sourceUrl: string;
  pages: readonly PauseStoryPage[];
};

export const PAUSE_STORIES: readonly PauseStory[] = [
  {
    id: 'moon',
    category: 'НЕОЖИДАННЫЙ МИР',
    title: 'Почему Луна кажется огромной у горизонта?',
    shortTitle: 'Почему Луна кажется огромной?',
    duration: '2 мин',
    image: 'assets/stories/moon-illusion.jpg',
    imageAlt: 'Человек смотрит на огромную полную Луну у горизонта',
    sourceLabel: 'NASA Science',
    sourceUrl: 'https://science.nasa.gov/solar-system/moon/the-moon-illusion-why-does-the-moon-look-so-big-sometimes/',
    pages: [
      {
        eyebrow: '1 ИЗ 4',
        title: 'Луна на самом деле не становится больше',
        body: 'Снимки с одинаковым увеличением показывают: у горизонта и высоко в небе ширина Луны почти одинакова. Меняется наше восприятие.',
      },
      {
        eyebrow: '2 ИЗ 4',
        title: 'Иллюзию создаёт не атмосфера',
        body: 'Низкая Луна действительно выглядит теплее по цвету, но её кажущийся размер — работа зрения и мозга, а не эффект увеличивающей линзы в воздухе.',
      },
      {
        eyebrow: '3 ИЗ 4',
        title: 'Мозг ищет знакомый масштаб',
        body: 'Деревья, здания и горы могут давать подсказки о расстоянии. Рядом с ними Луна кажется особенно большой. Но это лишь часть возможного объяснения.',
      },
      {
        eyebrow: 'ИСТОРИЯ ЗАВЕРШЕНА',
        title: 'Точного ответа всё ещё нет',
        body: 'Лунную иллюзию наблюдают тысячи лет, но единого полного объяснения пока не существует.',
        note: 'Попробуй вечером: сравни Луну со своим ногтем на вытянутой руке или посмотри на неё через бумажную трубку.',
      },
    ],
  },
  {
    id: 'music',
    category: 'КАК ЭТО УСТРОЕНО',
    title: 'Почему музыка иногда вызывает мурашки?',
    shortTitle: 'Почему музыка вызывает мурашки?',
    duration: '2 мин',
    image: 'assets/stories/music-chills.jpg',
    imageAlt: 'Человек слушает музыку, световая волна касается руки и превращается в мурашки',
    sourceLabel: 'Nature Neuroscience',
    sourceUrl: 'https://www.nature.com/articles/nn.2726',
    pages: [
      {
        eyebrow: '1 ИЗ 4',
        title: 'Мурашки от музыки — настоящая реакция тела',
        body: 'Иногда сильный музыкальный момент вызывает дрожь, холодок по спине или мурашки. Исследователи называют такую реакцию chills или frisson.',
      },
      {
        eyebrow: '2 ИЗ 4',
        title: 'Удовольствие начинается ещё до любимого момента',
        body: 'Мозг постоянно угадывает, что прозвучит дальше. Ожидание знакомой кульминации уже может включать систему вознаграждения.',
      },
      {
        eyebrow: '3 ИЗ 4',
        title: 'Ожидание и пик переживаются по-разному',
        body: 'В одном исследовании предвкушение и сама музыкальная кульминация были связаны с выбросом дофамина в разных участках полосатого тела.',
      },
      {
        eyebrow: 'ИСТОРИЯ ЗАВЕРШЕНА',
        title: 'Но мурашки бывают не у всех',
        body: 'Это не тест на музыкальность. Реакция зависит от человека, знакомой музыки и конкретного момента.',
        note: 'Вспомни песню, в которой ты заранее ждёшь один определённый переход, голос или аккорд.',
      },
    ],
  },
  {
    id: 'scent',
    category: 'МОЗГ И ПАМЯТЬ',
    title: 'Почему запах возвращает далёкие воспоминания?',
    shortTitle: 'Почему запах возвращает прошлое?',
    duration: '2 мин',
    image: 'assets/stories/scent-memory.jpg',
    imageAlt: 'Запах трав превращается для человека в тёплое воспоминание о доме и летнем пейзаже',
    sourceLabel: 'Frontiers in Psychology',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3990043/',
    pages: [
      {
        eyebrow: '1 ИЗ 4',
        title: 'Иногда запах переносит в прошлое мгновенно',
        body: 'Аромат травы, выпечки или старой книги способен неожиданно вернуть конкретное место и момент, о котором ты давно не думал.',
      },
      {
        eyebrow: '2 ИЗ 4',
        title: 'Обоняние тесно связано с эмоциями',
        body: 'Сигналы запаха быстро достигают областей мозга, участвующих в эмоциях и памяти. Поэтому воспоминание может появиться раньше, чем слова для его описания.',
      },
      {
        eyebrow: '3 ИЗ 4',
        title: 'Такие воспоминания часто старше',
        body: 'Исследования показывают: воспоминания, вызванные запахом, нередко относятся к более ранним периодам жизни и переживаются ярко и эмоционально.',
      },
      {
        eyebrow: 'ИСТОРИЯ ЗАВЕРШЕНА',
        title: 'Редкость делает момент особенно сильным',
        body: 'Запахи вызывают личные воспоминания реже, чем слова или изображения. Их внезапность может усиливать ощущение путешествия во времени.',
        note: 'Попробуй назвать запах, который сразу напоминает тебе конкретное место.',
      },
    ],
  },
] as const;

export function pauseStoryById(id: PauseStoryId) {
  return PAUSE_STORIES.find((story) => story.id === id) ?? PAUSE_STORIES[0];
}

export function nextPauseStory(currentId: PauseStoryId) {
  const currentIndex = PAUSE_STORIES.findIndex((story) => story.id === currentId);
  return PAUSE_STORIES[(currentIndex + 1) % PAUSE_STORIES.length];
}
