"""snow_north 건물 부품 그리개 — 통나무 벽·판자 벽·창·문·눈 덮인 박공 지붕·처마 눈더미·고드름·굴뚝·벽밑 눈더미.

모든 무늬는 캔버스 좌표 기준 결정적(같은 입력 → 같은 화소). 빛은 왼쪽 위, 그늘은 푸른 보라.
한 층 = 2줄(32px). 사람 16×24 기준 문 열린 높이 24~26px.
"""
import math
from px import C, rnd, h32


# ═══════════════════════ 벽 ═══════════════════════
def _log_wall_base(c, x0, y0, w, h, s=0, base=4, ends=True):
    """가로 통나무 벽. 통나무 한 줄 4px(윗면 반사 · 몸 · 아래 그늘 · 틈), 줄마다 굵기 단이 조금 다르고 옹이·결.
    ends=True 면 양 끝에 엇갈려 튀어나온 통나무 머리(나이테 단면)를 그린다(벽 밖으로 1~2px)."""
    for j in range(h):
        row = j // 4; yy = j % 4
        dv = (h32(row, s, 3) % 3) - 1
        for i in range(w):
            t = base + dv
            if yy == 0: t += 1
            elif yy == 2: t -= 1
            elif yy == 3:
                if h32(i // 3, row, s + 7) % 6 == 0: c.P(x0 + i, y0 + j, 'snow', 4); continue     # 틈에 낀 눈
                c.P(x0 + i, y0 + j, 'log', 1); continue
            if yy == 1 and h32(i // 4 + row * 3, row, s + 9) % 5 == 0 and i % 4 != 3: t -= 1          # 결
            if i >= w - 3: t -= 1                                                                    # 오른쪽 끝 그늘
            c.P(x0 + i, y0 + j, 'log', max(1, min(6, t)))
        k = h32(row, s, 11) % max(1, w - 6)
        if yy == 1 and h32(row, s, 12) % 3 == 0:                                                     # 옹이
            c.P(x0 + 3 + k, y0 + j, 'log', 1); c.P(x0 + 4 + k, y0 + j, 'log', 2)
    if ends:
        for j in range(0, h, 4):
            row = j // 4; long_ = row % 2 == 0
            for side in (0, 1):
                ex = (x0 - (2 if long_ else 1)) if side == 0 else (x0 + w - (1 if long_ else 2))
                ew = 3
                for dy in range(min(4, h - j)):
                    for dx in range(ew):
                        X, Y = ex + dx, y0 + j + dy
                        if dy == 3: c.P(X, Y, 'log', 1); continue
                        ring = (dx == 1 and dy == 1)
                        t = (6 if side == 0 else 5) if not ring else 3
                        if dx == (0 if side == 0 else ew - 1) and dy in (0, 2): t -= 1
                        c.P(X, Y, 'log', t)
                    if dy == 0 and j > 0: c.P(ex + 1, y0 + j - 1, 'snow', 6)                         # 머리 위에 쌓인 눈 한 점


def log_wall(c, x0, y0, w, h, s=0, base=4, ends=True):
    """둥근 통나무 벽: 통나무 한 줄 4px = 윗 반사(6/5) · 몸(4, 껍질 결 점) · 아래 그늘(2) · 틈(0 + 낀 눈).
    줄마다 굵기 단·옹이·갈라진 결. 오른쪽 끝 그늘. 끝 머리(나이테 단면)는 옛 그리개와 같다."""
    _log_wall_base(c, x0, y0, w, h, s, base, ends)
    for j in range(h):
        row = j // 4; yy = j % 4
        dv = (h32(row, s, 3) % 3) - 1
        for i in range(w):
            X, Y = x0 + i, y0 + j
            g = c.get(X, Y)
            if not g or g[0] != 'log': continue
            if ends and (i < 1 or i >= w - 2): continue
            r = rnd(i, j, s + 21)
            if yy == 0: t = 5 + (1 if (i // 5 + row) % 3 == 0 and r < 0.6 else 0) + (0 if dv >= 0 else -1)
            elif yy == 1: t = base + dv + (1 if r < 0.12 else -1 if r > 0.86 else 0)
            elif yy == 2: t = 2 + (1 if r < 0.25 else 0)
            else: continue
            if (i + row * 3) % 9 == 0 and yy == 1: t -= 1                 # 껍질 갈라짐
            if i >= w - 3: t -= 1
            if i < 2 and yy < 2: t += 1
            c.P(X, Y, 'log', max(1, min(6, t)))


def plank_wall(c, x0, y0, w, h, mat='drift', base=3, s=0, bw=4):
    """세로 판자 벽(바랜 회색 또는 타르 칠 나무). 판 폭 bw, 이음 어둡게(그 왼쪽 판 끝은 그늘), 판 왼쪽 결 밝게,
    판마다 결 줄·옹이·바랜 반점, 처마 밑은 그늘, 아래로 갈수록 어둡고 밑동은 젖은 얼룩."""
    from px import NT, MI
    top_t = NT[MI[mat]] - 1
    for j in range(h):
        for i in range(w):
            k = i % bw; b = i // bw
            t = base + ((h32(b, s, 5) % 3) - 1 if bw > 2 else 0)
            if k == bw - 1: t = 1 if (j + b) % 7 else 0
            elif k == 0: t += 1
            elif k == bw - 2 and bw > 3: t -= 1
            if k not in (0, bw - 1) and h32(b * 5 + k, j // 3, s + 17) % 7 == 0: t -= 1      # 결 줄
            if k not in (bw - 1,) and rnd(i, j, s + 19) < 0.05: t += 1                          # 바랜 반점
            if j > h - 4: t -= 1
            if j > h - 2 and (i + j) % 2: t -= 1
            if h32(b, j // 5, s + 3) % 9 == 0 and k == 1: t -= 1
            c.P(x0 + i, y0 + j, mat, max(0, min(top_t, t)))
        if j % 11 == 5:                                                                           # 옹이
            b = h32(j, s, 23) % max(1, w // bw)
            c.P(x0 + b * bw + 1, y0 + j, mat, 0); c.P(x0 + b * bw + 1, y0 + j - 1, mat, max(0, base - 1))


def stone_plinth(c, x0, y0, w, h=3, s=0):
    """주춧돌 띠(들돌): 둥근 돌 덩이, 윗줄 밝게."""
    for j in range(h):
        for i in range(w):
            blk = (i + (2 if j >= 2 else 0)) // 4
            k = (i + (2 if j >= 2 else 0)) % 4
            t = 3 + (h32(blk, j // 2, s + 1) % 2)
            if k == 3: t = 1
            if j == 0 and k < 2: t += 1
            c.P(x0 + i, y0 + j, 'stone', t)


def drift_base(c, x0, ybot, w, skip=(), s=0, hmax=5):
    """벽 밑에 바람이 쌓은 눈더미(위 밝은 테 → 아래 그늘). skip = (x 시작, x 끝) 목록 — 문 앞처럼 치운 곳."""
    for i in range(-1, w + 1):
        X = x0 + i
        if any(a <= X < b for a, b in skip): continue
        ph = math.sin((X + s * 3) * 0.55) * 1.0 + math.sin((X + s) * 0.21) * 1.0
        edge = min(i + 1, w - i) if 0 <= i < w else 0
        corner = 2.2 if edge < 6 else 0.0                 # 모퉁이에 더 높이 쌓인다
        hh = int(round(3.0 + ph + corner))
        hh = max(1, min(hmax + 1, hh))
        if i < 0 or i >= w: hh = max(2, hh - 1)
        for d in range(hh):
            y = ybot - d
            t = 6 if d == hh - 1 else 5 if d == hh - 2 else 4 if d > 1 else 3
            if X >= x0 + w - 4: t -= 1
            c.P(X, y, 'snow', max(2, t))
    for a, b in skip:            # 치운 자리 양 끝은 눈 단면(밝은 테 + 그늘 옆면)
        for X, t in ((a - 1, 4), (b, 3)):
            if x0 <= X < x0 + w:
                for d in range(2):
                    if c.on(X, ybot - d): c.P(X, ybot - d, 'snow', t)


# ═══════════════════════ 창·문 ═══════════════════════
def window(c, x, y, w=8, h=9, shutter='red', lit=True, frame='log'):
    """창(왼쪽 위 x, y = 틀 바깥). 틀(짙은 나무) + 십자 살 + 빛나는 유리 + 덧문 + 인방 위 눈 + 창턱 눈."""
    c.R(x, y, w, h, frame, 1)
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if lit:
                t = 4 if (i + j) < 5 else 3 if j < h * 0.6 else 2
                c.P(x + i, y + j, 'lit', t)
            else:
                c.P(x + i, y + j, 'ice', 1 if j > 2 else 2)
    c.VL(x + w // 2, y + 1, h - 2, frame, 2); c.HL(x + 1, y + h // 2, w - 2, frame, 2)
    c.VL(x, y, h, frame, 2); c.VL(x + w - 1, y, h, frame, 0)
    if shutter:
        mat = 'red' if shutter == 'red' else 'wool' if shutter == 'blue' else 'log'
        for sx in (x - 3, x + w):
            for j in range(h):
                for i in range(3):
                    t = 3 if i == 0 else 2
                    if j in (1, h - 2): t = 1
                    if sx > x: t -= 1
                    c.P(sx + i, y + j, mat, max(0, t))
    # 인방 눈(양옆으로 1px 넘친다) + 처진 덩이 + 고드름 한두 개
    sw = w + (6 if shutter else 2); sx0 = x - (3 if shutter else 1)
    c.HL(sx0, y - 2, sw, 'snow', 6); c.HL(sx0, y - 1, sw, 'snow', 5)
    c.P(sx0, y - 1, 'snow', 4); c.P(sx0 + sw - 1, y - 1, 'snow', 3)
    c.P(x + 2, y, 'ice', 6); c.P(x + w - 3, y, 'ice', 5)
    # 창턱 눈
    c.HL(x - 1, y + h, w + 2, 'snow', 5); c.HL(x - 1, y + h + 1, w + 2, 'snow', 3)


def door(c, x, ybot, w=12, h=25, paint='log', arch=False, lit_gap=True):
    """문(x = 틀 왼쪽, ybot = 문턱 맨 아래 줄). 기둥·인방(눈 덮임) + 세로 판자 문짝 + 쇠 띠 경첩 + 고리 손잡이 + 돌 문턱.
    문짝 열린 높이 h-4 ≥ 21, 틀 포함 h."""
    mat = {'log': 'log', 'red': 'red', 'blue': 'wool', 'drift': 'drift'}[paint]
    top = ybot - h + 1
    # 문틀
    c.R(x, top, w, h - 2, 'log', 1)
    c.VL(x, top, h - 2, 'log', 3); c.VL(x + 1, top, h - 2, 'log', 2)
    c.VL(x + w - 1, top, h - 2, 'log', 0); c.VL(x + w - 2, top, h - 2, 'log', 1)
    # 문짝
    lx0, lx1 = x + 2, x + w - 2
    for j in range(top + 3, ybot - 1):
        for i in range(lx0, lx1):
            k = (i - lx0) % 3
            t = (3 if mat == 'log' else 2) + (1 if k == 0 else -1 if k == 2 else 0)
            if j > ybot - 5: t -= 1
            c.P(i, j, mat, max(0, t))
    if arch:
        for i in range(lx0, lx1):
            u = (i - lx0 + 0.5) / (lx1 - lx0)
            cut = int(round(3 * (1 - math.sin(math.pi * u))))
            for j in range(top + 3, top + 3 + cut): c.P(i, j, 'log', 1)
    for yy in (top + 7, ybot - 7):                                  # 쇠 띠
        c.HL(lx0, yy, lx1 - lx0, 'iron', 3); c.HL(lx0, yy + 1, lx1 - lx0, 'iron', 1)
        c.P(lx0 + 1, yy, 'iron', 5)
    c.P(lx1 - 3, (top + ybot) // 2, 'brass', 3); c.P(lx1 - 3, (top + ybot) // 2 + 1, 'brass', 1); c.P(lx1 - 2, (top + ybot) // 2 + 1, 'brass', 2)
    if lit_gap: c.HL(lx0, ybot - 2, lx1 - lx0, 'lit', 2)
    # 인방 + 눈 덮개
    c.R(x - 1, top, w + 2, 3, 'log', 3); c.HL(x - 1, top + 2, w + 2, 'log', 1)
    c.HL(x - 2, top - 2, w + 4, 'snow', 6); c.HL(x - 2, top - 1, w + 4, 'snow', 5); c.P(x - 2, top - 1, 'snow', 4); c.P(x + w + 1, top - 1, 'snow', 3)
    for k in (1, 4, w - 2): c.P(x + k, top + 3, 'ice', 6)
    # 돌 문턱
    c.HL(x - 1, ybot - 1, w + 2, 'stone', 5); c.HL(x - 1, ybot, w + 2, 'stone', 2)


def icicles(c, x0, y, w, s=0, maxlen=5, step=(2, 4)):
    """처마 밑 고드름: 간격 2~4px, 길이 1~maxlen. 뿌리 흰빛 → 끝 푸른빛."""
    x = x0 + h32(s, 1, 2) % 3
    while x < x0 + w:
        ln = 1 + h32(x, s, 5) % maxlen
        for k in range(ln):
            t = 6 if k == 0 else 5 if k < ln - 1 else 4
            c.P(x, y + k, 'ice', t)
            if k == 0 and ln > 2: c.P(x + 1, y, 'ice', 5)
        x += step[0] + h32(x, s, 7) % (step[1] - step[0] + 1)


# ═══════════════════════ 지붕 ═══════════════════════
def roof_snow_px(i, j, w, h, s=0):
    """지붕 눈 — 너와 줄(6px)을 따라 폭이 들쭉날쭉한 «베개» 덩이: 덩이 윗테 반사(6) → 몸(5, 왼쪽 위 6 디더) → 아래 오른쪽 그늘(4, 3 디더) → 덩이 사이 틈(3·2).
    면 전체 빛: 왼쪽 위 밝고 오른쪽 1/3 은 한 단 어둡게. 잔 반짝임 점."""
    P = 6
    band = (j + 2) // P; yy = (j + 2) % P
    # 이 줄의 덩이 경계: 폭 5~9 로 흔들린다
    x = -((h32(band, s, 3) % 7)); k = 0
    while True:
        bw = 5 + h32(band * 31 + k, s, 5) % 5
        if x + bw > i: break
        x += bw; k += 1
    lx = i - x; u0 = (lx + 0.5) / bw                     # 덩이 안 위치 0..1
    sag = 1 if (u0 < 0.18 or u0 > 0.82) else 0          # 덩이 끝은 한 줄 처진다
    yb = yy - sag
    if yb < 0: t = 3 if (i + j) % 2 else 4              # 위 덩이 처진 끝 밑 틈
    elif yb == 0: t = 6 if u0 < 0.7 else 5
    elif yb == 1: t = 6 if u0 < 0.35 else 5
    elif yb == 2: t = 5 if u0 < 0.75 else 4 if (i + j) % 2 else 5
    elif yb == 3: t = 5 if u0 < 0.45 else 4
    elif yb == 4: t = 4 if u0 < 0.6 else 3
    else: t = 3 if u0 < 0.8 else 2
    if j < 2: t = 6 if j == 0 else 5
    u = i / max(1, w - 1)
    if u > 0.66 and yb not in (0,): t -= 1
    if u > 0.9 and (i + j) % 2: t -= 1
    if u < 0.18 and 1 <= yb <= 3: t = min(6, t + 1)
    if t == 5 and h32(i, j, s + 77) % 23 == 0: t = 6        # 반짝
    return max(2, min(6, t))


def roof_gable(c, x0, y0, w, h, s=0, under='shingle', barge=True, ridge=True, peeks=2, cornice=5, ice_len=5, inset=3):
    """눈 쌓인 박공 지붕 남쪽 경사면(위에서 보이는 큰 면, 용마루 쪽을 inset 만큼 좁힌 사다리꼴).
    y0 = 용마루 줄, y0+h-1 = 처마 눈더미 맨 아래. under: shingle(너와) | turf(뗏장) | drift(회색 판자) — 눈이 미끄러져 내린 자리·박공 끝에 비친다.
    고드름은 처마 밑(y0+h)부터 늘어진다."""
    um = {'shingle': ('log', 2), 'turf': ('tundra', 2), 'drift': ('drift', 2)}[under]
    body_h = h - cornice
    edges = []
    for j in range(body_h):
        e = inset * (1 - j / max(1, body_h - 1))
        xl = x0 + int(round(e)); xr = x0 + w - 1 - int(round(e))
        edges.append((xl, xr))
        for X in range(xl, xr + 1):
            c.P(X, y0 + j, 'snow', roof_snow_px(X - x0, j, w, body_h, s))
    # 눈이 미끄러져 너와가 드러난 자리(처마 쪽 아래 1/3 에, 위 가장자리는 눈 단면 테)
    for q in range(peeks):
        pw = 5 + h32(q, s, 33) % 4
        px_ = x0 + 5 + h32(q, s, 31) % max(1, w - 10 - pw)
        py_ = y0 + body_h - 6 - h32(q, s, 32) % 3
        for dx in range(pw):
            hh = 3 if 0 < dx < pw - 1 else 2
            for dy in range(hh):
                t = um[1] + (1 if dy == 0 else 0)
                if (dx + dy * 2) % 3 == 2: t -= 1
                c.P(px_ + dx, py_ + dy + (3 - hh), um[0], max(0, t))
            c.P(px_ + dx, py_ + (3 - hh) - 1, 'snow', 6 if dx < pw - 2 else 5)
        c.P(px_ + pw, py_ + 1, 'snow', 3)
    if ridge:
        xl, xr = edges[0]
        c.HL(xl, y0, xr - xl + 1, 'ink', 2)
        c.HL(xl, y0 + 1, xr - xl + 1, um[0], um[1])
        for X in range(xl, xr + 1):
            if (X + s) % 7 not in (0, 1): c.P(X, y0 + 1, 'snow', 6)
    if barge:
        for j in range(body_h):
            xl, xr = edges[j]
            c.P(xl, y0 + j, 'ink', 1); c.P(xl + 1, y0 + j, 'log', 4 if j % 4 else 2); c.P(xl + 2, y0 + j, 'log', 3)
            c.P(xr, y0 + j, 'ink', 1); c.P(xr - 1, y0 + j, 'log', 1 if j % 4 else 0); c.P(xr - 2, y0 + j, 'log', 2)
            if j % 6 == 3: c.P(xl + 3, y0 + j, 'snow', 6); c.P(xr - 3, y0 + j, 'snow', 3)
    # 처마 눈더미(앞면): 위 테(빛) → 아래로 어두워짐, 아랫선 울퉁불퉁
    ey = y0 + body_h
    for i in range(w):
        lump = 1 if (math.sin((i + s * 5) * 0.7) + math.sin((i + s) * 0.27)) > 0.6 else 0
        u = i / max(1, w - 1)
        lp = (i + s * 3) % 7                                   # 처마 눈 덩이(폭 7): 덩이 왼쪽 밝고 오른쪽·밑 그늘
        for d in range(cornice + lump):
            t = 6 if d == 0 else 5 if d == 1 and lp < 4 else 4 if d < 3 else 3
            if d == 2 and lp in (5, 6): t = 3
            if d in (1, 2) and lp == 6 and (i + d) % 2: t -= 1
            if u > 0.68 and d > 0: t -= 1
            if u < 0.12 and d in (1, 2): t += 1
            if d == 0 and h32(i, s, 91) % 13 == 0: t = 5
            c.P(x0 + i, ey + d, 'snow', max(1, t))
        c.P(x0 + i, ey + cornice + lump - 1, 'snow', 1 if u > 0.68 else 2)
    c.VL(x0, ey, cornice, 'ink', 1); c.VL(x0 + w - 1, ey, cornice + 1, 'ink', 1)
    icicles(c, x0 + 1, ey + cornice, w - 2, s, ice_len)


def eave_shadow(c, x0, y, w, depth=3):
    """처마가 벽에 드리운 그늘(벽 단을 내린다)."""
    for j in range(depth):
        for i in range(w):
            c.shift(x0 + i, y + j, -2 if j < depth - 1 else -1, keep=('ink', 'ice', 'snow'))


def finial(c, x, y, side='L'):
    """용마루 끝 엇갈린 박공 장식(용머리 추상): 굵은 판 두 개가 X 로 솟고 끝이 바깥으로 말린다. 위에 눈 한 점."""
    d = -1 if side == 'L' else 1
    for k in range(7):
        ox = (k * d) // 2
        c.P(x + ox, y - k, 'log', 3 if side == 'L' else 2); c.P(x + ox - d, y - k, 'log', 1)
        c.P(x - ox + d, y - k, 'log', 2); c.P(x - ox + 2 * d, y - k, 'log', 0)
    c.P(x + d * 4, y - 7, 'log', 3); c.P(x + d * 5, y - 6, 'log', 2)
    c.P(x - d * 2, y - 7, 'log', 2); c.P(x - d * 3, y - 6, 'log', 1)
    c.P(x + d * 4, y - 8, 'snow', 6); c.P(x - d * 2, y - 8, 'snow', 5)


def chimney(c, x, ytop, w=7, h=12, smoke_hole=True):
    """돌 굴뚝: 윗면(눈 모자 + 검은 연기 구멍) + 앞면 돌 덩이(왼쪽 밝게) + 밑 눈 턱."""
    # 앞면
    for j in range(4, h):
        for i in range(w):
            row = (j - 4) // 3; k = (i + (2 if row % 2 else 0)) % 4
            t = 4 if i < w // 2 else 3
            if k == 3 or (j - 4) % 3 == 2: t = 1
            if i == 0: t += 1
            c.P(x + i, ytop + j, 'stone', t)
    c.VL(x, ytop + 4, h - 4, 'stone', 5); c.VL(x + w - 1, ytop + 4, h - 4, 'stone', 1)
    # 윗면: 눈 모자 + 구멍
    c.R(x - 1, ytop + 1, w + 2, 3, 'snow', 5); c.HL(x - 1, ytop, w + 2, 'snow', 6)
    c.HL(x - 1, ytop + 3, w + 2, 'snow', 3)
    if smoke_hole:
        c.R(x + 2, ytop + 1, w - 4, 2, 'ink', 0); c.HL(x + 2, ytop + 1, w - 4, 'stone', 1)
    c.P(x - 1, ytop + 3, 'snow', 4); c.P(x + w, ytop + 3, 'snow', 2)
    # 밑 눈 턱(지붕 눈과 만나는 곳)
    c.HL(x - 2, ytop + h, w + 4, 'snow', 6); c.HL(x - 2, ytop + h + 1, w + 4, 'snow', 4)


def stovepipe(c, x, ytop, h=10):
    """쇠 연통(어부 오두막·사우나): 원통 몸 + 갓(윗면 보이는 원판)."""
    for j in range(3, h):
        c.P(x, ytop + j, 'iron', 4); c.P(x + 1, ytop + j, 'iron', 3); c.P(x + 2, ytop + j, 'iron', 2); c.P(x + 3, ytop + j, 'iron', 1)
    c.HL(x - 1, ytop, 6, 'iron', 4); c.HL(x - 1, ytop + 1, 6, 'iron', 2); c.HL(x, ytop + 2, 4, 'ink', 1)
    c.HL(x - 1, ytop - 1, 6, 'snow', 6)
    c.HL(x - 1, ytop + h, 6, 'snow', 5)


def door2(c, x, ybot, w=24, h=27, paint='log'):
    """양개문(회관·교회·헛간): 두 문짝 + 가운데 맞닿는 선 + 쇠 띠 + 아치 인방(조각 띠). x = 틀 왼쪽."""
    mat = {'log': 'log', 'red': 'red', 'blue': 'wool'}[paint]
    top = ybot - h + 1
    c.R(x, top, w, h - 2, 'log', 1)
    for X in (x, x + 1): c.VL(X, top, h - 2, 'log', 3 if X == x else 2)
    for X in (x + w - 1, x + w - 2): c.VL(X, top, h - 2, 'log', 0 if X == x + w - 1 else 1)
    lx0, lx1 = x + 2, x + w - 2
    mid = (lx0 + lx1) // 2
    for j in range(top + 4, ybot - 1):
        for i in range(lx0, lx1):
            k = (i - lx0) % 3
            t = (3 if mat == 'log' else 2) + (1 if k == 0 else -1 if k == 2 else 0)
            if j > ybot - 5: t -= 1
            c.P(i, j, mat, max(0, t))
    for i in range(lx0, lx1):                                       # 아치 꼭대기(가운데 높게)
        u = (i - lx0 + 0.5) / (lx1 - lx0)
        cut = int(round(4 * (1 - math.sin(math.pi * u))))
        for j in range(top + 3, top + 4 + cut): c.P(i, j, 'log', 1)
    c.VL(mid, top + 4, h - 6, 'log', 0)
    for yy in (top + 9, ybot - 7):
        for X0, X1 in ((lx0, mid), (mid + 1, lx1)):
            c.HL(X0, yy, X1 - X0, 'iron', 3); c.HL(X0, yy + 1, X1 - X0, 'iron', 1); c.P(X0 + 1, yy, 'iron', 5)
    for X in (mid - 2, mid + 2):
        c.P(X, (top + ybot) // 2, 'brass', 3); c.P(X, (top + ybot) // 2 + 1, 'brass', 1)
    c.HL(lx0, ybot - 2, lx1 - lx0, 'lit', 2)
    # 조각 인방(엮음 무늬) + 눈
    c.R(x - 2, top - 1, w + 4, 4, 'log', 3); c.HL(x - 2, top + 3, w + 4, 'log', 1)
    for i in range(x - 1, x + w + 1, 3):
        c.P(i, top, 'log', 5); c.P(i + 1, top + 1, 'log', 5); c.P(i + 2, top + 2, 'log', 2)
    c.HL(x - 3, top - 3, w + 6, 'snow', 6); c.HL(x - 3, top - 2, w + 6, 'snow', 5)
    c.HL(x - 1, ybot - 1, w + 2, 'stone', 5); c.HL(x - 1, ybot, w + 2, 'stone', 2)


def lantern_wall(c, x, y):
    """벽 등(쇠 까치발 + 호박색 등)."""
    c.HL(x, y, 4, 'iron', 3); c.P(x, y + 1, 'iron', 2)
    c.R(x + 2, y + 1, 4, 2, 'iron', 2); c.HL(x + 2, y + 1, 4, 'iron', 4)
    c.R(x + 2, y + 3, 4, 4, 'lit', 3); c.R(x + 3, y + 4, 2, 2, 'lit', 4)
    c.VL(x + 2, y + 3, 4, 'iron', 2); c.VL(x + 5, y + 3, 4, 'iron', 1); c.HL(x + 2, y + 7, 4, 'iron', 1)
    c.HL(x + 1, y, 6, 'snow', 6)


def shield(c, cx, cy, mat='red', r=3.6):
    """회관 벽 둥근 방패(추상 문양 — 원판 + 쇠 테 + 가운데 돌기)."""
    c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 2) if d > 0.62 else (mat, 3 if dx + dy < 0 else 2) if (X + Y) % 4 else (mat, 1))
    c.P(int(cx), int(cy), 'iron', 5); c.P(int(cx) + 1, int(cy) + 1, 'iron', 1)


def sign_mug(c, x, y):
    """선술집 걸이 간판(글자 없음 — 나무 판 + 잔 그림)."""
    c.HL(x, y, 9, 'iron', 3); c.P(x + 1, y + 1, 'iron', 2); c.P(x + 7, y + 1, 'iron', 2)
    c.R(x, y + 2, 9, 7, 'log', 4); c.HL(x, y + 2, 9, 'log', 5); c.HL(x, y + 8, 9, 'log', 1)
    c.VL(x, y + 2, 7, 'log', 2); c.VL(x + 8, y + 2, 7, 'log', 1)
    c.R(x + 2, y + 4, 4, 4, 'brass', 2); c.HL(x + 2, y + 4, 4, 'snow', 6); c.VL(x + 6, y + 5, 2, 'brass', 1)
    c.HL(x - 1, y - 1, 11, 'snow', 6)


def pyramid(c, cx, ytop, ybase, half, mat='log', snow=True):
    """뾰족 탑 지붕(남쪽 삼각 면): 왼쪽 반 눈 덮임(밝게), 오른쪽 반 너와 그늘. 꼭대기에 쇠 꼬챙이."""
    H = ybase - ytop
    for j in range(H + 1):
        hw = half * j / max(1, H)
        for X in range(int(cx - hw), int(math.ceil(cx + hw)) + 1):
            u = (X - (cx - hw)) / max(1, 2 * hw)
            row = j % 4
            if snow and u < 0.55 and not (row == 3 and (X + j) % 3 == 0):
                t = 6 if u < 0.2 else 5 if row else 4
                c.P(X, ytop + j, 'snow', t)
            else:
                t = 2 if row else 1
                if u > 0.85: t -= 1
                c.P(X, ytop + j, mat, max(0, t))
        if hw >= 1:
            c.P(int(cx - hw), ytop + j, 'ink', 1); c.P(int(math.ceil(cx + hw)), ytop + j, 'ink', 1)
    c.VL(int(cx), ytop - 6, 6, 'iron', 3); c.P(int(cx) + 1, ytop - 5, 'iron', 1); c.HL(int(cx) - 1, ytop - 4, 3, 'iron', 4)


def leg(c, x, ytop, ybot, w=4):
    """굵은 통나무 다리(세운 원통 — 왼쪽 밝게)."""
    for j in range(ytop, ybot + 1):
        for i in range(w):
            u = (i + 0.5) / w
            t = 5 if u < 0.3 else 4 if u < 0.6 else 3 if u < 0.85 else 2
            if (j * 3 + i) % 11 == 0: t -= 1
            c.P(x + i, j, 'log', t)
