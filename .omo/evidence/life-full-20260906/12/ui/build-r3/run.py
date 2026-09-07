import os, pathlib, json, subprocess, datetime, shutil, sys
from audit import R,E,P,H,declared,sha,save,snapshot
T=pathlib.Path('/dev/shm/st_01a07b66'); LOCK='/tmp/rpg-zzu-life-full-qa-01a0727b.lock'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def same(s):
 initial=json.loads((E/'initial-identity.json').read_text())
 assert s['declaredMatches']
 for k in ['head','index','hashes','producer']:assert s[k]==initial[k],f'Frozen {k} changed'
def run(name,args,seconds=900):
 assert not (E/(name+'.exit')).exists(),'Refuse receipt overwrite'
 before=snapshot();same(before);save(name+'.before.json',before)
 argv=['timeout','--signal=TERM','--kill-after=30s',str(seconds)]+args
 env=os.environ.copy();env.update(TMPDIR=str(T/'tmp'),TMP=str(T/'tmp'),TEMP=str(T/'tmp'),npm_config_cache=str(T/'npm'),XDG_CACHE_HOME=str(T/'cache'),VITE_CACHE_DIR=str(T/'vite'),npm_config_offline='true',npm_config_update_notifier='false',GIT_OPTIONAL_LOCKS='0')
 started=now()
 with (E/(name+'.stdout')).open('w') as out,(E/(name+'.stderr')).open('w') as err:r=subprocess.run(argv,stdout=out,stderr=err,env=env)
 (E/(name+'.exit')).write_text(str(r.returncode)+'\n')
 save(name+'.command.json',{'argv':args,'boundedArgv':argv,'cwd':str(R),'start':started,'end':now(),'directBoundedExit':r.returncode,'timeoutExit124IsFailure':True,'sharedLock':LOCK,'lockHeldBySerialParent':True,'environment':{k:env[k] for k in ['TMPDIR','TMP','TEMP','npm_config_cache','XDG_CACHE_HOME','VITE_CACHE_DIR','npm_config_offline','npm_config_update_notifier','GIT_OPTIONAL_LOCKS']},'stdoutSha256':sha(E/(name+'.stdout')),'stderrSha256':sha(E/(name+'.stderr'))})
 after=snapshot();save(name+'.after.json',after);same(after);print(name,r.returncode,flush=True)
 return r.returncode
if __name__=='__main__':
 if '--locked' not in sys.argv:
  args=['flock','--timeout','900',LOCK,sys.executable,str(E/'run.py'),'--locked'];save('serial-lock.command.json',{'argv':args,'cwd':str(R),'start':now()})
  with (E/'serial-lock.stdout').open('w') as out,(E/'serial-lock.stderr').open('w') as err:r=subprocess.run(args,stdout=out,stderr=err)
  (E/'serial-lock.exit').write_text(str(r.returncode)+'\n');print('serial lock run',r.returncode);sys.exit(r.returncode)
 same(snapshot());assert not T.exists();assert not os.path.lexists(R/'dist'),'Existing dist must not be altered'
 T.mkdir();(T/'tmp').mkdir();(T/'dist').mkdir();os.symlink(T/'dist',R/'dist');results={}
 try:
  results['diagnostics']=run('diagnostics',['node',str(E/'diagnostics.mjs')])
  results['typecheck-app']=run('typecheck-app',['npm','run','typecheck:app'])
  results['build']=run('build',['npm','run','build'],1200)
  save('build-output-manifest.json',{str(f.relative_to(T/'dist')):{'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted((T/'dist').rglob('*')) if f.is_file()})
  for n,a in [('openwiki-index',['npm','run','openwiki:index']),('openwiki-index-check',['npm','run','openwiki:index','--','--check']),('openwiki-verify',['npm','run','openwiki:verify']),('whitespace',['git','diff','--check'])]:results[n]=run(n,a)
  untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines()
  for i,f in enumerate(untracked):
   if f in declared:results['whitespace-new-'+str(i)]=run('whitespace-new-'+str(i),['git','diff','--no-index','--check','/dev/null',f])
 finally:
  if (R/'dist').is_symlink() and os.readlink(R/'dist')==str(T/'dist'):(R/'dist').unlink()
  shutil.rmtree(T)
  final=snapshot();save('final-identity.json',final)
  save('cleanup.json',{'privateTmpfs':str(T),'removed':not T.exists(),'distAbsent':not os.path.lexists(R/'dist'),'sharedCacheDeleted':False,'sharedLockDeleted':False,'serversStarted':False,'results':results,'sourceFrozen':final['hashes']==json.loads((E/'initial-identity.json').read_text())['hashes'],'producerPreserved':final['producer']==json.loads((E/'initial-identity.json').read_text())['producer'],'end':now()})
 sys.exit(0 if results and all(x==0 for x in results.values()) else 1)
