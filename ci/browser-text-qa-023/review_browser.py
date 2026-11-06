from pathlib import Path
from subprocess import Popen, PIPE
from playwright.sync_api import sync_playwright
from urllib.parse import urlencode
import os, time, urllib.request, json, tempfile, traceback, sys

SOURCE = '25e11ce2e33aef92fbeb20eb3c6b6933278f90ac'
HERE = Path(__file__).resolve().parent
OUT = Path(os.environ['QA_OUTPUT_DIR']).resolve()
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:4826'
REPORT = {'source': SOURCE, 'synthetic': True, 'database': ':memory:',
          'browserSandbox': True, 'authentication': 'Synthetic supervisor injected by loopback-only fixture; production login not tested',
          'textEnlargementMethod': 'Browser-only stress test: snapshot each HTML element computed font-size and numeric line-height, then multiply them by 1/1.3/1.6. No CSS zoom or page zoom, no Android accessibility claim. Native selects can still clip; wrapped full-name references are the feature under test.',
          'plannedMatrix': {'pages': ['school', 'assignments'], 'widths': [320, 360, 393], 'textPercent': [100, 130, 160]},
          'checks': [], 'screenshots': [], 'matrix': [], 'pageErrors': [], 'blockedExternalRequests': []}
server = browser = page = None
phase = 'fixture'

def check(name, value, soft=False):
    REPORT['checks'].append({'name': name, 'pass': bool(value)})
    if not value and not soft:
        raise AssertionError(name)

def capture(name, locator=None, full=False):
    path = OUT / (name + '.png')
    if locator is not None:
        locator.screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=full)
    REPORT['screenshots'].append(path.name)

def scale_text(factor):
    return page.evaluate('''factor => {
      const entries = [...document.querySelectorAll('body, body *')]
        .filter(e => e instanceof HTMLElement).map(e => {
          const s = getComputedStyle(e);
          return [e, parseFloat(s.fontSize), s.lineHeight];
        });
      const probes = ['.adm-readable-select>select', '.adm-readable-select>label', '.adm-choice-hint', '.adm-option-reference>summary', '.adm-option-names bdi', 'h1'].map(selector => { const e = document.querySelector(selector); return e ? {selector, e, before:parseFloat(getComputedStyle(e).fontSize)} : null; }).filter(Boolean);
      const select = document.querySelector('.adm-readable-select>select');
      const before = select ? parseFloat(getComputedStyle(select).fontSize) : null;
      if (factor !== 1) for (const [e, size, line] of entries) {
        e.style.setProperty('font-size', `${size * factor}px`, 'important');
        if (line !== 'normal') e.style.setProperty('line-height', `${parseFloat(line) * factor}px`, 'important');
      }
      return {factor, probes:probes.map(({selector,e,before})=>({selector,before,after:parseFloat(getComputedStyle(e).fontSize)})), beforeSelect: before, afterSelect: select ? parseFloat(getComputedStyle(select).fontSize) : null,
        body: getComputedStyle(document.body).fontSize,
        heading: getComputedStyle(document.querySelector('h1')).fontSize};
    }''', factor)

def references():
    return page.locator('.adm-readable-select').evaluate_all('''els => els.filter(e => e.querySelector('.adm-option-reference')).map(e => {
      const sel = e.querySelector('select'), detail = e.querySelector('.adm-option-reference');
      const options = [...sel.options].filter(o => o.value !== '').map(o => ({value:o.value,text:o.textContent}));
      const rows = [...detail.querySelectorAll('li')].map(li => ({number:li.querySelector('.adm-option-number').textContent,
        text:li.querySelector('bdi').textContent, width:li.querySelector('bdi').clientWidth,
        scrollWidth:li.querySelector('bdi').scrollWidth, height:li.querySelector('bdi').getBoundingClientRect().height}));
      const label = e.querySelector('label');
      return {name:sel.name, options, rows, labelMatches:label.htmlFor === sel.id,
        describedByExists:!!document.getElementById(sel.getAttribute('aria-describedby')),
        summarySize:detail.querySelector('summary').getBoundingClientRect().height,
        selected:sel.selectedOptions[0]?.textContent};
    })''')

