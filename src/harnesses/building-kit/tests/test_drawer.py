"""그리기 — 샌드박스 사본, 함수 블록만 되돌리기, 모델 호출 주입, 타임아웃 기본값. 모델은 부르지 않는다."""
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
import drawer  # noqa: E402
import helpers as H  # noqa: E402


class DrawerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-draw-')
        self._data, self._sandbox = dot.DATA, drawer.SANDBOX
        self._env = dict(os.environ)
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(self.tmp, 'data', H.THEME))
        dot.DATA = os.path.join(self.tmp, 'data')
        drawer.SANDBOX = os.path.join(self.tmp, 'sandbox')
        os.environ['BK_TESTS_DIR'] = HERE
        os.environ['BK_HARNESS_DIR'] = os.path.dirname(HERE)
        dot._PAL.clear()
        self.module = H.install_round(dot.DATA)

    def tearDown(self):
        dot.DATA, drawer.SANDBOX = self._data, self._sandbox
        dot._PAL.clear()
        os.environ.clear()
        os.environ.update(self._env)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_ensure_module_writes_skeleton_with_stub_functions(self):
        os.remove(self.module)
        drawer.ensure_module(H.THEME, H.ROUND)
        text = open(self.module, encoding='utf-8').read()
        for item in H.round_items():
            for line in 'ABC':
                name = drawer.func_name(item, line)
                self.assertIn(drawer.BEGIN.format(name=name), text)
                self.assertIn(f'def {name}():', text)
        self.assertIn("'roof.gable': {'A': cand_roof_gable_A,", text.replace('"', "'"))

    def test_fake_runner_changes_only_its_own_function(self):
        before = open(self.module, encoding='utf-8').read()
        name = drawer.func_name('roof.gable', 'A')
        calls = []

        def runner(cmd, prompt, cwd, timeout):
            calls.append((cmd, cwd, timeout))
            path = os.path.join(cwd, 'round_module.py')
            text = open(path, encoding='utf-8').read()
            block = '\n'.join([drawer.BEGIN.format(name=name), f'def {name}():',
                               "    return dot.Cv.of(H.compose('roof.gable', 'A')), {'note': 'fake'}",
                               drawer.END.format(name=name)])
            start = text.index(drawer.BEGIN.format(name=name))
            end = text.index(drawer.END.format(name=name)) + len(drawer.END.format(name=name))
            open(path, 'w', encoding='utf-8').write(text[:start] + block + text[end:])
            return 0, 'drew roof A', ''

        rc = drawer.run(H.THEME, H.ROUND, lines_=['A'], jobs=1, runner=runner, cmd=['fake'], timeout=11)
        self.assertEqual(rc, 1)
        self.assertEqual(calls[0][0], ['fake'])
        self.assertEqual(calls[0][2], 11)
        after = open(self.module, encoding='utf-8').read()
        self.assertIn("H.compose('roof.gable', 'A')", after)
        self.assertNotIn('H.compose(\'roof.gable\', \'B\')', after)
        self.assertIn(drawer.func_name('wall.storey', 'A') + '():\n    raise NotImplementedError', after)
        self.assertNotEqual(before, after)

    def test_runner_receives_the_brief_and_the_palette_legend(self):
        seen = {}

        def runner(cmd, prompt, cwd, timeout):
            seen['prompt'] = prompt
            seen['files'] = sorted(os.listdir(cwd))
            return 0, 'ok', ''

        drawer.run(H.THEME, H.ROUND, lines_=['B'], jobs=1, runner=runner, cmd=['fake'])
        self.assertIn('중세 판타지 왕국', seen['prompt'])
        self.assertIn('잠긴 팔레트', seen['prompt'])
        self.assertIn('round_module.py', seen['files'])
        self.assertIn('BRIEF.md', seen['files'])
        self.assertIn('palette.json', seen['files'])
        self.assertIn('seed.json', seen['files'])
        self.assertIn('Actor1', seen['prompt'])
        self.assertIn('금지', seen['prompt'])

    def test_unchanged_function_counts_as_not_changed(self):
        def runner(cmd, prompt, cwd, timeout):
            return 0, 'nothing', ''

        rc = drawer.run(H.THEME, H.ROUND, lines_=['C'], jobs=1, runner=runner, cmd=['fake'])
        self.assertEqual(rc, 1)

    def test_default_timeout_is_one_hour_and_env_overridable(self):
        self.assertEqual(drawer.DEFAULT_TIMEOUT, int(os.environ.get('BUILDING_KIT_DRAWER_TIMEOUT', '3600')))
        self.assertEqual(drawer.DEFAULT_TIMEOUT, 3600)


if __name__ == '__main__':
    unittest.main()
