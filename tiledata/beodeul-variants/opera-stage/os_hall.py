# 극장 조각 2: 객석(좌석 줄·통로 끝 기둥), 박스석(팔걸이 의자·칸막이·금 기둥), 빛(금 벽등·샹들리에 둘),
# 로비(대리석 기둥·종려 화분·벨벳 줄 기둥·매표소·벨벳 긴 의자·꽃 항아리 받침·객석 문틀·입구 깔개·외투 보관대·액자 그림·큰 계단 오름/내림·계단 아치).
from os_kit import *
from os_kit import _hash


# ------------------------------------------------------------------ 객석 좌석 (뒤에서 본다: 관객은 북쪽 무대를 향해 앉는다)
def _seat(cv, x0, seed=0, worn=False, glove=False):
    """좌석 하나(16 폭)를 x0 에 그린다: 둥근 금테 등받이 머리, 벨벳 등판(가운데 놋쇠 번호판 자리 — 글자 없음), 아래 그늘·다리."""
    for y in range(1, 15):
        for x in range(x0 + 1, x0 + 15):
            if y < 3 and (x in (x0 + 1, x0 + 14)): continue
            if y < 2 and (x in (x0 + 2, x0 + 13)): continue
            if y < 3:
                k = 6 if (y == 1 and x < x0 + 10) else (5 if x < x0 + 11 else 4)
                cv.px(x, y, GLT[k] if y == 1 else WD[5 if x < x0 + 10 else 4]); continue
            if x in (x0 + 1, x0 + 14) or y == 14:
                cv.px(x, y, WD[4] if x == x0 + 1 else WD[2]); continue
            k = 4 if x < x0 + 6 else (3 if x < x0 + 11 else 2)
            if y == 3: k += 1
            if (x - x0 + y) % 6 == 0 and 4 < y < 13: k -= 1                         # 누빈 결
            if worn and 8 < y < 12 and x0 + 7 <= x <= x0 + 9: k = 1                  # 해진 곳
            if _hash(x, y, seed + 7) < .04: k += 1
            cv.px(x, y, VEL[clamp(k, 1, 6)])
    for x in (x0 + 7, x0 + 8): cv.px(x, 6, BR[5] if x == x0 + 7 else BR[3]); cv.px(x, 7, BR[3])
    for y in range(15, 19):
        for x in range(x0 + 3, x0 + 13): cv.px(x, y, VEL[1] if y == 15 else (22, 12, 18))
    for x in (x0 + 4, x0 + 11):
        for y in range(15, 20): cv.px(x, y, WD[2])
    if glove:
        for (x, y) in ((x0 + 9, 1), (x0 + 10, 1), (x0 + 11, 2), (x0 + 10, 2), (x0 + 11, 3), (x0 + 12, 3)): cv.px(x, y, MRB[6])
        cv.px(x0 + 5, 0, VEL[5]); cv.px(x0 + 6, 0, VEL[4]); cv.px(x0 + 5, 1, GRN[3])

def _arm(cv, x):
    """좌석 사이 팔걸이 끝(앞면): 짙은 나무 기둥과 금 머리."""
    for y in range(8, 19):
        cv.px(x, y, WD[4] if y > 8 else GLT[5]); cv.px(x + 1, y, WD[2] if y > 8 else GLT[3])

def _endpost(cv, x0, right=False):
    """줄 끝 기둥: 금 머리 장식의 짙은 나무 기둥, 발치에 남쪽을 비추는 작은 통로 등."""
    xa = x0 + (11 if right else 1)
    for y in range(2, 20):
        for x in range(xa, xa + 4):
            k = 5 if x == xa else (4 if x < xa + 3 else 2)
            if y < 4: cv.px(x, y, GLT[6 if x == xa else (5 if x < xa + 3 else 3)]); continue
            cv.px(x, y, EBN[k])
    for x in range(xa, xa + 4): cv.px(x, 4, GLT[3])
    cv.px(xa + 1, 15, FL[4]); cv.px(xa + 2, 15, FL[3]); cv.px(xa + 1, 16, FL[2]); cv.px(xa + 2, 16, FL[2])

