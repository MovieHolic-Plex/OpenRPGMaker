"""log(산촌 통나무·널집) 조립 순서 — 막돌 밑동 위 통나무 벽(wall), 박공·위층은 널벽(wall2), 이끼 낀 너와 지붕이 집의 절반. 초록 박공널, 밝은 창틀.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다(문은 조립기가 문 칸 열에 놓는다)."""
from ._lib import B
STYLE = dict(face='shingle', corner=('timber:5', 'timber:3', 'timber:1'), barge=('trim:3', 'trim:2', 'trim:1', 'trim:0'),
             borrow=('halftimber', dict(ridge='ridge', eave='eave', chimney='chimney', smoke='smoke', clutter='clutter', boards='boards', stair='stair', balcony='balcony', dormer='dormer'), dict(plaster='wall2')))
S, L, P = 'stone', 'wall', 'wall2'


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 5); v = b.g(2, 60, [(S, 7), (L, 24)], 26, 18, gable=P)
    v.at('win-box', 38, lift=0).gable(up=3).roof('chimney', 42, 36); H['cabin'] = b.done()
    b = B(5, 5); v = b.e(2, 76, [(S, 7), (L, 25)], 40)
    v.roof('chimney', 12, 26).at('win-shutter', 4, lift=4).at('win-plain', 60, lift=5); b.add('clutter', 54, 80, crop=(0, 3, 22, 16)); H['hut'] = b.done()
    # ── 살림집 ──
    b = B(7, 6); v = b.e(2, 108, [(S, 7), (L, 27)], 38); w = b.g(60, 48, [(S, 7), (L, 27)], 22, 18, gable=P)
    v.roof('chimney', 16, 30).at('win-shutter', 6, lift=5).at('win-box', 36, lift=1); w.gable(up=2); b.add('clutter', 4, 96, crop=(24, 0, 35, 16)); H['crosswing'] = b.done()
    b = B(5, 6); v = b.g(3, 74, [(S, 7), (L, 26), (P, 24)], 20, 18, ov=3)
    v.at('win-box', 8, 2, lift=1).at('win-box', 50, 2, lift=1).gable(up=2).at('win-plain', 58, 1, lift=6).at('win-shutter', 4, 1, lift=5); H['loft'] = b.done()
    b = B(6, 6); v = b.e(2, 92, [(S, 9), (L, 27)], 38)
    v.roof('dormer', 14, 34).roof('chimney', 70, 28).at('win-box', 8, lift=1).at('win-box', 70, lift=1); b.add('porch', 30, 96); H['porch'] = b.done()
    # ── 큰 집 ──
    b = B(9, 6); m = b.e(52, 40, [(S, 7), (L, 27)], 30, ov=0); g1 = b.g(2, 56, [(S, 7), (L, 29)], 26, 20, gable=P); g2 = b.g(86, 56, [(S, 7), (L, 25)], 22, 20, gable=P)
    g1.at('win-box', 8, lift=1).at('win-plain', 36, lift=6).gable(up=3); g2.at('win-shutter', 16, lift=5).gable(up=3); g2.roof('chimney', 36, 34)
    b.add('woodshed', 108, 96); H['twingable'] = b.done()
    b = B(8, 7); lo = b.e(60, 66, [(S, 7), (L, 27)], 36, base=110); g = b.g(3, 60, [(S, 7), (L, 27), (P, 26)], 24, 22, ov=3)
    g.at('win-box', 6, 2, lift=1).at('win-box', 38, 2, lift=1).gable(up=3).at('win-plain', 44, 1, lift=6).at('win-plain', 6, 1, lift=6)
    lo.roof('dormer', 26, 32).roof('chimney', 50, 26).at('win-shutter', 8, lift=5); b.add('woodshed', 92, 112); H['farmstead'] = b.done()
    # ── 가게집 ──
    b = B(6, 6, door='door-shop'); v = b.g(2, 92, [(S, 7), (L, 31)], 26, 26, gable=P, ov=2)
    v.gable('win-shutter', pw=24, up=4).ground('counter', 6); b.add('sign', 82, 62, flip=True); H['trader'] = b.done()
    b = B(7, 6, door='door-shop'); v = b.e(2, 108, [(S, 7), (L, 30)], 40)
    v.roof('dormer', 20, 36).roof('chimney', 86, 28).ground('counter', 44); b.add('clutter', 88, 96, crop=(24, 0, 44, 16)); H['provisions'] = b.done()
    # ── 여관 · 일터 · 예배당 ──
    b = B(11, 7); m = b.e(2, 122, [(S, 9), (L, 28), (P, 28)], 40); g = b.g(120, 54, [(S, 9), (L, 28), (P, 28)], 25, 22, ov=2)
    m.roof('chimney', 20, 34).roof('dormer', 60, 38).at('win-shutter', 6, 2, lift=6).at('win-shutter', 38, 2, lift=6).at('win-shutter', 70, 2, lift=6).at('win-box', 34, 1, lift=1).at('win-box', 100, 1, lift=1)
    g.at('win-box', 18, 2, lift=1).gable(up=3).at('win-plain', 22, 1, lift=6)
    b.add('balcony', 24, 78, w=98).add('stair', 3, 112, crop=(0, 10, 24, 44)).add('sign', 100, 100).add('clutter', 150, 112, crop=(24, 0, 44, 16)); H['inn'] = b.done()
    b = B(8, 6); sh = b.e(2, 84, [(S, 5), (P, 31)], 34, ov=2); g = b.g(84, 42, [(S, 7), (L, 27)], 24, 16, gable=P)
    sh.ground('sawbay', 6); sh.roof('chimney', 62, 24); g.gable(up=2); b.add('clutter', 62, 96, crop=(0, 3, 22, 16)); H['sawmill'] = b.done()
    b = B(7, 8); n = b.g(10, 92, [(S, 9), (L, 30)], 26, 26, gable=P, ov=3); t = b.g(40, 32, [(P, 100)], 12, 12, ov=2)      # 종탑이 앞 가운데에 서고 문은 그 밑
    n.at('win-plain', 10, 1, lift=8).at('win-plain', 70, 1, lift=8); t.at('belfry', 3, 0, lift=66); H['chapel'] = b.done()
    return H
