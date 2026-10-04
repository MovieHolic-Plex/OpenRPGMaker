# 참나무골 v2 — streets framed by joined houses, deep chipset roofs, only the square paved. Plan:
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
        rows=RR(up_style if style!='mix' else 'tim',w,gab,3)+SR(ground_style,ground(),'eave','base')
    else:
        rows=RR(up_style,w,gab,4)+SR(up_style,upper(),'eave','jetty')+SR(ground_style,ground(),'plain','base')
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

# ---------- ground: dirt streets, only the market square is paved ----------
road=[[False]*W for _ in range(H)]; plaza=[[False]*W for _ in range(H)]
canal=[[False]*W for _ in range(H)]; wall=[[False]*W for _ in range(H)]
def R(g,x0,x1,y0,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): g[y][x]=True
R(wall,0,63,2,2)
R(road,31,32,5,21); R(road,31,32,24,25); R(road,31,32,35,47)       # main road: gate → bridge → square → south gate road
R(road,2,61,13,14)                                                 # street A
R(road,2,61,21,21); R(canal,0,63,22,23); R(road,2,61,24,24)        # quay lanes and the canal
R(plaza,24,39,26,34)                                               # market square (the only paving)
R(road,2,61,37,38)                                                 # street C
R(road,12,13,15,20); R(road,47,48,15,20)                           # lanes street A → quay
R(road,14,15,25,36); R(road,48,49,25,36)                           # lanes quay → street C
R(road,2,61,46,46)
for g,n in ((road,'road'),(plaza,'plaza'),(canal,'canal')):
    for y in range(H):
        for x in range(W):
            if g[y][x]: occ[y][x]=n
for y in range(H):
    for x in range(W):
        if wall[y][x] or (y>=1 and wall[y-1][x]) or (y>=2 and wall[y-2][x]): occ[y][x]='wall'
GATES=[(31,2),(32,2)]
for gx,gy in GATES: occ[gy+1][gx]='road'; occ[gy+2][gx]='road'

# ---------- terraces: houses stand wall to wall along the streets ----------
def terrace(x,bottom,specs,seed):
    k=0
    for spec in specs:
        if spec=='|': x+=1; continue                                    # a one-cell alley
        w,st,shop,sto=spec; rows,ch=house(w,sto,st,shop,seed=seed+k); put_rows(f't{seed}_{k}',rows,ch,x,bottom); x+=w; k+=1
terrace(3,12,[(6,'mix',False,2),(5,'tim',False,2),'|',(7,'tim',True,2),(6,'sto',False,2)],100)
terrace(35,12,[(7,'mix',True,2),(6,'tim',True,2),'|',(5,'sto',False,2),(7,'tim',False,2)],200)
terrace(3,20,[(7,'tim',False,1)],300); terrace(15,20,[(6,'sto',False,1),(7,'mix',True,1)],310)
terrace(34,20,[(6,'tim',False,1),(6,'sto',False,1)],320); terrace(50,20,[(6,'tim',False,1),(5,'mix',False,1)],330)
tower=[' '.join(f'sto.spire.{j}{i}' for i in range(3)) for j in range(4)]+SR('sto','lbr','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lpr','plain','base')
nave=RR('sto',7,3,4)+SR('sto','lapdpar','eave','base'); nave=['. '*7]*(len(tower)-len(nave))+nave
put_rows('chapel',[a+' '+b for a,b in zip(tower,nave)],[],3,36)
terrace(16,36,[(8,'tim',True,2)],400)
inn=RR('tim',8,4,4)+SR('tim','lwnwwmwr','eave','jetty')+SR('tim','lwnwwmwr','plain','jetty')+SR('sto','lwpwdpwr','plain','base')
put_rows('inn',inn,[('tim.chimney',1),('tim.chimney',6)],40,36)
put_rows('smithy',RR('sto',6,None,3)+SR('sto','ldpwwr','eave','base'),[('sto.chimney',4)],51,36)
terrace(57,36,[(6,'tim',False,2)],410)
terrace(3,45,[(6,'tim',False,1),(5,'sto',False,1),'|',(6,'mix',False,1)],500)
put_rows('barn',RR('wod',6,None,4)+SR('wod','lpghpr','eave','base'),[],54,45)

