"""2026-10-22 문법 개정 시험 — 기단 없는 접지 · 2칸 모임 지붕 끝 · 질량 합성 · 층별 벽 재질."""
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

PAL = dot.palette(H.THEME)
ITEMS = H.items()

def fails(res):
    return {c['code'] for c in AS.run_checks(res)}

def two_mass(**over):
    base = {
        'id': 'pair', 'title': '두 질량', 'use': 'home',
        'masses': [
            {'id': 'front', 'cols': 4, 'storeys': 1, 'x': 0, 'depth': 0, 'roof': 'roof.hip',
             'wall': 'wall.storey', 'walls': ['L W D R']},
            {'id': 'back', 'cols': 4, 'storeys': 1, 'x': 2, 'depth': 1, 'roof': 'roof.hip',
             'wall': 'wall.stone', 'walls': ['L W M R']},
        ],
    }
    base.update(over)
    return base

class NoBaseGroundingTest(unittest.TestCase):
    def test_wall_meets_ground_without_a_base_row(self):
        recipe = {'id': 'bare', 'title': '기단 없음', 'use': 'home', 'cols': 4, 'storeys': 1,
                  'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L W D R']}
        self.assertNotIn('base', recipe)
        res = AS.assemble(recipe, H.parts('A'), PAL, H.THEME)
        self.assertNotIn('A4', fails(res), [c['msg'] for c in AS.run_checks(res)])
        self.assertEqual(res['height'], 3 + 2)
        a = np.array(res['img'].img())
        self.assertTrue((a[-1, :, 3] == 255).all(), '건물 맨 아래 행이 땅에 닿아야 한다')

    def test_base_is_optional_and_adds_rows_when_asked(self):
        plain = {'id': 'p', 'title': '', 'use': 'home', 'cols': 4, 'storeys': 1,
                 'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L W D R']}
        podium = dict(plain, base='base.stone')
        parts = H.parts('A', extra=['base.stone'])
        a = AS.assemble(plain, parts, PAL, H.THEME)
        b = AS.assemble(podium, parts, PAL, H.THEME)
        self.assertEqual(b['height'], a['height'] + 1)
        self.assertNotIn('A4', fails(b), [c['msg'] for c in AS.run_checks(b)])

    def test_wall_lifted_off_the_ground_fails_a4(self):
        wall = H.compose('wall.storey', 'A')
        a = np.zeros((wall.height + 16, wall.width, 4), np.uint8)
        a[:wall.height] = np.array(wall.convert('RGBA'))
        it = dict(ITEMS['wall.storey'], size=[5, 3])
        it['pieces'] = [dict(p, size=[p['size'][0], 3]) for p in ITEMS['wall.storey']['pieces']]
        parts = H.parts('A', overrides={'wall.storey': Image.fromarray(a, 'RGBA')})
        parts['wall.storey']['item'] = it
        res = AS.assemble(H.buildings()['cottage'], parts, PAL, H.THEME)
        self.assertIn('A4', fails(res))

