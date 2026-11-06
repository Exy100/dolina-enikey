const assert = require('assert/strict');
const fs = require('fs');
const THREE = require('../js/three.min.js');
const F = require('../js/finist.js');
const G = require('../js/gear.js');
const Sound = require('../js/sound.js');
const { root, parts } = F.build(THREE);
const find = n => root.getObjectByName(n);
assert.equal(parts.skin, 'finist');
let radius = 0, samples = 0;
const point = new THREE.Vector3();
for (const state of [{}, { moving: true }, { flying: true }, { mood: 'happy' }, { mood: 'sad' }, { event: 'check', age: .3 }, { flying: true, reduceMotion: true }]) {
  for (let n = 0; n < 40; n++) {
    F.update(root, n * .17, state); root.scale.set(1.07, .86, 1.07);
    parts.feet.forEach((f, i) => { f.position.z = f.userData.rest.p[2] + Math.sin(n + i * Math.PI) * .16; });
    root.updateMatrixWorld(true);
    root.traverseVisible(o => {
      if (!o.geometry) return;
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        assert(Number.isFinite(point.x + point.y + point.z));
        radius = Math.max(radius, Math.hypot(point.x, point.z));
        assert(radius <= .5 + 1e-6, `силуэт вышел из клетки: ${radius}`);
      }
    }); samples++;
  }
}
root.scale.setScalar(1);
F.update(root, 1, { flying: true });
assert(find('finistFalcon').visible); assert(!find('finistHuman').visible);
F.update(root, 2); assert(!find('finistFalcon').visible); assert(find('finistHuman').visible);
const direction = find('finistNeedle').rotation.z;
F.update(root, 2, { heading: Math.PI / 2 });
assert.equal(find('finistNeedle').rotation.z, direction - Math.PI / 2);
F.update(root, 2, { event: 'check', age: .3 }); assert(find('finistCompassArm').rotation.x < 0);
F.update(root, 3, { reduceMotion: true, flying: true, event: 'check', age: .3 });
const still = [find('finistNeedle').rotation.z, find('finistWingLeft').rotation.z, find('finistCompassArm').rotation.x];
F.update(root, 6, { reduceMotion: true, flying: true });
assert.deepEqual([find('finistNeedle').rotation.z, find('finistWingLeft').rotation.z, find('finistCompassArm').rotation.x], still);
assert(find('finistHuman').visible); assert(!find('finistFalcon').visible);
const clone = root.clone(true); F.update(clone, 2, { flying: true });
assert(!find('finistFalcon').visible, 'портрет не меняет основной мир');
F.reset(clone); clone.clear();
const second = F.build(THREE); second.root.children.slice().forEach(o => clone.add(o));
F.update(clone, 3, { flying: true }); assert(clone.getObjectByName('finistFalcon').visible);
assert.notEqual(parts.violet, second.parts.violet);
for (const item of G.ITEMS) assert.equal(G.fitsSkin('finist', item), ['head', 'face', 'pet'].includes(item.slot));
for (const event of ['select', 'jump', 'check', 'win', 'fail']) assert(Sound.names.includes(F.soundFor(event)));
assert.equal(F.soundFor('move'), undefined, 'нет писка на каждом шаге');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
assert(html.indexOf('src="js/finist.js"') > html.indexOf('src="js/three.min.js"'));
assert(html.indexOf('src="js/finist.js"') < html.indexOf('src="js/app.js"'));
console.log(`Финист: ${samples} поз в клетке (радиус ${radius.toFixed(3)}), полёт, компас, клоны, уменьшение движения, вещи и 5 звуков проверены.`);
