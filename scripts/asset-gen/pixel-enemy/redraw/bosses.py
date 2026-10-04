"""Eight individually rebuilt native96 bosses, painted from authored coordinates.

No input pictures. Body-part joints alter source vertices before rasterization;
fallen bodies are separately authored. Dragon relatives share only their anatomy
family, with distinct heads, limbs, wings, material and mass distribution.
"""
import math
from PIL import Image, ImageDraw

DESCRIPTIONS = {
 'dragon':'황토색 비늘과 청동빛 넓은 날개, 구부러진 두 뿔, 두꺼운 꼬리와 송곳니를 가진 용이다.',
 'dragon-red':'붉은 갑판 비늘과 뺨의 가시, 검붉은 날개막, 긴 송곳니를 드러낸 붉은 용이다.',
 'dragon-blue':'청푸른 비늘과 얼음빛 긴 뿔, 지느러미 같은 뺨과 넓은 푸른 날개를 가진 용이다.',
 'dragon-bone':'텅 빈 갈비뼈와 뼈 날개, 긴 두개골, 끊어진 꼬리 마디를 가진 뼈 용이다.',
 'wyvern-cliff':'자주빛 비늘과 뾰족한 부리형 주둥이, 팔 대신 큰 날개와 가시 꼬리를 가진 와이번이다.',
 'minotaur-maze':'갈색 털과 굵은 황소뿔, 콧고리, 붉은 허리천과 양날 도끼를 가진 미노타우로스다.',
 'troll-cave':'이끼빛 두꺼운 피부와 큰 코, 삐죽한 엄니, 거친 가죽 치마와 돌 몽둥이를 든 트롤이다.',
 'demon-lord':'자줏빛 피부와 검은 뿔, 붉은 박쥐날개, 금속 갑옷과 낫 모양 검을 가진 마왕이다.',
}

BASE=dict(o='172832',d='293b42',s='3f595b',m='638379',l='95b096',h='c5d1ae',
          b='564746',B='89715b',t='b49a72',T='e0c595',w='f2e5b7',
          r='512c3c',R='873e4b',q='ba6567',Q='e59c8a',a='b48142',A='edbf64',
          e='fae8a0',v='494358',V='786579',c='9b9391',C='c4c5b0')

BODY={'idle_a':(0,0),'idle_b':(0,1),'idle_c':(0,0),'windup':(-2,2),
      'move':(1,-2),'attack':(1,0),'recover':(-1,1),'hit':(-3,3),'dead':(0,0)}
HEAD={'idle_a':(0,0,0),'idle_b':(0,1,0),'idle_c':(-1,-1,-3),'windup':(-4,3,-6),
      'move':(1,-2,2),'attack':(2,2,6),'recover':(0,2,3),'hit':(-6,4,-10),'dead':(0,0,0)}

def rotate(x,y,pivot,a):
    u,v=x-pivot[0],y-pivot[1];r=math.radians(a)
    return pivot[0]+u*math.cos(r)-v*math.sin(r),pivot[1]+u*math.sin(r)+v*math.cos(r)

class Pen:
    def __init__(self,palette,pose,kind):
        self.im=Image.new('RGBA',(96,96));self.d=ImageDraw.Draw(self.im)
        self.colors={k:'#'+v for k,v in palette.items()};self.pose=pose;self.kind=kind;self.part='body'
    def point(self,p):
        x,y=p;pose=self.pose;part=self.part;dx,dy=BODY[pose]
        if pose not in ('idle_a','dead'):
            if part=='head':
                hx,hy,a=HEAD[pose];pivot=(65,33) if self.kind.startswith('dragon') or self.kind=='wyvern-cliff' else (51,28)
                x,y=rotate(x,y,pivot,a);x+=hx;y+=hy
            elif part in ('leg','farleg'):
                w=max(0,min(1,(y-64)/27));stride={'idle_b':0,'idle_c':1,'windup':-2,'move':5,'attack':4,'recover':2,'hit':-3}[pose]
                if part=='farleg':stride=-stride*.7
                x+=dx*(1-w)+stride*w;y+=dy*(1-w)-(3 if pose=='move' else 0)*w
            elif part in ('wing','farwing'):
                pivot=(43,49) if part=='wing' else (59,52)
                a={'idle_b':3,'idle_c':-2,'windup':-5,'move':4,'attack':4,'recover':2,'hit':10}[pose]
                if part=='farwing':a=-a*.5
                x,y=rotate(x,y,pivot,a);x+=dx;y+=dy
            elif part=='tail':
                w=max(0,min(1,(35-x)/29));bend={'idle_b':2,'idle_c':-2,'windup':3,'move':-4,'attack':-3,'recover':1,'hit':-4}[pose]
                x+=dx;y+=dy+w*bend
            elif part in ('arm','fararm'):
                w=max(0,min(1,(x-58)/29));a={'idle_b':(0,1),'idle_c':(-1,-2),'windup':(-8,-7),'move':(0,-4),'attack':(-31,-5),'recover':(-20,0),'hit':(-8,-6)}[pose]
                if part=='fararm':a=(-a[0]*.45,-a[1]*.6);w=max(0,min(1,(64-y)/22))
                x+=dx*(1-w)+a[0]*w;y+=dy*(1-w)+a[1]*w
            else:x+=dx;y+=dy
        x,y=round(x),round(y)
        assert 0<x<95 and 0<y<94,(self.kind,pose,part,(x,y))
        return x,y
    def poly(self,pts,c,edge=False):
        pts=[self.point(p) for p in pts];self.d.polygon(pts,fill=self.colors[c])
        if edge:self.d.line(pts+pts[:1],fill=self.colors['o'],width=1)
    def line(self,pts,c,w=1):self.d.line([self.point(p) for p in pts],fill=self.colors[c],width=w)
    def cluster(self,x,y,rows):
        for j,row in enumerate(rows):
            for i,c in enumerate(row):
                if c!='.':self.d.point(self.point((x+i,y+j)),fill=self.colors[c])

