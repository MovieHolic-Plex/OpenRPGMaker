"""Stone-mask dokkaebi, Joseon bandit and ceremonial bride; original native anatomy."""
from math import hypot
from pixels import Ink,shift,limb

STONE=dict(o='#2e3444',base='#747c89',shade='#505766',light='#a9aa9f',rim='#d2c8ae',
           deep='#414551',crack='#3a4354',moss='#657568',eye='#d8ad6d',fang='#c7bfa5')

def stone_club(s,g,t):
    gx,gy=g;tx,ty=t;n=hypot(tx-gx,ty-gy);ux=(tx-gx)/n;uy=(ty-gy)/n
    def q(a,b):return (gx+ux*a-uy*b,gy+uy*a+ux*b)
    s.poly([q(-3,-2),q(n-9,-2),q(n-10,-5),q(n-2,-6),q(n+2,-2),q(n+1,5),q(n-8,6),q(n-10,2),q(-3,2)],'base')
    s.line([q(n-8,-3),q(n-2,-4),q(n,-1)],'rim')
    s.line([q(n-6,-4),q(n-5,0),q(n-7,3)],'crack')
    s.line([q(0,-1),q(n-10,-1)],'light')

def stone(p):
    dx,dy=shift(p);s=Ink(64,STONE,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(7,55),(13,49),(21,50),(24,57),(17,60),(9,59)],'base')
        s.poly([(24,56),(27,45),(37,43),(43,49),(43,55),(34,60)],'shade')
        s.poly([(29,46),(36,45),(40,49),(35,52),(27,51)],'light',None)
        s.poly([(42,51),(46,43),(52,46),(54,51),(50,56),(45,56)],'base')
        s.line([(47,48),(51,49)],'deep');s.line([(30,49),(32,54),(30,58)],'crack')
        stone_club(s,(43,54),(55,51));s.dot(5,60,'light')
        return s.image
    feet={'move':((22,59-dy),(37,55)),'attack':((15,59-dy),(40,59-dy))}.get(p,((20,59-dy),(36,59-dy)))
    for x,y in feet:
        s.poly([(x-3,44),(x+3,44),(x+3,y-5),(x+5,y-2),(x+5,y),(x-5,y),(x-4,y-4)],'base')
        s.line([(x-3,y-2),(x+3,y-2)],'light');s.line([(x,y-4),(x+1,y)],'crack')
    s.poly([(18,26),(25,23),(34,25),(40,32),(41,41),(38,49),(28,51),(19,47),(16,38)],'base')
    s.poly([(20,29),(27,26),(33,28),(35,34),(30,39),(20,37)],'light',None)
    s.poly([(19,40),(26,41),(36,36),(38,43),(35,48),(26,49),(20,46)],'shade',None)
    s.line([(23,28),(26,34),(23,38),(28,42),(27,47)],'crack')
    s.line([(32,31),(35,34),(34,38)],'rim')
    s.poly([(15,29),(19,27),(21,32),(18,37),(13,38),(11,33)],'light')
    limb(s,(16,34),(12,40),(14,46),5,'base','light')
    # One split stone horn and brows shaped like an East Asian guardian mask.
    s.poly([(28,17),(27,11),(28,6),(33,6),(33,10),(35,10),(36,16)],'light')
    s.line([(29,10),(32,11)],'crack')
    s.poly([(26,18),(29,14),(35,14),(39,17),(40,22),(44,24),(45,27),(42,29),(40,33),(32,34),(26,30),(24,23)],'base')
    s.poly([(28,18),(32,16),(37,18),(38,21),(34,22),(28,22)],'light',None)
    s.line([(31,23),(35,21),(38,22)],'deep',2);s.line([(34,23),(37,23)],'eye')
    s.poly([(38,22),(40,22),(42,25),(46,26),(44,28),(39,28)],'light')
    s.dot(43,26,'deep');s.line([(34,30),(41,30)],'deep',2)
    s.poly([(35,31),(36,27),(38,29),(38,32)],'fang',None)
    s.line([(27,25),(30,26),(29,29)],'crack');s.line([(28,32),(30,35),(33,34)],'moss',2)
    if p=='hit':s.line([(34,23),(37,25)],'deep')
    grip,tip={'windup':((42,23),(47,10)),'move':((44,35),(51,21)),'attack':((44,33),(54,38)),'recover':((42,45),(52,46)),'hit':((40,34),(50,25))}.get(p,((43,40),(50,25)))
    stone_club(s,grip,tip);limb(s,(37,30),(40,35),grip,5,'base','light')
    s.line([(grip[0]-1,grip[1]-2),(grip[0]+2,grip[1]+1)],'crack')
    return s.image

