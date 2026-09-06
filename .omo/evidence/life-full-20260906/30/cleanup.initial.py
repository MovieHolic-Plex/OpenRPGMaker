import json
import os
from pathlib import Path
import select
import shutil
import signal
import time

root = Path.cwd()
assert root == Path('/home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys')
evidence = root / '.omo/evidence/life-full-20260906/30'
own_processes = []
for path in Path('/proc').iterdir():
    if not path.name.isdigit():
        continue
    try:
        cwd = (path / 'cwd').resolve(strict=True)
        command = (path / 'cmdline').read_bytes().replace(b'\0', b' ').decode()
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        continue
    if cwd == root and ('typescript-language-server --stdio' in command or '/tsserver.js ' in command):
        own_processes.append({'pid': int(path.name), 'command': command})
# Subscribe to exact process exits before sending TERM, not sleeps or polling.
fds = {os.pidfd_open(entry['pid']): entry for entry in own_processes}
try:
    for entry in own_processes:
        os.kill(entry['pid'], signal.SIGTERM)
    pending = set(fds)
    deadline = time.monotonic() + 15
    while pending:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError(f'Cleanup deadline exceeded for {[fds[fd] for fd in pending]}')
        ready, _, _ = select.select(list(pending), [], [], remaining)
        for fd in ready:
            fds[fd]['exitObservedViaPidfd'] = True
            pending.remove(fd)
finally:
    for fd in fds:
        os.close(fd)
removed = []
for name in ['dist', '.vite-cache', '.cache/life-record-keys-build', '.cache/life-record-keys-public']:
    path = root / name
    existed = path.exists()
    if existed:
        assert not path.is_symlink()
        shutil.rmtree(path)
    removed.append({'path': str(path), 'existed': existed, 'existsAfter': path.exists()})
for name in ['/tmp/st_01a074c9-worktree.txt', '/tmp/st_01a074c9-probe-console.log', '/tmp/st_01a074c9-build-console.log']:
    path = Path(name)
    existed = path.exists()
    if existed:
        path.unlink()
    removed.append({'path': name, 'existed': existed, 'existsAfter': path.exists()})
receipt = {'cwd': str(root), 'processes': own_processes, 'removed': removed,
           'publicStorageEntriesAfter': 0, 'publicWindowClosed': True, 'publicViteClosed': True,
           'publicCleanupEvidence': 'public-roundtrip.log', 'httpListenerStarted': False,
           'remoteWrites': 0, 'worktreeRetained': True, 'provisionedDependenciesAndEnvRetained': True,
           'sharedNodeModulesCaches': 'Not removed: shared with other actors; only task-root caches removed.'}
(evidence / 'cleanup-details.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
