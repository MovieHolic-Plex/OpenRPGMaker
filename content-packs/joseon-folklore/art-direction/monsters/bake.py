"""Bake literal 64x64 symbol grids via direct Pillow pixel assignment.
Only review assets use nearest-neighbour enlargement. Candidate PNGs never resize.
All writes are confined to this directory. Input references are read-only.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[3]
NAMES=['wild-boar','straw-dokkaebi','maiden-ghost']

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def bake(name):
    rows=(ROOT/'source'/f'{name}.pxgrid').read_text().splitlines()
    pal=json.loads((ROOT/'source'/f'{name}.palette.json').read_text())
    assert len(rows)==64 and all(len(r)==64 for r in rows)
    colors={symbol:tuple(bytes.fromhex(color[1:]))+(255,) for symbol,color in pal.items()}
    colors['.']=(0,0,0,0)
    im=Image.new('RGBA',(64,64),(0,0,0,0))
    pixels=im.load()
    for y,row in enumerate(rows):
        for x,symbol in enumerate(row): pixels[x,y]=colors[symbol]
    path=ROOT/'candidates'/f'{name}.png'
    im.save(path)
    box=im.getbbox()
    used={color for count,color in im.getcolors(4096) if color[3]}
    return im,dict(path=str(path),sha256=digest(path),cell_size=[64,64],mode='RGBA',bbox=list(box),
        silhouette_size=[box[2]-box[0],box[3]-box[1]],opaque_colors=len(used),
        alpha_values=sorted(color for count,color in im.getchannel('A').getcolors(4096)),status='candidate-awaiting-user-visual-steering')

images={}; meta={}
for name in NAMES: images[name],meta[name]=bake(name)
old={}
for name in NAMES:
    path=REPO/'content-packs/joseon-folklore/monsters/assets/portraits'/f'{name}.png'
    im=Image.open(path).convert('RGBA'); old[name]=im
    im.save(ROOT/'reference'/f'old-{name}.png')
actor_path=REPO/'public/assets/easyrpg/charset/Actor1.png'
actor_sheet=Image.open(actor_path)
# RM2000: actor slot zero, middle idle column, right-facing direction row.
actor=actor_sheet.crop((24,64,48,96)).convert('RGBA')
bg=actor_sheet.convert('RGBA').getpixel((0,0))
p=actor.load()
for y in range(32):
    for x in range(24):
        if p[x,y]==bg: p[x,y]=(0,0,0,0)
actor.save(ROOT/'reference'/'Actor1-original-24x32.png')
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
    title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
except OSError: font=title=ImageFont.load_default()
sheet=Image.new('RGBA',(1100,862),(31,35,41,255)); d=ImageDraw.Draw(sheet)
d.text((22,16),'JOSEON FOLKLORE / native pixel correction candidates',fill='#e4d9bb',font=title)
d.text((22,47),'64x64 RGBA cells | right facing 3/4 | no pack installation | user selection pending',fill='#bec6c6',font=font)
columns=[(180,'NEW 1x'),(280,'NEW 3x'),(515,'OLD 1x'),(610,'OLD 3x'),(865,'Actor1 1x / 3x')]
for x,label in columns: d.text((x,83),label,fill='#d7d8cb',font=font)
def checker(x,y,w,h):
    for cy in range(y,y+h,8):
        for cx in range(x,x+w,8):
            c='#555951' if ((cx-x)//8+(cy-y)//8)%2 else '#62645a'
            d.rectangle((cx,cy,min(cx+7,x+w-1),min(cy+7,y+h-1)),fill=c)
def cell(im,x,y,scale=1):
    enlarged=im if scale==1 else im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
    checker(x,y,enlarged.width,enlarged.height)
    sheet.alpha_composite(enlarged,(x,y))
for i,name in enumerate(NAMES):
    y=115+i*235
    d.text((22,y+16),name,fill='#e4d9bb',font=font)
    box=meta[name]['silhouette_size']
    d.text((22,y+45),f'{box[0]}x{box[1]} silhouette',fill='#bbc3c2',font=font)
    d.text((22,y+67),f'{meta[name]["opaque_colors"]} opaque colors',fill='#bbc3c2',font=font)
    cell(images[name],180,y+64)
    cell(images[name],280,y,3)
    cell(old[name],515,y+64)
    cell(old[name],610,y,3)
    cell(actor,865,y+96)
    cell(actor,915,y+64,3)
    d.text((280,y+200),'native drawing; integer enlargement only',fill='#aeb8b7',font=font)
    d.line((22,y+225,1078,y+225),fill='#454b50')
d.text((22,831),'Actor1: slot 0 / idle right-facing / source crop (24,64)-(48,96), no pixels traced into candidates.',fill='#b7bfbd',font=font)
sheet_path=ROOT/'review-sheet.png'; sheet.convert('RGB').save(sheet_path)
result=dict(status='candidate-awaiting-user-visual-steering',output_directory=str(ROOT),sprites=meta,
    review_sheet={'path':str(sheet_path),'sha256':digest(sheet_path)},
    actor_scale_reference={'path':str(ROOT/'reference'/'Actor1-original-24x32.png'),'source':str(actor_path),'crop':[24,64,48,96]},
    sources={n:{'pxgrid':str(ROOT/'source'/f'{n}.pxgrid'),'pxgrid_sha256':digest(ROOT/'source'/f'{n}.pxgrid'),
        'palette':str(ROOT/'source'/f'{n}.palette.json'),'palette_sha256':digest(ROOT/'source'/f'{n}.palette.json')} for n in NAMES},
    baking_python=str(ROOT/'bake.py'),baking_sha256=digest(ROOT/'bake.py'),
    visual_review='Viewed shipped screenshots and old portraits; viewed initial and revised comparison sheets. One visual revision completed. See REVIEW.md for specific limitations.',
    visual_review_document=str(ROOT/'REVIEW.md'),
    director_handoff=str(ROOT/'director-handoff.md'),
    limitations=['Boar: tucked far hind leg merges with belly at 1x; fur bands still look sculpted; small tusk needs ground-context review.',
        'Dokkaebi: shallow face turn; coat has diagonal repeats; similar skin/straw values weaken the shoulder boundary at 1x.',
        'Ghost: tiny fingers merge at 1x; skirt folds remain regular; right shadow is a strong stripe; expression remains restrained.',
        'Static idle candidates only; pose and animation continuity are untested.',
        'Candidate sprites have not been installed or evaluated in the shipped battle renderer.',
        'Palette coherence with corrected foliage awaits the director context comparison.'])
result['artifacts']=[{'path':str(p),'sha256':digest(p)} for p in sorted(ROOT.rglob('*')) if p.is_file() and p.name != 'result.json' and '__pycache__' not in p.parts]
(ROOT/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({n:meta[n] for n in NAMES},indent=2))
