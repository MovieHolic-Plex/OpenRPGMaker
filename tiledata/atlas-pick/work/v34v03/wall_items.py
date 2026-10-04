from wall import *

def cleaning_locker():
    c=C(16,32); R='locker'
    tall(c,1,13,1,29,R,2,5,6,1,3)
    # 문 + 통풍 살
    c.rect(3,9,9,19,(R,3)); c.vl(3,9,19,(R,4)); c.vl(11,9,19,(R,2)); c.hl(3,9,9,(R,4)); c.hl(3,27,9,(R,2))
    for y in (11,13,15,17):
        c.hl(4,y,7,(R,1)); c.hl(4,y+1,7,(R,4))
    c.rect(9,21,2,4,(R,5)); c.vl(9,21,4,(R,6)); c.hl(9,25,2,(R,2))     # 손잡이
    c.hl(4,20,4,(R,4)); c.hl(4,21,4,(R,2))                              # 이름표 자리
    c.shadow(2,16)
    return c,'청소도구함 3/4 — 회청색 키 큰 함 윗면 밝게, 처마 그림자 아래로 들어간 문, 통풍 살 넷·손잡이'

def copier():
    c=C(16,32); R='mwhite'
    # 복사기: 윗면 = 원고 덮개(밝은 흰), 앞면 = 조작부 + 급지 서랍 둘
    tall(c,1,14,4,29,R,0,3,5,0,2,edge=3,dark=1)
    # 조작 패널 (어두운 창 + 버튼)
    c.rect(3,12,10,5,('mdglass',1)); c.hl(3,12,10,('mdglass',0)); c.px(4,13,('mdglass',5)); c.px(5,14,('mdglass',5))
    c.px(10,14,('mgreen',5)); c.px(11,14,('mred',3)); c.px(12,14,('myellow',4))
    # 서랍 둘
    for y0 in (19,24):
        c.rect(3,y0,10,4,('mmetal',5)); c.hl(3,y0,10,('mmetal',6)); c.hl(3,y0+3,10,('mmetal',3)); c.hl(6,y0+1,4,('mmetal',2))
    c.hl(2,18,12,('mmetal',3)); c.hl(2,23,12,('mmetal',3)); c.hl(2,28,12,('mmetal',2))
    c.shadow(2,16)
    return c,'복사기 3/4 — 흰 몸통 윗면(덮개) 밝게, 어두운 조작창과 회색 급지 서랍 둘'

def dorm_closet():
    c=C(16,32); R='vwood'
    tall(c,1,14,1,29,R,2,6,7,1,4,edge=5,dark=3)
    # 두 짝 문 + 판넬
    c.vl(7,8,21,(R,2)); c.vl(8,8,21,(R,5))
    for x0 in (3,9):
        c.rect(x0,10,4,7,(R,3)); c.hl(x0,10,4,(R,2)); c.vl(x0,10,7,(R,2))
        c.rect(x0,19,4,8,(R,3)); c.hl(x0,19,4,(R,2)); c.vl(x0,19,8,(R,2))
    c.px(6,17,('vbrass',5)); c.px(9,17,('vbrass',5)); c.px(6,18,('vbrass',3)); c.px(9,18,('vbrass',3))
    c.hl(1,28,14,(R,2))
    c.shadow(2,16)
    return c,'기숙사 옷장 3/4 — 밤색 나무 옷장, 밝은 윗면과 처마 그림자, 두 짝 문에 놋 손잡이'

def lab_cabinet():
    c=C(32,32); R='cream'
    tall(c,1,30,0,29,R,1,4,5,1,3,edge=4,dark=2)
    # 유리 상단장 (두 칸) + 병
    for x0 in (3,17):
        c.rect(x0,8,12,11,('vglass',1)); c.hl(x0,8,12,('vglass',0)); c.vl(x0,8,11,('vglass',0))
        c.hl(x0,13,12,(R,4)); c.hl(x0,14,12,(R,2))                      # 선반
        for i,(rm,st) in enumerate([('vred',4),('vgreen',4),('vblue',4)]):
            bx=x0+1+i*4
            c.rect(bx,10,2,3,(rm,st)); c.px(bx,9,(rm,2))
        for i,(rm,st) in enumerate([('vblue',4),('vyellow',4),('vred',4)]):
            bx=x0+2+i*3
            c.rect(bx,15,2,3,(rm,st)); c.px(bx,14,(rm,2))
        c.px(x0+10,9,('vglass',5)); c.px(x0+10,10,('vglass',4))
    # 하단 문
    for x0 in (3,17):
        c.rect(x0,20,12,8,(R,3)); c.hl(x0,20,12,(R,2)); c.vl(x0,20,8,(R,4)); c.vl(x0+11,20,8,(R,2)); c.hl(x0,27,12,(R,2))
    c.px(13,23,(R,1)); c.px(14,23,(R,1)); c.px(17,23,(R,1)); c.px(18,23,(R,1))
    c.hl(2,19,28,(R,2))
    c.rect(3,29,2,1,(R,1)); c.rect(26,29,3,1,(R,1))
    c.shadow(2,32)
    return c,'약품장 3/4 — 크림색 장, 밝은 윗면, 들어간 유리 상단 두 칸에 병, 아래 두 짝 문'

