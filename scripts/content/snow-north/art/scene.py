#!/usr/bin/env python3
"""빠른 맥락 장면(굽기 전 화풍 확인용): 칸 단위 바닥(한 칸 바닥 + 오토타일 덩이) + 조각 키트를 (x, y) 칸에 놓는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, buildings as BD, props as PR
import autotile as AT
from px import h32

_cache = {}
_at = None


def piece(id_):
    if id_ in _cache: return _cache[id_]
    for reg in (TR.R, BD.R, PR.R):
        if id_ in reg.by:
            im = reg.render(reg.by[id_]).img(); _cache[id_] = im; return im
    raise KeyError(id_)


def autos():
    global _at
    if _at is None:
        _at = {a['id']: a for a in TR.build_autotiles(write=False)}
    return _at


class Scene:
    def __init__(s, W, H, ground='snow'):
        s.W, s.H = W, H
        s.g = [[ground] * W for _ in range(H)]
        s.at = [[None] * W for _ in range(H)]
        s.objs = []

    def fill(s, x, y, w, h, t):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.W and 0 <= j < s.H: s.g[j][i] = t

    def area(s, gid, cells):
        for (i, j) in cells:
            if 0 <= i < s.W and 0 <= j < s.H: s.at[j][i] = gid

    def rect(s, gid, x, y, w, h):
        s.area(gid, [(i, j) for j in range(y, y + h) for i in range(x, x + w)])

    def put(s, id_, x, y):
        s.objs.append((id_, x, y))

    def ground_img(s, i, j):
        gid = s.at[j][i]
        if gid is None: return piece(s.g[j][i])
        a = autos()[gid]
        m = 0
        for n, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
            X, Y = i + dx, j + dy
            if not (0 <= X < s.W and 0 <= Y < s.H) or s.at[Y][X] == gid: m |= AT.DIRS[n]
        m = AT.canon(m)
        if m == 255 and h32(i, j, 3) % 4 == 0: return a['bodyCells'][h32(i, j, 4) % 2].img()
        return a['cells'][m].img()

    def render(s, z=1):
        im = Image.new('RGBA', (s.W * 16, s.H * 16))
        for j in range(s.H):
            for i in range(s.W): im.alpha_composite(s.ground_img(i, j), (i * 16, j * 16))
        for id_, x, y in sorted(s.objs, key=lambda o: o[2] + piece(o[0]).height // 16):
            im.alpha_composite(piece(id_), (x * 16, y * 16))
        if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
        return im
