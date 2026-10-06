"""Read literal rows; render diagnostic PNGs and exact indexed GIFs only."""
from pathlib import Path
import json, hashlib
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview';OUT.mkdir(exist_ok=True)
palette=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
frames={}
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows):raise ValueError(path)
    pixels=[(0,0,0,0) if c=='.' else colors[c] for row in rows for c in row]
    im=Image.new('RGBA',(64,64));im.putdata(pixels);frames[path.stem]=im
    im.save(OUT/(path.stem+'.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
order=[n for n in order if n in frames]
for kind in ['light','dark','checker']:
    sheet=Image.new('RGB',(6*272,((len(order)+5)//6)*290),'#303541')
    draw=ImageDraw.Draw(sheet)
    native=Image.new('RGB',(6*80,((len(order)+5)//6)*88),'#303541')
    nd=ImageDraw.Draw(native)
    for i,n in enumerate(order):
        tile=Image.new('RGBA',(64,64),'#E9E1D3' if kind=='light' else '#242837')
        if kind=='checker':
            bg=tile.load()
            for y in range(64):
                for x in range(64):bg[x,y]=(172,179,188,255) if (x//8+y//8)%2 else (211,216,220,255)
        tile.alpha_composite(frames[n])
        x=(i%6)*272;y=(i//6)*290
        sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x+8,y+24));draw.text((x+8,y+5),n,fill='white')
        nx=(i%6)*80;ny=(i//6)*88
        native.paste(tile,(nx+8,ny+20));nd.text((nx+4,ny+4),n,fill='white')
    sheet.save(OUT/('sheet-'+kind+'-4x.png'));native.save(OUT/('sheet-'+kind+'-1x.png'))
# Native sheets: paste source pixels unchanged into an atlas.
for sheet_name,names in [('core',order[:9]),('actions',order[9:])]:
    atlas=Image.new('RGBA',(192,192))
    for i,name in enumerate(names):atlas.paste(frames[name],((i%3)*64,(i//3)*64))
    atlas.save(OUT/(sheet_name+'-native.png'))
SCENES=[
('idle',['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
('attack',['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
('hit',['idle_a','hit','idle_a'],[700,180,900]),
('dead',['idle_a','hit','dead'],[700,150,1700]),
('skill',['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
('poison',['poison_a','poison_b'],[420,420]),
('stun',['stun_a','stun_b'],[300,300]),
('sleep',['sleep_a','sleep_b'],[650,650])]
MOV=OUT/'motions';MOV.mkdir(exist_ok=True)
values=[(0,0,0)]+[tuple(bytes.fromhex(v[1:])) for v in palette.values()]
lookup={v:i for i,v in enumerate(values)}
gif_palette=[c for v in values for c in v]+[0]*(768-len(values)*3)
indexed={}
for name,im in frames.items():
    dest=Image.new('P',(64,64));dest.putpalette(gif_palette)
    dest.putdata([lookup[p[:3]] if p[3] else 0 for p in im.getdata()]);dest.info['transparency']=0
    indexed[name]=dest
metadata=[]
for name,sequence,holds in SCENES:
    if not all(n in frames for n in sequence):continue
    gif=MOV/(name+'.gif')
    indexed[sequence[0]].save(gif,save_all=True,append_images=[indexed[n] for n in sequence[1:]],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    timeline=Image.new('RGB',(len(sequence)*208,236),'#242837');td=ImageDraw.Draw(timeline)
    with Image.open(gif) as decoded:
        if decoded.n_frames!=len(sequence):raise ValueError((name,'frame count'))
        for i,(pose,hold) in enumerate(zip(sequence,holds)):
            decoded.seek(i);rgba=decoded.convert('RGBA')
            if rgba.tobytes()!=frames[pose].tobytes() or decoded.info['duration']!=hold:raise ValueError((name,pose,'encoding'))
            bg=Image.new('RGBA',(64,64),'#C4C9CD');bg.alpha_composite(rgba)
            timeline.paste(bg.resize((192,192),Image.Resampling.NEAREST),(i*208+8,30))
            td.text((i*208+8,8),pose+' '+str(hold)+'ms',fill='white')
    timeline.save(MOV/(name+'-decoded.png'))
    metadata.append({'name':name,'sequence':sequence,'holdsMs':holds,'decodedPixels':'equal to native source'})
(MOV/'timing.json').write_text(json.dumps(metadata,indent=2)+'\n')
summ=[]
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    im=frames[path.stem];box=im.getbbox()
    summ.append({'pose':path.stem,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'canvas':[64,64],'inkBoundsExclusive':box,'lowestInkY':box[3]-1})
(OUT/'source-hashes.json').write_text(json.dumps({'paletteSha256':hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest(),'frames':summ},indent=2)+'\n')
html='''<!doctype html><meta charset="utf-8"><title>은검여협 · 원본 후보</title>
<style>body{background:#242837;color:#efece5;font:16px sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}section{background:#363c48;padding:12px}img{image-rendering:pixelated;background:repeating-conic-gradient(#c4c9cd 0 25%,#e2e5e8 0 50%) 0/32px 32px}.big{width:256px;height:256px}a{color:#bce3df}</style>
<h1>은검여협</h1><p>18개의 직접 저작 자세 · 18색 · native64. 사용자 선택과 하네스 독립 검수 대기.</p><main>'''
for name,_,_ in SCENES:
    html+=f'<section><h2>{name}</h2><img class="big" src="motions/{name}.gif"><p>1배 <img width="64" height="64" src="motions/{name}.gif"></p><a href="motions/{name}-decoded.png">디코딩 프레임 / 노출 시간</a></section>'
html+='</main><p><a href="sheet-light-1x.png">밝은 배경 1배</a> · <a href="sheet-dark-4x.png">어두운 배경 4배</a> · <a href="sheet-checker-4x.png">체커 4배</a></p>'
(OUT/'index.html').write_text(html)
print(f'Rendered {len(frames)} literal frames; {len(metadata)} native GIFs, decoded unchanged.')
