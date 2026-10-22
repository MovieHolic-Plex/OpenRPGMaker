"""박공 정면 투영 문법 시험(style-r5) — gable_front·lean_to 조립, 골, 용마루·사면 빛(A12), 지붕 만남(A13),
지붕 위 부속(A14), requireGableFront(A15), 투영 안내도, flat_elevation 함정, 그리기 기본 모델. 모델 호출 없음."""
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

import assemble as AS  # noqa: E402
import dot  # noqa: E402
import gate as G  # noqa: E402
import helpers as H  # noqa: E402
import projection  # noqa: E402

PAL = dot.palette(H.THEME)
ITEMS = H.items()
R5 = 'style-r5'


def r5_parts(line='A', overrides=None):
    out = {i: {'item': ITEMS[i], 'img': H.compose(i, line)} for i in dot.seed(H.THEME)['rounds'][R5]['items']}
    for i, im in (overrides or {}).items():
        out[i] = {'item': ITEMS[i], 'img': im}
    return out


def fails(res):
    return {c['code'] for c in AS.run_checks(res)}


def msgs(res):
    return [f'{c["code"]} {c["msg"]}' for c in AS.run_checks(res)]


def r5(bid):
    return next(b for b in AS.round_buildings(H.THEME, R5) if b['id'] == bid)


def cottage(**over):
    m = {'id': 'house', 'kind': 'gable_front', 'cols': 4, 'depth_rows': 3, 'storeys': 1, 'x': 0, 'depth': 0,
         'gable': 'gable.front', 'roof': 'roof.gf.slope', 'back': 'roof.gf.back',
         'walls': [{'item': 'wall.timber', 'letters': 'L W D R'}]}
    m.update(over)
    return {'id': 'c', 'title': '', 'use': 'home', 'masses': [m]}


def edit_piece(item_id, role, fn, line='A'):
    """세트 그림에서 조각 하나의 화소를 fn(a) 로 고친 새 세트 그림."""
    im = H.compose(item_id, line)
    a = np.array(im.convert('RGBA'))
    pc = next(p for p in ITEMS[item_id]['pieces'] if p['role'] == role)
    x0, y0 = pc['at'][0] * dot.T, pc['at'][1] * dot.T
    sub = a[y0:y0 + pc['size'][1] * dot.T, x0:x0 + pc['size'][0] * dot.T]
    fn(sub)
    return Image.fromarray(a, 'RGBA')


