#!/usr/bin/env python3
"""Bind an unchanged staged merge to a direct validator exit and its raw output."""
import datetime, hashlib, json, os, pathlib, subprocess, sys
out = pathlib.Path(__file__).resolve().parent
root = out.parents[4]
os.chdir(root)
label, *command = sys.argv[1:]
assert os.environ['TMPDIR'] == '/dev/shm/rpg-zzu-ai-harness-p2-01a07564'
def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()
def identity():
    subprocess.run(['git', 'diff', '--exit-code'], check=True, stdout=subprocess.DEVNULL)
    assert not git('ls-files', '-u')
    assert git('rev-parse', 'MERGE_HEAD') == '147218a2dcfd5d5996e666395e53626706904a60'
    paths = git('ls-files', 'src', 'test', 'scripts', 'openwiki', 'DESIGN.md', 'package.json', 'package-lock.json', '*config*').splitlines()
    return {'head': git('rev-parse', 'HEAD'), 'mergeHead': git('rev-parse', 'MERGE_HEAD'),
        'indexTree': git('write-tree'), 'workingVersusIndex': 'clean',
        'files': {p: {'sha256': hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest(), 'indexBlob': git('rev-parse', ':' + p)} for p in paths}}
receipt = {'command': command, 'cwd': str(root), 'TMPDIR': os.environ['TMPDIR'],
    'start': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'before': identity()}
with (out / (label + '.log')).open('w') as log:
    process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
receipt.update(exit=process.returncode, end=datetime.datetime.now(datetime.timezone.utc).isoformat(), after=identity())
assert receipt['before'] == receipt['after']
(out / (label + '.receipt.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'label': label, 'exit': process.returncode, 'indexTree': receipt['before']['indexTree']}))
print((out / (label + '.log')).read_text()[-14000:])
sys.exit(process.returncode)
