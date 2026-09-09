import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time
ROOT = pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4')
OUT = ROOT / '.omo/evidence/life-full-20260906/12/ui/fixtures-r4'
SCRATCH = pathlib.Path('/dev/shm/st_01a07ba6')
def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1048576), b''):
            h.update(b)
    return h.hexdigest()
def identity():
    paths = set(subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')) - {''}
    for d in ['src','test','scripts','openwiki']:
        paths.update(str(p.relative_to(ROOT)) for p in (ROOT/d).rglob('*') if p.is_file())
    files = {p:digest(ROOT/p) for p in sorted(paths) if (ROOT/p).is_file() and not p.startswith(str(OUT.relative_to(ROOT))+'/')}
    git = {key:subprocess.check_output(cmd,cwd=ROOT).decode() for key,cmd in {
        'head':['git','rev-parse','HEAD'], 'branch':['git','branch','--show-current'],
        'status':['git','status','--porcelain=v1'], 'index':['git','diff','--cached','--binary']}.items()}
    return {'files':files,'git':git}
def dump(name,data): (OUT/name).write_text(json.dumps(data,indent=2)+'\n')
mode = sys.argv[1]
assert mode in ['connection','author','probe','probe-final','probe-certified']
assert not (OUT/f'{mode}.command.json').exists(), 'preserve original command receipt'
before = identity()
dump(f'{mode}.before.json',before)
assert not SCRATCH.exists(), 'owned scratch unexpectedly exists'
SCRATCH.mkdir(mode=0o700)
env = dict(os.environ, TMPDIR=str(SCRATCH), XDG_CACHE_HOME=str(SCRATCH/'xdg'), VITE_CACHE_DIR=str(SCRATCH/'vite'))
argv = ['flock','--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock',
        'timeout','--signal=TERM','--kill-after=30s','600s','node','node_modules/vite-node/vite-node.mjs',
        '--script',str(OUT.relative_to(ROOT)/'fixture.mts'),'--',mode]
record = {'argv':argv,'cwd':str(ROOT),'environment':{k:env[k] for k in ['TMPDIR','XDG_CACHE_HOME','VITE_CACHE_DIR']},'started':time.time(),
          'ownedInputsBefore':{str(p.relative_to(OUT)):digest(p) for p in OUT.iterdir() if p.name.endswith(('.mts','.py','.reloaded.json','.authored.json'))}}
code = 1
try:
    with (OUT/f'{mode}.stdout').open('w') as stdout, (OUT/f'{mode}.stderr').open('w') as stderr:
        code = subprocess.run(argv,cwd=ROOT,env=env,stdout=stdout,stderr=stderr).returncode
    record.update(exit=code,finished=time.time())
    (OUT/f'{mode}.exit').write_text(str(code)+'\n')
finally:
    shutil.rmtree(SCRATCH)
    after=identity()
    dump(f'{mode}.after.json',after)
    record['stdoutSha256']=digest(OUT/f'{mode}.stdout')
    record['stderrSha256']=digest(OUT/f'{mode}.stderr')
    record['ownedInputsAfter']={p:digest(OUT/p) for p in record['ownedInputsBefore']}
    assert record['ownedInputsBefore'] == record['ownedInputsAfter']
    dump(f'{mode}.command.json',record)
    same = before == after
    dump(f'{mode}.cleanup.json',{'scratchAbsent':not SCRATCH.exists(),'protectedIdentityUnchanged':same,
        'lockRetained':pathlib.Path('/tmp/rpg-zzu-life-full-qa-01a0727b.lock').exists(),
        'remoteProjectsRetainedForNativeConsumer':True,'browserOrServerStarted':False})
    if not same:
        raise RuntimeError('protected identity changed')
print(json.dumps(record,indent=2))
sys.exit(code)
