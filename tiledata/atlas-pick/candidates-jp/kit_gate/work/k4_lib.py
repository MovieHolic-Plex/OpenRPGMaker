"""kit_gate k4 공용 도우미 — 부품 자리 좌표로 그리고 pxg 로 내보낸다(보간·난수 없음, 단은 손으로)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick')))
from pxg_emit import emit

class Sheet:
    def __init__(s):
        info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
        s.W, s.H = info['canvas']
        s.at = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16, p['cells'][0] * 16, p['cells'][1] * 16) for p in info['parts']}
        s.G = [[None] * s.W for _ in range(s.H)]
    def part(s, slug): return P(s, slug)
    def save(s, name, title):
        POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
        legend, rev, rows = {}, {}, []
        for r in s.G:
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

class P:
    def __init__(s, sh, slug): s.sh = sh; s.ox, s.oy, s.w, s.h = sh.at[slug]
    def px(s, x, y, k):
        assert 0 <= x < s.w and 0 <= y < s.h, (x, y)
        s.sh.G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def row(s, y, x0, x1, k):   # x0..x1 포함
        for i in range(x0, x1 + 1): s.px(i, y, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])
