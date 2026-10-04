# 버들목 — a market village where forest roads meet. Every house is assembled from named blocks (pj); ground from pk;
# trees and bushes are the chipset's own; props sit within 2 cells of their owner.
import sys, os; sys.path.insert(0,'/tmp/j8city')
from PIL import Image
import palette
if os.environ.get('NOPAL')!='1': palette.apply()
import pj, pj_demo, pk, ph, pi, pf, pe, pl, pd
from sheet2 import lawn
L=pj_demo.L; RR=pj_demo.roofrows; SR=pj_demo.storeyrows
W,H=40,30
CHIP=Image.open('/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/atlas-biomes/jungle-chipset.png').convert('RGBA')
TREES={'oakA':(224,512,4,5),'oakB':(288,512,3,4),'bushC':(336,512,2,2),'bushD':(368,512,3,3),'bushE':(368,560,2,2)}
def tree(k): x,y,w,h=TREES[k]; return CHIP.crop((x,y,x+w*16,y+h*16))
I=lambda o: o.img() if hasattr(o,'img') else o

# ---- houses: recipes (grids of block names) ----
REC={
 'inn':   RR('tim',7,3)+SR('tim','lwwpwwr','eave','jetty')+SR('sto','lwpdpwr','plain','base'),   # stone ground + timber upper
 'tower': RR('sto',3,None,3)+SR('sto','lwr','eave','jetty')+SR('sto','lwr','plain','jetty')+SR('sto','ldr','plain','base'),
 'smithy':RR('sto',6,None,2)+SR('sto','ldpwwr','eave','base'),
 'homeA': RR('tim',7,3,2)+SR('tim','lwmdnwr','eave','base'),
 'homeF': RR('tim',6,None,2)+SR('tim','lwwmdr','eave','base'),
}
left=RR('tim',5,2)+SR('tim','lwpwr','eave','jetty')+SR('tim','lmdnr','plain','base')
right=['. . . .']*3+RR('sto',4,None,2)+SR('sto','lwdr','eave','base')
REC['row']=[l+' '+r for l,r in zip(left,right)]
CHIM={'inn':[('tim.chimney',1)],'homeA':[('tim.chimney',5)],'smithy':[('sto.chimney',4)]}
def house_img(k):
    rows=REC[k]; ch=CHIM.get(k,[]); pad=1 if ch else 0
    rows2=(['. '*len(rows[0].split())]*pad)+rows
    ov=[(n+'.top',x,0) for n,x in ch]+[(n+'.bot',x,1) for n,x in ch]
    return pj.assemble(rows2,L,ov),pad

objs=[]   # (image, x, y, footprint_w, footprint_h, solid_rows_from_bottom)
occ=[[None]*W for _ in range(H)]
def place(name,im,x,y,fw=None,fh=None,top_pad=0):
    im=I(im); fw=fw or im.width//16; fh=fh or im.height//16
    for yy in range(y,y+fh-top_pad):
        for xx in range(x,x+fw):
            if 0<=xx<W and 0<=yy<H:
                if occ[yy][xx] and occ[yy][xx]!='plaza' : raise SystemExit(f'overlap {name} with {occ[yy][xx]} at {xx},{yy}')
                occ[yy][xx]=name
    objs.append((im,x,y-top_pad,not name.startswith(('wheat','cabbage','sprout'))))
def put_house(k,x,y):
    im,pad=house_img(k); place(k,im,x,y-pad,top_pad=0) if False else None
    fw=im.width//16; fh=im.height//16-pad
    for yy in range(y,y+fh):
        for xx in range(x,x+fw):
            if occ[yy][xx] and occ[yy][xx]!='plaza': raise SystemExit(f'overlap {k} with {occ[yy][xx]} at {xx},{yy}')
            occ[yy][xx]=k
    objs.append((pj.outlined(im),x-1/16,y-pad-1/16,True))
    return fw,fh

