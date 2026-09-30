import sys; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='hosp_bed'
T=lambda t:('tin',t); SH=lambda t:('sheet',t); RU=lambda t:('rust',t); BL=lambda t:('blood',t); V=lambda t:('void',t)

def frame(c, rust=True):
    # 머리판 (y10..18), 기둥 x1,x14
    for y in range(10,19):
        c.px(1,y,T(5)); c.px(2,y,T(3)); c.px(13,y,T(3)); c.px(14,y,T(1))
    c.hl(1,2,10,T(6)); c.hl(13,14,10,T(3)); c.px(1,10,T(6))
    c.hl(2,13,12,T(5)); c.hl(2,13,13,T(2))       # 윗 가로 파이프
    c.hl(2,13,17,T(4)); c.hl(2,13,18,T(1))       # 아랫 가로
    for x in (4,7,10):                            # 세로 살
        c.vl(x,14,16,T(4)); c.px(x+1,14,T(2)); c.px(x+1,15,T(2)); c.px(x+1,16,T(2))
    # 옆 레일
    for y in range(19,44):
        c.px(1,y,T(4)); c.px(14,y,T(1)); c.px(0,y,None)
    # 발판
    for y in range(41,46):
        c.px(1,y,T(5) if y==41 else T(4)); c.px(2,y,T(3)); c.px(13,y,T(2)); c.px(14,y,T(1))
    c.hl(1,14,41,T(5)); c.hl(1,14,42,T(3)); c.hl(1,14,43,T(1)) if False else None
    c.hl(2,13,44,T(2)); c.hl(2,13,45,T(1))
    # 바퀴
    for x in (1,13):
        c.rect(x,45,x+1,47,T(1)); c.px(x,46,T(3)); c.px(x,45,T(2))
    if rust:
        for (x,y) in [(2,11),(13,12),(4,17),(13,42),(1,30),(14,26),(3,43),(1,20)]:
            c.px(x,y,RU(3))
        for (x,y) in [(2,12),(1,32),(14,35),(12,17)]: c.px(x,y,RU(4))

def pillow(c,y0=19, dirty=True):
    for y in range(y0,y0+5):
        for x in range(3,13):
            c.px(x,y,SH(5) if y in (y0,y0+1) else SH(4))
    c.hl(3,12,y0+4,SH(2)); c.vl(12,y0,y0+4,SH(3)); c.px(3,y0,SH(6)); c.hl(4,8,y0,SH(6))
    c.px(3,y0+4,SH(1)); c.px(12,y0+4,SH(1)); c.px(12,y0,SH(3)) 
    c.px(11,y0+2,SH(3)); c.px(10,y0+3,SH(2)) 
    # 누렇게: 침 자국
    if dirty: c.px(6,y0+2,SH(3)); c.px(7,y0+2,SH(3)); c.px(7,y0+3,SH(2))

def blanket(c, y0=24, y1=40, fold=3):
    for y in range(y0,y1+1):
        for x in range(2,14):
            t=SH(4)
            if y==y0: t=SH(6)
            elif y==y0+1: t=SH(5)
            elif x==2: t=SH(5)
            elif x==13: t=SH(2)
            c.px(x,y,t)
    c.hl(2,13,y1,SH(1))
    # 접힌 선 (젖힌 시트 접힘)
    c.hl(3,12,y0+4,SH(3)); c.hl(3,12,y0+5,SH(5))
    # 주름
    for (x0,y,l) in [(4,y0+8,3),(8,y0+10,4),(3,y0+13,4),(9,y1-2,3)]:
        c.hl(x0,x0+l-1,y,SH(3)); c.hl(x0+1,x0+l,y+1,SH(5)) if y+1<y1 else None

def stain(c,cx,cy,big=1):
    pts=[(0,0),(1,0),(-1,0),(0,1),(1,1),(0,-1),(-1,1)] if big else [(0,0),(1,0),(0,1)]
    for (dx,dy) in pts: c.px(cx+dx,cy+dy,BL(2))
    c.px(cx,cy,BL(1)); c.px(cx+1,cy,BL(2)) 
    for (dx,dy) in [(-2,0),(2,1),(0,2),(-1,-1)]: 
        c.px(cx+dx,cy+dy,'$')
    c.px(cx-1,cy,BL(3)) if big else None

