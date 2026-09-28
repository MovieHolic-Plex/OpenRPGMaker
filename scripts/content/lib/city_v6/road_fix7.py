# v7 (exec'd in city6.py right after the props): the props may stand on the edge cells of a street, which left short stubs
# behind after the v4 audit had already run ("dead ends", 5 of them in the v6 QA plus a few more the audit never counted).
# Run the same audit once more over the final occupancy: every street end is run on into the next street (up to 5 cells)
# or cut back to the last junction / door front / bridge end. Then count what is left and put it in the stats.
_RL1=dict(ROADLOG)
exec(open(SRC+'/road_audit6.py').read())
ROADLOG['first_pass']=_RL1
_PH={(px_+i,shore[px_]-1) for px_ in (20,38,62,76) for i in (0,1)}       # the two cells that touch a pier head are destinations
_WK=('road','plaza','stair','bridge','walk','gate')
def _stub_prune():
    n=0; changed=True
    doorf={(dx,by+1) for _n,dx,by in HOUSES}
    while changed:
        changed=False
        for y in range(H):
            for x in range(W):
                if occ[y][x]!='road' or (x,y) in doorf or (x,y) in _PH: continue
                nb=[1 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<W and 0<=y+dy<H and occ[y+dy][x+dx] in _WK]
                if len(nb)<=1: occ[y][x]=None; road[y][x]=False; changed=True; n+=1
    return n
ROADLOG['stubs_pruned']=_stub_prune()
def _end_cells():
    doorf={(dx,by+1) for _n,dx,by in HOUSES}
    out=[]
    for y in range(H):
        for x in range(W):
            if occ[y][x]!='road' or (x,y) in doorf or (x,y) in _PH: continue
            nb=[1 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<W and 0<=y+dy<H and occ[y+dy][x+dx] in ('road','plaza','stair','bridge','walk','gate')]
            if len(nb)<=1: out.append((x,y))
    return out
ROADLOG['ends_left']=_end_cells()
print('v7 road ends left',ROADLOG['ends_left'])
_net=reach(); UNREACHED_AFTER=sum(1 for _n,dx,by in HOUSES if (dx,by+1) not in _net)
print('v7 unreached after road fix',UNREACHED_AFTER)