# ---- ground: roads and plaza ----
road=[[False]*W for _ in range(H)]; plaza=[[False]*W for _ in range(H)]
def R(x0,x1,y0,y1,g=road):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): g[y][x]=True
R(19,20,0,11); R(19,20,20,29)                    # north forest road, south road
R(13,26,12,19,plaza)                            # market square
R(0,12,17,18); R(27,39,17,18)                   # west and east streets
R(14,14,10,11); R(24,24,11,11)                  # lanes to inn and tower doors
R(4,4,16,16)                                    # smithy door
R(5,18,24,24); R(5,5,24,24)                     # south-west lane to the homes
R(21,33,27,27)                                  # lane along the row houses
R(33,33,16,16)                                  # pen gate lane
R(27,27,2,16)                                   # farm lane: east street -> fields
R(12,12,24,24)
for y in range(H):
    for x in range(W):
        if road[y][x]: occ[y][x]='road'
        elif plaza[y][x]: occ[y][x]='plaza'

# ---- buildings (plan) ----
put_house('inn',11,3)          # door (14,9)
put_house('tower',23,2)        # door (24,10)
put_house('smithy',3,12)       # door (4,15)
put_house('homeA',2,20)        # door (5,23)
put_house('homeF',10,20)       # door (14,23)
put_house('row',27,20)         # doors (29,26) (33,26)
def P_(name,im,x,y): place(name,im,x,y)
# gate: knight statues flank the forest road
P_('knightW',pf.P['기사 석상'](),17,0); P_('knightE',pf.P['기사 석상'](),21,0)
# inn: sign by the road, barrels at the west wall, notice board at the square corner
P_('innsign',pf.P['상점 간판 (여관)'](),18,8); P_('barrels',pf.P['술통 더미'](),9,8); P_('board',pi.P['마을 게시판'](),11,10)
# tower: banner
P_('banner',pf.P['깃발 기둥'](),26,8)
# smithy: anvil and weapon rack east of the door side, woodpile at the west gable
P_('anvil',pf.P['모루와 그루터기'](),9,15); P_('rack',pf.P['무기 거치대'](),9,13); P_('wood',pi.P['장작더미'](),1,15)
# square
P_('fountain',pf.fountain(int(os.environ.get('FF','0'))),18,14); P_('lampW',pf.P['철제 가로등'](),16,14); P_('lampE',pf.P['철제 가로등'](),22,14)
P_('stallR',ph.stall(3,'red',['apple','cabbage','bread']),13,12); P_('stallB',ph.stall(2,'blue',['fish','fish']),24,12)
P_('stallG',ph.stall(3,'green',['pot','cloth','pot']),23,16); P_('crates',pi.P['상자 더미'](),13,16); P_('sacks',pi.P['곡식 자루'](),15,16)
P_('benchW',pi.P['벤치'](),16,18); P_('benchE',pi.P['벤치'](),21,18)
# homes: well between them, planters are in the walls already
P_('well',pe.P['돌 우물'](),10,25)
# farm NE: fields + scarecrow, fenced pen with haystack and trough
P_('wheat',pi.field('wheat',6,3),28,2); P_('cabbage',pi.field('cabbage',3,3),34,2); P_('sprout',pi.field('sprout',5,3),28,6); P_('cabbage2',pi.field('cabbage',3,3),35,6)
P_('scare',pi.P['허수아비'](),33,6)
pen=ph.run([[ch!='.' for ch in r] for r in ["########","#......#","#......#","#......#","####G###"]],ph.fence_cell,gates={(4,4)})
P_('pen',pen,29,11)
objs.append((I(pi.P['건초더미']()),30,11,True)); objs.append((I(pi.P['여물통']()),33,13,True))
# batch 7 life: each object belongs to someone nearby
P_('signpost',pl.P['이정표'](),12,15)                                   # crossroads by the square
P_('smithsign',pf.P['상점 간판 (무기)'](),11,13)
P_('shrine',pl.P['길가 성소'](),21,3)                                    # travellers' shrine inside the gate
P_('terrace',pl.P['야외 탁자'](),8,5)                                   # inn guests drink outside
P_('fruit',pd.P['과일 바구니'](),16,12)
P_('rainbarrel',pl.P['빗물통'](),16,22); P_('planter',pi.P['꽃 화분 상자'](),9,23)
P_('flowers',pl.P['꽃밭'](),2,24); P_('laundry',pl.P['빨래줄'](),6,26)
P_('pumpkins',pl.P['호박'](),26,1); P_('hives',pl.P['벌통 (짚 벌집)'](),33,9); P_('haycart',pf.P['건초 수레'](),28,9)
P_('henhouse',pl.P['닭장'](),37,15); P_('hens',pl.P['닭 두 마리'](),37,14); P_('hens2',pl.P['닭 두 마리'](),39,16)
P_('rowbarrel',pl.P['빗물통'](),26,23); P_('rowplanter',pi.P['꽃 화분 상자'](),26,25)
P_('rowbed',pl.P['꽃밭'](),23,25); P_('rowtable',pl.P['야외 탁자'](),22,21); P_('rowpump',pl.P['호박'](),25,22)
# ---- trees and bush clumps (chipset) on the leftover lawn, shoulder to shoulder, never in a line ----
def T(k,x,y):
    im=tree(k); fw,fh=im.width//16,im.height//16
    for yy in range(y,y+fh):
        for xx in range(x,x+fw):
            if 0<=xx<W and 0<=yy<H and occ[yy][xx] not in (None,'tree'): raise SystemExit(f'tree {k} over {occ[yy][xx]} at {xx},{yy}')
    for yy in range(y,y+fh):
        for xx in range(x,x+fw):
            if 0<=xx<W and 0<=yy<H: occ[yy][xx]='tree'
    objs.append((im,x,y,True))
