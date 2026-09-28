// Проверка сюжета и прокачки: node tests/check-story.js
//  - у каждого урока есть проводник, место, вступление и прощание (js/story.js);
//  - реплики ссылаются на существующих персонажей и не слишком длинные — их читают вслух на занятии;
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
  lines.forEach(([who, text], i) => {
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
Object.keys(STORY.lessons).forEach(id => {
  if (!W.LESSONS.some(l => l.id === id)) fail(`в js/story.js есть сюжет для несуществующего урока «${id}»`);
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
