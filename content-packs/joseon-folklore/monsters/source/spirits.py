"""Fire, drowned scholar, grave creature and bamboo spirit: four distinct drawings."""
from pixels import Ink,shift,limb

FIRE=dict(o='#294954',deep='#305c6f',base='#427c8c',light='#78b4b2',white='#c7e6cb',
          core='#f1e8b4',hot='#fff3cb',eye='#294450',ash='#516575',ember='#d1a77c')

def wisp(p):
    dx,dy=shift(p);s=Ink(64,FIRE,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(21,57),(25,53),(32,54),(36,57),(42,59),(28,60)],'ash')
        s.line([(25,57),(32,57),(35,58)],'ember');s.dot(18,59,'deep');s.dot(45,58,'light')
        s.poly([(29,51),(28,48),(30,45),(32,48),(31,51)],'base')
        return s.image
    sway={'idle_b':-3,'idle_c':3,'windup':-5,'move':-4,'attack':4,'hit':-3}.get(p,0)
    # Flame curls inward at the top, with unconnected embers and a pointed face.
    s.poly([(28,58-dy),(21,53),(18,47),(16,41),(19,34),(22,28),(21+sway,21),(24+sway,15),(30+sway,10),(27+sway,19),(29,24),(34,19),(38,14),(38,23),(42,29),(43,35),(47,38),(44,43),(40,46),(39,51),(35,54),(34,59-dy),(31,55)],'base')
    s.poly([(22,47),(21,39),(25,32),(25+sway,23),(27+sway,18),(28,29),(32,30),(36,24),(35,32),(40,36),(42,40),(36,45),(33,52),(28,53)],'light',None)
    s.poly([(25,43),(27,36),(31,33),(34,34),(33,39),(38,40),(35,44),(31,49),(28,47)],'core',None)
    s.line([(25,44),(29,41),(30,38)],'hot',2)
    s.line([(35,32),(38,34),(40,34)],'deep',2);s.dot(39,35,'core')
    s.poly([(39,38),(43,36),(47,38),(45,40),(40,41)],'white',None)
    s.line([(39,43),(42,43)],'deep')
    if p=='attack':
        s.poly([(42,38),(52,33),(57,34),(53,37),(58,39),(52,41),(44,43)],'light')
        s.line([(45,39),(53,38)],'hot',2)
    if p=='windup':s.poly([(23,31),(16,24),(15,18),(19,22),(25,27)],'deep')
    if p=='hit':s.line([(33,35),(35,38)],'eye');s.poly([(14,40),(10,35),(13,34),(17,37)],'light')
    for x,y,c in [(13,31+sway,'light'),(43,23-sway,'white'),(20,16+sway,'base'),(45,50,'base')]:
        s.dot(x,y,c);s.dot(x,y+1,c)
    return s.image

WATER=dict(o='#263844',base='#436a7b',shade='#2f4c62',light='#709798',cloth='#7da8ab',
           white='#bdd7c8',skin='#8bb5a7',face='#b7cdb6',hair='#202f38',strand='#476864',
           algae='#597859',knot='#697a78',eye='#d9cc9b')

def wet_sleeve(s,a,b,c):
    x,y=a;u,v=b;wx,wy=c
    s.poly([(x-3,y-2),(x+3,y-1),(u+5,v-2),(wx+1,wy-1),(wx,wy+4),(u,v+8),(u-5,v+4),(x-4,y+3)],'base')
    s.line([(x,y),(u+1,v),(wx,wy)],'cloth',2)
    s.line([(u-3,v+4),(u+2,v+6)],'light')
    s.line([(wx,wy+1),(wx+5,wy+1)],'skin',2)
    for k in range(3):s.line([(wx+4,wy+k),(wx+6+k%2,wy+k+2)],'face')

