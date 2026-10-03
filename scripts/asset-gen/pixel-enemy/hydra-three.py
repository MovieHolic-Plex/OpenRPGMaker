"""Hand-authored integer pixel clusters. No image input or generated-art conversion."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
CELL = 96
POSES = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"]
PALETTE = {
    'o':'#17282e', 'd':'#253c3b', 's':'#355348', 'm':'#526c4c',
    'g':'#7b8a53', 'h':'#b2b575', 'b':'#5c503e', 'c':'#8c7046',
    't':'#bea05d', 'y':'#e4cb85', 'i':'#f3e3ae', 'r':'#542d38',
    'R':'#a6514b', 'e':'#eeac42', 'z':'#fff0a1', 'v':'#3c3542',
}
COLORS = {k: tuple(bytes.fromhex(v[1:]))+(255,) for k,v in PALETTE.items()}
def draw(pose):
    im = Image.new('RGBA', (CELL, CELL))
    d = ImageDraw.Draw(im)
    # Each contour is rastered directly on the final 96px grid. No image resampling.
    # The original sketch uses integer 160px coordinates; joints change before drawing.
    upper = {'idle_a':(0,0), 'idle_b':(0,1), 'idle_c':(0,2),
             'windup':(5,-3), 'move':(-3,1), 'attack':(-8,4),
             'recover':(-2,2), 'hit':(5,3), 'dead':(0,0)}[pose]
    def point(p):
        x,y = p
        if y < 100:
            weight = max(0, min(1, (112-y)/45))
            x += round(upper[0]*weight)
            y += round(upper[1]*weight)
        if pose == 'move' and y > 126 and x < 85:
            x -= 2
        return (round(x*3/5), round(y*3/5)+(1 if pose == 'dead' else 3))
    def put(x,y,col):
        im.putpixel(point((x,y)), COLORS[col])

    def poly(points, color, edge=True):
        points = [point(p) for p in points]
        d.polygon(points, fill=COLORS[color])
        if edge:
            d.line(points+[points[0]], fill=COLORS['o'], width=1)

    def line(points, color, width=1):
        d.line([point(p) for p in points], fill=COLORS[color], width=width)

    def cluster(x,y,rows):
        for j,row in enumerate(rows):
            for k,ch in enumerate(row):
                if ch != '.': put(x+k,y+j,ch)

    def scales(coords, base='g', dark='s'):
        # Individually positioned three-pixel shoulders, not a texture/noise fill.
        for x,y in coords:
            cluster(x,y,[base+base+'.','.'+base+dark])

    # Tail behind the body: a tapering S curve with a readable pointed tip.
    poly([(104,104),(117,108),(129,106),(138,98),(141,90),(139,81),
          (134,75),(135,69),(141,64),(148,62),(145,66),(140,71),
          (143,77),(148,82),(151,89),(150,100),(145,110),(136,119),
          (120,126),(105,120)],'s')
    poly([(116,110),(130,109),(140,101),(145,93),(144,84),(148,90),
          (146,102),(138,114),(124,120),(112,118)],'m',False)
    line([(122,110),(133,108),(141,101),(145,93)],'g',2)
    line([(138,76),(142,80),(145,86)],'g')
    for pts in [[(119,106),(122,100),(125,107)],[(129,103),(131,96),(134,100)],
                [(138,95),(136,88),(141,90)],[(140,82),(133,80),(138,77)]]:
        poly(pts,'c')
    scales([(121,115),(129,111),(138,104),(145,95),(143,83)],'g')

    # Far legs remain cooler/darker so the foreground legs read separately.
    poly([(89,114),(100,120),(95,133),(89,137),(83,141),(72,141),
          (73,137),(82,131),(82,123)],'d')
    poly([(115,114),(126,118),(130,130),(127,138),(116,140),
          (108,138),(115,132),(113,125)],'d')
    poly([(76,136),(82,136),(79,140),(74,141)],'c')
    poly([(116,135),(120,136),(118,140),(113,140)],'c')

    # Barrel body, folded hip and the ridge between three independent neck roots.
    poly([(60,96),(72,88),(92,87),(108,93),(118,104),(122,114),
          (118,126),(110,133),(91,134),(78,129),(66,120),(59,110)],'m')
    poly([(91,90),(108,96),(119,108),(121,117),(114,128),
          (101,132),(91,127),(101,117),(100,105)],'s',False)
    poly([(65,98),(75,93),(91,94),(102,102),(96,109),
          (76,109),(64,105)],'g',False)
    poly([(68,109),(81,105),(99,113),(100,123),(92,130),
          (79,124),(69,117)],'b',False)
    scales([(70,99),(76,96),(85,97),(94,101),(99,105),(106,107),
            (106,115),(112,111),(115,119),(104,124),(99,120),(67,108)])
    for pts in [[(93,91),(98,82),(101,94)],[(103,95),(112,88),(110,101)],
                [(114,103),(123,101),(117,110)]]:
        poly(pts,'c')

    # Lower left neck: bent forward, with its own uninterrupted outside contour.
    poly([(70,112),(60,108),(51,99),(45,88),(39,82),(38,72),
          (44,71),(52,77),(59,89),(67,95),(77,103)],'s')
    poly([(66,106),(55,98),(49,86),(45,77),(49,78),
          (58,93),(68,99),(73,105)],'g',False)
    poly([(61,109),(54,105),(47,94),(42,85),(43,80),(48,85),
          (55,97),(64,103),(69,108)],'c')
    poly([(58,103),(51,94),(46,84),(47,82),(53,93),(63,102)],'t',False)
    line([(46,86),(50,85)],'b')
    line([(48,91),(54,89)],'b')
    line([(52,97),(57,94)],'b')
    line([(57,103),(63,100)],'b')
    line([(62,107),(67,104)],'b')
    scales([(52,79),(56,86),(62,93),(66,98)],'m','d')

    # Right neck: rises behind the central neck and hooks back toward the left.
    poly([(101,117),(114,108),(125,94),(130,81),(129,68),(123,60),
          (113,58),(110,63),(119,74),(119,85),(112,96),(99,102)],'s')
    poly([(118,68),(124,70),(126,80),(124,92),(116,104),
          (106,112),(101,110),(113,98),(120,85)],'m',False)
    poly([(111,65),(118,68),(122,79),(121,90),(115,103),
          (107,111),(100,115),(99,107),(110,95),(115,84),(114,73)],'c')
    poly([(115,74),(118,80),(117,91),(111,101),(103,110),
          (100,110),(109,97),(113,85)],'t',False)
    for pts in [[(114,76),(120,75)],[(114,83),(121,83)],[(112,90),(119,93)],
                [(108,97),(115,101)],[(103,104),(109,109)]]:
        line(pts,'b')
    scales([(124,76),(125,83),(120,95),(115,102)],'g')
    for pts in [[(129,75),(137,78),(130,81)],[(129,84),(135,90),(126,91)],
                [(124,95),(128,103),(120,101)]]:
        poly(pts,'c')

    # Dominant neck: a tall S with broad chest plates, no overlaps at the heads.
    poly([(67,111),(64,100),(67,87),(74,74),(78,62),(77,52),
          (74,46),(77,35),(88,35),(94,45),(95,57),(93,68),
          (86,82),(85,93),(90,107),(83,120),(74,120)],'m')
    poly([(86,39),(92,46),(93,57),(90,69),(82,84),(81,96),
          (86,108),(80,117),(76,106),(76,95),(79,81),(85,68),
          (88,56)],'s',False)
    poly([(76,50),(80,50),(84,56),(84,66),(79,78),(73,90),
          (72,101),(78,112),(77,120),(69,114),(66,102),(68,90),
          (75,75),(79,62)],'c')
    poly([(77,55),(80,58),(81,66),(76,77),(71,87),(70,99),
          (74,109),(72,113),(68,103),(70,88),(76,75),(78,64)],'t',False)
    line([(77,58),(82,59)],'b')
    line([(77,65),(82,67)],'b')
    line([(74,72),(80,74)],'b')
    line([(72,80),(77,82)],'b')
    line([(69,88),(74,91)],'b')
    line([(68,97),(73,98)],'b')
    line([(69,105),(76,104)],'b')
    line([(72,112),(77,110)],'b')
    scales([(88,47),(89,53),(88,61),(84,72),(80,82),(79,91),(81,102)],'g')
    line([(81,41),(86,46),(88,51)],'g',2)
    for pts in [[(93,46),(102,50),(95,54)],[(95,57),(102,64),(92,64)],
                [(91,69),(97,77),(87,77)],[(86,82),(92,87),(84,91)]]:
        poly(pts,'c')

    def head(x,y,open_jaw=True, crest=0):
        def P(points,col,edge=True):poly([(x+a,y+b) for a,b in points],col,edge)
        def L(points,col,width=1):line([(x+a,y+b) for a,b in points],col,width)
        # Two backward curving horns, separated from the brow and neck.
        P([(20,7),(21,1),(25,-5-crest),(26,-11-crest),(28,-5),
           (27,2),(25,8)],'c')
        P([(22,5),(24,0),(26,-5),(27,-5),(26,2),(24,6)],'y',False)
        P([(30,9),(33,4),(36,-3),(35,5),(33,11)],'c')
        L([(32,8),(34,5),(35,1)],'t')
        # Swept cheek fins and ear give the skull a dragon silhouette.
        P([(30,11),(37,9),(34,15),(38,17),(32,20),(35,25),(28,22)],'b')
        P([(31,13),(34,12),(32,17),(34,18),(29,21)],'c',False)
        L([(30,13),(28,20)],'t')
        # Forehead, overhanging brow, snout and chunky facial planes.
        P([(9,12),(12,9),(18,8),(22,5),(26,6),(31,10),(32,16),
           (30,23),(25,26),(21,24),(18,20),(8,21),(3,20),(0,17),
           (1,13),(5,12)],'m')
        P([(11,10),(19,9),(23,7),(27,8),(29,11),(22,13),
           (15,14),(8,16),(3,16),(2,14),(7,13)],'g',False)
        P([(15,10),(20,9),(23,8),(25,9),(19,11)],'h',False)
        P([(25,15),(30,14),(30,20),(26,24),(23,23),(24,19)],'s',False)
        P([(9,18),(18,16),(22,17),(24,22),(21,25),(15,24),
           (7,22),(3,20)],'d',False)
        L([(3,17),(8,18),(12,17)],'s')
        cluster(x+3,y+13,['oo.','dm.'])
        cluster(x+10,y+11,['gh.','mg.'])
        # Yellow eye beneath a dark slanted brow; pupil stays one pixel wide.
        L([(14,12),(18,12),(22,14)],'o',2)
        cluster(x+16,y+14,['eze.','teo.'])
        put(x+18,y+14,'o')
        put(x+17,y+15,'e')
        L([(22,16),(25,15)],'g')
        L([(23,19),(26,20),(28,18)],'d')
        # Mouths are red-black, with deliberately spaced bone teeth.
        if open_jaw:
            P([(4,20),(12,20),(20,18),(23,20),(22,24),(19,29),
               (13,33),(9,33),(5,29),(3,25)],'r')
            P([(4,21),(12,21),(20,19),(22,20),(20,23),(11,24),(5,23)],'v',False)
            P([(5,23),(9,25),(11,29),(15,30),(19,27),(17,31),
               (11,32),(7,29)],'R',False)
            P([(4,26),(7,29),(12,33),(18,30),(22,25),(25,25),
               (22,31),(17,35),(11,36),(6,33),(3,29)],'m')
            L([(6,31),(11,34),(16,34),(20,31)],'g')
            for a,b in [(5,21),(10,21),(16,20),(20,20)]:
                cluster(x+a,y+b,['ii','y.'])
            P([(5,21),(8,21),(7,25),(6,26)],'i',False)
            L([(7,22),(7,24)],'y')
            P([(18,20),(21,20),(20,24),(19,25)],'i',False)
            for a,b in [(8,30),(13,32),(18,29)]:
                cluster(x+a,y+b,['.i','yi'])
            cluster(x+13,y+28,['RRR','rR.'])
        else:
            P([(3,21),(8,23),(15,24),(21,22),(24,23),(22,26),
               (15,29),(9,28),(5,26)],'r')
            P([(5,25),(10,27),(16,27),(22,24),(25,24),
               (23,28),(17,31),(10,30),(6,28)],'m')
            L([(9,29),(16,29),(21,27)],'g')
            for a,b in [(6,22),(12,23),(19,22)]:cluster(x+a,y+b,['ii','y.'])
        # Selected cheek scales, three-pixel clusters, no blanket dithering.
        scales([(x+25,y+10),(x+28,y+12),(x+27,y+22)],'g','s')
        L([(1,15),(5,15),(8,14)],'h')
        L([(11,17),(15,16),(19,17)],'g')
        L([(23,17),(25,18),(25,21)],'o')
        cluster(x+9,y+15,['mgs','ss.'])
        cluster(x+28,y+18,['mg','sd'])
        L([(17,9),(21,8),(24,9)],'h')

    # Jaw silhouettes change with the breath windup and attack, not a bitmap tween.
    head(14,58,pose == 'attack',0)
    head(99,43,pose not in ('windup','hit'),1)
    head(51,20,pose not in ('windup','hit'),3)

    # Foreground hip and limbs overlap the neck roots, tying the monster together.
    poly([(107,111),(116,114),(121,123),(120,130),(127,138),
          (138,140),(141,144),(136,146),(126,145),(119,145),
          (112,140),(109,132),(102,129),(101,119)],'m')
    poly([(106,114),(113,114),(117,120),(116,125),(109,127),
          (104,123)],'g',False)
    poly([(115,125),(118,129),(123,138),(134,141),(132,144),
          (121,142),(114,135),(111,129)],'s',False)
    line([(105,119),(108,116),(112,117)],'h')
    line([(113,133),(118,140),(124,141)],'g')
    scales([(107,121),(111,124),(115,130),(119,136),(127,141)])
    for pts in [[(128,141),(132,139),(134,143),(132,147),(130,145)],
                [(134,143),(138,141),(140,145),(138,148),(136,146)],
                [(120,141),(123,140),(125,144),(124,147),(122,146)]]:
        poly(pts,'c')
        line([pts[0],pts[1],pts[2]],'i')

    poly([(70,111),(78,110),(84,115),(82,122),(73,128),(66,137),
          (65,143),(59,146),(44,146),(36,144),(38,139),
          (48,136),(54,126),(56,118),(62,113)],'m')
    poly([(62,114),(70,113),(74,115),(72,120),(65,124),(60,123)],'g',False)
    poly([(72,121),(77,119),(76,124),(69,130),(61,139),(48,142),
          (42,142),(51,138),(57,129),(62,124)],'s',False)
    line([(60,119),(64,115),(68,115)],'h')
    line([(58,125),(57,130),(54,133)],'g',2)
    line([(47,138),(52,138),(57,136)],'g')
    scales([(63,118),(69,116),(65,123),(59,129),(54,136),(46,140)])
    for pts in [[(37,140),(42,138),(44,141),(41,146),(38,147)],
                [(45,141),(49,139),(51,143),(49,147),(46,148)],
                [(53,142),(57,140),(59,143),(57,147),(54,148)]]:
        poly(pts,'c')
        line([pts[0],pts[1],pts[2]],'i')

    # A small center plate joins the three necks without bright empty-space fills.
    poly([(75,108),(79,113),(83,110),(88,113),(86,120),(80,126),
          (74,121),(71,116)],'c')
    poly([(76,112),(79,115),(82,113),(85,114),(82,119),
          (79,122),(75,118)],'t',False)
    line([(73,117),(78,119),(85,117)],'b')


    if pose == 'dead':
        # Three fallen heads, folded necks and a grounded torso are drawn separately.
        im = Image.new('RGBA', (CELL, CELL))
        d = ImageDraw.Draw(im)
        poly([(26,143),(40,123),(61,126),(81,139),(105,135),(125,143),
              (140,145),(142,150),(39,151)], 's')
        poly([(38,139),(49,130),(62,135),(75,143),(106,141),(116,147),
              (72,149),(44,146)], 'm',False)
        poly([(40,142),(43,130),(64,126),(72,138),(90,136),(103,146),
              (66,150)],'c')
        line([(47,138),(60,134),(66,144),(88,142)],'t',2)
        head(13,116,False,0)
        head(53,119,False,1)
        head(96,115,False,0)
        for x,y in [(13,116),(53,119),(96,115)]:
            line([(x+14,y+14),(x+20,y+16)],'o',2)
    # Enemies stand at the left and face the party on the right.
    return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def main():
    frames = [draw(pose) for pose in POSES]
    sheet = Image.new('RGBA', (CELL*3,CELL*3))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i%3*CELL,i//3*CELL))
    colors = {c for _,c in sheet.getcolors(CELL*CELL*9) if c[3]}
    assert len(colors) <= 16
    assert set(sheet.getchannel('A').tobytes()) == {0,255}
    for pose, frame in zip(POSES, frames):
        box=frame.getbbox()
        assert box and box[0]>0 and box[1]>0 and box[2]<CELL and box[3]<=CELL-3, (pose,box)
    destination = ROOT/'public/assets/generated'
    (destination/'pixel-enemies').mkdir(parents=True, exist_ok=True)
    (destination/'pixel-enemy-portraits').mkdir(parents=True, exist_ok=True)
    sheet.save(destination/'pixel-enemies/hydra-three.png')
    frames[0].save(destination/'pixel-enemy-portraits/hydra-three.png')
    print(json.dumps({'cell':CELL,'colors':len(colors),'frames':POSES,'alpha':[0,255]}))


if __name__ == '__main__':
    main()
