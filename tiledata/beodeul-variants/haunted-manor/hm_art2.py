# 폐가 저택 조각 2: 거미줄 서재(먼지 책장·쓰러진 책장·흩어진 책·거미줄 책상·해진 날개 의자·지구본·벽 거미줄·늘어진 거미줄)와
# 응접실(흔들의자·깨진 벽 거울·거울 조각·먼지 덮개 소파·덮개 의자·업라이트 피아노·작은 탁자·해진 둥근 깔개·빈 새장·낡은 궤).
# 손 도트, 3/4 시점, 빛 왼쪽 위. 사람·글자 없음.
from hm_kit import *
from hm_kit import _hash

SPN = [CR[3], (58, 70, 86), MO[4], BRS[3], GW[4], (84, 64, 86), LN[4], CR[2], (70, 84, 76), GW[3]]   # 바랜 책등


def _books(cv, x0, x1, ybot, h, seed, gaps=.12):
    x = x0; i = 0
    while x < x1:
        r = _hash(i, ybot, seed)
        w = 2 if r < .6 else 3
        if r > 1 - gaps and x + 3 < x1:                                         # 빈틈(가끔 누운 책)
            if _hash(i, 1, seed) < .5:
                for xx in range(x, min(x1, x + 4)): cv.px(xx, ybot - 1, SPN[i % len(SPN)]); cv.px(xx, ybot - 2, mul(SPN[i % len(SPN)], .7))
            x += 4; i += 1; continue
        hh = h - int(_hash(i, ybot, seed + 1) * 3)
        col = SPN[int(_hash(i, ybot, seed + 2) * len(SPN))]
        for xx in range(x, min(x1, x + w)):
            for y in range(ybot - hh, ybot):
                c = col
                if xx == x + w - 1: c = mul(col, .7)
                if y == ybot - hh: c = mix(col, DU[5], .45)                     # 먼지 앉은 머리
                cv.px(xx, y, c)
        x += w; i += 1


def bookcase_dusty(seed=0):
    """먼지 책장 2×3(32x48): 벽에 붙인 검은 참나무 키 큰 책장 — 먼지 앉은 갓판, 바랜 책등 선반 4단(빈틈·누운 책),
    위 구석 거미줄. 아랫줄 2칸만 막힘(위 2줄 걷기+가림)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(0, 4):
        for x in range(0, 32): cv.px(x, y, GW[5] if y == 0 or x == 0 else (GW[4] if x < 30 else GW[3]))
    for y in range(4, 47):
        for x in range(0, 32):
            if x < 2 or x >= 30: cv.px(x, y, GW[4] if x == 0 else (GW[3] if x < 2 else GW[2]))
    for (ya, yb) in ((5, 14), (15, 24), (25, 34), (35, 41)):
        for y in range(ya, yb):
            for x in range(2, 30): cv.px(x, y, OUTL if y < ya + 2 else GW[1])
        _books(cv, 3, 29, yb, yb - ya - 1, seed + ya)
        for x in range(2, 30): cv.px(x, yb, GW[4] if x < 28 else GW[3])
    for y in range(42, 47):
        for x in range(2, 30): cv.px(x, y, GW[1] if y == 46 or x in (15, 16) else (GW[3] if x < 28 else GW[2]))
    cv.px(8, 44, BRS[4]); cv.px(23, 44, BRS[4])
    dust_top(cv, 0, 0, 32, 4, seed + 1, .45)
    web_corner(cv, 29, 5, 8, flip=True, seed=seed + 2)
    return fin(cv, .55)


def bookcase_toppled(seed=0):
    """쓰러진 책장 3×2(48x32): 등을 바닥에 대고 넘어져 선반 칸이 위를 향한 책장 — 칸막이 넷 사이로 책 머리가 줄지어 보이고
    몇 칸은 쏟아져 비었다, 둘레에 흩어진 책과 종이. 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    x0, x1, y0, y1 = 3, 45, 5, 22
    for y in range(y0, y1 + 4):
        for x in range(x0, x1):
            if y >= y1: cv.px(x, y, GW[2] if y < y1 + 3 else GW[1]); continue   # 옆판 두께(앞)
            edge = x < x0 + 2 or x >= x1 - 2 or y < y0 + 2 or y >= y1 - 2
            lx = (x - x0 - 2) % 10
            if edge: c = GW[5] if (y < y0 + 1 or x < x0 + 1) else GW[3]
            elif lx in (9, 0): c = GW[4] if lx == 0 else GW[2]                 # 선반(칸막이, 윗모)
            else: c = OUTL
            cv.px(x, y, c)
    for k in range(4):                                                          # 칸마다 위를 향한 책 머리
        xa = x0 + 3 + k * 10
        if _hash(k, 0, seed + 14) < .3: continue
        for i in range(8):
            col = SPN[int(_hash(k, i, seed + 15) * len(SPN))]
            yb = y0 + 2 + int(_hash(k, i, seed + 16) * 3)
            for y in range(yb, y1 - 2):
                cv.px(xa + i, y, mix(col, DU[4], .35) if y == yb else (col if i % 2 == 0 else mul(col, .75)))
    for i in range(12):                                                         # 쏟아진 책
        x = int(1 + _hash(i, 0, seed + 11) * 42); y = int(25 + _hash(i, 1, seed + 12) * 5)
        col = SPN[i % len(SPN)]
        for xx in range(x, x + 4):
            for yy in range(y, y + 2): cv.px(xx, yy, col if yy == y else mul(col, .7))
    for (x, y) in ((6, 30), (7, 30), (8, 31), (30, 29), (31, 29), (40, 31), (41, 30)): cv.px(x, y, LN[5])   # 종이
    return shadow_under(fin(cv, .58), 24, 30, 22, 2.0, 70)

