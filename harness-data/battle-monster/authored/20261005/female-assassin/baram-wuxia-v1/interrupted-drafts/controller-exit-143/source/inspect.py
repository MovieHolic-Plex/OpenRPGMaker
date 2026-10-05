from author import ROOT,decode
from PIL import Image,ImageDraw
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
paths=[]
for name in names:
    path=ROOT/('poses' if name in names[:9] else 'actions')/(name+'.pxgrid')
    if path.exists(): paths.append((name,path))
sheet=Image.new('RGB',(864,((len(paths)+2)//3)*340),(51,54,60))
d=ImageDraw.Draw(sheet)
for i,(name,path) in enumerate(paths):
    im=decode(path)
    im.save(ROOT/'progress'/(name+'.png'))
    pixels=im.load()
    coords=[(x,y) for y in range(64) for x in range(64) if pixels[x,y][3]]
    print(name,'bounds',min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords))
    if name=='idle_a': assert max(y for x,y in coords)==60
    ox=(i%3)*288; oy=(i//3)*340
    d.text((ox+12,oy+8),name,fill=(240,238,226))
    d.rectangle((ox+12,oy+26,ox+75,oy+89),fill=(214,210,200))
    sheet.paste(im,(ox+12,oy+26),im)
    check=Image.new('RGB',(256,256))
    cd=ImageDraw.Draw(check)
    for y in range(0,256,32):
        for x in range(0,256,32):
            color=(104,107,109) if (x//32+y//32)%2 else (144,145,141)
            cd.rectangle((x,y,x+31,y+31),fill=color)
    big=im.resize((256,256),Image.Resampling.NEAREST)
    check.paste(big,(0,0),big)
    sheet.paste(check,(ox+12,oy+78))
sheet.save(ROOT/'progress/contact-sheet.png')
