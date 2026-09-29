"""pp15_pp2 — retro2003 b3 파티원 4명(monster1-0~3) 15칸 전투 시트 공용 리그(2026-09-29 재작업).

원칙: 걷기 칩 Monster1.png 의 **왼쪽 보기(행 3) 가운데 칸** 을 밑그림으로 쓴다(칩 행: 0 위·1 오른쪽·2 아래·3 왼쪽).
  1) 칩 외곽선을 벗긴 속살을 Scale2x 로 정수 2배(계단 자동 다듬기) → 2) 부위(몸·머리·팔…)를 옮기고 돌려 자세를 만든다
  3) 새 1px 외곽선 → 4) 광원 왼쪽 위 기준으로 빛·그늘 한 단계(칩 팔레트 안에서 한 칸 밝게/어둡게).
그래서 크기는 칩 × 2 를 넘지 않고, 색은 칩 팔레트 + 효과색 몇 개다. 이미 왼쪽을 보므로 반전하지 않는다.
시트: 셀 cell, 3열×5행 — idle a·b·c / windup move attack / recover hit dead / cast_charge cast_raise cast_release / leap buff finisher.
사용: python3 scripts/asset-gen/party-pixel/monster1-0.py  (빌드+검사), python3 pp15_pp2.py board (확인판 .omo/pp2/)
"""
import colorsys
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CHIPSET = ROOT / 'public/assets/easyrpg/charset/Monster1.png'
OUT = ROOT / 'public/assets/generated/party-pixel'
BOARD = ROOT / '.omo/pp2'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
BG = (0, 147, 146)


def hx(s):
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


# ── 칩 읽기 ────────────────────────────────────────────────────────────────
def chip_frame(i, row=3, col=1):
    im = Image.open(CHIPSET).convert('RGBA')
    f = np.array(im.crop((i * 72 + col * 24, row * 32, i * 72 + col * 24 + 24, row * 32 + 32)))
    bg = (f[..., 0] == BG[0]) & (f[..., 1] == BG[1]) & (f[..., 2] == BG[2])
    f[bg] = 0
    return f


def quantize(a, n, keep=()):
    """불투명 픽셀을 n 색으로 줄인다(칩 팔레트가 16색을 넘는 칩용). keep 색은 그대로 남긴다."""
    m = a[..., 3] > 0
    px = a[m][:, :3]
    keep = [hx(k)[:3] for k in keep]
    img = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8), 'RGB')
    q = img.quantize(colors=n - len(keep), method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:3 * (n - len(keep))]).reshape(-1, 3)
    idx = np.array(q).reshape(-1)
    newc = pal[idx]
    for j, c in enumerate(px):
        # keep 색과 가까우면 keep 으로(눈·입 같은 작은 강조색 보존)
        for k in keep:
            if sum((int(c[t]) - k[t]) ** 2 for t in range(3)) < 900:
                newc[j] = k
    out = a.copy()
    out[m, :3] = newc
    return out


def strip_outline(a, outc, keep_mask=None, keep_col=None):
    """칩 외곽선(투명과 맞닿은 outc 색)을 벗긴다. keep_mask 자리는 keep_col 로 남긴다(뿔 끝처럼 선뿐인 곳)."""
    a = a.copy()
    h, w = a.shape[:2]
    oc = [hx(c) for c in outc]
    op = a[..., 3] > 0
    kill = []
    for y in range(h):
        for x in range(w):
            if not op[y, x]:
                continue
            if tuple(a[y, x]) not in oc:
                continue
            edge = any(not (0 <= y + dy < h and 0 <= x + dx < w) or not op[y + dy, x + dx]
                       for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)))
            if edge:
                kill.append((y, x))
    for y, x in kill:
        if keep_mask is not None and keep_mask(x, y):
            a[y, x] = hx(keep_col)
        else:
            a[y, x] = 0
    return a


