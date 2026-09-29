"""pp15_pp3 — b3 네 명(monster1-4 해골병 · 1-5 좀비 · 1-6 사신 · 1-7 수인 전사) 15칸 파티 시트 공용 리그.

방법(2026-09-29 재작업 규칙, 감독 지시):
  1) 걷기 칩 왼쪽 보기 가운데 칸(Monster1.png 칩 i 블록의 행 3·열 1, 24×32)을 캐릭터 팔레트(≤16색)로 줄이고
     바깥 어두운 외곽선 한 겹을 벗긴다.
  2) Scale2x(EPX)로 정수 2배 — 새 색 없이 계단 대각선만 다듬는다. 이것이 대기 칸의 몸이다(칩 × 2, 더 키우지 않는다).
  3) 칩 좌표 사각형으로 부위(머리·팔·다리…)를 나누고, 칸마다 부위를 관절 기준으로 옮기거나 돌린다.
     돌릴 때는 부위를 Scale2x 로 8배 더 키운 뒤 표본을 뽑아(RotSprite 식) 계단이 덜 깨지게 한다.
  4) 합성 뒤 왼쪽 위 테두리에 밝은 한 단, 오른쪽 아래 안쪽에 그늘 한 단을 얹고 1px 외곽선을 새로 두른다.
그림은 처음부터 왼쪽(적 쪽)을 본다 — 반전하지 않는다. 행 순서는 NAMES(15칸, 3열×5행).
"""
import json, math
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
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


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


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def quantize(im, pal, force=None):
    cols = {k: hexc(v) for k, v in pal.items()}
    force = {hexc(k)[:3]: v for k, v in (force or {}).items()}
    out = im.copy(); px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] == 0:
                continue
            if c[:3] in force:
                px[x, y] = cols[force[c[:3]]]; continue
            px[x, y] = min(cols.values(), key=lambda q: sum((a - b) ** 2 for a, b in zip(q[:3], c[:3])))
    return out


def strip_edge(im, dark):
    """바깥(투명)에 4방향으로 닿은 어두운 픽셀 한 겹을 벗긴다."""
    w, h = im.size
    s = im.load(); out = im.copy(); o = out.load()
    for y in range(h):
        for x in range(w):
            if s[x, y][3] and lum(s[x, y]) < dark and any(
                    not (0 <= x + dx < w and 0 <= y + dy < h) or s[x + dx, y + dy][3] == 0 for dx, dy in N4):
                o[x, y] = T
    return out


def scale2x(im):
    w, h = im.size
    s = im.load()
    out = Image.new('RGBA', (w * 2, h * 2)); o = out.load()

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


def outline(fill, col):
    w, h = fill.size
    s = fill.load(); out = fill.copy(); o = out.load()
    for y in range(h):
        for x in range(w):
            if not s[x, y][3] and any(0 <= x + dx < w and 0 <= y + dy < h and s[x + dx, y + dy][3] for dx, dy in N8):
                o[x, y] = col
    return out


# ── 아핀(부위 좌표 = 2배 칩 좌표, y 아래). rot 양수 = 화면에서 반시계. 왼쪽을 보므로 앞 = −x. ──
def aff_local(dx, dy, rot, pv, lean=0.0):
    """pv 기준 lean(가로 기울임: 위로 1px 갈 때 앞(−x)으로 lean px) → rot 회전 → (dx, dy) 이동."""
    r = math.radians(rot)
    c, s = math.cos(r), math.sin(r)
    # 기울임 S: x' = x + lean*(y - py)  (위쪽 y<py 가 −x 로)
    S = (1, lean, 0, 1, -lean * pv[1], 0)
    R = (c, s, -s, c, pv[0] - (c * pv[0] + s * pv[1]), pv[1] - (-s * pv[0] + c * pv[1]))
    M = aff_mul(R, S)
    return (M[0], M[1], M[2], M[3], M[4] + dx, M[5] + dy)


def aff_mul(P, L):
    a1, b1, c1, d1, x1, y1 = P
    a2, b2, c2, d2, x2, y2 = L
    return (a1 * a2 + b1 * c2, a1 * b2 + b1 * d2, c1 * a2 + d1 * c2, c1 * b2 + d1 * d2,
            a1 * x2 + b1 * y2 + x1, c1 * x2 + d1 * y2 + y1)


