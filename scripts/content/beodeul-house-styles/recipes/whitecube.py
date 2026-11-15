"""whitecube(흰 회벽 평지붕 섬마을) 조립 순서 — 흰 회벽 네모 덩어리(평지붕 'f')가 층층이 겹치고, 옥상은 난간벽을 두른 마당이다. 파란 문·덧문, 바깥 계단, 포도 시렁, 파란 돔, 풍차.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='terrace', terrace='terrace', rim='wall', foot='stone', ridge=None, eave=None,
             borrow=('halftimber', dict(smoke='smoke', sign='sign', **{'sign-shop': 'sign-shop'}), dict(plaster='frame')))
W = 'wall'


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 5); v = b.f(3, 58, [(W, 46)], 22)
    v.at('win-small', 40, lift=22).at('win-arch', 38, lift=4); b.add('pots', 34, 80, crop=(0, 0, 26, 16)); H['cube'] = b.done()
    b = B(5, 5); bk = b.f(26, 51, [(W, 56)], 16); fr = b.f(3, 42, [(W, 36)], 18)
    bk.at('win-small', 34, lift=38); fr.at('win-shutter', 8, lift=10); b.add('laundry', 4, 38, crop=(0, 0, 40, 16)); H['stepcube'] = b.done()
    # ── 살림집 ──
    b = B(6, 6); lo = b.f(3, 90, [(W, 40)], 20); up = b.f(40, 52, [(W, 26)], 16, base=46, nofoot=True)
    lo.at('win-shutter', 38, lift=12).at('win-small', 76, lift=18); up.at('win-small', 8, lift=8).at('win-small', 34, lift=8); b.add('stair', 66, 96, crop=(0, 4, 24, 44)).add('pots', 2, 54, crop=(13, 2, 26, 16)); H['terrace'] = b.done()
    b = B(6, 5); v = b.f(3, 90, [(W, 40)], 24)
    v.at('win-shutter', 4, lift=14).at('win-arch', 36, lift=10); b.add('pergola', 6, 80, w=52).add('laundry', 46, 34, crop=(0, 0, 44, 16)); H['pergola'] = b.done()
    b = B(5, 7); v = b.f(3, 74, [(W, 80)], 22); hut = b.f(40, 34, [(W, 14)], 10, base=24, nofoot=True)
    v.at('win-arch', 10, lift=52).at('win-arch', 52, lift=52).at('win-shutter', 4, lift=30).at('win-box', 52, lift=26).at('win-small', 10, lift=8).at('win-small', 56, lift=8); H['tallcube'] = b.done()
    # ── 큰 집 ──
    b = B(8, 6); bk = b.f(3, 122, [(W, 44)], 20); fr = b.f(3, 70, [(W, 32)], 18)
    bk.at('win-arch', 100, lift=14); fr.at('win-shutter', 6, lift=10).at('win-shutter', 40, lift=10); b.add('awning', 76, 62, w=48).add('pots', 100, 96, crop=(0, 0, 26, 16)).add('laundry', 10, 60); H['court'] = b.done()
    b = B(9, 7); lo = b.f(3, 138, [(W, 56)], 20); up = b.f(50, 60, [(W, 30)], 16, base=46, nofoot=True)
    lo.at('win-shutter', 6, lift=30).at('win-shutter', 34, lift=30).at('win-box', 108, lift=28); up.at('win-arch', 8, lift=6).at('win-arch', 40, lift=6)
    b.add('arcade', 70, 110, w=48).add('stair', 4, 112, crop=(0, 2, 24, 44)).add('pergola', 112, 54, w=28, crop=(0, 0, 28, 12)); H['villa'] = b.done()
    # ── 가게집 ──
    b = B(6, 6, door='door-shop'); v = b.f(3, 90, [(W, 44)], 22)
    v.at('win-small', 10, lift=24).at('win-shutter', 62, lift=26); b.add('awning', 46, 72, w=46).add('wares', 48, 96).add('pots', 2, 96, crop=(0, 0, 26, 16)); H['potter'] = b.done()
    b = B(7, 5, door='door-shop'); v = b.f(3, 106, [(W, 44)], 20)
    b.add('arcade', 6, 78, w=72).add('laundry', 30, 30); v.at('win-small', 88, lift=34); H['arcade'] = b.done()
    # ── 여관 · 일터 · 예배당 ──
    b = B(11, 7); lo = b.f(3, 170, [(W, 50)], 22); up = b.f(60, 112, [(W, 30)], 18, base=50, nofoot=True)
    lo.at('win-shutter', 104, lift=22).at('win-shutter', 138, lift=22); up.at('win-shutter', 8, lift=8).at('win-shutter', 44, lift=8).at('win-shutter', 80, lift=8)
    b.add('arcade', 6, 110, w=72).add('pergola', 4, 60, w=54, crop=(0, 0, 54, 14)).add('stair', 148, 112, crop=(0, 0, 24, 44)).add('sign', 100, 88); H['inn'] = b.done()
    b = B(6, 8); cube = b.f(52, 41, [(W, 36)], 16); t = b.wall(26, 44, [(W, 82)], round=True, cap=('millcap', 8))
    t.at('win-small', 26, 0, lift=44); cube.at('win-small', 26, lift=14); b.add('sails', 24, 70); H['windmill'] = b.done()
    b = B(7, 8); v = b.f(10, 92, [(W, 56)], 26)
    v.at('win-arch', 8, lift=22).at('win-arch', 72, lift=22); b.add('dome', 34, 66).add('bellcote', 12, 72); H['chapel'] = b.done()
    return H
