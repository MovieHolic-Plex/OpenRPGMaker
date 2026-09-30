"""w4 ruins — 부러진 돌기둥·쓰러진 기둥·이끼 돌바닥. 기둥마다 열 높이(부러진 윗단)·열 명암을 손으로 적는다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
S = 'abcdefg'
LEG = {c: ('wstone', i) for i, c in enumerate(S)}
LEG.update({'m': ('wswamp', 3), 'n': ('wswamp', 2), 'q': ('wswamp', 4), 'o': ('wmead', 3), 'p': ('wmead', 2), 'r': ('wmead', 4)})
W, H = 32, 16
def dk(c, n=1): return S[max(0, S.index(c) - n)] if c in S else c
def lt(c, n=1): return S[min(6, S.index(c) + n)] if c in S else c

class C:
    def __init__(s): s.a = [['.'] * W for _ in range(H)]
    def p(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.a[y][x] = c
    def g(s, x, y): return s.a[y][x] if 0 <= x < W and 0 <= y < H else '#'

def pillar(cv, x0, tops, base, T, seams=(), top_lit='f', crack=None, plinth=None):
    w = len(T)
    for i in range(w):
        for y in range(tops[i], base + 1):
            c = T[i]
            if y in seams and 0 < i < w - 1: c = dk(c)
            cv.p(x0 + i, y, c)
        # 부러진 윗면: 위로 열린 깨진 면은 밝게, 오른쪽 끝은 어둡게
        cv.p(x0 + i, tops[i], top_lit if i < w - 1 else dk(T[i], 0))
        if i > 0 and tops[i] > tops[i - 1] and i < w - 1:   # 왼쪽 이웃보다 낮은 열 = 계단 안쪽 밝은 결
            cv.p(x0 + i, tops[i], lt(top_lit, 0))
    if crack:
        for (cx, cy) in crack: cv.p(x0 + cx, cy, dk(T[cx], 2))
    if plinth:
        pl, pr, tones = plinth   # 밑돌 두 줄 (base-1, base)
        for y in (base - 1, base):
            for x in range(x0 - 1, x0 + w + 1):
                if x == x0 - 1: c = tones[0]
                elif x == x0 + w: c = tones[3]
                else: c = tones[1] if y == base - 1 else tones[2]
                if y == base - 1 and x in (x0 - 1, x0 + w): continue
                cv.p(x, y, c)

def slab(cv, x, y, w, top, front, edge, moss=()):
    for i in range(w):
        cv.p(x + i, y, top if i else edge)
        cv.p(x + i, y + 1, front)
    cv.p(x + w - 1, y, dk(top)); cv.p(x + w - 1, y + 1, dk(front))
    for (mx, mc) in moss: cv.p(x + mx, y, mc)

def lying(cv, x, y0, L, tones, seams, endface, brk=None):
    """가로로 누운 원기둥. tones = 위→아래 줄 명암, endface = 왼쪽 잘린 면, brk = 오른쪽 부러진 끝 높이 목록"""
    h = len(tones)
    for r, c in enumerate(tones):
        for i in range(L):
            cc = c
            if i in seams and 0 < r < h - 1: cc = dk(c)
            cv.p(x + i, y0 + r, cc)
    for r in range(h):
        cv.p(x - 1, y0 + r, endface[r] if 0 < r < h - 1 else dk(tones[r]))
        cv.p(x, y0 + r, endface[r])
    if brk:
        for r in range(h):
            for i in range(brk[r], 0, -1): pass
        for r, cut in enumerate(brk):   # 오른쪽 끝을 cut 만큼 갉아 낸다
            for i in range(cut): cv.p(x + L - 1 - i, y0 + r, '.')
    # 아랫줄 어두운 윤곽은 tones 마지막

def shadow(cv, pts, ch='~'):
    for (x, y) in pts:
        if cv.g(x, y) == '.': cv.p(x, y, ch)

def out(cv, name, title, extra=None):
    rows = [''.join(r) for r in cv.a]
    assert not any('#' in r for r in rows)
    used = {ch: LEG[ch] for ch in set(''.join(rows)) if ch in LEG}
    open(os.path.join(HERE, '..', name), 'w').write(emit(rows, used, title))

def bounds(cv): pass

# ================= A: 강남 결 — 낮은 대비 4~5단 =================
def A():
    cv = C()
    slab(cv, 1, 14, 6, 'd', 'b', 'e', [(2, 'n'), (3, 'm')])
    slab(cv, 9, 14, 8, 'd', 'b', 'e', [(1, 'o'), (2, 'n'), (5, 'm'), (6, 'n')])
    slab(cv, 18, 14, 4, 'c', 'a', 'd', [(2, 'm')])
    pillar(cv, 2, [3, 2, 4, 1, 3, 5], 13, list('beedca'), seams=(6, 10), crack=[(2, 8), (3, 9)],
           plinth=(1, 1, ['b', 'd', 'b', 'a']))
    for (x, y, c) in [(3, 12, 'n'), (4, 13, 'm'), (6, 13, 'n')]: cv.p(x, y, c)
    pillar(cv, 12, [6, 5, 7, 5, 7], 13, list('bedca'), seams=(9,), crack=[(2, 10)], plinth=(1, 1, ['b', 'd', 'b', 'a']))
    cv.p(12, 12, 'n'); cv.p(14, 13, 'm')
    pillar(cv, 18, [10, 9, 10, 11, 10], 13, list('bedca'), seams=(12,), top_lit='e')
    lying(cv, 25, 10, 6, list('edcb'), (2, 4), list('dcbb'), brk=[0, 0, 0, 1])
    # 쓰러진 기둥 윗줄 밝은 결, 이끼
    for x in range(26, 30): cv.p(x, 10, 'f' if x < 28 else 'e')
    cv.p(28, 10, 'n'); cv.p(29, 11, 'm')
    shadow(cv, [(8, 14), (8, 15), (7, 13), (17, 14), (17, 15), (22, 14), (22, 15), (23, 13), (24, 14)], '~')
    shadow(cv, [(26, 14), (27, 14), (28, 14), (29, 14), (30, 14), (31, 14), (24, 15), (25, 15)], '~')
    return cv

def B():
    cv = C()
    slab(cv, 1, 14, 6, 'e', 'b', 'f', [(2, 'n'), (3, 'm'), (4, 'o')])
    slab(cv, 9, 14, 8, 'e', 'b', 'f', [(1, 'o'), (2, 'n'), (5, 'm'), (6, 'n')])
    slab(cv, 18, 14, 4, 'd', 'a', 'e', [(2, 'm')])
    pillar(cv, 2, [3, 2, 4, 1, 3, 5], 13, list('afgdba'), seams=(6, 10), top_lit='g', crack=[(2, 8), (3, 9), (3, 10)],
           plinth=(1, 1, ['a', 'e', 'b', 'a']))
    for (x, y, c) in [(3, 12, 'n'), (4, 13, 'm'), (6, 13, 'n'), (2, 13, 'o')]: cv.p(x, y, c)
    pillar(cv, 12, [6, 5, 7, 5, 7], 13, list('afdba'), seams=(9,), top_lit='g', crack=[(2, 10)], plinth=(1, 1, ['a', 'e', 'b', 'a']))
    cv.p(12, 12, 'n'); cv.p(14, 13, 'm'); cv.p(13, 13, 'o')
    pillar(cv, 18, [10, 9, 10, 11, 10], 13, list('afdba'), seams=(12,), top_lit='g')
    lying(cv, 25, 10, 6, list('fdca'), (2, 4), list('ecaa'), brk=[0, 0, 0, 1])
    for x in range(26, 30): cv.p(x, 10, 'g')
    cv.p(28, 10, 'o'); cv.p(29, 11, 'm')
    shadow(cv, [(8, 14), (8, 15), (7, 13), (17, 14), (17, 15), (22, 14), (22, 15), (23, 13), (24, 14), (23, 12), (7, 12)], '~')
    shadow(cv, [(26, 14), (27, 14), (28, 14), (29, 14), (30, 14), (31, 14), (24, 15), (25, 15), (26, 15), (27, 15), (28, 15), (23, 15), (9, 15), (10, 15)], '-')
    return cv

def Cc():
    """C: 부러진 아치 — 큰 기둥 하나에 아치 윗돌이 허공에 매달려 끊기고, 맞은편 기둥은 밑동만, 굴러 온 기둥 토막 둘"""
    cv = C()
    slab(cv, 1, 14, 5, 'd', 'b', 'e', [(1, 'n'), (2, 'm')])
    slab(cv, 12, 14, 7, 'd', 'b', 'e', [(1, 'o'), (3, 'n'), (5, 'm')])
    # 큰 기둥 (왼쪽, 폭 7, 매우 높음)
    pillar(cv, 2, [2, 1, 1, 0, 1, 2, 3], 13, list('beeedca'), seams=(5, 8, 11), crack=[(3, 6), (4, 7)],
           plinth=(1, 1, ['b', 'd', 'b', 'a']))
    # 아치 윗돌: 기둥 꼭대기에서 오른쪽으로 휘어 나가다 부러진 조각 (위·아래 줄)
    arch = {9: (0, 3), 10: (0, 3), 11: (1, 3), 12: (1, 3), 13: (2, 4), 14: (3, 4), 15: (4, 5)}
    for x, (y0, y1) in arch.items():
        for y in range(y0, y1 + 1):
            c = 'e' if y == y0 else ('d' if y < y1 else 'b')
            cv.p(x, y, c)
        cv.p(x, y1, 'b')
    cv.p(9, 0, 'f'); cv.p(10, 0, 'f'); cv.p(11, 1, 'f'); cv.p(12, 1, 'f'); cv.p(13, 2, 'f'); cv.p(14, 3, 'e'); cv.p(15, 4, 'e')
    cv.p(15, 5, 'b')
    # 맞은편 기둥: 밑동만
    pillar(cv, 21, [9, 8, 10, 9, 10], 13, list('bedca'), seams=(11,), top_lit='e', plinth=(1, 1, ['b', 'd', 'b', 'a']))
    cv.p(21, 12, 'n'); cv.p(23, 13, 'm')
    # 굴러 온 기둥 토막 둘 (한 개는 세워진 채 쓰러지는 둥근 마구리)
    lying(cv, 12, 10, 5, list('edcb'), (2,), list('dcbb'))
    for x in range(13, 16): cv.p(x, 10, 'f')
    lying(cv, 27, 11, 4, list('edcb'), (2,), list('dcbb'), brk=[0, 0, 1, 1])
    for x in range(28, 30): cv.p(x, 11, 'f')
    cv.p(29, 12, 'm')
    shadow(cv, [(9, 14), (9, 15), (8, 13), (8, 12), (18, 14), (18, 15), (26, 14), (26, 15), (17, 13), (17, 12)], '~')
    shadow(cv, [(26, 13), (27, 15), (28, 15), (29, 15), (30, 15), (31, 14), (31, 13), (19, 15), (20, 15)], '-')
    return cv

if __name__ == '__main__':
    out(A(), 'w4-A.pxg', 'ruins w4-A — 강남 결 낮은 대비')
    out(B(), 'w4-B.pxg', 'ruins w4-B — 명암·부피 강화')
    out(Cc(), 'w4-C.pxg', 'ruins w4-C — 부러진 아치 재해석')
