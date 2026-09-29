"""pp15_pp5 — retro2003 b5(Monster3) 파티원 15칸 시트 빌더. 걷기 칩 픽셀을 밑그림으로 쓴다.

규격(RetroPartyPixelSheet·partyPixelSheets.ts): 셀 cell×cell, 3열×5행, 왼쪽을 본다, 바닥 기준선 cell-4, 알파 0/255, ≤16색.
  행0 idle_a idle_b idle_c / 행1 windup move attack / 행2 recover hit dead /
  행3 cast_charge cast_raise cast_release / 행4 leap buff finisher

만드는 순서(네 빌더):
  1. base(chip)      Monster3.png 칩 i 의 **행 3(왼쪽 보기)** 가운데 칸(24×32)을 Scale2x(EPX)로 정수 2배 — 계단이 대각으로 다듬어지고
                     새 색은 생기지 않는다. 칩 팔레트를 ≤15색으로 줄이고(k-means, 외곽선 색 고정), 2배로 두꺼워진 외곽선을 1px 로 깎고,
                     실루엣 가장자리를 어두운 색으로 닫고(sel-out), 왼쪽 위 안쪽 테두리에 빛 한 단계·오른쪽 아래에 그늘 한 단계를 더한다.
     ※ Monster3 칩 행 순서는 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽(RPG Maker 2000 규약). 확인판 .omo/pp5/big*.png.
  2. rig(parts)      칩 좌표 다각형으로 부위(머리·날개·꼬리·무기…)를 잘라 피벗을 둔다.
  3. compose(pose)   부위마다 회전·이동, 몸 전체 기울기·이동을 적용해 겹치고 외곽선을 다시 닫는다. fx 콜백이 팔레트 색만으로 기·빛을 얹는다.
  4. build(...)      15칸 시트 저장 + 검사(크기·알파·≤16색·빈 칸·서로 다름·바닥선·칸 경계) + 확인판(원본 칩 4배 옆 15칸 4배).
"""
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from PIL import Image, ImageDraw  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = ROOT / 'public/assets/easyrpg/charset/Monster3.png'
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/pp5'
NAMES15 = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
           'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
BG = (32, 40, 64, 255)
T = (0, 0, 0, 0)