def dragon_palette(kind):
    p=dict(BASE)
    if kind=='dragon':p.update(d='3c3239',s='6b4d47',m='a67753',l='c69c69',h='dfc691',v='454c47',V='748269')
    if kind=='dragon-red':p.update(d='452e3e',s='713f49',m='ab514e',l='d67a61',h='ecaf7a',v='442b42',V='814756')
    if kind=='dragon-blue':p.update(d='263d54',s='355e79',m='4e8aab',l='82bdc8',h='bfddd8',v='344862',V='607d9c')
    if kind=='wyvern-cliff':p.update(d='302f43',s='4f455e',m='7e637b',l='a88c99',h='d5b8b0',v='3c3549',V='755668')
    return p

def talons(p,x,y,far=False):
    poly,line=p.poly,p.line
    for i in range(3):
        poly([(x+i*4,y),(x+i*4+3,y),(x+i*4+4,y+2),(x+i*4+3,y+3),(x+i*4-1,y+3)],'t' if far else 'w',True)
        line([(x+i*4,y),(x+i*4+2,y)],'T')

def dragon_head(p,kind):
    poly,line,cluster=p.poly,p.line,p.cluster
    long=kind=='wyvern-cliff';p.part='head'
    # Reverse horns, cheek-fin and craggy brow are distinct per relative.
    poly([(58,22),(50,12),(52,9),(58,13),(63,24)],'t',True)
    poly([(65,19),(62,9),(64,5),(69,10),(69,22)],'T',True)
    line([(64,7),(65,11),(68,17)],'w')
    if kind=='dragon-blue':
        poly([(55,25),(48,19),(49,28),(44,30),(51,34),(46,40),(57,40),(61,32)],'V',True)
        line([(49,23),(56,29),(47,31),(57,34),(50,38)],'h')
        poly([(60,19),(55,7),(60,10),(65,20)],'h',True)
    elif kind=='dragon-red':
        poly([(55,22),(46,20),(50,28),(44,32),(51,36),(49,42),(60,36)],'s',True)
        poly([(52,24),(49,20),(55,22),(59,28)],'h',True)
        poly([(49,32),(45,30),(53,31),(58,35)],'t',True)
    elif long:
        poly([(57,24),(47,17),(50,28),(45,34),(58,35)],'V',True)
    poly([(54,24),(58,20),(65,18),(73,20),(78,24),(85,25),(88,29),(87,35),(80,38),(72,36),(66,41),(57,39),(53,32)],'m',True)
    poly([(57,25),(60,22),(65,21),(71,22),(74,26),(65,28),(57,29)],'l')
    poly([(55,31),(61,33),(67,32),(69,37),(64,40),(57,37)],'s')
    line([(58,24),(64,22),(69,23)],'h',2)
    poly([(69,28),(78,27),(84,28),(86,31),(81,33),(71,32)],'l')
    line([(72,28),(79,28),(83,29)],'h')
    cluster(82,31,['oo','o.'])
    poly([(64,25),(69,24),(73,26),(71,29),(65,29)],'o')
    if p.pose=='hit':line([(66,27),(70,27)],'B')
    else:
        line([(66,26),(70,26)],'A');line([(68,26),(68,28)],'o');cluster(70,26,['e'])
    line([(63,24),(68,23),(72,25)],'d')
    # Opening changes the jaw contour and fang spacing instead of moving a head bitmap.
    gap={'windup':0,'idle_b':3,'attack':9,'hit':1}.get(p.pose,5)
    if gap:
        poly([(69,36),(80,37),(86,34),(85,39+gap),(80,42+gap),(74,42+gap),(68,39+gap)],'r',True)
        poly([(74,39+gap),(80,39+gap),(83,37+gap),(82,40+gap),(77,41+gap)],'q')
        for x,y in ((72,36),(80,37),(84,35)):
            poly([(x,y),(x+2,y),(x+1,y+4)],'w')
        poly([(69,39+gap),(74,43+gap),(81,43+gap),(86,39+gap),(86,42+gap),(80,46+gap),(73,45+gap),(67,41+gap)],'m',True)
        line([(71,43+gap),(76,45+gap),(81,44+gap),(84,42+gap)],'l')
        poly([(79,41+gap),(81,40+gap),(80,37+gap)],'w')
    else:
        poly([(68,36),(74,39),(81,40),(86,37),(85,40),(78,43),(70,41),(66,38)],'m',True)
        line([(72,39),(79,40),(84,38)],'d');poly([(80,39),(83,38),(81,42)],'w')
    if long:
        poly([(84,26),(89,28),(91,31),(88,34),(85,34)],'T',True);line([(85,27),(89,30)],'w')
    cluster(58,31,['.l..','ls..','.sll','..sm'])

