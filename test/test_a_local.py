from t_basic import *

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 860}, accept_downloads=True)
        setup(ctx)
        page = ctx.new_page(); watch(page, 'A')
        try:
            body(b, ctx, page)
        except Exception:
            for i,pg in enumerate(PAGES):
                try: pg.screenshot(path=str(SHOTS/f'FAIL-{i}.png'))
                except Exception: pass
            raise

def body(b, ctx, page):
    if True:
        seed_team()
        page.goto(URL)
        page.fill('#loginEmail', EMAIL['عبدالرحمن العقيلي']); page.fill('#loginPass', 'wrong1'); page.keyboard.press('Enter')
        toast_has(page, 'كلمة السر مش صح', 8000)
        page.fill('#loginPass', '123456'); page.click('[data-act="loginSubmit"]')
        expect(page.locator('.home h1')).to_be_visible()
        clear_toasts(page)
        expect(page.locator('.chip', has_text='لوحة المدير')).to_be_visible()
        expect(page.locator('.chip', has_text='الإعدادات')).to_have_count(0)  # dept manager no settings
        shot(page, '02-home')

        # ---- send task via Enter
        page.click('.action:has-text("ابعت تاسك")')
        expect(page.locator('h2', has_text='هتبعتها لمين؟')).to_be_visible()
        expect(page.locator('.emp-grid .emp-card')).to_have_count(9)  # 7 others + GM + self
        shot(page, '03-send-step1')
        page.locator('.emp-card', has_text='ميرنا').click()
        expect(page.locator('.to-row b')).to_have_text('ميرنا')
        expect(page.locator('.due-btn.on')).to_have_text('غداً (افتراضي)')
        shot(page, '04-send-step2')
        page.keyboard.press('Enter')  # empty
        toast_has(page, 'اكتب التاسك الأول')
        page.fill('#taskText', 'تصميم 3 بوستات لـ Meta Health https://drive.google.com/abc.')
        page.keyboard.press('Shift+Enter')
        page.keyboard.type('السطر التاني')
        page.keyboard.press('Enter')
        expect(page.locator('.success h2')).to_be_visible()
        shot(page, '05-success')
        # send again to same person with custom date
        page.click('[data-act="sendAgain"]')
        expect(page.locator('.to-row b')).to_have_text('ميرنا')
        page.fill('#taskText', 'تاسك بتاريخ مخصص')
        page.click('[data-act="openPicker"]')
        expect(page.locator('.dp-head')).to_be_visible()
        shot(page, '06-picker')
        page.click('[data-act="dpNext"]')
        page.locator('.dp-day:not([disabled])', has_text='15').first.click()
        page.click('[data-act="dpQuick"][data-t="15:00"]')
        page.click('[data-act="dpConfirm"]')
        expect(page.locator('.due-btn.on')).to_contain_text('تاريخ مخصص')
        expect(page.locator('#taskText')).to_have_value('تاسك بتاريخ مخصص')
        badge = page.locator('.due-badge').inner_text(); print('custom badge:', badge)
        assert '3:00 م' in badge
        # extras: client + urgent + link
        page.click('[data-act="toggleMore"]')
        page.click('[data-act="sendPrio"][data-p="high"]')
        page.fill('[data-inp="sendLink"]', 'javascript:alert(1)')
        page.click('[data-act="sendTask"]')
        toast_has(page, 'الرابط مش صحيح')
        page.fill('[data-inp="sendLink"]', 'drive.google.com/file/x')
        page.click('[data-act="sendTask"]')
        expect(page.locator('.success h2')).to_be_visible()
        # self task, today kind, XSS text
        page.click('[data-act="sendOther"]')
        page.locator('.emp-card.self').click()
        page.click('[data-act="dueKind"][data-kind="today"]')
        page.fill('#taskText', '<img src=x onerror=alert(1)> مراجعة الخطة')
        page.click('[data-act="sendTask"]')
        expect(page.locator('.success h2')).to_be_visible()

        # ---- tasks view
        page.click('[data-act="go"][data-view="tasks"] >> nth=0')
        expect(page.locator('.tabs button.on')).to_contain_text('مطلوبة مني (1)')
        expect(page.locator('.t-text', has_text='<img src=x onerror=alert(1)>')).to_be_visible()
        page.click('[data-act="tasksTab"][data-tab="sent"]')
        expect(page.locator('.task')).to_have_count(2)
        expect(page.locator('.tag.hot')).to_have_count(1)
        # open link in in-app browser
        page.locator('.ilink').first.click()
        expect(page.locator('#browser .browser-url')).to_contain_text('drive.google.com/abc')
        page.keyboard.press('Escape')
        expect(page.locator('#browser.open')).to_have_count(0)
        page.click('[data-act="tasksTab"][data-tab="team"]')
        shot(page, '07-tasks-team')
        # complete my own task + undo
        page.click('[data-act="tasksTab"][data-tab="mine"]')
        page.locator('[data-act="doneTask"]').first.click()
        toast_has(page, 'برافو')
        expect(page.locator('.tabs button', has_text='أنجزتها (1)')).to_be_visible()
        page.click('[data-act="tasksTab"][data-tab="done"]')
        page.locator('[data-act="reopenTask"]').first.click()
        expect(page.locator('.tabs button', has_text='مطلوبة مني (1)')).to_be_visible()
        # delete with reason → trash → restore
        page.click('[data-act="tasksTab"][data-tab="sent"]')
        page.locator('.task', has_text='تاسك بتاريخ مخصص').locator('[data-act="delTask"]').click()
        page.fill('#cfIn', 'العميل لغاه')
        page.click('#cfOk')
        toast_has(page, 'سلة المحذوفات')
        expect(page.locator('.task')).to_have_count(1)
        clear_toasts(page)

        # ---- radar
        page.click('.top-nav [data-view="home"]')
        page.click('.chip:has-text("رادار المهام")')
        expect(page.locator('.lrow').first).to_be_visible()
        expect(page.locator('[data-tab="trash"]')).to_have_count(0)  # dept mgr no trash perm
        shot(page, '08-radar')

        # ---- reports + exports
        page.click('.top-nav [data-view="reports"]')
        expect(page.locator('.kpi .v').first).to_have_text('2')
        shot(page, '09-reports')
        assert page.locator('[data-kind="sales"]').count() == 0
        for kind in ['tasks', 'perf']:
            with page.expect_download() as dl:
                page.click(f'[data-act="export"][data-kind="{kind}"]')
            d = dl.value; path = SHOTS / d.suggested_filename; d.save_as(str(path))
            assert d.suggested_filename.endswith('.xlsx'), d.suggested_filename

        # ---- clients
        page.click('.top-nav [data-view="clients"]')
        expect(page.locator('.client-card')).to_have_count(0)
        page.click('[data-act="clientForm"]'); page.fill('#clName', 'Meta Health'); page.click('[data-act="saveClient"]'); toast_has(page, 'العميل اتضاف')
        page.click('[data-act="clientForm"]')
        page.fill('#clName', 'meta health')
        page.click('[data-act="saveClient"]')
        toast_has(page, 'في عميل بنفس الاسم')
        page.fill('#clName', 'Nassar <b>Brand</b>')
        page.fill('#clBud', '١٥٬٠٠٠')
        page.fill('#clWeb', 'example.com')
        page.locator('.check', has_text='تيك توك').click()
        page.click('[data-act="saveClient"]')
        toast_has(page, 'العميل اتضاف')
        expect(page.locator('.client-card')).to_have_count(2)
        page.locator('.client-card', has_text='Nassar').click()
        expect(page.locator('.title-row h2')).to_have_text('Nassar <b>Brand</b>')
        expect(page.locator('.info', has_text='الميزانية')).to_contain_text('15,000')
        page.fill('#evNote', 'اجتماع بداية الشهر')
        page.click('[data-act="addEvent"]')
        expect(page.locator('.tl')).to_have_count(1)
        page.click('[data-act="sendForClient"]')
        expect(page.locator('.client-banner')).to_contain_text('Nassar')
        page.locator('.emp-card', has_text='نهر').click()
        page.fill('#taskText', 'ريل للعميل')
        page.keyboard.press('Enter')
        expect(page.locator('.success h2')).to_be_visible()
        page.click('.top-nav [data-view="clients"]')
        page.locator('.client-card', has_text='Nassar').click()
        expect(page.locator('.task')).to_have_count(1)
        shot(page, '10-client')

        # ---- dashboard
        page.click('.top-nav [data-view="dash"]')
        expect(page.locator('#pomoCard')).to_be_visible()
        assert page.locator('.target-card').count() == 0 and page.locator('[data-tab="sales"]').count() == 0
        shot(page, '11-dash-daily')
        pr = page.locator('[data-chg="prioText"]').first
        pr.fill('مراجعة خطة المحتوى'); pr.press('Enter')
        page.wait_for_timeout(300)
        page.locator('[data-chg="prioDone"]').first.check()
        page.wait_for_timeout(300)
        expect(page.locator('.prio.done')).to_have_count(1)
        page.click('[data-act="pomoToggle"]')
        page.wait_for_timeout(2100)
        t = page.locator('#pomoTime').inner_text(); assert t in ('24:59', '24:58', '24:57'), t
        page.select_option('[data-chg="pomoTask"]', index=1)
        expect(page.locator('.card', has_text='تاسكات بعتها ولسه مستنيها')).to_contain_text('ريل للعميل')
        page.click('[data-act="dashTab"][data-tab="team"]')
        shot(page, '14-dash-team')
        page.click('.top-nav [data-view="home"]')
        page.click('[data-act="go"][data-view="tasks"]')
        expect(page.locator('#pomoMini')).to_be_visible()

        # ---- chat
        page.click('#chatFab')
        page.fill('#chatInput', 'ازيكم يا فريق www.innovalz.com')
        page.keyboard.press('Enter')
        expect(page.locator('.msg.mine')).to_have_count(1)
        page.click('[data-act="chatEmoji"][data-e="🔥"]')
        page.keyboard.press('Enter')
        expect(page.locator('.msg.mine')).to_have_count(2)
        shot(page, '15-chat')
        page.keyboard.press('Escape')
        expect(page.locator('#chat')).to_be_hidden()

        # ---- team (dept manager can manage employees, not roles)
        page.click('.top-nav [data-view="home"]')
        page.click('.chip:has-text("الموظفين")')
        expect(page.locator('[data-tab="roles"]')).to_have_count(0)
        page.click('.page-head [data-act="empForm"]')
        page.fill('#emName', 'يارا'); page.fill('#emEmail', 'yara@innovalz.com'); page.fill('#emPass', 'yara1234')
        page.click('[data-act="saveEmp"]')
        toast_has(page, 'يارا اتضاف', 8000)
        page.click('.page-head [data-act="empForm"]')
        assert page.locator('#emRole option[value="gm"]').count() == 0
        page.keyboard.press('Escape')
        shot(page, '16-team')
        logout(page)

        # ---- regular employee
        login(page, EMAIL['ميرنا'], '123456')
        expect(page.locator('.action.locked')).to_have_count(1)
        expect(page.locator('.admin-row')).to_have_count(0)
        page.click('.action.locked'); toast_has(page, 'مش معاك صلاحية')
        page.click('.action:has-text("تاسكاتي")')
        expect(page.locator('.tabs button', has_text='مطلوبة مني (1)')).to_be_visible()
        expect(page.locator('[data-tab="team"]')).to_have_count(0)
        page.locator('[data-act="doneTask"]').first.click()
        page.click('[data-act="go"][data-view="reports"] >> nth=0')
        expect(page.locator('.title-row h2')).to_have_text('إحصائياتي')
        page.goto(URL + '#dash')
        expect(page.locator('.title-row h2')).to_have_text('إحصائياتي')
        logout(page)

        # ---- GM: trash restore, roles, settings, backup
        login(page, EMAIL['المدير العام'], '123456')
        page.click('.chip:has-text("رادار المهام")')
        page.click('[data-act="radarTab"][data-tab="trash"]')
        expect(page.locator('.task', has_text='تاسك بتاريخ مخصص')).to_contain_text('العميل لغاه')
        page.click('[data-act="restoreTask"]')
        toast_has(page, 'التاسك رجع')
        page.goto(URL + '#team')
        page.click('[data-act="teamTab"][data-tab="roles"]')
        page.click('.page-head [data-act="roleForm"]')
        page.fill('#roName', 'ديزاينر'); page.locator('.check', has_text='رؤية حسابات العملاء').click()
        page.click('[data-act="saveRole"]'); toast_has(page, 'الدور اتحفظ', 8000)
        page.locator('.lrow', has_text='ديزاينر').locator('[data-act="roleForm"]').click()
        page.locator('.check', has_text='إرسال تاسكات').click(); page.click('[data-act="saveRole"]'); toast_has(page, 'الدور اتحفظ', 8000)
        page.locator('.lrow', has_text='ديزاينر').locator('[data-act="delRole"]').click()
        page.click('#cfOk'); toast_has(page, 'الدور اتحذف', 8000)
        page.locator('.lrow', has_text='موظف عادي').locator('[data-act="roleForm"]').click()
        assert page.locator('#roName').get_attribute('readonly') is not None
        page.keyboard.press('Escape')
        page.goto(URL + '#settings')
        shot(page, '17-settings')
        with page.expect_download() as dl:
            page.click('[data-act="backup"]')
        bk = SHOTS / 'backup.json'; dl.value.save_as(str(bk))
        data = json.loads(bk.read_text()); assert data['app'] == 'mynd-tasks' and len(data['data']['tasks']) >= 4
        page.goto(URL + '#home')
        page.click('.home-pill [data-act="toggleTheme"]')
        assert page.evaluate("document.documentElement.dataset.theme") == 'dark'
        page.wait_for_timeout(500); shot(page, '18-home-dark')
        page.goto(URL + '#tasks'); page.wait_for_timeout(300); shot(page, '19-tasks-dark')
        page.click('.top-tools [data-act="toggleTheme"]')
        b.close()

if __name__ == '__main__':
    try:
        run()
    except Exception as e:
        import traceback; traceback.print_exc()
        for i,pg in enumerate(PAGES):
            try: pg.screenshot(path=str(SHOTS/f'FAIL-{i}.png'))
            except Exception: pass
        print('\n'.join(ERRORS)); raise SystemExit(1)
    print('\n'.join(ERRORS) if ERRORS else 'NO CONSOLE ERRORS')
    print('A DONE')
