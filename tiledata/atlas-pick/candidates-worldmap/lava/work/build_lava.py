import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../ash/work'))
from volc import *
BASE = os.path.abspath(os.path.join(HERE, '../..'))

def floe(T, x, y, w, h, top, mid, bot):
    """떠 있는 굳은 껍질 조각: 가장자리 모서리 깎고 윗면 top, 몸 mid, 밑줄 bot."""
    for j in range(h):
        for i in range(w):
            if i in (0, w - 1) and j in (0, h - 1): continue
            T.put(x + i, y + j, bot if j == h - 1 else (top if j == 0 else mid))

def tex(letter, v):
    if letter == 'A':   # 잔잔: 주황 바탕 + 노랑 결 + 작은 검붉은 껍질
        T = torus_from(L_(3))
        yl = [(2,1),(3,1),(4,1),(9,4),(10,4),(1,7),(2,7),(3,7),(11,9),(12,9),(13,9),(6,12),(7,12),(8,12),(14,14),(15,14)]
        yl = yl if v == 0 else [((x + 6) % 16, (y + 9) % 16) for x, y in yl]
        dots(T, yl, L_(4))
        dots(T, [((x + 1) % 16, (y + 1) % 16) for x, y in yl[::3]], L_(2))
        fl = [(6, 2, 4, 2), (1, 10, 3, 2), (11, 12, 4, 2)] if v == 0 else [(10, 6, 4, 2), (2, 2, 3, 2), (6, 12, 4, 2)]
        for (x, y, w, h) in fl: floe(T, x, y, w, h, L_(2), L_(1), L_(0))
    elif letter == 'B':  # 강한 대비: 어둑한 껍질 큰 판 + 갈라진 틈으로 흰노랑 빛
        T = torus_from(L_(4))
        yl = [(1,1),(2,1),(9,3),(10,3),(11,3),(4,6),(5,6),(12,8),(2,10),(3,10),(8,11),(9,11),(14,14)]
        yl = yl if v == 0 else [((x + 7) % 16, (y + 5) % 16) for x, y in yl]
        dots(T, yl, L_(5)); dots(T, [((x + 2) % 16, (y + 2) % 16) for x, y in yl[::2]], L_(3))
        fl = [(5, 1, 6, 3), (0, 8, 5, 3), (10, 11, 5, 3)] if v == 0 else [(9, 5, 6, 3), (2, 1, 5, 3), (6, 11, 6, 3)]
        for (x, y, w, h) in fl:
            floe(T, x, y, w, h, A_(3), A_(2), A_(0))
            dots(T, [(x + 1, y + 1)], L_(2)); dots(T, [(x + w - 2, y + 1)], A_(4))
    else:  # C — 흐르는 결: 가로로 길게 늘어진 유선(줄무늬) 흐름
        T = torus_from(L_(3))
        for (y, x0, n, c) in [(1, 0, 7, 4), (2, 5, 6, 5), (4, 8, 7, 2), (6, 1, 8, 4), (7, 3, 5, 5), (9, 9, 6, 2), (11, 0, 6, 4), (12, 4, 7, 5), (14, 10, 6, 2), (15, 1, 5, 4)]:
            xo = x0 if v == 0 else (x0 + 8) % 16
            for k in range(n): T.put(xo + k, y + (v * 3) % 16, L_(c))
        floe(T, 10 if v == 0 else 2, 5 if v == 0 else 10, 4, 2, L_(2), L_(1), L_(0))
        floe(T, 2 if v == 0 else 11, 13 if v == 0 else 3, 3, 2, L_(2), L_(1), L_(0))
    return grid(T)

def make(letter):
    A, B, I = tex(letter, 0), tex(letter, 1), tex(letter, 0)
    if letter == 'A':
        prof = dict(N=[2,2,3,3,2,2,3,3,2,2,3,3,2,2,3,2], S=[2,3,3,2,2,3,3,2,2,3,3,2,2,3,3,2],
                    W=[2,2,3,3,2,2,3,3,2,3,3,2,2,3,3,2], R=7.6, RN=4.0)
        rim = {LIT: [A_(1), L_(4)], DRK: [A_(0), L_(2), L_(4)]}
    elif letter == 'B':
        prof = dict(N=[2,3,3,4,4,3,2,2,3,4,4,3,3,2,2,2], S=[3,3,4,4,3,2,2,3,4,4,3,3,2,2,3,3],
                    W=[3,4,4,3,2,2,3,4,4,3,3,2,2,3,3,4], R=6.8, RN=4.6)
        rim = {LIT: [A_(0), L_(0), L_(5)], DRK: [A_(0), L_(1), L_(4)]}
    else:
        prof = dict(N=[2,2,2,3,3,3,2,2,2,2,3,3,3,2,2,2], S=[2,2,3,3,2,2,2,3,3,3,2,2,2,3,3,2],
                    W=[2,3,3,3,2,2,2,2,3,3,3,2,2,2,3,2], R=7.8, RN=3.8)
        rim = {LIT: [L_(0), L_(4)], DRK: [A_(1), L_(0), L_(4)]}
    prof['E'] = prof['W'][::-1]
    ell = ellipse_ext(8, 8.4, 6.9, 6.2)
    return build(A, B, I, prof, rim, ell)

if __name__ == '__main__':
    for k in (sys.argv[1] if len(sys.argv) > 1 else 'ABC'):
        open(os.path.join(BASE, 'lava', f'w3-{k}.pxg'), 'w').write(to_pxg(make(k), f'lava w3-{k}'))
