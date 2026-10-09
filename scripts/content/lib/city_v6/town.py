# 참나무골 — a large walled market town (64×48). Plan:
#   north wall + main gate (x31-32) → main road south through the whole town
#   street A (y13-14): the upper town — two-storey houses and shops above it
#   the canal (y22-23) runs east-west, three bridges; quay lanes on both banks
#   market square (x24-39, y26-33) with fountain and stalls; chapel square to its west
#   street C (y38-39): the lower town; craft quarter (smithy, barn) east; fields and farm south-east
import sys, os, random; sys.path.insert(0,'/tmp/j8city')
from PIL import Image
import palette; palette.apply()
import pj, pk, ph, pi, pf, pe, pl, pd, pn
from pj_demo import roofrows as RR, storeyrows as SR
from sheet2 import lawn
L=pj.library()
W,H=64,48
CHIP=Image.open('/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/atlas-biomes/jungle-chipset.png').convert('RGBA')
TREES={'oakA':(224,512,4,5),'oakB':(288,512,3,4),'bushC':(336,512,2,2),'bushD':(368,512,3,3),'bushE':(368,560,2,2)}
def tree(k): x,y,w,h=TREES[k]; return CHIP.crop((x,y,x+w*16,y+h*16))
I=lambda o: o.img() if hasattr(o,'img') else o
rng=random.Random(7)

