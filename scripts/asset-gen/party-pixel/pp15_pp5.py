"""pp15_pp5 — retro2003 b5(Monster3) 파티원 15칸 시트 공용 엔진. 걷기 칩 픽셀을 **확대 없이(칩 × 1)** 몸으로 쓴다.

규격(RetroPartyPixelSheet·partyPixelSheets.ts): 셀 48(칩 몸이 44px 넘는 것만 64), 3열×5행, 왼쪽을 본다, 바닥 기준선 cell-4, 알파 0/255, ≤16색.
  행0 idle_a idle_b idle_c / 행1 windup move attack / 행2 recover hit dead /
  행3 cast_charge cast_raise cast_release / 행4 leap buff finisher
크기: 사람 파티원 전투 도트(칩 × 1, 48칸 안 몸 약 24px)와 같은 배율 — 칩 실루엣이 그대로 전투 몸이다.

  1. base      Monster3.png 칩의 **행 3(왼쪽 보기)** 가운데 칸(24×32)을 그대로 쓴다. 칩 팔레트만 ≤15색으로 줄인다(가장 어두운 외곽선 색 고정).
               ※ Monster3 칩 행 순서는 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽(RPG Maker 2000 규약). mirror=True 면 다른 행을 좌우 반전해 쓴다.
  2. 부위      칩 좌표 다각형으로 부위(머리·날개·팔·꼬리…)를 잘라 피벗을 둔다. 나머지는 body.
  3. 자세      칸마다 부위 (dx, dy, 도) + 전신 g=(dx, dy, 기울기) + br(호흡: breath_y 위를 눌러 내림/늘림).
               종 파일의 이동량은 칩 × 2 시절 값으로 적혀 있고 엔진이 절반(0 이 아니면 최소 1)으로 줄인다 — MOVE_SCALE.
  4. 효과      fx 콜백은 2배 캔버스에 그리고(J['pt'] 도 2배 좌표) 엔진이 선을 살리며 절반으로 줄인 뒤 외곽선을 두른다. 색은 캐릭터 팔레트 안에서만.
  5. build     15칸 시트 저장 + 검사(크기·알파·≤16색·빈 칸·서로 다름·바닥선·칸 경계) + 확인판(칩 · 사람 파티원 actor1-0 · 15칸, 같은 배율).
"""
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from PIL import Image, ImageDraw, ImageOps  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = ROOT / 'public/assets/easyrpg/charset/Monster3.png'
HUMAN = ROOT / 'public/assets/generated/charset-battlers/actor1-0.png'
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/pp5'
NAMES15 = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
           'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
BG = (32, 40, 64, 255)
T = (0, 0, 0, 0)
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
MOVE_SCALE = 0.5  # 종 파일 이동량(칩 × 2 기준) → 칩 × 1


# ---------------------------------------------------------------- 색
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
    uniq = sorted({c for _, c in colors}, key=lambda c: -sum(n for n, d in colors if d == c))
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
        acc = [[0, 0, 0, 0] for _ in cent]
        for n, c in colors:
            a = acc[min(range(len(cent)), key=lambda j: dist(c, cent[j]))]
            a[0] += c[0] * n; a[1] += c[1] * n; a[2] += c[2] * n; a[3] += n
        cent = [c if (c in keep or not a[3]) else (round(a[0] / a[3]), round(a[1] / a[3]), round(a[2] / a[3])) for c, a in zip(cent, acc)]
    return [tuple(c) for c in cent]


# ---------------------------------------------------------------- 칩
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


def opaque(px, w, h, x, y):
    return 0 <= x < w and 0 <= y < h and px[x, y][3] > 0


def quantize(im, k):
    px = im.load()
    w, h = im.size
    cols = [(n, c[:3]) for n, c in im.getcolors(w * h) if c[3]]
    darkest = min((c for _, c in cols), key=lum)
    pal = kmeans(cols, k, [darkest]) if len({c for _, c in cols}) > k else sorted({c for _, c in cols})
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                px[x, y] = nearest(px[x, y][:3], pal) + (255,)
    return pal, darkest


