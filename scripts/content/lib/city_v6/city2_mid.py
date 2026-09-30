# ---- reserve the ground at cliff lips and cliff feet (no building may sit on an edge or against a face) ----
for y in range(H-1):
    for x in range(W):
        if occ[y][x] is None and F[y+1][x]==1: occ[y][x]='rim'           # the lip row on the plateau
        if occ[y+1][x] is None and F[y][x]==3: occ[y+1][x]='rim'         # the foot row under a face
def soft_outline(im,k=0.62):
    # an INSET outline: the silhouette's own edge pixels darkened; nothing grows outward (no black ring)
    im=im.copy(); p=im.load(); W_,H_=im.size; edge=[]
    for y in range(H_):
        for x in range(W_):
            if p[x,y][3]<128: continue
            for dx,dy in ((0,1),(1,0),(-1,0),(0,-1)):
                xx,yy=x+dx,y+dy
                if not (0<=xx<W_ and 0<=yy<H_) or p[xx,yy][3]<128: edge.append((x,y)); break
    for x,y in edge:
        r,g,b,a=p[x,y]; p[x,y]=(int(r*k),int(g*k),int(b*k*1.1),a)
    return im
objs=[]; HOUSES=[]; SMOKE=[]
def free(x,y,w,h,allow=()):
    lv={E[yy][xx] for yy in range(y,y+h) for xx in range(x,x+w) if 0<=yy<H and 0<=xx<W}
    return len(lv)==1 and all(0<=xx<W and 0<=yy<H and (occ[yy][xx] is None or occ[yy][xx] in allow) for yy in range(y,y+h) for xx in range(x,x+w))
def mark(name,x,y,w,h):
    for yy in range(y,y+h):
        for xx in range(x,x+w):
            if 0<=xx<W and 0<=yy<H: occ[yy][xx]=name
