import os
import sys
import subprocess
import shutil
import datetime
from pathlib import Path
from audit import R, E, D, identity, save, sha, load
LOCK = '/tmp/rpg-zzu-life-full-qa-01a0727b.lock'
SCRATCH = Path('/dev/shm/st_01a07bcd')

def run(name, args):
    assert not (E / (name + '.exit')).exists()
    argv = ['timeout', '--signal=TERM', '--kill-after=30s', '900s', *args]
    before = identity()
    save(name + '.before.json', before)
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (E / (name + '.stdout')).open('wb') as out, (E / (name + '.stderr')).open('wb') as err:
        result = subprocess.run(argv, cwd=R, stdout=out, stderr=err)
    (E / (name + '.exit')).write_text(str(result.returncode) + '\n')
    save(name + '.command.json', {'argv': args, 'boundedArgv': argv, 'cwd': str(R), 'started': start, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exit': result.returncode, 'lockHeld': LOCK, 'environment': {k: os.environ[k] for k in ['TMPDIR', 'XDG_CACHE_HOME', 'npm_config_cache', 'npm_config_offline', 'npm_config_update_notifier']}, 'stdoutSha256': sha(E / (name + '.stdout')), 'stderrSha256': sha(E / (name + '.stderr'))})
    after = identity()
    save(name + '.after.json', after)
    assert all((before[k] == after[k] for k in ['hashes', 'head', 'index']))
    print(name, result.returncode, flush=True)
    return result.returncode
if __name__ == '__main__':
    if '--locked' not in sys.argv:
        argv = ['flock', '--timeout', '900', LOCK, sys.executable, str(E / 'run.py'), '--locked']
        save('lock.command.json', {'argv': argv, 'cwd': str(R)})
        with (E / 'lock.stdout').open('wb') as out, (E / 'lock.stderr').open('wb') as err:
            r = subprocess.run(argv, cwd=R, stdout=out, stderr=err)
        (E / 'lock.exit').write_text(str(r.returncode) + '\n')
        print('locked runner', r.returncode)
        sys.exit(r.returncode)
    assert not SCRATCH.exists()
    SCRATCH.mkdir(mode=448)
    os.environ.update(TMPDIR=str(SCRATCH), XDG_CACHE_HOME=str(SCRATCH / 'xdg'), npm_config_cache=str(SCRATCH / 'npm'), npm_config_offline='true', npm_config_update_notifier='false', PYTHONDONTWRITEBYTECODE='1')
    results = {}
    try:
        for n, a in [('openwiki-index', ['npm', 'run', 'openwiki:index']), ('openwiki-index-check', ['npm', 'run', 'openwiki:index', '--', '--check']), ('openwiki-verify', ['npm', 'run', 'openwiki:verify']), ('whitespace', ['git', 'diff', '--check'])]:
            results[n] = run(n, a)
        for i, f in enumerate(sorted(set(D) - set(subprocess.check_output(['git', 'ls-files'], cwd=R, text=True).splitlines()))):
            n = 'whitespace-new-' + str(i)
            results[n] = run(n, ['git', 'diff', '--no-index', '--check', '/dev/null', f])
            assert results[n] == 1 and (not (E / (n + '.stdout')).stat().st_size) and (not (E / (n + '.stderr')).stat().st_size), 'Git difference-only is 1, diagnostic failures are not ignored'
    finally:
        shutil.rmtree(SCRATCH)
        final = identity()
        save('cli-final-identity.json', final)
        old = load(E / 'initial-identity.json')
        preserved = {p: sha(R / p) == v['sha256'] for p, v in load(E / 'borrowed-inventory.json').items()}
        save('cleanup.json', {'scratch': str(SCRATCH), 'removed': not SCRATCH.exists(), 'lockRetained': Path(LOCK).exists(), 'sharedCleanup': False, 'browserServerRemoteActions': False, 'headIndexSourceUnchanged': all((final[k] == old[k] for k in ['head', 'index', 'hashes'])), 'borrowedAllPreserved': all(preserved.values()), 'results': results})
    assert all((v == 0 for k, v in results.items() if not k.startswith('whitespace-new-')))
    assert all(preserved.values())
