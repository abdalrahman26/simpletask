(function () {
  const BASE = location.origin + '/fake/';
  async function post(path, body) {
    const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    return { data: j.data === undefined ? null : j.data, error: j.error || null };
  }
  function from(table) {
    const st = { op: 'select', order: null, limit: null, range: null, rows: null, id: null };
    const api = {
      select() { st.op = 'select'; return api; },
      order(c, o) { st.order = [c, !(o && o.ascending === false)]; return api; },
      limit(n) { st.limit = n; return api; },
      range(a, b) { st.range = [a, b]; return api; },
      upsert(rows) { st.op = 'upsert'; st.rows = Array.isArray(rows) ? rows : [rows]; return api; },
      delete() { st.op = 'delete'; return api; },
      eq(c, v) { st.id = v; return api; },
      then(res, rej) {
        let p;
        if (st.op === 'select') p = post('select', { table, order: st.order, range: st.range, limit: st.limit });
        else if (st.op === 'upsert') p = post('upsert', { table, rows: st.rows });
        else p = post('delete', { table, id: st.id });
        return p.catch(e => ({ data: null, error: { message: String(e) } })).then(res, rej);
      }
    };
    return api;
  }
  window.supabase = {
    createClient() {
      const channels = new Set();
      return {
        from,
        channel() {
          const ch = { listeners: [], seq: null, timer: null };
          ch.on = (type, filter, cb) => { ch.listeners.push({ table: filter.table, cb }); return ch; };
          ch.subscribe = (cb) => {
            channels.add(ch);
            fetch(BASE + 'events?since=999999999').then(r => r.json()).then(j => {
              ch.seq = j.seq; cb && cb('SUBSCRIBED');
              ch.timer = setInterval(async () => {
                try {
                  const r = await fetch(BASE + 'events?since=' + ch.seq); const k = await r.json();
                  ch.seq = k.seq;
                  k.events.forEach(ev => ch.listeners.forEach(l => { if (l.table === ev.table) l.cb(ev.payload); }));
                } catch (e) { /* ignore */ }
              }, 300);
            }).catch(() => cb && cb('CHANNEL_ERROR'));
            return ch;
          };
          return ch;
        },
        removeChannel(ch) { clearInterval(ch.timer); channels.delete(ch); }
      };
    }
  };
})();
