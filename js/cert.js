/* Грамота (HeroCert): за пролог, за Испытание Сбоя на 6 из 6 и за всю главу 1.
   Рисуется на canvas 2970 × 2100 — это лист A4 альбомом, 10 точек на миллиметр. Один и тот же рисунок идёт
   в печать (окно печати, там же «Сохранить как PDF») и в картинку PNG для чата с родителями.
   content(kind, info) — тексты и цифры (их проверяет tests/check-story.js: без мужского рода в обращении),
   draw(canvas, c, portrait) — рисунок. Шрифты игры canvas берёт у страницы, поэтому перед рисованием — fonts(). */
const HeroCert = (() => {
  const W = 2970, H = 2100;
  const C = {
    paper: '#FFFAF4', ink: '#3A2A4D', muted: '#6E5E80', accent: '#6B4BD8', deep: '#4B32A6', soft: '#EFE6FF',
    gold: '#C9850A', star: '#F5B82E', mint: '#1E9E7E', mintSoft: '#DDF5EC', pink: '#D6409F', coral: '#E0702F', line: '#F0D9CC',
  };
  const KINDS = ['prolog', 'trial', 'course'];
  // name — вкладка в окне грамоты, when — за что выдаётся, seal — текст по кругу печати, icon — значок в её центре
  const META = {
    prolog: { name: 'Пролог', when: 'за пролог — первое занятие', seal: 'ДОЛИНА ЭНИКЕЙ • ПРОЛОГ • ', icon: 'flag' },
    trial: { name: 'Испытание Сбоя', when: 'за Испытание Сбоя на 6 из 6', seal: 'ИСПЫТАНИЕ СБОЯ • 6 ИЗ 6 • ', icon: 'sword' },
    course: { name: 'Глава 1', when: 'за всю главу 1: пролог и семь уроков', seal: 'ДОЛИНА ЭНИКЕЙ • ГЛАВА 1 • ', icon: 'key' },
  };
  // значки — линии в квадрате 24 × 24, как у достижений
  const ICONS = {
    flag: ['M6 21V4', 'M6 4h11l-2.5 4L17 12H6'],
    sword: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'M13 19l6-6M16 16l4 4M19 21l2-2'],
    key: ['M3.5 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M11.5 12H21M17.5 12v3.4M20.5 12v2.4'],
  };
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
  const num = n => Number(n).toLocaleString('ru-RU');
  const ruDate = (ms, year = true) => new Date(ms).toLocaleDateString('ru-RU', year ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' }).replace(/\s*г\.?$/, '');

  /* Тексты грамоты. info: name, tutor, date, level, rank, site и по виду грамоты:
     prolog — tasks, lines, stars, maxStars, cmds; trial — of, first, mins, topics, was ({ n, date } — первое испытание);
     course — lessons, topics, stars, maxStars, solved, lines, days */
  function content(kind, info) {
    const m = META[kind], i = info;
    const c = {
      kind, kicker: 'Долина Эникей · Python для начинающих', title: 'Грамота', lead: 'награждается',
      name: i.name || '', tutor: i.tutor || '', date: ruDate(i.date || Date.now()), seal: m.seal, icon: m.icon,
      hero: 'Бит', level: i.level || 1, rank: i.rank || '', site: i.site || '', mono: false, check: false,
    };
    const level = [c.level, 'уровень Бита'];
    if (kind === 'prolog') {
      c.reason = 'за первые программы на настоящем Python: пролог курса пройден';
      c.chips = i.cmds || [];
      c.mono = true;
      c.stats = [
        [i.tasks, plural(i.tasks, 'программа на Python', 'программы на Python', 'программ на Python')],
        [num(i.lines), `${plural(i.lines, 'строка', 'строки', 'строк')} кода`],
        [i.stars, `${plural(i.stars, 'звезда', 'звезды', 'звёзд')} из ${i.maxStars}`, 'star'],
        level,
      ];
    } else if (kind === 'trial') {
      c.reason = `за Испытание Сбоя: все темы главы 1 на новых картах и без подсказок — ${i.of} из ${i.of}`;
      c.chips = i.topics || [];
      c.check = true;
      c.stats = [
        [`${i.of}/${i.of}`, 'испытаний пройдено'],
        [i.first, `${plural(i.first, 'испытание', 'испытания', 'испытаний')} с первого запуска`],
        i.mins ? [i.mins, `${plural(i.mins, 'минута', 'минуты', 'минут')} на всё испытание`] : null,
        i.was ? [`${i.was.n}→${i.of}`, `рост с ${ruDate(i.was.date, false)}`] : level,
      ].filter(Boolean);
    } else {
      c.reason = `за прохождение главы 1: ${i.lessons} ${plural(i.lessons, 'урок', 'урока', 'уроков')} Python — от первых команд до своих функций`;
      c.chips = i.topics || [];
      c.stats = [
        [num(i.stars), `${plural(i.stars, 'звезда', 'звезды', 'звёзд')} из ${i.maxStars}`, 'star'],
        [i.solved, plural(i.solved, 'задание решено', 'задания решено', 'заданий решено')],
        [num(i.lines), `${plural(i.lines, 'строка', 'строки', 'строк')} кода`],
        [i.days, `${plural(i.days, 'день', 'дня', 'дней')} занятий`],
      ];
    }
    return c;
  }

  // Шрифты игры: ждём, пока загрузятся (с кириллицей), но не дольше wait мс (0 — сколько нужно); true — всё загружено
  function fonts(wait = 3000) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve(true);
    const sample = 'ГРАМОТА Награждается Ёё 0123456789 вперёд()';
    const list = ['700 100px Unbounded', '400 50px Rubik', '500 50px Rubik', '600 50px Rubik', '600 40px "JetBrains Mono"'];
    const all = Promise.all(list.map(f => document.fonts.load(f, sample).catch(() => null)));
    return Promise.race(wait ? [all, new Promise(r => setTimeout(r, wait))] : [all])
      .then(() => list.every(f => { try { return document.fonts.check(f, sample); } catch (e) { return true; } }));
  }

  /* ---- Рисунок ---- */
  const F = {
    display: (w, s) => `${w} ${s}px Unbounded, Rubik, "Segoe UI", Arial, sans-serif`,
    ui: (w, s) => `${w} ${s}px Rubik, "Segoe UI", Arial, sans-serif`,
    mono: (w, s) => `${w} ${s}px "JetBrains Mono", Consolas, monospace`,
  };
  function rr(x, y, w, h, r) {
    const p = new Path2D();
    p.moveTo(x + r, y);
    p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r);
    p.closePath();
    return p;
  }
  const disc = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); };
  // Подобрать размер шрифта, чтобы текст влез в ширину
  function fit(x, text, maxW, font, size, min) {
    let s = size;
    x.font = font(s);
    while (s > min && x.measureText(text).width > maxW) { s -= 2; x.font = font(s); }
    return s;
  }
  // Строки одинаковой длины: сколько строк вышло бы при переносе по ширине, столько же, но как можно уже
  function balance(x, text, maxW) {
    const n = wrap(x, text, maxW).length;
    let lo = maxW / Math.max(1, n) * 0.6, hi = maxW;
    for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (wrap(x, text, mid).length > n) lo = mid; else hi = mid; }
    return wrap(x, text, hi);
  }
  function wrap(x, text, maxW) {
    const lines = [];
    let cur = '';
    String(text).split(' ').forEach(w => {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && x.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // Текст с разрядкой, по центру
  function spaced(x, text, cx, y, sp) {
    const ch = [...text], ws = ch.map(c => x.measureText(c).width);
    let px = cx - (ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1)) / 2;
    x.textAlign = 'left';
    ch.forEach((c, i) => { x.fillText(c, px, y); px += ws[i] + sp; });
    x.textAlign = 'center';
  }
  // Текст по кругу печати: начинается сверху, идёт по часовой стрелке и занимает весь круг
  function ringText(x, text, r, sp) {
    const ch = [...text], ws = ch.map(c => x.measureText(c).width + sp);
    const k = (2 * Math.PI * r) / ws.reduce((a, b) => a + b, 0);
    let a = -Math.PI / 2;
    ch.forEach((c, i) => {
      const step = (ws[i] * k) / r;
      x.save();
      x.rotate(a + step / 2 + Math.PI / 2);
      x.fillText(c, 0, -r);
      x.restore();
      a += step;
    });
  }
  function blob(x, cx, cy, r, col) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,253,248,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  function star(x, cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    x.closePath();
    x.fill();
  }
  function check(x, cx, cy, s, col) {
    x.save();
    x.strokeStyle = col; x.lineWidth = s * 0.22; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(cx - s * 0.45, cy); x.lineTo(cx - s * 0.12, cy + s * 0.32); x.lineTo(cx + s * 0.48, cy - s * 0.34); x.stroke();
    x.restore();
  }
  // Пиксели в углах рамки — Долина собрана из клеток
  function corner(x, cx, cy, sx, sy) {
    [[0, 0, C.star], [1, 0, C.accent], [0, 1, C.mint], [2, 0, '#C9C0FF'], [0, 2, '#F3A6CF'], [1, 1, '#FCE3A1']].forEach(([i, j, col]) => {
      x.fillStyle = col;
      x.fill(rr(cx + sx * (30 + i * 36) - (sx < 0 ? 26 : 0), cy + sy * (30 + j * 36) - (sy < 0 ? 26 : 0), 26, 26, 6));
    });
  }
  function flourish(x, cx, y, w) {
    x.strokeStyle = C.gold; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - w, y); x.lineTo(cx - 46, y); x.moveTo(cx + 46, y); x.lineTo(cx + w, y); x.stroke();
    x.fillStyle = C.star;
    x.save(); x.translate(cx, y); x.rotate(Math.PI / 4); x.fillRect(-15, -15, 30, 30); x.restore();
    [-w, w].forEach(dx => { disc(x, cx + dx, y, 7); x.fill(); });
  }
  function chips(x, c, cx, y, maxW) {
    const pad = 36, gap = 20, hh = 86, ic = c.check ? 46 : 0;
    const font = s => (c.mono ? F.mono(600, s) : F.ui(600, s));
    let size = 42, rows = [];
    for (;;) {
      x.font = font(size);
      rows = [[]];
      let w = 0;
      c.chips.forEach(t => {
        const it = { t, w: x.measureText(t).width + pad * 2 + ic };
        if (rows[rows.length - 1].length && w + gap + it.w > maxW) { rows.push([]); w = 0; }
        w += (rows[rows.length - 1].length ? gap : 0) + it.w;
        rows[rows.length - 1].push(it);
      });
      if (rows.length <= 2 || size <= 30) break;
      size -= 2;
    }
    x.textBaseline = 'middle';
    rows.forEach(row => {
      let px = cx - (row.reduce((a, it) => a + it.w, 0) + gap * (row.length - 1)) / 2;
      row.forEach(it => {
        x.fillStyle = c.check ? C.mintSoft : C.soft;
        x.fill(rr(px, y, it.w, hh, hh / 2));
        if (c.check) check(x, px + pad + 14, y + hh / 2, 30, C.mint);
        x.fillStyle = c.check ? '#0B6B5A' : C.deep;
        x.fillText(it.t, px + ic + it.w / 2 - ic / 2, y + hh / 2 + 2);
        px += it.w + gap;
      });
      y += hh + 22;
    });
    x.textBaseline = 'alphabetic';
    return y;
  }
  function stats(x, list, cx, top, maxW) {
    const cw = maxW / list.length;
    list.forEach(([v, label, icon], i) => {
      const sx = cx - maxW / 2 + cw * (i + 0.5), val = String(v);
      x.fillStyle = C.deep;
      const s = fit(x, val, cw - (icon ? 120 : 50), z => F.display(700, z), 90, 46);
      const vw = x.measureText(val).width;
      if (icon === 'star') { x.fillStyle = C.star; star(x, sx - vw / 2 - 22, top + 80 - s * 0.36, s * 0.4); x.fillStyle = C.deep; }
      x.fillText(val, sx + (icon ? 22 : 0), top + 80);
      x.fillStyle = C.muted; x.font = F.ui(500, 38);
      balance(x, label, cw - 60).slice(0, 2).forEach((l, k) => x.fillText(l, sx, top + 146 + k * 48));
      if (i) {
        x.strokeStyle = C.line; x.lineWidth = 3;
        x.beginPath(); x.moveTo(cx - maxW / 2 + cw * i, top + 6); x.lineTo(cx - maxW / 2 + cw * i, top + 196); x.stroke();
      }
    });
  }
  // Строка для подписи или даты: значение над линией, под ней — что это
  function sigLine(x, cx, y, w, value, label) {
    x.strokeStyle = C.muted; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - w / 2, y); x.lineTo(cx + w / 2, y); x.stroke();
    if (value) { x.fillStyle = C.ink; fit(x, value, w - 20, s => F.ui(500, s), 52, 34); x.fillText(value, cx, y - 22); }
    x.fillStyle = C.muted; x.font = F.ui(400, 34);
    x.fillText(label, cx, y + 52);
  }
  function seal(x, c, cx, cy, r) {
    x.save();
    x.translate(cx, cy);
    x.rotate(-0.16);
    x.fillStyle = 'rgba(91,69,224,0.07)';
    disc(x, 0, 0, r); x.fill();
    x.strokeStyle = C.accent;
    x.lineWidth = 9; disc(x, 0, 0, r - 6); x.stroke();
    x.lineWidth = 3; disc(x, 0, 0, r - 30); x.stroke(); disc(x, 0, 0, r - 98); x.stroke();
    x.fillStyle = C.accent; x.font = F.ui(600, 31); x.textBaseline = 'middle';
    ringText(x, c.seal, r - 64, 3);
    const s = ((r - 98) * 1.25) / 24;
    x.translate(-12 * s, -12 * s);
    x.scale(s, s);
    x.lineWidth = 1.9; x.lineCap = 'round'; x.lineJoin = 'round';
    (ICONS[c.icon] || []).forEach(d => x.stroke(new Path2D(d)));
    x.restore();
  }

  function draw(canvas, c, portrait) {
    canvas.width = W;
    canvas.height = H;
    const x = canvas.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    // бумага и мягкие пятна цвета по углам
    x.fillStyle = C.paper; x.fillRect(0, 0, W, H);
    blob(x, 0, 0, 1150, 'rgba(91,69,224,0.10)');
    blob(x, W, H, 1250, 'rgba(17,145,122,0.09)');
    blob(x, W, 0, 850, 'rgba(245,184,46,0.13)');
    blob(x, 0, H, 750, 'rgba(214,64,159,0.07)');
    // рамка: полоса цветов игры сверху, фиолетовая и золотая линии, пиксели в углах
    const frame = rr(60, 60, W - 120, H - 120, 46);
    const band = x.createLinearGradient(60, 0, W - 60, 0);
    band.addColorStop(0, C.coral); band.addColorStop(0.5, '#FF6BB3'); band.addColorStop(1, C.accent);
    x.save(); x.clip(frame); x.fillStyle = band; x.fillRect(60, 60, W - 120, 22); x.restore();
    x.lineWidth = 10; x.strokeStyle = C.accent; x.stroke(frame);
    x.lineWidth = 3; x.strokeStyle = C.gold; x.stroke(rr(96, 104, W - 192, H - 200, 30));
    corner(x, 96, 104, 1, 1); corner(x, W - 96, 104, -1, 1); corner(x, 96, H - 96, 1, -1); corner(x, W - 96, H - 96, -1, -1);

    // слева — медальон с Битом
    const mx = 620, my = 870, mr = 380;
    x.save();
    x.setLineDash([0.1, 28]); x.lineCap = 'round'; x.lineWidth = 10; x.strokeStyle = C.star;
    disc(x, mx, my, mr + 46); x.stroke();
    x.restore();
    const rg = x.createRadialGradient(mx, my - 140, 40, mx, my, mr);
    rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(1, '#E2DBFF');
    x.fillStyle = rg; disc(x, mx, my, mr); x.fill();
    if (portrait) {
      x.save(); disc(x, mx, my, mr - 6); x.clip();
      x.drawImage(portrait, mx - mr, my - mr, mr * 2, mr * 2);
      x.restore();
    }
    x.lineWidth = 16; x.strokeStyle = C.accent; disc(x, mx, my, mr); x.stroke();
    const bx = mx + mr * 0.7, by = my + mr * 0.7;
    x.fillStyle = C.accent; disc(x, bx, by, 90); x.fill();
    x.lineWidth = 12; x.strokeStyle = '#FFFFFF'; x.stroke();
    x.fillStyle = '#FFFFFF'; x.textBaseline = 'middle';
    fit(x, String(c.level), 130, s => F.display(700, s), 76, 40);
    x.fillText(String(c.level), bx, by + 4);
    x.textBaseline = 'alphabetic';
    x.fillStyle = C.ink; x.font = F.display(700, 68);
    x.fillText(c.hero, mx, my + mr + 150);
    x.fillStyle = C.muted; fit(x, c.rank, 760, s => F.ui(500, s), 46, 30);
    x.fillText(c.rank, mx, my + mr + 214);

    // справа — что за грамота, кому и за что
    const cx = 1990, maxW = 1640;
    x.fillStyle = C.muted; x.font = F.ui(600, 38);
    spaced(x, c.kicker.toUpperCase(), cx, 330, 7);
    const title = c.title.toUpperCase();
    fit(x, title, maxW, s => F.display(700, s), 200, 120);
    const tw = x.measureText(title).width, tg = x.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
    tg.addColorStop(0, C.accent); tg.addColorStop(1, C.pink);
    x.fillStyle = tg;
    x.fillText(title, cx, 540);
    flourish(x, cx, 612, 380);
    x.fillStyle = C.muted; x.font = F.ui(400, 54);
    x.fillText(c.lead, cx, 714);
    if (c.name) {
      x.fillStyle = C.ink;
      fit(x, c.name, maxW, s => F.display(700, s), 134, 64);
      x.fillText(c.name, cx, 872);
    } else { // имени нет — строка, чтобы вписать от руки
      x.save(); x.setLineDash([4, 16]); x.lineCap = 'round'; x.strokeStyle = C.muted; x.lineWidth = 4;
      x.beginPath(); x.moveTo(cx - 560, 872); x.lineTo(cx + 560, 872); x.stroke(); x.restore();
    }
    x.fillStyle = C.ink; x.font = F.ui(400, 54);
    let y = 994;
    balance(x, c.reason, 1540).slice(0, 3).forEach(l => { x.fillText(l, cx, y); y += 72; });
    if (c.chips.length) y = chips(x, c, cx, y + 4, maxW);
    stats(x, c.stats, cx, Math.min(1500, Math.max(1440, y + 40)), maxW);

    // внизу — дата, подпись репетитора, печать
    sigLine(x, mx, 1860, 540, c.date, 'дата');
    sigLine(x, 1610, 1860, 820, c.tutor, 'репетитор');
    seal(x, c, 2600, 1800, 160);
    if (c.site) { x.fillStyle = C.muted; x.font = F.ui(400, 30); x.fillText(c.site, W / 2, H - 128); }
  }

  return { W, H, KINDS, META, content, fonts, draw };
})();
if (typeof module !== 'undefined') module.exports = HeroCert;