def scale2x(a):
    """EPX/Scale2x. RGBA 배열 → 2배. 대각 계단을 칩 팔레트 그대로 다듬는다."""
    h, w = a.shape[:2]
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)))
    E = p[1:-1, 1:-1]
    B = p[:-2, 1:-1]
    D = p[1:-1, :-2]
    F = p[1:-1, 2:]
    H = p[2:, 1:-1]
    eq = lambda u, v: np.all(u == v, axis=-1)[..., None]
    e0 = np.where(eq(D, B) & ~eq(B, F) & ~eq(D, H), D, E)
    e1 = np.where(eq(B, F) & ~eq(B, D) & ~eq(F, H), F, E)
    e2 = np.where(eq(D, H) & ~eq(D, B) & ~eq(H, F), D, E)
    e3 = np.where(eq(H, F) & ~eq(D, H) & ~eq(B, F), F, E)
    out = np.zeros((h * 2, w * 2, 4), np.uint8)
    out[0::2, 0::2] = e0
    out[0::2, 1::2] = e1
    out[1::2, 0::2] = e2
    out[1::2, 1::2] = e3
    return out


# ── 층(layer) 다루기: 2배 속살 배열(H×W×4)을 캔버스 좌표로 옮기고 돌린다 ─────────────
def rotate(a, deg, pivot):
    """RotSprite 흉내: Scale2x 두 번(4배) → 최근접 회전 → 4배 격자 가운데 표본. 픽셀아트 계단이 덜 깨진다."""
    if abs(deg) < 1e-6:
        return a
    big = scale2x(scale2x(a))
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    px, py = pivot
    ys, xs = np.mgrid[0:h, 0:w]
    X = xs + .5 - px
    Y = ys + .5 - py
    sx = c * X + s * Y + px
    sy = -s * X + c * Y + py
    bx = np.floor(sx * 4).astype(int)
    by = np.floor(sy * 4).astype(int)
    ok = (bx >= 0) & (by >= 0) & (bx < w * 4) & (by < h * 4)
    out[ok] = big[by[ok], bx[ok]]
    return out


def shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = a[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def warp(a, sx=1., sy=1., shear=0., anchor=None, taper=0., bulge=0.):
    """바닥 가운데(anchor) 기준 비균일 확대 + 기울임(위로 갈수록 x 가 shear 만큼 밀림, 음수 = 앞/왼쪽).
    taper: 아래로 갈수록 폭이 줄어듦(도약 물방울). 최근접 표본이라 팔레트가 그대로다."""
    h, w = a.shape[:2]
    if anchor is None:
        m = a[..., 3] > 0
        ys, xs = np.nonzero(m)
        anchor = ((xs.min() + xs.max() + 1) / 2, ys.max() + 1)
    ax, ay = anchor
    Y, X = np.mgrid[0:h, 0:w]
    u = X + .5
    v = Y + .5
    hgt = (ay - v)  # 바닥에서 위로 잰 높이(대상 좌표)
    src_y = ay - hgt / sy
    rel = (ay - src_y)
    ht = max(1., (ay - np.nonzero(a[..., 3])[0].min()))
    wscale = sx * (1 - taper * (1 - np.clip(rel / ht, 0, 1))) * (1 + bulge * np.sin(np.clip(rel / ht, 0, 1) * math.pi))
    src_x = ax + (u - ax - shear * hgt / max(ht * sy, 1)) / np.maximum(wscale, .05)
    ix = np.floor(src_x).astype(int)
    iy = np.floor(src_y).astype(int)
    ok = (ix >= 0) & (iy >= 0) & (ix < w) & (iy < h)
    out = np.zeros_like(a)
    out[ok] = a[iy[ok], ix[ok]]
    return out


def over(dst, src):
    m = src[..., 3] > 0
    dst[m] = src[m]
    return dst


def fill_holes(a, region):
    """region(불리언) 안 빈 칸을 이웃 색으로 번져 채운다(팔이 떠난 몸통 자리 메우기)."""
    a = a.copy()
    for _ in range(40):
        empty = region & (a[..., 3] == 0)
        if not empty.any():
            break
        ys, xs = np.nonzero(empty)
        changed = False
        for y, x in zip(ys, xs):
            for dy, dx in ((0, 1), (0, -1), (-1, 0), (1, 0)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and a[yy, xx, 3] and region[yy, xx]:
                    a[y, x] = a[yy, xx]
                    changed = True
                    break
        if not changed:
            break
    return a


# ── 외곽선·명암 ────────────────────────────────────────────────────────────
def outline(a, col, sep_layers=()):
    """속살 밖으로 1px 외곽선(8방향). col = 'rrggbb' 또는 (x,y,안쪽색)→'rrggbb' 함수."""
    m = a[..., 3] > 0
    p = np.pad(m, 1)
    ring = np.zeros_like(m)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            # 4방향은 모두, 대각은 모서리를 둥글게 하려고 뺀다
            if dy and dx:
                continue
            ring |= p[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]]
    ring &= ~m
    out = a.copy()
    ys, xs = np.nonzero(ring)
    for y, x in zip(ys, xs):
        c = col(x, y) if callable(col) else col
        out[y, x] = hx(c)
    return out


def ramp_maps(colors, outc):
    """팔레트 안에서 한 칸 밝은 색·어두운 색 짝(색상 비슷한 것끼리). 외곽선 색은 어두운 쪽 대상에서 뺀다."""
    def hsv(c):
        return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)

    def lum(c):
        return .299 * c[0] + .587 * c[1] + .114 * c[2]
    outs = {hx(o) for o in outc}
    lighter, darker = {}, {}
    for c in colors:
        hc = hsv(c)
        best_l = best_d = None
        for p in colors:
            if p == c or p in outs:
                continue
            hp = hsv(p)
            dh = min(abs(hp[0] - hc[0]), 1 - abs(hp[0] - hc[0]))
            gray = hc[1] < .15 and hp[1] < .15
            if not gray and (dh > .07 or abs(hp[1] - hc[1]) > .45):
                continue
            d = lum(p) - lum(c)
            if 6 < d < 90 and (best_l is None or d < best_l[0]):
                best_l = (d, p)
            if -90 < d < -6 and (best_d is None or -d < best_d[0]):
                best_d = (-d, p)
        if best_l:
            lighter[c] = best_l[1]
        if best_d:
            darker[c] = best_d[1]
    return lighter, darker