def place(name,im,x,bottom,allow=(),outline=False,below=0,cast=True,door=None,chim=()):
    im=I(im); hb=im.height-below; fw=-(-(im.width-1)//16); fh=-(-(hb-1)//16); y=bottom-fh+1
    if not free(x,y,fw,fh,allow): return False
    if outline: im=soft_outline(im)
    mark(name,x,y,fw,fh); px0=x*16; py0=(bottom+1)*16-hb
    objs.append((im,px0,py0,cast))
    if door is not None: HOUSES.append((name,x+door,bottom))
    for cx,cy in chim: SMOKE.append((px0+cx,py0+cy))
    return y

# ---------------- building forms (v2: steep roofs with volume) ----------------
import ph2
def with_porch(h,st):
    im=h['im']; base=im.height-1; p=pv.porch(st,3); x=max(0,(h['door']-1)*16)
    o=Image.new('RGBA',(im.width,im.height+12)); o.alpha_composite(im); o.alpha_composite(p,(x,base-30))
    h=dict(h); h['im']=o; h['below']=12; return h
def with_lean(h,st):
    im=h['im']; l=pv.leanto_side(st,2); o=Image.new('RGBA',(im.width+32,im.height)); o.alpha_composite(im); o.alpha_composite(l,(im.width,im.height-l.height))
    h=dict(h); h['im']=o; return h
def with_sign(h,kind):
    im=h['im'].copy(); s=I(pf.shop_sign(kind)); x=max(0,h['door']*16+14)
    if x+16<=im.width: im.alpha_composite(s,(x,im.height-44))
    h=dict(h); h['im']=im; return h
RICH={'U','cross','hip2','T'}
def form(kind,style,r):
    st='sto' if style=='sto' else 'tim'; gs='sto' if style in ('sto','mix') else st
    s2=r.random()<0.55; sd=r.randint(0,99999)
    if kind=='hip': return ph2.house(st,r.randint(5,7),2 if s2 else 1,gs=gs,seed=sd)
    if kind=='hip2': return ph2.house(st,r.randint(7,8),2,gs=gs,seed=sd)
    if kind=='gable': return ph2.house(st,r.randint(5,7),2 if s2 else 1,gs=gs,seed=sd,hipped=False)
    if kind=='shop': return with_sign(ph2.house(st,r.randint(6,7),2 if s2 else 1,gs=gs,shop=True,seed=sd),r.choice(['weapon','item','inn']))
    if kind=='gfront': wc=r.choice((3,4,5)); return ph2.gfront(st,wc,2 if (s2 and wc>3) else 1,gs=gs)
    if kind=='cross': w=r.choice((9,10)); return ph2.cross(st,w,2 if s2 else 1,(1,5) if w==9 else (0,4,7)[:2],gs=gs,seed=sd)
    if kind=='L': w=r.choice((7,8)); return ph2.lhouse(st,w,2 if s2 else 1,[(w-3,2)] if r.random()<0.5 else [(0,2)],gs=gs,seed=sd)
    if kind=='T': return ph2.lhouse(st,9,1,[(3,2)],gs=gs,seed=sd)
    if kind=='U': return ph2.lhouse(st,11,2,[(0,2),(8,2)],gs=gs,seed=sd)
    if kind=='back': return ph2.backwing(st,r.choice((7,8)),1,2,gs=gs,seed=sd)
    if kind=='porch': return with_porch(ph2.house(st,6,1,gs=gs,seed=sd),st)
    if kind=='lean': return with_lean(ph2.house(st,5,1,gs=gs,seed=sd),st)
    if kind=='tower': return dict(im=shapes.image(shapes.plan(st='tim',w=7,s=2,gs='sto',tower=4)),door=2,chim=[],below=0)
FORMS=['hip','gable','shop','gfront','cross','L','T','back','porch','lean','hip2','U','tower']
SMALL=['hip','gable','gfront','lean','back']
def yard(x,fw,y0,y1,door,stone,r):
    # a front yard y0..y1 (rows) in front of a house x..x+fw-1: fence (or a low stone wall) on the street side and both
    # sides, a gate on the door column, a path from the door to the gate, flower beds / a bush / a bench inside
    mh=y1-y0+1; m=[[False]*fw for _ in range(mh)]
    for i in range(fw): m[mh-1][i]=True
    for j in range(mh): m[j][0]=True; m[j][fw-1]=True
    gx=door-x; gates={(gx,mh-1)}
    im=ph.run(m,ph.wall_cell if stone else ph.fence_cell,gates=() if stone else gates)
    if stone:                                      # stone walls leave the gate open
        p=im.load()
        for yy in range((mh-1)*16,mh*16+1):
            for xx in range(gx*16,gx*16+16): p[xx,yy]=(0,0,0,0)
    objs.append((im,x*16,y0*16,False))
    for j in range(mh):
        for i in range(fw):
            if m[j][i]: occ[y0+j][x+i]='fence'
    for j in range(mh): occ[y0+j][door]='road'; road[y0+j][door]=True
    inside=[(x+i,y0+j) for j in range(mh-1) for i in range(1,fw-1) if x+i!=door]
    things=[pl.P['꽃밭'],V2('새 물확'),V2('돌 화분'),pi.P['벤치'],pl.P['꽃밭']]
    for k,(cx,cy) in enumerate(inside):
        if occ[cy][cx] is None and r.random()<0.55:
            f=r.choice(things) if r.random()<0.7 else None
            if f is not None: P_(f'yd{cx}_{cy}',f,cx,cy,allow=())
            else:
                im=tree('bushC')
                if free(cx,cy,2,2): mark('tree',cx,cy,2,2); objs.append((im,cx*16,cy*16,True))
def terrace(x0,x1,bottom,style,seed,kinds=None,gap=0.15,back=True):
    r=random.Random(seed); x=x0; last=None; n=0; tops=[]
    while x<=x1:
        ks=[k for k in (kinds or FORMS) if k!=last]; r.shuffle(ks); ok=False
        for k in ks[:8]:
            h=form(k,style,r); im=h['im']; fw=-(-(im.width-1)//16)
            if x+fw-1>x1: continue
            yd=r.choice((2,3)) if (k in RICH and r.random()<0.7 and fw>=6) else 0
            b=bottom-yd
            if yd and not free(x,b+1,fw,yd): yd=0; b=bottom
            y=place(f'h{seed}_{n}',im,x,b,allow=('road',) if h['below'] else (),outline=True,below=h['below'],door=h['door'],chim=h['chim'])
            if y is not False:
                if yd: yard(x,fw,b+1,bottom,x+h['door'],style=='sto',r)
                tops.append((x,fw,y)); x+=fw+(1 if r.random()<gap else 0); last=k; n+=1; ok=True; break
        if not ok: x+=1
    if not back: return n
    top=[None]*W
    for tx,fw,ty in tops:
        for i in range(tx,tx+fw): top[i]=ty
    x=x0; r2=random.Random(seed+900); last=None
    while x<=x1:
        if top[x] is None: x+=1; continue
        ok=False; ks=[k for k in SMALL if k!=last]; r2.shuffle(ks)
        for k in ks[:5]:
            h=form(k,style,r2); im=h['im']; fw=-(-(im.width-1)//16)
            if h['below'] or x+fw-1>x1 or any(top[i] is None for i in range(x,x+fw)): continue
            b=min(top[i] for i in range(x,x+fw))-2
            if b<1: continue
            y=place(f'b{seed}_{n}',im,x,b,outline=True,door=h['door'],chim=h['chim'])
            if y is not False:
                for i in range(x,x+fw):
                    if occ[b+1][i] is None: occ[b+1][i]='road'; road[b+1][i]=True
                x+=fw; last=k; n+=1; ok=True; break
        if not ok: x+=1
    return n
