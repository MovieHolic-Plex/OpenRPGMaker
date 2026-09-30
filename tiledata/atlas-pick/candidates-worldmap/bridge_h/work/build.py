import sys; sys.path.insert(0,'../../plains_base/work')
from w2lib import *
LEG = {'a':('mwood',0),'b':('mwood',1),'c':('mwood',2),'d':('mwood',3),'e':('mwood',4),'f':('mwood',5)}
def transpose(g): return [list(r) for r in zip(*g)]
def deck(top, bot, seam_rows, plank_tones, grain, hi_row, rail_top, rail_bot, post=None, shadow=(), sh_rows=()):
    g = blank(16,16,'.')
    for y in range(top, bot+1):
        for x in range(16):
            if x%4==1: g[y][x]='b'                       # 판 이음(세로줄), 주기 4
            else:
                tone = plank_tones[((x+2)//4)%len(plank_tones)]
                g[y][x]=tone
    for (x,y,c) in grain:
        if top<y<bot: g[y][x]=c
    for x in range(16):
        g[top][x]=rail_top[x%len(rail_top)]
        g[bot][x]=rail_bot[x%len(rail_bot)]
    if hi_row is not None:
        for x in range(16):
            if x%4!=1: g[top+1][x]=hi_row
    if post:
        for (x,y,c) in post: g[y][x]=c
    for y,ch in sh_rows:
        for x in range(16):
            if g[y][x]=='.': g[y][x]=ch
    return g
# ---- A: 강남 결(저대비 3단), 얇은 난간, 그림자 한 줄 ----
gA=[(1,5,'c'),(2,8,'c'),(5,6,'e'),(6,9,'c'),(9,5,'c'),(10,8,'e'),(13,7,'c'),(14,10,'c'),(1,10,'e'),(6,4,'e')]
A=deck(3,12,None,['d','d','c','d'],gA,None,['e'],['b'],sh_rows=[(13,'-')])
# ---- B: 밝은 윗 난간·짙은 아래 난간·상판 위쪽 하이라이트·기둥머리, 그림자 두 줄 ----
gB=[(1,6,'e'),(2,9,'c'),(5,5,'f'),(6,8,'c'),(9,6,'e'),(10,10,'c'),(13,5,'f'),(14,8,'e'),(1,10,'c'),(6,10,'e')]
B=deck(3,12,None,['d','e','d','c'],gB,'e',['f'],['a'],post=[(0,2,'d'),(8,2,'d'),(0,13,'b'),(8,13,'b')],sh_rows=[(13,'~'),(14,'-')])
# ---- C: 넓은 상판(14줄), 굵은 2px 난간, 판 두 폭 ----
gC=[(1,6,'c'),(5,8,'e'),(6,4,'c'),(9,7,'c'),(10,10,'e'),(13,5,'c'),(14,9,'c'),(2,11,'c'),(9,13,'c')]
C=deck(1,14,None,['d','d','c','e'],gC,None,['f','e'],['a'],sh_rows=[(15,'-')])
# 굵은 난간: 위 2줄, 아래 2줄
for x in range(16):
    C[2][x]='e'; C[13][x]='b'
    C[1][x]='f' if x%8 not in (7,) else 'e'; C[14][x]='a'
for X,g in (('A',A),('B',B),('C',C)):
    write(f'../w2-{X}.pxg', rows(g), LEG, f'bridge_h w2-{X}')
    write(f'../../bridge_v/w2-{X}.pxg', rows(transpose(g)), LEG, f'bridge_v w2-{X}')
