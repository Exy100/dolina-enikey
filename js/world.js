/* Логика мира: клетки, герой, команды, карты и список уроков. Сами уроки — в js/lessons/ */
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

  /* ---- Помощники для карт ---- */
  // Карта-рисунок: строки сверху вниз — ряды клеток с севера на юг.
  // .  пол    $  монета    ~  лава    F  флаг    > ^ < v  старт (куда смотрит герой)    пробел или #  стена
  function fromAscii(rows) {
    const L = blankLevel();
    const dirOf = { '>': 0, '^': 1, '<': 2, 'v': 3 };
    let hasStart = false, hasFinish = false;
    rows.forEach((row, z) => [...row].forEach((ch, x) => {
      if (ch === ' ' || ch === '#') return;
      const k = K(x, z);
      L.floor.add(k);
      if (ch === '$') L.coins.add(k);
      else if (ch === '~') L.lava.add(k);
      else if (ch === 'F') { L.finish = { x, z }; hasFinish = true; }
      else if (ch in dirOf) { L.start = { x, z, dir: dirOf[ch] }; hasStart = true; }
      else if (ch !== '.') throw new Error(`Непонятный знак «${ch}» в карте, строка ${z + 1}`);
    }));
    if (!hasStart || !hasFinish) throw new Error('На карте нужны старт (> ^ < v) и флаг (F)');
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
            throw new WorldError(st.level.basic
              ? 'Ой! Герой шагнул прямо в лаву. Через лаву нужно прыгать: прыгнуть()'
              : 'Ой! Герой шагнул прямо в лаву. Перед шагом проверь: лава_впереди()', line, 'lava');
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
          throw new WorldError(st.level.basic
            ? 'Здесь нет монеты, герой схватил воздух. Бери монету только там, где она лежит.'
            : 'Здесь нет монеты, герой схватил воздух. Сначала проверь: есть_монета()', line, 'air');
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

  /* ---- Уроки ---- */
  // С 4-го задания урока над редактором все команды: ученик сам выбирает нужные
  const ALL_CMDS = ['вперёд()', 'налево()', 'направо()', 'прыгнуть()', 'взять()', 'стена_впереди()', 'лава_впереди()', 'есть_монета()', 'монет_собрано()', 'на_финише()'];
  // Уроки лежат в js/lessons/ и сами добавляют себя сюда — в том порядке, в каком подключены в index.html
  const LESSONS = [];
  function addLesson(lesson) {
    lesson.tasks.forEach(t => { t.lesson = lesson.id; t.basic = !!lesson.basic; });
    LESSONS.push(lesson);
  }

  // Карты для задания: нарисованная карта (map) одна, случайных (gen) — три разные
  function makeMaps(task, seed, count = 3) {
    if (task.map) {
      const L = fromAscii(task.map);
      L.basic = task.basic;
      return [L];
    }
    const r = rng(seed);
    const maps = [];
    const used = new Set();
    let guard = 0;
    while (maps.length < count && guard++ < 200) {
      const L = task.gen(r, used);
      if (used.has(L.sig) && guard < 150) continue;
      used.add(L.sig);
      L.basic = task.basic;
      maps.push(L);
    }
    return maps;
  }

  /* Программа закончилась. На картах «стоп» это победа, если герой стоит на флаге (вернёт null), иначе — ошибка.
     По коду понятно, что уже знает ученик: без циклов и условий не советуем про повторы и отступы у if */
  function endCheck(st, code = '') {
    const h = st.hero, f = st.level.finish;
    if (st.level.stop && h.x === f.x && h.z === f.z) return coinsError(st, null);
    if (!st.moved && !st.idle)
      return new WorldError('Программа закончилась, а герой не сделал ни шага. Напиши для него команды.', null, 'short');
    if (st.idle >= 3 && /^\s*(if|elif|while)\b/m.test(code))
      return new WorldError('Программа закончилась, а герой застрял на месте: последние повторы он не сделал ни шага. Проверь отступ у вперёд(): если команда спряталась внутри if, герой шагает, только когда условие верно.', null, 'stuck');
    if (st.level.stop)
      return new WorldError('Программа закончилась, а герой остановился не на флаге. Нужно встать ровно на него.', null, 'stop');
    if (!/^\s*(for|while)\b/m.test(code))
      return new WorldError('Программа закончилась, а герой не дошёл до флага. Допиши команды.', null, 'short');
    return new WorldError('Программа закончилась, а герой не дошёл до флага. Не хватает повторов в цикле или команд после него?', null, 'short');
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
    const e = endCheck(st, code);
    if (!e) return { ok: true, out };
    return { ok: false, err: e.message, kind: e.kind, out };
  }

  return {
    LESSONS, addLesson, ALL_CMDS, DIRS, K, rng, randInt, blankLevel, fromAscii, corridor, pickLava,
    makeMaps, createState, commands, cellAt, endCheck, WorldError, WinSignal, runSilent,
  };
})();
if (typeof module !== 'undefined') module.exports = HeroWorld;
