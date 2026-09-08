"""Linux S0 boundary tests: disposable sentinel repositories and loopback only."""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "scripts/qa/isolated-validation.py"
PROBE = r'''
import errno, http.server, json, os, pathlib, subprocess, threading, urllib.request
p = pathlib.Path
source, deps, private, parent_port = __import__('sys').argv[1:]
hidden = all(not p(x).exists() for x in [source, deps, private])
clean = not p('.env.local').exists() and not p('node_modules/pkg/.env').exists()
clean = clean and not p(os.environ['HOME'], '.auth').exists()
clean = clean and all(not p(x).exists() for x in ['.omo/private.json', 'output/generated.json', 'AGENTS.md'])
env_clean = 'S0_FAKE_SECRET' not in os.environ
code = p('input.txt').read_text() == 'requested-change'
code = code and p('node_modules/pkg/index.js').read_text() == 'installed-code'
code = code and subprocess.check_output(['./node_modules/.bin/fixture']).strip() == b'installed-bin'
code = code and json.loads(p('.omo/gates-baseline.json').read_text()) == {'fixture': True}
p('input.txt').write_text('owned-write')
p('node_modules/pkg/cache').write_text('owned-cache')
p('.git/s0-marker').write_text('owned-git')
p(os.environ['HOME'], 'owned').write_text('owned-home')
status = dict(line.split(':', 1) for line in p('/proc/self/status').read_text().splitlines() if ':' in line)
caps = all(int(status[key].strip(), 16) == 0 for key in ['CapEff', 'CapPrm', 'CapInh', 'CapAmb', 'CapBnd'])
routes = json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', 'route', 'show', 'table', 'all']))
no_routes = all(route.get('dev') == 'lo' for route in routes)
no_routes = no_routes and not json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', '-6', 'route', 'show', 'default']))
interfaces = json.loads(subprocess.check_output(['/usr/sbin/ip', '-j', 'link']))
no_routes = no_routes and [link['ifname'] for link in interfaces] == ['lo']
sock = __import__('socket').socket(); sock.settimeout(3)
blocked = sock.connect_ex(('127.0.0.1', int(parent_port))) == errno.ECONNREFUSED
sock.close()
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b'owned-loopback')
    def log_message(self, *args): pass
server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
thread = threading.Thread(target=server.handle_request)
thread.start()
with urllib.request.urlopen('http://127.0.0.1:%s' % server.server_port, timeout=3) as response:
    local = response.read() == b'owned-loopback'
thread.join(3); assert not thread.is_alive(); server.server_close()
descendant = """
import errno,json,os,pathlib,socket,sys
s=socket.socket(); s.settimeout(3)
blocked=s.connect_ex(('127.0.0.1',int(sys.argv[1])))==errno.ECONNREFUSED
s.close()
print(json.dumps([os.getuid(), pathlib.Path('.env.local').exists(), os.environ.get('S0_FAKE_SECRET'),
 pathlib.Path('/proc/self/status').read_text().split('CapEff:')[1].splitlines()[0].strip(), blocked,
 len(pathlib.Path('/proc/net/route').read_text().splitlines())==1]))
"""
child = subprocess.check_output(['/usr/bin/python3', '-c', descendant, parent_port])
inheritance = json.loads(child) == [1000, False, None, '0000000000000000', True, True]
# A descendant announces readiness before its parent exits. PID-namespace teardown
# must kill it even though it has another session and ignores SIGTERM.
orphan = subprocess.Popen(['/usr/bin/python3', '-c', 'import signal,os; os.setsid(); signal.signal(signal.SIGTERM, signal.SIG_IGN); print("READY", flush=True); signal.pause()'], stdout=subprocess.PIPE)
assert orphan.stdout.readline() == b'READY\n'
facts = dict(hidden=hidden, clean=clean, env_clean=env_clean, code=code, caps=caps,
    no_routes=no_routes, parent_blocked=blocked, own_loopback=local,
    same_uid=os.getuid() == 1000, descendants=inheritance)
p('boundary.json').write_text(json.dumps(facts))
assert all(facts.values()), json.dumps(facts)
'''


