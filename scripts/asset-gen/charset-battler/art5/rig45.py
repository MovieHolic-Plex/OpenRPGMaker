"""People 걷기 칩 → 도트 전투 포즈 공용 장치(p4·p5 묶음, 2026-09-29).

People1~5 는 Actor 처럼 손도트 원본(art2/art3)이 없다. 걷기 칩의 왼쪽 방향 세 칸(24×32)을 몸으로 삼고,
팔·무기·소품·빛만 좌표로 새로 찍는다. 이미지 생성·축소·보간 없음(정수 좌표의 선·다각형·픽셀만).

- 칩 id: people<N>-<i>. cb_lib.SHEETS 에 People 을 **메모리에서만** 등록한다(공용 cb_lib.py 는 건드리지 않는다).
- 몸: 대기 칸(왼쪽 패턴 1)의 몸통 경계를 기준 오프셋으로 고정해 모든 포즈가 같은 자리에 선다(대기 높이 = 칩 높이).
- 팔: 어깨 → 팔꿈치 → 손을 소매색 굵은 선 + 살색 손으로 찍는다. 옛 팔 도트는 지우지 않는다(뒷팔로 남는다).
- 소품: 방향(0=왼쪽, 45=왼위, 90=위, 180=오른쪽, 270=아래)을 정수 벡터 회전으로 찍는다(PIL 다각형/선, 안티에일리어싱 없음).
"""
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = HERE.parent
sys.path.insert(0, str(LIB))
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw  # noqa: E402
import cb_lib  # noqa: E402
import weapons  # noqa: E402
from cb_lib import CAST_TYPES, CELL, GROUND_Y, POSES, ROOT, SRC_DIR, walk_frame  # noqa: E402

for _n in range(1, 6):
    cb_lib.SHEETS.setdefault(f"people{_n}", f"People{_n}.png")

INK = (30, 24, 34, 255)
WHITE = (255, 255, 255, 255)
_CACHE = {}


def rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def frames(cid):
    if cid not in _CACHE:
        L = [walk_frame(cid, "left", p) for p in range(3)]
        D = [walk_frame(cid, "down", p) for p in range(3)]
        _CACHE[cid] = dict(L=L, D=D)
    return _CACHE[cid]


def colors(cid):
    """(skin, sleeve, dark) 를 걷기 칩에서 추정한다. 필요하면 CHAR 의 override 가 이긴다."""
    fr = frames(cid)['L'][1]
    bb = fr.getbbox()
    x0, y0, x1, y1 = bb
    h = y1 - y0
    px = fr.load()
    from collections import Counter
    skin_c, body_c, all_c = Counter(), Counter(), Counter()
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = px[x, y]
            if c[3] < 255:
                continue
            r, g, b = c[:3]
            all_c[c[:3]] += 1
            if y < y0 + h * 0.66 and r > 170 and r > g > b and r - b > 40 and g > 100:
                skin_c[c[:3]] += 1
            elif y >= y0 + h * 0.6:
                body_c[c[:3]] += 1
    skin = skin_c.most_common(1)[0][0] if skin_c else (231, 160, 109)
    dark = min(all_c, key=lambda c: sum(c))
    body = [c for c, _ in body_c.most_common(8) if c != skin and sum(c) > 120 and abs(c[0]-skin[0])+abs(c[1]-skin[1])+abs(c[2]-skin[2]) > 60]
    sleeve = body[0] if body else (120, 120, 120)
    return skin + (255,), sleeve + (255,), dark + (255,)


# ══════════════════════════════════════════════════════════════════════════════
# 몸 변형(제자리 24×32 → 40×32 캔버스, 몸 원점 BX=8)
BX = 8
CANVAS = (40, 32)


def _canvas(sprite):
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    out.alpha_composite(sprite, (BX, 0))
    return out


def shear(sprite, amount):
    """위로 갈수록 amount 만큼 가로로 민다(음수 = 왼쪽 = 앞으로 숙임). 40×32 캔버스."""
    sp = _canvas(sprite)
    bb = sprite.getbbox()
    if not bb or amount == 0:
        return sp
    y0, y1 = bb[1], bb[3]
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    for y in range(CANVAS[1]):
        t = (y1 - 1 - y) / max(1, (y1 - y0))
        s = round(amount * max(0.0, t))
        out.paste(sp.crop((0, y, CANVAS[0], y + 1)), (s, y))
    return out


