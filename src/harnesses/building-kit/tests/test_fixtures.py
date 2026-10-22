"""고정 후보가 draw→gate→assemble 을 통과하는지 — 그리고 조립 kit 의 통행·문 계약."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import gate as G  # noqa: E402
import helpers as H  # noqa: E402
import roofband  # noqa: E402
from PIL import Image  # noqa: E402
import numpy as np  # noqa: E402

PAL = dot.palette(H.THEME)


def fails(results):
    return [r for r in results if r['level'] == 'FAIL' and not r['ok']]


class FixtureGateTest(unittest.TestCase):
    def test_every_line_and_item_passes_set_gates(self):
        for line in 'ABC':
            parts = H.parts(line)
            for item, p in parts.items():
                with self.subTest(line=line, item=item):
                    self.assertEqual(fails(G.check_item(p['item'], p['img'], PAL, {})), [])

    def test_recolor_gate_accepts_distinct_lines(self):
        for item in H.round_items():
            rc = G.check_recolor({line: H.parts(line)[item]['img'] for line in 'ABC'})
            for line, r in rc.items():
                with self.subTest(item=item, line=line):
                    self.assertTrue(r['ok'], r['msg'])

    def test_line_material_accepts_own_line_and_rejects_other_line(self):
        style = {item: H.parts('A')[item]['img'] for item in H.round_items()}
        own = G.check_line_material(H.parts('A')['roof.hip']['img'], list(style.values()), [], PAL)
        other = G.check_line_material(H.parts('B')['roof.hip']['img'], list(style.values()), [], PAL)
        self.assertTrue(own['ok'], own['msg'])
        self.assertFalse(other['ok'], '줄 B 후보가 줄 A 재료 검사를 통과하면 안 된다')


class AssemblyTest(unittest.TestCase):
    def setUp(self):
        self.parts = H.parts('A')

    def test_cottage_inn_guild_assemble_without_failures(self):
        for bid, recipe in H.buildings().items():
            with self.subTest(building=bid):
                res = AS.assemble(recipe, self.parts, PAL, H.THEME)
                self.assertIsNotNone(res['img'])
                self.assertEqual(fails(res['checks']), [])

    def test_kit_contract_walk_grid_and_single_door(self):
        res = AS.assemble(H.buildings()['inn'], self.parts, PAL, H.THEME)
        kit = res['kit']
        self.assertEqual(len(kit['lower']), kit['rows'])
        self.assertTrue(all(len(r) == kit['cols'] for r in kit['lower']))
        self.assertEqual(sum(r.count('o') for r in kit['walkGrid']), 1)
        dx, dy = kit['door']
        self.assertEqual(kit['walkGrid'][dy][dx], 'o')
        self.assertEqual(kit['walkGrid'][dy + 1][dx], '.')
        self.assertTrue(all(c == '★' for row in kit['upper'][:kit['roofRows']] for c in row if c != '.'))

    def test_roof_ratio_inside_design_range(self):
        band = roofband.band()
        items = H.items()
        for bid, recipe in H.buildings().items():
            res = AS.assemble(recipe, self.parts, PAL, H.THEME)
            with self.subTest(building=bid):
                for m in AS.masses(recipe):
                    if items[m['roof']].get('spire'):
                        continue
                    rows = items[m['roof']]['pieces'][0]['size'][1]
                    ratio = rows / AS.mass_rows(m, items)
                    self.assertGreaterEqual(ratio, band['ratio_min'], m['id'])
                    self.assertLessEqual(ratio, band['ratio_max'], m['id'])
                self.assertNotIn('A6', {c['code'] for c in AS.run_checks(res)})

    def test_missing_part_is_reported_not_crashed(self):
        parts = dict(self.parts)
        del parts['wall.storey']
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIsNone(res['img'])
        self.assertEqual([c['code'] for c in AS.run_checks(res)], ['A0'])

    def test_seed_recipes_use_zero_cell_overhang(self):
        for theme in dot.THEMES:
            for b in dot.seed(theme)['buildings']:
                with self.subTest(theme=theme, building=b['id']):
                    self.assertEqual(b.get('overhang', 0), 0)

    def test_zero_overhang_assembly_has_no_a2_gap_and_roof_width_equals_walls(self):
        for bid, recipe in H.round_buildings().items():
            res = AS.assemble(recipe, self.parts, PAL, H.THEME)
            codes_ = {c['code'] for c in AS.run_checks(res)}
            cols = res['masses'][0]['cols'] if len(res['masses']) == 1 else max(m['cols'] for m in AS.masses(recipe))
            with self.subTest(building=bid):
                self.assertNotIn('A2', codes_, [c['msg'] for c in AS.run_checks(res)])
                self.assertNotIn('A3', codes_)
                self.assertEqual(res['width'], max(m['x'] + m['cols'] for m in AS.masses(recipe)))
                self.assertEqual(res['kit']['wallX'], next(m['x'] for m in res['masses'] if m['id'] == res['kit']['doorMass']))
                self.assertGreaterEqual(cols, AS.MIN_COLS)

    def test_declared_eave_inset_allows_a_transparent_wall_edge(self):
        wall = H.compose('wall.storey', 'A')
        a = np.array(wall.convert('RGBA'))
        a[:, 0:2, 3] = 0
        im = Image.fromarray(a, 'RGBA')
        item = H.items()['wall.storey']
        self.assertEqual(fails(G.check_item(item, im, PAL, {})), [],
                         [r['msg'] for r in fails(G.check_item(item, im, PAL, {}))])
        parts = H.parts('A', overrides={'wall.storey': im})
        for bid, recipe in H.buildings().items():
            res = AS.assemble(recipe, parts, PAL, H.THEME)
            codes_ = {c['code'] for c in AS.run_checks(res)}
            with self.subTest(building=bid):
                self.assertNotIn('A2', codes_, [c['msg'] for c in AS.run_checks(res)])

    def test_undeclared_wall_hole_fails_q_and_a2(self):
        wall = H.compose('wall.storey', 'A')
        a = np.array(wall.convert('RGBA'))
        a[:, 5:7, 3] = 0
        im = Image.fromarray(a, 'RGBA')
        self.assertIn('Q', {r['code'] for r in fails(G.check_item(H.items()['wall.storey'], im, PAL, {}))})
        parts = H.parts('A', overrides={'wall.storey': im})
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A2', {c['code'] for c in AS.run_checks(res)})


if __name__ == '__main__':
    unittest.main()
