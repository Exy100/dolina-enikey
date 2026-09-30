/* Урок 3 «Условия»: у каждого задания три случайные карты, и без условий их не пройти */
(() => {
  const { K, randInt, blankLevel, corridor, pickLava, ALL_CMDS } = HeroWorld;

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

  // Задание со звёздочкой: повороты и лава, монет 4–6, а рюкзак вмещает только 3
  function genStar(r) {
    const L = blankLevel();
    const lens = [randInt(r, 3, 5), randInt(r, 3, 4), randInt(r, 3, 4)];
    const path = corridor(L, lens);
    const lava = pickLava(r, path, lens, 1, 2);
    lava.forEach(i => L.lava.add(K(path[i].x, path[i].z)));
    const free = [];
    for (let i = 1; i < path.length - 1; i++) if (!lava.includes(i)) free.push(i);
    let coins;
    do { coins = free.filter(() => r() < 0.45); } while (coins.length < 4 || coins.length > 6);
    coins.forEach(i => L.coins.add(K(path[i].x, path[i].z)));
    L.need = 3;
    L.sig = lens.join('') + '|' + lava.join(',') + '|' + coins.join(',');
    return L;
  }

  HeroWorld.addLesson({
    id: 'usloviya',
    title: 'Условия',
    intro: 'С этого урока долина каждый раз новая: код проверяется на трёх случайных картах. Программа «под одну карту» не пройдёт — нужны условия.',
    // Разминка в начале урока: задания из прошлых уроков на свежих картах, с нуля
    warmup: ['c-two', 'k-final'],
    tasks: [
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
        starter: '# До флага каждый раз по-разному.\nfor i in range(5):\n    вперёд()\n',
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
        goal: 'Повороты, лава и монеты на одной карте. Дойди до флага и собери все монеты. Программу пиши с нуля.',
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
    ],
    // Задание со звёздочкой: необязательное, для тех, кто решил урок быстро
    bonus: [
      {
        id: 'u-star',
        short: 'Рюкзак',
        title: 'Рюкзак на поворотах',
        goal: 'Повороты, лава и монеты — как в финале, но в рюкзак влезает только 3 монеты. Дойди до флага с тремя монетами.',
        news: 'Два условия сразу: if есть_монета() and монет_собрано() < 3 — верно, только когда верны оба.',
        cmds: ALL_CMDS,
        starter: '# Решение финала — но рюкзак здесь маленький.\nwhile not на_финише():\n    if есть_монета():\n        взять()\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()\n',
        hints: [
          'Монету можно брать, только пока в рюкзаке меньше трёх. Сколько уже взято, скажет монет_собрано().',
          'Соедини две проверки словом and:\n    if есть_монета() and монет_собрано() < 3:\n        взять()',
          'while not на_финише():\n    if есть_монета() and монет_собрано() < 3:\n        взять()\n    if стена_впереди():\n        налево()\n    elif лава_впереди():\n        прыгнуть()\n    else:\n        вперёд()',
        ],
        best: 9,
        star3: 'first',
        gen: r => genStar(r),
      },
    ],
  });
})();
