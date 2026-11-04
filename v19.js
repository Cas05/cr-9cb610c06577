// v19: Find by condition (plain-language condition -> related protocols)
(function () {
  const V19 = window.V19 = {};
  let R = null;
  const norm = s => (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function score(c, q) {
    let best = 0;
    [c.name].concat(c.syn || []).forEach(t => {
      t = norm(t); let s = 0;
      if (t === q) s = 100; else if (t.startsWith(q)) s = 80; else if ((' ' + t).includes(' ' + q)) s = 60; else if (q.length >= 3 && t.includes(q)) s = 40;
      else {
        const qw = q.split(' '), tw = t.split(' ');
        const ok = qw.every(w => tw.some(x => x.startsWith(w) || (w.length >= 3 && lev(w, x) <= (w.length >= 6 ? 2 : 1))));
        if (ok) s = 30 - (lev(q, t) > 3 ? 5 : 0);
      }
      best = Math.max(best, s);
    });
    return best;
  }
  V19.match = function (q) {
    q = norm(q); if (!q) return [];
    return (R.DATA.conditions || []).map(c => ({ c, s: score(c, q) })).filter(x => x.s > 0).filter((x, _, all) => x.s >= 40 || !all.some(y => y.s >= 40)).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name)).map(x => x.c);
  };
  const docs = ids => (ids || []).map(id => R.BY_ID[id]).filter(Boolean);
  function rows(list) {
    return `<ul class="list">${list.map(d => `<li><a href="#/p/${d.id}">${V5.icon(/^return-to/.test(d.id) ? 'run' : 'joint', 'mini-ic')}<span>${R.esc(d.title)}</span>${V5.icon('chev', 'chev')}</a></li>`).join('')}</ul>`;
  }
  V19.resultHtml = function (c) {
    const s = docs(c.surg), h = docs(c.hep), r = docs(c.rts);
    const more = docs((R.DATA.rts_more || []).filter(id => !(c.rts || []).includes(id)));
    return `<div class="card cond-res"><h3>${R.esc(c.name)}</h3>
      ${s.length ? `<h4 class="sub">Surgery recovery protocols</h4>${rows(s)}` : ''}
      ${h.length ? `<h4 class="sub">Home exercise programs</h4>${rows(h)}` : ''}
      ${r.length ? `<h4 class="sub">Return to sport</h4>${rows(r)}` : ''}
      ${more.length ? `<details class="sec"><summary>Other return to sport programs (${more.length})</summary>${rows(more)}</details>` : ''}
      <p class="note">Your care team decides which of these you need.</p></div>`;
  };
  // Generic box: onPick(condition)
  V19.box = function (el, onPick, ph) {
    const id = 'cf' + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `<label class="f" for="${id}">Find by condition or surgery</label>
      <div class="searchwrap">${V5.icon('search', 'sic')}<input id="${id}" class="search" type="search" autocomplete="off" placeholder="${R.esc(ph || 'e.g. ACL, hip impingement, rotator cuff')}" aria-label="Find by condition"></div>
      <div class="cond-sugg" role="listbox"></div><div class="cond-out" aria-live="polite"></div>`;
    const inp = el.querySelector('input'), sg = el.querySelector('.cond-sugg'), out = el.querySelector('.cond-out');
    const show = () => {
      const m = V19.match(inp.value).slice(0, 6);
      sg.innerHTML = inp.value.trim() ? (m.length ? m.map((c, i) => `<button type="button" class="qp cond-pill" data-i="${i}">${R.esc(c.name)}</button>`).join('') : '<p class="note">No condition found. Try another word, or browse by body area below.</p>') : '';
      sg.querySelectorAll('button').forEach(b => b.onclick = () => { const c = m[+b.dataset.i]; sg.innerHTML = ''; inp.value = c.name; onPick(c, out); });
    };
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const m = V19.match(inp.value); if (m[0]) { sg.innerHTML = ''; inp.value = m[0].name; onPick(m[0], out); } } });
    return inp;
  };
  const showRes = (c, out) => { out.innerHTML = V19.resultHtml(c); };
  V19.init = function (api) { R = api; };
  V19.after = function (a, b) {
    const main = document.getElementById('main'); if (!main || !R.DATA.conditions) return;
    if (a === 'browse' || a === 'protocols' || a === 'c') {
      const sw = main.querySelector('.searchwrap'); if (!sw) return;
      const box = document.createElement('div'); box.className = 'card condbox'; sw.before(box);
      V19.box(box, showRes);
      const h = document.createElement('h3'); h.className = 'sub'; h.textContent = 'Or search and browse all protocols'; sw.before(h);
    } else if (!a) {
      const box = document.createElement('div'); box.className = 'card condbox';
      main.prepend(box); V19.box(box, showRes);
    } else if (a === 'plan') {
      const sel = document.getElementById('pp'); if (!sel) return;
      const box = document.createElement('div'); box.className = 'condbox inl'; sel.previousElementSibling.before(box);
      V19.box(box, (c, out) => {
        const first = (c.surg[0] || c.hep[0]); if (first) sel.value = first;
        out.innerHTML = `<p class="note">Picked: <strong>${R.esc((R.BY_ID[first] || {}).title || '')}</strong>. Change it below if needed.</p>` + V19.resultHtml(c);
      });
    } else if (a === 'staff' && b === 'tools') {
      const sel = document.getElementById('sp'); if (!sel) return;
      const num = id => (/-(\d+)$/.exec(id) || [])[1];
      const box = document.createElement('div'); box.className = 'condbox inl'; sel.previousElementSibling.before(box);
      V19.box(box, (c, out) => {
        const all = c.surg.concat(c.hep, c.rts_core || []), main1 = all[0];
        if (main1) sel.value = num(main1);
        const want = new Set(all.slice(1).map(num));
        document.querySelectorAll('#xl input').forEach(x => { x.checked = want.has(x.value); });
        out.innerHTML = `<p class="note">Main protocol set to <strong>${R.esc((R.BY_ID[main1] || {}).title || '')}</strong> and ${want.size} related document${want.size === 1 ? '' : 's'} checked under Add-ons. Uncheck anything you don't want, or check a sport below.</p>`;
      }, 'e.g. ACL, hip impingement, Tommy John');
    }
  };
})();
