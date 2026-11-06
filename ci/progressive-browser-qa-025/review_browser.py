from pathlib import Path
from subprocess import Popen, PIPE
from playwright.sync_api import sync_playwright
from urllib.parse import urlencode, urlparse, parse_qs
import os, time, urllib.request, json, tempfile, traceback, sys

SOURCE = '117f9fa0007d3a70c46aa6fd21361908c85278f9'
HERE = Path(__file__).resolve().parent
OUT = Path(os.environ['QA_OUTPUT_DIR']).resolve(); OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:4827'
REPORT = {'source':SOURCE,'synthetic':True,'database':':memory:','browserSandbox':True,
 'authentication':'Synthetic roles injected by loopback-only fixture. Production login not tested.',
 'textMethod':'Computed HTML font sizes and numeric line heights multiplied. Browser-only text stress, not Android OS scaling or WebView.',
 'plannedMatrix':{'pages':['class-chooser','class-members','student-first'],'widths':[320,360,393],'textPercent':[100,160]},
 'checks':[],'screenshots':[],'matrix':[],'observations':[],'pageErrors':[],'blockedExternalRequests':[]}
server = browser = page = None
phase = 'fixture'
def check(name, condition, soft=False):
    REPORT['checks'].append({'name':name,'pass':bool(condition)})
    if not condition and not soft: raise AssertionError(name)
def capture(name, locator=None, full=False):
    dest=OUT/(name+'.png')
    if locator is None: page.screenshot(path=str(dest),full_page=full)
    else: locator.screenshot(path=str(dest))
    REPORT['screenshots'].append(dest.name)
def scale_text(factor):
    return page.evaluate('''factor => {
      const entries=[...document.querySelectorAll('body, body *')].filter(e=>e instanceof HTMLElement).map(e=>{const s=getComputedStyle(e);return [e,parseFloat(s.fontSize),s.lineHeight]});
      const before=parseFloat(getComputedStyle(document.querySelector('h1')).fontSize);
      if(factor!==1)for(const [e,size,line] of entries){e.style.setProperty('font-size',`${size*factor}px`,'important');if(line!=='normal')e.style.setProperty('line-height',`${parseFloat(line)*factor}px`,'important')}
      return {factor,before,after:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)};
    }''',factor)
