/* Урок 4 «Цикл while»: повторять, пока условие верно. Проводник — Страж ворот.
   Длина пути каждый раз другая, поэтому for с числом не спасёт. Новая механика — ворота: ворота_впереди(), открыть(). */
(() => {
  const { K, randInt, blankLevel, corridor, pickLava, winding, corners, ALL_CMDS } = HeroWorld;
  const CMDS = [...ALL_CMDS, 'ворота_впереди()', 'открыть()', 'while not на_финише():'];

  // k случайных элементов массива
  function sample(r, arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  // Случайное число, которого ещё не было на других картах этого набора (оно первое в sig до «|»)
  function fresh(r, used, a, b) {
    let v, guard = 0;
    do { v = randInt(r, a, b); } while (used && [...used].some(s => s.split('|')[0] === String(v)) && ++guard < 50);
    return v;
  }
  // Несколько непохожих клеток: ни одна не стоит вплотную к другой
  function spread(r, from, to, k) {
    for (let guard = 0; guard < 200; guard++) {
      const xs = sample(r, Array.from({ length: to - from + 1 }, (_, i) => from + i), k).sort((a, b) => a - b);
      if (xs.every((x, i) => !i || x - xs[i - 1] > 1)) return xs;
    }
    return [from];
  }
  const line = (L, n) => { for (let x = 0; x <= n; x++) L.floor.add(K(x, 0)); };

  // Коридор до стены, у стены налево и ещё два шага
  function genWall(r, used) {
    const L = blankLevel();
    const a = fresh(r, used, 3, 8);
    corridor(L, [a, 2]);
    L.sig = `${a}|`;
    return L;
  }
  // То же, но по дороге до стены лежат монеты
  function genWallCoins(r, used) {
    const L = blankLevel();
    const a = fresh(r, used, 4, 8);
    const path = corridor(L, [a, 2]);
    const coins = sample(r, Array.from({ length: a }, (_, i) => i + 1), randInt(r, 2, Math.min(4, a - 1)));
    coins.forEach(i => L.coins.add(K(path[i].x, path[i].z)));
    L.sig = `${a}|${coins.sort().join(',')}`;
    return L;
  }
  // Прямая дорога с воротами в случайном месте
  function genGate(r, used) {
    const L = blankLevel();
    const g = fresh(r, used, 2, 5), h = randInt(r, 2, 5);
    line(L, g + h);
    L.gates.add(K(g, 0));
    L.finish = { x: g + h, z: 0 };
    L.sig = `${g}|${h}`;
    return L;
  }
  // Поворот налево в случайном месте
  function genTurn(r, used) {
    const L = blankLevel();
    const a = fresh(r, used, 2, 6);
    corridor(L, [a, randInt(r, 2, 4)]);
    L.sig = `${a}|`;
    return L;
  }
  // Прямая дорога с несколькими воротами
  function genGates(r) {
    const L = blankLevel();
    const n = randInt(r, 8, 11);
    line(L, n);
    const gates = spread(r, 2, n - 2, randInt(r, 2, 3));
    gates.forEach(x => L.gates.add(K(x, 0)));
    L.finish = { x: n, z: 0 };
    L.sig = `${n}|${gates.join(',')}`;
    return L;
  }
  // Монет больше пяти, флаг — на пятой: остановиться нужно сразу, как только она взята
  function genFive(r) {
    const L = blankLevel();
    const n = randInt(r, 10, 12);
    line(L, n);
    const coins = sample(r, Array.from({ length: n - 1 }, (_, i) => i + 1), randInt(r, 6, 8)).sort((a, b) => a - b);
    coins.forEach(x => L.coins.add(K(x, 0)));
    L.need = 5;
    L.stop = true;
    L.finish = { x: coins[4], z: 0 };
    L.sig = `${coins.join(',')}|`;
    return L;
  }
  // Тропа с поворотами налево и воротами на прямых участках
  function genTrail(r) {
    const { L, path, lens } = winding(r, 4, 2, 5, true);
    const turn = corners(lens);
    const straight = Array.from({ length: path.length - 2 }, (_, i) => i + 1).filter(i => !turn.has(i));
    const gates = sample(r, straight, randInt(r, 1, 2)).filter((g, i, a) => !a.some(o => Math.abs(o - g) === 1 && o < g));
    gates.forEach(i => L.gates.add(K(path[i].x, path[i].z)));
    L.sig = `${lens.join('')}|${gates.join(',')}`;
    return L;
  }
  // Всё вместе: повороты, лава, ворота и монеты
  function genFinal(r) {
    const { L, path, lens } = winding(r, 4, 3, 5, true);
    const turn = corners(lens);
    const lava = pickLava(r, path, lens, 1, 2);
    lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
    // ворота — на прямом участке и не вплотную к лаве, иначе Бит приземлится на закрытые ворота
    const gateOk = Array.from({ length: path.length - 2 }, (_, i) => i + 1)
      .filter(i => !turn.has(i) && !lava.some(l => Math.abs(l - i) <= 1));
    const gates = sample(r, gateOk, 1);
    gates.forEach(i => L.gates.add(K(path[i].x, path[i].z)));
    const free = Array.from({ length: path.length - 2 }, (_, i) => i + 1).filter(i => !lava.includes(i) && !gates.includes(i));
    const coins = sample(r, free, randInt(r, 2, 3));
    coins.forEach(i => L.coins.add(K(path[i].x, path[i].z)));
    L.sig = `${lens.join('')}|${lava.join(',')}|${gates.join(',')}|${coins.sort().join(',')}`;
    return L;
  }

  HeroWorld.addLesson({
    id: 'poka',
    title: 'Цикл while',
    intro: 'Длина дороги каждый раз новая: for с числом тут не угадает. while повторяет, пока условие верно.',
    tasks: [
      {
        id: 'p-wall',
        short: 'Стена',
        title: 'Пока нет стены',
        goal: 'Дорога упирается в стену, и каждый раз она разной длины. У стены поверни налево и сделай ещё два шага до флага.',
        news: 'while условие: — повторяй, пока условие верно. Сколько раз — заранее неизвестно.',
        cmds: ['вперёд()', 'налево()', 'стена_впереди()', 'while not стена_впереди():'],
        starter: '# Длина дороги каждый раз разная.\nfor i in range(5):\n    вперёд()\nналево()\nвперёд(2)\n',
        hints: [
          'Сколько шагов до стены, заранее неизвестно. Зато Бит видит, есть ли впереди стена.',
          'Замени for на while: шагай, пока впереди нет стены.\n    while not стена_впереди():\n        вперёд()',
          'while not стена_впереди():\n    вперёд()\nналево()\nвперёд(2)',
        ],
        best: 4,
        star3: 'first',
        gen: (r, used) => genWall(r, used),
      },
      {
        id: 'p-coins',
        short: 'Монеты',
        title: 'Монеты до стены',
        goal: 'Собери все монеты по дороге до стены. У стены — налево, и до флага два шага.',
        news: 'Внутри while можно писать что угодно, даже if.',
        cmds: ['вперёд()', 'налево()', 'взять()', 'стена_впереди()', 'есть_монета()'],
        starter: 'while not стена_впереди():\n    вперёд()\nналево()\nвперёд(2)\n',
        hints: [
          'После каждого шага проверь, нет ли под Битом монеты.',
          'Проверка монеты — внутри while, сразу после вперёд():\n        if есть_монета():\n            взять()',
          'while not стена_впереди():\n    вперёд()\n    if есть_монета():\n        взять()\nналево()\nвперёд(2)',
        ],
        best: 6,
        star3: 'first',
        gen: (r, used) => genWallCoins(r, used),
      },
      {
        id: 'p-gate',
        short: 'Ворота',
        title: 'Ворота',
        goal: 'На дороге ворота Стража, и каждый раз в новом месте. Дойди до них, открой и иди дальше до флага.',
        news: 'ворота_впереди() — ворота прямо перед Битом? открыть() — открыть их.',
        cmds: ['вперёд()', 'ворота_впереди()', 'открыть()', 'на_финише()', 'while not на_финише():'],
        starter: '# Впереди ворота Стража.\nwhile not стена_впереди():\n    вперёд()\n',
        hints: [
          'Ворота — не стена, поэтому стена_впереди() про них молчит. Спроси иначе: ворота_впереди().',
          'Шагай, пока впереди нет ворот. Потом открыть() — и второй while до флага.',
          'while not ворота_впереди():\n    вперёд()\nоткрыть()\nwhile not на_финише():\n    вперёд()',
        ],
        best: 5,
        star3: 'first',
        gen: (r, used) => genGate(r, used),
      },
      {
        id: 'p-fix',
        short: 'Почини',
        title: 'Вечный цикл',
        goal: 'Эта программа никогда не закончится: Бит так и стоит на старте. Найди ошибку и исправь её.',
        news: 'Если внутри while ничего не меняется, условие никогда не станет ложным — цикл вечный.',
        cmds: CMDS,
        starter: 'while not на_финише():\n    if стена_впереди():\n        налево()\nвперёд()\n',
        hints: [
          'Нажимай «Шаг» и смотри, какие строки повторяются. Есть ли среди них шаг?',
          'вперёд() стоит без отступа — он после цикла. А внутри цикла Бит только смотрит и никуда не идёт. Сдвинь вперёд() внутрь while.',
          'while not на_финише():\n    if стена_впереди():\n        налево()\n    вперёд()',
        ],
        best: 4,
        star3: 'first', // запуск нетронутой программы не считается
        gen: (r, used) => genTurn(r, used),
      },
      {
        id: 'p-gates',
        short: 'Много ворот',
        title: 'Много ворот',
        goal: 'Ворот теперь несколько, и где они — каждый раз по-разному. Дойди до флага.',
        news: 'Одно условие — в while, другое — в if внутри него.',
        cmds: CMDS,
        starter: '# Ворот несколько.\n',
        hints: [
          'Пока Бит не на финише, у него два варианта: впереди ворота или путь свободен.',
          'Внутри while not на_финише(): если впереди ворота — открыть(), иначе — вперёд().',
          'while not на_финише():\n    if ворота_впереди():\n        открыть()\n    else:\n        вперёд()',
        ],
        best: 5,
        star3: 'first',
        gen: r => genGates(r),
      },
      {
        id: 'p-five',
        short: 'Пять',
        title: 'Ровно пять монет',
        goal: 'Страж пропустит Бита, когда у него будет ровно 5 монет. Монет на дороге больше — остановись, как только возьмёшь пятую.',
        news: 'В условии while можно сравнивать числа: монет_собрано() < 5.',
        cmds: CMDS,
        starter: 'while not стена_впереди():\n    вперёд()\n    if есть_монета():\n        взять()\n',
        hints: [
          'Эта программа идёт до стены и берёт все монеты подряд. А нужно остановиться на пятой.',
          'Повторяй, пока монет меньше пяти: while монет_собрано() < 5:',
          'while монет_собрано() < 5:\n    вперёд()\n    if есть_монета():\n        взять()',
        ],
        best: 4,
        star3: 'first',
        gen: r => genFive(r),
      },
      {
        id: 'p-trail',
        short: 'Тропа',
        title: 'Извилистая тропа',
        goal: 'Тропа петляет, а на ней ворота. Дойди до флага.',
        news: 'Ничего нового: while, if, elif и else вместе.',
        cmds: CMDS,
        starter: '# Пиши программу здесь.\n',
        hints: [
          'У Бита три варианта: впереди ворота, впереди стена или путь свободен.',
          'Внутри while not на_финише(): if ворота — открыть(), elif стена — налево(), else — вперёд().',
          'while not на_финише():\n    if ворота_впереди():\n        открыть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()',
        ],
        best: 7,
        star3: 'first',
        gen: r => genTrail(r),
      },
      {
        id: 'p-final',
        short: 'Финал',
        title: 'Ворота Стража',
        goal: 'Повороты, лава, ворота и монеты. Собери все монеты и дойди до флага. Программу пиши с нуля.',
        news: 'Ничего нового: только то, что ты уже умеешь.',
        cmds: CMDS,
        starter: '# Пиши программу здесь.\n',
        hints: [
          'На каждом повторе сначала монета, потом выбор из четырёх: ворота, лава, стена или свободный путь.',
          'Начни так:\nwhile not на_финише():\n    if есть_монета():\n        взять()\n    if ворота_впереди():\n        открыть()',
          'while not на_финише():\n    if есть_монета():\n        взять()\n    if ворота_впереди():\n        открыть()\n    elif лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()',
        ],
        best: 11,
        star3: 'first',
        gen: r => genFinal(r),
      },
    ],
  });
})();
