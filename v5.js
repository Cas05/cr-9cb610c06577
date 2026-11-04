/* v5 features: Today screen, Road to Return, calendar, staff/therapist assigning (links, QR, codes, bundles), calendar reminders. No server; no accounts. */
(function () {
  'use strict';
  const V5 = window.V5 = { routes: {} };
  let R = null;
  const PLAN_KEY = 'rehabProto.plan', CHECK_KEY = 'rehabProto.checks', APPT_KEY = 'rehabProto.appts', SEEN_KEY = 'rehabProto.seen', BUNDLE_KEY = 'rehabProto.bundles', BASE_KEY = 'rehabProto.baseurl', STAFF_KEY = 'rehabProto.staffdefaults';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const keyOf = dt => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parseKey(s));
  const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
  const nice = (k, long) => parseKey(k).toLocaleDateString(undefined, long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  const timeNice = t => { if (!/^\d{2}:\d{2}$/.test(t || '')) return ''; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + ':' + pad(m) + (h < 12 ? ' AM' : ' PM'); };
  const num = id => { const m = /-(\d+)$/.exec(id || ''); return m ? m[1] : null; };
  const docByNum = n => R.DATA.docs.find(d => num(d.id) === String(n));
  const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  const phoneDigits = s => String(s || '').replace(/[^\d+]/g, '').slice(0, 16);
  // COSMC clinic phone (supplied by COSMC). Used whenever an assignment does not override it.
  const CLINIC_PHONE = V5.CLINIC_PHONE = '5013291510', CLINIC_PHONE_TXT = V5.CLINIC_PHONE_TXT = '(501) 329-1510';
  const clinicPh = p => phoneDigits(p && p.phone) || CLINIC_PHONE;
  const fmtPh = d => /^\d{10}$/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
  V5.callBtn = (cls) => `<a class="btn ${cls || ''}" href="tel:${CLINIC_PHONE}">${icon('phone')} Call</a>`;

  V5.init = function (api) { R = api; };

  // ---------- plan math ----------
  function phases(d) {
    const out = [];
    (d.sections || []).forEach((s, i) => { if (s.title && s.range && R.startDay(s.range) != null) out.push({ i, s, a: R.startDay(s.range) }); });
    out.forEach((p, k) => { const next = out[k + 1]; p.b = next && next.a > p.a ? next.a - 1 : null; });
    return out;
  }
  function roadEnd(ph) {
    if (!ph.length) return null;
    const last = ph[ph.length - 1], r = last.s.range, b = r[2];
    if (b != null) { const u = r[0]; if (u === 'day') return b; if (u === 'week') return Math.round((b + 1) * 7) - 1; if (u === 'week_single') return b * 7; if (u === 'month') return Math.round((b + 1) * 30.44) - 1; if (u === 'month_single') return Math.round(b * 30.44); }
    return last.a + 28;
  }
  function curPhase(ph, days) {
    if (days == null || days < 0) return -1;
    let idx = -1; ph.forEach((p, k) => { if (days >= p.a) idx = k; }); return idx;
  }
  function getPlan() { const p = R.store.get(PLAN_KEY, null); return p && R.BY_ID[p.id] ? p : null; }

  // ---------- shared UI helpers (v7) ----------
  const ICONS = {
    joint: '<path d="M8 3c-2 0-3 1.6-2.4 3.2L8.5 11 7 18.5c-.4 1.8.8 2.5 2 2.5s2-.8 2.2-2l1-6.5 2.9-1.6c1.4-.8 1.8-2.6.8-3.8L13 3.6C12.4 3 11.6 3 11 3z"/><circle cx="12.5" cy="7.5" r="1.3"/>',
    run: '<circle cx="14" cy="4.5" r="2"/><path d="M6 21l3.5-5 3 2 1-6 3 3h3M8 11l2.5-3.5 4 .5"/>',
    dumbbell: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5 17 4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M17 4.5a3.5 3.5 0 0 1 0 7M21.5 20c0-2.6-1.6-4.6-4-5.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    arrowl: '<path d="M15 6l-6 6 6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const icon = V5.icon = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.info}</svg>`;
  V5.catIcon = c => /return-to-sport/i.test(c || '') ? 'run' : (/home exercise/i.test(c || '') ? 'dumbbell' : 'joint');
  const setHead = (t, sub, eb) => {
    const h = $('htitle'); if (h) h.textContent = t;
    const s = $('hsub'); if (s) { s.textContent = sub || ''; s.hidden = !sub; }
    const e = $('heyebrow'); if (e) e.textContent = eb || 'Your recovery';
    const av = $('havatar'); if (av) { const p = getPlan(), nm = V5.athleteFirst() || (p && p.name) || '', n = String(nm).trim().charAt(0).toUpperCase(); av.innerHTML = n ? R.esc(n) : icon('user'); av.title = 'Athlete profile'; av.href = '#/athlete'; av.setAttribute('aria-label', 'Athlete profile'); }
  };
  V5.setHead = setHead;
  const shortPh = V5.shortPh = t => {
    let s = String(t || '').replace(/^phase\s*[ivx\d]+\s*[–\-:.]*\s*/i, '').trim();
    if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return s || String(t || '');
  };
  // Road-to-Return steps: the protocol's own "Phase ..." headings (or its timed sections), grouped to at most 5 steps.
  function steps(d, ph, ci) {
    const named = (d.sections || []).map((s, i) => ({ s, i })).filter(x => x.s.title && /^phase\b/i.test(x.s.title));
    const list = named.length >= 2 ? named : ph.map(x => ({ s: x.s, i: x.i }));
    const n = list.length, G = Math.min(5, n), groups = [];
    for (let g = 0; g < G; g++) { const a = Math.floor(g * n / G), b = Math.floor((g + 1) * n / G) - 1; groups.push({ label: shortPh(list[a].s.title), from: list[a].i, to: list[b].i }); }
    let cur = -1;
    if (ci >= 0) { const si = ph[ci].i; groups.forEach((g, k) => { if (si >= g.from) cur = k; }); }
    return { groups, cur };
  }
  V5.planInfo = function (d, p) {
    const days = p.date ? R.daysSince(p.date) : null, ph = phases(d), ci = curPhase(ph, days), end = roadEnd(ph);
    const st = steps(d, ph, ci);
    const pct = end && days != null ? Math.max(0, Math.min(100, Math.round(days / end * 100))) : 0;
    return { days, ph, ci, end, steps: st, pct };
  };
  V5.phaseLabel = (I) => I.ci >= 0 ? `Phase ${I.ci + 1}: ${shortPh(I.ph[I.ci].s.title)}` : '';
  V5.roadHtml = function (d, p, I) {
    if (!I.steps.groups.length) return '';
    const g = I.steps.groups, cur = I.steps.cur, hasPct = !!(I.end && p.date && I.days != null);
    return `<div class="card road">
      <div class="cardhead"><h3>Road to Return</h3>${hasPct ? `<span class="road-pct">${I.pct}%</span>` : ''}</div>
      <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hasPct ? I.pct : 0}" aria-label="Progress through the written timeline"><i style="width:${hasPct ? Math.max(3, I.pct) : 0}%"></i></div>
      <ol class="miles" style="--n:${g.length}">${g.map((x, k) => `<li class="${k < cur ? 'done' : (k === cur ? 'cur' : '')}" title="${R.esc(x.label)}"><span class="mdot">${k < cur ? icon('check') : ''}</span><span class="mlab">Phase ${k + 1}</span></li>`).join('')}</ol>
      <div class="nownext">${cur >= 0 ? `<div><em class="eyebrow-sm">Now</em><span>${R.esc(g[cur].label)}</span></div>` : ''}${g[cur + 1] ? `<div><em class="eyebrow-sm nx">Next</em><span>${R.esc(g[cur + 1].label)}</span></div>` : ''}</div>
      ${I.end && I.days != null && I.days > I.end ? '<p class="note">You are past the end of the written timeline. Your care team decides when you are cleared.</p>' : ''}
    </div>`;
  };
  V5.codeCardHtml = function (title) {
    return `<div class="card codecard" id="codecard"><div class="cardhead"><h3>${title || 'Enter a protocol code'}</h3></div>
      <p class="note">Use the link, QR code or code from your care team. A code looks like CR-44-261001.</p>
      <label class="f" for="code">Protocol code</label>
      <div class="codein"><input class="search" id="code" placeholder="CR-..." autocomplete="off" autocapitalize="characters"><button class="btn" id="usecode">Use code</button></div>
      <p class="note" id="codemsg"></p></div>`;
  };
  V5.wireCode = function () {
    const uc = $('usecode');
    if (uc) uc.onclick = () => {
      const m = /^CR-(\d+)-(\d{2})(\d{2})(\d{2})$/i.exec(($('code').value || '').trim());
      const doc = m && docByNum(m[1]);
      if (!doc) { $('codemsg').textContent = 'That code was not recognized. Check it with your care team, or ask for a link.'; return; }
      const date = `20${m[2]}-${m[3]}-${m[4]}`; if (!validDate(date)) { $('codemsg').textContent = 'That code has an invalid date.'; return; }
      location.hash = '#/a/' + b64e({ v: 1, p: m[1], d: date });
    };
  };
  function allAppts(p) {
    const out = [];
    if (p) (p.appts || []).forEach(a => out.push({ d: a[0], time: a[1], t: a[2] || 'Appointment', kind: 'care' }));
    R.store.get(APPT_KEY, []).forEach((a, i) => out.push({ d: a.d, time: a.time, t: a.t, kind: 'own', i }));
    return out.sort((x, y) => (x.d + (x.time || '')).localeCompare(y.d + (y.time || '')));
  }
  function calModel(p) {
    const own = R.store.get(APPT_KEY, []), d = p && R.BY_ID[p.id], ph = d ? phases(d) : [], end = d ? roadEnd(ph) : null;
    const dayNum = k => p && p.date ? Math.round((parseKey(k) - parseKey(p.date)) / 86400000) : null;
    function events(k) {
      const ev = [];
      if (p && p.date) {
        if (k === p.date) ev.push({ t: 'Surgery day', kind: 'ms' });
        ph.forEach((x, i) => { if (x.a > 0 && addDays(p.date, x.a) === k) ev.push({ t: `Phase ${i + 1} starts: ${shortPh(x.s.title)}`, kind: 'ms' }); });
        (p.appts || []).forEach(a => { if (a[0] === k) ev.push({ t: a[2] || 'Appointment', time: a[1], kind: 'care' }); });
      }
      own.forEach((a, i) => { if (a.d === k) ev.push({ t: a.t, time: a.time, kind: 'own', i }); });
      return ev.sort((x, y) => (x.time || '').localeCompare(y.time || ''));
    }
    const isEx = k => { const n = dayNum(k); return n != null && end != null && n >= 1 && n <= end; };
    const dots = k => { const ev = events(k), o = []; if (isEx(k)) o.push('ex'); if (ev.some(e => e.kind !== 'ms')) o.push('appt'); if (ev.some(e => e.kind === 'ms')) o.push('ms'); return o; };
    return { own, d, ph, end, dayNum, events, isEx, dots };
  }
  const monday = k => { const dt = parseKey(k); return addDays(k, -((dt.getDay() + 6) % 7)); };
  function weekStrip(M, wk, sel, todayK) {
    let c = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(wk, i), dt = parseKey(k);
      c += `<button class="wd ${k === sel ? 'sel' : ''} ${k === todayK ? 'today' : ''}" data-wk="${k}" aria-pressed="${k === sel}" aria-label="${R.esc(nice(k, true))}"><small>${dt.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${dt.getDate()}</b><span class="mdots">${M.dots(k).map(x => `<i class="${x}"></i>`).join('')}</span></button>`;
    }
    return `<div class="week">${c}</div>`;
  }
  const weekTitle = (wk, todayK) => wk === monday(todayK) ? 'This week' : 'Week of ' + parseKey(wk).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const legendHtml = '<div class="legend"><span><i class="ex"></i>Exercise day</span><span><i class="appt"></i>Appointment</span><span><i class="ms"></i>Milestone</span></div>';
  const upLabel = a => (parseKey(a.d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + (a.time ? ' · ' + timeNice(a.time) : '')).toUpperCase();
  V5.nextAppt = p => allAppts(p).find(a => a.d >= keyOf(new Date())) || null;
  V5.apptWhen = a => nice(a.d, true) + (a.time ? ' · ' + timeNice(a.time) : '');

  // ---------- Home top (Today) ----------
  V5.homeTop = function () {
    const p = getPlan();
    const an = V5.athleteFirst();
    if (!p) { setHead(`Welcome, ${an || 'Athlete'}!`, 'Rehab protocols, made simple.', 'COSMC Sports Medicine'); return welcome(); }
    const nm = an || p.name;
    setHead(nm ? `Hello, ${nm}!` : 'Hello, Athlete!', "Here's where you are and what to do today.");
    return todayHtml(p);
  };
  const heroArt = `<svg class="hero-art" viewBox="0 0 220 220" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#fff" stroke-linecap="round">
        <path d="M30 210V90a80 80 0 0 1 160 0v120" stroke-opacity=".10" stroke-width="16"/>
        <path d="M54 210V90a56 56 0 0 1 112 0v120" stroke-opacity=".10" stroke-width="16"/>
        <path d="M18 210V90a92 92 0 0 1 184 0v120M42 210V90a68 68 0 0 1 136 0v120M66 210V90a44 44 0 0 1 88 0v120" stroke-opacity=".28" stroke-width="1.5"/>
        <path d="M18 168h48M154 168h48" stroke-opacity=".5" stroke-width="2" stroke-dasharray="4 5"/>
        <circle cx="110" cy="96" r="30" stroke-opacity=".18" stroke-width="7"/>
        <path d="M110 66a30 30 0 1 1-28.5 39.3" stroke="#bfe8d2" stroke-width="7"/>
        <path d="M99 96l8 8 15-17" stroke-width="5" stroke-linejoin="round"/>
      </g></svg>`;
  function welcome() {
    const team = ['Dr. Austin Cole'].concat(CARE_TEAM.map(m => m.name));
    const step = (n, t, s, x) => `<li><span class="stepn">${n}</span><div><strong>${t}</strong><small>${s}</small>${x || ''}</div></li>`;
    const preview = `<div class="roadprev" aria-label="Preview of Road to Return"><div class="rp-track"><span></span></div><ol>${[1, 2, 3, 4, 5].map(k => `<li class="${k === 1 ? 'cur' : ''}"><i></i>Phase ${k}</li>`).join('')}</ol></div>`;
    const feat = (ic, t, s) => `<div class="feat"><span class="feat-ic">${icon(ic)}</span><strong>${t}</strong><small>${s}</small></div>`;
    return `<section class="summary hero-empty">${heroArt}
        <div class="sum-eyebrow">COSMC Sports Medicine</div>
        <h2>Your comeback<br>starts here.</h2>
        <p>Follow your protocol one day at a time. See your phase, what to do today and what's next.</p>
        <div class="sum-actions"><button class="sum-btn" id="gocode">Enter plan code</button><a class="sum-link" href="#/plan">Build my own plan ${icon('chev')}</a></div>
      </section>
      ${V5.codeCardHtml('Enter plan code')}
      <div class="card"><div class="cardhead"><h3>How it works</h3></div>
        <ol class="howto">
          ${step(1, 'Get your code', 'Your care team gives you a link, QR code or plan code.')}
          ${step(2, 'Enter it', 'Type the code above or open the link. Your plan saves to this phone.')}
          ${step(3, 'Follow your daily plan', 'Check off today\'s exercises and watch your Road to Return fill up.', preview)}
        </ol></div>
      <h2 class="sect">What you'll get</h2>
      <div class="feats">
        ${feat('check', 'Daily checklist', "Today's exercises from your protocol.")}
        ${feat('flag', 'Road to Return', 'Where you are and what phase is next.')}
        ${feat('cal', 'Calendar reminders', 'Add exercise days and visits to your phone calendar.')}
        ${feat('phone', 'When to call us', 'Clear signs to contact your care team.')}
      </div>
      <div class="card ownplan"><div class="cardhead"><h3>No code yet?</h3></div>
        <p>Pick your protocol and surgery date yourself. You can switch to your care team's plan any time.</p>
        <div class="btns"><a class="btn" href="#/plan">Build my own plan</a><button class="btn secondary" id="demo">Try a demo plan</button></div></div>
      <div class="quicklinks">
        <a class="card linkrow" href="#/protocols">${icon('book', 'tile-ic')}<span><strong>Protocols</strong><small>Search or browse surgery recovery protocols</small></span>${icon('chev', 'chev')}</a>
        <a class="card linkrow" href="#/staff">${icon('team', 'tile-ic')}<span><strong>Care team</strong><small>${R.esc(team.join(', '))}</small></span>${icon('chev', 'chev')}</a>
      </div>
      ${callUsHtml(null)}${window.V13 ? V13.missingHtml() : ''}${DISC_MINI}`;
  }
  function todayHtml(p) {
    const d = R.BY_ID[p.id], I = V5.planInfo(d, p), days = I.days, ph = I.ph, ci = I.ci;
    const by = p.by ? R.esc(p.by) : '';
    const seen = R.store.get(SEEN_KEY, {});
    const unlocked = p.date && ci >= 0 && ci > (seen[p.id + '|' + p.date] ?? -1) && days > 0;
    const eyebrow = !p.date ? 'No surgery date yet' : (days < 0 ? `${-days} day${days === -1 ? '' : 's'} until surgery` : `Day ${days} · Week ${Math.floor(days / 7) + 1} of recovery`);
    const pct = p.date && I.end && days >= 0 ? `<div class="sum-pct"><b>${I.pct}%</b><small>of the written timeline</small></div>` : '';
    let h = `<section class="summary">${p.demo ? '<span class="demo-tag">Demo plan</span>' : ''}
      <div class="sum-top"><div class="sum-main"><div class="sum-eyebrow">${eyebrow}</div>
        <h2>${R.esc(ci >= 0 ? V5.phaseLabel(I) : d.title)}</h2>
        <p>${ci >= 0 ? R.esc(d.title) + ' · ' : ''}${by ? 'Assigned by ' + by : 'Your rehab protocol'}</p></div>${pct}</div>
      <div class="sum-actions">${unlocked ? `<button class="sum-pill" id="seen" data-ci="${ci}" aria-label="New phase unlocked. Dismiss">${icon('plus')} New phase unlocked</button>` : ''}<a class="sum-link" href="#/p/${d.id}">View full protocol ${icon('chev')}</a></div>
    </section>`;
    if (!p.date) return h + `<div class="card"><p>Add your surgery or start date on <a href="#/plan">My plan</a> to see your timeline.</p></div>` + extrasHtml(p) + apptRow(p) + contactHtml(p);
    h += V5.roadHtml(d, p, I);
    h += `<div class="card weekcard" id="homeweek"></div>`;
    if (days < 0) {
      const pre = R.BY_ID['knee-arthroplasty-prehab-exercises-148'];
      h += `<div class="card"><div class="cardhead"><h3>Before surgery</h3></div><p>${-days} day${days === -1 ? '' : 's'} to go (${R.esc(nice(p.date))}).</p>${pre && /arthroplasty/i.test(d.title) ? `<p><a href="#/p/${pre.id}">Open your prehab exercises</a></p>` : ''}</div>`;
    } else if (ci >= 0) {
      const s = ph[ci].s, day = R.todayKey(), checks = R.store.get(CHECK_KEY, {}); let rows = '', n = 0, done = 0;
      const F = focusItems(s, days);
      F.items.forEach(x => { const key = `${d.id}|today|${ph[ci].i}|${x.j}|${day}`; n++; if (checks[key]) done++; rows += R.ckRow(key, x.t, checks, 0); });
      h += `<div class="card focus"><div class="cardhead"><h3>Today's focus</h3><span class="badge-soft" id="tcount">${done}/${n} done</span></div>${F.label ? `<div class="eyebrow-sm">${R.esc(F.label)}</div>` : ''}<div class="boxlist">${rows}</div><p class="note">${F.partial ? 'Exercise items from your protocol for this week. <a href="#/plan">See the whole phase</a>.' : 'From your protocol\'s current phase.'} Ticks reset each day.</p></div>`;
    }
    h += extrasHtml(p) + apptRow(p) + contactHtml(p);
    if (days >= 0) h += `<button class="btn outline block" id="skip">${icon('pause')} It hurts - skip today</button><div id="skipmsg"></div>`;
    h += DISC_MINI + `<p class="note center">Not your plan? <a href="#/plan">Change or clear it on My plan</a>.</p>`;
    return h;
  }
  // Today's Focus: the exercise items of the week block that contains today (as written), falling back to the whole phase.
  function focusItems(s, days) {
    const blocks = []; let cur = { label: '', from: null, to: null, items: [], ex: [] }, lab = '';
    blocks.push(cur);
    s.lines.forEach((l, j) => {
      if (!l) return;
      if (l.k === 'label') {
        const m = /^(weeks?|days?)\s*(\d+)\s*(?:to|-|–)\s*(\d+)/i.exec(l.t);
        if (m) { const f = /^day/i.test(m[1]) ? 1 : 7; cur = { label: l.t.replace(/:$/, ''), from: +m[2] * f, to: +m[3] * f, items: [], ex: [] }; blocks.push(cur); lab = ''; }
        else lab = l.t;
        return;
      }
      const it = { j, t: l.t }; cur.items.push(it); if (/exercise|progression/i.test(lab)) cur.ex.push(it);
    });
    const timed = blocks.filter(b => b.from != null);
    let pick = null;
    timed.forEach(b => { if (days >= b.from && days <= b.to) pick = b; });
    if (pick && (pick.ex.length || pick.items.length)) return { label: pick.label, items: pick.ex.length ? pick.ex : pick.items, partial: true };
    const all = [].concat(...blocks.map(b => b.items)), ex = [].concat(...blocks.map(b => b.ex));
    return { label: '', items: ex.length ? ex : all, partial: !!ex.length };
  }
  function apptRow(p) {
    const a = V5.nextAppt(p);
    return `<a class="card uprow" href="#/calendar"><span class="up-ic">${icon('cal')}</span><span><em class="eyebrow-sm">${a ? R.esc(upLabel(a)) : 'Coming up'}</em><strong>${a ? R.esc(a.t) : 'No appointments yet'}</strong><small>${a ? (a.kind === 'care' ? 'From your care team' : 'Added by you') : 'Appointments from your care team show here'}</small></span>${icon('chev', 'chev')}</a>`;
  }
  function extrasHtml(p) {
    let h = '';
    const by = p.by ? R.esc(p.by) : 'your care team';
    if (p.pt && p.pt.length) {
      const checks = R.store.get(CHECK_KEY, {}), day = R.todayKey();
      h += `<div class="card guide"><div class="cardhead"><h3>From ${by}</h3><span class="badge-soft">${icon('chat')} Care team</span></div><div class="boxlist">${p.pt.map((x, j) => `<div class="ptitem">${R.ckRow(`${p.id}|pt|${j}|${day}`, x[0], checks)}${x[1] ? `<div class="ptnote">${R.esc(x[1])}</div>` : ''}</div>`).join('')}</div></div>`;
    }
    if (p.extras && p.extras.length) h += `<div class="card"><div class="cardhead"><h3>Also assigned by ${by}</h3></div>${p.extras.map(id => R.BY_ID[id]).filter(Boolean).map(x => `<a class="minirow" href="#/p/${x.id}">${icon(V5.catIcon(x.category), 'mini-ic')}<span>${R.esc(x.title)}</span>${icon('chev', 'chev')}</a>`).join('')}</div>`;
    return h;
  }
  V5.extrasHtml = extrasHtml;
  const callUsHtml = V5.callUsHtml = (p) => {
    const ph = clinicPh(p);
    return `<div class="card callus"><span class="cu-ic">${icon('phone')}</span><div class="cu-body"><strong>Questions or problems? Call us</strong>
      <p>${p && p.callnote ? R.esc(p.callnote) : "If something feels wrong, call your care team."}</p></div>
      <a class="btn sm" href="tel:${R.esc(ph)}">Call</a></div>`;
  };
  const DISC_MINI = V5.DISC_MINI = `<p class="disc-mini">For education only. Not a substitute for medical advice from your care team. In an emergency, call 911.</p>`;
  function contactHtml(p) { return callUsHtml(p); }
  V5.wireHome = function () {
    V5.wireCode();
    const dm = $('demo'); if (dm) dm.onclick = loadDemo;
    const gc = $('gocode'); if (gc) gc.onclick = () => { const c = $('codecard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = $('code'); if (inp) inp.focus({ preventScroll: true }); };
    const p = getPlan();
    if (!p) return;
    const hw = $('homeweek');
    if (hw) {
      const M = calModel(p), t = keyOf(new Date()); let wk = monday(t);
      const draw = () => {
        hw.innerHTML = `<div class="cardhead"><h3>${R.esc(weekTitle(wk, t))}</h3><span class="arrows"><button class="iconbtn" data-w="-7" aria-label="Previous week">${icon('arrowl')}</button><button class="iconbtn" data-w="7" aria-label="Next week">${icon('chev')}</button></span></div>${weekStrip(M, wk, t, t)}`;
        hw.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { wk = addDays(wk, +b.dataset.w); draw(); });
        hw.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { sessionStorage.setItem('rehabProto.calsel', b.dataset.wk); location.hash = '#/calendar'; });
      };
      draw();
    }
    const sn = $('seen'); if (sn) sn.onclick = () => { const s = R.store.get(SEEN_KEY, {}); s[p.id + '|' + p.date] = +sn.dataset.ci; R.store.set(SEEN_KEY, s); sn.remove(); };
    const sk = $('skip'); if (sk) sk.onclick = () => { const ph = clinicPh(p); $('skipmsg').innerHTML = `<div class="disclaimer">Skipping today is okay. Do not push through pain. If it keeps hurting, contact your care team.${ph ? ` <a href="tel:${R.esc(ph)}">Call the office</a>` : ''}</div>`; };
    main().querySelectorAll('input[data-ck]').forEach(cb => cb.onchange = () => {
      const all = R.store.get(CHECK_KEY, {}); const k = cb.dataset.ck; if (cb.checked) all[k] = 1; else delete all[k];
      R.store.set(CHECK_KEY, all); cb.closest('.check').classList.toggle('done', cb.checked);
      const t = $('tcount'); if (t) { const boxes = [...main().querySelectorAll('input[data-ck*="|today|"]')]; t.textContent = `${boxes.filter(b => b.checked).length}/${boxes.length} done`; }
    });
  };
  const main = () => document.getElementById('main');
  // Demo plan: fictional, clearly labeled, no phone number. Removed with "Reset" on About or "Clear my plan".
  function loadDemo() {
    const doc = R.BY_ID['acl-reconstruction-44'] || R.DATA.docs.find(x => phases(x).length >= 3);
    const t = keyOf(new Date());
    R.store.set(PLAN_KEY, { id: doc.id, date: addDays(t, -36), sel: null, name: '', by: 'Demo care team', demo: true, extras: [], pt: [['Demo item from your care team', 'Fictional example: instructions your therapist adds show here.']], appts: [[addDays(t, 2), '15:30', 'Demo: therapy visit']], phone: '', callnote: '' });
    if (location.hash === '' || location.hash === '#/' || location.hash === '#') R.route(); else location.hash = '#/';
  }
  V5.loadDemo = loadDemo;

  // ---------- ICS ----------
  const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const compact = k => k.replace(/-/g, '');
  function downloadIcs(p) {
    const d = R.BY_ID[p.id], ph = phases(d), end = roadEnd(ph), L = [];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    let n = 0;
    const allDay = (k, title) => { L.push('BEGIN:VEVENT', `UID:rpc-${compact(p.date)}-${n++}@rehab-proto`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(k)}`, `DTEND;VALUE=DATE:${compact(addDays(k, 1))}`, `SUMMARY:${icsEsc(title)}`, 'END:VEVENT'); };
    allDay(p.date, 'Surgery day');
    ph.forEach((x, k) => { if (x.a > 0) allDay(addDays(p.date, x.a), `Phase ${k + 1} starts: ${R.sectionTitle(x.s, x.i)}`); });
    (p.appts || []).forEach(a => { if (validDate(a[0])) { if (/^\d{2}:\d{2}$/.test(a[1] || '')) { L.push('BEGIN:VEVENT', `UID:rpc-${compact(p.date)}-${n++}@rehab-proto`, `DTSTAMP:${stamp}`, `DTSTART:${compact(a[0])}T${a[1].replace(':', '')}00`, `DTEND:${compact(a[0])}T${a[1].replace(':', '')}00`, `SUMMARY:${icsEsc(a[2] || 'Appointment')}`, 'END:VEVENT'); } else allDay(a[0], a[2] || 'Appointment'); } });
    if ($('icsdaily') && $('icsdaily').checked && end) {
      const t = ($('icstime').value || '08:00').replace(':', ''), start = addDays(p.date, 1), until = compact(addDays(p.date, end));
      L.push('BEGIN:VEVENT', `UID:rpc-${compact(p.date)}-daily@rehab-proto`, `DTSTAMP:${stamp}`, `DTSTART:${compact(start)}T${t}00`, `DTEND:${compact(start)}T${t}00`, `RRULE:FREQ=DAILY;UNTIL=${until}T235959`, `SUMMARY:${icsEsc('Rehab exercises: ' + d.title)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('Time for your rehab exercises')}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rehab Protocol Companion//EN', 'CALSCALE:GREGORIAN', ...L, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = 'my-rehab-plan.ics'; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Calendar (v7: month grid + segments) ----------
  V5.routes.calendar = function () {
    R.setTitle('Calendar'); R.navActive('calendar'); setHead('Recovery calendar', 'Your phases, appointments and exercise days.');
    const p = getPlan(), todayK = keyOf(new Date());
    let sel = sessionStorage.getItem('rehabProto.calsel') || todayK;
    if (!validDate(sel)) sel = todayK;
    let view = sessionStorage.getItem('rehabProto.calview') || 'week';
    const M = calModel(p), own = M.own, ph = M.ph;
    function upcoming(limit) {
      const out = []; let k = todayK;
      for (let i = 0; i < 400 && out.length < limit; i++, k = addDays(k, 1)) M.events(k).forEach(e => out.push(Object.assign({ d: k }, e)));
      return out.slice(0, limit);
    }
    function weekGoals() {
      if (!p || !p.date || M.end == null) return '';
      const checks = R.store.get(CHECK_KEY, {}), wk = monday(todayK), daysT = new Set(); let todayN = 0;
      Object.keys(checks).forEach(k => { if (!(k.startsWith(p.id + '|'))) return; const dk = k.split('|').pop(); if (dk >= wk && dk <= addDays(wk, 6)) daysT.add(dk); if (dk === todayK) todayN++; });
      return `<div class="card"><div class="cardhead"><h3>Weekly goals</h3></div>
        <p>Do the exercises your protocol lists for this phase, as tolerated, and follow your care team's instructions.</p>
        <div class="chips"><span class="badge-soft">${daysT.size} of 7 days ticked this week</span><span class="badge-soft">${todayN} item${todayN === 1 ? '' : 's'} ticked today</span></div>
        <div class="btns"><a class="btn sm" href="#/">Open today's focus</a></div></div>`;
    }
    function draw() {
      const base = parseKey(sel), first = new Date(base.getFullYear(), base.getMonth(), 1), last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      let cal;
      if (view === 'month') {
        let cells = '';
        for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells += '<span class="mc empty"></span>';
        for (let n = 1; n <= last.getDate(); n++) {
          const k = keyOf(new Date(base.getFullYear(), base.getMonth(), n));
          cells += `<button class="mc ${k === sel ? 'sel' : ''} ${k === todayK ? 'today' : ''}" data-k="${k}" aria-label="${R.esc(nice(k, true))}"><span class="mn">${n}</span><span class="mdots">${M.dots(k).map(c => `<i class="${c}"></i>`).join('')}</span></button>`;
        }
        cal = `<div class="cardhead"><h3>${R.esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</h3><span class="arrows"><button class="iconbtn" id="pm" aria-label="Previous month">${icon('arrowl')}</button><button class="iconbtn" id="nm" aria-label="Next month">${icon('chev')}</button></span></div>
          <div class="mgrid mdow">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span>${x}</span>`).join('')}</div><div class="mgrid">${cells}</div>`;
      } else {
        const wk = monday(sel);
        cal = `<div class="cardhead"><h3>${R.esc(weekTitle(wk, todayK))}</h3><span class="arrows"><button class="iconbtn" id="pm" aria-label="Previous week">${icon('arrowl')}</button><button class="iconbtn" id="nm" aria-label="Next week">${icon('chev')}</button></span></div>${weekStrip(M, wk, sel, todayK)}`;
      }
      const dn = M.dayNum(sel), ci = dn != null ? curPhase(ph, dn) : -1, ev = M.events(sel);
      let dayCard = `<div class="card"><div class="eyebrow-sm">${R.esc(nice(sel, true).toUpperCase())}${sel === todayK ? ' · TODAY' : ''}</div>
        ${dn != null ? `<h3 class="dayh">${dn < 0 ? -dn + ' day' + (dn === -1 ? '' : 's') + ' before surgery' : 'Day ' + dn + ' after surgery'}</h3>${ci >= 0 ? `<p class="note">Phase ${ci + 1}: ${R.esc(shortPh(ph[ci].s.title))}</p>` : ''}` : '<p class="note">Add a surgery date on <a href="#/plan">My plan</a> to see your exercise days and phases.</p>'}
        ${M.isEx(sel) ? `<div class="ev ex"><div><strong>Recovery exercises</strong><div class="note">Your assigned checklist</div></div><a class="btn sm secondary" href="${sel === todayK ? '#/' : '#/plan'}">Open</a></div>` : ''}
        ${ev.map(e => `<div class="ev ${e.kind}"><div><strong>${R.esc(e.t)}</strong>${e.time ? ` <span class="note">${R.esc(timeNice(e.time))}</span>` : ''}<div class="note">${e.kind === 'care' ? 'From your care team' : (e.kind === 'own' ? 'Added by you' : 'Milestone')}</div></div>${e.kind === 'own' ? `<button class="btn danger sm" data-del="${e.i}">Remove</button>` : ''}</div>`).join('')}
        ${!ev.length && !M.isEx(sel) ? '<p class="note">Nothing scheduled.</p>' : ''}
        <details class="addappt"><summary>+ Add your own appointment</summary>
          <input class="search" id="at" placeholder="e.g. Therapy visit" maxlength="60" aria-label="Appointment name"><label class="f" for="atm">Time (optional)</label><input type="time" id="atm">
          <div class="btns"><button class="btn" id="aadd">Add to ${R.esc(nice(sel))}</button></div><p class="note">Saved only on this device.</p></details></div>`;
      const up = upcoming(6), endK = p && p.date && M.end ? addDays(p.date, M.end) : null;
      const daily = endK && todayK <= endK && todayK >= addDays(p.date, 1) ? `<a class="up" href="#/"><em class="eyebrow-sm">EVERY DAY</em><strong>Recovery exercises</strong><small>Your assigned checklist, through ${R.esc(nice(endK))} (estimate)</small></a>` : '';
      main().innerHTML = `
        <div class="card calcard">
          <div class="viewtog" role="tablist"><button role="tab" data-view="week" class="${view === 'week' ? 'on' : ''}" aria-selected="${view === 'week'}">Week</button><button role="tab" data-view="month" class="${view === 'month' ? 'on' : ''}" aria-selected="${view === 'month'}">Month</button></div>
          ${cal}${legendHtml}
          ${sel !== todayK ? '<div class="btns center"><button class="btn sm secondary" id="atoday">Back to today</button></div>' : ''}
        </div>
        ${dayCard}
        <div class="card"><div class="cardhead"><h3>Upcoming</h3></div>
          ${daily}${up.map(e => `<button class="up" data-k="${e.d}"><em class="eyebrow-sm ${e.kind}">${R.esc(upLabel(e))}</em><strong>${R.esc(e.t)}</strong><small>${e.kind === 'care' ? 'From your care team' : (e.kind === 'own' ? 'Added by you' : 'Milestone from your protocol (estimate)')}</small></button>`).join('')}
          ${!up.length && !daily ? '<p class="note">Nothing coming up. Appointments from your care team, and ones you add, show here.</p>' : ''}
        </div>
        ${weekGoals()}
        ${p && p.date ? `<div class="card"><div class="cardhead"><h3>Add to my phone's calendar</h3></div>
          <p class="note">Downloads a calendar file with your surgery day, the start of each phase and appointments from your care team. Open it on your phone and tap Add. It stays on your phone.</p>
          <label class="check"><input type="checkbox" id="icsdaily" checked> <span>Also add a daily exercise reminder at</span></label>
          <input type="time" id="icstime" value="08:00" aria-label="Reminder time">
          <div class="btns"><button class="btn" id="icsbtn">Download calendar file</button></div></div>` : ''}`;
      const go = k => { sel = k; sessionStorage.setItem('rehabProto.calsel', sel); draw(); };
      main().querySelectorAll('[data-k],[data-wk]').forEach(b => b.onclick = () => { go(b.dataset.k || b.dataset.wk); if (b.classList.contains('up')) window.scrollTo({ top: 0, behavior: 'smooth' }); });
      main().querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; sessionStorage.setItem('rehabProto.calview', view); draw(); });
      const step = n => view === 'month' ? go(keyOf(new Date(base.getFullYear(), base.getMonth() + n, 1))) : go(addDays(sel, 7 * n));
      $('pm').onclick = () => step(-1); $('nm').onclick = () => step(1);
      const at = $('atoday'); if (at) at.onclick = () => go(todayK);
      const aa = $('aadd'); if (aa) aa.onclick = () => { const t = $('at').value.trim(); if (!t) { alert('Type a name for the appointment.'); return; } own.push({ d: sel, t: cut(t, 60), time: $('atm').value || '' }); R.store.set(APPT_KEY, own); draw(); };
      main().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { own.splice(+b.dataset.del, 1); R.store.set(APPT_KEY, own); draw(); });
      const ib = $('icsbtn'); if (ib) ib.onclick = () => downloadIcs(p);
    }
    draw();
  };

  // ---------- Receive an assignment ----------
  V5.routes.a = function (payload) {
    R.setTitle('Assigned plan'); R.navActive('home'); setHead('Your plan is ready', 'Check it, then save it to this phone.');
    let o; try { o = b64d(payload); } catch (e) { o = null; }
    const doc = o && docByNum(o.p);
    if (!doc || !validDate(o.d)) { main().innerHTML = '<h1>Link not recognized</h1><p>This link or code does not match a plan in this version of the app. Ask your care team for a new one.</p><p><a href="#/">Back to home</a></p>'; return; }
    const plan = { id: doc.id, date: o.d, sel: null, name: cut(o.n, 40), by: cut(o.by, 50), extras: (o.x || []).slice(0, 20).map(docByNum).filter(Boolean).map(x => x.id), pt: (o.t || []).slice(0, 10).map(t => [cut(t[0], 80), cut(t[1], 400)]).filter(t => t[0]), appts: (o.a || []).slice(0, 10).filter(a => validDate(a[0])).map(a => [a[0], /^\d{2}:\d{2}$/.test(a[1] || '') ? a[1] : '', cut(a[2], 60)]), phone: phoneDigits(o.ph), callnote: cut(o.c, 400) };
    const by = plan.by ? R.esc(plan.by) : 'your care team';
    const tam = window.V13 && V13.checkOk(o) === false;
    main().innerHTML = `${tam ? V13.TAMPER : ''}<section class="summary"><div class="sum-eyebrow">New plan${plan.name ? ' for ' + R.esc(plan.name) : ''}</div><h2>${R.esc(doc.title)}</h2><p>Assigned by ${by}</p></section>
      <div class="card"><p>Surgery or start date: <strong>${R.esc(nice(plan.d || plan.date, true))}</strong></p>
      ${plan.extras.length ? `<p>Also: ${plan.extras.map(id => R.esc(R.BY_ID[id].title)).join(', ')}</p>` : ''}
      ${plan.pt.length ? `<p>${plan.pt.length} extra item${plan.pt.length === 1 ? '' : 's'} from ${by}</p>` : ''}
      ${plan.appts.length ? `<p>${plan.appts.length} appointment${plan.appts.length === 1 ? '' : 's'} on your calendar</p>` : ''}
      <div class="btns"><button class="btn" id="acc">Save to my phone</button><a class="btn secondary" href="#/p/${encodeURIComponent(doc.id)}">View protocol first</a></div></div>
      <p class="note">Saving puts this plan on this device only. Nothing is sent anywhere.</p>`;
    $('acc').onclick = () => { const cur = R.store.get(PLAN_KEY, null); if (cur && (cur.id !== plan.id || cur.date !== plan.date) && !confirm('Replace the plan already saved on this device?')) return; R.store.set(PLAN_KEY, plan); location.hash = '#/'; };
  };

  // ---------- Care team (athlete-facing; only people we actually know) ----------
  // COSMC Sports Medicine care team shown on the Staff tab. Add a role later, e.g. { name: 'Sloane', role: '...' }.
  const CARE_TEAM = V5.CARE_TEAM = [
    { name: 'Dr. Tom Roberts', role: 'Orthopedic and Sports Medicine Physician' },
    { name: 'Sloane Precure', role: 'Physician Assistant' },
    { name: 'Melanie', role: 'Sports Medicine Nurse Navigator' },
    { name: 'Emily', role: 'Direct Assist' }
  ];
  const teamInitial = n => String(n).replace(/^dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  function careTeamHtml() {
    const p = getPlan(), ph = clinicPh(p);
    const initials = s => String(s).replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    let h = `<div class="card person-card"><div class="person"><span class="avatar">AC</span><span><strong>Dr. Austin Cole, MD</strong><small>Orthopedic and Sports Medicine Surgeon</small></span></div></div>`;
    h += `<div class="card"><div class="cardhead"><h3>COSMC Sports Medicine care team</h3></div>
      <ul class="teamlist">${CARE_TEAM.map(m => `<li><span class="avatar sm">${R.esc(teamInitial(m.name))}</span><span><strong>${R.esc(m.name)}</strong><small>${R.esc(m.role || 'COSMC Sports Medicine care team')}</small></span></li>`).join('')}</ul></div>`;
    if (p && p.by) h += `<div class="card person-card"><div class="person"><span class="avatar alt">${R.esc(initials(p.by))}</span><span><strong>${R.esc(p.by)}</strong><small>Assigned your plan</small></span></div>
      ${(p.pt || []).length ? `<div class="guide-chips">${p.pt.map(x => `<span class="gchip">${icon('chat')} ${R.esc(x[0])}</span>`).join('')}</div>` : ''}</div>`;
    h += `<div class="card"><div class="cardhead"><h3>Questions about your recovery?</h3></div>
      <p>For questions about pain, exercise restrictions or changes in symptoms, call the clinic.</p>
      ${p && p.callnote ? `<p class="note"><strong>From your care team:</strong> ${R.esc(p.callnote)}</p>` : ''}
      <a class="btn block" href="tel:${R.esc(ph)}">${icon('phone')} Call</a>
      <p class="sos">${icon('alert')} Emergency? Call 911.</p></div>`;
    return h;
  }

  // ---------- Staff tool ----------
  // ---------- Athlete profile (saved on this device only) ----------
  const ATH_KEY = 'rehabProto.athlete';
  const ATH_OK = ['name', 'school', 'about', 'sport', 'position'];
  const getAth = V5.getAthlete = () => { const a = R.store.get(ATH_KEY, null), o = {}; if (a && typeof a === 'object') ATH_OK.forEach(k => { if (a[k]) o[k] = String(a[k]); }); return o; }; // older saved fields (jersey, injury, ...) are ignored
  V5.athleteFirst = () => String(getAth().name || '').trim().split(/\s+/)[0].slice(0, 30);
  const ATH_FIELDS = [
    ['name', 'First name', 'text', 'e.g. Jordan', 30],
    ['school', 'School (optional)', 'text', 'e.g. Conway High School', 60],
    ['about', 'About you (optional)', 'textarea', 'e.g. grade, goals, anything you want to share', 200],
    ['sport', 'Sport', 'text', 'e.g. Soccer', 40],
    ['position', 'Position (optional)', 'text', 'e.g. Midfielder', 40]
  ];
  V5.routes.athlete = function () {
    R.navActive('athlete'); R.setTitle('Athlete');
    const a = getAth(), f = V5.athleteFirst();
    setHead(f ? `${f}'s profile` : 'Athlete profile', 'Your info.', 'Athlete');
    const field = ([k, label, type, ph, max]) => {
      const v = R.esc(a[k] || '');
      const ctl = type === 'select' ? `<select id="ath-${k}" autocomplete="off">${ph.map(o => `<option value="${o}" ${String(a[k] || '') === o ? 'selected' : ''}>${o || 'Choose...'}</option>`).join('')}</select>`
        : type === 'textarea' ? `<textarea class="search" id="ath-${k}" maxlength="${max}" rows="2" placeholder="${R.esc(ph)}">${v}</textarea>`
        : `<input class="search" id="ath-${k}" type="${type}" ${type === 'number' ? 'min="5" max="99" inputmode="numeric"' : ''} ${max ? `maxlength="${max}"` : ''} placeholder="${R.esc(ph)}" value="${v}" autocomplete="off">`;
      return `<div class="af af-${k}"><label class="f" for="ath-${k}">${label}</label>${ctl}</div>`;
    };
    const grp = (title, keys) => `<div class="card"><div class="cardhead"><h3>${title}</h3></div><div class="afgrid">${ATH_FIELDS.filter(x => keys.includes(x[0])).map(field).join('')}</div></div>`;
    main().innerHTML = `<section class="summary athero"><div class="sum-top"><div class="sum-main"><div class="sum-eyebrow">COSMC Sports Medicine athlete</div>
        <h2>${f ? R.esc(f) : 'Your profile'}</h2><p>${[a.sport, a.position, a.school].filter(Boolean).map(R.esc).join(' · ') || 'Add your name and sport so your app feels like yours.'}</p></div>
        <div class="weektile"><small>Athlete</small><b>${f ? R.esc(f.charAt(0).toUpperCase()) : icon('user')}</b></div></div></section>
      ${grp('About you', ['name', 'school', 'about'])}
      ${grp('Sport', ['sport', 'position'])}
      <p class="disc-mini">First name only. Please no last names, birth dates or medical details. Saved on this device only.</p>
      <div class="btns"><button class="btn" id="athsave">Save profile</button><button class="btn danger" id="athclear">Clear profile</button></div>
      <p class="note" id="athmsg" aria-live="polite"></p>${window.V13 ? V13.saveCardHtml() : ''}
      <div class="card"><div class="cardhead"><h3>This device</h3></div><p>Your plan, checkmarks, appointments and profile are kept in this browser. Getting a new phone? Use Save my plan above and open your link on the new phone.</p>
        <div class="btns"><button class="btn danger" id="reset">Reset all data on this device</button></div><p class="note" id="resetmsg" aria-live="polite"></p></div>`;
    $('reset').onclick = () => {
      if (!confirm('Remove your plan, checkmarks, appointments, profile and saved staff bundles from this browser?')) return;
      [localStorage, sessionStorage].forEach(st => { try { Object.keys(st).filter(k => k.startsWith('rehabProto.')).forEach(k => st.removeItem(k)); } catch (e) {} });
      V5.routes.athlete(); $('resetmsg').textContent = 'Done. All data from this app was removed from this browser.';
    };
    if (window.V13) V13.wireSave(); if (window.V14) V14.wrapSave();
    $('athsave').onclick = () => {
      const o = {};
      ATH_FIELDS.forEach(([k, , , , max]) => { let v = String(($('ath-' + k) || {}).value || '').trim(); if (max) v = v.slice(0, max); if (v) o[k] = v; });
      if (o.name) o.name = o.name.split(/\s+/)[0];
      R.store.set(ATH_KEY, o);
      V5.routes.athlete();
      $('athmsg').textContent = 'Saved on this device.';
    };
    $('athclear').onclick = () => {
      if (!confirm('Clear your athlete profile from this device?')) return;
      R.store.del(ATH_KEY); V5.routes.athlete(); $('athmsg').textContent = 'Profile cleared.';
    };
  };
  V5.routes.staff = function (sub) {
    R.navActive('staff');
    if (sub !== 'tools') {
      R.setTitle('Care team'); setHead('Your care team', 'Who to contact about your recovery.');
      main().innerHTML = careTeamHtml() + `<a class="card staffentry" href="#/staff/tools"><span class="se-ic">${icon('tool')}</span><span><em class="eyebrow-sm">For COSMC staff and therapists</em><strong>Staff tools: assign a plan</strong><small>Make a link, QR code or short code for an athlete.</small></span>${icon('chev', 'chev')}</a>`;
      return;
    }
    R.setTitle('Staff tools'); setHead('Assign a plan', 'Make a link, QR code or code for an athlete.', 'Staff tools');
    const sd = R.store.get(STAFF_KEY, {}), bundles = R.store.get(BUNDLE_KEY, []);
    const protoOpts = R.DATA.areas.map(c => `<optgroup label="${R.esc(c)}">${R.DATA.docs.filter(x => x.area === c).map(x => `<option value="${num(x.id)}">${R.esc(x.title)}</option>`).join('')}</optgroup>`).join('');
    const defBase = location.protocol.startsWith('http') ? location.href.split('#')[0] : (R.store.get(BASE_KEY, '') || '');
    main().innerHTML = `<p class="crumb"><a href="#/staff">${icon('arrowl')} Care team</a></p>
      <div class="disclaimer">No login and nothing is stored on a server. Do not type last names, birth dates or any medical details about a patient. A first name is optional.</div>
      <div class="card step-card"><div class="cardhead"><h3><span class="stepn">1</span> Who and what</h3></div>
        ${bundles.length ? `<label class="f" for="sb">Start from a saved bundle</label><select id="sb" autocomplete="off"><option value="" selected>Choose...</option>${bundles.map((b, i) => `<option value="${i}">${R.esc(b.name)}</option>`).join('')}</select>` : ''}
        <label class="f" for="sby">Assigned by</label><input class="search" id="sby" list="sbylist" placeholder="Type a name or tap one below" maxlength="50" value="${R.esc(sd.by || '')}"><datalist id="sbylist">${['Dr. Austin Cole'].concat(CARE_TEAM.map(m => m.name)).map(n => `<option value="${R.esc(n)}">`).join('')}</datalist>
        <div class="quickpick" aria-label="Quick pick">${['Dr. Austin Cole'].concat(CARE_TEAM.map(m => m.name)).map(n => `<button type="button" class="qp" data-by="${R.esc(n)}">${R.esc(n)}</button>`).join('')}</div>
        <label class="f" for="sn">Athlete's first name (optional)</label><input class="search" id="sn" maxlength="40" placeholder="First name only">
        <label class="f" for="sp">Main protocol</label><select id="sp" autocomplete="off"><option value="" selected>Choose...</option>${protoOpts}</select>
        <label class="f" for="sd">Surgery or start date</label><input type="date" id="sd" autocomplete="off">
      </div>
      <div class="card step-card"><div class="cardhead"><h3><span class="stepn">2</span> Add-ons (optional)</h3></div>
        <label class="f">Also assign these documents</label>
        <input class="search" id="xf" placeholder="Filter documents, e.g. HEP, prehab, knee">
        <div class="xlist" id="xl">${R.DATA.docs.map(x => `<label class="xi" data-t="${R.esc((x.title + ' ' + x.category).toLowerCase())}"><input type="checkbox" value="${num(x.id)}"> <span>${R.esc(x.title)}</span></label>`).join('')}</div>
        <label class="f">Add-on items (for therapists: exercises or tasks in your own words)</label>
        <div id="ptl"></div><div class="btns"><button class="btn secondary" id="ptadd">+ Add item</button></div>
        <label class="f">Appointments</label>
        <div id="apl"></div><div class="btns"><button class="btn secondary" id="apadd">+ Add appointment</button></div>
      </div>
      <div class="card step-card"><div class="cardhead"><h3><span class="stepn">3</span> Contact and link</h3></div>
        <label class="f" for="sph">Clinic phone for the Call button</label><input class="search" id="sph" inputmode="tel" maxlength="20" autocomplete="off" value="${R.esc(sd.ph || CLINIC_PHONE_TXT)}"><p class="note">Defaults to the COSMC clinic, ${CLINIC_PHONE_TXT}. Change it only if this athlete should call a different number.</p>
        <label class="f" for="sc">When to call us (optional, your wording)</label><textarea class="search" id="sc" rows="3" maxlength="400">${R.esc(sd.c || '')}</textarea>
        <label class="f" for="sbase">Web address of this app (needed for links and QR codes)</label><input class="search" id="sbase" placeholder="https://..." value="${R.esc(defBase)}">
        <div class="btns"><button class="btn" id="gen">Make link, QR code and code</button></div>
      </div>
      <div id="out"></div>`;
    const addPt = (t, i) => { const div = document.createElement('div'); div.className = 'rowin'; div.innerHTML = `<input class="search pt-t" placeholder="Item (e.g. Heel slides 3x10)" maxlength="80" value="${R.esc(t || '')}"><input class="search pt-i" placeholder="Instructions (optional)" maxlength="400" value="${R.esc(i || '')}"><button class="btn danger sm">Remove</button>`; div.querySelector('button').onclick = () => div.remove(); $('ptl').appendChild(div); };
    const addAp = (a) => { const div = document.createElement('div'); div.className = 'rowin'; div.innerHTML = `<input type="date" class="ap-d" value="${R.esc((a && a[0]) || '')}"><input type="time" class="ap-m" value="${R.esc((a && a[1]) || '')}"><input class="search ap-t" placeholder="e.g. Follow-up visit" maxlength="60" value="${R.esc((a && a[2]) || '')}"><button class="btn danger sm">Remove</button>`; div.querySelector('button').onclick = () => div.remove(); $('apl').appendChild(div); };
    $('ptadd').onclick = () => { if ($('ptl').children.length < 10) addPt(); };
    document.querySelectorAll('.qp').forEach(b => b.onclick = () => { $('sby').value = b.dataset.by; document.querySelectorAll('.qp').forEach(x => x.classList.toggle('on', x === b)); });
    $('apadd').onclick = () => { if ($('apl').children.length < 10) addAp(); };
    $('xf').oninput = () => { const q = $('xf').value.toLowerCase().trim(); $('xl').querySelectorAll('.xi').forEach(l => l.hidden = q && !l.dataset.t.includes(q)); };
    const sb = $('sb'); if (sb) sb.onchange = () => { const b = bundles[+sb.value]; if (!b) return; $('sp').value = b.p || ''; $('xl').querySelectorAll('input').forEach(c => c.checked = (b.x || []).includes(c.value)); $('ptl').innerHTML = ''; (b.t || []).forEach(t => addPt(t[0], t[1])); };
    function collect() {
      const p = $('sp').value, d = $('sd').value; if (!p) { alert('Choose a main protocol.'); return null; } if (!validDate(d)) { alert('Choose the surgery or start date.'); return null; }
      const o = { v: 1, p, d };
      const n = $('sn').value.trim(), by = $('sby').value.trim(), ph = phoneDigits($('sph').value), c = $('sc').value.trim();
      if (n) o.n = n; if (by) o.by = by; if (ph && ph !== CLINIC_PHONE && ph !== '1' + CLINIC_PHONE) o.ph = ph; if (c) o.c = c;
      const x = [...$('xl').querySelectorAll('input:checked')].map(i => i.value); if (x.length) o.x = x;
      const t = [...$('ptl').children].map(r => [r.querySelector('.pt-t').value.trim(), r.querySelector('.pt-i').value.trim()]).filter(r => r[0]); if (t.length) o.t = t;
      const a = [...$('apl').children].map(r => [r.querySelector('.ap-d').value, r.querySelector('.ap-m').value, r.querySelector('.ap-t').value.trim()]).filter(r => validDate(r[0])); if (a.length) o.a = a;
      return o;
    }
    $('gen').onclick = () => {
      const o = collect(); if (!o) return;
      let base = $('sbase').value.trim(); if (!/^https?:\/\//i.test(base)) { alert('Enter the web address where this app is hosted (starts with https://). Links and QR codes need it.'); return; }
      base = base.split('#')[0]; R.store.set(BASE_KEY, base);
      R.store.set(STAFF_KEY, { by: $('sby').value.trim(), ph: $('sph').value.trim(), c: $('sc').value.trim() });
      const url = base + '#/a/' + b64e(window.V13 ? V13.sign(o) : o);
      const simple = !o.x && !o.t && !o.a && !o.ph && !o.c && !o.n && !o.by;
      const code = simple ? `CR-${o.p}-${o.d.slice(2, 4)}${o.d.slice(5, 7)}${o.d.slice(8, 10)}` : null;
      let qr = '';
      if (url.length > 1900) qr = '<p class="note">This link is too long for a QR code. Remove some items or send the link instead.</p>';
      else { try { const q = qrcode(0, 'L'); q.addData(url); q.make(); qr = `<div class="qr">${q.createSvgTag({ cellSize: 4, margin: 4, scalable: true })}</div>`; } catch (e) { qr = '<p class="note">Could not make a QR code for this link.</p>'; } }
      $('out').innerHTML = `<div class="card"><h2>Ready to send</h2>
        <p class="note">Send the link or show the QR code. When the athlete opens it they tap Save and the plan is on their phone.</p>
        <label class="f" for="olink">Link</label><input class="search" id="olink" readonly value="${R.esc(url)}">
        <div class="btns"><button class="btn" id="ocopy">Copy link</button></div>
        ${qr}
        ${code ? `<p>Short code: <strong>${code}</strong> <span class="note">(athlete types it on the home screen; the code carries only the protocol and date)</span></p>` : '<p class="note">No short code is made when you add a name, extras, items, appointments or a non-default phone number, because the code can only carry the protocol and date. Use the link or QR code.</p>'}
        <p class="note">Nothing was saved or sent anywhere. Treat the link like any message: it contains what you typed above.</p>
        <p class="flag"><strong>Links can include first name, age and appointments — only send to the patient.</strong></p>
        <label class="f" for="bn">Save this setup as a bundle on this computer (optional)</label>
        <input class="search" id="bn" placeholder="e.g. THA week 0 package" maxlength="40"><div class="btns"><button class="btn secondary" id="bsave">Save bundle</button></div></div>`;
      $('ocopy').onclick = () => { $('olink').select(); if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { $('ocopy').textContent = 'Copied'; }, () => document.execCommand('copy')); else document.execCommand('copy'); };
      $('bsave').onclick = () => { const nm = $('bn').value.trim(); if (!nm) return; const b = R.store.get(BUNDLE_KEY, []); b.push({ name: cut(nm, 40), p: o.p, x: o.x || [], t: o.t || [] }); R.store.set(BUNDLE_KEY, b); $('bsave').textContent = 'Saved'; };
      if (window.V14) V14.wrapStaff(window.V13 ? V13.sign(o) : o);
      $('out').scrollIntoView({ behavior: 'smooth' });
    };
  };
})();
