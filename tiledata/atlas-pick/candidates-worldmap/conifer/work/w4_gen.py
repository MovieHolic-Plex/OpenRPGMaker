import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from w4_fir import *
SNOW = len(sys.argv) > 1 and sys.argv[1] == 'snow'
OUT = os.path.join(HERE0, '..')
LAT = (19.4, 27.0, 92.6, 95.6)
# 두 줄 엇갈림: 줄1 밑동 y=7 (x 4,12) 줄2 밑동 y=15 (x 0,8)
TR = [(4, 7), (12, 7), (0, 15), (8, 15)]
TRN = [(4, 7), (12, 7), (0, 15), (8, 15)]
M = FIR_M
def iso(cv, st):
    fir_tree(cv, 4, 12, st, FIR_S); fir_tree(cv, 11, 14, st, FIR_S); fir_tree(cv, 7, 15, st, FIR_M)
def iso_tall(cv, st):
    fir_tree(cv, 5, 13, st, NARROW); fir_tree(cv, 11, 15, st, NARROW)

def go(snow, tag):
    d = os.path.join(OUT, '..', 'snow_conifer' if snow else 'conifer')
    gr = ('wpine', 1)
    for X, stf, shape, trees, isof, title in (
        ('A', A_st, M, TR, iso, '강남 결: 3단 전나무 두 줄 엇갈림 저대비'),
        ('B', B_st, M, TR, iso, '빛·볼륨: 단마다 왼쪽 밝은 면·오른쪽 짙은 면, 꼭대기 밝은 점, 발치 그림자'),
        ('C', C_st, NARROW, TRN, iso_tall, '실루엣 재해석: 폭 5px 4단 뾰족 첨탑 전나무'),
    ):
        st = stf(snow)
        roles = build(X, title, trees, st, shape, gr if X != 'B' else ('wpine', 0), iso if X != 'C' else iso_tall, LAT, {})
        write(os.path.join(d, f'w4-{X}.pxg'), roles, ('snow_' if snow else '') + 'conifer ' + X + ' — ' + title)
go(SNOW, 'x')
