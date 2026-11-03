'use strict';
/* PrintPress ERP (online) - talks to Supabase with plain fetch(): login (Auth), shared data (REST) and
   artwork files (Storage). There is no extra library to install.

   Exposes three globals:  Cloud (login, config, rpc, change detection)
                           DB    (same small API the app always used: all/get/put/del/clear/exportAll/importAll)
                           Files (artwork file upload/download)                                           */

class CloudError extends Error {
  constructor(message, o = {}) { super(message); this.name = 'CloudError'; Object.assign(this, o); }
}

const Cloud = (() => {
  const POLL_MS = 5000;
  let cfg = null, session = null, refreshing = null;
  const mem = {};   // fallback when localStorage is blocked
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch { delete mem[k]; } }
  };
  const net = ok => window.dispatchEvent(new Event(ok ? 'pp-online' : 'pp-offline'));

  /* ---------- configuration ---------- */
  function loadConfig() {
    const c = window.PP_CONFIG || {};
    let url = String(c.supabaseUrl || '').trim(), key = String(c.supabaseAnonKey || '').trim();
    if (!url || !key) {
      try { const l = JSON.parse(LS.get('pp-config') || '{}'); url = url || l.url || ''; key = key || l.key || ''; } catch { /* ignore */ }
    }
    url = url.replace(/\/+$/, '');
    cfg = url && key ? { url, key } : null;
    return cfg;
  }
  function validateConfig(url, key) {
    url = String(url || '').trim().replace(/\/+$/, ''); key = String(key || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url))
      return 'The Project URL should look like https://abcdefgh.supabase.co';
    if (key.split('.').length !== 3) return 'The key should be the long "anon public" key (it has two dots in it). Do NOT use the service_role key.';
    try {
      const p = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (p.role === 'service_role') return 'That is the secret service_role key. Never put it in the app. Use the "anon public" key.';
    } catch { /* not decodable: let the connection check decide */ }
    return '';
  }
  function saveConfig(url, key) {
    LS.set('pp-config', JSON.stringify({ url: String(url).trim().replace(/\/+$/, ''), key: String(key).trim() }));
    return loadConfig();
  }
  function clearConfig() { LS.del('pp-config'); cfg = null; }
  /* "Connect another device" link:  https://your-app/#cfg=<base64 of url|key>  (the anon key is public by design) */
  function shareLink() {
    if (!cfg) return '';
    return location.origin + location.pathname + '#cfg=' + encodeURIComponent(btoa(cfg.url + '|' + cfg.key));
  }
  function consumeConfigHash() {
    const m = /[#&]cfg=([^&]+)/.exec(location.hash || ''); if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const [url, key] = atob(decodeURIComponent(m[1])).split('|');
      if (Cloud_validate(url, key)) return false;
      saveConfig(url, key); return true;
    } catch { return false; }
  }
  const Cloud_validate = (u, k) => validateConfig(u, k);

  /* ---------- session ---------- */
  function jwtPayload(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; } }
  function setSession(r) {
    if (!r) { session = null; LS.del('pp-session'); return; }
    const p = jwtPayload(r.access_token);
    session = {
      access_token: r.access_token, refresh_token: r.refresh_token || session?.refresh_token,
      expires_at: r.expires_at || p.exp || Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
      user: { id: r.user?.id || p.sub, email: r.user?.email || p.email || session?.user?.email || '' }
    };
    LS.set('pp-session', JSON.stringify(session));
  }
  function restoreSession() {
    try { const s = JSON.parse(LS.get('pp-session') || 'null'); if (s?.access_token && s?.user?.id) session = s; } catch { /* ignore */ }
    return session;
  }
  async function refresh() {
    if (!session?.refresh_token) throw new CloudError('Please sign in again.', { authExpired: true });
    if (!refreshing) {
      refreshing = (async () => {
        let res;
        try {
          res = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        } catch { net(false); throw new CloudError('No internet connection. Please check your connection and try again.', { offline: true }); }
        if (!res.ok) { setSession(null); throw new CloudError('Your session expired. Please sign in again.', { authExpired: true }); }
        net(true); setSession(await res.json());
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  /* ---------- low-level HTTP ---------- */
  async function toError(res) {
    let j = {}; try { j = await res.json(); } catch { /* not json */ }
    const raw = j.message || j.msg || j.error_description || (typeof j.error === 'string' ? j.error : '') || res.statusText || 'Request failed';
    const code = j.code ?? j.error_code ?? j.error ?? '';
    const perm = res.status === 403 || String(code) === '42501' || /row-level security|permission denied|not allowed/i.test(raw);
    const conflict = res.status === 409 || String(code) === '23505';
    return new CloudError(perm ? 'You do not have permission to do that.' : raw, { status: res.status, code: String(code), perm, conflict, raw, details: j.details, hint: j.hint });
  }
  async function http(path, { method = 'GET', headers = {}, body, auth = true, retry = true, raw = false } = {}) {
    if (!cfg) throw new CloudError('The app is not connected to Supabase yet.');
    const h = { apikey: cfg.key, ...headers };
    if (auth && session) {
      if (session.expires_at - 60 < Date.now() / 1000) await refresh();
      h.Authorization = 'Bearer ' + session.access_token;
    } else h.Authorization = 'Bearer ' + cfg.key;
    let res;
    try { res = await fetch(cfg.url + path, { method, headers: h, body }); }
    catch { net(false); throw new CloudError('No internet connection. Please check your connection and try again.', { offline: true }); }
    net(true);
    if (res.status === 401 && auth && session && retry) {
      try { session.expires_at = 0; await refresh(); } catch (e) { throw e; }
      return http(path, { method, headers, body, auth, retry: false, raw });
    }
    if (!res.ok) throw await toError(res);
    if (raw) return res;
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }
  const JSONH = { 'Content-Type': 'application/json' };
  const rest = (path, o) => http('/rest/v1' + path, o);
  const send = (path, method, obj, extra = {}, o = {}) => http(path, { method, headers: { ...JSONH, ...extra }, body: JSON.stringify(obj), ...o });
  const rpc = (fn, args) => send('/rest/v1/rpc/' + fn, 'POST', args || {});

  /* ---------- login ---------- */
  const authMsg = e => {
    const m = e.raw || e.message || '';
    if (/invalid login credentials|invalid_credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first: open the message Supabase sent you and click the link.';
    if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Use Sign in (or "Forgot password").';
    if (/password should be at least|weak/i.test(m)) return 'Choose a longer password (at least 6 characters).';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
    if (/signups? (not allowed|disabled)/i.test(m)) return 'New accounts are switched off in Supabase. Ask the administrator to add you.';
    return m || 'Something went wrong. Please try again.';
  };
  async function authCall(path, method, body, extraHeaders) {
    try { return await http(path, { method, headers: { ...JSONH, ...(extraHeaders || {}) }, body: body ? JSON.stringify(body) : undefined, auth: !!session && path.includes('/user') }); }
    catch (e) { if (!e.offline) e.message = authMsg(e); throw e; }
  }
  async function signIn(email, password) {
    const r = await authCall('/auth/v1/token?grant_type=password', 'POST', { email: email.trim(), password });
    setSession(r); return session;
  }
  async function signUp(email, password, name) {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    const r = await authCall(`/auth/v1/signup?redirect_to=${redirect}`, 'POST', { email: email.trim(), password, data: { name: (name || '').trim() } });
    if (r?.access_token) { setSession(r); return { signedIn: true }; }
    return { needsConfirm: true };
  }
  async function recover(email) {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    await authCall(`/auth/v1/recover?redirect_to=${redirect}`, 'POST', { email: email.trim() });
  }
  async function updatePassword(password) { await authCall('/auth/v1/user', 'PUT', { password }); }
  async function signOut() {
    stopSync();
    try { if (session) await http('/auth/v1/logout', { method: 'POST', headers: JSONH, body: '{}' }); } catch { /* ignore */ }
    setSession(null);
  }
  /* The link in Supabase emails (password reset / confirm) comes back as  #access_token=...&type=recovery */
  function consumeHash() {
    const h = location.hash || '';
    if (!/access_token=|error=/.test(h)) return null;
    const p = new URLSearchParams(h.replace(/^#\/?/, ''));
    history.replaceState(null, '', location.pathname + location.search + '#/dashboard');
    if (p.get('error')) return { error: (p.get('error_description') || 'That link is not valid.').replace(/\+/g, ' ') };
    setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600 });
    return { type: p.get('type') || 'signup' };
  }

  /* ---------- profile / permissions / users ---------- */
  async function loadProfile() {
    const rows = await rest(`/profiles?id=eq.${session.user.id}&select=*`);
    return rows?.[0] || null;
  }
  async function loadPerms(role) {
    const rows = await rest(`/role_perms?role=eq.${encodeURIComponent(role)}&select=store,can_read,can_write,can_delete`);
    const m = {}; (rows || []).forEach(r => { m[r.store] = { r: !!r.can_read, w: !!r.can_write, d: !!r.can_delete }; });
    return m;
  }
  const listProfiles = () => rest('/profiles?select=*&order=created_at.asc');
  async function updateProfile(id, patch) {
    const rows = await send(`/rest/v1/profiles?id=eq.${id}`, 'PATCH', patch, { Prefer: 'return=representation' });
    if (!rows?.length) throw new CloudError('You do not have permission to do that.', { perm: true });
    return rows[0];
  }

  /* ---------- change detection (other people's edits) ---------- */
  let timer = null, last = null, onChange = null, busy = false;
  async function tick() {
    if (busy || document.hidden || !navigator.onLine || !session) return;
    busy = true;
    try {
      const st = await rpc('sync_state');
      if (last) {
        const keys = new Set([...Object.keys(last), ...Object.keys(st || {})]);
        const changed = [...keys].filter(k => JSON.stringify(last[k]) !== JSON.stringify((st || {})[k]));
        if (changed.length && onChange) onChange(changed);
      }
      last = st || {};
    } catch (e) { if (e.authExpired) window.dispatchEvent(new Event('pp-auth-expired')); }
    finally { busy = false; }
  }
  function startSync(cb) { stopSync(); onChange = cb; last = null; timer = setInterval(tick, POLL_MS); tick(); }
  function stopSync() { if (timer) clearInterval(timer); timer = null; last = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) tick(); });
  window.addEventListener('online', () => { if (timer) tick(); });

  /* ---------- connection check (shown on the setup screen and in Settings) ---------- */
  async function check() {
    const out = []; const add = (ok, name, hint = '') => out.push({ ok, name, hint });
    if (!cfg) { add(false, 'Project URL and key', 'Enter them first.'); return out; }
    let settings = null;
    try {
      const r = await fetch(cfg.url + '/auth/v1/settings', { headers: { apikey: cfg.key } });
      if (r.ok) { settings = await r.json(); add(true, 'Supabase project reachable, key accepted'); }
      else add(false, 'Supabase project reachable, key accepted', r.status === 401 || r.status === 403 ? 'Supabase rejected the key. Copy the "anon public" key again from Project Settings > API.' : `Supabase answered with error ${r.status}. Check the Project URL.`);
    } catch { add(false, 'Supabase project reachable', 'Could not connect. Check your internet and that the Project URL is correct.'); return out; }
    if (!out[0].ok) return out;
    try {
      const r = await fetch(cfg.url + '/rest/v1/records?select=id&limit=1', { headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key } });
      const j = await r.json().catch(() => ({}));
      const missing = r.status === 404 || /PGRST20[0-9]|42P01/.test(String(j.code)) || /could not find the table|does not exist/i.test(j.message || '');
      add(!missing, 'Database tables installed', missing ? 'The tables are missing. Run supabase/schema.sql in Supabase > SQL Editor (see SETUP.md, step 3).' : '');
    } catch { add(false, 'Database tables installed', 'Could not reach the database.'); }
    if (settings) {
      add(!settings.disable_signup, 'Staff can create their own accounts',
        settings.disable_signup ? 'Sign-ups are switched off in Supabase (Authentication > Sign In / Providers). Staff would have to be invited from the Supabase dashboard.' : '');
      add(!!settings.mailer_autoconfirm, 'No email confirmation needed to sign in',
        settings.mailer_autoconfirm ? '' : 'Email confirmation is ON. Staff must click a link in an email first (Supabase sends only a few emails per hour on the free plan). Simplest for a small shop: turn off "Confirm email" in Authentication > Sign In / Providers > Email.');
    }
    if (session) {
      try {
        const p = await loadProfile();
        add(!!p, 'Your staff profile exists', p ? `Signed in as ${p.email}, role: ${p.role}` : 'No profile row. The schema.sql was run after you signed up? Sign up again with the owner email.');
        if (p && p.role !== 'pending') {
          const perms = await loadPerms(p.role); add(Object.keys(perms).length > 0, 'Role permissions loaded');
          try {
            await http('/storage/v1/object/list/artwork', { method: 'POST', headers: JSONH, body: JSON.stringify({ prefix: '', limit: 1 }) });
            add(true, 'Artwork file storage ready');
          } catch (e) { add(false, 'Artwork file storage ready', e.status === 404 ? 'The "artwork" storage bucket is missing. Re-run schema.sql (SETUP.md step 3).' : e.message); }
          try { await rpc('sync_state'); add(true, 'Database functions installed'); }
          catch (e) { add(false, 'Database functions installed', 'Re-run schema.sql completely (SETUP.md step 3).'); }
        }
      } catch (e) { add(false, 'Signed-in checks', e.message); }
    }
    return out;
  }

  return {
    loadConfig, saveConfig, clearConfig, validateConfig, shareLink, consumeConfigHash, config: () => cfg,
    restoreSession, session: () => session, user: () => session?.user,
    signIn, signUp, recover, updatePassword, signOut, consumeHash,
    loadProfile, loadPerms, listProfiles, updateProfile,
    rpc, rest, send, http, JSONH,
    startSync, stopSync, check, CloudError
  };
})();

