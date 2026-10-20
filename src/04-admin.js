/* =========================================================
   Reports, Radar, Clients, Team & Roles, Settings, Profile
   ========================================================= */

/* ---------- reports ---------- */
function rangeStart() {
  const now = new Date();
  if (ui.reportsRange === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (ui.reportsRange === 'week') return startOfDay(now.getTime() - 6 * 864e5).getTime();
  return 0;
}
function empStats(empId, tasks) {
  const mine = tasks.filter(t => t.to === empId);
  const done = mine.filter(t => t.status === 'done');
  const open = mine.filter(t => t.status === 'open');
  const over = open.filter(isOver);
  const onTime = done.filter(t => (t.doneAt || 0) <= t.due);
  const hours = done.filter(t => t.doneAt && t.createdAt).map(t => (t.doneAt - t.createdAt) / 36e5);
  const avgH = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  return { total: mine.length, done: done.length, open: open.length, over: over.length, rate: pct(done.length, mine.length), onTime: pct(onTime.length, done.length), avgH };
}
function fmtHours(h) { if (!h) return '—'; if (h < 1) return Math.max(1, Math.round(h * 60)) + ' دقيقة'; if (h < 48) return (Math.round(h * 10) / 10) + ' ساعة'; return Math.round(h / 24) + ' يوم'; }
function viewReports() {
  const team = can('view_reports'); const m = me();
  const from = rangeStart();
  let tasks = liveTasks().filter(t => t.createdAt >= from);
  if (!team) tasks = tasks.filter(t => t.to === m.id);
  const done = tasks.filter(t => t.status === 'done').length;
  const open = tasks.filter(t => t.status === 'open').length;
  const over = tasks.filter(isOver).length;
  const emps = team ? sortedEmps() : [m];
  const rows = emps.map(e => ({ e, s: empStats(e.id, tasks) })).filter(r => r.s.total > 0 || !team).sort((a, b) => b.s.done - a.s.done);
  const canExport = can('export_reports');
  return `<div class="page-head">${backBtn()}${canExport ? `<div class="row">
      <button class="btn sm soft" data-act="export" data-kind="tasks">${ic('download', 16)} كشف المهام Excel</button>
      ${team ? `<button class="btn sm soft" data-act="export" data-kind="perf">${ic('download', 16)} أداء الموظفين Excel</button>` : ''}
</div>` : ''}</div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div><h2>${team ? 'التقارير' : 'إحصائياتي'}</h2><p>${team ? 'الإحصائيات وأداء الفريق' : 'أداءك الشخصي في التاسكات'}</p></div>
      <div class="tabs">${[['week', 'آخر 7 أيام'], ['month', 'الشهر ده'], ['all', 'الكل']].map(r => `<button class="${ui.reportsRange === r[0] ? 'on' : ''}" data-act="reportsRange" data-r="${r[0]}">${r[1]}</button>`).join('')}</div></div>
    <div class="kpis" style="margin-bottom:22px">
      <div class="kpi blue"><small>${ic('layers', 16)} إجمالي المهام</small><div class="v">${fmtNum(tasks.length)}</div></div>
      <div class="kpi green"><small>${ic('check', 16)} المكتملة</small><div class="v">${fmtNum(done)}</div></div>
      <div class="kpi amber"><small>${ic('clock', 16)} قيد التنفيذ</small><div class="v">${fmtNum(open)}</div></div>
      <div class="kpi red"><small>${ic('alert', 16)} متأخرة</small><div class="v">${fmtNum(over)}</div></div>
      <div class="kpi"><small>${ic('target', 16)} معدل الإنجاز</small><div class="v">${pct(done, tasks.length)}%</div><div class="bar green"><i style="width:${pct(done, tasks.length)}%"></i></div></div>
    </div>
    <div class="card-h"><h3>${ic('users', 20)} ${team ? 'أداء الموظفين' : 'تفاصيل أدائي'}</h3></div>
    ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>الموظف</th><th>إجمالي</th><th>منجز</th><th>جاري</th><th>متأخر</th><th>نسبة الإنجاز</th><th>في المعاد</th><th>متوسط وقت الإنجاز</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><div class="who">${avatar(r.e, 'sm')} ${esc(r.e.name)}</div></td><td class="num">${r.s.total}</td><td class="num">${r.s.done}</td><td class="num">${r.s.open}</td><td class="num" style="${r.s.over ? 'color:var(--danger)' : ''}">${r.s.over}</td>
        <td><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar ${r.s.rate >= 70 ? 'green' : r.s.rate >= 40 ? 'amber' : 'red'}" style="width:80px"><i style="width:${r.s.rate}%"></i></div><b>${r.s.rate}%</b></div></td>
        <td class="num">${r.s.done ? r.s.onTime + '%' : '—'}</td><td class="num">${fmtHours(r.s.avgH)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty"><div class="e-ic">${ic('chart', 26)}</div><b>مفيش بيانات في الفترة دي</b><span>جرّب "الكل"</span></div>`}
  </div>`;
}

/* ---------- excel export ---------- */
async function getExcel() { if (!window.ExcelJS) await loadAny(EXCEL_SRC); if (!window.ExcelJS) throw new Error('ExcelJS'); return window.ExcelJS; }
function downloadBlob(blob, name) {
  const a = document.createElement('a'); const url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
async function exportSheet(fileBase, title, columns, rows, colorCol) {
  const stamp = ymd(Date.now());
  try {
    const ExcelJS = await getExcel();
    const wb = new ExcelJS.Workbook(); wb.creator = 'simple task innovalz'; wb.created = new Date();
    const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] });
    const n = columns.length;
    ws.mergeCells(1, 1, 1, n);
    const tc = ws.getCell(1, 1);
    tc.value = title + ' — simple task innovalz'; tc.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D5CFF' } }; tc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;
    ws.mergeCells(2, 1, 2, n);
    const sc = ws.getCell(2, 1); sc.value = 'تاريخ التصدير: ' + fmtStamp(Date.now()) + '   •   بواسطة: ' + me().name;
    sc.font = { size: 10, color: { argb: 'FF64748B' } }; sc.alignment = { horizontal: 'center' };
    const hr = ws.getRow(3);
    columns.forEach((c, i) => {
      const cell = hr.getCell(i + 1); cell.value = c.h;
      cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFE8FF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF1D5CFF' } } };
      ws.getColumn(i + 1).width = c.w || 16;
    });
    hr.height = 24;
    rows.forEach((r, ri) => {
      const row = ws.getRow(4 + ri);
      r.forEach((v, i) => {
        const cell = row.getCell(i + 1); cell.value = v;
        cell.alignment = { vertical: 'middle', horizontal: columns[i].left ? 'right' : 'center', wrapText: !!columns[i].left };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        if (columns[i].fmt) cell.numFmt = columns[i].fmt;
        if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      if (colorCol != null) {
        const c = row.getCell(colorCol + 1); const v = String(c.value || '');
        const map = { 'منجزة': 'FFDCFCE7', 'متأخرة': 'FFFFE4E9', 'جارية': 'FFFEF3C7', 'تم البيع': 'FFDCFCE7', 'خسرناه': 'FFF1F5F9' };
        const k = Object.keys(map).find(x => v.indexOf(x) === 0);
        if (k) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: map[k] } }; c.font = { bold: true }; }
      }
    });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + Math.max(rows.length, 1), column: n } };
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase}-${stamp}.xlsx`);
    toast('الملف اتصدّر ✅', 'success', null, `${fileBase}-${stamp}.xlsx`);
  } catch (e) {
    console.warn('[excel] fallback to csv', e);
    const csv = '﻿' + [columns.map(c => c.h), ...rows].map(r => r.map(v => { let x = String(v == null ? '' : v); if (/^[=+\-@]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; }).join(',')).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileBase}-${stamp}.csv`);
    toast('اتصدّر كملف CSV يفتح على Excel', 'info', null, 'نسخة Excel المنسّقة محتاجة إنترنت');
  }
}
function runExport(kind) {
  if (!can('export_reports')) { toast('مش معاك صلاحية التصدير', 'error'); return; }
  const from = rangeStart(); const team = can('view_reports'); const m = me();
  let tasks = liveTasks().filter(t => t.createdAt >= from);
  if (!team) tasks = tasks.filter(t => t.to === m.id);
  if (kind === 'tasks') {
    const rows = sortTasks(tasks.slice()).map((t, i) => [i + 1, t.text, empName(t.to), empName(t.from), (state.clients[t.clientId] || {}).name || '—', t.priority === 'high' ? 'عاجلة' : 'عادية', fmtStamp(t.createdAt), fmtStamp(t.due), t.status === 'done' ? 'منجزة' : isOver(t) ? 'متأخرة' : 'جارية', t.doneAt ? fmtStamp(t.doneAt) : '—', t.status === 'done' ? ((t.doneAt || 0) <= t.due ? 'نعم' : 'لا') : '—']);
    exportSheet('كشف-المهام', 'كشف المهام', [{ h: '#', w: 6 }, { h: 'التاسك', w: 50, left: true }, { h: 'المسؤول', w: 18 }, { h: 'من', w: 18 }, { h: 'العميل', w: 18 }, { h: 'الأولوية', w: 10 }, { h: 'تاريخ الإرسال', w: 20 }, { h: 'موعد التسليم', w: 20 }, { h: 'الحالة', w: 12 }, { h: 'تاريخ الإنجاز', w: 20 }, { h: 'في المعاد؟', w: 11 }], rows, 8);
  } else if (kind === 'perf') {
    if (!team) return;
    const rows = sortedEmps().map(e => { const s = empStats(e.id, tasks); return [e.name, roleName(e), e.dept || '—', s.total, s.done, s.open, s.over, s.rate / 100, s.done ? s.onTime / 100 : '—', s.avgH ? Math.round(s.avgH * 10) / 10 : '—']; });
    exportSheet('أداء-الموظفين', 'تقرير أداء الموظفين', [{ h: 'الموظف', w: 22, left: true }, { h: 'الدور', w: 16 }, { h: 'القسم', w: 18 }, { h: 'إجمالي التاسكات', w: 14 }, { h: 'المنجز', w: 10 }, { h: 'الجاري', w: 10 }, { h: 'المتأخر', w: 10 }, { h: 'نسبة الإنجاز', w: 13, fmt: '0%' }, { h: 'الإنجاز في المعاد', w: 15, fmt: '0%' }, { h: 'متوسط وقت الإنجاز (ساعة)', w: 22 }], rows);

  }
}

/* ---------- radar ---------- */
function loadLevel(n) { return n >= 7 ? ['red', 'مضغوط'] : n >= 4 ? ['amber', 'متوسط'] : ['green', 'مريح']; }
function workloadHTML(clickable) {
  const tasks = liveTasks();
  const weekAgo = Date.now() - 7 * 864e5;
  const rows = sortedEmps().map(e => {
    const open = tasks.filter(t => t.to === e.id && t.status === 'open');
    return { e, open: open.length, over: open.filter(isOver).length, week: tasks.filter(t => t.to === e.id && t.status === 'done' && (t.doneAt || 0) >= weekAgo).length };
  }).sort((a, b) => b.open - a.open);
  if (!rows.length) return '<div class="empty"><b>مفيش موظفين</b></div>';
  return `<div class="list-rows">${rows.map(r => { const lv = loadLevel(r.open); return `<div class="lrow" ${clickable ? `role="button" tabindex="0" data-act="radarPick" data-id="${esc(r.e.id)}" style="cursor:pointer;${ui.radarEmp === r.e.id ? 'background:var(--primary-soft);border-radius:14px;padding-inline:10px' : ''}"` : ''}>
      ${avatar(r.e, 'md')}<div class="grow"><b>${esc(r.e.name)}</b><div class="sub">${r.open} جارية${r.over ? ` · <span style="color:var(--danger)">${r.over} متأخرة</span>` : ''} · خلّص ${r.week} الأسبوع ده</div>
      <div class="bar ${lv[0]}" style="margin-top:6px"><i style="width:${Math.min(100, Math.round(r.open / 8 * 100))}%"></i></div></div>
      <span class="tag ${lv[0] === 'red' ? 'bad' : lv[0] === 'amber' ? 'run' : 'ok'}">${lv[1]}</span></div>`; }).join('')}</div>`;
}
function viewRadar() {
  const canTrash = can('manage_trash');
  if (ui.radarTab === 'trash' && !canTrash) ui.radarTab = 'load';
  const tasks = liveTasks();
  const open = tasks.filter(t => t.status === 'open');
  const doneToday = tasks.filter(t => t.status === 'done' && t.doneAt && dayDiff(t.doneAt, Date.now()) === 0).length;
  const trash = Object.values(state.tasks).filter(t => t.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  let body;
  if (ui.radarTab === 'trash') {
    body = trash.length ? `<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn sm danger" data-act="emptyTrash">${ic('trash', 16)} تفريغ السلة</button></div><div class="task-list">${trash.slice(0, ui.limit).map(t => `<div class="task">
        <span class="chk ghost">${ic('trash', 16)}</span>
        <div class="t-body"><div class="t-text">${linkify(t.text)}</div>
          <div class="t-meta"><span>لـ: ${esc(empName(t.to))}</span><span>اتحذف ${esc(fmtDue(t.deletedAt || 0))} بواسطة ${esc(empName(t.deletedBy))}</span>${t.deleteReason ? `<span class="tag">السبب: ${esc(t.deleteReason)}</span>` : ''}</div></div>
        <div class="t-actions"><button class="btn sm soft" data-act="restoreTask" data-id="${esc(t.id)}">${ic('undo', 16)} استعادة</button><button class="ic-btn danger" data-act="purgeTask" data-id="${esc(t.id)}" title="حذف نهائي">${ic('x', 17)}</button></div></div>`).join('')}</div>${trash.length > ui.limit ? `<div class="load-more"><button class="btn ghost" data-act="more">عرض المزيد</button></div>` : ''}`
      : `<div class="empty"><div class="e-ic">${ic('trash', 26)}</div><b>سلة المحذوفات فاضية</b><span>أي تاسك يتحذف بيتحفظ هنا ويتسترجع في أي وقت</span></div>`;
  } else {
    let list = open;
    if (ui.radarEmp !== 'all') list = list.filter(t => t.to === ui.radarEmp);
    body = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)">
      <div><div class="card-h"><h3>${ic('users', 20)} ضغط الشغل على كل موظف</h3></div>${workloadHTML(true)}</div>
      <div><div class="card-h"><h3>${ic('layers', 20)} ${ui.radarEmp === 'all' ? 'كل المهام الجارية' : 'مهام ' + esc(empName(ui.radarEmp))}</h3>
        <select class="select sm" style="max-width:200px" data-chg="radarEmp"><option value="all">كل الفريق</option>${sortedEmps().map(e => `<option value="${esc(e.id)}" ${ui.radarEmp === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
        ${taskListHTML(list.sort((a, b) => a.due - b.due), 'team', { title: 'مفيش مهام جارية', sub: 'الفريق مخلص كل حاجة 👏' })}</div></div>`;
  }
  return `<div class="page-head">${backBtn()}</div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div><h2>رادار المهام</h2><p>نظرة شاملة على شغل الفريق كله</p></div>
      <div class="tabs"><button class="${ui.radarTab === 'load' ? 'on' : ''}" data-act="radarTab" data-tab="load">الرادار</button>${canTrash ? `<button class="${ui.radarTab === 'trash' ? 'on' : ''}" data-act="radarTab" data-tab="trash">سلة المحذوفات (${trash.length})</button>` : ''}</div></div>
    <div class="kpis" style="margin-bottom:22px">
      <div class="kpi blue"><small>مهام جارية</small><div class="v">${open.length}</div></div>
      <div class="kpi red"><small>متأخرة</small><div class="v">${open.filter(isOver).length}</div></div>
      <div class="kpi green"><small>اتخلصت النهارده</small><div class="v">${doneToday}</div></div>
      <div class="kpi"><small>عاجلة</small><div class="v">${open.filter(t => t.priority === 'high').length}</div></div>
    </div>
    ${body}
  </div>`;
}

