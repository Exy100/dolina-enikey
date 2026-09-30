/* Урок 7 «Лабиринт»: финал курса в Замке Сбоя. Проводник — Ада. Великий Сбой — её первая программа с ошибкой:
   в последнем задании Бит добирается до него, и Сбой оказывается починен (сюжет — в js/story.js).
   Лабиринты случайные и без петель, поэтому их проходит правило правой (или левой) руки.
   С 3-го задания Бит понимает только английские команды (english: true) — мост к обычному Python.
   Анимация в лабиринте долгая, поэтому fast: 3 — задания идут втрое быстрее. */
(() => {
  const { K, maze, handWalk } = HeroWorld;
  const RU = ['вперёд()', 'налево()', 'направо()', 'взять()', 'стена_впереди()', 'стена_справа()', 'стена_слева()', 'есть_монета()', 'на_финише()'];
  const EN = ['move()', 'turn_left()', 'turn_right()', 'take()', 'wall_in_front()', 'wall_on_right()', 'wall_on_left()', 'coin_here()', 'at_goal()', 'say()'];

  function sample(r, arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  // Тупики, куда правило руки (hand: 3 — правая, 1 — левая) заводит Бита до флага, кроме старта
  function reached(L, hand) {
    const seen = new Set(handWalk(L, hand));
    const s = K(L.start.x, L.start.z);
    return L.deadEnds.filter(k => seen.has(k) && k !== s && k !== K(L.finish.x, L.finish.z));
  }
  // Лабиринт w × h; english — только английские команды; coins — сколько монет разложить по тупикам
  function genMaze(r, w, h, opts = {}) {
    for (let guard = 0; guard < 300; guard++) {
      const L = maze(r, w, h);
      if (opts.coins) {
        const ok = reached(L, 3);
        if (ok.length < 1) continue;
        sample(r, ok, Math.min(opts.coins, ok.length)).forEach(k => L.coins.add(k));
      }
      Object.assign(L, opts.extra || {});
      return L;
    }
  }
  // Монеты там, куда ведёт только левая рука: правая дойдёт до флага раньше и пропустит их
  function genLeft(r) {
    for (let guard = 0; guard < 500; guard++) {
      const L = maze(r, 4, 4);
      const left = reached(L, 1), right = new Set(reached(L, 3));
      const only = left.filter(k => !right.has(k));
      if (!only.length) continue;
      const coins = new Set([only[Math.floor(r() * only.length)], ...sample(r, left, 1)]);
      coins.forEach(k => L.coins.add(k));
      L.english = true;
      return L;
    }
  }

  const RULE_RU = 'while not на_финише():\n    if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()';
  const RULE_EN = 'while not at_goal():\n    if not wall_on_right():\n        turn_right()\n        move()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_left()';

  HeroWorld.addLesson({
    id: 'labirint',
    title: 'Лабиринт',
    intro: 'Лабиринт каждый раз новый. Держись правой рукой за стену — и дойдёшь до выхода. С третьего задания Бит понимает только английские команды.',
    tasks: [
      {
        id: 'l-right',
        short: 'Рука',
        title: 'Правая рука',
        goal: 'Лабиринт каждый раз новый. Доведи Бита до флага по правилу правой руки.',
        news: 'Правило правой руки: справа проход — поверни направо и шагни; иначе впереди свободно — шагни; иначе поверни налево.',
        cmds: RU,
        starter: '# Бит поворачивает только налево — и блуждает.\nwhile not на_финише():\n    if not стена_впереди():\n        вперёд()\n    else:\n        налево()\n',
        hints: [
          'Правая рука всё время касается стены. Если справа появился проход — Бит сворачивает туда.',
          'Добавь первой проверку справа:\n    if not стена_справа():\n        направо()\n        вперёд()',
          RULE_RU,
        ],
        best: 8,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 3, 3),
      },
      {
        id: 'l-coins',
        short: 'Тупики',
        title: 'Монеты в тупиках',
        goal: 'В тупиках лабиринта лежат монеты. Собери все и дойди до флага.',
        news: 'Правило руки заводит Бита во все тупики по дороге — монеты там и лежат.',
        cmds: RU,
        starter: RULE_RU + '\n',
        hints: [
          'Правило уже работает. Осталось на каждом повторе проверять монету.',
          'Первой строкой внутри while: if есть_монета(): взять()',
          'while not на_финише():\n    if есть_монета():\n        взять()\n    if not стена_справа():\n        направо()\n        вперёд()\n    elif not стена_впереди():\n        вперёд()\n    else:\n        налево()',
        ],
        best: 10,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 3, 4, { coins: 2 }),
      },
      {
        id: 'l-english',
        short: 'English',
        title: 'По-английски',
        goal: 'Сбой перепутал команды: в замке Бит понимает только английские. Перепиши правило правой руки по-английски.',
        news: 'move() — вперёд(), turn_left() — налево(), turn_right() — направо(), wall_in_front() — стена_впереди(), wall_on_right() — стена_справа(), at_goal() — на_финише().',
        cmds: EN,
        starter: RULE_RU + '\n',
        hints: [
          'Логика та же, меняются только имена команд. if, while, not и else и так английские.',
          'на_финише() → at_goal(), стена_справа() → wall_on_right(), направо() → turn_right(), вперёд() → move().',
          RULE_EN,
        ],
        best: 8,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 3, 3, { extra: { english: true } }),
      },
      {
        id: 'l-fix',
        short: 'Fix',
        title: 'Почини правило',
        goal: 'В этой программе Бит крутится на месте. Найди ошибку.',
        news: 'Повернуть — ещё не шагнуть. После поворота направо нужен шаг.',
        cmds: EN,
        starter: 'while not at_goal():\n    if not wall_on_right():\n        turn_right()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_left()\n',
        hints: [
          'Пройди «Шагом» место, где справа проход. Что Бит делает после поворота направо?',
          'После turn_right() Бит сразу снова проверяет правую сторону — и снова поворачивает. Добавь move() сразу после turn_right().',
          RULE_EN,
        ],
        best: 8,
        star3: 'first', // запуск нетронутой программы не считается
        fast: 3,
        gen: r => genMaze(r, 3, 4, { extra: { english: true } }),
      },
      {
        id: 'l-steps',
        short: 'Steps',
        title: 'Счёт шагов',
        goal: 'Сбой не верит, что Бит прошёл лабиринт. Дойди до флага и скажи, сколько шагов сделал Бит.',
        news: 'say(x) — это сказать(x). steps += 1 — то же, что steps = steps + 1.',
        cmds: EN,
        starter: '# Посчитай шаги: сколько раз был move().\n',
        hints: [
          'Заведи steps = 0 и прибавляй единицу после каждого move(). В конце — say(steps).',
          'move() в правиле встречается дважды — считать нужно в обоих местах.',
          'steps = 0\nwhile not at_goal():\n    if not wall_on_right():\n        turn_right()\n        move()\n        steps += 1\n    elif not wall_in_front():\n        move()\n        steps += 1\n    else:\n        turn_left()\nsay(steps)',
        ],
        best: 12,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 3, 4, { extra: { english: true, stop: true, answer: 'steps' } }),
      },
      {
        id: 'l-left',
        short: 'Left',
        title: 'Левая рука',
        goal: 'Сбой спрятал монету в тупик, куда правая рука не ведёт. Пройди лабиринт левой рукой и собери все монеты.',
        news: 'Правило левой руки — зеркальное: слева проход — налево и шаг; иначе впереди свободно — шаг; иначе направо.',
        cmds: EN,
        starter: '# Правая рука пропустит монету. Нужна левая.\n',
        hints: [
          'Возьми правило правой руки и поменяй в нём право на лево, а лево на право.',
          'wall_on_right() → wall_on_left(), turn_right() → turn_left(), а в самом конце — turn_right(). И не забудь монеты.',
          'while not at_goal():\n    if coin_here():\n        take()\n    if not wall_on_left():\n        turn_left()\n        move()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_right()',
        ],
        best: 10,
        star3: 'first',
        fast: 3,
        gen: r => genLeft(r),
      },
      {
        id: 'l-broken',
        short: 'Broken',
        title: 'Сломанный поворот',
        goal: 'Сбой сломал turn_right()! Сделай свой приём с таким же именем из трёх поворотов налево — и пройди лабиринт.',
        news: 'Свой приём с именем команды заменяет её: def turn_right(): — и сломанная команда снова работает.',
        cmds: EN,
        starter: RULE_EN + '\n',
        hints: [
          'Три поворота налево — это то же самое, что один поворот направо.',
          'Напиши в начале программы:\ndef turn_right():\n    turn_left()\n    turn_left()\n    turn_left()',
          'def turn_right():\n    turn_left()\n    turn_left()\n    turn_left()\n\n' + RULE_EN,
        ],
        best: 12,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 3, 4, { extra: { english: true, broken: ['turn_right'] } }),
      },
      {
        id: 'l-boss',
        short: 'Сбой',
        title: 'Великий Сбой',
        goal: 'Сердце замка: в центре лабиринта ждёт Великий Сбой, там и прячется его ошибка. Собери монеты в тупиках и доберись до него. Программу пиши с нуля, по-английски.',
        news: 'Ничего нового: только то, что ты уже умеешь.',
        cmds: EN,
        starter: '# Пиши программу здесь. Только английские команды.\n',
        hints: [
          'Правило правой руки и проверка монеты на каждом повторе — как в задании «Монеты в тупиках», только по-английски.',
          'Первой строкой внутри while: if coin_here(): take()',
          'while not at_goal():\n    if coin_here():\n        take()\n    if not wall_on_right():\n        turn_right()\n        move()\n    elif not wall_in_front():\n        move()\n    else:\n        turn_left()',
        ],
        best: 10,
        star3: 'first',
        fast: 3,
        gen: r => genMaze(r, 4, 3, { coins: 3, extra: { english: true, boss: true } }),
      },
    ],
  });
})();
