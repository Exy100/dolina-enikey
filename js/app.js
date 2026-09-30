/* ===== Долина Эникей: интерфейс и 3D ===== */
(() => {
  const { LESSONS, K, makeMaps, createState, commands, endCheck, WinSignal } = HeroWorld;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Сохранение ---------- */
  const STORE = 'mir-geroya-usloviya-v1';
  const blankSave = () => ({ lesson: null, pos: {}, code: {}, stars: {}, hints: {}, seeds: {}, fails: {}, gear: {}, seen: { intro: {}, outro: {} }, predict: { tries: 0, hits: 0 } });
  let save = blankSave();
  try { const raw = localStorage.getItem(STORE); if (raw) save = Object.assign(save, JSON.parse(raw)); } catch (e) { /* без сохранения */ }
  // Режим показа для видео (?show): свой Бит — в шляпе, шарфе и с рюкзаком; прогресс ученика не читаем и не пишем
  const SHOW = new URLSearchParams(location.search).has('show');
  if (SHOW) {
    const stars = {};
    ['k-steps', 'k-turn', 'k-coins', 'k-lava', 'k-far'].forEach(id => { stars[id] = [1, 1, 1]; });
    save = Object.assign(blankSave(), { stars, gear: { head: 'hat', neck: 'scarf', back: 'bag' }, mute: false });
  }
  // Раньше урок был один («Условия»), и номер задания лежал в save.task. Кто его начинал — вернётся туда же.
  if (!LESSONS.some(l => l.id === save.lesson)) {
    const old = LESSONS.find(l => l.id === 'usloviya');
    const started = old && old.tasks.some(t => save.stars[t.id] || save.code[t.id] !== undefined);
    save.lesson = started ? old.id : LESSONS[0].id;
    if (started && save.pos[old.id] === undefined) save.pos[old.id] = save.task || 0;
  }
  // Пролог (пробное занятие) вынесен из урока «Команды»: кто начинал старый урок, продолжит с того же задания
  if (save.pos.komandy !== undefined && save.pos.prolog === undefined) {
    const OLD = ['k-steps', 'k-turn', 'k-far', 'k-zigzag', 'k-coins', 'k-lava', 'k-fix', 'k-final'];
    const id = OLD[Math.min(save.pos.komandy, OLD.length - 1)] || OLD[0];
    const to = LESSONS.find(l => l.tasks.some(t => t.id === id));
    save.pos.prolog = 0;
    save.pos.komandy = 0;
    save.pos[to.id] = to.tasks.findIndex(t => t.id === id);
    if (save.lesson === 'komandy') save.lesson = to.id;
    if (save.seen.intro.komandy) save.seen.intro.prolog = true; // Аду они уже слышали
  }
  const persist = () => { if (SHOW) return; try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* ок */ } };
  // Пролог идёт без номера, уроки после него — «Урок 1», «Урок 2»…
  const lessonNo = i => i + (LESSONS[0].prologue ? 0 : 1);
  const lessonName = i => (LESSONS[i].prologue ? LESSONS[i].title : `Урок ${lessonNo(i)}. ${LESSONS[i].title}`);

  /* ---------- Состояние ---------- */
  let lessonIdx = LESSONS.findIndex(l => l.id === save.lesson);
  let TASKS = LESSONS[lessonIdx].tasks;
  let taskIdx = Math.min(save.pos[save.lesson] || 0, TASKS.length - 1);
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
  const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6b5a4a, 0.62);
  scene.add(hemi);
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
  Object.assign(M, {
    gate: new THREE.MeshStandardMaterial({ color: 0xb8742e, roughness: 0.8 }),
    gateBar: new THREE.MeshStandardMaterial({ color: 0x4a4f6a, metalness: 0.5, roughness: 0.4 }),
    boss: new THREE.MeshStandardMaterial({ color: 0x1b1e3c, emissive: 0xff2bd6, emissiveIntensity: 0.6, roughness: 0.4 }),
    bossFixed: new THREE.MeshStandardMaterial({ color: 0x8f7cff, emissive: 0x1fb89a, emissiveIntensity: 0.35, roughness: 0.4 }), // починенный Сбой
  });

  let levelGroup = new THREE.Group();
  scene.add(levelGroup);
  let coinMeshes = new Map();
  let flag = null, finishRing = null, boss = null;
  let gateMeshes = new Map(); // клетка ворот → створка

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
    arrow.name = 'arrow'; // стрелка «куда смотрит»: в портрете её прячем
    hero.add(body, head, ant, bulb, arrow);
    Object.assign(heroParts, { body, head, violet, violetLight, ant, bulb });
  })();
  const heroRig = new THREE.Group(); // для прыжков и сдвигов
  heroRig.add(hero);
  scene.add(heroRig);
  let heroAngle = 0;
  const DIR_ANGLE = [Math.PI / 2, Math.PI, Math.PI * 1.5, 0];

  /* ---------- Прокачка героя: уровень за звёзды во всём курсе, снаряжение видно на герое ---------- */
  const { LEVELS, ITEMS, SLOTS } = HeroGear;
  const gearOn = {}; // слот → 3D-модель надетой вещи
  function totalStars() {
    return LESSONS.reduce((n, l) => n + l.tasks.reduce((m, t) => m + (save.stars[t.id] || []).reduce((a, b) => a + b, 0), 0), 0);
  }
  const heroLevel = () => HeroGear.levelFor(totalStars());
  const isOpen = it => it.level <= heroLevel();
  function applyGear() {
    Object.keys(gearOn).forEach(slot => { hero.remove(gearOn[slot]); delete gearOn[slot]; });
    let colors = HeroGear.DEFAULT_COLORS;
    ITEMS.forEach(it => {
      if (save.gear[it.slot] !== it.id || !isOpen(it)) return;
      if (it.colors) colors = it.colors;
      else hero.add(gearOn[it.slot] = HeroGear.build(it.id, THREE));
    });
    heroParts.violet.color.setHex(colors[0]);
    heroParts.violetLight.color.setHex(colors[1]);
    heroParts.ant.visible = heroParts.bulb.visible = !gearOn.head; // шляпа и корона надеваются вместо антенны
  }
  applyGear();

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

  // Великий Сбой — первая программа Ады с ошибкой: тёмный куб с осколками вокруг.
  // Он же босс лабиринта (в финале его чинят) и он же — в сцене конца пролога
  function makeSboy() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.boss);
    core.castShadow = true;
    g.add(core);
    for (let i = 0; i < 4; i++) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), M.boss);
      bit.userData.a = (i * Math.PI) / 2;
      g.add(bit);
    }
    return g;
  }
  // Сбой дёргается и мерцает, а починенный спокойно кружится, осколки идут ровным кольцом
  function animateSboy(g, time, dt) {
    if (g.userData.fixed) {
      g.rotation.y += dt * 0.6;
      g.children[0].position.set(0, Math.sin(time * 1.5) * 0.06, 0);
      g.children.slice(1).forEach(b => { const a = b.userData.a + time * 0.8; b.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); });
      return;
    }
    g.rotation.y += dt * 1.5;
    const j = reduceMotion ? 0 : 0.05;
    g.children[0].position.set((Math.random() - 0.5) * j, Math.sin(time * 3) * 0.05, (Math.random() - 0.5) * j);
    g.children.slice(1).forEach((b, i) => {
      const a = b.userData.a + time * 2;
      b.position.set(Math.cos(a) * 0.45, Math.sin(time * 4 + i) * 0.12, Math.sin(a) * 0.45);
    });
    M.boss.emissive.setHex(!reduceMotion && Math.sin(time * 17) > 0.6 ? 0x2bf0ff : 0xff2bd6);
  }

  function buildLevel(level) {
    clearTrail();
    scene.remove(levelGroup);
    levelGroup.traverse(o => {
      if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose();
      if (o.material && o.material.isMaterial && o.material.map) o.material.map.dispose(); // у блоков — массив материалов
    });
    levelGroup = new THREE.Group();
    coinMeshes = new Map();
    gateMeshes = new Map();
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
    // ворота: столбы и створка поперёк дороги; при открытии створка уходит под землю
    level.gates.forEach(k => {
      const [x, z] = k.split(',').map(Number);
      const g = new THREE.Group();
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.72, 0.2), M.gate);
      door.position.y = 0.36;
      door.castShadow = true;
      [-0.28, 0, 0.28].forEach(bx => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.24), M.gateBar);
        bar.position.x = bx;
        door.add(bar);
      });
      g.add(door);
      // столбы и перекладина сверху: с камеры, которая смотрит вдоль створки, ворота видно по ним
      [-0.47, 0.47].forEach(px => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.24), M.gateBar);
        p.position.set(px, 0.52, 0);
        p.castShadow = true;
        g.add(p);
      });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.12, 0.26), M.gateBar);
      beam.position.y = 1.02;
      beam.castShadow = true;
      g.add(beam);
      g.position.set(x, 0, z);
      // дорога идёт вдоль x — створка встаёт поперёк неё
      if (level.floor.has(K(x - 1, z)) || level.floor.has(K(x + 1, z))) g.rotation.y = Math.PI / 2;
      levelGroup.add(g);
      gateMeshes.set(k, door);
    });
    // таблички: столбик и дощечка с числом, повёрнутая к камере
    level.signs.forEach((v, k) => {
      const [x, z] = k.split(',').map(Number);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), M.trunk);
      post.position.set(x + 0.3, 0.25, z + 0.3);
      post.castShadow = true;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      c.fillStyle = '#f3e2bf'; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = '#8a5a2b'; c.lineWidth = 6; c.strokeRect(3, 3, 58, 58);
      c.fillStyle = '#1b1e3c'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(v), 32, 35);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
      board.position.set(x + 0.3, 0.58, z + 0.3);
      board.rotation.y = cam.az;
      levelGroup.add(post, board);
    });
    // финиш: флаг; на карте с боссом — Великий Сбой; спрятанный флаг не рисуется
    const f = level.finish;
    flag = null; finishRing = null; boss = null;
    if (!level.hidden) {
      finishRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 28), M.ring);
      finishRing.rotation.x = -Math.PI / 2; finishRing.position.set(f.x, 0.015, f.z);
      levelGroup.add(finishRing);
    }
    if (level.boss) {
      boss = makeSboy();
      boss.position.set(f.x, 0.85, f.z);
      levelGroup.add(boss);
    } else if (!level.hidden) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), M.pole);
      pole.position.set(f.x + 0.28, 0.65, f.z - 0.28); pole.castShadow = true;
      const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.5, -0.16); fs.lineTo(0, -0.32); fs.lineTo(0, 0);
      flag = new THREE.Mesh(new THREE.ShapeGeometry(fs), M.flag);
      flag.position.set(f.x + 0.28, 1.28, f.z - 0.28);
      flag.castShadow = true;
      levelGroup.add(pole, flag);
    }
    scene.add(levelGroup);

    // герой в начало
    placeHero(level.start);
    heroParts.violet.emissive.setHex(0x000000);
    hero.scale.set(1, 1, 1);

    // камера и тени
    cam.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    // по диагонали: карта с поворотами широкая сразу в обе стороны и иначе не влезает в кадр
    const span = Math.max(Math.hypot(maxX - minX + 3, maxZ - minZ + 3), 6);
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
  // Темп анимации: ползунок скорости × ускорение задания (в лабиринтах шагов много — fast: 3)
  // × ускорение проверки (карты 2 и 3 идут вдвое быстрее: первую ученик смотрит, остальные — проверка)
  let boost = 1;
  const tempo = () => speed * boost * ((TASKS[taskIdx] && TASKS[taskIdx].fast) || 1);
  // fixed — длительность без учёта ползунка скорости (для сюжетных сцен)
  function tween(ms, fn, fixed = false) {
    const dur = Math.max(16, fixed ? ms : ms / tempo());
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
  function sparks(x, z, color, n = 16, y = 0.45) {
    const g = new THREE.SphereGeometry(0.04, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
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
    bubbleTimer = setTimeout(() => { bubble.className = 'bubble'; }, ms / Math.min(tempo(), 1.5) + 250);
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
    coinMeshes.forEach(c => {
      if (c.userData.taken) return;
      c.rotation.y = time * 2 + c.userData.phase;
      if (c.userData.missed) { // пропущенная монета подпрыгивает, чтобы её было видно
        c.scale.setScalar(1.4);
        c.position.y = 0.5 + (reduceMotion ? 0 : Math.abs(Math.sin(time * 4)) * 0.45);
      } else c.position.y = 0.42 + Math.sin(time * 2.4 + c.userData.phase) * 0.05;
    });
    if (gearOn.pet) { const a = time * 1.7; gearOn.pet.position.set(Math.cos(a) * 0.5, 0.8 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.5); }
    M.lava.emissiveIntensity = 0.75 + Math.sin(time * 3) * 0.25;
    if (flag) flag.rotation.y = Math.sin(time * 2.2) * 0.25;
    if (finishRing) finishRing.material.opacity = 0.35 + Math.sin(time * 3) * 0.2;
    if (guess) animateGuess(time);
    if (failRing && !reduceMotion) failRing.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    if (boss && boss.visible) animateSboy(boss, time, dt);
    if (cut) animateCut(time, dt);
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
      if (!drag) { onGuessHover(e); return; }
      cam.goal.az = drag.az - (e.clientX - drag.x) * 0.008;
      if (!drag.touch) cam.goal.el = Math.max(0.35, Math.min(1.5, drag.el + (e.clientY - drag.y) * 0.005));
    });
    // щелчок без перетаскивания — выбор клетки в режиме «Угадай»
    const up = e => {
      if (drag && e.type === 'pointerup' && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) onGuessPick(e);
      drag = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); cam.goal.dist = Math.max(5, Math.min(40, cam.goal.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  })();

  /* ---------- След героя: точки и стрелки по пройденному пути, дуга над прыжком ---------- */
  const trailGroup = new THREE.Group();
  scene.add(trailGroup);
  const TRAIL = {
    dot: new THREE.CircleGeometry(0.09, 20),
    seg: new THREE.PlaneGeometry(0.06, 1),
    chev: (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.1, -0.06); s.lineTo(0, 0.07); s.lineTo(0.1, -0.06); s.lineTo(0, -0.02); s.lineTo(-0.1, -0.06);
      return new THREE.ShapeGeometry(s);
    })(),
    hop: new THREE.SphereGeometry(0.035, 8, 6),
    ring: new THREE.RingGeometry(0.3, 0.42, 36),
    mat: new THREE.MeshBasicMaterial({ color: 0x6a55ea, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    fail: new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  };
  let failRing = null;
  // Плоская метка на земле; angle поворачивает её «носом» по направлению dx, dz
  function flat(geo, mat, x, z, y, dx = 0, dz = -1) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(-Math.PI / 2, 0, Math.atan2(-dx, -dz));
    m.position.set(x, y, z);
    trailGroup.add(m);
    return m;
  }
  function clearTrail() {
    while (trailGroup.children.length) trailGroup.remove(trailGroup.children[0]);
    failRing = null;
  }
  function trailStart(p) { clearTrail(); flat(TRAIL.dot, TRAIL.mat, p.x, p.z, 0.021); }
  function trailStep(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    flat(TRAIL.seg, TRAIL.mat, (a.x + b.x) / 2, (a.z + b.z) / 2, 0.02, dx, dz);
    flat(TRAIL.chev, TRAIL.mat, (a.x + b.x) / 2, (a.z + b.z) / 2, 0.024, dx, dz);
    flat(TRAIL.dot, TRAIL.mat, b.x, b.z, 0.021);
  }
  function trailHop(a, b) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8, m = new THREE.Mesh(TRAIL.hop, TRAIL.mat);
      m.position.set(a.x + (b.x - a.x) * t, 0.1 + Math.sin(t * Math.PI) * 0.85, a.z + (b.z - a.z) * t);
      trailGroup.add(m);
    }
    flat(TRAIL.dot, TRAIL.mat, b.x, b.z, 0.021);
  }
  // Где программа сломалась — красное кольцо
  function markFail(st) { if (st) failRing = flat(TRAIL.ring, TRAIL.fail, st.hero.x, st.hero.z, 0.035); }

  /* ---------- «Угадай»: на карте три варианта — А, Б, В. Один верный, два — частые ошибки.
     Ученик выбирает кнопкой, значком или клеткой, программа запускается, верный вариант загорается зелёным ---------- */
  const guessGroup = new THREE.Group();
  scene.add(guessGroup);
  const LETTERS = ['А', 'Б', 'В'];
  const GUESS_COLOR = { idle: '#6a55ea', right: '#1fa88f', wrong: '#ff8a3d', dim: '#9aa0c0' };
  // guess: { options: [{ x, z, letter, sprite, ring }], chosen } — пока идёт выбор и после запуска
  let guess = null, picking = false, hovered = -1;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), groundHit = new THREE.Vector3();

  // Где остановится Бит: программа прогоняется молча, без анимации (ошибка или победа — Бит там, где встал)
  function simulate(code, level) {
    const st = createState(level);
    const path = [{ x: st.hero.x, z: st.hero.z }];
    try {
      const g = MiniPy.execute(code, { ...MiniPy.stdlib(), ...commands(st) });
      // без ограничения цикл без команд героя (while True: pass) повесил бы страницу
      for (let r = g.next(), n = 0; !r.done && n < 20000; r = g.next(), n++) if (r.value.type === 'move' || r.value.type === 'jump') path.push({ x: r.value.to.x, z: r.value.to.z });
    } catch (e) { /* остановился здесь */ }
    return { end: { x: st.hero.x, z: st.hero.z }, dir: st.hero.dir, path };
  }
  // Верный ответ и два правдоподобных неверных: «дошёл до флага», «шагнул дальше», «на шаг раньше», «остался на старте»
  function guessOptions(sim, level) {
    const key = p => K(p.x, p.z), same = (a, b) => a.x === b.x && a.z === b.z;
    const [dx, dz] = HeroWorld.DIRS[sim.dir];
    const near = [...level.floor].map(k => { const [x, z] = k.split(',').map(Number); return { x, z }; })
      .sort((a, b) => (Math.abs(a.x - sim.end.x) + Math.abs(a.z - sim.end.z)) - (Math.abs(b.x - sim.end.x) + Math.abs(b.z - sim.end.z)));
    const cands = [level.hidden ? null : level.finish, { x: sim.end.x + dx, z: sim.end.z + dz },
      sim.path[sim.path.length - 2], sim.path[sim.path.length - 3], level.start, ...near];
    const picked = [sim.end];
    for (const c of cands) {
      if (picked.length === 3) break;
      if (c && level.floor.has(key(c)) && !level.lava.has(key(c)) && !picked.some(p => same(p, c))) picked.push({ x: c.x, z: c.z });
    }
    for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }
    return picked;
  }
  // Круглый значок с буквой (спрайт всегда повёрнут к камере и не прячется за стенами)
  function badgeTexture(letter, color) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = color; c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fill();
    c.lineWidth = 10; c.strokeStyle = '#ffffff'; c.stroke();
    c.fillStyle = '#ffffff'; c.font = 'bold 70px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(letter, 64, 70);
    return new THREE.CanvasTexture(cv);
  }
  function paintOption(o, color, opacity) {
    o.sprite.material.map.dispose();
    o.sprite.material.map = badgeTexture(o.letter, color);
    o.sprite.material.opacity = opacity;
    o.sprite.material.needsUpdate = true;
    o.ring.material.color.set(color);
    o.ring.material.opacity = 0.9 * opacity;
    $$('.guess-opt')[LETTERS.indexOf(o.letter)]?.style.setProperty('--opt', color);
  }
  function showOptions(points) {
    clearGuess();
    guess = { options: [], chosen: -1 };
    points.forEach((p, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(LETTERS[i], GUESS_COLOR.idle), transparent: true, depthTest: false }));
      sprite.scale.set(0.62, 0.62, 1);
      sprite.position.set(p.x, 1.3, p.z);
      sprite.renderOrder = 10;
      const ring = new THREE.Mesh(TRAIL.ring, new THREE.MeshBasicMaterial({ color: GUESS_COLOR.idle, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 0.045, p.z);
      guessGroup.add(sprite, ring);
      guess.options.push({ x: p.x, z: p.z, letter: LETTERS[i], sprite, ring });
    });
    // те же буквы — кнопками в подсказке над картой
    const box = $('#guessOpts');
    box.innerHTML = '';
    guess.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'guess-opt';
      b.textContent = o.letter;
      b.setAttribute('aria-label', `Вариант ${o.letter}`);
      b.addEventListener('click', () => chooseGuess(i));
      box.append(b);
    });
  }
  function clearGuess() {
    if (guess) guess.options.forEach(o => { o.sprite.material.map.dispose(); o.sprite.material.dispose(); o.ring.material.dispose(); });
    while (guessGroup.children.length) guessGroup.remove(guessGroup.children[0]);
    guess = null;
    hovered = -1;
  }
  // Значок покачивается; тот, что под курсором, крупнее
  function animateGuess(time) {
    guess.options.forEach((o, i) => {
      o.sprite.position.y = 1.3 + (reduceMotion ? 0 : Math.sin(time * 3 + i) * 0.06);
      const s = picking && i === hovered ? 0.76 : 0.62;
      o.sprite.scale.set(s, s, 1);
    });
  }
  // Вариант под курсором: значок или клетка под ним
  function optionFromEvent(e) {
    if (!guess) return -1;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(guess.options.map(o => o.sprite))[0];
    if (hit) return guess.options.findIndex(o => o.sprite === hit.object);
    if (!ray.ray.intersectPlane(ground, groundHit)) return -1;
    const x = Math.round(groundHit.x), z = Math.round(groundHit.z);
    return guess.options.findIndex(o => o.x === x && o.z === z);
  }
  function startGuess() {
    if (running) return;
    if (picking) { cancelGuess(); return; }
    clearLog(); hideResult(); markLine(null);
    const code = ta.value;
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    showMap(mapIdx); // Бит снова на старте
    showOptions(guessOptions(simulate(code, maps[mapIdx]), maps[mapIdx]));
    picking = true;
    $('#guessHud').hidden = false;
    $('#guessBtn').setAttribute('aria-pressed', 'true');
    stage.classList.add('picking');
    log('Прочитай программу. Где Бит остановится, когда она закончится: А, Б или В?', 'info');
  }
  // Отмена: убрать и подсказку, и значки
  function cancelGuess() { stopPicking(); clearGuess(); }
  function stopPicking() {
    picking = false;
    hovered = -1;
    $('#guessHud').hidden = true;
    $('#guessBtn').setAttribute('aria-pressed', 'false');
    stage.classList.remove('picking', 'over-opt');
  }
  function onGuessHover(e) {
    if (!picking) return;
    hovered = optionFromEvent(e);
    stage.classList.toggle('over-opt', hovered >= 0);
  }
  function onGuessPick(e) {
    if (!picking) return;
    const i = optionFromEvent(e);
    if (i < 0) { say('Выбери А, Б или В', 'bad', 1200); return; }
    chooseGuess(i);
  }
  function chooseGuess(i) {
    if (!picking || !guess || !guess.options[i]) return;
    guess.chosen = i;
    stopPicking();
    guess.options.forEach((o, j) => paintOption(o, j === i ? GUESS_COLOR.idle : GUESS_COLOR.dim, j === i ? 1 : 0.5));
    runGuess();
  }
  async function runGuess() {
    const code = ta.value, token = ++runToken;
    stepMode = false;
    setRunning(true);
    showMap(mapIdx);
    const o = guess.options[guess.chosen];
    log(`Твой ответ — ${o.letter}. Смотрим, где остановится Бит.`, 'map');
    await wait(400);
    if (token !== runToken) return;
    const r = await runOnMap(code, token);
    if (r.aborted || token !== runToken) return;
    setRunning(false);
    markLine(null);
    const h = r.st.hero, right = h.x === o.x && h.z === o.z;
    const answer = guess.options.find(p => p.x === h.x && p.z === h.z);
    save.predict.tries++;
    if (right) save.predict.hits++;
    persist();
    // верный вариант — зелёный, неверный выбор — оранжевый, остальные гаснут
    guess.options.forEach(p => paintOption(p,
      p === answer ? GUESS_COLOR.right : p === o ? GUESS_COLOR.wrong : GUESS_COLOR.dim,
      p === answer || p === o ? 1 : 0.35));
    const score = `Угадано: ${save.predict.hits} из ${save.predict.tries}.`;
    if (right) {
      say('Верно!', 'yes', 1400);
      confetti(o.x, o.z, 30);
      Sound.play('right');
      log(`Верно! Ответ — ${o.letter}. ${score}`, 'ok');
    } else {
      Sound.play('wrong');
      log(`Мимо: Бит остановился на клетке ${answer ? answer.letter : 'рядом'}, а твой ответ — ${o.letter}. Пройди по следу Бита и найди место, где его путь расходится с твоей догадкой. ${score}`, 'tip');
    }
    // почему Бит встал именно там; где он стоит, и так видно по зелёному значку — без красного кольца
    if (!r.ok) reportError(r.err, 0, '', !right); // угадал — пусть в облачке останется «Верно!»
    if (r.ok) log(maps.length > 1 ? 'Программа дошла до флага на этой карте. Нажми «Запуск», чтобы проверить все три.' : 'Программа дошла до флага. Нажми «Запуск», чтобы засчитать задание.', 'info');
  }

  /* ---------- Сцена конца пролога: Ада показывает Ключ-код, Сбой его крадёт.
     Эффекты привязаны к репликам (третий элемент реплики, список — STORY.fx) и идут, пока реплика на экране ---------- */
  const world = $('.world');
  const KEY_MAT = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xb86b00, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.25 });
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return (glowTex = new THREE.CanvasTexture(cv));
  }
  // Золотой ключ: кольцо, стержень, две бородки и свечение. Внутренняя группа покачивается, внешняя летает
  function makeKey() {
    const g = new THREE.Group(), inner = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 24), KEY_MAT);
    bow.position.y = 0.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.46, 10), KEY_MAT);
    shaft.position.y = -0.13;
    const bit1 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.05), KEY_MAT);
    bit1.position.set(0.075, -0.31, 0);
    const bit2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.05), KEY_MAT);
    bit2.position.set(0.055, -0.2, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd76a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.4, 1.4, 1);
    inner.add(glow, bow, shaft, bit1, bit2);
    g.add(inner);
    g.userData.inner = inner;
    return g;
  }
  let cut = null, talkFx = null, lightTok = 0; // cut: { f, key, sboy } — пока идёт сцена
  // Убрать ключ или Сбоя со сцены. Материалы общие (M.boss, KEY_MAT, свечение) — их не трогаем
  function drop(o) {
    if (!o) return;
    scene.remove(o);
    o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.isSprite) m.material.dispose(); });
  }
  const LIGHT = { hemi: hemi.intensity, sun: sun.intensity };
  function dimLights(k, ms) {
    const tok = ++lightTok, h0 = hemi.intensity, s0 = sun.intensity;
    return tween(ms, t => {
      if (tok !== lightTok) return; // сцену пропустили — свет уже вернули
      hemi.intensity = h0 + (LIGHT.hemi * k - h0) * t;
      sun.intensity = s0 + (LIGHT.sun * k - s0) * t;
    }, true);
  }
  function glitchPulse() {
    if (reduceMotion) return;
    world.classList.remove('glitch');
    void world.offsetWidth; // перезапуск CSS-анимации
    world.classList.add('glitch');
    setTimeout(() => world.classList.remove('glitch'), 700);
  }
  const CUT_FX = {
    key() { // над флагом поднимается Ключ-код
      const { f } = cut, k = cut.key = makeKey();
      k.position.set(f.x, 1.2, f.z);
      k.scale.setScalar(0.01);
      scene.add(k);
      sparks(f.x, f.z, 0xffc83d, 24, 1.3);
      Sound.play('key');
      tween(1100, t => { const e = ease(t); k.position.y = 1.2 + e * 0.95; k.scale.setScalar(0.01 + e * 1.49); }, true);
    },
    sboy() { // небо темнеет, мир дрожит, появляется Сбой
      if (!cut.key) CUT_FX.key();
      const { f } = cut, g = cut.sboy = makeSboy();
      world.classList.add('storm');
      glitchPulse();
      Sound.play('glitch');
      dimLights(0.45, 700);
      if (!reduceMotion) cam.shake = 0.35;
      // Сбой зависает рядом с ключом, со стороны центра карты — чтобы не уйти за край кадра
      const dx = cam.target.x - f.x, dz = cam.target.z - f.z, len = Math.hypot(dx, dz);
      const [ux, uz] = len > 0.5 ? [dx / len, dz / len] : [-1, 0], d = Math.min(1.7, Math.max(1.2, len));
      g.position.set(f.x + ux * d, 2.45, f.z + uz * d);
      g.scale.setScalar(0.01);
      scene.add(g);
      sparks(g.position.x, g.position.z, 0xff2bd6, 30, g.position.y);
      tween(600, t => g.scale.setScalar(0.01 + ease(t) * 1.29), true);
    },
    async steal() { // Сбой хватает ключ и улетает
      if (!cut.sboy) CUT_FX.sboy();
      const my = cut, { key, sboy } = cut; // если сцену пропустят или начнут заново, эта уже не продолжается
      glitchPulse();
      const from = key.position.clone(), to = sboy.position.clone().add(new THREE.Vector3(0, -0.9, 0));
      Sound.play('steal');
      await tween(600, t => key.position.lerpVectors(from, to, ease(t)), true);
      if (cut !== my) return;
      if (!reduceMotion) cam.shake = 0.25;
      sparks(sboy.position.x, sboy.position.z, 0xff2bd6, 20, sboy.position.y);
      await tween(1500, () => {}, true); // висит с ключом, пока читают его реплику
      if (cut !== my) return;
      glitchPulse();
      Sound.play('steal');
      const y0 = sboy.position.y, k0 = key.scale.x, s0 = sboy.scale.x;
      await tween(1000, t => {
        const e = t * t, s = 1 - e * 0.85;
        sboy.position.y = y0 + e * 4.5;
        key.position.y = y0 - 0.9 + e * 4.5;
        sboy.scale.setScalar(s0 * s); key.scale.setScalar(k0 * s);
      }, true);
      if (cut !== my) return;
      drop(sboy); drop(key);
      cut.sboy = cut.key = null;
      world.classList.remove('storm');
      dimLights(1, 900);
    },
  };
  function animateCut(time, dt) {
    if (cut.key) {
      cut.key.rotation.y += dt * 1.8;
      cut.key.userData.inner.position.y = reduceMotion ? 0 : Math.sin(time * 2.2) * 0.06;
    }
    if (cut.sboy) animateSboy(cut.sboy, time, dt);
  }
  // Реплики со сценой: эффекты по ходу, в конце (и при «Пропустить») мир возвращается как был
  function cutscene(lines, done) {
    endCutscene();
    cut = { f: maps[mapIdx].finish, key: null, sboy: null };
    talkFx = fx => { if (cut && CUT_FX[fx]) CUT_FX[fx](); };
    talk(lines, () => { endCutscene(); if (done) done(); });
  }
  function endCutscene() {
    talkFx = null;
    if (!cut) return;
    drop(cut.key);
    drop(cut.sboy);
    cut = null;
    lightTok++;
    hemi.intensity = LIGHT.hemi;
    sun.intensity = LIGHT.sun;
    world.classList.remove('storm', 'glitch');
  }

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
        Sound.play('tick');
        say(ev.text, typeof ev.value === 'boolean' ? (ev.value ? 'yes' : 'no') : '', 850);
        await wait(380);
        return;
      case 'move': {
        Sound.play('step');
        const fx = ev.from.x, fz = ev.from.z, tx = ev.to.x, tz = ev.to.z;
        await tween(360, t => {
          const e = ease(t);
          heroRig.position.set(fx + (tx - fx) * e, 0, fz + (tz - fz) * e);
          hero.position.y = Math.sin(t * Math.PI) * 0.14;
        });
        hero.position.y = 0;
        trailStep(ev.from, ev.to);
        return;
      }
      case 'jump': {
        const fx = ev.from.x, fz = ev.from.z, tx = ev.to.x, tz = ev.to.z;
        say('Прыжок!', 'yes', 700);
        Sound.play('jump');
        await tween(620, t => {
          const e = ease(t);
          heroRig.position.set(fx + (tx - fx) * e, 0, fz + (tz - fz) * e);
          hero.position.y = Math.sin(t * Math.PI) * 1.05;
          hero.scale.set(1, 1 + Math.sin(t * Math.PI) * 0.1, 1);
        });
        hero.position.y = 0; hero.scale.set(1, 1, 1);
        Sound.play('land');
        trailHop(ev.from, ev.to);
        return;
      }
      case 'turn': {
        Sound.play('turn');
        const a0 = heroAngle, a1 = heroAngle + ev.side * Math.PI / 2;
        heroAngle = a1;
        await tween(260, t => { hero.rotation.y = a0 + (a1 - a0) * ease(t); });
        return;
      }
      case 'take': {
        const k = K(ev.x, ev.z), c = coinMeshes.get(k);
        say(`+1 монета (${ev.count} из ${ev.total})`, 'yes', 800);
        Sound.play('coin', { n: ev.count });
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
        Sound.play('bump');
        const [dx, dz] = HeroWorld.DIRS[st.hero.dir];
        if (!reduceMotion) cam.shake = 0.25;
        await tween(300, t => { const s = Math.sin(t * Math.PI) * 0.25; hero.position.set(dx * s, 0, dz * s); });
        hero.position.set(0, 0, 0);
        return;
      }
      case 'burn': {
        say('Горячо!', 'bad', 1400);
        Sound.play('burn');
        sparks(st.hero.x, st.hero.z, 0xff5a1f, 24);
        heroParts.violet.emissive.setHex(0xff2a00);
        await tween(700, t => { hero.position.y = -t * 0.55; });
        return;
      }
      case 'grab-air': {
        say('Пусто…', 'bad', 1400);
        Sound.play('air');
        await tween(320, t => { const s = Math.sin(t * Math.PI); hero.scale.set(1 + s * 0.12, 1 - s * 0.18, 1 + s * 0.12); });
        hero.scale.set(1, 1, 1);
        return;
      }
      case 'full': {
        say('Рюкзак полон!', 'bad', 1400);
        Sound.play('nope');
        await tween(360, t => { hero.rotation.z = Math.sin(t * Math.PI * 3) * 0.12; });
        hero.rotation.z = 0;
        return;
      }
      case 'shrug': {
        say(ev.text || 'Зачем прыгать?', 'bad', 1400);
        Sound.play('nope');
        await tween(360, t => { hero.rotation.z = Math.sin(t * Math.PI * 3) * 0.12; });
        hero.rotation.z = 0;
        return;
      }
      case 'open': {
        say('Открыто!', 'yes', 900);
        Sound.play('gate');
        const door = gateMeshes.get(K(ev.x, ev.z));
        if (door) await tween(450, t => { door.position.y = 0.36 - t * 0.8; });
        return;
      }
      case 'say': {
        say(`«${ev.text}»`, 'yes', 1600);
        Sound.play('talk');
        await wait(700);
        return;
      }
      case 'win': {
        if (boss) { // Бит добрался до Сбоя — ошибка найдена: Сбой успокаивается, светлеет и поднимается над Битом
          say('Сбой починен!', 'yes', 1600);
          Sound.play('fixed');
          const b = boss, y0 = b.position.y;
          b.userData.fixed = true;
          b.children.forEach(m => { m.material = M.bossFixed; });
          sparks(b.position.x, b.position.z, 0x3fd3b5, 30, 1);
          await tween(900, t => { b.position.y = y0 + ease(t) * 1.1; b.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.25); });
        } else { say('Ура, флаг!', 'yes', 1100); Sound.play('win'); }
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
  // команды героя по-русски и по-английски (move() — это вперёд())
  const HERO_CMDS = ['вперёд', ...Object.keys(HeroWorld.EN), ...Object.values(HeroWorld.EN)];
  const KWS = ['for', 'in', 'if', 'elif', 'else', 'while', 'and', 'or', 'not', 'True', 'False', 'None', 'pass', 'break', 'continue', 'def', 'return'];
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
  let markedLine = null, markedKind = '', reelTyping = false;
  function refreshEditor() {
    hl.innerHTML = highlight(ta.value);
    if (reelTyping) hl.innerHTML = hl.innerHTML.replace(/\n $/, '<i class="reel-caret"></i>\n '); // курсор, пока «печатается» код
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
    if (guess && !running) cancelGuess(); // варианты посчитаны для прежнего кода
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

  function renderLessons() {
    const sel = $('#lessonSel');
    sel.innerHTML = '';
    LESSONS.forEach((l, i) => {
      const got = l.tasks.reduce((n, t) => n + (save.stars[t.id] || []).reduce((a, b) => a + b, 0), 0);
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${lessonName(i)} · ★ ${got} из ${l.tasks.length * 3}`;
      sel.append(o);
    });
    sel.value = lessonIdx;
  }

  function renderBadge() {
    const stars = totalStars(), n = HeroGear.levelFor(stars), cur = LEVELS[n - 1], next = LEVELS[n];
    $('#hbLvl').textContent = n;
    $('#hbTitle').textContent = cur.title;
    $('#hbBar').style.width = next ? `${Math.round(((stars - cur.stars) / (next.stars - cur.stars)) * 100)}%` : '100%';
    $('#heroBtn').setAttribute('aria-label', `${STORY.hero}, уровень ${n}: ${cur.title}. Снаряжение`);
  }

  function renderTabs() {
    renderLessons();
    renderBadge();
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

  function selectLesson(li) {
    lessonIdx = li;
    TASKS = LESSONS[li].tasks;
    selectTask(Math.min(save.pos[LESSONS[li].id] || 0, TASKS.length - 1));
  }

  function selectTask(i) {
    stopRun();
    cancelGuess();
    taskIdx = i;
    save.lesson = LESSONS[lessonIdx].id;
    save.pos[save.lesson] = i;
    const t = TASKS[i];
    if (!save.seeds[t.id]) save.seeds[t.id] = 1000 + Math.floor(Math.random() * 90000);
    maps = makeMaps(t, save.seeds[t.id]);
    persist();
    $('#taskNum').textContent = `${lessonStory().place || lessonName(lessonIdx)} · задание ${i + 1} из ${TASKS.length}`;
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
    if (i === 0 && LESSONS[lessonIdx].intro) log(LESSONS[lessonIdx].intro, 'tip');
    log(maps.length > 1
      ? 'Нажми «Запуск»: код проверится на трёх разных картах. «Шаг» выполняет программу по одной строке.'
      : 'Нажми «Запуск», и герой выполнит программу. «Шаг» выполняет её по одной строке.', 'info');
    // в уроках без условий карта одна: переключатель карт и «Новые карты» не нужны
    $('.hud.tl').hidden = maps.length === 1;
    $('#newMapsBtn').hidden = maps.length === 1;
    $('#againBtn').hidden = maps.length === 1;
    dotStates = ['', '', ''];
    showMap(0);
  }

  function showMap(i) {
    mapIdx = i;
    buildLevel(maps[i]);
    updateCoins(0, maps[i].need || maps[i].coins.size);
    setDots(dotStates);
    $('#mapLabel').textContent = `Карта ${i + 1} из ${maps.length}`;
  }

  dots.forEach((d, i) => d.addEventListener('click', () => { if (!running) { dotStates = ['', '', '']; cancelGuess(); showMap(i); } }));

  /* ---------- Запуск ---------- */
  function setRunning(on) {
    running = on;
    if (!on) boost = 1;
    ta.readOnly = on;
    document.body.classList.toggle('is-running', on);
    $('#runBtn').textContent = on && stepMode ? 'Без остановок' : 'Запуск';
    $('#runBtn').disabled = on && !stepMode;
    $('#stopBtn').disabled = !on;
    $('#guessBtn').disabled = on;
  }

  function stopRun() {
    runToken++;
    stepMode = false;
    if (stepResolve) { stepResolve(); stepResolve = null; }
    for (const tw of [...tweens]) { tweens.delete(tw); tw.res(); }
    setRunning(false);
  }

  // Прогон на текущей карте; в ответе и состояние мира (st) — где Бит остановился
  async function runOnMap(code, token) {
    const st = createState(maps[mapIdx]);
    trailStart(st.hero);
    const g = MiniPy.execute(code, { ...MiniPy.stdlib(), ...commands(st) });
    while (true) {
      if (token !== runToken) return { aborted: true };
      let r;
      try { r = g.next(); }
      catch (e) {
        if (e instanceof WinSignal) return { ok: true, st };
        return { ok: false, err: e, st };
      }
      if (r.done) {
        const err = endCheck(st, code);
        if (err) return { ok: false, err, st };
        await animate({ type: 'win' }, st); // флаг засчитывается в конце программы
        return { ok: true, st };
      }
      await animate(r.value, st);
      if (token !== runToken) return { aborted: true };
      if (stepMode && r.value.type === 'line') {
        await new Promise(res => { stepResolve = res; });
        stepResolve = null;
      }
    }
  }

  // Бит всё понимает буквально — и так и говорит в облачке
  const BIT_SAYS = { extra: 'Тут флаг, а команды ещё есть!', short: 'Команды кончились — стою.', coins: 'Что написано, то и взял!', loop: 'Хожу по кругу… как написано.' };
  function reportError(err, mIdx, code = '', bitTalks = true) {
    const line = err.line || null;
    if (line) markLine(line, 'err'); else markLine(null);
    log(err.message, 'err', line);
    Sound.play('fail');
    if (bitTalks && BIT_SAYS[err.kind]) say(BIT_SAYS[err.kind], 'no', 2200);
    if (err.kind === 'coins' && !maps[mapIdx].need) {
      coinMeshes.forEach(c => { if (!c.userData.taken) c.userData.missed = true; });
      log('Пропущенные монеты подпрыгивают на карте: посмотри, мимо каких прошёл герой.', 'tip');
    }
    if (mIdx > 0 && err.kind && err.kind !== 'short' && err.kind !== 'stuck') {
      const hasCondition = /^\s*(if|elif|while)\b/m.test(code);
      log(hasCondition
        ? `На карте ${mIdx} всё сработало, а на карте ${mIdx + 1} — нет. Условие у тебя уже есть, но здесь оно не помогло. Нажми «Шаг» и посмотри, где герой ошибается.`
        : `На карте ${mIdx} всё сработало, а на карте ${mIdx + 1} — нет. Код должен работать на любой карте: для этого и нужны условия.`, 'tip');
    }
  }

  async function runAll() {
    if (running) {
      if (stepMode) { stepMode = false; setRunning(true); if (stepResolve) stepResolve(); }
      return;
    }
    const code = ta.value;
    cancelGuess();
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    const token = ++runToken;
    stepMode = false;
    setRunning(true);
    dotStates = ['', '', ''];
    for (let m = 0; m < maps.length; m++) {
      boost = m > 0 ? 2 : 1;
      showMap(m);
      dotStates[m] = 'active'; setDots(dotStates);
      if (maps.length > 1) log(`Карта ${m + 1} из ${maps.length}`, 'map');
      await wait(420);
      if (token !== runToken) return;
      const r = await runOnMap(code, token);
      if (r.aborted || token !== runToken) return;
      if (!r.ok) {
        dotStates[m] = 'fail'; setDots(dotStates);
        markFail(r.st);
        reportError(r.err, m, code);
        // для звезды «с первого запуска»: запуск нетронутого стартового кода не считается
        const id = TASKS[taskIdx].id;
        if (codeLines(code).join('\n') !== codeLines(TASKS[taskIdx].starter).join('\n')) {
          save.fails[id] = (save.fails[id] || 0) + 1;
          persist();
        }
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
    cancelGuess();
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    const token = ++runToken;
    stepMode = true;
    setRunning(true);
    dotStates = ['', '', ''];
    showMap(mapIdx);
    log(maps.length > 1
      ? `Пошаговый режим на карте ${mapIdx + 1}. Нажимай «Шаг», чтобы выполнить следующую строку.`
      : 'Пошаговый режим. Нажимай «Шаг», чтобы выполнить следующую строку.', 'map');
    const r = await runOnMap(code, token);
    if (r.aborted || token !== runToken) return;
    stepMode = false;
    setRunning(false);
    if (r.ok) {
      markLine(null);
      log(maps.length > 1
        ? `Карта ${mapIdx + 1} пройдена. Нажми «Запуск», чтобы проверить код на всех трёх картах.`
        : 'Получилось! Нажми «Запуск», чтобы засчитать задание.', 'ok');
    }
    else { markFail(r.st); reportError(r.err, 0); }
  }

  // строки кода без пустых и комментариев
  function codeLines(code) { return code.split('\n').map(l => l.trimEnd()).filter(l => l.trim() && !l.trim().startsWith('#')); }

  function finishTask(code) {
    const t = TASKS[taskIdx];
    const lines = codeLines(code).length;
    const first = !save.fails[t.id];
    const got = [1, hintsUsed() === 0 ? 1 : 0, (t.star3 === 'first' ? first : lines <= t.best) ? 1 : 0];
    const prev = save.stars[t.id] || [0, 0, 0];
    const lvlBefore = heroLevel();
    save.stars[t.id] = prev.map((v, i) => (v || got[i] ? 1 : 0));
    // новый уровень: открытые вещи сразу надеваются, чтобы их было видно на герое
    const lvl = heroLevel(), fresh = ITEMS.filter(it => it.level > lvlBefore && it.level <= lvl);
    fresh.forEach(it => { save.gear[it.slot] = it.id; });
    if (fresh.length) applyGear();
    $('#resLevel').hidden = lvl <= lvlBefore;
    $('#resLevel').textContent = `Новый уровень ${lvl}: ${LEVELS[lvl - 1].title}!`
      + (fresh.length ? ` Открыто: ${fresh.map(it => it.name.toLowerCase()).join(', ')}.` : '');
    // урок пройден целиком: на «Дальше» проводник квеста скажет прощальные слова
    outroPending = !save.seen.outro[LESSONS[lessonIdx].id] && TASKS.every(x => (save.stars[x.id] || [])[0]);
    persist();
    renderTabs();
    const r = $('#result');
    r.hidden = false;
    Sound.play('stars', { n: got.reduce((a, b) => a + b, 0) });
    if (lvl > lvlBefore) Sound.play('levelup');
    $('#resStars').innerHTML = starsHtml(got);
    $('#resList').innerHTML = `
      <li class="${got[0] ? 'on' : ''}">${maps.length > 1 ? 'Код работает на всех трёх картах' : 'Герой дошёл до флага'}</li>
      <li class="${got[1] ? 'on' : ''}">Решено без подсказок</li>
      <li class="${got[2] ? 'on' : ''}">${t.star3 === 'first'
        ? (got[2] ? 'Сработало с первого запуска' : 'С первого запуска не вышло. Совет: проверяй код кнопкой «Шаг», такие проверки не считаются')
        : `Коротко: ${lines} ${plural(lines, 'строка', 'строки', 'строк')}${got[2] ? '' : `, а можно уложиться в ${t.best}`}`}</li>`;
    const last = taskIdx === TASKS.length - 1;
    const nextLesson = LESSONS[lessonIdx + 1];
    const pro = LESSONS[lessonIdx].prologue;
    const allDone = TASKS.every(x => (save.stars[x.id] || [])[0]);
    $('#resTitle').textContent = last && allDone ? (pro ? 'Пролог пройден!' : 'Все задания урока пройдены!') : maps.length > 1 ? 'Готово! Код работает на любой карте.' : 'Готово!';
    $('#nextBtn').textContent = !last ? `Задание ${taskIdx + 2}: ${TASKS[taskIdx + 1].short}`
      : pro && outroPending ? 'Дальше' // впереди сцена со Сбоем — не выдаём её заранее
      : nextLesson ? `Урок ${lessonNo(lessonIdx + 1)}: ${nextLesson.title}` : 'К первому заданию';
    if (maps.length > 1) log('Все три карты пройдены.', 'ok');
  }
  function hideResult() { $('#result').hidden = true; }
  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; }

  /* ---------- Звук: включается после первого нажатия (так требуют браузеры), кнопка в углу мира ---------- */
  const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
  function renderSoundBtn() {
    const on = !save.mute, b = $('#soundBtn');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Звук включён' : 'Звук выключен');
    b.title = on ? 'Выключить звук' : 'Включить звук';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}${on
      ? '<path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
    Sound.muted = !!save.mute;
  }
  renderSoundBtn();
  $('#soundBtn').addEventListener('click', () => { save.mute = !save.mute; persist(); renderSoundBtn(); Sound.play('tick'); });
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => Sound.unlock(), true));

  /* ---------- Режим показа для видео на Авито (?show): титульная карточка, затем Бит сам проходит уровни —
     код печатается буква за буквой, — и финальная карточка. Запись экрана становится роликом.
     Тексты карточек и список уровней — в REEL; карты всегда одни и те же (seed) ---------- */
  const REEL = {
    title: { kicker: 'Python для детей от 12 лет', name: 'Долина Эникей', lead: 'Ребёнок пишет настоящий код — робот Бит выполняет его в 3D-мире.' },
    // speed — скорость анимации уровня: где много проверок в цикле, быстрее, чтобы ролик уложился примерно в минуту
    items: [
      { id: 'k-lava', what: 'Команды по порядку: шаг, прыжок, взять', speed: 1.4 },
      { id: 'c-stairs', what: 'Цикл for: повторить четыре раза', speed: 1.8 },
      { id: 'choice', what: 'if, elif, else: программа сама решает, что делать', again: 'Другая карта — тот же код', speed: 3 },
      { id: 'p-gates', what: 'Цикл while: повторять, пока Бит не у флага', speed: 2.5 },
      { id: 'l-boss', what: 'Английские команды — как в настоящем Python', speed: 3 },
    ],
    end: {
      name: 'Долина Эникей',
      lines: ['Занятия с репетитором один на один, онлайн', 'Пролог и 7 уроков: команды, циклы, условия, while, переменные, функции'],
      cta: 'Напишите — пришлю ссылку на пробное занятие',
    },
    seed: 7,
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Ждём клавишу или щелчок: звук в браузере включается только после действия человека
  function waitPress() {
    return new Promise(res => {
      const h = e => {
        if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
        if (e.key === 'Escape') { location.href = location.pathname; return; } // выйти из режима показа
        e.preventDefault();
        removeEventListener('keydown', h, true); removeEventListener('pointerdown', h, true);
        Sound.unlock();
        res();
      };
      addEventListener('keydown', h, true); addEventListener('pointerdown', h, true);
    });
  }
  function reelCard(c, hint) {
    const el = $('#reel');
    $('#reelKicker').textContent = c.kicker || '';
    $('#reelName').textContent = c.name;
    $('#reelLead').textContent = c.lead || '';
    $('#reelLines').innerHTML = (c.lines || []).map(l => `<li>${esc(l)}</li>`).join('');
    $('#reelCta').hidden = !c.cta;
    $('#reelCta').textContent = c.cta || '';
    $('#reelHint').textContent = hint || '';
    el.classList.remove('out');
    el.hidden = false;
    startPortrait($('#reelHero'));
  }
  async function hideReelCard() {
    const el = $('#reel');
    el.classList.add('out');
    await sleep(600);
    el.hidden = true;
    stopPortrait();
  }
  // Код «печатается»: буква за буквой, отступы — сразу, на переносе строки — пауза
  async function typeCode(code) {
    ta.value = '';
    reelTyping = true;
    refreshEditor();
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      ta.value += ch;
      if (ch === ' ' && (i === 0 || code[i - 1] === '\n' || code[i - 1] === ' ')) continue;
      refreshEditor();
      Sound.play('type');
      await sleep(ch === '\n' ? 150 : 28 + Math.random() * 24);
    }
    reelTyping = false;
    refreshEditor();
  }
  async function reelRun() {
    const token = ++runToken;
    stepMode = false;
    setRunning(true);
    const r = await runOnMap(ta.value, token);
    setRunning(false);
    ta.readOnly = true;
    markLine(null);
    return r;
  }
  function reelToast(text) {
    const t = $('#reelToast');
    t.textContent = text;
    t.hidden = !text;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  }
  async function startReel() {
    document.body.classList.add('show-mode');
    addEventListener('keydown', e => { if (e.key === 'Escape') location.href = location.pathname; }); // выйти в обычный режим
    speed = 1.4;
    ta.readOnly = true;
    resize();
    reelCard(REEL.title, 'Включи запись экрана и нажми любую клавишу. Esc — выйти из режима показа');
    await waitPress();
    $('#reelHint').textContent = '';
    Sound.play('key');
    await sleep(2600);
    await hideReelCard();
    for (const it of REEL.items) {
      const li = LESSONS.findIndex(l => l.tasks.some(t => t.id === it.id));
      if (li < 0) continue;
      selectLesson(li);
      speed = it.speed || 1.4;
      const ti = TASKS.findIndex(t => t.id === it.id), t = TASKS[ti];
      selectTask(ti);
      maps = makeMaps(t, REEL.seed);
      dotStates = ['', '', ''];
      showMap(0);
      ta.readOnly = true;
      ta.value = '';
      refreshEditor();
      reelToast('');
      $('#reelLesson').textContent = lessonName(li);
      $('#reelTitle').textContent = t.title;
      $('#reelWhat').textContent = it.what;
      const cap = $('#reelCap');
      cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
      await sleep(800);
      await typeCode(t.hints[2]);
      await sleep(400);
      await reelRun();
      if (it.again && maps.length > 1) {
        await sleep(700);
        reelToast(it.again);
        showMap(1);
        await sleep(1200);
        await reelRun();
      }
      await sleep(1100);
    }
    reelToast('');
    reelCard(REEL.end, '');
    Sound.play('win');
    await sleep(1500);
    $('#reelHint').textContent = 'Любая клавиша — сначала, Esc — выйти';
    await waitPress();
    location.reload();
  }

  /* ---------- Кнопки ---------- */
  $('#runBtn').addEventListener('click', runAll);
  $('#stepBtn').addEventListener('click', stepRun);
  $('#guessBtn').addEventListener('click', startGuess);
  $('#guessCancel').addEventListener('click', () => { cancelGuess(); log('Догадку отменили.', 'info'); });
  // Клавиши в режиме «Угадай»: 1, 2, 3 или А, Б, В — выбрать, Esc — отменить
  addEventListener('keydown', e => {
    if (!picking) return;
    if (e.key === 'Escape') { cancelGuess(); log('Догадку отменили.', 'info'); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName)) return;
    const i = ['1', '2', '3'].indexOf(e.key) >= 0 ? ['1', '2', '3'].indexOf(e.key) : LETTERS.indexOf(e.key.toUpperCase());
    if (i >= 0 && guess && guess.options[i]) { e.preventDefault(); chooseGuess(i); }
  });
  $('#stopBtn').addEventListener('click', () => { stopRun(); cancelGuess(); markLine(null); log('Остановлено.', 'info'); showMap(mapIdx); });
  $('#speed').addEventListener('input', e => { speed = parseFloat(e.target.value); $('#speedVal').textContent = speed.toFixed(1).replace('.', ',') + '×'; });
  $('#topBtn').addEventListener('click', () => {
    cam.top = !cam.top; fitCamera();
    $('#topBtn').setAttribute('aria-pressed', String(cam.top));
    $('#topBtn').textContent = cam.top ? 'Вид сбоку' : 'Вид сверху';
  });
  $('#newMapsBtn').addEventListener('click', () => {
    if (running) return;
    cancelGuess();
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
  $('#nextBtn').addEventListener('click', () => {
    const next = () => {
      if (taskIdx < TASKS.length - 1) selectTask(taskIdx + 1);
      else if (LESSONS[lessonIdx + 1]) { selectLesson(lessonIdx + 1); greet(); }
      else selectTask(0);
    };
    if (!outroPending) { next(); return; }
    outroPending = false;
    const L = LESSONS[lessonIdx];
    save.seen.outro[L.id] = true;
    persist();
    hideResult();
    // конец пролога — сцена со Сбоем, потом итог для родителя
    if (L.prologue) cutscene(lessonStory().outro, openRecap);
    else talk(lessonStory().outro, next);
  });
  $('#lessonSel').addEventListener('change', e => {
    if (running) { e.target.value = lessonIdx; return; }
    selectLesson(+e.target.value);
    greet();
  });
  $('#againBtn').addEventListener('click', () => { hideResult(); $('#newMapsBtn').click(); });

  /* ---------- Снаряжение героя ---------- */
  function renderGear() {
    const stars = totalStars(), n = HeroGear.levelFor(stars), next = LEVELS[n];
    $('#recapBtn').hidden = !prologueDone();
    $('#gearTitle').textContent = `${STORY.hero} · уровень ${n}, ${LEVELS[n - 1].title.toLowerCase()}`;
    $('#gearSub').textContent = next
      ? `Звёзд: ${stars}. До уровня ${n + 1} — ещё ${next.stars - stars}. За уровни открываются вещи.`
      : `Звёзд: ${stars}. Это высший уровень!`;
    const list = $('#gearList');
    list.innerHTML = '';
    ITEMS.forEach(it => {
      const on = save.gear[it.slot] === it.id, open = isOpen(it);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gear-item';
      b.disabled = !open;
      b.setAttribute('aria-pressed', String(on && open));
      const name = document.createElement('span');
      name.textContent = it.name;
      const state = document.createElement('span');
      state.className = 'gi-state';
      state.textContent = !open ? `уровень ${it.level}` : on ? 'надето' : SLOTS[it.slot];
      b.append(name, state);
      b.addEventListener('click', () => { save.gear[it.slot] = on ? null : it.id; persist(); applyGear(); renderGear(); });
      const li = document.createElement('li');
      li.append(b);
      list.append(li);
    });
  }
  $('#heroBtn').addEventListener('click', () => {
    const p = $('#gearPanel');
    p.hidden = !p.hidden;
    if (!p.hidden) renderGear();
  });
  $('#gearClose').addEventListener('click', () => { $('#gearPanel').hidden = true; });
  $('#storyBtn').addEventListener('click', () => {
    $('#gearPanel').hidden = true;
    const L = LESSONS[lessonIdx], s = lessonStory();
    // после пролога в историю входит и кража Ключ-кода — с тем же представлением в 3D
    const theft = !L.prologue && PRO >= 0 && save.seen.outro[LESSONS[PRO].id] ? STORY.lessons[LESSONS[PRO].id].outro : [];
    cutscene([...STORY.prologue, ...theft, ...(s.intro || []), ...(save.seen.outro[L.id] ? s.outro || [] : [])]);
  });
  $('#recapBtn').addEventListener('click', () => { $('#gearPanel').hidden = true; openRecap(); });

  /* ---------- Итог пролога: карточка для ученика и родителя после пробного занятия ---------- */
  const PRO = LESSONS.findIndex(l => l.prologue);
  const solved = t => !!(save.stars[t.id] || [])[0];
  const prologueDone = () => PRO >= 0 && LESSONS[PRO].tasks.every(solved);
  const lessonStars = l => l.tasks.reduce((n, t) => n + (save.stars[t.id] || []).reduce((a, b) => a + b, 0), 0);
  const KEY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.5" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M11.7 12H21M17.5 12v3.4M20.5 12v2.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  function openRecap() {
    if (PRO < 0) return;
    const L = LESSONS[PRO], tasks = L.tasks, last = tasks[tasks.length - 1], next = LESSONS[PRO + 1];
    const stars = lessonStars(L), lines = tasks.reduce((n, t) => n + codeLines(save.code[t.id] ?? t.hints[2]).length, 0);
    const lvl = heroLevel(), items = ITEMS.filter(isOpen).map(it => it.name.toLowerCase());
    $('#recapDate').textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    $('#recapStats').innerHTML = [
      [tasks.length, `${plural(tasks.length, 'программа', 'программы', 'программ')} на Python`],
      [lines, `${plural(lines, 'строка', 'строки', 'строк')} кода`],
      [`${stars}<small> из ${tasks.length * 3}</small>`, plural(stars, 'звезда', 'звезды', 'звёзд')],
      [lvl, `уровень · ${LEVELS[lvl - 1].title}`],
    ].map(([v, k]) => `<li><b>${v}</b><span>${k}</span></li>`).join('');
    $('#recapLvl').textContent = lvl;
    $('#recapGear').textContent = items.length ? `Бит получил: ${items.join(', ')}` : '';
    $('#recapTasks').innerHTML = tasks.map(t => `<li><span>${esc(t.title)}</span><span class="stars">${starsHtml(save.stars[t.id] || [0, 0, 0])}</span></li>`).join('');
    $('#recapCmds').innerHTML = [...new Set(tasks.flatMap(t => t.cmds))].map(c => `<code>${esc(c)}</code>`).join('');
    // сверху — комментарий с названием задания, как в настоящем файле с кодом
    $('#recapCode').innerHTML = highlight(`# ${last.title}\n${codeLines(save.code[last.id] ?? last.hints[2]).join('\n')}`).replace(/\n $/, '');
    const rest = LESSONS.length - PRO - 1;
    $('#recapNextText').textContent = `Сбой унёс Ключ-код в свой замок. Чтобы вернуть его, Бит пройдёт всю долину: ${rest} ${plural(rest, 'урок', 'урока', 'уроков')} — от длинных дорог до циклов, условий и своих команд.`;
    $('#recapPath').innerHTML = LESSONS.map((l, i) => {
      const done = l.tasks.every(solved), end = i === LESSONS.length - 1;
      const mark = done ? '✓' : end ? KEY_ICON : lessonNo(i);
      return `<li class="${done ? 'done' : ''}${end ? ' end' : ''}" title="${esc((STORY.lessons[l.id] || {}).place || '')}"><i>${mark}</i><span>${esc(l.title)}</span></li>`;
    }).join('');
    $('#recapGo').hidden = !next || lessonIdx !== PRO; // «Дальше» — только из самого пролога
    if (next) $('#recapGo').textContent = `Дальше: урок ${lessonNo(PRO + 1)} «${next.title}»`;
    $('#recap').hidden = false;
    document.body.classList.add('recap-open');
    startPortrait();
    ($('#recapGo').hidden ? $('#recapClose') : $('#recapGo')).focus({ preventScroll: true });
  }
  function closeRecap() {
    $('#recap').hidden = true;
    document.body.classList.remove('recap-open');
    stopPortrait();
  }
  // 3D-портрет Бита в снаряжении: своя маленькая сцена, клон героя медленно поворачивается
  let portrait = null;
  function startPortrait(box = $('#recapHero')) {
    stopPortrait();
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.setSize(box.clientWidth || 150, box.clientHeight || 150, false);
    r.domElement.className = 'recap-canvas';
    box.prepend(r.domElement);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7fb0, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(2, 4, 3);
    sc.add(key);
    const bot = hero.clone(true);
    bot.position.set(0, 0, 0);
    bot.rotation.set(0, 0, 0);
    bot.scale.set(1, 1, 1);
    bot.getObjectByName('arrow').visible = false;
    sc.add(bot);
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    c.position.set(0, 0.9, 2.35);
    c.lookAt(0, 0.5, 0);
    let raf = 0;
    const loop = t => {
      bot.rotation.y = reduceMotion ? 0.45 : 0.35 + Math.sin(t / 1500) * 0.65;
      r.render(sc, c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    portrait = { r, raf: () => raf };
  }
  function stopPortrait() {
    if (!portrait) return;
    cancelAnimationFrame(portrait.raf());
    portrait.r.dispose();
    portrait.r.forceContextLoss();
    portrait.r.domElement.remove();
    portrait = null;
  }
  $('#recapGo').addEventListener('click', () => { closeRecap(); selectLesson(PRO + 1); greet(); });
  $('#recapClose').addEventListener('click', closeRecap);
  $('#recap').addEventListener('click', e => { if (e.target.id === 'recap') closeRecap(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#recap').hidden) closeRecap(); });

  /* ---------- Сюжет: реплики персонажей (js/story.js) ---------- */
  let talkQueue = [], talkDone = null, outroPending = false;
  function lessonStory() { return STORY.lessons[LESSONS[lessonIdx].id] || {}; }
  function talk(lines, done) {
    if (!lines || !lines.length) { if (done) done(); return; }
    talkQueue = lines.slice();
    talkDone = done || null;
    showLine();
  }
  function showLine() {
    const [who, text, fx] = talkQueue.shift();
    const p = STORY.people[who];
    const face = $('#talkFace');
    face.textContent = p.letter;
    face.style.background = p.color;
    $('#talkName').textContent = p.role ? `${p.name}, ${p.role}` : p.name;
    $('#talkText').textContent = text;
    $('#talkNext').textContent = talkQueue.length ? 'Дальше' : 'Понятно';
    $('#talk').classList.toggle('sboy', who === 'sboy'); // реплики Сбоя «сбоят»
    $('#talk').hidden = false;
    if (fx && talkFx) talkFx(fx);
    $('#talkNext').focus({ preventScroll: true });
  }
  function endTalk() {
    $('#talk').hidden = true;
    talkQueue = [];
    const done = talkDone;
    talkDone = null;
    if (done) done(); else ta.focus({ preventScroll: true });
  }
  $('#talkNext').addEventListener('click', () => (talkQueue.length ? showLine() : endTalk()));
  $('#talkSkip').addEventListener('click', endTalk);
  // При входе в урок: пролог — один раз за всю игру, вступление урока — один раз для каждого урока
  function greet() {
    const id = LESSONS[lessonIdx].id, lines = [];
    if (!save.seen.prologue) { lines.push(...STORY.prologue); save.seen.prologue = true; }
    if (!save.seen.intro[id]) { lines.push(...(lessonStory().intro || [])); save.seen.intro[id] = true; }
    persist();
    talk(lines);
  }

  /* ---------- Заставка «Нажми любую клавишу» ---------- */
  (function splashScreen() {
    const sp = $('#splash');
    if (SHOW) { sp.remove(); return; } // в режиме показа вместо заставки — титульная карточка ролика
    if (!sp) { setTimeout(greet); return; }
    const go = () => {
      Sound.unlock();
      removeEventListener('keydown', onKey, true);
      sp.classList.add('hide');
      setTimeout(() => sp.remove(), 400);
      ta.focus({ preventScroll: true });
      greet();
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
  if (SHOW) startReel();
})();
