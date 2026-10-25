"""깨뜨린 표본이 각각 이름 붙은 관문에서 FAIL 하는지 — 관문이 실제로 잡는지 시험한다."""
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
import helpers as H  # noqa: E402

PAL = dot.palette(H.THEME)
ITEMS = H.items()


def codes(results, level='FAIL'):
    return {r['code'] for r in results if r['level'] == level and not r['ok']}


def with_piece(item_id, line, piece_id, rows):
    img = H.compose(item_id, line)
    it = ITEMS[item_id]
    pc = next(p for p in it['pieces'] if p['id'] == piece_id)
    leg = dot.legend(H.THEME, **H.LEGEND[line])
    a = np.array(img.convert('RGBA'))
    crop = np.array(dot.grid(rows, leg).img())
    x, y = pc['at'][0] * dot.T, pc['at'][1] * dot.T
    a[y:y + crop.shape[0], x:x + crop.shape[1]] = crop
    return Image.fromarray(a, 'RGBA')


def erase_rows(im, y0, y1, x0=None, x1=None):
    a = np.array(im.convert('RGBA')).copy()
    a[y0:y1, x0 if x0 is not None else 0:x1 if x1 is not None else a.shape[1], 3] = 0
    return Image.fromarray(a, 'RGBA')


class BrokenSetTest(unittest.TestCase):
    def test_off_palette_colour_fails_p(self):
        im = H.compose('base.stone', 'A')
        a = np.array(im.convert('RGBA'))
        a[4, 4] = [255, 0, 255, 255]
        bad = Image.fromarray(a, 'RGBA')
        self.assertIn('P', codes(G.check_item(ITEMS['base.stone'], bad, PAL, {})))

    def test_translucent_non_shadow_fails_p(self):
        im = H.compose('base.stone', 'A')
        a = np.array(im.convert('RGBA'))
        a[3, 3] = [12, 14, 20, 200]
        bad = Image.fromarray(a, 'RGBA')
        self.assertIn('P', codes(G.check_item(ITEMS['base.stone'], bad, PAL, {})))

    def test_wrong_piece_size_fails_z(self):
        im = H.compose('wall.storey', 'A')
        bad = im.crop((0, 0, im.width, im.height - 16))
        self.assertIn('Z', codes(G.check_item(ITEMS['wall.storey'], bad, PAL, {})))

    def test_hole_in_wall_fails_q(self):
        im = H.compose('wall.storey', 'A')
        bad = erase_rows(im, 8, 12, 0, 8)
        self.assertIn('Q', codes(G.check_item(ITEMS['wall.storey'], bad, PAL, {})))

    def test_thin_roof_fails_f(self):
        it = dict(ITEMS['roof.hip'])
        it['pieces'] = [dict(p, top=[0, 0]) if p['id'] == 'm' else dict(p) for p in ITEMS['roof.hip']['pieces']]
        bad = H.compose('roof.hip', 'A')
        self.assertIn('F', codes(G.check_item(it, bad, PAL, {})))

    def test_dark_top_band_fails_f(self):
        im = H.compose('roof.hip', 'A')
        a = np.array(im.convert('RGBA'))
        a[0:32, :, :3] = dot.C(H.THEME, 'roof', 0)
        dark = Image.fromarray(a, 'RGBA')
        self.assertIn('F', codes(G.check_item(ITEMS['roof.hip'], dark, PAL, {})))

    def test_hard_wrap_seam_fails_s(self):
        rows = []
        for r in H.WALLS['A']['m']:
            rows.append('o' + r[1:-1] + 'p')
        bad = with_piece('wall.storey', 'A', 'm', rows)
        self.assertIn('S', codes(G.check_item(ITEMS['wall.storey'], bad, PAL, {})))

    def test_floating_foundation_fails_g(self):
        im = H.compose('base.stone', 'A')
        a = np.zeros_like(np.array(im.convert('RGBA')))
        a[:15] = np.array(im.convert('RGBA'))[:15]
        bad = Image.fromarray(a, 'RGBA')
        self.assertIn('G', codes(G.check_item(ITEMS['base.stone'], bad, PAL, {})))

    def test_mismatched_join_fails_j(self):
        a = np.zeros((16, 48, 4), np.uint8)
        a[:, :] = dot.C(H.THEME, 'stone', 4) + (255,)
        a[:, 32:] = dot.C(H.THEME, 'stone', 1) + (255,)
        bad = Image.fromarray(a, 'RGBA')
        self.assertIn('J', codes(G.check_item(ITEMS['base.stone'], bad, PAL, {})))

    def test_ink_outline_warns(self):
        rows = list(H.BASES['A'])
        rows[2] = 'o' * dot.T
        rows[15] = 'o' * dot.T
        bad = with_piece('base.stone', 'A', 'l', rows[:16])
        warns = codes(G.check_item(ITEMS['base.stone'], bad, PAL, {}), 'WARN')
        self.assertIn('OUTLINE', warns)

    def test_noise_pixels_warn(self):
        im = H.compose('base.stone', 'A')
        a = np.array(im.convert('RGBA'))
        cols = [dot.C(H.THEME, 'stone', i) + (255,) for i in (0, 5)]
        for y in range(3, 15, 2):
            for x in range(2, 14, 2):
                a[y, x] = cols[(x + y) % 2]
        bad = Image.fromarray(a, 'RGBA')
        self.assertIn('N', codes(G.check_item(ITEMS['base.stone'], bad, PAL, {}), 'WARN'))

    def test_recolor_pair_fails_r(self):
        im = H.parts('A')['roof.hip']['img']
        rc = G.check_recolor({'A': im, 'B': im.copy()})
        self.assertFalse(rc['A']['ok'])
        self.assertFalse(rc['B']['ok'])


