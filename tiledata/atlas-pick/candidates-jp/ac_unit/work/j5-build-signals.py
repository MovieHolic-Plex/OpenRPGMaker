import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Pk=lambda t:('pole',t); Lq=lambda t:('lacq',t)
RED=('mred',1); REDH=('mred',2); REDD=('mred',0)
BLU=('kblue',4); BLUH=('kblue',5); BLUD=('kblue',2)
STAND=["...RR...","...RR...","..RRRR..","..RRRR..","...RR...","..R..R..","..R..R.."]
WALK=["....BB..","...BBB..","..BBBBB.","...BBB..","...BBB..","..BB.BB.",".BB...B."]
# 정면 서 있는 사람은 머리를 위로 2행 굵게, 걷는 사람은 다리를 벌림
def ped_box(c,x,y,figrows,leg,facebg,top=4,hi=5,shade=0,w=10):
    c.rect(x,y,w,9,Lq(2)); c.hl(x,y,w,Lq(top)); c.vl(x,y+1,8,Lq(3)); c.vl(x+w-1,y+1,8,Lq(shade)); c.hl(x+1,y+8,w-1,Lq(shade))
    c.rect(x+1,y+1,w-2,7,facebg)
    c.blit(x+1,y+1,figrows,leg)
def pole(c,x,y0,y1,w=2):
    c.rect(x,y0,w,y1-y0+1,Pk(3)); c.vl(x,y0,y1-y0+1,Pk(4)); c.vl(x+w-1,y0,y1-y0+1,Pk(1))
# ---------- ped A
c=C(16,32)
ped_box(c,3,0,STAND,{'R':RED},Lq(1))
ped_box(c,3,9,WALK,{'B':BLU},Lq(1))
c.put(5,10,BLUH); c.put(6,10,BLUH) # 밝은 머리 점 (걷는 사람 위쪽)
c.hl(6,18,4,Pk(2)); pole(c,7,19,29)
c.hl(6,28,4,Pk(3)); c.hl(6,29,4,Pk(1))
c.hl(10,30,5,'~'); c.hl(11,31,4,'-')
finish(c,'ped_signal','A',"강남 신호등 결 그대로: 검은 칠 함 2개(윗면 1줄 밝게·오른쪽 아래 어둡게), 위 빨강 서 있는 사람은 꺼져 어둡고 아래 파랑 걷는 사람만 켜짐, 회색 폴 하나, 발치 그림자 2줄")
# ---------- ped B
c=C(16,32)
def boxB(c,x,y,fig,leg,bg,lit):
    c.rect(x,y,10,10,Lq(2)); c.hl(x,y,10,Lq(5)); c.hl(x,y+1,10,Lq(4)); c.vl(x,y+2,7,Lq(3))
    c.vl(x+9,y+1,9,Lq(0)); c.vl(x+8,y+2,8,Lq(1)); c.hl(x+1,y+9,9,Lq(0))
    c.rect(x+1,y+2,7,7,bg); c.blit(x+1,y+2,fig,leg)
S7=["..RR...","..RR...",".RRRR..",".RRRR..","..RR...",".R..R..",".R..R.."]
W7=["...BB..","..BBB..".ljust(7,'.'),".BBBBB.","..BBB..","..BBB..",".BB.BB.","BB...B."]
boxB(c,3,0,S7,{'R':RED},Lq(1),False)
boxB(c,3,10,W7,{'B':BLU},('kblue',0),True)
c.put(5,12,BLUH); c.put(6,12,BLUH)
# 켜진 쪽 안쪽 빛 테두리
for x in range(4,11): c.put(x,11,('kblue',1))
c.hl(6,20,4,Pk(2)); pole(c,7,21,29)
c.hl(6,28,4,Pk(4)); c.hl(6,29,4,Pk(0)); c.put(9,29,Pk(0))
c.hl(9,30,7,'~'); c.hl(9,31,6,'~'); c.hl(11,31,4,'-')
finish(c,'ped_signal','B',"윗면 2줄 밝게+오른쪽 2px 그늘로 입체, 켜진 파랑 칸은 안쪽 바탕을 진한 남색으로 눌러 사람이 더 빛나 보임, 폴 밑 접지 그림자 2줄+번짐")
# ---------- ped C
c=C(16,32)
def boxC(c,x,y,fig,leg,bg):
    c.rect(x,y,14,10,Lq(1)); c.hl(x+1,y,12,Lq(3)); c.vl(x,y+1,8,Lq(3)); c.vl(x+13,y+1,8,Lq(0)); c.hl(x+1,y+9,12,Lq(0))
    c.rect(x+1,y+1,12,8,bg); c.blit(x+2,y+1,fig,leg)
S6=["..RR..","..RR..",".RRRR.","RRRRRR","..RR..","..RR..",".R..R.","R....R"]
W6=["...BB.","..BBB.",".BBBB.","BBBBBB",".BBB..",".BBBB.","BB..BB","B....B"]
boxC(c,1,0,S6,{'R':RED},Lq(2)); boxC(c,1,10,W6,{'B':BLU},Lq(2))
c.put(5,11,BLUH); c.put(6,11,BLUH); c.put(7,11,BLUH)
c.rect(6,20,4,2,Pk(2)); c.rect(6,22,4,8,Pk(3)); c.vl(6,22,8,Pk(4)); c.vl(9,22,8,Pk(1))
c.hl(5,29,6,Pk(1)); c.hl(9,30,6,'~'); c.hl(10,31,5,'-')
finish(c,'ped_signal','C',"실루엣 재해석: 함을 칸 폭 가득 넓히고 사람을 크게(6×8) 과장, 굵은 폴 4px — 멀리서도 빨강 서기/파랑 걷기가 바로 읽힘")
sheet('ped_signal',12)
