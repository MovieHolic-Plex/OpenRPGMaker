# 신도의 탑 조각 3 — 3층 서고·4층 의식실·나선 계단: 금서 책장(쇠사슬), 낮은 금서 책장, 사슬 묶인 마도서 독서대, 의식 도구 탁자,
# 항아리 선반, 보라 가마솥, 두루마리 더미, 큰 원형 마법진, 높은 제단(계단 단), 큰 보라 화로, 바닥 초 무리, 검붉은 둥근 창,
# 교단 나선 계단(오름/내림), 교단 보라 깔개 오토타일. 손 도트(Pillow), 버들항 7단 램프. 3/4 시점, 빛 왼쪽 위.
from ct_kit import *
from ct_kit import _hash
from gc_kit import autotile_sheet

BOOKC = [VIO, CRIM, [DK, (24, 22, 30), (34, 32, 42), (48, 44, 58), (62, 58, 74), (80, 76, 94), (104, 98, 120)],
         [DK, (30, 34, 26), (44, 50, 36), (60, 68, 46), (78, 88, 56), (100, 110, 70), (128, 136, 92)]]


def _books(cv, x0, x1, ybot, h, seed):
    """선반 책등: 금서 빛깔(보라·검붉은·검정·썩은 초록) 책, 높이·두께 제각각, 금 띠 점, 가끔 해골 책받침."""
    x = x0
    while x < x1:
        w = 2 if _hash(x, seed, 1) < .6 else 3
        if x + w > x1: w = x1 - x
        hh = h - int(_hash(x, seed, 2) * 3)
        R = BOOKC[int(_hash(x, seed, 3) * 4) % 4]
        for i in range(w):
            for y in range(ybot - hh, ybot):
                k = 4 if i == 0 else (3 if i < w - 1 else 2)
                if y == ybot - hh: k += 1
                cv.px(x + i, y, R[clamp(k)])
        if hh > 4 and _hash(x, seed, 4) < .5: cv.px(x, ybot - hh + 2, GLD[4])
        x += w + (1 if _hash(x, seed, 5) < .15 else 0)


