/* =========================================================
   Supabase (config from Vercel /api/config) — auth + data + realtime
   ========================================================= */
let cfg = null, sb = null, chan = null, authSession = null;
let cloudState = 'connecting';          // connecting | live | error
let lastChanStatus = '';
let pending = [], flushing = false, flushTimer = null;
let dataReady = false;

function authUid() { return authSession && authSession.user ? authSession.user.id : null; }
function loadPending() { const p = LS.get(PENDING_KEY, null); pending = p && p.uid === authUid() && Array.isArray(p.ops) ? p.ops : []; }
function savePending() { LS.set(PENDING_KEY, { uid: authUid(), ops: pending }); }

function setCloudState(s) {
  cloudState = s;
  $$('.cloud-dot').forEach(d => { d.className = 'cloud-dot ' + s; });
  $$('[data-cloud-label]').forEach(d => { d.textContent = cloudLabel(); });
}
function cloudLabel() {
  return { live: 'متصل — التحديث لحظي على كل الأجهزة', connecting: 'بيتصل…', error: 'الاتصال فاصل — التعديلات هتترفع أول ما يرجع' }[cloudState] || '';
}

/* ---------- boot pieces ---------- */
async function fetchConfig() {
  const r = await fetch('/api/config', { cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error('config ' + r.status), { kind: r.status === 404 ? 'no_api' : 'net' });
  return r.json();
}
async function makeClient() {
  if (!window.supabase || !window.supabase.createClient) await loadAny(SUPA_SRC);
  if (!window.supabase || !window.supabase.createClient) throw new Error('supabase lib');
  return window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mynd-auth' } });
}

/* ---------- data ---------- */
function cloudQueue(t, coll, id) {
  pending.push({ t, coll, id });
  savePending();
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 60);
}
async function flush() {
  if (flushing || !sb || !authUid()) return !pending.length;
  if (!pending.length) return true;
  flushing = true;
  try {
    while (pending.length) {
      const op = pending[0];
      const table = TABLE[op.coll];
      if (table && !SERVER_ONLY.includes(op.coll)) {
        let res;
        if (op.t === 'up') {
          const row = state[op.coll][op.id];
          if (row) res = await sb.from(table).upsert({ id: op.id, data: row, updated_at: new Date().toISOString() });
        } else {
          res = await sb.from(table).delete().eq('id', op.id);
        }
        if (res && res.error) throw res.error;
      }
      pending.shift();
      savePending();
    }
    if (cloudState !== 'live' && lastChanStatus === 'SUBSCRIBED') setCloudState('live');
    return true;
  } catch (e) {
    console.warn('[sync] flush failed', e);
    setCloudState('error');
    return false;
  } finally { flushing = false; }
}
async function fetchColl(c) {
  const out = {};
  const add = rows => (rows || []).forEach(r => { if (r && r.id && r.data && typeof r.data === 'object') out[r.id] = r.data; });
  if (c === 'chat') {
    const { data, error } = await sb.from(TABLE.chat).select('id,data').order('updated_at', { ascending: false }).limit(400);
    if (error) throw error; add(data); return out;
  }
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.from(TABLE[c]).select('id,data').order('id', { ascending: true }).range(from, from + size - 1);
    if (error) throw error;
    add(data);
    if (!data || data.length < size) break;
  }
  return out;
}
async function fetchAll() { const r = {}; for (const c of COLLS) r[c] = await fetchColl(c); return r; }

/** full sync: push pending, pull everything, subscribe */
let syncBusy = false;
async function syncAll() {
  if (syncBusy || !sb || !authUid()) return false;
  syncBusy = true;
  try {
    if (!(await flush())) throw new Error('flush failed');
    const remote = await fetchAll();
    // نحافظ على أي تعديل محلي لسه في الطابور
    pending.forEach(op => { if (op.t === 'up' && state[op.coll][op.id]) remote[op.coll][op.id] = state[op.coll][op.id]; else if (op.t === 'del') delete remote[op.coll][op.id]; });
    state = remote;
    dataReady = true;
    writeLocal();
    knownTasks = null; knownChat = null; detect();
    if (!chan) subscribe();
    if (lastChanStatus === 'SUBSCRIBED') setCloudState('live');
    if (!me()) { await signOutLocal('حسابك مش متسجل كموظف في السيستم — كلّم المدير'); return false; }
    render();
    return true;
  } catch (e) {
    console.warn('[sync] sync failed', e);
    setCloudState('error');
    return false;
  } finally { syncBusy = false; }
}
function subscribe() {
  if (!sb) return;
  try { if (chan) sb.removeChannel(chan); } catch (e) { /* ignore */ }
  chan = sb.channel('mt-sync-' + uid());
  COLLS.forEach(c => { chan.on('postgres_changes', { event: '*', schema: 'public', table: TABLE[c] }, p => onRemote(c, p)); });
  chan.subscribe(status => {
    const prev = lastChanStatus; lastChanStatus = status;
    if (status === 'SUBSCRIBED') {
      setCloudState(pending.length ? 'connecting' : 'live');
      if (prev && prev !== 'SUBSCRIBED') syncAll(); else flush();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (authUid()) setCloudState('error');
    }
  });
}
function unsubscribe() {
  try { if (sb && chan) sb.removeChannel(chan); } catch (e) { /* ignore */ }
  chan = null; lastChanStatus = '';
}
function onRemote(coll, p) {
  try {
    const type = p.eventType || p.type;
    if (type === 'DELETE') {
      const id = p.old && p.old.id;
      if (id && state[coll][id]) { delete state[coll][id]; afterRemote(coll); }
    } else {
      const row = p.new;
      if (row && row.id && row.data && typeof row.data === 'object') {
        if (pending.some(op => op.coll === coll && op.id === row.id)) return;
        state[coll][row.id] = row.data; afterRemote(coll);
      }
    }
  } catch (e) { console.warn('[sync] remote apply failed', e); }
}
function afterRemote(coll) {
  writeLocal(); detect();
  if (coll === 'employees' && authUid() && !me()) { signOutLocal('حسابك اتشال من السيستم'); return; }
  scheduleRender();
}
setInterval(() => {
  if (!authUid() || !sb) return;
  if (cloudState === 'error' && navigator.onLine !== false) syncAll();
  else if (pending.length) flush();
}, 20000);
window.addEventListener('online', () => { if (authUid()) syncAll(); });

