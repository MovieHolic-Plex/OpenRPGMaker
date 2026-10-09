# 마왕성 조각 2: 소품·벽 장식·함정·계단·문
from df_kit import *
from df_kit import _hash
from df_art1 import obs_fill
FIRE = [LAV[1], LAV[2], LAV[3], LAV[4], LAV[5]]

def candelabra_black(seed=11):
    """검은 쇠 촛대 1×2: 가지 다섯, 붉은 불꽃."""
    cv = Cv(16, 32); mk = Mk(16, 32); mk.rect(4, 25, 12, 30)
    vol(cv, mk, IRON, 4, 12, 3, seed)
    for x in range(4, 12): cv.px(x, 25, IRON[5] if x < 8 else IRON[4])
    for y in range(12, 25): cv.px(7, y, IRON[4]); cv.px(8, y, IRON[1])
    for (x, y) in ((3, 13), (4, 14), (5, 15), (6, 15), (12, 13), (11, 14), (10, 15), (9, 15), (2, 11), (13, 11)): cv.px(x, y, IRON[3] if x < 8 else IRON[2])
    for cx, cy in ((2, 8), (4, 7), (7, 5), (11, 7), (13, 8)):
        for y in range(cy + 1, cy + 4): cv.px(cx, y, BONE[4]); cv.px(cx + 1 if cx < 14 else cx, y, BONE[2])
        cv.px(cx, cy, LAV[4]); cv.px(cx, cy - 1, LAV[5]); cv.px(cx + 1, cy, LAV[2])
    return shadow_under(fin(cv, .7), 8, 30, 5, 1.4, 70)

def brazier_stand(seed=12):
    """높은 화로 기둥 1×2: 검은 기둥 위 큰 접시와 붉은 불길."""
    cv = Cv(16, 32); mk = Mk(16, 32); mk.rect(5, 14, 11, 27); mk.rect(3, 27, 13, 31)
    vol(cv, mk, OB, 3, 13, 4, seed)
    for x in range(3, 13): cv.px(x, 27, OB[5] if x < 8 else OB[4])
    cyl(cv, 8, 12, 6.2, 2.4, 3, IRON, seed=seed)
    cv.ell(8, 12, 5.0, 1.8, lambda x, y: IRON[2]); cv.ell(8, 12.2, 4.4, 1.4, lambda x, y: LAV[1] if (x + y) % 3 else LAV[2])
    for (x, y, k) in ((7, 1, 3), (8, 2, 4), (7, 2, 3), (6, 3, 2), (7, 3, 4), (8, 3, 3), (9, 3, 2), (5, 4, 1), (6, 4, 3), (7, 4, 4), (8, 4, 4), (9, 4, 3), (10, 4, 2), (5, 5, 1), (6, 5, 2), (7, 5, 3), (8, 5, 3), (9, 5, 2), (10, 5, 1), (6, 6, 1), (7, 6, 2), (8, 6, 2), (9, 6, 1), (7, 7, 0), (8, 7, 0), (7, 8, 0), (8, 8, 0), (8, 0, 2)):
        cv.px(x, y, LAV[k + 1] if k < 4 else LAV[5])
    return shadow_under(fin(cv, .7), 8, 31, 6, 1.4, 70)

