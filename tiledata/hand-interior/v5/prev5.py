import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
import kit5
from kit5 import *
from PIL import Image
def sheet(items,out,sc=4,bg=(96,78,60)):
    W=sum(i.width+8 for i in items)+8; Hh=max(i.height for i in items)+16
    im=Image.new('RGBA',(W,Hh),bg+(255,)); x=8
    for i in items: im.alpha_composite(i,(x,Hh-8-i.height)); x+=i.width+8
    im.resize((W*sc,Hh*sc),Image.NEAREST).save(out)
if __name__=='__main__':
    cells=set(line(0,0,0,5))|set(line(0,3,4,3))|set(line(4,0,4,5))|{(2,5),(2,6)}
    a=[rug(cells,'red')[0].im, rug(rect(0,0,3,2),'blue')[0].im, rail(set(line(0,0,3,0))|set(line(3,0,3,3))|set(line(3,2,5,2)))[0].im,
       fence(set(line(0,0,3,0))|set(line(0,0,0,2)))[0].im, bars(set(line(0,0,3,0))|set(line(3,0,3,2)))[0].im, pipe(set(line(0,0,3,0))|set(line(3,0,3,2)))[0].im]
    sheet(a,'tiledata/hand-interior/v5/_lk.png',3)
    sheet([column(s).im for s in COL]+[dais(3,2).im,wall_torch().im,brazier().im,lantern().im],'tiledata/hand-interior/v5/_col.png',4)
