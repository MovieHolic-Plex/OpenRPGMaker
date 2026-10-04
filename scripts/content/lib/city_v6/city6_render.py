# v5 render (exec'd at the end of city6.py): paving by district, animated-water base, grand bridges, reeds, lilies,
# shadows, sorted objects; then the animation metadata (water frames, smoke kinds, windmill sails, fountains, boats).
import numpy as _np, json
from px2 import _hash
from PIL import Image as _Im
T0=__import__('time').time()
TREEPX=[(x,y,im.width,im.height) for im,x,y,c in objs if getattr(im,'_tree',False)]
_rm=_np.zeros((H*16,W*16),bool)
for yy in range(H):
    for xx in range(W):
        if road[yy][xx] or occ[yy][xx] in ('plaza','walk','gate','stair'): _rm[yy*16:yy*16+16,xx*16:xx*16+16]=True
img,GROUNDLAB=ground.render(W*16,H*16,TREEPX,_rm)
# ---- paving: streets = chipset cobbles with kerbs; forum = travertine flags (+ opus-sectile medallion round the
#      fountain); temple court, castle bailey, harbour square = calm grey flagstones; gardens = gravel ----
PLZ=[[occ[y][x]=='plaza' for x in range(W)] for y in range(H)]
ROADM=[[occ[y][x]=='road' or (road[y][x] and occ[y][x] not in ('water',)) for x in range(W)] for y in range(H)]
FOR_=[[FORUM[y][x] and not water[y][x] for x in range(W)] for y in range(H)]
CPV_=[[CPAVE[y][x] and not FOR_[y][x] and not water[y][x] and occ[y][x]!='road' for x in range(W)] for y in range(H)]
GRV_=[[GRAVEL[y][x] and not FOR_[y][x] and not CPV_[y][x] for x in range(W)] for y in range(H)]
FLG_=[[(PLZ[y][x] or plaza[y][x] or COURT[y][x]) and not water[y][x] and not FOR_[y][x] and not GRV_[y][x] and not CPV_[y][x] and not ROADM[y][x] for x in range(W)] for y in range(H)]
ANYP=[[PLZ[y][x] or occ[y][x] in ('gate','stair','walk','bridge') for x in range(W)] for y in range(H)]
img.alpha_composite(terrain.paving(ROADM,160,96,joins=ANYP))
fcx,fcy=FOUNTAIN[0]*16+24,FOUNTAIN[1]*16+24
def _forum_tex(X,Y):
    if max(abs(X-fcx),abs(Y-fcy))<=56: return roman.tex_opus(X,Y,fcx,fcy)
    return roman.tex_travertine(X,Y)
