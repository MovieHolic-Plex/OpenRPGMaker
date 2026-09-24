# Leafless trees (잎 없는 나무) for the desert, volcano and snow climate sheets — hand-tuned pixel generator in the
# forest-village trunk palette, deterministic (fixed seeds), alpha 0/255 only.
# build-climate-chipsets.py bakes them into the same slots of all three sheets (FIRST = 2880, 30 columns, rows 96..100):
#   big 4×5 ×3 · mid 3×4 ×3 · small 2×3 ×3 · shrub 1×1 ×5 (see LAYOUT). Cells a tree does not draw on stay transparent
#   and are listed as -1 in the stamp (tiles), so a map never places them.
# Preview: python3 scripts/content/bare-trees.py desert /tmp/bare-desert.png
import math, random, sys
from PIL import Image
def hexc(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))+(255,)
PAL={
 # 사막: 햇볕에 바랜 마른 나무(회갈·뼈색)
 'desert':dict(o='3a2a1c',d='5e4632',m='8a6e52',l='b39a7a',h='d8c6a4'),
 # 화산: 그을린 나무 + 불씨 틈
 'volcano':dict(o='120c0a',d='241a16',m='3a2d27',l='57463c',h='7a6558',e='e0622a',e2='ffb04a'),
 # 숲(기본 갈색) — 겨울·가을 등 확장용
 'forest':dict(o='24170e',d='412a1c',m='634026',l='8c5e45',h='b08457'),
 # 설원: 짙은 나무 + 가지 위 눈
 'snow':dict(o='1c1612',d='3a2c22',m='5a4536',l='7d6552',h='9c8570',s='ffffff',s2='d6e4ee',c='8ea3b5'),
}
def grow(W,H,seed,kind='big',shrink=1.0):
    R=random.Random(seed)
    segs=[]  # (x0,y0,x1,y1,w)
    cx=W/2+R.uniform(-1.5,1.5); base=H-3
    if kind=='big':   trunkL,w0,depth,spread=H*0.31,5.5,4,0.6
    elif kind=='mid': trunkL,w0,depth,spread=H*0.31,4.0,4,0.52
    elif kind=='small':trunkL,w0,depth,spread=H*0.33,2.8,3,0.55
    else:             trunkL,w0,depth,spread=H*0.22,1.6,2,1.0   # shrub
    trunkL*=shrink; spread*=(0.6+0.4*shrink)
    lean=R.uniform(-0.18,0.18)
    def branch(x,y,ang,L,w,d):
        # 살짝 굽은 가지: 두 마디
        mid_ang=ang+R.uniform(-0.25,0.25)
        x1=x+math.sin(mid_ang)*L*0.5; y1=y-math.cos(mid_ang)*L*0.5
        x2=x1+math.sin(ang)*L*0.5; y2=y1-math.cos(ang)*L*0.5
        segs.append((x,y,x1,y1,w)); segs.append((x1,y1,x2,y2,max(0.8,w*0.85)))
        if d<=0 or L<3: return
        n=2 if R.random()<0.7 else 3
        for i in range(n):
            t=(i/(n-1)-0.5) if n>1 else 0
            a2=ang+t*2*spread+R.uniform(-0.2,0.2)
            branch(x2,y2,a2,L*R.uniform(0.62,0.78)*(1.0 if d>1 else 0.8),max(0.8,w*0.62),d-1)
        # 곁가지 하나
        if w>1.5 and R.random()<0.6:
            a3=ang+R.choice([-1,1])*R.uniform(0.7,1.1)
            branch(x1,y1,a3,L*0.45,max(0.8,w*0.45),min(1,d-1))
    if kind=='shrub':
        for i in range(5):
            a=(-1.0+i*0.5)+R.uniform(-0.15,0.15)
            L=H*R.uniform(0.45,0.7)
            x0=cx+(i-2)*0.6; y0=base+1
            x1=x0+math.sin(a)*L*0.55; y1=y0-math.cos(a)*L*0.55
            segs.append((x0,y0,x1,y1,1.3)); 
            for sg in (-1,1):
                a2=a+sg*R.uniform(0.35,0.6); L2=L*R.uniform(0.35,0.5)
                segs.append((x1,y1,x1+math.sin(a2)*L2,y1-math.cos(a2)*L2,0.8))
        return segs
    # 줄기: 밑동 넓게(세 토막 가늘어짐)
    x,y=cx,base; ang=lean
    for k in range(3):
        L=trunkL/3; w=w0*(1.45-0.25*k) if k==0 else w0*(1.1-0.1*k)
        x2=x+math.sin(ang)*L; y2=y-math.cos(ang)*L
        segs.append((x,y,x2,y2,w)); x,y=x2,y2; ang+=R.uniform(-0.12,0.12)
    n=3 if kind=='big' else 2
    for i in range(n):
        t=(i/(n-1)-0.5)
        branch(x,y,ang+t*2*spread+R.uniform(-0.15,0.15),trunkL*R.uniform(0.75,0.95),w0*0.7,depth-1)
    # 뿌리: 밑동에서 옆·아래로 짧게 휘어 땅을 짚음
    for sgn in (-1,1):
        for k in range(2 if kind=='big' else 1):
            L=R.uniform(3,5)*(1.3 if kind=='big' else 1.0)
            x0=cx+sgn*w0*0.35; y0=base-1-k
            x1=x0+sgn*L*0.7; y1=y0+1.5
            segs.append((x0,y0,x1,y1,max(1.4,w0*0.6)))
            segs.append((x1,y1,x1+sgn*L*0.5,y1+0.5,max(1.0,w0*0.3)))
    return segs