class Boundary(unittest.TestCase):
    def setUp(self):
        self.temp = Path(tempfile.mkdtemp(prefix="s0-test-", dir="/var/tmp"))
        self.addCleanup(shutil.rmtree, self.temp)
        self.outputs = []
        self.source = self.temp / "source"
        self.source.mkdir()
        self.private = self.temp / "private"
        self.private.mkdir()
        (self.private / ".auth").write_text("FAKE_HOME_SENTINEL")
        (self.source / "input.txt").write_text("base")
        (self.source / ".env.local").write_text("FAKE_CHECKOUT_SENTINEL")
        self.deps = self.temp / "real-deps"
        (self.deps / "pkg").mkdir(parents=True)
        (self.deps / "pkg/index.js").write_text("installed-code")
        (self.deps / "pkg/.env").write_text("FAKE_DEPENDENCY_SENTINEL")
        (self.deps / "pkg/entry").write_text("#!/bin/sh\necho installed-bin\n")
        (self.deps / "pkg/entry").chmod(0o755)
        (self.deps / ".bin").mkdir()
        (self.deps / ".bin/fixture").symlink_to("../pkg/entry")
        (self.source / "node_modules").symlink_to(self.deps)
        (self.source / "probe.py").write_text(PROBE)
        (self.source / '.omo').mkdir()
        (self.source / 'output').mkdir()
        (self.source / '.omo/private.json').write_text('FAKE_AGENT_SENTINEL')
        (self.source / '.omo/gates-baseline.json').write_text('{"fixture": true}')
        (self.source / 'output/generated.json').write_text('FAKE_OUTPUT_SENTINEL')
        (self.source / 'AGENTS.md').write_text('FAKE_AGENT_SENTINEL')
        for args in [["init", "-q"], ["add", "-f", "input.txt", "probe.py", '.env.local', '.omo', 'output', 'AGENTS.md']]:
            subprocess.run(["git", *args], cwd=self.source, check=True, capture_output=True)
        (self.source / "input.txt").write_text("requested-change")
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen()
        self.addCleanup(self.listener.close)

    def test_boundary(self):
        before = self.fingerprints()
        with socket.create_connection(self.listener.getsockname(), timeout=3):
            pass  # The parent listener really is reachable in the parent namespace.
        if os.environ.get("S0_TEST_UNSAFE_BASELINE") == "1":
            # Deliberately unsafe fixture-only characterization, never a launcher mode.
            result = subprocess.run(["/usr/bin/python3", "-c", "import pathlib; assert not pathlib.Path('.env.local').exists(), 'checkout privacy boundary absent'"],
                cwd=self.source, env={**os.environ, "HOME": str(self.private)}, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            return
        result, output = self.run_isolated(["python3", "probe.py", str(self.source), str(self.deps), str(self.private), str(self.listener.getsockname()[1])], retain=["boundary.json"])
        self.assertEqual(result.returncode, 0, result.stdout.decode() + result.stderr.decode() + ((output / "command.log").read_text() if (output / "command.log").exists() else ""))
        self.assertTrue(all(json.loads((output / "files/boundary.json").read_text()).values()))
        receipt = json.loads((output / "receipt.json").read_text())
        self.assertTrue(receipt["cleanup"]["removed"])
        self.assertEqual(receipt["commandExit"], 0)
        self.assertEqual(self.fingerprints(), before)

    def fingerprints(self):
        return {str(p.relative_to(self.temp)): hashlib.sha256(p.read_bytes()).hexdigest()
                for root in [self.source, self.deps, self.private] for p in root.rglob('*')
                if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts}

    def run_isolated(self, command, retain=(), extra=()):
        output = self.temp / ("receipt-%s" % len(self.outputs))
        self.outputs.append(output)
        args = ["/usr/bin/python3", str(LAUNCHER), "--source", str(self.source),
                "--expected-head", "UNBORN", "--include", "input.txt", "--dependencies", str(self.deps),
                "--scratch-root", str(self.temp), "--output", str(output), "--timeout", "20", "--retain-log"]
        for item in retain:
            args += ["--retain", item]
        result = subprocess.run([*args, *extra, "--", *command], cwd=ROOT,
            env={**os.environ, "HOME": str(self.private), "S0_FAKE_SECRET": "FAKE_ENV_SENTINEL"},
            capture_output=True, timeout=40)
        if (output / "receipt.json").exists():
            self.check_cleanup(output)
        return result, output

    def check_cleanup(self, output):
        receipt = json.loads((output / "receipt.json").read_text())
        self.assertTrue(receipt["cleanup"]["removed"], receipt)
        self.assertFalse(list(self.temp.glob("s0-*")))
        work = receipt.get("workIdentity")
        if work:
            remaining = []
            for entry in Path('/proc').iterdir():
                if not entry.name.isdigit():
                    continue
                try:
                    identity = (entry / 'cwd').stat()
                except (FileNotFoundError, PermissionError, ProcessLookupError):
                    continue
                if (identity.st_dev, identity.st_ino) == (work['device'], work['inode']):
                    remaining.append(int(entry.name))
            self.assertEqual(remaining, [], 'Owned work-directory process survived namespace teardown')
        for sentinel in ['FAKE_HOME_SENTINEL', 'FAKE_CHECKOUT_SENTINEL', 'FAKE_DEPENDENCY_SENTINEL', 'FAKE_ENV_SENTINEL', 'FAKE_AGENT_SENTINEL', 'FAKE_OUTPUT_SENTINEL']:
            for path in output.rglob('*'):
                if path.is_file():
                    self.assertNotIn(sentinel.encode(), path.read_bytes())
        evidence = os.environ.get('S0_TEST_EVIDENCE')
        if evidence:
            target = Path(evidence) / self.id().split('.')[-1] / output.name
            target.mkdir(parents=True, exist_ok=False)
            shutil.copyfile(output / 'receipt.json', target / 'receipt.json')
            if (output / 'files/boundary.json').is_file():
                shutil.copyfile(output / 'files/boundary.json', target / 'boundary.json')

    def test_exact_nonzero_exit(self):
        before = self.fingerprints()
        result, output = self.run_isolated(['python3', '-c', 'raise SystemExit(23)'])
        self.assertEqual(result.returncode, 23, result.stdout.decode())
        receipt = json.loads((output / 'receipt.json').read_text())
        self.assertEqual(receipt['commandExit'], 23)
        self.assertIsNone(receipt['error'])
        self.assertEqual(before, self.fingerprints())

    def test_command_exec_failure_cleanup(self):
        result, output = self.run_isolated(['/not-an-installed-command'])
        self.assertEqual(result.returncode, 125)
        receipt = json.loads((output / 'receipt.json').read_text())
        self.assertEqual(receipt['error'], 'command-launch-failed')
        self.assertIsNone(receipt['commandExit'])
        self.assertEqual(receipt['sandboxExit'], 127)

    def test_timeout_cleanup(self):
        # Time is the behavior under test; wait on the exact pidfd, not polling.
        result, output = self.run_isolated(['python3', '-c', 'import signal; signal.pause()'], extra=['--timeout', '1'])
        self.assertEqual(result.returncode, 125)
        self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], 'command-timeout')

    def test_missing_private_and_unrequested_inputs_fail_closed(self):
        for extra, code in [(['--include', '.env.local'], 'excluded-include'),
                            (['--include', 'missing.py'], 'missing-include'),
                            (['--expected-head', '0' * 40], 'source-head-mismatch')]:
            with self.subTest(code=code):
                result, output = self.run_isolated(['true'], extra=extra)
                self.assertEqual(result.returncode, 125)
                self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], code)

    def test_unrequested_modified_file(self):
        (self.source / 'probe.py').write_text(PROBE + '\n')
        result, output = self.run_isolated(['true'])
        self.assertEqual(result.returncode, 125)
        self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], 'unrequested-source-change')

    def test_explicit_new_file_and_source_fingerprint(self):
        (self.source / 'new.py').write_text('print("new-source")')
        result, output = self.run_isolated(['python3', 'new.py'], extra=['--include', 'new.py'])
        self.assertEqual(result.returncode, 0, result.stdout.decode())
        fingerprint = json.loads((output / 'receipt.json').read_text())['sourceSha256']
        result, output = self.run_isolated(['true'], extra=['--include', 'new.py', '--expected-source-sha256', fingerprint])
        self.assertEqual(result.returncode, 0)
        (self.source / 'new.py').write_text('print("different-source")')
        result, output = self.run_isolated(['true'], extra=['--include', 'new.py', '--expected-source-sha256', fingerprint])
        self.assertEqual(result.returncode, 125)
        self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], 'source-fingerprint-mismatch')

    def test_dependency_realpath_escape_rejected(self):
        (self.deps / 'pkg/leak').symlink_to(self.private / '.auth')
        result, output = self.run_isolated(['true'])
        self.assertEqual(result.returncode, 125)
        self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], 'dependency-link-outside-input')

    def test_source_symlink_and_private_output_rejected(self):
        (self.source / 'leak.py').symlink_to(self.private / '.auth')
        result, output = self.run_isolated(['true'], extra=['--include', 'leak.py'])
        self.assertEqual(result.returncode, 125)
        self.assertIsNotNone(json.loads((output / 'receipt.json').read_text())['error'])
        result, output = self.run_isolated(['python3', '-c', 'from pathlib import Path; Path("escape").symlink_to("/etc/passwd")'], retain=['escape'])
        self.assertEqual(result.returncode, 125)
        self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'], 'invalid-retained-file')

    def test_installed_tools_only(self):
        result, output = self.run_isolated(['sh', '-ec', 'node --version; npm --version; bun --version; test ! -e /home/main; test ! -e /run/user/1000; test ! -e /etc/shadow; test ! -w /usr/local/bin/node; test ! -w /dev/shm/task8-managed-chromium-cHQvga'])
        self.assertEqual(result.returncode, 0, result.stdout.decode() + (output / 'command.log').read_text())

    def test_explicit_supplemental_package(self):
        extra = self.temp / 'extra-package'
        extra.mkdir()
        (extra / 'index.js').write_text('installed-extra')
        result, output = self.run_isolated(['python3', '-c', 'from pathlib import Path; assert Path("node_modules/extra/index.js").read_text()=="installed-extra"'],
                                           extra=['--package', 'extra=' + str(extra)])
        self.assertEqual(result.returncode, 0, result.stdout.decode())
        self.assertEqual((extra / 'index.js').read_text(), 'installed-extra')

    def test_capture_write_restore_and_launch_failure(self):
        spec = importlib.util.spec_from_file_location('s0', LAUNCHER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        before = self.fingerprints()
        original = module.copy_file
        fired = False
        def change_after_copy(source, destination):
            nonlocal fired
            original(source, destination)
            if source == self.source / 'input.txt' and not fired:
                fired = True
                source.write_text('transient-change')
                source.write_text('requested-change')
        for mode in ['race', 'launch', 'signal']:
            output = self.temp / ('direct-' + mode)
            args = argparse.Namespace(source=str(self.source), dependencies=str(self.deps),
                browser=module.BROWSER, bun='/home/main/.bun/bin/bun', scratch_root=str(self.temp),
                output=str(output), include=['input.txt'], package=[], expected_head='UNBORN',
                expected_source_sha256=None, timeout=10, retain=[], retain_log=False, command=['--', 'true'])
            with contextlib.redirect_stdout(io.StringIO()):
                if mode == 'race':
                    with patch.object(module, 'copy_file', change_after_copy):
                        code = module.run(args)
                elif mode == 'launch':
                    # Only OS launch is denied; no fallback command is supplied.
                    with patch.object(module, 'sandbox', side_effect=module.BoundaryError('test-launch-denied')):
                        code = module.run(args)
                else:
                    real_wait = module.await_exit
                    signalled = False
                    def interrupt_wait(proc, timeout):
                        nonlocal signalled
                        if not signalled:
                            signalled = True
                            os.kill(os.getpid(), signal.SIGTERM)
                        return real_wait(proc, timeout)
                    with patch.object(module, 'await_exit', interrupt_wait):
                        code = module.run(args)
            self.assertEqual(code, 125)
            self.check_cleanup(output)
            self.assertEqual(json.loads((output / 'receipt.json').read_text())['error'],
                             {'race': 'input-changed-during-capture', 'launch': 'test-launch-denied', 'signal': 'launcher-interrupted'}[mode])
        self.assertTrue(fired)
        self.assertEqual(before, self.fingerprints())


if __name__ == "__main__":
    unittest.main()
