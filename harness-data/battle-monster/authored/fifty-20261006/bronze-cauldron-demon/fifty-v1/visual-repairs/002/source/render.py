"""Read literal pxgrid; render native PNG and nearest diagnostic views only."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
OUT.mkdir(exist_ok=True)
PAL = json.loads((ROOT/'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:]))+(255,) for k,v in PAL.items()}

def read(path):
    lines = path.read_text().splitlines()
    assert len(lines)==128 and all(len(r)==128 for r in lines), str(path)
    assert set(''.join(lines)) <= set(PAL)|{'.'}, str(path)
    im = Image.new('RGBA',(128,128))
    im.putdata([COLORS[c] if c!='.' else (0,0,0,0) for r in lines for c in r])
    return im

def backdrop(im, theme):
    bg = Image.new('RGBA', im.size, (235,228,211,255) if theme=='light' else (27,33,44,255))
    if theme=='checker':
        d=ImageDraw.Draw(bg)
        for y in range(0,128,8):
            for x in range(0,128,8):
                d.rectangle((x,y,x+7,y+7), fill=(102,109,119,255) if (x//8+y//8)%2 else (164,168,173,255))
    bg.alpha_composite(im)
    return bg.convert('RGB')

TIMELINES = {
    'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
    'attack': [('idle_a',240),('windup',270),('move',110),('attack',130),('recover',220),('idle_a',240)],
    'hit': [('idle_a',240),('hit',190),('recover',230),('idle_a',300)],
    'dead': [('idle_a',240),('hit',130),('dead',1200)],
    'skill': [('idle_a',240),('skill_a',360),('skill_b',270),('skill_c',350),('idle_a',240)],
    'poison': [('poison_a',430),('poison_b',430)],
    'stun': [('stun_a',400),('stun_b',400)],
    'sleep': [('sleep_a',700),('sleep_b',780)],
}

if __name__=='__main__':
    frames={}
    for folder in ('poses','actions'):
        for p in sorted((ROOT/folder).glob('*.pxgrid')) if (ROOT/folder).exists() else []:
            im=read(p); frames[p.stem]=im
            im.save(OUT/(p.stem+'.png'))
    names=list(frames)
    for folder in ('poses','actions'):
        ordered=([n for n in ('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead')] if folder=='poses'
            else ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b'])
        if all(n in frames for n in ordered):
            native_sheet=Image.new('RGBA',(384,384))
            for j,n in enumerate(ordered):
                native_sheet.paste(frames[n],((j%3)*128,(j//3)*128))
            native_sheet.save(OUT/(folder+'-sheet.png'))
    sheet=Image.new('RGB',(6*256, ((len(names)+5)//6)*284),(33,38,48))
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(names):
        im=backdrop(frames[n], 'checker').resize((256,256),Image.Resampling.NEAREST)
        x=(i%6)*256; y=(i//6)*284
        sheet.paste(im,(x,y));d.text((x+8,y+260),n,fill=(244,235,211))
    sheet.save(OUT/'contact-2x.png')
    for n,im in frames.items():
        board=Image.new('RGB',(128*3,128+512),(46,48,55))
        for i,theme in enumerate(('light','dark','checker')):
            b=backdrop(im,theme);board.paste(b,(i*128,0))
        board.paste(backdrop(im,'checker').resize((384,384),Image.Resampling.NEAREST),(0,144))
        board.save(OUT/(n+'-inspect.png'))
    for page,start in enumerate(range(0,len(names),9),1):
        board=Image.new('RGB',(1152,450),(46,48,55))
        d=ImageDraw.Draw(board)
        for j,n in enumerate(names[start:start+9]):
            x=(j%3)*384;y=(j//3)*150
            for k,theme in enumerate(('light','dark','checker')):
                board.paste(backdrop(frames[n],theme),(x+k*128,y))
            d.text((x+5,y+132),n,fill=(244,235,211))
        board.save(OUT/('native-backgrounds-'+str(page)+'.png'))
    for name, seq in TIMELINES.items():
        if all(n in frames for n,t in seq):
            ims=[backdrop(frames[n],'dark') for n,t in seq]
            ims[0].save(OUT/(name+'.gif'),save_all=True,append_images=ims[1:],duration=[t for n,t in seq],loop=0,disposal=2,optimize=False)
    decoded=Image.new('RGB',(6*128+96,8*150),(27,33,44))
    d=ImageDraw.Draw(decoded)
    metadata={}
    for row,(name,seq) in enumerate(TIMELINES.items()):
        path=OUT/(name+'.gif')
        if not path.exists(): continue
        with Image.open(path) as gif:
            holds=[]
            for j,f in enumerate(ImageSequence.Iterator(gif)):
                holds.append(f.info.get('duration'))
                decoded.paste(f.convert('RGB'),(96+j*128,row*150))
                d.text((98+j*128,row*150+130),str(holds[-1])+' ms',fill=(220,215,205))
            d.text((4,row*150+50),name,fill=(244,235,211))
        metadata[name]={'file':name+'.gif','decodedDurationsMs':holds,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    decoded.save(OUT/'gif-decoded.png')
    manifest={'paletteColors':len(PAL),'frames':{},'animations':metadata}
    for n,im in frames.items():
        folder='poses' if (ROOT/'poses'/(n+'.pxgrid')).exists() else 'actions'
        src=ROOT/folder/(n+'.pxgrid')
        box=im.getbbox()
        manifest['frames'][n]={'size':list(im.size),'inkBoundsExclusive':box,
            'lowestInkY':box[3]-1,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
            'pngSha256':hashlib.sha256((OUT/(n+'.png')).read_bytes()).hexdigest()}
    (OUT/'readback.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Rendered',len(frames),'literal native frames; PNG/GIF files in source/preview.')
