# hand pixel kit v2 — rules read off the RTP Interior sheet (see study.md)
from PIL import Image
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))+(255,)
WOOD=[hx(c) for c in ('#000000','#411e05','#63310b','#6d3b15','#9a5435','#9e684b','#b77246','#d59147','#ffebd7')]
def H(x,y,s=0):
    n=(x*374761393+y*668265263+s*1442695040888963407)&0xffffffff; n=(n^(n>>13))*1274126177&0xffffffff; return ((n^(n>>16))&0xffff)/65535
class Pix:
    def __init__(s,w,h): s.w,s.h=w,h; s.im=Image.new('RGBA',(w,h)); s.p=s.im.load()
    def set(s,x,y,c):
        if c is not None and 0<=x<s.w and 0<=y<s.h: s.p[x,y]=c
    def get(s,x,y): return s.p[x,y] if 0<=x<s.w and 0<=y<s.h else (0,0,0,0)
    def lit(s,x0,y0,rows,key):
        for j,r in enumerate(rows):
            for i,ch in enumerate(r):
                if ch!=' ' and ch!='.': s.set(x0+i,y0+j,key[ch])
    def rect(s,x0,y0,x1,y1,c):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): s.set(x,y,c)
def K(ramp,extra=None):
    k={str(i):c for i,c in enumerate(ramp)}
    if extra: k.update({a:hx(b) if isinstance(b,str) else b for a,b in extra.items()})
    return k
WK=K(WOOD)
