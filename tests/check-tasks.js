// Проверка заданий: node tests/check-tasks.js
// Для каждого задания всех уроков (на 40 наборах случайных карт; у нарисованной карты набор один):
//  - эталонное решение (hints[2]) и другие верные варианты (ALSO_OK) обязаны проходить все карты;
//  - стартовый код обязан ломаться хотя бы на одной карте;
//  - типичные ошибки (WRONG) обязаны ломаться на каждом наборе карт и с нужной причиной (kind);
//  - если третья звезда за «коротко», эталон укладывается в best строк.
// Ещё проверяется, что каждый файл из js/lessons/ подключён в index.html и id заданий не повторяются,
// а уровни ролика для Авито (REEL в js/app.js, режим ?show) существуют и проходятся на его картах;
// задания кадров для Авито (js/poster.js, ?shots) проходят карту кадра, код консоли печатает то, что на кадре.
// Глубже, на большем числе наборов карт: SEEDS=1000 node tests/check-tasks.js
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
const SEEDS = Number(process.env.SEEDS) || 40;
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
// Уроки 4–7
Object.assign(ALSO_OK, {
  'p-wall': ['for i in range(12):\n    if стена_впереди():\n        break\n    вперёд()\nналево()\nвперёд(2)\n'], // for и break
  'p-gates': ['while not на_финише():\n    if ворота_впереди():\n        открыть()\n    вперёд()\n'], // без else
  'p-five': ['while not на_финише():\n    вперёд()\n    if есть_монета():\n        взять()\n'], // флаг стоит на пятой монете
  'v-steps': ['шаги = 0\nwhile not на_финише():\n    вперёд()\n    шаги += 1\nсказать(шаги)\n'],
  'v-sign': ['нужно = табличка()\nwhile монет_собрано() < нужно:\n    вперёд()\n    if есть_монета():\n        взять()\nwhile not на_финише():\n    вперёд()\n'], // два цикла
  'v-corners': ['while not на_финише():\n    вперёд(табличка())\n    налево()\n'], // без переменной
  'l-right': ['while not на_финише():\n    if not стена_слева():\n        налево()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        направо()\n'], // левая рука
  'l-broken': ['while not at_goal():\n    if not wall_on_right():\n        turn_left()\n        turn_left()\n        turn_left()\n        move()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_left()\n'], // без своего приёма
});
const WRONG = {
  'k-steps': [['вперёд(2)\n', 'short'], ['вперёд()\n'.repeat(5), 'extra'], ['вперёд(100)\n', 'extra']], // шаги после флага — лишние
  'k-turn': [['вперёд(2)\nнаправо()\nвперёд(2)\n', 'wall']], // перепутал налево и направо
  'k-far': [['вперёд(4)\nналево()\nвперёд(99)\n', 'extra']], // «с запасом» в уроке без условий нельзя
  'k-coins': [['STARTER', 'coins'],
    ['вперёд()\nвзять()\nвперёд()\nвперёд()\nнаправо()\nвперёд()\nвперёд()\n', 'coins'], // забыл вторую монету
    ['вперёд()\nвперёд()\nвзять()\n', 'air']], // взял на шаг позже
  'k-lava': [['STARTER', 'lava'], ['вперёд()\nвперёд()\n', 'lava'],
    ['вперёд()\nпрыгнуть()\nвперёд()\nпрыгнуть()\nвперёд()\n', 'coins'], // прошёл мимо монеты
    ['прыгнуть()\n', 'nojump'], // прыгнул, когда лавы впереди нет
    ['вперёд()\nпрыгнуть()\nвзять()\n', 'air']], // монета на шаг дальше
  'k-fix': [['STARTER', 'wall']],
  'c-coins': [['STARTER', 'short'], ['for i in range(9):\n    вперёд()\n    взять()\n', 'short'], ['for i in range(11):\n    вперёд()\n    взять()\n', 'extra']], // на шаг меньше и на шаг больше
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

const NICHE_LEFT = 'def развернуться():\n    налево()\n    налево()\n\ndef ниша():\n    налево()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    налево()\n\nwhile not на_финише():\n    if not стена_слева():\n        ниша()\n    вперёд()\n';
const RIGHT_RU = 'while not на_финише():\n    if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()\n';
const RIGHT_EN_COINS = 'while not at_goal():\n    if coin_here():\n        take()\n    if not wall_on_right():\n        turn_right()\n        move()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_left()\n';
Object.assign(WRONG, {
  'p-wall': [['STARTER', 'wall']], // for с числом: дорога каждый раз другой длины
  'p-coins': [['STARTER', 'coins']],
  'p-gate': [['STARTER', 'gate']], // ворота — не стена
  'p-fix': [['STARTER', 'loop']], // вечный цикл
  'p-gates': [['while not на_финише():\n    вперёд()\n', 'gate']],
  'p-five': [['STARTER', 'full']],
  'v-steps': [['STARTER', 'answer'], ['шаги = 0\nwhile not на_финише():\n    вперёд()\n    шаги = шаги + 1\nсказать(5)\n', 'answer']], // ответ наугад
  'v-sign': [['STARTER', 'full'], ['while монет_собрано() < табличка():\n    вперёд()\n    if есть_монета():\n        взять()\n', 'nosign']], // не запомнил число
  'v-lava': [['STARTER', 'answer']],
  'v-fix': [['STARTER', 'answer']],
  'v-corners': [['while not на_финише():\n    if стена_впереди():\n        налево()\n    else:\n        вперёд()\n', 'loop']], // без табличек заходит в тупики
  'v-sum': [['while not на_финише():\n    if есть_монета():\n        взять()\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\nсказать(монет_собрано())\n', 'answer']], // забыл лаву
  'f-back': [['STARTER', 'short']],
  'f-niche': [['STARTER', 'wall']], // из ниши не вернулся
  'f-param': [['STARTER', 'loop']],
  'f-fix': [['STARTER', 'wall']],
  'f-both': [[NICHE_LEFT, 'coins']], // только левые ниши
  'f-hand': [['STARTER', 'loop']],
  'l-right': [['STARTER', 'loop']], // только налево — блуждает по кругу
  'l-coins': [['STARTER', 'coins']],
  'l-english': [['STARTER', 'english']],
  'l-fix': [['STARTER', 'loop']], // поворот без шага
  'l-steps': [[RIGHT_EN_COINS, 'answer']], // ничего не сказал
  'l-left': [[RIGHT_EN_COINS, 'coins']], // правая рука пропускает монету
  'l-broken': [['STARTER', 'broken']],
  'l-boss': [[RIGHT_RU, 'english']],
  // задания со звёздочкой
  'k-star': [['вперёд()\nпрыгнуть()\nвперёд(2)\nналево()\nвперёд(3)\nвзять()\nналево()\nвперёд()\nпрыгнуть()\nвперёд()\n', 'coins'], // забыл первую монету
    ['вперёд()\nпрыгнуть()\nвперёд(2)\nвзять()\nнаправо()\nвперёд(3)\n', 'wall']],
  'c-star': [['for j in range(3):\n    for i in range(3):\n        вперёд()\n        налево()\n        вперёд()\n        направо()\nпрыгнуть()\n', 'lava'], // прыжок вне внешнего цикла: после первой лестницы — лава
    ['for j in range(3):\n    for i in range(3):\n        вперёд()\n        налево()\n        вперёд()\n        направо()\n        прыгнуть()\n', 'nojump']], // прыжок внутри внутреннего
  'u-star': [['STARTER', 'full']],
  'p-star': [['STARTER', 'loop'], ['while not на_финише():\n    if ворота_впереди():\n        открыть()\n    elif стена_впереди():\n        налево()\n        налево()\n        налево()\n    else:\n        вперёд()\n', 'loop']], // всегда направо
  'v-star': [['STARTER', 'answer'],
    ['длина = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n        длина = 0\n    else:\n        вперёд()\n        длина = длина + 1\nсказать(длина)\n', 'answer'], // длина последнего участка
    ['длина = 0\nлучшая = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n    else:\n        вперёд()\n        длина = длина + 1\n        if длина > лучшая:\n            лучшая = длина\nсказать(лучшая)\n', 'answer']], // не обнулил на повороте
  'f-star': [['STARTER', 'lava'],
    ['def шаг():\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\nwhile not на_финише():\n    if not стена_справа():\n        направо()\n        шаг()\n    elif not стена_впереди():\n        шаг()\n    else:\n        налево()\n', 'coins']], // монеты забыты
  'l-star': [['STARTER', 'lava']],
});

let errors = 0;
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
lessonFiles.forEach(f => {
  if (!html.includes(`src="js/lessons/${f}"`)) { console.log(`✗ урок ${f} не подключён в index.html`); errors++; }
});
const TASKS = W.LESSONS.flatMap(l => [...l.tasks, ...(l.bonus || [])]); // с заданиями со звёздочкой
// Разминка: только задания прошлых уроков
W.LESSONS.forEach((l, li) => (l.warmup || []).forEach(id => {
  const from = W.LESSONS.findIndex(x => x.tasks.some(t => t.id === id));
  if (from < 0) { console.log(`✗ ${l.id}: в разминке задание «${id}», которого нет`); errors++; }
  else if (from >= li) { console.log(`✗ ${l.id}: в разминке задание «${id}» не из прошлого урока`); errors++; }
}));
const ids = new Set();
TASKS.forEach(t => { if (ids.has(t.id)) { console.log(`✗ id «${t.id}» повторяется`); errors++; } ids.add(t.id); });
const codeLines = code => code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
TASKS.forEach(t => {
  if (t.star3 !== 'first' && codeLines(t.hints[2]) > t.best) { console.log(`✗ ${t.id}: эталон длиннее best (${codeLines(t.hints[2])} > ${t.best})`); errors++; }
  const seeds = t.map ? 1 : SEEDS, count = t.map ? 1 : 3;
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
// Свой уровень (редактор): решение, которое строит checkLevel, проходит карту; битые карты отклоняются с понятной причиной
[
  [['>..$.F'], true], [[' F.~.$', '     .', '     .', '>.~..$'], true], [['v....', '.   F', '.....'], true],
  [['>.~~.F'], false], [['>...'], false], [['>.F.$'], false], [['   $', '>..F.'], false], [['>F', 'x'], false],
].forEach(([rows, ok]) => {
  const c = W.checkLevel(rows);
  if (c.ok !== ok) { console.log(`✗ свой уровень ${JSON.stringify(rows)}: ждали ${ok ? 'годится' : 'не годится'}, а вышло ${c.ok ? 'годится' : c.msg}`); errors++; }
  else if (ok && !W.runSilent(c.sol, c.L).ok) { console.log(`✗ свой уровень ${JSON.stringify(rows)}: построенное решение не проходит`); errors++; }
});

// Ролик для Авито (?show): задания из REEL есть в курсе, эталон проходит карты ролика (seed REEL)
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const reel = app.match(/const REEL = \{[\s\S]*?items: \[([\s\S]*?)\n {4}\],[\s\S]*?seed: (\d+)/);
if (!reel) { console.log('✗ не найден список уровней ролика REEL в js/app.js'); errors++; }
else {
  const seed = +reel[2], items = [...reel[1].matchAll(/\{ id: '([^']+)'(.*)\}/g)];
  if (!items.length) { console.log('✗ в ролике REEL нет уровней'); errors++; }
  items.forEach(([, id, rest]) => {
    const t = TASKS.find(x => x.id === id);
    if (!t) { console.log(`✗ ролик: задания «${id}» нет в курсе`); errors++; return; }
    W.makeMaps(t, seed).slice(0, /again:/.test(rest) ? 2 : 1).forEach((m, i) => {
      const r = W.runSilent(t.hints[2], m);
      if (!r.ok) { console.log(`✗ ролик: «${id}» не проходит карту ${i + 1}: ${r.err}`); errors++; }
    });
  });
  if (!html.includes('src="js/sound.js"')) { console.log('✗ js/sound.js не подключён в index.html'); errors++; }
  console.log(`ролик для Авито: ${items.length} уровней проверено`);
}
// Кадры для Авито (?shots, js/poster.js): задания есть в курсе и проходят карту SEED (на кадре — эталон и след Бита),
// код консоли печатает ровно то, что на картинке; poster.js и cert.js подключены до app.js
const PO = require('../js/poster.js');
PO.SHOTS.forEach(s => {
  if (s.kind === 'world') {
    const t = TASKS.find(x => x.id === s.task);
    if (!t) { console.log(`✗ кадр «${s.id}»: задания «${s.task}» нет в курсе`); errors++; return; }
    const r = W.runSilent(t.hints[2], W.makeMaps(t, PO.SEED)[0]);
    if (!r.ok) { console.log(`✗ кадр «${s.id}»: эталон «${s.task}» не проходит карту кадра: ${r.err}`); errors++; }
  }
  if (s.kind === 'console') {
    const B = require('../js/bridge.js'), r = B.run(s.code, s.input);
    const out = (r.out || '').trimEnd().split('\n');
    if (r.err || out.join('|') !== s.out.join('|')) { console.log(`✗ кадр «${s.id}»: код печатает «${out.join(' / ')}»${r.err ? ` (${r.err})` : ''}, а на кадре «${s.out.join(' / ')}»`); errors++; }
    const asks = (s.code.match(/input\(/g) || []).length * (+(s.code.match(/range\((\d+)\)/) || [0, 1])[1]);
    if (asks !== s.input.length) { console.log(`✗ кадр «${s.id}»: программа спрашивает ${asks} раз, а ответов на кадре ${s.input.length}`); errors++; }
  }
});
['cert', 'poster'].forEach(f => {
  const i = html.indexOf(`src="js/${f}.js"`);
  if (i < 0 || i > html.indexOf('src="js/app.js"')) { console.log(`✗ js/${f}.js должен быть подключён в index.html до app.js`); errors++; }
});
console.log(`кадры для Авито: ${PO.SHOTS.length} кадров проверено`);
console.log(errors ? `Ошибок: ${errors}` : 'Все задания в порядке.');
process.exit(errors ? 1 : 0);
