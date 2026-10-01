"""초가집·대문·돌담·소품·나무·정자·다리."""
from tk import *
from build import *
import math


# ---------- 공통 ----------
def blob(cv, cx, cy, rx, ry, ramp, seed=0, base=4, rough=0.25, lit=1.0):
    """왼쪽 위에서 빛을 받는 덩어리(수관·바위). 가장자리는 거칠게."""
    r = RGB[ramp]
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            ang = math.atan2(dy, dx)
            wob = 1 + rough * (rnd(int(ang * 9) + 50, seed, 3) - 0.5) * 2
            d = math.hypot(dx, dy) / wob
            if d > 1:
                continue
            v = -0.55 * dx - 0.75 * dy          # 왼쪽 위가 +
            idx = base + (1 if v > 0.35 else 0) + (1 if v > 0.75 else 0) - (1 if v < -0.2 else 0) - (1 if v < -0.6 else 0)
            q = rnd(x, y, seed + 7)
            if q < 0.15: idx -= 1
            elif q > 0.9: idx += 1
            if d > 0.88: idx -= 1
            cv.put(x, y, r[max(1, min(6, idx))])


def ground_shadow(cv, cx, cy, rx, ry, al=80):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if 0 <= x < cv.w and 0 <= y < cv.h and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and cv.a[y, x, 3] == 0:
                cv.put(x, y, SHADOW, al)