# A
c=C(16,48); blanket(c); pillow(c); frame(c); stain(c,8,32,0)
# 머리쪽 시트 가장자리(누런)
c.save(S,'h2-A','A: v5 병상과 같은 발자국·시점(위 10px 비움). 회색 tin 쇠 파이프 머리판·발판에 rust 점, 누렇게 바랜 sheet 시트에 접힌 선과 주름, 가운데 blood 얼룩 작게, 베개 하나(침 자국), 발끝 바퀴 둘.'); run(S,'h2-A')
# B: 명암 강화
c=C(16,48); blanket(c); pillow(c); frame(c); stain(c,8,31,1)
for y in range(19,44):
    if c.get(13,y) and not isinstance(c.get(13,y),str): pass
    c.px(12,y,c.get(12,y)) 
for y in range(24,41):
    g=c.get(12,y)
    if g and g[0]=='sheet': c.px(12,y,SH(max(1,g[1]-2)))
for x in range(3,12):
    g=c.get(x,40)
    if g and g[0]=='sheet': c.px(x,40,SH(1))
c.hl(2,13,25,SH(6)); c.hl(3,12,29,SH(2)); c.hl(3,12,30,SH(6))
for x in range(2,14): c.px(x,19,'-')  if c.get(x,19) is None else None
c.save(S,'h2-B','B: A 와 같은 형태에 시트 오른쪽·아랫단을 두 단 낮춰 접힌 주름 그림자를 깊게, 접힘 위쪽에 최고광, 얼룩을 조금 키우고 blood 가장자리 번짐($)을 둠. 머리판·발판 쇠 색 폭을 넓혀 어두운 방에서도 틀이 읽힘.'); run(S,'h2-B')
# C: 실루엣 — 시트 밑 사람 모양 볼륨, 시트가 흘러내리고 창백한 손이 레일 밖으로
c=C(16,48)
blanket(c,y0=24,y1=40)
# 몸 볼륨: 머리·어깨·발 융기
for y in range(24,41):
    for x in range(2,14):
        g=c.get(x,y)
        if not g or g[0]!='sheet': continue
        # 몸통 폭: 좌우 안쪽에 그림자 골, 가운데 융기
        if 25<=y<=27 and 5<=x<=10: c.px(x,y,SH(5))   # 머리(베개 아래 시트 덮임)
for y in range(28,38):
    for x in range(5,11):
        c.px(x,y,SH(5) if x<=6 else (SH(4) if x<=8 else SH(2)))
c.hl(5,10,28,SH(6)); c.vl(4,29,38,SH(2)); c.vl(11,29,38,SH(1))
for y in (38,39): c.hl(5,10,y,SH(3)); 
c.hl(4,11,39,SH(2)); c.hl(4,11,40,SH(1))
# 발끝 두 융기
c.rect(5,39,6,40,SH(5)); c.rect(9,39,10,40,SH(4))
pillow(c,y0=19,dirty=True)
frame(c)
# 얼룩이 가슴에서 번짐
stain(c,7,31,1); c.px(8,32,BL(1)); c.px(8,33,'$'); c.px(6,33,'$')
# 흘러내린 시트 자락과 손
for y in range(30,36):
    c.px(14,y,SH(3)); c.px(15,y,SH(2) if y%2 else SH(1))
c.px(14,29,SH(5))
for y in range(36,41): c.px(15,y,('bisque',5) if y<39 else ('bisque',3)); c.px(14,y,('bisque',6) if y<39 else ('bisque',4))
c.px(15,41,('bisque',2)); c.px(14,41,('bisque',3))
# 손가락
c.px(15,42,('bisque',3)); c.px(14,42,('bisque',2))
c.save(S,'h2-C','C: 시트 밑에 사람 모양 볼륨(가슴 융기·두 발끝)을 만들고 가슴에 blood 얼룩과 번짐을 얹었다. 시트 자락이 오른쪽 레일 밖으로 흘러내리고 그 밑으로 창백한 bisque 손이 늘어진다. 실루엣이 빈 침대에서 벗어난다.'); run(S,'h2-C')