def crouch(sprite, rows):
    """다리 구간(아래 35%)에서 rows 줄을 뺀다(발 위치는 그대로)."""
    sp = sprite if sprite.size == CANVAS else _canvas(sprite)
    bb = sp.getbbox()
    if not bb or rows <= 0:
        return sp
    x0, y0, x1, y1 = bb
    h = y1 - y0
    legs_top = y0 + int(h * 0.65)
    leg_rows = list(range(legs_top, y1))
    step = max(1, len(leg_rows) // (rows + 1))
    drop = set(leg_rows[step::step][:rows])
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    ny = y1 - 1
    for y in range(y1 - 1, -1, -1):
        if y in drop:
            continue
        out.paste(sp.crop((0, y, CANVAS[0], y + 1)), (0, ny))
        ny -= 1
    return out


def blank():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


class Rig:
    """캐릭터 하나의 몸·팔·소품 그리기. 셀 좌표(48×48, 발 y=44, 왼쪽을 본다)로 일한다."""

    def __init__(self, cid, cfg):
        self.cid = cid
        self.cfg = cfg
        fr = frames(cid)
        self.L, self.D = fr['L'], fr['D']
        x0, y0, x1, y1 = self.L[1].getbbox()
        self.mid = (x0 + x1) // 2
        self.ox = 24 - self.mid - BX        # 캔버스 → 셀 x 오프셋
        self.oy = GROUND_Y + 1 - y1        # 칩 → 셀 y 오프셋
        self.foot = y1 - 1                 # 칩 발 마지막 행
        self.top = y0
        self.skin = rgba(cfg['skin'])
        self.sleeve = rgba(cfg['sleeve'])
        self.sleeve_d = rgba(cfg['sleeve_d'])
        self.sleeve_l = rgba(cfg.get('sleeve_l', cfg['sleeve']))
        self.ink = rgba(cfg.get('ink', '#3a2226'))
        sh = cfg.get('shoulder', (0, 0))
        self.shoulder0 = (24 + sh[0], 34 + sh[1])

    # ---- 몸
    def body(self, base='L1', lean=0, crouch_rows=0, dx=0, dy=0, lie=False):
        if base == 'lie':
            sp = self.D[1].rotate(-90, expand=True)
            cell = blank()
            bb = sp.getbbox()
            ox = 24 - (bb[0] + bb[2]) // 2 + dx
            oy = GROUND_Y + 1 - bb[3] + dy
            cell.alpha_composite(sp, (ox, oy))
            return cell, (24 + dx, 40 + dy)
        src = {'L0': self.L[0], 'L1': self.L[1], 'L2': self.L[2], 'D1': self.D[1], 'D0': self.D[0], 'D2': self.D[2]}[base]
        sp = shear(src, lean) if lean else _canvas(src)
        if crouch_rows:
            sp = crouch(sp, crouch_rows)
        cell = blank()
        cell.alpha_composite(sp, (self.ox + dx, self.oy + dy))
        sx = self.shoulder0[0] + round(lean * 0.38) + dx
        sy = self.shoulder0[1] + crouch_rows + dy
        if base.startswith('D'):
            sx = 24 + dx
        return cell, (sx, sy)

    # ---- 그리기 도구
    @staticmethod
    def put(im, x, y, c, over=True):
        x, y = int(round(x)), int(round(y))
        if 0 < x < 47 and 0 < y <= 45 and (over or not im.getpixel((x, y))[3]):
            im.putpixel((x, y), c)

    def line(self, im, a, b, c, over=True, w=1):
        d = ImageDraw.Draw(im)
        tmp = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(tmp).line([(round(a[0]), round(a[1])), (round(b[0]), round(b[1]))], fill=c, width=w)
        px = tmp.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][3]:
                    self.put(im, x, y, c, over)

    def arm(self, im, S, H, hand=True, sleeve=None, elbow=None, w=2):
        """어깨 S 에서 손 H 까지 굵은 소매 선 + 살색 손. 팔꿈치는 아래쪽으로 살짝 굽힌다."""
        sleeve = sleeve or self.sleeve
        E = elbow or ((S[0] + H[0]) / 2, (S[1] + H[1]) / 2 + (1 if abs(H[0] - S[0]) + abs(H[1] - S[1]) > 8 else 0))
        # 윤곽
        for a, b in ((S, E), (E, H)):
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                self.line(im, (a[0] + ox, a[1] + oy), (b[0] + ox, b[1] + oy), self.ink, over=True, w=w)
        for a, b in ((S, E), (E, H)):
            self.line(im, a, b, sleeve, w=w)
        # 소매 밝은 선
        if self.sleeve_l != sleeve:
            self.line(im, (S[0], S[1] - 1), (E[0], E[1] - 1), self.sleeve_l, w=1)
        if hand:
            hx, hy = round(H[0]), round(H[1])
            for x in range(hx - 1, hx + 1):
                for y in range(hy - 1, hy + 1):
                    self.put(im, x, y, self.skin)
            for (x, y) in ((hx - 2, hy - 1), (hx - 2, hy), (hx + 1, hy - 1), (hx + 1, hy), (hx - 1, hy - 2), (hx, hy - 2), (hx - 1, hy + 1), (hx, hy + 1)):
                self.put(im, x, y, self.ink, over=False)
        return E


# ══════════════════════════════════════════════════════════════════════════════
# 소품 (정수 좌표 다각형·선·원. 각도 0=왼쪽(앞), 45=왼위, 90=위, 180=오른쪽, 270=아래, 315=왼아래)
PC = dict(
    ink=(30, 24, 34, 255), iron=(58, 62, 74, 255), iron_l=(132, 140, 156, 255), steel_d=(35, 43, 59, 255),
    steel=(99, 124, 145, 255), steel_l=(187, 208, 217, 255), steel_h=(244, 249, 237, 255),
    wood_d=(68, 44, 39, 255), wood=(139, 88, 49, 255), wood_l=(190, 130, 72, 255),
    brass=(217, 169, 87, 255), brass_d=(150, 106, 40, 255), brass_l=(255, 226, 130, 255),
    rope=(196, 158, 96, 255), rope_d=(140, 100, 60, 255),
    paper=(244, 240, 226, 255), paper_d=(196, 192, 208, 255), red=(200, 44, 52, 255), red_d=(130, 24, 34, 255),
    rose=(226, 84, 112, 255), straw=(226, 184, 92, 255), straw_d=(168, 122, 52, 255), straw_l=(255, 232, 150, 255),
    green=(60, 150, 70, 255), green_d=(28, 88, 44, 255), blue=(54, 104, 214, 255), blue_d=(26, 50, 130, 255),
    yellow=(255, 214, 64, 255), yellow_d=(196, 140, 24, 255), white=(255, 255, 255, 255),
    gold=(253, 214, 96, 255), teal=(74, 233, 208, 255), violet=(165, 88, 224, 255), violet_d=(92, 44, 120, 255),
    cyan=(112, 203, 255, 255), orange=(255, 148, 50, 255), pink=(255, 144, 199, 255), silver=(214, 222, 236, 255),
)


