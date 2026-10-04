# v4 compose + automatic checks.
# map dict: plan, floor, wall, zones[(x0,y0,x1,y1,floor,wall)], items[(F,x,y[,on])], lights, rooms[(name,x,y)], clear[(x,y)]
# checks: passage (BFS from the entrance reaches every room and every piece's use cell; nothing blocks a doorway or
# corridor), one wall material per continuous wall, hangings on the upper face row only and never overlapping each other
# or a tall piece, wall furniture only in front of a north wall face.
import sys; sys.path.insert(0,'/tmp/j8v5')
from PIL import Image
import room2, tiles4
import anim4
from mat import G, Pix
N=anim4.N
def good_img(name,t=0):
    if name in anim4.GA: return anim4.GA[name][t%N]
    f,a,b=G[name]; p=Pix(a,b); f(p,0,0); return p.im
def item_bbox(f,x,y):
    X0,Y0,X1,Y1=item_rect(f,x,y); bb=f.im.getbbox() or (0,0,0,0)
    return (X0+bb[0],Y0+bb[1],X0+bb[2],Y0+bb[3])
def item_rect(f,x,y):
    if f.kind=='hang': return (x*16,y*16+2,x*16+f.im.width,y*16+2+f.im.height)
    if f.kind=='flat': return (x*16,y*16,x*16+f.im.width,y*16+f.im.height)
    return (x*16,y*16-f.up,x*16+f.im.width,y*16-f.up+f.im.height)
def compose(m,t=0):
    room2.CEIL=m.get('ceil'); base=room2.render(m['plan'],m['floor'],m['wall'],m.get('zones',())); room2.CEIL=None; px=base.load()
    for (wx,wy) in m.get('lights',()):
        for Y in range((wy+2)*16,(wy+4)*16):
            sh=(Y-(wy+2)*16)//3
            for X in range(wx*16+2+sh,wx*16+14+sh):
                if X<base.width and Y<base.height:
                    r,g,b,a=px[X,Y]; px[X,Y]=(min(255,int(r*1.18+8)),min(255,int(g*1.16+8)),min(255,int(b*1.1+6)),a)
    draw=[]
    for it in m['items']:
        f,x,y=it[:3]; on=it[3] if len(it)>3 else ()
        im=f.frames[t%len(f.frames)] if getattr(f,'frames',None) else f.im
        X,Y,_,_=item_rect(f,x,y)
        key=y*16 if f.kind=='hang' else (-1 if f.kind=='flat' else (y+f.fh)*16)
        layer=Image.new('RGBA',im.size); layer.alpha_composite(im)
        if on:
            x0,y0,x1,y1=f.surf
            for g,fx,fy in on:
                gi=good_img(g,t); gx=int(x0+fx*(x1-x0)-gi.width/2); gy=int(y0+fy*(y1-y0)-gi.height+1)
                layer.alpha_composite(gi,(max(0,min(layer.width-gi.width,gx)),max(0,gy)))
        draw.append((key,layer,X,Y))
    for _,im,X,Y in sorted(draw,key=lambda d:d[0]): base.alpha_composite(im,(X,Y))
    return base
def animate(m,out,scale=2):
    fr=[compose(m,t) for t in range(N)]
    big=[f.resize((f.width*scale,f.height*scale),Image.NEAREST).convert('RGB') for f in fr]
    big[0].save(out,save_all=True,append_images=big[1:],duration=anim4.MS,loop=0,lossless=True)
    return fr
# ---------------- checks ----------------
SEATS=('chair','stool','bar stool','armchair','sofa','bench','pew','theater seat','choir stall')
BEDS=('bed','canopy bed','straw bed','cradle')
def fid(f): return getattr(f,'id','') or ''
def is_seat(f): return any(fid(f).startswith(s) for s in SEATS)
def is_bed(f): return any(fid(f).startswith(b) for b in BEDS) or 'bed' in fid(f).split(':')[0].split(' ')
def is_stairs_up(f): return fid(f).startswith('stairs up')
def is_stairs_down(f): return getattr(f,'stairs',None)=='down' or fid(f).startswith('stairwell')
def cells_of(f,x,y):
    if getattr(f,'cells',None): return [(x+a,y+b) for a,b in f.cells]
    return [(xx,yy) for yy in range(y,y+f.fh) for xx in range(x,x+f.fw)]
