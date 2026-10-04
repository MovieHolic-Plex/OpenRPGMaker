import sys
C='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror'
sys.path.insert(0, C+'/floor_creaky/work')
from h3_shapes import *
from floor_gen import planks, LEG, clamp, BASE, SEAMS, GRAIN, dust
SLUG='broken_hall_floor'

def blobs(x,y):
    o=0
    if ((x-6)/7)**2+((y-6)/4)**2<1: o+=1          # 니스 벗겨진 자리(밝고 푸석)
    if ((x-24)/6)**2+((y-9)/3)**2<1: o-=1         # 얼룩(어두움)
    if ((x-8)/6)**2+((y-27)/3)**2<1: o+=1
    return o

CRACK=[(5,11),(6,12),(7,12),(8,13),(9,13),(10,14),(11,14),(12,15),(13,15),(14,16),(15,16),(16,16),(17,17),(18,17),(19,18),(20,18),(21,19),(22,19),(23,20),(24,20),(25,21)]
def crack(g, wide=(), hl='5'):
    for x,y in CRACK:
        g.put(x,y,'a')
    for x,y in CRACK:
        if (x,y+1) not in CRACK: g.put(x,y+1,'b')
        if (x,y-1) not in CRACK: g.put(x,y-1,hl)
    for x,y in wide:
        g.put(x,y,'a')
    # 갈라진 가지
    g.pts('a',12,16,12,17,11,18)
    g.pts('b',11,17,10,18)
    g.pts('a',20,19,20,20,19,21)

def paper(g, mid='k', lite='l', dark='i', ink='h'):
    rows={25:(22,26),26:(21,26),27:(21,25),28:(22,25)}
    for y,(a,b) in rows.items():
        for x in range(a,b+1): g.put(x,y,mid)
    for x in range(22,27): g.put(x,25,lite)
    g.put(21,26,lite)
    for x in range(21,26): g.put(x,27,dark)
    for x in range(22,26): g.put(x,28,dark)
    g.pts(ink,23,26,25,26,22,27)
    g.pts('a',27,26,26,27,26,28)  # 종이 아래 그림자 (불투명 어둠)

# ---------- A ----------
a=planks(blobs)
crack(a)
dust(a,[(3,4),(14,8),(26,4),(28,22),(5,20),(17,29),(30,14),(11,0)])
paper(a)
# ---------- B ----------
b=G(32,32)
for i in range(8):
    y0=4*i; base=BASE[i]
    for x in range(32):
        b.put(x,y0,'a')
        for r,d in ((1,+2),(2,0),(3,-2)):
            b.put(x,y0+r,'0123456'[clamp(base+d+blobs(x,y0+r))])
    for sx in SEAMS[i]:
        for r in (1,2,3): b.put(sx,y0+r,'a')
        b.put(sx+1,y0+1,'0123456'[clamp(base+3)])
    for gx,ln in GRAIN[i]:
        for k in range(ln): b.put(gx+k,y0+2,'0123456'[clamp(base-1)],wrap=True)
crack(b,hl='6')
for x,y in CRACK:
    b.put(x+1,y+2,'a')      # 그림자를 한 단 더 길게 (오른쪽 아래)
for x,y in CRACK: b.put(x,y,'a')
dust(b,[(3,4),(26,4),(28,22),(17,29)])
paper(b,mid='j',lite='m',dark='h',ink='g')
# ---------- C ----------
c=planks(blobs)
crack(c)
# 금이 벌어진 곳(x13..18)에서 손가락 셋이 밖으로 짚고 있다
for x in range(12,20):
    for y in (15,16,17): c.put(x,y,'a')
for x in range(12,20): c.put(x,14,'b'); c.put(x,18,'b')
for fx,top in ((13,15),(15,14),(17,15),(19,16)):
    for y in range(top,18):
        c.put(fx,y,'k'); c.put(fx+1,y,'i') if fx<19 else None
    c.put(fx,top,'m'); c.put(fx,top+2,'i')
dust(c,[(3,4),(26,4),(28,22),(5,20)])
paper(c)
notes={
 'A':('낡은 복도 바닥: v5 널마루를 묵힌 것 - 니스 벗겨진 밝은 자리와 어두운 얼룩, 왼위에서 오른아래로 널 여러 장을 가로지르는 금, 종이 쪼가리 한 점, 틈에 먼지', a),
 'B':('빛 대비 강화: 널 윗줄 밝게 아랫줄 어둡게, 금 위쪽 테는 밝고 아래쪽에 그림자를 길게, 종이는 더 희게', b),
 'C':('금 사이로 뼈처럼 창백한 손가락 셋이 바닥 밑에서 짚고 올라온다 + 종이 쪼가리', c),
}
finish(SLUG, notes, LEG)