def dragon(kind,pose):
    p=Pen(dragon_palette(kind),pose,kind);poly,line,cluster=p.poly,p.line,p.cluster
    if pose=='dead':return fallen_dragon(p,kind)
    # Folded far wing first: the near membrane overlays its narrower span.
    p.part='farwing'
    poly([(56,53),(67,23),(76,13),(78,20),(73,33),(84,32),(77,45),(83,51),(67,54),(64,65)],'v',True)
    line([(57,53),(67,28),(75,18)],'s',3);line([(67,28),(78,35),(69,49)],'V',2)
    p.part='tail'
    poly([(40,69),(31,65),(24,69),(18,74),(11,74),(7,69),(7,61),(6,58),(5,69),(5,78),(11,85),(23,87),(34,82),(43,79)],'m',True)
    poly([(8,76),(14,80),(23,81),(31,77),(39,73),(41,78),(33,82),(23,85),(12,83)],'s')
    line([(7,69),(9,76),(16,80),(23,79),(29,75),(34,72)],'l',3)
    if kind=='dragon-red':
        for x,y in ((12,76),(21,79),(29,75)):poly([(x,y),(x-2,y-5),(x+3,y-2)],'t',True)
    p.part='farleg'
    poly([(43,65),(52,64),(56,70),(52,78),(49,85),(56,88),(57,90),(41,90),(38,87),(41,80),(39,74)],'d',True)
    poly([(43,71),(50,70),(48,78),(44,84),(43,86)],'s');talons(p,46,87,True)
    p.part='body'
    poly([(32,51),(38,42),(49,39),(59,44),(66,55),(66,69),(62,78),(50,82),(37,77),(30,67),(29,58)],'m',True)
    poly([(31,60),(36,65),(44,66),(53,63),(64,59),(65,71),(58,77),(49,79),(39,75),(33,70)],'s')
    poly([(34,51),(41,45),(49,43),(56,47),(58,53),(48,51),(39,55),(35,61),(32,59)],'l')
    line([(38,47),(43,45),(49,45)],'h',2)
    # Layered scale clusters follow shoulder/haunch planes.
    for x,y in ((38,51),(45,53),(35,58),(42,60),(50,58),(37,66),(46,68),(54,69)):
        cluster(x,y,['.l..','llm.','.ms.','..s.'])
    # Broad neck connects its independently posed face to the chest.
    poly([(48,44),(54,30),(61,28),(67,35),(67,47),(62,57),(62,68),(53,69),(50,57)],'m',True)
    poly([(59,34),(65,36),(63,47),(59,55),(58,65),(54,64),(54,53)],'T',True)
    for y in (42,48,54,60):line([(56,y),(62,y+1)],'B')
    line([(52,39),(54,35),(58,33)],'l',2)
    p.part='wing'
    if kind=='dragon-blue':
        pts=[(46,55),(38,29),(25,6),(22,6),(22,25),(13,21),(16,39),(7,40),(17,51),(16,66),(30,58),(33,70)]
        fingers=[(22,25),(13,21),(7,40),(16,66),(33,70)]
    elif kind=='wyvern-cliff':
        pts=[(46,54),(40,29),(24,7),(20,8),(20,30),(7,43),(16,47),(9,61),(23,60),(23,72),(38,63)]
        fingers=[(20,30),(7,43),(9,61),(23,72)]
    else:
        pts=[(46,54),(40,27),(25,7),(22,6),(22,28),(12,31),(18,45),(7,57),(24,54),(27,69),(38,60)]
        fingers=[(22,28),(12,31),(7,57),(27,69)]
    poly(pts,'V',True)
    poly([(38,32),(23,30),(19,35),(27,41),(38,49)],'v')
    poly([(37,48),(25,46),(12,54),(24,52),(28,62),(33,56)],'v')
    line([(46,54),(40,28),(25,8),(22,7)],'s',4)
    line([(44,50),(38,28),(25,10)],'l',2)
    for tip in fingers:line([(40,29),tip],'s',2);line([(39,29),(tip[0]+1,tip[1])],'l')
    # Outer joint has a distinct small claw rather than a sharp empty fan.
    poly([(22,8),(22,5),(25,4),(26,8)],'T',True)
    p.part='leg'
    poly([(48,69),(55,64),(64,67),(68,74),(65,81),(62,86),(72,88),(73,91),(55,91),(52,88),(54,81),(48,77)],'m',True)
    poly([(53,70),(59,68),(64,72),(63,77),(57,81),(54,78)],'l')
    line([(57,70),(60,70),(63,73)],'h');line([(55,84),(55,88),(59,89),(66,89)],'s',2)
    talons(p,60,88)
    if kind!='wyvern-cliff':
        p.part='arm'
        poly([(60,54),(67,52),(72,57),(72,65),(77,68),(83,67),(84,71),(79,73),(70,70),(66,65),(64,60)],'m',True)
        line([(67,55),(70,59),(69,64),(73,68)],'l',2)
        talons(p,75,69)
    dragon_head(p,kind)
    return p.im

