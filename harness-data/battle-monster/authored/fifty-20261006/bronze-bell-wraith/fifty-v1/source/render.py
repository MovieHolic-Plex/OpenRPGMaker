"""Read literal grids only. PNG/GIF export and labelled nearest-neighbour study."""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k,v in PAL.items()}
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS = ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
MOTIONS = {
    'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
    'attack': [('idle_a',240),('windup',300),('move',100),('attack',180),('recover',260),('idle_a',300)],
    'hit': [('idle_a',260),('hit',220),('recover',220),('idle_a',340)],
    'dead': [('hit',200),('dead',1100)],
    'skill': [('skill_a',400),('skill_b',240),('skill_c',360),('idle_a',280)],
    'poison': [('poison_a',500),('poison_b',500)],
    'stun': [('stun_a',450),('stun_b',450)],
    'sleep': [('sleep_a',650),('sleep_b',650)],
}

def read(name):
    p = ROOT / ('poses' if name in POSES else 'actions') / (name+'.pxgrid')
    rows=p.read_text().splitlines()
    if len(rows)!=96 or any(len(r)!=96 for r in rows):
        raise ValueError(f'Canvas size: {name}')
    unknown=set(''.join(rows))-set(PAL)-{'.'}
    if unknown: raise ValueError((name,unknown))
    ink=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
    bbox=(min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink))
    if bbox[0]<1 or bbox[1]<1 or bbox[2]>94 or bbox[3]>92: raise ValueError((name,bbox))
    im=Image.new('RGBA',(96,96))
    im.putdata([COLORS.get(c,(0,0,0,0)) for r in rows for c in r])
    return im,rows,bbox

def background(kind):
    im=Image.new('RGBA',(96,96), '#eee2c9' if kind=='light' else '#202c38')
    if kind=='checker':
        d=ImageDraw.Draw(im)
        for y in range(0,96,8):
            for x in range(0,96,8):
                d.rectangle((x,y,x+7,y+7),fill='#56606b' if (x//8+y//8)%2 else '#88919a')
    return im

def main():
    out=ROOT/'previews';out.mkdir(exist_ok=True)
    ims={}; report={}
    for name in POSES+ACTIONS:
        path=ROOT/('poses' if name in POSES else 'actions')/(name+'.pxgrid')
        if not path.exists(): continue
        im,rows,bbox=read(name);ims[name]=im
        report[name]={'bbox':bbox,'inkPixels':sum(c!='.' for r in rows for c in r),
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        im.save(out/(name+'.png'))
        detail=background('light');detail.alpha_composite(im)
        detail.resize((576,576),Image.Resampling.NEAREST).save(out/(name+'-detail.png'))
    names=list(ims)
    for kind in ['light','dark','checker']:
        sheet=Image.new('RGB',(6*298,((len(names)+5)//6)*318),'#38434f')
        d=ImageDraw.Draw(sheet)
        for i,name in enumerate(names):
            bg=background(kind);bg.alpha_composite(ims[name])
            x=(i%6)*298;y=(i//6)*318
            sheet.paste(bg.convert('RGB').resize((288,288),Image.Resampling.NEAREST),(x,y+22))
            d.text((x+4,y+4),name,fill='white')
        sheet.save(out/('study-'+kind+'.png'))
    for label,nameset in [('poses',POSES),('actions',ACTIONS)]:
        sheet=Image.new('RGBA',(288,288))
        for i,name in enumerate(nameset):
            if name in ims: sheet.alpha_composite(ims[name],((i%3)*96,(i//3)*96))
        sheet.save(out/(label+'-native.png'))
    # Fixed palette, no quantization; index zero is transparent.
    symbols=['.']+list(PAL); indices={s:i for i,s in enumerate(symbols)}
    gifpal=[0,0,0]+[v for k in PAL for v in COLORS[k][:3]]
    gifpal+= [0]*(768-len(gifpal))
    for motion,sequence in MOTIONS.items():
        if not all(name in ims for name,hold in sequence):continue
        frames=[]
        for name,hold in sequence:
            _,rows,_=read(name)
            f=Image.new('P',(96,96));f.putpalette(gifpal)
            f.putdata([indices[c] for r in rows for c in r]);frames.append(f)
        frames[0].save(out/(motion+'.gif'),save_all=True,append_images=frames[1:],
            duration=[t for n,t in sequence],loop=0,transparency=0,disposal=2,optimize=False)
        with Image.open(out/(motion+'.gif')) as g:
            strip=Image.new('RGB',(len(sequence)*196,218),'#202c38')
            draw=ImageDraw.Draw(strip)
            for i,(name,hold) in enumerate(sequence):
                g.seek(i)
                if g.convert('RGBA').tobytes()!=ims[name].tobytes():
                    raise ValueError(('GIF pixels differ',motion,i))
                bg=background('dark');bg.alpha_composite(g.convert('RGBA'))
                strip.paste(bg.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(i*196,22))
                draw.text((i*196+2,3),f'{name} {hold}ms',fill='white')
            strip.save(out/(motion+'-decoded.png'))
    cards=''.join(f'<section><h2>{label}</h2><img src="{name}.gif" alt="{label} animation"></section>'
        for name,label in [('idle','대기'),('attack','공격'),('hit','피격'),('dead','쓰러짐'),
                           ('skill','진혼음'),('poison','독'),('stun','기절'),('sleep','수면')])
    (out/'review.html').write_text('''<!doctype html><html lang="ko"><meta charset="utf-8">
<title>청동종귀 · 18자세 / 8동작</title><style>
body{background:#202c38;color:#eee2c9;font:16px system-ui;padding:24px;max-width:1250px;margin:auto}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
section{border:1px solid #53606a;padding:12px;text-align:center}h2{font-size:18px}
img{width:100%;max-width:288px;image-rendering:pixelated}
.light{background:#eee2c9;color:#17282f} .checker section{background:repeating-conic-gradient(#56606b 0% 25%,#88919a 0% 50%) 0/32px 32px}
button{margin:4px;padding:8px} .sheet{max-width:100%;width:100%}
@media(max-width:750px){main{grid-template-columns:repeat(2,1fr)}}
</style><h1>청동종귀</h1><p>원본 96×96 · 18자세 · 8동작 · 사용자 판단용 후보</p>
<nav><button onclick="document.body.className=''">어둡게</button>
<button onclick="document.body.className='light'">밝게</button>
<button onclick="document.body.className='checker'">체커</button></nav><main>'''+cards+
        '</main><h2>18자세 확대판</h2><img class="sheet" src="study-dark.png" alt="All eighteen native poses"></html>')
    (out/'format-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'Exported {len(report)} native frames, {len(MOTIONS)} GIF motions and three background study sheets.')

if __name__=='__main__':main()
