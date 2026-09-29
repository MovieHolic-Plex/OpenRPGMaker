"""Original red dragon boss: angular wings, S neck, horn crown, planted breath."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=96
PAL=dict(o='301f30',s='602a3e',b='a33c49',l='d85c52',h='f18e68',w='593042',m='8c3e4e',v='ba5c57',t='bb986c',c='e9c18a',e='ffeaa6',f='e97139',g='f9bb50')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.poly([(12,85),(25,70),(41,82),(55,78),(67,85),(79,87),(83,92),(21,92)],'b','o')
        p.poly([(25,72),(29,85),(46,90),(16,88)],'m','o')
        p.line([(27,76),(31,86),(45,90)],'v')
        p.poly([(58,84),(67,81),(73,84),(83,86),(85,90),(68,92),(58,89)],'l','o')
        p.line([(74,86),(77,88),(80,86)],'o'); return p
    b=1 if n=='idle_c' else 0
    # Tail curls left to balance the neck at x65; no source image, no scaling.
    p.poly([(46,74),(32,77),(20,84),(11,83),(8,79),(8,86),(13,90),(26,89),(45,84),(55,79)],'b','o')
    p.line([(10,85),(18,87),(30,82),(42,80)],'l')
    wingY={'idle_a':21,'idle_b':23,'idle_c':25,'windup':18,'attack':27,'move':20,'recover':23,'hit':30}.get(n,21)
    p.poly([(46,62),(32,35),(18,wingY),(21,48),(13,61),(27,55),(34,67),(38,58),(49,70)],'w','o')
    p.poly([(47,60),(31,37),(20,wingY+3),(24,47),(29,51),(34,61),(37,54)],'m')
    p.line([(48,64),(31,35),(18,wingY),(24,47),(14,61)],'v')
    p.line([(31,35),(28,54),(34,65)],'s')
    p.poly([(45,54),(43,31),(48,25),(52,43),(59,47),(51,47),(52,57)],'w','o')
    p.line([(45,52),(45,33),(48,27),(51,43)],'v')
    # Far foot then pear-shaped torso, brighter planes on the upper left.
    p.poly([(53,74),(64,73),(67,85),(74,89),(74,92),(55,92),(55,87)],'s','o')
    p.poly([(37,55+b),(49,46+b),(61,48+b),(69,61+b),(68,76),(59,86),(41,85),(33,73),(33,63)],'b','o')
    p.poly([(37,58+b),(47,50+b),(55,50+b),(50,61),(46,75),(39,78),(35,70)],'l')
    p.poly([(57,54+b),(63,55+b),(68,64),(65,77),(59,83),(52,82),(55,71)],'t')
    for y in [62,68,74,80]: p.line([(55,y),(64,y+2)],'s')
    p.poly([(40,74),(50,75),(51,85),(58,89),(58,92),(36,92),(35,89),(40,85)],'b','o')
    p.poly([(42,77),(46,77),(46,85),(39,88),(38,90),(50,90),(44,88)],'l')
    for x in [47,52,66,71]: p.poly([(x,89),(x+3,92),(x-1,92)],'c')
    # Broken scale clusters on the lit shoulder; shadow terminates under the wing.
    p.poly([(34,66),(38,74),(39,81),(34,75),(32,69)],'s')
    p.line([(40,56+b),(43,54+b),(46,55+b)],'h')
    p.line([(38,62+b),(41,60+b),(44,61+b)],'h')
    p.line([(41,68),(44,66),(47,67)],'l')
    # Neck/head geometry, independently shifted at joints (not image rotation).
    hx,hy={'windup':(52,23),'move':(57,26),'attack':(65,40),'hit':(51,35),'recover':(59,32)}.get(n,(60,30+b))
    p.poly([(53,57),(55,45),(hx-3,hy+6),(hx+1,hy),(hx+10,hy+2),(hx+11,hy+12),(65,51),(65,62)],'b','o')
    p.poly([(56,52),(58,44),(hx,hy+5),(hx+3,hy+3),(hx+5,hy+10),(61,48),(61,55)],'l')
    p.line([(57,54),(hx+3,hy+8)],'b',7)
    p.line([(56,50),(hx+2,hy+6)],'l',2)
    p.poly([(hx,hy),(hx+10,hy-2),(hx+14,hy+2),(hx+20,hy+4),(hx+21,hy+9),(hx+12,hy+12),(hx+4,hy+10)],'l','o')
    p.poly([(hx+2,hy),(hx-2,hy-8),(hx+5,hy-3)],'c','o')
    p.poly([(hx+8,hy-1),(hx+8,hy-9),(hx+12,hy-2)],'t','o')
    p.line([(hx+10,hy+2),(hx+14,hy+3)],'o'); p.box((hx+11,hy+4,hx+13,hy+5),'e')
    p.line([(hx+18,hy+5),(hx+19,hy+5)],'s')
    p.box((hx+13,hy+4,hx+13,hy+5),'o')
    p.line([(hx+3,hy+2),(hx+7,hy+1)],'h')
    if n=='hit': p.line([(hx+10,hy+4),(hx+13,hy+5)],'o')
    if n in ('attack','windup'):
        p.poly([(hx+10,hy+8),(hx+21,hy+8),(hx+20,hy+14),(hx+11,hy+14),(hx+6,hy+10)],'o')
        p.line([(hx+11,hy+14),(hx+19,hy+15)],'l')
        p.grid(hx+12,hy+8,['c..c','c...'])
        if n=='attack':
            p.poly([(hx+17,hy+11),(hx+23,hy+8),(hx+27,hy+7),(hx+25,hy+11),(hx+28,hy+14),(hx+22,hy+14),(hx+19,hy+13)],'f')
            p.line([(hx+19,hy+11),(hx+25,hy+11)],'g',2)
    else: p.line([(hx+11,hy+9),(hx+20,hy+9)],'o')
    p.poly([(52,60),(58,62),(66,70),(69,70),(69,73),(63,73),(55,69),(49,64)],'b','o')
    p.line([(53,61),(59,65),(64,70)],'h')
    return p
if __name__=='__main__': build('dragon',CELL,PAL,draw)
