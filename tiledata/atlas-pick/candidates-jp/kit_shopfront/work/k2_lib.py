"""k2 공용 도우미 — 부품 좌표계 그리기 + 내보내기. 단을 손으로 놓는 사각형·선·도안뿐(보간·잡음 없음)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = [[None] * W for _ in range(H)]

class P:
    def __init__(s, slug, dx=0): s.ox, s.oy = AT[slug][0] + dx, AT[slug][1]
    def px(s, x, y, k):
        if k is None: return
        G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def h(s, x, y, w, k): s.rect(x, y, w, 1, k)
    def v(s, x, y, h, k): s.rect(x, y, 1, h, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.' and c in leg: s.px(x + i, y + j, leg[c])
    def get(s, x, y): return G[s.oy + y][s.ox + x]

def k(r, t): return (r, t)

# 글자(가타카나 2px 획, 6×9)
KANA = {
 'ra': ['.####.', '.####.', '......', '######', '######', '...##.', '..##..', '.##...', '##....'],
 'bo': ['......', '......', '......', '......', '######', '######', '......', '......', '......'],
 'me': ['....##', '...##.', '##.##.', '.###..', '..##..', '.####.', '.##.##', '##..##', '##...#'],
 'n':  ['##....', '.##...', '....##', '##..##', '.####.', '...##.', '..##..', '.##...', '##....'],
}
def text_ramen(p, x0, y0, fg, sh, shadow_dx=1, shadow_dy=1):
    """p = text_ramen 부품(32 폭). 글자 네 자, 그림자 먼저."""
    for pas in (0, 1):
        for i, g in enumerate(('ra', 'bo', 'me', 'n')):
            for j, r in enumerate(KANA[g]):
                for a, c in enumerate(r):
                    if c != '#': continue
                    x, y = x0 + i * 8 + a, y0 + j
                    if pas == 0:
                        if sh is not None: p.px(x + shadow_dx, y + shadow_dy, sh)
                    else: p.px(x, y, fg)

def export(name, title):
    POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#'] + [chr(0x100 + i) for i in range(400)]
    legend, rev, rows = {}, {}, []
    for r in G:
        line = ''
        for c in r:
            if c is None: line += '.'
            elif isinstance(c, str): line += c
            else:
                if c not in rev:
                    if len(rev) >= len(POOL): raise SystemExit('legend pool overflow %d' % len(rev))
                    ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
                line += rev[c]
        rows.append(line)
    out = os.path.join(KIT, name)
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=title))
    print(out, len(legend), '색')

# ── 공통 계약 선 ──
def front_frame(p, dark=False):
    p.rect(0, 0, 16, 1, k('mconc', 1)); p.rect(0, 1, 16, 1, k('mconc', 2))
    p.rect(0, 29, 16, 1, k('mconc', 4)); p.rect(0, 30, 16, 1, k('mconc', 3)); p.rect(0, 31, 16, 1, k('mconc', 2))

def band_frame(p, top=('mwhite', 4), bot=('mwhite', 1)):
    p.rect(0, 0, 16, 1, k('mconc', 2)); p.h(0, 1, 16, k(*top)); p.h(0, 13, 16, k(*bot))
    p.rect(0, 14, 16, 1, k('mconc', 1)); p.rect(0, 15, 16, 1, k('mconc', 2))

SAKE = ['...##.......',
        '##.########.',
        '##.##.##.##.',
        '...########.',
        '##.##.##.##.',
        '##.##.##.##.',
        '...########.',
        '##.##....##.',
        '##########..'.replace('##########..', '.#########..')]
# 酒 (12 x 9): 왼쪽 삼수변 + 오른쪽 닭 유(酉). 아래에서 다듬는다.
SAKE = ['...##.......',
        '##..########',
        '##..##.##.##',
        '....########',
        '##..##.##.##',
        '##..##.##.##',
        '.##.########',
        '..#.##....##',
        '##..########']
