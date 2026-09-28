/* Урок 6 «Функции»: свои приёмы через def. Проводник — Кузнец приёмов.
   Новое: def, параметры, return; датчики стена_слева() и стена_справа(). Ниши с монетами по бокам дороги —
   повторяющийся «кусок пути», который удобно оформить приёмом. */
(() => {
  const { K, randInt, blankLevel, pickLava, winding, corners, ALL_CMDS } = HeroWorld;
  const CMDS = [...ALL_CMDS, 'стена_слева()', 'стена_справа()', 'ворота_впереди()', 'открыть()', 'табличка()', 'def приём():'];

  function sample(r, arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  function fresh(r, used, a, b) {
    let v, guard = 0;
    do { v = randInt(r, a, b); } while (used && [...used].some(s => s.split('|')[0] === String(v)) && ++guard < 50);
    return v;
  }
  function spread(r, xs, k) {
    for (let guard = 0; guard < 200; guard++) {
      const got = sample(r, xs, k).sort((a, b) => a - b);
      if (got.every((x, i) => !i || x - got[i - 1] > 1)) return got;
    }
    return [xs[0]];
  }
  const line = (L, n) => { for (let x = 0; x <= n; x++) L.floor.add(K(x, 0)); };
  // Ниша — клетка сбоку от дороги с монетой: z = -1 слева от Бита (он смотрит на восток), z = 1 справа
  const niche = (L, x, z) => { L.floor.add(K(x, z)); L.coins.add(K(x, z)); };

  // Туда за монетой до стены — и обратно к флагу за стартом
  function genBack(r, used) {
    const L = blankLevel();
    const a = fresh(r, used, 3, 6), b = randInt(r, 2, 4);
    for (let x = -b; x <= a; x++) L.floor.add(K(x, 0));
    L.coins.add(K(a, 0));
    L.finish = { x: -b, z: 0 };
    L.sig = `${a}|${b}`;
    return L;
  }
  // Прямая дорога, ниши с монетами на одной стороне (side = -1 слева, 1 справа) или на обеих (0)
  function genNiches(r, side, count) {
    const L = blankLevel();
    const n = randInt(r, 8, 10);
    line(L, n);
    const xs = Array.from({ length: n - 1 }, (_, i) => i + 1);
    const sides = side ? [side] : [-1, 1];
    const got = [];
    sides.forEach(z => spread(r, xs, side ? count : randInt(r, 1, 2)).forEach(x => { niche(L, x, z); got.push(`${x}${z}`); }));
    L.finish = { x: n, z: 0 };
    L.sig = `${n}|${got.sort().join(',')}`;
    return L;
  }
  // Таблички на старте и поворотах: сколько идти до поворота; по дороге монеты
  function genSigns(r) {
    const { L, path, lens } = winding(r, randInt(r, 3, 4), 2, 5, true);
    const turn = corners(lens);
    L.signs.set(K(0, 0), lens[0]);
    lens.slice(0, -1).forEach((n, i) => {
      const at = [...turn].sort((a, b) => a - b)[i];
      L.signs.set(K(path[at].x, path[at].z), lens[i + 1]);
    });
    const free = Array.from({ length: path.length - 2 }, (_, i) => i + 1);
    sample(r, free, randInt(r, 2, 4)).forEach(i => L.coins.add(K(path[i].x, path[i].z)));
    L.sig = `${lens.join('')}|${[...L.coins].sort().join(';')}`;
    return L;
  }
  // Повороты налево и лава
  function genChoice(r) {
    const { L, path, lens } = winding(r, 3, 3, 5, true);
    const lava = pickLava(r, path, lens, 1, 3);
    lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
    L.sig = `${lens.join('')}|${lava.join(',')}`;
    return L;
  }
  // Извилистая тропа с поворотами в обе стороны — для приёма «правой руки»
  function genWinding(r) {
    const { L, lens, turns } = winding(r, randInt(r, 4, 5), 2, 4, false);
    L.sig = `${lens.join('')}|${turns.join('')}`;
    return L;
  }
  // Всё вместе: ниши с двух сторон, лава и ворота на прямой дороге
  function genFinal(r) {
    for (let guard = 0; guard < 300; guard++) {
      const L = blankLevel();
      const n = randInt(r, 11, 13);
      line(L, n);
      const lava = spread(r, Array.from({ length: n - 3 }, (_, i) => i + 2), randInt(r, 1, 2));
      const gateOk = Array.from({ length: n - 3 }, (_, i) => i + 2).filter(x => !lava.some(l => Math.abs(l - x) <= 1));
      if (!gateOk.length) continue;
      const gate = gateOk[Math.floor(r() * gateOk.length)];
      // ниши — не у лавы (через неё Бит перепрыгивает) и не прямо перед воротами (там он стоит дважды)
      const nicheOk = Array.from({ length: n - 1 }, (_, i) => i + 1).filter(x => !lava.includes(x) && x !== gate - 1);
      const left = spread(r, nicheOk, randInt(r, 1, 2)), right = spread(r, nicheOk, 1);
      lava.forEach(x => L.lava.add(K(x, 0)));
      L.gates.add(K(gate, 0));
      left.forEach(x => niche(L, x, -1));
      right.forEach(x => niche(L, x, 1));
      L.finish = { x: n, z: 0 };
      L.sig = `${n}|${lava.join(',')}|${gate}|${left.join(',')}|${right.join(',')}`;
      return L;
    }
  }

  const TURN = 'def развернуться():\n    налево()\n    налево()\n';
  const LEFT = 'def ниша_слева():\n    налево()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    налево()\n';
  const RIGHT = 'def ниша_справа():\n    направо()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    направо()\n';

  HeroWorld.addLesson({
    id: 'funkcii',
    title: 'Функции',
    intro: 'Свой приём пишут один раз через def, а используют сколько угодно — просто по имени, со скобками.',
    tasks: [
      {
        id: 'f-back',
        short: 'Обратно',
        title: 'Приём «развернуться»',
        goal: 'Сходи за монетой к стене, развернись и иди к флагу — он за стартом. Приём развернуться() Кузнец уже выковал.',
        news: 'def имя(): — свой приём. Строки с отступом под ним выполняются, когда пишешь имя().',
        cmds: ['вперёд()', 'взять()', 'развернуться()', 'стена_впереди()', 'на_финише()'],
        starter: TURN + '\nwhile not стена_впереди():\n    вперёд()\nвзять()\n',
        hints: [
          'Приём уже есть — вызови его: развернуться(). Со скобками, как обычную команду.',
          'После взять() — развернуться(), а потом второй while до флага.',
          TURN + '\nwhile not стена_впереди():\n    вперёд()\nвзять()\nразвернуться()\nwhile not на_финише():\n    вперёд()',
        ],
        best: 9,
        star3: 'first',
        gen: (r, used) => genBack(r, used),
      },
      {
        id: 'f-niche',
        short: 'Ниши',
        title: 'Ниши слева',
        goal: 'Слева от дороги ниши, в каждой монета. Собери все и дойди до флага. Где ниши — каждый раз по-разному.',
        news: 'стена_слева() — есть ли стена слева от Бита. Нет стены — значит, там ниша.',
        cmds: ['вперёд()', 'налево()', 'взять()', 'развернуться()', 'стена_слева()', 'на_финише()'],
        starter: TURN + '\ndef ниша():\n    налево()\n    вперёд()\n    взять()\n    # как вернуться на дорогу?\n\nwhile not на_финише():\n    if not стена_слева():\n        ниша()\n    вперёд()\n',
        hints: [
          'После взять() Бит стоит в нише лицом к стене. Ему нужно вернуться на дорогу и снова смотреть вперёд, на восток.',
          'Развернуться, шагнуть обратно на дорогу и повернуть налево.',
          TURN + '\ndef ниша():\n    налево()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    налево()\n\nwhile not на_финише():\n    if not стена_слева():\n        ниша()\n    вперёд()',
        ],
        best: 15,
        star3: 'first',
        gen: r => genNiches(r, -1, randInt(r, 2, 3)),
      },
      {
        id: 'f-param',
        short: 'Параметр',
        title: 'Приём с числом',
        goal: 'На старте и на поворотах таблички: сколько идти до поворота. По дороге монеты. Собери их и дойди до флага.',
        news: 'У приёма бывают параметры: def пройти(n): — внутри n равно числу, которое передали в скобках.',
        cmds: CMDS,
        starter: '# Допиши приём: n шагов, по пути собрать монеты.\ndef пройти(n):\n    pass\n\nwhile not на_финише():\n    пройти(табличка())\n    налево()\n',
        hints: [
          'pass значит «ничего не делать». Замени его на цикл из n шагов.',
          'Внутри приёма: for i in range(n): шаг и, если есть монета, взять её.',
          'def пройти(n):\n    for i in range(n):\n        вперёд()\n        if есть_монета():\n            взять()\n\nwhile not на_финише():\n    пройти(табличка())\n    налево()',
        ],
        best: 8,
        star3: 'first',
        gen: r => genSigns(r),
      },
      {
        id: 'f-fix',
        short: 'Почини',
        title: 'Почини приём',
        goal: 'Теперь ниши справа. Приём ниша() почему-то уводит Бита назад. Найди ошибку.',
        news: 'Приём может звать другой приём: внутри ниша() работает развернуться().',
        cmds: CMDS,
        starter: TURN + '\ndef ниша():\n    направо()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    налево()\n\nwhile not на_финише():\n    if not стена_справа():\n        ниша()\n    вперёд()\n',
        hints: [
          'Пройди «Шагом» первую нишу и посмотри, куда смотрит Бит, когда вернулся на дорогу.',
          'Из ниши Бит выходит лицом на север. Чтобы снова смотреть на восток, нужен поворот направо, а не налево.',
          TURN + '\ndef ниша():\n    направо()\n    вперёд()\n    взять()\n    развернуться()\n    вперёд()\n    направо()\n\nwhile not на_финише():\n    if not стена_справа():\n        ниша()\n    вперёд()',
        ],
        best: 15,
        star3: 'first', // запуск нетронутой программы не считается
        gen: r => genNiches(r, 1, randInt(r, 2, 3)),
      },
      {
        id: 'f-return',
        short: 'Ответ',
        title: 'Приём-вопрос',
        goal: 'Дорога с поворотами и лавой. Программа уже зовёт приём можно_идти(), но его ещё нет. Напиши его.',
        news: 'return — ответ приёма. Такой приём можно спрашивать в if, как стена_впереди().',
        cmds: CMDS,
        starter: 'while not на_финише():\n    if можно_идти():\n        вперёд()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        налево()\n',
        hints: [
          'Идти можно, когда впереди нет стены и нет лавы.',
          'def можно_идти():\n    return not стена_впереди() and not лава_впереди()',
          'def можно_идти():\n    return not стена_впереди() and not лава_впереди()\n\nwhile not на_финише():\n    if можно_идти():\n        вперёд()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        налево()',
        ],
        best: 9,
        star3: 'first',
        gen: r => genChoice(r),
      },
      {
        id: 'f-both',
        short: 'Две стороны',
        title: 'Ниши с двух сторон',
        goal: 'Ниши теперь и слева, и справа. Собери все монеты и дойди до флага.',
        news: 'Приёмов может быть сколько угодно, и все они могут звать друг друга.',
        cmds: CMDS,
        starter: TURN + '\n# Ниши и слева, и справа.\n',
        hints: [
          'Нужны два приёма: ниша_слева() и ниша_справа(). Оба используют развернуться().',
          'В цикле: если слева нет стены — ниша_слева(); если справа нет стены — ниша_справа(); потом шаг.',
          TURN + '\n' + LEFT + '\n' + RIGHT + '\nwhile not на_финише():\n    if not стена_слева():\n        ниша_слева()\n    if not стена_справа():\n        ниша_справа()\n    вперёд()',
        ],
        best: 25,
        star3: 'first',
        gen: r => genNiches(r, 0),
      },
      {
        id: 'f-hand',
        short: 'Рука',
        title: 'Приём правой руки',
        goal: 'Тропа поворачивает то налево, то направо. Кузнец подсказывает приём: «держись правой рукой за стену». Допиши его.',
        news: 'Правило правой руки: справа проход — поверни направо и шагни; иначе впереди свободно — шагни; иначе поверни налево.',
        cmds: CMDS,
        starter: 'def шаг():\n    if not стена_справа():\n        направо()\n        вперёд()\n    # а если справа стена?\n\nwhile not на_финише():\n    шаг()\n',
        hints: [
          'Если справа стена, остаются два варианта: впереди свободно или впереди тоже стена.',
          'Добавь в приём: elif not стена_впереди(): вперёд(), а иначе — налево().',
          'def шаг():\n    if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()\n\nwhile not на_финише():\n    шаг()',
        ],
        best: 10,
        star3: 'first',
        gen: r => genWinding(r),
      },
      {
        id: 'f-final',
        short: 'Финал',
        title: 'Заказ Кузнеца',
        goal: 'Ниши с двух сторон, лава и ворота. Собери все монеты и дойди до флага. Программу пиши сам — с приёмами короче.',
        news: 'Ничего нового: только то, что ты уже умеешь.',
        cmds: CMDS,
        starter: '# Пиши программу здесь.\n',
        hints: [
          'Возьми приёмы из задания «Ниши с двух сторон» и добавь в цикл ворота и лаву.',
          'В цикле: сначала ниши слева и справа, потом выбор: ворота — открыть(), лава — прыгнуть(), иначе — вперёд().',
          TURN + '\n' + LEFT + '\n' + RIGHT + '\nwhile not на_финише():\n    if not стена_слева():\n        ниша_слева()\n    if not стена_справа():\n        ниша_справа()\n    if ворота_впереди():\n        открыть()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
        ],
        best: 29,
        star3: 'first',
        gen: r => genFinal(r),
      },
    ],
  });
})();
