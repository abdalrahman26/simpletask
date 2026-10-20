/* =========================================================
   Router + chrome + main views
   ========================================================= */
const ui = {
  view: 'home',
  sendStep: 1, sendTo: null, sendKind: 'tomorrow', sendDue: null, sendText: '', sendClient: '', sendPriority: 'normal', sendLink: '', sendMore: false, lastSentTo: null,
  tasksTab: 'mine', teamEmp: 'all', teamStatus: 'open', limit: 40,
  radarTab: 'load', radarEmp: 'all',
  reportsRange: 'month',
  clientId: null, clientQ: '',
  dashTab: 'daily',
  teamTab: 'emps'
};
const UI_DEFAULTS = JSON.parse(JSON.stringify(ui));
const VIEW_PERM = {
  home: null, tasks: null, reports: null, send: 'send_tasks', radar: 'view_radar', clients: 'view_clients', client: 'view_clients',
  dash: 'view_dashboard', team: ['manage_employees', 'manage_roles'], settings: 'manage_settings'
};
function allowed(v) {
  if (!(v in VIEW_PERM)) return false;
  const p = VIEW_PERM[v];
  if (!p) return true;
  return Array.isArray(p) ? p.some(x => can(x)) : can(p);
}
function go(v, opts) {
  if (!me()) return;
  if (!allowed(v)) { toast('مش معاك صلاحية للصفحة دي 🔒', 'error'); return; }
  if (v === 'send' && !(opts && opts.keep)) { if (ui.view !== 'send' || ui.sendStep === 3) resetSend(); }
  ui.view = v; ui.limit = 40;
  try { if (location.hash.slice(1) !== v) history.pushState(null, '', '#' + v); } catch (e) { /* sandboxed */ }
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => {
  const v = (location.hash || '#home').slice(1);
  if (!me() || v === ui.view) return;
  if (v === 'client' && !state.clients[ui.clientId]) { ui.view = 'clients'; render(); return; }
  if (allowed(v)) { if (v === 'send' && ui.sendStep === 3) resetSend(); ui.view = v; render(); window.scrollTo(0, 0); }
  else { try { history.replaceState(null, '', '#' + ui.view); } catch (e) { /* ignore */ } }
});
function resetSend() {
  Object.assign(ui, { sendStep: 1, sendTo: null, sendKind: 'tomorrow', sendDue: null, sendText: '', sendClient: '', sendPriority: 'normal', sendLink: '', sendMore: false });
}
function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme === 'dark' ? 'dark' : 'light';
  const mt = document.querySelector('meta[name="theme-color"]');
  if (mt) mt.setAttribute('content', prefs.theme === 'dark' ? '#070d1e' : '#f4f7fc');
}
function savePrefs() { LS.set(PREFS_KEY, prefs); }

/* ---------- task helpers ---------- */
function liveTasks() { return Object.values(state.tasks).filter(t => !t.deleted); }
function isOver(t) { return t.status === 'open' && t.due < Date.now(); }
function canComplete(t) { const m = me(); return !!m && (t.to === m.id || can('complete_any')); }
function canDeleteTask(t) { const m = me(); return !!m && (t.from === m.id || can('delete_tasks')); }
function myOpen() { const m = me(); return liveTasks().filter(t => t.to === m.id && t.status === 'open').sort((a, b) => a.due - b.due); }
function sortTasks(arr) {
  return arr.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (a.status === 'open') return a.due - b.due;
    return (b.doneAt || 0) - (a.doneAt || 0);
  });
}

