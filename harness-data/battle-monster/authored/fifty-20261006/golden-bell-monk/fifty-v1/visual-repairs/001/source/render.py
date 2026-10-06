"""Read literal grids; export native RGBA PNGs, GIFs and diagnostic sheets."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT/'palette.json').read_text())
RGBA = {c: tuple(bytes.fromhex(v[1:]))+(255,) for c,v in PAL.items()}
RGBA['.'] = (0,0,0,0)
ORDER = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']

def render():
    out = ROOT/'preview'
    out.mkdir(exist_ok=True)
    frames = {}
    facts = []
    for name in ORDER:
        path = ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
        if not path.exists(): continue
        rows = path.read_text().splitlines()
        if len(rows)!=64 or any(len(row)!=64 for row in rows):
            raise ValueError('Canvas dimensions: '+name)
        im = Image.new('RGBA',(64,64))
        im.putdata([RGBA[c] for row in rows for c in row])
        im.save(out/(name+'.png'))
        frames[name] = im
        bounds = im.getbbox()
        if not (bounds[0]>=1 and bounds[1]>=1 and bounds[2]<=63 and bounds[3]<=61):
            raise ValueError(('Margin', name, bounds))
        if name=='idle_a' and bounds[3]!=61: raise ValueError('Idle baseline')
        facts.append({'frame':name,'ink_bbox_exclusive':bounds})
    # Backgrounds and scaling are diagnostic only; never input to source art.
    for bgname,bg in [('light',(236,227,208)),('dark',(36,40,48)),('checker',None)]:
        sheet = Image.new('RGB',(6*276,3*360),(55,57,61))
        draw = ImageDraw.Draw(sheet)
        for i,name in enumerate(ORDER):
            if name not in frames: continue
            tile = Image.new('RGBA',(64,64),bg+(255,) if bg else (0,0,0,255))
            if bg is None:
                for y in range(64):
                    for x in range(64):
                        v=170 if (x//8+y//8)%2 else 220
                        tile.putpixel((x,y),(v,v,v,255))
            tile.alpha_composite(frames[name])
            x=(i%6)*276+10; y=(i//6)*360+24
            sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x,y))
            draw.text((x,y-17),name,fill=(245,240,222))
            sheet.paste(tile,(x+96,y+268))
        sheet.save(out/('sheet-'+bgname+'.png'))
    native = Image.new('RGBA',(6*64,3*64))
    for i,name in enumerate(ORDER):
        if name in frames: native.alpha_composite(frames[name],((i%6)*64,(i//6)*64))
    native.save(out/'all-native.png')
    for sheetname,names in [('poses',ORDER[:9]),('actions',ORDER[9:])]:
        packed=Image.new('RGBA',(192,192))
        for i,name in enumerate(names):
            if name in frames: packed.alpha_composite(frames[name],((i%3)*64,(i//3)*64))
        packed.save(out/(sheetname+'.png'))
    timelines = {
      'idle':[('idle_a',240),('idle_b',240),('idle_c',240)],
      'attack':[('idle_a',260),('windup',240),('move',100),('attack',150),('recover',240),('idle_a',300)],
      'hit':[('idle_a',300),('hit',260),('recover',240)],
      'dead':[('hit',240),('dead',1400)],
      'skill':[('skill_a',360),('skill_b',320),('skill_c',360),('idle_a',400)],
      'poison':[('poison_a',420),('poison_b',420)],
      'stun':[('stun_a',460),('stun_b',460)],
      'sleep':[('sleep_a',700),('sleep_b',850)]}
    gif_palette=[0,0,0]+[c for value in PAL.values() for c in bytes.fromhex(value[1:])]
    gif_palette += [0]*(768-len(gif_palette))
    indices={c:i+1 for i,c in enumerate(PAL)}; indices['.']=0
    readback=[]
    film=Image.new('RGB',(6*276,8*232),(41,44,49))
    film_draw=ImageDraw.Draw(film)
    for motion_index,(motion,seq) in enumerate(timelines.items()):
        if not all(n in frames for n,_ in seq): continue
        encoded=[]
        for name,_ in seq:
            folder='poses' if name in ORDER[:9] else 'actions'
            rows=(ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
            im=Image.new('P',(64,64)); im.putpalette(gif_palette)
            im.putdata([indices[c] for row in rows for c in row])
            im.info['transparency']=0
            encoded.append(im)
        encoded[0].save(out/(motion+'.gif'),save_all=True,append_images=encoded[1:],duration=[ms for _,ms in seq],loop=0,transparency=0,disposal=2,optimize=False)
        # Inspect decoded exports, including GIF disposal and exact palette.
        with Image.open(out/(motion+'.gif')) as gif:
            if gif.n_frames != len(seq): raise ValueError(('GIF frame count',motion))
            for j,(name,hold) in enumerate(seq):
                gif.seek(j)
                decoded=gif.convert('RGBA')
                for actual,original in zip(list(decoded.get_flattened_data()),list(frames[name].get_flattened_data())):
                    if actual[3]!=original[3] or (original[3] and actual!=original):
                        raise ValueError(('GIF export pixels',motion,j))
                actual_hold=gif.info['duration']
                if actual_hold!=hold: raise ValueError(('GIF duration',motion,j))
                readback.append({'motion':motion,'frame':j,'pose':name,'hold_ms':actual_hold,'pixels':'exact opaque RGBA and alpha'})
                tile=Image.new('RGBA',(64,64),(232,226,211,255))
                tile.alpha_composite(decoded)
                px=j*276+6; py=motion_index*232+24
                film.paste(tile.resize((192,192),Image.Resampling.NEAREST),(px,py))
                film_draw.text((px,py-16),f'{motion}: {name} {hold}ms',fill=(249,238,210))
                film.paste(tile,(px+204,py+128))
    film.save(out/'gif-readback.png')
    (out/'gif-readback.json').write_text(json.dumps(readback,indent=2)+'\n')
    (out/'canvas-facts.json').write_text(json.dumps(facts,indent=2)+'\n')
    print('Rendered',len(frames),'literal frames; preview only, no reviewer verdict.')

if __name__=='__main__': render()
