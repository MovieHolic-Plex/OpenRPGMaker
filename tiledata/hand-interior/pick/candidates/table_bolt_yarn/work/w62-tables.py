#!/usr/bin/env python3
"""w62: table 9종 — 몸통 = table:bolt+yarn w46-A (상판 6~10행 짜임·앞모서리·다리), 물건 = 각 형제 v5 그대로 1행 위로.
천 덮개 형제(cake_pie, potion_flask, book_scroll, gem_coins, plate_cup)는 천 램프로 상판·자락을 칠하고 양옆 나무틀·다리·그림자는 ref."""
import re, os, sys, collections
C = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def pal(slug):
    m = {}
    for l in open(f'{C}/{slug}/palette.pal'):
        mm = re.match(r'\s*(\S)\s+#([0-9a-fA-F]{6,8})\s*//\s*=\s*(\w+):(\d)', l)
        if mm: m[mm.group(1)] = (mm.group(3), int(mm.group(4)))
    return m
def grid(slug, fn):
    rows = []; on = False
    for l in open(f'{C}/{slug}/{fn}'):
        l = l.rstrip('\n')
        if l.startswith('@block'):
            if on: break
            on = True; continue
        if on and l.startswith('@'): break
        if on and l and not l.startswith('//'): rows.append(l)
    return rows
W, H = 32, 16
def v5cells(s):
    p = pal('table_' + s); g = grid('table_' + s, 'v5.pxg')
    return [[p.get(c) if c != '.' else None for c in r] for r in g]
SIBS = ['loaf_bun', 'cake_pie', 'fish_fishr', 'potion_flask', 'plate_cup', 'book_scroll', 'mug_bottle', 'steak_ham', 'gem_coins']
CLOTH = {'cake_pie': 'linen', 'potion_flask': 'purple', 'plate_cup': 'linen', 'book_scroll': 'green', 'gem_coins': 'red'}
WOODS = ['loaf_bun', 'fish_fishr', 'mug_bottle', 'steak_ham']
cells = {s: v5cells(s) for s in SIBS}
by = v5cells  # alias
# 나무 상판 템플릿 = 나무 형제들의 (행,열)별 최빈
wood_t = {}
for r in range(H):
    for c in range(W):
        cnt = collections.Counter(cells[s][r][c] for s in WOODS if cells[s][r][c] and cells[s][r][c][0] == 'wood')
        wood_t[(r, c)] = cnt.most_common(1)[0][0] if cnt else None
# ref 몸통(물건을 떼어 낸 것)
RB = grid('table_bolt_yarn', 'w46-A.pxg')  # @block 그림자
def ref_layers():
    L = {}; cur = None
    for l in open(f'{C}/table_bolt_yarn/w46-A.pxg'):
        l = l.rstrip('\n')
        if l.startswith('@mblock'): cur = 'm'; L[cur] = []; continue
        if l.startswith('@tblock'): cur = 't'; L[cur] = []; continue
        if l.startswith('@block'): cur = 'b'; L[cur] = []; continue
        if l.startswith('@'): cur = None; continue
        if cur and l: L[cur].append(l)
    return L
RL = ref_layers()
shadow_rows = RL['b']
REFWOOD = {(r, c): int(RL['t'][r][c]) for r in range(H) for c in range(W) if RL['m'][r][c] == 'a' and RL['t'][r][c].isdigit()}
def body_wood(r, c):
    """물건 없는 ref 몸통의 나무 단(없으면 None). 상판 6~10, 앞 11~13, 다리 14."""
    if r == 6: return 6 if c == 0 else (4 if c == 31 else 7)
    if 7 <= r <= 10:
        if c == 0: return 5
        if c == 31: return 3
        if r == 9 and (c % 7) in (4, 5) and 3 < c < 29: return 5
        return 6
    if r == 11: return 7 if c < 31 else 3
    if r == 12: return 3 if c < 31 else 1
    if r == 13: return 2 if c < 31 else 1
    if r == 14 and (1 <= c <= 3 or 28 <= c <= 30): return 1
    return None
def goods_mask(s):
    g = cells[s]
    cloth = s in CLOTH
    m = [[False] * W for _ in range(H)]
    if cloth:
        ref = g[8][5]  # 천 면
        hl = g[3][1]    # 천 윗선
        def tmpl(r, c):
            if r == 2: return g[2][0]
            if r == 3: return hl if 1 <= c <= 30 and False else g[3][c] if c in (0, 31) else None
            return g[r][c] if c in (0, 31) else ref
    for r in range(1, 8):
        for c in range(W):
            v = g[r][c]
            if v is None: continue
            if cloth:
                if r == 2 and v == g[2][0] and c in (0, 1, 2, 31, 30, 29): continue
                t = ref if r >= 4 else None
                if c in (0, 31): continue
                if r >= 4 and v == ref: continue
                if r in (2, 3) and v == g[3][1] and s in ('potion_flask', 'book_scroll', 'gem_coins') and c in (1, 2, 3, 29, 30): continue
                if r == 2 and v == g[2][0]: continue
                if r == 3 and v == g[3][1] and c in (1, 2, 29, 30): continue
                m[r][c] = True
            else:
                if r == 1: m[r][c] = True; continue
                if v == wood_t[(r, c)]: continue
                m[r][c] = True
    return m
