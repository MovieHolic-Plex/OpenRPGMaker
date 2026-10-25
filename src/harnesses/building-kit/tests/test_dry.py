"""자체 점검 — 주어진 모듈(샌드박스 사본)을 그대로 검사하는지, preview PNG 가 써지는지, `python3 dry.py` 가 인자 없이 도는지."""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import dot  # noqa: E402
import drawer  # noqa: E402
import dry  # noqa: E402
import harness  # noqa: E402
import helpers as H  # noqa: E402

BAD_MODULE = '''import dot

ROUND = 'style-r1'
WAVE = 'style'
NOTES = {}


def _bad():
    return dot.grid(['a' * 16 for _ in range(48)], {'a': (255, 0, 255)}), {}


CANDIDATES = {'roof.hip': {'A': _bad}}
'''

class DryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-dry-')
        self._data, self._runs, self._sandbox = dot.DATA, dot.RUNS, drawer.SANDBOX
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(self.tmp, 'data', H.THEME))
        dot.DATA = os.path.join(self.tmp, 'data')
        dot.RUNS = os.path.join(self.tmp, 'runs')
        drawer.SANDBOX = os.path.join(self.tmp, 'sandbox')
        dot._PAL.clear()
        self.module = H.install_round(dot.DATA)

    def tearDown(self):
        dot.DATA, dot.RUNS, drawer.SANDBOX = self._data, self._runs, self._sandbox
        dot._PAL.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_quiet(self, key='A', module=None, out=None):
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = dry.run(H.THEME, H.ROUND, key, module=module, out=out or os.path.join(self.tmp, 'preview'))
        return rc, buf.getvalue()

    def test_dry_uses_the_module_it_is_given(self):
        bad = os.path.join(self.tmp, 'bad_module.py')
        open(bad, 'w', encoding='utf-8').write(BAD_MODULE)
        rc_ok, _ = self.run_quiet(out=os.path.join(self.tmp, 'prev-repo'))
        rc_bad, text = self.run_quiet(module=bad, out=os.path.join(self.tmp, 'prev-bad'))
        self.assertEqual(rc_ok, 0)
        self.assertEqual(rc_bad, 1)
        self.assertIn('P:', text)

    def test_previews_are_written_at_item_and_building_scales(self):
        out = os.path.join(self.tmp, 'preview')
        rc, text = self.run_quiet(out=out)
        self.assertEqual(rc, 0, text)
        parts = H.parts('A')
        for item in H.round_items():
            im = Image.open(os.path.join(out, f'{item}.png'))
            self.assertEqual(im.size, (parts[item]['img'].width * dry.ITEM_SCALE, parts[item]['img'].height * dry.ITEM_SCALE), item)
        for bid in H.buildings():
            im = Image.open(os.path.join(out, f'{bid}.png'))
            self.assertEqual(im.width % dry.BUILDING_SCALE, 0)
            self.assertEqual(im.height % dry.BUILDING_SCALE, 0)
            grass = np.array(im.convert('RGBA'))[0, 0]
            self.assertEqual(int(grass[3]), 255, f'{bid} 미리보기가 버들항 잔디 위가 아니다')
        compare = Image.open(os.path.join(out, 'compare.png'))
        cottage = Image.open(os.path.join(out, 'cottage.png'))
        self.assertGreater(compare.width, cottage.width)
        self.assertIn('compare.png', text)

    def test_sandbox_python3_dry_py_runs_without_arguments(self):
        drawer.sandbox_for(H.THEME, H.ROUND, 'A')
        sandbox = os.path.join(drawer.SANDBOX, H.THEME, H.ROUND, 'A')
        env = dict(os.environ, BK_TESTS_DIR=HERE, BK_HARNESS_DIR=os.path.dirname(HERE))
        r = subprocess.run([sys.executable, 'dry.py'], cwd=sandbox, capture_output=True, text=True, env=env, timeout=600)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('preview', r.stdout)
        for name in ('compare.png', 'cottage.png', 'inn.png', 'roof.hip.png'):
            self.assertTrue(os.path.exists(os.path.join(sandbox, 'preview', name)), name)

    def test_sandbox_dry_fails_on_a_broken_sandbox_module(self):
        drawer.sandbox_for(H.THEME, H.ROUND, 'A')
        sandbox = os.path.join(drawer.SANDBOX, H.THEME, H.ROUND, 'A')
        open(os.path.join(sandbox, 'round_module.py'), 'w', encoding='utf-8').write(BAD_MODULE)
        env = dict(os.environ, BK_TESTS_DIR=HERE, BK_HARNESS_DIR=os.path.dirname(HERE))
        r = subprocess.run([sys.executable, 'dry.py'], cwd=sandbox, capture_output=True, text=True, env=env, timeout=600)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn('P:', r.stdout)

    def test_harness_dry_cli_takes_module_and_out(self):
        out = os.path.join(self.tmp, 'cli-preview')
        rc = harness.main(['dry', H.THEME, H.ROUND, 'A', '--module', self.module, '--out', out])
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.exists(os.path.join(out, 'compare.png')))

    def test_dry_skips_buildings_that_need_parts_from_another_round(self):
        seed_path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(seed_path, encoding='utf-8'))
        s['buildings'].append(dict(s['buildings'][0], id='needs-chimney', extras=[{'part': 'extra.chimney', 'at': [1, 0]}]))
        s['rounds'][H.ROUND]['buildings'].append('needs-chimney')
        json.dump(s, open(seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        dot._PAL.clear()
        rc, text = self.run_quiet(out=os.path.join(self.tmp, 'preview-skip'))
        self.assertEqual(rc, 0, text)
        self.assertIn('건너뜀', text)

if __name__ == '__main__':
    unittest.main()
