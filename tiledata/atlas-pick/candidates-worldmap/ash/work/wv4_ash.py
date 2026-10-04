#!/usr/bin/env python3
"""ash wv4-A/B/C 생성기 — python3 wv4_ash.py A|B|C"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wv4lib as W
HERE = os.path.dirname(os.path.abspath(__file__)); DIR = os.path.dirname(HERE)
v = sys.argv[1]

if v in ('A', 'B'):
    stones = [(2, 2, ['.45.', '4333', '3311']), (10, 5, ['.44.', '4333', '.311']), (5, 11, ['.45.', '4333', '3311']), (13, 13, ['44', '31'])]
    cracks = [(12, 10, ['1..', '.11', '..1']), (0, 8, ['11.', '..1']), (7, 6, ['.1', '11'])]
    spk3 = [(8, 1), (14, 3), (1, 6), (6, 9), (11, 14), (3, 14), (9, 10), (15, 7)]
    spk1 = [(4, 0), (13, 7), (9, 13), (0, 12), (5, 5), (15, 1), (2, 10)]
    st = [(x, y, r) for x, y, r in stones] + [(x, y, r) for x, y, r in cracks]
    if v == 'B':   # 돌 오른쪽 아래 그림자
        st += [(4, 5, ['1']), (5, 5, ['0']), (13, 8, ['01']), (7, 14, ['1']), (8, 14, ['0']), (14, 15, ['1'])]
    st += [(x, y, ['3']) for x, y in spk3] + [(x, y, ['1']) for x, y in spk1]
    TEX = W.torus(st, base='2')
else:   # C: 바람 결(가로 재 능선) + 부석 알갱이
    ridges = [(1, 3, ['..3333.']), (2, 4, ['11111']), (9, 9, ['..333.']), (8, 10, ['1111']), (0, 14, ['.333']), (12, 0, ['.33']),
              (13, 13, ['33.']), (6, 12, ['55']), (3, 7, ['55']), (12, 6, ['55']), (10, 1, ['55'])]
    st = ridges + [(x, y, ['11']) for x, y in [(6, 3), (14, 10), (4, 9), (10, 14), (15, 5), (7, 7), (0, 1)]]
    st += [(x, y, ['00']) for x, y in [(3, 12), (12, 11), (8, 5)]]
    TEX = W.torus(st, base='2')

def tex(lx, ly, alt):
    if alt: lx, ly = (lx + 8) % 16, (ly + 5) % 16
    return ('wash', int(TEX[ly][lx]))

def paint(role, lx, ly, C):
    if role == 'inner' and lx in (0, 15) and ly in (0, 15): return None
    if C.land:
        d = C.dl
        below_m = not C.lN or True
        if v == 'A':
            if d == 1: return ('wsand', 0)
            if d == 2: return ('wsand', 0) if (lx + ly) % 2 == 0 else None
            if d == 3: return ('wgrass', 0) if (lx * 3 + ly * 5) % 4 == 0 else None
            return None
        if v == 'B':
            # 재 덩이의 남·동쪽 바깥 = 그림자, 북·서쪽 바깥 = 타 누런 풀
            shade = (not C.land_at(0, -1) or not C.land_at(-1, 0) or not C.land_at(-1, -1)) if d == 1 else False
            if C.dl == 1 and (not C.land_at(0, -1) or not C.land_at(-1, 0)): return '~'
            if C.dl == 2 and (not C.land_at(0, -2) or not C.land_at(-2, 0) or not C.land_at(-1, -1)): return '-'
            if d == 1: return ('wsand', 0)
            if d == 2: return ('wsand', 0) if (lx + ly) % 2 == 0 else None
            return None
        # C
        if d == 1: return ('wgrass', 0)
        if d == 2 and (lx // 3 + ly // 3) % 2 == 0: return ('wsand', 0)
        return None
    t = tex(lx, ly, C.alt)
    if v == 'A':
        if C.dm == 1: return ('wash', 1)
        return t
    if v == 'B':
        # 3/4 시점: 북·서 = 볕 받는 밝은 테, 남·동 = 어두운 테
        s = C.dm_at(0, 1) == 0 or C.dm_at(1, 0) == 0
        n = C.dm_at(0, -1) == 0 or C.dm_at(-1, 0) == 0
        if C.dm == 1:
            if s and not n: return ('wash', 0)
            if n: return ('wash', 4)
            return ('wash', 1)
        if C.dm == 2:
            if s: return ('wash', 1)
            if n: return ('wash', 3)
        return t
    # C
    if C.dm == 1: return ('wash', 3) if (lx + ly) % 2 == 0 else ('wash', 1)
    if C.dm == 2 and (lx * 7 + ly * 3) % 4 == 0: return ('wash', 5)
    return t

W.build(paint, os.path.join(DIR, f'wv4-{v}.pxg'), f'ash wv4-{v}', W.PROFS['P1' if v == 'A' else ('P2' if v == 'B' else 'P3')])
