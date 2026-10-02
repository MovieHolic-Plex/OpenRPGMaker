"""건물류: 팔작지붕 기와, 초가지붕, 기와집, 초가집, 대문, 돌담, 정자."""
from tk import *



_ALLOWED_ARR = None


def _snap_dark(rgb):
    """rgb 보다 어두운 허용 색 중 가장 가까운 것."""
    global _ALLOWED_ARR
    if _ALLOWED_ARR is None:
        _ALLOWED_ARR = np.array(sorted(ALLOWED), dtype=np.int32)
    lum = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
    cand = _ALLOWED_ARR[lum(_ALLOWED_ARR) <= lum(np.array(rgb)) + 1]
    if len(cand) == 0:
        cand = _ALLOWED_ARR[lum(_ALLOWED_ARR) <= lum(_ALLOWED_ARR).min() + 1]
    d = ((cand - np.array(rgb)) ** 2).sum(axis=1)
    return tuple(int(v) for v in cand[int(d.argmin())])


def outline(cv, col=None):
    """안쪽 외곽선(inset): 실루엣 가장자리 화소를 0.62배로 어둡게 한 뒤 허용 색으로 맞춘다.
    실루엣 바깥에 어두운 링을 덧대지 않는다(스킬 0i-2)."""
    a = cv.a[:, :, 3] == 255
    edge = []
    for y in range(cv.h):
        for x in range(cv.w):
            if not a[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < cv.w and 0 <= Y < cv.h and cv.a[Y, X, 3] == 0:
                    edge.append((x, y)); break
    cache = {}
    for x, y in edge:
        c = tuple(int(v) for v in cv.a[y, x, :3])
        if c not in cache:
            cache[c] = _snap_dark(tuple(int(v * 0.62) for v in c))
        cv.put(x, y, cache[c])


def shadow(cv, x0, x1, y, h=3, al=90):
    for j in range(h):
        for x in range(x0, x1):
            if cv.a[y + j, x, 3] == 0:
                cv.put(x, y + j, SHADOW, al - j * 25)


def hip_roof(cv, x0, x1, ytop, ybot, inset=12, ramp='giwa', dancheong=False, seed=0):
    """팔작지붕(정면 사다리꼴 + 양옆 추녀). 처마 끝이 살짝 들린다."""
    r = RGB[ramp]
    xa, xb = x0 + inset, x1 - inset
    def lift(x):
        d = min(x - x0, x1 - 1 - x)
        return int(round(5 * max(0.0, 1 - d / 15.0) ** 2))
    bot_l = [(x, ybot - lift(x)) for x in range(x0, x0 + 16, 2)]
    bot_r = [(x, ybot - lift(x)) for x in range(x1 - 1, x1 - 17, -2)]
    sil = [(xa, ytop), (xb, ytop)] + bot_r + bot_l[::-1]
    sw = 9
    front = [(xa + 4, ytop + 6), (xb - 4, ytop + 6), (x1 - sw, ybot), (x0 + sw, ybot)]
    mid = (x0 + x1) / 2.0

    def side(x, y):
        left = x < mid
        k = ((x + y) % 3 == 0)
        if left:
            return r[5] if k else r[4]
        return r[3] if k else r[2]
    fillpoly(cv, sil, side)

    def fr(x, y):
        col = (x - x0) % 4
        base = [r[5], r[4], r[2], r[3]][col]       # 수키와(볼록·밝음) / 암키와 골(어두움)
        row = (y - ytop) % 6
        if row == 5 and col in (0, 1): base = r[3]      # 기와 한 장 끝의 그늘
        if row == 0 and col in (0, 1): base = r[6]      # 한 장의 윗입술 하이라이트
        q = rnd(x, y, 900 + seed)
        if q < 0.05: base = r[min(6, [r[5], r[4], r[2], r[3]].index(base) + 3)] if False else r[4]
        return base
    fillpoly(cv, front, fr)
    # 추녀마루(합각선): 정면과 옆면 경계의 밝은 선
    for t in range(ybot - ytop - 5):
        yy = ytop + 6 + t
        fx0 = (xa + 4) + (x0 + sw - (xa + 4)) * t / max(1, ybot - ytop - 6)
        fx1 = (xb - 4) + (x1 - sw - (xb - 4)) * t / max(1, ybot - ytop - 6)
        cv.put(int(round(fx0)) - 1, yy, r[6]); cv.put(int(round(fx1)), yy, r[2])
    # 용마루(마루 기와 띠)
    for x in range(xa - 1, xb + 1):
        cv.put(x, ytop, r[6]); cv.put(x, ytop + 1, r[5]); cv.put(x, ytop + 2, r[5]); cv.put(x, ytop + 3, r[3]); cv.put(x, ytop + 4, r[2])
    # 치미(용마루 끝 장식): 바깥으로 살짝 말려 올라간 덩어리
    for k, (dx, h) in enumerate(((0, 3), (-1, 5), (-2, 6), (-3, 5))):
        for yy in range(ytop + 4 - h, ytop + 4):
            cv.put(xa + dx - 1, yy, r[6] if k < 2 else r[5]); cv.put(xa + dx, yy, r[5])
    for k, (dx, h) in enumerate(((0, 3), (1, 5), (2, 6), (3, 5))):
        for yy in range(ytop + 4 - h, ytop + 4):
            cv.put(xb + dx - 1, yy, r[3]); cv.put(xb + dx, yy, r[2])
    # 처마 끝: 막새(둥근 끝 기와)
    for x in range(x0 + 2, x1 - 2):
        edge = ybot - lift(x)
        yy = edge - 2
        m = (x - x0) % 4
        for j in range(3):
            if cv.a[yy + j, x, 3]:
                pass
        if m in (0, 1):
            cv.put(x, yy, r[6]); cv.put(x, yy + 1, r[5]); cv.put(x, yy + 2, r[2])
        else:
            cv.put(x, yy, r[3]); cv.put(x, yy + 1, r[2]); cv.put(x, yy + 2, r[1])
    # 처마 밑 단청 띠
    if dancheong:
        pass


def dan(cv, x0, x1, y, h=3):
    """단청 띠: 청·적·록 반복."""
    g, b, rd = RGB['green'], RGB['blue'], RGB['red']
    pat = [(g, 3), (rd, 2), (b, 3), (rd, 2)]
    x = x0
    i = 0
    while x < x1:
        col, w = pat[i % 4]
        for xx in range(x, min(x1, x + w)):
            for j in range(h):
                c = col[4] if j == 0 else col[3] if j == h - 1 else col[4]
                if j == 0: c = col[5]
                cv.put(xx, y + j, c)
        x += w
        i += 1


def column(cv, x, y0, y1, ramp='wood', w=3):
    r = RGB[ramp]
    for yy in range(y0, y1):
        cv.put(x, yy, r[5]); 
        for k in range(1, w - 1): cv.put(x + k, yy, r[4])
        cv.put(x + w - 1, yy, r[2])


def lattice(cv, x0, y0, x1, y1, door=False, seed=0):
    """창호(한지 + 살). door=True 면 문(살이 촘촘한 격자)."""
    w = RGB['wood']; p = RGB['plaster']
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 50 + seed)
            cv.put(x, y, RGB['plaster'][6] if q > 0.93 else (p[5] if q > 0.12 else p[4]))
    cv.rect(x0, y0, x1, y0 + 1, w[3]); cv.rect(x0, y1 - 1, x1, y1, w[2])
    cv.rect(x0, y0, x0 + 1, y1, w[4]); cv.rect(x1 - 1, y0, x1, y1, w[2])
    step = 3 if door else 4
    for x in range(x0 + step, x1 - 1, step):
        cv.vl(x, y0 + 1, y1 - 1, w[4])
    for y in range(y0 + 4, y1 - 1, 5 if not door else 4):
        cv.hl(x0 + 1, x1 - 1, y, w[4])


