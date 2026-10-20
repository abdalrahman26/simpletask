'use strict';
/* =========================================================
   simple task innovalz (MYND Tasks) — core
   ========================================================= */
const APP_KEY = 'mynd_tasks_v2';
const PREFS_KEY = 'mynd_prefs_v2';
const PENDING_KEY = 'mynd_pending_v2';
const BASE_TITLE = 'simple task innovalz';
const SUPA_SRC = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];
const EXCEL_SRC = ['https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', 'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'];

const COLLS = ['roles', 'employees', 'tasks', 'clients', 'events', 'chat', 'settings'];
const TABLE = { roles: 'mt_roles', employees: 'mt_employees', tasks: 'mt_tasks', clients: 'mt_clients', events: 'mt_client_events', chat: 'mt_chat', settings: 'mt_settings' };
const SERVER_ONLY = ['roles', 'employees']; // بتتعدل من السيرفر بس (api/admin)

const PERMS = [
  ['send_tasks', 'إرسال تاسكات للموظفين', 'المهام'],
  ['view_team_tasks', 'رؤية كل مهام الفريق', 'المهام'],
  ['complete_any', 'إنهاء أي تاسك', 'المهام'],
  ['delete_tasks', 'حذف أي تاسك', 'المهام'],
  ['view_radar', 'رادار المهام وضغط الشغل', 'الإدارة'],
  ['manage_trash', 'استعادة المحذوفات', 'الإدارة'],
  ['view_reports', 'تقارير الفريق كله', 'الإدارة'],
  ['export_reports', 'تصدير ملفات الإكسيل', 'الإدارة'],
  ['view_dashboard', 'لوحة المدير (بومودورو + المبيعات)', 'الإدارة'],
  ['view_clients', 'رؤية حسابات العملاء', 'العملاء والمبيعات'],
  ['manage_clients', 'إضافة وتعديل العملاء', 'العملاء والمبيعات'],
  ['log_events', 'تسجيل أحداث حسابات العملاء', 'العملاء والمبيعات'],
  ['manage_employees', 'إدارة الموظفين', 'النظام'],
  ['manage_roles', 'إدارة الأدوار والصلاحيات', 'النظام'],
  ['manage_settings', 'الإعدادات والربط السحابي', 'النظام']
];
const PERM_IDS = PERMS.map(p => p[0]);

const PLATFORMS = ['فيسبوك', 'إنستجرام', 'تيك توك', 'سناب شات', 'جوجل', 'لينكدإن', 'يوتيوب', 'X', 'واتساب', 'الموقع'];
const SERVICES = ['إدارة صفحات السوشيال ميديا', 'تصميم جرافيك', 'موشن جرافيك', 'تصوير فوتوغرافي', 'تصوير فيديو', 'إنتاج ريلز', 'كتابة محتوى', 'إعلانات مدفوعة', 'تصميم مواقع', 'تطوير مواقع وتطبيقات', 'تصميم هوية بصرية', 'تحسين محركات البحث SEO', 'استشارات تسويقية', 'إدارة حملات إعلانية', 'تصميم عبوات ومطبوعات'];
const EVENT_TYPES = [
  { id: 'meeting', label: 'اجتماع', e: '🤝' },
  { id: 'campaign', label: 'إطلاق حملة', e: '🚀' },
  { id: 'shoot', label: 'جلسة تصوير', e: '📸' },
  { id: 'delivery', label: 'تسليم مواد', e: '📦' },
  { id: 'call', label: 'مكالمة / تواصل', e: '📞' },
  { id: 'other', label: 'ملاحظة', e: '📝' }
];
const COLORS = ['#0891b2', '#1d5cff', '#7c3aed', '#9333ea', '#059669', '#d97706', '#db2777', '#4f46e5', '#0d9488', '#ea580c', '#2563eb', '#c026d3'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKEND = [5, 6]; // الجمعة والسبت
const POMO_DUR = { focus: 25, short: 5, long: 15 };
const POMO_LABEL = { focus: 'وقت التركيز', short: 'راحة قصيرة', long: 'راحة طويلة' };

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
function arDigits(s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
function toNum(v) { const n = Number(arDigits(v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; }
function fmtNum(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
function fmtMoney(n) { return fmtNum(n) + ' ج.م'; }
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#64748b'; }
function initials(name) {
  const w = String(name || '؟').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '؟';
  if (w.length === 1) return Array.from(w[0]).slice(0, 2).join('');
  const r = Array.from(w[0])[0] + Array.from(w[1])[0];
  if (r === 'اا') { const st = x => (x.length > 3 && x.indexOf('ال') === 0 ? x.slice(2) : x); return Array.from(st(w[0]))[0] + Array.from(st(w[1]))[0]; }
  return r;
}
function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
function normUrl(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); if (x.protocol !== 'http:' && x.protocol !== 'https:') return ''; return x.href; } catch (e) { return ''; }
}
function linkify(text) {
  const s = String(text || '');
  const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
  let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    let url = m[0];
    const trail = (url.match(/[.,،؛!?)\]}»"']+$/) || [''])[0];
    if (trail) url = url.slice(0, url.length - trail.length);
    out += esc(s.slice(last, m.index));
    const href = normUrl(url);
    out += href ? `<a href="#" class="ilink ltr" data-act="openUrl" data-url="${esc(href)}">${esc(url.length > 48 ? url.slice(0, 45) + '…' : url)}</a>` : esc(url);
    out += esc(trail);
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out.replace(/\n/g, '<br>');
}
async function loadAny(srcs) {
  let err;
  for (const src of [].concat(srcs)) { try { await loadScript(src); return; } catch (e) { err = e; } }
  throw err || new Error('load failed');
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('تعذر تحميل ' + src)); };
    document.head.appendChild(s);
  });
}