class GableFrontAssemblyTest(unittest.TestCase):
    def test_body_roles_put_the_ridge_in_the_middle(self):
        self.assertEqual(AS.gf_body_roles(2), ['k2'])
        self.assertEqual(AS.gf_body_roles(3), ['l', 'k', 'r'])
        self.assertEqual(AS.gf_body_roles(4), ['l', 'k2', 'r'])
        self.assertEqual(AS.gf_body_roles(5), ['l', 'ml', 'k', 'mr', 'r'])
        self.assertEqual(AS.gf_body_roles(6), ['l', 'ml', 'k2', 'mr', 'r'])
        self.assertEqual(AS.lean_body_roles(3, 'right'), ['hi', 'm', 'lo'])
        self.assertEqual(AS.lean_body_roles(2, 'left'), ['lo', 'hi'])

    def test_gable_front_stacks_back_slopes_front_walls(self):
        res = AS.assemble(cottage(), r5_parts(), PAL, H.THEME)
        self.assertEqual(msgs(res), [])
        roof = [p for p in res['pieces'] if p['kind'] == 'roof']
        self.assertEqual(roof[0]['piece'], 'b4')
        self.assertEqual(roof[0]['at'], [0, 0])
        self.assertEqual([p['piece'] for p in roof[1:4]], ['l', 'k2', 'r'])
        self.assertEqual(sum(1 for p in roof if p['piece'] == 'k2'), 3, 'depth_rows 3 → 사면 띠 3행')
        front = next(p for p in roof if p['piece'] == 'g4')
        wall_y = min(p['at'][1] for p in res['pieces'] if p['kind'] == 'wall')
        self.assertEqual(front['at'][1] + front['size'][1], wall_y, '앞 박공 바로 아래가 벽')
        self.assertEqual(res['height'], 2 + 3 + 2 + 2)
        self.assertEqual(res['masses'][0]['kind'], 'gable_front')

    def test_every_r5_recipe_assembles_clean_with_fixture_parts(self):
        for recipe in AS.round_buildings(H.THEME, R5):
            with self.subTest(building=recipe['id']):
                res = AS.assemble(recipe, r5_parts(), PAL, H.THEME)
                self.assertEqual(msgs(res), [])
                codes = {c['code'] for c in res['checks']}
                self.assertTrue({'A12', 'A13', 'A15'} <= codes, codes)

    def test_receding_ratio_band_replaces_the_hip_band(self):
        res = AS.assemble(cottage(), r5_parts(), PAL, H.THEME)
        a6 = next(c for c in res['checks'] if c['code'] == 'A6')
        self.assertIn('0.50~0.85', a6['msg'])
        wide = AS.assemble(cottage(cols=7, walls=[{'item': 'wall.timber', 'letters': 'L W M D M W R'}]),
                           r5_parts(), PAL, H.THEME)
        self.assertIn('A0', fails(wide), '7칸 박공 정면 조각(g7)은 없다')

    def test_out_of_range_depth_fails_a3(self):
        res = AS.assemble(cottage(depth_rows=1), r5_parts(), PAL, H.THEME)
        self.assertIn('A3', fails(res))

    def test_back_and_front_pitch_must_match(self):
        it = json.loads(json.dumps(ITEMS['roof.gf.back']))
        img = H.compose('roof.gf.back', 'A')
        parts = r5_parts()
        recipe = cottage(cols=3, walls=[{'item': 'wall.timber', 'letters': 'L D R'}])
        recipe['masses'][0]['back_end'] = 'valley'
        it['pieces'][1]['role'] = 'b3'
        parts['roof.gf.back'] = {'item': it, 'img': img}
        recipe['masses'][0]['back_end'] = 'gable'
        recipe['masses'][0]['gable'] = 'gable.front'
        res = AS.assemble(recipe, parts, PAL, H.THEME)
        self.assertNotIn('A3', fails(res), msgs(res))
        recipe2 = cottage(cols=4)
        parts2 = r5_parts()
        it2 = json.loads(json.dumps(ITEMS['gable.front']))
        it2['pieces'][1]['size'] = [4, 1]
        parts2['gable.front'] = {'item': it2, 'img': H.compose('gable.front', 'A')}
        res2 = AS.assemble(recipe2, parts2, PAL, H.THEME)
        self.assertIn('A3', fails(res2), '뒤 끝 2행 ≠ 앞 박공 1행')

    def test_lean_to_low_side_must_match_the_set(self):
        recipe = r5('hall.r5')
        recipe = json.loads(json.dumps(recipe))
        recipe['masses'][1]['low'] = 'left'
        res = AS.assemble(recipe, r5_parts(), PAL, H.THEME)
        self.assertIn('A3', fails(res))