def fallen_dragon(p,kind):
    poly,line,cluster=p.poly,p.line,p.cluster
    p.part='body'
    poly([(7,79),(12,83),(24,80),(33,75),(45,73),(54,76),(62,84),(63,91),(45,92),(28,89),(14,90),(6,85)],'m',True)
    poly([(21,85),(33,79),(43,77),(51,80),(55,85),(46,89),(30,87)],'l')
    poly([(25,78),(20,53),(23,48),(31,62),(36,65),(40,53),(43,61),(50,63),(45,70),(54,80),(37,85)],'V',True)
    line([(22,51),(28,69),(36,80)],'s',3)
    line([(28,66),(41,61),(37,77)],'l')
    poly([(51,80),(57,77),(64,80),(69,87),(78,88),(77,92),(63,92),(57,88)],'m',True)
    poly([(59,72),(62,67),(68,65),(75,68),(77,72),(87,75),(91,80),(89,86),(82,89),(72,88),(63,83),(57,78)],'m',True)
    poly([(63,70),(67,68),(74,70),(79,75),(72,76),(65,74)],'l')
    poly([(61,70),(55,62),(58,63),(65,69)],'T',True)
    poly([(68,66),(66,57),(69,59),(72,67)],'T',True)
    line([(71,74),(76,76)],'o',2);line([(81,78),(85,79)],'d')
    line([(74,84),(81,86),(87,84)],'d');poly([(84,85),(86,84),(85,88)],'w')
    line([(65,89),(70,90),(75,90)],'l')
    for x,y in ((30,81),(37,80),(43,83),(63,78)):cluster(x,y,['.l.','lls','.ss'])
    return p.im

