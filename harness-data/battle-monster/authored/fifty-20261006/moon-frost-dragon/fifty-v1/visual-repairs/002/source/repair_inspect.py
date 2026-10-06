"""Read actual palette grids, make labelled diagnostic comparison/crops only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
OUT = ROOT/'preview'
P = json.loads((ROOT/'palette.json').read_text())
C = {s: tuple(bytes.fromhex(v[1:]))+(255,) for s,v in P.items()}
C['.'] = (0,0,0,0)
NAMES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']

def read(root, name):
    folder = 'poses' if name in NAMES[:9] else 'actions'
    rows = (root/folder/(name+'.pxgrid')).read_text().splitlines()
    im = Image.new('RGBA',(128,128))
    im.putdata([C[s] for row in rows for s in row])
    return im

sheet = Image.new('RGB',(693,1290),'#f2eedf')
d = ImageDraw.Draw(sheet)
for i,name in enumerate(NAMES):
    x = i%3*231
    y = i//3*215
    d.text((x+3,y+3),name+' x36..112/y60..124',fill='#152D43')
    crop = read(ROOT,name).crop((36,60,113,125)).resize((231,195),Image.Resampling.NEAREST)
    sheet.paste(crop,(x,y+20),crop)
sheet.save(OUT/'forelegs-3x.png')

sheet = Image.new('RGB',(768,1212),'#f2eedf')
d = ImageDraw.Draw(sheet)
for i,name in enumerate(['idle_a','attack','hit']):
    for j,root in enumerate([ROOT/'before-foreleg-repair',ROOT]):
        y=i*404
        x=j*384
        d.text((x+5,y+5),name+(' / before' if j==0 else ' / current'),fill='#152D43')
        im=read(root,name).resize((384,384),Image.Resampling.NEAREST)
        sheet.paste(im,(x,y+20),im)
sheet.save(OUT/'repair-comparison.png')
