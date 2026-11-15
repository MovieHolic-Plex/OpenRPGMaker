"""violetslate(보랏빛 슬레이트 도시) 조립 순서 — 회색 다듬돌(wall)과 붉은 벽돌(wall2), 보랏빛 슬레이트 큰 지붕에 작은 지붕창, 널 난간 회랑(gallery), 깃발. 계단 박공(steps)과 네모 탑(spire).
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다."""
from ._lib import B
STYLE = dict(face='shingle', barge=('wall:6', 'wall:5', 'wall:3', 'wall:1'), cap=('wall:7', 'wall:5', 'wall:1'),
             borrow=('halftimber', dict(ridge='ridge', eave='eave', smoke='smoke', stair='stair', clutter='clutter', cellar='cellar'), dict(plaster='frame')))
S, A, K = 'stone', 'wall', 'wall2'      # 막돌 밑동 · 다듬돌 · 벽돌


def R():
    H = {}
    # ── 오두막 ──
    b = B(4, 6); v = b.g(2, 60, [(S, 8), (K, 26)], 30, 22)
    v.at('win-box', 38, lift=0).gable(up=3).roof('chimney', 42, 40); H['brickcot'] = b.done()
    b = B(5, 5); v = b.e(2, 76, [(S, 6), (A, 26)], 40)
    v.roof('dormer', 12, 30).roof('chimney', 56, 28).at('win-box', 6, lift=0).at('win-plain', 30, lift=6); H['stonecot'] = b.done()
    # ── 살림집 ──
    b = B(6, 7); v = b.e(2, 92, [(A, 30), (K, 28)], 46)
    v.roof('dormer', 14, 32).roof('dormer', 58, 32).roof('chimney', 40, 24).at('win-tall', 12, 1, lift=3).at('win-tall', 64, 1, lift=3).at('win-box', 62, 0, lift=1).at('win-plain', 10, 0, lift=8)
    b.add('gallery', 0, 86, w=96).add('banner', 42, 64); H['balcony'] = b.done()
    b = B(7, 7); v = b.g(8, 96, [(A, 30), (K, 28)], 26, 28, steps=4, ov=4)
    v.at('win-tall', 16, 1, lift=3).at('win-tall', 64, 1, lift=3).gable('win-plain', pw=12, up=6).at('win-box', 12, 0, lift=1).at('win-box', 40, 0, lift=1); H['stepped'] = b.done()
    b = B(5, 7); v = b.g(3, 74, [(S, 8), (K, 28), (K, 26)], 22, 24, ov=3)
    v.at('win-box', 8, 2, lift=1).at('win-box', 48, 2, lift=1).gable(up=3).at('win-tall', 52, 1, lift=2).roof('chimney', 56, 40); b.add('banner', 10, 86); H['brickgable'] = b.done()
    # ── 큰 집 ──
    b = B(9, 8); m = b.e(2, 140, [(A, 32), (A, 30)], 44); g = b.g(48, 48, [(A, 32), (K, 30)], 22, 22)
    m.roof('dormer', 12, 34).roof('dormer', 110, 34).roof('chimney', 30, 24).roof('chimney', 98, 24).at('win-tall', 8, 1, lift=3).at('win-tall', 28, 1, lift=3).at('win-tall', 100, 1, lift=3).at('win-tall', 120, 1, lift=3)
    m.at('win-box', 8, 0, lift=2).at('win-box', 114, 0, lift=2); g.at('win-tall', 16, 1, lift=3).gable(up=3); b.add('banner', 50, 108).add('banner', 82, 108); H['manor'] = b.done()
    b = B(8, 8); m = b.e(2, 124, [(A, 30), (K, 28)], 42); t = b.wall(72, 40, [(A, 86)], cap=('spire', 6))
    m.roof('dormer', 14, 34).roof('chimney', 44, 24).at('win-tall', 10, 1, lift=3).at('win-tall', 40, 1, lift=3).at('win-box', 8, 0, lift=1).at('win-box', 38, 0, lift=1)
    t.at('win-tall', 12, 0, lift=52).at('win-plain', 14, 0, lift=34); b.add('banner', 86, 62).add('crates', 96, 128, crop=(0, 12, 30, 28)); H['towerhouse'] = b.done()
    # ── 가게집 ──
    b = B(6, 6, door='door-shop'); v = b.g(2, 92, [(A, 30), (K, 20)], 22, 22)
    v.at('win-tall', 38, 1, lift=-4).gable(up=14).at('win-box', 40, 0, lift=1).at('win-box', 66, 0, lift=1); b.add('banner', 12, 62).add('banner', 70, 62).add('sign-shop', 34, 86); H['bannershop'] = b.done()
    b = B(7, 7, door='door-shop'); m = b.e(2, 108, [(A, 30), (K, 30)], 40); g = b.g(66, 40, [(A, 30), (K, 30)], 16, 18)
    m.roof('dormer', 14, 32).roof('chimney', 42, 24).at('win-tall', 10, 1, lift=4).at('win-tall', 34, 1, lift=4).at('win-box', 6, 0, lift=1); g.at('win-tall', 12, 1, lift=4).gable(up=2)
    b.add('gallery', 0, 86, w=112).add('sign-shop', 26, 104).add('crates', 80, 112); H['gallery'] = b.done()
    # ── 여관 · 일터 · 회관 ──
    b = B(12, 8); m = b.e(2, 134, [(A, 32), (K, 30)], 42); g = b.g(134, 56, [(A, 32), (K, 30)], 30, 24)
    m.roof('dormer', 12, 34).roof('dormer', 58, 34).roof('dormer', 104, 34).roof('chimney', 36, 24).roof('chimney', 84, 24)
    m.at('win-tall', 8, 1, lift=4).at('win-tall', 36, 1, lift=4).at('win-tall', 64, 1, lift=4).at('win-tall', 92, 1, lift=4).at('win-box', 10, 0, lift=1).at('win-box', 40, 0, lift=1).at('win-box', 68, 0, lift=1)
    g.at('win-tall', 20, 1, lift=4).gable(up=4).at('win-box', 19, 0, lift=1); b.add('gallery', 0, 100, w=132).add('sign', 114, 122).add('banner', 144, 98).add('banner', 168, 98); H['inn'] = b.done()
    b = B(8, 6); v = b.e(2, 124, [(S, 4), (K, 36)], 40)
    v.roof('dormer', 14, 32).roof('chimney', 50, 22).roof('chimney', 100, 22).at('win-plain', 8, 1, lift=14).ground('vats', 58); b.add('crates', 108, 96, crop=(0, 12, 18, 28)); H['brewery'] = b.done()
    b = B(9, 9); n = b.g(26, 92, [(A, 34), (A, 30)], 24, 30, steps=5, ov=4); t = b.wall(100, 40, [(A, 104)], cap=('spire', 6))
    n.at('win-tall', 10, 1, lift=3).at('win-tall', 38, 1, lift=3).gable('clock', pw=20, up=2).at('win-box', 8, 0, lift=1).at('win-box', 64, 0, lift=1)
    t.at('win-tall', 12, 0, lift=70).at('win-plain', 14, 0, lift=46).at('win-plain', 14, 0, lift=14); b.add('banner', 34, 106).add('banner', 98, 106); H['hall'] = b.done()
    return H
