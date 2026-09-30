"""w2 작업자 공용 도우미 (자기 파일). 손으로 놓은 좌표/도장 -> 글자 격자 -> pxg_emit.
번들은 '블롭 세계'를 쿼터타일 규칙(변마다 안쪽 여백 E, 모서리 둥글림)으로 만들고 12칸을 잘라 낸다."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../../scripts/content/atlas-pick'))
from pxg_emit import emit

def blank(w=16, h=16, ch='g'):
    return [[ch]*w for _ in range(h)]

def stamp(g, shape, x, y, ch=None, wrap=True):
    """shape: 줄 문자열 리스트, '.'=건너뜀, 다른 글자=그 글자(ch 있으면 ch). x,y는 왼쪽 위. 16 주기로 감싼다."""
    H = len(g); W = len(g[0])
    for j, row in enumerate(shape):
        for i, c in enumerate(row):
            if c == '.': continue
            xx, yy = x+i, y+j
            if wrap: xx %= W; yy %= H
            elif not (0 <= xx < W and 0 <= yy < H): continue
            g[yy][xx] = ch or c

def rows(g): return [''.join(r) for r in g]

def hjoin(tiles):
    return [''.join(t[j] for t in tiles) for j in range(len(tiles[0]))]

def vjoin(tiles):
    out = []
    for t in tiles: out += t
    return out

def write(path, rws, legend, title):
    open(path, 'w').write(emit(rws, legend, title))

# ---------- 번들 세계 ----------
def bundle(P):
    """P: E, R, RN, EI, wN,wS,wW,wE(16개 정수), tex(16줄), texalt(16줄), color(fn), legend, shadow(bool)
    반환: 48x64 글자 행 리스트."""
    E, R, RN, EI = P['E'], P['R'], P['RN'], P.get('EI', P['E'])
    wN, wS, wW, wE = P['wN'], P['wS'], P['wW'], P['wE']
    B = set()
    for cy in range(3):
        for cx in range(3): B.add((1+cx, 1+cy))
    for c in [(6,1),(5,1),(7,1),(6,0),(6,2)]: B.add((c[0]+2, c[1]+1))  # plus
    B.add((13, 2))
    plus_c = (8, 2); alt_cell = (2, 2)   # body 칸은 (2,2)
    body_cell = (2, 2)

    def cin(c): return c in B
    def inside(px, py):
        cx, cy = px//16, py//16; lx, ly = px % 16, py % 16
        if (cx, cy) not in B: return False
        n = cin((cx, cy-1)); s = cin((cx, cy+1)); w = cin((cx-1, cy)); e = cin((cx+1, cy))
        iso = not (n or s or w or e)
        Ee = EI if iso else E
        if not n and ly < Ee + wN[lx]: return False
        if not s and ly > 15 - Ee - wS[lx]: return False
        if not w and lx < Ee + wW[ly]: return False
        if not e and lx > 15 - Ee - wE[ly]: return False
        r = R if not iso else P.get('RI', R)
        def disc(cxp, cyp, rr):
            return (lx+.5-cxp)**2 + (ly+.5-cyp)**2 <= rr*rr
        # 볼록 모서리
        if not n and not w and lx < Ee+r and ly < Ee+r and not disc(Ee+r, Ee+r, r): return False
        if not n and not e and lx > 15-Ee-r and ly < Ee+r and not disc(16-Ee-r, Ee+r, r): return False
        if not s and not w and lx < Ee+r and ly > 15-Ee-r and not disc(Ee+r, 16-Ee-r, r): return False
        if not s and not e and lx > 15-Ee-r and ly > 15-Ee-r and not disc(16-Ee-r, 16-Ee-r, r): return False
        # 오목 모서리(안쪽 코너): 이웃 둘은 있고 대각이 없음 -> 바깥 모서리 사각형 EEE 안, 둥글림으로 일부 되살림
        nw = cin((cx-1, cy-1)); ne = cin((cx+1, cy-1)); sw = cin((cx-1, cy+1)); se = cin((cx+1, cy+1))
        if n and w and not nw and lx < E+wW[ly] and ly < E+wN[lx]:
            if not (lx >= E-RN and ly >= E-RN and not disc(E-RN, E-RN, RN)): return False
        if n and e and not ne and lx > 15-E-wE[ly] and ly < E+wN[lx]:
            if not (lx <= 15-E+RN and ly >= E-RN and not disc(16-E+RN, E-RN, RN)): return False
        if s and w and not sw and lx < E+wW[ly] and ly > 15-E-wS[lx]:
            if not (lx >= E-RN and ly <= 15-E+RN and not disc(E-RN, 16-E+RN, RN)): return False
        if s and e and not se and lx > 15-E-wE[ly] and ly > 15-E-wS[lx]:
            if not (lx <= 15-E+RN and ly <= 15-E+RN and not disc(16-E+RN, 16-E+RN, RN)): return False
        return True

    W, H = 16*15, 16*5
    M = [[inside(x, y) for x in range(W)] for y in range(H)]
    def ins(x, y): return 0 <= x < W and 0 <= y < H and M[y][x]
    def dist(x, y):
        best = (9, False)
        for (dx, dy, lit) in ((-1,0,True),(0,-1,True),(1,0,False),(0,1,False)):
            for k in range(1, 6):
                if not ins(x+dx*k, y+dy*k):
                    if k < best[0] or (k == best[0] and not lit): best = (k, lit)
                    break
        return best
    out = [['.']*W for _ in range(H)]
    tex, texalt = P['tex'], P['texalt']
    for y in range(H):
        for x in range(W):
            if M[y][x]:
                d, lit = dist(x, y)
                cell = (x//16, y//16)
                t = (texalt if cell == alt_cell else tex)[y % 16][x % 16]
                out[y][x] = P['color'](x, y, d, lit, t, cell)
    if P.get('shadow'):
        for y in range(H):
            for x in range(W):
                if not M[y][x] and (x//16, y//16) in B:
                    if ins(x, y-1) or ins(x-1, y):
                        out[y][x] = '~' if P.get('shadow') != 'soft' else '-'
                    elif ins(x-1, y-1) or ins(x-2, y) and P.get('shadow') != 'soft':
                        out[y][x] = '-'
    def cellrows(c):
        return [''.join(out[c[1]*16+j][c[0]*16:c[0]*16+16]) for j in range(16)]
    C = lambda dx, dy, base=(1,1): (base[0]+dx, base[1]+dy)
    cells = {}
    # 3x3 블록 (1..3,1..3) 은 위치 (cx,cy)->(1+cx,1+cy) 로 만들어 둠
    grid = [['isolated','body_alt','inner'],['corner_nw','edge_n','corner_ne'],['edge_w','body','edge_e'],['corner_sw','edge_s','corner_se']]
    src = {
        'corner_nw':(1,1),'edge_n':(2,1),'corner_ne':(3,1),
        'edge_w':(1,2),'body':(2,2),'edge_e':(3,2),
        'corner_sw':(1,3),'edge_s':(2,3),'corner_se':(3,3),
        'inner':(8,2),'isolated':(13,2),'body_alt':(2,2)}
    # plus 중심 = (6+2,1+1)=(8,2)
    tiles = {k: cellrows(v) for k, v in src.items()}
    # body_alt: alt 텍스처를 body 칸 전체에 (림 없음: 사방 이웃이 있어 안쪽)
    tiles['body_alt'] = [''.join(P['color'](x, y, 9, False, texalt[y][x], None) for x in range(16)) for y in range(16)]
    sheet = []
    for r in grid:
        sheet += hjoin_tiles([tiles[n] for n in r])
    return sheet

def hjoin_tiles(ts):
    return [''.join(t[j] for t in ts) for j in range(16)]
