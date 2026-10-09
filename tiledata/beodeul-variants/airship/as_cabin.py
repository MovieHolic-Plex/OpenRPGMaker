# 비행선 선실층 조각: 오름 나무 계단·계단 입구(벽)·내림 계단 승강구·이층 침대·선장 침대·해도 탁자·뱃사람 궤·현창·고물 창·
# 벽 등·기구 진열장·선장 책상·통·깔개·벽 해도·지구의·의자. 손 도트, 버들항 나무 WD·마호가니 MAH·놋쇠 BR·캔버스 CNV. 3/4, 빛 왼쪽 위.
from as_kit import *
from as_kit import _hash


def stair_wood_up(seed=0):
    """오름 나무 계단 2×3(32x48, 걷기): 양옆 난간 기둥 사이 놋쇠 코 댄 디딤판 여섯 단이 북쪽 벽 안으로 오른다 — 위로 갈수록 밝고 좁다.
    가운데 2열 걷기(맨 윗줄 = 위층 이동 칸). 바로 위 벽 앞면에 stair_opening 을 붙인다."""
    W, H = 32, 48; cv = Cv(W, H)
    for i in range(6):                                                              # 아래(남)부터 위로
        yb = 47 - i * 8
        for y in range(yb - 7, yb + 1):
            for x in range(4, 28):
                ly = yb - y
                if ly < 3: k = 2 + (1 if i > 2 else 0)                               # 챌판(앞면)
                elif ly == 3: k = None
                else: k = 4 + (1 if i > 1 else 0) + (1 if i > 4 else 0)            # 디딤판
                if k is None: cv.px(x, y, BR[5] if x < 22 else BR[3]); continue
                if x > 24: k -= 1
                if (x - 4 + i * 5) % 12 == 0 and ly > 3: k -= 1
                cv.px(x, y, WD[clamp(k, 1, 6)])
    for x0 in (1, 28):                                                              # 옆판 + 난간
        for y in range(0, 48):
            for x in range(x0, x0 + 3): cv.px(x, y, WD[5] if x == x0 else (WD[3] if x == x0 + 1 else WD[2]))
        for y in (0, 1): cv.px(x0, y, BR[6]); cv.px(x0 + 1, y, BR[4]); cv.px(x0 + 2, y, BR[3])
        for y in (46, 47): cv.px(x0, y, BR[5]); cv.px(x0 + 1, y, BR[4]); cv.px(x0 + 2, y, BR[2])
    return fin(cv, .62)

def stair_opening(seed=0):
    """계단 입구 2×3(32x48, 벽 앞면 장식): 선실 벽을 뚫은 네모 문틀 안으로 계단이 위 갑판 승강구로 이어지고, 맨 위에 하늘빛이 든다."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            if 4 <= x <= 27 and y >= 4:
                d = (47 - y)
                if y < 9: c = SKY7[4] if (x + y) % 3 else SKY7[5]                   # 위 승강구로 든 빛
                else:
                    step = (47 - y) // 6
                    k = 4 - step // 2
                    if (47 - y) % 6 >= 4: k -= 1
                    c = WD[clamp(k, 1, 6)] if k >= 1 else WVOID[1]
                    if k < 1: c = WVOID[0] if (x + y) % 3 else WVOID[2]
                    if y < 14: c = mix(c, SKY7[3], .35)
                cv.px(x, y, c)
            elif x < 4 or x > 27 or y < 4:
                k = 5 if x < 2 or y < 2 else (4 if x < 4 or y < 4 else 3)
                if x > 29: k = 2
                cv.px(x, y, WD[k])
    for x in range(0, 32): cv.px(x, 0, BR[5]); cv.px(x, 1, BR[3])
    return fin(cv, .62)

def hatch_stair_down(seed=0):
    """내림 계단 승강구 2×2(32x32, 걷기): 바닥에 뚫린 놋쇠 테 네모 구멍, 남쪽 문턱에서 북쪽으로 어둠 속 아래층(기관실)으로 내려가는 계단.
    맨 아래 줄 가운데가 층 이동 칸."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(1, 31):
        for x in range(1, 31):
            if 4 <= x <= 27 and 4 <= y <= 27:
                step = (27 - y) // 4
                k = 5 - step
                if (27 - y) % 4 == 3: k -= 1
                c = WD[clamp(k, 1, 6)] if k >= 1 else (WVOID[0] if (x + y) % 3 else WVOID[1])
                if x in (4, 27) and k >= 1: c = WD[clamp(k - 2, 1, 6)]
                cv.px(x, y, c)
            else:
                c = BR[6] if (y == 1 or x == 1) else (BR[4] if (y < 4 or x < 4) else BR[2])
                if y > 27 and x >= 4: c = BR[5] if y == 28 else BR[3]
                cv.px(x, y, c)
    for (x, y) in ((2, 2), (28, 2), (2, 28), (28, 28)): cv.px(x, y, BR[1])
    return fin(cv, .62)

