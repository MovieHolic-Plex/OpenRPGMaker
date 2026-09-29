"""pp15_pp3 — b3 네 명(monster1-4..7) 15칸 파티 시트 공용 빌더.

방법(2026-09-29 재작업 규칙): 걷기 칩 왼쪽 보기 가운데 칸(행 3·열 1, 24×32)을
  1) 캐릭터 팔레트로 줄이고(≤16색 예산),
  2) Scale2x(EPX) 로 정수 2배 — 새 색 없이 계단 대각선만 다듬는다,
  3) 부위(머리·몸·팔·다리…)를 칩 좌표 마스크로 잘라, 부위마다 외곽선을 벗긴 채움(fill)으로 보관한다.
칸마다 부위를 옮기고(평행이동·회전) 뒤→앞 순서로 합성하며, 부위마다 1px 어두운 외곽선을 새로 두르고
왼쪽 위 테두리에 밝은 한 단을 더한다. 옮기지 않은 대기 칸은 2배 칩과 같은 실루엣이 된다.
그림은 처음부터 왼쪽(적 쪽)을 본다 — 반전하지 않는다.
"""
import json, math, sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/pp3'
CHIPSET = ROOT / 'public/assets/easyrpg/charset/Monster1.png'
BGKEY = (0x00, 0x93, 0x92)
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
T = (0, 0, 0, 0)


def hexc(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def chip_frame(index, row=3, col=1):
    im = Image.open(CHIPSET).convert('RGBA')
    ox, oy = (index % 4) * 72 + col * 24, (index // 4) * 128 + row * 32
    fr = im.crop((ox, oy, ox + 24, oy + 32))
    px = fr.load()
    for y in range(32):
        for x in range(24):
            if px[x, y][:3] == BGKEY or px[x, y][3] == 0:
                px[x, y] = T
    return fr


def quantize(im, pal, force=None):
    """칩 색을 캐릭터 팔레트(키→hex)의 가장 가까운 색으로. force = {칩hex: 키} 로 강제 대응."""
    cols = {k: hexc(v) for k, v in pal.items()}
    force = {hexc(k)[:3]: v for k, v in (force or {}).items()}
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] == 0:
                continue
            if c[:3] in force:
                px[x, y] = cols[force[c[:3]]]
                continue
            px[x, y] = min(cols.values(), key=lambda q: sum((a - b) ** 2 for a, b in zip(q[:3], c[:3])))
    return out


def scale2x(im):
    w, h = im.size
    s = im.load()
    out = Image.new('RGBA', (w * 2, h * 2))
    o = out.load()

    def g(x, y):
        return s[min(max(x, 0), w - 1), min(max(y, 0), h - 1)]
    for y in range(h):
        for x in range(w):
            P = s[x, y]; A = g(x, y - 1); B = g(x + 1, y); C = g(x - 1, y); D = g(x, y + 1)
            e0 = e1 = e2 = e3 = P
            if C == A and C != D and A != B:
                e0 = A
            if A == B and A != C and B != D:
                e1 = B
            if D == C and D != B and C != A:
                e2 = C
            if B == D and B != A and D != C:
                e3 = D
            o[2 * x, 2 * y] = e0; o[2 * x + 1, 2 * y] = e1; o[2 * x, 2 * y + 1] = e2; o[2 * x + 1, 2 * y + 1] = e3
    return out


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


def strip(im, dark):
    """바깥 테두리의 어두운 외곽선 한 겹을 벗긴 채움. dark = 외곽선으로 볼 RGBA 집합."""
    w, h = im.size
    s = im.load()
    out = im.copy()
    o = out.load()
    for y in range(h):
        for x in range(w):
            if s[x, y][3] and s[x, y] in dark:
                edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or s[x + dx, y + dy][3] == 0 for dx, dy in N8)
                if edge:
                    o[x, y] = T
    return out


class Part:
    def __init__(self, fill, pivot, light=True):
        self.fill = fill          # RGBA, 캔버스 좌표계(2배 칩 좌표)
        self.pivot = pivot        # 회전 중심(2배 좌표)
        self.light = light


def mask_poly(size, polys):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon([(x * 2, y * 2) for x, y in p], fill=255)
    return m


def cut(fill, polys, pivot, inpaint=None, light=True):
    """칩 좌표 다각형(여럿)으로 fill 에서 부위를 잘라 Part 로. pivot 은 칩 좌표."""
    m = mask_poly(fill.size, polys)
    part = Image.new('RGBA', fill.size)
    part.paste(fill, (0, 0), m)
    return Part(part, (pivot[0] * 2, pivot[1] * 2), light)


