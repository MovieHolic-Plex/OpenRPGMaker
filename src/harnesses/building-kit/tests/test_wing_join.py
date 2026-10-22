"""날개 이음 시험(깊이 땅 문법 r7+) — A16(사이 땅·지붕 오름·depth+1·골 계약), 골 폭 v4·v5·v6, detached_wing 함정,
r7 레시피(ㅜ자 집·타운하우스), needs drawing 대체. 모델 호출 없음.

사용자 판정(2026-10-22): 「ㅜ자 집이 한 채로 안 보인다 — 날개와 본채 사이에 풀이 보이고 날개 뒤 박공 꼭지가 본채 벽 앞에서
끝난다」. 승인안(bk-thouse-joined): 날개 지붕이 본채 지붕 속으로 올라가 V자 골에서 만나고, 날개 벽이 본채 벽에 붙는다.
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

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
WING_THEMES = ('fantasy-kingdom', 'beodeul-noble', 'northern-snow')


def r7_parts(line='A'):
    return {i: {'item': ITEMS[i], 'img': H.compose(i, line)} for i in dot.seed(H.THEME)['rounds'][R7]['items']}


def r7(bid, theme=H.THEME):
    return json.loads(json.dumps(next(b for b in AS.round_buildings(theme, R7) if b['id'] == bid)))


def a16(res):
    return [c for c in res['checks'] if c['code'] == 'A16']


def mass_of(rec, mid):
    return next(m for m in rec['masses'] if m['id'] == mid)


class A16Test(unittest.TestCase):
    def setUp(self):
        self.parts = r7_parts()

    def test_joined_thouse_passes_a16(self):
        res = AS.assemble(r7('thouse.r7'), self.parts, PAL, H.THEME)
        self.assertEqual([c['code'] for c in AS.run_checks(res)], [])
        [c] = a16(res)
        self.assertTrue(c['ok'], c['msg'])
        self.assertIn('사이 땅 0px', c['msg'])

    def test_old_set_back_gable_wing_fails_rise_and_contract(self):
        rec = r7('thouse.r7')
        mass_of(rec, 'main')['depth'] = 4
        mass_of(rec, 'wing').update(back='roof.gf.back', back_end='gable')
        [c] = a16(AS.assemble(rec, self.parts, PAL, H.THEME))
        self.assertFalse(c['ok'])
        self.assertIn('본채 처마 행', c['msg'], '날개 지붕이 본채 처마보다 아래에서 끝난다')
        self.assertIn('depth + 1', c['msg'])
        self.assertIn('valley', c['msg'])

    def test_ground_between_wing_and_main_fails(self):
        rec = r7('thouse.r7')
        mass_of(rec, 'main')['depth'] = 7
        res = AS.assemble(rec, self.parts, PAL, H.THEME)
        [c] = a16(res)
        self.assertFalse(c['ok'])
        self.assertIn('땅(투명)', c['msg'], '날개 골 귀퉁이와 떠오른 본채 벽 밑 사이로 땅이 비친다')
        main = next(m for m in res['masses'] if m['id'] == 'main')
        wing = next(m for m in res['masses'] if m['id'] == 'wing')
        a = np.array(res['img'].img())
        band = a[(main['ground'] - 5) * T:(wing['ground'] - 2) * T, wing['x'] * T:(wing['x'] + wing['cols']) * T, 3]
        self.assertTrue((band == 0).any())

    def test_roof_that_stays_below_the_main_eave_fails_alone(self):
        rec = r7('thouse.r7')
        main = mass_of(rec, 'main')
        main['storeys'] = 3
        main['walls'] = [main['walls'][0], dict(main['walls'][0]), main['walls'][1]]
        [c] = a16(AS.assemble(rec, self.parts, PAL, H.THEME))
        self.assertFalse(c['ok'])
        self.assertIn('본채 처마 행', c['msg'])
        self.assertNotIn('땅(투명)', c['msg'], '본채 벽이 날개 뒤를 다 덮어 사이 땅은 없다')
        self.assertNotIn('depth + 1', c['msg'])

    def test_a16_hole_and_foreign_pixel_on_a_synthetic_canvas(self):
        h, w = 10 * T, 4 * T
        plans = [{'m': {'id': 'wing', 'kind': AS.GABLE_FRONT, 'x': 1, 'cols': 2, 'depth': 0, 'back_end': 'valley'},
                  'idx': 0, 'x': 1, 'cols': 2, 'depth': 0, 'storey_rows': [(0, 8, 2)]},
                 {'m': {'id': 'main', 'kind': AS.RIDGE_SIDE, 'x': 0, 'cols': 4, 'depth': 1},
                  'idx': 1, 'x': 0, 'cols': 4, 'depth': 1, 'storey_rows': [(0, 4, 2), (1, 6, 2)]}]
        op = np.ones((h, w), bool)
        owner = np.ones((h, w), int)
        owner[2 * T:, T:3 * T] = 0
        roof = {0: np.zeros((h, w), bool), 1: np.zeros((h, w), bool)}
        roof[0][2 * T:8 * T, T:3 * T] = True
        self.assertTrue(AS._a16(plans, op, owner, roof)['ok'])
        holed = op.copy()
        holed[6 * T, 1 * T] = False
        r = AS._a16(plans, holed, owner, roof)
        self.assertFalse(r['ok'])
        self.assertIn('땅(투명)', r['msg'])
        self.assertIn(f'열 {T}', r['msg'], '날개 왼쪽 옆단 열')
        foreign = owner.copy()
        foreign[7 * T, 3 * T - 1] = 2
        self.assertFalse(AS._a16(plans, op, foreign, roof)['ok'], '날개·본채가 아닌 화소도 이음이 아니다')
        below = {0: roof[0].copy(), 1: roof[1]}
        below[0][:4 * T] = False
        r = AS._a16(plans, op, owner, below)
        self.assertFalse(r['ok'])
        self.assertIn('본채 처마 행', r['msg'])

    def test_a16_only_in_depth_rounds_and_only_for_wings(self):
        rec = r7('thouse.r7')
        self.assertEqual(a16(AS.assemble(rec, self.parts, PAL, H.THEME, depth_ground=False)), [])
        self.assertEqual(a16(AS.assemble(r7('cottage.r7'), self.parts, PAL, H.THEME)), [])
        self.assertEqual(a16(AS.assemble(r7('hall.r7'), self.parts, PAL, H.THEME)), [], '외쪽 헛간은 같은 depth — 날개가 아니다')
        self.assertTrue(AS.is_depth_grammar('r7') and AS.is_depth_grammar('r8'))
        self.assertFalse(AS.is_depth_grammar('r5') or AS.is_depth_grammar(None) or AS.is_depth_grammar('r7x'))

    def test_wing_contract_helpers(self):
        ms = AS.masses(r7('thouse.r7'))
        [(w, mains)] = AS.wing_mains(ms)
        self.assertEqual((w['id'], [m['id'] for m in mains]), ('wing', ['main']))
        self.assertEqual(AS.wing_problems(w, mains), [])
        self.assertEqual(len(AS.wing_problems(dict(w, back_end='gable'), mains)), 1)
        self.assertEqual(len(AS.wing_problems(w, [dict(mains[0], depth=2)])), 1)


class ValleyWidthTest(unittest.TestCase):
    def test_every_wing_theme_has_valley_v4_v5_v6(self):
        for theme in WING_THEMES:
            items = {it['id']: it for it in dot.seed(theme)['items']}
            with self.subTest(theme=theme):
                it = items['roof.gf.valley']
                self.assertEqual(it['form'], 'gf_back')
                roles = {pc['role']: pc for pc in it['pieces']}
                self.assertEqual(sorted(roles), ['v4', 'v5', 'v6'])
                for c in (4, 5, 6):
                    self.assertEqual(roles[f'v{c}']['size'], [c, 2], '폭 = 날개 폭, 2행 = g4·g5 물매')
                    self.assertEqual(roles[f'v{c}']['kind'], 'roofend')
                self.assertEqual(AS.roof_problems(it), [])
                rd = dot.seed(theme)['rounds'][R7]
                self.assertIn('roof.gf.valley', rd['items'])
                self.assertIn('roof.gf.valley', rd['redraw'])
                self.assertEqual(items['roof.gf.back']['size'], [7, 2], '옛 뒤 끝 세트는 그대로(옛 판 그림·해시 보존)')

    def test_five_wide_valley_wing_joins(self):
        rec = r7('thouse.r7')
        mass_of(rec, 'wing').update(cols=5, gable='gable.step', walls=[{'item': 'wall.timber', 'letters': 'L W D W R'}])
        res = AS.assemble(rec, r7_parts(), PAL, H.THEME)
        self.assertEqual([c['code'] for c in AS.run_checks(res)], [])
        backs = [p for p in res['pieces'] if p['mass'] == 'wing' and p['role'] == 'v5']
        self.assertEqual(len(backs), 1)
        self.assertEqual(AS.end_roles(dict(AS.masses(rec)[1]))[0], 'v5')

    def test_projection_guide_shows_the_valley_widths(self):
        self.assertIn('valley-widths', projection.NAMES)
        self.assertEqual(projection.VALLEY_WIDTHS, (4, 5, 6))
        a = np.array(projection.render('valley-widths').convert('L')).astype(int)
        valley = a == projection.TONE['valley']
        spans, x = [], T
        for c in projection.VALLEY_WIDTHS:
            cols = valley[:, x:x + c * T].any(axis=0)
            spans.append(int(cols.sum()))
            self.assertTrue(valley[T:3 * T, x + c * T // 2 - 1].any(), f'v{c} 꼭대기가 가운데')
            x += (c + 1) * T
        self.assertEqual(spans, [c * T for c in projection.VALLEY_WIDTHS], '골 선이 조각 폭 전체를 가로지른다')
        self.assertIn('v4 / v5 / v6', ' '.join(t for _, t in projection.LEGEND['valley-widths']))


class DetachedWingProbeTest(unittest.TestCase):
    def setUp(self):
        import review
        self.review = review
        self.tmp = tempfile.mkdtemp(prefix='bk-wingprobe-')
        self._runs = dot.RUNS
        dot.RUNS = self.tmp

    def tearDown(self):
        dot.RUNS = self._runs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_probe_leaves_ground_between_wing_and_main(self):
        parts = r7_parts()
        rec = r7('thouse.r7')
        good = AS.assemble(rec, parts, PAL, H.THEME)
        im = self.review.detached_wing(rec, parts, PAL, H.THEME)
        a = np.array(im.convert('RGBA'))
        g = np.array(good['img'].img())
        self.assertEqual(a.shape[0], g.shape[0] + T, '날개가 한 칸 앞(아래)으로 나간다')
        wing = next(m for m in good['masses'] if m['id'] == 'wing')
        x0, x1 = wing['x'] * T, (wing['x'] + wing['cols']) * T
        top = wing['top'] * T
        gap = a[top:top + T, x0:x1, 3] == 0
        self.assertTrue(gap.any(), '날개가 비운 자리에 땅이 비친다')
        self.assertTrue((g[top:top + T, x0:x1, 3] == 255).all(), '원래 그림에는 그 자리에 땅이 없다')
        self.assertTrue((a[top + T:, x0:x1][:, :, 3][-2 * T:] == 255).all(), '옮긴 날개 벽은 새 바닥에 선다')
        self.assertIsNone(self.review.detached_wing(r7('cottage.r7'), parts, PAL, H.THEME), '날개 없는 건물은 함정이 없다')
        self.assertIsNone(self.review.detached_wing(r7('hall.r7'), parts, PAL, H.THEME))

    def test_passing_detached_wing_voids_the_run(self):
        prep = self.review.prepare(H.THEME, R7, {'A': r7_parts('A')}, seed=7)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        self.assertIn('detached_wing', {v['name'] for v in key.values() if v['kind'] == 'probe'})
        lines = []
        for sid, k in key.items():
            ok = k['name'] == 'detached_wing' or k['kind'] == 'candidate'
            lines.append(json.dumps({'id': sid, 'view34': 'PASS' if ok else 'FAIL', 'quality': 'PASS' if ok else 'FAIL',
                                     'reason': 'x'}))
        self.review.score(H.THEME, R7, prep['run'], '\n'.join(lines), 'test')
        res = json.load(open(os.path.join(prep['dir'], 'result.json'), encoding='utf-8'))
        self.assertIn('detached_wing', res['void'])

    def test_no_wing_candidate_means_no_detached_probe(self):
        parts = {k: v for k, v in r7_parts('A').items() if k != 'roof.gf.valley'}
        prep = self.review.prepare(H.THEME, R7, {'A': parts}, seed=8)
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        names = {v['name'] for v in key.values()}
        self.assertNotIn('detached_wing', names)
        self.assertNotIn('A.thouse.r7', names, '골을 아직 안 그린 ㅜ자 집은 검수 후보가 아니다')


class R7RecipeTest(unittest.TestCase):
    def test_wings_attach_at_depth_one_with_a_valley(self):
        for theme in WING_THEMES:
            ids = dot.seed(theme)['rounds'][R7]['buildings']
            for bid in [b for b in ('thouse.r7', 'townhouse.r7') if b in ids]:
                with self.subTest(theme=theme, building=bid):
                    rec = r7(bid, theme)
                    wing = mass_of(rec, 'wing')
                    self.assertEqual((wing['back'], wing['back_end'], wing['depth']), ('roof.gf.valley', 'valley', 0))
                    for m in rec['masses']:
                        if m['id'] != 'wing':
                            self.assertEqual(m['depth'], 1, f'{m["id"]} — 날개 뒤 끝 = 본채 앞벽')
        self.assertIn('townhouse.r7', dot.seed('beodeul-noble')['rounds'][R7]['buildings'])

    def test_validate_rejects_a_gable_wing_or_a_set_back_main(self):
        import harness
        for change, word in (({'back_end': 'gable', 'back': 'roof.gf.back'}, 'valley'), (None, 'depth + 1')):
            s = json.loads(json.dumps(dot.seed(H.THEME)))
            b = next(b for b in s['buildings'] if b['id'] == 'thouse.r7')
            if change:
                mass_of(b, 'wing').update(change)
            else:
                mass_of(b, 'main')['depth'] = 2
            errs = harness._depth_round(s, {it['id']: it for it in s['items']}, R7)
            with self.subTest(word=word):
                self.assertTrue(any(word in e for e in errs), errs)


class NeedsDrawingTest(unittest.TestCase):
    def test_missing_valley_reports_needs_drawing_and_skips_only_that_building(self):
        parts = {k: v for k, v in r7_parts().items() if k != 'roof.gf.valley'}
        res = AS.assemble(r7('thouse.r7'), parts, PAL, H.THEME)
        self.assertIsNone(res['img'])
        self.assertEqual(res['needsDrawing'], ['roof.gf.valley v4'])
        self.assertIn('needs drawing: roof.gf.valley v4', AS.run_checks(res)[0]['msg'])
        for bid in ('cottage.r7', 'hall.r7'):
            self.assertEqual(AS.run_checks(AS.assemble(r7(bid), parts, PAL, H.THEME)), [], bid)

    def test_needs_drawing_names_the_pieces_a_recipe_uses(self):
        rec = r7('thouse.r7')
        self.assertEqual(AS.needs_drawing(rec, set(ITEMS)), [])
        self.assertEqual(AS.needs_drawing(rec, set(ITEMS) - {'roof.gf.valley', 'band.trim'}),
                         ['band.trim', 'roof.gf.valley v4'])
        rec5 = json.loads(json.dumps(rec))
        mass_of(rec5, 'wing')['cols'] = 5
        self.assertEqual(AS.needs_drawing(rec5, set(ITEMS) - {'roof.gf.valley'}), ['roof.gf.valley v5'])


class ReuseFallbackTest(unittest.TestCase):
    """reuseParts 판에서 옛 판에도 이 판에도 골 그림이 없을 때 — 깨지지 않고 그 건물만 「needs drawing」으로 건너뛴다."""
    MOD = '''import os, sys
sys.path.insert(0, os.environ['BK_TESTS_DIR'])
sys.path.insert(0, os.environ['BK_HARNESS_DIR'])
import dot
import helpers as H
WAVE = 'style'
CANDIDATES = {{item: {{k: (lambda item=item, k=k: (dot.Cv.of(H.compose(item, k)), {{}})) for k in 'ABC'}}
               for item in {items!r}}}
'''

    def setUp(self):
        import harness
        self.harness = harness
        self.tmp = tempfile.mkdtemp(prefix='bk-valley-reuse-')
        self._data, self._runs = dot.DATA, dot.RUNS
        dot.DATA = os.path.join(self.tmp, 'data')
        dot.RUNS = os.path.join(self.tmp, 'runs')
        shutil.copytree(os.path.join(self._data, H.THEME), os.path.join(dot.DATA, H.THEME),
                        ignore=shutil.ignore_patterns('ledger.json', 'picked'))
        os.environ['BK_TESTS_DIR'] = HERE
        os.environ['BK_HARNESS_DIR'] = os.path.dirname(HERE)
        path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(path, encoding='utf-8'))
        old = [i for i in s['rounds'][R7]['items'] if i != 'roof.gf.valley']
        base = os.path.join(self.tmp, 'base.py')
        with open(base, 'w', encoding='utf-8') as f:
            f.write(self.MOD.format(items=old))
        s['rounds']['style-r5'] = dict(s['rounds']['style-r5'], module=base, items=old)
        s['rounds'][R7]['module'] = os.path.join(self.tmp, 'own-missing.py')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(s, f, ensure_ascii=False, indent=1)

    def tearDown(self):
        dot.DATA, dot.RUNS = self._data, self._runs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_dry_skips_thouse_with_needs_drawing_and_passes_the_rest(self):
        import dry
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            dry.run(H.THEME, R7, 'A', out=os.path.join(self.tmp, 'preview'))
        text = out.getvalue()
        self.assertIn('thouse.r7          건너뜀 — needs drawing: roof.gf.valley v4', text)
        self.assertRegex(text, r'cottage\.r7 .*통과')
        self.assertRegex(text, r'hall\.r7 .*통과')

    def test_validate_notes_needs_drawing(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.harness.cmd_validate(H.THEME)
        self.assertIn('needs drawing: roof.gf.valley v4', out.getvalue())
        _, rendered = self.harness.render_round(H.THEME, R7)
        self.assertNotIn('roof.gf.valley', rendered)
        parts = self.harness.parts_for(H.THEME, R7, 'A', rendered)
        rows = self.harness.assemble_all(H.THEME, parts, quiet=True, rid=R7)
        by = {r['recipe']['id']: r for r in rows}
        self.assertEqual(by['thouse.r7']['res']['needsDrawing'], ['roof.gf.valley v4'])
        self.assertEqual(by['cottage.r7']['fails'], [])
        self.assertEqual(by['hall.r7']['fails'], [])

    def test_drawer_draws_only_the_item_the_reused_round_lacks(self):
        """reuseParts 판을 그릴 때 옛 판에 있는 항목은 빈 함수를 만들지 않는다 — 빈 함수가 옛 그림을 가리면 다시 그려야 한다."""
        import drawer
        old_sandbox = drawer.SANDBOX
        drawer.SANDBOX = os.path.join(self.tmp, 'sandbox')
        self.addCleanup(setattr, drawer, 'SANDBOX', old_sandbox)
        self.assertEqual([i['id'] for i in drawer.draw_items(H.THEME, R7, 'A')], ['roof.gf.valley'])
        name = drawer.func_name('roof.gf.valley', 'A')
        prompts = []

        def runner(cmd, prompt, cwd, timeout):
            prompts.append(prompt)
            path = os.path.join(cwd, 'round_module.py')
            text = open(path, encoding='utf-8').read()
            block = '\n'.join([drawer.BEGIN.format(name=name), f'def {name}():', '    import helpers as H',
                               "    return dot.Cv.of(H.compose('roof.gf.valley', 'A')), {}", drawer.END.format(name=name)])
            start = text.index(drawer.BEGIN.format(name=name))
            end = text.index(drawer.END.format(name=name)) + len(drawer.END.format(name=name))
            open(path, 'w', encoding='utf-8').write(text[:start] + block + text[end:])
            return 0, 'drew', ''

        self.assertEqual(drawer.run(H.THEME, R7, lines_=['A'], runner=runner, cmd=['fake']), 0)
        self.assertIn(name, prompts[0])
        self.assertNotIn(drawer.func_name('roof.hip', 'A'), prompts[0])
        self.assertIn('roof.hip ← style-r5', prompts[0])
        own = open(os.path.join(self.tmp, 'own-missing.py'), encoding='utf-8').read()
        self.assertNotIn(drawer.func_name('roof.hip', 'A'), own)
        mod = self.harness.round_module(H.THEME, R7)
        self.assertNotIn('roof.gf.valley', mod.REUSED)
        self.assertEqual(mod.REUSED['roof.hip']['A'], 'style-r5')
        parts = {i: {'item': ITEMS[i], 'img': fns['A']()[0].img()} for i, fns in mod.CANDIDATES.items()}
        by = {r['recipe']['id']: r for r in self.harness.assemble_all(H.THEME, parts, quiet=True, rid=R7)}
        self.assertFalse(by['thouse.r7']['res'].get('needsDrawing'))
        self.assertEqual(by['thouse.r7']['fails'], [])


if __name__ == '__main__':
    unittest.main()
