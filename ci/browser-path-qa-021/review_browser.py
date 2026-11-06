from pathlib import Path
from subprocess import Popen, PIPE
from playwright.sync_api import sync_playwright
import os, time, urllib.request, json, tempfile, traceback, sys
from urllib.parse import urlencode, urlparse, parse_qs

SCRIPT_DIR = Path(__file__).resolve().parent
OUT = Path(os.environ['QA_OUTPUT_DIR']).resolve()
OUT.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ['QA_BROWSER_PATH']
BASE = 'http://127.0.0.1:4826'
REPORT = {'source': '382c3e3ecde73bdbcf4a19fc6b683b608674ae17', 'synthetic': True, 'database': ':memory:', 'browserSandbox': True, 'authentication': 'Synthetic supervisor injected by loopback-only fixture; production login is not tested', 'checks': [], 'screenshots': [], 'layout': [], 'blockedExternalRequests': [], 'pageErrors': []}
server = None
browser = None
page = None
phase = 'fixture'

def check(name, condition, soft=False):
    REPORT['checks'].append({'name': name, 'pass': bool(condition)})
    if not condition and not soft:
        raise AssertionError(name)

def capture(page, name, full=False):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=full)
    REPORT['screenshots'].append(str(path))

try:
    with tempfile.TemporaryDirectory(prefix='teachabs-browser-runtime-') as runtime:
        env = {key:os.environ[key] for key in ['PATH','LANG','LC_ALL','TMPDIR'] if key in os.environ}
        env.update({'HOME': runtime, 'XDG_CONFIG_HOME': runtime + '/config', 'XDG_CACHE_HOME': runtime + '/cache', 'XDG_DATA_HOME': runtime + '/data'})
        server = Popen(['node', str(SCRIPT_DIR / 'fixture.mjs')], stdout=PIPE, stderr=PIPE, text=True)
        for _ in range(80):
            try:
                with urllib.request.urlopen(BASE + '/admin/school', timeout=.5) as response:
                    if response.status == 200:
                        break
            except Exception:
                if server.poll() is not None:
                    raise RuntimeError(server.communicate())
                time.sleep(.1)
        else:
            raise RuntimeError('Synthetic fixture not reachable in same execution')
        meta = json.loads((OUT / 'fixture-metadata.json').read_text())
        check('Synthetic fixture is current source and in-memory', meta['source'] == REPORT['source'] and meta['persistence'] is False)
        with sync_playwright() as p:
            phase = 'browser-launch'
            browser = p.chromium.launch(executable_path=BROWSER, headless=True, chromium_sandbox=True, env=env)
            REPORT['browserVersion'] = browser.version
            REPORT['browserExecutable'] = BROWSER
            phase = 'browser-checks'
            context = browser.new_context(viewport={'width':393,'height':852}, device_scale_factor=1, service_workers='block')
            def route_request(route):
                if route.request.url.startswith(BASE + '/'):
                    route.continue_()
                else:
                    REPORT['blockedExternalRequests'].append(route.request.url)
                    route.abort()
            context.route('**/*', route_request)
            page = context.new_page()
            page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))

            def state():
                response = context.request.get(BASE + '/__qa/state')
                check('Synthetic state endpoint is reachable', response.status == 200)
                return response.json()

            def selected(track, stage, grade):
                values = parse_qs(urlparse(page.url).query)
                return values.get('trackId') == [track] and values.get('stage') == [stage] and values.get('grade') == [str(grade)]

            def choose_context(track, stage, grade):
                nav = page.locator('form.school-selector').filter(has=page.locator('select[name="stage"]'))
                nav.locator('select[name="trackId"]').select_option(track)
                nav.locator('select[name="stage"]').select_option(stage)
                nav.get_by_role('button', name='عرض صفوف المرحلة', exact=True).click()
                grades = page.locator('form.school-selector').filter(has=page.locator('select[name="grade"]'))
                grades.locator('select[name="grade"]').select_option(str(grade))
                grades.get_by_role('button', name='عرض فصول الصف', exact=True).click()
                check('Selected context persists: ' + stage + '/' + str(grade), selected(track, stage, grade))

            def class_ids():
                return page.locator('.school-class-card').evaluate_all('(els) => els.map(e => e.dataset.classId)')

            def record_layout(width):
                layout = page.evaluate('({viewport:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth, direction:getComputedStyle(document.body).direction, h1:getComputedStyle(document.querySelector("h1")).fontSize, select:getComputedStyle(document.querySelector("select")).fontSize})')
                REPORT['layout'].append(layout)
                check('No horizontal page overflow at ' + str(width), max(layout['root'], layout['body']) <= width, soft=True)
                check('Document uses RTL direction', layout['direction'] == 'rtl', soft=True)

            initial = BASE + '/admin/school?' + urlencode({'trackId':meta['legacyTrackId'], 'stage':'primary', 'grade':'4'})
            page.goto(initial, wait_until='networkidle')
            check('School heading and sequential navigation render', page.locator('h1').inner_text() == 'الصفوف والفصول' and page.locator('form.school-selector').count() == 2)
            check('Legacy combined level selector is absent', page.locator('select[name="levelKey"]').count() == 0)
            before_navigation = state()['fingerprint']
            guide = page.locator('details.school-guide')
            guide.locator('summary').focus(); page.keyboard.press('Enter')
            check('School guide opens with keyboard', guide.get_attribute('open') is not None)
            capture(page, 'guide-393')
            page.keyboard.press('Enter')
            check('School guide closes with keyboard', guide.get_attribute('open') is None)
            for stage, expected in [('primary',6),('middle',3),('secondary',3)]:
                choose_context(meta['pathId'], stage, 1)
                stage_values = page.locator('select[name="stage"] option').evaluate_all('(els)=>els.map(e=>e.value)')
                grade_values = page.locator('select[name="grade"] option').evaluate_all('(els)=>els.map(e=>e.value)')
                check(stage + ' shows exactly three fixed stage choices', stage_values == ['primary','middle','secondary'])
                check(stage + ' shows only fixed grade choices', grade_values == [str(n) for n in range(1,expected + 1)])
                check('Navigation does not create school/audit data: ' + stage, state()['fingerprint'] == before_navigation)
            choose_context(meta['pathId'], 'middle', 2)
            check('Middle context hides all unrelated classes', class_ids() == [meta['middleId']])
            check('New-path class explains registration is pending', 'بانتظار ربط التسجيل' in page.locator('.school-class-card').inner_text())
            check('Unsupported context has no teacher/student assignment forms', page.locator('form[action="/admin/school/teachers"],form[action="/admin/school/students"]').count() == 0)
            check('Unsupported context has no individual-assignment link', page.locator('a[href^="/admin/school/assignments"]').count() == 0)
            for width in [393,1280]:
                page.set_viewport_size({'width':width,'height':900})
                record_layout(width); capture(page, 'middle-' + str(width), full=True)
            choose_context(meta['pathId'], 'secondary', 3)
            check('Secondary context shows only the secondary class', class_ids() == [meta['secondaryId']])
            for width in [393,1280]:
                page.set_viewport_size({'width':width,'height':900})
                record_layout(width); capture(page, 'secondary-' + str(width), full=True)
            page.go_back()
            check('Back restores secondary stage default without mixing classes', page.locator('select[name="stage"]').input_value() == 'secondary' and class_ids() == [meta['secondaryId']])
            page.go_forward()
            check('Forward restores exact selected secondary context', selected(meta['pathId'],'secondary',3))
            page.reload()
            check('Reload retains the exact selected secondary context', selected(meta['pathId'],'secondary',3) and class_ids() == [meta['secondaryId']])
            page.get_by_role('button',name='عرض فصول الصف',exact=True).click()
            check('Repeated grade submission remains read-only', state()['fingerprint'] == before_navigation)
            choose_context(meta['legacyTrackId'], 'primary', 4)
            check('Legacy primary context shows only its class', class_ids() == [meta['classId']])
            check('Legacy primary context offers class teacher assignment', page.locator('form[action="/admin/school/teachers"]').count() == 1)
            link = page.locator('a[href^="/admin/school/assignments"]')
            check('Legacy individual link targets selected stored grade', parse_qs(urlparse(link.get_attribute('href')).query).get('gradeId') == [meta['gradeId']])
            for width in [320,393,768,1280]:
                page.set_viewport_size({'width':width,'height':900})
                page.evaluate('window.scrollTo(0,0)'); capture(page,'legacy-top-' + str(width))
                capture(page,'legacy-full-' + str(width),full=True)
                page.locator('#school-step-3').scroll_into_view_if_needed(); capture(page,'legacy-classes-' + str(width))
                record_layout(width)
            link.click()
            check('Legacy link opens assignment page with grade selected', page.locator('select[name="gradeId"]').input_value() == meta['gradeId'])
            page.get_by_role('link',name='العودة إلى الصفوف والفصول',exact=True).click()
            check('Assignment back link restores selected school context', selected(meta['legacyTrackId'],'primary',4))
            check('All navigation and link visits leave model/audit unchanged', state()['fingerprint'] == before_navigation)
            page.set_viewport_size({'width':393,'height':900})
            disclosure = page.locator('.school-new-track')
            disclosure.locator('summary').focus(); page.keyboard.press('Enter')
            check('New-path disclosure opens with keyboard', disclosure.get_attribute('open') is not None)
            new_path_form = page.locator('form[action="/admin/school/tracks"]')
            new_path_form.locator('input[name="name"]').fill('مسار عربي جديد · اختبار مرئي')
            new_path_form.locator('select[name="educationType"]').select_option('private')
            new_path_form.locator('input[name="curriculumName"]').fill('منهج تجريبي مستقل')
            disclosure.scroll_into_view_if_needed(); capture(page,'new-path-form-393')
            old = state()
            new_path_form.get_by_role('button',name='حفظ المسار واختياره',exact=True).click()
            new = state()
            track = next(t for t in new['tracks'] if t['name'] == 'مسار عربي جديد · اختبار مرئي')
            check('New path is created once and selected at primary first grade', len(new['tracks']) == len(old['tracks']) + 1 and selected(track['id'],'primary',1))
            check('Creating path does not create grades or classes', len(new['grades']) == len(old['grades']) and len(new['classes']) == len(old['classes']))
            check('New selected path shows empty-class state', not class_ids() and 'لا توجد فصول في الصف المختار' in page.locator('#school-step-3').inner_text())
            capture(page,'new-path-empty-393',full=True)
            path_fingerprint = state()['fingerprint']
            choose_context(track['id'],'middle',2)
            check('New path stage/grade navigation remains non-mutating', state()['fingerprint'] == path_fingerprint)
            form = page.locator('form[action="/admin/school/classes"]')
            check('Create form carries exact selected hidden context', all(form.locator('input[name="'+key+'"]').input_value() == value for key,value in [('trackId',track['id']),('stage','middle'),('grade','2')]))
            form.locator('input[name="name"]').fill('فصل متوسط جديد · أ')
            form.locator('input[name="capacity"]').fill('11')
            form.get_by_role('button',name='إضافة فصل للصف',exact=True).click()
            row = next(c for c in state()['classes'] if c['name'] == 'فصل متوسط جديد · أ')
            check('Created class has selected path/stage/grade and capacity', row['track_id'] == track['id'] and row['stage'] == 'middle' and row['grade'] == 2 and row['capacity'] == 11 and row['assignmentSupported'] is False)
            check('Created class stays visible in the same selected context', selected(track['id'],'middle',2) and class_ids() == [row['id']])
            check('Created unsupported class has no assignment controls', page.locator('form[action="/admin/school/teachers"],form[action="/admin/school/students"],a[href^="/admin/school/assignments"]').count() == 0)
            capture(page,'new-class-393',full=True)
            page.set_viewport_size({'width':1280,'height':900}); capture(page,'new-class-1280',full=True)
            card = page.locator('.school-class-card[data-class-id="'+row['id']+'"]')
            card.locator('.school-class-edit summary').click()
            rename = card.locator('form[action="/admin/school/classes/update"]').filter(has=page.locator('input[name="name"][required]'))
            rename.locator('input[name="name"]').fill('فصل متوسط محدث · أ')
            rename.get_by_role('button',name='حفظ الاسم',exact=True).click()
            check('Rename returns to unchanged selected context', selected(track['id'],'middle',2) and 'فصل متوسط محدث · أ' in page.locator('.school-class-card h3').inner_text())
            card = page.locator('.school-class-card[data-class-id="'+row['id']+'"]')
            card.locator('.school-class-edit summary').click()
            capacity = card.locator('form[action="/admin/school/classes/capacity"]')
            capacity.locator('input[name="capacity"]').fill('13')
            capacity.get_by_role('button',name='حفظ السعة',exact=True).click()
            check('Capacity update returns to same context and persists', selected(track['id'],'middle',2) and next(c for c in state()['classes'] if c['id'] == row['id'])['capacity'] == 13)
            stable = state()['fingerprint']
            for stage, grade in [('middle','4'),('secondary','6'),('university','1')]:
                response = context.request.get(BASE + '/admin/school?' + urlencode({'trackId':track['id'],'stage':stage,'grade':grade}))
                check('Invalid selector is rejected: '+stage+'/'+grade,response.status == 400)
            response = context.request.post(BASE + '/admin/school/classes',headers={'Origin':BASE},form={'trackId':track['id'],'stage':'middle','grade':'2','levelKey':'primary:1','name':'forged','capacity':'10'},max_redirects=0)
            check('Mixed old/new class creation fields are rejected',response.status == 400)
            check('Rejected selector/create requests do not mutate data or audit',state()['fingerprint'] == stable)
            check('No page JavaScript errors', not REPORT['pageErrors'])
            REPORT['status'] = 'completed' if all(row['pass'] for row in REPORT['checks']) else 'failed-checks'
            browser.close()
            browser = None
except Exception as error:
    REPORT['status'] = 'blocked-browser-launch' if phase == 'browser-launch' else 'failed-checks'
    REPORT['phase'] = phase
    if page is not None:
        try: capture(page, 'failure-state', full=True)
        except Exception: pass
    REPORT['error'] = str(error)
    REPORT['traceback'] = traceback.format_exc()
    print(REPORT['traceback'])
finally:
    if browser is not None:
        try: browser.close()
        except Exception: pass
    if server is not None:
        server.terminate()
        try: server.wait(timeout=5)
        except Exception: server.kill(); server.wait()
    (OUT / 'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in REPORT.items() if k not in ['error','traceback']}, ensure_ascii=False, indent=2))

sys.exit(0 if REPORT.get('status') == 'completed' else 1)
