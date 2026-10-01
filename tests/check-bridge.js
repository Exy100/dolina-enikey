// Проверка моста к Python (js/bridge.js): node tests/check-bridge.js
//  - у каждого урока есть мост: текст, код Бита и код на Python, план для репетитора, задания;
//  - id заданий уникальны во всём курсе (и не совпадают с заданиями Бита), эталон (hints[2]) проходит все проверки
//    и печатает то, что записано в out; пример на Python запускается без ошибок;
//  - стартовый код и типичные ошибки не проходят, другие верные решения — проходят;
//  - js/bridge.js подключён в index.html после minipy.js.
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
const LESSON_DIR = path.join(__dirname, '../js/lessons');
fs.readdirSync(LESSON_DIR).filter(f => f.endsWith('.js')).sort().forEach(f => require(path.join(LESSON_DIR, f)));
const B = require('../js/bridge.js');

let errors = 0;
const fail = msg => { console.log('✗ ' + msg); errors++; };

// Типичные ошибки (не должны проходить) и другие верные решения (должны)
const WRONG = {
  'py-hello': ['print("Меня зовут Бит.")\nprint("Привет!")', 'print("Привет!")'],
  'py-route': ['print("вперёд")\nprint("налево")\nprint("взять")'],
  'py-sum3': ['print(12)', 'print("12")'],
  'py-line': ['print("********************")', 'print("*" * 2)'],
  'py-plan': ['print("вперёд вперёд вперёд")\nprint(12)', 'print("вперёд " * 3)\nprint("3 * 4")'],
  'py-count': ['for i in range(5):\n    print(i)', 'for i in range(1, 5):\n    print(i)', 'print(1)\nprint(2)\nprint(3)\nprint(4)\nprint(5)'],
  'py-ladder': ['for i in range(4):\n    print("#" * i)', 'for i in range(1, 5):\n    print("#")'],
  'py-table': ['for i in range(10):\n    print("3 *", i, "=", 3 * i)', 'for i in range(1, 11):\n    print("3 *", i, "=", 3 + i)'],
  'py-name': ['name = input()\nprint("Привет, Аня!")', 'name = input()\nprint("Привет, name!")', 'print("Привет!")'],
  'py-sign': ['n = int(input())\nif n >= 0:\n    print("плюс")\nelse:\n    print("минус")', 'n = int(input())\nif n > 0:\n    print("плюс")\nelif n < 0:\n    print("минус")'],
  'py-pass': ['p = input()\nif p == "Ключ":\n    print("Дверь открыта")\nelse:\n    print("Неверный пароль")', 'p = input()\nif p != "ключ":\n    print("Дверь открыта")\nelse:\n    print("Неверный пароль")'],
  'py-countdown': ['n = int(input())\nwhile n >= 0:\n    print(n)\n    n = n - 1\nprint("Пуск!")', 'n = int(input())\nwhile n > 0:\n    n = n - 1\n    print(n)\nprint("Пуск!")', 'n = int(input())\nfor i in range(n, 0, -1):\n    print(i)\nprint("Пуск!")'],
  'py-guess': ['answer = int(input())\nwhile answer != 7:\n    print("Нет, ещё раз")\nprint("Угадано!")', 'answer = int(input())\nif answer != 7:\n    print("Нет, ещё раз")\nprint("Угадано!")'],
  'py-double': ['x = 1\nwhile x < 100:\n    x = x * 2\n    print(x)', 'x = 1\nwhile x <= 128:\n    print(x)\n    x = x * 2'],
  'py-total': ['n = int(input())\ntotal = 0\nfor i in range(n):\n    total = total + i\nprint(total)', 'n = int(input())\nprint(15)'],
  'py-fives': ['count = 0\nfor i in range(5):\n    mark = int(input())\n    count = count + 1\nprint(count)', 'count = 0\nfor i in range(4):\n    mark = int(input())\n    if mark == 5:\n        count = count + 1\nprint(count)'],
  'py-fact': ['n = int(input())\np = 0\nfor i in range(1, n + 1):\n    p = p * i\nprint(p)', 'n = int(input())\np = 1\nfor i in range(1, n):\n    p = p * i\nprint(p)'],
  'py-greet': ['def greet(name):\n    print("Привет!")\n\ngreet("Ада")\ngreet("Бит")\ngreet("Эхо")', 'print("Привет, Ада!")\nprint("Привет, Бит!")\nprint("Привет, Эхо!")'],
  'py-square': ['def square(x):\n    print(x * x)\n\nn = int(input())\nprint(square(n))', 'n = int(input())\nprint(n * n)', 'def square(x):\n    return x * 2\n\nn = int(input())\nprint(square(n))'],
  'py-rect': ['def rect(w, h):\n    print("#" * w)\n\nrect(4, 2)\nrect(2, 3)', 'def rect(w, h):\n    for i in range(w):\n        print("#" * h)\n\nrect(4, 2)\nrect(2, 3)'],
  'py-max': ['best = 0\nfor i in range(4):\n    x = int(input())\n    if x > best:\n        best = x\nprint(best)', 'best = int(input())\nfor i in range(3):\n    x = int(input())\n    if x < best:\n        best = x\nprint(best)', 'print(max(3, 9))'],
  'py-div3': ['n = int(input())\ncount = 0\nfor i in range(n):\n    x = int(input())\n    if x == 3:\n        count = count + 1\nprint(count)', 'n = int(input())\ncount = 0\nfor i in range(n):\n    x = int(input())\n    if x % 3 == 1:\n        count = count + 1\nprint(count)'],
  'py-digits': ['n = int(input())\ntotal = 0\nwhile n > 0:\n    total = total + n % 10\nprint(total)', 'n = int(input())\ntotal = 0\nwhile n > 0:\n    total = total + n // 10\n    n = n // 10\nprint(total)'],
};
const RIGHT = {
  'py-count': ['for i in range(5):\n    print(i + 1)'],
  'py-ladder': ['for i in range(4):\n    print("#" * (i + 1))'],
  'py-name': ['name = input()\nprint("Привет,", name + "!")', 'name = input("Имя? ")\nprint("Привет, " + name + "!")'],
  'py-sign': ['n = int(input())\nif n == 0:\n    print("ноль")\nelif n > 0:\n    print("плюс")\nelse:\n    print("минус")'],
  'py-guess': ['answer = 0\nwhile answer != 7:\n    answer = int(input())\n    if answer != 7:\n        print("Нет, ещё раз")\nprint("Угадано!")'],
  'py-total': ['n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total = total + i\n    i = i + 1\nprint(total)'],
  'py-table': ['for i in range(1, 11):\n    print("3 * " + str(i) + " = " + str(3 * i))'],
  'py-max': ['best = int(input())\nfor i in range(3):\n    x = int(input())\n    if best < x:\n        best = x\nprint(best)'],
  'py-greet': ['def greet(name):\n    print("Привет,", name + "!")\n\nfor n in ["Ада", "Бит", "Эхо"]:\n    greet(n)'],
};

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const iMini = html.indexOf('src="js/minipy.js"'), iBridge = html.indexOf('src="js/bridge.js"');
if (iBridge < 0) fail('js/bridge.js не подключён в index.html');
else if (iBridge < iMini) fail('js/bridge.js нужно подключать после js/minipy.js');

