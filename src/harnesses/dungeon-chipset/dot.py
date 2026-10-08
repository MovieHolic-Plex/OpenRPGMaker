"""던전 칩셋(beodeul_dungeon) 손 도트 도구.

색은 harness-data/dungeon-chipset/palette.json 의 (램프, 단) 으로만 고른다(버들항 실제 화소 색). 후보 코드에 hex 를 쓰지 않는다.
그림은 행 문자열(글자 하나 = 화소 하나)로 직접 찍는다. 글자 → (램프, 단) 은 후보마다 범례로 정한다.
도형 마스크·잡음 함수로 본체를 만들지 않는다(assistant-skills/pixel-dot-authoring). 이 파일이 하는 일은
  - 행 문자열 찍기(stamp), 캔버스, 해시
  - 오토타일 조립: 후보가 찍은 **조각**(몸통 16×16 · 가장자리 띠 · 바깥/안 모서리 8×8)을 RPG Maker A2 와 같은
    사분면 규칙으로 맞춰 47 변형을 만든다(새 화소를 짓지 않는다 — 찍은 조각을 자리만 옮긴다)
  - 벽 앞면 조립: 32×32 앞면 표본(윗줄·아랫줄 × 왼끝·가운데 반복 16·오른끝)을 이웃에 따라 자른다
  - 동굴 격자 렌더: '#' 바위 · '.' 바닥 · 'w' 물 격자에서 천장/앞면/바닥/물을 정하고 위 조각으로 그린다
뿐이다.
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image

T = 16
Q = 8
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.join(REPO, 'harness-data', 'dungeon-chipset')
PAL = json.load(open(os.path.join(DATA, 'palette.json'), encoding='utf-8'))


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


RAMPS = {k: [hx(c) for c in v] for k, v in PAL['ramps'].items()}
SHADOW = tuple(PAL['shadow']['rgb'])
SHADOW_A = int(PAL['shadow']['alpha'])
ALLOWED = {hx(c) for c in PAL['allowed']}


def C(ramp, tone):
    r = RAMPS[ramp]
    if tone < 0:
        tone = len(r) + tone
    return r[min(tone, len(r) - 1)]


def legend(**kw):
    """legend(a=('stone',0), b=('stone',2)) → {'a': rgb, ...}. 글자 '.' 는 투명/유지, '~' 는 그림자."""
    return {k: C(*v) for k, v in kw.items()}


class Cv:
    """RGBA 캔버스. (x, y), y 는 아래로."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)

    @staticmethod
    def of(img):
        a = np.array(img.convert('RGBA'))
        c = Cv(a.shape[1], a.shape[0])
        c.a = a.copy()
        return c

    def put(s, x, y, rgb, alpha=255):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x, :3] = rgb
            s.a[y, x, 3] = alpha

    def shadow(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 0:
            s.a[y, x, :3] = SHADOW
            s.a[y, x, 3] = SHADOW_A

    def paste(s, o, x, y):
        """o 를 (x,y) 에 얹는다. 불투명은 덮고, 반투명(그림자)은 섞는다 — 장면 합성용."""
        oa = o.a if isinstance(o, Cv) else np.array(o.convert('RGBA'))
        h, w = oa.shape[:2]
        for yy in range(h):
            Y = y + yy
            if not 0 <= Y < s.h:
                continue
            for xx in range(w):
                X = x + xx
                if not 0 <= X < s.w:
                    continue
                p = oa[yy, xx]
                if p[3] == 0:
                    continue
                if p[3] == 255 or s.a[Y, X, 3] == 0:
                    s.a[Y, X] = p
                else:
                    al = p[3] / 255.0
                    s.a[Y, X, :3] = (s.a[Y, X, :3] * (1 - al) + p[:3] * al).astype(np.uint8)

    def crop(s, x, y, w, h):
        c = Cv(w, h)
        c.a = s.a[y:y + h, x:x + w].copy()
        return c

    def img(s):
        return Image.fromarray(s.a, 'RGBA')


def stamp(cv, rows, leg, ox=0, oy=0):
    """행 문자열을 찍는다. '.' 건너뜀, '~' 그림자(투명한 곳에만). 범례에 없는 글자는 오류."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch == ' ':
                continue
            if ch == '~':
                cv.shadow(ox + x, oy + y)
                continue
            if ch not in leg:
                raise KeyError(f'범례에 없는 글자 {ch!r} (행 {y} 열 {x}: {row})')
            cv.put(ox + x, oy + y, leg[ch])
    return cv


def grid(rows, leg, w=None, h=None):
    h = h or len(rows)
    w = w or max(len(r) for r in rows)
    for r in rows:
        if len(r) != w:
            raise ValueError(f'행 길이 {len(r)} ≠ {w}: {r!r}')
    return stamp(Cv(w, h), rows, leg)


def image_hash(im):
    a = np.array(im.convert('RGBA'))
    return hashlib.sha256(str(a.shape).encode() + a.tobytes()).hexdigest()


def tiled(cv, nx, ny):
    out = Cv(cv.w * nx, cv.h * ny)
    for j in range(ny):
        for i in range(nx):
            out.a[j * cv.h:(j + 1) * cv.h, i * cv.w:(i + 1) * cv.w] = cv.a
    return out


# ------------------------------------------------------------------------------------------------ 오토타일 (A2 사분면 규칙)
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128   # autotileEngine.AUTOTILE_DIR 와 같은 비트


class Autotile:
    """찍은 조각으로 8방 47 변형을 만든다.

    body  : 16×16 몸통(반복해도 이음이 없어야 한다)
    edge  : {'N': 16×h 띠(위), 'S': 16×h(아래), 'W': w×16(왼쪽), 'E': w×16(오른쪽)} — '.' 는 몸통 유지, h·w ≤ 8
    outer : {'NW','NE','SW','SE': 8×8} 두 곧은 변이 다 끊긴 모서리(바깥 모서리)
    inner : {'NW','NE','SW','SE': 8×8} 곧은 변은 이어졌는데 대각만 끊긴 모서리(안 모서리)
    각 조각은 Cv. 사분면 TL 은 (N, W, NW), TR (N, E, NE), BL (S, W, SW), BR (S, E, SE) 로 판정한다.
    """

    def __init__(s, body, edge, outer, inner, variants=()):
        s.body, s.edge, s.outer, s.inner = body, edge, outer, inner
        # 몸통 변형(엔진 AutotileGroup.interiorVariants 한 단). 8방이 다 이어진 칸(마스크 255)만 cell_hash 로 고른다.
        # 변형끼리·본몸통과 어떤 순서로 붙어도 이어지도록, 그리는 쪽이 칸 둘레 한 줄을 같게 맞춘다.
        s.bodies = [body] + list(variants)

    def tile_at(s, mask, x, y):
        """맵 (x, y) 칸의 그림 — 마스크 255 칸은 엔진 shadeAutotileInterior 와 같은 해시로 몸통 변형을 고른다."""
        if mask == 255 and len(s.bodies) > 1:
            cv = Cv(T, T)
            cv.a[:] = s.bodies[cell_hash(x, y) % len(s.bodies)].a
            return cv
        return s.tile(mask)

    def tile(s, mask):
        cv = Cv(T, T)
        cv.a[:] = s.body.a
        for qx, qy, v, h, d, vk, hk, ck in ((0, 0, N, W, NW, 'N', 'W', 'NW'), (1, 0, N, E, NE, 'N', 'E', 'NE'),
                                            (0, 1, S, W, SW, 'S', 'W', 'SW'), (1, 1, S, E, SE, 'S', 'E', 'SE')):
            vc, hc, dc = bool(mask & v), bool(mask & h), bool(mask & d)
            x0, y0 = qx * Q, qy * Q
            if not vc and not hc:
                _over(cv, s.outer[ck], x0, y0, 0, 0, Q, Q)
            elif not vc:     # 위/아래 변 띠의 이 반쪽
                _over_strip_h(cv, s.edge[vk], vk, x0)
            elif not hc:
                _over_strip_v(cv, s.edge[hk], hk, y0)
            elif not dc:
                _over(cv, s.inner[ck], x0, y0, 0, 0, Q, Q)
        return cv

    def variants(s):
        """정규화된 47 마스크 → 타일. 대각은 두 곧은 이웃이 다 이어졌을 때만 뜻이 있다."""
        out = {}
        for m in range(256):
            k = canon(m)
            if k not in out:
                out[k] = s.tile(k)
        return out


def cell_hash(x, y):
    """src/project/defaults/autotileEngine.ts cellHash 와 같은 값(32비트)."""
    def imul(a, b):
        return (a * b) & 0xFFFFFFFF
    n = (imul(x & 0xFFFFFFFF, 374761393) ^ imul(y & 0xFFFFFFFF, 668265263) ^ 0x2F6B1D) & 0xFFFFFFFF
    n = imul(n ^ (n >> 13), 1274126177)
    return (n ^ (n >> 16)) & 0xFFFFFFFF


def mosaic(at, nx, ny):
    """마스크 255 칸만 nx×ny 로 깐 그림(몸통 변형 섞임 확인용)."""
    out = Cv(nx * T, ny * T)
    for j in range(ny):
        for i in range(nx):
            out.a[j * T:(j + 1) * T, i * T:(i + 1) * T] = at.tile_at(255, i, j).a
    return out


def canon(m):
    for d, a, b in ((NE, N, E), (SE, S, E), (SW, S, W), (NW, N, W)):
        if not (m & a and m & b):
            m &= ~d
    return m


def _over(cv, patch, x, y, px, py, w, h):
    for yy in range(h):
        for xx in range(w):
            p = patch.a[py + yy, px + xx]
            if p[3]:
                cv.a[y + yy, x + xx] = p


def _over_strip_h(cv, strip, side, x0):
    h = strip.h
    y = 0 if side == 'N' else T - h
    for yy in range(h):
        if side == 'N' and yy >= Q:
            break
        if side == 'S' and y + yy < Q:
            continue
        for xx in range(Q):
            p = strip.a[yy, x0 + xx]
            if p[3]:
                cv.a[y + yy, x0 + xx] = p


def _over_strip_v(cv, strip, side, y0):
    w = strip.w
    x = 0 if side == 'W' else T - w
    for xx in range(w):
        for yy in range(Q):
            p = strip.a[y0 + yy, xx]
            if p[3]:
                cv.a[y0 + yy, x + xx] = p


def mask_at(g, x, y, conn, edge_conn=True):
    """g: 행 문자열 격자, conn(ch)->bool. 맵 밖은 edge_conn."""
    H, Wd = len(g), len(g[0])

    def c(dx, dy):
        X, Y = x + dx, y + dy
        if not (0 <= X < Wd and 0 <= Y < H):
            return edge_conn
        return conn(g[Y][X], X, Y)
    m = 0
    for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0), (NE, 1, -1), (SE, 1, 1), (SW, -1, 1), (NW, -1, -1)):
        if c(dx, dy):
            m |= bit
    return canon(m)


# ------------------------------------------------------------------------------------------------ 벽 앞면
class Face:
    """32×32 앞면 표본. 윗 16줄 = 윗단(천장 바로 밑), 아래 16줄 = 아랫단(바닥에 닿음).
    가로: 0~7 왼끝 · 8~23 가운데(16칸 주기로 반복) · 24~31 오른끝."""

    def __init__(s, block):
        assert block.w == 32 and block.h == 32, '앞면 표본은 32×32'
        s.b = block

    def tile(s, level, left_open, right_open):
        """level 0 윗단 · 1 아랫단. left_open = 왼쪽에 같은 단 앞면이 없음(끝 마구리)."""
        cv = Cv(T, T)
        y = level * T
        lx = 0 if left_open else 8
        rx = 24 if right_open else 16
        cv.a[:, 0:8] = s.b.a[y:y + T, lx:lx + 8]
        cv.a[:, 8:16] = s.b.a[y:y + T, rx:rx + 8]
        return cv


# ------------------------------------------------------------------------------------------------ 동굴 격자
ROCK = '#'


def classify(g):
    """바위 칸을 천장 / 앞면 윗단 / 앞면 아랫단으로 나눈다. 앞면 = 남쪽이 열린 바위 2칸."""
    H, Wd = len(g), len(g[0])
    kind = [[None] * Wd for _ in range(H)]
    for y in range(H):
        for x in range(Wd):
            if g[y][x] != ROCK:
                kind[y][x] = g[y][x]
                continue
            below = g[y + 1][x] if y + 1 < H else ROCK
            below2 = g[y + 2][x] if y + 2 < H else ROCK
            if below != ROCK:
                kind[y][x] = 'lo'
            elif below2 != ROCK:
                kind[y][x] = 'hi'
            else:
                kind[y][x] = 'ceil'
    return kind


def structure_errors(g):
    """앞면 아랫단 위에 바위가 두 칸 더 없으면(천장 없이 앞면만 뜬 벽) 오류 목록."""
    errs = []
    H = len(g)
    for y in range(H):
        for x in range(len(g[0])):
            if g[y][x] == ROCK and y + 1 < H and g[y + 1][x] != ROCK:
                if y - 1 < 0 or g[y - 1][x] != ROCK:
                    errs.append(f'({x},{y}) 앞면 아랫단 위에 윗단이 없다')
                elif y - 2 >= 0 and g[y - 2][x] != ROCK:
                    errs.append(f'({x},{y}) 앞면 위에 천장(윗면)이 없다')
    return errs


def render_cave(g, ceil, face, floor, water=None, floor_conn=None):
    """g: 행 문자열. ceil/floor/water: Autotile, face: Face. 반환 Cv(아래층만, 기물 없음)."""
    H, Wd = len(g), len(g[0])
    k = classify(g)
    out = Cv(Wd * T, H * T)
    fc = floor_conn or (lambda ch, X, Y: ch != ROCK)
    for y in range(H):
        for x in range(Wd):
            kk = k[y][x]
            if kk == 'ceil':
                m = mask_at(g, x, y, lambda ch, X, Y: k[Y][X] == 'ceil')
                t = ceil.tile_at(m, x, y)
            elif kk in ('hi', 'lo'):
                lv = 0 if kk == 'hi' else 1
                lo = not (x - 1 >= 0 and k[y][x - 1] == kk)
                ro = not (x + 1 < Wd and k[y][x + 1] == kk)
                t = face.tile(lv, lo, ro)
            elif kk == 'w' and water is not None:
                m = mask_at(g, x, y, lambda ch, X, Y: ch == 'w')
                t = water.tile_at(m, x, y)
            else:
                t = floor.tile_at(mask_at(g, x, y, fc), x, y)
            out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
    return out


def actor1_frame(col=1, row=0, who=0):
    """Actor1.png(RM2000 24×32, 3열×4방향 × 4×2 인물) 정면 프레임. 색 열쇠 = (0,0) 화소."""
    p = os.path.join(REPO, 'public', 'assets', 'easyrpg', 'charset', 'Actor1.png')
    im = Image.open(p).convert('RGBA')
    a = np.array(im)
    key = a[0, 0, :3].copy()
    m = (a[:, :, :3] == key).all(axis=2)
    a[m, 3] = 0
    bx, by = (who % 4) * 72, (who // 4) * 128
    return Image.fromarray(a[by + row * 32:by + row * 32 + 32, bx + col * 24:bx + col * 24 + 24], 'RGBA')
