"""Wind-carved alpine snowfield, tiered spruce trees and jagged granite."""
import sys
sys.dont_write_bytecode = True
from lib_cave import Canvas, rock, main

PALETTE=['#647d9f','#7f99b6','#a5bacb','#c5d2d8',
         '#71829f','#8c9bb4','#b0bdd0','#dae1e6',
         '#3d5666','#4c6b78','#6b8993','#93aab1',
         '#b7c5d4','#c4d0db','#d2dce3','#e6e9e5',
         '#344553','#526779','#7c8d9f','#abbdc8',
         '#556376','#8d9ba9']


def pine(c,x,y,h,near=True):
    """Four scalloped bough clusters, dark undercuts, left snow shelves."""
    w=h*2//5
    dark,base,light=(8,9,10) if near else (9,10,11)
    c.rect((x-2,y+h//2,x+2,y+h+3),16 if near else 9)
    if near:
        c.rect((x-2,y+h//2,x-1,y+h),18)
    for tier in range(4):
        top=y+tier*h//6
        span=max(4,w*(tier+2)//6)
        bottom=top+h//3
        c.poly([(x,top),(x+3,top+5),(x+span-3,bottom-6),
                (x+span,bottom-4),(x+span-2,bottom-2),(x+span+2,bottom),
                (x+span//2,bottom-1),(x+span//3,bottom+2),
                (x-2,bottom),(x-span//3,bottom+2),(x-span//2,bottom),
                (x-span,bottom),(x-span+2,bottom-4)],dark)
        c.poly([(x,top+1),(x+2,top+6),(x+span-4,bottom-5),(x+span-1,bottom-3),
                (x+2,bottom-4),(x-2,bottom-1),(x-span+3,bottom-2),
                (x-span+5,bottom-7)],base)
        c.poly([(x,top+1),(x+1,top+7),(x+span//2,bottom-8),
                (x+span-5,bottom-5),(x+span//3,bottom-5),
                (x+span//4,bottom-3),(x-2,bottom-5),(x-5,bottom-3),
                (x-span+4,bottom-3),(x-span+7,bottom-7)],14 if near else 12)
        c.line([(x-span+6,bottom-6),(x-5,bottom-7),(x-2,bottom-9)],15 if near else 13,2)
        if near and span>8:
            # Snow pillows use stepped lips; short needles hang below them.
            c.poly([(x-span+6,bottom-6),(x-5,bottom-6),(x-3,bottom-4),
                    (x+3,bottom-4),(x+5,bottom-2),(x+2,bottom),
                    (x-2,bottom-2),(x-6,bottom-1),(x-10,bottom-3),
                    (x-span+5,bottom-3)],12)
            c.rect((x-6,bottom-5,x-3,bottom-4),15)
            c.line([(x-1,bottom-12),(x+2,bottom-9),(x+6,bottom-8)],12,2)
            c.line([(x-span+7,bottom-3),(x-span+10,bottom-2)],10,2)
            c.rect((x+span-5,bottom-2,x+span-3,bottom),8)
            c.rect((x-span+3,bottom,x-span+5,bottom+2),8)
        if near and span>8:
            c.rect((x-span+4,bottom-1,x-span+7,bottom),light)


def render():
    sky=Canvas(PALETTE,0)
    sky.rect((0,25,319,49),1)
    sky.rect((0,50,319,179),2)
    # Broad pixel clouds with stepped, not airbrushed, edges.
    for x,y,w in [(28,15,51),(131,32,63),(243,11,39)]:
        sky.poly([(x,y+4),(x+9,y+4),(x+13,y),(x+28,y),(x+33,y+3),
                  (x+w-5,y+3),(x+w,y+6),(x+w-8,y+8),(x+3,y+8)],2)
        sky.rect((x+11,y+4,x+w-8,y+5),3)
    # A few long upper cloud shelves keep the empty sky from reading as stripes.
    sky.poly([(86,8),(94,8),(97,6),(112,6),(117,8),(134,8),
              (139,10),(110,11),(93,10)],1)
    sky.poly([(202,19),(212,17),(228,17),(233,19),(249,19),
              (254,21),(216,21)],2)
    far=Canvas(PALETTE)
    ridge=[(0,59),(15,45),(24,49),(49,25),(57,31),(74,10),(86,23),
           (94,20),(118,46),(131,32),(145,41),(158,25),(174,42),
           (183,38),(203,51),(224,23),(236,30),(254,13),(269,31),
           (278,27),(306,53),(319,44),(319,86),(0,86)]
    far.poly(ridge,4)
    for pts in [[(15,45),(49,25),(42,42),(54,40),(30,66),(0,75)],
                [(57,31),(74,10),(67,34),(78,29),(66,53),(44,69)],
                [(131,32),(158,25),(151,45),(158,43),(139,65),(109,74)],
                [(203,51),(224,23),(218,48),(228,39),(211,66),(180,77)],
                [(236,30),(254,13),(249,39),(254,37),(242,59),(220,68)]]:
        far.poly(pts,6)
    for pts in [[(49,25),(57,31),(63,35),(54,33),(51,37),(47,35),(41,40)],
                [(74,10),(86,23),(94,20),(104,31),(95,28),(92,31),(85,25),
                 (80,30),(74,24),(68,31),(70,20),(63,26)],
                [(158,25),(174,42),(163,35),(160,38),(155,32),(148,38)],
                [(224,23),(236,30),(240,37),(231,33),(225,39),(223,31),(216,36)],
                [(254,13),(269,31),(259,25),(254,29),(250,25),(244,32)]]:
        far.poly(pts,7)
    # Broken scree ribs and snow gullies split the large triangular planes.
    for pts in [
        [(74,24),(81,35),(79,37),(85,44),(84,47),(95,57),(82,52),(72,39)],
        [(91,31),(100,42),(98,44),(110,58),(101,54),(92,45),(90,40)],
        [(49,37),(54,43),(51,46),(59,55),(49,50),(44,44)],
        [(158,35),(169,48),(168,51),(181,61),(170,56),(164,48),(158,46)],
        [(254,29),(261,38),(259,41),(274,57),(261,51),(254,39)],
        [(226,39),(234,50),(231,54),(241,63),(231,60),(220,48)]
    ]:
        far.poly(pts,5)
    for pts in [
        [(67,34),(65,43),(60,49),(63,48),(57,56),(54,57),(59,48),(61,42)],
        [(150,39),(146,48),(143,51),(145,51),(139,60),(135,62),(141,50)],
        [(248,39),(245,50),(239,58),(244,55),(238,62),(233,64),(240,52)],
        [(219,42),(215,53),(208,62),(204,65),(210,55),(212,53)]
    ]:
        far.poly(pts,7)
    far.poly([(0,70),(28,66),(65,73),(101,62),(126,68),(153,64),
              (190,73),(224,64),(258,69),(286,65),(319,70),(319,90),(0,90)],5)
    mid=Canvas(PALETTE)
    for x,y,h in [(30,49,34),(52,58,24),(72,60,24),(82,65,18),(110,64,20),
                  (188,66,16),(203,60,24),(227,58,27),(249,51,34),(275,54,32)]:
        pine(mid,x,y,h,False)
    pine(mid,9,23,67)
    pine(mid,311,17,76)
    pine(mid,34,40,48)
    pine(mid,289,41,46)
    ground=Canvas(PALETTE)
    ground.rect((0,80,319,179),14)
    ground.poly([(0,80),(35,80),(62,84),(104,85),(131,82),(172,83),
                 (219,86),(267,82),(319,80),(319,92),(280,95),(243,92),
                 (185,95),(133,91),(89,95),(36,92),(0,96)],12)
    ground.poly([(0,97),(33,91),(68,90),(88,92),(55,95),(30,99),(0,102)],15)
    ground.poly([(173,99),(204,95),(245,95),(279,91),(319,90),(319,95),
                 (279,98),(247,97),(208,100)],15)
    ground.poly([(0,142),(35,139),(80,140),(115,136),(158,137),(195,143),
                 (230,146),(274,141),(319,140),(319,152),(278,150),(231,154),
                 (194,149),(153,144),(117,142),(78,147),(33,145),(0,150)],13)
    ground.poly([(0,171),(50,169),(84,174),(139,170),(185,173),(236,169),
                 (286,171),(319,169),(319,179),(0,179)],12)
    for x,y,w in [(43,111,22),(105,101,18),(198,117,27),(267,108,17),
                  (84,152,23),(151,163,19),(249,160,22),(12,165,19)]:
        ground.poly([(x,y),(x+w//3,y-2),(x+w,y-2),(x+w-5,y),
                     (x+w//3,y+1),(x,y+1)],13)
    # Small drift lips with their own shade; no single-pixel snow noise.
    for x,y,w in [(32,85,22),(117,87,31),(222,85,21),(277,85,24),
                  (16,174,23),(254,175,35)]:
        ground.poly([(x,y),(x+5,y-2),(x+w-6,y-2),(x+w,y),
                     (x+w-3,y+2),(x+4,y+2)],13)
        ground.line([(x+5,y-2),(x+w-6,y-2)],14,2)
    # Feet and side boulders occupy only the frame; no objects behind battlers.
    rock(ground,-8,118,26,22,(16,17,18,19))
    ground.poly([(0,99),(10,97),(16,101),(17,105),(12,107),(3,105),(0,107)],15)
    rock(ground,307,139,24,22,(16,17,18,19))
    ground.poly([(310,121),(319,118),(319,126),(310,128),(307,126)],15)
    for x,y in [(6,87),(11,149),(313,99),(308,166)]:
        ground.line([(x-3,y),(x-4,y-4),(x-1,y-1),(x,y-6),(x+1,y),(x+4,y-3)],17)
    # Foreground snow shelves and tuft clusters are restricted to the border.
    for x,y,w,h in [(2,176,14,8),(305,178,17,9)]:
        rock(ground,x,y,w,h,(17,18,19,14))
        ground.poly([(x+1,y-h//2),(x+4,y-h+1),(x+w//2,y-h),
                     (x+w-3,y-h//2),(x+w//2,y-h//2+1),(x+5,y-h//2)],15)
    for x,y in [(5,135),(315,151),(27,176),(289,177)]:
        ground.line([(x-3,y),(x-5,y-4),(x-1,y-2),(x,y-6),
                     (x+1,y-1),(x+4,y-3)],18,2)
        ground.rect((x-3,y,x+3,y+1),13)
    return dict(sky=sky,far=far,mid=mid,ground=ground)


if __name__=='__main__':
    main('snow',PALETTE,render)
