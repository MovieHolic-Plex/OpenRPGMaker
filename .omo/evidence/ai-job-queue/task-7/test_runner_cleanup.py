"""Process-only runner contract. No browsers, sleeps, polling or external servers."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
RUNNER = Path(os.environ.get('TASK7_TEST_RUNNER', HERE / 'run-owned.py')).resolve()
REL = Path('.omo/evidence/ai-job-queue/task-7')

# Real HTTP/socket, child-process and filesystem boundaries, not mocked subprocess calls.
FIXTURE = r"""
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const mode = process.env.PROBE_MODE;
const temporary = process.env.TASK7_TEMPORARY ?? await mkdtemp(join(tmpdir(), 'task7-probe-'));
const receipt = process.env.TASK7_CLEANUP_PATH ?? '.omo/evidence/ai-job-queue/task-7/browser-cleanup.json';
let child;
if (mode === 'mixed-exit') {
  // A listening socket keeps the child alive after the parent's stdin/IPC closes.
  // Both output descriptors are inherited from the fixture's runner-owned pipe.
  child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); const server=require('node:net').createServer(); server.listen(0,'127.0.0.1',()=>process.send('READY'));"], {stdio:['ignore','inherit','inherit','ipc']});
  const [ready] = await once(child, 'message');
  if (ready !== 'READY') throw new Error('Unexpected child readiness');
  process.once('SIGTERM', () => process.exit(0));
}
if (mode === 'timeout') {
  child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); process.stdout.write('READY\\n'); process.stdin.resume()"], {stdio:['pipe','pipe','inherit']});
  await once(child.stdout, 'data');
  process.on('SIGTERM', () => {});
}
async function close() {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await rm(temporary, { recursive: true, force: true });
  if (mode !== 'stale') await writeFile(receipt, JSON.stringify({runId:process.env.TASK7_RUN_ID, temporary, removed:true, serviceClosed:true, serverClosed:true, activeBrowsers:0, errors:[], cleanupErrors:[], externalPaidCalls:0}));
}
const server = http.createServer((req, res) => {
  if (req.url === '/__task7/shutdown') {
    if (mode === 'http-failure') { res.writeHead(500); res.end('{}'); return; }
    res.once('finish', () => { if (!['timeout', 'mixed-exit'].includes(mode)) close().catch(error => {console.error(error); process.exitCode=1;}); });
    res.end('{}');
  } else { res.end('{}'); }
});
if (!['timeout', 'mixed-exit'].includes(mode)) process.once('SIGTERM', () => {close().catch(error => {console.error(error); process.exitCode=1;});});
server.listen(Number(process.env.DEV_SERVER_PORT), '127.0.0.1');
await once(server, 'listening');
const identities = Object.fromEntries(await Promise.all([process.pid, child?.pid].filter(Boolean).map(async pid => [pid, (await readFile(`/proc/${pid}/stat`, 'utf8')).split(')').at(-1).trim().split(/\s+/)[19]])));
await writeFile('probe-owned.json', JSON.stringify({pid:process.pid, child:child?.pid, temporary, identities}));
console.log('TASK7_EDITOR_READY');
"""


class RunnerCleanup(unittest.IsolatedAsyncioTestCase):
    async def run_case(self, mode, command_exit=0):
        with tempfile.TemporaryDirectory(prefix='task7-runner-test-', dir='/dev/shm') as directory:
            root = Path(directory)
            evidence = root / REL
            evidence.mkdir(parents=True)
            shutil.copyfile(RUNNER, evidence / 'run-owned.py')
            (evidence / 'editor-fixture-server.mjs').write_text(FIXTURE)
            stale = {'runId': 'STALE-DO-NOT-REUSE', 'removed': True, 'serverClosed': True}
            (evidence / 'browser-cleanup.json').write_text(json.dumps(stale))
            (evidence / 'probe-cleanup.json').write_text(json.dumps(stale))
            # Allocate a test-controlled port; never inherit the shared replay port.
            with socket.socket() as reservation:
                reservation.bind(('127.0.0.1', 0))
                port = reservation.getsockname()[1]
            self.assertNotIn(port, (19841, 9841))
            short_deadline = mode in ('timeout', 'mixed-exit')
            env = dict(os.environ, PROBE_MODE=mode, TASK7_PORT=str(port), TASK7_READY_TIMEOUT='5', TASK7_SHUTDOWN_TIMEOUT='0.4' if short_deadline else '5', TASK7_ESCALATION_TIMEOUT='0.4' if short_deadline else '5')
            command = f'raise SystemExit({command_exit})'
            loop = asyncio.get_running_loop()
            parent_exited = loop.create_future()
            armed = loop.create_future()
            parent_fd = None
            control = None
            if mode == 'mixed-exit':
                async def arm_parent_exit(reader, writer):
                    nonlocal parent_fd
                    try:
                        owned = json.loads(await asyncio.wait_for(reader.readline(), 5))
                        parent_fd = os.pidfd_open(owned['pid'])
                        def observe_exit():
                            if not parent_exited.done():
                                parent_exited.set_result(owned['pid'])
                        loop.add_reader(parent_fd, observe_exit)
                        # Release the workload only AFTER subscribing to actual parent exit.
                        # The runner cannot trigger shutdown/TERM until this command exits.
                        writer.write(b'ARMED\n')
                        await asyncio.wait_for(writer.drain(), 5)
                        armed.set_result(owned['pid'])
                    except Exception as error:
                        armed.set_exception(error)
                    finally:
                        writer.close()
                        await asyncio.wait_for(writer.wait_closed(), 5)
                control_path = str(root / 'exit-control.sock')
                control = await asyncio.start_unix_server(arm_parent_exit, path=control_path)
                env['PROBE_CONTROL'] = control_path
                command = (
                    "import os,socket; from pathlib import Path; "
                    "s=socket.socket(socket.AF_UNIX); s.settimeout(5); "
                    "s.connect(os.environ['PROBE_CONTROL']); "
                    "s.sendall(Path('probe-owned.json').read_bytes()+b'\\n'); "
                    "response=s.makefile('rb'); assert response.readline()==b'ARMED\\n'; "
                    "response.close(); s.close()"
                )
            process = await asyncio.create_subprocess_exec(
                'python3', str(evidence / 'run-owned.py'), 'probe', 'python3', '-c', command,
                cwd=root, env=env, start_new_session=True, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
            # Subscribe to both stdout EOF and process exit before any cleanup assertion.
            completed = asyncio.create_task(process.communicate())
            timed_out = False
            try:
                if mode == 'mixed-exit':
                    await asyncio.wait_for(asyncio.shield(armed), 5)
                    await asyncio.wait_for(asyncio.shield(parent_exited), 5)
                output, _ = await asyncio.wait_for(asyncio.shield(completed), 8)
            except TimeoutError:
                timed_out = True
                os.killpg(process.pid, signal.SIGKILL)
                output, _ = await asyncio.wait_for(asyncio.shield(completed), 5)
            finally:
                # Baseline runner does not own/reap its tree; reclaim ONLY recorded probe PIDs.
                owned_file = root / 'probe-owned.json'
                owned = json.loads(owned_file.read_text()) if owned_file.exists() else {}
                remaining_before_test_cleanup = [pid for pid in (owned.get('child'), owned.get('pid')) if pid and Path(f'/proc/{pid}').exists()]
                temp_before_test_cleanup = bool(owned.get('temporary') and Path(owned['temporary']).exists())
                for pid in (owned.get('child'), owned.get('pid')):
                    if pid:
                        try:
                            fd = os.pidfd_open(pid)
                        except ProcessLookupError:
                            continue
                        try:
                            started = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
                            if started == owned['identities'][str(pid)]:
                                signal.pidfd_send_signal(fd, signal.SIGKILL)
                        except (FileNotFoundError, ProcessLookupError):
                            pass  # Already exited; no process exists to clean up.
                        finally:
                            os.close(fd)
                if temp_before_test_cleanup:
                    shutil.rmtree(owned['temporary'])
                if parent_fd is not None:
                    loop.remove_reader(parent_fd)
                    os.close(parent_fd)
                if control is not None:
                    control.close()
                    await asyncio.wait_for(control.wait_closed(), 5)
            receipt = json.loads((evidence / 'probe-cleanup.json').read_text())
            print(json.dumps({'case': mode, 'commandExit': command_exit, 'wrapperExit': process.returncode, 'outerDeadline': timed_out, 'parentExitObserved': parent_exited.done() and not parent_exited.cancelled(), 'testPort': port, 'remainingBeforeTestCleanup': remaining_before_test_cleanup, 'tempBeforeTestCleanup': temp_before_test_cleanup, 'receipt': receipt, 'output': output.decode()}), flush=True)
            self.assertFalse(timed_out, output.decode())
            self.assertNotEqual(receipt.get('runId'), stale['runId'], 'stale per-label receipt was reused')
            self.assertEqual(receipt['commandExit'], command_exit)
            self.assertEqual(receipt['status'], 'complete')
            self.assertTrue(receipt['removed'])
            self.assertEqual(receipt['remainingPids'], [])
            self.assertTrue(receipt['portFree'])
            self.assertEqual(receipt['port'], port)
            with socket.socket() as check:
                check.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                check.bind(('127.0.0.1', port))
            self.assertEqual(remaining_before_test_cleanup, [], 'runner leaked an actual owned PID')
            self.assertFalse(temp_before_test_cleanup, 'runner leaked its actual temporary directory')
            self.assertFalse(Path(receipt['temporary']).exists())
            self.assertEqual(json.loads((evidence / 'browser-cleanup.json').read_text()), stale, 'shared historical receipt must not be consumed or rewritten')
            return process.returncode, receipt

    async def test_successful_command_and_cleanup(self):
        code, receipt = await self.run_case('success')
        self.assertEqual(code, 0)
        self.assertTrue(receipt['graceful'])
        self.assertEqual(receipt['cleanupErrors'], [])
        self.assertEqual(receipt['fixture']['runId'], receipt['runId'])

    async def test_command_failure_still_cleans_up(self):
        code, receipt = await self.run_case('success', 7)
        self.assertEqual(code, 7)
        self.assertTrue(receipt['graceful'])

    async def test_shutdown_http_failure_is_not_command_failure(self):
        code, receipt = await self.run_case('http-failure')
        self.assertEqual(code, 1)
        self.assertFalse(receipt['graceful'])
        self.assertTrue(receipt['cleanupErrors'])
        self.assertEqual(receipt['shutdownHttp'], 500)

    async def test_timeout_escalates_only_owned_tree_and_records_failure(self):
        code, receipt = await self.run_case('timeout')
        self.assertEqual(code, 1)
        self.assertFalse(receipt['graceful'])
        self.assertEqual(receipt['shutdownHttp'], 200)
        self.assertEqual([item['signal'] for item in receipt['escalations']], ['SIGTERM', 'SIGKILL'])
        self.assertIsNone(receipt['fixture'])
        self.assertTrue(receipt['cleanupErrors'])

    async def test_exited_parent_with_term_resistant_descendant_holding_output(self):
        code, receipt = await self.run_case('mixed-exit')
        self.assertEqual(code, 1)
        self.assertEqual(receipt['serverExit'], 0)
        self.assertFalse(receipt['graceful'])
        self.assertEqual(receipt['shutdownHttp'], 200)
        self.assertEqual([item['signal'] for item in receipt['escalations']], ['SIGTERM', 'SIGKILL'])
        self.assertNotIn(receipt['serverPid'], receipt['escalations'][1]['pids'])
        self.assertIsNone(receipt['fixture'])
        self.assertTrue(receipt['cleanupErrors'])

    async def test_missing_fresh_fixture_receipt_cannot_reuse_stale_success(self):
        code, receipt = await self.run_case('stale')
        self.assertEqual(code, 1)
        self.assertFalse(receipt['graceful'])
        self.assertIsNone(receipt['fixture'])
        self.assertTrue(receipt['cleanupErrors'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
