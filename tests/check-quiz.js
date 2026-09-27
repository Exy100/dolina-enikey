// Проверка тестов: node tests/check-quiz.js
// Для каждой папки с questions.js (например, python-collections-test/):
//  - у вопроса есть заголовок, пояснение и варианты, тип — one / many / match;
//  - ключ ответа ссылается только на существующие варианты: у one одна буква, у many — без повторов,
//    у match — буква на каждую строку и каждая буква справа использована один раз;
//  - в пояснениях нет ссылок на буквы вариантов (варианты на странице перемешиваются);
//  - `обратные кавычки` парные, оценки идут по убыванию и последняя начинается с 0.
const fs = require('fs');
const path = require('path');
const LETTERS = 'АБВГДЕЖЗ';
const root = path.join(__dirname, '..');

let fails = 0, total = 0;
const fail = (where, msg) => { fails++; console.log('  ✗ ' + where + ': ' + msg); };

for (const dir of fs.readdirSync(root).sort()) {
  const file = path.join(root, dir, 'questions.js');
  if (!fs.existsSync(file)) continue;
  const QUIZ = require(file);
  console.log(dir + '/questions.js — «' + QUIZ.title + '», вопросов: ' + QUIZ.questions.length);
  if (!QUIZ.id || !/^[a-z0-9-]+$/.test(QUIZ.id)) fail(dir, 'нужен id латиницей — он входит в ключ localStorage');

  const strings = (q) => [q.title, q.lead, q.ask, q.explain].concat(q.options || [], q.left || [], q.right || []).filter((s) => s !== undefined);
  QUIZ.questions.forEach((q, i) => {
    total++;
    const where = 'вопрос ' + (i + 1);
    const key = [...String(q.answer || '')].filter((ch) => /\S/.test(ch) && ch !== ',');
    const idx = key.map((ch) => LETTERS.indexOf(ch));
    const count = (q.type === 'match' ? q.right : q.options || []).length;
    if (!q.title) fail(where, 'нет заголовка');
    if (!q.explain) fail(where, 'нет пояснения');
    if (idx.some((k) => k < 0 || k >= count)) fail(where, 'в ответе «' + q.answer + '» есть буква вне вариантов');
    if (count > LETTERS.length) fail(where, 'вариантов больше, чем букв');
    if (q.type === 'one') {
      if (count < 2) fail(where, 'меньше двух вариантов');
      if (key.length !== 1) fail(where, 'у вопроса с одним ответом должна быть ровно одна буква');
    } else if (q.type === 'many') {
      if (count < 2) fail(where, 'меньше двух вариантов');
      if (!key.length || new Set(key).size !== key.length) fail(where, 'пустой ответ или буквы повторяются');
    } else if (q.type === 'match') {
      if (!q.left || q.left.length < 2) fail(where, 'в сопоставлении меньше двух строк');
      else if (key.length !== q.left.length) fail(where, 'в ответе ' + key.length + ' букв, а строк ' + q.left.length);
      if (new Set(key).size !== key.length || key.length !== count) fail(where, 'каждый вариант справа должен подходить ровно одной строке');
    } else fail(where, 'неизвестный тип «' + q.type + '»');
    if (/[Вв]ариант[а-яё]*\s+[АБВГДЕЖЗ](?![а-яё])|(?<![А-Яа-яЁё])[АБВГДЕЖЗ]\s*[—-]\s*\d|\d\s*[—-]\s*[АБВГДЕЖЗ](?![а-яё])/.test(q.explain || '')) {
      fail(where, 'пояснение ссылается на букву варианта, а варианты перемешиваются');
    }
    strings(q).forEach((s) => { if ((s.match(/`/g) || []).length % 2) fail(where, 'непарная ` в «' + s + '»'); });
  });

  const g = QUIZ.grades || [];
  if (!g.length || g[g.length - 1].min !== 0) fail(dir, 'последняя оценка должна начинаться с min: 0');
  if (g.some((x, i) => i && x.min >= g[i - 1].min)) fail(dir, 'оценки должны идти по убыванию min');
  if (g.some((x) => x.min > QUIZ.questions.length)) fail(dir, 'min оценки больше числа вопросов');
}

if (!total) { console.log('Не найдено ни одного questions.js'); process.exit(1); }
console.log(fails ? '\nОшибок: ' + fails : '\nВсё в порядке: вопросов проверено ' + total);
process.exit(fails ? 1 : 0);
