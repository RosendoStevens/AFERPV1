'use strict';
/* PrintPress ERP (online) - print shop management with a shared online database (Supabase),
   staff logins and roles. Connection code: js/backend.js. Login screens and the staff screen: js/online.js. */

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const r2 = x => Math.round((+x || 0) * 100) / 100;
const r3 = x => Math.round((+x || 0) * 1000) / 1000;
const nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nq = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s.length > 10 ? s : s + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const slug = s => String(s).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

/* ---------- constants ---------- */
const ORDER_STATUS = ['Pending', 'Design', 'In Production', 'Completed', 'Delivered', 'Cancelled'];
const QUOTE_STATUS = ['Draft', 'Sent', 'Accepted', 'Rejected'];
const OLD_STAGES = ['Pre-press', 'Printing', 'Cutting', 'Binding / Finishing', 'Quality Check', 'Ready'];   // version 1 of the app
const DEFAULT_STAGES = ['Design', 'Pre-press', 'Printing', 'Cutting', 'Binding / Finishing', 'Quality Check', 'Ready'];
let STAGES = DEFAULT_STAGES.slice();   // production steps; editable in Settings (shared by everyone)
const PRIORITIES = ['Normal', 'High', 'Urgent'];
const PAY_METHODS = ['Cash', 'Bank transfer', 'Cheque', 'Card', 'Mobile wallet', 'Other'];
const PRESETS = { blue: '#2563eb', emerald: '#059669', crimson: '#dc2626', purple: '#7c3aed', orange: '#ea580c', teal: '#0d9488', pink: '#db2777', slate: '#334155' };
const DEFAULTS = {
  id: 'main', shopName: 'My Print Shop', tagline: 'Quality printing, on time', address: '', phone: '', email: '', website: '', taxNo: '', logo: '',
  currency: 'NPR', taxLabel: 'VAT', taxRate: 0,
  prefixes: { quote: 'QT-', order: 'ORD-', job: 'JOB-', invoice: 'INV-', art: 'ART-' },
  counters: { quote: 0, order: 0, job: 0, invoice: 0, art: 0 },
  expenseCats: 'Paper & materials, Ink & consumables, Salaries & wages, Rent, Electricity & utilities, Machine maintenance, Transport & delivery, Marketing, Other',
  invoiceNote: 'Thank you for your business.', paymentInfo: '',
  stages: DEFAULT_STAGES.slice(), catalog: [], signature: '', stagesVer: 2,
  stdHours: 8, otMultiplier: 1.5, epfEmp: 8, epfEr: 12, etfEr: 3, epfBase: 'basic', shiftStart: '08:30', shiftEnd: '17:30', shiftBreak: 60,
  machines: 'Offset Press, Digital Press, Large Format, Cutting Machine',
  mode: 'auto', theme: 'blue', accent: '', lastBackup: ''
};

/* ---------- icons ---------- */
const ICONS = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  orders: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  customers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  production: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  inventory: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  billing: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  artwork: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  expenses: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  suppliers: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  attendance: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  payroll: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><line x1="8" y1="19" x2="12" y2="19"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'
};
const ic = (n, size = 20) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- state ---------- */
const STORES = ['customers', 'orders', 'jobs', 'inventory', 'movements', 'invoices', 'artworks', 'expenses', 'suppliers', 'employees', 'pay_rates', 'attendance', 'payroll'];
const S = { settings: null, customers: [], orders: [], jobs: [], inventory: [], movements: [], invoices: [], artworks: [], expenses: [], suppliers: [], employees: [], pay_rates: [], attendance: [], payroll: [], users: [], rolePerms: [] };
const ME = { profile: null, perms: {} };            // who is signed in, and what their role allows
let UI = { q: '', f: '', tab: 'all' };
let current = 'dashboard';
const VIEWS = {}, LIST = {}, ACT = {}, CHG = {};

const ROLES = [['admin', 'Administrator'], ['manager', 'Manager'], ['sales', 'Sales / Accounts'], ['designer', 'Designer'], ['production', 'Production / Operator']];
const roleName = r => r === 'pending' ? 'Waiting for approval' : (ROLES.find(x => x[0] === r) || [0, r || '—'])[1];
const can = (store, a = 'r') => !!ME.perms[store]?.[a];          // a = 'r' read, 'w' write, 'd' delete
const isAdmin = () => ME.profile?.role === 'admin';
const isMgr = () => ['admin', 'manager'].includes(ME.profile?.role);
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
// Only these settings are shared by everyone. Dark mode and "last backup" belong to each device.
const sharedOf = s => { const { counters, mode, lastBackup, ...rest } = s; return rest; };

/* what each button needs (the database enforces the same rules; this just hides what would be refused) */
const CSV_STORE = { suppliers: 'suppliers', attendance: 'attendance', payroll: 'payroll', customers: 'customers', orders: 'orders', invoices: 'invoices', sales: 'invoices', payments: 'invoices', inventory: 'inventory', expenses: 'expenses', artwork: 'artworks' };
const ACT_NEED = {
  newOrder: ['orders', 'w'], editOrder: ['orders', 'w'], delOrder: ['orders', 'd'], convert: ['orders', 'w'], custOrder: ['orders', 'w'],
  orderInvoice: ['invoices', 'w'], newInvoice: ['invoices', 'w'], editInv: ['invoices', 'w'], delInv: ['invoices', 'd'], savePay: ['invoices', 'w'], delPay: ['invoices', 'w'],
  saveDoc: d => d.kind === 'invoice' ? ['invoices', 'w'] : ['orders', 'w'],
  quickCust: ['customers', 'w'], custForm: ['customers', 'w'], saveCust: ['customers', 'w'], delCust: ['customers', 'd'],
  orderJob: ['jobs', 'w'], jobForm: ['jobs', 'w'], saveJob: ['jobs', 'w'], moveJob: ['jobs', 'w'], delJob: ['jobs', 'd'],
  itemForm: ['inventory', 'w'], saveItem: ['inventory', 'w'], delItem: ['inventory', 'd'], stockForm: ['inventory', 'w'], saveStock: ['inventory', 'w'],
  orderArt: ['artworks', 'w'], artForm: ['artworks', 'w'], saveArt: ['artworks', 'w'], verForm: ['artworks', 'w'], saveVer: ['artworks', 'w'], artSend: ['artworks', 'w'],
  apprForm: ['artworks', 'w'], saveAppr: ['artworks', 'w'], revForm: ['artworks', 'w'], saveRev: ['artworks', 'w'], artReopen: ['artworks', 'w'], delArt: ['artworks', 'd'],
  supForm: ['suppliers', 'w'], saveSup: ['suppliers', 'w'], delSup: ['suppliers', 'd'],
  empForm: ['employees', 'w'], saveEmp: ['employees', 'w'], delEmp: ['employees', 'd'],
  attMarkAll: ['attendance', 'w'], attNow: ['attendance', 'w'], attImport: ['attendance', 'w'], attPick: ['attendance', 'w'],
  payForm: ['payroll', 'w'], savePayroll: ['payroll', 'w'], payPaid: ['payroll', 'w'], payReopen: ['payroll', 'w'], delPayroll: ['payroll', 'd'], payAll: ['payroll', 'w'],
  jobMake: ['jobs', 'w'], jobPick: ['jobs', 'w'],
  expForm: ['expenses', 'w'], saveExp: ['expenses', 'w'], delExp: ['expenses', 'd'],
  saveSet: ['settings', 'w'], catForm: ['settings', 'w'], saveCat: ['settings', 'w'], delCat: ['settings', 'w'], pickSig: ['settings', 'w'], rmSig: ['settings', 'w'], userAtt: ['employees', 'w'], saveHr: ['settings', 'w'], saveStepAdd: ['settings', 'w'], saveStepMove: ['settings', 'w'], delStep: ['settings', 'w'], theme: ['settings', 'w'], pickLogo: ['settings', 'w'], rmLogo: ['settings', 'w'],
  backup: 'mgr', pickRestore: 'admin', eraseAll: 'admin', sample: 'admin',
  exportCsv: d => [CSV_STORE[d.kind] || 'customers', 'r']
};
function allowedAct(act, d = {}) {
  let n = ACT_NEED[act]; if (typeof n === 'function') n = n(d);
  if (!n) return true;
  if (n === 'admin') return isAdmin();
  if (n === 'mgr') return isMgr();
  return can(n[0], n[1]);
}
const VIEW_NEED = { suppliers: 'suppliers', attendance: 'attendance', payroll: 'payroll', orders: 'orders', artwork: 'artworks', customers: 'customers', production: 'jobs', inventory: 'inventory', billing: 'invoices', expenses: 'expenses', reports: 'invoices' };
const viewAllowed = k => k === 'users' ? isAdmin() : (!VIEW_NEED[k] || can(VIEW_NEED[k], 'r'));
/* hide the buttons this person may not use (rows and cards stay clickable so records can still be viewed) */
function applyPerms(root = document) {
  $$('[data-act]', root).forEach(el => { if (/^(BUTTON|A)$/.test(el.tagName) && !allowedAct(el.dataset.act, el.dataset)) el.style.display = 'none'; });
  $$('select[data-change="orderStatus"]', root).forEach(el => { if (el.dataset.type === 'quote' && !can('orders', 'w')) el.disabled = true; });
  if (current === 'settings' && !can('settings', 'w')) $$('#shopSettings input, #shopSettings textarea, #shopSettings select').forEach(i => { i.disabled = true; });
}
function showErr(err) {
  console.error(err);
  if (err?.conflict) { toast('Someone else changed this at the same time. The latest version is loaded now - please check it and try again.'); reload().catch(() => {}); return; }
  if (err?.perm) return toast('You do not have permission to do that.');
  toast(err?.offline ? err.message : 'Error: ' + (err?.message || err));
}

async function loadAll() {
  const res = await Promise.all(STORES.map(s => can(s, 'r') ? DB.all(s) : []));
  STORES.forEach((s, i) => { S[s] = res[i]; });
  const saved = can('settings', 'r') ? await DB.get('settings', 'main') : undefined;
  S.settings = { ...DEFAULTS, ...sharedOf(saved || {}), prefixes: { ...DEFAULTS.prefixes, ...(saved?.prefixes || {}) }, mode: lsGet('pp-mode') || 'auto', lastBackup: lsGet('pp-lastbackup') || '' };
  if (saved && saved.stagesVer !== 2) { S.settings.stages = Array.isArray(saved.stages) ? saved.stages : OLD_STAGES.slice(); S.settings.stagesVer = 1; }   // not yet upgraded by the administrator
  STAGES = Array.isArray(S.settings.stages) && S.settings.stages.length >= 2 ? S.settings.stages.map(String) : DEFAULT_STAGES.slice();
  if (!saved && can('settings', 'w')) { try { await DB.put('settings', sharedOf(S.settings)); } catch (e) { if (!e.conflict) throw e; } }
  if (isMgr()) { try { S.rolePerms = await Cloud.rest('/role_perms?select=*'); } catch (e) { console.warn(e); } }
  if (isAdmin()) { try { S.users = await Cloud.listProfiles(); } catch (e) { console.warn(e); } }
}
async function nextNo(kind) {
  const n = await Cloud.rpc('next_no', { p_kind: kind });          // the database hands out numbers one at a time
  return S.settings.prefixes[kind] + String(n).padStart(4, '0');
}
async function reload() { await loadAll(); refresh(); }
function setMode(v) { S.settings.mode = v; lsSet('pp-mode', v); applyTheme(); updateChrome(); }

/* ---------- money & calculations ---------- */
const money = n => `${esc(S.settings.currency)} ${nf.format(n || 0)}`;
function calc(doc) {
  const sub = r2((doc.items || []).reduce((a, i) => a + (+i.qty || 0) * (+i.rate || 0), 0));
  const disc = Math.min(r2(doc.discount), sub);
  const taxable = r2(sub - disc);
  const tax = r2(taxable * (+doc.taxRate || 0) / 100);
  return { sub, disc, taxable, tax, total: r2(taxable + tax) };
}
const invTotal = i => calc(i).total;
const paidAmt = i => r2((i.payments || []).reduce((a, p) => a + (+p.amount || 0), 0));
const balance = i => r2(invTotal(i) - paidAmt(i));
function invStatus(i) {
  const b = balance(i);
  if (b <= 0.005) return 'Paid';
  if (i.dueDate && i.dueDate < today()) return 'Overdue';
  return paidAmt(i) > 0 ? 'Partial' : 'Unpaid';
}
const cust = id => S.customers.find(c => c.id === id);
const outstanding = cid => r2(S.invoices.filter(i => i.customerId === cid).reduce((a, i) => a + balance(i), 0));
const isLow = i => (+i.min || 0) > 0 && (+i.stock || 0) <= (+i.min || 0);
const badge = s => `<span class="badge b-${slug(s)}">${esc(s)}</span>`;
const empty = (t, p = '', a = '') => `<div class="empty"><h4>${esc(t)}</h4><div>${esc(p)}</div>${a ? `<div style="margin-top:12px">${a}</div>` : ''}</div>`;
const opts = (list, sel) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
const field = (label, input, cls = '') => `<label class="field ${cls}"><span>${label}</span>${input}</label>`;

