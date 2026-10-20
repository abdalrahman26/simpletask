/* =========================================================
   Marketing & operations manager dashboard + Pomodoro
   ========================================================= */
/* ---------- pomodoro ---------- */
let pomoCache = null, pomoUid = null;
function pomo() {
  const m = me(); if (!m) return null;
  if (pomoUid !== m.id || !pomoCache) {
    pomoUid = m.id;
    pomoCache = Object.assign({ mode: 'focus', running: false, endAt: null, remaining: POMO_DUR.focus * 60, taskId: '', cycle: 0, log: {} }, LS.get('mynd_pomo_' + m.id, {}));
    if (!POMO_DUR[pomoCache.mode]) pomoCache.mode = 'focus';
    if (!pomoCache.log || typeof pomoCache.log !== 'object') pomoCache.log = {};
  }
  return pomoCache;
}
function savePomo() {
  const m = me(); if (!m || !pomoCache) return;
  const keys = Object.keys(pomoCache.log).sort();
  while (keys.length > 31) delete pomoCache.log[keys.shift()];
  LS.set('mynd_pomo_' + m.id, pomoCache);
}
function pomoLeft(p) { return p.running ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000)) : Math.max(0, p.remaining); }
function mmss(s) { return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); }
function pomoToday(p) { return p.log[ymd(Date.now())] || { s: 0, m: 0 }; }
function pomoHTML() {
  const p = pomo(); const t = pomoToday(p);
  const tasks = myOpen();
  if (p.taskId && !tasks.some(x => x.id === p.taskId)) p.taskId = '';
  return `<div class="card pomo m-${p.mode}" id="pomoCard">
    <div class="card-h"><h3>🍅 بومودورو</h3><span class="muted" style="font-size:14px">${t.s} جلسات · ${t.m} دقيقة تركيز النهارده</span></div>
    <div class="pomo-modes">${['focus', 'short', 'long'].map(k => `<button class="${p.mode === k ? 'on' : ''}" data-act="pomoMode" data-mode="${k}">${{ focus: 'تركيز', short: 'راحة قصيرة', long: 'راحة طويلة' }[k]} ${POMO_DUR[k]}</button>`).join('')}</div>
    <div class="pomo-ring"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="88"></circle><circle class="fg" id="pomoArc" cx="100" cy="100" r="88" stroke-dasharray="552.92" stroke-dashoffset="0"></circle></svg>
      <div class="pomo-center"><div class="pomo-time" id="pomoTime">${mmss(pomoLeft(p))}</div><small>${POMO_LABEL[p.mode]}</small></div></div>
    <div class="pomo-ctrl">
      <button class="ic-btn" data-act="pomoReset" title="إعادة">${ic('reset', 20)}</button>
      <button class="pomo-play" id="pomoPlay" data-act="pomoToggle" title="${p.running ? 'إيقاف مؤقت' : 'ابدأ'}">${ic(p.running ? 'pause' : 'play', 30)}</button>
      <button class="ic-btn" data-act="pomoSkip" title="تخطي">${ic('skip', 20)}</button>
    </div>
    <label class="field"><span>بشتغل على:</span><select class="select" data-chg="pomoTask"><option value="">— اختار تاسك (اختياري) —</option>${tasks.map(x => `<option value="${esc(x.id)}" ${p.taskId === x.id ? 'selected' : ''}>${esc(x.text.slice(0, 70))}</option>`).join('')}</select></label>
    <div class="pomo-dots" title="كل 4 جلسات تركيز = راحة طويلة">${[0, 1, 2, 3].map(i => `<i class="${i < (p.cycle % 4) ? 'on' : ''}"></i>`).join('')}</div>
  </div>`;
}
function updatePomoDisplays() {
  const m = me();
  const mini = $('#pomoMini');
  if (!m) { document.title = BASE_TITLE; if (mini) mini.hidden = true; return; }
  const p = pomo(); const left = pomoLeft(p);
  const tEl = $('#pomoTime'); if (tEl) tEl.textContent = mmss(left);
  const arc = $('#pomoArc');
  if (arc) { const total = POMO_DUR[p.mode] * 60; arc.setAttribute('stroke-dashoffset', String(552.92 * (1 - left / total))); }
  if (mini) {
    const show = p.running && ui.view !== 'dash' && can('view_dashboard');
    mini.hidden = !show;
    if (show) { mini.textContent = (p.mode === 'focus' ? '🍅 ' : '☕ ') + mmss(left); mini.classList.toggle('break', p.mode !== 'focus'); }
  }
  document.title = p.running ? `${mmss(left)} ${p.mode === 'focus' ? '🍅' : '☕'} — ${BASE_TITLE}` : BASE_TITLE;
}
function pomoToggle() {
  const p = pomo(); if (!p) return;
  if (p.running) { p.remaining = pomoLeft(p); p.running = false; p.endAt = null; }
  else { if (p.remaining <= 0) p.remaining = POMO_DUR[p.mode] * 60; p.endAt = Date.now() + p.remaining * 1000; p.running = true; sound('tap'); }
  savePomo(); refreshPomoCard();
}
function pomoSetMode(mode) {
  const p = pomo(); if (!p || !POMO_DUR[mode]) return;
  p.mode = mode; p.running = false; p.endAt = null; p.remaining = POMO_DUR[mode] * 60;
  savePomo(); refreshPomoCard();
}
function pomoReset() { const p = pomo(); if (!p) return; pomoSetMode(p.mode); }
function pomoNext(p, countFocus) {
  if (p.mode === 'focus') {
    if (countFocus) { const k = ymd(Date.now()); const l = p.log[k] || { s: 0, m: 0 }; l.s += 1; l.m += POMO_DUR.focus; p.log[k] = l; }
    p.cycle += 1; p.mode = p.cycle % 4 === 0 ? 'long' : 'short';
  } else p.mode = 'focus';
  p.running = false; p.endAt = null; p.remaining = POMO_DUR[p.mode] * 60;
}
function pomoSkip() { const p = pomo(); if (!p) return; pomoNext(p, false); savePomo(); refreshPomoCard(); }
function pomoComplete() {
  const p = pomo(); if (!p) return;
  const was = p.mode; const taskId = p.taskId;
  pomoNext(p, true); savePomo();
  sound('pomo');
  if (was === 'focus') {
    const t = taskId && state.tasks[taskId] && state.tasks[taskId].status === 'open' ? state.tasks[taskId] : null;
    toast('🍅 جلسة تركيز خلصت! خد راحة ' + POMO_DUR[p.mode] + ' دقايق', 'success', t ? { label: '✓ خلّصت التاسك', fn: () => completeTask(t.id) } : null, t ? t.text : '');
    browserNotify('جلسة التركيز خلصت 🍅', 'خد راحة ' + POMO_DUR[p.mode] + ' دقايق');
  } else {
    toast('☕ الراحة خلصت — يلا جلسة تركيز جديدة', 'info');
    browserNotify('الراحة خلصت ☕', 'يلا جلسة تركيز جديدة');
  }
  refreshPomoCard();
}
function refreshPomoCard() {
  const card = $('#pomoCard');
  if (card && !(card.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) { card.outerHTML = pomoHTML(); }
  updatePomoDisplays();
}

/* ---------- daily priorities ---------- */
function prioRow() { const m = me(); return state.settings['prio_' + m.id] || { id: 'prio_' + m.id, days: {} }; }
function prioToday() { const r = prioRow(); const k = ymd(Date.now()); const arr = (r.days && r.days[k]) || []; return [0, 1, 2].map(i => arr[i] || { t: '', d: false }); }
function savePrio(i, patch) {
  const r = JSON.parse(JSON.stringify(prioRow())); r.days = r.days || {};
  const k = ymd(Date.now()); const arr = prioToday(); arr[i] = Object.assign({}, arr[i], patch); r.days[k] = arr;
  const keys = Object.keys(r.days).sort(); while (keys.length > 14) delete r.days[keys.shift()];
  save('settings', r);
}

/* ---------- daily checklist ---------- */
function checklistRow() { const m = me(); return state.settings['checklist_' + m.id] || { id: 'checklist_' + m.id, days: {} }; }
function checklistToday() { const r = checklistRow(); const k = ymd(Date.now()); return (r.days && r.days[k]) || []; }
function saveChecklist(items) {
  const r = JSON.parse(JSON.stringify(checklistRow())); r.days = r.days || {};
  const k = ymd(Date.now()); r.days[k] = items;
  const keys = Object.keys(r.days).sort(); while (keys.length > 14) delete r.days[keys.shift()];
  save('settings', r);
}
function checklistHTML() {
  const items = checklistToday();
  const doneCount = items.filter(x => x.d).length;
  return `<div class="card pad-sm" id="checklistCard"><div class="card-h" style="margin-bottom:8px"><h3>📋 تشيك ليست يومية</h3><span class="muted" style="font-size:13px">${doneCount}/${items.length}</span></div>
    <div class="checklist">
      ${items.map((item, i) => `<div class="cl-item ${item.d ? 'done' : ''}">
        <input type="checkbox" ${item.d ? 'checked' : ''} data-chg="clDone" data-i="${i}" aria-label="خلصت">
        <input type="text" class="cl-text" value="${esc(item.t)}" placeholder="اكتب المهمة…" data-chg="clText" data-i="${i}" data-key="clText" maxlength="200">
        <button class="ic-btn sm" data-act="clNote" data-i="${i}" title="ملاحظة">${ic(item.n ? 'edit' : 'chat', 15)}</button>
        <button class="ic-btn sm danger-icon" data-act="clDel" data-i="${i}" title="حذف">${ic('x', 15)}</button>
      </div>${item.n ? `<div class="cl-note">${esc(item.n)}</div>` : ''}`).join('')}
    </div>
    <button class="btn sm ghost" data-act="clAdd" style="margin-top:8px">${ic('plusc', 15)} إضافة بند</button>
  </div>`;
}

/* ---------- dashboard ---------- */
function viewDash() {
  const m = me(); const h = new Date().getHours(); const now = new Date();
  const tabs = [['daily', '☀️ يومي'], ['team', '👥 الفريق والعملاء']];
  if (!tabs.some(t => t[0] === ui.dashTab)) ui.dashTab = 'daily';
  const all = liveTasks();
  const mine = myOpen();
  const sentOpen = all.filter(t => t.from === m.id && t.to !== m.id && t.status === 'open');
  const teamOver = all.filter(isOver).length;
  const doneToday = all.filter(t => t.status === 'done' && t.doneAt && dayDiff(t.doneAt, Date.now()) === 0).length;
  const pomoT = pomoToday(pomo());
  return `<div class="page-head">${backBtn()}${can('send_tasks') ? `<button class="btn sm primary" data-act="go" data-view="send">${ic('plusc', 16)} ابعت تاسك</button>` : ''}</div>
  <div class="hello"><div><h2>${h < 12 ? 'صباح الخير' : 'مساء الخير'} يا ${esc(firstName(m.name))} 👋</h2><p>${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} — ركّز على الأهم وسيب الباقي للسيستم</p></div>
    <div class="tabs">${tabs.map(t => `<button class="${ui.dashTab === t[0] ? 'on' : ''}" data-act="dashTab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div></div>
  <div class="kpis" style="margin-bottom:18px">
    <div class="kpi blue"><small>${ic('checksq', 16)} تاسكاتي المفتوحة</small><div class="v">${mine.length}</div><div class="s">${mine.filter(isOver).length ? mine.filter(isOver).length + ' متأخرة' : 'مفيش تأخير'}</div></div>
    <div class="kpi amber"><small>${ic('send', 16)} بعتها ولسه مخلصتش</small><div class="v">${sentOpen.length}</div><div class="s">${sentOpen.filter(isOver).length} متأخرة</div></div>
    <div class="kpi red"><small>${ic('alert', 16)} متأخرة في الفريق</small><div class="v">${teamOver}</div><div class="s">كل الفريق</div></div>
    <div class="kpi green"><small>${ic('check', 16)} اتخلصت النهارده</small><div class="v">${doneToday}</div><div class="s">كل الفريق</div></div>
    <div class="kpi"><small>🍅 تركيز النهارده</small><div class="v">${pomoT.m}<span style="font-size:15px;font-weight:600"> دقيقة</span></div><div class="s">${pomoT.s} جلسات</div></div>
  </div>
  ${ui.dashTab === 'team' ? dashTeam() : dashDaily(sentOpen)}`;
}
function dashDaily(sentOpen) {
  const prios = prioToday();
  const mine = myOpen();
  const sent = sentOpen.slice().sort((a, b) => a.due - b.due);
  return `<div class="grid2" style="align-items:start">
    ${pomoHTML()}
    <div class="stack">
      <div class="card pad-sm"><div class="card-h" style="margin-bottom:8px"><h3>⭐ أهم 3 حاجات النهارده</h3><span class="muted" style="font-size:13px">${prios.filter(p => p.d).length}/3</span></div>
        ${prios.map((p, i) => `<div class="prio ${p.d ? 'done' : ''}"><span class="n">${i + 1}</span><input type="text" value="${esc(p.t)}" placeholder="${['أهم حاجة لازم تخلص النهارده…', 'تاني أولوية…', 'تالت أولوية…'][i]}" data-chg="prioText" data-i="${i}" data-key="prioText" maxlength="140"><input type="checkbox" ${p.d ? 'checked' : ''} data-chg="prioDone" data-i="${i}" aria-label="خلصت" ${p.t ? '' : 'disabled'}></div>`).join('')}
      </div>
      ${checklistHTML()}
      <div class="card pad-sm"><div class="card-h" style="margin-bottom:8px"><h3>${ic('checksq', 20)} تاسكاتي (${mine.length})</h3><button class="link" data-act="go" data-view="tasks">الكل</button></div>
        ${mine.length ? `<div class="task-list">${mine.slice(0, 5).map(t => taskItem(t, 'mini')).join('')}</div>` : '<div class="muted" style="padding:8px 0">مفيش تاسكات مطلوبة منك 🎉</div>'}
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:18px"><div class="card-h"><h3>${ic('send', 20)} تاسكات بعتها ولسه مستنيها (${sent.length})</h3><button class="link" data-act="openSent">الكل</button></div>
    ${sent.length ? `<div class="task-list">${sent.slice(0, 6).map(t => taskItem(t, 'sent')).join('')}</div>` : '<div class="muted" style="padding:8px 0">كل اللي بعته اتخلص 👌</div>'}
  </div>`;
}
function dashTeam() {
  const over = liveTasks().filter(isOver).sort((a, b) => a.due - b.due);
  const clients = Object.values(state.clients).filter(c => c.status !== 'inactive').map(c => ({ c, s: clientStats(c) }));
  const need = clients.filter(x => x.s.over > 0 || dayDiff(Date.now(), x.s.lastAct) >= 14).sort((a, b) => b.s.over - a.s.over || a.s.lastAct - b.s.lastAct);
  const totalBudget = clients.reduce((a, x) => a + (Number(x.c.budget) || 0), 0);
  return `<div class="kpis" style="margin-bottom:18px">
      <div class="kpi blue"><small>عملاء نشطين</small><div class="v">${clients.length}</div></div>
      <div class="kpi green"><small>إجمالي الميزانيات الشهرية</small><div class="v">${fmtNum(totalBudget)}</div><div class="s">ج.م</div></div>
      <div class="kpi red"><small>تاسكات متأخرة في الفريق</small><div class="v">${over.length}</div></div>
      <div class="kpi amber"><small>حسابات محتاجة اهتمام</small><div class="v">${need.length}</div></div>
    </div>
    <div class="grid2" style="align-items:start">
      <div class="card pad-sm"><div class="card-h"><h3>${ic('users', 20)} ضغط الشغل</h3>${can('view_radar') ? '<button class="link" data-act="go" data-view="radar">الرادار</button>' : ''}</div>${workloadHTML(false)}</div>
      <div class="stack">
        <div class="card pad-sm"><div class="card-h"><h3>⚠️ حسابات محتاجة اهتمام</h3>${can('view_clients') ? '<button class="link" data-act="go" data-view="clients">كل العملاء</button>' : ''}</div>
          ${need.length ? `<div class="list-rows">${need.slice(0, 8).map(x => `<div class="lrow" ${can('view_clients') ? `role="button" tabindex="0" data-act="openClient" data-id="${esc(x.c.id)}" style="cursor:pointer"` : ''}><span class="cc-logo" style="width:38px;height:38px;font-size:14px">${esc(initials(x.c.name))}</span><div class="grow"><b>${esc(x.c.name)}</b><div class="sub">${x.s.over ? `<span style="color:var(--danger)">${x.s.over} تاسك متأخر</span> · ` : ''}آخر نشاط ${esc(agoDays(x.s.lastAct))}</div></div></div>`).join('')}</div>` : '<div class="muted" style="padding:10px 0">كل الحسابات ماشية تمام 👌</div>'}
        </div>
        <div class="card pad-sm"><div class="card-h"><h3>${ic('alert', 20)} تاسكات متأخرة (${over.length})</h3></div>
          ${over.length ? `<div class="task-list">${over.slice(0, 6).map(t => taskItem(t, 'team')).join('')}</div>` : '<div class="muted" style="padding:10px 0">مفيش تأخير 🎉</div>'}
        </div>
      </div>
    </div>`;
}
