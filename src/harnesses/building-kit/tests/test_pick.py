"""pick/reject 은 사람만 — 해시 불일치·시트 없음·대리 선택을 거절하는지."""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import dot  # noqa: E402
import harness  # noqa: E402
import helpers as H  # noqa: E402


class PickTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-pick-')
        self._data, self._runs = dot.DATA, dot.RUNS
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(self.tmp, H.THEME))
        os.remove(os.path.join(self.tmp, H.THEME, 'ledger.json')) if os.path.exists(
            os.path.join(self.tmp, H.THEME, 'ledger.json')) else None
        dot.DATA = self.tmp
        dot.RUNS = os.path.join(self.tmp, 'runs')
        dot._PAL.clear()
        H.install_round(self.tmp)
        os.makedirs(os.path.join(self.tmp, 'runs', H.THEME, H.ROUND), exist_ok=True)
        self.manifest = os.path.join(self.tmp, 'runs', H.THEME, H.ROUND, 'manifest.json')
        imgs = {line: H.parts(line) for line in 'ABC'}
        man = {'theme': H.THEME, 'round': H.ROUND, 'items': {}}
        for item in H.round_items():
            man['items'][item] = {line: {'sha256': dot.image_hash(imgs[line][item]['img'])} for line in 'ABC'}
        json.dump(man, open(self.manifest, 'w'), ensure_ascii=False)

    def tearDown(self):
        dot.DATA, dot.RUNS = self._data, self._runs
        dot._PAL.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def sha(self, item='roof.hip', line='A'):
        return json.load(open(self.manifest))['items'][item][line]['sha256']

    def test_pick_with_wrong_hash_is_refused(self):
        with self.assertRaises(SystemExit) as e:
            harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', 'deadbeef', '')
        self.assertIn('해시', str(e.exception))
        self.assertFalse(os.path.exists(harness.picked_path(H.THEME, 'A', 'roof.hip')))

    def test_pick_without_sheet_is_refused(self):
        sha = self.sha()[:8]
        os.remove(self.manifest)
        with self.assertRaises(SystemExit) as e:
            harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', sha, '')
        self.assertIn('manifest', str(e.exception))

    def test_pick_after_redraw_is_refused(self):
        man = json.load(open(self.manifest))
        man['items']['roof.hip']['A']['sha256'] = 'f' * 64
        json.dump(man, open(self.manifest, 'w'))
        with self.assertRaises(SystemExit) as e:
            harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', 'f' * 8, '')
        self.assertIn('바뀌었다', str(e.exception))

    def test_pick_records_hash_and_writes_picked_file(self):
        sha = self.sha()
        harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', sha[:8], 'note')
        led = harness.ledger(H.THEME)
        pick = led['picks'][0]
        self.assertEqual((pick['item'], pick['line'], pick['key'], pick['sha256'], pick['by']),
                         ('roof.hip', 'A', 'A', sha, 'user'))
        path = harness.picked_path(H.THEME, 'A', 'roof.hip')
        self.assertTrue(os.path.exists(path))
        self.assertEqual(dot.image_hash(__import__('PIL.Image', fromlist=['Image']).open(path)), sha)
        self.assertEqual(harness.pick_state(H.THEME)[('roof.hip', 'A')][1], 'current')

    def test_picked_file_tampering_voids_the_pick(self):
        sha = self.sha()
        harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', sha[:8], '')
        path = harness.picked_path(H.THEME, 'A', 'roof.hip')
        im = __import__('PIL.Image', fromlist=['Image']).open(path).convert('RGBA')
        im.putpixel((0, 0), (255, 0, 255, 255))
        im.save(path)
        self.assertTrue(harness.pick_state(H.THEME)[('roof.hip', 'A')][1].startswith('VOID'))

    def test_agent_proxy_pick_is_refused(self):
        with self.assertRaises(SystemExit) as e:
            harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'A', self.sha()[:8], '', by='agent')
        self.assertIn('사람만', str(e.exception))
        with self.assertRaises(SystemExit):
            harness.cmd_reject(H.THEME, H.ROUND, 'roof.hip', 'A', 'why', by='supervisor')
        self.assertEqual(harness.ledger(H.THEME)['picks'], [])

    def test_reject_needs_a_reason(self):
        with self.assertRaises(SystemExit) as e:
            harness.cmd_reject(H.THEME, H.ROUND, 'roof.hip', 'A', '')
        self.assertIn('--why', str(e.exception))

    def test_reject_records_current_hash(self):
        harness.cmd_reject(H.THEME, H.ROUND, 'roof.hip', 'B', '색이 죽었다')
        rec = harness.ledger(H.THEME)['rejects'][0]
        self.assertEqual((rec['item'], rec['line'], rec['key'], rec['why']), ('roof.hip', 'B', 'B', '색이 죽었다'))
        self.assertEqual(rec['sha256'], self.sha('roof.hip', 'B'))

    def test_pick_cli_requires_sha_and_has_no_auto_path(self):
        with self.assertRaises(SystemExit):
            harness.main(['pick', H.THEME, H.ROUND, 'roof.hip', 'A'])
        src = open(os.path.join(os.path.dirname(HERE), 'harness.py'), encoding='utf-8').read()
        self.assertIn("p.add_argument('--sha', required=True)", src)
        self.assertNotIn('auto_pick', src)
        self.assertNotIn('auto-pick', src)


if __name__ == '__main__':
    unittest.main()
