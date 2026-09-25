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
  function genCoins(r) {
    const L = blankLevel();
    for (let x = 0; x <= 8; x++) L.floor.add(K(x, 0));
    let cells;
    do {
      cells = [];
      for (let x = 0; x <= 7; x++) if (r() < 0.5) cells.push(x);
    } while (cells.length < 3 || cells.length > 6);
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

  /* ---- Состояние мира ---- */
  function createState(level) {
    return {
      level,
      hero: { ...level.start },
      coins: new Set(level.coins),
      collected: 0,
      total: level.coins.size,
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

  function arrive(st, line) {
    const h = st.hero, f = st.level.finish;
    if (h.x === f.x && h.z === f.z) {
      if (st.collected < st.total) {
        const left = st.total - st.collected;
        throw new WorldError(`Герой дошёл до флага, но пропустил монеты: ${left} шт. Нужно собрать все.`, line, 'coins');
      }
      return true;
    }
    return false;
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
          if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        }
        return null;
      }),
      'налево': fn('налево', 0, function* () {
        st.hero.dir = (st.hero.dir + 1) % 4;
        yield { type: 'turn', dir: st.hero.dir, side: 1 };
        return null;
      }),
      'направо': fn('направо', 0, function* () {
        st.hero.dir = (st.hero.dir + 3) % 4;
        yield { type: 'turn', dir: st.hero.dir, side: -1 };
        return null;
      }),
      'взять': fn('взять', 0, function* (args, line) {
        const k = K(st.hero.x, st.hero.z);
        if (!st.coins.has(k)) {
          yield { type: 'grab-air' };
          throw new WorldError('Здесь нет монеты, герой схватил воздух. Сначала проверь: есть_монета()', line, 'air');
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
        if (ct === 'lava') { yield { type: 'burn' }; throw new WorldError('Герой приземлился в лаву!', line, 'lava'); }
        if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        return null;
      }),
      'стена_впереди': fn('стена_впереди', 0, function* () {
        const a = ahead(st); const v = cellAt(st.level, a.x, a.z) === 'wall';
        yield { type: 'check', text: `стена впереди? ${yesNo(v)}`, value: v };
        return v;
      }),
      'лава_впереди': fn('лава_впереди', 0, function* () {
        const a = ahead(st); const v = cellAt(st.level, a.x, a.z) === 'lava';
        yield { type: 'check', text: `лава впереди? ${yesNo(v)}`, value: v };
        return v;
      }),
      'есть_монета': fn('есть_монета', 0, function* () {
        const v = st.coins.has(K(st.hero.x, st.hero.z));
        yield { type: 'check', text: `монета здесь? ${yesNo(v)}`, value: v };
        return v;
      }),
      'на_финише': fn('на_финише', 0, function* () {
        const f = st.level.finish; const v = st.hero.x === f.x && st.hero.z === f.z;
        yield { type: 'check', text: `я на финише? ${yesNo(v)}`, value: v };
        return v;
      }),
      'монет_собрано': fn('монет_собрано', 0, function* () {
        yield { type: 'check', text: `монет у меня: ${st.collected}`, value: st.collected };
        return st.collected;
      }),
    };
    return cmds;
  }

  /* ---- Задания ---- */
  const TASKS = [
    {
      id: 'coins',
      short: 'Монеты',
      title: 'Монеты через раз',
      goal: 'Пройди коридор до флага и собери все монеты. Монеты лежат не на каждой клетке, и на каждой карте по-разному.',
      news: 'if внутри цикла: действие выполняется, только когда условие верно.',
      cmds: ['вперёд()', 'взять()', 'есть_монета()'],
      starter: '# Код ломается на клетке без монеты.\n# Бери монету, только если она есть!\nfor i in range(8):\n    взять()\n    вперёд()\n',
      hints: [
        'Перед тем как взять монету, герою нужно проверить, есть ли она на клетке. Для этого есть есть_монета().',
        'Проверка записывается так:\n    if есть_монета():\n        взять()\nОбрати внимание на двоеточие и отступ.',
        'for i in range(8):\n    if есть_монета():\n        взять()\n    вперёд()',
      ],
      best: 4,
      gen: (r, used) => genCoins(r, used),
    },
    {
      id: 'turn',
      short: 'Поворот',
      title: 'Стена за углом',
      goal: 'Дойди до флага. Коридор где-то поворачивает налево, но где именно, заранее неизвестно: на каждой карте по-своему.',
      news: 'Проверка перед шагом: сначала смотрим, потом действуем.',
      cmds: ['вперёд()', 'налево()', 'стена_впереди()'],
      starter: '# Герой не знает, где поворот.\n# Если впереди стена, поверни налево.\nfor i in range(8):\n    вперёд()\n',
      hints: [
        'Перед каждым шагом герой может посмотреть вперёд: стена_впереди() ответит «да» или «нет».',
        'Если впереди стена, нужно повернуть. Поставь проверку перед вперёд():\n    if стена_впереди():\n        налево()',
        'for i in range(8):\n    if стена_впереди():\n        налево()\n    вперёд()',
      ],
      best: 4,
      gen: (r, used) => genTurn(r, used),
    },
    {
      id: 'lava',
      short: 'Лава',
      title: 'Через лаву',
      goal: 'Дойди до флага. На пути лава: через неё нужно прыгать, а по обычным клеткам — просто идти. Прыгать без лавы нельзя.',
      news: 'if / else: одно из двух действий, в зависимости от условия.',
      cmds: ['вперёд()', 'прыгнуть()', 'лава_впереди()'],
      starter: '# Выбери одно из двух действий:\n# лава впереди — прыгни, иначе — шагни.\nfor i in range(10):\n    вперёд()\n',
      hints: [
        'На каждом шаге есть два варианта. Когда нужно выбрать одно из двух, используют if и else.',
        'Схема такая:\n    if лава_впереди():\n        ...\n    else:\n        ...\nУ else такой же отступ, как у if.',
        'for i in range(10):\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
      ],
      best: 5,
      gen: (r, used) => genLava(r, used),
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
    return { ok: false, err: 'Программа закончилась, а герой не дошёл до флага.', kind: 'short', out };
  }

  return { TASKS, DIRS, K, rng, makeMaps, createState, commands, cellAt, WorldError, WinSignal, runSilent };
})();
if (typeof module !== 'undefined') module.exports = HeroWorld;
