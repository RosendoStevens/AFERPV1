'use strict';
/* BizManager ERP (online): start-up, login screens, staff & roles screen, live refresh. */

/* ---------- connection / network banner ---------- */
const netbar = on => { const n = $('#netbar'); if (n) n.hidden = on; };
window.addEventListener('pp-offline', () => netbar(false));
window.addEventListener('pp-online', () => netbar(true));
window.addEventListener('offline', () => netbar(false));
window.addEventListener('online', () => netbar(true));
window.addEventListener('pp-auth-expired', () => { leaveApp(); showAuth('login', 'Your session expired. Please sign in again.'); });

/* ---------- connection check results ---------- */
const checkHtml = list => `<ul class="checks">${list.map(c => `<li class="${c.ok ? 'ok' : 'bad'}"><span>${c.ok ? '✓' : '✗'}</span><div><b>${esc(c.name)}</b>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</div></li>`).join('')}</ul>`;
ACT.runCheck = async () => {
  const out = $('#checkOut'); if (!out) return;
  out.innerHTML = '<p class="muted">Checking…</p>';
  out.innerHTML = checkHtml(await Cloud.check());
};

/* ---------- login screens ---------- */
const configFromFile = () => !!(window.PP_CONFIG && window.PP_CONFIG.supabaseUrl);
const authField = (label, name, type = 'text', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" required ${extra}></label>`;
const AUTH = {
  setup: () => `<h2>Connect to your database</h2>
    ${window.PP_CONFIG_ERR ? '<div class="auth-msg err">The file <code>config.js</code> has a typing mistake (' + esc(window.PP_CONFIG_ERR) + '). Open it and check that both values are inside quotes, separated by a comma, with no line breaks inside the key. Straight quotes only (\' or "), not curly quotes.</div>' : window.PP_CONFIG === undefined ? '<div class="auth-msg err">The file <code>config.js</code> was not found on your web host. Upload it next to <code>index.html</code>.</div>' : (!configFromFile() ? '<div class="auth-msg err"><code>config.js</code> on your web host is empty. Fill in <code>supabaseUrl</code> and <code>supabaseAnonKey</code> in the copy you upload, then reload this page (or enter them below on this device).</div>' : '')}
    <p class="muted">Paste the two values from your Supabase project (Project Settings &gt; API). Your administrator can also put them in <code>config.js</code> once, so nobody has to type them.</p>
    <form data-form="setup" class="stack" autocomplete="off">
      ${authField('Project URL', 'url', 'url', 'placeholder="https://abcdefgh.supabase.co" inputmode="url"')}
      ${authField('anon public key', 'key', 'text', 'placeholder="eyJhbGciOi…" autocapitalize="off" spellcheck="false"')}
      <button class="btn btn-primary" type="submit">Save and test</button>
    </form><div id="authCheck"></div>`,
  login: () => `<h2>Sign in</h2>
    <form data-form="login" class="stack">
      ${authField('Email', 'email', 'email', 'autocomplete="username" inputmode="email"')}
      ${authField('Password', 'password', 'password', 'autocomplete="current-password"')}
      <button class="btn btn-primary" type="submit">Sign in</button>
    </form>
    <div class="auth-links"><a href="#" data-auth="forgot">Forgot password?</a><a href="#" data-auth="signup">New staff member? Create account</a>${configFromFile() ? '' : '<a href="#" data-auth="setup">Connection settings</a>'}</div>`,
  signup: () => `<h2>Create your account</h2>
    <p class="muted">After you sign up, the administrator gives you a role (Manager, Sales, Designer or Production) and you can start working.</p>
    <form data-form="signup" class="stack">
      ${authField('Your name', 'name', 'text', 'autocomplete="name"')}
      ${authField('Email', 'email', 'email', 'autocomplete="username" inputmode="email"')}
      ${authField('Password (at least 8 characters)', 'password', 'password', 'autocomplete="new-password" minlength="8"')}
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>
    <div class="auth-links"><a href="#" data-auth="login">I already have an account</a></div>`,
  forgot: () => `<h2>Reset password</h2>
    <p class="muted">We will email you a link to choose a new password.</p>
    <form data-form="forgot" class="stack">${authField('Email', 'email', 'email', 'autocomplete="username" inputmode="email"')}<button class="btn btn-primary" type="submit">Send reset link</button></form>
    <div class="auth-links"><a href="#" data-auth="login">Back to sign in</a></div>`,
  recovery: () => `<h2>Choose a new password</h2>
    <form data-form="recovery" class="stack">${authField('New password (at least 8 characters)', 'password', 'password', 'autocomplete="new-password" minlength="8"')}<button class="btn btn-primary" type="submit">Save password</button></form>`,
  pending: () => `<h2>Waiting for approval</h2>
    <p>Your account <b>${esc(Cloud.user()?.email || '')}</b> has been created. The administrator needs to give you a role before you can open the app.</p>
    <p class="muted">Ask them to open <b>Staff &amp; Roles</b> and choose a role for you, then press the button below.</p>
    <div class="row"><button class="btn btn-primary" data-act="authRetry">Check again</button><button class="btn" data-act="signOut">Sign out</button></div>`,
  inactive: () => `<h2>Account switched off</h2><p>Your account has been deactivated by the administrator. Please speak to them if this is a mistake.</p><div class="row"><button class="btn btn-primary" data-act="authRetry">Check again</button><button class="btn" data-act="signOut">Sign out</button></div>`,
  noprofile: () => `<h2>Account not set up</h2><p>You are signed in, but the staff profile was not created. This usually means <code>schema.sql</code> was run after this account was created. Ask the administrator to follow step 3 of SETUP.md, then sign out and create the account again.</p><div id="authCheck">${'<p class="muted">Checking…</p>'}</div><div class="row"><button class="btn" data-act="authRetry">Check again</button><button class="btn" data-act="signOut">Sign out</button></div>`,
  fatal: () => `<h2>Cannot open the database</h2><p id="fatalMsg" class="muted"></p><div id="authCheck"><p class="muted">Checking…</p></div><div class="row"><button class="btn btn-primary" data-act="authRetry">Try again</button><button class="btn" data-act="signOut">Sign out</button></div>`
};
let authScreen = '';
function showAuth(screen, msg = '', kind = 'err') {
  Cloud.stopSync(); stopProfileWatch();
  $('#app').hidden = true; const a = $('#auth'); a.hidden = false;
  document.title = 'BizManager ERP';
  authScreen = screen;
  a.innerHTML = `<div class="auth-card"><div class="auth-brand">${ic('production', 26)}<b>BizManager ERP</b></div><div id="authMsgBox">${msg ? `<div class="auth-msg ${kind}" role="alert">${esc(msg)}</div>` : ''}</div>${AUTH[screen]()}</div>`;
  const first = $('input', a); if (first && window.innerWidth > 700) first.focus();
  if (screen === 'noprofile' || screen === 'fatal') Cloud.check().then(r => { const b = $('#authCheck'); if (b) b.innerHTML = checkHtml(r); });
  if (screen === 'fatal') { const f = $('#fatalMsg'); if (f) f.textContent = msg; $('#authMsgBox').innerHTML = ''; }
}
const setAuthMsg = (msg, kind = 'err') => { const b = $('#authMsgBox'); if (b) b.innerHTML = msg ? `<div class="auth-msg ${kind}" role="alert">${esc(msg)}</div>` : ''; };
document.addEventListener('click', e => { const a = e.target.closest('[data-auth]'); if (!a) return; e.preventDefault(); showAuth(a.dataset.auth); });

const FORMS = {
  async setup(f) {
    const url = f.get('url'), key = f.get('key'), bad = Cloud.validateConfig(url, key);
    if (bad) return setAuthMsg(bad);
    Cloud.saveConfig(url, key); setAuthMsg('');
    $('#authCheck').innerHTML = '<p class="muted">Testing the connection…</p>';
    const r = await Cloud.check();
    $('#authCheck').innerHTML = checkHtml(r) + `<div class="row" style="margin-top:12px"><button class="btn btn-primary" data-auth="login">${r.every(c => c.ok) ? 'Continue to sign in' : 'Continue anyway'}</button></div>`;
  },
  async login(f) {
    setAuthMsg('');
    await Cloud.signIn(f.get('email'), f.get('password'));
    await enter();
  },
  async signup(f) {
    setAuthMsg('');
    const r = await Cloud.signUp(f.get('email'), f.get('password'), f.get('name'));
    if (r.signedIn) return enter();
    showAuth('login', 'Account created. Please check your email and click the confirmation link, then sign in here.', 'ok');
  },
  async forgot(f) {
    await Cloud.recover(f.get('email'));
    showAuth('login', 'If that email has an account, a reset link is on its way. Open it on this device.', 'ok');
  },
  async recovery(f) {
    await Cloud.updatePassword(f.get('password'));
    toast('Password changed');
    await enter();
  }
};
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const btn = $('button[type=submit]', f); if (btn) btn.disabled = true;
  try { await FORMS[f.dataset.form](new FormData(f)); }
  catch (err) { setAuthMsg(err.offline ? err.message : (err.message || 'Something went wrong.')); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});

