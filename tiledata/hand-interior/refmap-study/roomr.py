# REFMAP 연구판 32px 견본 방: 빵집 딸린 민가 (안쪽 12×9칸 = 벽면 2줄 + 바닥 7줄, 둘레 천장 테).
# 벽·바닥·천장 테·문을 32px 로 새로 그리고, propsr 소품을 놓는다. 같은 배치를 v5 16px · v32 시험 판으로도 그린다.
# 저장소 루트에서: python3 tiledata/hand-interior/refmap-study/roomr.py OUTDIR
import sys, os, math
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
import numpy as np
from PIL import Image
from scipy import ndimage
from drawr import RAMP, H, clamp
import propsr

S = 32
PLAN = [
    '##############',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '########.#####',
]
KITCHEN = (1, 4)          # 부엌 구역 x 범위: 벽돌 벽 + 판석 바닥
POSTS = (5, 9)            # 회벽 구간 기둥 (칸 x 왼쪽 가장자리)
# (이름, x, y)  floor/wall: 발 칸 왼쪽 위 / hang: 벽면 칸 (x, y) + 세로 오프셋 / flat: 왼쪽 위
ITEMS = [
    ('oven', 1, 3), ('sack', 3, 3), ('barrel', 4, 3), ('wall shelf', 3, 1, 12),
    ('bread counter', 3, 7), ('crate', 1, 9), ('jar', 1, 7), ('sack', 2, 9),
    ('window', 6, 1, 6), ('bookshelf', 7, 3), ('wardrobe', 9, 3), ('plant', 11, 3), ('bed', 12, 3),
    ('window', 10, 1, 6),
    ('chair S', 5, 4), ('chair S', 6, 4), ('dining', 5, 5), ('chair N', 6, 7),
    ('rug', 9, 6), ('jar', 12, 9), ('barrel', 5, 9),
]
HERO_AT = (8, 7)

def R(m, v):
    r = RAMP[m]; return r[int(round(clamp(v) * (len(r) - 1)))][:3]

def analyse(plan):
    Hh = len(plan); W = len(plan[0])
    g = np.array([[c != '#' for c in row] for row in plan])
    face = np.zeros_like(g, dtype=int)
    for y in range(Hh):
        for x in range(W):
            if not g[y, x]: continue
            if y == 0 or not g[y - 1, x]: face[y, x] = 1
            elif face[y - 1, x] == 1: face[y, x] = 2
    return W, Hh, g, face

# ---------------------------------------------------------------- 바닥
def plank(X, Y):
    """널마루: 판 높이 8px(칸의 1/4 — REFMAP 12/48 과 같은 비율), 길이 40~72 엇갈림, 판마다 기본 값."""
    row = Y // 8; ly = Y % 8
    off = int(H(row, 0, 5) * 64); L = 40 + int(H(row, 1, 5) * 4) * 8
    k = (X + off) // L; lx = (X + off) % L
    base = 0.56 + (H(row, k, 7) - .5) * 0.10
    if ly == 7: return R('pine', 0.30)
    if lx == 0: return R('pine', 0.32)
    v = base + (0.06 if ly == 0 else 0) - (0.03 if ly == 6 else 0)
    w = math.sin((X + off) * 0.21 + math.sin((X + off) * 0.043 + row) * 2.2 + ly * 0.9)
    if w > 0.93 and 1 <= ly <= 5: v -= 0.05                          # 결: 드문 짧은 줄, 두 톤
    if lx == 3 and ly == 3: v -= 0.12                                # 못
    return R('pine', v)

