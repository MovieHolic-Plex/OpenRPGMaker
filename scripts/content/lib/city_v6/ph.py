# batch 6b: continuous pieces (picket fence, low stone wall — drawn per cell from its N/E/S/W neighbours) + market stall kit
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
import pg  # palettes
P={}; WATER=set()
N,E,S,Wd=1,2,4,8

def fence_cell(mask):
    # chipset idiom: pointed pickets 2px (+outline) every 4px, one rail through the middle;
    # a run going north/south is a single stick seen from above
    c=C(16,16,seed=140); c.period=16
    def pk(x):
        c.new()
        for y in range(4,13): c.tone(x,y,'wood',5 if y>5 else 6); c.tone(x+1,y,'wood',3)
        c.tone(x,3,'wood',4)
    c.group(1)
    if mask&N:
        c.new()
        for y in range(0,8): c.tone(8,y,'wood',5); c.tone(9,y,'wood',3)
    if mask&S:
        c.new()
        for y in range(8,16): c.tone(8,y,'wood',5); c.tone(9,y,'wood',3)
    c.group(2)
    if mask&Wd:
        c.new()
        for x in range(0,8): c.tone(x,7,'wood',4); c.tone(x,8,'wood',2)
    if mask&E:
        c.new()
        for x in range(8,16): c.tone(x,7,'wood',4); c.tone(x,8,'wood',2)
    c.group(None)
    if mask&Wd: pk(3)
    if mask&E: pk(13)
    if (mask&(E|Wd)) or not (mask&(N|S)): pk(8)
    if mask&(N|S) and mask&(E|Wd):                                              # corner post
        c.new()
        for y in range(3,13): c.tone(8,y,'bark',5); c.tone(9,y,'bark',3)
    return c

def gate_cell():
    # plank gate between two taller posts, Z brace, iron hinges; passable
    c=C(16,16,seed=141); c.period=16
    for x0 in (0,14):
        c.new()
        for y in range(1,14): c.tone(x0,y,'bark',5); c.tone(x0+1,y,'bark',2)
        c.tone(x0,0,'bark',4)
    c.group(2); c.new()
    for x in range(3,14):
        top=4 if x%2 else 5
        for y in range(top,13): c.tone(x,y,'wood',(5 if y>top else 6) if x%2 else 3)
    for x in range(3,14): c.tone(x,6,'wood',2); c.tone(x,11,'wood',2)
    for j in range(5): c.tone(4+2*j,11-j,'wood',1); c.tone(5+2*j,11-j,'wood',1)
    for y in (6,11): c.tone(3,y,'iron',5); c.tone(4,y,'iron',3)
    return c