def check(m):
    W,Hh,g,face,top,inn=room2.analyse(m['plan'])
    floor=[[g[y][x] and not face[y][x] for x in range(W)] for y in range(Hh)]
    def fl(x,y): return 0<=x<W and 0<=y<Hh and floor[y][x]
    occ={}; issues=[]
    for i,it in enumerate(m['items']):
        f,x,y=it[:3]
        if f.kind in ('floor','wall'):
            for xx,yy in cells_of(f,x,y):
                if True:
                    if not fl(xx,yy) and not is_stairs_up(f): issues.append(f'{fid(f)} @({x},{y}) 발밑 ({xx},{yy}) 이 바닥이 아님')
                    if (xx,yy) in occ: issues.append(f'{fid(f)} @({x},{y}) 가 {fid(m["items"][occ[(xx,yy)]][0])} 와 겹침')
                    occ[(xx,yy)]=i
        if is_stairs_down(f):
            for yy in range(y,y+f.fh):
                for xx in range(x,x+f.fw): occ[(xx,yy)]=i
    walk=[[fl(x,y) and (x,y) not in occ for x in range(W)] for y in range(Hh)]
    # entrance: inside cells on the bottom row, or the given start (upper floors: the stair landing)
    start=m.get('start') or [(x,Hh-1) for x in range(W) if fl(x,Hh-1)]
    seen=set(); q=[s for s in start if walk[s[1]][s[0]]]; seen.update(q)
    while q:
        x,y=q.pop()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            X,Y=x+dx,y+dy
            if 0<=X<W and 0<=Y<Hh and walk[Y][X] and (X,Y) not in seen: seen.add((X,Y)); q.append((X,Y))
    # doorways/corridors: floor cells in a <=2-wide through passage (vertical) or a <=3-tall one (horizontal)
    # doorways, read off the plan: a gap in an E-W partition ('#' run in a row, inside above and below) and the two
    # floor rows under it; a gap in an N-S partition (a '#' column, inside W and E) = its walkable row; the street door
    P=m['plan']
    def ch(x,y): return P[y][x] if 0<=y<Hh and 0<=x<len(P[y]) else '#'
    def ins(x,y): return ch(x,y)!='#'
    passage=set()
    for y in range(1,Hh):
        x=0
        while x<W:
            if ins(x,y) and not ins(x-1,y):
                x0=x
                while ins(x,y): x+=1
                if x-x0<=2 and not ins(x,y) and all(ins(xx,y-1) and (y==Hh-1 or ins(xx,y+1)) for xx in range(x0,x)):
                    for xx in range(x0,x):
                        for yy in range(y,min(Hh,y+3)):
                            if fl(xx,yy) and not (fl(x0-1,yy) or fl(x,yy)): passage.add((xx,yy))
            else: x+=1
    for x in range(1,W-1):
        y=0
        while y<Hh:
            if ins(x,y) and not ins(x,y-1):
                y0=y
                while ins(x,y): y+=1
                if y-y0<=3 and not ins(x,y) and all(ins(x-1,yy) and ins(x+1,yy) for yy in range(y0,y)):
                    for yy in range(y0,y):
                        if fl(x,yy): passage.add((x,yy))
            else: y+=1
    clear=set(passage)
    for (x,y) in list(passage):
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if fl(x+dx,y+dy): clear.add((x+dx,y+dy))
    for s in start: clear.add(tuple(s))
    clear.update(tuple(c) for c in m.get('clear',()))
    for c in sorted(clear):
        if c in occ: issues.append(f'통로/문 칸 {c} 을 {fid(m["items"][occ[c]][0])} 가 막음')
    # rooms = floor components once the passages are cut out
    comp={}; rooms=[]
    for y in range(Hh):
        for x in range(W):
            if fl(x,y) and (x,y) not in passage and (x,y) not in comp:
                k=len(rooms); cells=[(x,y)]; comp[(x,y)]=k; st=[(x,y)]
                while st:
                    a,b=st.pop()
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        A,B=a+dx,b+dy
                        if fl(A,B) and (A,B) not in passage and (A,B) not in comp: comp[(A,B)]=k; cells.append((A,B)); st.append((A,B))
                rooms.append(cells)
    names={}
    for nm,x,y in m.get('rooms',()):
        if (x,y) in comp: names[comp[(x,y)]]=nm
    room_res=[]
    for k,cells in enumerate(rooms):
        if len(cells)<=2 and k not in names: continue
        ok=any(c in seen for c in cells)
        room_res.append({'room':names.get(k,f'구역{k}'),'cells':len(cells),'reached':ok})
        if not ok: issues.append(f'방 {names.get(k,k)} 에 닿지 못함')
    # use cells
    def reach(c): return c in seen
    def seat_ok(c):
        if c not in occ: return False
        f=m['items'][occ[c]][0]
        return is_seat(f) and any(reach((c[0]+dx,c[1]+dy)) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
    uses=[]; usecells=set()
    for i,it in enumerate(m['items']):
        f,x,y=it[:3]
        if f.kind in ('hang',) : continue
        if f.kind=='flat' and not is_stairs_down(f): continue
        if getattr(f,'use',None)=='none': continue
        fp=cells_of(f,x,y)
        around=[(a+dx,b+dy) for a,b in fp for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if (a+dx,b+dy) not in fp]
        south=[(xx,y+f.fh) for xx in range(x,x+f.fw)]; north=[(xx,y-1) for xx in range(x,x+f.fw)]
        role=getattr(f,'role',None)
        if is_stairs_up(f): need=[('계단 아래칸',south)]
        elif is_stairs_down(f): need=[('계단 입구',south)]
        elif role=='counter': need=[('손님 쪽',south),('주인 쪽',north)]
        elif is_seat(f): need=[('앉는 칸 옆',around)]
        elif is_bed(f): need=[('침대 옆',[c for c in around if c[1]>=y])]
        elif f.kind=='wall': need=[('앞',south)]
        else: need=[('옆',around)]
        res=True
        for label,cells in need:
            ok=any(reach(c) for c in cells) or any(seat_ok(c) for c in cells)
            for c in cells:
                if reach(c): usecells.add(c)
            if not ok: res=False; issues.append(f'{fid(f)} @({x},{y}) 의 {label} 칸에 닿지 못함')
        uses.append(res)
    # hangings: upper face row, no overlap with each other or with tall pieces; wall pieces in front of a face
    hangs=[]; talls=[]
    for it in m['items']:
        f,x,y=it[:3]
        if f.kind=='hang' and getattr(f,'frame',False):
            # a door frame / arch: drawn round a doorway gap, so only the columns beside the gap must be wall face
            if not any(0<=y<Hh and g[y][xx] and face[y][xx]==1 for xx in range(x,x+f.fw)): issues.append(f'문틀 {fid(f)} @({x},{y}) 옆에 벽면이 없음')
            continue
        if f.kind=='hang':
            for xx in range(x,x+f.fw):
                if not (0<=y<Hh and g[y][xx] and face[y][xx]==1): issues.append(f'걸이 {fid(f)} @({x},{y}) 가 벽면 윗줄이 아님')
            hangs.append((fid(f),item_bbox(f,x,y)))
        elif f.kind=='wall':
            for xx in range(x,x+f.fw):
                if not (y>0 and face[y-1][xx]==2) and not is_stairs_up(f): issues.append(f'벽 가구 {fid(f)} @({x},{y}) 뒤에 북쪽 벽면이 없음')
            talls.append((fid(f),item_bbox(f,x,y)))
        elif f.up>0: talls.append((fid(f),item_bbox(f,x,y)))
    def ov(a,b): return a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3]
    for i,(na,ra) in enumerate(hangs):
        for nb,rb in hangs[i+1:]:
            if ov(ra,rb): issues.append(f'걸이 {na} 와 {nb} 가 겹침')
        for nb,rb in talls:
            if ov(ra,rb): issues.append(f'걸이 {na} 가 {nb} 에 가려짐')
    # one wall material per continuous wall (a run of upper face cells)
    def wmat(x,y):
        w=m['wall']
        for x0,y0,x1,y1,ff,ww in m.get('zones',()):
            if x0<=x<=x1 and y0<=y<=y1 and ww: w=ww
        return w
    for y in range(Hh):
        x=0
        while x<W:
            if g[y][x] and face[y][x]==1:
                x0=x; ms=set()
                while x<W and g[y][x] and face[y][x]==1: ms.add(wmat(x,y)); x+=1
                if len(ms)>1: issues.append(f'한 벽({x0}..{x-1},{y})에 벽 재질이 섞임: {sorted(ms)}')
            else: x+=1
    for y in range(Hh):
        for x in range(W):
            if walk[y][x] and (x,y) not in seen: issues.append(f'빈 바닥 ({x},{y}) 이 가구에 갇혀 닿지 못함')
    # answer grid
    rows=[]
    for y in range(Hh):
        r=''
        for x in range(W):
            c=(x,y)
            if not g[y][x]: ch='#'
            elif face[y][x]: ch='='
            elif c in occ: ch='S' if (is_stairs_up(m['items'][occ[c]][0]) or is_stairs_down(m['items'][occ[c]][0])) else 'X'
            elif tuple(c) in set(map(tuple,start)): ch='D'
            elif c in clear: ch='c'
            elif c in usecells: ch='u'
            else: ch='.' if c in seen else ','
            r+=ch
        rows.append(r)
    return {'ok':not issues,'issues':issues,'rooms':room_res,'usesOk':sum(uses),'usesTotal':len(uses),
            'reachableCells':len(seen),'floorCells':sum(map(sum,floor)),'mustClear':sorted(clear),'grid':rows,
            'legend':{'#':'벽·천장(못 감)','=':'벽면(못 감)','.':'걸을 수 있음','X':'가구(막힘)','c':'비워 둘 칸(문·통로)','u':'사용 칸(가구 앞·옆)','S':'계단(층 이동)','D':'출입구/시작',',':'닿지 못하는 바닥'}}
