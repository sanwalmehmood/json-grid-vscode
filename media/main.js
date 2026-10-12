(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root');
  const errorEl = document.getElementById('error');
  const statusEl = document.getElementById('status');
  const filterEl = document.getElementById('filter');
  const expanded = new Set(JSON.parse((vscode.getState() || {}).expanded || '[]'));
  let data;
  let selected = null;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isCont = (v) => v !== null && typeof v === 'object';
  const key = (p) => JSON.stringify(p);
  const persist = () => vscode.setState({ expanded: JSON.stringify([...expanded]) });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function primitive(v) {
    const t = v === null ? 'null' : typeof v;
    return el('span', 't-' + t, t === 'string' ? v : String(v));
  }
  const summary = (v) => Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).length}}`;

  function fillCell(td, value, path) {
    td.dataset.path = key(path);
    if (!isCont(value)) { td.appendChild(primitive(value)); return; }
    const btn = el('button', 'toggle', '+');
    const sum = el('span', 'summary', summary(value));
    td.append(btn, sum);
    const holder = el('div');
    td.appendChild(holder);
    const open = () => { holder.replaceChildren(render(value, path)); btn.textContent = '–'; expanded.add(key(path)); };
    const close = () => { holder.replaceChildren(); btn.textContent = '+'; expanded.delete(key(path)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); holder.childNodes.length ? close() : open(); persist(); });
    td._open = open; td._holder = holder;
    if (expanded.has(key(path))) open();
  }

  function render(value, path) {
    if (!isCont(value)) return primitive(value);
    if (Array.isArray(value)) {
      if (!value.length) return el('span', 'empty', '[ ]');
      return value.every(isObj) ? arrayOfObjects(value, path) : indexTable(value, path);
    }
    if (!Object.keys(value).length) return el('span', 'empty', '{ }');
    return objectTable(value, path);
  }

  const tstate = new Map();
  const getState = (p) => { const k = key(p); if (!tstate.has(k)) tstate.set(k, { conds: [], mode: 'all', sort: null }); return tstate.get(k); };
  const OPS = [['contains', 'contains'], ['ncontains', 'does not contain'], ['eq', 'equals'], ['ne', 'not equals'],
  ['starts', 'starts with'], ['ends', 'ends with'], ['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='],
  ['empty', 'is empty'], ['nempty', 'is not empty']];
  const noVal = (op) => op === 'empty' || op === 'nempty';
  const text = (v) => v === undefined || v === null ? '' : isCont(v) ? JSON.stringify(v) : String(v);
  const activeConds = (st) => st.conds.filter(c => noVal(c.op) || (c.val ?? '') !== '');

  function test(v, c) {
    const s = text(v), a = s.toLowerCase(), b = String(c.val ?? '').toLowerCase();
    switch (c.op) {
      case 'contains': return a.includes(b);
      case 'ncontains': return !a.includes(b);
      case 'eq': return a === b;
      case 'ne': return a !== b;
      case 'starts': return a.startsWith(b);
      case 'ends': return a.endsWith(b);
      case 'empty': return s === '';
      case 'nempty': return s !== '';
      default: {
        const x = parseFloat(s), y = parseFloat(c.val);
        if (isNaN(x) || isNaN(y)) return false;
        return c.op === 'gt' ? x > y : c.op === 'gte' ? x >= y : c.op === 'lt' ? x < y : x <= y;
      }
    }
  }
  function rowPass(row, st) {
    const cs = activeConds(st);
    if (!cs.length) return true;
    return st.mode === 'any' ? cs.some(c => test(row[c.col], c)) : cs.every(c => test(row[c.col], c));
  }

  let pop = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; } };
  document.addEventListener('mousedown', (e) => { if (pop && !pop.contains(e.target) && !e.target.closest('.popbtn')) closePop(); });
  function openPop(anchor, content) {
    closePop();
    pop = el('div', 'popover');
    pop.appendChild(content);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const maxLeft = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8;
    pop.style.left = Math.max(4, Math.min(r.left + window.scrollX, maxLeft)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 2) + 'px';
  }
  function opSelect(cur) {
    const sel = el('select');
    OPS.forEach(([v, l]) => { const o = el('option', null, l); o.value = v; if (v === cur) o.selected = true; sel.appendChild(o); });
    return sel;
  }
  function funnel() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('width', '12'); svg.setAttribute('height', '12');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M1.5 2h13L9.5 8.5V14l-3-1.5V8.5z'); path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  function columnFilterUI(st, col, build) {
    const cur = st.conds.find(x => x.col === col) || { col, op: 'contains', val: '' };
    const wrap = el('div');
    wrap.appendChild(el('div', 'poptitle', 'Filter: ' + col));
    const sel = opSelect(cur.op);
    const inp = el('input'); inp.placeholder = 'value'; inp.value = cur.val || '';
    const sync = () => {
      inp.disabled = noVal(sel.value);
      const nc = { col, op: sel.value, val: inp.value };
      const i = st.conds.findIndex(x => x.col === col);
      if (i >= 0) st.conds[i] = nc; else st.conds.push(nc);
      build();
    };
    sel.addEventListener('change', sync);
    inp.addEventListener('input', sync);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') closePop(); });
    const clear = el('button', null, 'Clear');
    clear.addEventListener('click', () => { st.conds = st.conds.filter(x => x.col !== col); closePop(); build(); });
    const row = el('div', 'poprow'); row.append(sel, inp, clear);
    wrap.appendChild(row);
    inp.disabled = noVal(sel.value);
    setTimeout(() => inp.focus(), 0);
    return wrap;
  }

  function advancedUI(st, cols, build) {
    const wrap = el('div', 'adv');
    wrap.appendChild(el('div', 'poptitle', 'Advanced Filter'));
    const mode = el('select');
    [['all', 'Match ALL conditions'], ['any', 'Match ANY condition']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; if (st.mode === v) o.selected = true; mode.appendChild(o); });
    mode.addEventListener('change', () => { st.mode = mode.value; build(); });
    wrap.appendChild(mode);
    const list = el('div');
    wrap.appendChild(list);
    const draw = () => {
      list.replaceChildren();
      st.conds.forEach((c, i) => {
        const row = el('div', 'poprow');
        const col = el('select');
        cols.forEach(n => { const o = el('option', null, n); o.value = n; if (n === c.col) o.selected = true; col.appendChild(o); });
        const op = opSelect(c.op);
        const val = el('input'); val.value = c.val || ''; val.placeholder = 'value'; val.disabled = noVal(c.op);
        col.addEventListener('change', () => { c.col = col.value; build(); });
        op.addEventListener('change', () => { c.op = op.value; val.disabled = noVal(c.op); build(); });
        val.addEventListener('input', () => { c.val = val.value; build(); });
        const rm = el('button', null, '✕');
        rm.addEventListener('click', () => { st.conds.splice(i, 1); draw(); build(); });
        row.append(col, op, val, rm);
        list.appendChild(row);
      });
    };
    draw();
    const bar = el('div', 'poprow');
    const add = el('button', null, '+ Add condition');
    add.addEventListener('click', () => { st.conds.push({ col: cols[0], op: 'contains', val: '' }); draw(); });
    const clr = el('button', null, 'Clear all');
    clr.addEventListener('click', () => { st.conds = []; draw(); build(); });
    bar.append(add, clr);
    wrap.appendChild(bar);
    if (!st.conds.length) add.click();
    return wrap;
  }

  function corner(getRows, f) {
    const th = el('th', 'corner');
    const b = el('button', 'popbtn', '⋯');
    b.title = 'Table menu';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = el('div', 'menu');
      const item = (label, fn) => { const x = el('button', 'menuitem', label); x.addEventListener('click', fn); m.appendChild(x); };
      if (f) {
        item('Advanced Filter…', () => openPop(b, advancedUI(f.st, f.cols, f.build)));
        item('Clear filters & sort', () => { f.st.conds = []; f.st.sort = null; closePop(); f.build(); });
      }
      item('Export to CSV', () => { closePop(); vscode.postMessage({ type: 'saveCsv', csv: toCsv(getRows()) }); });
      openPop(b, m);
    });
    th.appendChild(b);
    return th;
  }

  function arrayOfObjects(arr, path) {
    const cols = [];
    arr.forEach(o => Object.keys(o).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
    const st = getState(path);
    const box = el('div');
    let visible = arr;

    const build = () => {
      let rows = arr.map((_, i) => i).filter(i => rowPass(arr[i], st));
      if (st.sort) {
        const { col, dir } = st.sort;
        rows.sort((i, j) => {
          const x = arr[i][col], y = arr[j][col];
          const r = typeof x === 'number' && typeof y === 'number' ? x - y : text(x).localeCompare(text(y), undefined, { numeric: true });
          return dir === 'asc' ? r : -r;
        });
      }
      visible = rows.map(i => arr[i]);

      const table = el('table');
      const head = el('tr');
      head.appendChild(corner(() => visible, { st, cols, build }));
      cols.forEach(c => {
        const th = el('th', 'key'); th.dataset.path = key(path);
        const arrow = st.sort && st.sort.col === c ? (st.sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
        const lbl = el('span', 'lbl', c + arrow);
        lbl.title = 'Click to sort';
        lbl.addEventListener('click', () => {
          if (!st.sort || st.sort.col !== c) st.sort = { col: c, dir: 'asc' };
          else if (st.sort.dir === 'asc') st.sort = { col: c, dir: 'desc' };
          else st.sort = null;
          build();
        });
        const fb = el('button', 'filt popbtn');
        fb.title = 'Filter';
        fb.appendChild(funnel());
        if (activeConds(st).some(x => x.col === c)) fb.classList.add('on');
        fb.addEventListener('click', (e) => { e.stopPropagation(); openPop(fb, columnFilterUI(st, c, build)); });
        th.append(lbl, fb);
        head.appendChild(th);
      });
      table.appendChild(head);
      rows.forEach(r => {
        const row = arr[r];
        const tr = el('tr');
        const idx = el('th', 'idx', String(r));
        idx.dataset.path = key(path.concat(r));
        tr.appendChild(idx);
        cols.forEach(c => {
          const td = el('td');
          if (c in row) fillCell(td, row[c], path.concat(r, c));
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      box.replaceChildren(table);
      if (rows.length !== arr.length) box.appendChild(el('div', 'footer', `Showing ${rows.length} of ${arr.length} rows`));
      applyFilter();
    };
    build();
    return box;
  }

  function indexTable(arr, path) {
    const table = el('table');
    const head = el('tr');
    head.appendChild(corner(() => arr, null));
    head.appendChild(el('th', null, 'value'));
    table.appendChild(head);
    arr.forEach((v, i) => {
      const tr = el('tr');
      const idx = el('th', 'idx', String(i)); idx.dataset.path = key(path.concat(i));
      const td = el('td'); fillCell(td, v, path.concat(i));
      tr.append(idx, td);
      table.appendChild(tr);
    });
    return table;
  }

  function objectTable(obj, path) {
    const table = el('table');
    Object.keys(obj).forEach(k => {
      const tr = el('tr');
      const th = el('th', 'key', k); th.dataset.path = key(path.concat(k));
      const td = el('td'); fillCell(td, obj[k], path.concat(k));
      tr.append(th, td);
      table.appendChild(tr);
    });
    return table;
  }

  function toCsv(arr) {
    const esc = (s) => /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const cell = (v) => v === undefined ? '' : esc(isCont(v) ? JSON.stringify(v) : v === null ? '' : String(v));
    if (arr.every(isObj)) {
      const cols = [];
      arr.forEach(o => Object.keys(o).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
      return [cols.map(esc).join(','), ...arr.map(o => cols.map(c => cell(o[c])).join(','))].join('\n');
    }
    return ['value', ...arr.map(cell)].join('\n');
  }

  function draw() {
    root.replaceChildren(render(data, []));
    applyFilter();
  }

  function applyFilter() {
    const q = filterEl.value.toLowerCase();
    root.querySelectorAll('.hit').forEach(e => e.classList.remove('hit'));
    if (!q) { statusEl.textContent = ''; return; }
    let n = 0;
    root.querySelectorAll('td, th').forEach(c => {
      const own = c.tagName === 'TH' ? c.firstChild && c.firstChild.nodeType === 3 ? c.textContent : ''
        : [...c.children].filter(x => x.tagName === 'SPAN' && x.className.startsWith('t-')).map(x => x.textContent).join(' ');
      if (own && own.toLowerCase().includes(q)) { c.classList.add('hit'); n++; }
    });
    statusEl.textContent = n + ' match' + (n === 1 ? '' : 'es');
  }

  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-path]');
    if (!c) return;
    if (selected) selected.classList.remove('sel');
    selected = c; c.classList.add('sel');
    vscode.postMessage({ type: 'reveal', path: JSON.parse(c.dataset.path) });
  });

  function setAll(open) {
    if (open) {
      let guard = 0;
      for (; ;) {
        const closed = [...root.querySelectorAll('td')].filter(td => td._open && !td._holder.childNodes.length);
        if (!closed.length || (guard += closed.length) > 5000) break;
        closed.forEach(td => td._open());
      }
    } else {
      expanded.clear();
      draw();
    }
    persist();
    applyFilter();
  }

  document.getElementById('expandAll').addEventListener('click', () => setAll(true));
  document.getElementById('collapseAll').addEventListener('click', () => setAll(false));
  filterEl.addEventListener('input', applyFilter);

  window.addEventListener('message', ({ data: m }) => {
    if (m.type === 'data') { errorEl.textContent = ''; data = m.value; draw(); }
    else if (m.type === 'error') { errorEl.textContent = 'Invalid JSON: ' + m.message; }
  });
  vscode.postMessage({ type: 'ready' });
})();
