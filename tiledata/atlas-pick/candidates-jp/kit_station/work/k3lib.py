"""k3 공용 붓: kit_station 부품 시트(128x80)에 단 색을 손으로 놓는다. 보간·잡음 없음."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
SIZE = {p['slug']: (16 * 1, 16 * len(p['cells']) if isinstance(p['cells'], list) else 16) for p in info['parts']}

class Sheet:
    def __init__(s): s.G = [[None] * W for _ in range(H)]

class P:
    def __init__(s, sh, slug):
        s.sh = sh; s.ox, s.oy = AT[slug]; s.slug = slug
        s.h = 32 if slug in ('pil','side_l','side_r','rail_l','rail_r','glass_wall','door_l','door_r') else 16
    def px(s, x, y, c):
        assert 0 <= x < 16 and 0 <= y < s.h, (s.slug, x, y)
        s.sh.G[s.oy + y][s.ox + x] = c
    def rect(s, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, c)
    def stack(s, spec, x0=0, x1=16, y=0):
        for h, c in spec:
            s.rect(x0, y, x1 - x0, h, c); y += h
        return y
    def col(s, x, y0, y1, c):
        for j in range(y0, y1): s.px(x, j, c)
    def bits(s, x, y, rows, c, unit=1):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != '.':
                    s.rect(x + i * unit, y + j * unit, unit, unit, c)

def K(r, t): return (r, t)

POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
def export(sh, name, title):
    legend, rev, rows = {}, {}, []
    for r in sh.G:
        line = ''
        for c in r:
            if c is None: line += '.'
            else:
                if c not in rev: ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
                line += rev[c]
        rows.append(line)
    out = os.path.join(KIT, name)
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=title))
    print(out, len(legend), '색')
