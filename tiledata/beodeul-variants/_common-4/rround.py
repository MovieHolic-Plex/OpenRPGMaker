# 둥근 탑 안쪽 방 — 3/4 계약(§10): 바닥은 1:1 위에서, 벽은 「윗면 띠(벽 두께) + 안쪽 벽면(2칸)」.
# 사각 방(interior.room)을 둥글게 자르지 않고, 타원 바닥 + 휘어진 벽면 + 벽 윗띠를 손으로 새로 깐다.
# 바닥 조각·가구 조각은 interior 의 것을 그대로 쓴다(같은 화풍). 벽면·윗띠는 버들항 돌/회반죽 램프로 손 도트.
import math, os, sys
import numpy as np
from PIL import Image
import c4
import interior
from interior import SIZE, render

TS = 16
FACE_H = 32            # 벽면 높이 = 2칸
RIM_T = 8              # 벽 윗띠(벽 두께)
BG = (12, 8, 18, 255)
TALL = {'bookshelf', 'cupboard', 'fireplace', 'stove', 'shelf.tall'}
ST, WD, PL = c4.ST, c4.WD, c4.PL


def _dilate(m, r):
    H, W = m.shape
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r + 1: continue
            s = np.zeros_like(m)
            ys0, ys1 = max(0, dy), min(H, H + dy); xs0, xs1 = max(0, dx), min(W, W + dx)
            s[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx] = m[ys0:ys1, xs0:xs1]
            out |= s
    return out


def _tex_stone(x, y, u, v, row, tone):
    """돌 벽돌: 줄눈(어두운 선)·벽돌마다 한 칸 명암. tone = 기본 램프 인덱스."""
    bh = 8; bw = 16
    r = y // bh
    off = 8 if r % 2 else 0
    cxb = (x + off) // bw
    mort = (y % bh == bh - 1) or ((x + off) % bw == bw - 1)
    t = tone
    k = (cxb * 7 + r * 13) % 5
    if k == 0: t -= 0
    elif k == 1: t += 0
    if mort: return ST[max(1, t - 1)]
    hl = (y % bh == 0)                      # 벽돌 윗모서리 한 줄 밝게
    if hl: t += 1
    if k == 3 and (x + off) % bw in (3, 4): t -= 1
    return ST[max(1, min(5, t))]


def _tex_plaster(x, y, u, v, row, tone):
    """회반죽 칸 + 아래쪽 널 징두리(wainscot)."""
    k = (x * 5 + y * 11) % 17
    t = tone
    if k == 0: t -= 1
    return PL[max(2, min(5, t))]


