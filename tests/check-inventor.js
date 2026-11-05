// node tests/check-inventor.js — геометрия клетки, анимации, клоны, звук и совместимость вещей.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const THREE = require('../js/three.min.js');
const I = require('../js/inventor.js');
const G = require('../js/gear.js');
const Sound = require('../js/sound.js');
const { root, parts } = I.build(THREE);
assert.equal(parts.skin, 'inventor');
for (const name of ['head', 'body', 'controller', 'photon', 'photonLeft', 'photonRight']) assert(root.getObjectByName(name), name);
assert.equal(parts.feet.length, 2);

// Проверяем вершины, а не только AABB: весь силуэт помещается в окружности
// радиуса 0.5 даже при пружине приземления; это покрывает любой угол поворота.
let samples = 0, maxRadius = 0;
const v = new THREE.Vector3();
for (const state of [{}, { moving: true }, { mood: 'happy' }, { mood: 'sad' }, { event: 'check', age: 0.3 }, { event: 'take', age: 0.2 }]) {
  for (let n = 0; n < 40; n++) {
    I.update(root, n * 0.17, state);
    root.scale.set(1.07, 0.86, 1.07);
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.geometry || !o.visible) return;
      const points = o.geometry.attributes.position;
      for (let i = 0; i < points.count; i++) {
        v.fromBufferAttribute(points, i).applyMatrix4(o.matrixWorld);
        assert(Number.isFinite(v.x + v.y + v.z), 'координаты конечны');
        const radius = Math.hypot(v.x, v.z);
        maxRadius = Math.max(maxRadius, radius);
        assert(radius <= 0.5 + 1e-6, `${o.name || o.type}: выход из клетки, r=${radius}`);
      }
    });
    samples++;
  }
}
root.scale.setScalar(1);
const photon = root.getObjectByName('photon');
I.update(root, 0.3);
const idle = photon.position.toArray();
I.update(root, 0.8);
assert.notDeepEqual(photon.position.toArray(), idle, 'спутник парит');
I.update(root, 1, { moving: true });
assert.equal(root.getObjectByName('photonRight').rotation.z, 0.5, 'панели складываются в движении');
I.update(root, 1, { mood: 'happy' });
assert(root.getObjectByName('photonJoy0').visible);
assert(!root.getObjectByName('photonEye0').visible);
I.update(root, 1, { reduceMotion: true });
const still = photon.position.toArray().concat(photon.rotation.toArray());
I.update(root, 5, { reduceMotion: true });
assert.deepEqual(photon.position.toArray().concat(photon.rotation.toArray()), still, 'уменьшение движения останавливает покачивание');

// Портрет/ссылка/примерка не двигают оригинал и не делят собственные материалы.
const clone = root.clone(true);
I.update(clone, 2, { mood: 'sad' });
assert.deepEqual(photon.position.toArray().concat(photon.rotation.toArray()), still);
assert.notEqual(clone.getObjectByName('photon').position.y, photon.position.y);
const second = I.build(THREE);
assert.notEqual(parts.violet, second.parts.violet);
// Переиспользуемая группа hero получает новый облик: cache должен переопределиться.
I.reset(clone); clone.clear();
second.root.children.slice().forEach(o => clone.add(o));
I.update(clone, 3, { mood: 'happy' });
assert(clone.getObjectByName('photonJoy0').visible);

for (const it of G.ITEMS) {
  assert(G.fitsSkin('bit', it));
  assert.equal(G.fitsSkin('inventor', it), ['head', 'back'].includes(it.slot));
}
for (const event of ['select', 'check', 'win', 'fail']) assert(Sound.names.includes(I.soundFor(event)), event);
assert.equal(I.soundFor('move'), undefined, 'нет непрерывного писка при ходьбе');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(html.indexOf('src="js/inventor.js"') > html.indexOf('src="js/three.min.js"'));
assert(html.indexOf('src="js/inventor.js"') < html.indexOf('src="js/app.js"'));
console.log(`Изобретательница: ${samples} поз внутри клетки (радиус ${maxRadius.toFixed(3)}); анимации, клоны, вещи и 4 звука проверены.`);
