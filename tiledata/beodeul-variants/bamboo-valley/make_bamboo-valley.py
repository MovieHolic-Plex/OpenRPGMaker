# 대나무 숲 계곡 (bamboo-valley, 장르 wuxia) — 필드 64x48. 다시 돌리면 같은 그림이 나온다.
#   python3 make_bamboo-valley.py          전부(조각·메타·렌더·grid·검사 그림)
#   python3 make_bamboo-valley.py --quick  _qa/map1x.png 만
# 동선: 남쪽 입구(47,47) → 죽림 오솔길 북으로 → 돌 아치 다리(y30)로 개울 건너 서쪽 → 은자의 초가 사립문(24,21).
# 곁길: 오솔길 북쪽 → 죽교(y18)·정자(폭포 웅덩이 동쪽) / 다리 서쪽 → 대숲 속 돌 감실 터 / 오솔길 동쪽 → 징검다리(y41) → 물가 쉼터.
import sys, os, json, math, random
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import bv_base
import numpy as np
from PIL import Image
from bv_base import _hash, smooth
from bv_scene import Scene
import bv_build as B, bv_props as P

W, H = 64, 48
s = Scene(W, H, seed=71)
rng = random.Random(4871)
HERE = _HERE


def put(im, x, y, block='bottom', rows=1, name=None, **kw):
    s.at(im, x, y, block=block, rows=rows, name=name, **kw)


def line_cells(pts, w=2):
    """꺾은선 pts 를 따라 폭 w 칸 띠(칸 집합)."""
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            for dx in range(w):
                for dy in range(w):
                    cx, cy = int(round(x - (w - 1) / 2 + dx)), int(round(y - (w - 1) / 2 + dy))
                    if 0 <= cx < W and 0 <= cy < H: out.add((cx, cy))
    return out


# ================================================================ ① 물: 폭포 웅덩이 + 굽이치는 개울(오토타일 칸)
POOL = ["   ######  ", "  ######### ", " ##########", "  ######### ", "   ######  ", "     ###   "]
for j, row in enumerate(POOL):
    for i, c in enumerate(row):
        if c == '#': s.stream.add((35 + i, 4 + j))
def bank(y):
    c = 40 + 3 * math.sin((y - 6) / 7.0) - (y - 6) * .22
    w = 3 if _hash(y // 3, 0, 5) > .3 else 2
    L = int(round(c - w / 2.0))
    return L, L + w - 1
BANK = {}
for y in range(9, H):
    L, R = bank(y); BANK[y] = (L, R)
    for x in range(L, R + 1): s.stream.add((x, y))
for y in range(10, H):                                                  # 굽이마다 위아래 줄이 이어지게(대각선 끊김 메움)
    (l0, r0), (l1, r1) = BANK[y - 1], BANK[y]
    if l1 > r0: s.stream.add((r0 + 1, y)); s.stream.add((r0 + 1, y - 1))
    if r1 < l0: s.stream.add((l0 - 1, y)); s.stream.add((l0 - 1, y - 1))
put(B.waterfall(), 39, 3, block='all', name='waterfall')
s.marks['waterfall'] = (40, 4)

# ================================================================ ② 다리·징검다리
def span(y):
    xs = [x for (x, yy) in s.stream if yy == y]; return min(xs), max(xs)
L18, R18 = span(18)
bw = R18 - L18 + 3
put(B.bamboo_bridge(bw), L18 - 1, 18, block=None, walk=[(i, 0) for i in range(bw)], name='bamboo_bridge')
s.marks['bamboo_bridge'] = (L18 + 1, 18)
L30, R30 = span(30)
sw = R30 - L30 + 3
put(B.stone_bridge(sw), L30 - 1, 31, block=[(i, j) for i in range(sw) for j in (0, -2)], walk=[(i, -1) for i in range(sw)], name='stone_bridge')
s.marks['stone_bridge'] = (L30 + 1, 30)
L41, R41 = span(41)
for x in range(L41, R41 + 1):
    s.decal(P.stepping_stones(seed=x), x, 41, name='stepping_stones'); s.walk_ok.add((x, 41))
s.marks['stepping_stones'] = (L41, 41)

# ================================================================ ③ 오솔길(낙엽 깔린 흙길 오토타일)
P1 = [(47, 47), (47, 40), (46, 35), (R30 + 2, 31), (R30 + 2, 30)]
P1w = [(L30 - 2, 30), (27, 30), (25, 27), (24, 22)]
P1s = [(27, 30), (20, 30), (13, 28), (8, 26)]
P2 = [(46, 35), (48, 28), (47, 22), (48, 17), (49, 13)]
P3 = [(R18 + 2, 18), (47, 18)]
P4 = [(46, 41), (R41 + 1, 41)]
P4w = [(L41 - 1, 41), (28, 41), (26, 40)]
for pts, w in ((P1, 2), (P1w, 2), (P1s, 2), (P2, 2), (P3, 1), (P4, 1), (P4w, 2)):
    s.trail |= line_cells(pts, w)
s.trail -= s.stream
s.marks['south_entrance'] = (47, 47)
