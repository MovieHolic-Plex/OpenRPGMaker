# 전후 비교 시트 (작업용): python3 tiledata/hand-interior/v6-objects/sheet6.py OUT.png [scale] [names...]
import sys; sys.path.insert(0,'tiledata/hand-interior/v6-objects'); sys.path.insert(0,'tiledata/hand-interior/v5')
import apply6, rooms4
from kit4 import OBJ, assemble
from PIL import Image, ImageDraw
DEF=['bed green','double bed red','bed blue','bookshelf 1w','bookshelf 2w','bookshelf 3w','wardrobe','clock','nightstand','cupboard',
 'chest','royal chest','barrel','barrel:apple','barrel:fish','quench barrel','weapon barrel','water jar','pot','sofa','armchair',
 'chair S','chair N','chair E','chair W','stool','bar stool','bench 2','crate','crate:apple','basket:apple','basket:bun','sack:grain',
 'cabinet:pie','cabinet:bottle+bottler+bottley','cake display case','potted fern','potted flowering','potted sapling',
 'fireplace','bread oven','stove','kitchen range','counter 3x1']
def pair(n):
    if n.startswith('counter'):
        f=assemble('counter',3,1)
    else:
        f=OBJ[n][1](); f.id=n
    g=apply6.patch_item(f); return f.im,g.im
if __name__=='__main__':
    out=sys.argv[1]; S=int(sys.argv[2]) if len(sys.argv)>2 else 4; names=sys.argv[3:] or DEF
    ims=[(n,)+pair(n) for n in names]
    W=1500; x=y=rowh=0; tiles=[]
    for n,a,b in ims:
        w=(a.width*2+2)*S; h=a.height*S+14
        if x+w>W: x=0; y+=rowh+8; rowh=0
        tiles.append((n,a,b,x,y)); x+=max(w,120)+12; rowh=max(rowh,h)
    o=Image.new('RGBA',(W,y+rowh+8),(120,96,76,255)); d=ImageDraw.Draw(o)
    for n,a,b,x,y in tiles:
        d.text((x,y),n[:22],fill=(255,255,255))
        o.alpha_composite(a.resize((a.width*S,a.height*S),0),(x,y+12)); o.alpha_composite(b.resize((b.width*S,b.height*S),0),(x+(a.width+2)*S,y+12))
    o.save(out)
