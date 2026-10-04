#!/usr/bin/env python3
"""Original native pixel drawings. No imported sprites, fonts, or image models.

Run from any directory: python content-packs/joseon-folklore/monsters/source/draw.py
All anatomy is drawn at final 64/96 pixel resolution. Only review copies enlarge.
"""
from pathlib import Path
from math import hypot
import hashlib
import json
import sys
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
from organic import rat,bat,fox,tiger
from spirits import wisp,drowned,ghoul,bamboo
from figures import stone,bandit,bride

ROOT = Path(__file__).resolve().parents[1]
POSES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']


class Ink:
    def __init__(self, size, colors, offset=(0, 0)):
        self.image = Image.new('RGBA', (size, size))
        self.d = ImageDraw.Draw(self.image)
        self.c = colors
        self.offset = offset

    def points(self, points):
        ox, oy = self.offset
        return [(round(x + ox), round(y + oy)) for x, y in points]

    def poly(self, points, color, outline='o'):
        self.d.polygon(self.points(points), fill=self.c[color])
        if outline:
            self.d.line(self.points(points + [points[0]]), fill=self.c[outline], width=1)

    def line(self, points, color, width=1):
        self.d.line(self.points(points), fill=self.c[color], width=width)

    def dot(self, x, y, color):
        self.d.point(self.points([(x, y)]), fill=self.c[color])

    def rect(self, x, y, x2, y2, color):
        self.d.rectangle(self.points([(x, y), (x2, y2)]), fill=self.c[color])


BOAR = dict(o='#211f28', deep='#35303a', shade='#514049', base='#755445', light='#9c7254',
            tan='#bb9064', hair='#d0a172', ear='#be8870', nose='#604751', rim='#8e6570',
            ivory='#f5e2b5', tusk='#bba77c', hoof='#292730', eye='#e89f57', black='#151923')


def boar(pose):
    """Low wedge body, ridge of bristles, split hooves, two curved tusks."""
    dead = pose == 'dead'
    dx = {'windup': -2, 'attack': 2, 'hit': -2, 'recover': 1}.get(pose, 0)
    dy = {'idle_b': -1, 'idle_c': 1, 'windup': 2, 'move': -2, 'attack': 3, 'recover': 2, 'hit': -1, 'dead': 7}.get(pose, 0)
    s = Ink(64, BOAR, (dx, dy))
    # Far legs articulate independently of the body and head.
    if not dead:
        legs = [(17, 44, 17, 58), (39, 43, 38, 58)]
        if pose == 'move': legs = [(17, 44, 10, 57), (39, 43, 44, 59)]
        if pose == 'windup': legs = [(17, 44, 13, 56), (39, 43, 36, 56)]
        if pose == 'attack': legs = [(17, 44, 11, 55), (39, 43, 45, 56)]
        for x, y, fx, fy in legs:
            s.poly([(x-3,y),(x+3,y),(fx+2,fy-2),(fx+3,fy),(fx-4,fy),(fx-3,fy-5)], 'shade')
            s.line([(fx-3,fy-1),(fx+2,fy-1)],'hoof',2)
    else:
        s.poly([(13,36),(8,31),(9,27),(13,28),(19,38)],'shade')
        s.poly([(35,36),(34,29),(38,26),(41,27),(40,38)],'base')
        s.line([(9,27),(12,28)],'hoof',2)
        s.line([(37,26),(40,27)],'hoof',2)
    # Curled tail and dorsal mane, no ellipse body or resized stock art.
    s.line([(11,38),(6,33),(5,28),(7,25),(10,26),(10,29),(8,30)],'o',3)
    s.line([(10,37),(7,32),(6,28),(7,26),(9,27)],'light')
    s.poly([(9,35),(10,29),(14,24),(21,21),(30,21),(37,24),(43,31),(44,41),(39,47),(29,50),(17,48),(11,43)],'base')
    s.poly([(11,34),(14,27),(21,24),(28,23),(35,26),(38,31),(28,29),(21,31),(16,38)],'light',None)
    s.poly([(11,39),(17,42),(26,43),(34,40),(41,36),(43,42),(38,47),(29,49),(17,47)],'shade',None)
    s.poly([(17,42),(23,40),(30,41),(28,45),(20,45)],'base',None)
    for x,y in [(13,26),(16,23),(19,21),(22,20),(26,20),(30,21),(34,23)]:
        s.line([(x-1,y+3),(x,y-3),(x+2,y+2)],'deep')
        s.dot(x,y-1,'tan')
    for x,y in [(14,31),(17,29),(20,28),(24,27),(28,27),(32,29),(15,36),(19,34),(24,33),(28,35),(33,33),(37,35),(18,40),(23,38),(29,39)]:
        s.line([(x,y),(x+2,y+1)],'tan' if y<34 else 'light')
        s.dot(x-1,y+2,'shade')
    # Near legs are stocky, with a knee and divided dark hoof.
    if not dead:
        near = [(22,43,23,59-dy),(42,42,43,59-dy)]
        if pose == 'move': near = [(22,43,29,59-dy),(42,42,38,56)]
        if pose == 'windup': near = [(22,43,19,59-dy),(42,42,40,59-dy)]
        if pose == 'attack': near = [(22,43,17,59-dy),(42,42,49,59-dy)]
        for x,y,fx,fy in near:
            s.poly([(x-3,y),(x+3,y),(x+3,y+5),(fx+1,fy-4),(fx+3,fy-2),(fx+3,fy),(fx-4,fy),(fx-4,fy-3),(fx-2,fy-7)],'base')
            s.line([(x-1,y+2),(fx-1,fy-4)],'light',2)
            s.rect(fx-3,fy-2,fx+2,fy,'hoof'); s.dot(fx,fy,'light')
    # Head has its own pitch: lowered snout for charge, recoiling in hit.
    hx,hy = {'windup':(-1,3),'attack':(1,2),'move':(0,-1),'recover':(-1,1),'hit':(-2,-3),'dead':(0,4)}.get(pose,(0,0))
    s.offset = (dx+hx, dy+hy)
    s.poly([(34,30),(35,24),(38,21),(40,25),(43,28),(48,29),(51,33),(55,36),(57,41),(55,46),(48,48),(42,45),(37,42)],'base')
    s.poly([(36,29),(37,24),(39,23),(40,28)],'ear')
    s.poly([(40,30),(44,28),(47,30),(48,33),(45,35),(42,38),(39,37)],'light',None)
    s.line([(42,29),(45,25),(47,24),(48,29),(47,31)],'o',2)
    s.line([(45,28),(46,26)],'ear')
    s.poly([(46,36),(50,34),(55,36),(57,40),(54,43),(50,44),(46,42)],'nose')
    s.line([(52,36),(55,37),(56,40)],'rim')
    s.dot(53,39,'black');s.dot(56,40,'black')
    if not dead:
        s.line([(44,33),(47,34)],'o',2);s.dot(46,33,'eye');s.dot(47,33,'ivory')
    else: s.line([(43,34),(46,36)],'black')
    s.line([(45,44),(50,46),(54,44)],'deep')
    # Far and near tusks curl upward, deliberately distinct from the snout.
    s.poly([(50,45),(51,40),(53,38),(53,42),(52,46)],'tusk')
    s.poly([(43,45),(45,44),(47,40),(47,36),(49,39),(49,43),(47,48),(44,48)],'ivory')
    s.line([(45,47),(47,45),(48,41)],'tusk')
    s.line([(39,38),(40,41),(42,42)],'tan')
    return s.image