def aff_apply(M, p):
    a, b, c, d, tx, ty = M
    return (a * p[0] + b * p[1] + tx, c * p[0] + d * p[1] + ty)


def is_shift(M):
    """1배 표본으로 충분한 변환: 이동·가로 기울임(행이 통째로 밀림)·90° 배수 회전."""
    a, b, c, d = M[:4]
    if abs(a - 1) < 1e-9 and abs(d - 1) < 1e-9 and abs(c) < 1e-9:
        return True
    return all(min(abs(v), abs(abs(v) - 1)) < 1e-9 for v in (a, b, c, d))


class Canvas:
    def __init__(self, im, pal):
        self.im = im
        self.pal = pal
        self.d = ImageDraw.Draw(im)

    def c(self, k):
        return self.pal[k] if isinstance(k, str) else k

    def line(self, pts, k, w=1):
        self.d.line([(round(x), round(y)) for x, y in pts], fill=self.c(k), width=w)

    def dot(self, x, y, k):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.im.width and 0 <= y < self.im.height:
            self.im.putpixel((x, y), self.c(k))

    def box(self, b, k):
        self.d.rectangle([round(v) for v in b], fill=self.c(k))

    def ell(self, cx, cy, rx, ry, k):
        self.d.ellipse((round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)), fill=self.c(k))

    def poly(self, pts, k):
        self.d.polygon([(round(x), round(y)) for x, y in pts], fill=self.c(k))