def library_shelf():
    c=C(32,32); R='vpine'
    tall(c,1,30,0,29,'vdwood',1,5,6,0,3,edge=4,dark=2)
    # 뒷판 어둡게
    c.rect(3,8,26,20,('vdwood',1))
    books=[('vred',3),('vblue',3),('vgreen',3),('vyellow',3),('vwhite',3),('vred',4),('vblue',4),('vgreen',4)]
    import random; rnd=random.Random(5)
    for by in (8,15,22):
        x=3
        while x<28:
            w=rnd.choice([2,2,3,3]); h=rnd.choice([4,5,5,6]); rm,st=rnd.choice(books)
            if x+w>29: break
            c.rect(x,by+6-h,w,h,(rm,st)); c.vl(x,by+6-h,h,(rm,st+1)); c.px(x+w-1,by+6-h,(rm,st-2)) if st>2 else None
            x+=w
        c.hl(3,by+6,26,('vdwood',4)); c.hl(3,by+7,26,('vdwood',2)) if by<22 else None
    c.vl(2,8,20,('vdwood',4)); c.vl(29,8,20,('vdwood',2))
    c.shadow(2,32)
    return c,'서가 3/4 — 밤색 책장, 밝은 나무 윗면과 처마 그림자, 어두운 안쪽에 세 단 책'

def locker_row():
    c=C(32,32); R='locker'
    tall(c,1,30,0,29,R,2,5,6,1,3)
    for i in range(4):
        x0=2+i*7
        c.rect(x0,8,6,10,(R,3)); c.vl(x0,8,10,(R,4)); c.vl(x0+5,8,10,(R,2)); c.hl(x0,8,6,(R,4))
        c.rect(x0,19,6,9,(R,3)); c.vl(x0,19,9,(R,4)); c.vl(x0+5,19,9,(R,2)); c.hl(x0,19,6,(R,4))
        for y in (10,12): c.hl(x0+1,y,4,(R,1))
        c.px(x0+4,15,(R,6)); c.px(x0+4,16,(R,5))
        c.px(x0+4,23,(R,6)); c.px(x0+4,24,(R,5))
        c.hl(x0,18,6,(R,1))
        if i<3: c.vl(x0+6,8,20,(R,1))
    c.px(9,22,('vred',4)); c.px(23,11,('vblue',4))
    c.shadow(2,32)
    return c,'사물함 줄 3/4 — 회청색 네 칸 두 단, 밝은 윗면과 처마 그림자, 문마다 통풍 살·손잡이'

