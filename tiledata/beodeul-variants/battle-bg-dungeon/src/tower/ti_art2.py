# 탑 내부 조각 2: 중간층 서재(책장·책상·독서대·촛대·책 더미·두루마리 선반·사다리)와 기계실(벽 톱니바퀴·시계 톱니 기계·
# 바닥 톱니판·레버·쇠사슬 도르래·증기관·톱니 상자·추). 손 도트, 버들항 램프. 3/4 시점, 빛 왼쪽 위.
from ti_kit import *
from ti_kit import _hash

SPINE = [SL[3], RD[3], LF[2], GLD[4], WD[4], SL[4], RD[4], (70, 96, 120), CRM[4], LF[3], (120, 60, 100)]


def _books(cv, x0, x1, ybot, h, seed, lean=True):
    """선반 한 칸의 책등 줄: 폭 2~3px, 높이 제각각, 가끔 기운 책·빈틈. 위 1px 밝은 머리, 오른쪽 그늘."""
    x = x0
    i = 0
    while x < x1:
        r = _hash(i, ybot, seed)
        w = 2 if r < .6 else 3
        if r > .93 and x + 3 < x1:                                      # 빈틈
            x += 2; i += 1; continue
        hh = h - int(_hash(i, ybot, seed + 1) * 3)
        col = SPINE[int(_hash(i, ybot, seed + 2) * len(SPINE))]
        for xx in range(x, min(x1, x + w)):
            for y in range(ybot - hh, ybot):
                c = col
                if xx == x + w - 1: c = mul(col, .7)
                if y == ybot - hh: c = mix(col, (255, 255, 255), .35)
                if y == ybot - hh + 2 and w == 3: c = mix(col, GLD[5], .5)   # 금박 띠
                cv.px(xx, y, c)
        x += w; i += 1


