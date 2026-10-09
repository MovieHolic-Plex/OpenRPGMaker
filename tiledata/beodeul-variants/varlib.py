# 버들항 변형 공용 라이브러리 (variant 2: 기후·지역 마을 4곳)
# city_v6 파이프라인(px2.C 볼륨 페인터, pj 집 블록, pz/pi 소품)을 그대로 쓰고, 없는 재료(눈·얼음·모래·사암·늪 물·광재…)를
# 같은 7단 명암 팔레트(0=윤곽, 1~6=밝기)로 더한다. 땅은 픽셀 단위로 그린다(타일 격자 무늬 없음, 가장자리는 들쭉날쭉+젖은 띠).
import sys, os, json, math, collections
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
sys.path.insert(0,os.path.join(ROOT,'scripts','content','lib','city_v6'))
import numpy as np
from PIL import Image, ImageDraw
import palette; palette.apply()
import px2, pj, pz, pi, pboat
from px2 import C, hx, PAL, GRAIN
from scipy import ndimage

# ---------------------------------------------------------------- 새 재료 (7단, 색상 이동 포함: 그림자는 푸른/보랏빛, 빛은 노란빛)
PAL.update({
 'snow':  ['#2c3c66','#4c6394','#7a92c0','#a6bcdc','#cadaee','#e6f0fa','#ffffff'],
 'ice':   ['#16305c','#24548c','#3e84b8','#6cb4d8','#9ce0ee','#cff4f8','#f2ffff'],
 'frost': ['#20345a','#3a5a86','#5f88b0','#86b0cc','#aad0e0','#cceaf0','#eefcff'],   # 서리 낀 땅(눈 밑 흙)
 'sand':  ['#5a3a26','#936442','#bf8e58','#dcaf6c','#eccb86','#f8e2a4','#fff6d0'],
 'sstone':['#4a2a20','#7e4a34','#ac7044','#cf9558','#e8b672','#f6d498','#fff0c0'],   # 사암
 'mud':   ['#15160e','#2a2c17','#413f20','#5a5628','#77703a','#978c4c','#b8aa64'],
 'murk':  ['#0a1610','#12281c','#1c3e28','#2a5634','#3e6f42','#588a50','#7ea864'],   # 늪물
 'oasis': ['#0a3a46','#0e5a66','#128282','#22acA0','#4cd0b8','#8aecd4','#d4fff0'],
 'reed':  ['#1c2410','#38401c','#586028','#7c8438','#a0a44c','#c4c46c','#e4e090'],
 'pine':  ['#06180e','#0e3020','#175034','#237048','#38925a','#5cb476','#94d69c'],
 'slag':  ['#0e0a12','#221a26','#3a2e38','#584a52','#7a6a6c','#a09088','#c8b8ae'],
 'coal':  ['#06060a','#101018','#1c1c26','#2a2a36','#3c3c4a','#54566a','#78788e'],
 'ore':   ['#1a1020','#3a2444','#5e3c6c','#8a5c98','#b488c0','#dab6e4','#f6e6fc'],
 'palm':  ['#0a2410','#14461c','#20702a','#34a03a','#58c84c','#90e864','#d0fc90'],
 'thatch':['#2a1c0c','#503818','#7c5a28','#a88238','#cca850','#e8cc74','#fff0a4'],
 'shingle':['#1c1410','#3a2a20','#574234','#765c48','#967a60','#b89c7e','#dcc2a2'],   # 묵은 삼나무 널(회갈색)
 'shdark': ['#0c0a0c','#1c161a','#322a2c','#4a3e3e','#645452','#806e68','#a08e84'],   # 검게 그을린 널
 'thatchold':['#16130e','#2e2a20','#4a4332','#686048','#88805e','#a8a07c','#c8c09c'],   # 묵은 회갈색 이엉
 'mossroof':['#0a1a0e','#183018','#2a4a22','#42662e','#618640','#86a854','#b2cc7a'],
 'sky':   ['#0c1c34','#1a3a64','#2c60a0','#4a90d4','#7ac0f0','#b4e4fc','#f0fcff'],
 'steam': ['#5a6c86','#7e94ae','#a4b8cc','#c6d6e2','#e0ecf4','#f2f8fc','#ffffff'],
})
GRAIN.update({'snow':(0.05,2.2),'ice':(0.04,2.5),'frost':(0.10,2),'sand':(0.10,2.0),'sstone':(0.10,2.2),'mud':(0.20,1.6),'murk':(0.10,2),
 'oasis':(0.03,2),'reed':(0.2,1.4),'pine':(0.22,1.6),'slag':(0.16,1.8),'coal':(0.12,1.6),'ore':(0.08,1.8),'palm':(0.2,1.6),'thatch':(0.14,1.3),'shingle':(0.12,1.6),'shdark':(0.10,1.6),'thatchold':(0.16,1.3),'mossroof':(0.16,1.4),'sky':(0.02,2),'steam':(0.04,2)})