for k,x,y in (('oakA',0,0),('oakB',4,0),('bushC',8,1),('oakB',36,20),('oakA',36,24),('bushD',37,9),('bushE',38,12),
              ('oakA',0,25),('oakB',14,25),('bushE',17,27),('oakB',37,0),('bushC',38,4),('bushE',0,5),('oakA',2,4),
              ('bushD',12,0),('bushC',24,0),('bushC',15,0),('bushD',2,9),('bushE',6,10),('bushC',21,24),('bushE',24,28),('bushD',28,28),('bushE',31,28),('bushC',15,28),('bushE',9,28)):
    T(k,x,y)
# ---- render ----
img=Image.new('RGBA',(W*16,H*16))
for x in range(W):
    for y in range(H): img.paste(lawn,(x*16,y*16))
img.alpha_composite(pk.plaza(plaza).img(outline=False)); img.alpha_composite(pk.road(road,joins=plaza).img())
# cast shadows: light from the upper left, so every tall thing throws its silhouette down-right onto the ground
if os.environ.get('NOSHADOW')!='1':
    mask=Image.new('L',img.size,0)
    for im,x,y,cast in objs:
        if not cast: continue
        a=im.split()[3].point(lambda v:255 if v>128 else 0)
        mask.paste(255,(round(x*16)+6,round(y*16)+3),a)
    px=img.load(); mp=mask.load()
    for yy in range(img.height):
        for xx in range(img.width):
            if mp[xx,yy]:
                r,g,b,a=px[xx,yy]; px[xx,yy]=(int(r*0.52),int(g*0.58),int(b*0.74),a)
for im,x,y,cast in sorted(objs,key=lambda o:(round(o[2]*16)+o[0].height)):
    img.alpha_composite(im,(round(x*16),round(y*16)))
import chipsnap
if os.environ.get('SNAP')=='1': img=chipsnap.snap(img)
img.save('/tmp/j8city/village.png')
# ---- emptiness: plain lawn cells (nothing on them) ----
plain=[[occ[y][x] is None for x in range(W)] for y in range(H)]
best=0
for s in range(1,15):
    ok=any(all(plain[yy][xx] for yy in range(y,y+s) for xx in range(x,x+s)) for y in range(H-s+1) for x in range(W-s+1))
    if ok: best=s
worst=max(sum(plain[yy][xx] for yy in range(y,y+13) for xx in range(x,x+17))/(17*13) for y in range(H-12) for x in range(W-16))
print('maxSq',best,'window max',round(worst,2),'plain',sum(map(sum,plain)))
wins=sorted(((sum(plain[yy][xx] for yy in range(y,y+13) for xx in range(x,x+17))/(17*13),x,y) for y in range(H-12) for x in range(W-16)),reverse=True)[:3]
print(wins)
for y in range(H): print(''.join('.' if plain[y][x] else ('=' if occ[y][x]=='road' else ('#' if occ[y][x]=='plaza' else ('T' if occ[y][x]=='tree' else 'o'))) for x in range(W)))
