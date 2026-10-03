"""Eight original 96px boss redraws. Every polygon is painted on the final grid.

Dragon species share joint helpers, with separate silhouettes, armor and wings.
No input raster, interpolated bitmap, rotated sprite or generative image is used.
"""
import math
from common import Canvas, POSES, run_group

BASE = dict(o='182831',k='242b38',d='3c454b',s='4c656c',m='6c8c90',l='a5b9ad',h='d4dac0',w='fff0c5',e='f6cb63',r='663445',R='a24e58',q='d37b74',b='51414c',B='92705e',t='c6a172',y='e5cd93',g='416552',G='73a281',a='a65e41',A='d69357',v='70566e',V='b998a4')
RIG={
 'idle_a':(0,0,0,0,0,0), 'idle_b':(0,1,0,1,2,0),
 'idle_c':(0,0,-1,-1,-2,1), 'windup':(-2,2,-4,1,-7,-2),
 'move':(2,-1,2,-1,6,3), 'attack':(3,1,5,4,9,4),
 'recover':(1,1,2,2,1,1), 'hit':(-3,3,-3,2,-5,-2),
 'dead':(0,0,0,0,0,0)
}

def tube(c,pts,width,body='m',dark='s',light='l'):
    """Stepped polygon joints, drawn anew for each pose at native resolution."""
    c.line(pts,'o',width+2);c.line(pts,body,width)
    c.line([(x-1,y-1) for x,y in pts],light,max(1,width//3))
    c.line([(x+1,y+2) for x,y in pts],dark,max(1,width//3))

def plate(c,pts,base='m'):
    c.poly(pts,base,'o')
    a,b=pts[0],pts[1]
    c.line([a,b],'l')

def claws(c,x,y,n=3):
    for i in range(n):
        c.poly([(x+i*4,y),(x+i*4+3,y),(x+i*4+2,y+3),(x+i*4-1,y+3)],'h','o')
        c.pixel(x+i*4+1,y,'w')

def dragon_palette(kind):
    if kind=='dragon':return dict(BASE,d='3e3039',s='744443',m='a9664e',l='d99162',h='e1c38d',g='583843',G='8e4d53',v='674044',V='bd7970')
    if kind=='dragon-red':return dict(BASE,d='462e3b',s='7e3f48',m='b75451',l='da8370',h='ecc08c',g='5f3546',G='974955',v='533d4e',V='ac6a6d')
    if kind=='dragon-blue':return dict(BASE,d='253e51',s='385d78',m='478baa',l='78b9c1',h='c0e4d7',g='394566',G='707598',v='354464',V='697eaf')
    if kind=='wyvern-cliff':return dict(BASE,d='383749',s='635668',m='8d7282',l='b19aa0',h='dcc4aa',g='454b5c',G='758384',v='594657',V='9a6c7a')
    return BASE

def dragon_head(c,origin,pose,kind,collapsed=False):
    ox,oy=origin
    def p(pts,col,outline=None):c.poly([(ox+x,oy+y) for x,y in pts],col,outline)
    def line(pts,col,w=1):c.line([(ox+x,oy+y) for x,y in pts],col,w)
    long=kind=='wyvern-cliff'; blue=kind=='dragon-blue'
    # Two unequal backward horns reveal the head's near/far planes.
    p([(6,0),(2,-9),(5,-5),(11,1)],'B','o')
    p([(10,-2),(9,-11),(13,-5),(17,0)],'h','o')
    line([(10,-9),(11,-5),(13,-3)],'w')
    if blue:
        p([(3,0),(-5,-8),(-3,3),(-11,2),(-4,8),(-9,14),(3,14),(7,10)],'V','o')
        line([(-4,-5),(0,3),(-6,4),(0,8),(-5,11)],'h')
        p([(11,-2),(12,-13),(16,-7),(16,-1)],'h','o')
    elif kind=='dragon-red':
        p([(2,2),(-7,-3),(-4,7),(-8,13),(3,15)],'G','o')
        p([(3,1),(-7,-4),(-5,-8),(4,-3),(9,0)],'h','o')
        line([(-4,-6),(1,-3),(4,-2)],'w')
        line([(-2,3),(1,7),(-1,11)],'R')
    p([(1,1),(7,-3),(16,-3),(22,1),(27,2),(31,6),(30,11),(24,13),(14,13),(10,17),(2,14),(-2,8)],'m','o')
    p([(2,2),(7,-1),(15,-1),(18,2),(13,4),(5,5)],'l')
    p([(1,9),(8,10),(13,14),(10,17),(3,14)],'s')
    p([(14,5),(22,4),(28,5),(30,8),(25,9),(16,8)],'l')
    line([(17,5),(24,5),(27,6)],'h')
    line([(2,8),(6,7),(8,8)],'d')
    line([(27,8),(28,8)],'o')
    # Brow and pupil stay coherent with the snout, not pasted onto an ellipse.
    p([(9,3),(14,2),(17,4),(16,7),(10,7)],'o')
    if pose in ['hit','dead'] or (pose=='idle_c' and blue):
        line([(10,5),(15,5)],'B')
    else:
        line([(10,4),(14,4)],'e');line([(12,4),(12,6)],'o');c.pixel(ox+14,oy+4,'w')
    openjaw=pose not in ['windup','hit','dead']
    gap=7 if pose=='attack' else 4 if not collapsed else 0
    if long:gap+=2
    if openjaw:
        p([(13,12),(23,12),(29,10),(28,14+gap),(20,18+gap),(13,15+gap)],'r','o')
        p([(16,15+gap),(23,14+gap),(25,15+gap),(21,17+gap),(17,17+gap)],'q')
        for x,y in [(16,12),(23,12),(27,11)]:p([(x,y),(x+2,y),(x+1,y+3)],'w')
        p([(24,16+gap),(22,15+gap),(21,17+gap)],'h')
        p([(11,16+gap),(17,20+gap),(23,20+gap),(29,16+gap),(28,19+gap),(22,23+gap),(15,22+gap),(10,19+gap)],'m','o')
        line([(13,19+gap),(18,21+gap),(23,21+gap),(27,19+gap)],'l')
    else:
        p([(12,12),(20,14),(28,12),(28,15),(21,18),(15,17),(10,14)],'m','o')
        line([(15,14),(22,15),(28,13)],'d')
        p([(24,13),(26,13),(25,16)],'h')
    if long:
        p([(25,4),(31,5),(34,8),(31,11),(28,10)],'h','o')
        line([(26,5),(32,7)],'w')
        p([(6,-1),(1,-7),(9,-3)],'V','o')
    elif blue:
        p([(27,4),(32,5),(31,8),(28,9)],'h','o')
    elif kind=='dragon-red':
        p([(1,9),(6,9),(12,13),(10,17),(3,17),(-1,13)],'G','o')
        line([(2,11),(6,12),(8,14)],'l')

def wing(c,dx,dy,flex,kind,near=True,fallen=False):
    if fallen:
        pts=[(12,72),(23,69),(40,76),(54,88),(34,86),(24,90),(19,82),(9,84)]
        c.poly(pts,'v','o');c.line([(13,73),(27,79),(48,87)],'s',2)
        c.line([(23,71),(26,82)],'V');return
    if kind=='dragon-blue':
        pts=[(52,59),(42,31),(32,8+max(0,flex)),(28,4+max(0,flex)),(25,20),(13,18),(17,36),(7,45),(21,48),(23,63),(39,58)]
        rays=[(25,20),(13,18),(7,45),(23,63)]
    elif kind=='wyvern-cliff':
        pts=[(51,62),(43,28),(25,8+flex),(20,4+max(0,flex)),(21,26),(8,42),(18,47),(13,61),(26,62),(24,73),(41,66)]
        rays=[(21,26),(8,42),(13,61),(24,73)]
    else:
        pts=[(50,56),(44,29),(32,12+flex),(23,6+max(0,flex)),(25,28),(13,34),(19,49),(10,59),(25,57),(28,69),(42,59)]
        rays=[(25,28),(13,34),(10,59),(28,69)]
    pts=[(x+dx,y+dy) for x,y in pts]
    c.poly(pts,'v','o')
    c.poly([(50+dx,56+dy),(41+dx,35+dy),(25+dx,28+dy),(29+dx,42+dy),(43+dx,58+dy)],'V')
    c.poly([(29+dx,42+dy),(19+dx,49+dy),(25+dx,53+dy),(37+dx,51+dy)],'G')
    for x,y in rays:c.line([(43+dx,34+dy),(x+dx,y+dy)],'s',2)
    tube(c,[(50+dx,57+dy),(43+dx,29+dy),(27+dx,13+flex+dy)],3,'m','s','l')
    c.poly([(25+dx,12+flex+dy),(23+dx,5+max(0,flex)+dy),(29+dx,13+flex+dy)],'h','o')

def draconic(kind,pose):
    c=Canvas(96,dragon_palette(kind));dx,dy,hx,hy,wf,stride=RIG[pose]
    upright=kind=='dragon';blue=kind=='dragon-blue';wyvern=kind=='wyvern-cliff'
    if pose=='dead':
        wing(c,0,0,0,kind,fallen=True)
        c.poly([(8,79),(14,83),(25,82),(33,78),(51,76),(68,82),(74,88),(66,92),(29,91),(19,88),(12,89),(6,84)],'m','o')
        c.poly([(23,82),(34,79),(51,78),(61,82),(45,83),(34,88),(24,87)],'l')
        c.poly([(28,87),(39,85),(61,86),(68,91),(36,92)],'s')
        for j in range(4):c.line([(41+j*5,83),(43+j*5,89)],'B')
        tube(c,[(47,84),(56,86),(64,87)],6);claws(c,63,89)
        dragon_head(c,(57,65),pose,kind,True)
        c.line([(65,92),(88,92)],'o');return c.im
    # Far wing remains subordinate and offsets the volume of the near wing.
    c.poly([(51+dx,54+dy),(59+dx,21+max(0,wf)),(66+dx,13+max(0,wf)),(69+dx,31),(80+dx,37),(75+dx,45),(81+dx,56),(68+dx,55)],'d','o')
    c.line([(53+dx,54+dy),(63+dx,26),(69+dx,32)],'s',2)
    # Tail silhouette changes by species; evaluated as polygons every frame.
    tipy=65 if upright else 71
    c.poly([(34+dx,70+dy),(27+dx,72+dy),(20,79),(10,tipy+stride),(6,tipy-8+stride),(7,tipy+7),(14,86),(25,87),(41+dx,79+dy)],'m','o')
    c.poly([(30+dx,75+dy),(21,83),(14,81),(9,tipy+5),(12,tipy+8),(20,85),(28,83)],'l')
    c.line([(7,tipy-5+stride),(9,tipy+3),(14,82)],'s')
    if blue:
        # Long curled tail replaces the heavy terrestrial dragon's straight tip.
        c.poly([(28+dx,76+dy),(20,84),(11,82),(6,75),(5,62),(10,55),(17,54),(23,58),(24,66),(20,71),(14,69),(12,64),(14,60),(18,61),(19,66),(21,64),(20,60),(16,58),(12,59),(9,63),(10,74),(15,79),(22,79)],'m','o')
        c.poly([(11,61),(14,58),(18,59),(20,63),(19,66),(17,65),(16,61),(13,62)],'l')
        c.line([(7,63),(7,73),(12,80),(21,82)],'l')
        c.poly([(9,57),(6,50),(14,53),(18,47),(19,55)],'V','o')
    if wyvern:c.poly([(7,tipy-5+stride),(5,tipy-14+stride),(10,tipy-6+stride)],'h','o')
    # Far feet support the chest; hoof/claw base is fixed at row92.
    for x in ([45,69] if not upright else [56]):
        x+=dx-stride//2
        tube(c,[(x-1,67+dy),(x+1,80),(x-2,89)],6,'s','d','m')
        c.poly([(x-5,87),(x+3,87),(x+7,91),(x+6,92),(x-6,92)],'s','o');claws(c,x+1,89,2)
    wing(c,dx,dy,wf,kind)
    if upright:
        body=[(37,44),(47,39),(57,45),(65,57),(64,72),(58,80),(39,82),(29,73),(30,57)]
    elif blue:
        body=[(26,62),(34,54),(45,53),(57,58),(65,69),(61,78),(51,82),(32,78),(25,70)]
    elif wyvern:
        body=[(30,58),(40,49),(49,47),(58,56),(60,65),(64,74),(55,81),(39,77),(29,68)]
    else:body=[(27,57),(38,48),(49,46),(63,52),(69,63),(64,77),(51,82),(32,79),(25,69)]
    body=[(x+dx,y+dy) for x,y in body]
    c.poly(body,'m','o')
    c.poly([(31+dx,59+dy),(39+dx,51+dy),(49+dx,50+dy),(55+dx,55+dy),(46+dx,57+dy),(39+dx,67+dy),(31+dx,65+dy)],'l')
    c.poly([(28+dx,67+dy),(36+dx,69+dy),(43+dx,78+dy),(55+dx,80+dy),(34+dx,78+dy)],'s')
    # Neck has a tapered S bend with integrated belly plates.
    neck=[(51+dx,59+dy),(54+dx,47+dy),(59+hx,36+hy),(62+hx,29+hy),(73+hx,34+hy),(70+hx,43+hy),(68+dx,57+dy),(64+dx,68+dy)]
    if blue:neck=[(50+dx,64+dy),(55+dx,53+dy),(56+hx,42+hy),(61+hx,29+hy),(65+hx,22+hy),(73+hx,30+hy),(71+hx,43+hy),(68+dx,59+dy),(62+dx,71+dy)]
    c.poly(neck,'m','o')
    c.poly([(56+dx,55+dy),(59+dx,45+dy),(63+hx,37+hy),(67+hx,37+hy),(65+dx,50+dy),(62+dx,62+dy)],'l')
    c.poly([(63+hx,41+hy),(69+hx,42+hy),(66+dx,55+dy),(62+dx,66+dy),(54+dx,75+dy),(47+dx,74+dy),(54+dx,65+dy),(60+dx,52+dy)],'t','o')
    for j in range(4):
        y=49+j*6+dy;x=63-j*3+dx
        c.line([(x-2,y),(x+3,y+1)],'B');c.line([(x-2,y-1),(x+2,y)],'y')
    # Distinct dorsal decoration, never a scattered pixel noise texture.
    for j,(x,y) in enumerate([(34,54),(42,49),(50,48)]):
        if blue:c.poly([(x+dx,y+dy),(x-4+dx,y-12+dy),(x+5+dx,y-4+dy)],'h','o')
        elif kind=='dragon-red':c.poly([(x-3+dx,y+1+dy),(x-4+dx,y-8+dy),(x+4+dx,y-4+dy),(x+6+dx,y+2+dy)],'G','o');c.line([(x-3+dx,y-5+dy),(x+2+dx,y-3+dy)],'l')
        else:c.poly([(x+dx,y+dy),(x-1+dx,y-5+dy),(x+4+dx,y+dy)],'G','o')
    for x,y in [(34,62),(40,59),(46,62),(37,69),(48,70)]:
        c.line([(x+dx,y+dy),(x+2+dx,y+dy),(x+3+dx,y+1+dy)],'s')
        c.pixel(x+dx,y-1+dy,'h')
    # Large near thigh and planted toe fan give the weight of the pose.
    tx=36+dx+(stride//2);ty=73+dy
    c.poly([(tx-6,ty-8),(tx+2,ty-9),(tx+9,ty-3),(tx+8,ty+4),(tx+2,ty+10),(tx+5,89),(tx+9,91),(tx+8,92),(tx-8,92),(tx-9,88),(tx-6,81),(tx-10,ty)],'m','o')
    c.poly([(tx-5,ty-6),(tx+1,ty-6),(tx+5,ty-2),(tx+2,ty+2),(tx-3,ty+1)],'l')
    c.line([(tx+4,ty+5),(tx-2,ty+11),(tx-3,88)],'s',2);claws(c,tx+1,89,2)
    if not wyvern:
        if not upright:
            fx=66+dx+stride//2
            c.poly([(60+dx,63+dy),(67+dx,64+dy),(fx+2,75),(fx,82),(fx+1,89),(fx-6,89),(fx-7,82),(fx-5,77),(fx-9,71)],'m','o')
            c.poly([(61+dx,65+dy),(66+dx,66+dy),(fx-1,75),(fx-5,75),(fx-6,70)],'l')
            c.line([(fx-3,79),(fx-2,86)],'s',2)
            c.poly([(fx-6,87),(fx+1,86),(fx+8,90),(fx+8,92),(fx-7,92)],'m','o');claws(c,fx+1,89,2)
        else:
            hand=9 if pose=='attack' else -5 if pose=='windup' else 0
            tube(c,[(56+dx,52+dy),(61+dx,61+dy),(68+dx+hand,58+dy)],5)
            claws(c,67+dx+hand,57+dy)
    else:
        # Wyvern forelimbs are the wings; the three hooked wing fingers grasp.
        claws(c,27+dx,14+max(0,wf)+dy,2)
    dragon_head(c,(53+hx,23+hy if upright else 22+hy if blue else 29+hy),pose,kind)
    return c.im

def bone_dragon(pose):
    c=Canvas(96,dict(BASE,d='353640',s='666373',m='a49d97',l='d2c6aa',h='f1e2bb',v='483849',V='79606c'))
    dx,dy,hx,hy,wf,stride=RIG[pose]
    if pose=='dead':
        # Loose interlocking bones retain wing, spine and skull identities.
        for pts in [[(8,87),(22,84),(32,89)],[(16,74),(29,85),(42,78)],[(35,90),(51,85),(68,89)],[(47,78),(61,79),(66,86)]]:tube(c,pts,3)
        for x,y in [(27,87),(38,83),(46,89),(54,80)]:c.oval((x-3,y-3,x+3,y+2),'m','o');c.line([(x-2,y-1),(x+1,y-1)],'h')
        dragon_head(c,(57,64),pose,'bone',True)
        c.line([(25,92),(50,92)],'s');return c.im
    # Wing fingers consist of explicit bone joints with torn purple membranes.
    c.poly([(44+dx,52+dy),(34+dx,24+dy),(15,15+max(0,wf)),(22,29),(12,45),(24,42),(27,54),(36,48)],'v','o')
    for pts in [[(47+dx,58+dy),(34+dx,24+dy),(16,13+max(0,wf))],[(34+dx,25+dy),(13,45)],[(34+dx,25+dy),(27,55)]]:tube(c,pts,2)
    spine=[(14,79+stride//2),(25,75),(35+dx,65+dy),(48+dx,59+dy),(59+dx,46+dy),(65+hx,38+hy)]
    tube(c,spine,4)
    for i,(x,y) in enumerate(spine[:-1]):
        c.poly([(x-3,y-2),(x+2,y-3),(x+4,y+1),(x+1,y+4),(x-3,y+2)],'m','o');c.line([(x-2,y-1),(x+1,y-1)],'h')
    c.poly([(37+dx,61+dy),(48+dx,55+dy),(57+dx,59+dy),(60+dx,74+dy),(52+dx,81+dy),(40+dx,77+dy)],'k','o')
    for j in range(5):
        y=58+j*4+dy
        tube(c,[(46+dx,y),(55+dx,y+2),(56+dx,y+5),(49+dx,y+7)],2)
    c.poly([(33+dx,74+dy),(43+dx,72+dy),(50+dx,78+dy),(42+dx,83+dy),(35+dx,82+dy)],'m','o')
    c.poly([(38+dx,76+dy),(44+dx,77+dy),(42+dx,80+dy),(38+dx,80+dy)],'d')
    for x in [36+dx-stride//2,62+dx+stride//2]:
        tube(c,[(x,77+dy),(x-4,85),(x-3,90)],4)
        claws(c,x-5,89,3)
    tube(c,[(59+dx,59+dy),(64+dx,66+dy),(76+dx+hx//2,63+dy)],3);claws(c,76+dx+hx//2,61+dy,2)
    dragon_head(c,(54+hx,25+hy),pose,'bone')
    # Empty cranial holes, exposed jaw and cracked forehead distinguish skeleton.
    ox,oy=54+hx,25+hy
    c.poly([(ox+9,oy+3),(ox+15,oy+2),(ox+17,oy+5),(ox+13,oy+8),(ox+9,oy+6)],'k')
    if pose not in ['hit','dead']:c.line([(ox+12,oy+5),(ox+14,oy+5)],'q')
    c.line([(ox+5,oy-1),(ox+7,oy+1),(ox+6,oy+3)],'s')
    return c.im

def beast_head(c,x,y,pose,kind):
    """Minotaur muzzle and troll brow are separately authored native clusters."""
    if kind=='minotaur-maze':
        # Far horn loops behind the heavy brows.
        c.poly([(x+3,y+2),(x-6,y-3),(x-8,y-12),(x-4,y-8),(x-3,y-3),(x+6,y-1)],'B','o')
        c.poly([(x+12,y),(x+13,y-8),(x+8,y-15),(x+13,y-13),(x+17,y-7),(x+16,y+3)],'h','o')
        c.line([(x+12,y-13),(x+15,y-6)],'w')
        c.poly([(x-3,y+4),(x+3,y-1),(x+12,y-1),(x+17,y+4),(x+15,y+11),(x+19,y+13),(x+19,y+20),(x+12,y+24),(x+2,y+23),(x-2,y+18),(x-5,y+10)],'m','o')
        c.poly([(x-3,y+4),(x+2,y+1),(x+9,y+2),(x+7,y+6),(x+1,y+8)],'l')
        c.poly([(x+8,y+12),(x+16,y+11),(x+20,y+14),(x+18,y+20),(x+10,y+21),(x+7,y+17)],'t','o')
        c.line([(x+10,y+14),(x+16,y+14)],'y')
        c.pixel(x+17,y+16,'o');c.pixel(x+12,y+16,'o')
        c.line([(x+10,y+19),(x+17,y+19)],'b')
        c.poly([(x+1,y+20),(x+6,y+23),(x+11,y+22),(x+9,y+29),(x+5,y+26),(x+2,y+28),(x+1,y+23)],'s','o')
        c.line([(x+2,y+4),(x+8,y+6),(x+12,y+4)],'d',2)
        if pose not in ['hit','dead']:c.line([(x+8,y+8),(x+11,y+8)],'e');c.pixel(x+10,y+8,'o')
        else:c.line([(x+8,y+8),(x+11,y+9)],'o')
        c.poly([(x-2,y+8),(x-9,y+6),(x-8,y+11),(x-2,y+13)],'m','o')
    else:
        c.poly([(x-3,y+3),(x+3,y-1),(x+13,y),(x+19,y+5),(x+22,y+12),(x+19,y+23),(x+10,y+26),(x,y+22),(x-6,y+13)],'m','o')
        c.poly([(x-2,y+4),(x+4,y+2),(x+12,y+3),(x+14,y+6),(x+3,y+7)],'l')
        c.poly([(x+8,y+12),(x+16,y+11),(x+23,y+14),(x+22,y+20),(x+11,y+21),(x+5,y+18)],'s','o')
        c.line([(x+8,y+14),(x+17,y+14)],'l',2)
        c.pixel(x+19,y+16,'o')
        c.poly([(x+6,y+21),(x+9,y+15),(x+11,y+21)],'h','o')
        c.poly([(x+18,y+22),(x+21,y+17),(x+22,y+21)],'h','o')
        c.line([(x+5,y+11),(x+12,y+11),(x+14,y+10)],'d',2)
        if pose not in ['hit','dead']:c.line([(x+10,y+12),(x+13,y+12)],'e')
        else:c.line([(x+10,y+12),(x+13,y+13)],'o')
        c.poly([(x-3,y+8),(x-10,y+6),(x-8,y+14),(x-3,y+15)],'m','o')
        for xx,yy in [(0,3),(5,1),(12,2),(17,5)]:c.poly([(x+xx,y+yy),(x+xx-2,y+yy-5),(x+xx+2,y+yy-2)],'g','o')

def axe(c,x,y,angle=0,fallen=False):
    # Explicit local coordinates rotated before pixel painting, never a bitmap.
    a=math.radians(angle)
    def pts(values):return [(x+round(px*math.cos(a)-py*math.sin(a)),y+round(px*math.sin(a)+py*math.cos(a))) for px,py in values]
    c.poly(pts([(-2,-23),(1,-24),(3,16),(0,18)]),'B','o');c.line(pts([(0,-20),(2,14)]),'t')
    c.poly(pts([(-2,-23),(6,-26),(15,-24),(18,-19),(19,-11),(15,-5),(8,-6),(5,-12),(0,-12)]),'m','o')
    c.poly(pts([(7,-25),(14,-23),(17,-18),(17,-11),(14,-7),(12,-9),(14,-15),(11,-22)]),'h')
    c.line(pts([(4,-21),(8,-20),(8,-12),(5,-12)]),'s')
    c.poly(pts([(-4,-23),(-8,-25),(-11,-22),(-11,-16),(-5,-13),(0,-14)]),'s','o')

def giant(kind,pose):
    pal=dict(BASE,m='a77852',s='734d46',l='cc9c6b',d='4e3740',h='e8d0a1',g='614b41',G='967950') if kind=='minotaur-maze' else dict(BASE,m='6e8b79',s='465d58',l='9eb69a',d='303e43',g='4d6856',G='7c9a6a',h='d6d4ac')
    c=Canvas(96,pal);dx,dy,hx,hy,wf,stride=RIG[pose]; bull=kind=='minotaur-maze'
    if pose=='dead':
        if bull:axe(c,70,85,angle=-78,fallen=True)
        c.poly([(14,80),(23,74),(45,73),(60,79),(67,87),(60,92),(18,92),(11,87)],'m','o')
        c.poly([(20,79),(36,76),(45,78),(49,83),(30,85),(20,84)],'l')
        c.poly([(14,87),(25,85),(46,86),(60,92),(18,92)],'s')
        tube(c,[(42,82),(50,85),(54,87)],9)
        beast_head(c,53,62 if bull else 66,pose,kind)
        c.poly([(22,87),(31,87),(36,91),(35,92),(20,92)],'d','o');return c.im
    # Far arm/leg sit behind torso, their joint paths respond to stance.
    tube(c,[(48+dx,45+dy),(64+dx,56+dy),(64+dx,70+dy)],9,'s','d','m')
    c.poly([(49+dx,74+dy),(59+dx,73+dy),(64+dx,84),(62+dx,89),(68+dx,90),(70+dx,92),(53+dx,92),(51+dx,87)],'s','o')
    c.line([(58+dx,80),(57+dx,88)],'d',2)
    c.poly([(30+dx,36+dy),(43+dx,33+dy),(55+dx,42+dy),(60+dx,59+dy),(55+dx,73+dy),(42+dx,81+dy),(26+dx,74+dy),(18+dx,57+dy),(20+dx,45+dy)],'m','o')
    c.poly([(25+dx,43+dy),(34+dx,38+dy),(44+dx,41+dy),(46+dx,47+dy),(37+dx,51+dy),(25+dx,50+dy)],'l')
    c.poly([(22+dx,55+dy),(33+dx,53+dy),(38+dx,58+dy),(45+dx,55+dy),(53+dx,54+dy),(53+dx,67+dy),(44+dx,71+dy),(31+dx,68+dy)],'m')
    c.line([(26+dx,53+dy),(36+dx,56+dy),(42+dx,54+dy)],'s',2)
    c.line([(39+dx,60+dy),(40+dx,69+dy)],'s')
    c.line([(27+dx,64+dy),(35+dx,66+dy)],'l')
    # Loincloth/leather belt is different from a face-colored body blob.
    c.poly([(26+dx,71+dy),(43+dx,74+dy),(56+dx,69+dy),(54+dx,79),(50+dx,85),(42+dx,80),(36+dx,85),(27+dx,80)],'b','o')
    c.line([(28+dx,74+dy),(42+dx,77+dy),(53+dx,73+dy)],'B',2)
    c.box((39+dx,74+dy,44+dx,78+dy),'t','o')
    for x in range(28,54,5):c.line([(x+dx,78),(x+1+dx,81)],'s')
    # Near leg bends at its knee, but the hoof/sole stays planted.
    lx=30+dx-stride
    tube(c,[(31+dx,76+dy),(lx-1,82),(lx+1,89)],11)
    c.poly([(lx-6,88),(lx+5,87),(lx+10,90),(lx+11,92),(lx-8,92)],'d' if bull else 'm','o')
    c.line([(lx-5,89),(lx+4,89)],'l')
    if bull:c.line([(lx+3,90),(lx+3,92)],'o')
    else:claws(c,lx+3,89,2)
    # Hand rig makes the swing anticipation/counter lean visible in the body.
    if pose=='attack':elbow=(46,52);hand=(63,48);ang=56
    elif pose=='windup':elbow=(23,47);hand=(36,31);ang=-20
    elif pose=='move':elbow=(34,58);hand=(58,55);ang=14
    elif pose=='hit':elbow=(20,61);hand=(35,66);ang=-35
    else:elbow=(24,58);hand=(49,61);ang=3+(3 if pose=='idle_b' else -2 if pose=='idle_c' else 0)
    tube(c,[(24+dx,45+dy),(elbow[0]+dx,elbow[1]+dy),(hand[0]+dx,hand[1]+dy)],11)
    c.poly([(21+dx,43+dy),(29+dx,41+dy),(33+dx,46+dy),(29+dx,51+dy),(22+dx,51+dy),(18+dx,47+dy)],'l','o')
    if bull:
        axe(c,hand[0]+dx,hand[1]+dy,ang)
        # Wrist bracer and three bent finger clusters wrap the handle.
        c.poly([(hand[0]-6+dx,hand[1]-3+dy),(hand[0]+2+dx,hand[1]-4+dy),(hand[0]+4+dx,hand[1]+3+dy),(hand[0]-4+dx,hand[1]+5+dy)],'s','o')
        c.line([(hand[0]-2+dx,hand[1]-1+dy),(hand[0]+2+dx,hand[1]+1+dy)],'l',2)
    else:
        c.poly([(hand[0]-4+dx,hand[1]-4+dy),(hand[0]+4+dx,hand[1]-5+dy),(hand[0]+8+dx,hand[1]+1+dy),(hand[0]+6+dx,hand[1]+6+dy),(hand[0]-3+dx,hand[1]+6+dy)],'m','o')
        for j in range(3):c.line([(hand[0]+j*3+dx,hand[1]+dy),(hand[0]+j*3+dx,hand[1]+4+dy)],'s')
    beast_head(c,43+hx,17+hy if bull else 20+hy,pose,kind)
    if not bull:
        # Boulder-like shoulder and moss tufts fit the cave troll silhouette.
        c.poly([(17+dx,40+dy),(23+dx,35+dy),(31+dx,39+dy),(34+dx,48+dy),(27+dx,52+dy),(17+dx,48+dy)],'s','o')
        c.poly([(19+dx,40+dy),(24+dx,38+dy),(28+dx,40+dy),(28+dx,44+dy),(21+dx,44+dy)],'l')
        for x,y in [(18,38),(23,35),(29,40),(30,69)]:c.poly([(x+dx,y+dy),(x+dx-1,y+dy-4),(x+dx+4,y+dy-1)],'G','o')
    return c.im

def demon(pose):
    c=Canvas(96,dict(BASE,m='78648b',s='4b405f',l='ae8ca2',d='2d2d43',g='51344a',G='8d4b63',v='73384e',V='b45b67',h='e0c89a'))
    dx,dy,hx,hy,wf,stride=RIG[pose]
    if pose=='dead':
        c.poly([(8,79),(22,69),(36,75),(42,87),(27,86),(21,91),(12,85)],'v','o')
        c.poly([(54,82),(66,73),(83,79),(89,87),(74,86),(66,92)],'v','o')
        c.poly([(26,82),(41,77),(59,80),(69,87),(62,92),(27,92),(20,88)],'s','o')
        c.poly([(28,83),(42,79),(51,82),(47,87),(32,87)],'m')
        c.oval((58,75,76,89),'m','o');c.line([(68,82),(72,82)],'o')
        c.poly([(60,77),(57,68),(63,75)],'t','o');c.poly([(68,76),(75,69),(73,77)],'h','o')
        c.line([(30,92),(58,92)],'o');return c.im
    # Two real fingered wings, the near left wing fan is visually dominant.
    for mirror in [False,True]:
        values=[(41,52),(31,21+wf),(19,9+max(0,wf)),(19,25),(6,39),(13,43),(7,59),(19,57),(18,72),(33,59)]
        def wingpts(pts):return [(96-x+dx if mirror else x+dx,y+dy) for x,y in pts]
        c.poly(wingpts(values),'v','o')
        c.poly(wingpts([(31,25+wf),(19,26),(16,40),(25,47),(35,52)]),'V')
        for end in [(6,39),(7,59),(18,72)]:c.line(wingpts([(31,25+wf),end]),'G',2)
        tube(c,wingpts([(41,52),(31,21+wf),(19,9+max(0,wf))]),3,'m','s','l')
    # Separate greaves and knee joints; asymmetry gives a three-quarter stance.
    for x,off in [(39,-stride),(58,stride//2)]:
        c.poly([(x-6+dx,69+dy),(x+5+dx,70+dy),(x+6+dx+off,81),(x+2+dx+off,89),(x+10+dx+off,90),(x+11+dx+off,92),(x-6+dx+off,92),(x-8+dx+off,86)],'s','o')
        c.poly([(x-4+dx+off,80),(x+2+dx+off,79),(x+2+dx+off,87),(x-3+dx+off,88)],'m')
        c.line([(x-4+dx+off,90),(x+7+dx+off,91)],'R')
    c.poly([(35+dx,38+dy),(46+dx,34+dy),(58+dx,39+dy),(64+dx,50+dy),(60+dx,64+dy),(54+dx,73+dy),(36+dx,71+dy),(30+dx,57+dy)],'m','o')
    c.poly([(36+dx,40+dy),(44+dx,38+dy),(48+dx,44+dy),(44+dx,50+dy),(35+dx,47+dy)],'l')
    c.poly([(49+dx,39+dy),(57+dx,42+dy),(59+dx,48+dy),(52+dx,51+dy),(47+dx,46+dy)],'s')
    # High collar and segmented chest harness.
    c.poly([(34+dx,40+dy),(39+dx,35+dy),(46+dx,40+dy),(56+dx,36+dy),(60+dx,42+dy),(54+dx,50+dy),(47+dx,53+dy),(39+dx,48+dy)],'d','o')
    c.line([(36+dx,41+dy),(47+dx,49+dy),(58+dx,41+dy)],'t',2)
    c.poly([(44+dx,45+dy),(48+dx,43+dy),(51+dx,46+dy),(48+dx,51+dy),(44+dx,49+dy)],'R','o');c.pixel(47+dx,46+dy,'q')
    for j in range(3):
        y=55+j*4+dy;c.poly([(37+dx,y),(48+dx,y+2),(58+dx,y-1),(57+dx,y+2),(48+dx,y+5),(37+dx,y+3)],'s','o');c.line([(38+dx,y+1),(47+dx,y+3)],'l')
    c.poly([(35+dx,68+dy),(46+dx,72+dy),(58+dx,68+dy),(60+dx,77),(54+dx,81),(47+dx,77),(40+dx,81),(33+dx,76)],'d','o')
    c.line([(36+dx,70+dy),(47+dx,75+dy),(57+dx,71+dy)],'t')
    # Independent arms, open casting hand reaches toward the party in attack.
    hand=(78,47) if pose=='attack' else (62,31) if pose=='windup' else (72,62) if pose=='hit' else (69,52)
    tube(c,[(57+dx,43+dy),(64+dx,55+dy),(hand[0]+dx,hand[1]+dy)],7)
    c.poly([(hand[0]-3+dx,hand[1]-3+dy),(hand[0]+3+dx,hand[1]-4+dy),(hand[0]+7+dx,hand[1]+dy),(hand[0]+5+dx,hand[1]+5+dy),(hand[0]-2+dx,hand[1]+5+dy)],'m','o')
    for i in range(3):c.poly([(hand[0]+i*3+dx,hand[1]+dy),(hand[0]+i*3+dx+3,hand[1]-5+dy),(hand[0]+i*3+dx+2,hand[1]+2+dy)],'h','o')
    tube(c,[(34+dx,44+dy),(27+dx,56+dy),(28+dx,68+dy)],7)
    c.poly([(24+dx,60+dy),(32+dx,59+dy),(34+dx,67+dy),(30+dx,73+dy),(23+dx,70+dy)],'d','o');c.line([(25+dx,61+dy),(31+dx,60+dy)],'t')
    # Face: nose bridge, sunken cheeks, angled brow, teeth and jaw all authored.
    x,y=43+hx,15+hy
    c.poly([(x-4,y+8),(x-9,y),(x-8,y-9),(x-4,y-4),(x-3,y+2),(x+3,y+5)],'t','o')
    c.poly([(x+10,y+6),(x+14,y-2),(x+19,y-6),(x+16,y+3),(x+14,y+10)],'h','o')
    c.poly([(x-3,y+5),(x+3,y+1),(x+11,y+3),(x+16,y+10),(x+13,y+21),(x+8,y+25),(x,y+21),(x-5,y+12)],'m','o')
    c.poly([(x,y+7),(x+5,y+4),(x+9,y+7),(x+7,y+12),(x+1,y+11)],'l')
    c.poly([(x+9,y+10),(x+12,y+13),(x+17,y+15),(x+12,y+17),(x+9,y+16)],'l','o')
    c.line([(x+4,y+11),(x+9,y+12),(x+12,y+10)],'d',2)
    if pose not in ['hit','dead']:c.line([(x+8,y+13),(x+11,y+13)],'e');c.pixel(x+10,y+13,'o')
    else:c.line([(x+8,y+13),(x+11,y+14)],'o')
    c.poly([(x+6,y+18),(x+12,y+18),(x+13,y+21),(x+8,y+23),(x+4,y+21)],'r','o')
    c.line([(x+7,y+19),(x+11,y+19)],'h')
    c.poly([(x,y+21),(x+4,y+23),(x+8,y+23),(x+7,y+29),(x+3,y+27)],'s','o')
    # Crown bands anchor the horns without covering facial anatomy.
    c.line([(x-2,y+6),(x+3,y+3),(x+10,y+5)],'t',2)
    c.poly([(x+1,y+3),(x+3,y-2),(x+5,y+3)],'y','o')
    return c.im

def draw(slug,pose,cell=96):
    assert cell==96
    if slug in ['dragon','dragon-red','dragon-blue','wyvern-cliff']:return draconic(slug,pose)
    if slug=='dragon-bone':return bone_dragon(pose)
    if slug in ['minotaur-maze','troll-cave']:return giant(slug,pose)
    if slug=='demon-lord':return demon(pose)
    raise KeyError(slug)

# Earlier rejected anatomy remains below this module's historical helpers only.
# Every public draw/command now delegates to the canonical fresh source.
_rejected_draw = draw

def draw(slug, pose, cell=None):
    from registry import draw_entry
    return draw_entry(slug, pose)

if __name__ == '__main__':
    from registry import helper
    helper.run_group('bosses', lambda slug, pose, cell: draw(slug, pose, cell))
