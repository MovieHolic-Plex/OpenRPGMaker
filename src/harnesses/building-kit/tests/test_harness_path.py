"""하네스 입구 전체 경로 — draw → gate → dry → assemble → review → sheet → pick → status."""
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
import review  # noqa: E402


class HarnessPathTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-path-')
        self._data, self._runs, self._viz = dot.DATA, dot.RUNS, dot.VIZ
        for theme in dot.THEMES:
            shutil.copytree(os.path.join(self._data, theme), os.path.join(self.tmp, 'data', theme))
        dot.DATA = os.path.join(self.tmp, 'data')
        dot.RUNS = os.path.join(self.tmp, 'runs')
        dot.VIZ = os.path.join(self.tmp, 'viz')
        os.makedirs(dot.VIZ)
        dot._PAL.clear()
        H.install_round(dot.DATA)

    def tearDown(self):
        dot.DATA, dot.RUNS, dot.VIZ = self._data, self._runs, self._viz
        dot._PAL.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_cli_draw_agent_reaches_drawer_with_cmd(self):
        """main() 를 거친 `draw --agent --cmd` 가 하위 명령 이름을 잃지 않고 cmd_draw 에 닿는다."""
        seen = []
        orig = harness.cmd_draw
        harness.cmd_draw = lambda *a, **k: seen.append(a) or 0
        try:
            rc = harness.main(['draw', H.THEME, H.ROUND, '--agent', '--lines', 'A,B', '--jobs', '2', '--cmd', 'fake-claude'])
        finally:
            harness.cmd_draw = orig
        self.assertEqual(rc, 0)
        self.assertEqual(seen, [(H.THEME, H.ROUND, True, ['A', 'B'], 2, 'fake-claude')])

    def test_draw_gate_dry_assemble_sheet(self):
        self.assertEqual(harness.cmd_draw(H.THEME, H.ROUND, quiet=True), 0)
        man = json.load(open(os.path.join(dot.RUNS, H.THEME, H.ROUND, 'manifest.json')))
        self.assertEqual(sorted(man['items']), sorted(H.round_items()))
        self.assertEqual(sorted(man['items']['roof.hip']), ['A', 'B', 'C'])

        rendered, res, fails = harness.cmd_gate(H.THEME, H.ROUND, quiet=True)
        self.assertEqual(fails, [], [(i, k, r['msg']) for i, k, r in fails][:3])
        self.assertEqual(harness.cmd_dry(H.THEME, H.ROUND, 'A'), 0)

        rows, afails = harness.cmd_assemble(H.THEME, H.ROUND, 'A', 'A', quiet=True)
        self.assertEqual(afails, [])
        self.assertEqual(len(rows), len(H.buildings()))
        kit = json.load(open(os.path.join(dot.RUNS, H.THEME, H.ROUND, 'buildings', 'cottage.json')))
        self.assertEqual(kit['door'] is not None, True)
        self.assertEqual(sum(r.count('o') for r in kit['walkGrid']), 1)

        self.assertEqual(harness.cmd_sheet(H.THEME, H.ROUND, False), 0)
        html = open(os.path.join(dot.VIZ, f'bk-{H.THEME}-{H.ROUND}.html'), encoding='utf-8').read()
        self.assertIn('data:image/png;base64,', html)
        self.assertNotIn('http://', html.replace('http://mdc-server:18301', ''))
        self.assertIn('pick', html)

    def test_review_then_sheet_shows_only_passed(self):
        harness.cmd_draw(H.THEME, H.ROUND, quiet=True)
        parts = {line: H.parts(line) for line in 'ABC'}

        def runner(prompt, images, workdir, model=None, effort=None, timeout=None):
            run_dir = os.path.dirname(images[0]).rsplit(os.sep, 1)[0]
            key = json.load(open(os.path.join(run_dir, 'key.json'), encoding='utf-8'))
            out = []
            for sid, k in key.items():
                v = 'FAIL' if k['kind'] == 'probe' else 'PASS'
                out.append(json.dumps({'id': sid, 'view34': v, 'quality': v, 'reason': 'fake'}))
            return '\n'.join(out)

        self.assertEqual(review.run(H.THEME, H.ROUND, runs=3, judge_runner=runner, parts=parts, seed=2, quiet=True), 0)
        self.assertEqual(harness.cmd_sheet(H.THEME, H.ROUND, False), 0)
        html = open(os.path.join(dot.VIZ, f'bk-{H.THEME}-{H.ROUND}.html'), encoding='utf-8').read()
        self.assertIn('검수 PASS', html)

    def test_pick_then_status_reports_current(self):
        harness.cmd_draw(H.THEME, H.ROUND, quiet=True)
        harness.cmd_gate(H.THEME, H.ROUND, quiet=True)
        harness.cmd_sheet(H.THEME, H.ROUND, False)
        sha = json.load(open(os.path.join(dot.RUNS, H.THEME, H.ROUND, 'manifest.json')))['items']['roof.hip']['B']['sha256']
        harness.cmd_pick(H.THEME, H.ROUND, 'roof.hip', 'B', sha[:8], '')
        self.assertEqual(harness.cmd_status(H.THEME), 0)
        state = harness.pick_state(H.THEME)
        self.assertEqual(state[('roof.hip', 'B')][1], 'current')

    def test_validate_accepts_all_four_themes(self):
        for theme in dot.THEMES:
            with self.subTest(theme=theme):
                self.assertEqual(harness.cmd_validate(theme), 0)

    def test_validate_rejects_a_broken_seed(self):
        path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(path, encoding='utf-8'))
        s['family'] = 'modern3'
        s['buildings'][0]['walls'] = ['D D D']
        json.dump(s, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        self.assertEqual(harness.cmd_validate(H.THEME), 1)

    def test_gate_fails_on_a_broken_candidate(self):
        _, rendered = harness.render_round(H.THEME, H.ROUND)
        from PIL import Image
        import numpy as np
        a = np.array(rendered['roof.hip']['B'][0].convert('RGBA'))
        a[5, 5] = [255, 0, 255, 255]
        rendered['roof.hip']['B'] = (Image.fromarray(a, 'RGBA'), {})
        res = harness.run_gate(H.THEME, H.ROUND, rendered)
        fails, _ = harness.gate_summary(res)
        self.assertTrue(any(r['code'] == 'P' for _, _, r in fails))


if __name__ == '__main__':
    unittest.main()
