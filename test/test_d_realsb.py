from t_basic import *
from urllib.parse import urlparse, parse_qs, unquote
REAL = (HERE/'real-supabase.js').read_text()
DB = {}
LOG = []
def rest(route):
    req = route.request; u = urlparse(req.url); table = u.path.split('/rest/v1/')[1]
    q = parse_qs(u.query); t = DB.setdefault(table, {})
    LOG.append((req.method, table, u.query[:80], req.headers.get('prefer')))
    hdr = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    if req.method == 'OPTIONS':
        return route.fulfill(status=200, headers={**hdr, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
    if req.method == 'GET':
        rows = list(t.values())
        if 'order' in q:
            col, d = q['order'][0].split('.')[:2]; rows.sort(key=lambda r: r.get(col) or '', reverse=(d == 'desc'))
        off = int(q.get('offset', ['0'])[0]); lim = int(q['limit'][0]) if 'limit' in q else None
        rows = rows[off: off + lim if lim else None]
        return route.fulfill(status=200, headers=hdr, body=json.dumps([{'id': r['id'], 'data': r['data']} for r in rows]))
    if req.method == 'POST':
        assert 'merge-duplicates' in (req.headers.get('prefer') or ''), req.headers
        body = json.loads(req.post_data); body = body if isinstance(body, list) else [body]
        for r in body: t[r['id']] = r
        return route.fulfill(status=201, headers=hdr, body='')
    if req.method == 'DELETE':
        rid = unquote(q['id'][0]).split('eq.', 1)[1]; t.pop(rid, None)
        return route.fulfill(status=204, headers=hdr, body='')
    route.fulfill(status=400, body='{}')

with sync_playwright() as p:
    b = p.chromium.launch()
    def mk(vp):
        c = b.new_context(viewport=vp); setup(c)
        c.route('https://cdn.jsdelivr.net/npm/@supabase/**', lambda r: r.fulfill(status=200, body=REAL, content_type='application/javascript'))
        c.route('https://fake-project.supabase.co/rest/v1/**', rest)
        return c
    c1 = mk({'width': 1280, 'height': 860}); g = c1.new_page(); watch(g, 'GM')
    g.goto(URL); login(g, 'المدير العام')
    g.goto(URL + '#settings'); g.fill('#sbUrl', 'https://fake-project.supabase.co'); g.fill('#sbKey', 'eyJ' + 'k' * 60)
    g.click('[data-act="cloudOn"]'); toast_has(g, 'اتربطت بالسحابة', 8000)
    print('tables:', {k: len(v) for k, v in DB.items()})
    assert len(DB['mt_employees']) == 9
    g.goto(URL + '#send'); g.locator('.emp-card', has_text='نهر').click(); g.fill('#taskText', 'تاسك عن طريق supabase الحقيقي'); g.keyboard.press('Enter')
    expect(g.locator('.success h2')).to_be_visible(); g.wait_for_timeout(800)
    assert len(DB['mt_tasks']) == 1, DB.get('mt_tasks')
    # delete then check
    g.goto(URL + '#tasks'); g.click('[data-act="tasksTab"][data-tab="sent"]')
    c2 = mk({'width': 1280, 'height': 860}); m = c2.new_page(); watch(m, 'D2')
    m.goto(URL); login(m, 'المدير العام')
    m.goto(URL + '#settings'); m.fill('#sbUrl', 'https://fake-project.supabase.co'); m.fill('#sbKey', 'eyJ' + 'k' * 60)
    m.click('[data-act="cloudOn"]'); m.click('#cfOk'); toast_has(m, 'اتربطت بالسحابة', 8000)
    m.goto(URL + '#tasks'); m.click('[data-act="tasksTab"][data-tab="sent"]')
    expect(m.locator('.task', has_text='supabase الحقيقي')).to_be_visible()
    m.locator('[data-act="delTask"]').first.click(); m.click('#cfOk')
    m.goto(URL + '#radar'); m.click('[data-act="radarTab"][data-tab="trash"]')
    m.click('[data-act="purgeTask"]'); m.click('#cfOk'); m.wait_for_timeout(800)
    assert len(DB['mt_tasks']) == 0, DB['mt_tasks']
    print('requests sample:', LOG[:3], '...', [l for l in LOG if l[0] == 'DELETE'][:1])
    b.close()
print('\n'.join(ERRORS) if ERRORS else 'NO CONSOLE ERRORS'); print('D END')
