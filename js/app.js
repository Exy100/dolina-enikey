/* ===== Долина Эникей: интерфейс и 3D ===== */
(() => {
  const { TASKS, K, makeMaps, createState, commands, WinSignal } = HeroWorld;
  const $ = s => document.querySelector(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Сохранение ---------- */
  const STORE = 'mir-geroya-usloviya-v1';
  let save = { task: 0, code: {}, stars: {}, hints: {}, seeds: {} };
  try { const raw = localStorage.getItem(STORE); if (raw) save = Object.assign(save, JSON.parse(raw)); } catch (e) { /* без сохранения */ }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* ок */ } };

  /* ---------- Состояние ---------- */
  let taskIdx = Math.min(save.task || 0, TASKS.length - 1);
  let maps = [];
  let mapIdx = 0;
  let runToken = 0;
  let running = false;
  let stepMode = false;
  let stepResolve = null;
  let speed = 1;

  /* ================= 3D ================= */
  const stage = $('#stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Игровое поле с героем');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6b5a4a, 0.62));
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.8);
  sun.position.set(6, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  const M = {
    grassA: new THREE.MeshStandardMaterial({ color: 0x86d06f, flatShading: true, roughness: 0.9 }),
    grassB: new THREE.MeshStandardMaterial({ color: 0x78c262, flatShading: true, roughness: 0.9 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x9a6a45, flatShading: true, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x6f6878, flatShading: true, roughness: 1 }),
    stoneA: new THREE.MeshStandardMaterial({ color: 0x7f86a0, flatShading: true, roughness: 0.95 }),
    stoneB: new THREE.MeshStandardMaterial({ color: 0x6c7390, flatShading: true, roughness: 0.95 }),
    lava: new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3b0a, emissiveIntensity: 0.9, flatShading: true, roughness: 0.6 }),
    coin: new THREE.MeshStandardMaterial({ color: 0xf5b82e, emissive: 0x7a4b00, emissiveIntensity: 0.35, metalness: 0.55, roughness: 0.3 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7b4f2e, flatShading: true }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3fa35b, flatShading: true }),
    pole: new THREE.MeshStandardMaterial({ color: 0xf3f0ff, roughness: 0.5 }),
    flag: new THREE.MeshStandardMaterial({ color: 0x1fa88f, side: THREE.DoubleSide, flatShading: true }),
    ring: new THREE.MeshBasicMaterial({ color: 0x7ef0d6, transparent: true, opacity: 0.55 }),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  let levelGroup = new THREE.Group();
  scene.add(levelGroup);
  let coinMeshes = new Map();
  let flag = null, finishRing = null;

  /* Герой */
  const hero = new THREE.Group();
  const heroParts = {};
  (function buildHero() {
    const violet = new THREE.MeshStandardMaterial({ color: 0x6a55ea, flatShading: true, roughness: 0.55 });
    const violetLight = new THREE.MeshStandardMaterial({ color: 0x8f7cff, roughness: 0.45 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1b1e3c, roughness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0x6b4500, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 10), violet);
    body.position.y = 0.26; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), violetLight);
    head.position.y = 0.62; head.castShadow = true;
    const eyeGeo = new THREE.SphereGeometry(0.065, 12, 10), pupilGeo = new THREE.SphereGeometry(0.032, 10, 8);
    [-0.085, 0.085].forEach(x => {
      const e = new THREE.Mesh(eyeGeo, white); e.position.set(x, 0.65, 0.165);
      const p = new THREE.Mesh(pupilGeo, black); p.position.set(x, 0.65, 0.218);
      hero.add(e, p);
    });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), black);
    ant.position.y = 0.9;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), gold);
    bulb.position.y = 1.02;
    const feetGeo = new THREE.SphereGeometry(0.09, 10, 8);
    [-0.1, 0.1].forEach(x => { const f = new THREE.Mesh(feetGeo, black); f.position.set(x, 0.05, 0.03); f.scale.set(1, 0.6, 1.3); hero.add(f); });
    const tri = new THREE.Shape();
    tri.moveTo(-0.16, 0); tri.lineTo(0.16, 0); tri.lineTo(0, 0.2); tri.lineTo(-0.16, 0);
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.9 }));
    arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.012, 0.3);
    hero.add(body, head, ant, bulb, arrow);
    Object.assign(heroParts, { body, head, violet, violetLight });
  })();
  const heroRig = new THREE.Group(); // для прыжков и сдвигов
  heroRig.add(hero);
  scene.add(heroRig);
  let heroAngle = 0;
  const DIR_ANGLE = [Math.PI / 2, Math.PI, Math.PI * 1.5, 0];

  /* Камера */
  const cam = { az: -0.38, el: 0.9, dist: 14, target: new THREE.Vector3(), goal: { az: -0.38, el: 0.9, dist: 14 }, top: false, shake: 0 };
  let frameDist = 14;
  function applyCamera() {
    const { az, el, dist, target } = cam;
    const sx = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az) + sx,
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az) + sx
    );
    camera.lookAt(target);
  }

  function hash(x, z) { let h = (x * 374761393 + z * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function buildLevel(level) {
    scene.remove(levelGroup);
    levelGroup.traverse(o => { if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose(); });
    levelGroup = new THREE.Group();
    coinMeshes = new Map();
    particles.splice(0).forEach(p => scene.remove(p.m));
    const floorKeys = [...level.floor];
    const cells = floorKeys.map(k => k.split(',').map(Number));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    cells.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });

    const addBlock = (x, z, h, topY, mats) => {
      const m = new THREE.Mesh(boxGeo, mats);
      m.scale.set(0.98, h, 0.98);
      m.position.set(x, topY - h / 2, z);
      m.receiveShadow = true;
      levelGroup.add(m);
      return m;
    };
    // пол
    cells.forEach(([x, z]) => {
      const k = K(x, z);
      if (level.lava.has(k)) {
        addBlock(x, z, 0.8, -0.14, [M.rock, M.rock, M.lava, M.rock, M.rock, M.rock]);
      } else {
        const g = (x + z) % 2 === 0 ? M.grassA : M.grassB;
        addBlock(x, z, 0.9 + hash(x, z) * 0.25, 0, [M.dirt, M.dirt, g, M.dirt, M.dirt, M.dirt]);
      }
    });
    // стены и деревья вокруг
    for (let x = minX - 1; x <= maxX + 1; x++) {
      for (let z = minZ - 1; z <= maxZ + 1; z++) {
        if (level.floor.has(K(x, z))) continue;
        let near = false;
        for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1; dz++) if (level.floor.has(K(x + dx, z + dz))) { near = true; break; }
        if (!near) continue;
        const r = hash(x, z);
        addBlock(x, z, 0.9 + r * 0.2, 0, [M.dirt, M.dirt, M.grassB, M.dirt, M.dirt, M.dirt]);
        if (r < 0.22) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.35, 6), M.trunk);
          trunk.position.set(x, 0.17, z); trunk.castShadow = true;
          const crown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.8, 7), M.leaf);
          crown.position.set(x, 0.72, z); crown.castShadow = true;
          levelGroup.add(trunk, crown);
        } else {
          const h = 0.28 + r * 0.32;
          const w = new THREE.Mesh(boxGeo, r > 0.6 ? M.stoneA : M.stoneB);
          w.scale.set(0.94, h, 0.94);
          w.position.set(x, h / 2, z);
          w.castShadow = true; w.receiveShadow = true;
          levelGroup.add(w);
        }
      }
    }
    // монеты
    const coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20);
    level.coins.forEach(k => {
      const [x, z] = k.split(',').map(Number);
      const c = new THREE.Group();
      const disc = new THREE.Mesh(coinGeo, M.coin);
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      c.add(disc);
      c.position.set(x, 0.42, z);
      c.userData.phase = hash(x, z) * 6;
      levelGroup.add(c);
      coinMeshes.set(k, c);
    });
    // финиш
    const f = level.finish;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), M.pole);
    pole.position.set(f.x + 0.28, 0.65, f.z - 0.28); pole.castShadow = true;
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.5, -0.16); fs.lineTo(0, -0.32); fs.lineTo(0, 0);
    flag = new THREE.Mesh(new THREE.ShapeGeometry(fs), M.flag);
    flag.position.set(f.x + 0.28, 1.28, f.z - 0.28);
    flag.castShadow = true;
    finishRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 28), M.ring);
    finishRing.rotation.x = -Math.PI / 2; finishRing.position.set(f.x, 0.015, f.z);
    levelGroup.add(pole, flag, finishRing);
    scene.add(levelGroup);

    // герой в начало
    placeHero(level.start);
    heroParts.violet.emissive.setHex(0x000000);
    hero.scale.set(1, 1, 1);

    // камера и тени
    cam.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const span = Math.max(maxX - minX + 3, maxZ - minZ + 3, 6);
    frameDist = span * 0.95 + 2.4;
    fitCamera();
    const sc = sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 40;
    sc.updateProjectionMatrix();
    sun.position.set(cam.target.x + 5, 12, cam.target.z + 6);
    sun.target.position.copy(cam.target);
  }

  function fitCamera() {
    const aspect = camera.aspect || 1.5;
    const adj = aspect < 1.25 ? Math.pow(1.25 / aspect, 0.9) : 1;
    cam.goal.dist = frameDist * adj;
    cam.goal.el = cam.top ? 1.5 : 0.9;
    cam.goal.az = cam.top ? 0 : -0.38;
  }

  function placeHero(p) {
    heroRig.position.set(p.x, 0, p.z);
    hero.position.set(0, 0, 0);
    heroAngle = DIR_ANGLE[p.dir];
    hero.rotation.set(0, heroAngle, 0);
  }

  /* ---------- Анимации ---------- */
  const tweens = new Set();
  function tween(ms, fn) {
    const dur = Math.max(16, ms / speed);
    return new Promise(res => tweens.add({ start: performance.now(), dur, fn, res }));
  }
  const wait = ms => tween(ms, () => {});
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const particles = [];
  function confetti(x, z, n = 70) {
    if (reduceMotion) n = 18;
    const cols = [0xffc83d, 0x6a55ea, 0x1fa88f, 0xff6b8b, 0x7ec8ff];
    const g = new THREE.PlaneGeometry(0.08, 0.12);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      m.position.set(x, 1, z);
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      particles.push({ m, v: new THREE.Vector3(Math.cos(a) * s * 0.5, 3 + Math.random() * 3, Math.sin(a) * s * 0.5), life: 1.8, spin: Math.random() * 10 });
      scene.add(m);
    }
  }
  function sparks(x, z, color, n = 16) {
    const g = new THREE.SphereGeometry(0.04, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, 0.45, z);
      const a = Math.random() * Math.PI * 2;
      particles.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.6, 2 + Math.random() * 2, Math.sin(a) * 1.6), life: 0.7, spin: 0 });
      scene.add(m);
    }
  }

  /* Облачко над героем */
  const bubble = $('#bubble');
  let bubbleTimer = null;
  function say(text, kind = '', ms = 900) {
    bubble.textContent = text;
    bubble.className = 'bubble show ' + kind;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.className = 'bubble'; }, ms / Math.min(speed, 1.5) + 250);
  }
  const headPos = new THREE.Vector3();
  function positionBubble() {
    hero.getWorldPosition(headPos);
    headPos.y += 1.25;
    headPos.project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    bubble.style.transform = `translate(${(headPos.x * 0.5 + 0.5) * w}px, ${(-headPos.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  }

  /* Цикл отрисовки */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const tw of [...tweens]) {
      const t = Math.min(1, (now - tw.start) / tw.dur);
      tw.fn(t);
      if (t >= 1) { tweens.delete(tw); tw.res(); }
    }
    const time = now / 1000;
    coinMeshes.forEach(c => { if (!c.userData.taken) { c.rotation.y = time * 2 + c.userData.phase; c.position.y = 0.42 + Math.sin(time * 2.4 + c.userData.phase) * 0.05; } });
    M.lava.emissiveIntensity = 0.75 + Math.sin(time * 3) * 0.25;
    if (flag) flag.rotation.y = Math.sin(time * 2.2) * 0.25;
    if (finishRing) finishRing.material.opacity = 0.35 + Math.sin(time * 3) * 0.2;
    if (!running && !reduceMotion) heroParts.head.position.y = 0.62 + Math.sin(time * 2) * 0.012;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0 || p.m.position.y < -3) { scene.remove(p.m); particles.splice(i, 1); }
    }
    const k = 1 - Math.pow(0.001, dt);
    cam.az += (cam.goal.az - cam.az) * k * 1.5;
    cam.el += (cam.goal.el - cam.el) * k * 1.5;
    cam.dist += (cam.goal.dist - cam.dist) * k * 1.5;
    cam.shake *= 0.85; if (cam.shake < 0.002) cam.shake = 0;
    applyCamera();
    renderer.render(scene, camera);
    if (bubble.classList.contains('show')) positionBubble();
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }
  new ResizeObserver(resize).observe(stage);

  /* Вращение камеры мышью / пальцем */
  (function orbit() {
    const el = renderer.domElement;
    let drag = null;
    el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az: cam.goal.az, el: cam.goal.el, touch: e.pointerType === 'touch' }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      cam.goal.az = drag.az - (e.clientX - drag.x) * 0.008;
      if (!drag.touch) cam.goal.el = Math.max(0.35, Math.min(1.5, drag.el + (e.clientY - drag.y) * 0.005));
    });
    const up = () => { drag = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); cam.goal.dist = Math.max(5, Math.min(40, cam.goal.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  })();

  /* Анимация одного события мира */
  async function animate(ev, st) {
    switch (ev.type) {
      case 'line':
        markLine(ev.line, 'run');
        await wait(stepMode ? 0 : 110);
        return;
      case 'print':
        log(ev.text, 'print');
        return;
      case 'check':
        say(ev.text, typeof ev.value === 'boolean' ? (ev.value ? 'yes' : 'no') : '', 850);
        await wait(380);
        return;
      case 'move': {
        const fx = ev.from.x, fz = ev.from.z, tx = ev.to.x, tz = ev.to.z;
        await tween(360, t => {
          const e = ease(t);
          heroRig.position.set(fx + (tx - fx) * e, 0, fz + (tz - fz) * e);
          hero.position.y = Math.sin(t * Math.PI) * 0.14;
        });
        hero.position.y = 0;
        return;
      }
      case 'jump': {
        const fx = ev.from.x, fz = ev.from.z, tx = ev.to.x, tz = ev.to.z;
        say('Прыжок!', 'yes', 700);
        await tween(620, t => {
          const e = ease(t);
          heroRig.position.set(fx + (tx - fx) * e, 0, fz + (tz - fz) * e);
          hero.position.y = Math.sin(t * Math.PI) * 1.05;
          hero.scale.set(1, 1 + Math.sin(t * Math.PI) * 0.1, 1);
        });
        hero.position.y = 0; hero.scale.set(1, 1, 1);
        return;
      }
      case 'turn': {
        const a0 = heroAngle, a1 = heroAngle + ev.side * Math.PI / 2;
        heroAngle = a1;
        await tween(260, t => { hero.rotation.y = a0 + (a1 - a0) * ease(t); });
        return;
      }
      case 'take': {
        const k = K(ev.x, ev.z), c = coinMeshes.get(k);
        say(`+1 монета (${ev.count} из ${ev.total})`, 'yes', 800);
        updateCoins(ev.count, ev.total);
        if (c) {
          c.userData.taken = true;
          const y0 = c.position.y;
          sparks(ev.x, ev.z, 0xffc83d);
          await tween(380, t => { c.position.y = y0 + t * 0.9; const s = 1 - t; c.scale.set(s, s, s); });
          c.visible = false;
        }
        return;
      }
      case 'bump': {
        say('Бум! Стена', 'bad', 1400);
        const [dx, dz] = HeroWorld.DIRS[st.hero.dir];
        if (!reduceMotion) cam.shake = 0.25;
        await tween(300, t => { const s = Math.sin(t * Math.PI) * 0.25; hero.position.set(dx * s, 0, dz * s); });
        hero.position.set(0, 0, 0);
        return;
      }
      case 'burn': {
        say('Горячо!', 'bad', 1400);
        sparks(st.hero.x, st.hero.z, 0xff5a1f, 24);
        heroParts.violet.emissive.setHex(0xff2a00);
        await tween(700, t => { hero.position.y = -t * 0.55; });
        return;
      }
      case 'grab-air': {
        say('Пусто…', 'bad', 1400);
        await tween(320, t => { const s = Math.sin(t * Math.PI); hero.scale.set(1 + s * 0.12, 1 - s * 0.18, 1 + s * 0.12); });
        hero.scale.set(1, 1, 1);
        return;
      }
      case 'shrug': {
        say('Зачем прыгать?', 'bad', 1400);
        await tween(360, t => { hero.rotation.z = Math.sin(t * Math.PI * 3) * 0.12; });
        hero.rotation.z = 0;
        return;
      }
      case 'win': {
        say('Ура, флаг!', 'yes', 1100);
        confetti(st.hero.x, st.hero.z);
        const a0 = heroAngle;
        await tween(800, t => {
          hero.rotation.y = a0 + t * Math.PI * 2;
          hero.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.35;
        });
        hero.position.y = 0;
        return;
      }
    }
  }

  /* ================= Редактор ================= */
  const ta = $('#code'), hl = $('#hl'), gutter = $('#gutter'), band = $('#band');
  const HERO_CMDS = ['вперёд', 'вперед', 'налево', 'направо', 'взять', 'прыгнуть', 'стена_впереди', 'лава_впереди', 'есть_монета', 'на_финише', 'монет_собрано'];
  const KWS = ['for', 'in', 'if', 'elif', 'else', 'while', 'and', 'or', 'not', 'True', 'False', 'None', 'pass', 'break', 'continue'];
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tokRe = new RegExp(
    '(#.*)|("(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?)|\\b(\\d+(?:\\.\\d+)?)\\b|([\\p{L}_][\\p{L}\\p{N}_]*)', 'gu');
  function highlight(src) {
    let out = '', lastI = 0;
    src.replace(tokRe, (m, com, str, num, name, off) => {
      out += esc(src.slice(lastI, off));
      if (com) out += `<span class="t-com">${esc(com)}</span>`;
      else if (str) out += `<span class="t-str">${esc(str)}</span>`;
      else if (num) out += `<span class="t-num">${num}</span>`;
      else if (KWS.includes(name)) out += `<span class="t-kw">${name}</span>`;
      else if (HERO_CMDS.includes(name)) out += `<span class="t-hero">${name}</span>`;
      else if (['print', 'range', 'len', 'str', 'int', 'abs'].includes(name)) out += `<span class="t-fn">${name}</span>`;
      else out += esc(name);
      lastI = off + m.length;
      return m;
    });
    out += esc(src.slice(lastI));
    return out + '\n ';
  }
  let markedLine = null, markedKind = '';
  function refreshEditor() {
    hl.innerHTML = highlight(ta.value);
    const n = ta.value.split('\n').length;
    let g = '';
    for (let i = 1; i <= n; i++) g += `<span class="${i === markedLine ? 'on ' + markedKind : ''}">${i}</span>`;
    gutter.innerHTML = g;
  }
  function markLine(line, kind = 'run') {
    markedLine = line; markedKind = kind;
    if (!line) { band.hidden = true; refreshEditor(); return; }
    band.hidden = false;
    band.className = 'band ' + kind;
    const lh = parseFloat(getComputedStyle(ta).lineHeight);
    band.style.top = (12 + (line - 1) * lh) + 'px';
    refreshEditor();
    // прокрутить к строке
    const wrap = $('#edScroll');
    const top = 12 + (line - 1) * lh;
    if (top < wrap.scrollTop || top + lh > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = top - wrap.clientHeight / 2;
  }
  function insertText(text) {
    ta.focus();
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    }
    onEdit();
  }
  function onEdit() {
    if (markedKind === 'err') markLine(null); else refreshEditor();
    save.code[TASKS[taskIdx].id] = ta.value;
    persist();
  }
  ta.addEventListener('input', onEdit);
  ta.addEventListener('keydown', e => {
    if (ta.readOnly) return;
    const v = ta.value, s = ta.selectionStart;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    const curLine = v.slice(lineStart, s);
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insertText('    '); }
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const m = v.slice(lineStart).match(/^ {1,4}/);
      if (m) { ta.setSelectionRange(lineStart, lineStart + m[0].length); insertText(''); }
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      let ind = curLine.match(/^ */)[0];
      if (/:\s*(#.*)?$/.test(curLine)) ind += '    ';
      insertText('\n' + ind);
    } else if (e.key === 'Backspace' && s === ta.selectionEnd && /^ +$/.test(curLine) && curLine.length % 4 === 0 && curLine.length > 0) {
      e.preventDefault();
      ta.setSelectionRange(s - 4, s); insertText('');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); runAll();
    }
  });

  /* ================= Консоль ================= */
  const out = $('#out');
  function log(text, kind = 'info', line = null) {
    const d = document.createElement('div');
    d.className = 'msg ' + kind;
    if (line) {
      const b = document.createElement('button');
      b.className = 'ln'; b.type = 'button'; b.textContent = `Строка ${line}`;
      b.addEventListener('click', () => { const pos = ta.value.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0); ta.focus(); ta.setSelectionRange(pos, pos); });
      d.append(b);
    }
    d.append(document.createTextNode(text));
    out.append(d);
    out.scrollTop = out.scrollHeight;
  }
  const clearLog = () => { out.innerHTML = ''; };

  /* ================= Задания и интерфейс ================= */
  const dots = [...document.querySelectorAll('.dot')];
  function setDots(states) { dots.forEach((d, i) => { d.className = 'dot ' + (states[i] || '') + (i === mapIdx ? ' cur' : ''); }); }
  let dotStates = ['', '', ''];
  function updateCoins(c, t) {
    const el = $('#coins');
    if (!t) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = `Монеты: ${c} из ${t}`;
  }

  function starsHtml(n) { return [0, 1, 2].map(i => `<i class="${n[i] ? 'on' : ''}">★</i>`).join(''); }

  function renderTabs() {
    const nav = $('#tabs');
    nav.innerHTML = '';
    TASKS.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (i === taskIdx ? ' active' : '');
      b.setAttribute('aria-current', i === taskIdx ? 'step' : 'false');
      const st = save.stars[t.id] || [0, 0, 0];
      b.innerHTML = `<span class="num">${i + 1}</span><span class="nm">${t.short}</span><span class="stars">${starsHtml(st)}</span>`;
      b.addEventListener('click', () => { if (!running) selectTask(i); });
      nav.append(b);
    });
  }

  function hintsUsed() { return save.hints[TASKS[taskIdx].id] || 0; }
  function renderHints() {
    const t = TASKS[taskIdx], used = hintsUsed();
    const box = $('#hintBox');
    box.innerHTML = '';
    for (let i = 0; i < used; i++) {
      const d = document.createElement('div');
      d.className = 'hint' + (i === 2 ? ' sol' : '');
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.textContent = i === 2 ? 'Решение' : `Подсказка ${i + 1}`;
      const pre = document.createElement('pre');
      pre.textContent = t.hints[i];
      d.append(cap, pre);
      box.append(d);
    }
    const btn = $('#hintBtn');
    btn.hidden = used >= 3;
    btn.textContent = used === 2 ? 'Показать решение' : `Подсказка ${used + 1} из 2`;
  }

  function selectTask(i) {
    stopRun();
    taskIdx = i;
    save.task = i;
    const t = TASKS[i];
    if (!save.seeds[t.id]) save.seeds[t.id] = 1000 + Math.floor(Math.random() * 90000);
    maps = makeMaps(t, save.seeds[t.id]);
    persist();
    $('#taskNum').textContent = `Задание ${i + 1} из ${TASKS.length}`;
    $('#taskTitle').textContent = t.title;
    $('#taskGoal').textContent = t.goal;
    $('#taskNew').textContent = t.news;
    const chips = $('#chips');
    chips.innerHTML = '';
    t.cmds.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = c;
      b.title = 'Вставить в код';
      b.addEventListener('click', () => { if (!ta.readOnly) insertText(c); });
      chips.append(b);
    });
    ta.value = save.code[t.id] ?? t.starter;
    markLine(null);
    renderTabs();
    renderHints();
    hideResult();
    clearLog();
    log('Нажми «Запуск»: код проверится на трёх разных картах. «Шаг» выполняет программу по одной строке.', 'info');
    dotStates = ['', '', ''];
    showMap(0);
  }

  function showMap(i) {
    mapIdx = i;
    buildLevel(maps[i]);
    updateCoins(0, maps[i].coins.size);
    setDots(dotStates);
    $('#mapLabel').textContent = `Карта ${i + 1} из 3`;
  }

  dots.forEach((d, i) => d.addEventListener('click', () => { if (!running) { dotStates = ['', '', '']; showMap(i); } }));

  /* ---------- Запуск ---------- */
  function setRunning(on) {
    running = on;
    ta.readOnly = on;
    document.body.classList.toggle('is-running', on);
    $('#runBtn').textContent = on && stepMode ? 'Без остановок' : 'Запуск';
    $('#runBtn').disabled = on && !stepMode;
    $('#stopBtn').disabled = !on;
  }

  function stopRun() {
    runToken++;
    stepMode = false;
    if (stepResolve) { stepResolve(); stepResolve = null; }
    for (const tw of [...tweens]) { tweens.delete(tw); tw.res(); }
    setRunning(false);
  }

  async function runOnMap(code, token) {
    const st = createState(maps[mapIdx]);
    const g = MiniPy.execute(code, { ...MiniPy.stdlib(), ...commands(st) });
    while (true) {
      if (token !== runToken) return { aborted: true };
      let r;
      try { r = g.next(); }
      catch (e) {
        if (e instanceof WinSignal) return { ok: true };
        return { ok: false, err: e };
      }
      if (r.done) return { ok: false, err: { message: 'Программа закончилась, а герой не дошёл до флага. Может, в цикле не хватает повторов?', line: null, kind: 'short' } };
      await animate(r.value, st);
      if (token !== runToken) return { aborted: true };
      if (stepMode && r.value.type === 'line') {
        await new Promise(res => { stepResolve = res; });
        stepResolve = null;
      }
    }
  }

  function reportError(err, mIdx) {
    const line = err.line || null;
    if (line) markLine(line, 'err'); else markLine(null);
    log(err.message, 'err', line);
    if (mIdx > 0 && err.kind && err.kind !== 'short')
      log(`На карте ${mIdx} всё сработало, а на карте ${mIdx + 1} — нет. Код должен работать на любой карте: для этого и нужны условия.`, 'tip');
  }

  async function runAll() {
    if (running) {
      if (stepMode) { stepMode = false; setRunning(true); if (stepResolve) stepResolve(); }
      return;
    }
    const code = ta.value;
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    const token = ++runToken;
    stepMode = false;
    setRunning(true);
    dotStates = ['', '', ''];
    for (let m = 0; m < 3; m++) {
      showMap(m);
      dotStates[m] = 'active'; setDots(dotStates);
      log(`Карта ${m + 1} из 3`, 'map');
      await wait(420);
      if (token !== runToken) return;
      const r = await runOnMap(code, token);
      if (r.aborted || token !== runToken) return;
      if (!r.ok) {
        dotStates[m] = 'fail'; setDots(dotStates);
        reportError(r.err, m);
        setRunning(false);
        return;
      }
      dotStates[m] = 'ok'; setDots(dotStates);
      log('Флаг достигнут.', 'ok');
      await wait(650);
      if (token !== runToken) return;
    }
    markLine(null);
    setRunning(false);
    finishTask(code);
  }

  async function stepRun() {
    if (running && stepMode) { if (stepResolve) stepResolve(); return; }
    if (running) return;
    const code = ta.value;
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    const token = ++runToken;
    stepMode = true;
    setRunning(true);
    dotStates = ['', '', ''];
    showMap(mapIdx);
    log(`Пошаговый режим на карте ${mapIdx + 1}. Нажимай «Шаг», чтобы выполнить следующую строку.`, 'map');
    const r = await runOnMap(code, token);
    if (r.aborted || token !== runToken) return;
    stepMode = false;
    setRunning(false);
    if (r.ok) { markLine(null); log(`Карта ${mapIdx + 1} пройдена. Нажми «Запуск», чтобы проверить код на всех трёх картах.`, 'ok'); }
    else reportError(r.err, 0);
  }

  function finishTask(code) {
    const t = TASKS[taskIdx];
    const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
    const got = [1, hintsUsed() === 0 ? 1 : 0, lines <= t.best ? 1 : 0];
    const prev = save.stars[t.id] || [0, 0, 0];
    save.stars[t.id] = prev.map((v, i) => (v || got[i] ? 1 : 0));
    persist();
    renderTabs();
    const r = $('#result');
    r.hidden = false;
    $('#resStars').innerHTML = starsHtml(got);
    $('#resList').innerHTML = `
      <li class="${got[0] ? 'on' : ''}">Код работает на всех трёх картах</li>
      <li class="${got[1] ? 'on' : ''}">Решено без подсказок</li>
      <li class="${got[2] ? 'on' : ''}">Коротко: ${lines} ${plural(lines, 'строка', 'строки', 'строк')}${got[2] ? '' : `, а можно уложиться в ${t.best}`}</li>`;
    const last = taskIdx === TASKS.length - 1;
    $('#resTitle').textContent = last ? 'Все задания урока пройдены!' : 'Готово! Код работает на любой карте.';
    $('#nextBtn').textContent = last ? 'К первому заданию' : `Задание ${taskIdx + 2}: ${TASKS[taskIdx + 1].short}`;
    log('Все три карты пройдены.', 'ok');
  }
  function hideResult() { $('#result').hidden = true; }
  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; }

  /* ---------- Кнопки ---------- */
  $('#runBtn').addEventListener('click', runAll);
  $('#stepBtn').addEventListener('click', stepRun);
  $('#stopBtn').addEventListener('click', () => { stopRun(); markLine(null); log('Остановлено.', 'info'); showMap(mapIdx); });
  $('#speed').addEventListener('input', e => { speed = parseFloat(e.target.value); $('#speedVal').textContent = speed.toFixed(1).replace('.', ',') + '×'; });
  $('#topBtn').addEventListener('click', () => {
    cam.top = !cam.top; fitCamera();
    $('#topBtn').setAttribute('aria-pressed', String(cam.top));
    $('#topBtn').textContent = cam.top ? 'Вид сбоку' : 'Вид сверху';
  });
  $('#newMapsBtn').addEventListener('click', () => {
    if (running) return;
    const t = TASKS[taskIdx];
    save.seeds[t.id] = 1000 + Math.floor(Math.random() * 90000);
    persist();
    maps = makeMaps(t, save.seeds[t.id]);
    dotStates = ['', '', ''];
    hideResult();
    showMap(0);
    log('Новые карты готовы.', 'info');
  });
  $('#hintBtn').addEventListener('click', () => {
    const id = TASKS[taskIdx].id;
    save.hints[id] = Math.min(3, (save.hints[id] || 0) + 1);
    persist();
    renderHints();
  });
  let resetArmed = null;
  $('#resetBtn').addEventListener('click', e => {
    if (running) return;
    const b = e.currentTarget;
    if (!resetArmed) {
      b.textContent = 'Точно? Нажми ещё раз';
      resetArmed = setTimeout(() => { resetArmed = null; b.textContent = 'Вернуть исходный код'; }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null; b.textContent = 'Вернуть исходный код';
    ta.value = TASKS[taskIdx].starter; onEdit(); markLine(null);
  });
  $('#nextBtn').addEventListener('click', () => selectTask((taskIdx + 1) % TASKS.length));
  $('#againBtn').addEventListener('click', () => { hideResult(); $('#newMapsBtn').click(); });

  /* ---------- Заставка «Нажми любую клавишу» ---------- */
  (function splashScreen() {
    const sp = $('#splash');
    if (!sp) return;
    const go = () => {
      removeEventListener('keydown', onKey, true);
      sp.classList.add('hide');
      setTimeout(() => sp.remove(), 400);
      ta.focus({ preventScroll: true });
    };
    const onKey = e => {
      if (['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); go();
    };
    addEventListener('keydown', onKey, true);
    sp.addEventListener('pointerdown', e => { e.preventDefault(); go(); });
    $('#splashBtn').focus();
  })();

  /* ---------- Старт ---------- */
  resize();
  selectTask(taskIdx);
  requestAnimationFrame(t => { last = t; frame(t); });
})();
