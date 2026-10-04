"""hf7 공용 도우미 — 격자(재료 글자 + 단 숫자)를 손으로 채워 .pxg/.note 로 굽는다. 무늬는 좌표·규칙을 직접 정해 놓는다(난수·노이즈 없음)."""
import os
ROOT = '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
CAND = ROOT + '/tiledata/atlas-pick/candidates-horror'

class G:
    def __init__(s, w, h, wrapx=False, wrapy=False):
        s.w, s.h, s.wx, s.wy = w, h, wrapx, wrapy
        s.m = [['.'] * w for _ in range(h)]; s.t = [[0] * w for _ in range(h)]
    def put(s, x, y, mat, tone=0):
        if s.wx: x %= s.w
        if s.wy: y %= s.h
        if 0 <= x < s.w and 0 <= y < s.h:
            s.m[y][x] = mat; s.t[y][x] = tone
    def get(s, x, y):
        if s.wx: x %= s.w
        if s.wy: y %= s.h
        return s.m[y][x], s.t[y][x]
    def rect(s, x, y, w, h, mat, tone=0):
        for j in range(h):
            for i in range(w): s.put(x + i, y + j, mat, tone)
    def hline(s, x, y, n, mat, tone):
        for i in range(n): s.put(x + i, y, mat, tone)
    def vline(s, x, y, n, mat, tone):
        for j in range(n): s.put(x, y + j, mat, tone)
    def pts(s, mat, lst):
        """[(x,y,tone)...]"""
        for x, y, t in lst: s.put(x, y, mat, t)
    def rows(s, x, y, mat, rows):
        """rows: 문자열 리스트, 숫자 = 단, '.' = 건드리지 않음."""
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.put(x + i, y + j, mat, int(c, 36))

def bevel(g, mat, x, y, w, h, base, hi=None, lo=None):
    """돌·벽돌 한 덩이(w×h 는 돌 부분, 줄눈 제외): 윗줄·왼줄 밝게, 아랫줄·오른줄 어둡게(빛은 왼쪽 위)."""
    hi = base + 1 if hi is None else hi; lo = base - 1 if lo is None else lo
    g.rect(x, y, w, h, mat, base)
    g.hline(x, y, w, mat, hi); g.vline(x, y, h, mat, hi)
    g.hline(x + 1, y + h - 1, w - 1, mat, lo); g.vline(x + w - 1, y + 1, h - 1, mat, lo)

def course(g, mat, y0, h, xs, blocks, mort_mat, mort_tone, mort_row=True, **kw):
    """한 줄: y0.. h 줄이 돌, 그 아래 한 줄이 가로 줄눈. blocks=[(w, base)...] 가 xs 부터 이어지고 각 덩이 오른쪽 한 열이 세로 줄눈(가로로 32px 이어짐)."""
    if mort_row: g.hline(0, y0 + h, g.w, mort_mat, mort_tone)
    x = xs
    for w, base in blocks:
        g.rect(x + w - 1, y0, 1, h, mort_mat, mort_tone)
        bevel(g, mat, x, y0, w - 1, h, base, **kw)
        x += w
    return x - xs

def emit(slug, cand, w, h, mats, g, note, tile=False, layer='main'):
    for y in range(h):
        for x in range(w):
            m, t = g.m[y][x], g.t[y][x]
            assert m == '.' or m in mats, (slug, cand, x, y, m)
    d = os.path.join(CAND, slug)
    L = [f'// {slug} hf7-{cand} (작업자 hf7, 지하·돌방 한 벌)', f'@size {w} {h}', '@cell 16', '@palette palette.pal']
    if tile: L.append('@tile')
    L.append(f'@layer {layer}')
    L += [f'@mat {k} {v} 0' for k, v in mats.items()]
    L.append('@mblock 0 0'); L += [''.join(r) for r in g.m]
    L.append('@tblock 0 0')
    L += [''.join('.' if g.m[y][x] == '.' else format(g.t[y][x], 'x') if g.t[y][x] < 16 else '?' for x in range(w)) for y in range(h)]
    open(os.path.join(d, f'hf7-{cand}.pxg'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    open(os.path.join(d, f'hf7-{cand}.note'), 'w', encoding='utf-8').write(note.strip() + '\n')