BANDIT=dict(o='#262e3c',base='#485b72',shade='#323d54',light='#778393',pants='#877366',
            pshade='#594f52',plight='#b3977a',skin='#c99e7a',face='#e4bd91',mask='#293948',
            cloth='#5b706e',belt='#ac7855',steel='#b6cbce',shine='#ecedd5',edge='#63848e',
            wood='#58463e',hair='#262b39')

def hwando(s,grip,tip):
    gx,gy=grip;tx,ty=tip;n=hypot(tx-gx,ty-gy);ux=(tx-gx)/n;uy=(ty-gy)/n
    def q(a,b):return (gx+ux*a-uy*b,gy+uy*a+ux*b)
    s.poly([q(1,-1),q(n-6,-2),q(n,0),q(n-4,2),q(2,2)],'steel')
    s.line([q(3,-1),q(n-5,-1),q(n,0)],'shine')
    s.line([q(3,2),q(n-5,1)],'edge')
    s.line([q(0,-3),q(0,4)],'belt',2);s.line([q(-5,0),q(0,0)],'wood',3)

def bandit(p):
    dx,dy=shift(p);s=Ink(64,BANDIT,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(8,55),(16,49),(23,50),(30,53),(37,51),(44,55),(44,59),(32,60),(23,56),(12,60)],'pants')
        s.poly([(29,52),(33,45),(40,44),(47,49),(48,55),(40,58),(33,57)],'base')
        s.poly([(40,46),(42,40),(47,40),(51,44),(51,49),(48,51),(44,49)],'mask')
        s.line([(44,44),(48,46)],'face');s.line([(33,50),(38,53)],'light')
        hwando(s,(44,55),(58,49));s.line([(13,56),(10,59)],'pshade',3)
        return s.image
    feet={'move':((22,58-dy),(38,53)),'windup':((20,59-dy),(34,59-dy)),'attack':((15,59-dy),(43,59-dy))}.get(p,((22,59-dy),(35,59-dy)))
    for a,b,c in [((25,42),(21,49),(feet[0][0],feet[0][1]-3)),((32,42),(34,50),(feet[1][0],feet[1][1]-3))]:
        limb(s,a,b,c,7,'pants','plight')
    for x,y in feet:
        s.poly([(x-3,y-4),(x+2,y-4),(x+4,y-1),(x+4,y),(x-4,y),(x-4,y-2)],'pshade')
        s.line([(x-3,y-1),(x+3,y-1)],'cloth')
    # Slim jeogori over baggy baji, sash and diagonal sword scabbard.
    s.line([(18,39),(27,51)],'o',4);s.line([(18,39),(27,51)],'wood',2)
    s.poly([(24,23),(30,22),(35,26),(37,34),(34,43),(27,45),(20,41),(20,30)],'base')
    s.poly([(23,27),(26,25),(31,27),(30,33),(23,36)],'light',None)
    s.line([(27,24),(30,30),(33,26)],'cloth')
    s.line([(22,39),(29,40),(35,38)],'belt',3)
    s.line([(28,41),(26,46),(28,47)],'wood',2)
    left={'windup':((20,27),(24,22)),'move':((17,32),(13,36)),'attack':((17,29),(14,28)),'hit':((20,24),(27,21))}.get(p,((18,32),(18,38)))
    limb(s,(23,27),left[0],left[1],5,'base','light');s.line([left[1],(left[1][0]+3,left[1][1])],'skin',2)
    # Right-facing wrapped head; mask hides the mouth, not the nose direction.
    s.poly([(27,18),(27,12),(30,9),(35,9),(39,13),(39,17),(43,19),(41,21),(38,24),(32,24),(28,21)],'skin')
    s.poly([(29,13),(33,11),(36,13),(37,16),(32,18),(29,17)],'face',None)
    s.poly([(26,14),(25,10),(28,6),(33,5),(38,8),(38,12),(31,11),(27,15)],'hair')
    s.line([(27,12),(32,12),(38,14)],'cloth',2)
    s.line([(26,13),(23,16),(19,15)],'mask',2)
    s.line([(36,16),(39,17)],'hair');s.dot(38,16,'shine')
    s.poly([(28,18),(33,19),(40,18),(42,20),(38,24),(31,25),(28,22)],'mask')
    s.line([(32,21),(37,21)],'cloth')
    grip,tip={'windup':((39,23),(44,7)),'move':((40,36),(51,25)),'attack':((47,31),(59,27)),'recover':((41,43),(53,44)),'hit':((38,26),(49,15)),'idle_b':((41,31),(52,16))}.get(p,((42,33),(54,19)))
    hwando(s,grip,tip)
    limb(s,(34,27),(37,32),grip,5,'base','light');s.line([(grip[0]-1,grip[1]),(grip[0]+2,grip[1])],'skin',3)
    return s.image