def shade(a, lighter, darker, outc):
    """광원 왼쪽 위: 외곽선 바로 안쪽 — 위·왼쪽 테두리는 한 칸 밝게, 아래·오른쪽 테두리는 한 칸 어둡게."""
    outs = {hx(o) for o in outc}
    h, w = a.shape[:2]
    out = a.copy()

    def isedge(y, x):
        if not (0 <= y < h and 0 <= x < w):
            return True
        return a[y, x, 3] == 0 or tuple(a[y, x]) in outs
    for y in range(h):
        for x in range(w):
            c = tuple(a[y, x])
            if c[3] == 0 or c in outs:
                continue
            up, lf, dn, rt = isedge(y - 1, x), isedge(y, x - 1), isedge(y + 1, x), isedge(y, x + 1)
            if (up or lf) and not (dn or rt) and isedge(y - 1, x - 1) and c in lighter:
                out[y, x] = lighter[c]
            elif (dn or rt) and not (up or lf) and isedge(y + 1, x + 1) and c in darker:
                out[y, x] = darker[c]
    return out


# ── 작은 그리기 도구 ──────────────────────────────────────────────────────────
def put(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = hx(c) if isinstance(c, str) else c


def disc(a, cx, cy, r, c):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r:
                put(a, x, y, c)


def spark(a, x, y, c, core=None):
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        put(a, x + dx, y + dy, c)
    put(a, x, y, core or c)


def place(layer, cell, cx, bottom):
    """2배 속살 층(임의 크기)을 cell 캔버스에 가로 중심 cx, 맨 아래 불투명 행 bottom 으로 놓는다."""
    m = layer[..., 3] > 0
    ys, xs = np.nonzero(m)
    x0, x1, y1 = xs.min(), xs.max() + 1, ys.max()
    canvas = np.zeros((cell, cell, 4), np.uint8)
    ox = int(round(cx - (x0 + x1) / 2))
    oy = bottom - y1
    for y, x in zip(ys, xs):
        yy, xx = y + oy, x + ox
        if 0 <= yy < cell and 0 <= xx < cell:
            canvas[yy, xx] = layer[y, x]
    return canvas


def pad_to(a, size):
    """배열을 size×size 가운데(가로)·아래 정렬 여백 캔버스로 — 회전·기울임에 공간을 준다."""
    ys, xs = np.nonzero(a[..., 3] > 0)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape[:2]
    out = np.zeros((size, size, 4), np.uint8)
    ox = (size - w) // 2
    oy = size - h - 8
    out[oy:oy + h, ox:ox + w] = a
    return out


# ── 시트 조립·검사 ────────────────────────────────────────────────────────────
def assemble(chip, cell, frames):
    sheet = np.zeros((cell * 5, cell * 3, 4), np.uint8)
    for k, n in enumerate(NAMES):
        f = frames[n]
        assert f.shape[:2] == (cell, cell), (n, f.shape)
        r, c = divmod(k, 3)
        sheet[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] = f
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(OUT / f'{chip}.png')
    return sheet


def check(chip, air=()):
    """크기·알파·색 수·빈 칸·칸끼리 다름·바닥선·칸 경계. air = 바닥선 검사에서 뺄 칸(공중 자세)."""
    im = Image.open(OUT / f'{chip}.png').convert('RGBA')
    a = np.array(im)
    cell = im.width // 3
    errs = []
    if im.size != (cell * 3, cell * 5) or cell not in (48, 64):
        errs.append(f'size {im.size}')
    al = set(np.unique(a[..., 3]).tolist())
    if al - {0, 255}:
        errs.append(f'alpha {al}')
    cols = {tuple(p) for p in a[a[..., 3] > 0][:, :3].tolist()}
    if len(cols) > 16:
        errs.append(f'colors {len(cols)}')
    cells = {}
    bottoms = {}
    for k, n in enumerate(NAMES):
        r, c = divmod(k, 3)
        f = a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
        cells[n] = f
        m = f[..., 3] > 0
        if not m.any():
            errs.append(f'empty {n}')
            continue
        ys, xs = np.nonzero(m)
        bottoms[n] = int(ys.max())
        if xs.min() < 1 or xs.max() > cell - 2 or ys.min() < 1:
            errs.append(f'edge {n} x{xs.min()}-{xs.max()} y{ys.min()}')
        if ys.max() > cell - 4:
            errs.append(f'below-ground {n} {ys.max()}')
        if n not in air and ys.max() != cell - 4:
            errs.append(f'baseline {n} {ys.max()}')
        # 외톨이 픽셀(8방향 이웃 없음)
        p = np.pad(m, 1)
        nb = sum(p[1 + dy:1 + dy + cell, 1 + dx:1 + dx + cell] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
        lone = int((m & (nb == 0)).sum())
        if lone:
            errs.append(f'lone {n} {lone}')
    for i in range(len(NAMES)):
        for j in range(i + 1, len(NAMES)):
            if cells[NAMES[i]].tobytes() == cells[NAMES[j]].tobytes():
                errs.append(f'same {NAMES[i]}={NAMES[j]}')
    print(f'{chip}: {im.size[0]}x{im.size[1]} cell {cell} colors {len(cols)} alpha {sorted(al)} '
          f'bottom {sorted(set(bottoms.values()))} air {list(air)} -> {"OK" if not errs else errs}')
    return not errs


# ── 확인판 ───────────────────────────────────────────────────────────────────
def boards(chips=('monster1-0', 'monster1-1', 'monster1-2', 'monster1-3')):
    BOARD.mkdir(parents=True, exist_ok=True)
    from PIL import ImageDraw
    bgc = (0x30, 0x38, 0x50, 255)
    for ch in chips:
        i = int(ch.split('-')[1])
        sh = Image.open(OUT / f'{ch}.png').convert('RGBA')
        cell = sh.width // 3
        s = 4 if cell == 48 else 3
        chipim = Image.open(CHIPSET).convert('RGBA').crop((i * 72, 0, i * 72 + 72, 128))
        W = 72 * 4 + 20 + 3 * cell * s + 20
        H = max(128 * 4, 5 * cell * s)
        b = Image.new('RGBA', (W, H), bgc)
        b.paste(chipim.resize((288, 512), Image.NEAREST), (0, 0))
        sheet = Image.new('RGBA', sh.size, (0x44, 0x4c, 0x66, 255))
        sheet.alpha_composite(sh)
        d = ImageDraw.Draw(sheet)
        for k in range(1, 3):
            d.line([(k * cell, 0), (k * cell, sh.height)], fill=(0x22, 0x28, 0x38, 255))
        for k in range(1, 5):
            d.line([(0, k * cell), (sh.width, k * cell)], fill=(0x22, 0x28, 0x38, 255))
        for k in range(5):
            d.line([(0, k * cell + cell - 3), (sh.width, k * cell + cell - 3)], fill=(0x55, 0x60, 0x40, 255))
        b.paste(sheet.resize((sh.width * s, sh.height * s), Image.NEAREST), (72 * 4 + 20, 0))
        if b.width > 1900 or b.height > 1900:
            k = 1900 / max(b.size)
            b = b.resize((int(b.width * k), int(b.height * k)), Image.NEAREST)
        b.save(BOARD / f'board-{ch}.png')
    # 크기 비교: 사람 아군(actor1-0 48칸) + 담당 4명 대기, 모두 같은 배율(4배), 바닥선 맞춤
    S = 4
    items = [Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))]
    for ch in chips:
        sh = Image.open(OUT / f'{ch}.png').convert('RGBA')
        c = sh.width // 3
        items.append(sh.crop((0, 0, c, c)))
    W = sum(it.width * S + 16 for it in items)
    H = 64 * S + 8
    b = Image.new('RGBA', (W, H), bgc)
    x = 0
    for it in items:
        y = H - 4 - (it.height - 3) * S
        tile = Image.new('RGBA', it.size, (0x40, 0x48, 0x60, 255))
        tile.alpha_composite(it)
        b.paste(tile.resize((it.width * S, it.height * S), Image.NEAREST), (x, y))
        x += it.width * S + 16
    ImageDraw.Draw(b).line([(0, H - 4 - 1), (W, H - 4 - 1)], fill=(0xff, 0xd0, 0x40, 255))
    if b.width > 1900:
        k = 1900 / b.width
        b = b.resize((int(b.width * k), int(b.height * k)), Image.NEAREST)
    b.save(BOARD / 'size-compare.png')
    print('boards ->', BOARD)