STRAW = dict(o='#30292c', dark='#594034', shade='#84603e', base='#b78b4c', light='#dcc073',
             tip='#f2dda0', knot='#765740', rope='#d7ac70', wood='#684333', grain='#aa7050',
             indigo='#444c6b', blue='#6b8191', face='#694732', eye='#ffb966', ember='#cd6646')


def bundle(s, a, b, radius=3):
    """Tied sheaf limb: longitudinal straw, broken fringe, rope at the wrist."""
    x,y=a; u,v=b
    s.line([a,b],'o',radius*2+2)
    s.line([a,b],'shade',radius*2)
    s.line([(x-1,y),(u-1,v)],'base',radius)
    s.line([(x-2,y),(u-2,v)],'light')
    s.line([(x+2,y),(u+2,v)],'dark')
    s.line([(u-radius,v-2),(u+radius,v-2)],'rope')
    for k in range(-radius,radius+1,2):
        s.line([(u+k,v-1),(u+k+(-1 if k<0 else 1),v+2)],'light')


def wood_club(s, grip, tip):
    """Crooked wood pestle, not the bronze boss's studded club."""
    gx,gy=grip;tx,ty=tip
    length=hypot(tx-gx,ty-gy);ux=(tx-gx)/length;uy=(ty-gy)/length
    nx,ny=-uy,ux
    def q(t,w): return (gx+ux*t+nx*w,gy+uy*t+ny*w)
    s.poly([q(-5,-2),q(length-10,-3),q(length-8,-5),q(length-2,-5),q(length+1,-2),q(length,3),q(length-8,4),q(length-10,2),q(-5,2)],'wood')
    s.line([q(-3,-1),q(length-8,-1),q(length-3,-3)],'grain')
    s.line([q(length-7,2),q(length-3,1)],'dark')
    for t in [2,4,6]:s.line([q(t,-2),q(t,2)],'rope')
    s.dot(*q(length-4,-1),'light')


