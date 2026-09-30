import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from w4lib import *
OUT = os.path.join(HERE, '..')

STA = dict(ramp='wleaf', top=5, bands=[(0.38, 4), (-0.02, 3), (-0.5, 2)], rim_lit=2, rim_mid=1, rim_dark=0, speck=11, speck2=13, trunk_len=4)
STB = dict(ramp='wleaf', top=5, bands=[(0.5, 5), (0.2, 4), (-0.1, 3), (-0.4, 2), (-0.7, 1)], rim_lit=4, rim_mid=1, rim_dark=0, speck=17, speck2=19, trunk_len=4)
STC = dict(ramp='wleaf', top=5, bands=[(0.4, 4), (-0.05, 3), (-0.5, 2)], rim_lit=2, rim_mid=1, rim_dark=0, speck=11, speck2=13, trunk_len=5)

TA = [(4, 4, 4.6, 4.6), (12, 3.5, 4.2, 4.2), (0, 12, 4.4, 4.4), (8, 12.5, 4.8, 4.8)]
TB = [(4, 4, 4.6, 4.6), (12, 3.5, 4.2, 4.2), (0, 12, 4.4, 4.4), (8, 12.5, 4.8, 4.8)]
TC = [(4, 5, 3.6, 4.6), (12, 4, 3.6, 4.6), (0, 13, 3.6, 4.6), (8, 13, 3.6, 4.6)]

def draw_round(cv, cx, cy, t, st): round_tree(cv, cx, cy, t[2], t[3], st)

def shadowfn(cv):
    # 줄기 발치 오른쪽 아래 그림자(투명 칸에만)
    for y in range(P):
        for x in range(P - 1):
            v = cv.a[y][x]
            if v and not isinstance(v, str) and v[0] == 'wbark' and v[1] == 1 and cv.get(x, y + 1) is None:
                foot_shadow(cv, [(x + 1, y, 3), (x, y + 1, 4)])

def iso_A(cv, st):
    round_tree(cv, 5, 6, 4.2, 4.2, st, trunk=True)
    round_tree(cv, 11, 6.5, 3.8, 3.8, st)
    round_tree(cv, 8, 9, 4.4, 4.2, st)

def mk(name, trees, st, iso, title, shadow=True, ground=('wleaf', 1)):
    roles, cv = bundle(trees, draw_round, st, ground, [iso], [(9, 15, 4), (11, 14, 3)] if shadow else [], shadow_fn=shadowfn if shadow else None)
    open(os.path.join(OUT, f'w4-{name}.pxg'), 'w').write(to_pxg(assemble(roles), title))

def iso_C(cv, st):
    round_tree(cv, 8, 7, 6.2, 5.6, st, trunk=True)

TC2 = [(4, 4, 6.0, 5.6), (12, 12, 6.0, 5.6)]
STC2 = dict(ramp='wleaf', top=5, bands=[(0.45, 5), (0.15, 4), (-0.2, 3), (-0.55, 2)], rim_lit=3, rim_mid=2, rim_dark=0, speck=9, speck2=11, trunk_len=4)
if __name__ == '__main__':
    mk('A', TA, STA, iso_A, 'forest A — 강남 결: 둥근 수관 덩이 4~5단 저대비')
    mk('B', TB, STB, iso_A, ground=('wleaf',0), title= 'forest B — 빛·볼륨: 왼쪽 위 밝은 잎, 오른쪽 아래 어두운 수관 밑, 남동 발치 그림자')
    mk('C', TC2, STC2, iso_C, 'forest C — 큰 수관(지름 12px) 두 줄기 엇갈림, 스케일 재해석')
