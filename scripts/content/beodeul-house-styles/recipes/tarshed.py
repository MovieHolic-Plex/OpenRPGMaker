"""tarshed(타르 칠한 어막 마을) 조립 순서 — 검은 타르 세로 널벽(wall)과 붉은 비늘판벽(wall2), 은회색 너와 지붕, 흰 모서리 널·박공널, 붉은 문. 좁고 높은 박공이 줄지어 선다.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='shingle', corner=('frame:3', 'frame:2', 'frame:0'), barge=('frame:3', 'frame:2', 'frame:1', 'frame:0'),
             borrow=('halftimber', dict(ridge='ridge', eave='eave', smoke='smoke', stair='stair', sign='sign'), dict(plaster='frame')))
S, T, Rd = 'stone', 'wall', 'wall2'


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 5); v = b.g(2, 60, [(S, 5), (T, 28)], 24, 20)
    v.at('win-plain', 40, lift=8).gable(up=3); b.add('nets', 36, 78, crop=(0, 0, 26, 24)); H['shed'] = b.done()
    b = B(5, 5); v = b.e(2, 76, [(S, 5), (T, 26)], 38)
    v.roof('chimney', 14, 26).at('win-six', 26, lift=4).ground('rack', 0, crop=(0, 0, 44, 30)); H['bothy'] = b.done()
    # ── 살림집 ──
    b = B(5, 7); v = b.g(3, 74, [(S, 6), (T, 30), (T, 28)], 20, 26, ov=3)
    v.at('hoist', 25, 2, lift=-4).at('win-six', 48, 1, lift=6).at('win-plain', 54, 2, lift=8).at('win-plain', 8, 2, lift=8); b.add('nets', 36, 104); H['netloft'] = b.done()
    b = B(7, 6); m = b.e(2, 108, [(S, 5), (T, 28)], 38); g = b.g(64, 44, [(S, 5), (T, 28)], 22, 18, gable=Rd)
    m.roof('chimney', 20, 26).at('win-six', 8, lift=5).at('win-six', 34, lift=5); g.gable(up=2); b.add('clutter', 2, 96, crop=(0, 0, 30, 16)); H['crossshed'] = b.done()
    b = B(6, 6); g1 = b.g(2, 40, [(S, 5), (T, 30), (T, 14)], 18, 18); g2 = b.g(46, 22, [(S, 5), (Rd, 34)], 14, 10); g3 = b.g(72, 22, [(S, 5), (T, 40)], 14, 10)
    g1.gable(up=2).at('win-six', 22, 1, lift=6); g2.at('win-attic', 6, 1, lift=12); g3.at('win-attic', 6, 1, lift=18); b.add('clutter', 50, 96, crop=(0, 0, 44, 16)); H['rowsheds'] = b.done()
    # ── 큰 집 ──
    b = B(8, 7); lo = b.e(62, 64, [(S, 6), (T, 30)], 36); g = b.g(3, 60, [(S, 6), (Rd, 30), (Rd, 28)], 22, 22, ov=3)
    g.at('win-six', 8, 2, lift=5).at('win-six', 38, 2, lift=5).gable(up=3).at('win-six', 40, 1, lift=6); lo.roof('chimney', 40, 24).at('win-shutter', 8, lift=6).ground('rack', 20, crop=(0, 0, 44, 30)); H['skipper'] = b.done()
    b = B(9, 6); v = b.e(2, 140, [(S, 5), (T, 37)], 38)
    v.roof('chimney', 20, 24).roof('chimney', 110, 24).ground('saltbay', 4).at('win-six', 86, lift=10).at('win-six', 112, lift=10); b.add('clutter', 100, 96, crop=(0, 0, 44, 16)); H['saltery'] = b.done()
    # ── 가게집 ──
    b = B(6, 6, door='door-shop'); v = b.g(2, 92, [(S, 5), (T, 30)], 26, 26, gable=Rd)
    v.gable('hoist', pw=24, up=-6).at('win-six', 8, lift=6).at('win-six', 34, lift=6); b.add('sign-shop', 0, 62).add('clutter', 2, 96, crop=(0, 0, 18, 16)); H['chandlery'] = b.done()
    b = B(7, 5, door='door-shop'); v = b.e(2, 108, [(S, 5), (T, 28)], 38)
    v.roof('chimney', 84, 26).at('win-six', 38, lift=5).ground('rack', 62); b.add('sign-shop', 0, 56); H['fishshop'] = b.done()
    # ── 여관 · 일터 · 예배당 ──
    b = B(11, 7); m = b.e(2, 118, [(S, 6), (T, 28), (Rd, 26)], 38); g = b.g(118, 56, [(S, 6), (T, 28), (Rd, 26)], 26, 22)
    m.roof('chimney', 16, 26).roof('chimney', 92, 26).at('win-six', 8, 2, lift=4).at('win-six', 34, 2, lift=4).at('win-six', 60, 2, lift=4).at('win-six', 88, 2, lift=4).at('win-shutter', 4, 1, lift=6).at('win-shutter', 38, 1, lift=6)
    g.at('win-six', 21, 2, lift=4).gable(up=3).at('win-six', 21, 1, lift=6); b.add('deck', 0, 112, w=176).add('sign', 100, 92); H['inn'] = b.done()
    b = B(8, 6); g = b.g(2, 84, [(S, 4), (T, 34)], 24, 26); e = b.e(88, 38, [(S, 4), (T, 26)], 28)
    g.ground('boatdoor', 18).gable('hoist', pw=24, up=-2); e.roof('chimney', 22, 22); H['boatshed'] = b.done()
    b = B(6, 9); n = b.g(8, 80, [(S, 6), (T, 40)], 28, 30, ov=4); t = b.g(32, 32, [(T, 118)], 12, 12)
    n.at('win-six', 4, 1, lift=10).at('win-six', 62, 1, lift=10); t.at('belfry', 4, 0, lift=84).at('win-attic', 11, 0, lift=50); H['chapel'] = b.done()
    return H
