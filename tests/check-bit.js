// Проверяет геометрию новой базовой модели и независимый привод двух гусениц.
const assert = require('assert/strict');
const fs = require('fs');
const THREE = require('../js/three.min.js');
const B = require('../js/bit.js');
const G = require('../js/gear.js');
const { root, parts } = B.build(THREE);
assert.equal(parts.skin, 'bit');
assert.equal(parts.feet.length, 0, 'ленты не должны шагать как ноги');
assert.equal(parts.body.geometry.type, 'ExtrudeGeometry', 'корпус с плоскими гранями');
const left = root.getObjectByName('bitTrackLeft'), right = root.getObjectByName('bitTrackRight');
const links = group => group.children.filter(o => o.name === 'bitTread');
const wheel = group => group.getObjectByName('bitWheel');
const pose = group => links(group).flatMap(o => o.position.toArray().concat(o.rotation.x));
const initial = pose(left);
B.advance(root, .1, .1);
assert.notDeepEqual(pose(left), initial);
assert.deepEqual(pose(left), pose(right), 'прямой ход синхронизирует ленты');
B.advance(root, .05, -.05);
assert.notDeepEqual(pose(left), pose(right), 'разворот — встречное вращение');
const stopped = pose(left), wheelAngle = wheel(left).rotation.x;
for (let t = 0; t < 10; t++) B.update(root, t);
assert.deepEqual(pose(left), stopped, 'в покое лента неподвижна');
assert.equal(wheel(left).rotation.x, wheelAngle);
// Один метр за любое число кадров даёт одинаковое положение лент и колёс.
const fast = B.build(THREE).root, slow = B.build(THREE).root;
B.advance(fast, 1, 1);
for (let i = 0; i < 100; i++) B.advance(slow, .01, .01);
pose(fast.getObjectByName('bitTrackLeft')).forEach((v,i) => assert(Math.abs(v-pose(slow.getObjectByName('bitTrackLeft'))[i])<1e-10));
assert(Math.abs(wheel(fast.getObjectByName('bitTrackLeft')).rotation.x-wheel(slow.getObjectByName('bitTrackLeft')).rotation.x)<1e-10);
const point = new THREE.Vector3(); let maxRadius = 0, triangles = 0;
root.traverse(o => { if (o.geometry) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count)/3; });
assert(triangles < 9000, `бюджет геометрии: ${triangles}`);
for (const state of [{}, {mood:'happy'}, {mood:'sad'}, {event:'check',age:.3}, {event:'take',age:.3}, {event:'open',age:.3}]) {
  for (let i = 0; i < 40; i++) {
    B.advance(root,.023,i%2?.023:-.023); B.update(root,i*.17,state);
    root.scale.set(1.07,.86,1.07); root.updateMatrixWorld(true);
    root.traverseVisible(o => {
      if (!o.geometry) return;
      const p = o.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);
        assert(Number.isFinite(point.x+point.y+point.z));
        maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));
        assert(maxRadius<=.5, `выход за клетку: ${o.name} ${maxRadius}`);
      }
    });
  }
}
root.scale.setScalar(1);
const before=pose(left), clone=root.clone(true);
B.advance(clone,.4,-.4); B.update(clone,1,{mood:'happy'});
assert.deepEqual(pose(left),before,'копия не двигает оригинал');
B.reset(clone); clone.clear(); B.build(THREE).root.children.slice().forEach(o=>clone.add(o));
B.advance(clone,.1,.1); assert.notDeepEqual(pose(clone.getObjectByName('bitTrackLeft')),initial);
B.update(root,1,{reduceMotion:true,event:'check',age:.3});
const still=root.getObjectByName('bitArmLeft').rotation.toArray();
B.update(root,3,{reduceMotion:true});
assert.deepEqual(root.getObjectByName('bitArmLeft').rotation.toArray(),still);
for (const item of G.ITEMS) assert(G.fitsSkin('bit',item),'все прежние вещи доступны');
assert.notEqual(B.build(THREE).parts.violet,parts.violet,'материалы отдельные');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
assert(html.indexOf('src="js/bit.js"')>html.indexOf('src="js/three.min.js"'));
assert(html.indexOf('src="js/bit.js"')<html.indexOf('src="js/app.js"'));
console.log(`Бит: 240 поз в клетке (радиус ${maxRadius.toFixed(3)}), ${triangles} треугольников, привод лент, поворот, остановка, клоны и вещи проверены.`);
