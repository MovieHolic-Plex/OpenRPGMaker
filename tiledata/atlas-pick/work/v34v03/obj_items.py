from lib import *
import random

def top_obj(c,x0,x1,y0,tn,R,o,lit,hi,cr,hi_row=True,crease=None):
    """윗면: y0 뒤 가장자리 선, 이어서 밝은 단, 마지막 줄 앞 하이라이트, 그 밑 접힘선 한 줄. 반환 = 접힘선 다음 y"""
    c.hl(x0+1,y0,x1-x0-1,(R,o))
    for y in range(y0+1,y0+tn):
        c.hl(x0,y,x1-x0+1,(R,hi if (hi_row and y==y0+tn-1) else lit))
    c.px(x0,y0,(R,o)) if False else None
    c.vl(x0,y0+1,tn-1,(R,o)) if False else None
    c.hl(x0,y0+tn,x1-x0+1,cr if isinstance(cr,tuple) else (R,cr))
    return y0+tn+1

def basketball_hoop():
    c=C(32,48)
    # 뒤판
    y=top_obj(c,1,22,0,5,'mwhite',0,4,5,('mred',0)); c.hl(2,0,20,('mred',1))
    c.rect(1,6,22,10,('mwhite',3)); c.vl(1,6,10,('mred',3)); c.vl(22,6,10,('mred',2)); c.hl(1,15,22,('mred',2))
    c.hl(1,6,22,('mwhite',2))
    c.rect(7,9,10,5,('mred',3)); c.rect(8,10,8,3,('mwhite',3)); c.hl(7,9,10,('mred',4))
    # 림 + 그물
    c.hl(8,16,8,('morange',2)); c.hl(7,17,10,('morange',3)); c.hl(8,18,8,('morange',1))
    for i,yy in enumerate(range(19,26)):
        w=8-i//2*2 if 8-i//2*2>=4 else 4; x=8+(8-w)//2
        for k in range(w): c.px(x+k,yy,('mwhite',3 if (k+i)%2==0 else 1))
    # 팔 + 기둥
    c.hl(22,8,3,('mmetal',3)); c.hl(22,9,3,('mmetal',2))
    c.hl(24,5,4,('mmetal',6)); 
    for y in range(6,40):
        c.px(24,y,('mmetal',5)); c.px(25,y,('mmetal',4)); c.px(26,y,('mmetal',3)); c.px(27,y,('mmetal',2))
    # 물탱크 받침
    c.hl(3,36,25,('mblue',1))
    for y in range(37,42): c.hl(2,y,27,('mblue',5 if y==41 else 4))
    c.hl(2,42,27,('mblue',0))
    c.rect(2,43,27,3,('mblue',3)); c.vl(2,43,3,('mblue',4)); c.vl(28,43,3,('mblue',2)); c.hl(2,45,27,('mblue',2))
    c.rect(4,38,5,2,('mblue',5)) if False else None
    for y in range(28,40): c.px(24,y,('mmetal',5)); c.px(25,y,('mmetal',4)); c.px(26,y,('mmetal',3)); c.px(27,y,('mmetal',2))
    c.hl(23,40,6,('mmetal',1))
    c.rect(4,44,3,2,('mmetal',1)); c.rect(23,44,3,2,('mmetal',1)); c.px(5,44,('mmetal',3)); c.px(24,44,('mmetal',3))
    c.shadow(2,30)
    return c,'농구대 3/4 — 흰 뒤판(윗면 밝게, 붉은 테두리·조준 네모), 주황 림과 그물, 굵은 쇠기둥, 윗면이 보이는 파란 물탱크 받침'

