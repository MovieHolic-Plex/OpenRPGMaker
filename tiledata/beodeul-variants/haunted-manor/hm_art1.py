# 폐가 저택 조각 1: 현관·계단 홀과 연회장 — 벽난로·빈 액자·판자 친 창·긴 식탁·의자·촛대·떨어진 샹들리에·괘종시계·
# 부서진 큰 계단·벽 촛대·외투 걸이·마른 꽃 항아리·까마귀 흉상·회반죽 부스러기·마루 구멍. 손 도트, 3/4 시점, 빛 왼쪽 위.
from hm_kit import *
from hm_kit import _hash


def _stone(x, y, seed, k=4):
    """청회 마름돌 한 점(벽난로·받침): 8px 줄 어긋난 돌, 줄눈 1단, 위 모 밝음."""
    row = y // 6; off = (row % 2) * 6; lx = (x + off) % 12; ly = y % 6
    if ly == 5 or lx == 11: return GS[k - 2]
    h = _hash((x + off) // 12, row, seed)
    c = GS[k] if h < .55 else (GS[k - 1] if h < .85 else mix(GS[k], GS[k + 1], .5))
    if ly == 0 or lx == 0: c = mix(c, GS[k + 1], .45)
    if _hash(x, y, seed + 3) < .06: c = mix(c, GS[k - 1], .6)
    return c


def fireplace(seed=0):
    """벽난로 3×4(48x64): 벽 앞면에 붙여 짓는 청회 돌 벽난로 — 위 굴뚝 가슴벽, 선반 윗면(초 둘·거미줄), 아치 화실 속
    식은 재와 꺼져 가는 불씨, 앞 바닥 돌판(윗면). 아랫줄(돌판)만 막힘, 위 3줄은 벽 앞면 위."""
    W, H = 48, 64; cv = Cv(W, H)
    # 굴뚝 가슴벽(벽 앞면 위로 솟은 돌)
    for y in range(0, 26):
        for x in range(8, 40):
            c = _stone(x, y, seed + 11, 3)
            if x in (8, 9): c = mix(c, GS[5], .3)
            if x in (38, 39): c = mul(c, .7)
            cv.px(x, y, c)
    for x in range(8, 40): cv.px(x, 0, GS[4])
    # 선반: 윗면 4행 + 앞 두께 3행(조각 띠)
    for y in range(24, 28):
        for x in range(2, 46):
            cv.px(x, y, GS[6] if (y == 24 or x == 2) else (GS[5] if x < 44 else GS[4]))
    for y in range(28, 31):
        for x in range(2, 46):
            c = GS[4] if x < 44 else GS[3]
            if y == 30: c = GS[2]
            if y == 29 and x % 4 == 1: c = GS[3]
            cv.px(x, y, c)
    dust_top(cv, 2, 24, 46, 28, seed + 1, .3)
    # 선반 위: 꺼진 초 하나·켜진 초 하나, 놋쇠 받침
    for (x, lit) in ((10, False), (36, True)):
        candle(cv, x, 18, 6, lit)
        for xx in range(x - 2, x + 4): cv.px(xx, 24, BRS[4] if xx < x + 1 else BRS[2])
    web_corner(cv, 44, 24, 7, flip=True, seed=seed + 5)
    # 문설주(양옆 기둥)
    for y in range(31, 58):
        for x in list(range(4, 12)) + list(range(36, 44)):
            lx = x - (4 if x < 12 else 36)
            c = _stone(x, y, seed + 21, 4)
            if lx == 0: c = GS[5]
            elif lx >= 6: c = mul(c, .72)
            cv.px(x, y, c)
    # 아치 화실(어두운 속 + 둥근 머리 돌 + 재 + 불씨)
    for y in range(31, 58):
        for x in range(12, 36):
            ay = 31 + int(5 - 5 * math.sqrt(max(0.0, 1 - ((x + .5 - 24) / 12.0) ** 2)))
            if y < ay:
                cv.px(x, y, _stone(x, y, seed + 21, 4)); continue
            if y == ay or y == ay + 1: cv.px(x, y, GS[2] if y == ay else GS[1]); continue
            d = (y - ay) / 20.0
            c = OUTL if d < .5 else mix(OUTL, (34, 26, 28), min(1, (d - .5) * 2))
            if y >= 52:                                                         # 재 더미
                n = vnoise(x, y, 3, seed + 31)
                c = DU[2] if n > .5 else DU[1]
                if y == 52 and n < .4: c = OUTL
                if _hash(x, y, seed + 32) < .12: c = AM[2]
                if _hash(x, y, seed + 33) < .04: c = AM[4]
            cv.px(x, y, c)
    # 쇠 장작 받침(안다리 둘)
    for x in (16, 31):
        for y in range(48, 56): cv.px(x, y, RI[2]); cv.px(x + 1, y, RI[1])
        cv.px(x, 47, RI[3])
    for x in range(16, 33): cv.px(x, 51, RI[2] if x % 3 else RI[3])
    # 반쯤 탄 장작
    for x in range(18, 30):
        cv.px(x, 49, GW[2]); cv.px(x, 50, GW[1])
        if _hash(x, 0, seed + 34) < .3: cv.px(x, 49, AM[2])
    # 앞 바닥 돌판(윗면 + 앞 턱)
    for y in range(57, 64):
        for x in range(0, 48):
            c = GS[5] if y == 57 or x == 0 else (GS[4] if y < 62 else (GS[3] if y == 62 else GS[2]))
            if x >= 46: c = GS[3]
            if y < 62 and _hash(x, y, seed + 41) < .1: c = DU[3]
            cv.px(x, y, c)
    return fin(cv, .6)


def _frame(cv, x0, y0, x1, y1, ramp=BRS, t=3):
    """도금 액자 테(두께 t): 위·왼쪽 밝고 아래·오른쪽 어둡다, 모서리에 작은 장식 점."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = min(x - x0, y - y0, x1 - 1 - x, y1 - 1 - y)
            if d >= t: continue
            if x - x0 == d or y - y0 == d: k = 5 if d == 0 else 4
            else: k = 2 if d == 0 else 3
            if d == 1: k += 0 if _hash(x, y, 7) < .7 else -1
            cv.px(x, y, ramp[clamp(k, 1, 6)])
    for (x, y) in ((x0 + 1, y0 + 1), (x1 - 2, y0 + 1), (x0 + 1, y1 - 2), (x1 - 2, y1 - 2)): cv.px(x, y, ramp[6])


def portrait_empty(seed=0):
    """빈 액자 2×2(32x32, 벽 앞면 장식): 도금 테 속 그림이 빠진 짙은 뒤판, 한때 걸려 있던 자리만 덜 바래 네모 얼룩이 남았다.
    못 하나에 끈으로 걸렸다."""
    W, H = 32, 32; cv = Cv(W, H)
    _frame(cv, 3, 2, 29, 30, BRS, 3)
    for y in range(5, 27):
        for x in range(6, 26):
            c = GW[1] if (x + y) % 5 else GW[2]                               # 뒤판 널
            if x == 15: c = OUTL
            if 9 <= x < 23 and 8 <= y < 24 and (x in (9, 22) or y in (8, 23)): c = mix(GW[2], PP[3], .4)   # 그림 자국
            cv.px(x, y, c)
    web_corner(cv, 6, 5, 6, seed=seed + 3)
    cv.px(16, 0, RI[3]); cv.px(15, 1, RI[2]); cv.px(17, 1, RI[2])          # 못과 끈
    return fin(cv, .6)


def portrait_oval(seed=0):
    """타원 액자 1×2(16x32, 벽 앞면 장식): 세로 타원 도금 테 속 짙게 그을린 캔버스 — 형체 없는 어두운 붓 자국만(얼굴 없음)."""
    W, H = 16, 32; cv = Cv(W, H)
    cx, cy, rx, ry = 8, 16, 7, 13
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d > 1: continue
            if d > .7:
                k = 5 if (x < cx and y < cy) else (4 if x < cx or y < cy else 2)
                if d > .9: k -= 1
                cv.px(x, y, BRS[clamp(k, 1, 6)])
            else:
                n = vnoise(x, y, 3, seed + 41)
                c = mix(PP[1], CR[1], .3) if n < .55 else (PP[2] if n < .8 else mix(PP[2], CR[2], .5))
                if _hash(x, y, seed + 42) < .05: c = PP[3]
                cv.px(x, y, c)
    for (x, y) in ((8, 2), (8, 29)): cv.px(x, y, BRS[6])
    return fin(cv, .6)


def window_boarded(seed=0):
    """판자 친 뾰족 아치 창 2×3(32x48, 벽 앞면 장식, 앞면 3줄 필요): 검은 참나무 틀 속 밤빛 유리(금 간 칸), 대각선으로 못 박은
    판자 셋, 양옆 해진 검붉은 커튼, 아래 창턱."""
    W, H = 32, 48; cv = Cv(W, H)
    x0, x1, y0, y1 = 7, 25, 3, 40
    for y in range(y0, y1):
        for x in range(x0, x1):
            cxp = (x0 + x1) / 2.0
            ay = y0 + int(9 * (1 - math.sqrt(max(0.0, 1 - ((x + .5 - cxp) / 9.0) ** 2))))
            if y < ay: continue
            fr = (x in (x0, x0 + 1, x1 - 2, x1 - 1)) or y in (ay, ay + 1)
            if fr: c = GW[4] if (x <= x0 + 1 or y == ay) else GW[2]
            else:
                c = GLS[2] if y < 20 else GLS[1]
                if (x + y * 2) % 11 == 0: c = GLS[3]
                if x == 16 or y in (20, 30): c = GW[2]                          # 창살
                if (x - 10) == (y - 22) // 2 and 11 < x < 15 and 22 < y < 32: c = GLS[4]   # 금 간 유리
                if 18 < x < 23 and 8 < y < 14 and _hash(x, y, seed + 51) < .4: c = GLS[3]
            cv.px(x, y, c)
    # 판자 셋(대각) — 못 박힌 끝
    for (ya, yb, sl) in ((12, 16, 1), (24, 27, -1), (33, 36, 1)):
        for x in range(x0 - 1, x1 + 1):
            yy = ya + (x - x0) * sl * 3 // 18
            for y in range(yy, yy + (yb - ya)):
                c = GW[5] if y == yy else (GW[4] if y < yy + 2 else GW[3])
                if _hash(x, y, seed + 52) < .08: c = GW[3]
                cv.px(x, y, c)
            if x in (x0, x1 - 1): cv.px(x, yy + 1, RI[1])
    # 창턱
    for y in range(40, 44):
        for x in range(4, 28): cv.px(x, y, GW[5] if y == 40 else (GW[4] if y < 42 else GW[2]))
    # 해진 커튼(양옆): 세로 주름 + 아래 들쭉날쭉
    for side in (0, 1):
        xa = 1 if side == 0 else 24
        for x in range(xa, xa + 7):
            bot = 44 - int(_hash(x, side, seed + 53) * 9)
            for y in range(0, bot):
                f = (x - xa) % 3
                c = CR[4] if f == 0 else (CR[3] if f == 1 else CR[2])
                if y < 3: c = CR[5] if y == 1 else CR[3]
                if _hash(x, y, seed + 54) < .04: c = CR[1]
                cv.px(x, y, c)
    for x in range(0, 32): cv.px(x, 0, RI[3] if x % 4 else RI[4])          # 커튼 봉
    return fin(cv, .6)


def banquet_table(seed=0):
    """긴 식탁 5×2(80x32): 먼지 앉은 회색 식탁보가 늘어진 검은 참나무 긴 식탁 — 윗면에 쓰러진 촛대·은 접시·뒤집힌 잔,
    가운데 거미줄 친 세 갈래 촛대, 식탁보 아래 다리. 아래 2줄 막힘."""
    W, H = 80, 32; cv = Cv(W, H)
    # 윗면(식탁보, 3/4: 위에서 본 판) y 6~17
    for y in range(6, 18):
        for x in range(2, 78):
            c = LN[4] if (y == 6 or x == 2) else (LN[3] if x < 74 else LN[2])
            if (x * 7 + y * 3) % 13 == 0: c = LN[2]
            cv.px(x, y, c)
    dust_top(cv, 2, 6, 78, 18, seed + 61, .3)
    # 늘어진 앞 식탁보(주름 + 들쭉날쭉 끝 + 해진 구멍)
    for x in range(1, 79):
        bot = 27 + (1 if (x // 5) % 2 else 0) - (2 if _hash(x // 3, 0, seed + 62) < .2 else 0)
        for y in range(18, bot):
            f = (x // 3) % 3
            c = LN[3] if f == 0 else (LN[2] if f == 1 else LN[1])
            if y == 18: c = LN[4]
            if x < 3 or x > 76: c = LN[1]
            cv.px(x, y, c)
    for (x, y) in ((22, 22), (23, 22), (22, 23), (52, 24), (53, 24)): cv.px(x, y, OUTL)
    # 다리(식탁보 아래로 보이는 끝)
    for x in (6, 72):
        for y in range(26, 31): cv.px(x, y, GW[3]); cv.px(x + 1, y, GW[2])
    # 윗면 물건: 은 접시 넷, 뒤집힌 잔, 쓰러진 촛대, 가운데 세 갈래 촛대
    for (px_, py_) in ((10, 11), (28, 9), (50, 12), (66, 10)):
        topell(cv, px_, py_, 4, 2.2, LN, 6, 4, seed + 63)
        cv.px(px_ - 1, py_, LN[2])
    for (x, y) in ((18, 12), (19, 12), (18, 13), (19, 13)): cv.px(x, y, BRS[3])   # 뒤집힌 잔
    cv.px(18, 11, BRS[5])
    for i in range(8): cv.px(57 + i, 9 + i // 3, BRS[4] if i % 2 else BRS[3])   # 쓰러진 촛대
    cv.px(56, 8, LN[5]); cv.px(55, 8, LN[4])
    # 가운데 세 갈래 촛대(위로 솟는다)
    cx = 40
    for y in range(2, 12): cv.px(cx, y, BRS[4]); cv.px(cx + 1, y, BRS[2])
    for x in range(cx - 5, cx + 7): cv.px(x, 5, BRS[4] if x < cx + 1 else BRS[3])
    for x in (cx - 5, cx + 6):
        for y in range(3, 6): cv.px(x, y, BRS[4])
    for x in (cx - 5, cx, cx + 6): candle(cv, x, -1 + (0 if x == cx else 2), 3, lit=False)
    for x in range(cx - 3, cx + 5): cv.px(x, 12, BRS[3])
    web_corner(cv, cx + 6, 3, 5, flip=False, seed=seed + 64)
    return shadow_under(fin(cv, .58), 40, 31, 38, 1.6, 70)


def chair_high(seed=0, sheet=False):
    """높은 등받이 의자 1×2(16x32): 뾰족 장식 기둥 둘·검붉은 천 등받이(해진 자리에 속 솜), 앉는 판 윗면. 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(4, 22):                                                      # 등받이
        for x in range(3, 13):
            if x in (3, 12): c = GW[4] if x == 3 else GW[2]
            else:
                c = CR[3] if (x + y) % 4 else CR[2]
                if y == 5 or x == 4: c = CR[4]
                if 7 < y < 12 and 7 < x < 10 and seed % 2 == 0: c = LN[4] if (x + y) % 2 else LN[3]   # 해진 속
            cv.px(x, y, c)
    for x in (3, 12):
        cv.px(x, 2, GW[5]); cv.px(x, 3, GW[4]); cv.px(x, 1, GW[3])
    for x in range(4, 12): cv.px(x, 4, GW[4])
    for y in range(22, 26):                                                     # 앉는 판(윗면)
        for x in range(2, 14): cv.px(x, y, CR[4] if y == 22 or x == 2 else (CR[3] if x < 13 else CR[2]))
    for y in range(26, 28):
        for x in range(2, 14): cv.px(x, y, GW[3] if x < 13 else GW[2])
    for x in (3, 12):
        for y in range(28, 31): cv.px(x, y, GW[3] if x == 3 else GW[2])
    dust_top(cv, 2, 22, 14, 26, seed + 71, .28)
    return shadow_under(fin(cv, .58), 8, 31, 6, 1.2, 70)


def chair_toppled(seed=0):
    """쓰러진 의자 1×1(16x16): 등을 바닥에 대고 뒤로 넘어진 높은 등받이 의자 — 바닥에 누운 검붉은 등받이(남쪽으로 뻗음),
    위로 들린 앉는 판 밑면과 하늘로 선 앞다리 둘. 막힘."""
    W, H = 16, 16; cv = Cv(W, H)
    for y in range(9, 15):                                                      # 바닥에 누운 등받이(윗면)
        for x in range(3, 13):
            c = CR[3] if (x + y) % 4 else CR[2]
            if y == 9: c = CR[4]
            if x in (3, 12): c = GW[4] if x == 3 else GW[2]
            cv.px(x, y, c)
    cv.px(3, 15, GW[3]); cv.px(12, 15, GW[2])
    for y in range(5, 9):                                                       # 앉는 판 밑면(널, 서 있다)
        for x in range(2, 14): cv.px(x, y, GW[4] if y == 5 else (GW[3] if x < 13 else GW[2]))
    for x in (3, 12):                                                           # 위로 선 앞다리
        for y in range(1, 5): cv.px(x, y, GW[4] if x == 3 else GW[3]); cv.px(x + 1, y, GW[2])
    for x in range(4, 12): cv.px(x, 3, GW[2])                                  # 다리 가로대
    return shadow_under(fin(cv, .58), 8, 15, 6, 1.2, 70)

def candelabra(seed=0, lit=True):
    """세 갈래 쇠 촛대 1×2(16x32): 바닥에 세우는 녹슨 쇠 촛대, 초 셋(켜짐 = 호박색 불꽃), 녹아 흘러내린 촛농, 받침 다리 셋."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(9, 28): cv.px(7, y, RI[3]); cv.px(8, y, RI[1])
    for x in range(2, 14): cv.px(x, 9, RI[3] if x < 8 else RI[2])
    for x in (2, 13):
        for y in range(6, 10): cv.px(x, y, RI[3])
    for x in (2, 7, 13):
        for xx in (x - 1, x, x + 1): cv.px(xx, 6 if x != 7 else 4, RI[4] if xx <= x else RI[2])
        candle(cv, x - (1 if x == 13 else 0), (1 if x == 7 else 3) - 1, 4, lit)
    for x in range(4, 12): cv.px(x, 28, RI[3] if x < 8 else RI[2])
    for (x, y) in ((3, 29), (4, 29), (12, 29), (11, 29), (7, 29), (8, 29), (3, 30), (12, 30), (7, 30)): cv.px(x, y, RI[2])
    cv.px(9, 12, LN[5]); cv.px(9, 13, LN[4])                                  # 흘러내린 촛농
    return shadow_under(fin(cv, .6), 8, 30, 5, 1.0, 60)


def chandelier_fallen(seed=0):
    """떨어진 샹들리에 3×2(48x32): 바닥에 내려앉아 찌그러진 흐린 놋쇠 고리 두 겹, 꺾인 팔과 흩어진 초·유리 방울, 끊어진 사슬,
    둘레의 깨진 마루 조각. 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    cx, cy = 24, 20
    # 깨진 마루 조각(둘레)
    for i in range(14):
        a = i / 14.0 * 6.283; r = 18 + _hash(i, 0, seed + 81) * 4
        x = int(cx + math.cos(a) * r); y = int(cy + math.sin(a) * r * .5)
        cv.px(x, y, GW[4]); cv.px(x + 1, y, GW[2])
    # 바깥 고리(눌린 타원) + 안 고리
    for (rx, ry, k) in ((19, 8, 0), (11, 5, 1)):
        for i in range(140):
            a = i / 140.0 * 6.283
            x = cx + math.cos(a) * rx; y = cy + math.sin(a) * ry - (2 if k else 0) + (1.5 * math.sin(a * 3 + seed) if k == 0 else 0)
            col = BRS[5] if math.sin(a) < 0 else BRS[3]
            cv.px(int(x), int(y), col); cv.px(int(x), int(y) + 1, BRS[1])
    # 팔(고리를 잇는 살) + 끝 초 접시
    for i in range(6):
        a = i / 6.0 * 6.283 + .3
        for t in range(11, 19):
            x = cx + math.cos(a) * t; y = cy + math.sin(a) * t * .45 - 1
            cv.px(int(x), int(y), BRS[4]); cv.px(int(x), int(y) + 1, BRS[2])
        ex = int(cx + math.cos(a) * 19); ey = int(cy + math.sin(a) * 8)
        if i % 2 == 0: candle(cv, ex, ey - 4, 3, lit=False)
        else: cv.px(ex, ey - 1, LN[5]); cv.px(ex + 1, ey - 1, LN[4])            # 쓰러진 초
    # 유리 방울(흩어짐)
    for i in range(12):
        x = int(4 + _hash(i, 1, seed + 82) * 40); y = int(10 + _hash(i, 2, seed + 83) * 20)
        cv.px(x, y, GLS[5]); cv.px(x, y + 1, GLS[3])
    # 가운데 꼭지 + 끊어진 사슬(위로)
    for y in range(4, 18): cv.px(cx, y, RI[3] if y % 2 else RI[2])
    for y in range(13, 19):
        for x in range(cx - 2, cx + 3): cv.px(x, y, BRS[5] if x < cx else BRS[2])
    cv.px(cx + 1, 3, RI[3]); cv.px(cx - 1, 2, RI[2])
    return shadow_under(fin(cv, .6), cx, cy + 4, 20, 5, 70)


def grandfather_clock(seed=0):
    """괘종시계 1×3(16x48): 뾰족 지붕 머리·멈춘 흰 숫자판(바늘 둘, 숫자 없음)·유리 속 멈춘 추·검은 참나무 몸통, 먼지·거미줄.
    아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(2, 6):                                                       # 뾰족 지붕
        for x in range(8 - (y - 1) * 2, 8 + (y - 1) * 2):
            if 0 <= x < 16: cv.px(x, y, GW[5] if x < 8 else GW[3])
    cv.px(7, 1, BRS[5]); cv.px(8, 1, BRS[3])
    for y in range(6, 46):
        for x in range(2, 14):
            c = GW[4] if x < 4 else (GW[3] if x < 12 else GW[2])
            if y == 6: c = GW[5]
            cv.px(x, y, c)
    for y in range(8, 18):                                                      # 숫자판(동그라미, 바늘 2개)
        for x in range(3, 13):
            d = ((x + .5 - 8) / 5) ** 2 + ((y + .5 - 13) / 5) ** 2
            if d <= 1: cv.px(x, y, LN[6] if d < .5 else LN[5])
            if .8 < d <= 1: cv.px(x, y, BRS[4])
    for (x, y) in ((8, 13), (8, 12), (8, 11), (9, 13), (10, 14), (11, 15)): cv.px(x, y, OUTL)
    for y in range(20, 38):                                                     # 추 창
        for x in range(5, 11):
            c = GLS[1] if (x + y) % 6 else GLS[2]
            if x == 5 or y == 20: c = GW[2]
            cv.px(x, y, c)
    for y in range(21, 32): cv.px(8, y, BRS[3])
    for y in range(32, 35):
        for x in range(6, 11): cv.px(x, y, BRS[5] if x < 8 else BRS[3])
    for y in range(40, 47):
        for x in range(1, 15): cv.px(x, y, GW[4] if y == 40 or x == 1 else (GW[3] if x < 14 else GW[2]))
    dust_top(cv, 2, 6, 14, 9, seed + 91, .35)
    web_corner(cv, 13, 6, 5, flip=True, seed=seed + 92)
    return shadow_under(fin(cv, .58), 8, 47, 7, 1.2, 70)


def grand_stair_broken(seed=0):
    """부서진 큰 계단 4×4(64x64): 북쪽으로 오르는 넓은 검은 참나무 계단 — 아래 다섯 단은 성하고 붉은 카펫 띠가 남았지만,
    위쪽은 무너져 쪼개진 널과 어둠이 드러났다. 양옆 난간(꼭대기 장식 기둥, 난간동자 몇 개 빠짐).
    가운데 2열 아래 2줄만 걷기, 나머지 막힘(오를 수 없다)."""
    W, H = 64, 64; cv = Cv(W, H)
    steps = 10
    for i in range(steps):                                                      # i = 0 꼭대기
        y0 = 4 + i * 6; y1 = y0 + 6
        for y in range(y0, y1):
            for x in range(8, 56):
                ly = y - y0
                c = GW[4] if ly < 3 else (GW[2] if ly < 5 else GW[1])          # 밟판 + 앞 챌판
                if ly == 0: c = GW[5]
                k = i / float(steps)
                c = mix(c, OUTL, max(0.0, .55 - k * .6))                       # 위로 갈수록 어둠
                if 26 <= x < 38 and ly < 3: c = CR[4] if ly == 0 else CR[3]     # 카펫 띠
                if 26 <= x < 38 and 3 <= ly < 5: c = CR[2]
                if x in (26, 37) and ly < 5: c = BRS[3]
                cv.px(x, y, c)
    # 무너진 위쪽: 들쭉날쭉 구멍(어둠) + 쪼개진 널 끝
    for y in range(4, 34):
        for x in range(8, 56):
            edge = 18 + 9 * math.sin(x * .19 + seed) + 5 * math.sin(x * .47) + (x - 32) * .08
            if y < edge:
                c = OUTL if (x + y) % 7 else (24, 20, 26)
                if abs(y - edge) < 1.2: c = GW[5]
                elif abs(y - edge) < 2.2: c = GW[3]
                cv.px(x, y, c)
    for (x, y, L) in ((14, 20, 6), (40, 16, 7), (30, 24, 5), (48, 22, 4)):    # 매달린 부러진 널
        for i in range(L): cv.px(x + i // 2, y - i, GW[4] if i % 2 else GW[3])
    # 양옆 난간: 손잡이(윗면) + 난간동자 + 꼭대기 기둥
    for side in (0, 1):
        xa = 2 if side == 0 else 56
        for y in range(10, 62):
            for x in range(xa, xa + 6):
                if y < 14: continue
                c = GW[4] if x < xa + 2 else (GW[3] if x < xa + 4 else GW[2])
                cv.px(x, y, c)
        for y in range(40, 62):                                                 # 아래 받침 기둥
            for x in range(xa - 1, xa + 7): cv.px(x, y, GW[4] if x < xa + 1 else (GW[3] if x < xa + 5 else GW[2]))
        for y in range(36, 41):
            for x in range(xa - 1, xa + 7): cv.px(x, y, GW[5] if y == 36 else GW[4])
        cv.px(xa + 2, 35, BRS[5]); cv.px(xa + 3, 35, BRS[4]); cv.px(xa + 3, 34, BRS[3])
        # 난간동자(계단 안쪽 모서리를 따라, 몇 개 빠짐)
        bx = xa + (6 if side == 0 else -2)
        for y in range(14, 40, 4):
            if _hash(y, side, seed + 101) < .25: continue
            for yy in range(y, y + 3): cv.px(bx, yy, GW[3]); cv.px(bx + 1, yy, GW[2])
    # 맨 아래 첫 단 앞 턱
    for x in range(8, 56): cv.px(x, 63, OUTL)
    return fin(cv, .6)


def stair_landing_dark(seed=0):
    """계단 위 무너진 층계참 4×3(64x48, 벽 앞면 장식, 앞면 3줄 필요): 벽에 뚫린 넓은 아치 너머 어둠, 위층 층계참의 부러진
    난간과 걸린 널 — 큰 계단(grand_stair_broken) 바로 위에 붙인다."""
    W, H = 64, 48; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            ay = 4 + int(14 * (1 - math.sqrt(max(0.0, 1 - ((x + .5 - 32) / 26.0) ** 2))))
            if x < 6 or x >= 58 or y < ay: continue
            fr = x in (6, 7, 56, 57) or y in (ay, ay + 1)
            if fr: c = GW[4] if (x < 8 or y == ay) else GW[2]
            else:
                c = OUTL if (x + y * 3) % 9 else (22, 18, 26)
                if y > 30: c = mix(OUTL, GW[1], min(1.0, (y - 30) / 30.0))
            cv.px(x, y, c)
    # 위층 층계참 바닥 턱과 부러진 난간
    for x in range(8, 56):
        cv.px(x, 30, GW[4]); cv.px(x, 31, GW[2])
    for x in range(10, 54, 5):
        if _hash(x, 0, seed + 111) < .3: continue
        h = 8 if _hash(x, 1, seed + 112) < .7 else 4
        for y in range(30 - h, 30): cv.px(x, y, GW[3]); cv.px(x + 1, y, GW[2])
    for x in range(10, 30): cv.px(x, 21, GW[4])
    for i in range(10): cv.px(30 + i, 21 + i // 2, GW[4])                      # 꺾여 늘어진 손잡이
    for (x, y) in ((44, 34), (45, 35), (45, 36), (46, 37)): cv.px(x, y, GW[3])
    web_corner(cv, 8, 18, 4, seed=seed + 113)
    return fin(cv, .6)


def sconce_manor(seed=0, lit=True):
    """벽 촛대 1×1(벽 앞면 장식): 녹슨 쇠 팔과 접시 위 짧은 초(켜짐 = 호박색 불꽃, 꺼짐 = 검은 심지)."""
    cv = Cv(16, 16)
    for y in range(9, 13): cv.px(7, y, RI[3]); cv.px(8, y, RI[1])
    for x in range(4, 12): cv.px(x, 8, RI[4] if x < 8 else RI[2])
    for (x, y) in ((6, 13), (7, 14), (8, 14), (9, 13)): cv.px(x, y, RI[2])
    candle(cv, 7, 4, 4, lit)
    cv.px(9, 10, LN[5])
    return fin(cv, .62)


def coat_rack(seed=0):
    """외투 걸이 1×2(16x32): 세 다리 검은 참나무 기둥 꼭대기 갈고리 넷, 하나에 걸린 해진 청회 망토(어깨 좁고 아래로 퍼지는
    주름, 해진 밑단). 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(2, 29): cv.px(7, y, GW[4]); cv.px(8, y, GW[2])
    cv.px(7, 1, GW[5]); cv.px(8, 1, GW[3])
    for (x, y) in ((4, 3), (5, 4), (6, 4), (11, 3), (10, 4), (9, 4), (5, 2), (10, 2)): cv.px(x, y, GW[4] if x < 8 else GW[3])
    for y in range(5, 24):                                                      # 망토(오른쪽 갈고리에서 늘어짐)
        hw = 2.5 + (y - 5) * 3.5 / 19
        for x in range(int(9 - hw), int(9 + hw) + 1):
            if x < 1 or x > 14: continue
            f = (x * 2 + y // 5) % 5
            c = GS[3] if f in (0, 1) else (GS[2] if f in (2, 3) else GS[1])
            if x == int(9 - hw): c = GS[4]
            if y > 20 and _hash(x, y, seed + 121) < .3 + (y - 20) * .15: continue
            cv.px(x, y, c)
    for x in range(7, 12): cv.px(x, 5, GS[4])                                 # 깃
    cv.px(8, 6, GS[1]); cv.px(9, 6, GS[1])
    for (x, y) in ((4, 29), (5, 29), (10, 29), (11, 29), (3, 30), (12, 30), (7, 29), (8, 29)): cv.px(x, y, GW[3])
    return shadow_under(fin(cv, .6), 8, 30, 5, 1.0, 60)

def urn_dead_flowers(seed=0):
    """마른 꽃 돌 항아리 1×2(16x32): 청회 돌 받침 항아리에 고개 숙인 시든 꽃대와 떨어진 꽃잎. 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for i, (x0, y0, dx) in enumerate(((7, 18, -1), (8, 18, 1), (6, 18, -2), (9, 18, 2), (8, 18, 0))):
        x, y = x0, y0
        for t in range(10 + i % 3):
            cv.px(int(x), y, MO[4] if t % 3 else MO[3]); y -= 1; x += dx * .18
        cv.px(int(x), y, DU[3]); cv.px(int(x) + 1, y + 1, (96, 70, 60)); cv.px(int(x) - 1, y + 1, (96, 70, 60))
    for y in range(17, 28):                                                     # 항아리
        hw = 5 if 19 < y < 25 else (4 if y < 26 else 3)
        for x in range(8 - hw, 8 + hw):
            cv.px(x, y, GS[cyl_k(x, 8 - hw, 8 + hw)])
    topell(cv, 8, 17.5, 4.5, 1.5, GS, 5, 3, seed + 131)
    for x in range(5, 11): cv.px(x, 17, OUTL)
    for y in range(28, 31):
        for x in range(4, 12): cv.px(x, y, GS[4] if y == 28 else GS[2])
    for (x, y) in ((2, 30), (13, 29), (12, 31)): cv.px(x, y, (96, 70, 60))
    return shadow_under(fin(cv, .6), 8, 30, 5, 1.0, 60)


def raven_bust(seed=0):
    """까마귀 흉상 1×2(16x32): 청회 돌 받침 기둥 위 어깨와 둥근 머리만 남은 얼굴 없는 돌 흉상, 머리 위에 검은 까마귀
    (부리·꼬리 실루엣)가 앉았다. 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(19, 29):
        for x in range(5, 11): cv.px(x, y, GS[cyl_k(x, 5, 11)])
    for y in range(17, 20):
        for x in range(2, 14): cv.px(x, y, GS[5] if y == 17 else (GS[4] if x < 13 else GS[3]))
    for y in range(28, 31):
        for x in range(3, 13): cv.px(x, y, GS[4] if y == 28 else GS[2])
    for y in range(12, 17):                                                     # 어깨
        hw = 4 + (y - 12)
        for x in range(8 - hw, 8 + hw): cv.px(x, y, GS[cyl_k(x, 8 - hw, 8 + hw)])
    for y in range(6, 13):                                                      # 둥근 머리(얼굴 없음)
        for x in range(4, 12):
            d = ((x + .5 - 8) / 4) ** 2 + ((y + .5 - 9.5) / 3.6) ** 2
            if d <= 1: cv.px(x, y, GS[cyl_k(x, 4, 12)] if d < .8 else GS[3])
    RV = [(10, 10, 16), (24, 24, 34), (46, 48, 62)]
    for (x, y) in ((5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4), (6, 3), (7, 3), (8, 3), (9, 3), (10, 3), (11, 3), (8, 5), (9, 5),
                   (10, 2), (11, 2), (12, 2), (11, 1), (12, 1), (13, 2), (14, 2), (4, 4), (3, 5), (2, 5)):
        cv.px(x, y, RV[0])                                                      # 까마귀(몸·머리·부리·꼬리)
    for (x, y) in ((6, 3), (7, 3), (11, 1)): cv.px(x, y, RV[2])
    cv.px(12, 1, (150, 150, 140))                                              # 눈 빛 한 점
    return shadow_under(fin(cv, .6), 8, 30, 6, 1.0, 60)

def plaster_debris(seed=0):
    """회반죽 부스러기 1×1(바닥 장식): 천장에서 떨어진 회백 덩이와 가루, 쪼개진 오리 몰딩 조각."""
    cv = Cv(16, 16)
    for i in range(7):
        x = int(2 + _hash(i, 0, seed + 141) * 11); y = int(4 + _hash(i, 1, seed + 142) * 9)
        r = 1 + int(_hash(i, 2, seed + 143) * 2)
        for yy in range(y, y + r):
            for xx in range(x, x + r + 1):
                cv.px(xx, yy, PL[3] if yy == y else PL[2])
        cv.px(x + r + 1, y + r - 1, DU[1])
    for i in range(14):
        cv.px(int(_hash(i, 3, seed + 144) * 16), int(6 + _hash(i, 4, seed + 145) * 10), DU[4])
    for x in range(4, 11): cv.px(x, 12, GW[4] if x % 2 else PL[3])
    return fin(cv, .7)


def floor_hole(seed=0):
    """마루 구멍 2×2(32x32): 썩어 꺼진 마루 — 널 줄(6px)마다 길이가 다르게 부러져 계단처럼 들쭉날쭉한 끝(밝은 생나무 단면),
    북쪽 안벽은 널 두께, 밑으로 들보 한 줄과 어둠. 걸을 수 없다(전체 막힘)."""
    W, H = 32, 32; cv = Cv(W, H)
    rows = [(4, 11, 20), (10, 6, 24), (16, 3, 27), (22, 8, 25), (28, 13, 21)]   # (줄 위 y, 왼쪽 끝 x, 오른쪽 끝 x)
    for (y0, xa, xb) in rows:
        xa += int(_hash(y0, 0, seed + 161) * 3) - 1; xb += int(_hash(y0, 1, seed + 162) * 3) - 1
        for y in range(y0, min(32, y0 + 6)):
            ly = y - y0
            for x in range(xa, xb):
                c = OUTL if ly < 3 else (24, 20, 26)
                if 15 <= y <= 17: c = GW[2] if y < 17 else GW[1]                # 밑 들보
                cv.px(x, y, c)
            if ly < 5:
                cv.px(xa - 1, y, GW[6]); cv.px(xa - 2, y, GW[5]); cv.px(xb, y, GW[3]); cv.px(xb + 1, y, GW[4])   # 부러진 끝
                if ly in (1, 3): cv.px(xa - 3, y, GW[5]); cv.px(xb + 2, y, GW[4])
    for x in range(11, 20): cv.px(x, 4, GW[3]); cv.px(x, 5, GW[2])            # 북쪽 안벽(널 두께)
    return cv.im                                                                # 윤곽 없음: 바닥 널 위에 덧그리는 구멍

def doormat_torn(seed=0):
    """해진 입구 깔개 2×1(바닥 장식): 검붉은 바탕에 바랜 테두리, 한쪽 끝이 뜯겨 올이 풀렸다."""
    W, H = 32, 16; cv = Cv(W, H)
    for y in range(3, 14):
        for x in range(1, 31):
            if x > 26 and _hash(x, y, seed + 151) < (x - 26) / 5.0: continue
            c = CR[3]
            if y in (3, 13) or x == 1: c = CR[2]
            elif y in (5, 11) or x == 3: c = mix(CR[4], DU[3], .3)
            if _hash(x, y, seed + 152) < .06: c = CR[1]
            cv.px(x, y, c)
    for x in range(27, 32, 2): cv.px(x, 8 + (x % 3), CR[4])
    return fin(cv, .7)


def console_table(seed=0):
    """벽 탁자 2×2(32x32): 휜 다리 검은 참나무 벽 탁자 — 윗면에 흐린 놋쇠 쟁반·꺼진 초 한 쌍·엎어진 작은 액자, 앞 서랍 띠, 먼지.
    아랫줄 막힘(윗줄 걷기+가림)."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(12, 19):                                                     # 윗면
        for x in range(1, 31): cv.px(x, y, GW[5] if (y == 12 or x == 1) else (GW[4] if x < 30 else GW[3]))
    for y in range(19, 24):                                                     # 서랍 띠
        for x in range(1, 31):
            c = GW[3] if x < 29 else GW[2]
            if y == 23: c = GW[1]
            if y == 21 and x in (9, 10, 21, 22): c = BRS[4]
            cv.px(x, y, c)
    for (x0, d) in ((3, 1), (27, -1)):                                          # 휜 다리
        for y in range(24, 31):
            x = x0 + (d if 26 < y < 29 else 0)
            cv.px(x, y, GW[4] if d > 0 else GW[3]); cv.px(x + 1, y, GW[2])
    topell(cv, 18, 15.5, 6, 2.2, BRS, 5, 3, seed + 171)                          # 쟁반
    for x in (5, 9): candle(cv, x, 6, 7, lit=False)
    for x in range(4, 12): cv.px(x, 13, BRS[4] if x < 8 else BRS[2])
    for y in range(13, 16):                                                     # 엎어진 작은 액자
        for x in range(24, 29): cv.px(x, y, BRS[4] if y == 13 else GW[1])
    dust_top(cv, 1, 12, 31, 19, seed + 172, .35)
    return shadow_under(fin(cv, .58), 16, 31, 14, 1.2, 70)


def hall_bench(seed=0):
    """높은 등받이 긴 의자 2×2(32x32): 현관 벽가에 두는 검은 참나무 긴 의자 — 판 등받이(조각 테), 바랜 검붉은 방석, 팔걸이.
    아랫줄 막힘(등받이 줄 걷기+가림)."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 20):                                                      # 등받이
        for x in range(2, 30):
            c = GW[3] if x < 28 else GW[2]
            if y == 4: c = GW[5]
            if 7 <= y <= 16 and x in (5, 15, 16, 26): c = GW[2]
            if 7 <= y <= 16 and x in (6, 17): c = GW[4]
            cv.px(x, y, c)
    for (x, y) in ((2, 3), (29, 3), (2, 2), (29, 2)): cv.px(x, y, GW[5] if x == 2 else GW[3])
    for y in range(20, 25):                                                     # 방석(윗면)
        for x in range(3, 29): cv.px(x, y, CR[4] if y == 20 else (CR[3] if x < 27 else CR[2]))
    for y in range(18, 27):                                                     # 팔걸이
        for x in list(range(0, 3)) + list(range(29, 32)): cv.px(x, y, GW[4] if y == 18 else (GW[3] if x < 3 else GW[2]))
    for y in range(25, 28):
        for x in range(1, 31): cv.px(x, y, GW[3] if x < 30 else GW[2])
    for x in (2, 29):
        for y in range(28, 31): cv.px(x, y, GW[3])
    dust_top(cv, 0, 18, 32, 25, seed + 181, .3)
    return shadow_under(fin(cv, .58), 16, 31, 15, 1.2, 70)


def portrait_fallen(seed=0):
    """떨어진 액자 2×1(바닥 장식, 걷기): 벽에서 떨어져 바닥에 비스듬히 누운 빈 도금 액자, 깨진 유리 조각과 끊어진 끈."""
    W, H = 32, 16; cv = Cv(W, H)
    for y in range(3, 14):
        for x in range(3, 27):
            xs = x - (y - 3) // 3
            if not (3 <= xs < 25): continue
            d = min(xs - 3, y - 3, 24 - xs, 13 - y)
            if d < 2: c = BRS[5] if (d == 0 and (y == 3 or xs == 3)) else (BRS[3] if d == 0 else BRS[4])
            else: c = GW[1] if (xs + y) % 4 else GW[2]
            cv.px(x, y, c)
    for (x, y) in ((27, 12), (28, 13), (26, 14), (29, 11)): cv.px(x, y, GLS[5])
    for i in range(5): cv.px(14 + i, 2 - (i % 2), LN[3])
    return fin(cv, .7)


def vase_broken(seed=0):
    """깨진 꽃병 1×1(바닥 장식, 걷기): 쓰러져 깨진 청회 도자기 조각과 흩어진 시든 꽃잎·마른 줄기."""
    cv = Cv(16, 16)
    for (x0, y0, w, h) in ((3, 8, 5, 3), (9, 9, 3, 3), (6, 12, 3, 2), (12, 6, 2, 2)):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w): cv.px(x, y, GS[5] if y == y0 else (GS[4] if x < x0 + w - 1 else GS[3]))
    for (x, y) in ((4, 9), (5, 9)): cv.px(x, y, GS[2])
    for i in range(6): cv.px(8 + i, 4 + (i % 2), MO[4])
    for (x, y) in ((13, 4), (2, 13), (11, 13), (14, 11)): cv.px(x, y, (96, 70, 60))
    return fin(cv, .7)
