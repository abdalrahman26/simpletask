/* =========================================================
   Chat + event handlers + boot
   ========================================================= */
function chatReadKey() { const m = me(); return m ? 'mynd_chatread_' + m.id : ''; }
function chatUnread() {
  const m = me(); if (!m) return 0;
  const last = Number(LS.get(chatReadKey(), 0)) || 0;
  return Object.values(state.chat).filter(x => x.from !== m.id && x.at > last).length;
}
function updateChatBadge() {
  const b = $('#chatBadge'); if (!b) return;
  const n = me() ? chatUnread() : 0;
  b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
}
function chatOpen() {
  if (!me()) return;
  $('#chat').hidden = false; $('#chatFab').hidden = true;
  renderChatList();
  setTimeout(() => { const i = $('#chatInput'); if (i && matchMedia('(pointer:fine)').matches) i.focus(); }, 50);
}
function chatClose() { const c = $('#chat'); if (c) c.hidden = true; const f = $('#chatFab'); if (f) f.hidden = !me(); updateChatBadge(); }
function renderChatList() {
  const list = $('#chatList'); if (!list || $('#chat').hidden) { updateChatBadge(); return; }
  const m = me(); if (!m) return;
  const msgs = Object.values(state.chat).sort((a, b) => a.at - b.at).slice(-150);
  const sig = msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : '') + ':' + (prefs.theme);
  if (list.dataset.sig === sig) { updateChatBadge(); return; }
  list.dataset.sig = sig;
  let lastDay = '';
  const html = msgs.map(x => {
    const mine = x.from === m.id; const e = state.employees[x.from];
    const day = ymd(x.at); let sep = '';
    if (day !== lastDay) { lastDay = day; sep = `<div class="chat-day">${esc(fmtDay(x.at))}</div>`; }
    const canDel = mine || isGM();
    return sep + `<div class="msg ${mine ? 'mine' : 'other'}">${mine ? '' : avatar(e || { name: '؟' }, 'sm')}
      <div class="msg-body"><div class="msg-who">${mine ? 'أنت' : esc(empName(x.from))} <span class="tag">${esc(e ? roleName(e) : '')}</span></div>
        <div class="bubble">${linkify(x.text)}</div>
        <div class="msg-time">${esc(fmtTime(x.at))}${canDel ? `<button data-act="chatDel" data-id="${esc(x.id)}" title="حذف الرسالة" aria-label="حذف">${ic('trash', 13)}</button>` : ''}</div></div>
      ${mine ? avatar(e || m, 'sm') : ''}</div>`;
  }).join('');
  list.innerHTML = html || `<div class="empty" style="padding:40px 10px"><div class="e-ic">${ic('chat', 24)}</div><b>ابدأ الكلام مع الفريق 👋</b><span>الرسائل بتوصل لكل الفريق</span></div>`;
  list.scrollTop = list.scrollHeight;
  if (msgs.length) LS.set(chatReadKey(), Math.max(Date.now(), msgs[msgs.length - 1].at));
  updateChatBadge();
}
function chatSend() {
  const m = me(); const inp = $('#chatInput'); if (!m || !inp) return;
  const text = inp.value.trim(); if (!text) return;
  if (text.length > 1000) { toast('الرسالة طويلة أوي', 'error'); return; }
  const msg = { id: uid(), from: m.id, text, at: Date.now() };
  inp.value = '';
  save('chat', msg); sound('send');
  renderChatList();
}

