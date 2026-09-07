"""Bounded local validation with actual exits, isolated HOME/TMPDIR, and durable receipts."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

out = Path(__file__).resolve().parent
root = out.parents[3]
label, budget, *command = sys.argv[1:]
scratch = Path('/dev/shm/st_01a078e1-dependency-fix') / label
scratch.mkdir(parents=True, exist_ok=True)
env = {
    'PATH': os.environ['PATH'], 'HOME': str(scratch), 'TMPDIR': str(scratch),
    'NODE_OPTIONS': f'--import={out / "offline.mjs"}',
    'DEV_SERVER_NO_TLS': '1', 'NO_COLOR': '1',
}
started = time.monotonic()
with (out / f'{label}.log').open('w') as log:
    process = subprocess.Popen(command, cwd=root, env=env, stdout=log,
                               stderr=subprocess.STDOUT, start_new_session=True)
    timed_out = False
    try:
        code = process.wait(timeout=int(budget))
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGKILL)
        code = process.wait()
receipt = {'command': command, 'cwd': str(root), 'exitCode': code,
           'timedOut': timed_out, 'timeoutSeconds': int(budget),
           'elapsedSeconds': time.monotonic() - started, 'TMPDIR': str(scratch)}
(out / f'{label}-exit.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(code if code >= 0 else 128 - code)
