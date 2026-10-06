"""Decode literal grids; composite diagnostics; encode exact-palette GIF holds.
Only diagnostics are nearest-neighbor enlarged. Native sources are never scaled.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
rgb={k:tuple(bytes.fromhex(v[1:])) for k,v in palette.items()}
frames={}
for folder in ('poses','actions'):
    for path in (ROOT/folder).glob('*.pxgrid'):
        rows=path.read_text().splitlines()
        if len(rows)!=64 or any(len(row)!=64 for row in rows): raise ValueError(path)
        im=Image.new('RGBA',(64,64))
        im.putdata([(*rgb[c],255) if c!='.' else (0,0,0,0) for row in rows for c in row])
        frames[path.stem]=im
        im.save(ROOT/'rendered'/(path.stem+'.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
order=[n for n in order if n in frames]
for theme,bg in [('light',(237,225,198)),('dark',(33,39,50)),('checker',None)]:
    sheet=Image.new('RGB',(6*272,3*302),(90,91,99))
    draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(order):
        tile=Image.new('RGB',(64,64),bg or (165,171,179))
        if bg is None:
            tile.putdata([(165,171,179) if (x//8+y//8)%2==0 else (212,212,202) for y in range(64) for x in range(64)])
        tile.paste(frames[name],(0,0),frames[name])
        x=(i%6)*272+8;y=(i//6)*302+22
        sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x,y))
        draw.text((x,y-16),name,fill=(255,255,255))
    sheet.save(ROOT/'rendered'/('sheet-'+theme+'.png'))
native=Image.new('RGB',(6*76,3*88),(222,218,205));draw=ImageDraw.Draw(native)
for i,name in enumerate(order):
    x=(i%6)*76+6;y=(i//6)*88+18
    draw.text((x,y-14),name,fill=(25,31,40))
    native.paste(frames[name],(x,y),frames[name])
native.save(ROOT/'rendered'/'sheet-native.png')
scenes={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
'hit':(['idle_a','hit','idle_a'],[700,180,900]),
'dead':(['idle_a','hit','dead'],[700,150,1700]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[300,300]),
'sleep':(['sleep_a','sleep_b'],[650,650]),
}
colorlist=list(rgb.values());gifpal=[0,0,0]+[v for color in colorlist for v in color];gifpal += [0]*(768-len(gifpal))
indexed={}
for name,im in frames.items():
    p=Image.new('P',(64,64));p.putpalette(gifpal)
    p.putdata([colorlist.index(c[:3])+1 if c[3] else 0 for c in im.get_flattened_data()]);p.info['transparency']=0
    indexed[name]=p
for name,(seq,holds) in scenes.items():
    if any(n not in frames for n in seq): continue
    indexed[seq[0]].save(ROOT/'motions'/(name+'.gif'),save_all=True,append_images=[indexed[n] for n in seq[1:]],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    with Image.open(ROOT/'motions'/(name+'.gif')) as decoded:
        for i,n in enumerate(seq):
            decoded.seek(i)
            if decoded.convert('RGBA').tobytes()!=frames[n].tobytes(): raise ValueError((name,i,'GIF pixel mismatch'))
            if decoded.info['duration']!=holds[i]:raise ValueError((name,i,'GIF hold mismatch'))
(ROOT/'motions'/'timing.json').write_text(json.dumps(scenes,indent=2)+'\n')
print('Rendered',len(frames),'literal frames and',sum(all(n in frames for n in seq) for seq,holds in scenes.values()),'GIFs')