def straw(pose):
    """Rice-straw rain cape, rope waist, two forked horns, wooden pestle."""
    if pose == 'dead': return fallen_straw()
    dy={'idle_b':-1,'idle_c':1,'windup':1,'move':-2,'attack':2,'recover':2,'hit':-1}.get(pose,0)
    dx={'windup':-1,'attack':1,'hit':-2}.get(pose,0)
    s=Ink(64,STRAW,(dx,dy))
    feet={'move':((18,57-dy),(36,54)), 'attack':((15,57-dy),(37,57-dy)), 'windup':((20,57-dy),(34,57-dy)), 'hit':((21,57-dy),(35,57-dy))}.get(pose,((19,57-dy),(32,57-dy)))
    bundle(s,(22,43),feet[0],4);bundle(s,(30,44),feet[1],4)
    # Left sleeve sweeps across the body in defense/recovery.
    left={'windup':((14,34),(17,24)), 'attack':((13,36),(11,42)), 'move':((13,31),(9,35)), 'recover':((19,38),(27,40)), 'hit':((15,26),(22,22))}.get(pose,((14,34),(12,42)))
    bundle(s,(21,29),left[0],4);bundle(s,left[0],left[1],3)
    grip,tip={'windup':((40,24),(46,7)), 'move':((40,34),(49,17)), 'attack':((43,33),(56,31)), 'recover':((40,44),(49,40)), 'hit':((38,35),(50,21)), 'idle_b':((43,39),(47,21)), 'idle_c':((43,40),(49,22))}.get(pose,((43,40),(48,22)))
    wood_club(s,grip,tip)
    # Cape has a jagged thatch outline, layering runs downwards as rice straw.
    s.poly([(19,26),(25,24),(32,26),(36,31),(36,36),(39,42),(34,41),(36,46),(31,44),(30,48),(26,45),(22,47),(20,44),(16,45),(18,41),(14,41),(17,35),(16,31)],'base')
    s.poly([(18,31),(23,27),(29,27),(34,32),(30,37),(21,38),(18,35)],'light',None)
    s.poly([(17,39),(23,36),(28,37),(35,34),(36,40),(32,43),(27,45),(23,42),(19,43)],'shade',None)
    for x,y,ex,ey in [(19,31,18,37),(22,29,21,37),(25,28,24,35),(28,29,28,35),(31,30,33,36),(20,38,19,43),(23,38,23,44),(27,39,26,45),(30,38,31,43),(33,38,35,42)]:
        s.line([(x,y),(ex,ey)],'tip' if y<32 else 'light')
        s.dot(ex+1,ey,'dark')
    # Thick knotted rice-rope belt, no generic leather armor.
    s.line([(18,38),(24,40),(31,39),(35,37)],'dark',3)
    s.line([(18,38),(24,39),(31,38),(35,37)],'rope')
    s.poly([(23,38),(26,37),(28,39),(26,42),(23,41)],'rope')
    s.line([(24,41),(23,45)],'knot',2);s.line([(27,41),(29,46)],'rope')
    # Far horn curls outward; near horn has two irregular bamboo prongs.
    s.poly([(29,16),(32,12),(34,8),(33,6),(36,8),(36,12),(34,17)],'base')
    s.line([(33,13),(35,11)],'tip')
    s.poly([(18,17),(17,13),(18,8),(21,5),(20,10),(23,7),(22,12),(21,17)],'light')
    s.line([(18,13),(21,14)],'dark')
    # A mask of straw knots: broad brow, lopsided mouth and rice-stalk beard.
    s.poly([(20,14),(26,12),(32,15),(34,19),(33,25),(29,28),(22,26),(18,21),(18,17)],'base')
    s.poly([(20,16),(24,15),(29,15),(32,18),(30,20),(23,19),(20,20)],'light',None)
    s.poly([(20,20),(24,19),(26,21),(30,20),(33,21),(31,25),(26,27),(21,24)],'face',None)
    # Dominant near eye and a protruding right-facing guardian-mask nose.
    s.line([(25,19),(28,17),(31,18)],'dark',2)
    if pose!='hit':s.line([(28,19),(31,19)],'eye')
    else:s.line([(28,19),(31,21)],'ember')
    s.poly([(31,19),(33,19),(35,21),(37,22),(35,24),(31,23)],'light')
    s.dot(35,22,'dark')
    s.line([(27,25),(33,25),(35,24)],'o')
    s.poly([(29,25),(30,23),(31,25),(31,27)],'tip',None)
    for x in [21,24,27,30]:s.line([(x,26),(x-1,29)],'light')
    s.line([(18,29),(22,31),(27,30)],'indigo',3)
    s.line([(19,29),(23,30)],'blue')
    s.poly([(20,30),(18,36),(21,35),(23,31)],'indigo')
    elbow={'windup':(34,28),'attack':(37,32),'hit':(32,32),'recover':(35,40)}.get(pose,(35,34))
    bundle(s,(32,29),elbow,4);bundle(s,elbow,grip,3)
    s.line([(grip[0]-2,grip[1]),(grip[0]+2,grip[1])],'knot')
    return s.image


