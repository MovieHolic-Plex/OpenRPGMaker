import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../mountain/work'))
from build_mountain import cfg, R, S
from mtn import peak, mapg
from w3lib import to_pxg
BASE = os.path.abspath(os.path.join(HERE, '../..'))

def walk(n, pts):
    """줄 i 의 능선 위치: pts={i:값} 사이를 계단으로 이음"""
    out = {}; cur = 0
    for i in range(n + 1):
        cur = pts.get(i, cur); out[i] = cur
    return out

def build(letter):
    pal, pa, pb, prof, rim, shadow, iso, bg, snowd = cfg(letter, False)
    pal['H'] = S(6); pal['W'] = S(5) if letter != 'B' else S(6)
    W_, H_ = 32, 32
    g = [['.'] * W_ for _ in range(H_)]
    def put(x, y, c):
        if 0 <= x < W_ and 0 <= y < H_: g[y][x] = c
    if letter == 'C':
        specs = [dict(cx=6, ay=12, h=17, w=4, rg={i: (0 if i < 8 else 1) for i in range(18)}, cre=[(5,-1,'M'),(9,-2,'M'),(8,1,'D'),(13,1,'D')]),
                 dict(cx=25, ay=15, h=14, w=4, rg={i: 0 for i in range(15)}, cre=[(4,-1,'M'),(8,-2,'M'),(7,1,'D'),(11,1,'D')]),
                 dict(cx=15, ay=2, h=27, w=8, rg=walk(27, {0:0, 5:-1, 11:0, 17:1, 22:0}),
                      jl={9:-1, 10:-1, 19:1, 20:1}, jr={6:1, 7:1, 15:-1, 16:-1, 23:1, 24:1},
                      cre=[(6,-2,'M'),(9,-4,'M'),(13,-3,'M'),(17,-5,'M'),(21,-4,'M'),(24,-6,'M'),
                           (8,2,'D'),(12,3,'D'),(16,4,'D'),(20,3,'D'),(23,5,'D'),(15,-1,'M'),(19,-1,'M')],
                      snow={dx: 2 + (0 if abs(dx) < 2 else -1) for dx in range(-2, 3)})]
    else:
        big = letter == 'A'
        specs = [dict(cx=6, ay=11, h=18, w=9, rg=walk(18, {0:0, 6:-1, 12:0}), jl={7:1, 8:1}, jr={10:-1, 11:-1},
                      cre=[(5,-2,'M'),(9,-3,'M'),(12,-4,'M'),(8,2,'D'),(12,3,'D'),(15,4,'D')]),
                 dict(cx=25, ay=15, h=14, w=8, rg=walk(14, {0:0, 5:-1, 9:0}), jl={4:1, 5:1}, jr={8:-1},
                      cre=[(4,-2,'M'),(7,-3,'M'),(6,2,'D'),(9,3,'D'),(11,4,'D')]),
                 dict(cx=15, ay=2, h=27, w=13 if big else 12, rg=walk(27, {0:0, 5:-1, 10:0, 15:1, 20:0, 24:1}),
                      jl={8:-1, 9:-1, 13:1, 14:1, 21:-1, 22:-1}, jr={5:1, 6:1, 11:-1, 12:-1, 17:1, 18:1, 25:-1},
                      cre=[(5,-2,'M'),(8,-4,'M'),(11,-3,'M'),(14,-6,'M'),(17,-5,'M'),(20,-8,'M'),(23,-7,'M'),(25,-10,'M'),
                           (7,3,'D'),(10,4,'D'),(13,3,'D'),(16,6,'D'),(19,7,'D'),(22,5,'D'),(24,9,'D'),(12,-1,'M'),(18,-1,'M'),(16,-9,'M')],
                      snow={dx: 3 - (abs(dx) // 2) for dx in range(-4, 5)})]
    for p in specs: peak(put, **p)
    # 바닥 그림자(오른쪽 아래)
    xs = [x for x in range(W_) if g[29][x] != '.' or g[28][x] != '.']
    lo, hi = min(xs), max(xs)
    for x in range(lo + 3, min(W_, hi + 3)):
        if g[30][x] == '.': g[30][x] = '~'
    for x in range(lo + 7, min(W_, hi + 2)):
        if g[31][x] == '.': g[31][x] = '-'
    rows = [''.join(r) for r in g]
    grid = [[(c if c in '~-%' else (None if c == '.' else pal[c])) for c in r] for r in rows]
    return grid

if __name__ == '__main__':
    for k in (sys.argv[1] if len(sys.argv) > 1 else 'ABC'):
        open(os.path.join(BASE, 'big_mountain', f'w3-{k}.pxg'), 'w').write(to_pxg(build(k), f'big_mountain w3-{k}'))
