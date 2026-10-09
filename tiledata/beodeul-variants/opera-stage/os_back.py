# 극장 조각 3: 무대 뒤(소품 창고·밧줄 걸이·도르래·의상 걸이·의상 상자·모자 걸이·소품 선반·소품 상자·모래주머니·배경판 더미·벽 사다리),
# 분장실(거울 화장대·병풍·둥근 의자), 천장 대들보 통로(매단 조명·배경막 막대·평형추 틀·밧줄 고리·감는 틀·늘어진 밧줄·대들보·승강구 사다리).
from os_kit import *
from os_kit import _hash

GOWN = [(30, 26, 34), (40, 34, 46), (54, 46, 60), (70, 62, 78), (90, 82, 98), (120, 112, 128), (150, 142, 160)]


def _garment(cv, x0, y0, w, h, r, seed=0, cape=False):
    for y in range(y0, y0 + h):
        t = (y - y0) / float(h)
        hw = w / 2.0 * (.55 + .45 * t) if not cape else w / 2.0 * (.8 + .2 * t)
        cx = x0 + w / 2.0
        for x in range(int(cx - hw), int(cx + hw + .5)):
            k = 4 if x < cx - hw * .3 else (3 if x < cx + hw * .5 else 2)
            if y == y0: k = 5
            if (x - x0) % 3 == 0 and t > .3: k -= 1                                  # 주름
            cv.px(x, y, r[clamp(k, 1, 6)])
    cv.px(int(x0 + w / 2.0), y0 - 1, BR[4]); cv.px(int(x0 + w / 2.0), y0 - 2, BR[3])