class HipRoofGeometryTest(unittest.TestCase):
    def test_roof_sets_declare_two_cell_ends(self):
        for item in ITEMS.values():
            if item['wave'] != 'roof':
                continue
            with self.subTest(item=item['id']):
                self.assertEqual(AS.roof_problems(item), [])

    def test_two_cell_ends_assemble_without_a2_or_a3(self):
        res = AS.assemble(H.buildings()['cottage'], H.parts('A'), PAL, H.THEME)
        codes = fails(res)
        self.assertNotIn('A2', codes, [c['msg'] for c in AS.run_checks(res)])
        self.assertNotIn('A3', codes, [c['msg'] for c in AS.run_checks(res)])
        self.assertEqual(res['width'], 4)
        roof = [p for p in res['pieces'] if p['kind'] == 'roof']
        self.assertEqual([(p['role'], p['size'][0]) for p in roof], [('l', 2), ('r', 2)])
        wide = AS.assemble({'id': 'w6', 'title': '', 'use': 'home', 'cols': 6, 'storeys': 1,
                           'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L M M M M R']},
                          H.parts('A'), PAL, H.THEME)
        self.assertEqual([(p['role'], p['size'][0]) for p in wide['pieces'] if p['kind'] == 'roof'],
                         [('l', 2), ('m', 1), ('m', 1), ('r', 2)])

    def test_roof_width_equals_wall_width_for_every_width(self):
        for cols in (4, 5, 6, 8):
            with self.subTest(cols=cols):
                recipe = {'id': f'w{cols}', 'title': '', 'use': 'home', 'cols': cols, 'storeys': 1,
                          'roof': 'roof.hip', 'wall': 'wall.storey',
                          'walls': ['L' + 'M' * (cols - 2) + 'R']}
                res = AS.assemble(recipe, H.parts('A'), PAL, H.THEME)
                self.assertNotIn('A3', fails(res), [c['msg'] for c in AS.run_checks(res)])
                self.assertEqual(res['width'], cols)

    def test_one_cell_ends_fail_roof_problems(self):
        item = dict(ITEMS['roof.hip'], size=[3, 3])
        item['pieces'] = [dict(p, at=[i, 0], size=[1, p['size'][1]]) for i, p in enumerate(ITEMS['roof.hip']['pieces'])]
        self.assertTrue(AS.roof_problems(item))

    def test_three_cell_building_is_refused(self):
        recipe = {'id': 'tiny', 'title': '', 'use': 'home', 'cols': 3, 'storeys': 1,
                  'roof': 'roof.hip', 'wall': 'wall.storey', 'walls': ['L D R']}
        res = AS.assemble(recipe, H.parts('A'), PAL, H.THEME)
        self.assertIn('A3', {c['code'] for c in res['checks'] if not c['ok']})

class MassingTest(unittest.TestCase):
    def setUp(self):
        self.parts = H.parts('A', extra=['base.stone'])

    def test_two_masses_compose_back_to_front(self):
        res = AS.assemble(two_mass(), self.parts, PAL, H.THEME)
        self.assertEqual([m['id'] for m in res['masses']], ['front', 'back'])
        self.assertEqual(res['width'], 6)
        self.assertEqual(res['height'], max(m['rows'] for m in res['masses']))
        front = next(m for m in res['masses'] if m['id'] == 'front')
        back = next(m for m in res['masses'] if m['id'] == 'back')
        self.assertEqual(back['top'], 0)
        self.assertEqual(front['top'], res['height'] - front['rows'])
        self.assertEqual(front['top'], back['top'], 'depth 는 세로로 밀지 않는다 — 같은 땅 행')

    def test_front_mass_pixels_win_where_masses_overlap(self):
        parts = H.parts('A')
        stone = np.array(parts['wall.stone']['img'].convert('RGBA'))
        res = AS.assemble(two_mass(), parts, PAL, H.THEME)
        a = np.array(res['img'].img())
        back = next(m for m in res['masses'] if m['id'] == 'back')
        front = next(m for m in res['masses'] if m['id'] == 'front')
        overlap_x = range(front['x'], back['x'] + back['cols'])
        front_y = front['top'] * dot.T
        back_y = back['top'] * dot.T
        x = overlap_x[0] * dot.T + dot.T // 2
        self.assertTrue((a[front_y:front_y + front['rows'] * dot.T, x, 3] == 255).all())
        self.assertFalse((a[back_y:back_y + back['rows'] * dot.T, x, :3] == stone[0, 0, :3]).all(),
                         '앞 질량이 덮은 자리에 뒤 질량 화소가 남으면 안 된다')

    def test_door_is_counted_across_all_masses(self):
        res = AS.assemble(two_mass(), self.parts, PAL, H.THEME)
        self.assertNotIn('A1', fails(res), [c['msg'] for c in AS.run_checks(res)])
        self.assertEqual(res['kit']['doorMass'], 'front')

    def test_two_doors_in_two_masses_fail_a1(self):
        recipe = two_mass()
        recipe['masses'][1]['walls'] = ['L W D R']
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A1', fails(res))

    def test_hidden_door_behind_a_front_mass_fails_a1(self):
        recipe = two_mass()
        recipe['masses'][0]['walls'] = ['L W M R']
        recipe['masses'][1]['walls'] = ['L W D R']
        recipe['masses'][1]['x'] = 0
        recipe['masses'][1]['cols'] = 4
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A1', fails(res), [c['msg'] for c in AS.run_checks(res)])

    def test_floating_masses_fail_a7(self):
        recipe = two_mass()
        recipe['masses'][1]['x'] = 6
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A7', fails(res))

    def test_masses_are_reported_by_validate_helper(self):
        recipe = two_mass()
        recipe['masses'][1]['x'] = 7
        self.assertTrue(AS.mass_problems(AS.masses(recipe)))
        recipe['masses'][1]['x'] = 2
        self.assertEqual(AS.mass_problems(AS.masses(recipe)), [])

    def test_plain_rectangle_silhouette_fails_a8(self):
        recipe = two_mass()
        for m in recipe['masses']:
            m['cols'] = 4
            m['storeys'] = 1
            m['depth'] = 0
            m['roof'] = 'roof.hip'
        recipe['masses'][1]['x'] = 4
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertIn('A8', fails(res))

    def test_single_mass_recipe_has_no_a8(self):
        res = AS.assemble(H.buildings()['cottage'], self.parts, PAL, H.THEME)
        self.assertNotIn('A8', fails(res))
        self.assertNotIn('A7', fails(res))

    def test_seed_recipes_with_masses_pass_every_check(self):
        for bid, recipe in H.round_buildings().items():
            with self.subTest(building=bid):
                res = AS.assemble(recipe, self.parts, PAL, H.THEME)
                self.assertEqual([c['msg'] for c in AS.run_checks(res)], [])

    def test_two_of_three_r3_buildings_are_multi_mass(self):
        recipes = H.round_buildings()
        self.assertGreaterEqual(len(recipes), 3)
        multi = [b for b in recipes.values() if len(b.get('masses') or []) > 1]
        self.assertGreaterEqual(len(multi), 2)

