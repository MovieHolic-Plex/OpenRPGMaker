"""harbourstone(항구 석조) 조립 순서 — 짙은 막돌 밑동 위 밝은 사암 벽(wall), 녹슨 주황 지붕의 박공이 어깨를 맞대고 선다. 박공 정면 지붕의 줄은 용마루와 나란하다(gface 'rot'). 귀돌·둥근 아치 창.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='shingle', gface='rot', quoin='frame', barge=('frame:3', 'frame:2', 'frame:1', 'frame:0'),
             borrow=('halftimber', dict(ridge='ridge', eave='eave', chimney='chimney', smoke='smoke', sign='sign', cellar='cellar'), dict(plaster='frame')))
S, W = 'stone', 'wall'


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 7); v = b.g(2, 60, [(S, 12), (W, 28), (W, 26)], 22, 24)
    v.at('win-arch', 8, 2, lift=4).at('win-arch', 40, 2, lift=4).at('win-pair', 34, 1, lift=5).gable('win-round', up=4); H['narrow'] = b.done()
    b = B(5, 5); v = b.e(2, 76, [(S, 10), (W, 24)], 38)
    v.roof('chimney', 58, 26).at('win-arch', 8, lift=3).at('win-shutter', 52, lift=5); b.add('clutter', 2, 80, crop=(0, 0, 28, 16)); H['low'] = b.done()
    # ── 살림집 ──
    b = B(6, 7); g1 = b.g(2, 44, [(S, 12), (W, 28), (W, 24)], 20, 20); g2 = b.g(50, 44, [(S, 12), (W, 28), (W, 16)], 20, 18)
    g1.at('win-pair', 11, 2, lift=4).at('win-arch', 28, 1, lift=5).gable('win-round', up=3); g2.at('win-arch', 8, 2, lift=1).at('win-arch', 26, 2, lift=1).at('win-box', 13, 1, lift=3).ground('cellar', 11); H['pair'] = b.done()
    b = B(5, 7); v = b.g(3, 74, [(S, 4), (W, 30), (W, 26)], 22, 26, ov=3)
    v.at('win-pair', 8, 2, lift=4).at('win-pair', 44, 2, lift=4).gable('win-round', up=4); b.add('arcade', 4, 108, w=72); H['arched'] = b.done()
    b = B(7, 6); v = b.e(2, 108, [(S, 28), (W, 28)], 38)
    v.roof('chimney', 84, 28).at('win-arch', 34, 1, lift=5).at('win-arch', 52, 1, lift=5).at('win-shutter', 78, 1, lift=5).at('win-pair', 44, 0, lift=6)
    b.add('balcony', 28, 70, w=78).add('stair', 4, 96, crop=(0, 8, 24, 44)); H['stairhouse'] = b.done()
    # ── 큰 집 ──
    b = B(9, 7); g1 = b.g(2, 44, [(S, 12), (W, 28), (W, 22)], 20, 20); g3 = b.g(98, 44, [(S, 12), (W, 28), (W, 22)], 20, 20); g2 = b.g(50, 44, [(S, 12), (W, 28), (W, 28)], 20, 22)
    for g in (g1, g2, g3): g.at('win-arch', 16, 2, lift=5).gable('win-round', up=2)
    g1.at('win-arch', 8, 1, lift=5).at('win-arch', 26, 1, lift=5); g3.at('win-pair', 11, 1, lift=5).ground('cellar', 11); b.add('clutter', 2, 112, crop=(0, 0, 28, 16)); H['triple'] = b.done()
    b = B(8, 8); m = b.e(2, 124, [(S, 14), (W, 28), (W, 26)], 36); g = b.g(12, 56, [(S, 14), (W, 28), (W, 26)], 20, 24)
    m.roof('chimney', 100, 26).at('win-arch', 76, 2, lift=4).at('win-arch', 100, 2, lift=4).at('win-pair', 82, 1, lift=5).at('win-box', 84, 0, lift=-2)
    g.at('win-pair', 17, 2, lift=4).gable('win-round', up=4); b.add('balcony', 14, 86, w=52); H['merchant'] = b.done()
    # ── 가게집 ──
    b = B(5, 7, door='door-shop'); v = b.e(2, 76, [(S, 10), (W, 30), (W, 26)], 40)
    v.roof('chimney', 10, 26).at('win-arch', 10, 2, lift=4).at('win-arch', 34, 2, lift=4).at('win-arch', 56, 2, lift=4).at('win-pair', 8, 1, lift=6).at('win-shutter', 4, 0, lift=4)
    b.add('sign-shop', 28, 78).add('clutter', 2, 112, crop=(18, 0, 44, 16)); H['chandler'] = b.done()
    b = B(7, 6, door='door-shop'); lo = b.e(62, 48, [(S, 6), (W, 28)], 26, ov=0); g = b.g(2, 60, [(S, 10), (W, 28), (W, 20)], 18, 20)
    g.at('win-pair', 19, 2, lift=2).gable('win-round', up=2).at('win-arch', 40, 1, lift=6); lo.ground('fishstall', 2); b.add('sign-shop', 40, 62); H['fishmonger'] = b.done()
    # ── 여관 · 일터 · 회관 ──
    b = B(11, 8); m = b.e(2, 116, [(S, 6), (W, 32), (W, 28), (W, 6)], 40); g = b.g(116, 58, [(S, 6), (W, 32), (W, 28), (W, 6)], 30, 24)
    m.roof('chimney', 16, 30).roof('chimney', 88, 30).at('win-arch', 8, 2, lift=5).at('win-pair', 28, 2, lift=5).at('win-pair', 60, 2, lift=5).at('win-arch', 92, 2, lift=5)
    g.at('win-pair', 18, 2, lift=5).gable('win-round', up=6).at('win-box', 20, 1, lift=4)
    b.add('arcade', 6, 124, w=72).add('balcony', 4, 92, w=110).add('sign', 100, 104); H['inn'] = b.done()
    b = B(8, 6); g = b.g(2, 84, [(S, 6), (W, 34)], 24, 26); e = b.e(88, 38, [(S, 6), (W, 26)], 28)
    g.ground('boatbay', 18).gable('win-round', up=4); e.roof('chimney', 22, 22); H['boathouse'] = b.done()
    b = B(8, 9); v = b.g(8, 112, [(S, 6), (W, 38), (W, 34)], 30, 32, ov=4)
    v.at('win-pair', 14, 2, lift=8).at('win-pair', 76, 2, lift=8).gable('rose', pw=20, up=2).at('win-arch', 50, 2, lift=8); b.add('arcade', 16, 140, w=96); H['hall'] = b.done()
    return H
