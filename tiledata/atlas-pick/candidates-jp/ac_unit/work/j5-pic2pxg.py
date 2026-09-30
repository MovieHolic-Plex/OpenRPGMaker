#!/usr/bin/env python3
"""j5 표기 변환기: 글자 하나 = 「램프:단」 한 칸을 손으로 놓은 .pic → pxgrid .pxg (@mat + @mblock + @tblock).
보간·노이즈 없음. 그림은 .pic 에 손으로 적는다. 사용: j5-pic2pxg.py in.pic out.pxg
.pic 형식:
  size W H
  L 글자 램프 단        (단 = 0~9 a~e)
  ---
  줄들 ( . = 비움, ~ - % = 반투명 그림자/빛 글자 그대로, 줄 끝 ' *N' = 그 줄 N번)
"""
import sys
src, dst = sys.argv[1], sys.argv[2]
W = H = None; leg = {}; rows = []; body = False; comments = []
for raw in open(src, encoding='utf-8'):
    s = raw.rstrip('\n')
    if body:
        if not s.strip() or s.startswith('//'):
            continue
        n = 1
        if ' *' in s:
            s, n = s.rsplit(' *', 1); n = int(n)
        rows += [s.strip()] * n
        continue
    t = s.split()
    if not t:
        continue
    if t[0] == 'size': W, H = int(t[1]), int(t[2])
    elif t[0] == 'L': leg[t[1]] = (t[2], t[3])
    elif t[0] == '//': comments.append(s)
    elif t[0] == '---': body = True
assert len(rows) == H, f'{src}: rows {len(rows)} != {H}'
for j, r in enumerate(rows):
    assert len(r) == W, f'{src}: row {j} len {len(r)} != {W}: {r}'
ramps = sorted({v[0] for v in leg.values()}); mat = {r: chr(65 + i) for i, r in enumerate(ramps)}
out = [f'@size {W} {H}', '@cell 16', '@palette palette.pal'] + comments
out += [f'@mat {mat[r]} {r} 2' for r in ramps]
m, tl = [], []
for r in rows:
    a = b = ''
    for c in r:
        if c == '.': a += '.'; b += '.'
        elif c in '~-%': a += c; b += '.'
        else:
            if c not in leg: raise SystemExit(f'{src}: 범례에 없는 글자 {c!r}')
            a += mat[leg[c][0]]; b += leg[c][1]
    m.append(a); tl.append(b)
out += ['@mblock 0 0'] + m + ['@tblock 0 0'] + tl
open(dst, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
