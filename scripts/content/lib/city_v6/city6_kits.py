# v5 landmarks, exec'd inside city6.py before the terraces: the royal castle (NW hill), the noble estate (north hill),
# the forum (temple front, stoa, cafe), the aqueduct on the temple mount, the windmills (body only; sails animate).
# Every kit piece placement is recorded in KIT[kit]['answer'] (piece id, cell x/y of its top-left, w, h, bottom).
KIT={'castle':dict(answer=[],bbox=(0,0,33,33)),'estate':dict(answer=[],bbox=(36,2,56,23)),'forum':dict(answer=[],bbox=(54,34,75,47))}
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
            if not (o is None or o=='plaza' or (ch=='B' and o=='water') or (ch in 'PGSW' and o=='road')):
                print('KRAW FAIL',kit,pid,x,y,(cx,cy),o); return False
    for cx,cy,ch in cells: occ[cy][cx]=ROLE.get(ch,name)
    (GROUNDOBJ if ground else objs).append((im,x*16+dx,y*16+dy,cast)); rec(kit,pid,x,y,max(len(r) for r in roles),len(roles),**({'layer':'ground'} if ground else {}))
    return True

import v6pieces
# ======================= castle (v6: pale ashlar + slate, symmetric on x=16, walkable kit) =======================
import kits6, castle6
CPAVE=grid(False)
def kobj(kit,pid,im,x,y,roles,name=None,ground=False,cast=True,door=None):
    # an image whose bottom sits on the last role row; roles give the cells it claims (upper overhang claims nothing)
    dy=len(roles)*16-im.height
    ok=kraw(kit,pid,im,x,y,roles,dy=dy,name=name,ground=ground,cast=cast)
    if ok and dy<0:                                        # the overhang: keep props out from under it
        for yy in range(y-(-dy+15)//16,y):
            for xx in range(x,x+max(len(r) for r in roles)): PROPBAN.add((xx,yy))
    if ok and door is not None:
        HOUSES.append((name or f'{kit}.{pid}.{x}.{y}',door[0],door[1])); KIT[kit]['answer'][-1]['door']=list(door)
    return ok
# palace on the rock (rows 3..10 claimed; its towers and roofs overhang the town wall rows 1-2)
pal=castle6.palace6()
kobj('castle','castle.palace',pal['im'],5,3,['#'*23]*7+['#'*11+'D'+'#'*11],name='palace',door=(16,10))
KIT['castle']['answer'][-1]['parts']=['wing 6 (2 storeys)','drum tower 3','centre block 5 (3 storeys, crow-stepped gable, great door)','drum tower 3','wing 6']
for y in range(1,12):                                     # rock top: pale flagstone court
    for x in range(4,29):
        if E[y][x]==3 and not F[y][x] and occ[y][x] not in ('wall',):
            CPAVE[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
P_('cg_topW',lambda: roman.topiary(1),4,3); P_('cg_topE',lambda: roman.topiary(2),28,3)
rec('castle','castle.terrace',4,11,25,1)
# the grand stair (terrain STAIRS (14,12,5)) is recorded for the answer array
rec('castle','castle.grand_stair',14,12,5,3,note='terrain stair through the ashlar rock face, on the palace door axis')
# south curtain: corner drum tower, wall, gate drum tower, gatehouse, gate drum tower, wall, corner drum tower
TW=castle6.tower6(3,body=80,cone=48,tiers=3)
for tx in (1,11,19,29):
    kobj('castle','castle.tower_round',TW,tx,19,['###']*4,name=f'ctower{tx}')
kobj('castle','castle.wall_h',castle6.wall_h6(7,seed=1,shields=(2,4),banners=((0,'slate'),(6,'slate'))),4,19,['W'*7,'#'*7,'#'*7,'#'*7],ground=True)
kobj('castle','castle.gatehouse',castle6.gatehouse6(),14,19,['#GGG#']*4,name='gatehouse',ground=True)
kobj('castle','castle.wall_h',castle6.wall_h6(7,seed=4,shields=(2,4),banners=((0,'slate'),(6,'slate'))),22,19,['W'*7,'#'*7,'#'*7,'#'*7],ground=True)
kobj('castle','castle.drawbridge',castle6.drawbridge6(3,3),15,23,['BBB']*3,cast=False)
kraw('castle','castle.wall_stair',kits6.wall_stair('R'),4,18,['SS'],ground=True)
kraw('castle','castle.wall_stair',kits6.wall_stair('L'),27,18,['SS'],ground=True)
# east curtain: the wall-walk along the river
kraw('castle','castle.wall_v',castle6.wall_v6(16),32,3,['W']*16,ground=True)
# bailey (level 2): stable in the west strip, smithy + barracks in the east strip, all ashlar + slate except the timber stable
st=roman.stable(3,seed=1); kp('castle','castle.stable',st['im'],1,7,name='cstable',door=0,above=st['above'])
h=castle6.castle_house(3,1,door=1,seed=2,chim=True); h['im']=signed(h['im'],h['door'],0,'smith')
if kp('castle','castle.smithy',h['im'],29,13,name='smithy',door=h['door'],chim=h['chim'],above=h['above']): SMOKEKIND['smithy']='dark'
h=castle6.castle_house(3,1,door=1,seed=5,chim=False); kp('castle','castle.barracks',h['im'],29,7,name='barracks',door=h['door'],above=0)
P_('c_anvil',pf.anvil,28,14); P_('c_hay',pi.P['건초더미'],1,12); P_('c_trough',pi.trough,2,9)
P_('c_well',pe.P['돌 우물'],1,15)
P_('c_target',V2('과녁'),6,17); P_('c_rack',pf.P['무기 거치대'],24,16)
for y in range(1,19):
    for x in range(1,32):
        if E[y][x]==2 and not F[y][x] and not water[y][x] and occ[y][x] not in ('walk','wall'):
            CPAVE[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
P_('c_knW',pf.P['기사 석상'],9,15); P_('c_knE',pf.P['기사 석상'],22,15)
rec('castle','castle.bailey',1,1,31,18)
# causeway: from the drawbridge south to the stair down to the main street, flanked by guardian statues
for y in range(26,30):
    for x in range(15,18): road[y][x]=True; occ[y][x]='road'
P_('c_guardW',pf.P['기사 석상'],13,27,allow=('rim',)); P_('c_guardE',pf.P['기사 석상'],18,27,allow=('rim',))
rec('castle','castle.causeway',15,26,3,4,note='paved approach: drawbridge -> causeway -> stair (15,30,3) -> main street; guardian statues at x13-14 and x18-19')
ANIM_EXTRA=[]

# ======================= estate (v6: one material set - stucco + terracotta tile, stone dressings) =======================
em_=grid(False)
for y in range(3,23): em_[y][37]=True; em_[y][55]=True
for x in range(37,56): em_[22][x]=True
for x in (43,44,45,46): em_[22][x]=False
wim=v6pieces.estate_wall([row[37:56] for row in em_[3:23]])
objs.append((wim,37*16,3*16,False))
for y in range(3,23):
    for x in range(37,56):
        if em_[y][x]: occ[y][x]='ewall'
rec('estate','estate.wall',37,3,19,20,material='stucco + terracotta coping')
kraw('estate','estate.gate',v6pieces.gate_pier6(),43,22,['#'],dy=-36); kraw('estate','estate.gate',v6pieces.gate_pier6(),46,22,['#'],dy=-36)
objs.append((roman.iron_gate(2,True),44*16,22*16-20,False)); rec('estate','estate.gate',44,22,2,1,part='iron_gate_open')
for x in (44,45): occ[22][x]='gate'
h=v6pieces.manor6(); kp('estate','estate.manor',h['im'],39,11,name='manor',door=h['door'],chim=h['chim'],above=h['above'],below=h['below'])
P_('e_field',lambda: pi.field('cabbage',3,3),52,3) and rec('estate','estate.kitchen',52,3,3,3)
st=v6pieces.tile_house(3,1,door=1,Rh=40,chim=False,carriage=True,seed=4); kp('estate','estate.coach_house',st['im'],52,11,name='estable',door=1,above=0)
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
st2=v6pieces.tile_house(3,1,door=1,Rh=40,chim=True,seed=7); kp('estate','estate.lodge',st2['im'],51,20,name='lodge',door=st2['door'],chim=st2['chim'],above=st2.get('above',0))
P_('e_well',pe.P['돌 우물'],38,14); P_('e_wood',pi.woodpile,38,16); P_('e_barrels',pf.barrels,40,18)
for y in range(12,22):
    for x in range(38,55):
        if E[y][x]==2 and occ[y][x]!='ewall':
            GRAVEL[y][x]=True
            if occ[y][x] in (None,'rim'): occ[y][x]='plaza'
rec('estate','estate.garden',38,12,17,10)

# ======================= forum (v6: squared-up temple / stoa / entrance arch on the chipset houses' view) =======================
kraw('forum','forum.stoa',v6pieces.stoa6(5,seed=2),55,35,['#####','#####','#####','#####','PPPPP'])
kobj('forum','forum.temple',v6pieces.temple6(7),61,35,['#######']*6+['##SSS##'],name='temple',door=(64,40))
for _x in (63,64,65): PROPBAN.add((_x,42))            # keep the foot of the temple stair clear
h=ph2.house('tim',6,1,shop=True,seed=31,door=2); cim=h['im'].copy()
aw=roman.awning(5,('red','cream')); cim.alpha_composite(aw,(8,cim.height-38))
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
if kp('forum','forum.cafe',cim,69,39,name='cafe',door=h['door'],chim=h['chim'],above=h.get('above',0),allow=('plaza',)): SMOKEKIND['cafe']='puffy'
CAFE=[]
for f_,cands,lab in ((lambda: roman.cafe_table(0),[(69,41)],'cafe_table'),(lambda: roman.cafe_parasol('leaf',2),[(72,42)],'cafe_parasol'),
                     (lambda: roman.cafe_table(3),[(69,44)],'cafe_table'),(roman.menu_board,[(68,40)],'menu_board'),
                     (lambda: roman.planter_box(1,1),[(74,40)],'planter_box')):
    im=f_(); fw,fh=-(-im.width//16),-(-im.height//16)
    for x,y in cands:
        if free(x,y,fw,fh,('plaza',)):
            mark('cafe_'+lab,x,y,fw,fh); objs.append((im,x*16,y*16,True)); CAFE.append((lab,x,y)); rec('forum','forum.'+lab,x,y,fw,fh); break
    else: print('cafe item skipped',lab,cands)
FOUNTAIN=(63,43)
if P_('fountain',lambda: pf.fountain(0),63,43): rec('forum','forum.fountain',63,43,3,3)
for i,(x,y) in enumerate(((60,42),(67,42))):
    if P_(f'f_statue{i}',lambda i=i: roman.statue_plinth(i%2,10+i),x,y): rec('forum','forum.statue',x,y,2,4)
kobj('forum','forum.gate',v6pieces.forum_gate6(),55,45,['#PPP#']*4,name='forum_gate')
for y in range(35,47):
    for x in range(55,75): FORUM[y][x]=plaza[y][x]
# ======================= windmill (v6: one tall tower mill, body in the base, sails animate) =======================
import v6pieces
if place('mill1',v6pieces.windmill_body6(),4,43,outline=False,door=2) is not False:
    o=objs[-1]; ox,oy=v6pieces.windmill_sail_offset(); WM.append((o[1]+ox,o[2]+oy))
    rec('forum','windmill',4,43-7,4,8,note='west meadow (windmill)')
