#!/usr/bin/python3
"""Linux-only, same-uid, disk-backed final-validation boundary. No fallback."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import selectors
import shutil
import signal
import stat
import struct
import subprocess
import sys
import tempfile
import uuid


BROWSER = "/dev/shm/task8-managed-chromium-cHQvga"
BASELINES = {".omo/gates-baseline.json", ".omo/css-budget-baseline.json",
             ".omo/css-live-classes-baseline.json"}
EXCLUDED = {"node_modules", "output", "outputs", "reports", "evidence", "verify-shots",
            "dist", "coverage", "test-results", "playwright-report", "rpg_maker_skills"}
PRIVATE = {".git", ".npmrc", ".netrc", ".auth", ".ssh", ".config", ".local", ".cache",
           ".herdr", ".bun", ".codex", ".claude", ".pi", ".omo", ".vite", ".vite-temp"}
HOST_ENV = {"PATH": "/usr/local/bin:/usr/bin:/usr/sbin:/bin", "LANG": "C.UTF-8",
            "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_TERMINAL_PROMPT": "0", "GIT_OPTIONAL_LOCKS": "0"}


class BoundaryError(Exception):
    """Only constant, value-free codes escape the launcher."""


def require(condition, code):
    if not condition:
        raise BoundaryError(code)


def relative(value):
    p = PurePosixPath(value)
    require(bool(value) and not p.is_absolute() and all(x not in {".", ".."} for x in value.split('/')),
            "invalid-relative-path")
    return p.as_posix()


def private(parts):
    return any(p in PRIVATE or p.startswith('.env') or p.endswith(('.pem', '.key', '.p12')) for p in parts)


def source_allowed(name, includes):
    parts = PurePosixPath(name).parts
    if name in BASELINES:
        return True
    # The existing N3 driver lives in evidence. Only explicitly selected code may
    # cross that otherwise excluded boundary, never logs/receipts/images/env data.
    if parts[0] == '.omo':
        return (name in includes and name.startswith('.omo/evidence/ai-job-queue/')
                and Path(name).suffix in {'.mjs', '.py', '.ts'}
                and not private(parts[1:]))
    return (parts[0] not in EXCLUDED and not private(parts)
            and not any(p.startswith('.') and p not in {'.gitignore', '.gitkeep'} for p in parts)
            and parts[-1] not in {'AGENTS.md', 'CLAUDE.md'})


def git(root, *args, optional=False, data=None):
    result = subprocess.run(['/usr/bin/git', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
                             *args], cwd=root, env=HOST_ENV, input=data, capture_output=True, timeout=60)
    if optional and result.returncode:
        return None
    require(result.returncode == 0, 'git-input-failed')
    return result.stdout


def selection(root, expected, includes):
    head = git(root, 'rev-parse', '--verify', 'HEAD', optional=True)
    head = head.decode().strip() if head else 'UNBORN'
    require(head == expected, 'source-head-mismatch')
    tracked = set(filter(None, git(root, 'ls-files', '-z', '--cached').decode().split('\0')))
    changes = git(root, 'diff', '--no-ext-diff', '--name-only', '-z', *([] if head == 'UNBORN' else ['HEAD']))
    changed = set(filter(None, changes.decode().split('\0')))
    require(all(p in includes for p in changed if source_allowed(p, includes)), 'unrequested-source-change')
    require(all(source_allowed(p, includes) for p in includes), 'excluded-include')
    require(all(p in tracked or (root / p).exists() for p in includes), 'missing-include')
    names = sorted(p for p in tracked | includes if source_allowed(p, includes)
                   and ((root / p).exists() or (root / p).is_symlink()))
    require(bool(names), 'empty-source')
    return names


class Watch:
    """Reject even write-and-restore during capture; overflow is a hard failure."""
    def __init__(self, directories):
        libc = ctypes.CDLL(None, use_errno=True)
        self.fd = libc.inotify_init1(os.O_NONBLOCK | os.O_CLOEXEC)
        require(self.fd >= 0, 'inotify-unavailable')
        self.paths = {}
        try:
            for path in sorted(set(directories)):
                wd = libc.inotify_add_watch(self.fd, os.fsencode(path), 0x00000FCE)
                require(wd >= 0, 'capture-watch-failed')
                self.paths[wd] = path
        except BaseException:
            os.close(self.fd)
            raise

    def unchanged(self):
        try:
            data = os.read(self.fd, 1024 * 1024)
        except BlockingIOError:
            return
        offset = 0
        while offset < len(data):
            _wd, mask, _cookie, size = struct.unpack_from('iIII', data, offset)
            offset += 16 + size
            require(not mask & 0x00004FCE, 'input-changed-during-capture')

    def close(self):
        os.close(self.fd)


def open_regular(path):
    # Walk every ancestor with O_NOFOLLOW; a concurrent symlink replacement must
    # not redirect a transient read/copy to private data before the watcher aborts.
    require(path.is_absolute(), 'absolute-input-required')
    directory = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = child
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            os.close(fd)
            raise BoundaryError('non-regular-input')
        return fd
    finally:
        os.close(directory)


def file_digest(path):
    fd = open_regular(path)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode), 'non-regular-input')
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        after = os.fstat(stream.fileno())
    def stamp(s):
        return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_mode)
    require(stamp(before) == stamp(after), 'input-changed-during-read')
    return {'sha256': digest, 'bytes': before.st_size, 'mode': stat.S_IMODE(before.st_mode) & 0o777}, stamp(before)


def copy_file(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Stream to independent disk files, never hard-link mutable originals.
    with os.fdopen(open_regular(source), 'rb') as src, destination.open('wb') as dest:
        shutil.copyfileobj(src, dest, length=1024 * 1024)


def capture(root, names, destination):
    watch = Watch([root, *((root / n).parent for n in names)])
    try:
        before = {name: file_digest(root / name) for name in names}
        for name in names:
            copy_file(root / name, destination / name)
            require(file_digest(destination / name)[0]['sha256'] == before[name][0]['sha256'], 'copy-mismatch')
            (destination / name).chmod(before[name][0]['mode'])
        require(before == {name: file_digest(root / name) for name in names}, 'input-changed-during-capture')
        watch.unchanged()
        return {name: value[0] for name, value in before.items()}
    finally:
        watch.close()


def copy_dependencies(root, destination):
    names, links, directories = [], {}, [root]
    for here, dirs, files in os.walk(root, followlinks=False):
        here = Path(here)
        dirs[:] = sorted(d for d in dirs if not private([d]))
        for d in dirs:
            require(not (here / d).is_symlink(), 'dependency-directory-link')
            directories.append(here / d)
        for name in sorted(files):
            path = here / name
            if private([name]):
                continue
            rel = str(path.relative_to(root))
            if path.is_symlink():
                target = path.resolve(strict=True)
                require(target.is_relative_to(root) and not private(target.relative_to(root).parts)
                        and target.is_file(), 'dependency-link-outside-input')
                links[rel] = str(target.relative_to(root))
            else:
                names.append(rel)
    watch = Watch(directories)
    try:
        manifest = capture(root, sorted(names), destination)
        for name, target in links.items():
            dest = destination / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.symlink_to(os.path.relpath(destination / target, dest.parent))
            require((root / name).resolve() == root / target, 'dependency-link-changed')
        watch.unchanged()
        return {'files': manifest, 'links': links}
    finally:
        watch.close()


def write_json(path, value):
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + '\n')


def inside(command):
    status = dict(line.split(':', 1) for line in Path('/proc/self/status').read_text().splitlines() if ':' in line)
    require(os.getuid() == os.geteuid() == 1000 and os.getgid() == 1000, 'uid-boundary')
    require(all(int(status[k].strip(), 16) == 0 for k in ['CapEff', 'CapPrm', 'CapInh', 'CapAmb', 'CapBnd']), 'capability-boundary')
    require(status['NoNewPrivs'].strip() == '1', 'privilege-boundary')
    links = json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', 'link']))
    require(len(links) == 1 and links[0]['ifname'] == 'lo' and 'UP' in links[0]['flags'], 'network-boundary')
    for family in ['-4', '-6']:
        routes = json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', family, 'route', 'show', 'table', 'all']))
        require(all(r.get('dev') == 'lo' and r.get('type') in {'local', 'broadcast'} for r in routes), 'route-boundary')
    write_json(Path('/state/boundary.json'), {'uid': 1000, 'capabilities': 0, 'noNewPrivileges': True,
                                           'loopbackOnly': True, 'nonlocalRoutes': 0})
    try:
        os.execvp(command[0], command)
    except OSError:
        write_json(Path('/state/exec-error.json'), {'error': 'command-exec-failed'})
        sys.exit(127)


def await_exit(proc, timeout):
    fd = os.pidfd_open(proc.pid)
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(fd, selectors.EVENT_READ)
            require(bool(selector.select(timeout)), 'command-timeout')
        return proc.wait()  # pidfd is ready: reap, never poll or sleep.
    finally:
        os.close(fd)


def sandbox(scratch, browser, bun, command):
    work, state = scratch / 'work', scratch / 'state'
    args = ['/usr/bin/bwrap', '--unshare-user', '--uid', '1000', '--gid', '1000',
            '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent', '--new-session',
            '--cap-drop', 'ALL', '--clearenv']
    # No host /home, /run, /tmp, /proc or whole-root bind. Only system runtime inputs.
    for path in ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/lib64', '/usr/share']:
        require(Path(path).is_dir() and Path(path).stat().st_uid == 0, 'system-runtime-path')
        args += ['--ro-bind', path, path]
    for name in ['bin', 'sbin', 'lib', 'lib64']:
        args += ['--symlink', 'usr/' + name, '/' + name]
    for source, target in [('/usr/local/bin/node', '/usr/local/bin/node'),
                           ('/usr/local/lib/node_modules/npm', '/usr/local/lib/node_modules/npm'),
                           (str(bun), '/usr/local/bin/bun')]:
        require(Path(source).exists(), 'toolchain-missing')
        args += ['--ro-bind', str(Path(source).resolve()), target]
    args += ['--symlink', '../lib/node_modules/npm/bin/npm-cli.js', '/usr/local/bin/npm',
             '--symlink', '../lib/node_modules/npm/bin/npx-cli.js', '/usr/local/bin/npx']
    for path in ['/etc/ld.so.cache', '/etc/fonts']:
        args += ['--ro-bind', path, path]
    args += ['--proc', '/proc', '--dev', '/dev', '--bind', str(scratch / 'shm'), '/dev/shm',
             '--bind', str(scratch / 'tmp'), '/tmp', '--bind', str(work), '/work',
             '--bind', str(state), '/state', '--bind', str(scratch / 'home'), '/home/validation',
             '--ro-bind', str(scratch / 'passwd'), '/etc/passwd',
             '--ro-bind', str(scratch / 'group'), '/etc/group',
             '--ro-bind', str(scratch / 'hosts'), '/etc/hosts',
             '--ro-bind', str(scratch / 'entry.py'), '/s0-entry.py',
             '--ro-bind', str(browser), BROWSER, '--chdir', '/work']
    env = {'PATH': '/usr/local/bin:/usr/bin:/usr/sbin:/bin', 'HOME': '/home/validation',
           'USER': 'validation', 'LOGNAME': 'validation', 'SHELL': '/bin/sh', 'LANG': 'C.UTF-8',
           'TMPDIR': '/dev/shm', 'TMP': '/tmp', 'TEMP': '/tmp', 'PYTHONDONTWRITEBYTECODE': '1',
           'XDG_CONFIG_HOME': '/state/config', 'XDG_CACHE_HOME': '/state/cache',
           'XDG_DATA_HOME': '/state/data', 'XDG_STATE_HOME': '/state/private', 'XDG_RUNTIME_DIR': '/state/run',
           'AI_JOBS_DIRECTORY': '/state/jobs', 'VITE_CACHE_DIR': '/state/vite',
           'PLAYWRIGHT_BROWSERS_PATH': BROWSER, 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD': '1',
           'npm_config_cache': '/state/npm-cache', 'npm_config_userconfig': '/state/npmrc',
           'npm_config_globalconfig': '/state/npm-globalrc', 'npm_config_offline': 'true', 'npm_config_yes': 'false',
           'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_TERMINAL_PROMPT': '0',
           'E2E_RETRIES': '0', 'VITEST_MAX_FORKS': '1', 'VITEST_MIN_FORKS': '1',
           'VITEST_MAX_THREADS': '1', 'VITEST_MIN_THREADS': '1'}
    for key, value in env.items():
        args += ['--setenv', key, value]
    args += ['--', '/usr/bin/python3', '-I', '-S', '/s0-entry.py', '--inside', *command]
    # ip needs namespace capabilities. Drop them before invoking non-setuid bwrap;
    # bwrap creates its own user/mount namespace and drops all caps before exec.
    return ['/usr/bin/unshare', '--user', '--map-current-user', '--keep-caps', '--net',
            '/bin/sh', '-ec', '/usr/sbin/ip link set lo up; exec /usr/bin/setpriv --no-new-privs '
            '--bounding-set=-all --inh-caps=-all --ambient-caps=-all "$@"', 's0', *args]


def run(args):
    require(sys.platform == 'linux' and os.getuid() == os.geteuid() == 1000 and os.getgid() == 1000, 'linux-uid1000-required')
    require(args.command and args.command[0] == '--' and len(args.command) > 1, 'command-required')
    command = args.command[1:]
    source, deps, browser, bun = [Path(p).resolve(strict=True) for p in [args.source, args.dependencies, args.browser, args.bun]]
    require(browser == Path(BROWSER) and browser.is_dir() and bun.is_file(), 'unverified-runtime-path')
    require(args.timeout > 0, 'positive-timeout-required')
    output, scratch_root = Path(args.output), Path(args.scratch_root)
    require(output.is_absolute() and scratch_root.is_absolute(), 'absolute-output-required')
    require(output.parent.resolve() == output.parent and scratch_root.resolve() == scratch_root, 'output-symlink')
    packages = {}
    for spec in args.package:
        name, path = spec.split('=', 1)
        require(relative(name) == name and not private(PurePosixPath(name).parts), 'invalid-package')
        require(len(PurePosixPath(name).parts) == (2 if name.startswith('@') else 1), 'invalid-package')
        require(name not in packages, 'duplicate-package')
        packages[name] = Path(path).resolve(strict=True)
        require(packages[name].is_dir(), 'package-directory-required')
    for path in [source, deps, browser, *packages.values()]:
        require(not output.is_relative_to(path) and not scratch_root.is_relative_to(path), 'output-inside-input')
    fs = subprocess.check_output(['/usr/bin/findmnt', '-n', '-o', 'FSTYPE', '--target', str(scratch_root)], env=HOST_ENV).decode().strip()
    require(fs not in {'tmpfs', 'ramfs'}, 'disk-scratch-required')
    includes = {relative(p) for p in args.include}
    output.mkdir(mode=0o700)  # Exclusive: an old success receipt can never be reused.
    scratch = Path(tempfile.mkdtemp(prefix='s0-', dir=scratch_root))
    identity = scratch.stat()
    run_id = str(uuid.uuid4())
    marker = scratch / 'owner'
    marker.write_text(run_id)
    receipt = {'version': 1, 'runId': run_id, 'expectedHead': args.expected_head, 'uid': 1000,
               'commandSha256': hashlib.sha256(json.dumps(command).encode()).hexdigest(),
               'commandExit': None, 'launcherExit': None, 'error': None,
               'ownership': {'scratch': str(scratch), 'device': identity.st_dev, 'inode': identity.st_ino, 'uid': identity.st_uid},
               'cleanup': {'removed': False}}
    proc = None
    def interrupted(_signum, _frame):
        raise BoundaryError('launcher-interrupted')
    previous_signals = {s: signal.signal(s, interrupted) for s in [signal.SIGTERM, signal.SIGINT]}
    try:
        names = selection(source, args.expected_head, includes)
        for name in ['work', 'state', 'home', 'shm', 'tmp']:
            (scratch / name).mkdir(mode=0o700)
        source_watch = Watch([source, *((source / name).parent for name in names)])
        try:
            manifest = capture(source, names, scratch / 'work')
            require(selection(source, args.expected_head, includes) == names, 'source-selection-changed')
            dependencies = copy_dependencies(deps, scratch / 'work/node_modules')
            supplements = {}
            for name, path in packages.items():
                dest = scratch / 'work/node_modules' / name
                require(not dest.exists(), 'package-already-present')
                supplements[name] = copy_dependencies(path, dest)
            dependencies['supplements'] = supplements
            require(selection(source, args.expected_head, includes) == names, 'source-selection-changed')
            source_watch.unchanged()
        finally:
            source_watch.close()
        write_json(output / 'source.json', {'head': args.expected_head, 'files': manifest})
        receipt['sourceSha256'] = hashlib.sha256((output / 'source.json').read_bytes()).hexdigest()
        require(args.expected_source_sha256 is None or receipt['sourceSha256'] == args.expected_source_sha256, 'source-fingerprint-mismatch')
        receipt['dependenciesSha256'] = hashlib.sha256(json.dumps(dependencies, sort_keys=True).encode()).hexdigest()
        work_stat = (scratch / 'work').stat()
        receipt['workIdentity'] = {'device': work_stat.st_dev, 'inode': work_stat.st_ino}
        git(scratch / 'work', 'init', '-q', '--template=')
        git(scratch / 'work', 'add', '-f', '--pathspec-from-file=-', '--pathspec-file-nul', data=('\0'.join(names) + '\0').encode())
        for name in ['config', 'cache', 'data', 'private', 'run', 'npm-cache', 'vite']:
            (scratch / 'state' / name).mkdir(mode=0o700)
        (scratch / 'state/npmrc').touch()
        (scratch / 'state/npm-globalrc').touch()
        (scratch / 'passwd').write_text('validation:x:1000:1000:Validation:/home/validation:/bin/sh\n')
        (scratch / 'group').write_text('validation:x:1000:\n')
        (scratch / 'hosts').write_text('127.0.0.1 localhost\n::1 localhost\n')
        copy_file(Path(__file__).resolve(), scratch / 'entry.py')
        with (scratch / 'command.log').open('wb') as log:
            proc = subprocess.Popen(sandbox(scratch, browser, bun, command), cwd=scratch, env=HOST_ENV,
                                    stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
            code = await_exit(proc, args.timeout)
        receipt['sandboxExit'] = code if code >= 0 else 128 - code
        boundary = scratch / 'state/boundary.json'
        require(boundary.is_file(), 'sandbox-launch-failed')
        receipt['boundary'] = json.loads(boundary.read_text())
        require(not (scratch / 'state/exec-error.json').exists(), 'command-launch-failed')
        receipt['commandExit'] = receipt['sandboxExit']
        for item in args.retain:
            name = relative(item)
            path = scratch / 'work' / name
            require(not private(PurePosixPath(name).parts) or name == '.omo/gates-vitest-report.json', 'private-output-denied')
            require(path.is_file() and path.resolve() == path, 'invalid-retained-file')
            copy_file(path, output / 'files' / name)
        receipt['launcherExit'] = receipt['commandExit']
    except (BoundaryError, OSError, ValueError, subprocess.SubprocessError) as error:
        receipt['error'] = str(error) if isinstance(error, BoundaryError) else type(error).__name__
        receipt['launcherExit'] = 125
    finally:
        for s in previous_signals:
            signal.signal(s, signal.SIG_IGN)
        try:
            if proc is not None and proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)  # Only this Popen-owned session.
                except ProcessLookupError:
                    pass  # It exited between the observation and kill; still reap it.
                await_exit(proc, 10)  # Parent-death + PID namespace kills descendants.
            if args.retain_log and (scratch / 'command.log').is_file():
                copy_file(scratch / 'command.log', output / 'command.log')
            current = scratch.stat()
            require((current.st_dev, current.st_ino, current.st_uid) == (identity.st_dev, identity.st_ino, 1000)
                    and marker.read_text() == run_id, 'cleanup-ownership-mismatch')
            shutil.rmtree(scratch)
            receipt['cleanup']['removed'] = not scratch.exists()
        except (BoundaryError, OSError) as error:
            receipt['cleanup']['error'] = str(error) if isinstance(error, BoundaryError) else type(error).__name__
            receipt['launcherExit'] = 125
        write_json(output / 'receipt.json', receipt)
        for s, handler in previous_signals.items():
            signal.signal(s, handler)
    print(json.dumps({'runId': run_id, 'exit': receipt['launcherExit'], 'error': receipt['error'], 'removed': receipt['cleanup']['removed']}))
    return receipt['launcherExit']


def main():
    if sys.argv[1:2] == ['--inside']:
        inside(sys.argv[2:])
        return 125
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'expected-head', 'dependencies', 'output']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--expected-source-sha256')
    parser.add_argument('--include', action='append', default=[])
    parser.add_argument('--package', action='append', default=[])
    parser.add_argument('--browser', default=BROWSER)
    parser.add_argument('--bun', default='/home/main/.bun/bin/bun')
    parser.add_argument('--scratch-root', default='/var/tmp')
    parser.add_argument('--timeout', type=float, default=7200)
    parser.add_argument('--retain', action='append', default=[])
    parser.add_argument('--retain-log', action='store_true')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    try:
        return run(parser.parse_args())
    except (BoundaryError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(json.dumps({'exit': 125, 'error': str(error) if isinstance(error, BoundaryError) else type(error).__name__}))
        return 125


if __name__ == '__main__':
    sys.exit(main())
