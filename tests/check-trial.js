// Проверка Испытания Сбоя (js/trial.js): node tests/check-trial.js
// Для каждого из шести заданий на SEEDS попытках (по умолчанию 300):
//  - карт столько, сколько нужно (1 или 3), на трёх картах они разные, у «Считалки» ответ на трёх картах разный;
//  - эталон (свой для карты или общий) проходит каждую карту и выполняет требование темы (need);
//  - стартовый код и типичные ошибки ломаются с нужной причиной, другие верные решения проходят;
//  - решения без нужной конструкции (for, while, def) доходят до флага, но испытание их не засчитывает.
// Ещё: испытание подключено в index.html после уроков, id не пересекаются с заданиями курса, у каждой темы есть урок.
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
fs.readdirSync(path.join(__dirname, '../js/lessons')).filter(f => f.endsWith('.js')).sort()
  .forEach(f => require(path.join(__dirname, '../js/lessons', f)));
const T = require('../js/trial.js');
const SEEDS = Number(process.env.SEEDS) || 300;

let errors = 0;
const fail = msg => { console.log('✗ ' + msg); errors++; };
const RULE = 'if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()';

// Типичные ошибки: [код или функция (карта, эталон) → код, причина]
const WRONG = {
  'ex-route': [
    [(L, ref) => ref.replace('прыгнуть()', 'вперёд()'), 'lava'], // не прыгнул через лаву
    [(L, ref) => ref.replace(/\nвзять\(\)/g, ''), 'coins'], // не собрал монеты
    ['вперёд(99)\n', null], // «с запасом»: стена или лава — что раньше
  ],
  'ex-stairs': [
    [(L, ref) => ref.replace(/range\((\d+)\)/, (m, n) => `range(${n - 1})`), 'short'], // повторов меньше
    [(L, ref) => ref.replace(/range\((\d+)\)/, (m, n) => `range(${+n + 1})`), null], // повторов больше: лишние команды или стена
    [(L, ref) => ref.replace(/\n    взять\(\)/g, ''), 'coins'], // без монет
  ],
  'ex-cross': [
    ['for i in range(40):\n    if есть_монета():\n        взять()\n    if стена_впереди():\n        налево()\n    else:\n        вперёд()\n', 'lava'],
    ['for i in range(40):\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', 'coins'],
    ['for i in range(40):\n    if есть_монета():\n        взять()\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', 'wall'],
  ],
  'ex-gates': [
    ['while not на_финише():\n    if лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\n', 'gate'],
    ['while not на_финише():\n    if ворота_впереди():\n        открыть()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n', 'wall'],
  ],
  'ex-count': [
    ['while not на_финише():\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\nсказать(3)\n', 'answer'], // ответ наугад
    ['шаги = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n        шаги = шаги + 1\nсказать(шаги)\n', 'answer'], // считает шаги
    ['повороты = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\nсказать(повороты)\n', 'answer'], // забыл прибавить
  ],
  'ex-maze': [
    [`def шаг():\n    ${RULE}\n\nwhile not на_финише():\n    шаг()\n`, 'coins'], // монеты забыты
    ['while not на_финише():\n    if стена_впереди():\n        налево()\n    else:\n        вперёд()\n', null], // без правила руки — не дойдёт
  ],
};
// Другие верные решения: проходят карты и выполняют требование темы
const RIGHT = {
  'ex-cross': ['while not на_финише():\n    if есть_монета():\n        взять()\n    if лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\n'],
  'ex-gates': ['while not на_финише():\n    if ворота_впереди():\n        открыть()\n    if лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\n'],
  'ex-count': ['n = 0\nwhile not at_goal():\n    if wall_in_front():\n        turn_left()\n        n += 1\n    elif lava_in_front():\n        jump()\n    else:\n        move()\nsay(n)\n'],
  'ex-maze': [`def шаг():\n    ${RULE}\n\nwhile not на_финише():\n    if есть_монета():\n        взять()\n    шаг()\n`],
};
// Доходят до флага, но испытание на тему не засчитывает
const OFF_TOPIC = {
  'ex-stairs': (L, ref) => { // тот же путь без цикла
    const m = ref.match(/range\((\d+)\):\n([\s\S]*)$/);
    return m[2].split('\n').map(s => s.trim()).join('\n').concat('\n').repeat(+m[1]);
  },
  'ex-gates': () => 'for i in range(40):\n    if ворота_впереди():\n        открыть()\n    elif лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\n',
  'ex-maze': () => `while not на_финише():\n    if есть_монета():\n        взять()\n    ${RULE}\n`,
};

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const iTrial = html.indexOf('src="js/trial.js"'), iLast = html.lastIndexOf('src="js/lessons/');
if (iTrial < 0) fail('js/trial.js не подключён в index.html');
else if (iTrial < iLast) fail('js/trial.js нужно подключать после уроков');
const courseIds = new Set(W.LESSONS.flatMap(l => [...l.tasks, ...(l.bonus || [])]).map(t => t.id));
if (T.TASKS.length !== 6) fail(`в испытании ${T.TASKS.length} заданий, а нужно 6`);
const seenIds = new Set();
T.TASKS.forEach(t => {
  if (courseIds.has(t.id) || seenIds.has(t.id)) fail(`${t.id}: id повторяется`);
  seenIds.add(t.id);
  [t.topic, ...(t.lessons || [])].forEach(id => { if (!W.LESSONS.some(l => l.id === id)) fail(`${t.id}: урока темы «${id}» нет в курсе`); });
  ['title', 'short', 'name', 'goal', 'news', 'starter'].forEach(k => { if (!t[k]) fail(`${t.id}: нет «${k}»`); });
});