class BrokenAssemblyTest(unittest.TestCase):
    def setUp(self):
        self.parts = H.parts('A')

    def test_two_doors_fails_a1(self):
        recipe = dict(H.buildings()['cottage'], walls=['D D D'])
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A1', codes(res['checks']))

    def test_roof_wall_gap_fails_a2(self):
        roof = erase_rows(self.parts['roof.hip']['img'], 46, 48)
        parts = dict(self.parts, **{'roof.hip': dict(self.parts['roof.hip'], img=roof)})
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A2', codes(res['checks']))

    def test_roof_overhang_too_wide_fails_a3(self):
        res = AS.assemble(dict(H.buildings()['cottage'], overhang=3), self.parts, PAL, H.THEME)
        self.assertIn('A3', codes(res['checks']))

    def test_wall_not_on_ground_fails_a4(self):
        wall = H.compose('wall.storey', 'A')
        a = np.zeros((wall.height + 16, wall.width, 4), np.uint8)
        a[:wall.height] = np.array(wall.convert('RGBA'))
        it = dict(ITEMS['wall.storey'], size=[5, 3])
        it['pieces'] = [dict(p, size=[p['size'][0], 3]) for p in ITEMS['wall.storey']['pieces']]
        parts = dict(self.parts, **{'wall.storey': {'item': it, 'img': Image.fromarray(a, 'RGBA')}})
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A4', codes(res['checks']))

    def test_thin_roof_ratio_fails_a6(self):
        it = dict(ITEMS['roof.hip'], size=[5, 1])
        it['pieces'] = [dict(p, size=[p['size'][0], 1]) for p in ITEMS['roof.hip']['pieces']]
        thin = self.parts['roof.hip']['img'].crop((0, 32, 80, 48))
        parts = dict(self.parts, **{'roof.hip': {'item': it, 'img': thin}})
        recipe = {'id': 'tall', 'title': '', 'use': 'home', 'cols': 4, 'storeys': 3,
                  'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L W M R', 'L W M R', 'L W D R']}
        res = AS.assemble(recipe, parts, PAL, H.THEME)
        self.assertIn('A6', codes(res['checks']))

    def test_one_cell_roof_ends_fail_a3(self):
        it = dict(ITEMS['roof.hip'], size=[3, 3])
        it['pieces'] = [dict(p, at=[i, 0], size=[1, 3]) for i, p in enumerate(ITEMS['roof.hip']['pieces'])]
        narrow = H.compose('roof.hip', 'A').crop((0, 0, 48, 48))
        parts = dict(self.parts, **{'roof.hip': {'item': it, 'img': narrow}})
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A3', codes(res['checks']))

    def test_wrong_row_length_reports_a0(self):
        recipe = dict(H.buildings()['cottage'], walls=['L D'])
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A0', codes(res['checks']))

    def test_broken_wall_rows_break_the_join(self):
        wall = self.parts['wall.storey']['img']
        a = np.array(wall.convert('RGBA'))
        a[0:2, :, :3] = dot.C(H.THEME, 'plaster', 4)
        parts = H.parts('A', overrides={'wall.storey': Image.fromarray(a, 'RGBA')})
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A5', codes(res['checks']))


if __name__ == '__main__':
    unittest.main()