class RidgeAndLightTest(unittest.TestCase):
    def test_ridge_report_measures_a_continuous_centre_line(self):
        res = AS.assemble(cottage(), r5_parts(), PAL, H.THEME)
        a12 = next(c for c in res['checks'] if c['code'] == 'A12')
        self.assertTrue(a12['ok'], a12['msg'])

    def test_ridge_blending_into_the_slopes_fails_a12(self):
        def blend(sub):
            c = sub.shape[1] // 2
            sub[5, c - 1] = sub[5, c - 3]
            sub[5, c] = sub[5, c + 2]
        parts = r5_parts(overrides={'roof.gf.slope': edit_piece('roof.gf.slope', 'k2', blend)})
        res = AS.assemble(cottage(), parts, PAL, H.THEME)
        self.assertIn('A12', fails(res))
        self.assertIn('구분되지 않는', next(c['msg'] for c in res['checks'] if c['code'] == 'A12'))

    def test_transparent_hole_in_the_ridge_fails_a12(self):
        def hole(sub):
            c = sub.shape[1] // 2
            sub[3, c - 1:c + 1, 3] = 0
        parts = r5_parts(overrides={'roof.gf.slope': edit_piece('roof.gf.slope', 'k2', hole)})
        res = AS.assemble(cottage(), parts, PAL, H.THEME)
        self.assertIn('A12', fails(res))

    def test_back_apex_off_the_ridge_fails_a12(self):
        def sink_apex(sub):
            c = sub.shape[1] // 2
            sub[0:4, c - 1:c + 1, 3] = 0
        parts = r5_parts(overrides={'roof.gf.back': edit_piece('roof.gf.back', 'b4', sink_apex)})
        res = AS.assemble(cottage(), parts, PAL, H.THEME)
        self.assertIn('A12', fails(res))

    def test_right_lit_slopes_fail_a12(self):
        def mirror(sub):
            sub[:] = sub[:, ::-1].copy()
        im = H.compose('roof.gf.slope', 'A')
        a = np.array(im.convert('RGBA'))
        it = ITEMS['roof.gf.slope']
        by = {p['role']: p for p in it['pieces']}
        crops = {r: a[0:16, p['at'][0] * 16:(p['at'][0] + p['size'][0]) * 16].copy() for r, p in by.items()}
        for r, p in by.items():
            src = {'l': 'r', 'r': 'l', 'ml': 'mr', 'mr': 'ml'}.get(r, r)
            sub = crops[src].copy()
            mirror(sub)
            a[0:16, p['at'][0] * 16:(p['at'][0] + p['size'][0]) * 16] = sub
        parts = r5_parts(overrides={'roof.gf.slope': Image.fromarray(a, 'RGBA')})
        res = AS.assemble(cottage(), parts, PAL, H.THEME)
        self.assertIn('A12', fails(res))
        self.assertIn('왼쪽이', next(c['msg'] for c in res['checks'] if c['code'] == 'A12'))


class ValleyTest(unittest.TestCase):
    def test_l_house_valley_meets_the_main_roof_with_wing_pixels(self):
        res = AS.assemble(r5('lhouse.r5'), r5_parts(), PAL, H.THEME)
        self.assertEqual(msgs(res), [])
        a13 = next(c for c in res['checks'] if c['code'] == 'A13')
        self.assertIn('골', a13['msg'])
        wing = next(p for p in res['pieces'] if p['mass'] == 'wing' and p['piece'] == 'v3')
        main_roof = [p for p in res['pieces'] if p['mass'] == 'main' and p['kind'] == 'roof']
        order = res['pieces'].index
        self.assertTrue(all(order(m) < order(wing) for m in main_roof), '뒤 질량부터, 골은 앞 날개가 나중에 덮는다')

    def test_valley_with_sky_above_fails_a13(self):
        recipe = json.loads(json.dumps(r5('lhouse.r5')))
        recipe['masses'][1]['depth_rows'] = 4
        recipe['masses'][1]['x'] = 0
        res = AS.assemble(recipe, r5_parts(), PAL, H.THEME)
        self.assertIn('A13', fails(res), msgs(res))

    def test_free_back_gable_buried_in_a_roof_fails_a13(self):
        recipe = json.loads(json.dumps(r5('lhouse.r5')))
        recipe['masses'][1]['back_end'] = 'gable'
        parts = r5_parts()
        it = json.loads(json.dumps(ITEMS['roof.gf.back']))
        it['pieces'][1]['role'] = 'b3'
        parts['roof.gf.back'] = {'item': it, 'img': parts['roof.gf.back']['img']}
        res = AS.assemble(recipe, parts, PAL, H.THEME)
        self.assertIn('A13', fails(res))
        self.assertIn('valley', next(c['msg'] for c in res['checks'] if c['code'] == 'A13'))