def broadcast_desk():
    c=C(48,32)
    for x0 in (2,36):
        c.rect(x0,0,10,8,('vblack',1)); c.hl(x0+1,0,8,('vblack',5)); c.rect(x0+1,1,8,6,('mdglass',3)); c.hl(x0+1,1,8,('mdglass',5)); c.px(x0+2,3,('mdglass',7)); c.px(x0+3,4,('mdglass',6))
        c.hl(x0+3,8,4,('vblack',2)); c.hl(x0+4,9,2,('vblack',2))
    R='locker'
    c.hl(1,10,46,(R,3))
    for y in range(11,22): c.hl(0,y,48,(R,5 if y<21 else 6))
    c.hl(1,10,46,(R,3)); c.hl(0,11,48,(R,6))
    c.hl(0,22,48,(R,0))
    c.rect(0,23,48,7,(R,3)); c.hl(0,23,48,(R,4)); c.hl(0,29,48,(R,1)); c.vl(0,23,7,(R,4)); c.vl(47,23,7,(R,2))
    # 믹서
    c.rect(8,13,26,7,('vblack',2)); c.hl(8,13,26,('vblack',4)); c.hl(8,19,26,('vblack',1))
    for i in range(8):
        x=10+i*3; c.vl(x,14,5,('vblack',0)); c.px(x,15+(i*3)%4,('vwhite',5)); 
    for x in (30,32): c.px(x,14,('vred',4)); 
    c.px(31,17,('vgreen',4))
    # 마이크·헤드폰
    c.vl(38,13,5,('mmetal',5)); c.hl(38,12,3,('mmetal',5)); c.px(41,13,('vblack',3)); c.px(41,14,('vblack',3))
    c.rect(3,15,5,4,('mmetal',3)); c.rect(4,16,3,2,(R,5))
    # 서랍 앞면
    for x0 in (3,17,31): c.rect(x0,25,13,3,(R,2)); c.hl(x0,25,13,(R,4)); c.hl(x0+5,26,3,(R,5))
    c.rect(2,27,2,3,(R,1)) if False else None
    c.shadow(2,47)
    return c,'방송 책상 3/4 — 회청색 상판(믹서 슬라이더·헤드폰·고개 숙인 마이크)이 밝은 윗면으로 보이고, 앞면에 서랍, 뒤에 모니터 둘'

def easel():
    c=C(16,32)
    W='vwood'
    y=top_obj(c,3,12,0,5,W,2,6,7,(W,0)); c.hl(4,0,8,(W,2))
    # 캔버스 앞면
    c.rect(3,6,10,13,(W,4)); c.vl(3,6,13,(W,5)); c.vl(12,6,13,(W,2))
    c.rect(4,7,8,10,('vblue',5)); c.rect(4,12,8,5,('vgreen',3)); c.hl(4,12,8,('vgreen',4)); c.rect(5,9,3,2,('vwhite',5)); c.px(9,8,('vyellow',5))
    c.hl(4,10,2,('vwhite',3))
    c.hl(3,18,10,(W,3)); c.hl(2,19,12,(W,6)); c.hl(2,20,12,(W,2))   # 받침대(턱)
    # 다리
    for k,(a,b) in enumerate([(3,2),(7,7),(12,13)]):
        for y in range(21,30): 
            xx=a+(b-a)*(y-21)//8 
            c.px(xx,y,(W,4)); c.px(xx+1,y,(W,2))
    c.hl(6,22,4,(W,4)) if False else None
    c.shadow(1,15)
    return c,'이젤 3/4 — 나무 틀 윗면이 밝게 보이고, 하늘·풀밭 그림이 든 캔버스 앞면, 받침턱과 세 다리'

def genkan_step():
    c=C(32,16); R='hinoki'
    c.hl(1,0,30,(R,1))
    for y in range(1,8): c.hl(0,y,32,(R,5))
    for y in (3,6): c.hl(0,y,32,(R,4))
    for x in (9,20): c.vl(x,1,2,(R,4)); c.vl(x+8,4,2,(R,4))
    c.hl(0,8,32,(R,6)); c.hl(0,9,32,(R,0))
    c.rect(0,10,32,4,(R,3)); c.hl(0,10,32,(R,4)); c.hl(0,13,32,(R,1)); c.vl(0,10,4,(R,4)); c.vl(31,10,4,(R,2))
    c.shadow(1,31)
    return c,'현관 단 3/4 — 삼나무 판 윗면이 넓게 밝고 널 이음 선, 앞 모서리 하이라이트 밑에 낮은 앞면'

