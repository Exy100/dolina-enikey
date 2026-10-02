/* Кадры для объявления на Авито (HeroPoster): режим ?shots (js/app.js, раздел «Кадры для Авито»).
   Каждый кадр — постер на canvas: тёмный фон цветов игры, марка «Долина Эникей», заголовок для родителей
   (слова в *звёздочках* — золотом), подзаголовок, картинка и строка внизу. Данные выдуманные: ученик «Саша»,
   карты по сиду SEED. Что на кадрах — SHOTS; app.js готовит картинки (3D-мир, остров, грамота) и вызывает draw().
   Тексты проверяет tests/check-story.js (без мужского рода), задания и код — tests/check-tasks.js. */
const HeroPoster = (() => {
  const SIZES = { wide: { w: 1600, h: 1200, name: '4:3 — для Авито' }, square: { w: 1200, h: 1200, name: '1:1 — квадрат' } };
  const SEED = 7;
  const FOOT = 'Python для детей от 12 лет · онлайн, один на один с репетитором';
  // kind: world — 3D-мир задания task (run — прогнать эталон, чтобы был виден след Бита; near: 'boss' — остановиться
  // рядом со Сбоем) и его код;
  // hero — остров и прогресс; console — обычный Python: код и что он напечатал; trial — рост по испытанию;
  // cert — грамота; cta — призыв на пробное занятие
  const SHOTS = [
    { id: 'code', kind: 'world', task: 'c-stairs', run: true, title: 'Ребёнок пишет *настоящий Python*',
      sub: 'Робот Бит выполняет каждую строку кода в 3D-мире' },
    { id: 'logic', kind: 'world', task: 'choice', run: true, title: 'Циклы и условия — *на живых картах*',
      sub: 'Одна программа должна пройти три разные карты: думать, а не заучивать' },
    { id: 'story', kind: 'world', task: 'l-boss', run: true, near: 'boss', title: 'Сюжет держит интерес: *Великий Сбой*',
      sub: 'Квесты, персонажи и финальная битва — кодом на английском, как в настоящем Python' },
    { id: 'hero', kind: 'hero', title: 'Прогресс виден: *уровни и награды*',
      sub: 'Звёзды за каждое задание, достижения, кристаллы и снаряжение робота' },
    { id: 'console', kind: 'console', title: 'И обычный Python — *в консоли*',
      sub: 'print, input, переменные и циклы — задачи как на ОГЭ',
      code: 'total = 0\nfor i in range(3):\n    n = int(input("Монет на карте: "))\n    total = total + n\nprint("Всего монет:", total)\nif total > 10:\n    print("Бит богат!")',
      input: ['4', '5', '3'], prompt: 'Монет на карте: ', out: ['Всего монет: 12', 'Бит богат!'] },
    { id: 'trial', kind: 'trial', title: 'Родитель видит рост *цифрами*',
      sub: 'Испытание Сбоя раз в месяц-два: было 2 из 6 — стало 5 из 6' },
    { id: 'cert', kind: 'cert', title: 'Грамота *за каждую главу*', sub: 'Распечатать на A4 или отправить родителям картинкой' },
    { id: 'cta', kind: 'cta', title: 'Первое занятие — *пробное*', sub: 'Пролог: четыре программы за 20 минут и сюжетная завязка',
      lines: ['Занятия один на один, онлайн', 'Пролог и 7 уроков: команды, циклы, условия, while, переменные, функции', 'Домашка проверяется сама', 'Отчёт, испытание и грамота для родителей'],
      cta: 'Напишите — пришлю ссылку на пробное занятие' },
  ];

  const C = {
    bg1: '#1B1530', bg2: '#4A2560', ink: '#FFFFFF', soft: 'rgba(236,238,255,0.78)', dim: 'rgba(236,238,255,0.5)',
    gold: '#FFC83D', accent: '#A996FF', violet: '#6B4BD8', mint: '#3FD3B5', pink: '#FF6BB3', coral: '#FFA877',
    card: '#271F45', line: 'rgba(255,255,255,0.12)', code: '#2E2447', codeLine: '#45376B', term: '#150F29',
  };
  const TOK = { kw: '#FF8FB1', hero: '#FFD166', fn: '#8FD3FF', num: '#7FE0C8', str: '#B8F28B', com: '#8F82A8', plain: '#E8EAFF' };
  const HUES = { violet: ['#A496FF', '#6B4BD8'], mint: ['#5BE3C6', '#11917A'], gold: ['#FFD76A', '#D9960F'], coral: ['#FFA27A', '#E4572E'], sky: ['#8FD0FF', '#3C83E0'], pink: ['#FF9ACF', '#D63A8C'] };
  const F = {
    display: (w, s) => `${w} ${s}px Unbounded, Rubik, "Segoe UI", Arial, sans-serif`,
    ui: (w, s) => `${w} ${s}px Rubik, "Segoe UI", Arial, sans-serif`,
    mono: (w, s) => `${w} ${s}px "JetBrains Mono", Consolas, monospace`,
  };

  /* ---- Помощники рисования ---- */
  function rr(x, y, w, h, r) {
    const p = new Path2D();
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y);
    p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r);
    p.closePath();
    return p;
  }
  const disc = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); };
  function fit(x, text, maxW, font, size, min) {
    let s = size;
    x.font = font(s);
    while (s > min && x.measureText(text).width > maxW) { s -= 2; x.font = font(s); }
    return s;
  }
  function wrap(x, text, maxW) {
    const lines = [];
    let cur = '';
    String(text).split(' ').forEach(w => {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && x.measureText(t.replace(/\*/g, '')).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // Строка с выделением: *слова* — золотом (звёздочки могут открываться в одной строке, а закрываться в другой)
  function richLine(x, line, px, y, on) {
    line.split(/(\*)/).forEach(part => {
      if (part === '*') { on.v = !on.v; return; }
      if (!part) return;
      x.fillStyle = on.v ? C.gold : C.ink;
      x.fillText(part, px, y);
      px += x.measureText(part).width;
    });
  }
  function shadow(x, blur, oy, col = 'rgba(5,6,20,0.55)') { x.shadowColor = col; x.shadowBlur = blur; x.shadowOffsetY = oy; }
  const noShadow = x => { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; };
  // Картинка в прямоугольнике: cover — обрезать по центру, contain — целиком
  function placeImg(x, img, bx, by, bw, bh, mode = 'cover') {
    const k = mode === 'cover' ? Math.max(bw / img.width, bh / img.height) : Math.min(bw / img.width, bh / img.height);
    const w = img.width * k, h = img.height * k;
    x.drawImage(img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
    return { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h };
  }
  function logo(x, px, py, s) {
    [[0, 0, C.gold], [1, 0, C.accent], [2, 0, '#C9C0FF'], [0, 1, C.mint], [1, 1, '#FCE3A1'], [0, 2, C.pink]].forEach(([i, j, col]) => {
      x.fillStyle = col;
      x.fill(rr(px + i * s * 1.3, py + j * s * 1.3, s, s, s * 0.25));
    });
  }

  /* ---- Рамка кадра: фон, марка, заголовок, подзаголовок, строка внизу. Возвращает область для содержимого ---- */
  function frame(x, W, H, spec) {
    const sq = W / H < 1.2, pad = 64;
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, C.bg1); bg.addColorStop(1, C.bg2);
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    [[W * 0.92, H * 0.08, 520, 'rgba(255,107,179,0.20)'], [W * 0.05, H * 0.95, 620, 'rgba(63,211,181,0.16)'], [W * 0.5, H * 0.55, 700, 'rgba(140,123,255,0.16)']].forEach(([cx, cy, r, col]) => {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
    // точки-сетка — клетки долины
    x.fillStyle = 'rgba(255,255,255,0.05)';
    for (let gy = 28; gy < H; gy += 44) for (let gx = 28; gx < W; gx += 44) x.fillRect(gx, gy, 3, 3);
    // марка и метка
    logo(x, pad, pad - 4, 13);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = C.ink; x.font = F.display(700, 30);
    x.fillText('Долина Эникей', pad + 66, pad + 30);
    const tag = 'Python · 12+';
    x.font = F.ui(600, 26);
    const tw = x.measureText(tag).width + 44;
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fill(rr(W - pad - tw, pad - 8, tw, 50, 25));
    x.fillStyle = C.ink; x.fillText(tag, W - pad - tw + 22, pad + 26);
    // заголовок и подзаголовок
    const maxW = W - pad * 2;
    let size = sq ? 60 : 68;
    x.font = F.display(700, size);
    let lines = wrap(x, spec.title, maxW);
    while (lines.length > 2 && size > 40) { size -= 4; x.font = F.display(700, size); lines = wrap(x, spec.title, maxW); }
    let y = pad + 104 + size * 0.8;
    const on = { v: false };
    lines.forEach(l => { richLine(x, l, pad, y, on); y += size * 1.18; });
    x.fillStyle = C.soft; x.font = F.ui(400, sq ? 30 : 32);
    wrap(x, spec.sub || '', maxW).slice(0, 2).forEach(l => { x.fillText(l, pad, y + 6); y += 42; });
    // строка внизу
    x.fillStyle = C.dim; x.font = F.ui(500, 24);
    x.fillText(spec.foot || FOOT, pad, H - pad + 18);
    return { x: pad, y: y + 30, w: maxW, h: H - pad - 40 - (y + 30), sq, pad };
  }

  /* ---- Карточка кода: окно редактора с подсветкой и номерами строк ---- */
  function codeCard(x, lines, bx, by, bw, maxH, file) {
    const longest = Math.max(...lines.map(l => l.reduce((n, t) => n + t.t.length, 0)), 10);
    let fs = Math.min(30, (bw - 120) / (longest * 0.62), (maxH - 100) / (lines.length * 1.55));
    fs = Math.max(16, fs);
    const lh = fs * 1.55, bh = Math.min(maxH, 70 + lines.length * lh + 34);
    shadow(x, 50, 24);
    x.fillStyle = C.code; x.fill(rr(bx, by, bw, bh, 24));
    noShadow(x);
    x.strokeStyle = C.codeLine; x.lineWidth = 2; x.stroke(rr(bx, by, bw, bh, 24));
    // шапка окна
    ['#FF6B6B', '#FFD166', '#3FD3B5'].forEach((col, i) => { x.fillStyle = col; disc(x, bx + 30 + i * 24, by + 32, 7); x.fill(); });
    x.fillStyle = 'rgba(232,234,255,0.6)'; x.font = F.mono(400, 20); x.textAlign = 'left';
    x.fillText(file, bx + 112, by + 39);
    x.fillStyle = C.codeLine; x.fillRect(bx, by + 62, bw, 2);
    let y = by + 70 + lh * 0.78;
    lines.forEach((l, i) => {
      if (y > by + bh - 14) return;
      x.font = F.mono(400, fs);
      x.fillStyle = 'rgba(116,121,166,0.8)'; x.textAlign = 'right';
      x.fillText(String(i + 1), bx + 34 + fs * 0.9, y);
      x.textAlign = 'left';
      let px = bx + 56 + fs * 0.9;
      l.forEach(t => {
        x.font = F.mono(t.c === 'kw' ? 600 : 400, fs);
        x.fillStyle = TOK[t.c] || TOK.plain;
        x.fillText(t.t, px, y);
        px += x.measureText(t.t).width;
      });
      y += lh;
    });
    return bh;
  }
  // Картинка в скруглённой рамке с тенью
  function photo(x, img, bx, by, bw, bh, r = 28, mode = 'cover', back = null) {
    shadow(x, 60, 28);
    const sky = x.createLinearGradient(0, by, 0, by + bh); // небо заката за прозрачным снимком мира
    sky.addColorStop(0, '#FFC9A8'); sky.addColorStop(0.5, '#F9BFC4'); sky.addColorStop(1, '#D9C2FF');
    x.fillStyle = back || sky; x.fill(rr(bx, by, bw, bh, r));
    noShadow(x);
    x.save(); x.clip(rr(bx, by, bw, bh, r));
    if (img) placeImg(x, img, bx, by, bw, bh, mode);
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.stroke(rr(bx, by, bw, bh, r));
  }
  function pill(x, text, px, py, col, bg, size = 24) {
    x.font = F.ui(600, size);
    const w = x.measureText(text).width + size * 1.4, h = size * 1.9;
    x.fillStyle = bg; x.fill(rr(px, py, w, h, h / 2));
    x.fillStyle = col; x.textAlign = 'left';
    x.fillText(text, px + size * 0.7, py + h * 0.68);
    return w;
  }

  /* ---- Виды кадров ---- */
  // Где в кадре 3D-мир: на квадрате длинный код не помещается — тогда мир на всю ширину и высоту
  function worldRect(a, s) {
    if (!a.sq) return { x: a.x, y: a.y, w: a.w * 0.66, h: a.h };
    return s.code.length <= 8 ? { x: a.x, y: a.y, w: a.w, h: a.h * 0.55 } : { x: a.x, y: a.y, w: a.w, h: a.h };
  }
  function world(x, a, s) {
    const r = worldRect(a, s);
    photo(x, s.img, r.x, r.y, r.w, r.h);
    if (s.badge) pill(x, s.badge, r.x + 24, r.y + 24, '#1B1E3C', 'rgba(255,255,255,0.92)');
    if (!a.sq) { const cw = a.w * 0.42; codeCard(x, s.code, a.x + a.w - cw, a.y + 60, cw, a.h - 60, s.file || 'герой.py'); } else if (r.h < a.h) codeCard(x, s.code, a.x, a.y + r.h + 22, a.w, a.h - r.h - 22, s.file || 'герой.py'); // на квадрате код — под миром
  }
  function consoleShot(x, a, s) {
    const term = [];
    s.input.forEach(v => term.push([[s.prompt, C.ink], [v, C.mint]]));
    s.out.forEach(v => term.push([[v, C.gold]]));
    const draw = (bx, by, bw, bh) => {
      shadow(x, 50, 24);
      x.fillStyle = C.term; x.fill(rr(bx, by, bw, bh, 24));
      noShadow(x);
      x.strokeStyle = C.codeLine; x.lineWidth = 2; x.stroke(rr(bx, by, bw, bh, 24));
      x.fillStyle = 'rgba(232,234,255,0.6)'; x.font = F.mono(400, 20); x.textAlign = 'left';
      x.fillText('Консоль', bx + 30, by + 39);
      x.fillStyle = C.codeLine; x.fillRect(bx, by + 62, bw, 2);
      const longest = Math.max(...term.map(l => l.reduce((n, t) => n + t[0].length, 0)));
      const fs = Math.max(14, Math.min(30, (bw - 60) / (longest * 0.62), (bh - 96) / ((term.length + 1) * 1.6)));
      let y = by + 70 + fs * 1.5;
      term.forEach(l => {
        let px = bx + 30;
        l.forEach(([t, col]) => { x.font = F.mono(400, fs); x.fillStyle = col; x.fillText(t, px, y); px += x.measureText(t).width; });
        y += fs * 1.6;
      });
      x.fillStyle = C.mint; x.fillRect(bx + 30, y - fs * 0.85, fs * 0.55, fs * 1.05); // курсор
    };
    const ch = codeCard(x, s.lines, a.x, a.y, a.w * (a.sq ? 0.9 : 0.64), a.h * (a.sq ? 0.56 : 0.6), 'main.py');
    const tx = a.x + a.w * (a.sq ? 0.2 : 0.42), ty = a.y + ch + (a.sq ? 14 : -30); // на квадрате — под кодом, иначе чуть заходит на его край
    draw(tx, ty, a.x + a.w - tx, a.y + a.h - ty);
  }
  // Медаль достижения: круг цвета hue со значком (линии в квадрате 24 × 24)
  function medal(x, cx, cy, r, m) {
    const [c1, c2] = HUES[m.hue] || HUES.violet;
    const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, m.done ? c1 : '#3A3E6E'); g.addColorStop(1, m.done ? c2 : '#2A2D58');
    x.fillStyle = g; disc(x, cx, cy, r); x.fill();
    x.save();
    const k = (r * 1.1) / 24;
    x.translate(cx - 12 * k, cy - 12 * k); x.scale(k, k);
    x.strokeStyle = m.done ? '#FFFFFF' : 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round';
    const tmp = document.createElement('div');
    tmp.innerHTML = `<svg>${m.icon}</svg>`;
    tmp.querySelectorAll('path, circle, rect').forEach(el => {
      if (el.tagName === 'path') x.stroke(new Path2D(el.getAttribute('d')));
      else if (el.tagName === 'circle') { disc(x, +el.getAttribute('cx'), +el.getAttribute('cy'), +el.getAttribute('r')); x.stroke(); }
      else x.stroke(rr(+el.getAttribute('x'), +el.getAttribute('y'), +el.getAttribute('width'), +el.getAttribute('height'), +(el.getAttribute('rx') || 0)));
    });
    x.restore();
  }
  const heroIsland = a => (a.sq ? { w: a.w, h: a.h * 0.36 } : { w: a.w * 0.5, h: a.h });
  function hero(x, a, s) {
    const { w: iw, h: ih } = heroIsland(a);
    const glow = x.createRadialGradient(a.x + iw / 2, a.y + ih * 0.55, 20, a.x + iw / 2, a.y + ih * 0.55, Math.min(iw, ih) * 0.6);
    glow.addColorStop(0, 'rgba(140,123,255,0.45)'); glow.addColorStop(1, 'rgba(140,123,255,0)');
    x.fillStyle = glow; x.fillRect(a.x, a.y, iw, ih);
    if (s.img) placeImg(x, s.img, a.x, a.y, iw, ih, 'contain');
    // карточка прогресса
    const bx = a.sq ? a.x : a.x + iw + 30, by = a.sq ? a.y + ih + 10 : a.y + 20, bw = a.sq ? a.w : a.w - iw - 30, bh = a.sq ? a.h - ih - 10 : a.h - 40;
    shadow(x, 50, 24);
    x.fillStyle = C.card; x.fill(rr(bx, by, bw, bh, 28));
    noShadow(x);
    x.strokeStyle = C.line; x.lineWidth = 2; x.stroke(rr(bx, by, bw, bh, 28));
    const p = 36;
    x.textAlign = 'left';
    x.fillStyle = C.ink; x.font = F.display(700, 40);
    x.fillText(`Бит · уровень ${s.level}`, bx + p, by + p + 34);
    x.fillStyle = C.gold; x.font = F.ui(600, 28);
    x.fillText(s.rank, bx + p, by + p + 78);
    // полоска звёзд
    const barY = by + p + (a.sq ? 96 : 108), barW = bw - p * 2, gapY = a.sq ? 0.8 : 1;
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fill(rr(bx + p, barY, barW, 18, 9));
    const bar = x.createLinearGradient(bx + p, 0, bx + p + barW, 0);
    bar.addColorStop(0, C.gold); bar.addColorStop(1, C.coral);
    x.fillStyle = bar; x.fill(rr(bx + p, barY, Math.max(18, barW * s.stars / s.maxStars), 18, 9));
    // три цифры
    const stats = [[`★ ${s.stars}`, 'звёзд'], [`${s.gems}`, 'кристаллов'], [`${s.done}/${s.total}`, 'достижений']];
    const sw = barW / 3;
    stats.forEach(([v, l], i) => {
      x.fillStyle = i === 0 ? C.gold : i === 1 ? C.mint : C.ink; x.font = F.display(700, a.sq ? 34 : 38);
      x.fillText(v, bx + p + sw * i, barY + 84 * gapY);
      x.fillStyle = C.soft; x.font = F.ui(500, 24);
      x.fillText(l, bx + p + sw * i, barY + 120 * gapY);
    });
    // медали
    const top = barY + 160 * gapY, r = a.sq ? 30 : 38, gap = r * 2 + (a.sq ? 20 : 18);
    const per = Math.max(1, Math.floor((barW + gap - r * 2) / gap)), rows = Math.floor((by + bh - p + 10 - top) / gap);
    s.medals.slice(0, per * rows).forEach((m, i) => medal(x, bx + p + r + (i % per) * gap, top + r + Math.floor(i / per) * gap, r, m));
  }
  function trial(x, a, s) {
    const bx = a.x, by = a.y, bw = a.w, bh = a.h;
    shadow(x, 50, 24);
    x.fillStyle = '#FFFFFF'; x.fill(rr(bx, by, bw, bh, 30));
    noShadow(x);
    const p = 44, ink = '#1B1E3C', muted = '#5A6084';
    // кольцо: шесть дуг — решено или нет
    const rcx = bx + p + 110, rcy = by + p + 110, rad = 92;
    s.ring.forEach((st, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI * 2) / 6 + 0.06, a1 = a0 + (Math.PI * 2) / 6 - 0.12;
      x.strokeStyle = st === 'first' ? '#F5B82E' : st === 'ok' ? '#11917A' : '#E3E6F3';
      x.lineWidth = 26; x.lineCap = 'round';
      x.beginPath(); x.arc(rcx, rcy, rad, a0, a1); x.stroke();
    });
    x.textAlign = 'center'; x.fillStyle = ink; x.font = F.display(700, 64);
    x.fillText(`${s.score}`, rcx - 14, rcy + 22);
    x.fillStyle = muted; x.font = F.display(700, 28);
    x.fillText(`/${s.of}`, rcx + 32, rcy + 22);
    x.textAlign = 'left';
    x.fillStyle = muted; x.font = F.ui(600, 22);
    x.fillText('ИСПЫТАНИЕ СБОЯ · ГЛАВА 1', rcx + 150, by + p + 50);
    x.fillStyle = ink; x.font = F.display(700, a.sq ? 46 : 54);
    x.fillText(`${s.score} из ${s.of}`, rcx + 150, by + p + 112);
    x.fillStyle = '#11917A'; x.font = F.ui(600, 28);
    x.fillText(s.lead, rcx + 150, by + p + 158);
    // столбики попыток
    const top = by + p + 260, colsW = bw * 0.5 - p, barH = bh - (top - by) - p - 70;
    x.fillStyle = muted; x.font = F.ui(700, 20);
    x.fillText('КАК РАСТЁТ РЕЗУЛЬТАТ', bx + p, top - 20);
    const n = s.bars.length, cw = Math.min(150, colsW / n);
    s.bars.forEach((b, i) => {
      const cx = bx + p + cw * i + cw / 2, h = Math.max(10, (barH - 40) * (b.n / s.of)), last = i === n - 1;
      x.fillStyle = '#EEF0FA'; x.fill(rr(cx - cw * 0.3, top + 30, cw * 0.6, barH - 40, 12));
      if (last) { const g = x.createLinearGradient(0, top + 30 + barH - 40 - h, 0, top + barH - 10); g.addColorStop(0, '#F5B82E'); g.addColorStop(1, '#E4572E'); x.fillStyle = g; } else x.fillStyle = '#9C8CFF';
      x.fill(rr(cx - cw * 0.3, top + 30 + barH - 40 - h, cw * 0.6, h, 12));
      x.textAlign = 'center'; x.fillStyle = ink; x.font = F.display(700, 26);
      x.fillText(String(b.n), cx, top + 18);
      x.fillStyle = muted; x.font = F.ui(500, 20);
      x.fillText(b.d, cx, top + barH + 20);
    });
    x.textAlign = 'left';
    x.fillStyle = ink; x.font = F.ui(600, 26);
    x.fillText(s.delta, bx + p, by + bh - p + 4);
    // темы — справа: строки по высоте места
    const tx = bx + bw * 0.52, tw = bw * 0.48 - p, row = Math.min(62, (by + bh - p - 50 - top) / s.topics.length), rh = row - 8, f = Math.min(24, rh * 0.52);
    x.fillStyle = muted; x.font = F.ui(700, 20);
    x.fillText('ТЕМЫ ГЛАВЫ', tx, top - 20);
    s.topics.forEach(([name, st], i) => {
      const ty = top + 6 + i * row, cy = ty + rh / 2, cr = Math.min(14, rh * 0.3);
      x.fillStyle = '#F2F4FB'; x.fill(rr(tx, ty, tw, rh, 14));
      x.fillStyle = st === 'first' ? '#F5B82E' : st === 'ok' ? '#11917A' : '#D8DCEB'; disc(x, tx + 30, cy, cr); x.fill();
      if (st !== 'miss') { x.strokeStyle = '#fff'; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(tx + 30 - cr * 0.5, cy); x.lineTo(tx + 30 - cr * 0.15, cy + cr * 0.35); x.lineTo(tx + 30 + cr * 0.5, cy - cr * 0.35); x.stroke(); }
      x.fillStyle = ink; x.font = F.ui(600, f);
      x.fillText(name, tx + 56, cy + f * 0.36);
      if (!a.sq) {
        x.fillStyle = st === 'miss' ? '#D93D22' : st === 'first' ? '#B57A00' : '#11917A'; x.font = F.ui(500, 20); x.textAlign = 'right';
        x.fillText(st === 'first' ? 'с первого запуска' : st === 'ok' ? 'получилось' : 'повторить', tx + tw - 18, cy + 7);
        x.textAlign = 'left';
      }
    });
  }
  function cert(x, a, s) {
    const k = Math.min(a.w / s.img.width, a.h / s.img.height) * 0.96, w = s.img.width * k, h = s.img.height * k;
    x.save();
    x.translate(a.x + a.w / 2, a.y + a.h / 2);
    x.rotate(-0.025);
    shadow(x, 70, 30);
    x.fillStyle = '#FFFDF8'; x.fillRect(-w / 2, -h / 2, w, h);
    noShadow(x);
    x.drawImage(s.img, -w / 2, -h / 2, w, h);
    x.restore();
  }
  function cta(x, a, s) {
    const r = a.sq ? Math.min(a.h * 0.2, 130) : Math.min(a.h * 0.36, 230);
    if (a.sq) { // на квадрате всё вместе — по центру по высоте
      x.font = F.ui(500, 28);
      const lw0 = a.w - (r * 2 + 94), listH = s.lines.reduce((n, l) => n + wrap(x, l, lw0 - 56).length * 42 + 22, 30);
      a = Object.assign({}, a, { y: a.y + Math.max(0, (a.h - (Math.max(listH, r * 2 + 74) + 40 + 84)) / 2) });
    }
    const cx = a.x + r + (a.sq ? 34 : 20), cy = a.sq ? a.y + r + 34 : a.y + a.h * 0.45;
    x.save();
    x.setLineDash([0.1, 20]); x.lineCap = 'round'; x.lineWidth = 8; x.strokeStyle = C.gold;
    disc(x, cx, cy, r + 30); x.stroke();
    x.restore();
    const g = x.createRadialGradient(cx, cy - r * 0.4, 10, cx, cy, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D9D1FF');
    x.fillStyle = g; disc(x, cx, cy, r); x.fill();
    if (s.img) { x.save(); disc(x, cx, cy, r - 4); x.clip(); x.drawImage(s.img, cx - r, cy - r, r * 2, r * 2); x.restore(); }
    x.strokeStyle = C.accent; x.lineWidth = 10; disc(x, cx, cy, r); x.stroke();
    // список справа от портрета; на квадрате кнопка — внизу во всю ширину
    const lx = cx + r + (a.sq ? 60 : 70), lw = a.x + a.w - lx;
    let y = a.y + (a.sq ? 30 : 40);
    x.textAlign = 'left';
    s.lines.forEach(l => {
      x.font = F.ui(500, a.sq ? 28 : 32);
      const ls = wrap(x, l, lw - 56);
      x.fillStyle = C.mint; disc(x, lx + 14, y - 10, 9); x.fill();
      ls.forEach((t, i) => { x.fillStyle = C.ink; x.fillText(t, lx + 44, y + i * 42); });
      y += ls.length * 42 + 22;
    });
    // кнопка-призыв
    x.font = F.display(700, 30);
    const bx = a.sq ? a.x : lx, bw = a.sq ? a.w : Math.min(lw, x.measureText(s.cta).width + 80), bh = 84;
    const by = a.sq ? Math.min(Math.max(y, cy + r + 40) + 20, a.y + a.h - bh) : Math.min(y + 20, a.y + a.h - bh);
    const bg = x.createLinearGradient(bx, 0, bx + bw, 0);
    bg.addColorStop(0, C.gold); bg.addColorStop(1, '#FF9F45');
    shadow(x, 40, 16, 'rgba(255,170,60,0.35)');
    x.fillStyle = bg; x.fill(rr(bx, by, bw, bh, bh / 2));
    noShadow(x);
    x.fillStyle = '#2A1A00';
    fit(x, s.cta, bw - 60, z => F.display(700, z), 30, 18);
    x.textAlign = 'center';
    x.fillText(s.cta, bx + bw / 2, by + bh / 2 + 11);
    x.textAlign = 'left';
  }

  // Размер места под картинку (3D-мир, остров) — чтобы app.js снял её ровно под кадр
  function slot(spec, size = 'wide') {
    const { w: W, h: H } = SIZES[size] || SIZES.wide;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const a = frame(c.getContext('2d'), W, H, spec);
    if (spec.kind === 'world') { const r = worldRect(a, spec); return { w: Math.round(r.w), h: Math.round(r.h) }; }
    if (spec.kind === 'hero') { const r = heroIsland(a); return { w: Math.round(r.w), h: Math.round(r.h) }; }
    return { w: Math.round(a.w), h: Math.round(a.h) };
  }
  // Нарисовать кадр: spec — из SHOTS плюс то, что подготовил app.js (img, code — строки токенов, данные героя и испытания)
  function draw(canvas, spec, size = 'wide') {
    const { w: W, h: H } = SIZES[size] || SIZES.wide;
    canvas.width = W;
    canvas.height = H;
    const x = canvas.getContext('2d');
    const a = frame(x, W, H, spec);
    ({ world, hero, console: consoleShot, trial, cert, cta })[spec.kind](x, a, spec);
  }

  return { SIZES, SEED, SHOTS, FOOT, draw, slot };
})();
if (typeof module !== 'undefined') module.exports = HeroPoster;
