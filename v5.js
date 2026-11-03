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

  // ---------- Home top (Today) ----------
  V5.homeTop = function () {
    const p = getPlan();
    if (!p) return welcome();
    return todayHtml(p);
  };
  function welcome() {
    return `<div class="hero"><h1>Welcome, athlete.</h1><p>Your recovery plan, built for you. Follow your timeline one day at a time.</p></div>
      <div class="card"><h2>Got a plan code or link from your care team?</h2>
        <label class="f" for="code">Enter your code (looks like CR-73-261014)</label>
        <input class="search" id="code" placeholder="CR-..." autocomplete="off" autocapitalize="characters">
        <div class="btns"><button class="btn" id="usecode">Use code</button><a class="btn secondary" href="#/plan">Set up my own plan</a></div>
        <p class="note" id="codemsg"></p></div>`;
  }
  function todayHtml(p) {
    const d = R.BY_ID[p.id], days = R.daysSince(p.date), ph = phases(d), ci = curPhase(ph, days), end = roadEnd(ph);
    const name = p.name ? R.esc(p.name) : '';
    let h = `<div class="hero"><h1>Hello${name ? ', ' + name : ''}!</h1><p>${R.esc(d.title)}</p></div>`;
    if (!p.date) return h + `<div class="card"><p>Add your surgery or start date on <a href="#/plan">My plan</a> to see your timeline.</p></div>`;
    // phase unlocked banner
    const seen = R.store.get(SEEN_KEY, {});
    if (ci >= 0 && ci > (seen[p.id + '|' + p.date] ?? -1) && days > 0) {
      h += `<div class="unlock" role="status"><strong>New phase unlocked</strong><div>${R.esc(R.sectionTitle(ph[ci].s, ph[ci].i))}</div><p class="note" style="margin:4px 0">Your care team decides when you are cleared to move on. This is the written timeline from the protocol.</p><button class="btn secondary" id="seen" data-ci="${ci}">Got it</button></div>`;
    }
    // today card
    if (days < 0) {
      h += `<div class="card"><div class="bignum">${-days}</div><div>day${days === -1 ? '' : 's'} until surgery (${R.esc(nice(p.date))})</div>`;
      const pre = R.BY_ID['knee-arthroplasty-prehab-exercises-148'];
      if (pre && /arthroplasty/i.test(d.title)) h += `<p><a href="#/p/${pre.id}">Open your prehab exercises</a></p>`;
      h += `</div>`;
    } else {
      h += `<div class="card"><div class="row"><div><div class="bignum">Day ${days}</div><div>Week ${Math.floor(days / 7)} &middot; ${R.esc(nice(keyOf(new Date())))}</div></div>`;
      if (ci >= 0) h += `<span class="pbadge">Phase ${ci + 1} of ${ph.length}</span>`;
      h += `</div>`;
      if (ci >= 0) h += `<div class="phname">${R.esc(R.sectionTitle(ph[ci].s, ph[ci].i))}</div>`;
      if (end) {
        const pct = Math.max(0, Math.min(100, Math.round(days / end * 100)));
        h += `<div class="road" aria-label="Road to Return"><div class="roadbar"><div class="roadfill" style="width:${pct}%"></div>${ph.map(x => `<i style="left:${Math.min(99, Math.round(x.a / end * 100))}%"></i>`).join('')}</div>
          <div class="roadlbl"><span>Surgery</span><strong>Road to Return</strong><span>Week ${Math.round((end + 1) / 7)}</span></div></div>`;
        if (days > end) h += `<p class="note">You are past the end of the written timeline. Your care team decides when you are cleared.</p>`;
      }
      h += `</div>`;
      // today's focus
      if (ci >= 0) {
        const s = ph[ci].s, day = R.todayKey(), checks = R.store.get(CHECK_KEY, {}); let rows = '', n = 0, done = 0;
        s.lines.forEach((l, j) => { if (!l) return; if (l.k === 'label') { rows += `<div class="check-label" style="margin-left:${(l.l || 0) * .6}em">${R.esc(l.t)}</div>`; return; } const key = `${d.id}|today|${ph[ci].i}|${j}|${day}`; n++; if (checks[key]) done++; rows += R.ckRow(key, l.t, checks, l.l ? l.l - 1 : 0); });
        h += `<div class="card"><h2>Today's focus</h2><p class="note" id="tcount">${done} of ${n} checked off today. Ticks reset each day.</p>${rows}
          <div class="btns"><button class="btn danger" id="skip">It hurts - skip today</button></div><div id="skipmsg"></div></div>`;
      }
    }
    h += extrasHtml(p) + contactHtml(p) + remindHtml(p, ph, end);
    return h;
  }
  function extrasHtml(p) {
    let h = '';
    const by = p.by ? R.esc(p.by) : 'your care team';
    if (p.extras && p.extras.length) h += `<div class="card"><h2>Also assigned by ${by}</h2><ul class="plain">${p.extras.map(id => R.BY_ID[id]).filter(Boolean).map(x => `<li><a href="#/p/${x.id}">${R.esc(x.title)}</a></li>`).join('')}</ul></div>`;
    if (p.pt && p.pt.length) {
      const checks = R.store.get(CHECK_KEY, {}), day = R.todayKey();
      h += `<div class="card"><h2>From ${by}</h2>${p.pt.map((x, j) => `<div class="ptitem">${R.ckRow(`${p.id}|pt|${j}|${day}`, x[0], checks)}${x[1] ? `<div class="ptnote">${R.esc(x[1])}</div>` : ''}</div>`).join('')}</div>`;
    }
    return h;
  }
  function contactHtml(p) {
    const ph = phoneDigits(p.phone);
    return `<div class="card"><h2>When to call us</h2>
      ${p.callnote ? `<p>${R.esc(p.callnote)}</p>` : '<p>Follow the instructions from your surgeon\'s office. If something feels wrong, call your care team.</p>'}
      ${ph ? `<div class="btns"><a class="btn" href="tel:${R.esc(ph)}">Call the office</a></div>` : '<p class="note">Your care team can add the office phone number when they assign your plan.</p>'}
      <p class="note"><strong>In an emergency, call 911.</strong></p></div>`;
  }
  function remindHtml(p) {
    if (!p.date) return '';
    return `<div class="card"><h2>Add to my phone's calendar</h2>
      <p class="note">Downloads a calendar file with your surgery day and the start of each phase. Open it on your phone and tap Add. It stays on your phone.</p>
      <label class="check"><input type="checkbox" id="icsdaily" checked> <span>Also add a daily exercise reminder at</span></label>
      <input type="time" id="icstime" value="08:00">
      <div class="btns"><button class="btn" id="icsbtn">Download calendar file</button></div></div>`;
  }
  V5.wireHome = function () {
    const p = getPlan();
    const uc = $('usecode');
    if (uc) uc.onclick = () => {
      const m = /^CR-(\d+)-(\d{2})(\d{2})(\d{2})$/i.exec(($('code').value || '').trim());
      const doc = m && docByNum(m[1]);
      if (!doc) { $('codemsg').textContent = 'That code was not recognized. Check it with your care team, or ask for a link.'; return; }
      const date = `20${m[2]}-${m[3]}-${m[4]}`; if (!validDate(date)) { $('codemsg').textContent = 'That code has an invalid date.'; return; }
      location.hash = '#/a/' + b64e({ v: 1, p: m[1], d: date });
    };
    if (!p) return;
    const sn = $('seen'); if (sn) sn.onclick = () => { const s = R.store.get(SEEN_KEY, {}); s[p.id + '|' + p.date] = +sn.dataset.ci; R.store.set(SEEN_KEY, s); sn.closest('.unlock').remove(); };
    const sk = $('skip'); if (sk) sk.onclick = () => { const ph = phoneDigits(p.phone); $('skipmsg').innerHTML = `<div class="disclaimer">Skipping today is okay. Do not push through pain. If it keeps hurting, contact your care team.${ph ? ` <a href="tel:${R.esc(ph)}">Call the office</a>` : ''}</div>`; };
    main().querySelectorAll('input[data-ck]').forEach(cb => cb.onchange = () => {
      const all = R.store.get(CHECK_KEY, {}); const k = cb.dataset.ck; if (cb.checked) all[k] = 1; else delete all[k];
      R.store.set(CHECK_KEY, all); cb.closest('.check').classList.toggle('done', cb.checked);
      const t = $('tcount'); if (t) { const boxes = [...main().querySelectorAll('input[data-ck*="|today|"]')]; t.textContent = `${boxes.filter(b => b.checked).length} of ${boxes.length} checked off today. Ticks reset each day.`; }
    });
    const nm = $('icsbtn'); if (nm) nm.onclick = () => downloadIcs(p);
  };
  const main = () => document.getElementById('main');

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

  // ---------- Calendar ----------
  V5.routes.calendar = function () {
    R.setTitle('Calendar'); R.navActive('calendar');
    const p = getPlan(), todayK = keyOf(new Date());
    let sel = sessionStorage.getItem('rehabProto.calsel') || todayK;
    const own = R.store.get(APPT_KEY, []);
    const d = p && R.BY_ID[p.id], ph = d ? phases(d) : [];
    function events(k) {
      const ev = [];
      if (p && p.date) {
        if (k === p.date) ev.push({ t: 'Surgery day', kind: 'ms' });
        ph.forEach((x, i) => { if (x.a > 0 && addDays(p.date, x.a) === k) ev.push({ t: `Phase ${i + 1} starts: ${R.sectionTitle(x.s, x.i)}`, kind: 'ms' }); });
        (p.appts || []).forEach(a => { if (a[0] === k) ev.push({ t: a[2] || 'Appointment', time: a[1], kind: 'care' }); });
      }
      own.forEach((a, i) => { if (a.d === k) ev.push({ t: a.t, time: a.time, kind: 'own', i }); });
      return ev.sort((x, y) => (x.time || '').localeCompare(y.time || ''));
    }
    function draw() {
      const base = parseKey(sel), start = new Date(base); start.setDate(base.getDate() - base.getDay());
      let strip = '';
      for (let i = 0; i < 7; i++) { const dt = new Date(start); dt.setDate(start.getDate() + i); const k = keyOf(dt), ev = events(k);
        strip += `<button class="day ${k === sel ? 'sel' : ''} ${k === todayK ? 'today' : ''}" data-k="${k}" aria-label="${R.esc(nice(k, true))}"><span>${dt.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}</span><strong>${dt.getDate()}</strong><span class="dots">${ev.slice(0, 3).map(e => `<i class="${e.kind}"></i>`).join('')}</span></button>`; }
      const days = p && p.date ? R.daysSince(p.date) : null, dn = p && p.date ? Math.round((parseKey(sel) - parseKey(p.date)) / 86400000) : null;
      const ci = dn != null ? curPhase(ph, dn) : -1;
      const ev = events(sel);
      main().innerHTML = `<h1>Calendar</h1>
        <div class="weekbar"><button class="btn secondary" id="pw" aria-label="Previous week">&lsaquo;</button><strong>${R.esc(start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</strong><button class="btn secondary" id="nw" aria-label="Next week">&rsaquo;</button></div>
        <div class="strip">${strip}</div>
        <div class="card"><h2>${R.esc(nice(sel, true))}</h2>
          ${dn != null ? `<p class="note">${dn < 0 ? -dn + ' day' + (dn === -1 ? '' : 's') + ' before surgery' : 'Day ' + dn + ' after surgery'}${ci >= 0 ? ' &middot; Phase ' + (ci + 1) + ': ' + R.esc(R.sectionTitle(ph[ci].s, ph[ci].i)) : ''}</p>` : '<p class="note">Add a surgery date on <a href="#/plan">My plan</a> to see phases on your calendar.</p>'}
          ${ev.length ? ev.map(e => `<div class="ev ${e.kind}"><div><strong>${R.esc(e.t)}</strong>${e.time ? ` <span class="note">${R.esc(timeNice(e.time))}</span>` : ''}${e.kind === 'care' ? '<div class="note">From your care team</div>' : ''}</div>${e.kind === 'own' ? `<button class="btn danger sm" data-del="${e.i}">Remove</button>` : ''}</div>`).join('') : '<p class="note">Nothing scheduled.</p>'}
          <h3>Add your own appointment</h3>
          <input class="search" id="at" placeholder="e.g. Therapy visit" maxlength="60"><label class="f" for="atm">Time (optional)</label><input type="time" id="atm">
          <div class="btns"><button class="btn" id="aadd">Add</button><button class="btn secondary" id="atoday">Today</button></div>
          <p class="note">Saved only on this device.</p></div>`;
      main().querySelectorAll('.day').forEach(b => b.onclick = () => { sel = b.dataset.k; sessionStorage.setItem('rehabProto.calsel', sel); draw(); });
      $('pw').onclick = () => { sel = addDays(sel, -7); sessionStorage.setItem('rehabProto.calsel', sel); draw(); };
      $('nw').onclick = () => { sel = addDays(sel, 7); sessionStorage.setItem('rehabProto.calsel', sel); draw(); };
      $('atoday').onclick = () => { sel = todayK; sessionStorage.setItem('rehabProto.calsel', sel); draw(); };
      $('aadd').onclick = () => { const t = $('at').value.trim(); if (!t) { alert('Type a name for the appointment.'); return; } own.push({ d: sel, t: cut(t, 60), time: $('atm').value || '' }); R.store.set(APPT_KEY, own); draw(); };
      main().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { own.splice(+b.dataset.del, 1); R.store.set(APPT_KEY, own); draw(); });
    }
    draw();
  };

  // ---------- Receive an assignment ----------
  V5.routes.a = function (payload) {
    R.setTitle('Assigned plan'); R.navActive('home');
    let o; try { o = b64d(payload); } catch (e) { o = null; }
    const doc = o && docByNum(o.p);
    if (!doc || !validDate(o.d)) { main().innerHTML = '<h1>Link not recognized</h1><p>This link or code does not match a plan in this version of the app. Ask your care team for a new one.</p><p><a href="#/">Back to home</a></p>'; return; }
    const plan = { id: doc.id, date: o.d, sel: null, name: cut(o.n, 40), by: cut(o.by, 50), extras: (o.x || []).slice(0, 20).map(docByNum).filter(Boolean).map(x => x.id), pt: (o.t || []).slice(0, 10).map(t => [cut(t[0], 80), cut(t[1], 400)]).filter(t => t[0]), appts: (o.a || []).slice(0, 10).filter(a => validDate(a[0])).map(a => [a[0], /^\d{2}:\d{2}$/.test(a[1] || '') ? a[1] : '', cut(a[2], 60)]), phone: phoneDigits(o.ph), callnote: cut(o.c, 400) };
    const by = plan.by ? R.esc(plan.by) : 'your care team';
    main().innerHTML = `<div class="hero"><h1>Your plan is ready${plan.name ? ', ' + R.esc(plan.name) : ''}</h1><p>Assigned by ${by}</p></div>
      <div class="card"><p><strong>${R.esc(doc.title)}</strong></p><p>Surgery or start date: ${R.esc(nice(plan.d || plan.date, true))}</p>
      ${plan.extras.length ? `<p>Also: ${plan.extras.map(id => R.esc(R.BY_ID[id].title)).join(', ')}</p>` : ''}
      ${plan.pt.length ? `<p>${plan.pt.length} extra item${plan.pt.length === 1 ? '' : 's'} from ${by}</p>` : ''}
      ${plan.appts.length ? `<p>${plan.appts.length} appointment${plan.appts.length === 1 ? '' : 's'} on your calendar</p>` : ''}
      <div class="btns"><button class="btn" id="acc">Save to my phone</button><a class="btn secondary" href="#/p/${encodeURIComponent(doc.id)}">View protocol first</a></div></div>
      <p class="note">Saving puts this plan on this device only. Nothing is sent anywhere.</p>`;
    $('acc').onclick = () => { const cur = R.store.get(PLAN_KEY, null); if (cur && (cur.id !== plan.id || cur.date !== plan.date) && !confirm('Replace the plan already saved on this device?')) return; R.store.set(PLAN_KEY, plan); location.hash = '#/'; };
  };

  // ---------- Staff tool ----------
  V5.routes.staff = function () {
    R.setTitle('Staff'); R.navActive('staff');
    const sd = R.store.get(STAFF_KEY, {}), bundles = R.store.get(BUNDLE_KEY, []);
    const protoOpts = R.DATA.categories.map(c => `<optgroup label="${R.esc(c)}">${R.DATA.docs.filter(x => x.category === c).map(x => `<option value="${num(x.id)}">${R.esc(x.title)}</option>`).join('')}</optgroup>`).join('');
    const defBase = location.protocol.startsWith('http') ? location.href.split('#')[0] : (R.store.get(BASE_KEY, '') || '');
    main().innerHTML = `<h1>Staff: assign a plan</h1>
      <div class="disclaimer">No login and nothing is stored on a server. Do not type last names, birth dates or any medical details about a patient. A first name is optional.</div>
      <div class="card">
        ${bundles.length ? `<label class="f" for="sb">Start from a saved bundle</label><select id="sb"><option value="">Choose...</option>${bundles.map((b, i) => `<option value="${i}">${R.esc(b.name)}</option>`).join('')}</select>` : ''}
        <label class="f" for="sby">Assigned by</label><input class="search" id="sby" placeholder="e.g. Dr. Cole's team, or Sarah, PT" maxlength="50" value="${R.esc(sd.by || '')}">
        <label class="f" for="sn">Athlete's first name (optional)</label><input class="search" id="sn" maxlength="40" placeholder="e.g. Jordan">
        <label class="f" for="sp">Main protocol</label><select id="sp"><option value="">Choose...</option>${protoOpts}</select>
        <label class="f" for="sd">Surgery or start date</label><input type="date" id="sd">
        <label class="f">Also assign these documents (optional)</label>
        <input class="search" id="xf" placeholder="Filter documents, e.g. HEP, prehab, knee">
        <div class="xlist" id="xl">${R.DATA.docs.map(x => `<label class="xi" data-t="${R.esc((x.title + ' ' + x.category).toLowerCase())}"><input type="checkbox" value="${num(x.id)}"> <span>${R.esc(x.title)}</span></label>`).join('')}</div>
        <label class="f">Add-on items (for therapists: exercises or tasks in your own words)</label>
        <div id="ptl"></div><div class="btns"><button class="btn secondary" id="ptadd">+ Add item</button></div>
        <label class="f">Appointments (optional)</label>
        <div id="apl"></div><div class="btns"><button class="btn secondary" id="apadd">+ Add appointment</button></div>
        <label class="f" for="sph">Clinic phone for the Call button (optional)</label><input class="search" id="sph" inputmode="tel" maxlength="20" value="${R.esc(sd.ph || '')}">
        <label class="f" for="sc">When to call us (optional, your wording)</label><textarea class="search" id="sc" rows="3" maxlength="400">${R.esc(sd.c || '')}</textarea>
        <label class="f" for="sbase">Web address of this app (needed for links and QR codes)</label><input class="search" id="sbase" placeholder="https://..." value="${R.esc(defBase)}">
        <div class="btns"><button class="btn" id="gen">Make link, QR code and code</button></div>
      </div>
      <div id="out"></div>`;
    const addPt = (t, i) => { const div = document.createElement('div'); div.className = 'rowin'; div.innerHTML = `<input class="search pt-t" placeholder="Item (e.g. Heel slides 3x10)" maxlength="80" value="${R.esc(t || '')}"><input class="search pt-i" placeholder="Instructions (optional)" maxlength="400" value="${R.esc(i || '')}"><button class="btn danger sm">Remove</button>`; div.querySelector('button').onclick = () => div.remove(); $('ptl').appendChild(div); };
    const addAp = (a) => { const div = document.createElement('div'); div.className = 'rowin'; div.innerHTML = `<input type="date" class="ap-d" value="${R.esc((a && a[0]) || '')}"><input type="time" class="ap-m" value="${R.esc((a && a[1]) || '')}"><input class="search ap-t" placeholder="e.g. Follow-up visit" maxlength="60" value="${R.esc((a && a[2]) || '')}"><button class="btn danger sm">Remove</button>`; div.querySelector('button').onclick = () => div.remove(); $('apl').appendChild(div); };
    $('ptadd').onclick = () => { if ($('ptl').children.length < 10) addPt(); };
    $('apadd').onclick = () => { if ($('apl').children.length < 10) addAp(); };
    $('xf').oninput = () => { const q = $('xf').value.toLowerCase().trim(); $('xl').querySelectorAll('.xi').forEach(l => l.hidden = q && !l.dataset.t.includes(q)); };
    const sb = $('sb'); if (sb) sb.onchange = () => { const b = bundles[+sb.value]; if (!b) return; $('sp').value = b.p || ''; $('xl').querySelectorAll('input').forEach(c => c.checked = (b.x || []).includes(c.value)); $('ptl').innerHTML = ''; (b.t || []).forEach(t => addPt(t[0], t[1])); };
    function collect() {
      const p = $('sp').value, d = $('sd').value; if (!p) { alert('Choose a main protocol.'); return null; } if (!validDate(d)) { alert('Choose the surgery or start date.'); return null; }
      const o = { v: 1, p, d };
      const n = $('sn').value.trim(), by = $('sby').value.trim(), ph = phoneDigits($('sph').value), c = $('sc').value.trim();
      if (n) o.n = n; if (by) o.by = by; if (ph) o.ph = ph; if (c) o.c = c;
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
      const url = base + '#/a/' + b64e(o);
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
        ${code ? `<p>Short code: <strong>${code}</strong> <span class="note">(athlete types it on the home screen; the code carries only the protocol and date)</span></p>` : '<p class="note">No short code is made when you add a name, extras, items, appointments or a phone number, because the code can only carry the protocol and date. Use the link or QR code.</p>'}
        <p class="note">Nothing was saved or sent anywhere. Treat the link like any message: it contains what you typed above.</p>
        <label class="f" for="bn">Save this setup as a bundle on this computer (optional)</label>
        <input class="search" id="bn" placeholder="e.g. THA week 0 package" maxlength="40"><div class="btns"><button class="btn secondary" id="bsave">Save bundle</button></div></div>`;
      $('ocopy').onclick = () => { $('olink').select(); if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => { $('ocopy').textContent = 'Copied'; }, () => document.execCommand('copy')); else document.execCommand('copy'); };
      $('bsave').onclick = () => { const nm = $('bn').value.trim(); if (!nm) return; const b = R.store.get(BUNDLE_KEY, []); b.push({ name: cut(nm, 40), p: o.p, x: o.x || [], t: o.t || [] }); R.store.set(BUNDLE_KEY, b); $('bsave').textContent = 'Saved'; };
      $('out').scrollIntoView({ behavior: 'smooth' });
    };
  };
})();
