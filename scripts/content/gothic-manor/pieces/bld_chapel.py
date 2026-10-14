"""예배당·종탑·묘소 — 박공이 앞(남)을 보는 남북 용마루 건물."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403

MODULE = 'bld_chapel'


from _bld import *   # noqa: E402,F403

@REG.piece('gm-bld-chapel', '고딕 예배당(동서 지붕·앞 박공 장미창·종루)', 6, 9,
           'auto:1',
           'architecture', 'chapel', role='building', kind='structure', tags=['예배당', '교회', '종루', '장미창'],
           desc='회색 돌 예배당: 동서로 긴 청보라 슬레이트 지붕(앞 경사면이 위에서 보임) 한가운데로 남향 박공이 튀어나와 장미창과 첨두 아치 정문을 단다. 양옆 벽에 첨두창, 버트레스, 왼쪽 용마루 위 사각 종루와 쇠 십자가.',
           rules='정문은 맨 아래 줄 가운데 두 칸(x 2~3). 문 앞(아래) 칸을 비우고 길을 잇는다. 묘지·정원 북쪽에 둔다.', access=[(2, 9), (3, 9)])
def _chapel(c):
    yb = 143; ye = 84; xl, xr = 4, 92; cx = 48
    # 종루: 왼쪽 용마루 위(지붕보다 먼저 그려 지붕이 밑동을 덮는다)
    tx = 22; ty = ye - 44
    masonry(c, tx - 7, ty - 18, 14, 22, 'stone', 3, seed=8, course=4, blen=(3, 6))
    c.VL(tx - 7, ty - 18, 22, K('stone', 5)); c.VL(tx + 6, ty - 18, 22, K('stone', 2))
    for i in range(6):
        for yy in range(ty - 13 + arch_profile(6)[0][i], ty - 3): c.P(tx - 3 + i, yy, K('ink', 1))
    c.R(tx - 2, ty - 9, 4, 4, K('gold', 3)); c.HL(tx - 2, ty - 9, 4, K('gold', 5))
    c.R(tx - 8, ty - 22, 16, 4, K('stone', 5)); c.HL(tx - 8, ty - 22, 16, K('stone', 6)); c.HL(tx - 8, ty - 19, 16, K('stone', 2))
    spire_square(c, tx, ty - 22, 8, 20, seed=4)
    range_roof(c, xl, xr, ye, 44, seed=31, moss=.05)
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=32)
    for bx in (20, 77):
        lancet(c, bx - 3, ye + 10, 7, 26, lit=(bx > cx), mull=False)
    for bx in (xl + 2, xr - 10):
        buttress(c, bx, ye - 2, yb + 1, 8, seed=bx)
    yf = cross_gable(c, cx, 18, ye + 2, rise=36, depth=30, seed=33)
    wall(c, cx - 18, cx + 18, ye + 2, yb, 'stone', seed=34, quoins=True)
    c.VL(cx + 18, ye + 2, yb - ye - 2, K('ink', 1))
    rose(c, cx, ye - 10, 7)
    gothic_door(c, cx - 8, yb - 34, 16, 31, seed=2)
    steps(c, cx, 20, yb + 1, 2)
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, xl + 14, yb - 5, 36, spread=6, seed=4, keep=keep)
    stains(c, xl, ye + 2, xr - xl, 30, seed=2)
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
