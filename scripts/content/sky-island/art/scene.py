#!/usr/bin/env python3
"""미리보기용 작은 장면 조립기(그림 확인 전용) — 섬 모양 → 가장자리·밑면 칸 고르기 → 소품 얹기 → 원본 해상도 PNG.
실제 조수 도구의 구성기는 src/project/skyIslandComposer.ts 다. 이 파일은 그림을 맥락 안에서 보려는 것이다(같은 규칙을 따른다).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import C, rnd


class Scene:
    def __init__(s, W, H, regs):
        s.W, s.H = W, H
        s.by = {}
        for r in regs:
            for it in r.items: s.by[it['id']] = (r, it)
        s.cache = {}
        s.lower = [['sky'] * W for _ in range(H)]
        s.over = []          # (id, x, y, frame)

    def img(s, id_, f=0):
        k = (id_, f)
        if k not in s.cache:
            r, it = s.by[id_]
            s.cache[k] = r.render(it, f).img()
        return s.cache[k]

    def set(s, x, y, id_):
        if 0 <= x < s.W and 0 <= y < s.H: s.lower[y][x] = id_

    def put(s, id_, x, y, f=0):
        s.over.append((id_, x, y, f))

    def render(s, scale=1):
        S = Image.new('RGBA', (s.W * 16, s.H * 16))
        for y in range(s.H):
            for x in range(s.W):
                S.alpha_composite(s.img(s.lower[y][x]), (x * 16, y * 16))
        for id_, x, y, f in sorted(s.over, key=lambda o: (o[2] + s.by[o[0]][1]['h'], o[1])):
            S.alpha_composite(s.img(id_, f), (x * 16, y * 16))
        if scale != 1: S = S.resize((S.width * scale, S.height * scale), Image.NEAREST)
        return S


def island_tiles(sc, cells, ground='grass', seed=1, mat='gs'):
    """cells: {(x,y)} 풀 칸(맨 아랫줄이 평평한 모양). 가장자리 13칸 + 남쪽 밑면 열을 깐다. 돌려주기: 바닥 열 정보."""
    def g(x, y): return (x, y) in cells
    for (x, y) in cells:
        n, s_, w, e = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y)
        k = None
        if not n and not w: k = 'nw'
        elif not n and not e: k = 'ne'
        elif not s_ and not w: k = 'sw'
        elif not s_ and not e: k = 'se'
        elif not n: k = 'n'
        elif not s_: k = 's'
        elif not w: k = 'w'
        elif not e: k = 'e'
        elif not g(x - 1, y - 1): k = 'inw'
        elif not g(x + 1, y - 1): k = 'ine'
        elif not g(x - 1, y + 1): k = 'isw'
        elif not g(x + 1, y + 1): k = 'ise'
        if k: sc.set(x, y, f'{mat}-{k}')
        else:
            r = rnd(x // 2, y // 2, seed)
            sc.set(x, y, ground if (r < 0.62 or ground != 'grass') else 'grass-b' if r < 0.93 else 'grass-flower')
    if mat != 'gs': return
    bottoms = sorted((x, y) for (x, y) in cells if not g(x, y + 1))
    # 아랫줄 묶음(같은 y 연속)
    runs = []
    for x, y in bottoms:
        if runs and runs[-1][-1][1] == y and runs[-1][-1][0] == x - 1: runs[-1].append((x, y))
        else: runs.append([(x, y)])
    for run in runs:
        Wd = len(run); y0 = run[0][1] + 1
        dmax = min(6, 2 + Wd // 3)
        t = [2 + (dmax - 2) * math.sin(math.pi * (i + 0.5) / Wd) ** 0.8 + (rnd(i, y0, seed) - 0.5) * 1.2 for i in range(Wd)]
        L = [2] * Wd; Rr = [2] * Wd
        for i in range(1, Wd): L[i] = L[i - 1] + (1 if t[i] > L[i - 1] + 0.4 else 0)
        for i in range(Wd - 2, -1, -1): Rr[i] = Rr[i + 1] + (1 if t[i] > Rr[i + 1] + 0.4 else 0)
        d = [min(a, b) for a, b in zip(L, Rr)]          # 오르막 열 ∧ 내리막 열 = 봉우리 하나(골짜기 없음)
        for i, (x, _) in enumerate(run):
            dl = d[i - 1] if i > 0 else 0
            dr = d[i + 1] if i < Wd - 1 else 0
            end_l, end_r = i == 0, i == Wd - 1
            for r in range(d[i]):
                yy = y0 + r
                if r == 0:
                    id_ = 'face-top-l' if end_l else 'face-top-r' if end_r else ('face-top-b' if rnd(x, 5, seed) < 0.25 else 'face-top-crystal' if rnd(x, 6, seed) < 0.06 else 'face-top')
                elif r < d[i] - 1:
                    id_ = 'face-mid-b' if rnd(x, r, seed) < 0.3 else 'face-mid'
                else:
                    if end_l: id_ = 'tip-l'
                    elif end_r: id_ = 'tip-r'
                    else: id_ = 'tip-' + 'abcd'[int(rnd(x, y0, seed + 3) * 4)]
                sc.set(x, yy, id_)
    return runs


def rect_island(x0, y0, w, h, lobes=()):
    cells = {(x, y) for x in range(x0, x0 + w) for y in range(y0, y0 + h)}
    for (lx, ly, lw, lh) in lobes:
        cells |= {(x, y) for x in range(lx, lx + lw) for y in range(ly, ly + lh)}
    return cells
