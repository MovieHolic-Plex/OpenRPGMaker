"""깊이 땅 문법 시험(style-r7) — 물러난 질량의 땅 행, 마당 띠, 그림자, 문 규칙, 짧은 박공 지붕(A6), reuseParts,
flat_depth 함정, 깊이 안내도. 모델 호출 없음.

사용자 반려(2026-10-22, rejected-T-house-no-depth.png): 「ㅜ자 집 — 공간감이 전혀 없다」. A10 이 모든 질량을 한 땅 행에
세워 날개가 본채 벽에 붙인 판처럼 읽혔다.
"""
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
import helpers as H  # noqa: E402
import projection  # noqa: E402

PAL = dot.palette(H.THEME)
ITEMS = H.items()
R7 = 'style-r7'
T = dot.T
MAIN_WALL_ROWS = 5


def r7_parts(line='A'):
    return {i: {'item': ITEMS[i], 'img': H.compose(i, line)} for i in dot.seed(H.THEME)['rounds'][R7]['items']}


def r7(bid):
    return next(b for b in AS.round_buildings(H.THEME, R7) if b['id'] == bid)


def fails(res):
    return {c['code'] for c in AS.run_checks(res)}


def msgs(res):
    return [f'{c["code"]} {c["msg"]}' for c in AS.run_checks(res)]


def shifted_from(src, shadow, w=None, drop=AS.EAVE_DROP):
    ys, xs = np.nonzero(shadow)
    if w is None:
        ws = range(1, 4 * T)
        return any(all(src[y - drop, x - k] for y, x in zip(ys, xs)) for k in ws)
    return all(src[y - drop, x - w] for y, x in zip(ys, xs))


def mass(res, mid):
    return next(m for m in res['masses'] if m['id'] == mid)


def own_mask(res, mid):
    """질량 mid 의 조각을 자기 자리에 다시 찍은 불투명 마스크(다른 질량에 가려도 자기 화소)."""
    a = np.zeros((res['height'] * T, res['width'] * T), bool)
    for p in res['pieces']:
        if p['mass'] != mid:
            continue
        op = np.array(p['crop'].convert('RGBA'))[:, :, 3] == 255
        x0, y0 = p['at'][0] * T, p['at'][1] * T
        h, w = min(op.shape[0], a.shape[0] - y0), min(op.shape[1], a.shape[1] - x0)
        if y0 >= 0 and h > 0 and w > 0:
            a[y0:y0 + h, x0:x0 + w] |= op[:h, :w]
    return a


