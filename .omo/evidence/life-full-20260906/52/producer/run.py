import hashlib, json, os, pathlib, shutil, subprocess, sys, tempfile, time
ROOT = pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4')
E = ROOT / '.omo/evidence/life-full-20260906/52/producer'
os.chdir(ROOT)
def identity():
    paths = subprocess.check_output(['git', 'ls-files', 'src', 'test', 'scripts', 'package.json', 'package-lock.json', '*config*']).decode().splitlines()
    paths += list(json.loads((E / 'carryover-before.json').read_text()))
    paths += ['test/playerBodyProjectPersistence.test.ts']
    return {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(), 'sha256': {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(set(paths)) if (ROOT/p).is_file()}}
label, *cmd = sys.argv[1:]
scratch = pathlib.Path(tempfile.mkdtemp(prefix='task52-'+label+'-', dir='/dev/shm'))
env = dict(os.environ, TMPDIR=str(scratch), XDG_CACHE_HOME=str(scratch/'xdg'), VITE_CACHE_DIR=str(scratch/'vite'), npm_config_cache=str(scratch/'npm'))
command = ['flock', '--timeout', '900', '/tmp/rpg-zzu-life-full-qa-01a0727b.lock', 'timeout', '--kill-after=10s', '600s', *cmd]
(E / (label+'.before.json')).write_text(json.dumps(identity(), indent=2)+'\n')
(E / (label+'.command.json')).write_text(json.dumps({'cwd':str(ROOT),'argv':command,'scratch':str(scratch),'env':{k:env[k] for k in ['TMPDIR','XDG_CACHE_HOME','VITE_CACHE_DIR','npm_config_cache']}},indent=2)+'\n')
with (E/(label+'.stdout')).open('wb') as out, (E/(label+'.stderr')).open('wb') as err:
    result = subprocess.run(command, env=env, stdout=out, stderr=err)
(E/(label+'.exit')).write_text(str(result.returncode)+'\n')
(E/(label+'.after.json')).write_text(json.dumps(identity(),indent=2)+'\n')
shutil.rmtree(scratch)
(E/(label+'.cleanup.json')).write_text(json.dumps({'scratch':str(scratch),'removed':not scratch.exists(),'directExit':result.returncode,'evidenceRetained':True},indent=2)+'\n')
print(label, 'direct exit', result.returncode)
print((E/(label+'.stdout')).read_text()[-9000:])
print((E/(label+'.stderr')).read_text()[-9000:])
sys.exit(result.returncode)