def fit(W,H,segs,margin=2):
    # 밑동(아래 가운데) 기준. 가로는 폭에 맞춰 누르고, 세로는 캔버스 높이를 채우도록 늘린다
    # (가로·세로 배율 차는 0.75~1.45 안에서만 — 가지 모양이 망가지지 않게)
    bx,by=W/2,H-3
    xs=[p for s in segs for p in (s[0],s[2])]; ys=[p for s in segs for p in (s[1],s[3])]
    kx=1.0
    if min(xs)<margin: kx=min(kx,(bx-margin)/(bx-min(xs)))
    if max(xs)>W-1-margin: kx=min(kx,(W-1-margin-bx)/(max(xs)-bx))
    ky=(by-margin)/(by-min(ys))
    ky=max(kx*0.8,min(ky,kx*1.25))
    ky=min(ky,(by-margin)/(by-min(ys)))
    f=lambda x,y:(bx+(x-bx)*kx, by+(y-by)*ky)
    return [(*f(a,b),*f(c,d),w) for a,b,c,d,w in segs]
def raster(W,H,segs):
    wood=[[0.0]*W for _ in range(H)]; hor=[[0.0]*W for _ in range(H)]
    for (x0,y0,x1,y1,w) in segs:
        hz=abs(x1-x0)/(math.hypot(x1-x0,y1-y0)+1e-6)
        n=int(max(abs(x1-x0),abs(y1-y0))*2)+2
        r=w/2
        for i in range(n+1):
            t=i/n; x=x0+(x1-x0)*t; y=y0+(y1-y0)*t
            for yy in range(int(y-r-1),int(y+r+2)):
                for xx in range(int(x-r-1),int(x+r+2)):
                    if 0<=xx<W and 0<=yy<H and (xx+0.5-x)**2+(yy+0.5-y)**2<=max(0.35,r*r):
                        
                        if w>=wood[yy][xx]: hor[yy][xx]=hz
                        wood[yy][xx]=max(wood[yy][xx],w)
    return wood,hor
def paint(W,H,seed,kind,pal):
    P={k:hexc(v) for k,v in PAL[pal].items()}
    wood,hor=raster(W,H,fit(W,H,grow(W,H,seed,kind)))
    img=Image.new('RGBA',(W,H),(0,0,0,0)); px=img.load()
    R=random.Random(seed*7+1)
    isw=lambda x,y: 0<=x<W and 0<=y<H and wood[y][x]>0
    for y in range(H):
        for x in range(W):
            w=wood[y][x]
            if not w: continue
            left=not isw(x-1,y); right=not isw(x+1,y); up=not isw(x,y-1)
            if w<1.3:   c='d' if (right or R.random()<0.5) else 'm'   # 잔가지
            elif right: c='d'
            elif left:  c='l' if w>=2 else 'm'
            else:       c='m'
            if w>=2 and left and up: c='h'
            # 나무껍질 결(줄기)
            if w>=3 and not left and not right and R.random()<0.22: c='d'
            px[x,y]=P[c]
    # 윤곽(굵은 부분만): 빈칸이 굵은 나무 옆이면 가장 짙은 색
    out=img.copy(); op=out.load()
    for y in range(H):
        for x in range(W):
            if wood[y][x]: continue
            nb=[wood[yy][xx] for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if 0<=xx<W and 0<=yy<H]
            if nb and max(nb)>=1.8: op[x,y]=P['o']
    img=out; px=img.load()
    # 기후 장식
    if pal=='volcano':
        for y in range(H):
            for x in range(W):
                if wood[y][x]>=2.5 and px[x,y][:3]==P['m'][:3] and R.random()<0.10:
                    px[x,y]=P['e']
                    if y+1<H and wood[y+1][x]>=2.5 and R.random()<0.5: px[x,y+1]=P['e2']
    if pal=='snow':
        # 가지 윗면에 눈: 흰 눈 한 줄(굵은 곳은 두 줄) + 그 위 푸른 회색 윤곽 → 눈밭 위에서도 보인다
        cap=set()
        for y in range(1,H):
            for x in range(W):
                if wood[y][x]>=1.2 and hor[y][x]>=0.55 and not isw(x,y-1):
                    cap.add((x,y-1))
                    if wood[y][x]>=3 and y-2>=0 and not isw(x,y-2): cap.add((x,y-2))
        for (x,y) in cap: px[x,y]=P['s']
        for (x,y) in cap:
            if (x,y+1) not in cap and isw(x,y+1) and wood[y+1][x]>=2.2: px[x,y+1]=P['s2']
            for xx,yy in ((x,y-1),(x-1,y),(x+1,y)):
                if 0<=xx<W and 0<=yy<H and (xx,yy) not in cap and not isw(xx,yy): px[xx,yy]=P['c']
    return img
