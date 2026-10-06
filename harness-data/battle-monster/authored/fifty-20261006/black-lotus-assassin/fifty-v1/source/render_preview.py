"""Decode literal grids; preview enlargement only. Does not author pixels."""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT/'palette.json').read_text())
ORDER = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
OUT = ROOT/'previews'
OUT.mkdir(exist_ok=True)
MOTIONS = {
    'idle': (['idle_a','idle_b','idle_c','idle_b'], [240,240,240,240]),
    'attack': (['idle_a','windup','move','attack','recover','idle_a'], [240,180,90,140,180,300]),
    'hit': (['idle_a','hit','recover','idle_a'], [240,260,180,320]),
    'dead': (['idle_a','hit','dead'], [240,180,1200]),
    'skill': (['idle_a','skill_a','skill_b','skill_c','idle_a'], [240,360,240,280,320]),
    'poison': (['poison_a','poison_b'], [420,420]),
    'stun': (['stun_a','stun_b'], [440,440]),
    'sleep': (['sleep_a','sleep_b'], [700,700]),
}

def load(name):
    folder = 'poses' if name in ORDER[:9] else 'actions'
    rows = (ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
    if len(rows) != 64 or any(len(r) != 64 for r in rows):
        raise ValueError((name, 'canvas dimensions'))
    im = Image.new('RGBA', (64,64))
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c != '.':
                col = PAL[c]
                im.putpixel((x,y), tuple(int(col[i:i+2],16) for i in (1,3,5))+(255,))
    return im

def bg(style, size):
    im = Image.new('RGBA',size, '#e1d9cd' if style == 'light' else '#171d2c')
    if style == 'checker':
        d = ImageDraw.Draw(im)
        for y in range(0,size[1],8):
            for x in range(0,size[0],8):
                d.rectangle((x,y,x+7,y+7),fill='#c6c4bd' if (x//8+y//8)%2 else '#ece9e0')
    return im

def render():
    names = [n for n in ORDER if (ROOT/('poses' if n in ORDER[:9] else 'actions')/(n+'.pxgrid')).exists()]
    imgs = {n:load(n) for n in names}
    for name,im in imgs.items():
        im.save(OUT/(name+'.png'))
    for style in ['light','dark','checker']:
        sheet = bg(style,(6*224,3*304))
        d = ImageDraw.Draw(sheet)
        for i,name in enumerate(names):
            x,y = (i%6)*224, (i//6)*304
            d.text((x+8,y+7),name,fill='#11131d' if style!='dark' else '#dfedf0')
            sheet.alpha_composite(imgs[name],(x+80,y+26))
            sheet.alpha_composite(imgs[name].resize((192,192),Image.Resampling.NEAREST),(x+16,y+101))
        sheet.convert('RGB').save(OUT/('contact-'+style+'.png'))
    idle = imgs['idle_a']
    close = bg('checker',(512,512))
    close.alpha_composite(idle.resize((512,512),Image.Resampling.NEAREST))
    close.convert('RGB').save(OUT/'idle-detail.png')
    if len(names) != 18:
        return
    base = Image.new('RGBA',(192,192))
    suite = Image.new('RGBA',(192,384))
    for i,name in enumerate(ORDER):
        suite.alpha_composite(imgs[name],((i%3)*64,(i//3)*64))
        if i < 9:
            base.alpha_composite(imgs[name],((i%3)*64,(i//3)*64))
    base.save(OUT/'sheet-poses.png')
    suite.save(OUT/'sheet-suite.png')

    # Palette is assigned directly from source; there is no image quantization.
    symbols = ['.'] + list(PAL)
    gif_palette = [0,0,0]
    for symbol in symbols[1:]:
        c = PAL[symbol]
        gif_palette.extend(int(c[i:i+2],16) for i in (1,3,5))
    gif_palette.extend([0] * (768-len(gif_palette)))
    indexed = {}
    for name in ORDER:
        folder = 'poses' if name in ORDER[:9] else 'actions'
        rows = (ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
        im = Image.new('P',(64,64),0)
        im.putpalette(gif_palette)
        im.putdata([symbols.index(c) for row in rows for c in row])
        indexed[name] = im

    gif_records = {}
    for motion,(seq,holds) in MOTIONS.items():
        frames = [indexed[n] for n in seq]
        path = OUT/(motion+'.gif')
        frames[0].save(path,save_all=True,append_images=frames[1:],duration=holds,
                       loop=0,transparency=0,disposal=2,optimize=False)
        decoded = Image.open(path)
        record = []
        strip = bg('light',(len(seq)*208,292))
        draw = ImageDraw.Draw(strip)
        for i,frame in enumerate(ImageSequence.Iterator(decoded)):
            actual = frame.convert('RGBA')
            # This compares the encoded artifact to the literal source.
            if actual.tobytes() != imgs[seq[i]].tobytes():
                raise ValueError((motion,i,'encoded pixels differ'))
            if frame.info['duration'] != holds[i]:
                raise ValueError((motion,i,'encoded hold differs'))
            record.append({'pose':seq[i], 'ms':frame.info['duration']})
            draw.text((i*208+8,6),f'{seq[i]} / {holds[i]} ms',fill='#11131d')
            strip.alpha_composite(actual,(i*208+72,24))
            strip.alpha_composite(actual.resize((192,192),Image.Resampling.NEAREST),(i*208+8,96))
        strip.convert('RGB').save(OUT/('decoded-'+motion+'.png'))
        gif_records[motion] = record

    report = {'scope':'source-only artifact diagnostics; not independent review or approval',
              'paletteColors':len(PAL), 'cell':64, 'frames':{}, 'gifs':gif_records}
    for name in ORDER:
        folder = 'poses' if name in ORDER[:9] else 'actions'
        path = ROOT/folder/(name+'.pxgrid')
        rows = path.read_text().splitlines()
        points = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
        xs,ys = zip(*points)
        bounds = [min(xs),min(ys),max(xs),max(ys)]
        if min(xs)<1 or min(ys)<1 or max(xs)>62 or max(ys)>60:
            raise ValueError((name,bounds,'margin'))
        if name=='idle_a' and max(ys)!=60:
            raise ValueError((name,'feet baseline'))
        report['frames'][name] = {'bounds':bounds,'ink':len(points),
                                 'gridSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                 'pngSha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
    if len({v['gridSha256'] for v in report['frames'].values()}) != 18:
        raise ValueError('Repeated full pose')
    report['paletteSha256'] = hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest()
    (OUT/'pixel-report.json').write_text(json.dumps(report,indent=2)+'\n')

    cards = '\n'.join(f'<figure><figcaption>{label}</figcaption><img src="{key}.gif" width="64" height="64"><img class="large" src="{key}.gif" width="256" height="256"></figure>'
                      for key,label in [('idle','대기'),('attack','공격'),('hit','피격'),('dead','쓰러짐'),
                                        ('skill','흑련절'),('poison','독'),('stun','기절'),('sleep','수면')])
    static = '\n'.join(f'<figure><figcaption>{n}</figcaption><img src="{n}.png" width="64" height="64"><img class="large" src="{n}.png" width="192" height="192"></figure>' for n in ORDER)
    html = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>흑련자객 · 원본 그림</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#f0ebe3;color:#11131d;font:16px system-ui}
header{max-width:1200px;margin:auto}h1{font-size:24px}button{font:inherit;padding:8px 14px;margin:0 8px 12px 0;border:1px solid #9b9389;border-radius:6px;cursor:pointer}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;max-width:1250px;margin:20px auto}
figure{margin:0;padding:12px;background:#e1d9cd;border-radius:8px}figcaption{padding:0 0 10px}img{image-rendering:pixelated;display:block;margin:8px auto}.large{max-width:100%;height:auto}
body.dark{background:#101621;color:#dfedf0}body.dark figure{background:#171d2c}
body.checker figure{background:conic-gradient(#c6c4bd 25%,#ece9e0 0 50%,#c6c4bd 0 75%,#ece9e0 0);background-size:16px 16px}
</style><header><h1>흑련자객</h1><p>8동작 · 실제 64px와 최근접 확대</p>
<button onclick="document.body.className=''">밝은 배경</button><button onclick="document.body.className='dark'">어두운 배경</button><button onclick="document.body.className='checker'">체커 배경</button>
</header><main><section class="gallery">'''+cards+'''</section><header><h2>18자세</h2></header><section class="gallery">'''+static+'''</section></main></html>'''
    (OUT/'index.html').write_text(html)

if __name__ == '__main__':
    render()
