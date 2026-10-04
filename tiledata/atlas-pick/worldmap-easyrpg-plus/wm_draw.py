"""월드맵 확장 아이콘용 픽셀 그리기 도구.

모든 픽셀은 좌표·규칙으로 직접 정한다(생성 모델·트레이싱 없음).
팔레트는 EasyRPG World.png 아이콘(성·마을·동굴)에서 실제로 쓰인 색만 쓴다.
"""
import numpy as np

from wm_lib import hexc

OL = hexc('111618')
STONE = dict(hi=hexc('78739c'), cap=hexc('aac3b5'), mid=hexc('515567'), lo=hexc('363540'), sh=hexc('493f59'), moss=hexc('758276'))
BONE = dict(hi=hexc('e1d7c1'), cap=hexc('d8cbac'), mid=hexc('b9ab9d'), lo=hexc('766e60'), sh=hexc('564a3e'), moss=hexc('758276'))
SAND = dict(hi=hexc('e1d7c1'), cap=hexc('d8cbac'), mid=hexc('cdb98a'), lo=hexc('a08c50'), sh=hexc('766e60'), moss=hexc('758276'))
BLUE = dict(hi=hexc('6fb1ff'), mid=hexc('208ef8'), lo=hexc('086bba'), sh=hexc('065298'), dk=hexc('1d2c33'))
RED = dict(hi=hexc('de693b'), mid=hexc('c21919'), lo=hexc('931d10'), sh=hexc('710d09'), dk=hexc('411e05'))
WOOD = dict(hi=hexc('d59147'), mid=hexc('9a5435'), lo=hexc('6d3b15'), sh=hexc('351803'), dk=hexc('351803'))
SNOW = dict(hi=hexc('f0faff'), mid=hexc('dcf7f9'), lo=hexc('cfecec'), sh=hexc('74d1d2'), dk=hexc('065298'))
GREEN = dict(hi=hexc('7ac83c'), mid=hexc('40a837'), lo=hexc('218238'), sh=hexc('13522e'), dk=hexc('13522e'))
SLATE = dict(hi=hexc('8ca9a3'), mid=hexc('515567'), lo=hexc('363540'), sh=hexc('493f59'), dk=hexc('1d2c33'))
WATER = dict(hi=hexc('6fb1ff'), mid=hexc('208ef8'), lo=hexc('086bba'), sh=hexc('065298'), dk=hexc('093989'))
WIN = hexc('1d2c33')
GOLD = hexc('d59147')