/* ---------- chrome ---------- */
function navItems() {
  const items = [{ v: 'home', l: 'الرئيسية', i: 'home' }];
  if (can('send_tasks')) items.push({ v: 'send', l: 'ابعت تاسك', i: 'plusc' });
  items.push({ v: 'tasks', l: 'تاسكاتي', i: 'checksq', badge: myOpen().length });
  if (can('view_dashboard')) items.push({ v: 'dash', l: 'لوحة المدير', i: 'grid' });
  items.push({ v: 'reports', l: 'التقارير', i: 'chart' });
  if (can('view_clients')) items.push({ v: 'clients', l: 'العملاء', i: 'building' });
  return items;
}
function topbarHTML() {
  const m = me();
  const cur = ui.view === 'client' ? 'clients' : ui.view;
  const nav = navItems().map(n => `<button class="${cur === n.v ? 'on' : ''}" data-act="go" data-view="${n.v}">${n.l}${n.badge ? ` <span class="tag blue" style="padding:0 7px">${n.badge}</span>` : ''}</button>`).join('');
  return `<div class="topbar-in">
    <span class="brand">${ic('sparkles', 18)} simple task <span>innovalz</span></span>
    <nav class="top-nav">${nav}</nav>
    <div class="top-tools">
      <button id="pomoMini" class="pomo-mini" data-act="go" data-view="dash" title="البومودورو" hidden></button>
      <button class="ic-btn" data-act="cloudInfo" title="${esc(cloudLabel())}"><span class="cloud-dot ${cloudState}"></span></button>
      <button class="ic-btn" data-act="toggleSound" title="الصوت">${ic(prefs.sound ? 'vol' : 'volx', 19)}</button>
      <button class="ic-btn" data-act="toggleTheme" title="الوضع الليلي / النهاري">${ic(prefs.theme === 'dark' ? 'sun' : 'moon', 19)}</button>
      <button class="me-chip" data-act="profile" title="ملفي">${avatar(m, 'sm')}<span class="nm">${esc(firstName(m.name))}</span></button>
    </div></div>`;
}
function bottomNavHTML() {
  const items = navItems();
  const cur = ui.view === 'client' ? 'clients' : ui.view;
  return items.map(n => `<button class="${cur === n.v ? 'on' : ''}" data-act="go" data-view="${n.v}">${ic(n.i, 22)}<span>${n.l}</span>${n.badge ? `<i class="nb">${n.badge > 99 ? '99+' : n.badge}</i>` : ''}</button>`).join('');
}
function renderChrome() {
  if (!me()) return;
  const tb = $('#topbar');
  if (ui.view !== 'home') { tb.hidden = false; tb.innerHTML = topbarHTML(); } else { tb.hidden = true; tb.innerHTML = ''; }
  $('#bottomnav').innerHTML = bottomNavHTML();
  if (!$('#chat').hidden) renderChatList(); else updateChatBadge();
  updatePomoDisplays();
}
function backBtn() { return `<button class="back-btn" data-act="go" data-view="home">${ic('arrowR', 18)} رجوع للقائمة الرئيسية</button>`; }

/* ---------- main render ---------- */
function render() {
  renderDeferred = false;
  applyTheme();
  if (!authUid()) { renderLogin(); return; }
  if (!dataReady || !me()) { renderLoading(); return; }
  if (!allowed(ui.view)) { ui.view = 'home'; try { history.replaceState(null, '', '#home'); } catch (e) { /* ignore */ } }
  document.body.dataset.view = ui.view;
  $('#chatFab').hidden = !$('#chat').hidden;
  const views = { home: viewHome, send: viewSend, tasks: viewTasks, reports: viewReports, radar: viewRadar, clients: viewClients, client: viewClient, dash: viewDash, team: viewTeam, settings: viewSettings };
  let html = '';
  try { html = (views[ui.view] || viewHome)(); }
  catch (e) { console.error(e); html = `<div class="card"><div class="empty"><div class="e-ic">${ic('alert', 26)}</div><b>حصلت مشكلة في عرض الصفحة دي</b><span>ارجع للرئيسية وجرب تاني</span><div style="margin-top:16px"><button class="btn primary" data-act="go" data-view="home">الرئيسية</button></div></div></div>`; }
  $('#view').innerHTML = html;
  renderChrome();
  afterRender();
}
function afterRender() {
  if (ui.view === 'send' && ui.sendStep === 2) {
    const ta = $('#taskText');
    if (ta) { autoGrow(ta); if (matchMedia('(pointer:fine)').matches) { ta.focus(); const n = ta.value.length; ta.setSelectionRange(n, n); } }
  }
  if (ui.view === 'dash') updatePomoDisplays();
}
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 320) + 'px'; }