BRIDE=dict(o='#343347',red='#963e54',base='#b75c68',shade='#67384d',light='#d68a80',
           gold='#d9b574',rim='#f2d4a1',green='#588174',jade='#8ab798',white='#ece3d3',
           fold='#c5c0ce',skin='#e9d6c1',face='#fff0d7',hair='#292c3e',hlight='#51506b',
           eye='#9d5966',steel='#a6c1ba',deep='#44394d')

def bride_sleeve(s,a,b,w):
    x,y=a;u,v=b;wx,wy=w
    s.poly([(x-4,y-3),(x+4,y-2),(u+7,v-3),(wx+2,wy-3),(wx+2,wy+4),(u+4,v+10),(u-5,v+10),(x-5,y+4)],'green')
    s.line([(x,y),(u,v),(wx-2,wy)],'jade',3)
    s.line([(u-2,v+6),(u+6,v+5)],'gold',3)
    s.line([(u-2,v+9),(u+5,v+8)],'red',2)
    s.line([(wx-2,wy-2),(wx-2,wy+4)],'white',3)
    s.line([(wx+1,wy),(wx+5,wy)],'skin',2)
    # Original jade-ended ceremonial binyeo, used as the bride's weapon.
    s.line([(wx+4,wy-1),(wx+11,wy-3)],'gold')
    s.poly([(wx+5,wy-2),(wx+4,wy-5),(wx+6,wy-7),(wx+8,wy-5),(wx+7,wy-2)],'jade')

