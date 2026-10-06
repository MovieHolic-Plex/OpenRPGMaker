"""64x64 trainer pictures drawn directly; no field-sprite enlargement."""
from pixels import Pixels
from cast import palette


def outlined(c,points,fill):
    c.poly(points,'o');c.poly(points,fill)
    c.line(points+[points[0]],'o')


def face(c,role,blink=False,talk=False):
    style=role.head
    # Hair behind the face: distinct cap, fringe, length and rear silhouette.
    c.ellipse((22,5,42,27),'o');c.ellipse((23,6,41,26),'h')
    c.ellipse((25,7,37,14),'H')
    if style in ['bob','long']:
        c.poly([(22,14),(42,14),(44,30),(38,32),(35,27),(28,28),(24,31),(20,29)],'o')
        c.poly([(23,16),(40,16),(42,29),(39,30),(35,25),(25,27),(22,29)],'h')
        c.line([(23,18),(22,27)],'H')
    if style=='ponytail':
        c.poly([(21,12),(26,13),(24,25),(20,34),(16,31),(18,24),(18,17)],'o')
        c.poly([(20,15),(24,14),(22,25),(19,31),(18,30),(20,23)],'h');c.dot(22,15,'a')
    if style=='bun':
        c.ellipse((17,8,26,17),'o');c.ellipse((18,9,25,16),'h');c.ellipse((19,9,23,12),'H')
    if style=='bunches':
        for x in [18,39]:
            c.ellipse((x,15,x+7,24),'o');c.ellipse((x+1,16,x+6,23),'h');c.line([(x+2,17),(x+3,17)],'H');c.dot(x+3,16,'w')
    # Face has an explicit cheek/temple border, lit cheek, shadow temple and chin.
    c.poly([(25,12),(37,12),(40,16),(40,23),(36,27),(29,27),(25,23),(24,17)],'o')
    c.poly([(26,13),(37,13),(39,17),(39,22),(35,26),(29,25),(26,22),(25,17)],'s')
    c.line([(38,17),(38,22),(35,25),(30,25)],'t')
    c.rect((23,18,25,21),'o');c.rect((24,18,25,20),'s')
    # Fringes are hand-shaped clusters, not enlarged dots from16px heads.
    if style=='spiky':
        c.poly([(23,14),(21,9),(25,10),(24,5),(29,7),(30,3),(34,7),(38,4),(38,8),(44,7),(41,12),(42,15),(37,14),(35,17),(32,13),(29,16),(27,13)],'o')
        c.poly([(24,12),(25,9),(27,10),(26,7),(30,9),(31,6),(34,10),(37,7),(37,10),(41,9),(39,12),(39,14),(36,12),(34,14),(32,11),(28,13)],'h')
        c.line([(27,10),(31,9),(34,11)],'H')
    elif style in ['swept','parted','short','slick']:
        c.poly([(23,15),(23,9),(27,6),(36,5),(41,9),(42,14),(37,14),(34,11),(30,15),(28,12),(25,16)],'h')
        c.line([(25,10),(30,8),(35,8)],'H')
        if style=='parted':c.line([(32,8),(30,13)],'o')
        if style=='swept':c.line([(27,11),(36,8),(40,10)],'H')
    elif style in ['bob','long','ponytail','bun','bunches']:
        c.poly([(23,14),(25,8),(35,7),(40,10),(41,16),(36,14),(33,11),(30,15),(28,12),(25,16)],'h')
        c.line([(25,10),(28,9),(32,9)],'H')
        if style=='long':c.line([(37,11),(40,16),(41,27)],'H')
        if style=='bun':c.line([(25,10),(30,8),(35,8),(39,11)],'H')
    if style in ['cap','sailor','helmet','brim','ranger','knit']:
        cloth='w' if style=='sailor' else 'g' if style=='brim' else 'a'
        shade='v' if style=='sailor' else 'b'
        c.poly([(23,11),(25,5),(30,3),(37,4),(41,8),(41,13),(24,13)],'o')
        c.poly([(24,10),(26,6),(31,4),(36,5),(40,8),(40,12),(25,12)],cloth)
        c.line([(26,7),(30,6),(35,6)],'w' if cloth!='w' else 'v')
        if style in ['cap','sailor','helmet','brim','ranger']:
            c.poly([(22,12),(40,11),(46,14),(45,16),(35,15),(23,15)],'o')
            c.line([(23,13),(40,12),(44,14)],cloth,2)
            c.line([(25,15),(39,15)],shade)
        if style in ['sailor','ranger']:c.rect((31,8,33,10),'g')
        if style=='helmet':c.line([(31,5),(31,11)],'g')
        if style=='knit':
            c.line([(24,11),(40,11)],'b',3)
            c.line([(28,6),(28,9)],'b');c.line([(34,5),(34,9)],'b')
    if style=='slick':
        c.rect((26,17,31,20),'d');c.rect((33,17,39,20),'d');c.line([(31,18),(33,18)],'d');c.dot(27,17,'H');c.dot(34,17,'H')
    elif style=='bun':
        c.rect((26,17,31,21),'o');c.rect((33,17,38,21),'o');c.rect((27,18,30,20),'s');c.rect((34,18,37,20),'s');c.line([(31,18),(33,18)],'o')
        if blink:c.line([(28,19),(30,19)],'d');c.line([(35,19),(37,19)],'d')
        else:c.rect((29,18,30,19),'d');c.rect((36,18,37,19),'d')
    else:
        if blink:c.line([(28,18),(30,18)],'d');c.line([(35,18),(37,18)],'d')
        else:
            c.rect((28,17,30,19),'w');c.rect((35,17,37,19),'w');c.line([(30,17),(30,19)],'d');c.line([(37,17),(37,19)],'d')
    c.dot(33,21,'t')
    if talk:c.rect((31,23,34,24),'o');c.line([(32,23),(33,23)],'t')
    else:c.line([(31,23),(33,23)],'t')
    if style=='knit':c.line([(28,23),(30,25),(35,25),(37,23)],'h',2);c.line([(32,23),(34,23)],'t')
    if style=='bunches':
        c.poly([(25,8),(29,6),(36,6),(40,8),(39,12),(25,12)],'o')
        c.poly([(26,8),(29,7),(36,7),(39,8),(38,11),(26,11)],'w');c.line([(32,8),(32,10)],'a');c.line([(31,9),(33,9)],'a')


