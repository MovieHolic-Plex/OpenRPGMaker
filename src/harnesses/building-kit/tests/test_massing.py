"""덩어리 모형 → 실제 건물(massing) — 기계 검사, 함정 무효, 위임 허용 조건. 그림·판정자는 가짜(테스트 전용 임시 폴더)."""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import massing as M  # noqa: E402


class MassingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.saved = {k: getattr(M, k) for k in ('DATA', 'ART', 'REVIEWS', 'RUNS')}
        M.DATA = os.path.join(self.tmp, 'data')
        M.ART = os.path.join(M.DATA, 'art')
        M.REVIEWS = os.path.join(M.DATA, 'reviews')
        M.RUNS = os.path.join(self.tmp, 'runs')
        os.makedirs(M.ART)
        shutil.copy(os.path.join(self.saved['DATA'], 'palette.json'), os.path.join(M.DATA, 'palette.json'))
        legend = json.load(open(os.path.join(M.DATA, 'palette.json'), encoding='utf-8'))['legend']
        lum = sorted(legend, key=lambda c: sum(M.dot.hx(legend[c])))
        self.mid, self.light = lum[len(lum) // 2], lum[-3]

    def tearDown(self):
        for k, v in self.saved.items():
            setattr(M, k, v)
        shutil.rmtree(self.tmp)

    def write(self, bid, rows, walk, **extra):
        open(os.path.join(M.ART, f'{bid}.txt'), 'w', encoding='utf-8').write('\n'.join(rows) + '\n')
        meta = {'id': bid, 'name': bid, 'massing': 'M01', 'material': 'plaster', 'walk': walk, **extra}
        json.dump(meta, open(os.path.join(M.ART, f'{bid}.json'), 'w', encoding='utf-8'))

    def solid(self, w=2, h=2):
        rows = []
        for y in range(h * 16):
            rows.append(''.join(self.light if (x + y) % 3 else self.mid for x in range(w * 16)))
        return rows

    def test_ok_building(self):
        self.write('ok', self.solid(), ['**', 'DX'])
        fails, _ = M.check('ok', quiet=True)
        self.assertEqual(fails, [])

    def test_two_doors_fail(self):
        self.write('two', self.solid(), ['**', 'DD'])
        fails, _ = M.check('two', quiet=True)
        self.assertTrue(any('문은' in f for f in fails), fails)

    def test_door_not_on_bottom_row_fail(self):
        self.write('up', self.solid(), ['D*', 'XX'])
        fails, _ = M.check('up', quiet=True)
        self.assertTrue(any('맨 아래' in f for f in fails), fails)

    def test_walk_mismatch_and_ground_cell(self):
        rows = self.solid()
        rows = [r[:16] + '.' * 16 if y >= 16 else r for y, r in enumerate(rows)]
        self.write('gap', rows, ['**', 'DX'])
        fails, _ = M.check('gap', quiet=True)
        self.assertTrue(any('비었는데' in f for f in fails), fails)
        self.write('walkover', self.solid(), ['**', 'D*'])
        fails, _ = M.check('walkover', quiet=True)
        self.assertTrue(any('땅 닿는 칸' in f for f in fails), fails)
        self.write('passage', self.solid(), ['**', 'D*'], passages=[[1, 1]])
        fails, _ = M.check('passage', quiet=True)
        self.assertEqual(fails, [])

    def test_off_palette_fail(self):
        rows = self.solid()
        rows[3] = '€' + rows[3][1:]
        self.write('pal', rows, ['**', 'DX'])
        fails, _ = M.check('pal', quiet=True)
        self.assertTrue(any('팔레트 밖' in f for f in fails), fails)

    def test_decoy_not_caught_voids_batch(self):
        self.write('a', self.solid(), ['**', 'DX'])
        self.write('b', self.solid(3, 2), ['***', 'XDX'])
        root = M.review_pack('t1', ['a', 'b'], decoy_from='a')
        key = json.load(open(os.path.join(root, 'key.json')))
        self.assertEqual(sum(1 for k in key.values() if k['kind'] == 'decoy'), 1)
        out = os.path.join(root, 'out', 'argon')
        os.makedirs(out)
        for code in key:
            open(os.path.join(out, f'{code}.md'), 'w').write('MAJOR: none\nVERDICT: PASS\n')
        self.assertEqual(M.review_collect('t1', 'argon'), 1)
        self.assertFalse(os.path.isdir(M.REVIEWS))
        decoy = next(c for c, k in key.items() if k['kind'] == 'decoy')
        open(os.path.join(out, f'{decoy}.md'), 'w').write('MAJOR: gap\nVERDICT: FAIL\n')
        self.assertEqual(M.review_collect('t1', 'argon'), 0)
        sha = M.pixel_sha('a')
        self.assertEqual(M.review_state('a', sha)['argon'][0], 'PASS')

    def test_decoy_has_transparent_cut(self):
        img = M.image(self.solid())
        cut = M._decoy(img)
        import numpy as np
        a = np.array(cut)[..., 3]
        self.assertTrue((a == 0).all(axis=1).any())

    def test_decide_needs_both_reviewers(self):
        self.write('a', self.solid(), ['**', 'DX'])
        sha = M.pixel_sha('a')
        os.makedirs(os.path.join(M.REVIEWS, 'a'))
        open(os.path.join(M.REVIEWS, 'a', f'{sha[:12]}-argon.md'), 'w').write('VERDICT: PASS\n')
        orig_state = M.state

        def fake_state(bid):
            st = orig_state(bid)
            st.update(gate='pass', held=None, exit=None)
            return st
        M.state = fake_state
        try:
            M.decide()
            log = json.load(open(os.path.join(M.DATA, 'decisions.json')))
            self.assertEqual(log['log'], [])
        finally:
            M.state = orig_state


if __name__ == '__main__':
    unittest.main()
