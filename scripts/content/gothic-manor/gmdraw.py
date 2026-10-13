"""gothic_manor 그리기 도우미 — 고딕 건축(석재·벽돌·슬레이트·첨두창·담쟁이)과 3/4 입체.

빛은 왼쪽 위. 모든 면은 재질 램프(gmlib.RAMPS)의 단으로만 칠한다. 질감은 잡음이 아니라 «덩이»(돌 블록·기와·잎 뭉치)로 만든다.
좌표는 px. 조각 모듈은 `from gmdraw import *` 로 쓴다.
"""
import math, random
from gmlib import Cv, K, OL, OL2, RAMPS


def hsh(x, y, s=0):
    """0..1 결정적 해시(이음새 없는 질감용)."""
    n = (int(x) * 374761393 + int(y) * 668265263 + int(s) * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65536.0


def tone(m, t):
    return K(m, t)


# ───────────────────────── 면 질감 ─────────────────────────
def masonry(c, x, y, w, h, m='stone', base=3, seed=0, course=4, blen=(5, 10), period=None, mask=None, light_left=True, wear=0.10, mortar_t=None):
    """다듬은 돌 쌓기. 코스(줄) 높이 course, 블록 길이 blen. 블록마다 단 흔들림 · 윗/왼 모서리 빛 · 아래/오른 줄눈 · 드문 깨짐.
    period: x 방향 반복 폭(이어 붙이는 칸). mask(x,y)->bool 이면 그 안만 칠한다."""
    mt = (base - 2) if mortar_t is None else mortar_t
    rows = (h + course - 1) // course
    for r in range(rows):
        y0 = y + r * course
        y1 = min(y + h, y0 + course)
        rnd = random.Random(seed * 1000 + r * 37 + (y0 if period is None else 0))
        off = (r * 3 + seed) % blen[1]
        bx = -off
        span = period or w
        blocks = []
        while bx < span:
            bl = rnd.randint(*blen)
            blocks.append((bx, bl, base + rnd.choice((0, 0, 0, 1, -1, 0))))
            bx += bl
        if period:
            # 마지막 블록이 period 를 넘으면 첫 블록과 이어지게 잘라 붙인다
            pass
        for bx, bl, t in blocks:
            for xx in range(bx, bx + bl):
                for yy in range(y0, y1):
                    px = x + (xx % span if period else xx)
                    if not (x <= px < x + w): continue
                    if mask and not mask(px, yy): continue
                    col = K(m, t)
                    if yy == y1 - 1 or xx == bx + bl - 1: col = K(m, mt)                       # 줄눈(아래·오른)
                    elif yy == y0 and light_left: col = K(m, t + 1)                             # 윗 모서리 빛
                    elif xx == bx and light_left: col = K(m, t + 1) if yy < y1 - 2 else K(m, t)  # 왼 모서리 빛
                    elif yy == y1 - 2 and xx > bx + 1: col = K(m, t - 1) if hsh(px, yy, seed) < .5 else K(m, t)
                    c.P(px, yy, col)
            # 깨짐·얼룩
            if wear and rnd.random() < wear * 3:
                px = x + ((bx + rnd.randint(1, max(1, bl - 2))) % span if period else bx + rnd.randint(1, max(1, bl - 2)))
                py = y0 + rnd.randint(1, max(1, course - 2))
                if x <= px < x + w and (not mask or mask(px, py)): c.P(px, py, K(m, t - 1))


def bricks(c, x, y, w, h, m='brick', base=3, seed=0, course=3, blen=6, mask=None, period=None):
    """벽돌: 줄 높이 3(2 + 줄눈), 엇갈린 반 장. 장마다 단 흔들림."""
    rows = (h + course - 1) // course
    for r in range(rows):
        y0 = y + r * course; y1 = min(y + h, y0 + course)
        off = (blen // 2) * (r % 2)
        for xx in range(x, x + w):
            lx = (xx - x + off) if period is None else ((xx + off) % period)
            bi = lx // blen; bx = lx % blen
            t = base + (1 if hsh(bi, r, seed) > .82 else -1 if hsh(bi, r, seed + 5) < .18 else 0)
            for yy in range(y0, y1):
                if mask and not mask(xx, yy): continue
                if yy == y1 - 1 or bx == blen - 1: col = K('stone', 1) if m == 'brick' else K(m, base - 2)
                elif yy == y0 and bx < blen - 2: col = K(m, t + 1)
                else: col = K(m, t)
                c.P(xx, yy, col)


def planks_v(c, x, y, w, h, m='wood', base=3, width=3, seed=0):
    """세로 판재(문·헛간 벽)."""
    for xx in range(x, x + w):
        k = (xx - x) // width; lx = (xx - x) % width
        t = base + (1 if hsh(k, 1, seed) > .7 else -1 if hsh(k, 2, seed) < .25 else 0)
        for yy in range(y, y + h):
            col = K(m, t)
            if lx == width - 1: col = K(m, base - 2)
            elif lx == 0: col = K(m, t + 1)
            if hsh(xx, yy, seed + 9) < .04: col = K(m, t - 1)
            c.P(xx, yy, col)


# ───────────────────────── 슬레이트 지붕 ─────────────────────────
def slate_ew(c, x0, x1, y_ridge, y_eave, m='slate', seed=0, mask=None, lit=(5, 2), moss=0.0, tw=5, th=3):
    """동서 용마루 지붕의 앞 경사면(남쪽): 가로 코스. 용마루 쪽 밝게(lit[0]) → 처마 쪽 어둡게(lit[1]).
    기와 한 장 = tw×th, 엇갈림. 각 장: 아래 줄 그늘, 왼 위 빛 한 점, 장마다 단 흔들림. mask(x,y) 로 모양을 자른다."""
    H = max(1, y_eave - y_ridge)
    for yy in range(y_ridge, y_eave):
        r = (yy - y_ridge) // th; ry = (yy - y_ridge) % th
        g = lit[0] + (lit[1] - lit[0]) * (yy - y_ridge) / H
        for xx in range(x0, x1):
            if mask and not mask(xx, yy): continue
            lx = xx + (tw // 2) * (r % 2)
            ti = lx // tw; tx = lx % tw
            j = hsh(ti, r, seed)
            t = round(g + (0.6 if j > .85 else -0.7 if j < .15 else 0))
            if ry == th - 1: t -= 2                       # 장 아랫단 그림자(다음 줄이 덮는 선)
            elif tx == tw - 1: t -= 1                     # 장 사이 틈
            elif ry == 0 and tx == 0: t += 1              # 왼 위 빛
            col = K(m, t)
            c.P(xx, yy, col)
    if moss: moss_patches(c, x0, x1, y_ridge + 3, y_eave - 1, int((x1 - x0) * (y_eave - y_ridge) * moss / 14), seed=seed)


def slate_ns(c, xl, xr, cx, top_fn, bot_fn, m='slate', seed=0, lit=(5, 4), shade=(3, 2), tw=4, th=5, slope=1.0, moss=0.0):
    """남북 용마루 지붕(박공이 앞을 보는 지붕)의 두 경사면. 코스는 세로(남북) 띠(폭 tw), 장 경계는 박공 변과 나란한 사선(기울기 slope).
    top_fn(x)/bot_fn(x) = 그 열의 칠할 y 범위. cx 왼쪽 경사면은 밝게(lit: 용마루→처마), 오른쪽은 그늘(shade)."""
    for xx in range(xl, xr):
        y0, y1 = int(round(top_fn(xx))), int(round(bot_fn(xx)))
        left = xx + .5 < cx
        s = abs(xx + .5 - cx)
        span = max(1.0, (cx - xl) if left else (xr - cx))
        d = min(1.0, s / span)
        a, b = (lit if left else shade)
        g = a + (b - a) * d
        strip = int(s) // tw; sx = int(s) % tw
        for yy in range(y0, y1):
            n = yy - s * slope + (strip % 2) * (th // 2) + 1000
            k = int(n // th); ry = int(n) % th
            j = hsh(strip * (1 if left else -1), k, seed)
            t = g + (0.7 if j > .86 else -0.7 if j < .14 else 0)
            if ry == th - 1: t -= 2                      # 장 아래 끝 그늘
            elif sx == tw - 1: t -= 1.2                  # 띠 사이 틈
            elif ry == 0 and sx == 0: t += 1
            t = int(round(t))
            col = K(m, t)
            if moss and hsh(strip * 7 + (0 if left else 3), k, seed + 9) < moss and ry < th - 1:
                col = K('ivy', 2 + (1 if ry == 0 else 0) + (1 if left else 0))
            c.P(xx, yy, col)


# ───────────────────────── 고딕 창·문 ─────────────────────────
def arch_profile(w, rise=None):
    """폭 w 첨두 아치의 열별 꼭대기 오프셋(0 = 가장 높은 꼭대기, 아래로 +). 두 원의 교차(반지름 w)."""
    R = float(w) if rise is None else rise
    out = []
    for i in range(w):
        xc = i + .5
        d = (w - xc) if xc < w / 2 else xc
        top = R - math.sqrt(max(0.0, R * R - d * d))
        out.append(top)
    m = min(out)
    hmax = max(out) - m
    return [int(round(t - m)) for t in out], hmax


def lancet(c, x, y, w, h, lit=False, frame='stone', fb=4, mull=False, sill=True, seed=0, glow_lvl=0):
    """첨두창: (x,y) 왼위, 바깥 틀 포함 w×h. 석재 틀(밝은 왼·위, 어두운 오른), 안쪽 유리(밤 유리 또는 촛불빛), 창살·반사.
    lit: 불 켜진 창. mull: 가운데 세로 창살 + 위 트레이서리."""
    prof, rise = arch_profile(w)
    # 틀
    for i in range(w):
        for yy in range(y + prof[i], y + h):
            c.P(x + i, yy, K(frame, fb))
    for i in range(w):
        c.P(x + i, y + prof[i], K(frame, fb + 1))
    c.VL(x + w - 1, y + prof[-1] + 1, h - prof[-1] - 1, K(frame, fb - 1))
    # 유리
    gw = w - 2
    if gw >= 1:
        gp, _ = arch_profile(gw)
        for i in range(gw):
            for yy in range(y + 1 + gp[i] + (1 if gw > 2 else 0), y + h - (2 if sill else 1)):
                if lit:
                    d = (yy - y) / h
                    t = 5 if d < .35 else 4 if d < .7 else 3
                    if i == gw - 1: t -= 1
                    col = K('glow', t + glow_lvl)
                else:
                    t = 2 if (yy - y) < h * .45 else 1
                    if i == 0: t += 1
                    col = K('glass', t)
                c.P(x + 1 + i, yy, col)
        # 반사·창살
        if not lit:
            c.P(x + 1, y + 3 + gp[0], K('glass', 5)); c.P(x + 1, y + 4 + gp[0], K('glass', 4))
        if mull and gw >= 3:
            mx = x + w // 2
            c.VL(mx, y + 2, h - 3, K(frame, fb - 1 if lit else fb - 1))
            c.P(mx, y + 2, K(frame, fb))
        hb = y + h // 2 + 1
        if gw >= 3 and h >= 12:
            for i in range(gw):
                c.P(x + 1 + i, hb, K(frame, fb - 2 if not lit else fb - 1))
    if sill:
        c.HL(x - 1, y + h - 1, w + 2, K(frame, fb + 1)); c.HL(x - 1, y + h, w + 2, K(frame, fb - 2))


def rose(c, cx, cy, r, lit=False, frame='stone', fb=4):
    """장미창: 두꺼운 원형 석재 틀(왼위 밝음) + 8잎 창살 + 색유리(보라·녹청·검붉음 번갈아)."""
    c.ellipse(cx, cy, r + 2, r + 2, K(frame, fb - 2))
    c.ellipse(cx, cy, r + 1.5, r + 1.5, K(frame, fb))
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if r + .3 < d <= r + 1.6 and (x + .5 - cx) + (y + .5 - cy) < -1: c.P(x, y, K(frame, fb + 1))
    glass = ('violet', 'teal', 'velvet', 'teal') if not lit else ('glow', 'gold', 'glow', 'gold')
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + .5 - cx, y + .5 - cy; d = math.hypot(dx, dy)
            if d > r: continue
            seg = int(((math.atan2(dy, dx) + math.pi) / (2 * math.pi)) * 8 + .5) % 8
            m = glass[seg % 4]
            t = (3 if lit else 2) + (1 if dy < 0 and dx < 0 else 0)
            if d < r * .38: m, t = glass[0], t + 1
            c.P(x, y, K(m, t))
    for k in range(8):
        a = k * math.pi / 4
        for s in range(1, int(r) + 1):
            c.P(int(cx + math.cos(a) * s), int(cy + math.sin(a) * s), K(frame, fb - 1))
    c.ellipse(cx, cy, r * .38, r * .38, K(frame, fb - 1), fill=False)
    c.P(int(cx), int(cy), K(frame, fb + 1))


def gothic_door(c, x, y, w, h, m='wood', frame='stone', fb=4, iron=True, open_=False, seed=0):
    """첨두 아치 문: 석재 문틀 2px + 세로 판재 문(쇠 띠·고리). open_ 이면 어두운 안."""
    prof, rise = arch_profile(w)
    for i in range(w):
        for yy in range(y + prof[i], y + h):
            c.P(x + i, yy, K(frame, fb))
        c.P(x + i, y + prof[i], K(frame, fb + 1))
    c.VL(x + w - 1, y + prof[-1], h - prof[-1], K(frame, fb - 1))
    iw = w - 4
    ip, _ = arch_profile(iw)
    for i in range(iw):
        for yy in range(y + 2 + ip[i], y + h):
            if open_: col = K('ink', 1 if yy > y + 2 + ip[i] + 1 else 2)
            else:
                k = i // 3; lx = i % 3
                t = 3 + (1 if hsh(k, 0, seed) > .6 else 0)
                col = K(m, t if lx else t + 1)
                if lx == 2: col = K(m, 1)
            c.P(x + 2 + i, yy, col)
    if not open_ and iron and iw >= 4:
        for by in (y + 2 + rise // 2 + 3, y + h - 4):
            c.HL(x + 2, by, iw, K('iron', 2)); c.HL(x + 2, by - 1, iw, K('iron', 4))
        c.P(x + 2 + iw - 2, y + h - 8, K('gold', 4)); c.P(x + 2 + iw - 2, y + h - 7, K('gold', 2))
    c.HL(x - 1, y + h, w + 2, K(frame, fb - 2))


# ───────────────────────── 담쟁이·이끼 ─────────────────────────
LEAF = ((0, 0), (1, 0), (0, 1), (-1, 0), (0, -1))


def ivy_clump(c, cx, cy, r=2, seed=0, keep=None):
    """잎 뭉치 하나: 아래는 어둡게, 왼 위는 밝게. keep(x,y) 가 False 인 곳은 칠하지 않는다(벽 밖)."""
    rnd = random.Random(seed)
    for dy in range(-r, r + 1):
        for dx in range(-r - 1, r + 2):
            if dx * dx * .7 + dy * dy > r * r + .5: continue
            if rnd.random() < .15: continue
            x, y = cx + dx, cy + dy
            if keep and not keep(x, y): continue
            t = 3 + (1 if dy < 0 else 0) + (1 if dx < 0 and dy <= 0 else 0) - (1 if dy == r else 0)
            if rnd.random() < .12: t += 1
            c.P(x, y, K('ivy', t))
    c.P(cx - 1, cy - 1, K('ivy', 6))


def ivy(c, x, y_base, height, spread=6, seed=0, keep=None, density=1.0):
    """바닥에서 위로 타고 오르는 담쟁이: 줄기 + 잎 뭉치(위로 갈수록 성기게)."""
    rnd = random.Random(seed)
    stems = [x + rnd.randint(-spread // 2, spread // 2) for _ in range(2)]
    for sx in stems:
        yy = y_base; xx = sx
        while yy > y_base - height:
            if keep is None or keep(xx, yy): c.P(xx, yy, K('ivy', 1))
            yy -= 1
            if rnd.random() < .3: xx += rnd.choice((-1, 1))
    n = int(height * spread / 9 * density)
    for k in range(n):
        f = rnd.random() ** 1.6
        cy = int(y_base - f * height)
        w = spread * (1 - f * .6)
        cx = int(x + rnd.uniform(-w, w))
        ivy_clump(c, cx, cy, r=rnd.choice((1, 2, 2)), seed=seed * 31 + k, keep=keep)


def moss_patches(c, x0, x1, y0, y1, n, seed=0):
    """지붕·돌 윗면의 이끼 덩이: 가로로 긴 불규칙 덩이(아래는 어둡고 위는 밝음), 칠해진 화소 위에만."""
    rnd = random.Random(seed + 991)
    for k in range(n):
        cx, cy = rnd.randint(x0, x1 - 1), rnd.randint(y0, y1 - 1)
        w = rnd.randint(2, 5); h = rnd.choice((1, 2, 2))
        for dy in range(h):
            for dx in range(-w // 2, w - w // 2):
                if abs(dx) == w // 2 and dy == h - 1 and rnd.random() < .5: continue
                x, y = cx + dx, cy + dy
                if c.opaque(x, y): c.P(x, y, K('ivy', (4 if dy == 0 else 2) + (1 if dx < 0 and dy == 0 else 0)))


def moss_top(c, x, y, w, seed=0, amount=.4):
    """돌 윗변에 낀 이끼 덩이(1~2px)."""
    for xx in range(x, x + w):
        h = hsh(xx, y, seed)
        if h < amount:
            c.P(xx, y, K('ivy', 4 if h < amount * .4 else 3))
            if h < amount * .3: c.P(xx, y + 1, K('ivy', 2))


def stains(c, x, y, w, h, m='stone', seed=0, amount=.06, t=1):
    """빗물 얼룩: 위에서 아래로 흐르는 짧은 어두운 줄."""
    for xx in range(x, x + w):
        if hsh(xx, seed, 3) < amount:
            L = int(2 + hsh(xx, seed, 4) * h * .5)
            for yy in range(y, min(y + h, y + L)):
                if c.opaque(xx, yy):
                    cur = c.get(xx, yy)
                    from gmlib import darker
                    c.P(xx, yy, darker(cur, 1))


# ───────────────────────── 3/4 입체 ─────────────────────────
def block3(c, x, y, w, top, front, m='stone', tb=5, fb=3, edge=True, outline=True, tex=None, seed=0):
    """윗면 top 행(밝음) + 앞면 front 행(어두움) 덩이. 뒷변 어두운 선(외곽선이 대신), 윗면 앞 모서리 밝은 선, 앞면 오른쪽 그늘.
    tex='masonry' 면 앞면에 돌 ��."""
    c.R(x, y, w, top, K(m, tb))
    for xx in range(x, x + w):
        for yy in range(y, y + top):
            if hsh(xx, yy, seed) < .08: c.P(xx, yy, K(m, tb - 1))
            elif hsh(xx, yy, seed + 1) > .95: c.P(xx, yy, K(m, tb + 1))
    c.HL(x, y + top - 1, w, K(m, tb + 1))           # 앞 모서리 빛
    if tex == 'masonry':
        masonry(c, x, y + top, w, front, m, fb, seed=seed, course=4, blen=(4, 8))
    else:
        c.R(x, y + top, w, front, K(m, fb))
        c.HL(x, y + top, w, K(m, fb - 1))
    c.VL(x + w - 1, y + top, front, K(m, fb - 1))
    c.VL(x, y + top, front, K(m, fb + 1))
    if edge: c.HL(x, y + top + front - 1, w, K(m, fb - 2))


def cyl3(c, cx, y, rx, ry, h, m='stone', tb=5, fb=3):
    """세운 원통: 위 타원 윗면 + 옆면(왼 밝음 → 오른 어둠) + 밑 곡선."""
    for yy in range(int(y + ry), int(y + ry + h)):
        for xx in range(int(cx - rx), int(math.ceil(cx + rx))):
            f = (xx + .5 - (cx - rx)) / (2 * rx)
            t = fb + (1 if f < .28 else 0 if f < .6 else -1 if f < .85 else -2)
            c.P(xx, yy, K(m, t))
    for xx in range(int(cx - rx), int(math.ceil(cx + rx))):
        dx = (xx + .5 - cx) / rx
        if abs(dx) <= 1:
            yb = y + ry + h + ry * math.sqrt(max(0, 1 - dx * dx)) - 1
            for yy in range(int(y + ry + h), int(yb) + 1):
                f = (xx + .5 - (cx - rx)) / (2 * rx)
                c.P(xx, yy, K(m, fb - 1 + (1 if f < .3 else 0) - (1 if f > .8 else 0)))
    c.ellipse(cx, y + ry, rx, ry, K(m, tb))
    c.ellipse(cx, y + ry, rx, ry, K(m, tb + 1), fill=False)
    for xx in range(int(cx), int(math.ceil(cx + rx))):
        for yy in range(int(y + ry), int(y + 2 * ry) + 1):
            pass


def texture_pass(c, mats=('stone', 'bone'), amt=.07, seed=0):
    """돌·대리석 면에 덩이진 결: 칠한 화소 중 그 램프 2~5단만 드물게 한 단 어둡게/밝게(2px 가로 덩이)."""
    from gmlib import RAMPS, darker, lighter
    idx = {}
    for m in mats:
        for i, col in enumerate(RAMPS[m]):
            if 2 <= i <= 5: idx[col] = m
    for y in range(c.h):
        for x in range(c.w):
            if not c.opaque(x, y): continue
            col = c.get(x, y)
            if col not in idx: continue
            h = hsh(x // 2, y, seed + 51)
            if h < amt: c.P(x, y, darker(col, 1))
            elif h > 1 - amt * .4: c.P(x, y, lighter(col, 1))


def finish(c, inset=False, tex=False):
    """유색 외곽선(바깥 1px). tex=True 면 먼저 돌 결을 입힌다."""
    if tex: texture_pass(c)
    c.outline(inset=inset)
