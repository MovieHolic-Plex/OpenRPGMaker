"""sf_station v2 그리기 도구(2026-10-14, Opus 손 도트 다시 그리기) — sf_core 위에 얹는 «재질·입체» 도구.

원칙(레포 최상급 wizarding_world·jp_city 가게 기준을 8배로 보고 맞춘 것):
  · 면마다 3단 이상: 윗면(뒤 모서리 어둡고·앞 모서리 밝은 턱) / 앞면(턱 밑 그늘 → 몸 → 바닥 AO) / 왼쪽 빛 기둥·오른쪽 그늘 기둥.
  · 큰 단색 면 금지 — 판 이음·리벳·솔결·눌린 패널(inset)·튀어나온 패널(raised)로 쪼갠다.
  · 화면·유리는 바탕 어둡게 + 내용(램프 2~3단) + 주사선 + 왼쪽 위 반사.
  · 천·쿠션은 둥근 모서리 + 위 밝은 줄 + 주름(파도 그늘) + 박음질 점.
  · 윤곽은 OL(검남색) 바깥 한 줄, 안쪽 경계는 재질 어두운 단.
"""
from sf_core import *

REDRAWN = set()


def piece2(*a, **kw):
    """sf_core.piece 와 같다 — 다시 그린 조각(Opus v2)이라고 표시한다."""
    REDRAWN.add(a[0])
    return piece(*a, **kw)


def rnd(c, x, y, w, h, col, r=1):
    """모서리 r 화소를 깎은 사각 채우기."""
    c.R(x + 1, y, w - 2, h, col); c.R(x, y + 1, 1, h - 2, col); c.R(x + w - 1, y + 1, 1, h - 2, col)   # 모서리는 칠하지 않는다(밑 그림이 비친다)


