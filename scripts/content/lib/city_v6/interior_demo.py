import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import warnings; warnings.filterwarnings('ignore')
from interior import room, compose, SIZE
from PIL import Image

def rugset(G,x0,y0,w,h):
    for y in range(h):
        for x in range(w):
            v='t' if y==0 else 'b' if y==h-1 else ''; u='l' if x==0 else 'r' if x==w-1 else ''
            G[y0+y][x0+x]='rug.'+((v+u) or 'c') if (v or u) else 'rug.c'
            if v and not u: G[y0+y][x0+x]='rug.'+v
            if u and not v: G[y0+y][x0+x]='rug.'+u
def lit(G,x,y,floor):
    G[y][x]='floor.%s.lita'%floor; G[y+1][x]='floor.%s.litb'%floor

def cottage():
    G=room(10,9,'tim',floor='wood',exit=5)
    rugset(G,4,5,3,2); lit(G,3,3,'wood')
    o=[('fireplace',4,1),('win',3,1),('win.curtain',7,1),('herbs',1,1),('sconce',8,1),
       ('bed.single',1,3),('chest',1,5),('cupboard',7,2),('table.sq',6,5),('chair.r',5,5),('candles',6,5),
       ('barrels',1,6),('plant',8,7),('mat',5,8)]
    o=[t for t in o if t[0]!='chair.r']+[('chair.d',7,4),('stool',8,6)]
    return compose(G,o)

def inn():
    G=room(18,13,'wod',notch=('tr',6,4),floor='check',exit=8)
    lit(G,2,3,'check'); lit(G,6,3,'check')
    o=[('win',2,1),('win',6,1),('fireplace',8,1),('sconce',4,1),('stairs.up',12,5-1),
       ('shelf.wall',14,4),('herbs',14,5),('sconce',11,5)]
    # L-shaped bar in the notch corner: horizontal run then down the right side
    bar=[('counter.e',11,8),('counter.ew.bottles',12,8),('counter.ew',13,8),('counter.ew.bottles',14,8),('counter.sw',15,8),('counter.ns',15,9),('counter.n',15,10)]
    o+=bar+[('stool',12,9),('stool',14,9),('barrels',15,6),('cauldron',16,9)]
    o+=[('table.long',2,5),('bench',2,4),('bench',3,7),('candles',3,5),
        ('table.long',2,9),('bench',2,8),('bench',3,11),('pots',6,10),('plant',1,11),
        ('table.sq',7,6),('chair.r',6,6),('chair.l',9,6),('crates',9,10),('mat',8,12)]
    return compose(G,o)

def shop():
    G=room(12,10,'sto',floor='flag',exit=6)
    lit(G,9,3,'flag')
    o=[('bookshelf',1,2),('wardrobe',3,2),('win',9,1),('painting',6,1),('sconce',5,1),('sconce',8,1),('shelf.wall',6,2-0)]
    o=[t for t in o if t!=('shelf.wall',6,2)]
    o+=[('counter.e',1,5),('counter.ew',2,5),('counter.ew.bottles',3,5),('counter.ew',4,5),('counter.w',5,5),
        ('chest',7,4),('pots',10,4),('stairs.down',8,5),('crates',1,7),('crate',3,8),('sacks',4,7),('plant',10,8),('stool',2,4),('mat',6,9),('candles',4,5)]
    return compose(G,o)

if __name__=='__main__':
    ims=[cottage(),inn(),shop()]
    W=sum(i.width for i in ims)+16*(len(ims)+1); H=max(i.height for i in ims)+32
    o=Image.new('RGBA',(W,H),(27,28,31,255)); x=16
    for i in ims: o.paste(i,(x,16)); x+=i.width+16
    o.save('interior_demo.png')
    for n,i in zip(('cottage','inn','shop'),ims): i.save('demo_%s.png'%n)
    print(o.size)
