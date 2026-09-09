import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile
R=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4'); E=R/'.omo/evidence/life-full-20260906/52/verify'; P=E.parent/'producer'
os.chdir(R); os.environ['GIT_OPTIONAL_LOCKS']='0'
def dump(name,obj): (E/name).write_text(json.dumps(obj,indent=2)+'\n')
def git(*args): return subprocess.check_output(['git',*args]).decode()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def identity():
 paths=set(git('ls-files','src','test','scripts','openwiki','package.json','package-lock.json','*config*').splitlines())|set(H['carryoverBefore'])|{H['correction']['path'],H['newTest']['path']}
 index=pathlib.Path(git('rev-parse','--git-path','index').strip())
 return {'head':git('rev-parse','HEAD').strip(),'index':sha(index),'status':git('status','--short'),'hashes':{p:sha(R/p) if (R/p).is_file() else None for p in sorted(paths)}}
H=json.loads((P/'SOURCE-HANDOFF.json').read_text())
def check(s):
 assert s['head']==H['head']
 assert H['carryoverBefore']==H['carryoverAfter']
 for p,h in H['carryoverBefore'].items(): assert s['hashes'][p]==h,p
 for k in ['correction','newTest']: assert s['hashes'][H[k]['path']]==H[k]['sha256'],k
label,*cmd=sys.argv[1:]
if label!='--locked':
 argv=['flock','--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','python3',str(E/'run.py'),'--locked',label,*cmd]
 dump(label+'.lock-command.json',{'cwd':str(R),'argv':argv})
 result=subprocess.run(argv); (E/(label+'.lock-exit')).write_text(str(result.returncode)+'\n'); sys.exit(result.returncode)
label,*cmd=cmd
before=identity(); dump(label+'.before.json',before); check(before)
initial=E/'initial.json'
if initial.exists(): assert before==json.loads(initial.read_text()),'source identity changed since initial'
else: dump('initial.json',before)
scratch=pathlib.Path(tempfile.mkdtemp(prefix='cache-'+label+'-',dir=E))
env=dict(os.environ,TMPDIR=str(scratch),XDG_CACHE_HOME=str(scratch/'xdg'),VITE_CACHE_DIR=str(scratch/'vite'),npm_config_cache=str(scratch/'npm'),npm_config_update_notifier='false',npm_config_offline='true',PYTHONDONTWRITEBYTECODE='1')
argv=['timeout','--kill-after=10s','600s',*cmd]
dump(label+'.command.json',{'cwd':str(R),'argv':argv,'directArgv':cmd,'env':{k:env[k] for k in ['TMPDIR','XDG_CACHE_HOME','VITE_CACHE_DIR','npm_config_cache','npm_config_update_notifier','npm_config_offline','GIT_OPTIONAL_LOCKS']}})
try:
 with (E/(label+'.stdout')).open('wb') as out,(E/(label+'.stderr')).open('wb') as err: result=subprocess.run(argv,env=env,stdout=out,stderr=err)
 (E/(label+'.exit')).write_text(str(result.returncode)+'\n')
finally:
 after=identity(); dump(label+'.after.json',after)
 shutil.rmtree(scratch); dump(label+'.cleanup.json',{'scratch':str(scratch),'removed':not scratch.exists(),'identityUnchanged':before==after})
check(after); assert before==after,'validator mutated source/index/status'
print(label,'direct exit',result.returncode); print((E/(label+'.stdout')).read_text()); print((E/(label+'.stderr')).read_text()); sys.exit(result.returncode)
