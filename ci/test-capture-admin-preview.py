#!/usr/bin/env python3
"""Dependency-free mock regression suite; no SDK, emulator or network is used.

Run: PYTHONDONTWRITEBYTECODE=1 python3 ci/test-capture-admin-preview.py
All generated artifacts live in a temporary directory and are removed at exit.
"""
import atexit
import shutil
import importlib.util, json, tempfile, pathlib, zipfile, hashlib, sys
p=str(pathlib.Path(__file__).with_name('capture-admin-preview.py'))
spec=importlib.util.spec_from_file_location('capture',p); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=pathlib.Path(tempfile.mkdtemp(prefix='capture-tests-')); apk=root/'fixture.apk'; rev='a'*40
atexit.register(shutil.rmtree, root, ignore_errors=True)
routes={f'/admin/p{i}':f'p{i}.html' for i in range(19)}
files={f'p{i}.html':f'<h1>Title {i}</h1>'.encode() for i in range(19)}
manifest=dict(sourceRevision=rev,sourceDirty=False,mode='offline-static-preview',network=False,persistence=False,syntheticDataOnly=True,routes=routes,files={k:hashlib.sha256(v).hexdigest() for k,v in files.items()})
with zipfile.ZipFile(apk,'w') as z:
 z.writestr('assets/preview-manifest.json',json.dumps(manifest))
 for k,v in files.items(): z.writestr('assets/'+k,v)
m.sdk_tool=lambda name:name
m.time.sleep=lambda _:None
state={}; calls=[]
def fake(*a,**kw):
 calls.append(a)
 if a[0]=='aapt': return "package: name='app.teachabs.adminpreview' versionCode='14' versionName='0.1.4-review'" if a[2]=='badging' else "package: app.teachabs.adminpreview"
 a=a[3:]
 if a==('get-state',): return 'device'
 if a[:2]==('shell','getprop'): return '1' if a[-1]=='ro.kernel.qemu' else '35'
 if a==('shell','dumpsys','webviewupdate'): return 'Current WebView package: com.google.android.webview 130'
 if a[:2]==('shell','wm'):
  k=a[2]
  if len(a)==4: state[k]=a[3]; return ''
  base='1080x2400' if k=='size' else '420'
  return f'Physical {k}: {base}'+(f'\nOverride {k}: {state[k]}' if state.get(k,'reset')!='reset' else '')
 if a[:2]==('shell','settings'):
  if a[2]=='get': return state.get('scale','null')
  state['scale']=a[5] if a[2]=='put' else 'null'; return ''
 if a[0]=='install': return 'Success'
 if a[:3]==('shell','am','start'): state['title']='Title '+a[-1].split('/p')[-1]; return 'Status: ok'
 if a==('shell','dumpsys','activity','activities'): return 'mResumedActivity: app.teachabs.adminpreview/.PreviewActivity'
 if a[:3]==('shell','uiautomator','dump'): return 'UI hierchary dumped to: '+a[-1]
 if a[0]=='pull': pathlib.Path(a[2]).write_text('<hierarchy><node package="app.teachabs.adminpreview" text="'+state['title']+'" bounds="[0,50][500,100]"/><node package="com.android.systemui" text="clock '+str(len(calls))+'" bounds="[0,0][20,20]"/></hierarchy>'); return '1 file pulled'
 if a[:2]==('exec-out','screencap'): return b'\x89PNG\r\n\x1a\nfixture'
 return ''
m.run=fake
sys.argv=[p,'--serial','emulator-5554','--apk',str(apk),'--expected-revision',rev,'--output',str(root/'success')]
assert m.main()==0
r=json.loads((root/'success/capture-report.json').read_text()); assert len(r['completedCases'])==171 and len(r['geometryComparisons'])==114 and r['restored']
assert all(len(c['positions'])==2 for c in r['cases'])
assert any(c[3:6] == ('shell', 'mkdir', '-p') and c[-1].startswith('/data/local/tmp/teachabs-review-') for c in calls)
assert all('/sdcard/' not in str(c) for c in calls)
assert all(c[-1].startswith('/data/local/tmp/teachabs-review-') for c in calls if c[3:6] == ('shell', 'uiautomator', 'dump'))
assert len(list((root/'success').glob('*.png')))==342
assert all(not g['textNodeGeometryDiffersFrom1_0'] for g in r['geometryComparisons'])
assert all(any(n['package']=='com.android.systemui' for n in c['positions']['top']['textNodes']) for c in r['cases'])
# Failure after mutation still produces partial evidence and restores all originals.
real_fake=fake
n=0
def broken(*a,**kw):
 global n
 if 'screencap' in a:
  n+=1
  if n==3: raise RuntimeError('injected screenshot failure')
 return real_fake(*a,**kw)
m.run=broken
sys.argv[-1]=str(root/'failure'); assert m.main()==1
r=json.loads((root/'failure/capture-report.json').read_text()); assert r['restored'] and len(r['completedCases'])==1 and 'injected' in r['failure']['message']
# Reject physical serial before invoking any adb command.
calls.clear(); sys.argv[2]='physical-device';sys.argv[-1]=str(root/'physical');assert m.main()==1;assert not calls
# Reject wrong emulator property without mutation.
sys.argv[2]='emulator-5554';sys.argv[-1]=str(root/'not-qemu')
def notqemu(*a,**kw):
 if a[-1]=='ro.kernel.qemu':return '0'
 return real_fake(*a,**kw)