try:
 with tempfile.TemporaryDirectory(prefix='teachabs-progressive-browser-') as runtime:
  env={k:os.environ[k] for k in ['PATH','LANG','LC_ALL','TMPDIR'] if k in os.environ}
  env.update({'HOME':runtime,'XDG_CONFIG_HOME':runtime+'/config','XDG_CACHE_HOME':runtime+'/cache','XDG_DATA_HOME':runtime+'/data'})
  server=Popen(['node',str(HERE/'fixture.mjs')],stdout=PIPE,stderr=PIPE,text=True)
  for _ in range(100):
   try:
    with urllib.request.urlopen(BASE+'/admin/school',timeout=.5) as r:
     if r.status==200: break
   except Exception:
    if server.poll() is not None: raise RuntimeError(server.communicate())
    time.sleep(.1)
  else: raise RuntimeError('Synthetic loopback fixture unreachable')
  meta=json.loads((OUT/'fixture-metadata.json').read_text()); kids=meta['students']
  check('Fixture matches exact source and is in-memory',meta['source']==SOURCE and meta['persistence'] is False)
  with sync_playwright() as p:
   phase='browser-launch'
   browser=p.chromium.launch(executable_path=os.environ['QA_BROWSER_PATH'],headless=True,chromium_sandbox=True,env=env)
   REPORT['browserVersion']=browser.version
   context=browser.new_context(viewport={'width':393,'height':900},device_scale_factor=1,service_workers='block')
   def route_request(route):
    if route.request.url.startswith(BASE+'/'): route.continue_()
    else: REPORT['blockedExternalRequests'].append(route.request.url);route.abort()
   context.route('**/*',route_request)
   page=context.new_page();page.on('pageerror',lambda e:REPORT['pageErrors'].append(str(e)))
   def state(): return context.request.get(BASE+'/__qa/state').json()
   def qurl(q,route='/admin/school'): return BASE+route+('?' + urlencode(q) if q else '')
   query={'trackId':meta['legacyTrackId'],'stage':'primary','grade':'4'}
   def class_url(class_id=meta['classId']):return qurl({**query,'classId':class_id})
   def candidates():return page.locator('input[type="checkbox"][name^="child_"]').evaluate_all('(es)=>es.map(e=>e.name.slice(6))')
   def members():return page.locator('[data-member-id]').evaluate_all('(es)=>es.map(e=>e.dataset.memberId)')
   def exact_context(class_id):
    v=parse_qs(urlparse(page.url).query)
    return all(v.get(k)==[str(x)] for k,x in {**query,'classId':class_id}.items())
   def post(path,data,role='supervisor',origin=BASE):
    return context.request.post(BASE+path,headers={'Origin':origin,'x-qa-role':role},form=data,max_redirects=0)
   def batch(class_id,students,role='supervisor',origin=BASE):return post('/admin/school/students/batch',{'classId':class_id,**{'child_'+s:'1' for s in students}},role,origin)
   def select_step(name,value,button):
    form=page.locator('form.school-selector').filter(has=page.locator('select[name="'+name+'"]'))
    form.locator('select').select_option(str(value));form.get_by_role('button',name=button,exact=True).click()
   baseline=state()['fingerprint'];phase='progressive-navigation'
   page.goto(qurl({}),wait_until='networkidle')
   for index,(name,value,button) in enumerate([('trackId',meta['legacyTrackId'],'اختيار المسار'),('stage','primary','اختيار المرحلة'),('grade','4','اختيار الصف'),('classId',meta['classId'],'فتح الفصل')]):
    names=page.locator('form.school-selector select').evaluate_all('(es)=>es.map(e=>e.name)')
    check('Only explicit ancestors and current '+name+' step render',names==['trackId','stage','grade','classId'][:index+1])
    check(name+' starts with empty selected placeholder',page.locator('select[name="'+name+'"]').input_value()=='')
    check(name+' incomplete selection exposes no memberships or candidate identities',not members() and not candidates())
    capture('progressive-step-'+str(index+1),full=True)
    select_step(name,value,button)
   check('Opening class preserves exact full context',exact_context(meta['classId']))
   guide=page.locator('details.school-guide');guide.locator('summary').focus();page.keyboard.press('Enter')
   check('Progressive guide opens with keyboard and uses font-independent SVG',guide.get_attribute('open') is not None and guide.locator('svg.adm-info-icon').count()==1)
   capture('progressive-guide',locator=guide);page.keyboard.press('Enter');check('Progressive guide closes with keyboard',guide.get_attribute('open') is None)
   check('Opened class shows only its members including suspended retained membership',set(members())=={kids['member'],kids['suspendedMember']})
   expected={s['id'] for s in state()['school']['students'] if s['grade']==4 and s.get('status','active')=='active' and s['id'] not in {x['child'] for x in state()['school']['studentAssignments']}}
   check('Class candidates exactly equal active unassigned same-grade students',set(candidates())==expected)
   for name in ['otherMember','suspended','otherGrade']:
    check('Class excludes unrelated student '+name,kids[name] not in page.content())
   check('Class excludes foreign scope student',meta['foreignStudent']['id'] not in page.content())
   check('Class has only one class card',page.locator('.school-class-card').count()==1)
   # Teacher matching is measured separately: currently the source returns the grade-wide pool.
   teacher_form=page.locator('form[action="/admin/school/teachers"]')
   teacher_options=teacher_form.locator('select[name="teacherId"] option').evaluate_all('(es)=>es.map(e=>e.value)')
   REPORT['observations'].append({'name':'Teacher options before choosing subject','includesWrongGrade':meta['wrongTeacherId'] in teacher_options,'includesWrongSubject':meta['wrongSubjectTeacherId'] in teacher_options})
   check('Teacher choices exclude a teacher limited to another grade',meta['wrongTeacherId'] not in teacher_options,soft=True)
   capture('class-teacher-options',locator=teacher_form)
   page.go_back();check('Back returns to grade chooser without auto-opening a class',page.locator('select[name="classId"]').input_value()=='' and not members())
   page.go_forward();check('Forward restores same class and members',exact_context(meta['classId']) and kids['member'] in members())
   page.reload();check('Refresh retains class context',exact_context(meta['classId']))
   select_step('classId',meta['classId'],'فتح الفصل');check('Repeated class opening is read-only',state()['fingerprint']==baseline)
   select_step('grade','1','اختيار الصف');check('Changing grade clears selected class and student identities',page.locator('select[name="classId"]').input_value()=='' and not members() and not candidates())
   check('Grade-one class options exclude grade-four classes',meta['classId'] not in page.locator('select[name="classId"]').inner_html())
   select_step('stage','middle','اختيار المرحلة');check('Changing stage clears grade and class',page.locator('select[name="grade"]').input_value()=='' and page.locator('select[name="classId"]').count()==0)
   select_step('trackId',meta['pathId'],'اختيار المسار');check('Changing path clears stage, grade and class',page.locator('select[name="stage"]').input_value()=='' and page.locator('select[name="grade"],select[name="classId"]').count()==0)
   for stage,count in [('primary',6),('middle',3),('secondary',3)]:
    page.goto(qurl({'trackId':meta['pathId'],'stage':stage}),wait_until='networkidle')
    check(stage+' has fixed appropriate grade choices',page.locator('select[name="grade"] option').evaluate_all('(es)=>es.map(e=>e.value)')==['']+[str(x) for x in range(1,count+1)])
   page.goto(qurl({'trackId':meta['pathId'],'stage':'middle','grade':'2','classId':meta['middleId']}),wait_until='networkidle')
   check('Unsupported middle context has no student or teacher admission controls',not candidates() and page.locator('form[action="/admin/school/teachers"]').count()==0)
   check('Unsupported context explains pending registration','بانتظار ربط التسجيل' in page.locator('body').inner_text())
   capture('unsupported-middle',full=True)
   page.goto(qurl({'trackId':meta['secondPathId'],'stage':'secondary','grade':'3'}),wait_until='networkidle')
   check('Empty structural grade shows clear empty message','لا توجد فصول لهذا الصف بعد.' in page.locator('body').inner_text() and page.locator('select[name="classId"]').count()==0)
   capture('empty-grade',full=True)
   page.goto(class_url(meta['archivedId']),wait_until='networkidle')
   check('Archived class can be inspected but has no enrollment form',page.locator('.school-class-card').count()==1 and not candidates())
   capture('archived-class',full=True)
   page.goto(class_url(meta['fullId']),wait_until='networkidle')
   check('Full class clearly explains capacity and offers no enrollment form','اكتملت سعة الفصل' in page.locator('body').inner_text() and not candidates())
   capture('full-class',full=True)
   page.goto(qurl(query,'/admin/school/enrollment'),wait_until='networkidle')
   check('Student-first candidates match class-first filtering',set(candidates())==expected)
   choices=page.locator('select[name="classId"] option').evaluate_all('(es)=>es.map(e=>e.value)')
   check('Student-first destination choices exclude full archived and other-grade classes',all(meta[k] not in choices for k in ['fullId','archivedId','gradeOneClassId','unsupportedPrimaryId']))
   page.locator('input[name="child_'+kids['first']+'"]').check()
   page.get_by_role('link',name='العودة إلى اختيار الفصل',exact=True).click()
   check('Cancel via explicit return leaves no saved membership or mutation',state()['fingerprint']==baseline and not members())
   page.goto(class_url(),wait_until='networkidle');disclosure=page.locator('.school-new-track')
   disclosure.locator('summary').focus();page.keyboard.press('Enter')
   disclosure.locator('input[name="name"]').fill('مسار لن يحفظ');page.keyboard.press('Escape');disclosure.locator('summary').click()
   check('Closing unsaved creation disclosure does not mutate',state()['fingerprint']==baseline)
   phase='mobile-text-matrix'
   matrix_urls={'class-chooser':qurl(query),'class-members':class_url(),'student-first':qurl(query,'/admin/school/enrollment')}
   for kind,url in matrix_urls.items():
    for width in [320,360,393]:
     for percent in [100,160]:
      case=f'{kind}-w{width}-text{percent}'
      page.set_viewport_size({'width':width,'height':900});page.goto(url,wait_until='networkidle')
      for ref in page.locator('.adm-option-reference').all():ref.locator('summary').click()
      fonts=scale_text(percent/100)
      layout=page.evaluate('({viewport:innerWidth,root:document.documentElement.scrollWidth,body:document.body.scrollWidth,direction:getComputedStyle(document.body).direction})')
      check(case+': no horizontal page overflow',max(layout['root'],layout['body'])<=width,soft=True)
      check(case+': RTL and requested heading font multiplier',layout['direction']=='rtl' and abs(fonts['after']-fonts['before']*percent/100)<.05)
      refs=page.locator('.adm-readable-select').evaluate_all('''es=>es.filter(e=>e.querySelector('.adm-option-reference')).map(e=>({name:e.querySelector('select').name,label:e.querySelector('label').htmlFor===e.querySelector('select').id,options:[...e.querySelector('select').options].filter(o=>o.value).map(o=>o.textContent),rows:[...e.querySelectorAll('.adm-option-names li')].map(li=>({text:li.querySelector('.adm-option-number').textContent+' · '+li.querySelector('bdi').textContent,width:li.querySelector('bdi').clientWidth,scroll:li.querySelector('bdi').scrollWidth}))}))''')
      expected_reference_names={'classId'} if kind=='student-first' else ({'trackId','classId','teacherId'} if kind=='class-members' else {'trackId','classId'})
      check(case+': expected long-name controls have nonempty full references',expected_reference_names <= {r['name'] for r in refs if r['rows']})
      check(case+': every full-name reference matches its numbered option',all(r['label'] and r['options']==[x['text'] for x in r['rows']] for r in refs))
      check(case+': full names fit wrapping reference cells',all(x['scroll']<=x['width']+1 for r in refs for x in r['rows']),soft=True)
      REPORT['matrix'].append({'case':case,'fonts':fonts,'layout':layout,'references':refs})
      capture(case,full=True)
      if kind=='class-members':capture(case+'-students',locator=page.locator('form[action="/admin/school/students/batch"]'))
      elif kind=='student-first':capture(case+'-form',locator=page.locator('form[action="/admin/school/students/batch"]'))
   check('All 18 matrix cases completed',len(REPORT['matrix'])==18)
   check('All visual navigation remained read-only',state()['fingerprint']==baseline)
   phase='enrollment-actions'
   page.set_viewport_size({'width':360,'height':900});page.goto(class_url(),wait_until='networkidle')
   form=page.locator('form[action="/admin/school/students/batch"]')
   with page.expect_response(lambda r:r.request.method=='POST' and r.url.endswith('/admin/school/students/batch')) as empty_response:form.locator('button').click()
   check('Empty browser selection produces a non-mutating 400 error',empty_response.value.status==400 and state()['fingerprint']==baseline)
   capture('empty-selection-error',full=True);page.go_back();page.reload()
   form=page.locator('form[action="/admin/school/students/batch"]');form.locator('input[name="child_'+kids['first']+'"]').check();form.locator('input[name="child_'+kids['second']+'"]').check();form.locator('button').click()
   check('Class-first batch adds both and redirects to exact selected class',exact_context(meta['classId']) and {kids['first'],kids['second']}<=set(members()))
   capture('class-first-success',locator=page.locator('.school-class-members'))
   after_success=state()['fingerprint'];r=batch(meta['classId'],[kids['first'],kids['second']])
   check('Repeated batch rejected with 409 and no audit or membership mutation',r.status==409 and state()['fingerprint']==after_success)
   page.goto(qurl(query,'/admin/school/enrollment'),wait_until='networkidle')
   form=page.locator('form[action="/admin/school/students/batch"]');form.locator('input[name="child_'+kids['third']+'"]').check();form.locator('select[name="classId"]').select_option(meta['classTwoId']);form.locator('button').click()
   check('Student-first batch redirects to destination class with new member',exact_context(meta['classTwoId']) and kids['third'] in members() and kids['member'] not in members())
   # Reproduce stale visible form through the browser, not only an API assertion.
   page.goto(class_url(meta['classTwoId']),wait_until='networkidle');form=page.locator('form[action="/admin/school/students/batch"]');form.locator('input[name="child_'+kids['fourth']+'"]').check()
   r=batch(meta['classId'],[kids['fourth']]);check('Competing synthetic request admits stale candidate elsewhere',r.status==303)
   after_competitor=state()['fingerprint']
   with page.expect_response(lambda r:r.request.method=='POST' and r.url.endswith('/admin/school/students/batch')) as stale_response:form.locator('button').click()
   check('Submitting stale visible form shows 409 without transfer',stale_response.value.status==409 and state()['fingerprint']==after_competitor)
   check('Stale error page does not leak unrelated members',kids['member'] not in page.content() and kids['otherMember'] not in page.content())
   capture('stale-membership-error',full=True)
   page.go_back();page.reload();check('Refresh after stale error removes no-longer-available candidate',kids['fourth'] not in candidates())
   phase='rejected-and-concurrent-requests'
   stable=state()['fingerprint']
   bad=[('empty selection',meta['classId'],[],400),('wrong grade',meta['classId'],[kids['batchOne'],kids['otherGrade']],400),('suspended child',meta['classId'],[kids['batchOne'],kids['suspended']],404),('foreign child',meta['classId'],[kids['batchOne'],meta['foreignStudent']['id']],404),('existing other-class member',meta['classId'],[kids['batchOne'],kids['otherMember']],409),('over-capacity whole batch',meta['batchId'],[kids['batchOne'],kids['batchTwo']],409),('full class',meta['fullId'],[kids['batchOne']],409),('archived class',meta['archivedId'],[kids['batchOne']],409),('unsupported same numeric grade',meta['unsupportedPrimaryId'],[kids['batchOne']],409)]
   for label,cls,children,status in bad:
    r=batch(cls,children);check(label+' rejected with correct status',r.status==status,soft=True);check(label+' does not mutate data/audit',state()['fingerprint']==stable)
    check(label+' error excludes unrelated student IDs',all(kids[x] not in r.text() for x in ['member','otherMember','suspendedMember']))
   for label,role,origin in [('readonly role','readonly',BASE),('foreign scope','foreign',BASE),('foreign origin','supervisor','https://invalid.example')]:
    r=batch(meta['classId'],[kids['batchOne']],role,origin);check(label+' cannot enroll',r.status in [403,404] and state()['fingerprint']==stable)
   r=context.request.get(class_url(),headers={'x-qa-role':'readonly'})
   check('Read-only school role sees structure without student identities',r.status==200 and all(s not in r.text() for s in kids.values()))
   r=context.request.get(qurl(query,'/admin/school/enrollment'),headers={'x-qa-role':'readonly'});check('Read-only role forbidden from enrollment page',r.status==403)
   r=context.request.get(class_url(),headers={'x-qa-role':'anonymous'},max_redirects=0);check('Anonymous protected request redirects to login',r.status==303 and r.headers.get('location')=='/login')
   for q in [{**query,'classId':meta['gradeOneClassId']},{'trackId':meta['pathId'],'grade':'4'},{'trackId':meta['pathId'],'stage':'middle','grade':'4'}]:
    r=context.request.get(qurl(q));check('Forged/incomplete hierarchy rejected '+str(q),r.status in [400,404] and state()['fingerprint']==stable)
   r=context.request.get(qurl(query)+'&grade=4');check('Duplicate selector query rejected',r.status==400 and state()['fingerprint']==stable)
   # Server authority remains effective even though incompatible teachers are offered in the form.
   for tid in [meta['wrongTeacherId'],meta['wrongSubjectTeacherId']]:
    r=post('/admin/school/teachers',{'classId':meta['classId'],'teacherId':tid,'subject':'math'});check('Incompatible teacher rejected without mutation',r.status in [400,409] and state()['fingerprint']==stable)
   r=post('/admin/school/teachers',{'classId':meta['classId'],'teacherId':meta['teacherId'],'subject':'math'});check('Compatible teacher assigned and canonical redirect retained',r.status==303 and parse_qs(urlparse(r.headers['location']).query).get('classId')==[meta['classId']])
   # Two in-page fetches overlap at the HTTP boundary; exact-source store tests cover independent processes.
   page.goto(class_url(meta['raceId']),wait_until='networkidle')
   race=page.evaluate('''async args=>await Promise.all(args.students.map(id=>fetch('/admin/school/students/batch',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({classId:args.classId,['child_'+id]:'1'})}).then(async r=>({status:r.status,url:r.url,text:await r.text()}))))''',{'classId':meta['raceId'],'students':[kids['raceOne'],kids['raceTwo']]})
   REPORT['observations'].append({'name':'Last-seat parallel HTTP outcomes','statuses':[x['status'] for x in race]})
   race_members=[x for x in state()['school']['studentAssignments'] if x['class_id']==meta['raceId']]
   check('Concurrent last-seat HTTP submissions yield one success and one conflict',sorted(x['status'] for x in race)==[200,409] and len(race_members)==1)
   page.reload();check('Last-seat class ends full without extra candidate form',not candidates() and len(members())==1)
   capture('last-seat-concurrent-result',full=True)
   check('No browser page JavaScript errors',not REPORT['pageErrors'])
   check('No external page requests were made',not REPORT['blockedExternalRequests'])
   REPORT['status']='completed' if all(x['pass'] for x in REPORT['checks']) else 'completed-with-findings'
except Exception as exc:
 REPORT.update({'status':'failed','phase':phase,'error':str(exc),'traceback':traceback.format_exc(),'unexecuted':'Any later planned check not listed was not executed.'})
 if page is not None:
  try:capture('failure',full=True)
  except Exception:pass
finally:
 if browser is not None:
  try:browser.close()
  except Exception:pass
 if server is not None:
  server.terminate()
  try:stdout,stderr=server.communicate(timeout=10)
  except Exception:server.kill();stdout,stderr=server.communicate()
  REPORT['fixtureOutput']={'stdout':stdout,'stderr':stderr}
 (OUT/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
 print(json.dumps({'status':REPORT.get('status'),'checks':len(REPORT['checks']),'failed':[x for x in REPORT['checks'] if not x['pass']],'screenshots':len(REPORT['screenshots']),'matrixCases':len(REPORT['matrix']),'error':REPORT.get('error')},ensure_ascii=False))
sys.exit(0 if REPORT.get('status')=='completed' else 1)
