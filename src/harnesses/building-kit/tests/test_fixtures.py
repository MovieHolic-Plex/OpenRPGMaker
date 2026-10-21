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
        own = G.check_line_material(H.parts('A')['roof.gable']['img'], list(style.values()), [], PAL)
        other = G.check_line_material(H.parts('B')['roof.gable']['img'], list(style.values()), [], PAL)
        self.assertTrue(own['ok'], own['msg'])
        self.assertFalse(other['ok'], '줄 B 후보가 줄 A 재료 검사를 통과하면 안 된다')


class AssemblyTest(unittest.TestCase):
    def setUp(self):
        self.parts = H.parts('A')

    def test_cottage_and_longhouse_assemble_without_failures(self):
        for bid, recipe in H.buildings().items():
            with self.subTest(building=bid):
                res = AS.assemble(recipe, self.parts, PAL, H.THEME)
                self.assertIsNotNone(res['img'])
                self.assertEqual(fails(res['checks']), [])

    def test_kit_contract_walk_grid_and_single_door(self):
        res = AS.assemble(H.buildings()['longhouse'], self.parts, PAL, H.THEME)
        kit = res['kit']
        self.assertEqual(len(kit['lower']), kit['rows'])
        self.assertTrue(all(len(r) == kit['cols'] for r in kit['lower']))
        self.assertEqual(sum(r.count('o') for r in kit['walkGrid']), 1)
        dx, dy = kit['door']
        self.assertEqual(kit['walkGrid'][dy][dx], 'o')
        self.assertEqual(kit['walkGrid'][dy + 1][dx], '.')
        self.assertTrue(all(c == '★' for row in kit['upper'][:kit['roofRows']] for c in row if c != '.'))

    def test_roof_ratio_inside_design_range(self):
        for bid, recipe in H.buildings().items():
            res = AS.assemble(recipe, self.parts, PAL, H.THEME)
            ratio = res['kit']['roofRows'] / res['kit']['rows']
            with self.subTest(building=bid):
                self.assertGreaterEqual(ratio, AS.TOP_MIN)
                self.assertLessEqual(ratio, AS.TOP_MAX)

    def test_missing_part_is_reported_not_crashed(self):
        parts = dict(self.parts)
        del parts['base.stone']
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIsNone(res['img'])
        self.assertEqual([c['code'] for c in AS.run_checks(res)], ['A0'])


if __name__ == '__main__':
    unittest.main()
