// Проверка сюжета и прокачки: node tests/check-story.js
//  - у каждого урока есть проводник, место, вступление и прощание (js/story.js);
//  - реплики ссылаются на существующих персонажей и не слишком длинные — их читают вслух на занятии;
//  - эффект реплики (третий элемент), если есть, описан в STORY.fx;
//  - у урока-пролога прощание — сцена, где Сбой крадёт Ключ-код (эффекты key, sboy, steal по порядку);
//  - тексты обращаются к ученику без мужского рода: не «ты прошёл», не «пиши сам» — учатся и мальчики, и девочки;
//  - каждый звук, который вызывает app.js (Sound.play('…')), есть в js/sound.js;
//  - уровни идут по возрастанию, последний достижим звёздами курса (js/gear.js);
//  - у вещей уникальные id, известные слоты, уровни в пределах списка, и каждая собирается в three.js;
//  - у каждого урока есть тема для страницы героя (topic: name, code);
//  - достижения (js/awards.js): уникальные id, счётчик есть в сводке app.js, цель достижима в курсе, тексты без мужского рода.
const fs = require('fs');
const path = require('path');
global.MiniPy = require('../js/minipy.js');
const W = global.HeroWorld = require('../js/world.js');
const LESSON_DIR = path.join(__dirname, '../js/lessons');
fs.readdirSync(LESSON_DIR).filter(f => f.endsWith('.js')).sort().forEach(f => require(path.join(LESSON_DIR, f)));
const STORY = require('../js/story.js');
const G = require('../js/gear.js');
const THREE = require('../js/three.min.js');
const AW = require('../js/awards.js');

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
AW.LIST.forEach(a => [a.name, a.desc].forEach(x => texts.push([`достижение ${a.id}`, x || '', true])));
// мост к Python: карточка урока, план репетитора и задания в консоли
const BR = require('../js/bridge.js');
Object.entries(BR.LESSONS).forEach(([id, b]) => {
  [b.text, ...(b.tutor || [])].forEach(x => texts.push([`мост ${id}`, x || '', true]));
  b.tasks.forEach(t => [t.goal, t.news, ...t.hints.slice(0, 2)].forEach(x => texts.push([t.id, x || '', true])));
});
W.LESSONS.forEach(l => {
  texts.push([l.id, l.intro || '', true]);
  l.tasks.forEach(t => [t.goal, t.news, ...t.hints.slice(0, 2)].forEach(x => texts.push([t.id, x || '', true])));
});
['world.js', 'minipy.js', 'app.js', 'bridge.js'].forEach(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8').split('\n').forEach((line, i) => {
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
  if ((it.level === undefined) === (it.price === undefined)) fail(`${it.id}: у вещи должно быть что-то одно — уровень (level) или цена в лавке (price)`);
  else if (it.price !== undefined) { if (!(Number.isInteger(it.price) && it.price > 0)) fail(`${it.id}: цена — целое число кристаллов больше нуля`); }
  else if (it.level < 2 || it.level > G.LEVELS.length) fail(`${it.id}: уровень ${it.level} вне списка уровней`);
  if (it.slot === 'color' ? !(it.colors && it.colors.length === 2) : it.colors) fail(`${it.id}: цвета (colors) бывают только у слота color, и их два`);
  if (it.slot !== 'color') {
    try {
      if (!G.build(it.id, THREE).children.length) fail(`${it.id}: 3D-модель пустая`);
    } catch (e) { fail(`${it.id}: 3D-модель не собирается: ${e.message}`); }
  }
});

// Темы курса на странице героя
W.LESSONS.forEach(l => {
  if (!l.topic || !l.topic.name || !l.topic.code) fail(`${l.id}: нет темы для страницы героя — topic: { name, code }`);
});

// Достижения: счётчик key считает app.js (heroSummary, объект A), цель должна быть достижима
const aBlock = (appSrc.match(/const A = \{([\s\S]*?)\n\s*\};/) || [])[1] || '';
const allTasks = W.LESSONS.flatMap(l => [...l.tasks, ...(l.bonus || [])]);
const reach = {
  solved: allTasks.length, noHints: allTasks.length, short: allTasks.length, first: allTasks.length,
  fixes: W.LESSONS.flatMap(l => l.tasks).filter(t => /(^|-)fix$/.test(t.id)).length,
  bonus: W.LESSONS.reduce((n, l) => n + (l.bonus || []).length, 0),
  warm: new Set(W.LESSONS.flatMap(l => l.warmup || [])).size,
  lessons: W.LESSONS.filter(l => !l.prologue).length, perfect: W.LESSONS.length,
  prolog: 1, course: 1, hw: Infinity, built: 1, days: Infinity, lines: Infinity, streak: Infinity,
  py: Object.values(require('../js/bridge.js').LESSONS).reduce((n, b) => n + b.tasks.length, 0),
};
const HUES = ['violet', 'mint', 'gold', 'coral', 'sky', 'pink'];
const aIds = new Set();
AW.LIST.forEach(a => {
  if (aIds.has(a.id)) fail(`достижение «${a.id}» повторяется`);
  aIds.add(a.id);
  if (!a.name || !a.desc || !a.icon) fail(`достижение ${a.id}: нужны name, desc и icon`);
  if (!HUES.includes(a.hue)) fail(`достижение ${a.id}: неизвестный цвет «${a.hue}»`);
  if (!new RegExp(`(^|[\\s,{])${a.key}:`).test(aBlock)) fail(`достижение ${a.id}: счётчика «${a.key}» нет в сводке app.js (heroSummary, const A)`);
  if (!(Number.isInteger(a.goal) && a.goal >= 1)) fail(`достижение ${a.id}: цель goal — целое число от 1`);
  if (!(Number.isInteger(a.gems) && a.gems > 0)) fail(`достижение ${a.id}: награда gems — целое число кристаллов больше нуля`);
  else if (reach[a.key] === undefined) fail(`достижение ${a.id}: добавь счётчик «${a.key}» в проверку достижимости (tests/check-story.js)`);
  else if (a.goal > reach[a.key]) fail(`достижение ${a.id}: цель ${a.goal} недостижима — в курсе только ${reach[a.key]}`);
});
const ev = AW.evaluate({ solved: 1 });
if (!ev[0].done || ev.some((a, i) => i && a.done && a.key !== 'solved')) fail('HeroAwards.evaluate считает неверно');
// Лавка Ады: любую вещь можно купить кристаллами за сам курс — достижения и задания со звёздочкой,
// даже без домашки и догадок
const courseGems = AW.LIST.reduce((n, a) => n + a.gems, 0) + reach.bonus * AW.GEMS.bonus;
G.SHOP.forEach(it => { if (it.price > courseGems) fail(`${it.id}: цена ${it.price} больше, чем можно заработать за курс (${courseGems})`); });
if (G.SHOP.length !== G.ITEMS.filter(it => it.price).length) fail('HeroGear.SHOP — это вещи с ценой');
if (!/<script src="js\/awards\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'))) fail('js/awards.js не подключён в index.html');

console.log(errors ? `Ошибок: ${errors}` : `Сюжет и прокачка в порядке: уроков ${W.LESSONS.length}, уровней ${G.LEVELS.length}, вещей ${G.ITEMS.length}, достижений ${AW.LIST.length}.`);
process.exit(errors ? 1 : 0);