def base(S):
    c = chip_cell(S['chip'], S.get('row', 3), S.get('col', 1))
    if S.get('mirror'):
        c = ImageOps.mirror(c)
    ImageDraw.Draw(c).rectangle((0, 0, 0, 0), fill=T)
    px = c.load()
    for y in S.get('drop', ()):
        for x in range(24):
            px[x, y] = T
    if S.get('clean'):
        S['clean'](c)
    chip = c.copy()
    pal, dark = quantize(c, S.get('colours', 15))
    return c, pal, dark, chip


# ---------------------------------------------------------------- 부위·변환
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


def cut(im, parts):
    """parts: [(name, poly, pivot)] 칩 좌표. 앞선 부위가 먼저 가진다. 나머지는 'body'."""
    w, h = im.size
    src = im.load()
    layers = {n: Image.new('RGBA', im.size) for n, _, _ in parts}
    layers['body'] = Image.new('RGBA', im.size)
    lp = {n: L.load() for n, L in layers.items()}
    for y in range(h):
        for x in range(w):
            if not src[x, y][3]:
                continue
            for n, poly, _ in parts:
                if inside((x + .5, y + .5), poly):
                    lp[n][x, y] = src[x, y]
                    break
            else:
                lp['body'][x, y] = src[x, y]
    return layers, {n: p for n, _, p in parts}


def rot(im, deg, pivot):
    """RotSprite 축약: 3배 최근접 확대 → 회전 → 칸 가운데 표본. 새 색이 생기지 않고 1px 선이 덜 끊긴다."""
    if not deg:
        return im
    k = 3
    w, h = im.size
    up = im.resize((w * k, h * k), Image.Resampling.NEAREST)
    up = up.rotate(deg, resample=Image.Resampling.NEAREST, center=(pivot[0] * k, pivot[1] * k))
    out = Image.new('RGBA', im.size)
    s, d = up.load(), out.load()
    for y in range(h):
        for x in range(w):
            d[x, y] = s[x * k + 1, y * k + 1]
    return out


def shift(im, dx, dy):
    out = Image.new('RGBA', im.size)
    out.paste(im, (int(dx), int(dy)), im)
    return out


def smear_shift(im, dx, dy):
    """붙어 있는 부위(머리·다리)를 옮길 때 원래 자리부터 끌어 늘린다 — 목·허리에 틈이 안 생긴다."""
    out = Image.new('RGBA', im.size)
    n = max(abs(int(dx)), abs(int(dy)))
    for k in range(n + 1):
        f = k / n if n else 1
        out.alpha_composite(shift(im, round(dx * f), round(dy * f)))
    return out


def breath(im, ycut, k):
    """ycut 줄 위를 k px 아래로 누른다(k<0 면 위로 늘리고 ycut 줄을 반복해 채운다)."""
    if not k:
        return im
    w, h = im.size
    top = im.crop((0, 0, w, ycut))
    out = im.copy()
    ImageDraw.Draw(out).rectangle((0, 0, w, ycut - 1), fill=T)
    out.alpha_composite(top, (0, k))
    if k < 0:
        line = im.crop((0, ycut - 1, w, ycut))
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
        row = im.crop((0, y, w, y + 1))
        out.paste(row, (round(s * (py - y) / 64), y), row)
    return out


def rpt(pt, deg, piv):
    a = math.radians(-deg)
    x, y = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + x * math.cos(a) - y * math.sin(a), piv[1] + x * math.sin(a) + y * math.cos(a))


def half(v):
    """이동량 절반. 0 이 아니면 최소 1(칸끼리 달라야 하므로)."""
    if not v:
        return 0
    r = abs(v) * MOVE_SCALE
    return int(math.copysign(max(1, int(r + 0.5)), v))


def clean_isolated(im):
    w, h = im.size
    px = im.load()
    kill = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and not any(opaque(px, w, h, x + a, y + b) for a, b in N4)]
    for q in kill:
        px[q] = T


