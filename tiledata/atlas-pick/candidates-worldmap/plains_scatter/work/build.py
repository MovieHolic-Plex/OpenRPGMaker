import sys, math; sys.path.insert(0,'../../plains_base/work')
from w2lib import *
LEG = {'a':('wleaf',0),'b':('wleaf',1),'c':('wleaf',2),'d':('wleaf',3),'e':('wleaf',4),'f':('wleaf',5),
       'o':('wbark',0),'k':('wbark',1),'m':('wbark',2),'n':('wbark',3),
       'p':('wrock',1),'q':('wrock',2),'r':('wrock',3),'s':('wrock',4),'t':('wrock',5),'u':('wrock',6),
       'w':('mwhite',3),'W':('mwhite',2),'y':('wgold',3),'x':('wgold',4),'Y':('wgold',2),
       'G':('wmead',2),'H':('wmead',3),'I':('wmead',4),'J':('wgrass',4)}

def blob(g, parts, tones, outline, lightdir=(-0.6,-0.8), rimlight=True):
    """parts: [(cx,cy,rx,ry)] 타원 합집합. tones: 밝은->어두운 글자 목록. 바깥 1화소는 outline."""
    H=len(g); W=len(g[0])
    def inside(x,y):
        return any(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1 for cx,cy,rx,ry in parts)
    M=[[inside(x,y) for x in range(W)] for y in range(H)]
    xs=[x for y in range(H) for x in range(W) if M[y][x]]; ys=[y for y in range(H) for x in range(W) if M[y][x]]
    cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2; R=max(max(xs)-min(xs),max(ys)-min(ys))/2+1
    n=len(tones)
    for y in range(H):
        for x in range(W):
            if not M[y][x]: continue
            edge = not all(M[yy][xx] if 0<=xx<W and 0<=yy<H else False for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
            l=((x+.5-cx)*lightdir[0]+(y+.5-cy)*lightdir[1])/R   # -1(어둠)..1(밝음)
            i=int((1-(l+1)/2)*n); i=max(0,min(n-1,i))
            if edge:
                g[y][x] = outline[0] if l>0.2 else outline[1]
            else: g[y][x]=tones[i]
    return M

def shadow(g, M, ch='~', ch2='-', dx=2, dy=1, only_empty=True):
    H=len(g); W=len(g[0])
    for y in range(H):
        for x in range(W):
            if M[y][x]: continue
            if 0<=x-dx<W and 0<=y-dy<H and M[y-dy][x-dx]:
                if g[y][x]=='.': g[y][x]=ch
            elif 0<=x-dx-1<W and 0<=y-dy<H and M[y-dy][x-dx-1] and g[y][x]=='.': g[y][x]=ch2

def put(g, pts):
    for x,y,c in pts: g[y][x]=c

def flower(g, x, y, petal='w', cen='y', leaf='H', stem=True):
    put(g,[(x,y-1,petal),(x-1,y,petal),(x+1,y,petal),(x,y+1,petal),(x,y,cen)])
    if stem: put(g,[(x,y+2,leaf),(x-1,y+3,leaf),(x+1,y+3,leaf)] if y+3<16 else [])

# ------------------------------ A -----------------------------
def treeA():
    g=blank(16,16,'.')
    M=blob(g,[(8,6,4.6,4),(5.5,7.5,3,2.6),(10.5,7.5,3,2.6)],['e','d','c','b'],('b','a'))
    put(g,[(7,10,'m'),(8,10,'k'),(7,11,'m'),(8,11,'k'),(7,12,'m'),(8,12,'k'),(6,12,'m'),(9,12,'k')])
    for y in (10,11,12):  # 줄기는 수관 밑
        pass
    for x in range(16):
        pass
    shadow(g,M,'-','-',3,3)
    put(g,[(10,13,'-'),(11,13,'-'),(12,13,'-'),(9,13,'-'),(6,13,'-')])
    return g
def rocksA():
    g=blank(16,16,'.')
    M=blob(g,[(6,9,3.6,3)],['t','s','r','q'],('q','p'))
    M2=blob(g,[(11.5,11.5,2.4,1.9)],['s','r','q'],('q','p'))
    M3=blob(g,[(3,12,1.6,1.3)],['t','s'],('r','q'))
    shadow(g,M,'-','-',2,1); shadow(g,M2,'-','-',2,1)
    return g
def flowersA():
    g=blank(16,16,'.')
    put(g,[(4,12,'H'),(5,11,'I'),(4,11,'H'),(3,11,'G'),(10,12,'I'),(11,11,'H'),(10,11,'G'),(9,11,'I'),(7,14,'H'),(8,13,'I')])
    flower(g,4,8,'w','y','H'); flower(g,10,6,'W','x','H',stem=False); flower(g,11,10,'w','y','H',stem=False)
    put(g,[(10,9,'H'),(10,8,'I'),(9,10,'G'),(11,12,'H')])
    put(g,[(3,4,'w'),(7,4,'y')])
    return g
# ------------------------------ B -----------------------------
def treeB():
    g=blank(16,16,'.')
    M=blob(g,[(8,6,4.8,4.2),(5,7.6,3,2.6),(11,7.6,3,2.6)],['f','e','d','c','b'],('e','a'),lightdir=(-0.75,-0.65))
    put(g,[(7,10,'n'),(8,10,'k'),(7,11,'n'),(8,11,'k'),(7,12,'m'),(8,12,'k'),(6,12,'m'),(9,12,'o'),(7,13,'k')])
    shadow(g,M,'~','-',3,3)
    put(g,[(9,13,'~'),(10,13,'~'),(11,13,'~'),(12,13,'-'),(8,13,'~'),(6,13,'-')])
    put(g,[(5,4,'f'),(6,3,'f'),(9,3,'f')])
    return g
def rocksB():
    g=blank(16,16,'.')
    M=blob(g,[(6,9,3.8,3.2)],['u','t','s','r','q'],('r','p'),lightdir=(-0.8,-0.6))
    M2=blob(g,[(11.5,11.5,2.5,2)],['t','s','r','q'],('r','p'),lightdir=(-0.8,-0.6))
    M3=blob(g,[(3,12.5,1.8,1.4)],['u','t','s'],('r','q'),lightdir=(-0.8,-0.6))
    shadow(g,M,'~','-',2,1); shadow(g,M2,'~','-',2,1); shadow(g,M3,'-','-',1,1)
    return g
def flowersB():
    g=blank(16,16,'.')
    put(g,[(4,12,'H'),(5,11,'J'),(4,11,'H'),(3,11,'G'),(10,12,'I'),(11,11,'J'),(10,11,'H'),(9,11,'G'),(7,14,'H'),(8,13,'J'),(12,13,'G'),(13,12,'H')])
    flower(g,4,8,'w','y','H'); flower(g,10,6,'w','x','H',stem=False); flower(g,12,10,'w','y','I',stem=False)
    put(g,[(10,9,'H'),(10,8,'J'),(9,10,'G'),(12,12,'H')])
    put(g,[(3,4,'w'),(7,4,'y'),(13,3,'w')])
    put(g,[(4,7,'W'),(9,6,'W')])
    return g
# ------------------------------ C -----------------------------
def treeC():
    g=blank(16,16,'.')
    M=blob(g,[(8,6.2,6.6,5.4)],['e','d','d','c'],('c','a'))
    put(g,[(7,12,'m'),(8,12,'k'),(7,13,'m'),(8,13,'k'),(6,13,'m'),(9,13,'k'),(7,11,'o'),(8,11,'o')])
    shadow(g,M,'-','-',2,2)
    put(g,[(10,14,'-'),(11,14,'-'),(12,14,'-'),(9,14,'-'),(6,14,'-'),(5,14,'-')])
    return g
def rocksC():
    g=blank(16,16,'.')
    M=blob(g,[(8,9,6.2,4.8),(4.5,10,3.2,3)],['t','s','r','r','q'],('q','p'))
    shadow(g,M,'-','-',2,1)
    put(g,[(6,7,'u'),(7,7,'u'),(5,8,'t')])
    return g
def flowersC():
    g=blank(16,16,'.')
    put(g,[(3,12,'H'),(4,11,'I'),(2,11,'G'),(13,12,'H'),(12,11,'I'),(14,11,'G'),(8,14,'H'),(7,13,'I'),(9,13,'G')])
    for cx,cy in ((5,6),(11,7),(8,11)):
        put(g,[(cx-1,cy-1,'w'),(cx,cy-1,'w'),(cx+1,cy-1,'w'),(cx-1,cy,'w'),(cx,cy,'x'),(cx+1,cy,'w'),(cx-1,cy+1,'w'),(cx,cy+1,'w'),(cx+1,cy+1,'w')])
        put(g,[(cx,cy-1,'W'),(cx-1,cy,'W')])
    put(g,[(5,9,'H'),(11,10,'H'),(8,14,'H')])
    return g
for X,(t,r,f) in {'A':(treeA,rocksA,flowersA),'B':(treeB,rocksB,flowersB),'C':(treeC,rocksC,flowersC)}.items():
    write(f'../w2-{X}.pxg', hjoin([rows(t()),rows(r()),rows(f())]), LEG, f'plains_scatter w2-{X}')