def drowned(p):
    dx,dy=shift(p);s=Ink(64,WATER,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(10,54),(18,48),(25,50),(33,48),(41,53),(49,56),(47,60),(34,58),(27,60),(19,58),(12,59)],'base')
        s.line([(15,54),(23,53),(30,57),(37,55)],'cloth',2)
        s.poly([(30,47),(34,43),(40,44),(44,48),(43,52),(37,54),(32,51)],'hair')
        s.poly([(37,46),(40,47),(43,48),(40,51),(36,50)],'skin')
        s.line([(38,47),(40,49)],'shade')
        s.line([(26,55),(30,52),(35,53)],'algae',2)
        s.dot(8,59,'cloth');s.dot(52,60,'white')
        return s.image
    # Wet men's po coat, wide waist sash, exposed trouser cuff and bare feet.
    s.poly([(25,29),(33,28),(37,35),(38,42),(40,48),(42,55),(37,57),(34,54),(29,57),(23,55),(17,56),(19,49),(22,41)],'base')
    s.poly([(27,33),(30,33),(29,45),(25,53),(20,54),(23,43)],'cloth',None)
    s.poly([(32,35),(35,39),(35,48),(39,53),(34,54),(31,47)],'shade',None)
    s.line([(27,34),(26,43),(23,50)],'light')
    s.line([(34,47),(33,52)],'algae',2)
    s.poly([(24,54),(29,53),(29,58-dy),(25,59-dy),(22,59-dy)],'skin')
    s.poly([(33,53),(36,54),(38,58-dy),(35,59-dy),(31,59-dy)],'skin')
    left={'windup':((20,27),(25,22)),'move':((16,34),(12,35)),'attack':((16,30),(12,31)),'hit':((20,25),(26,21))}.get(p,((19,35),(18,39)))
    wet_sleeve(s,(26,28),left[0],left[1])
    s.poly([(26,24),(31,23),(35,28),(35,35),(26,36),(23,30)],'base')
    s.line([(28,25),(31,30),(34,28)],'white')
    s.line([(24,35),(30,36),(35,34)],'knot',3)
    s.line([(29,36),(30,44)],'shade',2)
    # Topknot with headband: distinct male profile and drooping waterlogged hair.
    s.poly([(27,18),(29,13),(35,13),(39,16),(39,20),(43,23),(40,24),(39,29),(34,30),(28,27)],'skin')
    s.poly([(30,16),(34,15),(36,18),(35,24),(37,28),(32,27)],'face',None)
    s.line([(36,20),(39,21)],'shade');s.dot(38,21,'eye');s.dot(40,27,'shade')
    s.poly([(26,20),(25,15),(28,11),(29,7),(33,5),(36,7),(35,11),(38,13),(37,16),(31,15),(29,22),(29,28),(25,33),(24,27)],'hair')
    s.line([(29,12),(35,13)],'knot',2);s.line([(27,19),(26,28)],'strand')
    s.line([(32,6),(33,9)],'strand')
    right={'windup':((38,27),(40,21)),'move':((37,34),(40,38)),'attack':((44,29),(51,31)),'recover':((38,37),(39,41)),'hit':((34,26),(39,22)),'idle_b':((37,31),(43,34))}.get(p,((37,32),(43,35)))
    wet_sleeve(s,(33,28),right[0],right[1])
    s.line([(24,31),(22,39),(23,44)],'algae')
    s.line([(37,39),(36,44),(38,47)],'algae')
    s.dot(17,47,'cloth');s.dot(43,52,'white')
    return s.image

GRAVE=dict(o='#2b2a36',base='#81716b',shade='#524755',light='#ad9690',skin='#bbaa8d',
           bone='#dacbb0',earth='#78604b',coat='#685e79',fold='#95849a',hair='#36313f',
           eye='#caa971',rope='#b1976f',claw='#e0d6b4')

def ghoul(p):
    dx,dy=shift(p);s=Ink(64,GRAVE,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(11,54),(16,48),(25,47),(34,50),(42,53),(45,59),(24,60),(14,58)],'coat')
        s.line([(14,54),(22,52),(29,55)],'fold')
        s.poly([(33,50),(36,45),(42,45),(48,50),(51,54),(46,58),(39,57)],'skin')
        s.line([(44,50),(47,53)],'shade');s.line([(43,55),(47,55)],'hair')
        s.line([(27,56),(34,51),(37,52)],'bone',3)
        s.line([(18,59),(24,59)],'earth',2)
        return s.image
    # A stooped burial-coat creature, crooked knee and forward long claws.
    feet={'move':((18,59-dy),(35,54)),'attack':((15,59-dy),(41,59-dy))}.get(p,((19,59-dy),(35,59-dy)))
    limb(s,(24,44),(20,51),(feet[0][0],feet[0][1]-2),5,'coat','fold')
    limb(s,(32,43),(32,52),(feet[1][0],feet[1][1]-2),4,'shade','base')
    for x,y in feet:s.line([(x-3,y),(x+3,y)],'earth',2)
    s.poly([(17,35),(20,29),(27,27),(35,30),(39,35),(35,44),(37,49),(32,47),(29,50),(25,47),(20,49),(17,43),(15,39)],'coat')
    s.poly([(21,33),(27,30),(33,33),(30,39),(21,40)],'fold',None)
    s.poly([(23,39),(29,38),(34,42),(32,47),(25,46),(18,43)],'shade',None)
    s.line([(21,35),(27,37),(31,34)],'rope')
    s.line([(22,41),(21,46)],'earth',2);s.line([(33,42),(31,46)],'earth')
    hx,hy={'windup':(-1,-2),'attack':(2,0),'hit':(-3,-3)}.get(p,(0,0));s.offset=(dx+hx,dy+hy)
    s.poly([(29,29),(30,22),(33,18),(38,18),(42,22),(43,27),(48,30),(45,32),(43,36),(37,37),(32,34)],'skin')
    s.poly([(32,23),(35,20),(39,21),(40,25),(36,28),(32,27)],'bone',None)
    s.poly([(29,26),(28,21),(31,17),(34,15),(39,16),(42,19),(37,20),(33,22),(32,27)],'hair')
    s.line([(36,26),(40,27)],'shade',2);s.dot(39,26,'eye')
    s.line([(39,33),(44,33)],'hair',2);s.dot(41,34,'claw');s.dot(43,34,'claw')
    s.line([(30,29),(33,32)],'earth')
    s.offset=(dx,dy)
    wrist={'windup':(41,23),'move':(44,39),'attack':(50,34),'recover':(39,43),'hit':(35,26)}.get(p,(43,38))
    limb(s,(33,33),(37,39),wrist,4,'skin','bone')
    for k in range(3):s.line([(wrist[0]+1,wrist[1]+k),(wrist[0]+6+k%2,wrist[1]+k-1)],'claw')
    limb(s,(20,35),(17,42),(14,46),3,'base','light')
    return s.image