def hand(c,center):
    x,y=center;c.ellipse((x-2,y-2,x+2,y+2),'o');c.ellipse((x-1,y-1,x+1,y+1),'s');c.dot(x+1,y+1,'t')


def arm(c,start,elbow,end,cloth):
    c.line([start,elbow,end],'o',6);c.line([start,elbow],cloth,4);c.line([elbow,end],'t',3);c.line([elbow,end],'s');hand(c,end)


def render(role,gesture=None,blink=False,talk=False):
    c=Pixels((64,64),palette(role));style=role.outfit
    # Stance silhouette, rear leg first; each native boot has toe/sole clusters.
    c.poly([(31,41),(38,41),(39,50),(43,58),(45,58),(45,61),(37,61),(35,52),(31,49)],'o')
    c.poly([(32,43),(37,43),(37,51),(41,58),(38,59),(34,51),(32,48)],'t' if style in ['dress','apron','vest'] else 'q')
    c.line([(38,59),(43,59)],'r');c.line([(39,58),(42,58)],'g')
    c.poly([(25,41),(32,41),(32,48),(28,56),(29,59),(31,59),(31,62),(21,62),(21,60),(23,57),(24,48)],'o')
    leg='s' if style in ['dress','apron','vest'] else 'p'
    c.poly([(26,43),(31,43),(30,49),(26,57),(25,59),(23,59),(25,51)],leg)
    c.line([(24,60),(29,60)],'r');c.line([(24,59),(27,59)],'g')
    # Neck and shoulders have distinct rounded native steps, never antialiasing.
    c.rect((28,24,35,29),'o');c.rect((29,25,34,28),'s');c.line([(29,27),(34,27)],'t')
    body='w' if style=='coat' else 'p' if style=='vest' else 'a'
    shade='v' if style=='coat' else 'q' if style=='vest' else 'b'
    c.poly([(24,28),(29,27),(35,27),(41,31),(39,42),(37,46),(23,45),(22,40),(22,32)],'o')
    c.poly([(25,29),(30,29),(35,28),(39,32),(37,42),(35,44),(24,43),(24,38),(24,32)],body)
    c.line([(37,32),(36,42),(34,43)],shade,2)
    c.line([(25,30),(27,29)],'w')
    if style in ['vest','jacket','coat','uniform']:
        c.poly([(28,28),(33,30),(36,28),(35,36),(30,41),(27,34)],'w')
        c.line([(31,31),(31,40)],'v')
    if style=='jacket':c.line([(25,31),(26,39)],'b');c.line([(35,31),(36,38)],'b')
    if style=='uniform':c.poly([(30,30),(33,30),(34,34),(32,37),(30,33)],'g')
    if style=='apron':
        c.poly([(27,30),(35,30),(35,36),(38,45),(24,45),(27,36)],'v')
        c.poly([(28,31),(34,31),(34,37),(36,43),(26,43),(28,36)],'w');c.rect((29,38,33,41),'v');c.line([(29,38),(33,38)],'a')
    if style=='overalls':
        c.rect((25,29,27,36),'p');c.rect((35,29,37,36),'p');c.rect((26,34,36,43),'p');c.rect((29,36,33,39),'q');c.line([(29,36),(33,36)],'g');c.dot(27,34,'g');c.dot(35,34,'g')
    if style=='coat':
        c.poly([(24,31),(29,30),(30,40),(29,52),(20,51),(22,41)],'o');c.poly([(25,32),(28,32),(28,42),(27,50),(22,50),(24,41)],'w')
        c.poly([(35,30),(40,32),(40,45),(44,50),(36,52),(32,43)],'o');c.poly([(36,32),(39,33),(38,44),(42,49),(37,50),(34,42)],'w')
        c.line([(23,42),(26,42),(26,45)],'v');c.line([(37,42),(39,42)],'v')
    if style in ['dress','tunic']:
        c.poly([(23,39),(37,39),(42,49),(21,49)],'o');c.poly([(24,40),(36,40),(40,47),(23,47)],'a');c.line([(25,41),(24,46)],'b');c.line([(33,41),(36,47)],'b');c.line([(24,48),(39,48)],'b')
    if style not in ['coat','apron']:
        c.line([(24,41),(37,41)],'o',2);c.rect((30,40,33,42),'g');c.dot(31,41,'w')
    # Gesture differences are actual elbows, hands and props at authored positions.
    pose=gesture or role.pose;sleeve='w' if style in ['coat','apron','vest','overalls'] else 'a'
    if pose in ['book','neutral','blink','talk','explain','beacon','farewell']:
        arm(c,(24,32),(20,38),(24,43),sleeve)
        c.rect((18,36,27,46),'o');c.rect((19,37,25,44),'g');c.line([(25,37),(25,44)],'w');c.line([(20,39),(23,39)],'b');hand(c,(25,43))
    elif pose=='satchel':
        arm(c,(24,32),(19,39),(20,44),sleeve)
        c.line([(27,28),(24,39),(20,42)],'g',2);c.rect((15,42,23,51),'o');c.rect((16,43,22,49),'g');c.line([(16,45),(22,45)],'b');c.dot(20,45,'w')
    else:arm(c,(24,32),(20,38),(22,44),sleeve)
    if pose in ['orb','beacon']:
        arm(c,(39,32),(44,36),(49,27),sleeve)
        c.ellipse((45,20,53,28),'o');c.ellipse((46,21,52,27),'a');c.line([(46,25),(52,25)],'o');c.ellipse((48,23,50,25),'w');c.dot(47,22,'w')
    elif pose in ['wave','farewell']:
        arm(c,(39,32),(46,32),(47,18),sleeve)
        c.line([(46,18),(45,15)],'o');c.line([(47,18),(47,14)],'o');c.line([(48,18),(49,15)],'o');c.line([(46,18),(46,15)],'s');c.line([(48,18),(48,15)],'s')
    elif pose in ['explain','care']:
        arm(c,(39,32),(43,37),(52,34),sleeve);c.line([(51,33),(55,33)],'o');c.line([(51,33),(54,33)],'s')
    elif pose=='tool':
        arm(c,(39,32),(44,38),(49,34),sleeve);c.line([(49,29),(48,44)],'o',3);c.line([(49,30),(48,43)],'g');c.rect((45,26,54,30),'o');c.rect((46,27,53,29),'v');c.dot(46,27,'w')
    elif pose=='badge':
        arm(c,(39,32),(44,35),(45,29),sleeve);c.rect((43,25,49,31),'o');c.rect((44,26,48,30),'g');c.dot(46,28,'w');c.line([(35,29),(35,36)],'b')
    else:arm(c,(39,32),(43,38),(40,44),sleeve)
    face(c,role,blink=blink or pose=='blink',talk=talk or pose=='talk')
    return c.image