class RoofExtraTest(unittest.TestCase):
    def test_chimney_on_the_roof_passes_and_rises_above(self):
        res = AS.assemble(r5('lhouse.r5'), r5_parts(), PAL, H.THEME)
        a14 = next(c for c in res['checks'] if c['code'] == 'A14')
        self.assertTrue(a14['ok'], a14['msg'])
        chim = next(p for p in res['pieces'] if p['kind'] == 'extra')
        self.assertEqual(chim['at'][1], 0)
        main = next(m for m in res['masses'] if m['id'] == 'main')
        self.assertEqual(main['top'], 1, '굴뚝이 1칸 솟아 그림이 1행 커진다')

    def test_chimney_hanging_on_the_wall_fails_a14(self):
        recipe = json.loads(json.dumps(r5('lhouse.r5')))
        recipe['masses'][0]['extras'][0]['at'] = [0, 4]
        res = AS.assemble(recipe, r5_parts(), PAL, H.THEME)
        self.assertIn('A14', fails(res))

    def test_dormer_extra_anchors_on_a_gable_front_slope(self):
        dormer = {'id': 'extra.dormer', 'wave': 'extra', 'kind': 'set', 'title': '지붕창', 'size': [1, 2],
                  'pieces': [{'id': 'c', 'role': 'c', 'at': [0, 0], 'size': [1, 2], 'kind': 'extra'}]}
        parts = r5_parts()
        parts['extra.dormer'] = {'item': dormer, 'img': H.compose('extra.chimney', 'A')}
        recipe = cottage(extras=[{'part': 'extra.dormer', 'at': [0, 2], 'on': 'roof'}])
        res = AS.assemble(recipe, parts, PAL, H.THEME)
        self.assertNotIn('A14', fails(res), msgs(res))


class RequireGableFrontTest(unittest.TestCase):
    def flat(self):
        return {'id': 'flat', 'title': '', 'use': 'home', 'masses': [
            {'id': 'm', 'cols': 5, 'storeys': 1, 'x': 0, 'depth': 0, 'roof': 'roof.hip',
             'walls': [{'item': 'wall.timber', 'letters': 'L W D W R'}]}]}

    def test_round_buildings_carry_the_flag_only_for_r5(self):
        self.assertTrue(AS.requires_gable_front(H.THEME, R5))
        self.assertFalse(AS.requires_gable_front(H.THEME, 'style-r3'))
        self.assertTrue(all(b.get('_requireGableFront') for b in AS.round_buildings(H.THEME, R5)))
        self.assertFalse(any(b.get('_requireGableFront') for b in AS.round_buildings(H.THEME, 'style-r3')))

    def test_ridge_parallel_only_recipe_fails_a15_when_required(self):
        res = AS.assemble(self.flat(), r5_parts(), PAL, H.THEME, require_gable_front=True)
        self.assertIn('A15', fails(res))
        res = AS.assemble(dict(self.flat(), _requireGableFront=True), r5_parts(), PAL, H.THEME)
        self.assertIn('A15', fails(res))
        res = AS.assemble(self.flat(), r5_parts(), PAL, H.THEME)
        self.assertNotIn('A15', {c['code'] for c in res['checks']})

    def test_validate_reports_a_round_recipe_without_gable_front(self):
        import harness
        s = json.loads(json.dumps(dot.seed(H.THEME)))
        s['buildings'].append(self.flat())
        s['rounds'][R5]['buildings'].append('flat')
        errs = harness._gable_front_round(s, {it['id']: it for it in s['items']}, R5)
        self.assertTrue(any('gable_front 질량이 없다' in e for e in errs), errs)
        self.assertEqual(harness._gable_front_round(dot.seed(H.THEME), ITEMS, R5), [])

    def test_validate_requires_on_roof_for_r5_extras(self):
        import harness
        s = json.loads(json.dumps(dot.seed(H.THEME)))
        lh = next(b for b in s['buildings'] if b['id'] == 'lhouse.r5')
        lh['masses'][0]['extras'][0].pop('on')
        errs = harness._gable_front_round(s, ITEMS, R5)
        self.assertTrue(any('on: "roof"' in e for e in errs), errs)

    def test_every_r5_theme_recipe_has_a_gable_front_and_valid_contract(self):
        import harness
        for theme in ('fantasy-kingdom', 'northern-snow', 'beodeul-noble'):
            s = dot.seed(theme)
            items = {it['id']: it for it in s['items']}
            self.assertTrue(s['rounds'][R5]['requireGableFront'])
            self.assertEqual(harness._gable_front_round(s, items, R5), [], theme)
            for recipe in AS.round_buildings(theme, R5):
                ms = AS.masses(recipe)
                with self.subTest(theme=theme, building=recipe['id']):
                    self.assertTrue(any(m['kind'] == 'gable_front' for m in ms))
                    self.assertEqual(AS.mass_problems(ms), [])
                    for m in ms:
                        if m['kind'] in AS.RECEDING:
                            self.assertEqual(harness._receding_problems(m['id'], m, items), [])
                    for m in ms:
                        if m['kind'] == 'gable_front' and m.get('back_end') == 'valley':
                            behind = [o for o in ms if o['depth'] > m['depth']]
                            self.assertTrue(behind)
                            self.assertLess(AS.mass_rows(m, items), max(AS.mass_rows(o, items) for o in behind),
                                            '골 날개 꼭대기가 본채 지붕 안에 있어야 한다')
            self.assertEqual({b['id'] for b in AS.round_buildings(theme, R5)} >= {'cottage.r5', 'lhouse.r5', 'hall.r5'}, True)
        self.assertIn('townhouse.r5', {b['id'] for b in AS.round_buildings('beodeul-noble', R5)})


