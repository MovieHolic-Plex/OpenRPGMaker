import sys
from lib import Cv
from load import load
def rework(slug, ramp, x0, x1, ntop, first, drops, spec, note, mark=None, name='v34-A'):
    """spec: 위->아래 행별 (tone 리스트 or int). 원본 행 first.. 를 drops 제외하고 이어 붙임."""
    W, H, g = load(slug)
    ramps = []
    for r in g:
        for c in r:
            if c and c[0] not in ramps: ramps.append(c[0])
    if ramp not in ramps: ramps.append(ramp)
    L = {r: chr(97 + i) for i, r in enumerate(ramps)}
    cv = Cv(W, H, {L[r]: r for r in ramps})
    y = 0
    # 윗면
    for j, row in enumerate(spec):
        tone = row
        xs0, xs1 = (x0 + 1, x1 - 1) if j == 0 else (x0, x1)
        for x in range(xs0, xs1 + 1):
            t = tone
            if x == x0: t = 1 if j != len(spec) - 1 else 1
            elif x == x1: t = min(tone, 2) if tone > 2 else tone
            elif x == x0 + 1 and tone >= 4 and j not in (0,): t = tone + 1 if tone < 6 else 6
            cv.p(x, y, L[ramp], t)
        y += 1
    if mark: mark(cv, L)
    for oy in range(first, H):
        if oy in drops: continue
        if y >= H: break
        for x in range(W):
            c = g[oy][x]
            if c: cv.p(x, y, L[c[0]], c[1])
        y += 1
    if y < H: print(slug, 'short by', H - y)
    cv.save(slug, name, note)
    return cv
