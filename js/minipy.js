/* MiniPy: учебное подмножество Python, пошаговое выполнение, ошибки по-русски */
const MiniPy = (() => {
  class PyError extends Error {
    constructor(msg, line) { super(msg); this.line = line; this.isPy = true; }
  }
  class BreakSig {}
  class ContinueSig {}

  const norm = s => s.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  const KW = new Set(['for', 'in', 'if', 'elif', 'else', 'while', 'and', 'or', 'not', 'True', 'False',
    'None', 'pass', 'break', 'continue', 'def', 'return', 'import', 'from', 'class', 'lambda', 'is']);

  /* ---------- Лексер ---------- */
  function tokenize(src) {
    const lines = src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
    const toks = [];
    const indents = [0];
    let depth = 0;
    const reNum = /\d+(\.\d+)?/y;
    const reStr = /"([^"\\\n]|\\.)*"|'([^'\\\n]|\\.)*'/y;
    const reName = /[\p{L}_][\p{L}\p{N}_]*/uy;
    const ops = ['//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', ',', ':', '[', ']'];
    for (let i = 0; i < lines.length; i++) {
      const ln = i + 1;
      const line = lines[i];
      if (depth === 0) {
        if (/^\s*(#.*)?$/.test(line)) continue;
        const ind = line.match(/^ */)[0].length;
        const top = indents[indents.length - 1];
        if (ind > top) { indents.push(ind); toks.push({ t: 'INDENT', line: ln }); }
        else if (ind < top) {
          while (ind < indents[indents.length - 1]) { indents.pop(); toks.push({ t: 'DEDENT', line: ln }); }
          if (ind !== indents[indents.length - 1])
            throw new PyError('Отступ этой строки не совпадает ни с одной строкой выше. Выровняй её: обычно 4 пробела на каждый уровень.', ln);
        }
      }
      let p = 0;
      while (p < line.length) {
        const ch = line[p];
        if (ch === ' ') { p++; continue; }
        if (ch === '#') break;
        let m;
        reNum.lastIndex = p;
        if (/\d/.test(ch) && (m = reNum.exec(line))) {
          toks.push({ t: 'NUM', v: parseFloat(m[0]), isFloat: !!m[1], line: ln }); p += m[0].length; continue;
        }
        if (ch === '"' || ch === "'") {
          reStr.lastIndex = p;
          m = reStr.exec(line);
          if (!m) throw new PyError('Текст в кавычках не закрыт. Поставь такую же кавычку в конце текста.', ln);
          const raw = m[0].slice(1, -1).replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
          toks.push({ t: 'STR', v: raw, line: ln }); p += m[0].length; continue;
        }
        if (ch === '«' || ch === '»' || ch === '“' || ch === '”')
          throw new PyError('Такие кавычки Python не понимает. Используй обычные: "текст".', ln);
        reName.lastIndex = p;
        if ((m = reName.exec(line))) {
          const v = m[0];
          toks.push({ t: KW.has(v) ? 'KW' : 'NAME', v, line: ln }); p += v.length; continue;
        }
        const op = ops.find(o => line.startsWith(o, p));
        if (op) {
          if (op === '(' || op === '[') depth++;
          if (op === ')' || op === ']') depth = Math.max(0, depth - 1);
          toks.push({ t: 'OP', v: op, line: ln }); p += op.length; continue;
        }
        throw new PyError(`Непонятный символ «${ch}». Убери его или проверь раскладку клавиатуры.`, ln);
      }
      if (depth === 0) toks.push({ t: 'NL', line: ln });
    }
    if (depth > 0) throw new PyError('Не хватает закрывающей скобки «)».', lines.length);
    const last = lines.length;
    while (indents.length > 1) { indents.pop(); toks.push({ t: 'DEDENT', line: last }); }
    toks.push({ t: 'EOF', line: last });
    return toks;
  }

  /* ---------- Парсер ---------- */
  function parse(src) {
    const toks = tokenize(src);
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];
    const is = (t, v) => toks[i].t === t && (v === undefined || toks[i].v === v);
    const accept = (t, v) => (is(t, v) ? next() : null);

    function expectColon(what) {
      if (accept('OP', ':')) return;
      const tk = peek();
      if (tk.t === 'OP' && tk.v === '=' && (what === 'if' || what === 'while' || what === 'elif'))
        throw new PyError('В условии сравнивают через «==». Одиночный «=» кладёт значение в переменную.', tk.line);
      throw new PyError(`В конце строки с «${what}» нужно двоеточие «:».`, tk.line);
    }

    function block(what) {
      if (accept('NL')) {
        if (!accept('INDENT'))
          throw new PyError(`После «${what} ... :» следующая строка должна начинаться с отступа (4 пробела).`, peek().line);
        const body = [];
        while (!is('DEDENT') && !is('EOF')) body.push(statement());
        accept('DEDENT');
        return body;
      }
      const s = simple();
      if (!accept('NL') && !is('EOF')) throw new PyError('Лишнее в конце строки.', peek().line);
      return [s];
    }

    function statement() {
      const tk = peek();
      if (tk.t === 'INDENT') throw new PyError('Лишний отступ в начале строки. Отступ нужен только после строки с двоеточием.', tk.line);
      if (tk.t === 'KW') {
        if (tk.v === 'for') {
          next();
          const nm = next();
          if (nm.t !== 'NAME') throw new PyError('После «for» нужно имя переменной, например: for i in range(5):', nm.line);
          if (!accept('KW', 'in')) throw new PyError('В цикле нужен «in»: for i in range(5):', peek().line);
          const iter = expr();
          expectColon('for');
          return { k: 'For', name: norm(nm.v), iter, body: block('for'), line: tk.line };
        }
        if (tk.v === 'while') {
          next();
          const cond = expr();
          expectColon('while');
          return { k: 'While', cond, body: block('while'), line: tk.line };
        }
        if (tk.v === 'if') {
          next();
          const branches = [];
          let cond = expr();
          expectColon('if');
          branches.push({ cond, body: block('if'), line: tk.line });
          let orelse = null;
          while (is('KW', 'elif')) {
            const et = next();
            cond = expr();
            expectColon('elif');
            branches.push({ cond, body: block('elif'), line: et.line });
          }
          if (is('KW', 'else')) {
            const et = next();
            if (!accept('OP', ':')) throw new PyError('После «else» нужно двоеточие: else:', et.line);
            orelse = block('else');
          }
          return { k: 'If', branches, orelse, line: tk.line };
        }
        if (tk.v === 'elif' || tk.v === 'else')
          throw new PyError(`«${tk.v}» стоит без «if» выше. Проверь, что у «${tk.v}» такой же отступ, как у своего «if».`, tk.line);
        if (tk.v === 'def') throw new PyError('Свои функции (def) будут на одном из следующих уроков. Сейчас обойдёмся без них.', tk.line);
      }
      const RU = { 'если': 'if', 'иначе': 'else', 'пока': 'while', 'для': 'for', 'повторить': 'for' };
      if (tk.t === 'NAME' && RU[tk.v.toLowerCase()])
        throw new PyError(`Python понимает служебные слова только по-английски: вместо «${tk.v}» пиши «${RU[tk.v.toLowerCase()]}».`, tk.line);
      if (tk.t === 'NAME' && /^(If|IF|For|FOR|While|Else|Elif)$/.test(tk.v))
        throw new PyError(`Python различает большие и маленькие буквы: пиши «${tk.v.toLowerCase()}».`, tk.line);
      const s = simple();
      if (is('OP', ':')) throw new PyError('Двоеточие здесь лишнее, или перед строкой не хватает «if», «for» или «while».', peek().line);
      if (!accept('NL') && !is('EOF')) {
        const t2 = peek();
        throw new PyError(t2.t === 'NAME' || t2.t === 'KW'
          ? 'Две команды в одной строке. Перенеси вторую на новую строку.'
          : `Не понимаю «${t2.v ?? ''}» в этом месте строки.`, t2.line);
      }
      return s;
    }

    function simple() {
      const tk = peek();
      if (accept('KW', 'pass')) return { k: 'Pass', line: tk.line };
      if (accept('KW', 'break')) return { k: 'Break', line: tk.line };
      if (accept('KW', 'continue')) return { k: 'Continue', line: tk.line };
      if (tk.t === 'NAME' && toks[i + 1].t === 'OP' && ['=', '+=', '-=', '*='].includes(toks[i + 1].v)) {
        next();
        const op = next().v;
        return { k: 'Assign', name: norm(tk.v), raw: tk.v, op, value: expr(), line: tk.line };
      }
      if (tk.t === 'NL' || tk.t === 'EOF') throw new PyError('Строка оборвалась раньше времени.', tk.line);
      return { k: 'Expr', value: expr(), line: tk.line };
    }

    function expr() { return orE(); }
    function orE() {
      let l = andE();
      while (is('KW', 'or')) { const t = next(); l = { k: 'Bool', op: 'or', l, r: andE(), line: t.line }; }
      return l;
    }
    function andE() {
      let l = notE();
      while (is('KW', 'and')) { const t = next(); l = { k: 'Bool', op: 'and', l, r: notE(), line: t.line }; }
      return l;
    }
    function notE() {
      if (is('KW', 'not')) { const t = next(); return { k: 'Not', v: notE(), line: t.line }; }
      return cmpE();
    }
    function cmpE() {
      const first = sumE();
      const opsL = [], rest = [];
      while (peek().t === 'OP' && ['==', '!=', '<', '>', '<=', '>='].includes(peek().v)) {
        opsL.push(next().v); rest.push(sumE());
      }
      if (!opsL.length) return first;
      return { k: 'Cmp', first, ops: opsL, rest, line: first.line };
    }
    function sumE() {
      let l = termE();
      while (peek().t === 'OP' && (peek().v === '+' || peek().v === '-')) {
        const t = next(); l = { k: 'Bin', op: t.v, l, r: termE(), line: t.line };
      }
      return l;
    }
    function termE() {
      let l = unary();
      while (peek().t === 'OP' && ['*', '/', '//', '%'].includes(peek().v)) {
        const t = next(); l = { k: 'Bin', op: t.v, l, r: unary(), line: t.line };
      }
      return l;
    }
    function unary() {
      if (is('OP', '-')) { const t = next(); return { k: 'Neg', v: unary(), line: t.line }; }
      if (is('OP', '+')) { next(); return unary(); }
      return postfix();
    }
    function postfix() {
      let e = atom();
      while (is('OP', '(')) {
        const t = next();
        const args = [];
        if (!is('OP', ')')) {
          do { args.push(expr()); } while (accept('OP', ','));
        }
        if (!accept('OP', ')')) throw new PyError('Не хватает закрывающей скобки «)».', t.line);
        e = { k: 'Call', fn: e, args, line: t.line };
      }
      return e;
    }
    function atom() {
      const tk = next();
      if (tk.t === 'NUM') return { k: 'Num', v: tk.v, isFloat: tk.isFloat, line: tk.line };
      if (tk.t === 'STR') return { k: 'Str', v: tk.v, line: tk.line };
      if (tk.t === 'NAME') return { k: 'Name', name: norm(tk.v), raw: tk.v, line: tk.line };
      if (tk.t === 'KW' && tk.v === 'True') return { k: 'Const', v: true, line: tk.line };
      if (tk.t === 'KW' && tk.v === 'False') return { k: 'Const', v: false, line: tk.line };
      if (tk.t === 'KW' && tk.v === 'None') return { k: 'Const', v: null, line: tk.line };
      if (tk.t === 'OP' && tk.v === '(') {
        const e = expr();
        if (!accept('OP', ')')) throw new PyError('Не хватает закрывающей скобки «)».', tk.line);
        return e;
      }
      if (tk.t === 'OP' && tk.v === '[') {
        const items = [];
        if (!is('OP', ']')) { do { items.push(expr()); } while (accept('OP', ',')); }
        if (!accept('OP', ']')) throw new PyError('Не хватает закрывающей скобки «]».', tk.line);
        return { k: 'List', items, line: tk.line };
      }
      if (tk.t === 'NL' || tk.t === 'EOF') throw new PyError('Строка оборвалась: здесь ожидалось значение или команда.', tk.line);
      if (tk.t === 'KW') throw new PyError(`Слово «${tk.v}» здесь не на своём месте.`, tk.line);
      throw new PyError(`Не понимаю «${tk.v}» в этом месте.`, tk.line);
    }

    const body = [];
    while (!is('EOF')) {
      if (accept('NL')) continue;
      if (is('DEDENT')) { next(); continue; }
      body.push(statement());
    }
    return body;
  }

  /* ---------- Значения ---------- */
  const isFn = v => v && typeof v === 'object' && v.__fn;
  function typeName(v) {
    if (v === null) return 'None';
    if (typeof v === 'boolean') return 'да/нет';
    if (typeof v === 'number') return 'число';
    if (typeof v === 'string') return 'текст';
    if (Array.isArray(v)) return 'список';
    if (isFn(v)) return 'команда';
    return '?';
  }
  function repr(v, inner) {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') {
      if (v.__float || !Number.isInteger(v)) return String(v);
      return String(v);
    }
    if (typeof v === 'string') return inner ? `'${v}'` : v;
    if (Array.isArray(v)) return '[' + v.map(x => repr(x, true)).join(', ') + ']';
    if (isFn(v)) return `<команда ${v.name}>`;
    return String(v);
  }
  const truthy = v => !(v === false || v === null || v === 0 || v === '' || (Array.isArray(v) && v.length === 0));

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  /* ---------- Исполнитель (генератор) ---------- */
  function* execute(src, builtins, opts = {}) {
    const ast = parse(src);
    const vars = new Map();
    const maxSteps = opts.maxSteps || 3000;
    let steps = 0;

    const lookupNames = () => [...vars.keys(), ...Object.keys(builtins)];

    function unknown(node) {
      const n = norm(node.name).toLowerCase();
      let best = null, bd = 99;
      for (const cand of lookupNames()) {
        const dd = lev(n, cand.toLowerCase());
        if (dd < bd) { bd = dd; best = cand; }
      }
      const limit = Math.max(2, Math.floor(n.length / 3));
      if (best && bd <= limit) {
        const shown = builtins[best] && isFn(builtins[best]) ? builtins[best].name + '()' : best;
        return new PyError(`Не знаю, что такое «${node.raw}». Может быть, ты имел в виду ${shown}?`, node.line);
      }
      return new PyError(`Не знаю, что такое «${node.raw}». Проверь, нет ли опечатки.`, node.line);
    }

    function cond(node, v, where) {
      if (isFn(v)) {
        throw new PyError(`В ${where} ты написал «${node.raw || v.name}» без скобок. Нужно так: ${v.name}()`, node.line);
      }
      return truthy(v);
    }

    function* ev(node) {
      switch (node.k) {
        case 'Num': return node.v;
        case 'Str': return node.v;
        case 'Const': return node.v;
        case 'List': { const out = []; for (const it of node.items) out.push(yield* ev(it)); return out; }
        case 'Name': {
          if (vars.has(node.name)) return vars.get(node.name);
          if (node.name in builtins) return builtins[node.name];
          throw unknown(node);
        }
        case 'Not': return !cond(node.v, yield* ev(node.v), 'условии');
        case 'Bool': {
          const l = yield* ev(node.l);
          const lt = cond(node.l, l, 'условии');
          if (node.op === 'and') { if (!lt) return l; }
          else if (lt) return l;
          const r = yield* ev(node.r);
          cond(node.r, r, 'условии');
          return r;
        }
        case 'Neg': {
          const v = yield* ev(node.v);
          if (typeof v !== 'number') throw new PyError('Минус можно ставить только перед числом.', node.line);
          return -v;
        }
        case 'Bin': {
          const l = yield* ev(node.l), r = yield* ev(node.r);
          return binop(node, l, r);
        }
        case 'Cmp': {
          let l = yield* ev(node.first);
          for (let j = 0; j < node.ops.length; j++) {
            const r = yield* ev(node.rest[j]);
            if (!compare(node, node.ops[j], l, r)) return false;
            l = r;
          }
          return true;
        }
        case 'Call': {
          const f = yield* ev(node.fn);
          const args = [];
          for (const a of node.args) args.push(yield* ev(a));
          if (!isFn(f)) throw new PyError(`«${repr(f)}» — это ${typeName(f)}, а не команда. Скобки после него не нужны.`, node.line);
          if (f.arity !== undefined) {
            const [mn, mx] = Array.isArray(f.arity) ? f.arity : [f.arity, f.arity];
            if (args.length < mn || args.length > mx) {
              const need = mn === mx ? (mn === 0 ? 'пустые скобки' : `${mn} знач.`) : `от ${mn} до ${mx} знач.`;
              throw new PyError(`Команде ${f.name}() нужны ${need} в скобках, а передано ${args.length}.`, node.line);
            }
          }
          const res = f.fn(args, node.line);
          if (res && typeof res.next === 'function') return yield* res;
          return res === undefined ? null : res;
        }
      }
      throw new PyError('Непонятное выражение.', node.line);
    }

    function binop(node, l, r) {
      const op = node.op;
      if (op === '+') {
        if (typeof l === 'number' && typeof r === 'number') return l + r;
        if (typeof l === 'string' && typeof r === 'string') return l + r;
        if (Array.isArray(l) && Array.isArray(r)) return l.concat(r);
        throw new PyError(`Нельзя сложить ${typeName(l)} и ${typeName(r)}. Если нужен текст, оберни число в str(...).`, node.line);
      }
      if (op === '*' && typeof l === 'string' && typeof r === 'number') return l.repeat(Math.max(0, r));
      if (op === '*' && typeof r === 'string' && typeof l === 'number') return r.repeat(Math.max(0, l));
      if (typeof l !== 'number' || typeof r !== 'number')
        throw new PyError(`Операция «${op}» работает только с числами, а здесь ${typeName(l)} и ${typeName(r)}.`, node.line);
      if ((op === '/' || op === '//' || op === '%') && r === 0) throw new PyError('На ноль делить нельзя.', node.line);
      switch (op) {
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '//': return Math.floor(l / r);
        case '%': return ((l % r) + r) % r;
      }
    }
    function compare(node, op, l, r) {
      if (op === '==') return eq(l, r);
      if (op === '!=') return !eq(l, r);
      const ok = (typeof l === 'number' && typeof r === 'number') || (typeof l === 'string' && typeof r === 'string');
      if (!ok) throw new PyError(`Нельзя сравнить ${typeName(l)} и ${typeName(r)} знаком «${op}».`, node.line);
      switch (op) { case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r; }
    }
    function eq(a, b) {
      if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, k) => eq(x, b[k]));
      return a === b;
    }

    function* runBlock(body) { for (const s of body) yield* exec(s); }

    function* exec(s) {
      if (++steps > maxSteps)
        throw new PyError('Слишком много шагов. Похоже, программа зациклилась: проверь условие цикла.', s.line);
      yield { type: 'line', line: s.line };
      switch (s.k) {
        case 'Pass': return;
        case 'Break': throw new BreakSig();
        case 'Continue': throw new ContinueSig();
        case 'Assign': {
          const v = yield* ev(s.value);
          if (s.op === '=') {
            if (s.name in builtins && isFn(builtins[s.name]))
              throw new PyError(`«${s.raw}» — это команда героя, её нельзя менять. Назови переменную по-другому.`, s.line);
            vars.set(s.name, v); return;
          }
          if (!vars.has(s.name)) throw new PyError(`Переменной «${s.raw}» ещё нет. Сначала задай её: ${s.raw} = 0`, s.line);
          vars.set(s.name, binop({ op: s.op[0], line: s.line }, vars.get(s.name), v));
          return;
        }
        case 'Expr': {
          if (s.value.k === 'Name') {
            const v = yield* ev(s.value);
            if (isFn(v)) throw new PyError(`Чтобы выполнить команду, после неё нужны скобки: ${v.name}()`, s.line);
            return;
          }
          yield* ev(s.value);
          return;
        }
        case 'If': {
          for (const b of s.branches) {
            if (b !== s.branches[0]) yield { type: 'line', line: b.line };
            const v = yield* ev(b.cond);
            if (cond(b.cond, v, 'условии')) { yield* runBlock(b.body); return; }
          }
          if (s.orelse) yield* runBlock(s.orelse);
          return;
        }
        case 'While': {
          let guard = 0;
          while (true) {
            const v = yield* ev(s.cond);
            if (!cond(s.cond, v, 'условии цикла')) break;
            if (++guard > 2000) throw new PyError('Цикл while крутится слишком долго. Проверь, что условие когда-нибудь станет ложным.', s.line);
            try { yield* runBlock(s.body); }
            catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContinueSig) { yield { type: 'line', line: s.line }; continue; } throw e; }
            yield { type: 'line', line: s.line };
          }
          return;
        }
        case 'For': {
          const it = yield* ev(s.iter);
          let seq;
          if (Array.isArray(it)) seq = it;
          else if (typeof it === 'string') seq = [...it];
          else if (typeof it === 'number') throw new PyError(`Цикл не может пройти по числу. Нужно так: for ${s.name} in range(${it}):`, s.line);
          else throw new PyError('Цикл for проходит по range(...), тексту или списку.', s.line);
          for (let j = 0; j < seq.length; j++) {
            if (j > 0) yield { type: 'line', line: s.line };
            vars.set(s.name, seq[j]);
            try { yield* runBlock(s.body); }
            catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContinueSig) continue; throw e; }
          }
          return;
        }
      }
    }

    try {
      for (const s of ast) yield* exec(s);
    } catch (e) {
      if (e instanceof BreakSig || e instanceof ContinueSig)
        throw new PyError('break и continue работают только внутри цикла.', null);
      throw e;
    }
  }

  /* ---------- Стандартные функции ---------- */
  function fn(name, arity, f) { return { __fn: true, name, arity, fn: f }; }
  function stdlib(onPrint) {
    return {
      print: fn('print', [0, 20], function* (args) { yield { type: 'print', text: args.map(a => repr(a)).join(' ') }; return null; }),
      range: fn('range', [1, 3], (a, line) => {
        if (!a.every(x => typeof x === 'number' && Number.isInteger(x))) throw new PyError('В range(...) нужны целые числа.', line);
        let [s, e, st] = a.length === 1 ? [0, a[0], 1] : [a[0], a[1], a[2] ?? 1];
        if (st === 0) throw new PyError('Шаг в range не может быть нулём.', line);
        const out = [];
        for (let x = s; st > 0 ? x < e : x > e; x += st) { out.push(x); if (out.length > 10000) throw new PyError('Слишком большой range.', line); }
        return out;
      }),
      len: fn('len', 1, (a, line) => {
        if (typeof a[0] === 'string' || Array.isArray(a[0])) return a[0].length;
        throw new PyError(`У значения типа «${typeName(a[0])}» нет длины.`, line);
      }),
      str: fn('str', 1, a => repr(a[0])),
      int: fn('int', 1, (a, line) => {
        const v = a[0];
        if (typeof v === 'number') return Math.trunc(v);
        if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
        throw new PyError(`Не получается превратить «${repr(v)}» в число.`, line);
      }),
      abs: fn('abs', 1, (a, line) => { if (typeof a[0] !== 'number') throw new PyError('abs() работает только с числами.', line); return Math.abs(a[0]); }),
    };
  }

  return { parse, execute, stdlib, fn, PyError, norm, repr };
})();
if (typeof module !== 'undefined') module.exports = MiniPy;
