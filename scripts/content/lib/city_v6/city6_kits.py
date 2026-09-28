# v5 landmarks, exec'd inside city6.py before the terraces: the royal castle (NW hill), the noble estate (north hill),
# the forum (temple front, stoa, cafe), the aqueduct on the temple mount, the windmills (body only; sails animate).
# Every kit piece placement is recorded in KIT[kit]['answer'] (piece id, cell x/y of its top-left, w, h, bottom).
KIT={'castle':dict(answer=[],bbox=(0,0,33,27)),'estate':dict(answer=[],bbox=(36,2,56,23)),'forum':dict(answer=[],bbox=(54,34,75,47))}
COURT=grid(False); GRAVEL=grid(False); FORUM=grid(False)
WM=[]; SMOKEKIND={}
def rec(kit,pid,x,y,w,h,**kw):
    d=dict(piece=pid,x=x,y=y,w=w,h=h); d.update(kw); KIT[kit]['answer'].append(d)
def kp(kit,pid,im,x,bottom,name=None,door=None,chim=(),above=0,below=0,cast=True,allow=(),outline=False):
    name=name or f'{kit}.{pid}.{x}.{bottom}'
    im=I(im); y=place(name,im,x,bottom,allow=allow,below=below,cast=cast,door=door,chim=chim,above=above,outline=outline)
    if y is False: print('KIT FAIL',kit,pid,x,bottom); return False
    fw=-(-(im.width-1)//16); rec(kit,pid,x,y,fw,bottom-y+1,**({'door':[x+door,bottom]} if door is not None else {}))
    return y
ROLE={'W':'walk','G':'gate','B':'bridge','S':'stair','P':'plaza'}
GROUNDOBJ=[]
def kraw(kit,pid,im,x,y,roles,dx=0,dy=0,cast=True,name=None,need=True,ground=False):
    # place an image whose cells are given by role rows; '#' = blocked (the piece's own name), '.' = untouched
    name=name or f'{kit}.{pid}.{x}.{y}'
    cells=[(x+i,y+j,ch) for j,row in enumerate(roles) for i,ch in enumerate(row) if ch!='.']
    if need:
        for cx,cy,ch in cells:
            o=occ[cy][cx]
            if not (o is None or o=='plaza' or (ch=='B' and o=='water')):
                print('KRAW FAIL',kit,pid,x,y,(cx,cy),o); return False
    for cx,cy,ch in cells: occ[cy][cx]=ROLE.get(ch,name)
    (GROUNDOBJ if ground else objs).append((im,x*16+dx,y*16+dy,cast)); rec(kit,pid,x,y,max(len(r) for r in roles),len(roles),**({'layer':'ground'} if ground else {}))
    return True

# ======================= castle =======================
import kits6
kp('castle','castle.tower_round',kits6.tower_round(3),2,9,outline=True)
h=kits6.palace(); kp('castle','castle.palace',h['im'],5,9,name='palace',door=h['door'],chim=h['chim'],above=h.get('above',0),outline=True)
kp('castle','castle.chapel',kits6.chapel(),16,9,name='chapel',door=1,outline=True)
# inner garden on the rock: hedges, topiary, a small fountain; the gravel paths are what is left
P_('cg_hedgeW',lambda: pz.hedge(3),3,10); P_('cg_topW',lambda: roman.topiary(1),7,10)
ANIM_EXTRA=[]
if P_('cg_fount',lambda: pz.fountain_small(0),13,10): ANIM_EXTRA.append(('fsmall',13*16,10*16))
P_('cg_hedgeE',lambda: pz.hedge(3),18,10); P_('cg_topE',lambda: roman.topiary(2),21,10); P_('cg_topE2',lambda: roman.topiary(5),15,10)
rec('castle','castle.garden',2,10,20,4)
for y in range(1,14):
    for x in range(2,22):
        if E[y][x]==3 and not F[y][x] and occ[y][x]!='wall':
            GRAVEL[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
# south curtain: SW round tower, wall, gatehouse, wall, SE round tower; drawbridge over the moat
kp('castle','castle.tower_round',kits6.tower_round(3),1,22,outline=True,allow=('rim',))
kraw('castle','castle.wall_h',kits6.wall_h(10),4,20,['W'*10,'#'*10,'#'*10],ground=True)
kraw('castle','castle.gatehouse',kits6.gatehouse(),14,20,['#WW#','#GG#','#GG#'],dy=-8,name='gatehouse',ground=True)
kraw('castle','castle.wall_h',kits6.wall_h(12,seed=3),18,20,['W'*12,'#'*12,'#'*12],ground=True)
kp('castle','castle.tower_round',kits6.tower_round(3),30,22,outline=True)
db=kits6.drawbridge(3); kraw('castle','castle.drawbridge',db,15,23,['BB','BB','BB'],dy=-14,cast=False)
# east curtain: square tower at the north end, wall-walk down to the SE tower
kraw('castle','castle.tower_sq',kits6.tower_sq(2,'red'),31,3,['##']*5)
kraw('castle','castle.wall_v',kits6.wall_v(8),32,8,['W']*8,ground=True)
# wall stairs from the bailey onto the south walk
kraw('castle','castle.wall_stair',kits6.wall_stair('R'),5,19,['SS'],ground=True)
kraw('castle','castle.wall_stair',kits6.wall_stair('L'),26,19,['SS'],ground=True)
# outer bailey buildings
h=ph2.house('sto',7,1,seed=5); kp('castle','castle.barracks',h['im'],23,7,name='barracks',door=h['door'],chim=h['chim'],above=h.get('above',0),outline=True)
st=roman.stable(6,seed=1); kp('castle','castle.stable',st['im'],23,13,name='cstable',door=0,above=st['above'])
h=ph2.house('sto',5,1,seed=12); h['im']=signed(h['im'],h['door'],0,'smith')
if kp('castle','castle.smithy',h['im'],25,18,name='smithy',door=h['door'],chim=h['chim'],above=h.get('above',0),outline=True): SMOKEKIND['smithy']='dark'
P_('c_anvil',pf.anvil,24,18); P_('c_hay',roman.hay_bales,29,11); P_('c_trough',pi.trough,29,13)
P_('c_well',pe.P['돌 우물'],29,9)
P_('c_target',V2('과녁'),2,16); P_('c_rack',pf.P['무기 거치대'],4,16)
P_('c_knW',pf.P['기사 석상'],7,16); P_('c_knE',pf.P['기사 석상'],15,16)
for y in range(3,20):
    for x in range(1,33):
        if E[y][x]==2 and not F[y][x] and not water[y][x] and occ[y][x] not in ('walk','wall') and not (x==1 and y<16):
            COURT[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
rec('castle','castle.bailey',1,3,32,17)

# ======================= estate =======================
em_=grid(False)
for y in range(3,23): em_[y][37]=True; em_[y][55]=True
for x in range(37,56): em_[22][x]=True
for x in (43,44,45,46): em_[22][x]=False
wim=ph.run([row[37:56] for row in em_[3:23]],ph.wall_cell); wim=I(wim)
objs.append((wim,37*16,3*16,False))
for y in range(3,23):
    for x in range(37,56):
        if em_[y][x]: occ[y][x]='ewall'
rec('estate','estate.wall',37,3,19,20)
kraw('estate','estate.gate',roman.gate_pier(),43,22,['#'],dy=-32); kraw('estate','estate.gate',roman.gate_pier(),46,22,['#'],dy=-32)
objs.append((roman.iron_gate(2,True),44*16,22*16-20,False)); rec('estate','estate.gate',44,22,2,1,part='iron_gate_open')
for x in (44,45): occ[22][x]='gate'
h=kits6.manor(); kp('estate','estate.manor',h['im'],39,11,name='manor',door=h['door'],chim=h['chim'],above=h['above'],below=0)
P_('e_field',lambda: pi.field('cabbage',3,3),52,3) and rec('estate','estate.kitchen',52,3,3,3)
st=roman.stable(3,seed=4); kp('estate','estate.stable',st['im'],52,11,name='estable',door=0,above=st['above'])
for (x,y) in ((38,4),(38,8)):
    im=roman.cypress(3,x+y)
    if free(x,y,1,3): mark('tree',x,y,1,3); objs.append((im,x*16,y*16,True))
P_('e_hedgeW',lambda: pz.hedge(2),41,13); P_('e_topW',lambda: roman.topiary(3),43,13)
P_('e_hedgeE',lambda: pz.hedge(2),47,13); P_('e_topE',lambda: roman.topiary(4),46,13)
P_('e_hedgeE2',lambda: pz.hedge(2),49,13)
if P_('e_fount',lambda: pf.fountain(0),40,15): EFOUNT=(40,15)
else: EFOUNT=None
P_('e_statue1',lambda: roman.statue_plinth(0,1),46,15); P_('e_statue2',lambda: roman.statue_plinth(1,2),49,15)
P_('e_carriage',roman.carriage,51,13)
st2=kits6.gate_lodge(); kp('estate','estate.lodge',st2['im'],51,20,name='lodge',door=st2['door'],chim=st2['chim'],above=st2.get('above',0))
P_('e_well',pe.P['돌 우물'],38,14); P_('e_wood',pi.woodpile,38,16); P_('e_barrels',pf.barrels,40,18)
for y in range(12,22):
    for x in range(38,55):
        if E[y][x]==2 and occ[y][x]!='ewall':
            GRAVEL[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
rec('estate','estate.garden',38,12,17,10)

# ======================= forum =======================
kraw('forum','forum.stoa',roman.stoa(5,seed=2),55,35,['#####','#####','#####','PPPPP'])
kp('forum','forum.temple',roman.temple_front(5),61,40,name='temple',door=2,allow=('plaza',),outline=False)
h=ph2.house('tim',8,1,shop=True,seed=31,door=2); cim=h['im'].copy()
aw=roman.awning(7,('red','cream')); cim.alpha_composite(aw,(8,cim.height-38))
import pz as _pz
def cafe_sign():
    c=_pz.C(20,20,seed=942); c.group(1); c.new()
    for x in range(0,19): c.tone(x,1,'iron',4 if x<10 else 3)
    c.line(1,6,7,2,'iron',3)
    c.group(2); c.box(4,4,14,1,13,'wood',front=0.55)
    for y in range(5,18): c.tone(4,y,'wood',4); c.tone(17,y,'wood',1)
    for x in range(4,18): c.tone(x,4,'wood',5); c.tone(x,17,'wood',1)
    rows,key=roman.SIGN_CAFE; c.group(3); c.new(); c.lit(rows,8,7,key)
    return _pz.fin(c)
cim.alpha_composite(cafe_sign(),((h['door']+1)*16+1,cim.height-44))
if kp('forum','forum.cafe',cim,67,39,name='cafe',door=h['door'],chim=h['chim'],above=h.get('above',0),allow=('plaza',)): SMOKEKIND['cafe']='puffy'
CAFE=[]
for f_,cands,lab in ((lambda: roman.cafe_table(0),[(67,41)],'cafe_table'),(lambda: roman.cafe_table(3),[(70,44),(67,44)],'cafe_table'),
                     (lambda: roman.cafe_parasol('leaf',2),[(71,41)],'cafe_parasol'),(lambda: roman.cafe_parasol('red',4),[(66,44),(70,44),(66,41)],'cafe_parasol'),
                     (roman.menu_board,[(66,40),(70,40)],'menu_board'),(lambda: roman.planter_box(1,1),[(74,41),(74,40)],'planter_box'),
                     (lambda: roman.planter_box(1,2),[(74,44),(74,43),(73,44),(74,42)],'planter_box'),(lambda: roman.planter_box(1,3),[(66,43),(66,40)],'planter_box')):
    im=f_(); fw,fh=-(-im.width//16),-(-im.height//16)
    for x,y in cands:
        if free(x,y,fw,fh,('plaza',)):
            mark('cafe_'+lab,x,y,fw,fh); objs.append((im,x*16,y*16,True)); CAFE.append((lab,x,y)); rec('forum','forum.'+lab,x,y,fw,fh); break
    else: print('cafe item skipped',lab,cands)
FOUNTAIN=(60,42)
if P_('fountain',lambda: pf.fountain(0),60,42): rec('forum','forum.fountain',60,42,3,3)
for i,(x,y) in enumerate(((57,40),(64,42))):
    if P_(f'f_statue{i}',lambda i=i: roman.statue_plinth(i%2,10+i),x,y): rec('forum','forum.statue',x,y,2,4)
for y in range(35,47):
    for x in range(55,75): FORUM[y][x]=plaza[y][x]
# ======================= aqueduct =======================
# the aqueduct brings water off the temple mount (east) into the town at the north gate road: an arcade over the
# gardens north of the 8th-row street, ending in a stone basin fountain by the gate road
AQ=roman.aqueduct(15,seed=3)
if kraw('forum','aqueduct',AQ,65,3,['.'*15,'.'*15,'.'*15,'#'*15],name='aqueduct'):
    for x in range(65,80):
        for y in (3,4,5): occ[y][x]='aqueduct'
    KIT['forum']['answer'][-1]['kit']='north town (aqueduct)'
    if P_('aq_basin',lambda: pz.fish_pool(0),64,7,allow=()): ANIM_EXTRA.append(('fpool',64*16,7*16))
# ======================= windmills (body in the base, sails animate) =======================
for nm,x,b in (('mill1',2,43),('mill2',6,42)):
    if place(nm,roman.windmill_body(),x,b,outline=True) is not False:
        o=objs[-1]; WM.append((o[1],o[2]))
