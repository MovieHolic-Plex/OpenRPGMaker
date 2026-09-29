"""People 걷기 칩 → 전투 도트 리그 (retro2003 2차 로스터, 2026-09-29).

걷기 칩 24×32 왼쪽 프레임(패턴 0/1/2)과 정면 프레임을 원본 1:1 도트로 쓴다. 이미지 생성·축소·보간 없음.
  · 몸: 윗몸(머리~허리)과 다리를 따로 골라 잇는다 — 윗몸은 행마다 밀어 기울이고(lean), 배·허리 줄을 빼 웅크리며(crouch),
    다리는 걷기 패턴(0/1/2)에서 가져와 보폭을 만든다(치마 옷은 벌리지 않는다).
  · 팔: 어깨 → 손 두 뼈(IK)로 옷소매 색 2px 선 + 피부색 주먹을 몸 위에 찍는다(걷기 칩의 작은 팔은 소매 뒤에 가려진다).
  · 장비: 국소 좌표(u = 무기 방향, v = 옆)의 도형 목록으로 정의하고 각도만큼 돌려 정수 좌표로 찍는다. 각도 규약은 weapons.py 와 같다
    (0 왼쪽, 90 위, 180 오른쪽, 270 아래).
  · 검은 윤곽은 몸 위에는 찍지 않고 빈칸에만 두른다.
셀 규약(cb_lib): 48×48, 발 마지막 행 y=44, 몸 중심 x=24, 왼쪽을 본다, 알파 0/255.
"""
import math, sys
from pathlib import Path
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from PIL import Image
import cb_lib
from cb_lib import CELL, GROUND_Y, CENTER_X, walk_frame

INK = (28, 24, 38, 255)