def bone_dragon(pose):
    p=Pen(dict(BASE,m='b8b19a',l='dcd1ae',h='f0e3bd',s='7f8177',d='434c51'),pose,'dragon-bone')
    poly,line,cluster=p.poly,p.line,p.cluster
    if pose=='dead':
        for x,y in ((12,86),(21,84),(30,85),(41,87),(52,89)):
            poly([(x,y),(x+4,y-3),(x+6,y),(x+4,y+3),(x,y+2)],'m',True);line([(x+1,y),(x+3,y-1)],'l')
        poly([(25,78),(26,54),(29,50),(33,65),(42,71),(54,77),(56,86),(35,88)],'d',True)
        for y in (70,75,80):line([(29,y),(40,y-1),(48,y+2)],'m',3);line([(30,y-1),(40,y-2),(45,y)],'l')
        poly([(58,76),(62,69),(73,66),(81,69),(84,74),(90,78),(88,85),(78,90),(66,88),(58,83)],'m',True)
        poly([(68,74),(73,72),(78,74),(77,79),(69,78)],'o');line([(79,84),(86,82)],'d')
        poly([(65,69),(60,57),(64,60),(70,69)],'l',True)
        for x in (72,78,84):poly([(x,86),(x+2,85),(x+1,90)],'l')
        return p.im
    p.part='tail'
    line([(38,72),(28,82),(17,84),(10,79),(8,70)],'d',7)
    for x,y in ((10,74),(13,80),(18,82),(25,80),(32,76)):
        poly([(x-3,y),(x,y-3),(x+4,y-1),(x+4,y+2),(x,y+3)],'m',True);line([(x-1,y),(x+2,y-1)],'l')
    p.part='farleg';line([(43,66),(49,75),(43,84),(51,89)],'s',5);talons(p,45,88,True)
    p.part='farwing';line([(56,52),(69,30),(78,15)],'s',4)
    for tip in ((80,32),(83,46),(73,55)):line([(69,30),tip],'s',3)
    p.part='body'
    poly([(33,49),(43,41),(52,44),(59,53),(62,67),(54,77),(42,77),(31,64)],'o',True)
    line([(33,51),(42,43),(50,46),(55,54),(58,64),(52,74),(44,75)],'m',5)
    line([(34,49),(42,44),(48,46)],'l',2)
    for y,x in ((50,36),(56,34),(62,35),(68,40)):
        line([(x,y),(43,y+3),(53,y+3),(56,y)],'s',4)
        line([(x,y-1),(43,y+1),(52,y+1),(55,y-1)],'m',3)
        line([(x+1,y-1),(43,y),(49,y)],'l')
    line([(53,49),(57,37),(61,29)],'m',6)
    for x,y in ((56,44),(58,38),(60,32)):poly([(x-3,y),(x,y-3),(x+4,y-1),(x+3,y+3),(x-2,y+2)],'l',True)
    p.part='wing'
    line([(43,51),(38,28),(24,8),(22,6)],'m',5);line([(41,48),(36,27),(24,10)],'l',2)
    for tip in ((20,28),(11,37),(10,55),(28,69)):
        line([(38,28),tip],'s',4);line([(38,27),tip],'m',2);cluster(tip[0],tip[1],['l','m'])
    # Ripped rag scraps make membrane remnants visible without a filled wing.
    poly([(33,31),(25,33),(20,41),(29,38),(30,47),(34,39)],'v',True)
    poly([(27,47),(18,53),(23,52),(26,59),(30,55)],'V',True)
    p.part='leg';line([(53,69),(64,76),(58,86),(67,88)],'s',7);line([(54,69),(63,75),(58,85)],'m',4)
    poly([(54,67),(59,66),(63,70),(60,75),(55,74)],'l',True);talons(p,61,88)
    p.part='arm';line([(61,51),(70,59),(70,68),(80,71)],'m',4);talons(p,74,69)
    p.part='head'
    poly([(56,23),(59,19),(67,17),(74,20),(77,24),(86,26),(88,30),(87,36),(79,39),(70,36),(64,40),(57,35),(54,29)],'m',True)
    poly([(58,22),(63,19),(68,20),(70,23),(64,25),(57,26)],'l')
    poly([(64,24),(70,23),(75,26),(71,31),(65,30)],'o');line([(66,27),(69,26)],'R')
    poly([(81,29),(84,30),(85,33),(81,33)],'o')
    poly([(58,20),(52,9),(55,10),(62,19)],'l',True);poly([(66,17),(65,6),(68,8),(70,18)],'l',True)
    gap=9 if pose=='attack' else 3 if pose=='windup' else 5
    for x in (72,78,84):poly([(x,36),(x+2,36),(x+1,41)],'l')
    poly([(65,39+gap),(74,44+gap),(82,43+gap),(87,39+gap),(86,44+gap),(79,47+gap),(71,47+gap),(63,42+gap)],'m',True)
    line([(68,42+gap),(74,45+gap),(81,44+gap)],'l')
    for x in (73,80):poly([(x,44+gap),(x+2,44+gap),(x+1,40+gap)],'l')
    return p.im

def brute_palette(kind):
    p=dict(BASE)
    if kind=='minotaur-maze':p.update(d='352f39',s='61443f',m='94664e',l='bd8c64',h='dfb885',v='493e48',V='74606a')
    if kind=='troll-cave':p.update(d='253d3b',s='3f6252',m='698861',l='97ad79',h='c9ce97')
    if kind=='demon-lord':p.update(d='342c47',s='564363',m='856074',l='b08793',h='d5b1af',v='3b334b',V='625068')
    return p