def fallen_straw():
    s=Ink(64,STRAW)
    # Newly authored collapsed sheaves and mask, rather than rotating idle.
    s.poly([(9,51),(17,47),(26,48),(34,45),(40,49),(39,54),(46,58),(31,59),(24,56),(16,59),(6,58)],'base')
    for x,y in [(10,54),(14,52),(19,51),(24,53),(29,51),(33,49),(37,53)]:
        s.line([(x,y),(x+6,y+4)],'light');s.line([(x+1,y+2),(x+3,y+5)],'shade')
    s.line([(18,49),(23,55),(30,57)],'rope',2)
    s.poly([(31,45),(34,40),(38,40),(43,43),(46,47),(43,51),(37,52),(33,49)],'light')
    s.line([(37,43),(39,45)],'dark');s.line([(42,45),(43,47)],'dark')
    s.poly([(34,41),(31,37),(33,36),(35,39)],'light')
    s.poly([(40,41),(43,37),(45,38),(43,43)],'base')
    s.line([(38,48),(42,49)],'face')
    wood_club(s,(44,56),(56,49))
    s.line([(8,48),(12,50)],'light');s.line([(20,46),(22,48)],'tip')
    return s.image


GHOST=dict(o='#37364f', hair='#222536', hshade='#393e55', hlight='#575b76', skin='#e8dcd3',
           sskin='#b5b1bd', pale='#fff1df', cloth='#dddce1', white='#f6f1e8', shade='#aaaac3',
           fold='#c4c2d4', hem='#777f9e', red='#a85766', ribbon='#743b59', eye='#d58c87', mist='#869ba9')


def sleeve(s, shoulder, elbow, wrist, wide=4):
    x,y=shoulder;u,v=elbow;wx,wy=wrist
    s.poly([(x-3,y-2),(x+3,y-1),(u+wide,v-2),(wx+2,wy-3),(wx+2,wy+1),(u+wide-1,v+5),(u-3,v+6),(x-4,y+4)],'cloth')
    s.line([(x,y),(u,v+1),(wx-1,wy)],'white',2)
    s.line([(u-2,v+4),(u+wide-2,v+4)],'fold')
    s.line([(wx,wy-2),(wx+3,wy-1)],'skin',2)
    for a in range(3):s.line([(wx+3,wy-1+a),(wx+5+a%2,wy-2+a)],'sskin')


