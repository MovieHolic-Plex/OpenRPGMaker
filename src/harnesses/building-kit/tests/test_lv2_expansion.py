"""Lv.1 + Lv.2 building-kit 확장 단위 시험 — on:wall 부속 앵커·A14 벽 관문·style-r9 14채×3줄(42채) 전량 통과."""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import harness as H  # noqa: E402

THEME = 'fantasy-kingdom'
R9 = 'style-r9'
PAL = dot.palette(THEME)


class Lv2WallExtrasAndStyleR9Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod, cls.rendered = H.render_round(THEME, R9)
        cls.parts = {ln: H.parts_for(THEME, R9, ln, cls.rendered) for ln in ('A', 'B', 'C')}
        cls.recipes = {b['id']: b for b in AS.round_buildings(THEME, R9)}

    def test_style_r9_seed_and_gate_pass_zero_fail(self):
        self.assertEqual(H.cmd_validate(THEME), 0)
        res = H.run_gate(THEME, R9, self.rendered)
        fails, warns = H.gate_summary(res)
        self.assertEqual(fails, [], f'gate FAIL: {fails}')
        self.assertEqual(warns, [], f'gate WARN: {warns}')

    def test_all_14_recipes_across_3_lines_assemble_cleanly(self):
        self.assertGreaterEqual(len(self.recipes), 14)
        for ln in ('A', 'B', 'C'):
            for bid, recipe in self.recipes.items():
                with self.subTest(line=ln, building=bid):
                    out = AS.assemble(recipe, self.parts[ln], PAL, THEME)
                    self.assertIsNotNone(out['img'], out['checks'])
                    bad = AS.run_checks(out)
                    self.assertEqual(bad, [], f'{ln}.{bid} checks failed: {bad}')

    def test_wall_extra_storey_anchor_and_a14_pass(self):
        out = AS.assemble(self.recipes['bakery.r9'], self.parts['A'], PAL, THEME)
        self.assertEqual(AS.run_checks(out), [])
        a14 = next(c for c in out['checks'] if c['code'] == 'A14')
        self.assertTrue(a14['ok'])
        self.assertIn('벽 부속', a14['msg'])
        self.assertIn('지붕 위 부속', a14['msg'])

    def test_wall_extra_floating_in_sky_fails_a14(self):
        rec = json.loads(json.dumps(self.recipes['bakery.r9']))
        rec['masses'][0]['extras'].append({'part': 'extra.sign', 'on': 'wall', 'at': [2, -1]})
        out = AS.assemble(rec, self.parts['A'], PAL, THEME)
        codes = {c['code'] for c in AS.run_checks(out)}
        self.assertIn('A14', codes)

    def test_wall_extra_blocking_lower_doorway_fails_a14(self):
        rec = json.loads(json.dumps(self.recipes['bakery.r9']))
        # shop wing door is at col 2 (L W D R); place balcony across lower half (dy=1) of door col
        rec['masses'][1]['extras'].append({'part': 'extra.balcony', 'on': 'wall', 'storey': 0, 'col': 1, 'dy': 1})
        out = AS.assemble(rec, self.parts['A'], PAL, THEME)
        a14 = [c['msg'] for c in AS.run_checks(out) if c['code'] == 'A14']
        self.assertTrue(any('문짝 하단' in m for m in a14), a14)

    def test_validate_rejects_unknown_extra_surface(self):
        s = json.loads(json.dumps(dot.seed(THEME)))
        b = next(x for x in s['buildings'] if x['id'] == 'bakery.r9')
        b['masses'][0]['extras'][0]['on'] = 'ground'
        errs = H._gable_front_round(s, {it['id']: it for it in s['items']}, R9)
        self.assertTrue(any('on: "roof" 또는 "wall"' in e for e in errs), errs)


if __name__ == '__main__':
    unittest.main()