class StoreyMaterialTest(unittest.TestCase):
    def setUp(self):
        self.parts = H.parts('A')

    def test_per_storey_wall_items_assemble(self):
        recipe = {'id': 'innlike', 'title': '', 'use': 'inn', 'masses': [
            {'id': 'main', 'cols': 4, 'storeys': 2, 'x': 0, 'depth': 0, 'roof': 'roof.hip.tall',
             'walls': [{'item': 'wall.stone', 'letters': 'L W M R'}, {'item': 'wall.storey', 'letters': 'L W D R'}]},
        ]}
        res = AS.assemble(recipe, self.parts, PAL, H.THEME)
        self.assertEqual([c['msg'] for c in AS.run_checks(res)], [])
        walls = [p for p in res['pieces'] if p['kind'] == 'wall']
        self.assertEqual({p['item'] for p in walls}, {'wall.stone', 'wall.storey'})
        self.assertEqual(res['kit']['masses'][0]['walls'], ['wall.stone', 'wall.storey'])

    def test_inn_seed_uses_stone_ground_and_timber_upper(self):
        inn = H.round_buildings()['inn']
        walls = inn['masses'][0]['walls']
        self.assertEqual(walls[0]['item'], 'wall.timber')
        self.assertEqual(walls[1]['item'], 'wall.stone')
        self.assertEqual(walls[1]['letters'].replace(' ', '').count('D'), 1)