def brute(kind,pose):
    p=Pen(brute_palette(kind),pose,kind);poly,line,cluster=p.poly,p.line,p.cluster
    if pose=='dead':return fallen_brute(p,kind)
    bull=kind=='minotaur-maze';troll=kind=='troll-cave';demon=kind=='demon-lord'
    if demon:
        p.part='farwing';poly([(54,49),(67,23),(80,8),(78,26),(89,34),(77,35),(81,50),(67,44),(64,57)],'R',True)
        line([(56,48),(69,25),(80,10)],'d',3)
        p.part='wing';poly([(41,49),(31,24),(14,9),(17,27),(6,38),(19,35),(13,53),(30,44),(31,62)],'R',True)
        line([(41,49),(31,25),(15,10)],'d',3)
        for tip in ((17,27),(6,38),(13,53),(31,62)):line([(31,25),tip],'q',2)
        poly([(24,32),(18,40),(26,39),(30,48),(31,38)],'r')
    p.part='fararm'
    poly([(33,37),(25,41),(21,51),(24,61),(29,63),(34,59),(31,55),(29,49),(36,46)],'s',True)
    line([(27,44),(24,51),(27,58)],'m',2)
    p.part='farleg'
    poly([(35,64),(46,64),(46,75),(41,82),(39,88),(46,90),(47,92),(30,92),(28,89),(31,80),(30,73)],'d',True)
    poly([(33,72),(40,70),(41,76),(36,85),(34,88)],'s')
    p.part='body'
    if bull:
        poly([(35,34),(43,29),(55,30),(66,36),(70,47),(66,60),(64,73),(54,77),(39,73),(31,63),(28,49),(30,39)],'m',True)
    elif troll:
        poly([(33,37),(42,32),(55,33),(65,38),(69,48),(73,57),(72,68),(64,77),(50,79),(37,73),(29,63),(27,51),(29,42)],'m',True)
        poly([(58,50),(65,49),(69,56),(69,65),(64,70),(57,69),(58,63)],'l')
        line([(60,70),(64,68),(66,65)],'s',2)
    else:
        poly([(31,36),(43,31),(55,31),(67,36),(71,44),(66,54),(59,59),(59,70),(52,76),(43,70),(41,58),(32,52),(28,43)],'m',True)
    poly([(34,36),(41,34),(48,37),(46,44),(39,47),(32,44)],'l')
    poly([(50,37),(57,34),(64,38),(66,44),(57,48),(51,44)],'l')
    line([(38,36),(44,36)],'h',2);line([(54,36),(60,37)],'h',2)
    poly([(32,49),(39,50),(46,48),(50,50),(57,49),(64,46),(65,54),(60,62),(58,72),(47,73),(39,66),(35,60)],'s')
    poly([(44,49),(49,47),(53,50),(53,55),(48,57),(44,54)],'m')
    poly([(46,59),(51,58),(55,61),(53,66),(47,67),(44,63)],'m')
    line([(39,51),(41,56),(45,58)],'d');line([(57,53),(55,57)],'d')
    if bull:
        # Bristling neck/shoulder mane, with individual tapered locks.
        poly([(34,35),(35,28),(43,23),(53,25),(60,30),(59,40),(56,38),(53,42),(49,38),(45,41),(43,37),(38,40)],'d',True)
        for x,y in ((38,31),(43,29),(49,30),(54,32)):cluster(x,y,['.m..','mll.','.ls.','..s.'])
        # Short fur tufts break the broad chest and abdomen planes.
        for x,y in ((33,44),(37,46),(43,43),(54,43),(59,42),(37,57),(43,61),(52,61),(57,57)):
            cluster(x,y,['.l..','lm..','.ms.','..s.'])
        line([(45,49),(48,52),(48,56)],'d');line([(52,51),(53,54)],'d')
    elif troll:
        for x,y in ((33,40),(61,42),(57,61),(41,63)):cluster(x,y,['.l.','lsl','.s.'])
        line([(33,56),(36,58),(37,61)],'d');line([(58,52),(61,53)],'d')
        poly([(43,58),(48,56),(53,57),(55,63),(53,68),(47,69),(42,65)],'m')
        line([(46,69),(51,70),(55,68)],'d');cluster(50,62,['ss','sm'])
        for x,y in ((31,45),(35,50),(40,42),(61,47),(64,59),(35,65),(54,64)):
            cluster(x,y,['.h.','lms','.s.'])
    else:
        poly([(31,38),(35,32),(43,35),(44,43),(37,46),(31,43)],'V',True)
        poly([(57,34),(65,32),(70,39),(66,46),(58,45)],'V',True)
        line([(34,35),(38,36),(41,40)],'C',2);line([(61,35),(65,35),(67,39)],'C',2)
        poly([(40,46),(51,42),(62,47),(59,60),(51,66),(41,60)],'v',True)
        line([(42,48),(50,45),(59,49),(56,57),(51,62)],'c',2)
        poly([(49,49),(54,49),(55,54),(51,57),(47,53)],'R',True);cluster(50,50,['Qq','qR'])
    # Rugged cloth with bent folds and a buckled belt.
    poly([(34,64),(44,66),(55,66),(65,62),(65,74),(62,80),(55,77),(50,82),(43,78),(36,79),(32,74)],'R' if bull or demon else 'b',True)
    line([(35,65),(45,68),(56,68),(64,65)],'t',3)
    poly([(46,65),(53,65),(54,71),(46,72)],'B',True);line([(48,66),(52,66),(52,70),(48,70),(48,66)],'T')
    line([(38,69),(37,75)],'r' if bull or demon else 'd',2)
    line([(58,71),(57,76)],'q' if bull or demon else 't')
    p.part='leg'
    poly([(52,75),(63,73),(67,78),(66,84),(62,89),(73,90),(74,92),(56,92),(53,89),(56,83)],'m',True)
    poly([(57,77),(62,76),(63,80),(60,85),(57,86)],'l');line([(57,88),(61,90),(70,90)],'s',2)
    if bull:
        poly([(56,89),(65,89),(67,92),(55,92)],'d',True);line([(62,89),(62,92)],'o')
        for x,y in ((58,78),(60,82)):cluster(x,y,['l.','ms','.s'])
    elif demon:
        poly([(54,78),(61,76),(65,79),(63,85),(62,89),(72,90),(73,92),(55,92),(53,88)],'v',True)
        line([(58,78),(61,80),(58,88),(63,90)],'c',2)
        poly([(58,78),(62,77),(64,80),(60,83),(56,81)],'C',True)
    else:
        poly([(61,88),(69,86),(77,89),(79,92),(62,92),(58,89)],'m',True)
        talons(p,65,89)
    p.part='arm'
    poly([(62,39),(69,39),(74,44),(76,51),(73,58),(80,57),(84,51),(88,52),(88,59),(82,64),(73,64),(66,59),(64,50)],'m',True)
    poly([(68,42),(71,44),(73,49),(71,54),(67,52),(66,46)],'l')
    line([(69,43),(71,47)],'h',2);line([(73,58),(77,61),(82,59)],'s',2)
    if bull:
        for x,y in ((69,49),(71,53),(77,58)):cluster(x,y,['.l.','lm.','.ss'])
    elif troll:
        cluster(70,48,['.h..','lml.','.mss']);line([(76,61),(80,61),(84,57)],'l')
    else:
        poly([(69,54),(73,53),(77,57),(82,54),(86,53),(86,59),(80,64),(74,63)],'V',True)
        line([(72,55),(76,59),(80,60),(84,57)],'C',2)
    # The weapon is authored at a different angle/reach for each action beat.
    p.part='body';weapon(p,kind,pose)
    p.part='head'
    if bull:bull_head(p)
    elif troll:troll_head(p)
    else:demon_head(p)
    return p.im

