"""dovecote · windmill · lighthouse · wizard-tower 공용 원통 붓(이 네 건물 전용).
guildhall 의 lib4/common/pix 사본 위에 더한 것: 원뿔대(위로 가늘어지는) 원통 벽, 둘레 띠, 원통 위 화소 붙이기,
재질 어두운 단 바깥 윤곽. 난수·잡음 없음. 빛은 왼쪽 위."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib4 import Canvas, pix, ST, sclamp, fill_walk, tc_cone, cone_eave, pink_ashlar  # noqa: E402,F401
import common  # noqa: E402,F401

PINK = {'U': 'J', 'W': 't', 'Y': 't', 'a': 't', 'e': 'u', 'i': 'v', 'j': 'x', 'k': 'y', 'm': 'z', 'n': '0',
        'r': '2', 's': '4', 'p': 'z', 'g': 'w', 'o': '0', 'f': 'v'}


def taper_wall(c, cx, rfun, y0, y1, ash, sag, extra=None, remap=None, mask=None):
    """원뿔대 원통 앞면. rfun(y) = 그 높이의 반지름. 윗선·줄눈·밑선이 가운데서 sag 만큼 처진다.
    u 는 둘레 길이(바닥 반지름 기준)라 돌이 위로 갈수록 좁아진다."""
    rb = rfun(y1)
    rmax = max(rfun(y0), rb)
    for x in range(int(math.floor(cx - rmax)) - 1, int(math.ceil(cx + rmax)) + 2):
        for y in range(y0 - sag, y1 + 1):
            r = rfun(y)
            dx = x + 0.5 - cx
            if abs(dx) > r:
                continue
            cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
            dy = sag * cosv
            if y < y0 + round(dy) - sag:
                continue
            if y > y1 - round(sag * (1 - cosv)):
                continue
            if mask and not mask(x, y):
                continue
            u = math.asin(max(-1, min(1, dx / r))) * rb + 200
            s = pix.cyl_shade(dx, r) + (extra(x, y) if extra else 0)
            ch = ash.color(u, y - y0 - dy + sag, s)
            if ch:
                if remap:
                    ch = remap.get(ch, ch)
                c.put(x, y, ch)


def ring_y(cx, r, y, sag, x):
    dx = x + 0.5 - cx
    if abs(dx) > r:
        return None
    return y + round(sag * math.sqrt(max(0.0, 1 - (dx / r) ** 2)))


def on_cyl(cx, r, x):
    """원통 위 가로 위치 → (dx, cos, 밝기)."""
    dx = x + 0.5 - cx
    if abs(dx) > r:
        return None
    return dx, math.sqrt(max(0.0, 1 - (dx / r) ** 2)), pix.cyl_shade(dx, r)


def outline(c, mapping, x0=0, x1=None, y0=0, y1=None, sides=((1, 0), (-1, 0), (0, -1))):
    x1 = c.w - 1 if x1 is None else x1
    y1 = c.h - 1 if y1 is None else y1
    pts = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ch = c.get(x, y)
            if ch == '.':
                continue
            edge = any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or c.get(x + ax, y + ay) == '.'
                       for ax, ay in sides)
            if edge and ch in mapping:
                pts.append((x, y, mapping[ch]))
    for x, y, ch in pts:
        c.put(x, y, ch)


# 돌 바깥 테: 밝은 왼쪽은 중간 회색, 오른쪽은 어두운 회색 — 먹선 아님
def stone_edge_map(left):
    if left:
        return {ch: 'e' for ch in ST} | {k: 'v' for k in 'tuvwxyz0123'}
    return {ch: 'Y' for ch in ST} | {k: 't' for k in 'tuvwxyz0123'}


def darken(ch, n=1):
    D = {'s': 'r', 'r': 'n', 'n': 'm', 'm': 'k', 'k': 'j', 'j': 'i', 'i': 'e', 'e': 'a', 'a': 'Y', 'Y': 'W', 'W': 'U',
         'p': 'k', 'o': 'n', 'h': 'g', 'g': 'e', 'f': 'e',
         '5': '4', '4': '3', '3': '2', '2': '1', '1': 'z', '0': 'z', 'z': 'y', 'y': 'x', 'x': 'w', 'w': 'v', 'v': 'u', 'u': 't', 't': 'J',
         'L': 'ρ', 'ρ': 'π', 'π': '<', '<': '?', '?': '=', '=': '+', '+': '&', '&': '%', '%': '9', '9': '6',
         'σ': 'ξ', 'ξ': 'η', 'η': 'ζ', 'ζ': 'ε', 'ε': 'δ', 'δ': 'γ', 'γ': '-', '-': '_', 'ν': 'λ', 'λ': 'θ', 'θ': 'ι',
         'H': 'G', 'G': 'F', 'F': 'E', 'E': 'C', 'C': 'B'}
    for _ in range(n):
        ch = D.get(ch, ch)
    return ch