/* =====================================================================
   DB: the same small API the app already uses, now backed by one shared table
   ===================================================================== */
const DB = (() => {
  const STORES = ['customers', 'orders', 'jobs', 'inventory', 'movements', 'invoices', 'artworks', 'expenses', 'settings', 'suppliers', 'employees', 'pay_rates', 'attendance', 'payroll'];
  const REV = new Map();           // 'store/id' -> revision we last saw (edit-conflict detection)
  const touched = new Set();       // stores we changed ourselves since the last reload
  const key = (s, i) => s + '/' + i;
  const enc = encodeURIComponent;
  const conflict = why => new CloudError('Someone else changed this record at the same time.', { conflict: true, why });
  const PAGE = 1000;

  async function all(store) {
    const out = []; let off = 0;
    for (;;) {
      const rows = await Cloud.rest(`/records?store=eq.${store}&select=id,data,rev&order=id.asc&limit=${PAGE}&offset=${off}`);
      (rows || []).forEach(r => { REV.set(key(store, r.id), r.rev); out.push(r.data); });
      if (!rows || rows.length < PAGE) break;
      off += PAGE;
    }
    return out;
  }
  async function get(store, id) {
    const rows = await Cloud.rest(`/records?store=eq.${store}&id=eq.${enc(id)}&select=data,rev`);
    if (!rows?.length) return undefined;
    REV.set(key(store, id), rows[0].rev);
    return rows[0].data;
  }
  async function put(store, obj) {
    const k = key(store, obj.id), rev = REV.get(k);
    touched.add(store);
    if (rev == null) {
      try {
        const rows = await Cloud.send('/rest/v1/records', 'POST', { store, id: obj.id, data: obj }, { Prefer: 'return=representation' });
        REV.set(k, rows[0].rev);
      } catch (e) { if (e.conflict) throw conflict('exists'); throw e; }
      return obj.id;
    }
    const rows = await Cloud.send(`/rest/v1/records?store=eq.${store}&id=eq.${enc(obj.id)}&rev=eq.${rev}`, 'PATCH', { data: obj }, { Prefer: 'return=representation' });
    if (rows?.length) { REV.set(k, rows[0].rev); return obj.id; }
    // nothing changed: either somebody else edited it, it was deleted, or we may not edit it
    const now = await Cloud.rest(`/records?store=eq.${store}&id=eq.${enc(obj.id)}&select=rev`);
    if (!now?.length) { REV.delete(k); throw conflict('deleted'); }
    if (now[0].rev !== rev) throw conflict('changed');
    throw new CloudError('You do not have permission to do that.', { perm: true });
  }
  async function del(store, id) {
    touched.add(store);
    const rows = await Cloud.http(`/rest/v1/records?store=eq.${store}&id=eq.${enc(id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (rows?.length) { REV.delete(key(store, id)); return; }
    const still = await Cloud.rest(`/records?store=eq.${store}&id=eq.${enc(id)}&select=id`);
    if (still?.length) throw new CloudError('You do not have permission to do that.', { perm: true });
  }
  async function clear(store) {
    touched.add(store);
    await Cloud.http(`/rest/v1/records?store=eq.${store}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    for (const k of [...REV.keys()]) if (k.startsWith(store + '/')) REV.delete(k);
  }
  async function exportAll() {
    const out = {};
    for (const s of STORES) out[s] = await all(s);
    return out;
  }
  async function importAll(data) {
    for (const s of STORES) {
      await clear(s);
      const rows = (data[s] || []).filter(o => o && o.id).map(o => ({ store: s, id: String(o.id), data: o }));
      let batch = [], size = 0;
      const flush = async () => { if (batch.length) { await Cloud.send('/rest/v1/records', 'POST', batch, { Prefer: 'return=minimal,resolution=merge-duplicates' }); batch = []; size = 0; } };
      for (const r of rows) {
        const n = JSON.stringify(r).length;
        if (size + n > 700000 || batch.length >= 200) await flush();
        batch.push(r); size += n;
      }
      await flush();
    }
  }
  /* changes that must be atomic on the server (two people never overwrite each other's stock) */
  async function adjustStock(itemId, delta, type, note, date) {
    const r = await Cloud.rpc('adjust_stock', { p_item: itemId, p_delta: delta, p_type: type, p_note: note || '', p_date: date });
    REV.set(key('inventory', itemId), r.rev);
    touched.add('inventory'); touched.add('movements');
    return r;
  }
  async function setOrderStatus(id, status) {
    await Cloud.rpc('order_set_status', { p_id: id, p_status: status });
    try {   // the status is already saved; this only refreshes our edit-conflict marker
      const rows = await Cloud.rest(`/records?store=eq.orders&id=eq.${enc(id)}&select=rev`);
      if (rows?.length) REV.set(key('orders', id), rows[0].rev);
    } catch (e) { REV.delete(key('orders', id)); }
    touched.add('orders');
  }
  const takeTouched = () => { const t = [...touched]; touched.clear(); return t; };
  const forget = () => { REV.clear(); touched.clear(); };

  return { STORES, all, get, put, del, clear, exportAll, importAll, adjustStock, setOrderStatus, takeTouched, forget };
})();

/* =====================================================================
   Files: artwork proofs live in the private "artwork" storage bucket
   ===================================================================== */
const Files = (() => {
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');
  return {
    async upload(path, blob, upsert = false) {
      const fd = new FormData();
      fd.append('cacheControl', '3600');
      fd.append('', blob);
      await Cloud.http(`/storage/v1/object/artwork/${encPath(path)}`, { method: 'POST', headers: { 'x-upsert': upsert ? 'true' : 'false' }, body: fd });
    },
    async download(path) {
      try { return await (await Cloud.http(`/storage/v1/object/authenticated/artwork/${encPath(path)}`, { raw: true })).blob(); }
      catch (e) {
        if (!e.offline && !e.authExpired && (e.status === 404 || e.status === 400)) throw new CloudError('This proof file is no longer in storage (backup files do not contain artwork files).', { missing: true });
        throw e;
      }
    },
    async remove(paths) {
      paths = (paths || []).filter(Boolean);
      if (!paths.length) return;
      await Cloud.http('/storage/v1/object/artwork', { method: 'DELETE', headers: Cloud.JSONH, body: JSON.stringify({ prefixes: paths }) });
    }
  };
})();