def bookcase_tall(seed=0):
    """큰 책장 2×3(32x48): 벽에 붙여 세우는 키 큰 나무 책장 — 윗면 판(밝음) + 앞면 선반 4단에 빛깔 책등, 아래 서랍 띠. 아랫줄 2칸 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(0, 4):                                              # 윗면(널 갓판)
        for x in range(0, 32): cv.px(x, y, WD[6] if y == 0 or x == 0 else (WD[5] if x < 30 else WD[4]))
    for y in range(4, 47):                                             # 몸통 앞면 테
        for x in range(0, 32):
            if x < 2 or x >= 30: cv.px(x, y, WD[4] if x == 0 else (WD[3] if x < 2 else WD[2]))
    shelves = [(5, 14), (15, 24), (25, 34), (35, 41)]
    for (ya, yb) in shelves:
        for y in range(ya, yb):
            for x in range(2, 30): cv.px(x, y, WD[1] if y < ya + 2 else WD[2])     # 선반 속 그늘
        _books(cv, 3, 29, yb, yb - ya - 1, seed + ya)
        for x in range(2, 30): cv.px(x, yb, WD[5] if x < 28 else WD[4])           # 선반 앞 턱
    for y in range(42, 47):                                            # 아래 서랍 띠
        for x in range(2, 30):
            c = WD[3] if x < 28 else WD[2]
            if x in (15, 16): c = WD[1]
            if y == 46: c = WD[1]
            cv.px(x, y, c)
    cv.px(8, 44, GLD[5]); cv.px(23, 44, GLD[5])
    return fin(cv, .55)


def bookcase_low(seed=0):
    """낮은 책장 2×2(32x32): 방 가운데 두는 등 맞댄 책장 — 윗면에 눕힌 책·촛대, 앞면 선반 2단. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 12):                                             # 윗면
        for x in range(1, 31):
            c = WD[5] if (y == 4 or x == 1) else WD[4]
            if x >= 29: c = WD[3]
            cv.px(x, y, c)
    for y in range(12, 31):
        for x in range(1, 31):
            if x < 3 or x >= 29: cv.px(x, y, WD[3] if x < 3 else WD[2])
    for (ya, yb) in ((13, 21), (22, 29)):
        for y in range(ya, yb):
            for x in range(3, 29): cv.px(x, y, WD[1])
        _books(cv, 4, 28, yb, yb - ya - 1, seed + ya * 3)
        for x in range(3, 29): cv.px(x, yb, WD[5] if x < 27 else WD[4])
    for x in range(1, 31): cv.px(x, 30, WD[1])
    # 윗면: 눕힌 책 두 권 + 펼친 책
    for (x0, y0, w, col) in ((4, 6, 9, SL[3]), (5, 8, 8, RD[3])):
        for y in range(y0, y0 + 2):
            for x in range(x0, x0 + w): cv.px(x, y, col if y == y0 else mul(col, .7))
    for y in range(6, 10):
        for x in range(17, 27):
            c = CRM[6] if x < 22 else CRM[5]
            if x == 22: c = CRM[3]
            if y == 9: c = CRM[3]
            if y in (7, 8) and x % 2 == 0 and x != 22: c = ST[3]
            cv.px(x, y, c)
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def reading_desk(seed=0):
    """독서 책상 2×2(32x32): 서랍 달린 나무 책상 윗면에 펼친 큰 책·잉크병과 깃펜·작은 촛대, 앞에 등받이 의자. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 22):
        for x in range(1, 31):
            if y < 13:
                c = WD[5] if (y == 4 or x == 1) else WD[4]
                if (y - 4) % 3 == 2: c = WD[3] if x < 30 else WD[2]
                if x >= 29: c = WD[3]
            else:
                c = WD[3] if x < 28 else WD[2]
                if y == 13: c = WD[2]
                if 15 <= y <= 18 and x in (6, 7, 8, 9, 22, 23, 24, 25): c = WD[4] if y == 15 else WD[3]
                if y == 21: c = WD[1]
            cv.px(x, y, c)
    cv.px(8, 17, GLD[5]); cv.px(23, 17, GLD[5])
    for (x0, y0) in ((2, 22), (28, 22)):
        for y in range(y0, y0 + 8): cv.px(x0, y, WD[3]); cv.px(x0 + 1, y, WD[2])
    # 펼친 책
    for y in range(5, 11):
        for x in range(9, 23):
            c = CRM[6] if x < 16 else CRM[5]
            if x == 16 or x == 15: c = CRM[3]
            if y == 10: c = WD[2]
            if y in (6, 7, 8) and x % 2 == 1 and x not in (15, 16) and 10 < x < 22: c = ST[3]
            cv.px(x, y, c)
    for x in range(9, 23): cv.px(x, 10, RD[2])
    # 잉크병·깃펜
    for y in range(6, 10):
        for x in range(25, 28): cv.px(x, y, IR[1] if x < 27 else IR[0])
    cv.px(25, 6, IR[4])
    for (x, y) in ((27, 2), (27, 3), (26, 4), (26, 5)): cv.px(x, y, CRM[6])
    cv.px(28, 2, CRM[5]); cv.px(28, 1, CRM[6])
    # 촛대
    for y in range(3, 9): cv.px(4, y, CRM[6] if y > 4 else CRM[5]); cv.px(5, y, CRM[4])
    cv.px(4, 2, FL[3]); cv.px(4, 1, FL[4]); cv.px(5, 2, FL[2]); cv.px(4, 0, FL[2])
    for x in range(2, 8): cv.px(x, 9, GLD[4] if x < 5 else GLD[3])
    # 의자(앞, 등받이가 보인다)
    for y in range(22, 31):
        for x in range(12, 20):
            c = WD[4] if x < 14 else WD[3]
            if y == 22: c = WD[5]
            if y >= 28 and 13 < x < 18: continue
            cv.px(x, y, c)
    for x in range(13, 19): cv.px(x, 25, WD[2])
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def lectern(seed=0):
    """독서대 1×2(16x32): 기울어진 판에 펼친 두꺼운 책과 붉은 책갈피, 돌린 나무 기둥, 십자 받침. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(4, 13):                                             # 기울어진 판(윗면 쪽이 보인다)
        for x in range(1, 15):
            c = WD[5] if y < 6 else WD[4]
            if x >= 13: c = WD[3]
            if y == 12: c = WD[2]
            cv.px(x, y, c)
    for y in range(4, 11):                                             # 책
        for x in range(2, 14):
            c = CRM[6] if x < 8 else CRM[5]
            if x in (7, 8): c = CRM[3]
            if y in (6, 8) and x % 2 == 0 and x not in (8,): c = ST[3]
            cv.px(x, y, c)
    for y in range(10, 15): cv.px(8, y, RD[4] if y < 13 else RD[3])
    for y in range(13, 28):                                            # 기둥
        for x in range(6, 10):
            k = cyl_k(x, 6, 10)
            if y in (16, 17, 23, 24): k += 1
            cv.px(x, y, WD[clamp(k)])
    for y in range(27, 31):                                            # 받침
        for x in range(2, 14): cv.px(x, y, WD[5] if y == 27 else (WD[3] if x < 12 else WD[2]))
    return shadow_under(fin(cv, .55), 8, 31, 6.5, 1.3, 70)