def flag(X, Y):
    """판석: 크기 9~14px 불규칙 돌(보로노이), 줄눈 한 단 어둡게, 돌마다 값과 색 기운이 조금씩 다르다."""
    cx, cy = X // 12, Y // 11
    best = (1e9, 0, 0); sec = 1e9
    for j in range(cy - 1, cy + 2):
        for i in range(cx - 1, cx + 2):
            px = i * 12 + 2 + H(i, j, 3) * 8; py = j * 11 + 2 + H(i, j, 4) * 7
            d = (X - px) ** 2 + (Y - py) ** 2
            if d < best[0]: sec = best[0]; best = (d, i, j)
            elif d < sec: sec = d
    edge = math.sqrt(sec) - math.sqrt(best[0])
    i, j = best[1], best[2]
    base = 0.60 + (H(i, j, 6) - .5) * 0.14
    if edge < 1.1: return R('stone', 0.36)
    if edge < 2.1: return R('stone', base + 0.06)                    # 돌 모서리 밝은 테
    v = base + (0.02 if H(X // 2, Y // 2, 9) > 0.85 else 0)
    c = R('stone', v)
    t = H(i, j, 8)                                                   # 분홍·초록 기운
    if t < 0.25: c = (min(255, c[0] + 6), c[1], c[2] + 2)
    elif t > 0.8: c = (c[0], min(255, c[1] + 4), c[2])
    return c

# ---------------------------------------------------------------- 벽면 (2칸 = 64px)
def plaster(X, fy):
    """회벽: 들보 5px → 흰 회벽(잔 얼룩) → 아래 들보 12px. 들보 밑 6px 그늘. REFMAP 흰 회벽(짙은 나무 틀) 비율을 32px 로."""
    if fy < 5: return R('oak', (0.34, 0.46, 0.40, 0.30, 0.18)[fy])
    for px in POSTS:
        dx = X - px * S
        if -2 <= dx <= 2: return R('oak', (0.46, 0.40, 0.36, 0.30, 0.20)[dx + 2])
    if fy >= 52:
        return R('oak', (0.52, 0.40, 0.38, 0.36, 0.30, 0.18, 0.40, 0.34, 0.32, 0.28, 0.22, 0.12)[fy - 52])
    v = 0.88 + (H(X, fy, 3) - .5) * 0.035 + (0.02 if H(X // 3, fy // 2, 4) > 0.8 else 0)
    if fy < 11: v -= 0.34 * (11 - fy) / 6
    if fy > 48: v -= 0.05 * (fy - 48)
    return R('linen', v)

def brick(X, fy):
    """벽돌 벽: 윗테 4px, 벽돌 16×5 엇갈림(윗줄 1px 밝게·줄눈 한 단 어둡게), 아래 돌 굽 7px."""
    if fy < 4: return R('stone', (0.30, 0.44, 0.36, 0.20)[fy])
    if fy >= 57: return R('stone', (0.50, 0.44, 0.40, 0.38, 0.34, 0.28, 0.16)[fy - 57])
    row = (fy - 4) // 5; ly = (fy - 4) % 5
    off = 8 if row % 2 else 0
    k = (X + off) // 16; lx = (X + off) % 16
    if ly == 4 or lx == 0: return R('brick', 0.22)
    base = 0.46 + (H(k, row, 2) - .5) * 0.16
    v = base + (0.08 if ly == 0 else 0) - (0.05 if ly == 3 else 0) - (0.04 if lx == 15 else 0)
    if fy < 10: v -= 0.20 * (10 - fy) / 6
    return R('brick', v)

# ---------------------------------------------------------------- 바탕 전체
def render(plan=PLAN):
    W, Hh, g, face = analyse(plan)
    im = Image.new('RGB', (W * S, Hh * S), (0, 0, 0)); px = im.load()
    inner = np.kron(g, np.ones((S, S), dtype=bool))
    # 문 칸: 둘레 아래 줄의 빈 칸 = 바닥이 이어진 문턱
    door = [(x, Hh - 1) for x in range(W) if g[Hh - 1, x]]
    dist = ndimage.distance_transform_edt(~inner)                    # 천장 테: 안쪽까지의 거리
    for y in range(Hh * S):
        for x in range(W * S):
            cx, cy = x // S, y // S
            if g[cy, cx] and face[cy, cx]:
                fy = y - (cy - face[cy, cx] + 1) * S
                c = brick(x, fy) if KITCHEN[0] <= cx <= KITCHEN[1] else plaster(x, fy)
            elif g[cy, cx]:
                c = flag(x, y) if (KITCHEN[0] <= cx <= KITCHEN[1] and cy < Hh - 1) else plank(x, y)
                bx = x - (KITCHEN[1] + 1) * S                                # 부엌·마루 경계: 문지방 널 3px
                if -1 <= bx <= 1: c = R('oak', (0.44, 0.34, 0.22)[bx + 1])
                # 벽 발치 AO: 북벽 밑 8px (REFMAP 12/48)
                ys = y - cy * S
                if cy > 0 and face[cy - 1, cx] == 2 and ys < 8:
                    k = 0.70 + 0.0375 * ys; c = tuple(int(v * k) for v in c)
                # 옆벽 접지 3px
                lx = x - cx * S
                if (not g[cy, cx - 1] and lx < 3) or (cx + 1 < W and not g[cy, cx + 1] and lx > S - 4):
                    c = tuple(int(v * 0.8) for v in c)
            else:
                d = dist[y, x]
                # 안쪽에서 바깥으로: 짙은 선 2 · 밝은 면 4 · 짙은 선 1 · 밝은 모서리 1 · 번짐 6 → 검정
                prof = [0.22, 0.26, 0.54, 0.58, 0.58, 0.50, 0.28, 0.46, 0.30, 0.22, 0.15, 0.10, 0.05, 0.02]
                i = int(d) - 1
                c = R('slate', prof[i]) if 0 <= i < len(prof) else (0, 0, 0)
                if i >= len(prof) - 6 and 0 <= i < len(prof): c = tuple(int(v * (1 - (i - 7) / 7)) for v in c)
            px[x, y] = c
    # 문턱: 문 칸 윗줄에 짙은 문지방, 가운데 짚 발판
    for (dx, dy) in door:
        X0, Y0 = dx * S, dy * S
        for x in range(X0, X0 + S):
            px[x, Y0] = R('oak', 0.46); px[x, Y0 + 1] = R('oak', 0.30); px[x, Y0 + 2] = R('oak', 0.18)
        for y in range(Y0 + 8, Y0 + 26):
            for x in range(X0 + 4, X0 + 28):
                v = 0.52 + (0.08 if (x + (y // 2)) % 4 == 0 else 0) - (0.1 if y in (Y0 + 8, Y0 + 25) or x in (X0 + 4, X0 + 27) else 0)
                px[x, y] = R('straw', v)
    return im.convert('RGBA')

def compose(items, props, base, S=32, hero=None):
    draw = []
    for it in items:
        n, x, y = it[:3]; p = props[n]
        if p.kind == 'hang':
            X, Y = x * S, y * S + (it[3] if len(it) > 3 else 0) * S // 32; key = -0.5
        elif p.kind == 'flat':
            X, Y = x * S, y * S; key = -1
        else:
            X, Y = x * S, y * S - p.up; key = (y + p.fh) * S
        draw.append((key, p.im, X, Y))
    if hero is not None:
        im, (hx, hy) = hero
        draw.append(((hy + 1) * S - 0.5, im, hx * S + S // 2 - im.width // 2, (hy + 1) * S - im.height))
    for _, im, X, Y in sorted(draw, key=lambda d: d[0]): base.alpha_composite(im, (X, Y))
    return base

def room(t=0, hero=None):
    return compose(ITEMS, propsr.all_props(t), render(), hero=hero)

# ---------------------------------------------------------------- 같은 배치의 v5 16px · v32 시험 판
V5 = {'oven': 'bread oven', 'sack': 'sack:flour', 'barrel': 'barrel', 'wall shelf': 'shelf pots', 'bread counter': 'display bread',
      'crate': 'crate', 'jar': 'water jar', 'window': 'curtained window', 'bookshelf': 'bookshelf 2w', 'wardrobe': 'wardrobe',
      'plant': 'potted fern', 'bed': 'bed blue', 'chair S': 'chair S', 'chair N': 'chair N', 'dining': 'dining 2x2', 'rug': 'rug red'}
V32 = {'dining': 'dining 2x2', 'chair S': 'chair S', 'chair N': 'chair N', 'bed': 'bed blue', 'bookshelf': 'bookshelf 2w',
       'wardrobe': 'wardrobe', 'barrel': 'barrel', 'jar': 'water jar'}

def _paths():
    R0 = os.path.abspath(os.path.join(D, '..', '..', '..'))
    for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects', 'tiledata/hand-interior/v32-demo'):
        q = os.path.join(R0, p)
        if q not in sys.path: sys.path.insert(0, q)
    return R0

def v5_items():
    """v5 16px 판 배치. 2칸 소품은 v5 에 맞는 것으로(빵 진열대 → 빵 진열 1칸 둘, 벽 선반 → 선반 1칸 둘)."""
    _paths(); from rooms4 import o, T
    def obj(n):
        if n == 'dining 2x2':
            f = T('dining', 2, 2); f.id = n; return f
        return o(n)
    out = []
    for it in ITEMS:
        n, x, y = it[:3]; f = obj(V5[n])
        out.append((f, x, y))
        if n in ('bread counter', 'wall shelf'): out.append((obj(V5[n]), x + 1, y))
    return out

def room_v5():
    R0 = _paths(); cwd = os.getcwd(); os.chdir(R0)
    try:
        import room4
        m = dict(key='refmap-study', plan=PLAN, floor='plank', wall='plaster', items=v5_items(),
                 zones=[(KITCHEN[0], 0, KITCHEN[1], len(PLAN) - 2, 'flag', 'stone')])
        return room4.compose(m, 0)
    finally: os.chdir(cwd)

def room_v32():
    """v32 시험 판: v32 에 있는 8종은 v32 그림, 없는 소품은 v5 그림을 2배로 채운다(missing 목록으로 돌려준다)."""
    R0 = _paths(); cwd = os.getcwd(); os.chdir(R0)
    try:
        import room32
        base = room32.render(PLAN, 32); F = room32.foot(); draw = []; missing = []
        from rooms4 import o, T
        for it in ITEMS:
            n, x, y = it[:3]
            if n in V32:
                im = room32.obj32(V32[n]); fw, fh, kind = F[V32[n]]
                draw.append(((y + fh) * 32, im, x * 32, y * 32 - (im.height - fh * 32)))
            else:
                missing.append(n)
                f = T('dining', 2, 2) if V5[n] == 'dining 2x2' else o(V5[n])
                reps = 2 if n in ('bread counter', 'wall shelf') else 1
                for r in range(reps):
                    im = f.im.resize((f.im.width * 2, f.im.height * 2), Image.NEAREST)
                    if f.kind == 'hang': draw.append((-0.5, im, (x + r) * 32, y * 32 + 4))
                    elif f.kind == 'flat': draw.append((-1, im, x * 32, y * 32))
                    else: draw.append(((y + f.fh) * 32, im, (x + r) * 32, y * 32 - f.up * 2))
        for _, im, X, Y in sorted(draw, key=lambda d: d[0]): base.alpha_composite(im, (X, Y))
        return base, sorted(set(missing))
    finally: os.chdir(cwd)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/refmap-study'
    os.makedirs(out, exist_ok=True)
    im = room(); im.save(f'{out}/room-refmap32.png'); print(im.size)
