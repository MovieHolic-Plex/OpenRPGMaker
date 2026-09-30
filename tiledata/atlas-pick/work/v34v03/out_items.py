from lib import *
import sys

def assembly_podium():
    c=C(48,32)
    # 난간 (뒤 가장자리 위): 기둥 + 가로대, 가운데 마이크 스탠드
    for x in range(4,44,8): c.vl(x,2,7,('mmetal',3))
    c.hl(4,2,37,('mmetal',5)); c.hl(4,5,37,('mmetal',4))
    c.vl(24,0,8,('vblack',3)); c.hl(23,0,3,('vblack',4)); c.hl(22,8,5,('mmetal',3)) if False else None
    # 윗면
    c.hl(2,9,44,('mconc',2))
    for y in range(10,16): c.hl(1,y,46,('mconc',5))
    for x in range(8,46,12): c.vl(x,10,6,('mconc',4))
    c.hl(1,16,46,('mconc',6))
    c.px(1,9,('mconc',2)); c.px(46,9,('mconc',2))
    # 앞면
    c.hl(1,17,46,('mconc',1))
    c.rect(1,18,46,6,('mconc',3)); c.vl(1,18,6,('mconc',4)); c.vl(46,18,6,('mconc',2)); c.hl(1,23,46,('mconc',2))
    for x in range(9,46,12): c.vl(x,18,5,('mconc',2))
    # 계단 두 단
    c.hl(7,24,34,('mconc',5)); c.rect(7,25,34,2,('mconc',3)); c.hl(7,26,34,('mconc',2))
    c.hl(11,27,26,('mconc',5)); c.rect(11,28,26,1,('mconc',3)) 
    c.shadow(2,44)
    return c,'조회대 3/4 — 콘크리트 단의 윗면이 넓고 밝게 보이고 앞 모서리 하이라이트, 앞면과 계단 두 단, 뒤쪽에 쇠 난간과 마이크 스탠드'

