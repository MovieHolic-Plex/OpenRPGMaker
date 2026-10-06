"""Read literal grids; bake native PNG/GIF and diagnostic nearest-neighbor sheets."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {c: tuple(bytes.fromhex(rgb[1:])) + (255,) for c, rgb in PALETTE.items()}
ORDER = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
SCENES = {
 'idle': (['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 'attack': (['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
 'hit': (['idle_a','hit','idle_a'],[700,180,900]),
 'dead': (['idle_a','hit','dead'],[700,150,1700]),
 'skill': (['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
 'poison': (['poison_a','poison_b'],[420,420]),
 'stun': (['stun_a','stun_b'],[300,300]),
 'sleep': (['sleep_a','sleep_b'],[650,650])}

def checker():
    bg = Image.new('RGBA',(96,96))
    px=bg.load()
    for y in range(96):
        for x in range(96):
            gray = 93 if (x//8+y//8)%2 else 113
            px[x,y]=(gray,gray,gray,255)
    return bg

frames={}
for name in ORDER:
    path=ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
    if not path.exists():
        continue
    lines=path.read_text().splitlines()
    if len(lines)!=96 or any(len(line)!=96 for line in lines):
        raise ValueError(f'Native grid dimensions: {name}')
    img=Image.new('RGBA',(96,96))
    for y,line in enumerate(lines):
        for x,c in enumerate(line):
            if c!='.':
                img.putpixel((x,y),COLORS[c])
    frames[name]=img
    img.save(ROOT/'png'/(name+'.png'))

# Three background columns, one row per frame; labels never enter authored grids.
zoom=Image.new('RGB',(96*4*3, (96*4+22)*len(frames)), '#26262C')
zd=ImageDraw.Draw(zoom)
for j,(name,img) in enumerate(frames.items()):
    for col,bg in enumerate([Image.new('RGBA',(96,96),'#E9E1CD'),Image.new('RGBA',(96,96),'#171820'),checker()]):
        bg.alpha_composite(img)
        zoom.paste(bg.resize((384,384),Image.Resampling.NEAREST),(col*384,j*406+22))
        zd.text((col*384+4,j*406+4),name,fill='#FFFFFF')
zoom.save(ROOT/'png'/'inspection-4x.png')
for page in range((len(frames)+2)//3):
    top=page*3*406
    bottom=min(top+3*406,zoom.height)
    zoom.crop((0,top,zoom.width,bottom)).save(ROOT/'png'/f'inspection-page-{page+1}.png')
for name,img in frames.items():
    diagnostic=Image.new('RGB',(1152,406),'#26262C')
    dd=ImageDraw.Draw(diagnostic)
    for col,bg in enumerate([Image.new('RGBA',(96,96),'#E9E1CD'),Image.new('RGBA',(96,96),'#171820'),checker()]):
        bg.alpha_composite(img)
        diagnostic.paste(bg.resize((384,384),Image.Resampling.NEAREST),(col*384,22))
        dd.text((col*384+4,4),name,fill='#FFFFFF')
    diagnostic.save(ROOT/'png'/(name+'-backgrounds-4x.png'))

native=Image.new('RGBA',(96*3,114*((len(frames)+2)//3)), '#292B33')
nd=ImageDraw.Draw(native)
for j,(name,img) in enumerate(frames.items()):
    x,y=(j%3)*96,(j//3)*114
    nd.text((x+3,y+2),name,fill='#EEE7D0')
    native.alpha_composite(img,(x,y+18))
native.convert('RGB').save(ROOT/'png'/'contact-native.png')
native.resize((native.width*3,native.height*3),Image.Resampling.NEAREST).convert('RGB').save(ROOT/'png'/'contact-3x.png')
for suffix,color in [('light','#E9E1CD'),('dark','#171820'),('checker',None)]:
    sheet=Image.new('RGBA',native.size,color or '#686868')
    sd=ImageDraw.Draw(sheet)
    for j,(name,img) in enumerate(frames.items()):
        x,y=(j%3)*96,(j//3)*114
        sd.text((x+3,y+2),name,fill='#302C30' if suffix=='light' else '#EEE7D0')
        if color is None:
            tile=checker()
            tile.alpha_composite(img)
            sheet.paste(tile,(x,y+18))
        else:
            sheet.alpha_composite(img,(x,y+18))
    sheet.convert('RGB').save(ROOT/'png'/('contact-native-'+suffix+'.png'))
for filename,names in [('poses-3x3',ORDER[:9]),('suite-3x6',ORDER)]:
    if not all(name in frames for name in names):
        continue
    sheet=Image.new('RGBA',(288,96*((len(names)+2)//3)))
    for j,name in enumerate(names):
        sheet.alpha_composite(frames[name],((j%3)*96,(j//3)*96))
    sheet.save(ROOT/'png'/(filename+'.png'))

# Exact authored GIF palette, no quantization or synthesized motion frames.
rgb=[(0,0,0)]+[tuple(bytes.fromhex(c[1:])) for c in PALETTE.values()]
index={color:i for i,color in enumerate(rgb) if i}
gif_palette=[c for color in rgb for c in color]+[0]*(768-len(rgb)*3)
for scene,(sequence,times) in SCENES.items():
    if not all(name in frames for name in sequence):
        continue
    gif_frames=[]
    for name in sequence:
        src=frames[name]
        out=Image.new('P',(96,96),0)
        out.putpalette(gif_palette)
        out.putdata([index[pixel[:3]] if pixel[3] else 0 for pixel in src.get_flattened_data()])
        gif_frames.append(out)
    gif_frames[0].save(ROOT/'gifs'/(scene+'.gif'),save_all=True,append_images=gif_frames[1:],
                       duration=times,loop=0,transparency=0,disposal=2,optimize=False)
(ROOT/'gifs'/'timing.json').write_text(json.dumps(SCENES,indent=2)+'\n')
print('Rendered',len(frames),'native frames and available GIF sequences.')
