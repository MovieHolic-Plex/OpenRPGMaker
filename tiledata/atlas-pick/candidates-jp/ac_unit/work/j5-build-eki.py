import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Wh=lambda t:('mwhite',t); G=lambda t:('kgreen',t); S=lambda t:('sumi',t); M=lambda t:('mmetal',t)
E=["...###....",
   ".....###..",
   "..........",
   ".########.",
   "......##..",
   ".....##...",
   "...###....",
   "..##......",
   ".##......#",
   ".###..###.",
   "..######.."]
KI=["......##..",
    ".########.",
    "....##....",
    "..######..",
    "...##.....",
    "..##......",
    ".##.......",
    ".##.......",
    ".###...#..",
    "..#######.",
    "....###..."]
def glyph(c,x,y,rows,col):
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch=='#': c.put(x+i,y+j,col)
def tri(c,x,y,left,col,h=7):
    for k in range(h):
        n=min(k,h-1-k)+1
        if left: c.hl(x+4-n,y+k,n,col)
        else: c.hl(x,y+k,n,col)
def corners(c):
    for (cx,cy) in ((0,0),(c.w-1,0),(0,c.h-1),(c.w-1,c.h-1),(1,0),(c.w-2,0),(1,c.h-1),(c.w-2,c.h-1),(0,1),(c.w-1,1),(0,c.h-2),(c.w-1,c.h-2)):
        c.put(cx,cy,None)
# ---- A
c=C(48,16)
c.rect(0,0,48,13,Wh(5))
c.hl(0,0,48,Wh(3)); c.hl(0,1,48,Wh(5)); c.vl(0,0,13,Wh(3)); c.vl(47,0,13,Wh(3))
c.rect(0,13,48,3,G(2)); c.hl(0,13,48,G(3)); c.hl(0,15,48,G(0)); c.hl(0,14,48,G(1)) if False else None
c.vl(47,13,3,G(1))
glyph(c,11,2,E,S(1)); glyph(c,26,2,KI,S(1))
tri(c,2,3,True,G(2)); tri(c,42,3,False,G(2))
corners(c)
finish(c,'station_nameboard','A',"강남 정면: 흰 판 가운데 먹색 「えき」(2px 획) + 양끝 초록 ◀▶, 아래 초록 띠, 오른쪽·아래 한 단 어둡게")
# ---- B
c=C(48,16)
c.rect(0,0,48,16,M(6))
c.hl(0,0,48,M(7)); c.vl(0,0,16,M(7)); c.vl(47,0,16,M(3)); c.hl(0,15,48,M(2))
c.rect(1,1,46,12,Wh(5)); c.hl(1,1,46,Wh(2)); c.hl(1,2,46,Wh(3)); c.vl(1,1,12,Wh(3)); c.vl(46,2,11,Wh(4))
c.rect(1,13,46,2,G(2)); c.hl(1,13,46,G(4)); c.hl(1,14,46,G(0))
glyph(c,11,2,E,S(0)); glyph(c,26,2,KI,S(0))
tri(c,3,3,True,G(3)); tri(c,42,3,False,G(3))
corners(c)
finish(c,'station_nameboard','B',"빛 강화: 금속 테두리(윗·왼쪽 밝고 아래·오른쪽 어둡게)로 판 두께감, 판 안쪽 윗줄 그늘, 초록 띠 윗줄 밝게·아랫줄 어둡게")
# ---- C
c=C(48,16)
c.rect(0,0,48,16,G(2))
c.hl(0,0,48,G(4)); c.vl(0,0,16,G(3)); c.vl(47,0,16,G(1)); c.hl(0,15,48,G(0))
c.hl(1,1,46,Wh(5)); c.hl(1,14,46,Wh(4)); c.vl(1,1,14,Wh(5)); c.vl(46,1,14,Wh(4))
c.rect(2,2,44,12,G(3)); c.hl(2,2,44,G(4)); c.hl(2,13,44,G(2))
glyph(c,12,2,E,G(1)); glyph(c,27,2,KI,G(1))   # 그늘 (오른쪽·아래 1px)
glyph(c,11,2,E,Wh(5)); glyph(c,26,2,KI,Wh(5))
tri(c,4,4,True,Wh(5)); tri(c,40,4,False,Wh(5))
corners(c)
finish(c,'station_nameboard','C',"재해석: 반전 — 초록 판에 흰 「えき」와 흰 ◀▶, 흰 안쪽 테두리, 글자 오른쪽 1px 그늘. 멀리서 읽히는 지하철풍 표지")
sheet('station_nameboard',10)
