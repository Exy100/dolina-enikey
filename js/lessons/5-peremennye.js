/* Урок 5 «Переменные»: считать и запоминать. Проводник — Хранитель чисел.
   Новое: табличка() — число на табличке под Битом, сказать(x) — ответ Хранителю в конце пути.
   Ответ на трёх картах всегда разный, поэтому угадать его числом не выйдет. */
(() => {
  const { K, randInt, blankLevel, corridor, pickLava, pathOk, winding, corners, ALL_CMDS } = HeroWorld;
  const CMDS = [...ALL_CMDS, 'табличка()', 'сказать()', 'n = n + 1'];

  function sample(r, arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  // Число, которого ещё не было на других картах этого набора (оно первое в sig до «|»)
  const usedFirst = (used, v) => used && [...used].some(s => s.split('|')[0] === String(v));
  function fresh(r, used, a, b) {
    let v, guard = 0;
    do { v = randInt(r, a, b); } while (usedFirst(used, v) && ++guard < 50);
    return v;
  }
  const line = (L, n) => { for (let x = 0; x <= n; x++) L.floor.add(K(x, 0)); };
  // Лава в прямом коридоре: ровно count клеток среди from..to, не вплотную друг к другу
  function lavaLine(r, from, to, count) {
    for (let guard = 0; guard < 500; guard++) {
      const xs = sample(r, Array.from({ length: to - from + 1 }, (_, i) => from + i), count).sort((a, b) => a - b);
      if (xs.every((x, i) => !i || x - xs[i - 1] > 1)) return xs;
    }
    return [from];
  }

  // Прямая дорога, в конце Хранитель спрашивает: сколько шагов?
  function genSteps(r, used) {
    const L = blankLevel();
    const n = fresh(r, used, 4, 10);
    line(L, n);
    L.finish = { x: n, z: 0 };
    L.stop = true;
    L.answer = n;
    L.sig = `${n}|`;
    return L;
  }
  // На табличке под Битом — сколько монет взять. Монет на дороге больше
  function genSign(r, used) {
    const L = blankLevel();
    const need = fresh(r, used, 2, 4), n = randInt(r, 8, 10);
    line(L, n);
    L.signs.set(K(0, 0), need);
    const coins = sample(r, Array.from({ length: n - 1 }, (_, i) => i + 1), need + randInt(r, 2, 3)).sort((a, b) => a - b);
    coins.forEach(x => L.coins.add(K(x, 0)));
    L.need = need;
    L.finish = { x: n, z: 0 };
    L.sig = `${need}|${coins.join(',')}`;
    return L;
  }
  // Сколько лавы Бит перепрыгнул?
  function genLavaCount(r, used) {
    const L = blankLevel();
    const count = fresh(r, used, 2, 4);
    line(L, 10);
    const lava = lavaLine(r, 1, 9, count);
    lava.forEach(x => L.lava.add(K(x, 0)));
    L.finish = { x: 10, z: 0 };
    L.stop = true;
    L.answer = count;
    L.sig = `${count}|${lava.join(',')}`;
    return L;
  }
  // Сколько раз Бит повернул? Путь закручивается налево
  function genTurns(r, used) {
    const t = fresh(r, used, 1, 4);
    const { L, lens } = winding(r, t + 1, 2, 5, true);
    L.stop = true;
    L.answer = t;
    L.sig = `${t}|${lens.join('')}`;
    return L;
  }
  // Таблички на старте и на поворотах: сколько идти до следующего поворота.
  // Дорога продолжается за поворотом тупиком, поэтому «иди до стены» не сработает
  function genCorners(r) {
    for (let guard = 0; guard < 200; guard++) {
      const { L, path, lens } = winding(r, randInt(r, 3, 4), 2, 5, true);
      L.signs.set(K(0, 0), lens[0]);
      let at = 0;
      const pathKeys = new Set(path.map(p => K(p.x, p.z)));
      let ok = true;
      lens.slice(0, -1).forEach((n, i) => {
        at += n;
        const c = path[at], prev = path[at - 1];
        L.signs.set(K(c.x, c.z), lens[i + 1]);
        const ex = { x: c.x * 2 - prev.x, z: c.z * 2 - prev.z }; // клетка прямо за поворотом
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
          const k = K(ex.x + dx, ex.z + dz);
          return k !== K(c.x, c.z) && pathKeys.has(k);
        });
        if (touches || pathKeys.has(K(ex.x, ex.z))) ok = false;
        else L.floor.add(K(ex.x, ex.z));
      });
      if (!ok) continue;
      L.sig = `${lens.join('')}|`;
      return L;
    }
    throw new Error('Не удалось построить дорогу с табличками');
  }
  // Сколько всего монет и лавы вместе?
  function genSum(r, used) {
    for (let guard = 0; guard < 100; guard++) {
      const L = blankLevel();
      line(L, 10);
      const lava = lavaLine(r, 1, 9, randInt(r, 1, 3));
      const free = Array.from({ length: 9 }, (_, i) => i + 1).filter(x => !lava.includes(x));
      const coins = sample(r, free, randInt(r, 1, 3));
      const sum = lava.length + coins.length;
      if (usedFirst(used, sum) && guard < 90) continue;
      lava.forEach(x => L.lava.add(K(x, 0)));
      coins.forEach(x => L.coins.add(K(x, 0)));
      L.finish = { x: 10, z: 0 };
      L.stop = true;
      L.answer = sum;
      L.sig = `${sum}|${lava.join(',')}|${coins.sort().join(',')}`;
      return L;
    }
  }
  // Флаг спрятан. Табличка говорит, сколько до него клеток; прыжок через лаву — сразу две клетки
  function genCountdown(r, used) {
    const L = blankLevel();
    const n = fresh(r, used, 6, 9), len = n + randInt(r, 2, 3);
    line(L, len);
    const lava = lavaLine(r, 1, len - 1, randInt(r, 1, 3)).filter(x => x !== n);
    lava.forEach(x => L.lava.add(K(x, 0)));
    L.signs.set(K(0, 0), n);
    L.finish = { x: n, z: 0 };
    L.hidden = true;
    L.stop = true;
    L.sig = `${n}|${lava.join(',')}`;
    return L;
  }
  // Всё вместе: табличка с числом монет, лава, повороты, в конце — сколько лавы
  function genFinal(r, used) {
    const count = fresh(r, used, 1, 3);
    for (let guard = 0; guard < 200; guard++) {
      const { L, path, lens } = winding(r, randInt(r, 3, 4), 3, 5, true);
      const lava = pickLava(r, path, lens, count, count);
      if (lava.length !== count) continue;
      lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
      const need = randInt(r, 2, 3);
      const free = Array.from({ length: path.length - 2 }, (_, i) => i + 1).filter(i => !lava.includes(i));
      sample(r, free, need + randInt(r, 1, 2)).forEach(i => L.coins.add(K(path[i].x, path[i].z)));
      L.signs.set(K(0, 0), need);
      L.need = need;
      L.stop = true;
      L.answer = count;
      L.sig = `${count}|${lens.join('')}|${lava.join(',')}|${[...L.coins].sort().join(';')}`;
      return L;
    }
  }

  // Задание со звёздочкой: какой прямой участок самый длинный? Самый длинный — никогда не последний,
  // чтобы ответ «длина последнего участка» не проходил
  function genLongest(r, used) {
    const m = fresh(r, used, 4, 7);
    for (let guard = 0; guard < 500; guard++) {
      const n = randInt(r, 3, 4), lens = [];
      for (let i = 0; i < n; i++) lens.push(randInt(r, 2, m - 1));
      lens[randInt(r, 0, n - 2)] = m;
      const L = blankLevel(), path = corridor(L, lens);
      if (!pathOk(path)) continue;
      L.stop = true;
      L.answer = m;
      L.sig = `${m}|${lens.join('')}`;
      return L;
    }
  }

  HeroWorld.addLesson({
    id: 'peremennye',
    title: 'Переменные',
    intro: 'Хранитель в конце пути задаёт вопрос. Ответ говорят командой сказать(...), и на каждой карте он свой.',
    // Разминка в начале урока: задания из прошлых уроков на свежих картах, с нуля
    warmup: ['p-gates', 'lava'],
    tasks: [
      {
        id: 'v-steps',
        short: 'Шаги',
        title: 'Сколько шагов?',
        goal: 'Дойди до флага и скажи Хранителю, сколько шагов сделал Бит. Дорога каждый раз разной длины.',
        news: 'Переменная — коробка с именем, в ней лежит число: шаги = 0. Прибавить единицу: шаги = шаги + 1.',
        cmds: ['вперёд()', 'на_финише()', 'сказать()', 'шаги = шаги + 1'],
        starter: 'шаги = 0\nwhile not на_финише():\n    вперёд()\nсказать(шаги)\n',
        hints: [
          'Переменная шаги так и остаётся нулём: её никто не увеличивает.',
          'После каждого шага прибавляй единицу — внутри while, сразу после вперёд():\n        шаги = шаги + 1',
          'шаги = 0\nwhile not на_финише():\n    вперёд()\n    шаги = шаги + 1\nсказать(шаги)',
        ],
        best: 5,
        star3: 'first',
        gen: (r, used) => genSteps(r, used),
      },
      {
        id: 'v-sign',
        short: 'Табличка',
        title: 'Табличка',
        goal: 'Бит стоит на табличке: на ней написано, сколько монет взять. Возьми ровно столько и дойди до флага.',
        news: 'табличка() читает число с таблички под Битом. Запомни его в переменную: нужно = табличка().',
        cmds: ['вперёд()', 'взять()', 'есть_монета()', 'монет_собрано()', 'табличка()'],
        starter: '# На табличке под Битом — сколько монет взять.\nwhile not на_финише():\n    вперёд()\n    if есть_монета():\n        взять()\n',
        hints: [
          'Табличку можно прочитать только стоя на ней — то есть в самом начале. Запомни число сразу.',
          'Первой строкой: нужно = табличка(). А брать монету — только если монет_собрано() < нужно.',
          'нужно = табличка()\nwhile not на_финише():\n    вперёд()\n    if есть_монета() and монет_собрано() < нужно:\n        взять()',
        ],
        best: 5, // с двумя циклами — 7
        gen: (r, used) => genSign(r, used),
      },
      {
        id: 'v-lava',
        short: 'Лава',
        title: 'Счёт лавы',
        goal: 'Дойди до флага и скажи Хранителю, сколько раз Бит перепрыгнул лаву.',
        news: 'Счётчик увеличивают только тогда, когда случилось то, что считаешь.',
        cmds: CMDS,
        starter: 'while not на_финише():\n    if лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n',
        hints: [
          'Заведи переменную до цикла: лава = 0. В конце скажи её: сказать(лава).',
          'Прибавляй единицу только после прыжка — внутри if, рядом с прыгнуть().',
          'лава = 0\nwhile not на_финише():\n    if лава_впереди():\n        прыгнуть()\n        лава = лава + 1\n    else:\n        вперёд()\nсказать(лава)',
        ],
        best: 8,
        star3: 'first',
        gen: (r, used) => genLavaCount(r, used),
      },
      {
        id: 'v-fix',
        short: 'Почини',
        title: 'Почини счётчик',
        goal: 'Бит должен сказать, сколько раз повернул. Но программа всё время отвечает 0. Найди ошибку.',
        news: 'Где стоит «= 0», там счётчик начинается заново.',
        cmds: CMDS,
        starter: 'while not на_финише():\n    повороты = 0\n    if стена_впереди():\n        налево()\n        повороты = повороты + 1\n    else:\n        вперёд()\nсказать(повороты)\n',
        hints: [
          'Посмотри «Шагом», что происходит с переменной повороты на каждом повторе.',
          'повороты = 0 стоит внутри цикла, поэтому счётчик обнуляется на каждом повторе. Перенеси эту строку выше while.',
          'повороты = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n        повороты = повороты + 1\n    else:\n        вперёд()\nсказать(повороты)',
        ],
        best: 8,
        star3: 'first', // запуск нетронутой программы не считается
        gen: (r, used) => genTurns(r, used),
      },
      {
        id: 'v-corners',
        short: 'Таблички',
        title: 'Таблички на поворотах',
        goal: 'На старте и на каждом повороте стоит табличка: сколько шагов до следующего поворота. Дорога продолжается тупиками — иди строго по табличкам.',
        news: 'Переменную можно менять: каждый раз в неё кладётся новое число.',
        cmds: CMDS,
        starter: '# На табличках — сколько идти до поворота.\n',
        hints: [
          'На каждом повторе: прочитать табличку, пройти столько шагов, повернуть налево.',
          'Внутри while not на_финише(): n = табличка(), потом вперёд(n) и налево().',
          'while not на_финише():\n    n = табличка()\n    вперёд(n)\n    налево()',
        ],
        best: 4,
        star3: 'first',
        gen: r => genCorners(r),
      },
      {
        id: 'v-sum',
        short: 'Сумма',
        title: 'Сумма',
        goal: 'Собери все монеты, дойди до флага и скажи Хранителю, сколько было монет и лавы вместе.',
        news: 'Числа из переменных и команд можно складывать: сказать(монет_собрано() + лава).',
        cmds: CMDS,
        starter: '# Хранитель спросит: сколько монет и лавы вместе?\n',
        hints: [
          'Монеты уже считает монет_собрано(). Лаву считай своей переменной, как в задании «Счёт лавы».',
          'В начале лава = 0, в конце сказать(монет_собрано() + лава). Не забудь брать монеты по дороге.',
          'лава = 0\nwhile not на_финише():\n    if есть_монета():\n        взять()\n    if лава_впереди():\n        прыгнуть()\n        лава = лава + 1\n    else:\n        вперёд()\nсказать(монет_собрано() + лава)',
        ],
        best: 10,
        star3: 'first',
        gen: (r, used) => genSum(r, used),
      },
      {
        id: 'v-count',
        short: 'Отсчёт',
        title: 'Обратный отсчёт',
        goal: 'Флаг спрятан: на табличке написано, через сколько клеток он лежит. Прыжок через лаву — это сразу две клетки. Остановись ровно на флаге.',
        news: 'Переменную можно уменьшать: осталось = осталось - 1. А цикл — крутить, пока осталось > 0.',
        cmds: CMDS,
        starter: '# Флаг спрятан. На табличке — сколько до него клеток.\n',
        hints: [
          'Запомни число с таблички: осталось = табличка(). Повторяй, пока осталось > 0.',
          'Шаг уменьшает осталось на 1, прыжок через лаву — на 2.',
          'осталось = табличка()\nwhile осталось > 0:\n    if лава_впереди():\n        прыгнуть()\n        осталось = осталось - 2\n    else:\n        вперёд()\n        осталось = осталось - 1',
        ],
        best: 8,
        star3: 'first',
        gen: (r, used) => genCountdown(r, used),
      },
      {
        id: 'v-final',
        short: 'Финал',
        title: 'Вопрос Хранителя',
        goal: 'На табличке — сколько монет взять. Возьми ровно столько, дойди до флага и скажи, сколько раз Бит перепрыгнул лаву. Программу пиши с нуля.',
        news: 'Ничего нового: только то, что ты уже умеешь.',
        cmds: CMDS,
        starter: '# Пиши программу здесь.\n',
        hints: [
          'Нужны две переменные: сколько монет взять (с таблички) и сколько было лавы (её считаешь ты).',
          'Внутри while not на_финише(): монета — если нужно; потом лава, стена или шаг. После цикла — сказать(лава).',
          'нужно = табличка()\nлава = 0\nwhile not на_финише():\n    if есть_монета() and монет_собрано() < нужно:\n        взять()\n    if лава_впереди():\n        прыгнуть()\n        лава = лава + 1\n    elif стена_впереди():\n        налево()\n    else:\n        вперёд()\nсказать(лава)',
        ],
        best: 13,
        star3: 'first',
        gen: (r, used) => genFinal(r, used),
      },
    ],
    // Задание со звёздочкой: необязательное, для тех, кто решил урок быстро
    bonus: [
      {
        id: 'v-star',
        short: 'Рекорд',
        title: 'Самый длинный участок',
        goal: 'Хранитель спрашивает: сколько шагов в самом длинном прямом участке пути? Дойди до флага и скажи.',
        news: 'Две переменные: одна считает текущий участок, вторая помнит рекорд. Если текущий длиннее рекорда — рекорд обновляется.',
        cmds: CMDS,
        starter: '# Считает все шаги, а нужен самый длинный участок.\nшаги = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n    else:\n        вперёд()\n        шаги = шаги + 1\nсказать(шаги)\n',
        hints: [
          'На повороте участок кончается: счётчик шагов нужно обнулить. А перед этим — сравнить его с рекордом.',
          'После каждого шага: длина = длина + 1, и если длина > лучшая, то лучшая = длина. На повороте: длина = 0.',
          'длина = 0\nлучшая = 0\nwhile not на_финише():\n    if стена_впереди():\n        налево()\n        длина = 0\n    else:\n        вперёд()\n        длина = длина + 1\n        if длина > лучшая:\n            лучшая = длина\nсказать(лучшая)',
        ],
        best: 12,
        star3: 'first',
        gen: (r, used) => genLongest(r, used),
      },
    ],
  });
})();
