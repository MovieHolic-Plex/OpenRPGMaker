"""버들항 변형 공용 조립기 (변형 1번). 버들항 v6 파이프라인의 그리기 함수를 그대로 쓰고, 마을 하나를 조립한다.
- 물체: tiledata/beodeul-city/render/objects/<해시>.png (city6_objects.json 색인) 를 이름으로 불러 온다.
- 렌더 순서는 city6_render.py 와 같다: 잔디 -> 포장 -> 운하 테두리 -> 물 -> 계단식 땅 -> 성벽 -> 다리 뒤 -> 바닥 물체 ->
  갈대 -> 그림자 -> 아래끝 정렬 합성.
- 같은 입력이면 같은 그림이다(난수는 seed 고정)."""
import sys, os, json, random, math, hashlib
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
SRC=os.path.join(ROOT,'scripts','content','lib','city_v6')
sys.path.insert(0,SRC)
import numpy as np
from PIL import Image, ImageDraw
import palette; palette.apply()
import terrain, roman, water6, v6pieces, pn, castle6, pz, ground, px2, pj
from collections import deque

RENDER=os.path.join(ROOT,'tiledata','beodeul-city','render')
_OBJ=json.load(open(RENDER+'/city6_objects.json'))
_HOUSES=json.load(open(RENDER+'/city6_houses.json'))
_cache={}
def _png(h):
    if h not in _cache: _cache[h]=Image.open(f'{RENDER}/objects/{h}.png').convert('RGBA')
    return _cache[h]
BYNAME={}
for o in _OBJ: BYNAME.setdefault(o['name'],[]).append(o)
def sprite(name,i=0):
    """이름으로 물체 그림 하나. 같은 이름이 여럿이면 i 번째(해시 순서 고정)."""
    L=sorted({o['hash']:o for o in BYNAME[name]}.values(),key=lambda o:o['hash'])
    return _png(L[i%len(L)]['hash'])
def variants(name): return len({o['hash'] for o in BYNAME[name]})
HOUSE={}
for h in _HOUSES:
    x0=min(c[0] for c in h['cells']); y0=min(c[1] for c in h['cells'])
    ob=next((o for o in _OBJ if o['px']==h['px'] and o['py']==h['py'] and o['w']==h['w'] and o['h']==h['h']),None)
    if ob is None: continue
    HOUSE[h['name']]=dict(im=_png(ob['hash']),dx=h['px']-x0*16,dy=h['py']-y0*16,cells=[(c[0]-x0,c[1]-y0) for c in h['cells']],
                          door=(h['door'][0]-x0,h['door'][1]-y0),w=h['w'],h=h['h'])
TREES=[o for o in _OBJ if o['name']=='tree']
def trees(kind):
    """kind: bush(32x32) cypress(16x48) canopy(48x48) oak(48x64) big(64x80) -> 해시 순서 고정 목록"""
    sz={'bush':(32,32),'cypress':(16,48),'canopy':(48,48),'oak':(48,64),'big':(64,80)}[kind]
    L=sorted({o['hash'] for o in TREES if (o['w'],o['h'])==sz})
    return [_png(h) for h in L]
BOAT={k:Image.open(f'{SRC}/anim/boat_{k}_0.png').convert('RGBA') for k in ('fishing','rowboat','barge','ship')}

