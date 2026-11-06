from pathlib import Path
from subprocess import Popen, PIPE
from playwright.sync_api import sync_playwright
import os, time, urllib.request, json, tempfile, traceback, sys

SCRIPT_DIR = Path(__file__).resolve().parent
OUT = Path(os.environ['QA_OUTPUT_DIR']).resolve()
OUT.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ['QA_BROWSER_PATH']
BASE = 'http://127.0.0.1:4826'
REPORT = {'source': '6671f61bc13eba5e842904227d08ea7faf4cb810', 'synthetic': True, 'database': ':memory:', 'browserSandbox': True, 'authentication': 'Synthetic supervisor injected by loopback-only fixture; production login is not tested', 'checks': [], 'screenshots': [], 'layout': [], 'blockedExternalRequests': [], 'pageErrors': []}
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
                with urllib.request.urlopen(BASE + '/admin/school/assignments', timeout=.5) as response:
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
            page.goto(BASE + '/admin/school/assignments', wait_until='networkidle')
            check('Initial assignment heading', page.locator('h1').inner_text() == 'إسناد المعلمين للطلاب')
            capture(page, 'initial-393')
            details = page.locator('details.school-guide')
            summary = details.locator('summary')
            summary.focus()
            page.keyboard.press('Enter')
            check('Assignment guide opens with keyboard', details.get_attribute('open') is not None)
            capture(page, 'keyboard-guide-393')
            page.keyboard.press('Enter')
            check('Assignment guide closes with keyboard', details.get_attribute('open') is None)
            page.locator('select[name="gradeId"]').select_option(meta['gradeId'])
            page.locator('select[name="subject"]').select_option('math')
            page.get_by_role('button', name='عرض المعلمين', exact=True).click()
            check('Grade and subject selection reveals teacher choice', page.locator('select[name="teacherId"]').count() == 1)
            page.locator('select[name="teacherId"]').select_option(meta['teacherId'])
            page.get_by_role('button', name='عرض الطلاب', exact=True).click()
            check('Four synthetic enrolled students appear', page.locator('input[name^="child_"]').count() == 4)
            inherited = page.locator('input[name="child_' + meta['children'][3] + '"]')
            check('Class-assigned student is disabled', inherited.is_disabled())
            check('Disabled student explains inherited teacher', 'معلم الفصل التجريبي' in inherited.locator('..').inner_text())
            selected_url = page.url
            for width, height in [(320,800),(360,800),(393,852),(1280,900)]:
                page.set_viewport_size({'width':width,'height':height})
                page.goto(selected_url, wait_until='networkidle')
                page.evaluate('window.scrollTo(0, 0)')
                capture(page, 'main-' + str(width))
                capture(page, 'full-' + str(width), full=True)
                page.locator('.school-individual-roster').scroll_into_view_if_needed()
                capture(page, 'roster-' + str(width))
                layout = page.evaluate('({viewport:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth})')
                REPORT['layout'].append(layout)
                check('No horizontal page overflow at ' + str(width), max(layout['root'],layout['body']) <= width, soft=True)
            page.set_viewport_size({'width':393,'height':852})
            page.goto(selected_url)
            page.locator('input[name="child_' + meta['children'][0] + '"]').check()
            page.get_by_role('button', name='إسناد الطلاب المحددين', exact=True).click()
            check('Individual assignment appears', page.locator('.school-individual-links article').count() == 1)
            check('Assigned individual checkbox becomes disabled', page.locator('input[name="child_' + meta['children'][0] + '"]').is_disabled())
            page.locator('.school-individual-links').scroll_into_view_if_needed()
            capture(page, 'individual-assigned-393')
            for child in meta['children'][1:3]:
                page.locator('input[name="child_' + child + '"]').check()
            page.get_by_role('button', name='إسناد الطلاب المحددين', exact=True).click()
            check('Two-student batch adds both assignments', page.locator('.school-individual-links article').count() == 3)
            page.locator('.school-individual-links').scroll_into_view_if_needed()
            capture(page, 'batch-assigned-393')
            response = context.request.post(BASE + '/admin/school/assignments', headers={'Origin':BASE}, form={'gradeId':meta['gradeId'],'subject':'math','teacherId':meta['teacherId'],'child_' + meta['children'][3]:'1'}, max_redirects=0)
            check('Forged conflicting selection is rejected with HTTP 409', response.status == 409)
            check('Conflict response names existing teacher', 'معلم الفصل التجريبي' in response.text())
            page.reload()
            check('Rejected conflict does not change existing direct assignments', page.locator('.school-individual-links article').count() == 3)
            article = page.locator('.school-individual-links article').filter(has_text='طالب تجريبي أول')
            article.get_by_role('button', name='إزالة الإسناد الفردي', exact=True).click()
            check('Individual removal leaves other two links intact', page.locator('.school-individual-links article').count() == 2)
            check('Removal clears teacher filter', page.locator('select[name="teacherId"]').input_value() == '')
            page.locator('.school-individual-links').scroll_into_view_if_needed()
            capture(page, 'individual-removed-393')
            page.locator('select[name="teacherId"]').select_option(meta['teacherId'])
            page.get_by_role('button', name='عرض الطلاب', exact=True).click()
            removed = page.locator('input[name="child_' + meta['children'][0] + '"]')
            check('Removed student becomes selectable again', removed.is_enabled())
            removed.check()
            page.locator('select[name="subject"]').select_option('science')
            page.get_by_role('button', name='عرض المعلمين', exact=True).click()
            check('Changing subject clears teacher and prior student selections', page.locator('select[name="teacherId"]').input_value() == '' and page.locator('input[name^="child_"]').count() == 0)
            capture(page, 'filter-reset-393', full=True)
            page.locator('select[name="teacherId"]').select_option(meta['teacherId'])
            page.get_by_role('button', name='عرض الطلاب', exact=True).click()
            check('Other subject permits all four students', page.locator('input[name^="child_"]:enabled').count() == 4)
            page.go_back()
            check('Back returns to subject filter without a selected roster', page.locator('input[name^="child_"]').count() == 0)
            page.go_forward()
            check('Forward restores science roster with no selected checkboxes', page.locator('input[name^="child_"]').count() == 4 and page.locator('input[name^="child_"]:checked').count() == 0)
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
