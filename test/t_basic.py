import os, sys, time, json, pathlib
from playwright.sync_api import sync_playwright, expect

HERE = pathlib.Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8765/'
SHOTS = HERE / 'shots'; SHOTS.mkdir(exist_ok=True)
EXCEL = (HERE / 'node_modules/exceljs/dist/exceljs.min.js').read_text()
REAL_SB = (HERE / 'real-supabase.js').read_text()
ERRORS = []
PAGES = []

def setup(ctx):
    ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    ctx.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    ctx.route('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/**', lambda r: r.fulfill(status=200, body=EXCEL, content_type='application/javascript'))
    ctx.route('https://cdn.jsdelivr.net/npm/@supabase/**', lambda r: r.fulfill(status=200, body=REAL_SB, content_type='application/javascript'))

def watch(page, tag):
    page.on('console', lambda m: ERRORS.append(f'[{tag}] console.{m.type}: {m.text}') if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    PAGES.append(page)
    page.on('pageerror', lambda e: ERRORS.append(f'[{tag}] pageerror: {e}'))
    page.on('dialog', lambda d: (ERRORS.append(f'[{tag}] DIALOG (xss?): {d.message}'), d.dismiss()))

def shot(page, name):
    page.screenshot(path=str(SHOTS / f'{name}.png'), full_page=False)

def login(page, email, pw):
    expect(page.locator('#loginEmail')).to_be_visible(timeout=8000)
    page.fill('#loginEmail', email); page.fill('#loginPass', pw); page.keyboard.press('Enter')
    expect(page.locator('.home h1')).to_have_text('ماذا تريد أن تفعل الآن؟', timeout=8000)

def logout(page):
    page.goto(URL + '#home'); page.click('.home-pill [data-act="logout"]')
    expect(page.locator('#loginEmail')).to_be_visible(timeout=8000)

import urllib.request
def api(path, body=None):
    req = urllib.request.Request('http://127.0.0.1:8765/fake/' + path, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    return json.loads(urllib.request.urlopen(req).read())

def toast_has(page, text, timeout=4000):
    expect(page.locator('.toast', has_text=text).first).to_be_visible(timeout=timeout)

def clear_toasts(page):
    page.evaluate("document.querySelectorAll('.toast').forEach(t=>t.remove())")

TEAM = [('عبدالرحمن العقيلي', 'abdelrahman@innovalz.com', 'dept'), ('ميرنا', 'mirna@innovalz.com', 'emp'), ('haleem', 'haleem@innovalz.com', 'emp'),
        ('محمد شريف', 'msherif@innovalz.com', 'emp'), ('نهر', 'nahr@innovalz.com', 'emp'), ('عبدالله صلاح', 'abdallah@innovalz.com', 'emp'),
        ('محمد صلاح', 'msalah@innovalz.com', 'emp'), ('بشمهندس معاطي', 'moaty@innovalz.com', 'emp')]
PW = '123456'
EMAIL = {n: e for n, e, r in TEAM}
EMAIL['المدير العام'] = 'gm@innovalz.com'

def post(url, body, token=None):
    h = {'Content-Type': 'application/json', 'apikey': 'anon-key-test-0123456789'}
    if token: h['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request('http://127.0.0.1:8765' + url, data=json.dumps(body).encode(), headers=h, method='POST')
    return json.loads(urllib.request.urlopen(req).read() or b'{}')

def seed_team():
    api('reset', {}); api('config', {'envMissing': False, 'fail': False, 'noTables': False})
    post('/api/admin', {'action': 'setup', 'name': 'المدير العام', 'email': EMAIL['المدير العام'], 'password': PW})
    tok = post('/sb/auth/v1/token?grant_type=password', {'email': EMAIL['المدير العام'], 'password': PW})['access_token']
    for n, e, r in TEAM:
        out = post('/api/admin', {'action': 'saveEmployee', 'employee': {'name': n, 'email': e, 'password': PW, 'roleId': r, 'dept': 'التسويق والعمليات'}}, tok)
        assert out.get('ok'), out
