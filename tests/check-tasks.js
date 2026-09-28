// Проверка заданий: node tests/check-tasks.js
// Для каждого задания всех уроков (на 40 наборах случайных карт; у нарисованной карты набор один):
//  - эталонное решение (hints[2]) и другие верные варианты (ALSO_OK) обязаны проходить все карты;
//  - стартовый код обязан ломаться хотя бы на одной карте;
//  - типичные ошибки (WRONG) обязаны ломаться на каждом наборе карт и с нужной причиной (kind);
//  - если третья звезда за «коротко», эталон укладывается в best строк.
// Ещё проверяется, что каждый файл из js/lessons/ подключён в index.html и id заданий не повторяются.
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
const LESSON_DIR = path.join(__dirname, '../js/lessons');
const lessonFiles = fs.readdirSync(LESSON_DIR).filter(f => f.endsWith('.js')).sort();
lessonFiles.forEach(f => require(path.join(LESSON_DIR, f)));

const ALSO_OK = {
  'k-steps': ['вперёд(3)\n'],
  'k-turn': ['вперёд(2)\nналево()\nвперёд(2)\n'],
  'k-final': ['вперёд()\nвперёд()\nвзять()\nналево()\nвперёд()\nвперёд()\nвперёд()\nвзять()\nнаправо()\nвперёд()\nпрыгнуть()\nвперёд()\n'],
  'c-stairs': ['вперёд()\nналево()\nвперёд()\nнаправо()\n'.repeat(4)], // без цикла тоже верно, только длинно
  coins: [
    'for i in range(8):\n    if есть_монета():\n        взять()\n    вперёд()\n', // сначала проверка, потом шаг
  ],
  fix: [
    'for i in range(10):\n    if есть_монета():\n        взять()\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', // монета в начале цикла
  ],
  choice: [
    'for i in range(20):\n    if лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\n', // другой порядок
    'for i in range(20):\n    if стена_впереди():\n        налево()\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', // без elif
    'while not на_финише():\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n',
  ],
  bag: [
    'for i in range(8):\n    вперёд()\n    if есть_монета():\n        if монет_собрано() < 3:\n            взять()\n', // вложенные if
    'for i in range(8):\n    вперёд()\n    if есть_монета() and монет_собрано() != 3:\n        взять()\n',
  ],
  stop: [
    'for i in range(20):\n    if not на_финише():\n        вперёд()\n', // for и if
  ],
  final: [
    'for i in range(30):\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n    if есть_монета():\n        взять()\n', // монета после шага
  ],
};
const WRONG = {
  'k-steps': [['вперёд(2)\n', 'short']],
  'k-turn': [['вперёд(2)\nнаправо()\nвперёд(2)\n', 'wall']], // перепутал налево и направо
  'k-coins': [['STARTER', 'coins']],
  'k-lava': [['STARTER', 'lava'], ['вперёд()\nвперёд()\n', 'lava']],
  'k-fix': [['STARTER', 'wall']],
  'c-coins': [['STARTER', 'short'], ['for i in range(9):\n    вперёд()\n    взять()\n', 'short']], // на шаг меньше
  'c-fix': [['STARTER', 'coins']],
  'c-two': [['for i in range(4):\n    вперёд()\n    взять()\n    налево()\n', 'wall']], // поворот внутри цикла
  coins: [
    ['for i in range(8):\n    вперёд()\n', 'coins'], // монеты не собирает
    ['for i in range(8):\n    вперёд()\nif есть_монета():\n    взять()\n', 'coins'], // проверка после цикла
    ['for i in range(8):\n    if есть_монета():\n        взять()\n        вперёд()\n', 'stuck'], // вперёд() внутри if
  ],
  turn: [
    ['for i in range(8):\n    if стена_впереди():\n        налево()\n        вперёд()\n', 'stuck'], // вперёд() внутри if
  ],
  fix: [
    ['STARTER', 'coins'], // сама сломанная программа: теряет монету за лавой на каждом наборе карт
    ['for i in range(10):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', 'coins'], // монеты не собирает
  ],
  choice: [
    ['STARTER', 'wall'], // не поворачивает
    ['for i in range(20):\n    if стена_впереди():\n        налево()\n    вперёд()\n', 'lava'], // не прыгает
  ],
  bag: [
    ['STARTER', 'full'], // берёт все монеты
    ['for i in range(8):\n    вперёд()\n    if есть_монета() and монет_собрано() <= 3:\n        взять()\n', 'full'], // <= вместо <
    ['for i in range(8):\n    вперёд()\n    if есть_монета() and монет_собрано() < 2:\n        взять()\n', 'coins'], // берёт только 2
  ],
  stop: [
    ['for i in range(20):\n    вперёд()\n', 'wall'], // проходит мимо флага в стену
    ['while на_финише():\n    вперёд()\n', 'stop'], // забыл not
  ],
  final: [
    ['STARTER', 'short'], // пустая программа
    ['while not на_финише():\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', 'coins'], // не собирает монеты
  ],
};

let errors = 0;
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
lessonFiles.forEach(f => {
  if (!html.includes(`src="js/lessons/${f}"`)) { console.log(`✗ урок ${f} не подключён в index.html`); errors++; }
});
const TASKS = W.LESSONS.flatMap(l => l.tasks);
const ids = new Set();
TASKS.forEach(t => { if (ids.has(t.id)) { console.log(`✗ id «${t.id}» повторяется`); errors++; } ids.add(t.id); });
const codeLines = code => code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
TASKS.forEach(t => {
  if (t.star3 !== 'first' && codeLines(t.hints[2]) > t.best) { console.log(`✗ ${t.id}: эталон длиннее best (${codeLines(t.hints[2])} > ${t.best})`); errors++; }
  const seeds = t.map ? 1 : 40, count = t.map ? 1 : 3;
  for (let seed = 1; seed <= seeds; seed++) {
    const maps = W.makeMaps(t, seed);
    if (maps.length !== count) { console.log(`✗ ${t.id}: сгенерировано ${maps.length} карт вместо ${count} (seed ${seed})`); errors++; }
    [t.hints[2], ...(ALSO_OK[t.id] || [])].forEach((code, i) => maps.forEach(m => {
      const r = W.runSilent(code, m);
      if (!r.ok) { console.log(`✗ ${t.id}: ${i ? `верный вариант ${i}` : 'решение'} не прошло карту ${m.sig} (seed ${seed}): ${r.err}`); errors++; }
    }));
    if (maps.every(m => W.runSilent(t.starter, m).ok)) { console.log(`✗ ${t.id}: стартовый код проходит все карты (seed ${seed})`); errors++; }
    (WRONG[t.id] || []).forEach(([code, kind], i) => {
      if (code === 'STARTER') code = t.starter;
      const fail = maps.map(m => W.runSilent(code, m)).find(r => !r.ok);
      if (!fail) { console.log(`✗ ${t.id}: ошибка ${i + 1} проходит все карты (seed ${seed})`); errors++; }
      else if (fail.kind !== kind) { console.log(`✗ ${t.id}: ошибка ${i + 1} ломается не так (seed ${seed}): ждали ${kind}, а вышло ${fail.kind}: ${fail.err}`); errors++; }
    });
  }
  console.log(`${t.id}: проверено`);
});
console.log(errors ? `Ошибок: ${errors}` : 'Все задания в порядке.');
process.exit(errors ? 1 : 0);
