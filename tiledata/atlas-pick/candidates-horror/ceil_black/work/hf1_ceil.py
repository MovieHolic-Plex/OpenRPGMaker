#!/usr/bin/env python3
"""hf1 천장 윗면 자동 타일(ceil_black / ceil_plaster) A·B·C. 색 계산 없음 — 변마다 단 표를 손으로 정한 것을 놓는다.
실행: python3 tiledata/atlas-pick/candidates-horror/ceil_black/work/hf1_ceil.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from hf1_lib import H, TONES

# 속(검정): 세 방향, 두 기물이 똑같이 쓴다. (x,y)는 16px 칸 안. 사분면(8px)마다 4..11 범위 덩이가 하나 이상.
def interior_A(x, y):
    S = {(5,5),(6,5),(6,6),(10,5),(10,6),(5,10),(5,11),(6,11),(9,10),(10,10),(10,11),
         (1,7),(2,7),(13,4),(14,4),(2,14),(3,14),(12,1),(13,1),(8,8)}
    return ('k', 2) if (x, y) in S else ('k', 1)
def interior_B(x, y):
    S = {(4,4),(5,4),(6,4),(4,5),(5,5),(9,4),(10,4),(11,4),(10,5),(11,5),
         (4,10),(5,10),(6,10),(5,11),(6,11),(9,10),(10,10),(11,10),(9,11),(10,11)}
    if (x, y) in S: return ('k', 2)
    if (x, y) in {(5,4),(10,4),(5,10),(10,10)}: return ('k', 3)   # 덩이 한복판 한 점만 한 단 더 (위에서 덮임)
    return ('k', 0)
def interior_C(x, y):
    qx, qy = x % 8, y % 8
    if qy == 3 and 2 <= qx <= 5: return ('k', 2)
    if qy == 7 and 5 <= qx <= 6: return ('k', 2)
    if qy == 5 and 2 <= qx <= 4: return ('k', 0)
    return ('k', 1)

def mk(widths, tab):
    """tab(side, d, along) -> (mat, tone). widths: 변별 테 폭"""
    return widths, tab

def build(slug, cand, widths, tab, interior, mats, note):
    W = widths
    m = [['.'] * 64 for _ in range(48)]; t = [['.'] * 64 for _ in range(48)]
    def cell(cx, cy, sides, inner=None):
        for y in range(16):
            for x in range(16):
                cand_ = []
                if 'N' in sides and y < W['N']: cand_.append((y, tab('N', y, x)))
                if 'S' in sides and 15 - y < W['S']: cand_.append((15 - y, tab('S', 15 - y, x)))
                if 'W' in sides and x < W['W']: cand_.append((x, tab('W', x, y)))
                if 'E' in sides and 15 - x < W['E']: cand_.append((15 - x, tab('E', 15 - x, y)))
                if inner:
                    for (vx, vy) in inner:
                        dx = x if vx == 'W' else 15 - x; dy = y if vy == 'N' else 15 - y
                        if dx < W[vx] and dy < W[vy]:
                            if dx > dy: cand_.append((dx, tab(vx, dx, y)))
                            elif dy > dx: cand_.append((dy, tab(vy, dy, x)))
                            else:
                                a = tab(vx, dx, y); b = tab(vy, dy, x)
                                cand_.append((dx, a if a[1] <= b[1] else b))
                X, Y = cx * 16 + x, cy * 16 + y
                if cand_:
                    d0 = min(c[0] for c in cand_)
                    pick = sorted((c[1] for c in cand_ if c[0] == d0), key=lambda p: p[1])[0]
                else:
                    pick = interior(x, y)
                m[Y][X] = pick[0]; t[Y][X] = TONES[pick[1]]
    grid = {(0,0):'NW',(1,0):'N',(2,0):'NE',(0,1):'W',(1,1):'',(2,1):'E',(0,2):'SW',(1,2):'S',(2,2):'SE'}
    for (cx, cy), s in grid.items(): cell(cx, cy, s)
    cell(3, 0, '', inner=[('W','N'),('E','N'),('W','S'),('E','S')])
    used = {c for r in m for c in r if c != '.'}
    L = [f'// {slug} {cand} (hf1)', '@size 64 48', '@cell 16', '@palette palette.pal', '@layer main']
    L += [f'@mat {k} {v} 0' for k, v in mats.items() if k in used]
    L += ['@mblock 0 0'] + [''.join(r) for r in m] + ['@tblock 0 0'] + [''.join(r) for r in t]
    d = os.path.join(H, slug)
    open(os.path.join(d, f'{cand}.pxg'), 'w').write('\n'.join(L) + '\n')
    open(os.path.join(d, f'{cand}.note'), 'w').write(note + '\n')

WID = {'N': 4, 'W': 4, 'E': 4, 'S': 4}
def table(mat, N, E, S, beadpos=None, beadalt=None):
    T = {'N': N, 'W': N, 'E': E, 'S': S}
    def tab(side, d, along):
        tone = T[side][d]
        if beadpos and beadpos.get(side) == d and (along // 2) % 2 == 1: tone = beadalt[side]
        return (mat, tone)
    return tab

# ── ceil_black ────────────────────────────────────────────────────────────────
K = 'ceil_black'
build(K, 'hf1-A', WID, table('m', [1,5,4,3], [1,3,3,2], [1,2,5,6]), interior_A, {'k':'vblack','m':'mahog'},
      'A(v5 식구·조용): 속 vblack 1 + 한 단 밝은 작은 덩이(사분면마다), 방 쪽 마호가니 테 4px — 위·왼 [끝1·밝5·4·3], 오른 어둡게 [1·3·3·2], 아래 [끝1 밑줄·2·5·6 입술]. 두 변이 만나는 모서리는 꺾이고 안쪽 모서리 칸은 작은 ㄴ자')
build(K, 'hf1-B', WID, table('r', [0,6,4,2], [0,4,2,1], [0,3,3,6]), interior_B, {'k':'vblack','r':'rot'},
      'B(어둠에서 읽힘·이브식): 속을 vblack 0(가장 어둠)으로 내리고 큰 덩이(3×2) 4개만 2로 — 무늬 적게. 테는 rot 로 끝 0 밑줄 + 바로 안쪽 6 밝은 1px 선(위·왼) / 아래는 [0·3·3·6] 굵은 입술. 값 폭이 넓어 어두운 방에서도 방 윤곽이 남는다')
build(K, 'hf1-C', WID, table('m', [1,5,4,3], [1,3,3,2], [1,2,5,6], beadpos={'N':2,'W':2,'E':2,'S':1}, beadalt={'N':5,'W':5,'E':3,'S':4}), interior_C,
      {'k':'vblack','m':'mahog'},
      'C(재질·무늬·마녀의 집식): 속에 천장 널 결 — 8px 사분면마다 가로 2단 대시 + 어두운 틈 한 줄, 테 가운데 줄은 2px 간격 구슬 몰딩(2on2off, 주기 4라 8px 사분면 어디서 이어도 맞음)')

# ── ceil_plaster ──────────────────────────────────────────────────────────────
K = 'ceil_plaster'
build(K, 'hf1-A', WID, table('g', [1,6,5,3], [1,4,4,3], [1,3,5,6]), interior_A, {'k':'vblack','g':'grave'},
      'A(v5 식구): ceil_black A 와 같은 모양·같은 폭(4px)·같은 속. 테만 밝은 회색 grave — 위·왼 [1·6·5·3], 오른 [1·4·4·3], 아래 [1·3·5·6]. 검은 천장 옆 흰 회벽 몰딩이 벽면 위에 얹힌 자리')
build(K, 'hf1-B', WID, table('d', [0,6,4,2], [0,4,3,2], [0,2,4,6]), interior_B, {'k':'vblack','d':'dust'},
      'B(어둠에서 읽힘): ceil_black B 와 같은 속·같은 폭. 테는 dust(따뜻한 회백) — 끝 0 밑줄 + 바로 안쪽 6 밝은 선, 아래는 [0·2·4·6] 계단식으로 올라가는 굵은 입술')
build(K, 'hf1-C', WID, table('v', [0,6,4,3], [0,4,3,2], [0,2,5,6], beadpos={'N':2,'W':2,'E':2,'S':1}, beadalt={'N':5,'W':5,'E':4,'S':4}), interior_C,
      {'k':'vblack','v':'vmarble'},
      'C(재질): ceil_black C 와 같은 속(널 결)·같은 폭. 테는 vmarble — 가운데 줄이 구슬 몰딩(2px 간격, 주기 4)으로 석고 장식 테처럼')
