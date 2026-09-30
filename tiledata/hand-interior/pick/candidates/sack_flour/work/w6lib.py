"""w6 작도 보조: 범례(글자 -> 램프:단 또는 P:팔레트글자)로 그린 격자를 pxgrid 문서로 옮긴다. 색은 만들지 않는다 — 단을 손으로 놓는 표기일 뿐."""
import os, sys
def emit(path, legend, rows, cell=16):
    W = len(rows[0]); H = len(rows)
    assert all(len(r) == W for r in rows), [ (i,len(r)) for i,r in enumerate(rows) if len(r)!=W]
    ramps = []
    for v in legend.values():
        if not v.startswith('P:') and v.split(':')[0] not in ramps: ramps.append(v.split(':')[0])
    letter = {r: chr(ord('a') + i) for i, r in enumerate(ramps)}
    pal, mat, tone = [], [], []
    for r in rows:
        p = m = t = ''
        for ch in r:
            if ch == '.': p += '.'; m += '.'; t += '.'; continue
            v = legend[ch]
            if v.startswith('P:'): p += v[2:]; m += '.'; t += '.'
            else:
                ra, to = v.split(':'); p += '.'; m += letter[ra]; t += to
        pal.append(p); mat.append(m); tone.append(t)
    out = [f'@size {W} {H}', f'@cell {cell}', '@palette palette.pal']
    for ra, l in letter.items(): out.append(f'@mat {l} {ra}')
    out += ['@block 0 0'] + pal + ['@mblock 0 0'] + mat + ['@tblock 0 0'] + tone
    open(path, 'w').write('\n'.join(out) + '\n')
