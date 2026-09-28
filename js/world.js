/* Логика мира: клетки, герой, команды, карты и список уроков. Сами уроки — в js/lessons/ */
const HeroWorld = (() => {
  const { PyError, fn, repr } = MiniPy;
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
    return {
      floor: new Set(), lava: new Set(), coins: new Set(), gates: new Set(), signs: new Map(),
      start: { x: 0, z: 0, dir: 0 }, finish: { x: 0, z: 0 },
    };
  }

  /* ---- Помощники для карт ---- */
  // Карта-рисунок: строки сверху вниз — ряды клеток с севера на юг.
  // .  пол    $  монета    ~  лава    G  ворота    1–9  табличка с числом    F  флаг
  // > ^ < v  старт (куда смотрит герой)    пробел или #  стена
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
      else if (ch === 'G') L.gates.add(k);
      else if (/[1-9]/.test(ch)) L.signs.set(k, Number(ch));
      else if (ch === 'F') { L.finish = { x, z }; hasFinish = true; }
      else if (ch in dirOf) { L.start = { x, z, dir: dirOf[ch] }; hasStart = true; }
      else if (ch !== '.') throw new Error(`Непонятный знак «${ch}» в карте, строка ${z + 1}`);
    }));
    if (!hasStart || !hasFinish) throw new Error('На карте нужны старт (> ^ < v) и флаг (F)');
    return L;
  }
  // Коридор из прямых отрезков длиной lens. После каждого поворот: turns[i] = 1 — налево (по умолчанию), 3 — направо.
  // Возвращает клетки пути по порядку.
  function corridor(L, lens, turns = []) {
    const path = [{ x: 0, z: 0 }];
    let dir = 0;
    lens.forEach((n, i) => {
      const [dx, dz] = DIRS[dir];
      for (let s = 0; s < n; s++) { const p = path[path.length - 1]; path.push({ x: p.x + dx, z: p.z + dz }); }
      dir = (dir + (turns[i] || 1)) % 4;
    });
    path.forEach(p => L.floor.add(K(p.x, p.z)));
    const f = path[path.length - 1];
    L.finish = { x: f.x, z: f.z };
    return path;
  }
  // Путь не пересекает себя и нигде не касается сам себя боком — иначе появились бы короткие проходы
  function pathOk(path) {
    const idx = new Map(path.map((p, i) => [K(p.x, p.z), i]));
    if (idx.size !== path.length) return false;
    return path.every((p, i) => DIRS.every(([dx, dz]) => {
      const j = idx.get(K(p.x + dx, p.z + dz));
      return j === undefined || Math.abs(j - i) === 1;
    }));
  }
  // Случайный извилистый путь: count отрезков длиной от min до max, повороты налево и направо (onlyLeft — только налево)
  function winding(r, count, min, max, onlyLeft) {
    for (let guard = 0; guard < 500; guard++) {
      const lens = [], turns = [];
      for (let i = 0; i < count; i++) { lens.push(randInt(r, min, max)); turns.push(onlyLeft || r() < 0.5 ? 1 : 3); }
      const L = blankLevel();
      const path = corridor(L, lens, turns);
      if (pathOk(path)) return { L, path, lens, turns };
    }
    throw new Error('Не удалось построить путь');
  }
  // Номера углов пути (там, где он поворачивает)
  function corners(lens) {
    const out = new Set();
    lens.reduce((i, n) => { out.add(i + n); return i + n; }, 0);
    return out;
  }

  // Лабиринт w × h комнат без петель (каждую комнату можно пройти правилом правой руки).
  // Комната (i, j) — клетка (2i, 2j), проходы между комнатами — клетки посередине. Старт — слева сверху, флаг — справа снизу.
  function maze(r, w, h) {
    const L = blankLevel();
    const seen = new Set(['0,0']), stack = [[0, 0]];
    const deg = new Map();
    const open = (i, j) => { L.floor.add(K(2 * i, 2 * j)); };
    open(0, 0);
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const next = DIRS.map(([dx, dz]) => [i + dx, j + dz]).filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h && !seen.has(a + ',' + b));
      if (!next.length) { stack.pop(); continue; }
      const [a, b] = next[Math.floor(r() * next.length)];
      seen.add(a + ',' + b);
      open(a, b);
      L.floor.add(K(i + a, j + b)); // проход посередине
      deg.set(K(2 * i, 2 * j), (deg.get(K(2 * i, 2 * j)) || 0) + 1);
      deg.set(K(2 * a, 2 * b), (deg.get(K(2 * a, 2 * b)) || 0) + 1);
      stack.push([a, b]);
    }
    L.start = { x: 0, z: 0, dir: L.floor.has(K(1, 0)) ? 0 : 3 };
    L.finish = { x: 2 * (w - 1), z: 2 * (h - 1) };
    L.deadEnds = [...deg].filter(([k, d]) => d === 1).map(([k]) => k);
    L.sig = [...L.floor].sort().join(';');
    return L;
  }
  // Путь Бита по правилу руки (hand = 3 — правая, 1 — левая) от старта до флага: клетки по порядку
  function handWalk(L, hand = 3) {
    const h = { ...L.start }, cells = [K(h.x, h.z)];
    const free = d => { const [dx, dz] = DIRS[d]; return L.floor.has(K(h.x + dx, h.z + dz)); };
    for (let guard = 0; guard < 2000 && !(h.x === L.finish.x && h.z === L.finish.z); guard++) {
      const s = (h.dir + hand) % 4;
      if (free(s)) h.dir = s;
      else if (!free(h.dir)) { h.dir = (h.dir + 4 - hand) % 4; continue; }
      const [dx, dz] = DIRS[h.dir];
      h.x += dx; h.z += dz;
      cells.push(K(h.x, h.z));
    }
    return cells;
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
      steps: 0, // сколько раз Бит шагнул командой вперёд
      opened: new Set(), // открытые ворота
      visits: new Map(), // сколько раз Бит оказывался в одном и том же положении — чтобы поймать вечный цикл
      said: undefined, // что Бит сказал командой сказать()
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
  // Английские имена — мост к обычному Python. На картах english: true работают только они.
  const EN = {
    'вперед': 'move', 'налево': 'turn_left', 'направо': 'turn_right', 'взять': 'take', 'прыгнуть': 'jump',
    'открыть': 'open_gate', 'сказать': 'say',
    'стена_впереди': 'wall_in_front', 'стена_слева': 'wall_on_left', 'стена_справа': 'wall_on_right',
    'лава_впереди': 'lava_in_front', 'ворота_впереди': 'gate_in_front', 'есть_монета': 'coin_here',
    'на_финише': 'at_goal', 'монет_собрано': 'coins_taken', 'табличка': 'read_sign',
  };
  // Клетка с учётом ворот: закрытые ворота не пускают дальше
  function cellOf(st, x, z) {
    const k = K(x, z);
    if (st.level.gates.has(k) && !st.opened.has(k)) return 'gate';
    return cellAt(st.level, x, z);
  }
  function side(st, turn) {
    const [dx, dz] = DIRS[(st.hero.dir + turn) % 4];
    return { x: st.hero.x + dx, z: st.hero.z + dz };
  }
  // Бит в одном и том же положении больше LOOP_LIMIT раз — значит, цикл не закончится никогда.
  // На флаге можно стоять и проверять сколько угодно: такие программы заканчиваются сами.
  const LOOP_LIMIT = 25;
  function tick(st, line) {
    const h = st.hero, f = st.level.finish;
    if (h.x === f.x && h.z === f.z) return;
    const key = `${h.x},${h.z},${h.dir},${st.collected},${st.opened.size}`;
    const n = (st.visits.get(key) || 0) + 1;
    st.visits.set(key, n);
    if (n > LOOP_LIMIT)
      throw new WorldError('Похоже, цикл никогда не закончится: Бит снова и снова делает одно и то же на одном месте. Проверь, что в цикле что-то меняется — например, есть шаг вперёд().', line, 'loop');
  }
  // Датчик: вопрос Биту, ответ показывается в облачке
  function sense(st, line, text, value) {
    st.idle++;
    tick(st, line);
    return { type: 'check', text, value };
  }

  function commands(st) {
    const L = st.level;
    const cmds = {
      'вперед': fn('вперёд', [0, 1], function* (args, line) {
        const n = args.length ? args[0] : 1;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1)
          throw new PyError('В скобках у вперёд() может быть только целое число шагов, например вперёд(2).', line);
        for (let s = 0; s < n; s++) {
          const to = ahead(st);
          const c = cellOf(st, to.x, to.z);
          if (c === 'wall' || c === 'gate') {
            yield { type: 'bump' };
            if (c === 'gate') throw new WorldError('Ворота закрыты. Сначала открой их: открыть()', line, 'gate');
            throw new WorldError('Бум! Впереди стена, туда не пройти.', line, 'wall');
          }
          const from = { ...st.hero };
          st.hero.x = to.x; st.hero.z = to.z;
          if (c === 'lava') {
            yield { type: 'move', from, to };
            yield { type: 'burn' };
            throw new WorldError(L.basic
              ? 'Ой! Герой шагнул прямо в лаву. Через лаву нужно прыгать: прыгнуть()'
              : 'Ой! Герой шагнул прямо в лаву. Перед шагом проверь: лава_впереди()', line, 'lava');
          }
          yield { type: 'move', from, to };
          st.idle = 0; st.moved = true; st.steps++;
          if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        }
        return null;
      }),
      'налево': fn('налево', 0, function* (args, line) {
        st.hero.dir = (st.hero.dir + 1) % 4;
        st.idle++;
        tick(st, line);
        yield { type: 'turn', dir: st.hero.dir, side: 1 };
        return null;
      }),
      'направо': fn('направо', 0, function* (args, line) {
        st.hero.dir = (st.hero.dir + 3) % 4;
        st.idle++;
        tick(st, line);
        yield { type: 'turn', dir: st.hero.dir, side: -1 };
        return null;
      }),
      'взять': fn('взять', 0, function* (args, line) {
        const k = K(st.hero.x, st.hero.z);
        if (!st.coins.has(k)) {
          yield { type: 'grab-air' };
          throw new WorldError(L.basic
            ? 'Здесь нет монеты, герой схватил воздух. Бери монету только там, где она лежит.'
            : 'Здесь нет монеты, герой схватил воздух. Сначала проверь: есть_монета()', line, 'air');
        }
        if (L.need && st.collected >= L.need) {
          yield { type: 'full' };
          throw new WorldError(`Рюкзак полон: больше ${L.need} монет не унести. Перед тем как брать, проверь, сколько уже собрано: монет_собрано()`, line, 'full');
        }
        st.coins.delete(k);
        st.collected++;
        yield { type: 'take', x: st.hero.x, z: st.hero.z, count: st.collected, total: st.total };
        return null;
      }),
      'прыгнуть': fn('прыгнуть', 0, function* (args, line) {
        const mid = ahead(st, 1), to = ahead(st, 2);
        const cm = cellOf(st, mid.x, mid.z);
        if (cm === 'wall') { yield { type: 'bump' }; throw new WorldError('Впереди стена, её не перепрыгнуть.', line, 'wall'); }
        if (cm === 'gate') { yield { type: 'bump' }; throw new WorldError('Через закрытые ворота не перепрыгнуть. Открой их: открыть()', line, 'gate'); }
        if (cm !== 'lava') {
          yield { type: 'shrug' };
          throw new WorldError('Впереди нет лавы, прыгать незачем: прыжок только через лаву. По обычной клетке иди командой вперёд()', line, 'nojump');
        }
        const ct = cellOf(st, to.x, to.z);
        const from = { ...st.hero };
        if (ct === 'wall' || ct === 'gate') { yield { type: 'bump' }; throw new WorldError('За лавой стена, приземлиться некуда.', line, 'wall'); }
        st.hero.x = to.x; st.hero.z = to.z;
        yield { type: 'jump', from, to };
        st.idle = 0; st.moved = true;
        if (ct === 'lava') { yield { type: 'burn' }; throw new WorldError('Герой приземлился в лаву!', line, 'lava'); }
        if (arrive(st, line)) { yield { type: 'win' }; throw new WinSignal(); }
        return null;
      }),
      'открыть': fn('открыть', 0, function* (args, line) {
        const a = ahead(st), k = K(a.x, a.z);
        if (cellOf(st, a.x, a.z) !== 'gate') {
          yield { type: 'shrug', text: 'Тут нечего открывать' };
          throw new WorldError('Впереди нет закрытых ворот — открывать нечего. Перед этим проверь: ворота_впереди()', line, 'nogate');
        }
        st.opened.add(k);
        yield { type: 'open', x: a.x, z: a.z };
        return null;
      }),
      'сказать': fn('сказать', 1, function* (args) {
        st.said = args[0];
        st.idle++;
        yield { type: 'say', text: repr(args[0]) };
        return null;
      }),
      'табличка': fn('табличка', 0, function* (args, line) {
        const k = K(st.hero.x, st.hero.z);
        if (!L.signs.has(k))
          throw new WorldError('Под Битом нет таблички: прочитать её можно, только стоя на ней. Запомни число заранее: n = табличка()', line, 'nosign');
        const v = L.signs.get(k);
        yield sense(st, line, `на табличке: ${v}`, v);
        return v;
      }),
      'стена_впереди': fn('стена_впереди', 0, function* (args, line) {
        const a = ahead(st), v = cellAt(L, a.x, a.z) === 'wall';
        yield sense(st, line, `стена впереди? ${yesNo(v)}`, v);
        return v;
      }),
      'стена_слева': fn('стена_слева', 0, function* (args, line) {
        const a = side(st, 1), v = cellAt(L, a.x, a.z) === 'wall';
        yield sense(st, line, `стена слева? ${yesNo(v)}`, v);
        return v;
      }),
      'стена_справа': fn('стена_справа', 0, function* (args, line) {
        const a = side(st, 3), v = cellAt(L, a.x, a.z) === 'wall';
        yield sense(st, line, `стена справа? ${yesNo(v)}`, v);
        return v;
      }),
      'лава_впереди': fn('лава_впереди', 0, function* (args, line) {
        const a = ahead(st), v = cellAt(L, a.x, a.z) === 'lava';
        yield sense(st, line, `лава впереди? ${yesNo(v)}`, v);
        return v;
      }),
      'ворота_впереди': fn('ворота_впереди', 0, function* (args, line) {
        const a = ahead(st), v = cellOf(st, a.x, a.z) === 'gate';
        yield sense(st, line, `ворота впереди? ${yesNo(v)}`, v);
        return v;
      }),
      'есть_монета': fn('есть_монета', 0, function* (args, line) {
        const v = st.coins.has(K(st.hero.x, st.hero.z));
        yield sense(st, line, `монета здесь? ${yesNo(v)}`, v);
        return v;
      }),
      'на_финише': fn('на_финише', 0, function* (args, line) {
        if (L.hidden) throw new WorldError('Флаг спрятан, поэтому на_финише() тут не подскажет. Считай шаги сам.', line, 'hidden');
        const f = L.finish, v = st.hero.x === f.x && st.hero.z === f.z;
        yield sense(st, line, `я на финише? ${yesNo(v)}`, v);
        return v;
      }),
      'монет_собрано': fn('монет_собрано', 0, function* (args, line) {
        yield sense(st, line, `монет у меня: ${st.collected}`, st.collected);
        return st.collected;
      }),
    };
    // Те же команды по-английски: move() — это вперёд()
    for (const [ru, en] of Object.entries(EN)) cmds[en] = { ...cmds[ru], name: en };
    if (L.english) for (const [ru, en] of Object.entries(EN)) {
      const shown = cmds[ru].name;
      cmds[ru] = fn(shown, [0, 9], (args, line) => {
        throw new WorldError(`В Замке Сбоя Бит понимает только английские команды: вместо ${shown}() пиши ${en}()`, line, 'english');
      });
    }
    // «Сломанная» команда: ученик пишет свой приём с тем же именем, и он её заменяет
    (L.broken || []).forEach(name => {
      const shown = cmds[name].name;
      cmds[name] = fn(shown, [0, 9], (args, line) => {
        throw new WorldError(`Сбой сломал ${shown}()! Напиши свой приём с таким же именем: def ${shown}(): — и собери поворот из других команд.`, line, 'broken');
      });
    });
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

  // Ответ Хранителю: answer — число или 'steps' (сколько раз Бит шагнул вперёд)
  function answerError(st) {
    const a = st.level.answer;
    if (a === undefined) return null;
    const want = a === 'steps' ? st.steps : a;
    const cmd = st.level.english ? 'say(...)' : 'сказать(...)';
    if (st.said === undefined) return new WorldError(`Бит на флаге, но ничего не сказал. Ответ говорят командой ${cmd}`, null, 'answer');
    const got = typeof st.said === 'string' && /^\s*-?\d+\s*$/.test(st.said) ? Number(st.said) : st.said;
    if (got !== want) return new WorldError(`Ответ не сошёлся: Бит сказал ${repr(st.said)}, а верно ${want}.`, null, 'answer');
    return null;
  }

  /* Программа закончилась. На картах «стоп» это победа, если герой стоит на флаге (вернёт null), иначе — ошибка.
     По коду понятно, что уже знает ученик: без циклов и условий не советуем про повторы и отступы у if */
  function endCheck(st, code = '') {
    const h = st.hero, f = st.level.finish;
    if (st.level.stop && h.x === f.x && h.z === f.z) return coinsError(st, null) || answerError(st);
    if (!st.moved && !st.idle)
      return new WorldError('Программа закончилась, а герой не сделал ни шага. Напиши для него команды.', null, 'short');
    if (st.idle >= 3 && /^\s*(if|elif|while)\b/m.test(code))
      return new WorldError('Программа закончилась, а герой застрял на месте: последние повторы он не сделал ни шага. Проверь отступ у вперёд(): если команда спряталась внутри if, герой шагает, только когда условие верно.', null, 'stuck');
    if (st.level.stop)
      return new WorldError(st.level.hidden
        ? 'Программа закончилась, а Бит остановился не там, где спрятан флаг.'
        : 'Программа закончилась, а герой остановился не на флаге. Нужно встать ровно на него.', null, 'stop');
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
    LESSONS, addLesson, ALL_CMDS, EN, DIRS, K, rng, randInt, blankLevel, fromAscii, corridor, pickLava,
    pathOk, winding, corners, maze, handWalk,
    makeMaps, createState, commands, cellAt, endCheck, WorldError, WinSignal, runSilent,
  };
})();
if (typeof module !== 'undefined') module.exports = HeroWorld;