class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 3), np.uint8)
        self.m = np.zeros((h, w), bool)

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = c
            self.m[y, x] = True

    def r(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def hl(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.p(x, y, c)

    def vl(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.p(x, y, c)

    def outline(self, col=OL):
        m = self.m
        add = np.zeros_like(m)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.zeros_like(m)
            ys = slice(max(dy, 0), self.h + min(dy, 0)); yd = slice(max(-dy, 0), self.h + min(-dy, 0))
            xs = slice(max(dx, 0), self.w + min(dx, 0)); xd = slice(max(-dx, 0), self.w + min(-dx, 0))
            s[yd, xd] = m[ys, xs]
            add |= s
        add &= ~m
        self.a[add] = col
        self.m |= add


# ------------------------------------------------------------------ 벽·탑·집
def brick(cv, x0, y0, x1, y1, pal, top_hi=True, seed=0):
    cv.r(x0, y0, x1, y1, pal['mid'])
    for y in range(y0, y1 + 1):
        row = (y - y0) // 4
        if (y - y0) % 4 == 3:
            cv.hl(x0, x1, y, pal['lo'])
            continue
        for x in range(x0, x1 + 1):
            off = 2 if row % 2 else 0
            if (x - x0 + off + seed) % 5 == 0:
                cv.p(x, y, pal['sh'])
    if top_hi:
        cv.hl(x0, x1, y0, pal['hi'])
    cv.vl(x0, y0, y1, pal['hi'])
    cv.vl(x1, y0, y1, pal['lo'])
    cv.hl(x0, x1, y1, pal['lo'])


def crenel(cv, x0, x1, y, pal, h=3, step=2):
    """성가퀴: y 위쪽으로 h 픽셀."""
    for x in range(x0, x1 + 1):
        if ((x - x0) // step) % 2 == 0:
            for k in range(1, h + 1):
                cv.p(x, y - k, pal['hi'] if k == h else (pal['mid'] if x != x0 else pal['hi']))
            cv.p(x, y - h, pal['cap'])


def wall(cv, x0, x1, ytop, ybot, pal, cren=True, seed=0):
    brick(cv, x0, ytop, x1, ybot, pal, seed=seed)
    if cren:
        crenel(cv, x0, x1, ytop, pal)


def cone(cv, cx, ybase, rh, hw, pal, band=3):
    """원뿔 지붕. ybase = 밑변 행, 위로 rh 행. 왼쪽 밝게 오른쪽 어둡게."""
    for i in range(rh):
        y = ybase - i
        w = max(0, round(hw * (rh - i) / rh))
        for x in range(cx - w, cx + w + 1):
            if x < cx - w // 3:
                c = pal['mid']
            elif x <= cx + w // 3:
                c = pal['lo'] if False else pal['mid']
            else:
                c = pal['lo']
            if x == cx - w and w > 0:
                c = pal['hi']
            cv.p(x, y, c)
        if i % band == band - 1:
            for x in range(cx - w + 1, cx + w):
                cv.p(x, y, pal['lo'] if x <= cx else pal['sh'])
    cv.p(cx, ybase - rh, pal['hi'])
    # 처마
    for x in range(cx - hw - 1, cx + hw + 2):
        cv.p(x, ybase + 1, pal['sh'])


def tower(cv, cx, ytop, w, h, pal, roof=None, rpal=None, slit=True, seed=0):
    x0 = cx - w // 2
    x1 = x0 + w - 1
    brick(cv, x0, ytop, x1, ytop + h - 1, pal, seed=seed)
    if roof:
        cone(cv, cx, ytop - 1, roof, w // 2 + 1, rpal or BLUE)
    else:
        crenel(cv, x0, x1, ytop, pal, h=3, step=2 if w < 8 else 3)
    if slit:
        sy = ytop + max(3, h // 3)
        cv.vl(cx, sy, sy + 2, WIN)
    return x0, x1


def roof_gable(cv, x0, x1, ybase, rh, pal, over=1):
    """앞에서 본 박공 지붕. ybase = 처마 행, 위로 rh 행. 폭은 위로 갈수록 좁아진다."""
    w = x1 - x0 + 1
    cx = (x0 + x1) / 2
    for i in range(rh):
        y = ybase - i
        hw = (w / 2 + over) * (rh - i) / rh + 0.6
        for x in range(int(cx - hw + 0.5), int(cx + hw + 0.5) + 1):
            c = pal['mid'] if x < cx else pal['lo']
            if i % 3 == 2:
                c = pal['lo'] if x < cx else pal['sh']
            cv.p(x, y, c)
        cv.p(int(cx - hw + 0.5), y, pal['hi'])
    cv.p(int(cx), ybase - rh + 1, pal['hi'])
    cv.hl(int(cx - (w / 2 + over) + 0.5), int(cx + (w / 2 + over) + 0.5), ybase + 1, pal['sh'])


def house(cv, x0, ybase, w, wallh, rh, wpal, rpal, door=True, win=True, dcol=WOOD):
    """집: 몸채 아래(ybase), 위로 wallh, 그 위 지붕 rh."""
    y0 = ybase - wallh + 1
    cv.r(x0, y0, x0 + w - 1, ybase, wpal['mid'])
    cv.vl(x0, y0, ybase, wpal['hi'])
    cv.vl(x0 + w - 1, y0, ybase, wpal['lo'])
    cv.hl(x0, x0 + w - 1, ybase, wpal['lo'])
    if door and w >= 5:
        dx = x0 + w // 2 - 1
        cv.r(dx, ybase - 2, dx + 1, ybase, dcol['sh'])
        cv.p(dx, ybase - 2, dcol['mid'])
    if win and w >= 7:
        cv.p(x0 + 1, y0 + 1, WIN)
        cv.p(x0 + w - 2, y0 + 1, WIN)
    roof_gable(cv, x0, x0 + w - 1, y0 - 1, rh, rpal)


def tree(cv, cx, ybase, r=3, pal=GREEN):
    # 단순 원형 수관
    cy = ybase - r - 1
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= r * r + 1:
                c = pal['mid']
                if (x - cx) + (y - cy) < -r * 0.6:
                    c = pal['hi']
                elif (x - cx) + (y - cy) > r * 0.6:
                    c = pal['lo']
                cv.p(x, y, c)
    cv.p(cx, cy + r + 1, WOOD['lo'])


def arch_gate(cv, cx, ybot, w, h, pal):
    """성문: 어두운 아치 + 목문."""
    for y in range(ybot - h + 1, ybot + 1):
        for x in range(cx - w // 2, cx - w // 2 + w):
            top = ybot - h + 1
            if y == top and (x == cx - w // 2 or x == cx - w // 2 + w - 1):
                continue
            cv.p(x, y, WOOD['sh'])
    for y in range(ybot - h + 2, ybot + 1):
        cv.vl(cx, y, y, WOOD['lo'])
    cv.hl(cx - w // 2 + 1, cx - w // 2 + w - 2, ybot - h + 2, WOOD['mid'])


def flag(cv, x, y, col=RED, h=4):
    cv.vl(x, y, y + h, WOOD['sh'])
    cv.r(x + 1, y, x + 3, y + 1, col['mid'])
    cv.p(x + 1, y, col['hi'])
    cv.p(x + 3, y + 1, col['lo'])


def boat(cv, cx, ybase, w=9, sail=BONE):
    """작은 배: 물결 받침 + 선체 + 돛대."""
    for x in range(cx - w // 2 - 1, cx + w // 2 + 2):
        cv.p(x, ybase + 1, WATER['mid'] if (x + ybase) % 2 else WATER['hi'])
    for x in range(cx - w // 2, cx + w // 2 + 1):
        cv.p(x, ybase, WOOD['lo'])
        cv.p(x, ybase - 1, WOOD['mid'])
    cv.p(cx - w // 2 - 1, ybase - 1, WOOD['mid'])
    cv.p(cx + w // 2 + 1, ybase - 2, WOOD['mid'])
    cv.vl(cx, ybase - 7, ybase - 2, WOOD['sh'])
    for i in range(5):
        cv.hl(cx + 1, cx + 1 + min(i, 3), ybase - 6 + i, sail['hi'] if i < 3 else sail['mid'])
    cv.p(cx, ybase - 8, RED['mid'])


def quay(cv, x0, x1, y0, y1):
    """부두: 목재 판자 + 말뚝."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cv.p(x, y, WOOD['mid'] if (y - y0) % 2 == 0 else WOOD['lo'])
    cv.hl(x0, x1, y0, WOOD['hi'])
    for x in range(x0, x1 + 1, 4):
        cv.vl(x, y1 + 1, y1 + 2, WOOD['sh'])


def water_patch(cv, x0, y0, x1, y1, seed=0):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = WATER['sh']
            if (x + 2 * y + seed) % 7 == 0:
                c = WATER['lo']
            if (x + y + seed) % 11 == 0:
                c = WATER['mid']
            cv.p(x, y, c)
    for x in range(x0, x1 + 1):
        cv.p(x, y0, WATER['hi'] if (x + seed) % 3 else WATER['mid'])