SIZES={'big':(64,80),'mid':(48,64),'small':(32,48),'shrub':(16,16)}
# ── sheet layout (same tile numbers on every climate sheet) ──
FIRST = 2880; COLS = 30
PALETTE = {'desert': 'desert', 'volcano': 'volcano', 'snow': 'snow'}
SEEDS = {'big': [2, 3, 1], 'mid': [2, 3, 4], 'small': [2, 3, 4], 'shrub': [1, 2, 3, 4, 5]}
_ORIGIN = {'big': [(0, 0), (4, 0), (8, 0)], 'mid': [(12, 0), (15, 0), (18, 0)], 'small': [(21, 0), (23, 0), (25, 0)],
           'shrub': [(27, 0), (28, 0), (29, 0), (27, 1), (28, 1)]}
ROWS = 5  # rows 96..100 → every sheet with bare trees has (96 + ROWS) * 30 = 3030 cells
COUNT = FIRST + ROWS * COLS
MIN_PIXELS = 6  # a cell with fewer opaque pixels (a twig tip) is erased so the stamp stays compact

def _cells(im):
    W, H = im.size; a = im.split()[3].load()
    return [[sum(1 for y in range(16) for x in range(16) if a[tx * 16 + x, ty * 16 + y] > 0) for tx in range(W // 16)] for ty in range(H // 16)]

def layout():
    """[{id, kind, seed, w, h, col, row, tiles}] — tiles are row-major sheet numbers, -1 where the tree draws nothing
    on any climate (union of the three palettes, twig tips under MIN_PIXELS dropped)."""
    out = []
    for kind, seeds in SEEDS.items():
        w, h = SIZES[kind][0] // 16, SIZES[kind][1] // 16
        for n, (seed, (col, row)) in enumerate(zip(seeds, _ORIGIN[kind]), 1):
            counts = [_cells(paint(*SIZES[kind], seed, kind, pal)) for pal in PALETTE.values()]
            tiles = [((96 + row + dy) * COLS + col + dx) if max(c[dy][dx] for c in counts) >= MIN_PIXELS else -1
                     for dy in range(h) for dx in range(w)]
            out.append(dict(id=f"{kind}-{n}", kind=kind, seed=seed, w=w, h=h, col=col, row=row, tiles=tiles))
    return out

def bake(sheet, climate):
    """Copy of `sheet` grown to COUNT cells with this climate's leafless trees pasted into their slots."""
    out = Image.new('RGBA', (COLS * 16, (COUNT // COLS) * 16), (0, 0, 0, 0))
    out.paste(sheet.crop((0, 0, COLS * 16, min(sheet.height, FIRST // COLS * 16))), (0, 0))
    for st in layout():
        im = paint(*SIZES[st['kind']], st['seed'], st['kind'], PALETTE[climate])
        for k, t in enumerate(st['tiles']):
            if t < 0:  # erase twig tips in dropped cells
                dx, dy = k % st['w'], k // st['w']
                im.paste((0, 0, 0, 0), (dx * 16, dy * 16, dx * 16 + 16, dy * 16 + 16))
        out.alpha_composite(im, (st['col'] * 16, (96 + st['row']) * 16))
    return out

if __name__=='__main__':
    pal=sys.argv[1]; out=sys.argv[2]
    seeds=[int(s) for s in sys.argv[3:]] or [1,2,3]
    ims=[]
    for kind in ['big','mid','small','shrub']:
        for s in seeds: ims.append(paint(*SIZES[kind],s,kind,pal))
    Wt=sum(i.width+8 for i in ims); Ht=max(i.height for i in ims)
    sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0
    for i in ims: sheet.alpha_composite(i,(x,Ht-i.height)); x+=i.width+8
    sheet.save(out)
