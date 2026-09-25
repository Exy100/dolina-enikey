// Проверка заданий: node tests/check-tasks.js
// Для каждого задания на 40 наборах случайных карт:
//  - эталонное решение (hints[2]) обязано проходить все карты;
//  - стартовый код обязан ломаться хотя бы на одной карте.
global.MiniPy = require('../js/minipy.js');
const W = require('../js/world.js');
let errors = 0;
W.TASKS.forEach(t => {
  for (let seed = 1; seed <= 40; seed++) {
    const maps = W.makeMaps(t, seed);
    if (maps.length !== 3) { console.log(`✗ ${t.id}: сгенерировано ${maps.length} карт вместо 3 (seed ${seed})`); errors++; }
    maps.forEach(m => {
      const r = W.runSilent(t.hints[2], m);
      if (!r.ok) { console.log(`✗ ${t.id}: решение не прошло карту ${m.sig} (seed ${seed}): ${r.err}`); errors++; }
    });
    if (maps.every(m => W.runSilent(t.starter, m).ok)) { console.log(`✗ ${t.id}: стартовый код проходит все карты (seed ${seed})`); errors++; }
  }
  console.log(`${t.id}: проверено`);
});
console.log(errors ? `Ошибок: ${errors}` : 'Все задания в порядке.');
process.exit(errors ? 1 : 0);
