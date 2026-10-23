"""theme-climate 판 공용 도우미(2026-10-23) — 피라미드·얼음굴·늪·숲 던전 조각을 그리는 네 모듈이 같이 쓴다.

후보 그림(CANDIDATES 가 돌려주는 Cv)은 **행 문자열 손 도트 + 잠금 팔레트(dot.RAMPS) 색만** 쓴다.
장면(vignette·anim·extras)에는 크기·맥락 비교용으로 버들항 실제 조각(bd_part / bd_kit)과 Actor1 을 깔아도 된다 — 관문 P 는 후보 그림만 본다.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import dot  # noqa: E402
from dot import Cv, grid, legend, stamp  # noqa: E402,F401

T = 16
REPO = dot.REPO
VAR = os.path.join(REPO, 'tiledata', 'beodeul-variants')
REFS = os.path.join(REPO, 'harness-data', 'dungeon-chipset', 'refs', 'theme-climate')
SHEET = os.path.join(REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')
TILESET = os.path.join(REPO, 'src', 'assets', 'beodeulCityTileset.json')


# ------------------------------------------------------------------------------------------------ 범례
def ramp_chars(ramp, chars):
    """ramp_chars('sand', 'abcdefg') → {'a': ('sand', 0), …} — 글자 순서 = 어두움 → 밝음."""
    return {ch: (ramp, i) for i, ch in enumerate(chars)}


def leg(*maps, **kw):
    """leg(ramp_chars('sand','abcdefg'), ramp_chars('gold','mnopqr'), x=('void',0)) → 범례 {글자: rgb}."""
    d = {}
    for m in maps:
        d.update(m)
    d.update(kw)
    return legend(**d)


def g(rows, lg):
    return grid(rows, lg)


def put(cv, rows, lg, x, y):
    stamp(cv, rows, lg, x, y)
    return cv


def hcat(*cvs, gap=0):
    out = Cv(sum(c.w for c in cvs) + gap * (len(cvs) - 1), max(c.h for c in cvs))
    x = 0
    for c in cvs:
        out.paste(c, x, out.h - c.h)
        x += c.w + gap
    return out


def vcat(*cvs, gap=0):
    out = Cv(max(c.w for c in cvs), sum(c.h for c in cvs) + gap * (len(cvs) - 1))
    y = 0
    for c in cvs:
        out.paste(c, 0, y)
        y += c.h + gap
    return out


def mirror_h(rows):
    return [r[::-1] for r in rows]


def blank(w, h):
    return Cv(w * T, h * T)


# ------------------------------------------------------------------------------------------------ 버들항 맥락(장면 전용)
def bd_part(name):
    """'desert-oasis/ground-sand' → 버들항 변형 조각 그림 Cv(장면 바탕·크기 비교 전용, 후보 그림에 넣지 않는다)."""
    place, f = name.split('/')
    return Cv.of(Image.open(os.path.join(VAR, place, 'parts', f + '.png')))


_KITS = None
_SHEET = None


def bd_kit(kid):
    """버들항 구조 키트(structureKits id) → 아래·위 층을 겹친 그림 Cv(장면 전용)."""
    global _KITS, _SHEET
    if _KITS is None:
        _KITS = {k['id']: k for k in json.load(open(TILESET, encoding='utf-8'))['structureKits']}
        _SHEET = Image.open(SHEET).convert('RGBA')
    k = _KITS[kid]
    rows = k['rows']
    im = Image.new('RGBA', (T * max(len(r['tiles']) for r in rows), T * len(rows)))
    for y, r in enumerate(rows):
        for key in ('tiles', 'upperTiles'):
            for x, c in enumerate(r.get(key) or []):
                if c is not None and c >= 0:
                    sx, sy = (c % 128) * T, (c // 128) * T
                    im.alpha_composite(_SHEET.crop((sx, sy, sx + T, sy + T)), (x * T, y * T))
    return Cv.of(im)


def backdrop(name):
    """refs/theme-climate/<name>.png 바탕 그림(예: 'ice-cave-backdrop-a' = 다른 작업자 gap-ice-r1 얼음굴 장면, 읽기 전용 사본)."""
    return Cv.of(Image.open(os.path.join(REFS, name + '.png')))


def tile_fill(w, h, tile):
    """w×h 칸을 tile(Cv, 크기 아무거나)을 감아 깐다. tile 이 함수면 tile(x, y) → 16×16 Cv."""
    out = Cv(w * T, h * T)
    if callable(tile):
        for y in range(h):
            for x in range(w):
                out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = tile(x, y).a
        return out
    for y in range(h * T):
        for x in range(w * T):
            out.a[y, x] = tile.a[y % tile.h, x % tile.w]
    return out


def mix_cells(cells):
    """칸 그림 목록 → (x, y) 마다 엔진 cellHash 로 하나 고르는 함수(편집기 floor mix 와 같은 고르기)."""
    return lambda x, y: cells[dot.cell_hash(x, y) % len(cells)]


def cells_of(cv):
    """W×H 칸 그림 → 16×16 칸 Cv 목록(왼→오, 위→아래)."""
    return [cv.crop(x * T, y * T, T, T) for y in range(cv.h // T) for x in range(cv.w // T)]


def actor(who=0):
    return Cv.of(dot.actor1_frame(1, 0, who))


def put_actor(cv, cx, cy, who=0):
    """사람 발이 (cx, cy) 칸 아래쪽에 오게."""
    cv.paste(actor(who), cx * T - 4, cy * T - 14)
    return cv


# ------------------------------------------------------------------------------------------------ 방 문법(천장 테두리 + 앞면 키트 + 바닥) — compose.ts 와 같은 규칙
def rooms_render(plan, rim, face3, face2, floor_fn, liquid=None):
    """plan: 행 문자열('.' 바닥 · '#' 막힌 칸 · 'w' 물/모래 등 액체 칸). compose.ts 처럼
    바닥 북쪽 변 위 막힌 칸 3(또는 2) 줄이 벽 앞면이 되고, 나머지 막힌 칸이 천장이다.
    rim: dot.Autotile(천장 테두리, 이웃이 천장이면 이어짐) · face3/face2: 48×48 / 48×32 앞면 키트(왼끝|가운데|오른끝 × 단)
    floor_fn(x, y) → 16×16 Cv · liquid: (Autotile, 글자) 또는 None. 반환 Cv.
    """
    H, W = len(plan), len(plan[0])
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] != '#'  # noqa: E731
    wallB = {}
    for y in range(H):
        for x in range(W):
            if not walk(x, y) or walk(x, y - 1):
                continue
            run = 0
            while y - 1 - run >= 0 and not walk(x, y - 1 - run) and run < 4:
                run += 1
            h = min(3, 3 if run >= 4 else run - 1)
            if h < 2:
                raise ValueError(f'({x},{y}) 벽 앞면 위에 천장이 남지 않는다 — 방 사이 세로 간격 4칸 이상')
            for b in range(h):
                wallB[(x, y - 1 - b)] = (b, h)
    out = Cv(W * T, H * T)
    for y in range(H):
        for x in range(W):
            if (x, y) in wallB:
                b, h = wallB[(x, y)]
                kit = face3 if h >= 3 else face2
                r = h - 1 - b
                left = wallB.get((x - 1, y), (None,))[0] == b
                right = wallB.get((x + 1, y), (None,))[0] == b
                col = 1 if left and right else 0 if (not left and right) else 2 if (left and not right) else 1
                t = kit.crop(col * T, r * T, T, T)
            elif walk(x, y):
                if liquid and plan[y][x] == liquid[1]:
                    t = liquid[0].tile_at(dot.mask_at(plan, x, y, lambda c, X, Y: c == liquid[1]), x, y)
                else:
                    t = floor_fn(x, y)
            else:
                isopen = lambda X, Y: walk(X, Y) or (X, Y) in wallB  # noqa: E731
                m = 0
                for bit, dx, dy in ((dot.N, 0, -1), (dot.E, 1, 0), (dot.S, 0, 1), (dot.W, -1, 0), (dot.NE, 1, -1),
                                    (dot.SE, 1, 1), (dot.SW, -1, 1), (dot.NW, -1, -1)):
                    X, Y = x + dx, y + dy
                    if not (0 <= X < W and 0 <= Y < H) or not isopen(X, Y):
                        m |= bit
                t = rim.tile_at(dot.canon(m), x, y)
            out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
    return out


def atlas47(at, cols=8):
    """오토타일 47 변형을 한 장(cols 열)에 — 후보 그림·관문 Q 표본용."""
    vs = at.variants()
    keys = sorted(vs)
    rows = (len(keys) + cols - 1) // cols
    out = Cv(cols * T, rows * T)
    for i, k in enumerate(keys):
        out.a[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T] = vs[k].a
    return out


def on(bg, *placements):
    """bg(Cv) 사본 위에 (조각 Cv, x px, y px) 들을 얹는다."""
    cv = Cv(bg.w, bg.h)
    cv.a[:] = bg.a
    for p, x, y in placements:
        cv.paste(p, x, y)
    return cv


def frames_strip(frames, gap=4):
    return hcat(*frames, gap=gap)


def lum(cv):
    a = cv.a.astype(float)
    return 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]


def seam_score(cells, n=6):
    """칸 목록을 cellHash 로 n×n 섞어 깐 그림의 칸 경계 밝기 차 평균 vs 칸 안 이웃 차 중앙값(이음 자가 점검용)."""
    cv = tile_fill(n, n, mix_cells(cells))
    L = lum(cv)
    dx = np.abs(np.diff(L, axis=1))
    inner = np.median(dx[:, [i for i in range(dx.shape[1]) if (i + 1) % T]])
    edge = dx[:, [i for i in range(dx.shape[1]) if (i + 1) % T == 0]].mean()
    return float(edge), float(inner)
