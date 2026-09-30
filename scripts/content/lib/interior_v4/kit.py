# adapter: v2 hand pieces with the v1 API (F objects: im, fw, fh, up, kind) so the room plans reuse unchanged
import sys; sys.path.insert(0,'/tmp/j8v4')
from PIL import Image
import p1,p2,p3,p4,p5
class F:
    def __init__(s,im,fw,fh,up=0,kind='floor'): s.im,s.fw,s.fh,s.up,s.kind=im,fw,fh,up,kind
def _fit(im,fw,fh,up):   # bottom-align the drawing inside fw x (fh*16+up)
    W,Hh=fw*16,fh*16+up; out=Image.new('RGBA',(W,Hh)); out.alpha_composite(im,((W-im.width)//2,Hh-im.height)); return out
def bed(cloth='red',double=False): return F(p2.bed(32 if double else 16,{'red':'red','teal':'blue'}.get(cloth,'green')),2 if double else 1,2,6,'wall')
def table(wc=2,hc=1,cloth=None): return F(p1.table(wc*16,hc*16,wc+hc),wc,hc,0,'floor')
def chair(face='s'): return F(p1.chair(face.upper()),1,1,0,'floor')
def stool(): return F(p1.stool(),1,1,0,'floor')
def bookshelf(wc=2):
    im=p2.bookshelf(wc*16,3,wc*7); return F(im,wc,1,im.height-16,'wall')
def cupboard(): return F(p2.dresser(),1,1,8,'wall')
def wardrobe(): return F(p4.wardrobe(),1,1,16,'wall')
def clock(): return F(p3.clock(),1,1,16,'wall')
def chest(): return F(p3.chest(),1,1,0,'floor')
def barrel(): return F(p3.barrel(),1,1,0,'floor')
def crate(): return F(p3.crate(),1,1,0,'floor')
def sack(): return F(p4.sack(),1,1,0,'floor')
def plant(): return F(p3.plant(),1,1,0,'floor')
def pot(): return F(p3.jar(),1,1,0,'floor')
def candle(): return F(p4.candle(),1,1,0,'floor')
def rug(wc=3,hc=2,col='red'): return F(p4.rug(wc,hc,col),wc,hc,0,'flat')
def fireplace(frame=None): return F(p4.fireplace(),2,1,16,'wall')
def window(curtain=None): return F(p3.window(),1,0,0,'hang')
def picture(): return F(p3.picture(),1,0,0,'hang')
def shelf_pots(): return F(p4.shelf_pots(),1,0,0,'hang')
def bottles(): return F(p4.bottles(),1,0,0,'hang')
def weapon_rack(): return F(p5.weapon_rack(),1,0,0,'hang')
def shield(): return F(p5.shield(),1,0,0,'hang')
def counter(wc=3,goods=()):
    im=p4.counter(wc)
    for i,g in enumerate(goods):
        im.alpha_composite(p5.goods_img(g),(6+i*((wc*16-12)//max(1,len(goods))),-1))
    return F(im,wc,1,8,'floor')
def stove(): return F(p4.stove(),1,1,8,'wall')
def stairs_up(wc=3,mat='stone'): return F(p4.stairs_up(wc,mat),wc,1,32,'wall')
def stairs_down(): return F(p4.stairs_down(),1,1,0,'flat')
def doormat(): return F(p5.doormat(),1,1,0,'flat')
def bench(wc=2): return F(p5.bench(wc),wc,1,0,'floor')
def roundtable(): return F(p5.roundtable(),1,1,0,'floor')
def display(goods='potion'): return F(p5.display(goods),1,1,0,'floor')
