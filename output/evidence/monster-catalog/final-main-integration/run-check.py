#!/usr/bin/env python3
"""Capture direct process status and combined output without pipeline ambiguity."""
import json, os, pathlib, subprocess, sys, time
root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
name, *command = sys.argv[1:]
env = {k: v for k, v in os.environ.items() if not any(s in k.upper() for s in ['TOKEN', 'SECRET', 'PASSWORD', 'API_KEY', 'LEGACY_DB'])}
env['TMPDIR'] = '/dev/shm/st_01a0793a/tmp'
env['VITE_CACHE_DIR'] = '/dev/shm/st_01a0793a/vite-cache'
if name in ['focused', 'bgm-node']:
    env['NODE_OPTIONS'] = '--import=' + str(out / 'local-only.mjs')
start = time.time()
with (out / f'{name}.log').open('w') as log:
    result = subprocess.run(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
record = {'command': command, 'cwd': str(root), 'exitCode': result.returncode, 'durationSeconds': round(time.time()-start, 3), 'TMPDIR': env['TMPDIR'], 'externalNetworkBlocked': name in ['focused', 'bgm-node']}
(out / f'{name}-exit.json').write_text(json.dumps(record, indent=2)+'\n')
print(json.dumps(record), flush=True)
print((out / f'{name}.log').read_text()[-9000:], flush=True)
sys.exit(result.returncode)
