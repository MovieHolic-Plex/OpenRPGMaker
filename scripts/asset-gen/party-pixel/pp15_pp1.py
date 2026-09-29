"""pp15_pp1 — b1(Animal 8) 파티원 15칸 전투 시트 빌더. 걷기 칩 왼쪽 보기(행 3)를 2배로 키워 부위 인형으로 움직인다.

규격: src/assets/retroRoster.ts RetroPartyPixelSheet · src/assets/partyPixelSheets.ts. 셀 cell(48|64) 3열×5행, 왼쪽 보기,
바닥 기준선 y=cell-4, 알파 0/255, ≤16색, 1px 어두운 외곽선, 광원 왼쪽 위.
행 0 idle_a·b·c / 1 windup·move·attack / 2 recover·hit·dead / 3 cast_charge·cast_raise·cast_release / 4 leap·buff·finisher.

Animal.png 의 방향 행은 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽(RPG Maker 2000 순서)이다. 칩 i 는 4열×2행 중 i번째 72×128 블록.
밑그림 = 칩 왼쪽 보기 가운데 칸 24×32 → Scale2x(계단 외곽선을 대각으로 다듬는 2배) → 실루엣 외곽선 1px 로 얇게
(외곽선이 없는 칩은 1px 덧씌움) → 위쪽 안쪽 테두리에 한 단계 밝게, 아래쪽 안쪽 테두리에 한 단계 어둡게(칩 팔레트 안에서).
그다음 칩 1배 좌표 사각형으로 부위(머리·몸·앞다리·뒷다리·꼬리)를 가르고 자세표대로 회전·이동한다(4배 표본 → 최빈값 축소).
픽셀은 걷기 칩 원본 색만 쓴다(날개·입 안·기합 선도 칩 팔레트). 외부 그림 없음.

네 빌더: build_sheet(시트) · check_sheet(검사) · board_chip(원본 칩 옆 15칸 확인판) · board_lineup(크기 비교판).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = ROOT / 'public/assets/easyrpg/charset/Animal.png'
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/pp1'
KEY = (0, 147, 146)
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
BG = (0x20, 0x28, 0x40, 255)
SS = 4  # 회전 표본 배율


def lum(c):
    return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11


# ---------------------------------------------------------------- 밑그림
def chip_frame(idx, col=1, row=3):
    im = Image.open(SRC).convert('RGB')
    bx, by = (idx % 4) * 72 + col * 24, (idx // 4) * 128 + row * 32
    fr = im.crop((bx, by, bx + 24, by + 32))
    a = np.zeros((32, 24, 4), np.uint8)
    px = np.array(fr)
    a[..., :3] = px
    a[..., 3] = np.where((px == KEY).all(-1), 0, 255)
    a[a[..., 3] == 0] = 0
    return a


def to_index(a, pal):
    """RGBA → 팔레트 번호(0 = 투명, 1.. = pal[i-1])."""
    idx = np.zeros(a.shape[:2], np.int16)
    for i, c in enumerate(pal):
        idx[(a[..., 3] > 0) & (a[..., 0] == c[0]) & (a[..., 1] == c[1]) & (a[..., 2] == c[2])] = i + 1
    return idx


def scale2x(g):
    h, w = g.shape
    p = np.pad(g, 1, mode='constant')
    E = p[1:-1, 1:-1]
    B = p[:-2, 1:-1]
    H = p[2:, 1:-1]
    D = p[1:-1, :-2]
    F = p[1:-1, 2:]
    o = np.zeros((h * 2, w * 2), g.dtype)
    ok = (B != H) & (D != F)
    o[0::2, 0::2] = np.where(ok & (D == B), D, E)
    o[0::2, 1::2] = np.where(ok & (B == F), F, E)
    o[1::2, 0::2] = np.where(ok & (D == H), D, E)
    o[1::2, 1::2] = np.where(ok & (H == F), F, E)
    return o


def n4(m):
    p = np.pad(m, 1)
    return [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]


def border(g):
    """불투명이면서 네 이웃 중 투명이 있는 칸."""
    op = g > 0
    t = np.zeros_like(op)
    for n in n4(~op):
        t |= n
    return op & t


def ramps(pal):
    """칩 팔레트 안에서 한 단계 밝은/어두운 색 번호표."""
    L = [lum(c) for c in pal]
    up, dn = {}, {}
    for i, c in enumerate(pal):
        best_u = best_d = None
        for j, d in enumerate(pal):
            if j == i:
                continue
            dist = sum((a - b) ** 2 for a, b in zip(c, d)) ** 0.5
            hue_ok = dist < 120
            if L[j] > L[i] + 8 and hue_ok and (best_u is None or dist < best_u[0]):
                best_u = (dist, j)
            if L[j] < L[i] - 8 and hue_ok and (best_d is None or dist < best_d[0]):
                best_d = (dist, j)
        if best_u:
            up[i + 1] = best_u[1] + 1
        if best_d:
            dn[i + 1] = best_d[1] + 1
    return up, dn


def base_art(spec, col=1):
    """칩 1배 → 2배 밑그림(번호 격자). 반환: (격자 64×48, 팔레트, 외곽선 번호)."""
    a = chip_frame(spec['idx'], col)
    pal = spec['pal']
    g1 = to_index(a, pal)
    ol = spec['outline']  # 외곽선 번호(1-based)
    if spec.get('add_outline'):
        # 외곽선 없는 칩: 1배에서 먼저 한 칸 덧씌운다(2배 뒤에는 1px 가 되도록 2배 뒤에 처리)
        pass
    g = scale2x(g1)
    # 1배 칸 표지(부위 나누기용)
    ys, xs = np.mgrid[0:64, 0:48]
    src_y, src_x = ys // 2, xs // 2
    if spec.get('add_outline'):
        op = g > 0
        grow = np.zeros_like(op)
        for n in n4(op):
            grow |= n
        grow &= ~op
        g = np.where(grow, ol, g)
    else:
        # 실루엣 외곽선 1px 로 얇게: 1배 테두리 외곽선 칸에서 난 2배 칸 중 2배 테두리가 아닌 것은 안쪽 색으로
        b1 = border(g1)
        inner = np.zeros_like(g1)
        dark = set(spec.get('dark', [])) | {ol}
        for y in range(32):
            for x in range(24):
                if not (b1[y, x] and g1[y, x] in dark):
                    continue
                cands = []
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < 32 and 0 <= xx < 24 and g1[yy, xx] > 0 and not b1[yy, xx]:
                        cands.append(g1[yy, xx])
                inner[y, x] = cands[0] if cands else g1[y, x]
        b2 = border(g)
        from_b = b1[src_y, src_x] & np.isin(g1[src_y, src_x], list(dark)) & (g > 0)
        fill = from_b & ~b2
        g = np.where(fill, inner[src_y, src_x], g)
        g = np.where(border(g), ol, g)
    # 빛·그늘 한 단계(왼쪽 위 광원): 테두리 바로 안쪽 한 줄
    up, dn = ramps(pal)
    b = border(g)
    Nu, Nd, Nl, Nr = n4(b)
    inside = (g > 0) & ~b & (g != ol)
    shade = spec.get('shade', True)
    out = g.copy()
    if shade:
        top = inside & Nu
        bot = inside & Nd & ~Nu
        for i, j in up.items():
            out[top & (g == i)] = j
        for i, j in dn.items():
            out[bot & (g == i) & ~top] = j
    return out, pal, ol, (src_x, src_y)


def split_parts(g, spec):
    """칩 1배 좌표 사각형으로 부위를 가른다. 반환 {이름: 격자}. dup 은 이웃 부위 칸을 겹쳐 복사(회전 때 틈 메우기)."""
    labels = np.full(g.shape, 'body', object)
    ys, xs = np.mgrid[0:64, 0:48]
    sx, sy = xs // 2, ys // 2
    for name in ('tail', 'fore', 'hind', 'legs', 'head'):
        for r in spec['parts'].get(name, []):
            x0, y0, x1, y1 = r
            m = (sx >= x0) & (sx <= x1) & (sy >= y0) & (sy <= y1)
            labels[m] = name
    parts = {}
    for name in ['body'] + list(spec['parts'].keys()):
        m = (labels == name) & (g > 0)
        parts[name] = np.where(m, g, 0)
    # 겹침 복사: 다리 윗줄 1배 2칸, 머리 목 쪽
    for name, extra in spec.get('dup', {}).items():
        for r in extra:
            x0, y0, x1, y1 = r
            m = (sx >= x0) & (sx <= x1) & (sy >= y0) & (sy <= y1) & (g > 0) & (parts[name] == 0)
            parts[name] = np.where(m, g, parts[name])
    return parts


# ---------------------------------------------------------------- 변환
def mat_rot(deg, pivot):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    px, py = pivot
    return np.array([[c, -s, px - c * px + s * py], [s, c, py - s * px - c * py], [0, 0, 1]])


def mat_tr(dx, dy):
    return np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1.0]])


def render(canvas, part, M, off):
    """part(64×48 번호 격자, 밑그림 좌표)를 M(밑그림→밑그림 좌표)으로 옮겨 canvas(셀 격자)에 덮는다. off = 밑그림 원점의 셀 좌표."""
    H, W = canvas.shape
    Mi = np.linalg.inv(mat_tr(*off) @ M)
    ys, xs = np.mgrid[0:H * SS, 0:W * SS]
    u = (xs + 0.5) / SS
    v = (ys + 0.5) / SS
    sx = Mi[0, 0] * u + Mi[0, 1] * v + Mi[0, 2]
    sy = Mi[1, 0] * u + Mi[1, 1] * v + Mi[1, 2]
    ix = np.floor(sx).astype(int)
    iy = np.floor(sy).astype(int)
    ok = (ix >= 0) & (ix < part.shape[1]) & (iy >= 0) & (iy < part.shape[0])
    samp = np.zeros(ix.shape, np.int16)
    samp[ok] = part[iy[ok], ix[ok]]
    blk = samp.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    K = int(part.max()) + 1 if part.max() > 0 else 1
    cnt = np.stack([(blk == k).sum(-1) for k in range(K)], -1)
    opaque = cnt[..., 1:].sum(-1) if K > 1 else np.zeros((H, W), int)
    best = cnt[..., 1:].argmax(-1) + 1 if K > 1 else np.zeros((H, W), int)
    m = opaque * 2 >= SS * SS  # 절반 이상 덮이면 불투명
    canvas[m] = best[m]
    return canvas


def cleanup(g, ol):
    """잡픽셀(4이웃 불투명 0~1 개인 외톨이) 제거, 바늘구멍 메우기, 실루엣 1px 외곽선."""
    # 부위를 돌린 뒤 생긴 1px 틈(양옆 또는 위아래가 막힌 투명 칸)을 이웃 색으로 메운다
    for _ in range(2):
        op = g > 0
        U, D, L, R = n4(op)
        gap = ~op & ((L & R) | (U & D))
        if not gap.any():
            break
        p = np.pad(g, 1)
        left, up = p[1:-1, :-2], p[:-2, 1:-1]
        g = np.where(gap, np.where(left > 0, left, up), g)
    for _ in range(2):
        op = g > 0
        cnt = sum(n.astype(int) for n in n4(op))
        g = np.where(op & (cnt <= 1), 0, g)
    op = g > 0
    cnt = sum(n.astype(int) for n in n4(op))
    hole = ~op & (cnt == 4)
    if hole.any():
        p = np.pad(g, 1)
        g = np.where(hole, p[1:-1, :-2], g)
    b = border(g)
    g = np.where(b, ol, g)
    # 외곽선 두 겹이 된 안쪽 칸(외곽선 색이면서 외곽선이 아닌 칸) 은 그대로 둔다 — 칩의 어두운 무늬일 수 있다
    return g


# ---------------------------------------------------------------- 머리 편집(입·눈)
def head_edit(part, spec, pose, pal, ol):
    part = part.copy()
    ey = pose.get('eye')
    if ey and spec.get('eye'):
        for (ex, eyy) in spec['eye']:
            x0, y0 = ex * 2, eyy * 2
            skin = spec.get('skin') or part[y0 - 1, x0]
            part[y0:y0 + 2, x0:x0 + 2] = np.where(part[y0:y0 + 2, x0:x0 + 2] > 0, skin, 0)
        ex, eyy = spec['eye'][0]
        x0, y0 = ex * 2, eyy * 2
        if ey == 'closed':
            for x in range(x0 - 1, x0 + 3):
                if part[y0 + 1, x] > 0:
                    part[y0 + 1, x] = ol
        elif ey == 'squint':
            for (x, y) in ((x0 - 1, y0), (x0, y0 + 1), (x0 + 1, y0 + 1), (x0 + 2, y0)):
                if part[y, x] > 0:
                    part[y, x] = ol
        elif ey == 'x':
            for (x, y) in ((x0 - 1, y0 - 1), (x0, y0), (x0 + 1, y0 + 1), (x0 + 1, y0 - 1), (x0 - 1, y0 + 1)):
                if 0 <= y < 64 and part[y, x] > 0:
                    part[y, x] = ol
        elif ey == 'angry':
            for (ex, eyy) in spec['eye']:
                part[eyy * 2:eyy * 2 + 2, ex * 2:ex * 2 + 2] = ol
            for x in range(x0 - 1, x0 + 3):
                y = y0 - 2 + (x - x0 + 1) // 2
                if part[y, x] > 0:
                    part[y, x] = ol
            if spec.get('eyehi'):
                part[y0, x0] = spec['eyehi']
    mo = pose.get('mouth', 0)
    if mo and spec.get('mouth'):
        mx0, mx1, my = spec['mouth']  # 1배: 턱 앞 x 범위와 입선 y
        X0, X1, Y = mx0 * 2, mx1 * 2 + 1, my * 2
        k = min(3, 1 + mo)  # 벌림 px
        jaw = np.zeros_like(part)
        ys, xs = np.mgrid[0:64, 0:48]
        jm = (ys >= Y) & (xs >= X0) & (xs <= X1) & (part > 0)
        jaw[jm] = part[jm]
        part[jm] = 0
        moved = np.zeros_like(part)
        moved[k:, :] = jaw[:-k, :]
        # 위턱 아랫줄을 외곽선으로
        for x in range(X0, X1 + 1):
            col = np.nonzero(part[:Y, x])[0]
            if len(col):
                part[col.max(), x] = ol
        for x in range(X0, X1 + 1):
            colj = np.nonzero(moved[:, x])[0]
            colu = np.nonzero(part[:Y, x])[0]
            if len(colj) and len(colu):
                for y in range(colu.max() + 1, colj.min()):
                    part[y, x] = ol
                # 입 안쪽(목 쪽) 아랫줄에 혀색 한 줄
                if x >= X1 - 3 and spec.get('mouthc') and colj.min() - colu.max() > 2:
                    part[colj.min() - 1, x] = spec['mouthc']
        part = np.where(moved > 0, moved, part)
        # 턱 윗줄 외곽선
        for x in range(X0, X1 + 1):
            colj = np.nonzero(moved[:, x])[0]
            if len(colj):
                part[colj.min(), x] = ol
        # 송곳니
        if spec.get('fang'):
            for x in spec['fang']:
                X = x * 2
                colu = np.nonzero(part[:Y + k, X])[0]
                if len(colu):
                    y = Y
                    if part[y, X] > 0:
                        part[y, X] = spec['fangc']
    return part


# ---------------------------------------------------------------- 날개(수탉)
def wing(part, spec, ang, pal, ol):
    """수탉 몸 위에 들어 올린 날개. 어깨(1배 좌표)에서 ang 방향(도, 0=뒤쪽 수평, -90=위)으로 편 부채꼴."""
    sx, sy = spec['wing_root']
    X, Y = sx * 2, sy * 2
    Ln = spec.get('wing_len', 14)
    cols = spec['wing_cols']
    pts = []
    for k in range(-4, 5):
        a = math.radians(ang + k * 7)
        r = Ln - abs(k) * 1.2
        pts.append((X + math.cos(a) * r, Y + math.sin(a) * r))
    poly = [(X - 2, Y + 2)] + pts + [(X + 2, Y + 3)]
    im = Image.new('L', (48, 64), 0)
    ImageDraw.Draw(im).polygon(poly, fill=1)
    m = np.array(im) > 0
    w = np.zeros_like(part)
    w[m] = cols[0]
    # 깃 줄: 바깥 끝 두 줄 어두운 색
    for k in (-2, 1, 3):
        a = math.radians(ang + k * 7)
        for t in np.linspace(0.45, 0.95, 8):
            xx, yy = int(X + math.cos(a) * Ln * t), int(Y + math.sin(a) * Ln * t)
            if 0 <= xx < 48 and 0 <= yy < 64 and m[yy, xx]:
                w[yy, xx] = cols[1]
    b = border(w)
    w[b] = ol
    return w


# ---------------------------------------------------------------- 자세
def pose_table(kind):
    """(회전 도, dx, dy). 회전 + 는 왼쪽(얼굴 쪽)이 올라간다. 앞다리 + 는 발이 앞(왼쪽)으로, 뒷다리 - 는 발이 뒤로."""
    Q = {
        'idle_a': dict(),
        'idle_b': dict(body=(0, 0, 1), head=(0, 0, 1), tail=(-6, 0, 1)),
        'idle_c': dict(body=(0, 0, 1), head=(-3, 0, 2), tail=(6, 0, 1)),
        'windup': dict(whole=(-5, 'center', 3, 2), head=(-8, 1, 1), tail=(20, 0, 0),
                       fore=(-14, 0, 0), hind=(14, 0, 0), ground=['fore', 'hind']),
        'move': dict(whole=(-5, 'center', -5, -5), fore=(40, 0, 0), hind=(-36, 0, 0), tail=(-18, 0, 0), head=(4, 0, 0), mouth=1, air=True),
        'attack': dict(whole=(-4, 'center', -8, 0), head=(-4, -1, 1), fore=(34, 0, 0), hind=(-26, 0, 0), tail=(-24, 0, 0), mouth=3, eye='angry'),
        'recover': dict(whole=(2, 'center', -2, 0), head=(4, 0, 0), fore=(-10, 0, 0), hind=(8, 0, 0), tail=(10, 0, 0)),
        'hit': dict(whole=(10, 'center', 4, -1), head=(10, 1, 0), fore=(-20, 0, 0), hind=(16, 0, 0), tail=(28, 0, 0), eye='squint', mouth=1, air=True),
        'dead': dict(dead=True),
        'cast_charge': dict(whole=(-3, 'center', 1, 2), body=(0, 0, 1), head=(-12, 0, 1), tail=(30, 0, 0), fore=(-8, 0, 0), hind=(10, 0, 0),
                            eye='closed', ground=['fore', 'hind']),
        'cast_raise': dict(whole=(18, 'hind', 1, 0), head=(8, 0, 0), fore=(-40, 0, 0), hind=(10, 0, 0), tail=(-18, 0, 0), ground=['hind']),
        'cast_release': dict(whole=(-5, 'center', -5, 0), head=(10, -1, 0), fore=(26, 0, 0), hind=(-20, 0, 0), tail=(-30, 0, 0), mouth=3),
        'leap': dict(whole=(14, 'center', -2, -10), fore=(60, 0, 0), hind=(-50, 0, 0), tail=(-22, 0, 0), head=(-6, 0, 0), air=True),
        'buff': dict(whole=(8, 'hind', 0, 0), head=(20, 0, 0), tail=(-40, 0, 0), fore=(4, 0, 0), hind=(6, 0, 0),
                     mouth=3, eye='closed', ground=['hind'], sparks='buff'),
        'finisher': dict(whole=(-8, 'center', -10, -2), head=(6, -1, 0), fore=(62, -1, 0), hind=(-44, 0, 0), tail=(-30, 0, 0),
                         mouth=3, eye='angry', ghost=True, sparks='buff'),
    }
    if kind == 'bird':
        # 날개 각도: 0 = 뒤(오른쪽) 수평, -90 = 위. 부리 쪽이 왼쪽.
        Q['idle_b'] = dict(body=(0, 0, 1), head=(0, 0, 1), tail=(-4, 0, 1))
        Q['idle_c'] = dict(body=(0, 0, 1), head=(-3, 0, 2), tail=(3, 0, 1))
        Q['windup'] = dict(whole=(8, 'legs', 4, 0), head=(6, 1, 0), tail=(-8, 0, 0), wing=-25, ground=['legs'])
        Q['move'] = dict(whole=(-12, 'center', -5, -6), legs=(-35, 0, 0), tail=(-10, 0, 0), head=(4, 0, 0), wing=-70, air=True)
        Q['attack'] = dict(whole=(-20, 'legs', -3, 0), head=(-8, -2, 1), tail=(-8, 0, 0), eye='angry', ground=['legs'], wing=-15)
        Q['recover'] = dict(whole=(4, 'legs', -2, 0), head=(4, 0, 0), tail=(8, 0, 0), ground=['legs'])
        Q['hit'] = dict(whole=(16, 'center', 4, -2), head=(8, 1, 0), legs=(25, 0, 0), tail=(14, 0, 0), eye='squint', wing=-120, air=True)
        Q['cast_charge'] = dict(whole=(-6, 'legs', 1, 0), head=(-8, 0, 1), tail=(12, 0, 1), eye='closed', ground=['legs'], wing=15)
        Q['cast_raise'] = dict(whole=(16, 'legs', 1, 0), head=(8, 0, -1), tail=(-10, 0, 0), ground=['legs'], wing=-95)
        Q['cast_release'] = dict(whole=(-12, 'legs', -4, 0), head=(-4, -2, 0), tail=(-14, 0, 0), ground=['legs'], wing=-35)
        Q['leap'] = dict(whole=(12, 'center', -2, -12), legs=(-45, 0, 0), tail=(-12, 0, 0), head=(-4, 0, 0), wing=-110, air=True)
        Q['buff'] = dict(whole=(20, 'legs', 0, 0), head=(10, 0, -1), tail=(-18, 0, 0), eye='closed', ground=['legs'], wing=-125, sparks='buff')
        Q['finisher'] = dict(whole=(-16, 'center', -6, -4), head=(4, -2, 0), legs=(-50, 0, 0), tail=(-18, 0, 0), eye='angry', wing=-55, ghost=True, air=True)
    return Q


def compose(spec, name, pose, arts, cell):
    g0, pal, ol, _ = arts[pose.get('base', 1)]
    parts = split_parts(g0, spec)
    if 'head' in parts:
        parts['head'] = head_edit(parts['head'], spec, pose, pal, ol)
    piv = {k: (v[0] * 2 + 1, v[1] * 2 + 1) for k, v in spec['pivot'].items()}
    off = spec['_off']
    H = W = cell
    canvas = np.zeros((H, W), np.int16)
    whole = pose.get('whole', (0, 'center', 0, 0))
    Mw = mat_tr(whole[2], whole[3]) @ mat_rot(whole[0], piv[whole[1]])
    Mw_tr = mat_tr(whole[2], whole[3])
    order = spec.get('order', ['tail', 'hind', 'fore', 'legs', 'body', 'head'])
    if pose.get('dead'):
        return compose_dead(spec, parts, piv, pal, ol, cell)
    for nm in order:
        if nm not in parts:
            continue
        rot, dx, dy = pose.get(nm, (0, 0, 0))
        Ml = mat_tr(dx, dy) @ mat_rot(rot, piv.get(nm, piv['center']))
        Mg = Mw_tr if nm in pose.get('ground', []) else Mw
        if nm in pose.get('ground', []):
            # 땅에 붙은 다리: 몸이 돈 만큼 엉덩이 자리만 따라간다
            hp = piv.get(nm, piv['center'])
            q = Mw @ np.array([hp[0], hp[1], 1.0])
            Mg = mat_tr(q[0] - hp[0], max(0, q[1] - hp[1]) * 0)
        render(canvas, parts[nm], Mg @ Ml, off)
        if nm == 'body' and pose.get('wing') is not None and spec.get('wing_root'):
            w = wing(parts['body'], spec, pose['wing'], pal, ol)
            render(canvas, w, Mw, off)
    canvas = cleanup(canvas, ol)
    if pose.get('ghost'):
        # 잔상: 본체 실루엣을 뒤쪽(오른쪽)으로 밀고 2px 줄마다 비워 속도선처럼 보이게 한다
        out = np.zeros_like(canvas)
        sh = 7
        m = np.zeros(canvas.shape, bool)
        m[:, sh:] = canvas[:, :-sh] > 0
        m[:, canvas.shape[1] - 3:] = False
        rows = (np.arange(canvas.shape[0]) // 2) % 2 == 0
        m &= rows[:, None]
        # 오른쪽 끝 쪽 절반만(몸 뒤로 끌리는 꼬리) 남긴다
        xs = np.nonzero(canvas.any(0))[0]
        if len(xs):
            m[:, : (xs.min() + xs.max()) // 2] = False
        out = np.where(m, spec['ghost_c'], 0).astype(np.int16)
        # 줄 끝 한 칸은 진한 색
        edge = m & ~np.pad(m, ((0, 0), (0, 1)))[:, 1:]
        out[edge] = spec['ghost_o']
        canvas = np.where(canvas > 0, canvas, out)
    return canvas


def compose_dead(spec, parts, piv, pal, ol, cell):
    off = spec['_off']
    canvas = np.zeros((cell, cell), np.int16)
    if spec['kind'] == 'bird':
        # 옆으로 픽 쓰러짐: 몸을 바닥 쪽으로 눌러(세로 0.62) 눕히고, 다리는 뒤로 뻗고, 머리는 바닥에 떨군다
        fy = piv['legs'][1] + 6
        cx = piv['center'][0]
        M = np.array([[1.05, 0, cx - 1.05 * cx], [0, 0.62, fy - 0.62 * fy], [0, 0, 1.0]])
        render(canvas, parts['legs'], mat_tr(4, -3) @ mat_rot(-80, piv['legs']), off)
        render(canvas, parts['tail'], M @ mat_rot(-10, piv['tail']), off)
        render(canvas, parts['body'], M, off)
        hd = head_edit(parts['head'], spec, dict(eye='x'), pal, ol)
        render(canvas, hd, mat_tr(0, 5) @ mat_rot(-24, piv['head']), off)
        return cleanup(canvas, ol)
    L = spec['leg_h'] * 2 - 2
    down = mat_tr(0, L)
    for nm, rot in (('tail', 50), ('hind', -80), ('fore', 80)):
        if nm in parts:
            render(canvas, parts[nm], mat_tr(0, L - 2) @ mat_rot(rot, piv[nm]), off)
    render(canvas, parts['body'], down @ mat_rot(4, piv['center']), off)
    hd = head_edit(parts['head'], spec, dict(eye='x'), pal, ol)
    render(canvas, hd, down @ mat_tr(-2, spec.get('dead_head_dy', 4)) @ mat_rot(spec.get('dead_head_rot', 24), piv['head']), off)
    return cleanup(canvas, ol)


def sparks(g, kind, ol, col, cell):
    """기합 선: 머리 위 세 가닥(칩 팔레트 밝은 색, 2px 두께, 외곽선 1px)."""
    box = bbox(g)
    if not box:
        return g
    x0, y0, x1, y1 = box
    hx = x0 + 6
    top = max(y0 - 3, 6)
    lines = [((hx - 4, top + 4), (hx - 7, top + 1)), ((hx + 2, top), (hx + 2, top - 4)), ((hx + 8, top + 1), (hx + 10, top - 2))]
    sp = np.zeros_like(g)
    for (ax_, ay), (bx, by) in lines:
        n = max(abs(bx - ax_), abs(by - ay))
        for t in range(n + 1):
            x = round(ax_ + (bx - ax_) * t / n)
            y = round(ay + (by - ay) * t / n)
            for xx in (x, x + 1):
                if 2 <= xx < cell - 2 and 2 <= y < cell - 5:
                    sp[y, xx] = col
    grow = np.zeros(sp.shape, bool)
    for nn in n4(sp > 0):
        grow |= nn
    sp = np.where(grow & (sp == 0), ol, sp)
    g = np.where(g > 0, g, sp)
    return g


def bbox(g):
    ys, xs = np.nonzero(g)
    if not len(ys):
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


# ---------------------------------------------------------------- 빌더 1: 시트
def chip_palette(idx):
    """칩 왼쪽 보기 세 칸에 쓰인 색 전부(어두운 것부터)."""
    cols = set()
    for c in (0, 1, 2):
        a = chip_frame(idx, c)
        cols |= {tuple(int(v) for v in p[:3]) for p in a[a[..., 3] > 0]}
    return sorted(cols, key=lum)


def prep(spec):
    """hex 로 적은 색 이름을 팔레트 번호(1-based)로 바꾼다."""
    pal = spec.get('pal') or chip_palette(spec['idx'])
    spec['pal'] = pal

    def n(h):
        if isinstance(h, int):
            return h
        c = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        return pal.index(c) + 1
    for k in ('outline', 'mouthc', 'fangc', 'spark_c', 'ghost_c', 'ghost_o', 'eyehi', 'skin'):
        if k in spec and spec[k] is not None:
            spec[k] = n(spec[k])
    spec['dark'] = [n(h) for h in spec.get('dark', [])]
    if 'wing_cols' in spec:
        spec['wing_cols'] = [n(h) for h in spec['wing_cols']]
    return spec


def build_sheet(chip, spec):
    prep(spec)
    cell = spec['cell']
    arts = {c: base_art(spec, c) for c in (0, 1, 2)}
    g1 = arts[1][0]
    b = bbox(g1)
    # 대기 칸: 가로 중심 cell/2, 발 바닥 y = cell-4
    spec['_off'] = (cell // 2 - (b[0] + b[2] + 1) // 2 + spec.get('xoff', 0), (cell - 4) - b[3])
    pal, ol = arts[1][1], arts[1][2]
    poses = pose_table(spec['kind'])
    for k, v in spec.get('poses', {}).items():
        poses[k] = {**poses[k], **v}
    frames = []
    for nm in NAMES:
        g = compose(spec, nm, poses[nm], arts, cell)
        if poses[nm].get('sparks'):
            g = sparks(g, 'buff', ol, spec['spark_c'], cell)
        # 바닥 맞춤·칸 안으로
        bb = bbox(g)
        dy = 0
        if not poses[nm].get('air'):
            dy = (cell - 4) - bb[3]
        elif bb[3] > cell - 4:
            dy = (cell - 4) - bb[3]
        if bb[1] + dy < 1:
            dy = 1 - bb[1]
        dx = 0
        if bb[0] < 1:
            dx = 1 - bb[0]
        elif bb[2] > cell - 2:
            dx = cell - 2 - bb[2]
        if dx or dy:
            g2 = np.zeros_like(g)
            ys, xs = np.nonzero(g)
            yy, xx = ys + dy, xs + dx
            ok = (yy >= 0) & (yy < cell) & (xx >= 0) & (xx < cell)
            g2[yy[ok], xx[ok]] = g[ys[ok], xs[ok]]
            g = g2
        frames.append(g)
    sheet = np.zeros((cell * 5, cell * 3, 4), np.uint8)
    lut = np.array([(0, 0, 0, 0)] + [tuple(c) + (255,) for c in pal], np.uint8)
    for i, g in enumerate(frames):
        r, c = divmod(i, 3)
        sheet[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] = lut[g]
    im = Image.fromarray(sheet, 'RGBA')
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f'{chip}.png')
    return im


# ---------------------------------------------------------------- 빌더 2: 검사
def check_sheet(chip, cell, flying=False):
    im = Image.open(OUT / f'{chip}.png').convert('RGBA')
    a = np.array(im)
    errs = []
    if im.size != (cell * 3, cell * 5):
        errs.append(f'size {im.size}')
    al = set(np.unique(a[..., 3]).tolist())
    if al - {0, 255}:
        errs.append(f'alpha {al}')
    cols = {tuple(p) for p in a[a[..., 3] > 0][:, :3]}
    if len(cols) > 16:
        errs.append(f'colours {len(cols)}')
    cells = []
    info = {}
    for i, nm in enumerate(NAMES):
        r, c = divmod(i, 3)
        cc = a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
        cells.append(cc.tobytes())
        ys, xs = np.nonzero(cc[..., 3])
        if not len(ys):
            errs.append(f'{nm} empty')
            continue
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        info[nm] = box
        if box[0] < 1 or box[1] < 1 or box[2] > cell - 2 or box[3] > cell - 4:
            errs.append(f'{nm} bbox {box}')
        if nm not in ('move', 'hit', 'leap', 'finisher') and box[3] != cell - 4 and not flying:
            errs.append(f'{nm} floor {box[3]}')
        # 외톨이 픽셀
        op = cc[..., 3] > 0
        cnt = sum(n.astype(int) for n in n4(op))
        lone = int((op & (cnt == 0)).sum())
        if lone:
            errs.append(f'{nm} lone {lone}')
    if len(set(cells)) != 15:
        errs.append(f'distinct {len(set(cells))}/15')
    ib = info.get('idle_a')
    print(f'{chip}: {im.size[0]}x{im.size[1]} cell {cell} colours {len(cols)} idle {ib[2]-ib[0]+1}x{ib[3]-ib[1]+1} distinct {len(set(cells))} floor {ib[3]} ' + ('OK' if not errs else 'FAIL ' + '; '.join(errs)))
    return errs


# ---------------------------------------------------------------- 빌더 3: 칩 확인판
def board_chip(chip, idx, cell, z=4, zs=None):
    """왼쪽: 걷기 칩 4배와 8배(시트 4배와 같은 크기). 오른쪽: 15칸 zs배(기본 48 셀 4배, 64 셀 3배)."""
    src = Image.fromarray(chip_frame(idx, 1), 'RGBA')
    sheet = Image.open(OUT / f'{chip}.png').convert('RGBA')
    pad = 8
    zs = zs or (4 if cell == 48 else 3)
    cw = cell * zs
    left = 24 * zs * 2
    W = left + pad * 2 + 3 * (cw + pad) + pad
    H = max(32 * 4 + 32 * zs * 2 + 40, 5 * (cw + pad)) + pad * 2
    B = Image.new('RGBA', (W, H), BG)
    d = ImageDraw.Draw(B)
    s = Image.new('RGBA', (24, 32), BG)
    s.alpha_composite(src)
    B.paste(s.resize((96, 128), Image.NEAREST), (pad, pad))
    d.text((pad, pad + 132), 'chip x4', fill='#d6cddc')
    B.paste(s.resize((24 * zs * 2, 32 * zs * 2), Image.NEAREST), (pad, pad + 150))
    d.text((pad, pad + 154 + 32 * zs * 2), f'chip x{zs * 2} (= sheet x{zs})', fill='#d6cddc')
    for i, nm in enumerate(NAMES):
        r, c = divmod(i, 3)
        fr = sheet.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell))
        t = Image.new('RGBA', (cell, cell), BG)
        t.alpha_composite(fr)
        x, y = pad * 2 + left + c * (cw + pad), pad + r * (cw + pad)
        B.paste(t.resize((cw, cw), Image.NEAREST), (x, y))
        d.line((x, y + (cell - 3) * zs, x + cw - 1, y + (cell - 3) * zs), fill='#39465e')
        d.rectangle((x, y, x + cw - 1, y + cw - 1), outline='#586078')
        d.text((x + 3, y + 2), nm, fill='#d6cddc')
    QA.mkdir(parents=True, exist_ok=True)
    B.convert('RGB').save(QA / f'board-{chip}.png')
    return B


# ---------------------------------------------------------------- 빌더 4: 크기 비교판
def board_lineup(chips, z=3):
    items = []
    act = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
    items.append(('actor1-0', act))
    for ch, cell in chips:
        sh = Image.open(OUT / f'{ch}.png').convert('RGBA')
        items.append((ch, sh.crop((0, 0, cell, cell))))
    W = sum(im.width * z + 8 for _, im in items) + 8
    H = 64 * z + 30
    B = Image.new('RGBA', (W, H), BG)
    d = ImageDraw.Draw(B)
    x = 8
    base = 64 * z + 8 - 4 * z  # 공통 바닥선: 각 칸의 cell-4 행을 맞춘다
    for nm, im in items:
        t = im.resize((im.width * z, im.height * z), Image.NEAREST)
        y = base - (im.height - 4) * z
        B.alpha_composite(t, (x, y))
        d.text((x, H - 18), nm, fill='#d6cddc')
        x += t.width + 8
    d.line((0, base, W, base), fill='#39465e')
    B.convert('RGB').save(QA / 'lineup.png')
    return B

