# 배치 도우미 — 덩이(클럼프)로 나무·바위를 깔고, 겹침·길 침범을 막는다. 모든 마을이 공유.
from vprops import *
import random
_PC={}
def _pine_cache(n,seed):
    if (n,seed) not in _PC: _PC[(n,seed)]=fin(pine(n,seed))
    return _PC[(n,seed)]
class Placer:
    def __init__(p,s,seed=1,free_kinds=('snow','frost'),canopy_kinds=None):
        p.s=s; p.r=random.Random(seed); p.free=set(free_kinds); p.canopy=set(canopy_kinds or free_kinds)
        p.occ=np.zeros((s.H,s.W),dtype=bool)      # 큰 물체(집·소품) 그림이 차지한 칸
        p.keep=np.zeros((s.H,s.W),dtype=bool)     # 비워둘 칸(문 앞·길 곁)
        p.count={}
    def reserve_objs(p):
        for o in p.s.objs:
            x0=o['x']//16; x1=(o['x']+o['img'].width-1)//16; y1=o['by']; y0=(o['y'])//16
            p.occ[max(0,y0):y1+1,max(0,x0):x1+1]=True
    def keep_kinds(p,names,grow=1):
        m=np.zeros_like(p.keep)
        for n in names: m|=(p.s.K==p.s.kid[n])
        p.keep|=(ndimage.binary_dilation(m,iterations=grow) if grow>0 else m)
    def keep_poi(p,r=1):
        for (x,y) in p.s.poi.values(): p.keep[max(0,y-r):y+r+1,max(0,x-r):x+r+1]=True
    def keep_rect(p,x0,y0,x1,y1): p.keep[y0:y1,x0:x1]=True
    def kname(p,x,y): return p.s.kinds[p.s.K[y,x]].name
    def ok_base(p,x,y,fw,fh):
        s=p.s
        for yy in range(y-fh+1,y+1):
            for xx in range(x,x+fw):
                if not(0<=xx<s.W and 0<=yy<s.H): return False
                if s.blockx[yy,xx] or p.keep[yy,xx] or p.occ[yy,xx] or p.kname(xx,yy) not in p.free: return False
        return True
    def ok_canopy(p,x,y,w_tiles,h_tiles,xoff=0):
        s=p.s
        for yy in range(y-h_tiles+1,y):
            for xx in range(x+xoff,x+xoff+w_tiles):
                if not(0<=xx<s.W): return False
                if yy<0: continue
                if p.keep[yy,xx] or p.occ[yy,xx]: return False
                if p.kname(xx,yy) not in p.canopy: return False
        return True
    def add(p,img,x,y,fw=1,fh=1,dx=0,dy=0,name=None,mark=True,check_canopy=True,block=True):
        wt=(img.width+15)//16; ht=(img.height+15)//16
        xoff=(dx)//16
        if not p.ok_base(x,y,fw,fh): return False
        if check_canopy:
            cx0=x+(dx//16); cw=(dx+img.width-1)//16 +1 - (dx//16)
            if not p.ok_canopy(x,y,cw,ht-fh+1+ (0),xoff=dx//16): return False
        p.s.put(img,x,y,fw=fw,fh=fh,name=name,dx=dx,dy=dy,block=block)
        if mark:
            x0=x+(dx//16); x1=x+(dx+img.width-1)//16
            p.occ[max(0,y-ht+1):y+1,max(0,x0):x1+1]=True
        k=name or 'obj'; p.count[k]=p.count.get(k,0)+1
        return True
    def tree_add(p,x,y,n=None,seed=None,name='pine'):
        n=n or p.r.choice([2,2,3,3,4]); seed=seed or p.r.randint(1,5)
        img=_pine_cache(n,seed); dx=-((img.width-16)//2)
        s=p.s
        # 나무는 서로 겹쳐도 된다(덩이). 큰 물체와 길·문 앞만 피한다.
        wt=(img.width+15)//16; ht=(img.height+15)//16
        if y-ht+1<0: return False
        if not p.ok_base(x,y,1,1): return False
        cx0=x+(dx//16); cw=(dx+img.width-1)//16+1-(dx//16)
        if not p.ok_canopy(x,y,cw,ht,xoff=dx//16): return False
        s.put(img,x,y,fw=1,fh=1,name=name,dx=dx)
        p.count[name]=p.count.get(name,0)+1; return True
    def clump(p,cx,cy,rx,ry,n,fn,tries=None):
        """타원 안에서 n 번 시도, 성공한 수 반환. fn(x,y)->bool"""
        got=0
        for _ in range(tries or n*6):
            if got>=n: break
            a=p.r.random()*6.283; d=math.sqrt(p.r.random())
            x=int(round(cx+math.cos(a)*d*rx)); y=int(round(cy+math.sin(a)*d*ry))
            if 0<=x<p.s.W and 0<=y<p.s.H and fn(x,y): got+=1
        return got

def measure(P,bare=('snow','frost'),save=None):
    """빈 바닥 = bare 종류 & 물체 그림이 안 덮은 칸. 20x15 창 최대 비율 + 5칸 이상 덩이 목록."""
    s=P.s; P.reserve_objs()
    empty=np.zeros((s.H,s.W),bool)
    for n in bare:
        if n in s.kid: empty|=(s.K==s.kid[n])
    empty&=~P.occ
    W,H=s.W,s.H; worst=(0,0,0)
    for y in range(0,H-15+1):
        for x in range(0,W-20+1):
            f=empty[y:y+15,x:x+20].mean()
            if f>worst[0]: worst=(f,x,y)
    lab,n=ndimage.label(empty)
    big=[(int((lab==i).sum()),tuple(int(v) for v in np.argwhere(lab==i).mean(0)[::-1])) for i in range(1,n+1)]
    big=sorted([b for b in big if b[0]>4],reverse=True)
    if save:
        from PIL import Image
        im=Image.open(save).convert('RGB'); px=im.load()
        for (yy,xx) in np.argwhere(empty):
            for dy in range(16):
                for dx in range(16):
                    if (dx+dy)%8==0: px[xx*16+dx,yy*16+dy]=(255,0,80)
        return worst,big,im
    return worst,big

def empty_map(P,bare=('snow','frost')):
    s=P.s; P.reserve_objs()
    e=np.zeros((s.H,s.W),bool)
    for n in bare:
        if n in s.kid: e|=(s.K==s.kid[n])
    return e&~P.occ

def autofill(P,fns,bare=('snow','frost'),min_patch=5,passes=6,per=7,radius=3.2):
    """빈 덩이(>=min_patch)마다 덩이 중심을 잡고 그 둘레에 fns 를 무작위로 시도한다(일렬 금지: 중심이 무작위)."""
    s=P.s
    for _ in range(passes):
        e=empty_map(P,bare); lab,n=ndimage.label(e); did=0
        sizes=[(int((lab==i).sum()),i) for i in range(1,n+1)]
        for sz,i in sorted(sizes,reverse=True):
            if sz<min_patch: continue
            pts=np.argwhere(lab==i)
            for _k in range(max(1,sz//per)):
                cy,cx=pts[P.r.randrange(len(pts))]
                P.clump(int(cx),int(cy),radius,radius*0.8,max(1,min(4,sz//per)),lambda x,y:P.r.choice(fns)(x,y),tries=24)
                did+=1
            P.reserve_objs()
        if not did: break

def greedy_fill(P,fns,bare=('snow','frost'),max_patch=4,rounds=200):
    """남은 덩이(>max_patch)의 타일을 무작위 순서로 돌며 하나씩 놓아 본다. 성공하면 다시 라벨링."""
    for _ in range(rounds):
        e=empty_map(P,bare); lab,n=ndimage.label(e)
        cand=[i for i in range(1,n+1) if (lab==i).sum()>max_patch]
        if not cand: return
        placed=False
        for i in sorted(cand,key=lambda i:-(lab==i).sum()):
            pts=[tuple(p) for p in np.argwhere(lab==i)]; P.r.shuffle(pts)
            for (y,x) in pts:
                for fn in P.r.sample(fns,len(fns)):
                    if fn(int(x),int(y)): placed=True; break
                if placed: break
            if placed: break
        if not placed: return
        P.reserve_objs()

def export_parts(s,ground_desc,prop_desc=None,skip=()):
    """compose() 뒤에 부른다. 새 땅 표본(3x3칸 잘라내기)과 물체 그림(이름별 1장)을 parts/ 로 저장."""
    from PIL import Image
    import numpy as np
    n=0
    for kn,what in ground_desc.items():
        if kn not in s.kid: continue
        m=(s.K==s.kid[kn]); best=None
        from scipy import ndimage as nd
        core=nd.binary_erosion(m,structure=np.ones((3,3)))
        pts=np.argwhere(core)
        if len(pts)==0:
            pts=np.argwhere(nd.binary_erosion(m,structure=np.ones((2,2)))); sz=2
        else: sz=3
        if len(pts)==0: continue
        y,x=pts[len(pts)//2]
        im=Image.fromarray(s.out,'RGB').crop(((x-(sz//2))*16,(y-(sz//2))*16,(x-(sz//2)+sz)*16,(y-(sz//2)+sz)*16))
        s.part('ground-'+kn,im.convert('RGBA'),what,'%dx%d칸 표본'%(sz,sz)); n+=1
    seen=set()
    for o in s.objs:
        nm=o.get('name') or 'obj'
        if nm in seen or nm in skip: continue
        seen.add(nm); im=o['img']
        s.part(nm,im,(prop_desc or {}).get(nm,nm),'%dx%d칸'%((im.width+15)//16,(im.height+15)//16)); n+=1
    return n
