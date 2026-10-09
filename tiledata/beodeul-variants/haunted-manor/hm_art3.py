# 폐가 저택 조각 3: 잠긴 문·문틀(통로)·지하 내림/오름 계단, 지하실 포도주 창고(포도주 선반·누운 큰 통·작은 통·통 더미·
# 썩은 상자·지하 돌기둥·깨진 병·포도주 얼룩·쇠 등불·자루). 손 도트, 3/4 시점, 빛 왼쪽 위.
from hm_kit import *
from hm_kit import _hash


def door_locked(seed=0):
    """잠긴 문 2×3(32x48): 벽 앞면 속 뾰족 아치 검은 참나무 쌍여닫이 — 녹슨 쇠띠·경첩, 가운데 X자 쇠사슬과 무거운 자물쇠.
    앞면 3줄을 뚫은 2칸 폭 통로 자리에 놓는다. 아랫줄 2칸 막힘(열쇠 이벤트로 연다)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            ay = 2 + int(10 * (1 - math.sqrt(max(0.0, 1 - ((x + .5 - 16) / 16.0) ** 2))))
            if y < ay: continue
            fr = x < 3 or x > 28 or y < ay + 3
            if fr:                                                              # 청회 돌 문틀
                c = GS[5] if (x < 2 or y == ay) else (GS[4] if x < 3 or y < ay + 2 else GS[3])
                if x > 29: c = GS[2]
                if (y + x // 3) % 6 == 0: c = GS[2]
                cv.px(x, y, c); continue
            lx = x - 3
            c = GW[3] if (lx // 4) % 2 else GW[2]                               # 세로 널
            if lx % 4 == 0: c = GW[1]
            if x in (15, 16): c = OUTL                                          # 두 문짝 사이
            if y in (14, 15, 34, 35): c = RI[3] if y in (14, 34) else RI[1]     # 쇠띠
            if y in (14, 34) and lx % 6 == 2: c = RI[5]                         # 못머리
            cv.px(x, y, c)
    for i in range(22):                                                         # X 쇠사슬
        for (sx, sy, dx) in ((5, 16, 1), (26, 16, -1)):
            x = sx + dx * i; y = sy + int(i * .62)
            cv.px(x, y, RI[4] if i % 2 else RI[2]); cv.px(x, y + 1, RI[1])
    for y in range(25, 33):                                                     # 자물쇠
        for x in range(12, 20):
            c = BRS[4] if x < 15 else (BRS[3] if x < 18 else BRS[2])
            if y == 25: c = BRS[5]
            cv.px(x, y, c)
    for (x, y) in ((13, 22), (13, 23), (13, 24), (18, 22), (18, 23), (18, 24), (14, 21), (15, 21), (16, 21), (17, 21)): cv.px(x, y, RI[3])
    cv.px(15, 28, OUTL); cv.px(16, 28, OUTL); cv.px(15, 29, OUTL)
    return fin(cv, .6)


def doorframe_broken(seed=0):
    """부서진 문틀 2×3(32x48, 걷기): 벽 앞면 속 아치 돌 문틀, 한쪽 경첩에 매달려 비스듬히 열린 썩은 문짝 — 문간은 지나갈 수 있다.
    앞면 3줄을 뚫은 2칸 폭 통로 자리에 놓는다(윗줄 걷기+가림)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            ay = 2 + int(10 * (1 - math.sqrt(max(0.0, 1 - ((x + .5 - 16) / 16.0) ** 2))))
            if y < ay: continue
            fr = x < 3 or x > 28 or y < ay + 3
            if not fr: continue
            c = GS[5] if (x < 2 or y == ay) else (GS[4] if x < 3 or y < ay + 2 else GS[3])
            if x > 29: c = GS[2]
            if (y + x // 3) % 6 == 0: c = GS[2]
            cv.px(x, y, c)
    for y in range(12, 46):                                                     # 열린 문짝(오른쪽 경첩, 안쪽으로 비스듬)
        for x in range(23, 29):
            yy = y - (x - 23) // 2
            if yy < 12 or yy > 44: continue
            c = GW[3] if (x - 23) < 3 else GW[2]
            if x == 23: c = GW[4]
            if yy in (18, 38): c = RI[2]
            cv.px(x, yy, c)
    for (x, y) in ((28, 16), (28, 36)): cv.px(x, y, RI[4])
    return fin(cv, .6)


def cellar_stair_down(seed=0):
    """지하 내림 계단 3×3(48x48): 바닥에 뚫린 돌 계단 구멍 — 양옆 낮은 청회 돌 난간벽, 남쪽 입구에서 북쪽으로 어둠 속에 잠기는 6단,
    벽에 걸린 녹슨 사슬 손잡이. 가운데 열(아래 2줄) 걷기 = 지하 이동 칸, 양옆 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    for i in range(7):
        y0 = 4 + i * 6
        for y in range(y0, min(46, y0 + 6)):
            for x in range(9, 39):
                ly = y - y0
                c = GS[4] if ly < 2 else (GS[3] if ly < 4 else GS[2])
                if ly == 0: c = GS[5]
                c = mix(c, OUTL, max(0.0, .85 - i * .14))                       # 위로(북쪽) 갈수록 어둠
                if ly < 4 and _hash(x, y, seed + 11) < .08: c = mix(c, MO[3], .5)
                cv.px(x, y, c)
    for side in (0, 1):                                                         # 난간벽(윗면 + 안쪽 앞면)
        xa = 1 if side == 0 else 39
        for y in range(2, 46):
            for x in range(xa, xa + 8):
                c = GS[5] if (x == xa or y == 2) else (GS[4] if x < xa + 6 else GS[3])
                if y % 8 == 7: c = GS[2]
                if y > 40: c = GS[3] if y < 45 else GS[2]
                cv.px(x, y, c)
        for y in range(6, 40, 2): cv.px(xa + (7 if side == 0 else 0), y, RI[3] if y % 4 else RI[1])   # 사슬 손잡이
    for x in range(1, 47): cv.px(x, 46, GS[3]); cv.px(x, 47, GS[2])
    return fin(cv, .6)


def cellar_stair_up(seed=0):
    """지하 오름 계단 3×4(48x64): 지하실 북쪽 벽 앞면을 뚫고 위층으로 오르는 좁은 돌 계단 — 위로 갈수록 밝아지는 단 6개, 양옆 돌 벽,
    꼭대기에 위층 문틈 빛. 가운데 열 걷기(맨 윗줄 = 위층 이동 칸), 양옆 막힘. 아래 2줄은 바닥 위, 위 2줄은 벽 앞면을 뚫은 자리."""
    W, H = 48, 64; cv = Cv(W, H)
    for i in range(9):                                                          # i = 0 꼭대기
        y0 = 4 + i * 6
        for y in range(y0, min(62, y0 + 6)):
            for x in range(10, 38):
                ly = y - y0
                c = GS[5] if ly == 0 else (GS[4] if ly < 3 else (GS[3] if ly < 5 else GS[2]))
                c = mix(c, OUTL, max(0.0, .5 - i * .06)) if i < 3 else c
                if ly < 3 and _hash(x, y, seed + 21) < .07: c = mix(c, MO[3], .5)
                cv.px(x, y, c)
    for y in range(0, 6):                                                       # 꼭대기 문틈 빛
        for x in range(16, 32): cv.px(x, y, AM[2] if y < 2 else (AM[1] if y < 4 else GS[1]))
    for side in (0, 1):
        xa = 0 if side == 0 else 38
        for y in range(0, 62):
            for x in range(xa, xa + 10):
                c = dlib.face_px('mcellar', x + 7, y % 48, 48, 4, False, False)
                if (side == 0 and x == xa + 9) or (side == 1 and x == xa): c = GS[1]
                cv.px(x, y, c)
    for x in range(0, 48): cv.px(x, 62, GS[2]); cv.px(x, 63, GS[1])
    return fin(cv, .6)


def _barrel_body(cv, x0, x1, y0, y1, seed):
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = cyl_k(x, x0, x1)
            c = GW[clamp(k - 1, 1, 6)]
            if (x - x0) % 4 == 3: c = mul(c, .82)
            if y in (y0 + 2, y1 - 3, (y0 + y1) // 2): c = RI[clamp(k - 1, 1, 5)]   # 쇠테
            cv.px(x, y, c)


def barrel_small(seed=0):
    """작은 통 1×1(16x16): 세워 둔 검은 참나무 통, 쇠테 셋, 윗면 뚜껑에 먼지. 막힘."""
    cv = Cv(16, 16)
    _barrel_body(cv, 2, 14, 4, 15, seed)
    topell(cv, 8, 4, 6, 2.2, GW, 4, 3, seed + 31)
    dust_top(cv, 2, 2, 14, 7, seed + 32, .3)
    return shadow_under(fin(cv, .6), 8, 15, 6, 1.0, 60)


def cask_cradle(seed=0):
    """누운 큰 포도주 통 2×2(32x32): 나무 받침대 위 옆으로 누운 큰 통 — 앞쪽 둥근 마구리(나이테 판·쇠테·꼭지), 위로 보이는 몸통 윗면.
    아랫줄 막힘(위 줄은 걷기+가림)."""
    W, H = 32, 32; cv = Cv(W, H)
    for y in range(3, 13):                                                      # 몸통 윗면(뒤로 누운 통)
        for x in range(4, 28):
            c = GW[4] if (x // 3) % 2 else GW[3]
            if y == 3: c = GW[5]
            if x in (9, 22): c = RI[3]
            cv.px(x, y, c)
    cx, cy, r = 16, 18, 12
    for y in range(H):                                                          # 앞 마구리(원)
        for x in range(W):
            d = math.hypot(x + .5 - cx, (y + .5 - cy) * 1.05)
            if d > r: continue
            if d > r - 2: c = RI[3] if (x < cx and y < cy) else RI[1]
            else:
                ring = int(d) % 3
                c = GW[4] if ring == 0 else GW[3]
                if x < cx - 3 and y < cy - 3: c = GW[5] if ring == 0 else GW[4]
                if x > cx + 4 or y > cy + 4: c = mul(c, .8)
                if abs(x + .5 - cx) < 1: c = GW[2]
            cv.px(x, y, c)
    for y in range(22, 26):                                                     # 꼭지
        for x in range(15, 18): cv.px(x, y, BRS[4] if x == 15 else BRS[2])
    cv.px(16, 26, WN[3])
    for x in (4, 26):                                                           # 받침 다리
        for y in range(26, 31):
            for xx in range(x, x + 3): cv.px(xx, y, GW[4] if xx == x else GW[2])
    for x in range(3, 30): cv.px(x, 29, GW[3]); cv.px(x, 30, GW[1])
    return shadow_under(fin(cv, .58), 16, 31, 14, 1.4, 70)


def barrel_stack(seed=0):
    """통 더미 2×2(32x32): 누운 작은 통 셋을 피라미드로 쌓았다(앞 마구리 셋 + 쐐기). 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for (cx, cy) in ((16, 10), (8, 22), (24, 22)):
        r = 7.5
        for y in range(H):
            for x in range(W):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                if d > r: continue
                if d > r - 1.6: c = RI[3] if (x < cx and y < cy) else RI[1]
                else:
                    c = GW[4] if int(d) % 3 == 0 else GW[3]
                    if x > cx + 2 or y > cy + 2: c = mul(c, .8)
                cv.px(x, y, c)
        cv.px(cx, cy, GW[1]); cv.px(cx + 1, cy, GW[1])
    for (x, y) in ((15, 29), (16, 29), (17, 29), (16, 28)): cv.px(x, y, GW[2])
    return shadow_under(fin(cv, .58), 16, 31, 14, 1.4, 70)


def wine_rack(seed=0):
    """포도주 선반 2×3(32x48): 벽에 붙인 마름모 칸 검은 참나무 선반, 칸마다 누운 녹색 병(둥근 병 바닥·빛 한 점), 몇 칸은 비고 하나는
    깨졌다, 위 구석 거미줄. 아랫줄 2칸만 막힘(위 2줄 걷기+가림)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(0, 4):
        for x in range(0, 32): cv.px(x, y, GW[5] if y == 0 or x == 0 else (GW[4] if x < 30 else GW[3]))
    for y in range(4, 44):
        for x in range(0, 32):
            if x < 2 or x > 29: cv.px(x, y, GW[4] if x == 0 else (GW[3] if x < 2 else GW[2])); continue
            u = (x - 2 + y - 4) % 8; v = (x - 2 - (y - 4)) % 8
            if u == 0: cv.px(x, y, GW[5]); continue
            if v == 0: cv.px(x, y, GW[4]); continue
            cv.px(x, y, GW[2] if (u + v) % 3 else GW[1])
    for cy in range(8, 44, 4):
        for cx in range(2 + ((cy - 4) % 8 == 0) * 4, 30, 8):
            cx2 = cx + 4 if (cy // 4) % 2 else cx
            if not (3 < cx2 < 29): continue
            r = _hash(cx2, cy, seed + 41)
            if r < .14: continue                                                # 빈칸
            col = BOT if r > .3 else [mix(c, WN[3], .5) for c in BOT]
            for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                cv.px(cx2 + dx, cy + dy, col[3] if dx + dy < 0 else (col[2] if dx + dy == 0 else col[1]))
            cv.px(cx2 - 1, cy - 1, col[5]); cv.px(cx2, cy, col[4] if r < .93 else col[2])
            if r > .93: cv.px(cx2, cy, GLS[5]); cv.px(cx2 + 1, cy + 1, OUTL)       # 깨진 병
    for y in range(44, 48):
        for x in range(0, 32): cv.px(x, y, GW[4] if y == 44 else (GW[3] if y < 47 else GW[1]))
    dust_top(cv, 0, 0, 32, 4, seed + 42, .45)
    web_corner(cv, 2, 4, 6, seed=seed + 43)
    return fin(cv, .55)

def crate_rotten(seed=0, stack=1):
    """썩은 상자 1×1 / 1×2(쌓음): 널 사이가 벌어진 검은 참나무 상자, 모서리 쇠, 한쪽 널이 부러져 짚이 삐져나왔다. 막힘."""
    H = 16 * stack; cv = Cv(16, H)
    for s in range(stack):
        oy = H - 16 * (s + 1)
        for y in range(oy + 3, oy + 16):
            for x in range(1, 15):
                if y < oy + 7:
                    c = GW[5] if (y == oy + 3 or x == 1) else GW[4]
                    if (x - 1) % 5 == 4: c = GW[2]
                else:
                    c = GW[3] if (y - oy) % 4 else GW[1]
                    if x == 1: c = GW[4]
                    if x > 12: c = GW[2]
                if x in (1, 14) and y in (oy + 7, oy + 15): c = RI[3]
                cv.px(x, y, c)
        if (s + seed) % 2 == 0:
            for (x, y) in ((9, oy + 10), (10, oy + 10), (10, oy + 11), (11, oy + 9), (9, oy + 11)): cv.px(x, y, (150, 130, 80))   # 짚
            for x in range(8, 13): cv.px(x, oy + 9, OUTL)
        dust_top(cv, 1, oy + 3, 15, oy + 7, seed + 51 + s, .3)
    return shadow_under(fin(cv, .6), 8, H - 1, 7, 1.0, 60)


def cellar_pillar(seed=0):
    """지하 돌기둥 1×3(16x48): 굵고 낮은 청회 마름돌 네모 기둥, 위는 둥근 아치 들보 밑동, 아래로 곰팡이와 젖은 얼룩. 아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    for y in range(0, 46):
        for x in range(1, 15):
            c = dlib.ash(x + seed * 16, y, 7, GS[4], GS[2], bw=14, bh=8, k=1.0)
            if x < 3: c = mix(c, GS[5], .4)
            if x > 12: c = mul(c, .7)
            if y > 30 and vnoise(x, y, 3, seed + 61) > .6: c = mix(c, MO[3], .5)
            cv.px(x, y, c)
    for y in range(0, 4):
        for x in range(0, 16): cv.px(x, y, GS[5] if y == 0 else GS[4])
    for y in range(42, 47):
        for x in range(0, 16): cv.px(x, y, GS[4] if y == 42 else (GS[3] if x < 15 else GS[2]))
    return shadow_under(fin(cv, .6), 8, 47, 7, 1.0, 60)


def bottles_broken(seed=0):
    """깨진 병 1×1(바닥 장식): 쓰러져 깨진 녹색 병 둘, 흩어진 유리, 바닥에 번진 검붉은 포도주 얼룩."""
    cv = Cv(16, 16)
    for y in range(6, 15):                                                      # 얼룩
        for x in range(1, 15):
            d = ((x + .5 - 8) / 7) ** 2 + ((y + .5 - 10.5) / 4) ** 2
            if d < 1 and vnoise(x, y, 3, seed + 71) > .3: cv.px(x, y, WN[2] if d > .5 else WN[1])
    for i in range(7):
        cv.px(3 + i, 7 + i // 3, BOT[2] if i % 2 else BOT[3])
    cv.px(10, 9, BOT[4]); cv.px(9, 9, BOT[2])
    for (x, y) in ((11, 6), (12, 7), (4, 12), (6, 13), (13, 12)): cv.px(x, y, BOT[4])
    for (x, y) in ((12, 11), (13, 11), (12, 12)): cv.px(x, y, BOT[3])
    return cv.im


def wine_stain(seed=0):
    """포도주 얼룩 1×1(바닥 장식, 걷기): 판석 줄눈으로 번져 마른 검붉은 얼룩."""
    cv = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            d = ((x + .5 - 8) / 6.5) ** 2 + ((y + .5 - 8) / 5) ** 2
            v = vnoise(x, y, 2.5, seed + 81)
            if d < 1 and v > .35: cv.px(x, y, WN[2] if v > .55 else WN[1])
    return cv.im


def lantern_floor(seed=0):
    """쇠 등불 1×1(16x16): 바닥에 놓인 녹슨 쇠 등불, 유리 속 호박색 불빛, 손잡이 고리. 막힘."""
    cv = Cv(16, 16)
    for y in range(5, 14):
        for x in range(4, 12):
            c = AM[4] if 5 < x < 10 and 6 < y < 12 else RI[2]
            if x in (4, 11) or y in (5, 13): c = RI[3] if x < 8 else RI[1]
            if x == 7 and 7 < y < 11: c = AM[6]
            cv.px(x, y, c)
    for x in range(5, 11): cv.px(x, 4, RI[4])
    for (x, y) in ((6, 2), (7, 1), (8, 1), (9, 2), (6, 3), (9, 3)): cv.px(x, y, RI[3])
    for x in range(3, 13): cv.px(x, 14, RI[2])
    return shadow_under(fin(cv, .6), 8, 15, 6, 1.0, 60)


def sack_pile(seed=0):
    """자루 더미 1×1(16x16): 묶은 삼베 자루 둘(곰팡이 핀 아랫단), 쏟아진 알갱이. 막힘."""
    cv = Cv(16, 16)
    for (cx, cy, rx, ry) in ((6, 10, 5, 5), (11, 11, 4, 4)):
        for y in range(16):
            for x in range(16):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                if d > 1: continue
                c = (130, 116, 90) if x < cx - 1 else ((108, 96, 76) if x < cx + 2 else (84, 74, 60))
                if y < cy - ry + 2: c = (150, 136, 108)
                if y > cy + ry - 2: c = mix(c, MO[3], .5)
                cv.px(x, y, desat([c], .6)[0])
        cv.px(cx, cy - ry, (70, 60, 46)); cv.px(cx, cy - ry + 1, (60, 52, 40))
    for (x, y) in ((1, 14), (2, 15), (3, 14), (14, 15)): cv.px(x, y, (140, 126, 96))
    return shadow_under(fin(cv, .6), 8, 15, 7, 1.0, 60)
