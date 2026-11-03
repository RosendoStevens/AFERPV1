'use strict';
/* PrintPress ERP (online): Suppliers, Staff list, Attendance, Payroll, and their report sections. */

/* =====================================================================
   SUPPLIERS (stand-alone: they are not tied to job cards)
   ===================================================================== */
const supOf = id => S.suppliers.find(x => x.id === id);
const supSpend = sp => r2(S.expenses.filter(e => e.supplierId === sp.id || (!e.supplierId && e.vendor && e.vendor.trim().toLowerCase() === sp.name.trim().toLowerCase())).reduce((a, e) => a + e.amount, 0));
LIST.suppliers = () => {
  const q = (UI.q || '').toLowerCase();
  let rows = [...S.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  if (q) rows = rows.filter(x => [x.name, x.contact, x.phone, x.email, x.notes].join(' ').toLowerCase().includes(q));
  if (!rows.length) return empty('No suppliers', 'Keep your paper, ink and plate suppliers here.', can('suppliers', 'w') ? `<button class="btn btn-primary" data-act="supForm">${ic('plus', 16)} Add supplier</button>` : '');
  return `<table class="rtable"><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th class="r">Items</th><th class="r">Purchases</th></tr></thead><tbody>${rows.map(x => `<tr data-act="supView" data-id="${x.id}"><td data-label="Supplier"><b>${esc(x.name)}</b><small>${esc(x.address || '')}</small></td><td data-label="Contact">${esc(x.contact || '—')}</td><td data-label="Phone">${esc(x.phone || '—')}</td><td class="r" data-label="Items">${S.inventory.filter(i => i.supplierId === x.id).length}</td><td class="r" data-label="Purchases">${money(supSpend(x))}</td></tr>`).join('')}</tbody></table>`;
};
VIEWS.suppliers = () => `<div class="page-head"><h2>Suppliers</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="suppliers">${ic('download', 16)} CSV</button><button class="btn btn-primary" data-act="supForm">${ic('plus', 16)} Add supplier</button></div></div>
  <div class="toolbar"><input type="search" placeholder="Search suppliers…" data-ui="q" value="${esc(UI.q)}"></div>
  <div class="card" id="list">${LIST.suppliers()}</div>`;
ACT.supView = ({ id }) => {
  const x = supOf(id); if (!x) return;
  const items = S.inventory.filter(i => i.supplierId === id);
  const buys = S.expenses.filter(e => e.supplierId === id || (!e.supplierId && e.vendor && e.vendor.trim().toLowerCase() === x.name.trim().toLowerCase())).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  openModal(x.name, `<dl class="kv"><dt>Contact</dt><dd>${esc(x.contact || '—')}</dd><dt>Phone</dt><dd>${esc(x.phone || '—')}</dd><dt>Email</dt><dd>${esc(x.email || '—')}</dd><dt>Address</dt><dd>${esc(x.address || '—')}</dd>${x.notes ? `<dt>Notes</dt><dd>${esc(x.notes)}</dd>` : ''}</dl>
    <h4 class="sec-h">Items supplied</h4>${items.length ? items.map(i => `<div class="row" style="justify-content:space-between;padding:3px 0"><span>${esc(i.name)}</span><span><b>${nq.format(i.stock)}</b> ${esc(i.unit || '')}</span></div>`).join('') : '<p class="muted" style="margin:0">No stock items linked yet. Choose this supplier when you add or edit an item in Inventory.</p>'}
    <h4 class="sec-h">Purchases <small>(${money(supSpend(x))})</small></h4>${buys.length ? `<table class="rtable"><tbody>${buys.slice(0, 25).map(e => `<tr><td data-label="Date">${fmtDate(e.date)}</td><td data-label="Details">${esc(e.description || e.category)}</td><td class="r" data-label="Amount">${money(e.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="margin:0">No purchases recorded. Use “Stock in” with “Record as expense”, or add an expense with this supplier as the vendor.</p>'}`,
    `${can('suppliers', 'd') ? `<button class="btn btn-danger grow" data-act="delSup" data-id="${id}">Delete</button>` : ''}<button class="btn" data-act="supForm" data-id="${id}">Edit</button>`);
};
ACT.supForm = ({ id } = {}) => {
  const x = supOf(id) || {};
  openModal(id ? 'Edit supplier' : 'New supplier', `<div class="grid2">${field('Supplier name *', `<input id="sp-name" value="${esc(x.name)}">`)}${field('Contact person', `<input id="sp-contact" value="${esc(x.contact)}">`)}${field('Phone', `<input id="sp-phone" type="tel" value="${esc(x.phone)}">`)}${field('Email', `<input id="sp-email" type="email" value="${esc(x.email)}">`)}</div><div class="stack" style="margin-top:12px">${field('Address', `<input id="sp-addr" value="${esc(x.address)}">`)}${field('Notes (what they supply, payment terms…)', `<textarea id="sp-notes">${esc(x.notes)}</textarea>`)}</div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveSup" data-id="${id || ''}">Save</button>`);
};
ACT.saveSup = async ({ id }) => {
  const name = $('#sp-name').value.trim(); if (!name) return toast('Supplier name is required');
  if (S.suppliers.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return toast('A supplier with that name already exists');
  const old = supOf(id) || {};
  const x = { ...old, id: old.id || uid(), name, contact: $('#sp-contact').value.trim(), phone: $('#sp-phone').value.trim(), email: $('#sp-email').value.trim(), address: $('#sp-addr').value.trim(), notes: $('#sp-notes').value.trim(), createdAt: old.createdAt || Date.now() };
  await DB.put('suppliers', x); closeModal(); await reload(); toast('Supplier saved');
};
ACT.delSup = async ({ id }) => {
  if (!confirm('Delete this supplier? Stock items and past expenses keep the name but lose the link.')) return;
  await DB.del('suppliers', id); closeModal(); await reload(); toast('Deleted');
};

/* =====================================================================
   ATTENDANCE & PAYROLL: shared helpers
   ===================================================================== */
const EMP_KINDS = ['Designer', 'Machine operator', 'Finishing', 'Quality check', 'Sales / Office', 'Management', 'Other'];
const ATT_STATUS = [['present', 'Present'], ['absent', 'Absent'], ['paid_leave', 'Paid leave'], ['unpaid_leave', 'Unpaid leave'], ['holiday', 'Public holiday']];
const attName = k => (ATT_STATUS.find(x => x[0] === k) || [0, k])[1];
const empOf = id => S.employees.find(e => e.id === id);
const rateOf = id => S.pay_rates.find(r => r.id === id) || {};
const monthNow = () => today().slice(0, 7);
const monthLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const daysIn = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const stdOf = rate => +rate.stdHours || +S.settings.stdHours || 8;
function workedHours(r) {
  if (!r || r.status !== 'present') return 0;
  const a = toMin(r.in), b = toMin(r.out); if (a == null || b == null) return 0;
  let m = b - a; if (m <= 0) m += 1440;                      // shift past midnight
  return Math.max(0, r2((m - (+r.breakMin || 0)) / 60));
}
const incomplete = r => r && r.status === 'present' && (toMin(r.in) == null || toMin(r.out) == null);
function dayCalc(r, rate) {
  const std = stdOf(rate);
  if (r.status === 'present') { const h = workedHours(r); return { reg: Math.min(h, std), ot: Math.max(0, r2(h - std)) }; }
  if (r.status === 'paid_leave' || r.status === 'holiday') return { reg: std, ot: 0 };
  return { reg: 0, ot: 0 };
}
function monthSummary(empId, month) {
  const rate = rateOf(empId), st = { present: 0, absent: 0, paid_leave: 0, unpaid_leave: 0, holiday: 0, reg: 0, ot: 0, incomplete: 0 };
  S.attendance.forEach(r => {
    if (r.employeeId !== empId || !(r.date || '').startsWith(month)) return;
    st[r.status] = (st[r.status] || 0) + 1;
    const d = dayCalc(r, rate); st.reg = r2(st.reg + d.reg); st.ot = r2(st.ot + d.ot);
    if (incomplete(r)) st.incomplete++;
  });
  return st;
}
const csvTable = (name, head, rows) => download(name, csv([head, ...rows]), 'text/csv;charset=utf-8');

/* pay calculation: hours x rate, overtime, allowances, bonus, then EPF / advance / other deductions */
function payCalc(emp, month, inp = {}) {
  const rate = rateOf(emp.id), st = monthSummary(emp.id, month), set = S.settings;
  const hr = +rate.hourRate || 0, otr = +rate.otRate || r2(hr * (+set.otMultiplier || 1));
  const otAdj = +inp.otAdj || 0, otHours = r2(st.ot + otAdj);
  const regPay = r2(st.reg * hr), otPay = r2(otHours * otr);
  const allow = r2((inp.allowances || []).reduce((a, x) => a + (+x.amount || 0), 0)), bonus = r2(inp.bonus);
  const gross = r2(regPay + otPay + allow + bonus);
  const base = set.epfBase === 'gross' ? gross : regPay, member = !!rate.epf;
  const epfEmp = member ? r2(base * (+set.epfEmp || 0) / 100) : 0, epfEr = member ? r2(base * (+set.epfEr || 0) / 100) : 0, etfEr = member ? r2(base * (+set.etfEr || 0) / 100) : 0;
  const advance = r2(inp.advance), other = r2((inp.other || []).reduce((a, x) => a + (+x.amount || 0), 0));
  const ded = r2(epfEmp + advance + other);
  return { hr, otr, regHours: st.reg, otAuto: st.ot, otAdj, otHours, regPay, otPay, allow, bonus, gross, epfBase: base, member, epfEmp, epfEr, etfEr, advance, other, ded, net: r2(gross - ded), days: st };
}
const payId = (empId, month) => `${empId}_${month}`;
const payRec = (empId, month) => S.payroll.find(p => p.id === payId(empId, month));
const defaultInputs = emp => { const rate = rateOf(emp.id); return { otAdj: 0, allowances: +rate.allowance > 0 ? [{ label: 'Allowance', amount: +rate.allowance }] : [], bonus: 0, advance: 0, other: [], notes: '' }; };
const payShown = (emp, month) => { const rec = payRec(emp.id, month); return rec && rec.status === 'Paid' ? rec.calc : payCalc(emp, month, rec ? rec.inputs : defaultInputs(emp)); };

/* =====================================================================
   ATTENDANCE
   ===================================================================== */
const attTab = () => ['daily', 'month', 'staff', 'import'].includes(UI.tab) ? UI.tab : 'daily';
const activeStaff = () => S.employees.filter(e => e.active !== false).sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name));
const attOf = (empId, date) => S.attendance.find(r => r.id === `${empId}_${date}`);

async function saveAtt(empId, date, patch) {
  const id = `${empId}_${date}`, old = attOf(empId, date);
  const rec = { ...(old || { id, employeeId: empId, date, status: 'present', in: '', out: '', breakMin: 0, source: 'manual', note: '' }), ...patch, updatedAt: Date.now() };
  if (!old && !patch.status) rec.status = 'present';
  await DB.put('attendance', rec);
  const k = S.attendance.findIndex(r => r.id === id); if (k >= 0) S.attendance[k] = rec; else S.attendance.push(rec);
  return rec;
}
const timeIn = (rec, f, empId, date, dis) => `<input type="time" value="${esc(rec?.[f] || '')}" data-change="attField" data-emp="${empId}" data-date="${date}" data-f="${f}"${dis}>`;
function attRow(e, date, label) {
  const r = attOf(e.id, date), dis = can('attendance', 'w') ? '' : ' disabled', h = workedHours(r), d = r ? dayCalc(r, rateOf(e.id)) : { ot: 0 };
  const isToday = date === today(), st = r?.status || '';
  return `<tr data-row="${e.id}_${date}"><td data-label="${esc(label ? 'Day' : 'Staff')}">${label ? `<b>${esc(label)}</b>` : `<b>${esc(e.name)}</b><small>${esc([e.empNo, e.kind].filter(Boolean).join(' · '))}</small>`}</td>
    <td data-label="Status"><select data-change="attField" data-emp="${e.id}" data-date="${date}" data-f="status"${dis}><option value="">— not marked —</option>${opts(ATT_STATUS, st)}</select></td>
    <td data-label="In">${timeIn(r, 'in', e.id, date, dis)}${isToday && can('attendance', 'w') ? `<button class="btn btn-sm" data-act="attNow" data-emp="${e.id}" data-date="${date}" data-f="in">Now</button>` : ''}</td>
    <td data-label="Out">${timeIn(r, 'out', e.id, date, dis)}${isToday && can('attendance', 'w') ? `<button class="btn btn-sm" data-act="attNow" data-emp="${e.id}" data-date="${date}" data-f="out">Now</button>` : ''}</td>
    <td data-label="Break (min)"><input type="number" min="0" step="5" inputmode="numeric" style="width:76px" value="${r ? (+r.breakMin || 0) : ''}" data-change="attField" data-emp="${e.id}" data-date="${date}" data-f="breakMin"${dis}></td>
    <td class="r" data-label="Hours"><b>${r && r.status === 'present' ? (incomplete(r) ? '<span class="badge b-overdue">Incomplete</span>' : nq.format(h)) : '—'}</b>${d.ot > 0 ? `<small>OT ${nq.format(d.ot)}</small>` : ''}${r?.source && r.source !== 'manual' ? `<small>${esc(r.source)}</small>` : ''}</td></tr>`;
}
LIST.attendance = () => {
  const tab = attTab();
  if (tab === 'daily') {
    UI.date = UI.date || today();
    const staff = activeStaff();
    if (!staff.length) return empty('No staff yet', 'Add your staff in the Staff tab first.');
    const present = staff.filter(e => attOf(e.id, UI.date)?.status === 'present').length;
    return `<p class="muted" style="margin:0 0 10px"><b>${present}</b> of ${staff.length} present on ${fmtDate(UI.date)}</p><table class="rtable att"><thead><tr><th>Staff</th><th>Status</th><th>In</th><th>Out</th><th>Break</th><th class="r">Hours</th></tr></thead><tbody>${staff.map(e => attRow(e, UI.date)).join('')}</tbody></table>`;
  }
  if (tab === 'month') {
    UI.month = UI.month || monthNow();
    const staff = activeStaff();
    if (!staff.length) return empty('No staff yet');
    const tot = { reg: 0, ot: 0 };
    const rows = staff.map(e => { const s = monthSummary(e.id, UI.month); tot.reg += s.reg; tot.ot += s.ot; return `<tr data-act="attEmp" data-id="${e.id}"><td data-label="Staff"><b>${esc(e.name)}</b><small>${esc(e.empNo || '')}</small></td><td class="r" data-label="Present">${s.present}</td><td class="r" data-label="Absent">${s.absent}</td><td class="r" data-label="Leave">${s.paid_leave + s.unpaid_leave}</td><td class="r" data-label="Holidays">${s.holiday}</td><td class="r" data-label="Regular hrs">${nq.format(s.reg)}</td><td class="r" data-label="OT hrs">${nq.format(s.ot)}</td><td data-label="Check">${s.incomplete ? `<span class="badge b-overdue">${s.incomplete} incomplete</span>` : '<span class="badge b-ok">OK</span>'}</td></tr>`; }).join('');
    return `<table class="rtable"><thead><tr><th>Staff</th><th class="r">Present</th><th class="r">Absent</th><th class="r">Leave</th><th class="r">Holidays</th><th class="r">Regular hrs</th><th class="r">OT hrs</th><th></th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td><b>Total</b></td><td></td><td></td><td></td><td></td><td class="r"><b>${nq.format(r2(tot.reg))}</b></td><td class="r"><b>${nq.format(r2(tot.ot))}</b></td><td></td></tr></tfoot></table><small class="muted">Tap a person to see and correct every day of the month.</small>`;
  }
  if (tab === 'staff') {
    const rows = [...S.employees].sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name));
    if (!rows.length) return empty('No staff yet', 'Add each person who works in the shop. You need them here before you can record attendance or pay.', can('employees', 'w') ? `<button class="btn btn-primary" data-act="empForm">${ic('plus', 16)} Add staff</button>` : '');
    const showRate = can('pay_rates', 'r');
    return `<table class="rtable"><thead><tr><th>No.</th><th>Name</th><th>Role</th><th>Phone</th>${showRate ? '<th class="r">Rate / hour</th>' : ''}<th>Status</th></tr></thead><tbody>${rows.map(e => `<tr data-act="empForm" data-id="${e.id}"><td data-label="No.">${esc(e.empNo || '—')}</td><td data-label="Name"><b>${esc(e.name)}</b><small>${esc(e.position || '')}</small></td><td data-label="Role">${esc(e.kind || '—')}</td><td data-label="Phone">${esc(e.phone || '—')}</td>${showRate ? `<td class="r" data-label="Rate / hour">${rateOf(e.id).hourRate ? money(rateOf(e.id).hourRate) : '—'}</td>` : ''}<td data-label="Status">${e.active === false ? badge('Off') : badge('Active')}</td></tr>`).join('')}</tbody></table>`;
  }
  return importPanel();
};
VIEWS.attendance = () => {
  const tab = attTab(), w = can('attendance', 'w');
  const tabs = [['daily', 'Daily'], ['month', 'Monthly'], ['staff', 'Staff'], ['import', 'Biometric import']].filter(([k]) => k !== 'import' || w);
  let bar = '';
  if (tab === 'daily') { UI.date = UI.date || today(); bar = `<div class="toolbar"><button class="btn" data-act="attDay" data-n="-1" aria-label="Previous day">◀</button><input type="date" data-ui="date" value="${esc(UI.date)}" style="width:auto"><button class="btn" data-act="attDay" data-n="1" aria-label="Next day">▶</button><button class="btn" data-act="attDay" data-n="0">Today</button>${w ? `<button class="btn btn-primary" data-act="attMarkAll">Mark all present</button>` : ''}</div>`; }
  if (tab === 'month') { UI.month = UI.month || monthNow(); bar = `<div class="toolbar"><input type="month" data-ui="month" value="${esc(UI.month)}" style="width:auto"><button class="btn" data-act="exportCsv" data-kind="attendance">${ic('download', 16)} CSV</button></div>`; }
  return `<div class="page-head"><h2>Attendance</h2><div class="actions">${tab === 'staff' && can('employees', 'w') ? `<button class="btn btn-primary" data-act="empForm">${ic('plus', 16)} Add staff</button>` : ''}</div></div>
  <div class="tabs">${tabs.map(([k, l]) => `<button class="tab${tab === k ? ' on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>${bar}
  <div class="card" id="list">${LIST.attendance()}</div>`;
};
ACT.attDay = ({ n }) => { UI.date = +n === 0 ? today() : addDays(UI.date || today(), +n); refresh(); };
CHG.attField = async el => {
  const { emp, date, f } = el.dataset; if (!can('attendance', 'w')) return;
  const old = attOf(emp, date);
  if (f === 'status' && el.value === '') { if (old) { await DB.del('attendance', old.id); S.attendance = S.attendance.filter(r => r.id !== old.id); } return refreshList(); }
  const patch = f === 'breakMin' ? { breakMin: Math.max(0, +el.value || 0) } : { [f]: el.value };
  if ((f === 'in' || f === 'out') && el.value && (!old || old.status !== 'present')) patch.status = 'present';
  if (f === 'status' && el.value === 'present' && !old?.breakMin && S.settings.shiftBreak) { /* break stays empty until a time is entered */ }
  await saveAtt(emp, date, patch); refreshList();
};
ACT.attNow = async ({ emp, date, f }) => { await saveAtt(emp, date, { [f]: hhmm(new Date()), status: 'present' }); refreshList(); };
ACT.attMarkAll = async () => {
  const date = UI.date || today(), staff = activeStaff().filter(e => !attOf(e.id, date));
  if (!staff.length) return toast('Everyone is already marked');
  if (!confirm(`Mark ${staff.length} unmarked staff present, ${S.settings.shiftStart} to ${S.settings.shiftEnd}?`)) return;
  for (const e of staff) await saveAtt(e.id, date, { status: 'present', in: S.settings.shiftStart, out: S.settings.shiftEnd, breakMin: +S.settings.shiftBreak || 0 });
  refreshList(); toast('Marked present');
};
ACT.attEmp = ({ id }) => {
  const e = empOf(id), m = UI.month || monthNow(); if (!e) return;
  const days = []; for (let d = 1; d <= daysIn(m); d++) days.push(`${m}-${String(d).padStart(2, '0')}`);
  openModal(`${e.name} - ${monthLabel(m)}`, `<table class="rtable att"><thead><tr><th>Day</th><th>Status</th><th>In</th><th>Out</th><th>Break</th><th class="r">Hours</th></tr></thead><tbody>${days.map(d => attRow(e, d, new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' }))).join('')}</tbody></table>`, '<button class="btn" data-close>Done</button>', 'lg');
};
/* when a day row inside the month dialog changes, refresh the numbers behind it */
const _attField = CHG.attField;
CHG.attField = async el => { await _attField(el); const r = el.closest('tr'); if (r && el.closest('.modal')) { const e = empOf(el.dataset.emp), date = el.dataset.date, lbl = $('b', r.firstElementChild)?.textContent; if (e) { const tmp = document.createElement('tbody'); tmp.innerHTML = attRow(e, date, lbl); r.replaceWith(tmp.firstElementChild); applyPerms($('#modal-root')); } } };

/* ---- staff list ---- */
/* app logins that a staff record can be linked to (so the person receives notifications) */
let LOGINS = null;
async function fillLogins(current) {
  const sel = $('#em-user'); if (!sel) return;
  try {
    if (!LOGINS) LOGINS = await Cloud.rpc('login_users');
    sel.innerHTML = `<option value="">— none —</option>` + LOGINS.map(u => `<option value="${esc(u.id)}"${u.id === current ? ' selected' : ''}>${esc(u.name || u.email)} (${esc(roleName(u.role))})</option>`).join('');
  } catch (err) { LOGINS = null; /* keep the current link as it is */ }
}
ACT.empForm = ({ id } = {}) => {
  const e = empOf(id) || {}, rate = rateOf(id), canRate = can('pay_rates', 'r'), canRateW = can('pay_rates', 'w');
  const nextNo = String(Math.max(0, ...S.employees.map(x => parseInt(x.empNo, 10) || 0)) + 1).padStart(3, '0');
  const dis = canRateW ? '' : ' disabled';
  openModal(id ? 'Edit staff member' : 'New staff member', `<div class="grid2">
    ${field('Name *', `<input id="em-name" value="${esc(e.name)}">`)}${field('Staff no.', `<input id="em-no" value="${esc(e.empNo || (id ? '' : nextNo))}">`)}
    ${field('Job title', `<input id="em-pos" value="${esc(e.position)}" placeholder="e.g. Offset machine operator">`)}${field('Role group', `<select id="em-kind">${opts(EMP_KINDS, e.kind || 'Other')}</select>`)}
    ${field('Phone', `<input id="em-phone" type="tel" value="${esc(e.phone)}">`)}${field('Joined', `<input id="em-join" type="date" value="${esc(e.joined)}">`)}
    ${field('Biometric ID', `<input id="em-bio" value="${esc(e.biometricId)}" placeholder="same as staff no. if blank">`)}${field('App login (gets notifications)', `<select id="em-user"><option value="">— none —</option>${e.userId ? `<option value="${esc(e.userId)}" selected>(linked login)</option>` : ''}</select>`)}${field('Status', `<select id="em-active"><option value="1"${e.active === false ? '' : ' selected'}>Active</option><option value="0"${e.active === false ? ' selected' : ''}>Left / inactive</option></select>`)}
  </div>
  ${canRate ? `<h4 class="sec-h">Pay</h4><div class="grid2">
    ${field(`Rate per hour (${esc(S.settings.currency)})`, `<input id="em-rate" type="number" min="0" step="any" inputmode="decimal" value="${+rate.hourRate || ''}"${dis}>`)}${field('Overtime rate per hour (blank = auto)', `<input id="em-ot" type="number" min="0" step="any" inputmode="decimal" value="${+rate.otRate || ''}" placeholder="${nf.format((+rate.hourRate || 0) * (+S.settings.otMultiplier || 1))}"${dis}>`)}
    ${field('Normal hours per day', `<input id="em-std" type="number" min="1" max="24" step="any" value="${+rate.stdHours || ''}" placeholder="${+S.settings.stdHours || 8}"${dis}>`)}${field('Monthly allowance (default)', `<input id="em-allow" type="number" min="0" step="any" inputmode="decimal" value="${+rate.allowance || ''}"${dis}>`)}
    ${field('EPF / ETF member', `<select id="em-epf"${dis}><option value="1"${rate.epf ? ' selected' : ''}>Yes - deduct EPF</option><option value="0"${rate.epf ? '' : ' selected'}>No</option></select>`)}</div>
    <small class="muted">Hours above the normal hours in a day count as overtime. Pay details are visible only to the administrator, manager and sales/accounts.</small>` : ''}`,
    `${id && can('employees', 'd') ? `<button class="btn btn-danger grow" data-act="delEmp" data-id="${id}">Delete</button>` : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-act="saveEmp" data-id="${id || ''}">Save</button>`);
  fillLogins(e.userId);
};
ACT.saveEmp = async ({ id }) => {
  const name = $('#em-name').value.trim(); if (!name) return toast('Enter a name');
  const empNo = $('#em-no').value.trim();
  if (empNo && S.employees.some(x => x.id !== id && String(x.empNo).toLowerCase() === empNo.toLowerCase())) return toast('That staff number is already used');
  const old = empOf(id) || {};
  const e = { ...old, id: old.id || uid(), name, empNo, position: $('#em-pos').value.trim(), kind: $('#em-kind').value, phone: $('#em-phone').value.trim(), joined: $('#em-join').value, biometricId: $('#em-bio').value.trim(), active: $('#em-active').value === '1', userId: $('#em-user') ? $('#em-user').value : (old.userId || ''), createdAt: old.createdAt || Date.now() };
  await DB.put('employees', e);
  if (can('pay_rates', 'w') && $('#em-rate')) {
    const r = { ...rateOf(e.id), id: e.id, hourRate: +$('#em-rate').value || 0, otRate: +$('#em-ot').value || 0, stdHours: +$('#em-std').value || 0, allowance: +$('#em-allow').value || 0, epf: $('#em-epf').value === '1' };
    await DB.put('pay_rates', r);
  }
  closeModal(); await reload(); toast('Staff saved');
};
ACT.delEmp = async ({ id }) => {
  const e = empOf(id); if (!e) return;
  if (!confirm(`Delete ${e.name} and ALL their attendance and payroll records?\n\nIf they have only left the shop, set their status to "Left / inactive" instead.`)) return;
  for (const r of S.attendance.filter(r => r.employeeId === id)) await DB.del('attendance', r.id);
  for (const p of S.payroll.filter(p => p.employeeId === id)) await DB.del('payroll', p.id);
  if (S.pay_rates.some(r => r.id === id)) await DB.del('pay_rates', id);
  await DB.del('employees', id); closeModal(); await reload(); toast('Deleted');
};

/* ---- biometric / CSV import ---- */
let IMPORT = null;
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0], delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x.trim())) rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
function parseStamp(str, fmt) {
  str = String(str || '').trim(); let y, mo, d;
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(str);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(str))) { const a = +m[1], b = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; if (fmt === 'mdy') { mo = a; d = b; } else { d = a; mo = b; } }
  const t = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(str); let time = null;
  if (t) { let h = +t[1]; if (t[3]) { const pm = /p/i.test(t[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } time = `${String(h).padStart(2, '0')}:${t[2]}`; }
  const date = y && mo && d && mo <= 12 && d <= 31 ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  return { date, time };
}
const sameId = (a, b) => { a = String(a || '').trim().toLowerCase(); b = String(b || '').trim().toLowerCase(); return !!a && !!b && (a === b || a.replace(/^0+/, '') === b.replace(/^0+/, '')); };
function buildImport(text, fmt) {
  const rows = parseCsv(text); if (rows.length < 1) throw new Error('The file is empty');
  const head = rows[0].map(x => x.trim().toLowerCase());
  const hasHead = head.some(h => /[a-z]/.test(h) && !/^\d/.test(h));
  const col = re => head.findIndex(h => re.test(h));
  let iId = col(/(^id$|emp|user|staff|badge|card|person|no\.?$|code|number)/), iDT = col(/(date.?time|timestamp|punch|check|log)/), iD = col(/^date/), iT = col(/^time/);
  if (!hasHead) { iId = 0; iDT = rows[0].length === 2 ? 1 : -1; iD = 1; iT = 2; }
  if (iId < 0) iId = 0;
  if (iDT < 0 && iD < 0) { iD = 1; iT = 2; }
  const body = hasHead ? rows.slice(1) : rows, groups = new Map(), unknown = new Set(); let bad = 0, punches = 0;
  for (const r of body) {
    const id = (r[iId] || '').trim(); if (!id) continue;
    let st = iDT >= 0 ? parseStamp(r[iDT], fmt) : (() => { const a = parseStamp(r[iD], fmt), b = parseStamp(r[iT] || '', fmt); return { date: a.date, time: b.time || a.time }; })();
    if (!st.date || !st.time) { bad++; continue; }
    const emp = S.employees.find(e => sameId(e.biometricId, id) || sameId(e.empNo, id));
    if (!emp) { unknown.add(id); continue; }
    const key = `${emp.id}_${st.date}`; if (!groups.has(key)) groups.set(key, { emp, date: st.date, times: [] });
    groups.get(key).times.push(st.time); punches++;
  }
  const days = [...groups.values()].map(g => { g.times.sort(); return { emp: g.emp, date: g.date, in: g.times[0], out: g.times.length > 1 && toMin(g.times[g.times.length - 1]) - toMin(g.times[0]) >= 1 ? g.times[g.times.length - 1] : '', n: g.times.length }; });
  return { days, unknown: [...unknown], bad, punches };
}
function importPanel() {
  const w = can('attendance', 'w');
  if (!w) return empty('Not allowed', 'Only people who can record attendance can import it.');
  const pv = IMPORT;
  return `<p style="margin-top:0">Import the punch log exported from a fingerprint / face / card attendance device (CSV). The earliest punch of the day becomes <b>In</b> and the latest becomes <b>Out</b>. Staff are matched by <b>Biometric ID</b> (or staff no.) set in the Staff tab.</p>
  <div class="grid2">${field('Date format in the file', `<select id="imp-fmt"><option value="dmy">Day / Month / Year (01/11/2026)</option><option value="mdy">Month / Day / Year (11/01/2026)</option></select>`)}${field('Existing records', `<select id="imp-over"><option value="skip">Keep what is already entered</option><option value="over">Overwrite with the device times</option></select>`)}</div>
  <div class="row" style="margin-top:12px"><button class="btn btn-primary" data-act="attPick">${ic('upload', 16)} Choose CSV file</button><input type="file" id="attFile" accept=".csv,text/csv,.txt" hidden data-change="attFile"><button class="btn" data-act="attTemplate">${ic('download', 16)} Example file</button></div>
  ${pv ? `<div class="card" style="margin-top:14px;background:var(--surface2)"><b>${pv.days.length}</b> day record(s) from <b>${pv.punches}</b> punches${pv.unknown.length ? `<div class="auth-msg err" style="margin-top:8px">IDs not matched to any staff (skipped): ${esc(pv.unknown.slice(0, 12).join(', '))}${pv.unknown.length > 12 ? '…' : ''}</div>` : ''}${pv.bad ? `<div class="muted">${pv.bad} row(s) had no readable date/time.</div>` : ''}
    ${pv.days.length ? `<table class="rtable" style="margin-top:8px"><thead><tr><th>Staff</th><th>Date</th><th>In</th><th>Out</th></tr></thead><tbody>${pv.days.slice(0, 8).map(d => `<tr><td data-label="Staff">${esc(d.emp.name)}</td><td data-label="Date">${fmtDate(d.date)}</td><td data-label="In">${esc(d.in)}</td><td data-label="Out">${esc(d.out || '—')}</td></tr>`).join('')}</tbody></table>${pv.days.length > 8 ? `<small class="muted">…and ${pv.days.length - 8} more</small>` : ''}<div class="row" style="margin-top:10px"><button class="btn btn-primary" data-act="attImport">Import ${pv.days.length} day(s)</button></div>` : ''}</div>` : ''}
  <p class="muted" style="margin-bottom:0">Planned for later: a direct connection to your device (so punches arrive automatically). Every record already stores where it came from, so that can be added without changing your data.</p>`;
}
CHG.attFile = async el => {
  const f = el.files[0]; el.value = ''; if (!f) return;
  try { IMPORT = buildImport(await f.text(), $('#imp-fmt').value); IMPORT.over = $('#imp-over').value === 'over'; IMPORT.name = f.name; }
  catch (e) { IMPORT = null; toast(e.message); }
  refreshList();
};
ACT.attPick = () => $('#attFile').click();
ACT.attTemplate = () => download('attendance-import-example.csv', csv([['Employee ID', 'Date', 'Time'], ['001', '2026-11-02', '08:31'], ['001', '2026-11-02', '17:35'], ['002', '2026-11-02', '08:55']]), 'text/csv;charset=utf-8');
ACT.attImport = async () => {
  if (!IMPORT) return; const over = $('#imp-over')?.value === 'over';
  let n = 0, skipped = 0; const total = IMPORT.days.length;
  for (const d of IMPORT.days) {
    const old = attOf(d.emp.id, d.date);
    if (old && !over && (old.source || 'manual') === 'manual' && (old.in || old.out || old.status !== 'present')) { skipped++; continue; }
    await saveAtt(d.emp.id, d.date, { status: 'present', in: d.in, out: d.out, breakMin: old?.breakMin ?? (+S.settings.shiftBreak || 0), source: 'biometric' });
    if (++n % 10 === 0) toast(`Importing… ${n} of ${total}`);
  }
  IMPORT = null; await reload(); toast(`Imported ${n} day(s)${skipped ? `, kept ${skipped} existing` : ''}`);
};

/* =====================================================================
   PAYROLL
   ===================================================================== */
const PAY_BADGE = { Paid: 'Paid', Draft: 'Draft' };
function payRows(month) {
  const ids = new Set([...activeStaff().map(e => e.id), ...S.payroll.filter(p => p.month === month).map(p => p.employeeId)]);
  return [...ids].map(empOf).filter(Boolean).sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''), undefined, { numeric: true }) || a.name.localeCompare(b.name)).map(e => ({ e, c: payShown(e, month), rec: payRec(e.id, month) }));
}
LIST.payroll = () => {
  UI.month = UI.month || monthNow();
  const rows = payRows(UI.month);
  if (!rows.length) return empty('No staff', 'Add staff and their hourly rates in Attendance > Staff.');
  const t = rows.reduce((a, { c }) => ({ gross: a.gross + c.gross, ded: a.ded + c.ded, net: a.net + c.net, er: a.er + c.epfEr + c.etfEr }), { gross: 0, ded: 0, net: 0, er: 0 });
  return `<table class="rtable"><thead><tr><th>Staff</th><th class="r">Regular hrs</th><th class="r">OT hrs</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net pay</th><th>Status</th></tr></thead><tbody>${rows.map(({ e, c, rec }) => `<tr data-act="payForm" data-emp="${e.id}"><td data-label="Staff"><b>${esc(e.name)}</b><small>${esc(e.empNo || '')}${!c.hr ? ' · <span style="color:var(--danger)">no hourly rate</span>' : ''}</small></td><td class="r" data-label="Regular hrs">${nq.format(c.regHours)}</td><td class="r" data-label="OT hrs">${nq.format(c.otHours)}</td><td class="r" data-label="Gross">${money(c.gross)}</td><td class="r" data-label="Deductions">${money(c.ded)}</td><td class="r" data-label="Net pay"><b>${money(c.net)}</b></td><td data-label="Status">${rec ? badge(rec.status) : '<span class="muted">Not saved</span>'}</td></tr>`).join('')}</tbody><tfoot><tr><td><b>Total</b></td><td></td><td></td><td class="r"><b>${money(r2(t.gross))}</b></td><td class="r"><b>${money(r2(t.ded))}</b></td><td class="r"><b>${money(r2(t.net))}</b></td><td></td></tr></tfoot></table>
    <small class="muted">Employer EPF + ETF for this month: ${money(r2(t.er))} (not included in expenses). Saved drafts follow later attendance changes until you mark them paid.</small>`;
};
VIEWS.payroll = () => {
  UI.month = UI.month || monthNow();
  return `<div class="page-head"><h2>Payroll</h2><div class="actions"><button class="btn" data-act="exportCsv" data-kind="payroll">${ic('download', 16)} CSV</button><button class="btn" data-act="payPrintAll">${ic('printer', 16)} Print summary</button></div></div>
  <div class="toolbar"><input type="month" data-ui="month" value="${esc(UI.month)}" style="width:auto"><span class="muted">${monthLabel(UI.month)}</span></div>
  <div class="card" id="list">${LIST.payroll()}</div>`;
};
const rowsHtml = (name, list) => `<div id="${name}">${list.map(x => lineRow(name, x)).join('')}</div><button type="button" class="btn btn-sm" data-act="payAddLine" data-list="${name}">${ic('plus', 14)} Add</button>`;
const lineRow = (name, x = {}) => `<div class="mat-row ln-${name}"><input class="ln-label" placeholder="Description" value="${esc(x.label || '')}"><input class="ln-amt" type="number" min="0" step="any" inputmode="decimal" placeholder="Amount" value="${x.amount ?? ''}"><button type="button" class="icon-btn" data-act="payDelLine" aria-label="Remove">${ic('x', 18)}</button></div>`;
const readLines = name => $$('.ln-' + name).map(r => ({ label: $('.ln-label', r).value.trim(), amount: +$('.ln-amt', r).value || 0 })).filter(x => x.amount);
ACT.payAddLine = ({ list }) => { $('#' + list).insertAdjacentHTML('beforeend', lineRow(list)); $$('.ln-' + list + ' .ln-label').pop().focus(); };
ACT.payDelLine = (_, el) => { el.closest('.mat-row').remove(); payRecalc(); };
function readPayInputs() { return { otAdj: +$('#py-ot').value || 0, allowances: readLines('allow'), bonus: +$('#py-bonus').value || 0, advance: +$('#py-adv').value || 0, other: readLines('other'), notes: $('#py-notes').value.trim() }; }
function payRecalc() {
  const f = $('#payForm'); if (!f) return; const e = empOf(f.dataset.emp); if (!e) return;
  const c = payCalc(e, f.dataset.month, readPayInputs()), set = {
    '#pc-reg': `${nq.format(c.regHours)} h × ${nf.format(c.hr)} = ${money(c.regPay)}`, '#pc-ot': `${nq.format(c.otHours)} h × ${nf.format(c.otr)} = ${money(c.otPay)}`,
    '#pc-gross': money(c.gross), '#pc-epf': c.member ? `${money(c.epfEmp)} (${+S.settings.epfEmp || 0}% of ${money(c.epfBase)})` : 'Not a member', '#pc-ded': money(c.ded), '#pc-net': money(c.net), '#pc-er': c.member ? `EPF ${money(c.epfEr)} + ETF ${money(c.etfEr)}` : '—'
  };
  Object.entries(set).forEach(([k, v]) => { const n = $(k); if (n) n.innerHTML = v; });
  const net = $('#pc-net'); if (net) net.style.color = c.net < 0 ? 'var(--danger)' : '';
}
document.addEventListener('input', e => { if (e.target.closest('#payForm')) payRecalc(); });
ACT.payForm = ({ emp }) => {
  const e = empOf(emp), month = UI.month || monthNow(); if (!e) return;
  const rec = payRec(emp, month), paid = rec?.status === 'Paid', inp = rec ? rec.inputs : defaultInputs(e), c = paid ? rec.calc : payCalc(e, month, inp), st = c.days;
  const ro = paid || !can('payroll', 'w') ? ' disabled' : '';
  const methodSel = `<select id="py-method"${ro}>${opts(PAY_METHODS, rec?.method || 'Bank transfer')}</select>`;
  openModal(`${e.name} - ${monthLabel(month)}`, `<div id="payForm" data-emp="${emp}" data-month="${month}">
    <dl class="kv"><dt>Attendance</dt><dd>${st.present} present · ${st.absent} absent · ${st.paid_leave + st.unpaid_leave} leave · ${st.holiday} holiday${st.incomplete ? ` · <b style="color:var(--danger)">${st.incomplete} day(s) missing In/Out</b>` : ''}</dd><dt>Hours</dt><dd>${nq.format(st.reg)} regular + ${nq.format(st.ot)} overtime (from attendance)</dd></dl>
    ${!c.hr ? '<div class="auth-msg err">No hourly rate is set for this person. Add it in Attendance &gt; Staff.</div>' : ''}
    <h4 class="sec-h">Earnings</h4>
    <dl class="kv"><dt>Regular pay</dt><dd id="pc-reg"></dd><dt>Overtime</dt><dd id="pc-ot"></dd></dl>
    <div class="grid2">${field('Extra overtime hours (+ / −)', `<input id="py-ot" type="number" step="any" inputmode="decimal" value="${+inp.otAdj || ''}"${ro}>`)}${field('Bonus', `<input id="py-bonus" type="number" min="0" step="any" inputmode="decimal" value="${+inp.bonus || ''}"${ro}>`)}</div>
    <div class="field" style="margin-top:10px"><span>Allowances</span>${rowsHtml('allow', inp.allowances || [])}</div>
    <h4 class="sec-h">Deductions</h4>
    <dl class="kv"><dt>EPF (employee)</dt><dd id="pc-epf"></dd></dl>
    <div class="field"><span>Salary advance recovered</span><input id="py-adv" type="number" min="0" step="any" inputmode="decimal" value="${+inp.advance || ''}"${ro}></div>
    <div class="field" style="margin-top:10px"><span>Other deductions</span>${rowsHtml('other', inp.other || [])}</div>
    <div class="totals" style="margin-top:14px"><div><span>Gross pay</span><span id="pc-gross"></span></div><div><span>Total deductions</span><span id="pc-ded"></span></div><div class="grand"><span>Net pay</span><span id="pc-net"></span></div></div>
    <small class="muted">Employer cost (not deducted from pay): <span id="pc-er"></span></small>
    <div class="grid2" style="margin-top:12px">${field('Paid on', `<input id="py-date" type="date" value="${esc(rec?.paidDate || today())}"${ro}>`)}${field('Payment method', methodSel)}</div>
    ${field('Notes', `<textarea id="py-notes"${ro}>${esc(inp.notes || '')}</textarea>`)}
    ${paid ? '<div class="alert info" style="margin-top:10px"><span>This month is paid and locked. Use “Reopen” to change it (the linked expense is removed).</span></div>' : ''}</div>`,
    `${rec && can('payroll', 'd') && !paid ? `<button class="btn btn-danger grow" data-act="delPayroll" data-emp="${emp}">Delete</button>` : ''}<button class="btn" data-act="payslip" data-emp="${emp}">${ic('printer', 16)} Payslip</button>${paid ? `<button class="btn" data-act="payReopen" data-emp="${emp}">Reopen</button>` : `<button class="btn" data-act="savePayroll" data-emp="${emp}">Save draft</button><button class="btn btn-primary" data-act="payPaid" data-emp="${emp}">Save &amp; mark paid</button>`}`, 'lg');
  payRecalc(); if (paid) { $('#pc-reg').innerHTML = `${nq.format(c.regHours)} h × ${nf.format(c.hr)} = ${money(c.regPay)}`; }
};
async function storePay(emp, status) {
  const e = empOf(emp), month = $('#payForm').dataset.month, inputs = readPayInputs();
  const old = payRec(emp, month), calc = payCalc(e, month, inputs);
  const rec = { ...(old || {}), id: payId(emp, month), employeeId: emp, month, inputs, calc, status, paidDate: status === 'Paid' ? ($('#py-date').value || today()) : '', method: $('#py-method').value, savedAt: Date.now() };
  return { rec, calc, e };
}
ACT.savePayroll = async ({ emp }) => {
  const { rec } = await storePay(emp, 'Draft'); await DB.put('payroll', rec); closeModal(); await reload(); toast('Draft saved');
};
const salaryCat = () => { const cats = expCats(); return cats.find(c => /salar|wage|payroll/i.test(c)) || cats[0] || 'Salaries & wages'; };
ACT.payPaid = async ({ emp }) => {
  const { rec, calc, e } = await storePay(emp, 'Paid');
  if (calc.net < 0 && !confirm('Net pay is negative. Mark as paid anyway?')) return;
  if (!(calc.hr > 0) && !confirm('No hourly rate is set, so pay is zero. Mark as paid anyway?')) return;
  if (can('expenses', 'w')) {
    const ex = { id: `payexp_${rec.id}`, date: rec.paidDate, amount: calc.net, category: salaryCat(), method: rec.method, description: `Salary ${monthLabel(rec.month)} - ${e.name}`, vendor: e.name, ref: '', orderId: '', payrollId: rec.id, createdAt: Date.now() };
    if (calc.net > 0) { const old = S.expenses.find(x => x.id === ex.id); await DB.put('expenses', old ? { ...old, ...ex, createdAt: old.createdAt } : ex); rec.expenseId = ex.id; }
  } else toast('Marked paid. (You cannot add expenses, so the salary was not added to Expenses.)');
  await DB.put('payroll', rec); closeModal(); await reload(); toast('Salary marked as paid' + (rec.expenseId ? ' and added to Expenses' : ''));
};
ACT.payReopen = async ({ emp }) => {
  const month = $('#payForm').dataset.month, rec = payRec(emp, month); if (!rec) return;
  if (!confirm('Reopen this month? The salary expense will be removed until you mark it paid again.')) return;
  if (rec.expenseId) { try { await DB.del('expenses', rec.expenseId); } catch (e) { if (!e.perm) throw e; toast('Could not remove the linked expense: ask a manager.'); } }
  await DB.put('payroll', { ...rec, status: 'Draft', paidDate: '', expenseId: '' }); closeModal(); await reload(); toast('Reopened');
};
ACT.delPayroll = async ({ emp }) => {
  const month = $('#payForm').dataset.month, rec = payRec(emp, month); if (!rec) return;
  if (!confirm('Delete this saved payroll record?')) return;
  await DB.del('payroll', rec.id); closeModal(); await reload(); toast('Deleted');
};