class DepthGroundTest(unittest.TestCase):
    def setUp(self):
        self.parts = r7_parts()

    def test_round_flags_the_depth_grammar(self):
        self.assertTrue(AS.depth_ground(H.THEME, R7))
        self.assertFalse(AS.depth_ground(H.THEME, 'style-r5'))
        self.assertTrue(all(b.get('_depthGround') for b in AS.round_buildings(H.THEME, R7)))
        self.assertFalse(any(b.get('_depthGround') for b in AS.round_buildings(H.THEME, 'style-r5')))

    def test_set_back_mass_stands_depth_cells_higher_with_a_yard_strip(self):
        res = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME)
        self.assertEqual(msgs(res), [])
        main, wing = mass(res, 'main'), mass(res, 'wing')
        self.assertEqual(wing['ground'], res['height'])
        self.assertEqual(main['ground'], res['height'] - main['depth'])
        self.assertGreaterEqual(main['depth'], 1)
        own = own_mask(res, 'main')
        g = main['ground'] * T - 1
        self.assertTrue(own[g, main['x'] * T:(main['x'] + main['cols']) * T].all(), '본채 벽 바닥이 자기 땅 행을 덮는다')
        self.assertFalse(own[g + 1:].any(), '본채 화소가 자기 땅 행 아래로 내려가지 않는다')
        a = np.array(res['img'].img())
        yard = a[main['ground'] * T:res['height'] * T, 0:wing['x'] * T]
        self.assertTrue((yard[:, :, 3] == 0).all(), '날개 왼쪽(빛 쪽) 마당 띠는 투명 — 지도 바닥이 비친다')
        self.assertEqual(res['kit']['walkGrid'][main['ground']][0], '.', '마당 칸은 걸을 수 있다')

    def test_same_recipe_under_the_old_one_ground_rule_is_rejected(self):
        res = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME, depth_ground=False)
        self.assertIn('A13', fails(res), '옛 한 땅 규칙에서는 본채가 올라서지 않아 날개 골이 본채 지붕에 닿지 못한다')
        far = json.loads(json.dumps(r7('thouse.r7')))
        far['masses'][0]['depth'] = 4
        self.assertIn('A7', fails(AS.assemble(far, self.parts, PAL, H.THEME, depth_ground=False)),
                      '옛 규칙(depth 차 ≤ 1)에서는 물러난 본채가 통과하지 못한다')

    def test_masses_must_touch_on_screen(self):
        ms = AS.masses(r7('thouse.r7'))
        rows = {'main': 9, 'wing': 8}
        self.assertEqual(AS.mass_problems(ms, rows), [])
        far = [dict(m, depth=9) if m['id'] == 'main' else m for m in ms]
        self.assertTrue(AS.mass_problems(far, rows), '본채가 날개 꼭대기보다 더 물러나면 빈 하늘 띠')

    def test_a_mass_without_wall_on_its_ground_row_fails_a10(self):
        h = 6
        wall = {0: np.zeros((h * T, 8 * T), bool), 1: np.zeros((h * T, 8 * T), bool)}
        wall[0][(h - 2) * T:h * T, 0:4 * T] = True
        wall[1][(h - 4) * T:(h - 2) * T, 4 * T:8 * T] = True
        wall[1][(h - 2) * T - 1, 7 * T:8 * T] = False
        plans = [{'m': {'id': 'a'}, 'idx': 0, 'x': 0, 'cols': 4, 'depth': 0, 'ground': h, 'walls': [{'h': 2}]},
                 {'m': {'id': 'b'}, 'idx': 1, 'x': 4, 'cols': 4, 'depth': 1, 'ground': h - 1, 'walls': [{'h': 2}]}]
        r = AS._a10_depth(plans, wall, h)
        self.assertFalse(r['ok'])
        self.assertIn('땅 행', r['msg'])
        self.assertIn('떴다', r['msg'])
        plans[1]['ground'] = h - 2
        wall[1][(h - 2) * T - 1, 7 * T:8 * T] = True
        r = AS._a10_depth(plans, wall, h)
        self.assertFalse(r['ok'], 'depth 1 질량이 2칸 위에 서면 땅 행이 어긋난다')

    def test_storeys_stay_two_cells(self):
        wall = {0: np.ones((4 * T, 4 * T), bool)}
        plans = [{'m': {'id': 'a'}, 'idx': 0, 'x': 0, 'cols': 4, 'depth': 0, 'ground': 4, 'walls': [{'h': 3}]}]
        r = AS._a10_depth(plans, wall, 4)
        self.assertFalse(r['ok'])
        self.assertIn('층은 2칸', r['msg'])


