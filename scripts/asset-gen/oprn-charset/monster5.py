#!/usr/bin/env python3
"""Monster5 — OPRN 자체 제작 몬스터 걷기 칩(저주받은 물건 8명). RM2K3 CharSet 288×256 RGBA.

캐릭터마다 함수 하나(mimic·armor·lantern·doll·book·scarecrow·clockwork·candle_imp).
함수는 (캔버스, 보기, 포즈) 를 받아 발 밑 한가운데(원점, y=0 이 마지막 불투명 줄)를 기준으로 그린다.
  보기  side = 왼쪽을 본다(오른쪽 보기는 좌우 반전) · front = 아래(정면) · back = 위(뒷모습)
  포즈  ph 걷기 패턴 0·1·2(1 이 서 있는 칸), step -1·0·1, 그 밖은 캐릭터별 인자(전투 15칸이 같은 함수를 쓴다).
칠하기 규칙: 부위마다 안쪽 1px 외곽선(부위끼리 겹친 곳도 선이 생긴다) + 왼쪽 위 빛 3단 음영. 알파 0/255, 캐릭터당 ≤16색.
행 순서는 RM2k 관례(0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽), 열은 걷기 패턴 0·1·2.
전투 시트(scripts/asset-gen/party-pixel/pp15_nm5.py)가 이 모듈을 불러 같은 그림으로 15칸을 만든다.
실행: python3 scripts/asset-gen/oprn-charset/monster5.py [board]
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/charsets/Monster5.png'
QA = ROOT / '.omo/nm5'


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def inner_edge(m):
    p = np.pad(m, 1)
    core = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return m & ~core


class Cv:
    """팔레트 색인 캔버스. 좌표는 원점(ox, oy) 기준 상대값."""

    def __init__(self, w, h, pal):
        self.w, self.h = w, h
        self.pal = dict(pal)
        self.keys = list(self.pal)
        self.a = np.full((h, w), -1, np.int16)
        self.ox = self.oy = 0

    def at(self, x, y):
        self.ox, self.oy = x, y
        return self

    def ki(self, k):
        return self.keys.index(k)

    # ── 마스크 ──
    def m_poly(self, pts):
        im = Image.new('1', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([(self.ox + x, self.oy + y) for x, y in pts], fill=1, outline=1)
        return np.array(im, bool)

    def m_ell(self, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        return ((xx - (self.ox + cx)) / rx) ** 2 + ((yy - (self.oy + cy)) / ry) ** 2 <= 1.0

    def m_rect(self, x0, y0, x1, y1):
        m = np.zeros((self.h, self.w), bool)
        X0, X1 = sorted((int(round(self.ox + x0)), int(round(self.ox + x1))))
        Y0, Y1 = sorted((int(round(self.oy + y0)), int(round(self.oy + y1))))
        m[max(Y0, 0):max(Y1 + 1, 0), max(X0, 0):max(X1 + 1, 0)] = True
        return m

    def m_line(self, pts, w=1):
        im = Image.new('1', (self.w, self.h), 0)
        ImageDraw.Draw(im).line([(self.ox + x, self.oy + y) for x, y in pts], fill=1, width=w)
        return np.array(im, bool)

    # ── 칠하기 ──
    def paint(self, m, ramp, out='o', shade=True):
        if isinstance(ramp, str):
            ramp = (ramp, ramp, ramp)
        ys, xs = np.nonzero(m)
        if not len(xs):
            return m
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx, ry = max((x1 - x0) / 2, 1), max((y1 - y0) / 2, 1)
        d, mi, li = (self.ki(k) for k in ramp)
        if shade:
            sv = (xs - cx) / rx * 0.55 + (ys - cy) / ry * 0.8
            val = np.where(sv < -0.42, li, np.where(sv > 0.38, d, mi))
        else:
            val = np.full(len(xs), mi)
        self.a[ys, xs] = val
        if out:
            self.a[inner_edge(m)] = self.ki(out)
        return m

    def ell(self, cx, cy, rx, ry, ramp, out='o', shade=True):
        return self.paint(self.m_ell(cx, cy, rx, ry), ramp, out, shade)

    def poly(self, pts, ramp, out='o', shade=True):
        return self.paint(self.m_poly(pts), ramp, out, shade)

    def rect(self, x0, y0, x1, y1, ramp, out='o', shade=True):
        return self.paint(self.m_rect(x0, y0, x1, y1), ramp, out, shade)

    def line(self, pts, k, w=1):
        m = self.m_line(pts, w)
        self.a[m] = self.ki(k)
        return m

    def tube(self, pts, ramp, w=3, out='o'):
        return self.paint(self.m_line(pts, w), ramp, out, shade=False)

    def px(self, x, y, k):
        X, Y = int(round(self.ox + x)), int(round(self.oy + y))
        if 0 <= X < self.w and 0 <= Y < self.h:
            self.a[Y, X] = self.ki(k)

    def pxs(self, pts, k):
        for x, y in pts:
            self.px(x, y, k)

    def get(self, x, y):
        X, Y = int(round(self.ox + x)), int(round(self.oy + y))
        if 0 <= X < self.w and 0 <= Y < self.h:
            v = self.a[Y, X]
            return None if v < 0 else self.keys[v]
        return None

    def recolor(self, m, src, dst):
        """마스크 안에서 src 색(들)만 dst 로."""
        src = [src] if isinstance(src, str) else src
        hit = m & np.isin(self.a, [self.ki(k) for k in src])
        self.a[hit] = self.ki(dst)

    def rgba(self):
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for i, k in enumerate(self.keys):
            r, g, b = hexrgb(self.pal[k])
            out[self.a == i] = (r, g, b, 255)
        return out


def flame(c, x, y, h, sway, ramp, core=None, w=2.2):
    """위로 타오르는 불꽃(외곽선 없음, 바깥 색이 테두리). (x, y) 는 불꽃 바닥 가운데."""
    d, m, l = ramp
    c.poly([(x - w, y), (x - w * 1.1, y - h * .35), (x - w * .4 + sway * .4, y - h * .7), (x + sway, y - h),
            (x + w * .6 + sway * .5, y - h * .6), (x + w * 1.1, y - h * .3), (x + w, y)], d, out=None, shade=False)
    c.poly([(x - w * .55, y - .5), (x - w * .5, y - h * .4), (x + sway * .6, y - h * .78), (x + w * .5, y - h * .35), (x + w * .5, y - .5)],
           m, out=None, shade=False)
    c.poly([(x - w * .2, y - 1), (x + sway * .3 - .2, y - h * .5), (x + w * .25, y - 1)], l, out=None, shade=False)
    if core:
        c.px(x, y - 1, core)


# ═══════════════════════ 0 미믹 ═══════════════════════
PAL_MIMIC = dict(o='1c100c', wd='5a3218', wm='8e5628', wl='c08040', gd='9a6410', gm='d8a830', gl='f8e878',
                 T='f4f0e2', M='2a0810', td='a02838', tm='e0546c', E='f8f040')


def mimic(c, view, P):
    ph, st = P.get('ph', 1), P.get('step', 0)
    lift = P.get('lift', 1 if st else 0)
    B = -2 - lift
    T = B - 10
    tongue = P.get('tongue', (-1, 0, 1)[ph])
    if view == 'side':
        lid = P.get('lid', 0.30 + 0.05 * (ph != 1))
        for lx, far in ((4 - st, True), (-5 + st, False)):
            up = 1 if (st != 0 and (far == (st < 0))) else 0
            c.rect(lx - 1, B + 1, lx + 1, -up, ('wd', 'wd', 'wm'))
            c.px(lx - 2, -up, 'o')
        c.rect(-8, T, 7, B, ('wd', 'wm', 'wl'))
        c.rect(-4, T, -2, B, ('gd', 'gm', 'gl'))
        c.rect(4, T, 6, B, ('gd', 'gm', 'gl'))
        c.rect(-8, B - 2, -6, B, ('gd', 'gm', 'gl'))
        H = (7.5, T + 0.5)
        ca, sa = math.cos(lid), math.sin(lid)

        def L(u, v):
            return (H[0] - u * ca + v * sa, H[1] - u * sa - v * ca)
        c.poly([(7, T), L(16, 0), (-8, T)], 'M', out=None, shade=False)
        c.poly([L(0, 0), L(16, 0), L(16.3, 3), L(14.5, 5), L(2, 5.5), L(0, 4)], ('wd', 'wm', 'wl'))
        c.poly([L(13.5, 0), L(16, 0), L(16.3, 3), L(14.5, 5), L(13.5, 5)], ('gd', 'gm', 'gl'))
        c.poly([L(6, 0), L(8, 0), L(8, 5.4), L(6, 5.4)], ('gd', 'gm', 'gl'))
        for x in (-7, -5, -3, -1, 1):
            if c.get(x, T - 1) == 'M':
                c.px(x, T - 1, 'T')
        for u in (15, 13, 11, 9, 7, 5):
            x, y = L(u, -0.2)
            if c.get(x, y) == 'M':
                c.px(x, y, 'T')
        for x in (-4, -2):
            for y in (T - 2, T - 3):
                if c.get(x, y) == 'M':
                    c.px(x, y, 'E')
                    break
        if tongue is not None and lid > 0.2:
            tip = (-10 + tongue, T + 4 + abs(tongue))
            c.tube([(-4, T - 1), (-8, T - 1), (-10, T + 1), tip], ('td', 'tm', 'tm'), 3)
    else:
        g = 4 if view == 'front' else 0
        for lx, side in ((-5, -1), (4, 1)):
            up = 1 if st == side else 0
            c.rect(lx - 1, B + 1, lx + 1, -up, ('wd', 'wd', 'wm'))
        c.rect(-8, T, 7, B, ('wd', 'wm', 'wl'))
        c.rect(-8, B - 2, -6, B, ('gd', 'gm', 'gl'))
        c.rect(5, B - 2, 7, B, ('gd', 'gm', 'gl'))
        top = T - g
        if view == 'front':
            c.rect(-7, top, 6, T - 1, 'M', out=None, shade=False)
        c.poly([(-8, top), (-8, top - 3), (-6, top - 5), (5, top - 5), (7, top - 3), (7, top)], ('wd', 'wm', 'wl'))
        c.rect(-8, top - 1, 7, top, ('gd', 'gm', 'gl'))
        if view == 'front':
            c.rect(-2, T + 1, 2, T + 5, ('gd', 'gm', 'gl'))
            c.px(0, T + 3, 'o')
            c.px(0, T + 4, 'o')
            for x in (-6, -4, -2, 2, 4):
                c.px(x, T - 1, 'T')
            for x in (-5, -3, 3, 5):
                c.px(x, top + 1, 'T')
            c.px(-4, T - 2, 'E')
            c.px(3, T - 2, 'E')
            if tongue is not None:
                c.tube([(0, T - 1), (tongue, T + 3), (tongue * 2, T + 6)], ('td', 'tm', 'tm'), 3)
        else:
            c.rect(-1, top - 5, 1, B, ('gd', 'gm', 'gl'))
            c.rect(-6, top - 1, -4, top + 1, ('gd', 'gm', 'gl'))
            c.rect(3, top - 1, 5, top + 1, ('gd', 'gm', 'gl'))


# ═══════════════════════ 1 살아있는 갑옷 ═══════════════════════
PAL_ARMOR = dict(o='16121e', sd='4a4e64', sm='8a92aa', sl='d2dae8', k='0e0616', pd='5a1a8a', pm='a040e0', pl='e8b0ff',
                 B='f4f8ff', hd='8a6420', hm='d0a038')


def greatsword(c, hx, hy, ang, L=15, glow=False):
    """손 (hx, hy) 에서 ang(도, 0 = 위, +90 = 뒤쪽/오른쪽) 방향으로 뻗은 대검."""
    r = math.radians(ang)
    dx, dy = math.sin(r), -math.cos(r)
    nx, ny = -dy, dx
    g0 = (hx + dx * 1.5, hy + dy * 1.5)
    tip = (hx + dx * L, hy + dy * L)
    w = 1.9
    c.poly([(g0[0] + nx * w, g0[1] + ny * w), (tip[0] - dx * 2 + nx * w, tip[1] - dy * 2 + ny * w), tip,
            (tip[0] - dx * 2 - nx * w, tip[1] - dy * 2 - ny * w), (g0[0] - nx * w, g0[1] - ny * w)],
           ('pl', 'B', 'B') if glow else ('sm', 'sl', 'B'))
    c.tube([(hx - dx * 3, hy - dy * 3), (hx + dx * .5, hy + dy * .5)], ('hd', 'hd', 'hd'), 2, out=None)
    c.px(hx - dx * 3.5, hy - dy * 3.5, 'hm')
    c.tube([(g0[0] + nx * 3.2, g0[1] + ny * 3.2), (g0[0] - nx * 3.2, g0[1] - ny * 3.2)], ('hd', 'hm', 'hm'), 3)
    return tip


def armor(c, view, P):
    ph, st = P.get('ph', 1), P.get('step', 0)
    wisp = P.get('wisp', ph)
    glow = P.get('glow', False)
    if view == 'side':
        ff, bf = -2 - 2 * st, 1 + 2 * st
        c.poly([(-.5, -10), (2.5, -10), (bf + 1.5, -2), (bf - 1.5, -2)], ('sd', 'sd', 'sm'))
        c.rect(bf - 3, -2, bf + 1, 0, ('sd', 'sd', 'sm'))
        c.rect(-3, -12, 2, -8, ('pd', 'pm', 'pl'), out=None)
        c.poly([(-2.5, -10), (.5, -10), (ff + 1.5, -2), (ff - 1.5, -2)], ('sd', 'sm', 'sl'))
        c.rect(ff - 3, -2, ff + 1, 0, ('sd', 'sm', 'sl'))
        c.rect(-3, -21, 0, -19, 'pm', out=None)
        c.rect(-4, -11, 4, -8, ('sd', 'sm', 'sm'))
        c.px(0, -9, 'o')
        sw = P.get('sword', (-3, -13, 55))
        if sw and P.get('sword_back', True):
            greatsword(c, *sw, glow=glow)
        c.poly([(-5, -19), (3, -20), (4, -11), (-4, -11), (-6, -15)], ('sd', 'sm', 'sl'))
        c.ell(-1, -23.5, 4.2, 4.2, ('sd', 'sm', 'sl'))
        c.rect(-5, -24, -2, -23, 'k', out=None)
        eye = P.get('eye', 'pl')
        c.px(-4, -24, eye)
        c.px(-3, -24, 'pm' if eye == 'pl' else eye)
        c.line([(-1, -27), (2, -26)], 'sl')
        flame(c, 3, -25, 3 + (wisp % 2), (-1, 0, 1)[wisp % 3], ('pd', 'pm', 'pl'), w=1.4)
        if sw and not P.get('sword_back', True):
            greatsword(c, *sw, glow=glow)
        hand = P.get('hand', (sw[0], sw[1]) if sw else (-3, -12))
        c.ell(1, -18, 3, 2.5, ('sd', 'sm', 'sl'))
        c.tube([(0, -16), hand], ('sd', 'sm', 'sm'), 3)
        c.ell(hand[0], hand[1], 1.6, 1.6, ('sd', 'sm', 'sl'))
    else:
        front = view == 'front'
        for fx, side in ((-2, -1), (2, 1)):
            up = 1 if st == side else 0
            c.poly([(fx - 1.5, -10), (fx + 1.5, -10), (fx + 1.5, -2 - up), (fx - 1.5, -2 - up)], ('sd', 'sm', 'sl'))
            c.rect(fx - 2, -2 - up, fx + 2, -up, ('sd', 'sm', 'sl'))
        c.rect(-3, -12, 2, -8, 'pm', out=None)
        c.rect(-5, -11, 4, -8, ('sd', 'sm', 'sm'))
        if not front:
            greatsword(c, -6, -9, 45, 17)
        else:
            greatsword(c, 7, -12, 5, 16)
        c.poly([(-6, -20), (5, -20), (4, -11), (-5, -11)], ('sd', 'sm', 'sl'))
        if front:
            c.line([(-1, -18), (0, -16), (-1, -14), (0, -12)], 'pl')
        for sx in (-6, 5):
            c.rect(sx - 1, -17, sx + 1, -11, ('sd', 'sm', 'sm'))
            c.ell(sx, -10.5, 1.5, 1.5, ('sd', 'sm', 'sl'))
            c.ell(sx, -18, 3, 2.5, ('sd', 'sm', 'sl'))
        c.rect(-2, -21, 1, -20, 'pm', out=None)
        c.ell(-.5, -23.5, 4, 4, ('sd', 'sm', 'sl'))
        if front:
            c.rect(-3, -24, 2, -23, 'k', out=None)
            c.rect(-1, -24, 0, -21, 'k', out=None)
            c.px(-2, -24, 'pl')
            c.px(1, -24, 'pl')
        else:
            c.line([(-.5, -27), (-.5, -21)], 'sd')
        flame(c, 1.5 if front else -.5, -26, 2 + (wisp % 2), (-1, 0, 1)[wisp % 3], ('pd', 'pm', 'pl'), w=1.3)


# ═══════════════════════ 2 초롱 귀신 ═══════════════════════
PAL_LANTERN = dict(o='22120a', pd='c87830', pm='f0b450', pl='fff2b8', r='a85c20', kd='2e2630', kl='5c5260',
                   W='fffff4', md='801020', td='c03050', tm='f06a80', bm='4aa0ff', bl='c8f4ff')


def lantern(c, view, P):
    ph = P.get('ph', 1)
    wisp = P.get('wisp', ph)
    tng = P.get('tongue', (-1, 0, 1)[ph])
    eye = P.get('eye', 'open')
    c.rect(-4, -26, 4, -22, ('kd', 'kd', 'kl'))
    c.pxs([(-1, -27), (0, -28), (1, -27)], 'kd')
    body = c.ell(0, -14, 7, 8.6, ('pd', 'pm', 'pl'))
    inner = body & ~inner_edge(body)
    for y in (-19, -16, -13, -10, -7):
        c.recolor(inner & c.m_rect(-9, y, 9, y), ['pd', 'pm', 'pl'], 'r')
    c.rect(-4, -6, 4, -3, ('kd', 'kd', 'kl'))
    wx = [(8, -21), (9, -17), (8, -13)][wisp % 3]
    if view == 'side':
        if eye == 'open':
            c.ell(-3, -15, 2.6, 3, 'W')
            c.rect(-5, -15, -4, -14, 'o', out=None)
        elif eye == 'shut':
            c.line([(-5, -15), (-1, -14)], 'o')
        else:
            c.line([(-5, -17), (-2, -14)], 'o')
            c.line([(-5, -14), (-2, -17)], 'o')
        mo = P.get('mouth', 1)
        c.poly([(-7.8, -11 - mo), (-2, -10), (-7.6, -8 + mo)], 'md', out=None, shade=False)
        if tng is not None:
            c.tube([(-5, -9), (-9, -8), (-10 + tng, -5), (-8 + tng, -2)], ('td', 'tm', 'tm'), 3)
        if P.get('wisp_on', True):
            flame(c, wx[0], wx[1], 5, (-1, 0, 1)[wisp % 3], ('bm', 'bm', 'bl'), 'bl', 1.6)
    elif view == 'front':
        if eye == 'open':
            c.ell(0, -16, 3, 3.2, 'W')
            c.rect(-1, -16, 0, -15, 'o', out=None)
        c.poly([(-6.6, -10.5), (6.6, -10.5), (0, -8.5)], 'md', out=None, shade=False)
        if tng is not None:
            c.tube([(0, -9), (tng, -6), (tng * 2, -3), (tng, -1)], ('td', 'tm', 'tm'), 3)
        flame(c, (-9, 9, -9)[wisp % 3], (-18, -12, -12)[wisp % 3], 5, (-1, 0, 1)[wisp % 3], ('bm', 'bm', 'bl'), 'bl', 1.6)
    else:
        c.rect(1, -18, 4, -14, ('pm', 'pl', 'pl'))
        c.px(2, -16, 'r')
        flame(c, (9, -9, 9)[wisp % 3], (-19, -13, -13)[wisp % 3], 5, (-1, 0, 1)[wisp % 3], ('bm', 'bm', 'bl'), 'bl', 1.6)


# ═══════════════════════ 3 저주 인형 ═══════════════════════
PAL_DOLL = dict(o='1a0e16', cd='b08470', cm='e2c2aa', cl='faeadc', hd='2a1a34', hm='503458', dd='5a1022', dm='9a2034',
                dl='d05a6a', B='8a98b8', S='ece4f4', wd='7a5230', wl='a87848')


def doll(c, view, P):
    ph, st = P.get('ph', 1), P.get('step', 0)
    bx = P.get('bar', (1, 0, -1)[ph])
    by = P.get('bar_y', -27)
    strings = P.get('strings', True)
    hands = P.get('hands', None)
    if view == 'side':
        ff, bf = -1 - st * 2, 1 + st * 2
        for fx, far in ((bf, True), (ff, False)):
            c.poly([(-1, -6), (1.5, -6), (fx + 1, -1), (fx - 1, -1)], ('cd', 'cd', 'cm') if far else ('cd', 'cm', 'cl'))
            c.rect(fx - 2, -2, fx + 1, 0, ('hd', 'hm', 'hm'))
        c.poly([(-3, -13), (3, -13), (5, -5), (-5, -5)], ('dd', 'dm', 'dl'))
        for x in range(-4, 5, 2):
            c.px(x, -6, 'dl')
        c.ell(0, -17.5, 5, 5, ('cd', 'cm', 'cl'))
        c.poly([(-4, -21), (-1, -23), (4, -22), (6, -17), (5, -11), (2, -11), (3, -16), (1, -19), (-1, -20), (-5, -20)], ('hd', 'hm', 'hm'))
        eye = P.get('eye', 'button')
        if eye == 'button':
            c.rect(-4, -18, -3, -17, 'o', out=None)
            c.px(-4, -18, 'B')
        else:
            c.pxs([(-4, -18), (-3, -17), (-4, -16), (-2, -18), (-2, -16)], 'o')
        c.pxs([(-4, -14), (-2, -14), (-3, -15), (-3, -13)], 'o')
        c.px(-3, -14, 'dd')
        hand = hands[0] if hands else (-4, -10 - (ph == 1))
        c.tube([(1, -12), hand], ('cd', 'cm', 'cm'), 3)
        c.ell(hand[0], hand[1], 1.4, 1.4, ('cd', 'cm', 'cl'))
        tops = [(hand[0], hand[1]), (0, -22), (3, -12)]
    else:
        front = view == 'front'
        for fx, side in ((-2, -1), (2, 1)):
            up = 1 if st == side else 0
            c.rect(fx - 1, -6, fx + 1, -1 - up, ('cd', 'cm', 'cl'))
            c.rect(fx - 1, -2 - up, fx + 1, -up, ('hd', 'hm', 'hm'))
        c.poly([(-3, -13), (3, -13), (5, -5), (-5, -5)], ('dd', 'dm', 'dl'))
        for x in range(-4, 5, 2):
            c.px(x, -6, 'dl')
        hl, hr = hands if hands else ((-6, -9 - (ph == 0)), (6, -9 - (ph == 2)))
        for sx, h in ((-2, hl), (2, hr)):
            c.tube([(sx, -12), h], ('cd', 'cm', 'cm'), 3)
            c.ell(h[0], h[1], 1.4, 1.4, ('cd', 'cm', 'cl'))
        c.ell(0, -17.5, 5, 5, ('cd', 'cm', 'cl'))
        if front:
            c.poly([(-5, -18), (-4, -22), (0, -23), (4, -22), (5, -18), (6, -11), (4, -11), (4, -18), (2, -20), (-2, -20), (-4, -18), (-4, -11), (-6, -11)], ('hd', 'hm', 'hm'))
            c.rect(-3, -18, -2, -17, 'o', out=None)
            c.px(-3, -18, 'B')
            c.pxs([(1, -18), (2, -17), (1, -16), (3, -18), (3, -16)], 'o')
            c.pxs([(-2, -14), (0, -14), (2, -14), (-1, -15), (1, -15), (-1, -13), (1, -13)], 'o')
        else:
            c.poly([(-5, -18), (-4, -22), (0, -23), (4, -22), (5, -18), (6, -11), (-6, -11)], ('hd', 'hm', 'hm'))
            c.poly([(-4, -15), (0, -13), (4, -15), (4, -11), (0, -12), (-4, -11)], ('dd', 'dm', 'dl'))
        tops = [hl, hr, (0, -22)]
    if strings:
        c.rect(bx - 6, by - 1, bx + 6, by + 1, ('wd', 'wl', 'wl'))
        c.rect(bx - 1, by - 2, bx + 1, by + 2, ('wd', 'wl', 'wl'))
        for (tx, ty), sx in zip(tops, (-5, 5, 0)):
            c.line([(tx, ty - 1), (bx + sx * .9, by + 2)], 'S')


# ═══════════════════════ 4 마도서 ═══════════════════════
PAL_BOOK = dict(o='140c1c', vd='3a1450', vm='6a2890', vl='a058c8', G='e0b040', pd='b0a894', pm='e6decc', pl='fffcf0',
                M='3a0818', R='d83040', E='f8f040', C='60f0e0')


def book(c, view, P):
    ph = P.get('ph', 1)
    op = P.get('open', (0.35, 0.55, 0.75)[ph])
    flap = P.get('flap', (-3, 0, 3)[ph])
    H = (3, -13)
    L = 13
    if view == 'side':
        a = math.radians(14 + 30 * op)
        b = math.radians(8 + 20 * op)
        ca, sa, cb, sb = math.cos(a), math.sin(a), math.cos(b), math.sin(b)

        def U(u, v):
            return (H[0] - u * ca + v * sa, H[1] - u * sa - v * ca)

        def D(u, v):
            return (H[0] - u * cb + v * sb, H[1] + u * sb + v * cb)
        c.poly([(H[0] + 1, H[1] - 3), (H[0] + 6, H[1] - 8 + flap), (H[0] + 8, H[1] - 5 + flap), (H[0] + 3, H[1] - 1)], ('pd', 'pm', 'pl'))
        c.poly([H, U(L, 0), D(L, 0)], 'M', out=None, shade=False)
        for J in (D, U):
            c.poly([J(0, -.2), J(L - .5, -.2), J(L - .5, 2.6), J(0, 2.6)], ('pd', 'pm', 'pl'))
            c.poly([J(0, 2), J(L, 2), J(L + .3, 5), J(0, 5)], ('vd', 'vm', 'vl'))
            c.poly([J(L - 2.5, 2), J(L, 2), J(L + .3, 5), J(L - 2.5, 5)], 'G', shade=False)
            for u in (3.5, 5.5, 7.5, 9.5, 11.5):
                x, y = J(u, -.9)
                if c.get(x, y) == 'M':
                    c.px(x, y, 'pl')
        eye = P.get('eye', 'open')
        ex, ey = U(7.5, 3.4)
        if eye == 'open':
            c.px(ex - 1, ey, 'E')
            c.px(ex, ey, 'o')
            c.px(ex + 1, ey, 'E')
        else:
            c.px(ex - 1, ey, 'o')
            c.px(ex + 1, ey, 'o')
        if P.get('tongue', True):
            t = D(8, -2.5)
            c.tube([(H[0] - 2, H[1] + .5), (t[0] - 1, t[1]), (t[0] - 3, t[1] + 4 + (ph == 2))], ('R', 'R', 'R'), 3)
        c.ell(H[0] + 1.5, H[1], 2.6, 4.6, ('vd', 'vm', 'vl'))
        c.pxs([(H[0] + 1, H[1] - 2), (H[0] + 2, H[1] - 2), (H[0] + 1, H[1] + 2), (H[0] + 2, H[1] + 2)], 'G')
    else:
        g = int(round(1 + 3 * op))
        top, bot = -18 - g // 2, -12 + (g - g // 2)
        for s in (-1, 1):
            c.poly([(s * 6, -16), (s * 11, -21 + flap), (s * 12, -17 + flap), (s * 6, -13)], ('pd', 'pm', 'pl'))
        if view == 'front':
            c.rect(-6, top, 5, bot, 'M', out=None, shade=False)
            c.rect(-7, top - 3, 6, top, ('pd', 'pm', 'pl'))
            c.rect(-7, bot, 6, bot + 3, ('pd', 'pm', 'pl'))
            for x in (-5, -3, -1, 1, 3):
                c.px(x, top + 1, 'pl')
                c.px(x + 1, bot - 1, 'pl')
            c.rect(-8, top - 7, 7, top - 2, ('vd', 'vm', 'vl'))
            c.rect(-8, bot + 2, 7, bot + 6, ('vd', 'vm', 'vl'))
            for x0 in (-8, 5):
                c.rect(x0, top - 7, x0 + 2, top - 5, 'G', shade=False)
                c.rect(x0, bot + 4, x0 + 2, bot + 6, 'G', shade=False)
            eye = P.get('eye', 'open')
            if eye == 'open':
                c.ell(-.5, top - 4.5, 2.2, 1.6, 'E')
                c.px(-.5, top - 4.5, 'o')
            if P.get('tongue', True):
                c.tube([(0, bot - 2), ((-1, 0, 1)[ph], bot + 3), ((-1, 0, 1)[ph] * 2, bot + 8)], ('R', 'R', 'R'), 3)
        else:
            c.rect(-8, top - 7, 7, top - 2, ('vd', 'vm', 'vl'))
            c.rect(-8, bot + 2, 7, bot + 6, ('vd', 'vm', 'vl'))
            c.rect(-3, top - 6, 2, bot + 5, ('vd', 'vm', 'vl'))
            for y in (top - 5, (top + bot) // 2, bot + 3):
                c.rect(-3, y, 2, y + 1, 'G', shade=False)
            c.px(-1, (top + bot) // 2 - 3, 'C')
            c.px(0, (top + bot) // 2 + 3, 'C')


# ═══════════════════════ 5 허수아비 ═══════════════════════
PAL_SCARE = dict(o='1e140a', sd='9a7650', sm='cca878', zm='d8b040', zl='f8e27e', hd='5a3e20', hm='8e6a38', bd='2a4a72',
                 bm='4a7aac', X='b03a30', Ld='8e9cb0', Ll='eef4fa', K='26242e', E='ff8020')


def scythe(c, x, y, ang, L=21):
    """손 (x, y) 가 쥔 낫. ang 0 = 자루가 위로 곧게, 날은 자루 끝에서 앞(왼쪽)으로 휜다. 양수 = 뒤로 기울임."""
    r = math.radians(ang)
    dx, dy = math.sin(r), -math.cos(r)
    b0 = (x - dx * 8, y - dy * 8)
    top = (x + dx * (L - 8), y + dy * (L - 8))
    c.tube([b0, top], ('hd', 'hd', 'hm'), 3)
    nx, ny = -dy, dx  # 오른쪽 법선

    def P_(u, v):
        return (top[0] - nx * u + dx * v, top[1] - ny * u + dy * v)
    c.poly([P_(-1, 1), P_(3, 1.8), P_(7, .5), P_(10, -3), P_(7, -1.5), P_(3, -.8), P_(-1, -1)], ('Ld', 'Ll', 'Ll'))
    return top


def scarecrow(c, view, P):
    ph = P.get('ph', 1)
    crow = P.get('crow', ph)
    if view == 'side':
        c.rect(-1, -10, 1, 0, ('hd', 'hd', 'hm'))
        for x, h in ((-4, 3), (-1, 2), (2, 3), (4, 2)):
            c.poly([(x - 1, -10), (x + 1, -10), (x + (ph - 1) * .5, -10 + h)], 'zm', out='o', shade=False)
        sc = P.get('scythe', (-2, -14, 0))
        if sc and P.get('scythe_back', True):
            scythe(c, *sc)
        c.poly([(-4, -18), (4, -18), (5, -10), (-5, -10)], ('bd', 'bm', 'bm'))
        c.rect(1, -15, 3, -13, 'X', shade=False)
        c.ell(0, -21, 4.6, 4.2, ('sd', 'sm', 'sm'))
        c.pxs([(-2, -17), (0, -17), (2, -17)], 'zl')
        c.rect(-8, -25, 7, -23, ('hd', 'hm', 'hm'))
        c.poly([(-4, -25), (3, -25), (4, -27), (6, -28), (2, -29), (-3, -27)], ('hd', 'hm', 'hm'))
        c.pxs([(-1, -26), (0, -26)], 'X')
        eye = P.get('eye', 'E')
        c.px(-3, -21, eye)
        c.px(-2, -21, eye if eye == 'E' else 'o')
        c.pxs([(-4, -19), (-3, -18), (-2, -19), (-1, -18)], 'o')
        if sc and not P.get('scythe_back', True):
            scythe(c, *sc)
        hand = P.get('hand', (sc[0], sc[1]) if sc else (-5, -14))
        c.tube([(1, -17), hand], ('bd', 'bm', 'bm'), 3)
        c.pxs([(hand[0] - 1, hand[1] - 1), (hand[0] - 1, hand[1] + 1), (hand[0] - 2, hand[1])], 'zl')
        if crow is not None:
            cx, cy = P.get('crow_at', (5, -19 - (crow == 2)))
            c.ell(cx + .5, cy, 2.2, 1.6, 'K')
            c.ell(cx - 1, cy - 2, 1.4, 1.3, 'K')
            c.px(cx - 3, cy - 2, 'E')
            c.px(cx - 1, cy - 2, 'E')
            if crow == 0:
                c.pxs([(cx + 1, cy - 2), (cx + 2, cy - 3)], 'K')
    else:
        front = view == 'front'
        c.rect(-1, -10, 1, 0, ('hd', 'hd', 'hm'))
        for x, h in ((-4, 3), (-2, 2), (0, 3), (2, 2), (4, 3)):
            c.poly([(x - 1, -10), (x + 1, -10), (x + (ph - 1) * .5, -10 + h)], 'zm', shade=False)
        c.rect(-10, -18, 9, -15, ('bd', 'bm', 'bm'))
        for s in (-1, 1):
            hx = -11 if s < 0 else 10
            c.pxs([(hx, -18 + ph), (hx, -16), (hx - s, -15 + (ph == 2))], 'zl')
        c.poly([(-4, -18), (3, -18), (4, -10), (-5, -10)], ('bd', 'bm', 'bm'))
        c.rect(-3 if front else 0, -14, -1 if front else 2, -12, 'X', shade=False)
        c.ell(-.5, -21, 4.6, 4.2, ('sd', 'sm', 'sm'))
        c.rect(-8, -25, 7, -23, ('hd', 'hm', 'hm'))
        c.poly([(-4, -25), (3, -25), (3, -27), (5, -28), (1, -29), (-3, -27)], ('hd', 'hm', 'hm'))
        if front:
            c.pxs([(-3, -21), (-2, -21)], 'E')
            c.pxs([(1, -22), (2, -21), (1, -20), (3, -22), (3, -20)], 'o')
            c.pxs([(-3, -19), (-2, -18), (-1, -19), (0, -18), (1, -19), (2, -18)], 'o')
        c.pxs([(-2, -17), (0, -17), (1, -17)], 'zl')
        scythe(c, -9, -16, -8, 17) if front else scythe(c, 9, -16, 8, 17)
        if P.get('crow', ph) is not None:
            cx, cy = (6, -20 - (crow == 2)) if front else (-7, -20 - (crow == 2))
            c.ell(cx, cy, 2, 1.6, 'K')
            c.ell(cx, cy - 2, 1.3, 1.3, 'K')
            if front:
                c.px(cx, cy - 1, 'E')
            if crow == 0:
                c.pxs([(cx - 2, cy - 1), (cx + 2, cy - 1)], 'K')


# ═══════════════════════ 6 태엽 병정 ═══════════════════════
PAL_CLOCK = dict(o='181018', rd='901820', rm='d83838', nd='1a2a6a', nm='3052b0', nl='6484e0', W='f2f0e6', F='f2caa2',
                 P='e07474', gd='8a6010', gm='dcaa30', K='2a2832', wd='6a4022', mm='8c94a4')


def windkey(c, x, y, k, back=False):
    """등 태엽. k 회전 단계(0 정면·1 반쯤·2 옆날)."""
    c.tube([(x - 2, y), (x + 1, y)], ('gd', 'gd', 'gd'), 2, out=None)
    if back:
        rx = (3.0, 1.8, .9)[k % 3]
        c.ell(x - rx - .3, y - .5, rx + .3, 1.8, ('gd', 'gm', 'gm'))
        c.ell(x + rx + .3, y - .5, rx + .3, 1.8, ('gd', 'gm', 'gm'))
        return
    ry = (2.0, 1.3, .8)[k % 3]
    if k % 3 == 2:
        c.rect(x + 1, y - 5, x + 2, y + 4, ('gd', 'gm', 'gm'), out='o')
    else:
        c.ell(x + 2.5, y - 2.6, ry + .6, 2.2, ('gd', 'gm', 'gm'))
        c.ell(x + 2.5, y + 2.2, ry + .6, 2.2, ('gd', 'gm', 'gm'))


def musket(c, bx, by, ang, L=16, flash=False):
    """개머리 (bx, by) 에서 ang(0 = 위, -90 = 앞/왼쪽) 방향 총."""
    r = math.radians(ang)
    dx, dy = math.sin(r), -math.cos(r)
    mid = (bx + dx * 6, by + dy * 6)
    tip = (bx + dx * L, by + dy * L)
    c.tube([(bx, by), mid], ('wd', 'wd', 'wd'), 3)
    c.tube([mid, tip], ('mm', 'mm', 'mm'), 2, out=None)
    c.line([(mid[0] - dy * .8, mid[1] + dx * .8), (tip[0] - dy * .8, tip[1] + dx * .8)], 'o')
    return tip


def clockwork(c, view, P):
    ph, st = P.get('ph', 1), P.get('step', 0)
    key = P.get('key', ph)
    if view == 'side':
        ff, bf = -1 - 2 * st, 2 + 2 * st
        gun = P.get('gun', ('carry',))
        for fx, far in ((bf, True), (ff, False)):
            c.poly([(fx * .3 - 1.5 + (0 if far else -1), -9), (fx * .3 + 1.5 + (0 if far else -1), -9), (fx + 1.5, -3), (fx - 1.5, -3)],
                   ('mm', 'W', 'W') if far else ('W', 'W', 'W'))
            c.rect(fx - 3, -3, fx + 1, 0, 'K', shade=False)
        c.poly([(1, -12), (5, -12), (6, -6), (2, -7)], ('nd', 'nm', 'nm'))
        windkey(c, 5, -14, key)
        if gun[0] == 'carry':
            musket(c, -1, -9, 12, 18)
        c.rect(-4, -17, 3, -10, ('nd', 'nm', 'nl'))
        c.line([(-3, -16), (2, -11)], 'W')
        c.rect(-4, -11, 3, -10, 'K', shade=False)
        c.pxs([(-3, -15), (-3, -13)], 'gm')
        c.ell(-1, -19.5, 3.3, 3.3, 'F')
        c.px(-3, -20, 'K')
        c.px(-3, -18, 'P')
        c.pxs([(-4, -18), (-3, -17)], 'K') if P.get('mouth') == 'open' else c.px(-4, -18, 'K')
        c.rect(-4, -26, 2, -22, ('rd', 'rm', 'rm'))
        c.rect(-5, -22, 2, -22, 'K', out=None)
        c.rect(-4, -25, -2, -23, 'gm', out=None)
        c.ell(-1, -27, 1.4, 1.6, 'W')
        c.px(0, -19, 'gm')
        if gun[0] == 'aim':
            _, bx, by, ang = gun
            musket(c, bx, by, ang, 16)
            hand = (bx - 3, by)
        else:
            hand = P.get('hand', (-1, -13))
        c.tube([(0, -16), hand], ('nd', 'nm', 'nm'), 3)
        c.ell(hand[0], hand[1], 1.3, 1.3, 'F')
    else:
        front = view == 'front'
        for fx, side in ((-2, -1), (1, 1)):
            up = 1 if st == side else 0
            c.rect(fx - 1, -9, fx + 1, -3 - up, 'W', shade=False)
            c.rect(fx - 2 + (side > 0), -3 - up, fx + 1 + (side > 0), -up, 'K', shade=False)
        if front:
            windkey(c, -.5, -14, key, back=True)
            musket(c, 6, -5, 0, 20)
        c.rect(-4, -17, 3, -10, ('nd', 'nm', 'nl'))
        c.rect(-4, -11, 3, -10, 'K', shade=False)
        if front:
            c.line([(-3, -16), (2, -11)], 'W')
            c.line([(2, -16), (-3, -11)], 'W')
            c.pxs([(-1, -16), (-1, -13)], 'gm')
        for sx in (-5, 4):
            c.rect(sx - 1, -17, sx + 1, -11, ('nd', 'nm', 'nm'))
            c.ell(sx, -10.5, 1.3, 1.3, 'F')
        c.ell(-.5, -19.5, 3.3, 3.3, 'F' if front else 'K')
        if front:
            c.pxs([(-2, -20), (1, -20)], 'K')
            c.pxs([(-3, -18), (2, -18)], 'P')
            c.px(-.5, -18, 'K')
        c.rect(-4, -26, 3, -22, ('rd', 'rm', 'rm'))
        c.rect(-4, -22, 3, -22, 'K', out=None)
        if front:
            c.rect(-2, -25, 1, -23, 'gm', out=None)
        c.ell(-.5, -27, 1.4, 1.6, 'W')
        if not front:
            windkey(c, -.5, -14, key, back=True)
            musket(c, -6, -5, 0, 20)


# ═══════════════════════ 7 촛불 임프 ═══════════════════════
PAL_IMP = dict(o='2a1008', xd='c0a078', xm='f0dfbc', xl='fffcf0', fd='e04010', fm='f89020', fl='fff060', W='ffffff',
               hd='5a2a18', M='a02010')


def candle_imp(c, view, P):
    ph, st = P.get('ph', 1), P.get('step', 0)
    fh = P.get('flame', (6, 7, 8)[ph])
    sway = P.get('sway', (-1, 0, 1)[ph])
    if P.get('puddle', True):
        c.ell(0, -1, 6, 1.3, ('xd', 'xm', 'xm'))
    if view == 'side':
        c.tube([(3, -6), (7, -8), (8, -12)], ('xd', 'xd', 'xd'), 2, out=None)
        c.pxs([(8, -12), (8, -13)], 'xd')
        flame(c, 8, -13, 3, sway, ('fd', 'fm', 'fl'), w=1.0)
        for fx, far in ((1 + st, True), (-2 - st, False)):
            up = 1 if (st != 0 and far == (st > 0)) else 0
            c.rect(fx - 1, -4, fx + 1, -1 - up, ('xd', 'xd', 'xm') if far else ('xd', 'xm', 'xl'))
        c.poly([(-4, -12), (3, -12), (4, -4), (-4, -4)], ('xd', 'xm', 'xl'))
        c.pxs([(-3, -11), (-3, -10), (-3, -9), (2, -11), (2, -10)], 'xl')
        c.ell(-.5, -14.5, 4.5, 3.8, ('xd', 'xm', 'xl'))
        c.pxs([(-2, -18), (-3, -19)], 'hd')
        c.pxs([(2, -18), (3, -19)], 'hd')
        c.pxs([(-4, -15), (-3, -15)], P.get('eye', 'fl'))
        c.px(-4, -16, 'o')
        c.pxs([(-4, -13), (-3, -13), (-2, -12)], 'M')
        c.px(-3, -12, 'xl')
        c.px(0, -18, 'hd')
        flame(c, 0, -18, fh, sway, ('fd', 'fm', 'fl'), 'W', 2.3)
        hand = P.get('hand', (-6, -8 - (ph == 1)))
        c.tube([(-2, -9), hand], ('xd', 'xm', 'xm'), 3)
        if P.get('hand_flame', True):
            flame(c, hand[0], hand[1] - 1, 3 + (ph == 1), -sway, ('fd', 'fm', 'fl'), w=1.0)
    else:
        front = view == 'front'
        if front:
            c.tube([(3, -6), (7, -9), (7, -12)], ('xd', 'xd', 'xd'), 2, out=None)
            flame(c, 7, -13, 3, sway, ('fd', 'fm', 'fl'), w=1.0)
        for fx, side in ((-2, -1), (1, 1)):
            up = 1 if st == side else 0
            c.rect(fx - 1, -4, fx + 1, -1 - up, ('xd', 'xm', 'xl'))
        c.poly([(-4, -12), (3, -12), (4, -4), (-4, -4)], ('xd', 'xm', 'xl'))
        c.pxs([(-3, -11), (-3, -10), (-3, -9), (1, -11), (1, -10)], 'xl')
        for s, sx in ((-1, -4), (1, 3)):
            c.tube([(sx, -9), (sx + s * 3, -7 - (ph == (0 if s < 0 else 2)))], ('xd', 'xm', 'xm'), 3)
        c.ell(-.5, -14.5, 4.5, 3.8, ('xd', 'xm', 'xl'))
        c.pxs([(-3, -18), (-4, -19), (2, -18), (3, -19)], 'hd')
        if front:
            c.pxs([(-3, -15), (-2, -15), (1, -15), (2, -15)], 'fl')
            c.pxs([(-3, -16), (2, -16)], 'o')
            c.pxs([(-2, -13), (-1, -13), (0, -13), (1, -13), (-1, -12), (0, -12)], 'M')
            c.pxs([(-1, -13), (1, -13)], 'xl')
        else:
            c.tube([(0, -5), (1, -8), (3, -12), (4, -14)], ('xd', 'xd', 'xd'), 2, out=None)
            flame(c, 4, -15, 3, sway, ('fd', 'fm', 'fl'), w=1.0)
        flame(c, -.5, -18, fh, sway, ('fd', 'fm', 'fl'), 'W', 2.3)


CHARS = [(mimic, PAL_MIMIC), (armor, PAL_ARMOR), (lantern, PAL_LANTERN), (doll, PAL_DOLL),
         (book, PAL_BOOK), (scarecrow, PAL_SCARE), (clockwork, PAL_CLOCK), (candle_imp, PAL_IMP)]
# 떠다니는 몸(초롱·마도서): 발밑 원점을 위로 띄운다(칩 칸 안 높이).
HOVER = {2: 0, 4: 2}
# 전투 시트의 부유 높이(칩 칸은 32px 로 좁아 위 여백을 위해 덜 띄운다).
BATTLE_HOVER = {2: 3, 4: 5}


def chip_frame(i, d, p, pose=None):
    """캐릭터 i 의 방향 d(0 위·1 오른쪽·2 아래·3 왼쪽), 패턴 p(0·1·2) 24×32 칸(RGBA)."""
    fn, pal = CHARS[i]
    c = Cv(24, 32, pal)
    step = (-1, 0, 1)[p]
    bob = HOVER.get(i, 0) + (1 if (i in HOVER and p != 1) else 0)
    c.at(12, 30 - bob)
    view = {0: 'back', 1: 'side', 2: 'front', 3: 'side'}[d]
    P = dict(ph=p, step=step)
    if pose:
        P.update(pose)
    fn(c, view, P)
    rgba = c.rgba()
    if d == 1:
        rgba = rgba[:, ::-1].copy()
    return rgba, c


def build():
    sheet = np.zeros((256, 288, 4), np.uint8)
    for i in range(8):
        bx, by = i % 4 * 72, i // 4 * 128
        for d in range(4):
            for p in range(3):
                fr, _ = chip_frame(i, d, p)
                sheet[by + d * 32: by + d * 32 + 32, bx + p * 24: bx + p * 24 + 24] = fr
    return sheet


def validate(sheet):
    errs = []
    if sheet.shape != (256, 288, 4):
        errs.append('size')
    if not np.isin(sheet[:, :, 3], (0, 255)).all():
        errs.append('alpha')
    for i in range(8):
        bx, by = i % 4 * 72, i // 4 * 128
        blk = sheet[by:by + 128, bx:bx + 72]
        cols = {tuple(v) for v in blk[blk[:, :, 3] == 255][:, :3]}
        if len(cols) > 16:
            errs.append(f'char{i} colors {len(cols)}')
        cells = []
        for d in range(4):
            for p in range(3):
                cell = blk[d * 32:d * 32 + 32, p * 24:p * 24 + 24]
                a = cell[:, :, 3] > 0
                if not a.any():
                    errs.append(f'char{i} d{d}p{p} empty')
                    continue
                ys = np.nonzero(a.any(1))[0]
                if ys.max() > 30:
                    errs.append(f'char{i} d{d}p{p} bottom {ys.max()}')
                cells.append(cell.tobytes())
        if len(set(cells)) != len(cells):
            errs.append(f'char{i} duplicate cells')
    return errs


def board(sheet, scale=4):
    bg = Image.new('RGBA', (288 * scale, 256 * scale), (40, 120, 120, 255))
    im = Image.fromarray(sheet).resize((288 * scale, 256 * scale), Image.NEAREST)
    bg.alpha_composite(im)
    return bg


if __name__ == '__main__':
    sh = build()
    errs = validate(sh)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sh).save(OUT)
    QA.mkdir(parents=True, exist_ok=True)
    board(sh, 3).save(QA / 'a-charset-x3.png')
    board(sh, 4).save(QA / 'a-charset-x4.png')
    print('Monster5.png', sh.shape, 'errors:', errs or 'none')