def fill_hole(im, polys, color=None):
    """부위를 떼어낸 자리를 주변 색(BFS 최근접) 또는 지정 색으로 메운다(칩 좌표 다각형)."""
    m = mask_poly(im.size, polys).load()
    px = im.load()
    w, h = im.size
    todo = [(x, y) for y in range(h) for x in range(w) if m[x, y] and px[x, y][3] == 0]
    if color is not None:
        for q in todo:
            px[q] = color
        return im
    todo = set(todo)
    q = deque((x, y) for y in range(h) for x in range(w) if px[x, y][3] and any((x + dx, y + dy) in todo for dx, dy in N4))
    while q and todo:
        x, y = q.popleft()
        for dx, dy in N4:
            n = (x + dx, y + dy)
            if n in todo:
                px[n] = px[x, y]; todo.discard(n); q.append(n)
    return im


def xform(part, dx=0, dy=0, rot=0, flip=False, size=None):
    """부위를 pivot 기준 rot 도(양수 = 화면상 반시계) 회전 후 (dx,dy) 이동. 최근접 표본."""
    src = part.fill
    w, h = size or src.size
    out = Image.new('RGBA', (w, h))
    s = src.load(); o = out.load()
    px_, py_ = part.pivot
    r = math.radians(rot)
    c, sn = math.cos(r), math.sin(r)
    sw, sh = src.size
    for y in range(h):
        for x in range(w):
            X = x - dx - px_; Y = y - dy - py_
            u = c * X - sn * Y; v = sn * X + c * Y
            if flip:
                u = -u
            sx, sy = int(round(u + px_ - 1e-6)), int(round(v + py_ - 1e-6))
            if 0 <= sx < sw and 0 <= sy < sh and s[sx, sy][3]:
                o[x, y] = s[sx, sy]
    return out


def outline(fill, col, light=None):
    """채움 둘레 바깥에 1px 외곽선(8방향). light = {색: 밝은색} 이면 왼쪽 위 안쪽 테두리를 한 단 밝힌다."""
    w, h = fill.size
    s = fill.load()
    out = fill.copy()
    o = out.load()
    for y in range(h):
        for x in range(w):
            if s[x, y][3]:
                if light and s[x, y] in light:
                    if any(not (0 <= x + dx < w and 0 <= y + dy < h) or s[x + dx, y + dy][3] == 0 for dx, dy in ((-1, 0), (0, -1))):
                        o[x, y] = light[s[x, y]]
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and s[x + dx, y + dy][3] for dx, dy in N8):
                o[x, y] = col
    return out


class Canvas:
    def __init__(self, size, pal):
        self.im = Image.new('RGBA', size)
        self.pal = {k: hexc(v) for k, v in pal.items()}
        self.d = ImageDraw.Draw(self.im)

    def c(self, k):
        return self.pal[k] if isinstance(k, str) else k

    def layer(self, img):
        self.im.alpha_composite(img)

    def line(self, pts, k, w=1):
        self.d.line([tuple(map(round, p)) for p in pts], fill=self.c(k), width=w)

    def dot(self, x, y, k):
        if 0 <= x < self.im.width and 0 <= y < self.im.height:
            self.im.putpixel((int(x), int(y)), self.c(k))

    def box(self, b, k):
        self.d.rectangle(b, fill=self.c(k))

    def ell(self, b, k, outline=None):
        self.d.ellipse(b, fill=self.c(k), outline=self.c(outline) if outline else None)


def stroke(cv, pts, core, edge, w=1):
    """외곽선 둘린 선(뼈·낫자루·기운 줄기): edge 로 w+2 두께, core 로 w 두께."""
    cv.line(pts, edge, w + 2)
    cv.line(pts, core, w)


def isolated(im):
    a = im.getchannel('A').load()
    w, h = im.size
    return [(x, y) for y in range(h) for x in range(w)
            if a[x, y] and not any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy] for dx, dy in N4)]