class SeedGrammarTest(unittest.TestCase):
    def test_every_theme_r3_has_three_buildings_and_two_multi_mass(self):
        for theme in dot.THEMES:
            recipes = AS.round_buildings(theme, 'style-r3')
            with self.subTest(theme=theme):
                self.assertGreaterEqual(len(recipes), 3)
                self.assertGreaterEqual(len([b for b in recipes if len(b.get('masses') or []) > 1]), 2)

    def test_every_theme_r3_recipe_has_geometry_that_can_pass(self):
        for theme in dot.THEMES:
            items = {it['id']: it for it in dot.seed(theme)['items']}
            for recipe in AS.round_buildings(theme, 'style-r3'):
                ms = AS.masses(recipe)
                with self.subTest(theme=theme, building=recipe['id']):
                    self.assertEqual(AS.mass_problems(ms), [])
                    self.assertTrue(any(m['depth'] == 0 for m in ms))
                    self.assertTrue(all(m['cols'] >= AS.MIN_COLS for m in ms))
                    self.assertEqual(AS.needed(recipe) - set(items), set())
                    for m in ms:
                        self.assertEqual(AS.roof_problems(items[m['roof']]), [])
                        doors = sum(r['letters'].replace(' ', '').count('D') for r in m['walls'])
                        self.assertLessEqual(doors, 1)
                    self.assertEqual(sum(r['letters'].replace(' ', '').count('D')
                                         for m in ms for r in m['walls']), 1)

    def test_no_r3_recipe_carries_a_pavement_base(self):
        for theme in dot.THEMES:
            for recipe in AS.round_buildings(theme, 'style-r3'):
                with self.subTest(theme=theme, building=recipe['id']):
                    self.assertFalse([m['id'] for m in AS.masses(recipe) if m.get('base')])

    def test_noble_refs_drop_the_broken_manor_and_porch(self):
        refs = dot.seed('beodeul-noble')['refs']
        kits = {r['kit'] for r in refs}
        self.assertNotIn('bd-house-manor', kits)
        self.assertNotIn('bd-mpart-porch', kits)
        self.assertIn('bd-mpart-tower', kits)
        self.assertIn('bd-house-h101_0', kits)

    def test_old_rounds_are_reported_as_superseded(self):
        for theme in dot.THEMES:
            rounds = dot.seed(theme)['rounds']
            for rid, rd in rounds.items():
                if rid in ('style-r3', 'style-r4', 'style-r5'):
                    continue
                with self.subTest(theme=theme, round=rid):
                    self.assertEqual(rd.get('superseded'), 'style-r3')

class SeedGrammarTest(unittest.TestCase):
    def test_every_theme_r3_has_three_buildings_and_two_multi_mass(self):
        for theme in dot.THEMES:
            recipes = AS.round_buildings(theme, 'style-r3')
            with self.subTest(theme=theme):
                self.assertGreaterEqual(len(recipes), 3)
                multi = [b for b in recipes if len(b.get('masses') or []) > 1]
                self.assertGreaterEqual(len(multi), 2, [b['id'] for b in recipes])

    def test_every_theme_r3_recipe_is_geometrically_assemblable(self):
        for theme in dot.THEMES:
            items = {it['id']: it for it in dot.seed(theme)['items']}
            for recipe in AS.round_buildings(theme, 'style-r3'):
                ms = AS.masses(recipe)
                with self.subTest(theme=theme, building=recipe['id']):
                    self.assertEqual(AS.mass_problems(ms), [])
                    self.assertTrue(any(m['depth'] == 0 for m in ms), '앞줄 질량이 없다')
                    self.assertTrue(all(m['cols'] >= AS.MIN_COLS for m in ms))
                    self.assertEqual(AS.needed(recipe) - set(items), set(), '없는 부품을 쓴다')
                    for m in ms:
                        self.assertEqual(AS.roof_problems(items[m['roof']]), [], m['roof'])
                        for row in m['walls']:
                            self.assertEqual(len(row['letters'].replace(' ', '')), m['cols'])
                    self.assertEqual(sum(r['letters'].replace(' ', '').count('D')
                                         for m in ms for r in m['walls']), 1)

    def test_no_r3_recipe_carries_a_pavement_base(self):
        for theme in dot.THEMES:
            for recipe in AS.round_buildings(theme, 'style-r3'):
                with self.subTest(theme=theme, building=recipe['id']):
                    self.assertFalse([m['id'] for m in AS.masses(recipe) if m.get('base')])

    def test_noble_refs_drop_the_broken_manor_and_porch(self):
        kits = {r['kit'] for r in dot.seed('beodeul-noble')['refs']}
        self.assertNotIn('bd-house-manor', kits)
        self.assertNotIn('bd-mpart-porch', kits)
        self.assertIn('bd-mpart-tower', kits)
        self.assertIn('bd-house-h101_0', kits)

    def test_old_rounds_are_marked_superseded(self):
        for theme in dot.THEMES:
            for rid, rd in dot.seed(theme)['rounds'].items():
                if rid in ('style-r3', 'style-r4', 'style-r5'):
                    continue
                with self.subTest(theme=theme, round=rid):
                    self.assertEqual(rd.get('superseded'), 'style-r3')

if __name__ == '__main__':
    unittest.main()