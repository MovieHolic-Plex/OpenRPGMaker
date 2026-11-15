"""roundhut(둥근 초가 움집 마을) 조립 순서 — 둥근 흙벽('r': 원통 벽 + 원뿔 초가)이 크기를 달리해 모이고, 벽에는 무늬 띠(band)가 돈다. 큰 집은 곧은 초가 지붕(처마 정면)에 둥근 집이 붙는다.
원뿔 지붕은 둥근 지붕이라 옆선 수직을 재지 않는다. 칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='shingle', ridge=None, eave=None, foot='stone', noshift=('paint', 'accent'), barge=('board:4', 'board:3', 'timber:2', 'timber:1'),
             borrow=('halftimber', dict(smoke='smoke', sign='sign'), dict(plaster='frame')))
C = 'wall'
BAND = [('band', 6)]


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 5); v = b.r(8, 48, 34, 'cone-s', drop=12, bands=BAND)
    v.at('win-hole', 36, lift=14); H['hut'] = b.done()
    b = B(5, 5); v = b.r(10, 44, 32, 'cone-s', drop=12)
    v.at('win-hole', 32, lift=14); b.add('granary', 50, 80); H['storehut'] = b.done()
    # ── 살림집 ──
    b = B(7, 5); bk = b.r(12, 40, 30, 'cone-s', drop=12, base=70); fr = b.r(34, 44, 34, 'cone-s', drop=12, bands=BAND)
    fr.at('win-hole', 32, lift=14); b.add('fence', 84, 80, w=28).add('pots', 86, 80, crop=(0, 0, 26, 16)); H['twin'] = b.done()
    b = B(6, 6); v = b.r(16, 64, 40, 'cone-l', drop=14, bands=BAND)
    v.at('win-slot', 44, lift=12).at('win-hole', 6, lift=16); H['bighut'] = b.done()
    b = B(8, 6); v = b.r(12, 56, 38, 'cone-m', drop=12, bands=BAND)
    v.at('win-hole', 42, lift=14); b.add('granary', 88, 94).add('fence', 80, 96, w=48).add('pots', 2, 96, crop=(0, 0, 13, 16)); H['compound'] = b.done()
    # ── 큰 집 ──
    b = B(8, 7); bk = b.r(76, 40, 30, 'cone-s', drop=12, base=92); v = b.r(22, 68, 44, 'cone-l', drop=14, bands=BAND)
    v.at('win-slot', 8, lift=14).at('win-slot', 50, lift=14); b.add('totem', 112, 112).add('pots', 84, 112, crop=(14, 0, 34, 16)); H['elder'] = b.done()
    b = B(9, 7); b1 = b.r(12, 40, 30, 'cone-s', drop=12, base=88); b2 = b.r(92, 40, 30, 'cone-s', drop=12, base=88); v = b.r(46, 52, 40, 'cone-m', drop=12, bands=BAND)
    v.at('win-hole', 40, lift=16); b1.at('win-hole', 6, lift=12); b2.at('win-hole', 28, lift=12); b.add('fence', 0, 112, w=40).add('fence', 104, 112, w=40); H['cluster'] = b.done()
    # ── 가게집 ──
    b = B(6, 5, door='door-shop'); v = b.r(42, 44, 34, 'cone-s', drop=12, bands=BAND)
    v.at('win-hole', 4, lift=14); b.add('kiln', 0, 80); H['potter'] = b.done()
    b = B(7, 6, door='door-shop'); bk = b.r(58, 44, 32, 'cone-s', drop=12, base=78); v = b.r(8, 48, 38, 'cone-s', drop=12, bands=BAND)
    v.at('win-hole', 36, lift=16); b.add('rack', 70, 96); H['weaver'] = b.done()
    # ── 여관 · 일터 · 회관 ──
    b = B(11, 7); l = b.r(16, 48, 36, 'cone-m', drop=12, base=104); r = b.r(112, 48, 36, 'cone-m', drop=12, base=104); m = b.e(44, 88, [(C, 40)], 48, ov=4)
    l.at('win-hole', 8, lift=14); r.at('win-hole', 32, lift=14); b.add('veranda', 40, 110, w=96).add('sign', 132, 86).add('pots', 2, 112, crop=(0, 0, 13, 16)).add('totem', 160, 112); H['inn'] = b.done()
    b = B(7, 6); v = b.r(58, 44, 36, 'cone-s', drop=12, bands=BAND)
    v.at('win-hole', 6, lift=16); b.add('kiln', 4, 96).add('pots', 40, 96, crop=(26, 0, 44, 16)); H['kiln'] = b.done()
    b = B(8, 8); m = b.e(4, 120, [(C, 40)], 60, ov=4); p = b.r(30, 52, 40, 'cone-m', drop=12, bands=BAND)
    m.at('win-slot', 6, lift=12).at('win-slot', 104, lift=12); b.add('veranda', 84, 126, w=40).add('totem', 0, 128).add('totem', 116, 128); H['hall'] = b.done()
    return H