WALKLAB={'grass','road','plaza','gravel','forum','cpave','stair','bridge','walk','gate','door','field'}
class Town:
    def __init__(s,W,H,name,seed=1):
        s.W,s.H,s.name,s.seed=W,H,name,seed
        z=lambda v: [[v]*W for _ in range(H)]
        s.road=z(False); s.plaza=z(False); s.gravel=z(False); s.forum=z(False); s.cpave=z(False)
        s.water=z(False); s.natural=z(False); s.flow=z('still'); s.E=z(0); s.mas=z(False)
        s.stairs=[]; s.falls=[]; s.bridges=[]; s.boats=[]; s.lilies=[]; s.reedcells=[]
        s.wall=None; s.gates=[]; s.wallface=None
        s.lab=z('grass')            # 걸음/막힘 판정용 칸 이름
        s.blk=z(False)              # 물체가 막는 칸
        s.cover=z(False)            # 물체 그림이 덮는 칸(빈 바닥 판정)
        s.objs=[]; s.ground=[]; s.doors={}; s.parts=[]; s.targets={}; s.entrances=[]
        s.rng=random.Random(seed); s.used={}; s.force={}   # force: 물 위 잔교처럼 물 그림은 두되 걸음 라벨을 덮는 칸
    # ---------- 칸 칠하기 ----------
    def fill(s,layer,x0,y0,x1,y1,v=True):
        g=getattr(s,layer)
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                if 0<=x<s.W and 0<=y<s.H: g[y][x]=v
    def path(s,pts,layer='road',w=1):
        """꺾은선 길. pts 는 칸 좌표, 폭 w."""
        g=getattr(s,layer)
        for (ax,ay),(bx,by) in zip(pts,pts[1:]):
            n=max(abs(bx-ax),abs(by-ay))
            for i in range(n+1):
                x=round(ax+(bx-ax)*i/max(1,n)); y=round(ay+(by-ay)*i/max(1,n))
                for dx in range(w):
                    for dy in range(w):
                        xx,yy=x+dx,y+dy
                        if 0<=xx<s.W and 0<=yy<s.H: g[yy][xx]=True
    def blob(s,layer,cx,cy,rx,ry,v=True,wob=0.0,seed=0):
        g=getattr(s,layer); r=random.Random(seed)
        ph=[r.random()*6.28 for _ in range(3)]
        for y in range(s.H):
            for x in range(s.W):
                dx=(x+.5-cx)/rx; dy=(y+.5-cy)/ry
                a=math.atan2(dy,dx); k=1+wob*(math.sin(2*a+ph[0])*.5+math.sin(3*a+ph[1])*.3+math.sin(5*a+ph[2])*.2)
                if dx*dx+dy*dy<=k*k: g[y][x]=v
    # ---------- 물체 ----------
    def _cov(s,px,py,w,h):
        for cy in range(max(0,py//16),min(s.H,(py+h-1)//16+1)):
            for cx in range(max(0,px//16),min(s.W,(px+w-1)//16+1)): s.cover[cy][cx]=True
    def _block(s,cells):
        for x,y in cells:
            if 0<=x<s.W and 0<=y<s.H: s.blk[y][x]=True
    def house(s,name,X,Y,cast=True):
        """집: (X,Y)=발자국 왼쪽 위 칸. 발자국 칸은 막고 문 칸만 남긴다."""
        H=HOUSE[name]; im=H['im']; px=X*16+H['dx']; py=Y*16+H['dy']
        s.used[name]=s.used.get(name,0)+1
        s.objs.append((im,px,py,cast)); s._cov(px,py,im.width,im.height)
        dx,dy=H['door']; s.doors[f'{name}@{X},{Y}']=(X+dx,Y+dy+1)
        s._block([(X+cx,Y+cy) for cx,cy in H['cells'] if (cx,cy)!=(dx,dy)])
        return (X+dx,Y+dy+1)
    def prop(s,name,X,Y,i=0,block=1,cast=True,dx=0,dy=0,flip=False):
        """소품: (X,Y)=그림 왼쪽 아래 칸. block=아래에서 몇 줄을 막나(0=안 막음)."""
        im=sprite(name,i)
        if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
        px=X*16+dx; py=(Y+1)*16-im.height+dy
        s.objs.append((im,px,py,cast)); s._cov(px,py,im.width,im.height)
        w=(im.width+15)//16
        s._block([(X+i_,Y-j) for i_ in range(w) for j in range(block)])
        return im
    def img(s,im,X,Y,block=1,cast=True,dx=0,dy=0,kind=None):
        """직접 만든 그림. (X,Y)=왼쪽 아래 칸."""
        px=X*16+dx; py=(Y+1)*16-im.height+dy
        s.objs.append((im,px,py,cast)); s._cov(px,py,im.width,im.height)
        w=(im.width+15)//16
        s._block([(X+i_,Y-j) for i_ in range(w) for j in range(block)])
    def tree(s,kind,X,Y,i=None,cast=True):
        """나무: (X,Y)=밑동 칸(그림 가운데 아래). 밑동 칸만 막는다(관목은 두 칸)."""
        L=trees(kind)
        if i is None: i=(X*7+Y*13+s.seed)%len(L)
        im=L[i%len(L)]; cx=X*16+8; px=cx-im.width//2; py=(Y+1)*16-im.height
        im=im.copy(); im._tree=True
        s.objs.append((im,px,py,cast)); s._cov(px,py,im.width,im.height)
        if kind=='bush': s._block([(X,Y),(X-1 if im.width==32 else X,Y)])
        else: s._block([(X,Y)])
    def gimg(s,im,X,Y,block=0,label=None,dx=0,dy=0):
        """바닥층 그림(밭·포도 이랑 등). (X,Y)=왼쪽 위 칸."""
        px=X*16+dx; py=Y*16+dy
        s.ground.append((im,px,py)); s._cov(px,py,im.width,im.height)
        if label:
            for cy in range(py//16,(py+im.height-1)//16+1):
                for cx in range(px//16,(px+im.width-1)//16+1):
                    if 0<=cx<s.W and 0<=cy<s.H: s.lab[cy][cx]=label
    def part(s,name,im,note,tiles):
        s.parts.append((name,im,note,tiles))
    # ---------- 렌더 ----------
    def build_labels(s):
        F=terrain.faces(s.E)
        stc={(x+i,y+j) for x,y,w in s.stairs for i in range(w) for j in (0,1,2)}
        for y in range(s.H):
            for x in range(s.W):
                l='grass'
                if s.road[y][x]: l='road'
                if s.gravel[y][x]: l='gravel'
                if s.plaza[y][x]: l='plaza'
                if s.forum[y][x]: l='forum'
                if s.cpave[y][x]: l='cpave'
                if F[y][x]: l='stair' if (x,y) in stc else 'cliff'
                if s.water[y][x]: l='water'
                s.lab[y][x]=s.lab[y][x] if s.lab[y][x] in ('field',) and l=='grass' else l
        for b in s.bridges:
            bx,by,wc=b
            for i in range(wc):
                if 0<=bx+i<s.W: s.lab[by][bx+i]='bridge'
        if s.wall:
            for y in range(s.H):
                for x in range(s.W):
                    if s.wall[y][x]: s.lab[y][x]='wall'
            for gx,gy in s.gates:
                s.lab[gy][gx]='gate'
        for (fx,fy),l in s.force.items():
            if 0<=fx<s.W and 0<=fy<s.H: s.lab[fy][fx]=l
        return F
    def render(s,out_dir=None):
        W,H=s.W,s.H
        F=s.build_labels()
        rm=np.zeros((H*16,W*16),bool)
        for y in range(H):
            for x in range(W):
                if s.road[y][x] or s.plaza[y][x] or s.forum[y][x] or s.cpave[y][x] or s.gravel[y][x]: rm[y*16:y*16+16,x*16:x*16+16]=True
        TREEPX=[(x,y,im.width,im.height) for im,x,y,c in s.objs if getattr(im,'_tree',False)]
        img,GL=ground.render(W*16,H*16,TREEPX,rm,seed=4+s.seed)
        ROADM=[[bool(s.road[y][x] and not s.water[y][x]) for x in range(W)] for y in range(H)]
        ANYP=[[bool(s.plaza[y][x] or s.forum[y][x] or s.cpave[y][x] or s.lab[y][x] in ('gate','stair','bridge','walk') or s.road[y][x]) for x in range(W)] for y in range(H)]
        if any(any(r) for r in ROADM): img.alpha_composite(terrain.paving(ROADM,160,96,joins=ANYP))
        FOR=[[s.forum[y][x] and not s.water[y][x] for x in range(W)] for y in range(H)]
        CPV=[[s.cpave[y][x] and not FOR[y][x] and not s.water[y][x] and not ROADM[y][x] for x in range(W)] for y in range(H)]
        GRV=[[s.gravel[y][x] and not FOR[y][x] and not CPV[y][x] and not ROADM[y][x] for x in range(W)] for y in range(H)]
        FLG=[[s.plaza[y][x] and not s.water[y][x] and not FOR[y][x] and not GRV[y][x] and not CPV[y][x] and not ROADM[y][x] for x in range(W)] for y in range(H)]
        if any(any(r) for r in FOR): img.alpha_composite(roman.paving5(FOR,roman.tex_travertine,joins=ROADM,edge=roman.TRV))
        if any(any(r) for r in FLG): img.alpha_composite(roman.paving5(FLG,roman.tex_flag,joins=ROADM))
        if any(any(r) for r in GRV): img.alpha_composite(roman.paving5(GRV,roman.tex_gravel,joins=ROADM,curb=True,edge=roman.GRV))
        terrain.MASONRY_FN=lambda X,fy: castle6.ash(X,fy,0.97,seed=7)
        if any(any(r) for r in CPV): img.alpha_composite(roman.paving5(CPV,lambda X,Y: v6pieces.ctex(192,176,X,Y),joins=ANYP))
        BR=[]; OBST=[]
        if any(any(r) for r in s.water):
            img.alpha_composite(v6pieces.canal6(s.water,s.natural))
            for bx,by,wc in s.bridges:
                b=v6pieces.bridge6(wc); x0=bx*16+b['ox']; y0=by*16+b['oy_back']; BR.append((b,x0,y0)); OBST+=[(x0+a,y0+c,r) for a,c,r in b['foam']]
            WA=water6.Water(s.water,s.flow,obstacles=OBST,lilies=s.lilies,natural=s.natural)
            img.alpha_composite(v6pieces.beach_layer(WA.beach,WA.surf,W*16,H*16))
            for b,x0,y0 in BR:
                WA.add_shade(x0,y0,b['shade']); WA.add_band(x0+6,x0+b['W']-6,y0+b['refl_y'],y0+b['refl_y']+4,0.62); WA.add_reflection(b['reflect'],x0,y0+b['refl_y'])
            for i,(k,bx,by) in enumerate(s.boats):
                sp=BOAT[k]; WA.add_boat(bx*16+sp.width//2,by*16+sp.height-5,sp.width*0.42,(i*3)%8)
                fl=sp.transpose(Image.FLIP_TOP_BOTTOM).crop((0,0,sp.width,min(14,sp.height)))
                WA.add_reflection(fl,bx*16,by*16+sp.height-2,alpha=0.22,dark=0.5)
            img.alpha_composite(Image.fromarray(WA.frame(0),'RGBA'))
            s.WA=WA
        for k,(k_,bx,by) in enumerate(s.boats):
            s.objs.append((BOAT[k_],bx*16,by*16,False))
        if max(max(r) for r in s.E)>0:
            tr=terrain.render(s.E,s.mas,s.stairs,s.falls,frame=0); img.alpha_composite(tr)
        if s.wall:
            img.alpha_composite(pn.townwall(s.wall,gates=s.gates,face=lambda X,wy: castle6.ash(X,wy,1.0,seed=3)))
        for b,x0,y0 in BR:
            img.alpha_composite(b['back'],(x0,y0)); s.objs.append((b['front'],x0,y0,False))
        for im,x,y in s.ground: img.alpha_composite(im,(x,y))
        for x,y in s.reedcells:
            s.objs.append((roman.reeds(x*3+y),x*16+s.rng.randint(-3,3),y*16-10,False))
        mask=Image.new('L',img.size,0)
        for im,x,y,cast in s.objs:
            if cast and im.height>=40: mask.paste(255,(x+6,y+3),im.split()[3].point(lambda v:255 if v>128 else 0))
        SH=np.array(mask)>0
        A=np.array(img).astype(np.float64); A[SH,:3]=np.floor(A[SH,:3]*np.array((0.52,0.58,0.74))); img=Image.fromarray(A.astype(np.uint8),'RGBA')
        for im,x,y,c in sorted(s.objs,key=lambda o:o[2]+o[0].height): img.alpha_composite(im,(x,y)) if 0<=x and 0<=y and x+im.width<=img.width and y+im.height<=img.height else _clip(img,im,x,y)
        s.img=img; s.F=F
        return img
    # ---------- 통행·검사 ----------
    def walk(s,x,y):
        return 0<=x<s.W and 0<=y<s.H and s.lab[y][x] in WALKLAB and not s.blk[y][x]
    def grid(s):
        return [''.join('.' if s.walk(x,y) else '#' for x in range(s.W)) for y in range(s.H)]
    def bfs(s,start):
        seen={start}; q=deque([start])
        while q:
            x,y=q.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if (nx,ny) in seen or not s.walk(nx,ny): continue
                if s.E[ny][nx]!=s.E[y][x] and not (s.lab[ny][nx]=='stair' or s.lab[y][x]=='stair'): continue
                seen.add((nx,ny)); q.append((nx,ny))
        return seen
    def reach(s):
        rep={}
        for en in s.entrances:
            R=s.bfs(en)
            rep[str(en)]={k:(v in R) for k,v in {**s.targets,**s.doors}.items()}
        return rep
    def fill_patches(s,target=4,kinds=('bush','canopy','oak'),maxn=120,keep=()):
        """빈 잔디 덩이(4연결)가 target 칸을 넘으면 가장 안쪽 칸에 나무·관목 덩이를 심는다. 결정적. 문 주변·keep 칸은 피한다."""
        s.build_labels()
        avoid=set(keep); bad=set()
        for d in s.doors.values():
            for i in (-1,0,1):
                for j in (0,1): avoid.add((d[0]+i,d[1]+j))
        for n in range(maxn):
            e=[[s.lab[y][x]=='grass' and not s.cover[y][x] for x in range(s.W)] for y in range(s.H)]
            seen=set(); best=None
            for y in range(s.H):
                for x in range(s.W):
                    if e[y][x] and (x,y) not in seen:
                        st=[(x,y)]; seen.add((x,y)); cells=[]
                        while st:
                            a,b=st.pop(); cells.append((a,b))
                            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                                p=(a+dx,b+dy)
                                if 0<=p[0]<s.W and 0<=p[1]<s.H and e[p[1]][p[0]] and p not in seen: seen.add(p); st.append(p)
                        if len(cells)>target and (best is None or len(cells)>len(best)): best=cells
            if not best: return n
            cs=set(best)
            def depth(c):
                d=0
                while all((c[0]+i,c[1]+j) in cs for i in range(-d-1,d+2) for j in range(-d-1,d+2)): d+=1
                return d
            cand=[c for c in best if c not in avoid and c not in bad]
            if not cand: return n
            c=max(cand,key=lambda c:(depth(c),c[1],c[0]))
            m=len(best)
            k=kinds[(c[0]*5+c[1]*3+s.seed)%len(kinds)]
            if m<=9: k='bush'
            elif k=='oak' and c[1]<3: k='bush'
            import copy
            sv=(len(s.objs),copy.deepcopy(s.blk),copy.deepcopy(s.cover))
            s.tree(k,c[0],c[1])
            if not all(all(v.values()) for v in s.reach().values()):
                del s.objs[sv[0]:]; s.blk=sv[1]; s.cover=sv[2]; bad.add(c)
        return maxn
    def empty_report(s,extra_cover=()):
        """빈 바닥 = 잔디 그대로이고 물체 그림이 안 덮은 칸. 20x15 창 최대 비율과 4연결 덩이 최대 크기."""
        W,H=s.W,s.H
        e=[[s.lab[y][x]=='grass' and not s.cover[y][x] and (x,y) not in extra_cover for x in range(W)] for y in range(H)]
        best=0; at=None
        for y0 in range(0,H-14):
            for x0 in range(0,W-19):
                n=sum(e[y][x] for y in range(y0,y0+15) for x in range(x0,x0+20))/300
                if n>best: best=n; at=(x0,y0)
        seen=set(); big=0; bigat=None; patches=[]
        for y in range(H):
            for x in range(W):
                if e[y][x] and (x,y) not in seen:
                    st=[(x,y)]; seen.add((x,y)); n=0; cells=[]
                    while st:
                        a,b=st.pop(); n+=1; cells.append((a,b))
                        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                            p=(a+dx,b+dy)
                            if 0<=p[0]<W and 0<=p[1]<H and e[p[1]][p[0]] and p not in seen: seen.add(p); st.append(p)
                    patches.append((n,cells[0]))
                    if n>big: big=n; bigat=(x,y)
        patches.sort(reverse=True)
        tot=sum(map(sum,e))
        return dict(window_max=round(best,3),window_at=at,patch_max=big,patch_at=bigat,empty_cells=tot,share=round(tot/(W*H),3),patches_gt4=[p for p in patches if p[0]>4][:12])
    def save(s,out,extra=None):
        os.makedirs(out+'/parts',exist_ok=True)
        s.img.save(out+'/render-1x.png'); s.img.resize((s.img.width*2,s.img.height*2),Image.NEAREST).save(out+'/render-2x.png')
        g=dict(name=s.name,W=s.W,H=s.H,legend={'.':'걸음','#':'막힘'},rows=s.grid(),doors={k:list(v) for k,v in s.doors.items()},
               targets={k:list(v) for k,v in s.targets.items()},entrances=[list(e) for e in s.entrances],levels=s.E if max(max(r) for r in s.E)>0 else None)
        json.dump(g,open(out+'/grid.json','w'),ensure_ascii=False)
        for n,im,note,tiles in s.parts: im.save(f'{out}/parts/{n}.png')
        tot=sum(t for *_,t in s.parts)
        with open(out+'/parts.md','w') as f:
            f.write(f'# {s.name} — 새로 찍은 조각\n\n같은 팔레트(버들항 칩셋 6단 명암 + 윤곽)·3/4·왼쪽 위 빛으로 Python/Pillow 로 손 도트. 이 표의 칸 수는 그림이 덮는 16px 칸 수.\n\n| 파일 | 내용 | 크기 px | 칸 |\n|---|---|---|---|\n')
            for n,im,note,tiles in s.parts: f.write(f'| parts/{n}.png | {note} | {im.width}x{im.height} | {tiles} |\n')
            f.write(f'\n조각 {len(s.parts)}종 · 합계 {tot}칸\n')
        return g
def _clip(img,im,x,y):
    img.alpha_composite(im.crop((max(0,-x),max(0,-y),min(im.width,img.width-x),min(im.height,img.height-y))),(max(0,x),max(0,y)))
def crops(img,out_prefix):
    """QA용 원 해상도 사분면 4장."""
    w,h=img.size; q=[]
    for i,(x,y) in enumerate(((0,0),(w//2,0),(0,h//2),(w//2,h//2))):
        c=img.crop((x,y,x+w//2,y+h//2)); c.save(f'{out_prefix}q{i}.png'); q.append(c)
    return q
def pieces_sheet(parts,out,scale=3,cols=6):
    """새 조각 시트."""
    if not parts: return None
    cw=max(p[1].width for p in parts)*scale+12; ch=max(p[1].height for p in parts)*scale+12
    rows=(len(parts)+cols-1)//cols
    sh=Image.new('RGBA',(cols*cw,rows*ch),(58,64,52,255))
    for i,(n,im,note,t) in enumerate(parts):
        b=im.resize((im.width*scale,im.height*scale),Image.NEAREST)
        sh.alpha_composite(b,((i%cols)*cw+6,(i//cols)*ch+ch-b.height-6))
    sh.save(out); return sh
