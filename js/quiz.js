// Движок тестов. Вопросы берутся из QUIZ (questions.js в папке теста).
// До нажатия «Сдать» страница ничего не говорит о правильности — только сколько вопросов отвечено.
// Сдать можно, когда отвечены все вопросы. Ответы и порядок вариантов хранятся в localStorage.
(function () {
  'use strict';
  const LETTERS = 'АБВГДЕЖЗ';
  const TAGS = { one: 'Один ответ', many: 'Несколько ответов', match: 'Сопоставь' };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = (s) => String(s).replace(/`/g, '');
  // `код` в тексте → <code>; короткий код не переносится посередине
  const fmt = (s) => esc(s).split('`').map((part, i) => (i % 2 ? '<code' + (part.length <= 16 ? ' class="nw"' : '') + '>' + part + '</code>' : part)).join('');
  const plural = (n, forms) => {
    const a = n % 100, b = n % 10;
    return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
  };
  const smooth = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  // Подсветка Python в блоках кода — те же цвета, что в редакторе тренажёра
  const KW = new Set(['for', 'in', 'if', 'elif', 'else', 'while', 'def', 'return', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'import', 'from', 'lambda']);
  const FN = new Set(['print', 'len', 'range', 'list', 'dict', 'set', 'tuple', 'sorted', 'str', 'int']);
  function hl(code) {
    const re = /(#.*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+\b)|([A-Za-z_]\w*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      const t = m[0];
      const cls = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'num' : KW.has(t) ? 'kw' : FN.has(t) || code[m.index - 1] === '.' ? 'fn' : '';
      out += esc(code.slice(last, m.index)) + (cls ? '<span class="t-' + cls + '">' + esc(t) + '</span>' : esc(t));
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  const toIdx = (s) => [...String(s)].filter((ch) => LETTERS.includes(ch)).map((ch) => LETTERS.indexOf(ch));
  const QS = QUIZ.questions.map((q, i) => Object.assign({}, q, { n: i + 1, key: toIdx(q.answer) }));
  const N = QS.length;

  // Состояние: порядок вариантов (перемешан), ответы (номера вариантов в исходном порядке), сдан ли тест
  const KEY = 'dolina-test-' + QUIZ.id + '-v1';
  const SIG = QS.map((q) => q.type + (q.options || q.right).length + (q.left ? 'x' + q.left.length : '')).join(',');
  function perm(n) {
    const a = [...Array(n).keys()];
    if (QUIZ.shuffle !== false) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
    }
    return a;
  }
  function fresh() {
    return {
      sig: SIG,
      order: QS.map((q) => perm((q.options || q.right).length)),
      answers: QS.map((q) => (q.type === 'one' ? null : q.type === 'many' ? [] : q.left.map(() => null))),
      submitted: false,
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.sig === SIG && Array.isArray(s.order) && Array.isArray(s.answers)) return s;
    } catch (e) { /* нет хранилища — начинаем с нуля */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* не страшно */ }
  }
  let state = load();
  let warned = false; // пытались сдать, не ответив на всё

  function answered(i) {
    const a = state.answers[i];
    return QS[i].type === 'one' ? a !== null : QS[i].type === 'many' ? a.length > 0 : a.every((x) => x !== null);
  }
  function grade(i) {
    const q = QS[i], a = state.answers[i];
    if (q.type === 'one') return { ok: a === q.key[0] };
    if (q.type === 'many') return { ok: a.length === q.key.length && q.key.every((k) => a.includes(k)) };
    const hits = q.key.filter((k, r) => a[r] === k).length;
    return { ok: hits === q.key.length, hits, total: q.key.length };
  }

  // ---------- Разметка вопросов ----------
  function optionsHtml(q, i) {
    const a = state.answers[i], done = state.submitted;
    const type = q.type === 'one' ? 'radio' : 'checkbox';
    const items = state.order[i].map((o, k) => {
      const picked = q.type === 'one' ? a === o : a.includes(o);
      let cls = picked ? ' is-picked' : '', mark = '';
      if (done) {
        const right = q.key.includes(o);
        if (picked && right) { cls += ' is-right'; mark = '✓ Верно'; }
        else if (picked) { cls += ' is-wrong'; mark = '✗ Неверно'; }
        else if (right) { cls += ' is-missed'; mark = q.type === 'one' ? '✓ Правильный ответ' : '✓ Нужно было выбрать'; }
        else cls += ' is-dim';
      }
      return '<label class="opt opt-' + type + cls + '">' +
        '<input type="' + type + '" name="q' + i + '" value="' + o + '" data-i="' + i + '"' + (picked ? ' checked' : '') + (done ? ' disabled' : '') + '>' +
        '<span class="opt-box" aria-hidden="true">' + LETTERS[k] + '</span>' +
        '<span class="opt-txt">' + fmt(q.options[o]) + '</span>' +
        (mark ? '<span class="opt-mark">' + mark + '</span>' : '') + '</label>';
    });
    return '<div class="q-opts"' + (q.type === 'one' ? ' role="radiogroup"' : ' role="group"') + ' aria-labelledby="q-' + q.n + '-t">' + items.join('') + '</div>';
  }

  function matchHtml(q, i) {
    const a = state.answers[i], done = state.submitted, order = state.order[i];
    const letterOf = [];
    order.forEach((o, k) => { letterOf[o] = LETTERS[k]; });
    const legend = order.map((o, k) =>
      '<li><span class="m-let" aria-hidden="true">' + LETTERS[k] + '</span><span>' + fmt(q.right[o]) + '</span></li>').join('');
    const rows = q.left.map((item, r) => {
      const want = q.key[r];
      const chips = order.map((o, k) => {
        const picked = a[r] === o;
        let cls = picked ? ' is-picked' : '';
        if (done) cls += o === want ? (picked ? ' is-right' : ' is-missed') : picked ? ' is-wrong' : '';
        return '<label class="m-chip' + cls + '">' +
          '<input type="radio" name="q' + i + 'r' + r + '" value="' + o + '" data-i="' + i + '" data-r="' + r + '" aria-label="' + esc(LETTERS[k] + ' — ' + plain(q.right[o])) + '"' + (picked ? ' checked' : '') + (done ? ' disabled' : '') + '>' +
          '<span aria-hidden="true">' + LETTERS[k] + '</span></label>';
      }).join('');
      let cls = '', fix = '';
      if (done) {
        cls = a[r] === want ? ' is-right' : ' is-wrong';
        if (a[r] !== want) fix = '<p class="m-fix">Правильно: <b>' + letterOf[want] + '</b> — ' + fmt(q.right[want]) + '</p>';
      }
      return '<div class="m-row' + cls + '" role="radiogroup" aria-label="' + esc(plain(item)) + '">' +
        '<div class="m-item">' + fmt(item) + '</div><div class="m-chips">' + chips + '</div>' + fix + '</div>';
    }).join('');
    return '<ol class="m-legend" aria-label="Варианты">' + legend + '</ol><div class="m-rows">' + rows + '</div>';
  }

  function cardHtml(q, i) {
    let cls = '', status = '';
    if (state.submitted) {
      const g = grade(i);
      if (g.ok) { cls = ' is-ok'; status = '<span class="q-status ok">✓ Верно</span>'; }
      else if (g.hits) { cls = ' is-bad'; status = '<span class="q-status part">Верно ' + g.hits + ' из ' + g.total + '</span>'; }
      else { cls = ' is-bad'; status = '<span class="q-status bad">✗ Неверно</span>'; }
    } else if (warned && !answered(i)) cls = ' is-missing';
    return '<section class="q-card' + cls + '" id="q-' + q.n + '" tabindex="-1" aria-labelledby="q-' + q.n + '-t">' +
      '<div class="q-head"><span class="q-num">' + q.n + '</span><span class="q-tag">' + TAGS[q.type] + '</span>' +
      status + '<span class="q-missing">Нет ответа</span></div>' +
      '<h2 class="q-title" id="q-' + q.n + '-t">' + fmt(q.title) + '</h2>' +
      (q.lead ? '<p class="q-text">' + fmt(q.lead) + '</p>' : '') +
      (q.code ? '<pre class="q-code"><code>' + hl(q.code) + '</code></pre>' : '') +
      (q.ask ? '<p class="q-text">' + fmt(q.ask) + '</p>' : '') +
      (q.type === 'match' ? matchHtml(q, i) : optionsHtml(q, i)) +
      (state.submitted ? '<div class="q-explain"><b>Почему так</b><p>' + fmt(q.explain) + '</p></div>' : '') +
      '</section>';
  }

  function render() {
    $('quiz').innerHTML = QS.map(cardHtml).join('');
    document.body.classList.toggle('is-done', state.submitted);
    renderBar();
    renderResult();
  }

  // ---------- Нижняя панель ----------
  function renderBar() {
    const btn = $('submitBtn');
    if (state.submitted) {
      const score = QS.filter((q, i) => grade(i).ok).length;
      $('barTxt').textContent = 'Верно ' + score + ' из ' + N;
      $('barFill').style.width = (score / N) * 100 + '%';
      btn.textContent = 'Ещё раз';
      btn.classList.add('ghost');
      $('barMsg').hidden = true;
      return;
    }
    const done = QS.filter((q, i) => answered(i)).length;
    $('barTxt').textContent = 'Отвечено ' + done + ' из ' + N;
    $('barFill').style.width = (done / N) * 100 + '%';
    btn.textContent = 'Сдать';
    btn.classList.remove('ghost');
    const missing = QS.filter((q, i) => !answered(i));
    if (warned && missing.length) {
      const shown = missing.slice(0, 8);
      $('barMsg').innerHTML = 'Сначала ответь на все вопросы. Без ответа: ' +
        shown.map((q) => '<a href="#q-' + q.n + '" class="q-jump">' + q.n + '</a>').join(' ') +
        (missing.length > shown.length ? ' <span>и ещё ' + (missing.length - shown.length) + '</span>' : '');
      $('barMsg').hidden = false;
    } else $('barMsg').hidden = true;
  }

  // ---------- Итог ----------
  function renderResult() {
    const box = $('result');
    if (!state.submitted) { box.hidden = true; box.innerHTML = ''; return; }
    const score = QS.filter((q, i) => grade(i).ok).length;
    const g = QUIZ.grades.find((x) => score >= x.min) || QUIZ.grades[QUIZ.grades.length - 1];
    const wrong = QS.filter((q, i) => !grade(i).ok);
    const tone = g === QUIZ.grades[0] ? 'good' : g.min > 0 ? 'mid' : 'low';
    box.className = 'q-result tone-' + tone;
    box.innerHTML =
      '<div class="r-ring" style="--p:' + Math.round((score / N) * 100) + '"><span class="r-big">' + score + '</span><span class="r-of">из ' + N + '</span></div>' +
      '<div class="r-body">' +
      '<p class="r-kicker">' + score + ' ' + plural(score, ['верный ответ', 'верных ответа', 'верных ответов']) + '</p>' +
      '<h2 id="resTitle" tabindex="-1">' + esc(g.title) + '</h2>' +
      '<p>' + fmt(g.text) + '</p>' +
      (wrong.length
        ? '<p class="r-errs"><span>Посмотри ошибки:</span> ' + wrong.map((q) => '<a href="#q-' + q.n + '" class="q-jump bad">' + q.n + '</a>').join(' ') + '</p>'
        : '<p class="r-errs"><span>Ни одной ошибки!</span></p>') +
      (QUIZ.after ? '<p class="r-note">' + fmt(QUIZ.after) + '</p>' : '') +
      '<button type="button" class="q-btn" id="againBtn">Пройти ещё раз</button>' +
      '<p class="r-small">Варианты ответов перемешаются заново.</p>' +
      '</div>';
    box.hidden = false;
  }

  // ---------- Действия ----------
  function jumpTo(n) {
    const card = $('q-' + n);
    if (!card) return;
    card.scrollIntoView({ behavior: smooth(), block: 'start' });
    card.focus({ preventScroll: true });
  }

  function submit() {
    const missing = QS.filter((q, i) => !answered(i));
    if (missing.length) {
      warned = true;
      QS.forEach((q, i) => $('q-' + q.n).classList.toggle('is-missing', !answered(i)));
      renderBar();
      jumpTo(missing[0].n);
      return;
    }
    state.submitted = true;
    save();
    render();
    $('result').scrollIntoView({ behavior: smooth(), block: 'start' });
    $('resTitle').focus({ preventScroll: true });
  }

  function again() {
    state = fresh();
    warned = false;
    save();
    render();
    window.scrollTo({ top: 0, behavior: smooth() });
  }

  $('quiz').addEventListener('change', (e) => {
    const t = e.target;
    if (!t.matches('input[data-i]') || state.submitted) return;
    const i = +t.dataset.i, v = +t.value, q = QS[i];
    if (q.type === 'one') state.answers[i] = v;
    else if (q.type === 'many') {
      const a = state.answers[i].filter((x) => x !== v);
      if (t.checked) a.push(v);
      state.answers[i] = a;
    } else state.answers[i][+t.dataset.r] = v;
    save();
    const card = t.closest('.q-card');
    card.querySelectorAll('input').forEach((inp) => inp.parentNode.classList.toggle('is-picked', inp.checked));
    if (answered(i)) card.classList.remove('is-missing');
    renderBar();
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.q-jump');
    if (a) { e.preventDefault(); jumpTo(a.textContent); return; }
    if (e.target.closest('#againBtn')) again();
  });
  $('submitBtn').addEventListener('click', () => (state.submitted ? again() : submit()));

  document.title = QUIZ.title + ' — тест · Долина Эникей';
  $('quizTitle').textContent = QUIZ.title;
  $('quizLead').innerHTML = fmt(QUIZ.lead);
  $('quizCount').textContent = N + ' ' + plural(N, ['вопрос', 'вопроса', 'вопросов']);
  render();
})();
