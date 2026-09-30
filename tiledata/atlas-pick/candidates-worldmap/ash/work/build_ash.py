import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from volc import *
BASE = os.path.abspath(os.path.join(HERE, '../..'))

def tex(letter, v):
    if letter == 'A':
        T = torus_from(A_(2))
        sp = [(1,0),(2,0),(9,2),(13,1),(14,1),(4,5),(11,6),(12,6),(0,9),(6,9),(7,9),(14,10),(3,13),(4,13),(10,12),(12,15)]
        dots(T, sp if v == 0 else [((x+5) % 16, (y+7) % 16) for x, y in sp], A_(3))
        if v == 0:
            rock(T, 2, 2, 4, 3, A_(4), A_(3), A_(1)); rock(T, 10, 9, 5, 4, A_(4), A_(3), A_(1)); rock(T, 8, 0, 2, 2, A_(4), A_(3), A_(1))
            line(T, [(11, 3), (10, 5), (8, 6), (8, 8), (6, 10), (5, 12)], A_(1)); line(T, [(8, 6), (12, 7)], A_(1))
            line(T, [(1, 11), (3, 12), (3, 15)], A_(1))
        else:
            rock(T, 9, 3, 4, 3, A_(4), A_(3), A_(1)); rock(T, 1, 9, 5, 4, A_(4), A_(3), A_(1)); rock(T, 13, 13, 3, 2, A_(4), A_(3), A_(1))
            line(T, [(4, 1), (5, 3), (7, 4), (7, 7), (9, 9), (10, 12)], A_(1)); line(T, [(7, 4), (3, 5)], A_(1))
            line(T, [(14, 8), (12, 9), (12, 11)], A_(1))
    elif letter == 'B':
        T = torus_from(A_(2))
        sp = [(1,0),(2,0),(9,2),(13,1),(4,5),(11,6),(0,9),(6,9),(14,10),(3,13),(10,12),(12,15)]
        dots(T, sp if v == 0 else [((x+5) % 16, (y+7) % 16) for x, y in sp], A_(3))
        dots(T, [((x+2) % 16, (y+v*4+3) % 16) for x, y in sp[::2]], A_(1))
        pr = [(2, 2, 5, 4), (10, 9, 5, 5), (8, 0, 3, 2)] if v == 0 else [(9, 3, 5, 4), (1, 9, 6, 4), (13, 14, 3, 2)]
        for (x, y, w, h) in pr: rock(T, x, y, w, h, A_(5), A_(3), A_(0))
        cr = [(11, 3), (10, 5), (8, 6), (8, 8), (6, 10), (5, 12)] if v == 0 else [(4, 1), (5, 3), (7, 4), (7, 7), (9, 9), (10, 12)]
        line(T, cr, A_(0)); dots(T, [cr[2], cr[4]], L_(1))
        line(T, [(cr[2][0], cr[2][1]), (cr[2][0] + 3, cr[2][1] + 1)], A_(0))
        dots(T, [(cr[3][0], cr[3][1]) ], L_(2))
    else:  # C — 바람에 밀린 재의 물결 능선(모래언덕처럼), 돌은 작게
        T = torus_from(A_(3))
        for (y, x0, n, c) in [(2, 0, 9, 2), (3, 6, 5, 4), (7, 6, 10, 2), (8, 12, 6, 4), (12, 2, 8, 2), (13, 8, 6, 4), (10, 0, 3, 4)]:
            xo = x0 if v == 0 else (x0 + 5) % 16
            for k in range(n):
                T.put(xo + k, y + (v * 2) + (1 if 3 < k < 6 else 0), A_(c))
        rock(T, 12 if v == 0 else 3, 4 if v == 0 else 9, 3, 2, A_(4), A_(3), A_(1))
        rock(T, 3 if v == 0 else 11, 13 if v == 0 else 5, 3, 3, A_(4), A_(2), A_(1))
        line(T, [(9, 9), (10, 11), (12, 12), (13, 15)] if v == 0 else [(1, 3), (3, 4), (4, 6), (7, 6)], A_(1))
    return grid(T)

def make(letter):
    A, B, I = tex(letter, 0), tex(letter, 1), tex(letter, 0)
    if letter == 'A':
        prof = dict(N=[3,3,4,4,5,4,3,3,4,5,5,4,3,3,4,4], S=[3,4,4,5,5,4,3,3,4,4,5,4,4,3,3,3],
                    W=[4,4,5,5,4,3,3,4,5,5,4,4,3,4,4,4], R=7.2, RN=4.6)
        rim = {LIT: [SA(1), A_(2)], DRK: [SA(0), A_(1)]}; mod, k = 4, 0
    elif letter == 'B':
        prof = dict(N=[2,3,4,5,5,4,3,2,3,4,6,6,5,3,2,2], S=[3,3,4,5,6,5,4,3,3,5,6,5,4,3,3,2],
                    W=[3,4,5,6,5,4,3,3,4,6,6,5,4,3,3,3], R=6.8, RN=5.0)
        rim = {LIT: [SA(2), SA(1)], DRK: [SA(0), A_(1)]}; mod, k = 3, 1
    else:
        prof = dict(N=[2,2,3,3,4,4,3,3,2,2,3,4,4,3,3,2], S=[3,3,2,2,3,4,4,3,3,2,2,3,4,4,3,3],
                    W=[2,3,3,4,4,3,2,2,3,4,4,3,3,2,2,3], R=7.5, RN=4.2)
        rim = {LIT: [GR(1), SA(1), None], DRK: [GR(0), SA(0), None]}; mod, k = 2, 0
    prof['E'] = prof['W'][::-1] if letter != 'A' else prof['W'][:]
    ell = ellipse_ext(8, 8.4, 6.9, 6.2)
    g = build(A, B, I, prof, rim, ell)
    if letter == 'A': swap_rim(g, 'wsand', 'wgrass', mod, k)
    elif letter == 'B': swap_rim(g, 'wsand', 'wgrass', 5, 2)
    else: swap_rim(g, 'wgrass', 'wsand', 3, 1)
    return g

if __name__ == '__main__':
    for k in (sys.argv[1] if len(sys.argv) > 1 else 'ABC'):
        open(os.path.join(BASE, 'ash', f'w3-{k}.pxg'), 'w').write(to_pxg(make(k), f'ash w3-{k}'))
