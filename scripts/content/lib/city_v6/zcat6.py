import sys; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
import palette; palette.apply()
import pz, pe, pl, pv, ph2, roman, kits6, smoke5, terrain
from zcat4 import onground, sheet, lawn, cob, F, F2
import numpy as np
def ong(im,g=None,pad=8): return onground(im,pad,g)
trv=Image.new('RGBA',(16,16)); p=trv.load()
for y in range(16):
    for x in range(16): p[x,y]=roman.tex_travertine(x+3,y+5)+(255,)
def bridge_card():
    wt=pz.chip(16,80,16,16); b=roman.bridge_grand(4); W=b['W']+32; H=150
    ctx=Image.new('RGBA',(W,H))
    for x in range(0,W,16):
        for y in range(0,H,16): ctx.paste(wt if 28<=x<W-28 else lawn,(x,y))
    x0=16; y0=40-b['P']
    for y in (40,56):
        for x in list(range(0,28,16))+list(range(W-28,W,16)): ctx.paste(cob,(x,y))
    p=ctx.load()
    for X,Y,k in b['shade']:
        xx,yy=x0+X,y0+Y
        if 0<=xx<W and 0<=yy<H: r,g,bb,a=p[xx,yy]; p[xx,yy]=(int(r*k),int(g*k),int(bb*k),a)
    ctx.alpha_composite(b['back'],(x0,y0)); ctx.alpha_composite(b['front'],(x0,y0)); return ctx
def props():
    wm=roman.windmill_body(); wm.alpha_composite(roman.windmill_sails(2))
    L=[('큰 돌다리 (아치·난간·물가름돌·가로등·석상)',bridge_card(),'4칸 강을 가로질러 · 상판 2줄 걷기'),
       ('받침돌 위 토가 석상',ong(roman.statue_plinth(0)),'2×4 · 광장·정원'),('받침돌 위 석상 (두루마리)',ong(roman.statue_plinth(1,3)),'2×4'),
       ('사이프러스 (3칸)',ong(roman.cypress(3,0)),'1×3 · 길가·담 안쪽'),('사이프러스 (2칸)',ong(roman.cypress(2,1)),'1×2'),
       ('우산소나무',ong(roman.umbrella_pine(0)),'4×5 · 공원·언덕'),('화분 원뿔 정원수',ong(roman.topiary(0)),'1×2 · 정원·테라스'),
       ('주랑 (스토아) 5칸',ong(roman.stoa(5)),'5×4 · 맨 아랫줄 걷기'),('신전 정면',ong(roman.temple_front(5)),'5×6 · 문 가운데'),
       ('주랑 현관 (저택용)',ong(pz.fin(roman.portico(5))),'5×4 겹침 · 저택 문 위'),('수도교 (아치 12칸)',ong(roman.aqueduct(12)),'n×4 · 맨 아랫줄만 막힘'),
       ('줄무늬 차양',ong(roman.awning(4)),'가게 1층 겹침층'),('카페 탁자 + 의자 + 잔',ong(roman.cafe_table(0),g=trv),'2×2 · 잔 2개'),
       ('카페 탁자 (잔 하나·꽃병)',ong(roman.cafe_table(3),g=trv),'2×2'),('카페 파라솔 탁자',ong(roman.cafe_parasol('leaf',2),g=trv),'3×3'),
       ('카페 파라솔 (빨강)',ong(roman.cafe_parasol('red',4),g=trv),'3×3'),('메뉴판 (이젤 칠판)',ong(roman.menu_board(),g=trv),'1×2'),
       ('테라스 화분 상자',ong(roman.planter_box(2),g=trv),'2×2 / 1×2'),('갈대',ong(roman.reeds(0)),'물가 · 조용한 둑'),
       ('닫힌 마차',ong(roman.carriage()),'4×3 · 마구간 앞'),('마구간 (말 머리)',ong(roman.stable(6)['im']),'6×5 · 문 왼쪽'),
       ('건초 더미',ong(roman.hay_bales()),'2×2'),('정문 돌기둥 + 항아리',ong(roman.gate_pier()),'1×1 (위로 2칸)'),('철문 (열림)',ong(roman.iron_gate(2)),'2칸 통로 겹침'),
       ('걸개 깃발',ong(roman.banner_hanging('red',32)),'벽 겹침층'),('쇠창살',ong(roman.portcullis()),'성문 아치 안'),
       ('풍차 (몸체 + 날개 8장면)',ong(wm),'4×6 · 날개만 돈다'),('카페 걸이 간판',ong(roman_sign()),'벽 겹침층')]
    return L
def roman_sign():
    c=pz.C(20,20,seed=942); c.group(1); c.new()
    for x in range(0,19): c.tone(x,1,'iron',4 if x<10 else 3)
    c.line(1,6,7,2,'iron',3); c.group(2); c.box(4,4,14,1,13,'wood',front=0.55)
    for y in range(5,18): c.tone(4,y,'wood',4); c.tone(17,y,'wood',1)
    for x in range(4,18): c.tone(x,4,'wood',5); c.tone(x,17,'wood',1)
    rows,key=roman.SIGN_CAFE; c.group(3); c.new(); c.lit(rows,8,7,key); return pz.fin(c)
