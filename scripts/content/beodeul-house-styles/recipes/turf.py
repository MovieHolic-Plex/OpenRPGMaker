"""turf(잔디 지붕 긴 집) 조립 순서 — 낮고 긴 집에 두꺼운 잔디 지붕이 땅 가까이 내려오고, 현무암 막돌 담(wall) 사이로 붉은 널 박공 정면(wall2)이 흰 박공널을 달고 선다. 용마루 부품이 없다.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='shingle', ridge=None, eave='eave', foot='wall', rubble=False, barge=('frame:3', 'frame:2', 'frame:1', 'frame:0'), corner=('frame:3', 'frame:1'),
             borrow=('halftimber', dict(smoke='smoke', sign='sign', boards='boards'), dict(plaster='frame')))
D, P = 'wall', 'wall2'      # 막돌 담 · 붉은 널 박공


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 5); b.wall(2, 60, [(D, 22)]); v = b.g(8, 48, [(P, 30)], 26, 18, ov=6)
    v.at('win-plain', 32, lift=8).gable(up=2).roof('chimney', 34, 30); H['sodhut'] = b.done()
    b = B(5, 5); v = b.e(4, 72, [(D, 26)], 44, ov=4)
    v.roof('chimney', 50, 22).at('win-pair', 4, lift=6).at('win-plain', 54, lift=6); H['lowhouse'] = b.done()
    # ── 살림집 ──
    b = B(9, 5); m = b.e(4, 136, [(D, 24)], 46, ov=4); p = b.g(24, 32, [(P, 30)], 14, 12, ov=3)
    m.roof('chimney', 20, 22).roof('chimney', 108, 22).at('win-pair', 60, lift=5).at('win-pair', 100, lift=5); p.gable(up=1); b.add('clutter', 0, 80, crop=(0, 0, 20, 16)); H['longhouse'] = b.done()
    b = B(7, 5); b.wall(2, 108, [(D, 20)]); g1 = b.g(6, 44, [(P, 30)], 24, 18, ov=5); g2 = b.g(62, 44, [(P, 26)], 22, 16, ov=5)
    g1.at('win-plain', 28, lift=8).gable(up=2); g2.at('win-pair', 10, lift=6).gable(up=2).roof('chimney', 30, 28); H['twinhouse'] = b.done()
    b = B(6, 6); m = b.e(4, 88, [(D, 26)], 44, ov=4); g = b.g(48, 40, [(P, 34)], 24, 18, ov=4)
    m.roof('chimney', 14, 22).at('win-pair', 8, lift=6); g.gable(up=2).at('win-plain', 2, lift=14); H['crosshouse'] = b.done()
    # ── 큰 집 ──
    b = B(9, 6); m = b.e(4, 136, [(D, 26)], 44, ov=4); g = b.g(44, 56, [(P, 40)], 28, 22, ov=5)
    m.roof('chimney', 14, 22).roof('chimney', 116, 22).at('win-pair', 6, lift=6).at('win-pair', 108, lift=6); g.at('win-box', 4, lift=4).at('win-plain', 40, lift=14).gable('win-pair', pw=24, up=2); H['chieftain'] = b.done()
    b = B(8, 6); b.wall(2, 124, [(D, 22)]); g1 = b.g(6, 36, [(P, 30)], 22, 14, ov=4); g3 = b.g(92, 30, [(P, 26)], 20, 12, ov=4); g2 = b.g(48, 40, [(P, 38)], 26, 18, ov=4)
    g1.at('win-plain', 12, lift=8).gable(up=1); g2.gable(up=2).at('win-plain', 2, lift=16); g3.at('win-plain', 9, lift=6).roof('chimney', 16, 24); H['rowhouse'] = b.done()
    # ── 가게집 ──
    b = B(6, 5, door='door-shop'); b.wall(2, 92, [(D, 20)]); v = b.g(10, 76, [(P, 30)], 24, 20, ov=6)
    v.at('win-pair', 28, lift=7).gable(up=4); b.add('sign-shop', 80, 80); H['trader'] = b.done()
    b = B(7, 5, door='door-shop'); m = b.e(4, 104, [(D, 26)], 42, ov=4); p = b.g(72, 32, [(P, 30)], 14, 12, ov=3)
    m.roof('chimney', 30, 22).at('win-pair', 44, lift=6).ground('rack', 2); p.gable(up=1); H['weaver'] = b.done()
    # ── 여관 · 일터 · 예배당 ──
    b = B(12, 7); m = b.e(4, 184, [(D, 30)], 50, ov=4); g1 = b.g(20, 44, [(P, 40)], 24, 20, ov=4); g3 = b.g(140, 40, [(P, 36)], 22, 18, ov=4); g2 = b.g(76, 56, [(P, 48)], 30, 24, ov=5)
    m.roof('chimney', 8, 22).roof('chimney', 166, 22); g1.at('win-pair', 10, lift=8).gable(up=2); g3.at('win-pair', 8, lift=8).gable(up=2); g2.at('win-box', 2, lift=6).at('win-plain', 40, lift=24).gable('win-pair', pw=24, up=2)
    b.add('sign', 132, 80).add('clutter', 0, 112, crop=(0, 0, 20, 16)); H['inn'] = b.done()
    b = B(8, 5); v = b.e(4, 120, [(D, 37)], 40, ov=4)
    v.roof('chimney', 30, 20).roof('chimney', 84, 20).ground('smokebay', 58).at('win-plain', 6, lift=12); b.add('clutter', 106, 80, crop=(0, 0, 20, 16)); H['smokehouse'] = b.done()
    b = B(6, 8); b.wall(4, 88, [(D, 30)]); v = b.g(12, 72, [(P, 44)], 30, 28, ov=6)
    v.at('win-plain', 44, lift=14).gable(up=6); b.add('belfry', 38, 36); H['chapel'] = b.done()
    return H
