/* v13: Save my plan / restore links, link tamper-guard, exercise media slots, source + date lines, device-local admin page. No server. */
(function () {
  'use strict';
  const V13 = window.V13 = {};
  let R = null;
  const $ = id => document.getElementById(id);
  const K = { plan: 'rehabProto.plan', checks: 'rehabProto.checks', appts: 'rehabProto.appts', seen: 'rehabProto.seen', ath: 'rehabProto.athlete', last: 'rehabProto.lastsave', admin: 'rehabProto.adminKey', patch: 'rehabProto.adminPatch' };
  const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => JSON.parse(decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')))));
  // simple FNV-1a checksum (tamper-guard against accidental or casual edits; not cryptographic)
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  V13.sign = o => { const c = Object.assign({}, o); delete c.k; c.k = fnv(JSON.stringify(c)); return c; };
  V13.checkOk = o => { if (!o || !('k' in o)) return null; const c = Object.assign({}, o); const k = c.k; delete c.k; return fnv(JSON.stringify(c)) === k; };
  V13.TAMPER = '<div class="flag"><strong>This link looks changed — please confirm with the clinic</strong> before using it. Call the clinic.</div>';
  const esc = s => R.esc(s);
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  V13.exKey = slug; V13.b64e = b64e; V13.b64d = b64d; V13.safeSrc = s => safeSrc(s);
  V13.init = api => { R = api; };

  // ---------- data prep: admin preview patches (this device only) ----------
  V13.prep = function (D) {
    const P = (() => { try { return JSON.parse(localStorage.getItem(K.patch)); } catch (e) { return null; } })();
    if (P && P.docs) {
      if (P.updated) D.updated = P.updated;
      D.docs.forEach(d => { const x = P.docs[d.id]; if (x) ['title', 'updated', 'sections', 'media'].forEach(f => { if (x[f] !== undefined) d[f] = x[f]; }); });
      D._preview = Object.keys(P.docs).length || (P.updated ? 1 : 0);
    }
  };

  // ---------- D) source + date line ----------
  const niceDate = k => { if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return ''; const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
  V13.sourceLine = d => {
    const dt = niceDate((d && d.updated) || R.DATA.updated);
    return `<p class="srcline">Source: ${esc(R.DATA.source_label || 'COSMC Sports Medicine protocol')}${dt ? ', last updated ' + esc(dt) : ''}. Your care team's current instructions always come first.</p>`;
  };

  // ---------- C) exercise media ----------
  const MIC = { video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>', image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>' };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${MIC[n]}</svg>`;
  const safeSrc = s => { s = String(s || '').trim(); return /^(https:\/\/|media\/)[^\s"'<>]+$/i.test(s) && !/\.\./.test(s) ? s : ''; };
  V13.media = function (d, text) {
    const m = d && d.media && d.media[slug(text)];
    const src = m && safeSrc(m.src);
    if (!m || !src) { const t = (m && m.type === 'image') || (d && d.media_default === 'image') ? 'image' : 'video'; return `<div class="mslot ph">${ic(t)}<span>${t === 'image' ? 'Image' : 'Video'} coming soon</span></div>`; }
    const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
    let body;
    const yt = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,15})/i.exec(src);
    if (m.type === 'image') body = `<img loading="lazy" src="${esc(src)}" alt="${esc(m.caption || text)}">`;
    else if (m.type === 'video' && yt) body = `<div class="mvid"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="${esc(m.caption || text)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
    else if (m.type === 'video' && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src)) body = `<video controls playsinline preload="metadata" src="${esc(src)}"></video>`;
    else body = `<a class="btn secondary sm" href="${esc(src)}" target="_blank" rel="noopener">${ic(m.type === 'image' ? 'image' : 'video')} Open ${m.type === 'image' ? 'image' : 'video'}</a>`;
    return `<figure class="mslot">${body}${cap}</figure>`;
  };

  // ---------- B) Save my plan ----------
  const get = (k, d) => R.store.get(k, d);
  function state() {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const ck = R.store.get(K.checks, {}), checks = {};
    Object.keys(ck).forEach(k => { const m = /\|(\d{4})-(\d{2})-(\d{2})$/.exec(k); if (!m || new Date(+m[1], m[2] - 1, +m[3]) >= cutoff) checks[k] = 1; });
    const s = { v: 1, kind: 'save' };
    const p = get(K.plan, null), a = get(K.ath, null), ap = get(K.appts, []), se = get(K.seen, {});
    if (p) s.plan = p; if (a && Object.keys(a).length) s.ath = a; if (ap.length) s.appts = ap; if (Object.keys(checks).length) s.checks = checks; if (Object.keys(se).length) s.seen = se;
    return s;
  }
  const sigOf = s => fnv(JSON.stringify(s));
  const base = () => location.href.split('#')[0];
  V13.saveLink = () => { const s = state(); s.t = new Date().toISOString().slice(0, 16); return { url: base() + '#/r/' + b64e(V13.sign(s)), sig: sigOf(state()), t: s.t }; };
  V13.saveStatus = () => {
    const L = get(K.last, null);
    if (!L) return { txt: 'Not saved yet. Make a Save my plan link so you can restore on a new phone.', dirty: true };
    const dirty = L.sig !== sigOf(state());
    const when = new Date(L.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { txt: `Last saved ${when}.` + (dirty ? ' You have changes since your last save, make a new link.' : ' No changes since.'), dirty };
  };
  V13.saveCardHtml = () => {
    const S = V13.saveStatus();
    return `<div class="card savecard" id="savecard"><div class="cardhead"><h3>Save my plan</h3><span class="badge-soft ${S.dirty ? 'warn' : ''}">${S.dirty ? 'Not up to date' : 'Up to date'}</span></div>
      <p>Make a personal link that holds your plan, checkmarks, appointments and athlete profile. Open it on a new phone to restore everything.</p>
      <p class="note" id="savestat">${esc(S.txt)}</p>
      <div class="btns"><button class="btn" id="mksave">Make my save link</button></div>
      <div id="saveout"></div>
      <p class="disc-mini">When online, a copy of this plan (no last name or medical records) is saved on the app's server under a random link; offline, the longer link holds everything. Keep the link safe and re-save after changes. It can include your first name and appointments, so only share it with yourself or your care team.</p></div>`;
  };
  V13.wireSave = () => {
    const b = $('mksave'); if (!b) return;
    b.onclick = () => {
      const L = V13.saveLink();
      R.store.set(K.last, { t: new Date().toISOString(), sig: L.sig });
      const p = get(K.plan, null);
      const m = p && /-(\d+)$/.exec(p.id || '');
      const code = m && /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? `CR-${m[1]}-${p.date.slice(2, 4)}${p.date.slice(5, 7)}${p.date.slice(8, 10)}` : '';
      let qr = '';
      if (L.url.length <= 2800 && window.qrcode) { try { const q = qrcode(0, 'L'); q.addData(L.url); q.make(); qr = `<div class="qr">${q.createSvgTag({ cellSize: 3, margin: 4, scalable: true })}</div><p class="note center">Scan with the new phone's camera.</p>`; } catch (e) { qr = ''; } }
      if (!qr) qr = '<p class="note">Too much saved for a QR code. Use Copy link or Share instead.</p>';
      $('saveout').innerHTML = `<label class="f" for="slink">Your save link</label><input class="search" id="slink" readonly value="${esc(L.url)}">
        <div class="btns"><button class="btn" id="scopy">Copy link</button>${navigator.share ? '<button class="btn secondary" id="sshare">Share</button>' : ''}</div>${qr}
        ${code ? `<p class="note">Short code: <strong>${code}</strong>. It holds only your protocol and surgery date, not checkmarks, appointments or profile. Use the link for a full restore.</p>` : ''}`;
      $('scopy').onclick = () => { $('slink').select(); const ok = () => { $('scopy').textContent = 'Copied'; }; if (navigator.clipboard) navigator.clipboard.writeText(L.url).then(ok, () => { document.execCommand('copy'); ok(); }); else { document.execCommand('copy'); ok(); } };
      const sh = $('sshare'); if (sh) sh.onclick = () => navigator.share({ title: 'My COSMC rehab plan', text: 'My saved rehab plan link', url: L.url }).catch(() => {});
      const S = V13.saveStatus(); $('savestat').textContent = S.txt;
      const bd = document.querySelector('#savecard .badge-soft'); if (bd) { bd.textContent = 'Up to date'; bd.classList.remove('warn'); }
    };
  };
  V13.missingHtml = () => `<p class="note missing">Plan missing? Ask the clinic to resend your link or <a href="tel:5013291510">call the clinic</a>.</p>`;

  // restore route  #/r/<payload>
  function restore(payload) {
    R.setTitle('Restore plan'); R.navActive('plan'); V5.setHead('Restore your plan', 'From your Save my plan link.', 'Save my plan');
    let o = null; try { o = b64d(payload || ''); } catch (e) { o = null; }
    const main = document.getElementById('main');
    if (!o || o.kind !== 'save') { main.innerHTML = `<div class="card"><h3>Link not recognized</h3><p>This save link is incomplete or damaged. Try copying the whole link again.</p>${V13.missingHtml()}</div>`; return; }
    const ok = V13.checkOk(o), p = o.plan && R.BY_ID[o.plan.id] ? o.plan : null, a = o.ath || {};
    const nApp = (o.appts || []).length, nCk = Object.keys(o.checks || {}).length;
    main.innerHTML = `${ok === false ? V13.TAMPER : ''}<section class="summary"><div class="sum-eyebrow">Saved ${o.t ? esc(new Date(o.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : 'plan'}</div>
      <h2>${p ? esc(R.BY_ID[p.id].title) : 'No protocol in this save'}</h2><p>${a.name ? 'For ' + esc(String(a.name).slice(0, 30)) : ''}</p></section>
      <div class="card"><ul><li>${p ? 'Protocol and surgery date' : 'No protocol'}</li><li>${nCk} checkmark${nCk === 1 ? '' : 's'} (last 30 days)</li><li>${nApp} appointment${nApp === 1 ? '' : 's'} you added</li><li>${Object.keys(a).length ? 'Athlete profile' : 'No athlete profile'}</li></ul>
      <div class="btns"><button class="btn" id="dorestore">Restore on this phone</button><a class="btn secondary" href="#/">Cancel</a></div>
      <p class="note">Restoring replaces the plan, checkmarks, appointments and profile on this phone. Nothing is sent anywhere.</p></div>`;
    $('dorestore').onclick = () => {
      if (!confirm('Restore this plan on this phone? It will replace what is here.')) return;
      const set = (k, v) => v ? R.store.set(k, v) : R.store.del(k);
      set(K.plan, p); set(K.checks, o.checks && typeof o.checks === 'object' ? o.checks : null); set(K.appts, Array.isArray(o.appts) ? o.appts.slice(0, 100) : null);
      set(K.seen, o.seen && typeof o.seen === 'object' ? o.seen : null);
      const ath = {}; ['name', 'school', 'about', 'sport', 'position'].forEach(f => { if (a[f]) ath[f] = String(a[f]).slice(0, 200); }); set(K.ath, Object.keys(ath).length ? ath : null);
      R.store.set(K.last, { t: o.t ? new Date(o.t).toISOString() : new Date().toISOString(), sig: sigOf(state()) });
      location.hash = '#/';
    };
  }

  // ---------- E) admin (device-local passcode gate) ----------
  // Optional: paste a published salted hash here as 'salt:hexhash' to require one passcode on every device. Left empty: first-time setup on this device.
  const ADMIN_HASH = '';
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const unlocked = () => sessionStorage.getItem('rehabProto.adminOk') === '1';
  function admin() {
    R.setTitle('Admin'); R.navActive(''); V5.setHead('Admin', 'Protocol text, dates and media.', 'COSMC Sports Medicine');
    const main = document.getElementById('main');
    if (!(window.crypto && crypto.subtle)) { main.innerHTML = '<div class="card"><p>Admin needs a secure (https) connection.</p></div>'; return; }
    if (unlocked()) return adminPanel();
    const stored = ADMIN_HASH || ((get(K.admin, null) || {}).s ? get(K.admin).s + ':' + get(K.admin).h : '');
    const setup = !stored;
    main.innerHTML = `<div class="card"><div class="cardhead"><h3>${setup ? 'Set up admin passcode' : 'Admin sign in'}</h3></div>
      <p class="note">${setup ? 'First time on this device. Choose a passcode (8+ characters). Only a salted hash is stored in this browser.' : 'Enter the admin passcode for this device.'}</p>
      <label class="f" for="apw">Passcode</label><input class="search" type="password" id="apw" autocomplete="${setup ? 'new-password' : 'current-password'}">
      ${setup ? '<label class="f" for="apw2">Repeat passcode</label><input class="search" type="password" id="apw2" autocomplete="new-password">' : ''}
      <div class="btns"><button class="btn" id="ago">${setup ? 'Set passcode' : 'Unlock'}</button></div><p class="note" id="amsg" aria-live="polite"></p>
      <p class="disc-mini">This lock lives on this device only. It is not server security: the published protocol data is public, and this page cannot publish anything.</p></div>`;
    $('ago').onclick = async () => {
      const pw = $('apw').value;
      if (setup) {
        if (pw.length < 8) { $('amsg').textContent = 'Use at least 8 characters.'; return; }
        if (pw !== $('apw2').value) { $('amsg').textContent = 'The passcodes do not match.'; return; }
        const s = hex(crypto.getRandomValues(new Uint8Array(16)));
        R.store.set(K.admin, { s, h: await sha(s + pw) });
      } else {
        const [s, h] = stored.split(':');
        if (await sha(s + pw) !== h) { $('amsg').textContent = 'Wrong passcode.'; return; }
      }
      sessionStorage.setItem('rehabProto.adminOk', '1'); adminPanel();
    };
  }
  function exList(d) {
    if (d.exercises && d.exercises.length) return d.exercises.slice();
    const out = []; (d.sections || []).forEach(s => s.lines.forEach(l => { if (l && l.k === 'item' && out.length < 150) out.push(l.t); })); return [...new Set(out)];
  }
  V13.exList = exList;
  const patches = () => get(K.patch, null) || { docs: {} };
  function cleanData() {
    const o = {}; Object.keys(R.DATA).forEach(k => { if (k[0] !== '_') o[k] = R.DATA[k]; });
    o.docs = R.DATA.docs.map(d => { const c = {}; Object.keys(d).forEach(k => { if (k[0] !== '_') c[k] = d[k]; }); return c; });
    return o;
  }
  function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function adminPanel() {
    const main = document.getElementById('main'), D = R.DATA, P = patches();
    const opts = D.categories.map(c => `<optgroup label="${esc(c)}">${D.docs.filter(x => x.category === c).map(x => `<option value="${esc(x.id)}">${P.docs[x.id] ? '* ' : ''}${esc(x.title)}</option>`).join('')}</optgroup>`).join('');
    main.innerHTML = `<div class="flag"><strong>Download, then send to Jarvis to publish.</strong> This page cannot publish by itself. Edits preview only in this browser until published.</div>
      <div class="card"><div class="cardhead"><h3>Data</h3>${D._preview ? `<span class="badge-soft warn">${D._preview} edited (preview)</span>` : ''}</div>
        <label class="f" for="aupd">Last updated (all protocols, default)</label><input type="date" id="aupd" value="${esc(D.updated || '')}">
        <div class="btns"><button class="btn" id="aexp">Export updated data</button><label class="btn secondary" for="aimp">Import data</label><input type="file" id="aimp" accept=".json,.js,application/json,text/javascript" hidden></div>
        <div class="btns"><button class="btn danger sm" id="adisc">Discard all preview edits</button><button class="btn secondary sm" id="alock">Lock</button></div>
        <p class="note" id="admsg" aria-live="polite"></p></div>
      <div class="card"><div class="cardhead"><h3>Edit a protocol</h3></div><label class="f" for="adoc">Protocol</label><select id="adoc"><option value="">Choose...</option>${opts}</select><div id="aed"></div></div>
      <div class="card"><div class="cardhead"><h3>How to add media</h3></div><ol class="note"><li>Put the file in <code>media/&lt;protocol-id&gt;/&lt;exercise-key&gt;.mp4</code> (or .jpg), or use a YouTube/https link.</li><li>Here: pick the protocol, find the exercise, set type, path or link, and caption. Save edits.</li><li>Export updated data and send data.json plus any media files to Jarvis to publish.</li></ol></div>`;
    const msg = t => { $('admsg').textContent = t; };
    const savePatch = () => { R.store.set(K.patch, P); };
    $('aupd').onchange = () => { P.updated = $('aupd').value; D.updated = P.updated; savePatch(); msg('Default date saved (preview).'); };
    $('alock').onclick = () => { sessionStorage.removeItem('rehabProto.adminOk'); admin(); };
    $('adisc').onclick = () => { if (!confirm('Discard all preview edits on this device?')) return; R.store.del(K.patch); location.reload(); };
    $('aexp').onclick = () => { const s = JSON.stringify(cleanData()); dl('data.json', s, 'application/json'); setTimeout(() => dl('data.js', 'window.COLE_DATA=' + s + ';\n', 'text/javascript'), 400); msg('Downloaded data.json and data.js. Send them to Jarvis to publish.'); };
    $('aimp').onchange = () => {
      const f = $('aimp').files[0]; if (!f) return;
      f.text().then(t => {
        let j; try { j = JSON.parse(t.trim().replace(/^window\.COLE_DATA\s*=\s*/, '').replace(/;\s*$/, '')); } catch (e) { msg('That file is not valid data.json or data.js.'); return; }
        if (!j || !Array.isArray(j.docs)) { msg('That file has no protocols in it.'); return; }
        let n = 0; j.docs.forEach(x => { const d = R.BY_ID[x.id]; if (!d) return; const ch = {}; ['title', 'updated', 'sections', 'media'].forEach(k => { if (x[k] !== undefined && JSON.stringify(x[k]) !== JSON.stringify(d[k])) ch[k] = x[k]; }); if (Object.keys(ch).length) { P.docs[x.id] = Object.assign(P.docs[x.id] || {}, ch); n++; } });
        if (j.updated) P.updated = j.updated;
        try { savePatch(); } catch (e) { msg('Too large to preview on this device.'); return; }
        msg(`Imported. ${n} protocol${n === 1 ? '' : 's'} differ from the published data. Reloading preview...`); setTimeout(() => location.reload(), 800);
      });
    };
    $('adoc').onchange = () => editor($('adoc').value);
    function editor(id) {
      const d = R.BY_ID[id], box = $('aed'); if (!d) { box.innerHTML = ''; return; }
      const ex = exList(d), M = d.media || {};
      box.innerHTML = `<label class="f" for="et">Title</label><input class="search" id="et" value="${esc(d.title)}">
        <label class="f" for="eu">Last updated</label><input type="date" id="eu" value="${esc(d.updated || '')}">
        <p class="note">Protocol id: <code>${esc(d.id)}</code></p>
        <h3 class="sect">Text</h3><p class="note">One line per line. Blank lines are kept as spacing.</p>
        ${(d.sections || []).map((s, i) => `<details class="sec"><summary>${esc(s.title || 'Section ' + (i + 1))}</summary><div class="secbody">
          <label class="f" for="es${i}">Section title</label><input class="search" id="es${i}" value="${esc(s.title || '')}">
          <label class="f" for="el${i}">Lines</label><textarea class="search" id="el${i}" rows="8">${esc(s.lines.map(l => l ? l.t : '').join('\n'))}</textarea></div></details>`).join('')}
        <h3 class="sect">Exercise media</h3><p class="note">Empty = "coming soon" box. Path like <code>media/${esc(d.id)}/&lt;key&gt;.mp4</code> or an https link.</p>
        <div class="medlist">${ex.map((t, i) => { const k = slug(t), m = M[k] || {}; return `<details class="sec"><summary>${m.src ? '● ' : ''}${esc(t.slice(0, 70))}</summary><div class="secbody">
          <p class="note">Key: <code>${esc(k)}</code></p>
          <label class="f" for="mt${i}">Type</label><select id="mt${i}">${['', 'video', 'image', 'link'].map(o => `<option value="${o}" ${(m.type || '') === o ? 'selected' : ''}>${o || 'None'}</option>`).join('')}</select>
          <label class="f" for="mu${i}">Path or link</label><input class="search" id="mu${i}" value="${esc(m.src || '')}" placeholder="media/${esc(d.id)}/${esc(k)}.mp4">
          <label class="f" for="mc${i}">Caption</label><input class="search" id="mc${i}" maxlength="140" value="${esc(m.caption || '')}"></div></details>`; }).join('') || '<p class="note">No exercise items found in this document.</p>'}</div>
        <div class="btns"><button class="btn" id="esave">Save edits (preview)</button><a class="btn secondary" href="#/p/${esc(d.id)}">View protocol</a></div><p class="note" id="emsg" aria-live="polite"></p>`;
      $('esave').onclick = () => {
        const bad = []; const media = {};
        ex.forEach((t, i) => { const ty = $('mt' + i).value, src = $('mu' + i).value.trim(), cap = $('mc' + i).value.trim(); if (!ty && !src) return; if (src && !safeSrc(src)) { bad.push(t.slice(0, 30)); return; } media[slug(t)] = { type: ty || 'video', src, caption: cap }; });
        if (bad.length) { $('emsg').textContent = 'Use a media/... path or an https:// link for: ' + bad.join(', '); return; }
        const secs = (d.sections || []).map((s, i) => {
          const txt = $('el' + i).value.replace(/\r/g, '').split('\n');
          const lines = txt.map((t, j) => { if (!t.trim()) return null; const o = s.lines[j]; return o ? Object.assign({}, o, { t }) : { t, l: 1, k: 'item' }; });
          return Object.assign({}, s, { title: $('es' + i).value.trim() || s.title, lines });
        });
        const ch = { title: $('et').value.trim() || d.title, updated: $('eu').value || d.updated, sections: secs, media };
        Object.assign(d, ch); d._text = '';
        P.docs[d.id] = ch;
        try { savePatch(); $('emsg').textContent = 'Saved as a preview on this device. Export updated data to publish.'; } catch (e) { $('emsg').textContent = 'Could not save on this device (storage full).'; }
      };
    }
  }
  V13.register = () => { V5.routes.r = restore; V5.routes.admin = admin; };
})();