def lectern():
    c=C(32,32); W='vwood'
    top_obj(c,1,30,0,10,W,2,6,7,(W,0)); c.hl(2,0,28,(W,2))
    c.rect(8,3,16,5,('washi',4)); c.hl(8,3,16,('washi',5)); c.hl(9,5,10,('washi',3)); c.hl(9,7,7,('washi',3)); c.hl(8,8,16,('washi',2))
    c.hl(1,9,30,(W,7))
    c.rect(1,11,30,18,(W,4)); c.hl(1,11,30,(W,5)); c.vl(1,11,18,(W,5)); c.vl(30,11,18,(W,3)); c.hl(1,28,30,(W,2))
    c.rect(4,14,24,11,(W,3)); c.hl(4,14,24,(W,2)); c.vl(4,14,11,(W,2)); c.hl(4,24,24,(W,5)); c.vl(27,14,11,(W,5))
    c.rect(14,18,4,3,('vbrass',4)); c.hl(14,18,4,('vbrass',5)); c.hl(14,20,4,('vbrass',2))
    c.hl(1,29,30,(W,1)) if False else None
    c.shadow(1,31)
    return c,'교탁 3/4 — 밤색 나무 윗면에 종이 한 장, 앞 모서리 하이라이트, 안쪽이 들어간 앞 판과 놋 손잡이'

def meal_tray():
    c=C(16,16); R='tray'
    c.hl(2,1,12,(R,1))
    c.hl(2,2,12,(R,5))
    for y in range(3,10): c.hl(1,y,14,(R,4 if y<9 else 5))
    c.hl(1,9,14,(R,5))
    # 그릇
    c.rect(2,2,5,5,('mwhite',3)); c.rect(3,3,3,3,('vwhite',6)); c.hl(3,2,3,('mwhite',5)); c.hl(2,6,5,('mwhite',1))
    c.rect(9,2,5,4,('mred',3)); c.rect(10,3,3,2,('mred',4)); c.hl(9,5,5,('mred',1)); c.hl(9,2,5,('mred',5))
    c.rect(4,7,4,2,('myellow',3)); c.hl(4,7,4,('myellow',4)); c.px(10,7,('mgreen',4)); c.px(11,7,('mgreen',3)); c.px(11,8,('mgreen',3))
    c.hl(1,10,14,(R,0))
    c.rect(1,11,14,3,(R,2)); c.hl(1,11,14,(R,3)); c.hl(1,13,14,(R,1))
    c.shadow(1,15)
    return c,'급식 쟁반 3/4 — 회색 쟁반 윗면에 밥·국·반찬 그릇, 앞 모서리 밑에 낮은 쟁반 옆면'

def music_stand():
    c=C(16,16); B='vblack'
    c.hl(2,0,12,(B,2))
    for y in range(1,6): c.hl(1,y,14,('washi',5 if y<5 else 4))
    c.vl(1,1,5,('washi',3)); c.vl(14,1,5,('washi',3))
    for x,yy in ((4,2),(7,3),(10,2),(12,4),(5,4)): c.px(x,yy,(B,1))
    c.hl(3,3,3,(B,3)) if False else None
    c.hl(1,6,14,(B,0))
    c.rect(1,7,14,2,(B,3)); c.hl(1,7,14,(B,4)); c.hl(1,8,14,(B,2))
    c.vl(7,9,4,(B,3)); c.vl(8,9,4,(B,2))
    c.hl(2,13,5,(B,3)); c.hl(9,13,5,(B,2)); c.hl(6,12,4,(B,4))
    c.shadow(1,15)
    return c,'보면대 3/4 — 위에서 비스듬히 보이는 악보 판(밝은 윗면, 음표 점), 검은 받침턱 앞면, 가는 기둥과 세 발'

