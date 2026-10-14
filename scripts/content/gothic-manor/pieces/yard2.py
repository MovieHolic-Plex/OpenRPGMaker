"""마당 더 — 묘지기 오두막·무너진 예배당·허수아비·나무 손수레·이정표·나무 말뚝 울타리."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403
from _bld import *                                    # noqa: E402,F403

MODULE = 'yard2'
SP = 'grounds'


@REG.piece('gm-bld-cottage', '묘지기 오두막(목조 위층·돌 아래층·굴뚝)', 5, 6, 'auto:1', 'architecture', 'graveyard', role='building', kind='structure',
           tags=['오두막', '묘지기', '집'], access=[(1, 6)],
           desc='묘지 곁 낮은 오두막: 이끼 낀 슬레이트 지붕(앞 경사면이 위에서 보임), 돌 아래층, 왼쪽 판자문과 등불, 오른쪽 덧창 단 창 하나, 굴뚝, 삽.',
           rules='문은 맨 아래 줄 x 1. 묘지 문 옆·예배당 뒤에.')
def _cottage(c):
    yb = 95; ye = 52; xl, xr = 4, 76
    chimney(c, 58, 6, 18, w=8)
    range_roof(c, xl, xr, ye, 34, seed=41, moss=.08, crest=False)
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=42)
    planks_v(c, xl + 1, ye + 2, xr - xl - 2, 14, 'wood', 3, seed=43) if 'planks_v' in globals() else None
    c.HL(xl, ye + 16, xr - xl, K('wood', 1)); c.HL(xl, ye + 17, xr - xl, K('stone', 5))
    # 문(판자) + 등불
    c.R(14, yb - 26, 14, 24, K('wood', 3))
    for x in range(14, 28, 3): c.VL(x, yb - 26, 24, K('wood', 2))
    c.HL(14, yb - 20, 14, K('iron', 2)); c.HL(14, yb - 9, 14, K('iron', 2)); c.P(25, yb - 14, K('gold', 5))
    c.R(13, yb - 27, 16, 1, K('stone', 6)); c.VL(13, yb - 27, 25, K('stone', 2)); c.VL(28, yb - 27, 25, K('stone', 2))
    c.R(32, yb - 26, 4, 5, K('glow', 4)); c.VL(33, yb - 25, 3, K('glow', 6)); c.HL(32, yb - 27, 4, K('iron', 2))
    # 창 + 덧창(하나는 비뚤게)
    c.R(50, ye + 22, 12, 12, K('glass', 2)); c.VL(55, ye + 22, 12, K('wood', 2)); c.HL(50, ye + 27, 12, K('wood', 2)); c.R(51, ye + 23, 3, 3, K('glow', 4))
    c.R(44, ye + 21, 5, 14, K('wood', 4)); c.VL(46, ye + 21, 14, K('wood', 2))
    for k in range(14): c.P(63 + k // 5, ye + 21 + k, K('wood', 3)); c.P(64 + k // 5, ye + 21 + k, K('wood', 4)); c.P(65 + k // 5, ye + 21 + k, K('wood', 2))
    c.R(49, ye + 34, 14, 2, K('stone', 5))
    c.line(68, yb - 2, 71, yb - 22, K('wood', 4)); c.R(66, yb - 3, 5, 3, K('iron', 4))     # 기댄 삽
    keep = lambda x, y: c.opaque(x, y) and y < yb - 3
    ivy(c, xl + 4, yb - 3, 30, spread=5, seed=41, keep=keep)
    finish(c)


@REG.piece('gm-cart', '버려진 나무 손수레', 2, 2, 'auto', 'vehicles', SP, role='prop', kind='container',
           tags=['수레', '손수레'], desc='판자 상자 손수레(위에서 보이는 짐칸 안 흙과 삽), 큰 바퀴 하나, 손잡이 둘.', rules='헛간·묘지기 오두막 옆에.')
def _cart(c):
    block3(c, 3, 8, 24, 12, 8, m='wood', tb=4, fb=3)
    c.R(5, 10, 20, 8, K('dirt', 2)); c.HL(5, 10, 20, K('wood', 1)); c.ellipse(13, 14, 6, 2.5, K('dirt', 3))   # 짐칸 안
    c.line(12, 12, 22, 6, K('wood', 5)); c.R(21, 4, 3, 3, K('iron', 4))
    for x in range(3, 27, 6): c.VL(x, 20, 8, K('wood', 2))
    c.ellipse(15, 27, 4.5, 4.5, K('ink', 1)); c.ellipse(15, 27, 3, 3, K('wood', 3)); c.P(15, 27, K('iron', 5))
    c.line(1, 18, 3, 16, K('wood', 4)); c.line(27, 16, 31, 21, K('wood', 4)); c.line(28, 16, 31, 20, K('wood', 2))
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
