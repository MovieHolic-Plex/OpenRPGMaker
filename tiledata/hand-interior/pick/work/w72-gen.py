#!/usr/bin/env python3
"""w72 보조: candidates/<slug>/w72-X.src (범례+격자) -> w72-X.pxg.  src 형식:
//주석 / 'L 램프 단' 범례 줄 / '@size W H' / '@grid' 다음 줄들이 격자.  '~' '-' 는 그림자, '.' 투명."""
import sys, os
base = os.path.dirname(os.path.abspath(__file__))
for arg in sys.argv[1:]:
    slug, v = arg.split('/')
    d = os.path.join(base, 'candidates', slug)
    src = open(os.path.join(d, f'w72-{v}.src')).read().splitlines()
    leg = []; size = None; grid = []; mode = 0; head = []
    for ln in src:
        if mode == 1:
            if ln.strip() == '' : continue
            grid.append(ln); continue
        if ln.startswith('//'): head.append(ln); continue
        if ln.startswith('@size'): size = ln.split()[1:3]; continue
        if ln.startswith('@grid'): mode = 1; continue
        if ln.strip(): leg.append(ln.split())
    W, H = map(int, size)
    assert len(grid) == H, (slug, 'rows', len(grid), H)
    for i, r in enumerate(grid): assert len(r) == W, (slug, 'row', i, len(r), r)
    used = set(''.join(grid)) - set('.~-')
    assert '#' not in used
    names = {l[0] for l in leg}
    assert used <= names, (slug, 'no legend', used - names)
    out = head + [f'@size {W} {H}', '@cell 16', '@palette palette.pal']
    for l in leg:
        if l[0] in used: out.append(f'@mat {l[0]} {l[1]} {l[2]}')
    out.append('@mblock 0 0'); out += grid
    open(os.path.join(d, f'w72-{v}.pxg'), 'w').write('\n'.join(out) + '\n')
    print('ok', slug, v)