def fill(m, s):
    # 둘러싸인 빈칸·좁은 틈을 물건으로 채운다
    for _ in range(2):
        for r in range(1, 8):
            c = 0
            while c < W:
                if not m[r][c]:
                    e = c
                    while e < W and not m[r][e]: e += 1
                    if c > 0 and e < W and e - c <= 3 and cells[s][r][c] is not None and r <= 7:
                        for k in range(c, e): m[r][k] = True
                    c = e
                else: c += 1
    # 외부에서 닿지 않는 빈칸
    seen = [[False] * W for _ in range(9)]
    st = [(r, c) for r in range(9) for c in range(W) if (r in (0, 8) or c in (0, W - 1)) and not m[r][c]]
    for r, c in st: seen[r][c] = True
    while st:
        r, c = st.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = r + dr, c + dc
            if 0 <= a < 9 and 0 <= b < W and not seen[a][b] and not m[a][b]:
                seen[a][b] = True; st.append((a, b))
    for r in range(1, 8):
        for c in range(W):
            if not m[r][c] and not seen[r][c] and cells[s][r][c] is not None: m[r][c] = True
    return m
EXTRA = {'mug_bottle': [(r, c) for r in range(2, 7) for c in range(4, 29) if cells['mug_bottle'][r][c] and cells['mug_bottle'][r][c][0] == 'wood' and 1 <= cells['mug_bottle'][r][c][1] <= 5 and (r > 2 or cells['mug_bottle'][r][c][1] != 1 or c in (12, 17, 18, 22))] + [(3, 7), (4, 7)]}  # slug -> v5 좌표 손 보탬
def build(s):
    g = cells[s]; m = fill(goods_mask(s), s)
    for rc in EXTRA.get(s, []): m[rc[0]][rc[1]] = True
    out = [[None] * W for _ in range(H)]
    cl = CLOTH.get(s)
    for r in range(H):
        for c in range(W):
            w = body_wood(r, c)
            if w is None: continue
            if cl and 1 <= c <= 30 and 6 <= r <= 13:
                continue
            out[r][c] = ('wood', w)
    if cl:
        top = {6: 6, 7: 5, 8: 5, 9: 5, 10: 5}
        for r in range(6, 11):
            for c in range(1, 31): out[r][c] = (cl, top[r])
        # 자락: v5 10,11행 짜임
        for r, vr, d in ((11, 10, 0), (12, 11, 0), (13, 11, 1)):
            for c in range(1, 31):
                v = g[vr][c]
                if v is None or v[0] != cl:
                    v = g[vr][c - 1] if c > 1 else g[vr][2]
                out[r][c] = (cl, max(0, v[1] - d))
        # 천 윗선 (v5 3행 천 하이라이트는 6행에 이미)
    for r in range(1, 8):
        for c in range(W):
            if m[r][c]:
                v = g[r][c]
                if v is None: continue
                out[r - 1][c] = v
    return out
def emit(s, out):
    ramps = []
    for r in out:
        for v in r:
            if v and v[0] not in ramps: ramps.append(v[0])
    letters = 'abcdefghijklmnopqrstuvwxyz'
    lm = {rp: letters[i] for i, rp in enumerate(ramps)}
    o = ['@size 32 16', '@cell 16', '@palette palette.pal']
    for rp in ramps: o.append(f'@mat {lm[rp]} {rp}')
    o.append('@layer shadow'); o.append('@block 0 0')
    o += shadow_rows
    o.append('@layer main'); o.append('@mblock 0 0')
    for r in out: o.append(''.join(lm[v[0]] if v else '.' for v in r))
    o.append('@tblock 0 0')
    for r in out: o.append(''.join(str(v[1]) if v else '.' for v in r))
    return '\n'.join(o) + '\n'
NOTE = {
 'loaf_bun': '3/4: ref(w46-A) 상판 6~10행·앞모서리 7·다리 몸통에 v5 빵·롤 그대로 1행 위로 얹음.',
}
if __name__ == '__main__':
    for s in SIBS:
        out = build(s)
        d = f'{C}/table_{s}'
        open(f'{d}/w62-A.pxg', 'w').write(emit(s, out))
        note = NOTE.get(s, f'3/4: ref(table:bolt+yarn w46-A) 몸통 — 상판 윗면 6~10행·앞 모서리 하이라이트 11행·다리·그림자, 물건은 v5 {s} 그대로 1행 위로' + (f', {CLOTH[s]} 천 덮개·자락 유지 양옆 나무틀' if s in CLOTH else '') + '. work/w62-tables.py')
        open(f'{d}/w62-A.note', 'w').write(note + '\n')
        print('wrote', s)