/* ---------- entering and leaving the app ---------- */
function leaveApp() {
  Cloud.stopSync(); stopProfileWatch(); DB.forget();
  ME.profile = null; ME.perms = {};
  STORES.forEach(s => { S[s] = []; }); S.users = []; S.rolePerms = [];
  if (typeof NOTIF !== 'undefined') { NOTIF.list = []; NOTIF.unread = 0; NOTIF.ready = false; renderBell(); }
  closeModal();
}
async function enter() {
  try {
    const profile = await Cloud.loadProfile();
    if (!profile) return showAuth('noprofile');
    ME.profile = profile;
    if (!profile.active) return showAuth('inactive');
    if (profile.role === 'pending') return showAuth('pending');
    ME.perms = await Cloud.loadPerms(profile.role);
    await loadAll();
    await migrateStages();
    if (typeof loadNotifs === 'function') { NOTIF.first = true; NOTIF.seen = new Set(); await loadNotifs(false); }
    applyTheme(); buildNav();
    $('#auth').hidden = true; $('#auth').innerHTML = ''; $('#app').hidden = false;
    if (!location.hash || /access_token|^#?$/.test(location.hash)) location.hash = '#/dashboard';
    route();
    Cloud.startSync(onRemoteChange); startProfileWatch();
  } catch (e) {
    if (e.authExpired) return showAuth('login', 'Please sign in again.');
    showAuth('fatal', e.offline ? e.message : (e.message || 'Unexpected error') + (e.status ? ` (error ${e.status})` : ''));
  }
}
/* version 1 had no Design step: the administrator's first sign-in adds it in front and renumbers the job cards */
async function migrateStages() {
  if (S.settings.stagesVer === 2 || !isAdmin()) return;
  const cur = STAGES.slice(), has = /^design$/i.test(cur[0]);
  await applyStages(has ? cur : ['Design', ...cur], n => has ? n : n + 1);
}
ACT.shareLink = async () => {
  const link = Cloud.shareLink(); if (!link) return toast('Not connected yet');
  try { await navigator.clipboard.writeText(link); toast('Link copied. Open it on the other device.'); }
  catch { prompt('Copy this link and open it on the other device:', link); }
};
ACT.authRetry = () => enter();
ACT.signOut = async () => { await Cloud.signOut(); leaveApp(); showAuth('login'); };
ACT.myName = async () => {
  const name = (prompt('Your name', ME.profile?.name || '') || '').trim(); if (!name) return;
  ME.profile = await Cloud.updateProfile(ME.profile.id, { name }); buildNav(); refresh(); toast('Name updated');
};
ACT.myPassword = () => openModal('Change password', `<div class="stack">${field('New password (at least 8 characters)', '<input id="pw1" type="password" autocomplete="new-password" minlength="8">')}${field('Type it again', '<input id="pw2" type="password" autocomplete="new-password">')}</div>`,
  `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="doPassword">Change password</button>`, 'sm');
ACT.doPassword = async () => {
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 8) return toast('Use at least 8 characters');
  if (a !== b) return toast('The two passwords are different');
  await Cloud.updatePassword(a); closeModal(); toast('Password changed');
};

