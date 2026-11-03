'use strict';
/* BizManager ERP (online): pop-up calculator, ready-made item list, authorized signature,
   job-card team pickers and notifications. */

/* =====================================================================
   POP-UP CALCULATOR (fills a rate box)
   ===================================================================== */
function calcEval(src) {                       // + - * / and brackets, no eval()
  const t = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  if (!t) return NaN;
  let i = 0;
  const num = () => { const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?|^\d+\.?/.exec(t.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const factor = () => { if (t[i] === '-') { i++; return -factor(); } if (t[i] === '+') { i++; return factor(); } if (t[i] === '(') { i++; const v = expr(); if (t[i] !== ')') throw 0; i++; return v; } return num(); };
  const term = () => { let v = factor(); while (t[i] === '*' || t[i] === '/') { const op = t[i++], r = factor(); v = op === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (t[i] === '+' || t[i] === '-') { const op = t[i++], r = term(); v = op === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); return i === t.length && isFinite(v) ? v : NaN; } catch { return NaN; }
}
let CALC = null;
function calcClose() { $('#calcPop')?.remove(); CALC = null; }
ACT.calcOpen = (_, el) => {
  const target = el.closest('.i-ratebox')?.querySelector('input'); if (!target) return;
  calcClose(); CALC = { target };
  const keys = ['C', '(', ')', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const pop = document.createElement('div'); pop.id = 'calcPop';
  pop.innerHTML = `<div class="calc" role="dialog" aria-label="Calculator"><div class="calc-head"><b>Calculator</b><button type="button" class="icon-btn" data-calc="close" aria-label="Close">${ic('x', 18)}</button></div>
    <input id="calcIn" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="e.g. 6*3*45" value="${esc(target.value || '')}">
    <div class="calc-res" id="calcRes"></div>
    <div class="calc-keys">${keys.map(k => `<button type="button" data-calc="${esc(k)}" class="${/[÷×−+=]/.test(k) ? 'op' : ''}${k === 'C' || k === '⌫' ? ' fn' : ''}">${k}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button type="button" class="btn grow" data-calc="close">Cancel</button><button type="button" class="btn btn-primary grow" data-calc="use">Use as rate</button></div></div>`;
  document.body.appendChild(pop); calcShow();
  const inp = $('#calcIn'); inp.focus(); inp.select();
};
function calcShow() {
  const inp = $('#calcIn'), res = $('#calcRes'); if (!inp) return;
  const v = calcEval(inp.value);
  res.textContent = inp.value.trim() === '' ? '' : (isNaN(v) ? '…' : '= ' + nf.format(r3(v)).replace(/\.?0+$/, m => m.includes('.') ? '' : m));
  res.dataset.v = isNaN(v) ? '' : String(v);
}
function calcKey(k) {
  const inp = $('#calcIn'); if (!inp) return;
  if (k === 'close') return calcClose();
  if (k === 'C') inp.value = '';
  else if (k === '⌫') inp.value = inp.value.slice(0, -1);
  else if (k === '=') { const v = calcEval(inp.value); if (!isNaN(v)) inp.value = String(r3(v)); }
  else if (k === 'use') {
    const v = calcEval(inp.value); if (isNaN(v) || v < 0) return toast('Type a valid positive amount first');
    const t = CALC?.target; calcClose(); if (t) { t.value = String(Math.round(v * 10000) / 10000); t.dispatchEvent(new Event('input', { bubbles: true })); t.focus(); } return;
  } else inp.value += k;
  calcShow(); inp.focus();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-calc]'); if (b) { e.preventDefault(); calcKey(b.dataset.calc); } else if (CALC && !e.target.closest('#calcPop') && !e.target.closest('[data-act=calcOpen]')) calcClose(); });
document.addEventListener('input', e => { if (e.target.id === 'calcIn') calcShow(); });
document.addEventListener('keydown', e => {
  if (!CALC || !$('#calcIn')) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); calcClose(); }
  else if (e.key === 'Enter') { e.preventDefault(); const v = calcEval($('#calcIn').value); if (!isNaN(v)) calcKey('use'); }
}, true);

/* =====================================================================
   READY-MADE ITEM LIST (price list for the order / quotation / invoice form)
   ===================================================================== */
const catalog = () => (S.settings.catalog || []).slice().sort((a, b) => a.name.localeCompare(b.name));
function catPicker() {
  const list = catalog();
  if (!list.length) return can('settings', 'w') ? '<small class="muted" style="display:block;margin-bottom:8px">Tip: save your common items in Settings &gt; Item list and pick them here.</small>' : '';
  return `<div class="row" style="margin-bottom:10px"><select id="catPick" data-change="catPick" style="flex:1;min-width:200px"><option value="">+ Add from item list…</option>${list.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.size ? ' · ' + esc(c.size) : ''}${+c.rate ? ' · ' + nf.format(c.rate) : ''}</option>`).join('')}</select></div>`;
}
function addCatalogRow(c) {
  const rows = $$('.item-row'), last = rows[rows.length - 1];
  const blank = last && !$('.i-desc', last).value.trim() && !(+$('.i-qty', last).value) && !(+$('.i-rate', last).value);
  if (!blank) $('#items').insertAdjacentHTML('beforeend', itemRow());
  const r = $$('.item-row').pop();
  $('.i-desc', r).value = c.name; $('.i-size', r).value = c.size || ''; $('.i-rate', r).value = +c.rate || ''; $('.i-qty', r).value = 1;
  recalc(); $('.i-qty', r).focus(); $('.i-qty', r).select();
}
CHG.catPick = el => { const c = catalog().find(x => x.id === el.value); el.value = ''; if (c) addCatalogRow(c); };
/* typing / choosing a saved item name in the description box fills size and rate when they are empty */
document.addEventListener('change', e => {
  const t = e.target; if (!t.classList?.contains('i-desc')) return;
  const c = (S.settings.catalog || []).find(x => x.name.toLowerCase() === t.value.trim().toLowerCase()); if (!c) return;
  const r = t.closest('.item-row'), size = $('.i-size', r), rate = $('.i-rate', r);
  if (!size.value && c.size) size.value = c.size;
  if (!(+rate.value) && +c.rate) rate.value = c.rate;
  recalc();
});
function catalogCard() {
  const list = catalog(), w = can('settings', 'w');
  return `<div class="card" id="catalogCard"><h3>Item list (ready-made items)</h3>
    <p class="muted" style="margin-top:0">Items you sell often. In a new order, quotation or invoice, pick one from <b>+ Add from item list</b> and the size and rate are filled in (you can still change them).</p>
    ${list.length ? `<table class="rtable"><thead><tr><th>Item</th><th>Size</th><th class="r">Rate</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td data-label="Item"><b>${esc(c.name)}</b></td><td data-label="Size">${esc(c.size || '—')}</td><td class="r" data-label="Rate">${nf.format(+c.rate || 0)}</td><td class="noL r">${w ? `<button class="btn btn-sm" data-act="catForm" data-id="${esc(c.id)}">Edit</button> <button class="btn btn-sm btn-danger" data-act="delCat" data-id="${esc(c.id)}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No items yet.</p>'}
    ${w ? `<div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" data-act="catForm">${ic('plus', 14)} Add item</button></div>` : ''}</div>`;
}
ACT.catForm = ({ id } = {}) => {
  const c = (S.settings.catalog || []).find(x => x.id === id) || {};
  openModal(id ? 'Edit item' : 'New item', `<div class="stack">${field('Item name *', `<input id="ct-name" value="${esc(c.name)}" placeholder="e.g. Flex banner">`)}${field('Size', `<input id="ct-size" value="${esc(c.size)}" placeholder="e.g. 6 x 3 ft">`)}${field(`Rate (${esc(S.settings.currency)})`, `<span class="i-ratebox"><input id="ct-rate" class="i-rate" type="number" min="0" step="any" inputmode="decimal" value="${+c.rate || ''}"><button type="button" class="icon-btn calc-btn" data-act="calcOpen" title="Calculator" aria-label="Open calculator">${ic('calc', 18)}</button></span>`)}</div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveCat" data-id="${esc(id || '')}">Save</button>`, 'sm');
};
ACT.saveCat = async ({ id }) => {
  const name = $('#ct-name').value.trim().replace(/\s+/g, ' '); if (!name) return toast('Type the item name');
  const list = (S.settings.catalog || []).slice();
  if (list.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase() && (x.size || '') === $('#ct-size').value.trim())) return toast('That item (with that size) is already in the list');
  const rec = { id: id || uid(), name, size: $('#ct-size').value.trim(), rate: +$('#ct-rate').value || 0 };
  const k = list.findIndex(x => x.id === id); if (k >= 0) list[k] = rec; else list.push(rec);
  S.settings.catalog = list; await saveSettings(); closeModal(); refresh(); toast('Item saved');
};
ACT.delCat = async ({ id }) => {
  if (!confirm('Remove this item from the list?')) return;
  S.settings.catalog = (S.settings.catalog || []).filter(x => x.id !== id); await saveSettings(); refresh(); toast('Item removed');
};

/* =====================================================================
   AUTHORIZED SIGNATURE (printed on quotations, invoices, job cards, payslips...)
   ===================================================================== */
function signatureCard() {
  const s = S.settings, w = can('settings', 'w');
  return `<div class="card" id="signatureCard"><h3>Authorized signature</h3>
    <p class="muted" style="margin-top:0">Upload an image of the authorized signature. It is printed above the “Authorized signature” line on quotations, orders, invoices, job cards and payslips. A PNG with a transparent or white background works best.</p>
    <div class="row">${s.signature ? `<img class="sig-prev" src="${esc(s.signature)}" alt="Signature">` : '<span class="muted">No signature uploaded.</span>'}</div>
    ${w ? `<div class="row" style="margin-top:10px"><button class="btn btn-sm" data-act="pickSig">${ic('upload', 14)} ${s.signature ? 'Replace signature' : 'Upload signature'}</button>${s.signature ? '<button class="btn btn-sm btn-danger" data-act="rmSig">Remove</button>' : ''}<input type="file" id="sigFile" accept="image/*" hidden data-change="sigFile"></div>` : ''}</div>`;
}
ACT.pickSig = () => $('#sigFile').click();
ACT.rmSig = async () => { S.settings.signature = ''; await saveSettings(); refresh(); toast('Signature removed'); };
CHG.sigFile = async el => {
  const f = el.files[0]; el.value = ''; if (!f) return;
  const url = await new Promise((res, rej) => {
    const u = URL.createObjectURL(f), img = new Image();
    img.onload = () => { const sc = Math.min(1, 480 / Math.max(img.width || 1, 1), 200 / Math.max(img.height || 1, 1)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/png')); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that image')); }; img.src = u;
  });
  S.settings.signature = url; await saveSettings(); refresh(); toast('Signature saved');
};
function withSignature(html) {
  const sig = S.settings?.signature; if (!sig) return html;
  return html.replace(/<span>(Authorized signature|Approved by)<\/span>/g, (_, t) => `<span style="position:relative"><img class="pd-sigimg" src="${esc(sig)}" alt="">${t}</span>`);
}

/* =====================================================================
   JOB-CARD TEAM PICKERS (pick people from the staff list, no typing)
   ===================================================================== */
function teamOpts(kinds, name, id) {
  const act = S.employees.filter(e => e.active !== false || e.id === id);
  const sug = act.filter(e => kinds.includes(e.kind)), oth = act.filter(e => !kinds.includes(e.kind));
  const o = e => `<option value="${esc(e.id)}"${e.id === id ? ' selected' : ''}>${esc(e.name)}${e.position ? ' · ' + esc(e.position) : ''}${e.active === false ? ' (inactive)' : ''}</option>`;
  const legacy = name && !act.some(e => e.id === id) ? `<option value="__old" selected>${esc(name)} (not in staff list)</option>` : '';
  return `<option value=""${!name && !id ? ' selected' : ''}>— not assigned —</option>${legacy}${sug.length ? `<optgroup label="${esc(kinds[0])}">${sug.map(o).join('')}</optgroup>` : ''}${oth.length ? `<optgroup label="Other staff">${oth.map(o).join('')}</optgroup>` : ''}`;
}
function teamRead(old) {
  const one = (k, nameKey, idKey) => {
    const v = $('#j-' + k).value;
    if (v === '__old') return { [nameKey]: old?.[nameKey] || '', [idKey]: '' };
    const e = S.employees.find(x => x.id === v); return { [nameKey]: e ? e.name : '', [idKey]: e ? e.id : '' };
  };
  return { ...one('designer', 'designer', 'designerId'), ...one('operator', 'operator', 'operatorId'), ...one('finisher', 'finisher', 'finisherId'), ...one('qc', 'qc', 'qcId') };
}

/* =====================================================================
   NOTIFICATIONS (in the app: bell with a count, plus a pop-up on devices that allow it)
   ===================================================================== */
const NOTIF = { list: [], unread: 0, ready: false, seen: new Set(), first: true };
const TEAM_ROLES = [['designer', 'designerId', 'Designer'], ['operator', 'operatorId', 'Machine operator'], ['finisher', 'finisherId', 'Finishing operator'], ['qc', 'qcId', 'Quality check']];
const userOfEmp = id => S.employees.find(e => e.id === id)?.userId || '';
async function sendNotif(userIds, title, body) {
  const ids = [...new Set(userIds.filter(Boolean))]; if (!ids.length) return;
  try { await Cloud.rpc('notify_users', { p_users: ids, p_title: title, p_body: body, p_link: '#/production' }); } catch (e) { console.warn('notify failed', e); }
}
async function sendNotifRole(role, title, body, link = '#/production') {
  try { await Cloud.rpc('notify_role', { p_role: role, p_title: title, p_body: body, p_link: link }); } catch (e) { console.warn('notify failed', e); }
}
const jobLine = j => { const o = S.orders.find(x => x.id === j.orderId); return `${j.title}${cust(o?.customerId)?.name ? ' (' + cust(o.customerId).name + ')' : ''}${j.dueDate ? ' · due ' + fmtDate(j.dueDate) : ''}`; };
/* which team member is responsible for a production step (by the step's name) */
function stageRole(name) {
  const n = String(name || '').toLowerCase();
  if (/design|artwork|graphic/.test(n)) return 'designer';
  if (/quality|qc|inspect|check/.test(n)) return 'qc';
  if (/finish|bind|cut|lamin|fold|pack|trim|emboss|stitch/.test(n)) return 'finisher';
  if (/print|press|plate|pre-?press|machine/.test(n)) return 'operator';
  return '';
}
async function notifyJobSaved(j, old) {
  try {
    const users = new Map();     // userId -> role names
    for (const [k, idk, label] of TEAM_ROLES) {
      if (j[idk] && (!old || old[idk] !== j[idk])) { const u = userOfEmp(j[idk]); if (u) users.set(u, [...(users.get(u) || []), label]); }
    }
    for (const [u, roles] of users) await sendNotif([u], `${old ? 'Job assigned to you' : 'New job for you'}: ${j.no}`, `${roles.join(' / ')} - ${jobLine(j)}`);
    if (!old && !j.designerId) await sendNotifRole('designer', `New job card ${j.no}`, `${jobLine(j)} is waiting in the Design step.`);
    if (old && old.stage !== j.stage) await notifyStageMove(j, users);
  } catch (e) { console.warn(e); }
}
async function notifyStageMove(j, already) {
  try {
    const role = stageRole(STAGES[j.stage]); if (!role) return;
    const t = TEAM_ROLES.find(x => x[0] === role), uid_ = j[t[1]] ? userOfEmp(j[t[1]]) : '';
    if (uid_ && !(already && already.has(uid_))) await sendNotif([uid_], `${j.no} is now in ${STAGES[j.stage]}`, `Your turn (${t[2]}): ${jobLine(j)}`);
    else if (!uid_ && role === 'designer') await sendNotifRole('designer', `${j.no} is now in ${STAGES[j.stage]}`, jobLine(j));
  } catch (e) { console.warn(e); }
}
async function notifyRevision(a, note) {
  try {
    const js = S.jobs.filter(j => j.orderId === a.orderId && j.designerId), ids = js.map(j => userOfEmp(j.designerId)).filter(Boolean);
    const title = `Client revision requested: ${a.no}`, body = `${a.title}${js[0] ? ' (' + js[0].no + ')' : ''} - ${note}`;
    if (ids.length) await Cloud.rpc('notify_users', { p_users: [...new Set(ids)], p_title: title, p_body: body, p_link: '#/artwork' });
    else await sendNotifRole('designer', title, body, '#/artwork');
  } catch (e) { console.warn(e); }
}

/* ---- the bell ---- */
function renderBell() {
  const b = $('#bellBtn'); if (!b) return;
  b.hidden = !NOTIF.ready;
  b.innerHTML = `${ic('bell')}${NOTIF.unread ? `<span class="bell-n">${NOTIF.unread > 99 ? '99+' : NOTIF.unread}</span>` : ''}`;
  b.setAttribute('aria-label', NOTIF.unread ? `${NOTIF.unread} unread notifications` : 'Notifications');
}
async function loadNotifs(announce) {
  try {
    const rows = await Cloud.rest('/notifications?select=*&order=created_at.desc&limit=60');
    NOTIF.ready = true; NOTIF.list = rows || []; NOTIF.unread = NOTIF.list.filter(n => !n.read_at).length;
    const fresh = NOTIF.list.filter(n => !n.read_at && !NOTIF.seen.has(n.id));
    NOTIF.list.forEach(n => NOTIF.seen.add(n.id));
    if (announce && !NOTIF.first) fresh.slice(0, 3).forEach(n => { toast('🔔 ' + n.title); try { if ('Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.body, tag: n.id }); } catch { /* not allowed */ } });
    NOTIF.first = false;
    renderBell(); if (typeof updateChrome === 'function') updateChrome();
    if ($('#notifList')) $('#notifList').innerHTML = notifListHtml();
  } catch (e) { NOTIF.ready = false; renderBell(); }       // notifications not installed yet: the bell stays hidden
}
const ago = s => { const m = Math.round((Date.now() - new Date(s)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : fmtDate(s); };
function notifListHtml() {
  if (!NOTIF.list.length) return empty('No notifications', 'New jobs, assignments and client revision requests will show up here.');
  return NOTIF.list.map(n => `<div class="notif${n.read_at ? '' : ' unread'}" data-act="notifOpen" data-id="${esc(n.id)}" data-link="${esc(n.link || '')}" role="button" tabindex="0"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${esc(n.by_name ? n.by_name + ' · ' : '')}${ago(n.created_at)}</small></div>`).join('');
}
ACT.openBell = () => {
  const can_ = 'Notification' in window && Notification.permission === 'default';
  openModal('Notifications', `${can_ ? '<div class="alert info" style="margin-bottom:10px"><span>Get a pop-up on this device when something new arrives (works while the app is open in a tab).</span><button class="btn btn-sm" data-act="notifAllow">Turn on</button></div>' : ''}<div id="notifList">${notifListHtml()}</div>`,
    `<button class="btn" data-act="notifClear">Clear all</button><button class="btn btn-primary" data-act="notifReadAll">Mark all read</button>`, 'sm');
};
ACT.notifAllow = async () => { try { await Notification.requestPermission(); } catch { /* ignore */ } closeModal(); ACT.openBell(); };
ACT.notifOpen = async ({ id, link }) => {
  const n = NOTIF.list.find(x => x.id === id);
  if (n && !n.read_at) { try { await Cloud.send(`/rest/v1/notifications?id=eq.${encodeURIComponent(id)}`, 'PATCH', { read_at: new Date().toISOString() }, { Prefer: 'return=minimal' }); } catch (e) { console.warn(e); } }
  closeModal(); await loadNotifs(false);
  if (link && link.startsWith('#/')) { if (location.hash === link) route(); else location.hash = link; }
};
ACT.notifReadAll = async () => {
  try { await Cloud.send(`/rest/v1/notifications?user_id=eq.${Cloud.user().id}&read_at=is.null`, 'PATCH', { read_at: new Date().toISOString() }, { Prefer: 'return=minimal' }); } catch (e) { return showErr(e); }
  await loadNotifs(false);
};
ACT.notifClear = async () => {
  if (!NOTIF.list.length) return;
  try { await Cloud.http(`/rest/v1/notifications?user_id=eq.${Cloud.user().id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) { return showErr(e); }
  await loadNotifs(false);
};
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('notif')) { e.preventDefault(); e.target.click(); } });
