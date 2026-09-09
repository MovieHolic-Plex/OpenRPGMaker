import pathlib, subprocess, json, os, hashlib, shutil, signal, datetime
E=pathlib.Path(__file__).resolve().parent
W=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3')
LOCK='/tmp/rpg-zzu-life-full-qa-01a0727b.lock'
def identity():
    def git(*a): return subprocess.check_output(['git',*a],cwd=W).decode()
    files=git('ls-files','-z').split('\0')
    return dict(head=git('rev-parse','HEAD').strip(),status=git('status','--porcelain=v1'),hashes={p:hashlib.sha256((W/p).read_bytes()).hexdigest() for p in files if p and (W/p).is_file() and not (W/p).is_symlink()},dependencies=str((W/'node_modules').resolve()))
def run(name,argv,seconds=420):
    assert not (E/(name+'.exit')).exists()
    before=identity(); (E/(name+'.before.json')).write_text(json.dumps(before,indent=2))
    assert before['head']=='b87c9822f431ece4674e97a9d9cd15d1956be327' and not before['status']
    scratch=E/('scratch-'+name); scratch.mkdir()
    env=os.environ.copy()
    for var,leaf in [('TMPDIR','tmp'),('VITE_CACHE_DIR','cache'),('npm_config_cache','npm-cache')]:
        (scratch/leaf).mkdir(); env[var]=str(scratch/leaf)
    command=['flock','--timeout','900',LOCK,'timeout','--kill-after=15s',str(seconds)+'s',*argv]
    (E/(name+'.command.json')).write_text(json.dumps(dict(argv=command,cwd=str(W),environment={k:env[k] for k in ['TMPDIR','VITE_CACHE_DIR','npm_config_cache']},started=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2))
    proc=None; code=None
    def interrupted(sig,frame):
        if proc: os.killpg(proc.pid,sig)
    old={s:signal.signal(s,interrupted) for s in [signal.SIGTERM,signal.SIGINT]}
    try:
        with (E/(name+'.stdout')).open('wb') as out,(E/(name+'.stderr')).open('wb') as err:
            proc=subprocess.Popen(command,cwd=W,env=env,stdout=out,stderr=err,start_new_session=True); code=proc.wait()
        (E/(name+'.exit')).write_text(str(code)+'\n')
    finally:
        for s,h in old.items(): signal.signal(s,h)
        after=identity(); (E/(name+'.after.json')).write_text(json.dumps(after,indent=2))
        shutil.rmtree(scratch)
        (E/(name+'.cleanup.json')).write_text(json.dumps(dict(scratch=str(scratch),removed=not scratch.exists(),identity_unchanged=before==after,exit=code),indent=2))
    print(name,code,flush=True)
    return code
if __name__=='__main__':
    import sys
    name=sys.argv[1]
    if name=='tests': argv=json.loads((E.parent/'producer/tests.command.json').read_text())['argv']
    elif name=='typecheck': argv=['npm','run','typecheck:app']
    elif name=='diagnostics': argv=['node',str(E/'diagnostics.mjs')]
    else: argv=['node','node_modules/vite-node/vite-node.mjs','--config',str(E/'probe.config.mjs'),str(E/'independent-rights.mts')]
    sys.exit(run(name,argv))
