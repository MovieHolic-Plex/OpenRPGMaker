"""Read literal grids and render exact RGBA, labeled diagnostic views and GIFs.
Only the diagnostic views use nearest-neighbor magnification.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
R = Path(__file__).resolve().parent
pal = json.loads((R/'palette.json').read_text())
colors = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k,v in pal.items()}
frames={}
order = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for group in ['poses','actions']:
    for path in sorted((R/group).glob('*.pxgrid')):
        grid=path.read_text().splitlines()
        if len(grid)!=96 or any(len(row)!=96 for row in grid):
            raise ValueError(f'{path.name}: expected 96 literal rows of 96')
        rgba=[]
        for y,row in enumerate(grid):
            for x,s in enumerate(row):
                if s!='.' and (x==0 or x==95 or y==0 or y>92):
                    raise ValueError(f'border {path.name} {x},{y}')
                rgba.append((0,0,0,0) if s=='.' else colors[s])
        im=Image.new('RGBA',(96,96)); im.putdata(rgba)
        im.save(R/'png'/f'{path.stem}.png')
        frames[path.stem]=im
present=[n for n in order if n in frames]
# Native + enlarged views, each on dark, light and checker backgrounds.
for label,bg in [('dark',(20,27,43,255)),('light',(240,237,224,255)),('checker',None)]:
    out=Image.new('RGBA',(6*310,((len(present)+5)//6)*432),(36,43,56,255))
    d=ImageDraw.Draw(out)
    for i,n in enumerate(present):
        bx,by=(i%6)*310,(i//6)*432
        tile=Image.new('RGBA',(96,96),bg or (115,124,137,255))
        if bg is None:
            px=tile.load()
            for y in range(96):
                for x in range(96):
                    px[x,y]=(170,179,187,255) if (x//8+y//8)%2 else (105,116,130,255)
        tile.alpha_composite(frames[n])
        d.text((bx+5,by+4),n,fill='white')
        out.paste(tile,(bx+5,by+22))
        out.paste(tile.resize((288,288),Image.Resampling.NEAREST),(bx+5,by+132))
    out.save(R/'png'/f'contact-{label}.png')
# Eight native animation previews. Dedicated exact palette, transparent index 0.
motions={
'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
'attack': [('idle_a',240),('windup',280),('move',140),('attack',220),('recover',220),('idle_a',360)],
'hit': [('idle_a',300),('hit',260),('recover',220),('idle_a',440)],
'dead': [('idle_a',300),('hit',220),('dead',1100)],
'skill': [('skill_a',360),('skill_b',260),('skill_c',300),('idle_a',440)],
'poison': [('poison_a',420),('poison_b',420)],
'stun': [('stun_a',480),('stun_b',480)],
'sleep': [('sleep_a',720),('sleep_b',720)]}
gifpal=[0,0,0]
for color in colors.values(): gifpal+=list(color[:3])
gifpal+=[0]*(768-len(gifpal))
lookup={v:i+1 for i,v in enumerate(colors.values())}
for name,seq in motions.items():
    if any(n not in frames for n,_ in seq): continue
    indexed=[]
    for n,ms in seq:
        f=Image.new('P',(96,96)); f.putpalette(gifpal)
        f.putdata([0 if a==0 else lookup[(r,g,b,a)] for r,g,b,a in frames[n].getdata()])
        indexed.append(f)
    indexed[0].save(R/'gif'/f'{name}.gif',save_all=True,append_images=indexed[1:],
                    duration=[ms for _,ms in seq],loop=0,transparency=0,disposal=2,optimize=False)
print('Rendered',len(frames),'native PNGs;',sum(all(n in frames for n,_ in seq) for seq in motions.values()),'GIFs.')
# Inspect decoded native GIF frames, preserving exact palette and transparency.
strip=Image.new('RGBA',(640,8*132),(34,42,58,255));sd=ImageDraw.Draw(strip)
records=[]
for row,(name,seq) in enumerate(motions.items()):
    if any(n not in frames for n,_ in seq): continue
    path=R/'gif'/f'{name}.gif'; decoded=Image.open(path)
    times=[]
    for i,(n,ms) in enumerate(seq):
        decoded.seek(i)
        actual=decoded.convert('RGBA')
        # Transparent RGB is immaterial; compare every opaque pixel and alpha.
        expected=frames[n]
        a=list(actual.getdata());e=list(expected.getdata())
        if any(pa[3]!=pe[3] or (pe[3] and pa!=pe) for pa,pe in zip(a,e)):
            raise ValueError(f'Decoded GIF differs: {name}, {i}, {n}')
        hold=decoded.info.get('duration');times.append(hold)
        tile=Image.new('RGBA',(96,96),(22,30,48,255));tile.alpha_composite(actual)
        strip.paste(tile,(i*104+4,row*132+30))
        sd.text((i*104+4,row*132+16),n,fill='white')
        sd.text((i*104+4,row*132+118),f'{hold} ms',fill='white')
    sd.text((4,row*132+2),name,fill='#A9DFD8')
    records.append({'motion':name,'frames':[n for n,_ in seq],'holdsMs':times,'nativeSize':[96,96],'decodedRGBAEqualsSource':True})
strip.save(R/'png'/'gif-decoded-frames.png')
(R/'render-record.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
# Native 3x3 packing, no resampling or authored-frame changes.
for group,names in [('poses',order[:9]),('actions',order[9:])]:
    sheet=Image.new('RGBA',(288,288),(0,0,0,0))
    for i,n in enumerate(names):
        sheet.paste(frames[n],((i%3)*96,(i//3)*96))
    sheet.save(R/'png'/f'{group}-sheet.png')
