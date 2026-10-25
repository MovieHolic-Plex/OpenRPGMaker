"""탑 지붕 시험 — roof.spire 부품 계약, A11(폭·재료 램프), r4 판 문법, r3 원뿔 반려 회귀."""
import os
import sys
import unittest

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import gate as G  # noqa: E402
import harness  # noqa: E402
import helpers as H  # noqa: E402

PAL = dot.palette(H.THEME)
ITEMS = H.items()

def fails(res):
    return {c['code'] for c in AS.run_checks(res)}

def tower_recipe(roof='roof.spire', tower_cols=2, tower_storeys=3):
    letters = 'M' if tower_cols == 1 else 'M R'
    return {
        'id': 'towered', 'title': '', 'use': 'manor',
        'masses': [
            {'id': 'body', 'cols': 6, 'storeys': 2, 'x': 0, 'depth': 0, 'roof': 'roof.hip',
             'walls': [{'item': 'wall.storey', 'letters': 'L W M W M R'},
                       {'item': 'wall.storey', 'letters': 'L W M W D R'}]},
            {'id': 'tower', 'cols': tower_cols, 'storeys': tower_storeys, 'x': 5, 'depth': 0,
             'roof': roof,
             'walls': [{'item': 'wall.storey', 'letters': letters} for _ in range(tower_storeys)]},
        ],
    }

def parts_with_spire():
    return H.parts('A', extra=['roof.spire', 'roof.hip.low'])

class SpirePartTest(unittest.TestCase):
    def test_spire_set_is_one_cell_wide_and_four_rows(self):
        it = ITEMS['roof.spire']
        self.assertTrue(it['spire'])
        self.assertEqual(it['size'], [3, 4])
        self.assertEqual([(p['role'], p['size']) for p in it['pieces']],
                         [('l', [1, 4]), ('m', [1, 4]), ('r', [1, 4])])
        self.assertEqual(AS.roof_problems(it), [])

    def test_spire_pieces_pass_the_part_gate(self):
        im = H.compose('roof.spire', 'A')
        bad = [r for r in G.check_item(ITEMS['roof.spire'], im, PAL, {}) if r['level'] == 'FAIL' and not r['ok']]
        self.assertEqual(bad, [], [r['msg'] for r in bad])

    def test_spire_lights_left_and_darkens_right(self):
        a = np.array(H.compose('roof.spire', 'A').convert('RGBA'))
        op = a[:, :, 3] == 255
        L = a[:, :, :3].astype(float) @ np.array([0.299, 0.587, 0.114])
        left = L[:, :24][op[:, :24]].mean()
        right = L[:, 24:][op[:, 24:]].mean()
        self.assertGreater(left, right + 20, f'왼쪽 {left:.0f} 이 오른쪽 {right:.0f} 보다 밝아야 한다')

    def test_wide_or_short_spire_is_refused_by_roof_problems(self):
        wide = dict(ITEMS['roof.spire'], size=[5, 4])
        wide['pieces'] = [dict(p, at=[i, 0], size=[2, 4]) for i, p in enumerate(ITEMS['roof.spire']['pieces'])]
        self.assertTrue(AS.roof_problems(wide))
        short = dict(ITEMS['roof.spire'], size=[3, 2])
        short['pieces'] = [dict(p, size=[1, 2]) for p in ITEMS['roof.spire']['pieces']]
        self.assertTrue(any('첨탑' in m for m in AS.roof_problems(short)))

class TowerAssemblyTest(unittest.TestCase):
    def test_tower_with_spire_assembles_clean(self):
        res = AS.assemble(tower_recipe(), parts_with_spire(), PAL, H.THEME)
        self.assertEqual([c['msg'] for c in AS.run_checks(res)], [])

    def test_spire_tower_rises_above_the_main_ridge(self):
        res = AS.assemble(tower_recipe(), parts_with_spire(), PAL, H.THEME)
        body = next(m for m in res['masses'] if m['id'] == 'body')
        tower = next(m for m in res['masses'] if m['id'] == 'tower')
        self.assertLess(tower['top'], body['top'], '탑 꼭대기가 본채 용마루보다 위여야 한다')

    def test_cone_wider_than_the_tower_fails_a11(self):
        wide_cone = dict(ITEMS['roof.hip'], cone=True, id='roof.cone.wide')
        parts = H.parts('A', extra=['roof.spire'])
        parts['roof.cone.wide'] = {'item': wide_cone, 'img': H.compose('roof.hip', 'A')}
        res = AS.assemble(tower_recipe(roof='roof.cone.wide', tower_cols=2), parts, PAL, H.THEME)
        self.assertIn('A11', fails(res), [c['msg'] for c in AS.run_checks(res)])
        self.assertIn('탑 몸통', ' '.join(c['msg'] for c in AS.run_checks(res) if c['code'] == 'A11'))

    def test_tower_roof_in_a_foreign_ramp_fails_a11(self):
        spire = H.compose('roof.spire', 'B')
        parts = H.parts('A', overrides={'roof.spire': spire}, extra=['roof.spire'])
        res = AS.assemble(tower_recipe(), parts, PAL, H.THEME)
        self.assertIn('A11', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_spire_mass_must_be_one_or_two_cells(self):
        res = AS.assemble(tower_recipe(tower_cols=4), parts_with_spire(), PAL, H.THEME)
        self.assertIn('A3', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_r3_cone_tower_no_longer_passes_the_roof_gates(self):
        rendered = harness.render_round('beodeul-noble', 'style-r3')[1]
        parts = harness.parts_for('beodeul-noble', 'style-r3', 'A', rendered)
        rows = harness.assemble_all('beodeul-noble', parts, quiet=True, rid='style-r3')
        town = next(r for r in rows if r['recipe']['id'] == 'townhouse')
        codes = {c['code'] for c in town['fails']}
        self.assertIn('A6', codes)
        self.assertIn('A9', codes)

class RoundFourGrammarTest(unittest.TestCase):
    def test_r4_rounds_exist_for_fantasy_and_noble(self):
        for theme in ('fantasy-kingdom', 'beodeul-noble'):
            rd = dot.seed(theme)['rounds'].get('style-r4')
            with self.subTest(theme=theme):
                self.assertIsNotNone(rd, 'style-r4 판이 시드에 없다')
                self.assertEqual(rd['grammar'], 'r4')
                self.assertGreaterEqual(len(rd['buildings']), 3)
                self.assertIn('roof.spire', rd['items'])

    def test_r4_recipes_assemble_with_fixture_parts(self):
        parts = parts_with_spire()
        for bid in ('cottage.r4', 'inn.r4', 'guild.r4', 'bellhouse.r4'):
            recipe = next(b for b in dot.seed(H.THEME)['buildings'] if b['id'] == bid)
            with self.subTest(building=bid):
                res = AS.assemble(recipe, parts, PAL, H.THEME)
                self.assertEqual([c['msg'] for c in AS.run_checks(res)], [])

    def test_r4_validate_reports_missing_module_but_no_grammar_error(self):
        self.assertEqual(harness.cmd_validate('fantasy-kingdom'), 0)
        self.assertEqual(harness.cmd_validate('beodeul-noble'), 0)

if __name__ == '__main__':
    unittest.main()