class Painter:
    """무기 좌표계: u = 손에서 끝 쪽(앞)으로, v = 그 옆(0도일 때 위쪽이 +v... 아래 vec 참고). 그립 = (gx, gy)."""

    def __init__(self, im, grip, theta, rig=None):
        self.im, self.g, self.th = im, grip, math.radians(theta)
        self.d = (-math.cos(self.th), -math.sin(self.th))
        self.v = (math.sin(self.th), -math.cos(self.th))
        self.layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        self.dr = ImageDraw.Draw(self.layer)

    def P(self, u, v=0.0):
        return (self.g[0] + u * self.d[0] + v * self.v[0], self.g[1] + u * self.d[1] + v * self.v[1])

    def _r(self, pts):
        return [(int(round(x)), int(round(y))) for x, y in pts]

    def poly(self, pts, c):
        self.dr.polygon(self._r([self.P(u, v) for u, v in pts]), fill=PC.get(c, c))

    def seg(self, u0, v0, u1, v1, c, w=1):
        a, b = self._r([self.P(u0, v0), self.P(u1, v1)])
        self.dr.line([a, b], fill=PC.get(c, c), width=1)
        if w >= 2:
            # 폭 2: 수직 방향으로 한 줄 더(정수 이동)
            ox = round(self.v[0]) if abs(self.v[0]) > 0.5 else 0
            oy = round(self.v[1]) if abs(self.v[1]) > 0.5 and ox == 0 else 0
            if ox == 0 and oy == 0:
                oy = 1
            self.dr.line([(a[0] + ox, a[1] + oy), (b[0] + ox, b[1] + oy)], fill=PC.get(c, c), width=1)

    def disc(self, u, v, r, c):
        x, y = self.P(u, v)
        if r < 0.6:
            self.dr.point((int(round(x)), int(round(y))), fill=PC.get(c, c))
        else:
            self.dr.ellipse((round(x - r), round(y - r), round(x + r), round(y + r)), fill=PC.get(c, c))

    def dot(self, u, v, c):
        x, y = self.P(u, v)
        self.dr.point((int(round(x)), int(round(y))), fill=PC.get(c, c))

    def ring(self, u, v, r, c):
        x, y = self.P(u, v)
        self.dr.ellipse((round(x - r), round(y - r), round(x + r), round(y + r)), outline=PC.get(c, c))

    def commit(self, outline=True, over=True, ink=None):
        ink = ink or PC['ink']
        lp = self.layer.load()
        W, H = self.layer.size
        pts = {(x, y) for y in range(H) for x in range(W) if lp[x, y][3]}
        if outline:
            body = self.im.load()
            for (x, y) in pts:
                for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + ex, y + ey)
                    if q not in pts and 0 < q[0] < 47 and 0 < q[1] <= 45 and not body[q[0], q[1]][3]:
                        self.im.putpixel(q, ink)
        for (x, y) in pts:
            if 0 < x < 47 and 0 < y <= 45:
                self.im.putpixel((x, y), lp[x, y])
        return pts


def draw_anchor(p):
    p.seg(-6, 0, 12, 0, 'iron', 2)
    p.seg(-6, -1, 12, -1, 'iron_l')
    p.ring(-8.5, 0, 2.5, 'iron_l')
    p.seg(-4, -4, -4, 4, 'wood', 2)
    p.dot(-4, -4, 'wood_l')
    for s in (-1, 1):
        p.seg(11, 0, 13, s * 3, 'iron', 2)
        p.seg(13, s * 3, 12, s * 6, 'iron', 2)
        p.seg(12, s * 6, 9, s * 6, 'iron', 2)
        p.poly([(9, s * 4.5), (7, s * 6.5), (9, s * 7.5)], 'iron_l')
        p.dot(10, s * 6, 'steel_l')
    p.dot(12, -1, 'steel_h')


def draw_shakujo(p):
    p.seg(-9, 0, 15, 0, 'wood')
    p.seg(-9, -1, 15, -1, 'wood_l')
    p.seg(-9, 1, 14, 1, 'wood_d')
    p.ring(17, 0, 3.2, 'brass')
    p.seg(15, 0, 15, 0, 'brass_l')
    for s in (-1, 1):
        p.disc(17, s * 4, 1, 'brass_l')
    p.dot(17, 0, 'brass_l')
    p.dot(21, 0, 'brass')
    p.dot(20, 0, 'brass_d')


def draw_fan(p, spread=52, rad=11):
    """펼친 부채: 손잡이 u=0..2, 살대가 u=2 에서 부챗살로."""
    pts = [(2, 0)]
    for i in range(-4, 5):
        a = math.radians(spread * i / 4)
        pts.append((2 + rad * math.cos(a), rad * math.sin(a)))
    p.poly(pts, 'paper')
    for i in range(-4, 5):
        a = math.radians(spread * i / 4)
        p.seg(2, 0, 2 + rad * math.cos(a), rad * math.sin(a), 'paper_d' if i % 2 else 'brass')
    # 장미빛 가장자리
    for i in range(-4, 4):
        a0, a1 = math.radians(spread * i / 4), math.radians(spread * (i + 1) / 4)
        p.seg(2 + rad * math.cos(a0), rad * math.sin(a0), 2 + rad * math.cos(a1), rad * math.sin(a1), 'rose')
    p.seg(-2, 0, 2, 0, 'brass_d')
    p.dot(-2, 0, 'red')
    p.disc(2, 0, 0.6, 'red')


