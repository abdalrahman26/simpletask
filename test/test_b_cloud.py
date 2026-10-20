from t_basic import *
import urllib.request

def api(path, body=None):
    req = urllib.request.Request('http://127.0.0.1:8765/fake/' + path, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json'}, method='POST' if body is not None else 'GET')
    return json.loads(urllib.request.urlopen(req).read())

def connect(page, expect_existing):
    page.goto(URL + '#settings')
    page.fill('#sbUrl', 'https://fake-project.supabase.co')
    page.fill('#sbKey', 'k' * 40)
    page.click('[data-act="cloudOn"]')
    if expect_existing:
        expect(page.locator('#confirm h3')).to_contain_text('السحابة فيها بيانات')
        page.click('#cfOk')
    toast_has(page, 'اتربطت بالسحابة', 6000)
    expect(page.locator('[data-cloud-label]').first).to_contain_text('تزامن لحظي', timeout=5000)

def run():
    api('reset', {}); api('config', {'fail': False, 'no_tables': False})
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---- device 1: GM (laptop)
        c1 = b.new_context(viewport={'width': 1280, 'height': 860}); setup(c1)
        g = c1.new_page(); watch(g, 'GM')
        g.goto(URL); login(g, 'المدير العام'); clear_toasts(g)
        # missing tables → helpful error
        api('config', {'no_tables': True})
        g.goto(URL + '#settings'); g.fill('#sbUrl', 'https://fake-project.supabase.co'); g.fill('#sbKey', 'k' * 40)
        g.click('[data-act="cloudOn"]')
        toast_has(g, 'شغّل سكربت SQL')
        api('config', {'no_tables': False})
        clear_toasts(g)
        g.click('[data-act="cloudOn"]')
        toast_has(g, 'اتربطت بالسحابة', 6000)
        dump = api('dump')
        assert len(dump['mt_employees']) == 9 and len(dump['mt_roles']) == 4, {k: len(v) for k, v in dump.items()}
        print('uploaded:', {k: len(v) for k, v in dump.items()})

        # ---- device 2: Mirna (phone, separate browser storage)
        c2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); setup(c2)
        m = c2.new_page(); watch(m, 'MIRNA')
        m.goto(URL); login(m, 'المدير العام'); clear_toasts(m)
        connect(m, True)
        m.goto(URL + '#home'); m.click('[data-act="logout"]')
        login(m, 'ميرنا'); clear_toasts(m)
        m.locator('.bottomnav button', has_text='تاسكاتي').click()
        expect(m.locator('.empty')).to_be_visible()

        # ---- GM sends task → Mirna gets it live
        g.goto(URL + '#send'); g.locator('.emp-card', has_text='ميرنا').click()
        g.fill('#taskText', 'تاسك لحظي من المدير'); g.keyboard.press('Enter')
        expect(g.locator('.success h2')).to_be_visible()
        toast_has(m, 'تاسك جديد من المدير العام', 6000)
        expect(m.locator('.task', has_text='تاسك لحظي من المدير')).to_be_visible(timeout=3000)
        shot(m, 'c01-mirna-live')
        # Mirna finishes → GM notified
        m.locator('[data-act="doneTask"]').first.click()
        toast_has(g, 'ميرنا خلّص التاسك', 6000)
        # chat both ways
        m.click('#chatFab'); m.fill('#chatInput', 'خلصت يا فندم 🙏'); m.keyboard.press('Enter')
        expect(g.locator('#chatBadge')).to_have_text('1', timeout=5000)
        g.click('#chatFab'); expect(g.locator('.msg.other', has_text='خلصت يا فندم')).to_be_visible()
        g.fill('#chatInput', 'برافو'); g.keyboard.press('Enter')
        expect(m.locator('.msg.other', has_text='برافو')).to_be_visible(timeout=5000)
        m.click('#chat [data-act="chatClose"] >> nth=1'); g.click('#chat [data-act="chatClose"] >> nth=1')
        # permission change live: GM gives Mirna send_tasks
        g.goto(URL + '#team')
        g.locator('.lrow', has_text='ميرنا').locator('[data-act="empForm"]').click()
        g.locator('summary').click()
        g.locator('.check', has_text='إرسال تاسكات للموظفين').click()
        g.click('[data-act="saveEmp"]')
        m.locator('.bottomnav button', has_text='الرئيسية').click()
        expect(m.locator('.action.locked')).to_have_count(0, timeout=5000)
        # delete live
        g.goto(URL + '#tasks'); g.click('[data-act="tasksTab"][data-tab="sent"]')
        g.locator('[data-act="delTask"]').first.click(); g.click('#cfOk')
        m.locator('.bottomnav button', has_text='تاسكاتي').click()
        m.click('[data-act="tasksTab"][data-tab="done"]')
        expect(m.locator('.task')).to_have_count(0, timeout=5000)

        # ---- offline queue: GM goes offline, makes change, comes back
        api('config', {'fail': True})
        g.goto(URL + '#send'); g.locator('.emp-card', has_text='ميرنا').click()
        g.fill('#taskText', 'تاسك اتبعت والنت فاصل'); g.keyboard.press('Enter')
        expect(g.locator('.success h2')).to_be_visible()
        g.wait_for_timeout(600)
        g.goto(URL + '#settings')
        expect(g.locator('.tag.run', has_text='تعديل مستني')).to_be_visible()
        api('config', {'fail': False})
        g.evaluate("window.dispatchEvent(new Event('online'))")
        m.click('[data-act="tasksTab"][data-tab="mine"]')
        expect(m.locator('.task', has_text='والنت فاصل')).to_be_visible(timeout=8000)
        g.goto(URL + '#settings')
        expect(g.locator('.tag.run', has_text='تعديل مستني')).to_have_count(0, timeout=5000)

        # ---- reload keeps cloud + session
        m.reload(); expect(m.locator('h2', has_text='تاسكاتي')).to_be_visible()
        expect(m.locator('.task', has_text='والنت فاصل')).to_be_visible(timeout=5000)

        # ---- deal live on dashboard
        a = c1.new_page(); watch(a, 'ABD')
        g.goto(URL + '#home'); g.click('[data-act="logout"]'); login(g, 'عبدالرحمن'); clear_toasts(g)
        g.goto(URL + '#sales'); g.click('[data-act="dealForm"] >> nth=0'); g.fill('#dlName', 'ليد سحابي'); g.fill('#dlValue', '5000'); g.click('[data-act="saveDeal"]')
        g.wait_for_timeout(1000); dump = api('dump'); assert any(r['data']['name'] == 'ليد سحابي' for r in dump['mt_deals'].values())
        a.close()

        # ---- disconnect
        g.goto(URL + '#home'); g.click('[data-act="logout"]'); login(g, 'المدير العام')
        g.goto(URL + '#settings'); g.click('[data-act="cloudOff"]'); g.click('#cfOk')
        toast_has(g, 'السحابة اتفصلت')
        b.close()

if __name__ == '__main__':
    try:
        run()
    except Exception:
        import traceback; traceback.print_exc()
    print('\n'.join(ERRORS) if ERRORS else 'NO CONSOLE ERRORS')
    print('B END')