m.run=notqemu; calls.clear();assert m.main()==1;assert not any('install' in c or 'put' in c for c in calls)
# Native bounds observation does not claim clipping proof.
x=root/'bounds.xml';x.write_text('<hierarchy><node text="example" bounds="[-1,0][2000,200]"/></hierarchy>')
assert m.text_geometry(x,960,2400)['observations']
# Tampering fails exact digest verification.
manifest['files']['p0.html']='0'*64
bad=root/'bad.apk'
with zipfile.ZipFile(bad,'w') as z:
 z.writestr('assets/preview-manifest.json',json.dumps(manifest))
 for k,v in files.items():z.writestr('assets/'+k,v)
try:m.validate_apk(bad,rev,{})
except RuntimeError as e:assert 'hash mismatch' in str(e)
else:raise AssertionError('tamper accepted')
print('PASS: 171-case capture, 342 screenshots/XML pairs, geometry comparisons, partial failure/restoration, physical-device refusal, qemu refusal, bounds observations, and hash-tamper rejection. Fixtures:',root)
# XML failures always attempt one bounded screenshot and preserve original failure.
for fail_at, fail_png in [(1,False),(2,False),(1,True)]:
 dump_count=0; png_attempts=[]
 def broken_xml(*a,**kw):
  global dump_count
  if 'uiautomator' in a:
   dump_count+=1
   if dump_count==fail_at: raise RuntimeError('exit137 UiAutomation.connect TimeoutException')
  if 'screencap' in a and dump_count==fail_at:
   png_attempts.append(kw)
   if fail_png:raise TimeoutError('diagnostic screencap timeout')
  return real_fake(*a,**kw)
 m.run=broken_xml
 sys.argv=[p,'--serial','emulator-5554','--apk',str(apk),'--expected-revision',rev,'--output',str(root/f'xml-failure-{fail_at}-{fail_png}')]
 assert m.main()==1
 r=json.loads((pathlib.Path(sys.argv[-1])/'capture-report.json').read_text())
 assert r['restored'] and not r['completedCases'] and not r['visualApproval']
 assert 'UiAutomation.connect' in r['failure']['message']
 assert len(png_attempts)==1 and png_attempts[0]['timeout']==20 and png_attempts[0]['binary']
 case=r['cases'][0];assert not case['routeConfirmed'] and case['status']=='failed-unconfirmed'
 diagnostic=case['diagnostics'][0]
 assert not diagnostic['routeConfirmed'] and not diagnostic['visualApproval']
 if fail_png:assert diagnostic['status']=='failed' and 'screenshot' not in diagnostic
 else:assert diagnostic['status']=='saved' and diagnostic['screenshot'].endswith('-unconfirmed.png') and (pathlib.Path(sys.argv[-1])/diagnostic['screenshot']).exists()
print('PASS: top/scroll XML failure each triggers exactly one 20-second diagnostic attempt; screenshot failure preserves original XML exception, partial report and restoration.')
for label, output in [('transient','ERROR: null root node returned by UiTestAutomationBridge.'),('denied','ERROR: permission denied'),('unknown','ERROR: unexpected dump failure')]:
 dump_count=0
 def zero_exit(*a,**kw):
  global dump_count
  if 'uiautomator' in a:
   dump_count+=1
   assert kw['merge_stderr'] and kw['timeout']==30
   if label!='transient' or dump_count==1:return output
  return real_fake(*a,**kw)
 m.run=zero_exit;sys.argv=[p,'--serial','emulator-5554','--apk',str(apk),'--expected-revision',rev,'--output',str(root/label)]
 result=m.main();r=json.loads((root/label/'capture-report.json').read_text())
 if label=='transient':
  assert result==0 and len(r['completedCases'])==171
  attempts=r['cases'][0]['xmlDumpAttempts'];assert attempts[0]['output']==output and attempts[0]['remoteXml']!=attempts[1]['remoteXml']
 else:assert result==1 and dump_count==1 and not r['completedCases'] and r['restored']
print('PASS: explicit transient null-root recovery; stdout/stderr retained; unique attempt paths; no retries for denial or unknown zero-exit errors.')

# A valid but not-yet-ready tree causes the outer h1 loop to invoke dump again.
# Every invocation must use a different device path, so old XML cannot satisfy it.
pull_count = 0
remote_paths = []
def late_heading(*args, **kwargs):
    global pull_count
    if "uiautomator" in args:
        remote_paths.append(args[-1])
    result = real_fake(*args, **kwargs)
    if len(args) > 3 and args[3] == "pull":
        pull_count += 1
        if pull_count == 1:
            pathlib.Path(args[-1]).write_text('<hierarchy><node package="app.teachabs.adminpreview" text="Loading" bounds="[0,50][500,100]"/></hierarchy>')
    return result
m.run = late_heading
sys.argv = [p, "--serial", "emulator-5554", "--apk", str(apk),
            "--expected-revision", rev, "--output", str(root / "late-heading")]
assert m.main() == 0
assert len(remote_paths) == len(set(remote_paths)) == 343
report = json.loads((root / "late-heading/capture-report.json").read_text())
assert len(report["completedCases"]) == 171
attempts = report["cases"][0]["xmlDumpAttempts"]
assert attempts[0]["position"] == attempts[1]["position"]
assert attempts[0]["invocation"] != attempts[1]["invocation"]
assert attempts[0]["remoteXml"] != attempts[1]["remoteXml"]
print("PASS: repeated h1-readiness dumps cannot reuse stale XML paths.")