def nurse_bed():
    c=C(16,32); 
    c.hl(2,0,12,('mmetal',2)); c.rect(1,1,14,14,('vwhite',5)); c.vl(1,1,14,('vwhite',4)); c.vl(14,1,14,('vwhite',3))
    c.rect(3,2,10,5,('vwhite',6)); c.hl(3,6,10,('vwhite',4)); c.vl(3,2,5,('vwhite',5)); c.vl(12,2,5,('vwhite',4))
    c.hl(1,9,14,('vwhite',4)) if False else None
    c.hl(1,14,14,('vwhite',3))
    for y in range(15,21): c.hl(1,y,14,('mpurple',3 if y>15 else 5))
    c.vl(1,15,6,('mpurple',4)); c.vl(14,15,6,('mpurple',2)); c.hl(1,20,14,('mpurple',2))
    c.hl(1,21,14,('mmetal',1))
    c.rect(1,22,14,3,('vwhite',3)); c.hl(1,22,14,('vwhite',4)); c.hl(1,24,14,('vwhite',1)); c.vl(1,22,3,('vwhite',4)); c.vl(14,22,3,('vwhite',2))
    for x in (1,13): c.rect(x,25,2,5,('mmetal',3)); c.vl(x,25,5,('mmetal',5)); c.hl(x,29,2,('mmetal',1))
    c.hl(3,26,10,('mmetal',3)) if False else None
    c.shadow(1,15)
    return c,'보건실 침대 3/4 — 흰 시트·베개 윗면이 길게 보이고 발치는 보라 담요, 앞에 매트리스 옆면과 쇠 다리'

def plaster_bust():
    c=C(16,32)
    # 흉상: 머리 + 어깨 (흰)
    c.hl(5,1,6,('mwhite',3)); c.hl(4,2,8,('mwhite',4)); 
    for y in range(3,8): c.hl(4,y,8,('mwhite',3 if y>3 else 4))
    c.px(4,3,('mwhite',3)); c.hl(5,7,6,('mwhite',2))
    c.vl(11,3,5,('mwhite',1)); c.vl(10,4,3,('mwhite',2)); c.px(5,4,('mwhite',1)); c.px(9,4,('mwhite',1)); c.px(6,6,('mwhite',1)); c.px(8,6,('mwhite',1))
    c.hl(6,8,4,('mwhite',2)); c.hl(6,9,4,('mwhite',1)); 
    c.hl(3,10,10,('mwhite',3)); c.hl(2,11,12,('mwhite',3)); c.hl(2,12,12,('mwhite',2)); c.hl(2,13,12,('mwhite',1))
    c.vl(2,11,3,('mwhite',4)) 
    # 받침 (윗면 + 접힘 + 앞면)
    c.hl(3,14,10,('vstone',2))
    for y in range(15,21): c.hl(2,y,12,('vstone',6 if y==20 else 5))
    c.hl(2,21,12,('vstone',0))
    c.rect(2,22,12,8,('vstone',3)); c.vl(2,22,8,('vstone',4)); c.vl(13,22,8,('vstone',2)); c.hl(2,22,12,('vstone',4)); c.hl(2,29,12,('vstone',1))
    c.rect(4,25,8,3,('vstone',2)); c.hl(4,25,8,('vstone',1))
    # 흉상 아랫부분을 윗면 위에 서게: 어깨 밑을 윗면에 겹침
    c.hl(4,14,8,('mwhite',1)); c.hl(4,15,8,('vstone',3))
    c.shadow(1,15)
    return c,'석고 흉상 3/4 — 흰 흉상이 회색 받침 윗면 위에 서 있고, 앞 모서리 밑에 받침 앞면'