def rgb(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# 장비 색(작은 팔레트를 캐릭터마다 공유). 알파 255.
COL = {
    'ink': INK,
    'st0': rgb('#3b4562'), 'st1': rgb('#7f8fb0'), 'st2': rgb('#c4d2e6'), 'st3': rgb('#f4f8ff'),
    'wd0': rgb('#4a2c1a'), 'wd1': rgb('#8a5a32'), 'wd2': rgb('#c08a4c'),
    'gd0': rgb('#a8741c'), 'gd1': rgb('#e8b830'), 'gd2': rgb('#fff09a'),
    'rd0': rgb('#7a1428'), 'rd1': rgb('#d0263c'), 'rd2': rgb('#ff7a80'),
    'bl0': rgb('#1c3a86'), 'bl1': rgb('#3a78e0'), 'bl2': rgb('#9ad8ff'),
    'gr0': rgb('#1a5a2a'), 'gr1': rgb('#3aa040'), 'gr2': rgb('#a8f070'),
    'pu0': rgb('#3c1868'), 'pu1': rgb('#8a48d0'), 'pu2': rgb('#e0a8ff'),
    'wh': rgb('#ffffff'), 'cr0': rgb('#c8b890'), 'cr1': rgb('#f0e6c8'),
    'or1': rgb('#f08a28'), 'or2': rgb('#ffd070'),
}


def dirv(ang):
    a = math.radians(ang)
    return -math.cos(a), -math.sin(a)


OOB = [0, 0, 0]   # [왼쪽으로 잘린 최대 칸 수, 위로 잘린 최대 칸 수] — 리그가 보고 몸을 밀어 다시 그린다


class Pen:
    """도형을 모아 두었다가 한꺼번에 찍는다. flush 는 몸 위에는 윤곽을 찍지 않는다."""
    def __init__(self, im):
        self.im = im
        self.pts = {}

    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if y > GROUND_Y:
            return      # 땅에 꽂힌 것으로 본다(발 기준선 아래는 찍지 않는다)
        if 0 <= x < CELL and 0 <= y < CELL:
            self.pts[(x, y)] = c
        else:
            if x < 0: OOB[0] = max(OOB[0], -x)
            if x >= CELL: OOB[2] = max(OOB[2], x - CELL + 1)
            if y < 0: OOB[1] = max(OOB[1], -y)

    def line(self, a, b, c, w=1):
        (x0, y0), (x1, y1) = a, b
        n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * 2))
        steep = abs(y1 - y0) > abs(x1 - x0)
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            self.put(x, y, c)
            if w >= 2:
                self.put(x + (1 if steep else 0), y + (0 if steep else 1), c)
            if w >= 3:
                self.put(x - (1 if steep else 0), y - (0 if steep else 1), c)

    def poly(self, pts, c):
        if len(pts) < 3:
            return
        from PIL import ImageDraw
        tmp = Image.new('L', (CELL, CELL), 0)
        ImageDraw.Draw(tmp).polygon([(round(x), round(y)) for x, y in pts], fill=255)
        px = tmp.load()
        for y in range(CELL):
            for x in range(CELL):
                if px[x, y]:
                    self.put(x, y, c)

    def disc(self, x, y, r, c):
        for yy in range(int(y - r - 1), int(y + r + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r + 0.3:
                    self.put(xx, yy, c)

    def flush(self, outline=True):
        im = self.im
        if outline:
            for (x, y) in list(self.pts):
                for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + ex, y + ey)
                    if q not in self.pts and 0 <= q[0] < CELL and 0 <= q[1] <= GROUND_Y and not im.getpixel(q)[3]:
                        im.putpixel(q, INK)
        for (x, y), c in self.pts.items():
            im.putpixel((x, y), c)
        self.pts = {}


class Frame:
    """국소 좌표 도형 → 셀 좌표. H = 손(자루 잡는 곳), ang = 무기 방향."""
    def __init__(self, pen, H, ang):
        self.pen, self.H, self.ang = pen, H, ang
        self.d = dirv(ang)
        self.n = (-self.d[1], self.d[0])          # 위쪽(왼쪽을 볼 때) 옆 방향

    def at(self, u, v=0):
        return (self.H[0] + self.d[0] * u + self.n[0] * v, self.H[1] + self.d[1] * u + self.n[1] * v)

    def line(self, u0, v0, u1, v1, c, w=1):
        self.pen.line(self.at(u0, v0), self.at(u1, v1), c, w)

    def poly(self, pts, c):
        self.pen.poly([self.at(u, v) for u, v in pts], c)

    def disc(self, u, v, r, c):
        x, y = self.at(u, v)
        self.pen.disc(x, y, r, c)

    def dot(self, u, v, c):
        x, y = self.at(u, v)
        self.pen.put(x, y, c)


# ── 장비 ───────────────────────────────────────────────────────────────────────────
def w_sword(f, ln=13, blade='st', guard='gd', wide=1.6):
    C = COL
    f.line(-3, 0, 1, 0, C['wd1'], 2); f.dot(-4, 0, C[guard + '1'])
    f.line(2, -3, 2, 3, C[guard + '1'], 1)
    f.poly([(3, -wide), (ln - 2, -wide), (ln + 1, 0), (ln - 2, wide), (3, wide)], C[blade + '1'])
    f.line(3, wide - .4, ln - 1, wide - .4, C[blade + '2']); f.line(3, -wide + .4, ln - 2, -wide + .4, C[blade + '0'])
    f.dot(ln, 0, C[blade + '3'])


def w_rapier(f, ln=17):
    C = COL
    f.line(-3, 0, 1, 0, C['wd1'], 2); f.dot(-4, 0, C['gd1'])
    f.disc(2, 0, 2, C['gd0']); f.disc(2, 0, 1, C['gd1'])
    f.line(3, 0, ln, 0, C['st2'], 1); f.dot(ln, 0, C['st3']); f.line(3, .8, 9, .8, C['st3'], 1)


def w_scimitar(f, ln=13):
    C = COL
    f.line(-3, 0, 1, 0, C['rd1'], 2); f.dot(-4, 0, C['gd1']); f.line(2, -2, 2, 2, C['gd1'])
    pts_a, pts_b = [], []
    for i in range(0, ln + 1):
        u = 3 + i; v = 0.045 * i * i * .8
        w = 1.8 if i < ln - 4 else max(0.4, 1.8 - (i - (ln - 4)) * .5)
        pts_a.append((u, v + w)); pts_b.append((u, v - w))
    f.poly(pts_a + pts_b[::-1], C['st1'])
    f.line(3, 1.6, 3 + ln - 1, .045 * (ln - 1) ** 2 * .8 + 1.4, C['st3'], 1)
    f.line(3, -1.2, 3 + ln - 3, .045 * (ln - 3) ** 2 * .8 - 1.0, C['st0'], 1)


def w_axe(f, ln=13, head='st'):
    C = COL
    f.line(-3, 0, ln, 0, C['wd1'], 2); f.line(-3, .8, ln, .8, C['wd0'], 1)
    f.poly([(ln - 5, 0), (ln - 3, -3.5), (ln + 1, -5), (ln + 2.5, -1), (ln + 2.5, 3), (ln + 1, 6), (ln - 3, 4)], C[head + '1'])
    f.line(ln + 2, -3, ln + 2, 4.5, C[head + '3'], 1); f.line(ln - 3, -2.5, ln, -4, C[head + '2'], 1)
    f.disc(ln - 2, 0, 1, C['wd2'])


def w_spear(f, ln=24):
    C = COL
    f.line(-6, 0, ln - 5, 0, C['wd1'], 1); f.line(-6, .6, ln - 5, .6, C['wd0'], 1)
    f.poly([(ln - 6, -1.6), (ln - 1, 0), (ln - 6, 1.6)], C['st1']); f.line(ln - 5, -.6, ln - 1, 0, C['st3'])
    f.line(ln - 8, -1.8, ln - 8, 1.8, C['rd1'], 1); f.line(ln - 7, -1.8, ln - 7, 1.5, C['rd0'], 1)


def w_club(f, ln=12):
    C = COL
    f.poly([(-3, -.8), (ln - 5, -1.2), (ln, -2.6), (ln + 1, 0), (ln, 2.6), (ln - 5, 1.2), (-3, .8)], C['wd1'])
    f.line(-2, -.8, ln - 1, -2.3, C['wd2'], 1); f.line(-2, .8, ln - 1, 2.4, C['wd0'], 1)
    for u, v in ((ln - 2, -1.6), (ln - 1, 1.0), (ln - 4, 0.4)):
        f.dot(u, v, C['st1'])


def w_mace(f, ln=12):
    C = COL
    f.line(-3, 0, ln - 3, 0, C['wd1'], 2)
    f.disc(ln, 0, 3, C['st1']); f.disc(ln - .7, -.7, 1.6, C['st2'])
    for u, v in ((ln + 3, 0), (ln - 3, 0), (ln, 3.5), (ln, -3.5), (ln + 2.4, 2.4), (ln + 2.4, -2.4)):
        f.dot(u, v, C['st3'])


def w_staff(f, ln=22, head='orb', col='bl'):
    C = COL
    f.line(-7, 0, ln, 0, C['wd1'], 1); f.line(-7, .6, ln, .6, C['wd0'], 1)
    if head == 'orb':
        f.disc(ln + 2, 0, 3, C[col + '0']); f.disc(ln + 2, 0, 2, C[col + '1']); f.dot(ln + 1, -1, C[col + '2'])
        f.line(ln - 1, -3, ln, -1, C['gd1'], 1); f.line(ln - 1, 3, ln, 1, C['gd1'], 1)
    elif head == 'star':
        r = 4
        pts = []
        for k in range(10):
            a = k * math.pi / 5
            rr = r if k % 2 == 0 else r * .45
            pts.append((ln + 3 + math.cos(a) * rr, math.sin(a) * rr))
        f.poly(pts, C['gd1']); f.dot(ln + 3, 0, C['gd2'])
    elif head == 'crystal':
        f.poly([(ln, 0), (ln + 3, -2), (ln + 7, 0), (ln + 3, 2)], C[col + '1']); f.line(ln + 1, 0, ln + 5, 0, C[col + '2'], 1)
        f.line(ln - 1, -2, ln + 1, 0, C['gd1']); f.line(ln - 1, 2, ln + 1, 0, C['gd1'])
    elif head == 'crook':
        f.disc(ln + 2, -2.5, 2.6, C['gd1']); f.disc(ln + 2, -2.5, 1.2, (0, 0, 0, 0)); f.dot(ln + 2, 0, C['gd2'])
    elif head == 'moon':
        f.disc(ln + 2, 0, 3.4, C['gd1']); f.disc(ln + 3.4, -.4, 2.8, (0, 0, 0, 0)); f.dot(ln + 1, -2, C['gd2'])


def w_wand(f, ln=9, col='pu'):
    C = COL
    f.line(-2, 0, ln, 0, C['wd1'], 1); f.dot(-3, 0, C['gd1'])
    r = 3
    pts = []
    for k in range(10):
        a = k * math.pi / 5
        rr = r if k % 2 == 0 else r * .45
        pts.append((ln + 2 + math.cos(a) * rr, math.sin(a) * rr))
    f.poly(pts, C[col + '1']); f.dot(ln + 2, 0, C[col + '2'])


def w_scepter(f, ln=10):
    C = COL
    f.line(-3, 0, ln, 0, C['gd1'], 1); f.line(-3, .6, ln, .6, C['gd0'], 1)
    f.disc(ln + 2, 0, 2.6, C['gd1']); f.disc(ln + 2, 0, 1.4, C['rd1']); f.dot(ln + 1.4, -.8, C['rd2'])
    f.line(ln - 1, -2.4, ln - 1, 2.4, C['gd1'], 1)


def w_boomerang(f, ln=8):
    C = COL
    a = math.radians(28)
    for s in (-1, 1):
        f.line(0, 0, ln * math.cos(a), s * ln * math.sin(a), C['wd1'], 2)
        f.line(0, 0, ln * math.cos(a), s * ln * math.sin(a) + .8, C['wd0'], 1)
    f.dot(ln * math.cos(a) - .5, ln * math.sin(a) - .2, C['rd1']); f.dot(ln * math.cos(a) - .5, -ln * math.sin(a) + .2, C['rd1'])


def w_shield(f, kind='kite'):
    C = COL
    if kind == 'kite':
        f.poly([(-1, -5), (3, -5), (4, 0), (3, 5), (-1, 6.5), (-4, 4), (-4, -4)], C['bl1'])
        f.poly([(-1, -3.6), (2, -3.6), (2.6, 0), (1.6, 3.6), (-1, 5), (-3, 3), (-3, -3)], C['bl0'])
        f.line(-1, -4, -1, 5, C['gd1'], 1); f.line(-3, 0, 3, 0, C['gd1'], 1); f.dot(-1, 0, C['gd2'])
    else:
        f.disc(0, 0, 4.4, C['wd1']); f.disc(0, 0, 3.2, C['st1']); f.disc(0, 0, 1.4, C['gd1']); f.dot(-.6, -.6, C['gd2'])


def w_cards(f, n=3):
    C = COL
    for i in range(n):
        a = (i - (n - 1) / 2) * .78
        cx, cy = 4.6 * math.cos(a), 4.6 * math.sin(a)
        def corner(u, v):
            # 카드 축 = a 방향(부채 바깥쪽), 폭 = 옆
            return (cx + u * math.cos(a) - v * math.sin(a), cy + u * math.sin(a) + v * math.cos(a))
        f.poly([corner(u, v) for u, v in ((-3.4, -2.6), (3.4, -2.6), (3.4, 2.6), (-3.4, 2.6))], C['ink'])
        f.poly([corner(u, v) for u, v in ((-2.6, -1.8), (2.6, -1.8), (2.6, 1.8), (-2.6, 1.8))], C['cr1'])
        col = [C['rd1'], C['pu1'], C['bl1']][i % 3]
        x, y = corner(0.6, 0)
        f.dot(x, y, col); f.dot(x + .8, y, col)
        x, y = corner(-1.6, 0)
        f.dot(x, y, C['ink'])


def w_dice(f):
    C = COL
    f.poly([(0, -2.4), (4.8, -2.4), (4.8, 2.4), (0, 2.4)], C['wh'])
    f.line(0, 2.4, 4.8, 2.4, C['st1'], 1)
    for u, v in ((1, -1.2), (3.6, 1.2), (2.3, 0)):
        f.dot(u, v, C['rd1'])


def w_orb(f, col='pu'):
    C = COL
    f.disc(3, 0, 3.6, C[col + '0']); f.disc(3, 0, 2.6, C[col + '1']); f.disc(2.4, -.8, 1.2, C[col + '2']); f.dot(1.4, -1.6, C['wh'])


def w_bag(f):
    C = COL
    f.poly([(0, -2.4), (5, -3), (6, 0), (5, 3), (0, 2.4)], C['gd0'])
    f.poly([(.6, -1.6), (4.6, -2.2), (5.2, 0), (4.6, 2.2), (.6, 1.6)], C['gd1'])
    f.line(0, -1.8, 0, 1.8, C['rd1'], 1); f.dot(3, 0, C['gd2'])


def w_cane(f, ln=14):
    C = COL
    f.line(-1, 0, ln, 0, C['wd0'], 1); f.line(-1, .5, ln, .5, C['wd1'], 1)
    f.disc(ln + 1, -1, 2, C['gd1']); f.dot(ln + .5, -1.6, C['gd2'])


def w_bottle(f, col='rd'):
    C = COL
    f.poly([(0, -1.6), (3.2, -1.6), (3.2, 1.6), (0, 1.6)], C[col + '1'])
    f.line(3.2, -.6, 5, -.6, C['cr1'], 1); f.line(3.2, .6, 5, .6, C['cr1'], 1); f.line(0, -1.4, 3, -1.4, C[col + '2'], 1)


def w_harp(f, ln=14):
    C = COL
    f.line(-3, 0, ln, 0, C['gd1'], 1)
    f.poly([(ln - 8, 0), (ln - 6, -6), (ln, -8), (ln, -6), (ln - 5, -4.4), (ln - 5, 0)], C['gd1'])
    f.line(ln - 6, -1, ln - 1, -6.6, C['wh'], 1); f.line(ln - 3, -1, ln - 1, -4.6, C['wh'], 1)


def w_fan(f):
    C = COL
    for i in range(5):
        a = (i - 2) * .32
        f.line(0, 0, 7 * math.cos(a), 7 * math.sin(a), C['rd1'] if i % 2 else C['gd1'], 1)
    f.line(0, 0, -2, 0, C['wd1'], 1)


WEAPONS = {
    'sword': w_sword, 'rapier': w_rapier, 'scimitar': w_scimitar, 'axe': w_axe, 'spear': w_spear, 'club': w_club,
    'mace': w_mace, 'staff': w_staff, 'wand': w_wand, 'scepter': w_scepter, 'boomerang': w_boomerang, 'shield': w_shield,
    'cards': w_cards, 'dice': w_dice, 'orb': w_orb, 'bag': w_bag, 'cane': w_cane, 'bottle': w_bottle, 'harp': w_harp, 'fan': w_fan,
}


def weapon_stamp(im, kind, H, ang, **kw):
    pen = Pen(im)
    WEAPONS[kind](Frame(pen, H, ang), **kw)
    pen.flush()


# ── 몸 ─────────────────────────────────────────────────────────────────────────────
def lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


class Body:
    def __init__(self, chip, sh=None, hip=None, skirt=False, skin=None, sleeve=None):
        self.chip = chip
        self.L = [walk_frame(chip, 'left', p) for p in range(3)]
        self.D = walk_frame(chip, 'down', 1)
        bb = self.L[1].getbbox()
        self.bb = bb
        h = bb[3] - bb[1]
        self.top = bb[1]
        self.bottom = bb[3]
        self.sh = sh or bb[1] + round(0.5 * h)
        self.hip = hip or bb[1] + round(0.76 * h)
        xs = [x for y in range(self.sh, self.hip) for x in range(24) if self.L[1].getpixel((x, y))[3]] or [12]
        self.xc = round(sum(xs) / len(xs))
        foot = [x for y in range(bb[3] - 3, bb[3]) for x in range(24) if self.L[1].getpixel((x, y))[3]] or [12]
        self.fx0 = (min(foot) + max(foot)) / 2
        self.skirt = skirt
        cols = {}
        for f in self.L + [self.D]:
            for c in f.getdata():
                if c[3] == 255:
                    cols[c[:3]] = cols.get(c[:3], 0) + 1
        self.pal = cols
        headcols = {}
        for y in range(bb[1], self.sh):
            for x in range(24):
                c = self.L[1].getpixel((x, y))
                if c[3]:
                    headcols[c[:3]] = headcols.get(c[:3], 0) + 1
        want = (238, 178, 138)
        self.skin = tuple(skin) + (255,) if skin else min(headcols, key=lambda c: sum((c[i] - want[i]) ** 2 for i in range(3))) + (255,)
        torso = {}
        for y in range(self.sh, self.hip):
            for x in range(24):
                c = self.L[1].getpixel((x, y))
                if c[3] and lum(c) > 55 and sum((c[i] - self.skin[i]) ** 2 for i in range(3)) > 1800:
                    torso[c[:3]] = torso.get(c[:3], 0) + 1
        self.sleeve = tuple(sleeve) + (255,) if sleeve else (max(torso, key=torso.get) + (255,) if torso else (120, 120, 140, 255))

    def ink(self):
        return min(self.pal, key=lambda c: lum(c)) + (255,)

    def compose(self, legs=1, lean=0, crouch=0, spread=0, upper=1, dx=0, dy=0):
        U, Lg = self.L[upper], self.L[legs]
        y0, y1 = self.top, self.bottom
        drops = set()
        if crouch:
            rows = list(range(self.sh, self.hip))
            step = max(1, len(rows) // (crouch + 1))
            drops = set(rows[step::step][:crouch])
        spans = []
        for y in range(y0, y1):
            if y in drops:
                continue
            src = U if y < self.hip else Lg
            sh_x = round(lean * max(0.0, (self.hip - y)) / max(1, self.hip - y0)) if y < self.hip else 0
            spans.append((y, src, sh_x))
        n = len(spans)
        top_cell = GROUND_Y + 1 - n + dy
        ox = round(CENTER_X - self.fx0) + dx
        im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        foot_rows = [k for k, (y, s, sx) in enumerate(spans) if y >= y1 - 5]
        for k, (y, src, sx) in enumerate(spans):
            row = src.crop((0, y, 24, y + 1))
            if spread and not self.skirt and k in foot_rows and y >= self.hip:
                left = Image.new('RGBA', (24, 1)); right = Image.new('RGBA', (24, 1))
                fc = self.fx0
                for x in range(24):
                    c = row.getpixel((x, 0))
                    if not c[3]: continue
                    (left if x < fc else right).putpixel((x, 0), c)
                im.alpha_composite(left, (ox - spread + sx, top_cell + k))
                im.alpha_composite(right, (ox + spread // 2 + sx, top_cell + k))
            else:
                im.alpha_composite(row, (ox + sx, top_cell + k))
        # 랜드마크(셀 좌표)
        kk = next(k for k, (y, s, sx) in enumerate(spans) if y >= self.sh)
        sxs = spans[kk][2]
        S = (self.xc + ox + sxs, top_cell + kk)
        hk = next((k for k, (y, s, sx) in enumerate(spans) if y >= self.top + 3), 0)
        head = (self.xc + ox + spans[hk][2], top_cell + hk + 2)
        return Pose(im, S, head, ox, top_cell)


class Pose:
    def __init__(self, im, S, head, ox, top):
        self.im, self.S, self.head, self.ox, self.top = im, S, head, ox, top


def ik(S, H, l1=4.5, l2=4.5, bend=1):
    """어깨 S, 손 H → 팔꿈치(bend +1 은 아래쪽으로 꺾임). 닿지 않으면 손을 끌어당긴다."""
    dx, dy = H[0] - S[0], H[1] - S[1]
    d = math.hypot(dx, dy) or 1
    reach = l1 + l2 - 0.4
    if d > reach:
        dx, dy = dx * reach / d, dy * reach / d
        d = reach
    H = (S[0] + dx, S[1] + dy)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    hh = math.sqrt(max(0.0, l1 * l1 - a * a))
    mx, my = S[0] + dx * a / d, S[1] + dy * a / d
    nx, ny = -dy / d, dx / d
    if ny * bend < 0:
        nx, ny = -nx, -ny
    return (mx + nx * hh, my + ny * hh), H


def draw_arm(body, im, S, H, bend=1, front=True):
    pen = Pen(im)
    E, H = ik(S, H, bend=bend)
    sl, sk = body.sleeve, body.skin
    pen.line(S, E, sl, 2)
    pen.line(E, H, sl, 2)
    pen.flush()
    return H


def draw_fist(body, im, H):
    x, y = int(round(H[0])), int(round(H[1]))
    pen = Pen(im)
    for ex, ey in ((0, 0), (-1, 0), (0, -1), (-1, -1)):
        pen.put(x + ex, y + ey, body.skin)
    pen.flush()


def glow(im, at, col, r=3, core=None):
    """마법 빛: 가운데 밝고 바깥 색."""
    pen = Pen(im)
    pen.disc(at[0], at[1], r, col)
    if core:
        pen.disc(at[0], at[1], max(1, r - 2), core)
    pen.flush(outline=False)


def sparkle(im, at, col, r=3):
    pen = Pen(im)
    x, y = at
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        pen.put(x + dx, y + dy, col)
    if r >= 3:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            pen.put(x + dx, y + dy, col)
    pen.flush(outline=False)


def finish(im):
    """알파 0/255 로."""
    px = im.load()
    for y in range(CELL):
        for x in range(CELL):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im
