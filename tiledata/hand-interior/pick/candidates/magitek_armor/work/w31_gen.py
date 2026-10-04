import sys
src = open('w26-F.pxg').read().split('\n')
# locate blocks
im = src.index('@mblock 0 0'); it = src.index('@tblock 0 0')
M = [list(l) for l in src[im+1:im+49]]
T = [list(l) for l in src[it+1:it+49]]
head = src[:im]
def put(r, c0, mats, tones):
    for i,(m,t) in enumerate(zip(mats, tones)):
        if m != '.': M[r][c0+i] = m
        if t != '.': T[r][c0+i] = t
def build(name, extra_mat, spec, px=''):
    out = list(head) + extra_mat
    spec()
    out += ['@mblock 0 0'] + [''.join(l) for l in M] + ['@tblock 0 0'] + [''.join(l) for l in T]
    if px: out.append(px)
    open(name, 'w').write('\n'.join(out) + '\n')
import copy
M0, T0 = copy.deepcopy(M), copy.deepcopy(T)
def reset():
    global M, T
    M = copy.deepcopy(M0); T = copy.deepcopy(T0)


def cav(rows):  # rows: list of (row, col0, mats, tones)
    for r in rows: put(*r)
    put(13,14,'qqqq','2222'); put(14,14,'mmmm','4444')

def D():   # 어두운 조종석 + 철 좌석·머리받침, 테두리에 계기 점
    cav([(9,13,'qqqqqq','111111'),(10,13,'qqqqqq','111111'),
         (11,13,'qmmmmq','132441'),(12,13,'qmmmmq','133441')])
def E():   # 깊은 어둠 + 청록 잔광, 조종간 두 개
    cav([(9,13,'qqqqqq','111111'),(10,13,'qqnqqq','112111'),
         (11,13,'qqmqmq','111311'),(12,13,'qmmmmq','123441')])
def F():   # 어둠 + 붉은 방석 좌석 + 앞 계기판 줄
    cav([(9,13,'qqqqqq','111111'),(10,13,'qmmmmq','123441'),
         (11,13,'qmmmmq','133441'),(12,13,'qssssq','122221')])
reset(); build('w31-D.pxg', [], D, '@px 14 13 yellow:5 17 13 red:4')
reset(); build('w31-E.pxg', [], E, '@px 14 13 teal:5 15 13 teal:4 16 13 teal:5 17 13 yellow:5')
reset(); build('w31-F.pxg', [], F, '@px 14 13 red:4 15 13 yellow:5 17 13 yellow:5')