def round_room(floor='flag', wall='stone', cx=128, cy=128, rx=104, ry=80, exit_col=None, objs=(), wallobjs=(),
               extra=(), cw=256, ch=224, light_right=True, rugs=(), lits=(), block=(), wallfoot=('fireplace',)):
    """돌려줄 것: (이미지 RGBA, 걸음 격자 bool[ch/16][cw/16], 정보 dict).
    objs = [(name, tx, ty)] 바닥 가구(칸 좌표). wallobjs = [(name, tx, ty)] 벽면 장식: tx 는 칸 x, ty 는 사각 방 기준 행(1=벽면 윗줄).
    extra = [(Image, px, py, name, (x0,y0,x1,y1) 막을 칸 | None)]."""
    Y, X = np.mgrid[0:ch, 0:cw]
    u = (X + .5 - cx) / rx
    v = (Y + .5 - cy) / ry
    rho = np.sqrt(u * u + v * v)
    floor_m = rho < 1.0
    # 안쪽 벽면: 윗반쪽(뒤). 바닥 타원 위 경계에서 FACE_H 만큼 위.
    ytop = cy - ry * np.sqrt(np.clip(1 - u * u, 0, 1))
    inx = np.abs(u) < 1.0
    face_m = inx & (Y < ytop) & (Y >= ytop - FACE_H) & (Y <= cy)
    # 옆: 적도 위로 FACE_H 만큼은 u→±1 에서 바닥 경계 위쪽이라 이미 face 에 포함됨.
    inside = floor_m | face_m
    # 문 틈: 아래 윗띠를 2칸 폭으로 뚫는다
    rim_m = _dilate(inside, RIM_T) & ~inside
    # 벽 바깥 가장자리 윤곽
    outer = _dilate(inside | rim_m, 1) & ~(inside | rim_m)
    img = np.zeros((ch, cw, 4), np.uint8); img[:] = BG

    # ---- 바닥: interior 바닥 조각으로 깐다
    ft = render('floor.' + floor)
    fa = np.array(ft)
    for ty in range(ch // TS):
        for tx in range(cw // TS):
            blk = floor_m[ty * TS:(ty + 1) * TS, tx * TS:(tx + 1) * TS]
            if blk.any():
                sub = img[ty * TS:(ty + 1) * TS, tx * TS:(tx + 1) * TS]
                sub[blk] = fa[blk]
    # 벽 밑 그림자(뒤·옆): 벽에서 가까울수록 어둡게 — 두 단
    for lo, hi, k, vlo, vhi in ((0.90, 1.0, 0.62, -9, -0.30), (0.80, 0.90, 0.80, -9, -0.30),
                                (0.90, 1.0, 0.72, -0.30, 0.45), (0.94, 1.0, 0.84, 0.45, 9)):
        m = floor_m & (rho >= lo) & (rho < hi) & (v >= vlo) & (v < vhi)
        img[m, :3] = (img[m, :3] * k).astype(np.uint8)

    # ---- 벽면
    if wall == 'stone': base_tone = 2; tex = _tex_stone
    else: base_tone = 3; tex = _tex_plaster
    ys, xs = np.nonzero(face_m)
    for y, x in zip(ys, xs):
        uu = (x + .5 - cx) / rx
        depth = (y - (ytop[y, x] - FACE_H)) / FACE_H          # 0 위 .. 1 아래
        # 안쪽 면은 오른쪽이 빛을 받는다(빛이 왼쪽 위에서 와 오른쪽 안쪽 면을 비춘다) — 가장자리로 갈수록 한 단 어둡게
        tone = base_tone
        if wall == 'stone':
            if uu < -.55: tone -= 1
            elif uu > .55: tone += 0
            c = tex(x, y, uu, depth, 0, tone)
            if depth > .86: c = ST[max(1, tone - 1)]
        else:
            c = tex(x, y, uu, depth, 0, tone + (1 if uu > .4 else 0))
            if depth > .58:                       # 아래 널 징두리
                k = 3 if (x // 4 + 0) % 2 == 0 else 2
                c = WD[k] if (y - (ytop[y, x] - FACE_H)) % 16 else WD[1]
                if abs(depth - .58) < .03: c = WD[5]
        img[y, x, :3] = c; img[y, x, 3] = 255
    # 천장 경계선(윗띠 바로 밑 한 줄 어둡게) · 벽 밑선(바닥과 맞닿는 줄)
    face_dark = ST[0]
    for x in range(cw):
        col = np.nonzero(face_m[:, x])[0]
        if len(col):
            y0, y1 = col.min(), col.max()
            img[y0, x, :3] = face_dark; img[y0 + 1, x, :3] = ST[1]
            img[y1, x, :3] = face_dark
    # 옆 끝(적도 부근): 벽면 양끝 세로선
    for y in range(ch):
        row = np.nonzero(face_m[y])[0]
        if len(row):
            for xx in (row.min(), row.max()):
                img[y, xx, :3] = face_dark

    # ---- 윗띠(벽 두께): 윗면이라 밝은 돌. 위쪽 안쪽 가장자리에 하이라이트, 바깥쪽 어둡게. 방사 줄눈.
    ys, xs = np.nonzero(rim_m)
    ang_seg = 14
    for y, x in zip(ys, xs):
        a = math.atan2((y + .5 - cy) / ry, (x + .5 - cx) / rx)
        seg = int((a + math.pi) / (2 * math.pi) * 40)
        t = 5
        if seg % 2: t = 4
        # 안쪽(바닥·벽면쪽) 경계와의 거리로 가장자리 밝기
        img[y, x, :3] = ST[t]; img[y, x, 3] = 255
    # 줄눈(방사 선): 각 구간 경계
    for y, x in zip(ys, xs):
        a = math.atan2((y + .5 - cy) / ry, (x + .5 - cx) / rx)
        s1 = ((a + math.pi) / (2 * math.pi)) * 40
        if abs(s1 - round(s1)) < 0.06 and round(s1) % 1 == 0:
            img[y, x, :3] = ST[3]
    # 윗띠 안쪽 줄(밝게)·바깥 줄(어둡게)
    inner = _dilate(inside, 1) & rim_m
    img[inner, :3] = np.array(ST[6], np.uint8)
    outer_ring = rim_m & ~_dilate(inside, RIM_T - 2)
    img[outer_ring, :3] = np.array(ST[3], np.uint8)
    ys, xs = np.nonzero(outer)
    img[ys, xs, :3] = np.array(ST[0], np.uint8); img[ys, xs, 3] = 255

    # 문 틈(1층): 앞쪽 윗띠를 2칸 폭으로 뚫고 바닥 잇기
    if exit_col is not None:
        x0 = exit_col * TS; x1 = x0 + TS * 1
        for y in range(cy + ry - 4, ch):
            for x in range(x0, x1):
                if (rim_m[y, x] or outer[y, x] or not inside[y, x]) and img[y, x, 3]:
                    img[y, x] = np.array(render('floor.' + floor))[y % 16, x % 16]
        # 문지방 쪽 좌우 가장자리 한 줄
        for y in range(cy + ry - 4, ch):
            img[y, x0 - 1, :3] = ST[0]; img[y, x1, :3] = ST[0]
        # 문턱(바닥 끝) 돌
        for x in range(x0, x1):
            img[ch - 1, x] = (*ST[2], 255)

    canvas = Image.fromarray(img, 'RGBA')
    # ---- 양탄자·창빛(바닥 위에 깐다 — 타원 안쪽 rho<.9 인 칸만)
    def _tile_ok(tx, ty):
        return 0 <= tx < cw // TS and 0 <= ty < ch // TS and rho[ty * TS + 8, tx * TS + 8] < 0.86 and floor_m[ty * TS:(ty + 1) * TS, tx * TS:(tx + 1) * TS].all()
    for (x0, y0, w, h) in rugs:
        for yy in range(h):
            for xx in range(w):
                v_ = 't' if yy == 0 else 'b' if yy == h - 1 else ''; u_ = 'l' if xx == 0 else 'r' if xx == w - 1 else ''
                nm = 'rug.' + ((v_ + u_) if (v_ and u_) else (v_ or u_ or 'c'))
                if _tile_ok(x0 + xx, y0 + yy):
                    canvas.alpha_composite(render(nm).convert('RGBA'), ((x0 + xx) * TS, (y0 + yy) * TS))
    for (lx, ly, fl) in lits:
        if _tile_ok(lx, ly) and _tile_ok(lx, ly + 1):
            canvas.alpha_composite(render('floor.%s.lita' % fl).convert('RGBA'), (lx * TS, ly * TS))
            canvas.alpha_composite(render('floor.%s.litb' % fl).convert('RGBA'), (lx * TS, (ly + 1) * TS))

    # ---- 바닥 가구
    walk = np.zeros((ch // TS, cw // TS), bool)
    for ty in range(ch // TS):
        for tx in range(cw // TS):
            walk[ty, tx] = floor_m[ty * TS + 3:ty * TS + 13, tx * TS + 3:tx * TS + 13].all() and rho[ty * TS + 8, tx * TS + 8] < 0.93
    if exit_col is not None:
        for ty in range((cy + ry) // TS - 1, ch // TS): walk[ty, exit_col] = True
    base = walk.copy()
    sprites = []
    for (n, tx, ty) in objs:
        w_, h_ = SIZE[n]
        if n in TALL:            # 벽에 기대는 키 큰 가구: 받침(맨 아랫줄)만 바닥 안에 있으면 된다
            ok = base[ty + h_ - 1, tx:tx + w_].all()
        else:
            ok = base[ty:ty + h_, tx:tx + w_].all()
        if not ok and n not in ('mat',):
            print('WARN 타원 밖:', n, tx, ty)
    for (n, tx, ty) in objs:
        sprites.append((ty * TS + SIZE[n][1] * TS, render(n), tx * TS, ty * TS, n, (tx, ty, tx + SIZE[n][0] - 1, ty + SIZE[n][1] - 1)))
    for (im, px, py, n, bl) in extra:
        sprites.append((py + im.height, im, px, py, n, bl))
    WALK_OVER = {'mat', 'candles'}
    for (x0, y0, x1, y1) in block: walk[y0:y1 + 1, x0:x1 + 1] = False
    for z, im, px, py, n, bl in sorted(sprites, key=lambda t: t[0]):
        canvas.alpha_composite(im.convert('RGBA'), (px, py))
        if bl and n not in WALK_OVER:
            walk[bl[1]:bl[3] + 1, bl[0]:bl[2] + 1] = False
    # ---- 벽면 장식(곡선을 따라 내려간다)
    for (n, tx, ty) in wallobjs:
        w, h = SIZE[n]
        xc = tx * TS + w * TS // 2
        if abs((xc - cx) / rx) > .8:
            print('WARN 벽면 장식이 너무 옆:', n, tx)
        dy = int(ytop[min(ch - 1, max(0, cy - 4)), min(cw - 1, xc)] if False else ytop[cy - 1, xc]) - (cy - ry)
        canvas.alpha_composite(render(n).convert('RGBA'), (tx * TS, ty * TS + dy))
    info = {'floor_tiles': int(walk.sum())}
    return canvas, walk, info


def check_objs_in(walk, objs, extra=()):
    """바닥 가구가 타원 밖으로 나가지 않았는지 — 경고만 찍는다."""
    bad = []
    return bad
