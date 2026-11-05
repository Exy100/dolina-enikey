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
    const brown = mat(0x70442e), skin = mat(0xffc49a), hairMat = mat(0x543128);
    const black = mat(0x292630), cream = mat(0xffefd5), red = mat(0xd94732);
    const metal = mat(0x929bad), amber = mat(0xffc43b, { emissive: 0xff9d00, emissiveIntensity: 0.65 });
    const add = (geo, m, x, y, z, parent = root, name = '') => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z); o.name = name; o.castShadow = true;
      parent.add(o); return o;
    };
    const box = (w, h, d, m, x, y, z, parent, name) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, name);
    const ball = (r, m, x, y, z, parent, name) => add(new THREE.SphereGeometry(r, 12, 8), m, x, y, z, parent, name);
    const rest = (o, visible = true) => {
      o.visible = visible;
      o.userData.rest = { p: o.position.toArray(), s: o.scale.toArray(), r: o.rotation.toArray().slice(0, 3), v: visible };
      return o;
    };
    // Платье, чёрный фартук, белые воротник/манжеты и красный галстук.
    const body = add(new THREE.CylinderGeometry(0.14, 0.23, 0.34, 10), brown, 0, 0.31, 0, root, 'body');
    add(new THREE.CylinderGeometry(0.147, 0.225, 0.29, 10, 1, true, -0.75, 1.5), black, 0, 0.31, 0.01);
    [-1, 1].forEach(s => {
      box(0.035, 0.22, 0.025, black, s * 0.095, 0.39, 0.14).rotation.z = s * 0.15;
      const collar = box(0.105, 0.025, 0.095, cream, s * 0.05, 0.475, 0.105);
      collar.rotation.z = s * 0.16;
      const tie = add(new THREE.ConeGeometry(0.041, 0.13, 3), red, s * 0.026, 0.398, 0.178);
      tie.rotation.z = Math.PI + s * 0.24;
    });
    ball(0.025, red, 0, 0.46, 0.162);
    const head = ball(0.21, skin, 0, 0.62, 0, root, 'head');
    const cap = add(new THREE.SphereGeometry(0.224, 10, 6, 0, Math.PI * 2, 0, 1.52), hairMat, 0, 0.018, 0, head, 'hair');
    cap.rotation.x = -0.23;
    const ears = [-1, 1].map(s => {
      const p = add(new THREE.DodecahedronGeometry(0.074, 0), hairMat, s * 0.215, -0.06, -0.055, head, 'pigtail');
      p.scale.set(1, 0.85, 0.85); return p;
    });
    const eyes = [], pupils = [], joy = [], squint = [];
    const white = mat(0xffffff);
    [-0.085, 0.085].forEach(x => {
      eyes.push(rest(ball(0.062, white, x, 0.65, 0.165, root, 'eye')));
      pupils.push(rest(ball(0.03, black, x, 0.65, 0.218, root, 'pupil')));
      add(new THREE.TorusGeometry(0.071, 0.013, 6, 16), metal, x, 0.65, 0.217);
      joy.push(rest(add(new THREE.TorusGeometry(0.041, 0.012, 6, 12, Math.PI), black, x, 0.645, 0.22), false));
      const q = new THREE.Group(); q.position.set(x, 0.65, 0.22); root.add(q);
      [-1, 1].forEach(s => { box(0.065, 0.013, 0.015, black, 0, s * 0.015, 0, q).rotation.z = s * Math.sign(x) * 0.5; });
      squint.push(rest(q, false));
    });
    box(0.04, 0.014, 0.025, metal, 0, 0.66, 0.22);
    const mouth = rest(add(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI), black, 0, 0.54, 0.195, root, 'mouth'), false);
    // Руки и пульт движутся вместе; кисти простые, без мелких пальцев.
    const controls = new THREE.Group(); controls.name = 'inventorControls'; root.add(controls);
    [-1, 1].forEach(s => {
      const arm = add(new THREE.CylinderGeometry(0.048, 0.055, 0.19, 8), brown, s * 0.17, 0.36, 0.085, controls);
      arm.rotation.x = -0.55; arm.rotation.z = s * 0.3;
      add(new THREE.CylinderGeometry(0.054, 0.054, 0.035, 8), cream, s * 0.145, 0.295, 0.15, controls).rotation.x = -0.55;
      ball(0.05, skin, s * 0.135, 0.29, 0.18, controls);
    });
    box(0.235, 0.065, 0.115, cream, 0, 0.29, 0.23, controls, 'controller');
    [-0.055, 0.055].forEach(x => add(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 10), black, x, 0.33, 0.23, controls));
    const feet = [-0.09, 0.09].map(x => {
      const leg = new THREE.Group(); leg.position.set(x, 0.055, 0.02); leg.name = 'foot'; root.add(leg);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), cream, 0, 0.06, -0.02, leg);
      ball(0.065, brown, 0, 0, 0, leg).scale.set(1, 0.65, 1.4);
      return rest(leg);
    });

    // Увеличенный спутник у плеча; весь размах удерживается в радиусе клетки.
    const photon = new THREE.Group(); photon.name = 'photon'; root.add(photon);
    const shell = mat(0xffe3b5), screen = mat(0x332841), blue = mat(0x273967), gold = mat(0xd9ad48);
    box(0.23, 0.21, 0.18, shell, 0, 0, 0, photon);
    box(0.195, 0.15, 0.012, screen, 0, 0, 0.096, photon);
    [-0.047, 0.047].forEach((x, i) => {
      ball(0.035, amber, x, 0.005, 0.108, photon, 'photonEye' + i).scale.z = 0.35;
      const arc = add(new THREE.TorusGeometry(0.026, 0.009, 5, 10, Math.PI), amber, x, 0, 0.111, photon, 'photonJoy' + i);
      arc.visible = false;
    });
    add(new THREE.CylinderGeometry(0.009, 0.009, 0.065, 6), black, 0, 0.137, 0, photon);
    ball(0.023, red, 0, 0.18, 0, photon);
    const glow = mat(0x75e6df, { emissive: 0x27cabb, emissiveIntensity: 0.6 });
    ball(0.055, glow, 0, -0.11, 0, photon, 'photonThruster').scale.set(1, 0.35, 1);
    [-1, 1].forEach(s => {
      const wing = new THREE.Group(); wing.name = s < 0 ? 'photonLeft' : 'photonRight';
      wing.position.x = s * 0.12; photon.add(wing);
      box(0.085, 0.014, 0.14, gold, s * 0.045, 0, 0, wing);
      [-1, 1].forEach(a => [-1, 1].forEach(b => {
        box(0.034, 0.007, 0.059, blue, s * 0.045 + a * 0.019, 0.01, b * 0.033, wing);
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
      p = { photon: find('photon'), left: find('photonLeft'), right: find('photonRight'), controls: find('inventorControls'), eyes: [find('photonEye0'), find('photonEye1')], joy: [find('photonJoy0'), find('photonJoy1')] };
      cache.set(root, p);
    }
    const calm = reduceMotion, happy = mood === 'happy' || (event === 'take' && age < 0.65), sad = mood === 'sad';
    const pulse = !calm && age >= 0 && age < 0.65 ? Math.sin(age / 0.65 * Math.PI) : 0;
    p.photon.position.set(0.23, 0.91 + (calm ? 0 : Math.sin(time * 2.4) * 0.018) + (happy && !calm ? 0.025 : 0) - (sad && !calm ? 0.035 : 0), -0.035);
    p.photon.rotation.set(calm ? 0 : moving ? 0.12 : event === 'check' ? pulse * 0.16 : 0, 0, calm ? 0 : Math.sin(time * 1.7) * 0.035);
    const fold = calm ? 0.15 : moving ? 0.5 : happy ? 0.3 + Math.sin(time * 6) * 0.12 : sad ? -0.18 : 0.15;
    p.left.rotation.z = -fold; p.right.rotation.z = fold;
    const blink = !calm && time % 3.6 < 0.14 ? 0.2 : 1;
    p.eyes.forEach(e => { e.visible = !happy; e.scale.y = blink; });
    p.joy.forEach(e => { e.visible = happy; });
    p.controls.rotation.x = event === 'check' ? -pulse * 0.08 : 0;
    p.controls.position.y = calm ? 0 : moving ? Math.sin(time * 9) * 0.006 : happy ? Math.sin(time * 6) * 0.008 : 0;
  }
  // При смене облика группа hero переиспользуется, поэтому старые ссылки нужно забыть.
  function reset(root) { cache.delete(root); }
  return { build, update, reset, soundFor };
})();
if (typeof module !== 'undefined') module.exports = HeroInventor;
