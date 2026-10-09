from gc_kit import *
from gc_kit import _hash, _pn1
from gc_art1 import moss

CY = [(8, 24, 28), (16, 44, 40), (26, 66, 54), (40, 90, 66), (62, 118, 84), (90, 148, 104)]
def cypress(seed=31):
    """사이프러스 1x3(16x48): 좁은 어두운 불꽃 모양 침엽수. 밑동 한 칸만 막힘."""
    cv = Cv(16, 48)
    for y in range(2, 44):
        f = (y - 2) / 42.0
        wd = 1.5 + 5.2 * math.sin(min(1, f * 1.1) * math.pi * .5) * (1 - .25 * f ** 3)
        wob = (_hash(y // 3, 0, seed) - .5) * 1.6
        for x in range(int(8 - wd + wob), int(8 + wd + wob) + 1):
            t = (x + .5 - 8 - wob) / max(wd, .1)
            k = 4 if t < -.45 else (3 if t < .1 else (2 if t < .6 else 1))
            if _hash(x, y, seed + 1) < .18: k += 1 if _hash(y, x, seed + 2) < .5 else -1
            if (y + x // 2) % 6 == 0: k -= 1
            cv.px(x, y, CY[clamp(k, 0, 5)])
    for y in range(43, 47):
        cv.px(7, y, BARK_[3]); cv.px(8, y, BARK_[3]); cv.px(9, y, BARK_[1])
    return shadow_under(fin(cv, .7), 8, 46, 6, 1.6, 75)
BARK_ = [(27, 16, 36), (46, 36, 38), (70, 56, 52), (98, 80, 66)]

def tomb_leaning(seed=32):
    """기울어진 오래된 비석 1x1: 오른쪽으로 기운 파손된 비석 + 풀."""
    cv = Cv(16, 16); mk = Mk(16, 16)
    mk.poly([(3, 14), (5, 4), (11, 3), (12, 7), (11, 14)])
    vol(cv, mk, ST, 3, 12, 4, seed, grain=.12)
    for x in range(5, 11): cv.px(x, 3 + (x - 5) // 4, ST[5])
    cv.hline(6, 10, 7, ST[1]); cv.px(8, 5, ST[1]); cv.px(8, 6, ST[1]); cv.px(7, 10, ST[2]); cv.px(8, 11, ST[2])
    for x in range(1, 15):
        if _hash(x, 15, seed) < .8: cv.px(x, 14, LF[1]); cv.px(x, 15, LF[0]) if _hash(x, 3, 4) < .5 else None
    for (x, y) in ((2, 13), (3, 12), (12, 13), (13, 12), (13, 13)): cv.px(x, y, LF[2])
    mk2 = Mk(16, 16); mk2.rect(3, 4, 12, 14); moss(cv, mk2, seed, .3)
    return shadow_under(fin(cv), 8, 15, 7, 1.2, 60)

def grass_tuft(seed=33):
    """시든 풀 다발 1x1 (땅 장식): 회녹색 날 몇 가닥."""
    cv = Cv(16, 16)
    for (x0, h, l) in ((4, 7, 1), (6, 9, 0), (8, 8, -1), (10, 6, 1), (12, 5, -1), (7, 5, 1)):
        for t in range(h):
            x = x0 + (l * t // 3); y = 14 - t
            cv.px(x, y, (82, 112, 70) if t > h // 2 else (52, 80, 54))
    for x in range(3, 13): cv.px(x, 14, (40, 60, 44)) if x % 2 else None
    return cv.im

def skeleton_hand(seed=34):
    """흙에서 솟은 해골 손 1x1: 뼈 손가락 넷 + 손목."""
    cv = Cv(16, 16)
    for y in range(11, 16):
        for x in range(2, 14):
            if abs(x + .5 - 8) < 6 - (15 - y) * .3: cv.px(x, y, DIRT_[1] if (x + y) % 3 else DIRT_[2])
    for x0, h in ((5, 5), (7, 7), (9, 6), (11, 4)):
        for t in range(h):
            cv.px(x0, 11 - t, BONE[4] if t % 3 else BONE[3]); cv.px(x0 + 1, 11 - t, BONE[1])
        cv.px(x0, 11 - h, BONE[4])
    for y in range(8, 12):
        for x in range(5, 12): cv.px(x, y, BONE[4] if x < 8 else BONE[3])
    cv.hline(5, 12, 11, BONE[1])
    return shadow_under(fin(cv, .7), 8, 15, 6, 1, 50)
DIRT_ = [(34, 24, 22), (86, 62, 44), (110, 82, 58)]

def wisp(seed=35):
    """도깨비불 1x1 (바닥 위 푸른 불 + 꼬리, 반투명 빛무리 포함)."""
    cv = Cv(16, 16)
    for (x, y, c) in ((8, 5, (200, 252, 244)), (8, 6, (200, 252, 244)), (7, 6, BL_), (9, 6, BL_), (7, 7, BL_), (8, 7, (200, 252, 244)), (9, 7, BL_), (8, 8, BL_), (8, 9, BL2_),
                      (7, 4, BL2_), (8, 4, BL_), (8, 3, BL2_), (7, 8, BL2_), (9, 8, BL2_), (8, 10, (30, 80, 90)), (6, 7, BL2_), (10, 7, BL2_), (7, 9, (30, 80, 90))):
        cv.px(x, y, c)
    return cv.im
BL_ = (110, 210, 200); BL2_ = (60, 150, 160)

def stone_bench(seed=36):
    """묘지 돌 벤치 2x1(32x16): 앉는 판 윗면 + 두 받침 다리. 아랫줄 몸통(두 다리 칸)이 막힌다."""
    cv = Cv(32, 16)
    for x in range(2, 30):
        for y in range(5, 9): cv.px(x, y, ST[5] if y == 5 else (ST[4] if y < 8 else ST[2]))
    for x in range(2, 30): cv.px(x, 5, ST[6]) if x < 16 else None
    for x0 in (4, 22):
        for y in range(9, 15):
            for x in range(x0, x0 + 6): cv.px(x, y, ST[3] if x < x0 + 3 else ST[2])
        for x in range(x0 - 1, x0 + 7): cv.px(x, 14, ST[1])
    return shadow_under(fin(cv), 16, 14, 14, 1.4, 65)

def candle_cluster(seed=37):
    """무덤 앞 작은 초 세 개 1x1 (푸른 불꽃)."""
    cv = Cv(16, 16)
    cv.ell(8, 12.5, 6, 2.2, lambda x, y: ST[3] if x % 3 else ST[2])
    for (x, yb, h) in ((5, 11, 4), (8, 10, 6), (11, 12, 3)):
        for y in range(yb - h, yb): cv.px(x, y, BONE[4]); cv.px(x + 1, y, BONE[2])
        cv.px(x, yb - h - 1, (200, 250, 240)); cv.px(x, yb - h - 2, (110, 210, 200))
    return shadow_under(fin(cv, .8), 8, 14, 6, 1, 50)

if __name__ == '__main__':
    items = [(f.__name__, f()) for f in (cypress, tomb_leaning, grass_tuft, skeleton_hand, wisp, stone_bench, candle_cluster)]
    board(items, 7, 6).save('../../beodeul-kits/_out-B/t5.png')
