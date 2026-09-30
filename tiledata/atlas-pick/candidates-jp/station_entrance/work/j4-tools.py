#!/usr/bin/env python3
"""j4 작업 도우미: 행 폭 점검 + 검사 + 맥락 그림.  python3 j4-tools.py <slug> <A|B|C>..."""
import sys, os, subprocess, re
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..'))
for slug, *ds in [sys.argv[1:]]:
    S = f'{R}/tiledata/atlas-pick/candidates-jp/{slug}'
    for d in ds:
        p = f'{S}/j4-{d}.pxg'
        lines = open(p, encoding='utf-8').read().split('\n')
        W = H = None; i = 0; bad = 0; blk = None; rows = 0
        for n, l in enumerate(lines, 1):
            t = l.strip()
            if t.startswith('@size'): W, H = map(int, t.split()[1:3])
            if t.startswith('@'):
                blk = t.split()[0] if t.split()[0] in ('@mblock','@block','@tblock','@tadj') else None
                if blk: bx = int(t.split()[1]); by = int(t.split()[2]); ry = by
                continue
            if blk and t and not t.startswith('//'):
                mult = 1
                if ' *' in t: t, m = t.rsplit(' *', 1); t = t.strip(); mult = int(m)
                if len(t) + bx != W and bx == 0 and blk == '@mblock' and len(t) != W:
                    print(f'{p}:{n}: 폭 {len(t)} != {W}: {t}'); bad += 1
                ry += mult
        if blk and ry - by != H and by == 0: print(f'{p}: 높이 {ry - by} != {H}'); bad += 1
        print(d, 'rows ok' if not bad else 'ROWS BAD')
        subprocess.run(['python3', f'{R}/scripts/content/atlas-pick/check_candidate.py', p], cwd=R)
        subprocess.run(['python3', f'{R}/scripts/content/atlas-pick/context.py', p], cwd=R, stdout=subprocess.DEVNULL)
