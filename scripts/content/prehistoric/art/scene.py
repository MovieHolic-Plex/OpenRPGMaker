#!/usr/bin/env python3
"""빠른 맥락 장면(굽기 전 화풍·배치 확인). 칸 바닥 + 꼭짓점 가장자리 덩이 + 조각을 (x, y) 칸에 놓는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import terrain as TR, dwellings as DW, nature as NA, props as PR

_cache = {}
REGS = (TR.R, DW.R, NA.R, PR.R)


def piece(id_):
    if id_ in _cache: return _cache[id_]
    for reg in REGS:
        if id_ in reg.by:
            im = reg.render(reg.by[id_]).img(); _cache[id_] = im; return im
    raise KeyError(id_)


PAIR_IN = {p[0]: p[1] for p in TR.PAIRS}


class Scene:
    def __init__(s, W, H, ground='dirt'):
        s.W, s.H = W, H
        s.g = [[ground] * W for _ in range(H)]
        s.objs = []

    def fill(s, x, y, w, h, t):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.W and 0 <= j < s.H: s.g[j][i] = t

    def blob(s, pair, V):
        """V: (H+1)×(W+1) 꼭짓점 0/1. 네 꼭짓점이 모두 1 이면 안 재질 한 칸, 섞였으면 가장자리 칸."""
        inner = PAIR_IN[pair]
        for y in range(s.H):
            for x in range(s.W):
                k = '%d%d%d%d' % (V[y][x], V[y][x + 1], V[y + 1][x], V[y + 1][x + 1])
                if k == '1111': s.g[y][x] = inner
                elif k != '0000': s.g[y][x] = 'w-%s-%s' % (pair, k)

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


def vgrid(W, H, fn):
    return [[1 if fn(x, y) else 0 for x in range(W + 1)] for y in range(H + 1)]