def forbidden_bookcase(seed=0):
    """금서 책장 2×3(32x48): 그을린 짙은 나무 키 큰 책장, 선반 4단 금서, 앞을 가로지르는 쇠사슬 둘과 가운데 자물쇠, 꼭대기 해골 장식.
    아랫줄 2칸만 막힘(위 2줄 걷기+가림)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(4, 8):
        for x in range(0, 32): cv.px(x, y, EBW[6] if y == 4 or x == 0 else (EBW[5] if x < 30 else EBW[4]))
    for y in range(8, 47):
        for x in (0, 1, 30, 31): cv.px(x, y, EBW[4] if x == 0 else (EBW[3] if x < 2 else EBW[2]))
    for (ya, yb) in ((9, 18), (19, 28), (29, 37), (38, 43)):
        for y in range(ya, yb):
            for x in range(2, 30): cv.px(x, y, EBW[1] if y < ya + 2 else EBW[2])
        _books(cv, 3, 29, yb, yb - ya - 1, seed + ya)
        for x in range(2, 30): cv.px(x, yb, EBW[5] if x < 28 else EBW[4])
    for y in range(43, 47):
        for x in range(2, 30): cv.px(x, y, EBW[3] if x < 28 else EBW[2])
    for (y0, y1) in ((12, 26), (26, 12)):                                          # X자 쇠사슬
        for i in range(28):
            x = 2 + i; y = int(y0 + (y1 - y0) * i / 27)
            cv.px(x, y, IR[4] if i % 2 else IR[2])
    for y in range(17, 22):
        for x in range(13, 19): cv.px(x, y, GLD[4] if x < 16 else GLD[3])
    cv.px(15, 19, DK); cv.px(16, 19, DK)
    skull(cv, 16, 2, .8, seed)
    return fin(cv, .55)


def chained_bookcase_low(seed=0):
    """낮은 금서 책장 2×2(32x32): 등 맞댄 낮은 책장 — 윗면에 펼친 금서·쌓은 책·초, 앞면 선반 2단, 쇠사슬 한 줄. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 12):
        for x in range(1, 31):
            c = EBW[5] if (y == 4 or x == 1) else EBW[4]
            if x >= 29: c = EBW[3]
            cv.px(x, y, c)
    for y in range(5, 10):                                                         # 펼친 검은 책
        for x in range(4, 15): cv.px(x, y, (40, 34, 46) if x not in (9,) else DK)
    for y in range(6, 9):
        for x in range(5, 14):
            if x != 9: cv.px(x, y, CRM[4] if x < 9 else CRM[3])
    for (y, x0, x1, R) in ((10, 18, 27, CRIM), (8, 19, 26, VIO), (6, 20, 25, BOOKC[2])):
        for x in range(x0, x1): cv.px(x, y, R[4]); cv.px(x, y + 1, R[2])
    candle(cv, 28, 9, 4, seed=seed)
    for y in range(12, 31):
        for x in (1, 30): cv.px(x, y, EBW[3] if x == 1 else EBW[2])
    for (ya, yb) in ((13, 21), (22, 29)):
        for y in range(ya, yb):
            for x in range(2, 30): cv.px(x, y, EBW[1])
        _books(cv, 3, 29, yb, yb - ya - 1, seed + ya)
        for x in range(1, 31): cv.px(x, yb, EBW[5] if x < 29 else EBW[3])
    for i in range(28): cv.px(2 + i, 17 + (1 if (i // 3) % 2 else 0), IR[4] if i % 2 else IR[2])
    for x in range(1, 31): cv.px(x, 30, EBW[2]); cv.px(x, 31, EBW[1])
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def grimoire_lectern(seed=0):
    """마도서 독서대 1×2(16x32): 짙은 나무 기울어진 판 위 쇠사슬로 묶은 펼친 검은 마도서(보라로 빛나는 쪽, 글자 없음). 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(4, 13):
        for x in range(1, 15):
            c = EBW[5] if y < 6 else EBW[4]
            if x >= 13: c = EBW[3]
            if y == 12: c = EBW[2]
            cv.px(x, y, c)
    for y in range(4, 11):
        for x in range(2, 14):
            c = (44, 36, 52) if x in (2, 13) or y in (4, 10) else (PF[3] if x < 8 else PF[2])
            if x in (7, 8): c = (30, 24, 36)
            if y in (6, 8) and x % 2 == 0 and 2 < x < 13 and x not in (7, 8): c = VIO[2]
            cv.px(x, y, c)
    for x in range(0, 16): cv.px(x, 11, IR[4] if x % 2 else IR[2])               # 묶은 사슬
    for y in range(11, 16): cv.px(1, y, IR[3]); cv.px(14, y, IR[2])
    for y in range(13, 28):
        for x in range(6, 10):
            k = cyl_k(x, 6, 10) - 1
            if y in (16, 17, 23, 24): k += 1
            cv.px(x, y, EBW[clamp(k)])
    for y in range(27, 31):
        for x in range(2, 14): cv.px(x, y, EBW[5] if y == 27 else (EBW[3] if x < 12 else EBW[2]))
    return shadow_under(fin(cv, .55), 8, 31, 6.5, 1.3, 70)


def ritual_table(seed=0):
    """의식 도구 탁자 2×2(32x32): 검붉은 천 덮은 짙은 나무 탁자 — 위에 굽은 의식 단검 둘, 검은 그릇, 해골, 초, 작은 병. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(6, 17):
        for x in range(1, 31):
            c = CRIM[4] if y == 6 or x == 1 else CRIM[3]
            if x >= 29: c = CRIM[2]
            if (x * 2 + y) % 11 == 0: c = CRIM[2]
            cv.px(x, y, c)
    for y in range(17, 22):                                                        # 드리운 천 앞면
        for x in range(1, 31):
            if y > 19 and x % 4 == 3: continue
            cv.px(x, y, CRIM[2] if x < 29 else CRIM[1])
    for x in range(1, 31): cv.px(x, 18, GLD[3])
    for lx in (3, 27):
        for y in range(22, 31): cv.px(lx, y, EBW[3]); cv.px(lx + 1, y, EBW[1])
    for (x0, y0) in ((5, 12), (8, 14)):                                            # 굽은 단검
        for i in range(8):
            cv.px(x0 + i, y0 - (i * i) // 20, IR[5] if i < 6 else IR[4])
        cv.px(x0 - 1, y0, EBW[4]); cv.px(x0 - 2, y0, EBW[3]); cv.px(x0 - 1, y0 - 1, GLD[4]); cv.px(x0 - 1, y0 + 1, GLD[3])
    for y in range(9, 13):                                                         # 검은 그릇
        for x in range(15, 22): cv.px(x, y, IR[2] if x < 18 else IR[1])
    for x in range(15, 22): cv.px(x, 9, CRIM[1])
    skull(cv, 25, 9, .8, seed)
    candle(cv, 13, 9, 4, seed=seed)
    for (x, y) in ((27, 14), (28, 14), (27, 13), (28, 13)): cv.px(x, y, (60, 120, 90) if y == 14 else (90, 160, 120))
    return shadow_under(fin(cv, .55), 16, 31, 14, 1.4, 70)


def jar_shelf(seed=0):
    """항아리 선반 2×2(32x32): 벽에 세운 두 단 나무 선반에 표본 병·밀랍 봉한 항아리·두개골. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(1, 31):
        for x in (0, 1, 30, 31): cv.px(x, y, EBW[4] if x == 0 else (EBW[3] if x < 2 else EBW[2]))
    for yb in (14, 28):
        for y in range(yb - 12, yb):
            for x in range(2, 30): cv.px(x, y, EBW[1])
        for x in range(0, 32): cv.px(x, yb, EBW[5] if x < 30 else EBW[3]); cv.px(x, yb + 1, EBW[2])
    for x in range(0, 32): cv.px(x, 1, EBW[5])
    JAR = [(30, 46, 40), (44, 70, 58), (60, 96, 76), (84, 128, 100), (120, 166, 136), (170, 210, 186)]
    for (cx_, yb, kind) in ((6, 14, 0), (13, 14, 1), (20, 14, 2), (26, 14, 0), (7, 28, 1), (16, 28, 2), (24, 28, 1)):
        if kind == 0:                                                              # 유리 표본 병
            for y in range(yb - 9, yb):
                for x in range(cx_ - 2, cx_ + 3):
                    c = JAR[2] if x < cx_ else JAR[1]
                    if x == cx_ - 2: c = JAR[4]
                    if y < yb - 6 and abs(x - cx_) < 1 and _hash(x, y, seed) < .6: c = BONE[2]
                    cv.px(x, y, c)
            for x in range(cx_ - 2, cx_ + 3): cv.px(x, yb - 10, CRM[3])
            cv.px(cx_, yb - 5, BONE[3]); cv.px(cx_ + 1, yb - 4, BONE[2])
        elif kind == 1:                                                            # 밀랍 봉한 작은 항아리
            mk = Mk(W, H); mk.ell(cx_, yb - 4, 3.2, 3.6); mk.rect(cx_ - 1, yb - 9, cx_ + 2, yb - 6)
            vol(cv, mk, [DK, (30, 24, 34), (44, 36, 50), (62, 52, 70), (84, 72, 94), (110, 96, 120), (140, 126, 150)], None, None, 3, seed + cx_, grain=.04)
            cv.px(cx_, yb - 9, CRIM[4]); cv.px(cx_ - 1, yb - 9, CRIM[3])
        else:
            skull(cv, cx_, yb - 5, .8, seed + cx_)
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def cauldron(seed=0):
    """보라 가마솥 2×2(32x32): 짧은 다리의 둥근 검은 쇠솥, 윗면에 끓는 보라 물약과 거품, 밑에 숯불. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x in range(6, 26):                                                         # 숯불
        for y in (29, 30):
            if _hash(x, y, seed) < .7: cv.px(x, y, FL[1] if (x + y) % 3 else FL[3])
    for (x0, x1) in ((7, 9), (23, 25)):
        for y in range(25, 31):
            for x in range(x0, x1): cv.px(x, y, IR[2])
    mk = Mk(W, H); mk.ell(16, 18, 13, 9.5)
    mk2 = Mk(W, H); mk2.rect(0, 0, 32, 12)
    mk.sub(mk2)
    vol(cv, mk, IR, 3, 29, 3, seed, grain=.05)
    topell(cv, 16, 11.5, 13.2, 3.6, IR, 5, 3, seed)
    for y in range(9, 15):
        for x in range(4, 29):
            if ((x + .5 - 16) / 11.4) ** 2 + ((y + .5 - 11.6) / 2.6) ** 2 <= 1:
                k = 3 if (x + y) % 4 else 4
                if x < 12 and y < 11: k = 4
                cv.px(x, y, PF[clamp(k - 1, 0, 5)])
    for (x, y) in ((10, 11), (19, 10), (23, 12), (14, 12)):
        cv.px(x, y, PF[4]); cv.px(x + 1, y, PF[3]); cv.px(x, y - 1, PF[3])
    for (x, y) in ((16, 6), (18, 4), (15, 2)): cv.px(x, y, PF[2])                   # 김
    for x in (3, 28): cv.px(x, 15, IR[4]); cv.px(x, 16, IR[2])
    return shadow_under(fin(cv, .55), 16, 31, 13, 1.4, 70)


def scroll_heap(seed=0):
    """두루마리 더미 1×1(바닥 장식, 걷기): 엇갈려 쌓인 누런 두루마리 넷과 검붉은 끈."""
    cv = Cv(16, 16)
    for i, (x0, y0, ln) in enumerate(((1, 12, 12), (3, 9, 11), (2, 6, 9), (7, 13, 8))):
        for x in range(x0, x0 + ln):
            cv.px(x, y0, CRM[5] if x < x0 + ln - 2 else CRM[4]); cv.px(x, y0 + 1, CRM[3]); cv.px(x, y0 + 2, CRM[2])
        cv.px(x0 + ln, y0, CRM[4]); cv.px(x0 + ln, y0 + 1, CRM[2]); cv.px(x0 + ln, y0 + 2, CRM[1])
        cv.px(x0 + ln // 2, y0, CRIM[4]); cv.px(x0 + ln // 2, y0 + 1, CRIM[3])
    return fin(cv, .5)


# ------------------------------------------------------------------ 꼭대기 의식실
def magic_circle(seed=0):
    """큰 원형 마법진 7×7(112x112, 바닥 장식, 걷기): 바닥에 새긴 세 겹 고리(검붉은 물이 밴 홈 + 보라로 빛나는 테), 고리 사이 점 무늬,
    안쪽으로 감기는 나선 셋과 가운데 눈 — 글자·별 모양 없음. 빛은 반투명."""
    W, H = 112, 112; im = new(W, H); p = im.load()
    cx = cy = 56
    def put(x, y, c, a=255):
        if 0 <= x < W and 0 <= y < H: p[x, y] = tuple(c) + (a,)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if abs(d - 52) < 1.1: put(x, y, PF[3] if (x + y) % 3 else PF[4], 230)
            elif abs(d - 49.5) < .7: put(x, y, CRIM[2], 255)
            elif abs(d - 40) < .9: put(x, y, PF[2], 220)
            elif abs(d - 37.5) < .6: put(x, y, CRIM[1], 255)
            elif abs(d - 22) < .9: put(x, y, PF[3], 220)
            elif 49.5 < d < 52 and _hash(x, y, 31) < .2: put(x, y, PF[1], 120)
            elif 40 < d < 49 and d > 0:                                            # 고리 사이 점 띠
                a = math.atan2(y + .5 - cy, x + .5 - cx)
                if abs(d - 44.5) < 1.2 and (int((a + math.pi) / (2 * math.pi) * 48) % 2 == 0) and abs(((a + math.pi) / (2 * math.pi) * 48) % 1 - .5) < .3:
                    put(x, y, PF[2], 230)
    for k in range(3):                                                             # 나선 셋
        for t in range(0, 420):
            a = k * 2 * math.pi / 3 + t / 420 * math.pi * 1.6
            r = 37 - t / 420 * 14
            x = int(cx + r * math.cos(a)); y = int(cy + r * math.sin(a))
            put(x, y, CRIM[2]); put(x + 1, y, CRIM[1])
            if t % 30 == 0: put(x, y - 1, PF[3])
    for k in range(6):                                                             # 바깥 고리 위 작은 원 여섯
        a = k * math.pi / 3 + math.pi / 6
        ox = cx + 52 * math.cos(a); oy = cy + 52 * math.sin(a)
        for y in range(int(oy) - 5, int(oy) + 6):
            for x in range(int(ox) - 5, int(ox) + 6):
                dd = math.hypot(x + .5 - ox, y + .5 - oy)
                if dd < 3.8: put(x, y, CRIM[1])
                elif dd < 5: put(x, y, PF[3], 230)
    cv = Cv(W, H)
    eye_emblem(cv, cx, cy - 2, 15, PF[4], CRIM[3], VIO[0])
    im.alpha_composite(cv.im)
    for y in range(cy - 4, cy + 1):
        for x in range(cx - 2, cx + 2): put(x, y, VIO[0])
    put(cx - 2, cy - 4, PF[4])
    return im


def high_altar(seed=0):
    """높은 제단 4×3(64x48): 세 단 돌계단 단(윗면+앞면) 위 검은 돌 제단 — 앞에 드리운 보라 천과 큰 눈 문장, 위에 해골·검은 단검·
    굵은 초 넷과 피 그릇, 단 양 끝 해골 돌. 아래 2줄 막힘(맨 윗줄 걷기+가림)."""
    W, H = 64, 48; cv = Cv(W, H)
    stone_box(cv, 0, 38, 64, 48, 3, CS, seed + 1)
    stone_box(cv, 4, 32, 60, 40, 3, CS, seed + 2)
    stone_box(cv, 8, 26, 56, 34, 3, CS, seed + 3)
    BLKS = [DK, (26, 22, 32), (38, 32, 46), (54, 46, 64), (74, 64, 86), (98, 88, 112), (128, 118, 144)]
    stone_box(cv, 14, 10, 50, 28, 7, BLKS, seed)
    for y in range(10, 27):
        for x in range(22, 42):
            if y > 24 and x % 3 == 1: continue
            k = 4 if (x - 22) % 5 < 2 else 3
            if y < 13: k = 5
            if x in (22, 41): k = 2
            cv.px(x, y, VIO[k])
    for x in range(22, 42): cv.px(x, 13, GLD[4] if x % 2 else GLD[3])
    eye_emblem(cv, 32, 19, 9, BONE[4], CRIM[4], VIO[0])
    skull(cv, 32, 7, 1.0, seed)
    for y in range(7, 11):
        for x in range(17, 22): cv.px(x, y, IR[2] if x < 19 else IR[1])
    for x in range(17, 22): cv.px(x, 7, CRIM[2])
    for i in range(9): cv.px(38 + i, 10 - (i * i) // 22, IR[5])
    cv.px(37, 10, EBW[4]); cv.px(36, 10, EBW[3])
    for (cx_, yb, h) in ((15, 12, 7), (47, 12, 7), (25, 11, 5), (44, 11, 4)): candle(cv, cx_, yb, h, seed=seed + cx_)
    for sx in (2, 56):
        skull(cv, sx + 3, 36, .8, seed + sx)
    return shadow_under(fin(cv, .55), 32, 47, 30, 1.6, 90)


def brazier_big(seed=0):
    """큰 보라 화로 2×2(32x32): 돌 받침 위 넓은 쇠 그릇, 크게 타오르는 보라 불. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    stone_box(cv, 9, 22, 23, 32, 3, CS, seed)
    for y in range(17, 23):
        hw = 13 - (y - 17)
        for x in range(16 - hw, 16 + hw): cv.px(x, y, IR[clamp(cyl_k(x, 16 - hw, 16 + hw) - 1, 1, 5)])
    for x in range(4, 29, 4): cv.px(x, 19, CRIM[3])
    topell(cv, 16, 16.5, 13, 2.6, IR, 5, 3, seed)
    for x in range(5, 28):
        for y in (16, 17):
            if ((x - 16) / 11) ** 2 + ((y + .5 - 16.5) / 1.6) ** 2 <= 1: cv.px(x, y, PF[1] if (x + y) % 3 else PF[3])
    flame(cv, 16, 15, 15, PF, seed + 1, 7)
    flame(cv, 9, 15, 8, PF, seed + 2, 3); flame(cv, 23, 15, 10, PF, seed + 3, 3)
    return shadow_under(fin(cv, .55), 16, 31, 9, 1.4, 70)


def floor_candles(seed=0):
    """바닥 초 무리 1×1(바닥 장식, 걷기): 높이가 다른 검은·흰 초 셋, 녹아 고인 촛농, 보라 불꽃."""
    cv = Cv(16, 16)
    for x in range(2, 14): cv.px(x, 14, CRM[3] if x % 3 else CRM[4])
    for (x, h, wax) in ((3, 6, None), (7, 9, [(32, 28, 40), (64, 56, 72), (46, 40, 54)]), (11, 4, None)):
        candle(cv, x, 13, h, wax, seed=seed + x)
    return fin(cv, .5)


def crimson_window(seed=0):
    """검붉은 둥근 창 3×3(벽 앞면 장식, 48x48): 굵은 돌테 둥근 창, 여섯 갈래 돌살 사이 검붉은·보라 유리, 가운데 눈, 아래 창턱."""
    W, H = 48, 48; cv = Cv(W, H)
    cx, cy = 24, 22
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d > 19: continue
            if d > 15.5:
                c = CS[5] if (x - cx) + (y - cy) < -4 else (CS[4] if (x - cx) + (y - cy) < 8 else CS[3])
                a = math.degrees(math.atan2(y + .5 - cy, x + .5 - cx)) % 30
                if a < 2.2: c = CS[2]
            else:
                a = (math.degrees(math.atan2(y + .5 - cy, x + .5 - cx)) + 360) % 60
                if a < 5 or d > 14.6 or d < 4.5: c = CS[3] if d > 4.5 else CS[4]
                else:
                    seg = int(((math.degrees(math.atan2(y + .5 - cy, x + .5 - cx)) + 360) % 360) // 60)
                    R = CRIM if seg % 2 == 0 else VIO
                    k = 4 if d < 9 else 3
                    if y < cy - 4: k += 1
                    c = R[clamp(k)]
            cv.px(x, y, c)
    for x in range(4, 44): cv.px(x, 42, CS[5] if x < 24 else CS[4]); cv.px(x, 43, CS[3]); cv.px(x, 44, CS[2])
    for y in range(cy - 3, cy + 3):
        for x in range(cx - 3, cx + 3):
            if math.hypot(x + .5 - cx, y + .5 - cy) < 3: cv.px(x, y, PF[3] if x < cx else PF[2])
    cv.px(cx, cy, VIO[0]); cv.px(cx - 1, cy, VIO[0])
    return fin(cv, .55)


# ------------------------------------------------------------------ 나선 계단 (탑 내부 나선 계단의 짜임을 교단 돌로 다시 칠하고 보라 깔개를 깐다)
def _spiral_up(seed=0):
    """3/4 나선 오름 계단(48x64): 둥근 돌 받침단 위 쐐기 단 8개가 서→북→동으로 감아 오르고, 단 가운데 보라 깔개가 이어진다.
    밑은 쌓은 돌 몸통, 가운데 기둥, 마지막 두 단은 위층으로 뚫린 어둠 속으로. 받침단 앞 둘레에 해골 초 둘."""
    W, H = 48, 64; cv = Cv(W, H)
    cx, cy = 24.0, 44.0; R = 21.0; r0 = 4.0; ry = .74
    n = 8; step = 3
    a0 = math.pi / 2 + .5; span = 1.25 * math.pi
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx
            for k in range(0, 5):
                dy = (y - k + .5 - cy) / ry
                if math.hypot(dx, dy) <= R:
                    if k == 0:
                        d = math.hypot(dx, dy)
                        kk = 5 if (dx + dy) < -6 else 4
                        if d > R - 1.3: kk = 6 if dy < 0 else 4
                        if _hash(x, y, seed + 21) < .06: kk -= 1
                        cv.px(x, y, CS[kk])
                    else:
                        cv.px(x, y, (CS[4] if dx < -8 else (CS[3] if dx < 8 else CS[2])) if k < 4 else CS[1])
                    break
    for y in range(0, 26):
        for x in range(22, 46):
            if ((x + .5 - 34) / 12.5) ** 2 + ((y + .5 - 12) / 11.5) ** 2 <= 1:
                cv.px(x, y, dlib.VOID[0] if _hash(x, y, 31) < .8 else dlib.VOID[1])
    def draw_step(i):
        lo = a0 + span * i / n; hi = a0 + span * (i + 1) / n
        z = (i + 1) * step
        top = {}
        for py in range(-int(R) - 2, int(R) + 3):
            for pxx in range(-int(R) - 2, int(R) + 3):
                d = math.hypot(pxx + .5, py + .5)
                if d > R - 2 or d < r0 - .3: continue
                aa = (math.atan2(py + .5, pxx + .5) - lo) % (2 * math.pi)
                if aa > (hi - lo): continue
                sx = int(cx + pxx); sy = int(math.floor(cy + (py + .5) * ry - z))
                f = aa / (hi - lo)
                k = 5 if f > .22 else 4
                if f > .8: k = 6
                if d > R - 3.5: k -= 1
                if _hash(sx + i * 7, sy, seed + 3) < .07: k -= 1
                c = CS[clamp(k)]
                if 9.5 < d < 15.5 and .12 < f < .9: c = VIO[4 if f > .6 else 3]     # 보라 깔개
                if i >= n - 2: c = mix(c, dlib.VOID[1], .35 + (.3 if i == n - 1 else 0))
                top[(sx, sy)] = c
        for (sx, sy), c in list(top.items()):
            for k in range(1, z + 1):
                if (sx, sy + k) in top: break
                rc = mul(mix(C6.ash(sx, sy + k, k=1.0, bw=8, bh=5, seed=seed + 2), CSTONE_TINT, .32), .58)
                if k <= 2: rc = CS[2]
                if k == z: rc = CS[1]
                if i >= n - 2: rc = mix(rc, dlib.VOID[0], .45)
                cv.px(sx, sy + k, rc)
        for (sx, sy), c in top.items(): cv.px(sx, sy, c)
    mid = lambda i: math.sin(a0 + span * (i + .5) / n)
    back = sorted([i for i in range(n) if mid(i) <= 0], key=mid)
    front = sorted([i for i in range(n) if mid(i) > 0], key=mid)
    for i in back: draw_step(i)
    hcol = n * step + 6
    x0c, x1c = int(cx - r0), int(cx + r0) + 1
    for y in range(int(cy - hcol), int(cy + r0 * ry) + 1):
        for x in range(x0c, x1c):
            dx = x + .5 - cx
            if abs(dx) > r0: continue
            if y + .5 > cy + math.sqrt(max(0, 1 - (dx / r0) ** 2)) * r0 * ry: continue
            cv.px(x, y, CS[clamp(cyl_k(x, x0c, x1c))])
    topell(cv, cx, cy - hcol, r0 + .2, 1.8, CS, 6, 4, seed)
    for i in front: draw_step(i)
    for (sx, sy) in ((7, 60), (41, 60)):
        skull(cv, sx, sy - 1, .7, seed + sx)
        for y in range(sy - 7, sy - 4): cv.px(sx, y, CRM[5])
        flame(cv, sx, sy - 8, 2, PF, seed, 1)
    return fin(cv, .5)


def _spiral_down(seed=0):
    """3/4 나선 내림 계단(48x48): 둥근 구멍 둘레 낮은 돌벽, 남쪽 입구에서 가운데 기둥을 돌아 어둠으로 내려가는 쐐기 단, 단 가운데 보라 깔개."""
    W, H = 48, 48; cv = Cv(W, H)
    cx, cy = 24.0, 26.0; R = 20.5; r0 = 4.0; ry = .76
    n = 9; step = 3
    a0 = math.pi / 2 + .42; span = 1.55 * math.pi
    GAP = .42
    for y in range(H):
        for x in range(W):
            if math.hypot(x + .5 - cx, (y + .5 - cy) / ry) < R - 2.4: cv.px(x, y, dlib.VOID[0])
    def draw_step(i):
        lo = a0 + span * i / n; hi = a0 + span * (i + 1) / n
        z = -(i * step) - 1
        top = {}
        for py in range(-int(R) - 2, int(R) + 3):
            for pxx in range(-int(R) - 2, int(R) + 3):
                d = math.hypot(pxx + .5, py + .5)
                if d > R - 2.6 or d < r0 - .3: continue
                aa = (math.atan2(py + .5, pxx + .5) - lo) % (2 * math.pi)
                if aa > (hi - lo): continue
                sx = int(cx + pxx); sy = int(math.floor(cy + (py + .5) * ry - z))
                f = aa / (hi - lo)
                k = 5 if f > .25 else 4
                if f > .8: k = 6
                if d > R - 4: k -= 1
                if _hash(sx + i * 7, sy, seed + 3) < .07: k -= 1
                c = CS[clamp(k)]
                if 9.5 < d < 15 and .12 < f < .9: c = VIO[4 if f > .6 else 3]
                c = mix(c, dlib.VOID[1], min(.8, .02 + i * .085))
                top[(sx, sy)] = c
        for (sx, sy), c in list(top.items()):
            for k in range(1, step + 1):
                if (sx, sy + k) in top: break
                rc = CS[2] if k < step else CS[1]
                cv.px(sx, sy + k, mix(rc, dlib.VOID[0], min(.85, .08 + i * .085)))
        for (sx, sy), c in top.items(): cv.px(sx, sy, c)
    mid = lambda i: math.sin(a0 + span * (i + .5) / n)
    back = sorted([i for i in range(n) if mid(i) <= 0], key=mid)
    front = sorted([i for i in range(n) if mid(i) > 0], key=mid)
    for i in back: draw_step(i)
    x0c, x1c = int(cx - r0), int(cx + r0) + 1
    for y in range(int(cy - 2), int(cy + r0 * ry) + 1):
        for x in range(x0c, x1c):
            dx = x + .5 - cx
            if abs(dx) > r0: continue
            if y + .5 > cy + math.sqrt(max(0, 1 - (dx / r0) ** 2)) * r0 * ry: continue
            cv.px(x, y, mix(CS[clamp(cyl_k(x, x0c, x1c) - 1)], dlib.VOID[1], .35))
    topell(cv, cx, cy - 2, r0 + .2, max(1.6, r0 * ry * .7), CS, 6, 4, seed)
    for i in front: draw_step(i)
    for y in range(H):                                                             # 둘레 낮은 돌벽(앞을 가린다)
        for x in range(W):
            dx = x + .5 - cx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if abs(a - math.pi / 2) < GAP: continue
            if R - 2.6 <= d <= R + .4:
                k = 6 if (dx + dy * 1.3) < -10 else (5 if (dx + dy * 1.3) < 8 else 4)
                if d < R - 1.8: k -= 1
                cv.px(x, y, CS[k])
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy)
            if dy <= 0 or d <= R + .4 or abs(math.atan2((y - 3 + .5 - cy) / ry, dx) - math.pi / 2) < GAP: continue
            for k in range(1, 5):
                d2 = math.hypot(dx, (y - k + .5 - cy) / ry)
                if R - 2.6 <= d2 <= R + .4:
                    cv.px(x, y, (CS[4] if dx < -8 else (CS[3] if dx < 8 else CS[2])) if k < 4 else CS[1]); break
    return fin(cv, .5)

def spiral_up(seed=0): return _spiral_up(seed)
def spiral_down(seed=0): return _spiral_down(seed)


# ------------------------------------------------------------------ 오토타일: 교단 보라 깔개
def carpet_cell(m, N, E, S, W):
    """교단 보라 깔개: 검붉은 테 + 금 점 띠 + 안쪽 짙은 보라 줄, 속은 결 고운 보라 천에 32px 마다 작은 눈 점(칸마다 어긋나 격자로 안 보인다).
    이웃 없는 쪽 끝은 술."""
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            c = VIO[3] if (x * 3 + y) % 5 else mix(VIO[3], VIO[4], .4)
            if (x + y) % 2 == 0 and (x // 2 + y // 2) % 3 == 0: c = mix(VIO[3], VIO[2], .5)
            if m in (5, 7, 13, 15) and (x - 7.5) ** 2 + (y - 7.5) ** 2 < 3 and (m % 3 == 0 or m == 5): c = CRIM[3] if (x, y) != (7, 7) else VIO[0]
            d = 99
            if not W: d = min(d, x)
            if not E: d = min(d, 15 - x)
            if not N: d = min(d, y)
            if not S: d = min(d, 15 - y)
            if d == 0: c = CRIM[1]
            elif d == 1: c = CRIM[4] if (x + y) % 4 else CRIM[3]
            elif d == 2: c = GLD[4] if (x + y) % 3 == 0 else CRIM[2]
            elif d == 3: c = VIO[2]
            p[x, y] = tuple(c) + (255,)
            if not S and y >= 15 and x % 2 == 0: p[x, y] = (0, 0, 0, 0)
            if not N and y == 0 and x % 2 == 1: p[x, y] = (0, 0, 0, 0)
    return im
def carpet_sheet(): return autotile_sheet(carpet_cell)