def hero_back(role):
    c=Pixels((64,64),palette(role))
    c.poly([(17,37),(26,31),(37,31),(43,37),(45,60),(40,62),(16,62),(14,55)],'o')
    c.poly([(18,38),(27,33),(37,33),(41,38),(43,59),(39,61),(17,61),(16,54)],'w')
    c.line([(18,41),(18,54)],'v',3)
    c.poly([(22,38),(27,35),(35,36),(38,42),(37,62),(21,62),(20,43)],'o')
    c.poly([(24,39),(28,37),(34,38),(36,43),(35,60),(23,60),(22,44)],'g')
    c.line([(25,40),(25,45)],'w');c.rect((25,49,33,57),'b');c.line([(25,49),(33,49)],'o');c.dot(30,50,'w')
    arm(c,(40,39),(48,43),(54,29),'w')
    c.ellipse((50,22,58,30),'o');c.ellipse((51,23,57,29),'a');c.line([(51,27),(57,27)],'o');c.dot(54,26,'w')
    c.ellipse((17,8,41,32),'o');c.ellipse((18,9,40,31),'h')
    c.poly([(17,22),(22,24),(24,30),(21,33),(25,34),(30,29),(33,32),(38,30),(41,24),(37,18)],'h')
    c.line([(21,24),(23,28),(25,28)],'H');c.line([(29,19),(31,25),(34,27)],'H')
    c.poly([(18,15),(20,8),(26,5),(34,6),(40,10),(41,17),(39,20),(20,20)],'o')
    c.poly([(19,14),(21,9),(27,6),(33,7),(39,11),(40,16),(38,18),(21,18)],'a')
    c.line([(22,17),(36,17)],'b',2);c.line([(26,8),(32,8)],'w')
    return c.image
