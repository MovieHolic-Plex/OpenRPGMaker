# house plans beyond the straight range: L, T, U, back wing, corner tower. Every shape is still a grid of block names.
#   main range: width w, storeys s (roof rows R=3 for one storey, 4 for two)
#   wings: (col, 'S'|'N', proj) — a 3-wide cross wing at columns col..col+2
#       'S' comes toward the viewer: its roof runs from the main ridge down past the main eave and ends in a gable,
#           its own walls stand proj rows lower than the main walls
#       'N' goes away: only its roof shows, proj rows above the main ridge
#   tower: (col,) a 3-wide stone tower with a spire standing at that column, rising above the roof
import pj
from pj_demo import roofrows as RR, storeyrows as SR
def plan(st,w,s,wings=(),door=None,gs=None,tower=None,seed=0):
    gs=gs or st; R=3 if s==1 else 4; Hm=R+2*s
    pn=max([p for c,d,p in wings if d=='N']+[0]); ps=max([p for c,d,p in wings if d=='S']+[0])
    top=pn+(max(0,4+2*s+2-(R+2*s)-pn) if tower is not None else 0)
    ps=max(ps,1 if tower is not None else 0)   # a corner tower stands one row forward of the house front
    Ht=top+Hm+ps; grid=[['.']*w for _ in range(Ht)]
    y0=top
    covered=set()
    for c,d,p in wings:
        if d=='S': covered|={c,c+1,c+2}
    # main range
    roof=RR(st,w,None,R)
    for j,row in enumerate(roof):
        for i,n in enumerate(row.split()): grid[y0+j][i]=n
    # main walls: door on an uncovered column, windows on plain columns not next to it (house-form rules)
    free=[i for i in range(1,w-1) if i not in covered]
    d=door if door is not None else free[len(free)//2]
    def kinds(upper):
        k=['l']+['p']*(w-2)+['r']
        for i in range(1,w-1):
            if i in covered: continue
            if not upper and i==d: k[i]='d'
            elif not upper and abs(i-d)==1: k[i]='m' if (st=='tim' and i<d) else ('n' if st=='tim' else 'p')
            else: k[i]='w' if (i%2==(d%2) if not upper else i%2==1) else ('p' if st!='tim' else ('m' if i<w//2 else 'n'))
        return ''.join(k)
    rows=(SR(st,kinds(True),'eave','jetty')+SR(gs,kinds(False),'plain','base')) if s==2 else SR(gs,kinds(False),'eave','base')
    for j,row in enumerate(rows):
        for i,n in enumerate(row.split()): grid[y0+R+j][i]=n
    nf=max(1,(R+1)//2); nb=R-nf; over=[]
    # north wings: roof above the main ridge (the main roof is drawn over them)
    for c,dn,p in wings:
        if dn!='N': continue
        for j in range(p+nb):
            for i in range(3): over.append((f'{st}.nwing{p}_{nb}.{j}{i}',c+i,y0-p+j))
    # south wings: roof from the main ridge down, gable, then walls
    for c,dn,p in wings:
        if dn!='S': continue
        rr=R+p-nb   # the wing starts at the main ridge; over the main front slope only its valley triangle shows
        for j in range(rr):
            for i in range(3):
                n=f'{st}.vwing{rr}.{j}{i}'
                if j<nf: over.append((n,c+i,y0+nb+j))
                else: grid[y0+nb+j][c+i]=n
        wk='lwr' if s==1 else 'lwr'
        wrows=(SR(st,'lwr','eave','jetty')+SR(gs,'lwr','plain','base')) if s==2 else SR(gs,'lwr','eave','base')
        for j,row in enumerate(wrows):
            for i,n in enumerate(row.split()): grid[y0+nb+rr+j][c+i]=n
    if tower is not None:
        c=tower; t=[[f'sto.spire.{j}{i}' for i in range(3)] for j in range(4)]
        # tower: its own storeys, one row taller than the house front and standing one row forward of it,
        # so its base line, its side wall edge against the house and its pyramid read as a separate volume
        tw=[r.split() for r in SR('sto','lwr','eave','jetty')+SR('sto','lwr','plain','jetty')+SR('sto','lwr','plain','base')]
        tw.insert(len(tw)-2,'sto.u.l.plain sto.u.p.plain sto.u.r.plain'.split())
        body=t+tw; yb=y0+Hm-(len(body)-1)
        for j,row in enumerate(body):
            for i,n in enumerate(row): grid[yb+j][c+i]=n
    return [' '.join(r) for r in grid],over
def image(plan_):
    rows,over=plan_ if isinstance(plan_,tuple) else (plan_,())
    return pj.outlined(pj.assemble(rows,pj_L(),over))
_L=[None]
def pj_L():
    if _L[0] is None: _L[0]=pj.library()
    return _L[0]
SHAPES={
 'ㄴ자 (오른쪽 날개가 앞으로)':dict(st='tim',w=7,s=2,wings=[(4,'S',2)],gs='sto'),
 'ㄱ자 거울 (왼쪽 날개, 돌집)':dict(st='sto',w=7,s=1,wings=[(0,'S',2)]),
 'T자 (가운데 날개)':dict(st='tim',w=9,s=1,wings=[(3,'S',2)]),
 'ㄷ자 (양쪽 날개 · 앞마당)':dict(st='sto',w=11,s=2,wings=[(0,'S',3),(8,'S',3)],gs='sto'),
 '뒤로 뻗은 날개 (ㅗ 뒤집힘)':dict(st='tim',w=8,s=1,wings=[(2,'N',2)]),
 '모퉁이 탑 달린 집':dict(st='tim',w=7,s=2,wings=[],gs='sto',tower=4),
}