/* ---------- live refresh when somebody else changes something ---------- */
let pendingReload = false;
async function softReload() {
  pendingReload = false;
  try { await loadAll(); } catch (e) { return; }
  applyTheme(); buildNav();
  if (current === 'settings') return;                       // never wipe a form that is being filled in
  const ae = document.activeElement, typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && $('#view').contains(ae);
  if (typing && $('#list')) refreshList(); else if (!typing) refresh();
}
function onRemoteChange(changed = []) {
  if (changed.includes('notifications') && typeof loadNotifs === 'function') loadNotifs(true);
  if (changed.length && changed.every(k => k === 'notifications')) return;
  if ($('.overlay')) { pendingReload = true; return; }      // keep an open form consistent; refresh when it closes
  softReload();
}
function onModalClosed() { if (pendingReload && ME.profile) setTimeout(softReload, 0); }
/* if the administrator changes this person's role or switches the account off, apply it within a minute */
let profileTimer = null;
function startProfileWatch() {
  stopProfileWatch();
  profileTimer = setInterval(async () => {
    if (document.hidden || !navigator.onLine || !ME.profile) return;
    try {
      const p = await Cloud.loadProfile();
      let permsChanged = false;
      if (p && p.role === ME.profile.role && p.active) { const np = await Cloud.loadPerms(p.role); const norm = x => JSON.stringify(Object.keys(x).sort().map(k => [k, x[k]])); permsChanged = norm(np) !== norm(ME.perms); }
      if (!p || p.role !== ME.profile.role || p.active !== ME.profile.active || permsChanged) { toast('Your access was changed. Reloading…'); setTimeout(() => location.reload(), 1200); }
    } catch (e) { /* offline: try again next time */ }
  }, 60000);
}
function stopProfileWatch() { if (profileTimer) clearInterval(profileTimer); profileTimer = null; }