def box2(c, x, y, w, top, front, mat, topmat=None, tt=2, ft=-1, round_top=True, lipshadow=True, light=True, tex=None, seed=0):
    """입체 상자: 윗면(뒤 어둡게·앞 턱 밝게·왼 빛·오 그늘) + 앞면(턱 밑 그늘·몸·아래 AO·왼 빛·오 그늘). 윤곽은 부르는 쪽이 마지막에 c.outline()."""
    tm = topmat or mat
    c.R(x, y, w, top, K(tm, tt))
    c.HL(x, y, w, K(tm, tt - 2))
    if top >= 4: c.HL(x, y + 1, w, K(tm, tt - 1))
    c.HL(x, y + top - 1, w, K(tm, tt + 1))
    if light: c.VL(x, y + 1, top - 1, K(tm, tt + 1)); c.VL(x + w - 1, y + 1, top - 1, K(tm, tt - 1))
    if tex == 'brushed': brushed(c, x + 1, y + 2, w - 2, top - 3, tm, tt, seed)
    elif tex == 'plate': plating(c, x + 1, y + 1, w - 2, top - 2, tm, tt, pw=max(6, w // 3), ph=max(3, top - 2), seed=seed)
    fy = y + top
    c.R(x, fy, w, front, K(mat, ft))
    if front >= 3: c.R(x, fy + front - (front // 3), w, front // 3, K(mat, ft - 1))
    if lipshadow: c.HL(x, fy, w, K(mat, ft - 2))
    c.HL(x, fy + front - 1, w, K(mat, ft - 3))
    if light: c.VL(x, fy + 1, front - 2, K(mat, ft + 1)); c.VL(x + w - 1, fy + 1, front - 2, K(mat, ft - 2))
    if round_top: c.clear(x, y); c.clear(x + w - 1, y)
    return fy


def brushed(c, x, y, w, h, mat, t, seed=0):
    """솔결: 드문 가로 밝은 결(2~4화소) + 더 드문 어두운 점."""
    for j in range(h):
        k = hsh(j, seed, 11) % 5
        xx = x + k
        while xx < x + w - 2:
            ln = 2 + hsh(xx, j + y, seed) % 3
            if hsh(xx, j, seed + 3) % 3 == 0: c.HL(xx, y + j, min(ln, x + w - xx), K(mat, t + 1))
            xx += ln + 3 + hsh(xx, j, seed + 5) % 5


def plating(c, x, y, w, h, mat, t, pw=8, ph=6, seed=0, rivets=True):
    """판 이음 격자: 이음 = 어두운 줄(t-2) + 오른쪽/아래 밝은 줄(t+1), 판 모서리 리벳(t+2)."""
    for i in range(pw, w, pw):
        c.VL(x + i, y, h, K(mat, t - 2)); c.VL(x + i + 1, y, h, K(mat, t + 1)) if i + 1 < w else None
    for j in range(ph, h, ph):
        c.HL(x, y + j, w, K(mat, t - 2)); c.HL(x, y + j + 1, w, K(mat, t + 1)) if j + 1 < h else None
    if rivets:
        for i in range(0, w, pw):
            for j in range(0, h, ph):
                if i + 2 < w and j + 1 < h: c.P(x + i + 2, y + j + 1, K(mat, t + 2))


def inset(c, x, y, w, h, mat, t=0):
    """눌린 패널: 안쪽 위·왼 그늘(t-2), 아래·오 밝은 턱(t+1), 몸 t-1."""
    c.R(x, y, w, h, K(mat, t - 1)); c.HL(x, y, w, K(mat, t - 3)); c.VL(x, y, h, K(mat, t - 2))
    c.HL(x + 1, y + h - 1, w - 1, K(mat, t + 1)); c.VL(x + w - 1, y + 1, h - 1, K(mat, t))


def raised(c, x, y, w, h, mat, t=0):
    """튀어나온 패널: 위·왼 밝음(t+2), 아래·오 그늘(t-2), 몸 t."""
    c.R(x, y, w, h, K(mat, t)); c.HL(x, y, w, K(mat, t + 2)); c.VL(x, y, h, K(mat, t + 1))
    c.HL(x + 1, y + h - 1, w - 1, K(mat, t - 2)); c.VL(x + w - 1, y + 1, h - 1, K(mat, t - 2))


def monitor(c, x, y, w, h, col='cyan', kind='graph', s=0, bezel='cable'):
    """화면: 테두리(위 밝은 턱) + 어두운 바탕 + 내용(램프 3단) + 주사선 + 왼쪽 위 반사 두 점. 글자 없음."""
    c.R(x, y, w, h, K(bezel, 1)); c.HL(x, y, w, K(bezel, 3)); c.HL(x, y + h - 1, w, K(bezel, -1))
    ix, iy, iw, ih = x + 1, y + 1, w - 2, h - 2
    if iw < 1 or ih < 1: return
    c.R(ix, iy, iw, ih, K(col, -3))
    if kind == 'graph':
        for i in range(iw):
            v = 1 + hsh(i, s, 3) % max(1, ih - 1)
            for j in range(v): c.P(ix + i, iy + ih - 1 - j, K(col, 1 if j < v - 1 else 3))
    elif kind == 'wave':
        import math
        for i in range(iw):
            j = int(round((ih - 1) / 2 + (ih - 1) / 2.4 * math.sin((i + s) / 1.6)))
            c.P(ix + i, iy + j, K(col, 3)); c.P(ix + i, iy + min(ih - 1, j + 1), K(col, 0))
    elif kind == 'lines':
        for j in range(0, ih, 2): c.HL(ix + 1, iy + j, max(1, iw - 2 - hsh(j, s, 5) % max(1, iw // 2)), K(col, 2 if j else 3))
    elif kind == 'radar':
        cx, cy = ix + iw // 2, iy + ih // 2
        c.ell(cx, cy, max(1, iw // 2 - 1), max(1, ih // 2 - 1), K(col, -1)); c.ell(cx, cy, max(1, iw // 4), max(1, ih // 4), K(col, -2))
        c.line(cx, cy, cx + iw // 3, cy - ih // 3, K(col, 3)); c.P(cx - 1, cy + 1, K(col, 3))
    elif kind == 'map':
        for k in range(iw * ih // 6): c.P(ix + hsh(k, s, 1) % iw, iy + hsh(k, s, 2) % ih, K(col, 0))
        c.line(ix + 1, iy + ih - 2, ix + iw - 2, iy + 1, K(col, 2)); c.P(ix + iw - 2, iy + 1, K('orange', 3))
    elif kind == 'warn':
        c.R(ix, iy, iw, ih, K('orange', -1)); c.HL(ix, iy, iw, K('orange', 2))
        cx = ix + iw // 2
        for j in range(min(ih - 1, 4)): c.HL(cx - j, iy + 1 + j, 2 * j + 1, K('yellow', 2))
    elif kind == 'solid':
        c.R(ix, iy, iw, ih, K(col, 0)); c.HL(ix, iy, iw, K(col, 2))
    for j in range(1, ih, 2):                         # 주사선
        for i in range(iw):
            if hsh(ix + i, iy + j, 77) % 4 == 0 and c.has(ix + i, iy + j): c.P(ix + i, iy + j, K(col, -2))
    c.P(ix, iy, K('glow', 0)); c.P(ix + 1, iy, K(col, 3)) if iw > 2 else None


def pane(c, x, y, w, h, mat='glass', t=0, streaks=True):
    """유리판: 위 밝은 줄·아래 어두운 줄 + 대각 반사 두 줄."""
    for j in range(h): c.HL(x, y + j, w, K(mat, t + (1 if j == 0 else -1 if j >= h - 2 else 0)))
    if streaks:
        for k in range(min(w, h) + 2):
            if 0 <= k - 1 < h: c.P(x + 1 + k - 1 + w // 3, y + h - 1 - (k - 1), K(mat, t + 2)) if x + 1 + k - 1 + w // 3 < x + w else None
            if 0 <= k < h and x + w // 3 + 3 + k < x + w: c.P(x + w // 3 + 3 + k, y + h - 1 - k, K(mat, t + 1))


def cushion(c, x, y, w, h, mat, t=1, seam=True):
    """쿠션·매트: 둥근 모서리 + 위 밝은 줄 + 아래 그늘 + 가운데 박음질 점."""
    rnd(c, x, y, w, h, K(mat, t))
    c.HL(x + 1, y, w - 2, K(mat, t + 2)); c.HL(x + 1, y + 1, w - 2, K(mat, t + 1)) if h > 3 else None
    c.HL(x + 1, y + h - 1, w - 2, K(mat, t - 2)); c.VL(x + w - 1, y + 1, h - 2, K(mat, t - 1)); c.VL(x, y + 1, h - 2, K(mat, t + 1))
    c.P(x + 1, y + 1, K(mat, t + 3)) if h > 3 else None
    if seam and w > 6:
        for i in range(x + 2, x + w - 2, 2): c.P(i, y + h // 2, K(mat, t - 1))


def blanket(c, x, y, w, h, mat, t=0, s=0):
    """담요: 몸 t + 가로 주름(파도) + 접힌 위 가장자리(밝은 띠 2행)."""
    c.R(x, y, w, h, K(mat, t))
    c.HL(x, y, w, K(mat, t + 2)); c.HL(x, y + 1, w, K(mat, t + 1)); c.HL(x, y + 2, w, K(mat, t - 2))
    for j in range(4, h - 1, 3):
        for i in range(w):
            if (i + j + s) % 7 in (0, 1): c.P(x + i, y + j, K(mat, t - 1))
            elif (i + j + s) % 7 == 2: c.P(x + i, y + j - 1, K(mat, t + 1))
    c.HL(x, y + h - 1, w, K(mat, t - 2))


def leds(c, x, y, n, cols=('cyan', 'green', 'orange'), step=2, s=0):
    for i in range(n): c.P(x + i * step, y, K(cols[(i + s) % len(cols)], 3 if hsh(i, s, 4) % 3 else 1))


def grille(c, x, y, w, h, mat='cable', t=0):
    c.R(x, y, w, h, K(mat, t - 2))
    for j in range(0, h, 2): c.HL(x, y + j, w, K(mat, t + 1))
    c.VL(x, y, h, K(mat, t - 3))


def bolt(c, x, y, mat='hull', t=2):
    c.P(x, y, K(mat, t)); c.P(x + 1, y + 1, K(mat, t - 4))


def foot(c, x, y, w, mat='cable'):
    """받침 다리 띠: 앞면 아래 어두운 굽."""
    c.R(x, y, w, 2, K(mat, 0)); c.HL(x, y, w, K(mat, 2)); c.HL(x, y + 1, w, K(mat, -2))


def dome2(c, cx, cy, rx, ry, mat='glass', s=0, ribs=True):
    """유리 돔(반구를 위에서 비스듬히): 법선 조명(왼쪽 위 빛)으로 6단 + 측지선 리브(위선 2줄·경선 4줄, 둥근 호) + 반사 줄 + 가장자리 테."""
    import math
    for y in range(cy - ry, cy + 1):
        for x in range(cx - rx, cx + rx + 1):
            nx = (x - cx) / (rx + .5); ny = (y - cy) / (ry + .5)
            d = nx * nx + ny * ny
            if d > 1: continue
            nz = math.sqrt(max(0, 1 - d))
            li = -0.55 * nx - 0.45 * ny + 0.7 * nz
            t = 3 if li > .9 else 2 if li > .72 else 1 if li > .5 else 0 if li > .25 else -1 if li > 0 else -2
            c.P(x, y, K(mat, t))
    if ribs:
        for f in (0.45, 0.8):                                                 # 위선(높이 f)
            for x in range(cx - rx, cx + rx + 1):
                nx = (x - cx) / (rx + .5)
                r2 = f * f - nx * nx
                if r2 < 0: continue
                y = int(round(cy - ry * math.sqrt(1 - f * f) - 0)) if False else int(round(cy - math.sqrt(max(0, 1 - nx * nx)) * ry * (1 - f) - 0))
        for k in range(1, 3):                                                 # 위선: 꼭대기 둘레 동심 타원 호(뒤쪽 반)
            fr = k / 3
            for x in range(cx - int(rx * fr), cx + int(rx * fr) + 1):
                u = (x - cx) / (rx * fr + .5)
                if abs(u) > 1: continue
                yy = int(round(cy - ry * (1 - fr) * 0.9 - ry * fr * 0.0 + ry * fr * math.sqrt(max(0, 1 - u * u)) * 0.35 - ry * 0.25))
                if c.has(x, yy): c.P(x, yy, K('hull', 1 if x < cx else 0))
        for k in (-2, -1, 1, 2):                                             # 경선: 꼭대기(cx, cy-ry)에서 아래 가장자리로 휘는 호
            for t in range(0, ry + 1):
                v = t / ry; w = math.sin(v * math.pi / 2)
                x = int(round(cx + k / 2.6 * rx * w)); y = cy - ry + t
                if c.has(x, y) and y < cy: c.P(x, y, K('hull', 1 if k < 0 else 0))
    for k in range(4): c.P(cx - rx // 2 + k, cy - ry // 2 - k // 2, K('glow', 0 if k < 2 else 1))     # 반사 줄
    c.P(cx - rx // 2 - 1, cy - ry // 2 + 1, K(mat, 3))
    for x in range(cx - rx, cx + rx + 1):                                     # 가장자리 테(아래 호)
        u = (x - cx) / (rx + .5)
        if abs(u) <= 1: c.P(x, cy, K('hull', 2 if u < 0 else 0))
