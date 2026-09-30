# 사용: python3 ../_lib3/heat.py make_x.py  — 빈 바닥('.')/소품·물('o'/'~') 지도와 40% 초과 창을 보여 준다.
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
src = open(sys.argv[1]).read().split("if BAD:")[0]
g = {'__file__': os.path.abspath(sys.argv[1]), '__name__': 'heat'}
exec(compile(src, sys.argv[1], 'exec'), g)
m = g['m']; T = 16
used = set()
for (x, y, img, w, h, layer) in m.props:
    for dy in range(-(-img.height // T)):
        for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
for (x, y, img) in m.decals:
    for dy in range(-(-img.height // T)):
        for dx in range(-(-img.width // T)): used.add((int(x) + dx, int(y) + dy))
rows = []
for y in range(m.H):
    r = ''
    for x in range(m.W):
        if m.fl[y][x] is None and not m.wa[y][x]: r += ' '
        elif m.wa[y][x] and not m.br[y][x]: r += '~'
        elif (x, y) in used or (x, y) in m.blocked or m.br[y][x]: r += 'o'
        else: r += '.'
    rows.append(r)
print('\n'.join(rows))
emp = [[1 if c == '.' else 0 for c in r] for r in rows]
out = []
for y0 in range(0, m.H - 14, 2):
    for x0 in range(0, m.W - 19, 2):
        c = sum(emp[y][x] for y in range(y0, y0 + 15) for x in range(x0, x0 + 20))
        if c / 300 > .4: out.append((x0, y0, round(c / 300, 2)))
print(len(out), out[:40])