def RGB(mat,t): return np.array(hx(PAL[mat][t]),dtype=np.uint8)
PALARR={m:np.array([hx(c) for c in v],dtype=np.uint8) for m,v in PAL.items()}
def palarr(mat):
    if mat not in PALARR or len(PALARR[mat])!=7: PALARR[mat]=np.array([hx(c) for c in PAL[mat]],dtype=np.uint8)
    return PALARR[mat]

# ---------------------------------------------------------------- 넘파이 해시·값 잡음
def hsh(X,Y,s):
    X=np.asarray(X).astype(np.int64)&0xffffffff; Y=np.asarray(Y).astype(np.int64)&0xffffffff
    h=(X*374761393+Y*668265263+(s*982451653&0xffffffff))&0xffffffff
    h=((h^(h>>13))*1274126177)&0xffffffff
    return ((h^(h>>16))&0xffff)/65535.0
def vn(X,Y,sc,seed):
    fx=np.asarray(X,dtype=np.float64)/sc; fy=np.asarray(Y,dtype=np.float64)/sc
    x0=np.floor(fx); y0=np.floor(fy); tx=fx-x0; ty=fy-y0
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty); x0=x0.astype(np.int64); y0=y0.astype(np.int64)
    a=hsh(x0,y0,seed); b=hsh(x0+1,y0,seed); c=hsh(x0,y0+1,seed); d=hsh(x0+1,y0+1,seed)
    return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
def cluster(X,Y,seed,sc=6.0):
    return 0.6*vn(X,Y,sc,seed)+0.3*vn(X,Y,sc*0.4,seed+5)+0.1*hsh(X,Y,seed+9)

# ---------------------------------------------------------------- 땅 종류
class Kind:
    def __init__(s,name,mat,lo,hi,z=1,sc=6.0,walk=True,sharp=False,dither=0.10,painter=None,seed=1,**kw):
        s.name=name; s.mat=mat; s.lo=lo; s.hi=hi; s.z=z; s.sc=sc; s.walk=walk; s.sharp=sharp; s.dither=dither; s.painter=painter; s.seed=seed; s.kw=kw
        s.id=None