try:
    with tempfile.TemporaryDirectory(prefix='teachabs-text-browser-') as runtime:
        env = {k:os.environ[k] for k in ['PATH','LANG','LC_ALL','TMPDIR'] if k in os.environ}
        env.update({'HOME':runtime, 'XDG_CONFIG_HOME':runtime+'/config', 'XDG_CACHE_HOME':runtime+'/cache', 'XDG_DATA_HOME':runtime+'/data'})
        server = Popen(['node', str(HERE/'fixture.mjs')], stdout=PIPE, stderr=PIPE, text=True)
        for _ in range(80):
            try:
                with urllib.request.urlopen(BASE+'/admin/school', timeout=.5) as r:
                    if r.status == 200: break
            except Exception:
                if server.poll() is not None: raise RuntimeError(server.communicate())
                time.sleep(.1)
        else: raise RuntimeError('Loopback synthetic fixture is not reachable')
        meta = json.loads((OUT/'fixture-metadata.json').read_text())
        check('Fixture matches exact app source and has no persistent database', meta['source'] == SOURCE and meta['persistence'] is False)
        with sync_playwright() as p:
            try:
                phase = 'browser-launch'
                browser = p.chromium.launch(executable_path=os.environ['QA_BROWSER_PATH'], headless=True, chromium_sandbox=True, env=env)
                REPORT['browserVersion'] = browser.version
                REPORT['browserExecutable'] = os.environ['QA_BROWSER_PATH']
                context = browser.new_context(viewport={'width':393,'height':852}, device_scale_factor=1, service_workers='block')
                def route_request(route):
                    if route.request.url.startswith(BASE+'/'): route.continue_()
                    else:
                        REPORT['blockedExternalRequests'].append(route.request.url); route.abort()
                context.route('**/*', route_request)
                page = context.new_page()
                page.on('pageerror', lambda error: REPORT['pageErrors'].append(str(error)))
                initial_state = context.request.get(BASE+'/__qa/state').json()['fingerprint']
                urls = {
                    'school': BASE+'/admin/school?'+urlencode({'trackId':meta['legacyTrackId'],'stage':'primary','grade':'4'}),
                    'assignments': BASE+'/admin/school/assignments?'+urlencode({'gradeId':meta['gradeId'],'subject':'math','teacherId':meta['secondTeacherId']})}
                phase = 'text-matrix'
                for kind, url in urls.items():
                    for width in [320,360,393]:
                        for percent in [100,130,160]:
                            case = f'{kind}-w{width}-text{percent}'
                            page.set_viewport_size({'width':width,'height':900})
                            page.goto(url, wait_until='networkidle')
                            guide = page.locator('details.school-guide')
                            icon = guide.locator('svg.adm-info-icon')
                            check(case+': font-independent guide SVG exists', icon.count() == 1)
                            check(case+': old circled text glyph is absent', 'ⓘ' not in guide.locator('summary').inner_text())
                            refs = page.locator('.adm-option-reference')
                            check(case+': full-name references are available', refs.count() >= 1)
                            for i in range(refs.count()):
                                item = refs.nth(i)
                                item.locator('summary').focus(); page.keyboard.press('Enter')
                                check(case+f': reference {i+1} opens with keyboard', item.get_attribute('open') is not None)
                            fonts = scale_text(percent/100)
                            check(case+': computed select font reaches requested multiplier', abs(fonts['afterSelect']-fonts['beforeSelect']*(percent/100)) < .05)
                            check(case+': label, hint, reference and heading fonts reach requested multiplier', all(abs(x['after']-x['before']*(percent/100)) < .05 for x in fonts['probes']))
                            records = references()
                            for index, ref in enumerate(records):
                                prefix = case+f': reference {index+1} ({ref["name"]})'
                                check(prefix+': labels and hints are associated', ref['labelMatches'] and ref['describedByExists'])
                                check(prefix+': every full name matches its numbered option', len(ref['options']) == len(ref['rows']) and all(o['text'] == r['number']+' · '+r['text'] for o,r in zip(ref['options'],ref['rows'])))
                                check(prefix+': full names fit their wrapping cells', all(r['scrollWidth'] <= r['width']+1 for r in ref['rows']), soft=True)
                                check(prefix+': disclosure has a minimum 44px target', ref['summarySize'] >= 44, soft=True)
                            layout = page.evaluate('({viewport:innerWidth, root:document.documentElement.scrollWidth, body:document.body.scrollWidth, direction:getComputedStyle(document.body).direction})')
                            bounds = icon.bounding_box()
                            check(case+': guide icon retains a visible 20px box', bounds is not None and bounds['width'] == 20 and bounds['height'] == 20)
                            check(case+': no horizontal page overflow', max(layout['root'],layout['body']) <= width, soft=True)
                            check(case+': RTL remains active', layout['direction'] == 'rtl')
                            REPORT['matrix'].append({'case':case,'fonts':fonts,'layout':layout,'references':records})
                            page.evaluate('scrollTo(0,0)'); capture(case, full=True)
                            capture(case+'-reference', locator=page.locator('.adm-readable-select').filter(has=page.locator('.adm-option-reference')).first)
                            if width == 320 and percent == 160:
                                if kind == 'assignments':
                                    capture(case+'-teacher-reference',locator=page.locator('.adm-readable-select').filter(has=page.locator('select[name="teacherId"]')))
                                guide.locator('summary').focus(); page.keyboard.press('Enter')
                                check(case+': enlarged guide opens with keyboard', guide.get_attribute('open') is not None)
                                capture(case+'-guide', locator=guide)
                                page.keyboard.press('Enter')
                                check(case+': enlarged guide closes with keyboard', guide.get_attribute('open') is None)
                                refs.first.locator('summary').focus(); page.keyboard.press('Enter')
                                check(case+': enlarged reference closes with keyboard', refs.first.get_attribute('open') is None)
                phase = 'enlarged-controls'
                page.set_viewport_size({'width':320,'height':900})
                page.goto(urls['school'],wait_until='networkidle'); scale_text(1.6)
                first = page.locator('form.school-selector').filter(has=page.locator('select[name="stage"]'))
                first.locator('select[name="trackId"]').select_option(meta['secondPathId'])
                first.locator('select[name="stage"]').select_option('primary')
                first.get_by_role('button',name='عرض صفوف المرحلة',exact=True).click()
                check('School selector still submits real ID after enlarged reference review', page.locator('select[name="trackId"]').input_value() == meta['secondPathId'] and page.locator('select[name="stage"]').input_value() == 'primary')
                scale_text(1.6)
                chosen = page.locator('.adm-readable-select').filter(has=page.locator('select[name="trackId"]'))
                chosen.locator('summary').click(); capture('selected-second-long-track-w320-text160',locator=chosen)
                page.goto(BASE+'/admin/school/assignments',wait_until='networkidle'); scale_text(1.6)
                page.locator('select[name="gradeId"]').select_option(meta['gradeId'])
                page.locator('select[name="subject"]').select_option('math')
                page.get_by_role('button',name='عرض المعلمين',exact=True).click(); scale_text(1.6)
                page.locator('select[name="teacherId"]').select_option(meta['secondTeacherId'])
                page.get_by_role('button',name='عرض الطلاب',exact=True).click()
                check('Assignment selector submits real teacher ID, not reference ordinal', page.locator('select[name="teacherId"]').input_value() == meta['secondTeacherId'] and page.locator('.school-individual-person').count() == 1)
                for path, selector, name in [('/admin','details.adm-help','home'),('/admin/accounts','details.adm-section-guide','accounts')]:
                    page.goto(BASE+path,wait_until='networkidle'); scale_text(1.6)
                    detail = page.locator(selector)
                    check(name+': shared guide uses SVG', detail.locator('svg.adm-info-icon').count() == 1)
                    detail.locator('summary').focus(); page.keyboard.press('Enter')
                    check(name+': enlarged shared guide opens', detail.get_attribute('open') is not None)
                    capture(name+'-w320-text160-guide',locator=detail)
                final_state = context.request.get(BASE+'/__qa/state').json()['fingerprint']
                check('All reference, guide and selection review is read-only', final_state == initial_state)
                check('No page JavaScript errors', not REPORT['pageErrors'])
                check('No external page requests', not REPORT['blockedExternalRequests'])
                check('All eighteen planned page-width-text cases completed', len(REPORT['matrix']) == 18)
                REPORT['status'] = 'completed' if all(x['pass'] for x in REPORT['checks']) else 'completed-with-failed-checks'
            except Exception as exc:
                REPORT.update({'status':'failed','phase':phase,'error':str(exc),'traceback':traceback.format_exc(),
                    'unexecuted':'Any later matrix case or check not recorded in this JSON was not executed.'})
                if page is not None:
                    try: capture('failure',full=True)
                    except Exception as shot_error: REPORT['failureScreenshotError'] = str(shot_error)
            finally:
                if browser is not None: browser.close()
except Exception as exc:
    REPORT.update({'status':'failed','phase':phase,'error':str(exc),'traceback':traceback.format_exc()})
finally:
    if server is not None:
        server.terminate()
        try: stdout,stderr = server.communicate(timeout=10)
        except Exception:
            server.kill(); stdout,stderr=server.communicate()
        REPORT['fixtureOutput'] = {'stdout':stdout,'stderr':stderr}
    (OUT/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
    print(json.dumps({'status':REPORT.get('status'),'checks':len(REPORT['checks']),'failed':[x for x in REPORT['checks'] if not x['pass']],'screenshots':len(REPORT['screenshots']),'matrixCases':len(REPORT['matrix'])},ensure_ascii=False))
sys.exit(0 if REPORT.get('status') == 'completed' else 1)