def bride(p):
    dx,dy=shift(p);s=Ink(96,BRIDE,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(15,81),(26,73),(40,71),(49,75),(61,76),(70,83),(74,89),(61,92),(44,88),(29,92),(17,88)],'red')
        s.poly([(24,79),(37,74),(45,77),(42,82),(30,85)],'light',None)
        s.line([(22,86),(34,85),(43,88)],'gold',2)
        s.poly([(47,78),(54,71),(61,71),(67,76),(65,83),(56,86),(50,83)],'green')
        s.line([(53,80),(60,79)],'white',3)
        s.poly([(60,75),(62,66),(66,62),(73,63),(78,68),(80,75),(76,80),(68,81)],'hair')
        s.poly([(69,67),(73,67),(77,71),(78,74),(74,77),(69,75)],'skin')
        s.line([(72,70),(75,72)],'hlight')
        s.poly([(66,64),(66,58),(72,57),(75,61),(74,66)],'hair')
        s.dot(71,59,'jade');s.dot(73,62,'gold')
        s.line([(67,77),(63,82),(61,86)],'hlight');s.line([(63,87),(80,84)],'gold')
        return s.image
    sway={'idle_b':-2,'idle_c':2,'windup':-3,'move':-4,'attack':-3,'hit':3}.get(p,0)
    # Long ritual back ribbons, each drawn independently from the skirt.
    s.poly([(39,25),(36,30),(31+sway,42),(29+sway,61),(22+sway,72),(24+sway,75),(33+sway,64),(36+sway,47),(42,34)],'white')
    s.line([(36,36),(33+sway,53),(28+sway,67)],'fold')
    # Full crimson chima with gilt hem, separate white spirit threads below.
    s.poly([(39,47),(49,45),(58,49),(62,59),(65,69),(72+sway,82),(74+sway,87),(63+sway,87),(60,90-dy),(52,88),(47,92-dy),(40,88),(32+sway,91-dy),(34+sway,86),(24+sway,87),(29,75),(32,62)],'red')
    s.poly([(39,52),(44,50),(44,70),(37,81),(30+sway,85),(35,69)],'base',None)
    s.poly([(48,50),(53,51),(56,63),(57,76),(65+sway,83),(58,85),(51,75)],'shade',None)
    s.line([(40,56),(39,70),(35,80)],'light',2)
    s.line([(46,55),(45,70),(48,82)],'light')
    s.line([(28+sway,83),(36+sway,85),(46,84),(56,84),(68+sway,82)],'gold',2)
    for x,y in [(36,78),(47,76),(59,78)]:
        s.poly([(x,y-3),(x+2,y),(x,y+2),(x-2,y)],'gold',None);s.dot(x,y,'rim')
    s.line([(36+sway,88),(32+sway,92-dy)],'white');s.line([(58,87),(62,91-dy)],'fold')
    left={'windup':((32,36),(35,25)),'move':((25,44),(20,48)),'attack':((26,36),(21,34)),'recover':((37,43),(38,48)),'hit':((36,27),(43,24))}.get(p,((30,43),(28,48)))
    bride_sleeve(s,(40,36),left[0],left[1])
    # Green wonsam closes high above the skirt, red/gold hanging breast ties.
    s.poly([(40,31),(48,30),(55,35),(56,44),(51,50),(40,50),(36,41)],'green')
    s.poly([(40,34),(44,33),(49,37),(47,44),(40,45)],'jade',None)
    s.line([(43,32),(47,39),(52,34)],'white',2)
    s.line([(38,46),(46,48),(54,46)],'gold',2)
    s.poly([(46,42),(50,40),(54,42),(51,45),(47,45)],'red')
    s.line([(49,44),(46,56),(47,63)],'gold',2);s.line([(51,44),(53,53),(55,57)],'red',2)
    # Human right profile, black decorated jokduri, hairpin and cheek patches.
    s.poly([(43,18),(48,16),(53,18),(57,23),(57,27),(61,29),(58,31),(57,35),(52,37),(46,34),(42,27)],'skin')
    s.poly([(46,19),(49,18),(53,20),(53,27),(51,30),(54,34),(48,32)],'face',None)
    s.line([(53,25),(56,26)],'hlight');s.dot(55,26,'eye');s.dot(58,33,'red')
    s.poly([(41,26),(39,20),(41,15),(46,12),(52,13),(55,17),(52,20),(46,19),(44,24),(45,32),(41,38),(39,34)],'hair')
    s.line([(42,21),(43,29),(41,34)],'hlight')
    s.poly([(44,14),(44,8),(46,5),(51,5),(54,9),(53,15)],'hair')
    s.line([(45,12),(52,12)],'gold')
    s.poly([(47,7),(49,6),(51,8),(49,10)],'jade',None);s.dot(53,10,'red')
    s.line([(40,16),(57,14)],'gold');s.dot(58,14,'rim')
    s.line([(40,18),(37,28),(35,38),(34,48)],'hair',3)
    for x,y in [(37,26),(35,34),(34,42)]:s.line([(x-1,y),(x+1,y+1)],'hlight')
    right={'windup':((58,33),(65,25)),'move':((57,43),(64,49)),'attack':((68,35),(81,39)),'recover':((60,44),(65,50)),'hit':((54,30),(59,25)),'idle_b':((58,39),(68,42)),'idle_c':((59,41),(69,45))}.get(p,((58,40),(69,43)))
    bride_sleeve(s,(52,36),right[0],right[1])
    return s.image