/* ---------- handlers ---------- */
const H = {
  go: el => go(el.dataset.view),
  noPerm: () => toast('مش معاك صلاحية إرسال تاسكات — اطلبها من مديرك 🔒', 'error'),
  closeLayer: el => closeLayer(el.dataset.layer),
  logout: () => logout(),
  profile: () => openProfile(),
  toggleTheme: () => { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); if (!me()) { renderLogin(); return; } render(); if ($('#pfOld')) openProfile(); },
  toggleSound: () => { prefs.sound = !prefs.sound; savePrefs(); if (prefs.sound) sound('tap'); toast(prefs.sound ? 'الصوت اشتغل 🔔' : 'الصوت اتقفل 🔕', 'info'); if (me()) { renderChrome(); if ($('#pfOld')) openProfile(); } },
  enableNotif: async () => {
    try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'إشعارات المتصفح اشتغلت ✅' : 'المتصفح رفض الإشعارات — فعّلها من إعدادات المتصفح', r === 'granted' ? 'success' : 'error'); }
    catch (e) { toast('المتصفح ده مش بيدعم الإشعارات', 'error'); }
    if ($('#modal').classList.contains('open')) openProfile();
  },
  cloudInfo: () => { toast(cloudLabel(), cloudState === 'live' ? 'success' : 'info', can('manage_settings') ? { label: 'الإعدادات', fn: () => go('settings') } : null); },
  reload: () => location.reload(),
  openSent: () => { ui.tasksTab = 'sent'; go('tasks'); },
  loginSubmit: () => loginSubmit(),
  /* send */
  pickEmp: el => { if (!state.employees[el.dataset.id]) return; ui.sendTo = el.dataset.id; ui.sendStep = 2; if (ui.sendClient) ui.sendMore = true; render(); },
  changeEmp: () => { const ta = $('#taskText'); if (ta) ui.sendText = ta.value; ui.sendStep = 1; render(); },
  delEmp: el => delEmp(el.dataset.id),
  dueKind: el => { const ta = $('#taskText'); if (ta) ui.sendText = ta.value; ui.sendKind = el.dataset.kind; ui.sendDue = null; render(); },
  openPicker: () => { const ta = $('#taskText'); if (ta) ui.sendText = ta.value; openPicker(); },
  toggleMore: () => { const ta = $('#taskText'); if (ta) ui.sendText = ta.value; ui.sendMore = !ui.sendMore; render(); },
  sendPrio: el => { const ta = $('#taskText'); if (ta) ui.sendText = ta.value; ui.sendPriority = el.dataset.p; render(); },
  clearSendClient: () => { ui.sendClient = ''; render(); },
  sendTask: () => sendTask(),
  sendAgain: () => { if (!state.employees[ui.lastSentTo]) { ui.sendStep = 1; } else { ui.sendTo = ui.lastSentTo; ui.sendStep = 2; } render(); },
  sendOther: () => { resetSend(); render(); },
  sendForClient: el => { resetSend(); ui.sendClient = el.dataset.id; ui.sendMore = true; go('send', { keep: true }); },
  /* date picker */
  dpPrev: () => { dp.month = new Date(dp.month.getFullYear(), dp.month.getMonth() - 1, 1); renderPicker(); },
  dpNext: () => { dp.month = new Date(dp.month.getFullYear(), dp.month.getMonth() + 1, 1); renderPicker(); },
  dpDay: el => { const t = $('#dpTimeIn'); if (t && t.value) dp.time = t.value; dp.sel = el.dataset.d; renderPicker(); },
  dpQuick: el => { dp.time = el.dataset.t; renderPicker(); },
  dpConfirm: () => dpConfirm(),
  /* tasks */
  tasksTab: el => { ui.tasksTab = el.dataset.tab; ui.limit = 40; render(); },
  teamStatus: el => { ui.teamStatus = el.dataset.s; ui.limit = 40; render(); },
  doneTask: el => completeTask(el.dataset.id),
  reopenTask: el => reopenTask(el.dataset.id),
  delTask: el => deleteTask(el.dataset.id),
  more: () => { ui.limit += 40; render(); },
  openUrl: el => openBrowser(el.dataset.url),
  /* reports */
  reportsRange: el => { ui.reportsRange = el.dataset.r; render(); },
  export: el => runExport(el.dataset.kind),
  /* radar */
  radarTab: el => { ui.radarTab = el.dataset.tab; ui.limit = 40; render(); },
  radarPick: el => { ui.radarEmp = ui.radarEmp === el.dataset.id ? 'all' : el.dataset.id; render(); },
  restoreTask: el => { if (!can('manage_trash')) return; const t = state.tasks[el.dataset.id]; if (!t) return; t.deleted = false; t.deletedAt = null; t.deletedBy = null; t.deleteReason = ''; save('tasks', t); toast('التاسك رجع ✅'); },
  purgeTask: async el => { if (!can('manage_trash')) return; const ok = await confirmBox({ title: 'حذف نهائي؟', text: 'مش هيقدر يرجع تاني.', ok: 'احذف نهائياً', danger: true }); if (ok) { removeRow('tasks', el.dataset.id); toast('اتحذف نهائياً'); } },
  emptyTrash: async () => { if (!can('manage_trash')) return; const ids = Object.values(state.tasks).filter(t => t.deleted).map(t => t.id); if (!ids.length) return; const ok = await confirmBox({ title: `تفريغ السلة (${ids.length})؟`, text: 'كل التاسكات المحذوفة هتتمسح نهائياً.', ok: 'فرّغ السلة', danger: true }); if (ok) { ids.forEach(id => removeRow('tasks', id)); toast('السلة اتفرغت'); } },
  /* clients */
  openClient: el => { if (!can('view_clients') || !state.clients[el.dataset.id]) return; closeLayer('modal'); ui.clientId = el.dataset.id; go('client'); },
  clientForm: el => clientForm(el.dataset.id || null),
  saveClient: el => saveClient(el.dataset.id || null),
  delClient: async el => {
    const c = state.clients[el.dataset.id]; if (!c || !can('manage_clients')) return;
    const ok = await confirmBox({ title: 'حذف ' + c.name + '؟', text: 'العميل وسجل أحداثه هيتمسحوا. التاسكات المرتبطة بيه هتفضل موجودة.', ok: 'احذف العميل', danger: true });
    if (!ok) return;
    Object.values(state.events).filter(e => e.clientId === c.id).forEach(e => removeRow('events', e.id));
    removeRow('clients', c.id); ui.view = 'clients'; render(); toast('العميل اتحذف');
  },
  addEvent: el => {
    const note = $('#evNote').value.trim(); const date = $('#evDate').value || ymd(Date.now());
    const type = $('#evType').value;
    if (!note) { toast('اكتب تفاصيل الحدث', 'error'); $('#evNote').focus(); return; }
    save('events', { id: uid(), clientId: el.dataset.id, type, date, note, by: me().id, createdAt: Date.now() });
    toast('الحدث اتسجل ✅');
  },
  delEvent: async el => { const ev = state.events[el.dataset.id]; if (!ev || !(ev.by === me().id || can('manage_clients'))) return; const ok = await confirmBox({ title: 'حذف الحدث؟', ok: 'احذف', danger: true }); if (ok) removeRow('events', ev.id); },
  /* checklist */
  clAdd: () => { const items = checklistToday(); items.push({ t: '', d: false, n: '' }); saveChecklist(items); },
  clDel: el => { const items = checklistToday(); items.splice(Number(el.dataset.i), 1); saveChecklist(items); },
  clNote: async el => {
    const i = Number(el.dataset.i); const items = checklistToday(); if (!items[i]) return;
    const res = await confirmBox({ title: 'ملاحظة', input: { label: 'اكتب ملاحظتك', placeholder: 'ملاحظة على البند…', value: items[i].n || '' }, ok: 'حفظ' });
    if (res) { items[i].n = res.value.trim(); saveChecklist(items); }
  },
  /* dashboard */
  dashTab: el => { ui.dashTab = el.dataset.tab; render(); },
  pomoToggle: () => pomoToggle(),
  pomoReset: () => pomoReset(),
  pomoSkip: () => pomoSkip(),
  pomoMode: el => pomoSetMode(el.dataset.mode),
  /* team */
  teamTab: el => { ui.teamTab = el.dataset.tab; render(); },
  empForm: el => empForm(el.dataset.id || null),
  saveEmp: el => saveEmp(el.dataset.id || null, el),
  roleForm: el => roleForm(el.dataset.id || null),
  saveRole: el => saveRole(el.dataset.id || null, el),
  delRole: el => delRole(el.dataset.id),
  changePass: el => changePass(el),
  /* settings */
  cloudResync: async () => { const ok = await syncAll(); toast(ok ? 'اتزامن ✅' : 'المزامنة فشلت — اتأكد من النت', ok ? 'success' : 'error'); },
  backup: () => backup(),
  /* chat */
  chatToggle: () => { if ($('#chat').hidden) chatOpen(); else chatClose(); },
  chatClose: () => chatClose(),
  chatSend: () => chatSend(),
  chatEmoji: el => { const i = $('#chatInput'); if (!i) return; const s = i.selectionStart == null ? i.value.length : i.selectionStart; i.value = i.value.slice(0, s) + el.dataset.e + i.value.slice(i.selectionEnd == null ? s : i.selectionEnd); i.focus(); const p = s + el.dataset.e.length; try { i.setSelectionRange(p, p); } catch (e) { /* ignore */ } },
  chatDel: async el => { const x = state.chat[el.dataset.id]; if (!x || !(x.from === me().id || isGM())) return; removeRow('chat', x.id); renderChatList(); }
};
const C = {
  sendClient: el => { ui.sendClient = el.value; },
  teamEmp: el => { ui.teamEmp = el.value; ui.limit = 40; render(); },
  radarEmp: el => { ui.radarEmp = el.value; render(); },
  dpTime: el => { if (el.value) { dp.time = el.value; $$('.dp-quick button').forEach(b => b.classList.toggle('on', b.dataset.t === dp.time)); } },
  pomoTask: el => { const p = pomo(); if (p) { p.taskId = el.value; savePomo(); } },
  prioText: el => { const i = Number(el.dataset.i); const cur = prioToday()[i]; const t = el.value.trim(); if (t === cur.t) return; savePrio(i, { t, d: t ? cur.d : false }); },
  prioDone: el => { const i = Number(el.dataset.i); savePrio(i, { d: el.checked }); if (el.checked) sound('done'); },
  clText: el => { const i = Number(el.dataset.i); const items = checklistToday(); if (!items[i]) return; const t = el.value.trim(); if (t === items[i].t) return; items[i].t = t; saveChecklist(items); },
  clDone: el => { const i = Number(el.dataset.i); const items = checklistToday(); if (!items[i]) return; items[i].d = el.checked; saveChecklist(items); if (el.checked) sound('done'); },
};
const I = {
  taskText: el => { ui.sendText = el.value; autoGrow(el); },
  sendLink: el => { ui.sendLink = el.value; },
  clientQ: el => { ui.clientQ = el.value; debounceRender(); },
};
const K = {
  taskText: (el, e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ui.sendText = el.value; sendTask(); } },
  loginPass: (el, e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (el.id === 'loginPass') loginSubmit(); else { const n = el.id === 'suName' ? $('#loginEmail') : $('#loginPass'); if (n) n.focus(); } } },
  prioText: (el, e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); el.blur(); } },
  clText: (el, e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); el.blur(); } },
  chatInput: (el, e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); chatSend(); } }
};
let searchTimer = null;
function debounceRender() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const a = document.activeElement; const key = a && a.dataset ? a.dataset.inp : null; const pos = a && a.selectionStart;
    render();
    if (key) { const n = $(`[data-inp="${key}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }
  }, 220);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = H[el.dataset.act]; if (!fn) return;
  e.preventDefault();
  try { const r = fn(el, e); if (r && r.catch) r.catch(err => { console.error(err); toast('حصلت مشكلة، جرّب تاني', 'error'); }); }
  catch (err) { console.error(err); toast('حصلت مشكلة، جرّب تاني', 'error'); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && C[el.dataset.chg]) { try { C[el.dataset.chg](el, e); } catch (err) { console.error(err); } } });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && I[el.dataset.inp]) I[el.dataset.inp](el, e); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (closeTop()) e.preventDefault(); return; }
  const el = e.target.closest && e.target.closest('[data-key]');
  if (el && K[el.dataset.key]) { K[el.dataset.key](el, e); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});

/* ---------- clock ---------- */
let lastMinute = new Date().getMinutes();
setInterval(() => {
  if (!me()) return;
  const p = pomo();
  if (p && p.running && Date.now() >= p.endAt) pomoComplete();
  updatePomoDisplays();
  const mn = new Date().getMinutes();
  if (mn !== lastMinute) {
    lastMinute = mn;
    if (['tasks', 'radar', 'dash', 'client', 'home'].includes(ui.view) && !$$('.layer.open').length) scheduleRender();
  }
}, 250);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && me()) { updatePomoDisplays(); scheduleRender(); } });

/* ---------- boot ---------- */
window.addEventListener('storage', e => {
  if (e.key === PREFS_KEY) { prefs = Object.assign({ theme: 'light', sound: true }, LS.get(PREFS_KEY, {})); applyTheme(); scheduleRender(); }
});
async function boot() {
  applyTheme();
  renderLoading();
  try {
    cfg = await fetchConfig();
  } catch (e) {
    bootError = { kind: e.kind === 'no_api' ? 'no_api' : 'net' }; renderLogin(); return;
  }
  if (cfg.missing && cfg.missing.length) { bootError = { kind: 'missing', missing: cfg.missing }; renderLogin(); return; }
  if (cfg.dbError) { bootError = { kind: cfg.dbError === 'tables_missing' ? 'tables_missing' : 'db' }; renderLogin(); return; }
  needsSetup = !!cfg.needsSetup;
  try { sb = await makeClient(); }
  catch (e) { bootError = { kind: 'net' }; renderLogin(); return; }
  const h = (location.hash || '').slice(1);
  if (h && h in VIEW_PERM && h !== 'client') ui.view = h;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { if (authSession) { authSession = null; setTimeout(() => signOutLocal(), 0); } }
    else if (session && authSession && session.user && session.user.id === authSession.user.id) { authSession = session; }
  });
  let session = null;
  try { const r = await sb.auth.getSession(); session = r.data && r.data.session; } catch (e) { session = null; }
  if (session) await startSession(session);
  else renderLogin();
}
boot();