/* ---------- server-side admin actions (employees / roles) ---------- */
async function adminCall(action, payload) {
  let token = '';
  try { const s = await sb.auth.getSession(); token = s.data.session ? s.data.session.access_token : ''; } catch (e) { /* ignore */ }
  let r, j;
  try {
    r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(Object.assign({ action }, payload || {})) });
    j = await r.json();
  } catch (e) { toast('مفيش اتصال بالسيرفر — جرّب تاني', 'error'); return null; }
  if (!r.ok || !j || !j.ok) { toast((j && j.error) || 'حصلت مشكلة — جرّب تاني', 'error'); return null; }
  (j.employees || []).forEach(x => { state.employees[x.id] = x; });
  (j.roles || []).forEach(x => { state.roles[x.id] = x; });
  (j.removedEmployees || []).forEach(id => { delete state.employees[id]; });
  (j.removedRoles || []).forEach(id => { delete state.roles[id]; });
  writeLocal(); scheduleRender();
  return j;
}

/* ---------- auth ---------- */
async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const m = String(error.message || '').toLowerCase();
    if (/invalid|credentials|password|email/.test(m)) return 'الإيميل أو كلمة السر مش صح';
    if (/fetch|network|failed/.test(m)) return 'مفيش اتصال — اتأكد من النت';
    return 'مقدرناش ندخلك: ' + error.message;
  }
  await startSession(data.session);
  return '';
}
async function startSession(session) {
  authSession = session;
  dataReady = false;
  state = emptyState();
  if (loadLocal(authUid())) dataReady = !!me();
  loadPending();
  render();
  await syncAll();
}
async function signOutLocal(msg) {
  try { await flush(); } catch (e) { /* ignore */ }
  unsubscribe();
  try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
  authSession = null; dataReady = false; state = emptyState();
  LS.del(APP_KEY);
  knownTasks = null; knownChat = null;
  chatClose();
  ['modal', 'confirm', 'browser'].forEach(closeLayer);
  Object.assign(ui, JSON.parse(JSON.stringify(UI_DEFAULTS)));
  document.title = BASE_TITLE;
  try { history.replaceState(null, '', '#home'); } catch (e) { /* ignore */ }
  render();
  if (msg) toast(msg, 'error');
}

/* ---------- live notifications ---------- */
let knownTasks = null, knownChat = null;
function detect() {
  const m = me();
  if (!m || !dataReady) { knownTasks = null; knownChat = null; return; }
  const curT = new Map();
  Object.values(state.tasks).forEach(t => curT.set(t.id, t.deleted ? 'deleted' : t.status));
  if (knownTasks) {
    Object.values(state.tasks).forEach(t => {
      if (t.deleted) return;
      const prev = knownTasks.get(t.id);
      if (prev === undefined && t.to === m.id && t.from !== m.id) {
        sound('task'); toast('📥 تاسك جديد من ' + empName(t.from), 'info', { label: 'افتحه', fn: () => { ui.tasksTab = 'mine'; go('tasks'); } }, t.text);
        browserNotify('تاسك جديد من ' + empName(t.from), t.text);
      } else if (prev === 'open' && t.status === 'done' && t.from === m.id && t.to !== m.id) {
        sound('done'); toast('✅ ' + empName(t.to) + ' خلّص التاسك', 'success', null, t.text);
        browserNotify(empName(t.to) + ' خلّص التاسك', t.text);
      }
    });
  }
  knownTasks = curT;
  const curC = new Set(Object.keys(state.chat));
  if (knownChat) {
    const fresh = Object.values(state.chat).filter(x => !knownChat.has(x.id) && x.from !== m.id).sort((a, b) => a.at - b.at);
    if (fresh.length) {
      const last = fresh[fresh.length - 1];
      sound('msg');
      if ($('#chat').hidden) toast('💬 ' + empName(last.from), 'info', { label: 'رد', fn: chatOpen }, last.text);
      browserNotify('رسالة من ' + empName(last.from), last.text);
    }
  }
  knownChat = curC;
}

/* ---------- render scheduling ---------- */
let renderTimer = null, renderDeferred = false;
function viewIsBusy() {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  const inView = $('#view') && $('#view').contains(a);
  if (!inView) return false;
  if (a.tagName === 'TEXTAREA') return true;
  return a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file|range|color)$/i.test(a.type || '');
}
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (viewIsBusy()) { renderDeferred = true; renderChrome(); return; }
    render();
  }, 40);
}
document.addEventListener('focusout', () => {
  setTimeout(() => { if (renderDeferred && !viewIsBusy()) render(); }, 120);
});