def privacy_screen():
    c=C(32,32); R='locker'
    top_obj(c,1,30,0,5,R,2,5,6,(R,0))
    c.hl(2,0,28,(R,2))
    for i in range(3):
        x0=1+i*10
        c.rect(x0,6,10,20,('mwhite',3)); c.vl(x0,6,20,(R,4)); c.vl(x0+9,6,20,(R,2))
        c.rect(x0+6,7,3,18,('mwhite',2)); c.hl(x0+1,6,8,('mwhite',5)); c.hl(x0+1,7,8,('mwhite',4))
    for i in range(3): 
        x0=1+i*10
        c.hl(x0,26,10,(R,4)); c.hl(x0,27,10,(R,2))
    for x in (2,10,20,28): c.vl(x,28,2,(R,1))
    c.hl(1,26,30,(R,4)); c.hl(1,27,30,(R,2))
    c.shadow(1,31)
    return c,'칸막이 3/4 — 회색 틀 윗면이 밝게 보이고, 접힌 세 폭의 흰 천 앞면, 아래 틀과 짧은 발'

def roof_fence():
    c=C(16,32); R='fence'
    top_obj(c,1,14,0,5,R,1,4,5,(R,0)); c.hl(2,0,12,(R,1))
    c.rect(1,6,14,23,(R,2))
    for y in range(6,29):
        for x in range(2,14):
            if (x+y)%4==0: c.px(x,y,(R,4))
            elif (x+y)%4==2 and (y%2==0): c.px(x,y,(R,1))
    c.vl(1,6,23,(R,4)); c.vl(2,6,23,(R,3)); c.vl(14,6,23,(R,1)); c.vl(13,6,23,(R,2))
    c.hl(1,28,14,(R,3)); c.hl(1,29,14,(R,1))
    c.hl(1,6,14,(R,3))
    c.shadow(1,15)
    return c,'옥상 철망 3/4 — 초록 철망 틀 윗면이 밝게 보이고, 마름모 그물 앞면, 양옆 기둥과 아래 틀'

def skeleton_model():
    c=C(16,32); B='vlinen'
    # 두개골
    c.hl(5,0,6,(B,4)); c.hl(4,1,8,(B,6)); c.rect(4,2,8,4,(B,5)); c.hl(5,6,6,(B,4)); c.hl(6,7,4,(B,3))
    c.rect(5,3,2,2,('vblack',2)); c.rect(9,3,2,2,('vblack',2)); c.px(8,5,('vblack',3)); c.vl(11,2,4,(B,3))
    c.hl(6,8,4,(B,4)); c.hl(6,9,4,(B,2)) if False else None
    # 척추·갈비뼈
    c.vl(8,8,10,(B,3)); c.vl(7,8,10,(B,5))
    for y in (10,12,14,16):
        c.hl(4,y,3,(B,5)); c.hl(9,y,3,(B,4)); c.px(4,y+1,(B,3)); c.px(11,y+1,(B,2))
    # 팔
    c.vl(3,10,10,(B,4)); c.vl(12,10,10,(B,3)); c.px(3,20,(B,5)); c.px(12,20,(B,3))
    # 골반·다리
    c.hl(5,18,6,(B,4)); c.hl(5,19,6,(B,3)); c.vl(6,20,4,(B,5)); c.vl(9,20,4,(B,4)); c.px(5,23,(B,5)); c.px(10,23,(B,4))
    # 받침판
    c.hl(3,23,10,('vstone',2))
    c.rect(2,24,12,2,('vstone',5)); c.hl(2,25,12,('vstone',6)) 
    c.hl(2,26,12,('vstone',0))
    c.rect(2,27,12,3,('vstone',3)); c.vl(2,27,3,('vstone',4)); c.vl(13,27,3,('vstone',2)); c.hl(2,29,12,('vstone',1))
    c.shadow(1,15)
    return c,'해골 표본 3/4 — 뼈색 골격이 회색 받침판 윗면 위에 서 있고, 앞 모서리 밑에 판 앞면'

ALL=dict(basketball_hoop=basketball_hoop,broadcast_desk=broadcast_desk,easel=easel,genkan_step=genkan_step,lectern=lectern,meal_tray=meal_tray,music_stand=music_stand,nurse_bed=nurse_bed,plaster_bust=plaster_bust,privacy_screen=privacy_screen,roof_fence=roof_fence,skeleton_model=skeleton_model)
if __name__=='__main__':
    import sys
    for k in sys.argv[1:]:
        c,n=ALL[k](); c.save(k,n)