def dilate_outline(layer, colour):
    w, h = layer.size
    a = layer.getchannel('A').load()
    out = Image.new('RGBA', layer.size)
    o = out.load()
    for y in range(h):
        for x in range(w):
            if not a[x, y] and any(0 <= x + i < w and 0 <= y + j < h and a[x + i, y + j] for i, j in N4):
                o[x, y] = colour
    return out


def reduce2(im):
    """2배 효과 층을 절반으로: 2×2 칸에 칠한 픽셀이 하나라도 있으면 그 색(1px 선이 살아남는다)."""
    w, h = im.size[0] // 2, im.size[1] // 2
    s = im.load()
    out = Image.new('RGBA', (w, h))
    o = out.load()
    for y in range(h):
        for x in range(w):
            for q in ((2 * x, 2 * y), (2 * x + 1, 2 * y), (2 * x, 2 * y + 1), (2 * x + 1, 2 * y + 1)):
                if s[q][3]:
                    o[x, y] = s[q]
                    break
    return out


def settle(im, cell, ground):
    """칸 경계 안으로 밀고, ground 면 바닥 픽셀을 cell-4 에 맞춘다. 경계 1px·바닥 아래 줄은 비운다."""
    box = im.getbbox()
    if not box:
        return im
    dx = 1 - box[0] if box[0] < 1 else (cell - 1 - box[2] if box[2] > cell - 1 else 0)
    if box[2] - box[0] > cell - 2:
        dx = 0
    dy = (cell - 3) - box[3] if (ground or box[3] > cell - 3) else 0
    if box[1] + dy < 1:
        dy = 1 - box[1]
    out = Image.new('RGBA', im.size)
    out.paste(im, (dx, dy))
    d = ImageDraw.Draw(out)
    d.rectangle((0, 0, cell - 1, 0), fill=T)
    d.rectangle((0, 0, 0, cell - 1), fill=T)
    d.rectangle((cell - 1, 0, cell - 1, cell - 1), fill=T)
    d.rectangle((0, cell - 3, cell - 1, cell - 1), fill=T)
    return out


# ---------------------------------------------------------------- 자세 엔진
# 기본 자세(종 파일 poses 가 칸별로 덮어쓴다). 이동량은 칩 × 2 기준 값 — 엔진이 절반으로 줄인다.
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
FX_KEYS = {'impact', 'hurt', 'charge', 'raise', 'release', 'buff', 'finisher'}


