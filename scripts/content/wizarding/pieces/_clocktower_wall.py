"""시계탑 석벽 도우미 — castle_kit 의 공용 성벽 돌 그림 사본(등록 없음)."""
from wzlib import K
ST = 'stone'

def hsh(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


# ───────────────────────── 벽 공통 도우미 ─────────────────────────
FACE_Y0 = 16
COURSES = (6, 7, 6, 7, 6, 6, 4)
CUTS = ((0, 10), (5,), (0, 7), (3, 12), (0, 9), (6,), (0, 11))


def wall_face(c, x0, w, y0=FACE_Y0, courses=COURSES, cuts=CUTS, base=3, shadow_top=True, moss=0.0, seed=0):
    """실내 쪽 벽 정면: 큰 비정형 블록 단. 16 주기."""
    y = y0
    for ri, rh in enumerate(courses):
        cut = sorted(cuts[ri % len(cuts)])
        for x in range(x0, x0 + w):
            lx = x % 16
            start = max([k for k in cut if k <= lx] or [cut[-1] - 16])
            bid = (ri * 7 + start) % 11
            tone = base + (-1 if hsh(bid, ri, 3 + seed) < 0.28 else (1 if hsh(bid, ri, 8 + seed) > 0.86 else 0))
            for yy in range(y, y + rh):
                col = K(ST, tone)
                if yy == y:
                    col = K(ST, tone + 1)
                elif yy == y + rh - 1:
                    col = K(ST, 1)
                if lx == start and yy != y + rh - 1:
                    col = K(ST, tone + 1)
                nxt = (lx + 1) % 16
                if (nxt in cut) and yy != y + rh - 1:
                    col = K(ST, 2)
                c.P(x, yy, col)
            if hsh(x, ri, 9 + seed) < 0.035 and rh > 4:
                c.P(x, y + 2 + int(hsh(x, ri, 5) * (rh - 4)), K(ST, tone - 1))
            if moss and hsh(lx, ri, 33 + seed) < moss:        # 줄눈 이끼
                c.P(x, y + rh - 1, K('leaf', 2))
                if hsh(lx, ri, 44 + seed) < 0.6 and rh > 4:
                    c.P(x, y + rh - 2, K('leaf', 1 + int(hsh(lx, ri, 55) * 2)))
        y += rh
    if shadow_top:
        c.HL(x0, y0, w, K(ST, 2))


def plinth(c, x0, w, y0=58, h=6):
    c.R(x0, y0, w, h, K(ST, 3)); c.HL(x0, y0, w, K(ST, 4))
    for x in range(x0, x0 + w):
        if x % 16 in (5, 12):
            c.VL(x, y0 + 1, h - 2, K(ST, 2))
    c.HL(x0, y0 + h - 2, w, K(ST, 2)); c.HL(x0, y0 + h - 1, w, K(ST, 1))


def cap(c, x0, w, y0=0, outline_top=True):
    """북벽 윗면(두께 10px) + 앞 모서리."""
    c.R(x0, y0, w, 10, K(ST, 4))
    for x in range(x0, x0 + w):
        lx = x % 16
        for y in range(y0 + 1, y0 + 9):
            h = hsh(lx, y, 21)
            if h < 0.06:
                c.P(x, y, K(ST, 3))
            elif h > 0.96:
                c.P(x, y, K(ST, 5))
        if lx in (15, 7):
            c.VL(x, y0 + 1, 8, K(ST, 3))
    c.HL(x0, y0 + 1, w, K(ST, 5))
    c.R(x0, y0 + 10, w, 1, K(ST, 5))
    c.R(x0, y0 + 11, w, 4, K(ST, 3)); c.HL(x0, y0 + 11, w, K(ST, 4))
    for x in range(x0, x0 + w):
        if x % 16 in (7, 15):
            c.VL(x, y0 + 12, 3, K(ST, 2))
    c.HL(x0, y0 + 14, w, K(ST, 2)); c.HL(x0, y0 + 15, w, K(ST, 1))
    if outline_top:
        c.HL(x0, y0, w, K(ST, 1))


def wall_n_base(c, x0=0, w=16, moss=0.0, seed=0):
    cap(c, x0, w); wall_face(c, x0, w, moss=moss, seed=seed); plinth(c, x0, w)


def arch_mask(cx, y_top, w, y_bot, ah):
    cells = set()
    for y in range(y_top, y_bot + 1):
        r = y - y_top
        if r < ah:
            t = (r + 0.5) / ah
            hw = (w / 2) * (1 - (1 - t) ** 2) ** 0.72
        else:
            hw = w / 2
        for x in range(int(cx - w / 2 - 1), int(cx + w / 2 + 2)):
            if abs(x + 0.5 - cx) <= hw:
                cells.add((x, y))
    return cells


def dilate(m, n=1):
    out = set(m)
    for _ in range(n):
        add = set()
        for (x, y) in out:
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                add.add((x + ox, y + oy))
        out |= add
    return out

