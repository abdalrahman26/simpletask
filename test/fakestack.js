// Local stand-in for Vercel (static + /api functions) and Supabase (REST + Auth + Realtime websocket).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.argv[2] || 8765);
const ROOT = path.resolve(__dirname, '..');
const ANON = 'anon-key-test-0123456789';
const SERVICE = 'service-key-test-0123456789';
const ENV = { SUPABASE_URL: `http://127.0.0.1:${PORT}/sb`, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE };

let CFG = { fail: false, envMissing: false, noTables: false };
let DB = {}, USERS = {}, REFRESH = {};
const LOG = [];
function reset() { DB = {}; USERS = {}; REFRESH = {}; LOG.length = 0; }
['mt_roles', 'mt_employees', 'mt_tasks', 'mt_clients', 'mt_client_events', 'mt_chat', 'mt_settings'].forEach(t => { DB[t] = {}; });
const TABLES = () => ['mt_roles', 'mt_employees', 'mt_tasks', 'mt_clients', 'mt_client_events', 'mt_chat', 'mt_settings'];
function ensureTables() { if (!CFG.noTables) TABLES().forEach(t => { DB[t] = DB[t] || {}; }); }

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const access_token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp, session_id: crypto.randomUUID() }) + '.' + crypto.randomBytes(16).toString('base64url');
  const refresh_token = crypto.randomBytes(18).toString('hex');
  REFRESH[refresh_token] = user.id;
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token, user: publicUser(user) };
}
function publicUser(u) { return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.user_metadata || {}, identities: [], created_at: u.created_at, updated_at: new Date().toISOString() }; }
function userFromJwt(tok) {
  try {
    const p = JSON.parse(Buffer.from(String(tok).split('.')[1], 'base64url').toString());
    if (p.exp * 1000 < Date.now()) return null;
    return USERS[p.sub] || null;
  } catch (e) { return null; }
}
function role(req) {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth === SERVICE) return { role: 'service' };
  if (auth === ANON || !auth) return { role: 'anon' };
  const u = userFromJwt(auth);
  return u ? { role: 'authenticated', user: u } : { role: 'invalid' };
}

/* ---------- realtime ---------- */
const sockets = new Set();
function emit(table, type, record, oldRecord) {
  const data = { type, schema: 'public', table, commit_timestamp: new Date().toISOString(), columns: [{ name: 'id', type: 'text' }, { name: 'data', type: 'jsonb' }, { name: 'updated_at', type: 'timestamptz' }], record: record || {}, old_record: oldRecord || {}, errors: null };
  for (const ws of sockets) {
    for (const sub of ws.subs.values()) {
      if (!sub.user) continue; // RLS: anon يشوفش حاجة
      const ids = sub.bindings.filter(b => b.table === table && (b.event === '*' || b.event === type)).map(b => b.id);
      if (ids.length) ws.send(JSON.stringify({ topic: sub.topic, event: 'postgres_changes', payload: { ids, data }, ref: null }));
    }
  }
}
function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, sock, head) => {
    if (!req.url.startsWith('/sb/realtime/v1/websocket') || CFG.fail) { sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, ws => {
      ws.subs = new Map(); sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
      ws.on('message', raw => {
        let m; try { m = JSON.parse(raw); } catch (e) { return; }
        const reply = (payload) => ws.send(JSON.stringify({ topic: m.topic, event: 'phx_reply', payload, ref: m.ref, join_ref: m.join_ref }));
        if (m.topic === 'phoenix' && m.event === 'heartbeat') return reply({ status: 'ok', response: {} });
        if (m.event === 'phx_join') {
          const pc = (m.payload && m.payload.config && m.payload.config.postgres_changes) || [];
          const bindings = pc.map((b, i) => ({ id: 1000 + i, event: b.event, schema: b.schema, table: b.table }));
          ws.subs.set(m.topic, { topic: m.topic, bindings, user: userFromJwt(m.payload && m.payload.access_token) });
          LOG.push('join ' + m.topic + ' user=' + !!userFromJwt(m.payload && m.payload.access_token));
          return reply({ status: 'ok', response: { postgres_changes: bindings.map(b => ({ id: b.id, event: b.event, schema: b.schema, table: b.table })) } });
        }
        if (m.event === 'access_token') { const s = ws.subs.get(m.topic); if (s) s.user = userFromJwt(m.payload && m.payload.access_token); return; }
        if (m.event === 'phx_leave') { ws.subs.delete(m.topic); return reply({ status: 'ok', response: {} }); }
      });
    });
  });
}

/* ---------- http ---------- */
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
  res.end(body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body)));
}
function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }); }

