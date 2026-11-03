/* Rehab Protocol Companion - prototype. Plain JS, no backend. All personal data stays in localStorage. */
(function () {
  'use strict';
  const DISCLAIMER = "Educational reference from Dr. Cole's protocols. Follow your surgeon's and therapist's instructions. Not medical advice.";
  const PLAN_KEY = 'rehabProto.plan';
  const CHECK_KEY = 'rehabProto.checks';
  let DATA = null, BY_ID = {};
  const main = document.getElementById('main');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const BODY_ORDER = ['Shoulder', 'Elbow', 'Hip', 'Knee', 'Knee/Hip Arthroplasty', 'Foot & Ankle'];

  function docText(d) {
    const parts = [d.title, d.category];
    (d.sections || []).forEach(s => { if (s.title) parts.push(s.title); s.lines.forEach(l => l && parts.push(l.t)); });
    (d.exercises || []).forEach(t => parts.push(t));
    return parts.join(' \n ').toLowerCase();
  }

  function setTitle(t) { document.title = (t ? t + ' - ' : '') + 'Rehab Protocol Companion (Prototype)'; }
  function navActive(name) { document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name)); }

  // ---------------- Home ----------------
  const head = t => { const h = document.getElementById('htitle'); if (h) h.textContent = t; };
  function browseHtml() {
    const cats = DATA.categories;
    const count = c => DATA.docs.filter(d => d.category === c).length;
    const body = BODY_ORDER.filter(c => cats.includes(c)).concat(cats.filter(c => !BODY_ORDER.includes(c) && !/home exercise|return-to-sport/i.test(c)));
    const special = cats.filter(c => /home exercise|return-to-sport/i.test(c));
    return `<div class="searchwrap">${V5.icon('search', 'sic')}<input id="q" class="search" type="search" placeholder="Search surgery, injury, sport or exercise" autocomplete="off" aria-label="Search protocols"></div>
      <div id="results" aria-live="polite"></div>
      <div id="browse">
        <h2 class="sect">By body area</h2>
        <div class="grid">${body.map(c => tile(c, count(c))).join('')}</div>
        <h2 class="sect">Programs</h2>
        <div class="grid">${special.map(c => tile(c, count(c))).join('')}</div>
        <p class="count">${DATA.docs.length} documents from Dr. Cole's public protocols page. <a href="${esc(DATA.source_page)}" target="_blank" rel="noopener">Source page</a></p>
      </div>`;
  }
  function wireBrowse() {
    const q = document.getElementById('q'); if (!q) return;
    q.addEventListener('input', () => search(q.value));
    const saved = sessionStorage.getItem('rehabProto.q'); if (saved) { q.value = saved; search(saved); }
  }
  function home() {
    setTitle(''); navActive('home');
    main.innerHTML = `${V5.homeTop()}<h2 class="sect">Explore Dr. Cole's protocols</h2>${browseHtml()}`;
    V5.wireHome(); wireBrowse();
  }
  function browse() {
    setTitle('Protocols'); navActive('plan'); head('All Protocols');
    main.innerHTML = `<p class="crumb"><a href="#/plan">My Plan</a> / All protocols</p>${browseHtml()}`;
    wireBrowse();
  }
  function tile(c, n) { return `<a class="tile" href="#/c/${slug(c)}"><span class="tile-ic">${V5.icon(V5.catIcon(c))}</span><strong>${esc(c)}</strong><span>${n} document${n === 1 ? '' : 's'}</span></a>`; }

  function search(v) {
    sessionStorage.setItem('rehabProto.q', v);
    const res = document.getElementById('results'), browse = document.getElementById('browse');
    const terms = v.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { res.innerHTML = ''; browse.hidden = false; return; }
    browse.hidden = true;
    const scored = DATA.docs.map(d => {
      const t = (d.title + ' ' + d.category).toLowerCase();
      if (!terms.every(w => d._text.includes(w))) return null;
      return { d, s: terms.reduce((a, w) => a + (t.includes(w) ? 10 : 1), 0) };
    }).filter(Boolean).sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title));
    res.innerHTML = `<p class="count">${scored.length} match${scored.length === 1 ? '' : 'es'}</p>` + listHtml(scored.map(x => x.d), true);
  }
  function listHtml(docs, showCat) {
    return `<ul class="list">${docs.map(d => `<li><a href="#/p/${d.id}">${V5.icon(V5.catIcon(d.category), 'mini-ic')}<span>${esc(d.title)}${showCat ? `<small>${esc(d.category)}</small>` : ''}</span>${V5.icon('chev', 'chev')}</a></li>`).join('')}</ul>`;
  }

  function category(s) {
    const c = DATA.categories.find(x => slug(x) === s);
    if (!c) return notFound();
    setTitle(c); navActive('home'); head(c);
    const docs = DATA.docs.filter(d => d.category === c);
    main.innerHTML = `<p class="crumb"><a href="#/browse">All protocols</a> / ${esc(c)}</p>
      <p class="note">Titles and grouping are as listed on Dr. Cole's protocols page.</p>${listHtml(docs, false)}`;
  }

  // ---------------- Protocol detail ----------------
  function linesHtml(lines, opts = {}) {
    let out = '';
    lines.forEach((l, i) => {
      if (!l) { out += '<div class="gap"></div>'; return; }
      const pad = `style="margin-left:${(l.l || 0) * 0.9}em"`;
      if (l.k === 'pre') out += `<pre class="ln" ${pad}>${esc(l.t)}</pre>`;
      else if (l.k === 'label') out += `<div class="ln label" ${pad}>${esc(l.t)}</div>`;
      else out += `<div class="ln ${l.k === 'text' ? 'text' : 'item'}" ${pad}>${esc(l.t)}</div>`;
    });
    return out;
  }
  function sectionTitle(s, i) { return s.title || (i === 0 ? 'Start of document' : 'Section ' + (i + 1)); }

  function detail(id) {
    const d = BY_ID[id]; if (!d) return notFound();
    setTitle(d.title); navActive('home'); head('Protocol');
    const plan = store.get(PLAN_KEY, null);
    const hl = plan && plan.id === d.id ? matchSections(d, plan.date) : new Set();
    const pages = (d.page_images || []);
    const secs = d.sections || [];
    const split = !!d.split_on;
    main.innerHTML = `
      <p class="crumb"><a href="#/browse">All protocols</a> / <a href="#/c/${slug(d.category)}">${esc(d.category)}</a></p>
      <div class="card protocard"><div class="pc-icon">${V5.icon(V5.catIcon(d.category))}</div><div class="pc-body"><h2>${esc(d.title)}</h2><div class="pc-sub">${esc(d.category)}</div></div></div>
      <div class="disclaimer" role="note">${esc(DISCLAIMER)}</div>
      <div class="btns">
        <a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">Open original document (${esc((d.type || '').toUpperCase())})</a>
        <button class="btn secondary" id="addplan">${plan && plan.id === d.id ? 'In My plan' : 'Use in My plan'}</button>
      </div>
      ${(d.issues || []).length ? `<div class="flag"><strong>Check the original:</strong> ${d.issues.map(esc).join('; ')}.</div>` : ''}
      ${d.exercises && d.exercises.length ? `<h2>Exercises in this handout</h2><p class="note">Names as printed in the handout (auto-detected; the page images below are the complete handout).</p><ul>${d.exercises.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${pages.length ? `<h2>Original pages</h2><p class="note">Images of the original document pages, including exercise pictures.</p><div class="pages">${pages.map((p, i) => `<img loading="lazy" src="pages/${esc(p)}" alt="Page ${i + 1} of ${esc(d.title)}">`).join('')}</div>` : ''}
      ${secs.length ? `<h2>${split ? 'Protocol by section' : (pages.length ? 'Extracted text' : 'Full text')}</h2>
        ${split ? '<p class="note">Sections follow the document\'s own headings. Text is shown as written in the original.</p>' : '<p class="note">This document has no phase/week headings we could split on, so it is shown as one block.</p>'}
        ${secs.map((s, i) => `<details class="sec${hl.has(i) ? ' hi' : ''}" ${(!split || hl.has(i) || (!hl.size && i <= 1)) ? 'open' : ''}>
          <summary>${esc(sectionTitle(s, i))}${hl.has(i) ? '<span class="badge">Matches your date</span>' : ''}</summary>
          <div class="secbody">${linesHtml(s.lines)}</div></details>`).join('')}` : ''}
      <div class="disclaimer" role="note">${esc(DISCLAIMER)}</div>
      <p class="note">Source: <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.url)}</a></p>`;
    document.getElementById('addplan').onclick = () => {
      const cur = store.get(PLAN_KEY, null);
      store.set(PLAN_KEY, { id: d.id, date: cur && cur.id === d.id ? cur.date : (cur ? cur.date : '') });
      location.hash = '#/plan';
    };
  }

  // ---------------- Timeline matching (uses only the numbers in each heading) ----------------
  function daysSince(date) {
    if (!date) return null;
    const [y, m, dd] = date.split('-').map(Number);
    const start = new Date(y, m - 1, dd), now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - start) / 86400000);
  }
  function rangeMatch(r, days) {
    if (!r || days == null || days < 0) return false;
    const [u, a, b] = r;
    const inR = (v) => v >= a && (b == null || v <= b);
    if (u === 'day') return inR(days);
    if (u === 'week') return inR(Math.floor(days / 7)) || inR(days / 7);
    if (u === 'week_single') return Math.max(1, Math.ceil(days / 7)) === a;
    if (u === 'month') return inR(Math.floor(days / 30.44)) || inR(days / 30.44);
    if (u === 'month_single') return Math.max(1, Math.ceil(days / 30.44)) === a;
    return false;
  }
  function matchSections(d, date) {
    const days = daysSince(date), set = new Set();
    (d.sections || []).forEach((s, i) => { if (rangeMatch(s.range, days)) set.add(i); });
    return set;
  }

  // ---------------- My plan ----------------
  function todayKey() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  function plan() {
    setTitle('My plan'); navActive('plan'); head('My Plan');
    const p = store.get(PLAN_KEY, null), d = p && BY_ID[p.id];
    const opts = DATA.categories.map(c => `<optgroup label="${esc(c)}">${DATA.docs.filter(x => x.category === c).map(x => `<option value="${x.id}" ${p && p.id === x.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</optgroup>`).join('');
    const setup = `<details class="card setup" ${d ? '' : 'open'}><summary>${d ? 'Change my plan' : 'Set up my own plan'}</summary>
        <p class="note">Saved only in this browser on this device. Nothing is sent anywhere.</p>
        <label class="f" for="pp">Protocol or program</label>
        <select id="pp"><option value="">Choose...</option>${opts}</select>
        <label class="f" for="pd">Surgery or start date (optional)</label>
        <input type="date" id="pd" value="${p && p.date ? esc(p.date) : ''}">
        <div class="btns"><button class="btn" id="save">Save</button>${p ? '<button class="btn danger" id="clear">Clear my plan</button>' : ''}</div>
      </details>`;
    const browseCard = `<a class="card linkrow" href="#/browse">${V5.icon('book', 'tile-ic')}<span><strong>Browse all protocols</strong><small>${DATA.docs.length} documents from Dr. Cole's protocols page</small></span>${V5.icon('chev', 'chev')}</a>`;
    let html;
    if (!d) {
      html = `<div class="card empty"><div class="pc-icon">${V5.icon('dumbbell')}</div><div><h2>No plan yet</h2><p class="note">Use the code or link from your care team, or set up your own plan below.</p></div></div>
        ${V5.codeCardHtml()}${setup}${browseCard}`;
    } else {
      const I = V5.planInfo(d, p), seg = sessionStorage.getItem('rehabProto.planseg') || 'ex';
      const cur = I.ci >= 0 ? I.ph[I.ci] : null;
      const segBtn = (id, label) => `<button role="tab" aria-selected="${seg === id}" class="${seg === id ? 'on' : ''}" data-pseg="${id}">${label}</button>`;
      html = `<div class="card plancard"><div class="pc-top"><div class="pc-icon">${V5.icon(V5.catIcon(d.category))}</div><div><h2>${esc(d.title)}</h2><div class="pc-sub">${p.by ? 'Assigned by ' + esc(p.by) : (p.date ? (I.days < 0 ? -I.days + ' days until surgery' : 'Day ' + I.days + ' · Week ' + (Math.floor(I.days / 7) + 1) + ' of recovery') : 'No date set yet')}</div></div></div>
        ${cur ? `<button class="phasebar" data-pseg="progress">${V5.icon('dumbbell', 'pb-ic')}<span><strong>${esc(V5.phaseLabel(I))}</strong><small>${esc(rangeLabel(cur.s.range))}</small></span>${V5.icon('chev', 'chev')}</button>` : ''}</div>
        <div class="segs" role="tablist">${segBtn('ex', 'Exercises')}${segBtn('protocol', 'Protocol')}${segBtn('progress', 'Progress')}</div>`;
      if (seg === 'protocol') html += protocolSeg(d, p);
      else if (seg === 'progress') html += progressSeg(d, p, I);
      else html += exerciseSeg(d, p, I);
      html += setup + browseCard;
    }
    main.innerHTML = html; wireShare(p); V5.wireCode();
    document.getElementById('save').onclick = () => {
      const id = document.getElementById('pp').value, date = document.getElementById('pd').value;
      if (!id) { alert('Choose a protocol first.'); return; }
      const cur = store.get(PLAN_KEY, null);
      // keep care-team details (name, assigned by, add-ons, phone) when only the date changes on the same protocol
      store.set(PLAN_KEY, cur && cur.id === id ? Object.assign({}, cur, { date, sel: null }) : { id, date, sel: null }); plan();
    };
    const clr = document.getElementById('clear');
    if (clr) clr.onclick = () => { if (confirm('Clear your plan and checklist ticks from this device?')) { store.del(PLAN_KEY); store.del(CHECK_KEY); plan(); } };
    main.querySelectorAll('[data-pseg]').forEach(b => b.onclick = () => { sessionStorage.setItem('rehabProto.planseg', b.dataset.pseg); plan(); });
    main.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { const cur = store.get(PLAN_KEY, {}); cur.sel = +b.dataset.sel; store.set(PLAN_KEY, cur); sessionStorage.setItem('rehabProto.planseg', 'ex'); plan(); });
    main.querySelectorAll('input[data-ck]').forEach(cb => cb.onchange = () => {
      const all = store.get(CHECK_KEY, {}); const k = cb.dataset.ck;
      if (cb.checked) all[k] = 1; else delete all[k];
      store.set(CHECK_KEY, all); const row = cb.closest('.check, .exrow'); if (row) row.classList.toggle('done', cb.checked);
    });
  }
  function selSection(d, p) {
    const secs = d.sections || [], hl = matchSections(d, p.date), timed = secs.map((s, i) => ({ s, i })).filter(x => x.s.title);
    const I = V5.planInfo(d, p);
    if (p.sel != null && secs[p.sel]) return p.sel;
    if (I.ci >= 0) return I.ph[I.ci].i;
    return hl.size ? Math.min(...hl) : (timed[0] ? timed[0].i : 0);
  }
  function exRow(key, title, sub, checks, ic, cls) {
    const on = !!checks[key], id = 'ex' + Math.abs(hash(key));
    return `<label class="exrow ${cls || ''} ${on ? 'done' : ''}" for="${id}"><span class="extile">${V5.icon(ic)}</span><span class="exbody"><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span><input type="checkbox" id="${id}" data-ck="${esc(key)}" ${on ? 'checked' : ''} aria-label="Done today: ${esc(title)}"></label>`;
  }
  function exerciseSeg(d, p, I) {
    const day = todayKey(), checks = store.get(CHECK_KEY, {}), secs = d.sections || [];
    let rows = [], heading = 'Your Exercises', sub = '';
    if (d.exercises && d.exercises.length) {
      rows = d.exercises.map((t, j) => exRow(`${d.id}|ex|${j}|${day}`, t, '', checks, 'dumbbell'));
      sub = 'Exercise names as printed in the handout (auto-detected; may be incomplete).';
    } else {
      const sel = selSection(d, p), s = secs[sel];
      if (s) {
        const all = [], ex = []; let week = '', lab = '';
        s.lines.forEach((l, j) => {
          if (!l) return;
          if (l.k === 'label') { if (/^(weeks?|days?|months?)\b/i.test(l.t)) { week = l.t.replace(/:$/, ''); lab = ''; } else lab = l.t; return; }
          const it = { j, t: l.t, week }; all.push(it); if (/exercise|progression/i.test(lab)) ex.push(it);
        });
        const use = ex.length ? ex : all;
        rows = use.map(x => exRow(`${d.id}|${sel}|${x.j}|${day}`, x.t, x.week, checks, 'dumbbell'));
        sub = `${esc(sectionTitle(s, sel))}${ex.length ? ' · exercise items' : ''}. Wording as written in the protocol.`;
      }
    }
    const pt = (p.pt || []).map((x, j) => exRow(`${p.id}|pt|${j}|${day}`, x[0], x[1], checks, 'chat', 'pt'));
    let h = `<div class="cardhead plain"><h3>${heading}</h3></div><p class="note">${rows.length + pt.length} item${rows.length + pt.length === 1 ? '' : 's'} today. ${sub} Ticks reset each day.</p>`;
    if (pt.length) h += `<div class="exlist">${pt.join('')}</div>`;
    h += rows.length ? `<div class="exlist">${rows.join('')}</div>` : '<p class="note">No checklist items were found for this part of the protocol. See the Protocol tab.</p>';
    if (d.page_images && d.page_images.length) h += `<p class="note">This handout includes pictures - <a href="#/p/${d.id}">see the original pages</a>.</p>`;
    return h;
  }
  function protocolSeg(d, p) {
    const secs = d.sections || [], hl = matchSections(d, p.date), sel = selSection(d, p);
    const timed = secs.map((s, i) => ({ s, i })).filter(x => x.s.title);
    let h = `<div class="disclaimer" role="note">${esc(DISCLAIMER)}</div>
      <div class="btns"><a class="btn" href="#/p/${d.id}">Read full protocol</a><a class="btn secondary" href="${esc(d.url)}" target="_blank" rel="noopener">Open original document</a></div>`;
    if (timed.length) h += `<div class="cardhead plain"><h3>Sections of the protocol</h3></div>
      <p class="note">${p.date ? 'Sections whose written weeks include today are marked. Tap one to see its items on the Exercises tab.' : 'Add a date to mark the section that matches your timeline.'}</p>
      <ol class="timeline">${timed.map(x => `<li class="${hl.has(x.i) ? 'hi' : ''} ${x.i === sel ? 'sel' : ''}"><button data-sel="${x.i}" aria-pressed="${x.i === sel}">${esc(x.s.title)}${hl.has(x.i) ? '<span class="badge">Matches your date</span>' : ''}</button></li>`).join('')}</ol>`;
    if (p.extras && p.extras.length) h += `<div class="card"><div class="cardhead"><h3>Also assigned${p.by ? ' by ' + esc(p.by) : ''}</h3></div>${p.extras.map(id => BY_ID[id]).filter(Boolean).map(x => `<a class="minirow" href="#/p/${x.id}">${V5.icon(V5.catIcon(x.category), 'mini-ic')}<span>${esc(x.title)}</span>${V5.icon('chev', 'chev')}</a>`).join('')}</div>`;
    return h + shareBox(p);
  }
  function progressSeg(d, p, I) {
    if (!p.date) return '<div class="card"><p>Add your surgery or start date below (Change my plan) to see your progress and full timeline.</p></div>';
    const checks = store.get(CHECK_KEY, {}), daysSet = new Set();
    Object.keys(checks).forEach(k => { if (k.startsWith(d.id + '|') || k.startsWith(p.id + '|')) daysSet.add(k.split('|').pop()); });
    let h = V5.roadHtml(d, p, I);
    h += `<div class="stats"><div class="stat"><b>${I.days < 0 ? 0 : I.days}</b><small>Days since surgery</small></div><div class="stat"><b>${I.days < 0 ? 0 : Math.floor(I.days / 7) + 1}</b><small>Week of recovery</small></div><div class="stat"><b>${daysSet.size}</b><small>Days with ticks</small></div></div>`;
    return h + fullTimeline(d, p);
  }
  function assign(id, date, who) {
    setTitle('Assigned plan'); navActive('plan'); head('Your Plan');
    const d = BY_ID[id];
    if (!d) { main.innerHTML = '<h1>Plan not found</h1><p>This link does not match a protocol in this version of the app.</p><p><a href="#/">Back to browse</a></p>'; return; }
    main.innerHTML = `<h1>Plan assigned to you${who ? ': ' + esc(who) : ''}</h1>
      <div class="card"><p><strong>${esc(d.title)}</strong></p>${date ? `<p>Surgery or start date: ${esc(date)}</p>` : ''}
      <div class="btns"><button class="btn" id="acc">Save to My plan</button><a class="btn secondary" href="#/p/${encodeURIComponent(d.id)}">View protocol first</a></div></div>
      <p class="note">Saving puts this plan on this device only. Nothing is sent anywhere.</p>`;
    document.getElementById('acc').onclick = () => { store.set(PLAN_KEY, { id: d.id, date, sel: null }); location.hash = '#/plan'; };
  }
  function shareBox(p) {
    if (!p || !BY_ID[p.id]) return '';
    return `<div class="card"><h2>Assign this plan to someone</h2>
      <label class="f" for="who">Name (optional)</label><input class="search" id="who" placeholder="e.g. Jordan">
      <div class="btns"><button class="btn" id="mk">Make assign link</button></div>
      <input class="search" id="lnk" readonly style="display:none;margin-top:8px" aria-label="Assign link">
      <p class="note" id="lnote"></p></div>`;
  }
  function wireShare(p) {
    const mk = document.getElementById('mk'); if (!mk) return;
    mk.onclick = () => {
      const who = document.getElementById('who').value.trim();
      const base = location.href.split('#')[0];
      const url = base + '#/assign/' + encodeURIComponent(p.id) + '/' + encodeURIComponent(p.date || '') + (who ? '/' + encodeURIComponent(who) : '');
      const box = document.getElementById('lnk'); box.style.display = 'block'; box.value = url; box.select();
      const ok = () => { document.getElementById('lnote').textContent = location.protocol === 'file:' ? 'Copied. This link only works on this computer because the app is opened from a file. Once the app is hosted at a web address, the same button makes links your team can open from any phone.' : 'Copied. Text or email this link. When they open it, they tap Save to My plan.'; };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, ok); else { document.execCommand('copy'); ok(); }
    };
  }
  function startDay(r) {
    if (!r) return null; const [u, a] = r;
    if (u === 'day') return a; if (u === 'week') return Math.round(a * 7); if (u === 'week_single') return (a - 1) * 7;
    if (u === 'month') return Math.round(a * 30.44); if (u === 'month_single') return Math.round((a - 1) * 30.44); return null;
  }
  function fmtDate(base, add) { const [y, m, dd] = base.split('-').map(Number); const t = new Date(y, m - 1, dd + add); return t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function rangeLabel(r) {
    if (!r) return ''; const [u, a, b] = r; const nm = { day: 'Days', week: 'Weeks', week_single: 'Week', month: 'Months', month_single: 'Month' }[u] || '';
    return nm + ' ' + a + (b == null ? '+' : (b !== a ? '-' + b : ''));
  }
  function fullTimeline(d, p) {
    if (!p.date) return '';
    const days = daysSince(p.date);
    const secs = (d.sections || []).map((s, i) => ({ s, i })).filter(x => x.s.title && x.s.range && startDay(x.s.range) != null);
    if (!secs.length) return '';
    const isArth = /arthroplasty/i.test(d.title) || d.category === 'Knee/Hip Arthroplasty';
    let items = '';
    if (isArth) {
      const pre = BY_ID['knee-arthroplasty-prehab-exercises-148'];
      items += `<li class="${days < 0 ? 'now' : 'done'}"><span class="st">${days < 0 ? 'NOW' : 'Done'}</span><div class="when">Before surgery</div><div>Prehab exercise program, in the weeks leading up to ${esc(fmtDate(p.date, 0))}.${pre ? ` <a href="#/p/${pre.id}">Open the TKA/THA prehab exercises</a>` : ''}</div></li>`;
    }
    items += `<li class="${days === 0 ? 'now' : (days > 0 ? 'done' : 'upcoming')}"><span class="st">${days === 0 ? 'TODAY' : (days > 0 ? 'Done' : 'Upcoming')}</span><div class="when">Surgery day - ${esc(fmtDate(p.date, 0))}</div><div>Day 0.</div></li>`;
    secs.forEach((x, k) => {
      const a = startDay(x.s.range), next = secs[k + 1] ? startDay(secs[k + 1].s.range) : null;
      const b = next != null && next > a ? next - 1 : null;
      const state = days >= a && (b == null || days <= b) ? 'now' : (b != null && days > b ? 'done' : 'upcoming');
      const label = { now: 'NOW', done: 'Done', upcoming: 'Upcoming' }[state];
      items += `<li class="${state}"><span class="st">${label}</span><div class="when">${esc(sectionTitle(x.s, x.i))}</div>
        <div>${esc(rangeLabel(x.s.range))} &middot; ${esc(fmtDate(p.date, a))}${b != null ? ' to ' + esc(fmtDate(p.date, b)) : ' and after'}</div>
        <details><summary>What the protocol says</summary><div class="secbody">${linesHtml(x.s.lines)}</div></details></li>`;
    });
    return `<h2>Your whole timeline, surgery to full recovery</h2>
      <p class="note">Dates are calculated from your surgery date using the weeks written in the protocol. They are estimates: your surgeon and therapist decide when you move to the next phase.</p><ol class="tl">${items}</ol>`;
  }
  function planBody(d, p) {
    const days = daysSince(p.date);
    const secs = d.sections || [];
    const hl = matchSections(d, p.date);
    const timed = secs.map((s, i) => ({ s, i })).filter(x => x.s.title);
    let sel = (p.sel != null && secs[p.sel]) ? p.sel : (hl.size ? Math.min(...hl) : (timed[0] ? timed[0].i : 0));
    let h = `<h2>${esc(d.title)}</h2><div class="disclaimer" role="note">${esc(DISCLAIMER)}</div>
      <div class="btns"><a class="btn secondary" href="#/p/${d.id}">Read full protocol</a><a class="btn secondary" href="${esc(d.url)}" target="_blank" rel="noopener">Open original document</a></div>`;
    if (p.date) {
      if (days < 0) h += `<p><strong>Your date is ${-days} day${days === -1 ? '' : 's'} from now.</strong></p>`;
      else h += `<p><strong>Today is day ${days} since ${esc(p.date)}</strong> (${Math.floor(days / 7)} full week${Math.floor(days / 7) === 1 ? '' : 's'} + ${days % 7} day${days % 7 === 1 ? '' : 's'}).</p>`;
    }
    h += fullTimeline(d, p);
    if (timed.length) {
      h += `<h2>The document's own headings, in order</h2>
        <p class="note">${p.date ? 'Headings whose written week/day numbers include today are highlighted - so you are probably in that part of the protocol. Many phases also have progress criteria; your surgeon or therapist decides when you move on.' : 'Add a date above to highlight the heading that matches your timeline.'}</p>
        <ol class="timeline">${timed.map(x => `<li class="${hl.has(x.i) ? 'hi' : ''} ${x.i === sel ? 'sel' : ''}"><button data-sel="${x.i}" aria-pressed="${x.i === sel}">${esc(x.s.title)}${hl.has(x.i) ? '<span class="badge">Matches your date</span>' : ''}</button></li>`).join('')}</ol>
        ${p.date && !hl.size && days >= 0 ? '<p class="note">No heading\'s written week numbers matched your date (some phases are criteria-based or have no week numbers). Tap a heading to view it.</p>' : ''}`;
    }
    const day = todayKey(), checks = store.get(CHECK_KEY, {});
    if (d.exercises && d.exercises.length) {
      h += `<h2>Today's checklist</h2><p class="note">Exercise names as printed in the handout (auto-detected; may be incomplete - see the full handout). Ticks reset each day.</p>`;
      h += d.exercises.map((t, j) => ckRow(`${d.id}|ex|${j}|${day}`, t, checks)).join('');
    } else if (secs[sel]) {
      const s = secs[sel];
      h += `<h2>Checklist: ${esc(sectionTitle(s, sel))}</h2><p class="note">Every line of this section, as written. Tick what you completed today; ticks reset each day.</p>`;
      s.lines.forEach((l, j) => {
        if (!l) return;
        if (l.k === 'label') h += `<div class="check-label" style="margin-left:${(l.l || 0) * 0.6}em">${esc(l.t)}</div>`;
        else h += ckRow(`${d.id}|${sel}|${j}|${day}`, l.t, checks, l.l);
      });
    }
    if (d.page_images && d.page_images.length) h += `<p class="note">This document includes pictures - <a href="#/p/${d.id}">see the original pages</a>.</p>`;
    return h;
  }
  function ckRow(key, text, checks, lvl) {
    const on = !!checks[key], id = 'ck' + Math.abs(hash(key));
    return `<div class="check ${on ? 'done' : ''}" style="margin-left:${(lvl || 0) * 0.6}em"><input type="checkbox" id="${id}" data-ck="${esc(key)}" ${on ? 'checked' : ''}><label for="${id}"><span>${esc(text)}</span></label></div>`;
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  function about() {
    setTitle('About'); navActive('about'); head('About Our Program');
    const flagged = DATA.docs.filter(d => (d.issues || []).length).length;
    const count = c => DATA.docs.filter(d => d.category === c).length;
    const cats = BODY_ORDER.filter(c => DATA.categories.includes(c)).concat(DATA.categories.filter(c => !BODY_ORDER.includes(c) && !/return-to-sport/i.test(c)));
    const rts = DATA.categories.find(c => /return-to-sport/i.test(c));
    const row = (ic, title, body) => `<details class="arow"><summary>${V5.icon(ic, 'mini-ic')}<span>${title}</span>${V5.icon('chev', 'chev')}</summary><div class="arow-body">${body}</div></details>`;
    main.innerHTML = `<div class="aboutHero"><div class="ah-logo"><img src="cosmc-logo.png" alt="COSMC" width="220" height="43"></div><h2>Orthopedics &amp; Sports Medicine</h2><p>Dr. Austin Cole's rehab protocols, on your phone, one day at a time.</p></div>
      <div class="card alist">
        ${row('info', 'Program overview', `<p>This app turns the documents linked from Dr. Austin Cole's public protocols page into a phone-friendly plan: a daily checklist, your phase, your Road to Return and your calendar. Text is extracted automatically from each document and lightly formatted. Wording is not rewritten.</p><p>${DATA.docs.length} documents are included; ${flagged} have notes asking you to check the original (pictures, tables or scanned pages). Every protocol page links to its original document.</p>`)}
        ${row('joint', 'Common procedures', cats.map(c => `<a class="minirow" href="#/c/${slug(c)}">${V5.icon(V5.catIcon(c), 'mini-ic')}<span>${esc(c)} <small>${count(c)}</small></span>${V5.icon('chev', 'chev')}</a>`).join(''))}
        ${rts ? `<a class="arow link" href="#/c/${slug(rts)}">${V5.icon('run', 'mini-ic')}<span>Return-to-sport guide <small>${count(rts)} programs</small></span>${V5.icon('chev', 'chev')}</a>` : ''}
        ${row('help', 'FAQs', `<p><strong>Do I need an account?</strong> No. There is no login.</p>
          <p><strong>Where is my plan saved?</strong> Only in this browser on this phone (local storage). Nothing is sent to a server, and there is no tracking.</p>
          <p><strong>How does my care team give me a plan?</strong> They make a link, QR code or short code on the Staff tab. When you open it, you tap Save.</p>
          <p><strong>What personal information is stored?</strong> At most the first name your care team or you typed. No last names, birth dates or medical records.</p>
          <p><strong>Are the dates exact?</strong> No. They are estimates from the weeks written in the protocol. Your surgeon and therapist decide when you move on.</p>
          <p><strong>Can I use it offline?</strong> After the first visit, most of the app works offline. Add it to your home screen from your browser's Share menu.</p>`)}
      </div>
      <div class="disclaimer" role="note">${esc(DISCLAIMER)}</div>
      <div class="card protonote"><strong>Prototype</strong> - not approved by Dr. Cole or Conway Regional.</div>
      <p class="note">Built ${esc(DATA.generated)} from <a href="${esc(DATA.source_page)}" target="_blank" rel="noopener">Dr. Cole's protocols page</a>.</p>`;
  }
  function notFound() { head('Not found'); main.innerHTML = '<div class="card"><p>That page was not found.</p><p><a href="#/">Back to home</a></p></div>'; }

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    if (a === 'p') detail(decodeURIComponent(b));
    else if (a === 'c') category(b);
    else if (a === 'plan') plan();
    else if (a === 'browse') browse();
    else if (a === 'assign') assign(decodeURIComponent(b || ''), decodeURIComponent(h.split('/')[2] || ''), decodeURIComponent(h.split('/')[3] || ''));
    else if (window.V5 && V5.routes[a]) V5.routes[a](...h.split('/').slice(1));
    else if (a === 'about') about();
    else home();
    if (a) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  }

  (window.COLE_DATA ? Promise.resolve(window.COLE_DATA) : fetch('data.json').then(r => r.json())).then(j => {
    DATA = j; DATA.docs.forEach(d => { d._text = docText(d); BY_ID[d.id] = d; });
    if (window.V5) V5.init({ DATA, BY_ID, store, esc, setTitle, navActive, startDay, daysSince, sectionTitle, ckRow, todayKey, linesHtml });
    window.addEventListener('hashchange', route); route();
  }).catch(e => { main.innerHTML = '<p>Could not load data.json. Serve this folder over http (python3 -m http.server).</p>'; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