/* ---------- UI plumbing ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}
function openModal(title, body, footer = '', cls = '') {
  $('#modal-root').innerHTML = `<div class="overlay"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${ic('x')}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div></div>`;
  document.body.classList.add('modal-open');
  applyPerms($('#modal-root'));
  const first = $('.modal-body input:not([type=hidden]):not([type=file]), .modal-body select');
  if (first && window.innerWidth > 700) first.focus();
}
function closeModal() { $('#modal-root').innerHTML = ''; document.body.classList.remove('modal-open'); if (typeof onModalClosed === 'function') onModalClosed(); }
const refreshList = () => { const l = $('#list'); if (l && LIST[current]) { l.innerHTML = LIST[current](); applyPerms(l); } };
function refresh() { $('#view').innerHTML = VIEWS[current](); applyPerms($('#view')); updateChrome(); }
function route() {
  const h = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('?')[0];
  current = VIEWS[h] && viewAllowed(h) ? h : 'dashboard';
  UI = { q: '', f: '', tab: 'all', range: 'month', from: '', to: '' };
  closeDrawer(); closeModal();
  refresh(); window.scrollTo(0, 0);
}
const NAV = [['dashboard', 'Dashboard'], ['orders', 'Orders & Quotes'], ['artwork', 'Design & Artwork'], ['customers', 'Customers'], ['production', 'Production'], ['inventory', 'Inventory'], ['suppliers', 'Suppliers'], ['billing', 'Billing'], ['expenses', 'Expenses'], ['attendance', 'Attendance'], ['payroll', 'Payroll'], ['reports', 'Reports'], ['users', 'Staff & Roles'], ['settings', 'Settings']];
const BOTTOM = [['dashboard', 'Home'], ['orders', 'Orders'], ['production', 'Production'], ['billing', 'Billing']];
function buildNav() {
  const s = S.settings;
  $('#sidebar').innerHTML = `<div class="brand">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<div class="logo-fallback">${ic('production', 22)}</div>`}<span>${esc(s.shopName)}</span></div>` +
    NAV.filter(([k]) => viewAllowed(k)).map(([k, l]) => `<a class="nav-link" href="#/${k}" data-nav="${k}">${ic(k)}<span>${l}</span></a>`).join('') +
    `<div class="whoami"><b>${esc(ME.profile?.name || ME.profile?.email || '')}</b><small>${esc(roleName(ME.profile?.role))}</small><button class="btn btn-sm" data-act="signOut">Sign out</button><div style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.2);font-size:11px;line-height:1.5;opacity:.85">Powered by Titan Digital Solutions<br><a href="tel:+94771119930" style="color:inherit;text-decoration:none">+94771119930</a></div></div>`;
  $('#bottomnav').innerHTML = BOTTOM.filter(([k]) => viewAllowed(k)).map(([k, l]) => `<a href="#/${k}" data-nav="${k}">${ic(k, 22)}<span>${l}</span></a>`).join('') +
    `<button data-act="openDrawer">${ic('menu', 22)}<span>More</span></button>`;
  $('#menuBtn').innerHTML = ic('menu');
  updateChrome();
}
function updateChrome() {
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === current));
  $('#pageTitle').textContent = (NAV.find(n => n[0] === current) || [])[1] || 'BizManager';
  document.title = `${typeof NOTIF !== 'undefined' && NOTIF.unread ? '(' + NOTIF.unread + ') ' : ''}${S.settings.shopName} - ${$('#pageTitle').textContent}`;
  document.body.dataset.sec = current;
  if (typeof renderBell === 'function') renderBell();
  const dark = document.documentElement.dataset.mode === 'dark';
  $('#modeBtn').innerHTML = ic(dark ? 'sun' : 'moon');
}
const openDrawer = () => document.body.classList.add('drawer');
const closeDrawer = () => document.body.classList.remove('drawer');
function applyTheme() {
  const s = S.settings, r = document.documentElement;
  const color = s.accent || PRESETS[s.theme] || PRESETS.blue;
  r.style.setProperty('--primary', color);
  const mode = s.mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.mode;
  r.dataset.mode = mode;
  const m = $('meta[name=theme-color]'); if (m) m.content = color;
}
async function saveSettings() { if (!can('settings', 'w')) return; await DB.put('settings', sharedOf(S.settings)); }

/* ---------- files: CSV / download / print ---------- */
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function csv(rows) {
  return '﻿' + rows.map(r => r.map(v => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    v = String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\r\n');
}
function doPrint(html, name) {
  html = withSignature(html);
  const pa = $('#print-area'), old = document.title;
  pa.innerHTML = html; document.title = name;
  const done = () => { document.title = old; pa.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}

/* ---------- printable documents ---------- */
function letterhead(title, metaHtml) {
  const s = S.settings;
  return `<div class="pd-top"><div class="pd-head">${s.logo ? `<img class="pd-logo" src="${esc(s.logo)}" alt="">` : ''}<div><div class="pd-shop">${esc(s.shopName)}</div>${s.tagline ? `<div class="pd-sub">${esc(s.tagline)}</div>` : ''}<div class="pd-sub">${esc([s.address, s.phone, s.email, s.website].filter(Boolean).join(' · '))}</div>${s.taxNo ? `<div class="pd-sub">PAN/VAT: ${esc(s.taxNo)}</div>` : ''}</div></div><div class="pd-title">${esc(title)}<br><small>${metaHtml}</small></div></div>`;
}
function billTo(c, extra = '') {
  c = c || {};
  return `<div class="pd-cols"><div><h5>Bill to</h5><b>${esc(c.name || '—')}</b><br>${esc(c.contact || '')}${c.contact ? '<br>' : ''}${esc(c.address || '')}${c.address ? '<br>' : ''}${esc(c.phone || '')}${c.taxNo ? `<br>PAN/VAT: ${esc(c.taxNo)}` : ''}</div><div>${extra}</div></div>`;
}
function itemsTable(items) {
  return `<table class="pd-table"><thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.desc)}${i.size ? `<br><small>${esc(i.size)}</small>` : ''}</td><td class="r">${nq.format(i.qty)}</td><td class="r">${nf.format(i.rate)}</td><td class="r">${nf.format(r2(i.qty * i.rate))}</td></tr>`).join('')}</tbody></table>`;
}
function totalsPrint(d, extra = '') {
  const c = calc(d), s = S.settings;
  return `<div class="pd-tot"><div><span>Subtotal</span><span>${nf.format(c.sub)}</span></div>${c.disc ? `<div><span>Discount</span><span>- ${nf.format(c.disc)}</span></div>` : ''}${+d.taxRate ? `<div><span>${esc(s.taxLabel)} (${+d.taxRate}%)</span><span>${nf.format(c.tax)}</span></div>` : ''}<div class="g"><span>Total (${esc(s.currency)})</span><span>${nf.format(c.total)}</span></div>${extra}</div>`;
}
function printOrder(o) {
  const t = o.type === 'quote' ? 'QUOTATION' : 'ORDER';
  const html = `<div class="pd">${letterhead(t, `No: <b>${esc(o.no)}</b><br>Date: ${fmtDate(o.date)}<br>${o.type === 'quote' ? 'Valid until' : 'Due'}: ${fmtDate(o.dueDate)}`)}${billTo(cust(o.customerId), o.title ? `<h5>Job</h5><b>${esc(o.title)}</b>` : '')}${itemsTable(o.items || [])}${totalsPrint(o)}${o.notes ? `<div class="pd-note"><b>Notes:</b> ${esc(o.notes)}</div>` : ''}<div class="pd-sign"><span>Customer signature</span><span>Authorized signature</span></div></div>`;
  doPrint(html, o.no);
}
function printInvoice(inv) {
  const s = S.settings, paid = paidAmt(inv), bal = balance(inv);
  const extra = `<div><span>Paid</span><span>${nf.format(paid)}</span></div><div class="g"><span>Balance due</span><span>${nf.format(bal)}</span></div>`;
  const html = `<div class="pd">${letterhead('INVOICE', `No: <b>${esc(inv.no)}</b><br>Date: ${fmtDate(inv.date)}<br>Due: ${fmtDate(inv.dueDate)}${inv.orderNo ? `<br>Order: ${esc(inv.orderNo)}` : ''}`)}${billTo(cust(inv.customerId), `<h5>Status</h5><b>${invStatus(inv)}</b>`)}${itemsTable(inv.items || [])}${totalsPrint(inv, extra)}${s.paymentInfo ? `<div class="pd-note"><b>Payment details:</b>\n${esc(s.paymentInfo)}</div>` : ''}${inv.notes ? `<div class="pd-note"><b>Notes:</b> ${esc(inv.notes)}</div>` : ''}<div class="pd-sign"><span>Received by</span><span>Authorized signature</span></div>${s.invoiceNote ? `<div class="pd-foot">${esc(s.invoiceNote)}</div>` : ''}</div>`;
  doPrint(html, inv.no);
}
function printJob(j) {
  const o = S.orders.find(x => x.id === j.orderId), c = cust(o?.customerId), items = o?.items || [], arts = S.artworks.filter(a => a.orderId === j.orderId);
  const tbl = `<table class="pd-table"><thead><tr><th>#</th><th>Description</th><th>Size</th><th class="r">Qty</th></tr></thead><tbody>${items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.desc)}</td><td>${esc(i.size || '')}</td><td class="r">${nq.format(i.qty)}</td></tr>`).join('')}</tbody></table>`;
  const team = `<table class="pd-table"><thead><tr><th>Role</th><th>Name</th><th>Signature</th></tr></thead><tbody>${jobPeople(j).map(([l, v]) => `<tr><td>${l}</td><td>${esc(v || '')}</td><td style="width:35%"></td></tr>`).join('')}</tbody></table>`;
  const refs = (j.refs || []).length ? `<h5>Client references</h5><div class="pd-refs">${j.refs.map(r => isRaster(r) && thumbSrc(r) ? `<figure><img src="${esc(thumbSrc(r))}" alt=""><figcaption>${esc(r.name || '')}</figcaption></figure>` : `<div class="pd-file">${esc(r.name || 'File')}</div>`).join('')}</div>` : '';
  const html = `<div class="pd">${letterhead('JOB CARD', `No: <b>${esc(j.no)}</b><br>Priority: ${esc(j.priority)}<br>Order: ${esc(o?.no || '—')}<br>Due: ${fmtDate(j.dueDate)}`)}<div class="pd-cols"><div><h5>Customer</h5><b>${esc(c?.name || '—')}</b><br>${esc(c?.phone || '')}</div><div><h5>Job</h5><b>${esc(j.title)}</b><br>Current step: ${esc(STAGES[j.stage] || '')}</div></div>
    <h5>Order details</h5>${items.length ? tbl : ''}${o?.notes ? `<div class="pd-note"><b>Order notes:</b> ${esc(o.notes)}</div>` : ''}${j.brief ? `<div class="pd-note"><b>Design brief:</b> ${esc(j.brief)}</div>` : ''}${refs}
    ${arts.length ? `<h5>Artwork</h5><table class="pd-table"><tbody>${arts.map(a => `<tr><td>${esc(a.no)}</td><td>${esc(a.title)}</td><td>${esc(a.status)}${latestVer(a) ? ' (v' + latestVer(a).n + ')' : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <h5>Team</h5>${team}
    <h5>Process checklist</h5><ul class="pd-check">${STAGES.map(s => `<li>☐ ${esc(s)} &nbsp; ______ (initials) &nbsp; ______ (date)</li>`).join('')}</ul>${j.notes ? `<div class="pd-note"><b>Production notes:</b> ${esc(j.notes)}</div>` : ''}</div>`;
  doPrint(html, j.no);
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
VIEWS.dashboard = () => {
  const s = S.settings;
  const orders = S.orders.filter(o => o.type === 'order');
  const inProd = orders.filter(o => o.status === 'In Production').length;
  const done = orders.filter(o => ['Completed', 'Delivered'].includes(o.status)).length;
  const invoiced = r2(S.invoices.reduce((a, i) => a + invTotal(i), 0));
  const collected = r2(S.invoices.reduce((a, i) => a + paidAmt(i), 0));
  const low = S.inventory.filter(isLow).length;
  const monthExp = r2(S.expenses.filter(e => (e.date || '').startsWith(today().slice(0, 7))).reduce((a, e) => a + e.amount, 0));
  const presentToday = S.attendance.filter(a => a.date === today() && a.status === 'present').length;
  const overdue = S.invoices.filter(i => invStatus(i) === 'Overdue').length;
  const hasData = S.customers.length + S.orders.length + S.invoices.length + S.inventory.length > 0;
  const needBackup = hasData && isMgr() && (!s.lastBackup || Date.now() - new Date(s.lastBackup) > 7 * 864e5);
  const now = new Date(), months = [];
  for (let k = 5; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), n: 0 }); }
  orders.forEach(o => { const m = months.find(x => x.key === (o.date || '').slice(0, 7)); if (m) m.n++; });
  const mx = Math.max(1, ...months.map(m => m.n));
  const recent = [...S.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  let alerts = '';
  const pend = S.users.filter(u => u.role === 'pending' && u.active).length;
  if (pend) alerts += `<div class="alert"><span><b>${pend}</b> staff member${pend > 1 ? 's are' : ' is'} waiting for you to give them a role.</span><a class="btn btn-sm" href="#/users">Review</a></div>`;
  if (!hasData) alerts += `<div class="alert info"><span><b>Welcome!</b> Start by adding a customer, or load sample data to explore the app. Set up your shop details in Settings first.</span><button class="btn btn-primary btn-sm" data-act="sample">Load sample data</button><button class="btn btn-sm" data-act="custForm">Add customer</button></div>`;
  if (needBackup) alerts += `<div class="alert"><span><b>Backup reminder:</b> ${s.lastBackup ? 'your last backup was on ' + fmtDate(s.lastBackup) : 'you have not downloaded a backup from this device yet'}. The free Supabase plan does not make automatic backups.</span><button class="btn btn-primary btn-sm" data-act="backup">${ic('download', 16)} Download backup</button></div>`;
  if (low) alerts += `<div class="alert"><span><b>${low}</b> inventory item${low > 1 ? 's are' : ' is'} at or below the minimum level.</span><a class="btn btn-sm" href="#/inventory">View stock</a></div>`;
  const artWait = S.artworks.filter(a => a.status === 'Awaiting approval').length, artRev = S.artworks.filter(a => a.status === 'Revision requested').length;
  if (artWait) alerts += `<div class="alert"><span><b>${artWait}</b> artwork proof${artWait > 1 ? 's are' : ' is'} waiting for customer approval.</span><a class="btn btn-sm" href="#/artwork">View artwork</a></div>`;
  if (artRev) alerts += `<div class="alert"><span><b>${artRev}</b> artwork job${artRev > 1 ? 's need' : ' needs'} a revision.</span><a class="btn btn-sm" href="#/artwork">View artwork</a></div>`;
  if (overdue) alerts +=`<div class="alert"><span><b>${overdue}</b> invoice${overdue > 1 ? 's are' : ' is'} overdue.</span><a class="btn btn-sm" href="#/billing">View billing</a></div>`;
  return `
  <div class="page-head"><h2>Dashboard</h2><div class="actions"><button class="btn btn-primary" data-act="newOrder" data-type="order">${ic('plus', 16)} New order</button><button class="btn" data-act="newOrder" data-type="quote">${ic('plus', 16)} Quotation</button></div></div>
  ${alerts}
  <div class="grid4 tiles">
    <a class="tile t-orders" href="#/orders"><span>Total orders</span><b>${orders.length}</b><small>${S.orders.length - orders.length} open quotations</small></a>
    <a class="tile t-production" href="#/production"><span>In production</span><b>${inProd}</b><small>${S.jobs.filter(j => j.stage < STAGES.length - 1).length} active job cards</small></a>
    <a class="tile t-artwork" href="#/artwork"><span>Artwork waiting</span><b>${artWait + artRev}</b><small>${artWait} for approval · ${artRev} revisions</small></a>
    <a class="tile t-orders t-done" href="#/orders"><span>Completed</span><b>${done}</b><small>delivered or ready</small></a>
    ${can('invoices') ? `<a class="tile t-billing" href="#/billing"><span>Revenue (invoiced)</span><b>${money(invoiced)}</b><small>${money(collected)} collected</small></a>` : ''}
    ${can('expenses') ? `<a class="tile t-expenses" href="#/expenses"><span>Expenses this month</span><b>${money(monthExp)}</b><small>${S.expenses.filter(e => (e.date || '').startsWith(today().slice(0, 7))).length} entries</small></a>` : ''}
    ${can('inventory') ? `<a class="tile t-inventory" href="#/inventory"><span>Low stock</span><b>${low}</b><small>${S.inventory.length} items in stock list</small></a>` : ''}
    ${can('attendance') ? `<a class="tile t-attendance" href="#/attendance"><span>Present today</span><b>${presentToday} / ${S.employees.filter(e => e.active !== false).length}</b><small>staff attendance</small></a>` : ''}
  </div>
  <div class="grid2 section">
    <div class="card"><h3>Orders per month</h3><div class="bars">${months.map(m => `<div class="bar-col" title="${m.n} orders"><span class="bv">${m.n || ''}</span><div class="bar" style="height:${Math.round(m.n / mx * 100)}%"></div><small>${m.label}</small></div>`).join('')}</div></div>
    <div class="card"><h3>Recent orders</h3>${recent.length ? `<table class="rtable"><tbody>${recent.map(o => `<tr data-act="orderView" data-id="${o.id}"><td data-label="No."><b>${esc(o.no)}</b></td><td data-label="Customer">${esc(cust(o.customerId)?.name || '—')}</td><td data-label="Status">${badge(o.status)}</td></tr>`).join('')}</tbody></table>` : empty('No orders yet', 'Create a quotation or order to see it here.')}</div>
  </div>`;
};

/* =====================================================================
   ORDERS & QUOTES
   ===================================================================== */
LIST.orders = () => {
  let rows = [...S.orders].sort((a, b) => b.createdAt - a.createdAt);
  if (UI.tab !== 'all') rows = rows.filter(o => o.type === UI.tab);
  if (UI.f) rows = rows.filter(o => o.status === UI.f);
  const q = (UI.q || '').toLowerCase();
  if (q) rows = rows.filter(o => [o.no, o.title, cust(o.customerId)?.name].join(' ').toLowerCase().includes(q));
  if (!rows.length) return empty('Nothing found', 'Create a quotation or an order, or change the filters.');
  return `<table class="rtable"><thead><tr><th>No.</th><th>Customer / Job</th><th>Date</th><th>Due</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>${rows.map(o => `<tr data-act="orderView" data-id="${o.id}"><td data-label="No."><b>${esc(o.no)}</b>${o.type === 'quote' ? ' <small style="display:inline">(quote)</small>' : ''}</td><td data-label="Customer"><div>${esc(cust(o.customerId)?.name || '—')}</div><small>${esc(o.title || '')}</small></td><td data-label="Date">${fmtDate(o.date)}</td><td data-label="Due">${fmtDate(o.dueDate)}</td><td class="r" data-label="Total">${money(calc(o).total)}</td><td data-label="Status">${badge(o.status)}</td></tr>`).join('')}</tbody></table>`;
};
VIEWS.orders = () => `
  <div class="page-head"><h2>Orders & Quotations</h2><div class="actions"><button class="btn" data-act="newOrder" data-type="quote">${ic('plus', 16)} Quotation</button><button class="btn btn-primary" data-act="newOrder" data-type="order">${ic('plus', 16)} New order</button></div></div>
  <div class="tabs">${[['all', 'All'], ['quote', 'Quotations'], ['order', 'Orders']].map(([k, l]) => `<button class="tab${UI.tab === k ? ' on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="toolbar"><input type="search" placeholder="Search number, customer or job…" data-ui="q" value="${esc(UI.q)}"><select data-ui="f"><option value="">All statuses</option>${opts([...QUOTE_STATUS, ...ORDER_STATUS], UI.f)}</select><button class="btn" data-act="exportCsv" data-kind="orders">${ic('download', 16)} CSV</button></div>
  <div class="card" id="list">${LIST.orders()}</div>`;

const itemRow = (it = {}) => `<div class="item-row"><input class="i-desc" list="descs" placeholder="Item / description" value="${esc(it.desc || '')}"><input class="i-size" placeholder="Size (e.g. 6 x 3 ft)" value="${esc(it.size || '')}"><input class="i-qty" type="number" min="0" step="any" inputmode="decimal" placeholder="Qty" value="${it.qty ?? ''}"><span class="i-ratebox"><input class="i-rate" type="number" min="0" step="any" inputmode="decimal" placeholder="Rate" value="${it.rate ?? ''}"><button type="button" class="icon-btn calc-btn" data-act="calcOpen" title="Calculator" aria-label="Open calculator">${ic('calc', 18)}</button></span><span class="i-amt">0.00</span><button type="button" class="icon-btn" data-act="rmRow" aria-label="Remove row">${ic('x', 18)}</button></div>`;
function readItems() { return $$('.item-row').map(r => ({ desc: $('.i-desc', r).value.trim(), size: $('.i-size', r).value.trim(), qty: +$('.i-qty', r).value || 0, rate: +$('.i-rate', r).value || 0 })).filter(i => i.desc || i.qty || i.rate); }
function totalsHtml(c, rate) {
  const s = S.settings;
  return `<div><span>Subtotal</span><span>${money(c.sub)}</span></div>${c.disc ? `<div><span>Discount</span><span>- ${money(c.disc)}</span></div>` : ''}${rate ? `<div><span>${esc(s.taxLabel)} (${rate}%)</span><span>${money(c.tax)}</span></div>` : ''}<div class="grand"><span>Total</span><span>${money(c.total)}</span></div>`;
}
function recalc() {
  $$('.item-row').forEach(r => { $('.i-amt', r).textContent = nf.format((+$('.i-qty', r).value || 0) * (+$('.i-rate', r).value || 0)); });
  const rate = +$('#f-tax')?.value || 0;
  const t = $('#totals'); if (t) t.innerHTML = totalsHtml(calc({ items: readItems(), discount: $('#f-discount')?.value, taxRate: rate }), rate);
}
function docForm(kind, id, pre = {}) {
  const isInv = kind === 'invoice';
  const doc = id ? (isInv ? S.invoices : S.orders).find(x => x.id === id) : null;
  if (!S.customers.length && !doc) { toast('Add a customer first'); return ACT.custForm({}); }
  const type = doc?.type || pre.type || 'order';
  const d = doc || { type, customerId: pre.customerId || '', title: pre.title || '', date: today(), dueDate: addDays(today(), isInv ? 15 : 7), items: pre.items?.length ? pre.items : [{}], discount: pre.discount || 0, taxRate: pre.taxRate ?? S.settings.taxRate, notes: pre.notes || '', orderId: pre.orderId || '', orderNo: pre.orderNo || '' };
  const label = isInv ? 'Invoice' : (type === 'quote' ? 'Quotation' : 'Order');
  const descs = [...new Set([...(S.settings.catalog || []).map(c => c.name), ...S.orders, ...S.invoices].flatMap(x => (x.items || []).map(i => i.desc)).filter(Boolean))].slice(0, 80);
  const body = `<datalist id="descs">${descs.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="grid2">
      ${field('Customer *', `<div class="row" style="flex-wrap:nowrap"><select id="f-cust" style="flex:1"><option value="">Select customer…</option>${opts(S.customers.map(c => [c.id, c.name]), d.customerId)}</select><button type="button" class="btn" data-act="quickCust" title="Quick add customer">${ic('plus', 16)}</button></div>`)}
      ${isInv ? field('Order reference', `<input value="${esc(d.orderNo || '—')}" disabled>`) : field('Job title', `<input id="f-title" placeholder="e.g. Visiting cards 1000 pcs" value="${esc(d.title)}">`)}
      ${field('Date', `<input id="f-date" type="date" value="${esc(d.date)}">`)}
      ${field(isInv ? 'Due date' : (type === 'quote' ? 'Valid until' : 'Delivery due'), `<input id="f-due" type="date" value="${esc(d.dueDate)}">`)}
    </div>
    <h4 style="margin:16px 0 8px">Items</h4>
    ${catPicker()}
    <div id="items">${d.items.map(itemRow).join('')}</div>
    <button type="button" class="btn btn-sm" data-act="addRow">${ic('plus', 14)} Add item</button>
    <div class="grid2" style="margin-top:14px">
      ${field('Discount (amount)', `<input id="f-discount" type="number" min="0" step="any" inputmode="decimal" value="${+d.discount || ''}">`)}
      ${field(`${esc(S.settings.taxLabel)} %`, `<input id="f-tax" type="number" min="0" step="any" inputmode="decimal" value="${+d.taxRate || 0}">`)}
    </div>
    <div class="totals" id="totals"></div>
    ${field('Notes', `<textarea id="f-notes" placeholder="Terms, delivery notes…">${esc(d.notes)}</textarea>`, '')}`;
  openModal(`${doc ? 'Edit' : 'New'} ${label}${doc ? ' ' + doc.no : ''}`, body, `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveDoc" data-kind="${kind}" data-id="${doc ? doc.id : ''}" data-type="${type}" data-orderid="${esc(d.orderId || '')}" data-orderno="${esc(d.orderNo || '')}">Save</button>`);
  recalc();
}
ACT.newOrder = ({ type }) => docForm('order', null, { type });
ACT.addRow = () => { $('#items').insertAdjacentHTML('beforeend', itemRow()); $$('.i-desc').pop().focus(); };
ACT.rmRow = (_, el) => { const rows = $$('.item-row'); if (rows.length > 1) el.closest('.item-row').remove(); else $$('input', rows[0]).forEach(i => i.value = ''); recalc(); };
ACT.quickCust = async () => {
  const name = (prompt('New customer name') || '').trim(); if (!name) return;
  const c = { id: uid(), name, createdAt: Date.now() };
  await DB.put('customers', c); S.customers.push(c);
  const sel = $('#f-cust'); sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(name)}</option>`); sel.value = c.id;
};
ACT.saveDoc = async (ds) => {
  const isInv = ds.kind === 'invoice';
  const items = readItems().filter(i => i.desc && i.qty > 0);
  const customerId = $('#f-cust').value;
  if (!customerId) return toast('Select a customer');
  if (!items.length) return toast('Add at least one item with a quantity');
  const old = ds.id ? (isInv ? S.invoices : S.orders).find(x => x.id === ds.id) : null;
  const rec = { ...(old || {}), id: old?.id || uid(), customerId, date: $('#f-date').value || today(), dueDate: $('#f-due').value, items, discount: +$('#f-discount').value || 0, taxRate: +$('#f-tax').value || 0, notes: $('#f-notes').value.trim() };
  const total = calc(rec).total, c = cust(customerId);
  if (!old && c && +c.creditLimit > 0) {
    const out = outstanding(customerId) + (isInv ? total : 0);
    if (out > +c.creditLimit && !confirm(`${c.name} would be over the credit limit (${S.settings.currency} ${nf.format(c.creditLimit)}) with ${S.settings.currency} ${nf.format(out)} outstanding. Continue?`)) return;
  }
  if (isInv) {
    rec.orderId = old?.orderId || ds.orderid || ''; rec.orderNo = old?.orderNo || ds.orderno || ''; rec.payments = old?.payments || [];
    if (!old) rec.no = await nextNo('invoice');
  } else {
    rec.type = old?.type || ds.type; rec.title = $('#f-title').value.trim();
    rec.status = old?.status || (rec.type === 'quote' ? 'Draft' : 'Pending');
    if (!old) rec.no = await nextNo(rec.type === 'quote' ? 'quote' : 'order');
  }
  rec.createdAt = old?.createdAt || Date.now();
  await DB.put(isInv ? 'invoices' : 'orders', rec);
  closeModal(); await reload(); toast(`${rec.no} saved`);
  isInv ? ACT.invView({ id: rec.id }) : ACT.orderView({ id: rec.id });
};
ACT.orderView = ({ id }) => {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const c = cust(o.customerId), t = calc(o), jobs = S.jobs.filter(j => j.orderId === id), inv = S.invoices.find(i => i.orderId === id);
  const isQ = o.type === 'quote';
  const body = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><div><b style="font-size:18px">${esc(o.no)}</b> ${badge(o.status)}${o.quoteNo ? `<small>From quotation ${esc(o.quoteNo)}</small>` : ''}</div><label class="field" style="min-width:170px"><span>Status</span><select data-change="orderStatus" data-id="${o.id}" data-type="${o.type}">${opts(isQ ? QUOTE_STATUS : ORDER_STATUS, o.status)}</select></label></div>
    <dl class="kv"><dt>Customer</dt><dd>${esc(c?.name || '—')}${c?.phone ? ` · ${esc(c.phone)}` : ''}</dd><dt>Job</dt><dd>${esc(o.title || '—')}</dd><dt>Date</dt><dd>${fmtDate(o.date)}</dd><dt>${isQ ? 'Valid until' : 'Due'}</dt><dd>${fmtDate(o.dueDate)}</dd>${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ''}</dl>
    <table class="rtable" style="margin-top:12px"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${o.items.map(i => `<tr><td data-label="Item">${esc(i.desc)}${i.size ? `<small>${esc(i.size)}</small>` : ''}</td><td class="r" data-label="Qty">${nq.format(i.qty)}</td><td class="r" data-label="Rate">${nf.format(i.rate)}</td><td class="r" data-label="Amount">${nf.format(r2(i.qty * i.rate))}</td></tr>`).join('')}</tbody></table>
    <div class="totals">${totalsHtml(t, +o.taxRate || 0)}</div>
    ${jobs.length ? `<hr><b>Job cards</b>${jobs.map(j => `<div class="row" style="margin-top:6px"><a href="#" data-act="jobView" data-id="${j.id}">${esc(j.no)}</a> ${badge(STAGES[j.stage])}</div>`).join('')}` : ''}
    ${isQ ? '' : orderCostHtml(o)}
    ${isQ ? '' : `<hr><b>Artwork</b>${S.artworks.filter(a => a.orderId === o.id).map(a => `<div class="row" style="margin-top:6px"><a href="#" data-act="artView" data-id="${a.id}">${esc(a.no)}</a> <span>${esc(a.title)}</span> ${badge(a.status)}</div>`).join('') || '<p class="muted" style="margin:6px 0 0">No artwork added.</p>'}`}`;
  const foot = `<button class="btn btn-danger grow" data-act="delOrder" data-id="${o.id}">Delete</button><button class="btn" data-act="printOrder" data-id="${o.id}">${ic('printer', 16)} Print / PDF</button><button class="btn" data-act="editOrder" data-id="${o.id}">Edit</button>` +
    (isQ ? `<button class="btn btn-primary" data-act="convert" data-id="${o.id}">Convert to order</button>` :
      `<button class="btn" data-act="orderArt" data-id="${o.id}">Add artwork</button><button class="btn" data-act="orderJob" data-id="${o.id}">Send to production</button>${inv ? `<button class="btn btn-primary" data-act="invView" data-id="${inv.id}">View invoice</button>` : `<button class="btn btn-primary" data-act="orderInvoice" data-id="${o.id}">Create invoice</button>`}`);
  openModal(isQ ? 'Quotation' : 'Order', body, foot);
};
ACT.editOrder = ({ id }) => docForm('order', id);
ACT.printOrder = ({ id }) => printOrder(S.orders.find(o => o.id === id));
ACT.delOrder = async ({ id }) => {
  if (!confirm('Delete this record and its job cards? Invoices already created are kept.')) return;
  for (const j of S.jobs.filter(j => j.orderId === id)) { await DB.del('jobs', j.id); Files.remove((j.refs || []).map(r => r.path)).catch(() => {}); }
  for (const a of S.artworks.filter(a => a.orderId === id)) { a.orderId = ''; await DB.put('artworks', a); }
  for (const x of S.expenses.filter(x => x.orderId === id)) { x.orderId = ''; await DB.put('expenses', x); }
  await DB.del('orders', id); closeModal(); await reload(); toast('Deleted');
};
ACT.convert = async ({ id }) => {
  const o = S.orders.find(x => x.id === id);
  if (!confirm(`Convert ${o.no} into an order?`)) return;
  o.quoteNo = o.no; o.type = 'order'; o.status = 'Pending'; o.no = await nextNo('order');
  await DB.put('orders', o); await reload(); toast('Converted to order'); ACT.orderView({ id });
};
CHG.orderStatus = async el => {
  const o = S.orders.find(x => x.id === el.dataset.id); if (!o) return;
  if (o.type === 'order') await DB.setOrderStatus(o.id, el.value);   // designers / operators may move an order along without editing it
  else { o.status = el.value; await DB.put('orders', o); }
  await reload(); ACT.orderView({ id: o.id });
};
ACT.orderInvoice = ({ id }) => {
  const o = S.orders.find(x => x.id === id);
  docForm('invoice', null, { customerId: o.customerId, items: o.items, discount: o.discount, taxRate: o.taxRate, orderId: o.id, orderNo: o.no, notes: '' });
};
ACT.tab = ({ v }) => { UI.tab = v; refresh(); };

/* =====================================================================
   CUSTOMERS
   ===================================================================== */
LIST.customers = () => {
  let rows = [...S.customers].sort((a, b) => a.name.localeCompare(b.name));
  const q = (UI.q || '').toLowerCase();
  if (q) rows = rows.filter(c => [c.name, c.contact, c.phone, c.email].join(' ').toLowerCase().includes(q));
  if (!rows.length) return empty('No customers', 'Add your first customer.', `<button class="btn btn-primary" data-act="custForm">${ic('plus', 16)} New customer</button>`);
  return `<table class="rtable"><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th class="r">Orders</th><th class="r">Outstanding</th></tr></thead><tbody>${rows.map(c => { const out = outstanding(c.id); return `<tr data-act="custView" data-id="${c.id}"><td data-label="Name"><b>${esc(c.name)}</b></td><td data-label="Contact">${esc(c.contact || '—')}</td><td data-label="Phone">${esc(c.phone || '—')}</td><td class="r" data-label="Orders">${S.orders.filter(o => o.customerId === c.id).length}</td><td class="r" data-label="Outstanding">${out > 0 ? `<b style="color:var(--danger)">${money(out)}</b>` : money(0)}</td></tr>`; }).join('')}</tbody></table>`;
};
VIEWS.customers = () => `
  <div class="page-head"><h2>Customers</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="customers">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="custForm">${ic('plus', 16)} New customer</button></div></div>
  <div class="toolbar"><input type="search" placeholder="Search customers…" data-ui="q" value="${esc(UI.q)}"></div>
  <div class="card" id="list">${LIST.customers()}</div>`;
ACT.custForm = ({ id } = {}) => {
  const c = S.customers.find(x => x.id === id) || {};
  openModal(id ? 'Edit customer' : 'New customer', `<div class="grid2">
    ${field('Name *', `<input id="c-name" value="${esc(c.name)}">`)}${field('Contact person', `<input id="c-contact" value="${esc(c.contact)}">`)}
    ${field('Phone', `<input id="c-phone" type="tel" value="${esc(c.phone)}">`)}${field('Email', `<input id="c-email" type="email" value="${esc(c.email)}">`)}
    ${field('PAN / VAT no.', `<input id="c-tax" value="${esc(c.taxNo)}">`)}${field(`Credit limit (${esc(S.settings.currency)}, 0 = none)`, `<input id="c-limit" type="number" min="0" step="any" value="${+c.creditLimit || ''}">`)}
  </div><div class="stack" style="margin-top:12px">${field('Address', `<input id="c-addr" value="${esc(c.address)}">`)}${field('Special rates / price list', `<textarea id="c-prices" placeholder="e.g. Visiting cards 1000 pcs: 1,200">${esc(c.prices)}</textarea>`)}${field('Notes', `<textarea id="c-notes">${esc(c.notes)}</textarea>`)}</div>`,
    `${id ? `<button class="btn btn-danger grow" data-act="delCust" data-id="${id}">Delete</button>` : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveCust" data-id="${id || ''}">Save</button>`);
};
ACT.saveCust = async ({ id }) => {
  const name = $('#c-name').value.trim(); if (!name) return toast('Name is required');
  const old = S.customers.find(x => x.id === id) || {};
  const c = { ...old, id: old.id || uid(), name, contact: $('#c-contact').value.trim(), phone: $('#c-phone').value.trim(), email: $('#c-email').value.trim(), taxNo: $('#c-tax').value.trim(), creditLimit: +$('#c-limit').value || 0, address: $('#c-addr').value.trim(), prices: $('#c-prices').value.trim(), notes: $('#c-notes').value.trim(), createdAt: old.createdAt || Date.now() };
  await DB.put('customers', c); closeModal(); await reload(); toast('Customer saved');
};
ACT.delCust = async ({ id }) => {
  if (S.orders.some(o => o.customerId === id) || S.invoices.some(i => i.customerId === id)) return toast('This customer has orders or invoices and cannot be deleted');
  if (!confirm('Delete this customer?')) return;
  await DB.del('customers', id); closeModal(); await reload(); toast('Deleted');
};
ACT.custView = ({ id }) => {
  const c = cust(id); if (!c) return;
  const orders = S.orders.filter(o => o.customerId === id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const invs = S.invoices.filter(i => i.customerId === id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const out = outstanding(id);
  openModal(c.name, `<dl class="kv"><dt>Contact</dt><dd>${esc(c.contact || '—')}</dd><dt>Phone</dt><dd>${esc(c.phone || '—')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd><dt>Address</dt><dd>${esc(c.address || '—')}</dd><dt>PAN / VAT</dt><dd>${esc(c.taxNo || '—')}</dd><dt>Credit limit</dt><dd>${c.creditLimit ? money(c.creditLimit) : 'None'}</dd><dt>Outstanding</dt><dd><b style="color:${out > 0 ? 'var(--danger)' : 'inherit'}">${money(out)}</b></dd>${c.prices ? `<dt>Price list</dt><dd style="white-space:pre-wrap">${esc(c.prices)}</dd>` : ''}${c.notes ? `<dt>Notes</dt><dd style="white-space:pre-wrap">${esc(c.notes)}</dd>` : ''}</dl>
    <hr><b>Recent orders</b>${orders.length ? orders.map(o => `<div class="row" style="justify-content:space-between;padding:5px 0"><a href="#" data-act="orderView" data-id="${o.id}">${esc(o.no)}</a><span class="muted">${esc(o.title || '')}</span>${badge(o.status)}</div>`).join('') : '<p class="muted">None yet.</p>'}
    <hr><b>Recent invoices</b>${invs.length ? invs.map(i => `<div class="row" style="justify-content:space-between;padding:5px 0"><a href="#" data-act="invView" data-id="${i.id}">${esc(i.no)}</a><span>${money(invTotal(i))}</span>${badge(invStatus(i))}</div>`).join('') : '<p class="muted">None yet.</p>'}`,
    `<button class="btn" data-act="custForm" data-id="${id}">Edit</button><button class="btn btn-primary" data-act="custOrder" data-id="${id}">New order</button>`);
};
ACT.custOrder = ({ id }) => docForm('order', null, { type: 'order', customerId: id });

/* =====================================================================
   PRODUCTION
   ===================================================================== */
VIEWS.production = () => {
  const last = STAGES.length - 1, prio = { Urgent: 0, High: 1, Normal: 2 };
  const jobCard = j => {
    const o = S.orders.find(x => x.id === j.orderId), arts = S.artworks.filter(a => a.orderId === j.orderId);
    const artNote = j.stage === 0 && arts.length && arts.some(a => a.status !== 'Approved') ? '<small style="color:var(--warn)">⚠ Artwork not approved</small>' : (arts.length && arts.every(a => a.status === 'Approved') ? '<small style="color:var(--ok)">✓ Artwork approved</small>' : '');
    const first = (o?.items || [])[0], more = (o?.items || []).length - 1;
    const what = first ? `${nq.format(first.qty)} × ${first.desc}${first.size ? ' (' + first.size + ')' : ''}${more > 0 ? ` +${more} more` : ''}` : '';
    const who = j.stage === 0 ? (j.designer ? 'Designer: ' + j.designer : 'No designer yet') : [j.machine, j.operator].filter(Boolean).join(' · ') || 'Not assigned';
    return `<div class="jcard pr-${esc(j.priority)}" data-act="jobView" data-id="${j.id}"><div class="jc-top"><b>${esc(j.no)}</b>${badge(j.priority)}</div><div class="jc-title">${esc(j.title)}</div>${what ? `<small class="jc-what">${esc(what)}</small>` : ''}<small>${esc(cust(o?.customerId)?.name || '—')}</small><small>${esc(who)}</small><small>Due ${fmtDate(j.dueDate)}</small>${artNote}<div class="jc-btns"><button class="btn btn-sm" data-act="moveJob" data-id="${j.id}" data-dir="-1"${j.stage === 0 ? ' disabled' : ''} aria-label="Move back">◀</button><button class="btn btn-sm btn-primary" data-act="moveJob" data-id="${j.id}" data-dir="1"${j.stage === last ? ' disabled' : ''}>${j.stage < last ? esc(STAGES[j.stage + 1]) : 'Done'} ▶</button></div></div>`;
  };
  return `<div class="page-head"><h2>Production</h2><div class="actions"><button class="btn" data-act="jobPick">Add order to production</button><button class="btn btn-primary" data-act="jobForm">${ic('plus', 16)} New job card</button></div></div>
  ${S.jobs.length ? '' : `<div class="alert info"><span>Job cards follow each order from Design to Ready. Use “Add order to production” to send an order straight in, or press “New job card”.</span></div>`}
  <div class="board">${STAGES.map((st, i) => { const js = S.jobs.filter(j => j.stage === i).sort((a, b) => (prio[a.priority] - prio[b.priority]) || String(a.dueDate).localeCompare(String(b.dueDate))); return `<div class="col${i === 0 ? ' col-design' : ''}"><div class="col-head"><span>${esc(st)}</span><b>${js.length}</b></div>${js.map(jobCard).join('') || '<div class="col-empty">—</div>'}</div>`; }).join('')}</div>`;
};

/* who can be picked for each job role (staff list; typing any other name still works) */
const staffNames = kinds => { const act = S.employees.filter(e => e.active !== false); return [...act.filter(e => kinds.includes(e.kind)), ...act.filter(e => !kinds.includes(e.kind))].map(e => e.name); };
const dl = (id, names) => `<datalist id="${id}">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

/* keep the order's status in step with its job cards (Design -> In Production -> Completed) */
async function syncOrderStatus(orderId) {
  try {
    const o = await DB.get('orders', orderId); if (!o || o.type !== 'order' || ['Delivered', 'Cancelled'].includes(o.status)) return;
    const js = (await DB.all('jobs')).filter(j => j.orderId === orderId); if (!js.length) return;
    const want = js.every(j => j.stage >= STAGES.length - 1) ? 'Completed' : js.every(j => j.stage === 0) ? 'Design' : 'In Production';
    if (o.status !== want) await DB.setOrderStatus(orderId, want);
  } catch (e) { console.warn(e); }
}
const newJobNo = () => nextNo('job');
const blankJob = o => ({ orderId: o?.id || '', title: o?.title || o?.items?.[0]?.desc || '', priority: 'Normal', dueDate: o?.dueDate || '', stage: 0, designer: '', designerId: '', machine: '', operator: '', operatorId: '', finisher: '', finisherId: '', qc: '', qcId: '', brief: '', notes: '', refs: [] });

/* send an order straight to the production line (one tap) */
ACT.jobPick = () => {
  const have = new Set(S.jobs.map(j => j.orderId));
  const list = S.orders.filter(o => o.type === 'order' && !['Cancelled', 'Delivered', 'Completed'].includes(o.status) && !have.has(o.id)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  openModal('Add order to production', list.length ? `<p class="muted" style="margin-top:0">Orders that have no job card yet. “Send” creates the job card in the Design step; you can add the team and references afterwards.</p><table class="rtable"><tbody>${list.map(o => `<tr><td data-label="Order"><b>${esc(o.no)}</b><small>${esc(o.title || '')}</small></td><td data-label="Customer">${esc(cust(o.customerId)?.name || '—')}</td><td data-label="Due">${fmtDate(o.dueDate)}</td><td class="noL r"><button class="btn btn-sm btn-primary" data-act="jobMake" data-id="${o.id}" data-from="pick">Send</button></td></tr>`).join('')}</tbody></table>` : empty('Nothing waiting', 'Every open order already has a job card.'), '<button class="btn" data-close>Close</button>');
};
ACT.orderJob = ({ id }) => ACT.jobMake({ id });
ACT.jobMake = async ({ id, from }) => {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const ex = S.jobs.filter(j => j.orderId === id);
  if (ex.length && !confirm(`${o.no} already has job card ${ex.map(j => j.no).join(', ')}. Create another one?`)) return;
  const j = { ...blankJob(o), id: uid(), createdAt: Date.now() };
  j.no = await newJobNo();
  await DB.put('jobs', j); await syncOrderStatus(o.id); await notifyJobSaved(j, null);
  closeModal(); await reload(); toast(`${j.no} sent to production`); ACT.jobView({ id: j.id });
};

/* ---- job card: read-only overview (no amounts) ---- */
const stepper = j => `<div class="stepper">${STAGES.map((s, i) => `<span class="pill${i < j.stage ? ' done' : ''}${i === j.stage ? ' now' : ''}">${esc(s)}</span>`).join('')}</div>`;
const refThumb = r => isRaster(r) && thumbSrc(r) ? `<img class="thumb" src="${esc(thumbSrc(r))}" alt="">` : `<span class="thumb">FILE</span>`;
ACT.jobView = ({ id }) => {
  const j = S.jobs.find(x => x.id === id); if (!j) return;
  const o = S.orders.find(x => x.id === j.orderId), c = cust(o?.customerId), items = o?.items || [], arts = S.artworks.filter(a => a.orderId === j.orderId);
  const canW = can('jobs', 'w');
  const body = `<div class="row" style="justify-content:space-between;margin-bottom:8px"><div><b style="font-size:18px">${esc(j.no)}</b> ${badge(j.priority)} ${badge(STAGES[j.stage] || '—')}</div>${canW ? `<label class="field" style="min-width:180px"><span>Move to step</span><select data-change="jobStage" data-id="${j.id}">${opts(STAGES.map((s, i) => [String(i), s]), String(j.stage))}</select></label>` : ''}</div>
    ${stepper(j)}
    <dl class="kv"><dt>Job</dt><dd><b>${esc(j.title)}</b></dd><dt>Customer</dt><dd>${esc(c?.name || '—')}${c?.phone ? ` · ${esc(c.phone)}` : ''}</dd><dt>Order</dt><dd>${o ? `<a href="#" data-act="orderView" data-id="${o.id}">${esc(o.no)}</a>` : '—'}</dd><dt>Due</dt><dd>${fmtDate(j.dueDate)}</dd></dl>
    <h4 class="sec-h">Order details</h4>
    ${items.length ? `<table class="rtable"><thead><tr><th>#</th><th>Description</th><th>Size</th><th class="r">Qty</th></tr></thead><tbody>${items.map((i, n) => `<tr><td data-label="#">${n + 1}</td><td data-label="Description"><b>${esc(i.desc)}</b></td><td data-label="Size">${esc(i.size || '—')}</td><td class="r" data-label="Qty">${nq.format(i.qty)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No order attached.</p>'}
    ${o?.notes ? `<p><b>Order notes:</b> ${esc(o.notes)}</p>` : ''}
    ${j.brief ? `<h4 class="sec-h">Design brief</h4><p style="white-space:pre-wrap;margin:0">${esc(j.brief)}</p>` : ''}
    <h4 class="sec-h">Client references <small>(${(j.refs || []).length})</small></h4>
    ${(j.refs || []).length ? `<div class="reflist">${j.refs.map((r, i) => `<div class="ref">${refThumb(r)}<div><b>${esc(r.name || r.fileName || 'File')}</b><small>${esc(kb(r.size))}</small></div><div class="row"><button class="btn btn-sm" data-act="refOpen" data-id="${j.id}" data-i="${i}">Open</button><button class="btn btn-sm" data-act="refDl" data-id="${j.id}" data-i="${i}">${ic('download', 14)}</button></div></div>`).join('')}</div>` : '<p class="muted" style="margin:0">No reference files. Use Edit to attach the client’s samples, logos or photos.</p>'}
    <h4 class="sec-h">Artwork</h4>
    ${arts.length ? `<div class="reflist">${arts.map(a => { const lv = latestVer(a); return `<div class="ref">${lv && isRaster(lv) && thumbSrc(lv) ? `<img class="thumb" src="${esc(thumbSrc(lv))}" alt="">` : `<span class="thumb">${lv ? 'FILE' : '—'}</span>`}<div><b>${esc(a.no)}</b> ${badge(a.status)}<small>${esc(a.title)}${lv ? ' · v' + lv.n : ''}</small></div><button class="btn btn-sm" data-act="artView" data-id="${a.id}">Open</button></div>`; }).join('')}</div>` : '<p class="muted" style="margin:0">No artwork yet.</p>'}
    ${o && can('artworks', 'w') ? `<div style="margin-top:8px"><button class="btn btn-sm" data-act="orderArt" data-id="${o.id}">${ic('plus', 14)} Add artwork</button></div>` : ''}
    <h4 class="sec-h">Team</h4>
    <dl class="kv">${jobPeople(j).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>
    ${j.notes ? `<h4 class="sec-h">Production notes</h4><p style="white-space:pre-wrap;margin:0">${esc(j.notes)}</p>` : ''}`;
  const last = STAGES.length - 1;
  const foot = `${can('jobs', 'd') ? `<button class="btn btn-danger grow" data-act="delJob" data-id="${j.id}">Delete</button>` : ''}<button class="btn" data-act="printJob" data-id="${j.id}">${ic('printer', 16)} Print</button><button class="btn" data-act="jobForm" data-id="${j.id}">Edit</button>${canW ? `<button class="btn btn-primary" data-act="moveJob" data-id="${j.id}" data-dir="1" data-view="1"${j.stage >= last ? ' disabled' : ''}>${j.stage < last ? 'Next: ' + esc(STAGES[j.stage + 1]) : 'Finished'}</button>` : ''}`;
  openModal(`Job card ${j.no}`, body, foot, 'lg');
};
const jobPeople = j => [['Designer', j.designer], ['Machine', j.machine], ['Machine operator', j.operator], ['Finishing operator', j.finisher], ['Quality check', j.qc]];
const refOf = (id, i) => S.jobs.find(x => x.id === id)?.refs?.[+i];
ACT.refOpen = async ({ id, i }) => {
  const r = refOf(id, i); if (!r?.path) return toast('No file stored');
  if (!viewable(r)) return ACT.refDl({ id, i });
  const win = window.open('', '_blank');
  try { const u = await verUrl(r); if (win) win.location = u; else window.open(u, '_blank'); } catch (e) { win?.close(); throw e; }
};
ACT.refDl = async ({ id, i }) => {
  const r = refOf(id, i); if (!r?.path) return toast('No file stored');
  download(String(r.name || r.fileName || 'reference').replace(/[\\/:*?"<>|]/g, '_'), await verBlob(r), r.fileType || 'application/octet-stream');
};

/* ---- job card: edit form ---- */
function jobForm(id, pre = {}) {
  const j = S.jobs.find(x => x.id === id);
  const orders = S.orders.filter(o => o.type === 'order' && !['Cancelled', 'Delivered'].includes(o.status));
  if (!j && !orders.length) { toast('Create an order first'); return; }
  const d = j || { ...blankJob(S.orders.find(x => x.id === pre.orderId)), orderId: pre.orderId || '' };
  const machines = S.settings.machines.split(',').map(x => x.trim()).filter(Boolean);
  const people = (idn, label, kinds, v, vid) => field(label, `<select id="${idn}">${teamOpts(kinds, v, vid)}</select>`);
  openModal(j ? `Edit job card ${j.no}` : 'New job card', `<datalist id="machines">${machines.map(m => `<option value="${esc(m)}">`).join('')}</datalist><div class="grid2">
    ${field('Order *', `<select id="j-order" data-change="jobOrder" ${j ? 'disabled' : ''}><option value="">Select order…</option>${opts(S.orders.filter(o => o.type === 'order' && (j ? o.id === d.orderId : !['Cancelled', 'Delivered'].includes(o.status))).map(o => [o.id, `${o.no} - ${cust(o.customerId)?.name || ''}`]), d.orderId)}</select>`)}
    ${field('Job title *', `<input id="j-title" value="${esc(d.title)}">`)}
    ${field('Priority', `<select id="j-prio">${opts(PRIORITIES, d.priority)}</select>`)}${field('Due date', `<input id="j-due" type="date" value="${esc(d.dueDate)}">`)}
    ${j ? field('Step', `<select id="j-stage">${opts(STAGES.map((s, i) => [String(i), s]), String(d.stage))}</select>`) : ''}
  </div>
  <h4 class="sec-h">Team</h4><div class="grid2">
    ${people('j-designer', 'Designer', ['Designer'], d.designer, d.designerId)}${field('Machine', `<input id="j-machine" list="machines" value="${esc(d.machine)}">`)}
    ${people('j-operator', 'Machine operator', ['Machine operator'], d.operator, d.operatorId)}${people('j-finisher', 'Finishing operator', ['Finishing'], d.finisher, d.finisherId)}
    ${people('j-qc', 'Quality check', ['Quality check'], d.qc, d.qcId)}
  </div>
  ${S.employees.some(e => e.active !== false) ? '' : '<small class="muted">No staff yet. Add them in Attendance &gt; Staff, or switch Attendance on for a person in Staff &amp; Roles.</small>'}
  <h4 class="sec-h">Design brief &amp; client references</h4>
  ${field('Design brief (what the client wants)', `<textarea id="j-brief" placeholder="Colours, wording, style, reference notes…">${esc(d.brief)}</textarea>`)}
  ${(d.refs || []).length ? `<div class="reflist" style="margin-top:10px">${d.refs.map((r, i) => `<label class="ref">${refThumb(r)}<div><b>${esc(r.name || r.fileName || 'File')}</b><small>${esc(kb(r.size))}</small></div><span class="row" style="gap:6px"><input type="checkbox" class="ref-rm" value="${esc(r.id)}"> Remove</span></label>`).join('')}</div>` : ''}
  <div style="margin-top:10px">${field('Attach client reference files (images, PDF — up to 10 MB each)', `<input id="j-refs" type="file" multiple accept="image/*,application/pdf,.pdf,.ai,.psd,.cdr,.eps,.zip">`)}</div>
  <div style="margin-top:12px">${field('Production notes', `<textarea id="j-notes">${esc(d.notes)}</textarea>`)}</div>`,
    `${j && can('jobs', 'd') ? `<button class="btn btn-danger grow" data-act="delJob" data-id="${j.id}">Delete</button>` : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveJob" data-id="${j?.id || ''}">Save</button>`, 'lg');
}
ACT.jobForm = ({ id }) => jobForm(id);
CHG.jobOrder = el => { const o = S.orders.find(x => x.id === el.value); if (!o) return; if (!$('#j-title').value) $('#j-title').value = o.title || o.items?.[0]?.desc || ''; if (!$('#j-due').value) $('#j-due').value = o.dueDate || ''; };
CHG.jobStage = async el => { const j = S.jobs.find(x => x.id === el.dataset.id); if (j) await setJobStage(j, +el.value, true); };
ACT.saveJob = async ({ id }) => {
  const old = S.jobs.find(x => x.id === id);
  const orderId = old ? old.orderId : $('#j-order').value, title = $('#j-title').value.trim();
  if (!orderId) return toast('Select an order'); if (!title) return toast('Enter a job title');
  const v = k => $('#j-' + k).value.trim();
  const jid = old?.id || uid();
  const rm = new Set($$('.ref-rm:checked').map(x => x.value)), files = [...($('#j-refs').files || [])];
  if ((old?.refs || []).length - rm.size + files.length > 10) return toast('A job card can hold up to 10 reference files');
  const j = { ...(old || blankJob()), id: jid, orderId, title, priority: $('#j-prio').value, dueDate: $('#j-due').value, ...teamRead(old),  machine: v('machine'), brief: $('#j-brief').value.trim(), notes: $('#j-notes').value.trim(), createdAt: old?.createdAt || Date.now() };
  delete j.materials; delete j.deducted;
  const removed = (old?.refs || []).filter(r => rm.has(r.id)).map(r => r.path), added = [];
  j.refs = (old?.refs || []).filter(r => !rm.has(r.id));
  if (files.length) toast('Uploading reference files…');
  try {
    for (const f of files) {
      const { meta, blob } = await readArtFile(f), r = { id: uid(), ...meta, name: f.name };
      r.path = `ref/${jid}/${r.id}`; await Files.upload(r.path, blob); added.push(r.path); j.refs.push(r);
    }
  } catch (e) { await Files.remove(added).catch(() => {}); return showErr(e); }
  let newStage = old ? +$('#j-stage').value : 0;
  if (old && old.stage === 0 && newStage >= 1) {
    const unapproved = S.artworks.filter(a => a.orderId === j.orderId && a.status !== 'Approved');
    if (unapproved.length && !confirm(`Artwork not approved yet (${unapproved.map(a => a.no).join(', ')}). Move on from Design anyway?`)) { await Files.remove(added).catch(() => {}); return; }
  }
  j.stage = newStage;
  if (!old) j.no = await newJobNo();
  try { await DB.put('jobs', j); } catch (e) { await Files.remove(added).catch(() => {}); throw e; }
  if (removed.length) Files.remove(removed).catch(() => {});
  await syncOrderStatus(orderId);
  await notifyJobSaved(j, old);
  closeModal(); await reload(); toast('Job card saved');
  if (old) ACT.jobView({ id: j.id });
};
async function setJobStage(j, ns, view) {
  if (ns < 0 || ns >= STAGES.length || ns === j.stage) return;
  if (j.stage === 0 && ns >= 1) {
    const unapproved = S.artworks.filter(a => a.orderId === j.orderId && a.status !== 'Approved');
    if (unapproved.length && !confirm(`Artwork not approved yet (${unapproved.map(a => a.no).join(', ')}). Move on from Design anyway?`)) { if (view) ACT.jobView({ id: j.id }); return; }
  }
  j.stage = ns; await DB.put('jobs', j); await syncOrderStatus(j.orderId); await notifyStageMove(j);
  await reload(); if (view) ACT.jobView({ id: j.id });
}
ACT.moveJob = async ({ id, dir, view }) => { const j = S.jobs.find(x => x.id === id); if (j) await setJobStage(j, j.stage + (+dir), !!view); };
ACT.delJob = async ({ id }) => {
  if (!confirm('Delete this job card?')) return;
  const j = S.jobs.find(x => x.id === id); await DB.del('jobs', id);
  if (j?.orderId) await syncOrderStatus(j.orderId);
  Files.remove((j?.refs || []).map(r => r.path)).catch(() => {});
  closeModal(); await reload(); toast('Deleted');
};
ACT.printJob = ({ id }) => printJob(S.jobs.find(j => j.id === id));

/* =====================================================================
   INVENTORY
   ===================================================================== */
LIST.inventory = () => {
  let rows = [...S.inventory].sort((a, b) => a.name.localeCompare(b.name));
  const q = (UI.q || '').toLowerCase();
  if (q) rows = rows.filter(i => [i.name, i.category, i.supplier].join(' ').toLowerCase().includes(q));
  if (UI.f === 'low') rows = rows.filter(isLow);
  if (!rows.length) return empty('No stock items', 'Add raw materials such as paper, ink, plates and film.', `<button class="btn btn-primary" data-act="itemForm">${ic('plus', 16)} Add item</button>`);
  return `<table class="rtable"><thead><tr><th>Item</th><th>Category</th><th class="r">Stock</th><th class="r">Min</th><th class="r">Cost / unit</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(i => `<tr><td data-label="Item"><b>${esc(i.name)}</b><small>${esc(i.supplier || '')}</small></td><td data-label="Category">${esc(i.category || '—')}</td><td class="r" data-label="Stock"><b>${nq.format(i.stock)}</b> ${esc(i.unit || '')}</td><td class="r" data-label="Min">${nq.format(i.min || 0)}</td><td class="r" data-label="Cost">${nf.format(i.cost || 0)}</td><td data-label="Status">${isLow(i) ? badge('Low') : badge('OK')}</td><td class="noL"><div class="row" style="justify-content:flex-end"><button class="btn btn-sm" data-act="stockForm" data-id="${i.id}">In / Out</button><button class="btn btn-sm" data-act="history" data-id="${i.id}">History</button><button class="btn btn-sm" data-act="itemForm" data-id="${i.id}">Edit</button></div></td></tr>`).join('')}</tbody></table>`;
};
VIEWS.inventory = () => {
  const value = r2(S.inventory.reduce((a, i) => a + (+i.stock || 0) * (+i.cost || 0), 0));
  return `<div class="page-head"><h2>Inventory</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="inventory">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="itemForm">${ic('plus', 16)} Add item</button></div></div>
  <div class="grid3" style="margin-bottom:14px"><div class="card"><small>Items</small><b style="font-size:22px">${S.inventory.length}</b></div><div class="card"><small>Low stock</small><b style="font-size:22px">${S.inventory.filter(isLow).length}</b></div><div class="card"><small>Stock value</small><b style="font-size:22px">${money(value)}</b></div></div>
  <div class="toolbar"><input type="search" placeholder="Search stock…" data-ui="q" value="${esc(UI.q)}"><select data-ui="f"><option value="">All items</option><option value="low"${UI.f === 'low' ? ' selected' : ''}>Low stock only</option></select></div>
  <div class="card" id="list">${LIST.inventory()}</div>`;
};
ACT.itemForm = ({ id } = {}) => {
  const i = S.inventory.find(x => x.id === id) || {};
  const cats = [...new Set(S.inventory.map(x => x.category).filter(Boolean))];
  openModal(id ? 'Edit item' : 'New stock item', `<datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist><div class="grid2">
    ${field('Name *', `<input id="i-name" value="${esc(i.name)}">`)}${field('Category', `<input id="i-cat" list="cats" placeholder="Paper, Ink, Plates…" value="${esc(i.category)}">`)}
    ${field('Unit', `<input id="i-unit" placeholder="sheet, ream, kg…" value="${esc(i.unit)}">`)}${id ? field('Current stock', `<input value="${nq.format(i.stock)}" disabled>`) : field('Opening stock', `<input id="i-stock" type="number" step="any" inputmode="decimal" value="0">`)}
    ${field('Minimum level (alert)', `<input id="i-min" type="number" min="0" step="any" inputmode="decimal" value="${+i.min || ''}">`)}${field(`Cost per unit (${esc(S.settings.currency)})`, `<input id="i-cost" type="number" min="0" step="any" inputmode="decimal" value="${+i.cost || ''}">`)}
  </div><div style="margin-top:12px">${S.suppliers.length ? field('Supplier', `<select id="i-supid"><option value="">— none —</option>${opts(S.suppliers.map(x => [x.id, x.name]), i.supplierId)}</select>`) : field('Supplier (add suppliers in the Suppliers screen to pick from a list)', `<input id="i-sup" value="${esc(i.supplier)}">`)}</div>${id ? '<small style="margin-top:8px">Change stock with “In / Out” so there is a history.</small>' : ''}`,
    `${id ? `<button class="btn btn-danger grow" data-act="delItem" data-id="${id}">Delete</button>` : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveItem" data-id="${id || ''}">Save</button>`);
};
ACT.saveItem = async ({ id }) => {
  const name = $('#i-name').value.trim(); if (!name) return toast('Name is required');
  let old = S.inventory.find(x => x.id === id);
  if (old) old = await DB.get('inventory', id) || old;                  // keep the latest stock figure when only the details change
  const it = { ...(old || {}), id: old?.id || uid(), name, category: $('#i-cat').value.trim(), unit: $('#i-unit').value.trim(), min: +$('#i-min').value || 0, cost: +$('#i-cost').value || 0, ...(($('#i-supid')) ? { supplierId: $('#i-supid').value, supplier: S.suppliers.find(x => x.id === $('#i-supid').value)?.name || '' } : { supplier: $('#i-sup').value.trim() }), createdAt: old?.createdAt || Date.now() };
  const opening = old ? 0 : r3($('#i-stock').value);
  if (!old) it.stock = 0;
  await DB.put('inventory', it);
  if (opening > 0) await DB.adjustStock(it.id, opening, 'in', 'Opening stock', today());
  closeModal(); await reload(); toast('Item saved');
};
ACT.delItem = async ({ id }) => {
  if (!confirm('Delete this item and its history?')) return;
  for (const m of S.movements.filter(m => m.itemId === id)) await DB.del('movements', m.id);
  await DB.del('inventory', id); closeModal(); await reload(); toast('Deleted');
};
ACT.stockForm = ({ id }) => {
  const i = S.inventory.find(x => x.id === id), canExp = can('expenses', 'w'), cats = expCats();
  const guess = cats.find(c => /paper|material|ink|stock/i.test(c)) || cats[0];
  openModal(`Stock: ${i.name}`, `<p>Current stock: <b>${nq.format(i.stock)} ${esc(i.unit || '')}</b></p><div class="grid2">
    ${field('Type', `<select id="s-type" data-change="stockType"><option value="in">Stock in (purchase / return)</option><option value="out">Stock out (used / wastage)</option></select>`)}${field('Quantity *', `<input id="s-qty" type="number" min="0" step="any" inputmode="decimal">`)}
    ${field('Date', `<input id="s-date" type="date" value="${today()}">`)}${field('Note', `<input id="s-note" placeholder="Supplier invoice, reason…">`)}</div>
    <div class="stock-in-only"><h4 class="sec-h">Purchase</h4><div class="grid2">
    ${field(`Cost per unit (${esc(S.settings.currency)})`, `<input id="s-cost" type="number" min="0" step="any" inputmode="decimal" value="${+i.cost || ''}">`)}${field('Supplier', `<select id="s-sup"><option value="">— none —</option>${opts(S.suppliers.map(x => [x.id, x.name]), i.supplierId)}</select>`)}
    ${canExp ? field('Expense category', `<select id="s-cat">${opts(cats, guess)}</select>`) : ''}${canExp ? field('Paid by', `<select id="s-method">${opts(PAY_METHODS, 'Cash')}</select>`) : ''}</div>
    ${canExp ? `<label class="row" style="margin-top:8px;gap:8px"><input type="checkbox" id="s-exp" checked> Record this purchase as an expense</label>` : ''}</div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveStock" data-id="${id}">Save</button>`, 'sm');
};
CHG.stockType = el => { const b = $('.stock-in-only'); if (b) b.style.display = el.value === 'in' ? '' : 'none'; };
ACT.saveStock = async ({ id }) => {
  const i = S.inventory.find(x => x.id === id), qty = r3($('#s-qty').value), type = $('#s-type').value;
  if (!(qty > 0)) return toast('Enter a quantity');
  const nb = r3(type === 'in' ? i.stock + qty : i.stock - qty);
  if (nb < 0 && !confirm('This makes stock negative. Continue?')) return;
  const date = $('#s-date').value || today(), note = $('#s-note').value.trim();
  const cost = type === 'in' ? (+$('#s-cost').value || 0) : 0, supId = type === 'in' ? $('#s-sup').value : '', sup = supOf(supId);
  await DB.adjustStock(id, type === 'in' ? qty : -qty, type, note || (sup ? 'From ' + sup.name : ''), date);   // done inside the database so two people never overwrite each other
  if (type === 'in') {
    if (cost > 0 && (cost !== +i.cost || (supId && supId !== i.supplierId))) {      // remember the latest price / supplier on the item
      const fresh = await DB.get('inventory', id);
      if (fresh) { fresh.cost = cost; if (supId) { fresh.supplierId = supId; fresh.supplier = sup.name; } await DB.put('inventory', fresh); }
    }
    if ($('#s-exp')?.checked && cost > 0 && can('expenses', 'w')) {
      await DB.put('expenses', { id: uid(), date, amount: r2(qty * cost), category: $('#s-cat').value, method: $('#s-method').value, description: `Stock in: ${nq.format(qty)} ${i.unit || ''} ${i.name}`.replace(/\s+/g, ' '), vendor: sup?.name || '', supplierId: supId, ref: note, orderId: '', stockItemId: id, createdAt: Date.now() });
    }
  }
  closeModal(); await reload(); toast('Stock updated' + ($('#s-exp')?.checked && cost > 0 && type === 'in' ? ' and expense recorded' : ''));
};
ACT.history = ({ id }) => {
  const i = S.inventory.find(x => x.id === id);
  const ms = S.movements.filter(m => m.itemId === id).sort((a, b) => b.ts - a.ts).slice(0, 60);
  openModal(`History: ${i.name}`, ms.length ? `<table class="rtable"><thead><tr><th>Date</th><th>Type</th><th class="r">Qty</th><th class="r">Balance</th><th>Note</th></tr></thead><tbody>${ms.map(m => `<tr><td data-label="Date">${fmtDate(m.date)}</td><td data-label="Type">${m.type === 'in' ? 'In' : 'Out'}</td><td class="r" data-label="Qty">${m.type === 'in' ? '+' : '-'}${nq.format(m.qty)}</td><td class="r" data-label="Balance">${nq.format(m.balance)}</td><td data-label="Note">${esc(m.note || '')}</td></tr>`).join('')}</tbody></table>` : empty('No movements yet'), '');
};

/* =====================================================================
   BILLING
   ===================================================================== */
LIST.billing = () => {
  let rows = [...S.invoices].sort((a, b) => b.createdAt - a.createdAt);
  if (UI.f) rows = rows.filter(i => invStatus(i) === UI.f);
  const q = (UI.q || '').toLowerCase();
  if (q) rows = rows.filter(i => [i.no, i.orderNo, cust(i.customerId)?.name].join(' ').toLowerCase().includes(q));
  if (!rows.length) return empty('No invoices', 'Create an invoice from an order, or press “New invoice”.');
  return `<table class="rtable"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Due</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead><tbody>${rows.map(i => `<tr data-act="invView" data-id="${i.id}"><td data-label="Invoice"><b>${esc(i.no)}</b>${i.orderNo ? `<small>${esc(i.orderNo)}</small>` : ''}</td><td data-label="Customer">${esc(cust(i.customerId)?.name || '—')}</td><td data-label="Date">${fmtDate(i.date)}</td><td data-label="Due">${fmtDate(i.dueDate)}</td><td class="r" data-label="Total">${money(invTotal(i))}</td><td class="r" data-label="Balance">${money(balance(i))}</td><td data-label="Status">${badge(invStatus(i))}</td></tr>`).join('')}</tbody></table>`;
};
VIEWS.billing = () => {
  const inv = r2(S.invoices.reduce((a, i) => a + invTotal(i), 0)), col = r2(S.invoices.reduce((a, i) => a + paidAmt(i), 0));
  return `<div class="page-head"><h2>Billing & Invoicing</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="invoices">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="newInvoice">${ic('plus', 16)} New invoice</button></div></div>
  <div class="grid4" style="margin-bottom:14px"><div class="stat s-blue"><span>Invoiced</span><b>${money(inv)}</b></div><div class="stat s-green"><span>Collected</span><b>${money(col)}</b></div><div class="stat s-orange"><span>Outstanding</span><b>${money(r2(inv - col))}</b></div><div class="stat s-pink"><span>Overdue invoices</span><b>${S.invoices.filter(i => invStatus(i) === 'Overdue').length}</b></div></div>
  <div class="toolbar"><input type="search" placeholder="Search invoices…" data-ui="q" value="${esc(UI.q)}"><select data-ui="f"><option value="">All statuses</option>${opts(['Unpaid', 'Partial', 'Paid', 'Overdue'], UI.f)}</select></div>
  <div class="card" id="list">${LIST.billing()}</div>`;
};
ACT.newInvoice = () => docForm('invoice', null, {});
ACT.editInv = ({ id }) => docForm('invoice', id);
ACT.printInv = ({ id }) => printInvoice(S.invoices.find(i => i.id === id));
ACT.delInv = async ({ id }) => { if (!confirm('Delete this invoice and its payments?')) return; await DB.del('invoices', id); closeModal(); await reload(); toast('Deleted'); };
ACT.invView = ({ id }) => {
  const inv = S.invoices.find(x => x.id === id); if (!inv) return;
  const c = cust(inv.customerId), t = calc(inv), paid = paidAmt(inv), bal = balance(inv);
  const pays = (inv.payments || []).map(p => `<tr><td data-label="Date">${fmtDate(p.date)}</td><td data-label="Method">${esc(p.method)}</td><td data-label="Note">${esc(p.note || '')}</td><td class="r" data-label="Amount">${nf.format(p.amount)}</td><td class="noL r"><button class="btn btn-sm btn-danger" data-act="delPay" data-id="${inv.id}" data-pid="${p.id}">Remove</button></td></tr>`).join('');
  openModal(`Invoice ${inv.no}`, `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div><b style="font-size:18px">${esc(c?.name || '—')}</b>${inv.orderNo ? `<small>Order ${esc(inv.orderNo)}</small>` : ''}</div>${badge(invStatus(inv))}</div>
    <dl class="kv"><dt>Date</dt><dd>${fmtDate(inv.date)}</dd><dt>Due</dt><dd>${fmtDate(inv.dueDate)}</dd></dl>
    <table class="rtable" style="margin-top:10px"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${inv.items.map(i => `<tr><td data-label="Item">${esc(i.desc)}${i.size ? `<small>${esc(i.size)}</small>` : ''}</td><td class="r" data-label="Qty">${nq.format(i.qty)}</td><td class="r" data-label="Rate">${nf.format(i.rate)}</td><td class="r" data-label="Amount">${nf.format(r2(i.qty * i.rate))}</td></tr>`).join('')}</tbody></table>
    <div class="totals">${totalsHtml(t, +inv.taxRate || 0)}<div><span>Paid</span><span>${money(paid)}</span></div><div class="grand"><span>Balance</span><span>${money(bal)}</span></div></div>
    <hr><b>Payments</b>${pays ? `<table class="rtable"><tbody>${pays}</tbody></table>` : '<p class="muted">No payments recorded.</p>'}
    ${bal > 0.005 ? `<div class="card" style="margin-top:10px;background:var(--surface2)"><b>Record payment</b><div class="grid2" style="margin-top:8px">${field('Amount', `<input id="p-amt" type="number" min="0" step="any" inputmode="decimal" value="${bal}">`)}${field('Date', `<input id="p-date" type="date" value="${today()}">`)}${field('Method', `<select id="p-method">${opts(PAY_METHODS)}</select>`)}${field('Note', `<input id="p-note" placeholder="Reference no.">`)}</div><button class="btn btn-primary" style="margin-top:10px" data-act="savePay" data-id="${inv.id}">Add payment</button></div>` : ''}`,
    `<button class="btn btn-danger grow" data-act="delInv" data-id="${inv.id}">Delete</button><button class="btn" data-act="printInv" data-id="${inv.id}">${ic('printer', 16)} Print / PDF</button><button class="btn" data-act="editInv" data-id="${inv.id}">Edit</button>`);
};
ACT.savePay = async ({ id }) => {
  let inv = S.invoices.find(x => x.id === id); const amt = r2($('#p-amt').value);
  if (!(amt > 0)) return toast('Enter an amount');
  if (amt > balance(inv) + 0.005 && !confirm('Amount is more than the balance due. Record anyway?')) return;
  inv = await DB.get('invoices', id) || inv;                        // add to the newest copy so a payment someone else just entered is kept
  (inv.payments = inv.payments || []).push({ id: uid(), date: $('#p-date').value || today(), amount: amt, method: $('#p-method').value, note: $('#p-note').value.trim() });
  await DB.put('invoices', inv); await reload(); toast('Payment recorded'); ACT.invView({ id });
};
ACT.delPay = async ({ id, pid }) => {
  if (!confirm('Remove this payment?')) return;
  const inv = await DB.get('invoices', id) || S.invoices.find(x => x.id === id); inv.payments = (inv.payments || []).filter(p => p.id !== pid);
  await DB.put('invoices', inv); await reload(); ACT.invView({ id });
};

/* =====================================================================
   REPORTS
   ===================================================================== */
function rangeBounds() {
  const n = new Date(), r = UI.range || 'month';
  if (r === 'month') return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), today()];
  if (r === '30') return [addDays(today(), -30), today()];
  if (r === 'year') return [`${n.getFullYear()}-01-01`, today()];
  if (r === 'custom') return [UI.from || '0000-01-01', UI.to || '9999-12-31'];
  return ['0000-01-01', '9999-12-31'];
}
VIEWS.reports = () => {
  const [from, to] = rangeBounds(), inR = d => d >= from && d <= to;
  const invs = S.invoices.filter(i => inR(i.date)), ords = S.orders.filter(o => o.type === 'order' && inR(o.date));
  const invoiced = r2(invs.reduce((a, i) => a + invTotal(i), 0));
  const collected = r2(S.invoices.flatMap(i => i.payments || []).filter(p => inR(p.date)).reduce((a, p) => a + p.amount, 0));
  const recv = r2(S.invoices.reduce((a, i) => a + balance(i), 0));
  const exps = S.expenses.filter(e => inR(e.date)), expTotal = r2(exps.reduce((a, e) => a + e.amount, 0)), net = r2(collected - expTotal);
  const byCatExp = {}; exps.forEach(e => { byCatExp[e.category] = r2((byCatExp[e.category] || 0) + e.amount); });
  const expCatRows = Object.entries(byCatExp).sort((a, b) => b[1] - a[1]);
  const byMonth = {}; invs.forEach(i => { const k = (i.date || '').slice(0, 7); byMonth[k] = r2((byMonth[k] || 0) + invTotal(i)); });
  const mKeys = Object.keys(byMonth).sort().slice(-12), mx = Math.max(1, ...mKeys.map(k => byMonth[k]));
  const byCust = {}; invs.forEach(i => { byCust[i.customerId] = r2((byCust[i.customerId] || 0) + invTotal(i)); });
  const top = Object.entries(byCust).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const stat = {}; ords.forEach(o => { stat[o.status] = (stat[o.status] || 0) + 1; });
  const unpaid = S.invoices.filter(i => balance(i) > 0.005).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 12);
  const low = S.inventory.filter(isLow);
  return `<div class="page-head"><h2>Reports</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="sales">${ic('download', 16)} Sales CSV</button><button class="btn" data-act="exportCsv" data-kind="payments">${ic('download', 16)} Payments CSV</button><button class="btn" data-act="exportCsv" data-kind="expenses">${ic('download', 16)} Expenses CSV</button></div></div>
  <div class="toolbar"><select data-ui="range">${opts([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom range']], UI.range)}</select>${UI.range === 'custom' ? `<input type="date" data-ui="from" value="${esc(UI.from)}" style="width:auto"><input type="date" data-ui="to" value="${esc(UI.to)}" style="width:auto">` : ''}</div>
  <div class="grid4"><div class="stat s-blue"><span>Invoiced</span><b>${money(invoiced)}</b><small>${invs.length} invoices</small></div><div class="stat s-green"><span>Collected</span><b>${money(collected)}</b></div><div class="stat s-orange"><span>Expenses</span><b>${money(expTotal)}</b><small>${exps.length} entries</small></div><div class="stat ${net < 0 ? 's-red' : 's-pink'}"><span>Net profit (cash)</span><b>${money(net)}</b></div></div>
  <p class="muted" style="margin:10px 0 0">Net profit = payments collected − expenses in the selected period. Receivable (all time): <b>${money(recv)}</b> · Orders in period: <b>${ords.length}</b></p>
  <div class="grid2 section">
    <div class="card"><h3>Sales by month</h3>${mKeys.length ? `<div class="bars">${mKeys.map(k => `<div class="bar-col" title="${money(byMonth[k])}"><span class="bv">${nq.format(Math.round(byMonth[k]))}</span><div class="bar" style="height:${Math.round(byMonth[k] / mx * 100)}%"></div><small>${k.slice(2)}</small></div>`).join('')}</div>` : empty('No invoices in this range')}</div>
    <div class="card"><h3>Top customers</h3>${top.length ? `<table class="rtable"><tbody>${top.map(([id, v]) => `<tr><td data-label="Customer">${esc(cust(id)?.name || '—')}</td><td class="r" data-label="Invoiced"><b>${money(v)}</b></td></tr>`).join('')}</tbody></table>` : empty('No data')}</div>
  </div>
  <div class="grid2 section">
    <div class="card"><h3>Orders by status</h3>${Object.keys(stat).length ? Object.entries(stat).map(([s, n]) => `<div class="row" style="justify-content:space-between;padding:4px 0">${badge(s)}<b>${n}</b></div>`).join('') : empty('No orders in this range')}</div>
    <div class="card"><h3>Unpaid invoices</h3>${unpaid.length ? `<table class="rtable"><tbody>${unpaid.map(i => `<tr data-act="invView" data-id="${i.id}"><td data-label="Invoice"><b>${esc(i.no)}</b><small>${esc(cust(i.customerId)?.name || '')}</small></td><td data-label="Due">${fmtDate(i.dueDate)}</td><td class="r" data-label="Balance">${money(balance(i))}</td></tr>`).join('')}</tbody></table>` : empty('Nothing outstanding')}</div>
  </div>
  <div class="card section"><h3>Low stock</h3>${low.length ? low.map(i => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(i.name)}</span><span><b>${nq.format(i.stock)}</b> / min ${nq.format(i.min)} ${esc(i.unit || '')}</span></div>`).join('') : empty('All stock levels are fine')}</div>
  <div class="card section"><h3>Expenses by category</h3>${expCatRows.length ? hbars(expCatRows) : empty('No expenses in this range', 'Add costs in the Expenses screen to see profit.')}</div>${typeof hrReports === 'function' ? hrReports(from, to) : ''}`;
};

/* =====================================================================
   SETTINGS
   ===================================================================== */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (current === 'settings') refresh(); });
/* Role permissions: administrator and manager choose, per role and per kind of data, No access / View / Edit / Full */
const PERM_LEVELS = [['none', 'No access'], ['view', 'View'], ['edit', 'Edit'], ['full', 'Full']];
const permLevel = (role, store) => { const p = S.rolePerms.find(x => x.role === role && x.store === store); return !p || !p.can_read ? 'none' : !p.can_write ? 'view' : p.can_delete ? 'full' : 'edit'; };
function permCard() {
  const roles = ROLES.filter(r => r[0] !== 'admin').map(r => r[0]), stores = Object.keys(STORE_LABEL);
  const editable = r => r === 'manager' ? isAdmin() : true;
  const cell = (r, st) => { const lv = permLevel(r, st);
    return editable(r) ? `<select data-change="rolePerm" data-role="${r}" data-store="${st}" aria-label="${esc(roleName(r))}: ${esc(STORE_LABEL[st])}">${opts(PERM_LEVELS, lv)}</select>` : `<span>${esc((PERM_LEVELS.find(x => x[0] === lv) || [0, lv])[1])}</span>`; };
  return `<div class="card" id="permCard"><h3>Role permissions</h3>
    <p class="muted" style="margin-top:0">Choose what each role can do with each kind of information. <b>No access</b> hides it, <b>View</b> is read-only, <b>Edit</b> can add and change, <b>Full</b> can also delete. Changes save immediately and reach each person within a minute. The Administrator always has full access${isAdmin() ? '' : ', and only the Administrator can change the Manager role'}.</p>
    <div class="scroll-x"><table class="rtable matrix"><thead><tr><th>Information</th>${roles.map(r => `<th>${esc(roleName(r))}</th>`).join('')}</tr></thead><tbody>${stores.map(st => `<tr><td data-label="Information"><b>${esc(STORE_LABEL[st])}</b></td>${roles.map(r => `<td data-label="${esc(roleName(r))}">${cell(r, st)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <small class="muted">Tip: if someone needs to work on orders, also give them at least View on Customers, otherwise customer names will be blank for them.</small></div>`;
}
CHG.rolePerm = async el => {
  const { role, store } = el.dataset;
  try { await Cloud.rpc('set_role_perm', { p_role: role, p_store: store, p_level: el.value }); S.rolePerms = await Cloud.rest('/role_perms?select=*'); toast(`${roleName(role)}: ${STORE_LABEL[store]} set to ${(PERM_LEVELS.find(x => x[0] === el.value) || [0, ''])[1]}`); }
  catch (e) { toast(e.perm ? 'You do not have permission to change that.' : e.message); try { S.rolePerms = await Cloud.rest('/role_perms?select=*'); } catch { /* keep */ } el.value = permLevel(role, store); }
};

VIEWS.settings = () => {
  const s = S.settings, ro = !can('settings', 'w');
  const last = s.lastBackup ? fmtDate(s.lastBackup) : 'never';
  const csvKinds = ['customers', 'orders', 'invoices', 'payments', 'inventory', 'suppliers', 'expenses', 'artwork'].filter(k => can(CSV_STORE[k]));
  return `<div class="page-head"><h2>Settings</h2><div class="actions"><button class="btn btn-primary" data-act="saveSet">Save settings</button></div></div>
  <div class="stack">
  <div class="card"><h3>My account</h3>
    <dl class="kv"><dt>Name</dt><dd>${esc(ME.profile?.name || '—')}</dd><dt>Email</dt><dd>${esc(ME.profile?.email || '')}</dd><dt>Role</dt><dd>${esc(roleName(ME.profile?.role))}</dd></dl>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="myName">Change my name</button><button class="btn" data-act="myPassword">Change password</button><button class="btn" data-act="signOut">Sign out</button></div></div>
  ${ro ? `<div class="alert info"><span>Shop details, numbering and the color theme can only be changed by the administrator. You can still choose light or dark mode for this device below.</span></div>` : ''}
  <div class="stack" id="shopSettings">
  <div class="card"><h3>Shop details</h3><div class="grid2">
    ${field('Shop name', `<input id="s-name" value="${esc(s.shopName)}">`)}${field('Tagline', `<input id="s-tag" value="${esc(s.tagline)}">`)}
    ${field('Phone', `<input id="s-phone" type="tel" value="${esc(s.phone)}">`)}${field('Email', `<input id="s-email" type="email" value="${esc(s.email)}">`)}
    ${field('Address', `<input id="s-addr" value="${esc(s.address)}">`)}${field('Website', `<input id="s-web" value="${esc(s.website)}">`)}
    ${field('PAN / VAT number', `<input id="s-tax" value="${esc(s.taxNo)}">`)}
    <div class="field"><span>Logo</span><div class="row">${s.logo ? `<img class="logo-prev" src="${esc(s.logo)}" alt="Logo"><button class="btn btn-sm" data-act="rmLogo">Remove</button>` : ''}<button class="btn btn-sm" data-act="pickLogo">${ic('upload', 14)} Upload logo</button><input type="file" id="logoFile" accept="image/*" hidden data-change="logo"></div></div>
  </div></div>
  <div class="card"><h3>Billing & numbering</h3><div class="grid3">
    ${field('Currency', `<input id="s-cur" value="${esc(s.currency)}" placeholder="NPR, Rs., $">`)}${field('Tax label', `<input id="s-taxl" value="${esc(s.taxLabel)}">`)}${field('Default tax %', `<input id="s-rate" type="number" min="0" step="any" value="${+s.taxRate || 0}">`)}
    ${field('Quotation prefix', `<input id="s-pq" value="${esc(s.prefixes.quote)}">`)}${field('Order prefix', `<input id="s-po" value="${esc(s.prefixes.order)}">`)}${field('Invoice prefix', `<input id="s-pi" value="${esc(s.prefixes.invoice)}">`)}
    ${field('Job card prefix', `<input id="s-pj" value="${esc(s.prefixes.job)}">`)}${field('Artwork prefix', `<input id="s-pa" value="${esc(s.prefixes.art)}">`)}</div>
    <div class="stack" style="margin-top:12px">${field('Invoice footer note', `<input id="s-note" value="${esc(s.invoiceNote)}">`)}${field('Payment details (bank, wallet…) shown on invoices', `<textarea id="s-pay">${esc(s.paymentInfo)}</textarea>`)}${field('Machines (comma separated)', `<input id="s-mach" value="${esc(s.machines)}">`)}${field('Expense categories (comma separated)', `<input id="s-expcat" value="${esc(s.expenseCats)}">`)}</div></div>
  ${typeof hrSettingsCard === 'function' ? hrSettingsCard() : ''}
  <div class="card"><h3>Production steps</h3>
    <p class="muted" style="margin-top:0">The steps every job card moves through, in order. The <b>first</b> step is planning (no stock is used yet); the <b>last</b> step means the job is finished. Changes apply to everyone and are saved immediately.</p>
    <div class="stack" id="stepList">${STAGES.map((n, i) => `<div class="row step-row"><span class="muted" style="min-width:22px">${i + 1}.</span><input value="${esc(n)}" data-change="stepName" data-i="${i}" aria-label="Step ${i + 1} name" style="flex:1;min-width:120px"><small class="muted">${S.jobs.filter(j => j.stage === i).length} job(s)</small><button class="btn btn-sm" data-act="saveStepMove" data-i="${i}" data-dir="-1"${i === 0 ? ' disabled' : ''} aria-label="Move up">↑</button><button class="btn btn-sm" data-act="saveStepMove" data-i="${i}" data-dir="1"${i === STAGES.length - 1 ? ' disabled' : ''} aria-label="Move down">↓</button><button class="btn btn-sm btn-danger" data-act="delStep" data-i="${i}"${STAGES.length <= 2 ? ' disabled' : ''}>Delete</button></div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><input id="newStep" placeholder="New step name, e.g. Lamination" style="flex:1;min-width:160px"><button class="btn btn-primary btn-sm" data-act="saveStepAdd">Add step</button></div>
    <small class="muted">A new step is added just before the last one. Use ↑ ↓ to reorder.</small></div>
  <div class="card"><h3>Color theme (everyone)</h3>
    <div class="field"><span>Theme color</span><div class="swatches">${Object.entries(PRESETS).map(([k, c]) => `<button class="sw${!s.accent && s.theme === k ? ' on' : ''}" style="background:${c}" data-act="theme" data-v="${k}" aria-label="${k}" title="${k}"></button>`).join('')}</div></div>
    <div class="field" style="margin-top:14px"><span>Custom accent color</span><div class="row"><input type="color" id="s-accent" value="${esc(s.accent || PRESETS[s.theme] || '#2563eb')}" data-change="accent">${s.accent ? '<button class="btn btn-sm" data-act="theme" data-v="' + esc(s.theme) + '">Reset</button>' : ''}</div></div></div>
  </div>
  <div class="card"><h3>This device</h3>
    <div class="grid2">${field('Mode (only this phone / computer)', `<select data-change="mode"><option value="auto"${s.mode === 'auto' ? ' selected' : ''}>Automatic (follow device)</option><option value="light"${s.mode === 'light' ? ' selected' : ''}>Light</option><option value="dark"${s.mode === 'dark' ? ' selected' : ''}>Dark</option></select>`)}</div>
    ${installEvt ? `<div class="row" style="margin-top:10px"><button class="btn" data-act="install">Install app on this device</button></div>` : ''}</div>
  ${catalogCard()}
  ${signatureCard()}
  ${isMgr() ? permCard() : ''}
  <div class="card"><h3>Data, backup & restore</h3>
    <p class="muted" style="margin-top:0">All staff work on one shared online database, so every phone and PC sees the same information.${isMgr() ? ` Please download a backup file regularly - the free Supabase plan does not make automatic backups. Backup files hold all records but not the artwork proof files. Last backup from this device: <b>${last}</b>.` : ''}</p>
    ${isMgr() ? `<div class="row"><button class="btn btn-primary" data-act="backup">${ic('download', 16)} Download backup</button>${isAdmin() ? `<button class="btn" data-act="pickRestore">${ic('upload', 16)} Restore from file</button><input type="file" id="restoreFile" accept=".json,application/json" hidden data-change="restore">` : ''}</div>` : ''}
    ${csvKinds.length ? `<hr><b>Export to Excel / CSV</b><div class="row" style="margin-top:8px">${csvKinds.map(k => `<button class="btn btn-sm" data-act="exportCsv" data-kind="${k}">${ic('download', 14)} ${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>` : ''}
    ${isAdmin() ? `<hr><div class="row"><button class="btn" data-act="sample">Load sample data</button><button class="btn btn-danger" data-act="eraseAll">Erase all data</button></div>` : ''}
  </div>
  <div class="card"><h3>Connection</h3><p class="muted" style="margin-top:0">Checks that the online database, your login and the file storage are working.</p>
    <div class="row"><button class="btn" data-act="runCheck">Run connection check</button>${isMgr() ? '<button class="btn" data-act="shareLink">Connect another device</button>' : ''}</div><div id="checkOut"></div></div>
  </div>`;
};
/* production steps: jobs store a step number, so adding / moving / deleting a step renumbers the affected jobs */
async function applyStages(list, map) {
  const before = S.jobs.map(j => [j, j.stage]);
  for (const [j, old] of before) {
    const n = map(old); if (n === old) continue;
    j.stage = n; await DB.put('jobs', j);
  }
  S.settings.stages = list; S.settings.stagesVer = 2; await saveSettings(); STAGES = list.slice();
  await reload();
}
const stepNameOk = (name, except = -1) => {
  if (!name) { toast('Type a step name'); return false; }
  if (STAGES.some((x, i) => i !== except && x.toLowerCase() === name.toLowerCase())) { toast('There is already a step with that name'); return false; }
  return true;
};
CHG.stepName = async el => {
  const i = +el.dataset.i, name = el.value.trim().replace(/\s+/g, ' ');
  if (name === STAGES[i]) return;
  if (!stepNameOk(name, i)) { el.value = STAGES[i]; return; }
  const list = STAGES.slice(); list[i] = name;
  S.settings.stages = list; await saveSettings(); STAGES = list; await reload(); toast('Step renamed');
};
ACT.saveStepAdd = async () => {
  const name = $('#newStep').value.trim().replace(/\s+/g, ' ');
  if (!stepNameOk(name)) return;
  const at = STAGES.length - 1, list = STAGES.slice(); list.splice(at, 0, name);
  await applyStages(list, o => o >= at ? o + 1 : o); toast('Step added');
};
ACT.saveStepMove = async ({ i, dir }) => {
  i = +i; const k = i + (+dir);
  if (k < 0 || k >= STAGES.length) return;
  const list = STAGES.slice(); [list[i], list[k]] = [list[k], list[i]];
  await applyStages(list, o => o === i ? k : o === k ? i : o); toast('Step moved');
};
ACT.delStep = async ({ i }) => {
  i = +i; if (STAGES.length <= 2) return toast('Keep at least two steps');
  const n = S.jobs.filter(j => j.stage === i).length, to = Math.max(0, i - 1);
  if (!confirm(`Delete the step "${STAGES[i]}"?${n ? `\n\n${n} job card(s) in this step will move to "${STAGES[i === 0 ? 1 : to]}".` : ''}`)) return;
  const list = STAGES.slice(); list.splice(i, 1);
  await applyStages(list, o => o > i ? o - 1 : o === i ? Math.min(i === 0 ? 0 : i - 1, list.length - 1) : o); toast('Step deleted');
};
ACT.saveSet = async () => {
  const s = S.settings, v = id => $(id).value.trim();
  Object.assign(s, { shopName: v('#s-name') || 'My Print Shop', tagline: v('#s-tag'), phone: v('#s-phone'), email: v('#s-email'), address: v('#s-addr'), website: v('#s-web'), taxNo: v('#s-tax'), currency: v('#s-cur') || 'NPR', taxLabel: v('#s-taxl') || 'Tax', taxRate: +$('#s-rate').value || 0, invoiceNote: v('#s-note'), paymentInfo: v('#s-pay'), machines: v('#s-mach'), expenseCats: v('#s-expcat') || DEFAULTS.expenseCats });
  s.prefixes = { quote: v('#s-pq'), order: v('#s-po'), invoice: v('#s-pi'), job: v('#s-pj'), art: v('#s-pa') };
  await saveSettings(); buildNav(); toast('Settings saved');
};
ACT.theme = async ({ v }) => { S.settings.theme = v; S.settings.accent = ''; await saveSettings(); applyTheme(); refresh(); };
CHG.accent = async el => { S.settings.accent = el.value; await saveSettings(); applyTheme(); refresh(); };
CHG.mode = el => setMode(el.value);
ACT.toggleMode = () => { setMode(document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'); if (current === 'settings') refresh(); };
ACT.openDrawer = openDrawer; ACT.closeDrawer = closeDrawer;
ACT.pickLogo = () => $('#logoFile').click();
ACT.rmLogo = async () => { S.settings.logo = ''; await saveSettings(); buildNav(); refresh(); };
function readLogo(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 360 / Math.max(img.width || 1, img.height || 1)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((img.width || 100) * sc)); c.height = Math.max(1, Math.round((img.height || 100) * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that image')); };
    img.src = u;
  });
}
CHG.logo = async el => { const f = el.files[0]; if (!f) return; S.settings.logo = await readLogo(f); await saveSettings(); buildNav(); refresh(); toast('Logo updated'); };
ACT.install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; refresh(); };

/* backup / restore */
const artFilePaths = async () => (await DB.all('artworks')).flatMap(a => (a.versions || []).map(v => v.path)).filter(Boolean);
ACT.backup = async () => {
  toast('Preparing backup…');
  const data = await DB.exportAll();
  let counters = {}; try { counters = await Cloud.rpc('get_counters'); } catch { /* only the administrator may read the number counters */ }
  download(`printpress-backup-${today()}.json`, JSON.stringify({ app: 'printpress-erp', version: 2, source: 'online', exportedAt: new Date().toISOString(), counters, data }), 'application/json');
  lsSet('pp-lastbackup', new Date().toISOString()); S.settings.lastBackup = lsGet('pp-lastbackup') || '';
  refresh(); toast('Backup downloaded');
};
ACT.pickRestore = () => $('#restoreFile').click();
/* backups made by the offline version hold artwork files inside the records: move them to file storage */
async function migrateArtFiles(data) {
  const todo = (data.artworks || []).flatMap(a => (a.versions || []).filter(v => v && safeData(v.dataUrl)).map(v => [a, v]));
  let n = 0;
  for (const [a, v] of todo) {
    toast(`Uploading artwork files ${++n} of ${todo.length}…`);
    const blob = dataToBlob(v.dataUrl); v.id = v.id || uid(); v.path = `${a.id}/${v.id}`;
    await Files.upload(v.path, blob, true);
    if (/^image\//.test(v.fileType || '')) { try { v.thumb = await makeThumb(blob); } catch { /* no thumbnail */ } }
    v.size = v.size || blob.size; delete v.dataUrl;
  }
}
CHG.restore = async el => {
  const f = el.files[0]; el.value = ''; if (!f) return;
  let payload;
  try { payload = JSON.parse(await f.text()); } catch { return toast('That file is not a valid backup'); }
  if (payload?.app !== 'printpress-erp' || !payload.data) return toast('That file is not a BizManager backup');
  const n = k => (payload.data[k] || []).length;
  if (!confirm(`Restore this backup?\n\nIt contains ${n('customers')} customers, ${n('orders')} orders/quotes, ${n('invoices')} invoices, ${n('inventory')} stock items, ${n('artworks')} artwork jobs, ${n('expenses')} expenses.\nExported: ${payload.exportedAt || 'unknown'}\n\nThis REPLACES ALL shared data for EVERY staff member. Download a backup of the current data first if you are not sure.`)) return;
  const data = payload.data, oldFiles = await artFilePaths();
  const counters = payload.counters || (data.settings || []).find(x => x?.id === 'main')?.counters || {};
  (data.settings || []).forEach(x => { delete x.counters; delete x.mode; delete x.lastBackup; });
  await migrateArtFiles(data);
  toast('Restoring data…');
  await DB.importAll(data);
  try { await Cloud.rpc('set_counters', { p_counters: counters }); } catch (e) { console.warn(e); }
  const keep = new Set((data.artworks || []).flatMap(a => (a.versions || []).map(v => v.path)));
  await Files.remove(oldFiles.filter(p => !keep.has(p))).catch(() => {});
  await loadAll(); applyTheme(); buildNav(); route(); toast('Backup restored');
};
ACT.eraseAll = async () => {
  if ((prompt('This deletes ALL shared data for EVERY staff member. Download a backup first!\nType DELETE to confirm.') || '') !== 'DELETE') return;
  const files = await artFilePaths();
  for (const s of DB.STORES) await DB.clear(s);
  await Files.remove(files).catch(() => {});
  try { await Cloud.rpc('set_counters', { p_counters: { quote: 0, order: 0, invoice: 0, job: 0, art: 0 } }); } catch (e) { console.warn(e); }
  await loadAll(); applyTheme(); buildNav(); route(); toast('All data erased');
};

/* CSV exports */
ACT.exportCsv = ({ kind }) => {
  const cn = id => cust(id)?.name || '';
  // Date range only applies when exporting from the Reports / Expenses screens, not from Settings.
  const [from, to] = ['reports', 'expenses'].includes(current) && ['sales', 'payments', 'expenses'].includes(kind) ? rangeBounds() : ['0000-01-01', '9999-12-31'];
  let rows;
  if (kind === 'customers') rows = [['Name', 'Contact', 'Phone', 'Email', 'PAN/VAT', 'Address', 'Credit limit', 'Outstanding'], ...S.customers.map(c => [c.name, c.contact, c.phone, c.email, c.taxNo, c.address, c.creditLimit || 0, outstanding(c.id)])];
  else if (kind === 'orders') rows = [['No', 'Type', 'Customer', 'Job', 'Date', 'Due', 'Status', 'Total'], ...S.orders.map(o => [o.no, o.type, cn(o.customerId), o.title, o.date, o.dueDate, o.status, calc(o).total])];
  else if (kind === 'invoices' || kind === 'sales') rows = [['Invoice', 'Order', 'Customer', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status'], ...S.invoices.filter(i => i.date >= from && i.date <= to).map(i => [i.no, i.orderNo, cn(i.customerId), i.date, i.dueDate, invTotal(i), paidAmt(i), balance(i), invStatus(i)])];
  else if (kind === 'payments') rows = [['Date', 'Invoice', 'Customer', 'Method', 'Amount', 'Note'], ...S.invoices.flatMap(i => (i.payments || []).filter(p => p.date >= from && p.date <= to).map(p => [p.date, i.no, cn(i.customerId), p.method, p.amount, p.note]))];
  else if (kind === 'inventory') rows = [['Item', 'Category', 'Unit', 'Stock', 'Minimum', 'Cost per unit', 'Supplier'], ...S.inventory.map(i => [i.name, i.category, i.unit, i.stock, i.min, i.cost, i.supplier])];
  else if (kind === 'expenses') rows = [['Date', 'Category', 'Description', 'Vendor', 'Reference', 'Order', 'Method', 'Amount'], ...S.expenses.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, e.category, e.description, e.vendor, e.ref, S.orders.find(o => o.id === e.orderId)?.no || '', e.method, e.amount])];
  else if (kind === 'artwork') rows = [['No', 'Title', 'Customer', 'Order', 'Status', 'Versions', 'Needed by', 'Approved by', 'Approved on'], ...S.artworks.map(a => [a.no, a.title, cn(a.customerId), orderOf(a)?.no || '', a.status, (a.versions || []).length, a.dueDate, a.approvedBy || '', a.approvedDate || ''])];
  else return;
  download(`printpress-${kind}-${today()}.csv`, csv(rows), 'text/csv;charset=utf-8');
};

/* =====================================================================
   DESIGN & ARTWORK
   ===================================================================== */
const ART_STATUS = ['Draft', 'Awaiting approval', 'Revision requested', 'Approved'];
const APPROVAL_VIA = ['Signed copy', 'Email', 'Phone call', 'Message / chat', 'In person'];
const ART_MAX = 10 * 1024 * 1024;
const safeData = u => /^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(u || '') ? u : '';
const isRaster = v => !!v && /^image\/(png|jpe?g|gif|webp)$/i.test(v.fileType || '');
const thumbSrc = v => safeData(v?.thumb) || safeData(v?.dataUrl);
const hasFile = v => !!v && !!(v.path || safeData(v.dataUrl));
const latestVer = a => (a.versions || [])[(a.versions || []).length - 1];
const addHist = (a, text) => (a.history = a.history || []).push({ ts: Date.now(), text });
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB';
const putArt = a => { a.updatedAt = Date.now(); return DB.put('artworks', a); };
const orderOf = a => S.orders.find(o => o.id === a.orderId);

function loadImg(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(u); res(img); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that image')); };
    img.src = u;
  });
}
const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
function scaled(img, max) {
  const w = img.width || 1, h = img.height || 1, sc = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
}
async function makeThumb(blob) { return scaled(await loadImg(blob), 320).toDataURL('image/jpeg', 0.72); }
async function readArtFile(file) {
  const meta = { fileName: file.name, fileType: file.type || 'application/octet-stream' };
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    const img = await loadImg(file), big = scaled(img, 2400);
    let blob = await canvasBlob(big, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
    if (blob && blob.size > ART_MAX) blob = await canvasBlob(big, 'image/jpeg', 0.7);
    if (!blob || blob.size > ART_MAX) throw new Error('That image is too large. Export a smaller proof.');
    return { meta: { ...meta, fileType: blob.type, size: blob.size, thumb: scaled(img, 320).toDataURL('image/jpeg', 0.72) }, blob };
  }
  if (file.size > ART_MAX) throw new Error('File is larger than 10 MB. Export a smaller proof (PDF or JPG).');
  return { meta: { ...meta, size: file.size }, blob: file };
}
function dataToBlob(u) {
  const [h, b] = u.split(','), mime = h.slice(5, h.indexOf(';')), bin = atob(b), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
const blobToDataUrl = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('Could not read file')); fr.readAsDataURL(b); });
const URLS = new Map();
async function verBlob(v) {
  if (v.path) return Files.download(v.path);
  const u = safeData(v.dataUrl); if (!u) throw new Error('No file stored for this version');
  return dataToBlob(u);
}
async function verUrl(v) {
  const k = v.path || v.id;
  if (!URLS.has(k)) URLS.set(k, URL.createObjectURL(new Blob([await verBlob(v)], { type: v.fileType || 'application/octet-stream' })));
  return URLS.get(k);
}
/* upload the file to private storage first, then the record points at it */
async function addVersion(a, file, note) {
  const { meta, blob } = await readArtFile(file);
  const ver = { id: uid(), n: (a.versions || []).length + 1, date: today(), note, ...meta };
  ver.path = `${a.id}/${ver.id}`;
  await Files.upload(ver.path, blob);
  (a.versions = a.versions || []).push(ver);
  return ver;
}
const viewable = v => v.fileType === 'application/pdf' || /^image\/(png|jpe?g|gif|webp)$/.test(v.fileType || '');
ACT.artOpen = async ({ id, v }) => {
  const ver = S.artworks.find(x => x.id === id)?.versions?.[+v];
  if (!hasFile(ver)) return toast('No file stored for this version');
  if (!viewable(ver)) return ACT.artDl({ id, v });
  const win = window.open('', '_blank');             // opened first so the browser does not block it
  try { const u = await verUrl(ver); if (win) win.location = u; else window.open(u, '_blank'); }
  catch (e) { win?.close(); throw e; }
};
ACT.artDl = async ({ id, v }) => {
  const ver = S.artworks.find(x => x.id === id)?.versions?.[+v];
  if (!hasFile(ver)) return toast('No file stored for this version');
  download(String(ver.fileName || 'artwork').replace(/[\\/:*?"<>|]/g, '_'), await verBlob(ver), ver.fileType || 'application/octet-stream');
};

LIST.artwork = () => {
  let rows = [...S.artworks].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  if (UI.f) rows = rows.filter(a => a.status === UI.f);
  const q = (UI.q || '').toLowerCase();
  if (q) rows = rows.filter(a => [a.no, a.title, cust(a.customerId)?.name, orderOf(a)?.no].join(' ').toLowerCase().includes(q));
  if (!rows.length) return empty('No artwork yet', 'Track proofs, revisions and customer approvals for each job.', `<button class="btn btn-primary" data-act="artForm">${ic('plus', 16)} New artwork</button>`);
  return `<table class="rtable"><thead><tr><th></th><th>Artwork</th><th>Customer</th><th>Order</th><th>Version</th><th>Status</th><th>Needed by</th></tr></thead><tbody>${rows.map(a => { const lv = latestVer(a); return `<tr data-act="artView" data-id="${a.id}"><td class="noL">${isRaster(lv) && thumbSrc(lv) ? `<img class="thumb" src="${esc(thumbSrc(lv))}" alt="">` : `<span class="thumb">${lv ? 'FILE' : '—'}</span>`}</td><td data-label="Artwork"><b>${esc(a.no)}</b><small>${esc(a.title)}</small></td><td data-label="Customer">${esc(cust(a.customerId)?.name || '—')}</td><td data-label="Order">${esc(orderOf(a)?.no || '—')}</td><td data-label="Version">${lv ? 'v' + lv.n : '—'}</td><td data-label="Status">${badge(a.status)}</td><td data-label="Needed by">${fmtDate(a.dueDate)}</td></tr>`; }).join('')}</tbody></table>`;
};
VIEWS.artwork = () => {
  const n = s => S.artworks.filter(a => a.status === s).length;
  return `<div class="page-head"><h2>Design & Artwork</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="artwork">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="artForm">${ic('plus', 16)} New artwork</button></div></div>
  <div class="grid4" style="margin-bottom:14px"><div class="stat s-orange"><span>Draft</span><b>${n('Draft')}</b></div><div class="stat s-blue"><span>Awaiting approval</span><b>${n('Awaiting approval')}</b></div><div class="stat s-pink"><span>Revision requested</span><b>${n('Revision requested')}</b></div><div class="stat s-green"><span>Approved</span><b>${n('Approved')}</b></div></div>
  <div class="toolbar"><input type="search" placeholder="Search artwork, customer or order…" data-ui="q" value="${esc(UI.q)}"><select data-ui="f"><option value="">All statuses</option>${opts(ART_STATUS, UI.f)}</select></div>
  <div class="card" id="list">${LIST.artwork()}</div>`;
};
function artForm(id, pre = {}) {
  const a = S.artworks.find(x => x.id === id);
  if (!a && !S.customers.length) { toast('Add a customer first'); return ACT.custForm({}); }
  const d = a || { orderId: pre.orderId || '', customerId: pre.customerId || '', title: '', notes: '', dueDate: '' };
  if (!a && d.orderId) { const o = S.orders.find(x => x.id === d.orderId); if (o) { d.customerId = o.customerId; d.title = o.title || ''; } }
  openModal(a ? `Edit artwork ${a.no}` : 'New artwork', `<div class="grid2">
    ${field('Order (optional)', `<select id="a-order" data-change="artOrder"><option value="">— none —</option>${opts(S.orders.filter(o => o.type === 'order').map(o => [o.id, `${o.no} - ${cust(o.customerId)?.name || ''}`]), d.orderId)}</select>`)}
    ${field('Customer *', `<select id="a-cust"><option value="">Select customer…</option>${opts(S.customers.map(c => [c.id, c.name]), d.customerId)}</select>`)}
    ${field('Title *', `<input id="a-title" value="${esc(d.title)}" placeholder="e.g. Brochure front cover">`)}
    ${field('Approval needed by', `<input id="a-due" type="date" value="${esc(d.dueDate)}">`)}</div>
    ${a ? '' : `<div style="margin-top:12px">${field('First proof (image or PDF, up to 10 MB) - optional', `<input type="file" id="a-file" accept="image/*,application/pdf,.ai,.psd,.cdr,.zip">`)}</div>`}
    <div style="margin-top:12px">${field('Brief / notes for the designer', `<textarea id="a-notes">${esc(d.notes)}</textarea>`)}</div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveArt" data-id="${a?.id || ''}">Save</button>`);
}
ACT.artForm = ({ id }) => artForm(id);
ACT.orderArt = ({ id }) => artForm(null, { orderId: id });
CHG.artOrder = el => { const o = S.orders.find(x => x.id === el.value); if (!o) return; $('#a-cust').value = o.customerId; if (!$('#a-title').value) $('#a-title').value = o.title || ''; };
ACT.saveArt = async ({ id }) => {
  const old = S.artworks.find(x => x.id === id), customerId = $('#a-cust').value, title = $('#a-title').value.trim();
  if (!customerId) return toast('Select a customer'); if (!title) return toast('Enter a title');
  const a = { ...(old || {}), id: old?.id || uid(), orderId: $('#a-order').value, customerId, title, dueDate: $('#a-due').value, notes: $('#a-notes').value.trim(), createdAt: old?.createdAt || Date.now() };
  if (!old) {
    a.no = await nextNo('art'); a.status = 'Draft'; a.versions = []; a.history = []; addHist(a, 'Artwork job created');
    const f = $('#a-file')?.files[0];
    if (f) { toast('Uploading proof…'); try { await addVersion(a, f, ''); addHist(a, 'Version 1 uploaded'); } catch (e) { return showErr(e); } }
  }
  try { await putArt(a); } catch (e) { if (!old) await Files.remove((a.versions || []).map(v => v.path)).catch(() => {}); throw e; }
  const o = orderOf(a);
  if (!old && o && o.status === 'Pending') { try { await DB.setOrderStatus(o.id, 'Design'); } catch (e) { console.warn(e); } }
  closeModal(); await reload(); toast(`${a.no} saved`); ACT.artView({ id: a.id });
};
ACT.artView = ({ id }) => {
  const a = S.artworks.find(x => x.id === id); if (!a) return;
  const c = cust(a.customerId), o = orderOf(a), lv = latestVer(a), vs = a.versions || [];
  const prev = lv ? (isRaster(lv) && hasFile(lv) ? `<img class="art-prev" id="art-prev" src="${esc(thumbSrc(lv) || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')}" alt="Latest proof">` : `<div class="file-box"><b>${esc(lv.fileName || 'File')}</b><br>${hasFile(lv) ? esc(kb(lv.size)) : 'No file stored'}</div>`) : `<div class="file-box">No proof uploaded yet. Upload a version to send it for approval.</div>`;
  const body = `<div class="row" style="justify-content:space-between;margin-bottom:8px"><div><b style="font-size:18px">${esc(a.no)}</b> ${badge(a.status)}<small>${esc(a.title)}</small></div></div>
    <dl class="kv"><dt>Customer</dt><dd>${esc(c?.name || '—')}</dd><dt>Order</dt><dd>${o ? `<a href="#" data-act="orderView" data-id="${o.id}">${esc(o.no)}</a>` : '—'}</dd><dt>Needed by</dt><dd>${fmtDate(a.dueDate)}</dd>${a.status === 'Approved' ? `<dt>Approved</dt><dd><b>v${a.approvedVersion || '?'}</b> by ${esc(a.approvedBy || '—')} on ${fmtDate(a.approvedDate)}${a.approvalNote ? ` (${esc(a.approvalNote)})` : ''}</dd>` : ''}${a.notes ? `<dt>Brief</dt><dd style="white-space:pre-wrap">${esc(a.notes)}</dd>` : ''}</dl>
    ${prev}
    <b>Versions</b>${vs.length ? [...vs].reverse().map(v => { const i = vs.indexOf(v); return `<div class="ver"><div><b>v${v.n}</b> · ${fmtDate(v.date)}<small>${esc(v.fileName || '')}${v.size ? ' · ' + esc(kb(v.size)) : ''}${v.note ? ' · ' + esc(v.note) : ''}</small></div>${hasFile(v) ? `<div class="row"><button class="btn btn-sm" data-act="artOpen" data-id="${a.id}" data-v="${i}">Open</button><button class="btn btn-sm" data-act="artDl" data-id="${a.id}" data-v="${i}">${ic('download', 14)}</button></div>` : '<small>no file</small>'}</div>`; }).join('') : '<p class="muted">None yet.</p>'}
    <hr><b>History</b><ul class="hist">${[...(a.history || [])].reverse().map(h => `<li><small>${fmtDate(new Date(h.ts).toISOString())}</small><span>${esc(h.text)}</span></li>`).join('')}</ul>`;
  let primary = '';
  if (a.status === 'Draft' || a.status === 'Revision requested') primary = lv ? `<button class="btn btn-primary" data-act="artSend" data-id="${a.id}">Send for approval</button>` : '';
  else if (a.status === 'Awaiting approval') primary = `<button class="btn" data-act="revForm" data-id="${a.id}">Request revision</button><button class="btn btn-primary" data-act="apprForm" data-id="${a.id}">Record approval</button>`;
  else primary = `<button class="btn" data-act="artReopen" data-id="${a.id}">Reopen</button>`;
  openModal('Artwork', body, `<button class="btn btn-danger grow" data-act="delArt" data-id="${a.id}">Delete</button><button class="btn" data-act="printArt" data-id="${a.id}">${ic('printer', 16)} Approval sheet</button><button class="btn" data-act="artForm" data-id="${a.id}">Edit</button><button class="btn" data-act="verForm" data-id="${a.id}">${ic('upload', 16)} Upload version</button>${primary}`);
  if (lv?.path && isRaster(lv)) verUrl(lv).then(u => { const im = $('#art-prev'); if (im) im.src = u; }).catch(() => {});   // full-size proof loads after the thumbnail
};
ACT.verForm = ({ id }) => {
  const a = S.artworks.find(x => x.id === id);
  openModal(`Upload version v${(a.versions || []).length + 1}`, `${field('File (image or PDF, up to 10 MB)', '<input type="file" id="v-file" accept="image/*,application/pdf,.ai,.psd,.cdr,.zip">')}<div style="margin-top:12px">${field('What changed?', '<input id="v-note" placeholder="e.g. Logo moved, new phone number">')}</div>${a.status === 'Approved' ? '<p class="muted">Uploading a new version resets the customer approval.</p>' : ''}`,
    `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveVer" data-id="${id}">Upload</button>`, 'sm');
};
ACT.saveVer = async ({ id }) => {
  const a = S.artworks.find(x => x.id === id), f = $('#v-file').files[0];
  if (!f) return toast('Choose a file');
  if (a.status === 'Approved' && !confirm('This resets the customer approval. Continue?')) return;
  toast('Uploading…');
  let ver; try { ver = await addVersion(a, f, $('#v-note').value.trim()); } catch (e) { return showErr(e); }
  const n = ver.n;
  addHist(a, `Version ${n} uploaded`);
  if (a.status !== 'Draft') { a.status = 'Draft'; a.approvedBy = a.approvedDate = a.approvedVersion = a.approvalNote = ''; addHist(a, 'Status reset to Draft'); }
  try { await putArt(a); } catch (e) { await Files.remove([ver.path]).catch(() => {}); await reload().catch(() => {}); throw e; }
  closeModal(); await reload(); toast(`Version ${n} uploaded`); ACT.artView({ id });
};
ACT.artSend = async ({ id }) => {
  const a = S.artworks.find(x => x.id === id); a.status = 'Awaiting approval'; addHist(a, `Sent to customer for approval (v${latestVer(a).n})`);
  await putArt(a); await reload(); toast('Marked as sent for approval'); ACT.artView({ id });
};
ACT.apprForm = ({ id }) => {
  const a = S.artworks.find(x => x.id === id), c = cust(a.customerId);
  openModal('Record approval', `<p>Version <b>v${latestVer(a)?.n || '?'}</b> of ${esc(a.title)}</p><div class="grid2">${field('Approved by *', `<input id="ap-by" value="${esc(c?.contact || c?.name || '')}">`)}${field('Date', `<input id="ap-date" type="date" value="${today()}">`)}${field('How was it approved?', `<select id="ap-via">${opts(APPROVAL_VIA)}</select>`)}${field('Note', `<input id="ap-note" placeholder="Optional">`)}</div>`,
    `<button class="btn" data-act="artView" data-id="${id}">Back</button><button class="btn btn-primary" data-act="saveAppr" data-id="${id}">Approve</button>`, 'sm');
};
ACT.saveAppr = async ({ id }) => {
  const a = S.artworks.find(x => x.id === id), by = $('#ap-by').value.trim(); if (!by) return toast('Enter who approved it');
  a.status = 'Approved'; a.approvedBy = by; a.approvedDate = $('#ap-date').value || today(); a.approvedVersion = latestVer(a)?.n || 0;
  a.approvalNote = [$('#ap-via').value, $('#ap-note').value.trim()].filter(Boolean).join(': ');
  addHist(a, `Approved by ${by} (v${a.approvedVersion}, ${a.approvalNote})`); await putArt(a);
  const o = orderOf(a); if (o && o.status === 'Design') { try { await DB.setOrderStatus(o.id, 'Pending'); } catch (e) { console.warn(e); } }
  await reload(); toast('Artwork approved'); ACT.artView({ id });
};
ACT.revForm = ({ id }) => {
  openModal('Request revision', field('What should change? *', '<textarea id="rv-note" placeholder="Customer feedback…"></textarea>'),
    `<button class="btn" data-act="artView" data-id="${id}">Back</button><button class="btn btn-primary" data-act="saveRev" data-id="${id}">Save</button>`, 'sm');
};
ACT.saveRev = async ({ id }) => {
  const note = $('#rv-note').value.trim(); if (!note) return toast('Describe the change');
  const a = S.artworks.find(x => x.id === id); a.status = 'Revision requested'; addHist(a, 'Revision requested: ' + note);
  await putArt(a); await notifyRevision(a, note); await reload(); toast('Revision requested'); ACT.artView({ id });
};
ACT.artReopen = async ({ id }) => {
  if (!confirm('Reopen this artwork? Approval will be cleared.')) return;
  const a = S.artworks.find(x => x.id === id); a.status = 'Draft'; a.approvedBy = a.approvedDate = a.approvedVersion = a.approvalNote = ''; addHist(a, 'Reopened');
  await putArt(a); await reload(); ACT.artView({ id });
};
ACT.delArt = async ({ id }) => { if (!confirm('Delete this artwork and all its versions?')) return; const paths = (S.artworks.find(x => x.id === id)?.versions || []).map(v => v.path); await DB.del('artworks', id); Files.remove(paths).catch(() => {}); closeModal(); await reload(); toast('Deleted'); };
ACT.printArt = async ({ id }) => {
  const a = S.artworks.find(x => x.id === id), c = cust(a.customerId), o = orderOf(a), lv = latestVer(a);
  let printImg = ''; if (isRaster(lv) && hasFile(lv)) { try { printImg = await blobToDataUrl(await verBlob(lv)); } catch { /* print without the picture */ } }
  const html = `<div class="pd">${letterhead('ARTWORK APPROVAL', `No: <b>${esc(a.no)}</b><br>Version: ${lv ? 'v' + lv.n : '—'}<br>Date: ${fmtDate(today())}`)}${billTo(c, `<h5>Job</h5><b>${esc(a.title)}</b>${o ? `<br>Order: ${esc(o.no)}` : ''}`)}${printImg ? `<div style="text-align:center;margin:10px 0"><img src="${esc(printImg)}" alt="" style="max-width:100%;max-height:420px;border:1px solid #ccc"></div>` : `<div style="border:1px dashed #999;padding:30px;text-align:center;margin:10px 0">${lv ? 'Proof file: ' + esc(lv.fileName || '') : 'No proof attached'}</div>`}${a.notes ? `<div class="pd-note"><b>Brief:</b> ${esc(a.notes)}</div>` : ''}<div class="pd-note">I have checked this artwork (text, spelling, colors, sizes and contact details) and approve it for printing.</div><div class="pd-sign"><span>Customer name &amp; signature</span><span>Date</span></div>${a.status === 'Approved' ? `<div class="pd-foot">Recorded approval: ${esc(a.approvedBy || '')} on ${fmtDate(a.approvedDate)}</div>` : ''}</div>`;
  doPrint(html, a.no);
};

/* =====================================================================
   EXPENSES
   ===================================================================== */
const expCats = () => { const l = S.settings.expenseCats.split(',').map(x => x.trim()).filter(Boolean); return l.length ? l : ['Other']; };
const orderCost = id => r2(S.expenses.filter(e => e.orderId === id).reduce((a, e) => a + e.amount, 0));
const orderCostHtml = o => {
  const cost = orderCost(o.id); if (!cost) return '';
  const rev = calc(o).total, m = r2(rev - cost);
  return `<hr><b>Job costing</b><dl class="kv" style="margin-top:6px"><dt>Order value</dt><dd>${money(rev)}</dd><dt>Linked expenses</dt><dd>${money(cost)}</dd><dt>Margin</dt><dd><b style="color:${m < 0 ? 'var(--danger)' : 'inherit'}">${money(m)}</b></dd></dl>`;
};
function rangeControls() {
  return `<select data-ui="range">${opts([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom range']], UI.range)}</select>${UI.range === 'custom' ? `<input type="date" data-ui="from" value="${esc(UI.from)}" style="width:auto"><input type="date" data-ui="to" value="${esc(UI.to)}" style="width:auto">` : ''}`;
}
function expFiltered(withSearch = true) {
  const [from, to] = rangeBounds();
  let rows = S.expenses.filter(e => e.date >= from && e.date <= to);
  if (UI.f) rows = rows.filter(e => e.category === UI.f);
  const q = (UI.q || '').toLowerCase();
  if (withSearch && q) rows = rows.filter(e => [e.description, e.vendor, e.ref, e.category, S.orders.find(o => o.id === e.orderId)?.no].join(' ').toLowerCase().includes(q));
  return rows.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}
const hbars = entries => { const mx = Math.max(1, ...entries.map(e => e[1])); return entries.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div><i style="width:${Math.round(v / mx * 100)}%"></i></div><b class="r">${money(v)}</b></div>`).join(''); };
LIST.expenses = () => {
  const rows = expFiltered();
  if (!rows.length) return empty('No expenses found', 'Record purchases, salaries, rent and other costs to see profit in Reports.', `<button class="btn btn-primary" data-act="expForm">${ic('plus', 16)} New expense</button>`);
  return `<table class="rtable"><thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Order</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>${rows.map(e => `<tr data-act="expForm" data-id="${e.id}"><td data-label="Date">${fmtDate(e.date)}</td><td data-label="Category">${esc(e.category)}</td><td data-label="Details">${esc(e.description || '—')}<small>${esc([e.vendor, e.ref].filter(Boolean).join(' · '))}</small></td><td data-label="Order">${esc(S.orders.find(o => o.id === e.orderId)?.no || '—')}</td><td data-label="Method">${esc(e.method || '—')}</td><td class="r" data-label="Amount"><b>${money(e.amount)}</b></td></tr>`).join('')}</tbody></table>`;
};
VIEWS.expenses = () => {
  const rows = expFiltered(false), total = r2(rows.reduce((a, e) => a + e.amount, 0));
  const byCat = {}; rows.forEach(e => { byCat[e.category] = r2((byCat[e.category] || 0) + e.amount); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), linked = r2(rows.filter(e => e.orderId).reduce((a, e) => a + e.amount, 0));
  const present = [...new Set([...expCats(), ...S.expenses.map(e => e.category)])];
  return `<div class="page-head"><h2>Expenses</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="expenses">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="expForm">${ic('plus', 16)} New expense</button></div></div>
  <div class="toolbar">${rangeControls()}<select data-ui="f"><option value="">All categories</option>${opts(present, UI.f)}</select><input type="search" placeholder="Search expenses…" data-ui="q" value="${esc(UI.q)}"></div>
  <div class="grid4" style="margin-bottom:14px"><div class="stat s-pink"><span>Total spent</span><b>${money(total)}</b></div><div class="stat s-blue"><span>Entries</span><b>${rows.length}</b></div><div class="stat s-orange"><span>Top category</span><b style="font-size:19px">${esc(cats[0]?.[0] || '—')}</b><small>${cats[0] ? money(cats[0][1]) : ''}</small></div><div class="stat s-green"><span>Linked to orders</span><b>${money(linked)}</b></div></div>
  ${cats.length ? `<div class="card" style="margin-bottom:14px"><h3>By category</h3>${hbars(cats)}</div>` : ''}
  <div class="card" id="list">${LIST.expenses()}</div>`;
};
ACT.expForm = ({ id } = {}) => {
  const e = S.expenses.find(x => x.id === id) || {};
  const cats = expCats(); if (e.category && !cats.includes(e.category)) cats.push(e.category);
  openModal(id ? 'Edit expense' : 'New expense', `<div class="grid2">
    ${field('Date *', `<input id="e-date" type="date" value="${esc(e.date || today())}">`)}${field(`Amount * (${esc(S.settings.currency)})`, `<input id="e-amt" type="number" min="0" step="any" inputmode="decimal" value="${e.amount ?? ''}">`)}
    ${field('Category *', `<select id="e-cat">${opts(cats, e.category || cats[0])}</select>`)}${field('Payment method', `<select id="e-method">${opts(PAY_METHODS, e.method || 'Cash')}</select>`)}
    <datalist id="sups">${S.suppliers.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>${field('Description', `<input id="e-desc" value="${esc(e.description)}" placeholder="What was it for?">`)}${field('Paid to / vendor', `<input id="e-vendor" list="sups" value="${esc(e.vendor)}">`)}
    ${field('Bill / reference no.', `<input id="e-ref" value="${esc(e.ref)}">`)}${field('Link to order (optional)', `<select id="e-order"><option value="">— none —</option>${opts(S.orders.filter(o => o.type === 'order').map(o => [o.id, `${o.no} - ${cust(o.customerId)?.name || ''}`]), e.orderId)}</select>`)}</div>`,
    `${id ? `<button class="btn btn-danger grow" data-act="delExp" data-id="${id}">Delete</button>` : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveExp" data-id="${id || ''}">Save</button>`);
};
ACT.saveExp = async ({ id }) => {
  const amt = r2($('#e-amt').value); if (!(amt > 0)) return toast('Enter an amount');
  const date = $('#e-date').value; if (!date) return toast('Choose a date');
  const old = S.expenses.find(x => x.id === id) || {};
  const e = { ...old, id: old.id || uid(), date, amount: amt, category: $('#e-cat').value, method: $('#e-method').value, description: $('#e-desc').value.trim(), vendor: $('#e-vendor').value.trim(), supplierId: S.suppliers.find(x => x.name.toLowerCase() === $('#e-vendor').value.trim().toLowerCase())?.id || '', ref: $('#e-ref').value.trim(), orderId: $('#e-order').value, createdAt: old.createdAt || Date.now() };
  await DB.put('expenses', e); closeModal(); await reload(); toast('Expense saved');
};
ACT.delExp = async ({ id }) => { if (!confirm('Delete this expense?')) return; await DB.del('expenses', id); closeModal(); await reload(); toast('Deleted'); };

/* sample data */
ACT.sample = async () => {
  if (S.customers.length + S.orders.length + S.inventory.length && !confirm('Add sample data to your existing data?')) return;
  const ago = n => addDays(today(), -n), mk = o => ({ id: uid(), createdAt: Date.now(), ...o });
  const cs = ['ABC Traders', 'Sunrise School', 'Om Hospital', 'Fashion Point'].map((name, i) => mk({ name, contact: ['Ram', 'Sita', 'Hari', 'Gita'][i], phone: `98000000${i}0`, address: 'Main Road', creditLimit: i === 1 ? 50000 : 0 }));
  for (const c of cs) { c.createdAt += 1; await DB.put('customers', c); }
  const inv = [['Art Paper 130gsm', 'Paper', 'sheet', 5000, 1000, 4], ['Art Card 300gsm', 'Paper', 'sheet', 800, 1000, 9], ['Offset Plate', 'Plates', 'pcs', 40, 20, 450], ['Black Ink', 'Ink', 'kg', 12, 5, 1100], ['Cyan Ink', 'Ink', 'kg', 2, 3, 1250], ['Flex Roll 3m', 'Large format', 'roll', 6, 2, 9000], ['Lamination Film', 'Finishing', 'roll', 8, 3, 3200]].map(([name, category, unit, stock, min, cost]) => mk({ name, category, unit, stock, min, cost }));
  for (const i of inv) await DB.put('inventory', i);
  const specs = [[0, 'Visiting cards 1000 pcs', [['Visiting card (1000 pcs)', 1, 1800]], 'Delivered', 130], [1, 'School brochure A4', [['Brochure A4 4-page', 500, 38]], 'Delivered', 100], [2, 'Letterheads', [['Letterhead A4', 2000, 6.5]], 'Completed', 70], [3, 'Shop banner', [['Flex banner 6x3 ft', 2, 2400]], 'Completed', 45], [0, 'Packaging boxes', [['Packaging box', 1000, 22]], 'In Production', 20], [1, 'Exam registers', [['Register 200 pages', 300, 95]], 'Pending', 5]];
  const made = [];
  for (const [ci, title, its, status, d] of specs) {
    const o = mk({ type: 'order', customerId: cs[ci].id, title, date: ago(d), dueDate: addDays(ago(d), 7), status, items: its.map(([desc, qty, rate]) => ({ desc, qty, rate })), discount: 0, taxRate: S.settings.taxRate, notes: '' });
    o.no = await nextNo('order'); await DB.put('orders', o); made.push(o);
  }
  const q = mk({ type: 'quote', customerId: cs[2].id, title: 'Patient files', date: ago(2), dueDate: addDays(today(), 12), status: 'Sent', items: [{ desc: 'Patient file folder', qty: 500, rate: 28 }], discount: 0, taxRate: S.settings.taxRate, notes: '' });
  q.no = await nextNo('quote'); await DB.put('orders', q);
  for (const [k, o] of made.slice(0, 4).entries()) {
    const i = mk({ customerId: o.customerId, orderId: o.id, orderNo: o.no, date: addDays(o.date, 5), dueDate: addDays(o.date, 20), items: o.items, discount: 0, taxRate: o.taxRate, notes: '', payments: [] });
    i.no = await nextNo('invoice');
    const tot = calc(i).total;
    if (k === 0) i.payments.push({ id: uid(), date: addDays(i.date, 3), amount: tot, method: 'Cash', note: '' });
    if (k === 1) i.payments.push({ id: uid(), date: addDays(i.date, 10), amount: r2(tot / 2), method: 'Bank transfer', note: '' });
    if (k === 2) i.payments.push({ id: uid(), date: addDays(i.date, 4), amount: tot, method: 'Mobile wallet', note: '' });
    await DB.put('invoices', i);
  }
  const jb = mk({ orderId: made[4].id, title: made[4].title, designer: 'Anita', machine: 'Offset Press', operator: 'Bikash', finisher: 'Suman', qc: 'Rita', priority: 'High', dueDate: made[4].dueDate, stage: 2, brief: 'Match the colours of last year\'s brochure.', notes: '', refs: [] });
  jb.no = await nextNo('job'); await DB.put('jobs', jb);
  /* artwork + expenses samples */
  const proof = async (label, c1, c2, aid, vid) => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 420; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 640, 420); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 640, 420);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(40, 40, 560, 340); x.fillStyle = c1; x.font = 'bold 42px sans-serif'; x.fillText(label, 70, 150);
    x.fillStyle = '#334155'; x.font = '24px sans-serif'; x.fillText('Sample proof', 70, 200); x.fillRect(70, 240, 300, 10); x.fillRect(70, 270, 220, 10);
    const blob = await canvasBlob(c, 'image/jpeg', 0.8); await Files.upload(`${aid}/${vid}`, blob);
    return { fileName: label.toLowerCase().replace(/\W+/g, '-') + '.jpg', fileType: 'image/jpeg', path: `${aid}/${vid}`, thumb: scaled(c, 240).toDataURL('image/jpeg', 0.7), size: blob.size };
  };
  const artSpecs = [[0, 'Visiting card design', 'Approved', 1, 130], [4, 'Box dieline and print design', 'Awaiting approval', 2, 20], [5, 'Register cover', 'Draft', 1, 5]];
  for (const [oi, title, status, nv, d] of artSpecs) {
    const o = made[oi], a = mk({ orderId: o.id, customerId: o.customerId, title, notes: '', dueDate: addDays(ago(d), 2), status, versions: [], history: [] });
    a.no = await nextNo('art'); a.history.push({ ts: Date.now() - 5e5, text: 'Artwork job created' });
    for (let v = 1; v <= nv; v++) { const vid = uid(); a.versions.push({ id: vid, n: v, date: addDays(ago(d), v - 1), note: v > 1 ? 'Colors adjusted' : '', ...await proof(title, ['#2563eb', '#dc2626', '#059669'][artSpecs.findIndex(s => s[1] === title)], '#0f172a', a.id, vid) }); a.history.push({ ts: Date.now() - 4e5 + v, text: `Version ${v} uploaded` }); }
    if (status === 'Approved') { a.approvedBy = cs[oi === 0 ? 0 : 1].contact; a.approvedDate = addDays(ago(d), 1); a.approvedVersion = nv; a.approvalNote = 'Email'; a.history.push({ ts: Date.now() - 3e5, text: `Approved by ${a.approvedBy} (v${nv}, Email)` }); }
    if (status === 'Awaiting approval') a.history.push({ ts: Date.now() - 3e5, text: `Sent to customer for approval (v${nv})` });
    a.updatedAt = Date.now(); await DB.put('artworks', a);
  }
  const cats = expCats(), cat = k => cats[k] || cats[cats.length - 1];
  const expSpecs = [[2, 0, 'Art paper 130gsm, 10 reams', 'City Paper Traders', 2850, 'Bank transfer', made[4].id], [4, 1, 'Offset plates and black ink', 'Plate House', 1420, 'Cash', made[4].id], [9, 2, 'Staff salaries', '', 4200, 'Bank transfer', ''], [10, 3, 'Shop rent', '', 2500, 'Bank transfer', ''], [14, 4, 'Electricity bill', 'NEA', 640, 'Mobile wallet', ''], [21, 5, 'Press servicing', 'Mech Works', 520, 'Cash', ''], [27, 6, 'Delivery van fuel', '', 310, 'Cash', ''], [33, 7, 'Facebook ads', '', 400, 'Card', ''], [46, 0, 'Art card 300gsm', 'City Paper Traders', 2100, 'Cheque', made[3].id], [60, 2, 'Staff salaries', '', 4200, 'Bank transfer', '']];
  for (const [d, c, description, vendor, amount, method, orderId] of expSpecs) await DB.put('expenses', mk({ date: ago(d), category: cat(c), description, vendor, ref: '', amount, method, orderId }));
  await reload(); toast('Sample data added');
};

/* =====================================================================
   EVENTS & INIT
   ===================================================================== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (e.target.closest('[data-close]')) closeModal(); return; }
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  if (/^(BUTTON|A)$/.test(el.tagName) && !allowedAct(el.dataset.act, el.dataset)) return toast('You do not have permission to do that.');
  const changes = /^(save|del|convert|moveJob|art(Send|Reopen)|backup|eraseAll|sample|pay(Paid|Reopen)|attImport|attMarkAll|jobMake)/.test(el.dataset.act);
  if (changes) { if (busy) return; busy = true; document.body.classList.add('busy'); }       // a second tap while saving is ignored (no double invoices)
  try { await ACT[el.dataset.act]?.(el.dataset, el); } catch (err) { showErr(err); }
  finally { if (changes) { busy = false; document.body.classList.remove('busy'); } }
});
let busy = false;
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-ui="q"]')) { UI.q = t.value; refreshList(); }
  if (t.closest('.modal') && t.matches('.item-row input, #f-discount, #f-tax')) recalc();
});
document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.matches('[data-ui]') && t.dataset.ui !== 'q') { UI[t.dataset.ui] = t.value; refresh(); }
    else if (t.dataset.change) await CHG[t.dataset.change]?.(t);
  } catch (err) { showErr(err); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });
window.addEventListener('hashchange', route);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.settings?.mode === 'auto') { applyTheme(); updateChrome(); } });

/* Start-up (login, loading data, staff screen) is in js/online.js */
