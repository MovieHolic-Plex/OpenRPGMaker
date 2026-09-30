#!/usr/bin/env python3
"""poison_marsh wv4-A/B/C 생성기 — python3 wv4_poison.py A|B|C  (wv4lib 는 ash/work 에 있다)"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DIR = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(os.path.dirname(DIR), 'ash', 'work'))
import wv4lib as W
v = sys.argv[1]

if v == 'A':   # World.png 독늪: 탁한 보라 물 + 자갈처럼 빽빽한 둥근 거품 덩이(지름 5~6px, 윗왼 밝은 테)
    st = [(0, 0, ['.444.', '43332', '43322', '.222.']), (8, 1, ['.44.', '4332', '3222', '.22.']),
          (3, 6, ['.444.', '43332', '43322', '.222.']), (11, 7, ['.44.', '4332', '3222', '.22.']),
          (0, 11, ['.44.', '4332', '3222']), (7, 10, ['.444.', '43332', '43322', '.222.']), (13, 13, ['44', '32']),
          (6, 5, ['5']), (14, 5, ['5']), (2, 15, ['5'])]
    base = '1'
elif v == 'B':   # 같은 구조 + 3/4 시점: 거품 덩이가 볕받이 위왼 테와 그늘 아래오른 테를 갖는다
    st = [(0, 0, ['.555.', '54432', '54322', '.111.']), (8, 1, ['.55.', '5432', '4322', '.11.']),
          (3, 6, ['.555.', '54432', '54322', '.111.']), (11, 7, ['.55.', '5432', '4322', '.11.']),
          (0, 11, ['.55.', '5432', '4322']), (7, 10, ['.555.', '54432', '54322', '.111.']), (13, 13, ['55', '31']),
          (5, 5, ['0']), (14, 5, ['0']), (4, 12, ['0'])]
    base = '1'
else:   # C: 거품 대신 독기 물결 — 가로로 길게 번지는 어두운 결과 기름막 줄, 드문 독초 초록 점
    st = [(0, 1, ['..22222.']), (1, 2, ['1111']), (8, 4, ['.3333.']), (9, 5, ['111']), (2, 8, ['.222222']), (3, 9, ['11111']),
          (9, 11, ['..33333']), (10, 12, ['1111']), (0, 14, ['.222']), (12, 0, ['22']),
          (5, 5, ['00']), (13, 8, ['00']), (4, 12, ['00']),
          (6, 3, ['44']), (13, 6, ['44']), (1, 10, ['44']), (11, 14, ['44'])]
    base = '1'
TEX = W.torus(st, base=base)

def tex(lx, ly, alt):
    if alt: lx, ly = (lx + 8) % 16, (ly + 6) % 16
    return ('wpoison', int(TEX[ly][lx]))

def paint(role, lx, ly, C):
    if role == 'inner' and lx in (0, 15) and ly in (0, 15): return None
    if C.land:
        d = C.dl
        if v == 'A':
            if d == 1: return ('wdirt', 0)
            if d == 2: return ('wdirt', 1) if (lx + ly) % 2 == 0 else None
            if d == 3: return ('wgrass', 1) if (lx * 3 + ly * 5) % 5 == 0 else None
            return None
        if v == 'B':
            if C.dl == 1 and (not C.land_at(0, -1) or not C.land_at(-1, 0)): return '~'
            if C.dl == 2 and (not C.land_at(0, -2) or not C.land_at(-2, 0) or not C.land_at(-1, -1)): return '-'
            if d == 1: return ('wdirt', 0)
            if d == 2: return ('wdirt', 1) if (lx + ly) % 2 == 0 else None
            return None
        if d == 1: return ('wgrass', 0)
        if d == 2 and (lx // 2 + ly // 2) % 2 == 0: return ('wdirt', 0)
        if d == 3 and (lx + ly * 2) % 6 == 0: return ('wgrass', 1)
        return None
    t = tex(lx, ly, C.alt)
    if v == 'A':
        if C.dm == 1: return ('wpoison', 0)
        if C.dm == 2 and (lx + ly) % 2 == 0: return ('wpoison', 0)
        return t
    if v == 'B':
        s = C.dm_at(0, 1) == 0 or C.dm_at(1, 0) == 0
        n = C.dm_at(0, -1) == 0 or C.dm_at(-1, 0) == 0
        if C.dm == 1: return ('wpoison', 0)
        if C.dm == 2:
            if n and not s: return ('wpoison', 4)
            if s: return ('wpoison', 0)
            return ('wpoison', 2)
        return t
    if C.dm == 1: return ('wpoison', 0)
    if C.dm == 2 and (lx // 2 + ly) % 2 == 0: return ('wpoison', 2)
    return t

W.build(paint, os.path.join(DIR, f'wv4-{v}.pxg'), f'poison_marsh wv4-{v}', W.PROFS['P1' if v == 'A' else ('P2' if v == 'B' else 'P3')])
