"""예배당·종탑·묘소 — 박공이 앞(남)을 보는 남북 용마루 건물."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403

MODULE = 'bld_chapel'


from _bld import *   # noqa: E402,F403

@REG.piece('gm-bld-chapel', '고딕 예배당(정면 박공·장미창·종루)', 6, 9,
           'auto:1',
           'architecture', 'chapel', role='building', kind='structure', tags=['예배당', '교회', '종루', '장미창'],
           desc='회색 돌 예배당 정면: 남향 박공에 장미창, 첨두 아치 정문, 양옆 첨두창 두 개, 버트레스 둘, 박공 꼭대기 종루와 쇠 십자가. 지붕은 청보라 슬레이트(남북 용마루).',
           rules='정문은 맨 아래 줄 가운데 두 칸(x 2~3). 문 앞(아래) 칸을 비우고 길을 잇는다. 묘지·정원 북쪽에 둔다.', access=[(2, 9), (3, 9)])
def _chapel(c):
    W = 96; cx = 48; y_base = 143; y_eave = 98; xl, xr = 18, 78
    yf = gable_roof(c, xl, xr, cx, y_eave, rise=34, depth=30, seed=3)
    # 종루(박공 꼭대기, 지붕 위로 솟음): 사각 몸 + 종 구멍 + 사각뿔 첨탑
    bx0, bw = cx - 6, 12; by0 = int(yf(cx)) - 22
    masonry(c, bx0, by0, bw, 24, 'stone', 3, seed=8, course=4, blen=(3, 6))
    c.VL(bx0, by0, 24, K('stone', 5)); c.VL(bx0 + bw - 1, by0, 24, K('stone', 2))
    for i in range(6):
        for yy in range(by0 + 5 + arch_profile(6)[0][i], by0 + 15): c.P(bx0 + 3 + i, yy, K('ink', 1))
    c.R(bx0 + 4, by0 + 9, 4, 4, K('gold', 3)); c.HL(bx0 + 4, by0 + 9, 4, K('gold', 5)); c.P(bx0 + 6, by0 + 13, K('gold', 2))
    c.HL(bx0 - 1, by0 - 1, bw + 2, K('stone', 5)); c.HL(bx0 - 1, by0, bw + 2, K('stone', 3))
    for k in range(18):          # 사각뿔: 앞면 + 양옆 얇은 면
        half = 7 - k * 7 / 18
        y = by0 - 2 - k
        for x in range(int(cx - half), int(cx + half) + 1):
            side = x <= cx - half + 1 and half > 1.5
            sh = x >= cx + half - 1 and half > 1.5
            t = 5 if side else 2 if sh else (4 if (y % 3) else 3)
            c.P(x, y, K('slate', t))
    cross(c, cx, by0 - 28, 9)
    # 정면 벽
    masonry(c, xl, y_eave, xr - xl, y_base - y_eave, 'stone', 3, seed=5)
    gable_face(c, xl, xr, cx, y_eave, yf, seed=6)
    c.HL(xl, y_eave, xr - xl, K('stone', 5)); c.HL(xl, y_eave + 1, xr - xl, K('stone', 2))   # 처마 띠
    rose(c, cx, y_eave - 11, 7)
    # 문 + 양옆 창
    gothic_door(c, cx - 8, y_base - 33, 16, 30, seed=2)
    c.R(cx - 9, y_base - 3, 18, 3, K('stone', 5)); c.HL(cx - 9, y_base - 3, 18, K('stone', 6)); c.HL(cx - 9, y_base - 1, 18, K('stone', 2))  # 계단 한 단
    for wx in (xl + 6, xr - 13):
        lancet(c, wx, y_eave + 9, 7, 21, lit=(wx > cx), mull=False)
    plinth_band(c, xl, y_base - 4, cx - 9 - xl)
    plinth_band(c, cx + 9, y_base - 4, xr - cx - 9)
    # 버트레스(모서리)
    buttress(c, xl - 6, y_eave - 4, y_base + 1, 8, seed=1)
    buttress(c, xr - 2, y_eave - 4, y_base + 1, 8, seed=2)
    # 담쟁이(왼쪽 모서리) · 얼룩
    keep = lambda x, y: c.opaque(x, y) and y < y_base - 4
    ivy(c, xl + 3, y_base - 5, 34, spread=6, seed=4, keep=keep)
    stains(c, xl, y_eave + 2, xr - xl, 30, seed=2)
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