def costume_rack(seed=0):
    """의상 걸이 2×2(32x32): 바퀴 달린 쇠관 틀에 진홍 드레스·푸른 외투·금 망토·초록 윗옷을 옷걸이로 건 것. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x in range(1, 31): cv.px(x, 3, IR[4] if x < 24 else IR[3]); cv.px(x, 4, IR[2])
    for x in (1, 29):
        for y in range(3, 29): cv.px(x, y, IR[4] if x == 1 else IR[3]); cv.px(x + 1, y, IR[2])
    for x in range(0, 32): cv.px(x, 28, IR[3]); cv.px(x, 29, IR[1])
    _garment(cv, 3, 6, 7, 21, VEL, seed); _garment(cv, 9, 6, 7, 15, BLU, seed + 1)
    _garment(cv, 15, 6, 8, 18, GLT, seed + 2, cape=True); _garment(cv, 22, 6, 6, 12, GRN, seed + 3)
    for (x, y) in ((2, 30), (29, 30)): cv.px(x, y, IR[2]); cv.px(x + 1, y, IR[1]); cv.px(x, y + 1, IR[1])
    return shadow_under(fin(cv, .62), 16, 31, 15, 1.2, 60)


def costume_trunk(seed=0):
    """의상 상자 2×2(32x32): 뚜껑을 젖혀 연 쇠 모서리 여행 상자 — 안쪽 줄무늬 천, 넘쳐 나온 벨벳 자락과 금 왕관 소품. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(4, 16):                                                           # 젖힌 뚜껑(안쪽 면)
        for x in range(2, 30):
            c = CNV[4] if (x // 3) % 2 else (176, 120, 110)
            if y in (4, 5) or x in (2, 29): c = WD[3]
            cv.px(x, y, c)
    for (x, y) in ((2, 4), (29, 4), (2, 15), (29, 15)): cv.px(x, y, BR[5])
    wbox(cv, 1, 16, 31, 31, 4, WD, seed, boards=4)
    for y in range(16, 20):                                                          # 넘친 천
        for x in range(4, 28):
            k = 4 if (x + y) % 4 else 5
            cv.px(x, y, VEL[k] if x < 18 else BLU[k - 1])
    for y in range(17, 24): cv.px(6, y, VEL[3]); cv.px(7, y, VEL[4])
    for (x, y, k) in ((20, 14, 5), (21, 13, 6), (22, 14, 5), (23, 13, 6), (24, 14, 5), (20, 15, 4), (21, 15, 4), (22, 15, 4), (23, 15, 4), (24, 15, 3)): cv.px(x, y, GLT[k])
    cv.px(22, 12, VEL[5])
    for x in range(1, 31): cv.px(x, 24, IR[3]); cv.px(x, 25, IR[1])
    for (x, y) in ((1, 20), (30, 20), (1, 30), (30, 30)): cv.px(x, y, BR[5])
    cv.px(15, 22, BR[5]); cv.px(16, 22, BR[3]); cv.px(15, 23, BR[3])
    return shadow_under(fin(cv, .62), 16, 31, 15, 1.2, 60)


def hat_stand(seed=0):
    """모자 걸이 1×2(16x32): 세 다리 나무 기둥 꼭대기 갈래에 검은 높은 모자·깃털 모자, 늘어진 깃털 목도리. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(6, 29): cv.px(7, y, WD[5]); cv.px(8, y, WD[3])
    for (a, b) in (((7, 28), (2, 31)), ((8, 28), (13, 31)), ((8, 28), (8, 31))): line(cv, a[0], a[1], b[0], b[1], WD[3])
    for y in range(2, 8):                                                            # 높은 모자
        for x in range(2, 8): cv.px(x, y, GOWN[2] if x < 5 else GOWN[1])
    for x in range(1, 9): cv.px(x, 8, GOWN[3])
    cv.px(2, 6, VEL[4]); cv.px(3, 6, VEL[4]); cv.px(4, 6, VEL[3])
    for y in range(4, 9):                                                            # 깃털 모자
        for x in range(9, 15):
            if y >= 7 or (x > 9 and x < 14): cv.px(x, y, BLU[3] if x < 12 else BLU[2])
    for (x, y) in ((13, 3), (14, 2), (15, 1), (12, 3)): cv.px(x, y, MRB[6])
    for y in range(10, 22):                                                          # 깃털 목도리
        x = 6 + int(2 * math.sin(y * .7))
        cv.px(x, y, (232, 150, 190)); cv.px(x + 1, y, (200, 110, 160)); cv.px(x + 3, y, (232, 150, 190) if y > 13 else None)
    return shadow_under(fin(cv, .62), 8, 31, 6, 1.2, 60)


def vanity_mirror(seed=0):
    """분장 거울 화장대 2×2(32x32): 둘레에 빛나는 전구를 단 거울(벽에 붙임)과 아래 화장대 — 분 통·붓·향수병, 서랍 앞면. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(0, 15):
        for x in range(4, 28):
            if x < 6 or x > 25 or y < 2 or y > 13:
                cv.px(x, y, WD[5] if (x < 6 or y < 2) else WD[3]); continue
            c = (150, 172, 186) if (x - y) % 11 not in (0, 1) else (210, 226, 232)
            if x > 20: c = mul(c, .85)
            cv.px(x, y, c)
    for (x, y) in [(5, yy) for yy in (2, 6, 10)] + [(26, yy) for yy in (2, 6, 10)] + [(xx, 0) for xx in (9, 14, 19, 24)]:
        cv.px(x, y, (255, 244, 200)); cv.px(x, y + 1, (240, 210, 150))
    for y in range(15, 31):
        for x in range(1, 31):
            if y < 20:
                k = 6 if (y == 15 or x < 3) else (5 if x < 29 else 4)
                cv.px(x, y, WD[k]); continue
            k = 4 if x < 3 else (3 if x < 29 else 2)
            if y == 20: k = 2
            if x in (10, 21) or y == 30: k = 1
            cv.px(x, y, WD[k])
    for x in (5, 15, 25): cv.px(x, 25, BR[5])
    for (x, y, c) in ((5, 16, MRB[6]), (6, 16, MRB[5]), (5, 17, MRB[4]), (6, 17, MRB[3]), (11, 15, BLU[4]), (11, 16, BLU[3]), (11, 17, BLU[3]), (12, 17, BLU[2]),
                      (17, 16, (232, 160, 180)), (18, 16, (210, 130, 160)), (17, 17, (190, 110, 140)), (22, 17, WD[2]), (23, 16, WD[2]), (24, 15, (240, 220, 200)), (26, 17, GLT[5]), (27, 17, GLT[3])):
        cv.px(x, y, c)
    return shadow_under(fin(cv, .62), 16, 31, 15, 1.2, 60)


def folding_screen(seed=0):
    """병풍 가리개 2×3(32x48): 나무틀 세 폭 가리개 — 폭마다 엷은 비단에 꽃 넝쿨 무늬, 꼭대기에 걸쳐 둔 연분홍 드레스. 아랫줄만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for i in range(3):
        x0 = 1 + i * 10; k0 = (1, 0, 1)[i]
        for y in range(6, 45):
            for x in range(x0, x0 + 10):
                if x in (x0, x0 + 9) or y in (6, 7, 44):
                    cv.px(x, y, WD[5 - k0 if x == x0 or y == 6 else 3 - k0]); continue
                c = mix(CNV[5], CNV[4], .2 + .25 * k0)
                v = math.sin((y + i * 5) * .45) * 2.2
                if abs((x - x0 - 4.5) - v) < .8: c = GRN[3]                         # 넝쿨
                if (y + i * 3) % 7 == 0 and abs((x - x0 - 4.5) - v) < 2.5: c = VEL[5] if (x + y) % 2 else (236, 170, 170)
                cv.px(x, y, c)
        for y in (45, 46): cv.px(x0 + 1, y, WD[2]); cv.px(x0 + 8, y, WD[2])
    for y in range(3, 14):                                                           # 걸쳐 둔 드레스
        for x in range(11, 22):
            if y < 6 or abs(x - 16) < 3 + (y - 6) // 3:
                cv.px(x, y, (240, 190, 196) if x < 16 else (214, 156, 166))
    return shadow_under(fin(cv, .62), 16, 46.5, 15, 1.4, 60)


def dressing_stool(seed=0):
    """둥근 분장 의자 1×1: 벨벳 방석의 낮은 둥근 의자, 금 다리. 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(4, 11):
        hw = 6
        for x in range(8 - hw, 8 + hw):
            if y < 8:
                if ((x + .5 - 8) / 6) ** 2 + ((y + .5 - 6) / 2.4) ** 2 <= 1: cv.px(x, y, VEL[5] if x < 7 else VEL[4])
            else: cv.px(x, y, VEL[3] if x < 11 else VEL[2])
    for x in (4, 11):
        for y in range(10, 15): cv.px(x, y, GLT[4] if x == 4 else GLT[2])
    return shadow_under(fin(cv, .62), 8, 14.5, 6, 1.2, 60)


def flat_stack(seed=0):
    """배경판 더미 3×3(48x48): 벽에 기대 세운 배경판 넷 — 뒷면 나무 틀과 캔버스, 맨 앞 판은 칠한 숲 그림 모서리가 보인다. 아래 줄 막힘(위는 벽 앞)."""
    W, H = 48, 48; cv = Cv(W, H)
    for i, (x0, w, top) in enumerate(((2, 40, 2), (6, 38, 5), (1, 36, 9), (10, 36, 13))):
        for y in range(top, 46):
            for x in range(x0, min(W, x0 + w)):
                frame = x in (x0, x0 + 1, x0 + w - 2, x0 + w - 1) or y in (top, top + 1, 45) or (y - top) % 12 in (0,) or abs(x - (x0 + w // 2)) < 1
                if i == 3 and not frame and x < x0 + 16:                             # 맨 앞 판: 칠한 앞면 끝
                    n = vnoise(x, y, 4, 991)
                    cv.px(x, y, GRN[3] if n > .5 else (GRN[2] if y > 30 else BLU[4])); continue
                if frame: cv.px(x, y, WD[5] if x in (x0,) or y == top else WD[3])
                else: cv.px(x, y, CNV[4] if (x + y + i) % 9 else CNV[3])
        for y in range(top, 46): cv.px(x0 + w - 1 if x0 + w - 1 < W else W - 1, y, WD[2])
    return shadow_under(fin(cv, .62), 24, 46.5, 22, 1.6, 70)


def rope_pinrail(seed=0):
    """밧줄 걸이 난간 3×2(48x32, 벽 앞면 장식): 벽에 박은 굵은 나무 난간에 꽂은 쐐기못 여섯, 못마다 8자로 감아 맨 밧줄이 위로 뻗고, 사이에 감아 건 밧줄 다발."""
    W, H = 48, 32; cv = Cv(W, H)
    for x in range(W):
        for y in range(20, 27):
            k = 6 if y == 20 else (5 if y < 23 else (4 if y < 25 else 2))
            if x % 24 == 0: k -= 1
            cv.px(x, y, WD[k])
    for i in range(6):
        x = 4 + i * 8
        for y in range(16, 30): cv.px(x, y, WD[6] if y < 18 else (WD[4] if y < 26 else WD[2]))
        cv.px(x + 1, 17, WD[4])
        rope_line(cv, x, 0, x, 18, 0, 3)                                             # 위로 오르는 밧줄
        for (dx, dy) in ((-2, 18), (2, 19), (-2, 21), (2, 22), (-1, 24), (1, 23)): cv.px(x + dx, dy, ROPE[4 if dx < 0 else 3])
    for x0 in (8, 32):                                                               # 감아 건 밧줄 다발
        for a in range(0, 360, 8):
            t = math.radians(a)
            for rr in (4, 5):
                cv.px(int(x0 + 4 + math.cos(t) * rr * .7), int(27 + math.sin(t) * rr), ROPE[4 if math.cos(t) < 0 else 3])
    return fin(cv, .62)


def pulley_block(seed=0):
    """도르래 1×1(벽 앞면 장식): 쇠 갈고리에 매단 나무 도르래 틀과 쇠 바퀴, 지나가는 밧줄."""
    cv = Cv(16, 16)
    cv.px(7, 0, IR[4]); cv.px(8, 1, IR[3]); cv.px(7, 2, IR[3])
    for y in range(3, 13):
        for x in range(4, 12):
            k = 5 if x < 6 else (4 if x < 10 else 2)
            cv.px(x, y, WD[k])
    for y in range(5, 11):
        for x in range(6, 10):
            if math.hypot(x + .5 - 8, y + .5 - 8) < 2.6: cv.px(x, y, IR[4] if x < 8 else IR[2])
    cv.px(8, 8, IR[1])
    rope_line(cv, 5, 13, 3, 16, 0, 3); rope_line(cv, 11, 13, 13, 16, 0, 3)
    return fin(cv, .62)


def prop_crate(seed=0):
    """소품 상자 1×1: 뚜껑 없는 나무 상자에 꽂힌 소품 칼 자루 둘과 종이 꽃. 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(1, 7): cv.px(5, y, IR[4]); cv.px(6, y, IR[2])
    for x in range(3, 9): cv.px(x, 6, GLT[4])
    for y in range(0, 7): cv.px(10, y + 1, IR[3]); cv.px(11, y, IR[4])
    for (x, y, c) in ((12, 3, VEL[5]), (13, 3, VEL[4]), (12, 4, VEL[4]), (13, 2, MRB[6]), (14, 4, VEL[5])): cv.px(x, y, c)
    wbox(cv, 1, 6, 15, 15, 3, WD, seed, boards=3)
    for y in range(7, 9):
        for x in range(2, 14): cv.px(x, y, (40, 26, 20))
    return shadow_under(fin(cv, .62), 8, 15, 7, 1.2, 60)


def prop_shelf(seed=0):
    """소품 선반 2×3(32x48): 벽에 붙인 나무 선반 세 단 — 금 왕관·잔·투구·랜턴·가짜 과일 그릇·두루마리. 아래 2줄 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(4, 46):
        for x in range(1, 31):
            if x in (1, 2, 29, 30): cv.px(x, y, WD[5] if x == 1 else (WD[4] if x == 2 else WD[2])); continue
            cv.px(x, y, (44, 30, 24) if (x + y) % 5 else (52, 36, 28))
    for yb in (16, 30, 45):
        for x in range(1, 31):
            cv.px(x, yb - 2, WD[6] if x < 26 else WD[5]); cv.px(x, yb - 1, WD[4]); cv.px(x, yb, WD[2])
    for x in range(1, 31): cv.px(x, 4, WD[6]); cv.px(x, 5, WD[3])
    def blob(pts, c):
        for (x, y, k) in pts: cv.px(x, y, c[k])
    blob([(5, 12, 5), (6, 11, 6), (7, 12, 5), (8, 11, 6), (9, 12, 5), (5, 13, 4), (6, 13, 4), (7, 13, 4), (8, 13, 4), (9, 13, 3)], GLT)  # 왕관
    for x in range(14, 18):
        for y in range(10, 14): cv.px(x, y, IR[4] if x < 16 else IR[2])                # 투구
    cv.px(15, 9, IR[5]); cv.px(16, 9, IR[4]); cv.px(15, 12, (30, 30, 40)); cv.px(16, 12, (30, 30, 40))
    blob([(22, 10, 5), (23, 10, 5), (22, 11, 4), (23, 11, 3), (22, 12, 4), (22, 13, 3), (21, 13, 4), (24, 13, 2)], GLT)  # 잔
    for y in range(21, 28):                                                          # 랜턴
        for x in range(5, 10): cv.px(x, y, (255, 230, 160) if 5 < x < 9 and 22 < y < 27 else IR[3])
    for (x, y) in ((14, 26), (16, 25), (18, 26), (15, 24), (17, 26)): cv.px(x, y, VEL[5]); cv.px(x + 1, y, (230, 180, 60))
    for x in range(13, 21): cv.px(x, 27, WD[4])
    for y in range(22, 28):
        for x in range(23, 27): cv.px(x, y, CNV[5] if x < 25 else CNV[3])
    for x in range(5, 13): cv.px(x, 41, BLU[4]); cv.px(x, 42, BLU[3])
    for x in range(16, 26): cv.px(x, 40, VEL[4]); cv.px(x, 41, VEL[3]); cv.px(x, 42, VEL[2])
    return shadow_under(fin(cv, .62), 16, 46.5, 15, 1.4, 60)


def sandbag_pile(seed=0):
    """모래주머니 더미 1×1: 무대 막대 평형용 캔버스 모래주머니 셋을 포개 놓은 것. 막힘 1줄."""
    cv = Cv(16, 16)
    for (cx, cy, rx, ry) in ((5, 12, 4.5, 3), (11, 12, 4.5, 3), (8, 8, 4.5, 3)):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d <= 1: cv.px(x, y, CNV[4] if (x < cx and y < cy) else (CNV[3] if d < .6 else CNV[2]))
        cv.px(int(cx + rx) - 1, int(cy) - 1, ROPE[2]); cv.px(int(cx), int(cy - ry) + 1, ROPE[3]); cv.px(int(cx), int(cy - ry) + 2, ROPE[2])
    return shadow_under(fin(cv, .62), 8, 15, 7, 1.2, 60)


def wall_ladder(seed=0):
    """벽 사다리 1×3(16x48, 벽 앞면 장식): 무대 뒤 벽을 따라 천장 대들보 통로로 오르는 나무 사다리, 위쪽은 어둠 속 승강구로 사라진다. 발치 바닥 칸이 위층 이동 칸."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(0, H):
        f = max(0.0, 1 - y / 14.0)
        for (x, k) in ((3, 5), (4, 3), (11, 5), (12, 3)): cv.px(x, y, mix(WD[k], VOIDP[0], f * .8))
        if y % 6 == 3:
            for x in range(5, 11): cv.px(x, y, mix(WD[5] if x < 9 else WD[4], VOIDP[0], f * .8))
            for x in range(5, 11): cv.px(x, y + 1, mix(WD[2], VOIDP[0], f * .8))
    for y in range(0, 4):
        for x in range(2, 14): cv.px(x, y, VOIDP[0])
    return fin(cv, .62)


# ------------------------------------------------------------------ 천장 대들보 통로
def hanging_spot(seed=0):
    """매단 조명 1×1(통로 옆 깊이 위 장식): 통로 난간 관에 죔쇠로 단 검은 원통 조명이 아래 무대를 비춘다 — 위에서 본 뒤통수·냉각 홈·전선."""
    cv = Cv(16, 16)
    for x in range(0, 16): cv.px(x, 1, IR[4]); cv.px(x, 2, IR[2])
    cv.px(7, 3, IR[3]); cv.px(8, 3, IR[2])
    for y in range(4, 14):
        for x in range(4, 12):
            k = cyl_k(x, 4, 12) - 1
            if (y - 4) % 3 == 2: k -= 1
            cv.px(x, y, I7[clamp(k, 1, 5)])
    for x in range(4, 12): cv.px(x, 14, FL[3] if 5 < x < 10 else FL[2])
    for x in range(5, 11): cv.px(x, 15, (255, 236, 170))
    line(cv, 12, 6, 15, 3, (30, 30, 36))
    return fin(cv, .6)


def batten_drop(seed=0):
    """배경막 막대 1×1(16x16, 깊이 위 장식, 가로로 이어 붙임): 쇠관에 말아 올린 캔버스 배경막을 위에서 본 것 — 둥근 두루마리 결과 16px 마다 묶은 끈, 아래로 3/4 그늘."""
    cv = Cv(16, 16)
    for y in range(3, 13):
        t = (y - 3) / 10.0
        k = 4 if t < .15 else (6 if t < .35 else (5 if t < .55 else (4 if t < .75 else 3)))
        for x in range(16):
            kk = k - (1 if (x * 3 + y) % 7 == 0 else 0) - 1
            cv.px(x, y, mul(CNV[clamp(kk, 1, 6)], .72))
    for x in range(16): cv.px(x, 2, IR[4]); cv.px(x, 13, IR[1]); cv.px(x, 14, (16, 14, 26))
    for y in range(2, 14): cv.px(6, y, ROPE[4] if y < 7 else ROPE[2]); cv.px(7, y, ROPE[3] if y < 7 else ROPE[1])
    return cv.im


def beam_span(seed=0):
    """대들보 1×1(16x16, 깊이 위 장식, 가로로 이어 붙임): 무대 위를 가로지르는 굵은 지붕 들보의 윗면(나무 결)과 남쪽 앞면 두께(아래 깊이보다 밝고 통로보다 어둡다)."""
    cv = Cv(16, 16)
    for y in range(1, 15):
        for x in range(16):
            if y < 10:
                t = 4 if y < 3 else 3
                g = grain(x * 3 + 7, y * 2) - 3
                if g >= 2: t += 1
                elif g <= -2: t -= 1
                if y == 1: t = 5
            else:
                t = 2 if y < 12 else 1
            cv.px(x, y, mul(WD[clamp(t, 1, 6)], .8))
    for x in range(16): cv.px(x, 15, (16, 14, 26))
    return cv.im


def counterweight_arbor(seed=0):
    """평형추 틀 1×3(16x48): 바닥 안내 레일 사이 쇠 틀에 쌓은 평형추 벽돌, 꼭대기 쇠줄이 천장 도르래로 오른다. 아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(0, 14): cv.px(7, y, IR[4]); cv.px(8, y, IR[2])
    for y in range(12, 47):
        cv.px(2, y, IR[4]); cv.px(3, y, IR[2]); cv.px(12, y, IR[4]); cv.px(13, y, IR[2])
    for x in range(2, 14): cv.px(x, 12, IR[5]); cv.px(x, 13, IR[3]); cv.px(x, 46, IR[3]); cv.px(x, 47, IR[1])
    for i in range(8):
        y0 = 18 + i * 3 + (i // 3)
        for y in range(y0, y0 + 3):
            for x in range(4, 12):
                k = 4 if y == y0 else (3 if y == y0 + 1 else 1)
                if x == 4: k += 1
                cv.px(x, y, I7[clamp(k, 1, 6)])
    for y in range(14, 18):
        for x in range(4, 12): cv.px(x, y, (24, 22, 30))
    for y in range(43, 46):
        for x in range(4, 12): cv.px(x, y, IR[2])
    return shadow_under(fin(cv, .58), 8, 47, 7, 1.2, 60)


def rope_coil(seed=0):
    """밧줄 사리 1×1(바닥 장식): 바닥에 둥글게 사려 놓은 삼 밧줄."""
    cv = Cv(16, 16)
    for r in (5.5, 4.2, 2.9):
        for a in range(0, 360, 6):
            t = math.radians(a)
            x = 8 + math.cos(t) * r; y = 9 + math.sin(t) * r * .65
            cv.px(int(x), int(y), ROPE[5 if math.sin(t) < 0 and math.cos(t) < .3 else (4 if math.sin(t) < .3 else 3)])
            cv.px(int(x), int(y) + 1, ROPE[2])
    line(cv, 13, 10, 15, 13, ROPE[3])
    return shadow_under(fin(cv, .65), 8, 11, 6.5, 3.6, 50)


def spot_winch(seed=0):
    """감는 틀 2×2(32x32): A자 나무 받침 두 개 사이 밧줄을 감은 굵은 나무 북, 쇠 손잡이 바퀴와 멈춤 톱니. 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x0 in (3, 25):
        line(cv, x0 + 2, 6, x0 - 1, 30, WD[5]); line(cv, x0 + 2, 6, x0 + 5, 30, WD[3])
        line(cv, x0, 22, x0 + 4, 22, WD[4])
    for y in range(9, 19):                                                           # 북
        t = (y - 9) / 10.0
        k = 4 if t < .15 else (6 if t < .35 else (5 if t < .55 else (4 if t < .75 else 3)))
        for x in range(6, 26):
            kk = k
            if (x + y) % 3 == 0: cv.px(x, y, ROPE[clamp(kk, 1, 6)]); continue
            cv.px(x, y, ROPE[clamp(kk - 1, 1, 6)])
    for y in range(8, 20): cv.px(6, y, WD[5]); cv.px(25, y, WD[2])
    for a in range(0, 360, 20):                                                      # 손잡이 바퀴
        t = math.radians(a); cv.px(int(29 + math.cos(t) * 2.5), int(13 + math.sin(t) * 5), IR[4])
    cv.px(29, 13, IR[2]); line(cv, 29, 8, 31, 4, IR[3])
    rope_line(cv, 12, 9, 12, 0, 0, 3)
    return shadow_under(fin(cv, .62), 16, 30.5, 14, 1.4, 60)


def hanging_ropes(seed=0):
    """늘어진 밧줄 1×2(16x32, 깊이 위 장식): 위에서 아래 무대로 늘어진 밧줄 둘, 한 줄 끝에 흔들리는 모래주머니."""
    cv = Cv(16, 32)
    rope_line(cv, 4, 0, 5, 31, 1.0, 3); rope_line(cv, 11, 0, 10, 20, .5, 3)
    for y in range(20, 27):
        for x in range(7, 14):
            if ((x + .5 - 10.5) / 3.4) ** 2 + ((y + .5 - 23.5) / 3.4) ** 2 <= 1: cv.px(x, y, CNV[5] if x < 10 else CNV[3])
    cv.px(10, 19, ROPE[4])
    return fin(cv, .62)


def ladder_hatch(seed=0):
    """승강구 사다리 2×1(32x16, 걷기): 통로 바닥 네모 구멍 속으로 내려가는 사다리 꼭대기, 위로 솟은 손잡이 두 개. 가운데 아래 칸이 아래층 이동 칸."""
    cv = Cv(32, 16)
    for y in range(2, 15):
        for x in range(4, 28):
            c = VOIDP[0] if (x + y) % 3 else VOIDP[1]
            if 9 <= x <= 22 and y % 4 == 1: c = WD[4] if x < 19 else WD[3]
            if x in (9, 22): c = WD[5] if x == 9 else WD[3]
            if x < 6 or x > 25 or y < 4 or y > 13: c = WD[2] if y > 13 else WD[5]
            cv.px(x, y, c)
    for x0 in (8, 22):
        for y in range(0, 8): cv.px(x0, y, WD[6] if y < 1 else WD[5]); cv.px(x0 + 1, y, WD[3])
    return fin(cv, .62)
