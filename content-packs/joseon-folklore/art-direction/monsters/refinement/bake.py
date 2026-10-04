"""Deterministic PNG output: native ASCII symbols -> direct RGBA assignment."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
ROOT=Path(__file__).resolve().parent
PREV=ROOT.parent
NAMES=['wild-boar','straw-dokkaebi','maiden-ghost']
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n,p):
    rows=(ROOT/'source'/n/f'{p}.pxgrid').read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows)
    palette=json.loads((ROOT/'source'/n/'palette.json').read_text())
    colors={s:tuple(bytes.fromhex(c[1:]))+(255,) for s,c in palette.items()};colors['.']=(0,0,0,0)
    im=Image.new('RGBA',(64,64));pix=im.load()
    for y,row in enumerate(rows):
        for x,s in enumerate(row):pix[x,y]=colors[s]
    return im
try:FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
except OSError:FONT=ImageFont.load_default()
def text(d,xy,s):d.text(xy,s,font=FONT,fill='#eee4cc')
def tile(canvas,im,x,y,scale=1):
    # Scaling is exclusively for review views, never for source sprites.
    scaled=im if scale==1 else im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(canvas)
    for yy in range(0,scaled.height,8):
        for xx in range(0,scaled.width,8):
            color='#5b6055' if (xx//8+yy//8)%2 else '#65695e'
            d.rectangle((x+xx,y+yy,x+min(xx+7,scaled.width-1),y+min(yy+7,scaled.height-1)),fill=color)
    canvas.alpha_composite(scaled,(x,y))
actor=Image.open(PREV/'reference'/'Actor1-original-24x32.png').convert('RGBA')
actor.save(ROOT/'reference'/'Actor1-original-24x32.png')
idle_sheet=Image.new('RGBA',(970,830),(31,35,41,255));d=ImageDraw.Draw(idle_sheet)
text(d,(20,18),'JOSEON / selected candidate -> refined idle | 1x and integer 3x')
for x,s in [(165,'Before 1x'),(260,'Before 3x'),(475,'New 1x'),(570,'New 3x'),(795,'Actor1')]:text(d,(x,54),s)
metadata={}
complete=True
for i,n in enumerate(NAMES):
    idle=read(n,'idle_a');idle.save(ROOT/'portraits'/f'{n}.png')
    old=Image.open(PREV/'candidates'/f'{n}.png').convert('RGBA')
    y=90+i*238;text(d,(20,y+70),n)
    tile(idle_sheet,old,165,y+66);tile(idle_sheet,old,260,y,3)
    tile(idle_sheet,idle,475,y+66);tile(idle_sheet,idle,570,y,3)
    tile(idle_sheet,actor,795,y+110);tile(idle_sheet,actor,850,y+60,3)
    frames={};sheet=Image.new('RGBA',(192,192))
    for j,p in enumerate(POSES):
        file=ROOT/'source'/n/f'{p}.pxgrid'
        if not file.exists():complete=False;continue
        frame=read(n,p);sheet.alpha_composite(frame,((j%3)*64,(j//3)*64))
        colors=frame.getcolors(4096)
        frames[p]={'bbox':list(frame.getbbox()),'alpha_values':sorted(c for count,c in frame.getchannel('A').getcolors(4096)),
            'opaque_colors':len([c for count,c in colors if c[3]]),'native_cell':[64,64],
            'bottom_y':frame.getbbox()[3]-1,'occupied_center_x':(frame.getbbox()[0]+frame.getbbox()[2]-1)/2,'pixel_sha256':hashlib.sha256(frame.tobytes()).hexdigest(),
            'source':str(file),'source_sha256':sha(file)}
    metadata[n]={'portrait':str(ROOT/'portraits'/f'{n}.png'),'portrait_sha256':sha(ROOT/'portraits'/f'{n}.png'),'frames':frames}
    if len(frames)==9:
        out=ROOT/'sprites'/f'{n}.png';sheet.save(out)
        metadata[n].update(sheet=str(out),sheet_sha256=sha(out),sheet_size=[192,192],mode='RGBA',unique_frames=len({f['pixel_sha256'] for f in frames.values()}),
            sheet_alpha_values=sorted(c for count,c in sheet.getchannel('A').getcolors(65536)),
            sheet_opaque_colors=len([c for count,c in sheet.getcolors(65536) if c[3]]),
            idle_foot_baselines=[frames[p]['bottom_y'] for p in POSES[:3]],
            all_frames_unique=len({f['pixel_sha256'] for f in frames.values()})==9,
            palette=str(ROOT/'source'/n/'palette.json'),palette_sha256=sha(ROOT/'source'/n/'palette.json'))
        contact=Image.new('RGBA',(920,870),(31,35,41,255));dc=ImageDraw.Draw(contact)
        text(dc,(20,16),n+' / nine native64 battle poses, facing right')
        for j,p in enumerate(POSES):
            yy=65+(j//3)*246;xx=20+(j%3)*300
            text(dc,(xx,yy-21),p);tile(contact,read(n,p),xx,yy+66);tile(contact,read(n,p),xx+84,yy,3)
        tile(contact,actor,780,794);tile(contact,actor,835,756,3);text(dc,(20,830),'Sprites: 1x / 3x. Actor1: 1x / 3x, original 24x32 reference.')
        contact.convert('RGB').save(ROOT/'review'/f'{n}-poses.png')
idle_sheet.convert('RGB').save(ROOT/'review'/'idle-comparison.png')
result={'status':'refined-candidate-awaiting-user-steering','phase':'nine-poses-baked' if complete else 'idle-ready',
    'output_directory':str(ROOT),'frame_order':POSES,'native_cell':[64,64],'sprites':metadata,
    'review_directory':str(ROOT/'review'),'review_document':str(ROOT/'REVIEW.md'),
    'director_handoff':str(ROOT/'director-handoff.md'),'authoring_python':str(ROOT/'source'/'author.py'),
    'visual_review':'Actual idle comparison, first and corrected pose contact sheets, and transparent sheets viewed; one contact-sheet correction pass completed. Specific limitations in REVIEW.md.',
    'baking_python':str(ROOT/'bake.py'),'baking_sha256':sha(ROOT/'bake.py')}
result['artifacts']=[{'path':str(p),'sha256':sha(p)} for p in sorted(ROOT.rglob('*')) if p.is_file() and p.name not in ['result.json','progress.json'] and '__pycache__' not in p.parts]
(ROOT/'result.json').write_text(json.dumps(result,indent=2)+'\n')
(ROOT/'progress.json').write_text(json.dumps({'phase':'complete-user-steering' if complete else result['phase'],'status':result['status'],'portraits':{n:v['portrait'] for n,v in metadata.items()},
    'idle_comparison':str(ROOT/'review'/'idle-comparison.png'),'sprites':{n:v.get('sheet') for n,v in metadata.items()},
    'result':str(ROOT/'result.json'),'pose_reviews':{n:str(ROOT/'review'/f'{n}-poses.png') for n in NAMES},
    'review_document':str(ROOT/'REVIEW.md'),'complete':complete},indent=2)+'\n')
print(result['phase'])