def draw_javelin(p):
    p.seg(-9, 0, 17, 0, 'wood')
    p.seg(-9, 1, 17, 1, 'wood_d')
    p.poly([(16, 0), (18, 2), (23, 0), (18, -2)], 'steel_l')
    p.seg(17, 0, 22, 0, 'steel_h')
    p.seg(16, 1, 18, 1, 'steel')
    p.poly([(-9, 0), (-12, 2.5), (-7, 0), (-12, -2.5)], 'red')
    p.seg(-1, 0, 1, 0, 'rope')


def draw_cross_staff(p):
    p.seg(-9, 0, 12, 0, 'wood')
    p.seg(-9, 1, 12, 1, 'wood_d')
    p.seg(-9, -1, 12, -1, 'wood_l')
    p.seg(12, 0, 20, 0, 'steel_l', 2)
    p.seg(16, -4, 16, 3, 'steel_l', 2)
    p.seg(12, 0, 20, 0, 'steel_h')
    p.dot(16, -3, 'steel_h')
    p.dot(16, 0, 'gold')
    p.dot(21, 0, 'steel')
    p.dot(16, 4, 'steel_d')
    p.dot(-1, 1, 'gold')


def draw_marotte(p):
    """광대 지팡이(마로트): 줄무늬 막대 + 방울 달린 세 갈래 모자 머리."""
    for i, u in enumerate(range(-8, 9)):
        p.dot(u, 0, 'red' if (i // 2) % 2 else 'yellow')
        p.dot(u, 1, 'red_d' if (i // 2) % 2 else 'yellow_d')
    p.disc(11, 0, 2.2, 'blue')
    p.dot(10, -1, 'cyan')
    for s in (-1, 1):
        p.seg(11, s * 2, 12, s * 4, 'blue', 1)
        p.disc(12, s * 5, 1.2, 'yellow')
        p.dot(12, s * 5, 'yellow_d')
    p.disc(14, 0, 1.2, 'red')
    p.dot(14, 0, 'yellow')


def draw_wrench(p):
    p.seg(-5, 0, 8, 0, 'iron', 2)
    p.seg(-5, -1, 8, -1, 'iron_l')
    p.seg(-5, 0, -2, 0, 'red', 2)
    p.seg(-5, -1, -2, -1, 'rose')
    p.poly([(8, -3), (13, -3), (13, -1), (11, -1), (11, 1), (13, 1), (13, 3), (8, 3)], 'iron')
    p.seg(9, -3, 13, -3, 'iron_l')
    p.dot(6, 0, 'brass_l')
    p.dot(7, 1, 'brass')


def draw_gohei(p):
    p.seg(-8, 0, 12, 0, 'paper')
    p.seg(-8, 1, 12, 1, 'paper_d')
    p.seg(9, -1, 9, 1, 'red', 1)
    p.dot(9, 0, 'red_d')
    for s in (-1, 1):
        # 종이 술(시데): 지그재그 번개 모양
        pts = [(10, s * 1), (11, s * 3), (12, s * 2), (13, s * 4), (14, s * 3), (15, s * 5)]
        for a, b in zip(pts, pts[1:]):
            p.seg(a[0], a[1], b[0], b[1], 'white', 1)
        p.dot(15, s * 5, 'paper_d')
        p.dot(12, s * 2, 'paper_d')
    p.dot(13, 0, 'white')
    p.dot(14, 0, 'paper')


def draw_scimitar(p):
    p.seg(-4, 0, -1, 0, 'red', 2)
    p.dot(-4, 1, 'red_d')
    p.seg(1, -3, 1, 3, 'brass', 2)
    p.dot(1, -3, 'brass_l')
    n = 15
    top, bot = [], []
    for i in range(n + 1):
        u = 2 + i
        cur = -0.032 * i * i
        w = 2.4 * (1 - i / (n + 1)) ** 0.6 + 0.6
        top.append((u, cur - w * 0.8))
        bot.append((u, cur + w * 0.5))
    p.poly(top + bot[::-1], 'steel_l')
    for i in range(2, n - 1):
        u = 2 + i
        p.dot(u, -0.032 * i * i - 1.0, 'steel_h')
        p.dot(u, -0.032 * i * i + 1.0, 'steel')
    p.dot(2 + n, -0.032 * n * n - 0.4, 'steel_h')


def draw_broom(p):
    p.seg(-11, 0, 8, 0, 'wood')
    p.seg(-11, 1, 8, 1, 'wood_d')
    p.poly([(8, -2), (10, -2), (16, -5), (16, 5), (10, 2), (8, 2)], 'straw')
    for v in (-4, -2, 0, 2, 4):
        p.seg(10, v * 0.4, 16, v, 'straw_d' if v % 4 == 0 else 'straw_l')
    p.seg(8, -2, 8, 2, 'rope_d', 1)
    p.seg(9, -2, 9, 2, 'rope', 1)
    p.dot(-11, 0, 'wood_l')


def draw_hermit_staff(p):
    pts = [(-9, 0), (-2, 0.3), (3, -0.6), (9, 0), (14, -1)]
    for a, b in zip(pts, pts[1:]):
        p.seg(a[0], a[1], b[0], b[1], 'wood')
        p.seg(a[0], a[1] + 1, b[0], b[1] + 1, 'wood_d')
    p.disc(15, -2, 1.5, 'wood_l')
    p.dot(16, -3, 'wood')
    p.seg(9, 1, 9, 3, 'rope', 1)
    p.disc(9, 5, 2, 'orange')
    p.disc(9, 7.5, 1.4, 'yellow_d')
    p.dot(8, 4.5, 'yellow')
    p.dot(9, 3.5, 'wood_d')


def draw_shield(p, r=5):
    p.disc(0, 0, r, 'iron')
    p.disc(0, 0, r - 1, 'wood')
    p.disc(0, 0, r - 2, 'wood_l')
    p.seg(-r + 1, 0, r - 1, 0, 'iron_l', 1)
    p.seg(0, -r + 1, 0, r - 1, 'iron_l', 1)
    p.disc(0, 0, 1.2, 'brass_l')


def draw_knife(p):
    p.seg(-3, 0, -1, 0, 'wood_d', 1)
    p.poly([(0, -1), (7, 0), (0, 1)], 'steel_l')
    p.seg(0, 0, 6, 0, 'steel_h')
    p.dot(0, -1, 'brass')


CUSTOM = dict(anchor=draw_anchor, shakujo=draw_shakujo, fan=draw_fan, javelin=draw_javelin, cross_staff=draw_cross_staff,
              marotte=draw_marotte, wrench=draw_wrench, gohei=draw_gohei, scimitar=draw_scimitar, broom=draw_broom,
              hermit_staff=draw_hermit_staff, shield=draw_shield, knife=draw_knife)


def _bottle(glass, liquid, cork=None, gold=False):
    def draw(p):
        # 병: 목이 위(u+), 몸통 아래. 그립은 몸통 중간.
        p.poly([(-3, -2.4), (2, -2.4), (3, -1), (3, 1), (2, 2.4), (-3, 2.4)], glass)
        p.poly([(-3, -1.6), (1, -1.6), (1, 1.6), (-3, 1.6)], liquid)
        p.seg(3, -1, 5, -1, glass)
        p.seg(3, 1, 5, 1, glass)
        p.poly([(5, -1.4), (7, -1.4), (7, 1.4), (5, 1.4)], cork or 'wood')
        p.dot(-1, -2, 'white')
        if gold:
            p.seg(3, -1, 3, 1, 'brass_l')
    return draw


def draw_cup(p):
    p.poly([(-3, -3), (3, -3), (2, 3), (-2, 3)], 'paper')
    p.seg(-3, -3, 3, -3, 'white')
    p.seg(-2, 2, 2, 2, 'paper_d')
    p.ring(0, 5, 1.5, 'paper')
    p.dot(-1, -1, 'rose')
    p.dot(1, -1, 'rose')
    for i, (u, v) in enumerate(((-4, -3), (-6, -2), (-8, -3))):
        p.dot(u, v, 'white' if i % 2 == 0 else 'paper_d')


def draw_ball(p):
    p.disc(0, 0, 2.6, 'red_d')
    p.disc(-0.5, -0.5, 2, 'red')
    p.dot(-1, -1, 'white')
    p.disc(5, -5, 2, 'blue')
    p.dot(4, -6, 'cyan')
    p.disc(-5, -6, 2, 'yellow')
    p.dot(-6, -7, 'white')


def draw_gear_item(p):
    for i in range(8):
        a = i * math.pi / 4
        p.dot(3.4 * math.cos(a), 3.4 * math.sin(a), 'brass')
    p.disc(0, 0, 2.6, 'brass_d')
    p.disc(0, 0, 2, 'brass')
    p.dot(0, 0, 'ink')
    p.dot(-1, -1, 'brass_l')


def draw_ofuda(p):
    p.poly([(-2, -4), (2, -4), (2, 4), (-2, 4)], 'paper')
    p.seg(-2, -4, 2, -4, 'white')
    p.seg(0, -3, 0, 3, 'red')
    p.dot(-1, 0, 'red')
    p.dot(1, 1, 'red')
    p.dot(-1, 3, 'red_d')


def draw_beads(p):
    for i in range(10):
        a = i * math.pi * 2 / 10
        p.disc(3.2 * math.cos(a), 3.2 * math.sin(a) + 3, 0.9, 'wood_d' if i % 2 else 'wood_l')
    p.disc(0, 7, 1.2, 'brass')


def draw_pouch(p):
    p.poly([(-3, -3), (3, -3), (4, 2), (0, 4), (-4, 2)], 'wood')
    p.seg(-3, -3, 3, -3, 'wood_l')
    p.seg(-2, -4, 2, -4, 'rope')
    p.dot(0, 0, 'wood_d')
    p.dot(-2, -1, 'wood_l')


def draw_gourd(p):
    p.disc(0, 2.5, 2.4, 'orange')
    p.disc(0, -1, 1.7, 'yellow_d')
    p.dot(-1, 2, 'yellow')
    p.dot(0, -3.5, 'wood_d')
    p.seg(0, -3, 0, -5, 'rope')


CUSTOM.update(dict(
    bottle_rum=_bottle((110, 70, 40, 255), (170, 100, 40, 255), 'wood_d'),
    bottle_pink=_bottle((246, 176, 206, 255), (240, 96, 150, 255), 'brass', gold=True),
    vial_blue=_bottle((190, 226, 255, 255), (74, 154, 255, 255), 'steel_l'),
    flask_brown=_bottle((150, 110, 70, 255), (96, 60, 34, 255), 'wood_d'),
    cup=draw_cup, ball=draw_ball, gear=draw_gear_item, ofuda=draw_ofuda, beads=draw_beads, pouch=draw_pouch, gourd=draw_gourd))


def stamp_prop(im, kind, angle, hand, outline=True):
    """소품을 손(hand) 자리에 찍는다. weapons.py 의 표준 무기는 그 격자를 쓴다. 찍은 좌표 집합을 돌려준다."""
    angle = snap(kind, angle)
    if (kind, angle % 360) in weapons.SPRITES:
        pts = weapons.stamp(im, kind, angle, hand)
        return {(x, y) for x, y, c in pts}
    p = Painter(im, hand, angle)
    CUSTOM[kind](p)
    return p.commit(outline=outline)


# ══════════════════════════════════════════════════════════════════════════════
# 포즈 엔진
def snap(kind, angle):
    """표준 무기 격자는 45도 단위만 있다."""
    return (round(angle / 45) * 45) % 360 if kind in weapons.AXIAL else angle


def _bounds(kind, angle, hand):
    """소품이 차지하는 좌표 경계(빈 셀에 미리 찍어 본다)."""
    angle = snap(kind, angle)
    tmp = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    off = (48, 48)
    if (kind, angle % 360) in weapons.SPRITES:
        pts = [(off[0] + x, off[1] + y) for x, y, c in weapons.SPRITES[kind, angle % 360].pixels()]
        xs, ys = [p[0] - off[0] for p in pts], [p[1] - off[1] for p in pts]
        return min(xs), min(ys), max(xs), max(ys)
    p = Painter(tmp, off, angle)
    CUSTOM[kind](p)
    lp = p.layer.load()
    pts = [(x - off[0], y - off[1]) for y in range(96) for x in range(96) if lp[x, y][3]]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    return min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1


def fit_hand(kind, angle, hand):
    x0, y0, x1, y1 = _bounds(kind, angle, hand)
    x, y = hand
    return max(2 - x0, min(45 - x1, x)), max(2 - y0, min(44 - y1, y))


def spark_fx(rig, im, at, color, size=1):
    x, y = at
    pts = [(0, 0, WHITE)]
    if size >= 1:
        pts += [(-1, 0, color), (1, 0, color), (0, -1, color), (0, 1, color)]
    if size >= 2:
        pts += [(-2, 0, WHITE), (2, 0, color), (0, -2, WHITE), (0, 2, color), (-1, -1, color), (1, 1, color), (-1, 1, color), (1, -1, color)]
    for dx, dy, c in pts:
        rig.put(im, x + dx, y + dy, c, over=False)


FX_COL = dict(fire=(236, 84, 40, 255), ice=(112, 203, 255, 255), thunder=(255, 225, 90, 255), heal=(147, 234, 98, 255),
              dark=(165, 88, 224, 255), arcane=(74, 233, 208, 255), support=(255, 144, 199, 255))

# 시전 세 단계의 팔 위치(어깨 기준 상대 좌표): 앞손 fh, 뒷손 bh, 몸 base/crouch/lean/dx/dy, 무기 각도 wa.
CAST_ARMS = {
    ('fire', 1): dict(fh=(6, 4), bh=(8, 2), base='L1', crouch=1, lean=2, dx=1),
    ('fire', 2): dict(fh=(-5, 0), bh=(-4, 2), base='L1', lean=1),
    ('fire', 3): dict(fh=(-10, -1), bh=(-9, 2), base='L2', lean=-2, dx=-2),
    ('ice', 1): dict(fh=(-5, -2), bh=(-4, 3), base='L1'),
    ('ice', 2): dict(fh=(-8, -10), bh=(-7, 8), base='L1', lean=1),
    ('ice', 3): dict(fh=(-2, -13), bh=(-10, 0), base='L2', lean=-1, dx=-1),
    ('thunder', 1): dict(fh=(8, 3), bh=(7, 5), base='L0', crouch=2, lean=2, dx=2),
    ('thunder', 2): dict(fh=(-1, -15), bh=(6, 3), base='L1', lean=0),
    ('thunder', 3): dict(fh=(-9, 6), bh=(4, 3), base='L2', lean=-3, dx=-3),
    ('heal', 1): dict(fh=(-3, -1), bh=(-2, 1), base='L1', dy=1),
    ('heal', 2): dict(fh=(-9, -9), bh=(9, -9), base='D1', dy=-1),
    ('heal', 3): dict(fh=(-10, -1), bh=(3, 3), base='L2', lean=-1, dx=-1),
    ('dark', 1): dict(fh=(-5, -7), bh=(3, 3), base='L1', crouch=2, lean=-1),
    ('dark', 2): dict(fh=(10, -4), bh=(-6, 1), base='L0', lean=3, dx=2),
    ('dark', 3): dict(fh=(-11, 1), bh=(5, 4), base='L2', lean=-3, dx=-3),
    ('arcane', 1): dict(fh=(-5, -3), bh=(-3, 0), base='L1', wa=90),
    ('arcane', 2): dict(fh=(-8, -12), bh=(6, -8), base='D1', dy=-1, wa=90),
    ('arcane', 3): dict(fh=(-11, -2), bh=(-3, 1), base='L2', lean=-2, dx=-2, wa=20),
    ('support', 1): dict(fh=(-4, -10), bh=(3, 3), base='L1'),
    ('support', 2): dict(fh=(-10, -3), bh=(3, 3), base='L1', lean=-1, dx=-1),
    ('support', 3): dict(fh=(-3, -8), bh=(3, 3), base='L2', lean=-1, dx=-1),
}
GEN_CAST = {'cast_charge': ('arcane', 1), 'cast_raise': ('arcane', 2), 'cast_release': ('arcane', 3)}

DEFAULT_ANGLES = dict(idle=60, windup=130, strike=90, attack=0, follow=315)


def gen_pose(rig, pid, S=None):
    """(base, lean, crouch, dx, dy, fh, bh, wk_angle, extras) — 어깨 기준 상대 손 좌표. rig.cfg 가 무기·각도를 정한다."""
    cfg = rig.cfg
    ang = {**DEFAULT_ANGLES, **cfg.get('angles', {})}
    P = dict(base='L1', lean=0, crouch=0, dx=0, dy=0, fh=(-8, 3), bh=None, wa=ang['idle'], wk='main', fx=[], bwk=None)
    if pid in ('idle', 'walk_b'):
        pass
    elif pid == 'walk_a':
        P.update(base='L0', fh=(-7, 4))
    elif pid == 'walk_c':
        P.update(base='L2', fh=(-9, 3))
    elif pid == 'attack_windup':
        P.update(base='L0', lean=2, dx=2, fh=(5, -5), wa=ang['windup'])
    elif pid == 'attack_strike':
        P.update(base='L2', lean=-1, dx=-2, fh=(-8, -9), wa=ang['strike'])
    elif pid == 'attack':
        P.update(base='L2', lean=-2, dx=-3, fh=(-9, -1), wa=ang['attack'])
    elif pid == 'attack_follow':
        P.update(base='L1', dx=-2, fh=(-8, 5), wa=ang['follow'])
    elif pid == 'hit':
        P.update(base='L1', lean=2, dx=3, fh=(4, 4), wa=300)
    elif pid == 'defend':
        P.update(base='L1', crouch=3, dx=1, fh=(-7, -2), wa=cfg.get('guard_angle', 45), bh=cfg.get('guard_bh'))
    elif pid == 'guard_hit':
        P.update(base='L1', crouch=3, dx=3, lean=1, fh=(-6, -2), wa=cfg.get('guard_angle', 45), bh=cfg.get('guard_bh'))
    elif pid == 'dead':
        P.update(base='lie', fh=None, wa=0)
    elif pid == 'victory':
        P.update(base='D1', dy=-1, fh=(-9, -11), bh=(6, -11), wa=90)
    elif pid == 'victory_b':
        P.update(base='D1', dy=-3, fh=(-9, -12), bh=(7, -9), wa=75)
    elif pid == 'item':
        P.update(base='L1', dx=-1, fh=(-5, -6), wk='item', wa=90)
    elif pid == 'weak':
        P.update(base='L1', lean=-1, crouch=5, fh=(-4, 6), wa=90)
    elif pid == 'evade':
        P.update(base='L1', lean=3, dx=6, fh=(-5, -2), wa=45)
    elif pid == 'dying':
        P.update(base='L1', lean=3, crouch=4, dx=2, fh=(1, 8), wa=315)
    elif pid == 'revive':
        P.update(base='L1', crouch=3, fh=(-5, 4), wa=90)
    elif pid == 'skill':
        P.update(base='L2', lean=-2, dx=-4, fh=(-3, -10), wa=cfg.get('skill_angle', 45), fx=['skillglow'])
    elif pid == 'front':
        P.update(base='D1', fh=None)
    elif pid in GEN_CAST:
        return cast_pose(rig, *GEN_CAST[pid], generic=True)
    elif pid.startswith('cast_'):
        parts = pid.split('_')
        return cast_pose(rig, parts[1], int(parts[2]))
    else:
        raise KeyError(pid)
    return P


def cast_pose(rig, ct, step, generic=False):
    c = CAST_ARMS[(ct, step)]
    P = dict(base=c.get('base', 'L1'), lean=c.get('lean', 0), crouch=c.get('crouch', 0), dx=c.get('dx', 0), dy=c.get('dy', 0),
             fh=c['fh'], bh=c['bh'], wa=c.get('wa', 90), wk='cast', fx=[('cast', ct, step)], bwk=None)
    return P


def render_pose(rig, pid):
    P = gen_pose(rig, pid)
    cfg = rig.cfg
    apply_over(cfg, pid, P)
    if pid == 'front':
        cell, _ = rig.body('D1')
        return cell
    cell, S = rig.body(P['base'], P['lean'], P['crouch'], P['dx'], P['dy'])
    if pid == 'dead':
        kind = cfg.get('dead_kind', cfg['main'])
        hand = cfg.get('dead_hand', (12, 42))
        ang = cfg.get('dead_angle', 0)
        hand = fit_hand(kind, ang, hand)
        stamp_prop(cell, kind, ang, hand)
        return cell
    front = P['base'].startswith('D')
    # 무기 결정
    wk = P['wk']
    if wk == 'main':
        kind = cfg['main']
    elif wk == 'item':
        kind = cfg.get('item', 'flask')
    elif wk == 'cast':
        kind = cfg['main'] if cfg.get('cast_keeps', True) else None
        ct = P['fx'][0][1]
        if kind and ct != 'arcane' and P['bh'] is not None:
            P['bwk'] = (kind, 100)      # 무기는 뒷손에, 앞손은 비워 주문 손짓을 보인다
            kind = None
    else:
        kind = wk
    fh = P['fh']
    bh = P['bh']
    # 뒷팔(먼 팔)은 몸 뒤 오른쪽에서 소매만 찍는다.
    if bh is not None:
        sb = (S[0] + (4 if front else 2), S[1])
        B = (S[0] + bh[0], S[1] + bh[1])
        rig.arm(cell, sb, B, hand=True, sleeve=rig.sleeve_d)
        if P.get('bwk'):
            stamp_prop(cell, P['bwk'][0], P['bwk'][1], fit_hand(P['bwk'][0], P['bwk'][1], B))
    if fh is not None:
        H = (S[0] + fh[0], S[1] + fh[1])
        if kind:
            H = fit_hand(kind, P['wa'], H)
        Sf = (S[0] - (4 if front else 0), S[1])
        rig.arm(cell, Sf, H, hand=False)
        if kind:
            stamp_prop(cell, kind, P['wa'], H)
        # 손: 무기 위에 살색 두 칸
        hx, hy = round(H[0]), round(H[1])
        for x in (hx - 1, hx):
            for y in (hy - 1, hy):
                rig.put(cell, x, y, rig.skin)
        for x, y in ((hx - 2, hy), (hx + 1, hy), (hx - 1, hy + 1), (hx, hy + 1)):
            rig.put(cell, x, y, rig.ink, over=False)
        P['_hand'] = H
    for fx in P['fx']:
        rig_fx(rig, cell, pid, fx, P, S)
    return cell


def rig_fx(rig, cell, pid, fx, P, S):
    col = rig.cfg.get('fx_color', (255, 255, 255, 255))
    if fx == 'swing1' or fx == 'swing2':
        hand = P.get('_hand', (S[0] - 8, S[1]))
        r = 15 if fx == 'swing2' else 11
        a0, a1 = (-50, 25) if fx == 'swing2' else (10, 75)
        for i in range(0, 28):
            t = math.radians(a0 + (a1 - a0) * i / 27)
            x = round(hand[0] - r * math.cos(t) * 0.9 + 4)
            y = round(hand[1] - r * math.sin(t) + 6)
            if i % 4 != 3:
                rig.put(cell, x, y, WHITE if i % 3 == 0 else col, over=False)
    elif fx == 'skillglow':
        hand = P.get('_hand', (S[0] - 8, S[1] - 6))
        spark_fx(rig, cell, (round(hand[0]) - 6, round(hand[1]) - 4), col, 2)
    elif isinstance(fx, tuple) and fx[0] == 'cast':
        _, ct, step = fx
        c = FX_COL[ct]
        hand = P.get('_hand')
        pts = []
        if P['fh'] is not None:
            pts.append((S[0] + P['fh'][0] - (2 if step >= 2 else 0), S[1] + P['fh'][1] - (2 if ct != 'thunder' or step != 3 else 0)))
        if step >= 2 and P['bh'] is not None and abs(P['bh'][0]) > 4:
            pts.append((S[0] + P['bh'][0], S[1] + P['bh'][1] - 2))
        for (x, y) in pts:
            spark_fx(rig, cell, (round(x), round(y)), c, 1 if step == 1 else 2)


# ══════════════════════════════════════════════════════════════════════════════
# 구동
EVIDENCE = Path(ROOT) / '.omo/r2w4'


def all_pose_ids():
    return [p[0] for p in POSES] + [f'cast_{ct}_{n}' for ct, _ in CAST_TYPES for n in (1, 2, 3)]


def binarize(im):
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im


def apply_over(cfg, pid, P):
    o = cfg.get('over', {}).get(pid)
    if o:
        P.update(o)
    return P


def make_char(cid, cfg, save=True):
    rig = Rig(cid, cfg)
    outdir = Path(SRC_DIR) / cid
    outdir.mkdir(parents=True, exist_ok=True)
    issues = {}
    frames_out = {}
    for pid in all_pose_ids():
        im = binarize(render_pose(rig, pid))
        frames_out[pid] = im
        bad = cb_lib.validate(cid, pid, im)
        if bad:
            issues[pid] = bad
        if save:
            im.save(outdir / f'{pid}.png', optimize=True)
    return frames_out, issues


def review_board(chars, poses, path, scale=4, cols=None):
    """chars: [(cid, label)], poses: 포즈 id 목록. 한 행 = 캐릭터 하나. 1900px 이하로 쪼개 저장한다."""
    cw = CELL * scale
    cols = cols or poses
    outs = []
    per = max(1, (1900 - 70) // cw)
    for part in range(0, len(cols), per):
        chunk = cols[part:part + per]
        W = 70 + cw * len(chunk)
        H = 14 + cw * len(chars)
        im = Image.new('RGB', (W, H), (38, 40, 52))
        d = ImageDraw.Draw(im)
        for c, pid in enumerate(chunk):
            d.text((70 + c * cw + 3, 2), pid, fill=(235, 235, 120))
        for r, (cid, label) in enumerate(chars):
            y = 14 + r * cw
            d.text((3, y + 4), cid.split('-')[0][-1] + '-' + cid.split('-')[1], fill=(240, 240, 240))
            d.text((3, y + 18), cid, fill=(150, 150, 165))
            for c, pid in enumerate(chunk):
                x = 70 + c * cw
                d.rectangle((x, y, x + cw - 2, y + cw - 2), fill=(56, 60, 76))
                f = Path(SRC_DIR) / cid / f'{pid}.png'
                if f.exists():
                    cell = Image.open(f).convert('RGBA').resize((cw, cw), Image.NEAREST)
                    im.paste(cell, (x, y), cell)
                d.line((x, y + (GROUND_Y + 1) * scale, x + cw - 2, y + (GROUND_Y + 1) * scale), fill=(150, 70, 74))
        outs.append(im)
    paths = []
    for k, im in enumerate(outs):
        pp = Path(str(path).replace('.png', f'-{k + 1}.png')) if len(outs) > 1 else Path(path)
        pp.parent.mkdir(parents=True, exist_ok=True)
        im.save(pp)
        paths.append(pp)
    return paths


if __name__ == '__main__':
    for cid in sys.argv[1:]:
        fr = frames(cid)['L'][1]
        print(cid, fr.getbbox(), colors(cid))