# ---------- 초가집 ----------
def thatch_house(seed=0):
    W, H = 6 * T, 5 * T
    cv = Cv(W, H)
    th = RGB['thatch']; ea = RGB['earth']; wd = RGB['wood']; pl = RGB['plaster']
    # 굴뚝(지붕 뒤)
    cv.rect(74, 2, 83, 22, ea[4]); cv.rect(74, 2, 76, 22, ea[5]); cv.rect(81, 2, 83, 22, ea[2]); cv.rect(75, 0, 82, 3, ea[1]); cv.hl(74, 83, 3, ea[3])
    # 지붕: 둥근 어깨의 사다리꼴
    sil = [(18, 6), (78, 6), (88, 11), (93, 22), (94, 38), (2, 38), (3, 22), (8, 11)]

    def roof(x, y):
        v = 1 - (x / W)                       # 왼쪽이 밝다
        idx = 4 + (1 if v > 0.6 else 0) - (1 if v < 0.3 else 0)
        q = rnd(x, y, 11 + seed)
        row = (y - 8) % 5
        if row == 4: idx -= 1               # 볏짚 단 사이 그늘
        if q < 0.12: idx -= 1
        elif q > 0.9: idx += 1
        if y < 12: idx -= 0
        return th[max(1, min(6, idx))]
    fillpoly(cv, sil, roof)
    # 새끼줄 그물(대각선)
    for y in range(10, 36):
        for x in range(8, 90):
            if ((x + y) % 11 == 0 or (x - y) % 11 == 0) and cv.a[y, x, 3]:
                cv.put(x, y, th[2])
    # 용마름(마루 덮개)
    for x in range(17, 79):
        for y in range(4, 10):
            col = th[5] if y < 6 else th[3]
            if (x + y) % 4 == 0: col = th[2]
            cv.put(x, y, col)
    cv.hl(17, 79, 4, th[6])
    # 처마 끝: 들쭉날쭉
    for x in range(2, 95):
        ln = 3 + int(rnd(x, 1, 5 + seed) * 3)
        for j in range(ln):
            cv.put(x, 36 + j, th[3 if j < 1 else 2] if (x // 2 + j) % 2 else th[4] if j == 0 else th[2])
    # 처마 그늘
    for x in range(8, 88):
        cv.put(x, 40, wd[1]); cv.put(x, 41, wd[2])
    # 벽(황토)
    for y in range(42, 64):
        for x in range(8, 88):
            q = rnd(x, y, 20 + seed)
            cv.put(x, y, ea[5] if q > 0.18 else ea[4])
    for x in (8, 38, 57, 86):
        column(cv, x, 42, 64, 'wood', 3)
    # 방문(문살)과 작은 창
    lattice(cv, 41, 46, 55, 63, door=True, seed=2)
    lattice(cv, 14, 49, 30, 59, seed=3)
    lattice(cv, 64, 49, 80, 59, seed=4)
    # 낮은 돌 기단
    for y in range(64, 71):
        for x in range(6, 90):
            q = rnd(x, y, 30)
            cv.put(x, y, RGB['stone'][4] if q > 0.3 else RGB['stone'][3])
    cv.hl(6, 90, 64, RGB['stone'][6]); cv.hl(6, 90, 70, RGB['stone'][2])
    for x in range(10, 90, 11): cv.vl(x, 65, 70, RGB['stone'][2])
    # 마루/댓돌
    cv.rect(38, 71, 58, 74, RGB['stone'][5]); cv.hl(38, 58, 71, RGB['stone'][6]); cv.hl(38, 58, 73, RGB['stone'][3])
    outline(cv)
    shadow(cv, 8, 90, 74, 3, 70)
    return cv


# ---------- 대문 ----------
def gate(tiles=6):
    """솟을대문 비슷한 기와 대문. 폭 tiles 칸(짝수면 문짝 사이 경계가 칸 경계에 선다)."""
    W, H = tiles * T, 4 * T
    cv = Cv(W, H)
    hip_roof(cv, 2, W - 2, 3, 28, inset=9)
    wd = RGB['wood']; st = RGB['stone']
    for x in range(10, W - 10):
        cv.put(x, 28, wd[1]); cv.put(x, 29, wd[1])
    dan(cv, 10, W - 10, 30, 3)
    for y in range(33, 56):
        for x in range(10, W - 10):
            cv.put(x, y, wd[2] if rnd(x, y, 3) > 0.985 else wd[1])
    cv.rect(10, 33, W - 10, 35, wd[4])
    c = W // 2
    column(cv, 10, 33, 58, 'wood', 4); column(cv, W - 14, 33, 58, 'wood', 4)
    column(cv, c - 16, 35, 58, 'wood', 3); column(cv, c + 13, 35, 58, 'wood', 3)
    for (a, b) in ((c - 13, c - 1), (c + 1, c + 13)):
        for y in range(36, 57):
            for x in range(a, b + 1):
                cv.put(x, y, wd[4] if (x - a) % 4 else wd[3])
        cv.vl(a, 36, 57, wd[5])
    cv.vl(c - 1, 36, 57, wd[1]); cv.vl(c, 36, 57, wd[1]); cv.hl(c - 13, c + 14, 44, wd[2]); cv.hl(c - 13, c + 14, 49, wd[2])
    for dx in (-10, -4, 3, 9):
        for y in (40, 52):
            cv.put(c + dx, y, RGB['thatch'][6])
    cv.put(c - 3, 46, st[5]); cv.put(c - 3, 47, st[4]); cv.put(c + 2, 46, st[5]); cv.put(c + 2, 47, st[4])
    stone_face(cv, 6, 58, W - 6, 64, rowh=6, seed=5)
    cv.hl(6, W - 6, 57, RGB['stone'][6])
    outline(cv)
    return cv


# ---------- 돌담 ----------
def wall_h(x0=0, x1=T, seed=0):
    cv = Cv(T, T)
    g = RGB['giwa']; ea = RGB['earth']; s = RGB['stone']
    # 몸통: 토석담
    for y in range(8, 15):
        for x in range(x0, x1):
            ri = (y - 8) // 3
            sx = (x + ri * 3 + seed) % 6
            q = rnd((x + ri * 3 + seed) // 6, ri, 40 + seed)
            col = s[3] if q < 0.35 else (s[4] if q < 0.75 else s[5])
            if sx == 0 or (y - 8) % 3 == 2: col = ea[3]
            if sx == 1 and (y - 8) % 3 == 0: col = s[6] if col != ea[3] else col
            cv.put(x, y, col)
    cv.hl(x0, x1, 15, SHADOW) if False else None
    # 기와 얹은 덮개
    for x in range(x0, x1):
        cv.put(x, 4, g[6]); cv.put(x, 5, g[5]); cv.put(x, 6, g[4] if (x % 4) < 2 else g[3]); cv.put(x, 7, g[2] if (x % 4) < 2 else g[1])
        cv.put(x, 3, g[5] if x % 4 < 2 else g[4])
    return cv


def wall_v():
    """세로로 뻗은 담(위에서 본 덮개 띠 + 옆면)."""
    cv = Cv(T, T)
    g = RGB['giwa']; ea = RGB['earth']; s = RGB['stone']
    for y in range(T):
        # 덮개 위(5..10), 앞면 왼쪽 약간
        for x in range(5, 11):
            col = g[5] if x in (6, 7) else (g[3] if x == 5 else g[2] if x == 10 else g[4])
            if y % 5 == 4: col = g[2]
            cv.put(x, y, col)
        for x in (3, 4):
            cv.put(x, y, s[5] if rnd(x, y, 8) > 0.3 else s[4])
        cv.put(11, y, ea[2])
    return cv


def wall_corner(side):
    """아래쪽 모서리: 세로 담이 위에서 내려와 가로 담과 만난다. side='L'|'R'"""
    cv = Cv(T, T)
    h = wall_h(5, T) if side == 'L' else wall_h(0, 11)
    v = wall_v()
    # 세로 담은 가로 담의 덮개 위(y<8)까지만
    for y in range(0, 8):
        for x in range(T):
            if v.a[y, x, 3]: cv.a[y, x] = v.a[y, x]
    cv.paste(h, 0, 0)
    return cv


def wall_gate_pillar():
    return wall_h(0, T, 3)


# ---------- 소품 ----------
def jars():
    cv = Cv(2 * T, T)
    ea = RGB['earth']; od = RGB['orange']

    def jar(cx, base_y, w, h, lid=True):
        for y in range(base_y - h, base_y):
            t = (y - (base_y - h)) / h
            half = w / 2 * (0.55 + 0.45 * math.sin(math.pi * min(1.0, t * 0.9 + 0.12)))
            for x in range(int(cx - half), int(cx + half) + 1):
                v = (x - cx) / max(1, half)
                idx = 4 - (1 if v > 0.2 else 0) - (1 if v > 0.6 else 0) + (1 if v < -0.4 else 0)
                if rnd(x, y, 9) > 0.92: idx += 1
                cv.put(x, y, ea[max(1, min(6, idx + 0))])
        # 목과 뚜껑
        cv.rect(int(cx - w * 0.28), base_y - h - 2, int(cx + w * 0.28) + 1, base_y - h + 1, ea[3])
        cv.rect(int(cx - w * 0.38), base_y - h - 4, int(cx + w * 0.38) + 1, base_y - h - 1, ea[2])
        cv.hl(int(cx - w * 0.38), int(cx + w * 0.38) + 1, base_y - h - 4, ea[4])
        cv.put(int(cx), base_y - h - 5, ea[4])
    jar(8, 15, 11, 9)
    jar(19, 15, 9, 7)
    jar(27, 15, 7, 6)
    outline(cv)
    return cv


def well():
    W, H = 2 * T, 2 * T
    cv = Cv(W, H)
    st = RGB['stone']; wd = RGB['wood']; w = RGB['water']
    # 우물 돌 테두리(위에서 본 타원 + 앞면)
    cx, cy = 16, 23
    for y in range(cy - 6, cy + 9):
        for x in range(cx - 12, cx + 13):
            top = ((x - cx) / 12) ** 2 + ((y - cy) / 6) ** 2 <= 1
            front = ((x - cx) / 12) ** 2 + ((y - cy - 4) / 6) ** 2 <= 1 and y > cy
            if top:
                inner = ((x - cx) / 8) ** 2 + ((y - cy) / 3.6) ** 2 <= 1
                cv.put(x, y, (w[2] if rnd(x, y, 3) > 0.2 else w[1]) if inner else (st[6] if rnd(x, y, 2) > 0.5 else st[5]))
            elif front:
                cv.put(x, y, st[4] if (x // 4 + y // 4) % 2 else st[3])
    # 기둥 + 들보 + 도르래
    cv.rect(5, 3, 8, 24, wd[4]); cv.vl(5, 3, 24, wd[5]); cv.vl(7, 3, 24, wd[2])
    cv.rect(24, 3, 27, 24, wd[4]); cv.vl(24, 3, 24, wd[5]); cv.vl(26, 3, 24, wd[2])
    cv.rect(4, 2, 28, 5, wd[3]); cv.hl(4, 28, 2, wd[5]); cv.hl(4, 28, 4, wd[2])
    # 두레박 줄·통
    cv.vl(16, 5, 16, RGB['thatch'][3]); cv.vl(17, 5, 16, RGB['thatch'][2])
    cv.rect(13, 16, 20, 21, wd[3]); cv.hl(13, 20, 16, wd[5]); cv.hl(13, 20, 18, wd[1]); cv.vl(13, 16, 21, wd[5]); cv.vl(19, 16, 21, wd[2])
    outline(cv)
    return cv


def bench():
    """평상."""
    cv = Cv(2 * T, T)
    wd = RGB['wood']
    for y in range(3, 10):
        for x in range(1, 31):
            cv.put(x, y, wd[5] if (y % 3) else wd[4])
            if rnd(x, y, 17) > 0.93: cv.put(x, y, wd[6])
    cv.hl(1, 31, 3, wd[6])
    for x in range(1, 31): cv.put(x, 10, wd[3]); cv.put(x, 11, wd[2])
    for x in (3, 27):
        cv.rect(x, 12, x + 2, 16, wd[2]); cv.vl(x, 12, 16, wd[4])
    for x in range(4, 28, 7): cv.vl(x, 4, 10, wd[3])
    outline(cv)
    return cv


def mat_peppers():
    cv = Cv(2 * T, T)
    th = RGB['thatch']; rd = RGB['red']
    for y in range(3, 14):
        for x in range(1, 31):
            cv.put(x, y, th[4] if (x + y) % 3 else th[3])
    cv.hl(1, 31, 3, th[6]); cv.hl(1, 31, 13, th[2]); cv.vl(1, 3, 14, th[5]); cv.vl(30, 3, 14, th[2])
    for k in range(34):
        x, y = 3 + hsh(k, 1, 4) % 25, 4 + hsh(k, 2, 4) % 8
        cv.put(x, y, rd[4]); cv.put(x + 1, y, rd[5] if k % 3 else rd[6]); cv.put(x + 1, y + 1, rd[2])
    outline(cv)
    return cv


def jangseung(female=False):
    cv = Cv(T, 2 * T)
    wd = RGB['wood']; rd = RGB['red']
    for y in range(4, 30):
        for x in range(4, 12):
            idx = 4 if x < 7 else (3 if x < 10 else 2)
            cv.put(x, y, wd[idx + (1 if rnd(x, y, 5) > 0.93 else 0)])
    # 모자
    for x in range(3, 13): cv.put(x, 4, wd[2]); cv.put(x, 3, wd[3])
    for x in range(5, 11): cv.put(x, 2, wd[3]); cv.put(x, 1, wd[4])
    # 얼굴
    cv.rect(5, 7, 11, 12, wd[5])
    cv.put(5, 8, hx('#f7fdff')); cv.put(6, 8, hx('#f7fdff')); cv.put(9, 8, hx('#f7fdff')); cv.put(10, 8, hx('#f7fdff'))
    cv.put(6, 9, wd[0]); cv.put(9, 9, wd[0]); cv.put(5, 7, wd[1]); cv.put(10, 7, wd[1])
    cv.vl(7, 9, 11, wd[2]); cv.vl(8, 9, 11, wd[2])
    cv.hl(5, 11, 12, wd[1])
    if female:
        cv.put(6, 12, rd[5]); cv.put(7, 12, rd[5]); cv.put(8, 12, rd[5]); cv.put(9, 12, rd[5])
    else:
        cv.put(6, 12, hx('#f7fdff')); cv.put(7, 12, wd[0]); cv.put(8, 12, wd[0]); cv.put(9, 12, hx('#f7fdff'))
    # 글씨
    for y in range(15, 27, 3):
        cv.put(7, y, rd[4]); cv.put(8, y, rd[4]); cv.put(7, y + 1, rd[3]); cv.put(8, y + 1, rd[5])
    # 돌무더기
    for x in range(1, 15):
        cv.put(x, 29, RGB['stone'][4]); cv.put(x, 30, RGB['stone'][3]); cv.put(x, 28, RGB['stone'][5] if x % 3 else RGB['stone'][6])
    outline(cv)
    return cv


def sotdae():
    cv = Cv(T, 2 * T)
    wd = RGB['wood']
    cv.vl(7, 8, 31, wd[4]); cv.vl(8, 8, 31, wd[2])
    cv.rect(6, 28, 10, 31, RGB['stone'][4]); cv.hl(6, 10, 28, RGB['stone'][6])
    # 오리
    for (x, y, c) in ((4, 4, wd[4]), (5, 4, wd[4]), (6, 3, wd[5]), (7, 3, wd[4]), (8, 4, wd[3]), (9, 4, wd[3]), (10, 5, wd[2]),
                      (5, 5, wd[3]), (6, 5, wd[3]), (7, 5, wd[2]), (8, 5, wd[2]), (9, 5, wd[2]), (3, 3, wd[5]), (2, 3, RGB['orange'][4])):
        cv.put(x, y, c)
    cv.put(3, 2, wd[4]); cv.put(4, 2, wd[5])
    outline(cv)
    return cv


def lantern():
    cv = Cv(T, 2 * T)
    st = RGB['stone']
    def band(x0, x1, y0, y1, hi=5):
        for y in range(y0, y1):
            for x in range(x0, x1):
                cv.put(x, y, st[hi] if x < (x0 + x1) // 2 else st[hi - 1])
        cv.hl(x0, x1, y0, st[6]); cv.hl(x0, x1, y1 - 1, st[3])
    band(3, 13, 28, 32); band(5, 11, 25, 28); band(7, 9, 17, 25)
    band(3, 13, 14, 18, 5)
    band(4, 12, 18, 25)
    cv.rect(6, 19, 10, 24, hx('#2a1a0f')); cv.rect(7, 20, 9, 23, RGB['orange'][5]); cv.put(7, 20, RGB['orange'][6])
    # 지붕(지붕돌)
    for y in range(8, 14):
        w = 4 + (y - 8)
        for x in range(8 - w // 2 - 1, 8 + w // 2 + 2):
            cv.put(x, y, st[6] if y == 8 else (st[5] if x < 8 else st[4]))
    cv.hl(1, 15, 13, st[3])
    for y in range(4, 8): cv.put(7, y, st[5]); cv.put(8, y, st[4])
    cv.put(7, 3, st[6]); cv.put(8, 3, st[5])
    outline(cv)
    return cv


# ---------- 나무 ----------
def puff(cv, cx, cy, r, ramp, base=4):
    """잎뭉치 하나: 둥근 덩어리, 왼쪽 위 밝고 오른쪽 아래 어둡다. 가장자리는 깨끗하게(1px 얼룩 없음)."""
    rr = RGB[ramp]
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            dx, dy = (x - cx) / r, (y - cy) / r
            d = math.hypot(dx, dy)
            if d > 1.0:
                continue
            v = -0.6 * dx - 0.8 * dy
            idx = base + (1 if v > 0.30 else 0) + (1 if v > 0.78 else 0) - (1 if v < -0.25 else 0) - (1 if v < -0.7 else 0)
            if d > 0.82 and dy > 0.2:
                idx -= 1                                  # 아래쪽 테두리 그늘
            cv.put(x, y, rr[max(1, min(6, idx))])


def crown(cv, puffs, ramp, base=4):
    """뒤(위)에서 앞(아래)으로 겹쳐 그린다."""
    for (cx, cy, r) in sorted(puffs, key=lambda t: t[1] + t[2] * 0.3):
        puff(cv, cx, cy, r, ramp, base)


def trunk(cv, cx, y0, y1, w, lean=0.0, seed=0):
    wd = RGB['wood']
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        x0 = int(cx + lean * (1 - t))
        wt = w + int(2 * t)
        for x in range(x0 - wt // 2, x0 + wt // 2 + 1):
            v = (x - x0) / max(1, wt / 2)
            idx = 5 - (1 if v > -0.2 else 0) - (1 if v > 0.45 else 0)
            if (y // 4 + (x - x0)) % 5 == 0 and rnd(x, y, 3 + seed) > 0.5:
                idx -= 1
            cv.put(x, y, wd[max(1, idx)])
    # 밑동 뿌리
    yb = y1 - 1
    for k in range(1, 5):
        cv.put(int(cx) - w // 2 - k, yb, wd[3]); cv.put(int(cx) + w // 2 + k + 1, yb, wd[2])
        cv.put(int(cx) - w // 2 - k + 1, yb - 1, wd[4]); cv.put(int(cx) + w // 2 + k, yb - 1, wd[3])


def pine(seed=0):
    """소나무 4×5: 줄기가 휘고, 구름 모양 솔잎 단이 층층이."""
    W, H = 4 * T, 5 * T
    cv = Cv(W, H)
    trunk(cv, 32, 22, 78, 5, lean=-4, seed=seed)
    # 가지
    wd = RGB['wood']
    for (x0, y0, x1, y1) in ((30, 52, 16, 44), (34, 40, 50, 34), (31, 62, 20, 60)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n):
            x, y = x0 + (x1 - x0) * k // n, y0 + (y1 - y0) * k // n
            cv.put(x, y, wd[3]); cv.put(x, y - 1, wd[4])
    pads = []
    def pad(cx, cy, n, r, spread):
        for k in range(n):
            t = k / max(1, n - 1)
            pads.append((cx - spread + 2 * spread * t, cy + (3 if k % 2 else 0) - int(2 * math.sin(t * math.pi)), r - (1 if k in (0, n - 1) else 0)))
    pad(32, 12, 5, 7, 18); pad(14, 32, 3, 6, 8); pad(50, 30, 3, 6, 8); pad(32, 26, 4, 6, 12); pad(20, 52, 3, 5, 6); pad(44, 50, 3, 5, 6)
    crown(cv, pads, 'pine', base=3)
    outline(cv)
    return cv


def persimmon(seed=0):
    """감나무 4×4: 둥근 수관에 주황 감."""
    W, H = 4 * T, 4 * T
    cv = Cv(W, H)
    ground_shadow(cv, 34, 59, 20, 3, 70)
    trunk(cv, 32, 36, 62, 5, lean=0, seed=seed)
    puffs = [(32, 16, 11), (20, 22, 9), (44, 22, 9), (14, 30, 7), (50, 30, 7), (32, 28, 12), (24, 12, 8), (40, 12, 8), (22, 34, 6), (42, 34, 6)]
    crown(cv, puffs, 'leaf', base=3)
    od = RGB['orange']
    for k in range(14):
        x, y = 12 + hsh(k, seed, 5) % 40, 14 + hsh(seed, k, 6) % 22
        if cv.a[y, x, 3] and cv.a[y + 1, x + 1, 3] and cv.a[y + 1, x, 3] and cv.a[y, x + 1, 3]:
            cv.put(x, y, od[5]); cv.put(x + 1, y, od[4]); cv.put(x, y + 1, od[4]); cv.put(x + 1, y + 1, od[3])
    outline(cv)
    return cv


def willow(seed=0):
    """버드나무 4×5: 부푼 수관 + 2px 폭 가닥 늘어짐."""
    W, H = 4 * T, 5 * T
    cv = Cv(W, H)
    trunk(cv, 32, 30, 78, 6, lean=2, seed=seed)
    crown(cv, [(32, 12, 10), (18, 16, 9), (46, 16, 9), (10, 22, 6), (54, 22, 6), (32, 20, 9), (24, 8, 7), (40, 8, 7)], 'leaf', base=4)
    outline(cv)
    lf = RGB['leaf']
    # 늘어진 가닥: 3px 폭 리본(밝음·중간·어둠), 길이를 달리 해 겹친다. 1px 줄을 쓰지 않는다.
    order = sorted(range(2, 62, 5), key=lambda x: rnd(x, seed, 2))
    for x in order:
        ln = 22 + int(rnd(x, seed, 8) * 20) - int(abs(x - 32) * 0.3)
        for j in range(ln):
            y = 20 + j
            sway = int(math.sin(y * 0.28 + x) * 1.5)
            wdt = 3 if j < ln - 5 else 2
            cv.put(x + sway, y, lf[5] if (j // 5 + x // 5) % 3 == 0 else lf[4])
            cv.put(x + sway + 1, y, lf[3])
            if wdt == 3:
                cv.put(x + sway + 2, y, lf[2])
    return cv


# ---------- 정자 ----------
def pavilion():
    W, H = 5 * T, 5 * T
    cv = Cv(W, H)
    wd = RGB['wood']; rd = RGB['red']; st = RGB['stone']
    # 뒷벽/그늘
    for y in range(36, 60):
        for x in range(10, W - 10):
            cv.put(x, y, wd[1] if rnd(x, y, 6) > 0.985 else wd[0])
    # 마루 바닥(앞으로 나온 면)
    for y in range(52, 60):
        for x in range(8, W - 8):
            cv.put(x, y, wd[5] if y % 3 else wd[4])
    cv.hl(8, W - 8, 52, wd[6])
    # 난간
    for x in range(10, W - 10):
        if not 34 <= x - 10 <= 46:
            cv.put(x, 47, wd[4]); cv.put(x, 48, wd[2]); cv.put(x, 54, wd[3]); cv.put(x, 53, wd[2])
    for x in range(12, W - 12, 5):
        if not 34 <= x - 10 <= 46:
            cv.rect(x, 48, x + 1, 54, wd[3])
    # 기둥(주홍)
    for x in (8, 26, 52, 68):
        column(cv, x, 33, 62, 'red', 4)
    # 마루 앞단
    stone_face(cv, 6, 61, W - 6, 68, rowh=7, seed=2)
    cv.hl(6, W - 6, 61, st[6])
    steps(cv, W // 2, 74, 2)
    hip_roof(cv, 0, W, 2, 30, inset=10, seed=2)
    for x in range(8, W - 8):
        cv.put(x, 30, wd[1]); cv.put(x, 31, wd[1])
    dan(cv, 8, W - 8, 32, 3)
    outline(cv)
    shadow(cv, 4, W - 4, 68, 3, 70)
    return cv


# ---------- 나무다리 ----------
def _bridge():
    W, H = 5 * T, 3 * T
    cv = Cv(W, H)
    wd = RGB['wood']
    # 물 위 그림자
    for y in range(40, 47):
        for x in range(4, W - 4):
            cv.put(x, y, hx('#071528'), 110 - (y - 40) * 12)
    # 널(세로로 깐 판)
    for y in range(14, 40):
        for x in range(2, W - 2):
            k = (x - 2) % 6
            col = wd[5] if k < 4 else wd[3]
            if k == 0: col = wd[6]
            if rnd(x, y, 31) > 0.95: col = wd[4]
            cv.put(x, y, col)
    # 가장자리 보
    cv.hl(2, W - 2, 14, wd[2]); cv.hl(2, W - 2, 39, wd[2]); cv.hl(2, W - 2, 38, wd[3])
    # 난간(뒤쪽)
    cv.hl(2, W - 2, 6, wd[5]); cv.hl(2, W - 2, 7, wd[4]); cv.hl(2, W - 2, 8, wd[2]); cv.hl(2, W - 2, 11, wd[3]); cv.hl(2, W - 2, 12, wd[1])
    for x in range(4, W - 2, 16):
        cv.rect(x, 4, x + 3, 16, wd[4]); cv.vl(x, 4, 16, wd[6]); cv.vl(x + 2, 4, 16, wd[2]); cv.hl(x, x + 3, 4, wd[6])
    # 난간(앞쪽: 더 크게)
    cv.hl(2, W - 2, 31, wd[6]); cv.hl(2, W - 2, 32, wd[5]); cv.hl(2, W - 2, 33, wd[3]); cv.hl(2, W - 2, 37, wd[3]); cv.hl(2, W - 2, 38, wd[1])
    for x in range(4, W - 2, 16):
        cv.rect(x, 28, x + 3, 42, wd[5]); cv.vl(x, 28, 42, wd[6]); cv.vl(x + 2, 28, 42, wd[2]); cv.hl(x, x + 3, 28, wd[6])
    # 석축 다리발(양 끝)
    for (a, b) in ((0, 8), (W - 8, W)):
        for y in range(14, 42):
            for x in range(a, b):
                cv.put(x, y, RGB['stone'][4] if (x + y // 3) % 3 else RGB['stone'][3])
    outline(cv)
    return cv


def bridge():
    """5×4 칸. 갑판 중심이 y=32px(2칸 길의 한가운데)에 오게 5px 내렸다."""
    b = _bridge()
    cv = Cv(5 * T, 4 * T)
    cv.paste(b, 0, 5)
    return cv
