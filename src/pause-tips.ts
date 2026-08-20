export type PauseTipStage = 'early' | 'middle' | 'late';

export type PauseTip = {
  id: string;
  stage: PauseTipStage;
  text: string;
  source: 'WHO' | 'CDC' | 'Smokefree';
};

export const PAUSE_TIPS: PauseTip[] = [
  { id: 'water-slowly', stage: 'early', text: 'Выпей стакан воды маленькими глотками.', source: 'WHO' },
  { id: 'ten-breaths', stage: 'early', text: 'Сделай 10 медленных вдохов: носом вдох, ртом выдох.', source: 'Smokefree' },
  { id: 'sugar-free-gum', stage: 'early', text: 'Возьми жвачку без сахара.', source: 'CDC' },
  { id: 'sugar-free-candy', stage: 'early', text: 'Рассоси леденец без сахара.', source: 'Smokefree' },
  { id: 'switch-task', stage: 'early', text: 'Встань и сразу смени занятие.', source: 'Smokefree' },
  { id: 'cool-water', stage: 'early', text: 'Умойся прохладной водой.', source: 'WHO' },
  { id: 'brush-teeth', stage: 'early', text: 'После еды почисти зубы.', source: 'CDC' },
  { id: 'change-room', stage: 'early', text: 'Перейди в другую комнату.', source: 'Smokefree' },
  { id: 'delay-five', stage: 'early', text: 'Отложи решение ещё на пять минут.', source: 'WHO' },
  { id: 'calm-steps', stage: 'early', text: 'Сделай несколько спокойных шагов.', source: 'CDC' },

  { id: 'five-minute-walk', stage: 'middle', text: 'Пройдись пять минут.', source: 'CDC' },
  { id: 'take-stairs', stage: 'middle', text: 'Поднимись и спустись по лестнице.', source: 'Smokefree' },
  { id: 'favorite-music', stage: 'middle', text: 'Включи любимую музыку.', source: 'CDC' },
  { id: 'call-trusted-person', stage: 'middle', text: 'Позвони человеку, которому доверяешь.', source: 'CDC' },
  { id: 'text-someone', stage: 'middle', text: 'Напиши близкому: «Отвлеки меня на пять минут».', source: 'Smokefree' },
  { id: 'busy-hands', stage: 'middle', text: 'Займи руки: порисуй или возьми эспандер.', source: 'CDC' },
  { id: 'useful-task', stage: 'middle', text: 'Сделай одно небольшое полезное дело.', source: 'Smokefree' },
  { id: 'smokefree-place', stage: 'middle', text: 'Перейди туда, где нельзя курить.', source: 'Smokefree' },
  { id: 'short-game', stage: 'middle', text: 'Сыграй один короткий раунд.', source: 'CDC' },
  { id: 'funny-video', stage: 'middle', text: 'Посмотри короткое видео, которое тебя смешит.', source: 'CDC' },

  { id: 'remember-reason', stage: 'late', text: 'Напомни себе, зачем ты держишь эту паузу.', source: 'Smokefree' },
  { id: 'review-savings', stage: 'late', text: 'Посмотри, сколько денег уже удалось сохранить.', source: 'Smokefree' },
  { id: 'not-a-command', stage: 'late', text: 'Скажи: «Это желание, а не команда».', source: 'CDC' },
  { id: 'urge-wave', stage: 'late', text: 'Представь тягу как волну, которая скоро спадёт.', source: 'CDC' },
  { id: 'name-feeling', stage: 'late', text: 'Назови вслух, что ты сейчас чувствуешь.', source: 'CDC' },
  { id: 'no-decision-now', stage: 'late', text: 'Скажи: «Мне не нужно решать прямо сейчас».', source: 'WHO' },
  { id: 'remember-success', stage: 'late', text: 'Вспомни паузу, которую уже удалось пройти.', source: 'Smokefree' },
  { id: 'kind-action', stage: 'late', text: 'Сделай что-нибудь доброе для близкого.', source: 'Smokefree' },
  { id: 'observe-object', stage: 'late', text: 'Выбери предмет рядом и внимательно рассмотри его.', source: 'CDC' },
  { id: 'watch-craving', stage: 'late', text: 'Просто наблюдай за тягой — она изменится.', source: 'CDC' },
];

const tipsByStage = (stage: PauseTipStage) => PAUSE_TIPS.filter((tip) => tip.stage === stage);

export function pauseTipForProgress(progress: number, pauseSeed: number) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const stage: PauseTipStage = safeProgress < 30 ? 'early' : safeProgress < 80 ? 'middle' : 'late';
  const slot = safeProgress >= 50 && safeProgress < 80 ? 1 : 0;
  const pool = tipsByStage(stage);
  const stageOffset = stage === 'early' ? 0 : stage === 'middle' ? 3 : 6;
  const normalizedSeed = Math.abs(pauseSeed) < 60_000
    ? Math.trunc(pauseSeed)
    : Math.trunc(pauseSeed / 60_000);
  const index = Math.abs(normalizedSeed * 31 + stageOffset + slot * 7) % pool.length;
  return pool[index];
}
