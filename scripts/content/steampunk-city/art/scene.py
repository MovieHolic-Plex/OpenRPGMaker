#!/usr/bin/env python3
"""조각 그림으로 빠른 맥락 장면을 그린다(굽기 전 화풍 확인용). 칸 단위 바닥 + 조각 키트를 (x, y) 칸에 놓는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, buildings as BD, props as PR

_cache = {}


def piece(id_):
    if id_ in _cache: return _cache[id_]
    for reg in (TR.R, BD.R, PR.R):
        if id_ in reg.by:
            im = reg.render(reg.by[id_]).img(); _cache[id_] = im; return im
    raise KeyError(id_)


class Scene:
    def __init__(s, W, H, ground='cobble'):
        s.W, s.H = W, H
        s.g = [[ground] * W for _ in range(H)]
        s.objs = []

    def fill(s, x, y, w, h, t):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.W and 0 <= j < s.H: s.g[j][i] = t

    def put(s, id_, x, y):
        s.objs.append((id_, x, y))

    def render(s, z=1):
        im = Image.new('RGBA', (s.W * 16, s.H * 16))
        for j in range(s.H):
            for i in range(s.W): im.alpha_composite(piece(s.g[j][i]), (i * 16, j * 16))
        for id_, x, y in sorted(s.objs, key=lambda o: o[2] + piece(o[0]).height // 16):
            im.alpha_composite(piece(id_), (x * 16, y * 16))
        if z != 1: im = im.resize((im.width * z, im.height * z), Image.NEAREST)
        return im