def ghost(pose):
    """Unmarried human ghost in jeogori/chima, loose parted hair and goreum."""
    if pose=='dead':return fallen_ghost()
    dy={'idle_b':-1,'idle_c':1,'windup':-2,'move':-2,'attack':0,'recover':1,'hit':2}.get(pose,0)
    dx={'windup':-1,'move':-1,'attack':1,'hit':-2}.get(pose,0)
    s=Ink(64,GHOST,(dx,dy))
    sweep={'idle_b':-1,'idle_c':1,'windup':-2,'move':-4,'attack':-3,'hit':4}.get(pose,0)
    # Hair moves separately from sleeves and skirt, with a narrow center part.
    s.poly([(23,11),(27,8),(33,7),(38,10),(40,15),(39,23),(37,29),(39+sweep,39),(35+sweep,43),(37+sweep,46),(31+sweep,44),(26+sweep,47),(21+sweep,42),(18+sweep,43),(20+sweep,34),(21,24),(20,16)],'hair')
    s.line([(23,14),(23,25),(21+sweep,38),(23+sweep,42)],'hshade',2)
    s.line([(36,12),(38,22),(35+sweep,37),(36+sweep,41)],'hlight')
    # High-waisted bell skirt, irregular fading hem made of opaque pixel wisps.
    s.poly([(25,32),(32,31),(36,35),(37,41),(42+sweep,51),(44+sweep,56),(39+sweep,55),(37+sweep,59-dy),(33,57-dy),(30,59-dy),(27,56),(23+sweep,58-dy),(24+sweep,54),(17+sweep,55),(20,47),(22,39)],'cloth')
    s.poly([(26,35),(29,34),(28,46),(25,53),(21+sweep,54),(24,43)],'white',None)
    s.poly([(32,35),(35,39),(36,47),(41+sweep,54),(35,53),(33,48)],'shade',None)
    s.poly([(29,36),(31,36),(30,47),(32,56),(28,55)],'fold',None)
    s.line([(25,38),(24,46),(21+sweep,51)],'fold')
    s.line([(34,42),(33,47),(35,54)],'hem')
    # Far sleeve in first so the overlapping jeogori closes over it.
    left={'windup':((21,27),(22,20)), 'move':((15,31),(10,33)), 'attack':((15,29),(11,30)), 'recover':((23,30),(25,32)), 'hit':((21,22),(28,18))}.get(pose,((19,30),(18,35)))
    sleeve(s,(25,24),left[0],left[1],4)
    s.poly([(25,22),(31,21),(35,24),(35,29),(32,34),(25,34),(23,29)],'white')
    s.poly([(24,27),(28,26),(32,30),(31,33),(25,32)],'cloth',None)
    # Korean crossed collar and tied breast ribbon are clearly resolved at 1:1.
    s.line([(27,23),(30,28),(33,25)],'shade')
    s.line([(28,23),(31,27)],'white')
    s.poly([(30,28),(33,27),(35,29),(33,31),(30,30)],'ribbon')
    s.line([(32,29),(30,35),(29,40)],'red',2)
    s.line([(34,29),(36,33),(37,36)],'ribbon',2)
    # Hair frames a human face with a visible ear and nose, not a generic blob.
    s.poly([(28,12),(32,11),(36,13),(36,17),(39,19),(37,20),(36,24),(32,25),(28,22),(26,17)],'skin')
    s.poly([(28,13),(31,12),(32,16),(31,21),(33,23),(30,22),(28,19)],'pale',None)
    s.line([(36,20),(35,23),(33,24)],'sskin')
    s.line([(33,16),(36,17)],'hshade');s.dot(35,17,'eye')
    if pose=='hit':s.line([(33,17),(35,18)],'hshade')
    s.dot(36,21,'red')
    s.poly([(23,13),(26,9),(31,8),(33,10),(30,12),(27,17),(26,24),(24,29),(23,23)],'hair')
    s.line([(26,13),(25,23)],'hlight')
    s.line([(32,9),(34,10),(36,12)],'hlight')
    right={'windup':((36,24),(38,19)), 'move':((35,31),(39,35)), 'attack':((43,24),(52,25)), 'recover':((38,29),(40,34)), 'hit':((35,21),(39,18)), 'idle_b':((37,27),(42,29)), 'idle_c':((36,29),(40,32))}.get(pose,((37,28),(42,30)))
    sleeve(s,(33,24),right[0],right[1],5)
    # One foreground hair strand remains dark against the cream jacket.
    s.line([(28,19),(27,27),(25+sweep,36),(26+sweep,41)],'hair',2)
    s.line([(26,30),(24+sweep,38)],'hlight')
    # Separate hem threads suggest floating while preserving binary alpha.
    s.line([(24+sweep,56),(22+sweep,59-dy)],'mist')
    s.dot(35+sweep,58-dy,'fold')
    return s.image


def fallen_ghost():
    s=Ink(64,GHOST)
    s.poly([(14,50),(24,46),(32,48),(39,50),(47,54),(49,57),(38,56),(34,59),(25,57),(18,59),(12,56)],'cloth')
    s.poly([(16,51),(24,48),(30,50),(26,53),(18,55)],'white',None)
    s.line([(26,51),(33,56),(39,54)],'shade')
    s.line([(17,55),(25,54),(29,56)],'fold')
    s.poly([(28,45),(32,40),(37,41),(40,45),(41,51),(37,54),(30,53),(27,49)],'hair')
    s.poly([(34,44),(38,45),(39,48),(36,50),(33,49)],'skin')
    s.line([(36,46),(38,47)],'hshade')
    s.line([(31,44),(29,49),(24,54),(19,55)],'hlight')
    s.line([(37,52),(43,54),(46,57)],'hair',2)
    s.line([(31,53),(29,55),(27,56)],'red')
    s.dot(9,57,'mist');s.dot(51,59,'fold')
    return s.image


BRONZE=dict(o='#292d35', deep='#3f3836', shadow='#655042', base='#98704c', light='#be925e',
            gold='#e0b676', rim='#f3d297', patina='#496967', oxid='#769088', red='#823e44',
            crimson='#b95a50', sash='#df8b62', ivory='#efe0bc', tusk='#b5a582', eye='#ffba62',
            black='#202733', cloud='#725641')


def bronze_limb(s,a,b,c,width=6):
    s.line([a,b,c],'o',width*2+2)
    s.line([a,b,c],'shadow',width*2)
    s.line([(a[0]-1,a[1]-1),(b[0]-2,b[1]-1),(c[0]-1,c[1]-1)],'base',width+1)
    s.line([(a[0]-3,a[1]),(b[0]-3,b[1]),(c[0]-3,c[1])],'light',2)
    s.line([(b[0]+3,b[1]),(b[0]+4,b[1]+3)],'patina',2)