BAMBOO=dict(o='#273d3b',base='#4f7754',shade='#365b49',light='#86a160',young='#b9be79',
            knot='#c0c393',wood='#866e51',eye='#e8d6a0',hollow='#273d3b',leaf='#689779')

def leaves(s,x,y,lean=1):
    s.line([(x,y),(x+lean*8,y-3),(x+lean*12,y-8)],'shade')
    s.poly([(x+lean*3,y-2),(x+lean*2,y-8),(x+lean*5,y-5)],'light',None)
    s.poly([(x+lean*6,y-3),(x+lean*12,y-3),(x+lean*8,y)],'leaf',None)
    s.poly([(x+lean*9,y-5),(x+lean*15,y-10),(x+lean*12,y-4)],'light',None)

def bamboo(p):
    dx,dy=shift(p);s=Ink(64,BAMBOO,(dx,dy))
    if p=='dead':
        s.offset=(0,0)
        s.poly([(8,57),(25,50),(31,54),(15,60)],'base')
        s.poly([(28,55),(40,48),(45,52),(34,59)],'light')
        s.line([(16,53),(19,57)],'knot',2);s.line([(36,50),(39,54)],'knot',2)
        s.poly([(43,56),(49,50),(54,52),(51,59)],'shade')
        leaves(s,33,52,-1);leaves(s,47,53,1)
        return s.image
    # Segmented tall bamboo culm, root feet, leaf crown and lash branch.
    for a,b,c in [((25,44),(22,53),(17,58-dy)),((31,44),(33,51),(36,58-dy))]:
        limb(s,a,b,c,3)
        s.line([(c[0]-2,c[1]),(c[0]+3,c[1]+1)],'wood')
    s.poly([(24,42),(22,30),(24,18),(23,13),(27,9),(31,11),(33,20),(32,32),(34,44),(29,49),(24,47)],'base')
    s.poly([(25,13),(27,12),(29,14),(29,45),(26,45)],'light',None)
    s.line([(32,15),(31,30),(32,42)],'shade',2)
    for y in [18,30,42]:
        s.line([(23,y),(32,y+1)],'shade',3);s.line([(23,y-1),(32,y)],'knot')
    # Hollow right-directed mask face in the stem with a protruding broken node.
    s.poly([(28,23),(31,22),(35,24),(37,26),(34,28),(29,28)],'shade')
    s.line([(29,24),(32,24)],'eye');s.dot(34,25,'young')
    s.line([(29,33),(32,33)],'hollow')
    crown={'idle_b':-1,'idle_c':1,'windup':-2,'attack':2,'hit':-3}.get(p,0)
    leaves(s,26,15+crown,-1);leaves(s,30,14-crown,1)
    limb(s,(24,31),(17,35),(13,43),3)
    leaves(s,18,37,-1)
    tip={'windup':(39,13),'move':(47,24),'attack':(54,33),'recover':(43,43),'hit':(41,23)}.get(p,(46,28))
    s.line([(32,32),(38,33),tip],'o',4);s.line([(32,32),(38,33),tip],'base',2)
    s.line([(38,32),(40,33)],'knot');leaves(s,tip[0]-9,tip[1]+4,1)
    return s.image