class Scene:
    def __init__(s,slug,W,H,seed=1):
        s.slug=slug; s.W=W; s.H=H; s.seed=seed
        s.kinds=[]; s.kid={}; s.K=None
        s.objs=[]; s.poi={}; s.parts=[]; s.over=[]
        s.blockx=np.zeros((H,W),dtype=bool)   # 오브젝트가 막는 칸
        s.walkoverride={}                     # (x,y)->True/False
        s.outdir=os.path.join(HERE,slug); os.makedirs(os.path.join(s.outdir,'parts'),exist_ok=True)
    # ---- 종류 등록·칠하기
    def kind(s,name,*a,**kw):
        k=Kind(name,*a,**kw); k.id=len(s.kinds); s.kinds.append(k); s.kid[name]=k.id
        if s.K is None: s.K=np.zeros((s.H,s.W),dtype=np.int32)
        return k
    def fill(s,name,x0=0,y0=0,x1=None,y1=None):
        x1=s.W if x1 is None else x1; y1=s.H if y1 is None else y1
        s.K[y0:y1,x0:x1]=s.kid[name]
    def rect(s,name,x0,y0,x1,y1): s.K[max(0,y0):min(s.H,y1),max(0,x0):min(s.W,x1)]=s.kid[name]   # x1,y1 제외
    def blob(s,name,cx,cy,rx,ry,seed=1,rough=0.28,only=None):
        for y in range(int(cy-ry-2),int(cy+ry+3)):
            for x in range(int(cx-rx-2),int(cx+rx+3)):
                if not (0<=x<s.W and 0<=y<s.H): continue
                dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry
                r=math.sqrt(dx*dx+dy*dy)*(1+(px2.vnoise(x,y,2.4,seed)-0.5)*rough*2)
                if r<=1 and (only is None or s.kinds[s.K[y,x]].name in only): s.K[y,x]=s.kid[name]
    def line(s,name,pts,wid=1,seed=3,wob=0.35,only=None):
        for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
            n=int(max(abs(x1-x0),abs(y1-y0))*2)+1
            for i in range(n+1):
                f=i/n; x=x0+(x1-x0)*f; y=y0+(y1-y0)*f
                for oy in range(-int(wid),int(wid)+1):
                    for ox in range(-int(wid),int(wid)+1):
                        xx=int(math.floor(x+ox+0.5-wid/2+ (px2.vnoise(x*3,y*3,3,seed)-0.5)*wob)); yy=int(math.floor(y+oy+0.5-wid/2))
                        if 0<=xx<s.W and 0<=yy<s.H and (only is None or s.kinds[s.K[yy,xx]].name in only): s.K[yy,xx]=s.kid[name]
    def kind_at(s,x,y): return s.kinds[s.K[y,x]]
    # ---- 오브젝트
    def put(s,img,tx,by,fw=None,fh=1,block=True,name=None,dx=0,dy=0,layer=0):
        """img 밑변을 타일 행 by 의 아래 끝에 맞춘다. 발자국 fw×fh 칸(기본: 그림 폭, 1행)이 막힌다."""
        wt=(img.width+15)//16; fw=wt if fw is None else fw
        x=tx*16+dx; y=(by+1)*16-img.height+dy
        s.objs.append(dict(img=img,x=x,y=y,by=by,tx=tx,layer=layer,name=name))
        if block:
            for yy in range(by-fh+1,by+1):
                for xx in range(tx,tx+fw):
                    if 0<=xx<s.W and 0<=yy<s.H: s.blockx[yy,xx]=True
        return x,y
    def free(s,x,y,w=1,h=1): return all(0<=xx<s.W and 0<=yy<s.H and not s.blockx[yy,xx] for yy in range(y,y+h) for xx in range(x,x+w))
    def poi_add(s,name,x,y): s.poi[name]=(x,y)
    def part(s,name,img,what,tiles):
        s.parts.append((name,img,what,tiles)); img.save(os.path.join(s.outdir,'parts',name+'.png'))
    # ---- 렌더
    def ground(s):
        H,W=s.H,s.W; h,w=H*16,W*16
        PY,PX=np.mgrid[0:h,0:w].astype(np.float64)
        wx=PX+(vn(PX,PY,7.0,s.seed+1)-0.5)*7.0+(hsh(PX,PY,s.seed+2)-0.5)*0.5
        wy=PY+(vn(PX,PY,7.0,s.seed+3)-0.5)*7.0+(hsh(PX,PY,s.seed+4)-0.5)*0.5
        txw=np.clip((wx//16).astype(int),0,W-1); tyw=np.clip((wy//16).astype(int),0,H-1)
        kw=s.K[tyw,txw]; ks=s.K[(PY.astype(int)//16),(PX.astype(int)//16)]
        sharp=np.array([k.sharp for k in s.kinds]); 
        km=np.where(sharp[kw]|sharp[ks],ks,kw)
        s.km=km; s.PX=PX; s.PY=PY
        out=np.zeros((h,w,3),dtype=np.uint8); tone=np.zeros((h,w),dtype=np.int8)
        zs=np.array([k.z for k in s.kinds])
        # 기본 질감
        for k in s.kinds:
            m=(km==k.id)
            if not m.any(): continue
            if k.painter: 
                rgb,t=k.painter(s,k,m,PX,PY); out[m]=rgb[m]; tone[m]=t[m] if t is not None else 3; continue
            n=cluster(PX,PY,k.seed*7+s.seed,k.sc)
            tf=k.lo+(k.hi-k.lo)*n+(hsh(PX,PY,k.seed+11)-0.5)*k.dither*(k.hi-k.lo)*2
            t=np.clip(np.rint(tf),1,6).astype(np.int8)
            out[m]=palarr(k.mat)[t][m]; tone[m]=t[m]
        # 가장자리 규칙: outl=경계 1화소를 tone 으로(물가 윤곽), damp=(종류이름들,폭) 그 종류 곁 땅을 한 단 어둡게(젖은 띠)
        for k in s.kinds:
            m=(km==k.id)
            if not m.any(): continue
            pal=palarr(k.mat)
            if 'outl' in k.kw:
                inner=ndimage.binary_erosion(m,iterations=1,border_value=1); b=m&~inner
                tone[b]=k.kw['outl']; out[b]=pal[k.kw['outl']]
            if 'damp' in k.kw:
                names,wd=k.kw['damp']; other=np.zeros_like(m)
                for nm in names: other|=(km==s.kid[nm])
                near=m&ndimage.binary_dilation(other,iterations=wd)
                tone[near]=np.clip(tone[near]-1,1,6); out[near]=pal[tone[near]]
        # 높이 차 가장자리: 높은 쪽 아래·오른쪽 = 그림자, 위·왼쪽 = 빛
        def sh(a,dy,dx):
            r=np.roll(np.roll(a,-dy,0),-dx,1)
            if dy>0: r[-dy:,:]=a[-dy:,:]
            if dy<0: r[:-dy,:]=a[:-dy,:]
            if dx>0: r[:,-dx:]=a[:,-dx:]
            if dx<0: r[:,:-dx]=a[:,:-dx]
            return r
        z=zs[km]; zS=zs[sh(km,1,0)]; zE=zs[sh(km,0,1)]; zN=zs[sh(km,-1,0)]; zW=zs[sh(km,0,-1)]
        for k in s.kinds:
            if k.kw.get('norim'): continue
            m=(km==k.id)
            dark=m&((z>zS)|(z>zE)); light=m&((z>zN)|(z>zW))&~dark
            pal=palarr(k.mat)
            out[dark]=pal[np.clip(tone[dark]-k.kw.get('rimd',1),1,6)]
            out[light]=pal[np.clip(tone[light]+1,1,6)]
        s.tone=tone; s.out=out
        return out
    def compose(s,extra_ground=None):
        g=s.ground()
        if extra_ground: extra_ground(s,g)
        im=Image.fromarray(s.out,'RGB').convert('RGBA')
        for o in sorted(s.objs,key=lambda o:(o['layer'],o['by'],o['x'])):
            im.alpha_composite(o['img'],(int(o['x']),int(o['y']))) if o['x']>=0 and o['y']>=0 and o['x']+o['img'].width<=im.width and o['y']+o['img'].height<=im.height else _clip_paste(im,o['img'],int(o['x']),int(o['y']))
        for f in s.over: f(s,im)
        s.image=im; return im
    # ---- 통행
    def grid(s):
        blocked=np.zeros((s.H,s.W),dtype=bool)
        for y in range(s.H):
            for x in range(s.W):
                k=s.kinds[s.K[y,x]]; blocked[y,x]=(not k.walk)
        blocked|=s.blockx
        for (x,y),v in s.walkoverride.items(): blocked[y,x]=not v
        s.blocked=blocked; return blocked
    def bfs(s,start):
        b=s.grid(); seen={start}; q=collections.deque([start])
        if b[start[1],start[0]]: raise SystemExit('입구가 막힘 %s'%(start,))
        while q:
            x,y=q.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                xx,yy=x+dx,y+dy
                if 0<=xx<s.W and 0<=yy<s.H and not b[yy,xx] and (xx,yy) not in seen: seen.add((xx,yy)); q.append((xx,yy))
        return seen
    def check(s,entrance):
        seen=s.bfs(entrance); bad=[n for n,(x,y) in s.poi.items() if (x,y) not in seen]
        return bad,len(seen),int((~s.blocked).sum())
    # ---- 저장
    def save(s,entrance,legend=None):
        b=s.grid(); bad,reach,total=s.check(entrance)
        gj=dict(w=s.W,h=s.H,tile=16,entrance=list(entrance),blocked=[[int(v) for v in row] for row in b],poi={k:list(v) for k,v in s.poi.items()},
                unreachable_poi=bad,reachable=reach,walkable=total,legend='1=막힘(물·절벽·건물·소품), 0=걸음')
        json.dump(gj,open(os.path.join(s.outdir,'grid.json'),'w'),ensure_ascii=False,separators=(',',':'))
        s.image.convert('RGB').save(os.path.join(s.outdir,'render-1x.png'))
        s.image.convert('RGB').resize((s.image.width*2,s.image.height*2),Image.NEAREST).save(os.path.join(s.outdir,'render-2x.png'))
        with open(os.path.join(s.outdir,'parts.md'),'w') as f:
            f.write('# 새로 찍은 조각 — %s\n\n'%s.slug)
            for n,im,what,tiles in s.parts: f.write('- `parts/%s.png` (%dx%d px) — %s / %s\n'%(n,im.width,im.height,what,tiles))
            f.write('\n합계: %d 조각\n'%len(s.parts))
        return bad,reach,total

def _clip_paste(im,src,x,y):
    x0=max(0,x); y0=max(0,y); x1=min(im.width,x+src.width); y1=min(im.height,y+src.height)
    if x1<=x0 or y1<=y0: return
    im.alpha_composite(src.crop((x0-x,y0-y,x1-x,y1-y)),(x0,y0))

# ================================================================= 집 (pj 블록 재색)
import colorsys
L_=pj.library()
def lumof(a): return (0.30*a[...,0]+0.59*a[...,1]+0.11*a[...,2])/255.0
def ramp_map(im,mat,lo=0.0,hi=1.0,bias=0.0,keep=None):
    """블록의 밝기를 mat 7단 팔레트로 다시 칠한다(밝기 순서 유지). keep(rgb배열)->bool 마스크: 원색 유지."""
    a=np.array(im).astype(np.float64); l=lumof(a)
    t=np.clip(np.rint(1+ (l-lo)/(hi-lo+1e-9)*5+bias),1,6).astype(int)
    out=a.copy(); pal=palarr(mat).astype(np.float64)
    out[...,:3]=pal[t]
    if keep is not None:
        k=keep(a); out[k]=a[k]
    return Image.fromarray(out.astype(np.uint8),'RGBA')
def is_wood(a):    # 문·기둥 같은 갈색
    r,g,b=a[...,0],a[...,1],a[...,2]; return (r>b+22)&(r>g)&(lumof(a)<0.5)
def is_glass(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; return (b>r+22)&(b>g+10)&(lumof(a)<0.45)

def cellimg(name): return L_[name].copy()

def snow_roof_cell(name,im,gx,gy,seed):
    """지붕 블록에 눈을 덮는다. gx,gy = 전역 화소 좌표(잡음 이음새 없애기)."""
    kind=name.split('.')[2]
    a=np.array(im).astype(np.float64); h,w=a.shape[:2]
    YY,XX=np.mgrid[0:h,0:w]; GX=XX+gx; GY=YY+gy
    l=lumof(a); alpha=a[...,3]>0
    front=kind in ('front','body','eave')
    n=vn(GX,GY,5.0,seed)-0.5; m2=vn(GX,GY,2.2,seed+7)-0.5
    t=5+np.rint(n*2.2+m2*0.9)
    # 처마선(기와 단) 그림자: 6행마다 한 줄, 곳곳이 끊긴 채. 눈이 기와 단 위로 둥글게 쌓인 결
    course=(GY+ (GX//11)%2*2)%6
    gap=hsh(GX//3,GY//6,seed+2)
    ln=(course==5)&(gap>0.22); ln2=(course==0)&(gap>0.5)
    t=np.where(ln,3,np.where(ln2,4,t))
    hi=(course==2)&(hsh(GX//2,GY//6,seed+6)>0.55); t=np.where(hi,6,t)
    if not front: t=np.where(course==5,np.where(gap>0.5,4,t),t)
    t=np.clip(t,3,6).astype(int)
    out=a.copy(); out[...,:3]=palarr('snow')[t]
    if kind=='eave':   # 처마 끝: 눈이 들쭉날쭉 끊기고 기와가 조금 보인다
        edge=(YY>=h-5)
        peek=edge&(hsh(GX,GY,seed+5)<0.30+0.18*(YY-(h-5))/4.0)
        out[peek]=a[peek]
    if kind=='ridge':
        top=(YY<3); out[top,:3]=palarr('snow')[6]
    out[~alpha]=a[~alpha]
    return Image.fromarray(out.astype(np.uint8),'RGBA')

def icicles(im,x0,x1,y,seed,dens=0.34,maxl=6):
    """처마 밑(y 행부터 아래로) 고드름. 윗줄이 굵고 끝이 뾰족하다. 3/4 앞면이라 세로로 매달린다."""
    px=im.load(); x=x0
    while x<x1:
        r=hsh(x,y,seed)
        if r<dens:
            ln=2+int(hsh(x,y,seed+1)*(maxl-1)); wide=(hsh(x,y,seed+2)<0.5 and ln>=4)
            for i in range(ln):
                for dx in ((0,1) if wide and i<ln-2 else (0,)):
                    xx=x+dx
                    if xx>=x1 or y+i>=im.height: continue
                    tone=6 if i==0 else (5 if (dx==0 and i<ln-1) else 4)
                    if dx==1: tone=3
                    if i==ln-1: tone=5
                    px[xx,y+i]=hx(PAL['ice'][tone])+(255,)
            x+=3+int(hsh(x,y,seed+4)*3)
        else: x+=1
    return im


# ---------------------------------------------------------------- 나무 지붕 (기와 대신 널·판재·이엉) — 밝기(3/4 명암)는 블록에서 받고 결만 새로 그린다
def roof_cell(kind,c,gx,gy,seed):
    """kind: shingle|shdark|plank|moss|thatchold. gx,gy = 집 그림 안 픽셀 좌표(칸 이음매 없이 이어지게)."""
    a=np.array(c).astype(np.float64); l=lumof(a); al=a[...,3]>0
    tt=np.clip(1+(l-0.10)/(0.80-0.10)*5,1,6)
    # 원래 기와의 무늬는 버리고 줄(행)마다의 평균 밝기만 받는다 = 3/4 명암(용마루 밝고 처마 어두움)만 남긴다
    body=al&(l>0.12); cnt=body.sum(1); mean=np.where(cnt>0,(tt*body).sum(1)/np.maximum(cnt,1),1.0)
    t0=np.where(body,mean[:,None],np.where(al,1.0,1.0))
    h,w=l.shape; X=(np.arange(w)[None,:]+gx).astype(np.int64)*np.ones((h,1),dtype=np.int64)
    Y=(np.arange(h)[:,None]+gy).astype(np.int64)*np.ones((1,w),dtype=np.int64)
    if kind=='plank':                 # 세로 널 + 이음 어긋난 가로 끝선
        bw=4; col=X//bw
        seg=(Y+ (hsh(col,0,seed+3)*11).astype(np.int64))//11
        tj=(hsh(col,seg,seed+5)*3).astype(np.int64)-1
        d=np.where(X%bw==0,-1.1,0.0)+np.where(X%bw==bw-1,0.25,0.0)
        d=d+np.where((Y+(hsh(col,0,seed+3)*11).astype(np.int64))%11==10,-1.2,0.0)
        d=d+tj*0.6+(hsh(X,Y,seed+9)>0.96)*(-0.7)
        pal='shingle'
    else:                              # 널 기와식: 4줄 높이, 6칸 폭 널, 줄마다 어긋남
        r=Y//4; off=(hsh(r,0,seed+1)*6).astype(np.int64)
        sx=(X+off)//6; tj=(hsh(sx,r,seed+2)*3).astype(np.int64)-1
        y0=Y%4; jx=(X+off)%6
        d=np.where(y0==3,-1.5,0.0)+np.where(y0==0,0.5,0.0)+np.where((jx==0)&(y0<3),-1.0,0.0)+tj*0.6
        d=d+(hsh(X,Y,seed+9)>0.97)*(-0.7)
        pal='shdark' if kind=='shdark' else 'shingle'
    t=np.clip(np.rint(t0+d),1,6).astype(int); t=np.where(body,t,1)           # 윤곽은 그대로
    rgb=palarr(pal)[t].astype(np.float64)
    if kind=='moss':                  # 이끼가 덩이로 앉는다(위쪽·골 쪽 먼저)
        n=0.6*vn(X,Y,7.0,seed+11)+0.4*vn(X,Y*1.5,3.0,seed+12)
        ms=(n>0.50)&(t0>1)
        tm=np.clip(np.rint(t0+d*0.7+0.0),1,6).astype(int)
        rgb=np.where(ms[...,None],palarr('mossroof')[tm].astype(np.float64),rgb)
    out=a.copy(); out[...,:3]=np.where(al[...,None],rgb,a[...,:3])
    return Image.fromarray(out.astype(np.uint8),'RGBA')

def house(st,storeys,nroof=2,gable=None,mode=None,seed=1,roofw=None,wallmat=None,roofmat=None):
    """storeys: [(cols,top,bottom)...]. mode: None|'snow'|'sand'|'mine'|'swamp'. 반환 = 윤곽 없는 RGBA + (지붕 행 수)."""
    # 위층에는 문이 없다 — 문(d)·대문(g)·다락문(h)은 맨 아래 층에만. 위층은 창(w)으로.
    storeys=[(c.translate(str.maketrans('dgh','www')) if i<len(storeys)-1 else c,t_,b_) for i,(c,t_,b_) in enumerate(storeys)]
    cols0=storeys[0][0]; w=len(cols0); roofw=roofw or w
    rows=(pj_demo_roofrows(st,roofw,gable,nroof) if nroof else [])
    for (cols,top,bot) in storeys: rows+=pj_demo_storeyrows(st,cols,top,bot)
    grid=[r.split() for r in rows]; Hh=len(grid); Ww=max(len(r) for r in grid)
    im=Image.new('RGBA',(Ww*16,Hh*16+1))
    for y,r in enumerate(grid):
        for x,n in enumerate(r):
            if n=='.': continue
            c=L_[n].copy(); kind=n.split('.')[1]
            if roofmat and kind=='roof':
                if roofmat=='thatch': c=ramp_map(c,'thatch',0.05,0.8,-0.05)
                elif roofmat=='thatchold': c=ramp_map(c,'thatchold',0.05,0.8,-0.05)
                else: c=roof_cell(roofmat,c,x*16,y*16,seed)
            elif mode=='snow':
                if kind=='roof': c=snow_roof_cell(n,c,x*16,y*16,seed)
                elif kind=='gable':
                    a=np.array(c).astype(float); rr,gg,bb=a[...,0],a[...,1],a[...,2]
                    red=(rr>gg+16)&(rr>bb+16)&(lumof(a)>0.2)&(a[...,3]>0)&(lumof(a)<0.7)&((rr-bb)>0.35*rr)
                    sn=snow_roof_cell('x.roof.front.m',c,x*16,y*16,seed); m=np.array(sn); a[red]=m[red]; c=Image.fromarray(a.astype(np.uint8),'RGBA')
                elif kind=='b' and y==Hh-1 or (kind=='b'):   # 벽 밑동에 눈 쌓임
                    pass
            elif mode=='mine' and kind in('u','b','gable'):
                c=ramp_map(c,'slag',0.05,0.85,0.2,keep=lambda a:is_wood(a)|is_glass(a))
            elif mode=='mine' and kind=='roof':
                c=ramp_map(c,'wood',0.1,0.8,0.0)
            elif mode=='sand' and kind in('u','b','gable'):
                c=ramp_map(c,'sstone',0.1,0.85,-0.1,keep=lambda a:is_wood(a)|is_glass(a))
            elif mode=='swamp' and kind=='roof':
                c=ramp_map(c,'thatch',0.05,0.8,-0.05)          # 갈대 이엉 지붕
            elif mode=='swamp' and kind in('u','b','gable'):
                c=ramp_map(c,'wood',0.0,0.75,-0.3,keep=lambda a:is_glass(a)) if st=='wod' else c
            im.alpha_composite(c,(x*16,y*16))
    return im,nroof,Hh
def pj_demo_roofrows(*a):
    import pj_demo; return pj_demo.roofrows(*a)
def pj_demo_storeyrows(*a):
    import pj_demo; return pj_demo.storeyrows(*a)

# ================================================================= 땅 그리기 도구 (물·얼음·절벽 면)
def _look(mat,t): return palarr(mat)[np.clip(t,0,6).astype(int)]
def paint_ice(mat='ice',seed=5,lo=3.2,hi=5.6,cracks=True):
    def f(s,k,m,PX,PY):
        n=0.65*vn(PX,PY*1.7,10.0,seed)+0.35*vn(PX,PY*2.4,4.0,seed+3)
        t=lo+(hi-lo)*n+(hsh(PX,PY,seed+1)-0.5)*0.5
        t=np.rint(t)
        if cracks:
            for j,(sc,wd) in enumerate(((14.0,0.016),(9.0,0.013))):
                c=vn(PX,PY,sc,seed+20+j*7); t=np.where(np.abs(c-0.5)<wd,np.minimum(t,2),t)
                c2=vn(PX+3,PY+5,sc,seed+20+j*7); t=np.where((np.abs(c2-0.5)<wd*0.6)&(t>=3),t+1,t)  # 균열 옆 밝은 가장자리
        g=(hsh(PX//2,PY//2,seed+8)>0.985); t=np.where(g,6,t)         # 반짝
        t=np.clip(t,1,6).astype(np.int8)
        return _look(mat,t),t
    return f
def paint_water(mat,seed=7,lo=2.0,hi=4.0,shore=2,streak=0.93,deep=(5,11),lily=None):
    """물결: 세로로 긴 잔물결 줄 + 물가에서 멀수록 어둡게(얕은 물가 밝은 띠)."""
    def f(s,k,m,PX,PY):
        dist=ndimage.distance_transform_edt(m)
        n=0.6*vn(PX,PY*2.2,9.0,seed)+0.4*vn(PX,PY*1.4,4.5,seed+2)
        t=lo+(hi-lo)*n
        t=t-(dist>deep[0])*0.7-(dist>deep[1])*0.8+(dist<=shore)*0.8
        t=np.rint(t+(hsh(PX,PY,seed+1)-0.5)*0.4)
        st=(hsh(PX,PY//3,seed+4)>streak)&(hsh(PX//2,PY//7,seed+5)>0.35)     # 세로 잔물결 줄
        t=np.where(st,t+2,t)
        st2=(hsh(PX+1,PY//2+1,seed+6)>streak+0.045); t=np.where(st2,t+1,t)
        if lily:
            lm,lseed,ld=lily; L=(vn(PX,PY,4.0,lseed)>1-ld)&(dist>2)
            t=np.where(L,-1,t)
        t=np.clip(t,1,6).astype(np.int8)
        rgb=_look(mat,t)
        if lily: rgb=np.where((np.clip(t,-1,9)==-1)[...,None],rgb,rgb)
        return rgb,t
    return f
def paint_cliff(mat='stone',seed=9,lo=2.0,hi=4.6,strata=8):
    """3/4 절벽 앞면: 위 두 줄 밝은 턱, 세로 결, 가로 균열, 밑 세 줄 그림자."""
    def f(s,k,m,PX,PY):
        H,W=m.shape; run=np.zeros((H,W),dtype=np.int32)
        for y in range(H):
            run[y]=np.where(m[y],(run[y-1]+1) if y else 1,0)
        n=0.55*vn(PX*1.6,PY,5.5,seed)+0.45*vn(PX,PY*0.7,3.0,seed+1)
        t=lo+(hi-lo)*n+(hsh(PX,PY,seed+2)-0.5)*0.5
        # 지층 가로선: 8행마다 어긋난 균열(중간이 끊김)
        row=(PY.astype(int)+ (PX.astype(int)//13)*3)%strata
        gap=hsh(PX//4,PY//strata,seed+3)
        t=np.where((row==0)&(gap>0.25),t-1.6,t)
        t=np.where((row==1)&(gap>0.25),t+0.7,t)
        # 세로 균열 조각
        vc=(hsh(PX//1,PY//10,seed+4)>0.965)&(hsh(PX,PY//5,seed+6)>0.3); t=np.where(vc,t-1.4,t)
        t=np.where(run<=2,t+1.6,t)
        # 밑에서 세 줄: 아래쪽 이웃이 다른 종류이면 그림자
        below=np.zeros_like(m); below[:-1]=m[:-1]&~m[1:]
        d=ndimage.distance_transform_edt(~below) if below.any() else np.full(m.shape,99.0)
        t=np.where(d<3,t-1.2,t)
        t=np.clip(np.rint(t),1,6).astype(np.int8)
        return _look(mat,t),t
    return f
