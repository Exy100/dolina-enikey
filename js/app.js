/* ===== Долина Эникей: интерфейс и 3D ===== */
(() => {
  const { LESSONS, K, makeMaps, createState, commands, endCheck, WinSignal } = HeroWorld;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Сохранение ---------- */
  const STORE = 'mir-geroya-usloviya-v1';
  const blankSave = () => ({ lesson: null, pos: {}, code: {}, stars: {}, hints: {}, seeds: {}, fails: {}, gear: {}, seen: { intro: {}, outro: {} }, predict: { tries: 0, hits: 0 }, warm: {}, first: {} });
  let save = blankSave();
  try { const raw = localStorage.getItem(STORE); if (raw) save = Object.assign(save, JSON.parse(raw)); } catch (e) { /* без сохранения */ }
  // Режим показа для видео (?show): свой Бит — в шляпе, шарфе и с рюкзаком; прогресс ученика не читаем и не пишем
  // Кадры для объявления (?shots) — тоже показ: свой Бит, прогресс ученика не читаем и не пишем
  const SHOTS = new URLSearchParams(location.search).has('shots');
  const SHOW = SHOTS || new URLSearchParams(location.search).has('show');
  if (SHOW) {
    const stars = {};
    ['k-steps', 'k-turn', 'k-coins', 'k-lava', 'k-far'].forEach(id => { stars[id] = [1, 1, 1]; });
    save = Object.assign(blankSave(), { stars, gear: { head: 'hat', neck: 'scarf', back: 'bag' }, mute: SHOTS });
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
  // Задания урока: основные (их номера хранятся в save.pos), задание со звёздочкой (kind: 'bonus') и разминка
  // (kind: 'warm') — копия задания прошлого урока со своим id «w:…», свежими картами, с нуля и без звёзд.
  // На вкладках разминка идёт первой, звёздочка — последней
  const warmCache = {};
  function warmTask(id) {
    if (warmCache[id]) return warmCache[id];
    const from = LESSONS.findIndex(l => l.tasks.some(t => t.id === id));
    if (from < 0) return null;
    const o = LESSONS[from].tasks.find(t => t.id === id);
    return (warmCache[id] = {
      ...o, id: 'w:' + id, kind: 'warm', from,
      starter: `# Разминка: «${o.title}» из урока «${LESSONS[from].title}».\n# Напиши программу с нуля — вспомни, как это делается.\n`,
    });
  }
  function lessonTasks(li) {
    const l = LESSONS[li];
    (l.bonus || []).forEach(t => { t.kind = 'bonus'; });
    const own = customTask();
    return [...l.tasks, ...(l.bonus || []), ...(l.warmup || []).map(warmTask).filter(Boolean), ...HeroBridge.tasksOf(l.id), ...(own ? [own] : [])];
  }
  /* Свой уровень (редактор или ссылка #level=…) — вкладка «Свой уровень» в конце любого урока. Решение строит
     HeroWorld.checkLevel (для «Показать решение» и третьей звезды); звёзды за свои уровни в уровень Бита не идут */
  const cleanTitle = t => String(t || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  const hashStr = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0).toString(36); };
  function customTask() {
    const c = save.custom;
    if (!c || SHOW) return null;
    const chk = HeroWorld.checkLevel(c.rows);
    if (!chk.ok) return null;
    const title = cleanTitle(c.title) || 'Свой уровень', coins = chk.L.coins.size;
    return {
      id: 'my:' + hashStr(JSON.stringify(c.rows)), kind: 'custom', basic: true, map: c.rows, title, short: 'Свой уровень',
      goal: `Доведи Бита до флага${coins ? (coins === 1 ? ' и собери монету' : ' и собери все монеты') : ''}. Этот уровень нарисован в редакторе.`,
      news: 'Свой уровень: карту нарисовали в редакторе. Реши его, а потом отправь ссылку другу — пусть попробует.',
      cmds: ['вперёд()', 'налево()', 'направо()', 'взять()', 'прыгнуть()', 'for i in range(3):'],
      starter: `# Свой уровень «${title}».\n# Пиши программу здесь.\n`,
      hints: [
        'Раздели путь на прямые куски: до поворота, поворот, снова до поворота. Где лава — прыгнуть(), где монета — взять().',
        'Числа в скобках сокращают программу: вперёд(3) — три шага. Повторяющиеся куски можно завернуть в цикл for.',
        chk.sol,
      ],
      best: codeLines(chk.sol).length,
    };
  }
  // Уровень по ссылке (#level=…): становится своим уровнем и открывается сразу
  const b64enc = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64dec = str => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)));
  function levelFromLink() {
    const m = location.hash.match(/^#level=([A-Za-z0-9_-]{4,2000})$/);
    if (!m || SHOW) return false;
    let ok = false;
    try {
      const d = JSON.parse(b64dec(m[1]));
      if (HeroWorld.checkLevel(d.r).ok) { save.custom = { title: cleanTitle(d.t), rows: d.r }; ok = true; persist(); }
    } catch (e) { /* битая ссылка — просто откроется игра */ }
    history.replaceState(null, '', location.href.split('#')[0]);
    return ok;
  }
  const openOwn = levelFromLink();
  // Домашка по ссылке (#hw=id,id… или #task=id): список запоминается в save.hw, первое нерешённое задание открывается сразу
  function findTask(id) {
    for (let li = 0; li < LESSONS.length; li++) {
      const t = [...LESSONS[li].tasks, ...(LESSONS[li].bonus || []), ...HeroBridge.tasksOf(LESSONS[li].id)].find(x => x.id === id);
      if (t) return { li, t };
    }
    return null;
  }
  function hwFromLink() {
    const m = location.hash.match(/^#(?:hw|task)=([\w,-]{1,600})$/);
    if (!m || SHOW) return false;
    history.replaceState(null, '', location.href.split('#')[0]);
    const ids = [...new Set(m[1].split(','))].filter(findTask).slice(0, 24);
    if (!ids.length) return false;
    save.hw = { ids, at: Date.now() };
    persist();
    return true;
  }
  const openHw = hwFromLink();
  const MAIN = () => LESSONS[lessonIdx].tasks;
  const solvedTask = t => (t.kind === 'py' ? !!(save.py || {})[t.id] : !!(save.stars[t.id] || [])[0]); // в консоли звёзд нет — только «решено»
  const firstOpen = () => Math.max(0, MAIN().findIndex(t => !solvedTask(t)));

  /* ---------- Состояние ---------- */
  let lessonIdx = LESSONS.findIndex(l => l.id === save.lesson);
  let TASKS = lessonTasks(lessonIdx);
  let taskIdx = Math.min(save.pos[save.lesson] || 0, TASKS.length - 1);
  let maps = [];
  let mapIdx = 0;
  let runToken = 0;
  let running = false;
  let stepMode = false;
  let stepResolve = null;
  let speed = 1;

  /* Небо за миром (слои под 3D): ночью звёзды, дальние летучие островки, облачные гряды внизу и птицы днём.
     Цвета — переменные --sky-* из style.css, движение — CSS (без него при prefers-reduced-motion и в лёгкой графике) */
  (function paintSky() {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const f = n => n.toFixed(1);
    let stars = '';
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 1200, y = rnd() * 470, r = 0.9 + rnd() * 1.6;
      stars += `<circle class="${i % 4 ? '' : 'tw'}" style="animation-delay:${f(-rnd() * 4)}s" cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
    }
    // островок: плоская верхушка, каменный клин вниз, ёлочки
    const isle = (x, y, w, trees) => {
      const h = w * 0.55, t = w * 0.09;
      let d = `M${f(x - w / 2)} ${f(y)} Q${f(x)} ${f(y - t)} ${f(x + w / 2)} ${f(y)} L${f(x + w * 0.32)} ${f(y + h * 0.35)} L${f(x + w * 0.12)} ${f(y + h * 0.55)} L${f(x)} ${f(y + h)} L${f(x - w * 0.16)} ${f(y + h * 0.5)} L${f(x - w * 0.36)} ${f(y + h * 0.3)}Z`;
      trees.forEach(([dx, s]) => { const tx = x + dx * w, ty = y - t * 0.6; d += `M${f(tx - w * 0.08 * s)} ${f(ty)} L${f(tx)} ${f(ty - w * 0.24 * s)} L${f(tx + w * 0.08 * s)} ${f(ty)}Z`; });
      return `<path d="${d}"/>`;
    };
    // облачная гряда: ряд кругов на общей нижней кромке
    const bank = (x, y, w, n) => {
      let c = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="400" rx="40"/>`;
      for (let i = 0; i < n; i++) { const r = 26 + rnd() * 38; c += `<circle cx="${f(x + (i + 0.5) * w / n)}" cy="${f(y + 18)}" r="${f(r)}"/>`; }
      return c;
    };
    const bird = (x, y, s) => `<path d="M${f(x - 9 * s)} ${f(y - 3 * s)} Q${f(x - 4 * s)} ${f(y - 6 * s)} ${f(x)} ${f(y)} Q${f(x + 4 * s)} ${f(y - 6 * s)} ${f(x + 9 * s)} ${f(y - 3 * s)}"/>`;
    $('#sky').innerHTML = `<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <g class="sky-stars">${stars}</g>
      <g class="sky-isles">
        <g class="bob">${isle(150, 250, 120, [[-0.18, 1], [0.05, 0.8]])}</g>
        <g class="bob b2">${isle(1060, 400, 90, [[0.15, 0.9]])}</g>
        <g class="bob b3">${isle(330, 470, 60, [[-0.05, 1]])}</g>
      </g>
      <g class="sky-banks">
        <g class="drift">${bank(-120, 690, 620, 7)}</g>
        <g class="drift d2">${bank(640, 715, 700, 8)}</g>
      </g>
      <g class="sky-banks near"><g class="drift d3">${bank(180, 790, 900, 9)}</g></g>
      <g class="sky-birds"><g class="fly">${bird(0, 0, 1)}${bird(26, 12, 0.75)}${bird(-20, 16, 0.6)}</g></g>
    </svg>`;
  })();

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
  const hemi = new THREE.HemisphereLight(0xffe6d4, 0x7a5f8a, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9b0, 0.82);
  sun.position.set(6, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  const M = {
    grassA: new THREE.MeshStandardMaterial({ color: 0x86c76a, flatShading: true, roughness: 0.9 }),
    grassB: new THREE.MeshStandardMaterial({ color: 0x79bb5f, flatShading: true, roughness: 0.9 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0xb08258, flatShading: true, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x7e7090, flatShading: true, roughness: 1 }),
    stoneA: new THREE.MeshStandardMaterial({ color: 0x6c6690, flatShading: true, roughness: 0.95 }),
    stoneB: new THREE.MeshStandardMaterial({ color: 0x5d5880, flatShading: true, roughness: 0.95 }),
    lava: new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3b0a, emissiveIntensity: 0.9, flatShading: true, roughness: 0.6 }),
    // золото и железо — почти без «металла»: отражать в сцене нечего (карты отражений нет), и металл темнеет до бурого.
    // Блеск даёт блик солнца, тёплый цвет — свечение. Так же в gear.js и на острове героя
    coin: new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xa86400, emissiveIntensity: 0.35, metalness: 0.15, roughness: 0.35 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7b4f2e, flatShading: true }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4cb070, flatShading: true }),
    pole: new THREE.MeshStandardMaterial({ color: 0xf3f0ff, roughness: 0.5 }),
    flag: new THREE.MeshStandardMaterial({ color: 0x1fa88f, side: THREE.DoubleSide, flatShading: true }),
    ring: new THREE.MeshBasicMaterial({ color: 0x7ef0d6, transparent: true, opacity: 0.55 }),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  Object.assign(M, {
    gate: new THREE.MeshStandardMaterial({ color: 0xb8742e, roughness: 0.8 }),
    gateBar: new THREE.MeshStandardMaterial({ color: 0x6a6f92, metalness: 0.15, roughness: 0.5 }),
    boss: new THREE.MeshStandardMaterial({ color: 0x1b1e3c, emissive: 0xff2bd6, emissiveIntensity: 0.6, roughness: 0.4 }),
    bossFixed: new THREE.MeshStandardMaterial({ color: 0x8f7cff, emissive: 0x1fb89a, emissiveIntensity: 0.35, roughness: 0.4 }), // починенный Сбой
    // днище летучего острова: цвет каждой глыбы — в самой глыбе (сверху земля, ниже камень), материал только притеняет ночью
    under: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }),
    underBit: new THREE.MeshStandardMaterial({ color: 0x8a7aa0, flatShading: true, roughness: 1 }),
  });
  const UNDER = { top: 0xa47a62, deep: 0x7a6a98 };
  // Пятно тени под Битом и монетами: в «Лёгкой графике» теней нет, и без пятна герой будто висит в воздухе.
  // Видно только в лёгкой графике (applyLite)
  const BLOB = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(58,42,77,.55)'); gr.addColorStop(0.5, 'rgba(58,42,77,.35)'); gr.addColorStop(1, 'rgba(58,42,77,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(cv);
    const mat = () => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, visible: false });
    return { geo: new THREE.PlaneGeometry(1, 1), hero: mat(), coin: mat() };
  })();
  const blobGroup = new THREE.Group(); // пятна монет: живут отдельно от levelGroup, чтобы общая текстура не выбрасывалась вместе с картой
  scene.add(blobGroup);
  function addBlob(parent, mat, x, z, size) {
    const b = new THREE.Mesh(BLOB.geo, mat);
    b.rotation.x = -Math.PI / 2;
    b.position.set(x, 0.01, z);
    b.scale.setScalar(size);
    b.userData.size = size;
    parent.add(b);
    return b;
  }

  /* Море облаков под островом: пухлые облака из икосаэдров в три слоя (нижние прозрачнее) медленно плывут.
     Живут в сцене всегда, при новой карте только переезжают под неё */
  const cloudSea = new THREE.Group();
  scene.add(cloudSea);
  const CLOUD_LAYERS = [{ y: -6, op: 0.9 }, { y: -9, op: 0.7 }, { y: -13, op: 0.5 }];
  const cloudMats = CLOUD_LAYERS.map(l => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, transparent: true, opacity: l.op, depthWrite: false }));
  const CLOUD_R = 16; // облака бродят в квадрате ±CLOUD_R вокруг середины карты (в единицах до масштаба)
  (function makeClouds() {
    const puff = new THREE.IcosahedronGeometry(1, 1);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 0; n < 18; n++) {
      const layer = n % 3, cl = new THREE.Group();
      const parts = 3 + Math.floor(rnd() * 3), w = 0.55 + rnd() * 0.5;
      for (let p = 0; p < parts; p++) {
        const m = new THREE.Mesh(puff, cloudMats[layer]);
        const r = (p === 0 ? 1 : 0.55 + rnd() * 0.35) * w;
        m.position.set((p === 0 ? 0 : (rnd() - 0.5) * 2.6 * w), (rnd() - 0.3) * 0.25 * w, (p === 0 ? 0 : (rnd() - 0.5) * 1.2 * w));
        m.scale.set(r, r * 0.5, r * 0.8);
        m.rotation.y = rnd() * 6.28;
        cl.add(m);
      }
      cl.position.set((rnd() * 2 - 1) * CLOUD_R, CLOUD_LAYERS[layer].y + (rnd() - 0.5) * 0.8, (rnd() * 2 - 1) * CLOUD_R);
      cl.userData.v = 0.18 + rnd() * 0.12 + layer * 0.04;
      cl.userData.lite = n % 2 === 0; // в лёгкой графике остаётся каждое второе
      cloudSea.add(cl);
    }
  })();
  /* День и ночь: в тёмной теме мир освещён луной — свет холодный и тусклый, земля темнее и зеленее,
     а монеты, флаг и лава светятся сильнее, чтобы их было видно */
  let night = false;
  const LOOK = {
    day: { hemi: [0xffe6d4, 0x7a5f8a, 0.6], sun: [0xffd9b0, 0.82], grassA: 0x86c76a, grassB: 0x79bb5f, dirt: 0xb08258, rock: 0x7e7090, stoneA: 0x6c6690, stoneB: 0x5d5880, leaf: 0x4cb070, coinGlow: 0.35, flagGlow: 0, lava: 1,
      under: 0xffffff, underBit: 0x8a7aa0, cloud: 0xffffff, cloudGlow: 0xffe4ea, cloudGlowK: 0.62, cloudOp: 1 },
    night: { hemi: [0xb4bff2, 0x3a2f60, 0.62], sun: [0xc9d0ff, 0.5], grassA: 0x5aaa6c, grassB: 0x4f9e61, dirt: 0x87624a, rock: 0x6a6088, stoneA: 0x58557f, stoneB: 0x4e4b72, leaf: 0x3a9461, coinGlow: 0.8, flagGlow: 0.3, lava: 1.3,
      under: 0x8e86b4, underBit: 0x5c547e, cloud: 0x51487a, cloudGlow: 0x221a44, cloudGlowK: 0.5, cloudOp: 0.7 },
  };
  function applyNight() {
    const dark = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    night = dark && !SHOW; // в показе для объявления мир всегда дневной
    const L = night ? LOOK.night : LOOK.day;
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    ['grassA', 'grassB', 'dirt', 'rock', 'stoneA', 'stoneB', 'leaf'].forEach(k => M[k].color.setHex(L[k]));
    M.coin.emissiveIntensity = L.coinGlow;
    M.flag.emissive.setHex(0x1fa88f); M.flag.emissiveIntensity = L.flagGlow;
    M.under.color.setHex(L.under); M.underBit.color.setHex(L.underBit);
    cloudMats.forEach((m, i) => { m.color.setHex(L.cloud); m.emissive.setHex(L.cloudGlow); m.emissiveIntensity = L.cloudGlowK; m.opacity = CLOUD_LAYERS[i].op * L.cloudOp; });
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyNight);
  new MutationObserver(applyNight).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyNight();

  let levelGroup = new THREE.Group();
  scene.add(levelGroup);
  let coinMeshes = new Map();
  let flag = null, finishRing = null, boss = null;
  let gateMeshes = new Map(); // клетка ворот → створка

  /* Герой. Облик (HeroGear.SKINS) — форма тела и головы; лицо, ноги и антенна двигаются одинаково у всех, поэтому
     каждая модель собирается из тех же именованных частей (heroParts). Модель можно собрать и для другой сцены
     (buildHeroParts возвращает свою группу и свои материалы) */
  const hero = new THREE.Group();
  const heroParts = {};
  const skinOf = id => (HeroGear.SKINS.find(s => s.id === id) || HeroGear.SKINS[0]);
  function buildHeroParts(skinId) {
    const sk = skinOf(skinId).id, box = sk === 'pixel', cat = sk === 'iskra', root = new THREE.Group();
    const violet = new THREE.MeshStandardMaterial({ color: 0x6b4bd8, flatShading: true, roughness: 0.55 });
    const violetLight = new THREE.MeshStandardMaterial({ color: 0x8f7cff, roughness: 0.45 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: 0x3a2a4d, roughness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0x6b4500, emissiveIntensity: 0.4 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xffc2b0, roughness: 0.6 });
    const body = new THREE.Mesh(box ? new THREE.BoxGeometry(0.38, 0.34, 0.3) : new THREE.CylinderGeometry(cat ? 0.17 : 0.2, cat ? 0.22 : 0.25, 0.4, 10), violet);
    body.position.y = box ? 0.25 : 0.26; body.castShadow = true;
    const head = new THREE.Mesh(box ? new THREE.BoxGeometry(0.4, 0.36, 0.34) : new THREE.SphereGeometry(0.21, 20, 16), violetLight);
    head.position.y = 0.62; head.castShadow = true;
    if (cat) head.scale.x = 1.08;
    body.name = 'body'; head.name = 'head';
    // Лицо и ноги двигаются (раздел «Живой Бит»). rest — спокойное положение: копии героя (остров, портреты)
    // возвращаются к нему, чтобы не застыть с закрытыми глазами или грустным ртом (faceRest)
    const rest = (o, visible = true) => { o.visible = visible; o.userData.rest = { p: o.position.toArray(), s: o.scale.toArray(), r: [o.rotation.x, o.rotation.y, o.rotation.z], v: visible }; return o; };
    const eyeGeo = new THREE.SphereGeometry(0.065, 12, 10), pupilGeo = new THREE.SphereGeometry(0.032, 10, 8);
    const arcGeo = new THREE.TorusGeometry(0.042, 0.014, 6, 12, Math.PI); // дуга ∩: закрытый от радости глаз «^»
    const eyes = [], pupils = [], joy = [], squint = [], feet = [];
    const armGeo = new THREE.BoxGeometry(0.075, 0.018, 0.018);
    // слева от героя — +x (он смотрит в +z)
    [0.085, -0.085].forEach(x => {
      const e = new THREE.Mesh(eyeGeo, white); e.position.set(x, 0.65, box ? 0.17 : 0.165); e.name = 'eye';
      const p = new THREE.Mesh(pupilGeo, black); p.position.set(x, 0.65, 0.218); p.name = 'pupil';
      const j = new THREE.Mesh(arcGeo, black); j.position.set(x, 0.645, 0.195); j.rotation.set(-0.25, Math.sign(x) * 0.45, 0); // внешний край — назад по голове
      // «> <»: зажмурился от удара — галочки острыми концами к середине лица
      const q = new THREE.Group(), sx = Math.sign(x);
      q.position.set(x, 0.65, 0.2); q.rotation.y = sx * 0.4;
      [1, -1].forEach(up => {
        const arm = new THREE.Mesh(armGeo, black);
        arm.position.y = up * 0.017; arm.rotation.z = up * sx * 0.46;
        q.add(arm);
      });
      root.add(e, p, j, q);
      eyes.push(e); pupils.push(p); joy.push(j); squint.push(q);
    });
    // рот виден только с настроением: улыбка ∪ или грусть ∩
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 14, Math.PI), black);
    mouth.position.set(0, 0.54, 0.192);
    // антенна на шарнире у макушки: от грусти никнет, от радости качается
    const antPivot = new THREE.Group();
    antPivot.position.y = 0.8;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), black);
    ant.position.y = 0.1; ant.name = 'ant';
    const bulb = new THREE.Mesh(box ? new THREE.BoxGeometry(0.075, 0.075, 0.075) : new THREE.SphereGeometry(0.05, 10, 8), gold);
    bulb.position.y = 0.22; bulb.name = 'bulb';
    if (box) bulb.rotation.set(0.6, 0.78, 0);
    antPivot.add(ant, bulb);
    const feetGeo = box ? new THREE.BoxGeometry(0.14, 0.08, 0.2) : new THREE.SphereGeometry(0.09, 10, 8);
    [0.1, -0.1].forEach(x => {
      const f = new THREE.Mesh(feetGeo, black); f.position.set(x, box ? 0.045 : 0.05, 0.03);
      if (!box) f.scale.set(1, 0.6, 1.3);
      root.add(f); feet.push(f);
    });
    const tri = new THREE.Shape();
    tri.moveTo(-0.16, 0); tri.lineTo(0.16, 0); tri.lineTo(0, 0.2); tri.lineTo(-0.16, 0);
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.9 }));
    arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.012, 0.3);
    arrow.name = 'arrow'; // стрелка «куда смотрит»: в портрете её прячем
    root.add(body, head, mouth, antPivot, arrow);
    const ears = []; let tail = null;
    if (box) { // кубик: тёмный экран под глазами, болты по бокам головы, огонёк на груди
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.02), black);
      screen.position.set(0, 0.645, 0.172);
      const bolts = [0.205, -0.205].map(x => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 8), black); b.rotation.z = Math.PI / 2; b.position.set(x, 0.62, 0); return b; });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.02), gold);
      lamp.position.set(0, 0.27, 0.152);
      root.add(screen, lamp, ...bolts);
    }
    if (cat) { // ушки: снаружи цвет головы, внутри розовое; хвост виляет; щёчки и усики
      [1, -1].forEach(s => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 4), violetLight);
        ear.position.set(s * 0.125, 0.82, 0); ear.rotation.z = -s * 0.28; ear.castShadow = true;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), pink);
        inner.position.set(0, -0.005, 0.03);
        ear.add(inner); ear.name = 'ear'; ears.push(ear);
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), pink);
        cheek.position.set(s * 0.13, 0.585, 0.14); cheek.scale.z = 0.4;
        root.add(ear, cheek);
        [-1, 0, 1].forEach(k => {
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.007, 0.007), black);
          w.position.set(s * 0.215, 0.58 + k * 0.022, 0.07); w.rotation.set(0, -s * 0.5, s * k * 0.2);
          root.add(w);
        });
      });
      tail = new THREE.Group(); tail.name = 'tail';
      tail.position.set(0, 0.2, -0.2);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.04, -0.12), new THREE.Vector3(0.06, 0.16, -0.2), new THREE.Vector3(0.1, 0.32, -0.17)]);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.032, 6), violet); stem.castShadow = true;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gold); tip.position.set(0.1, 0.32, -0.17);
      tail.add(stem, tip);
      root.add(tail);
    }
    [head, antPivot, bulb, ...eyes, ...pupils, ...feet].forEach(o => rest(o));
    [...joy, ...squint, mouth].forEach(o => rest(o, false));
    const parts = { skin: sk, body, head, violet, violetLight, ant, bulb, antPivot, eyes, pupils, joy, squint, mouth, feet, ears, tail };
    headDecor(parts, false, false);
    return { root, parts };
  }
  // Что прячет надетая вещь: шляпа — антенну и ушки, вещь на спину — хвост. У «Ушек» антенны нет совсем
  function headDecor(P, onHead, onBack) {
    P.ant.visible = P.bulb.visible = skinOf(P.skin).ant && !onHead;
    P.ears.forEach(e => { e.visible = !onHead; });
    if (P.tail) P.tail.visible = !onBack;
  }
  function setHeroSkin(id) {
    const b = buildHeroParts(id);
    hero.clear();
    Object.keys(heroParts).forEach(k => delete heroParts[k]);
    Object.assign(heroParts, b.parts);
    b.root.children.slice().forEach(c => hero.add(c));
  }
  setHeroSkin(save.gear.skin);
  // Копия героя для другой сцены — со спокойным лицом и ногами на месте
  function faceRest(root) {
    root.traverse(o => {
      const r = o.userData.rest;
      if (!r) return;
      o.position.fromArray(r.p); o.scale.fromArray(r.s); o.rotation.set(r.r[0], r.r[1], r.r[2]);
      if (o.name !== 'bulb') o.visible = r.v; // лампочку прячет шапка — это решает снаряжение
    });
    return root;
  }
  const heroRig = new THREE.Group(); // для прыжков и сдвигов
  heroRig.add(hero);
  scene.add(heroRig);
  const heroBlob = addBlob(heroRig, BLOB.hero, 0, 0, 0.95); // на heroRig: в прыжке остаётся на земле
  let heroAngle = 0;
  const DIR_ANGLE = [Math.PI / 2, Math.PI, Math.PI * 1.5, 0];

  /* ---------- Прокачка героя: уровень за звёзды во всём курсе, снаряжение видно на герое ---------- */
  const { LEVELS, ITEMS, SLOTS } = HeroGear;
  const gearOn = {}; // слот → 3D-модель надетой вещи
  function totalStars() {
    return LESSONS.reduce((n, l) => n + [...l.tasks, ...(l.bonus || [])].reduce((m, t) => m + (save.stars[t.id] || []).reduce((a, b) => a + b, 0), 0), 0);
  }
  const heroLevel = () => HeroGear.levelFor(totalStars());
  const isOpen = it => (it.price ? !!(save.shop || {})[it.id] : it.level <= heroLevel()); // вещь из лавки — если куплена
  function applyGear() {
    Object.keys(gearOn).forEach(slot => { hero.remove(gearOn[slot]); delete gearOn[slot]; });
    let colors = skinOf(heroParts.skin).colors;
    ITEMS.forEach(it => {
      if (save.gear[it.slot] !== it.id || !isOpen(it)) return;
      if (it.colors) colors = it.colors;
      else {
        hero.add(gearOn[it.slot] = HeroGear.build(it.id, THREE));
        gearOn[it.slot].userData.gear = it.slot; // для копий героя (страница героя): эти вещи снимаются
      }
    });
    heroParts.violet.color.setHex(colors[0]);
    heroParts.violetLight.color.setHex(colors[1]);
    headDecor(heroParts, !!gearOn.head, !!gearOn.back); // шляпа и корона надеваются вместо антенны и ушек
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
      if (o.geometry && o.geometry !== boxGeo && !o.isSprite) o.geometry.dispose(); // геометрия спрайтов общая на всех
      if (o.isInstancedMesh) o.dispose();
      if (o.material && o.material.isMaterial && o.material.map) o.material.map.dispose(); // у блоков — массив материалов
    });
    levelGroup = new THREE.Group();
    while (blobGroup.children.length) blobGroup.remove(blobGroup.children[0]);
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
          const h = 0.12 + r * 0.16; // низкие камни по краям: видно, где кончается дорога, но карта не загорожена
          const w = new THREE.Mesh(boxGeo, r > 0.6 ? M.stoneA : M.stoneB);
          w.scale.set(0.94, h, 0.94);
          w.position.set(x, h / 2, z);
          w.castShadow = true; w.receiveShadow = true;
          levelGroup.add(w);
        }
      }
    }
    buildUnderside(level, minX, maxX, minZ, maxZ);
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
      c.userData.blob = addBlob(blobGroup, BLOB.coin, x, z, 0.4);
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
    // таблички: столбик и дощечка с числом. Дощечка — спрайт: всегда повёрнута к камере, число видно и сверху
    level.signs.forEach((v, k) => {
      const [x, z] = k.split(',').map(Number);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SIGN.post, 6), M.trunk);
      post.position.set(x + SIGN.dx, SIGN.post / 2, z + SIGN.dz);
      post.castShadow = true;
      const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(v), alphaTest: 0.2 }));
      board.center.set(0.5, 0); // низ дощечки — на верхушке столбика
      board.scale.set(SIGN.size, SIGN.size, 1);
      board.position.set(x + SIGN.dx, SIGN.post - 0.02, z + SIGN.dz);
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

    // герой в начало; поглядывает на флаг (или на Сбоя)
    face.goal = level.hidden ? null : new THREE.Vector3(f.x, level.boss ? 0.85 : 0.75, f.z);
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
    placeClouds(span);
  }

  /* Летучий остров: под картой — каменное днище из перевёрнутых конусов (чем дальше от края, тем ниже),
     рядом парят отколовшиеся камешки. Одна InstancedMesh — дёшево и для больших лабиринтов */
  const floaters = [];
  function buildUnderside(level, minX, maxX, minZ, maxZ) {
    floaters.length = 0;
    // остров — дорога и кайма вокруг неё; глубина клетки — сколько шагов до края острова
    const land = new Map();
    for (let x = minX - 1; x <= maxX + 1; x++) {
      for (let z = minZ - 1; z <= maxZ + 1; z++) {
        let near = false;
        for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1; dz++) if (level.floor.has(K(x + dx, z + dz))) { near = true; break; }
        if (near) land.set(K(x, z), 0);
      }
    }
    let edge = [...land.keys()].filter(k => {
      const [x, z] = k.split(',').map(Number);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !land.has(K(x + dx, z + dz)));
    });
    edge.forEach(k => land.set(k, 1));
    for (let d = 2; edge.length; d++) {
      const next = [];
      edge.forEach(k => {
        const [x, z] = k.split(',').map(Number);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => { const n = K(x + dx, z + dz); if (land.get(n) === 0) { land.set(n, d); next.push(n); } });
      });
      edge = next;
    }
    const geo = new THREE.ConeGeometry(0.72, 1, 5);
    geo.rotateX(Math.PI); geo.translate(0, -0.5, 0); // острие вниз, основание на нуле
    const mesh = new THREE.InstancedMesh(geo, M.under, land.size);
    const o = new THREE.Object3D(), col = new THREE.Color(), top = new THREE.Color(UNDER.top), deep = new THREE.Color(UNDER.deep);
    let i = 0;
    land.forEach((d, k) => {
      const [x, z] = k.split(',').map(Number), r = hash(x * 7 + 3, z * 5 - 1);
      const h = Math.min(4.2, 0.45 + d * 0.62 + r * 0.55);
      o.position.set(x + (r - 0.5) * 0.25, -0.88, z + (hash(z, x) - 0.5) * 0.25);
      o.rotation.set(0, r * 6.28, 0);
      o.scale.set(0.95 + r * 0.3, h, 0.95 + r * 0.3);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, col.copy(top).lerp(deep, Math.min(1, (d - 1) / 3 + r * 0.2)));
      i++;
    });
    mesh.instanceMatrix.needsUpdate = true;
    levelGroup.add(mesh);
    // отколовшиеся камешки: висят у краёв острова и чуть покачиваются
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const rx = (maxX - minX) / 2 + 2.2, rz = (maxZ - minZ) / 2 + 2.2;
    [[0.6, -2.2, 0.26], [2.3, -3, 0.2], [3.6, -1.8, 0.16], [5.1, -3.3, 0.24]].forEach(([a, y, s], j) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.underBit);
      m.scale.y = 0.75;
      const ang = a + hash(minX + j, maxZ - j) * 0.6;
      m.position.set(cx + Math.cos(ang) * rx, y, cz + Math.sin(ang) * rz);
      m.rotation.y = ang;
      m.userData.y0 = y; m.userData.ph = j * 1.7;
      levelGroup.add(m);
      floaters.push(m);
    });
  }

  function placeClouds(span) {
    cloudSea.position.set(cam.target.x, 0, cam.target.z);
    cloudSea.scale.setScalar(Math.max(1, span / 9));
  }
  function animateClouds(dt) {
    if (reduceMotion) return;
    cloudSea.children.forEach(cl => {
      cl.position.x += cl.userData.v * dt;
      if (cl.position.x > CLOUD_R + 3) cl.position.x -= 2 * CLOUD_R + 6;
    });
    const t = performance.now() / 1000;
    floaters.forEach(m => { m.position.y = m.userData.y0 + Math.sin(t * 0.9 + m.userData.ph) * 0.12; m.rotation.y += dt * 0.15; });
  }

  // Табличка: справа от Бита и чуть позади (с обычной камеры Бит её не закрывает, а она — его), дощечка крупнее прежней
  const SIGN = { dx: 0.36, dz: -0.15, post: 0.42, size: 0.5 };
  function signTexture(v) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const board = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    board(6, 6, 116, 116, 22);
    c.fillStyle = '#8a5a2b'; c.fill();
    board(16, 16, 96, 96, 14);
    c.fillStyle = '#f3e2bf'; c.fill();
    c.fillStyle = '#1b1e3c'; c.font = '700 76px Rubik, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(v), 64, 68, 84);
    return new THREE.CanvasTexture(cv);
  }

  function fitCamera() {
    const aspect = camera.aspect || 1.5;
    const adj = aspect < 1.25 ? Math.pow(1.25 / aspect, 0.9) : 1;
    cam.goal.dist = frameDist * adj;
    cam.goal.el = cam.top ? 1.5 : 0.9;
    cam.goal.az = cam.top ? 0 : -0.38;
  }

  function placeHero(p) {
    setMood(''); feetRest();
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
  const easeBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); // с лёгким перелётом
  // Пружина героя: вытягивается в движении, сплющивается при касании земли
  function squash(k) { if (!reduceMotion) hero.scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5); }

  /* ---------- Живой Бит: моргает, переступает ногами, смотрит, куда пойдёт, радуется и грустит.
     Взгляд — [вбок, вверх] от −1 до 1 в координатах Бита: +1 вбок — налево ---------- */
  const face = { mood: '', look: [0, 0], aim: null, aimUntil: 0, blinkAt: 2, blinkT: -1, idle: 'goal', idleUntil: 0, wiggle: 0, ouch: 0, goal: null };
  // Настроение: '' — спокойный; 'happy' — дошёл: глаза «^ ^», улыбка, антенна качается; 'sad' — программа сломалась
  function setMood(m) { face.mood = m; if (m === 'happy') face.wiggle = 1; }
  // Посмотреть на миг: [вбок, вверх] или 'cam' — на того, кто за экраном
  function glance(look, ms = 500) { face.aim = look; face.aimUntil = performance.now() / 1000 + ms / 1000 / Math.min(tempo(), 3); }
  const LOOK_AT = { ahead: [0, -0.35], left: [1, -0.2], right: [-1, -0.2], down: [0, -1], up: [0.35, 0.9] };
  const clamp1 = v => Math.max(-1, Math.min(1, v));
  // Точка мира → взгляд Бита (null — точка прямо под ним)
  function lookToward(x, y, z) {
    const dx = x - heroRig.position.x, dz = z - heroRig.position.z, dist = Math.hypot(dx, dz);
    if (dist < 0.4) return null;
    const yaw = Math.atan2(dx, dz) - hero.rotation.y;
    return [clamp1(Math.atan2(Math.sin(yaw), Math.cos(yaw)) / 1.1), clamp1(Math.atan2(y - 0.65, dist) / 0.9)];
  }
  const camLook = () => lookToward(camera.position.x, camera.position.y, camera.position.z) || [0, 0.5];
  const goalLook = () => face.goal && lookToward(face.goal.x, face.goal.y, face.goal.z);
  // Без дела Бит поглядывает то на флаг, то на того, кто за экраном; в кадрах для Авито — на цель
  function idleLook(time) {
    if (SHOTS) return goalLook() || camLook();
    if (time > face.idleUntil) {
      face.idle = face.idle === 'cam' ? 'goal' : 'cam';
      face.idleUntil = time + (face.idle === 'cam' ? 1.8 : 2.6) + Math.random() * 2;
    }
    return (face.idle === 'goal' && goalLook()) || camLook();
  }
  function animateFace(time, dt) {
    const P = heroParts, calm = reduceMotion, happy = face.mood === 'happy', sad = face.mood === 'sad';
    let goal;
    if (face.aim && time < face.aimUntil) goal = face.aim === 'cam' ? camLook() : face.aim;
    else if (sad) goal = [0, -0.8];
    else if (running || calm) goal = [0, -0.25]; // под ноги впереди — туда, куда пойдёт
    else goal = idleLook(time);
    const k = 1 - Math.exp(-dt * 14);
    face.look[0] += (goal[0] - face.look[0]) * k;
    face.look[1] += (goal[1] - face.look[1]) * k;
    // моргает раз в 2–5 секунд, иногда дважды подряд; в кадрах для Авито не моргает
    let lid = 1;
    if (!calm && !SHOTS) {
      if (face.blinkT < 0 && time > face.blinkAt) face.blinkT = 0;
      if (face.blinkT >= 0) {
        face.blinkT += dt;
        const p = face.blinkT / 0.16;
        if (p >= 1) { face.blinkT = -1; face.blinkAt = time + (Math.random() < 0.2 ? 0.12 : 2 + Math.random() * 3); }
        else lid = 1 - 0.9 * Math.sin(p * Math.PI);
      }
    }
    face.ouch = Math.max(0, face.ouch - dt * 1.6); // зажмурился от удара: «> <» чуть больше полсекунды
    const ouch = face.ouch > 0.1 && !happy;
    // глаза не сплющиваем ни от грусти, ни от удара: узкие глаза читаются как злость
    const sy = lid;
    const a = face.look[0] * 0.8, b = face.look[1] * 0.55, R = 0.053;
    P.eyes.forEach((e, i) => {
      const r = e.userData.rest.p, p = P.pupils[i];
      e.visible = p.visible = !happy && !ouch;
      P.joy[i].visible = happy;
      P.squint[i].visible = ouch;
      e.scale.y = p.scale.y = sy;
      p.position.set(r[0] + R * Math.sin(a) * Math.cos(b), r[1] + R * Math.sin(b) * sy, r[2] + R * Math.cos(a) * Math.cos(b));
    });
    // рот: улыбка ∪ (дуга перевёрнута) или грусть ∩
    P.mouth.visible = happy || sad || ouch;
    if (happy) { P.mouth.position.set(0, 0.565, 0.19); P.mouth.rotation.set(0.35, 0, Math.PI); }
    else { P.mouth.position.set(0, 0.515, 0.184); P.mouth.rotation.set(0.35, 0, 0); }
    // антенна от грусти никнет, от радости качается; лампочка мигает
    face.wiggle = Math.max(0, face.wiggle - dt * 0.6);
    const ap = P.antPivot.rotation, sway = happy && !calm;
    ap.x += ((sad ? 0.55 : 0) - ap.x) * k;
    ap.z = sway ? Math.sin(time * 14) * 0.3 * (0.3 + face.wiggle) : ap.z + ((sad ? 0.4 : 0) - ap.z) * k;
    P.bulb.scale.setScalar(sway ? 1 + Math.max(0, Math.sin(time * 7)) * 0.3 : 1);
    // грустный Бит чуть оседает; после остановки посреди шага пружина возвращается
    if (!running) {
      const y = sad && !calm ? 0.95 : 1;
      hero.scale.y += (y - hero.scale.y) * k;
      hero.scale.x = hero.scale.z = 1 + (1 - hero.scale.y) * 0.5;
    }
  }
  // Ноги по очереди: левая шагает в первой половине шага, правая — во второй; amp — размах.
  // В покое ноги под корпусом, в шаге ступня выходит вперёд — так шаг видно и сверху
  function stepFeet(t, amp = 1) {
    heroParts.feet.forEach((f, i) => {
      const r = f.userData.rest.p, ph = Math.sin((t * 2 + i) * Math.PI);
      f.position.set(r[0], r[1] + Math.max(0, ph) * 0.08 * amp, r[2] + ph * 0.16 * amp);
    });
  }
  function tuckFeet(k) { heroParts.feet.forEach(f => { const r = f.userData.rest.p; f.position.set(r[0], r[1] + k * 0.06, r[2] - k * 0.03); }); }
  function feetRest() { heroParts.feet.forEach(f => f.position.fromArray(f.userData.rest.p)); }
  // Копии Бита (остров на странице героя, портрет в «Итоге пролога») тоже моргают: у каждой свои часы
  function makeBlinker(root) {
    const lids = []; let at = 1 + Math.random() * 2, t0 = -1;
    let tail = null;
    root.traverse(o => { if (o.name === 'eye' || o.name === 'pupil') lids.push(o); else if (o.name === 'tail') tail = o; });
    return time => {
      if (reduceMotion) return;
      if (tail) tail.rotation.y = Math.sin(time * 3) * 0.3;
      let lid = 1;
      if (t0 < 0 && time > at) t0 = time;
      if (t0 >= 0) {
        const p = (time - t0) / 0.16;
        if (p >= 1) { t0 = -1; at = time + (Math.random() < 0.2 ? 0.12 : 2 + Math.random() * 3); } else lid = 1 - 0.9 * Math.sin(p * Math.PI);
      }
      lids.forEach(o => { o.scale.y = lid; });
    };
  }

  const particles = [];
  function confetti(x, z, n = 70) {
    if (reduceMotion || lite) n = 18;
    const cols = [0xffc83d, 0x6b4bd8, 0x1e9e7e, 0xff9f6b, 0xff6b8b, 0xd9c2ff];
    const g = new THREE.PlaneGeometry(0.08, 0.12);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      m.position.set(x, 1, z);
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      particles.push({ m, v: new THREE.Vector3(Math.cos(a) * s * 0.5, 3 + Math.random() * 3, Math.sin(a) * s * 0.5), life: 1.8, spin: Math.random() * 10 });
      scene.add(m);
    }
  }
  // Пыль из-под ног: мягкие светлые шарики, всплывают и тают
  function dust(x, z, n = 5) {
    if (reduceMotion || lite) return;
    const g = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff1e6, transparent: true, opacity: 0.7 }));
      m.position.set(x + (Math.random() - 0.5) * 0.3, 0.08, z + (Math.random() - 0.5) * 0.3);
      const a = Math.random() * Math.PI * 2;
      particles.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.5, 0.5 + Math.random() * 0.4, Math.sin(a) * 0.5), life: 0.55, life0: 0.55, spin: 0, g: 0, soft: true });
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
    if (gearOn.pet) { const a = time * 1.7; gearOn.pet.position.set(Math.cos(a) * 0.5, 0.8 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.5); gearOn.pet.rotation.y = -a; }
    M.lava.emissiveIntensity = (0.75 + Math.sin(time * 3) * 0.25) * (night ? LOOK.night.lava : 1);
    if (flag) flag.rotation.y = Math.sin(time * 2.2) * 0.25;
    if (finishRing) finishRing.material.opacity = 0.35 + Math.sin(time * 3) * 0.2;
    if (guess) animateGuess(time);
    if (failRing && !reduceMotion) failRing.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    if (boss && boss.visible) animateSboy(boss, time, dt);
    if (cut) animateCut(time, dt);
    animateClouds(dt);
    if (!running && !reduceMotion) heroParts.head.position.y = 0.62 + Math.sin(time * 2) * 0.012;
    if (heroParts.tail && !reduceMotion) heroParts.tail.rotation.y = Math.sin(time * (running ? 7 : 3)) * 0.3;
    animateFace(time, dt);
    if (BLOB.hero.visible) { // в прыжке пятно меньше и бледнее, в лаве пропадает
      const h = hero.position.y;
      heroBlob.scale.setScalar(heroBlob.userData.size / (1 + Math.max(0, h) * 0.8));
      BLOB.hero.opacity = h < -0.05 ? 0 : 1 / (1 + Math.max(0, h) * 1.5);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.v.y -= (p.g === undefined ? 9 : p.g) * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.soft) { const k = Math.max(0, p.life / p.life0); p.m.material.opacity = 0.7 * k; p.m.scale.setScalar(1 + (1 - k) * 1.6); }
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

  /* Лёгкая графика: без теней и размытия, пикселей меньше, частиц меньше. По умолчанию включается на слабых устройствах */
  const LITE_AUTO = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  let lite = save.lite === undefined ? !!LITE_AUTO : !!save.lite;
  function applyLite() {
    document.body.classList.toggle('lite', lite);
    BLOB.hero.visible = BLOB.coin.visible = lite;
    cloudSea.children.forEach(cl => { cl.visible = !lite || cl.userData.lite; });
    renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio, 2));
    if (renderer.shadowMap.enabled === lite) {
      renderer.shadowMap.enabled = !lite;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    const b = $('#liteBtn');
    if (b) { b.setAttribute('aria-pressed', String(lite)); b.title = lite ? 'Вернуть тени и красоту' : 'Для слабого компьютера: без теней и лишних эффектов'; }
    resize();
  }
  $('#liteBtn').addEventListener('click', () => { lite = !lite; save.lite = lite; persist(); applyLite(); Sound.play('tick'); });
  applyLite();

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
  function markFail(st) { if (st) failRing = flat(TRAIL.ring, TRAIL.fail, st.hero.x, st.hero.z, 0.035); setMood('sad'); }

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
    save.predict.streak = right ? (save.predict.streak || 0) + 1 : 0; // серия верных догадок — для достижения «Провидец»
    save.predict.best = Math.max(save.predict.best || 0, save.predict.streak);
    // верная догадка в новом задании — кристаллы (свои уровни не считаются: их можно рисовать без конца)
    if (right && TASKS[taskIdx].kind !== 'custom') { save.guessed = save.guessed || {}; save.guessed[TASKS[taskIdx].id] = 1; }
    persist();
    // верный вариант — зелёный, неверный выбор — оранжевый, остальные гаснут
    guess.options.forEach(p => paintOption(p,
      p === answer ? GUESS_COLOR.right : p === o ? GUESS_COLOR.wrong : GUESS_COLOR.dim,
      p === answer || p === o ? 1 : 0.35));
    const score = `Угадано: ${save.predict.hits} из ${save.predict.tries}.`;
    if (right) {
      say('Верно!', 'yes', 1400);
      setMood('happy');
      confetti(o.x, o.z, 30);
      Sound.play('right');
      log(`Верно! Ответ — ${o.letter}. ${score}`, 'ok');
    } else {
      Sound.play('wrong');
      log(`Мимо: Бит остановился на клетке ${answer ? answer.letter : 'рядом'}, а твой ответ — ${o.letter}. Пройди по следу Бита и найди место, где его путь расходится с твоей догадкой. ${score}`, 'tip');
    }
    // почему Бит встал именно там; где он стоит, и так видно по зелёному значку — без красного кольца
    if (!r.ok) reportError(r.err, 0, '', !right, r.st); // угадал — пусть в облачке останется «Верно!»
    if (r.ok) log(maps.length > 1 ? 'Программа дошла до флага на этой карте. Нажми «Запуск», чтобы проверить все три.' : 'Программа дошла до флага. Нажми «Запуск», чтобы засчитать задание.', 'info');
    checkAwards();
  }

  /* ---------- Сцена конца пролога: Ада показывает Ключ-код, Сбой его крадёт.
     Эффекты привязаны к репликам (третий элемент реплики, список — STORY.fx) и идут, пока реплика на экране ---------- */
  const world = $('.world');
  const KEY_MAT = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xb86b00, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 });
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
        showVars(ev, st);
        await wait(stepMode ? 0 : 110);
        return;
      case 'print':
        log(ev.text, 'print');
        return;
      case 'check':
        Sound.play('tick');
        glance(LOOK_AT[ev.look] || LOOK_AT.ahead, 600); // смотрит туда, о чём спросили
        say(ev.text, typeof ev.value === 'boolean' ? (ev.value ? 'yes' : 'no') : '', 850);
        await wait(380);
        return;
      case 'move': {
        Sound.play('step');
        const fx = ev.from.x, fz = ev.from.z, tx = ev.to.x, tz = ev.to.z;
        dust(fx, fz, 4);
        await tween(360, t => {
          const e = ease(t);
          heroRig.position.set(fx + (tx - fx) * e, 0, fz + (tz - fz) * e);
          hero.position.y = Math.sin(t * Math.PI) * 0.14;
          // вытягивается в полёте, в конце шага сплющивается; ноги шагают по очереди
          squash(t < 0.7 ? 0.07 * Math.sin(t / 0.7 * Math.PI) : -0.09 * Math.sin((t - 0.7) / 0.3 * Math.PI));
          stepFeet(t);
        });
        hero.position.y = 0; hero.scale.set(1, 1, 1); feetRest();
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
          squash(t < 0.85 ? 0.12 * Math.sin(t / 0.85 * Math.PI) : -0.14 * Math.sin((t - 0.85) / 0.15 * Math.PI));
          tuckFeet(Math.sin(t * Math.PI)); // в прыжке поджимает ноги
        });
        hero.position.y = 0; hero.scale.set(1, 1, 1); feetRest();
        dust(tx, tz, 7);
        Sound.play('land');
        trailHop(ev.from, ev.to);
        return;
      }
      case 'turn': {
        Sound.play('turn');
        const a0 = heroAngle, a1 = heroAngle + ev.side * Math.PI / 2;
        heroAngle = a1;
        glance([ev.side, -0.1], 220); // сначала глаза, потом весь Бит
        await tween(260, t => { hero.rotation.y = a0 + (a1 - a0) * easeBack(t); stepFeet(t, 0.5); });
        feetRest();
        return;
      }
      case 'take': {
        const k = K(ev.x, ev.z), c = coinMeshes.get(k);
        say(`+1 монета (${ev.count} из ${ev.total})`, 'yes', 800);
        glance(LOOK_AT.down, 500);
        Sound.play('coin', { n: ev.count });
        updateCoins(ev.count, ev.total);
        if (c) {
          c.userData.taken = true;
          const y0 = c.position.y;
          sparks(ev.x, ev.z, 0xffc83d);
          const blob = c.userData.blob;
          await tween(380, t => { c.position.y = y0 + t * 0.9; const s = 1 - t; c.scale.set(s, s, s); blob.scale.setScalar(blob.userData.size * s); });
          c.visible = blob.visible = false;
        }
        return;
      }
      case 'bump': {
        say('Бум! Стена', 'bad', 1400);
        Sound.play('bump');
        face.ouch = 1;
        const [dx, dz] = HeroWorld.DIRS[st.hero.dir];
        if (!reduceMotion) cam.shake = 0.25;
        await tween(300, t => { const s = Math.sin(t * Math.PI) * 0.25; hero.position.set(dx * s, 0, dz * s); });
        hero.position.set(0, 0, 0);
        return;
      }
      case 'burn': {
        say('Горячо!', 'bad', 1400);
        Sound.play('burn');
        face.ouch = 1;
        sparks(st.hero.x, st.hero.z, 0xff5a1f, 24);
        heroParts.violet.emissive.setHex(0xff2a00);
        await tween(700, t => { hero.position.y = -t * 0.55; });
        return;
      }
      case 'grab-air': {
        say('Пусто…', 'bad', 1400);
        Sound.play('air');
        glance(LOOK_AT.down, 1000); // где же монета?
        await tween(320, t => { const s = Math.sin(t * Math.PI); hero.scale.set(1 + s * 0.12, 1 - s * 0.18, 1 + s * 0.12); });
        hero.scale.set(1, 1, 1);
        return;
      }
      case 'full': {
        say('Рюкзак полон!', 'bad', 1400);
        Sound.play('nope');
        glance(LOOK_AT.up, 800);
        await tween(360, t => { hero.rotation.z = Math.sin(t * Math.PI * 3) * 0.12; });
        hero.rotation.z = 0;
        return;
      }
      case 'shrug': {
        say(ev.text || 'Зачем прыгать?', 'bad', 1400);
        Sound.play('nope');
        glance(LOOK_AT.up, 800);
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
        glance('cam', 1600); // отвечает — смотрит на того, кто за экраном
        await wait(700);
        return;
      }
      case 'win': {
        setMood('happy');
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
      else if (['print', 'input', 'range', 'len', 'str', 'int', 'abs'].includes(name)) out += `<span class="t-fn">${name}</span>`;
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
    if (!running) hideVars();
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
    el.innerHTML = `<span class="c-word">Монеты: </span>${c} из ${t}`;
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
    // кнопка карты долины: где Бит сейчас и сколько звёзд в этом краю
    const l = LESSONS[lessonIdx], place = (STORY.lessons[l.id] || {}).place || l.title;
    $('#mbText').innerHTML = `<b>${esc(place)}</b> <span>· ${l.prologue ? 'Пролог' : `Урок ${lessonNo(lessonIdx)}`}</span>`;
    $('#mbStars').textContent = `★ ${lessonStars(l)}/${l.tasks.length * 3}`;
    $('#mapBtn').setAttribute('aria-label', `Карта долины. Сейчас: ${place}, ${lessonName(lessonIdx)}`);
    if (inTrial) { // идёт испытание
      $('#mbText').innerHTML = '<b>Испытание Сбоя</b> <span>· глава 1</span>';
      $('#mbStars').textContent = `✓ ${trialSolved()}/${TR.length}`;
    }
  }

  function renderBadge() {
    const stars = totalStars(), n = HeroGear.levelFor(stars), cur = LEVELS[n - 1], next = LEVELS[n];
    $('#hbLvl').textContent = n;
    $('#hbTitle').textContent = cur.title;
    $('#hbBar').style.width = next ? `${Math.round(((stars - cur.stars) / (next.stars - cur.stars)) * 100)}%` : '100%';
    $('#heroBtn').setAttribute('aria-label', `${STORY.hero}, уровень ${n}: ${cur.title}. Страница героя${save.awardsNew ? ', там есть новое' : ''}`);
    $('#heroBtn').classList.toggle('new', !!save.awardsNew);
  }

  function renderTabs() {
    renderLessons();
    renderBadge();
    const nav = $('#tabs');
    nav.innerHTML = '';
    // порядок на вкладках: разминка, основные задания, задание со звёздочкой
    const rank = t => ({ warm: 0, bonus: 2, py: 2.5, custom: 3 }[t.kind] ?? 1);
    [...TASKS.keys()].sort((a, b) => rank(TASKS[a]) - rank(TASKS[b]) || a - b).forEach(i => {
      const t = TASKS[i], b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (t.kind ? ' ' + t.kind : '') + (i === taskIdx ? ' active' : '');
      b.setAttribute('aria-current', i === taskIdx ? 'step' : 'false');
      const st = save.stars[t.id] || [0, 0, 0];
      if (t.kind === 'warm') {
        b.title = `Разминка: «${t.title}» из урока «${LESSONS[t.from].title}»`;
        b.setAttribute('aria-label', `Разминка: ${t.title}${save.warm[t.id] ? ', пройдено' : ''}`);
        b.innerHTML = `<span class="num" aria-hidden="true">↻</span>${save.warm[t.id] ? '<span class="tick" aria-hidden="true">✓</span>' : ''}`;
      } else if (t.kind === 'bonus') {
        b.title = 'Задание со звёздочкой — для тех, кто решил урок быстро';
        b.innerHTML = `<span class="num" aria-hidden="true">★</span><span class="nm">${t.short}</span><span class="stars">${starsHtml(st)}</span>`;
      } else if (t.kind === 'exam') {
        const c = trialData().cur, ok = !!(c && c.ok[t.id]);
        b.title = `Испытание ${i + 1}: ${t.name}`;
        b.setAttribute('aria-label', `Испытание ${i + 1}: ${t.name}${ok ? ', решено' : ''}`);
        b.innerHTML = `<span class="num">${i + 1}</span><span class="nm">${t.short}</span>${ok ? '<span class="tick" aria-hidden="true">✓</span>' : ''}`;
      } else if (t.kind === 'py') {
        const k = TASKS.filter(x => x.kind === 'py').indexOf(t) + 1, ok = solvedTask(t);
        b.title = `Python в консоли: ${t.title}`;
        b.setAttribute('aria-label', `Python, задание ${k}: ${t.title}${ok ? ', решено' : ''}`);
        b.innerHTML = `<span class="num" aria-hidden="true">›_</span><span class="nm">${k}</span>${ok ? '<span class="tick" aria-hidden="true">✓</span>' : ''}`;
      } else if (t.kind === 'custom') {
        b.title = `Свой уровень «${t.title}»`;
        b.innerHTML = `<span class="num" aria-hidden="true">✎</span><span class="nm">${t.short}</span>`;
      } else b.innerHTML = `<span class="num">${i + 1}</span><span class="nm">${t.short}</span><span class="stars">${starsHtml(st)}</span>`;
      if (save.hw && save.hw.ids && save.hw.ids.includes(t.id)) { b.classList.add('hwmark'); b.title = (b.title ? b.title + '. ' : '') + 'Задано на дом'; }
      b.addEventListener('click', () => { if (!running) selectTask(i); });
      nav.append(b);
    });
    renderHw();
    renderTrialBar();
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
    btn.hidden = used >= 3 || t.kind === 'exam'; // в испытании подсказок нет
    btn.textContent = used === 2 ? 'Показать решение' : `Подсказка ${used + 1} из 2`;
  }

  function selectLesson(li) {
    exitTrial();
    lessonIdx = li;
    TASKS = lessonTasks(li);
    // в новом уроке — сначала разминка
    const p = save.pos[LESSONS[li].id], warm = TASKS.findIndex(t => t.kind === 'warm' && !save.warm[t.id]);
    selectTask(p === undefined && warm >= 0 ? warm : Math.min(p || 0, MAIN().length - 1));
  }

  function selectTask(i) {
    stopRun();
    cancelGuess();
    hideVars();
    taskIdx = i;
    save.lesson = LESSONS[lessonIdx].id;
    const t = TASKS[i], py = t.kind === 'py', exam = t.kind === 'exam';
    if (!t.kind) save.pos[save.lesson] = i; // номер запоминаем только у основных заданий
    if (py) maps = []; // в консоли Python карт нет — вместо мира консоль
    else {
      if (!save.seeds[t.id]) save.seeds[t.id] = 1000 + Math.floor(Math.random() * 90000);
      maps = makeMaps(t, save.seeds[t.id], t.maps || 3); // у испытания бывает одна карта-рисунок по сиду попытки
    }
    persist();
    const place = lessonStory().place || lessonName(lessonIdx), pys = TASKS.filter(x => x.kind === 'py');
    $('#taskNum').textContent = t.kind === 'custom' ? 'Свой уровень · нарисован в редакторе'
      : t.kind === 'warm' ? `Разминка · задание из урока «${LESSONS[t.from].title}»`
      : py ? `${place} · Python в консоли · ${pys.indexOf(t) + 1} из ${pys.length}`
      : exam ? `Испытание Сбоя · ${i + 1} из ${TR.length} · ${t.name}`
      : t.kind === 'bonus' ? `${place} · задание со звёздочкой` : `${place} · задание ${i + 1} из ${MAIN().length}`;
    $('#taskTitle').textContent = t.title;
    $('#taskGoal').textContent = t.goal;
    $('#taskNewLbl').textContent = t.kind === 'exam' ? 'Тема:' : 'Новое:';
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
    showConsole(py ? t : null);
    if (py) {
      log('Консоль Python: Бита здесь нет — программа печатает текст и спрашивает ввод. «Запуск» запустит её, а потом проверит на нескольких вводах.', 'tip');
      return;
    }
    if (exam) log('Испытание: подсказок нет. Запускать и смотреть «Шагом» можно сколько угодно — засчитывается то, что получилось.', 'tip');
    else if (t.kind === 'custom') log('Свой уровень. Изменить карту или получить ссылку — на карте долины, кнопка «Свой уровень».', 'tip');
    else if (t.kind === 'warm') log('Разминка: реши с нуля задание из прошлого урока, на свежей карте. Звёзд за неё нет — это проверка, что тема не забылась.', 'tip');
    else if (t.kind === 'bonus') log('Задание со звёздочкой: необязательное и потруднее. Звёзды за него идут в уровень Бита.', 'tip');
    else if (i === 0 && LESSONS[lessonIdx].intro) log(LESSONS[lessonIdx].intro, 'tip');
    log(maps.length > 1
      ? 'Нажми «Запуск»: код проверится на трёх разных картах. «Шаг» выполняет программу по одной строке.'
      : 'Нажми «Запуск», и герой выполнит программу. «Шаг» выполняет её по одной строке.', 'info');
    // в уроках без условий карта одна: переключатель карт и «Новые карты» не нужны
    $('.hud.tl').hidden = maps.length === 1;
    $('#newMapsBtn').hidden = maps.length === 1;
    $('#againBtn').hidden = maps.length === 1;
    if (exam) $('#newMapsBtn').hidden = $('#againBtn').hidden = $('#guessBtn').hidden = true; // карты попытки не меняют, угадывать не нужно
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
    if (pyCancel) pyCancel(); // консоль ждала ввод
    for (const tw of [...tweens]) { tweens.delete(tw); tw.res(); }
    setRunning(false);
  }

  // Прогон на текущей карте; в ответе и состояние мира (st) — где Бит остановился
  async function runOnMap(code, token) {
    const st = createState(maps[mapIdx]);
    // для подсказки к строке: на какой строке Бит попал на каждую клетку (stamp — номер запуска строки,
    // у шагов одной команды вперёд(3) он общий)
    st.trace = []; st.lastLine = null; st.stamp = 0;
    varsPrev = new Map();
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
      const ev = r.value;
      if (ev.type === 'line') { st.lastLine = ev.line; st.stamp++; }
      else if (ev.type === 'move' || ev.type === 'jump') st.trace.push({ x: ev.to.x, z: ev.to.z, line: st.lastLine, stamp: st.stamp });
      await animate(ev, st);
      if (token !== runToken) return { aborted: true };
      if (stepMode && ev.type === 'line') {
        await new Promise(res => { stepResolve = res; });
        stepResolve = null;
      }
    }
  }

  // Бит всё понимает буквально — и так и говорит в облачке
  const BIT_SAYS = { extra: 'Тут флаг, а команды ещё есть!', short: 'Команды кончились — стою.', coins: 'Что написано, то и взял!', loop: 'Хожу по кругу… как написано.' };
  /* Панель «Переменные»: значения переменных программы и что знает Бит — видно, как меняются i и счётчики.
     Обновляется на каждой строке; изменившееся значение на миг подсвечивается. Остаётся после прогона до правки кода */
  const varsBox = $('#vars'), ARROW = ['→', '↑', '←', '↓']; // куда смотрит Бит — стрелкой, как на экране
  let varsPrev = new Map();
  function showVars(ev, st) {
    if (SHOW || !ev.scope) return;
    const sc = ev.scope(), items = [...sc.vars.map(([k, v]) => ['', k, v]), ...(sc.locals || []).map(([k, v]) => ['loc', k, v])];
    if (!items.length && !stepMode && varsBox.hidden) return; // переменных нет — панель нужна только в режиме «Шаг»
    const chip = (cls, name, val, key) => {
      const changed = varsPrev.has(key) && varsPrev.get(key) !== val;
      varsPrev.set(key, val);
      return `<span class="var ${cls}${changed ? ' changed' : ''}"><b>${esc(name)}</b> = ${esc(val)}</span>`;
    };
    const bit = [];
    if (st) { // в консоли Python Бита нет
      bit.push(`<span class="var bit">Бит смотрит <b>${ARROW[st.hero.dir]}</b></span>`);
      if (st.total) bit.push(chip('bit', `${st.level.english ? 'coins_taken' : 'монет_собрано'}()`, String(st.collected), '#coins'));
    }
    varsBox.innerHTML = `<span class="vars-cap">Переменные</span>${items.length
      ? items.map(([c, k, v]) => chip(c, (c ? '↳ ' : '') + k, v, c + k)).join('')
      : '<span class="vars-none">пока нет</span>'}${bit.length ? `<span class="vars-sep" aria-hidden="true"></span>${bit.join('')}` : ''}`;
    varsBox.hidden = false;
  }
  function hideVars() { varsBox.hidden = true; varsPrev = new Map(); }

  /* Подсказка к строке: где Бит ошибся и куда на самом деле идёт дорога — относительно его взгляда, а не экрана */
  const REL = ['прямо', 'налево', 'назад', 'направо'];
  // Сколько клеток от каждой клетки дороги до флага (лава проходима — через неё прыгают)
  function distToFlag(L) {
    const d = new Map([[K(L.finish.x, L.finish.z), 0]]), q = [L.finish];
    while (q.length) {
      const c = q.shift(), n = d.get(K(c.x, c.z));
      HeroWorld.DIRS.forEach(([dx, dz]) => {
        const k = K(c.x + dx, c.z + dz);
        if (L.floor.has(k) && !d.has(k)) { d.set(k, n + 1); q.push({ x: c.x + dx, z: c.z + dz }); }
      });
    }
    return d;
  }
  // Куда уходит дорога от Бита (0 прямо, 1 налево, 2 назад, 3 направо) — ближе к флагу; -1 — дальше тупик
  function roadTurn(st, dist) {
    const h = st.hero, here = dist.get(K(h.x, h.z));
    let best = -1, bestD = Infinity;
    HeroWorld.DIRS.forEach(([dx, dz], d) => {
      const n = dist.get(K(h.x + dx, h.z + dz));
      if (n !== undefined && n < bestD && (here === undefined || n < here)) { bestD = n; best = (d - h.dir + 4) % 4; }
    });
    return best;
  }
  function lineHint(err, st) {
    if (!st || !st.trace) return null;
    const L = st.level, basic = L.basic, h = st.hero, line = err.line, dist = distToFlag(L);
    const name = ru => (L.english ? `${HeroWorld.EN[ru]}()` : `${ru === 'вперед' ? 'вперёд' : ru}()`);
    const TURN = { 1: name('налево'), 3: name('направо'), 2: `${name('налево')} два раза` };
    const cells = n => `${n} ${plural(n, 'клетку', 'клетки', 'клеток')}`, cellsLeft = n => `${n} ${plural(n, 'клетка', 'клетки', 'клеток')}`;
    const tr = st.trace, last = tr[tr.length - 1];
    // сколько шагов сделала последняя команда (у шагов одного вперёд(3) общий stamp)
    const run = last ? tr.filter(t => t.stamp === last.stamp).length : 0;
    switch (err.kind) {
      case 'wall': {
        const t = roadTurn(st, dist);
        if (t === -1) return { line, text: 'Подсказка: Бит зашёл в тупик. Ошибка раньше — пройди программу кнопкой «Шаг» и найди, где Бит свернул не туда.' };
        if (t === 2) return { line, text: 'Подсказка: Бит упёрся в стену, а дорога у него за спиной. Похоже, на повороте раньше он повернул не в ту сторону.' };
        if (!basic) return { line, text: `Подсказка: Бит упёрся в стену, а дорога уходит ${REL[t]} от него. Условие должно повернуть Бита раньше, чем он шагнёт в стену.` };
        if (last && last.line === line && run > 0) return { line, text: `Подсказка: на этой строке Бит прошёл ${cells(run)} и упёрся в стену. Шагов здесь нужно ${run}, а потом поворот ${TURN[t]}.` };
        return { line, text: `Подсказка: Бит упёрся в стену. Дорога уходит ${REL[t]} от него — перед этой строкой нужен ${TURN[t]}.` };
      }
      case 'lava': {
        if (!basic) return { line, text: `Подсказка: Бит шагнул в лаву. Перед шагом нужна проверка: if ${name('лава_впереди')}: ${name('прыгнуть')}` };
        if (run > 1) return { line, text: `Подсказка: на этой строке Бит прошёл ${cells(run - 1)}, а следующим шагом попал в лаву. Раздели команду: ${run - 1 > 1 ? `вперёд(${run - 1})` : 'вперёд()'}, потом прыгнуть().` };
        return { line, text: 'Подсказка: здесь впереди была лава. На этой строке вместо вперёд() нужен прыгнуть() — прыжок переносит через одну клетку лавы.' };
      }
      case 'short': {
        const d = dist.get(K(h.x, h.z)), t = roadTurn(st, dist);
        if (!tr.length || d === undefined || !st.lastLine) return null;
        const way = t === 0 ? 'дорога идёт прямо' : t > 0 ? `дорога уходит ${REL[t]}` : 'дальше тупик';
        return { line: st.lastLine, text: `Подсказка: команды кончились после этой строки, а до флага ещё ${cellsLeft(d)}. Бит стоит, ${way}.` };
      }
      case 'extra': {
        const at = tr.findIndex(p => p.x === L.finish.x && p.z === L.finish.z);
        if (at < 0) return null;
        const f = tr[at];
        if (f.stamp === st.stamp) return { line, text: 'Подсказка: на этой строке Бит дошёл до флага раньше, чем кончились шаги. Число в скобках нужно поменьше.' };
        if (line <= f.line) return { line: f.line, text: 'Подсказка: на этой строке Бит встал на флаг, а цикл пошёл на новый повтор. Повторов в range() нужно меньше.' };
        return { line: f.line, text: 'Подсказка: на этой строке Бит встал на флаг. Всё, что ниже, — лишнее: удали эти команды.' };
      }
      case 'coins': {
        if (L.need) return null;
        const i = tr.findIndex(p => st.coins.has(K(p.x, p.z)));
        if (i < 0) return null;
        const p = tr[i], mid = tr[i + 1] && tr[i + 1].stamp === p.stamp;
        if (!basic) return { line: p.line, text: `Подсказка: на этой строке Бит прошёл по монете и не взял её. После каждого шага проверяй: if ${name('есть_монета')}: ${name('взять')}` };
        if (mid) return { line: p.line, text: 'Подсказка: на этой строке Бит прошёл по монете, не останавливаясь. Раздели шаги: остановись на монете и возьми её — взять().' };
        return { line: p.line, text: 'Подсказка: после этой строки Бит стоял на монете, но не взял её. Следующей командой нужен взять().' };
      }
      case 'air': {
        if (!basic) return null;
        const [dx, dz] = HeroWorld.DIRS[h.dir];
        if (st.coins.has(K(h.x + dx, h.z + dz))) return { line, text: 'Подсказка: монета на клетке впереди. Сначала шагни на неё, потом взять().' };
        const prev = tr[tr.length - 2];
        if (prev && st.coins.has(K(prev.x, prev.z))) return { line, text: 'Подсказка: монета осталась позади. взять() нужен на шаг раньше — сразу, как Бит встал на монету.' };
        return null;
      }
    }
    return null;
  }

  function reportError(err, mIdx, code = '', bitTalks = true, st = null) {
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
    const hint = inTrial ? null : lineHint(err, st); // в испытании подсказок нет
    if (hint) log(hint.text, 'tip', hint.line);
  }

  async function runAll() {
    if (running) {
      if (stepMode) { stepMode = false; setRunning(true); if (stepResolve) stepResolve(); }
      return;
    }
    if (isPy()) { runPy(); return; }
    const code = ta.value;
    cancelGuess();
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    markDay();
    if (inTrial && trialData().cur) { const c = trialData().cur, id = TASKS[taskIdx].id; c.runs[id] = (c.runs[id] || 0) + 1; trialTick(c); persist(); } // с какого запуска решено
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
        reportError(r.err, m, code, true, r.st);
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
    if (isPy()) { stepPy(); return; }
    const code = ta.value;
    cancelGuess();
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { reportError(e, 0); return; }
    if (inTrial && trialData().cur) trialTick(trialData().cur);
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
    else { markFail(r.st); reportError(r.err, 0, '', true, r.st); }
  }

  /* ---------- Мост к Python: консоль обычного Python вместо мира (js/bridge.js). Программа печатает (print)
     и спрашивает (input); «Запуск» — сначала вживую, ответы печатают прямо в консоли, потом тихая проверка
     на нескольких вводах (HeroBridge.check) — как код Бита на трёх картах ---------- */
  const isPy = () => !!TASKS[taskIdx] && TASKS[taskIdx].kind === 'py';
  const pycOut = $('#pycOut');
  let pyCancel = null; // отменить ожидание ввода: «Стоп», другое задание
  function pyWrite(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    pycOut.append(span);
    pycOut.scrollTop = pycOut.scrollHeight;
  }
  const pyClear = () => { pycOut.textContent = ''; };
  function showConsole(t) {
    const on = !!t;
    $('.world').classList.toggle('py', on);
    $('#pyw').hidden = !on;
    $('#pySample').hidden = !on;
    $('#guessBtn').hidden = on;
    $('#edFile').textContent = on ? 'main.py' : 'герой.py';
    if (!on) return;
    const b = HeroBridge.LESSONS[t.lesson] || {}, L = LESSONS.find(l => l.id === t.lesson);
    $('#brTitle').textContent = `Мост к Python${L && L.topic ? `: ${L.topic.name.toLowerCase()}` : ''}`;
    $('#brText').textContent = b.text || '';
    $('#brBit').innerHTML = highlight(b.bit || '').replace(/\n $/, '');
    $('#brPy').innerHTML = highlight(b.py || '').replace(/\n $/, '');
    $('#tutorList').innerHTML = (b.tutor || []).map(x => `<li>${esc(x)}</li>`).join('');
    // как должно получиться: ввод и вывод первой проверки
    const test = t.tests[0], shown = HeroBridge.expected(t, 0).replace(/\n+$/, '');
    $('#pySample').innerHTML = '<span class="cap">Как должно получиться</span><div class="ps-io">'
      + (test.in && test.in.length ? `<div><b>Ввод</b><pre>${esc(test.in.join('\n'))}</pre></div>` : '')
      + `<div><b>Вывод</b><pre>${esc(shown)}</pre></div></div>`
      + (t.tests.length > 1 ? '<p class="ps-more">Программу проверят и на других вводах — как код Бита на трёх картах.</p>' : '');
    $('#againBtn').hidden = true;
    pyClear();
    pyWrite('Python 3 · консоль Долины\nНажми «Запуск» — здесь появится то, что напечатает программа.\n', 'pyc-hello');
  }
  // Ответ на input(): поле прямо в консоли, Enter — отправить. null — запуск остановили
  function pyAsk(prompt) {
    if (prompt) pyWrite(prompt);
    return new Promise(res => {
      const inp = document.createElement('input');
      inp.className = 'pyc-in';
      inp.type = 'text';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.placeholder = 'ответ и Enter';
      inp.setAttribute('aria-label', prompt.trim() ? `Ответ: ${prompt.trim()}` : 'Ввод для программы');
      pycOut.append(inp);
      pycOut.scrollTop = pycOut.scrollHeight;
      inp.focus(); // с прокруткой: на телефоне консоль выше кнопки «Запуск»
      const done = v => {
        pyCancel = null;
        inp.remove();
        if (v !== null) pyWrite(v + '\n', 'pyc-typed');
        res(v);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(inp.value); } });
      pyCancel = () => done(null);
    });
  }
  // Живой прогон: печать в консоль, ввод с клавиатуры, подсветка строк (первые 150 — с паузой, дальше быстро)
  async function runConsole(code, token) {
    pyClear();
    $('.pyc').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }); // на телефоне консоль выше кода
    varsPrev = new Map();
    const g = MiniPy.execute(code, MiniPy.stdlib({ console: true }), { maxSteps: 6000 });
    let send, lines = 0;
    for (;;) {
      if (token !== runToken) return { aborted: true };
      let r;
      try { r = g.next(send); } catch (e) { return { ok: false, err: e }; }
      send = undefined;
      if (r.done) return { ok: true };
      const ev = r.value;
      if (ev.type === 'line') {
        lines++;
        showVars(ev, null);
        if (stepMode) {
          markLine(ev.line);
          await new Promise(res => { stepResolve = res; });
          stepResolve = null;
        } else if (lines <= 150) {
          markLine(ev.line);
          await wait(110);
        }
      } else if (ev.type === 'print') {
        pyWrite(ev.text + ev.end);
        Sound.play('type');
      } else if (ev.type === 'input') {
        const v = await pyAsk(ev.prompt);
        if (v === null || token !== runToken) return { aborted: true };
        send = v;
      }
    }
  }
  function pyError(err) {
    reportError(err, 0);
    pyWrite(`\n${err.line ? `Ошибка в строке ${err.line}: ` : 'Ошибка: '}${err.message}\n`, 'pyc-err');
  }
  const fmtIn = a => a.map(v => `«${v}»`).join(', ');
  // Проверка не прошла: на каком вводе и какая строка вывода не та
  function pyFail(t, c) {
    Sound.play('fail');
    if (c.use) { log(c.use, 'err'); return; }
    const where = c.test.in && c.test.in.length ? `на вводе ${fmtIn(c.test.in)} ` : '';
    const cap = x => x[0].toUpperCase() + x.slice(1);
    if (c.err) {
      if (c.err.line) markLine(c.err.line, 'err');
      log(cap(`${where}программа сломалась: ${c.err.message}`), 'err', c.err.line || null);
      return;
    }
    const msg = c.got === undefined ? `${where}программа напечатала меньше строк, чем нужно: нет строки ${c.line} «${c.want}».`
      : c.want === undefined ? `${where}программа напечатала лишнюю строку ${c.line}: «${c.got}».`
      : `${where}строка ${c.line} должна быть «${c.want}», а программа напечатала «${c.got}».`;
    log(cap(msg) + (c.unused > 0 ? ` Программа спросила не все ответы: ${c.unused} ${plural(c.unused, 'остался', 'осталось', 'осталось')}.` : ''), 'err');
    if (t.tests.length > 1 && c.j > 0) log('На первом вводе всё верно, а на этом — нет. Программа должна работать для любого ввода: проверь условия и границы цикла.', 'tip');
  }
  async function runPy() {
    const t = TASKS[taskIdx], code = ta.value;
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { pyClear(); pyError(e); return; }
    markDay();
    const token = ++runToken;
    stepMode = false;
    setRunning(true);
    const r = await runConsole(code, token);
    if (r.aborted || token !== runToken) return;
    markLine(null);
    if (!r.ok) { setRunning(false); pyError(r.err); return; }
    pyWrite('\n— программа закончилась —\n', 'pyc-end');
    log(t.tests.length > 1 ? `Проверка на ${t.tests.length} вводах…` : 'Проверка…', 'map');
    await wait(350);
    if (token !== runToken) return;
    const c = HeroBridge.check(t, code);
    setRunning(false);
    if (!c.ok) { pyFail(t, c); return; }
    if (t.tests.length > 1) t.tests.forEach((x, j) => log(`Ввод ${fmtIn(x.in || [])} — верно.`, 'ok'));
    else log('Вывод совпал с нужным.', 'ok');
    finishPy(t);
  }
  async function stepPy() {
    const code = ta.value;
    clearLog(); hideResult(); markLine(null);
    try { MiniPy.parse(code); } catch (e) { pyClear(); pyError(e); return; }
    const token = ++runToken;
    stepMode = true;
    setRunning(true);
    log('Пошаговый режим. Нажимай «Шаг», чтобы выполнить следующую строку, — напечатанное появится в консоли.', 'map');
    const r = await runConsole(code, token);
    if (r.aborted || token !== runToken) return;
    stepMode = false;
    setRunning(false);
    markLine(null);
    if (r.ok) {
      pyWrite('\n— программа закончилась —\n', 'pyc-end');
      log('Программа закончилась. Нажми «Запуск», чтобы проверить её на всех вводах.', 'ok');
    } else pyError(r.err);
  }
  // Задание в консоли решено: без звёзд — отметка на вкладке; «Дальше» — следующее задание в консоли или урок
  function finishPy(t) {
    save.py = save.py || {};
    save.py[t.id] = 1;
    outroPending = false;
    persist();
    renderTabs();
    const nx = TASKS.find(x => x.kind === 'py' && !solvedTask(x)), fo = firstOpen();
    $('#resStars').innerHTML = '<i class="on py">›_</i>';
    $('#resTitle').textContent = 'Программа работает!';
    $('#resLevel').hidden = true;
    $('#resList').innerHTML = `<li class="on">${t.tests.length > 1 ? `Проверено на ${t.tests.length} вводах` : 'Вывод совпал с нужным'}</li>`
      + `<li class="${hintsUsed() ? '' : 'on'}">Без подсказок</li><li>Этот код работает и в обычном Python — например, в Thonny</li>`;
    $('#nextBtn').textContent = nx ? `Python: ${nx.short}` : `К заданиям урока: ${MAIN()[fo].short}`;
    $('#bonusBtn').hidden = true;
    $('#againBtn').hidden = true;
    $('#editLvlBtn').hidden = true;
    $('#result').hidden = false;
    Sound.play('right');
    afterSolve(t);
  }

  // строки кода без пустых и комментариев
  function codeLines(code) { return code.split('\n').map(l => l.trimEnd()).filter(l => l.trim() && !l.trim().startsWith('#')); }

  // Разминка пройдена: без звёзд, галочка на вкладке; дальше — следующая разминка или первое нерешённое задание
  function finishWarm(t) {
    save.warm[t.id] = 1;
    outroPending = false;
    persist();
    renderTabs();
    const nw = TASKS.findIndex(x => x.kind === 'warm' && !save.warm[x.id]), fo = firstOpen();
    $('#resStars').innerHTML = '<i class="on warm">↻</i>';
    $('#resTitle').textContent = 'Разминка пройдена!';
    $('#resLevel').hidden = true;
    $('#resList').innerHTML = `<li class="on">Тема «${esc(LESSONS[t.from].title)}» не забылась</li><li class="${hintsUsed() ? '' : 'on'}">Без подсказок</li>`;
    $('#nextBtn').textContent = nw >= 0 ? `Разминка: ${TASKS[nw].short}` : `Задание ${fo + 1}: ${MAIN()[fo].short}`;
    $('#bonusBtn').hidden = true;
    $('#result').hidden = false;
    Sound.play('stars', { n: 1 });
    checkAwards();
  }

  // Свой уровень пройден: звёзды показываем, но не сохраняем — иначе их можно набивать лёгкими картами
  function finishCustom(t, code) {
    const lines = codeLines(code).length, got = [1, hintsUsed() === 0 ? 1 : 0, lines <= t.best ? 1 : 0];
    outroPending = false;
    $('#resStars').innerHTML = starsHtml(got);
    $('#resTitle').textContent = 'Уровень пройден!';
    $('#resLevel').hidden = true;
    $('#resList').innerHTML = `<li class="on">Бит дошёл до флага</li><li class="${got[1] ? 'on' : ''}">Решено без подсказок</li>
      <li class="${got[2] ? 'on' : ''}">Коротко: ${lines} ${plural(lines, 'строка', 'строки', 'строк')}${got[2] ? '' : `, а можно уложиться в ${t.best}`}</li>
      <li>За свои уровни звёзды не идут в уровень Бита — это тренировка</li>`;
    const fo = firstOpen();
    $('#nextBtn').textContent = `К урокам: задание ${fo + 1}`;
    $('#bonusBtn').hidden = true;
    $('#editLvlBtn').hidden = false;
    $('#result').hidden = false;
    Sound.play('stars', { n: got.reduce((a, b) => a + b, 0) });
  }

  function finishTask(code) {
    const t = TASKS[taskIdx];
    $('#editLvlBtn').hidden = true;
    if (t.kind === 'warm') { finishWarm(t); return; }
    if (t.kind === 'custom') { finishCustom(t, code); return; }
    if (t.kind === 'exam') { finishExam(t, code); return; }
    const lines = codeLines(code).length;
    const first = !save.fails[t.id];
    const got = [1, hintsUsed() === 0 ? 1 : 0, (t.star3 === 'first' ? first : lines <= t.best) ? 1 : 0];
    const prev = save.stars[t.id] || [0, 0, 0];
    const lvlBefore = heroLevel();
    save.stars[t.id] = prev.map((v, i) => (v || got[i] ? 1 : 0));
    if (first && !prev[0]) save.first[t.id] = 1; // решено с первого запуска — для достижения «С первого раза»
    save.lastWin = t.id; // последняя программа — на странице героя
    // новый уровень: открытые вещи сразу надеваются, чтобы их было видно на герое
    const lvl = heroLevel(), fresh = ITEMS.filter(it => it.level > lvlBefore && it.level <= lvl);
    fresh.forEach(it => { save.gear[it.slot] = it.id; });
    if (fresh.length) applyGear();
    $('#resLevel').hidden = lvl <= lvlBefore;
    $('#resLevel').textContent = `Новый уровень ${lvl}: ${LEVELS[lvl - 1].title}!`
      + (fresh.length ? ` Открыто: ${fresh.map(it => it.name.toLowerCase()).join(', ')}.` : '');
    // урок пройден целиком: на «Дальше» проводник квеста скажет прощальные слова
    outroPending = !save.seen.outro[LESSONS[lessonIdx].id] && MAIN().every(solvedTask);
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
    const bonus = t.kind === 'bonus', last = bonus || taskIdx === MAIN().length - 1;
    const nextLesson = LESSONS[lessonIdx + 1];
    const pro = LESSONS[lessonIdx].prologue;
    const allDone = MAIN().every(solvedTask);
    $('#resTitle').textContent = bonus ? 'Задание со звёздочкой решено!'
      : last && allDone ? (pro ? 'Пролог пройден!' : 'Все задания урока пройдены!') : maps.length > 1 ? 'Готово! Код работает на любой карте.' : 'Готово!';
    // после последнего задания можно взяться за задание со звёздочкой
    const bi = TASKS.findIndex(x => x.kind === 'bonus');
    $('#bonusBtn').hidden = bonus || !last || bi < 0 || solvedTask(TASKS[bi]);
    $('#nextBtn').textContent = !last ? `Задание ${taskIdx + 2}: ${TASKS[taskIdx + 1].short}`
      : pro && outroPending ? 'Дальше' // впереди сцена со Сбоем — не выдаём её заранее
      : nextLesson ? `Урок ${lessonNo(lessonIdx + 1)}: ${nextLesson.title}` : 'К первому заданию';
    if (maps.length > 1) log('Все три карты пройдены.', 'ok');
    afterSolve(t);
  }
  // После решения: задание из домашки — «Дальше» ведёт к следующему нерешённому; новые достижения и кристаллы — строкой в карточке
  function afterSolve(t) {
    hwNextId = null;
    if (save.hw && save.hw.ids && save.hw.ids.includes(t.id)) {
      const nx = nextHw(t.id);
      if (nx) { hwNextId = nx.id; $('#nextBtn').textContent = `Домашка: ${nx.short}`; }
      else {
        if (!save.hw.done) { save.hw.done = 1; save.hwDone = (save.hwDone || 0) + 1; persist(); }
        log('Вся домашка готова! Её увидят на следующем занятии — всё сохранилось.', 'ok');
      }
    }
    // новые достижения и кристаллы — ещё и строкой в карточке результата
    const ch = checkAwards(), bits = [];
    if (ch.awards.length) bits.push(`${ch.awards.length > 1 ? 'Достижения' : 'Достижение'}: ${ch.awards.map(a => `«${a.name}»`).join(', ')}!`);
    if (ch.gems) bits.push(`+${ch.gems} ${plural(ch.gems, 'кристалл', 'кристалла', 'кристаллов')}.`);
    // глава пройдена, а прощания урока не будет (оно уже было) — подскажем, где грамота
    if (!outroPending && certFresh().includes('course')) bits.push('Вся глава пройдена — грамота ждёт на странице героя!');
    if (bits.length) {
      const rl = $('#resLevel'), was = rl.hidden ? '' : rl.textContent + ' ';
      rl.textContent = was + bits.join(' ');
      rl.hidden = false;
    }
  }
  let hwNextId = null;
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

  /* ---------- Кадры для объявления на Авито (?shots): постеры на canvas (js/poster.js) — 3D-мир с кодом, остров героя,
     консоль Python, рост по испытанию, грамота и призыв на пробное занятие. Данные выдуманные; прогресс ученика
     не читается и не пишется (SHOW). 3D-мир задания снимается сразу под оба формата кадра, «Скачать» — PNG ---------- */
  const PO = HeroPoster;
  const SHOT_GEAR = { head: 'hat', neck: 'scarf', back: 'bag' };
  let shotsSize = 'wide', shotsAssets = null;
  // Код — строками цветных кусочков, как в редакторе (та же подсветка highlight)
  function codeTokens(src) {
    const box = document.createElement('div');
    box.innerHTML = highlight(src).replace(/\n $/, '');
    const lines = [[]];
    box.childNodes.forEach(n => {
      const c = n.nodeType === 1 ? n.className.replace('t-', '') : 'plain';
      n.textContent.split('\n').forEach((part, i) => {
        if (i) lines.push([]);
        if (part) lines[lines.length - 1].push({ t: part, c });
      });
    });
    return lines;
  }
  // Снять 3D-мир размером w × h: камера сразу на месте, без плавного подлёта; focus — смотреть ближе на точку
  function grabWorld(w, h, focus = null) {
    const pr = renderer.getPixelRatio(), target = cam.target.clone();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
    Object.assign(cam, { az: cam.goal.az, el: cam.goal.el, dist: cam.goal.dist * (focus ? focus.zoom : 0.92), shake: 0 });
    if (focus) cam.target.set(focus.x, 0, focus.z);
    applyCamera();
    M.boss.emissive.setHex(0xff2bd6); // Сбой мигает — в кадре он в своём цвете
    renderer.render(scene, camera);
    cam.target.copy(target);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(renderer.domElement, 0, 0);
    renderer.setPixelRatio(pr);
    resize();
    return c;
  }
  // Остров края с Битом — как на странице героя, но одним кадром
  function islandImage(icon, gear, w, h) {
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffe6d4, 0x7a5f8a, 0.72));
    const sunL = new THREE.DirectionalLight(0xffd9b0, 0.8);
    sunL.position.set(4, 9, 6);
    sunL.castShadow = true;
    sunL.shadow.mapSize.set(1024, 1024);
    Object.assign(sunL.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
    sunL.shadow.bias = -0.002;
    sc.add(sunL);
    const spin = new THREE.Group();
    spin.rotation.y = 0.25;
    sc.add(spin);
    const land = buildIsland(icon, true);
    spin.add(land.group);
    land.tick(1.3, 0.016);
    const bot = makeHeroModel(gear);
    bot.scale.setScalar(1.35);
    bot.position.set(0.35, 0, 1.05);
    bot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    spin.add(bot);
    const c = new THREE.PerspectiveCamera(30, w / h, 0.1, 80);
    const dist = 12.2 * (c.aspect < 1.15 ? Math.pow(1.15 / c.aspect, 0.85) : 1);
    c.position.set(0, dist * 0.45, dist);
    c.lookAt(0, 0.15, 0);
    c.updateProjectionMatrix();
    r.render(sc, c);
    const img = document.createElement('canvas');
    img.width = w; img.height = h;
    img.getContext('2d').drawImage(r.domElement, 0, 0);
    r.dispose();
    r.forceContextLoss();
    return img;
  }
  // Задание курса на карте SEED: Бит проходит эталон (виден след), мир снимается под оба формата
  async function shotWorld(spec) {
    const li = LESSONS.findIndex(l => l.tasks.some(t => t.id === spec.task));
    selectLesson(li);
    const ti = TASKS.findIndex(t => t.id === spec.task), t = TASKS[ti];
    selectTask(ti);
    maps = makeMaps(t, PO.SEED);
    dotStates = ['', '', ''];
    showMap(0);
    ta.value = t.hints[2];
    refreshEditor();
    let focus = null;
    if (spec.run) {
      speed = 5;
      const token = ++runToken;
      stepMode = false;
      setRunning(true);
      let finished = false;
      const done = runOnMap(ta.value, token).finally(() => { finished = true; });
      // near: 'boss' — остановиться в паре шагов от Сбоя, пока его не починили, и смотреть на них ближе
      while (spec.near === 'boss' && !finished && boss) {
        const dx = heroRig.position.x - boss.position.x, dz = heroRig.position.z - boss.position.z;
        if (Math.hypot(dx, dz) < 2.1) { stopRun(); focus = { x: boss.position.x + dx / 2, z: boss.position.z + dz / 2, zoom: 0.55 }; break; }
        await sleep(30);
      }
      await done;
      setRunning(false);
      markLine(null);
      await sleep(focus ? 400 : 1800); // конфетти улеглись
    } else await sleep(600);
    const code = codeTokens(t.hints[2]), img = {};
    Object.keys(PO.SIZES).forEach(sz => {
      const sl = PO.slot(Object.assign({}, spec, { code }), sz);
      img[sz] = grabWorld(Math.round(sl.w * 1.25), Math.round(sl.h * 1.25), focus);
    });
    return { code, img, badge: lessonName(li) };
  }
  // Всё, что нужно кадрам: снимки мира, остров, грамота, портрет, данные героя и испытания (выдуманные)
  async function buildShots() {
    const out = {}, list = PO.SHOTS, day = 864e5, now = Date.now();
    const short = ms => new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      $('#shotsStatus').textContent = `Готовлю кадр ${i + 1} из ${list.length}: «${s.title.replace(/\*/g, '')}»…`;
      if (s.kind === 'world') out[s.id] = await shotWorld(s);
      else if (s.kind === 'hero') {
        const stars = 128, level = HeroGear.levelFor(stars), img = {};
        Object.keys(PO.SIZES).forEach(sz => { const sl = PO.slot(s, sz); img[sz] = islandImage('tower', SHOT_GEAR, Math.round(sl.w * 1.25), Math.round(sl.h * 1.25)); });
        out[s.id] = {
          img, level, rank: LEVELS[level - 1].title, stars, maxStars: MAX_STARS, gems: 85, done: 11, total: HeroAwards.LIST.length,
          medals: HeroAwards.LIST.slice(0, 12).map((a, k) => ({ icon: a.icon, hue: a.hue, done: k < 9 })),
        };
      } else if (s.kind === 'console') out[s.id] = { lines: codeTokens(s.code) };
      else if (s.kind === 'trial') {
        const ring = ['first', 'ok', 'first', 'first', 'ok', 'miss'];
        out[s.id] = {
          ring, score: 5, of: TR.length, lead: 'Почти вся глава в руках', topics: TR.map((t, k) => [t.name, ring[k]]),
          bars: [{ n: 2, d: short(now - 120 * day) }, { n: 3, d: short(now - 62 * day) }, { n: 5, d: short(now) }],
          delta: 'Было 2 из 6, стало 5 из 6: на 3 больше за 4 месяца',
        };
      } else if (s.kind === 'cert') out[s.id] = { img: shotCert() };
      else if (s.kind === 'cta') out[s.id] = { img: heroPortrait(SHOT_GEAR) };
    }
    return out;
  }
  // Грамота на кадре — за главу, на имя «Саша»
  function shotCert() {
    const img = document.createElement('canvas'), main = LESSONS.filter(l => !l.prologue), level = HeroGear.levelFor(171);
    CERT.draw(img, CERT.content('course', {
      name: 'Саша', tutor: '', date: Date.now(), level, rank: LEVELS[level - 1].title, site: siteName(),
      lessons: main.length, topics: main.map(l => (l.topic || {}).name || l.title), stars: 171, maxStars: MAX_STARS, solved: 58, lines: 1240, days: 21,
    }), heroPortrait(SHOT_GEAR));
    return img;
  }
  const shotSpec = s => Object.assign({}, s, shotsAssets[s.id], s.kind === 'world' || s.kind === 'hero' ? { img: shotsAssets[s.id].img[shotsSize] } : {});
  const shotFile = (s, i) => `avito-${i + 1}-${s.id}-${shotsSize === 'wide' ? '4x3' : '1x1'}.png`;
  function drawShots() {
    $('#shotsGrid').innerHTML = PO.SHOTS.map((s, i) => `<li class="shot"><canvas aria-label="${esc(s.title.replace(/\*/g, ''))}"></canvas>`
      + `<div class="shot-bar"><span><b>${i + 1}.</b> ${esc(s.title.replace(/\*/g, ''))}</span><button type="button" class="btn secondary" data-i="${i}">Скачать</button></div></li>`).join('');
    $$('#shotsGrid canvas').forEach((c, i) => PO.draw(c, shotSpec(PO.SHOTS[i]), shotsSize));
    $('#shotsAll').disabled = false;
    $('#shotsStatus').textContent = `Готово: ${PO.SHOTS.length} кадров ${PO.SIZES[shotsSize].w} × ${PO.SIZES[shotsSize].h}. «Скачать» под кадром — одна картинка, «Скачать все» — все по очереди.`;
  }
  function downloadShot(i) {
    return new Promise(res => {
      $$('#shotsGrid canvas')[i].toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = shotFile(PO.SHOTS[i], i);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        res();
      }, 'image/png');
    });
  }
  async function startShots() {
    document.body.classList.add('shots-mode');
    $('#shots').hidden = false;
    $('#shotsExit').href = location.pathname;
    ta.readOnly = true;
    resize();
    const ready = await CERT.fonts();
    shotsAssets = await buildShots();
    drawShots();
    // шрифты игры загрузились позже — перерисовать кадры и грамоту на них
    if (!ready) CERT.fonts(0).then(() => { const c = PO.SHOTS.find(s => s.kind === 'cert'); if (c) shotsAssets[c.id].img = shotCert(); drawShots(); });
  }
  $('#shotsGrid').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) downloadShot(+b.dataset.i); });
  $('#shotsAll').addEventListener('click', async () => {
    for (let i = 0; i < PO.SHOTS.length; i++) { await downloadShot(i); await sleep(400); }
    $('#shotsStatus').textContent = `Скачано ${PO.SHOTS.length} картинок — в папке загрузок (avito-1…, avito-2…).`;
  });
  $('#shotsSize').addEventListener('click', e => {
    const b = e.target.closest('button[data-size]');
    if (!b || !shotsAssets || b.dataset.size === shotsSize) return;
    shotsSize = b.dataset.size;
    $$('#shotsSize button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    drawShots();
  });

  /* ---------- Кнопки ---------- */
  // Крупный шрифт (кнопка A+ над кодом): удобно показывать экран на занятии
  function applyBig() {
    document.body.classList.toggle('big', !!save.big);
    $('#bigBtn').setAttribute('aria-pressed', String(!!save.big));
    markLine(markedLine, markedKind); // полоса подсветки строки — под новый размер
  }
  $('#bigBtn').addEventListener('click', () => { save.big = !save.big; persist(); applyBig(); });
  if (!SHOW) applyBig();
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
  $('#stopBtn').addEventListener('click', () => {
    stopRun(); cancelGuess(); markLine(null); log('Остановлено.', 'info');
    if (isPy()) pyWrite('\n— остановлено —\n', 'pyc-end'); else showMap(mapIdx);
  });
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
      const t = TASKS[taskIdx];
      if (t.kind === 'exam') { const c = trialData().cur, nx = c ? TR.findIndex(x => !c.ok[x.id]) : -1; if (nx >= 0) selectTask(nx); else endTrial(); return; }
      if (hwNextId) { const id = hwNextId; hwNextId = null; goTask(id); return; }
      if (t.kind === 'warm') { const w = TASKS.findIndex(x => x.kind === 'warm' && !save.warm[x.id]); selectTask(w >= 0 ? w : firstOpen()); }
      else if (t.kind === 'custom') selectTask(firstOpen());
      else if (t.kind === 'py') { const nx = TASKS.findIndex(x => x.kind === 'py' && !solvedTask(x)); selectTask(nx >= 0 ? nx : firstOpen()); }
      else if (!t.kind && taskIdx < MAIN().length - 1) selectTask(taskIdx + 1);
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
    else talk(lessonStory().outro, () => { next(); if (certFresh().includes('course')) openCert('course'); }); // вся глава пройдена — грамота
  });
  $('#bonusBtn').addEventListener('click', () => { hideResult(); selectTask(TASKS.findIndex(t => t.kind === 'bonus')); });
  $('#lessonSel').addEventListener('change', e => {
    if (running) { e.target.value = lessonIdx; return; }
    selectLesson(+e.target.value);
    greet();
  });
  $('#againBtn').addEventListener('click', () => { hideResult(); $('#newMapsBtn').click(); });

  /* ---------- Страница героя: Бит на острове своего края, звание, темы курса, достижения, снаряжение.
     Всё рисуется по сводке D: свою собирает heroData() из сохранения, чужая приходит в ссылке #hero=… ---------- */
  const courseTasks = l => [...l.tasks, ...(l.bonus || [])];
  const MAX_STARS = LESSONS.reduce((n, l) => n + courseTasks(l).length * 3, 0);
  const FIX_IDS = new Set(LESSONS.flatMap(l => l.tasks).filter(t => /(^|-)fix$/.test(t.id)).map(t => t.id)); // «Почини программу»
  const cleanName = s => cleanTitle(s).slice(0, 24);
  // Код в ссылке — не длиннее 24 строк и 900 знаков, чтобы ссылка помещалась в любой мессенджер
  const clipCode = code => String(code).split('\n').slice(0, 24).join('\n').slice(0, 900);
  function heroData() {
    const s = {};
    LESSONS.forEach(l => { s[l.id] = courseTasks(l).map(t => { const st = save.stars[t.id] || [0, 0, 0]; return st[0] | st[1] << 1 | st[2] << 2; }).join(''); });
    const won = LESSONS.flatMap(courseTasks).filter(solvedTask);
    const lastId = save.lastWin && findTask(save.lastWin) && solvedTask(findTask(save.lastWin).t) ? save.lastWin : (won[won.length - 1] || {}).id;
    const lt = lastId ? findTask(lastId).t : null, g = {};
    ITEMS.forEach(it => { if (save.gear[it.slot] === it.id && isOpen(it)) g[it.slot] = it.id; });
    if (skinOf(save.gear.skin).id !== 'bit') g.skin = skinOf(save.gear.skin).id; // облик
    return {
      v: 1, n: cleanName(save.name), r: lessonIdx, g, t: save.badge || '', s,
      f: won.filter(t => (save.first || {})[t.id] || !save.fails[t.id]).length, // решено с первого запуска
      w: Object.keys(save.warm || {}).length, h: save.hwDone || 0, u: save.built ? 1 : 0,
      d: Math.max((save.days || {}).n || 0, won.length ? 1 : 0),
      k: won.reduce((n, t) => n + codeLines(save.code[t.id] ?? t.hints[2]).length, 0),
      p: [save.predict.hits || 0, save.predict.tries || 0, save.predict.best || 0],
      q: Object.keys(save.guessed || {}).length, // задания с верной догадкой — за них кристаллы
      y: Object.keys(save.py || {}).filter(id => HeroBridge.find(id)).length, // решено в консоли Python
      x: keyAttempts(save.trial ? save.trial.hist : []).map(h => [Math.round(h.end / 6e4), h.s.filter(Boolean).length]), // испытания: когда и сколько из 6
      b: HeroGear.SHOP.filter(isOpen).map(it => it.id), // куплено в лавке Ады
      c: lt ? [lt.id, clipCode(save.code[lt.id] ?? lt.hints[2])] : null,
      at: Date.now(),
    };
  }
  // Сводка D → по урокам (звёзды, пройден ли) и счётчики A для достижений
  function heroSummary(D) {
    const per = LESSONS.map(l => {
      const digits = D.s[l.id] || '';
      const st = courseTasks(l).map((t, i) => { const b = +digits[i] || 0; return [b & 1, b >> 1 & 1, b >> 2 & 1]; });
      const main = st.slice(0, l.tasks.length), bon = st.slice(l.tasks.length);
      return {
        l, st, solved: main.filter(x => x[0]).length, stars: st.reduce((n, x) => n + x[0] + x[1] + x[2], 0), bonus: bon.filter(x => x[0]).length,
        done: main.every(x => x[0]), perfect: main.every(x => x[0] && x[1] && x[2]),
      };
    });
    const flat = per.flatMap(p => courseTasks(p.l).map((t, i) => ({ t, st: p.st[i] })));
    const stars = per.reduce((n, p) => n + p.stars, 0);
    const A = {
      solved: flat.filter(x => x.st[0]).length, prolog: per.some(p => p.l.prologue && p.done) ? 1 : 0,
      first: D.f, noHints: flat.filter(x => x.st[1]).length, short: flat.filter(x => x.st[2]).length,
      fixes: flat.filter(x => x.st[0] && FIX_IDS.has(x.t.id)).length, streak: D.p[2], bonus: per.reduce((n, p) => n + p.bonus, 0),
      warm: D.w, hw: D.h, built: D.u, days: D.d, lines: D.k, perfect: per.filter(p => p.perfect).length,
      lessons: per.filter(p => p.done && !p.l.prologue).length, course: per.every(p => p.done) ? 1 : 0, guessed: D.q, py: D.y || 0,
      trial: Math.max(0, ...(D.x || []).map(a => a[1])),
    };
    // кристаллы: заработано всего (js/awards.js) минус потрачено в лавке Ады
    const earned = HeroAwards.gemsEarned(A), spent = D.b.reduce((n, id) => n + (HeroGear.SHOP.find(it => it.id === id) || {}).price, 0);
    return { per, stars, A, awards: HeroAwards.evaluate(A), level: HeroGear.levelFor(stars), gems: { earned, spent, left: Math.max(0, earned - spent) } };
  }
  // Ссылка #hero=…: данные проверяются — в ссылке может оказаться что угодно
  function cleanHero(d) {
    if (!d || typeof d !== 'object' || d.v !== 1) return null;
    const int = (x, max = 99999) => Math.max(0, Math.min(max, Math.floor(+x) || 0));
    const s = {};
    LESSONS.forEach(l => { const v = d.s && d.s[l.id]; if (typeof v === 'string' && /^[0-7]{0,40}$/.test(v)) s[l.id] = v; });
    const D = {
      v: 1, n: cleanName(d.n), r: Math.min(int(d.r), LESSONS.length - 1), g: {}, t: typeof d.t === 'string' ? d.t.slice(0, 20) : '', s,
      f: int(d.f), w: int(d.w), h: int(d.h), u: int(d.u, 1), d: int(d.d), k: int(d.k), p: [0, 1, 2].map(i => int((d.p || [])[i])),
      q: int(d.q), y: int(d.y), x: Array.isArray(d.x) ? d.x.slice(-8).filter(Array.isArray).map(a => [int(a[0], 1e8), int(a[1], 6)]) : [],
      b: Array.isArray(d.b) ? HeroGear.SHOP.filter(it => d.b.includes(it.id)).map(it => it.id) : [],
      c: null, at: int(d.at, 4102444800000) || Date.now(),
    };
    const lvl = heroSummary(D).level;
    ITEMS.forEach(it => { if (d.g && d.g[it.slot] === it.id && (it.price ? D.b.includes(it.id) : it.level <= lvl)) D.g[it.slot] = it.id; });
    if (d.g && HeroGear.SKINS.some(s => s.id === d.g.skin)) D.g.skin = d.g.skin;
    if (Array.isArray(d.c) && typeof d.c[1] === 'string' && findTask(d.c[0])) D.c = [d.c[0], clipCode(d.c[1])];
    return D;
  }
  function heroFromLink() {
    const m = location.hash.match(/^#hero=([A-Za-z0-9_-]{8,8000})$/);
    if (!m || SHOW) return null;
    history.replaceState(null, '', location.href.split('#')[0]);
    try { return cleanHero(JSON.parse(b64dec(m[1]))); } catch (e) { return null; }
  }

  // Новые достижения и кристаллы: поздравление в журнале и точка на кнопке героя. silent — запомнить молча
  // (первый запуск: всё полученное раньше просто запоминается, кристаллы за него уже лежат в лавке)
  // Кристаллы вылетают из мира и летят к кнопке героя
  function flyGems(n) {
    const to = $('#heroBtn') && $('#heroBtn').getBoundingClientRect(), from = $('#stage').getBoundingClientRect();
    if (reduceMotion || lite || !to || !to.width || !from.width || !document.body.animate) return;
    const sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    const dx = to.left + to.width / 2 - sx, dy = to.top + to.height / 2 - sy;
    for (let i = 0; i < Math.min(n, 8); i++) {
      const el = document.createElement('span');
      el.className = 'gem-fly';
      el.innerHTML = GEM_SVG;
      el.style.left = sx + 'px'; el.style.top = sy + 'px';
      document.body.append(el);
      const ox = (Math.random() - 0.5) * 220, oy = -40 - Math.random() * 90;
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
        { transform: `translate(calc(-50% + ${ox}px),calc(-50% + ${oy}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.45)`, opacity: 0.9 },
      ], { duration: 1000, delay: i * 90, easing: 'cubic-bezier(.45,0,.75,.5)', fill: 'both' }).onfinish = () => {
        el.remove();
        const b = $('#heroBtn'); b.classList.remove('gem-pulse'); void b.offsetWidth; b.classList.add('gem-pulse');
      };
    }
  }
  function checkAwards(silent = false) {
    if (SHOW) return { awards: [], gems: 0 };
    if (!save.awards) save.awards = {};
    const S = heroSummary(heroData());
    const fresh = S.awards.filter(a => a.done && !save.awards[a.id]);
    fresh.forEach(a => { save.awards[a.id] = Date.now(); });
    const plus = silent || save.gemsSeen === undefined ? 0 : S.gems.earned - save.gemsSeen;
    const changed = fresh.length || save.gemsSeen !== S.gems.earned;
    save.gemsSeen = S.gems.earned;
    if (!silent && (fresh.length || plus > 0)) {
      save.awardsNew = true;
      fresh.forEach(a => log(`Новое достижение: «${a.name}». Оно уже на странице героя — кнопка с уровнем Бита наверху.`, 'ok'));
      if (plus > 0) log(`+${plus} ${plural(plus, 'кристалл', 'кристалла', 'кристаллов')} — их тратят в лавке Ады на странице героя.`, 'ok');
      if (fresh.length) Sound.play('award');
      if (plus > 0) flyGems(plus);
      renderBadge();
    }
    if (changed) persist();
    return silent ? { awards: [], gems: 0 } : { awards: fresh, gems: Math.max(0, plus) };
  }
  // День занятий: считаем дни, когда программа запускалась
  function markDay() {
    const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, days = save.days || { n: 0, last: '' };
    if (days.last !== today) { save.days = { n: days.n + 1, last: today }; persist(); }
  }

  let hpShared = null; // чужая страница по ссылке — только смотреть
  function renderHeroPage() {
    const shared = !!hpShared, D = hpShared || heroData(), S = heroSummary(D);
    const n = S.level, cur = LEVELS[n - 1], next = LEVELS[n];
    const title = S.awards.find(a => a.id === D.t && a.done);
    const date = new Date(D.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const L = LESSONS[D.r], place = (STORY.lessons[L.id] || {}).place || L.title;
    $('#hpKicker').textContent = `Долина Эникей · страница героя · ${date}`;
    $('#hpTitle').textContent = `${STORY.hero} · уровень ${n}`;
    $('#hpLvl').textContent = n;
    $('#hpGems').innerHTML = `${GEM_SVG}<b>${S.gems.left}</b>`;
    $('#hpGems').title = `Кристаллы: ${S.gems.left}. Всего заработано: ${S.gems.earned}`;
    $('#hpGemsTab').innerHTML = `${GEM_SVG}${S.gems.left}`;
    $('#hpTabs').hidden = shared; // по ссылке — только прогресс
    $('#hpPlace').textContent = shared ? place : `${place} · Бит здесь`;
    $('#hpRank').innerHTML = `<b>${esc(cur.title)}</b>${title ? ` · <span class="hp-title">«${esc(title.name)}»</span>` : ''}`;
    $('#hpName').hidden = !D.n;
    $('#hpName').textContent = D.n ? `Пишет код: ${D.n}` : '';
    $('#hpLevelText').textContent = next ? `До уровня ${n + 1}` : 'Высший уровень';
    $('#hpLevelStars').textContent = next ? `★ ${S.stars} из ${next.stars}` : `★ ${S.stars}`;
    $('#hpBar').style.width = next ? `${Math.round(((S.stars - cur.stars) / (next.stars - cur.stars)) * 100)}%` : '100%';
    const nextItem = ITEMS.find(it => it.level === n + 1), left = next ? next.stars - S.stars : 0;
    $('#hpNext').textContent = next
      ? `Ещё ${left} ${plural(left, 'звезда', 'звезды', 'звёзд')} — и уровень «${next.title}»${nextItem ? `. Откроется: ${nextItem.name.toLowerCase()}` : ''}.`
      : 'Все уровни открыты — выше только небо.';
    const got = S.awards.filter(a => a.done).length;
    $('#hpStats').innerHTML = [
      [`${S.stars}<small> из ${MAX_STARS}</small>`, plural(S.stars, 'звезда', 'звезды', 'звёзд')],
      [S.A.solved, `${plural(S.A.solved, 'задание решено', 'задания решено', 'заданий решено')}`],
      [D.k, `${plural(D.k, 'строка', 'строки', 'строк')} кода`],
      [D.p[1] ? `${D.p[0]}<small> из ${D.p[1]}</small>` : '—', 'верных догадок'],
      [D.d, `${plural(D.d, 'день', 'дня', 'дней')} занятий`],
      [`${got}<small> из ${S.awards.length}</small>`, 'достижений'],
    ].map(([v, k]) => `<li><b>${v}</b><span>${k}</span></li>`).join('');
    // темы курса: путь по урокам с тем, как тема выглядит в коде
    $('#hpTopics').innerHTML = S.per.map((p, i) => {
      const l = p.l, pl = (STORY.lessons[l.id] || {}).place || l.title, icon = (VALLEY[i] || {}).icon || 'sign';
      const max = l.tasks.length, state = p.done ? 'done' : p.solved ? 'now' : '';
      return `<li class="hp-topic ${state}">
        <span class="hp-t-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg>${p.done ? '<i>✓</i>' : ''}</span>
        <span class="hp-t-main"><b>${esc(l.topic ? l.topic.name : l.title)}</b> <span>${l.prologue ? 'Пролог' : `Урок ${lessonNo(i)}`} · ${esc(pl)}</span></span>
        <span class="hp-t-prog">${l.topic ? `<code>${esc(l.topic.code)}</code>` : ''}<span class="hp-t-bar"><i style="width:${Math.round((p.solved / max) * 100)}%"></i></span><span class="hp-t-num">${p.solved} из ${max} · ★ ${p.stars}${p.bonus ? ' · +★' : ''}</span></span>
      </li>`;
    }).join('');
    // достижения: полученные — цветные (своё можно сделать титулом), остальные — серые, с прогрессом
    $('#hpAchCount').textContent = `${got} из ${S.awards.length}`;
    $('#hpAchTip').hidden = shared || !got;
    $('#hpAch').innerHTML = S.awards.map(a => {
      const isTitle = !!title && title.id === a.id;
      const state = a.done ? `<span class="hp-a-state">${isTitle ? 'титул' : 'получено'}</span>`
        : a.goal > 1 ? `<span class="hp-a-prog"><i style="width:${Math.round((a.value / a.goal) * 100)}%"></i></span><span class="hp-a-state">${a.value} из ${a.goal}</span>` : '';
      const inner = `<span class="hp-medal hue-${a.hue}" aria-hidden="true"><svg viewBox="0 0 24 24">${a.icon}</svg></span><span class="hp-a-text"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${state}</span>`;
      const cls = `hp-a${a.done ? ' done' : ''}${isTitle ? ' title' : ''}`;
      return `<li>${a.done && !shared ? `<button type="button" class="${cls}" data-id="${a.id}" aria-pressed="${isTitle}">${inner}</button>` : `<div class="${cls}">${inner}</div>`}</li>`;
    }).join('');
    if (!shared) { renderGear(); renderShop(S); }
    // испытания Сбоя: когда и сколько из 6 — столбиками
    const xs = (D.x || []).map(([m, n]) => ({ end: m * 6e4, n })), tcur = !shared && trialData().cur;
    $('#hpTrialBest').textContent = xs.length ? `лучшее — ${Math.max(...xs.map(x => x.n))} из ${TR.length}` : '';
    $('#hpTrialHist').innerHTML = xs.length ? histBars(xs, xs.length - 1)
      : `<p class="hp-tip">${shared ? 'Испытание ещё не проходили.' : 'Испытание ещё не проходили. Это шесть заданий по темам главы на новых картах — проверка, что всё уже получается.'}</p>`;
    $('#hpTrialSec').hidden = shared && !xs.length;
    renderCertSec(shared);
    $('#hpTrialActions').hidden = shared;
    $('#hpTrialGo').textContent = tcur ? `Продолжить испытание — решено ${trialSolved()} из ${TR.length}` : 'Испытание Сбоя';
    $('#hpTrialLast').hidden = shared || !trialData().hist.length;
    const c = D.c && findTask(D.c[0]);
    $('#hpCodeSec').hidden = !c;
    if (c) {
      $('#hpCodeTitle').textContent = `Последняя программа · «${c.t.title}»`;
      $('#hpCode').innerHTML = highlight(D.c[1]).replace(/\n $/, '');
    }
    $('#hpSharedNote').hidden = !shared;
    $('#hpShareBtn').hidden = shared;
    $('#hpOpenGame').hidden = !shared;
    $('#storyBtn').hidden = shared;
    $('#recapBtn').hidden = shared || !prologueDone();
    if (!shared && !$('#hpShare').hidden) hpOutput(); // сменили титул или снаряжение — ссылка тоже меняется
  }
  function openHeroPage(shared = null) {
    hpShared = shared;
    hpTry = null;
    $('#hpShopMsg').textContent = '';
    showTab('Prog');
    if (!shared && save.awardsNew) { save.awardsNew = false; persist(); renderBadge(); }
    $('#hpShare').hidden = true;
    renderHeroPage();
    const p = $('#heroPage');
    p.classList.toggle('over', !!shared); // по ссылке — поверх заставки
    p.hidden = false;
    p.scrollTop = 0;
    document.body.classList.add('recap-open');
    startIsland();
    (shared ? $('#hpOpenGame') : $('#hpShareBtn')).focus({ preventScroll: true });
  }
  function closeHeroPage() {
    const shared = hpShared;
    $('#heroPage').hidden = true;
    document.body.classList.remove('recap-open');
    stopIsland();
    hpShared = null;
    hpTry = null;
    if (!shared) $('#heroBtn').focus({ preventScroll: true });
  }
  // Вкладки справа от острова: прогресс, лавка Ады, снаряжение. Остров всегда виден — на нём и примерка
  function showTab(name) {
    ['Prog', 'Shop', 'Gear'].forEach(n => {
      const t = $(`#hpTab${n}`);
      t.setAttribute('aria-selected', String(n === name));
      t.tabIndex = n === name ? 0 : -1;
      $(`#hpPanel${n}`).hidden = n !== name;
    });
    if (name !== 'Shop' && hpTry) { tryOn(null); renderTry(heroSummary(heroData())); }
  }
  $('#hpTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#hpTabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('#hpTabs [role="tab"]'), i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    showTab(next.dataset.tab);
    next.focus();
    e.preventDefault();
  });

  /* Лавка Ады: вещи за кристаллы, отдельно от вещей за уровни. Нажатие — примерка на острове, «Купить» — в рамке острова */
  const GEM_SVG = '<svg class="gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l5 6-10 12L2 9z" fill="#7FE0FF"/><path d="M2 9h20L12 21z" fill="#38B6E6"/>'
    + '<path d="M7 3l3 6h4l3-6z" fill="#C9F3FF"/><path d="M7 3h10l5 6-10 12L2 9zM2 9h20M10 9l2 12 2-12M7 3l3 6M17 3l-3 6" fill="none" stroke="#1C7FB5" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const SLOT_ICON = {
    head: '<path d="M3 17h18"/><path d="M6 17v-6a6 6 0 0 1 12 0v6"/>',
    face: '<circle cx="7" cy="13" r="3.5"/><circle cx="17" cy="13" r="3.5"/><path d="M10.5 13h3"/>',
    neck: '<path d="M12 12L4 7v10zM12 12l8-5v10z"/>',
    back: '<path d="M8 21V9a4 4 0 0 1 8 0v12z"/><path d="M8 14h8M10 21v2M14 21v2"/>',
    pet: '<path d="M4 14c3 0 5-5 9-5a5 5 0 0 1 5 5c0 3-3 5-7 5H8"/><path d="M18 12l3 1-3 1"/><circle cx="15" cy="12.5" r=".9"/>',
  };
  const hexColor = c => '#' + c.toString(16).padStart(6, '0');
  let hpTry = null; // вещь из лавки на примерке
  function tryOn(id) {
    hpTry = id;
    if (!island) return;
    const g = { ...heroData().g }, it = id && HeroGear.SHOP.find(x => x.id === id);
    if (it) g[it.slot] = it.id;
    island.setGear(g);
    island.turn(it && it.slot === 'back' ? Math.PI : 0); // вещь на спину — показать Бита со спины
  }
  function renderShop(S) {
    const left = S.gems.left, R = HeroAwards.GEMS;
    $('#hpShopTip').textContent = `Ада мастерит для Бита обновки. Кристаллы дают за задание со звёздочкой (${R.bonus}), сделанную домашку (${R.hw}), `
      + `достижения (от 10 до 50) и верную догадку в «Угадай» в новом задании (${R.guess}). Нажми на вещь — Бит её примерит.`;
    $('#hpShop').innerHTML = HeroGear.SHOP.map(it => {
      const own = isOpen(it), on = own && save.gear[it.slot] === it.id, tr = hpTry === it.id;
      const ico = it.colors ? `<span class="si-sw" style="background:linear-gradient(135deg, ${hexColor(it.colors[0])} 50%, ${hexColor(it.colors[1])} 50%)"></span>`
        : `<svg viewBox="0 0 24 24">${SLOT_ICON[it.slot] || ''}</svg>`;
      const cls = ['hp-si', own && 'own', on && 'on', tr && 'try', !own && it.price > left && 'dear'].filter(Boolean).join(' ');
      return `<li><button type="button" class="${cls}" data-id="${it.id}" aria-pressed="${own ? on : tr}" title="${esc(it.name)}${own ? '' : `: ${it.price} ${plural(it.price, 'кристалл', 'кристалла', 'кристаллов')}`}">
        <span class="si-ico" aria-hidden="true">${ico}</span><span class="si-text"><b>${esc(it.name)}</b><span>${SLOTS[it.slot]}</span></span>
        <span class="si-state">${on ? 'надето' : own ? 'куплено' : `${GEM_SVG}${it.price}`}</span></button></li>`;
    }).join('');
    renderTry(S);
  }
  function renderTry(S) {
    const it = hpTry && HeroGear.SHOP.find(x => x.id === hpTry);
    $('#hpTry').hidden = !it;
    if (!it) return;
    const can = S.gems.left >= it.price;
    $('#hpTryName').textContent = `Примерка: ${it.name}`;
    $('#hpTryPrice').innerHTML = can ? `${GEM_SVG}${it.price}` : `не хватает ${GEM_SVG}${it.price - S.gems.left}`;
    $('#hpBuy').disabled = !can;
  }
  $('#hpShop').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b || hpShared) return;
    const it = HeroGear.SHOP.find(x => x.id === b.dataset.id);
    $('#hpShopMsg').textContent = '';
    if (isOpen(it)) { // уже куплено — надеть или снять, как в снаряжении
      save.gear[it.slot] = save.gear[it.slot] === it.id ? null : it.id;
      persist(); applyGear(); tryOn(null);
    } else tryOn(hpTry === it.id ? null : it.id);
    renderHeroPage();
    const again = $(`#hpShop button[data-id="${it.id}"]`);
    if (again) again.focus({ preventScroll: true });
    // на телефоне остров над вкладками: показать примерку
    if (hpTry && matchMedia('(max-width: 760px)').matches) $('#hpStage').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  $('#hpBuy').addEventListener('click', () => {
    const it = HeroGear.SHOP.find(x => x.id === hpTry);
    if (!it || hpShared || heroSummary(heroData()).gems.left < it.price) return;
    save.shop = save.shop || {};
    save.shop[it.id] = 1;
    save.gear[it.slot] = it.id; // купленное сразу надевается
    persist(); applyGear(); tryOn(null);
    Sound.play('award');
    renderHeroPage();
    $('#hpShopMsg').textContent = `Куплено: «${it.name}». Бит уже в обновке — снять можно во вкладке «Снаряжение».`;
  });
  $('#hpTryOff').addEventListener('click', () => { tryOn(null); renderHeroPage(); });

  // Снаряжение на странице героя: вещи за уровни и купленные в лавке, нажатие — надеть или снять
  function renderGear() {
    $('#gearSub').textContent = 'Выбери облик героя. Вещи открываются за уровни, а в лавке Ады их покупают за кристаллы: нажми на вещь, чтобы надеть её или снять.';
    const list = $('#gearList');
    list.innerHTML = '';
    const sec = text => { const li = document.createElement('li'); li.className = 'gear-head'; li.textContent = text; list.append(li); };
    sec('Облик');
    HeroGear.SKINS.forEach(s => {
      const on = skinOf(save.gear.skin).id === s.id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gear-item';
      b.dataset.skin = s.id;
      b.setAttribute('aria-pressed', String(on));
      const name = document.createElement('span');
      name.textContent = s.name;
      const state = document.createElement('span');
      state.className = 'gi-state';
      state.textContent = on ? 'выбран' : s.note;
      b.append(name, state);
      b.addEventListener('click', () => {
        save.gear.skin = s.id;
        persist(); setHeroSkin(s.id); applyGear(); tryOn(null);
        renderHeroPage();
        const again = $(`#gearList .gear-item[data-skin="${s.id}"]`);
        if (again) again.focus({ preventScroll: true });
      });
      const li = document.createElement('li');
      li.append(b);
      list.append(li);
    });
    sec('Вещи');
    ITEMS.filter(it => !it.price || isOpen(it)).forEach(it => {
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
      b.addEventListener('click', () => {
        save.gear[it.slot] = on ? null : it.id;
        persist(); applyGear(); tryOn(null);
        renderHeroPage();
        const again = $$('#gearList .gear-item').find(x => x.firstChild.textContent === it.name);
        if (again) again.focus({ preventScroll: true });
      });
      const li = document.createElement('li');
      li.append(b);
      list.append(li);
    });
  }

  /* 3D-остров для страницы героя: своя маленькая сцена. Земля — низкие многогранники, на ней то, что стоит
     в этом краю (по значку на карте долины), монеты, облака; Бит в своём снаряжении. Остров можно крутить мышью или пальцем */
  // Герой для другой сцены: своя модель выбранного облика (gear.skin), своё снаряжение и свои цвета
  function makeHeroModel(gear) {
    const { root: bot, parts: P } = buildHeroParts(gear.skin);
    bot.getObjectByName('arrow').visible = false;
    let colors = skinOf(P.skin).colors, onHead = false, onBack = false;
    ITEMS.forEach(it => {
      if (gear[it.slot] !== it.id) return;
      if (it.colors) { colors = it.colors; return; }
      const g = HeroGear.build(it.id, THREE);
      g.userData.gear = it.slot;
      bot.add(g);
      if (it.slot === 'head') onHead = true;
      if (it.slot === 'back') onBack = true;
    });
    P.violet.color.setHex(colors[0]);
    P.violetLight.color.setHex(colors[1]);
    headDecor(P, onHead, onBack);
    return bot;
  }
  function buildIsland(icon, done) {
    const g = new THREE.Group(), anim = [];
    const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85 }, extra));
    const add = (geo, m, x, y, z, parent = g) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.castShadow = true; o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    const tree = (x, z, s = 1) => {
      add(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.36 * s, 6), M.trunk, x, 0.18 * s, z);
      add(new THREE.ConeGeometry(0.36 * s, 0.8 * s, 7), M.leaf, x, 0.74 * s, z);
      add(new THREE.ConeGeometry(0.27 * s, 0.55 * s, 7), M.leaf, x, 1.08 * s, z);
    };
    const stone = (x, z, s = 1) => { const o = add(new THREE.DodecahedronGeometry(0.2 * s, 0), M.stoneB, x, 0.08 * s, z); o.rotation.set(x * 3, z * 5, 0); return o; };
    const glow = (c, e) => mat(c, { emissive: e, emissiveIntensity: 0.8 });
    // земля: трава, под ней земля и скала острым концом вниз — остров парит
    add(new THREE.CylinderGeometry(2.5, 2.35, 0.36, 11), M.grassA, 0, -0.18, 0);
    add(new THREE.CylinderGeometry(2.35, 1.85, 0.55, 11), M.dirt, 0, -0.63, 0);
    add(new THREE.ConeGeometry(1.85, 1.9, 11), M.rock, 0, -1.85, 0).rotation.x = Math.PI;
    [[-2.1, -1.5, 0.55, 0.3], [2.0, -1.8, 0.4, 1.7]].forEach(([x, y, s, ph]) => {
      const r = add(new THREE.DodecahedronGeometry(s, 0), M.rock, x, y, 0.4);
      anim.push(t => { r.position.y = y + Math.sin(t * 1.3 + ph) * 0.08; r.rotation.y = t * 0.3 + ph; });
    });
    // дорожка из плиток: к Биту и дальше, к тому, что стоит в краю
    [[0.3, 2.1], [-0.05, 0.4], [0.05, -0.15]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.44, 0.06, 0.44), M.stoneA, x, 0.03, z));
    const P = {
      house() { // мастерская Ады: домик, верстак с шестерёнкой
        add(new THREE.BoxGeometry(1.2, 0.85, 1.0), mat(0xf3e2bf), -0.75, 0.42, -1.05);
        add(new THREE.ConeGeometry(0.98, 0.65, 4), mat(0xd9573a), -0.75, 1.17, -1.05).rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.28, 0.48, 0.05), mat(0x6b4220), -0.75, 0.24, -0.53);
        add(new THREE.BoxGeometry(0.22, 0.2, 0.05), glow(0xffd76a, 0xffb02e), -0.33, 0.55, -0.53);
        add(new THREE.BoxGeometry(0.16, 0.42, 0.16), M.rock, -0.4, 1.3, -1.25);
        add(new THREE.BoxGeometry(0.8, 0.08, 0.45), M.trunk, 1.1, 0.42, -0.75);
        [-0.33, 0.33].forEach(dx => add(new THREE.BoxGeometry(0.06, 0.4, 0.4), M.trunk, 1.1 + dx, 0.2, -0.75));
        const cog = add(new THREE.TorusGeometry(0.14, 0.05, 6, 8), mat(0xb8c0d8, { metalness: 0.15, roughness: 0.4 }), 1.1, 0.64, -0.75);
        anim.push(t => { cog.rotation.z = t * 1.2; });
        tree(1.75, -1.45, 0.9); tree(-1.85, 0.35, 0.75); stone(1.6, 0.6);
      },
      sign() { // дорога за мастерской: указатель, деревья вдоль дороги
        add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), M.trunk, 1.4, 0.65, -0.75);
        add(new THREE.BoxGeometry(0.75, 0.2, 0.06), mat(0xf3e2bf), 1.65, 1.1, -0.75).rotation.y = -0.2;
        add(new THREE.BoxGeometry(0.65, 0.2, 0.06), mat(0xe4c58f), 1.17, 0.8, -0.75).rotation.y = 0.35;
        tree(-1.3, -0.9, 1.1); tree(-0.6, -1.7, 0.85); tree(0.55, -1.6, 0.95); tree(-1.9, 0.5, 0.7);
        stone(1.7, 0.4); stone(-0.9, 1.4, 0.7);
      },
      mount() { // Эховы горы: острые вершины в снегу
        [[-0.85, -1.05, 0.95, 2.0], [0.55, -1.45, 0.72, 1.5], [1.5, -0.55, 0.52, 1.05], [-1.75, 0.05, 0.45, 0.85]].forEach(([x, z, r, h]) => {
          add(new THREE.ConeGeometry(r, h, 6), M.stoneA, x, h / 2, z);
          add(new THREE.ConeGeometry(r * 0.38, h * 0.38, 6), mat(0xffffff), x, h * 0.81, z);
        });
        stone(1.3, 0.8); stone(-1.2, 1.3, 0.8);
      },
      tree() { // меняющийся лес: много деревьев и грибы
        [[-1.4, -1.1, 1.15], [-0.6, -1.75, 0.9], [0.45, -1.6, 1.05], [1.3, -1.1, 0.9], [1.8, -0.2, 0.75], [-1.95, -0.1, 0.8], [-1.1, 0.0, 0.65]].forEach(([x, z, s]) => tree(x, z, s));
        [[0.9, -0.5], [1.3, 0.55], [-1.5, 0.9]].forEach(([x, z]) => {
          add(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), mat(0xf3e2bf), x, 0.08, z);
          add(new THREE.SphereGeometry(0.11, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe4572e), x, 0.15, z);
        });
      },
      gate() { // ворота Стража: каменная арка, приоткрытые створки, факелы
        [-0.8, 0.8].forEach(x => {
          add(new THREE.BoxGeometry(0.4, 1.6, 0.4), M.stoneA, x, 0.8, -1.1);
          add(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6), M.trunk, x, 1.75, -0.88);
          const f = add(new THREE.SphereGeometry(0.09, 6, 5), glow(0xffb36b, 0xff6a00), x, 1.95, -0.88);
          anim.push(t => f.scale.setScalar(1 + Math.sin(t * 9 + x) * 0.15));
        });
        add(new THREE.BoxGeometry(2.1, 0.32, 0.5), M.stoneB, 0, 1.75, -1.1);
        add(new THREE.BoxGeometry(0.62, 1.1, 0.12), M.gate, -0.32, 0.55, -1.0).rotation.y = 0.5;
        add(new THREE.BoxGeometry(0.62, 1.1, 0.12), M.gate, 0.32, 0.55, -1.0).rotation.y = -0.5;
        tree(-1.85, -0.6, 0.8); tree(1.85, -0.5, 0.75); stone(1.4, 0.9);
      },
      tower() { // башня чисел: высокая башня с зубцами и табличка с числом
        add(new THREE.CylinderGeometry(0.55, 0.68, 2.3, 8), M.stoneA, -0.65, 1.15, -1.05);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          add(new THREE.BoxGeometry(0.2, 0.22, 0.2), M.stoneB, -0.65 + Math.cos(a) * 0.5, 2.4, -1.05 + Math.sin(a) * 0.5);
        }
        add(new THREE.ConeGeometry(0.42, 0.7, 8), mat(0x5b45e0), -0.65, 2.85, -1.05);
        add(new THREE.BoxGeometry(0.2, 0.3, 0.05), glow(0xffd76a, 0xffb02e), -0.65, 1.5, -0.45);
        add(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), M.trunk, 1.5, 0.4, -0.55);
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const c = cv.getContext('2d');
        c.fillStyle = '#f3e2bf'; c.fillRect(0, 0, 64, 64);
        c.strokeStyle = '#8a5a2b'; c.lineWidth = 6; c.strokeRect(3, 3, 58, 58);
        c.fillStyle = '#1b1e3c'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('42', 32, 35);
        add(new THREE.BoxGeometry(0.5, 0.5, 0.04), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv) }), 1.5, 0.95, -0.52);
        tree(1.7, -1.3, 0.85); stone(-1.6, 0.6); stone(1.5, 0.7, 0.8);
      },
      anvil() { // кузница приёмов: наковальня, горн с огнём, молот
        add(new THREE.BoxGeometry(0.34, 0.3, 0.3), mat(0x3d4060, { metalness: 0.15, roughness: 0.5 }), 1.45, 0.15, -0.75);
        add(new THREE.BoxGeometry(0.7, 0.2, 0.34), mat(0x5d6385, { metalness: 0.15, roughness: 0.45 }), 1.45, 0.4, -0.75);
        add(new THREE.ConeGeometry(0.12, 0.35, 6), mat(0x5d6385, { metalness: 0.15, roughness: 0.45 }), 1.96, 0.42, -0.75).rotation.z = -Math.PI / 2;
        const hammer = new THREE.Group();
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M.trunk, 0, 0.25, 0, hammer);
        add(new THREE.BoxGeometry(0.22, 0.12, 0.12), mat(0x3d4060, { metalness: 0.15, roughness: 0.5 }), 0, 0.5, 0, hammer);
        hammer.position.set(1.45, 0.5, -0.75);
        g.add(hammer);
        anim.push(t => { hammer.rotation.z = -0.6 + Math.max(0, Math.sin(t * 3)) * 0.9; });
        add(new THREE.BoxGeometry(1.1, 0.9, 0.9), M.stoneA, -0.85, 0.45, -1.05);
        add(new THREE.BoxGeometry(0.55, 0.35, 0.1), M.lava, -0.85, 0.42, -0.58);
        add(new THREE.BoxGeometry(0.3, 0.9, 0.3), M.stoneB, -1.1, 1.3, -1.2);
        tree(1.75, -1.3, 0.8); stone(-1.7, 0.7); stone(1.6, 0.6, 0.8);
      },
      castle() { // замок Сбоя: стены, башни, над ними сам Сбой (починенный — когда долина пройдена)
        add(new THREE.BoxGeometry(2.2, 0.9, 0.35), M.stoneB, 0, 0.45, -1.35);
        for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.2, 0.2, 0.36), M.stoneB, -1.0 + i * 0.4, 1.0, -1.35);
        add(new THREE.BoxGeometry(0.5, 0.6, 0.38), mat(0x2b2f5c), 0, 0.3, -1.33);
        [-1.2, 1.2].forEach(x => {
          add(new THREE.CylinderGeometry(0.36, 0.4, 1.6, 8), M.stoneA, x, 0.8, -1.3);
          add(new THREE.ConeGeometry(0.45, 0.65, 8), mat(done ? 0x5b45e0 : 0x3a2e8c), x, 1.92, -1.3);
        });
        const sb = makeSboy();
        sb.position.set(0, 1.85, -1.3);
        if (done) { sb.userData.fixed = true; sb.children.forEach(m => { m.material = M.bossFixed; }); }
        g.add(sb);
        anim.push((t, dt) => animateSboy(sb, t, dt));
        stone(1.6, 0.5); stone(-1.6, 0.8, 0.8);
      },
    };
    (P[icon] || P.sign)();
    // монеты по краю острова
    const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16);
    [[-1.6, 1.2], [1.75, 0.6], [-0.6, 1.95]].forEach(([x, z], i) => {
      const c = new THREE.Group();
      add(coinGeo, M.coin, 0, 0, 0, c).rotation.x = Math.PI / 2;
      c.position.set(x, 0.42, z);
      g.add(c);
      anim.push(t => { c.rotation.y = t * 2 + i; c.position.y = 0.42 + Math.sin(t * 2.4 + i * 2) * 0.05; });
    });
    // долина пройдена — над островом Ключ-код
    if (done) {
      const key = new THREE.Group(), gold = mat(0xffc83d, { emissive: 0xa86400, emissiveIntensity: 0.45, metalness: 0.15, roughness: 0.35 });
      add(new THREE.TorusGeometry(0.16, 0.05, 6, 14), gold, -0.25, 0, 0, key);
      add(new THREE.BoxGeometry(0.42, 0.07, 0.07), gold, 0.13, 0, 0, key);
      add(new THREE.BoxGeometry(0.06, 0.13, 0.07), gold, 0.25, -0.08, 0, key);
      add(new THREE.BoxGeometry(0.06, 0.09, 0.07), gold, 0.33, -0.06, 0, key);
      key.position.set(1.4, 2.3, 0.2);
      g.add(key);
      anim.push(t => { key.rotation.y = t * 1.5; key.position.y = 2.3 + Math.sin(t * 2) * 0.1; });
    }
    // облака
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
    [[-2.6, 2.4, -1.2, 0], [2.8, 1.8, -0.6, 2.5]].forEach(([x, y, z, ph]) => {
      const cl = new THREE.Group();
      [[0, 0, 0, 0.42], [0.42, -0.05, 0.05, 0.32], [-0.4, -0.06, 0, 0.3]].forEach(([dx, dy, dz, r]) => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), cloudMat);
        m.position.set(dx, dy, dz);
        cl.add(m);
      });
      cl.position.set(x, y, z);
      g.add(cl);
      anim.push(t => { cl.position.x = x + Math.sin(t * 0.3 + ph) * 0.25; cl.position.y = y + Math.sin(t * 0.7 + ph) * 0.06; });
    });
    return {
      group: g,
      tick: (t, dt) => { if (!reduceMotion) anim.forEach(f => f(t, dt)); },
      dispose: () => g.traverse(o => { if (o.geometry && o.geometry !== coinGeo) o.geometry.dispose(); }),
    };
  }
  let island = null;
  function startIsland() {
    stopIsland();
    const box = $('#hpStage');
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'hp-canvas';
    r.domElement.setAttribute('role', 'img');
    box.prepend(r.domElement);
    const D = hpShared || heroData(), S = heroSummary(D);
    r.domElement.setAttribute('aria-label', `Бит на острове: ${$('#hpPlace').textContent}`);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffe6d4, 0x7a5f8a, 0.72));
    const sunL = new THREE.DirectionalLight(0xffd9b0, 0.8);
    sunL.position.set(4, 9, 6);
    sunL.castShadow = true;
    sunL.shadow.mapSize.set(1024, 1024);
    Object.assign(sunL.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
    sunL.shadow.bias = -0.002;
    sc.add(sunL);
    const spin = new THREE.Group();
    sc.add(spin);
    const land = buildIsland((VALLEY[D.r] || {}).icon || 'sign', !!S.A.course);
    spin.add(land.group);
    let bot = null;
    const setGear = gear => {
      if (bot) spin.remove(bot);
      bot = makeHeroModel(gear);
      bot.userData.blink = makeBlinker(bot);
      bot.scale.setScalar(1.35);
      bot.position.set(0.35, 0, 1.05);
      bot.traverse(o => { if (o.isMesh) o.castShadow = true; });
      spin.add(bot);
    };
    setGear(D.g);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    const fit = () => {
      const w = box.clientWidth || 320, h = box.clientHeight || 300;
      r.setSize(w, h, false);
      cam.aspect = w / h;
      const dist = 12.2 * (cam.aspect < 1.15 ? Math.pow(1.15 / cam.aspect, 0.85) : 1);
      cam.position.set(0, dist * 0.45, dist);
      cam.lookAt(0, 0.15, 0);
      cam.updateProjectionMatrix();
    };
    fit();
    // крутить остров: мышь или палец по горизонтали; сам он покачивается, чтобы Бит был виден спереди
    let drag = null, userRot = 0;
    const cv = r.domElement;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, rot: userRot }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (drag) userRot = drag.rot + (e.clientX - drag.x) * 0.012; });
    const up = () => { drag = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    let raf = 0, prev = 0;
    const loop = now => {
      const t = now / 1000, dt = Math.min(0.05, prev ? t - prev : 0);
      prev = t;
      const goal = userRot + (reduceMotion || drag ? 0 : Math.sin(t / 2.6) * 0.5);
      spin.rotation.y += (goal - spin.rotation.y) * (drag ? 0.35 : 0.05);
      if (!reduceMotion) {
        bot.position.y = Math.max(0, Math.sin(t * 2.2)) * 0.05; // Бит пританцовывает
        bot.userData.blink(t);
        const pet = bot.children.find(o => o.userData.gear === 'pet');
        if (pet) { const a = t * 1.7; pet.position.set(Math.cos(a) * 0.5, 0.8 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.5); pet.rotation.y = -a; }
      }
      land.tick(t, dt);
      r.render(sc, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    addEventListener('resize', fit);
    island = { r, land, fit, setGear, raf: () => raf, turn: a => { userRot = a; } };
  }
  function stopIsland() {
    if (!island) return;
    cancelAnimationFrame(island.raf());
    removeEventListener('resize', island.fit);
    island.land.dispose();
    island.r.dispose();
    island.r.forceContextLoss();
    island.r.domElement.remove();
    island = null;
  }

  // Поделиться: ссылка на страницу героя и готовое сообщение; имя — по желанию, хранится только здесь
  function hpOutput() {
    const D = heroData(), S = heroSummary(D);
    const url = `${location.href.split(/[?#]/)[0]}#hero=${b64enc(JSON.stringify(D))}`;
    const n = S.level, got = S.awards.filter(a => a.done).length, total = LESSONS.filter(l => !l.prologue).length;
    $('#hpUrl').value = url;
    $('#hpMsg').value = `${D.n ? `${D.n} и робот Бит` : 'Робот Бит'} в Долине Эникей: уровень ${n} «${LEVELS[n - 1].title}», ★ ${S.stars}, `
      + `пройдено уроков: ${S.A.lessons} из ${total}, достижений: ${got} из ${S.awards.length}. Страница героя: ${url}`;
  }
  $('#heroBtn').addEventListener('click', () => openHeroPage());
  $('#hpClose').addEventListener('click', closeHeroPage);
  $('#hpOpenGame').addEventListener('click', closeHeroPage);
  $('#heroPage').addEventListener('click', e => { if (e.target.id === 'heroPage') closeHeroPage(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#heroPage').hidden) closeHeroPage(); });
  $('#hpAch').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b || hpShared) return;
    save.badge = save.badge === b.dataset.id ? '' : b.dataset.id;
    persist();
    renderHeroPage();
    const again = $(`#hpAch button[data-id="${b.dataset.id}"]`);
    if (again) again.focus({ preventScroll: true });
  });
  $('#hpShareBtn').addEventListener('click', () => {
    const box = $('#hpShare');
    box.hidden = !box.hidden;
    if (box.hidden) return;
    $('#hpNameInput').value = save.name || '';
    $('#hpShareSum').textContent = '';
    hpOutput();
    box.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    $('#hpCopyMsg').focus({ preventScroll: true });
  });
  $('#hpNameInput').addEventListener('input', e => {
    save.name = cleanName(e.target.value);
    persist();
    $('#hpName').hidden = !save.name;
    $('#hpName').textContent = save.name ? `Пишет код: ${save.name}` : '';
    hpOutput();
  });
  $('#hpCopyMsg').addEventListener('click', () => copyField('#hpMsg', 'Сообщение скопировано — вставь его в чат.', '#hpShareSum'));
  $('#hpCopyUrl').addEventListener('click', () => copyField('#hpUrl', 'Ссылка скопирована.', '#hpShareSum'));
  $('#storyBtn').addEventListener('click', () => {
    closeHeroPage();
    const L = LESSONS[lessonIdx], s = lessonStory();
    // после пролога в историю входит и кража Ключ-кода — с тем же представлением в 3D
    const theft = !L.prologue && PRO >= 0 && save.seen.outro[LESSONS[PRO].id] ? STORY.lessons[LESSONS[PRO].id].outro : [];
    cutscene([...STORY.prologue, ...theft, ...(s.intro || []), ...(save.seen.outro[L.id] ? s.outro || [] : [])]);
  });
  $('#recapBtn').addEventListener('click', () => { closeHeroPage(); openRecap(); });

  /* ---------- Карта долины вместо списка уроков: края по урокам на тропе. Пройденный край — с галочкой,
     над текущим — «Бит здесь», дальние (дальше следующего непройденного) — в тумане, но заглянуть можно:
     репетитору иногда нужно показать урок заранее ---------- */
  // Центры значков в процентах карты (карта 1000 × 625) и рисунки — по порядку уроков
  const VALLEY = [
    { x: 11, y: 80, icon: 'house' }, { x: 27, y: 58, icon: 'sign' }, { x: 14, y: 31, icon: 'mount' }, { x: 37, y: 20, icon: 'tree' },
    { x: 53, y: 46, icon: 'gate' }, { x: 69, y: 73, icon: 'tower' }, { x: 81, y: 45, icon: 'anvil' }, { x: 89, y: 17, icon: 'castle' },
  ];
  const ICONS = {
    house: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/><circle cx="17" cy="6" r="1.6"/>',
    sign: '<path d="M12 3v18"/><path d="M5 6h11l3 3-3 3H5z"/><path d="M8 21h8"/>',
    mount: '<path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M7.5 10.5l1.5 1.5 1.5-1.5"/>',
    tree: '<path d="M12 3l6 8h-3.5l4.5 7H5l4.5-7H6z"/><path d="M12 18v3"/>',
    gate: '<path d="M4 21V10a8 8 0 0 1 16 0v11"/><path d="M8.5 21v-9M12 21v-10M15.5 21v-9"/>',
    tower: '<path d="M8 21V9h8v12"/><path d="M7 9V4h2v2h2V4h2v2h2V4h2v5"/><path d="M11 21v-4h2v4"/><path d="M11 12h2"/>',
    anvil: '<path d="M4 8h12c0 3 2 4 4 4v2h-7l-1 3h3v3H7v-3h3l-1-3H8a4 4 0 0 1-4-4z"/>',
    castle: '<path d="M3 21V9h3v3h3V9h2v3h2V9h2v3h3V9h3v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  };
  // Плавная тропа через точки (Катмулл — Ром → кривые Безье)
  function smoothPath(p) {
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += ` C${(b.x + (c.x - a.x) / 6).toFixed(1)},${(b.y + (c.y - a.y) / 6).toFixed(1)} ${(c.x - (e.x - b.x) / 6).toFixed(1)},${(c.y - (e.y - b.y) / 6).toFixed(1)} ${c.x},${c.y}`;
    }
    return d;
  }
  function valleyArt(pts, reach) {
    const trees = [[292, 118], [322, 88], [430, 104], [456, 148], [398, 66], [478, 84], [268, 160]]
      .map(([x, y]) => `<path d="M${x} ${y - 30}l16 30h-9l11 18h-36l11-18h-9z" fill="var(--vm-tree)"/>`).join('');
    const river = 'M-20 400 C 120 360, 230 460, 360 415 S 560 290, 650 330 S 840 440, 1020 392';
    return `<svg class="valley-art" viewBox="0 0 1000 625" aria-hidden="true">
      <ellipse cx="240" cy="520" rx="330" ry="170" fill="var(--vm-grass2)" opacity=".75"/>
      <ellipse cx="760" cy="250" rx="320" ry="160" fill="var(--vm-grass2)" opacity=".6"/>
      <path d="${river}" fill="none" stroke="var(--vm-river)" stroke-width="30" stroke-linecap="round"/>
      <path d="${river}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="16 28" opacity=".45"/>
      <polygon points="36,262 132,104 228,262" fill="var(--vm-rock)"/><polygon points="132,104 110,140 154,140" fill="#fff" opacity=".9"/>
      <polygon points="176,262 252,142 328,262" fill="var(--vm-rock)" opacity=".85"/><polygon points="252,142 234,170 270,170" fill="#fff" opacity=".85"/>
      ${trees}
      <ellipse cx="612" cy="372" rx="26" ry="10" fill="#ff7a2e" opacity=".85"/><ellipse cx="648" cy="392" rx="18" ry="7" fill="#ff5a1f" opacity=".8"/>
      <rect x="744" y="410" width="22" height="70" rx="3" fill="var(--vm-rock)"/><rect x="738" y="402" width="34" height="12" rx="2" fill="var(--vm-rock)"/>
      <circle cx="890" cy="106" r="78" fill="#ff2bd6" opacity=".14"/><circle cx="890" cy="106" r="46" fill="#ff2bd6" opacity=".12"/>
      <path d="${smoothPath(pts)}" fill="none" stroke="color-mix(in srgb, var(--vm-path) 65%, #5a3a1a)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
      <path d="${smoothPath(pts)}" fill="none" stroke="var(--vm-path)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${smoothPath(pts)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 14" opacity=".55"/>
      ${reach > 0 ? `<path d="${smoothPath(pts.slice(0, reach + 1))}" fill="none" stroke="var(--mint)" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 13" opacity=".95"/>` : ''}
      <defs><linearGradient id="vfog" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="var(--sky2)" stop-opacity=".75"/><stop offset="1" stop-color="var(--sky2)" stop-opacity="0"/></linearGradient></defs>
      <rect x="640" y="0" width="360" height="625" fill="url(#vfog)"/>
    </svg>`;
  }
  function renderValley() {
    const box = $('#valleyMap');
    const pts = LESSONS.map((l, i) => VALLEY[i] || { x: 10 + (i * 80) / Math.max(1, LESSONS.length - 1), y: 50, icon: 'sign' });
    const done = LESSONS.map(l => l.tasks.every(solvedTask));
    const open = done.includes(false) ? done.indexOf(false) : LESSONS.length; // первый непройденный край
    let fogCount = 0;
    const nodes = LESSONS.map((l, i) => {
      const place = (STORY.lessons[l.id] || {}).place || l.title, sub = l.prologue ? 'Пролог' : `Урок ${lessonNo(i)} · ${l.title}`;
      const got = lessonStars(l), max = l.tasks.length * 3, bonus = (l.bonus || []).some(solvedTask);
      const fog = !done[i] && i > open + 1 && i !== lessonIdx;
      if (fog) fogCount++;
      const cls = ['vnode', done[i] && 'done', i === lessonIdx && 'current', fog && 'fog'].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" style="left:${pts[i].x}%;top:${pts[i].y}%" data-i="${i}"
        aria-label="${esc(place)}: ${esc(sub)}, звёзд ${got} из ${max}${done[i] ? ', пройдено' : ''}${fog ? ', в тумане' : ''}">
        <span class="vn-icon" aria-hidden="true">${i === lessonIdx ? '<span class="vn-here">Бит здесь</span>' : ''}<svg viewBox="0 0 24 24">${ICONS[pts[i].icon]}</svg>${done[i] ? '<span class="vn-done">✓</span>' : ''}</span>
        <span class="vn-label" aria-hidden="true"><span class="vn-name">${esc(place)}</span><span class="vn-sub">${esc(sub)}</span><span class="vn-stars">★ ${got} из ${max}${bonus ? ' · +★' : ''}</span></span>
      </button>`;
    });
    let reach = 0;
    while (reach < LESSONS.length - 1 && done[reach]) reach++; // зелёная тропа — до первого непройденного края
    box.innerHTML = valleyArt(pts.map(p => ({ x: p.x * 10, y: p.y * 6.25 })), reach) + nodes.join('');
    $('#valleyTrial').textContent = trialData().cur ? `Продолжить испытание · ${trialSolved()}/${TR.length}` : 'Испытание Сбоя';
    const n = done.filter(Boolean).length;
    $('#valleySub').textContent = `Пройдено краёв: ${n} из ${LESSONS.length} · звёзд всего: ${totalStars()}${fogCount ? ' · дальние края пока в тумане, но заглянуть можно' : ''}`;
    box.querySelectorAll('.vnode').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      closeValley();
      if (running || (i === lessonIdx && !inTrial)) return;
      selectLesson(i);
      greet();
    }));
  }
  function openValley() {
    renderValley();
    $('#valley').hidden = false;
    document.body.classList.add('recap-open');
    ($('#valleyMap .vnode.current') || $('#valleyMap .vnode')).focus({ preventScroll: true });
  }
  function closeValley() {
    $('#valley').hidden = true;
    document.body.classList.remove('recap-open');
    $('#mapBtn').focus({ preventScroll: true });
  }
  $('#mapBtn').addEventListener('click', openValley);
  $('#valleyClose').addEventListener('click', closeValley);
  $('#valley').addEventListener('click', e => { if (e.target.id === 'valley') closeValley(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#valley').hidden) closeValley(); });

  /* ---------- Свой уровень: редактор карты. Рисуют мышью или пальцем; карта проверяется сразу
     (HeroWorld.checkLevel), «Играть» открывает её вкладкой «Свой уровень», ссылка несёт карту целиком ---------- */
  const TOOLS = [
    { id: 'floor', ch: '.', name: 'Дорога' }, { id: 'wall', ch: ' ', name: 'Стена' }, { id: 'lava', ch: '~', name: 'Лава' },
    { id: 'coin', ch: '$', name: 'Монета' }, { id: 'start', ch: '>', name: 'Старт' }, { id: 'flag', ch: 'F', name: 'Флаг' },
  ];
  const CELL_CLASS = { ' ': 't-wall', '.': 't-floor', '~': 't-lava', '$': 't-coin', F: 't-flag', '>': 't-start', '^': 't-start', '<': 't-start', v: 't-start' };
  const CELL_NAME = { ' ': 'стена', '.': 'дорога', '~': 'лава', '$': 'монета', F: 'флаг', '>': 'старт, Бит смотрит вправо', '^': 'старт, Бит смотрит вверх', '<': 'старт, Бит смотрит влево', v: 'старт, Бит смотрит вниз' };
  const START_ARROW = { '>': '→', '^': '↑', '<': '←', v: '↓' }, TURN_CW = { '>': 'v', v: '<', '<': '^', '^': '>' };
  const FLAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="#1B1E3C" stroke-width="2" stroke-linecap="round"/><path d="M6 4h11l-3 4 3 4H6z" fill="#1FA88F"/></svg>';
  const NEW_LEVEL = { title: 'Мой уровень', rows: ['', '', ' >..$..F', '', '', ''], w: 10, h: 6 };
  let ed = null; // { grid: [[символ]], tool, w, h }
  const edRows = () => ed.grid.map(r => r.join('').replace(/\s+$/, ''));
  function edLoad(level) {
    const rows = level.rows, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const h = clamp(level.h || rows.length, 3, 10), w = clamp(level.w || Math.max(8, ...rows.map(r => r.length)), 4, 14); // размер поля запоминается
    ed = { tool: ed ? ed.tool : 'floor', w, h, grid: Array.from({ length: h }, (_, z) => Array.from({ length: w }, (_, x) => (rows[z] || '')[x] || ' ')) };
    $('#lvlName').value = cleanTitle(level.title);
  }
  function edSave() {
    save.custom = { title: cleanTitle($('#lvlName').value) || 'Мой уровень', rows: edRows(), w: ed.w, h: ed.h };
    save.built = 1; // для достижения «Строитель»
    persist();
    checkAwards();
  }
  function edRender() {
    const g = $('#lvlGrid');
    g.style.setProperty('--w', ed.w);
    g.innerHTML = ed.grid.map((row, z) => row.map((ch, x) =>
      `<button type="button" class="lc ${CELL_CLASS[ch]}" data-x="${x}" data-z="${z}" aria-label="${x + 1}, ${z + 1}: ${CELL_NAME[ch]}">${START_ARROW[ch] || (ch === 'F' ? FLAG_SVG : '')}</button>`).join('')).join('');
    $('#lvlW').textContent = ed.w;
    $('#lvlH').textContent = ed.h;
    $('#lvlTools').innerHTML = TOOLS.map(t => `<button type="button" class="lvl-tool" role="radio" data-tool="${t.id}" aria-checked="${t.id === ed.tool}"><span class="sw ${CELL_CLASS[t.ch]}" aria-hidden="true">${t.id === 'start' ? '→' : t.id === 'flag' ? FLAG_SVG : ''}</span>${t.name}</button>`).join('');
    const chk = HeroWorld.checkLevel(edRows()), st = $('#lvlStatus');
    st.className = 'lvl-status ' + (chk.ok ? 'ok' : 'bad');
    st.textContent = chk.ok ? `Карта готова: путь до флага есть${chk.L.coins.size ? `, монет: ${chk.L.coins.size}` : ''}. Жми «Играть».` : chk.msg;
    $('#lvlPlay').disabled = $('#lvlLink').disabled = !chk.ok;
    return chk;
  }
  // Рисование: дорога, стена, лава и монета — протягиванием; старт и флаг — по одному, щелчок по старту поворачивает Бита
  function edPaint(x, z, first) {
    const cur = ed.grid[z][x], tool = TOOLS.find(t => t.id === ed.tool);
    if (tool.id === 'start') {
      if (!first) return;
      if (START_ARROW[cur]) ed.grid[z][x] = TURN_CW[cur];
      else { ed.grid.forEach(r => r.forEach((c, i) => { if (START_ARROW[c]) r[i] = '.'; })); ed.grid[z][x] = '>'; }
    } else if (tool.id === 'flag') {
      if (!first) return;
      ed.grid.forEach(r => r.forEach((c, i) => { if (c === 'F') r[i] = '.'; }));
      ed.grid[z][x] = 'F';
    } else if (cur === tool.ch) return;
    else ed.grid[z][x] = tool.ch;
    edRender();
    edSave();
  }
  function edResize(axis, d) {
    if (axis === 'w') ed.w = Math.max(4, Math.min(14, ed.w + d));
    else ed.h = Math.max(3, Math.min(10, ed.h + d));
    ed.grid = Array.from({ length: ed.h }, (_, z) => Array.from({ length: ed.w }, (_, x) => (ed.grid[z] || [])[x] || ' '));
    edRender();
    edSave();
  }
  function openEditor() {
    $('#valley').hidden = true;
    edLoad(save.custom || NEW_LEVEL);
    $('#lvlUrl').hidden = true;
    edRender();
    edSave();
    $('#lvlEd').hidden = false;
    document.body.classList.add('recap-open');
    $('#lvlTools [aria-checked="true"]').focus({ preventScroll: true });
  }
  function closeEditor() {
    $('#lvlEd').hidden = true;
    document.body.classList.remove('recap-open');
    if (inTrial) return; // идёт испытание — его вкладки на месте
    const ci = TASKS.findIndex(t => t.kind === 'custom');
    TASKS = lessonTasks(lessonIdx); // карта могла измениться — вкладка «Свой уровень» обновится
    if (TASKS[taskIdx] && ci === taskIdx) selectTask(Math.max(0, TASKS.findIndex(t => t.kind === 'custom'))); else renderTabs();
  }
  (function editorEvents() {
    const g = $('#lvlGrid');
    let painting = false;
    const at = e => { const c = document.elementFromPoint(e.clientX, e.clientY); return c && c.classList.contains('lc') && g.contains(c) ? c : null; };
    g.addEventListener('pointerdown', e => { const c = at(e); if (!c) return; e.preventDefault(); painting = true; edPaint(+c.dataset.x, +c.dataset.z, true); });
    g.addEventListener('pointermove', e => { if (!painting) return; const c = at(e); if (c) edPaint(+c.dataset.x, +c.dataset.z, false); });
    addEventListener('pointerup', () => { painting = false; });
    g.addEventListener('keydown', e => { // с клавиатуры: Enter или пробел на клетке
      const c = e.target.closest('.lc');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); edPaint(+c.dataset.x, +c.dataset.z, true); g.querySelector(`[data-x="${c.dataset.x}"][data-z="${c.dataset.z}"]`).focus(); }
    });
    $('#lvlTools').addEventListener('click', e => { const b = e.target.closest('.lvl-tool'); if (b) { ed.tool = b.dataset.tool; edRender(); $(`#lvlTools [data-tool="${ed.tool}"]`).focus(); } });
    document.querySelectorAll('.lvl-size [data-size]').forEach(b => b.addEventListener('click', () => { const [a, d] = b.dataset.size.split(','); edResize(a, +d); }));
    $('#lvlName').addEventListener('input', edSave);
    $('#lvlClear').addEventListener('click', () => { ed.grid = ed.grid.map(r => r.map(() => ' ')); $('#lvlUrl').hidden = true; edRender(); edSave(); });
    $('#lvlClose').addEventListener('click', closeEditor);
    $('#lvlEd').addEventListener('click', e => { if (e.target.id === 'lvlEd') closeEditor(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lvlEd').hidden) closeEditor(); });
    $('#lvlPlay').addEventListener('click', () => {
      if (!edRender().ok) return;
      edSave();
      $('#lvlEd').hidden = true;
      document.body.classList.remove('recap-open');
      if (running) stopRun();
      exitTrial();
      TASKS = lessonTasks(lessonIdx);
      selectTask(TASKS.findIndex(t => t.kind === 'custom'));
    });
    $('#lvlLink').addEventListener('click', async () => {
      if (!edRender().ok) return;
      edSave();
      const url = `${location.href.split(/[?#]/)[0]}#level=${b64enc(JSON.stringify({ t: save.custom.title, r: save.custom.rows }))}`;
      const box = $('#lvlUrl'), st = $('#lvlStatus');
      box.value = url;
      box.hidden = false;
      box.select();
      try { await navigator.clipboard.writeText(url); st.textContent = 'Ссылка скопирована. Отправь её другу или репетитору — уровень откроется у него сразу.'; }
      catch (e) { st.textContent = 'Скопируй ссылку из поля ниже и отправь её другу или репетитору.'; }
      st.className = 'lvl-status ok';
    });
    $('#valleyEdit').addEventListener('click', openEditor);
    $('#editLvlBtn').addEventListener('click', () => { hideResult(); openEditor(); });
  })();

  /* ---------- Домашка: полоска над заданием у ученика (что задано и что готово) и окно «Задать домашку» у репетитора ---------- */
  const hwItems = () => (save.hw && save.hw.ids ? save.hw.ids.map(findTask).filter(Boolean) : []);
  function renderHw() {
    const box = $('#hw'), items = hwItems();
    if (!items.length || SHOW || inTrial) { box.hidden = true; return; }
    const done = items.filter(x => solvedTask(x.t)).length, cur = TASKS[taskIdx], all = done === items.length;
    box.hidden = false;
    box.classList.toggle('done', all);
    $('#hwTitle').textContent = all ? 'Домашка готова!' : 'Домашка';
    $('#hwCount').textContent = `${done} из ${items.length}`;
    $('#hwList').innerHTML = items.map(({ li, t }) => {
      const n = LESSONS[li].tasks.indexOf(t), ok = solvedTask(t), mark = t.kind === 'py' ? '›_' : n >= 0 ? n + 1 : '★';
      return `<button type="button" class="hw-item${ok ? ' ok' : ''}${cur && cur.id === t.id ? ' cur' : ''}" data-id="${t.id}" title="${esc(lessonName(li))}: ${esc(t.title)}">`
        + `<i>${ok ? '✓' : mark}</i>${esc(t.short)}</button>`;
    }).join('');
  }
  // Открыть задание по id — в любом уроке; вступление урока покажется, если его ещё не видели
  function goTask(id, withGreet = true) {
    const f = findTask(id);
    if (!f || running) return;
    const other = f.li !== lessonIdx || inTrial;
    exitTrial();
    if (other) { lessonIdx = f.li; TASKS = lessonTasks(f.li); }
    selectTask(TASKS.findIndex(t => t.id === id));
    if (other && withGreet) greet();
  }
  // Следующее нерешённое задание домашки после текущего (по кругу)
  function nextHw(fromId) {
    const items = hwItems(), i = items.findIndex(x => x.t.id === fromId);
    if (i < 0) return null;
    for (let k = 1; k < items.length; k++) { const x = items[(i + k) % items.length]; if (!solvedTask(x.t)) return x.t; }
    return null;
  }
  $('#hwList').addEventListener('click', e => { const b = e.target.closest('.hw-item'); if (b) goTask(b.dataset.id); });
  $('#hwHide').addEventListener('click', () => { delete save.hw; persist(); renderTabs(); });

  // Окно «Задать домашку»: по умолчанию — задания 5–8 текущего урока (из пролога — весь урок «Команды»)
  let hwPick = new Set();
  const hwBase = () => location.href.split(/[?#]/)[0];
  function hwRanges(nums) { // [5,6,7,8,10] → «5–8, 10»
    const out = [];
    nums.forEach(n => { const r = out[out.length - 1]; if (r && n === r[1] + 1) r[1] = n; else out.push([n, n]); });
    return out.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`)).join(', ');
  }
  function renderHwBuilder() {
    $('#hwLessons').innerHTML = LESSONS.map((l, li) => {
      const pys = HeroBridge.tasksOf(l.id), all = [...l.tasks, ...(l.bonus || []), ...pys], quick = (l.tasks.length >= 8
        ? `<button type="button" data-q="1-4" data-li="${li}">1–4</button><button type="button" data-q="5-8" data-li="${li}">5–8</button>` : '')
        + (pys.length ? `<button type="button" data-q="py" data-li="${li}">Python</button>` : '');
      return `<div class="hw-lesson"><div class="hw-lesson-head">${esc(lessonName(li))}<span class="hw-quick">${quick}<button type="button" data-q="all" data-li="${li}">все</button><button type="button" data-q="none" data-li="${li}">снять</button></span></div>
        <div class="hw-tasks">${all.map(t => {
          const n = l.tasks.indexOf(t), mark = t.kind === 'py' ? `›_${pys.indexOf(t) + 1}` : n >= 0 ? n + 1 : '★';
          return `<label class="hw-check${t.kind === 'py' ? ' py' : ''}"><input type="checkbox" data-id="${t.id}"${hwPick.has(t.id) ? ' checked' : ''}>${mark} · ${esc(t.short)}</label>`;
        }).join('')}</div></div>`;
    }).join('');
    hwOutput();
  }
  function hwOutput() {
    const ids = LESSONS.flatMap(l => [...l.tasks, ...(l.bonus || []), ...HeroBridge.tasksOf(l.id)]).map(t => t.id).filter(id => hwPick.has(id)); // в порядке курса
    const url = ids.length ? `${hwBase()}#hw=${ids.join(',')}` : '';
    const parts = LESSONS.map((l, li) => {
      const nums = l.tasks.map((t, i) => (hwPick.has(t.id) ? i + 1 : 0)).filter(Boolean), bonus = (l.bonus || []).some(t => hwPick.has(t.id));
      const pyNums = HeroBridge.tasksOf(l.id).map((t, i) => (hwPick.has(t.id) ? i + 1 : 0)).filter(Boolean);
      if (!nums.length && !bonus && !pyNums.length) return '';
      const name = l.prologue ? 'пролог' : `урок ${lessonNo(li)} «${l.title}»`;
      const items = [nums.length ? `${plural(nums.length, 'задание', 'задания', 'задания')} ${hwRanges(nums)}` : '', bonus ? 'задание со звёздочкой' : '',
        pyNums.length ? `Python в консоли ${hwRanges(pyNums)}` : ''].filter(Boolean);
      const what = items.length > 1 ? `${items.slice(0, -1).join(', ')} и ${items[items.length - 1]}` : items[0];
      return `${name}: ${what}`;
    }).filter(Boolean);
    $('#hwSum').textContent = ids.length ? `Выбрано: ${ids.length} ${plural(ids.length, 'задание', 'задания', 'заданий')}.` : 'Отметь хотя бы одно задание.';
    $('#hwUrl').value = url;
    $('#hwMsg').value = ids.length ? `Домашка по Python (Долина Эникей): ${parts.join('; ')}. Открой ссылку — задания откроются сразу: ${url}` : '';
    $('#hwCopyMsg').disabled = $('#hwCopyUrl').disabled = !ids.length;
  }
  function openHwBuilder() {
    $('#valley').hidden = true;
    const li = LESSONS[lessonIdx].prologue && LESSONS[lessonIdx + 1] ? lessonIdx + 1 : lessonIdx, tasks = LESSONS[li].tasks;
    hwPick = new Set((tasks.length >= 8 ? tasks.slice(4) : tasks).map(t => t.id));
    renderHwBuilder();
    $('#hwEd').hidden = false;
    document.body.classList.add('recap-open');
    const block = $('#hwLessons').children[li];
    if (block) block.scrollIntoView({ block: 'nearest' });
    $('#hwCopyMsg').focus({ preventScroll: true });
  }
  function closeHwBuilder() { $('#hwEd').hidden = true; document.body.classList.remove('recap-open'); }
  /* ---------- Сообщения родителям (js/messages.js): готовые тексты для репетитора — обращение, имя ученика и подпись
     подставляются во все сразу, текст можно поправить прямо в поле и скопировать. Подпись запоминается (save.msgSign) ---------- */
  const MSG = HeroMessages;
  let msgDirty = new Set(); // поля, которые поправили руками, — их не перезаписываем
  const msgVars = () => ({
    name: cleanName($('#msgName').value), parent: cleanTitle($('#msgParent').value), sign: cleanTitle($('#msgSign').value),
    site: /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : '',
  });
  function renderMessages(first) {
    if (first) {
      $('#msgList').innerHTML = MSG.LIST.map((m, i) => `<li class="msg-item"><div class="msg-top"><b>${esc(m.title)}</b><span>${esc(m.when)}</span></div>`
        + `<textarea data-i="${i}" aria-label="${esc(m.title)}"></textarea>`
        + `<div class="msg-actions"><button type="button" class="btn secondary" data-copy="${i}">Скопировать</button><span class="hw-sum" data-st="${i}" role="status"></span></div></li>`).join('');
    }
    const v = msgVars();
    $$('#msgList textarea').forEach((f, i) => {
      if (msgDirty.has(i)) return;
      f.value = MSG.fill(MSG.LIST[i], v);
      fitArea(f);
    });
  }
  // Поле с текстом — по высоте текста, чтобы письмо было видно целиком и на телефоне
  const fitArea = f => { f.style.height = 'auto'; f.style.height = `${f.scrollHeight + 4}px`; };
  function openMessages() {
    $('#valley').hidden = true;
    msgDirty = new Set();
    $('#msgName').value = save.name || '';
    $('#msgSign').value = save.msgSign || '';
    $('#msgEd').hidden = false;
    renderMessages(true);
    $('#msgEd').scrollTop = 0;
    document.body.classList.add('recap-open');
    $('#msgName').focus({ preventScroll: true });
  }
  function closeMessages() { $('#msgEd').hidden = true; document.body.classList.remove('recap-open'); }
  ['#msgName', '#msgParent', '#msgSign'].forEach(sel => $(sel).addEventListener('input', () => renderMessages(false)));
  $('#msgSign').addEventListener('change', e => { save.msgSign = cleanTitle(e.target.value); persist(); });
  $('#msgList').addEventListener('input', e => { const f = e.target.closest('textarea[data-i]'); if (f) { msgDirty.add(+f.dataset.i); fitArea(f); } });
  $('#msgList').addEventListener('click', async e => {
    const b = e.target.closest('button[data-copy]');
    if (!b) return;
    const i = +b.dataset.copy, f = $$('#msgList textarea')[i], st = $$('#msgList [data-st]')[i];
    f.select();
    try {
      await navigator.clipboard.writeText(f.value);
      st.textContent = /\[[^\]]+\]/.test(f.value) ? 'Скопировано. Остались места в [скобках] — допиши их перед отправкой.' : 'Скопировано — можно вставлять в переписку.';
    } catch (err) { st.textContent = 'Скопируй текст вручную: он уже выделен.'; }
  });
  $('#valleyMsg').addEventListener('click', openMessages);
  $('#msgClose').addEventListener('click', closeMessages);
  $('#msgEd').addEventListener('click', e => { if (e.target.id === 'msgEd') closeMessages(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#msgEd').hidden) closeMessages(); });

  async function copyField(sel, okText, out = '#hwSum') {
    const f = $(sel);
    f.select();
    try { await navigator.clipboard.writeText(f.value); $(out).textContent = okText; }
    catch (e) { $(out).textContent = 'Скопируй текст из поля вручную: он уже выделен.'; }
  }
  $('#hwLessons').addEventListener('change', e => {
    const c = e.target.closest('input[data-id]');
    if (!c) return;
    if (c.checked) hwPick.add(c.dataset.id); else hwPick.delete(c.dataset.id);
    hwOutput();
  });
  $('#hwLessons').addEventListener('click', e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    const l = LESSONS[+b.dataset.li], pys = HeroBridge.tasksOf(l.id), all = [...l.tasks, ...(l.bonus || []), ...pys], q = b.dataset.q;
    // быстрые кнопки заданий Бита не трогают отмеченное в консоли, и наоборот: «5–8» + «Python» — обычная домашка
    (q === 'all' || q === 'none' ? all : q === 'py' ? pys : [...l.tasks, ...(l.bonus || [])]).forEach(t => hwPick.delete(t.id));
    const on = q === 'all' ? all : q === '1-4' ? l.tasks.slice(0, 4) : q === '5-8' ? l.tasks.slice(4, 8) : q === 'py' ? pys : [];
    on.forEach(t => hwPick.add(t.id));
    renderHwBuilder();
  });
  $('#hwCopyMsg').addEventListener('click', () => copyField('#hwMsg', 'Сообщение скопировано — вставь его в чат с учеником или родителем.'));
  $('#hwCopyUrl').addEventListener('click', () => copyField('#hwUrl', 'Ссылка скопирована.'));
  $('#valleyHw').addEventListener('click', openHwBuilder);
  $('#hwEdClose').addEventListener('click', closeHwBuilder);
  $('#hwEd').addEventListener('click', e => { if (e.target.id === 'hwEd') closeHwBuilder(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#hwEd').hidden) closeHwBuilder(); });
  // Ссылку на уровень или домашку открыли, когда игра уже открыта (например, вставили в адресную строку)
  addEventListener('hashchange', () => {
    if (running || SHOW) return;
    if (hwFromLink()) { const x = hwItems().find(y => !solvedTask(y.t)) || hwItems()[0]; goTask(x.t.id); log('Домашка обновлена: список — над заданием.', 'tip'); }
    else if (levelFromLink()) { exitTrial(); TASKS = lessonTasks(lessonIdx); selectTask(TASKS.findIndex(t => t.kind === 'custom')); }
    else {
      const D = heroFromLink(), tr = !D && trialFromLink();
      if (D) openHeroPage(D);
      else if (tr) openTrialResult(tr.h.length - 1, tr);
    }
  });

  /* ---------- Испытание Сбоя (js/trial.js): проверка главы — шесть заданий по темам, новые карты, без подсказок.
     Идущая попытка — save.trial.cur: { at, seed, ok: { id: с какого запуска решено }, runs: { id: запусков },
     ahead — маска тем, до которых уроки ещё не дошли, active — открыта сейчас }. Завершённые — save.trial.hist:
     { at, end, s: [с какого запуска решено каждое задание, 0 — не решено], ahead }. Итог — карточка для родителя
     (openTrialResult): счёт, темы, «было → стало» по датам; ссылка #trial=… открывает её только для просмотра ---------- */
  const TR = HeroTrial.TASKS;
  let inTrial = false;
  const trialData = () => (save.trial = save.trial || { cur: null, hist: [] });
  const lessonDone = id => { const l = LESSONS.find(x => x.id === id); return !!l && l.tasks.every(solvedTask); };
  const topicAhead = t => (t.lessons || [t.topic]).some(id => !lessonDone(id)); // уроки темы ещё не пройдены
  const courseDone = () => LESSONS.every(l => l.tasks.every(solvedTask));
  const trialSolved = () => { const c = trialData().cur; return c ? TR.filter(t => c.ok[t.id]).length : 0; };
  function recScore(r) { return r.s.filter(Boolean).length; }
  // Время попытки — только активное: между запусками и правками считаем не больше 10 минут, перерывы и «Выйти» не идут в счёт
  function trialTick(c, resume) {
    const now = Date.now();
    if (!resume && c.last) c.spent = (c.spent || 0) + Math.max(0, Math.min(now - c.last, 10 * 6e4));
    c.last = now;
  }
  const ruDate = (ms, opts = { day: 'numeric', month: 'long' }) => new Date(ms).toLocaleDateString('ru-RU', opts);
  const andList = a => (a.length > 1 ? `${a.slice(0, -1).join(', ')} и ${a[a.length - 1]}` : a[0] || '');
  function topicLabel(t) {
    const nums = (t.lessons || [t.topic]).map(id => lessonNo(LESSONS.findIndex(l => l.id === id)));
    return nums.length > 1 ? `Уроки ${nums[0]}–${nums[nums.length - 1]}` : `Урок ${nums[0]}`;
  }
  function spanText(ms) {
    const d = Math.max(1, Math.round(ms / 864e5)), w = Math.round(d / 7), m = Math.round(d / 30);
    return d < 14 ? `${d} ${plural(d, 'день', 'дня', 'дней')}` : d < 63 ? `${w} ${plural(w, 'неделю', 'недели', 'недель')}` : `${m} ${plural(m, 'месяц', 'месяца', 'месяцев')}`;
  }
  // Для столбиков и ссылок — не больше 8 попыток по порядку: первая (точка отсчёта), лучшая и последние
  function keyAttempts(list) {
    if (list.length <= 8) return list;
    const best = list.reduce((b, h, i) => recScore(h) > recScore(list[b]) ? i : b, 0), keep = new Set([0, best]);
    for (let i = list.length - 1; keep.size < 8; i--) keep.add(i);
    return list.filter((h, i) => keep.has(i));
  }
  // Столбики попыток: { end, n } по порядку; cur — какая выделена
  function histBars(list, cur = -1) {
    return list.map((h, k) => `<div class="th-col${k === cur ? ' cur' : ''}" title="${ruDate(h.end)}: ${h.n} из ${TR.length}">`
      + `<span class="th-n">${h.n}</span><span class="th-bar"><i style="height:${Math.max(6, (h.n / TR.length) * 100)}%"></i></span>`
      + `<span class="th-d">${ruDate(h.end, { day: 'numeric', month: 'short' }).replace('.', '')}</span></div>`).join('');
  }

  // Режим испытания: вкладки — шесть испытаний, над заданием — полоска; урок и его вкладки ждут
  function enterTrial(i) {
    const c = trialData().cur;
    if (!c || running) return;
    inTrial = true;
    c.active = true;
    trialTick(c, true);
    persist();
    TASKS = TR;
    selectTask(i ?? Math.max(0, TR.findIndex(t => !c.ok[t.id])));
  }
  // Выйти из режима (попытка остаётся — её можно продолжить); сам урок выбирает тот, кто вызвал
  function exitTrial() {
    if (!inTrial) return;
    inTrial = false;
    const c = trialData().cur;
    if (c) c.active = false;
    persist();
    $('#trialBar').hidden = true;
  }
  function leaveTrial() {
    exitTrial();
    TASKS = lessonTasks(lessonIdx);
    selectTask(Math.min(save.pos[LESSONS[lessonIdx].id] || 0, MAIN().length - 1));
  }
  function startTrial() {
    if (running) stopRun();
    const tr = trialData(), seed = 10000 + Math.floor(Math.random() * 900000);
    tr.cur = { at: Date.now(), seed, ok: {}, runs: {}, ahead: HeroTrial.toMask(TR.filter(topicAhead).map(t => t.id)), active: true };
    // каждая попытка — новые карты и пустой редактор
    TR.forEach((t, i) => { save.seeds[t.id] = seed + i * 7919; delete save.code[t.id]; delete save.fails[t.id]; delete save.hints[t.id]; });
    persist();
    closeTrialCard();
    enterTrial(0);
    talk(courseDone() ? STORY.trial.fixed : STORY.trial.intro);
  }
  function endTrial() {
    const tr = trialData(), c = tr.cur;
    if (!c || running) return;
    trialTick(c);
    tr.hist.push({ at: c.at, end: Date.now(), s: TR.map(t => c.ok[t.id] || 0), ahead: c.ahead, t: c.spent || 0 });
    if (tr.hist.length > 30) tr.hist.splice(1, 1); // первая попытка — точка отсчёта, её храним
    tr.cur = null;
    persist();
    leaveTrial();
    checkAwards();
    Sound.play('levelup');
    openTrialResult(tr.hist.length - 1);
  }
  function renderTrialBar() {
    $('#trialBar').hidden = !inTrial;
    if (!inTrial) return;
    const n = trialSolved();
    $('#trialCount').textContent = `Решено ${n} из ${TR.length}`;
    if (!finishArmed) $('#trialFinish').textContent = n === TR.length ? 'Итоги' : 'Завершить';
  }
  // Испытание решено: «Дальше» — следующее нерешённое, а когда решены все — итоги
  function finishExam(t, code) {
    const c = trialData().cur;
    if (!c) return;
    const miss = HeroTrial.unmet(t, code);
    if (miss) { log(miss, 'err'); Sound.play('fail'); return; }
    if (!c.ok[t.id]) c.ok[t.id] = c.runs[t.id] || 1;
    trialTick(c);
    outroPending = false;
    persist();
    renderTabs();
    const n = trialSolved(), nx = TR.find(x => !c.ok[x.id]), runs = c.ok[t.id];
    $('#resStars').innerHTML = `<i class="on exam">${n}/${TR.length}</i>`;
    $('#resTitle').textContent = `Испытание ${TR.indexOf(t) + 1} пройдено!`;
    $('#resLevel').hidden = true;
    $('#resList').innerHTML = `<li class="on">${maps.length > 1 ? 'Код прошёл все три карты' : 'Бит дошёл до флага'}</li>`
      + `<li class="${runs === 1 ? 'on' : ''}">${runs === 1 ? 'С первого запуска' : `С ${runs}-го запуска — тоже засчитано`}</li>`
      + `<li class="on">Тема «${esc(t.name.toLowerCase())}» — в руках</li>`;
    $('#nextBtn').textContent = nx ? `Испытание ${TR.indexOf(nx) + 1}: ${nx.short}` : 'Итоги испытания';
    $('#bonusBtn').hidden = $('#againBtn').hidden = $('#editLvlBtn').hidden = true;
    $('#result').hidden = false;
    Sound.play('stars', { n: 3 });
  }
  let finishArmed = null;
  $('#trialFinish').addEventListener('click', e => {
    if (running) return;
    const left = TR.length - trialSolved();
    if (left && !finishArmed) { // нерешённые не засчитаются — переспросим
      e.currentTarget.textContent = `Точно? Осталось ${left}`;
      finishArmed = setTimeout(() => { finishArmed = null; renderTrialBar(); }, 3500);
      return;
    }
    clearTimeout(finishArmed);
    finishArmed = null;
    endTrial();
  });
  ta.addEventListener('input', () => { if (inTrial && trialData().cur) trialTick(trialData().cur); }); // правка кода — тоже работа над испытанием
  $('#trialPause').addEventListener('click', () => {
    if (running) return;
    leaveTrial();
    log('Испытание ждёт: продолжить можно с карты долины — кнопка «Испытание Сбоя».', 'tip');
  });

  // Окно испытания: что проверяем (по темам — пройдена или впереди), прошлые попытки, «Начать» или «Продолжить»
  let restartArmed = null;
  function openTrialCard() {
    const tr = trialData(), c = tr.cur, last = tr.hist[tr.hist.length - 1], locked = !prologueDone();
    $('#tcTopics').innerHTML = TR.map((t, i) => {
      const ahead = topicAhead(t), done = c && c.ok[t.id];
      return `<li class="${done ? 'done' : ahead ? 'ahead' : 'ready'}"><i>${done ? '✓' : i + 1}</i><span class="tc-t"><b>${esc(t.name)}</b>`
        + `<span>${topicLabel(t)} · «${esc(t.title)}»</span></span><span class="tc-s">${done ? 'решено' : ahead ? 'тема впереди' : 'тема пройдена'}</span></li>`;
    }).join('') + (TR.some(topicAhead) ? '<li class="tc-note">Темы, до которых уроки ещё не дошли, тоже можно попробовать: так видно точку отсчёта.</li>' : '');
    $('#tcHistBox').hidden = !tr.hist.length;
    $('#tcHist').innerHTML = histBars(keyAttempts(tr.hist).map(h => ({ end: h.end, n: recScore(h) })));
    const days = last ? Math.floor((Date.now() - last.end) / 864e5) : 0;
    const recent = last && !c && days < 14;
    $('#tcWarn').hidden = !locked && !recent;
    $('#tcWarn').textContent = locked ? 'Испытание откроется после пролога — сначала первые шаги с Битом.'
      : `Прошлое испытание было ${days ? `${days} ${plural(days, 'день', 'дня', 'дней')} назад` : 'сегодня'}. Для честного сравнения лучше подождать хотя бы две недели.`;
    $('#tcStart').textContent = c ? `Продолжить — решено ${trialSolved()} из ${TR.length}` : recent ? 'Всё равно начать' : 'Начать испытание';
    $('#tcStart').disabled = locked;
    $('#tcRestart').hidden = !c;
    $('#tcRestart').textContent = 'Начать заново';
    $('#tcLast').hidden = !last;
    $('#trialCard').hidden = false;
    document.body.classList.add('recap-open');
    $('#tcStart').focus({ preventScroll: true });
  }
  function closeTrialCard() { $('#trialCard').hidden = true; document.body.classList.remove('recap-open'); }
  $('#tcStart').addEventListener('click', () => {
    if (running) stopRun();
    if (trialData().cur) { closeTrialCard(); enterTrial(); } else startTrial();
  });
  $('#tcRestart').addEventListener('click', e => {
    if (!restartArmed) {
      e.currentTarget.textContent = 'Точно? Решённое в этой попытке пропадёт';
      restartArmed = setTimeout(() => { restartArmed = null; $('#tcRestart').textContent = 'Начать заново'; }, 3500);
      return;
    }
    clearTimeout(restartArmed);
    restartArmed = null;
    startTrial();
  });
  $('#tcLast').addEventListener('click', () => { closeTrialCard(); openTrialResult(trialData().hist.length - 1); });
  $('#tcClose').addEventListener('click', closeTrialCard);
  $('#trialCard').addEventListener('click', e => { if (e.target.id === 'trialCard') closeTrialCard(); });
  $('#valleyTrial').addEventListener('click', () => { closeValley(); openTrialCard(); });
  $('#hpTrialGo').addEventListener('click', () => { closeHeroPage(); openTrialCard(); });
  $('#hpTrialLast').addEventListener('click', () => { closeHeroPage(); openTrialResult(trialData().hist.length - 1); });

  // Итог испытания — карточка для родителя. shared — данные из ссылки #trial=… (только смотреть)
  let trShared = null, trIdx = -1;
  function ringSvg(s, ahead) {
    const R = 50, C = 2 * Math.PI * R, seg = C / TR.length, gap = 7, n = s.filter(Boolean).length;
    const arcs = TR.map((t, i) => {
      const cls = s[i] ? (s[i] === 1 ? 'first' : 'ok') : ahead.includes(t.id) ? 'ahead' : 'miss';
      return `<circle class="rs ${cls}" cx="64" cy="64" r="${R}" stroke-dasharray="${(seg - gap).toFixed(2)} ${(C - seg + gap).toFixed(2)}" stroke-dashoffset="${(-i * seg).toFixed(2)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 128 128"><g transform="rotate(-90 64 64)">${arcs}</g><text x="64" y="72" text-anchor="middle">${n}<tspan dx="2">/${TR.length}</tspan></text></svg>`;
  }
  function openTrialResult(idx, shared = null) {
    trShared = shared;
    trIdx = idx;
    const hist = shared ? shared.h : trialData().hist, rec = hist[idx];
    if (!rec) return;
    const name = shared ? shared.n : cleanName(save.name), n = recScore(rec), ahead = HeroTrial.fromMask(rec.ahead);
    $('#trKicker').textContent = `Долина Эникей · Испытание Сбоя · ${ruDate(rec.end)}`;
    $('#trTitle').textContent = `${n} из ${TR.length}`;
    $('#trLead').textContent = n === TR.length ? 'Все шесть испытаний пройдены — глава 1 в руках!'
      : n >= 4 ? 'Почти вся глава в руках: осталось совсем немного.'
      : n >= 2 ? 'Хорошее начало: часть тем уже получается уверенно.'
      : 'Это точка отсчёта: большая часть тем главы ещё впереди.';
    $('#trName').hidden = !name;
    $('#trName').textContent = name ? `Пишет код: ${name}` : '';
    $('#trRing').innerHTML = ringSvg(rec.s, ahead);
    $('#trTopics').innerHTML = TR.map((t, i) => {
      const s = rec.s[i], cls = s ? (s === 1 ? 'first' : 'ok') : ahead.includes(t.id) ? 'ahead' : 'miss';
      const st = s === 1 ? 'с первого запуска' : s ? `с ${s}-го запуска` : ahead.includes(t.id) ? 'тема ещё впереди' : 'пока не получилось';
      return `<li class="${cls}"><i>${s ? '✓' : i + 1}</i><span class="tt-t"><b>${esc(t.name)}</b><span>${topicLabel(t)}</span></span><span class="tt-s">${st}</span></li>`;
    }).join('');
    const names = f => TR.filter((t, i) => f(t, i)).map(t => t.name.toLowerCase());
    const good = names((t, i) => rec.s[i]), redo = names((t, i) => !rec.s[i] && !ahead.includes(t.id)), later = names((t, i) => !rec.s[i] && ahead.includes(t.id));
    const mins = rec.t ? Math.max(1, Math.round(rec.t / 6e4)) : 0;
    $('#trSum').textContent = [good.length ? `Получается: ${andList(good)}.` : '', redo.length ? `Стоит повторить: ${andList(redo)}.` : '',
      later.length ? `Ещё впереди: ${andList(later)}.` : '', mins ? `Время: ${mins} ${plural(mins, 'минута', 'минуты', 'минут')}.` : ''].filter(Boolean).join(' ');
    // было → стало: все попытки до этой, первая — точка отсчёта
    const upto = hist.slice(0, idx + 1), shown = keyAttempts(upto), first = upto[0], d = n - recScore(first);
    $('#trHist').innerHTML = histBars(shown.map(h => ({ end: h.end, n: recScore(h) })), shown.length - 1);
    $('#trDelta').textContent = idx === 0
      ? 'Это первое испытание — точка отсчёта. Повтори его через месяц-два, и здесь будет видно, как растёт результат.'
      : `Было ${recScore(first)} из ${TR.length} (${ruDate(first.end)}), стало ${n} из ${TR.length}`
        + (d > 0 ? `: на ${d} больше${rec.end - first.end > 864e5 ? ' за ' + spanText(rec.end - first.end) : ''}.`
          : d === 0 ? '. Результат держится.' : '. Стоит повторить темы и попробовать снова.');
    $('#trShare').hidden = true;
    $('#trShareBtn').hidden = !!shared;
    $('#trCert').hidden = !!shared || n < TR.length; // за 6 из 6 — грамота
    $('#trOpenGame').hidden = !shared;
    $('#trSharedNote').hidden = !shared;
    const box = $('#trialRes');
    box.classList.toggle('over', !!shared); // по ссылке — поверх заставки
    box.hidden = false;
    box.scrollTop = 0;
    document.body.classList.add('recap-open');
    (shared ? $('#trOpenGame') : $('#trShareBtn')).focus({ preventScroll: true });
  }
  function closeTrialResult() {
    $('#trialRes').hidden = true;
    document.body.classList.remove('recap-open');
    trShared = null;
  }
  // Ссылка на итог: попытки до этой (не больше 8), время — в минутах, чтобы ссылка была короче
  function trialOutput() {
    const hist = keyAttempts(trialData().hist.slice(0, trIdx + 1)), rec = hist[hist.length - 1], first = hist[0], name = cleanName(save.name);
    const h = hist.map(r => [Math.round(r.at / 6e4), Math.round(r.end / 6e4), r.s, r.ahead, r.t ? Math.max(1, Math.round(r.t / 6e4)) : 0]);
    const url = `${location.href.split(/[?#]/)[0]}#trial=${b64enc(JSON.stringify({ v: 1, n: name, h }))}`;
    $('#trUrl').value = url;
    $('#trMsg').value = `${name ? `${name}: ` : ''}Испытание Сбоя в Долине Эникей — ${recScore(rec)} из ${TR.length}`
      + (hist.length > 1 ? ` (было ${recScore(first)} из ${TR.length}, ${ruDate(first.end)})` : '') + `. Итог по темам: ${url}`;
  }
  function cleanTrial(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.h) || !d.h.length) return null;
    const int = (x, max) => Math.max(0, Math.min(max, Math.floor(+x) || 0));
    const h = d.h.slice(-8).filter(a => Array.isArray(a) && Array.isArray(a[2])).map(a => ({
      at: int(a[0], 1e8) * 6e4, end: int(a[1], 1e8) * 6e4, s: TR.map((t, i) => int(a[2][i], 999)), ahead: int(a[3], (1 << TR.length) - 1), t: int(a[4], 1e4) * 6e4,
    }));
    return h.length ? { n: cleanName(d.n), h } : null;
  }
  function trialFromLink() {
    const m = location.hash.match(/^#trial=([A-Za-z0-9_-]{8,4000})$/);
    if (!m || SHOW) return null;
    history.replaceState(null, '', location.href.split('#')[0]);
    try { return cleanTrial(JSON.parse(b64dec(m[1]))); } catch (e) { return null; }
  }
  $('#trShareBtn').addEventListener('click', () => {
    const box = $('#trShare');
    box.hidden = !box.hidden;
    if (box.hidden) return;
    $('#trShareSum').textContent = '';
    trialOutput();
    box.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    $('#trCopyMsg').focus({ preventScroll: true });
  });
  $('#trCopyMsg').addEventListener('click', () => copyField('#trMsg', 'Сообщение скопировано — вставь его в чат с родителем.', '#trShareSum'));
  $('#trCopyUrl').addEventListener('click', () => copyField('#trUrl', 'Ссылка скопирована.', '#trShareSum'));
  $('#trDone').addEventListener('click', closeTrialResult);
  $('#trOpenGame').addEventListener('click', closeTrialResult);
  $('#trClose').addEventListener('click', closeTrialResult);
  $('#trialRes').addEventListener('click', e => { if (e.target.id === 'trialRes') closeTrialResult(); });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#trialRes').hidden) closeTrialResult();
    else if (!$('#trialCard').hidden) closeTrialCard();
  });

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
    const bot = faceRest(hero.clone(true));
    bot.position.set(0, 0, 0);
    bot.rotation.set(0, 0, 0);
    bot.scale.set(1, 1, 1);
    bot.getObjectByName('arrow').visible = false;
    sc.add(bot);
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    c.position.set(0, 0.9, 2.35);
    c.lookAt(0, 0.5, 0);
    let raf = 0;
    const blink = makeBlinker(bot);
    const loop = t => {
      bot.rotation.y = reduceMotion ? 0.45 : 0.35 + Math.sin(t / 1500) * 0.65;
      blink(t / 1000);
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
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#recap').hidden && $('#cert').hidden) closeRecap(); });

  /* ---------- Грамота (js/cert.js): за пролог, за Испытание Сбоя на 6 из 6 и за всю главу. Рисунок на canvas —
     он же идёт в печать (A4 альбомом, «Сохранить как PDF») и в картинку PNG для чата с родителями.
     Имя — save.name (то же, что на странице героя), подпись репетитора — save.tutor, дата — save.cert[вид]:
     когда грамота открылась впервые (у испытания — дата первых 6 из 6) ---------- */
  const CERT = HeroCert;
  const cleanTutor = s => cleanTitle(s).slice(0, 32);
  const trialSix = () => trialData().hist.find(h => recScore(h) === TR.length);
  const certOk = kind => (kind === 'prolog' ? prologueDone() : kind === 'trial' ? !!trialSix() : courseDone());
  const certFresh = () => CERT.KINDS.filter(k => certOk(k) && !(save.cert || {})[k]); // открыты, но ещё не смотрели
  // Адрес сайта — мелко внизу грамоты (у файла с диска его нет)
  const siteName = () => (/^https?:$/.test(location.protocol) ? (location.host + location.pathname).replace(/\/(index\.html)?$/, '') : '');
  function certInfo(kind) {
    const D = heroData(), S = heroSummary(D), main = LESSONS.filter(l => !l.prologue);
    const info = { name: D.n, tutor: cleanTutor(save.tutor), date: (save.cert || {})[kind] || Date.now(), level: S.level, rank: LEVELS[S.level - 1].title, site: siteName() };
    if (kind === 'prolog') {
      const L = LESSONS[PRO];
      return Object.assign(info, {
        tasks: L.tasks.length, lines: L.tasks.reduce((n, t) => n + codeLines(save.code[t.id] ?? t.hints[2]).length, 0),
        stars: lessonStars(L), maxStars: L.tasks.length * 3, cmds: [...new Set(L.tasks.flatMap(t => t.cmds))],
      });
    }
    if (kind === 'trial') {
      const rec = trialSix(), first = trialData().hist[0];
      return Object.assign(info, {
        date: rec.end, of: TR.length, first: rec.s.filter(v => v === 1).length, mins: rec.t ? Math.max(1, Math.round(rec.t / 6e4)) : 0,
        topics: TR.map(t => t.name), was: first !== rec && recScore(first) < TR.length ? { n: recScore(first), date: first.end } : null,
      });
    }
    return Object.assign(info, {
      lessons: main.length, topics: main.map(l => (l.topic || {}).name || l.title), stars: S.stars, maxStars: MAX_STARS,
      solved: S.A.solved, lines: D.k, days: D.d,
    });
  }
  // 3D-портрет Бита в его снаряжении — на плитке травы; рисуется один раз, пока снаряжение то же
  let certPortrait = null;
  function heroPortrait(gear) {
    const id = JSON.stringify(gear);
    if (certPortrait && certPortrait.id === id) return certPortrait.img;
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    const size = 760;
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7fb0, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(2, 4, 3);
    sc.add(sun);
    const bot = makeHeroModel(gear);
    bot.rotation.y = 0.45;
    sc.add(bot);
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.54, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x5fb35a, flatShading: true, roughness: 0.9 }));
    tile.position.y = -0.08;
    sc.add(tile);
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    c.position.set(0, 0.95, 2.25);
    c.lookAt(0, 0.5, 0);
    r.render(sc, c);
    const img = document.createElement('canvas');
    img.width = img.height = size;
    img.getContext('2d').drawImage(r.domElement, 0, 0);
    r.dispose();
    r.forceContextLoss();
    certPortrait = { id, img };
    return img;
  }
  let certKind = null, certToken = 0, certBlob = null, certTimer = null, certFake = null;
  const certFile = () => `Грамота — ${CERT.META[certKind].name}${save.name ? ` — ${cleanName(save.name)}` : ''}.png`.replace(/[\\/:*?"<>|]/g, '');
  // Нарисовать грамоту; пока шрифты игры грузятся — запасными, потом ещё раз. fake — данные для режима ?shots
  async function paintCert() {
    const token = ++certToken;
    const ready = await CERT.fonts();
    if (token !== certToken || $('#cert').hidden) return;
    const draw = () => {
      const info = certFake ? certFake.info : certInfo(certKind);
      CERT.draw($('#certCanvas'), CERT.content(certKind, info), heroPortrait(certFake ? certFake.gear : heroData().g));
      certBlob = null;
      $('#certCanvas').toBlob(b => { if (token === certToken) certBlob = b; }, 'image/png');
    };
    draw();
    if (!ready) CERT.fonts(0).then(() => { if (token === certToken && !$('#cert').hidden) draw(); });
  }
  function renderCertTabs() {
    $('#certKinds').innerHTML = CERT.KINDS.map(k => {
      const ok = certFake ? certFake.kinds.includes(k) : certOk(k), m = CERT.META[k];
      return `<button type="button" class="cert-kind${k === certKind ? ' active' : ''}" data-kind="${k}" aria-pressed="${k === certKind}"${ok ? '' : ` disabled title="Откроется ${esc(m.when)}"`}>`
        + `<b>${esc(m.name)}</b><span>${ok ? 'получена' : `откроется ${esc(m.when)}`}</span></button>`;
    }).join('');
    $('#certLead').textContent = `Грамота ${CERT.META[certKind].when}. Впиши имя, а потом распечатай или отправь картинкой.`;
  }
  function openCert(kind, fake = null) {
    certFake = fake;
    const kinds = fake ? fake.kinds : CERT.KINDS.filter(certOk);
    if (!kinds.length) return;
    certKind = kinds.includes(kind) ? kind : kinds[kinds.length - 1];
    if (!fake) {
      save.cert = save.cert || {};
      if (!save.cert[certKind]) { save.cert[certKind] = certKind === 'trial' ? trialSix().end : Date.now(); persist(); }
    }
    $('#certName').value = fake ? fake.info.name : save.name || '';
    $('#certTutor').value = fake ? fake.info.tutor : save.tutor || '';
    $('#certSum').textContent = '';
    renderCertTabs();
    $('#cert').hidden = false;
    $('#cert').scrollTop = 0;
    document.body.classList.add('recap-open', 'cert-open');
    paintCert();
    $('#certPrint').focus({ preventScroll: true });
  }
  function closeCert() {
    $('#cert').hidden = true;
    certToken++;
    document.body.classList.remove('cert-open');
    // под грамотой может быть открыта другая карточка — тогда прокрутка страницы остаётся выключенной
    if (![...document.querySelectorAll('.recap, .hp')].some(e => !e.hidden)) document.body.classList.remove('recap-open');
    if (!$('#heroPage').hidden && !hpShared) renderHeroPage();
    if (!$('#recap').hidden) $('#recapCert').focus({ preventScroll: true });
  }
  $('#certKinds').addEventListener('click', e => {
    const b = e.target.closest('.cert-kind');
    if (!b || b.disabled || b.dataset.kind === certKind) return;
    openCert(b.dataset.kind, certFake);
  });
  // Имя и подпись: грамота перерисовывается, пока печатают (не на каждую букву)
  const repaintSoon = () => { clearTimeout(certTimer); certTimer = setTimeout(paintCert, 250); };
  $('#certName').addEventListener('input', e => {
    if (certFake) certFake.info.name = cleanName(e.target.value); else { save.name = cleanName(e.target.value); persist(); }
    repaintSoon();
  });
  $('#certTutor').addEventListener('input', e => {
    if (certFake) certFake.info.tutor = cleanTutor(e.target.value); else { save.tutor = cleanTutor(e.target.value); persist(); }
    repaintSoon();
  });
  // Печать: на листе только сама грамота (css: body.cert-open в @media print)
  $('#certPrint').addEventListener('click', () => {
    clearTimeout(certTimer);
    window.print();
  });
  $('#certPng').addEventListener('click', () => {
    const save_ = blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = certFile();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      $('#certSum').textContent = `Картинка сохранена: «${certFile()}» — в загрузках.`;
    };
    if (certBlob) save_(certBlob); else $('#certCanvas').toBlob(b => b && save_(b), 'image/png');
  });
  // «Отправить» — на телефоне сразу в мессенджер (если браузер умеет делиться файлами)
  const canShareFiles = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; } })();
  $('#certShare').hidden = !canShareFiles;
  $('#certShare').addEventListener('click', () => {
    if (!certBlob) { $('#certSum').textContent = 'Картинка ещё готовится — нажми через секунду.'; return; }
    navigator.share({ files: [new File([certBlob], certFile(), { type: 'image/png' })], title: 'Грамота — Долина Эникей' }).catch(() => {});
  });
  $('#certClose').addEventListener('click', closeCert);
  $('#cert').addEventListener('click', e => { if (e.target.id === 'cert') closeCert(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#cert').hidden) { e.stopImmediatePropagation(); closeCert(); } }, true);
  $('#recapCert').addEventListener('click', () => openCert('prolog'));
  $('#trCert').addEventListener('click', () => openCert('trial'));
  // Раздел «Грамоты» на странице героя: какие уже есть и за что дают остальные
  function renderCertSec(shared) {
    $('#hpCertSec').hidden = shared;
    if (shared) return;
    const got = CERT.KINDS.filter(certOk);
    $('#hpCertCount').textContent = `${got.length} из ${CERT.KINDS.length}`;
    $('#hpCerts').innerHTML = CERT.KINDS.map(k => {
      const ok = got.includes(k), m = CERT.META[k];
      return `<li><button type="button" class="hp-cert${ok ? ' on' : ''}" data-kind="${k}"${ok ? '' : ' disabled'}>`
        + `<span class="hc-seal" aria-hidden="true">${ok ? '✓' : '?'}</span><span class="hc-text"><b>${esc(m.name)}</b><span>${ok ? 'открыть, распечатать, отправить' : `откроется ${esc(m.when)}`}</span></span></button></li>`;
    }).join('');
  }
  $('#hpCerts').addEventListener('click', e => { const b = e.target.closest('.hp-cert'); if (b && !b.disabled) openCert(b.dataset.kind); });

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
      if (!$('#heroPage').hidden || !$('#trialRes').hidden) return; // поверх заставки открыта страница по ссылке
      e.preventDefault(); e.stopPropagation(); go();
    };
    addEventListener('keydown', onKey, true);
    sp.addEventListener('pointerdown', e => { e.preventDefault(); go(); });
    $('#splashBtn').focus();
  })();

  /* ---------- Старт ---------- */
  resize();
  selectTask(taskIdx);
  if (!save.awards || save.gemsSeen === undefined) checkAwards(true); // полученное до появления достижений и кристаллов — без поздравлений
  const openHero = heroFromLink(), openTrial = !openHero && trialFromLink();
  if (!SHOW && !openHw && !openOwn && trialData().cur && trialData().cur.active) enterTrial(); // испытание шло, когда закрыли вкладку
  if (openHw) { // домашка по ссылке — сразу первое нерешённое задание (вступление урока покажет заставка)
    const items = hwItems(), first = items.find(x => !solvedTask(x.t)) || items[0];
    goTask(first.t.id, false);
    log(`Домашка от репетитора: ${items.length} ${plural(items.length, 'задание', 'задания', 'заданий')}. Список — над заданием, «Дальше» ведёт по нему.`, 'tip');
  }
  if (openOwn) { // уровень по ссылке — сразу его вкладка
    const ci = TASKS.findIndex(t => t.kind === 'custom');
    if (ci >= 0) { selectTask(ci); log(`Тебе прислали уровень «${TASKS[ci].title}». Реши его!`, 'tip'); }
  }
  if (openHero) openHeroPage(openHero); // страница героя по ссылке — поверх заставки, только смотреть
  if (openTrial) openTrialResult(openTrial.h.length - 1, openTrial); // итог испытания по ссылке — тоже
  requestAnimationFrame(t => { last = t; frame(t); });
  if (SHOW) (SHOTS ? startShots : startReel)();
})();
