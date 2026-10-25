"""공유 지면선 시험 — 모든 질량이 같은 땅 행에 서고, 층 높이가 같고, 질량 밑에 땅이 비치지 않는다(A10).

사용자 반려(2026-10-22, beodeul-noble townhouse): 탑 질량의 바닥이 본채보다 12~30px 아래로 내려가 한 질량 밑에
잔디가 깔리고 층이 어긋났다. depth 는 앞뒤 순서만 정하고 세로로 밀지 않는다.
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import helpers as H  # noqa: E402

PAL = dot.palette(H.THEME)

def fails(res):
    return {c['code'] for c in AS.run_checks(res)}

def pair(**over):
    recipe = {
        'id': 'pair', 'title': '', 'use': 'home',
        'masses': [
            {'id': 'front', 'cols': 4, 'storeys': 1, 'x': 0, 'depth': 0, 'roof': 'roof.hip',
             'wall': 'wall.storey', 'walls': ['L W D R']},
            {'id': 'back', 'cols': 4, 'storeys': 2, 'x': 2, 'depth': 1, 'roof': 'roof.hip.tall',
             'wall': 'wall.stone', 'walls': ['L W M R', 'L W M R']},
        ],
    }
    recipe.update(over)
    return recipe

class GroundLineTest(unittest.TestCase):
    def test_depth_no_longer_shifts_a_mass_down(self):
        res = AS.assemble(pair(), H.parts('A'), PAL, H.THEME)
        self.assertNotIn('A10', fails(res), [c['msg'] for c in AS.run_checks(res)])
        a = np.array(res['img'].img())
        self.assertTrue((a[-1, :, 3] == 255).all(), '건물 맨 아래 행이 전폭 땅에 닿아야 한다')

    def test_every_mass_shares_one_ground_row(self):
        res = AS.assemble(pair(), H.parts('A'), PAL, H.THEME)
        a = np.array(res['img'].img())
        op = a[:, :, 3] == 255
        for m in res['masses']:
            x0, x1 = m['x'] * dot.T, (m['x'] + m['cols']) * dot.T
            rows = np.nonzero(op[:, x0:x1].any(axis=1))[0]
            self.assertEqual(int(rows.max()), res['height'] * dot.T - 1, m['id'])

    def test_a_mass_lifted_off_the_ground_fails_a10(self):
        op = np.zeros((5 * dot.T, 8 * dot.T), bool)
        op[:, :] = True
        op[4 * dot.T:, 4 * dot.T:] = False
        plans = [{'m': {'id': 'a'}, 'x': 0, 'cols': 4, 'walls': [{'h': 2}]},
                 {'m': {'id': 'b'}, 'x': 4, 'cols': 4, 'walls': [{'h': 2}]}]
        r = AS._a10(plans, op, 5)
        self.assertFalse(r['ok'])
        self.assertIn('빈 칸', r['msg'])

    def test_different_ground_rows_are_named(self):
        op = np.zeros((5 * dot.T, 8 * dot.T), bool)
        op[:, :] = True
        op[4 * dot.T:, 4 * dot.T:] = False
        op[3 * dot.T:4 * dot.T, 4 * dot.T:] = True
        plans = [{'m': {'id': 'a'}, 'x': 0, 'cols': 4, 'walls': [{'h': 2}]},
                 {'m': {'id': 'b'}, 'x': 4, 'cols': 4, 'walls': [{'h': 2}]}]
        r = AS._a10(plans, op, 5)
        self.assertFalse(r['ok'])
        self.assertIn('맨 아래 불투명 행이 다르다', r['msg'])

    def test_storey_height_must_be_two_cells(self):
        op = np.ones((5 * dot.T, 4 * dot.T), bool)
        plans = [{'m': {'id': 'a'}, 'x': 0, 'cols': 4, 'walls': [{'h': 3}]}]
        r = AS._a10(plans, op, 5)
        self.assertFalse(r['ok'])
        self.assertIn('층은 2칸', r['msg'])

    def test_storey_heights_must_match_across_masses(self):
        parts = H.parts('A')
        tall_wall = H.compose('wall.storey', 'A')
        a = np.zeros((tall_wall.height + 16, tall_wall.width, 4), np.uint8)
        a[:tall_wall.height] = np.array(tall_wall.convert('RGBA'))
        from PIL import Image
        it = dict(H.items()['wall.storey'], size=[5, 3])
        it['pieces'] = [dict(p, size=[p['size'][0], 3]) for p in H.items()['wall.storey']['pieces']]
        parts['wall.stone'] = {'item': it, 'img': Image.fromarray(a, 'RGBA')}
        res = AS.assemble(pair(), parts, PAL, H.THEME)
        self.assertIn('A10', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_a_mass_hanging_below_its_neighbours_is_caught(self):
        op = np.zeros((6 * dot.T, 8 * dot.T), bool)
        op[:5 * dot.T, :] = True
        op[5 * dot.T:, 4 * dot.T:] = True
        plans = [{'m': {'id': 'a'}, 'x': 0, 'cols': 4, 'walls': [{'h': 2}]},
                 {'m': {'id': 'b'}, 'x': 4, 'cols': 4, 'walls': [{'h': 2}]}]
        r = AS._a10(plans, op, 6)
        self.assertFalse(r['ok'], '탑 바닥이 본채보다 아래로 내려간 반려 사례를 잡아야 한다')

class SeedGroundLineTest(unittest.TestCase):
    def test_every_theme_r3_building_stands_on_one_ground_row(self):
        import harness
        for theme in dot.THEMES:
            rid = 'style-r3'
            mod, rendered = harness.render_round(theme, rid)
            parts = harness.parts_for(theme, rid, 'A', rendered)
            for recipe in AS.round_buildings(theme, rid):
                with self.subTest(theme=theme, building=recipe['id']):
                    res = AS.assemble(recipe, parts, dot.palette(theme), theme)
                    self.assertNotIn('A10', {c['code'] for c in AS.run_checks(res)},
                                     [c['msg'] for c in AS.run_checks(res)])

if __name__ == '__main__':
    unittest.main()
