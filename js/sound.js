/* Звуки Долины: всё синтезируется в браузере (Web Audio), без звуковых файлов.
   Sound.play('coin', { n: 3 }) — сыграть звук; Sound.muted — выключить; Sound.unlock() — после первого нажатия
   (браузеры запускают звук только после действия пользователя). Список звуков — SFX ниже. */
const Sound = (() => {
  let ctx = null, out = null, noiseBuf = null, muted = false, alt = false;
  const last = {}; // когда звук играл в последний раз: одинаковые звуки не сливаются в треск

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); // выравнивает громкость, когда звуков много
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Тон: частота f (с переходом к f2), форма волны, длительность, громкость, задержка at
  function tone({ f, f2 = 0, type = 'sine', dur = 0.1, vol = 0.2, at = 0, attack = 0.005 }) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }
  // Шум через фильтр: шорох, шипение, удар
  function noise({ dur = 0.1, vol = 0.1, type = 'bandpass', f = 1000, f2 = 0, q = 1, at = 0, attack = 0.004 }) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }
  const notes = (fs, o) => fs.forEach((f, i) => tone({ f, ...o, at: (o.at || 0) + i * (o.step || 0.09), dur: i === fs.length - 1 ? (o.last || o.dur) : o.dur }));

  const SFX = {
    step() { alt = !alt; tone({ f: alt ? 190 : 165, f2: 90, type: 'triangle', dur: 0.08, vol: 0.2 }); noise({ dur: 0.03, vol: 0.04, type: 'highpass', f: 3000 }); },
    turn() { noise({ dur: 0.12, vol: 0.06, f: 900, f2: 2200, q: 2 }); },
    jump() { tone({ f: 260, f2: 820, dur: 0.22, vol: 0.18 }); tone({ f: 520, f2: 1640, type: 'triangle', dur: 0.18, vol: 0.04 }); },
    land() { tone({ f: 150, f2: 60, dur: 0.12, vol: 0.28 }); noise({ dur: 0.05, vol: 0.05, type: 'lowpass', f: 800 }); },
    coin({ n = 1 }) { // каждая следующая монета звучит чуть выше
      const b = 988 * Math.pow(2, Math.min(n - 1, 12) / 12);
      tone({ f: b, type: 'square', dur: 0.07, vol: 0.05 }); tone({ f: b, dur: 0.07, vol: 0.1 });
      tone({ f: b * 1.335, type: 'square', dur: 0.3, vol: 0.05, at: 0.07 }); tone({ f: b * 1.335, dur: 0.3, vol: 0.1, at: 0.07 });
    },
    bump() { tone({ f: 120, f2: 50, dur: 0.25, vol: 0.42 }); noise({ dur: 0.14, vol: 0.18, type: 'lowpass', f: 500 }); },
    burn() { noise({ dur: 0.7, vol: 0.2, f: 2500, f2: 500, q: 0.8, attack: 0.02 }); tone({ f: 200, f2: 70, type: 'sawtooth', dur: 0.5, vol: 0.04 }); },
    air() { tone({ f: 330, f2: 200, type: 'triangle', dur: 0.16, vol: 0.13 }); },
    nope() { tone({ f: 260, type: 'triangle', dur: 0.09, vol: 0.11 }); tone({ f: 200, type: 'triangle', dur: 0.14, vol: 0.11, at: 0.11 }); },
    gate() {
      noise({ dur: 0.35, vol: 0.08, f: 600, f2: 300, q: 6 }); tone({ f: 95, f2: 70, type: 'square', dur: 0.3, vol: 0.025 });
      tone({ f: 220, f2: 110, type: 'triangle', dur: 0.07, vol: 0.14, at: 0.35 });
    },
    talk() { for (let i = 0; i < 3; i++) tone({ f: 500 + Math.random() * 400, type: 'square', dur: 0.05, vol: 0.035, at: i * 0.07 }); },
    tick() { tone({ f: 1500, dur: 0.025, vol: 0.03 }); },
    win() { notes([523.25, 659.25, 783.99, 1046.5], { type: 'triangle', dur: 0.18, last: 0.5, vol: 0.14 }); tone({ f: 2093, dur: 0.4, vol: 0.04, at: 0.36 }); },
    fail() { tone({ f: 392, f2: 380, type: 'triangle', dur: 0.16, vol: 0.13 }); tone({ f: 311, f2: 290, type: 'triangle', dur: 0.32, vol: 0.13, at: 0.15 }); },
    stars({ n = 1 }) { notes([1046.5, 1318.5, 1568].slice(0, Math.max(1, n)), { dur: 0.35, vol: 0.1, step: 0.14 }); },
    levelup() { notes([523.25, 659.25, 783.99, 1046.5, 1318.5], { type: 'triangle', dur: 0.2, last: 0.6, vol: 0.12, step: 0.07, at: 0.3 }); },
    key() { // Ключ-код появляется: искры
      for (let i = 0; i < 7; i++) tone({ f: 1800 + Math.random() * 1800, dur: 0.25, vol: 0.035, at: i * 0.08 });
      tone({ f: 880, f2: 1760, dur: 0.8, vol: 0.035, attack: 0.1 });
    },
    glitch() { // Великий Сбой: рваный шум и низкий гул
      for (let i = 0; i < 8; i++) noise({ dur: 0.04 + Math.random() * 0.05, vol: 0.11, f: 300 + Math.random() * 3000, q: 2, at: i * 0.07 });
      tone({ f: 55, f2: 48, type: 'sawtooth', dur: 1.2, vol: 0.06, attack: 0.1 });
    },
    steal() { noise({ dur: 0.9, vol: 0.11, f: 3000, f2: 300, q: 1.5 }); tone({ f: 600, f2: 90, type: 'sawtooth', dur: 0.8, vol: 0.035 }); },
    fixed() { // Сбой починен: тихий мажорный аккорд
      [261.63, 329.63, 392, 523.25].forEach((f, i) => tone({ f, dur: 1.6, vol: 0.06, attack: 0.08, at: i * 0.05 }));
      tone({ f: 2093, dur: 0.6, vol: 0.03, at: 0.4 });
    },
    right() { tone({ f: 784, type: 'triangle', dur: 0.1, vol: 0.13 }); tone({ f: 1175, type: 'triangle', dur: 0.28, vol: 0.13, at: 0.1 }); },
    wrong() { tone({ f: 330, f2: 300, type: 'triangle', dur: 0.26, vol: 0.11 }); },
    type() { noise({ dur: 0.018, vol: 0.045, type: 'highpass', f: 2500 }); tone({ f: 1800 + Math.random() * 300, type: 'square', dur: 0.012, vol: 0.008 }); },
  };
  // Минимальный промежуток между одинаковыми звуками, с
  const GAP = { tick: 0.08, step: 0.05, type: 0.02, turn: 0.05 };

  function play(name, opt = {}) {
    if (muted || !ctx || ctx.state !== 'running' || !SFX[name]) return;
    const now = ctx.currentTime;
    if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.04)) return;
    last[name] = now;
    try { SFX[name](opt); } catch (e) { /* без звука */ }
  }

  return {
    play, unlock, names: Object.keys(SFX),
    get muted() { return muted; },
    set muted(v) { muted = !!v; },
  };
})();
if (typeof module !== 'undefined') module.exports = Sound;