class PieceGateTest(unittest.TestCase):
    def test_new_piece_kinds_pass_their_own_contracts(self):
        for item_id in ('gable.front', 'gable.step', 'roof.gf.slope', 'roof.gf.back', 'roof.lean.side'):
            with self.subTest(item=item_id):
                rs = G.check_item(ITEMS[item_id], H.compose(item_id, 'A'), PAL)
                bad = [f'{r["code"]} {r["msg"]}' for r in rs if r['level'] == 'FAIL' and not r['ok']]
                self.assertEqual(bad, [])
                self.assertEqual(AS.roof_problems(ITEMS[item_id]), [])

    def test_slope_with_a_hole_and_roofend_without_apex_fail_q(self):
        def hole(sub):
            sub[4, 4, 3] = 0
        im = edit_piece('roof.gf.slope', 'ml', hole)
        rs = G.check_item(ITEMS['roof.gf.slope'], im, PAL)
        self.assertFalse(next(r for r in rs if r['code'] == 'Q')['ok'])

        def fill(sub):
            sub[:, :, :] = sub[-1:, :, :]
        im = edit_piece('roof.gf.back', 'b4', fill)
        rs = G.check_item(ITEMS['roof.gf.back'], im, PAL)
        self.assertFalse(next(r for r in rs if r['code'] == 'Q')['ok'])

    def test_form_problems_catch_width_mismatch(self):
        it = json.loads(json.dumps(ITEMS['gable.front']))
        it['pieces'][0]['size'] = [4, 1]
        self.assertTrue(any('g3' in why for why in AS.roof_problems(it)))


class ProjectionGuideTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-proj-')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_guides_are_written_grey_and_on_the_cell_grid(self):
        paths = projection.write_guides(self.tmp)
        names = sorted(os.path.basename(p) for p in paths)
        self.assertEqual(names, ['projection-gable-front-1x.png', 'projection-gable-front-4x.png',
                                 'projection-l-combo-1x.png', 'projection-l-combo-4x.png'])
        for p in paths:
            a = np.array(Image.open(p).convert('RGB')).astype(int)
            self.assertEqual(int(np.abs(a[:, :, 0] - a[:, :, 1]).max() + np.abs(a[:, :, 1] - a[:, :, 2]).max()), 0, p)
            if p.endswith('-1x.png'):
                self.assertEqual((a.shape[0] % dot.T, a.shape[1] % dot.T), (0, 0))

    def test_gable_front_guide_has_vertical_ridge_and_lit_left_slope(self):
        a = np.array(projection.render('gable-front').convert('L')).astype(int)
        ridge = projection.TONE['ridge']
        cols = np.nonzero((a == ridge).sum(axis=0) > 3 * dot.T)[0]
        self.assertEqual(len(cols), 2, '용마루는 2px 세로선')
        rows = np.nonzero(a[:, cols[0]] == ridge)[0]
        self.assertEqual(int(rows.max() - rows.min() + 1), len(rows), '용마루가 끊기지 않는다')
        self.assertGreater((a == projection.TONE['slope_l']).sum(), 0)
        self.assertGreater(projection.TONE['slope_l'], projection.TONE['slope_r'])
        left = a[:, :cols[0]]
        right = a[:, cols[1] + 1:]
        self.assertGreater((left == projection.TONE['slope_l']).sum(), 0)
        self.assertEqual((left == projection.TONE['slope_r']).sum(), 0)
        self.assertGreater((right == projection.TONE['slope_r']).sum(), 0)

    def test_l_combo_guide_shows_a_valley_and_a_chimney(self):
        a = np.array(projection.render('l-combo').convert('L')).astype(int)
        self.assertGreater((a == projection.TONE['valley']).sum(), 0)
        self.assertGreater((a == projection.TONE['chimney_top']).sum(), 0)
        self.assertGreater((a == projection.TONE['hip_top']).sum(), 0)


class ReviewProbeTest(unittest.TestCase):
    def setUp(self):
        import review
        self.review = review
        self.tmp = tempfile.mkdtemp(prefix='bk-r5review-')
        self._runs = dot.RUNS
        dot.RUNS = self.tmp

    def tearDown(self):
        dot.RUNS = self._runs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_flat_elevation_is_built_from_the_candidate_parts(self):
        parts = r5_parts()
        im = self.review.flat_elevation(parts, PAL, H.THEME)
        self.assertIsNotNone(im)
        own = set()
        for p in parts.values():
            a = np.array(p['img'].convert('RGBA'))
            own |= {tuple(int(v) for v in c) for c in a[a[:, :, 3] == 255][:, :3]}
        a = np.array(im.convert('RGBA'))
        probe = {tuple(int(v) for v in c) for c in a[a[:, :, 3] == 255][:, :3]}
        self.assertTrue(probe <= own, '함정은 후보 자기 부품 화소로만 만든다')
        res = AS.assemble({'id': 'p', 'masses': [{'id': 'm', 'cols': 6, 'storeys': 1, 'x': 0, 'depth': 0,
                                                  'roof': 'roof.hip', 'walls': [{'item': 'wall.stone', 'letters': 'L W M D W R'}]}]},
                          parts, PAL, H.THEME, require_gable_front=True)
        self.assertIn('A15', fails(res))

    def test_r5_board_has_the_flat_elevation_probe_and_the_rule(self):
        prep = self.review.prepare(H.THEME, R5, {'A': r5_parts('A')}, seed=3)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        names = {v['name'] for v in key.values() if v['kind'] == 'probe'}
        self.assertEqual(names, set(self.review.PROBE_NAMES) | {'flat_elevation'})
        self.assertIn('GABLE-FRONT PROJECTION RULE', prep['prompt'])
        self.assertIn('VERTICAL line', prep['prompt'])

    def test_r3_board_is_unchanged(self):
        prep = self.review.prepare(H.THEME, H.ROUND, {'A': H.parts('A')}, seed=3)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        self.assertNotIn('flat_elevation', {v['name'] for v in key.values()})
        self.assertNotIn('GABLE-FRONT', prep['prompt'])

    def test_passing_the_flat_elevation_probe_voids_the_run(self):
        prep = self.review.prepare(H.THEME, R5, {'A': r5_parts('A')}, seed=4)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        lines = []
        for sid, k in key.items():
            v = 'PASS' if (k['kind'] == 'candidate' or k['name'] == 'flat_elevation') else 'FAIL'
            lines.append(json.dumps({'id': sid, 'view34': v, 'quality': v, 'reason': k['name']}))
        agg = self.review.score(H.THEME, R5, prep['run'], '\n'.join(lines), 'fake/judge')
        self.assertEqual(agg['valid'], 0)
        self.assertTrue(any('flat_elevation' in v for v in agg['voids']))