# ---------- house generator (obeys the house-form rules: walls ≥3 cells, windows not next to the door) ----------
def house(w,storeys,style,shop=False,seed=0):
    r=random.Random(seed); d=r.randint(2,w-3) if w>=5 else 1
    def ground():
        k=['l']+['p']*(w-2)+['r']; k[d]='d'
        for i in range(1,w-1):
            if i==d: continue
            if abs(i-d)==1: k[i]=('m' if i<d else 'n') if style=='tim' else 'p'
            elif shop and style!='sto': k[i]='s' if (i-d)%2==0 else ('p' if style=='sto' else 'm' if i<d else 'n')
            else: k[i]='w' if (i-d)%2==0 else ('p' if style=='sto' else ('m' if i<d else 'n'))
        return ''.join(k)
    def upper():
        k=['l']+['p']*(w-2)+['r']
        for i in range(1,w-1): k[i]='w' if i%2==1 else ('p' if style=='sto' else 'm' if i<w//2 else 'n')
        return ''.join(k)
    ground_style='sto' if style=='mix' else style
    up_style='tim' if style=='mix' else style
    gab=d if (w>=6 and 1<=d<=w-2 and r.random()<0.6) else None
    if storeys==1:
        rows=RR(up_style if style!='mix' else 'tim',w,gab,2)+SR(ground_style,ground(),'eave','base')
    else:
        rows=RR(up_style,w,gab,3)+SR(up_style,upper(),'eave','jetty')+SR(ground_style,ground(),'plain','base')
    ch=[(f"{'tim' if up_style!='sto' else 'sto'}.chimney",r.choice([c for c in range(1,w-1) if gab is None or abs(c-gab)>1] or [1]))] if r.random()<0.7 else []
    return rows,ch
def assemble_house(rows,ch):
    pad=1 if ch else 0
    rows2=(['. '*len(rows[0].split())]*pad)+rows
    ov=[(n+'.top',x,0) for n,x in ch]+[(n+'.bot',x,1) for n,x in ch]
    return pj.assemble(rows2,L,ov),pad

objs=[]; occ=[[None]*W for _ in range(H)]; HOUSES=[]
def free(x,y,w,h,allow=()):
    return all(0<=xx<W and 0<=yy<H and (occ[yy][xx] is None or occ[yy][xx] in allow) for yy in range(y,y+h) for xx in range(x,x+w))
def mark(name,x,y,w,h):
    for yy in range(y,y+h):
        for xx in range(x,x+w):
            if 0<=xx<W and 0<=yy<H: occ[yy][xx]=name
def put_rows(name,rows,ch,x,ybottom):
    im,pad=assemble_house(rows,ch); fw=im.width//16; fh=im.height//16-pad; y=ybottom-fh+1
    if not free(x,y,fw,fh): raise SystemExit(f'house {name} blocked at {x},{y} {fw}x{fh}')
    mark(name,x,y,fw,fh); objs.append((pj.outlined(im),x-1/16,y-pad-1/16,True)); HOUSES.append((name,x,y,fw,fh)); return fw
def P_(name,o,x,y,allow=('plaza',)):
    im=I(o); fw,fh=im.width//16,im.height//16
    if not free(x,y,fw,fh,allow): raise SystemExit(f'{name} blocked at {x},{y} by '+str({occ[yy][xx] for yy in range(y,y+fh) for xx in range(x,x+fw) if 0<=yy<H and 0<=xx<W}))
    mark(name,x,y,fw,fh); objs.append((im,x,y,True))
def try_P(name,o,x,y,allow=('plaza',)):
    im=I(o); fw,fh=im.width//16,im.height//16
    if free(x,y,fw,fh,allow): mark(name,x,y,fw,fh); objs.append((im,x,y,True)); return True
    return False

# ---------- ground ----------
road=[[False]*W for _ in range(H)]; pave=[[False]*W for _ in range(H)]; plaza=[[False]*W for _ in range(H)]
canal=[[False]*W for _ in range(H)]; wall=[[False]*W for _ in range(H)]
def R(g,x0,x1,y0,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): g[y][x]=True
R(wall,0,63,2,2)                                   # north wall walkway (faces at y3-4)
R(pave,31,32,5,21); R(pave,31,32,24,26); R(pave,31,32,35,39)   # main road (paved) gate → south, through the square
R(road,31,32,40,47)
R(pave,3,60,13,14)                                 # street A
R(road,3,60,20,20)                                 # north quay lane
R(canal,0,63,22,23)
R(road,3,60,25,25)                                 # south quay lane
R(plaza,24,39,27,34)                               # market square
                                                   # chapel garden: fenced, south of street C (see objects)
R(pave,3,60,38,39)                                 # street C
R(road,12,13,15,19); R(road,50,51,15,19)           # side lanes down to the quay
R(road,47,48,26,37)
for g,n in ((road,'road'),(pave,'road'),(plaza,'plaza'),(canal,'canal')):
    for y in range(H):
        for x in range(W):
            if g[y][x]: occ[y][x]=n
for y in range(H):
    for x in range(W):
        if wall[y][x]: occ[y][x]='wall'
        if wall[y-1][x] if y>=1 else False: occ[y][x]='wall'
        if y>=2 and wall[y-2][x]: occ[y][x]='wall'
GATES=[(31,2),(32,2)]
for gx,gy in GATES: occ[gy+1][gx]='road'; occ[gy+2][gx]='road'

# ---------- buildings ----------
# upper town: houses along street A (doors on row 12), 2 storeys, shops near the main road
x=4; k=0
for (w,st,shop) in ((6,'mix',False),(5,'tim',False),(7,'tim',True)):
    rows,ch=house(w,2,st,shop,seed=10+k); x+=put_rows(f'hA{k}',rows,ch,x,12)+1; k+=1
x=37
for (w,st,shop) in ((7,'mix',True),(6,'tim',True),(5,'sto',False)):
    rows,ch=house(w,2,st,shop,seed=20+k); x+=put_rows(f'hA{k}',rows,ch,x,12)+1; k+=1
# between street A and the quay: low houses (doors on row 19)
for (x,w,st) in ((4,5,'tim'),(15,6,'sto'),(22,7,'mix'),(34,6,'tim'),(41,7,'sto'),(54,5,'tim')):
    rows,ch=house(w,1,st,seed=30+k); put_rows(f'hB{k}',rows,ch,x,19); k+=1
# chapel on the chapel square (door row 30 opens onto the square)
tower=[' '.join(f'sto.spire.{j}{i}' for i in range(3)) for j in range(4)]+SR('sto','lbr','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lpr','plain','base')
nave=RR('sto',7,3,3)+SR('sto','lapdpar','eave','base'); nave=['. '*7]*(len(tower)-len(nave))+nave
put_rows('chapel',[a+' '+b for a,b in zip(tower,nave)],[],4,37)
# market square north side: guild hall (3 storeys, stone)
guild=RR('sto',8,None,3)+SR('sto','lwpwwpwr','eave','jetty')+SR('sto','lwpwwpwr','plain','jetty')+SR('sto','lwpddpwr'.replace('dd','sd'),'plain','base')
# lower town: houses along street C (doors row 37)
rows,ch=house(6,2,'tim',True,seed=51); put_rows('hC_shop',rows,ch,16,37)
x=41
for (w,st,shop) in ((6,'mix',True),):
    rows,ch=house(w,2,st,shop,seed=60+k); x+=put_rows(f'hC{k}',rows,ch,x,37)+1; k+=1
# craft quarter east of the square: smithy (stone, 1 storey) + barn (logs)
put_rows('smithy',RR('sto',6,None,2)+SR('sto','ldpwwr','eave','base'),[('sto.chimney',4)],53,37)
put_rows('barn',RR('wod',6,None,3)+SR('wod','lpghpr','eave','base'),[],53,46)
# south of street C, west: small homes (doors row 45)
for (x,w,st) in ((17,5,'tim'),(23,6,'sto')):
    rows,ch=house(w,1,st,seed=70+k); put_rows(f'hD{k}',rows,ch,x,45); k+=1
R(road,16,30,46,46)
for xx in range(16,31): occ[46][xx]='road'
# ---------- infrastructure objects ----------
for bx in (12,30,47):
    P_(f'bridge{bx}',pn.bridge(3,4),bx,21,allow=('canal','road'))
P_('fountain',pf.fountain(int(os.environ.get('FF','0'))),30,29)
P_('lampW',pf.P['철제 가로등'](),28,29); P_('lampE',pf.P['철제 가로등'](),34,29)
P_('stall1',ph.stall(3,'red',['apple','cabbage','bread']),24,27); P_('stall3',ph.stall(3,'green',['pot','cloth','pot']),36,27)
P_('stall2',ph.stall(2,'blue',['fish','fish']),24,30); P_('stall4',ph.stall(3,'red',['bread','apple','bread']),36,30)
P_('crates',pi.P['상자 더미'](),26,33); P_('sacks',pi.P['곡식 자루'](),28,34); P_('fruitb',pd.P['과일 바구니'](),27,27)
P_('bench1',pi.P['벤치'](),29,33); P_('bench2',pi.P['벤치'](),33,33); P_('board',pi.P['마을 게시판'](),37,33)
P_('cart',pf.P['건초 수레'](),53,40,allow=())
P_('knightW',pf.P['기사 석상'](),29,5); P_('knightE',pf.P['기사 석상'](),33,5)
P_('banner1',pf.P['깃발 기둥'](),28,6); P_('banner2',pf.P['깃발 기둥'](),35,6)
gard=ph.run([[ch!='.' for ch in r] for r in ["#####G######","#..........#","#..........#","#..........#","############"]],ph.fence_cell,gates={(5,0)})
objs.append((gard,3,40,False)); mark('garden',3,40,12,1); mark('garden',3,44,12,1)
for yy in range(40,45): mark('garden',3,yy,1,1); mark('garden',14,yy,1,1)
occ[40][8]='road'
P_('shrine',pl.P['길가 성소'](),12,41); P_('chflowers',pl.P['꽃밭'](),4,41); P_('chflowers2',pl.P['꽃밭'](),4,43); P_('chflowers3',pl.P['꽃밭'](),9,41)
P_('chbench',pi.P['벤치'](),9,43); P_('chtable',pl.P['벌통 (짚 벌집)'](),6,42)
P_('well',pe.P['돌 우물'](),19,27,allow=())
P_('signA',pl.P['이정표'](),30,15-0) if free(30,15,1,2) else None
P_('smithanvil',pf.P['모루와 그루터기'](),59,35); P_('smithrack',pf.P['무기 거치대'](),59,33)
P_('hay',pi.P['건초더미'](),59,42); P_('hencoop',pl.P['닭장'](),60,40) if free(60,40,2,2) else None
P_('wheat',pi.field('wheat',6,3),38,42); P_('cab',pi.field('cabbage',4,3),45,42); P_('sprout',pi.field('sprout',4,2),38,45)
P_('scare',pi.P['허수아비'](),44,45)
# bits of life: each house gets one or two things against its side walls (never loose in the lawn)
LIFE=[pl.P['빗물통'],pi.P['꽃 화분 상자'],pl.P['호박'],pi.P['장작더미'],pi.P['나무 상자'],pf.P['술통 더미'],pi.P['곡식 자루'],pl.P['벌통 (짚 벌집)']]
for i,(name,hx,hy,hw,hh) in enumerate(HOUSES):
    if name in ('chapel',): continue
    r=random.Random(100+i); bottom=hy+hh-1
    for side in r.sample(['L','R'],2)[:1+(r.random()<0.5)]:
        f=r.choice(LIFE); im=I(f()); fw,fh=im.width//16,im.height//16
        x=hx-fw if side=='L' else hx+hw
        for y in (bottom-fh+1,bottom-fh):
            if try_P(f'life{i}{side}',im,x,y,allow=()): break
# small fenced kitchen gardens beside some lower-town houses
for (gx,gy,gw,gh,kind) in ((10,40,5,3,None),):
    pass
# ---------- trees: clumps (a big tree with bushes leaning on it), then smaller clumps, never single dots in a row ----------
def clump(cx,cy,n):
    placed=0
    for k in ['oakA','oakB','bushD','bushC','bushE','bushC','bushE','bushD'][:n]:
        im=tree(k); fw,fh=im.width//16,im.height//16
        for t in range(25):
            x=cx+rng.randint(-3,3)-fw//2; y=cy+rng.randint(-2,2)-fh//2
            cells=[(xx,yy) for yy in range(y,y+fh) for xx in range(x,x+fw) if 0<=xx<W and 0<=yy<H]
            if y>=5 and len(cells)>0 and all(occ[yy][xx] is None for xx,yy in cells):
                for xx,yy in cells: occ[yy][xx]='tree'
                objs.append((im,x,y,True)); placed+=1; break
    return placed
for t in range(400):
    cx,cy=rng.randint(0,W-1),rng.randint(5,H-1)
    if occ[cy][cx] is None: clump(cx,cy,rng.randint(2,6))
# trees along the north edge outside the wall
for x in range(-1,W,3):
    im=tree('bushC' if x%2 else 'bushE'); objs.append((im,x,0,False))

# ---------- render ----------
img=Image.new('RGBA',(W*16,H*16))
for x in range(W):
    for y in range(H): img.paste(lawn,(x*16,y*16))
pl_img=pk.plaza(plaza).img(outline=False); img.alpha_composite(pl_img)
pv=pk.plaza(pave).img(outline=False); img.alpha_composite(pv)
img.alpha_composite(pk.road(road,joins=[[pave[y][x] or plaza[y][x] for x in range(W)] for y in range(H)]).img())
img.alpha_composite(pn.canal(canal))
img.alpha_composite(pn.townwall(wall,gates=GATES))
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
img.save('/tmp/j8city/town.png')
plain=[[occ[y][x] is None for x in range(W)] for y in range(H)]
best=0
for s in range(1,15):
    if any(all(plain[yy][xx] for yy in range(y,y+s) for xx in range(x,x+s)) for y in range(H-s+1) for x in range(W-s+1)): best=s
worst=max(sum(plain[yy][xx] for yy in range(y,y+13) for xx in range(x,x+17))/(17*13) for y in range(H-12) for x in range(W-16))
print('maxSq',best,'window max',round(worst,2))
