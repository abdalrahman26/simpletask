// simple task innovalz — بيرجّع إعدادات Supabase العامة للمتصفح من متغيرات Vercel
// المتغيرات المطلوبة في Vercel: SUPABASE_URL , SUPABASE_ANON_KEY , SUPABASE_SERVICE_ROLE_KEY
function env(...names) {
  for (const n of names) { const v = process.env[n]; if (v && String(v).trim()) return String(v).trim(); }
  return '';
}

module.exports = async function handler(req, res) {
  const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!service) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  let needsSetup = false;
  let dbError = '';
  if (!missing.length) {
    try {
      const r = await fetch(url + '/rest/v1/mt_employees?select=id&limit=1', { headers: { apikey: service, Authorization: 'Bearer ' + service } });
      if (r.ok) { const rows = await r.json(); needsSetup = !Array.isArray(rows) || rows.length === 0; }
      else { const t = await r.text(); dbError = /mt_employees|42P01|does not exist|schema cache/i.test(t) ? 'tables_missing' : 'db_error_' + r.status; }
    } catch (e) { dbError = 'db_unreachable'; }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ url, anonKey, missing, needsSetup, dbError }));
};
