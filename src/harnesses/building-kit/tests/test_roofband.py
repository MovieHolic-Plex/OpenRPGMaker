"""지붕 비율 밴드 시험 — 버들항 기준 실측, 뾰족한 피라미드는 A9 FAIL, 기준 비율 지붕은 통과.

밴드는 손으로 적은 수가 아니라 `roofband.refs()` 가 버들항 기준 그림에서 매번 다시 잰다. 그래서 이 시험은
(1) 실측값 자체, (2) 기준 그림이 새 관문을 통과하는지, (3) 깎아 만든 피라미드가 A9 에서 걸리는지를 함께 본다.
"""
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
import helpers as H  # noqa: E402
import roofband  # noqa: E402

PAL = dot.palette(H.THEME)

def fails(res):
    return {c['code'] for c in AS.run_checks(res)}

def _taper(im, top_frac, taper_frac):
    """지붕 꼭대기를 top_frac 만큼만 남기고 taper_frac 높이까지 넓히는 마스크(피라미드·버들항 비율 공용)."""
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    ridge = max(2, int(round(w * top_frac)))
    knee = max(1, int(round(h * taper_frac)))
    for y in range(h):
        t = min(1.0, y / knee)
        half = int(round(ridge / 2 + (w / 2 - ridge / 2) * t))
        a[y, :max(0, w // 2 - half), 3] = 0
        a[y, w // 2 + half:, 3] = 0
    return Image.fromarray(a, 'RGBA')

WIDE = {'id': 'wide', 'title': '', 'use': 'home', 'cols': 5, 'storeys': 1,
        'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L M M D R']}
TALL = {'id': 'tall2', 'title': '', 'use': 'inn', 'cols': 5, 'storeys': 2,
        'roof': 'roof.hip.tall', 'wall': 'wall.storey', 'walls': ['L M M W R', 'L M M D R']}

class RoofBandTest(unittest.TestCase):
    def test_band_is_measured_from_the_two_beodeul_references(self):
        b = roofband.band()
        self.assertEqual([r['kit'] for r in b['refs']], ['bd-house-h101_0', 'bd-house-inn'])
        h101, inn = b['refs']
        self.assertEqual((h101['roof'], h101['total'], h101['ratio']), (44, 76, 0.579))
        self.assertEqual((inn['roof'], inn['total'], inn['ratio']), (44, 108, 0.407))
        self.assertEqual((h101['ridge'], h101['eave_w'], h101['ridge_frac']), (35, 80, 0.438))
        self.assertEqual((inn['ridge'], inn['eave_w'], inn['ridge_frac']), (50, 128, 0.391))
        self.assertEqual((b['ratio_min'], b['ratio_max'], b['ridge_min']), (0.367, 0.619, 0.351))

    def test_band_tightens_the_old_a6_window(self):
        b = roofband.band()
        self.assertGreater(b['ratio_min'], 0.30, '옛 A6 하한 0.30 보다 좁아야 한다')
        self.assertLessEqual(b['ratio_max'], 0.62, '옛 A6 상한 0.62 보다 넓히지 않는다')

    def test_real_reference_crops_pass_the_roof_gate(self):
        b = roofband.band()
        for r in b['refs']:
            with self.subTest(kit=r['kit']):
                self.assertGreaterEqual(r['ratio'], b['ratio_min'])
                self.assertLessEqual(r['ratio'], b['ratio_max'])
                self.assertGreaterEqual(r['ridge_frac'], b['ridge_min'])

    def test_one_storey_two_rows_and_two_storey_three_rows_sit_inside_the_band(self):
        b = roofband.band()
        for storeys, roof_rows in ((1, 2), (2, 3)):
            ratio = roof_rows / (roof_rows + storeys * AS.STOREY_CELLS)
            with self.subTest(storeys=storeys):
                self.assertGreaterEqual(ratio, b['ratio_min'])
                self.assertLessEqual(ratio, b['ratio_max'])

class RoofGateTest(unittest.TestCase):
    def test_tall_pyramid_roof_fails_a9(self):
        parts = H.parts('A', overrides={'roof.hip': _taper(H.compose('roof.hip', 'A'), 0.06, 0.95),
                                        'roof.hip.tall': _taper(H.compose('roof.hip.tall', 'A'), 0.06, 0.95)})
        for recipe in (WIDE, TALL):
            with self.subTest(building=recipe['id']):
                res = AS.assemble(recipe, parts, PAL, H.THEME)
                self.assertIn('A9', fails(res), [c['msg'] for c in AS.run_checks(res)])
                self.assertNotIn('A6', fails(res), '비율은 그대로 — 걸리는 것은 용마루다')

    def test_beodeul_proportion_roof_passes_a9(self):
        parts = H.parts('A', overrides={'roof.hip': _taper(H.compose('roof.hip', 'A'), 0.44, 0.60),
                                        'roof.hip.tall': _taper(H.compose('roof.hip.tall', 'A'), 0.44, 0.60)})
        for recipe in (WIDE, TALL):
            with self.subTest(building=recipe['id']):
                res = AS.assemble(recipe, parts, PAL, H.THEME)
                self.assertNotIn('A9', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_roof_rows_that_blow_past_the_measured_ratio_fail_a6(self):
        tall = {'id': 'tall', 'title': '', 'use': 'home', 'cols': 5, 'storeys': 1,
                'roof': 'roof.hip.tall', 'wall': 'wall.storey', 'walls': ['L M M W R']}
        res = AS.assemble(tall, H.parts('A'), PAL, H.THEME)
        self.assertIn('A6', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_roof_kinds_split_pitched_flat_and_spire(self):
        self.assertEqual(AS.roof_kind({'end': 2}), 'pitched')
        self.assertEqual(AS.roof_kind({'end': 1}), 'flat')
        self.assertEqual(AS.roof_kind({'end': 2, 'cone': True}), 'spire')
        self.assertEqual(AS.roof_kind({'spire': True}), 'spire')

if __name__ == '__main__':
    unittest.main()