async function rest(req, res, url) {
  const table = url.pathname.split('/rest/v1/')[1];
  const who = role(req);
  if (CFG.noTables || !DB[table]) return send(res, 404, { code: '42P01', message: `relation "public.${table}" does not exist` });
  if (who.role === 'invalid') return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
  if (who.role === 'anon') { if (req.method === 'GET') return send(res, 401, { code: '42501', message: 'permission denied for table ' + table }); return send(res, 401, { code: '42501', message: 'permission denied' }); }
  const t = DB[table]; const q = url.searchParams;
  const serverOnly = table === 'mt_employees' || table === 'mt_roles';
  if (req.method === 'GET') {
    let rows = Object.values(t);
    const idf = q.get('id'); if (idf && idf.startsWith('eq.')) rows = rows.filter(r => r.id === idf.slice(3));
    if (q.get('order')) { const [col, dir] = q.get('order').split('.'); rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
    const off = Number(q.get('offset') || 0); const lim = q.get('limit') ? Number(q.get('limit')) : undefined;
    rows = rows.slice(off, lim != null ? off + lim : undefined);
    return send(res, 200, rows.map(r => ({ id: r.id, data: r.data })));
  }
  if (serverOnly && who.role !== 'service') return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "' + table + '"' });
  if (req.method === 'POST') {
    const prefer = req.headers.prefer || '';
    if (!/merge-duplicates/.test(prefer)) return send(res, 409, { code: '23505', message: 'duplicate key (no upsert)' });
    let body = JSON.parse(await readBody(req) || '[]'); body = Array.isArray(body) ? body : [body];
    for (const r of body) {
      const old = t[r.id];
      const row = { id: r.id, data: r.data, updated_at: r.updated_at || new Date().toISOString() };
      t[r.id] = row; emit(table, old ? 'UPDATE' : 'INSERT', row, old ? { id: r.id } : {});
    }
    return send(res, 201, '');
  }
  if (req.method === 'DELETE') {
    const idf = q.get('id') || ''; const id = idf.startsWith('eq.') ? decodeURIComponent(idf.slice(3)) : null;
    if (id && t[id]) { delete t[id]; emit(table, 'DELETE', {}, { id }); }
    return send(res, 204, '');
  }
  send(res, 405, {});
}
async function auth(req, res, url) {
  const p = url.pathname.replace('/sb/auth/v1', '');
  const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse(await readBody(req) || '{}') : {};
  const who = role(req);
  if (p === '/token') {
    const gt = url.searchParams.get('grant_type');
    if (gt === 'password') {
      const u = Object.values(USERS).find(x => x.email === String(body.email || '').toLowerCase());
      if (!u || u.password !== body.password) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' });
      return send(res, 200, makeSession(u));
    }
    if (gt === 'refresh_token') {
      const id = REFRESH[body.refresh_token]; if (!id || !USERS[id]) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      return send(res, 200, makeSession(USERS[id]));
    }
  }
  if (p === '/user') {
    if (who.role !== 'authenticated') return send(res, 401, { msg: 'invalid JWT' });
    if (req.method === 'PUT') { if (body.password) { if (String(body.password).length < 6) return send(res, 422, { msg: 'Password should be at least 6 characters' }); who.user.password = body.password; } }
    return send(res, 200, publicUser(who.user));
  }
  if (p === '/logout') return send(res, 204, '');
  if (p.startsWith('/admin/users')) {
    if (who.role !== 'service') return send(res, 403, { msg: 'User not allowed' });
    const id = p.split('/admin/users/')[1];
    if (req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { msg: 'Unable to validate email address: invalid format' });
      if (Object.values(USERS).some(u => u.email === email)) return send(res, 422, { code: 'email_exists', msg: 'A user with this email address has already been registered' });
      if (String(body.password || '').length < 6) return send(res, 422, { msg: 'Password should be at least 6 characters' });
      const u = { id: crypto.randomUUID(), email, password: body.password, user_metadata: body.user_metadata || {}, created_at: new Date().toISOString() };
      USERS[u.id] = u; return send(res, 200, publicUser(u));
    }
    if (req.method === 'PUT' && id) {
      const u = USERS[id]; if (!u) return send(res, 404, { msg: 'User not found' });
      if (body.email) { const e = String(body.email).toLowerCase(); if (Object.values(USERS).some(x => x.email === e && x.id !== id)) return send(res, 422, { msg: 'email already registered' }); u.email = e; }
      if (body.password) u.password = body.password;
      return send(res, 200, publicUser(u));
    }
    if (req.method === 'DELETE' && id) { if (!USERS[id]) return send(res, 404, { msg: 'User not found' }); delete USERS[id]; return send(res, 200, {}); }
  }
  send(res, 404, { msg: 'not found ' + p });
}
function vercelFn(file) {
  return async (req, res) => {
    const saved = {};
    const env = CFG.envMissing ? {} : ENV;
    ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(k => { saved[k] = process.env[k]; if (env[k]) process.env[k] = env[k]; else delete process.env[k]; });
    delete require.cache[require.resolve(file)];
    try { await require(file)(req, res); } finally { /* keep env for async */ }
  };
}
const configFn = vercelFn(path.join(ROOT, 'api/config.js'));
const adminFn = vercelFn(path.join(ROOT, 'api/admin.js'));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/fake/')) {
      if (url.pathname === '/fake/config') { CFG = Object.assign(CFG, JSON.parse(await readBody(req) || '{}')); ensureTables(); return send(res, 200, CFG); }
      if (url.pathname === '/fake/reset') { reset(); ensureTables(); return send(res, 200, { ok: true }); }
      if (url.pathname === '/fake/dump') return send(res, 200, { db: DB, users: Object.values(USERS).map(u => ({ id: u.id, email: u.email, password: u.password })), log: LOG });
      if (url.pathname === '/fake/expire') { for (const ws of sockets) ws.terminate(); return send(res, 200, {}); }
    }
    if (url.pathname.startsWith('/sb/') && CFG.fail) { req.socket.destroy(); return; }
    if (url.pathname.startsWith('/sb/rest/v1/')) return await rest(req, res, url);
    if (url.pathname.startsWith('/sb/auth/v1/')) return await auth(req, res, url);
    if (url.pathname === '/api/config') return await configFn(req, res);
    if (url.pathname === '/api/admin') { if (CFG.fail) { req.socket.destroy(); return; } return await adminFn(req, res); }
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, 'dist/index.html'))); }
    send(res, 404, { error: 'not found' });
  } catch (e) { console.error(e); send(res, 500, { error: String(e) }); }
});
attachRealtime(server);
server.listen(PORT, '127.0.0.1', () => console.log('fakestack on', PORT));