def bunk_bed(seed=0):
    """이층 침대 2×3(32x48): 북쪽 벽에 붙인 나무 틀 이층 침대 — 위 칸 매트·붉은 담요와 앞 판, 아래 칸 크림 담요와 베개, 놋쇠 기둥 머리, 작은 사다리. 아랫줄만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for x0 in (1, 28):
        for y in range(2, 47):
            for x in range(x0, x0 + 3): cv.px(x, y, WD[5] if x == x0 else (WD[4] if x == x0 + 1 else WD[2]))
        cv.px(x0, 1, BR[6]); cv.px(x0 + 1, 1, BR[4]); cv.px(x0 + 2, 1, BR[3])
    def bunk(yt, blanket):
        for y in range(yt, yt + 8):                                                 # 매트 윗면(깊이)
            for x in range(4, 28):
                c = CNV[5] if y < yt + 2 else blanket[4 if y < yt + 5 else 3]
                if x < 10 and y < yt + 5: c = CNV[6] if y < yt + 3 else CNV[5]       # 베개
                if (x + y) % 9 == 0 and y >= yt + 2 and x >= 10: c = blanket[3]
                cv.px(x, y, c)
        for y in range(yt + 8, yt + 13):                                             # 담요 자락 + 앞 판
            for x in range(4, 28):
                c = blanket[3] if y < yt + 10 else (WD[4] if y == yt + 10 else WD[3])
                if y == yt + 12: c = WD[1]
                cv.px(x, y, c)
    bunk(4, RD[1:] + [RD[-1]])
    for y in range(17, 24):                                                         # 위·아래 칸 사이 그늘
        for x in range(4, 28): cv.px(x, y, WVOID[2] if y < 20 else WD[1])
    bunk(24, CNV)
    for y in range(37, 47):
        for x in range(4, 28): cv.px(x, y, WD[3] if y < 45 else WD[2])
    for y in range(4, 24): cv.px(24, y, WD[5]); cv.px(25, y, WD[3])                 # 사다리
    for y in range(6, 24, 4): cv.px(23, y, WD[4]); cv.px(26, y, WD[4])
    return fin(cv, .62)

def bed_captain(seed=0):
    """선장 침대 2×2(32x32): 놋쇠 머리 공을 단 나무 머리판(북), 크림 베개 둘, 슬레이트 보라 누비 담요. 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(0, 9):
        for x in range(1, 31):
            c = WD[5] if y < 2 else (WD[4] if x < 28 else WD[3])
            if y == 8: c = WD[2]
            if 4 <= y <= 6 and 5 <= x <= 26: c = WD[3] if (x // 4) % 2 else WD[4]
            cv.px(x, y, c)
    for x0 in (1, 28):
        cv.px(x0, 0, BR[6]); cv.px(x0 + 1, 0, BR[4]); cv.px(x0, 1, BR[4]); cv.px(x0 + 1, 1, BR[2])
    for y in range(9, 27):
        for x in range(2, 30):
            if y < 14: c = CNV[6] if (x < 15 and y < 12) or (x >= 16 and y < 12 and x < 29) else CNV[4]
            else:
                c = SL[4] if (x + y) % 6 else SL[5]
                if y == 14: c = CNV[5]
                if (x - 2) % 7 == 0 or (y - 14) % 6 == 0: c = SL[3]
                if x > 27: c = SL[3]
            if x in (15,) and y < 14: c = CNV[3]
            cv.px(x, y, c)
    for y in range(27, 31):
        for x in range(1, 31): cv.px(x, y, SL[3] if y == 27 else (WD[4] if y < 30 else WD[2]))
    return shadow_under(fin(cv, .62), 16, 30, 15, 2, 55)

def chart_table(seed=0):
    """해도 탁자 3×2(48x32): 큰 나무 탁자 위 펼친 하늘 해도(구름 섬 윤곽과 항로 점선, 글자 없음), 놋쇠 디바이더·나침반·문진, 앞 판과 다리. 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(2, 21):                                                          # 탁자 윗면
        for x in range(1, 47):
            cv.px(x, y, WD[6] if (y == 2 or x == 1) else (WD[5] if x < 45 else WD[4]))
    for y in range(4, 19):                                                          # 해도
        for x in range(4, 40):
            c = CNV[5]
            n = vnoise(x, y, 6, 851)
            if n > .62: c = (176, 190, 160) if n < .7 else (150, 168, 132)          # 섬(초록 회색)
            elif n > .58: c = (120, 96, 70)                                           # 해안선
            if x in (4, 39) or y in (4, 18): c = CNV[3]
            cv.px(x, y, c)
    for i in range(0, 30, 3):                                                       # 항로 점선
        cv.px(7 + i, int(15 - i * .3), RD[3])
    ring(cv, 32, 9, 4, 3.4, 1.2, lambda x, y, dx, dy: BR[5] if dx + dy < 0 else BR[3])   # 나침반
    cv.px(32, 7, RD[4]); cv.px(32, 8, RD[4]); cv.px(32, 10, CNV[1]); cv.px(31, 9, CNV[1]); cv.px(33, 9, CNV[1])
    line(cv, 12, 6, 16, 12, BR[6]); line(cv, 12, 6, 19, 11, BR[4])                  # 디바이더
    for (x, y) in ((42, 5), (42, 14)):                                              # 문진
        for dy in range(3):
            for dx in range(3): cv.px(x + dx, y + dy, I7[5] if dx + dy == 0 else I7[3])
    for y in range(21, 25):
        for x in range(1, 47): cv.px(x, y, WD[4] if y == 21 else (WD[3] if x < 45 else WD[2]))
    for x0 in (2, 43):
        for y in range(25, 31):
            for x in range(x0, x0 + 3): cv.px(x, y, WD[4] if x == x0 else WD[2])
    return shadow_under(fin(cv, .62), 24, 30, 22, 2, 55)

def sea_chest(seed=0):
    """뱃사람 궤 1×1(16x16): 둥근 뚜껑·쇠띠 두른 나무 궤와 놋쇠 자물쇠. 막힘."""
    cv = Cv(16, 16)
    wbox(cv, 1, 3, 15, 15, 5, WD, seed, boards=3)
    for x in range(1, 15): cv.px(x, 3, WD[6])
    for x0 in (4, 11):
        for y in range(3, 15): cv.px(x0, y, I7[4] if y < 8 else I7[2])
    cv.px(7, 8, BR[6]); cv.px(8, 8, BR[4]); cv.px(7, 9, BR[4]); cv.px(8, 9, BR[2])
    return shadow_under(fin(cv, .62), 8, 15, 7, 1.5, 55)

def porthole(seed=0):
    """현창 1×1(벽 앞면 장식): 볼트 박은 둥근 놋쇠 테 속 구름 낀 하늘 유리."""
    cv = Cv(16, 16)
    ellipse_fill(cv, 8, 8, 6.6, 6.6, lambda x, y, dx, dy, d: (BR[6] if dx + dy < -.4 else (BR[4] if dx + dy < .5 else BR[2])) if d > .5 else
                 (SKY7[6] if (dx < -.2 and dy < -.2) else (SKY7[5] if dy > .25 else SKY7[3])))
    for (x, y) in ((8, 2), (13, 8), (8, 13), (3, 8)): cv.px(x, y, BR[1])
    cv.px(6, 6, (255, 255, 255))
    return fin(cv, .7)

def stern_window(seed=0):
    """고물 창 3×2(48x32, 벽 앞면 장식): 아치 머리 세 칸 유리창 — 놋쇠 창살 너머 하늘과 흰 구름, 아래 창턱."""
    W, H = 48, 32; cv = Cv(W, H)
    for i in range(3):
        x0 = 3 + i * 14; x1 = x0 + 12
        for y in range(2, 26):
            for x in range(x0 - 1, x1 + 1):
                inside = x0 <= x < x1 and y >= 4 and not (y < 9 and math.hypot(x + .5 - (x0 + 6), y + .5 - 9) > 6)
                frame = (x0 - 1 <= x <= x1) and y >= 3 and not (y < 9 and math.hypot(x + .5 - (x0 + 6), y + .5 - 9) > 7.2)
                if inside:
                    t = (y - 4) / 22.0
                    c = SKY7[5] if t < .2 else (SKY7[4] if t < .5 else SKY7[3])
                    if vnoise(x + i * 13, y, 5, 861) > .6 and t > .35: c = SKY7[6]
                    if x == x0 + 6 or y in (14,): c = BR[4] if x < x0 + 6 else BR[3]
                    cv.px(x, y, c)
                elif frame:
                    cv.px(x, y, BR[5] if x < x0 + 3 else (WD[4] if x < x1 - 1 else WD[2]))
    for y in range(26, 31):
        for x in range(0, 48): cv.px(x, y, WD[6] if y == 26 else (WD[5] if y < 28 else (WD[3] if y < 30 else WD[1])))
    return fin(cv, .62)

def wall_lantern(seed=0):
    """벽 등 1×1(벽 앞면 장식): 쇠 갈고리에 건 놋쇠 틀 유리 등."""
    cv = Cv(16, 16)
    cv.px(8, 0, I7[3]); cv.px(8, 1, I7[3]); cv.px(9, 1, I7[2])
    for y in range(2, 15):
        for x in range(4, 12):
            if y < 4: c = BR[5] if x < 8 else BR[3]
            elif y > 12: c = BR[4] if x < 8 else BR[2]
            elif x in (4, 11): c = BR[4] if x < 8 else BR[2]
            else: c = EMB[4] if (x < 8 and y < 9) else EMB[3]
            cv.px(x, y, c)
    return fin(cv, .62)

def instrument_cabinet(seed=0):
    """기구 진열장 2×3(32x48): 갓 판 얹은 키 큰 나무 장 — 유리문 속 선반에 놋쇠 육분의·작은 천구·병·두루마리, 아래 서랍. 아랫줄만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(0, 47):
        for x in range(0, 32):
            if y < 4: c = WD[6] if y == 0 else (WD[5] if y < 3 else WD[2])
            elif x < 3 or x > 28: c = WD[4] if x < 2 else (WD[3] if x < 30 else WD[2])
            elif y >= 38: c = WD[3] if y < 46 else WD[1]
            else: c = WVOID[2]
            cv.px(x, y, c)
    for ys in (16, 27):
        for x in range(3, 29): cv.px(x, ys, WD[5]); cv.px(x, ys + 1, WD[2])
    # 선반 위 물건
    ring(cv, 10, 11, 4.5, 4.5, 1.2, lambda x, y, dx, dy: BR[5] if dx + dy < 0 else BR[3])   # 육분의 호
    line(cv, 10, 11, 10, 15, BR[4]); line(cv, 6, 15, 14, 15, BR[3])
    ellipse_fill(cv, 22, 12, 3.5, 3.5, lambda x, y, dx, dy, d: (60, 110, 160) if vnoise(x, y, 2, 871) < .55 else (120, 150, 90))
    cv.px(21, 10, (200, 220, 240))
    for (x, col) in ((6, (70, 120, 80)), (10, (120, 60, 50)), (14, (80, 90, 140))):  # 병
        for y in range(20, 27): cv.px(x, y, col); cv.px(x + 1, y, mul(col, .7))
        cv.px(x, 19, CNV[4])
    for y in range(22, 27):
        for x in range(18, 27): cv.px(x, y, CNV[5] if (y - 22) % 2 == 0 else CNV[3])
    for y in range(29, 37):                                                         # 아래 칸 책
        x = 4
        while x < 28:
            col = [RD[3], SL[4], WD[5], (70, 110, 80)][int(_hash(x, 0, 873) * 4)]
            for yy in range(29 + int(_hash(x, 1, 874) * 3), 37): cv.px(x, yy, col); cv.px(x + 1, yy, mul(col, .7))
            x += 3
    for y in range(4, 38):                                                          # 유리문 반짝임 + 가운데 문틀
        if y % 9 == 2: cv.px(5 + (y % 4), y, SKY7[6])
        cv.px(15, y, WD[4]); cv.px(16, y, WD[2])
    for x in range(3, 29):
        if x not in (15, 16): cv.px(x, 42, WD[1] if x in (9, 22) else WD[3])
    cv.px(9, 41, BR[6]); cv.px(22, 41, BR[6])
    return fin(cv, .62)

def captain_desk(seed=0):
    """선장 책상 2×2(32x32): 항해 일지 펼친 서랍 책상 — 잉크병과 깃펜, 초록 갓 놋쇠 등, 앞 판 놋쇠 손잡이. 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 18):
        for x in range(0, 32): cv.px(x, y, MAH[6] if (y == 4 or x == 0) else (MAH[5] if x < 30 else MAH[4]))
    for y in range(7, 15):                                                          # 일지
        for x in range(4, 18):
            c = CNV[6] if x < 11 else CNV[5]
            if x in (10, 11): c = CNV[3]
            if y % 2 == 0 and 5 < x < 16 and x not in (10, 11): c = CNV[3]
            cv.px(x, y, c)
    cv.px(20, 11, SL[2]); cv.px(21, 11, SL[2]); cv.px(20, 10, SL[4]); line(cv, 21, 9, 24, 5, CNV[6])
    for y in range(0, 12):                                                          # 놋쇠 등
        if y < 5:
            for x in range(23, 31): cv.px(x, y, LF[3] if y > 0 else LF[4]) if abs(x - 27) <= 1 + y else None
        else:
            cv.px(27, y, BR[5]); cv.px(28, y, BR[3])
    for x in range(25, 31): cv.px(x, 12, BR[4]); cv.px(x, 13, BR[2])
    for y in range(18, 31):
        for x in range(0, 32):
            c = MAH[4] if x < 2 else (MAH[3] if x < 30 else MAH[2])
            if y == 18: c = MAH[5]
            if y == 30: c = MAH[1]
            if x in (15, 16) or y == 24: c = MAH[2]
            cv.px(x, y, c)
    for (x, y) in ((7, 21), (24, 21), (7, 27), (24, 27)): cv.px(x, y, BR[6]); cv.px(x + 1, y, BR[4])
    return shadow_under(fin(cv, .62), 16, 30, 15, 2, 55)

def barrel_single(seed=0):
    """나무 통 1×1(16x16): 쇠테 둘 두른 세운 통. 막힘."""
    cv = Cv(16, 16)
    barrel(cv, 2, 0, 12, 16, seed)
    return shadow_under(fin(cv, .62), 8, 15, 7, 1.5, 55)

def rug_cabin(seed=0):
    """선실 깔개 3×2(48x32, 걷기): 금빛 테 두른 짙은 붉은 직물 깔개 — 가운데 마름모 무늬, 양 끝 술."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(2, 30):
        for x in range(3, 45):
            c = RD[2] if (x + y) % 2 else mix(RD[2], RD[1], .4)
            dd = abs(x - 23.5) / 18.0 + abs(y - 15.5) / 10.0
            if dd < .5: c = GLD[4] if dd < .2 else RD[4]
            elif .62 < dd < .72: c = GLD[3]
            if x in (5, 42) or y in (4, 27): c = GLD[5]
            if x in (6, 41) or y in (5, 26): c = RD[1]
            cv.px(x, y, c)
        if y % 2 == 0: cv.px(1, y, CNV[5]); cv.px(2, y, CNV[4]); cv.px(46, y, CNV[4]); cv.px(45, y, CNV[5])
    return cv.im

def wall_chart(seed=0):
    """벽 해도 2×1(벽 앞면 장식): 네 모서리를 못 박은 하늘 해도(구름 섬과 항로 점선, 글자 없음)."""
    W, H = 32, 16; cv = Cv(W, H)
    for y in range(1, 15):
        for x in range(2, 30):
            n = vnoise(x, y, 5, 881)
            c = CNV[5] if n < .58 else ((170, 184, 150) if n > .63 else (120, 96, 70))
            if y in (1, 14) or x in (2, 29): c = CNV[3]
            cv.px(x, y, c)
    for i in range(0, 22, 3): cv.px(5 + i, int(10 - i * .25), RD[3])
    for (x, y) in ((3, 2), (28, 2), (3, 13), (28, 13)): cv.px(x, y, BR[5])
    return fin(cv, .7)

def globe_stand(seed=0):
    """지구의 1×2(16x32): 나무 세 다리 받침 위 놋쇠 자오환 속 푸른 바다·녹갈색 땅의 둥근 지구의. 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    def gl(x, y, dx, dy, d):
        land = vnoise(x * 1.3, y * 1.3, 3, 891) > .56
        c = ((112, 140, 80) if land else (54, 104, 158))
        if dx + dy < -.6: c = mix(c, (255, 255, 255), .3)
        elif dx + dy > .6: c = mul(c, .7)
        return c
    ellipse_fill(cv, 8, 10, 6, 6, gl)
    ring(cv, 8, 10, 7.4, 7.4, 1.3, lambda x, y, dx, dy: BR[5] if dx < 0 else BR[3])
    for y in range(18, 23): cv.px(8, y, WD[4]); cv.px(9, y, WD[2])
    line(cv, 8, 22, 2, 30, WD[4]); line(cv, 8, 22, 14, 30, WD[3]); line(cv, 8, 22, 8, 31, WD[5])
    return fin(cv, .62)

def chair_cabin(seed=0):
    """선실 의자 1×1(16x16): 붉은 방석 깐 나무 의자와 놋쇠 징 박은 등받이(북). 막힘."""
    cv = Cv(16, 16)
    for y in range(0, 7):
        for x in range(3, 13): cv.px(x, y, MAH[5] if y < 2 else (MAH[4] if x < 11 else MAH[3]))
    for x in (5, 8, 11): cv.px(x, 3, BR[6])
    for y in range(7, 11):
        for x in range(2, 14): cv.px(x, y, RD[4] if y < 9 else RD[2])
    for x0 in (3, 11):
        for y in range(11, 16): cv.px(x0, y, MAH[4]); cv.px(x0 + 1, y, MAH[2])
    return fin(cv, .62)

def galley_stove(seed=0):
    """주방 쇠 화덕 2×3(32x48): 벽에 붙인 검은 쇠 화덕 — 윗면 화구 둘에 구리 냄비와 주전자, 앞면 불 문(빨간 불빛)과 오븐 문,
    벽을 타고 오르는 연통. 아랫줄만 막힘(위는 벽 앞면에 겹친다)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(0, 22):                                                          # 연통
        for x in range(22, 27): cv.px(x, y, I7[clamp(cyl_k(x, 22, 27), 1, 6)])
        if y in (6, 14): [cv.px(x, y, BR[4]) for x in range(22, 27)]
    for y in range(20, 30):                                                         # 윗면
        for x in range(1, 31): cv.px(x, y, I7[5] if (y == 20 or x == 1) else (I7[4] if x < 29 else I7[3]))
    for (cx_, cy_) in ((8, 25), (20, 25)):
        ring(cv, cx_, cy_, 4.5, 2.4, 1.2, lambda x, y, dx, dy: I7[2])
    for y in range(16, 26):                                                         # 구리 냄비
        for x in range(4, 13):
            if y < 18: c = mix(RD[2], BR[4], .5) if x < 10 else mix(RD[1], BR[2], .5)
            else: c = mix(RD[3], BR[4], .55) if x < 7 else (mix(RD[2], BR[3], .5) if x < 11 else mix(RD[1], BR[2], .5))
            cv.px(x, y, c)
    for x in range(3, 14): cv.px(x, 16, mix(RD[4], BR[5], .5))
    ellipse_fill(cv, 20, 21, 4, 3.5, lambda x, y, dx, dy, d: I7[5] if dx + dy < -.3 else (I7[3] if d < .8 else I7[2]))   # 주전자
    line(cv, 24, 20, 27, 17, I7[3]); cv.px(20, 17, I7[4])
    for y in range(30, 47):                                                         # 앞면
        for x in range(1, 31):
            c = I7[3] if x < 3 else (I7[2] if x < 29 else I7[1])
            if y == 30: c = I7[4]
            if y == 46: c = I7[0]
            cv.px(x, y, c)
    for y in range(33, 41):                                                         # 불 문
        for x in range(4, 14):
            c = I7[4] if (x == 4 or y == 33) else (EMB[3] if (x + y) % 3 else EMB[4])
            if x == 13 or y == 40: c = I7[2]
            if 4 < x < 13 and 33 < y < 40 and (x - 5) % 3 == 2: c = I7[1]
            cv.px(x, y, c)
    for y in range(33, 44):                                                         # 오븐 문
        for x in range(17, 28): cv.px(x, y, I7[4] if (x == 17 or y == 33) else (I7[2] if (x == 27 or y == 43) else I7[3]))
    for x in range(19, 26): cv.px(x, 35, BR[5])
    return fin(cv, .6)

def mess_table(seed=0):
    """식당 긴 탁자 3×2(48x32): 널 탁자 위 빵·주석 잔·그릇·촛불, 앞(남)에 긴 걸상. 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(2, 16):
        for x in range(1, 47): cv.px(x, y, WD[6] if (y == 2 or x == 1) else (WD[5] if x < 45 else WD[4]))
        if (y - 2) % 5 == 4: [cv.px(x, y, WD[4]) for x in range(2, 45)]
    for (x, y) in ((6, 5), (18, 9), (30, 5), (40, 10)):                              # 주석 잔
        for dy in range(3):
            cv.px(x, y + dy, I7[5] if dy == 0 else I7[4]); cv.px(x + 1, y + dy, I7[3])
    ellipse_fill(cv, 12, 9, 3, 1.8, lambda x, y, dx, dy, d: CNV[5] if d < .5 else CNV[3])   # 그릇
    ellipse_fill(cv, 24, 6, 4, 2, lambda x, y, dx, dy, d: GD[4] if dx < 0 else GD[3])        # 빵
    cv.px(35, 6, CNV[6]); cv.px(35, 7, CNV[5]); cv.px(35, 5, EMB[4]); cv.px(35, 4, EMB[5])     # 촛불
    for y in range(16, 20):
        for x in range(1, 47): cv.px(x, y, WD[4] if y == 16 else (WD[3] if x < 45 else WD[2]))
    for x0 in (3, 43):
        for y in range(20, 24):
            for x in range(x0, x0 + 2): cv.px(x, y, WD[3] if x == x0 else WD[1])
    for y in range(24, 31):                                                         # 걸상
        for x in range(2, 46):
            c = WD[5] if y < 26 else (WD[3] if y < 28 else WD[2])
            if y >= 28 and x not in (4, 5, 42, 43): continue
            cv.px(x, y, c)
    return shadow_under(fin(cv, .62), 24, 30, 22, 2, 55)

def pot_shelf(seed=0):
    """냄비 걸이 2×1(벽 앞면 장식): 널 선반에 얹은 병·자루, 아래 갈고리에 건 구리 냄비 둘과 국자."""
    W, H = 32, 16; cv = Cv(W, H)
    for x in range(1, 31): cv.px(x, 5, WD[5]); cv.px(x, 6, WD[3]); cv.px(x, 7, WD[1])
    for (x, col) in ((4, (80, 120, 80)), (8, (130, 70, 50)), (22, (90, 90, 140))):
        for y in range(1, 5): cv.px(x, y, col); cv.px(x + 1, y, mul(col, .7))
    for y in range(1, 5):
        for x in range(12, 18): cv.px(x, y, CNV[4] if x < 15 else CNV[3])
    for (cx_, r) in ((8, 3.5), (20, 3)):
        cv.px(cx_, 8, I7[3])
        ellipse_fill(cv, cx_, 12, r, r * .9, lambda x, y, dx, dy, d: mix(RD[3], BR[4], .55) if dx + dy < 0 else mix(RD[1], BR[2], .5))
    line(cv, 27, 8, 27, 13, I7[4]); cv.px(26, 14, I7[4]); cv.px(27, 14, I7[3]); cv.px(28, 14, I7[2])
    return fin(cv, .62)