img.alpha_composite(roman.paving5(FOR_,_forum_tex,joins=ROADM,edge=roman.TRV))
img.alpha_composite(roman.paving5(FLG_,roman.tex_flag,joins=ROADM))
img.alpha_composite(roman.paving5(GRV_,roman.tex_gravel,joins=ROADM,curb=True,edge=roman.GRV))
import castle6, v6pieces
terrain.MASONRY_FN=lambda X,fy: castle6.ash(X,fy,0.97,seed=7)      # v7: pale ashlar retaining walls (the pink brick strips read as roads)
img.alpha_composite(roman.paving5(CPV_,lambda X,Y: v6pieces.ctex(192,176,X,Y),joins=ANYP))
print('paving',round(__import__('time').time()-T0,1))
# ---- water: static rims/quay faces from pn.canal, the surface from water6 (frame 0 here, all 8 frames saved) ----
NAT=[[bool((lake[y][x] and (x<=35 or x>=65)) or pond[y][x]) for x in range(W)] for y in range(H)]
img.alpha_composite(v6pieces.canal6(water,NAT))
FLOW=[['still']*W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if not water[y][x] or moat[y][x] or lake[y][x] or pond[y][x]: continue
        if 33<=x<=36 and y<=37: FLOW[y][x]='S'
        elif 38<=y<=41: FLOW[y][x]='E'
        elif 47<=x<=50: FLOW[y][x]='S'
OBST=[]; BR=[]
for bx,by in BRIDGES:
    b=v6pieces.bridge6(4); x0=bx*16+b['ox']; y0=by*16+b['oy_back']; BR.append((b,x0,y0))
    OBST+=[(x0+a,y0+c,r) for a,c,r in b['foam']]
for px_ in (20,38,62,76):                                      # pier legs at the waterline
    y0=shore[px_]*16+5*16
    OBST+=[(px_*16+2,y0,3),(px_*16+29,y0,3)]
LIL=[]
_lr=random.Random(77)
for y in range(H):
    for x in range(W):
        quiet=pond[y][x] or (lake[y][x] and (x<=24 or x>=76) and y>=91) or (moat[y][x] and x<12)
        if quiet and water[y][x] and _lr.random()<(0.55 if pond[y][x] else 0.22):
            LIL.append((x*16+_lr.randint(1,8),y*16+_lr.randint(2,10),1 if _lr.random()<0.35 else 0))
WA5=water6.Water(water,FLOW,obstacles=OBST,lilies=LIL,natural=NAT)
img.alpha_composite(v6pieces.beach_layer(WA5.beach,WA5.surf,W*16,H*16))
for b,x0,y0 in BR:
    WA5.add_shade(x0,y0,b['shade']); WA5.add_band(x0+6,x0+b['W']-6,y0+b['refl_y'],y0+b['refl_y']+4,0.62)
    WA5.add_reflection(b['reflect'],x0,y0+b['refl_y'])
_bs={}
for i,(k,bx_,by_) in enumerate(BOATS):
    sp=_Im.open(f'{OUT}/anim/boat_{k}_0.png'); _bs[k]=sp.size
    WA5.add_boat(bx_*16+sp.width//2,by_*16+sp.height-5,sp.width*0.42,(i*3)%8)
    fl=sp.transpose(_Im.FLIP_TOP_BOTTOM).crop((0,0,sp.width,min(14,sp.height)))
    WA5.add_reflection(fl,bx_*16,by_*16+sp.height-2,alpha=0.22,dark=0.5)
WATER_F=[WA5.frame(f) for f in range(water6.NF)]
F0=_Im.fromarray(WATER_F[0],'RGBA'); img.alpha_composite(F0)
print('water',round(__import__('time').time()-T0,1))
_tr=terrain.render(E,MAS,STAIRS,FALLS,frame=0)
_stc={(x0+i,y0+j) for x0,y0,w in STAIRS for i in range(w) for j in (0,1,2)}
_cf=[(x,y) for y in range(H) for x in range(W) if F[y][x] and E[y-F[y][x]][x]==3 and (x,y) not in _stc]
castle6.castle_face(_tr.load(),W*16,H*16,_cf,{(x,y):F[y][x]-1 for x,y in _cf})
_tp=_tr.load()
for y in range(H):
    for x in range(W):
        if CPAVE[y][x] and not F[y][x]:
            for ly in range(16):
                for lx in range(16):
                    r_,g_,b_,a_=_tp[x*16+lx,y*16+ly]
                    if a_ and g_>r_+20 and g_>b_+10: _tp[x*16+lx,y*16+ly]=roman.ST[2]+(255,) if (lx in (0,15) or ly in (0,15)) else roman.ST[5]+(255,)
img.alpha_composite(_tr)
img.alpha_composite(pn.townwall(wall,gates=GATES,face=lambda X,wy: castle6.ash(X,wy,1.0,seed=3)))
for b,x0,y0 in BR:
    img.alpha_composite(b['back'],(x0,y0)); objs.append((b['front'],x0,y0,False))
for im,x,y,c in GROUNDOBJ: img.alpha_composite(im,(x,y))
# ---- reeds on quiet banks (pond, lake corners, moat ends) ----
REEDS=[]
for y in range(1,H-1):
    for x in range(1,W-1):
        if not water[y][x]: continue
        quiet=pond[y][x] or (lake[y][x] and (x<=22 or x>=78)) or (moat[y][x] and (x<=3 or x>=28))
        if not quiet: continue
        bank=[(dx,dy) for dx,dy in ((0,-1),(-1,0),(1,0)) if not water[y+dy][x+dx]]
        if bank and _lr.random()<0.5:
            im=roman.reeds(x*3+y); objs.append((im,x*16+_lr.randint(-3,3),y*16-10,False)); REEDS.append((x,y))
print('reeds',len(REEDS),'lilies',len(LIL))
mask=_Im.new('L',img.size,0)
for im,x,y,cast in objs:
    if cast and im.height>=40: mask.paste(255,(x+6,y+3),im.split()[3].point(lambda v:255 if v>128 else 0))
SHM=_np.array(mask)>0
A=_np.array(img).astype(_np.float64)
k_=_np.array((0.52,0.58,0.74))
A[SHM,:3]=_np.floor(A[SHM,:3]*k_)
img=_Im.fromarray(A.astype(_np.uint8),'RGBA')
for im,px_,py_ in people:
    sh=_Im.new('RGBA',(14,5)); ImageDraw.Draw(sh).ellipse((0,0,13,4),fill=(0,0,0,70)); img.alpha_composite(sh,(px_+5,py_+28))
img.save(OUT+'/city6_ground.png')      # editor map: ground before the sorted objects (lower layer of walkable cells)
# CITY6_NO_PEOPLE: the editor tiles are cut from a render without the townsfolk sprites (their shadows stay; they become NPC events)
draw=[(y+im.height,im,x,y) for im,x,y,c in objs]+([] if os.environ.get('CITY6_NO_PEOPLE') else [(py_+32,im,px_,py_) for im,px_,py_ in people])+[(y+im.height,im,x,y) for im,x,y,c in OVER]
for _,im,x,y in sorted(draw,key=lambda o:o[0]): img.alpha_composite(im,(x,y))
# editor tileset: every drawn object as an isolated sprite with a name guess (house/landmark name, prop id, tree),
# so the builder can cut clean reusable pieces (transparent background) next to the baked city cells
import hashlib as _hl
os.makedirs(OUT+'/objects',exist_ok=True)
_names={id(v[0]):k for k,v in OBJOF.items()}
_plc={(d.get('px'),d.get('py')):d['id'] for d in PLACED if 'px' in d}
_kitc=[(a['piece'],a['x'],a['y'],a['w'],a['h']) for k in KIT.values() for a in k['answer']]
_OJ=[]
for lst,src in ((objs,'obj'),(OVER,'over'),(GROUNDOBJ,'ground')):
    for o in lst:
        im,x,y=o[0],o[1],o[2]
        hsh=_hl.sha1(im.tobytes()+bytes(str(im.size),'ascii')).hexdigest()[:16]
        if not os.path.exists(f'{OUT}/objects/{hsh}.png'): im.save(f'{OUT}/objects/{hsh}.png')
        nm=_names.get(id(o)) or _plc.get((x,y))
        if nm is None and getattr(im,'_tree',False): nm='tree'
        if nm is None:
            fx,fy=(x+im.width//2)//16,(y+im.height-1)//16
            nm=next((p for p,kx,ky,kw,kh in _kitc if kx<=fx<kx+kw and ky<=fy<ky+kh),None)
        _OJ.append(dict(hash=hsh,px=x,py=y,w=im.width,h=im.height,name=nm or 'object',src=src))
json.dump(_OJ,open(OUT+'/city6_objects.json','w'),ensure_ascii=False)
img.save(OUT+'/city6_base.png')
# ---- which base pixels are open water (replace per frame): plain, or under a cast shadow ----
B=_np.array(img).astype(_np.int32); W0=WATER_F[0].astype(_np.int32); surf=WATER_F[0][...,3]>0
plain=surf&_np.all(B[...,:3]==W0[...,:3],axis=2)
shd=_np.floor(W0[...,:3]*k_).astype(_np.int32)
shadowed=surf&SHM&_np.all(B[...,:3]==shd,axis=2)
AM=_np.zeros(B.shape[:2],_np.uint8); AM[plain]=1; AM[shadowed]=2
_Im.fromarray(AM*100,'L').save(OUT+'/anim/water_mask.png')
for f,fr in enumerate(WATER_F): _Im.fromarray(fr,'RGBA').save(f'{OUT}/anim/water_{f}.png')
print('water px animated',int(plain.sum()),'shadowed',int(shadowed.sum()),'surface',int(surf.sum()))
# ---- smoke kinds per chimney ----
TRADEOF={s_[0]:s_[3] for s_ in SHOPS}
SM5=[]
for i,(sx,sy,nm) in enumerate(SMOKE):
    kd=SMOKEKIND.get(nm) or ('dark' if TRADEOF.get(nm) in ('smith','bakery') or nm in ('smithy','smithy_town') else ['wisp','puffy','drift','puffy','wisp','drift'][int(_hash(sx,sy,5)*6)])
    SM5.append((sx,sy,kd,int(_hash(sx,sy,6)*12),int(_hash(sx,sy,7)*4)))
FOUNTS=[('big',FOUNTAIN[0]*16,FOUNTAIN[1]*16)]
if EFOUNT: FOUNTS.append(('big',EFOUNT[0]*16,EFOUNT[1]*16))
json.dump(dict(boats=BOATS,smoke=SM5,fountains=FOUNTS,falls=FALLS,anim=ANIM+ANIM_EXTRA,glow=GLOW,windmills=WM),open(OUT+'/city6_anim.json','w'))
import city6_anim; img=city6_anim.frame(img,0)
img.save(os.environ.get('OUT',OUT+'/city6.png'))
json.dump(PLACED,open(OUT+'/city6_placements.json','w'),ensure_ascii=False)
DOORC={(dx,by) for _n,dx,by in HOUSES}
def _rc(x,y):
    o=occ[y][x]
    if (x,y) in DOORC: return 'D'
    if water[y][x] and o=='water': return '~'
    return {'road':'R','plaza':'P','walk':'W','gate':'G','bridge':'B','stair':'S','cliff':'^','rim':'.','tree':'t',None:'.','ewall':'#','wall':'#'}.get(o,'#' if o else '.')
for k_,v_ in KIT.items():
    x0,y0,x1,y1=v_['bbox']; v_['roles']=[''.join(_rc(x,y) for x in range(x0,x1)) for y in range(y0,y1)]
    v_['legend']={'D':'문 칸 (집의 문, 그 아래 칸이 문 앞)','P':'광장·마당·자갈길 (통행)','W':'성벽길 (통행)','G':'성문 통로 (통행)','B':'도개교·다리 (통행)','S':'계단 (통행)','R':'길','~':'물 (해자·강)','#':'건물·벽·소품 (막힘)','^':'절벽면','t':'나무','.':'풀·빈 땅'}
json.dump(KIT,open(OUT+'/city6_kits.json','w'),ensure_ascii=False,indent=0)
_seen={(62,33)}; _q=[(62,33)]
while _q:
    cx,cy=_q.pop()
    for ddx,ddy in ((0,1),(1,0),(-1,0),(0,-1)):
        nx,ny=cx+ddx,cy+ddy
        if 0<=nx<W and 0<=ny<H and (nx,ny) not in _seen and occ[ny][nx] in WALK: _seen.add((nx,ny)); _q.append((nx,ny))
WALK_ALL=[(x,y) for y in range(H) for x in range(W) if occ[y][x] in WALK]
WALK_OFF=[c for c in WALK_ALL if c not in _seen]
print('walkable cells',len(WALK_ALL),'not connected',len(WALK_OFF),WALK_OFF[:20])
# editor map: the cell grid (occupancy, level, cliff face, water, doors) that decides passability
json.dump(dict(W=W,H=H,occ=[[o if o is None or o in WALK+('water','cliff','rim','wall','ewall','fence','tree','prop','ovh') else 'obj' for o in row] for row in occ],
               E=E,F=F,water=[[bool(v) for v in row] for row in water],doors=[[dx,by,n] for n,dx,by in HOUSES],stairs=STAIRS,bridges=BRIDGES,piers=PIERS,walk=list(WALK)),
          open(OUT+'/city6_grid.json','w'),ensure_ascii=False)
# editor tileset: houses (footprint cells, door cell, level, shop) -> the isolated sprite in city6_objects.json
_HJ=[]
for n_,dx_,by_ in HOUSES:
    if n_ not in OBJOF: continue
    (im_,px_,py_,c_),_a,_b=OBJOF[n_]
    _HJ.append(dict(name=n_,px=px_,py=py_,w=im_.width,h=im_.height,door=[dx_,by_],cells=[(x,y) for y in range(H) for x in range(W) if occ[y][x]==n_],level=E[by_][dx_],shop=next((s_[3] for s_ in SHOPS if s_[0]==n_),None)))
json.dump(_HJ,open(OUT+'/city6_houses.json','w'),ensure_ascii=False)
SK={}
for s_ in SM5: SK[s_[2]]=SK.get(s_[2],0)+1
json.dump(dict(doors=len(HOUSES),unreached_before=UNREACHED_BEFORE,dropped=DROP,unreached_after=UNREACHED_AFTER,props=PROPLOG,roads=ROADLOG,bridges=len(BRIDGES),
               smoke_kinds=SK,reeds=len(REEDS),lilies=len(LIL),cafe=CAFE,water_px=int(surf.sum()),walk_cells=len(WALK_ALL),walk_unconnected=len(WALK_OFF),walk_off_list=WALK_OFF),open(OUT+'/city6_stats.json','w'),ensure_ascii=False,indent=1)
print('objs',len(objs),'people',len(people),'time',round(__import__('time').time()-T0,1))
