"""마을 합성 시험 — 결정성, 건물 비겹침, 문→길 도달, 검수 PASS 만 놓기. 임시 폴더에서만 돈다."""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import dot  # noqa: E402
import harness  # noqa: E402
import helpers as H  # noqa: E402
import review  # noqa: E402
import village  # noqa: E402

SIZE = (40, 26)

class VillageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-village-')
        self._data, self._runs, self._viz = dot.DATA, dot.RUNS, dot.VIZ
        for theme in dot.THEMES:
            shutil.copytree(os.path.join(self._data, theme), os.path.join(self.tmp, 'data', theme))
        dot.DATA = os.path.join(self.tmp, 'data')
        dot.RUNS = os.path.join(self.tmp, 'runs')
        dot.VIZ = os.path.join(self.tmp, 'viz')
        os.makedirs(dot.VIZ)
        dot._PAL.clear()
        H.install_round(dot.DATA)
        self.parts = H.parts('A')

    def tearDown(self):
        dot.DATA, dot.RUNS, dot.VIZ = self._data, self._runs, self._viz
        dot._PAL.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def compose(self, seed=7, all_=True, line='A', theme=H.THEME):
        return village.compose(theme, H.ROUND, line, seed, SIZE, all_, parts=self.parts)

    def test_same_seed_gives_the_same_village(self):
        a = self.compose(seed=11)
        b = self.compose(seed=11)
        self.assertEqual(dot.image_hash(a['img']), dot.image_hash(b['img']))
        self.assertEqual([p['rect'] for p in a['placed']], [p['rect'] for p in b['placed']])

    def test_different_seed_gives_a_different_village(self):
        a = self.compose(seed=11)
        b = self.compose(seed=12)
        self.assertNotEqual(dot.image_hash(a['img']), dot.image_hash(b['img']))

    def test_buildings_never_overlap(self):
        res = self.compose()
        self.assertGreater(len(res['placed']), 2)
        for i, a in enumerate(res['placed']):
            for b in res['placed'][i + 1:]:
                self.assertFalse(village._hit(a['rect'], b['rect']), (a['id'], b['id']))

    def test_every_door_reaches_the_road(self):
        res = self.compose()
        self.assertEqual(res['failures'], [])
        grid = village._walkable(res['placed'], *SIZE)
        for pl in res['placed']:
            dx, dy = pl['door']
            start = (pl['rect'][0] + dx, pl['rect'][1] + dy + (1 if pl['side'] == 0 else -1))
            with self.subTest(building=pl['id']):
                self.assertTrue(village._reach(grid, start, res['road']), pl['id'])

    def test_only_pass_receipts_are_used_by_default(self):
        res = self.compose(all_=False)
        self.assertEqual(res['placed'], [])
        self.assertTrue(res['skipped'])
        self.assertTrue(all('검수' in why or '영수증' in why for _, why in res['skipped']),
                        res['skipped'])

    def test_a_matching_pass_receipt_is_used(self):
        harness.cmd_draw(H.THEME, H.ROUND, quiet=True)
        recipe = harness.AS.round_buildings(H.THEME, H.ROUND)[0]
        from PIL import Image
        rendered = harness.render_round(H.THEME, H.ROUND)[1]
        parts = harness.parts_for(H.THEME, H.ROUND, 'A', rendered)
        res = harness.AS.assemble(recipe, parts, dot.palette(H.THEME), H.THEME)
        im = res['img'].img()
        bid = f'A.{recipe["id"]}'
        d = os.path.join(dot.RUNS, H.THEME, H.ROUND, 'review')
        os.makedirs(d, exist_ok=True)
        json.dump({'schema': 'oprn-building-kit-review/1', 'theme': H.THEME, 'round': H.ROUND, 'building': bid,
                   'pixelSha256': dot.image_hash(im), 'verdict': 'PASS', 'votes': '3/3', 'complete': True,
                   'runs': [], 'reasons': [], 'issues': []},
                  open(os.path.join(d, f'{bid}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        self.assertTrue(review.passed(H.THEME, H.ROUND, bid, im))
        res2 = self.compose(all_=False)
        self.assertIn(recipe['id'], [p['recipe']['id'] for p in res2['placed']])
        self.assertEqual([b for b, _ in res2['skipped'] if b == recipe['id']], [])

    def test_stale_receipt_hash_is_not_trusted(self):
        d = os.path.join(dot.RUNS, H.THEME, H.ROUND, 'review')
        os.makedirs(d, exist_ok=True)
        json.dump({'schema': 'oprn-building-kit-review/1', 'theme': H.THEME, 'round': H.ROUND,
                   'building': 'A.cottage', 'pixelSha256': 'f' * 64, 'verdict': 'PASS', 'votes': '3/3',
                   'complete': True, 'runs': [], 'reasons': [], 'issues': []},
                  open(os.path.join(d, 'A.cottage.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        res = self.compose(all_=False)
        self.assertEqual(res['placed'], [])

    def test_write_emits_png_x2_and_html(self):
        res, html_path = village.write(H.THEME, H.ROUND, 'A', 3, SIZE, True, quiet=True)
        base = os.path.join(dot.RUNS, H.THEME, H.ROUND)
        self.assertTrue(os.path.exists(os.path.join(base, 'village-A.png')))
        self.assertTrue(os.path.exists(os.path.join(base, 'village-A-x2.png')))
        self.assertEqual(os.path.basename(html_path), f'bk-village-{H.THEME}-{H.ROUND}-A.html')
        html = open(html_path, encoding='utf-8').read()
        self.assertIn('data:image/png;base64,', html)
        self.assertNotIn('http://', html.replace('http://mdc-server:18301', ''))
        self.assertIn('PASS', html)
        self.assertGreater(len(res['placed']), 0)

    def test_northern_theme_uses_the_snow_ground(self):
        self.assertEqual(village.ground_ramp('northern-snow'), 'snow')
        self.assertEqual(village.ground_ramp(H.THEME), 'grass')
        parts = H.parts('A')
        res = village.compose('northern-snow', 'style-r3', 'A', 5, SIZE, True, parts=parts)
        pal = dot.palette('northern-snow')
        snow = {dot.hx(c) for c in pal['ramps']['snow']}
        a = res['img'].convert('RGBA')
        px = a.load()
        top_left = tuple(px[2, 2][:3])
        self.assertIn(top_left, snow, '마을 바닥이 눈 램프가 아니다')

    def test_cli_village_parses_size_and_writes(self):
        rc = harness.main(['village', H.THEME, H.ROUND, '--line', 'A', '--seed', '4', '--size', '36x24', '--all'])
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.exists(os.path.join(dot.RUNS, H.THEME, H.ROUND, 'village-A.png')))

    def test_bad_size_string_is_refused(self):
        with self.assertRaises(SystemExit):
            harness.main(['village', H.THEME, H.ROUND, '--size', 'huge'])

if __name__ == '__main__':
    unittest.main()