/* ---------- boot / login screens ---------- */
let bootError = null;   // null | {kind, missing, dbError}
let needsSetup = false;
function shellBare(viewName) {
  document.body.dataset.view = viewName;
  $('#topbar').hidden = true; $('#topbar').innerHTML = '';
  $('#bottomnav').innerHTML = '';
  $('#chatFab').hidden = true; $('#chat').hidden = true;
}
function brandPill() { return `<div class="home-pill"><span class="brand">${ic('sparkles', 18)} simple task innovalz</span><i class="dot"></i><button class="pill-ic" data-act="toggleTheme" title="الوضع الليلي">${ic(prefs.theme === 'dark' ? 'sun' : 'moon', 16)}</button></div>`; }
function renderLoading(msg) {
  shellBare('login');
  $('#view').innerHTML = `<section class="home"><div class="card login-card"><div class="loader"></div><p class="sub" style="margin:14px 0 0">${esc(msg || 'بنجهّز السيستم…')}</p></div></section>`;
}
function renderLogin() {
  shellBare('login');
  let body;
  if (bootError) {
    const e = bootError;
    let title = 'مفيش اتصال', text = 'اتأكد من النت وجرّب تاني.', extra = '';
    if (e.kind === 'missing') {
      title = 'إعدادات Supabase ناقصة في Vercel';
      text = 'ضيف المتغيرات دي في Vercel ← Project ← Settings ← Environment Variables، وبعدها اعمل Redeploy:';
      extra = `<div class="code" style="margin-top:12px">${e.missing.map(esc).join('\n')}</div>`;
    } else if (e.kind === 'tables_missing') {
      title = 'جداول قاعدة البيانات مش موجودة';
      text = 'شغّل ملف supabase-setup.sql مرة واحدة في Supabase ← SQL Editor، وبعدها اعمل تحديث للصفحة.';
    } else if (e.kind === 'no_api') {
      title = 'السيستم لازم يشتغل من Vercel';
      text = 'الملف ده محتاج يترفع على Vercel مع فولدر api عشان يتصل بقاعدة البيانات.';
    } else if (e.kind === 'db') {
      title = 'مقدرناش نوصل لقاعدة البيانات';
      text = 'اتأكد إن SUPABASE_URL والمفاتيح صح في Vercel.';
    }
    body = `<h1 style="font-size:24px">${esc(title)}</h1><p class="sub">${esc(text)}</p>${extra}<button class="btn primary" style="margin-top:18px" data-act="reload">${ic('reset', 18)} جرّب تاني</button>`;
  } else if (needsSetup) {
    body = `<h1>أول تشغيل للسيستم 🎉</h1><p class="sub">اعمل حساب المدير العام — بعد كده هتضيف الفريق من جوه السيستم</p>
      <div class="pass-box" id="passBox">
        <input class="input" id="suName" placeholder="اسمك" maxlength="50" autocomplete="name" data-key="loginPass">
        <input class="input ltr" id="loginEmail" type="email" placeholder="الإيميل" autocomplete="username" data-key="loginPass">
        <input class="input ltr" id="loginPass" type="password" placeholder="كلمة السر (6 حروف/أرقام على الأقل)" autocomplete="new-password" data-key="loginPass">
        <button class="btn primary xl" data-act="loginSubmit" style="height:56px;font-size:17px">اعمل الحساب وادخل ${ic('arrowL', 20)}</button>
      </div>`;
  } else {
    body = `<h1>أهلاً بيك 👋</h1><p class="sub">سجّل دخولك بالإيميل وكلمة السر</p>
      <div class="pass-box" id="passBox">
        <input class="input ltr" id="loginEmail" type="email" placeholder="الإيميل" autocomplete="username" inputmode="email" data-key="loginPass">
        <input class="input ltr" id="loginPass" type="password" placeholder="كلمة السر" autocomplete="current-password" data-key="loginPass">
        <button class="btn primary xl" data-act="loginSubmit" style="height:56px;font-size:17px">دخول ${ic('arrowL', 20)}</button>
        <p class="muted" style="font-size:13px">نسيت كلمة السر؟ كلّم المدير يغيّرهالك</p>
      </div>`;
  }
  $('#view').innerHTML = `<section class="home"><div class="card login-card">${brandPill()}${body}</div><div class="home-foot">simple task <b>innovalz</b></div></section>`;
  const f = $('#suName') || $('#loginEmail'); if (f && matchMedia('(pointer:fine)').matches) setTimeout(() => f.focus(), 30);
}
let loginBusy = false;
async function loginSubmit() {
  if (loginBusy || !sb) return;
  const email = ($('#loginEmail') || {}).value ? $('#loginEmail').value.trim().toLowerCase() : '';
  const pass = ($('#loginPass') || {}).value || '';
  const nameEl = $('#suName');
  const shake = () => { sound('error'); const b = $('#passBox'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } };
  if (nameEl && !nameEl.value.trim()) { toast('اكتب اسمك', 'error'); nameEl.focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('اكتب الإيميل صح', 'error'); shake(); $('#loginEmail').focus(); return; }
  if (!pass) { toast('اكتب كلمة السر', 'error'); $('#loginPass').focus(); return; }
  if (nameEl && pass.length < 6) { toast('كلمة السر لازم 6 حروف/أرقام على الأقل', 'error'); return; }
  loginBusy = true;
  const btn = $('[data-act="loginSubmit"]'); if (btn) btn.disabled = true;
  try {
    if (nameEl) {
      let r, j;
      try { r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup', name: nameEl.value.trim(), email, password: pass }) }); j = await r.json(); }
      catch (e) { toast('مفيش اتصال بالسيرفر', 'error'); return; }
      if (!r.ok || !j.ok) { toast((j && j.error) || 'حصلت مشكلة', 'error'); if (r.status === 409) { needsSetup = false; renderLogin(); } return; }
      needsSetup = false;
    }
    const err = await signIn(email, pass);
    if (err) { toast(err, 'error'); shake(); const p = $('#loginPass'); if (p) p.select(); return; }
    ui.view = 'home';
    try { history.replaceState(null, '', '#home'); } catch (e) { /* ignore */ }
    if (me()) {
      sound('tap');
      const n = myOpen().length;
      toast('أهلاً يا ' + firstName(me().name) + ' 👋', 'success', null, n ? 'عندك ' + n + ' تاسك مستنيك' : 'مفيش تاسكات مستنياك');
    }
  } finally {
    loginBusy = false;
    const b2 = $('[data-act="loginSubmit"]'); if (b2) b2.disabled = false;
  }
}
async function logout() {
  if (pending.length && !(await flush())) {
    const ok = await confirmBox({ title: 'في تعديلات لسه مترفعتش', text: 'النت فاصل — لو خرجت دلوقتي التعديلات دي مش هتتحفظ.', ok: 'اخرج برضه', danger: true });
    if (!ok) return;
  }
  pending = []; savePending();
  await signOutLocal();
}

/* ---------- home ---------- */
function viewHome() {
  const m = me();
  const open = myOpen(); const over = open.filter(isOver).length;
  const canSend = can('send_tasks');
  const chips = [];
  if (can('view_dashboard')) chips.push(`<button class="chip hl" data-act="go" data-view="dash">${ic('grid', 18)} لوحة المدير</button>`);
  if (can('view_radar')) chips.push(`<button class="chip" data-act="go" data-view="radar">${ic('layers', 18)} رادار المهام</button>`);
  if (can('view_clients')) chips.push(`<button class="chip" data-act="go" data-view="clients">${ic('building', 18)} حسابات العملاء</button>`);
  if (allowed('team')) chips.push(`<button class="chip" data-act="go" data-view="team">${ic('users', 18)} الموظفين والصلاحيات</button>`);
  if (can('manage_settings')) chips.push(`<button class="chip" data-act="go" data-view="settings">${ic('settings', 18)} الإعدادات</button>`);
  return `<section class="home"><div class="home-card">
    <div class="home-pill">
      <span class="brand">${ic('sparkles', 18)} simple task innovalz</span><i class="dot"></i>
      <span>ملف: ${esc(m.name)}</span><i class="dot"></i>
      <button class="role-link" data-act="profile">${esc(roleName(m))}</button><i class="dot"></i>
      <button class="pill-ic" data-act="toggleTheme" title="الوضع الليلي / النهاري">${ic(prefs.theme === 'dark' ? 'sun' : 'moon', 16)}</button>
      <button class="logout" data-act="logout">${ic('logout', 16)} خروج</button>
    </div>
    <h1>ماذا تريد أن تفعل الآن؟</h1>
    <p class="sub">اختر أحد الإجراءات للبدء فوراً بكل هدوء وسرعة</p>
    <div class="actions">
      <button class="action ${canSend ? '' : 'locked'}" data-act="${canSend ? 'go' : 'noPerm'}" data-view="send">
        ${canSend ? '' : `<span class="lock">${ic('lock', 18)}</span>`}
        <span class="a-ic">${ic('plusc', 30)}</span><span class="a-t"><b>ابعت تاسك</b><span>إرسال مهمة لموظف</span></span></button>
      <button class="action" data-act="go" data-view="tasks">
        ${open.length ? `<span class="count ${over ? 'red' : ''}">${open.length}</span>` : ''}
        <span class="a-ic">${ic('checksq', 30)}</span><span class="a-t"><b>تاسكاتي</b><span>متابعة وإنجاز مهامك</span></span></button>
      <button class="action" data-act="go" data-view="reports">
        <span class="a-ic">${ic('chart', 30)}</span><span class="a-t"><b>التقارير</b><span>الإحصائيات والأداء</span></span></button>
    </div>
    ${chips.length ? `<div class="admin-row"><span>بوابة الإدارة:</span>${chips.join('')}</div>` : ''}
  </div><div class="home-foot">simple task <b>innovalz</b></div></section>`;
}

/* ---------- send task ---------- */
function dueFor(kind) {
  const now = new Date(); const d = new Date(now);
  if (kind === 'today') {
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= now.getTime() + 15 * 60e3) {
      const t = new Date(now.getTime() + 60 * 60e3); t.setSeconds(0, 0);
      t.setMinutes(t.getMinutes() <= 30 ? 30 : 60);
      return t.getTime();
    }
    return d.getTime();
  }
  if (kind === '2days') { d.setDate(d.getDate() + 2); d.setHours(17, 0, 0, 0); return d.getTime(); }
  d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0); return d.getTime();
}
function currentDue() { return ui.sendKind === 'custom' && ui.sendDue ? ui.sendDue : dueFor(ui.sendKind); }
function empCard(e, opts) {
  const self = opts && opts.self;
  const del = !self && can('manage_employees') && e.id !== me().id && !isGM(e);
  return `<div class="emp-card ${self ? 'self' : ''}" role="button" tabindex="0" data-act="pickEmp" data-id="${esc(e.id)}">
    ${avatar(e)}<div class="emp-info"><b>${self ? 'أنا (تاسك لنفسي)' : esc(e.name)}</b><small>${esc(self ? 'تذكير شخصي' : (e.title || roleName(e)))}</small></div>
    ${del ? `<button class="ic-btn danger" data-act="delEmp" data-id="${esc(e.id)}" title="حذف الموظف" aria-label="حذف ${esc(e.name)}">${ic('trash', 18)}</button>` : ''}
  </div>`;
}
function viewSend() {
  if (ui.sendStep === 3) return viewSuccess();
  if (ui.sendStep === 2 && state.employees[ui.sendTo]) return viewSendStep2();
  ui.sendStep = 1;
  const m = me();
  const emps = sortedEmps().filter(e => e.id !== m.id);
  const cl = ui.sendClient && state.clients[ui.sendClient];
  return `<div class="page-head">${backBtn()}</div>
  <div class="card">
    <div class="step-head"><div><div class="step-label">الخطوة الأولى</div><h2>هتبعتها لمين؟</h2><p class="muted">اضغط على الموظف الذي تريد إسناد المهمة له</p></div>
      ${allowed('team') ? `<button class="chip" data-act="go" data-view="team">${ic('users', 18)} إدارة الموظفين</button>` : ''}</div>
    ${cl ? `<div class="client-banner"><span>🏢 التاسك هيبقى عن العميل: <b>${esc(cl.name)}</b></span><button class="ic-btn" data-act="clearSendClient" title="إلغاء">${ic('x', 16)}</button></div>` : ''}
    <div class="emp-grid">${emps.map(e => empCard(e)).join('')}${empCard(m, { self: true })}</div>
    ${emps.length ? '' : `<div class="hint info" style="margin-top:14px">مفيش موظفين لسه — ضيف موظفين من "إدارة الموظفين".</div>`}
  </div>`;
}
function dueBadge() {
  const t = currentDue();
  const lbl = { today: 'اليوم', tomorrow: 'غداً', '2days': 'بعد يومين' }[ui.sendKind];
  return lbl ? `${lbl} (${fmtTime(t)})` : fmtDue(t);
}
function viewSendStep2() {
  const e = state.employees[ui.sendTo]; const m = me();
  const isSelf = e.id === m.id; const nm = isSelf ? 'نفسك' : e.name;
  const due = currentDue(); const wd = new Date(due).getDay();
  const k = ui.sendKind;
  const clients = Object.values(state.clients).filter(c => c.status !== 'inactive' || c.id === ui.sendClient).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return `<div class="page-head">${backBtn()}<button class="link" data-act="changeEmp">تغيير الموظف</button></div>
  <div class="card send-card">
    <div class="to-row">${avatar(e)}<div><small>المهمة رايحة لـ:</small><b>${esc(isSelf ? 'أنا (تاسك لنفسي)' : e.name)}</b></div><button class="link" data-act="changeEmp">تغيير</button></div>
    <div class="field-head"><label for="taskText">اكتب التاسك المطلوب:</label><small>Enter للإرسال (أو Shift+Enter لسطر جديد)</small></div>
    <textarea id="taskText" class="ta" data-inp="taskText" data-key="taskText" placeholder="اكتب التاسك لـ ${esc(nm)}..." rows="3" maxlength="2000">${esc(ui.sendText)}</textarea>
    <div class="field-head"><label>${ic('calendar', 20)} عاوز التاسك إمته؟</label><span class="due-badge">${esc(dueBadge())}</span></div>
    ${WEEKEND.includes(wd) ? `<div class="hint warn">⚠️ الميعاد ده يوم ${DAYS[wd]} — ده يوم إجازة</div>` : ''}
    <div class="due-grid">
      <button class="due-btn ${k === 'today' ? 'on' : ''}" data-act="dueKind" data-kind="today">اليوم</button>
      <button class="due-btn ${k === 'tomorrow' ? 'on' : ''}" data-act="dueKind" data-kind="tomorrow">غداً (افتراضي)</button>
      <button class="due-btn ${k === '2days' ? 'on' : ''}" data-act="dueKind" data-kind="2days">بعد يومين</button>
      <button class="due-btn ${k === 'custom' ? 'on' : ''}" data-act="openPicker">${ic('calendar', 18)} ${k === 'custom' ? 'تاريخ مخصص ✏️' : 'تاريخ ووقت مخصص'}</button>
    </div>
    <button class="more-toggle" data-act="toggleMore">${ic(ui.sendMore ? 'minus' : 'plusc', 16)} تفاصيل إضافية (اختياري): العميل، الأولوية، رابط</button>
    ${ui.sendMore ? `<div class="more-grid">
      <label class="field"><span>العميل</span><select class="select" data-chg="sendClient"><option value="">— بدون عميل —</option>${clients.map(c => `<option value="${esc(c.id)}" ${c.id === ui.sendClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="field"><span>الأولوية</span><div class="seg"><button class="${ui.sendPriority !== 'high' ? 'on' : ''}" data-act="sendPrio" data-p="normal">عادية</button><button class="${ui.sendPriority === 'high' ? 'on' : ''}" data-act="sendPrio" data-p="high">عاجلة 🔥</button></div></div>
      <label class="field"><span>رابط / مرفق</span><input class="input ltr" data-inp="sendLink" value="${esc(ui.sendLink)}" placeholder="https://drive.google.com/..." inputmode="url"></label>
    </div>` : ''}
    <div class="send-spacer"></div>
    <button class="btn primary xl" data-act="sendTask">${ic('send', 22)} ابعت التاسك لـ ${esc(nm)} الآن 🚀</button>
  </div>`;
}
function sendTask() {
  const m = me(); const e = state.employees[ui.sendTo];
  if (!can('send_tasks')) { toast('مش معاك صلاحية إرسال تاسكات', 'error'); return; }
  if (!e) { toast('الموظف ده مش موجود', 'error'); ui.sendStep = 1; render(); return; }
  const ta = $('#taskText'); if (ta) ui.sendText = ta.value;
  const text = ui.sendText.trim();
  if (!text) { sound('error'); toast('اكتب التاسك الأول ✍️', 'error'); if (ta) ta.focus(); return; }
  const due = currentDue();
  if (ui.sendKind === 'custom' && due < Date.now()) { toast('الميعاد اللي اخترته فات — اختار ميعاد جاي', 'error'); return; }
  let link = '';
  if (ui.sendLink.trim()) { link = normUrl(ui.sendLink); if (!link) { toast('الرابط مش صحيح', 'error'); return; } }
  const task = { id: uid(), text, to: e.id, from: m.id, due, status: 'open', createdAt: Date.now(), doneAt: null, clientId: ui.sendClient && state.clients[ui.sendClient] ? ui.sendClient : '', priority: ui.sendPriority === 'high' ? 'high' : 'normal', link, deleted: false };
  save('tasks', task);
  sound('send');
  ui.lastSentTo = e.id;
  Object.assign(ui, { sendStep: 3, sendText: '', sendLink: '', sendPriority: 'normal', sendKind: 'tomorrow', sendDue: null, sendMore: false, sendClient: '' });
  render();
}
function viewSuccess() {
  const e = state.employees[ui.lastSentTo];
  const nm = e ? (e.id === me().id ? 'ليك' : 'لـ ' + e.name) : '';
  const conf = Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${COLORS[i % COLORS.length]};animation-delay:${(i % 9) * 0.07}s"></i>`).join('');
  return `<div class="page-head">${backBtn()}</div>
  <div class="card success"><div class="confetti">${conf}</div>
    <div class="big-check">${ic('check', 56)}</div>
    <h2>التاسك اتبعت بنجاح 🎉</h2>
    <p>التاسك وصل ${esc(nm)} دلوقتي</p>
    <div class="row">
      ${e ? `<button class="btn primary" data-act="sendAgain">${ic('plusc', 18)} ابعت تاسك تاني ${esc(nm)}</button>` : ''}
      <button class="btn" data-act="sendOther">${ic('users', 18)} ابعت لموظف تاني</button>
      <button class="btn ghost" data-act="go" data-view="home">${ic('home', 18)} الرجوع للرئيسية</button>
    </div>
  </div>`;
}