class DrawerDefaultsTest(unittest.TestCase):
    def setUp(self):
        import drawer
        self.drawer = drawer
        self.tmp = tempfile.mkdtemp(prefix='bk-r5draw-')
        self._data, self._sandbox = dot.DATA, drawer.SANDBOX
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(self.tmp, 'data', H.THEME))
        dot.DATA = os.path.join(self.tmp, 'data')
        drawer.SANDBOX = os.path.join(self.tmp, 'sandbox')
        dot._PAL.clear()
        seed_path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(seed_path, encoding='utf-8'))
        for rid in (R5, H.ROUND):
            mod = os.path.join(self.tmp, f'round_{rid}.py')
            open(mod, 'w', encoding='utf-8').write('CANDIDATES = {}\n')
            s['rounds'][rid]['module'] = mod
        json.dump(s, open(seed_path, 'w', encoding='utf-8'), ensure_ascii=False)

    def tearDown(self):
        dot.DATA, self.drawer.SANDBOX = self._data, self._sandbox
        dot._PAL.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_default_model_is_opus_5_5_high(self):
        cmd = self.drawer.claude_command('/tmp/sb')
        self.assertEqual(cmd[cmd.index('--model') + 1], os.environ.get('BUILDING_KIT_DRAWER_MODEL', 'claude-opus-5-5'))
        self.assertEqual(cmd[cmd.index('--effort') + 1], os.environ.get('BUILDING_KIT_DRAWER_EFFORT', 'high'))
        cmd = self.drawer.claude_command('/tmp/sb', model='m', effort='low')
        self.assertEqual((cmd[cmd.index('--model') + 1], cmd[cmd.index('--effort') + 1]), ('m', 'low'))

    def test_env_overrides_the_drawer_model(self):
        import importlib
        old = dict(os.environ)
        try:
            os.environ['BUILDING_KIT_DRAWER_MODEL'] = 'x-model'
            os.environ['BUILDING_KIT_DRAWER_EFFORT'] = 'medium'
            mod = importlib.reload(self.drawer)
            self.assertEqual((mod.MODEL, mod.EFFORT), ('x-model', 'medium'))
        finally:
            os.environ.clear()
            os.environ.update(old)
            importlib.reload(self.drawer)
            self.drawer.SANDBOX = os.path.join(self.tmp, 'sandbox')

    def test_r5_sandbox_gets_projection_guides_and_brief(self):
        path = self.drawer.sandbox_for(H.THEME, R5, 'A')
        for name in projection.NAMES:
            for s in ('1x', '4x'):
                self.assertTrue(os.path.exists(os.path.join(path, 'refs', f'projection-{name}-{s}.png')))
        self.assertFalse([f for f in os.listdir(os.path.join(path, 'refs')) if 'user' in f or 'angle' in f])
        s = dot.seed(H.THEME)
        items = [it for it in s['items'] if it['id'] in s['rounds'][R5]['items']]
        text = self.drawer.brief(H.THEME, R5, s, 'A', items, 'A')
        for word in ('박공 정면', '세로선', '왼쪽 사면', 'preview/compare.png', 'refs/projection-gable-front-4x.png',
                     'refs/projection-l-combo-4x.png', 'gable_front', 'lean_to'):
            self.assertIn(word, text)

    def test_r3_sandbox_has_no_projection_guides(self):
        path = self.drawer.sandbox_for(H.THEME, H.ROUND, 'A')
        self.assertFalse([f for f in os.listdir(os.path.join(path, 'refs')) if f.startswith('projection-')])
        s = dot.seed(H.THEME)
        items = [it for it in s['items'] if it['id'] in s['rounds'][H.ROUND]['items']]
        self.assertNotIn('## 투영', self.drawer.brief(H.THEME, H.ROUND, s, 'A', items, 'A'))


if __name__ == '__main__':
    unittest.main()