# ═══════════════════════════════════════════════════════════════════════
# 빌더 1: monster1-0 슬라임 — 칩 13×9 방울(연두 테두리·짙은 속). 2배 ≈ 24×16. 얼굴 없이 짙은 속이 표정.
# ═══════════════════════════════════════════════════════════════════════
SLIME_OUT = ['000000']


def slime_base():
    a = chip_frame(0)
    a = strip_outline(a, SLIME_OUT)
    return pad_to(scale2x(a), 80)


def build_slime():
    CELL = 48
    G = CELL - 4
    base = slime_base()
    pal = sorted({tuple(p) for p in base[base[..., 3] > 0].tolist()})
    lighter, darker = ramp_maps(pal, SLIME_OUT)
    GOLD, GOLDD, GLOW = 'f8d048', 'b07818', 'e0e8b1'
    W = dict(  # sx, sy, shear, lift, taper, bulge, dx
        idle_a=(1, 1, 0, 0, 0, 0, 0), idle_b=(1.05, .94, 0, 0, 0, 0, 0), idle_c=(1.09, .89, 0, 0, 0, 0, 0),
        windup=(1.2, .72, 3, 0, 0, 0, 2), move=(.88, 1.2, -4, 7, .25, 0, -2), attack=(1.3, .8, -5, 0, 0, 0, -1),
        recover=(1.07, .92, -1, 0, 0, 0, -1), hit=(.9, 1.08, 5, 2, 0, 0, 3), dead=(1.5, .45, 0, 0, 0, 0, 0),
        cast_charge=(1.12, .84, 0, 0, 0, .06, 0), cast_raise=(.84, 1.3, 0, 0, 0, 0, 0), cast_release=(1.14, .9, -4, 0, 0, 0, 4),
        leap=(.86, 1.16, -2, 14, .3, 0, 0), buff=(1.12, 1.12, 0, 0, 0, .1, 0), finisher=(1.2, 1.26, 0, 0, 0, .08, 0))
    frames = {}
    for n in NAMES:
        sx, sy, sh, lift, tp, bg, dx = W[n]
        body = warp(base, sx, sy, sh, taper=tp, bulge=bg)
        if n == 'dead':  # 녹아 퍼짐: 한 칸 어둡게
            m = body[..., 3] > 0
            for y, x in zip(*np.nonzero(m)):
                c = tuple(body[y, x])
                if c in darker:
                    body[y, x] = darker[c]
        body = shade(outline(body, '000000'), lighter, darker, SLIME_OUT)
        f = place(body, CELL, CELL / 2 + dx, G - lift)
        m = f[..., 3] > 0
        ys, xs = np.nonzero(m)
        top, l, r = ys.min(), xs.min(), xs.max()
        if n == 'move':  # 튀어 오른 자리 먼지
            for x in (20, 24, 28):
                put(f, x, G, '087129'); put(f, x + 1, G, '087129')
        if n == 'attack':  # 앞으로 튄 방울
            disc(f, l - 3, G - 5, 1.6, '40ad29'); put(f, l - 4, G - 6, 'c0e869')
        if n == 'hit':
            for k, (x, y) in enumerate(((r + 2, top + 2), (r + 4, top + 6), (r + 3, top + 10))):
                put(f, x, y, '6bd926'); put(f, x + 1, y, '6bd926')
        if n == 'dead':
            for x0 in (l - 4, r + 3):
                put(f, x0, G, '087129'); put(f, x0 + 1, G, '087129'); put(f, x0, G - 1, '000000'); put(f, x0 + 1, G - 1, '000000')
        if n == 'cast_charge':  # 둘레 기운이 몸으로 모인다
            for (x, y) in ((l - 4, top + 2), (r + 4, top), (CELL // 2, top - 6)):
                spark(f, x, y, 'c0e869', GLOW)
        if n == 'cast_raise':
            for (x, y) in ((CELL // 2 - 5, top - 5), (CELL // 2 + 4, top - 8), (CELL // 2, top - 13)):
                spark(f, x, y, 'c0e869', GLOW)
        if n == 'cast_release':  # 앞으로 산성 방울 셋
            for k, (x, y, rr) in enumerate(((l - 3, top + 6, 2.2), (l - 7, top + 4, 1.6), (l - 10, top + 2, 1.1))):
                disc(f, x, y, rr + 1, '000000'); disc(f, x, y, rr, '40ad29'); put(f, int(x - rr / 2), int(y - rr / 2), 'e0e8b1')
        if n == 'leap':  # 땅에 남은 그림자 대신 떨어지는 물방울 둘
            for (x, y) in ((22, G - 3), (27, G - 1)):
                put(f, x, y, '40ad29'); put(f, x, y - 1, '40ad29'); put(f, x, y - 2, '000000')
        if n == 'buff':  # 탱글한 막: 몸 둘레 반짝
            for (x, y) in ((l - 3, top + 4), (r + 3, top + 3), (l + 3, top - 3), (r - 2, top - 4)):
                spark(f, x, y, 'a9e74e', GLOW)
        if n == 'finisher':  # 킹 슬라임: 금관
            cx = (l + r) // 2 - 1
            ty = top - 1
            crown = [(-5, 0), (-4, 0), (-3, 0), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (5, 0),
                     (-5, -1), (-4, -1), (-3, -1), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, -1), (3, -1), (4, -1), (5, -1),
                     (-5, -2), (-4, -2), (-5, -3), (-4, -3), (-1, -2), (0, -2), (1, -2), (-1, -3), (0, -3), (1, -3), (0, -4),
                     (4, -2), (5, -2), (4, -3), (5, -3)]
            cm = np.zeros((CELL, CELL), bool)
            for dx_, dy_ in crown:
                if 0 <= ty + dy_ < CELL:
                    cm[ty + dy_, cx + dx_] = True
            for y, x in zip(*np.nonzero(cm)):
                f[y, x] = hx(GOLD)
            for y, x in zip(*np.nonzero(cm)):
                if y == ty or x == cx + 5 or (x == cx + 4 and y < ty - 1) or (x == cx + 1 and y < ty - 1):
                    f[y, x] = hx(GOLDD)
            put(f, cx, ty - 1, 'c52029') if False else put(f, cx - 2, ty, 'e0e8b1')
            ring = np.zeros_like(cm)
            p = np.pad(cm, 1)
            for dy_, dx_ in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                ring |= p[1 + dy_:1 + dy_ + CELL, 1 + dx_:1 + dx_ + CELL]
            ring &= ~cm & (f[..., 3] == 0)
            for y, x in zip(*np.nonzero(ring)):
                f[y, x] = hx('000000')
            for (x, y) in ((l - 4, top + 6), (r + 4, top + 4), (l - 2, top - 3), (r + 2, top - 5)):
                spark(f, x, y, GOLD, 'fff8c8' if False else GLOW)
        frames[n] = f
    assemble('monster1-0', CELL, frames)
    return check('monster1-0', air=('move', 'leap', 'hit'))


# ═══════════════════════════════════════════════════════════════════════
# 빌더 4: monster1-3 유령 — 칩 21×20 흰 천 뭉치, 검은 눈 둘·붉게 벌린 입, 몸 안 회색 주름(손).
# 칩 × 2 = 42×40 이라 셀 64. 공중형: 평소 바닥에서 4px 뜬다(맨 아래 행 cell−8), dead 만 바닥.
# ═══════════════════════════════════════════════════════════════════════
GHOST_OUT = ['6a6a6a']


def ghost_chip(face='o'):
    a = chip_frame(3)
    K, R, RD, RL, G2, G3 = hx('000000'), hx('7b0818'), hx('4a0008'), hx('c52029'), hx('d5d5d5'), hx('f6f6f6')
    if face == 'x':  # 질끈 감은 눈(><)
        for (x, y) in ((8, 14), (7, 15), (13, 14), (15, 15)):
            a[y, x] = G3
        for (x, y) in ((7, 14), (8, 15), (7, 16)):
            a[y, x] = K
        for (x, y) in ((14, 14), (14, 15), (15, 16)):
            a[y, x] = K
    if face == 'shut':  # 기 모으는 가는 눈
        for (x, y) in ((8, 14), (7, 15), (13, 14), (15, 15)):
            a[y, x] = G3
        for x in (7, 8):
            a[15, x] = K
        for x in (13, 14):
            a[15, x] = K
    if face == 'wail':  # 입을 크게(아래로 한 줄 더)
        for x in (9, 10, 11, 12):
            a[20, x] = RD if x in (9, 12) else RL
        a[19, 10] = RL; a[19, 11] = RL
    if face == 'small':  # 다문 입
        for y in (17, 18, 19):
            for x in range(8, 14):
                if tuple(a[y, x]) in (R, RD, RL, hx('a41820'), hx('201800')):
                    a[y, x] = G2 if y == 19 else G3
        for x in (10, 11):
            a[18, x] = RD
    return a


def ghost_base(face='o'):
    a = strip_outline(ghost_chip(face), GHOST_OUT)
    return pad_to(scale2x(a), 80)


def build_ghost():
    CELL = 64
    G = CELL - 4
    FLY = G - 4
    pal = sorted({tuple(p) for p in ghost_base()[ghost_base()[..., 3] > 0].tolist()})
    lighter, darker = ramp_maps(pal, GHOST_OUT)
    WISP, WISPL = '5aa8e8', 'c8ecff'
    W = dict(  # face, sx, sy, shear, lift(바닥 위 추가), dx
        idle_a=('o', 1, 1, 0, 0, 0), idle_b=('o', 1.03, .96, 0, 1, 0), idle_c=('o', 1.05, .93, 0, 2, 0),
        windup=('o', .94, 1.06, 4, 3, 3), move=('o', 1.08, .94, -5, 2, -2), attack=('wail', 1.12, .92, -7, 0, 1),
        recover=('o', 1.02, .98, -2, 1, -1), hit=('x', .94, 1.04, 6, 3, 3), dead=('x', 1.3, .55, 0, 0, 0),
        cast_charge=('shut', .94, .94, 0, 0, 0), cast_raise=('o', .92, 1.1, 0, 2, 0), cast_release=('wail', 1.1, .94, -6, 2, 5),
        leap=('o', .9, 1.08, -6, 10, -1), buff=('wail', 1.1, 1.08, 0, 1, 0), finisher=('wail', 1.1, 1.06, 3, 0, -5))
    frames = {}
    for n in NAMES:
        face, sx, sy, sh, lift, dx = W[n]
        body = warp(ghost_base(face), sx, sy, sh)
        body = shade(outline(body, '6a6a6a'), lighter, darker, GHOST_OUT)
        bottom = G if n == 'dead' else FLY - lift
        f = place(body, CELL, CELL / 2 + dx, bottom)
        m = f[..., 3] > 0
        ys, xs = np.nonzero(m)
        top, l, r = ys.min(), xs.min(), xs.max()
        if n == 'dead':  # 빠져나가는 넋 한 줄기
            for k, (x, y) in enumerate(((r - 3, top - 3), (r - 2, top - 5), (r - 3, top - 7))):
                put(f, x, y, 'd5d5d5')
            put(f, r - 2, top - 4, 'd5d5d5'); put(f, r - 3, top - 6, 'd5d5d5')
        if n in ('move', 'attack', 'leap'):  # 뒤로 남는 꼬리 잔상
            for k in range(3):
                x = r + 2 + k * 3
                y = top + 12 + k * 2
                if x + 1 > CELL - 2:
                    break
                put(f, x, y, 'd5d5d5'); put(f, x + 1, y, 'd5d5d5')
        if n == 'attack':  # 앞으로 뻗은 서늘한 손길
            hy = top + 16
            for x in range(l - 5, l + 1):
                put(f, x, hy, 'f6f6f6'); put(f, x, hy + 1, 'd5d5d5'); put(f, x, hy - 1, '6a6a6a'); put(f, x, hy + 2, '6a6a6a')
            put(f, l - 6, hy, '6a6a6a'); put(f, l - 6, hy + 1, '6a6a6a')
        if n == 'hit':
            for (x, y) in ((l - 3, top + 4), (l - 5, top + 9)):
                put(f, x, y, WISPL); put(f, x - 1, y, WISPL)
        if n == 'cast_charge':  # 도깨비불 둘이 모인다
            for (x, y) in ((l - 4, top + 12), (r + 4, top + 8)):
                disc(f, x, y, 2.2, WISP); put(f, x, y, WISPL); put(f, x - 1, y - 1, WISPL)
        if n == 'cast_raise':  # 머리 위로 도깨비불
            x, y = (l + r) // 2, top - 6
            disc(f, x, y, 3, WISP); disc(f, x - .5, y - .5, 1.6, WISPL)
            put(f, x, y - 4, WISP); put(f, x + 1, y - 5, WISP)
        if n == 'cast_release':  # 앞으로 날아가는 도깨비불
            x, y = l - 5, top + 14
            disc(f, x, y, 3, WISP); disc(f, x - .5, y - .5, 1.5, WISPL)
            for k in range(3):
                put(f, x + 4 + k * 3, y, WISP); put(f, x + 5 + k * 3, y, WISP)
        if n == 'buff':  # 통곡 음파(양옆 괄호)
            for side, x0 in ((-1, l - 3), (1, r + 3)):
                for k in range(-3, 4):
                    put(f, x0 + side * (0 if abs(k) < 2 else -1), top + 14 + k, WISP)
        if n == 'finisher':  # 백귀야행: 뒤로 작은 유령 둘(칩 원본 1배)
            mini = outline(strip_outline(chip_frame(3), GHOST_OUT), '6a6a6a')
            mini = mini[9:31, 0:24]
            for (mx, my) in ((r - 2, top + 6), (r + 3, top + 24)):
                mm = mini[..., 3] > 0
                for y, x in zip(*np.nonzero(mm)):
                    yy, xx = my - 10 + y, mx - 12 + x
                    if 1 <= yy < CELL - 4 and 1 <= xx < CELL - 1 and f[yy, xx, 3] == 0:
                        f[yy, xx] = mini[y, x]
        frames[n] = f
    assemble('monster1-3', CELL, frames)
    air = tuple(n for n in NAMES if n != 'dead')
    return check('monster1-3', air=air)


BUILDERS = {'monster1-0': build_slime, 'monster1-3': build_ghost}


def build(chip):
    return BUILDERS[chip]()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'board':
        boards()
    else:
        oks = [build(ch) for ch in (sys.argv[1:] or list(BUILDERS))]
        sys.exit(0 if all(oks) else 1)

