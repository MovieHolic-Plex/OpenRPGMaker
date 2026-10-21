#!/usr/bin/env python3
"""jp 숲 r4 composer(파이썬 원형) — 칠한 숲 구획 → 나무 그림 자리(3·4층). TS 판 `src/editor/jpCity/forestComposer.ts` 와 같은 규칙.

규칙 — 숲 속 나무도 모두 줄기가 있다(버들항 woodland 덩이처럼). 층으로 앞뒤를 푼다:
  · 나무 한 그루 = 수관 칸들(4층) + 맨 아랫줄 줄기·뿌리·그늘 칸(3층). 뒤 나무의 줄기 줄은 앞 나무의 수관 윗줄과 같은 칸에 놓이고,
    4층 수관이 3층 줄기를 덮어 앞뒤가 맞는다. 같은 층 안에서는 겹치지 않는다.
  · 줄기 줄 = 칸마다 그 열의 숲 아래 끝에서 3칸 간격(앞줄이 늘 숲 남쪽 끝에 선다). 남쪽 줄부터, 줄 안에서는 해시 출발점·흔들림.
  · 줄기 열만 숲 안이면 되고 수관은 둘레 빈칸으로 넘칠 수 있다(1칸 띠에도 제 크기 나무). 물·길·집(avoid)에는 아무것도 두지 않는다.
  · 남은 틈은 줄기 없는 수관(C3·C2)으로 메운다.
같은 마스크 · 같은 seed → 같은 결과. 칸 우선순위는 (x, y, seed) 해시라 붓으로 고친 둘레만 다시 짜도 나머지 자리는 그대로다.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_r3 as F  # noqa: E402
import forest_r4 as R  # noqa: E402

T = 16
NEED = dict(T4=3, T3=2, T2=1, T1=1, C3=2, C2=1)
# 줄기 나무는 줄기가 선 열만 숲 안이면 된다(수관은 둘레 빈칸으로 넘쳐도 된다 — 1칸 띠에도 제 크기 나무가 선다)
TRUNK_COLS = dict(T4=(1, 2), T3=(1,), T2=(0, 1), T1=(0,))


class Sprites:
    def __init__(self, sp):
        self.sp = sp
        self.by_shape = {}
        self.img = {}
        self.cover = {}
        for name, cw, ch, im in R.all_sprites(sp):
            shape = name.split('-')[1][:2] + ('d' if name.endswith('d') else '')
            self.by_shape.setdefault(shape, []).append(name)
            self.img[name] = im
            cov = np.zeros((ch, cw))
            for j in range(ch):
                for i in range(cw):
                    cov[j, i] = (im[j * T:(j + 1) * T, i * T:(i + 1) * T, 3] > 0).mean()
            self.cover[name] = cov


class BeodeulSprites(Sprites):
    """진단용: 버들항 bd-tree 키트(우리 그림)를 같은 composer 에 넣는다 — composer 배치 문제와 그림 문제를 가른다."""
    def __init__(self):
        import json
        from PIL import Image
        root = os.path.abspath(os.path.join(HERE, '../../../..'))
        d = json.load(open(os.path.join(root, 'src/assets/beodeulCityTileset.json')))
        sheet = np.array(Image.open(os.path.join(root, 'public/assets/beodeul-city/beodeul-city-chipset.png')).convert('RGBA'))
        self.sp = 'bd'; self.by_shape = {}; self.img = {}; self.cover = {}
        for k in d['structureKits']:
            if not k['id'].startswith('bd-tree'): continue
            cw, ch = len(k['rows'][0]['upperTiles']), len(k['rows'])
            shape = {(4, 5): 'T4', (3, 4): 'T3'}.get((cw, ch))
            if not shape: continue
            im = np.zeros((ch * T, cw * T, 4), np.uint8)
            for j, row in enumerate(k['rows']):
                for i, t in enumerate(row['upperTiles']):
                    if t is None or t < 0: continue
                    im[j * T:(j + 1) * T, i * T:(i + 1) * T] = sheet[(t // 128) * T:(t // 128 + 1) * T, (t % 128) * T:(t % 128 + 1) * T]
            name = f"bd-{shape}{k['id'][-6:]}"
            for key in (shape, shape + 'd'):
                self.by_shape.setdefault(key, []).append(name)
            self.img[name] = im
            self.cover[name] = np.array([[(im[j * T:(j + 1) * T, i * T:(i + 1) * T, 3] > 0).mean() for i in range(cw)] for j in range(ch)])
        self.by_shape.setdefault('T2', []); self.by_shape.setdefault('T2d', [])


def pri(x, y, salt, seed):
    return F.hf('fp', salt, x, y, seed)


TREES = ('T4', 'T3', 'T2')


def parts(name, S):
    """(층, 칸 줄 범위): 줄기 나무는 수관(4층) + 맨 아랫줄(3층), 수관만인 그림은 통째."""
    ch = S.cover[name].shape[0]
    if name.split('-')[1][:2] in TREES + ('T1',):
        return [(4, 0, ch - 1), (3, ch - 1, ch)]
    return None


LAYERS = (4, 3, 2)
APRON_LAYER = 2             # 숲 둘레 그늘 칸이 쓰는 층(그 칸의 나무는 4·3층만)          # 칸마다 앞에서부터 이 층에 놓는다(1층은 잔디·숲 바닥)


def compose(mask, S, seed=0, keep=(), window=None, avoid=None):
    """나무 자리 고르기. 돌려주는 자리 = (그림 이름, x0, y0, 깊이) — 깊이가 클수록 앞(남쪽).
    나무끼리 칸이 겹쳐도 된다: 층은 그림이 아니라 칸마다 정한다(cell_stack). 한 칸에 셋이 넘게 겹치면 가장 뒤 것은 버린다.
    keep: 그대로 둘 자리, window: (x0, y0, x1, y1) 이 안에 밑동이 선 나무만 새로 고른다."""
    H, W = mask.shape
    out = list(keep)
    inwin = (lambda x, y: True) if window is None else (lambda x, y: window[0] <= x < window[2] and window[1] <= y < window[3])

    def m(x, y):
        return 0 <= x < W and 0 <= y < H and mask[y, x]

    def clear(name, x0, y0):
        c = S.cover[name]; ch, cw = c.shape
        for j in range(ch):
            for i in range(cw):
                if c[j, i] <= 0.02: continue
                x, y = x0 + i, y0 + j
                if not (0 <= x < W and y < H): return False
                if y >= 0 and avoid is not None and avoid[y, x]: return False
        return True

    taken = {}
    stack = {}                 # 칸 → (겹친 수, 불투명 조각이 있나)

    def add(name, x0, y0):
        c = S.cover[name]
        for j in range(c.shape[0]):
            for i in range(c.shape[1]):
                if c[j, i] > 0:
                    n, op = stack.get((x0 + i, y0 + j), (0, False))
                    stack[(x0 + i, y0 + j)] = (n + 1, op or c[j, i] >= 0.98)

    def room(name, x0, y0):
        # 셋째 층까지 다 찼고 앞을 다 가리는 조각도 없는 칸에 또 겹치면, 그 조각은 버려져 칸 모양으로 잘린다 → 놓지 않는다
        c = S.cover[name]
        for j in range(c.shape[0]):
            for i in range(c.shape[1]):
                if c[j, i] > 0:
                    n, op = stack.get((x0 + i, y0 + j), (0, False))
                    if n >= len(LAYERS) and not op and c[j, i] > 0.3: return False
        return True

    for p in keep:
        taken[(p[1], p[2] + S.cover[p[0]].shape[0] - 1)] = True
        add(p[0], p[1], p[2])

    # 밑동 줄: 그 열의 숲 아래 끝에서 2칸 간격(앞줄은 늘 숲 남쪽 끝), 줄마다 반 칸 엇갈림 + 해시 간격(2~3칸)
    bottom = np.full((H, W), -1)
    for x in range(W):
        yb = -1
        for y in range(H - 1, -1, -1):
            if not mask[y, x]: yb = -1; continue
            if yb < 0: yb = y
            bottom[y, x] = yb
    for y in range(H - 1, -1, -1):
        xs = [x for x in range(W) if mask[y, x] and inwin(x, y) and (bottom[y, x] - y) % 2 == 0]
        if not xs: continue
        rowset = set(xs)
        cur = min(xs) - 1 + int(pri(0, y, 'start', seed) * 3)
        while cur <= max(xs) + 1:
            r = pri(cur, y, 'shape', seed)
            order = ['T4', 'T3', 'T2'] if r < 0.30 else ['T3', 'T2', 'T4'] if r < 0.88 else ['T2', 'T3']
            placed = False
            for shape in order:
                inner = all(m(cur + i, y + 1) for i in TRUNK_COLS[shape])
                names = sorted(S.by_shape.get(shape + ('d' if inner else ''), []), key=lambda n: pri(cur, y, ('v', n), seed))
                if not names: continue
                near = {p[0] for p in out if abs(p[1] - cur) <= 4 and abs(p[2] - y) <= 6}
                name = next((n for n in names if n not in near), names[0])
                ch, cw = S.cover[name].shape
                tcols = TRUNK_COLS[shape]
                x0, y0 = cur, y - ch + 1
                if all((x0 + i) in rowset for i in tcols) and clear(name, x0, y0) and (x0, y) not in taken and room(name, x0, y0):
                    add(name, x0, y0)
                    out.append((name, x0, y0, y * 4096 + int(pri(x0, y, 'z', seed) * 4095)))
                    taken[(x0, y)] = True
                    step = cw - 1 if pri(cur, y, 'step', seed) < 0.55 else cw
                    cur += max(2, step); placed = True; break
            if not placed: cur += 1
    return out


def ih(x, y, s):
    """TS treeComposer.ts 의 hash 와 비트까지 같은 32비트 정수 해시(Math.imul 흉내)."""
    M = 0xFFFFFFFF
    def imul(a, b): return ((a & M) * (b & M)) & M
    h = (imul(x, 374761393) + imul(y, 668265263) + imul(s, 2147483647)) & M
    h = imul(h ^ (h >> 13), 1274126177)
    return (h ^ (h >> 16)) & M


def ih01(x, y, s):
    return ih(x, y, s) / 4294967296.0


SHAPE_ORDER = ('T4', 'T3', 'T2')
_PH = {}


def row_phase(y, sd):
    """줄 위상(칸 간격 3 의 시작): 두 줄마다 1~2칸 밀린다 — 위아래 줄 나무가 같은 열에 서지 않는다. 마스크와 무관(y 만)."""
    key = (y, sd)
    if key not in _PH:
        p = 0
        for i in range((y >> 1) + 1): p += 1 + ih(0, i, 11 + sd) % 2
        _PH[key] = (p + (y & 1)) % 3
    return _PH[key]


def anchor_at(mask, S, x, y, seed=0, avoid=None):
    """칸 (x, y) 에 밑동을 둔 나무가 서는가 — 서면 (그림 이름, x0, y0, 깊이), 아니면 None. 이웃 몇 칸만 본다(붓질이 국소다).
    TS 판 src/project/defaults/treeComposer.ts 의 anchorAt 과 같은 규칙.
      · 줄: 짝수 줄, 또는 숲 남쪽 끝 줄(바로 아래가 숲 밖).
      · 칸: 줄마다 해시 위상 기준 3칸 간격(엇갈림), 5% 는 비운다.
      · 모양: 해시로 T4 32% · T3 62% · T2 6% 순서를 정하고, 줄기 열이 숲 안이고 그림 칸이 avoid·맵 옆/아래 밖에 걸리지 않는 첫 모양.
      · 숲 속(줄기 바로 아래가 숲) 나무는 그늘판(d)."""
    H, W = mask.shape

    def m(xx, yy):
        return 0 <= xx < W and 0 <= yy < H and mask[yy, xx]
    if not m(x, y): return None
    if not (y % 2 == 0 or not m(x, y + 1)): return None
    sd = seed * 101
    if (x - row_phase(y, sd)) % 3 != 0: return None
    if ih01(x, y, 13 + sd) < 0.05: return None
    r = ih01(x, y, 17 + sd)
    order = ['T4', 'T3', 'T2'] if r < 0.32 else ['T3', 'T4', 'T2'] if r < 0.94 else ['T2', 'T3']
    for shape in order:
        tcols = TRUNK_COLS[shape]
        if not all(m(x + i, y) for i in tcols): continue
        inner = all(m(x + i, y + 1) for i in tcols)
        names = sorted(S.by_shape.get(shape + ('d' if inner else ''), []))
        if not names: continue
        name = names[ih(x, y, 19 + SHAPE_ORDER.index(shape) + sd) % len(names)]
        c = S.cover[name]; ch, cw = c.shape
        x0, y0 = x, y - ch + 1
        ok = True
        for j in range(ch):
            for i in range(cw):
                if round(c[j, i] * 100) <= 2: continue
                xx, yy = x0 + i, y0 + j
                if yy < 0: continue
                if not (0 <= xx < W and yy < H) or (avoid is not None and avoid[yy, xx]): ok = False; break
            if not ok: break
        if ok: return (name, x0, y0, y * 4096 + ih(x, y, 23 + sd) % 4096)
    return None


def compose_local(mask, S, seed=0, avoid=None):
    H, W = mask.shape
    return [p for y in range(H) for x in range(W) for p in [anchor_at(mask, S, x, y, seed, avoid)] if p]


def cell_stack(placements, S, W, H, apron=frozenset()):
    """칸 → [(층, 그림 이름, i, j)] (앞에서부터). 투명한 칸 조각은 빼고, 셋이 넘으면 가장 뒤 것을 버린다.
    앞 조각이 칸을 거의 다 덮으면(불투명 ≥ 0.98) 그 뒤는 놓지 않는다."""
    cells = {}
    for name, x0, y0, z in placements:
        c = S.cover[name]; ch, cw = c.shape
        for j in range(ch):
            for i in range(cw):
                if round(c[j, i] * 100) <= 0: continue
                x, y = x0 + i, y0 + j
                if 0 <= x < W and 0 <= y < H:
                    cells.setdefault((x, y), []).append((z, name, i, j, c[j, i]))
    out = {}
    for k, lst in cells.items():
        lst.sort(key=lambda t: -t[0])
        lay = [L for L in LAYERS if not (k in apron and L == APRON_LAYER)]
        keep = []
        for z, name, i, j, cv in lst:
            keep.append((name, i, j))
            if round(cv * 100) >= 98 or len(keep) == len(lay): break
        out[k] = [(lay[n], name, i, j) for n, (name, i, j) in enumerate(keep)]
    return out


def footprint(p, S):
    name, x0, y0, _ = p
    c = S.cover[name]; ch, cw = c.shape
    return [(x0 + i, y0 + j) for j in range(ch) for i in range(cw) if c[j, i] > 0]


def recompose(mask, S, prev, changed, seed=0, margin=4, avoid=None):
    """붓질 한 번: 바뀐 칸 둘레(margin)만 다시 짠다. 밑동이 그 밖인 나무는 그대로."""
    xs = [c[0] for c in changed]; ys = [c[1] for c in changed]
    win = (min(xs) - margin, min(ys) - margin, max(xs) + margin + 1, max(ys) + margin + 1)
    H, W = mask.shape
    def base(p):
        return p[1] + 1, p[2] + S.cover[p[0]].shape[0] - 1
    keep = []
    for p in prev:
        bx, by = base(p)
        if win[0] <= bx < win[2] and win[1] <= by < win[3]: continue
        if not (0 <= by < H and 0 <= bx < W and mask[by, min(W - 1, bx)]): continue
        keep.append(p)
    return compose(mask, S, seed, keep=keep, window=win, avoid=avoid)


SHADE_COVER = 30            # 나무 그림 칸이 이만큼(%) 넘게 덮으면 그 칸은 그늘 덮개(땅 그늘의 바탕)
SHADE_ROWS = 2              # 그늘 덮개는 그림 맨 아래 두 줄(줄기 줄 + 바로 위 수관 줄)만 — 수관 꼭대기 위로 그늘이 비치지 않게, 그늘이 밑동 둘레에 고인다
SHADE_COVER_BASE = 15       # 맨 아랫줄(줄기·뿌리 칸)은 이만큼만 덮어도 덮개 — 밑동 둘레까지 그늘이 깔린다(버들항 실측: 그늘이 뿌리 밑까지)


def shade_cover(placements, S, W, H):
    cov = np.zeros((H, W), bool)
    for name, x0, y0, z in placements:
        c = S.cover[name]
        for j in range(c.shape[0]):
            for i in range(c.shape[1]):
                if j < c.shape[0] - SHADE_ROWS: continue
                need = SHADE_COVER_BASE if j == c.shape[0] - 1 else SHADE_COVER
                if round(c[j, i] * 100) >= need and 0 <= x0 + i < W and 0 <= y0 + j < H: cov[y0 + j, x0 + i] = True
    return cov


def ground_layers(mask, placements, S, avoid=None):
    """r6 접지: (1층 숲 바닥 {칸: code}, 2층 둘레 그늘 {칸: code}). 그늘은 숲 마스크가 아니라 실제로 선 나무가 덮은 칸을 따른다.
    둘레 그늘은 숲 밖 잔디 칸(avoid 아님)에만."""
    import forest_r6_ground as G
    H, W = mask.shape
    cv = shade_cover(placements, S, W, H)

    def cov(x, y):
        return 0 <= x < W and 0 <= y < H and cv[y, x]
    floor, apron = {}, {}
    for y in range(H):
        for x in range(W):
            c = G.shade_code(cov, x, y)
            if mask[y, x]: floor[(x, y)] = c
            elif (avoid is None or not avoid[y, x]) and c: apron[(x, y)] = c
    return floor, apron


_GT = {}


def render(ground, placements, S, mask=None, avoid=None, base=None):
    """칸마다 뒤(2층) → 앞(4층) 순서로 칸 조각을 덮는다. mask 를 주면 r6 접지(숲 바닥·둘레 그늘)를 먼저 깐다."""
    img = ground.copy()
    H, W = img.shape[0] // T, img.shape[1] // T
    apron = frozenset()
    if mask is not None and os.environ.get('JPF_GROUND', 'r6') == 'r6':
        import forest_r6_ground as G
        floor, ap = ground_layers(mask, placements, S, avoid)
        for (x, y), c in floor.items():
            key = ('f', c)
            if key not in _GT: _GT[key] = G.floor_tile(base, c)
            img[y * T:(y + 1) * T, x * T:(x + 1) * T] = _GT[key]
        used = set()
        for (x, y), c in ap.items():
            key = ('a', c)
            if key not in _GT: _GT[key] = G.apron_tile(base, c)
            if _GT[key] is not None: F.over(img, _GT[key], x * T, y * T); used.add((x, y))
        apron = frozenset(used)
    st = cell_stack(placements, S, W, H, apron)
    for L in (2, 3, 4):
        for (x, y), lst in st.items():
            for layer, name, i, j in lst:
                if layer != L: continue
                F.over(img, np.ascontiguousarray(S.img[name][j * T:(j + 1) * T, i * T:(i + 1) * T]), x * T, y * T)
    return img


def floor_tile(nb):
    """숲 바닥(1층 오토타일 한 칸): nb = 3×3 숲 여부(가운데 = 이 칸). 숲 가장자리에서 멀수록 잔디가 그늘 세 단으로 어두워진다.
    가장자리 2px 는 잔디 그대로라 숲 밖 잔디와 이어진다. 칸 밖 이웃까지의 거리만 보므로 8방 마스크로 정해진다(47 오토타일)."""
    out = np.zeros((T, T, 4), np.uint8)
    gsh = F.PAL['gsh']
    for y in range(T):
        for x in range(T):
            d = 99.0
            for j in range(3):
                for i in range(3):
                    if nb[j][i]: continue
                    # 그 이웃 칸 사각형까지의 거리
                    x0, x1 = (i - 1) * T, i * T
                    y0, y1 = (j - 1) * T, j * T
                    dx = max(x0 - (x + 0.5), 0, (x + 0.5) - x1)
                    dy = max(y0 - (y + 0.5), 0, (y + 0.5) - y1)
                    d = min(d, (dx * dx + dy * dy) ** 0.5)
            k = None
            d += (F.hf('fl', x, y) - 0.5) * 4.0          # 경계를 칸 선에서 떼어 들쭉날쭉하게(칸 안 좌표 해시라 이웃과 같은 규칙)
            if d > 15: k = 0
            elif d > 12: k = 1
            elif d > 9: k = 2 if (x + y) % 2 == 0 else 1
            elif d > 7: k = 2 if (x + 2 * y) % 3 == 0 else None
            if k is not None:
                out[y, x, :3] = gsh[k]; out[y, x, 3] = 255
    return out


_FLOOR = {}


def render_floor(img, mask):
    H, W = mask.shape
    for y in range(H):
        for x in range(W):
            if not mask[y, x]: continue
            nb = tuple(tuple(bool(0 <= x + i - 1 < W and 0 <= y + j - 1 < H and mask[y + j - 1, x + i - 1]) for i in range(3)) for j in range(3))
            if nb not in _FLOOR: _FLOOR[nb] = floor_tile(nb)
            F.over(img, _FLOOR[nb], x * T, y * T)
    return img