def weapon(p,kind,pose):
    poly,line=p.poly,p.line
    angles={'idle_a':0,'idle_b':-2,'idle_c':3,'windup':-35,'move':-8,'attack':63,'recover':35,'hit':-15}
    angle=angles[pose];pivot=(81,54)
    offset={'windup':(-8,-7),'move':(0,-4),'attack':(-31,-5),'recover':(-20,0),'hit':(-8,-6),'idle_b':(0,1),'idle_c':(-1,-2)}.get(pose,(0,0))
    def coords(pts):
        return [(u+offset[0],v+offset[1]) for u,v in [rotate(x,y,pivot,angle) for x,y in pts]]
    if kind=='minotaur-maze':
        line(coords([(81,29),(81,72)]),'o',5);line(coords([(81,29),(81,72)]),'B',3);line(coords([(80,32),(80,70)]),'t')
        poly(coords([(80,23),(86,18),(89,21),(88,32),(84,36),(81,33),(78,36),(73,34),(71,27),(74,20),(78,23)]),'c',True)
        line(coords([(75,21),(73,27),(75,31)]),'C',2);line(coords([(87,21),(87,30),(84,33)]),'C',2)
        poly(coords([(79,26),(82,25),(84,28),(82,32),(79,30)]),'V',True)
    elif kind=='troll-cave':
        line(coords([(80,34),(81,70)]),'o',6);line(coords([(80,34),(81,70)]),'B',4);line(coords([(79,37),(80,67)]),'t')
        poly(coords([(73,20),(81,16),(87,20),(89,30),(87,40),(77,43),(71,36),(70,26)]),'s',True)
        poly(coords([(74,21),(80,19),(85,22),(84,28),(75,29),(72,26)]),'l')
        line(coords([(74,31),(79,34),(83,30),(87,33)]),'d',2);line(coords([(77,38),(84,36)]),'m',2)
    else:
        line(coords([(81,43),(81,72)]),'o',5);line(coords([(81,43),(81,71)]),'B',3)
        poly(coords([(80,44),(78,30),(80,21),(85,14),(88,13),(85,25),(88,32),(85,42)]),'c',True)
        line(coords([(87,15),(83,23),(83,31),(81,41)]),'C',2)
        line(coords([(75,44),(87,44)]),'T',3)

def bull_head(p):
    poly,line,cluster=p.poly,p.line,p.cluster
    poly([(39,23),(32,19),(27,10),(30,8),(32,15),(40,18)],'T',True)
    poly([(56,20),(62,17),(67,8),(70,7),(70,13),(64,22),(58,25)],'T',True)
    line([(29,10),(32,16),(36,19)],'w');line([(68,10),(66,16),(61,20)],'w')
    poly([(37,21),(43,16),(52,17),(59,22),(61,31),(57,37),(49,39),(40,35),(36,29)],'m',True)
    poly([(39,23),(43,20),(49,20),(51,24),(43,27)],'l')
    poly([(39,27),(33,25),(33,30),(39,32)],'m',True);line([(34,27),(37,29)],'B')
    poly([(48,27),(58,26),(63,30),(64,36),(59,41),(51,41),(46,36)],'t',True)
    poly([(50,28),(57,28),(61,31),(58,33),(50,33)],'T')
    cluster(53,32,['oo..oo','o....o']);line([(52,38),(60,37)],'d')
    cluster(42,26,['oooo','.Aeo','..oo']);line([(41,24),(45,24),(48,26)],'d',2)
    line([(54,34),(53,38),(56,40),(59,38),(59,34)],'A',2)
    for x,y in ((39,32),(42,35),(46,36)):cluster(x,y,['.B.','Bml','.sd'])

