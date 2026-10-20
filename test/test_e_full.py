from t_basic import *

GM = ('gm@innovalz.com', 'gmpass99')
AB = ('abdelrahman@innovalz.com', 'abd12345')
MI = ('mirna@innovalz.com', 'mirna123')

def body(b):
    # ---------- 1) missing env ----------
    api('reset', {}); api('config', {'envMissing': True, 'fail': False, 'noTables': False})
    c0 = b.new_context(viewport={'width': 1280, 'height': 860}); setup(c0)
    p0 = c0.new_page(); watch(p0, 'ENV')
    p0.goto(URL)
    expect(p0.locator('h1')).to_contain_text('إعدادات Supabase ناقصة')
    expect(p0.locator('.code')).to_contain_text('SUPABASE_SERVICE_ROLE_KEY')
    shot(p0, 'e01-env-missing')
    api('config', {'envMissing': False, 'noTables': True})
    p0.click('[data-act="reload"]')
    expect(p0.locator('h1')).to_contain_text('جداول قاعدة البيانات', timeout=8000)
    api('config', {'noTables': False})
    p0.reload()
    # ---------- 2) first run: create GM ----------
    expect(p0.locator('h1')).to_contain_text('أول تشغيل', timeout=8000)
    assert p0.locator('.emp-card').count() == 0
    shot(p0, 'e02-setup')
    p0.fill('#suName', 'تامر'); p0.fill('#loginEmail', 'bad'); p0.fill('#loginPass', '123')
    p0.click('[data-act="loginSubmit"]'); toast_has(p0, 'اكتب الإيميل صح')
    p0.fill('#loginEmail', GM[0]); p0.click('[data-act="loginSubmit"]'); toast_has(p0, '6 حروف')
    p0.fill('#loginPass', GM[1]); p0.click('[data-act="loginSubmit"]')
    expect(p0.locator('.home h1')).to_be_visible(timeout=8000)
    clear_toasts(p0)
    expect(p0.locator('.chip', has_text='الإعدادات')).to_be_visible()
    assert 'المبيعات' not in p0.locator('body').inner_text()
    shot(p0, 'e03-gm-home')
    # setup can't run twice
    r = urllib.request.Request('http://127.0.0.1:8765/api/admin', data=json.dumps({'action': 'setup', 'name': 'x', 'email': 'x@y.com', 'password': '123456'}).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try: urllib.request.urlopen(r); assert False, 'setup ran twice'
    except urllib.error.HTTPError as e: assert e.code == 409
    # ---------- 3) GM adds team ----------
    p0.goto(URL + '#team')
    def add_emp(name, email, pw, role_label, expect_ok=True, err=None):
        p0.click('.page-head [data-act="empForm"]')
        p0.fill('#emName', name); p0.fill('#emEmail', email); p0.fill('#emPass', pw)
        p0.select_option('#emRole', label=role_label)
        p0.click('[data-act="saveEmp"]')
        if expect_ok: toast_has(p0, name + ' اتضاف', 8000); clear_toasts(p0)
        else: toast_has(p0, err, 8000); clear_toasts(p0); p0.keyboard.press('Escape')
    add_emp('ميرنا', MI[0], '123', 'موظف عادي', False, '6 حروف')
    add_emp('عبدالرحمن العقيلي', AB[0], AB[1], 'مدير قسم')
    add_emp('ميرنا', MI[0], MI[1], 'موظف عادي')
    add_emp('ميرنا 2', MI[0], 'xxxxxx', 'موظف عادي', False, 'الإيميل ده مستخدم')
    add_emp('نهر', 'nahr@innovalz.com', 'nahr1234', 'موظف عادي')
    expect(p0.locator('.lrow')).to_have_count(4)
    shot(p0, 'e04-team')
    # role create via server
    p0.click('[data-act="teamTab"][data-tab="roles"]')
    p0.click('.page-head [data-act="roleForm"]'); p0.fill('#roName', 'ديزاينر')
    p0.locator('.check', has_text='رؤية حسابات العملاء').click(); p0.click('[data-act="saveRole"]')
    toast_has(p0, 'الدور اتحفظ', 8000)
    dump = api('dump'); assert any(r['data']['name'] == 'ديزاينر' for r in dump['db']['mt_roles'].values())
    p0.locator('.lrow', has_text='ديزاينر').locator('[data-act="delRole"]').click(); p0.click('#cfOk'); toast_has(p0, 'الدور اتحذف', 8000)
    # ---------- 4) login page: only email + password ----------
    c1 = b.new_context(viewport={'width': 1280, 'height': 860}, accept_downloads=True); setup(c1)
    a = c1.new_page(); watch(a, 'ABD')
    a.goto(URL)
    expect(a.locator('#loginEmail')).to_be_visible(timeout=8000)
    assert a.locator('.emp-card').count() == 0 and 'ميرنا' not in a.locator('body').inner_text()
    shot(a, 'e05-login')
    a.fill('#loginEmail', AB[0]); a.fill('#loginPass', 'wrong-pass'); a.keyboard.press('Enter')
    toast_has(a, 'الإيميل أو كلمة السر مش صح', 8000)
    a.fill('#loginPass', AB[1]); a.keyboard.press('Enter')
    expect(a.locator('.home h1')).to_be_visible(timeout=8000); clear_toasts(a)
    assert 'المبيعات' not in a.locator('body').inner_text()
    a.click('.chip:has-text("لوحة المدير")')
    expect(a.locator('#pomoCard')).to_be_visible()
    shot(a, 'e06-dash')
    # ---------- 5) Mirna on phone ----------
    c2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); setup(c2)
    m = c2.new_page(); watch(m, 'MIRNA')
    m.goto(URL); login(m, *MI); clear_toasts(m)
    expect(m.locator('.action.locked')).to_have_count(1)
    m.locator('.bottomnav button', has_text='تاسكاتي').click()
    # wait realtime subscribed
    expect(m.locator('[data-act="cloudInfo"] .cloud-dot.live')).to_have_count(1, timeout=8000)
    # Abdelrahman sends → Mirna live (real supabase-js realtime over websocket)
    a.goto(URL + '#send'); a.locator('.emp-card', has_text='ميرنا').click()
    a.fill('#taskText', 'تصميم بوست لعميل Meta Health'); a.keyboard.press('Enter')
    expect(a.locator('.success h2')).to_be_visible()
    toast_has(m, 'تاسك جديد من عبدالرحمن', 8000)
    expect(m.locator('.task', has_text='تصميم بوست')).to_be_visible(timeout=4000)
    shot(m, 'e07-mirna-live')
    m.locator('[data-act="doneTask"]').first.click()
    toast_has(a, 'ميرنا خلّص التاسك', 8000)
    # chat
    m.click('#chatFab'); m.fill('#chatInput', 'خلصت 🙏'); m.keyboard.press('Enter')
    expect(a.locator('#chatBadge')).to_have_text('1', timeout=8000)
    a.click('#chatFab'); a.fill('#chatInput', 'برافو يا ميرنا'); a.keyboard.press('Enter')
    expect(m.locator('.msg.other', has_text='برافو يا ميرنا')).to_be_visible(timeout=8000)
    m.click('#chat [data-act="chatClose"] >> nth=1'); a.click('#chat [data-act="chatClose"] >> nth=1')
    # Mirna cannot escalate herself via REST (RLS)
    res = m.evaluate("""async () => { const s = JSON.parse(localStorage.getItem('mynd-auth')); const tok = s.access_token || (s.currentSession && s.currentSession.access_token);
        const r = await fetch('/sb/rest/v1/mt_employees', {method:'POST', headers:{apikey:'anon-key-test-0123456789', Authorization:'Bearer '+tok, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates'}, body: JSON.stringify([{id:s.user.id, data:{id:s.user.id, name:'ميرنا', roleId:'gm'}}])});
        const r2 = await fetch('/api/admin', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+tok}, body: JSON.stringify({action:'saveEmployee', employee:{id:s.user.id, name:'ميرنا', email:'mirna@innovalz.com', roleId:'gm'}})});
        return [r.status, r2.status]; }""")
    print('escalation attempts:', res); assert res == [403, 403], res
    # anon can't read anything
    st = m.evaluate("fetch('/sb/rest/v1/mt_tasks?select=id,data',{headers:{apikey:'anon-key-test-0123456789'}}).then(r=>r.status)")
    assert st == 401, st
    # ---------- 6) GM grants Mirna send_tasks → her UI updates live ----------
    p0.goto(URL + '#team'); p0.click('[data-act="teamTab"][data-tab="emps"]')
    p0.locator('.lrow', has_text='ميرنا').locator('[data-act="empForm"]').click()
    p0.locator('summary').click(); p0.locator('.check', has_text='إرسال تاسكات للموظفين').click()
    p0.click('[data-act="saveEmp"]'); toast_has(p0, 'اتحدثت', 8000)
    m.locator('.bottomnav button', has_text='الرئيسية').click()
    expect(m.locator('.action.locked')).to_have_count(0, timeout=8000)
    # ---------- 7) offline queue ----------
    api('config', {'fail': True})
    a.goto(URL + '#home'); a.click('.action:has-text("ابعت تاسك")'); a.locator('.emp-card', has_text='ميرنا').click()
    a.fill('#taskText', 'تاسك والنت فاصل'); a.keyboard.press('Enter')
    expect(a.locator('.success h2')).to_be_visible()
    a.wait_for_timeout(800)
    api('config', {'fail': False})
    a.evaluate("window.dispatchEvent(new Event('online'))")
    m.locator('.bottomnav button', has_text='تاسكاتي').click()
    expect(m.locator('.task', has_text='والنت فاصل')).to_be_visible(timeout=15000)
    # ---------- 8) reload keeps session ----------
    m.reload()
    expect(m.locator('h2', has_text='تاسكاتي')).to_be_visible(timeout=8000)
    expect(m.locator('.task', has_text='والنت فاصل')).to_be_visible()
    # ---------- 9) dashboard pieces + clients + exports + backup (Abdelrahman) ----------
    a.goto(URL + '#dash')
    expect(a.locator('.card', has_text='تاسكات بعتها ولسه مستنيها')).to_contain_text('والنت فاصل')
    pr = a.locator('[data-chg="prioText"]').first; pr.fill('مراجعة خطة المحتوى'); pr.press('Enter'); a.wait_for_timeout(300)
    a.click('[data-act="pomoToggle"]'); a.wait_for_timeout(1300)
    a.click('[data-act="dashTab"][data-tab="team"]'); shot(a, 'e08-dash-team')
    a.goto(URL + '#clients'); a.click('[data-act="clientForm"]'); a.fill('#clName', 'Meta Health'); a.click('[data-act="saveClient"]'); toast_has(a, 'العميل اتضاف')
    a.locator('.client-card', has_text='Meta Health').click()
    a.fill('#evNote', 'اجتماع بداية الشهر'); a.click('[data-act="addEvent"]'); expect(a.locator('.tl')).to_have_count(1)
    a.wait_for_timeout(600)
    dump = api('dump')
    assert len(dump['db']['mt_clients']) == 1 and len(dump['db']['mt_client_events']) == 1, {k: len(v) for k, v in dump['db'].items()}
    assert any(k.startswith('prio_') for k in dump['db']['mt_settings']), dump['db']['mt_settings']
    a.goto(URL + '#reports')
    for kind in ['tasks', 'perf']:
        with a.expect_download() as dl: a.click(f'[data-act="export"][data-kind="{kind}"]')
        assert dl.value.suggested_filename.endswith('.xlsx')
    # ---------- 10) change password from profile ----------
    a.click('.me-chip'); a.fill('#pfOld', 'nope-nope'); a.fill('#pfNew', 'newpass77'); a.click('[data-act="changePass"]'); toast_has(a, 'الحالية مش صح', 8000)
    a.fill('#pfOld', AB[1]); a.click('[data-act="changePass"]'); toast_has(a, 'كلمة السر اتغيرت', 8000)
    logout(a); login(a, AB[0], 'newpass77'); clear_toasts(a)
    # ---------- 11) GM settings + backup ----------
    p0.goto(URL + '#settings'); expect(p0.locator('[data-cloud-label]')).to_contain_text('متصل')
    assert p0.locator('#sbUrl').count() == 0
    with p0.expect_download() as dl: p0.click('[data-act="backup"]')
    assert dl.value.suggested_filename.endswith('.json')
    shot(p0, 'e09-settings')
    # ---------- 12) GM deletes Mirna → she is signed out live ----------
    p0.goto(URL + '#team')
    p0.locator('.lrow', has_text='ميرنا').locator('[data-act="delEmp"]').click(); p0.click('#cfOk')
    toast_has(p0, 'اتحذف من الفريق', 8000)
    expect(m.locator('#loginEmail')).to_be_visible(timeout=8000)
    toast_has(m, 'حسابك اتشال', 8000)
    m.fill('#loginEmail', MI[0]); m.fill('#loginPass', MI[1]); m.keyboard.press('Enter')
    toast_has(m, 'الإيميل أو كلمة السر مش صح', 8000)
    dump = api('dump'); assert all(u['email'] != MI[0] for u in dump['users'])
    # GM can't delete self, last GM protection
    p0.goto(URL + '#team'); assert p0.locator('.lrow', has_text='تامر').locator('[data-act="delEmp"]').count() == 0
    print('server log:', [l for l in dump['log']][:4])

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch()
        try:
            body(b)
            print('E PASSED')
        except Exception:
            import traceback; traceback.print_exc()
            for i, pg in enumerate(PAGES):
                try: pg.screenshot(path=str(SHOTS / f'FAIL-{i}.png'))
                except Exception: pass
        b.close()
    print('\n'.join(ERRORS) if ERRORS else 'NO CONSOLE ERRORS')
