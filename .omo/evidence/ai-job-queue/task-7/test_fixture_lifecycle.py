"""SIGTERM must use the real fixture owner, not Vite's force-exit listener."""
import asyncio
import json
import os
from pathlib import Path
import signal
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
FIXTURE = Path(os.environ.get('TASK7_TEST_FIXTURE', HERE / 'editor-fixture-server.mjs')).resolve()
ROOT = HERE.parents[3]


class FixtureLifecycle(unittest.IsolatedAsyncioTestCase):
    async def test_sigterm_closes_service_before_vite_and_removes_owned_temp(self):
        with tempfile.TemporaryDirectory(prefix='task7-signal-test-', dir='/dev/shm') as directory:
            root = Path(directory)
            (root / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
            evidence = root / '.omo/evidence/ai-job-queue/task-7'
            evidence.mkdir(parents=True)
            receipt = evidence / 'signal-fixture-cleanup.json'
            env = dict(os.environ, TMPDIR=directory, TASK7_RUN_ID='signal-process-test', TASK7_CLEANUP_PATH=str(receipt))
            process = await asyncio.create_subprocess_exec('node', '--import', str(HERE / 'fixture-lifecycle-observer.mjs'), str(FIXTURE),
                cwd=root, env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
            lines = []
            loop = asyncio.get_running_loop()
            ready = loop.create_future()
            async def drain():
                async for line in process.stdout:
                    text = line.decode()
                    lines.append(text)
                    if text.strip() == 'TASK7_EDITOR_READY':
                        ready.set_result(None)
                if not ready.done():
                    ready.set_exception(RuntimeError('Fixture exited before readiness'))
            reader = asyncio.create_task(drain())
            exited = asyncio.create_task(process.wait())
            try:
                await asyncio.wait_for(asyncio.shield(ready), 30)
                process.send_signal(signal.SIGTERM)
                await asyncio.wait_for(asyncio.shield(exited), 30)
                await reader
                events = [line.strip() for line in lines if line.startswith('TASK7_PROBE_')]
                print(json.dumps({'fixture': str(FIXTURE), 'pid': process.pid, 'exit': process.returncode, 'events': events,
                                  'temporaryRemaining': [str(path) for path in root.glob('task7-editor-*')],
                                  'receipt': json.loads(receipt.read_text()) if receipt.exists() else None}), flush=True)
                self.assertEqual(events, ['TASK7_PROBE_SERVICE_CLOSE', 'TASK7_PROBE_VITE_CLOSE'])
                self.assertEqual(process.returncode, 0)
                self.assertEqual(list(root.glob('task7-editor-*')), [])
                current = json.loads(receipt.read_text())
                self.assertEqual(current['runId'], 'signal-process-test')
                self.assertTrue(current['removed'])
                self.assertTrue(current['serviceClosed'])
                self.assertTrue(current['serverClosed'])
                self.assertEqual(current['cleanupErrors'], [])
            finally:
                if process.returncode is None:
                    os.killpg(process.pid, signal.SIGKILL)
                    await exited
                await reader


if __name__ == '__main__':
    unittest.main(verbosity=2)