def bronze_club(s,grip,tip):
    gx,gy=grip;tx,ty=tip
    length=hypot(tx-gx,ty-gy);ux=(tx-gx)/length;uy=(ty-gy)/length;nx,ny=-uy,ux
    def q(t,w):return (gx+ux*t+nx*w,gy+uy*t+ny*w)
    s.poly([q(-7,-3),q(length-15,-3),q(length-16,-7),q(length-3,-8),q(length+2,-4),q(length+2,4),q(length-3,8),q(length-16,7),q(length-15,3),q(-7,3)],'base')
    s.poly([q(length-15,-6),q(length-4,-6),q(length, -3),q(length,0),q(length-15,0)],'gold',None)
    s.line([q(-5,-1),q(length-16,-1)],'light',2)
    s.line([q(length-14,4),q(length-3,5)],'shadow',2)
    for t in [-2,1,4]:s.line([q(t,-3),q(t,3)],'deep')
    for t,w in [(length-11,-6),(length-5,-7),(length-11,6),(length-5,7)]:
        sign=1 if w>0 else -1
        s.poly([q(t-2,w),q(t,w+3*sign),q(t+2,w)],'light')
    s.line([q(length-12,-2),q(length-8,0),q(length-5,-1)],'patina')
    s.dot(*q(length-3,-3),'rim')


def bronze(pose):
    """Heavy bronze bell guardian: embossed clouds, paired horns and iron club."""
    if pose=='dead':return fallen_bronze()
    dx={'windup':-2,'attack':2,'hit':-3}.get(pose,0)
    dy={'idle_b':-1,'idle_c':1,'windup':2,'move':-2,'attack':2,'recover':3,'hit':-1}.get(pose,0)
    s=Ink(96,BRONZE,(dx,dy))
    # Wide feet remain pinned while knees bend and torso breathes.
    feet={'move':((22,91-dy),(57,87)), 'attack':((18,91-dy),(60,91-dy)), 'windup':((25,91-dy),(56,91-dy))}.get(pose,((23,91-dy),(55,91-dy)))
    for a,b,f in [((31,64),(28,78),feet[0]),((48,65),(50,78),feet[1])]:
        bronze_limb(s,a,b,(f[0],f[1]-7),6)
        s.poly([(f[0]-6,f[1]-5),(f[0]+5,f[1]-5),(f[0]+8,f[1]-2),(f[0]+8,f[1]),(f[0]-8,f[1]),(f[0]-8,f[1]-3)],'base')
        for k in [-5,-1,3]:s.line([(f[0]+k,f[1]-3),(f[0]+k,f[1]-1)],'gold');s.dot(f[0]+k+1,f[1],'deep')
    left={'windup':((18,43),(20,35)), 'attack':((13,48),(15,59)), 'move':((14,46),(10,53)), 'recover':((24,54),(30,57)), 'hit':((19,36),(28,33))}.get(pose,((17,45),(17,58)))
    bronze_limb(s,(26,36),left[0],left[1],6)
    # Rounded cast belly is an asymmetric stepped silhouette, not scaled straw.
    s.poly([(28,31),(38,28),(49,31),(58,38),(62,47),(63,58),(59,68),(51,74),(38,77),(27,73),(22,67),(20,55),(21,43)],'base')
    s.poly([(27,38),(36,33),(46,35),(53,40),(55,49),(50,53),(36,54),(25,49)],'light',None)
    s.poly([(22,55),(29,61),(40,64),(52,61),(61,54),(60,65),(52,72),(39,74),(28,70),(23,64)],'shadow',None)
    s.poly([(30,47),(37,43),(47,45),(53,50),(51,60),(42,65),(32,60),(28,54)],'gold',None)
    s.line([(25,42),(28,38),(34,35)],'gold',2)
    # Cast cloud curls and foundry seams are hand-placed, not random noise.
    for x,y in [(32,48),(44,52)]:
        s.line([(x,y+6),(x-2,y+3),(x,y),(x+4,y-1),(x+7,y+2),(x+6,y+5),(x+3,y+5),(x+2,y+3)],'cloud')
        s.line([(x,y+1),(x+4,y),(x+6,y+2)],'rim')
    s.line([(34,63),(39,66),(44,65),(47,62)],'deep')
    s.line([(56,45),(58,50),(56,55),(58,59)],'patina',2)
    s.dot(57,48,'oxid');s.dot(60,61,'oxid')
    s.line([(26,60),(25,66),(29,69)],'patina')
    # Red woven waist cloth with a large knot and two hanging ends.
    s.poly([(23,65),(33,69),(46,69),(59,64),(58,70),(46,75),(32,74),(24,71)],'red')
    s.line([(25,66),(34,71),(47,71),(57,67)],'crimson',2)
    s.poly([(42,70),(47,68),(51,72),(47,77),(42,75)],'crimson')
    s.line([(44,72),(48,73)],'sash')
    s.poly([(43,75),(40,84),(43,86),(47,76)],'red')
    s.poly([(48,76),(52,82),(55,80),(51,74)],'crimson')
    grip,tip={'windup':((62,32),(72,12)), 'attack':((67,46),(80,62)), 'move':((67,58),(76,33)), 'recover':((66,67),(80,60)), 'hit':((63,54),(78,34)), 'idle_b':((67,62),(76,36)), 'idle_c':((67,64),(79,38))}.get(pose,((67,63),(77,37)))
    bronze_club(s,grip,tip)
    # Two short curling horns and scalloped hair cast directly in bronze.
    s.poly([(43,23),(48,18),(49,12),(47,8),(51,9),(54,14),(54,20),(51,25)],'light')
    s.line([(49,13),(52,14)],'shadow');s.line([(49,18),(52,19)],'gold')
    s.poly([(28,23),(22,17),(22,11),(25,6),(25,12),(29,15),(32,21)],'gold')
    s.line([(24,13),(27,16)],'rim',2);s.line([(25,18),(29,20)],'shadow')
    s.poly([(25,22),(27,17),(31,15),(34,17),(38,15),(41,18),(46,17),(51,22),(53,30),(51,36),(46,42),(36,43),(28,38),(23,31)],'base')
    s.poly([(27,24),(31,20),(37,20),(42,21),(48,23),(48,27),(41,28),(35,26),(29,29)],'light',None)
    # Huge brow, broad snout, cheek spirals: a bell-mask face, not elf ears.
    s.poly([(32,27),(36,24),(43,25),(45,28),(41,30),(34,29)],'shadow')
    if pose!='hit':s.line([(37,28),(42,28)],'eye')
    else:s.line([(37,28),(41,30)],'black')
    s.poly([(43,27),(46,27),(49,30),(54,32),(52,35),(46,35),(42,32)],'gold')
    s.dot(50,33,'deep')
    s.line([(30,34),(33,32),(35,34),(34,37),(31,36)],'shadow')
    s.line([(46,32),(49,34),(47,37),(45,35)],'shadow')
    s.poly([(34,37),(40,36),(47,36),(49,38),(46,41),(40,42),(35,40)],'deep')
    s.line([(37,40),(42,41),(47,39)],'red')
    s.poly([(35,38),(36,32),(39,35),(39,39)],'ivory')
    s.poly([(46,38),(47,33),(49,35),(49,39)],'tusk')
    s.poly([(29,38),(32,40),(36,41),(37,44),(34,46),(30,43)],'light')
    s.poly([(41,42),(47,39),(50,39),(47,44),(42,46)],'light')
    s.line([(31,41),(33,43),(35,43)],'gold');s.line([(44,43),(47,41)],'rim')
    s.dot(27,31,'patina');s.dot(48,31,'oxid')
    elbow={'windup':(58,34),'attack':(59,44),'recover':(60,59),'hit':(57,49)}.get(pose,(59,48))
    bronze_limb(s,(52,38),elbow,grip,6)
    s.poly([(grip[0]-4,grip[1]-4),(grip[0]+3,grip[1]-4),(grip[0]+5,grip[1]),(grip[0]+3,grip[1]+5),(grip[0]-3,grip[1]+4)],'base')
    for k in [-2,0,2]:s.line([(grip[0]+k,grip[1]-2),(grip[0]+k+1,grip[1]+2)],'gold')
    return s.image