class ShadowTest(unittest.TestCase):
    def setUp(self):
        self.parts = r7_parts()

    def test_shadow_falls_only_on_the_main_wall(self):
        res = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME)
        sh = res['shadow']
        self.assertGreater(int(sh.sum()), 0)
        self.assertEqual(res['kit']['shadowPx'], int(sh.sum()))
        wing, main = mass(res, 'wing'), mass(res, 'main')
        wing_px = own_mask(res, 'wing')
        self.assertFalse((sh & wing_px).any(), '그림자는 그림자를 드리우는 날개 위에 없다')
        ys, xs = np.nonzero(sh)
        self.assertTrue(shifted_from(wing_px, sh), '빛은 왼쪽 위 — 그림자는 날개 실루엣을 오른쪽·아래로 민 자리')
        self.assertGreater(int(xs.min()), wing['x'] * T)
        self.assertLess(int(xs.max()), (main['x'] + main['cols']) * T)
        wall_top = (main['ground'] - MAIN_WALL_ROWS) * T
        self.assertGreaterEqual(int(ys.min()), wall_top, '본채 지붕에는 그림자가 없다')
        a = np.array(res['img'].img())
        self.assertFalse(sh[main['ground'] * T:].any(), '날개 옆 땅(마당)에는 그림자가 없다 — 본채 벽에만')
        self.assertTrue((a[sh][:, 3] == 255).all(), '그림자 화소는 불투명 본채 벽 위')
        self.assertTrue(set(res['owner_kind'][sh]) <= {'wall', 'band', 'base'}, '지붕에는 그림자가 없다')
        self.assertFalse(((a[:, :, 3] > 0) & (a[:, :, 3] < 255)).any(), '반투명 땅 그림자 화소가 없다')

    def test_band_width_is_a_third_of_the_overlap(self):
        res = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME)
        wing, main = mass(res, 'wing'), mass(res, 'main')
        overlap = wing['ground'] * T - max(wing['top'] * T, (main['ground'] - MAIN_WALL_ROWS) * T)
        want = int(round(overlap / 3))
        right = (wing['x'] + wing['cols']) * T
        room = (main['x'] + main['cols']) * T - right
        for row in ((main['ground'] - 1) * T + 4, (main['ground'] - 2) * T + 4):
            xs = np.nonzero(res['shadow'][row])[0]
            self.assertEqual(int(xs.min()), right)
            self.assertEqual(int(xs.max() - xs.min() + 1), min(want, room), '띠 폭 = 겹친 높이/3, 본채 오른쪽 끝에서 잘린다')
        wide = json.loads(json.dumps(r7('thouse.r7')))
        wide['masses'][0]['cols'] = 12
        wide['masses'][0]['walls'] = [{'item': w['item'], 'letters': 'L W M W W M M M M M W R'} for w in wide['masses'][0]['walls']]
        res = AS.assemble(wide, self.parts, PAL, H.THEME)
        xs = np.nonzero(res['shadow'][(main['ground'] - 1) * T + 4])[0]
        self.assertEqual(int(xs.max() - xs.min() + 1), want, '넓은 본채에서는 띠 폭이 겹친 높이/3 그대로')

    def test_single_mass_and_legacy_rounds_have_no_shadow(self):
        res = AS.assemble(r7('cottage.r7'), self.parts, PAL, H.THEME)
        self.assertEqual(res['kit']['shadowPx'], 0)
        old = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME, depth_ground=False)
        self.assertEqual(old['kit']['shadowPx'], 0)
        a = np.array(old['img'].img())
        self.assertFalse(((a[:, :, 3] > 0) & (a[:, :, 3] < 255)).any())


