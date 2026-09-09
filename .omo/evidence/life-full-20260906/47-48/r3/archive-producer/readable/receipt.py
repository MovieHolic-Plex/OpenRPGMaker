#!/usr/bin/env python3
"""NEW r3 command capture; evidence is outside the source checkout."""
import pathlib, subprocess, json, os, sys, hashlib, tempfile, shutil, signal, datetime
E=pathlib.Path(__file__).resolve().parent
W=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3')
P=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4')
LOCK='/tmp/rpg-zzu-life-full-qa-01a0727b.lock'
def hashes():
    if not (W/'.git').exists(): return {}
    paths=subprocess.check_output(['git','ls-files','-z'],cwd=W).decode().split('\0')
    paths+=['test/spatialRecoveryRights.test.ts']
    return {p:hashlib.sha256((W/p).read_bytes()).hexdigest() for p in sorted(set(paths)) if p and (W/p).is_file() and not (W/p).is_symlink()}
def run(name,argv,cwd=W,seconds=360,heavy=False,build=False):
    assert not (E/(name+'.exit')).exists(), 'Receipt overwrite forbidden'
    before=hashes(); (E/(name+'.inputs.json')).write_text(json.dumps(before,indent=2))
    scratch=pathlib.Path(tempfile.mkdtemp(prefix='st_01a079b9-'+name+'-',dir='/dev/shm'))
    env=os.environ.copy()
    for var,leaf in [('TMPDIR','tmp'),('VITE_CACHE_DIR','cache'),('npm_config_cache','npm-cache')]:
        (scratch/leaf).mkdir();env[var]=str(scratch/leaf)
    if build:
        assert not (W/'dist').exists() and not (W/'dist').is_symlink()
        (scratch/'dist').mkdir();(W/'dist').symlink_to(scratch/'dist')
    command=['timeout','--kill-after=15s',str(seconds)+'s',*argv]
    if heavy:command=['flock','--timeout','900',LOCK,*command]
    metadata={'argv':argv,'executed_argv':command,'cwd':str(cwd),'scratch':str(scratch),'environment_overrides':{k:env[k] for k in ['TMPDIR','VITE_CACHE_DIR','npm_config_cache']},'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runner_sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
    (E/(name+'.command.json')).write_text(json.dumps(metadata,indent=2))
    proc=None
    def interrupt(sig,frame):
        if proc: os.killpg(proc.pid,sig)
    old={s:signal.signal(s,interrupt) for s in [signal.SIGTERM,signal.SIGINT]}
    code=None
    try:
        with (E/(name+'.stdout')).open('wb') as out,(E/(name+'.stderr')).open('wb') as err:
            proc=subprocess.Popen(command,cwd=cwd,env=env,stdout=out,stderr=err,start_new_session=True)
            code=proc.wait()
        (E/(name+'.exit')).write_text(str(code)+'\n')
    finally:
        for s,h in old.items():signal.signal(s,h)
        after=hashes();(E/(name+'.after.json')).write_text(json.dumps(after,indent=2))
        if build and (W/'dist').is_symlink() and os.readlink(W/'dist')==str(scratch/'dist'): (W/'dist').unlink()
        shutil.rmtree(scratch)
        (E/(name+'.cleanup.json')).write_text(json.dumps({'scratch':str(scratch),'scratch_removed':not scratch.exists(),'dist_removed':not (W/'dist').is_symlink() if build else None,'source_bytes_unchanged':before==after,'changed_paths':[p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)],'servers_started':False,'shared_cache_deleted':False,'direct_exit':code},indent=2))
    print(name, 'exit='+str(code),flush=True)
    return code
if __name__=='__main__':
    name=sys.argv[1];heavy=sys.argv[2]=='heavy';seconds=int(sys.argv[3]);argv=sys.argv[4:]
    sys.exit(run(name,argv,seconds=seconds,heavy=heavy,build=name=='build'))
