"""k7 kit_shrine 공통 도우미 — G 격자에 (램프,단) 을 손으로 놓고 .pxg 로 내보낸다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = [[None] * W for _ in range(H)]
class P:
    def __init__(s, slug): s.ox, s.oy = AT[slug]
    def px(s, x, y, k): G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])
def k(r, t): return (r, max(0, t)) if not isinstance(r, str) or r not in '~-%' else r
def export(name, title):
    POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
    legend, rev, rows = {}, {}, []
    for r in G:
        line = ''
        for c in r:
            if c is None: line += '.'
            elif isinstance(c, str): line += c
            else:
                if c not in rev: ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
                line += rev[c]
        rows.append(line)
    out = os.path.join(KIT, name + '.pxg')
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=title))
    print(out, len(legend), '색')
