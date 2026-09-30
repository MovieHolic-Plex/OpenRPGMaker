# v4 road audit (exec'd in city4.py after the doors are joined): every street must end at something — a square, a stair,
# a bridge, a gate or a house door. A dead end first tries to run on straight (up to 5 cells over free same-level ground)
# into another street; if it cannot, it is cut back to the last junction or door. Street pieces left unconnected to the
# town network are removed.
from collections import deque as _dq2
ROADLOG={'extended':0,'pruned_cells':0,'islands_removed':0}
_DF={(dx,by+1) for _n,dx,by in HOUSES}
_GATEADJ={(gx,gy+k) for gx,gy in GATES for k in (1,2,3)}
def _walk(x,y): return 0<=x<W and 0<=y<H and occ[y][x] in ('road','plaza','stair','bridge')
for gx,gy in GATES:                                   # the gate passage runs down to the first street
    for yy in range(gy+1,gy+8):
        if occ[yy][gx] in ('road','plaza'): break
        if occ[yy][gx] in (None,'rim','wall'): occ[yy][gx]='road'; road[yy][gx]=True; ROADLOG['extended']+=0
changed=True; _it=0
while changed and _it<60:
    changed=False; _it+=1
    for y in range(H):
        for x in range(W):
            if occ[y][x]!='road' or (x,y) in _DF or (x,y) in _GATEADJ: continue
            nb=[(x+dx,y+dy) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if _walk(x+dx,y+dy)]
            if len(nb)>=2:
                # a 2-wide street: a cell whose neighbours are only its twin across the street + one along is still an end
                continue
            done=False
            if len(nb)==1:
                dx,dy=x-nb[0][0],y-nb[0][1]
                for k in range(1,6):
                    cx,cy=x+dx*k,y+dy*k
                    if not (0<=cx<W and 0<=cy<H): break
                    if _walk(cx,cy):
                        if k>1:
                            for j in range(1,k):
                                occ[y+dy*j][x+dx*j]='road'; road[y+dy*j][x+dx*j]=True
                            ROADLOG['extended']+=1; done=True
                        break
                    if occ[cy][cx] not in (None,'rim') or E[cy][cx]!=E[y][x]: break
            if not done:
                occ[y][x]=None; road[y][x]=False; ROADLOG['pruned_cells']+=1
            changed=True
# ends of 2-wide streets: a 2x2 end block whose only way out is back along the street
def _ends2():
    n=0
    for y in range(H-1):
        for x in range(W-1):
            blk=[(x,y),(x+1,y),(x,y+1),(x+1,y+1)]
            if not all(occ[b][a]=='road' for a,b in blk) or any(c in _DF or c in _GATEADJ for c in blk): continue
            outs=set()
            for a,b in blk:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    c=(a+dx,b+dy)
                    if c not in blk and _walk(*c): outs.add((dx,dy))
            if len(outs)==1:                       # only one side leads on -> this is a blunt street end
                dx,dy=outs.pop(); ex=(-dx,-dy)
                far=[(a,b) for a,b in blk if (a-dx,b-dy) not in blk]
                ok=False
                for kk in range(1,6):              # first try to run the street on (both lanes) into another walk cell
                    cells=[(a+ex[0]*kk,b+ex[1]*kk) for a,b in far]
                    if not all(0<=a<W and 0<=b<H for a,b in cells): break
                    if any(_walk(a,b) for a,b in cells):
                        for j in range(1,kk):
                            for a,b in far:
                                c=(a+ex[0]*j,b+ex[1]*j); occ[c[1]][c[0]]='road'; road[c[1]][c[0]]=True
                        ok=kk>1; break
                    if any(occ[b][a] not in (None,'rim') or E[b][a]!=E[far[0][1]][far[0][0]] for a,b in cells): break
                if ok: ROADLOG['extended']+=1; n+=1; continue
                for a,b in blk:
                    if (a-dx,b-dy) not in blk:     # the far row of the block
                        occ[b][a]=None; road[b][a]=False; n+=1
    return n
for _ in range(40):
    k=_ends2(); ROADLOG['pruned_cells']+=k
    if not k: break
# bulges: 1-2 cell deep stubs sticking out of the side of a street (left over from jogged street pieces)
def _bulges():
    n=0
    for y in range(1,H-1):
        for x in range(1,W-1):
            if occ[y][x]!='road' or (x,y) in _DF or (x,y) in _GATEADJ: continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                # street runs along the axis perpendicular to (dx,dy); (x,y) sticks out opposite to (dx,dy)
                ax=(dy,dx)
                base=(x+dx,y+dy)
                if not _walk(*base): continue
                if not (_walk(base[0]+ax[0],base[1]+ax[1]) and _walk(base[0]-ax[0],base[1]-ax[1])): continue
                out=(x-dx,y-dy)
                if _walk(*out) and not (occ[out[1]][out[0]]=='road' and not _walk(out[0]-dx,out[1]-dy) and all(not _walk(out[0]+s_*ax[0],out[1]+s_*ax[1]) for s_ in (1,-1))): continue
                side=[(x+s_*ax[0],y+s_*ax[1]) for s_ in (1,-1)]
                twins=[c for c in side if _walk(*c)]
                if len(twins)>1: continue
                if twins:
                    t=twins[0]
                    if not _walk(t[0]+dx,t[1]+dy): continue
                    far=(t[0]+(t[0]-x),t[1]+(t[1]-y))
                    if _walk(*far) or _walk(t[0]-dx,t[1]-dy): continue
                cells=[(x,y)]+([out] if _walk(*out) else [])
                if any(c in _DF for c in cells): continue
                for a,b in cells: occ[b][a]=None; road[b][a]=False; n+=1
                break
    return n
for _ in range(6):
    k=_bulges(); ROADLOG['pruned_cells']+=k; ROADLOG['bulges']=ROADLOG.get('bulges',0)+k
    if not k: break
# islands
seen={(62,33)}; q=_dq2([(62,33)])
while q:
    cx,cy=q.popleft()
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        n_=(cx+dx,cy+dy)
        if n_ not in seen and _walk(*n_): seen.add(n_); q.append(n_)
for y in range(H):
    for x in range(W):
        if occ[y][x]=='road' and (x,y) not in seen and (x,y) not in _DF: occ[y][x]=None; road[y][x]=False; ROADLOG['islands_removed']+=1
print('road audit',ROADLOG)
