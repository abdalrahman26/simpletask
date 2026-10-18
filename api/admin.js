// simple task innovalz — عمليات الإدارة الحساسة (الموظفين والأدوار وحسابات الدخول)
// بتشتغل على سيرفر Vercel بمفتاح الخدمة، والمفتاح ده عمره ما بيوصل للمتصفح.
const PERM_IDS = ['send_tasks', 'view_team_tasks', 'complete_any', 'delete_tasks', 'view_radar', 'manage_trash', 'view_reports', 'export_reports', 'view_dashboard', 'view_clients', 'manage_clients', 'log_events', 'manage_employees', 'manage_roles', 'manage_settings'];
const COLORS = ['#0891b2', '#1d5cff', '#7c3aed', '#9333ea', '#059669', '#d97706', '#db2777', '#4f46e5', '#0d9488', '#ea580c', '#2563eb', '#c026d3'];

function env(...names) {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return '';
}
const URL_ = () => env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, '');
const SERVICE = () => env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
const ANON = () => env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

async function sbFetch(path, opts = {}) {
  const key = SERVICE();
  const r = await fetch(URL_() + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, opts.headers || {})
  }));
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  return { ok: r.ok, status: r.status, body };
}
async function rows(table) {
  const r = await sbFetch(`/rest/v1/${table}?select=id,data&limit=5000`);
  if (!r.ok) fail(500, 'قاعدة البيانات مش جاهزة — اتأكد إنك شغّلت سكربت SQL');
  const out = {}; (r.body || []).forEach(x => { if (x && x.id && x.data) out[x.id] = x.data; }); return out;
}
async function upsert(table, obj) {
  const r = await sbFetch(`/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: obj.id, data: obj, updated_at: new Date().toISOString() }]) });
  if (!r.ok) fail(500, 'مقدرناش نحفظ في قاعدة البيانات');
}
async function delRow(table, id) {
  const r = await sbFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) fail(500, 'مقدرناش نحذف من قاعدة البيانات');
}
function authErr(r) {
  const m = JSON.stringify(r.body || '').toLowerCase();
  if (r.status === 422 && /already|registered|exists/.test(m)) return 'الإيميل ده متسجل قبل كده';
  if (/password/.test(m)) return 'كلمة السر ضعيفة — لازم 6 حروف/أرقام على الأقل';
  if (/email/.test(m)) return 'الإيميل مش صحيح';
  return 'مشكلة في حساب الدخول (' + r.status + ')';
}
async function createAuthUser(email, password, name) {
  const r = await sbFetch('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }) });
  if (!r.ok || !r.body || !(r.body.id || (r.body.user && r.body.user.id))) fail(400, authErr(r));
  return r.body.id || r.body.user.id;
}
async function updateAuthUser(id, patch) {
  const r = await sbFetch('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(Object.assign({ email_confirm: true }, patch)) });
  if (!r.ok) fail(400, authErr(r));
}
async function deleteAuthUser(id) {
  const r = await sbFetch('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE' });
  if (!r.ok && r.status !== 404) fail(400, 'مقدرناش نمسح حساب الدخول');
}
function permsOf(emp, roles) {
  const r = roles[emp.roleId];
  if (r && r.id === 'gm') return PERM_IDS.slice();
  const s = new Set([...(r && Array.isArray(r.perms) ? r.perms : []), ...(Array.isArray(emp.extraPerms) ? emp.extraPerms : [])]);
  return PERM_IDS.filter(p => s.has(p));
}
const isGM = emp => emp && emp.roleId === 'gm';
const cleanPerms = a => (Array.isArray(a) ? a : []).filter(p => PERM_IDS.includes(p));
const str = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function defaultRoles(now) {
  return [
    { id: 'gm', name: 'المدير العام', perms: PERM_IDS.slice(), system: true, createdAt: now },
    { id: 'dept', name: 'مدير قسم', perms: ['send_tasks', 'view_team_tasks', 'complete_any', 'delete_tasks', 'view_radar', 'view_reports', 'export_reports', 'view_dashboard', 'view_clients', 'manage_clients', 'log_events', 'manage_employees'], system: true, createdAt: now + 1 },
    { id: 'emp', name: 'موظف عادي', perms: [], system: true, createdAt: now + 2 }
  ];
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise(resolve => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
async function callerFrom(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) fail(401, 'لازم تسجل دخول الأول');
  const r = await fetch(URL_() + '/auth/v1/user', { headers: { apikey: ANON() || SERVICE(), Authorization: 'Bearer ' + token } });
  if (!r.ok) fail(401, 'الجلسة انتهت — سجّل دخول تاني');
  const u = await r.json();
  if (!u || !u.id) fail(401, 'الجلسة انتهت — سجّل دخول تاني');
  return u.id;
}

async function handle(body, req) {
  const action = body.action;
  const now = Date.now();

  if (action === 'setup') {
    const emps = await rows('mt_employees');
    if (Object.keys(emps).length) fail(409, 'السيستم متجهز بالفعل — سجّل دخول عادي');
    const name = str(body.name, 50), email = str(body.email, 120).toLowerCase(), password = String(body.password || '');
    if (!name) fail(400, 'اكتب اسمك');
    if (!validEmail(email)) fail(400, 'الإيميل مش صحيح');
    if (password.length < 6) fail(400, 'كلمة السر لازم 6 حروف/أرقام على الأقل');
    const id = await createAuthUser(email, password, name);
    const roles = defaultRoles(now);
    for (const r of roles) await upsert('mt_roles', r);
    const emp = { id, name, email, roleId: 'gm', dept: 'الإدارة', title: 'المدير العام', extraPerms: [], color: '#0f172a', order: 0, createdAt: now, updatedAt: now };
    await upsert('mt_employees', emp);
    return { ok: true };
  }

  const uid = await callerFrom(req);
  const [emps, roles] = await Promise.all([rows('mt_employees'), rows('mt_roles')]);
  const me = emps[uid];
  if (!me) fail(403, 'حسابك مش متسجل كموظف');
  const perms = permsOf(me, roles);
  const need = p => { if (!perms.includes(p)) fail(403, 'مش معاك صلاحية للعملية دي'); };

  if (action === 'saveEmployee') {
    need('manage_employees');
    const e = body.employee || {};
    const old = e.id ? emps[e.id] : null;
    if (e.id && !old) fail(404, 'الموظف ده مش موجود');
    const name = str(e.name, 50), email = str(e.email, 120).toLowerCase(), password = String(e.password || '');
    const roleId = String(e.roleId || '');
    if (!name) fail(400, 'اكتب اسم الموظف');
    if (!validEmail(email)) fail(400, 'الإيميل مش صحيح');
    if (!roles[roleId]) fail(400, 'اختار دور');
    if (Object.values(emps).some(x => x.id !== e.id && String(x.name).trim().toLowerCase() === name.toLowerCase())) fail(400, 'في موظف بنفس الاسم — ميّزه بحرف أو لقب');
    if (Object.values(emps).some(x => x.id !== e.id && String(x.email || '').toLowerCase() === email)) fail(400, 'الإيميل ده مستخدم لموظف تاني');
    if (!old && password.length < 6) fail(400, 'كلمة السر لازم 6 حروف/أرقام على الأقل');
    if (old && password && password.length < 6) fail(400, 'كلمة السر لازم 6 حروف/أرقام على الأقل');
    if ((roleId === 'gm' || (old && isGM(old))) && !isGM(me)) fail(403, 'المدير العام بس اللي يقدر يعيّن أو يعدّل مدير عام');
    if (old && isGM(old) && roleId !== 'gm' && Object.values(emps).filter(isGM).length <= 1) fail(400, 'لازم يفضل في مدير عام واحد على الأقل');
    let id = e.id;
    if (!old) id = await createAuthUser(email, password, name);
    else {
      const patch = {};
      if (email !== String(old.email || '').toLowerCase()) patch.email = email;
      if (password) patch.password = password;
      if (Object.keys(patch).length) await updateAuthUser(id, patch);
    }
    const color = /^#[0-9a-f]{3,8}$/i.test(String(e.color || '')) ? e.color : (old && old.color) || COLORS[Object.keys(emps).length % COLORS.length];
    const row = Object.assign({}, old || { createdAt: now, order: Object.keys(emps).length + 1 }, {
      id, name, email, roleId, dept: str(e.dept, 60), title: str(e.title, 60), extraPerms: cleanPerms(e.extraPerms), color, updatedAt: now
    });
    await upsert('mt_employees', row);
    return { ok: true, employees: [row] };
  }

  if (action === 'deleteEmployee') {
    need('manage_employees');
    const t = emps[body.id];
    if (!t) fail(404, 'الموظف ده مش موجود');
    if (t.id === uid) fail(400, 'مينفعش تحذف نفسك');
    if (isGM(t) && !isGM(me)) fail(403, 'مش معاك صلاحية تحذف المدير العام');
    if (isGM(t) && Object.values(emps).filter(isGM).length <= 1) fail(400, 'لازم يفضل في مدير عام واحد على الأقل');
    await deleteAuthUser(t.id);
    await delRow('mt_employees', t.id);
    return { ok: true, removedEmployees: [t.id] };
  }

  if (action === 'saveRole') {
    need('manage_roles');
    const r = body.role || {};
    const old = r.id ? roles[r.id] : null;
    if (r.id && !old) fail(404, 'الدور ده مش موجود');
    if (old && old.id === 'gm') fail(400, 'دور المدير العام ثابت وعنده كل الصلاحيات');
    const name = old && old.system ? old.name : str(r.name, 40);
    if (!name) fail(400, 'اكتب اسم الدور');
    if (Object.values(roles).some(x => x.id !== r.id && String(x.name).trim() === name)) fail(400, 'في دور بنفس الاسم');
    const p = cleanPerms(r.perms);
    if (old && old.id === me.roleId && !p.includes('manage_roles') && !cleanPerms(me.extraPerms).includes('manage_roles')) fail(400, 'مينفعش تشيل صلاحية إدارة الأدوار من دورك انت');
    const id = old ? old.id : 'r' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    const row = Object.assign({}, old || { createdAt: now, system: false }, { id, name, perms: p, updatedAt: now });
    await upsert('mt_roles', row);
    return { ok: true, roles: [row] };
  }

  if (action === 'deleteRole') {
    need('manage_roles');
    const r = roles[body.id];
    if (!r) fail(404, 'الدور ده مش موجود');
    if (r.system) fail(400, 'الأدوار الأساسية مينفعش تتحذف');
    const n = Object.values(emps).filter(e => e.roleId === r.id).length;
    if (n) fail(400, `الدور ده عليه ${n} موظف — غيّر دورهم الأول`);
    await delRow('mt_roles', r.id);
    return { ok: true, removedRoles: [r.id] };
  }

  fail(400, 'عملية مش معروفة');
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') fail(405, 'POST only');
    if (!URL_() || !SERVICE()) fail(500, 'متغيرات Supabase ناقصة في Vercel');
    const body = await readBody(req);
    const out = await handle(body, req);
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error('[admin]', e);
    res.statusCode = status;
    res.end(JSON.stringify({ ok: false, error: e instanceof HttpError ? e.message : 'حصلت مشكلة في السيرفر' }));
  }
};
