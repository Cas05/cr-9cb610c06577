/* v14: Supabase backend (free project cosmc-rehab). Public publishable key only. Protocol content (public read, admin write via RLS),
   media uploads (admin only), short server-saved plan links (#/s/<id>.<token>). Falls back to bundled data.json when offline. */
(function () {
  'use strict';
  const SB = 'https://hotjxephhvjmowiekbhh.supabase.co', KEY = 'sb_publishable_pXCwj0rTiv-o-HzVopKLVg_6wneftM_';
  const V14 = window.V14 = { SB };
  let R = null;
  const $ = id => document.getElementById(id);
  const CACHE_K = 'rehabProto.content', CLOUD_K = 'rehabProto.cloud', SESS_K = 'rehabProto.adminSess';
  const hdr = tok => ({ apikey: KEY, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || KEY) });
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const rpc = (fn, body) => timeout(fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: hdr(), body: JSON.stringify(body) }), 8000)
    .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.message || 'error'); return j; }));
  V14.init = api => { R = api; };

  // ---------- protocol content overlay ----------
  function apply(D, rows) {
    const by = {}; D.docs.forEach(d => { by[d.id] = d; });
    (rows || []).forEach(r => { const x = r.data || {};
      if (r.id === '_global') { if (x.updated) D.updated = x.updated; return; }
      const d = by[r.id]; if (d) ['title', 'updated', 'sections', 'media'].forEach(f => { if (x[f] !== undefined) d[f] = x[f]; });
    });
  }
  V14.load = function (D) {
    let cached = null; try { cached = JSON.parse(localStorage.getItem(CACHE_K)); } catch (e) {}
    return timeout(fetch(`${SB}/rest/v1/protocols_content?select=id,data`, { headers: hdr() }), 3500)
      .then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(rows => { try { localStorage.setItem(CACHE_K, JSON.stringify(rows)); } catch (e) {} apply(D, rows); D._online = true; return D; })
      .catch(() => { if (Array.isArray(cached)) apply(D, cached); return D; });
  };

  // ---------- short server-saved plan links ----------
  const cloud = () => { try { return JSON.parse(localStorage.getItem(CLOUD_K)); } catch (e) { return null; } };
  V14.savePayload = function (payload) {
    const c = cloud();
    const go = c && c.id && c.token ? rpc('save_plan', { p_payload: payload, p_id: c.id, p_token: c.token }).catch(() => rpc('save_plan', { p_payload: payload })) : rpc('save_plan', { p_payload: payload });
    return go.then(j => { localStorage.setItem(CLOUD_K, JSON.stringify({ id: j.id, token: j.token })); return location.href.split('#')[0] + '#/s/' + j.id + '.' + j.token; });
  };
  const qrHtml = url => { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return `<div class="qr">${q.createSvgTag({ cellSize: 4, margin: 4, scalable: true })}</div>`; } catch (e) { return ''; } };
  function setShare(inputId, copyId, shareId, url, qrScope) {
    const i = $(inputId); if (!i) return; i.value = url;
    const c = $(copyId); if (c) c.onclick = () => { i.select(); const ok = () => { c.textContent = 'Copied'; }; navigator.clipboard ? navigator.clipboard.writeText(url).then(ok, () => { document.execCommand('copy'); ok(); }) : (document.execCommand('copy'), ok()); };
    const s = shareId && $(shareId); if (s) s.onclick = () => navigator.share({ title: 'My COSMC rehab plan', url }).catch(() => {});
    const box = qrScope && qrScope.querySelector('.qr'); const nq = qrHtml(url);
    if (box && nq) box.outerHTML = nq; else if (nq && qrScope) { const p = qrScope.querySelector('.note'); if (p && /too much|too long/i.test(p.textContent)) p.outerHTML = nq; }
  }
  // athlete "Save my plan": keep the offline hash link, then upgrade it to a short server link
  V14.wrapSave = function () {
    const b = $('mksave'); if (!b || b._v14) return; b._v14 = 1; const orig = b.onclick;
    b.onclick = () => {
      orig();
      const L = $('slink'); if (!L) return;
      let payload; try { payload = V13.b64d(L.value.split('#/r/')[1]); } catch (e) { return; }
      const st = document.createElement('p'); st.className = 'note'; st.id = 'cloudmsg'; st.textContent = 'Saving a short link...'; L.insertAdjacentElement('afterend', st);
      V14.savePayload(payload).then(url => { setShare('slink', 'scopy', 'sshare', url, $('saveout')); st.textContent = 'Short link saved online. Opening it on any phone restores this plan. Re-save after changes; the same link updates.'; })
        .catch(() => { st.textContent = 'Offline or server busy: this longer link still works and holds everything.'; });
    };
  };
  // staff link: store the same payload, show a short link
  V14.wrapStaff = function (o) {
    const L = $('olink'); if (!L) return;
    const st = document.createElement('p'); st.className = 'note'; st.textContent = 'Making a short link...'; L.insertAdjacentElement('afterend', st);
    const prev = localStorage.getItem(CLOUD_K); localStorage.removeItem(CLOUD_K);
    V14.savePayload(o).then(url => { setShare('olink', 'ocopy', null, url, $('out')); st.textContent = 'Short link saved online. When the athlete taps Save my plan later, this same link updates with their progress.'; })
      .catch(() => { st.textContent = 'Offline or server busy: using the longer link, which works without the server.'; })
      .finally(() => { if (prev) localStorage.setItem(CLOUD_K, prev); else localStorage.removeItem(CLOUD_K); });
  };
  function openShort(arg) {
    const [id, token] = String(arg || '').split('.');
    const main = $('main'); V5.setHead('Opening your plan', 'Loading from the clinic link...', 'COSMC Sports Medicine');
    main.innerHTML = '<p class="loading">Loading your plan...</p>';
    if (!/^[A-Za-z0-9]{16}$/.test(id || '')) { main.innerHTML = `<div class="card"><h3>Link not recognized</h3>${V13.missingHtml()}</div>`; return; }
    rpc('get_plan', { p_id: id }).then(p => {
      if (!p || typeof p !== 'object') throw new Error('none');
      if (/^[A-Za-z0-9]{24}$/.test(token || '')) localStorage.setItem(CLOUD_K, JSON.stringify({ id, token }));
      const enc = V13.b64e(p);
      if (p.kind === 'save') V5.routes.r(enc); else V5.routes.a(enc);
    }).catch(() => { main.innerHTML = `<div class="card"><h3>Could not load this plan</h3><p>You may be offline, or the link is incomplete. Try again with a connection.</p>${V13.missingHtml()}</div>`; });
  }

  // ---------- admin (Supabase Auth) ----------
  const sess = () => { try { const s = JSON.parse(sessionStorage.getItem(SESS_K)); return s && s.exp > Date.now() / 1000 + 30 ? s : null; } catch (e) { return null; } };
  function admin() {
    R.setTitle('Admin'); R.navActive(''); V5.setHead('Admin', 'Protocol text, dates and media.', 'COSMC Sports Medicine');
    if (sess()) return panel();
    $('main').innerHTML = `<div class="card"><div class="cardhead"><h3>Admin sign in</h3></div>
      <form id="alog"><label class="f" for="aem">Email</label><input class="search" id="aem" type="email" autocomplete="username" required>
      <label class="f" for="apw">Password</label><input class="search" id="apw" type="password" autocomplete="current-password" required>
      <div class="btns"><button class="btn" type="submit">Sign in</button></div></form><p class="note" id="amsg" aria-live="polite"></p>
      <p class="disc-mini">Admin only. Sign-ups are disabled.</p></div>`;
    $('alog').onsubmit = e => {
      e.preventDefault(); $('amsg').textContent = 'Signing in...';
      fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: hdr(), body: JSON.stringify({ email: $('aem').value.trim(), password: $('apw').value }) })
        .then(r => r.json()).then(j => {
          if (!j.access_token) { $('amsg').textContent = 'Sign in failed. Check the email and password.'; return; }
          sessionStorage.setItem(SESS_K, JSON.stringify({ tok: j.access_token, exp: j.expires_at || (Date.now() / 1000 + 3000) })); panel();
        }).catch(() => { $('amsg').textContent = 'Could not reach the server.'; });
    };
  }
  const esc = s => R.esc(s);
  function upsert(id, data) {
    const s = sess(); if (!s) return Promise.reject(new Error('Signed out. Sign in again.'));
    return fetch(`${SB}/rest/v1/protocols_content`, { method: 'POST', headers: Object.assign(hdr(s.tok), { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }) })
      .then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.message || 'Save failed'); }); });
  }
  function upload(path, file) {
    const s = sess(); if (!s) return Promise.reject(new Error('Signed out. Sign in again.'));
    return fetch(`${SB}/storage/v1/object/media/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.tok, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file })
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.message || 'Upload failed'); return `${SB}/storage/v1/object/public/media/${path}`; }));
  }
  function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function cleanData() { const D = R.DATA, o = {}; Object.keys(D).forEach(k => { if (k[0] !== '_') o[k] = D[k]; }); o.docs = D.docs.map(d => { const c = {}; Object.keys(d).forEach(k => { if (k[0] !== '_') c[k] = d[k]; }); return c; }); return o; }
  function panel() {
    const D = R.DATA, slug = V13.exKey;
    const opts = D.categories.map(c => `<optgroup label="${esc(c)}">${D.docs.filter(x => x.category === c).map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</optgroup>`).join('');
    $('main').innerHTML = `<div class="flag"><strong>Signed in as admin.</strong> Saves go live for everyone right away.</div>
      <div class="card"><div class="cardhead"><h3>All protocols</h3></div>
        <label class="f" for="aupd">Last updated (default for all)</label><input type="date" id="aupd" value="${esc(D.updated || '')}">
        <div class="btns"><button class="btn secondary sm" id="aupds">Save date</button><button class="btn secondary sm" id="aexp">Export backup (data.json)</button><button class="btn danger sm" id="aout">Sign out</button></div>
        <p class="note" id="admsg" aria-live="polite"></p></div>
      <div class="card"><div class="cardhead"><h3>Edit a protocol</h3></div><label class="f" for="adoc">Protocol</label><select id="adoc"><option value="">Choose...</option>${opts}</select><div id="aed"></div></div>`;
    const msg = t => { $('admsg').textContent = t; };
    $('aout').onclick = () => { sessionStorage.removeItem(SESS_K); admin(); };
    $('aupds').onclick = () => upsert('_global', { updated: $('aupd').value }).then(() => { D.updated = $('aupd').value; msg('Saved.'); }, e => msg(e.message));
    $('aexp').onclick = () => { const s = JSON.stringify(cleanData()); dl('data.json', s, 'application/json'); setTimeout(() => dl('data.js', 'window.COLE_DATA=' + s + ';\n', 'text/javascript'), 400); msg('Downloaded a backup of the current data.'); };
    $('adoc').onchange = () => editor($('adoc').value);
    function editor(id) {
      const d = R.BY_ID[id], box = $('aed'); if (!d) { box.innerHTML = ''; return; }
      const ex = V13.exList(d), M = Object.assign({}, d.media || {});
      box.innerHTML = `<label class="f" for="et">Title</label><input class="search" id="et" value="${esc(d.title)}">
        <label class="f" for="eu">Last updated</label><input type="date" id="eu" value="${esc(d.updated || '')}">
        <h3 class="sect">Text</h3><p class="note">One line per line. Blank lines are kept as spacing.</p>
        ${(d.sections || []).map((s, i) => `<details class="sec"><summary>${esc(s.title || 'Section ' + (i + 1))}</summary><div class="secbody">
          <label class="f" for="es${i}">Section title</label><input class="search" id="es${i}" value="${esc(s.title || '')}">
          <label class="f" for="el${i}">Lines</label><textarea class="search" id="el${i}" rows="8">${esc(s.lines.map(l => l ? l.t : '').join('\n'))}</textarea></div></details>`).join('')}
        <h3 class="sect">Exercise media</h3><p class="note">Upload a photo or video, or paste an https link (YouTube embeds). Empty shows the "coming soon" box.</p>
        <div class="medlist">${ex.map((t, i) => { const k = slug(t), m = M[k] || {}; return `<details class="sec"><summary>${m.src ? '● ' : ''}${esc(t.slice(0, 70))}</summary><div class="secbody">
          <label class="f" for="mf${i}">Upload image or video</label><input type="file" id="mf${i}" data-i="${i}" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime">
          <label class="f" for="mt${i}">Type</label><select id="mt${i}">${['', 'video', 'image', 'link'].map(o => `<option value="${o}" ${(m.type || '') === o ? 'selected' : ''}>${o || 'None'}</option>`).join('')}</select>
          <label class="f" for="mu${i}">Link</label><input class="search" id="mu${i}" value="${esc(m.src || '')}" placeholder="https://...">
          <label class="f" for="mc${i}">Caption</label><input class="search" id="mc${i}" maxlength="140" value="${esc(m.caption || '')}"><p class="note" id="mm${i}"></p></div></details>`; }).join('') || '<p class="note">No exercise items found in this document.</p>'}</div>
        <div class="btns"><button class="btn" id="esave">Save and publish</button><a class="btn secondary" href="#/p/${esc(d.id)}">View protocol</a></div><p class="note" id="emsg" aria-live="polite"></p>`;
      box.querySelectorAll('input[type=file]').forEach(f => f.onchange = () => {
        const i = +f.dataset.i, file = f.files[0]; if (!file) return;
        if (file.size > 50 * 1024 * 1024) { $('mm' + i).textContent = 'File is over 50 MB.'; return; }
        const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
        $('mm' + i).textContent = 'Uploading...';
        upload(`${d.id}/${slug(ex[i])}-${Date.now().toString(36)}.${ext}`, file).then(url => {
          $('mu' + i).value = url; $('mt' + i).value = /^video/.test(file.type) ? 'video' : 'image'; $('mm' + i).textContent = 'Uploaded. Tap Save and publish.';
        }, e => { $('mm' + i).textContent = e.message; });
      });
      $('esave').onclick = () => {
        const media = {}, bad = [];
        ex.forEach((t, i) => { const ty = $('mt' + i).value, src = $('mu' + i).value.trim(), cap = $('mc' + i).value.trim(); if (!src) return; if (!/^https:\/\/[^\s"'<>]+$/i.test(src) && !V13.safeSrc(src)) { bad.push(t.slice(0, 30)); return; } media[slug(t)] = { type: ty || 'video', src, caption: cap }; });
        if (bad.length) { $('emsg').textContent = 'Use an https:// link for: ' + bad.join(', '); return; }
        const secs = (d.sections || []).map((s, i) => { const lines = $('el' + i).value.replace(/\r/g, '').split('\n').map((t, j) => { if (!t.trim()) return null; const o = s.lines[j]; return o ? Object.assign({}, o, { t }) : { t, l: 1, k: 'item' }; }); return Object.assign({}, s, { title: $('es' + i).value.trim() || s.title, lines }); });
        const data = { title: $('et').value.trim() || d.title, updated: $('eu').value || d.updated, sections: secs, media };
        $('emsg').textContent = 'Saving...';
        upsert(d.id, data).then(() => { Object.assign(d, data); try { localStorage.removeItem(CACHE_K); } catch (e) {} $('emsg').textContent = 'Saved and live. Athletes see it next time the app loads online.'; }, e => { $('emsg').textContent = e.message; });
      };
    }
  }
  V14.register = () => { V5.routes.admin = admin; V5.routes.s = openShort; };
})();
