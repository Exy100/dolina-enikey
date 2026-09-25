// Проверка заданий: node tests/check-tasks.js
// Для каждого задания на 40 наборах случайных карт:
//  - эталонное решение (hints[2]) и другие верные варианты (ALSO_OK) обязаны проходить все карты;
//  - стартовый код обязан ломаться хотя бы на одной карте;
//  - типичные ошибки (WRONG) обязаны ломаться на каждом наборе карт и с нужной причиной (kind).
global.MiniPy = require('../js/minipy.js');
const W = require('../js/world.js');

const ALSO_OK = {
  coins: [
    'for i in range(8):\n    if есть_монета():\n        взять()\n    вперёд()\n', // сначала проверка, потом шаг
  ],
};
const WRONG = {
  coins: [
    ['for i in range(8):\n    вперёд()\n', 'coins'], // монеты не собирает
    ['for i in range(8):\n    вперёд()\nif есть_монета():\n    взять()\n', 'coins'], // проверка после цикла
    ['for i in range(8):\n    if есть_монета():\n        взять()\n        вперёд()\n', 'stuck'], // вперёд() внутри if
  ],
  turn: [
    ['for i in range(8):\n    if стена_впереди():\n        налево()\n        вперёд()\n', 'stuck'], // вперёд() внутри if
  ],
};

let errors = 0;
W.TASKS.forEach(t => {
  for (let seed = 1; seed <= 40; seed++) {
    const maps = W.makeMaps(t, seed);
    if (maps.length !== 3) { console.log(`✗ ${t.id}: сгенерировано ${maps.length} карт вместо 3 (seed ${seed})`); errors++; }
    [t.hints[2], ...(ALSO_OK[t.id] || [])].forEach((code, i) => maps.forEach(m => {
      const r = W.runSilent(code, m);
      if (!r.ok) { console.log(`✗ ${t.id}: ${i ? `верный вариант ${i}` : 'решение'} не прошло карту ${m.sig} (seed ${seed}): ${r.err}`); errors++; }
    }));
    if (maps.every(m => W.runSilent(t.starter, m).ok)) { console.log(`✗ ${t.id}: стартовый код проходит все карты (seed ${seed})`); errors++; }
    (WRONG[t.id] || []).forEach(([code, kind], i) => {
      const fail = maps.map(m => W.runSilent(code, m)).find(r => !r.ok);
      if (!fail) { console.log(`✗ ${t.id}: ошибка ${i + 1} проходит все карты (seed ${seed})`); errors++; }
      else if (fail.kind !== kind) { console.log(`✗ ${t.id}: ошибка ${i + 1} ломается не так (seed ${seed}): ждали ${kind}, а вышло ${fail.kind}: ${fail.err}`); errors++; }
    });
  }
  console.log(`${t.id}: проверено`);
});
console.log(errors ? `Ошибок: ${errors}` : 'Все задания в порядке.');
process.exit(errors ? 1 : 0);
