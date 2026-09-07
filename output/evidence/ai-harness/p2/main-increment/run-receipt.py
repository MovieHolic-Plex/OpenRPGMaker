#!/usr/bin/env python3
"""Direct validator receipt for the prepared PR678/P2 merge; never reads HEAD as tested tree."""
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import sys
out = pathlib.Path(__file__).resolve().parent
root = out.parents[4]
os.chdir(root)
assert os.environ['TMPDIR'] == '/dev/shm/rpg-zzu-ai-harness-p2-01a07564'
HEAD = '898740f18dec669ad862dc806e8f8f6c341b5dca'
MERGE = '83bd6098d94dd6d7082d2ded6d557be928592623'
def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()
def identity():
    subprocess.run(['git', 'diff', '--exit-code'], check=True, stdout=subprocess.DEVNULL)
    assert not git('ls-files', '-u')
    assert git('rev-parse', 'HEAD') == HEAD
    assert git('rev-parse', 'MERGE_HEAD') == MERGE
    tree = git('write-tree')
    paths = json.loads((out / 'focused-paths.json').read_text())
    return {'head': HEAD, 'mergeHead': MERGE, 'indexTree': tree,
        'subtrees': {p: git('rev-parse', tree + ':' + p) for p in ['src', 'test', 'scripts']},
        'workingVersusIndex': 'clean',
        'files': {p: {'sha256': hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest(), 'indexBlob': git('rev-parse', ':' + p)} for p in paths}}
if __name__ == '__main__':
    label, *command = sys.argv[1:]
    receipt = {'command': command, 'cwd': str(root), 'TMPDIR': os.environ['TMPDIR'],
        'start': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'before': identity()}
    with (out / (label + '.log')).open('w') as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    receipt.update(exit=process.returncode, end=datetime.datetime.now(datetime.timezone.utc).isoformat(), after=identity())
    (out / (label + '.receipt.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    assert receipt['before'] == receipt['after'], 'Source/index changed during validator'
    print(json.dumps({'label': label, 'exit': process.returncode, 'indexTree': receipt['before']['indexTree']}))
    print((out / (label + '.log')).read_text()[-10000:])
    sys.exit(process.returncode)
