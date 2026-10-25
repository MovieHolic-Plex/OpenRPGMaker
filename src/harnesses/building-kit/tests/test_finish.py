"""마감(finish) — 샌드박스 내용, check.py (a)~(g), 하네스 재검사(에이전트 말·finished.png 를 믿지 않음),
review/sheet/village/pick 의 --finished. 모델 호출 없음(가짜 에이전트 runner)."""
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import dot  # noqa: E402
import finish  # noqa: E402
import harness  # noqa: E402
import helpers as H  # noqa: E402
import review  # noqa: E402
import sheet  # noqa: E402
import village  # noqa: E402

R7 = 'style-r7'
BID = 'A.thouse.r7'

MODULE = '''import os
import sys

sys.path.insert(0, os.environ['BK_TESTS_DIR'])
sys.path.insert(0, os.environ['BK_HARNESS_DIR'])
import dot
import helpers as H

ROUND = 'style-r7'
WAVE = 'style'
ITEMS = {items!r}


def _c(item, line):
    def fn():
        return dot.Cv.of(H.compose(item, line)), {{'note': line}}
    return fn


CANDIDATES = {{item: {{'A': _c(item, 'A')}} for item in ITEMS}}
'''


def sandbox_inputs(cwd):
    leg = json.load(open(os.path.join(cwd, 'legend.json'), encoding='utf-8'))
    reg = json.load(open(os.path.join(cwd, 'regions.json'), encoding='utf-8'))
    rows = open(os.path.join(cwd, 'pixels.txt'), encoding='utf-8').read().splitlines()
    regm = np.array(Image.open(os.path.join(cwd, 'regions.png')))
    return leg, reg, rows, regm


def in_door(reg, x, y):
    return any(d['px'][0] <= x < d['px'][0] + d['px'][2] and d['px'][1] <= y < d['px'][1] + d['px'][3]
               for d in reg['doorRects'])


def legit_source(cwd, frac=0.3, seed=7):
    """손으로 쓴 것과 같은 꼴(명시 행 문자열)의 정상 마감: 지붕·벽 화소 일부를 같은 램프의 다른 단으로(점묘·낱장 변화)."""
    leg, reg, rows, regm = sandbox_inputs(cwd)
    rng = random.Random(seed)
    out = ['from finish_lib import load, row, save', 'px = load()']
    for y, line in enumerate(rows):
        s = [' '] * len(line)
        for x, ch in enumerate(line):
            if regm[y, x] not in (1, 2) or ch in '.~' or in_door(reg, x, y) or rng.random() >= frac:
                continue
            name = leg['chars'][ch]['names'][0]
            ramp, tone = name.rstrip('0123456789'), int(name[len(name.rstrip('0123456789')):])
            chars = leg['ramps'][ramp]
            new = rng.choice(chars)
            if new != ch:
                s[x] = new
        text = ''.join(s).rstrip()
        if text:
            out.append(f'row(px, 0, {y}, {text!r})')
    out.append('save(px)')
    return '\n'.join(out) + '\n'


def write_and_run(cwd, src):
    open(os.path.join(cwd, 'finish_draw.py'), 'w', encoding='utf-8').write(src)
    subprocess.run([sys.executable, 'finish_draw.py'], cwd=cwd, capture_output=True, text=True, timeout=120)


def run_check(cwd):
    subprocess.run([sys.executable, 'check.py'], cwd=cwd, capture_output=True, text=True, timeout=120)
    return json.load(open(os.path.join(cwd, 'check.json'), encoding='utf-8'))


def failed(res):
    return {k for k, c in res['checks'].items() if not c['ok']}


class FinishBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-finish-')
        self._dot = (dot.DATA, dot.RUNS, dot.VIZ)
        self._env = dict(os.environ)
        shutil.copytree(os.path.join(dot.DATA, H.THEME), os.path.join(self.tmp, 'data', H.THEME))
        ledger = os.path.join(self.tmp, 'data', H.THEME, 'ledger.json')
        if os.path.exists(ledger):
            os.remove(ledger)
        dot.DATA = os.path.join(self.tmp, 'data')
        dot.RUNS = os.path.join(self.tmp, 'runs')
        dot.VIZ = os.path.join(self.tmp, 'viz')
        os.environ.pop('BUILDING_KIT_FINISH_DIR', None)
        os.environ['BK_TESTS_DIR'] = HERE
        os.environ['BK_HARNESS_DIR'] = os.path.dirname(HERE)
        dot._PAL.clear()
        seed_path = os.path.join(dot.DATA, H.THEME, 'seed.json')
        s = json.load(open(seed_path, encoding='utf-8'))
        path = os.path.join(dot.DATA, H.THEME, 'round_style_r7.py')
        open(path, 'w', encoding='utf-8').write(MODULE.format(items=s['rounds'][R7]['items']))
        s['rounds'][R7]['module'] = path
        s['rounds'][R7].pop('reuseParts', None)
        json.dump(s, open(seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    def tearDown(self):
        dot.DATA, dot.RUNS, dot.VIZ = self._dot
        dot._PAL.clear()
        os.environ.clear()
        os.environ.update(self._env)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def item(self):
        items, skipped = finish.eligible(H.THEME, R7, 'A', 'thouse.r7')
        self.assertEqual([i['bid'] for i in items], [BID], skipped)
        return items[0]

    def sandbox(self):
        path, meta, text = finish.sandbox_for(H.THEME, R7, self.item())
        return path, meta, text

    def runner(self, src_of, after=None):
        calls = []

        def run(cmd, prompt, cwd, timeout):
            calls.append((cmd, prompt, cwd))
            write_and_run(cwd, src_of(cwd))
            if after:
                after(cwd)
            return 0, 'finished', ''
        return run, calls

    def finish_legit(self):
        run, calls = self.runner(legit_source)
        rc = finish.run(H.THEME, R7, 'A', 'thouse.r7', runner=run, cmd=['fake-agent'], quiet=True)
        return rc, calls, json.load(open(os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.json'), encoding='utf-8'))


class SandboxTest(FinishBase):
    def test_sandbox_holds_inputs_refs_brief_and_tools(self):
        path, meta, text = self.sandbox()
        for f in ('base.png', 'mask.png', 'pixels.txt', 'legend.json', 'regions.json', 'regions.png', 'shade.png',
                  'finish_lib.py', 'check.py', 'BRIEF.md', 'refs/compare.png', 'refs/palette.png', 'refs/bd-house-inn-1x.png',
                  'refs/bd-house-inn-4x.png'):
            self.assertTrue(os.path.exists(os.path.join(path, f)), f)
        base = Image.open(os.path.join(path, 'base.png')).convert('RGBA')
        mask = np.array(Image.open(os.path.join(path, 'mask.png')))
        self.assertTrue((mask == np.array(base)[:, :, 3]).all())
        rows = open(os.path.join(path, 'pixels.txt'), encoding='utf-8').read().splitlines()
        self.assertEqual((len(rows[0]), len(rows)), base.size)
        leg = json.load(open(os.path.join(path, 'legend.json'), encoding='utf-8'))
        self.assertTrue(set(''.join(rows)) <= set(leg['chars']) | {'.', '~'})
        self.assertNotIn('~', ''.join(rows), '골 이음 ㅜ자 집 그림자는 본채 벽에만 — 반투명 땅 그림자 글자가 없다')
        self.assertTrue(np.array(Image.open(os.path.join(path, 'shade.png'))).any())
        for phrase in ('버들항 수준은 아니다', '16px', '꽃상자', '징', '왼쪽 위', 'finish_draw.py', 'check.py'):
            self.assertIn(phrase, text)

    def test_legend_has_a_glyph_for_every_northern_colour(self):
        """북방은 설원 램프를 더해 91색 — ASCII 범례(84자)로는 모자랐다(마감이 시작도 못 했다)."""
        shutil.copytree(os.path.join(self._dot[0], 'northern-snow'), os.path.join(dot.DATA, 'northern-snow'),
                        ignore=shutil.ignore_patterns('ledger.json', 'picked'))
        leg = finish.legend('northern-snow')
        pal = dot.palette('northern-snow')
        colours = {c.lower() for r in pal['ramps'].values() for c in r} | {c.lower() for c in pal['allowed']}
        self.assertEqual({v['hex'] for v in leg['chars'].values()}, colours)
        self.assertEqual(len(leg['chars']), len(set(leg['chars'])))
        self.assertFalse({'.', '~'} & set(leg['chars']))
        self.assertEqual(list(finish.legend(H.THEME)['chars'])[:5], list(finish.CHARS[:5]))

    def test_untouched_grid_renders_back_to_the_exact_base(self):
        path, _, _ = self.sandbox()
        write_and_run(path, 'from finish_lib import load, save\npx = load()\nsave(px)\n')
        a = np.array(Image.open(os.path.join(path, 'finished.png')).convert('RGBA'))
        b = np.array(Image.open(os.path.join(path, 'base.png')).convert('RGBA'))
        self.assertTrue((a == b).all())
        self.assertTrue(os.path.exists(os.path.join(path, 'preview', 'compare.png')))


class CheckTest(FinishBase):
    def test_no_op_fails_changed_and_periodicity(self):
        path, _, _ = self.sandbox()
        write_and_run(path, 'from finish_lib import load, save\npx = load()\nsave(px)\n')
        res = run_check(path)
        self.assertEqual(failed(res), {'f_changed', 'g_period'})

    def test_hand_made_edit_passes_every_check(self):
        path, _, _ = self.sandbox()
        write_and_run(path, legit_source(path))
        res = run_check(path)
        self.assertTrue(res['pass'], {k: c['msg'] for k, c in res['checks'].items() if not c['ok']})
        g = res['checks']['g_period']
        self.assertLess(g['roof']['finished'], g['roof']['base'])
        self.assertLess(g['wall']['finished'], g['wall']['base'])

    def test_silhouette_change_fails_mask(self):
        path, _, _ = self.sandbox()
        write_and_run(path, legit_source(path))
        im = Image.open(os.path.join(path, 'finished.png')).convert('RGBA')
        a = np.array(im)
        ys, xs = np.nonzero(a[:, :, 3] == 0)
        a[ys[0], xs[0]] = (120, 60, 40, 255)
        Image.fromarray(a, 'RGBA').save(os.path.join(path, 'finished.png'))
        self.assertIn('a_mask', failed(run_check(path)))

    def test_lib_refuses_to_paint_transparent_pixels(self):
        path, _, _ = self.sandbox()
        r = subprocess.run([sys.executable, '-c', 'import finish_lib as f; px = f.load(); f.put(px, 0, 0, f.L("roof", 1))'],
                           cwd=path, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('윤곽', r.stderr)

    def test_off_palette_colour_fails(self):
        path, _, _ = self.sandbox()
        write_and_run(path, legit_source(path))
        a = np.array(Image.open(os.path.join(path, 'finished.png')).convert('RGBA'))
        ys, xs = np.nonzero(a[:, :, 3] == 255)
        a[ys[0], xs[0], :3] = (1, 2, 3)
        Image.fromarray(a, 'RGBA').save(os.path.join(path, 'finished.png'))
        self.assertIn('c_palette', failed(run_check(path)))

    def test_noise_generating_code_fails(self):
        path, _, _ = self.sandbox()
        bad = {
            'random': 'import random\nfrom finish_lib import load, L, put, save\npx = load()\nput(px, 40, 40, L("roof", random.randint(0, 4)))\nsave(px)\n',
            'area loop': 'from finish_lib import load, L, put, get, save\npx = load()\nfor y in range(208):\n    for x in range(128):\n'
                         '        if get(px, x, y) == L("roof", 2):\n            put(px, x, y, L("roof", (x * 7 + y * 3) // 5 // 1 and 1))\nsave(px)\n',
            'modulo': 'from finish_lib import load, L, row, save\npx = load()\nrow(px, 0, 40, L("roof", 40 % 3))\nsave(px)\n',
            'lib internals': 'import finish_lib\npx = finish_lib.load()\nim = finish_lib.Image.open("refs/bd-house-inn-1x.png")\nfinish_lib.save(px)\n',
            'numpy': 'import numpy as np\nfrom finish_lib import load, save\npx = load()\nsave(px)\n',
        }
        for name, src in bad.items():
            with self.subTest(name):
                open(os.path.join(path, 'finish_draw.py'), 'w', encoding='utf-8').write(src)
                res = run_check(path)
                self.assertFalse(res['checks']['e_code']['ok'], name)

    def test_door_leaf_painted_over_fails(self):
        path, _, _ = self.sandbox()
        leg, reg, rows, _ = sandbox_inputs(path)
        x0, y0, w, h = reg['doorRects'][0]['px']
        plaster = leg['ramps']['plaster'][3]
        src = legit_source(path).replace('save(px)\n', '') + ''.join(
            f'row(px, {x0 + 2}, {y}, {plaster * (w - 4)!r})\n' for y in range(y0 + 2, y0 + h - 2)) + 'save(px)\n'
        write_and_run(path, src)
        self.assertIn('b_door', failed(run_check(path)))

    def test_eave_line_moved_fails(self):
        path, _, _ = self.sandbox()
        leg, reg, rows, regm = sandbox_inputs(path)
        roof = set(reg['roofChars'])
        y = next(y for y in range(len(rows) - 1) if sum(1 for x in range(len(rows[0]))
                                                         if rows[y][x] in roof and rows[y + 1][x] not in roof | {'.', '~'}) > 20)
        plaster = leg['ramps']['plaster'][2]
        xs = [x for x in range(len(rows[0])) if rows[y][x] in roof and rows[y + 1][x] not in roof | {'.', '~'}]
        lines = []
        for yy in (y - 2, y - 1, y):
            s = ''.join(plaster if (x in xs and rows[yy][x] not in '.~') else ' ' for x in range(len(rows[0]))).rstrip()
            lines.append(f'row(px, 0, {yy}, {s!r})\n')
        write_and_run(path, legit_source(path).replace('save(px)\n', '') + ''.join(lines) + 'save(px)\n')
        self.assertIn('d_eaves', failed(run_check(path)))


class RecheckTest(FinishBase):
    def test_harness_reruns_and_records_a_passing_finish(self):
        rc, calls, rec = self.finish_legit()
        self.assertEqual(rc, 0)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0], ['fake-agent'])
        self.assertTrue(rec['pass'] and rec['reproduced'])
        png = os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.png')
        self.assertEqual(dot.image_hash(Image.open(png)), rec['finishedSha256'])
        self.assertTrue(os.path.exists(os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.finish_draw.py')))
        self.assertGreaterEqual(rec['check']['checks']['f_changed']['frac'], finish.MIN_CHANGED)
        cands, why = finish.finished_candidates(H.THEME, R7)
        self.assertEqual(list(cands), [BID], why)

    def test_finished_png_not_made_by_finish_draw_is_rejected(self):
        def tamper(cwd):
            a = np.array(Image.open(os.path.join(cwd, 'finished.png')).convert('RGBA'))
            ys, xs = np.nonzero(a[:, :, 3] == 255)
            j = next(j for j in range(1, len(ys)) if (a[ys[j], xs[j], :3] != a[ys[0], xs[0], :3]).any())
            a[ys[0], xs[0], :3] = a[ys[j], xs[j], :3]
            Image.fromarray(a, 'RGBA').save(os.path.join(cwd, 'finished.png'))
        run, _ = self.runner(legit_source, tamper)
        rc = finish.run(H.THEME, R7, 'A', 'thouse.r7', runner=run, cmd=['fake'], quiet=True)
        rec = json.load(open(os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.json'), encoding='utf-8'))
        self.assertEqual(rc, 1)
        self.assertFalse(rec['reproduced'])
        self.assertFalse(rec['pass'])
        self.assertEqual(finish.finished_candidates(H.THEME, R7)[0], {})

    def test_agent_cannot_pass_by_editing_its_check_copy(self):
        def cheat(cwd):
            open(os.path.join(cwd, 'check.py'), 'w', encoding='utf-8').write(
                'import json\njson.dump({"pass": True, "checks": {}}, open("check.json", "w"))\n')
        run, _ = self.runner(lambda cwd: 'import random\nfrom finish_lib import load, save\npx = load()\nsave(px)\n', cheat)
        finish.run(H.THEME, R7, 'A', 'thouse.r7', runner=run, cmd=['fake'], quiet=True)
        rec = json.load(open(os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.json'), encoding='utf-8'))
        self.assertFalse(rec['pass'])
        self.assertFalse(rec['check']['checks']['e_code']['ok'])
        self.assertFalse(rec['check']['checks']['f_changed']['ok'])


def answer_all(run_dir):
    key = json.load(open(os.path.join(run_dir, 'key.json'), encoding='utf-8'))
    return '\n'.join(json.dumps({'id': sid, 'view34': 'FAIL' if k['kind'] == 'probe' else 'PASS',
                                 'quality': 'FAIL' if k['kind'] == 'probe' else 'PASS', 'reason': 'x'}) for sid, k in key.items())


class FinishedFlowTest(FinishBase):
    def setUp(self):
        super().setUp()
        rc, _, self.rec = self.finish_legit()
        self.assertEqual(rc, 0)
        self.fin = Image.open(os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.png')).convert('RGBA')

    def review_finished(self):
        def judge(prompt, images, work, model, effort, timeout):
            return answer_all(os.path.dirname(work))
        return review.run(H.THEME, R7, runs=3, judge_runner=judge, seed=3, quiet=True, finished=True)

    def test_review_finished_judges_finished_pixels_and_probes_come_from_them(self):
        prep = review.prepare(H.THEME, R7, review.parts_by_key(H.THEME, R7), seed=2, finished=True)
        self.assertIn(os.sep + 'review-finished' + os.sep, prep['dir'])
        key = json.load(open(os.path.join(prep['dir'], 'key.json'), encoding='utf-8'))
        cands = {v['name']: v['pixelSha256'] for v in key.values() if v['kind'] == 'candidate'}
        self.assertEqual(cands, {BID: self.rec['finishedSha256']})
        sid = next(s for s, v in key.items() if v['kind'] == 'probe' and v['name'] == 'roof_gap')
        probe = np.array(Image.open(os.path.join(prep['dir'], f'{sid}.native.png')).convert('RGBA'))
        self.assertTrue((probe[:16] == np.array(self.fin)[:16]).all())
        self.assertEqual(self.review_finished(), 0)
        self.assertTrue(review.passed(H.THEME, R7, BID, self.fin, finished=True))
        self.assertFalse(review.passed(H.THEME, R7, BID, self.fin))
        self.assertTrue(review.receipt(H.THEME, R7, BID, finished=True)['finished'])

    def test_sheet_finished_shows_finished_hash_and_pick_binds_it(self):
        self.review_finished()
        self.assertEqual(sheet.write(H.THEME, R7, finished=True), 0)
        html = open(os.path.join(dot.VIZ, f'bk-{H.THEME}-{R7}-finished.html'), encoding='utf-8').read()
        sha = self.rec['finishedSha256']
        self.assertIn(f'pick {H.THEME} {R7} thouse.r7 A --sha {sha[:8]} --finished', html)
        shown = json.load(open(os.path.join(finish.out_dir(H.THEME, R7), 'sheet.json'), encoding='utf-8'))['shown']
        self.assertEqual(shown, {BID: sha})
        with self.assertRaises(SystemExit):
            harness.cmd_pick_finished(H.THEME, R7, 'thouse.r7', 'A', 'deadbeef', '')
        with self.assertRaises(SystemExit):
            harness.cmd_pick_finished(H.THEME, R7, 'thouse.r7', 'A', sha[:8], '', by='agent')
        harness.cmd_pick_finished(H.THEME, R7, 'thouse.r7', 'A', sha[:8], 'good')
        out = harness.finished_picked_path(H.THEME, 'A', 'thouse.r7')
        self.assertEqual(dot.image_hash(Image.open(out)), sha)
        picks = harness.ledger(H.THEME)['finishedPicks']
        self.assertEqual([(p['building'], p['sha256'], p['baseSha256']) for p in picks],
                         [('thouse.r7', sha, self.rec['baseSha256'])])

    def test_sheet_without_finished_review_lists_nothing_to_pick(self):
        sheet.write(H.THEME, R7, finished=True)
        shown = json.load(open(os.path.join(finish.out_dir(H.THEME, R7), 'sheet.json'), encoding='utf-8'))['shown']
        self.assertEqual(shown, {})
        with self.assertRaises(SystemExit):
            harness.cmd_pick_finished(H.THEME, R7, 'thouse.r7', 'A', self.rec['finishedSha256'][:8], '')

    def test_village_finished_places_finished_pixels(self):
        self.review_finished()
        res = village.compose(H.THEME, R7, 'A', finished=True)
        self.assertEqual(dot.image_hash(res['images']['thouse.r7']), self.rec['finishedSha256'])
        plain = village.compose(H.THEME, R7, 'A', all_=True)
        self.assertEqual(dot.image_hash(plain['images']['thouse.r7']), self.rec['baseSha256'])

    def test_stale_base_drops_the_finished_building(self):
        rec_p = os.path.join(finish.out_dir(H.THEME, R7), f'{BID}.json')
        rec = json.load(open(rec_p, encoding='utf-8'))
        rec['baseSha256'] = '0' * 64
        json.dump(rec, open(rec_p, 'w', encoding='utf-8'))
        cands, why = finish.finished_candidates(H.THEME, R7)
        self.assertEqual(cands, {})
        self.assertIn('바탕', why[BID])


if __name__ == '__main__':
    unittest.main()
