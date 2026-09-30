// Проверка сюжета и прокачки: node tests/check-story.js
//  - у каждого урока есть проводник, место, вступление и прощание (js/story.js);
//  - реплики ссылаются на существующих персонажей и не слишком длинные — их читают вслух на занятии;
//  - эффект реплики (третий элемент), если есть, описан в STORY.fx;
//  - у урока-пролога прощание — сцена, где Сбой крадёт Ключ-код (эффекты key, sboy, steal по порядку);
//  - тексты обращаются к ученику без мужского рода: не «ты прошёл», не «пиши сам» — учатся и мальчики, и девочки;
//  - каждый звук, который вызывает app.js (Sound.play('…')), есть в js/sound.js;
//  - уровни идут по возрастанию, последний достижим звёздами курса (js/gear.js);
//  - у вещей уникальные id, известные слоты, уровни в пределах списка, и каждая собирается в three.js.
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
const LESSON_DIR = path.join(__dirname, '../js/lessons');
fs.readdirSync(LESSON_DIR).filter(f => f.endsWith('.js')).sort().forEach(f => require(path.join(LESSON_DIR, f)));
const STORY = require('../js/story.js');
const G = require('../js/gear.js');
const THREE = require('../js/three.min.js');

let errors = 0;
const fail = msg => { console.log('✗ ' + msg); errors++; };
const MAX_LINE = 160;

function checkLines(lines, where) {
  if (!Array.isArray(lines) || !lines.length) { fail(`${where}: нет реплик`); return; }
  lines.forEach(([who, text, fx], i) => {
    if (fx !== undefined && !(STORY.fx && STORY.fx[fx])) fail(`${where}, реплика ${i + 1}: неизвестный эффект «${fx}» (опиши его в STORY.fx и в app.js)`);
    if (!STORY.people[who]) fail(`${where}, реплика ${i + 1}: неизвестный персонаж «${who}»`);
    if (!text || !text.trim()) fail(`${where}, реплика ${i + 1}: пустой текст`);
    else if (text.length > MAX_LINE) fail(`${where}, реплика ${i + 1}: ${text.length} знаков, а можно не больше ${MAX_LINE}`);
  });
}

checkLines(STORY.prologue, 'пролог');
W.LESSONS.forEach(l => {
  const s = STORY.lessons[l.id];
  if (!s) { fail(`у урока «${l.title}» (${l.id}) нет сюжета в js/story.js`); return; }
  if (!STORY.people[s.guide]) fail(`${l.id}: проводник «${s.guide}» не найден среди персонажей`);
  if (!s.place) fail(`${l.id}: не указано место квеста (place)`);
  checkLines(s.intro, `${l.id}: вступление`);
  checkLines(s.outro, `${l.id}: прощание`);
});
const pro = W.LESSONS.filter(l => l.prologue);
if (pro.length !== 1 || W.LESSONS[0] !== pro[0]) fail('пролог должен быть один и идти первым уроком');
else {
  const fx = ((STORY.lessons[pro[0].id] || {}).outro || []).map(l => l[2]).filter(Boolean).join(' ');
  if (fx !== 'key sboy steal') fail(`прощание пролога: ждали эффекты key, sboy, steal по порядку, а там «${fx}»`);
}
Object.keys(STORY.lessons).forEach(id => {
  if (!W.LESSONS.some(l => l.id === id)) fail(`в js/story.js есть сюжет для несуществующего урока «${id}»`);
});

// Мужской род в обращении к ученику: «ты (не) сделал» и «сам» в текстах заданий.
// Проверяем реплики, тексты уроков и строки с сообщениями в коде (комментарии пропускаем).
const MASC = /(^|[^а-яё])ты\s+(?:[а-яё]+\s+)?[а-яё]+(?:л|лся)(?![а-яё])/i, SAM = /(^|[^а-яё])сам(?![а-яё])/i;
const texts = [];
[STORY.prologue, ...Object.values(STORY.lessons).flatMap(s => [s.intro, s.outro])].forEach(ls => (ls || []).forEach(([, t]) => texts.push(['сюжет', t, false])));
W.LESSONS.forEach(l => {
  texts.push([l.id, l.intro || '', true]);
  l.tasks.forEach(t => [t.goal, t.news, ...t.hints.slice(0, 2)].forEach(x => texts.push([t.id, x || '', true])));
});
['world.js', 'minipy.js', 'app.js'].forEach(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8').split('\n').forEach((line, i) => {
  if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
  texts.push([`${f}:${i + 1}`, line.replace(/\/\/.*$/, ''), false]);
}));
texts.forEach(([where, t, lessonText]) => {
  const m = t.match(MASC) || (lessonText && t.match(SAM));
  if (m) fail(`${where}: мужской род в обращении к ученику — «${m[0].trim()}». Перепиши нейтрально`);
});

// Звуки: всё, что вызывает интерфейс, есть в sound.js
const Sound = require('../js/sound.js');
const appSrc = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
[...new Set([...appSrc.matchAll(/Sound\.play\('([^']+)'/g)].map(m => m[1]))].forEach(n => {
  if (!Sound.names.includes(n)) fail(`app.js зовёт звук «${n}», а в js/sound.js его нет`);
});

const maxStars = W.LESSONS.reduce((n, l) => n + l.tasks.length * 3, 0);
if (G.LEVELS[0].stars !== 0) fail('первый уровень должен начинаться с 0 звёзд');
G.LEVELS.forEach((l, i) => { if (i && l.stars <= G.LEVELS[i - 1].stars) fail(`уровень ${i + 1}: звёзд должно быть больше, чем у уровня ${i}`); });
if (G.LEVELS[G.LEVELS.length - 1].stars > maxStars) fail(`последний уровень недостижим: нужно ${G.LEVELS[G.LEVELS.length - 1].stars} звёзд, а в курсе ${maxStars}`);
if (G.levelFor(0) !== 1 || G.levelFor(maxStars) !== G.LEVELS.length) fail('levelFor считает уровни неверно');

const ids = new Set();
G.ITEMS.forEach(it => {
  if (ids.has(it.id)) fail(`вещь «${it.id}» повторяется`);
  ids.add(it.id);
  if (!G.SLOTS[it.slot]) fail(`${it.id}: неизвестный слот «${it.slot}»`);
  if (it.level < 2 || it.level > G.LEVELS.length) fail(`${it.id}: уровень ${it.level} вне списка уровней`);
  if (it.slot === 'color' ? !(it.colors && it.colors.length === 2) : it.colors) fail(`${it.id}: цвета (colors) бывают только у слота color, и их два`);
  if (it.slot !== 'color') {
    try {
      if (!G.build(it.id, THREE).children.length) fail(`${it.id}: 3D-модель пустая`);
    } catch (e) { fail(`${it.id}: 3D-модель не собирается: ${e.message}`); }
  }
});

console.log(errors ? `Ошибок: ${errors}` : `Сюжет и прокачка в порядке: уроков ${W.LESSONS.length}, уровней ${G.LEVELS.length}, вещей ${G.ITEMS.length}.`);
process.exit(errors ? 1 : 0);