/* ---------- Staff & Roles (administrator) ---------- */
const STORE_LABEL = { suppliers: 'Suppliers', employees: 'Staff list', pay_rates: 'Pay rates', attendance: 'Attendance', payroll: 'Payroll', customers: 'Customers', orders: 'Orders & quotes', jobs: 'Job cards', inventory: 'Inventory', movements: 'Stock history', invoices: 'Invoices', artworks: 'Artwork', expenses: 'Expenses', settings: 'Settings' };
/* Attendance on / off for each login: ON puts the person in the Attendance staff list (linked to their login) */
const empOfUser = uid_ => S.employees.find(e => e.userId === uid_);
const attOn = u => { const e = empOfUser(u.id); return !!e && e.active !== false; };
const attSwitch = u => `<label class="sw-toggle" title="${u.role === 'pending' ? 'Give this person a role first' : 'Include in Attendance'}"><input type="checkbox" data-change="userAtt" data-id="${u.id}" aria-label="Attendance for ${esc(u.name || u.email)}"${attOn(u) ? ' checked' : ''}${u.role === 'pending' || !can('employees', 'w') ? ' disabled' : ''}><span></span></label>`;
const KIND_OF_ROLE = { admin: 'Management', manager: 'Management', sales: 'Sales / Office', designer: 'Designer', production: 'Machine operator' };
CHG.userAtt = async el => {
  const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
  try {
    let e = empOfUser(u.id);
    if (el.checked) {
      if (e) e = { ...e, active: true };
      else {
        const byName = S.employees.find(x => !x.userId && x.name.trim().toLowerCase() === (u.name || '').trim().toLowerCase() && u.name);
        const nextNo = String(Math.max(0, ...S.employees.map(x => parseInt(x.empNo, 10) || 0)) + 1).padStart(3, '0');
        e = byName ? { ...byName, userId: u.id, active: true } : { id: uid(), name: u.name || u.email, empNo: nextNo, kind: KIND_OF_ROLE[u.role] || 'Other', position: roleName(u.role), phone: '', joined: String(u.created_at || '').slice(0, 10), biometricId: '', userId: u.id, active: true, createdAt: Date.now() };
      }
      await DB.put('employees', e); toast(`${u.name || u.email} added to Attendance`);
    } else if (e) { await DB.put('employees', { ...e, active: false }); toast(`${u.name || u.email} removed from Attendance (history kept)`); }
  } catch (err) { showErr(err); }
  await loadAll(); refresh();
};
VIEWS.users = () => {
  const users = [...S.users].sort((a, b) => (a.role === 'pending' ? 0 : 1) - (b.role === 'pending' ? 0 : 1) || String(a.created_at).localeCompare(String(b.created_at)));
  const me = ME.profile?.id;
  const rows = users.map(u => {
    const self = u.id === me;
    const roleSel = `<select data-change="userRole" data-id="${u.id}" ${self ? 'disabled title="You cannot change your own role"' : ''}>${u.role === 'pending' ? '<option value="pending" selected>Choose a role…</option>' : ''}${opts(ROLES, u.role)}</select>`;
    return `<tr class="${u.role === 'pending' && u.active ? 'row-hl' : ''}"><td data-label="Name"><b>${esc(u.name || '—')}</b>${self ? ' <small style="display:inline">(you)</small>' : ''}<small>${esc(u.email)}</small></td><td data-label="Role">${roleSel}</td><td data-label="Status">${u.active ? badge('Active') : badge('Off')}</td><td data-label="Attendance">${attSwitch(u)}</td><td data-label="Joined">${fmtDate(u.created_at)}</td><td class="noL r">${self ? '' : `<button class="btn btn-sm ${u.active ? 'btn-danger' : ''}" data-act="userActive" data-id="${u.id}">${u.active ? 'Switch off' : 'Switch on'}</button>`}</td></tr>`;
  }).join('');
  const roles = ROLES.map(r => r[0]);
  const stores = Object.keys(STORE_LABEL);
  const cell = (role, store) => { const p = S.rolePerms.find(x => x.role === role && x.store === store); if (!p || !p.can_read) return '<span class="muted">—</span>'; return p.can_write ? (p.can_delete ? 'Full' : 'Edit') : 'View'; };
  return `<div class="page-head"><h2>Staff & Roles</h2><div class="actions"><button class="btn" data-act="usersRefresh">Refresh</button></div></div>
  <div class="alert info"><span><b>Adding staff:</b> send them the link to this app. They press <i>Create account</i>, then they appear here as <i>Choose a role…</i>. Pick a role and they can start working.</span></div>
  <div class="card"><h3>Team (${users.length})</h3>${users.length ? `<table class="rtable"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Attendance</th><th>Joined</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('No staff yet')}</div>
  <div class="card section"><h3>What each role can do</h3>
    <div class="scroll-x"><table class="rtable matrix"><thead><tr><th>Role</th>${stores.map(s => `<th>${STORE_LABEL[s]}</th>`).join('')}</tr></thead><tbody>${roles.map(r => `<tr><td data-label="Role"><b>${esc(roleName(r))}</b></td>${stores.map(s => `<td data-label="${esc(STORE_LABEL[s])}">${cell(r, s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="muted" style="margin:10px 0 0">View = can see · Edit = can add and change · Full = can also delete. Designers and operators can also move an order along its status (for example Design → Pending → In Production) without editing the order. To change what a role can do, use <b>Settings → Role permissions</b>.</p></div>`;
};
ACT.usersRefresh = async () => { await loadAll(); refresh(); toast('Refreshed'); };
CHG.userRole = async el => {
  const u = S.users.find(x => x.id === el.dataset.id); if (!u || el.value === u.role) return;
  if (el.value === 'pending') return;
  try { await Cloud.updateProfile(u.id, { role: el.value }); toast(`${u.name || u.email} is now ${roleName(el.value)}`); }
  catch (e) { toast(e.message); }
  await loadAll(); buildNav(); refresh();
};
ACT.userActive = async ({ id }) => {
  const u = S.users.find(x => x.id === id); if (!u) return;
  if (u.active && !confirm(`Switch off ${u.name || u.email}? They will not be able to sign in or see any data.`)) return;
  try { await Cloud.updateProfile(id, { active: !u.active }); toast(u.active ? 'Account switched off' : 'Account switched on'); }
  catch (e) { toast(e.message); }
  await loadAll(); refresh();
};
window.addEventListener('hashchange', () => { if (current === 'users' && ME.profile) loadAll().then(refresh).catch(() => {}); });

/* ---------- start ---------- */
async function boot() {
  S.settings = { ...DEFAULTS, mode: lsGet('pp-mode') || 'auto' }; applyTheme();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!navigator.onLine) netbar(false);
  Cloud.consumeConfigHash();                             // opened from a "connect another device" link
  if (!Cloud.loadConfig()) return showAuth('setup');
  Cloud.restoreSession();
  const h = Cloud.consumeHash();                         // arriving from an email link (confirm / reset password)
  if (h?.error) return showAuth('login', h.error);
  if (h?.type === 'recovery') return showAuth('recovery');
  if (!Cloud.session()) return showAuth('login');
  await enter();
}
boot();