class Rig:
    """index: Monster1 칩 번호. pal: 키→hex(≤16, 외곽선 키 'o' 필수). labels: [(부위, x0, y0, x1, y1)] 칩 1배(포함), 앞의 것이 이긴다.
    pivots: {부위: (x, y)} 칩 1배 관절. parent: {부위: 부모}(없으면 root). order: 뒤→앞. own: 옮겨지면 제 외곽선을 두른다.
    light/shade: {색 키: 한 단 밝은/어두운 색 키}."""

    def __init__(self, index, pal, labels, pivots, parent, order, cell=64, own=(), dark=0x46, force=None,
                 light=None, shade=None, root_pivot=None):
        self.cell = cell
        self.pal = {k: hexc(v) for k, v in pal.items()}
        self.o = self.pal['o']
        fr = chip_frame(index)
        self.chip = fr
        base = strip_edge(quantize(fr, pal, force), dark)
        big = scale2x(base)
        self.labels = labels
        names = list(dict.fromkeys(order))
        self.parts = {n: Image.new('RGBA', big.size) for n in names}
        bp = big.load()
        for y in range(big.height):
            for x in range(big.width):
                c = bp[x, y]
                if not c[3]:
                    continue
                self.parts[self.label(x // 2, y // 2)].putpixel((x, y), c)
        self.up = {}
        self.pivots = {n: (2 * p[0], 2 * p[1]) for n, p in pivots.items()}
        bb = fr.getbbox()
        self.pivots['root'] = (2 * root_pivot[0], 2 * root_pivot[1]) if root_pivot else ((bb[0] + bb[2]), 2 * bb[3])
        self.parent = parent
        self.order = names
        self.own = set(own)
        self.light = {self.pal[a]: self.pal[b] for a, b in (light or {}).items()}
        self.shade = {self.pal[a]: self.pal[b] for a, b in (shade or {}).items()}
        # 2배 칩 → 셀: 가로 중심·바닥은 build 가 대기 칸으로 맞춘다. 여기서는 대충 가운데.
        self.W = cell * 2
        self.place = (self.W // 2 - (bb[0] + bb[2]), self.W - cell // 2 - 2 * bb[3])

    def label(self, x, y):
        for (n, x0, y0, x1, y1) in self.labels:
            if x0 <= x <= x1 and y0 <= y <= y1:
                return n
        return 'body'

    def upscaled(self, n):
        if n not in self.up:
            im = self.parts[n]
            for _ in range(3):
                im = scale2x(im)
            self.up[n] = im
        return self.up[n]

    def world(self, pose, n, memo):
        if n in memo:
            return memo[n]
        v = list(pose.get(n, ())) + [0, 0, 0, 0]
        L = aff_local(v[0], v[1], v[2], self.pivots.get(n, self.pivots['root']), v[3])
        if n == 'root':
            M = aff_mul((1, 0, 0, 1, self.place[0], self.place[1]), L)
        else:
            M = aff_mul(self.world(pose, self.parent.get(n, 'root'), memo), L)
        memo[n] = M
        return M

    def pt(self, pose, n, p):
        """칩 1배 좌표 p(부위 n 에 붙은 점)가 이 포즈에서 셀 어디에 오는가."""
        return aff_apply(self.world(pose, n, {}), (2 * p[0], 2 * p[1]))

    def draw_part(self, n, M):
        cell = self.W
        out = Image.new('RGBA', (cell, cell)); o = out.load()
        a, b, c, d, tx, ty = M
        det = a * d - b * c
        ia, ib, ic, idd = d / det, -b / det, -c / det, a / det
        if is_shift(M):
            src = self.parts[n]; s = src.load(); f = 1
        else:
            src = self.upscaled(n); s = src.load(); f = 8
        sw, sh = src.size
        for y in range(cell):
            for x in range(cell):
                X, Y = x + 0.5 - tx, y + 0.5 - ty
                if f == 1:
                    sx = int(math.floor(ia * X + ib * Y + 1e-6)); sy = int(math.floor(ic * X + idd * Y + 1e-6))
                else:
                    sx = int(math.floor((ia * X + ib * Y) * 8)); sy = int(math.floor((ic * X + idd * Y) * 8))
                if 0 <= sx < sw and 0 <= sy < sh and s[sx, sy][3]:
                    o[x, y] = s[sx, sy]
        return out

    def render(self, pose, under=None, over=None, mid=None, hide=(), recolor=None):
        """pose: {부위: (dx, dy, rot)} ('root' = 전체). under/over(cv, pose): 몸 뒤/앞 소품. mid = {부위: fn} 그 부위 바로 뒤에 그린다."""
        pose = dict(pose)
        memo = {}
        im = Image.new('RGBA', (self.W, self.W))
        cv = Canvas(im, self.pal)
        if under:
            under(cv, pose)
        for n in self.order:
            if mid and n in mid:
                mid[n](cv, pose)
            if n in hide:
                continue
            img = self.draw_part(n, self.world(pose, n, memo))
            if n in self.own and any(abs(v) > 1e-9 for v in (list(pose.get(n, ())) + [0])):
                img = outline(img, self.o)
            im.alpha_composite(img)
        if recolor:
            px = im.load()
            rc = {self.pal[a]: self.pal[b] for a, b in recolor.items()}
            for y in range(self.W):
                for x in range(self.W):
                    if px[x, y] in rc:
                        px[x, y] = rc[px[x, y]]
        im = self.shadepass(im)
        im = outline(im, self.o)
        if over:
            over(Canvas(im, self.pal), pose)
        return im

    def shadepass(self, im):
        w, h = im.size
        s = im.load(); out = im.copy(); o = out.load()
        oc = self.o
        for y in range(h):
            for x in range(w):
                p = s[x, y]
                if not p[3] or p == oc:
                    continue

                def e(dx, dy):
                    X, Y = x + dx, y + dy
                    return not (0 <= X < w and 0 <= Y < h) or s[X, Y][3] == 0
                tl = e(-1, 0) or e(0, -1)
                br = e(1, 0) or e(0, 1)
                if tl and p in self.light:
                    o[x, y] = self.light[p]
                elif br and not tl and p in self.shade:
                    o[x, y] = self.shade[p]
        return out


# ── 소품·효과 도우미(셀 좌표) ──
def stroke(cv, pts, core, edge='o', w=1):
    cv.line(pts, edge, w + 2)
    cv.line(pts, core, w)


def ring(cv, cx, cy, r, k, step=30, a0=0):
    for a in range(a0, a0 + 360, step):
        t = math.radians(a)
        cv.dot(cx + r * math.cos(t), cy - r * math.sin(t), k)


def spark(cv, x, y, n, k, core=None):
    cv.line([(x - n, y), (x + n, y)], k)
    cv.line([(x, y - n), (x, y + n)], k)
    if core:
        cv.dot(x, y, core)


def orb(cv, x, y, r, rim, core, hi=None):
    cv.ell(x, y, r, r, rim)
    if r >= 2:
        cv.ell(x, y, r - 1, r - 1, core)
    if hi and r >= 2:
        cv.dot(x - 1, y - 1, hi)


def arc(cv, cx, cy, r, a0, a1, k, w=1, step=4):
    pts = [(cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))) for a in range(a0, a1 + 1, step)]
    cv.line(pts, k, w)


def dirv(p, q):
    dx, dy = q[0] - p[0], q[1] - p[1]
    L = math.hypot(dx, dy) or 1
    return dx / L, dy / L


def lerp(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def isolated(im):
    a = im.getchannel('A').load()
    w, h = im.size
    return [(x, y) for y in range(h) for x in range(w)
            if a[x, y] and not any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy] for dx, dy in N4)]