# ---------- objects, clustered where people work ----------
for bx in (12,30,47):
    P_(f'bridge{bx}',pn.bridge(3,4),bx,21,allow=('canal','road'))
# the square
P_('fountain',pf.fountain(int(os.environ.get('FF','0'))),30,29)
P_('lampW',pf.P['철제 가로등'](),28,29); P_('lampE',pf.P['철제 가로등'](),34,29)
P_('stall1',ph.stall(3,'red',['apple','cabbage','bread']),24,26); P_('stall2',ph.stall(2,'blue',['fish','fish']),27,26)
P_('stall3',ph.stall(3,'green',['pot','cloth','pot']),34,26); P_('stall4',ph.stall(3,'red',['bread','apple','bread']),24,31)
P_('crates',pi.P['상자 더미'](),27,32); P_('sacks',pi.P['곡식 자루'](),29,33); P_('fruitb',pd.P['과일 바구니'](),37,26)
P_('bench1',pi.P['벤치'](),29,33-1); P_('bench2',pi.P['벤치'](),33,32); P_('board',pi.P['마을 게시판'](),24,29-0) if free(24,29,2,2,('plaza',)) else None
# inn yard on the square's east edge
P_('innt1',pl.P['야외 탁자'](),37,29); P_('innt2',pl.P['야외 탁자'](),37,32); P_('innbar',pf.P['술통 더미'](),38,34-0) if free(38,34,2,1,('plaza',)) else None
P_('innsign',pf.P['상점 간판 (여관)'](),39,27) if free(39,27,1,2,('plaza',)) else None
# gate
P_('knightW',pf.P['기사 석상'](),28,5); P_('knightE',pf.P['기사 석상'](),33,5)
P_('banner1',pf.P['깃발 기둥'](),30,5); P_('banner2',pf.P['깃발 기둥'](),33,8) if free(33,8,1,2) else None
P_('signA',pl.P['이정표'](),30,15)
# smithy yard (west of the smithy, on the lane corner) and its woodpile
for nm,f,x,y in (('anvil',pf.P['모루와 그루터기'],52,31),('rack',pf.P['무기 거치대'],53,29),('wsmith',pi.P['장작더미'],55,31),('smithbar',pf.P['술통 더미'],50,30)):
    try_P(nm,f(),x,y,allow=()) or print('skip',nm)
# farm (south-east): fields, barn yard
P_('wheat',pi.field('wheat',6,3),34,40); P_('cab',pi.field('cabbage',5,3),41,40); P_('sprout',pi.field('sprout',6,2),34,43)
P_('scare',pi.P['허수아비'](),41,43); P_('hay',pi.P['건초더미'](),47,41); P_('cart',pf.P['건초 수레'](),47,43)
P_('coop',pl.P['닭장'](),61,40) if free(61,40,2,2) else print('no coop'); P_('hens',pl.P['닭 두 마리'](),60,42) if free(60,42,1,1) else None; P_('hens2',pl.P['닭 두 마리'](),62,43) if free(62,43,1,1) else None
P_('hives',pl.P['벌통 (짚 벌집)'](),50,40) if free(50,40,2,1) else None
# farm fence along the fields' street side, an orchard clump and a paddock by the barn
ffence=ph.run([[True]*14],ph.fence_cell,gates={(7,0)})
objs.append((ffence,33,39,False)); mark('ffence',33,39,14,1); occ[39][40]='road'
# chapel garden south of street C
gard=ph.run([[ch!='.' for ch in r] for r in ["###G#####","#.......#","#.......#","#########"]],ph.fence_cell,gates={(3,0)})
objs.append((gard,22,39,False)); mark('garden',22,39,9,1); mark('garden',22,42,9,1)
for yy in range(39,43): mark('garden',22,yy,1,1); mark('garden',30,yy,1,1)
occ[39][25]='road'
P_('shrine',pl.P['길가 성소'](),28,40); P_('gbed1',pl.P['꽃밭'](),23,40); P_('gbed2',pl.P['꽃밭'](),23,41); P_('gbench',pi.P['벤치'](),25,41)
# back yards: household work behind the terraces
YARD=[pl.P['빨래줄'],pi.P['장작더미'],pl.P['빗물통'],pl.P['호박'],pi.P['꽃 화분 상자'],pl.P['벌통 (짚 벌집)'],pi.P['나무 상자']]
yard_spots=[(4,15),(9,15),(19,15),(24,15),(36,15),(43,15),(52,15),(58,15),(17,25),(20,27),(4,25),(8,25),(52,25),(57,26),(42,25),(9,39),(3,39),(16,39)]
for i,(sx,sy) in enumerate(yard_spots):
    f=YARD[i%len(YARD)]
    for dx,dy in ((0,0),(1,0),(0,1),(2,0),(-1,0),(0,2)):
        if try_P(f'yard{i}',f(),sx+dx,sy+dy,allow=()): break