/* ---------- dates ---------- */
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; }
function dayDiff(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 864e5); }
function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseYMD(s) { const p = String(s || '').split('-').map(Number); if (p.length !== 3 || p.some(isNaN)) return NaN; return new Date(p[0], p[1] - 1, p[2]).getTime(); }
function fmtTime(t) { const d = new Date(t); let h = d.getHours(); const m = d.getMinutes(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return h + ':' + pad2(m) + ' ' + ap; }
function fmtDay(t) {
  const diff = dayDiff(t, Date.now());
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'بكرة';
  if (diff === 2) return 'بعد بكرة';
  if (diff === -1) return 'امبارح';
  const d = new Date(t);
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
}
function fmtDue(t) { return fmtDay(t) + ' · ' + fmtTime(t); }
function fmtDate(t) { const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function fmtStamp(t) { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + fmtTime(t); }
function agoDays(t) { const n = dayDiff(Date.now(), t); if (n <= 0) return 'النهارده'; if (n === 1) return 'امبارح'; return 'من ' + n + ' يوم'; }

/* ---------- icons ---------- */
const ICONS = {
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  plusc: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>',
  checksq: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 12.2l2.6 2.6 4.7-5.3"/>',
  chart: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 16v-3.5M12 16V8.5M15.5 16v-5"/>',
  layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 16 9.5 5 9.5-5"/><path d="m2.5 12 9.5 5 9.5-5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8.5 7h1M14.5 7h1M8.5 11h1M14.5 11h1M8.5 15h1M14.5 15h1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  minus: '<path d="M5 12h14"/>',
  chat: '<path d="M21 14a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 12.5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  volx: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 9.5c.3 2 2.5 4.3 4.7 4.8l1-1.1 1.8.8c-.2 1-1 1.8-2.1 1.8-3.1 0-6.2-3-6.2-6.2 0-1 .8-1.9 1.8-2.1l.8 1.8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  skip: '<path d="M5 5v14l10-7z" fill="currentColor"/><path d="M19 5v14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  trend: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  grid: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  cloud: '<path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  fire: '<path d="M12 22c4 0 7-2.7 7-6.8 0-4-3-6.2-4-9.2-1 2-2 3-3.5 3.5C11 6 10.5 4 9 2c0 4-4 6.5-4 12 0 4.6 3 8 7 8z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'
};
function ic(n, s = 20) { return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`; }

/* ---------- state ---------- */
let state = emptyState();
function emptyState() { const s = {}; COLLS.forEach(c => { s[c] = {}; }); return s; }
let prefs = Object.assign({ theme: 'light', sound: true }, LS.get(PREFS_KEY, {}));
let writeWarned = false;

function loadLocal(uid) {
  const d = LS.get(APP_KEY, null);
  if (d && d.v === 3 && d.uid === uid && d.data && typeof d.data === 'object') {
    const s = emptyState();
    COLLS.forEach(c => { if (d.data[c] && typeof d.data[c] === 'object') s[c] = d.data[c]; });
    state = s; return true;
  }
  return false;
}
function pruneChat() {
  const msgs = Object.values(state.chat);
  if (msgs.length > 600) { msgs.sort((a, b) => a.at - b.at).slice(0, msgs.length - 500).forEach(m => { delete state.chat[m.id]; }); }
}
function writeLocal() {
  const m = authUid(); if (!m) return;
  pruneChat();
  const ok = LS.set(APP_KEY, { v: 3, uid: m, data: state, ts: Date.now() });
  if (!ok && !writeWarned) { writeWarned = true; console.warn('[cache] localStorage full'); }
}
function save(coll, obj) {
  if (SERVER_ONLY.includes(coll)) { console.error('server-only collection', coll); return; }
  obj.updatedAt = Date.now();
  state[coll][obj.id] = obj;
  cloudQueue('up', coll, obj.id);
  changed();
}
function removeRow(coll, id) {
  if (SERVER_ONLY.includes(coll)) { console.error('server-only collection', coll); return; }
  if (!state[coll][id]) return;
  delete state[coll][id];
  cloudQueue('del', coll, id);
  changed();
}
function changed() { writeLocal(); detect(); scheduleRender(); }

/* ---------- auth & permissions ---------- */
function me() { const id = authUid(); return id && state.employees[id] ? state.employees[id] : null; }
function roleOf(e) { return (e && state.roles[e.roleId]) || null; }
function roleName(e) { const r = roleOf(e); return r ? r.name : 'بدون دور'; }
function permsOf(e) {
  if (!e) return [];
  const r = roleOf(e);
  if (r && r.id === 'gm') return PERM_IDS.slice();
  const set = new Set([...(r && Array.isArray(r.perms) ? r.perms : []), ...(Array.isArray(e.extraPerms) ? e.extraPerms : [])]);
  return PERM_IDS.filter(p => set.has(p));
}
function can(p, e) { return permsOf(e || me()).includes(p); }
function isGM(e) { const r = roleOf(e || me()); return !!r && r.id === 'gm'; }
function sortedEmps() { return Object.values(state.employees).sort((a, b) => ((a.order != null ? a.order : 1e15) - (b.order != null ? b.order : 1e15)) || ((a.createdAt || 0) - (b.createdAt || 0))); }
function empName(id) { const e = state.employees[id]; return e ? e.name : 'موظف محذوف'; }
function avatar(e, cls) { return `<span class="av ${cls || ''}" style="background:${safeColor(e && e.color)}" aria-hidden="true">${esc(initials(e ? e.name : '؟'))}</span>`; }
function avatarById(id, cls) { return avatar(state.employees[id] || { name: '؟', color: '#94a3b8' }, cls); }
function nextColor() { return COLORS[Object.keys(state.employees).length % COLORS.length]; }

/* ---------- sound ---------- */
let actx = null;
function sound(type) {
  if (!prefs.sound) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // المتصفح بيمنع الصوت قبل أول ضغطة
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const seq = { send: [660, 880], done: [523, 659, 784], msg: [880, 1175], task: [587, 880, 1175], pomo: [523, 659, 784, 1047, 784, 1047], error: [260, 200], tap: [740] }[type] || [660];
    seq.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = actx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(type === 'pomo' ? 0.2 : 0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + 0.42);
    });
  } catch (e) { /* audio not available */ }
}
function browserNotify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(title, { body: String(body || '').slice(0, 140), tag: 'mynd-' + Date.now() });
    }
  } catch (e) { /* ignore */ }
}

/* ---------- toast ---------- */
function toast(msg, type, action, sub) {
  type = type || 'success';
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icn = type === 'error' ? 'alert' : type === 'info' ? 'bell' : 'check';
  el.innerHTML = `<span class="t-ic">${ic(icn, 16)}</span><div class="t-msg">${esc(msg)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').addEventListener('click', () => { try { action.fn(); } finally { el.remove(); } });
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, action ? 6000 : 3200);
}

/* ---------- layers (modal / confirm / browser) ---------- */
function openLayer(id, html, cls) {
  const L = document.getElementById(id);
  L.innerHTML = `<div class="backdrop" data-act="closeLayer" data-layer="${id}"></div>${html}`;
  L.classList.add('open');
  document.body.classList.add('noscroll');
  const box = L.querySelector('.modal,.browser');
  if (box && cls) box.classList.add(...cls.split(' '));
  const f = L.querySelector('[autofocus]'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  return L;
}
function closeLayer(id) {
  const L = document.getElementById(id); if (!L) return;
  L.classList.remove('open'); L.innerHTML = '';
  if (id === 'confirm' && confirmResolve) { const r = confirmResolve; confirmResolve = null; r(null); }
  if (!$$('.layer.open').length) document.body.classList.remove('noscroll');
}
function closeTop() {
  for (const id of ['confirm', 'browser', 'modal']) { if ($('#' + id).classList.contains('open')) { closeLayer(id); return true; } }
  if (!$('#chat').hidden) { chatClose(); return true; }
  return false;
}
function modal(title, body, footer, cls) {
  return openLayer('modal', `<div class="modal" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button class="ic-btn" data-act="closeLayer" data-layer="modal" aria-label="إغلاق">${ic('x')}</button></div>${body}${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`, cls);
}
let confirmResolve = null;
function confirmBox(o) {
  if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(null); }
  return new Promise(resolve => {
    let extra = '';
    if (o.input) extra = `<div class="field" style="margin-top:14px"><span>${esc(o.input.label || '')}</span><input class="input" id="cfIn" placeholder="${esc(o.input.placeholder || '')}" value="${esc(o.input.value || '')}" ${o.input.type ? `type="${o.input.type}" inputmode="numeric"` : ''} autofocus></div>`;
    if (o.select) extra = `<div class="field" style="margin-top:14px"><span>${esc(o.select.label || '')}</span><select class="select" id="cfIn">${o.select.options.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>`;
    if (o.check) extra += `<label class="check" style="margin-top:14px"><input type="checkbox" id="cfChk" ${o.check.checked ? 'checked' : ''}> ${esc(o.check.label)}</label>`;
    openLayer('confirm', `<div class="modal sm" role="alertdialog" aria-modal="true"><div class="modal-h"><h3>${esc(o.title)}</h3></div>${o.text ? `<p class="t2">${esc(o.text)}</p>` : ''}${extra}<div class="modal-f"><button class="btn ${o.danger ? 'danger' : 'primary'}" id="cfOk" ${o.input ? '' : 'autofocus'}>${esc(o.ok || 'تأكيد')}</button><button class="btn ghost" data-act="closeLayer" data-layer="confirm">إلغاء</button></div></div>`);
    confirmResolve = resolve;
    const done = () => {
      const inp = $('#cfIn'), chk = $('#cfChk');
      const val = { value: inp ? inp.value : '', checked: chk ? chk.checked : false };
      if (o.validate) { const err = o.validate(val); if (err) { toast(err, 'error'); return; } }
      const r = confirmResolve; confirmResolve = null; closeLayer('confirm'); if (r) r(val);
    };
    $('#cfOk').addEventListener('click', done);
    const inp = $('#cfIn');
    if (inp && inp.tagName === 'INPUT') inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); done(); } });
  });
}
function openBrowser(url) {
  const href = normUrl(url);
  if (!href) { toast('الرابط ده مش صحيح', 'error'); return; }
  openLayer('browser', `<div class="browser" role="dialog" aria-modal="true"><div class="browser-h"><button class="ic-btn" data-act="closeLayer" data-layer="browser" aria-label="إغلاق">${ic('x')}</button><div class="browser-url">${esc(href)}</div><a class="btn sm soft" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${ic('external', 16)} <span class="hide-m">افتح في تاب جديد</span></a></div><div class="browser-note">لو الصفحة مظهرتش، يبقى الموقع نفسه بيمنع عرضه جوه أنظمة تانية — اضغط "افتح في تاب جديد".</div><iframe src="${esc(href)}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="معاينة"></iframe></div>`);
}
