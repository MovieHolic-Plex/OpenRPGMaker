"""palette.py 의 file 출처(출처별 pred·k)와 북방 설원 램프, refs 의 file 기준 그림, style-r6 시드 계약."""
import contextlib
import io
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

import beodeul  # noqa: E402
import dot  # noqa: E402
import palette as P  # noqa: E402

TS = {'tilesPerRow': 1}
THEME = 'northern-snow'
NEW_RAMPS = ('water', 'ice', 'pine', 'roofred', 'roofslate', 'brick', 'plaster', 'plaza', 'dirt')


def png(path, rgba_rows):
    a = np.array(rgba_rows, np.uint8)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(a, 'RGBA').save(path)


class FileSourceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-palfile-')
        self.repo, self.data = P.REPO, P.DATA
        P.REPO = self.tmp
        g1, g2, red, clear = (20, 90, 40, 255), (60, 160, 80, 255), (200, 30, 30, 255), (0, 0, 0, 0)
        png(os.path.join(self.tmp, 'art', 'mix.png'), [[g1, g1, g2, red], [g2, g2, red, clear]])
        png(os.path.join(self.tmp, 'art', 'trunk.png'), [[(50, 30, 15, 255), (70, 40, 20, 255), clear, clear]])

    def tearDown(self):
        P.REPO, P.DATA = self.repo, self.data
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_file_source_takes_opaque_pixels_and_its_own_pred(self):
        cols, npx, by = P.theme_ramp(None, TS, {'cells': [{'file': 'art/mix.png', 'pred': 'green'}], 'k': 7})
        self.assertEqual([P.hx(c) for c in cols], ['#145a28', '#3ca050'])
        self.assertEqual(npx, 5, '투명 화소와 pred 밖(빨강)은 세지 않는다')
        self.assertEqual(by['#145a28'], [{'file': 'art/mix.png', 'pred': 'green'}])

    def test_without_pred_every_opaque_colour_is_a_candidate(self):
        cols, npx, _ = P.theme_ramp(None, TS, {'cells': [{'file': 'art/mix.png'}], 'k': 7})
        self.assertEqual(npx, 7)
        self.assertIn((200, 30, 30), cols)

    def test_source_with_own_k_is_ramped_separately_and_merged_by_brightness(self):
        spec = {'cells': [{'file': 'art/mix.png', 'pred': 'green', 'k': 1}, {'file': 'art/trunk.png', 'k': 2}]}
        cols, _, by = P.theme_ramp(None, TS, spec)
        self.assertEqual([P.hx(c) for c in cols], ['#321e0f', '#462814', '#3ca050'])
        self.assertEqual([P.lum(c) for c in cols], sorted(P.lum(c) for c in cols), '단 0 = 가장 어두움')
        self.assertEqual(by['#462814'], [{'file': 'art/trunk.png', 'k': 2}])

    def test_paths_outside_the_repo_are_refused(self):
        outside = os.path.join(os.path.dirname(self.tmp), 'bk-outside.png')
        for rel in ('../bk-outside.png', outside, 'art/missing.png'):
            with self.subTest(rel=rel), self.assertRaises(SystemExit):
                P.file_pixels(rel)

    def test_colour_missing_from_the_shared_sheet_fails_and_names_the_source(self):
        sheet = P._sheet()
        cols = set(map(tuple, sheet[sheet[:, :, 3] == 255][:, :3].astype(int).tolist()))
        odd = next(c for c in ((1, 2, 3), (3, 2, 1), (5, 7, 9)) if c not in cols)
        png(os.path.join(self.tmp, 'art', 'odd.png'), [[odd + (255,)] * 4])
        P.DATA = os.path.join(self.tmp, 'data')
        os.makedirs(os.path.join(P.DATA, 't'))
        seed = {'palette': {'ramps': {'odd': {'from': 'beodeul', 'cells': [{'file': 'art/odd.png'}], 'k': 7}}}}
        with open(os.path.join(P.DATA, 't', 'seed.json'), 'w') as f:
            json.dump(seed, f)
        with self.assertRaises(SystemExit) as cm:
            P.build('t')
        msg = str(cm.exception)
        self.assertIn('공용 시트에 없는 색 ' + P.hx(odd), msg)
        self.assertIn('art/odd.png', msg, '어느 출처를 빼야 하는지 적는다')


class NorthernRampsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(P.DATA, THEME, 'palette.json'), encoding='utf-8') as f:
            cls.text = f.read()
        cls.pal = json.loads(cls.text)
        sheet = P._sheet()
        cls.sheet_cols = {P.hx(c) for c in map(tuple, sheet[sheet[:, :, 3] == 255][:, :3].astype(int).tolist())}

    def test_palette_json_is_what_the_seed_extracts(self):
        self.assertEqual(json.dumps(P.build(THEME), ensure_ascii=False, indent=1) + '\n', self.text)

    def test_new_ramps_come_from_snowfield_files_and_exist_in_the_sheet(self):
        for name in NEW_RAMPS:
            with self.subTest(ramp=name):
                cols = self.pal['ramps'][name]
                self.assertGreaterEqual(len(cols), 2)
                self.assertTrue(set(cols) <= self.sheet_cols)
                src = self.pal['sources'][name]
                self.assertEqual(src['kind'], 'beodeul')
                self.assertTrue(all(c['file'].startswith('tiledata/beodeul-variants/snowfield/') for c in src['from']))
                self.assertTrue(src['why'])

    def test_new_ramps_have_their_material_hue(self):
        rgb = {k: [dot.hx(c) for c in v] for k, v in self.pal['ramps'].items()}
        self.assertTrue(all(g > r + 20 and b > r + 20 for r, g, b in rgb['water']), '청록 물')
        self.assertTrue(all(b > r for r, g, b in rgb['ice']), '푸른 얼음')
        self.assertTrue(all(b > r and b > g for r, g, b in rgb['roofslate']), '푸른 슬레이트')
        self.assertTrue(all(r > g and r > b for r, g, b in rgb['roofred']), '붉은 기와')
        self.assertTrue(all(r > g for r, g, b in rgb['brick']), '분홍 벽돌·자주 줄눈')
        self.assertTrue(all(b > r for r, g, b in rgb['plaza']), '푸른 회색 판석')
        self.assertTrue(all(r > b for r, g, b in rgb['dirt']), '흙길')
        greens = [c for c in rgb['pine'] if c[1] > c[0] + 6]
        trunks = [c for c in rgb['pine'] if c[0] > c[2] + 12 and c[1] <= c[0]]
        self.assertGreaterEqual(len(greens), 5, '청록 바늘잎')
        self.assertGreaterEqual(len(trunks), 1, '줄기')
        self.assertTrue(rgb['plaster'][-1][0] > 220, '흰 회벽')

    def test_snow_includes_the_snowfield_ground(self):
        self.assertIn({'file': 'tiledata/beodeul-variants/snowfield/parts/ground-snow.png'},
                      self.pal['sources']['snow']['from'])
        self.assertTrue({'#cadaee', '#e6f0fa'} <= set(self.pal['ramps']['snow']))


class FileRefsAndRoundTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-r6refs-')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_file_ref_with_crop(self):
        ref = {'file': 'tiledata/beodeul-variants/snowfield/render-1x.png', 'crop': [200, 215, 472, 285], 'id': 'houses'}
        im = beodeul.ref_image(ref).img()
        self.assertEqual(im.size, (472, 285))
        self.assertEqual(beodeul.ref_name(ref), 'houses')
        self.assertEqual(beodeul.ref_name({'file': 'a/b/w2.png'}), 'w2')
        for bad in ({'file': '../x.png'}, dict(ref, crop=[800, 600, 200, 200])):
            with self.subTest(bad=bad), self.assertRaises(SystemExit):
                beodeul.ref_image(bad)

    def test_drawer_sandbox_gets_file_refs(self):
        import drawer
        s = dot.seed(THEME)
        drawer.write_refs(self.tmp, THEME, s, 'style-r6')
        for ref in s['refs']:
            name = beodeul.ref_name(ref)
            with self.subTest(ref=name):
                one = Image.open(os.path.join(self.tmp, 'refs', f'{name}-1x.png'))
                four = Image.open(os.path.join(self.tmp, 'refs', f'{name}-4x.png'))
                self.assertEqual((four.width, four.height), (one.width * 4, one.height * 4))
        self.assertIn('refs/snowfield-village-houses-4x.png', drawer.references(THEME, s, 'style-r6'))

    def test_style_r6_lines_chimneys_and_gable_front(self):
        import assemble as AS
        import harness
        s = dot.seed(THEME)
        items = {it['id']: it for it in s['items']}
        rd = s['rounds']['style-r6']
        self.assertTrue(rd['requireGableFront'])
        self.assertEqual(harness._gable_front_round(s, items, 'style-r6'), [])
        ramps = set(dot.palette(THEME)['ramps'])
        for ln in 'ABC':
            with self.subTest(line=ln):
                info = s['lines'][ln]
                self.assertEqual(info['origin'], {'round': 'style-r6', 'key': ln})
                self.assertTrue(set(info['materials']) <= ramps)
                self.assertTrue(all(m in info['concept'] for m in info['materials']), '줄 화풍이 램프 이름을 적는다')
        self.assertIn('plaster', s['lines']['B']['materials'])
        self.assertIn('roofred', s['lines']['B']['materials'])
        self.assertTrue({'brick', 'roofred', 'roofslate'} <= set(s['lines']['C']['materials']))
        for recipe in AS.round_buildings(THEME, 'style-r6'):
            with self.subTest(building=recipe['id']):
                ex = [e for m in AS.masses(recipe) for e in (m.get('extras') or [])]
                self.assertTrue(any(e['part'] == 'extra.chimney' and e.get('on') == 'roof' for e in ex))
        for rid in ('style-r3', 'style-r5'):
            self.assertEqual(s['rounds'][rid].get('superseded'), 'style-r6')

    def test_validate_reports_old_rounds_as_superseded_not_failed(self):
        import harness
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = harness.cmd_validate(THEME)
        text = out.getvalue()
        self.assertEqual(rc, 0, text)
        self.assertIn('판 style-r3: superseded by style-r6', text)
        self.assertIn('판 style-r5: superseded by style-r6', text)
        self.assertNotIn('✗', text)


if __name__ == '__main__':
    unittest.main()