def seat_row(n, ends='', seed=0, worn=(), glove=()):
    """좌석 줄 n×2(16n x 32): 아래 줄은 몸통(막힘), 등받이 머리가 위 줄 바닥 쪽으로 4px 올라온다(위 줄은 걷기+가림)."""
    W = 16 * n; cv = Cv(W, 22)
    for i in range(n): _seat(cv, i * 16, seed + i, i in worn, i in glove)
    for i in range(1, n): _arm(cv, i * 16 - 1)
    if 'L' in ends: _endpost(cv, 0)
    if 'R' in ends: _endpost(cv, W - 16, True)
    im = fin(cv, .62)
    o = new(W, 32); o.alpha_composite(im, (0, 10))
    sh = new(W, 32)
    for x in range(W):
        for y in (30, 31): sh.putpixel((x, y), (10, 8, 16, 70))
    sh.alpha_composite(o)
    return sh

def seat_row4(seed=0): return seat_row(4, '', seed, worn=(2,))
def seat_row4b(seed=0): return seat_row(4, '', seed + 9, glove=(1,))
def seat_row3_endL(seed=0): return seat_row(3, 'L', seed + 3)
def seat_row3_endR(seed=0): return seat_row(3, 'R', seed + 5)
def seat_row2(seed=0): return seat_row(2, '', seed + 11)


