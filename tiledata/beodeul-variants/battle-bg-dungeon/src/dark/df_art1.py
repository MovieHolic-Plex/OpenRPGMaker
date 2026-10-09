# 마왕성 조각 1: 큰 구조물 (성문·옥좌·다리·기둥)
from df_kit import *
from df_kit import _hash

def obs_fill(cv, x0, y0, x1, y1, seed=0, top=0, lit=True, grain=.08, course=8, bw=16):
    """검은 돌 쌓기 면: 윗면 top 행(밝음) + 앞면 마름돌. 빛 왼쪽 위."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top:
                k = 5 if (y == y0 or x < x0 + 2) else 4
                if (x - x0 + 8 * ((y - y0) // 6 % 2)) % 16 == 0 or (y - y0) % 6 == 5: k -= 1
            else:
                r = (y - y0 - top) // course; off = (r % 2) * (bw // 2)
                t = (x - x0) / max(1, x1 - x0)
                k = 4 if t < .2 else (3 if t < .7 else 2)
                if (y - y0 - top) % course == course - 1 or (x - x0 + off) % bw == bw - 1: k -= 1
                elif (y - y0 - top) % course == 0: k += 1 if lit else 0
            if _hash(x, y, seed) < grain: k += 1 if _hash(y, x, seed + 1) < .5 else -1
            cv.px(x, y, OB[clamp(k)])

def _tower(seed, flip):
    W, H = 48, 64; cv = Cv(W, H)
    obs_fill(cv, 0, 12, W, 62, seed, top=0)
    obs_fill(cv, 0, 0, W, 12, seed + 3, top=12)
    for x in range(W):
        if (x // 5) % 2 == 0: cv.px(x, 0, OB[0]); cv.px(x, 1, OB[0])
        cv.px(x, 11, OB[1])
    cx = 24
    for y in range(22, 44):                                           # 붉은 방패 문장 (글자 아님)
        wd = 7 - max(0, (y - 32) // 3)
        for x in range(cx - wd, cx + wd + 1):
            if wd > 0: cv.px(x, y, RDK[4] if x < cx else RDK[2])
    for (dx, dy) in ((-6, 20), (-5, 19), (-4, 18), (4, 18), (5, 19), (6, 20)): cv.px(cx + dx, dy, OB[6])
    for y in range(24, 40): cv.px(cx, y, OB[6] if y % 2 else GLD[4])
    for y in range(46, 52): cv.px(8 if not flip else 40, y, IRON[3]); cv.px(9 if not flip else 41, y, IRON[1])
    for (dx, dy, k) in ((0, 41, 5), (1, 41, 5), (-1, 42, 4), (0, 42, 6), (1, 42, 5), (0, 43, 4), (1, 43, 3)):
        cv.px((8 if not flip else 40) + dx, dy + 0, LAV[clamp(k, 0, 5)])
    for x in range(W): cv.px(x, 62, OB[2]); cv.px(x, 63, OB[1])
    im = cv.im
    return shadow_under(fin(im, .66), 24, 63, 22, 2, 80)

def gate_tower_left(seed=1):
    """성문 탑(왼쪽) 3×4(48x64): 총안 윗면 + 검은 돌 앞면 + 붉은 방패 문장 + 횃불. 아래 3줄이 막힌다."""
    return _tower(seed, False)
def gate_tower_right(seed=2):
    """성문 탑(오른쪽) 3×4(48x64): 왼쪽 탑의 짝(횃불이 반대쪽)."""
    return _tower(seed + 7, True)

def gate_arch(seed=3, w=4):
    """성문 아치 통로 4×4(64x64): 위 한 줄은 흉벽(걷기+가림), 아래 세 줄은 반쯤 올린 쇠 격자 아래 어두운 통로(걷기)."""
    W, H = w * 16, 64; cv = Cv(W, H); C = (W - 1) / 2.0; R = W / 2.0
    for y in range(0, 16):
        for x in range(W):
            if y < 8 and (x // 6) % 2 == 1: continue
            k = 5 if y < 3 else (4 if y < 8 else 3)
            if y % 8 == 7: k = 1
            if _hash(x, y, seed) < .08: k += 1
            cv.px(x, y, OB[clamp(k)])
    for y in range(16, 64):
        for x in range(W):
            if y < 30 and abs(x - C) > R - (30 - y) * .95:
                cv.px(x, y, OB[4 if x < W / 2 else 3] if (x + y) % 7 else OB[2]); continue
            cv.px(x, y, (10, 6, 16) if y > 24 else (24, 14, 30))
    for y in range(16, 32):
        for x in range(W):
            d = abs(x - C); lim = R - max(0, (30 - y)) * .95
            if lim - 4 < d <= lim: cv.px(x, y, OB[5] if x < W / 2 else OB[4])
    for y in range(30, 64):
        for x in (0, 1, 2, 3, W - 4, W - 3, W - 2, W - 1):
            cv.px(x, y, (OB[5] if x < 2 else OB[4]) if x < W / 2 else (OB[3] if x < W - 2 else OB[2]))
    for x in range(8, W - 6, 4):
        for y in range(17, 40):
            if y < 30 and abs(x - C) > R - 4 - (30 - y) * .95: continue
            cv.px(x, y, IRON[4] if x < W / 2 else IRON[3]); cv.px(x + 1, y, IRON[2])
        cv.px(x, 40, IRON[5]); cv.px(x, 41, IRON[4])
    for y in (22, 30):
        for x in range(6, W - 6):
            if y < 30 and abs(x - C) > R - 5 - (30 - y) * .95: continue
            cv.px(x, y, IRON[4]); cv.px(x, y + 1, IRON[1])
    for x in range(int(C) - 1, int(C) + 3):
        for y in range(16, 22): cv.px(x, y, RDK[4] if x < C else RDK[3])
    return pz.fin(cv.im, .66)

def throne(seed=2):
    """옥좌 단 6×4(96x64): 3단 윗면+앞면 단 위 높은 등받이 검은 옥좌, 붉은 방석. 앞 단 한 줄 중앙에 붉은 카펫 끝."""
    W, H = 96, 64; cv = Cv(W, H)
    # 단 세 개 (폭이 줄어든다): y 아래부터
    tiers = [(2, 94, 52, 62), (10, 86, 42, 52), (20, 76, 32, 42)]
    for (x0, x1, y0, y1) in tiers:
        top = 4
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y < y0 + top: k = 6 if (y == y0 or x < x0 + 2) else 5; k = 5 if (x + y) % 9 == 0 else k
                else:
                    k = 4 if x < x0 + 6 else (3 if x < x1 - 8 else 2)
                    if y == y1 - 1: k = 1
                    if (x - x0) % 16 == 15: k -= 1
                if _hash(x, y, seed) < .07: k += 1 if _hash(y, x, 5) < .5 else -1
                cv.px(x, y, OB[clamp(k)])
    # 카펫 (앞 단 가운데 폭 16)
    for y in range(52, 62):
        for x in range(40, 56): cv.px(x, y, RDK[3] if x < 48 else RDK[2]); 
    for y in range(52, 62): cv.px(40, y, GLD[4]); cv.px(55, y, GLD[3])
    # 옥좌 본체: 등받이 + 팔걸이 + 방석
    mk = Mk(W, H); mk.rect(36, 2, 60, 34); mk.poly([(36, 2), (40, 0), (56, 0), (60, 2)])
    mk.poly([(36, 6), (30, 0), (36, 0)]); mk.poly([(60, 6), (66, 0), (60, 0)])                  # 뿔 두 개
    vol(cv, mk, OB, 28, 68, 4, seed, grain=.1)
    for y in range(8, 30):
        for x in range(40, 56): cv.px(x, y, OB[2] if (x + y) % 13 else OB[1])               # 등받이 안쪽
    for x in range(36, 60): cv.px(x, 2, OB[6] if x < 48 else OB[5])
    for (x0, x1) in ((34, 40), (56, 62)):                                                     # 팔걸이
        for y in range(22, 34):
            for x in range(x0, x1): cv.px(x, y, OB[5] if y < 25 else (OB[3] if x < x0 + 3 else OB[2]))
    for y in range(24, 34):                                                                    # 붉은 방석
        for x in range(40, 56): cv.px(x, y, RDK[4] if y < 27 else (RDK[3] if x < 50 else RDK[2]))
    for x in range(40, 56): cv.px(x, 33, RDK[1])
    # 등받이 위 장식: 붉은 보석
    for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 1), (2, 1), (0, 2), (1, 2)): cv.px(47 + dx, 8 + dy, RDK[5] if dx < 1 else RDK[4])
    cv.px(47, 8, (255, 220, 200))
    return shadow_under(fin(cv, .66), 48, 62, 46, 2, 80)

def drawbridge(seed=3):
    """도개교 2×3(32x48): 두꺼운 널판 + 쇠 테두리 + 양쪽 쇠사슬 난간. 전체 걷기."""
    cv = Cv(32, 48)
    for y in range(0, 48):
        for x in range(3, 29):
            ly = y % 8; k = 5 if ly == 0 else 4
            j = int(_hash(0, y // 8, seed) * 12) + 6
            if x % 13 == j % 13 and ly != 0: k = 1
            if ly == 7: k = 2
            if _hash(x, y, seed + 2) < .08: k -= 1
            if x in (5, 26) and ly in (3, 4): k = 1
            cv.px(x, y, WD[clamp(k, 1, 6)])
    for y in range(0, 48):
        cv.px(2, y, IRON[4]); cv.px(1, y, IRON[2]); cv.px(29, y, IRON[2]); cv.px(30, y, IRON[1])
        if y % 8 in (2, 3): cv.px(0, y, IRON[3]); cv.px(31, y, IRON[3])
    for y in (0, 47):
        for x in range(3, 29): cv.px(x, y, IRON[2])
    return pz.fin(cv.im, .7)

def obs_pillar(seed=4):
    """검은 돌 기둥 1×3: 네모 받침 + 붉은 띠 둘린 원통 + 머리판. 아랫줄만 막힘."""
    H = 48; cv = Cv(16, H); mk = Mk(16, H)
    mk.rect(2, 38, 14, 47); mk.rect(1, 6, 15, 11)
    vol(cv, mk, OB, 1, 15, 4, seed, grain=.08)
    for x in range(2, 14): cv.px(x, 38, OB[6] if x < 7 else OB[5]); cv.px(x, 42, OB[2])
    for x in range(1, 15): cv.px(x, 6, OB[6] if x < 7 else OB[5]); cv.px(x, 10, OB[1])
    for y in range(11, 38):
        for x in range(3, 13):
            t = (x + .5 - 8) / 5; k = 5 if t < -.4 else (4 if t < .1 else (3 if t < .55 else 2))
            if x in (6, 9) and y % 2 == 0: k -= 1
            if _hash(x, y, seed) < .05: k += 1
            cv.px(x, y, OB[clamp(k)])
    for y in (16, 17, 18, 31, 32):
        for x in range(3, 13): cv.px(x, y, RDK[4] if x < 7 else (RDK[3] if x < 10 else RDK[2]))
    for x in range(3, 13): cv.px(x, 15, OB[1]); cv.px(x, 19, OB[1])
    return shadow_under(fin(cv), 8, 47, 7, 1.6, 80)

def obs_pillar_broken(seed=5):
    """부러진 검은 기둥 1×2: 위가 비스듬히 깨진 그루터기와 옆에 굴러 떨어진 조각."""
    cv = Cv(16, 32)
    for y in range(8, 30):
        cut = int(4 * (1 - (y - 8) / 22.0)) if False else 0
        for x in range(3, 13):
            if y < 12 and x - 3 > 4 + (y - 8) * 1.5: continue
            t = (x + .5 - 8) / 5; k = 5 if t < -.4 else (4 if t < .1 else (3 if t < .55 else 2))
            if y < 10: k = 5 if x < 6 else 4
            if _hash(x, y, seed) < .08: k += 1 if _hash(y, x, 3) < .5 else -1
            cv.px(x, y, OB[clamp(k)])
    for x in range(3, 13): cv.px(x, 28, OB[1])
    for y in (16, 17, 18):
        for x in range(3, 13): cv.px(x, y, RDK[4] if x < 7 else RDK[2])
    mk = Mk(16, 32); mk.rect(1, 25, 15, 31); vol(cv, mk, OB, 1, 15, 3, seed)
    return shadow_under(fin(cv), 8, 31, 7, 1.5, 80)

def war_table(seed=6):
    """긴 전술 탁자 2×2(32x32): 검은 판 윗면 + 붉은 천 깔개 + 말 조각 몇 개 + 앞 다리."""
    cv = Cv(32, 32)
    for y in range(8, 30):
        for x in range(1, 31):
            if y < 20: k = 5 if (y == 8 or x < 3) else 4
            else:
                k = 4 if x < 5 else (3 if x < 27 else 2)
                if y > 27: k = 1
            if x in (4, 5, 26, 27) and y > 22: k = 2 if y < 28 else 1
            if 4 < x < 28 and 22 < y < 28 and x not in (4, 5, 26, 27): continue
            cv.px(x, y, OB[clamp(k)])
    for y in range(10, 18):
        for x in range(4, 28): cv.px(x, y, RDK[4] if (x + y) % 9 else RDK[3]) if True else None
    for x in range(4, 28): cv.px(x, 9, RDK[2]); cv.px(x, 18, RDK[1])
    for (x, y, c) in ((8, 12, OB[6]), (9, 12, OB[6]), (8, 13, OB[4]), (9, 13, OB[3]), (15, 14, GLD[5]), (16, 14, GLD[4]), (15, 15, GLD[3]), (21, 11, OB[0]), (22, 11, OB[0]), (21, 12, OB[2]), (22, 12, OB[1]), (12, 15, IRON[5]), (13, 15, IRON[3])):
        cv.px(x, y, c)
    return shadow_under(fin(cv, .66), 16, 29, 14, 2, 80)

def weapon_rack(seed=7):
    """무기대 2×2: 검은 나무 틀에 창 셋 + 검 둘 + 방패 하나."""
    cv = Cv(32, 32)
    for y in range(6, 30):
        for x in (2, 3, 28, 29): cv.px(x, y, OB[4] if x in (2, 28) else OB[2])
    for y in (10, 11, 24, 25):
        for x in range(2, 30): cv.px(x, y, OB[4] if y in (10, 24) else OB[2])
    for x0 in (6, 10, 14):
        for y in range(1, 24): cv.px(x0, y, WD[3]); cv.px(x0 + 1, y, WD[2])
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (0, 2), (1, 2)): cv.px(x0 + dx - 0 + 0, 1 + dy - 2 if False else dy, IRON[5] if dx == 0 else IRON[3])
    for x0 in (19, 23):
        for y in range(3, 23): cv.px(x0, y, IRON[5]); cv.px(x0 + 1, y, IRON[3])
        for x in range(x0 - 2, x0 + 4): cv.px(x, 21, GLD[4] if x < x0 + 1 else GLD[3])
    cv.ell(25, 17, 3, 4, lambda x, y: RDK[4] if x < 25 else RDK[2]) if False else None
    for y in range(12, 22):
        for x in range(24, 28): cv.px(x, y, RDK[4] if x < 26 else RDK[2])
    for y in range(26, 30):
        for x in range(2, 30): cv.px(x, y, OB[2] if y < 29 else OB[1])
    return shadow_under(fin(cv, .66), 16, 29, 14, 1.8, 70)

def treasure_chest_dark(seed=8):
    """검은 보물 상자 1×1: 쇠 테두리 + 붉은 자물쇠, 윗면이 둥글다."""
    cv = Cv(16, 16)
    for y in range(4, 15):
        for x in range(1, 15):
            if y < 8: k = 5 if (y == 4 or x < 3) else 4; 
            else: k = 3 if x < 12 else 2
            if y == 14: k = 1
            if x in (1, 14) or y == 4 or y == 8: k = 1 if y == 14 else 3
            cv.px(x, y, WD[clamp(k + 0, 1, 6)] if False else OB[clamp(k)])
    for x in range(1, 15): cv.px(x, 8, IRON[3]); cv.px(x, 4, IRON[4])
    for y in range(4, 15): cv.px(4, y, IRON[3]); cv.px(11, y, IRON[2])
    for (x, y) in ((7, 8), (8, 8), (7, 9), (8, 9), (7, 10)): cv.px(x, y, RDK[5] if x < 8 else RDK[3])
    return shadow_under(fin(cv, .66), 8, 14, 7, 1.2, 60)

def demon_statue(seed=9):
    """뿔 달린 마왕 석상 2×3(32x48): 날개 편 거대 석상, 붉은 눈, 검은 돌, 받침. 받침 두 칸만 막힘."""
    cv = Cv(32, 48); mk = Mk(32, 48)
    mk.ell(16, 14, 4.6, 5.2); mk.poly([(10, 44), (11, 19), (21, 19), (22, 44)])
    mk.poly([(11, 22), (1, 10), (0, 30), (6, 40), (11, 38)]); mk.poly([(21, 22), (31, 10), (32, 30), (26, 40), (21, 38)])
    mk.poly([(11, 11), (7, 3), (5, 0), (9, 1), (13, 8)]); mk.poly([(21, 11), (25, 3), (27, 0), (23, 1), (19, 8)])    # 뿔
    mk.rect(4, 42, 28, 48)
    vol(cv, mk, OB, 1, 31, 4, seed, grain=.1)
    for (x, y) in ((13, 13), (14, 13), (18, 13), (19, 13)): cv.px(x, y, RDK[5] if x < 16 else RDK[4])
    for x in range(13, 20): cv.px(x, 17, OB[0])
    for y in range(20, 40): cv.px(16, y, OB[5]); cv.px(17, y, OB[2])
    for y in range(14, 38, 4):
        for x in range(3, 10): cv.px(x, y, OB[5] if x < 6 else OB[3])
        for x in range(23, 30): cv.px(x, y, OB[3] if x < 26 else OB[2])
    for x in range(4, 28): cv.px(x, 42, OB[6] if x < 15 else OB[5])
    return shadow_under(fin(cv), 16, 47, 14, 2, 80)

if __name__ == '__main__':
    items = [(f.__name__, f()) for f in (gate_tower_left, gate_tower_right, gate_arch, throne, drawbridge, obs_pillar, obs_pillar_broken, war_table, weapon_rack, treasure_chest_dark, demon_statue)]
    board(items, 4, 4).save(os.path.join(HERE, '..', '..', '..', '..', 'beodeul-kits', '_out-B', 'd1.png'))
