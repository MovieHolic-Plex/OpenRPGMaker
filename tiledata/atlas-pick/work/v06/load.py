import re, glob
from lib import CAND
def find_orig(slug):
    return [p for p in sorted(glob.glob(f'{CAND}/{slug}/*-A.pxg')) if 'v34' not in p][0]
def load(slug):
    """-> (W,H, grid[y][x] = (ramp,tone) or None)"""
    src = open(find_orig(slug)).read().split('\n')
    W = H = 0; mats = {}; grid = None
    mode = None; mrows = []; trows = []
    px = []
    for ln in src:
        if ln.startswith('@size'): _, W, H = ln.split()[:3]; W = int(W); H = int(H)
        elif ln.startswith('@mat '): _, l, r, _t = ln.split(); mats[l] = r
        elif ln.startswith('@mblock'): mode = 'm'
        elif ln.startswith('@tblock'): mode = 't'
        elif ln.startswith('@px'):
            tok = ln.split()[1:]
            for i in range(0, len(tok), 3):
                x, y, rt = int(tok[i]), int(tok[i+1]), tok[i+2]
                r, t = rt.split(':'); px.append((x, y, r, int(t)))
        elif ln.startswith('@') or ln.startswith('//'): mode = None if ln.startswith('@') else mode
        elif mode == 'm' and ln: mrows.append(ln)
        elif mode == 't' and ln: trows.append(ln)
    grid = [[None]*W for _ in range(H)]
    for y, (mr, tr) in enumerate(zip(mrows, trows)):
        for x in range(W):
            if mr[x] != '.': grid[y][x] = (mats[mr[x]], int('0123456789abcde'.index(tr[x])))
    for x, y, r, t in px: grid[y][x] = (r, t)
    return W, H, grid
if __name__ == '__main__':
    import sys
    W, H, g = load(sys.argv[1])
    ramps = sorted({c[0] for r in g for c in r if c})
    key = {r: chr(97+i) for i, r in enumerate(ramps)}
    print(W, H, key)
    for y, r in enumerate(g): print(f'{y:2d} ' + ''.join(key[c[0]] if c else '.' for c in r) + '  ' + ''.join(str(c[1]) if c else '.' for c in r))