# small kitchen plots in the yards south of the canal
for (fx,fy,fw,fh,kind) in ((3,26,5,2,'cabbage'),(52,27,5,2,'sprout')):
    if free(fx,fy,fw,fh): P_(f'plot{fx}',pi.field(kind,fw,fh),fx,fy)

# ---------- trees: only outside the built blocks (edges, yards' ends, the chapel garden), in clumps ----------
def clump(cx,cy,n):
    for k in ['oakA','oakB','bushD','bushC','bushE','bushC'][:n]:
        im=tree(k); fw,fh=im.width//16,im.height//16
        for t in range(25):
            x=cx+rng.randint(-2,2)-fw//2; y=cy+rng.randint(-2,2)-fh//2
            cells=[(xx,yy) for yy in range(y,y+fh) for xx in range(x,x+fw) if 0<=xx<W and 0<=yy<H]
            if y>=5 and cells and all(occ[yy][xx] is None for xx,yy in cells):
                for xx,yy in cells: occ[yy][xx]='tree'
                objs.append((im,x,y,True)); break
for (cx,cy,n) in ((1,8,4),(62,8,4),(1,17,3),(62,17,3),(1,30,4),(62,30,3),(1,42,4),(62,44,2),(10,31,3),(20,30,2),(44,29,3),(57,29,3),(36,45,2),(10,42,2),(26,44,3),(46,45,2),(50,43,3),(61,45,2),(2,26,3),(8,27,2),(40,25,2),(20,25,2)):
    clump(cx,cy,n)
for x in range(-1,W,3):
    im=tree('bushC' if x%2 else 'bushE'); objs.append((im,x,0,False))

# ---------- render ----------
img=Image.new('RGBA',(W*16,H*16))
for x in range(W):
    for y in range(H): img.paste(lawn,(x*16,y*16))
pl_img=pk.plaza(plaza).img(outline=False); img.alpha_composite(pl_img)
img.alpha_composite(pk.road(road,joins=plaza).img())
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
img.save('/tmp/j8city/town2.png')
plain=[[occ[y][x] is None for x in range(W)] for y in range(H)]
best=0
for s in range(1,15):
    if any(all(plain[yy][xx] for yy in range(y,y+s) for xx in range(x,x+s)) for y in range(H-s+1) for x in range(W-s+1)): best=s
worst=max(sum(plain[yy][xx] for yy in range(y,y+13) for xx in range(x,x+17))/(17*13) for y in range(H-12) for x in range(W-16))
print('maxSq',best,'window max',round(worst,2))
print(sorted(((sum(plain[yy][xx] for yy in range(y,y+13) for xx in range(x,x+17))/(17*13),x,y) for y in range(H-12) for x in range(W-16)),reverse=True)[:4])
for y in range(H): print(''.join('.' if plain[y][x] else '#' for x in range(W)))
