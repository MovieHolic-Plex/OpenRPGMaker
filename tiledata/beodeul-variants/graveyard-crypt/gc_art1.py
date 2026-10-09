# 공동묘지 조각 1: 묘비·십자가·석관·무덤 (손 도트)
from gc_kit import *
from gc_kit import _hash, _pn1

# 묘지 돌: 버들항 돌 램프 + 이끼(잎 램프) 번짐
def moss(cv, mk, seed, amt=.2, ramp=None):
    ramp = ramp or LF
    for y in range(mk.h):
        for x in range(mk.w):
            if not mk.at(x, y): continue
            n = vnoise(x, y, 3, seed + 90)
            low = y > mk.h * .6
            if n > .93 - amt * (1.0 if low else .3) and cv.p[x, y][3]:
                cv.px(x, y, mix(cv.p[x, y][:3], (64, 98, 58), .5))

def tomb_round(seed=1):
    """둥근 머리 묘비 1x1: 윗면 얇은 띠 + 앞면, 앞면에 세로 줄 둘(글자 아님)."""
    cv = Cv(16, 16); mk = Mk(16, 16)
    mk.rect(3, 7, 13, 14); mk.ell(8, 7, 5, 3.3)
    mk.rect(1, 13, 15, 15)                      # 받침 판
    vol(cv, mk, ST, 3, 13, 4, seed)
    for y in range(13, 15):
        for x in range(1, 15): cv.px(x, y, ST[3] if y == 13 else ST[2])
    for x in range(2, 14): cv.px(x, 13, ST[4] if x < 6 else ST[3])
    for y in (7, 8, 9, 10): cv.px(8, y, ST[2])
    cv.hline(6, 11, 8, ST[2])
    cv.hline(5, 11, 11, ST[3])
    moss(cv, mk, seed)
    return shadow_under(fin(cv), 8, 15, 8, 1.5, 70)