def book_spill(seed=0):
    """흩어진 책 1×1(바닥 장식): 펼쳐진 채 엎어진 책 둘·누운 책·흩날린 종이 몇 장."""
    cv = Cv(16, 16)
    for (x0, y0, col) in ((2, 8, CR[3]), (8, 4, (58, 70, 86))):
        for y in range(y0, y0 + 4):
            for x in range(x0, x0 + 6): cv.px(x, y, col if y < y0 + 3 else mul(col, .6))
        cv.px(x0 + 3, y0, mul(col, .6)); cv.px(x0 + 3, y0 + 1, mul(col, .6))
    for y in range(11, 14):
        for x in range(9, 14): cv.px(x, y, LN[5] if y == 11 else LN[4])
    for (x, y) in ((3, 3), (4, 3), (4, 4), (12, 9), (13, 9), (1, 14), (2, 14)): cv.px(x, y, LN[5])
    return fin(cv, .7)


def desk_cobweb(seed=0):
    """거미줄 책상 2×2(32x32): 서랍 책상 위 펼친 채 바랜 책·엎어진 잉크병·꺼진 촛대, 의자 등받이까지 거미줄이 늘어졌다. 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 22):
        for x in range(1, 31):
            if y < 13:
                c = GW[5] if (y == 4 or x == 1) else GW[4]
                if (y - 4) % 3 == 2: c = GW[3] if x < 30 else GW[2]
                if x >= 29: c = GW[3]
            else:
                c = GW[3] if x < 28 else GW[2]
                if y == 13: c = GW[2]
                if 15 <= y <= 18 and x in (6, 7, 8, 9, 22, 23, 24, 25): c = GW[4] if y == 15 else GW[2]
                if y == 21: c = GW[1]
            cv.px(x, y, c)
    for (x0, y0) in ((2, 22), (28, 22)):
        for y in range(y0, y0 + 8): cv.px(x0, y, GW[3]); cv.px(x0 + 1, y, GW[2])
    for y in range(5, 11):                                                      # 펼친 책
        for x in range(9, 22):
            c = LN[5] if x < 15 else LN[4]
            if x in (15, 16): c = LN[2]
            if y == 10: c = GW[2]
            if y in (6, 8) and x % 2 == 1 and x not in (15,) and 10 < x < 21: c = LN[2]
            cv.px(x, y, c)
    for (x, y) in ((24, 7), (25, 7), (24, 8), (25, 8), (26, 8)): cv.px(x, y, OUTL)   # 엎어진 잉크병 + 얼룩
    for (x, y) in ((27, 9), (28, 9), (27, 10), (26, 10), (28, 10)): cv.px(x, y, (30, 30, 46))
    candle(cv, 4, 3, 5, lit=False)
    for x in range(2, 8): cv.px(x, 8, BRS[4] if x < 5 else BRS[2])
    dust_top(cv, 1, 4, 31, 13, seed + 21, .3)
    web_corner(cv, 30, 4, 9, flip=True, seed=seed + 22)
    for y in range(22, 31):                                                     # 의자 등받이
        for x in range(12, 20):
            c = GW[4] if x < 14 else GW[3]
            if y == 22: c = GW[5]
            if y >= 28 and 13 < x < 18: continue
            cv.px(x, y, c)
    for i in range(7): cv.px(14 + i, 19 + (i % 3), WEB[1])                    # 책상 → 의자 거미줄
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def armchair_torn(seed=0):
    """해진 날개 의자 1×2(16x32): 날개 달린 높은 등받이 검붉은 안락의자, 찢어진 자리로 삐져나온 회색 솜, 먼지 앉은 팔걸이. 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(6, 26):                                                      # 등받이 + 날개
        for x in range(1, 15):
            if y < 9 and (x < 3 or x > 12): continue
            c = CR[3] if (x + y // 3) % 5 else CR[2]
            if x < 3: c = CR[4]
            if x > 12: c = CR[2]
            if y == 6 or (y < 9 and x == 3): c = CR[5]
            cv.px(x, y, c)
    for y in range(18, 25):                                                     # 앉는 판
        for x in range(3, 13): cv.px(x, y, CR[4] if y == 18 else CR[3])
    for (x0, x1) in ((0, 3), (13, 16)):                                         # 팔걸이(위 밝음)
        for y in range(15, 27):
            for x in range(x0, x1): cv.px(x, y, CR[4] if y == 15 else (CR[3] if x0 == 0 else CR[1]))
    for (x, y) in ((8, 10), (9, 10), (9, 11), (10, 11), (8, 12), (9, 12), (10, 12), (11, 13)): cv.px(x, y, LN[4] if (x + y) % 2 else LN[3])   # 솜
    for y in range(25, 28):
        for x in range(1, 15): cv.px(x, y, GW[3] if x < 14 else GW[2])
    for x in (2, 13):
        for y in range(28, 31): cv.px(x, y, GW[3])
    dust_top(cv, 0, 6, 16, 19, seed + 31, .2)
    return shadow_under(fin(cv, .58), 8, 31, 7, 1.2, 70)


def globe_stand(seed=0):
    """지구본 1×2(16x32): 검은 참나무 세 다리 받침과 놋쇠 자오환에 끼운 바랜 지구본(이름 없는 대륙 무늬, 먼지). 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    cx, cy, r = 8, 11, 6
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, (y + .5 - cy))
            if d > r: continue
            land = vnoise(x * 1.6, y * 1.6, 3, seed + 41) > .55
            c = (LN[3] if land else (70, 88, 100))
            if x < cx - 2 and y < cy - 1: c = mix(c, LN[6], .35)
            if x > cx + 2 or y > cy + 3: c = mul(c, .72)
            cv.px(x, y, c)
    for i in range(30):                                                         # 자오환
        a = -2.4 + i / 29.0 * 4.0
        x = int(cx + math.cos(a) * (r + 1)); y = int(cy + math.sin(a) * (r + 1))
        cv.px(x, y, BRS[4] if y < cy else BRS[2])
    for y in range(18, 27): cv.px(7, y, GW[4]); cv.px(8, y, GW[2])
    for y in range(17, 19):
        for x in range(5, 11): cv.px(x, y, GW[4])
    for (x, y) in ((4, 27), (5, 27), (11, 27), (10, 27), (3, 28), (12, 28), (7, 27), (8, 27), (7, 28)): cv.px(x, y, GW[3])
    dust_top(cv, 0, 4, 16, 10, seed + 42, .35)
    return shadow_under(fin(cv, .6), 8, 29, 5, 1.0, 60)


def cobweb_wall(seed=0):
    """벽 구석 큰 거미줄 2×2(32x32, 벽 앞면 장식): 천장 돌림띠 왼쪽 위 구석에서 뻗은 살과 동심 실, 가운데 작은 거미(검은 점)."""
    cv = Cv(32, 32)
    web_corner(cv, 0, 0, 28, seed=seed + 51)
    cv.px(10, 9, OUTL); cv.px(11, 9, OUTL); cv.px(10, 10, OUTL); cv.px(9, 10, OUTL); cv.px(12, 10, OUTL)
    im = cv.im
    return im if seed % 2 == 0 else im.transpose(Image.FLIP_LEFT_RIGHT)


def cobweb_hanging(seed=0):
    """늘어진 거미줄 1×2(16x32, 벽 앞면·위층 장식): 천장에서 끊어져 늘어진 실 다발과 먼지 뭉치."""
    cv = Cv(16, 32)
    for i in range(6):
        x = 2 + i * 2 + int(_hash(i, 0, seed + 61) * 2); L = 10 + int(_hash(i, 1, seed + 62) * 18)
        for y in range(0, L):
            xx = x + int(round(math.sin(y * .25 + i) * .8))
            if _hash(i, y, seed + 63) < .85: cv.px(xx, y, WEB[1] if y < L - 3 else WEB[0])
        cv.px(x, L, DU[4]); cv.px(x + 1, L, DU[3])
    for y in range(4, 8): cv.px(4 + y, y, WEB[2])
    return cv.im


def rocking_chair(seed=0):
    """흔들의자 1×2(16x32): 살 등받이·앉는 판·아래 휘어진 흔들 굽(옆으로 뻗음)의 검은 참나무 흔들의자, 걸쳐진 바랜 숄. 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(3, 20):                                                      # 등받이 기둥 + 살
        cv.px(3, y, GW[4]); cv.px(12, y, GW[2])
        if y in (3, 4):
            for x in range(3, 13): cv.px(x, y, GW[5] if y == 3 else GW[3])
        elif y > 5:
            for x in (5, 7, 9, 11): cv.px(x, y, GW[3] if x < 9 else GW[2])
    cv.px(3, 2, GW[5]); cv.px(12, 2, GW[3])
    for y in range(8, 16):                                                      # 숄(삼각으로 걸침)
        for x in range(4, 12 - (y - 8) // 2):
            c = LN[3] if (x + y) % 3 else LN[2]
            if y == 8: c = LN[4]
            cv.px(x, y, mix(c, CR[2], .35))
    for y in range(19, 23):                                                     # 앉는 판
        for x in range(2, 14): cv.px(x, y, GW[5] if y == 19 or x == 2 else (GW[4] if x < 13 else GW[3]))
    for x in (3, 12):
        for y in range(23, 27): cv.px(x, y, GW[3] if x == 3 else GW[2])
    for x in range(0, 16):                                                      # 흔들 굽(휜 받침)
        y = 27 + int(round(((x - 7.5) / 7.5) ** 2 * -2 + 2))
        cv.px(x, y, GW[4]); cv.px(x, y + 1, GW[2])
    return shadow_under(fin(cv, .58), 8, 30, 7, 1.2, 70)


def mirror_broken(seed=0):
    """깨진 벽 거울 2×2(32x32, 벽 앞면 장식): 둥근 머리 도금 테 속 어두운 거울, 가운데에서 거미줄처럼 퍼진 금과 빠진 조각(뒤판 보임)."""
    W, H = 32, 32; cv = Cv(W, H)
    x0, x1, y0, y1 = 4, 28, 2, 30
    for y in range(y0, y1):
        for x in range(x0, x1):
            ay = y0 + int(6 * (1 - math.sqrt(max(0.0, 1 - ((x + .5 - 16) / 12.0) ** 2))))
            if y < ay: continue
            d = min(x - x0, x1 - 1 - x, y - ay, y1 - 1 - y)
            if d < 3:
                k = 5 if (x - x0 == d or y - ay == d) else 2
                if d == 1: k = 4 if k == 5 else 3
                cv.px(x, y, BRS[k]); continue
            c = GLS[2] if (x + y) % 9 else GLS[3]
            if x < 12 and y < 14: c = GLS[3]
            cv.px(x, y, c)
    cx, cy = 17, 16
    for i in range(7):                                                          # 방사 금
        a = i / 7.0 * 6.283 + .4
        for t in range(1, 12):
            x = int(round(cx + math.cos(a) * t)); y = int(round(cy + math.sin(a) * t * 1.1))
            if 6 < x < 26 and 5 < y < 28: cv.px(x, y, GLS[5] if t % 3 else GLS[4])
    for (rr) in (3, 6):
        for i in range(int(rr * 5)):
            a = i / (rr * 5.0) * 6.283
            x = int(round(cx + math.cos(a) * rr)); y = int(round(cy + math.sin(a) * rr * 1.1))
            if _hash(i, rr, seed + 71) < .6: cv.px(x, y, GLS[4])
    for y in range(18, 25):                                                     # 빠진 조각(뒤판)
        for x in range(19, 25 - (y - 18) // 2): cv.px(x, y, GW[1])
    cv.px(cx, cy, GLS[6])
    return fin(cv, .6)


def mirror_shards(seed=0):
    """거울 조각 1×1(바닥 장식): 바닥에 흩어진 날카로운 유리 조각(밤빛 반사)과 반짝임."""
    cv = Cv(16, 16)
    for i in range(6):
        x = int(2 + _hash(i, 0, seed + 81) * 11); y = int(4 + _hash(i, 1, seed + 82) * 9)
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (2, 0) if i % 2 else (1, 1)): cv.px(x + dx, y + dy, GLS[4] if dx == 0 else GLS[3])
        cv.px(x, y, GLS[6] if i % 3 == 0 else GLS[5])
    return fin(cv, .75)


def sofa_sheeted(seed=0):
    """먼지 덮개 소파 3×2(48x32): 큰 리넨 덮개를 씌워 형체만 남은 소파 — 등받이·팔걸이 둔덕, 늘어진 주름, 바닥에 끌린 밑단,
    위에 쌓인 먼지. 아랫줄 막힘(위 줄은 걷기+가림)."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            # 형체: 등받이(위, y 4~), 팔걸이 둔덕 둘, 앉는 판, 밑단
            top = 6 + (0 if 8 < x < 40 else -2) + int(1.5 * math.sin(x * .3))
            if x < 8: top = 12 - int(3 * math.sin((x + 1) * .35))
            if x > 39: top = 12 - int(3 * math.sin((48 - x) * .35))
            bot = 30 - (1 if (x // 4) % 2 else 0)
            if y < top or y > bot or x < 1 or x > 46: continue
            f = (x // 3 + (1 if y > 20 else 0)) % 4
            c = LN[4] if f == 0 else (LN[3] if f in (1, 2) else LN[2])
            if y < top + 2: c = LN[5]
            if 17 <= y <= 19 and 8 < x < 40: c = LN[2] if y == 19 else LN[3]   # 앉는 자리 주름
            if x > 42: c = mul(c, .8)
            cv.px(x, y, c)
    dust_top(cv, 0, 0, 48, 16, seed + 91, .3)
    return shadow_under(fin(cv, .6), 24, 31, 22, 1.6, 70)


def chair_sheeted(seed=0):
    """덮개 의자 1×2(16x32): 리넨 덮개를 씌운 높은 의자 — 서 있는 사람처럼 보이는 섬뜩한 형체(얼굴 없음), 아래로 늘어진 주름. 아랫줄 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            hw = 3.5 if y < 10 else (4.5 + (y - 10) * .16)
            if y < 4: hw = 2.5 + y * .3
            if y < 2 or abs(x + .5 - 8) > hw or y > 30 - (x % 3 == 0): continue
            f = (x + y // 6) % 3
            c = LN[4] if f == 0 else (LN[3] if f == 1 else LN[2])
            if x < 6: c = LN[5] if y < 12 else LN[4]
            if x > 11: c = LN[2]
            if y in (10, 11) and 4 < x < 12: c = LN[2]                          # 앉는 판 턱
            cv.px(x, y, c)
    dust_top(cv, 0, 0, 16, 10, seed + 95, .3)
    return shadow_under(fin(cv, .6), 8, 31, 6, 1.2, 70)


def piano_upright(seed=0):
    """업라이트 피아노 2×2(32x32): 검은 참나무 몸통, 열린 뚜껑 아래 누렇게 바랜 건반(검은 건반 몇 개 빠짐), 먼지 앉은 윗면에 꺼진 촛대.
    2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(2, 6):
        for x in range(1, 31): cv.px(x, y, GW[4] if y == 2 or x == 1 else (GW[3] if x < 30 else GW[2]))
    for y in range(6, 18):                                                      # 앞판(조각 판 둘)
        for x in range(1, 31):
            c = GW[3] if x < 29 else GW[2]
            if 4 <= x <= 27 and 8 <= y <= 15 and (x in (4, 15, 16, 27) or y in (8, 15)): c = GW[2] if y != 8 else GW[4]
            cv.px(x, y, c)
    for y in range(18, 21):                                                     # 건반 선반(윗면)
        for x in range(0, 32): cv.px(x, y, GW[5] if y == 18 else GW[4])
    for y in range(21, 25):                                                     # 건반
        for x in range(2, 30):
            c = LN[5] if y < 24 else LN[3]
            if x % 2 == 0: c = mix(c, DU[3], .4)
            if y < 23 and x % 4 == 1 and _hash(x, 0, seed + 101) < .8: c = OUTL
            cv.px(x, y, c)
    for y in range(25, 31):
        for x in range(1, 31):
            c = GW[2] if x < 29 else GW[1]
            if y == 30: c = GW[1]
            cv.px(x, y, c)
    for x in (3, 28):
        for y in range(25, 31): cv.px(x, y, GW[4] if x == 3 else GW[2])
    candle(cv, 7, -1 + 1, 2, lit=False)
    for x in range(5, 11): cv.px(x, 3, BRS[3])
    dust_top(cv, 1, 2, 31, 6, seed + 102, .4)
    return shadow_under(fin(cv, .55), 16, 31, 15, 1.4, 70)


def side_table(seed=0):
    """작은 둥근 탁자 1×1(16x16): 외다리 검은 참나무 탁자 위 시든 꽃 꽂은 유리 꽃병과 녹은 초. 막힘."""
    cv = Cv(16, 16)
    topell(cv, 8, 7, 6.5, 2.6, GW, 5, 3, seed + 111)
    for y in range(9, 14): cv.px(7, y, GW[3]); cv.px(8, y, GW[2])
    for x in range(4, 12): cv.px(x, 14, GW[3] if x < 8 else GW[2])
    for y in range(2, 7): cv.px(5, y, GLS[4]); cv.px(6, y, GLS[3])
    for (x, y) in ((5, 1), (4, 0), (6, 0), (7, 1)): cv.px(x, y, MO[4])
    cv.px(4, 1, (96, 70, 60))
    candle(cv, 10, 4, 3, lit=False)
    return shadow_under(fin(cv, .6), 8, 15, 6, 1.0, 60)


def rug_round(seed=0):
    """해진 둥근 깔개 3×2(48x32, 바닥 장식, 걷기): 바랜 검붉은 타원 깔개, 테 무늬 두 겹, 한쪽이 뜯겨 올이 풀리고 먼지가 앉았다."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - 24) / 22.0; dy = (y + .5 - 16) / 13.0
            d = dx * dx + dy * dy
            if d > 1: continue
            if dx > .5 and dy > -.1 and _hash(x, y, seed + 121) < (dx - .5) * 2.2: continue   # 뜯긴 자리
            c = CR[3]
            if d > .82: c = CR[2]
            elif .58 < d < .68: c = mix(CR[4], DU[3], .3)
            elif .2 < d < .26: c = CR[4]
            elif d < .06: c = mix(CR[5], DU[3], .3)
            if _hash(x, y, seed + 122) < .05: c = CR[1]
            if vnoise(x, y, 4, seed + 123) > .7: c = mix(c, DU[3], .35)
            cv.px(x, y, c)
    return cv.im


def birdcage(seed=0):
    """빈 새장 1×2(16x32): 녹슨 쇠 받침대 위 둥근 지붕 새장, 열린 문과 깃털 한 개(새 없음). 아랫줄만 막힘."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(2, 15):
        hw = 5 if y > 5 else 1 + y
        for x in range(8 - hw, 8 + hw + 1, 2):
            cv.px(x, y, RI[4] if x < 8 else RI[2])
        if y in (2, 6, 14):
            for x in range(8 - hw, 8 + hw + 1): cv.px(x, y, RI[3])
    cv.px(8, 0, RI[4]); cv.px(8, 1, RI[3])
    for y in range(8, 13): cv.px(12, y, RI[1]); cv.px(13, y + 1, RI[3])        # 열린 문
    cv.px(6, 13, LN[5]); cv.px(7, 13, LN[4]); cv.px(5, 12, LN[4])             # 깃털
    for y in range(15, 28): cv.px(7, y, RI[3]); cv.px(8, y, RI[1])
    for (x, y) in ((4, 28), (5, 28), (11, 28), (10, 28), (3, 29), (12, 29), (7, 28), (8, 28)): cv.px(x, y, RI[2])
    return shadow_under(fin(cv, .62), 8, 29, 5, 1.0, 60)


def trunk_old(seed=0):
    """낡은 궤 1×1(16x16): 쇠띠 두른 둥근 뚜껑 검은 참나무 궤, 녹슨 자물쇠, 뚜껑 위 먼지. 막힘."""
    cv = Cv(16, 16)
    for y in range(3, 15):
        for x in range(1, 15):
            if y < 7:
                c = GW[5] if y == 3 or x == 1 else GW[4]
                if y == 6: c = GW[2]
            else:
                c = GW[3] if x < 13 else GW[2]
                if y == 14: c = GW[1]
            if x in (4, 11): c = RI[3] if y < 7 else RI[2]
            cv.px(x, y, c)
    for y in range(7, 10):
        for x in range(7, 9): cv.px(x, y, BRS[4] if y == 7 else BRS[2])
    dust_top(cv, 1, 3, 15, 7, seed + 131, .35)
    return shadow_under(fin(cv, .6), 8, 15, 7, 1.0, 60)
