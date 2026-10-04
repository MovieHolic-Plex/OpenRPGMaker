#!/usr/bin/env python3
"""lava wv4-A/B/C 생성기 — python3 wv4_lava.py A|B|C  (wv4lib 는 ash/work 에 있다)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DIR = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(os.path.dirname(DIR), 'ash', 'work'))
import wv4lib as W
v = sys.argv[1]

if v == 'A':   # World.png 물가 구조: 밝은 주황 바탕 + 굳은 껍질 덩이
    st = [(1, 1, ['.22.', '2112', '.221']), (9, 2, ['.2.', '211', '.12']), (5, 7, ['..22.', '.2112', '2211.', '.22..']),
          (12, 9, ['.22', '211', '.2.']), (1, 11, ['.2.', '211', '.2.']), (8, 13, ['2211', '.22.']),
          (4, 3, ['44', '.4']), (11, 5, ['444']), (2, 6, ['.44']), (13, 13, ['44']), (7, 10, ['4']), (15, 0, ['4']),
          (6, 4, ['55']), (14, 7, ['5']), (3, 14, ['55'])]
elif v == 'B':   # 같은 구조, 껍질 덩이가 볕(위·왼)받이 띠와 그늘 띠를 가진 3/4 시점
    st = [(1, 1, ['.44.', '4112', '.222']), (9, 2, ['.4.', '411', '.22']), (5, 7, ['..44.', '.4112', '4112.', '.222.']),
          (12, 9, ['.44', '411', '.22']), (1, 11, ['.4.', '411', '.22']), (8, 13, ['4411', '.222']),
          (4, 4, ['5']), (11, 6, ['55']), (2, 7, ['.5']), (14, 14, ['5'])]
else:   # C: 식어 갈라진 큰 판 + 갈라진 틈으로 밝은 용암
    st = [(0, 0, ['1111.', '11211', '12221', '.1111']), (7, 1, ['.111', '1221', '1211', '.11.']),
          (2, 6, ['11111.', '122211', '12221.', '.111..']), (10, 7, ['111.', '1221', '.111']),
          (0, 12, ['1111', '1221', '.111']), (7, 11, ['.1111', '12221', '.111.']),
          (5, 0, ['4']), (5, 5, ['44']), (6, 5, ['.5']), (13, 5, ['4']), (1, 5, ['44']), (9, 6, ['4']), (14, 12, ['44']), (6, 10, ['4']), (12, 15, ['4']),
          (4, 15, ['5']), (13, 2, ['5'])]
TEX = W.torus(st, base='3')

def tex(lx, ly, alt):
    if alt: lx, ly = (lx + 8) % 16, (ly + 6) % 16
    return ('wlava', int(TEX[ly][lx]))

def paint(role, lx, ly, C):
    if C.land:
        d = C.dl
        if v == 'A':
            if d == 1: return ('wash', 1)
            if d == 2: return ('wash', 2) if (lx + ly) % 2 == 0 else None
            return None
        if v == 'B':
            if d == 1: return ('wash', 2)
            if d == 2 and (lx + ly) % 2 == 0: return ('wash', 3)
            if d in (2, 3, 4) and C.dl >= 2: return '%'
            return None
        # C
        if d == 1: return ('wash', 0)
        if d == 2 and (lx // 2 + ly // 2) % 2 == 0: return ('wash', 1)
        return None
    t = tex(lx, ly, C.alt)
    if v == 'A':
        if C.dm == 1: return ('wlava', 0)
        if C.dm == 2: return ('wlava', 1) if (lx + ly) % 2 == 0 else ('wlava', 2)
        return t
    if v == 'B':
        s = C.dm_at(0, 1) == 0 or C.dm_at(1, 0) == 0
        n = C.dm_at(0, -1) == 0 or C.dm_at(-1, 0) == 0
        if C.dm == 1: return ('wlava', 0)
        if C.dm == 2:
            if n and not s: return ('wlava', 4)
            if s: return ('wlava', 1)
            return ('wlava', 2)
        if C.dm == 3 and n and not s and (lx + ly) % 2 == 0: return ('wlava', 4)
        return t
    if C.dm == 1: return ('wlava', 0)
    if C.dm == 2: return ('wlava', 1) if (lx // 2 + ly) % 2 == 0 else ('wlava', 2)
    return t

W.build(paint, os.path.join(DIR, f'wv4-{v}.pxg'), f'lava wv4-{v}', W.PROFS['P1' if v == 'A' else ('P2' if v == 'B' else 'P3')])