def tomb_cross(seed=2):
    """석조 십자가 비석 1x2: 계단 받침 + 가는 기둥 + 가로대, 가로대 윗면이 보인다."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.rect(6, 7, 10, 25)                       # 기둥
    mk.rect(2, 11, 14, 15)                      # 가로대 앞면
    mk.rect(6, 4, 10, 7)
    mk.rect(3, 25, 13, 28); mk.rect(1, 28, 15, 31)  # 받침 2단
    vol(cv, mk, ST, 1, 15, 4, seed, rim=True)
    for x in range(2, 14): cv.px(x, 10, ST[5] if x < 8 else ST[4])            # 가로대 윗면
    for x in range(6, 10): cv.px(x, 3, ST[5] if x < 8 else ST[4])
    for x in range(3, 13): cv.px(x, 25, ST[5] if x < 7 else ST[4])
    for x in range(1, 15): cv.px(x, 28, ST[4] if x < 5 else ST[3])
    for y in range(16, 25): cv.px(7, y, ST[5] if y % 4 else ST[4])
    moss(cv, mk, seed, .35)
    return shadow_under(fin(cv), 8, 31, 8, 1.5, 70)

def tomb_slab(seed=3):
    """낮은 판석 묘비 1x1 + 흙 봉분 쪽."""
    cv = Cv(16, 16); mk = Mk(16, 16)
    mk.rect(4, 5, 12, 11); mk.poly([(4, 5), (6, 3), (10, 3), (12, 5)])
    vol(cv, mk, ST, 4, 12, 4, seed)
    for x in range(5, 11): cv.px(x, 3, ST[5])
    for x in range(4, 12): cv.px(x, 5, ST[5] if x < 8 else ST[4])
    cv.hline(6, 11, 8, ST[2]); cv.hline(6, 10, 9, ST[2])
    # 앞 흙 봉분
    for y in range(10, 16):
        for x in range(1, 15):
            w = 7 - (15 - y) * .35
            if abs(x + .5 - 8) < w - (y - 10) * -.0:
                cv.px(x, y, (86, 62, 44) if (_hash(x, y, 4) < .5) else (110, 82, 58))
    cv.hline(4, 12, 15, (60, 44, 34))
    return shadow_under(fin(cv), 8, 15, 8, 1.2, 60)

def obelisk(seed=4):
    """오벨리스크 1x3: 사각 첨탑. 윗면 삼각 끝 + 앞면 두 쪽 명암 + 받침."""
    cv = Cv(16, 48); 
    for y in range(4, 38):
        wd = 3 + int((y - 4) * 3.6 / 34)
        for x in range(8 - wd, 8 + wd):
            k = 4 if x < 8 - wd * .35 else (3 if x < 8 + wd * .5 else 2)
            if _hash(x, y, seed) < .06: k += 1
            if y % 9 == 0: k -= 1
            cv.px(x, y, ST[clamp(k)])
    for (x, y) in ((8, 1), (7, 2), (8, 2), (7, 3), (8, 3), (9, 3)): cv.px(x, y, ST[6] if x < 8 else ST[5])
    for y in range(4, 7):
        for x in range(8 - (3 if y == 4 else 3), 8 + 3): cv.px(x, y, ST[5] if x < 8 else ST[4])
    mk = Mk(16, 48); mk.rect(3, 38, 13, 41); mk.rect(1, 41, 15, 47)
    vol(cv, mk, ST, 1, 15, 4, seed)
    for x in range(3, 13): cv.px(x, 38, ST[5] if x < 8 else ST[4])
    for x in range(1, 15): cv.px(x, 41, ST[4] if x < 6 else ST[3])
    for y in range(12, 34, 6): cv.px(8, y, ST[1]); cv.px(8, y + 1, ST[1])
    mk2 = Mk(16, 48); mk2.rect(2, 4, 14, 46); moss(cv, mk2, seed, .3)
    return shadow_under(fin(cv), 8, 47, 8, 1.6, 70)

def mourner(seed=5):
    """슬퍼하는 두건 석상 1x2: 두건 쓴 얼굴 없는 인물(앞이 두건 그림자), 받침 위."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.ell(8, 8, 4.2, 4.6); mk.poly([(3, 25), (4, 13), (12, 13), (13, 25)])
    mk.rect(2, 24, 14, 26); mk.rect(1, 26, 15, 31)
    mk.rect(4, 17, 12, 22)                       # 팔을 모은 앞
    vol(cv, mk, ST, 2, 14, 4, seed)
    for y in range(6, 12):                       # 두건 속 그림자
        for x in range(6, 11): cv.px(x, y, ST[1] if y > 6 else ST[2])
    for y in range(14, 17): 
        for x in range(4, 12): cv.px(x, y, ST[3] if x < 8 else ST[2])
    for x in range(1, 15): cv.px(x, 26, ST[4] if x < 6 else ST[3])
    for x in range(2, 14): cv.px(x, 24, ST[5] if x < 7 else ST[4])
    moss(cv, mk, seed, .3)
    return shadow_under(fin(cv), 8, 31, 8, 1.5, 70)

def crypt_chest_tomb(seed=6):
    """상자 무덤 2x2(32x32 중 아래 24): 뚜껑 윗면이 비스듬히 올라간 큰 돌 상자 + 십자 홈."""
    cv = Cv(32, 32); 
    slab(cv, 1, 8, 31, 29, 9, ST, seed)           # D.slab
    for y in range(8, 17):
        for x in range(1, 31): cv.px(x, y, mul(cv.p[x, y][:3], .86))
    cv.hline(2, 30, 17, ST[2])
    for x in range(14, 18):
        for y in range(10, 16): cv.px(x, y, ST[2] if x in (15, 16) else ST[3])   # 세로 홈
    for x in range(10, 22): cv.px(x, 12, ST[2]); 
    for y in range(20, 27): cv.px(6, y, ST[1]); cv.px(25, y, ST[1])
    for x in range(6, 26, 4): cv.px(x, 28, ST[1])
    mk = Mk(32, 32); mk.rect(1, 8, 31, 29); moss(cv, mk, seed, .3)
    return shadow_under(fin(cv), 16, 29, 15, 2, 70)

def grave_mound(seed=7):
    """흙 봉분 + 나무 말뚝 십자(옛 무덤) 1x1."""
    cv = Cv(16, 16)
    for y in range(8, 15):
        for x in range(0, 16):
            w = 7.5 * math.sqrt(max(0, 1 - ((y - 14) / 7.0) ** 2))
            if abs(x + .5 - 8) < w:
                k = 3 if x < 6 else (2 if x < 11 else 1)
                if _hash(x, y, seed) < .12: k += 1
                if y == 8 or (y == 9 and x < 6): k += 1
                cv.px(x, y, mix((60, 42, 32), (128, 96, 66), clamp(k, 0, 4) / 4))
    for y in range(3, 12): cv.px(8, y, WD[3]); cv.px(9, y, WD[2])
    for x in range(5, 12): cv.px(x, 6, WD[3]); cv.px(x, 7, WD[2])
    cv.px(8, 6, WD[4]); cv.px(5, 6, WD[4]); 
    return shadow_under(fin(cv), 8, 14, 7, 1.2, 55)

