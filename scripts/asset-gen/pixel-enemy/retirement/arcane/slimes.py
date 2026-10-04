"""Eight jelly species; native crown, cube, metallic facets and acidic lobes."""
from common import *
PALS={
'slime-blue':dict(s='245885',b='368fcd',l='83cbe6',h='e5fbf2'),
'slime-green':dict(s='337553',b='60b36e',l='a9db91',h='edffd4'),
'slime-metal':dict(s='697689',b='a8b3c0',l='d7dfe2',h='fffbe8'),
'king-slime-01':dict(s='2f6f48',b='4fa857',l='9cce70',h='edffd1'),
'slime-king':dict(s='245e4c',b='3d9563',l='83c994',h='e3f4bc'),
'slime-cube':dict(s='307358',b='52a97a',l='8cdb98',h='ddffd0'),
'ooze-black':dict(s='292638',b='443b54',l='665b78',h='e5e0de'),
'ooze-acid':dict(s='236565',b='3c9b92',l='85d7b3',h='e9ffe7')}
def draw(slug,n):
    p=pen(48,PALS[slug]); cube=slug=='slime-cube'; king='king' in slug
    if n=='dead':
        p.poly([(8,43),(13,41),(20,40),(28,41),(37,42),(39,44),(9,44)],'b','o')
        p.line([(13,42),(22,41),(29,42)],'l');p.grid(24,42,['o.o.o'])
        if king:
            p.poly([(19,40),(17,36),(21,37),(23,34),(26,38),(30,36),(29,41)],'f','o');diamond(p,24,38,1,2,'z')
        if cube:p.line([(12,42),(18,39),(34,41)],'s')
        return finish(p,n)
    d,dy,reach,sw=POSE[n]
    shapes={'idle_a':(24,34,14,11),'idle_b':(24,35,15,10),'idle_c':(25,33,13,12),'windup':(21,37,16,8),'move':(27,30,11,13),'attack':(28,35,17,10),'recover':(25,36,15,9),'hit':(21,34,13,11)}
    cx,cy,rx,ry=shapes[n]
    if king:cy-=4;ry+=4;rx+=1
    if slug=='ooze-acid':rx+=1;ry-=2;cy+=2
    if slug=='slime-green':ry-=1;cy+=1
    if slug=='slime-metal':ry-=3;cy+=3
    if cube:
        x,y=11+d,20+dy
        # Three planes of jelly flex independently, retaining cube corners.
        w=23+(2 if n in ('windup','hit','recover') else -1 if n=='idle_c' else 0);h=21-dy+(1 if n=='idle_c' else -1 if n=='recover' else 0)
        p.poly([(x,y+5),(x+9,y),(x+w,y+3),(x+w,y+h),(x+8,y+h+5),(x,y+h+2)],'s','o')
        p.poly([(x,y+5),(x+9,y),(x+w,y+3),(x+w-9,y+8)],'l','o')
        p.poly([(x,y+5),(x+w-9,y+8),(x+w-9,y+h+5),(x,y+h+2)],'b','o')
        p.line([(x+2,y+7),(x+2,y+h),(x+8,y+h+2)],'h')
        p.line([(x+w-3,y+7),(x+w-3,y+h-1)],'b')
        fx,fy=x+6,y+11
    else:
        blob(p,cx,cy,rx,ry, -15 if n=='hit' else 0)
        # Flat grounded rim and optional viscous side lobes.
        p.poly([(cx-rx+3,42),(cx+rx-2,42),(cx+rx-5,44),(cx-rx+6,44)],'s','o')
        p.line([(cx-rx+5,42),(cx-2,43)],'l')
        p.poly([(cx-rx+4,cy-5),(cx-rx+7,cy-7),(cx-rx+10,cy-5),(cx-rx+8,cy-2),(cx-rx+4,cy-2)],'h')
        if slug=='ooze-acid':
            for x,y in [(11+sw,40),(34,40),(18,43)]:blob(p,x,y,4,2,keys={'b':'b','l':'l','s':'s'})
            p.grid(cx-5,cy-2,['ll','lh']);p.grid(cx+5,cy+4,['hh','hl'])
        if slug=='ooze-black':
            for q in [[(cx-8,cy-2),(cx-4,cy-4),(cx-2,cy),(cx-4,cy+3),(cx-8,cy+2)],[(cx+5,cy+4),(cx+9,cy+2),(cx+9,cy+6),(cx+6,cy+7)]]:p.poly(q,'h')
        if slug=='slime-metal':
            p.poly([(cx-8,cy-5),(cx-2,cy-7),(cx+6,cy-4),(cx-1,cy-3)],'h')
            p.line([(cx+7,cy-2),(cx+9,cy+3),(cx+5,cy+6)],'l')
            p.line([(cx-4,cy+6),(cx+4,cy+6)],'h')
        fx,fy=cx+1,cy-1
    # Face cluster is on right half and changes with compression/impact.
    if n=='hit':
        p.line([(fx-2,fy),(fx,fy+2),(fx-2,fy+3)],'o');p.line([(fx+4,fy),(fx+2,fy+2),(fx+4,fy+3)],'o')
    else:
        for x in (fx-2,fx+4):
            p.box((x,fy,x+2,fy+3),'o');p.box((x,fy,x+1,fy+1),'h')
    if n=='attack':mouth(p,fx,fy+5,5,3)
    else:p.line([(fx,fy+5),(fx+1,fy+6),(fx+3,fy+5)],'o')
    if king:
        ky=cy-ry-6
        # First crown tall with three red settings, second broad four prongs.
        kx=cx-6
        p.poly([(kx,ky+6),(kx-1,ky),(kx+3,ky+3),(kx+6,ky-2),(kx+9,ky+3),(kx+13,ky),(kx+12,ky+7)],'f','o')
        p.line([(kx+1,ky+5),(kx+11,ky+5)],'h');diamond(p,kx+6,ky+4,2,2,'z')
        if slug=='slime-king':
            p.grid(kx+2,ky+4,['zz']);p.grid(kx+10,ky+4,['zz']);p.line([(kx+3,ky+7),(kx+9,ky+7)],'r')
    if n=='attack' and not cube:
        p.poly([(40,33),(43,30),(44,34),(42,36)],'b','o')
    return finish(p,n)
