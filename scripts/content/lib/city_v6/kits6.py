# 버들항 v5 kits: the royal castle and the noble estate as multi-piece, walkable kits in the city's pixel style.
# Every piece: image + footprint (cells) + role rows ('W' walkable, '#' blocked, 'D' door, 'S' stair, 'G' gate passage,
# 'B' bridge deck, '~' overlay only). The city (city6.py) places the pieces; this module also records each placement
# into KIT[...]['answer'] so the assembly can be replayed (metadata answer arrays).
import sys, os, math, random; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import palette
from px2 import C, PAL, _hash
import pz, pv, ph, ph2, pj, roman, terrain
from roman import ST, TRV, TC, WDr, mul, mix, _put, tex_flag, ramp
PIECES={}          # id -> dict(name_ko, name_en, kit, desc, cells, roles)
def piece(pid,name_ko,name_en,kit,desc,cells,roles):
    PIECES[pid]=dict(id=pid,name_ko=name_ko,name_en=name_en,kit=kit,desc=desc,cells=cells,roles=roles)

# ================= castle =================
def wall_h(n,slits=True,seed=0):
    # curtain wall seen from the front and above: walk (flagstones, walkable) with a crenellated parapet on the outer
    # (front) edge, then the outer face (ashlar, arrow slits, a battered plinth). 3 rows: walk + 2 face rows.
    W=n*16; H=48; im=Image.new('RGBA',(W,H)); px=im.load()
    for y in range(H):
        for x in range(W):
            if y<2: c=ST[5] if y==0 else ST[3]
            elif y<10: c=tex_flag(x,y,seed=11)
            elif y<16:
                m=(x%10)<6
                if m: c=ST[6] if y==10 else (ST[5] if y==11 else (ST[4] if (x%10)<4 else ST[3]))
                else: c=mul(tex_flag(x,y,seed=11),0.8) if y<13 else (ST[5] if y==13 else ST[3])
            elif y==16: c=ST[2]
            elif y<44:
                row=(y-17)//6; off=8 if row%2 else 0
                c=ST[4] if (y-17)%6!=5 and (x+off)%16!=0 else ST[2]
                if c==ST[4] and _hash((x+off)//16,row,seed)<0.22: c=ST[3]
            else: c=ST[3] if y<46 else ST[2]
            px[x,y]=c+(255,)
    if slits:
        for k in range(n):
            if k%3==1:
                for y in range(24,33): px[k*16+7,y]=ST[1]+(255,); px[k*16+8,y]=ST[1]+(255,)
                px[k*16+6,28]=ST[1]+(255,); px[k*16+9,28]=ST[1]+(255,)
    return pz.fin(im)
piece('castle.wall_h','성벽 (가로, 성벽길)','curtain wall (E-W, wall-walk)','castle','위 1줄은 걸을 수 있는 성벽길(판석, 바깥쪽 여장), 아래 2줄은 바깥 벽면(화살 구멍, 기단).',('n',3),['W'*1,'#','#'])
def wall_v(n,outer='E',seed=0):
    # a N-S curtain wall: its walk seen from above (flagstones), merlons along the outer side, a lip on the inner side
    W=16; H=n*16; im=Image.new('RGBA',(W,H)); px=im.load()
    for y in range(H):
        for x in range(W):
            xo=x if outer=='E' else 15-x
            if xo<2: c=ST[5] if xo==0 else ST[3]
            elif xo<11: c=tex_flag(x,y,seed=12)
            else:
                m=(y%10)<6
                c=(ST[6] if xo==11 else ST[5] if xo<14 else ST[3]) if m else (ST[3] if xo<14 else ST[2])
            px[x,y]=c+(255,)
    return pz.fin(im)
piece('castle.wall_v','성벽 (세로, 성벽길)','curtain wall (N-S, wall-walk)','castle','위에서 본 성벽길. 바깥쪽에 여장(톱니), 안쪽에 낮은 턱. 전체가 걸을 수 있다.',(1,'n'),['W'])
def tower_sq(wc=2,banner=None,seed=0):
    # a square tower: crenellated roof platform (2 rows seen from above) over a 3-row ashlar face with a window
    W=wc*16; top=24; H=top+48; im=Image.new('RGBA',(W,H)); px=im.load()
    for y in range(H):
        for x in range(W):
            if y<top:
                ring=min(x,W-1-x,y,top-1-y)
                if ring<3:
                    m=((x if y<3 or y>=top-3 else y)%8)<5
                    c=(ST[6] if ring==0 else ST[5]) if m else ST[3]
                    if y>=top-3 and m: c=ST[4] if ring>0 else ST[5]
                else: c=tex_flag(x,y,seed=13)
            elif y==top: c=ST[2]
            else:
                row=(y-top-1)//6; off=8 if row%2 else 0
                c=ST[4] if (y-top-1)%6!=5 and (x+off)%16!=0 else ST[2]
                if x<3: c=mix(c,ST[5],0.4)
                if x>=W-3: c=mul(c,0.8)
                if y>=H-3: c=ST[2]
            px[x,y]=c+(255,)
    cx=W//2
    for y in range(top+12,top+24):
        for x in range(cx-2,cx+2): px[x,y]=(ST[1] if y>top+13 else ST[5])+(255,)
    im=pz.fin(im)
    if banner: im.alpha_composite(roman.banner_hanging(banner,24),(cx-6,top+27))
    return im
piece('castle.tower_sq','네모 탑 (여장 지붕)','square tower (crenellated)','castle','여장이 두른 평지붕(위에서 본 2줄)과 벽면 3줄. 창과 걸개 깃발. 막힘.',(2,5),['##','##','##','##','##'])
def tower_round(wc=3):
    return pz.fin(pv.round_tower('sto',wc,3,3)) if False else pv.round_tower('sto',wc,3,3)
piece('castle.tower_round','둥근 탑 (원뿔 지붕)','round tower (conical roof)','castle','석조 원통 몸체 + 청회색 슬레이트 원뿔 지붕. 모퉁이용. 막힘.',(3,'~6'),['###'])
def gatehouse(seed=0):
    # 4 cells: two flanking tower blocks with crenellated tops rising 8 px above the walk, the arched gate between
    # them (passage in shadow, walkable), the portcullis hanging half raised in the arch, banners on both towers.
    W=64; P=8; H=P+48; im=Image.new('RGBA',(W,H)); px=im.load()
    for y in range(H):
        for x in range(W):
            tw=x<16 or x>=48
            yy=y-P
            if yy<0:
                if not tw: continue
                ring=min(x%48 if x>=48 else x, 15-(x-48) if x>=48 else 15-x)
                m=(x%8)<5; c=(ST[6] if y==0 else ST[5]) if m else ST[3]
                if y>=4: c=ST[4] if x%16<12 else ST[3]
                px[x,y]=c+(255,); continue
            if yy<16:
                if tw:
                    c=tex_flag(x,yy,seed=14) if 2<=x%16<14 and yy<12 else (ST[5] if x%16<2 else ST[3])
                    if yy>=12: c=ST[4] if x%16<12 else ST[3]
                else:
                    if yy<2: c=ST[5] if yy==0 else ST[3]
                    elif yy<10: c=tex_flag(x,yy,seed=14)
                    else:
                        m=(x%10)<6
                        c=(ST[6] if yy==10 else ST[4]) if m else (ST[3])
                px[x,y]=c+(255,); continue
            if yy==16: px[x,y]=ST[2]+(255,); continue
            row=(yy-17)//6; off=8 if row%2 else 0
            c=ST[4] if (yy-17)%6!=5 and (x+off)%16!=0 else ST[2]
            if tw and (x%16<2): c=mix(c,ST[5],0.4)
            if tw and (x%16>=14): c=mul(c,0.82)
            # the gate arch
            dx=(x+0.5-32)/12.0; dy=(30-(yy+0.5))/10.0
            inside=abs(dx)<1 and (yy>=30 or dx*dx+dy*dy<1)
            ring=abs(dx)<1.3 and not inside and (yy>=30 and abs(dx)<1.3 or (yy<30 and dx*dx/1.69+dy*dy/1.5<1))
            if inside:
                k=0.25+0.35*min(1,(yy-18)/28)
                c=mul(tex_flag(x,yy,seed=15),k) if yy>=40 else mul(ST[2],0.6+0.2*(yy-18)/22)
            elif ring and 18<=yy<48: c=ST[5] if x<32 else ST[4]
            if yy>=45 and not inside: c=ST[2]
            px[x,y]=c+(255,)
    pc=roman.portcullis()
    for yy in range(0,10):                                         # portcullis teeth hanging in the arch top
        for xx in range(0,24):
            X,Y=20+xx,P+22+yy
            dx=(X+0.5-32)/12.0; dy=(30-(Y-P+0.5))/10.0
            if abs(dx)<1 and (Y-P>=30 or dx*dx+dy*dy<1):
                p=pc.getpixel((xx%28,yy))
                if p[3]: px[X,Y]=p
    im=pz.fin(im)
    im.alpha_composite(roman.banner_hanging('red',22),(2,P+19)); im.alpha_composite(roman.banner_hanging('red',22),(50,P+19))
    return im
piece('castle.gatehouse','성문루 (내린 쇠창살 반쯤)','gatehouse (portcullis half raised)','castle','양옆 탑 블록(여장 머리) + 가운데 아치 성문. 창살은 반쯤 올라가 있어 통행 가능. 가운데 2칸은 통로(G), 위 1줄은 성벽길.',(4,3),['#WW#','#GG#','#GG#'])
def drawbridge(rows=2):
    # a lowered drawbridge over the moat: E-W planks (the travel is N-S), edge beams, iron straps, chains rising to the
    # gatehouse face above
    W=32; P=14; H=P+rows*16; im=Image.new('RGBA',(W,H)); px=im.load(); I=ramp('iron')
    for y in range(P,H):
        for x in range(W):
            yy=y-P
            if x<3 or x>=W-3: c=WDr[2] if x in (0,W-1) else (WDr[4] if x<3 else WDr[3])
            else:
                c=WDr[5] if yy%4 else WDr[2]
                if yy%4==1 and x%11==0: c=WDr[3]
                if x in (6,W-7): c=I[3]
            px[x,y]=c+(255,)
    for side in (0,1):                                             # chains
        x0=1 if side==0 else W-2
        for k in range(P+10):
            y=H-4-int(k*1.6); x=x0+(int(k*0.25) if side==0 else -int(k*0.25))
            if 0<=y<H: px[x,y]=(I[4] if k%2 else I[2])+(255,)
    return pz.fin(im)
piece('castle.drawbridge','도개교 (내려짐)','drawbridge (lowered)','castle','해자 위에 내린 도개교. 판자는 동서로 놓여 남북으로 걷는다. 양옆 사슬이 성문루로 올라간다.',(2,2),['BB','BB'])
def wall_stair(up='R'):
    # a stone flight rising along the inner side of the curtain wall onto its walk (side view like the chipset):
    # light treads, dark risers, a dark stringer underneath so it reads against the flagstones
    W=32; H=32; im=Image.new('RGBA',(W,H)); px=im.load(); n=6
    for i in range(n):
        x0=i*5 if up=='R' else W-(i+1)*5-1; yt=H-5-(i+1)*4
        for y in range(yt,H-1):
            for x in range(x0,x0+6):
                if y<yt+2: c=ST[6] if y==yt else ST[5]
                elif y<yt+4: c=ST[3]
                else: c=ST[2] if y<H-2 else ST[1]
                _put(px,W,H,x,y,c)
    return pz.fin(im)
piece('castle.wall_stair','성벽 오르는 돌계단','wall stair','castle','안마당에서 성벽길로 오르는 돌계단(옆에서 본 계단). 2칸, 계단(S).',(2,1),['SS'])
def palace(seed=3):
    h=ph2.house('sto',11,2,seed=seed,chim=True,door=5)
    im=h['im'].copy()
    for bx in (1,3,7,9):                                           # banners between the upper windows
        im.alpha_composite(roman.banner_hanging('red' if bx in (3,7) else 'shroom',26),(bx*16+18,h['above']+44+2))
    return dict(h,im=im)
piece('castle.palace','왕궁 본관 (좌우대칭 2층)','royal palace (symmetric, 2 storeys)','castle','11칸 석조 2층, 문이 정가운데. 급경사 모임지붕(슬레이트). 창 사이에 왕실 걸개. 문 앞이 큰 계단 축.',(11,7),['#'*11]*6+['#####D#####'])
def chapel():
    SR=__import__('pj_demo').storeyrows; RR=__import__('pj_demo').roofrows; L=pj.library()
    tower=[' '.join(f'sto.spire.{j}{i}' for i in range(3)) for j in range(4)]+SR('sto','ldr','plain','base')
    nave=RR('sto',3,None,3)+SR('sto','lar','eave','base'); nave=['. '*3]*(len(tower)-len(nave))+nave
    return pj.assemble([a+' '+b for a,b in zip(tower,nave)],L)
piece('castle.chapel','성 예배당','castle chapel','castle','첨탑 3칸 + 신랑 3칸, 첨두창. 문은 탑 아래.',(6,6),['#'*6]*5+['#D####'])
piece('castle.barracks','병영','barracks','castle','석조 7칸 단층 긴 집. 문 1.',(7,5),['#'*7])
piece('castle.smithy','성 대장간','castle smithy','castle','석조 5칸, 굴뚝에서 짙은 연기. 모루·화덕 소품과 함께.',(5,5),['#'*5])
piece('castle.stable','마구간','stable','castle','반목조 마구간, 반문 사이로 말 머리가 내다본다. 건초·여물통과 함께.',(6,5),['#'*6])

# ================= estate =================
def manor_center(wc=7,seed=5):
    # 3-storey symmetric range with a lower steep roof (so the facade dominates), door in the middle
    import pv as _pv
    r=random.Random(seed); d=wc//2
    k,up,_=ph2.kinds_for(wc,'sto',False,r,door=d)
    W=wc*16; Rh=34; roof=ph2.steep_hip('sto',W,Rh)
    body=_pv.stack((_pv.walls('sto',up,1,'sto','eave'),0),(_pv.walls('sto',up,1,'sto','plain'),0),(_pv.walls('sto',k,1,'sto','plain'),0))
    pad=16; im=Image.new('RGBA',(W,pad+Rh+body.height)); im.alpha_composite(roof,(0,pad)); im.alpha_composite(body,(0,pad+Rh))
    im=ph2.volume(im,pad+Rh)
    ch=[ph2.chimney(im,16,pad-12+int(Rh*0.25),'sto'),ph2.chimney(im,W-32,pad-12+int(Rh*0.25),'sto')]
    im=roman.terracotta(im,seed,top=pad+Rh+2)
    return dict(im=im,door=d,chim=ch,below=0,above=pad)
def manor_wing(wc=3,seed=6):
    W=wc*16; Rh=34; import pv as _pv
    kinds='l'+'w'*(wc-2)+'r'
    body=_pv.stack((_pv.walls('sto',kinds,1,'sto','eave'),0),(_pv.walls('sto',kinds,1,'sto','plain'),0))
    roof=ph2.steep_hip('sto',W,Rh)
    im=Image.new('RGBA',(W,Rh+body.height)); im.alpha_composite(roof,(0,0)); im.alpha_composite(body,(0,Rh)); im=ph2.volume(im,Rh)
    return dict(im=roman.terracotta(im,seed,top=Rh+2),door=None,chim=[],below=0,above=0)
def manor(seed=5):
    # wings + centre + portico, one image; returns the door column
    c=manor_center(7,seed); wl=manor_wing(3,seed+1); wr=manor_wing(3,seed+2)
    W=13*16; H=c['im'].height+8; im=Image.new('RGBA',(W,H))
    base=c['im'].height
    im.alpha_composite(wl['im'],(0,base-wl['im'].height)); im.alpha_composite(wr['im'],(W-48,base-wr['im'].height))
    im.alpha_composite(c['im'],(48,0))
    po=roman.portico(5); po=roman.door_cut(po,32,34,16,22)
    im.alpha_composite(pz.fin(po),(48+16,base-56))
    chim=[(x+48,y) for x,y in c['chim']]
    return dict(im=pz.fin(im),door=6,chim=chim,below=8,above=c['above'])
piece('estate.manor','귀족 저택 (3층 중앙 + 2층 양 날개 + 주랑 현관)','manor house (3-storey centre, 2-storey wings, portico)','estate','좌우 대칭 13칸: 날개 3칸(2층) + 중앙 7칸(3층, 테라코타 모임지붕, 굴뚝 둘) + 박공·기둥 4개 주랑 현관과 계단. 문은 정가운데.',(13,8),['#'*13]*7+['######D######'])
def gate_lodge(seed=7):
    h=ph2.house('sto',3,1,seed=seed,chim=True,door=1)
    return dict(h,im=roman.terracotta(h['im'],seed,top=h['above']+46))
piece('estate.lodge','문지기 집','gate lodge','estate','정문 옆 3칸 작은 석조 집. 문이 가운데.',(3,5),['###','###','###','###','#D#'])
piece('estate.gate','정문 (돌기둥 + 철문, 열림)','estate gate (piers + iron gate, open)','estate','항아리 얹은 돌기둥 둘 사이 2칸. 철문 두 짝은 기둥 쪽으로 열려 통행 가능.',(4,1),['#GG#'])
piece('estate.wall','저택 담 (낮은 돌담)','estate wall (low stone)','estate','낮은 돌담. 막힘.',('n',1),['#'])
piece('estate.garden','정형 정원 (산울타리 화단·자갈길·분수·석상·원뿔 정원수)','formal garden','estate','자갈길(걷기) 축과 십자길, 산울타리로 두른 화단 넷, 가운데 물고기 연못 분수, 석상 둘, 화분 원뿔 정원수.',('n','n'),['W'])
piece('estate.kitchen','텃밭 + 허수아비','kitchen garden','estate','채소 밭고랑과 허수아비. 막힘.',(4,3),['####'])
piece('estate.service','일꾼 마당 (장작·통·빨래·우물)','service yard','estate','장작더미·술통·빨래줄·우물. 사이사이 걷기.',('n','n'),['W'])
piece('estate.carriage','마차','carriage','estate','닫힌 마차(옆모습), 금테와 마차등.',(4,3),['####'])