/* ---------- date picker ---------- */
const dp = { month: null, sel: null, time: '17:00' };
function openPicker() {
  const cur = new Date(currentDue());
  dp.sel = ymd(cur); dp.time = pad2(cur.getHours()) + ':' + pad2(cur.getMinutes());
  dp.month = new Date(cur.getFullYear(), cur.getMonth(), 1);
  openLayer('modal', `<div class="modal dp" role="dialog" aria-modal="true" id="dpBox"></div>`);
  renderPicker();
}
function renderPicker() {
  const box = $('#dpBox'); if (!box) return;
  const y = dp.month.getFullYear(), mo = dp.month.getMonth();
  const now = new Date(); const todayY = ymd(now);
  const isCurMonth = y === now.getFullYear() && mo === now.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 1) % 7; // السبت أول الأسبوع
  const days = new Date(y, mo + 1, 0).getDate();
  const wds = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
  let cells = wds.map(w => `<div class="wd">${w}</div>`).join('');
  for (let i = 0; i < offset; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const key = y + '-' + pad2(mo + 1) + '-' + pad2(d);
    const past = key < todayY;
    const wk = WEEKEND.includes(new Date(y, mo, d).getDay());
    cells += `<button class="dp-day ${key === todayY ? 'today' : ''} ${key === dp.sel ? 'sel' : ''} ${wk ? 'wk' : ''}" data-act="dpDay" data-d="${key}" ${past ? 'disabled' : ''}>${d}</button>`;
  }
  const quick = [['12:00', '12:00 ظهراً'], ['15:00', '3:00 عصراً'], ['17:00', '5:00 م<br>(دوام)'], ['20:00', '8:00 مساءً']];
  box.innerHTML = `<div class="dp-head"><b>${ic('calendar', 22)} ${MONTHS[mo]} ${y}</b>
      <div class="dp-nav"><button data-act="dpPrev" ${isCurMonth ? 'disabled' : ''} aria-label="الشهر اللي فات">${ic('chevL', 18)}</button><button data-act="dpNext" aria-label="الشهر الجاي">${ic('chevR', 18)}</button></div></div>
    <div class="dp-grid">${cells}</div>
    <div class="dp-time"><div class="dp-time-h"><label for="dpTimeIn">${ic('clock', 20)} وقت التسليم المطلوب:</label><input type="time" id="dpTimeIn" value="${dp.time}" data-chg="dpTime"></div>
      <div class="dp-quick">${quick.map(q => `<button class="${dp.time === q[0] ? 'on' : ''}" data-act="dpQuick" data-t="${q[0]}">${q[1]}</button>`).join('')}</div></div>
    <div class="modal-f"><button class="btn primary xl" data-act="dpConfirm" style="height:54px;font-size:17px">${ic('check', 20)} تأكيد الموعد واختياره ✓</button></div>`;
}
function dpConfirm() {
  const tIn = $('#dpTimeIn'); if (tIn && tIn.value) dp.time = tIn.value;
  const base = parseYMD(dp.sel);
  const tm = String(dp.time || '').split(':').map(Number);
  if (isNaN(base) || tm.length < 2 || tm.some(isNaN)) { toast('اختار اليوم والوقت', 'error'); return; }
  const d = new Date(base); d.setHours(tm[0], tm[1], 0, 0);
  if (d.getTime() <= Date.now()) { toast('الوقت ده فات — اختار وقت جاي', 'error'); return; }
  const ta = $('#taskText'); if (ta) ui.sendText = ta.value;
  ui.sendKind = 'custom'; ui.sendDue = d.getTime();
  closeLayer('modal'); render();
}

