import sys; sys.path.insert(0,'/home/main/z-project/rpg-zzu-village-art/scripts/content/wasteland-ruins')
import wl_all, wl_core as C
from PIL import Image
ids=sys.argv[2].split(','); out=sys.argv[1]
dirt=Image.fromarray(C.render(C.PIECES['dirt-a']),'RGBA')
rows=[]
for i in ids:
    p=C.PIECES[i]; im=Image.fromarray(C.gate_array(p) if p['kind']=='terrain' else C.render(p),'RGBA')
    big=Image.new('RGBA',im.size,(255,0,255,255)); big.alpha_composite(im); big=big.resize((im.width*10,im.height*10),Image.NEAREST)
    W,H=im.width+32,im.height+32
    ctx=Image.new('RGBA',(W,H))
    for y in range(0,H,16):
        for x in range(0,W,16): ctx.paste(dirt,(x,y))
    ctx.alpha_composite(im,(16,16)); ctx=ctx.resize((W*4,H*4),Image.NEAREST)
    rows.append((big,ctx))
W=max(a.width+b.width+20 for a,b in rows); H=sum(max(a.height,b.height)+10 for a,b in rows)
B=Image.new('RGBA',(W,H),(40,40,40,255)); y=0
for a,b in rows: B.paste(a,(0,y)); B.paste(b,(a.width+20,y)); y+=max(a.height,b.height)+10
B.save(out)
