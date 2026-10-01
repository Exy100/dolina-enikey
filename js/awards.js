/* Достижения для страницы героя: за то, что звёзды не меряют, — упорство, чистый код, догадки, домашку.
   Каждое достижение — счётчик key из сводки A (её собирает app.js по сохранению или по ссылке) и цель goal.
   Тексты читает ученик: на «ты» и без мужского рода. */
const HeroAwards = (() => {
  // icon — линии в квадрате 24 × 24 (рисуются обводкой), hue — цвет медали
  const LIST = [
    { id: 'first', name: 'Первая программа', desc: 'Реши первое задание', key: 'solved', goal: 1, hue: 'violet',
      icon: '<path d="M4 7l5 5-5 5"/><path d="M12 17h8"/>' },
    { id: 'prolog', name: 'Начало пути', desc: 'Пройди пролог', key: 'prolog', goal: 1, hue: 'mint',
      icon: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>' },
    { id: 'firsttry', name: 'С первого раза', desc: 'Пять заданий, решённых с первого запуска', key: 'first', goal: 5, hue: 'coral',
      icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>' },
    { id: 'nohints', name: 'Своим умом', desc: 'Десять заданий без подсказок', key: 'noHints', goal: 10, hue: 'gold',
      icon: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>' },
    { id: 'short', name: 'Короче некуда', desc: 'Десять звёзд за короткий код', key: 'short', goal: 10, hue: 'sky',
      icon: '<path d="M3 12h6M15 12h6"/><path d="M6 8l4 4-4 4M18 8l-4 4 4 4"/>' },
    { id: 'fixer', name: 'Отладчик', desc: 'Почини три сломанные программы', key: 'fixes', goal: 3, hue: 'coral',
      icon: '<path d="M14.5 4.5a4.5 4.5 0 0 0-5.3 5.9L3.5 16.1l4.4 4.4 5.7-5.7a4.5 4.5 0 0 0 5.9-5.3l-2.8 2.8-3-.6-.6-3z"/>' },
    { id: 'seer', name: 'Провидец', desc: 'Пять верных догадок подряд в «Угадай»', key: 'streak', goal: 5, hue: 'pink',
      icon: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' },
    { id: 'bonus', name: 'Со звёздочкой', desc: 'Реши три задания со звёздочкой', key: 'bonus', goal: 3, hue: 'gold',
      icon: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>' },
    { id: 'warm', name: 'В форме', desc: 'Пройди шесть разминок', key: 'warm', goal: 6, hue: 'mint',
      icon: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>' },
    { id: 'hw', name: 'Домашка готова', desc: 'Сделай домашку целиком', key: 'hw', goal: 1, hue: 'violet',
      icon: '<path d="M6 3h11a1 1 0 0 1 1 1v17H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/><path d="M9 11l2 2 4-4"/>' },
    { id: 'builder', name: 'Строитель', desc: 'Нарисуй свой уровень в редакторе', key: 'built', goal: 1, hue: 'sky',
      icon: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>' },
    { id: 'days', name: 'Упорство', desc: 'Занимайся в пять разных дней', key: 'days', goal: 5, hue: 'mint',
      icon: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>' },
    { id: 'lines', name: 'Сто строк', desc: 'Напиши 100 строк кода', key: 'lines', goal: 100, hue: 'violet',
      icon: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' },
    { id: 'perfect', name: 'Звездочёт', desc: 'Все задания одного урока на три звезды', key: 'perfect', goal: 1, hue: 'gold',
      icon: '<path d="M5 18l5-6 4 3 5-9"/><circle cx="5" cy="18" r="1.6"/><circle cx="10" cy="12" r="1.6"/><circle cx="14" cy="15" r="1.6"/><circle cx="19" cy="6" r="1.6"/>' },
    { id: 'half', name: 'Полпути', desc: 'Пройди четыре урока', key: 'lessons', goal: 4, hue: 'sky',
      icon: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M15 4v6M15 4h4l-1 1.5 1 1.5h-4"/>' },
    { id: 'finale', name: 'Сбой починен', desc: 'Пройди всю долину и верни Ключ-код', key: 'course', goal: 1, hue: 'pink',
      icon: '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21M17.5 12v3.4M20.5 12v2.4"/>' },
  ];

  // Сводка A → [{ ...достижение, value, done }] по порядку списка
  function evaluate(A) {
    return LIST.map(a => {
      const value = Math.max(0, Math.floor(+A[a.key] || 0));
      return Object.assign({}, a, { value: Math.min(value, a.goal), done: value >= a.goal });
    });
  }

  return { LIST, evaluate };
})();
if (typeof module !== 'undefined') module.exports = HeroAwards;