def fallen_bronze():
    s=Ink(96,BRONZE)
    # The fallen bell rests sideways with cracked cast panels and spilled sash.
    s.poly([(17,76),(23,68),(34,62),(49,63),(59,69),(65,78),(61,88),(48,91),(29,90),(19,85)],'base')
    s.poly([(24,70),(34,65),(46,66),(54,70),(55,74),(40,78),(24,76)],'light',None)
    s.poly([(22,80),(36,82),(53,79),(61,77),(59,86),(47,89),(29,88)],'shadow',None)
    s.line([(30,71),(33,74),(31,78),(38,80),(36,85)],'deep',2)
    s.line([(41,68),(43,71),(49,70),(51,74)],'patina')
    s.line([(39,79),(41,76),(45,76),(47,79),(45,81),(43,80)],'gold')
    s.poly([(54,74),(58,63),(64,58),(71,60),(77,65),(78,72),(74,79),(65,81),(58,78)],'light')
    s.poly([(61,65),(63,61),(61,55),(64,54),(66,59),(66,64)],'gold')
    s.poly([(72,62),(76,56),(79,57),(77,64)],'base')
    s.line([(62,69),(65,71)],'deep',2);s.line([(71,67),(74,68)],'deep',2)
    s.poly([(66,71),(70,70),(72,73),(68,76)],'shadow')
    s.line([(64,76),(69,78),(73,76)],'deep')
    s.line([(69,76),(70,74)],'ivory',2)
    s.poly([(23,83),(34,85),(48,84),(51,88),(39,92),(26,89)],'red')
    s.line([(29,86),(39,89),(47,86)],'crimson',2)
    s.poly([(19,76),(11,70),(10,64),(14,62),(19,65),(23,72)],'base')
    s.line([(12,65),(15,64)],'gold',2)
    bronze_club(s,(67,84),(82,79))
    return s.image