/* ---- payslip & summary printing, CSV ---- */
ACT.payslip = ({ emp }) => {
  const e = empOf(emp), month = $('#payForm')?.dataset.month || UI.month || monthNow();
  const c = $('#payForm') ? payCalc(e, month, readPayInputs()) : payShown(e, month), inp = $('#payForm') ? readPayInputs() : (payRec(emp, month)?.inputs || defaultInputs(e)), rec = payRec(emp, month);
  const line = (l, a) => `<tr><td>${esc(l)}</td><td class="r">${nf.format(a)}</td></tr>`;
  const earn = [[`Regular pay (${nq.format(c.regHours)} h × ${nf.format(c.hr)})`, c.regPay], c.otHours ? [`Overtime (${nq.format(c.otHours)} h × ${nf.format(c.otr)})`, c.otPay] : null, ...(inp.allowances || []).map(x => [x.label || 'Allowance', +x.amount]), c.bonus ? ['Bonus', c.bonus] : null].filter(Boolean);
  const ded = [c.epfEmp ? [`EPF (${+S.settings.epfEmp || 0}%)`, c.epfEmp] : null, c.advance ? ['Salary advance', c.advance] : null, ...(inp.other || []).map(x => [x.label || 'Deduction', +x.amount])].filter(Boolean);
  const html = `<div class="pd">${letterhead('PAYSLIP', `Period: <b>${monthLabel(month)}</b><br>${rec?.status === 'Paid' ? 'Paid on ' + fmtDate(rec.paidDate) : 'Draft'}`)}<div class="pd-cols"><div><h5>Employee</h5><b>${esc(e.name)}</b><br>${esc([e.empNo, e.position].filter(Boolean).join(' · '))}</div><div><h5>Attendance</h5>${c.days.present} days present · ${nq.format(c.regHours)} regular h · ${nq.format(c.otHours)} OT h</div></div>
    <div class="pd-cols"><div><h5>Earnings</h5><table class="pd-table"><tbody>${earn.map(x => line(...x)).join('')}<tr><td><b>Gross pay</b></td><td class="r"><b>${nf.format(c.gross)}</b></td></tr></tbody></table></div><div><h5>Deductions</h5><table class="pd-table"><tbody>${ded.length ? ded.map(x => line(...x)).join('') : '<tr><td>None</td><td class="r">0.00</td></tr>'}<tr><td><b>Total deductions</b></td><td class="r"><b>${nf.format(c.ded)}</b></td></tr></tbody></table></div></div>
    <div class="pd-tot"><div class="g"><span>Net pay (${esc(S.settings.currency)})</span><span>${nf.format(c.net)}</span></div></div>${c.member ? `<div class="pd-note">Employer contributions (not deducted): EPF ${nf.format(c.epfEr)} · ETF ${nf.format(c.etfEr)}</div>` : ''}${inp.notes ? `<div class="pd-note"><b>Notes:</b> ${esc(inp.notes)}</div>` : ''}<div class="pd-sign"><span>Employee signature</span><span>Authorized signature</span></div></div>`;
  doPrint(html, `Payslip ${e.name} ${month}`);
};
ACT.payPrintAll = () => {
  const m = UI.month || monthNow(), rows = payRows(m);
  const html = `<div class="pd">${letterhead('PAYROLL SUMMARY', `Period: <b>${monthLabel(m)}</b>`)}<table class="pd-table"><thead><tr><th>Staff</th><th class="r">Reg h</th><th class="r">OT h</th><th class="r">Gross</th><th class="r">EPF</th><th class="r">Advance</th><th class="r">Other</th><th class="r">Net</th></tr></thead><tbody>${rows.map(({ e, c }) => `<tr><td>${esc(e.name)}</td><td class="r">${nq.format(c.regHours)}</td><td class="r">${nq.format(c.otHours)}</td><td class="r">${nf.format(c.gross)}</td><td class="r">${nf.format(c.epfEmp)}</td><td class="r">${nf.format(c.advance)}</td><td class="r">${nf.format(c.other)}</td><td class="r"><b>${nf.format(c.net)}</b></td></tr>`).join('')}<tr><td><b>Total</b></td><td></td><td></td><td class="r"><b>${nf.format(r2(rows.reduce((a, x) => a + x.c.gross, 0)))}</b></td><td class="r"><b>${nf.format(r2(rows.reduce((a, x) => a + x.c.epfEmp, 0)))}</b></td><td class="r"><b>${nf.format(r2(rows.reduce((a, x) => a + x.c.advance, 0)))}</b></td><td class="r"><b>${nf.format(r2(rows.reduce((a, x) => a + x.c.other, 0)))}</b></td><td class="r"><b>${nf.format(r2(rows.reduce((a, x) => a + x.c.net, 0)))}</b></td></tr></tbody></table><div class="pd-sign"><span>Prepared by</span><span>Approved by</span></div></div>`;
  doPrint(html, `Payroll ${m}`);
};
const HRCSV = {
  suppliers: () => csvTable(`suppliers-${today()}.csv`, ['Name', 'Contact', 'Phone', 'Email', 'Address', 'Purchases'], S.suppliers.map(x => [x.name, x.contact, x.phone, x.email, x.address, supSpend(x)])),
  attendance: () => { const m = UI.month || monthNow(); csvTable(`attendance-${m}.csv`, ['Staff no.', 'Name', 'Present', 'Absent', 'Paid leave', 'Unpaid leave', 'Holidays', 'Regular hours', 'OT hours'], activeStaff().map(e => { const s = monthSummary(e.id, m); return [e.empNo, e.name, s.present, s.absent, s.paid_leave, s.unpaid_leave, s.holiday, s.reg, s.ot]; })); },
  payroll: () => { const m = UI.month || monthNow(); csvTable(`payroll-${m}.csv`, ['Staff no.', 'Name', 'Regular hours', 'OT hours', 'Rate', 'OT rate', 'Regular pay', 'OT pay', 'Allowances', 'Bonus', 'Gross', 'EPF (employee)', 'Advance', 'Other deductions', 'Net pay', 'EPF (employer)', 'ETF (employer)', 'Status'], payRows(m).map(({ e, c, rec }) => [e.empNo, e.name, c.regHours, c.otHours, c.hr, c.otr, c.regPay, c.otPay, c.allow, c.bonus, c.gross, c.epfEmp, c.advance, c.other, c.net, c.epfEr, c.etfEr, rec?.status || 'Not saved'])); }
};
const _exportCsv = ACT.exportCsv;
ACT.exportCsv = (d, el) => HRCSV[d.kind] ? HRCSV[d.kind](d) : _exportCsv(d, el);

