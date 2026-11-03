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
  function home() {
    setTitle(''); navActive('home');
    const cats = DATA.categories;
    const count = c => DATA.docs.filter(d => d.category === c).length;
    const body = BODY_ORDER.filter(c => cats.includes(c)).concat(cats.filter(c => !BODY_ORDER.includes(c) && !/home exercise|return-to-sport/i.test(c)));
    const special = cats.filter(c => /home exercise|return-to-sport/i.test(c));
    main.innerHTML = `
      ${window.V5 ? V5.homeTop() : ''}
      <h2>Find a protocol</h2>
      <label for="q" class="note">Search by surgery, injury, sport or exercise</label>
      <input id="q" class="search" type="search" placeholder="e.g. ACL, rotator cuff, baseball" autocomplete="off">
      <div id="results" aria-live="polite"></div>
      <div id="browse">
        <h2>By body area</h2>
        <div class="grid">${body.map(c => tile(c, count(c))).join('')}</div>
        <h2>Programs</h2>
        <div class="grid">${special.map(c => tile(c, count(c))).join('')}</div>
        <p class="count">${DATA.docs.length} documents from Dr. Cole's public protocols page. <a href="${esc(DATA.source_page)}" target="_blank" rel="noopener">Source page</a></p>
      </div>`;
    const q = document.getElementById('q');
    if (window.V5) V5.wireHome();
    q.addEventListener('input', () => search(q.value));
    const saved = sessionStorage.getItem('rehabProto.q'); if (saved) { q.value = saved; search(saved); }
  }
  function tile(c, n) { return `<a class="tile" href="#/c/${slug(c)}"><strong>${esc(c)}</strong><span>${n} document${n === 1 ? '' : 's'}</span></a>`; }

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
    return `<ul class="list">${docs.map(d => `<li><a href="#/p/${d.id}">${esc(d.title)}${showCat ? `<small>${esc(d.category)}</small>` : ''}</a></li>`).join('')}</ul>`;
  }

  function category(s) {
    const c = DATA.categories.find(x => slug(x) === s);
    if (!c) return notFound();
    setTitle(c); navActive('home');
    const docs = DATA.docs.filter(d => d.category === c);
    main.innerHTML = `<p class="crumb"><a href="#/">Browse</a> / ${esc(c)}</p><h1>${esc(c)}</h1>
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
    setTitle(d.title); navActive('home');
    const plan = store.get(PLAN_KEY, null);
    const hl = plan && plan.id === d.id ? matchSections(d, plan.date) : new Set();
    const pages = (d.page_images || []);
    const secs = d.sections || [];
    const split = !!d.split_on;
    main.innerHTML = `
      <p class="crumb"><a href="#/">Browse</a> / <a href="#/c/${slug(d.category)}">${esc(d.category)}</a></p>
      <h1>${esc(d.title)}</h1>
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
    setTitle('My plan'); navActive('plan');
    const p = store.get(PLAN_KEY, null);
    const opts = DATA.categories.map(c => `<optgroup label="${esc(c)}">${DATA.docs.filter(d => d.category === c).map(d => `<option value="${d.id}" ${p && p.id === d.id ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</optgroup>`).join('');
    let html = `<h1>My plan</h1>
      <p class="note">Saved only in this browser on this device. Nothing is sent anywhere.</p>
      <div class="card">
        <label class="f" for="pp">Protocol or program</label>
        <select id="pp"><option value="">Choose...</option>${opts}</select>
        <label class="f" for="pd">Surgery or start date (optional)</label>
        <input type="date" id="pd" value="${p && p.date ? esc(p.date) : ''}">
        <div class="btns"><button class="btn" id="save">Save</button>${p ? '<button class="btn danger" id="clear">Clear my plan</button>' : ''}</div>
      </div>`;
    const d = p && BY_ID[p.id];
    if (d) html += planBody(d, p) + shareBox(p);
    main.innerHTML = html; wireShare(p);
    document.getElementById('save').onclick = () => {
      const id = document.getElementById('pp').value, date = document.getElementById('pd').value;
      if (!id) { alert('Choose a protocol first.'); return; }
      store.set(PLAN_KEY, { id, date, sel: null }); plan();
    };
    const clr = document.getElementById('clear');
    if (clr) clr.onclick = () => { if (confirm('Clear your plan and checklist ticks from this device?')) { store.del(PLAN_KEY); store.del(CHECK_KEY); plan(); } };
    main.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { const cur = store.get(PLAN_KEY, {}); cur.sel = +b.dataset.sel; store.set(PLAN_KEY, cur); plan(); });
    main.querySelectorAll('input[data-ck]').forEach(cb => cb.onchange = () => {
      const all = store.get(CHECK_KEY, {}); const k = cb.dataset.ck;
      if (cb.checked) all[k] = 1; else delete all[k];
      store.set(CHECK_KEY, all); cb.closest('.check').classList.toggle('done', cb.checked);
    });
  }
  function assign(id, date, who) {
    setTitle('Assigned plan'); navActive('plan');
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
    setTitle('About'); navActive('about');
    const flagged = DATA.docs.filter(d => (d.issues || []).length).length;
    main.innerHTML = `<h1>About this prototype</h1>
      <div class="disclaimer">PROTOTYPE - not approved by Dr. Cole or Conway Regional. ${esc(DISCLAIMER)}</div>
      <p>This is a demonstration that turns the documents linked from Dr. Austin Cole's public protocols page into a phone-friendly reference. Text is extracted automatically from each document and lightly formatted (headings and bullets). Wording is not rewritten or summarized.</p>
      <p>${DATA.docs.length} documents are included; ${flagged} have notes asking you to check the original (pictures, tables or scanned pages). Every protocol page links to its original document.</p>
      <p>"My plan" stores your chosen protocol, optional date and checklist ticks only in this browser (localStorage), so it is still there when you come back on the same device. There are no accounts and nothing is sent to a server. Staff and therapists use the Staff page to make a link, QR code or short code that puts a plan on an athlete's own device. That page has no login and stores nothing on a server.</p>
      <p class="note">Built ${esc(DATA.generated)} from <a href="${esc(DATA.source_page)}" target="_blank" rel="noopener">${esc(DATA.source_page)}</a>.</p>`;
  }
  function notFound() { main.innerHTML = '<h1>Not found</h1><p><a href="#/">Back to browse</a></p>'; }

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    if (a === 'p') detail(decodeURIComponent(b));
    else if (a === 'c') category(b);
    else if (a === 'plan') plan();
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