/* ---------- clients ---------- */
function clientStats(c) {
  const tasks = liveTasks().filter(t => t.clientId === c.id);
  const open = tasks.filter(t => t.status === 'open');
  const evs = Object.values(state.events).filter(e => e.clientId === c.id);
  const lastAct = Math.max(c.createdAt || 0, ...evs.map(e => parseYMD(e.date) || e.createdAt || 0), ...tasks.map(t => t.createdAt || 0));
  return { open: open.length, over: open.filter(isOver).length, lastAct, events: evs.length };
}
function viewClients() {
  const q = ui.clientQ.trim().toLowerCase();
  let list = Object.values(state.clients).sort((a, b) => (a.status === 'inactive') - (b.status === 'inactive') || a.name.localeCompare(b.name, 'ar'));
  if (q) list = list.filter(c => [c.name, c.industry, empName(c.managerId)].join(' ').toLowerCase().includes(q));
  return `<div class="page-head">${backBtn()}${can('manage_clients') ? `<button class="btn primary sm" data-act="clientForm">${ic('plusc', 18)} إضافة عميل</button>` : ''}</div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div><h2>حسابات العملاء</h2><p>كل البراندات اللي بنشتغل عليها في مكان واحد</p></div>
      <input class="input sm" style="max-width:260px" placeholder="🔍 دور على عميل…" value="${esc(ui.clientQ)}" data-inp="clientQ"></div>
    ${list.length ? `<div class="client-grid">${list.map(c => { const s = clientStats(c); return `<div class="client-card ${c.status === 'inactive' ? 'off' : ''}" role="button" tabindex="0" data-act="openClient" data-id="${esc(c.id)}">
        <div class="cc-top"><span class="cc-logo">${esc(initials(c.name))}</span><div style="min-width:0"><b>${esc(c.name)}</b><small>${esc(c.industry || 'بدون مجال')}${c.status === 'inactive' ? ' · متوقف' : ''}</small></div></div>
        <div class="cc-stats"><span class="tag ${s.open ? 'blue' : ''}">${s.open} تاسك جاري</span>${s.over ? `<span class="tag bad">${s.over} متأخر</span>` : ''}${c.budget ? `<span class="tag ok">${fmtMoney(c.budget)}/شهر</span>` : ''}</div>
        <div class="row" style="font-size:13px;color:var(--text2)">${c.managerId && state.employees[c.managerId] ? avatarById(c.managerId, 'sm') + ' ' + esc(empName(c.managerId)) : 'بدون مدير حساب'}<span class="spacer"></span><span class="muted">آخر نشاط ${esc(agoDays(s.lastAct))}</span></div>
      </div>`; }).join('')}</div>` : `<div class="empty"><div class="e-ic">${ic('building', 26)}</div><b>${q ? 'مفيش نتايج' : 'مفيش عملاء لسه'}</b><span>${q ? 'جرّب كلمة تانية' : 'ضيف أول عميل'}</span></div>`}
  </div>`;
}
function viewClient() {
  const c = state.clients[ui.clientId];
  if (!c) { ui.view = 'clients'; return viewClients(); }
  const canM = can('manage_clients');
  const tasks = liveTasks().filter(t => t.clientId === c.id);
  const open = tasks.filter(t => t.status === 'open').sort((a, b) => a.due - b.due);
  const evs = Object.values(state.events).filter(e => e.clientId === c.id).sort((a, b) => (parseYMD(b.date) || 0) - (parseYMD(a.date) || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const site = normUrl(c.website);
  return `<div class="page-head"><button class="back-btn" data-act="go" data-view="clients">${ic('arrowR', 18)} كل العملاء</button>
    <div class="row">${can('send_tasks') ? `<button class="btn sm primary" data-act="sendForClient" data-id="${esc(c.id)}">${ic('send', 16)} ابعت تاسك للعميل ده</button>` : ''}${canM ? `<button class="btn sm" data-act="clientForm" data-id="${esc(c.id)}">${ic('edit', 16)} تعديل</button><button class="ic-btn danger" data-act="delClient" data-id="${esc(c.id)}" title="حذف العميل">${ic('trash', 18)}</button>` : ''}</div></div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div class="row" style="gap:14px"><span class="cc-logo" style="width:58px;height:58px;font-size:22px">${esc(initials(c.name))}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.industry || 'بدون مجال')} ${c.status === 'inactive' ? '· <span class="tag bad">متوقف</span>' : '· <span class="tag ok">نشط</span>'}</p></div></div></div>
    <div class="info-grid">
      <div class="info"><small>مدير الحساب</small><div class="row" style="gap:8px">${c.managerId && state.employees[c.managerId] ? avatarById(c.managerId, 'sm') + esc(empName(c.managerId)) : '—'}</div></div>
      <div class="info"><small>الميزانية الشهرية</small><div>${c.budget ? fmtMoney(c.budget) : '—'}</div></div>
      <div class="info"><small>المنصات</small><div>${(c.platforms || []).length ? c.platforms.map(p => `<span class="tag" style="margin:2px">${esc(p)}</span>`).join('') : '—'}</div></div>
      <div class="info"><small>المشروعات والخدمات</small><div>${(c.projects || []).length ? c.projects.map(p => `<span class="tag" style="margin:2px">${esc(p)}</span>`).join('') : '—'}</div></div>
      <div class="info"><small>الموقع الإلكتروني</small><div>${site ? `<button class="link ltr" data-act="openUrl" data-url="${esc(site)}">${esc(c.website)}</button>` : '—'}</div></div>
    </div>
    ${c.notes ? `<div class="info" style="margin-top:12px"><small>ملاحظات</small><div style="font-weight:500;white-space:pre-wrap">${linkify(c.notes)}</div></div>` : ''}
    <div class="sep"></div>
    <div class="grid2">
      <div>
        <div class="card-h"><h3>📅 سجل أحداث الحساب</h3></div>
        ${canM || can('log_events') ? `<div class="info" style="margin-bottom:16px;display:flex;flex-direction:column;gap:10px">
          <div class="form-grid"><select class="select sm" id="evType">${EVENT_TYPES.map(t => `<option value="${t.id}">${t.e} ${t.label}</option>`).join('')}</select><input class="input sm" type="date" id="evDate" value="${ymd(Date.now())}"></div>
          <input class="input sm" id="evNote" placeholder="التفاصيل… (مثلاً: اجتماع مراجعة خطة الشهر)" maxlength="500">
          <button class="btn sm primary" data-act="addEvent" data-id="${esc(c.id)}">${ic('plusc', 16)} سجّل الحدث</button></div>` : ''}
        ${evs.length ? `<div class="timeline">${evs.map(ev => { const t = EVENT_TYPES.find(x => x.id === ev.type) || EVENT_TYPES[5]; return `<div class="tl"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>${t.e} ${t.label}</b>${(ev.by === me().id || canM) ? `<button class="ic-btn danger" style="width:30px;height:30px" data-act="delEvent" data-id="${esc(ev.id)}" title="حذف">${ic('x', 14)}</button>` : ''}</div><div class="sub">${esc(fmtDate(parseYMD(ev.date) || ev.createdAt))} · ${esc(empName(ev.by))}</div>${ev.note ? `<p>${linkify(ev.note)}</p>` : ''}</div>`; }).join('')}</div>` : '<div class="muted" style="padding:10px 0">لسه مفيش أحداث متسجلة</div>'}
      </div>
      <div>
        <div class="card-h"><h3>${ic('checksq', 20)} المهام الجارية للعميل (${open.length})</h3></div>
        ${taskListHTML(open, 'client', { title: 'مفيش مهام جارية للعميل ده', sub: 'ابعت تاسك من الزرار اللي فوق' })}
      </div>
    </div>
  </div>`;
}
function clientForm(id) {
  if (!can('manage_clients')) return;
  const c = id ? state.clients[id] : null;
  const d = c || { name: '', industry: '', managerId: me().id, budget: '', platforms: [], projects: [], website: '', notes: '', status: 'active' };
  modal(c ? `${ic('edit', 20)} تعديل العميل` : `${ic('building', 20)} عميل جديد`, `<div class="form-grid" id="clForm">
      <label class="field"><span>اسم العميل / البراند <b class="req">*</b></span><input class="input" id="clName" value="${esc(d.name)}" maxlength="80" autofocus></label>
      <label class="field"><span>المجال</span><input class="input" id="clInd" value="${esc(d.industry)}" placeholder="مثلاً: عيادات، عقارات" maxlength="60"></label>
      <label class="field"><span>مدير الحساب المسؤول</span><select class="select" id="clMgr"><option value="">—</option>${sortedEmps().map(e => `<option value="${esc(e.id)}" ${d.managerId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>الميزانية الشهرية (ج.م)</span><input class="input" id="clBud" value="${d.budget ? esc(d.budget) : ''}" inputmode="numeric" placeholder="0"></label>
      <label class="field full"><span>الموقع الإلكتروني</span><input class="input ltr" id="clWeb" value="${esc(d.website)}" placeholder="example.com" inputmode="url"></label>
      <div class="field full"><span>المنصات</span><div class="checks">${PLATFORMS.map(p => `<label class="check"><input type="checkbox" name="clPlat" value="${esc(p)}" ${(d.platforms || []).includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')}</div></div>
      <div class="field full"><span>المشروعات والخدمات</span><div class="checks">${SERVICES.map(s => `<label class="check"><input type="checkbox" name="clProj" value="${esc(s)}" ${(d.projects || []).includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div></div>
      <label class="field full"><span>ملاحظات</span><textarea class="textarea" id="clNotes" maxlength="2000">${esc(d.notes)}</textarea></label>
      <label class="check full"><input type="checkbox" id="clActive" ${d.status !== 'inactive' ? 'checked' : ''}> العميل نشط حالياً</label>
    </div>`, `<button class="btn primary" data-act="saveClient" data-id="${esc(id || '')}">${ic('check', 18)} حفظ</button><button class="btn ghost" data-act="closeLayer" data-layer="modal">إلغاء</button>`, 'wide');
}
function saveClient(id) {
  const name = $('#clName').value.trim();
  if (!name) { toast('اكتب اسم العميل', 'error'); $('#clName').focus(); return; }
  const dup = Object.values(state.clients).find(c => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase());
  if (dup) { toast('في عميل بنفس الاسم ده', 'error'); return; }
  const web = $('#clWeb').value.trim();
  if (web && !normUrl(web)) { toast('الموقع مش مكتوب صح', 'error'); return; }
  const base = id && state.clients[id] ? state.clients[id] : { id: uid(), createdAt: Date.now() };
  const c = Object.assign({}, base, {
    name, industry: $('#clInd').value.trim(), managerId: $('#clMgr').value, budget: toNum($('#clBud').value),
    website: web, platforms: $$('input[name="clPlat"]:checked').map(x => x.value), projects: $$('input[name="clProj"]:checked').map(x => x.value), notes: $('#clNotes').value.trim(),
    status: $('#clActive').checked ? 'active' : 'inactive'
  });
  save('clients', c); closeLayer('modal');
  toast(id ? 'بيانات العميل اتحدثت' : 'العميل اتضاف ✅');
}

/* ---------- team & roles ---------- */
function viewTeam() {
  const canE = can('manage_employees'), canR = can('manage_roles');
  if (ui.teamTab === 'roles' && !canR) ui.teamTab = 'emps';
  if (ui.teamTab === 'emps' && !canE) ui.teamTab = 'roles';
  let body;
  if (ui.teamTab === 'emps') {
    body = `<div class="list-rows">${sortedEmps().map(e => `<div class="lrow">
      ${avatar(e, 'md')}<div class="grow"><b>${esc(e.name)}</b> ${e.id === me().id ? '<span class="tag blue">انت</span>' : ''}<div class="sub">${esc(roleName(e))}${e.title ? ' · ' + esc(e.title) : ''}${e.dept ? ' · ' + esc(e.dept) : ''}${(e.extraPerms || []).length ? ` · <span style="color:var(--ptext)">+${e.extraPerms.length} صلاحية إضافية</span>` : ''}</div></div>
      ${e.email ? `<span class="muted ltr hide-m" style="font-size:13px">${esc(e.email)}</span>` : ''}
      <button class="ic-btn" data-act="empForm" data-id="${esc(e.id)}" title="تعديل">${ic('edit', 18)}</button>
      ${e.id !== me().id && !(isGM(e) && !isGM()) ? `<button class="ic-btn danger" data-act="delEmp" data-id="${esc(e.id)}" title="حذف">${ic('trash', 18)}</button>` : ''}
    </div>`).join('')}</div>`;
  } else {
    const roles = Object.values(state.roles).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    body = `<div class="list-rows">${roles.map(r => { const n = Object.values(state.employees).filter(e => e.roleId === r.id).length; const pc = r.id === 'gm' ? PERM_IDS.length : (r.perms || []).length; return `<div class="lrow">
      <span class="cc-logo" style="width:42px;height:42px;font-size:15px">${ic(r.id === 'gm' ? 'shield' : 'briefcase', 20)}</span>
      <div class="grow"><b>${esc(r.name)}</b> ${r.system ? '<span class="tag">أساسي</span>' : ''}<div class="sub">${pc} من ${PERM_IDS.length} صلاحية · ${n} موظف</div></div>
      ${r.id !== 'gm' ? `<button class="ic-btn" data-act="roleForm" data-id="${esc(r.id)}" title="تعديل">${ic('edit', 18)}</button>` : '<span class="tag blue">كل الصلاحيات</span>'}
      ${!r.system ? `<button class="ic-btn danger" data-act="delRole" data-id="${esc(r.id)}" title="حذف">${ic('trash', 18)}</button>` : ''}</div>`; }).join('')}</div>`;
  }
  return `<div class="page-head">${backBtn()}${ui.teamTab === 'emps' && canE ? `<button class="btn primary sm" data-act="empForm">${ic('userplus', 18)} إضافة موظف</button>` : ''}${ui.teamTab === 'roles' && canR ? `<button class="btn primary sm" data-act="roleForm">${ic('plusc', 18)} دور جديد</button>` : ''}</div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div><h2>الموظفين والصلاحيات</h2><p>إدارة فريق العمل والأدوار</p></div>
      <div class="tabs">${canE ? `<button class="${ui.teamTab === 'emps' ? 'on' : ''}" data-act="teamTab" data-tab="emps">الموظفين (${Object.keys(state.employees).length})</button>` : ''}${canR ? `<button class="${ui.teamTab === 'roles' ? 'on' : ''}" data-act="teamTab" data-tab="roles">الأدوار (${Object.keys(state.roles).length})</button>` : ''}</div></div>
    ${body}
  </div>`;
}
function permChecks(name, selected, lockedAll) {
  const groups = [...new Set(PERMS.map(p => p[2]))];
  return groups.map(g => `<div class="perm-group"><h4>${esc(g)}</h4><div class="checks">${PERMS.filter(p => p[2] === g).map(p => `<label class="check"><input type="checkbox" name="${name}" value="${p[0]}" ${lockedAll || selected.includes(p[0]) ? 'checked' : ''} ${lockedAll ? 'disabled' : ''}> ${esc(p[1])}</label>`).join('')}</div></div>`).join('');
}
function empForm(id) {
  if (!can('manage_employees')) return;
  const e = id ? state.employees[id] : null;
  if (e && isGM(e) && !isGM()) { toast('تعديل المدير العام للمدير العام بس', 'error'); return; }
  const d = e || { name: '', email: '', dept: me().dept || '', title: '', roleId: 'emp', extraPerms: [] };
  const roles = Object.values(state.roles).filter(r => r.id !== 'gm' || isGM()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  modal(e ? `${ic('edit', 20)} تعديل ${esc(e.name)}` : `${ic('userplus', 20)} موظف جديد`, `<div class="form-grid">
      <label class="field"><span>الاسم <b class="req">*</b></span><input class="input" id="emName" value="${esc(d.name)}" maxlength="50" autofocus></label>
      <label class="field"><span>الإيميل (للدخول) <b class="req">*</b></span><input class="input ltr" id="emEmail" type="email" value="${esc(d.email)}" placeholder="name@company.com" autocomplete="off"></label>
      <label class="field"><span>كلمة السر ${e ? '<small class="muted">(سيبها فاضية لو مش عاوز تغيرها)</small>' : '<b class="req">*</b>'}</span><input class="input ltr" id="emPass" type="text" autocomplete="new-password" placeholder="${e ? '••••••' : '6 حروف/أرقام على الأقل'}"></label>
      <label class="field"><span>الدور الوظيفي</span><select class="select" id="emRole">${roles.map(r => `<option value="${esc(r.id)}" ${d.roleId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="field"><span>القسم</span><input class="input" id="emDept" value="${esc(d.dept)}" placeholder="مثلاً: التسويق"></label>
      <label class="field"><span>المسمى الوظيفي</span><input class="input" id="emTitle" value="${esc(d.title)}" placeholder="مثلاً: ديزاينر"></label>
      <details class="full" ${(d.extraPerms || []).length ? 'open' : ''}><summary class="link" style="cursor:pointer;margin:6px 0 12px">صلاحيات إضافية فوق الدور (اختياري)</summary>${permChecks('emPerm', d.extraPerms || [])}</details>
    </div>`, `<button class="btn primary" data-act="saveEmp" data-id="${esc(id || '')}">${ic('check', 18)} حفظ</button><button class="btn ghost" data-act="closeLayer" data-layer="modal">إلغاء</button>`, 'wide');
}
let adminBusy = false;
async function withBusy(btn, fn) {
  if (adminBusy) return;
  adminBusy = true; if (btn) btn.disabled = true;
  try { return await fn(); } finally { adminBusy = false; if (btn && btn.isConnected) btn.disabled = false; }
}
async function saveEmp(id, btn) {
  const name = $('#emName').value.trim().replace(/\s+/g, ' ');
  const email = $('#emEmail').value.trim().toLowerCase();
  const pass = $('#emPass').value;
  const roleId = $('#emRole').value;
  if (!name) { toast('اكتب اسم الموظف', 'error'); return; }
  if (Object.values(state.employees).some(x => x.id !== id && x.name.trim().toLowerCase() === name.toLowerCase())) { toast('في موظف بنفس الاسم — ميّزه بحرف أو لقب', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('اكتب إيميل صحيح — الموظف هيدخل بيه', 'error'); return; }
  if (Object.values(state.employees).some(x => x.id !== id && (x.email || '').toLowerCase() === email)) { toast('الإيميل ده مستخدم لموظف تاني', 'error'); return; }
  if ((!id || pass) && pass.length < 6) { toast('كلمة السر لازم 6 حروف/أرقام على الأقل', 'error'); return; }
  if (!state.roles[roleId]) { toast('اختار دور', 'error'); return; }
  const old = id ? state.employees[id] : null;
  const employee = { id: id || '', name, email, password: pass, roleId, dept: $('#emDept').value.trim(), title: $('#emTitle').value.trim(), extraPerms: $$('input[name="emPerm"]:checked').map(x => x.value).filter(p => PERM_IDS.includes(p)), color: old ? old.color : nextColor() };
  await withBusy(btn, async () => {
    const r = await adminCall('saveEmployee', { employee });
    if (!r) return;
    closeLayer('modal');
    toast(old ? 'بيانات الموظف اتحدثت' : name + ' اتضاف للفريق ✅', 'success', null, old ? '' : 'يدخل بالإيميل: ' + email);
  });
}
async function delEmp(id) {
  const e = state.employees[id]; if (!e || !can('manage_employees')) return;
  if (id === me().id) { toast('مينفعش تحذف نفسك', 'error'); return; }
  if (isGM(e) && !isGM()) { toast('مش معاك صلاحية تحذف المدير العام', 'error'); return; }
  const open = liveTasks().filter(t => t.to === id && t.status === 'open').length;
  const r = await confirmBox({ title: 'حذف ' + e.name + '؟', text: (open ? `عنده ${open} تاسك جاري — هيفضلوا متسجلين باسم "موظف محذوف". ` : '') + 'الموظف مش هيقدر يدخل السيستم تاني.', ok: 'احذف الموظف', danger: true });
  if (!r) return;
  await withBusy(null, async () => { if (await adminCall('deleteEmployee', { id })) toast(e.name + ' اتحذف من الفريق'); });
}
function roleForm(id) {
  if (!can('manage_roles')) return;
  const r = id ? state.roles[id] : null;
  if (r && r.id === 'gm') return;
  modal(r ? `${ic('edit', 20)} تعديل دور: ${esc(r.name)}` : `${ic('shield', 20)} دور جديد`, `<label class="field" style="margin-bottom:16px"><span>اسم الدور <b class="req">*</b></span><input class="input" id="roName" value="${esc(r ? r.name : '')}" maxlength="40" autofocus ${r && r.system ? 'readonly' : ''}></label>
    <div class="field"><span style="margin-bottom:8px">الصلاحيات (${PERM_IDS.length} صلاحية)</span>${permChecks('roPerm', r ? (r.perms || []) : [])}</div>`,
  `<button class="btn primary" data-act="saveRole" data-id="${esc(id || '')}">${ic('check', 18)} حفظ</button><button class="btn ghost" data-act="closeLayer" data-layer="modal">إلغاء</button>`, 'wide');
}
async function saveRole(id, btn) {
  const name = $('#roName').value.trim();
  if (!name) { toast('اكتب اسم الدور', 'error'); return; }
  if (Object.values(state.roles).some(x => x.id !== id && x.name.trim() === name)) { toast('في دور بنفس الاسم', 'error'); return; }
  const role = { id: id || '', name, perms: $$('input[name="roPerm"]:checked').map(x => x.value).filter(p => PERM_IDS.includes(p)) };
  await withBusy(btn, async () => { if (await adminCall('saveRole', { role })) { closeLayer('modal'); toast('الدور اتحفظ ✅'); } });
}
async function delRole(id) {
  const r = state.roles[id]; if (!r || r.system || !can('manage_roles')) return;
  const n = Object.values(state.employees).filter(e => e.roleId === id).length;
  if (n) { toast(`الدور ده عليه ${n} موظف — غيّر دورهم الأول`, 'error'); return; }
  const ok = await confirmBox({ title: 'حذف دور ' + r.name + '؟', ok: 'احذف', danger: true });
  if (ok) await withBusy(null, async () => { if (await adminCall('deleteRole', { id })) toast('الدور اتحذف'); });
}

/* ---------- profile ---------- */
function openProfile() {
  const m = me();
  const perms = permsOf(m);
  modal(`${ic('user', 20)} ملفي`, `<div class="row" style="gap:14px;margin-bottom:18px">${avatar(m)}<div><b style="font-size:19px">${esc(m.name)}</b><div class="t2">${esc(roleName(m))}${m.title ? ' · ' + esc(m.title) : ''}${m.dept ? ' · ' + esc(m.dept) : ''}</div></div></div>
    <div class="info" style="margin-bottom:16px"><small style="margin-bottom:8px">تغيير كلمة السر</small>
      <div class="form-grid"><input class="input" type="password" id="pfOld" placeholder="كلمة السر الحالية" autocomplete="current-password"><input class="input" type="password" id="pfNew" placeholder="كلمة السر الجديدة" autocomplete="new-password"></div>
      <button class="btn sm primary" style="margin-top:10px" data-act="changePass">${ic('lock', 16)} غيّر كلمة السر</button></div>
    <div class="info" style="margin-bottom:16px"><small style="margin-bottom:8px">التفضيلات</small><div class="row">
      <button class="btn sm ghost" data-act="toggleTheme">${ic(prefs.theme === 'dark' ? 'sun' : 'moon', 16)} ${prefs.theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</button>
      <button class="btn sm ghost" data-act="toggleSound">${ic(prefs.sound ? 'vol' : 'volx', 16)} الصوت: ${prefs.sound ? 'شغال' : 'مقفول'}</button>
      ${'Notification' in window ? `<button class="btn sm ghost" data-act="enableNotif">${ic('bell', 16)} إشعارات المتصفح${Notification.permission === 'granted' ? ' ✓' : ''}</button>` : ''}</div></div>
    <div class="info"><small style="margin-bottom:8px">صلاحياتك (${perms.length})</small><div class="checks">${perms.length ? perms.map(p => `<span class="tag blue">${esc((PERMS.find(x => x[0] === p) || [])[1])}</span>`).join('') : '<span class="muted">استعراض وإنجاز تاسكاتك + المحادثة</span>'}</div></div>`,
  `<button class="btn danger" data-act="logout">${ic('logout', 18)} خروج</button><button class="btn ghost" data-act="closeLayer" data-layer="modal">إغلاق</button>`);
}
async function changePass(btn) {
  const m = me(); const o = $('#pfOld').value, n = $('#pfNew').value;
  if (!o) { toast('اكتب كلمة السر الحالية', 'error'); return; }
  if (n.length < 6) { toast('الجديدة لازم 6 حروف/أرقام على الأقل', 'error'); return; }
  await withBusy(btn, async () => {
    const email = (authSession && authSession.user && authSession.user.email) || m.email;
    const chk = await sb.auth.signInWithPassword({ email, password: o });
    if (chk.error) { toast('كلمة السر الحالية مش صح', 'error'); return; }
    const up = await sb.auth.updateUser({ password: n });
    if (up.error) { toast('مقدرناش نغيّرها: ' + up.error.message, 'error'); return; }
    closeLayer('modal'); toast('كلمة السر اتغيرت ✅');
  });
}

/* ---------- settings ---------- */
function viewSettings() {
  return `<div class="page-head">${backBtn()}</div>
  <div class="stack">
  <div class="card">
    <div class="card-h"><h3>${ic('cloud', 22)} الاتصال بقاعدة البيانات</h3><span class="row" style="gap:8px;font-weight:600"><span class="cloud-dot ${cloudState}"></span><span data-cloud-label>${esc(cloudLabel())}</span></span></div>
    <p class="t2">السيستم متوصل بـ Supabase عن طريق متغيرات Vercel. أي تعديل بيظهر على كل الأجهزة في نفس اللحظة.</p>
    <div class="row" style="margin-top:14px"><button class="btn sm ghost" data-act="cloudResync">${ic('reset', 16)} مزامنة دلوقتي</button>
      ${pending.length ? `<span class="tag run">${pending.length} تعديل مستني يترفع</span>` : ''}</div>
  </div>
  <div class="card">
    <div class="card-h"><h3>${ic('download', 22)} النسخ الاحتياطي</h3></div>
    <p class="t2" style="margin-bottom:14px">نزّل نسخة من كل البيانات (التاسكات، العملاء، الموظفين، المحادثة) كملف تحتفظ بيه.</p>
    <button class="btn soft" data-act="backup">${ic('download', 18)} تنزيل نسخة احتياطية</button>
  </div></div>`;
}
function backup() {
  const data = JSON.parse(JSON.stringify(state));
  const blob = new Blob([JSON.stringify({ app: 'mynd-tasks', v: 3, exportedAt: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
  downloadBlob(blob, 'mynd-backup-' + ymd(Date.now()) + '.json');
  toast('النسخة الاحتياطية اتنزلت ✅');
}