def wheel(c,cx,cy,r=5):
    import math
    for a in range(0,360,8):
        x=round(cx+r*math.cos(math.radians(a))); y=round(cy+r*math.sin(math.radians(a)))
        c.px(x,y,('vblack',2))
    c.px(cx,cy,('mmetal',5))
    for k in (-r+2,r-2): 
        c.px(cx+k//2*0,cy,('mmetal',3))
def bike(c,x0,body,bstep):
    # 옆모습 자전거: 바퀴 두 개(지름 11), 프레임 삼각, 안장, 핸들
    y=19
    wheel(c,x0+5,y,5); wheel(c,x0+19,y,5)
    B=(body,bstep); L=(body,bstep+1)
    for i in range(0,8): c.px(x0+5+i,y-4+ (i*4)//8,B)     # 아래 파이프
    for i in range(0,10): c.px(x0+11+i,y-4+ (i*0),B) if False else None
    c.hl(x0+7,y-7,9,L)                                     # 윗 파이프
    for i in range(0,7): c.px(x0+7-i//3,y-7+i,B) if False else None
    c.vl(x0+7,y-7,7,B)                                      # 시트 튜브
    for i in range(0,7): c.px(x0+16+ (i>>1),y-7+i,B) if False else None
    for i in range(0,8): c.px(x0+16+(i//4),y-7+i,B) if False else None
    c.px(x0+15,y-6,B); c.px(x0+16,y-5,B); c.px(x0+17,y-3,B); c.px(x0+18,y-1,B)
    c.hl(x0+6,y-8,4,('vblack',3)); c.hl(x0+6,y-9,4,('vblack',5))           # 안장
    c.hl(x0+14,y-9,4,('vblack',4)); c.px(x0+15,y-10,('vblack',4))            # 핸들
    c.rect(x0+18,y-9,3,3,('mmetal',3)); c.hl(x0+18,y-9,3,('mmetal',6))       # 바구니
def bike_rack():
    c=C(48,32)
    # 거치대: 윗면(밝게) + 앞면
    c.hl(1,24,46,('mmetal',2))
    c.rect(1,25,46,3,('mmetal',6)); c.hl(1,27,46,('mmetal',7))
    c.hl(1,28,46,('mmetal',1)); c.rect(1,29,46,1,('mmetal',3))
    for x in range(4,46,10): c.vl(x,29,1,('mmetal',1))
    bike(c,1,'vblue',2)
    bike(c,24,'vred',2)
    # 지붕: 밝은 윗면 + 앞 립 + 두 기둥
    c.vl(13,8,16,('mmetal',3)); c.vl(34,8,16,('mmetal',3))
    c.hl(12,1,24,('mmetal',3))
    for y in range(2,6): c.hl(12,y,24,('mmetal',6))
    c.hl(12,6,24,('mmetal',7)); c.hl(12,7,24,('mmetal',2)); c.hl(12,8,24,('mmetal',4))
    c.shadow(2,46)
    return c,'자전거 거치대 3/4 — 밝은 쇠 지붕 윗면(뒤 가장자리 선·앞 하이라이트) 아래 파란·빨간 자전거 두 대, 쇠 거치대 윗면과 앞면'

def school_gate():
    c=C(64,48)
    def pillar(x0):
        w=10
        # 머리등 (윗면 뒤쪽에 얹힘)
        c.rect(x0+3,0,4,5,('vbrass',4)); c.hl(x0+3,0,4,('vbrass',6)); c.hl(x0+3,4,4,('vbrass',2)); c.px(x0+4,2,('vyellow',6))
        # 기둥 머리 (윗면: 넓고 밝은 돌판)
        c.hl(x0,4,w,('mgran',2))
        for y in range(5,15): c.hl(x0,y,w,('mgran',6))
        c.hl(x0,15,w,('mgran',1))
        c.rect(x0+3,0,4,5,('vbrass',4)); c.hl(x0+3,0,4,('vbrass',6)); c.hl(x0+3,4,4,('vbrass',2)); c.px(x0+4,2,('vyellow',6))
        c.rect(x0+1,16,w-2,22,('mgran',4)); c.vl(x0+1,16,22,('mgran',5)); c.vl(x0+w-2,16,22,('mgran',3))
        for y in (24,31): c.hl(x0+1,y,w-2,('mgran',3))
        # 기둥 밑동
        c.hl(x0,38,w,('mgran',5)); c.rect(x0,39,w,5,('mgran',3)); c.vl(x0,39,5,('mgran',4)); c.vl(x0+w-1,39,5,('mgran',2)); c.hl(x0,43,w,('mgran',1))
    pillar(1); pillar(53)
    # 교명판 (왼 기둥)
    c.rect(3,26,6,5,('vbrass',4)); c.hl(3,26,6,('vbrass',6)); c.hl(4,28,4,('vbrass',2)); c.hl(4,29,4,('vbrass',2)); c.hl(3,30,6,('vbrass',1))
    # 문: 윗 레일 윗면(밝게) + 살 + 아래 레일
    c.hl(11,20,42,('mmetal',3)); c.hl(11,21,42,('mmetal',7)); c.hl(11,22,42,('mmetal',6)); c.hl(11,23,42,('mmetal',2))
    for x in range(12,53,3):
        c.vl(x,24,15,('mmetal',5)); c.vl(x+1,24,15,('mmetal',3))
        c.px(x,19,('mmetal',5))
    c.vl(31,20,20,('mmetal',1)); c.vl(32,20,20,('mmetal',6))
    c.hl(11,39,42,('mmetal',6)); c.hl(11,40,42,('mmetal',3)); c.hl(11,41,42,('mmetal',1))
    # 바닥 레일 홈
    c.hl(11,42,42,('mgran',2))
    c.shadow(1,62)
    return c,'교문 3/4 — 돌기둥 머리 윗면이 밝고 놋 머리등, 교명판, 사이에 윗 레일 윗면이 보이는 쇠 미닫이 문(세로 살)'

def soccer_goal():
    c=C(64,32)
    # 뒤로 처진 그물 지붕 (윗면): 밝은 그물
    c.hl(2,0,60,('vwhite',3))
    for y in range(1,9):
        for x in range(2,62):
            if (x+y)%2==0: c.px(x,y,('vlinen',5 if y>1 else 6))
            elif y%3==0: c.px(x,y,('vlinen',4))
    c.hl(1,9,62,('vwhite',6)); c.hl(1,10,62,('vwhite',5)); c.hl(1,11,62,('vwhite',2))
    # 기둥
    c.rect(0,2,2,27,('vwhite',5)); c.vl(0,2,27,('vwhite',6)); c.rect(62,2,2,27,('vwhite',4)); c.vl(63,2,27,('vwhite',2))
    # 뒷 그물 (앞면: 성긴 격자)
    for y in range(12,27):
        for x in range(2,62):
            if x%4==0 or y%4==0: c.px(x,y,('vlinen',3))
    c.hl(2,26,60,('vlinen',4))
    # 뒤 받침대
    c.rect(0,27,3,2,('vblack',3)); c.rect(61,27,3,2,('vblack',3)); c.hl(3,27,58,('vwhite',2))
    c.shadow(2,62)
    return c,'축구 골대 3/4 — 흰 가로대 밑으로 뒤로 처진 그물 윗면(밝은 격자), 앞에 흰 기둥 둘과 성긴 뒷그물, 바닥 받침'

def bunk_bed():
    c=C(32,48)
    W='vpine'
    # 위 칸 윗면: 이불·베개 (밝게)
    c.hl(3,0,24,(W,1))
    c.rect(3,1,24,5,('vlinen',5)); c.rect(13,1,14,5,('vblue',5)); c.hl(13,1,14,('vblue',6)); c.hl(13,5,14,('vblue',4)); c.rect(4,1,7,4,('vlinen',6)); c.hl(4,5,7,('vlinen',4))
    c.vl(3,1,5,(W,4)); c.vl(26,1,5,(W,2))
    c.hl(3,6,24,(W,0))
    # 위 칸 앞면 (매트리스 옆면 + 틀)
    c.rect(3,7,24,2,('vlinen',3)); c.hl(3,7,24,('vlinen',4)); c.rect(3,9,24,2,(W,3)); c.hl(3,10,24,(W,1))
    # 아래 칸 (앞에서 본 침대)
    c.rect(3,11,24,9,(W,1)); c.hl(3,11,24,(W,0))
    c.rect(4,13,7,4,('vlinen',5)); c.hl(4,13,7,('vlinen',6)); c.rect(11,13,15,5,('sakura',3)); c.hl(11,13,15,('sakura',4)); c.hl(11,17,15,('sakura',2))
    c.hl(4,17,7,('vlinen',3))
    c.rect(3,20,24,2,(W,4)); c.hl(3,20,24,(W,5)); c.hl(3,21,24,(W,2))
    c.rect(3,22,24,2,(W,2)) 
    # 기둥
    for x in (1,24): pass
    for x0 in (1,25):
        c.rect(x0,0,3,44,(W,4)); c.vl(x0,0,44,(W,5)); c.vl(x0+2,0,44,(W,2))
        c.hl(x0,0,3,(W,6)); c.hl(x0,43,3,(W,1))
    # 사다리 (오른쪽)
    c.vl(28,8,32,(W,4)); c.vl(30,8,32,(W,3))
    for y in range(11,40,5): c.hl(28,y,3,(W,6)); c.hl(28,y+1,3,(W,2))
    c.shadow(1,31)
    return c,'이층 침대 3/4 — 위 칸 이불·베개 윗면이 밝게, 매트리스 옆면, 아래 칸 분홍 이불, 굵은 기둥과 옆 사다리'

def water_fountain():
    c=C(32,32)
    # 윗면: 스테인리스 둘레 + 안쪽 물 고임 + 뒤 수도꼭지
    c.hl(2,0,28,('tray',1))
    c.rect(1,1,30,13,('tray',5)); c.vl(1,1,13,('tray',4)); c.vl(30,1,13,('tray',3))
    c.rect(4,5,24,6,('tray',2)); c.hl(4,5,24,('tray',1)); c.rect(5,7,22,3,('mglass',2)); c.hl(6,8,8,('mglass',4)); c.hl(5,10,22,('mglass',1))
    for x in (8,15,22):
        c.rect(x,1,3,2,('mmetal',6)); c.px(x+1,3,('mmetal',3)); c.px(x+2,2,('mmetal',3)); c.px(x+2,3,('mmetal',5))
    c.hl(1,13,30,('tray',5)); c.hl(1,14,30,('tray',5))
    c.hl(1,15,30,('tray',1))
    # 앞면: 캐비닛
    c.rect(1,16,30,12,('tray',3)); c.vl(1,16,12,('tray',4)); c.vl(30,16,12,('tray',2)); c.hl(1,16,30,('tray',4)); c.hl(1,27,30,('tray',1))
    c.rect(4,18,11,7,('tray',2)); c.hl(4,18,11,('tray',1)); c.vl(4,18,7,('tray',1)); c.rect(17,18,11,7,('tray',2)); c.hl(17,18,11,('tray',1)); c.vl(17,18,7,('tray',1))
    c.px(14,21,('mmetal',5)); c.px(17,21,('mmetal',5))
    c.rect(2,28,3,2,('mmetal',2)); c.rect(27,28,3,2,('mmetal',2))
    c.shadow(1,31)
    return c,'복도 세면대 3/4 — 스테인리스 개수대 윗면이 넓고 밝게, 안쪽 물 고임과 수도꼭지 셋, 앞면에 문 둘 달린 캐비닛과 짧은 발'

ALL=dict(assembly_podium=assembly_podium,bike_rack=bike_rack,school_gate=school_gate,soccer_goal=soccer_goal,bunk_bed=bunk_bed,water_fountain=water_fountain)
if __name__=='__main__':
    for k in sys.argv[1:]:
        c,n=ALL[k](); c.save(k,n)
