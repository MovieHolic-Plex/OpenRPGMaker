import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from mtn import *
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
R = lambda t: ('wrock', t)
S = lambda t: ('wsnow', t)

def tdist(a, b): d = abs(a - b) % 16; return min(d, 16 - d)

# ---- 방향별 설정 ----
def cfg(letter, snowy):
    foot = ('wsnow', 3) if snowy else ('whill', 2)
    footd = ('wsnow', 2) if snowy else ('whill', 1)
    if letter == 'A':
        pal = {'o': R(1), 'O': R(1), 'M': R(3), 'L': R(4), 'h': R(5), 'H': R(6), 'R': R(2), 'D': R(1), 'r': R(2),
               'g': foot, 'G': footd,
               'W': S(5), 'H': S(6), 'V': S(4), 'u': S(4), 'v': S(3)}
        pa = [dict(cx=4,ay=0,h=12,w=7,rg={5:1,8:0,10:1}, cre=[(4,-2,'M'),(6,-3,'M'),(7,-1,'M'),(8,-4,'M'),(6,1,'D'),(8,2,'D'),(10,3,'D')]),
              dict(cx=12,ay=3,h=12,w=7,rg={4:1,7:0,9:1}, cre=[(4,-3,'M'),(6,-1,'M'),(7,-4,'M'),(9,-2,'M'),(6,2,'D'),(8,3,'D'),(10,1,'D')])]
        pb = [dict(cx=3,ay=2,h=12,w=7,rg={5:1,8:0}, cre=[(5,-3,'M'),(7,-1,'M'),(9,-4,'M'),(7,2,'D'),(9,1,'D')]),
              dict(cx=11,ay=0,h=12,w=7,rg={4:1,7:0,9:1}, cre=[(4,-2,'M'),(6,-3,'M'),(8,-1,'M'),(6,1,'D'),(8,3,'D'),(10,2,'D')])]
        prof = dict(N=[min(6, min(1 + tdist(x, 4), 3 + tdist(x, 12))) for x in range(16)],
                    S=[3,3,4,4,5,4,4,3,3,4,4,5,5,4,3,3], W=[4,4,5,5,6,5,4,4,5,5,4,4,5,6,5,4], R=7.0, RN=4.5)
        prof['E'] = prof['W'][:]
        rim = {LIT: [pal['o'], None], DRK: [R(0), footd, None]}
        shadow = None
        iso = dict(cx=8, ay=1, h=12, w=7, rg={5:1,8:1}, cre=[(4,-2,'M'),(6,-3,'M'),(7,-3,'D'),(8,-1,'M'),(8,2,'D'),(10,-2,'D'),(10,3,'D')])
        bg = 'r'; snowd = 4
    elif letter == 'B':
        pal = {'o': R(0), 'O': R(0), 'M': R(3), 'L': R(5), 'h': R(6), 'H': R(6), 'R': R(1), 'D': R(0), 'r': R(1),
               'g': foot, 'G': footd,
               'W': S(6), 'V': S(3), 'u': S(4), 'v': S(2)}
        pa = [dict(cx=3,ay=0,h=13,w=6,rg={3:0,6:1,9:1,11:0}, cre=[(3,-1,'M'),(5,-2,'M'),(7,-3,'M'),(9,-2,'M'),(11,-4,'M'),(5,2,'D'),(7,3,'D'),(9,3,'D')]),
              dict(cx=11,ay=2,h=13,w=6,rg={3:0,6:1,9:1}, cre=[(4,-1,'M'),(6,-2,'M'),(8,-3,'M'),(10,-2,'M'),(6,2,'D'),(8,3,'D'),(10,3,'D')])]
        pb = [dict(cx=5,ay=1,h=13,w=6,rg={3:0,6:1,9:1}, cre=[(4,-2,'M'),(6,-1,'M'),(8,-3,'M'),(10,-2,'M'),(6,2,'D'),(8,3,'D')]),
              dict(cx=13,ay=0,h=13,w=6,rg={3:0,6:1,9:1,11:0}, cre=[(3,-1,'M'),(5,-2,'M'),(7,-3,'M'),(9,-1,'M'),(5,2,'D'),(7,3,'D'),(9,3,'D')])]
        prof = dict(N=[min(6, min(tdist(x, 3), 2 + tdist(x, 11)) + 1) for x in range(16)],
                    S=[4,3,3,4,5,5,4,3,3,4,5,5,4,4,3,3], W=[4,5,6,6,5,4,4,5,6,5,4,4,5,6,6,5], R=6.6, RN=5.0)
        prof['E'] = prof['W'][:]
        rim = {LIT: [R(0), R(5)], DRK: [R(0), R(0), footd]}
        shadow = {'S': '~', 'E': '-', 'SE': '-', 'S2': '-'}
        iso = dict(cx=7, ay=0, h=13, w=6, rg={3:0,6:1,9:1,11:0}, cre=[(3,-1,'M'),(5,-2,'M'),(7,-3,'M'),(9,-2,'M'),(11,-4,'M'),(5,2,'D'),(7,3,'D'),(9,3,'D')])
        bg = 'r'; snowd = 4
    else:  # C — 뾰족한 바위탑(바늘 봉우리) 촘촘히
        pal = {'o': R(1), 'O': R(0), 'M': R(3), 'L': R(4), 'h': R(6), 'H': R(6), 'R': R(2), 'D': R(1), 'r': R(2),
               'g': foot, 'G': footd,
               'W': S(5), 'V': S(3), 'u': S(4), 'v': S(2)}
        pa = [dict(cx=2,ay=1,h=12,w=4,rg={4:0,8:1}, cre=[(5,-1,'M'),(8,-2,'M'),(6,1,'D'),(10,1,'D')]),
              dict(cx=8,ay=0,h=13,w=4,rg={4:0,8:1}, cre=[(4,-1,'M'),(7,-2,'M'),(9,-2,'M'),(6,1,'D'),(10,1,'D')]),
              dict(cx=14,ay=3,h=11,w=4,rg={4:0,8:1}, cre=[(5,-1,'M'),(8,-2,'M'),(6,1,'D'),(9,1,'D')])]
        pb = [dict(cx=5,ay=0,h=13,w=4,rg={4:0,8:1}, cre=[(4,-1,'M'),(7,-2,'M'),(6,1,'D'),(10,1,'D')]),
              dict(cx=11,ay=2,h=12,w=4,rg={4:0,8:1}, cre=[(5,-1,'M'),(8,-2,'M'),(6,1,'D'),(9,1,'D')]),
              dict(cx=0,ay=4,h=10,w=4,rg={4:0,7:1}, cre=[(5,-1,'M'),(7,-2,'M'),(6,1,'D')])]
        prof = dict(N=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], S=[3,4,4,3,3,4,5,4,3,3,4,4,3,3,4,4], W=[4,4,5,4,4,5,5,4,4,4,5,4,4,5,5,4], R=6.5, RN=5.0)
        prof['N'] = [min(6, min(1 + 2 * tdist(x, 2) // 1, 0 + 2 * tdist(x, 8) + 0, 3 + 2 * tdist(x, 14))) + 0 for x in range(16)]
        prof['E'] = prof['W'][:]
        rim = {LIT: [pal['o'], None], DRK: [R(0), footd, None]}
        shadow = {'S': '-', 'E': '-', 'SE': '-'}
        iso = dict(cx=8, ay=0, h=13, w=5, rg={4:0,8:1}, cre=[(4,-1,'M'),(7,-2,'M'),(6,1,'D'),(10,1,'D')])
        bg = 'r'; snowd = 5
    return pal, pa, pb, prof, rim, shadow, iso, bg, snowd

def snowmap(w, top, ragged):
    return {dx: top + ragged[(dx + w) % len(ragged)] for dx in range(-w - 1, w + 2)}

def make(letter, snowy):
    pal, pa, pb, prof, rim, shadow, iso, bg, snowd = cfg(letter, snowy)
    if snowy:
        rag = {'A': [0, 1, 0, -1, 1, 0], 'B': [1, 0, 1, 0, -1, 1, 0], 'C': [0, 1, 1, 0]}[letter]
        for p in pa + pb + [iso]:
            p['snow'] = snowmap(p['w'], snowd, rag)
    def bodyof(ps):
        g = [[bg] * 16 for _ in range(16)]
        put = torus_put(g)
        for p in ps: peak(put, **p)
        return mapg(g, pal)
    A = bodyof(pa); B = bodyof(pb)
    ig = [['.'] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if ((x + .5 - 8) / 7.4) ** 2 + ((y + .5 - 9) / 5.8) ** 2 <= 1: ig[y][x] = 'g'
    def put(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16: ig[y][x] = c
    peak(put, **iso)
    isog = mapg(ig, pal)
    return assemble(A, B, isog, prof, rim, shadow)

if __name__ == '__main__':
    what = sys.argv[1]; letters = sys.argv[2] if len(sys.argv) > 2 else 'ABC'
    slug = {'mountain': 'mountain', 'snow': 'snow_mountain'}[what]
    for k in letters:
        open(os.path.join(BASE, slug, f'w3-{k}.pxg'), 'w').write(to_pxg(make(k, what == 'snow'), f'{slug} w3-{k}'))
