"""Read native literal grids; diagnostic enlargement only. No pixel authoring here."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
colors={c:tuple(bytes.fromhex(v[1:]))+(255,) for c,v in palette.items()}
images={}
for path in sorted(list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))):
    rows=path.read_text().splitlines()
    if len(rows)!=128 or any(len(r)!=128 for r in rows): raise ValueError(path)
    im=Image.new('RGBA',(128,128))
    im.putdata([colors[c] if c!='.' else (0,0,0,0) for r in rows for c in r])
    images[path.stem]=im
    im.save(ROOT/'png'/(path.stem+'.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
order=[n for n in order if n in images]
for label,group in [('poses',order[:9]),('actions',order[9:])]:
    if len(group)==9:
        packed=Image.new('RGBA',(384,384))
        for index,name in enumerate(group): packed.paste(images[name],((index%3)*128,(index//3)*128))
        packed.save(ROOT/'png'/(label+'-native-3x3.png'))
for scale in (1,3):
    for bgname,bg in [('light','#ece3d0'),('dark','#17202b'),('checker',None)]:
        sheet=Image.new('RGB',(3*128*scale,((len(order)+2)//3)*(128*scale+18)),bg or '#777e85')
        for index,name in enumerate(order):
            x=(index%3)*128*scale;y=(index//3)*(128*scale+18)
            if bg is None:
                d=ImageDraw.Draw(sheet)
                for cy in range(0,128*scale,8*scale):
                    for cx in range(0,128*scale,8*scale):
                        d.rectangle((x+cx,y+cy,x+cx+8*scale-1,y+cy+8*scale-1),fill='#8e959c' if (cx//(8*scale)+cy//(8*scale))%2 else '#b1b6bb')
            art=images[name] if scale==1 else images[name].resize((128*scale,128*scale),Image.Resampling.NEAREST)
            sheet.paste(art,(x,y),art)
            ImageDraw.Draw(sheet).text((x+3,y+128*scale+2),name,fill='#35313e' if bgname!='dark' else '#eeeecc')
        sheet.save(ROOT/'png'/f'sheet-{bgname}-{scale}x.png')
# Exact authored RGB colors in GIF; transparency index 0.
flat=[0,0,0]
for c in palette: flat.extend(colors[c][:3])
flat += [0]*(768-len(flat)); indices={c:i+1 for i,c in enumerate(palette)}
gif_images={}
for name in order:
    path=ROOT/('poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions')/(name+'.pxgrid')
    im=Image.new('P',(128,128));im.putpalette(flat)
    im.putdata([indices.get(c,0) for r in path.read_text().splitlines() for c in r]); im.info['transparency']=0
    gif_images[name]=im
motions={'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[320,240,100,150,240,320]),'hit':(['idle_a','hit','recover'],[300,260,250]),'dead':(['hit','dead'],[230,1000]),'skill':(['skill_a','skill_b','skill_c','recover'],[360,220,300,240]),'poison':(['poison_a','poison_b'],[420,420]),'stun':(['stun_a','stun_b'],[450,450]),'sleep':(['sleep_a','sleep_b'],[600,650])}
for name,(seq,holds) in motions.items():
    if all(n in gif_images for n in seq):
        ims=[gif_images[n] for n in seq]
        ims[0].save(ROOT/'gif'/(name+'.gif'),save_all=True,append_images=ims[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
print('Rendered',len(images),'literal 128px frames,',sum(all(n in gif_images for n in s) for s,h in motions.values()),'GIFs')
