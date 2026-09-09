import os,pathlib,json,subprocess,shutil,datetime
from audit import R,E,P,H,declared,sha,save,snapshot
T=pathlib.Path('/dev/shm/st_01a07b66-certify')
assert not T.exists();T.mkdir()
try:
 for name,contents in [('clean','line\n'),('bad','line \n')]:
  f=T/name;f.write_text(contents);argv=['git','diff','--no-index','--check','/dev/null',str(f)]
  r=subprocess.run(argv,capture_output=True)
  (E/('whitespace-calibration-'+name+'.stdout')).write_bytes(r.stdout);(E/('whitespace-calibration-'+name+'.stderr')).write_bytes(r.stderr);(E/('whitespace-calibration-'+name+'.exit')).write_text(str(r.returncode)+'\n')
  save('whitespace-calibration-'+name+'.command.json',{'argv':argv,'cwd':str(R),'exit':r.returncode,'inputSha256':sha(f),'input':contents,'stdoutSha256':sha(E/('whitespace-calibration-'+name+'.stdout')),'stderrSha256':sha(E/('whitespace-calibration-'+name+'.stderr'))})
  assert r.returncode==(1 if name=='clean' else 2)
  assert (not r.stdout) if name=='clean' else (b'trailing whitespace' in r.stdout)
 checks=[]
 for i in range(4):
  n='whitespace-new-'+str(i);exit=int((E/(n+'.exit')).read_text());out=(E/(n+'.stdout')).read_bytes();err=(E/(n+'.stderr')).read_bytes()
  checks.append({'label':n,'exit':exit,'stdoutBytes':len(out),'stderrBytes':len(err),'clean':exit==1 and not out and not err});assert checks[-1]['clean']
 save('whitespace-assessment.json',{'originalWrapperExit':1,'originalReceiptsUnchanged':True,'meaning':'git diff --no-index implies difference exit1, including with --check; actual whitespace diagnostics produce exit2. Calibration retains both direct results. Four original new-file checks have exit1 and empty streams, not whitespace failures. Serial runner conservatively classified any nonzero as failure; no validator was retried.','checks':checks})
 s=snapshot();initial=json.loads((E/'initial-identity.json').read_text())
 for k in ['head','index','hashes','producer']:assert s[k]==initial[k],k
 assert s['declaredMatches'];assert not os.path.lexists(R/'dist');assert not pathlib.Path('/dev/shm/st_01a07b66').exists();assert not pathlib.Path('/dev/shm/st_01a07b22').exists();assert not (E/'COMMITTED.json').exists()
 save('png-comparison.json',{'visualInspection':False,'comparisons':[{'path':f,'before':h,'after':s['producer'][f],'equal':h==s['producer'][f]} for f,h in initial['producer'].items() if f.endswith('.png')],'limit':'Before/after identity of all producer-r3 PNG bytes, not a visual judgment or invented execution-time producer manifest.'})
 borrowed=[]
 for label,d,stem in [('ui91',P/'tests','ui-green-final'),('task52-135',R/'.omo/evidence/life-full-20260906/52/verify','focused'),('core355',R/'.omo/evidence/life-full-20260906/47-48/r3/verify-r2','tests'),('native',P/'native','native-qa-final'),('remote',P/'native','remote-save')]:
  files=[f for f in d.glob(stem+'.*') if f.is_file()]; records={str(f.relative_to(R)):{'sha256':sha(f),'bytes':f.stat().st_size} for f in files}
  for f in files:
   if f.suffix in ['.stdout','.stderr','.log']:f.read_bytes()
  borrowed.append({'label':label,'exit':int((d/(stem+'.exit')).read_text()),'files':records,'rerunHere':False})
 save('borrowed-receipts.json',borrowed)
 result=subprocess.run(['git','diff','--','openwiki/runtime-project-schema.md','openwiki/runtime-sessions.md','openwiki/INDEX.md'],capture_output=True);(E/'docs.diff').write_bytes(result.stdout);assert result.returncode==0
 save('certified-identity.json',s)
 save('certification.json',{'status':'needs-fix','commitCreated':False,'head':s['head'],'indexUnchanged':True,'sourceHashesUnchanged':True,'producer119FilesUnchanged':len(s['producer'])==119,'changedCodeAndTests':len(declared),'docs':s['docs'],'buildExit':int((E/'build.exit').read_text()),'diagnosticsExit':int((E/'diagnostics.exit').read_text()),'whitespace':'tracked exit0; four added-file checks exit1 difference-only, empty diagnostics; independently calibrated','nativePrerequisitesComplete':False,'requiredNativeFixes':['Successful decoration move to different coordinates and rotation with resulting owner/orientation evidence','Actual last-local-exit refusal without moving out of the tested enclosure; lastExitBlocked must be true with unchanged costs/owners'],'scope':'No whole Task12, UI visual, Phase4 or overall approval.'})
 print('Certification: source/index/producer frozen; CLI gates passed; native prerequisites incomplete; NO COMMIT.')
finally:
 shutil.rmtree(T);save('certification-cleanup.json',{'privateTmpfs':str(T),'removed':not T.exists(),'sharedLockDeleted':False,'sharedCacheDeleted':False})