def banner_dark(seed=13):
    """마왕 깃발 1×3 (벽 앞면 위, 글자 없음): 붉은 천에 검은 뿔 문양 두 개와 가운데 금빛 마름모, 아래 갈라진 끝."""
    cv = Cv(16, 48)
    for x in range(1, 15): cv.px(x, 1, IRON[4] if x < 8 else IRON[2]); cv.px(x, 2, IRON[1])
    cv.px(0, 1, GLD[4]); cv.px(15, 1, GLD[3])
    for y in range(3, 44):
        for x in range(2, 14):
            if y > 36 and ((x - 2) // 3 == 1 or (x - 2) // 3 == 3) and False: continue
            if y > 38 and abs(x - 7.5) < (y - 38) * .9 and False: continue
            if y > 40 and (x - 2) in range(4, 8): continue
            k = 4 if x < 5 else (3 if x < 10 else 2)
            if _hash(x, y, seed) < .08: k += 1
            if y % 8 == 3: k -= 1
            cv.px(x, y, RDK[clamp(k, 0, 6)])
    for y in range(3, 44): cv.px(2, y, RDK[5]); cv.px(13, y, RDK[1])
    for (dx, dy) in ((0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)):                       # 뿔 문양 (왼쪽 / 오른쪽)
        cv.px(4 + dx // 2, 10 + dy, OB[0]); cv.px(11 - dx // 2, 10 + dy, OB[0])
    for y in range(18, 30):
        w = 5 - abs(y - 24) // 2
        for x in range(8 - w, 8 + w): cv.px(x, y, GLD[5] if x < 8 else GLD[3]) if w > 0 else None
    for x in range(6, 10): cv.px(x, 24, RDK[1])
    return pz.fin(cv.im, .72)

def bars_window(seed=14):
    """벽 쇠창살 창 1×1(앞면 위): 어두운 구멍과 세로 창살 셋."""
    cv = Cv(16, 16)
    for y in range(3, 14):
        for x in range(3, 13): cv.px(x, y, (10, 6, 16) if y > 4 else (30, 20, 38))
    for x in (5, 8, 11):
        for y in range(3, 14): cv.px(x, y, IRON[4] if x < 8 else IRON[3]); cv.px(x + 1, y, IRON[1]) if x < 11 else None
    for x in range(2, 14): cv.px(x, 2, OB[5]); cv.px(x, 14, OB[3])
    for y in range(2, 15): cv.px(2, y, OB[5]); cv.px(13, y, OB[2])
    return cv.im

def arrow_slit(seed=15):
    """화살 구멍 1×1: 가는 세로 틈에 붉은 빛이 샌다."""
    cv = Cv(16, 16)
    for y in range(2, 14):
        cv.px(7, y, RDK[4] if 4 < y < 11 else (10, 6, 16)); cv.px(8, y, RDK[2] if 4 < y < 11 else (10, 6, 16))
        cv.px(6, y, OB[1]); cv.px(9, y, OB[1])
    for x in (6, 7, 8, 9): cv.px(x, 1, OB[5]); cv.px(x, 14, OB[3])
    return cv.im

def sconce_red(seed=16):
    """붉은 불꽃 벽 횃불 1×1."""
    cv = Cv(16, 16)
    for y in range(9, 15): cv.px(7, y, IRON[3]); cv.px(8, y, IRON[1])
    for x in range(5, 11): cv.px(x, 8, IRON[4] if x < 8 else IRON[2])
    cv.px(5, 7, IRON[3]); cv.px(10, 7, IRON[2])
    for (x, y, k) in ((7, 2, 3), (7, 3, 4), (8, 3, 4), (6, 4, 3), (7, 4, 5), (8, 4, 4), (9, 4, 3), (6, 5, 2), (7, 5, 4), (8, 5, 4), (9, 5, 2), (7, 6, 2), (8, 6, 2), (7, 7, 1)):
        cv.px(x, y, LAV[clamp(k, 0, 5)])
    return cv.im

def trap_spikes(seed=17):
    """바닥 가시 함정 1×1: 올라온 쇠 가시 다섯과 흰 피 자국 없는 판. 닿으면 피해 이벤트."""
    cv = Cv(16, 16)
    for y in range(1, 15):
        for x in range(1, 15): cv.px(x, y, OB[1] if (x + y) % 5 else OB[2])
    for x in range(1, 15): cv.px(x, 1, OB[4]); cv.px(x, 14, OB[0])
    for (cx, cy) in ((4, 5), (11, 5), (7, 8), (4, 11), (11, 11)):
        for dy in range(0, 5):
            for dx in range(-(2 - dy // 2) if False else -(1 if dy > 1 else 0), (2 if dy > 1 else 1)):
                cv.px(cx + dx, cy + dy - 3, IRON[5] if dx <= 0 and dy < 3 else IRON[3])
        cv.px(cx, cy - 4, IRON[5]); cv.px(cx, cy - 5, IRON[4])
    return pz.fin(cv.im, .72)

def trap_plate(seed=18):
    """압력판 1×1: 살짝 눌린 돌판과 붉은 홈 표시(걷기, 함정 이벤트용)."""
    cv = Cv(16, 16)
    for y in range(2, 14):
        for x in range(2, 14): cv.px(x, y, OB[3] if (x < 4 or y < 4) else OB[2])
    for x in range(2, 14): cv.px(x, 2, OB[5]); cv.px(x, 13, OB[0])
    for (x, y) in ((7, 5), (8, 5), (6, 6), (9, 6), (6, 9), (9, 9), (7, 10), (8, 10)): cv.px(x, y, RDK[4])
    for x in range(5, 11): cv.px(x, 7, RDK[2]); cv.px(x, 8, RDK[1])
    return cv.im

def spike_row(seed=19):
    """말뚝 울타리 2×1(32x16): 뾰족한 검은 말뚝 여덟 개(막힘)."""
    cv = Cv(32, 16)
    for i in range(8):
        x0 = 1 + i * 4
        h = 11 + int(_hash(i, 0, seed) * 3)
        for y in range(16 - h, 15):
            for x in range(x0, x0 + 3):
                cv.px(x, y, OB[4] if x == x0 else (OB[2] if x == x0 + 1 else OB[1]))
        cv.px(x0 + 1, 16 - h - 1, OB[5]); cv.px(x0, 16 - h, OB[5]); cv.px(x0 + 1, 16 - h - 2, OB[4])
    for x in range(0, 32): cv.px(x, 12, IRON[2]); cv.px(x, 11, IRON[3]) if x % 8 else None
    return shadow_under(fin(cv, .7), 16, 14, 14, 1.4, 70)

def cage_floor(seed=20):
    """쇠 우리 2×2: 위가 굽은 쇠창살 우리, 바닥에 뼈. 우리 몸통 막힘."""
    cv = Cv(32, 32)
    for x in range(2, 30): 
        for y in range(8, 11): cv.px(x, y, IRON[4] if y == 8 else IRON[2])
    for x in range(4, 29, 4):
        for y in range(11, 28): cv.px(x, y, IRON[4] if x < 16 else IRON[3]); cv.px(x + 1, y, IRON[1])
    for y in (14, 24):
        for x in range(2, 30): cv.px(x, y, IRON[3]); cv.px(x, y + 1, IRON[1])
    for x in range(2, 30):
        for y in range(27, 30): cv.px(x, y, OB[3] if y == 27 else OB[1])
    for (x, y) in ((8, 26), (9, 26), (10, 25), (18, 26), (19, 26), (20, 26), (21, 25)): cv.px(x, y, BONE[4])
    cv.ell(24, 25, 2, 1.6, lambda x, y: BONE[4]); cv.px(23, 25, DK); cv.px(25, 25, DK)
    for y in range(4, 8): cv.px(15, y, IRON[3]); cv.px(16, y, IRON[1])
    cv.ell(16, 3, 2.4, 2, lambda x, y: IRON[4])
    return shadow_under(fin(cv, .7), 16, 29, 14, 1.6, 70)

def rune_circle(seed=21):
    """마법진 3×3 바닥 장식(48x48): 두 겹 붉은 원 + 별 + 바깥 짧은 눈금(글자 아님). 걷기, 반짝임 없이 평평."""
    cv = Cv(48, 48)
    c = 24
    def ring(r, k0, th=1):
        for a in range(0, 720):
            x = c + r * math.cos(math.radians(a / 2)); y = c + r * .86 * math.sin(math.radians(a / 2))
            for t in range(th): cv.px(int(round(x)), int(round(y)) + t, RDK[k0])
    ring(21, 3, 2); ring(17, 4); ring(10, 3)
    pts = [(c + 17 * math.cos(math.radians(90 + 72 * i)), c + 17 * .86 * math.sin(math.radians(90 + 72 * i))) for i in range(5)]
    for i in range(5):
        a = pts[i]; b = pts[(i + 2) % 5]
        n = int(max(abs(a[0] - b[0]), abs(a[1] - b[1]))) * 2
        for t in range(n + 1): cv.px(int(round(a[0] + (b[0] - a[0]) * t / n)), int(round(a[1] + (b[1] - a[1]) * t / n)), RDK[4])
    for i in range(24):
        a = math.radians(i * 15); x = c + 23 * math.cos(a); y = c + 23 * .86 * math.sin(a)
        cv.px(int(x), int(y), RDK[5]) if i % 2 else None
    cv.ell(c, c, 3, 2.6, lambda x, y: RDK[5] if x < c else RDK[4])
    return cv.im

def beast_skull(seed=22):
    """거대한 뿔 짐승 해골 2×2: 굵은 이마, 옆으로 굽어 올라간 뿔 둘, 긴 주둥이, 빈 눈구멍. 막힘 1줄."""
    cv = Cv(32, 32)
    mk = Mk(32, 32); mk.ell(15, 19, 8.5, 6.5); mk.poly([(20, 15), (30, 18), (31, 24), (23, 27), (19, 25)])
    mk.poly([(9, 13), (3, 14), (1, 11), (1, 6), (3, 8), (4, 11), (8, 11)]); mk.poly([(21, 13), (27, 14), (29, 11), (29, 6), (27, 8), (26, 11), (22, 11)])
    vol(cv, mk, BONE, 2, 30, 3, seed, grain=.1)
    for (x, y) in ((9, 18), (10, 18), (9, 19), (10, 19), (16, 18), (17, 18), (16, 19), (17, 19)): cv.px(x, y, DK)
    cv.px(27, 20, DK); cv.px(28, 20, DK)
    for x in range(21, 30, 2):
        for y in (24, 25): cv.px(x, y, BONE[4])
    for x in range(8, 24): cv.px(x, 13, BONE[2]) if x % 3 else None
    return shadow_under(fin(cv, .7), 16, 28, 12, 2, 70)

def chandelier(seed=23):
    """쇠 샹들리에 3×2(48x32, 위층 장식): 사슬에 매달린 굵은 쇠 고리와 불 켜진 초 다섯 개. 아래로 지나갈 수 있다."""
    cv = Cv(48, 32)
    for y in range(0, 12): cv.px(24, y, IRON[4] if y % 2 else IRON[2]); cv.px(25, y, IRON[1])
    for a in range(0, 360, 2):
        x = 24 + 17 * math.cos(math.radians(a)); y = 20 + 5.2 * math.sin(math.radians(a))
        k = IRON[5] if a > 180 and a < 270 else (IRON[4] if a > 180 else IRON[2] if a < 90 else IRON[3])
        cv.px(int(x), int(y), k); cv.px(int(x), int(y) + 1, IRON[1] if a < 180 else IRON[3])
    for cx in (9, 16, 24, 32, 39):
        cy = 20 + int(5.2 * math.sin(math.acos(max(-1, min(1, (cx - 24) / 17.0))))) - 1
        for y in range(cy - 4, cy): cv.px(cx, y, BONE[4]); cv.px(cx + 1, y, BONE[2])
        cv.px(cx, cy - 5, LAV[4]); cv.px(cx, cy - 6, LAV[5]); cv.px(cx + 1, cy - 5, LAV[2])
    return pz.fin(cv.im, .72)

def stairs_black_down(seed=24):
    """아래로 내려가는 검은 돌 계단 2×2(32x32): 테두리 + 붉은 빛이 아래에서 올라오는 다섯 단. 걷기."""
    cv = Cv(32, 32)
    for y in range(32):
        for x in range(32):
            if x < 3 or x > 28 or y < 3:
                k = 5 if (x < 3 or y < 3) and x < 16 else 4
                if x > 28 and y > 2: k = 3
                cv.px(x, y, OB[k]); continue
            b = (y - 3) // 6; ly = (y - 3) % 6
            dark = 1.0 - .17 * b
            c = mul(OB[5 if b < 2 else 4], dark) if ly < 2 else mul(OB[2], dark * (.85 if ly > 3 else 1.0))
            if x < 5 or x > 26: c = mul(c, .62)
            if b >= 3: c = mix(c, (110, 20, 24), .22 * (b - 2))
            cv.px(x, y, c)
    for x in range(0, 32): cv.px(x, 0, OB[6] if x < 20 else OB[5])
    for y in range(0, 32): cv.px(0, y, OB[6]); cv.px(31, y, OB[2])
    return pz.fin(cv.im, .66)

def stairs_black_up(seed=25):
    """벽 앞면에서 올라가는 검은 돌 계단 2×3(32x48, 앞면 위): 위쪽 어둠으로 오르는 층, 양옆 돌 난간."""
    cv = Cv(32, 48)
    for y in range(48):
        for x in range(32):
            if y < 8:
                cv.px(x, y, mix((10, 6, 16), OB[0], y / 8.0) if 3 < x < 28 else OB[2]); continue
            if x < 3 or x > 28:
                cv.px(x, y, OB[4] if x < 16 else OB[2]); continue
            b = (y - 8) // 8; ly = (y - 8) % 8
            c = OB[clamp(2 + b)]
            if ly == 0: c = OB[clamp(3 + b)]
            if ly == 7: c = OB[1]
            if _hash(x, y, seed) < .06: c = mul(c, 1.12)
            cv.px(x, y, c)
    return cv.im

def armor_statue(seed=26):
    """갑옷 석상 1×2: 투구 쓴 기사, 두 손으로 짚은 검, 붉은 술. 아랫줄만 막힘."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.ell(8, 8, 3.4, 3.6); mk.poly([(4, 27), (4, 13), (12, 13), (12, 27)]); mk.rect(3, 27, 13, 31); mk.rect(7, 2, 9, 4)
    vol(cv, mk, OB, 3, 13, 4, seed, grain=.1)
    for y in range(7, 10): cv.px(7, y, OB[0]); cv.px(8, y, OB[0]) if y == 8 else None
    for x in range(6, 11): cv.px(x, 8, OB[0])
    for y in range(14, 30): cv.px(8, y, IRON[5]) if y > 18 else None
    for x in range(5, 12): cv.px(x, 18, IRON[4])
    for (dx, dy) in ((0, 0), (1, 0), (0, 1)): cv.px(8 + dx, 4 + dy, RDK[4])
    for x in range(4, 12): cv.px(x, 13, OB[6] if x < 8 else OB[5])
    return shadow_under(fin(cv), 8, 31, 7, 1.4, 70)

def door_double(seed=27):
    """큰 이중 철문 2×3(32x48, 앞면 위): 검은 철판 두 짝, 붉은 띠, 쇠고리 손잡이, 위 아치 돌."""
    cv = Cv(32, 48)
    for y in range(3, 48):
        for x in range(1, 31):
            if y < 12 and abs(x - 15.5) > 10 + (y - 3) * 1.0 and False: continue
            fr = x in (1, 2, 29, 30) or y in (3, 4)
            if fr: cv.px(x, y, OB[5] if x < 16 else OB[3]); continue
            k = 3 if x < 16 else 2
            if x == 15 or x == 16: k = 1
            if (y - 5) % 10 == 0: k = 1
            if _hash(x, y, seed) < .07: k += 1
            cv.px(x, y, IRON[clamp(k + 0, 1, 5)] if False else OB[clamp(k + 1)])
    for y in (12, 13, 14, 35, 36, 37):
        for x in range(3, 29):
            if x not in (15, 16): cv.px(x, y, RDK[4] if x < 15 else RDK[2])
    for (cx) in (12, 19):
        cv.ell(cx, 28, 2.2, 2.2, lambda x, y: GLD[4] if x < cx else GLD[3]); cv.px(cx, 28, DK)
    for x in range(0, 32): cv.px(x, 3, OB[6]) if x < 16 else cv.px(x, 3, OB[5])
    return pz.fin(cv.im, .72)

def door_iron_black(seed=28):
    """작은 철문 1×2(앞면 위): 검은 판 문과 붉은 문고리 장식."""
    cv = Cv(16, 32)
    for y in range(3, 32):
        for x in range(1, 15):
            fr = x in (1, 14) or y in (3, 4)
            if fr: cv.px(x, y, OB[5] if x < 8 else OB[3]); continue
            k = 2 if x < 8 else 1
            if (y - 5) % 8 == 0: k = 0
            if x == 7 or x == 8: k = max(0, k - 1) if False else k
            cv.px(x, y, OB[clamp(k + 1, 0, 6)])
    for y in (10, 11, 24, 25):
        for x in range(3, 13): cv.px(x, y, IRON[4] if y in (10, 24) else IRON[1])
    cv.ell(11, 18, 1.8, 1.8, lambda x, y: RDK[5]); 
    return cv.im

def altar_dark(seed=29):
    """흑요석 제단 2×2: 검은 판 윗면에 붉은 홈과 피 담긴 그릇, 앞면 부조 줄."""
    cv = Cv(32, 32)
    for y in range(8, 29):
        for x in range(1, 31):
            if y < 18: k = 5 if (y == 8 or x < 4) else 4
            else:
                k = 4 if x < 6 else (3 if x < 26 else 2)
                if y > 26: k = 1
            if _hash(x, y, seed) < .06: k += 1
            cv.px(x, y, OB[clamp(k)])
    for x in range(4, 28): cv.px(x, 18, OB[1])
    for x in range(8, 24): cv.px(x, 12, RDK[3]) if x % 5 else None
    cv.ell(16, 13, 4.2, 2.2, lambda x, y: IRON[3]); cv.ell(16, 13.4, 3.2, 1.4, lambda x, y: RDK[3] if (x + y) % 3 else RDK[4])
    for x in range(6, 26, 4):
        for y in range(21, 26): cv.px(x, y, OB[1]); cv.px(x + 1, y, OB[5] if x < 16 else OB[4])
    for (x, y) in ((6, 10), (25, 10)): cv.px(x, y, LAV[4]); cv.px(x, y - 1, LAV[5])
    return shadow_under(fin(cv, .66), 16, 28, 14, 2, 80)

def crystal_red(seed=30):
    """붉은 마석 결정 1×2: 어두운 바닥에서 솟은 네모 결정 둘, 안쪽이 빛난다. 아랫줄 막힘."""
    cv = Cv(16, 32)
    for (x0, x1, y0, y1) in ((3, 8, 10, 28), (8, 13, 4, 30)):
        for y in range(y0, y1):
            w = x1 - x0 - (0 if y > y0 + 4 else (y0 + 4 - y))
            for x in range(x0, x0 + max(1, w)):
                t = (x - x0) / max(1, x1 - x0)
                k = 5 if t < .3 else (4 if t < .65 else 3)
                if y < y0 + 3: k = 6 if x < x0 + 2 else 5
                cv.px(x, y, RDK[clamp(k, 0, 6)])
    for (x, y) in ((5, 14), (5, 15), (10, 10), (10, 11), (10, 12)): cv.px(x, y, (255, 230, 210))
    mk = Mk(16, 32); mk.rect(1, 27, 15, 31); vol(cv, mk, OB, 1, 15, 3, seed)
    return shadow_under(fin(cv, .7), 8, 31, 7, 1.4, 70)

def chain_hang(seed=31):
    """늘어진 쇠사슬 1×2(앞면 위): 천장에서 내려오는 사슬 둘과 수갑."""
    cv = Cv(16, 32)
    for cx, l in ((5, 22), (11, 16)):
        for y in range(0, l):
            if y % 3 == 0: cv.px(cx - 1, y, IRON[4]); cv.px(cx + 1, y, IRON[2]); cv.px(cx, y, IRON[3])
            else: cv.px(cx, y, IRON[3]); cv.px(cx, y, IRON[4] if y % 3 == 1 else IRON[2])
        cv.ell(cx, l + 2, 2.4, 2.4, lambda x, y: IRON[3]); cv.px(cx, l + 2, (0, 0, 0, 0)[:3] if False else DK)
    return cv.im

def lava_vent(seed=32):
    """작은 용암 분출구 1×1: 검은 바위 틈에서 붉은 빛과 불꽃. 걷기 불가."""
    cv = Cv(16, 16)
    cv.ell(8, 11, 6.5, 3.4, lambda x, y: OB[3] if x < 6 else OB[2]); cv.ell(8, 11, 4.6, 2.2, lambda x, y: LAV[2] if (x + y) % 3 else LAV[3])
    for (x, y, k) in ((7, 4, 3), (8, 5, 4), (7, 5, 3), (6, 6, 2), (7, 6, 4), (8, 6, 3), (9, 6, 2), (7, 7, 2), (8, 7, 2), (7, 8, 1), (8, 8, 1)):
        cv.px(x, y, LAV[clamp(k, 0, 5)])
    return shadow_under(fin(cv, .7), 8, 14, 7, 1.2, 60)

def red_glow(): return glow(64, (255, 90, 50), 56)

def battlement(seed=33):
    """성벽 총안 1×1(위층 장식): 벽 윗면 위로 솟은 두 개의 톱니."""
    cv = Cv(16, 16)
    for (x0, x1) in ((1, 6), (9, 14)):
        for y in range(7, 14):
            for x in range(x0, x1): cv.px(x, y, OB[5] if (y < 9 or x == x0) else (OB[4] if x < x1 - 2 else OB[2]))
        for x in range(x0, x1): cv.px(x, 13, OB[1])
    return pz.fin(cv.im, .72)

if __name__ == '__main__':
    fns = (candelabra_black, brazier_stand, banner_dark, bars_window, arrow_slit, sconce_red, trap_spikes, trap_plate, spike_row, cage_floor, rune_circle, beast_skull, chandelier, stairs_black_down, stairs_black_up, armor_statue, door_double, door_iron_black, altar_dark, crystal_red, chain_hang, lava_vent, battlement)
    items = [(f.__name__, f()) for f in fns]
    board(items, 8, 4).save(os.path.join(HERE, '..', '..', 'beodeul-kits', '_out-B', 'd2.png'))
