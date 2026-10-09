# 원시 마을 살림집: 가죽·뼈대 천막(큰·작은), 움집(큰·작은), 가죽 바람막이, 엄니 문. 3/4 시점(앞면+윗면), 빛 왼쪽 위.
from pv_base import *


# ---------------------------------------------------------------- 가죽 원뿔 천막
def _cone_tent(W, Hh, cx, ay, by, rx, ry, mat, seed, door_dx=0, door_w=0.42, poles=((-5, -7), (-2, -9), (3, -8), (6, -6)),
               pole_mat='bone', seams=(-0.62, -0.22, 0.2, 0.6), lean=0.0, patch=None):
    """원뿔 천막. (cx, ay)=꼭대기, by=밑동 타원 중심, rx/ry=밑동 반지름. 가죽 판 이음(바늘땀), 앞면 주름, 아랫단 누름돌,
    입구 휘장(오른쪽으로 걷어 묶음), 꼭대기로 삐져나온 뼈대 기둥."""
    c = C(W, Hh, seed=seed)
    c.shadow(cx + 2, by + ry - 1, rx + 2, ry * 0.9, 90)
    hgt = by - ay

    def half(y):
        f = (y + 0.5 - ay) / hgt
        return max(0.6, rx * f * (1 + 0.06 * math.sin(f * 3.1)))

    def cxx(y):
        f = (y + 0.5 - ay) / hgt
        return cx + lean * (1 - f) * 6

    def inside(x, y):
        if y < ay: return None
        if y <= by:
            h = half(y); u = (x + 0.5 - cxx(y)) / h
            return u if abs(u) <= 1 else None
        dy = (y + 0.5 - by) / ry; u = (x + 0.5 - cx) / rx
        return u if u * u + dy * dy <= 1 else None
    # 몸체
    c.group(1); c.new()
    for y in range(int(ay), int(by + ry) + 1):
        for x in range(W):
            u = inside(x, y)
            if u is None: continue
            f = min(1.0, (y + 0.5 - ay) / hgt)
            v = 0.86 - 0.40 * (u + 1) / 2 - 0.10 * f + (0.06 if u < -0.55 else 0) - (0.08 if u > 0.75 else 0)
            c.setv(x, y, mat, v)
    # 가죽 판 이음: 꼭대기에서 밑동으로 비스듬한 선(한 톤 어둡게) + 바늘땀(3화소마다 밝은 점)
    for k, sm in enumerate(seams):
        for y in range(int(ay) + 3, int(by) + 1):
            x = int(round(cxx(y) + sm * half(y) - 0.5))
            if inside(x, y) is None: continue
            c.darken(x, y, 1)
            if (y + k) % 3 == 0:
                c.lighten(x + 1, y, 1)
    # 판마다 톤 조금씩 다르게(무두질 얼룩) — 판 단위로 밝기 이동
    bounds = [-1.01] + list(seams) + [1.01]
    for y in range(int(ay), int(by) + 1):
        for x in range(W):
            u = inside(x, y)
            if u is None or c.m[y][x] != mat or c.fix[y][x] is not None: continue
            pi = sum(1 for b in bounds[1:-1] if u > b)
            c.v[y][x] += (H(pi, seed, 3) - 0.5) * 0.16
    # 앞면 주름: 짧은 가로 호(아래 어둡고 위 밝은 1화소), 밑동으로 갈수록 잦다
    rr = np.random.default_rng(seed)
    for i in range(int(rx * 2.2)):
        f = 0.35 + rr.random() * 0.6
        y = int(ay + f * hgt)
        u0 = rr.uniform(-0.8, 0.75)
        x0 = int(cxx(y) + u0 * half(y)); L = 2 + int(rr.random() * 3)
        for j in range(L):
            xx = x0 + j; yy = y + (1 if 0 < j < L - 1 else 0)
            if inside(xx, yy) is not None and inside(xx, yy - 1) is not None:
                c.darken(xx, yy, 1); c.lighten(xx, yy - 1, 1)
    if patch:            # 덧댄 가죽 조각(다른 가죽, 바늘땀 테)
        px0, py0, pw, ph_, pm = patch
        for y in range(py0, py0 + ph_):
            for x in range(px0, px0 + pw):
                if inside(x, y) is None: continue
                edge = x in (px0, px0 + pw - 1) or y in (py0, py0 + ph_ - 1)
                c.tone(x, y, pm, 3 if edge else (4 if x < px0 + pw // 2 else 3))
                if edge and (x + y) % 2 == 0: c.tone(x, y, pm, 5)
    # 입구: 어두운 삼각 구멍 + 오른쪽으로 걷어 올린 휘장 자락
    dty = int(ay + hgt * 0.42)
    dcx = cx + door_dx
    dwb = rx * door_w
    c.group(2); c.new()
    for y in range(dty, int(by + ry * 0.55) + 1):
        f = (y - dty) / max(1, (by - dty))
        hw = 0.6 + dwb * min(1.0, f)
        for x in range(int(dcx - hw) - 1, int(dcx + hw) + 2):
            if abs(x + 0.5 - dcx) <= hw and inside(x, y) is not None:
                t = 1 if abs(x + 0.5 - dcx) < hw - 1.2 else 2
                if y > by: t = 1
                c.tone(x, y, 'dark', t)
    # 휘장 자락: 입구 오른쪽 테를 따라 밝은 접힌 가장자리, 그 바깥 한 줄 어두운 접힘 그늘
    for y in range(dty + 1, int(by) + 1):
        f = (y - dty) / max(1, (by - dty)); hw = 0.6 + dwb * f
        xr = int(dcx + hw); xl = int(dcx - hw)
        c.tone(xr, y, mat, 6 if y % 4 else 5); c.tone(xr + 1, y, mat, 2)
        c.tone(xl, y, mat, 5)
    # 걷어 묶은 휘장 뭉치(오른쪽 위) + 묶은 끈
    rx0, ry0 = int(dcx + dwb * 0.55), dty + 3
    c.group(3); c.new(); c.ellipsoid(rx0 + 1.5, ry0 + 1, 2.6, 2.0, mat, amb=0.35, bias=0.08)
    c.tone(rx0, ry0 + 1, 'rope', 3); c.tone(rx0 + 1, ry0 + 2, 'rope', 3)
    # 아랫단 누름돌
    c.group(4)
    nst = int(rx * 0.9)
    for i in range(nst):
        a = math.pi * (0.06 + 0.88 * (i + 0.5) / nst)
        x = cx - math.cos(a) * (rx - 1.2); y = by + math.sin(a) * (ry - 0.6)
        if abs(x - dcx) < dwb + 1.5: continue
        c.new(); c.ellipsoid(x, y, 2.2 + H(i, seed) * 0.8, 1.6, 'stone', amb=0.25, bump=0.4)
    # 꼭대기 뼈대 기둥: 꼭대기에서 위로 벌어져 나온다(마디 혹 끝)
    c.group(5)
    for k, (dx, dy) in enumerate(poles):
        c.new()
        x0, y0 = cx + dx * 0.15, ay + 2; x1, y1 = cx + dx, ay + dy
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            f = i / n; x = int(round(x0 + (x1 - x0) * f)); y = int(round(y0 + (y1 - y0) * f))
            c.tone(x, y, pole_mat, 5 if dx < 0 else 4)
            if f > 0.2: c.tone(x + (1 if dx >= 0 else -1), y, pole_mat, 3 if dx >= 0 else 4)
        c.tone(int(round(x1)), int(round(y1)) - 1, pole_mat, 6)
        c.tone(int(round(x1)) + (1 if dx >= 0 else -1), int(round(y1)) - 1, pole_mat, 4)
    # 꼭대기 묶음 끈
    c.group(6); c.new()
    for x in range(int(cx) - 2, int(cx) + 2): c.tone(x, int(ay) + 2, 'rope', 4 if x < cx else 3)
    im = F(c)
    return im


def hide_tent_large():
    return _cone_tent(48, 56, 24, 12, 47, 20, 6.5, 'hide', 701, door_dx=-1, patch=(31, 32, 5, 6, 'hide2'))


def hide_tent_small():
    return _cone_tent(32, 44, 16, 9, 37, 13, 4.6, 'hide2', 702, door_dx=1, door_w=0.46,
                      poles=((-4, -6), (2, -7), (5, -5)), seams=(-0.5, 0.05, 0.55), lean=-0.25)


# ---------------------------------------------------------------- 움집(땅을 파고 이엉을 덮은 집)
def _thatch_cone(c, cx, ay, by, rx, ry, seed, bands=(0.32, 0.64)):
    """이엉 원뿔 지붕: 층층이 엮은 짚(층마다 아래 끝이 어둡고 짚 결이 세로로), 묶은 띠, 왼쪽 밝음."""
    hgt = by - ay
    def half(y):
        f = (y + 0.5 - ay) / hgt
        return rx * (f ** 0.82)
    def inside(x, y):
        if y < ay: return None
        if y <= by:
            h = half(y)
            if h < 0.5: return None
            u = (x + 0.5 - cx) / h; return u if abs(u) <= 1 else None
        dy = (y + 0.5 - by) / ry; u = (x + 0.5 - cx) / rx
        return u if u * u + dy * dy <= 1 else None
    c.new()
    for y in range(int(ay), int(by + ry) + 1):
        for x in range(c.w):
            u = inside(x, y)
            if u is None: continue
            f = min(1.0, (y + 0.5 - ay) / hgt)
            # 층: 원뿔을 따라 처진 가로 띠(4화소)
            sag = (1 - u * u) * 1.6
            ph = (y - sag - ay) / 4.0
            layer = math.floor(ph); lp = ph - layer
            v = 0.84 - 0.42 * (u + 1) / 2 - 0.06 * f
            if lp > 0.72: v -= 0.26                           # 층 아래 끝 그늘
            elif lp < 0.22: v += 0.06
            # 짚 결: 세로로 듬성듬성 밝고 어두운 가닥
            g = H(x, layer, seed)
            if g > 0.82: v += 0.10
            elif g < 0.14: v -= 0.12
            c.setv(x, y, 'rope', v)
    # 묶은 띠(덩굴 끈)
    for bf in bands:
        y0 = ay + bf * hgt
        for x in range(c.w):
            for y in range(int(y0) - 1, int(y0) + 3):
                u = inside(x, y)
                if u is None: continue
                sag = (1 - u * u) * 1.6
                if abs(y - (y0 + sag)) < 0.8: c.tone(x, y, 'bark', 4 if u < -0.2 else (3 if u < 0.5 else 2))
    # 처마 끝: 들쭉날쭉 삐친 짚(아래쪽)
    for x in range(c.w):
        for y in range(int(by + ry) + 2, int(ay), -1):
            if inside(x, y) is not None:
                if H(x, seed, 9) > 0.45: c.tone(x, y + 1, 'rope', 3 if x > cx else 4)
                break
    return inside


def _pit_house(W, Hh, cx, ay, by, rx, ry, seed, porch_w=10):
    c = C(W, Hh, seed=seed)
    c.shadow(cx + 3, by + ry - 1, rx + 3, ry * 0.85, 100)
    # 흙둑(움집 둘레 파낸 흙을 쌓은 낮은 둔덕): 지붕보다 조금 넓은 타원 고리, 위로 잔풀
    c.group(1); c.new()
    for y in range(int(by - ry * 0.4), int(by + ry + 3) + 1):
        for x in range(W):
            dx = (x + 0.5 - cx) / (rx + 3.5); dy = (y + 0.5 - (by + 1)) / (ry + 2.2)
            r = dx * dx + dy * dy
            if r <= 1 and y > by - 2:
                v = 0.62 - 0.25 * dx - 0.15 * dy
                c.setv(x, y, 'dirt', v)
    c.group(2)
    inside = _thatch_cone(c, cx, ay, by, rx, ry, seed)
    # 연기 구멍 덮개(꼭대기의 작은 박공 가리개 + 엇갈린 막대)
    c.group(3); c.new()
    for (dx, dy, t) in ((-3, -3, 5), (-2, -4, 5), (-1, -5, 5), (0, -6, 4), (1, -5, 3), (2, -4, 3), (3, -3, 3)):
        c.tone(int(cx + dx), int(ay + 4 + dy), 'bark', t)
    for y in range(int(ay) + 1, int(ay) + 4):
        for x in range(int(cx) - 2, int(cx) + 3):
            if abs(x + 0.5 - cx) <= (y - ay) * 0.9: c.tone(x, y, 'rope', 5 if x < cx else 3)
    c.tone(int(cx), int(ay) + 2, 'dark', 1); c.tone(int(cx) - 1, int(ay) + 3, 'dark', 2)
    # 앞 출입 고깔(작은 박공 지붕) + 어두운 문간 + 통나무 계단(흙둑을 파고 내려간다)
    pw = porch_w; py = int(by - ry * 0.2)
    c.group(4); c.new()
    gy0 = py - 9
    for y in range(gy0, py + 4):
        for x in range(int(cx - pw / 2) - 1, int(cx + pw / 2) + 2):
            ddx = x + 0.5 - cx
            top = gy0 + abs(ddx) * 0.95
            if y >= top and abs(ddx) <= pw / 2 + 0.5 and y < top + 4:
                lp = (y - top)
                t = 5 if ddx < 0 else 3
                if lp >= 3: t -= 2
                if H(x, y, seed + 4) > 0.8: t += 1
                c.tone(x, y, 'rope', max(1, min(6, t)))
    # 문간
    c.group(5); c.new()
    for y in range(gy0 + 4, py + 5):
        for x in range(int(cx - pw / 2) + 1, int(cx + pw / 2)):
            ddx = x + 0.5 - cx
            if y >= gy0 + 3 + abs(ddx) * 0.95:
                c.tone(x, y, 'dark', 1 if abs(ddx) < pw / 2 - 2.2 else 2)
    # 문틀 기둥(껍질 벗긴 통나무)
    for xs in (int(cx - pw / 2), int(cx + pw / 2) - 1):
        for y in range(gy0 + int(pw / 2) + 1, py + 5): c.tone(xs, y, 'bark', 5 if xs < cx else 3)
    # 통나무 계단 두 단(흙둑을 판 자리)
    c.group(6)
    for k, yy in enumerate((py + 5, py + 8)):
        c.new(); c.hcyl(cx - pw / 2 + 1 - k, cx + pw / 2 - 1 + k, yy, 1.4, 'bark', amb=0.3, endcap='L', capmat='cream')
    for y in range(py + 5, py + 10):
        for x in range(int(cx - pw / 2) + 1, int(cx + pw / 2)):
            if c.m[y][x] is None: c.tone(x, y, 'dirt', 2)
    im = F(c); px = im.load()
    tufts(px, W, Hh, int(cx - rx - 3), int(cx - pw / 2 - 1), int(by + ry + 2), seed + 7, 0.45, 3)
    tufts(px, W, Hh, int(cx + pw / 2 + 2), int(cx + rx + 3), int(by + ry + 2), seed + 8, 0.45, 3)
    return im


def pit_house_large():
    return _pit_house(64, 56, 32, 10, 42, 27, 8.0, 711, porch_w=12)


def pit_house_small():
    return _pit_house(48, 44, 24, 9, 33, 19, 6.0, 712, porch_w=10)


# ---------------------------------------------------------------- 가죽 바람막이(나뭇가지 틀에 가죽을 걸친 반쪽 지붕)
def hide_lean_to():
    W, Hh = 48, 36
    c = C(W, Hh, seed=721); c.shadow(26, 31, 21, 3.2, 90)
    # 뒤로 기운 지붕면(가죽 두 장 이어 붙임): 윗변(뒤) y=6, 앞 처마 y=22
    c.group(1); c.new()
    for y in range(6, 24):
        for x in range(5, 44):
            f = (y - 6) / 17.0
            xl = 9 - f * 3; xr = 39 + f * 3
            if xl <= x < xr:
                u = (x - xl) / (xr - xl)
                v = 0.55 + 0.32 * f - 0.12 * u
                mat = 'hide' if x < 25 else 'hide2'
                c.setv(x, y, mat, v)
    for y in range(6, 24): c.darken(25, y, 1); c.lighten(24, y, 1) if y % 3 == 0 else None    # 이음 바늘땀
    for (x0, y0, L) in ((12, 11, 4), (30, 9, 3), (18, 16, 3), (34, 17, 4), (14, 20, 3)):          # 주름
        for j in range(L): c.darken(x0 + j, y0, 1); c.lighten(x0 + j, y0 - 1, 1)
    # 처마 아래 그늘 속(어두운 안쪽) + 바닥 털가죽 자리
    c.group(2); c.new()
    for y in range(24, 31):
        for x in range(6, 43):
            if 6 + (y - 24) * 0.3 <= x < 43 - (y - 24) * 0.3: c.tone(x, y, 'dark', 2 if y < 27 else 3)
    c.new(); c.ellipsoid(25, 29, 11, 2.2, 'fur', amb=0.35, bias=-0.05, bump=0.6)
    # 앞 기둥 둘(갈래 진 나뭇가지) + 처마 가로대
    c.group(3)
    for x in (7, 40):
        limb(c, [(x, 32), (x + (1 if x < 20 else -1), 23)], [1.4, 1.2], 'bark', 722)
        c.tone(x - 1, 21, 'bark', 5); c.tone(x + 2, 21, 'bark', 3)
    c.group(4); c.new()
    for x in range(4, 45): c.tone(x, 22, 'bark', 5 if x < 24 else 4); c.tone(x, 23, 'bark', 2)
    # 지붕 위에 얹은 누름 나뭇가지·뼈
    c.group(5); c.new()
    for k in range(18): c.tone(10 + k, 9 + k // 6, 'bark', 4)
    for k in range(14): c.tone(28 + k, 12 - k // 7, 'bone', 5 if k % 4 else 4)
    im = F(c); px = im.load()
    tufts(px, W, Hh, 2, 46, 33, 723, 0.4, 3)
    return im


# ---------------------------------------------------------------- 엄니 문(마을 어귀): 길 양쪽에 박은 큰 엄니 둘이 위에서 맞닿아 묶였다
def tusk_arch():
    W, Hh = 80, 72
    c = C(W, Hh, seed=731)
    c.shadow(12, 66, 7, 2.4, 100); c.shadow(68, 66, 7, 2.4, 100)

    def tusk(base_x, sgn, seed):
        # 밑동(굵다) → 위로 휘어 안쪽으로. 3/4: 원기둥 단면을 왼쪽 밝게
        pts = []
        for i in range(41):
            f = i / 40.0
            x = base_x + sgn * (f ** 1.6) * 24 + sgn * math.sin(f * 2.4) * 2.0
            y = 66 - f * 56 + (f ** 3) * 8
            r = 4.6 * (1 - f) ** 0.7 + 0.8
            pts.append((x, y, r))
        c.new()
        for (x, y, r) in pts:
            for yy in range(int(y - r) - 1, int(y + r) + 2):
                for xx in range(int(x - r) - 1, int(x + r) + 2):
                    d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                    if d <= r:
                        dx = (xx + 0.5 - x) / max(r, 0.6)
                        v = 0.80 - 0.42 * dx
                        c.setv(xx, yy, 'bone', v)
        # 나이테 같은 가로 결(상아 결) — 밑동 쪽에 몇 줄
        for (x, y, r) in pts[2:26:3]:
            for xx in range(int(x - r), int(x + r) + 1):
                if c.inb(xx, int(y)) and c.m[int(y)][xx] == 'bone': c.darken(xx, int(y), 1)
        return pts
    P1 = tusk(12, 1, 732); P2 = tusk(68, -1, 733)
    # 밑동을 묻은 돌무더기
    c.group(2)
    for (bx, sd) in ((12, 1), (68, 2)):
        for (dx, dy, r) in ((-6, 0, 3.2), (-2, 2, 3.6), (3, 1.5, 3.4), (6, -0.5, 2.8), (0, -1.5, 3.0)):
            c.new(); c.ellipsoid(bx + dx, 64 + dy, r, r * 0.72, 'stone', amb=0.22, bump=0.45)
    # 꼭대기 맞닿은 자리: 덩굴 끈으로 감아 묶음 + 늘어뜨린 깃털·뼈 장식
    tx = 40; ty = 13
    c.group(3); c.new()
    for y in range(ty - 4, ty + 5):
        for x in range(tx - 5, tx + 6):
            if (x + 0.5 - tx) ** 2 / 25 + (y + 0.5 - ty) ** 2 / 18 <= 1:
                c.tone(x, y, 'rope', 5 if (x + y) % 3 else 3)
                if (y - ty + 4) % 3 == 0: c.tone(x, y, 'rope', 2)
    c.group(4)
    for k, (hx_, L, m) in enumerate(((36, 12, 'hide2'), (40, 16, 'rope'), (44, 11, 'hide'))):
        c.new()
        for j in range(L):
            x = hx_ + (1 if j > L // 2 and k == 0 else 0)
            c.tone(x, ty + 5 + j, 'rope', 3)
        # 끈 끝 장식: 깃털 / 이빨 / 가죽 술
        ey = ty + 5 + L
        if k == 0:
            for j in range(5): c.tone(hx_ + 1, ey + j, 'cream', 6 if j < 2 else 5); c.tone(hx_ + 2, ey + j, 'hide2', 3)
        elif k == 1:
            for j in range(4): c.tone(40, ey + j, 'bone', 6 if j < 2 else 5); c.tone(41, ey + j, 'bone', 4)
            c.tone(40, ey + 4, 'bone', 4)
        else:
            for j in range(4):
                for i in (-1, 0, 1): c.tone(hx_ + i, ey + j, m, 5 if i < 0 else 3)
    im = F(c); px = im.load()
    tufts(px, W, Hh, 2, 22, 68, 734, 0.45, 3); tufts(px, W, Hh, 58, 78, 68, 735, 0.45, 3)
    return im
