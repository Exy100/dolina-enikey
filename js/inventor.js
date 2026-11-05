/* Изобретательница и «Фотон»: процедурная модель без файлов и текстур.
   Координаты лица совместимы с анимациями app.js. Спутник — часть облика,
   а не второй участник карты. Состояние анимации передаётся снаружи. */
const HeroInventor = (() => {
  const cache = new WeakMap();
  const soundFor = event => ({ select: 'photonHello', check: 'photonScan', win: 'photonWin', fail: 'photonFail' })[event];

  function build(THREE) {
    const root = new THREE.Group();
    root.name = 'inventor';
    const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, flatShading: true, ...extra });
    const brown = mat(0x70442e, { flatShading: false }), skin = mat(0xffc49a, { flatShading: false }), hairMat = mat(0x543128);
    const iris = mat(0x3a231b, { flatShading: false }), blush = mat(0xeaa080, { flatShading: false });
    const black = mat(0x292630), cream = mat(0xffefd5), red = mat(0xd94732);
    const metal = mat(0x929bad), amber = mat(0xffc43b, { emissive: 0xff9d00, emissiveIntensity: 0.3 });
    const add = (geo, m, x, y, z, parent = root, name = '') => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z); o.name = name; o.castShadow = true;
      parent.add(o); return o;
    };
    const box = (w, h, d, m, x, y, z, parent, name) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, name);
    const ball = (r, m, x, y, z, parent, name) => add(new THREE.SphereGeometry(r, 20, 14), m, x, y, z, parent, name);
    const rest = (o, visible = true) => {
      o.visible = visible;
      o.userData.rest = { p: o.position.toArray(), s: o.scale.toArray(), r: o.rotation.toArray().slice(0, 3), v: visible };
      return o;
    };
    // Скруглённые объёмы с небольшими фасками, как на утверждённом концепте.
    const bevelBox = (w, h, d, bevel, m, x, y, z, parent = root, name = '') => {
      const shape = new THREE.Shape(), hw = w / 2 - bevel, hh = h / 2 - bevel, r = Math.min(bevel, hw, hh);
      shape.moveTo(-hw + r, -hh); shape.lineTo(hw - r, -hh);
      shape.quadraticCurveTo(hw, -hh, hw, -hh + r); shape.lineTo(hw, hh - r);
      shape.quadraticCurveTo(hw, hh, hw - r, hh); shape.lineTo(-hw + r, hh);
      shape.quadraticCurveTo(-hw, hh, -hw, hh - r); shape.lineTo(-hw, -hh + r);
      shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * bevel, bevelEnabled: true,
        bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 3 });
      geo.translate(0, 0, -d / 2 + bevel);
      return add(geo, m, x, y, z, parent, name);
    };
    const oval = (r, scale, m, x, y, z, parent = root, name = '') => {
      const o = ball(r, m, x, y, z, parent, name); o.scale.set(...scale); return o;
    };
    const limb = (from, to, radius, m, parent) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
      const o = add(new THREE.CylinderGeometry(radius, radius * 1.04, delta.length(), 12), m, 0, 0, 0, parent);
      o.position.copy(a.add(b).multiplyScalar(0.5));
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return o;
    };
    // Отдельные лиф и юбка дают талию; чулки видны ниже подола.
    const body = add(new THREE.CylinderGeometry(0.127, 0.115, 0.17, 20), brown, 0, 0.415, 0, root, 'body');
    add(new THREE.CylinderGeometry(0.115, 0.183, 0.18, 20), brown, 0, 0.25, 0);
    add(new THREE.CylinderGeometry(0.12, 0.177, 0.155, 20, 1, true, -1.04, 2.08), black, 0, 0.255, 0.012);
    bevelBox(0.19, 0.16, 0.028, 0.008, black, 0, 0.413, 0.108, root, 'apronBib');
    add(new THREE.CylinderGeometry(0.124, 0.124, 0.024, 20), black, 0, 0.337, 0);
    [-1, 1].forEach(s => { oval(0.036, [1, 0.62, 0.35], black, s * 0.029, 0.337, -0.126).rotation.z = s * 0.25; });
    [-1, 1].forEach(s => {
      const strap = bevelBox(0.032, 0.13, 0.04, 0.006, black, s * 0.096, 0.455, 0.087);
      strap.rotation.z = s * 0.2;
      const collar = oval(0.055, [1, 0.32, 0.8], cream, s * 0.045, 0.497, 0.093);
      collar.rotation.z = s * 0.22;
      const tie = new THREE.Shape();
      tie.moveTo(0, 0); tie.quadraticCurveTo(s * 0.045, -0.018, s * 0.047, -0.09);
      tie.quadraticCurveTo(s * 0.005, -0.068, 0, 0);
      const geo = new THREE.ExtrudeGeometry(tie, { depth: 0.008, bevelEnabled: true, bevelSize: 0.003,
        bevelThickness: 0.003, bevelSegments: 1, steps: 1, curveSegments: 5 });
      add(geo, red, s * 0.006, 0.471, 0.141);
    });
    oval(0.023, [1, 0.9, 0.7], red, 0, 0.48, 0.145);
    const head = add(new THREE.SphereGeometry(0.21, 24, 18).scale(1, 0.9, 0.92).translate(0, 0.035, 0), skin, 0, 0.62, 0, root, 'head');
    // Неровная линия чёлки и боковой пробор вместо горизонтальной «шапочки».
    const hairVertices = [], hairIndices = [], segments = 16, rows = 5;
    const hairline = [[-Math.PI, 1.95], [-1.6, 1.78], [-0.8, 1.46], [-0.3, 1.18], [0.4, 0.8], [1.1, 1.45], [1.6, 1.78], [Math.PI, 1.95]];
    for (let row = 0; row <= rows; row++) for (let i = 0; i <= segments; i++) {
      const phi = -Math.PI + i / segments * Math.PI * 2;
      const j = Math.max(1, hairline.findIndex(k => k[0] >= phi));
      const [a, ta] = hairline[j - 1], [b, tb] = hairline[j];
      const theta = row / rows * (ta + (tb - ta) * (phi - a) / (b - a));
      hairVertices.push(0.225 * Math.sin(theta) * Math.sin(phi), 0.225 * Math.cos(theta) + 0.014, 0.221 * Math.sin(theta) * Math.cos(phi) - 0.012);
      if (row < rows && i < segments) {
        const k = row * (segments + 1) + i;
        hairIndices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
      }
    }
    const hairGeo = new THREE.BufferGeometry();
    hairGeo.setAttribute('position', new THREE.Float32BufferAttribute(hairVertices, 3));
    hairGeo.setIndex(hairIndices); hairGeo.computeVertexNormals();
    add(hairGeo, hairMat, 0, 0, 0, head, 'hair');
    const ears = [-1, 1].map(s => {
      oval(0.043, [0.65, 1, 0.7], skin, s * 0.2, -0.015, 0, head);
      const p = add(new THREE.DodecahedronGeometry(0.078, 0), hairMat, s * 0.233, -0.065, -0.06, head, 'pigtail');
      p.scale.set(1, 0.95, 0.85); p.rotation.z = s * 0.3;
      oval(0.031, [0.5, 1, 1], red, s * 0.203, -0.053, -0.058, head);
      return p;
    });
    const eyes = [], pupils = [], joy = [], squint = [];
    const white = mat(0xfffaf0, { flatShading: false });
    const glass = mat(0xcce8ee, { transparent: true, opacity: 0.08, depthWrite: false, flatShading: false, roughness: 0.12 });
    [-0.082, 0.082].forEach(x => {
      eyes.push(rest(oval(0.058, [1, 1, 0.8], white, x, 0.66, 0.172, root, 'eye')));
      const pupil = oval(0.027, [0.82, 1, 0.48], iris, x + 0.008, 0.66, 0.225, root, 'pupil');
      oval(0.008, [0.7, 1, 0.4], white, -0.008, 0.009, 0.031, pupil);
      pupils.push(rest(pupil));
      add(new THREE.TorusGeometry(0.064, 0.012, 8, 24), metal, x, 0.66, 0.213);
      add(new THREE.TorusGeometry(0.059, 0.004, 6, 24), cream, x, 0.66, 0.221);
      oval(0.057, [1, 1, 0.17], glass, x, 0.66, 0.233);
      limb([Math.sign(x) * 0.142, 0.66, 0.2], [Math.sign(x) * 0.198, 0.65, 0.027], 0.009, metal, root);
      joy.push(rest(add(new THREE.TorusGeometry(0.036, 0.01, 6, 16, Math.PI), iris, x, 0.653, 0.226), false));
      const q = new THREE.Group(); q.position.set(x, 0.66, 0.227); root.add(q);
      [-1, 1].forEach(s => { box(0.055, 0.011, 0.012, iris, 0, s * 0.013, 0, q).rotation.z = s * Math.sign(x) * 0.5; });
      squint.push(rest(q, false));
      oval(0.026, [1, 0.4, 0.18], blush, x * 1.28, 0.594, 0.176);
    });
    bevelBox(0.045, 0.015, 0.019, 0.004, metal, 0, 0.664, 0.215);
    oval(0.027, [0.8, 0.9, 0.85], mat(0xf2ac80, { flatShading: false }), 0, 0.612, 0.207, root, 'nose');
    const mouth = add(new THREE.TorusGeometry(0.032, 0.0055, 6, 16, Math.PI), iris, 0, 0.577, 0.196, root, 'mouth');
    mouth.rotation.z = Math.PI; rest(mouth);
    // Согнутые локти, округлые манжеты и ладони держат пульт спереди.
    const controls = new THREE.Group(); controls.name = 'inventorControls'; root.add(controls);
    [-1, 1].forEach(s => {
      const shoulder = [s * 0.119, 0.456, 0], elbow = [s * 0.166, 0.356, 0.037], wrist = [s * 0.137, 0.319, 0.156];
      limb(shoulder, elbow, 0.048, brown, controls); ball(0.05, brown, ...elbow, controls);
      limb(elbow, wrist, 0.049, brown, controls);
      limb([s * 0.145, 0.328, 0.129], wrist, 0.052, cream, controls);
      oval(0.048, [0.83, 0.93, 0.85], skin, s * 0.13, 0.319, 0.182, controls);
    });
    const controller = new THREE.Group(); controller.position.set(0, 0.322, 0.222); controller.rotation.x = -0.25; controls.add(controller);
    bevelBox(0.228, 0.065, 0.122, 0.012, cream, 0, 0, 0, controller, 'controller');
    [-0.052, 0.052].forEach(x => add(new THREE.CylinderGeometry(0.025, 0.027, 0.016, 16), iris, x, 0.038, 0, controller));
    const feet = [-0.077, 0.077].map(x => {
      const leg = new THREE.Group(); leg.position.set(x, 0.04, 0.018); leg.name = 'foot'; root.add(leg);
      add(new THREE.CylinderGeometry(0.037, 0.033, 0.15, 12), cream, 0, 0.085, -0.018, leg);
      oval(0.061, [0.85, 0.55, 1.28], iris, 0, 0, 0.012, leg);
      oval(0.061, [0.87, 0.16, 1.3], black, 0, -0.021, 0.013, leg);
      return rest(leg);
    });

    // Фаски корпуса, углублённый экран и короткие панели, обращённые к камере.
    const photon = new THREE.Group(); photon.name = 'photon'; root.add(photon);
    const shell = mat(0xffe3b5), screen = mat(0x332841), blue = mat(0x273967), gold = mat(0xd9ad48);
    bevelBox(0.25, 0.235, 0.21, 0.024, shell, 0, 0, 0, photon, 'photonShell');
    bevelBox(0.205, 0.177, 0.016, 0.006, screen, 0, 0, 0.105, photon);
    [-0.049, 0.049].forEach((x, i) => {
      const eye = oval(0.037, [0.85, 1, 0.26], amber, x, 0.004, 0.119, photon, 'photonEye' + i);
      oval(0.021, [0.8, 1, 0.3], iris, 0.011, 0, 0.046, eye);
      const arc = add(new THREE.TorusGeometry(0.027, 0.009, 6, 12, Math.PI), amber, x, 0, 0.12, photon, 'photonJoy' + i);
      arc.visible = false;
    });
    add(new THREE.CylinderGeometry(0.023, 0.026, 0.018, 12), black, 0, 0.124, 0, photon);
    add(new THREE.CylinderGeometry(0.009, 0.011, 0.055, 10), black, 0, 0.158, 0, photon);
    ball(0.026, red, 0, 0.196, 0, photon);
    [-1, 1].forEach(s => oval(0.024, [0.3, 1, 1], red, s * 0.125, -0.058, 0.025, photon));
    const glow = mat(0x75e6df, { emissive: 0x27cabb, emissiveIntensity: 0.6, flatShading: false });
    oval(0.061, [1, 0.4, 0.85], metal, 0, -0.119, 0, photon);
    oval(0.049, [1, 0.3, 0.85], glow, 0, -0.136, 0, photon, 'photonThruster');
    [-1, 1].forEach(s => {
      const wing = new THREE.Group(); wing.name = s < 0 ? 'photonLeft' : 'photonRight';
      wing.position.x = s * 0.133; photon.add(wing);
      limb([0, 0, 0], [s * 0.02, 0, 0], 0.021, black, wing);
      const panel = new THREE.Group(); panel.rotation.x = Math.PI / 3; wing.add(panel);
      bevelBox(0.097, 0.014, 0.14, 0.004, gold, s * 0.055, 0, 0, panel);
      [-1, 1].forEach(a => [-1, 1].forEach(b => {
        box(0.039, 0.006, 0.058, blue, s * 0.055 + a * 0.022, 0.01, b * 0.033, panel);
      }));
    });
    // Невидимые совместимые опоры для общей мимики; антенна есть только у спутника.
    const antPivot = new THREE.Group(), ant = new THREE.Object3D(), bulb = new THREE.Object3D();
    antPivot.add(ant, bulb); root.add(antPivot); ant.visible = bulb.visible = false;
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.16, 0); arrowShape.lineTo(0.16, 0); arrowShape.lineTo(0, 0.2); arrowShape.closePath();
    const arrow = add(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.9 }), 0, 0.012, 0.3, root, 'arrow');
    arrow.rotation.x = -Math.PI / 2;
    [head, antPivot, bulb].forEach(o => rest(o, o.visible));
    update(root, 0, { reduceMotion: true });
    return { root, parts: { skin: 'inventor', body, head, violet: brown, violetLight: skin, eyes, pupils, joy, squint, mouth, feet, antPivot, ant, bulb, ears, tail: null, fx: null } };
  }

  // На клонах ищем собственные узлы: никакие замыкания не двигают исходную модель.
  function update(root, time, { moving = false, mood = '', event = '', age = Infinity, reduceMotion = false } = {}) {
    let p = cache.get(root);
    if (!p) {
      const find = n => root.getObjectByName(n);
      if (!find('photon')) return;
      p = { photon: find('photon'), left: find('photonLeft'), right: find('photonRight'), controls: find('inventorControls'), mouth: find('mouth'), eyes: [find('photonEye0'), find('photonEye1')], joy: [find('photonJoy0'), find('photonJoy1')] };
      cache.set(root, p);
    }
    const calm = reduceMotion, happy = mood === 'happy' || (event === 'take' && age < 0.65), sad = mood === 'sad';
    const pulse = !calm && age >= 0 && age < 0.65 ? Math.sin(age / 0.65 * Math.PI) : 0;
    p.photon.position.set(0.195, 0.965 + (calm ? 0 : Math.sin(time * 2.4) * 0.018) + (happy && !calm ? 0.025 : 0) - (sad && !calm ? 0.035 : 0), -0.035);
    p.photon.rotation.set(calm ? 0 : moving ? 0.12 : event === 'check' ? pulse * 0.16 : 0, 0, calm ? 0 : Math.sin(time * 1.7) * 0.035);
    const fold = calm ? 0.15 : moving ? 0.5 : happy ? 0.3 + Math.sin(time * 6) * 0.12 : sad ? -0.18 : 0.15;
    p.left.rotation.z = -fold; p.right.rotation.z = fold;
    const blink = !calm && time % 3.6 < 0.14 ? 0.2 : 1;
    p.eyes.forEach(e => { e.visible = !happy; e.scale.y = blink; });
    p.joy.forEach(e => { e.visible = happy; });
    // Общая мимика Бита скрывает рот в покое; у изобретательницы остаётся улыбка.
    p.mouth.visible = true;
    p.mouth.position.set(0, sad ? 0.55 : 0.577, 0.196);
    p.mouth.rotation.set(0, 0, sad ? 0 : Math.PI);
    p.controls.rotation.x = event === 'check' ? -pulse * 0.08 : 0;
    p.controls.position.y = calm ? 0 : moving ? Math.sin(time * 9) * 0.006 : happy ? Math.sin(time * 6) * 0.008 : 0;
  }
  // При смене облика группа hero переиспользуется, поэтому старые ссылки нужно забыть.
  function reset(root) { cache.delete(root); }
  return { build, update, reset, soundFor };
})();
if (typeof module !== 'undefined') module.exports = HeroInventor;
