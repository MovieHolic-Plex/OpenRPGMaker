"""Run prepared drawing harnesses outside the planning worker's nested sandbox."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys


def prepare(root, request):
    root = Path(root).resolve()
    if not isinstance(request, dict):
        raise ValueError('그림 실행 요청 형식 오류')
    def local(name):
        value = request.get(name)
        if not isinstance(value, str) or not value:
            raise ValueError(f'격리 경로 {name} 누락')
        path = (root / value).resolve()
        if not path.is_relative_to(root) or path == root or not path.is_dir():
            raise ValueError(f'워크트리 안의 기존 폴더 필요: {name}')
        return str(path)
    env = dict(os.environ)
    harness = request.get('harness')
    if harness == 'interior-props':
        env.update(PROP_HARNESS_DATA=local('data'), HIP_DATA=local('picks'), HIP_PICK=local('picks'))
        # Use the same installed CLI selected by the supervisor, not a shell shim.
        env['PROP_HARNESS_CODEX_BIN'] = os.environ.get('SUPER_HARNESS_CODEX_BIN', 'codex')
        command = ['src/harnesses/interior-props/harness.py', 'pool']
    elif harness == 'modern-chipset':
        round_id = request.get('round')
        if not isinstance(round_id, str) or not round_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in round_id):
            raise ValueError('그림 판 id 오류')
        command = ['src/harnesses/modern-chipset/harness.py', '--data-dir', local('data'),
                   '--runs-dir', local('runs'), '--viz-dir', local('viz'), '_run', round_id]
        if not (Path(local('runs')) / round_id / 'state.json').is_file():
            raise ValueError('준비된 그림 판 state.json 없음')
    else:
        raise ValueError(f'감독 실행 경로가 아직 없는 하네스: {harness}')
    return [sys.executable, *command], env


def descendants():
    parents = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            fields = path.read_text().rsplit(')', 1)[1].split()
            parents[int(path.parent.name)] = int(fields[1])
        except (OSError, ValueError, IndexError):
            continue
    found, pending = set(), [os.getpid()]
    while pending:
        parent = pending.pop()
        for pid, ppid in parents.items():
            if ppid == parent and pid not in found:
                found.add(pid); pending.append(pid)
    return found


def main():
    root, request_file, result_file = map(Path, sys.argv[1:4])
    # Adopt grandchildren so a terminated harness cannot leave drawing workers behind.
    if sys.platform == 'linux':
        import ctypes
        if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
            raise OSError('그림 자식 프로세스 관리 초기화 실패')
    def stop(signum, frame):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        owned = descendants()
        for pid in owned:
            try: os.kill(pid, signal.SIGTERM)
            except ProcessLookupError: pass
        # Wait briefly, then force only still-owned descendants to finish.
        import time
        until = time.monotonic() + 3
        while time.monotonic() < until and descendants():
            try:
                while os.waitpid(-1, os.WNOHANG)[0]: pass
            except ChildProcessError: pass
            time.sleep(.1)
        for pid in descendants():
            try: os.kill(pid, signal.SIGKILL)
            except ProcessLookupError: pass
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    request = json.loads(request_file.read_text())
    command, env = prepare(root, request)
    code = subprocess.call(command, cwd=root, env=env)
    result_file.write_text(json.dumps({'harness': request['harness'], 'exitCode': code}, ensure_ascii=False))
    try:
        while os.waitpid(-1, os.WNOHANG)[0]: pass
    except ChildProcessError: pass
    if descendants():
        stop(signal.SIGTERM, None)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