def troll_head(p):
    poly,line,cluster=p.poly,p.line,p.cluster
    poly([(37,18),(45,13),(53,14),(60,19),(61,27),(65,30),(64,38),(58,44),(46,43),(36,36),(33,26)],'m',True)
    poly([(38,18),(43,15),(52,16),(56,19),(53,23),(41,23)],'l')
    poly([(35,24),(27,23),(29,30),(36,32)],'m',True);poly([(59,21),(67,20),(65,28),(60,29)],'m',True)
    line([(29,25),(33,28)],'s');line([(65,22),(62,25)],'l')
    poly([(47,25),(52,24),(57,26),(58,31),(65,33),(65,37),(60,40),(51,38),(47,34)],'l',True)
    poly([(51,28),(55,29),(55,33),(59,34),(59,37),(52,35)],'h')
    cluster(59,36,['oo','o.']);line([(41,23),(46,24)],'d',2)
    cluster(41,25,['ooo','Aeo','.oo'])
    poly([(43,35),(48,36),(52,40),(60,40),(58,44),(49,45),(42,41)],'r',True)
    poly([(44,39),(43,33),(46,35),(47,40)],'w',True);poly([(55,42),(58,37),(59,40),(58,44)],'w',True)
    line([(47,42),(51,43),(54,43)],'q');line([(37,31),(39,35),(42,37)],'s',2)
    cluster(39,19,['.h.','hls','.s.']);cluster(56,21,['.h','ls'])

def demon_head(p):
    poly,line,cluster=p.poly,p.line,p.cluster
    poly([(40,24),(33,17),(35,8),(39,4),(38,12),(44,20)],'d',True)
    poly([(53,21),(56,11),(64,5),(60,16),(59,27)],'d',True)
    line([(35,15),(36,11),(38,8)],'V');line([(57,15),(59,11)],'V')
    poly([(39,24),(43,17),(51,18),(58,23),(60,29),(58,37),(52,42),(44,38),(38,31)],'m',True)
    poly([(42,23),(46,20),(52,22),(53,26),(46,28)],'l')
    poly([(40,28),(32,24),(34,31),(41,33)],'s',True)
    poly([(51,28),(56,28),(58,33),(62,35),(59,38),(53,35)],'l',True)
    line([(54,30),(56,33)],'h');cluster(58,35,['oo'])
    cluster(44,26,['oooo','.QAo','..oo']);line([(42,24),(48,24),(50,26)],'d',2)
    poly([(47,36),(53,37),(58,36),(57,40),(51,42),(46,39)],'r',True)
    poly([(49,37),(51,37),(50,40)],'w');poly([(55,37),(57,36),(56,40)],'w')
    poly([(46,39),(51,42),(56,40),(53,47),(49,47)],'d',True)
    line([(49,43),(51,45),(53,43)],'V')

def fallen_brute(p,kind):
    poly,line,cluster=p.poly,p.line,p.cluster
    # The torso is horizontal, arms and legs folded across the ground.
    poly([(12,86),(20,76),(34,72),(44,76),(54,79),(55,88),(46,92),(27,92),(18,89)],'m',True)
    poly([(22,78),(33,75),(39,78),(40,83),(31,85),(24,83)],'l')
    poly([(16,85),(28,86),(34,90),(26,92),(14,91)],'s')
    poly([(34,76),(42,75),(49,80),(50,88),(41,92),(34,88)],'R' if kind!='troll-cave' else 'b',True)
    line([(38,78),(41,83),(39,89)],'q' if kind!='troll-cave' else 't')
    poly([(13,87),(8,80),(11,74),(18,78),(20,86)],'m',True)
    poly([(42,88),(48,83),(55,86),(62,88),(70,88),(71,91),(57,92),(48,92)],'m',True)
    poly([(50,73),(55,68),(65,67),(70,70),(73,76),(82,78),(85,82),(83,88),(72,91),(60,88),(50,83)],'m',True)
    poly([(54,72),(60,70),(66,71),(68,75),(61,77),(54,76)],'l')
    line([(63,77),(68,78)],'o',2);line([(75,83),(81,83)],'d')
    if kind=='minotaur-maze':
        poly([(53,71),(44,67),(39,60),(43,61),(49,66),(58,70)],'T',True)
        poly([(65,68),(62,57),(65,60),(68,68)],'T',True)
        line([(76,84),(75,88),(78,90),(81,87),(81,84)],'A')
    elif kind=='demon-lord':
        poly([(26,76),(15,56),(9,53),(12,68),(7,75),(17,73),(20,84)],'R',True)
        line([(11,57),(19,73),(25,78)],'q',2)
        poly([(55,71),(49,57),(50,53),(54,62),(60,69)],'d',True)
    else:
        poly([(72,78),(80,78),(87,82),(86,85),(78,85)],'l',True)
        poly([(76,85),(79,82),(80,88)],'w')
    p.part='body';line([(9,91),(32,91)],'B',3)
    return p.im

def draw(slug,pose,cell):
    assert cell==96,(slug,cell)
    if slug=='dragon-bone':return bone_dragon(pose)
    if slug in ('dragon','dragon-red','dragon-blue','wyvern-cliff'):return dragon(slug,pose)
    return brute(slug,pose)