def shift(im, dx, dy):
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    return out


def build(chip, cell, frames, walk_index, airborne=('leap',), preplaced=False):
    """frames: {이름: 셀 이미지}. 대기 a 로 가로 중심(cell/2)·바닥(cell−4)을 맞추고 같은 이동을 모든 칸에 준다."""
    ref = frames['idle_a'].getbbox()
    dx = 0 if preplaced else cell // 2 - (ref[0] + ref[2]) // 2
    dy = 0 if preplaced else (cell - 4) - (ref[3] - 1)
    cells = []
    for n in NAMES:
        f = shift(frames[n], dx, dy)
        for q in isolated(f):
            f.putpixel(q, T)
        cells.append(f)
    sheet = Image.new('RGBA', (cell * 3, cell * 5))
    for i, f in enumerate(cells):
        sheet.paste(f, (i % 3 * cell, i // 3 * cell))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    rep = check(sheet, cell, airborne)
    QA.mkdir(parents=True, exist_ok=True)
    (QA / f'{chip}.json').write_text(json.dumps(rep, indent=1, ensure_ascii=False) + '\n')
    board(chip, sheet, cell, walk_index, QA / f'board-{chip}.png')
    print(chip, 'cell', cell, 'colours', rep['colours'], 'idle', rep['frames']['idle_a'], 'errors', rep['errors'] or 'none')
    return sheet, rep


def check(sheet, cell, airborne=('leap',)):
    """크기·알파 0/255·≤16색·빈 칸·칸끼리 다름·가장자리 1px·바닥선(땅에 선 칸은 맨 아래 픽셀 = cell−4)."""
    errs = []
    if sheet.size != (cell * 3, cell * 5):
        errs.append(f'size {sheet.size}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errs.append('alpha')
    ncol = len({c for _, c in sheet.getcolors(1 << 20) if c[3]})
    if ncol > 16:
        errs.append(f'colours {ncol}')
    cells = [sheet.crop((i % 3 * cell, i // 3 * cell, i % 3 * cell + cell, i // 3 * cell + cell)) for i in range(15)]
    rep = {'size': list(sheet.size), 'cell': cell, 'colours': ncol, 'frames': {}}
    for n, c in zip(NAMES, cells):
        b = c.getbbox()
        if not b:
            errs.append(f'{n} empty'); continue
        rep['frames'][n] = {'bbox': list(b), 'w': b[2] - b[0], 'h': b[3] - b[1], 'bottom': b[3] - 1}
        if b[0] < 1 or b[1] < 1 or b[2] > cell - 1 or b[3] > cell - 3:
            errs.append(f'{n} bounds {b}')
        if n not in airborne and b[3] - 1 != cell - 4:
            errs.append(f'{n} floor {b[3] - 1}')
        if n in airborne and b[3] - 1 >= cell - 4:
            errs.append(f'{n} not airborne')
    for i in range(15):
        for j in range(i + 1, 15):
            if cells[i].tobytes() == cells[j].tobytes():
                errs.append(f'{NAMES[i]}=={NAMES[j]}')
    rep['errors'] = errs
    return rep


def board(chip, sheet, cell, walk_index, path, z=4):
    """확인판 (a): 걷기 칩 왼쪽 보기(4배)와 칩 2배를 4배(= 대기 칸과 같은 배율), 옆에 15칸 4배."""
    BG = (0x28, 0x30, 0x48, 255)
    fr = chip_frame(walk_index)
    W = 24 * 2 * z + 24 + cell * 3 * z
    H = cell * 5 * z + 24
    im = Image.new('RGBA', (W, H), (14, 16, 26, 255))
    c1 = Image.new('RGBA', (24, 32), BG); c1.alpha_composite(fr)
    im.paste(c1.resize((24 * z, 32 * z), Image.NEAREST), (8, 20))
    c2 = c1.resize((48 * z, 64 * z), Image.NEAREST)
    im.paste(c2, (8, 32 * z + 44))
    sb = Image.new('RGBA', sheet.size, BG); sb.alpha_composite(sheet)
    im.paste(sb.resize((cell * 3 * z, cell * 5 * z), Image.NEAREST), (24 * 2 * z + 16, 20))
    d = ImageDraw.Draw(im)
    d.text((8, 4), f'{chip} chip x{z}', fill=(220, 220, 230))
    d.text((8, 32 * z + 28), f'chip x2 at x{z} (= idle scale)', fill=(220, 220, 230))
    for i, n in enumerate(NAMES):
        x, y = 24 * 2 * z + 16 + i % 3 * cell * z, 20 + i // 3 * cell * z
        d.rectangle((x, y, x + cell * z - 1, y + cell * z - 1), outline=(80, 90, 120))
        d.line((x + 2, y + (cell - 3) * z, x + cell * z - 3, y + (cell - 3) * z), fill=(70, 100, 150))
        d.text((x + 4, y + 3), n, fill=(210, 205, 220))
    im.save(path)


def parts_board(rig, path, z=10):
    cols = [(230, 80, 80), (80, 200, 90), (80, 120, 240), (230, 200, 60), (200, 80, 220), (60, 210, 210), (240, 140, 40), (150, 150, 150), (255, 255, 255), (120, 60, 30)]
    w, h = rig.parts[rig.order[0]].size
    lab = Image.new('RGBA', (w, h), (40, 45, 60, 255))
    for i, n in enumerate(rig.order):
        lab.paste(Image.new('RGBA', (w, h), cols[i % len(cols)] + (255,)), (0, 0), rig.parts[n].getchannel('A'))
    im = lab.convert('RGB').resize((w * z, h * z), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for i, n in enumerate(rig.order):
        d.text((4, 4 + i * 12), n, fill=cols[i % len(cols)])
    for n, p in rig.pivots.items():
        d.ellipse((p[0] * z - 4, p[1] * z - 4, p[0] * z + 4, p[1] * z + 4), outline=(255, 255, 255))
    im.save(path)



# ── 사람형(두 다리) 공통 포즈표. 값 = (dx, dy, rot) 셀 px·도. rot + = 윗부분이 앞(왼쪽)으로. 매달린 팔·다리는 rot + 이면 끝이 뒤로. ──
HUMANOID = {
    'idle_a': {},
    'idle_b': {'body': (0, 1, 0), 'arm': (0, 1, 0)},
    'idle_c': {'body': (0, 1, 0), 'head': (0, 1, 0), 'arm': (0, 1, 0)},
    'windup': {'root': (3, 0, 0, -0.18), 'arm': (0, 0, 120), 'leg_f': (0, 0, -10), 'leg_b': (0, 0, 8)},
    'move': {'root': (-2, 0, 0, 0.25), 'arm': (0, 0, 40), 'leg_f': (0, 0, -28), 'leg_b': (0, 0, 24)},
    'attack': {'root': (0, 0, 0, 0.34), 'arm': (0, 0, -80), 'leg_f': (0, 0, -30), 'leg_b': (0, 0, 24)},
    'recover': {'root': (-2, 0, 0, 0.12), 'arm': (0, 0, -20), 'leg_f': (0, 0, -12), 'leg_b': (0, 0, 8)},
    'hit': {'root': (3, 0, 0, -0.3), 'head': (1, 1, 0), 'arm': (0, 0, 55), 'leg_f': (0, 0, -6), 'leg_b': (0, 0, 5)},
    'dead': {'root': (0, 0, -90)},
    'cast_charge': {'root': (1, 0, 0, -0.08), 'body': (0, 1, 0), 'head': (0, 1, 0), 'arm': (0, 0, 30), 'leg_f': (0, 0, -6), 'leg_b': (0, 0, 6)},
    'cast_raise': {'root': (1, 0, 0, -0.16), 'head': (0, -1, 0), 'arm': (0, 0, 170), 'leg_f': (0, 0, -4), 'leg_b': (0, 0, 3)},
    'cast_release': {'root': (0, 0, 0, 0.22), 'arm': (0, 0, -95), 'leg_f': (0, 0, -20), 'leg_b': (0, 0, 16)},
    'leap': {'root': (0, -6, 0, 0.14), 'arm': (0, 0, 135), 'leg_f': (0, 0, -60), 'leg_b': (0, 0, 40)},
    'buff': {'root': (0, 0, 0, -0.1), 'body': (0, -1, 0), 'head': (0, -2, 0), 'arm': (0, 0, 150), 'leg_f': (0, 0, -14), 'leg_b': (0, 0, 14)},
    'finisher': {'root': (-6, 0, 0, 0.4), 'head': (-1, 0, 0), 'arm': (0, 0, -120), 'leg_f': (0, 0, -38), 'leg_b': (0, 0, 34)},
}


def pose_of(table, n, **over):
    """표의 포즈를 복사하고 부위별로 덮어쓴다(over 값 None 이면 지운다)."""
    p = dict(table.get(n, {}))
    for k, v in over.items():
        if v is None:
            p.pop(k, None)
        else:
            p[k] = v
    return p


def ground(im, cell, floor=None):
    """칸 그림의 맨 아래 픽셀을 바닥선(cell−4 또는 floor)으로 세로 이동."""
    b = im.getbbox()
    if not b:
        return im
    return shift(im, 0, (cell - 4 if floor is None else floor) - (b[3] - 1))


def clampx(f, cell):
    """칸 밖으로 나간 그림을 가로로만 밀어 넣는다(가장자리 1px). 돌진 거리는 런타임 이동 경로가 맡는다."""
    b = f.getbbox()
    if not b:
        return f
    if b[0] < 1:
        return shift(f, 1 - b[0], 0)
    if b[2] > cell - 1:
        return shift(f, (cell - 1) - b[2], 0)
    return f


def laid(rig, pose, hide=(), over=None):
    """쓰러진 몸 등: 포즈를 그린 뒤 bbox 로 잘라 돌려준다(붙일 자리는 호출자가 정한다)."""
    im = rig.render(pose, hide=hide, over=over)
    b = im.getbbox()
    return im.crop(b) if b else im


def build2(chip, cell, frames, walk_index, airborne=('leap',), hover=None, nudge=None):
    """frames: 아무 크기(보통 Rig.W) 그림. 가로는 대기 a 의 몸 중심을 cell/2 로 옮기는 같은 이동(nudge = {이름: 추가 dx}),
    칸 밖이면 가로로만 밀어 넣는다(가장자리 1px). 세로는 맨 아래 픽셀을 바닥선 cell−4 에 — airborne 칸은 대기 a 와 같은
    세로 이동만 받아 그린 높이만큼 뜨고, hover = {이름: 바닥선 위 뜬 px} 는 그 높이에 맞춘다."""
    ref = frames['idle_a'].getbbox()
    dx0 = cell // 2 - (ref[0] + ref[2]) // 2
    dy0 = (cell - 4) - (ref[3] - 1)
    fixed = {}
    for n in NAMES:
        f = frames[n]
        b = f.getbbox()
        dx = dx0 + (nudge or {}).get(n, 0)
        if b[0] + dx < 1:
            dx = 1 - b[0]
        if b[2] + dx > cell - 1:
            dx = cell - 1 - b[2]
        if hover and n in hover:
            dy = (cell - 4 - hover[n]) - (b[3] - 1)
        elif n in airborne:
            dy = max(dy0, 2 - b[1])          # 머리는 칸 안(위 2px), 발은 그린 만큼 뜬다
        else:
            dy = (cell - 4) - (b[3] - 1)
        out = Image.new('RGBA', (cell, cell))
        out.paste(f, (dx, dy), f)
        fixed[n] = out
    return build(chip, cell, fixed, walk_index, airborne=tuple(airborne) + tuple(hover or ()), preplaced=True)