/* =====================================================================
   SETTINGS card + REPORT sections
   ===================================================================== */
function hrSettingsCard() {
  const s = S.settings, n = (id, label, v, extra = '') => field(label, `<input id="${id}" type="number" min="0" step="any" inputmode="decimal" value="${+v || 0}" ${extra}>`);
  return `<div class="card"><h3>Attendance &amp; payroll</h3><div class="grid3">
    ${n('h-std', 'Normal hours per day', s.stdHours)}${n('h-ot', 'Overtime pay multiplier (× hourly rate)', s.otMultiplier)}${field('EPF calculated on', `<select id="h-base"><option value="basic"${s.epfBase === 'gross' ? '' : ' selected'}>Regular pay only</option><option value="gross"${s.epfBase === 'gross' ? ' selected' : ''}>Gross pay</option></select>`)}
    ${n('h-epf', 'EPF - employee %', s.epfEmp)}${n('h-epfer', 'EPF - employer %', s.epfEr)}${n('h-etf', 'ETF - employer %', s.etfEr)}
    ${field('Shift starts', `<input id="h-ss" type="time" value="${esc(s.shiftStart)}">`)}${field('Shift ends', `<input id="h-se" type="time" value="${esc(s.shiftEnd)}">`)}${n('h-sb', 'Break (minutes)', s.shiftBreak)}</div>
    <div class="row" style="margin-top:12px"><button class="btn btn-primary" data-act="saveHr">Save payroll settings</button></div>
    <small class="muted">Shift times are used by “Mark all present”. Percentages are the usual Sri Lanka rates (EPF 8% + 12%, ETF 3%); change them to match your country.</small></div>`;
}
ACT.saveHr = async () => {
  const s = S.settings, v = id => +$(id).value || 0;
  Object.assign(s, { stdHours: v('#h-std') || 8, otMultiplier: v('#h-ot') || 1, epfBase: $('#h-base').value, epfEmp: v('#h-epf'), epfEr: v('#h-epfer'), etfEr: v('#h-etf'), shiftStart: $('#h-ss').value || '08:30', shiftEnd: $('#h-se').value || '17:30', shiftBreak: v('#h-sb') });
  await saveSettings(); toast('Payroll settings saved');
};
function hrReports(from, to) {
  const inR = d => (d || '') >= from && (d || '') <= to; let out = '';
  /* purchases & stock (open to anyone who can see inventory / expenses) */
  if (can('expenses', 'r')) {
    const by = {}; S.expenses.filter(e => inR(e.date) && (e.supplierId || e.stockItemId)).forEach(e => { const k = (supOf(e.supplierId)?.name || e.vendor || 'No supplier'); by[k] = r2((by[k] || 0) + e.amount); });
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const value = r2(S.inventory.reduce((a, i) => a + (+i.stock || 0) * (+i.cost || 0), 0));
    out += `<div class="grid2 section"><div class="card"><h3>Purchases by supplier</h3>${rows.length ? hbars(rows) : empty('No supplier purchases in this range', 'Use “Stock in” with “Record as expense”, or add a supplier as vendor on an expense.')}</div><div class="card"><h3>Stock on hand</h3><dl class="kv"><dt>Items</dt><dd>${S.inventory.length}</dd><dt>Stock value</dt><dd><b>${money(value)}</b></dd><dt>Low stock</dt><dd>${S.inventory.filter(isLow).length} item(s)</dd></dl></div></div>`;
  }
  if (can('payroll', 'r')) {
    const paid = S.payroll.filter(p => p.status === 'Paid' && inR(p.paidDate));
    const t = paid.reduce((a, p) => ({ gross: a.gross + p.calc.gross, net: a.net + p.calc.net, epf: a.epf + p.calc.epfEmp, er: a.er + p.calc.epfEr + p.calc.etfEr, ot: a.ot + p.calc.otPay }), { gross: 0, net: 0, epf: 0, er: 0, ot: 0 });
    const by = {}; paid.forEach(p => { const n = empOf(p.employeeId)?.name || '—'; by[n] = r2((by[n] || 0) + p.calc.net); });
    out += `<div class="card section"><h3>Payroll (paid in this range)</h3>${paid.length ? `<div class="grid4" style="margin-bottom:12px"><div class="stat s-pink"><span>Net salaries paid</span><b>${money(r2(t.net))}</b></div><div class="stat s-blue"><span>Gross pay</span><b>${money(r2(t.gross))}</b></div><div class="stat s-orange"><span>Overtime pay</span><b>${money(r2(t.ot))}</b></div><div class="stat s-green"><span>EPF + ETF (employer)</span><b>${money(r2(t.er))}</b></div></div>${hbars(Object.entries(by).sort((a, b) => b[1] - a[1]))}<small class="muted">Net salaries are already in Expenses (and so in net profit). Employer EPF/ETF are shown here only.</small>` : empty('No salaries paid in this range')}</div>`;
  }
  if (can('attendance', 'r')) {
    const rows = activeStaff().map(e => { const recs = S.attendance.filter(r => r.employeeId === e.id && inR(r.date)), rate = rateOf(e.id); let reg = 0, ot = 0, pr = 0, ab = 0; recs.forEach(r => { const d = dayCalc(r, rate); reg += d.reg; ot += d.ot; if (r.status === 'present') pr++; if (r.status === 'absent') ab++; }); return { e, reg: r2(reg), ot: r2(ot), pr, ab }; }).filter(x => x.pr || x.ab || x.reg);
    out += `<div class="card section"><h3>Attendance summary</h3>${rows.length ? `<table class="rtable"><thead><tr><th>Staff</th><th class="r">Days present</th><th class="r">Absent</th><th class="r">Regular hrs</th><th class="r">OT hrs</th></tr></thead><tbody>${rows.map(x => `<tr><td data-label="Staff">${esc(x.e.name)}</td><td class="r" data-label="Present">${x.pr}</td><td class="r" data-label="Absent">${x.ab}</td><td class="r" data-label="Regular hrs">${nq.format(x.reg)}</td><td class="r" data-label="OT hrs">${nq.format(x.ot)}</td></tr>`).join('')}</tbody></table>` : empty('No attendance recorded in this range')}</div>`;
  }
  return out;
}
