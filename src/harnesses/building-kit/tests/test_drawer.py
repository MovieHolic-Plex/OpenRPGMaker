"""그리기 — 후보 키 하나가 그 벌 전체를 그린다, 샌드박스 그림·자체 점검, 함수 블록만 되돌리기, 모델 호출 주입."""
import json
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import beodeul  # noqa: E402
import dot  # noqa: E402
import drawer


class GatewayRetryTest(unittest.TestCase):
    def test_retries_only_gateway_5xx(self):
        import types
        calls = []

        def fake_run(cmd, **kw):
            calls.append(1)
            out = 'API Error: 502 {"error":"upstream_error"}' if len(calls) < 3 else 'ok'
            return types.SimpleNamespace(returncode=1 if len(calls) < 3 else 0, stdout=out, stderr='')
        orig = drawer.subprocess.run
        drawer.subprocess.run = fake_run
        try:
            rc, out, _ = drawer.subprocess_runner(['x'], 'p', '.', 5, sleep=lambda s: None)
        finally:
            drawer.subprocess.run = orig
        self.assertEqual((rc, out, len(calls)), (0, 'ok', 3))

    def test_other_failures_are_not_retried(self):
        self.assertFalse(drawer.is_gateway_error(1, 'NotImplementedError'))
        self.assertFalse(drawer.is_gateway_error(0, 'API Error: 502'))
        self.assertTrue(drawer.is_gateway_error(1, 'API Error: 503 x'))  # noqa: E402
import helpers as H  # noqa: E402

class DrawerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-draw-')
        self._data, self._sandbox = dot.DATA, drawer.SANDBOX
        self._env = dict(os.environ)
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(self.tmp, 'data', H.THEME))
        ledger = os.path.join(self.tmp, 'data', H.THEME, 'ledger.json')
        if os.path.exists(ledger):
            os.remove(ledger)
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

    def sandbox(self, key='A'):
        return os.path.join(drawer.SANDBOX, H.THEME, H.ROUND, key)

    def edit_own_block(self, calls, items=None):
        def runner(cmd, prompt, cwd, timeout):
            calls.append((cmd, cwd, timeout, prompt))
            path = os.path.join(cwd, 'round_module.py')
            text = open(path, encoding='utf-8').read()
            key = os.path.basename(cwd)
            for item in (items or H.round_items()):
                name = drawer.func_name(item, key)
                block = '\n'.join([drawer.BEGIN.format(name=name), f'def {name}():',
                                   f"    return dot.Cv.of(H.compose({item!r}, {key!r})), {{'note': 'fake'}}",
                                   drawer.END.format(name=name)])
                start = text.index(drawer.BEGIN.format(name=name))
                end = text.index(drawer.END.format(name=name)) + len(drawer.END.format(name=name))
                text = text[:start] + block + text[end:]
            open(path, 'w', encoding='utf-8').write(text)
            return 0, 'drew', ''
        return runner

    def test_ensure_module_writes_skeleton_with_stub_functions(self):
        os.remove(self.module)
        drawer.ensure_module(H.THEME, H.ROUND)
        text = open(self.module, encoding='utf-8').read()
        for item in H.round_items():
            for line in 'ABC':
                name = drawer.func_name(item, line)
                self.assertIn(drawer.BEGIN.format(name=name), text)
                self.assertIn(f'def {name}():', text)
        self.assertIn("'roof.hip': {'A': cand_roof_hip_A,", text.replace('"', "'"))

    def test_one_job_per_candidate_key_and_each_job_covers_every_item(self):
        calls = []
        drawer.run(H.THEME, H.ROUND, lines_=['A', 'B'], jobs=2, runner=self.edit_own_block(calls), cmd=['fake'])
        self.assertEqual(sorted(os.path.basename(c[1]) for c in calls), ['A', 'B'])
        for _, cwd, _, prompt in calls:
            key = os.path.basename(cwd)
            for item in H.round_items():
                self.assertIn(drawer.func_name(item, key), prompt)

    def test_later_rounds_draw_one_job_per_line_and_number(self):
        seed_path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(seed_path, encoding='utf-8'))
        s['rounds']['frame-r1'] = {'wave': None, 'title': 'frame', 'items': H.round_items(),
                                   'module': os.path.join(dot.DATA, H.THEME, 'round_frame-r1.py')}
        json.dump(s, open(seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        dot._PAL.clear()
        self.assertEqual(drawer.keys_for(H.THEME, 'frame-r1'), ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
        calls = []
        drawer.run(H.THEME, 'frame-r1', jobs=1, runner=self.edit_own_block(calls), cmd=['fake'])
        self.assertEqual([os.path.basename(c[1]) for c in calls], ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
        self.assertEqual(drawer.keys_for(H.THEME, 'frame-r1', ['B']), ['B1', 'B2'])

    def test_sandbox_has_reference_actor_and_palette_pngs(self):
        calls = []
        drawer.run(H.THEME, H.ROUND, lines_=['A'], jobs=1, runner=self.edit_own_block(calls), cmd=['fake'])
        root = self.sandbox('A')
        for rel in ('round_module.py', 'BRIEF.md', 'dry.py', 'dry.json',
                    'data/fantasy-kingdom/seed.json', 'data/fantasy-kingdom/palette.json',
                    'refs/actor1-front-1x.png', 'refs/actor1-front-4x.png', 'refs/palette.png'):
            self.assertTrue(os.path.exists(os.path.join(root, rel)), rel)
        seed = dot.seed(H.THEME)
        kit = beodeul.kit(seed['refs'][0]['kit'])
        for scale in (1, 4):
            im = Image.open(os.path.join(root, f'refs/{seed["refs"][0]["kit"]}-{scale}x.png'))
            self.assertEqual(im.size, (kit.w * scale, kit.h * scale))
        cfg = json.load(open(os.path.join(root, 'dry.json'), encoding='utf-8'))
        self.assertEqual(cfg['key'], 'A')
        self.assertEqual(os.path.abspath(cfg['module']), os.path.join(root, 'round_module.py'))
        self.assertEqual(os.path.abspath(cfg['out']), os.path.join(root, 'preview'))
        self.assertEqual(os.path.abspath(cfg['data']), os.path.join(root, 'data'))
        self.assertTrue(os.path.isdir(cfg['harness']))

    def test_brief_gives_3_4_roof_guidance_targets_and_self_check(self):
        calls = []
        drawer.run(H.THEME, H.ROUND, lines_=['A'], jobs=1, runner=self.edit_own_block(calls), cmd=['fake'])
        prompt = calls[0][3]
        self.assertIn('3/4 지붕', prompt)
        for word in ('용마루', '사면', '처마', '벽돌 담', '모임 사선', '보도블록'):
            self.assertIn(word, prompt)
        self.assertIn('4칸 폭 1층', prompt)
        self.assertIn('질량 2개', prompt)
        self.assertIn('preview/compare.png', prompt)
        self.assertIn('python3 dry.py', prompt)
        self.assertIn('refs/actor1-front-4x.png', prompt)
        self.assertIn('화소를 베끼지', prompt)
        self.assertIn('잠긴 팔레트', prompt)
        self.assertIn('중세 판타지 왕국', prompt)

    def test_claude_command_allows_reading_pictures_and_python(self):
        cmd = drawer.claude_command('/tmp/sandbox')
        tools = cmd[cmd.index('--allowedTools') + 1]
        self.assertEqual(tools, 'Read,Write,Edit,Bash(python3:*)')
        self.assertIn('/tmp/sandbox', cmd)

    def test_fake_runner_changes_only_its_own_function(self):
        before = open(self.module, encoding='utf-8').read()
        calls = []
        runner = self.edit_own_block(calls, items=['roof.hip'])
        rc = drawer.run(H.THEME, H.ROUND, lines_=['A'], jobs=1, runner=runner, cmd=['fake'], timeout=11)
        self.assertEqual(rc, 1)
        self.assertEqual(calls[0][0], ['fake'])
        self.assertEqual(calls[0][2], 11)
        after = open(self.module, encoding='utf-8').read()
        self.assertIn("H.compose('roof.hip', 'A')", after)
        self.assertNotIn("H.compose('roof.hip', 'B')", after)
        self.assertIn(drawer.func_name('wall.storey', 'A') + '():\n    raise NotImplementedError', after)
        self.assertIn(drawer.func_name('wall.storey', 'B') + '():\n    raise NotImplementedError', after)
        self.assertNotEqual(before, after)

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
