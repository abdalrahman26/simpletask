from t_basic import *
seed_team()
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); setup(ctx)
    page=ctx.new_page(); watch(page,'M'); page.goto(URL)
    expect(page.locator('#loginEmail')).to_be_visible(timeout=8000); shot(page,'m01-login')
    login(page, EMAIL['عبدالرحمن العقيلي'], PW); clear_toasts(page)
    def overflow(): return page.evaluate("document.documentElement.scrollWidth - innerWidth")
    shot(page,'m02-home'); assert overflow()<=0, overflow()
    page.locator('.bottomnav button', has_text='ابعت').click(); assert overflow()<=0
    page.locator('.emp-card', has_text='ميرنا').click()
    page.fill('#taskText','تاسك من الموبايل'); page.click('[data-act="toggleMore"]')
    shot(page,'m04-send2'); assert overflow()<=0
    page.click('[data-act="openPicker"]'); page.wait_for_timeout(400); shot(page,'m05-picker'); page.click('[data-act="dpConfirm"]')
    page.click('[data-act="sendTask"]'); expect(page.locator('.success h2')).to_be_visible()
    page.locator('.bottomnav button', has_text='تاسكاتي').click(); page.click('[data-act="tasksTab"][data-tab="sent"]'); shot(page,'m06-tasks'); assert overflow()<=0
    page.locator('.bottomnav button', has_text='لوحة المدير').click(); page.wait_for_timeout(300); shot(page,'m07-dash'); assert overflow()<=0, overflow()
    page.click('[data-act="dashTab"][data-tab="team"]'); shot(page,'m08-dash-team'); assert overflow()<=0
    for v in ['reports','clients','radar','team','settings']:
        page.goto(URL+'#'+v); page.wait_for_timeout(250); shot(page,'m-'+v); assert overflow()<=0, (v, overflow())
    page.click('#chatFab'); page.fill('#chatInput','أهلاً'); page.keyboard.press('Enter'); page.wait_for_timeout(400); shot(page,'m14-chat')
    page.click('#chat [data-act="chatClose"] >> nth=1')
    page.set_viewport_size({'width':900,'height':1100}); page.goto(URL+'#dash'); page.wait_for_timeout(300); shot(page,'t01-dash-tablet'); assert overflow()<=0
    b.close()
print('\n'.join(ERRORS) if ERRORS else 'NO CONSOLE ERRORS'); print('C DONE')