def wall_cell(mask):
    # low field-stone wall: top face (light) + front face (6px) wherever the wall faces the viewer
    c=C(16,16,seed=150); c.period=16; c.group(1); c.new()
    def stone(x,y,top):
        row=y//3; off=3 if row%2 else 0
        v=(0.72 if top else 0.42)+(_hash((x+off)//5,row,150)-0.5)*0.22
        if not top and (y%3==2 or (x+off)%5==4): v-=0.3
        if top and ((x+off)%5==4 and y%3==2): v-=0.2
        c.setv(x,y,'stone',v)
    x0=0 if mask&Wd else 3; x1=16 if mask&E else 13
    for x in range(x0,x1):
        for y in range(5,9): stone(x,y,True)
        if not (mask&S) or x<3 or x>=13:
            for y in range(9,15): stone(x,y,False)
    if mask&N:
        for x in range(3,13):
            for y in range(0,5): stone(x,y,True)
    if mask&S:
        for x in range(3,13):
            for y in range(9,16): stone(x,y,True)
    for x in range(16):
        for y in range(16):
            if c.m[y][x]=='stone' and vnoise(x,y,2.5,7)>0.8 and y<9: c.setv(x,y,'moss',0.55)
    return c

def run(maskgrid,cellf,gates=()):
    Hh=len(maskgrid); Ww=len(maskgrid[0]); out=None
    from PIL import Image
    out=Image.new('RGBA',(Ww*16,Hh*16+1))
    for y in range(Hh):
        for x in range(Ww):
            if not maskgrid[y][x]: continue
            m=0
            if y>0 and maskgrid[y-1][x]: m|=N
            if x<Ww-1 and maskgrid[y][x+1]: m|=E
            if y<Hh-1 and maskgrid[y+1][x]: m|=S
            if x>0 and maskgrid[y][x-1]: m|=Wd
            t=(gate_cell() if (x,y) in gates else cellf(m)).img()
            out.alpha_composite(t,(x*16,y*16))
    return out

class Pic:  # adapter so run() results fit the P / card interface
    def __init__(s,im): s.im=im
    def img(s,outline=True): return s.im
PEN=["#########",
     "#.......#",
     "#.......#",
     "#.......#",
     "####.####"]
grid=[[ch=='#' or ch=='G' for ch in r] for r in PEN]
P['나무 울타리 (우리 + 문)']=lambda: Pic(run([[ch!='.' for ch in r] for r in ["#########","#.......#","#.......#","#.......#","####G####"]],fence_cell,gates={(4,4)}))
P['낮은 돌담 (ㄱ자·ㄷ자)']=lambda: Pic(run([[ch=='#' for ch in r] for r in ["#######..","#.....#..","#.....####","#........."][:4]] if False else [[ch=='#' for ch in r] for r in ["#######...","#.....#...","#.....####","#........."]],wall_cell))

# ---- market stall kit: columns L / M / R, rows awning / counter; awning colours and goods vary ----
AW={'red':('red','cream'),'blue':('cryst','cream'),'green':('lily','cream')}
GOODS=['apple','fish','bread','cabbage','pot','cloth']
def stall(w,color='red',goods=None):
    # 3 rows: awning (sloped striped roof + scalloped hem) / shaded booth with hanging goods / counter with goods on top
    goods=goods or [GOODS[i%len(GOODS)] for i in range(w)]
    a,b=AW[color]; Wp=w*16; c=C(Wp,49,seed=160); c.period=16
    c.group(1); c.new()                                                           # booth interior shade
    for y in range(14,30):
        for x in range(2,Wp-2): c.setv(x,y,'bark',0.34-0.06*(y-14)/16)
    for x in range(2,Wp-2):
        if x%16 in (5,11):
            for y in range(15,20): c.tone(x,y,'rope',4)
            c.ellipsoid(x+0.5,21,1.6,1.8,'cream',bias=0.1) if x%32<16 else c.ellipsoid(x+0.5,21,1.4,2.2,'red',bias=0.1)
    c.group(2)
    for x in (0,Wp-2):                                                            # front posts
        c.new()
        for y in range(4,46): c.tone(x,y,'bark',5 if x==0 else 4); c.tone(x+1,y,'bark',3 if x==0 else 2)
    c.group(3); c.box(1,28,Wp-2,4,12,'wood')                                      # counter: top 4 rows, front 12
    for x in range(1,Wp-1):
        if x%16==0: 
            for y in range(32,44): c.tone(x,y,'wood',2)
        c.tone(x,37,'wood',3)
    c.group(4)
    for i,g in enumerate(goods):                                                  # goods on the counter top
        x0=i*16; c.new()
        if g=='apple':
            for (dx,dy) in ((4,29),(8,29),(12,29),(6,27),(10,27)): c.ellipsoid(x0+dx,dy,2,1.8,'red',bias=0.15)
        elif g=='fish':
            for dy in (28,25):
                for k in range(10): c.tone(x0+3+k,dy,'iron',5 if k<7 else 3); c.tone(x0+3+k,dy+1,'iron',3)
                c.tone(x0+13,dy-1,'iron',4); c.tone(x0+13,dy+2,'iron',4); c.tone(x0+4,dy,'dark',1)
        elif g=='bread':
            for (dx,dy) in ((5,29),(11,29),(8,27)): c.ellipsoid(x0+dx,dy,3,1.7,'cloth',bias=0.2)
        elif g=='cabbage':
            for (dx,dy) in ((5,28),(11,28)): c.ellipsoid(x0+dx,dy,3,2.6,'leaf',bias=0.1)
        elif g=='pot':
            for dx in (5,11): c.new(); c.ellipsoid(x0+dx,27.5,2.6,2.8,'cloth',bias=-0.05); c.tone(x0+dx,25,'dark',2)
        elif g=='cloth':
            for (dx,m) in ((3,'red'),(7,'cryst'),(11,'gold')): c.new(); c.box(x0+dx,25,4,2,4,m,bias=0.05)
    c.group(5); c.new()                                                           # awning
    for y in range(2,13):
        for x in range(Wp):
            stripe=((x%16)//4)%2; c.setv(x,y,a if stripe==0 else b,0.98-0.35*(y-2)/11)
    for x in range(Wp):
        stripe=((x%16)//4)%2; lx=x%4; m=a if stripe==0 else b
        c.tone(x,13,m,2)
        if lx in (1,2): c.tone(x,14,m,2)
        if lx==1 or lx==2: c.tone(x,15,m,1) if lx==1 else None
    for x in range(Wp): c.tone(x,2,'bark',4); c.tone(x,3,'bark',2)
    return c
P['시장 노점 (빨강 3칸)']=lambda: stall(3,'red',['apple','cabbage','bread'])
P['시장 노점 (파랑 2칸)']=lambda: stall(2,'blue',['fish','fish'])
P['시장 노점 (초록 4칸)']=lambda: stall(4,'green',['pot','cloth','pot','cloth'])