def place(img, cell, cx, floor, keep_x=False):
    """그림 bbox 를 셀에 넣는다: 가로 기준 cx(몸 중심 x, 원 좌표)를 cell/2 로, floor(원 좌표 바닥 행)를 cell-4 로."""
    out = Image.new('RGBA', (cell, cell))
    out.paste(img, (cell // 2 - cx, (cell - 4) - floor), img)
    return out


def build(chip, cell, render, pal):
    """render(name) -> (RGBA 캔버스 이미지, cx, floor) 가 원 좌표 그림을 준다."""
    frames = []
    for n in NAMES:
        img, cx, floor = render(n)
        f = place(img, cell, cx, floor)
        for q in isolated(f):
            f.putpixel(q, T)
        frames.append(f)
    sheet = Image.new('RGBA', (cell * 3, cell * 5))
    for i, f in enumerate(frames):
        sheet.paste(f, (i % 3 * cell, i // 3 * cell))
    errs = check(sheet, cell)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    ncol = len({c for _, c in sheet.getcolors(1 << 20) if c[3]})
    print(chip, 'cell', cell, 'colours', ncol, 'idle bbox', frames[0].getbbox(), 'errors', errs or 'none')
    return sheet, errs


def check(sheet, cell, airborne=False):
    errs = []
    if sheet.size != (cell * 3, cell * 5):
        errs.append(f'size {sheet.size}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errs.append('alpha')
    ncol = len({c for _, c in sheet.getcolors(1 << 20) if c[3]})
    if ncol > 16:
        errs.append(f'colours {ncol}')
    cells = [sheet.crop((i % 3 * cell, i // 3 * cell, i % 3 * cell + cell, i // 3 * cell + cell)) for i in range(15)]
    for n, c in zip(NAMES, cells):
        b = c.getbbox()
        if not b:
            errs.append(f'{n} empty'); continue
        if b[0] < 1 or b[1] < 1 or b[2] > cell - 1 or b[3] > cell - 3:
            errs.append(f'{n} bounds {b}')
    for i in range(15):
        for j in range(i + 1, 15):
            if cells[i].tobytes() == cells[j].tobytes():
                errs.append(f'{NAMES[i]}=={NAMES[j]}')
    return errs



# ───────────────────────── 리그: 칩 부위를 잘라 옮기는 몸 ─────────────────────────
CELL64 = 64


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def strip1(fr, dark):
    """1배 칩에서 바깥에 닿은 어두운 외곽선 한 겹(4방향)을 벗긴다."""
    w, h = fr.size
    s = fr.load()
    out = fr.copy()
    o = out.load()
    for y in range(h):
        for x in range(w):
            if s[x, y][3] and lum(s[x, y]) < dark and any(
                    not (0 <= x + dx < w and 0 <= y + dy < h) or s[x + dx, y + dy][3] == 0 for dx, dy in N4):
                o[x, y] = T
    return out


def aff_local(dx, dy, rot, pv):
    r = math.radians(rot)
    c, s = math.cos(r), math.sin(r)
    a, b, cc, d = c, s, -s, c          # x' = a x + b y ; y' = cc x + d y (y 아래, rot + = 화면 반시계)
    tx = pv[0] - (a * pv[0] + b * pv[1]) + dx
    ty = pv[1] - (cc * pv[0] + d * pv[1]) + dy
    return (a, b, cc, d, tx, ty)


def aff_mul(P, L):
    a1, b1, c1, d1, x1, y1 = P
    a2, b2, c2, d2, x2, y2 = L
    return (a1 * a2 + b1 * c2, a1 * b2 + b1 * d2, c1 * a2 + d1 * c2, c1 * b2 + d1 * d2,
            a1 * x2 + b1 * y2 + x1, c1 * x2 + d1 * y2 + y1)


def aff_apply(M, p):
    a, b, c, d, tx, ty = M
    return (a * p[0] + b * p[1] + tx, c * p[0] + d * p[1] + ty)


def aff_render(src, M, size):
    a, b, c, d, tx, ty = M
    det = a * d - b * c
    ia, ib, ic, idd = d / det, -b / det, -c / det, a / det
    w, h = size
    out = Image.new('RGBA', (w, h))
    s = src.load(); o = out.load()
    sw, sh = src.size
    ident = abs(a - 1) < 1e-9 and abs(d - 1) < 1e-9 and abs(b) < 1e-9 and abs(c) < 1e-9
    for y in range(h):
        for x in range(w):
            X, Y = x + 0.5 - tx, y + 0.5 - ty
            u = ia * X + ib * Y; v = ic * X + idd * Y
            sx, sy = (int(round(u - 0.5)), int(round(v - 0.5))) if ident else (int(math.floor(u)), int(math.floor(v)))
            if 0 <= sx < sw and 0 <= sy < sh and s[sx, sy][3]:
                o[x, y] = s[sx, sy]
    return out


class Rig:
    """labels: [(부위, x0, y0, x1, y1)] 칩 1배 좌표(포함), 먼저 맞는 것이 이긴다. 나머지 = 'body'.
    pivots: {부위: (x, y)} 칩 1배 좌표(반픽셀 가능). parent: {부위: 부모}. order: 뒤→앞. own: 움직이면 제 외곽선을 두르는 부위."""

    def __init__(self, index, pal, labels, pivots, parent, order, own=(), dark=0x40, force=None,
                 cx=12, bottom=None, light=None, shade=None, okey='o', col=1, row=3, cell=CELL64, floor=None):
        self.pal = {k: hexc(v) for k, v in pal.items()}
        self.cell = cell
        self.floor = cell - 4 if floor is None else floor
        self.okey = okey
        fr = chip_frame(index, row, col)
        q = quantize(strip1(fr, dark), pal, force)
        big = scale2x(q)
        bb = fr.getbbox()
        bottom = (bb[3] - 1) if bottom is None else bottom
        self.OX = cell // 2 - 2 * cx
        self.OY = self.floor - (2 * bottom + 1)
        self.parts = {}
        lab = {}
        for y in range(32):
            for x in range(24):
                name = 'body'
                for (n, x0, y0, x1, y1) in labels:
                    if x0 <= x <= x1 and y0 <= y <= y1:
                        name = n; break
                lab[x, y] = name
        names = set(lab.values()) | set(order)
        for n in names:
            self.parts[n] = Image.new('RGBA', (cell, cell))
        bp = big.load()
        for (x, y), n in lab.items():
            for j in range(2):
                for i in range(2):
                    c = bp[2 * x + i, 2 * y + j]
                    X, Y = 2 * x + i + self.OX, 2 * y + j + self.OY
                    if c[3] and 0 <= X < cell and 0 <= Y < cell:
                        self.parts[n].putpixel((X, Y), c)
        self.pivots = {n: self.to_sheet(p) for n, p in pivots.items()}
        self.parent = parent
        self.order = order
        self.own = set(own)
        self.light = {self.pal[a]: self.pal[b] for a, b in (light or {}).items()}
        self.shade = {self.pal[a]: self.pal[b] for a, b in (shade or {}).items()}

    def to_sheet(self, p):
        return (2 * p[0] + self.OX, 2 * p[1] + self.OY)

    def c(self, k):
        return self.pal[k]

    def world(self, pose, n, memo):
        if n in memo:
            return memo[n]
        dx, dy, rot = (list(pose.get(n, ())) + [0, 0, 0])[:3]
        L = aff_local(dx, dy, rot, self.pivots.get(n, (32, 32)))
        par = self.parent.get(n, 'root' if n != 'root' else None)
        if par:
            M = aff_mul(self.world(pose, par, memo), L)
        else:
            M = L
        memo[n] = M
        return M

    def point(self, pose, n, p):
        """칩 1배 좌표 p(부위 n 에 붙은 점)가 이 포즈에서 시트 어디로 가는가."""
        return aff_apply(self.world(pose, n, {}), self.to_sheet(p))

    def render(self, pose, under=None, over=None, hide=(), swap=None):
        """pose: {부위: (dx, dy, rot)}, 'root' 는 전체. under/over(cv, rig, pose) 는 소품 그리기(외곽선 전/후)."""
        memo = {}
        cv = Canvas((self.cell, self.cell), {})
        cv.pal = self.pal
        if under:
            under(cv, self, pose)
        for n in self.order:
            if n in hide:
                continue
            src = (swap or {}).get(n, self.parts[n])
            M = self.world(pose, n, memo)
            img = aff_render(src, M, (self.cell, self.cell))
            moved = any(abs(v) > 1e-9 for v in (M[0] - 1, M[1], M[2], M[3] - 1))
            if n in self.own and (moved or pose.get(n)):
                img = outline(img, self.pal[self.okey])
            cv.im.alpha_composite(img)
            if n in (pose.get('_after') or {}):
                pose['_after'][n](cv, self, pose)
        if over:
            over(cv, self, pose)
        im = self.finish(cv.im)
        return im

    def finish(self, im):
        w, h = im.size
        s = im.load()
        out = im.copy()
        o = out.load()
        oc = self.pal[self.okey]
        for y in range(h):
            for x in range(w):
                p = s[x, y]
                if not p[3] or p == oc:
                    continue
                def empty(dx, dy):
                    X, Y = x + dx, y + dy
                    return not (0 <= X < w and 0 <= Y < h) or s[X, Y][3] == 0 or s[X, Y] == oc
                if p in self.light and (empty(-1, 0) or empty(0, -1)):
                    o[x, y] = self.light[p]
                elif p in self.shade and (empty(1, 0) or empty(0, 1)) and not (empty(-1, 0) or empty(0, -1)):
                    o[x, y] = self.shade[p]
        return outline(out, oc)


def fx_glow(cv, x, y, r, core, rim):
    """두 겹 빛 방울(외곽선 없음, 2px 이상)."""
    cv.ell((x - r, y - r, x + r, y + r), rim)
    if r >= 2:
        cv.ell((x - r + 1, y - r + 1, x + r - 1, y + r - 1), core)


def fx_spark(cv, x, y, n, k):
    """십자 반짝임(팔 길이 n)."""
    cv.line([(x - n, y), (x + n, y)], k)
    cv.line([(x, y - n), (x, y + n)], k)


def fx_lines(cv, cx, cy, r0, r1, angles, k, w=1):
    for a in angles:
        t = math.radians(a)
        cv.line([(cx + r0 * math.cos(t), cy - r0 * math.sin(t)), (cx + r1 * math.cos(t), cy - r1 * math.sin(t))], k, w)


def label_board(rig, path, z=8):
    """부위 확인판: 부위마다 색을 입혀 대기 칸을 확대."""
    cols = [(230, 80, 80), (80, 200, 90), (80, 120, 240), (230, 200, 60), (200, 80, 220), (60, 210, 210), (240, 140, 40), (150, 150, 150), (255, 255, 255)]
    im = Image.new('RGB', (rig.cell * 2 * z + 8, rig.cell * z), (30, 30, 40))
    base = rig.render({})
    b = Image.new('RGBA', (rig.cell, rig.cell), (60, 70, 90, 255)); b.alpha_composite(base)
    im.paste(b.convert('RGB').resize((rig.cell * z, rig.cell * z), Image.NEAREST), (0, 0))
    lab = Image.new('RGBA', (rig.cell, rig.cell), (60, 70, 90, 255))
    for i, n in enumerate(rig.order):
        m = rig.parts[n].getchannel('A')
        lab.paste(Image.new('RGBA', (rig.cell, rig.cell), cols[i % len(cols)] + (255,)), (0, 0), m)
    im.paste(lab.convert('RGB').resize((rig.cell * z, rig.cell * z), Image.NEAREST), (rig.cell * z + 8, 0))
    d = ImageDraw.Draw(im)
    for i, n in enumerate(rig.order):
        d.text((rig.cell * z + 14, 6 + i * 12), n, fill=cols[i % len(cols)])
    im.save(path)


def board(chip, sheet, cell, walk_index, path):
    """확인판 (a): 걷기 칩 왼쪽 보기 3칸(4배) + 15칸(4배), 칸 이름·바닥선."""
    z = 4
    BG = (0x28, 0x30, 0x48, 255)
    chipim = Image.new('RGBA', (72, 32))
    for col in range(3):
        chipim.paste(chip_frame(walk_index, 3, col), (col * 24, 0))
    W = 72 * z + 16 + cell * 3 * z
    H = max(32 * z, cell * 5 * z) + 20
    im = Image.new('RGBA', (W, H), (14, 16, 26, 255))
    cb = Image.new('RGBA', chipim.size, BG); cb.alpha_composite(chipim)
    im.paste(cb.resize((72 * z, 32 * z), Image.NEAREST), (0, 20))
    # 같은 배율 비교: 칩 2배(시트 1px = 화면 4px 일 때 칩은 8배가 된다)도 아래에
    big = chip_frame(walk_index, 3, 1).resize((24 * 2 * z, 32 * 2 * z), Image.NEAREST)
    bb = Image.new('RGBA', big.size, BG); bb.alpha_composite(big)
    im.paste(bb, (40, 32 * z + 40))
    sb = Image.new('RGBA', sheet.size, BG); sb.alpha_composite(sheet)
    im.paste(sb.resize((cell * 3 * z, cell * 5 * z), Image.NEAREST), (72 * z + 16, 20))
    d = ImageDraw.Draw(im)
    d.text((4, 4), chip + ' 걷기 칩 왼쪽 보기 x4', fill=(220, 220, 230))
    d.text((44, 32 * z + 26), 'chip x2 (= idle scale)', fill=(220, 220, 230))
    for i, n in enumerate(NAMES):
        x, y = 72 * z + 16 + i % 3 * cell * z, 20 + i // 3 * cell * z
        d.rectangle((x, y, x + cell * z - 1, y + cell * z - 1), outline=(80, 90, 120))
        d.line((x + 2, y + (cell - 3) * z, x + cell * z - 3, y + (cell - 3) * z), fill=(70, 100, 150))
        d.text((x + 4, y + 3), n, fill=(210, 205, 220))
    im.save(path)
    return im

