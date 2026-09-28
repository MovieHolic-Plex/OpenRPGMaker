"""Sandstone badlands; hand-shaped mesas and wind-rippled sand."""
import sys
sys.dont_write_bytecode = True
from lib_cave import Canvas, rock, main

PALETTE=['#658e9d','#86a5ac','#b0beb7','#d0cbb7',
         '#9a7773','#b78b79','#cca78a','#dec5a0',
         '#694c4b','#926351','#b37a58','#d79d6c',
         '#c69e6d','#d0aa76','#dcb982','#e5c88f',
         '#505c4d','#697854','#8d9467','#b0af7d',
         '#aa875f','#bb9465']


def mesa(c,x,y,w,h,near=False):
    outline,shadow,base,light=(8,9,10,11) if near else (4,4,5,6)
    c.stamp([(0,h),(w//7,h//2),(w//6,8),(w//4,8),(w//4,2),
             (w*2//3,0),(w*3//4,6),(w*5//6,6),(w*6//7,h//2),(w,h)],x,y,outline)
    c.stamp([(2,h),(w//7+2,h//2),(w//6+2,10),(w//4+2,10),
             (w//4+2,4),(w*2//3-1,2),(w*2//3,h//3),(w//2,h),],x,y,base)
    c.stamp([(w//4+2,4),(w*2//3-2,3),(w*2//3-3,6),(w//4+2,7)],x,y,light)
    c.stamp([(w//6+2,12),(w//4+4,12),(w//4+1,h//2),(w//7+3,h//2)],x,y,light)
    c.stamp([(w*2//3,4),(w*3//4,8),(w*5//6-1,8),(w*6//7-1,h//2),
             (w-2,h),(w//2,h),(w*2//3,h//3)],x,y,shadow)
    # Uneven sediment beds; shelf lengths and breaks are deliberately authored.
    for dy in (14,23,29,42,52,59,72):
        if dy >= h-3:
            continue
        left=x+w//6-(dy//16)
        end=x+w*2//3-(3 if dy%2 else 7)
        c.line([(left,y+dy),(x+w//3,y+dy),(x+w//3+3,y+dy-1),
                (end,y+dy-1)],shadow,2)
        c.rect((left+2,y+dy-2,left+8,y+dy-1),light)
        if near:
            c.line([(end-2,y+dy+2),(end+4,y+dy+2),(end+6,y+dy)],base,2)
            c.poly([(left+4,y+dy+2),(left+8,y+dy+2),(left+10,y+dy+5),
                    (left+6,y+dy+6)],shadow)
            c.rect((left+14,y+dy+3,left+17,y+dy+4),light)
    if near:
        c.poly([(x+w//3,y+9),(x+w//3+4,y+9),(x+w//3+2,y+20),
                (x+w//3-1,y+23),(x+w//3-2,y+29),(x+w//3-3,y+29)],shadow)
        c.line([(x+w*2//3+2,y+19),(x+w*2//3+5,y+28),
                (x+w*2//3+3,y+41),(x+w*2//3+7,y+48)],outline)
    c.line([(x+w*3//4,y+12),(x+w*3//4-2,y+h//2),(x+w*3//4+1,y+h-5)],outline)


def cactus(c,x,y,h):
    c.stamp([(-4,0),(-4,-h+3),(-2,-h),(2,-h),(4,-h+3),(4,-h//3),
             (8,-h//3),(8,-h*2//3),(10,-h*2//3-2),(13,-h*2//3),
             (13,-h//3+4),(9,-h//3+7),(4,-h//3+7),(4,0)],x,y,16)
    c.rect((x-2,y-h+3,x+1,y),17)
    c.rect((x-2,y-h+3,x-1,y-2),18)
    c.rect((x+9,y-h*2//3+1,x+10,y-h//3+2),18)
    # Rib highlights are solid two-pixel segments, with a dark lower-right rim.
    c.rect((x-2,y-h+5,x-1,y-h+8),19)
    if h > 24:
        c.rect((x-2,y-h//2+1,x-1,y-h//2+4),19)
    c.line([(x+3,y-h//3+2),(x+8,y-h//3+2),(x+10,y-h//3)],17,2)
    c.stamp([(-4,-h//2),(-10,-h//2),(-12,-h//2-3),(-12,-h*3//4),
             (-9,-h*3//4-2),(-7,-h*3//4),(-7,-h//2-5),(-4,-h//2-5)],x,y,16)
    c.line([(x-10,y-h*3//4+1),(x-10,y-h//2-3),(x-5,y-h//2-3)],18,2)


def render():
    sky=Canvas(PALETTE,0)
    sky.rect((0,24,319,43),1)
    sky.rect((0,44,319,64),2)
    sky.rect((0,65,319,179),3)
    for x,y,w in [(26,14,48),(129,26,59),(250,10,41)]:
        sky.poly([(x,y+4),(x+12,y+4),(x+16,y+1),(x+29,y+1),
                  (x+33,y+3),(x+w-6,y+3),(x+w,y+5),(x+w-7,y+7),(x+3,y+7)],2)
    sky.poly([(87,8),(96,6),(110,6),(118,8),(135,8),(139,10),(102,10)],1)
    far=Canvas(PALETTE)
    mesa(far,-12,37,90,49)
    mesa(far,68,51,61,37)
    mesa(far,157,47,65,42)
    mesa(far,233,30,105,59)
    far.poly([(0,76),(49,75),(76,81),(103,76),(137,79),(169,73),
              (199,76),(234,72),(271,77),(319,74),(319,91),(0,91)],6)
    far.line([(78,79),(108,79),(123,81),(149,81),(162,78),(176,78)],7,2)
    mid=Canvas(PALETTE)
    mesa(mid,-20,14,68,79,True)
    mesa(mid,279,7,69,90,True)
    rock(mid,45,84,29,18,(8,9,10,11))
    rock(mid,257,84,27,17,(8,9,10,11))
    cactus(mid,84,82,23)
    cactus(mid,244,81,17)
    ground=Canvas(PALETTE)
    ground.rect((0,80,319,179),14)
    ground.poly([(0,80),(38,80),(71,84),(118,82),(153,80),(188,82),
                 (241,83),(275,80),(319,80),(319,91),(271,87),(226,90),
                 (175,87),(128,89),(83,87),(35,90),(0,87)],12)
    ground.poly([(0,95),(44,87),(70,88),(91,91),(112,92),(83,94),
                 (49,91),(26,96),(0,99)],15)
    ground.poly([(137,91),(160,88),(198,90),(228,92),(271,87),(298,87),
                 (319,92),(319,96),(293,92),(273,91),(231,97),(195,94),(170,93)],15)
    ground.poly([(0,139),(39,135),(77,135),(110,138),(154,135),(204,136),
                 (249,140),(284,136),(319,137),(319,142),(281,141),
                 (250,145),(207,140),(154,139),(113,142),(73,139),(40,139),(0,145)],13)
    ground.poly([(0,174),(48,172),(83,175),(120,173),(158,176),(203,172),
                 (240,174),(280,170),(319,174),(319,179),(0,179)],12)
    for x,y,w in [(37,108,21),(105,104,29),(204,109,27),(269,103,17),
                  (56,127,28),(141,120,19),(248,126,23),(18,156,23),
                  (89,161,30),(176,158,29),(265,160,34)]:
        ground.line([(x,y),(x+w//3,y-2),(x+w*2//3,y-2),(x+w,y-1)],13,2)
    # Rear sandstone rubble and short wind-combed sand clusters.
    for x,y,w,h in [(28,83,14,7),(100,82,12,5),(214,82,15,6),(277,83,17,7)]:
        rock(ground,x,y,w,h,(12,20,21,13))
    for x,y,w in [(21,95,20),(75,90,16),(257,92,24),(13,172,29),(262,171,37)]:
        ground.line([(x,y),(x+w//3,y-1),(x+w,y-1)],13,2)
        ground.line([(x+4,y+3),(x+w//3+5,y+2),(x+w-5,y+2)],13,2)
    rock(ground,-12,112,29,27,(8,9,10,11))
    rock(ground,306,144,29,26,(8,9,10,11))
    cactus(ground,8,99,25)
    cactus(ground,315,104,32)
    for x,y in [(12,137),(9,169),(310,163),(301,91)]:
        ground.line([(x-4,y),(x-6,y-5),(x-1,y-2),(x,y-7),(x+1,y-2),(x+5,y-5),(x+3,y)],20,2)
    for x,y in [(32,93),(58,96),(276,94),(19,174),(291,173)]:
        ground.clusters(x,y,21)
    for x,y,w,h in [(4,175,13,8),(307,177,18,9)]:
        rock(ground,x,y,w,h,(20,21,12,13))
    # Fan-shaped grass bunches and dune leeward edges stay on the lower frame.
    for x,y in [(26,177),(288,177),(6,126),(315,119)]:
        ground.line([(x-4,y),(x-7,y-4),(x-4,y-6),(x-1,y-1),
                     (x,y-8),(x+2,y-2),(x+5,y-5),(x+3,y)],20,2)
        ground.line([(x-3,y-4),(x-1,y),(x+3,y)],12,2)
    for x,y,w in [(42,176,27),(123,178,26),(234,177,27)]:
        ground.line([(x,y),(x+7,y-2),(x+w,y-2)],13,2)
        ground.rect((x+8,y,x+13,y+1),14)
    return dict(sky=sky,far=far,mid=mid,ground=ground)


if __name__=='__main__':
    main('desert',PALETTE,render)