def vending_school():
    c=C(16,32); R='mwhite'
    tall(c,1,14,1,29,R,0,3,5,0,2,edge=3,dark=1)
    # 파란 간판
    c.rect(3,9,10,3,('mblue',3)); c.hl(3,9,10,('mblue',4)); c.hl(3,11,10,('mblue',2)); c.px(5,10,('mwhite',5)); c.px(6,10,('mwhite',5)); c.px(9,10,('mwhite',4))
    # 유리 진열
    c.rect(3,13,10,10,('vglass',1)); c.hl(3,13,10,('vglass',0)); c.vl(3,13,10,('vglass',0))
    for y in (17,21): c.hl(3,y,10,('mmetal',3))
    for y,cols in ((14,[('vred',4),('vblue',4),('vgreen',4),('vyellow',4)]),(18,[('vblue',4),('vred',4),('vwhite',4),('vgreen',4)])):
        for i,(rm,st) in enumerate(cols): c.rect(4+i*2+ (i//1)*0,y,2,3,(rm,st)) if False else c.rect(4+i*2,y,2,3,(rm,st))
    for i,(rm,st) in enumerate([('vred',4),('vyellow',4),('vblue',4),('vgreen',4)]): c.rect(4+i*2,22-0,2,0,(rm,st))
    c.px(11,14,('vglass',5)); c.px(11,15,('vglass',4)); c.px(12,14,('vglass',4))
    # 버튼열 + 배출구
    c.vl(12,14,8,('mmetal',3)) if False else None
    c.rect(3,24,10,4,('mmetal',2)); c.hl(3,24,10,('mmetal',1)); c.hl(5,26,6,('mmetal',0)); c.hl(5,25,6,('mdglass',1))
    c.px(11,25,('mred',3))
    c.shadow(2,16)
    return c,'학교 자판기 3/4 — 흰 몸통 밝은 윗면, 파란 간판, 유리 진열에 음료 두 단, 아래 배출구'

def shoe_locker():
    c=C(32,32); R='hinoki'
    tall(c,1,30,0,29,R,2,5,6,1,3,edge=4,dark=2)
    # 신발 칸 4x3
    shoes=[[('vwhite',5),('vblue',4),('vwhite',5),('vred',4)],[('vgreen',4),('vwhite',5),('vred',4),('vblue',4)],[('vred',4),('vblue',4),('vgreen',4),('vwhite',5)]]
    for r in range(3):
        y0=8+r*7
        for i in range(4):
            x0=3+i*7
            c.rect(x0,y0,6,6,(R,0)); c.hl(x0,y0,6,('vdwood',0)); c.hl(x0+1,y0+1,5,(R,1))
            rm,st=shoes[r][i]
            c.hl(x0+1,y0+3,4,(rm,st)); c.hl(x0+1,y0+4,4,(rm,st-1)); c.px(x0+1,y0+2,(rm,st-1)); c.px(x0+2,y0+2,(rm,st-1))
        c.hl(2,y0+6,27,(R,4)) if r<2 else None
    c.vl(2,8,20,(R,4)); c.vl(29,8,20,(R,2))
    for i in range(1,4): c.vl(3+i*7-1,8,20,(R,3))
    c.shadow(2,32)
    return c,'신발장 3/4 — 밝은 나무 신발장, 윗면과 처마 그림자, 4×3 칸에 신발'

def height_scale():
    c=C(16,32); R='wboard'
    tall(c,4,11,0,25,R,1,3,4,0,2,edge=3,dark=1)
    # 눈금: 왼쪽 열에 1px 줄, 5번째마다 긴 줄, 오른쪽에 검은 홈
    for i,y in enumerate(range(8,25,2)):
        c.hl(5,y,4 if i%2==0 else 2,('locker',1))
    c.vl(10,8,17,('locker',2))
    # 누름판: 윗면(밝게) + 앞면(어둡게), 기둥을 감싸는 가로 판
    c.hl(2,12,12,('mmetal',3)); c.hl(2,13,12,('mmetal',7)); c.hl(2,14,12,('mmetal',6)); c.hl(2,15,12,('mmetal',3)); c.hl(2,16,12,('mmetal',1)); c.hl(3,17,10,('mmetal',0))
    c.px(2,13,('mmetal',5)); c.px(13,13,('mmetal',5)); c.px(6,15,('mred',4)); c.px(7,15,('mred',4))
    # 발판: 윗면이 보이게
    c.hl(2,25,12,('locker',2)); c.hl(1,26,14,('locker',6)); c.hl(1,27,14,('locker',5)); c.hl(1,28,14,('locker',3)); c.hl(1,29,14,('locker',1))
    c.shadow(2,16)
    return c,'신장계 3/4 — 흰 눈금 기둥(긴 줄·짧은 줄) 윗면과 처마, 윗면이 밝게 보이는 은색 누름판, 윗면이 보이는 발판'

ALL=dict(cleaning_locker=cleaning_locker,copier=copier,dorm_closet=dorm_closet,lab_cabinet=lab_cabinet,library_shelf=library_shelf,
         locker_row=locker_row,vending_school=vending_school,shoe_locker=shoe_locker,height_scale=height_scale)
if __name__=='__main__':
    for k in sys.argv[1:]:
        c,n=ALL[k](); print(c.save(k,n))