def candle_stand(seed=0):
    """세 갈래 촛대 1×2(16x32): 바닥에 세우는 쇠 촛대, 초 셋과 불꽃. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(10, 29): cv.px(7, y, IR[4]); cv.px(8, y, IR[2])
    for x in range(2, 14): cv.px(x, 11, IR[4] if x < 8 else IR[3])
    for x in (2, 13): cv.px(x, 10, IR[3])
    for (cx, top) in ((2, 5), (7, 3), (13, 5)):
        for y in range(top, 10):
            cv.px(cx, y, CRM[6] if cx < 8 else CRM[5])
            cv.px(cx + 1 if cx < 13 else cx - 1, y, CRM[4]) if cx != 13 else cv.px(cx - 1, y, CRM[5])
        cv.px(cx, top - 1, FL[3]); cv.px(cx, top - 2, FL[4]); cv.px(cx, top - 3, FL[2])
    for x in range(4, 12): cv.px(x, 29, IR[3] if x < 8 else IR[2])
    for x in range(3, 13): cv.px(x, 30, IR[1])
    return shadow_under(fin(cv, .5), 8, 31, 6, 1.2, 70)


def book_pile(seed=0):
    """책 더미 1×1: 바닥에 쌓은 책 다섯 권(엇갈림) + 맨 위 펼친 책. 걷기(작은 장식)."""
    cv = Cv(16, 16)
    y = 14
    for i, col in enumerate((SL[3], RD[3], LF[2], WD[4], GLD[4])):
        w = 11 - (i % 2) * 2; x0 = 2 + int(_hash(i, 0, seed + 4) * 3)
        for yy in (y - 1, y):
            for x in range(x0, x0 + w):
                c = col if yy == y - 1 else mul(col, .65)
                if x == x0 + w - 1: c = CRM[4] if yy == y - 1 else CRM[3]       # 종이 가장자리
                cv.px(x, yy, c)
        y -= 2
    return fin(cv, .55)


def scroll_rack(seed=0):
    """두루마리 선반 2×2(32x32): 마름모 칸 나무 선반에 말린 두루마리(크림 끝·붉은 끈). 아래 2줄 막힘."""
    cv = Cv(32, 32)
    for y in range(2, 30):
        for x in range(1, 31):
            c = WD[2]
            if (x - 1) % 6 in (0, 5) or (y - 2) % 7 in (0, 6): c = WD[4] if (x - 1) % 6 == 0 or (y - 2) % 7 == 0 else WD[3]
            cv.px(x, y, c)
    for gy in range(4):
        for gx in range(5):
            if _hash(gx, gy, seed + 2) < .2: continue
            cx = 1 + gx * 6 + 3; cy = 2 + gy * 7 + 3
            for (dx, dy) in ((-1, 0), (1, 0), (-1, 1), (1, 1)) if _hash(gx, gy, seed + 3) < .5 else ((0, 0), (0, 1)):
                cv.px(cx + dx - 1, cy + dy, CRM[6]); cv.px(cx + dx, cy + dy, CRM[4])
            cv.px(cx, cy + 2, RD[4])
    for x in range(1, 31): cv.px(x, 30, WD[1]); cv.px(x, 1, WD[5])
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.2, 70)


def library_ladder(seed=0):
    """책장 사다리 1×3(16x48, 앞면 장식): 책장 앞에 기대 세운 나무 사다리. 걷기(책장이 이미 막는다)."""
    cv = Cv(16, 48)
    for y in range(0, 47):
        x0 = 4 + y // 16; x1 = 11 + y // 16
        cv.px(x0, y, WD[5]); cv.px(x0 + 1, y, WD[3]); cv.px(x1, y, WD[4]); cv.px(x1 + 1, y, WD[2])
        if y % 6 == 3:
            for x in range(x0 + 2, x1): cv.px(x, y, WD[5]); cv.px(x, y + 1, WD[2])
    return fin(cv, .55)


# ------------------------------------------------------------------ 기계실
def _gear_face(cv, cx, cy, r, teeth, ramp, seed=0, hub=None, spokes=4, phase=0.0):
    """정면에서 본 톱니바퀴(벽에 단 것): 이빨, 테, 바퀴살, 굴대. 빛 왼쪽 위."""
    for y in range(int(cy - r - 3), int(cy + r + 4)):
        for x in range(int(cx - r - 3), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            tooth = (math.cos(a * teeth + phase) > .25)
            rr = r + (2 if tooth else 0)
            if d > rr: continue
            light = -(dx + dy) / max(1.0, d) * .5 + .5
            if d > r - 2: k = 4 + (1 if light > .6 else 0) - (1 if light < .3 else 0)
            elif d > r - 4: k = 2
            elif d < 3.2: k = 5 if light > .5 else 3
            else:
                sp = any(abs(math.sin(a - phase / teeth - i * math.pi / spokes)) * d < 1.6 for i in range(spokes))
                if not sp: continue
                k = 4 if light > .5 else 3
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])
    cv.px(int(cx) - 1, int(cy) - 1, ramp[6] if len(ramp) > 6 else ramp[-1])


def wall_gear(seed=0):
    """벽 톱니바퀴 3×3(48x48, 앞면 장식): 벽에 박은 큰 놋쇠 톱니바퀴와 맞물린 작은 쇠 톱니, 쇠 받침대. 앞면 3줄 위."""
    cv = Cv(48, 48)
    _gear_face(cv, 21, 22, 15, 14, BR, seed, spokes=4)
    _gear_face(cv, 40, 37, 6.5, 8, [IR[0]] + IR, seed + 1, spokes=3, phase=.4)
    for y in range(40, 47):                                            # 받침대
        for x in range(10, 33): cv.px(x, y, IR[4] if y == 40 else (IR[3] if x < 30 else IR[2]))
    for y in range(22, 40): cv.px(20, y, IR[3]); cv.px(21, y, IR[2])
    return fin(cv, .55)


def _gear_top(cv, cx, cy, r, teeth, ramp, ry=.5, phase=0.0, thick=3, seed=0, holes=4):
    """위에서 비스듬히 본 누운 톱니바퀴(타원): 두께 앞면(어둠) 위에 윗면 — 이빨 테(밝은 왼쪽 위), 안쪽 바퀴살 사이 뚫린 구멍(어둠), 굴대."""
    def shape(x, y):
        dx = x + .5 - cx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
        tooth = math.cos(a * teeth + phase) > .2
        return d, a, (d <= r + (2.2 if tooth else 0)), tooth
    # 두께(앞면): 윗면을 thick 만큼 아래로 민 모양 중 윗면 밖인 곳
    for y in range(int(cy - r * ry - 4), int(cy + r * ry + thick + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 5)):
            d0, a0, in0, t0 = shape(x, y)
            if in0: continue
            for k in range(1, thick + 1):
                d1, a1, in1, t1 = shape(x, y - k)
                if in1:
                    dx = x + .5 - cx
                    cv.px(x, y, ramp[3] if dx < -r * .3 else (ramp[2] if dx < r * .5 else ramp[1])); break
    for y in range(int(cy - r * ry - 4), int(cy + r * ry + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 5)):
            d, a, inside, tooth = shape(x, y)
            if not inside: continue
            dx = x + .5 - cx; dy = (y + .5 - cy) / ry
            lit = (-dx - dy * 1.2) / max(1.0, d)
            if d > r - .5:                                    # 이빨
                k = 6 if lit > .45 else (5 if lit > -.2 else 4)
            elif d > r - 2.6:                                 # 테
                k = 5 if lit > .3 else 4
                if d > r - 1.2 and not tooth: k -= 1
            elif d < max(1.8, r * .22):                       # 굴대
                k = 6 if lit > .3 else 4
            elif d < r * .34:
                k = 3
            else:                                             # 바퀴살 사이 구멍
                sp = min(abs(math.sin((a - phase * .1) * holes / 2.0)) * d for _ in (0,))
                if sp > 1.8 and r > 5:
                    cv.px(x, y, (12, 10, 16)); continue
                k = 4 if lit > 0 else 3
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])


def clock_engine(seed=0):
    """시계 톱니 기계 3×3(48x48): 쇠 틀(윗면 판 + 앞면 기둥) 위에 누운 놋쇠 톱니 셋이 맞물리고, 앞면에 흔들리는 추·피스톤. 아래 2줄 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    for y in range(14, 46):                                            # 틀 앞면
        for x in range(2, 46):
            c = IR[3] if x < 6 else (IR[2] if x < 42 else IR[1])
            if y == 14: c = IR[4]
            if x in (2, 3, 44, 45) or y >= 43: c = IR[3] if x < 24 else IR[2]
            if y == 45: c = IR[0]
            if (x in (12, 34)) and 16 < y < 43: c = IR[4] if x == 12 else IR[3]
            cv.px(x, y, c)
    for (x, y) in ((4, 17), (43, 17), (4, 41), (43, 41)): cv.px(x, y, IR[5])
    # 앞면: 추(흔들림)와 피스톤
    for y in range(17, 34): cv.px(23, y, BR[3]); cv.px(24, y, BR[2])
    for y in range(32, 40):
        for x in range(20, 28): cv.px(x, y, BR[5] if x < 23 else (BR[4] if x < 26 else BR[3])) if (x - 24) ** 2 / 16 + (y - 36) ** 2 / 16 <= 1 else None
    for y in range(20, 40):
        for x in range(36, 41): cv.px(x, y, IR[4] if x < 38 else IR[2]) if y < 30 else cv.px(x, y, BR[4] if x < 38 else BR[2])
    for y in range(22, 38):
        for x in range(6, 11): cv.px(x, y, IR[1] if (y // 3) % 2 else IR[3])
    # 윗면 판
    for y in range(4, 15):
        for x in range(2, 46):
            c = IR[4] if (y == 4 or x == 2) else IR[3]
            if x >= 44: c = IR[2]
            cv.px(x, y, c)
    _gear_top(cv, 17, 8, 11, 12, BR, .42, 0.0, 3, seed)
    _gear_top(cv, 35, 8.5, 7, 9, BR, .42, .6, 3, seed + 1)
    _gear_top(cv, 39, 4, 4, 6, [IR[0]] + IR, .42, .2, 2, seed + 2)
    return shadow_under(fin(cv, .55), 24, 46, 23, 2, 80)


def floor_gear(seed=0):
    """바닥 톱니판 2×2(32x32): 바닥 틈에 반쯤 묻혀 도는 누운 큰 톱니(쇠 테 홈). 막힘(틈에 끼면 다친다) 2줄."""
    cv = Cv(32, 32)
    for y in range(6, 28):                                             # 쇠 틀 홈
        for x in range(1, 31):
            if ((x + .5 - 16) / 15) ** 2 + ((y + .5 - 16.5) / 10.5) ** 2 <= 1:
                cv.px(x, y, IR[1] if y > 9 else IR[0])
    for x in range(1, 31):
        for y in range(5, 29):
            d = ((x + .5 - 16) / 15) ** 2 + ((y + .5 - 16.5) / 10.5) ** 2
            if .82 < d <= 1.05: cv.px(x, y, IR[4] if y < 16 else IR[2])
    _gear_top(cv, 16, 15, 12, 14, BR, .62, .3, 3, seed)
    return fin(cv, .55)


def lever_post(seed=0):
    """레버 받침 1×2(16x32): 네모 돌 받침 윗면에서 솟은 쇠 레버와 붉은 손잡이, 앞면에 눈금 판. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    stone_box(cv, 2, 18, 14, 31, 4, ST, seed)
    for y in range(24, 29):
        for x in range(5, 11): cv.px(x, y, BR[4] if y == 24 else BR[3])
    cv.px(6, 26, IR[1]); cv.px(9, 26, IR[1])
    for x in range(4, 12): cv.px(x, 20, IR[1])                         # 홈
    for i in range(11):                                                # 레버 대(기울어짐)
        x = 6 + i // 3; y = 20 - i
        cv.px(x, y, IR[5]); cv.px(x + 1, y, IR[3])
    for y in range(6, 10):
        for x in range(8, 12): cv.px(x, y, RD[5] if x < 10 else RD[3])
    return shadow_under(fin(cv, .55), 8, 31, 6.5, 1.3, 70)


def winch(seed=0):
    """쇠사슬 감는 틀 2×2(32x32): 쇠 A자 받침 둘 사이 굵은 나무 북(가로 원통, 윗면 빛)에 감긴 쇠사슬, 오른쪽 손잡이 바퀴, 북에서 위로 오르는 사슬. 아래 2줄 막힘."""
    cv = Cv(32, 32)
    for (xa, xb) in ((3, 9), (23, 29)):                                # A자 받침(앞면)
        for y in range(12, 31):
            t = (y - 12) / 18.0
            l = int(round((xa + xb) / 2 - (xb - xa) / 2 * t)); r = int(round((xa + xb) / 2 + (xb - xa) / 2 * t))
            for x in (l, l + 1): cv.px(x, y, IR[4] if x == l else IR[3])
            for x in (r - 1, r): cv.px(x, y, IR[2] if x == r else IR[3])
        for x in range(xa, xb + 1): cv.px(x, 23, IR[3]); cv.px(x, 30, IR[1])
    for y in range(9, 21):                                             # 북(가로 원통)
        k = 6 if y == 10 else (5 if y < 13 else (4 if y < 16 else (3 if y < 19 else 2)))
        for x in range(5, 28):
            c = WD[k]
            if x in (5, 27): c = IR[3]
            if 11 <= y <= 18 and (x - y) % 4 == 0 and 6 < x < 26: c = IR[4] if y < 15 else IR[2]   # 감긴 사슬 고리
            if 11 <= y <= 18 and (x - y) % 4 == 1 and 6 < x < 26: c = IR[1]
            cv.px(x, y, c)
    for y in range(0, 10):                                             # 위로 오르는 사슬
        cv.px(15, y, IR[4] if y % 3 else IR[2]); cv.px(16, y, IR[2] if y % 3 else IR[4])
    _gear_face(cv, 28.5, 14.5, 3.6, 8, [IR[0]] + IR, seed, spokes=2)
    for y in range(14, 20): cv.px(31, y, IR[3])
    cv.px(31, 20, RD[4]); cv.px(30, 20, RD[3])
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def steam_pipe(seed=0):
    """증기관 3×1(48x16): 바닥을 따라가는 굵은 놋쇠 관(윗면 빛) + 가운데 바퀴 밸브와 압력계. 막힘 1줄."""
    cv = Cv(48, 16)
    for y in range(7, 15):
        for x in range(0, 48):
            k = 6 if y == 8 else (5 if y < 10 else (4 if y < 12 else (3 if y < 14 else 2)))
            c = BR[k]
            if x % 16 in (0, 1): c = BR[clamp(k - 1)]                  # 이음 고리
            if x % 16 == 2: c = BR[clamp(k + 1, 0, 6)]
            cv.px(x, y, c)
    for y in range(2, 8): cv.px(23, y, BR[4]); cv.px(24, y, BR[2])     # 밸브 대
    _gear_face(cv, 23.5, 3.5, 3.2, 6, [IR[0]] + [RD[2], RD[3], RD[4], RD[5], RD[6], RD[6]], seed, spokes=2)
    for y in range(4, 10):                                             # 압력계
        for x in range(34, 41):
            if (x + .5 - 37.5) ** 2 + (y + .5 - 7) ** 2 <= 9: cv.px(x, y, CRM[6] if (x < 37 and y < 7) else CRM[5])
    cv.px(37, 6, RD[3]); cv.px(38, 5, RD[3]); cv.px(36, 9, BR[3]); cv.px(37, 9, BR[2])
    return shadow_under(fin(cv, .55), 24, 15, 23, 1.2, 60)


def gear_crate(seed=0):
    """톱니 상자 1×1: 뚜껑 열린 나무 상자에 예비 톱니가 쌓였다(윗면 놋쇠 톱니). 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(6, 15):
        for x in range(1, 15):
            if y < 9: c = WD[1]
            else:
                c = WD[4] if x < 3 else (WD[3] if x < 13 else WD[2])
                if y in (9,): c = WD[5]
                if y == 14: c = WD[1]
                if x in (5, 10) and y > 9: c = WD[2]
            cv.px(x, y, c)
    _gear_top(cv, 6, 6, 4.2, 7, BR, .55, .2, 2, seed)
    _gear_top(cv, 11, 7, 3, 6, [IR[0]] + IR, .55, .5, 2, seed + 1)
    return shadow_under(fin(cv, .55), 8, 15, 7, 1.2, 70)


def counterweight(seed=0):
    """시계 추 1×3(16x48, 앞면 장식): 천장에서 내려온 사슬 끝의 무거운 쇠 추와 놋쇠 원판. 앞면 3줄 필요."""
    cv = Cv(16, 48)
    for y in range(0, 26): cv.px(7, y, IR[4] if y % 3 else IR[2]); cv.px(8, y, IR[2] if y % 3 else IR[4])
    for y in range(26, 42):
        for x in range(4, 12): cv.px(x, y, IR[cyl_k(x, 4, 12) - 1 if cyl_k(x, 4, 12) > 1 else 1])
    for x in range(3, 13): cv.px(x, 26, IR[5] if x < 8 else IR[4]); cv.px(x, 41, IR[1])
    for y in range(30, 37):
        for x in range(5, 11):
            if (x + .5 - 8) ** 2 + (y + .5 - 33.5) ** 2 <= 10: cv.px(x, y, BR[5] if x < 8 else BR[3])
    return fin(cv, .55)