# ---------------------------------------------------------------- colour helpers
def lum(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def dist(a, b):
    return (a[0] - b[0]) ** 2 * 0.30 + (a[1] - b[1]) ** 2 * 0.59 + (a[2] - b[2]) ** 2 * 0.11


def nearest(c, pal):
    return min(pal, key=lambda p: dist(c, p))


def step(c, pal, up):
    """같은 계열에서 한 단계 밝은(up) / 어두운 색. 없으면 그대로."""
    L = lum(c)
    cand = [p for p in pal if (lum(p) > L + 0.05 if up else lum(p) < L - 0.05)]
    if not cand:
        return c
    k = 1.28 if up else 0.68
    goal = tuple(min(255, int(v * k + (18 if up else 0))) for v in c[:3])
    best = min(cand, key=lambda p: dist(p, goal))
    return best if dist(best, c) < 9000 else c


def kmeans(colors, k, keep):
    """colors: [(count, rgb)], keep: 반드시 남길 rgb. 가중 k-means."""
    pts = [(n, c) for n, c in colors]
    uniq = sorted({c for _, c in pts}, key=lambda c: -sum(n for n, d in pts if d == c))
    cent = list(keep)
    for c in uniq:
        if len(cent) >= k:
            break
        if all(dist(c, d) > 700 for d in cent):
            cent.append(c)
    for c in uniq:
        if len(cent) >= k:
            break
        if c not in cent:
            cent.append(c)
    for _ in range(12):
        acc = {i: [0, 0, 0, 0] for i in range(len(cent))}
        for n, c in pts:
            i = min(range(len(cent)), key=lambda j: dist(c, cent[j]))
            a = acc[i]
            a[0] += c[0] * n; a[1] += c[1] * n; a[2] += c[2] * n; a[3] += n
        new = []
        for i, c in enumerate(cent):
            if c in keep or not acc[i][3]:
                new.append(c)
            else:
                a = acc[i]
                new.append((round(a[0] / a[3]), round(a[1] / a[3]), round(a[2] / a[3])))
        cent = new
    return [tuple(c) for c in cent]


# ---------------------------------------------------------------- 1. base
def chip_cell(chip_index, row=3, col=1):
    im = Image.open(SRC).convert('RGBA')
    key = im.getpixel((0, 0))
    bx, by = (chip_index % 4) * 72 + col * 24, (chip_index // 4) * 128 + row * 32
    c = im.crop((bx, by, bx + 24, by + 32))
    px = c.load()
    for y in range(32):
        for x in range(24):
            if px[x, y] == key:
                px[x, y] = T
    return c


def scale2x(im):
    w, h = im.size
    s = im.load()
    out = Image.new('RGBA', (w * 2, h * 2))
    o = out.load()
    g = lambda x, y: s[x, y] if 0 <= x < w and 0 <= y < h else T
    for y in range(h):
        for x in range(w):
            P, A, B, C, D = s[x, y], g(x, y - 1), g(x + 1, y), g(x - 1, y), g(x, y + 1)
            o[2 * x, 2 * y] = A if (C == A and C != D and A != B) else P
            o[2 * x + 1, 2 * y] = B if (A == B and A != C and B != D) else P
            o[2 * x, 2 * y + 1] = C if (D == C and D != B and C != A) else P
            o[2 * x + 1, 2 * y + 1] = D if (B == D and B != A and D != C) else P
    return out


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def opaque(px, w, h, x, y):
    return 0 <= x < w and 0 <= y < h and px[x, y][3] > 0


def edge_pixels(im):
    w, h = im.size
    px = im.load()
    return {(x, y) for y in range(h) for x in range(w) if px[x, y][3] and any(not opaque(px, w, h, x + a, y + b) for a, b in N4)}


def selout(im, pal, dark):
    """실루엣 가장자리 1px 을 어둡게 닫는다: 밝은 가장자리는 같은 계열 어두운 색, 그래도 밝으면 외곽선 색."""
    px = im.load()
    for x, y in edge_pixels(im):
        c = px[x, y][:3]
        if lum(c) <= lum(dark) + 0.12:
            continue
        d = step(step(c, pal, False), pal, False)
        if lum(d) > 0.30:
            d = dark
        px[x, y] = d + (255,)


def thin_outline(im, dark_set):
    """Scale2x 로 2px 이 된 바깥 외곽선의 안쪽 줄을 안쪽 색으로 메운다."""
    w, h = im.size
    px = im.load()
    edge = edge_pixels(im)
    fix = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if not c[3] or (x, y) in edge or c[:3] not in dark_set:
                continue
            for a, b in N4:
                if (x + a, y + b) in edge and px[x + a, y + b][:3] in dark_set:
                    ix, iy = x - a, y - b
                    if opaque(px, w, h, ix, iy) and px[ix, iy][:3] not in dark_set:
                        fix[(x, y)] = px[ix, iy]
                        break
    for q, c in fix.items():
        px[q] = c


def quantize(im, k, keep=()):
    px = im.load()
    w, h = im.size
    cols = [(n, c[:3]) for n, c in im.getcolors(w * h) if c[3]]
    darkest = min((c for _, c in cols), key=lum)
    keep = [darkest] + [tuple(bytes.fromhex(k_)) for k_ in keep]
    pal = kmeans(cols, k, keep)
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                px[x, y] = nearest(px[x, y][:3], pal) + (255,)
    return pal, darkest


def shade(im, pal, dark):
    """안쪽 테두리 빛·그늘 한 단계(광원 왼쪽 위)."""
    w, h = im.size
    px = im.load()
    src = im.copy().load()
    edge = edge_pixels(im)
    isdark = lambda q: (not opaque(src, w, h, *q)) or src[q][:3] == dark
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if not c[3] or (x, y) in edge or c[:3] == dark:
                continue
            if isdark((x - 1, y)) and isdark((x, y - 1)) or isdark((x - 1, y - 1)) and isdark((x, y - 1)) and (x, y - 1) in edge:
                px[x, y] = step(c[:3], pal, True) + (255,)
            elif isdark((x + 1, y)) and isdark((x, y + 1)):
                px[x, y] = step(c[:3], pal, False) + (255,)


def base(chip_index, colours=15, keep=(), drop_rows=(), row=3, col=1, clean=None):
    c = chip_cell(chip_index, row, col)
    px = c.load()
    for y in drop_rows:
        for x in range(24):
            px[x, y] = T
    box = c.getbbox()
    if box[3] - box[1] > 30:
        # 셀 64 의 가용 높이는 60px(y 1..60) — 31줄 칩은 몸통 가운데 한 줄을 빼 60px 에 맞춘다(키우지 않는다).
        y0 = box[1] + (box[3] - box[1]) // 2
        top = c.crop((0, 0, 24, y0))
        ImageDraw.Draw(c).rectangle((0, 0, 23, y0), fill=T)
        c.alpha_composite(top, (0, 1))
    if clean:
        clean(c)
    big = scale2x(c)
    pal, dark = quantize(big, colours, keep)
    darks = {p for p in pal if lum(p) <= lum(dark) + 0.06}
    thin_outline(big, darks)
    selout(big, pal, dark)
    shade(big, pal, dark)
    return big, pal, dark, c


# ---------------------------------------------------------------- 2·3. rig + compose
def inside(pt, poly):
    x, y = pt
    ins = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            ins = not ins
        j = i
    return ins


def cut(big, parts):
    """parts: [(name, poly_in_chip_coords, pivot_in_chip_coords)] 앞선 것이 먼저 가진다. 나머지는 'body'."""
    w, h = big.size
    src = big.load()
    layers = {n: Image.new('RGBA', big.size) for n, _, _ in parts}
    layers['body'] = Image.new('RGBA', big.size)
    lp = {n: layers[n].load() for n in layers}
    for y in range(h):
        for x in range(w):
            if not src[x, y][3]:
                continue
            q = ((x + .5) / 2, (y + .5) / 2)
            for n, poly, _ in parts:
                if inside(q, poly):
                    lp[n][x, y] = src[x, y]
                    break
            else:
                lp['body'][x, y] = src[x, y]
    piv = {n: (p[0] * 2, p[1] * 2) for n, _, p in parts}
    return layers, piv


def rot(im, deg, pivot):
    if not deg:
        return im
    # RotSprite 축약: 3배 확대 → 최근접 회전 → 칸 가운데 표본. 새 색이 생기지 않고 1px 선이 덜 끊긴다.
    k = 3
    w, h = im.size
    up = im.resize((w * k, h * k), Image.Resampling.NEAREST)
    up = up.rotate(deg, resample=Image.Resampling.NEAREST, center=(pivot[0] * k, pivot[1] * k))
    out = Image.new('RGBA', im.size)
    src, dst = up.load(), out.load()
    for y in range(h):
        for x in range(w):
            dst[x, y] = src[x * k + 1, y * k + 1]
    return out


def shift(im, dx, dy):
    out = Image.new('RGBA', im.size)
    out.paste(im, (int(dx), int(dy)), im)
    return out


class Rig:
    def __init__(self, big, pal, dark, parts, order, cell, place):
        """place = (ox, oy): 2배 밑그림을 셀에 놓는 자리(대기 칸 기준)."""
        self.big, self.pal, self.dark, self.cell = big, pal, dark, cell
        self.layers, self.piv = cut(big, parts)
        self.order = order
        self.place = place

    def col(self, rank):
        """팔레트를 밝기순으로 세운 뒤 rank(0=가장 어두움, -1=가장 밝음) 색."""
        return sorted(self.pal, key=lum)[rank] + (255,)

    def pose(self, spec, fx=None, fx_back=None):
        """spec: {'g': (dx,dy,deg,pivot?), part: (dx,dy,deg)}"""
        W = self.big.size
        canvas = Image.new('RGBA', (self.cell * 2, self.cell * 2))
        ox, oy = self.place
        off = (self.cell // 2, self.cell // 2)  # 여유 캔버스(셀 2배)에서 셀 위치
        if fx_back:
            fx_back(canvas, ImageDraw.Draw(canvas), off, self)
        body = Image.new('RGBA', W)
        for n in self.order:
            L = self.layers[n]
            dx, dy, deg = spec.get(n, (0, 0, 0))[:3]
            L = rot(L, deg, self.piv.get(n, (W[0] / 2, W[1])))
            L = shift(L, dx, dy)
            body.alpha_composite(L)
        g = spec.get('g', (0, 0, 0))
        gp = g[3] if len(g) > 3 else (W[0] / 2, W[1] - 2)
        body = rot(body, g[2], (gp[0], gp[1]))
        canvas.alpha_composite(body, (off[0] + ox + int(g[0]), off[1] + oy + int(g[1])))
        if fx:
            fx(canvas, ImageDraw.Draw(canvas), off, self)
        selout(canvas, self.pal, self.dark)
        return canvas.crop((off[0], off[1], off[0] + self.cell, off[1] + self.cell)), canvas


def clean_isolated(im):
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(opaque(px, w, h, x + a, y + b) for a, b in N4):
                px[x, y] = T


def settle(im, cell, ground):
    """칸 경계 안으로 밀고, ground 면 바닥 픽셀을 cell-4 에 맞춘다."""
    box = im.getbbox()
    if not box:
        return im
    dx = 1 - box[0] if box[0] < 1 else (cell - 1 - box[2] if box[2] > cell - 1 else 0)
    dy = 0
    if ground or box[3] > cell - 3:
        dy = (cell - 3) - box[3]
    if box[1] + dy < 1:
        dy = 1 - box[1]
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    return out


# ---------------------------------------------------------------- fx 도구(팔레트 색만)
def orb(d, cx, cy, r, rig, core=-1, rim=-3):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rig.col(rim), outline=rig.dark + (255,))
    if r >= 2:
        d.ellipse((cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2), fill=rig.col(core))


def spark(d, x, y, n, rig, rank=-1):
    c = rig.col(rank)
    d.line((x - n, y, x + n, y), fill=c)
    d.line((x, y - n, x, y + n), fill=c)


def ring_ticks(d, cx, cy, r, k, rig, rank=-1, ln=3, phase=0):
    for i in range(k):
        a = math.radians(phase + 360 * i / k)
        x0, y0 = cx + math.cos(a) * r, cy + math.sin(a) * r
        x1, y1 = cx + math.cos(a) * (r + ln), cy + math.sin(a) * (r + ln)
        d.line((x0, y0, x1, y1), fill=rig.col(rank), width=1)


def arc_slash(d, box, a0, a1, rig, width=3):
    d.arc(box, a0, a1, fill=rig.dark + (255,), width=width + 2)
    d.arc(box, a0, a1, fill=rig.col(-1), width=width)


# ---------------------------------------------------------------- 4. build + 검사 + 확인판
def build(chip, cell, frames, src_chip, ground=True, airborne=(), chip_index=None):
    """frames: {name: RGBA cell×cell}. ground=True 면 airborne 에 없는 칸을 바닥에 맞춘다."""
    out = []
    for n in NAMES15:
        im = frames[n]
        clean_isolated(im)
        g = (ground and n not in airborne) or n == 'dead'
        out.append(globals()['settle'](im, cell, g))
    sheet = Image.new('RGBA', (cell * 3, cell * 5))
    for i, im in enumerate(out):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    errs = []
    if sheet.size != (cell * 3, cell * 5):
        errs.append(f'size {sheet.size}')
    palette = {c for _, c in sheet.getcolors(cell * cell * 15) if c[3]}
    if len(palette) > 16:
        errs.append(f'colours {len(palette)}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errs.append('alpha')
    rep = {'chip': chip, 'cell': cell, 'rows': 5, 'colours': len(palette), 'baseline': cell - 4, 'frames': {}}
    for n, im in zip(NAMES15, out):
        box = im.getbbox()
        if not box:
            errs.append(f'{n} empty')
            continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= cell - 3):
            errs.append(f'{n} bounds {box}')
        g = (ground and n not in airborne) or n == 'dead'
        if g and box[3] != cell - 3:
            errs.append(f'{n} baseline {box[3] - 1}')
        rep['frames'][n] = {'bbox': list(box), 'size': [box[2] - box[0], box[3] - box[1]], 'bottom': box[3] - 1}
    for i in range(15):
        for j in range(i + 1, 15):
            if out[i].tobytes() == out[j].tobytes():
                errs.append(f'{NAMES15[i]}=={NAMES15[j]}')
    OUT.mkdir(parents=True, exist_ok=True)
    q = QA / chip
    q.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    rep['errors'] = errs
    (q / 'validation.json').write_text(json.dumps(rep, indent=2) + '\n')
    board(chip, cell, sheet, src_chip, q / 'board.png')
    idle = rep['frames'].get('idle_a', {}).get('size')
    print(f'{chip} cell {cell} size {sheet.size} colours {len(palette)} idle {idle} errors', errs or 'none')
    return sheet, errs


def board(chip, cell, sheet, src_chip, path):
    """원본 걷기 칩(왼쪽 보기 가운데 칸, 4배) 옆에 15칸(4배). 가로 ≤ 1900."""
    Z = 3 if cell == 64 else 4
    ZC = Z * 2  # 칩은 시트와 같은 배율로 보이게(칩 1px = 시트 2px)
    cw = cell * Z
    W = 24 * ZC + 16 + cw * 3
    H = max(32 * ZC, cw * 5) + 20
    b = Image.new('RGB', (W, H), BG[:3])
    chipbg = Image.new('RGBA', src_chip.size, BG)
    chipbg.alpha_composite(src_chip)
    b.paste(chipbg.convert('RGB').resize((24 * ZC, 32 * ZC), Image.Resampling.NEAREST), (0, 20))
    sb = Image.new('RGBA', sheet.size, BG)
    sb.alpha_composite(sheet)
    b.paste(sb.convert('RGB').resize((cw * 3, cw * 5), Image.Resampling.NEAREST), (24 * ZC + 16, 20))
    d = ImageDraw.Draw(b)
    d.text((4, 4), f'{chip} walk chip x{ZC}', fill='#d6cddc')
    d.text((24 * ZC + 20, 4), f'sheet x{Z}  (cell {cell})', fill='#d6cddc')
    for i, n in enumerate(NAMES15):
        x, y = 24 * ZC + 16 + i % 3 * cw, 20 + i // 3 * cw
        d.rectangle((x, y, x + cw - 1, y + cw - 1), outline='#586078')
        d.line((x + 2, y + (cell - 3) * Z, x + cw - 3, y + (cell - 3) * Z), fill='#39465e')
        d.text((x + 4, y + 3), n, fill='#d6cddc')
    b.save(path)



# ================================================================ 자세 엔진(Poser)
# 좌표: 칩 좌표(24×32) 로 부위 다각형·피벗을 적고, 엔진이 2배 좌표로 바꾼다. 캐릭터는 이미 왼쪽을 본다(앞 = -x).
# 변환 순서(부위·전신 공통): 호흡(breath: 선 위를 k px 눌러 내리거나 늘림) → 기울기(shear: 피벗 위쪽이 옆으로 밀림, 픽셀을 깨지 않음)
#   → 회전(r, 도, 반시계 +, 필요한 부위만) → 이동(d).
GENERIC = {
    'idle_a': dict(),
    'idle_b': dict(br=1, back=(0, 0, 3)),
    'idle_c': dict(br=2, back=(0, 1, 6), arm=(0, 1, 3)),
    'windup': dict(g=(4, 0, 4), br=1, arm=(2, -2, 35), head=(1, 0, 0), back=(1, 0, 8)),
    'move': dict(g=(-6, 0, -3), arm=(0, 0, 10), back=(2, 0, -6), legs=(-1, 0, 0)),
    'attack': dict(g=(-10, 0, -6), br=-1, arm=(-4, 0, -55), head=(-2, 0, 0), back=(2, 0, -10), fx='impact'),
    'recover': dict(g=(-3, 0, -2), br=1, arm=(-1, 0, -20), back=(0, 0, -3)),
    'hit': dict(g=(6, 0, 7), arm=(2, -1, 25), head=(2, -1, 0), back=(0, -1, 10), fx='hurt'),
    'dead': dict(dead=True),
    'cast_charge': dict(g=(2, 0, 2), br=2, arm=(1, -1, 20), fx='charge'),
    'cast_raise': dict(g=(0, -2, 1), br=-2, arm=(0, -3, 130), head=(0, -1, 0), back=(0, -2, 12), fx='raise'),
    'cast_release': dict(g=(-6, 0, -5), arm=(-3, 0, -75), head=(-1, 0, 0), back=(1, 0, -8), fx='release'),
    'leap': dict(g=(-2, -10, -3), br=3, legs=(1, -6, 0), arm=(0, -2, 60), back=(0, -2, 18), air=True),
    'buff': dict(g=(1, -1, 1), br=-2, arm=(1, -2, 45), head=(0, -2, 0), back=(0, -2, 16), fx='buff'),
    'finisher': dict(g=(-10, 0, -8), br=-1, arm=(-4, -1, -95), head=(-2, 0, 0), back=(3, -1, -14), fx='finisher'),
}


def breath(im, ycut, k):
    """ycut 선 위를 k px 아래로 누른다(k<0 면 위로 늘린다, 선의 줄을 늘려 채움)."""
    if not k:
        return im
    w, h = im.size
    top = im.crop((0, 0, w, ycut))
    out = im.copy()
    if k > 0:
        ImageDraw.Draw(out).rectangle((0, 0, w, ycut - 1), fill=T)
        out.alpha_composite(top, (0, k))
    else:
        line = im.crop((0, ycut - 1, w, ycut))
        ImageDraw.Draw(out).rectangle((0, 0, w, ycut - 1), fill=T)
        out.alpha_composite(top, (0, k))
        for j in range(-k):
            out.alpha_composite(line, (0, ycut - 1 - j))
    return out


def shear(im, s, py):
    """피벗 줄 py 에서 위로 올라갈수록 옆으로 밀린다. s = 64px 올라갔을 때 밀리는 양(+ = 뒤/오른쪽)."""
    if not s:
        return im
    w, h = im.size
    out = Image.new('RGBA', im.size)
    for y in range(h):
        dx = round(s * (py - y) / 64)
        row = im.crop((0, y, w, y + 1))
        out.alpha_composite(row, (dx, y)) if 0 <= dx < w else out.paste(row, (dx, y), row)
    return out


def rpt(pt, deg, piv):
    a = math.radians(-deg)
    x, y = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + x * math.cos(a) - y * math.sin(a), piv[1] + x * math.sin(a) + y * math.cos(a))


class Poser:
    def __init__(self, S):
        self.S = S
        self.cell = S['cell']
        self.big, self.pal, self.dark, self.chip = base(S['chip'], S.get('colours', 15), S.get('keep', ()), S.get('drop', ()),
                                                        row=S.get('row', 3), col=S.get('col', 1), clean=S.get('clean'))
        if S.get('mirror'):
            from PIL import ImageOps
            self.big = ImageOps.mirror(self.big)
            self.chip = ImageOps.mirror(self.chip)
        self.pal_sorted = sorted(self.pal, key=lum)
        cell = self.cell
        self.W = cell * 2
        box = self.big.getbbox()
        self.off = (cell // 2 + cell // 2 - (box[0] + box[2]) // 2 + S.get('ox', 0), cell // 2 + (cell - 3) - box[3] + S.get('oy', 0))
        pad = Image.new('RGBA', (self.W, self.W))
        pad.alpha_composite(self.big, self.off)
        self.pad = pad
        parts = [(n, poly, piv) for n, poly, piv in S.get('parts', [])]
        self.layers, piv = self._cut(parts)
        self.piv = {n: (p[0] + self.off[0], p[1] + self.off[1]) for n, p in piv.items()}
        self.ground_y = cell // 2 + cell - 3
        self.cx = cell // 2 + cell // 2
        self.breath_y = self.off[1] + S.get('breath_y', 16) * 2
        self.roles = S.get('roles', {})

    def _cut(self, parts):
        layers, piv = cut(self.big, parts)
        out = {}
        for n, L in layers.items():
            P = Image.new('RGBA', (self.W, self.W))
            P.alpha_composite(L, self.off)
            out[n] = P
        return out, piv

    def c(self, hexcol):
        return nearest(tuple(bytes.fromhex(hexcol)), self.pal) + (255,)

    def rank(self, i):
        return self.pal_sorted[i] + (255,)

    def chip_pt(self, x, y):
        return (self.off[0] + x * 2, self.off[1] + y * 2)

    def xform(self, im, t, piv):
        dx, dy, deg = (tuple(t) + (0, 0, 0))[:3]
        im = rot(im, deg, piv)
        return shift(im, dx, dy)

    def spec(self, name):
        P = {k: v for k, v in GENERIC[name].items()}
        for k, v in self.S.get('poses', {}).get(name, {}).items():
            P[k] = v
        return P

    def render(self, name):
        P = self.spec(name)
        if P.get('custom'):
            return P['custom'](self, name)
        body = Image.new('RGBA', (self.W, self.W))
        order = self.S.get('order', list(self.layers))
        info = {}
        for n in order:
            L = self.layers[n]
            role = self.roles.get(n, n)
            t = P.get(n, P.get(role, (0, 0, 0)))
            pv = self.piv.get(n, (self.cx, self.ground_y))
            L = self.xform(L, t, pv, n in self.S.get('attached', ('head', 'legs')))
            info[n] = (t, pv)
            body.alpha_composite(L)
        gdx, gdy, gs = (tuple(P.get('g', (0, 0, 0))) + (0, 0, 0))[:3]
        body = breath(body, self.breath_y, P.get('br', 0))
        body = shear(body, gs, self.ground_y)
        body = shift(body, gdx, gdy)
        J = dict(P=P, info=info, g=(gdx, gdy, gs), name=name)
        J['pt'] = lambda x, y, part=None: self.track(x, y, part, J)
        canvas = Image.new('RGBA', (self.W, self.W))
        fxb = self.S.get('fx_back')
        if fxb:
            fxb(self, ImageDraw.Draw(canvas), J)
        canvas.alpha_composite(body)
        if P.get('dead'):
            canvas = self.dead(canvas)
        fx = self.S.get('fx')
        if fx:
            fx(self, ImageDraw.Draw(canvas), J)
        selout(canvas, self.pal, self.dark)
        o = self.cell // 2
        return canvas.crop((o, o, o + self.cell, o + self.cell))

    def track(self, x, y, part, J):
        """칩 좌표 점을 부위·전신 변환을 거친 작업 캔버스 좌표로."""
        p = self.chip_pt(x, y)
        if part and part in J['info']:
            (t, pv) = J['info'][part]
            dx, dy, deg = (tuple(t) + (0, 0, 0))[:3]
            p = rpt(p, deg, pv)
            p = (p[0] + dx, p[1] + dy)
        br = J['P'].get('br', 0)
        if p[1] < self.breath_y:
            p = (p[0], p[1] + br)
        gdx, gdy, gs = J['g']
        p = (p[0] + round(gs * (self.ground_y - p[1]) / 64) + gdx, p[1] + gdy)
        return (int(round(p[0])), int(round(p[1])))

    def dead(self, canvas):
        mode = self.S.get('dead', 'lie')
        box = canvas.getbbox()
        body = canvas.crop(box)
        if mode == 'lie':
            body = body.transpose(Image.Transpose.ROTATE_270)  # 머리가 뒤(오른쪽)로
        elif mode == 'slump':
            w, h = body.size
            keep = [y for y in range(h) if y >= h * 0.45 or y % 2 == 0]
            nb = Image.new('RGBA', (w, len(keep)))
            for j, y in enumerate(keep):
                nb.paste(body.crop((0, y, w, y + 1)), (0, j))
            body = nb
        elif callable(mode):
            body = mode(self, body)
        px = body.load()
        w, h = body.size
        for y in range(h):
            for x in range(w):
                if px[x, y][3] and lum(px[x, y]) > 0.55:
                    px[x, y] = step(px[x, y][:3], self.pal, False) + (255,)
        out = Image.new('RGBA', canvas.size)
        bw, bh = body.size
        out.alpha_composite(body, (max(0, self.cx - bw // 2 + self.S.get('dead_dx', 4)), self.ground_y + 1 - bh))
        return out

    def sheet(self):
        frames = {n: self.render(n) for n in NAMES15}
        air = {n for n in NAMES15 if self.spec(n).get('air')} | set(self.S.get('airborne', ()))
        return build(self.S['name'], self.cell, frames, self.chip, ground=self.S.get('ground', True), airborne=air)


# ---------------------------------------------------------------- 공용 효과(팔레트 색만)
def fx_common(R, d, J, main, glow, hand, part='arm', dark=None, style='orb'):
    """hand: 칩 좌표 손(또는 입) 점. main/glow: 캐릭터 강조색 hex."""
    n = J['name']
    M, Gl = R.c(main), R.c(glow)
    D = R.c(dark) if dark else R.dark + (255,)
    hx, hy = J['pt'](*hand, part)
    if n == 'impact':
        pass
    kind = J['P'].get('fx')
    if kind == 'impact':
        x, y = hx - 6, hy
        for a in (0, 60, 120, 180, 240, 300):
            r = math.radians(a)
            d.line((x + math.cos(r) * 2, y + math.sin(r) * 2, x + math.cos(r) * 5, y + math.sin(r) * 5), fill=Gl)
        d.point((x, y), fill=Gl)
    elif kind == 'hurt':
        x, y = J['pt'](8, 8)
        for k in range(3):
            d.line((x - 8 - k * 3, y - 4 + k * 4, x - 4 - k * 3, y - 2 + k * 4), fill=Gl)
    elif kind == 'charge':
        x, y = hx - 4, hy - 2
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=M, outline=D)
        d.point((x - 1, y - 1), fill=Gl)
        for a in (20, 110, 200, 290):
            r = math.radians(a)
            d.line((x + math.cos(r) * 6, y + math.sin(r) * 6, x + math.cos(r) * 8, y + math.sin(r) * 8), fill=M)
    elif kind == 'raise':
        x, y = hx, hy - 7
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=M, outline=D)
        d.ellipse((x - 2, y - 3, x + 2, y + 1), fill=Gl)
        for a in range(0, 360, 45):
            r = math.radians(a + 22)
            d.line((x + math.cos(r) * 7, y + math.sin(r) * 7, x + math.cos(r) * 9, y + math.sin(r) * 9), fill=Gl if a % 90 else M)
    elif kind == 'release':
        x, y = hx - 4, hy
        d.polygon([(x, y - 4), (x - 16, y - 2), (x - 22, y), (x - 16, y + 2), (x, y + 4)], fill=M, outline=D)
        d.line((x - 2, y, x - 18, y), fill=Gl)
        d.ellipse((x - 3, y - 5, x + 3, y + 5), fill=Gl, outline=D)
    elif kind == 'buff':
        box = (J['pt'](2, 2), J['pt'](22, 30))
        (x0, y0), (x1, y1) = box
        for k, (x, y) in enumerate(((x0 - 2, y0 + 10), (x1 + 2, y0 + 14), (x0 + 2, y0 - 2), (x1 - 2, y0 + 2), (x0 - 3, y1 - 12), (x1 + 3, y1 - 8))):
            d.line((x, y + 3, x, y - 3), fill=Gl if k % 2 else M)
            d.point((x, y - 5), fill=Gl)
        d.arc((x0 - 6, y1 - 8, x1 + 6, y1 + 4), 0, 180, fill=M, width=2)
    elif kind == 'finisher':
        x, y = hx - 4, hy
        d.arc((x - 30, y - 30, x + 10, y + 12), 120, 250, fill=D, width=5)
        d.arc((x - 30, y - 30, x + 10, y + 12), 122, 248, fill=M, width=3)
        d.arc((x - 29, y - 29, x + 9, y + 11), 130, 240, fill=Gl, width=1)
        for (a, b) in ((x - 2, y - 14), (x - 22, y - 20), (x - 14, y + 8)):
            d.line((a - 3, b, a + 3, b), fill=Gl)
            d.line((a, b - 3, a, b + 3), fill=Gl)



def smear_shift(im, dx, dy):
    """붙어 있는 부위(머리·다리)를 옮길 때 원래 자리에서 목표까지 끌어 늘린다 — 목·허리에 틈이 안 생긴다."""
    out = Image.new('RGBA', im.size)
    n = max(abs(int(dx)), abs(int(dy)))
    for k in range(n + 1):
        f = k / n if n else 1
        out.alpha_composite(shift(im, round(dx * f), round(dy * f)))
    return out


_orig_xform = Poser.xform


def _xform(self, im, t, piv, attached=False):
    dx, dy, deg = (tuple(t) + (0, 0, 0))[:3]
    im = rot(im, deg, piv)
    return smear_shift(im, dx, dy) if attached and max(abs(dx), abs(dy)) <= 4 else shift(im, dx, dy)


Poser.xform = _xform



# ---------------------------------------------------------------- 효과 층: 외곽선을 따로 둘러 선명하게
def dilate_outline(layer, dark):
    w, h = layer.size
    a = layer.getchannel('A').load()
    out = Image.new('RGBA', layer.size)
    o = out.load()
    for y in range(h):
        for x in range(w):
            if a[x, y]:
                continue
            if any(0 <= x + i < w and 0 <= y + j < h and a[x + i, y + j] for i, j in N4):
                o[x, y] = dark
    return out


def _render(self, name):
    P = self.spec(name)
    body = Image.new('RGBA', (self.W, self.W))
    order = self.S.get('order', list(self.layers))
    info = {}
    for n in order:
        L = self.layers[n]
        role = self.roles.get(n, n)
        t = P.get(n, P.get(role, (0, 0, 0)))
        pv = self.piv.get(n, (self.cx, self.ground_y))
        L = self.xform(L, t, pv, n in self.S.get('attached', ('head', 'legs')))
        info[n] = (t, pv)
        body.alpha_composite(L)
    gdx, gdy, gs = (tuple(P.get('g', (0, 0, 0))) + (0, 0, 0))[:3]
    body = breath(body, self.breath_y, P.get('br', 0))
    body = shear(body, gs, self.ground_y)
    body = shift(body, gdx, gdy)
    J = dict(P=P, info=info, g=(gdx, gdy, gs), name=name)
    J['pt'] = lambda x, y, part=None: self.track(x, y, part, J)
    if P.get('dead'):
        body = self.dead(body)
    selout(body, self.pal, self.dark)
    canvas = Image.new('RGBA', (self.W, self.W))
    dark = self.dark + (255,)
    for key, top in (('fx_back', False), ('fx', True)):
        f = self.S.get(key)
        if not f:
            if top:
                canvas.alpha_composite(body)
            continue
        L = Image.new('RGBA', (self.W, self.W))
        f(self, ImageDraw.Draw(L), J)
        if not top:
            canvas.alpha_composite(dilate_outline(L, dark))
            canvas.alpha_composite(L)
        else:
            canvas.alpha_composite(body)
            # 몸 위 효과는 몸과 겹치는 곳에 외곽선을 두르지 않는다
            ol = dilate_outline(L, dark)
            ba = body.getchannel('A').load()
            op = ol.load()
            for y in range(self.W):
                for x in range(self.W):
                    if op[x, y][3] and ba[x, y]:
                        op[x, y] = T
            canvas.alpha_composite(ol)
            canvas.alpha_composite(L)
    o = self.cell // 2
    return canvas.crop((o, o, o + self.cell, o + self.cell))


Poser.render = _render


def _settle(im, cell, ground):
    box = im.getbbox()
    if not box:
        return im
    dx = 1 - box[0] if box[0] < 1 else (cell - 1 - box[2] if box[2] > cell - 1 else 0)
    if box[2] - box[0] > cell - 2:
        dx = 0
    dy = 0
    if ground or box[3] > cell - 3:
        dy = (cell - 3) - box[3]
    if box[1] + dy < 1:
        dy = 1 - box[1]
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    ImageDraw.Draw(out).rectangle((0, 0, cell - 1, 0), fill=T)
    d = ImageDraw.Draw(out)
    d.rectangle((0, 0, 0, cell - 1), fill=T)
    d.rectangle((cell - 1, 0, cell - 1, cell - 1), fill=T)
    d.rectangle((0, cell - 3, cell - 1, cell - 1), fill=T)
    return out


settle = _settle


def note(d, x, y, c):
    """8분음표(5×7)."""
    d.rectangle((x, y + 4, x + 1, y + 5), fill=c)
    d.line((x + 1, y, x + 1, y + 4), fill=c)
    d.line((x + 2, y, x + 3, y + 1), fill=c)


def star(d, x, y, r, c, core=None):
    d.line((x - r, y, x + r, y), fill=c)
    d.line((x, y - r, x, y + r), fill=c)
    if core:
        d.point((x, y), fill=core)


def burst(d, x, y, r0, r1, k, c, phase=0):
    for i in range(k):
        a = math.radians(phase + 360 * i / k)
        d.line((x + math.cos(a) * r0, y + math.sin(a) * r0, x + math.cos(a) * r1, y + math.sin(a) * r1), fill=c)


def fx_common(R, d, J, main, glow, hand, part='arm', dark=None, style='orb'):
    """손(또는 입) 점 기준 공용 효과. 색은 캐릭터 팔레트에서 main/glow 에 가장 가까운 색."""
    M, Gl = R.c(main), R.c(glow)
    hx, hy = J['pt'](*hand, part)
    k = J['P'].get('fx')
    if k == 'impact':
        burst(d, hx - 5, hy, 2, 5, 6, Gl, 15)
    elif k == 'hurt':
        x, y = J['pt'](6, 6)
        for i in range(3):
            d.line((x - 6 - i * 2, y - 3 + i * 4, x - 2 - i * 2, y - 2 + i * 4), fill=Gl)
    elif k == 'charge':
        x, y = hx - 4, hy - 2
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=M)
        d.point((x - 1, y - 1), fill=Gl)
        burst(d, x, y, 5, 7, 4, M, 45)
    elif k == 'raise':
        x, y = hx, hy - 7
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=M)
        d.ellipse((x - 2, y - 3, x + 1, y), fill=Gl)
        burst(d, x, y, 6, 8, 8, Gl, 22)
    elif k == 'release':
        x, y = hx - 3, hy
        d.polygon([(x, y - 3), (x - 12, y - 2), (x - 17, y), (x - 12, y + 2), (x, y + 3)], fill=M)
        d.line((x - 1, y, x - 13, y), fill=Gl)
    elif k == 'buff':
        (x0, y0), (x1, y1) = J['pt'](3, 4), J['pt'](21, 28)
        for i, (x, y) in enumerate(((x0 - 3, y0 + 14), (x1 + 3, y0 + 18), (x0 - 1, y0 + 2), (x1 + 1, y0 + 6))):
            d.line((x, y + 3, x, y - 2), fill=Gl if i % 2 else M)
            d.point((x, y - 4), fill=Gl)
    elif k == 'finisher':
        x, y = hx - 4, hy
        d.arc((x - 26, y - 26, x + 8, y + 10), 125, 245, fill=M, width=3)
        d.arc((x - 25, y - 25, x + 7, y + 9), 132, 238, fill=Gl, width=1)
        star(d, x - 20, y - 18, 2, Gl)
        star(d, x - 12, y + 9, 2, Gl)