class DoorDepthTest(unittest.TestCase):
    def setUp(self):
        self.parts = r7_parts()

    def _moved(self, main_letters, wing_letters):
        rec = json.loads(json.dumps(r7('thouse.r7')))
        rec['masses'][0]['walls'][1]['letters'] = main_letters
        rec['masses'][1]['walls'][0]['letters'] = wing_letters
        return rec

    def test_door_on_the_set_back_main_fails(self):
        res = AS.assemble(self._moved('L D M M M M W R', 'L W W R'), self.parts, PAL, H.THEME)
        a1 = [c['msg'] for c in AS.run_checks(res) if c['code'] == 'A1']
        self.assertTrue(any('가장 앞 질량' in m for m in a1), a1)

    def test_door_hidden_behind_the_wing_fails(self):
        res = AS.assemble(self._moved('L W M D M M W R', 'L W W R'), self.parts, PAL, H.THEME)
        self.assertIn('A1', fails(res))

    def test_two_doors_with_depth_fail(self):
        res = AS.assemble(self._moved('L D M M M M W R', 'L W D R'), self.parts, PAL, H.THEME)
        self.assertIn('A1', fails(res))

    def test_front_cell_of_the_door_must_be_ground(self):
        r = AS._a1_depth([{'depth': 0}], [{'mass': 'm', 'depth': 0, 'at': [1, 0], 'rec': {'size': [1, 2]}}],
                         np.ones((4 * T, 3 * T), bool), 4)
        self.assertFalse(r['ok'])
        self.assertIn('문 앞 칸', r['msg'])
        r = AS._a1_depth([{'depth': 0}], [{'mass': 'm', 'depth': 0, 'at': [1, 2], 'rec': {'size': [1, 2]}}],
                         np.ones((4 * T, 3 * T), bool), 4)
        self.assertTrue(r['ok'], '앞줄 문 앞은 그림 밖(땅)')

    def test_validate_catches_a_door_on_a_back_mass(self):
        import harness
        s = json.loads(json.dumps(dot.seed(H.THEME)))
        b = next(b for b in s['buildings'] if b['id'] == 'thouse.r7')
        b['masses'][0]['walls'][1]['letters'] = 'L D M M M M W R'
        b['masses'][1]['walls'][0]['letters'] = 'L W W R'
        errs = harness._depth_round(s, {it['id']: it for it in s['items']}, R7)
        self.assertTrue(any('가장 앞 질량' in e for e in errs), errs)


class ShortGableFrontTest(unittest.TestCase):
    def setUp(self):
        self.parts = r7_parts()

    def test_band_is_measured_from_the_projection_guide(self):
        m = projection.gable_front_band()
        self.assertAlmostEqual(m['ratios']['cottage'], 6 / 8)
        self.assertAlmostEqual(m['ratios']['wing'], 6 / 8)
        self.assertAlmostEqual(m['ratios']['hall'], 7 / 12)
        self.assertEqual(AS.gable_front_band(), m['band'])
        self.assertLess(m['band'][1], AS.RECEDING_MAX, '옛 0.85 보다 좁다')
        self.assertGreater(m['band'][0], AS.RECEDING_MIN)

    def _cottage(self, **over):
        rec = json.loads(json.dumps(r7('cottage.r7')))
        rec['masses'][0].update(over)
        return rec

    def test_long_gable_front_roof_fails_a6_only_in_depth_rounds(self):
        long_ = self._cottage(depth_rows=3)
        self.assertIn('A6', fails(AS.assemble(long_, self.parts, PAL, H.THEME)), '1층 depth_rows 3 = 0.78 > 0.75')
        self.assertNotIn('A6', fails(AS.assemble(long_, self.parts, PAL, H.THEME, depth_ground=False)))
        self.assertEqual(msgs(AS.assemble(self._cottage(), self.parts, PAL, H.THEME)), [])

    def test_depth_rows_and_wing_width_limits(self):
        self.assertIn('A3', fails(AS.assemble(self._cottage(depth_rows=4), self.parts, PAL, H.THEME)))
        self.assertEqual(AS.receding_limits(AS.GABLE_FRONT, True), ((4, 6), (2, 3)))
        self.assertEqual(AS.receding_limits(AS.GABLE_FRONT, False), (AS.GF_COLS, AS.DEPTH_ROWS))
        import harness
        s = json.loads(json.dumps(dot.seed(H.THEME)))
        wing = next(b for b in s['buildings'] if b['id'] == 'thouse.r7')['masses'][1]
        wing.update(cols=3, back='roof.gf.back', back_end='valley', walls=[{'item': 'wall.timber', 'letters': 'L D R'}])
        errs = harness._depth_round(s, {it['id']: it for it in s['items']}, R7)
        self.assertTrue(any('4~6칸' in e for e in errs), errs)

    def test_r7_seed_recipes_pass_every_check(self):
        for bid in ('cottage.r7', 'thouse.r7', 'hall.r7'):
            with self.subTest(building=bid):
                self.assertEqual(msgs(AS.assemble(r7(bid), self.parts, PAL, H.THEME)), [])

    def test_hall_lean_to_is_on_the_light_side_and_lower(self):
        hall = r7('hall.r7')
        ms = {m['id']: m for m in AS.masses(hall)}
        self.assertEqual(ms['shed']['low'], 'left')
        self.assertLess(ms['shed']['x'], ms['hall']['x'])
        self.assertLess(ms['shed']['storeys'], ms['hall']['storeys'])
        self.assertEqual(ms['hall']['depth_rows'], 3)
        self.assertEqual(ITEMS['roof.lean.left']['low'], 'left')

    def test_every_r7_theme_seed_validates(self):
        import harness
        for theme in ('fantasy-kingdom', 'beodeul-noble', 'northern-snow'):
            s = dot.seed(theme)
            items = {it['id']: it for it in s['items']}
            with self.subTest(theme=theme):
                rd = s['rounds'][R7]
                self.assertEqual(rd['grammar'], AS.DEPTH_GRAMMAR)
                self.assertTrue(rd['reuseParts'])
                self.assertEqual(harness._depth_round(s, items, R7), [])
                self.assertEqual(harness._gable_front_round(s, items, R7), [])
                self.assertEqual(harness._r4_grammar(s, items, R7), [])
        self.assertIn('townhouse.r7', dot.seed('beodeul-noble')['rounds'][R7]['buildings'])