def kit_cards(kit):
    L=[]
    if kit=='castle':
        L=[('성벽 가로 (성벽길 + 여장 + 벽면)',ong(kits6.wall_h(5)),'n×3 · 윗줄 W'),('성벽 세로 (성벽길)',ong(kits6.wall_v(4)),'1×n · 전부 W'),
           ('네모 탑 (여장 지붕)',ong(kits6.tower_sq(2,'red')),'2×5'),('둥근 탑 (원뿔 지붕)',ong(kits6.tower_round(3)),'3×7'),
           ('성문루 (쇠창살 반쯤)',ong(kits6.gatehouse()),'4×3 · 통로 G'),('도개교',ong(kits6.drawbridge(3)),'2×3 · B'),
           ('성벽 오르는 돌계단',ong(kits6.wall_stair()),'2×1 · S'),('왕궁 본관',ong(kits6.palace()['im']),'11×7 · 문 가운데'),
           ('성 예배당',ong(kits6.chapel()),'6×6'),('병영',ong(ph2.house('sto',7,1,seed=5)['im']),'7×5'),('마구간',ong(roman.stable(6,seed=1)['im']),'6×5')]
    else:
        L=[('귀족 저택 (3층 중앙 + 날개 + 주랑 현관)',ong(kits6.manor()['im']),'13×9 · 문 가운데'),('문지기 집',ong(kits6.gate_lodge()['im']),'3×5'),
           ('정문 돌기둥',ong(roman.gate_pier()),'1×1'),('철문 (열림)',ong(roman.iron_gate(2)),'2칸'),('마구간 (작은)',ong(roman.stable(3,seed=4)['im']),'3×5'),
           ('저택 날개 (2층)',ong(kits6.manor_wing(3)['im']),'3×6'),('저택 중앙 (3층)',ong(kits6.manor_center(7)['im']),'7×9')]
    return L
def textures():
    items=[]
    def tile(fn,W=96,H=64):
        im=Image.new('RGBA',(W,H)); p=im.load()
        for y in range(H):
            for x in range(W): p[x,y]=fn(x,y)+(255,)
        return im
    items.append(('포룸 트래버틴 큰 판석',tile(roman.tex_travertine,128,72),'32×24 엇갈림 · 차분한 한 톤'))
    items.append(('분수 둘레 오푸스 섹틸레',tile(lambda x,y: roman.tex_opus(x,y,64,48),128,96),'회색 띠 + 45° 사각'))
    items.append(('신전·성 마당 회색 판석',tile(roman.tex_flag,128,72),'v4 칩셋 광장 타일 대체'))
    items.append(('정원 자갈',tile(roman.tex_gravel,96,48),'저택·성 안뜰'))
    h=ph2.house('sto',5,1,seed=3)['im']; t=roman.terracotta(h,0,top=62)
    both=Image.new('RGBA',(h.width*2+8,h.height)); both.alpha_composite(h,(0,0)); both.alpha_composite(t,(h.width+8,0))
    items.append(('지붕: 청회 슬레이트 → 테라코타',both,'석조 집 지붕만 다시 칠함'))
    return items
def anim_strip():
    rows=[]
    wm=[]
    b=roman.windmill_body()
    for f in range(8):
        im=b.copy(); im.alpha_composite(roman.windmill_sails(f)); wm.append(ong(im,pad=4))
    rows.append(('풍차 날개 8장면 (90° 한 바퀴 = 이음매 없이 반복)',wm))
    for k,ko in (('wisp','가는 실연기'),('puffy','뭉게 연기'),('drift','바람에 눕는 연기'),('dark','대장간·빵집 짙은 연기')):
        rows.append((f'연기: {ko} 12장면',[ong(smoke5.sprite(k,f,1),pad=2) for f in range(12)]))
    wf=[Image.open(f'/tmp/j8city6/anim/water_{f}.png').crop((520,520,640,640)) for f in range(8)]
    base=Image.open('/tmp/j8city6/city6_base.png').crop((520,520,640,640))
    for i in range(8):
        c=base.copy(); c.alpha_composite(wf[i]); wf[i]=c
    rows.append(('강물 8장면 (물살 4px/장면, 반짝임, 둑 거품)',wf))
    S=2; W=max(sum(im.width*S+6 for im in r) for _,r in rows)+10; H=sum(max(im.height for im in r)*S+30 for _,r in rows)+10
    o=Image.new('RGBA',(W,H),(27,28,31,255)); d=ImageDraw.Draw(o); y=5
    for n,r in rows:
        d.text((6,y),n,font=F,fill=(235,235,235)); x=6; hh=max(im.height for im in r)*S
        for im in r: o.paste(im.resize((im.width*S,im.height*S),Image.NEAREST),(x,y+22)); x+=im.width*S+6
        y+=hh+30
    o.save('/tmp/j8city6/z5_anim.png')
if __name__=='__main__':
    sheet('/tmp/j8city6/z5_props.png',props(),S=2)
    sheet('/tmp/j8city6/z5_castle.png',kit_cards('castle'),S=2)
    sheet('/tmp/j8city6/z5_estate.png',kit_cards('estate'),S=2)
    sheet('/tmp/j8city6/z5_tex.png',textures(),S=3)
    anim_strip(); print('ok')
