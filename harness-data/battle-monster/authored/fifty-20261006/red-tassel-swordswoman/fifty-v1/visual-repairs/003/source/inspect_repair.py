"""Diagnostic panels only: source PNGs/GIF strips, native and nearest zooms."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview'
before=Image.open(ROOT/'history/windup-before.png').convert('RGBA')
after=Image.open(OUT/'windup.png').convert('RGBA')
sheet=Image.new('RGB',(800,560),'#37323f');labels=ImageDraw.Draw(sheet)
for j,(tag,color) in enumerate([('light','#e7ded1'),('dark','#242332'),('checker',None)]):
    for i,(name,frame) in enumerate([('before',before),('after',after)]):
        bg=Image.new('RGBA',(64,64),color or '#c9c5c4')
        if color is None:
            d=ImageDraw.Draw(bg)
            for y in range(0,64,8):
                for x in range(0,64,8):
                    if (x//8+y//8)%2:d.rectangle((x,y,x+7,y+7),fill='#99949b')
        bg.alpha_composite(frame)
        x=j*264+8;y=i*272+24
        labels.text((x,y-17),f'{tag} / {name} / 1x + 3x',fill='white')
        sheet.paste(bg.convert('RGB'),(x,y))
        sheet.paste(bg.resize((192,192),Image.Resampling.NEAREST).convert('RGB'),(x+64,y+64))
sheet.save(OUT/'windup-repair-comparison.png')
for filename,names in [('motions-basic',['idle','attack','hit','dead']),('motions-states',['skill','poison','stun','sleep'])]:
    strips=[Image.open(OUT/(n+'-gif-frames.png')).convert('RGB') for n in names]
    panel=Image.new('RGB',(max(s.width for s in strips),sum(s.height+18 for s in strips)),'#dfd7c7')
    d=ImageDraw.Draw(panel);y=0
    for name,strip in zip(names,strips):
        d.text((4,y+2),name,fill='#222222');panel.paste(strip,(0,y+18));y+=strip.height+18
    panel.save(OUT/(filename+'.png'))
old=json.loads((ROOT/'history/before-source-hashes.json').read_text())
report={'changed_source_files':[], 'preserved_source_files':[], 'windup_changed_pixels':0, 'windup_changed_bounds':None}
for name,digest in old.items():
    same=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    report['preserved_source_files' if same else 'changed_source_files'].append(name)
a=(ROOT/'history/windup-before.pxgrid').read_text().splitlines()
b=(ROOT/'poses/windup.pxgrid').read_text().splitlines()
changed=[(x,y) for y in range(64) for x in range(64) if a[y][x]!=b[y][x]]
report['windup_changed_pixels']=len(changed)
report['windup_changed_bounds']=[min(x for x,y in changed),min(y for x,y in changed),max(x for x,y in changed),max(y for x,y in changed)]
report['windup_feet_y60']=[x for x,c in enumerate(b[60]) if c!='.']
(OUT/'repair-info.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