T.TASKS.forEach(t => {
  let bad = 0;
  for (let seed = 1; seed <= SEEDS && bad < 3; seed++) {
    const before = errors;
    const maps = W.makeMaps(t, seed, t.maps);
    if (maps.length !== t.maps || maps.some(m => !m)) { fail(`${t.id}: карт ${maps.length} вместо ${t.maps} (seed ${seed})`); bad++; continue; }
    if (t.maps > 1 && new Set(maps.map(m => m.sig)).size !== maps.length) fail(`${t.id}: одинаковые карты (seed ${seed})`);
    if (t.id === 'ex-count' && new Set(maps.map(m => m.answer)).size !== maps.length) fail(`${t.id}: одинаковый ответ на картах (seed ${seed})`);
    maps.forEach((m, mi) => {
      const ref = T.reference(t, m);
      const r = W.runSilent(ref, m);
      if (!r.ok) fail(`${t.id}: эталон не прошёл карту ${mi + 1} (seed ${seed}): ${r.err}\n${ref}`);
      if (T.unmet(t, ref)) fail(`${t.id}: эталон не выполняет требование темы (seed ${seed})`);
    });
    if (maps.every(m => W.runSilent(t.starter, m).ok)) fail(`${t.id}: стартовый код проходит (seed ${seed})`);
    (WRONG[t.id] || []).forEach(([code, kind], i) => {
      const res = maps.map(m => W.runSilent(typeof code === 'function' ? code(m, T.reference(t, m)) : code, m)).find(x => !x.ok);
      if (!res) fail(`${t.id}: ошибка ${i + 1} проходит все карты (seed ${seed})`);
      else if (kind && res.kind !== kind) fail(`${t.id}: ошибка ${i + 1} ломается не так (seed ${seed}): ждали ${kind}, а вышло ${res.kind}: ${res.err}`);
    });
    (RIGHT[t.id] || []).forEach((code, i) => {
      maps.forEach((m, mi) => { const x = W.runSilent(code, m); if (!x.ok) fail(`${t.id}: верное решение ${i + 1} не прошло карту ${mi + 1} (seed ${seed}): ${x.err}`); });
      if (T.unmet(t, code)) fail(`${t.id}: верное решение ${i + 1} не выполняет требование темы`);
    });
    if (OFF_TOPIC[t.id]) {
      maps.forEach((m, mi) => {
        const code = OFF_TOPIC[t.id](m, T.reference(t, m));
        const x = W.runSilent(code, m);
        if (!x.ok) fail(`${t.id}: решение без темы должно доходить до флага (карта ${mi + 1}, seed ${seed}): ${x.err}`);
        if (!T.unmet(t, code)) fail(`${t.id}: решение без нужной конструкции засчитано (seed ${seed})`);
      });
    }
    if (errors > before) bad++;
  }
  console.log(`${t.id}: проверено на ${SEEDS} попытках`);
});
// маски попыток
const ids = T.TASKS.map(t => t.id);
if (T.fromMask(T.toMask([ids[0], ids[3]])).join() !== [ids[0], ids[3]].join() || T.count(T.toMask(ids)) !== 6) fail('toMask / fromMask считают неверно');

console.log(errors ? `Ошибок: ${errors}` : `Испытание Сбоя в порядке: ${T.TASKS.length} заданий, ${SEEDS} попыток.`);
process.exit(errors ? 1 : 0);