/* ---------- tasks ---------- */
function statusTag(t) {
  if (t.status === 'done') return '<span class="tag ok">منجزة ✓</span>';
  if (isOver(t)) return '<span class="tag bad">متأخرة</span>';
  return '<span class="tag run">جارية</span>';
}
function taskItem(t, ctx) {
  const m = me(); const done = t.status === 'done'; const over = isOver(t);
  const canC = canComplete(t), canD = canDeleteTask(t);
  let who;
  if (ctx === 'mine' || ctx === 'done' || ctx === 'mini') who = t.from === m.id ? 'تاسك لنفسك' : 'من: ' + empName(t.from);
  else if (ctx === 'sent') who = 'لـ: ' + empName(t.to);
  else who = empName(t.to) + ' · من ' + empName(t.from);
  const cl = t.clientId && state.clients[t.clientId];
  const clTag = cl ? (can('view_clients') ? `<button class="tag" data-act="openClient" data-id="${esc(cl.id)}">🏢 ${esc(cl.name)}</button>` : `<span class="tag">🏢 ${esc(cl.name)}</span>`) : '';
  const chk = canC
    ? `<button class="chk ${done ? 'on' : ''}" data-act="${done ? 'reopenTask' : 'doneTask'}" data-id="${esc(t.id)}" title="${done ? 'إعادة فتح التاسك' : 'خلّصتها ✓'}" aria-label="${done ? 'إعادة فتح' : 'إنهاء التاسك'}">${ic('check', 18)}</button>`
    : `<span class="chk ghost ${done ? 'on' : ''}">${ic('check', 18)}</span>`;
  return `<div class="task ${over ? 'over' : ''} ${done ? 'done' : ''}">
    ${chk}
    <div class="t-body"><div class="t-text">${linkify(t.text)}</div>
      <div class="t-meta"><span>${esc(who)}</span>
        <span class="due ${over ? 'red' : ''}">${ic('clock', 14)} ${done ? 'اتسلّمت ' + esc(fmtDue(t.doneAt || t.due)) : esc(fmtDue(t.due))}${over ? ' · متأخرة' : ''}</span>
        ${t.priority === 'high' ? '<span class="tag hot">عاجلة 🔥</span>' : ''}${clTag}
        ${t.link ? `<button class="tag blue" data-act="openUrl" data-url="${esc(t.link)}">${ic('link', 13)} المرفق</button>` : ''}
        ${ctx === 'sent' || ctx === 'team' || ctx === 'client' ? statusTag(t) : ''}
      </div></div>
    <div class="t-actions">${canD && ctx !== 'mini' ? `<button class="ic-btn danger" data-act="delTask" data-id="${esc(t.id)}" title="حذف" aria-label="حذف التاسك">${ic('trash', 17)}</button>` : ''}</div>
  </div>`;
}
function taskListHTML(arr, ctx, empty) {
  if (!arr.length) return `<div class="empty"><div class="e-ic">${ic(empty.icon || 'checksq', 26)}</div><b>${empty.title}</b><span>${empty.sub || ''}</span></div>`;
  const shown = arr.slice(0, ui.limit);
  return `<div class="task-list">${shown.map(t => taskItem(t, ctx)).join('')}</div>${arr.length > shown.length ? `<div class="load-more"><button class="btn ghost" data-act="more">عرض المزيد (${arr.length - shown.length})</button></div>` : ''}`;
}
function viewTasks() {
  const m = me(); const all = liveTasks();
  const mine = all.filter(t => t.to === m.id && t.status === 'open').sort((a, b) => a.due - b.due);
  const done = all.filter(t => t.to === m.id && t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const sent = sortTasks(all.filter(t => t.from === m.id && t.to !== m.id));
  const canTeam = can('view_team_tasks');
  if (ui.tasksTab === 'team' && !canTeam) ui.tasksTab = 'mine';
  const tabs = [['mine', `مطلوبة مني (${mine.length})`], ['done', `أنجزتها (${done.length})`], ['sent', `أرسلتها أنا (${sent.length})`]];
  if (canTeam) tabs.push(['team', `كل مهام الفريق (${all.length})`]);
  let content = '';
  if (ui.tasksTab === 'mine') content = taskListHTML(mine, 'mine', { title: 'مفيش تاسكات مطلوبة منك حالياً! 🎉', sub: 'شغلك تمام وكل المهام منتهية' });
  else if (ui.tasksTab === 'done') content = taskListHTML(done, 'done', { title: 'لسه مخلصتش تاسكات', sub: 'أول ما تخلص تاسك هيظهر هنا' });
  else if (ui.tasksTab === 'sent') content = taskListHTML(sent, 'sent', { title: 'مبعتش تاسكات لحد لسه', sub: 'اضغط "ابعت تاسك جديد" عشان تبدأ', icon: 'send' });
  else {
    let arr = all;
    if (ui.teamEmp !== 'all') arr = arr.filter(t => t.to === ui.teamEmp);
    if (ui.teamStatus === 'open') arr = arr.filter(t => t.status === 'open');
    else if (ui.teamStatus === 'over') arr = arr.filter(isOver);
    else if (ui.teamStatus === 'done') arr = arr.filter(t => t.status === 'done');
    content = `<div class="filters">
      <select class="select sm" style="max-width:240px" data-chg="teamEmp"><option value="all">كل الفريق</option>${sortedEmps().map(e => `<option value="${esc(e.id)}" ${ui.teamEmp === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      <div class="seg">${[['open', 'جارية'], ['over', 'متأخرة'], ['done', 'منجزة'], ['all', 'الكل']].map(s => `<button class="${ui.teamStatus === s[0] ? 'on' : ''}" data-act="teamStatus" data-s="${s[0]}">${s[1]}</button>`).join('')}</div>
    </div>` + taskListHTML(sortTasks(arr), 'team', { title: 'مفيش تاسكات هنا', sub: 'غيّر الفلتر لو بتدور على حاجة' });
  }
  return `<div class="page-head">${backBtn()}${can('send_tasks') ? `<button class="link" data-act="go" data-view="send">+ ابعت تاسك جديد</button>` : ''}</div>
  <div class="card">
    <div class="title-row" style="align-items:center"><div><h2>تاسكاتي وأعمالي</h2><p>مهامك الخاصة وتكليفاتك المباشرة فقط</p></div>
      <div class="tabs">${tabs.map(t => `<button class="${ui.tasksTab === t[0] ? 'on' : ''}" data-act="tasksTab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div></div>
    ${content}
  </div>`;
}
function completeTask(id) {
  const t = state.tasks[id];
  if (!t || t.deleted || !canComplete(t)) return;
  if (t.status === 'done') return;
  t.status = 'done'; t.doneAt = Date.now(); t.doneBy = me().id;
  save('tasks', t); sound('done');
  toast('برافو! خلّصت التاسك 🎉', 'success', { label: 'تراجع', fn: () => reopenTask(id, true) });
}
function reopenTask(id, silent) {
  const t = state.tasks[id];
  if (!t || !canComplete(t)) return;
  t.status = 'open'; t.doneAt = null; t.doneBy = null;
  save('tasks', t);
  if (!silent) toast('التاسك اتفتح تاني', 'info');
}
async function deleteTask(id) {
  const t = state.tasks[id];
  if (!t || !canDeleteTask(t)) return;
  const r = await confirmBox({ title: 'حذف التاسك؟', text: 'التاسك هيروح سلة المحذوفات والمدير العام يقدر يرجّعه.', ok: 'احذف', danger: true, input: { label: 'سبب الحذف (اختياري)', placeholder: 'مثلاً: اتلغى من العميل' } });
  if (!r) return;
  const cur = state.tasks[id]; if (!cur) return;
  cur.deleted = true; cur.deletedAt = Date.now(); cur.deletedBy = me().id; cur.deleteReason = r.value.trim();
  save('tasks', cur);
  toast('التاسك اتنقل لسلة المحذوفات', 'success', { label: 'تراجع', fn: () => { const x = state.tasks[id]; if (x) { x.deleted = false; x.deletedAt = null; x.deletedBy = null; x.deleteReason = ''; save('tasks', x); } } });
}