# ------------------------------------------------------------------ 박스석
def box_chair(seed=0):
    """박스석 팔걸이 의자 1×2(16x32): 볏 장식 금테 높은 등받이(뒤에서 본다), 단추 누빈 벨벳, 양 팔걸이 금 머리. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(8, 26):
        for x in range(2, 14):
            if y < 11 and abs(x - 7.5) > 2 + (y - 8) * 2: continue
            if y < 11 or x in (2, 13):
                cv.px(x, y, GLT[5] if (x < 8 and y < 11) or x == 2 else GLT[3]); continue
            k = 4 if x < 6 else (3 if x < 11 else 2)
            if (x + y) % 4 == 0 and (y - x) % 4 == 0: k = 5                           # 단추
            cv.px(x, y, VEL[k])
    cv.px(7, 7, GLT[6]); cv.px(8, 7, GLT[4])
    for y in range(16, 26):
        cv.px(0, y, WD[4]); cv.px(1, y, WD[3]); cv.px(14, y, WD[3]); cv.px(15, y, WD[2])
    for x in (0, 1, 14, 15): cv.px(x, 15, GLT[5] if x < 8 else GLT[3])
    for x in range(1, 15): cv.px(x, 26, VEL[1])
    for x in (2, 13):
        for y in range(27, 31): cv.px(x, y, WD[2])
    return shadow_under(fin(cv, .62), 8, 30.5, 7, 1.3, 70)


def box_divider(seed=0):
    """박스석 칸막이 3×2(48x32): 박스 사이 낮은 벽 — 금 갓돌 윗면, 벨벳 앞면에 금 판 테, 가운데 늘어진 벨벳 자락. 아랫줄 막힘(위는 걷기+가림)."""
    W, H = 48, 32; cv = Cv(W, H)
    for y in range(12, 32):
        for x in range(0, W):
            if y < 16:
                k = 6 if (y == 12 or x < 2) else (5 if x < 44 else 4)
                if y == 15: k = 3
                cv.px(x, y, GLT[k]); continue
            k = 4 if x < 4 else (3 if x < 44 else 2)
            if y == 31: k = 1
            px_ = x % 16; py = y - 17
            if (px_ in (2, 13) and 1 <= py <= 11) or (py in (1, 11) and 2 <= px_ <= 13): cv.px(x, y, GLT[4] if px_ < 8 else GLT[3]); continue
            cv.px(x, y, VEL[k])
    for y in range(4, 22):                                                           # 늘어진 자락(가운데)
        hw = 3 + (y - 4) // 4
        for x in range(24 - hw, 24 + hw):
            k = 4 if (x - 24 + hw) % 3 else 3
            if x < 22: k += 1
            cv.px(x, y, VEL[k])
    for x in range(20, 28): cv.px(x, 3, GLT[5]); cv.px(x, 4, GLT[3])
    return fin(cv, .62)


def box_pilaster(seed=0):
    """박스석 금 기둥 1×4(16x64): 난간 줄 위에 서는 가는 금 기둥 — 둥근 머리판, 홈 새긴 몸통과 금 띠 둘, 네모 받침. 아랫줄만 막힘."""
    W, H = 16, 64; cv = Cv(W, H)
    stone_box(cv, 2, 56, 14, 63, 3, GLT, seed)
    for y in range(10, 56):
        for x in range(5, 11):
            k = cyl_k(x, 5, 11)
            if x == 7 and 12 < y < 54: k -= 1
            cv.px(x, y, GLT[clamp(k)])
    for y in range(5, 10):
        for x in range(2, 14): cv.px(x, y, GLT[5 if x < 5 else (4 if x < 11 else 3)] if y < 8 else GLT[2])
    topell(cv, 8, 3.5, 6.5, 2.4, GLT, 6, 5, seed)
    for y in (22, 23, 40, 41):                                                     # 몸통 띠
        for x in range(4, 12): cv.px(x, y, GLT[6] if y in (22, 40) and x < 8 else GLT[3])
    return shadow_under(fin(cv, .6), 8, 62.5, 7, 1.5, 70)


# ------------------------------------------------------------------ 빛
def sconce_gold(seed=0):
    """금 벽등 1×1(벽 앞면 장식): 소용돌이 금 팔 위 젖빛 유리 튤립 갓 둘, 갓 속 불빛."""
    cv = Cv(16, 16)
    for y in range(8, 15): cv.px(7, y, GLT[4]); cv.px(8, y, GLT[3])
    for x in range(3, 13): cv.px(x, 10, GLT[5] if x < 8 else GLT[3])
    for cx in (4, 11):
        for y in range(3, 9):
            hw = 1 + (y - 3) // 2
            for x in range(cx - hw, cx + hw + 1):
                cv.px(x, y, (255, 244, 214) if y < 6 and x <= cx else ((246, 222, 180) if y < 8 else (226, 196, 150)))
        cv.px(cx, 2, FL[4]); cv.px(cx, 9, GLT[4])
    cv.px(7, 15, GLT[2]); cv.px(8, 15, GLT[1])
    return fin(cv, .62)


def _chandelier(W, H, rings, drops, seed=0):
    cv = Cv(W, H); cx = W / 2.0
    for y in range(0, rings[0][1] + 1): cv.px(int(cx) - 1, y, GLT[4]); cv.px(int(cx), y, GLT[3])     # 줄기
    for (rx, cy, ry, nb) in rings:
        for a in range(0, 360, 2):                                                  # 금 고리 띠(두께 3: 윗면 밝음 + 앞면)
            t = math.radians(a); x = cx + math.cos(t) * rx; y = cy + math.sin(t) * ry
            front = math.sin(t) > -.15
            k = 6 if (math.cos(t) < -.3) else (5 if math.cos(t) < .3 else 4)
            cv.px(int(x), int(y), GLT[k])
            if front: cv.px(int(x), int(y) + 1, GLT[3]); cv.px(int(x), int(y) + 2, GLT[1])
        for a in range(0, 360, 30):                                                 # 고리와 줄기를 잇는 팔
            t = math.radians(a + 15)
            if math.sin(t) < -.3: continue
            line(cv, cx, cy - ry - 3, cx + math.cos(t) * rx * .95, cy + math.sin(t) * ry, GLT[4])
        for i in range(nb):                                                          # 초·전구
            t = 2 * math.pi * i / nb + .2; x = int(cx + math.cos(t) * rx); y = int(cy + math.sin(t) * ry)
            cv.px(x, y - 1, MRB[6]); cv.px(x, y - 2, MRB[5]); cv.px(x, y - 3, FL[4]); cv.px(x, y - 4, FL[3])
        for i in range(drops):                                                       # 수정 방울
            t = 2 * math.pi * (i + .5) / drops; x = int(cx + math.cos(t) * rx * .92); y = int(cy + math.sin(t) * ry) + 2
            if math.sin(t) < -.2: continue
            for dy in range(0, 3 + (i % 2) * 2): cv.px(x, y + dy, (226, 240, 250) if dy % 2 == 0 else (160, 196, 226))
        for x in range(int(cx - rx * .5), int(cx + rx * .5)):
            if (x * 7) % 3 == 0: cv.px(x, int(cy + ry * .2), GLT[3])
    by = rings[-1][1] + rings[-1][2] + 2
    for y in range(rings[0][1], by): cv.px(int(cx) - 1, y, GLT[5]); cv.px(int(cx), y, GLT[3])
    bcy = rings[-1][1] + 1                                                           # 가운데 금 그릇
    for y in range(bcy - 2, bcy + 4):
        hw = 4 - abs(y - bcy - 1)
        for x in range(int(cx) - hw, int(cx) + hw): cv.px(x, y, GLT[clamp(cyl_k(x, cx - hw, cx + hw) - (1 if y > bcy + 1 else 0), 1, 6)])
    for dy in range(4): cv.px(int(cx) - 1 + (dy % 2), by + dy, (226, 240, 250) if dy % 2 else GLT[4])
    return fin(cv, .78)

def chandelier(seed=0):
    """큰 샹들리에 4×3(64x48, 위층 걸개 장식 — 걷기·가림): 금 줄기에 달린 금 고리 둘(3/4 타원), 고리마다 초와 늘어진 수정 방울, 아래 방울 끝장식."""
    return _chandelier(64, 48, [(12, 15, 4, 8), (26, 29, 8, 14)], 22, seed)

def chandelier_small(seed=0):
    """작은 샹들리에 2×2(32x32, 위층 걸개 장식): 금 고리 하나에 초 여섯과 수정 방울. 로비·박스석 위."""
    return _chandelier(32, 32, [(12, 16, 4, 8)], 10, seed)


# ------------------------------------------------------------------ 로비
def marble_column(seed=0):
    """대리석 기둥 1×3(16x48): 금박 머리판·크림 대리석 원통(맥이 비스듬히)·금 띠 두 단 받침. 아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    stone_box(cv, 1, 39, 15, 47, 3, MRB, seed)
    for x in range(1, 15): cv.px(x, 42, GLT[4] if x < 12 else GLT[3])
    for y in range(36, 39):
        for x in range(3, 13): cv.px(x, y, GLT[clamp(cyl_k(x, 3, 13) - (1 if y == 38 else 0))])
    for y in range(11, 36):
        for x in range(4, 12):
            k = cyl_k(x, 4, 12)
            if (x * 2 + y) % 13 == 0: k -= 2                                         # 대리석 맥
            elif (x * 2 + y) % 13 == 1 and k > 3: k -= 1
            cv.px(x, y, MRB[clamp(k)])
    for y in range(7, 11):
        hw = 6 - (y - 7) // 2
        for x in range(8 - hw, 8 + hw): cv.px(x, y, GLT[clamp(cyl_k(x, 8 - hw, 8 + hw) - (1 if y == 10 else 0))])
    for y in range(4, 7):
        for x in range(1, 15): cv.px(x, y, GLT[5 if x < 3 else (4 if x < 12 else 3)] if y < 6 else GLT[2])
    topell(cv, 8, 2.6, 7.2, 2.6, MRB, 6, 5, seed)
    return shadow_under(fin(cv, .62), 8, 46.5, 7.5, 1.8, 80)


