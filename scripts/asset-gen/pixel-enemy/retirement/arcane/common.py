"""Original final-grid drawing. Existing geometry helpers, no raster inputs."""
import sys, math
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from pe_lib import Pen, NAMES
from pe_rig import cap, clean
from beast_lib import blob, tube, bez, settle
BASE = dict(o='242337',s='3f5367',b='6d8b9c',l='a7c5ce',h='eef4dd',k='141527',e='e4f3a7',a='65547b',u='87749e',v='b5a1c4',r='864b3f',g='76a177',w='d8cdb0',f='daae58',z='eb6d8b')
# lean, torso compression, hand reach, tail flex: idle anatomy changes as well as height.
POSE = {'idle_a':(0,0,0,0),'idle_b':(0,1,1,1),'idle_c':(1,0,-1,-1),
'windup':(-2,2,-4,-2),'move':(2,-1,2,3),'attack':(3,1,7,4),'recover':(1,2,2,1),'hit':(-3,1,-3,-3)}
def pen(cell,pal=None): return Pen(cell,dict(BASE,**(pal or {})))
def eye(p,x,y,c='e',wide=3):
    p.box((x,y,x+wide,y+2),'o'); p.box((x+1,y,x+wide-1,y+1),c)
def claw(p,pts,w=3,c='b'):
    cap(p,pts,w,c,lit='l',dark='s')
    x,y=pts[-1]
    for q in ([(x,y),(x+3,y-1)],[(x,y),(x+4,y+1)],[(x,y+1),(x+2,y+3)]):p.line(q,'h')
def diamond(p,x,y,w,h,c='b'):
    p.poly([(x,y-h),(x+w,y),(x,y+h),(x-w,y)],c,'o')
    p.poly([(x,y-h+1),(x,y),(x-w+1,y)],'l')
def mouth(p,x,y,w=7,h=4):
    p.poly([(x,y),(x+w,y),(x+w-1,y+h),(x+1,y+h+1)],'k','o')
    for k in range(1,w,3):p.line([(x+k,y),(x+k,y+1)],'h')
    if h>3:
        for k in range(2,w,3):p.line([(x+k,y+h-1),(x+k,y+h)],'h')
def finish(p,n,air=False):
    clean(p)
    settle(p,p.im.height-4 if n=='dead' or not air else None)
    return p
