/* Испытание Сбоя: проверка главы 1 — шесть заданий, по одному на каждую тему (команды, for, условия, while,
   переменные, приёмы и лабиринт). Карты каждый раз новые (сид попытки), подсказок нет, запускать можно сколько
   угодно — засчитывается то, что получилось. Результат — карточка для родителя, повтор через месяц-два
   показывает рост: «было 2 из 6, стало 5 из 6» (js/app.js, раздел «Испытание Сбоя»).
   У задания: topic — урок темы (lessons — если тем несколько: тема «впереди», пока эти уроки не пройдены),
   maps — сколько карт (1 — нарисованная по сиду карта без условий, решение под неё; 3 — код должен работать на любой),
   solve(L) — эталон для своей карты (если он зависит от карты), иначе эталон — hints[2];
   need — что обязательно в коде: испытание на тему, а не просто на дорогу до флага. */
const HeroTrial = (() => {
  const { K, randInt, blankLevel, corridor, pickLava, winding, maze, handWalk, planRoute, pathOk, DIRS, ALL_CMDS } = HeroWorld;
  const at = (path, i) => K(path[i].x, path[i].z);
  function sample(r, arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  // Число, которого ещё не было на других картах этой попытки (оно первое в sig до «|»)
  function fresh(r, used, a, b) {
    let v, guard = 0;
    do { v = randInt(r, a, b); } while (used && [...used].some(s => s.split('|')[0] === String(v)) && ++guard < 50);
    return v;
  }

  /* ---- Карты ---- */
  // 1. Команды: извилистая дорога, одна лава, две монеты. Решение пишут под эту карту — его строит planRoute
  function genRoute(r) {
    for (let guard = 0; guard < 400; guard++) {
      const { L, path, lens, turns } = winding(r, randInt(r, 3, 4), 2, 4);
      if (path.length > 15) continue;
      const lava = pickLava(r, path, lens, 1, 1);
      lava.forEach(i => L.lava.add(at(path, i)));
      const free = [];
      for (let i = 1; i < path.length - 1; i++) if (!lava.includes(i)) free.push(i);
      const coins = sample(r, free, 2).sort((a, b) => a - b);
      coins.forEach(i => L.coins.add(at(path, i)));
      const plan = planRoute(Object.assign(L, { basic: true }));
      if (!plan.code) continue;
      L.solution = plan.code;
      L.sig = `${lens.join(',')}|${turns.join(',')}|${lava}|${coins}`;
      return L;
    }
  }
  // 2. Цикл for: «лестница» — один и тот же кусок пути n раз, монета на каждой ступеньке.
  // F — шаг, L/R — поворот; монета после coin-го шага куска
  const UNITS = [['F', 'L', 'F', 'R'], ['F', 'R', 'F', 'L'], ['F', 'F', 'L', 'F', 'R'], ['F', 'L', 'F', 'F', 'R'], ['F', 'F', 'R', 'F', 'L']];
  function genStairs(r) {
    for (let guard = 0; guard < 200; guard++) {
      const unit = UNITS[randInt(r, 0, UNITS.length - 1)], n = randInt(r, 4, 6);
      const steps = unit.filter(c => c === 'F').length, coin = randInt(r, 0, steps - 1);
      const L = blankLevel(), path = [{ x: 0, z: 0 }];
      let dir = 0;
      for (let k = 0; k < n; k++) {
        let f = 0;
        unit.forEach(c => {
          if (c === 'L') dir = (dir + 1) % 4;
          else if (c === 'R') dir = (dir + 3) % 4;
          else {
            const p = path[path.length - 1], [dx, dz] = DIRS[dir];
            path.push({ x: p.x + dx, z: p.z + dz });
            if (f++ === coin) L.coins.add(at(path, path.length - 1));
          }
        });
      }
      if (!pathOk(path)) continue;
      path.forEach(p => L.floor.add(K(p.x, p.z)));
      const end = path[path.length - 1];
      L.finish = { x: end.x, z: end.z };
      // тело цикла: шаги подряд — одной командой вперёд(n), монета — сразу после своего шага
      const body = [];
      let f = 0;
      unit.forEach(c => {
        if (c === 'L') body.push('налево()');
        else if (c === 'R') body.push('направо()');
        else {
          const m = body.length && body[body.length - 1].match(/^вперёд\((\d*)\)$/);
          if (m) body[body.length - 1] = `вперёд(${(+m[1] || 1) + 1})`; else body.push('вперёд()');
          if (f++ === coin) body.push('взять()');
        }
      });
      L.solution = `for i in range(${n}):\n    ${body.join('\n    ')}`;
      L.sig = `${unit.join('')}|${n}|${coin}`;
      return L;
    }
  }
  // 3. Условия: тропа с поворотами налево, лава и монеты каждый раз в других местах
  function genCross(r) {
    for (let guard = 0; guard < 300; guard++) {
      const { L, path, lens } = winding(r, randInt(r, 3, 4), 3, 5, true);
      const lava = pickLava(r, path, lens, 2, 3);
      lava.forEach(i => L.lava.add(at(path, i)));
      const free = [];
      for (let i = 1; i < path.length - 1; i++) if (!lava.includes(i)) free.push(i);
      const coins = sample(r, free, randInt(r, 2, 3)).sort((a, b) => a - b);
      coins.forEach(i => L.coins.add(at(path, i)));
      L.sig = `${lens.join(',')}|${lava}|${coins}`;
      return L;
    }
  }
  // 4. Цикл while: длинная дорога с воротами и лавой, у стены — поворот налево, длина каждый раз другая
  function genGates(r) {
    for (let guard = 0; guard < 300; guard++) {
      const L = blankLevel(), a = randInt(r, 6, 9), b = randInt(r, 3, 5);
      const path = corridor(L, [a, b]);
      // на первом отрезке 2–3 препятствия не вплотную друг к другу: хотя бы одни ворота
      const spots = sample(r, Array.from({ length: a - 2 }, (_, i) => i + 2), randInt(r, 2, 3)).sort((x, y) => x - y);
      if (spots.some((x, i) => i && x - spots[i - 1] < 2)) continue;
      const kinds = spots.map(() => (r() < 0.6 ? 'G' : '~'));
      if (!kinds.includes('G')) kinds[0] = 'G';
      spots.forEach((i, j) => (kinds[j] === 'G' ? L.gates : L.lava).add(at(path, i)));
      // на втором — лава (чаще всего)
      const tail = r() < 0.75 ? randInt(r, a + 2, a + b - 1) : -1;
      if (tail > 0) L.lava.add(at(path, tail));
      if (!L.lava.size) continue;
      L.sig = `${a}|${b}|${spots}|${kinds.join('')}|${tail}`;
      return L;
    }
  }
  // 5. Переменные: петляющая тропа (повороты налево), на флаге сказать, сколько было поворотов.
  // На трёх картах поворотов разное число — ответ не угадать
  function genCount(r, used) {
    const turns = fresh(r, used, 2, 4);
    for (let guard = 0; guard < 300; guard++) {
      let w;
      try { w = winding(r, turns + 1, 2, 4, true); } catch (e) { continue; }
      const { L, path, lens } = w;
      const lava = r() < 0.7 ? pickLava(r, path, lens, 1, 1) : [];
      lava.forEach(i => L.lava.add(at(path, i)));
      L.stop = true;
      L.answer = turns;
      L.sig = `${turns}|${lens.join(',')}|${lava}`;
      return L;
    }
  }
  // 6. Приёмы и лабиринт: лабиринт без петель, монеты в тупиках, куда заводит правило правой руки
  function genMaze(r) {
    for (let guard = 0; guard < 300; guard++) {
      const L = maze(r, 4, 3);
      const seen = new Set(handWalk(L, 3)), s = K(L.start.x, L.start.z), f = K(L.finish.x, L.finish.z);
      const ends = L.deadEnds.filter(k => seen.has(k) && k !== s && k !== f);
      if (!ends.length) continue;
      sample(r, ends, Math.min(2, ends.length)).forEach(k => L.coins.add(k));
      L.sig = [...L.floor].sort().join(';') + '|' + [...L.coins].sort().join(';');
      return L;
    }
  }

  /* ---- Задания ---- */
  const BASIC = ['вперёд()', 'налево()', 'направо()', 'прыгнуть()', 'взять()', 'for i in range():'];
  const ALL = [...ALL_CMDS, 'ворота_впереди()', 'открыть()', 'стена_справа()', 'стена_слева()', 'сказать()', 'while not на_финише():', 'def'];
  const TASKS = [
    {
      id: 'ex-route', topic: 'komandy', name: 'Команды', short: 'Команды', title: 'Дорога к замку',
      goal: 'Дойди до флага и собери обе монеты. Карта каждый раз новая — посмотри на неё внимательно.',
      news: 'команды и числа в скобках — вперёд(3). Подсказок в испытании нет: только карта и твой код.',
      cmds: BASIC, starter: '# Испытание 1. Команды для этой карты.\n', basic: true, maps: 1,
      gen: r => genRoute(r), solve: L => L.solution,
    },
    {
      id: 'ex-stairs', topic: 'cikly', name: 'Цикл for', short: 'Цикл for', title: 'Лестница в башню',
      goal: 'Один и тот же кусок пути повторяется. Сколько раз — посчитай по карте. Монеты на ступеньках собери.',
      news: 'цикл for — повторяющийся кусок пишут один раз.',
      cmds: BASIC, starter: '# Испытание 2. Повторяющийся кусок — в цикл for.\n', basic: true, maps: 1,
      gen: r => genStairs(r), solve: L => L.solution,
      need: [{ re: '\\bfor\\b', msg: 'Бит дошёл, но это испытание на цикл: повторяющийся кусок нужно завернуть в for.' }],
    },
    {
      id: 'ex-cross', topic: 'usloviya', name: 'Условия', short: 'Условия', title: 'Лесная тропа',
      goal: 'Три разные карты: повороты, лава и монеты каждый раз в других местах. Одна программа должна пройти все три.',
      news: 'условия if, elif и else — проверь, что впереди, и реши, что делать.',
      cmds: ALL, starter: '# Испытание 3. Одна программа для трёх разных карт.\n', maps: 3,
      gen: r => genCross(r),
      hints: ['', '', 'for i in range(40):\n    if есть_монета():\n        взять()\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()'],
    },
    {
      id: 'ex-gates', topic: 'poka', name: 'Цикл while', short: 'Цикл while', title: 'Ворота замка',
      goal: 'Ворота и лава на дороге, у стены — поворот. Длина дороги каждый раз другая: иди, пока не дойдёшь до флага.',
      news: 'цикл while — повторяй, пока условие верно.',
      cmds: ALL, starter: '# Испытание 4. Повторяй, пока не дойдёшь до флага.\n', maps: 3,
      gen: r => genGates(r),
      hints: ['', '', 'while not на_финише():\n    if ворота_впереди():\n        открыть()\n    elif лава_впереди():\n        прыгнуть()\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()'],
      need: [{ re: '\\bwhile\\b', msg: 'Бит дошёл, но это испытание на while: повторяй, пока не дойдёшь до флага.' }],
    },
    {
      id: 'ex-count', topic: 'peremennye', name: 'Переменные', short: 'Переменные', title: 'Считалка Сбоя',
      goal: 'Дойди до флага и скажи, сколько раз Бит повернул. На трёх картах ответ разный — считай повороты в переменной.',
      news: 'переменные — заведи счётчик и прибавляй к нему на каждом повороте. Ответ — сказать(…).',
      cmds: ALL, starter: '# Испытание 5. Считай повороты и скажи ответ на флаге.\n', maps: 3,
      gen: (r, used) => genCount(r, used),
      hints: ['', '', 'повороты = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n        повороты = повороты + 1\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\nсказать(повороты)'],
    },
    {
      id: 'ex-maze', topic: 'labirint', lessons: ['funkcii', 'labirint'], name: 'Приёмы в лабиринте', short: 'Лабиринт', title: 'Лабиринт Сбоя',
      goal: 'В тупиках лабиринта — монеты. Собери их и дойди до выхода. Правило руки оформи своим приёмом def.',
      news: 'свои приёмы (def) и правило руки. Команды можно писать и по-русски, и по-английски.',
      cmds: ALL, starter: '# Испытание 6. Свой приём def и правило руки.\n', maps: 3, fast: 3,
      gen: r => genMaze(r),
      hints: ['', '', 'def шаг():\n    if есть_монета():\n        взять()\n    if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()\n\nwhile not на_финише():\n    шаг()'],
      need: [{ re: '\\bdef\\b', msg: 'Бит дошёл, но это испытание на свои приёмы: оформи правило руки как приём def.' }],
    },
  ];
  TASKS.forEach(t => {
    t.kind = 'exam';
    t.basic = !!t.basic;
    t.hints = t.hints || ['', '', ''];
    t.best = 99; // звёзд за испытание нет
  });

  // Чего не хватает в коде для темы испытания (комментарии не считаются) — текст для ученика или null
  function unmet(task, code) {
    const src = code.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const u = (task.need || []).find(n => !new RegExp(n.re).test(src));
    return u ? u.msg : null;
  }
  // Эталон для карты: свой у карт-рисунков, общий у заданий на три карты
  const reference = (task, L) => (task.solve ? task.solve(L) : task.hints[2]);
  // Набор заданий ↔ число-маска (бит на задание, по порядку TASKS) — так попытки лежат в сохранении и в ссылке
  const toMask = ids => TASKS.reduce((m, t, i) => (ids.includes(t.id) ? m | (1 << i) : m), 0);
  const fromMask = m => TASKS.filter((t, i) => m & (1 << i)).map(t => t.id);
  const count = m => TASKS.filter((t, i) => m & (1 << i)).length;

  return { TASKS, unmet, reference, toMask, fromMask, count };
})();
if (typeof module !== 'undefined') module.exports = HeroTrial;