const seen = new Set(W.LESSONS.flatMap(l => [...l.tasks, ...(l.bonus || [])]).map(t => t.id));
let count = 0;
W.LESSONS.forEach(l => {
  const b = B.LESSONS[l.id];
  if (!b) { fail(`у урока «${l.title}» нет моста к Python в js/bridge.js`); return; }
  ['text', 'bit', 'py'].forEach(k => { if (!b[k]) fail(`${l.id}: в мосте нет «${k}»`); });
  if (!Array.isArray(b.tutor) || b.tutor.length < 2) fail(`${l.id}: план для репетитора (tutor) — хотя бы два пункта`);
  const ex = B.run(b.py, b.pyIn || []);
  if (ex.err) fail(`${l.id}: пример на Python не запускается: ${ex.err.message}`);
  else if (!ex.out.trim()) fail(`${l.id}: пример на Python ничего не печатает`);
  if (!b.tasks || b.tasks.length < 2) fail(`${l.id}: в мосте меньше двух заданий`);
  (b.tasks || []).forEach(t => {
    count++;
    const where = `${l.id}/${t.id}`;
    if (seen.has(t.id)) fail(`${where}: id повторяется`);
    seen.add(t.id);
    if (!/^py-/.test(t.id)) fail(`${where}: id заданий в консоли начинаются с «py-»`);
    ['title', 'short', 'goal', 'news', 'starter'].forEach(k => { if (!t[k]) fail(`${where}: нет «${k}»`); });
    if (!Array.isArray(t.hints) || t.hints.length !== 3) fail(`${where}: нужны две подсказки и решение (hints)`);
    if (!Array.isArray(t.cmds) || !t.cmds.length) fail(`${where}: нет подсказок-команд (cmds)`);
    if (!Array.isArray(t.tests) || !t.tests.length) { fail(`${where}: нет проверок (tests)`); return; }
    // эталон проходит и печатает то, что записано в out
    t.tests.forEach((test, j) => {
      const r = B.run(t.hints[2], test.in || []);
      if (r.err) fail(`${where}: эталон ломается на проверке ${j + 1}: ${r.err.message}`);
      else if (r.unused) fail(`${where}: эталон не спросил ${r.unused} из ответов проверки ${j + 1}`);
      else if (test.out !== undefined && B.lines(r.out).join('\n') !== B.lines(test.out).join('\n'))
        fail(`${where}: эталон на проверке ${j + 1} печатает «${r.out.trim()}», а в out — «${test.out}»`);
    });
    if (!B.check(t, t.hints[2]).ok) fail(`${where}: эталон не проходит проверку (use?)`);
    if (B.check(t, t.starter).ok) fail(`${where}: стартовый код уже проходит`);
    (WRONG[t.id] || []).forEach((code, k) => { if (B.check(t, code).ok) fail(`${where}: неверное решение ${k + 1} проходит:\n${code}`); });
    (RIGHT[t.id] || []).forEach((code, k) => {
      const r = B.check(t, code);
      if (!r.ok) fail(`${where}: верное решение ${k + 1} не проходит (${r.use || (r.err && r.err.message) || `строка ${r.line}: «${r.got}» вместо «${r.want}»`}):\n${code}`);
    });
    if (!WRONG[t.id]) fail(`${where}: добавь типичные ошибки в WRONG (tests/check-bridge.js)`);
    // если у задания несколько проверок, ответ должен от них зависеть — иначе его можно просто напечатать
    if (t.tests.length > 1 && new Set(t.tests.map((x, j) => B.expected(t, j))).size < 2) fail(`${where}: на всех проверках один и тот же ответ`);
  });
});
Object.keys(B.LESSONS).forEach(id => { if (!W.LESSONS.some(l => l.id === id)) fail(`в js/bridge.js есть мост для несуществующего урока «${id}»`); });
Object.keys(WRONG).concat(Object.keys(RIGHT)).forEach(id => { if (!B.find(id)) fail(`в тесте упомянуто несуществующее задание «${id}»`); });

console.log(errors ? `Ошибок: ${errors}` : `Мост к Python в порядке: уроков ${Object.keys(B.LESSONS).length}, заданий в консоли ${count}.`);
process.exit(errors ? 1 : 0);