def stone_face(cv, x0, y0, x1, y1, rowh=6, seed=0, top=0):
    """석축 앞면: 어긋나게 쌓은 큰 돌."""
    s = RGB['stone']
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 70 + seed)
            col = s[5] if q > 0.25 else s[4]
            if q > 0.94: col = s[6]
            cv.put(x, y, col)
    rows = list(range(y0, y1, rowh))
    for ri, ry in enumerate(rows):
        cv.hl(x0, x1, ry + rowh - 1, s[3])
        off = (ri % 2) * 8 + (seed % 4)
        for x in range(x0 + off % 14 + 4, x1, 14):
            cv.vl(x, ry, min(y1, ry + rowh - 1), s[3])
    cv.hl(x0, x1, y0, s[6])


def steps(cv, cx, ybase, tiers=2):
    """디딤돌 계단(앞으로 넓어지는 두 단). ybase 는 맨 아래 단 밑줄."""
    s = RGB['stone']
    o = RGB['stone'][1]
    for t in range(tiers):
        w = 22 + t * 10
        y = ybase - 5 * (t + 1) + 1
        for yy in range(y, y + 5):
            for xx in range(cx - w // 2, cx + w // 2):
                top = yy < y + 2
                cv.put(xx, yy, s[6] if top and yy == y else (s[5] if top else (s[4] if rnd(xx, yy, 3) > 0.25 else s[3])))
        cv.hl(cx - w // 2, cx + w // 2, y + 4, s[2])
        cv.vl(cx - w // 2, y, y + 5, s[2]); cv.vl(cx + w // 2 - 1, y, y + 5, s[2])
        cv.hl(cx - w // 2, cx + w // 2, y - 1, o) if t == tiers - 1 else None


def giwa_house(bays=6, seed=0):
    """기와집(팔작지붕, 정면 bays 칸). 폭 (bays+1) 칸 × 6 칸."""
    W = (bays + 1) * T
    H = 6 * T
    cv = Cv(W, H)
    wl, wr = 8, W - 8                # 벽 범위
    hip_roof(cv, 2, W - 2, 4, 42, inset=12, seed=seed)
    # 처마 그늘
    for x in range(wl - 2, wr + 2):
        cv.put(x, 42, RGB['wood'][1]); cv.put(x, 43, RGB['wood'][1]); cv.put(x, 44, RGB['wood'][2])
    # 벽면
    wd = RGB['wood']; pl = RGB['plaster']
    for y in range(45, 73):
        for x in range(wl, wr):
            cv.put(x, y, pl[4] if rnd(x, y, 8) > 0.2 else pl[3])
    # 창방(들보) + 기둥
    cv.rect(wl, 45, wr, 47, wd[3]); cv.hl(wl, wr, 45, wd[5]); cv.hl(wl, wr, 46, wd[3])
    for k in range(bays + 1):
        column(cv, wl + k * 16 - (1 if k == bays else 0), 45, 73)
    # 칸마다 창호/문
    for k in range(bays):
        bx0, bx1 = wl + k * 16 + 3, wl + k * 16 + 16
        mid = bays // 2
        if k in (0, bays - 1):
            # 회벽 + 작은 살창
            lattice(cv, bx0 + 2, 52, bx1 - 2, 62, seed=k)
            cv.hl(bx0, bx1, 72, wd[3])
        else:
            lattice(cv, bx0, 49, bx1, 67, door=(k in (mid - 1, mid)), seed=k)
            cv.rect(bx0, 67, bx1, 73, wd[3]); cv.hl(bx0, bx1, 67, wd[5]); cv.hl(bx0, bx1, 72, wd[2])
    # 기단
    stone_face(cv, 4, 78, W - 4, 90, rowh=6, seed=seed)
    for x in range(4, W - 4):
        cv.put(x, 73, RGB['stone'][6]); 
        for y in (74, 75, 76, 77): cv.put(x, y, RGB['stone'][5] if rnd(x, y, 4) > 0.2 else RGB['stone'][4])
    cv.hl(4, W - 4, 77, RGB['stone'][3])
    steps(cv, W // 2, 96, 2)
    outline(cv)
    shadow(cv, 6, W - 6, 90, 3, 70)
    return cv


if __name__ == '__main__':
    from PIL import Image
    h = giwa_house(6)
    h.img().resize((h.w * 5, h.h * 5), Image.NEAREST).save('/tmp/jo_house.png')
