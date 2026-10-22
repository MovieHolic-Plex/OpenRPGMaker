"""독립 검수 — 함정 통과 시 무효, 유효 3회 다수결, 영수증 해시, key.json 위치. 판정자는 가짜."""
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
import helpers as H  # noqa: E402
import review  # noqa: E402


def answer_for(run_dir, verdict='PASS', probe_verdict='FAIL', skip=()):
    key = json.load(open(os.path.join(run_dir, 'key.json'), encoding='utf-8'))
    lines = []
    for sid, k in key.items():
        if sid in skip:
            continue
        v = probe_verdict if k['kind'] == 'probe' else verdict
        lines.append(json.dumps({'id': sid, 'view34': v, 'quality': v, 'reason': f'{k["name"]} {v}'}))
    return '\n'.join(lines)


class ReviewTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='bk-review-')
        self._dot_runs = dot.RUNS
        dot.RUNS = self.tmp
        self.parts = {line: H.parts(line) for line in 'ABC'}

    def tearDown(self):
        dot.RUNS = self._dot_runs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def prepare(self, seed=1):
        return review.prepare(H.THEME, H.ROUND, self.parts, seed=seed)

    def test_key_lives_outside_judge_folder_and_boards_inside(self):
        prep = self.prepare()
        key = os.path.join(prep['dir'], 'key.json')
        self.assertTrue(os.path.exists(key))
        self.assertFalse(key.startswith(prep['work'] + os.sep))
        self.assertTrue(all(p.startswith(prep['work']) for p in prep['images']))
        kinds = {v['kind'] for v in json.load(open(key)).values()}
        self.assertEqual(kinds, {'candidate', 'probe'})

    def test_transparent_pixels_show_ground_on_the_board(self):
        """투명 틈은 카드의 어두운 바탕이 아니라 풀 땅으로 보여야 한다(처마 그림자와 구분)."""
        from PIL import Image
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        card = review._card('x', im, k=2)
        self.assertEqual(card.getpixel((4 + 5, 18 + 5)), review.GROUND)

    def test_all_six_probe_kinds_are_on_the_board(self):
        prep = self.prepare()
        key = json.load(open(os.path.join(prep['dir'], 'key.json')))
        names = {v['name'] for v in key.values() if v['kind'] == 'probe'}
        self.assertEqual(names, set(review.PROBE_NAMES))

    def test_three_valid_runs_give_majority_pass(self):
        for _ in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir']), 'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertTrue(agg['complete'])
        self.assertEqual(agg['valid'], 3)
        for bid, v in agg['candidates'].items():
            self.assertEqual(v['verdict'], 'PASS', bid)
            self.assertEqual(v['votes'], '3/3')

    def test_runs_that_saw_other_pixels_are_not_counted(self):
        """그림이 바뀐 뒤에는 옛 회차(다른 화소를 본 판정)를 새 그림의 표로 세지 않는다."""
        for _ in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir']), 'fake/judge')
        changed = {line: {i: dict(p) for i, p in parts.items()} for line, parts in self.parts.items()}
        item = next(iter(changed['A']))
        img = changed['A'][item]['img'].copy()
        w, h = img.size
        x, y = next((x, y) for y in range(h) for x in range(w) if img.getpixel((x, y))[3] == 255)
        r, g, b, a = img.getpixel((x, y))
        img.putpixel((x, y), (255 - r, g, b, a))
        changed['A'][item]['img'] = img
        prep = review.prepare(H.THEME, H.ROUND, changed, seed=9)
        agg = review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir']), 'fake/judge')
        self.assertEqual(agg['valid'], 1)
        self.assertFalse(agg['complete'])
        self.assertTrue(all(v['verdict'] == 'none' for v in agg['candidates'].values()))

    def test_injected_judge_is_labelled_as_injected(self):
        def runner(prompt, images, work, model, effort, timeout):
            return answer_for(os.path.dirname(work))
        review.run(H.THEME, H.ROUND, runs=3, judge_runner=runner, parts=self.parts, seed=11, quiet=True)
        agg = json.load(open(os.path.join(self.tmp, H.THEME, H.ROUND, 'review', 'result.json')))
        self.assertTrue(agg['judge'] and all(j.startswith('injected:') for j in agg['judge']), agg['judge'])

    def test_probe_passed_voids_the_run_and_it_is_not_counted(self):
        prep = self.prepare()
        review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir'], probe_verdict='PASS'), 'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertEqual(agg['valid'], 0)
        self.assertEqual(agg['void'], 1)
        self.assertFalse(agg['complete'])
        self.assertTrue(any('함정' in v for v in agg['voids']))
        for _ in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir']), 'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertTrue(agg['complete'])
        self.assertEqual(agg['valid'], 3)
        self.assertEqual(agg['void'], 1)

    def test_missing_sample_voids_the_run(self):
        prep = self.prepare()
        review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir'], skip=('S1',)), 'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertEqual(agg['valid'], 0)
        self.assertTrue(any('빠뜨렸' in v for v in agg['voids']))

    def test_one_of_three_passing_is_a_fail(self):
        for i in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir'], verdict='PASS' if i == 0 else 'FAIL'),
                         'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertTrue(agg['complete'])
        for bid, v in agg['candidates'].items():
            self.assertEqual(v['verdict'], 'FAIL', bid)
            self.assertEqual(v['votes'], '1/3')

    def test_two_of_three_passing_is_a_pass(self):
        for i in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir'], verdict='PASS' if i < 2 else 'FAIL'),
                         'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        for bid, v in agg['candidates'].items():
            self.assertEqual(v['verdict'], 'PASS', bid)
            self.assertEqual(v['votes'], '2/3')

    def test_receipt_binds_pixel_hash_and_answer_hash(self):
        for _ in range(3):
            prep = self.prepare()
            review.score(H.THEME, H.ROUND, prep['run'], answer_for(prep['dir']), 'fake/judge')
        agg = review.aggregate(H.THEME, H.ROUND)
        bid = sorted(agg['candidates'])[0]
        rec = review.receipt(H.THEME, H.ROUND, bid)
        self.assertEqual(rec['schema'], 'oprn-building-kit-review/1')
        self.assertEqual(rec['pixelSha256'], agg['candidates'][bid]['pixelSha256'])
        self.assertTrue(rec['complete'])
        self.assertEqual(len(rec['runs']), 3)
        self.assertTrue(all(len(r['answerSha256']) == 64 for r in rec['runs']))
        parts = self.parts[bid.split('.')[0]]
        img = review.candidates_for(H.THEME, H.ROUND, {bid.split('.')[0]: parts})[bid]['img']
        self.assertTrue(review.passed(H.THEME, H.ROUND, bid, img))
        changed = img.copy()
        changed.putpixel((0, 0), (255, 0, 255, 255))
        self.assertFalse(review.passed(H.THEME, H.ROUND, bid, changed))

    def test_judge_runner_is_injectable_and_retries_void_runs(self):
        calls = []

        def runner(prompt, images, workdir, model=None, effort=None, timeout=None):
            run = os.path.basename(os.path.dirname(os.path.dirname(images[0])))
            calls.append(run)
            verdict = 'PASS'
            probe = 'PASS' if len(calls) == 1 else 'FAIL'
            return answer_for(os.path.dirname(images[0]).rsplit(os.sep, 1)[0], verdict=verdict, probe_verdict=probe)

        rc = review.run(H.THEME, H.ROUND, runs=3, judge_runner=runner, parts=self.parts, seed=7, quiet=True)
        self.assertEqual(rc, 0)
        self.assertEqual(len(calls), 4)
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertEqual((agg['valid'], agg['void']), (3, 1))

    def test_run_gives_up_when_budget_is_spent(self):
        def runner(prompt, images, workdir, model=None, effort=None, timeout=None):
            run_dir = os.path.dirname(images[0]).rsplit(os.sep, 1)[0]
            return answer_for(run_dir, probe_verdict='PASS')

        rc = review.run(H.THEME, H.ROUND, runs=3, judge_runner=runner, parts=self.parts, seed=3, quiet=True)
        self.assertEqual(rc, 1)
        agg = review.aggregate(H.THEME, H.ROUND)
        self.assertEqual(agg['valid'], 0)
        self.assertEqual(len(review._runs(os.path.join(self.tmp, H.THEME, H.ROUND, 'review'))), 5)

    def test_judge_process_failure_records_nothing(self):
        def runner(*a, **k):
            raise RuntimeError('claude exited 1')

        with self.assertRaises(SystemExit):
            review.run(H.THEME, H.ROUND, runs=3, judge_runner=runner, parts=self.parts, seed=5, quiet=True)
        self.assertEqual(review._runs(os.path.join(self.tmp, H.THEME, H.ROUND, 'review')), [])


if __name__ == '__main__':
    unittest.main()