def potted_palm(seed=0):
    """종려 화분 2×2(32x32): 놋쇠 띠 두른 둥근 화분에서 부채처럼 뻗어 휘어지는 깃 잎. 아랫줄 가운데만 막힘(잎은 걷기+가림)."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(22, 31):
        hw = 6 - max(0, y - 27)
        for x in range(16 - hw, 16 + hw): cv.px(x, y, BR[clamp(cyl_k(x, 16 - hw, 16 + hw), 1, 6)])
    for x in range(10, 22): cv.px(x, 25, BR[2])
    topell(cv, 16, 22, 6.4, 1.8, WD, 3, 2, seed)
    LFp = list(terrain.LF)
    for i, (ang, ln) in enumerate(((-2.7, 14), (-2.2, 15), (-1.75, 13), (-1.35, 15), (-.9, 14), (-.45, 13), (-2.95, 10), (-.15, 10))):
        for j in range(ln):
            t = j / float(ln)
            x = 16 + math.cos(ang) * j; y = 21 + math.sin(ang) * j + 9 * t * t      # 끝이 아래로 휜다
            k = 5 if math.cos(ang) < -.2 else 4
            if t > .7: k -= 1
            cv.px(int(x), int(y), LFp[clamp(k, 1, 6)])
            if j > 2 and j % 2 == 0:                                                 # 잔 깃
                for s in (-1, 1):
                    cv.px(int(x + s * math.sin(ang) * 2), int(y - s * math.cos(ang) * 2 + 1), LFp[clamp(k - 1, 1, 6)])
    return shadow_under(fin(cv, .62), 16, 30.5, 7, 1.5, 70)


def rope_barrier(seed=0):
    """벨벳 줄 기둥 2×1(32x16): 둥근 머리 놋쇠 기둥 둘 사이로 처진 붉은 벨벳 줄. 막힘 1줄. 이어 놓으면 줄이 길어진다."""
    cv = Cv(32, 16)
    for x0 in (2, 27):
        for y in range(4, 15):
            cv.px(x0, y, BR[5]); cv.px(x0 + 1, y, BR[4]); cv.px(x0 + 2, y, BR[2])
        for (x, y, k) in ((x0, 2, 6), (x0 + 1, 2, 5), (x0 + 2, 2, 4), (x0, 3, 5), (x0 + 1, 3, 4), (x0 + 2, 3, 3), (x0 + 1, 1, 5)): cv.px(x, y, BR[k])
        for x in range(x0 - 2, x0 + 5): cv.px(x, 15, BR[3] if x < x0 + 3 else BR[2])
    for x in range(5, 27):
        t = (x - 5) / 22.0; y = 5 + int(5 * 4 * t * (1 - t))
        cv.px(x, y, VEL[4]); cv.px(x, y + 1, VEL[2])
    return shadow_under(fin(cv, .62), 16, 15, 15, 1.2, 50)


def ticket_booth(seed=0):
    """매표소 3×3(48x48): 짙은 나무 작은 집 — 윗면 붉은·크림 줄무늬 차양 지붕·금 처마와 처진 술, 앞면 금 창살 아치 창과 작은 창구 받침, 놋쇠 종. 아래 2줄 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    wbox(cv, 2, 6, 46, 46, 10, EBN, seed, boards=5)
    for x in range(1, 47): cv.px(x, 16, GLT[5] if x < 40 else GLT[3]); cv.px(x, 17, GLT[3]); cv.px(x, 18, EBN[1])
    for y in range(6, 16):                                                       # 윗면 줄무늬 차양 지붕
        for x in range(2, 46):
            k = 5 if (x // 4) % 2 == 0 else 3
            if y == 6 or x == 2: k += 1
            if x > 43: k -= 1
            cv.px(x, y, VEL[clamp(k, 1, 6)] if (x // 4) % 2 == 0 else CRM[clamp(k + 1, 1, 6)])
    for x in range(2, 46):
        if x % 4 in (1, 2): cv.px(x, 19, VEL[3])
    for y in range(20, 38):                                                          # 아치 창
        for x in range(12, 36):
            if y < 26 and math.hypot(x + .5 - 24, y + .5 - 26) > 12: continue
            c = (60, 46, 52) if y > 24 else (84, 70, 76)
            if x % 4 == 0 or (y - 20) % 5 == 0: c = GLT[4] if x < 24 else GLT[3]
            cv.px(x, y, c)
    for y in range(37, 41):
        for x in range(8, 40): cv.px(x, y, MRB[5] if y == 37 else (MRB[3] if y < 40 else MRB[1]))
    for (x, y, c) in ((30, 34, BR[5]), (31, 34, BR[4]), (29, 35, BR[5]), (30, 35, BR[4]), (31, 35, BR[3]), (32, 35, BR[2]), (30, 36, BR[2])): cv.px(x, y, c)
    for x in range(2, 46): cv.px(x, 45, EBN[1])
    return shadow_under(fin(cv, .62), 24, 46.5, 22, 1.6, 70)


def lobby_bench(seed=0):
    """벨벳 긴 의자 2×1(32x16): 단추 누빈 붉은 벨벳 방석(윗면)·앞면 술 띠·금 다리 넷. 막힘 1줄."""
    cv = Cv(32, 16)
    for y in range(3, 13):
        for x in range(1, 31):
            if y < 8:
                k = 5 if (y == 3 or x < 3) else 4
                if (x + y) % 5 == 0 and y in (5, 6): k = 6
            else:
                k = 3 if x < 28 else 2
                if y == 8: k = 4
            cv.px(x, y, VEL[k])
    for x in range(1, 31): cv.px(x, 12, GLT[4] if x % 2 else GLT[3])
    for x in (2, 10, 21, 28):
        for y in range(13, 16): cv.px(x, y, GLT[4]); cv.px(x + 1, y, GLT[2])
    return shadow_under(fin(cv, .62), 16, 15, 15, 1.2, 60)


def urn_pedestal(seed=0):
    """꽃 항아리 받침 1×2(16x32): 네모 대리석 받침(윗면+앞면, 금 띠) 위 금 항아리에 붉은·흰 꽃 다발. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    stone_box(cv, 2, 16, 14, 31, 3, MRB, seed)
    for x in range(2, 14): cv.px(x, 19, GLT[4] if x < 11 else GLT[3]); cv.px(x, 28, GLT[3])
    for y in range(9, 17):
        hw = 4 - abs(y - 12) // 2
        for x in range(8 - hw, 8 + hw): cv.px(x, y, GLT[clamp(cyl_k(x, 8 - hw, 8 + hw), 1, 6)])
    for i in range(14):
        x = 3 + int(_hash(i, 1, seed + 21) * 10); y = 2 + int(_hash(i, 2, seed + 21) * 7)
        c = VEL[5] if i % 3 else MRB[6]
        cv.px(x, y, c); cv.px(x + 1, y, mul(c, .8)); cv.px(x, y + 1, mul(c, .7))
    for (x, y) in ((5, 8), (10, 8), (7, 7), (3, 6), (12, 6)): cv.px(x, y, terrain.LF[4]); cv.px(x, y + 1, terrain.LF[3])
    return shadow_under(fin(cv, .62), 8, 30.5, 6.5, 1.3, 70)


def hall_door(seed=0):
    """객석 문틀 4×3(64x48, 걷기): 벽을 뚫은 2칸 통로를 두른 금 문틀 — 양옆 기둥(벽 앞면 위), 위 박공 머리와 작은 등, 안쪽으로 열어젖힌 붉은 가죽 문짝(놋쇠 징).
    가운데 아래 2×2 는 통로 바닥이 보인다. 통로 2칸 왼쪽 칸 바로 왼쪽에 x 를 맞춘다."""
    W, H = 64, 48; cv = Cv(W, H)
    for y in range(0, H):
        for x in list(range(10, 16)) + list(range(48, 54)):                          # 기둥
            k = 6 if x in (10, 48) else (5 if x in (11, 12, 49, 50) else (4 if x in (13, 51) else 3))
            if y > H - 4: k = 2
            if (y % 8 == 0) and 0 < y < H - 4: k = 3
            cv.px(x, y, GLT[k])
        for x in list(range(16, 20)) + list(range(44, 48)):                          # 열어젖힌 문짝(안쪽에 비스듬)
            if y < 6 or y > H - 2: continue
            k = 4 if x in (16, 44) else (3 if x in (17, 45) else 2)
            if (y % 6 == 3) and x in (17, 46): cv.px(x, y, BR[5]); continue
            cv.px(x, y, VEL[k])
    for y in range(0, 7):                                                            # 문 머리
        for x in range(8, 56):
            if y < 3 and abs(x - 31.5) > 24 - y * 6: continue
            k = 6 if y < 2 else (5 if y < 5 else 3)
            if x > 50: k -= 1
            cv.px(x, y, GLT[k])
    for x in range(8, 56): cv.px(x, 7, GLT[2])
    cv.px(31, 0, FL[4]); cv.px(32, 0, FL[3]); cv.px(31, 1, (255, 240, 200)); cv.px(32, 1, (240, 220, 180))
    return fin(cv, .62)


def entrance_rug(seed=0):
    """입구 깔개 2×1(32x16, 바닥 장식): 금실 테두리 진홍 깔개, 가운데 금 마름모, 양 끝 술."""
    cv = Cv(32, 16)
    for y in range(3, 14):
        for x in range(2, 30):
            c = VEL[3] if (x + y) % 4 else VEL[4]
            if y in (3, 13) or x in (2, 29): c = GLT[4]
            elif y in (4, 12) or x in (3, 28): c = VEL[1]
            elif abs(x - 15.5) + abs(y - 8) * 2.2 < 6: c = GLT[5] if abs(x - 15.5) + abs(y - 8) * 2.2 > 4 else VEL[5]
            cv.px(x, y, c)
    for x in range(3, 29, 2): cv.px(x, 2, GLT[3]); cv.px(x, 14, GLT[3])
    return cv.im


def coat_check(seed=0):
    """외투 보관대 3×2(48x32): 대리석 윗면 계산대(금 띠 앞면) 뒤로 놋쇠 걸이 막대에 걸린 외투·모자·우산. 아래 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    for x in range(2, 46): cv.px(x, 2, BR[5] if x < 40 else BR[3]); cv.px(x, 3, BR[2])
    for x in (3, 44):
        for y in range(2, 18): cv.px(x, y, BR[4] if x == 3 else BR[2])
    coats = [(5, VEL), (12, BLU), (19, [(30, 26, 34), (40, 34, 46), (54, 46, 60), (70, 62, 78), (90, 82, 98), (120, 112, 128), (150, 142, 160)]), (26, GRN), (33, MAH), (39, CNV)]
    for (x0, r) in coats:
        for y in range(4, 18):
            hw = 2 + (y - 4) // 5
            for x in range(x0 + 3 - hw, x0 + 3 + hw + 1):
                k = 4 if x < x0 + 3 else 3
                if y == 4: k = 5
                cv.px(x, y, r[clamp(k, 1, 6)])
        cv.px(x0 + 3, 3, BR[4])
    for y in range(14, 31):                                                          # 계산대
        for x in range(1, 47):
            if y < 18: k = 6 if (y == 14 or x < 3) else (5 if x < 44 else 4); cv.px(x, y, MRB[k]); continue
            k = 4 if x < 4 else (3 if x < 44 else 2)
            if y == 18: cv.px(x, y, GLT[4]); continue
            if y == 30: k = 1
            if x % 12 == 0: k = 2
            cv.px(x, y, EBN[k])
    for (x, y, c) in ((10, 13, BR[5]), (11, 13, BR[4]), (36, 12, (240, 230, 210)), (37, 12, (220, 210, 190)), (36, 13, (200, 190, 170))): cv.px(x, y, c)
    return shadow_under(fin(cv, .62), 24, 30.5, 22, 1.6, 70)


def frame_painting(seed=0):
    """액자 그림 1×2(16x32, 벽 앞면 장식): 금 액자 속 붓으로 칠한 초승달과 물결(글자 없음)."""
    cv = Cv(16, 32)
    for y in range(2, 30):
        for x in range(1, 15):
            if x < 3 or x > 12 or y < 4 or y > 27:
                k = 5 if (x < 2 or y < 3) else (4 if x < 3 or y < 4 else 3)
                cv.px(x, y, GLT[k]); continue
            t = (y - 4) / 23.0
            c = mix(BLU[2], BLU[4], t)
            if y > 19: c = BLU[3] if (x + y) % 3 else BLU[5]
            cv.px(x, y, c)
    for y in range(7, 14):
        for x in range(5, 12):
            if math.hypot(x + .5 - 8, y + .5 - 10) < 3.4 and math.hypot(x + .5 - 9.5, y + .5 - 9) > 2.6: cv.px(x, y, (246, 232, 180))
    return fin(cv, .66)


def grand_stair_up(seed=0):
    """큰 계단 오름 2×2(32x32, 걷기): 대리석 계단 네 단이 북쪽 벽(stair_arch 아래)으로 오르고, 가운데 진홍 깔개를 놋쇠 막대가 누른다. 양옆 대리석 난간벽.
    맨 윗줄 가운데 = 위층(박스석) 이동 칸. 벽 앞면 바로 아래 바닥 위에 놓는다."""
    W, H = 32, 32; cv = Cv(W, H)
    for i in range(4):
        yb = 31 - i * 8
        for y in range(yb - 7, yb + 1):
            for x in range(4, 28):
                ly = yb - y
                if ly < 3: k = 2 + (1 if i > 1 else 0); r = MRB
                else: k = 4 + (1 if i > 0 else 0) + (1 if i > 2 else 0); r = MRB
                if 10 <= x < 22: r = VEL; k = k - 1
                if x > 25: k -= 1
                cv.px(x, y, r[clamp(k, 1, 6)])
            for x in range(10, 22): cv.px(x, yb - 3, BR[5] if x < 18 else BR[3])
    for x0 in (0, 28):
        for y in range(0, 32):
            for x in range(x0, x0 + 4): cv.px(x, y, MRB[6] if x == x0 else (MRB[4] if x < x0 + 3 else MRB[2]))
        for y in (0, 1):
            for x in range(x0, x0 + 4): cv.px(x, y, GLT[5] if x < x0 + 2 else GLT[3])
    return fin(cv, .62)


def stair_arch(seed=0):
    """계단 아치 2×2(32x32, 벽 앞면 장식): 벽을 뚫은 둥근 아치 안으로 대리석 계단과 진홍 깔개가 위층 빛 속으로 이어진다. 금 쐐기돌."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            inside = 5 <= x <= 26 and (y >= 13 or math.hypot(x + .5 - 16, y + .5 - 13) <= 11)
            edge = 2 <= x <= 29 and (y >= 13 or math.hypot(x + .5 - 16, y + .5 - 13) <= 14) and not inside
            if inside:
                step = (31 - y) // 6
                k = 4 - step // 2 + (1 if (31 - y) % 6 < 2 else 0)
                r = VEL if 10 <= x < 22 else MRB
                c = r[clamp(k - 1, 1, 6)]
                if y < 12: c = mix(c, (255, 236, 196), .3)                          # 위층 빛
                cv.px(x, y, c)
            elif edge:
                k = 5 if x < 10 else (4 if x < 22 else 3)
                if y < 4: k = 5
                cv.px(x, y, GLT[k] if y < 6 or x < 4 or x > 27 else MRB[k - 1])
    for y in range(0, 4):
        for x in range(14, 18): cv.px(x, y, GLT[6] if x < 16 else GLT[4])
    return fin(cv, .62)


def grand_stair_down(seed=0):
    """큰 계단 내림 2×2(32x32, 걷기): 박스석 바닥에 뚫린 계단 구멍 — 금 갓 난간벽 사이로 진홍 깔개 대리석 계단이 남쪽 아래(로비)로 내려가며
    단마다 한 단씩 어두워진다. 맨 아랫줄 = 아래층 이동 칸."""
    W, H = 32, 32; cv = Cv(W, H)
    for i in range(5):
        y0 = 2 + i * 6
        dim = .15 + i * .15
        for y in range(y0, min(32, y0 + 6)):
            ly = y - y0
            for x in range(5, 27):
                runner = 11 <= x < 21
                if ly < 4: k = 3; r = VEL if runner else MRB                            # 디딤판
                else: k = 1; r = VEL if runner else MRB                                 # 다음 단으로 떨어지는 그늘
                if ly == 0: k += 1
                if x > 24: k -= 1
                c = r[clamp(k, 1, 6)]
                if ly == 3 and runner: c = BR[4]
                cv.px(x, y, mix(c, VOIDP[0], dim))
    for x0 in (0, 27):
        for y in range(0, 32):
            for x in range(x0, x0 + 5):
                k = 5 if x == x0 else (4 if x < x0 + 3 else 2)
                if x0 == 27: k -= 1
                cv.px(x, y, mix(GLT[k] if x in (x0, x0 + 1) else MRB[k], VOIDP[0], y / 90.0))
    for x in range(0, 32): cv.px(x, 0, GLT[5]); cv.px(x, 1, GLT[3])
    return fin(cv, .62)