SPECIES = [('field-rat',64,'dash',150,rat),('wild-boar',64,'dash',190,boar),
           ('cave-bat',64,'swoop',160,bat),('straw-dokkaebi',64,'stomp',260,straw),
           ('lantern-wisp',64,'float',180,wisp),('maiden-ghost',64,'float',240,ghost),
           ('drowned-ghost',64,'float',280,drowned),('grave-ghoul',64,'stomp',310,ghoul),
           ('fox-spirit',64,'dash',200,fox),('stone-dokkaebi',64,'stomp',340,stone),
           ('bamboo-specter',64,'shoot',220,bamboo),('masked-bandit',64,'dash',180,bandit),
           ('bronze-dokkaebi',96,'stomp',330,bronze),('bride-wraith',96,'float',280,bride),
           ('mountain-tiger',96,'dash',250,tiger)]


def main():
    for folder in ['assets','assets/portraits','review']: (ROOT/folder).mkdir(parents=True,exist_ok=True)
    sheets=[];art=[]
    for slug,cell,motion,ms,draw in SPECIES:
        frames=[draw(p) for p in POSES]
        sheet=Image.new('RGBA',(cell*3,cell*3))
        for i,frame in enumerate(frames):sheet.paste(frame,((i%3)*cell,(i//3)*cell))
        path=ROOT/'assets'/f'{slug}.png';sheet.save(path,optimize=False)
        frames[0].save(ROOT/'assets/portraits'/f'{slug}.png',optimize=False)
        # Checkers and labels exist only in evidence, never in runtime PNG.
        review=Image.new('RGB',(cell*9,cell*9+54),'#202938');d=ImageDraw.Draw(review)
        for y in range(cell*9):
            for x in range(0,cell*9,24):
                if (x//24+y//24)%2==0:d.line([(x,y),(x+23,y)],fill='#2e3845')
        enlarged=sheet.resize((cell*9,cell*9),Image.Resampling.NEAREST)
        review.paste(enlarged,(0,0),enlarged)
        for i,pose in enumerate(POSES):
            x=(i%3)*cell*3;y=(i//3)*cell*3
            d.rectangle((x,y,x+cell*3-1,y+cell*3-1),outline='#56606c')
            d.text((x+4,y+4),pose,fill='#b7c6d8')
        d.text((8,cell*9+9),f'{slug} | native {cell} | 3x3 | original code pixels',fill='#e5dfc6')
        review.save(ROOT/'review'/f'{slug}-poses.png')
        pixels=list(sheet.get_flattened_data()) if hasattr(sheet,'get_flattened_data') else list(sheet.getdata())
        colors={px for px in pixels if px[3]}
        source='draw' if draw.__module__=='__main__' or draw in [boar,straw,ghost,bronze] else draw.__module__
        art.append(dict(slug=slug,source=f'source/{source}.py',sheet=f'assets/{slug}.png',
                        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),size=list(sheet.size),
                        colors=len(colors),alphaValues=sorted({p[3] for p in pixels}),
                        frames=[dict(pose=p,bbox=list(f.getbbox()),sha256=hashlib.sha256(f.tobytes()).hexdigest()) for p,f in zip(POSES,frames)]))
        sheets.append(dict(resourceId=f'jf-enemy-{slug}',path=f'assets/joseon-folklore/monsters/{slug}.png',cell=cell,motion=motion,idleFrameMs=ms))
    (ROOT/'sheets.json').write_text(json.dumps(sheets,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'review/art-manifest.json').write_text(json.dumps(dict(author='GPT 6.1 sol high monsters worker',
        method='Original coordinate-authored Python/Pillow; no imported bitmap artwork',
        sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        sourceFiles={f'source/{p}':hashlib.sha256((ROOT/'source'/p).read_bytes()).hexdigest()
                     for p in ['draw.py','pixels.py','organic.py','spirits.py','figures.py']},
        poseOrder=POSES,sheets=art),ensure_ascii=False,indent=2)+'\n')
    # Full roster overview; native pixels, padded cells, no sprite resampling.
    contact=Image.new('RGB',(960,666),'#26313f');cd=ImageDraw.Draw(contact)
    for i,(slug,cell,_,_,draw) in enumerate(SPECIES):
        x=(i%5)*192;y=(i//5)*222
        f=draw('idle_a').resize((cell*2,cell*2),Image.Resampling.NEAREST)
        contact.paste(f,(x+(192-cell*2)//2,y+192-cell*2),f)
        cd.text((x+8,y+199),slug,fill='#e0dbc4')
    contact.save(ROOT/'review/roster.png')
    print(json.dumps(dict(sheets=len(sheets),poses=sum(len(s['frames']) for s in art),assets=[s['sheet'] for s in art]),ensure_ascii=False))


if __name__=='__main__':main()
