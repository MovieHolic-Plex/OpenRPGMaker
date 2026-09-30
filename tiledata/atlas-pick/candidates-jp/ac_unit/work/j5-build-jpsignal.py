import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Pk=lambda t:('pole',t); Lq=lambda t:('lacq',t)
LAMP=[".LLLL.","LhhLLd","LhLLLd","LLLLLd","LLLLdd",".dddd."]
def lamp(c,x,y,base,hi,dk):
    c.blit(x,y,LAMP,{'L':base,'h':hi,'d':dk})
def pole(c,x,y0,y1,w=3,hi=4,mid=3,lo=1):
    c.rect(x,y0,w,y1-y0+1,Pk(mid)); c.vl(x,y0,y1-y0+1,Pk(hi)); c.vl(x+w-1,y0,y1-y0+1,Pk(lo))
LIT=[('mteal',2),('mteal',4),('mteal',1)]
YEL=[('myellow',0),('myellow',0),Lq(1)]
RD=[('mred',1),('mred',2),('mred',0)]
# ---------- A
c=C(32,48)
pole(c,2,3,46); c.rect(1,42,5,3,Pk(3)); c.hl(1,42,5,Pk(4)); c.hl(1,44,5,Pk(1)); c.hl(1,45,5,Pk(0))
c.hl(2,20,3,Pk(1)); c.hl(2,34,3,Pk(1))
c.hl(2,2,28,Pk(4)); c.hl(3,3,27,Pk(2)); c.put(2,3,Pk(3)); c.put(3,1,Pk(3)); c.put(2,1,Pk(4)); c.put(4,1,Pk(1))
c.vl(10,4,1,Pk(1)); c.vl(24,4,1,Pk(1))
# 함
c.rect(6,5,24,13,Lq(2)); c.hl(6,5,24,Lq(4)); c.hl(7,6,22,Lq(3)); c.vl(6,6,11,Lq(3)); c.vl(29,6,11,Lq(0)); c.vl(28,7,10,Lq(1)); c.hl(7,17,23,Lq(0))
c.hl(7,7,21,Lq(0))  # 차양 줄
for x,(b,h,d) in ((8,LIT),(15,YEL),(22,RD)): lamp(c,x,8,b,h,d)
c.hl(6,4,1,Lq(2))
c.hl(6,46,10,'~'); c.hl(3,47,10,'-'); c.hl(15,47,3,'-') if False else None
finish(c,'jp_signal','A',"강남 신호등과 같은 결: 검은 칠 함 가로 3등(청록·노랑·빨강), 청록만 켜짐, 차양 줄 1행, 회색 폴 3px+받침, 왼아래 칸에 서서 팔이 오른쪽으로 뻗음")
# ---------- B
c=C(32,48)
pole(c,2,3,46); c.rect(0,41,6,4,Pk(3)); c.hl(0,41,6,Pk(5)); c.hl(0,42,6,Pk(4)); c.hl(0,44,6,Pk(1)); c.hl(0,45,6,Pk(0)); c.vl(5,42,3,Pk(1))
c.hl(2,14,3,Pk(1)); c.hl(2,28,3,Pk(1)); c.hl(2,15,3,Pk(5)) if False else None
c.hl(2,2,28,Pk(5)); c.hl(3,3,27,Pk(3)); c.hl(3,4,27,Pk(1)); c.put(2,3,Pk(4)); c.put(2,4,Pk(3))
c.rect(6,5,25,14,Lq(2)); c.hl(6,5,25,Lq(6)); c.hl(6,6,25,Lq(5)); c.hl(7,7,23,Lq(4)); c.vl(6,7,11,Lq(3))
c.vl(30,6,13,Lq(0)); c.vl(29,7,11,Lq(1)); c.vl(28,7,11,Lq(1)); c.hl(6,18,25,Lq(0)); c.hl(7,17,22,Lq(1))
c.hl(7,8,21,Lq(0))
for x,(b,h,d) in ((8,LIT),(15,YEL),(22,RD)): lamp(c,x,9,b,h,d)
# 켜진 등 안쪽 빛 테두리
for (x,y) in [(7,9),(7,10),(7,11),(7,12),(7,13),(14,9),(14,10),(14,11),(14,12),(14,13)]:
    pass
c.hl(9,8,4,('mteal',1)); c.vl(7,10,4,('mteal',1)); c.vl(14,10,4,('mteal',1)); c.hl(9,15,4,('mteal',1))
c.hl(6,46,12,'~'); c.hl(4,47,14,'~'); c.hl(10,45,6,'-') 
finish(c,'jp_signal','B',"함 윗면 2줄 밝게+오른쪽 2px 그늘로 입체, 켜진 청록등 둘레에 빛 테두리, 폴 받침 윗면 밝고 오른쪽·아래 어둡게, 발치 접지 그림자 2줄+번짐")
# ---------- C
c=C(32,48)
pole(c,0,6,46,4,4,3,1); c.rect(0,42,6,4,Pk(3)); c.hl(0,42,6,Pk(4)); c.hl(0,45,6,Pk(0)); c.vl(5,43,2,Pk(1))
# 굽은 팔
c.hl(1,2,26,Pk(4)); c.hl(2,3,25,Pk(2)); c.hl(0,4,3,Pk(3)); c.hl(0,5,3,Pk(3)); c.put(0,3,Pk(3)); c.put(0,4,Pk(4))
c.vl(12,4,3,Pk(1)); c.vl(24,4,3,Pk(1))
# 함: 등마다 큰 차양(모자) 튀어나옴
c.rect(6,6,26,13,Lq(1)); c.hl(6,6,26,Lq(3)); c.vl(6,7,11,Lq(3)); c.vl(31,7,11,Lq(0)); c.hl(7,18,25,Lq(0))
for x,(b,h,d) in ((8,LIT),(15,YEL),(22,RD)):
    c.hl(x-1,7,8,Lq(4)); c.hl(x-1,8,8,Lq(2)); c.hl(x,9,6,Lq(0))
    lamp(c,x,10,b,h,d)
    c.vl(x+6,9,7,Lq(0))
c.rect(24,7,0,0,None)
c.hl(6,46,10,'~'); c.hl(4,47,12,'-')
finish(c,'jp_signal','C',"실루엣 재해석: 등마다 튀어나온 차양(일본 신호등 특유의 모자)을 크게 과장, 폴을 4px 굵게 해 왼쪽 끝에 붙임 — 한눈에 일본 가로 신호로 읽힘")
sheet('jp_signal',6)
