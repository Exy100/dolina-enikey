/* Логика мира: клетки, герой, команды, генераторы карт и задания */
const HeroWorld = (() => {
  const { PyError, fn } = MiniPy;
  const DIRS = [[1, 0], [0, -1], [-1, 0], [0, 1]]; // восток, север, запад, юг
  const K = (x, z) => x + ',' + z;

  class WorldError extends PyError {
    constructor(msg, line, kind) { super(msg, line); this.kind = kind; }
  }
  class WinSignal {}

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  function blankLevel() {
    return { floor: new Set(), lava: new Set(), coins: new Set(), start: { x: 0, z: 0, dir: 0 }, finish: { x: 0, z: 0 } };
  }

  /* ---- Генераторы карт ---- */
  function genCoins(r, min = 3, max = 6) {
    const L = blankLevel();
    for (let x = 0; x <= 8; x++) L.floor.add(K(x, 0));
    let cells;
    do {
      cells = [];
      // на стартовой клетке монет нет: там стоит герой и закрывает монету собой
      for (let x = 1; x <= 7; x++) if (r() < 0.5) cells.push(x);
    } while (cells.length < min || cells.length > max);
    cells.forEach(x => L.coins.add(K(x, 0)));
    L.finish = { x: 8, z: 0 };
    L.sig = cells.join('');
    return L;
  }
  function genTurn(r, used) {
    const L = blankLevel();
    let a;
    do { a = randInt(r, 2, 6); } while (used && used.has(String(a)) && used.size < 5);
    for (let x = 0; x <= a; x++) L.floor.add(K(x, 0));
    for (let z = 1; z <= 8 - a; z++) L.floor.add(K(a, -z));
    L.finish = { x: a, z: -(8 - a) };
    L.sig = String(a);
    return L;
  }
  function genLava(r) {
    const L = blankLevel();
    for (let x = 0; x <= 10; x++) L.floor.add(K(x, 0));
    let lava;
    do {
      lava = [];
      for (let x = 1; x <= 9; x++) {
        if (lava.includes(x - 1)) continue;
        if (r() < 0.32) lava.push(x);
      }
    } while (lava.length < 2 || lava.length > 4);
    lava.forEach(x => L.lava.add(K(x, 0)));
    L.finish = { x: 10, z: 0 };
    L.sig = lava.join(',');
    return L;
  }
  // Лава в прямом коридоре. Одна монета точно лежит сразу за лавой, а одна — на обычной клетке:
  // сломанная программа из задания «Почини» соберёт вторую и пропустит первую
  function genFix(r) {
    const L = blankLevel();
    for (let x = 0; x <= 10; x++) L.floor.add(K(x, 0));
    let lava, coins;
    do {
      lava = []; coins = [];
      for (let x = 1; x <= 8; x++) if (!lava.includes(x - 1) && r() < 0.3) lava.push(x);
      lava.forEach(x => { if (r() < 0.6) coins.push(x + 1); });
      for (let x = 1; x <= 9; x++) if (!lava.includes(x) && !coins.includes(x) && r() < 0.2) coins.push(x);
    } while (lava.length < 2 || lava.length > 3 || coins.length > 5
      || !lava.some(x => coins.includes(x + 1)) || !coins.some(x => !lava.includes(x - 1)));
    coins.sort((a, b) => a - b);
    lava.forEach(x => L.lava.add(K(x, 0)));
    coins.forEach(x => L.coins.add(K(x, 0)));
    L.finish = { x: 10, z: 0 };
    L.sig = lava.join(',') + '|' + coins.join(',');
    return L;
  }
  // Коридор из прямых отрезков длиной lens, после каждого — поворот налево. Возвращает клетки пути по порядку.
  function corridor(L, lens) {
    const path = [{ x: 0, z: 0 }];
    let dir = 0;
    lens.forEach(n => {
      const [dx, dz] = DIRS[dir];
      for (let s = 0; s < n; s++) { const p = path[path.length - 1]; path.push({ x: p.x + dx, z: p.z + dz }); }
      dir = (dir + 1) % 4;
    });
    path.forEach(p => L.floor.add(K(p.x, p.z)));
    const f = path[path.length - 1];
    L.finish = { x: f.x, z: f.z };
    return path;
  }
  // Номера клеток пути под лаву: не старт, не финиш, не угол (через угол не прыгнуть), не рядом с другой лавой
  function pickLava(r, path, lens, min, max) {
    const corners = new Set();
    lens.reduce((i, n) => { corners.add(i + n); return i + n; }, 0);
    let lava;
    do {
      lava = [];
      for (let i = 1; i < path.length - 1; i++) if (!corners.has(i) && !lava.includes(i - 1) && r() < 0.3) lava.push(i);
    } while (lava.length < min || lava.length > max);
    return lava;
  }
  function genChoice(r) {
    const L = blankLevel();
    const lens = [randInt(r, 3, 5), randInt(r, 2, 4)];
    if (r() < 0.6) lens.push(randInt(r, 2, 4));
    const path = corridor(L, lens);
    const lava = pickLava(r, path, lens, 1, 3);
    lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
    L.sig = lens.join('') + '|' + lava.join(',');
    return L;
  }
  // Рюкзак: монет на пути 4–6, а взять можно только 3
  function genBag(r) {
    const L = genCoins(r, 4, 6);
    L.need = 3;
    return L;
  }
  // Флаг посреди коридора: остановиться нужно ровно на нём
  function genStop(r, used) {
    const L = blankLevel();
    let d;
    do { d = randInt(r, 3, 8); } while (used && used.has(String(d)));
    const e = randInt(r, 1, 3);
    for (let x = 0; x <= d + e; x++) L.floor.add(K(x, 0));
    L.finish = { x: d, z: 0 };
    L.stop = true;
    L.sig = String(d);
    return L;
  }
  function genFinal(r) {
    const L = blankLevel();
    const lens = [randInt(r, 3, 5), randInt(r, 3, 4), randInt(r, 2, 4)];
    const path = corridor(L, lens);
    const lava = pickLava(r, path, lens, 1, 2);
    lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
    const free = [];
    for (let i = 1; i < path.length - 1; i++) if (!lava.includes(i)) free.push(i);
    let coins;
    do { coins = free.filter(() => r() < 0.3); } while (coins.length < 2 || coins.length > 4);
    coins.forEach(i => L.coins.add(K(path[i].x, path[i].z)));
    L.sig = lens.join('') + '|' + lava.join(',') + '|' + coins.join(',');
    return L;
  }

  /* ---- Состояние мира ---- */
  function createState(level) {
    return {
      level,
      hero: { ...level.start },
      coins: new Set(level.coins),
      collected: 0,
      total: level.need || level.coins.size, // сколько монет нужно к финишу
      moved: false,
      idle: 0, // проверок и поворотов подряд без единого шага
    };
  }
  function cellAt(level, x, z) {
    const k = K(x, z);
    if (!level.floor.has(k)) return 'wall';
    if (level.lava.has(k)) return 'lava';
    return 'floor';
  }
  function ahead(st, n = 1) {
    const [dx, dz] = DIRS[st.hero.dir];
    return { x: st.hero.x + dx * n, z: st.hero.z + dz * n };
  }
  const yesNo = v => (v ? 'да' : 'нет');

  function coinsError(st, line) {
    if (st.collected >= st.total) return null;
    if (st.level.need) return new WorldError(`Герой дошёл до флага, но собрал монет: ${st.collected}, а нужно ${st.level.need}.`, line, 'coins');
    return new WorldError(`Герой дошёл до флага, но пропустил монеты: ${st.total - st.collected} шт. Нужно собрать все.`, line, 'coins');
  }
  function arrive(st, line) {
    const h = st.hero, f = st.level.finish;
    // на картах «стоп» флаг засчитывается, только когда программа закончилась
    if (st.level.stop || h.x !== f.x || h.z !== f.z) return false;
    const e = coinsError(st, line);
    if (e) throw e;
    return true;
  }

  /* ---- Команды героя ---- */
  function commands(st) {
    const cmds = {
      'вперед': fn('вперёд', [0, 1], function* (args, line) {
        const n = args.length ? args[0] : 1;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1)
          throw new PyError('В скобках у вперёд() может быть только целое число шагов, например вперёд(2).', line);
        for (let s = 0; s < n; s++) {
          const to = ahead(st);
          const c = cellAt(st.level, to.x, to.z);
          if (c === 'wall') {
            yield { type: 'bump' };
            throw new WorldError('Бум! Впереди стена, туда не пройти.', line, 'wall');
          }
          const from = { ...st.hero };
          st.hero.x = to.x; st.hero.z = to.z;
          if (c === 'lava') {
            yield { type: 'move', from, to };
            yield { type: 'burn' };
            throw new WorldError('Ой! Герой шагнул прямо в лаву. Перед шагом проверь: лава_впереди()', line, 'lava');
          }
          yield { type: 'move', from, to };
          st.idle = 0; st.moved = true;
          if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        }
        return null;
      }),
      'налево': fn('налево', 0, function* () {
        st.hero.dir = (st.hero.dir + 1) % 4;
        st.idle++;
        yield { type: 'turn', dir: st.hero.dir, side: 1 };
        return null;
      }),
      'направо': fn('направо', 0, function* () {
        st.hero.dir = (st.hero.dir + 3) % 4;
        st.idle++;
        yield { type: 'turn', dir: st.hero.dir, side: -1 };
        return null;
      }),
      'взять': fn('взять', 0, function* (args, line) {
        const k = K(st.hero.x, st.hero.z);
        if (!st.coins.has(k)) {
          yield { type: 'grab-air' };
          throw new WorldError('Здесь нет монеты, герой схватил воздух. Сначала проверь: есть_монета()', line, 'air');
        }
        if (st.level.need && st.collected >= st.level.need) {
          yield { type: 'full' };
          throw new WorldError(`Рюкзак полон: больше ${st.level.need} монет не унести. Перед тем как брать, проверь, сколько уже собрано: монет_собрано()`, line, 'full');
        }
        st.coins.delete(k);
        st.collected++;
        yield { type: 'take', x: st.hero.x, z: st.hero.z, count: st.collected, total: st.total };
        return null;
      }),
      'прыгнуть': fn('прыгнуть', 0, function* (args, line) {
        const mid = ahead(st, 1), to = ahead(st, 2);
        const cm = cellAt(st.level, mid.x, mid.z);
        if (cm === 'wall') { yield { type: 'bump' }; throw new WorldError('Впереди стена, её не перепрыгнуть.', line, 'wall'); }
        if (cm !== 'lava') {
          yield { type: 'shrug' };
          throw new WorldError('Впереди нет лавы, прыгать незачем: прыжок только через лаву. По обычной клетке иди командой вперёд()', line, 'nojump');
        }
        const ct = cellAt(st.level, to.x, to.z);
        const from = { ...st.hero };
        if (ct === 'wall') { yield { type: 'bump' }; throw new WorldError('За лавой стена, приземлиться некуда.', line, 'wall'); }
        st.hero.x = to.x; st.hero.z = to.z;
        yield { type: 'jump', from, to };
        st.idle = 0; st.moved = true;
        if (ct === 'lava') { yield { type: 'burn' }; throw new WorldError('Герой приземлился в лаву!', line, 'lava'); }
        if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        return null;
      }),
      'стена_впереди': fn('стена_впереди', 0, function* () {
        const a = ahead(st); const v = cellAt(st.level, a.x, a.z) === 'wall';
        st.idle++;
        yield { type: 'check', text: `стена впереди? ${yesNo(v)}`, value: v };
        return v;
      }),
      'лава_впереди': fn('лава_впереди', 0, function* () {
        const a = ahead(st); const v = cellAt(st.level, a.x, a.z) === 'lava';
        st.idle++;
        yield { type: 'check', text: `лава впереди? ${yesNo(v)}`, value: v };
        return v;
      }),
      'есть_монета': fn('есть_монета', 0, function* () {
        const v = st.coins.has(K(st.hero.x, st.hero.z));
        st.idle++;
        yield { type: 'check', text: `монета здесь? ${yesNo(v)}`, value: v };
        return v;
      }),
      'на_финише': fn('на_финише', 0, function* () {
        const f = st.level.finish; const v = st.hero.x === f.x && st.hero.z === f.z;
        st.idle++;
        yield { type: 'check', text: `я на финише? ${yesNo(v)}`, value: v };
        return v;
      }),
      'монет_собрано': fn('монет_собрано', 0, function* () {
        st.idle++;
        yield { type: 'check', text: `монет у меня: ${st.collected}`, value: st.collected };
        return st.collected;
      }),
    };
    return cmds;
  }

  /* ---- Задания ---- */
  // С задания 4 над редактором все команды: ученик сам выбирает нужные
  const ALL_CMDS = ['вперёд()', 'налево()', 'направо()', 'прыгнуть()', 'взять()', 'стена_впереди()', 'лава_впереди()', 'есть_монета()', 'монет_собрано()', 'на_финише()'];
  const TASKS = [
    {
      id: 'coins',
      short: 'Монеты',
      title: 'Монеты вразброс',
      goal: 'Пройди коридор до флага и собери все монеты. Монеты лежат не на каждой клетке, и на каждой карте по-разному.',
      news: 'if внутри цикла: действие выполняется, только когда условие верно.',
      cmds: ['вперёд()', 'взять()', 'есть_монета()'],
      starter: '# Запусти и посмотри, где герой ошибётся.\n# Монеты лежат не на каждой клетке.\nfor i in range(8):\n    вперёд()\n    взять()\n',
      hints: [
        'есть_монета() — это вопрос герою: «На этой клетке есть монета?» Он отвечает «да» или «нет». А брать монету можно, только когда ответ «да».',
        'Проверка записывается так:\n    if есть_монета():\n        взять()\nОбрати внимание на двоеточие и отступ.',
        'for i in range(8):\n    вперёд()\n    if есть_монета():\n        взять()',
      ],
      best: 4,
      star3: 'first', // «коротко» тут даётся даром: любое верное решение — 4 строки
      gen: r => genCoins(r),
    },
    {
      id: 'turn',
      short: 'Поворот',
      title: 'Стена за углом',
      goal: 'Дойди до флага. Коридор где-то поворачивает налево, но где именно, заранее неизвестно: на каждой карте по-своему.',
      news: 'Проверка перед шагом: сначала смотрим, потом действуем.',
      cmds: ['вперёд()', 'налево()', 'стена_впереди()'],
      starter: '# Где поворот, заранее неизвестно.\nfor i in range(8):\n    вперёд()\n',
      hints: [
        'Перед каждым шагом герой может посмотреть вперёд: стена_впереди() ответит «да» или «нет».',
        'Если впереди стена, нужно повернуть. Поставь проверку перед вперёд():\n    if стена_впереди():\n        налево()',
        'for i in range(8):\n    if стена_впереди():\n        налево()\n    вперёд()',
      ],
      best: 4,
      star3: 'first',
      gen: (r, used) => genTurn(r, used),
    },
    {
      id: 'lava',
      short: 'Лава',
      title: 'Через лаву',
      goal: 'Дойди до флага. На пути лава: через неё нужно прыгать, а по обычным клеткам — просто идти. Прыгать без лавы нельзя.',
      news: 'if / else: одно из двух действий, в зависимости от условия.',
      cmds: ['вперёд()', 'прыгнуть()', 'лава_впереди()'],
      starter: '# Лава на каждой карте в новом месте.\nfor i in range(10):\n    вперёд()\n',
      hints: [
        'На каждом шаге есть два варианта. Когда нужно выбрать одно из двух, используют if и else.',
        'Схема такая:\n    if лава_впереди():\n        ...\n    else:\n        ...\nУ else такой же отступ, как у if.',
        'for i in range(10):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
      ],
      best: 5,
      star3: 'first',
      gen: r => genLava(r),
    },
    {
      id: 'fix',
      short: 'Почини',
      title: 'Почини программу',
      goal: 'Эту программу написал другой ученик. Герой прыгает через лаву, но почему-то теряет монеты. Найди ошибку и исправь её.',
      news: 'Отступ решает, какие команды выполняются только внутри else, а какие — на каждом повторе.',
      cmds: ALL_CMDS,
      starter: 'for i in range(10):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n        if есть_монета():\n            взять()\n',
      hints: [
        'Запусти и посмотри, какую монету пропустил герой. Где она лежит: до лавы или сразу за ней?',
        'Проверка монеты сейчас спрятана внутри else. Значит, она работает, только когда герой шагнул, а после прыжка — нет. Сдвинь её влево, чтобы отступ был как у if лава_впереди().',
        'for i in range(10):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n    if есть_монета():\n        взять()',
      ],
      best: 7,
      star3: 'first', // запуск нетронутой программы не считается
      gen: r => genFix(r),
    },
    {
      id: 'choice',
      short: 'Выбор',
      title: 'Стена, лава или путь',
      goal: 'Дойди до флага. Коридор поворачивает налево, а на пути лава. Где что будет, заранее неизвестно.',
      news: 'elif — «а если нет, то проверь вот это». Так выбирают одно из трёх действий.',
      cmds: ALL_CMDS,
      starter: '# Эта программа умеет прыгать через лаву.\n# Но теперь коридор ещё и поворачивает.\nfor i in range(20):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n',
      hints: [
        'Перед каждым шагом у героя три варианта: впереди стена, впереди лава или путь свободен.',
        'Третий вариант вставляют между if и else словом elif:\n    if стена_впереди():\n        ...\n    elif лава_впереди():\n        ...\n    else:\n        ...',
        'for i in range(20):\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
      ],
      best: 7,
      star3: 'first',
      gen: r => genChoice(r),
    },
    {
      id: 'bag',
      short: 'Рюкзак',
      title: 'Рюкзак на три монеты',
      goal: 'Дойди до флага с тремя монетами. Монет на пути больше, но в рюкзак влезает только три: четвёртую взять не получится.',
      news: 'Сравнение чисел (<, >, ==) и два условия сразу: and.',
      cmds: ALL_CMDS,
      starter: '# Эта программа берёт все монеты подряд.\nfor i in range(8):\n    вперёд()\n    if есть_монета():\n        взять()\n',
      hints: [
        'монет_собрано() отвечает числом: сколько монет уже в рюкзаке. Числа сравнивают знаками <, > и ==. Например, монет_собрано() < 3 верно, пока монет меньше трёх.',
        'Брать монету можно, когда верно сразу два условия: монета есть и рюкзак не полон. Два условия соединяют словом and:\n    if есть_монета() and монет_собрано() < 3:',
        'for i in range(8):\n    вперёд()\n    if есть_монета() and монет_собрано() < 3:\n        взять()',
      ],
      best: 4, // с and — 4 строки, два вложенных if — 5
      gen: r => genBag(r),
    },
    {
      id: 'stop',
      short: 'Стоп',
      title: 'Стоп на флаге',
      goal: 'Флаг стоит посреди коридора, каждый раз на новом месте. Остановись ровно на нём: флаг засчитывается, когда программа закончится.',
      news: 'while — повторяй, пока условие верно. not — «не»: while not на_финише() значит «пока не на финише».',
      cmds: ALL_CMDS,
      starter: '# Сколько шагов до флага? Каждый раз по-разному.\nfor i in range(5):\n    вперёд()\n',
      hints: [
        'Сколько шагов до флага, заранее неизвестно. Зато герой может спросить: на_финише() ответит «да», когда он стоит на флаге.',
        'Цикл while повторяет команды, пока условие верно. А not переворачивает ответ: not на_финише() верно, пока герой ещё не дошёл.',
        'while not на_финише():\n    вперёд()',
      ],
      best: 2, // while — 2 строки, for с if — 3
      gen: (r, used) => genStop(r, used),
    },
    {
      id: 'final',
      short: 'Финал',
      title: 'Всё вместе',
      goal: 'Повороты, лава и монеты на одной карте. Дойди до флага и собери все монеты. Программу пиши сам, с нуля.',
      news: 'Ничего нового: только то, что ты уже умеешь.',
      cmds: ALL_CMDS,
      starter: '# Пиши свою программу здесь.\n',
      hints: [
        'Разбей задачу на две части. На каждом повторе: сначала проверить монету, потом выбрать одно из трёх — повернуть, прыгнуть или шагнуть.',
        'Возьми решение задания «Выбор» и добавь в начало цикла проверку монеты:\n    if есть_монета():\n        взять()',
        'while not на_финише():\n    if есть_монета():\n        взять()\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
      ],
      best: 9,
      star3: 'first',
      gen: r => genFinal(r),
    },
  ];

  function makeMaps(task, seed, count = 3) {
    const r = rng(seed);
    const maps = [];
    const used = new Set();
    let guard = 0;
    while (maps.length < count && guard++ < 200) {
      const L = task.gen(r, used);
      if (used.has(L.sig) && guard < 150) continue;
      used.add(L.sig);
      maps.push(L);
    }
    return maps;
  }

  /* Программа закончилась. На картах «стоп» это победа, если герой стоит на флаге (вернёт null), иначе — ошибка */
  function endCheck(st) {
    const h = st.hero, f = st.level.finish;
    if (st.level.stop && h.x === f.x && h.z === f.z) return coinsError(st, null);
    if (!st.moved && !st.idle)
      return new WorldError('Программа закончилась, а герой не сделал ни шага. Напиши для него команды.', null, 'short');
    if (st.idle >= 3)
      return new WorldError('Программа закончилась, а герой застрял на месте: последние повторы он не сделал ни шага. Проверь отступ у вперёд(): если команда спряталась внутри if, герой шагает, только когда условие верно.', null, 'stuck');
    if (st.level.stop)
      return new WorldError('Программа закончилась, а герой остановился не на флаге. Нужно встать ровно на него.', null, 'stop');
    return new WorldError('Программа закончилась, а герой не дошёл до флага. Может, в цикле не хватает повторов?', null, 'short');
  }

  /* Прогон кода без анимации (для проверки в тестах) */
  function runSilent(code, level) {
    const st = createState(level);
    const b = { ...MiniPy.stdlib(), ...commands(st) };
    const g = MiniPy.execute(code, b);
    const out = [];
    try {
      for (let r = g.next(); !r.done; r = g.next()) if (r.value.type === 'print') out.push(r.value.text);
    } catch (e) {
      if (e instanceof WinSignal) return { ok: true, out };
      return { ok: false, err: e.message, line: e.line, kind: e.kind, out };
    }
    const e = endCheck(st);
    if (!e) return { ok: true, out };
    return { ok: false, err: e.message, kind: e.kind, out };
  }

  return { TASKS, DIRS, K, rng, makeMaps, createState, commands, cellAt, endCheck, WorldError, WinSignal, runSilent };
})();
if (typeof module !== 'undefined') module.exports = HeroWorld;