class Poser:
    def __init__(self, S):
        self.S = S
        self.cell = S['cell']
        self.body, self.pal, self.dark, self.chip = base(S)
        self.pal_sorted = sorted(self.pal, key=lum)
        cell = self.cell
        self.W = cell * 2  # 여유 작업 캔버스, 셀은 가운데 (cell/2, cell/2) 부터
        box = self.body.getbbox()
        o = cell // 2
        self.off = (o + cell // 2 - (box[0] + box[2]) // 2 + half(S.get('ox', 0)), o + (cell - 3) - box[3] + half(S.get('oy', 0)))
        self.layers = {}
        layers, piv = cut(self.body, S.get('parts', []))
        for n, L in layers.items():
            P = Image.new('RGBA', (self.W, self.W))
            P.alpha_composite(L, self.off)
            self.layers[n] = P
        self.piv = {n: (p[0] + self.off[0], p[1] + self.off[1]) for n, p in piv.items()}
        self.ground_y = o + cell - 3
        self.cx = o + cell // 2
        self.breath_y = self.off[1] + S.get('breath_y', 16)
        self.roles = S.get('roles', {})

    # 팔레트 안의 색
    def c(self, hexcol):
        return nearest(tuple(bytes.fromhex(hexcol)), self.pal) + (255,)

    def rank(self, i):
        return self.pal_sorted[i] + (255,)

    def spec(self, name):
        P = dict(GENERIC[name])
        P.update(self.S.get('poses', {}).get(name, {}))
        out = {}
        for k, v in P.items():
            if isinstance(v, tuple) and k not in FX_KEYS:
                v = tuple(half(x) if i < 2 else x for i, x in enumerate(v))
            elif k == 'br':
                v = half(v)
            out[k] = v
        return out

    def track(self, x, y, part, J):
        """칩 좌표 점 → 부위·전신 변환을 거친 작업 캔버스 좌표."""
        p = (self.off[0] + x, self.off[1] + y)
        if part and part in J['info']:
            t, pv = J['info'][part]
            dx, dy, deg = (tuple(t) + (0, 0, 0))[:3]
            p = rpt(p, deg, pv)
            p = (p[0] + dx, p[1] + dy)
        if p[1] < self.breath_y:
            p = (p[0], p[1] + J['P'].get('br', 0))
        gdx, gdy, gs = J['g']
        return (int(round(p[0] + round(gs * (self.ground_y - p[1]) / 64) + gdx)), int(round(p[1] + gdy)))

    def render(self, name):
        P = self.spec(name)
        body = Image.new('RGBA', (self.W, self.W))
        info = {}
        attached = self.S.get('attached', ('head', 'legs'))
        for n in self.S.get('order', list(self.layers)):
            t = P.get(n, P.get(self.roles.get(n, n), (0, 0, 0)))
            pv = self.piv.get(n, (self.cx, self.ground_y))
            dx, dy, deg = (tuple(t) + (0, 0, 0))[:3]
            L = rot(self.layers[n], deg, pv)
            L = smear_shift(L, dx, dy) if n in attached and max(abs(dx), abs(dy)) <= 2 else shift(L, dx, dy)
            info[n] = (t, pv)
            body.alpha_composite(L)
        gdx, gdy, gs = (tuple(P.get('g', (0, 0, 0))) + (0, 0, 0))[:3]
        body = shift(shear(breath(body, self.breath_y, P.get('br', 0)), gs, self.ground_y), gdx, gdy)
        J = dict(P=P, info=info, g=(gdx, gdy, gs), name=name)
        if P.get('dead'):
            body = self.dead(body)
        canvas = Image.new('RGBA', (self.W, self.W))
        f = self.S.get('fx')
        if f and not P.get('dead'):
            # 효과는 2배 캔버스에 그리고 줄인다 — 종 파일 효과 크기가 칩 × 2 기준이므로.
            J2 = dict(J)
            J2['pt'] = lambda x, y, part=None: tuple(v * 2 for v in self.track(x, y, part, J))
            L2 = Image.new('RGBA', (self.W * 2, self.W * 2))
            f(self, ImageDraw.Draw(L2), J2)
            L = reduce2(L2)
            ol = dilate_outline(L, self.dark + (255,))
            ba, op = body.getchannel('A').load(), ol.load()
            for y in range(self.W):
                for x in range(self.W):
                    if op[x, y][3] and ba[x, y]:
                        op[x, y] = T
            canvas.alpha_composite(body)
            canvas.alpha_composite(ol)
            canvas.alpha_composite(L)
        else:
            canvas.alpha_composite(body)
        o = self.cell // 2
        return canvas.crop((o, o, o + self.cell, o + self.cell))

    def dead(self, canvas):
        mode = self.S.get('dead', 'lie')
        box = canvas.getbbox()
        body = canvas.crop(box)
        if mode == 'lie':
            body = body.transpose(Image.Transpose.ROTATE_270)  # 머리가 뒤(오른쪽)로 넘어간다
        elif mode == 'slump':
            w, h = body.size
            keep = [y for y in range(h) if y >= h * 0.45 or y % 2 == 0]
            nb = Image.new('RGBA', (w, len(keep)))
            for j, y in enumerate(keep):
                nb.paste(body.crop((0, y, w, y + 1)), (0, j))
            body = nb
        px = body.load()
        w, h = body.size
        for y in range(h):
            for x in range(w):
                if px[x, y][3] and lum(px[x, y]) > 0.55:
                    px[x, y] = step(px[x, y][:3], self.pal, False) + (255,)
        out = Image.new('RGBA', canvas.size)
        out.alpha_composite(body, (max(0, self.cx - w // 2 + half(self.S.get('dead_dx', 4))), self.ground_y + 1 - h))
        return out

    def sheet(self):
        frames = {n: self.render(n) for n in NAMES15}
        air = {n for n in NAMES15 if self.spec(n).get('air')} | set(self.S.get('airborne', ()))
        return build(self.S['name'], self.cell, frames, self.chip, ground=self.S.get('ground', True), airborne=air)


# ---------------------------------------------------------------- 효과 도구(2배 캔버스 좌표)
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


def fx_common(R, d, J, main, glow, hand, part='arm'):
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


# ---------------------------------------------------------------- 저장·검사·확인판
def build(chip, cell, frames, src_chip, ground=True, airborne=()):
    """frames: {name: RGBA cell×cell}. ground=True 면 airborne 에 없는 칸을 바닥선에 맞춘다(dead 는 늘 바닥)."""
    out = []
    for n in NAMES15:
        im = frames[n]
        clean_isolated(im)
        out.append(settle(im, cell, (ground and n not in airborne) or n == 'dead'))
    sheet = Image.new('RGBA', (cell * 3, cell * 5))
    for i, im in enumerate(out):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    errs = []
    palette = {c for _, c in sheet.getcolors(cell * cell * 15) if c[3]}
    if len(palette) > 16:
        errs.append(f'colours {len(palette)}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errs.append('alpha')
    rep = {'chip': chip, 'cell': cell, 'rows': 5, 'scale': 1, 'colours': len(palette), 'baseline': cell - 4, 'frames': {}}
    for n, im in zip(NAMES15, out):
        box = im.getbbox()
        if not box:
            errs.append(f'{n} empty')
            continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= cell - 3):
            errs.append(f'{n} bounds {box}')
        if ((ground and n not in airborne) or n == 'dead') and box[3] != cell - 3:
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
    print(f'{chip} cell {cell} size {sheet.size} colours {len(palette)} idle {rep["frames"].get("idle_a", {}).get("size")} errors', errs or 'none')
    if errs:
        sys.exit(1)
    return sheet


def board(chip, cell, sheet, src_chip, path):
    """같은 배율(4배)로: 걷기 칩 · 사람 파티원 actor1-0 대기 칸 · 15칸 시트."""
    Z = 4
    cw = cell * Z
    left = 48 * Z
    W, H = left + 12 + cw * 3, 20 + cw * 5
    b = Image.new('RGB', (W, H), BG[:3])
    d = ImageDraw.Draw(b)

    def put(im, x, y):
        bg = Image.new('RGBA', im.size, BG)
        bg.alpha_composite(im)
        b.paste(bg.convert('RGB').resize((im.width * Z, im.height * Z), Image.Resampling.NEAREST), (x, y))

    put(src_chip, 12 * Z, 20)
    d.text((4, 4), f'{chip} walk chip x{Z}', fill='#d6cddc')
    human = Image.open(HUMAN).convert('RGBA').crop((0, 0, 48, 48))
    put(human, 0, 20 + 36 * Z)
    d.text((4, 20 + 36 * Z - 14), f'actor1-0 idle x{Z}', fill='#d6cddc')
    sb = Image.new('RGBA', sheet.size, BG)
    sb.alpha_composite(sheet)
    b.paste(sb.convert('RGB').resize((cw * 3, cw * 5), Image.Resampling.NEAREST), (left + 12, 20))
    d.text((left + 16, 4), f'sheet x{Z} (cell {cell})', fill='#d6cddc')
    for i, n in enumerate(NAMES15):
        x, y = left + 12 + i % 3 * cw, 20 + i // 3 * cw
        d.rectangle((x, y, x + cw - 1, y + cw - 1), outline='#586078')
        d.line((x + 2, y + (cell - 3) * Z, x + cw - 3, y + (cell - 3) * Z), fill='#39465e')
        d.text((x + 4, y + 3), n, fill='#d6cddc')
    b.save(path)