def open_grave(seed=8):
    """파 놓은 무덤 2x2(32x32): 어두운 구덩이(뒷벽 흙단면이 보인다) + 오른쪽 흙더미에 꽂은 삽."""
    cv = Cv(32, 32)
    DIRT = [(34, 24, 22), (62, 44, 34), (92, 66, 46), (122, 90, 60), (150, 114, 78)]
    # 구덩이 가장자리 흙 (들쭉날쭉)
    for y in range(9, 26):
        for x in range(1, 21):
            edge = min(x - 1, 20 - x, (y - 9) * 1.2, (25 - y) * 1.2)
            wob = _hash(x, y, seed) * 1.8
            if edge + wob < 1.8:
                continue
            ins = 3 <= x <= 18 and 12 <= y <= 22 and edge + wob > 3.2
            if ins:
                d = y - 12
                cv.px(x, y, DIRT[1] if d < 2 else ((22, 14, 20) if d < 5 else (12, 8, 14)))
                if d < 1: cv.px(x, y, DIRT[2])
            else:
                k = 3 if (x < 8 and y < 14) else (2 if y < 20 else 1)
                if y < 12: k += 1
                if _hash(x, y, seed + 2) < .12: k += 1
                cv.px(x, y, DIRT[clamp(k, 0, 4)])
    # 흙더미 (오른쪽 앞)
    for y in range(14, 29):
        for x in range(16, 31):
            w = 7.0 * math.sqrt(max(0, 1 - ((y - 28) / 14.0) ** 2))
            if abs(x + .5 - 23) < w:
                k = 4 if x < 20 else (3 if x < 24 else 2)
                if y > 25: k -= 1
                if _hash(x, y, seed + 4) < .14: k += 1
                cv.px(x, y, DIRT[clamp(k, 0, 4)])
    # 삽 (더미에 꽂힘)
    for y in range(4, 21): cv.px(26, y, WD[4]); cv.px(27, y, WD[2])
    cv.hline(25, 29, 4, WD[5]); cv.px(25, 5, WD[4]); cv.px(29, 5, WD[2])
    for y in range(20, 26):
        for x in range(24, 30):
            if abs(x - 26.5) < 3 - (y - 20) * .35: cv.px(x, y, IRON[4] if x < 27 else IRON[2])
    return shadow_under(fin(cv), 16, 29, 14, 1.5, 55)

def urn_pedestal(seed=9):
    """장례 항아리 받침대 1x2: 사각 받침 위에 배 불룩한 항아리 + 뚜껑."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.rect(4, 22, 12, 28); mk.rect(2, 28, 14, 31); mk.rect(3, 19, 13, 22)
    vol(cv, mk, ST, 2, 14, 4, seed)
    for x in range(3, 13): cv.px(x, 19, ST[5] if x < 7 else ST[4])
    for x in range(2, 14): cv.px(x, 28, ST[4] if x < 6 else ST[3])
    # 항아리
    mu = Mk(16, 32); mu.ell(8, 12, 5.2, 5.4); mu.rect(6, 4, 10, 7); mu.rect(5, 17, 11, 19)
    vol(cv, mu, [(0, 0, 0)] + [PL[1], mix(PL[1], PL[2], .5), PL[2], PL[3], PL[4], PL[5]][:6], 3, 13, 4, seed + 3)
    for x in range(5, 11): cv.px(x, 3, PL[5] if x < 8 else PL[4])
    for x in range(6, 10): cv.px(x, 4, PL[4])
    cv.hline(3, 13, 9, RD[2]); cv.hline(3, 13, 10, RD[2])           # 붉은 띠
    return shadow_under(fin(cv), 8, 31, 7, 1.4, 70)

if __name__ == '__main__':
    fns = [tomb_round, tomb_cross, tomb_slab, obelisk, mourner, crypt_chest_tomb, grave_mound, open_grave, urn_pedestal]
    items = [(f.__name__, f()) for f in fns]
    b = board(items, 9, 5); b.save('/home/main/.t3/worktrees/rpg-zzu/t3code-40fedf8f/tiledata/beodeul-kits/_out-B/t1.png'); print(b.size)
