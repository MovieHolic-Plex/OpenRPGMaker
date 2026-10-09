#!/usr/bin/env python3
"""dead_forest wv4-A/B/C 생성기 — python3 wv4_dead.py A|B|C  (wv4lib 는 ash/work 에 있다)
토러스 글자: 0~3 = wbark, k l m n = wash 1 2 3 4, g h i = wswamp 2 3 4, p q r = wdirt 1 2 3."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); DIR = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(os.path.dirname(DIR), 'ash', 'work'))
import wv4lib as W
v = sys.argv[1]

# 12x13 앙상한 고목: 줄기 2px, 가지는 이어진 1px 사선, 두 번 갈라짐
T1 = ['1..1....1..1', '.1.1....1.1.', '..11.11.11..', '...1.11.1...', '....1221....', '.1...22.....',
      '..1..22..1..', '...1.22.1...', '.....22.....', '.....22.....', '....2222....', '...g2222g...', '....g22g....']
T2 = ['..1...1....1', '...1..1...1.', '....1.1..11.', '.1..11.111..', '..1..121....', '...1.122.1..',
      '....1.22.1..', '.....122....', '.....22.....', '.....22.....', '....2222....', '..h.2222h...', '....h22h....']
B1 = [r.replace('2', '3') if 0 else r for r in T1]
B1 = [''.join({'1': '3', 'g': 'i'}.get(c, c) for c in r) for r in T1]
B1 = [r[:5] + r[5:].replace('3', '1', 1) if False else r for r in B1]
B2 = [''.join({'1': '3', 'h': 'i'}.get(c, c) for c in r) for r in T2]
C1 = ['0..1...1..0.', '.0.1..1..0..', '..01.11.1...', '...1.222.0..', '..0.12221...', '...1.222....',
      '.0..12221.0.', '..1..222.1..', '...1.222....', '....2222....', '...22222....', '.g222221g...', '..g22211g...']
C2 = ['.0..1...1..0', '..0.1..1.0..', '...1.111.1..', '.0..12221...', '..1.1222.0..', '...1.222.1..',
      '....12221...', '.0..12221...', '....222.....', '....2222....', '...22222....', '.h222221h...', '..h22211h...']
if v == 'A': s1, s2, base, fl = T1, T2, 'k', ['k', 'l']
elif v == 'B': s1, s2, base, fl = B1, B2, 'e', ['e', 'f']
else: s1, s2, base, fl = C1, C2, 'h', ['g', 'h']

# 바닥 알갱이(나무 밑 결) — 나무 사이 빈 곳을 채워 벽지가 되지 않게 흩는다
grain = [(1, 12, [fl[1] * 3]), (11, 3, [fl[1] * 2]), (13, 7, [fl[1]]), (6, 14, [fl[1] * 2]), (9, 5, [fl[1] * 2]), (14, 13, [fl[1]])]
if v == 'A': grain += [(12, 9, ['nm']), (2, 8, ['m'])]
if v == 'B': grain += [(12, 9, ['gg']), (2, 8, ['g']), (6, 3, ['r'])]
if v == 'C': grain += [(12, 9, ['ii']), (2, 8, ['i']), (7, 6, ['i'])]
TEX = W.torus(grain + [(2, 1, s1), (10, 9, s2)], base=base)
MAP = {'k': ('wash', 1), 'l': ('wash', 2), 'm': ('wash', 3), 'n': ('wash', 4),
       'g': ('wswamp', 2), 'h': ('wswamp', 3), 'i': ('wswamp', 4), 'e': ('wswamp', 1), 'f': ('wswamp', 0), 'r': ('wdirt', 1)}

def tex(lx, ly, alt):
    if alt: lx, ly = (lx + 8) % 16, (ly + 5) % 16
    ch = TEX[ly][lx]
    return ('wbark', int(ch)) if ch in '0123' else MAP[ch]

def paint(role, lx, ly, C):
    if role == 'inner' and lx in (0, 15) and ly in (0, 15): return None
    if C.land:
        d = C.dl
        if v == 'A':
            if d == 1: return ('wgrass', 0) if (lx + ly) % 3 else ('wdirt', 0)
            if d == 2 and (lx * 5 + ly * 3) % 4 == 0: return ('wgrass', 1)
            return None
        if v == 'B':
            if C.dl == 1 and (not C.land_at(0, -1) or not C.land_at(-1, 0)): return '~'
            if C.dl == 2 and (not C.land_at(0, -2) or not C.land_at(-2, 0)): return '-'
            if d == 1: return ('wgrass', 0)
            if d == 2 and (lx + ly) % 3 == 0: return ('wgrass', 1)
            return None
        if d == 1: return ('wdirt', 0)
        if d == 2 and (lx // 2 + ly) % 3 == 0: return ('wgrass', 0)
        return None
    t = tex(lx, ly, C.alt)
    if C.dm == 1 and t[0] != 'wbark': return ('wbark', 0) if v == 'C' else ('wash', 0)
    return t

W.build(paint, os.path.join(DIR, f'wv4-{v}.pxg'), f'dead_forest wv4-{v}', W.PROFS['P1' if v == 'A' else ('P2' if v == 'B' else 'P3')])