class ReusePartsTest(unittest.TestCase):
    MOD = '''import os, sys
sys.path.insert(0, os.environ['BK_TESTS_DIR'])
sys.path.insert(0, os.environ['BK_HARNESS_DIR'])
import dot
import helpers as H
WAVE = 'style'
CANDIDATES = {{item: {{k: (lambda item=item, k=k: (dot.Cv.of(H.compose(item, {line!r})), {{}})) for k in {keys!r}}}
               for item in {items!r}}}
'''

    def setUp(self):
        import harness
        self.harness = harness
        self.tmp = tempfile.mkdtemp(prefix='bk-reuse-')
        self._data = dot.DATA
        dot.DATA = os.path.join(self.tmp, 'data')
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(dot.DATA, H.THEME),
                        ignore=shutil.ignore_patterns('ledger.json', 'picked'))
        os.environ['BK_TESTS_DIR'] = HERE
        os.environ['BK_HARNESS_DIR'] = os.path.dirname(HERE)
        self.seed_path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(self.seed_path, encoding='utf-8'))
        r7_items = s['rounds'][R7]['items']
        old = [i for i in r7_items if i != 'roof.lean.left']
        base = os.path.join(self.tmp, 'base.py')
        open(base, 'w').write(self.MOD.format(line='A', keys='ABC', items=old))
        s['rounds']['style-r5'] = dict(s['rounds']['style-r5'], module=base, items=old)
        s['rounds'][R7]['module'] = os.path.join(self.tmp, 'own.py')
        json.dump(s, open(self.seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        self.own = s['rounds'][R7]['module']

    def tearDown(self):
        dot.DATA = self._data
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_parts_come_from_the_reused_round_when_ids_match(self):
        mod, rendered = self.harness.render_round(H.THEME, R7)
        self.assertNotIn('roof.lean.left', rendered, '옛 판에 없는 항목은 그려야 한다')
        self.assertEqual(set(mod.REUSED['gable.front']), {'A', 'B', 'C'})
        self.assertEqual(mod.REUSED['gable.front']['A'], 'style-r5')
        _, base = self.harness.render_round(H.THEME, 'style-r5')
        self.assertEqual(dot.image_hash(rendered['roof.hip']['B'][0]), dot.image_hash(base['roof.hip']['B'][0]))
        cur, _ = self.harness.current_hash(H.THEME, R7, 'roof.hip', 'B')
        self.assertEqual(cur, dot.image_hash(base['roof.hip']['B'][0]), 'pick 도 재사용 그림 해시에 묶인다')

    def test_own_drawing_wins_per_item_and_key(self):
        open(self.own, 'w').write(self.MOD.format(line='C', keys='A', items=['roof.hip', 'roof.lean.left']))
        mod, rendered = self.harness.render_round(H.THEME, R7)
        self.assertNotIn('A', mod.REUSED.get('roof.hip', {}))
        self.assertEqual(mod.REUSED['roof.hip']['B'], 'style-r5')
        self.assertEqual(dot.image_hash(rendered['roof.hip']['A'][0]), dot.image_hash(H.compose('roof.hip', 'C')))
        self.assertIn('roof.lean.left', rendered)
        parts = self.harness.parts_for(H.THEME, R7, 'A', rendered)
        res = AS.assemble(r7('hall.r7'), parts, PAL, H.THEME)
        self.assertNotIn('A0', fails(res))

    def test_gate_treats_reused_hashes_like_drawn_ones(self):
        mod, rendered = self.harness.render_round(H.THEME, R7)
        res = self.harness.run_gate(H.THEME, R7, rendered)
        self.assertEqual(set(res), set(rendered))
        for item, c in res.items():
            for key, rs in c.items():
                self.assertTrue(rs, f'{item} {key} 관문 결과')

    def test_reuse_of_an_unknown_round_is_refused(self):
        s = json.load(open(self.seed_path, encoding='utf-8'))
        s['rounds'][R7]['reuseParts'] = 'style-r99'
        json.dump(s, open(self.seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        with self.assertRaises(SystemExit):
            self.harness.render_round(H.THEME, R7)


class FlatDepthProbeTest(unittest.TestCase):
    def setUp(self):
        import review
        self.review = review
        self.tmp = tempfile.mkdtemp(prefix='bk-r7review-')
        self._runs = dot.RUNS
        dot.RUNS = self.tmp

    def tearDown(self):
        dot.RUNS = self._runs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_flat_depth_puts_every_mass_on_one_ground_line(self):
        parts = r7_parts()
        rec = r7('thouse.r7')
        good = AS.assemble(rec, parts, PAL, H.THEME)
        im = self.review.flat_depth(rec, parts, PAL, H.THEME)
        a = np.array(im.convert('RGBA'))
        self.assertLess(a.shape[0], good['height'] * T, '깊이 계단이 사라져 그림이 낮다')
        self.assertTrue((a[-1, :, 3] == 255).all(), '모든 질량이 한 땅 행 — 마당 띠 없음')
        self.assertFalse(((a[:, :, 3] > 0) & (a[:, :, 3] < 255)).any(), '그림자 없음')
        own = set(map(tuple, np.array(good['img'].img())[:, :, :3].reshape(-1, 3).tolist()))
        probe = set(map(tuple, a[a[:, :, 3] == 255][:, :3].tolist()))
        self.assertTrue(probe <= own | {tuple(c) for p in parts.values()
                                        for c in np.array(p['img'].convert('RGBA'))[:, :, :3].reshape(-1, 3).tolist()})
        self.assertIsNone(self.review.flat_depth(r7('cottage.r7'), parts, PAL, H.THEME), '질량 하나는 함정이 없다')

    def test_r7_board_has_flat_depth_and_the_depth_rule(self):
        prep = self.review.prepare(H.THEME, R7, {'A': r7_parts('A')}, seed=5)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        names = {v['name'] for v in key.values() if v['kind'] == 'probe'}
        self.assertIn('flat_depth', names)
        self.assertIn('detached_wing', names)
        self.assertIn('flat_elevation', names)
        self.assertIn('DEPTH RULE', prep['prompt'])
        self.assertIn('ONE ground line', prep['prompt'])
        self.assertIn('ONE HOUSE RULE', prep['prompt'])
        self.assertIn('V-shaped valley', prep['prompt'])

    def test_passing_flat_depth_voids_the_run(self):
        prep = self.review.prepare(H.THEME, R7, {'A': r7_parts('A')}, seed=6)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        lines = []
        for sid, k in key.items():
            ok = k['name'] == 'flat_depth' or k['kind'] == 'candidate'
            lines.append(json.dumps({'id': sid, 'view34': 'PASS' if ok else 'FAIL', 'quality': 'PASS' if ok else 'FAIL',
                                     'reason': 'x'}))
        self.review.score(H.THEME, R7, prep['run'], '\n'.join(lines), 'test')
        res = json.load(open(os.path.join(prep['dir'], 'result.json'), encoding='utf-8'))
        self.assertIn('flat_depth', res['void'])

    def test_r5_board_has_no_depth_probe(self):
        from test_projection import r5_parts
        prep = self.review.prepare(H.THEME, 'style-r5', {'A': r5_parts('A')}, seed=3)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        self.assertNotIn('flat_depth', {v['name'] for v in key.values()})
        self.assertNotIn('DEPTH RULE', prep['prompt'])


class WingDepthGuideTest(unittest.TestCase):
    def test_guide_shows_the_joined_wing_and_wall_only_shadow(self):
        a = np.array(projection.render('wing-depth').convert('L')).astype(int)
        L = projection.wing_depth.last
        g = projection.WING_DEPTH
        self.assertEqual((a.shape[0] % T, a.shape[1] % T), (0, 0))
        self.assertGreater(int((a == projection.TONE['yard']).sum()), 0, '마당 띠')
        wing_rows = np.nonzero(L['wing'].any(axis=1))[0]
        wall_rows = np.nonzero(L['main_wall'].any(axis=1))[0]
        self.assertEqual(int(wing_rows.max() + 1) - int(wall_rows.max() + 1), g['depth'] * T, '본채 벽 바닥이 depth 칸 위')
        sh = L['shadow']
        self.assertTrue(sh.any())
        self.assertFalse((sh & L['wing']).any())
        self.assertTrue(shifted_from(L['wing'], sh, L['w'], g['eave_drop']), '그림자는 날개 실루엣을 오른쪽·아래로 민 자리')
        self.assertEqual(g['depth'], 1, '날개 뒤 끝 = 본채 앞벽')
        self.assertFalse((sh & L['yard']).any(), '그림자는 땅에 없다')
        self.assertTrue((sh & L['main_wall']).any() and not (sh & ~L['main_wall']).any(), '그림자는 본채 벽에만')
        self.assertLess(L['wing_top'], L['main_eave'], '날개 지붕이 본채 처마보다 올라간다(본채 지붕 속 골)')
        self.assertGreater(L['wing_top'], L['main_top'])
        self.assertGreater(int((a == projection.TONE['valley']).sum()), 0, '골 선')
        x0, x1 = g['wing_x'] * T, (g['wing_x'] + g['wing_cols']) * T
        between = a[L['main_eave']:L['wing_eave'], x0:x1]
        self.assertFalse((between == projection.TONE['yard']).any() or (between == projection.BG).any(),
                         '날개와 본채 사이(날개 열 × 본채 처마~날개 처마)에 땅이 없다')

    def test_guide_files_are_grey(self):
        tmp = tempfile.mkdtemp(prefix='bk-guide-')
        try:
            paths = projection.write_guides(tmp)
            self.assertIn('projection-wing-depth-4x.png', {os.path.basename(p) for p in paths})
            for p in paths:
                a = np.array(Image.open(p).convert('RGB')).astype(int)
                self.assertEqual(int(np.abs(a[:, :, 0] - a[:, :, 1]).max() + np.abs(a[:, :, 1] - a[:, :, 2]).max()), 0)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
