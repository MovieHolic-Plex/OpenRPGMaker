"""Decode literal grids to PNG/GIF; no art generation or palette quantization.
Nearest-neighbour enlargement is used only in diagnostic contact sheets.
All output is restricted to this source directory.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from render import read, background, preview
import json, hashlib
ROOT=Path(__file__).resolve().parent
BASE=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
TIMELINES={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,180,110,160,220,280]),
 'hit':(['idle_a','hit','recover','idle_a'],[240,280,180,280]),
 'dead':(['idle_a','hit','dead'],[240,200,1100]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,360,300,260,300]),
 'poison':(['poison_a','poison_b'],[360,360]),
 'stun':(['stun_a','stun_b'],[360,360]),
 'sleep':(['sleep_a','sleep_b'],[600,600]),
}

def indexed(name):
    palette=json.loads((ROOT/'palette.json').read_text())
    rows=(ROOT/('poses' if name in BASE else 'actions')/(name+'.pxgrid')).read_text().splitlines()
    ids={s:i+1 for i,s in enumerate(palette)}
    im=Image.new('P',(128,128),0)
    colors=[0,0,0]
    for h in palette.values(): colors.extend(bytes.fromhex(h[1:]))
    colors += [0]*(768-len(colors)); im.putpalette(colors)
    im.putdata([0 if s=='.' else ids[s] for row in rows for s in row])
    im.info['transparency']=0
    return im

for folder in ['png','gif','preview']: (ROOT/folder).mkdir(exist_ok=True)
for n in BASE+ACTIONS:
    decoded=read(n)
    decoded.save(ROOT/'png'/f'{n}.png')
    decoded.save(ROOT/'preview'/f'{n}.png')
for names,file in [(BASE,'poses.png'),(ACTIONS,'actions.png')]:
    sheet=Image.new('RGBA',(384,384))
    for i,n in enumerate(names):sheet.alpha_composite(read(n),((i%3)*128,(i//3)*128))
    sheet.save(ROOT/'png'/file)
# Labels/background are diagnostic only, never part of source grids.
for scale,filename in [(1,'native-contact.png'),(3,'enlarged-contact.png')]:
    side=128*scale; row=side+22
    sheet=Image.new('RGB',(side*6,row*3),'#232431'); d=ImageDraw.Draw(sheet)
    for i,n in enumerate(BASE+ACTIONS):
        im=background('checker');im.alpha_composite(read(n))
        sheet.paste(im.resize((side,side),Image.Resampling.NEAREST),((i%6)*side,(i//6)*row+22))
        d.text(((i%6)*side+4,(i//6)*row+5),n,fill='white')
    sheet.save(ROOT/'preview'/filename)
# Three-background contacts at 3x, split into groups so every pose can be opened.
for i,names in enumerate([BASE[:3],BASE[3:6],BASE[6:9],ACTIONS[:3],ACTIONS[3:7],ACTIONS[7:]]):
    preview(names,f'preview/backgrounds-{i+1}.png')
preview(['idle_a','attack','hit','skill_b','sleep_a'],'preview/diagnostic.png')
manifest={'timelines':{},'files':{}}
for action,(names,durations) in TIMELINES.items():
    frames=[indexed(n) for n in names]
    path=ROOT/'gif'/f'{action}.gif'
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=durations,loop=0,
                   transparency=0,disposal=2,optimize=False)
    # Decode every GIF frame back for an actual saved-file contact sheet.
    gif=Image.open(path); side=256; strip=Image.new('RGB',(side*len(names),side+22),'#232431');d=ImageDraw.Draw(strip)
    holds=[]
    for i,n in enumerate(names):
        gif.seek(i);decoded=gif.convert('RGBA');holds.append(gif.info['duration'])
        assert decoded.tobytes()==read(n).tobytes(), (action,i,'saved GIF pixel mismatch')
        bg=background('dark');bg.alpha_composite(decoded)
        strip.paste(bg.resize((side,side),Image.Resampling.NEAREST),(i*side,22))
        d.text((i*side+5,5),f'{n} {holds[-1]}ms',fill='white')
    strip.save(ROOT/'preview'/f'gif-{action}-decoded.png')
    manifest['timelines'][action]={'poses':names,'holdsMs':holds,'frames':gif.n_frames}
for p in sorted(ROOT.glob('*/*.pxgrid')):
    im=read(p.stem);rows=p.read_text().splitlines()
    pts=[(x,y) for y,r in enumerate(rows) for x,s in enumerate(r) if s!='.']
    assert all(rows[y][x]=='.' for y in [0,127] for x in range(128))
    assert all(rows[y][x]=='.' for x in [0,127] for y in range(128))
    assert max(y for x,y in pts)<=124
    if p.stem=='idle_a':assert max(y for x,y in pts)==124
    assert set(im.getchannel('A').tobytes())=={0,255}
    manifest['files'][str(p.relative_to(ROOT))]={
      'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
      'rgbaSha256':hashlib.sha256(im.tobytes()).hexdigest(),
      'inkBounds':im.getbbox(),'inkPixels':len(pts)}
assert len({v['rgbaSha256'] for v in manifest['files'].values()})==18
(ROOT/'preview'/'artifact-diagnostics.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Decoded 18 distinct native grids, 18 PNGs, 2 sheets and 8 GIFs. Margins, baseline and saved GIF pixels read back.')
