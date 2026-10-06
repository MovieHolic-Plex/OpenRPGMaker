"""Read literal grids; encode PNG and GIF; create diagnostic displays only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
PALETTE=json.loads((ROOT/'palette.json').read_text())
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
frames={}
report={}
for name in ORDER:
    p=ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
    if not p.exists(): continue
    rows=p.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows),name
    im=Image.new('RGBA',(64,64))
    ink=[]
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c=='.': continue
            assert c in PALETTE,(name,c)
            rgb=tuple(bytes.fromhex(PALETTE[c][1:]))
            im.putpixel((x,y),rgb+(255,))
            ink.append((x,y))
    assert all(1<=x<=62 and 1<=y<=60 for x,y in ink),name
    if name=='idle_a': assert max(y for x,y in ink)==60
    im.save(OUT/(name+'.png'))
    frames[name]=im
    report[name]={'ink':len(ink),'bounds':im.getbbox(),'sha256_grid':hashlib.sha256(p.read_bytes()).hexdigest(),'sha256_png':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
# Diagnostic nearest enlargement is solely for viewing, never an authored asset.
for bgname, color in [('dark',(30,36,46)),('light',(231,227,207)),('checker',None)]:
    sheet=Image.new('RGB',(6*272,3*292),color or (210,213,214))
    draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(ORDER):
        if name not in frames: continue
        bx=(i%6)*272+8; by=(i//6)*292+26
        if color is None:
            for ty in range(0,256,16):
                for tx in range(0,256,16):
                    draw.rectangle((bx+tx,by+ty,bx+tx+15,by+ty+15),fill=(184,190,191) if (tx//16+ty//16)%2 else (223,226,222))
        draw.text((bx,by-19),name,fill=(220,225,223) if bgname=='dark' else (35,43,52))
        big=frames[name].resize((256,256),Image.Resampling.NEAREST)
        sheet.paste(big,(bx,by),big)
    sheet.save(OUT/('sheet-'+bgname+'.png'))
# Native pixels shown side by side on three backgrounds.
native=Image.new('RGB',(6*80,3*94*3),(30,36,46))
d=ImageDraw.Draw(native)
for bi,col in enumerate([(30,36,46),(231,227,207),None]):
    for i,name in enumerate(ORDER):
        if name not in frames:continue
        x=(i%6)*80+8;y=bi*282+(i//6)*94+22
        d.rectangle((x,y,x+63,y+63),fill=col or (216,219,215))
        if col is None:
            for sy in range(0,64,8):
                for sx in range(0,64,8):
                    d.rectangle((x+sx,y+sy,x+sx+7,y+sy+7),fill=(184,190,191) if (sx//8+sy//8)%2 else (223,226,222))
        d.text((x,y-15),name,fill=(153,162,166))
        native.paste(frames[name],(x,y),frames[name])
native.save(OUT/'native-backgrounds.png')
MOTIONS={
'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
'attack':[('idle_a',300),('windup',220),('move',120),('attack',140),('recover',220),('idle_a',320)],
'hit':[('idle_a',320),('hit',260),('recover',240),('idle_a',320)],
'dead':[('idle_a',300),('hit',180),('dead',1000)],
'skill':[('idle_a',260),('skill_a',280),('skill_b',200),('skill_c',280),('idle_a',320)],
'poison':[('poison_a',480),('poison_b',480)],
'stun':[('stun_a',480),('stun_b',480)],
'sleep':[('sleep_a',600),('sleep_b',600)]}
# Exact shared palette avoids color quantization and preserves all native colors.
gifpalette=[0,0,0]+[v for h in PALETTE.values() for v in bytes.fromhex(h[1:])]
gifpalette += [0]*(768-len(gifpalette))
lookup={tuple(bytes.fromhex(h[1:])):i+1 for i,h in enumerate(PALETTE.values())}
for name,seq in MOTIONS.items():
    if any(n not in frames for n,ms in seq):continue
    gifs=[]
    for n,ms in seq:
        pim=Image.new('P',(64,64),0)
        pim.putpalette(gifpalette)
        pim.putdata([lookup[p[:3]] if p[3] else 0 for p in frames[n].getdata()])
        gifs.append(pim)
    gifs[0].save(OUT/(name+'.gif'),save_all=True,append_images=gifs[1:],duration=[ms for n,ms in seq],loop=0,transparency=0,disposal=2,optimize=False)
    with Image.open(OUT/(name+'.gif')) as check:
        assert check.n_frames==len(seq),(name,check.n_frames)
        for i,(n,ms) in enumerate(seq):
            check.seek(i)
            got=check.convert('RGBA')
            # Invisible RGB can differ; compare visible native pixels and alpha.
            assert all(a[3]==b[3] and (not a[3] or a==b) for a,b in zip(got.getdata(),frames[n].getdata())),(name,i)
            assert check.info['duration']==ms,(name,i)
report['motions']={n:[{'frame':p,'holdMs':ms} for p,ms in seq] for n,seq in MOTIONS.items() if all(p in frames for p,ms in seq)}
(OUT/'encoding-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Rendered',len(frames),'native frames;',len(report['motions']),'GIFs. Palette:',len(PALETTE),'colors.')
# Native, transparent sheets preserve the 3 by 3 runtime arrangement.
for sheetname,names in [('poses',ORDER[:9]),('actions',ORDER[9:])]:
    atlas=Image.new('RGBA',(192,192),(0,0,0,0))
    for i,n in enumerate(names):
        if n in frames:atlas.paste(frames[n],((i%3)*64,(i//3)*64))
    atlas.save(OUT/(sheetname+'-native.png'))
# Decode the saved animations for visual inspection at their actual hold times.
for group in [('attack','hit','dead','skill'),('idle','poison','stun','sleep')]:
    film=Image.new('RGB',(6*200,4*224),(35,41,51))
    labels=ImageDraw.Draw(film)
    for gy,motion in enumerate(group):
        gp=OUT/(motion+'.gif')
        if not gp.exists():continue
        with Image.open(gp) as animation:
            for fi in range(animation.n_frames):
                animation.seek(fi)
                fr=animation.convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
                px=fi*200+4;py=gy*224+27
                film.paste(fr,(px,py),fr)
                labels.text((px,gy*224+6),f'{motion} {fi}: {animation.info["duration"]}ms',fill=(233,231,211))
    film.save(OUT/('gif-filmstrip-'+group[0]+'.png'))
(OUT/'index.html').write_text('''<!doctype html><html lang="ko"><meta charset="utf-8"><title>철취학 18자세 · 8동작</title><style>
body{margin:24px;background:#232933;color:#ede8d5;font:16px system-ui}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:16px}figure{margin:0;padding:12px;background:#303946;border-radius:8px}img{width:256px;max-width:100%;height:auto;image-rendering:pixelated}figcaption{margin-top:8px}button{margin:8px 0 20px;padding:8px}body.light{background:#e7e3cf;color:#19232e}body.light figure{background:#dedbc9}body.checker figure{background:repeating-conic-gradient(#b8bebf 0% 25%,#dfe2de 0% 50%) 0/32px 32px}@media(max-width:800px){main{grid-template-columns:repeat(2,minmax(160px,1fr))}}
</style><h1>철취학 · 검토용 원본 동작</h1><p>64px 원본 / 16색 / 각 프레임 직접 저작. 사용자 승인과 독립 검수는 기록하지 않았습니다.</p><button onclick="document.body.className=''">어두운 배경</button> <button onclick="document.body.className='light'">밝은 배경</button> <button onclick="document.body.className='checker'">체커 배경</button><main>'''+''.join(f'<figure><img src="{n}.gif" alt="{n} animation"><figcaption>{title}</figcaption></figure>' for n,title in [('idle','대기'),('attack','공격'),('hit','피격'),('dead','쓰러짐'),('skill','철취풍'),('poison','독'),('stun','기절'),('sleep','수면')])+'''</main><p><a href="sheet-light.png">18자세 · 밝은 배경</a> / <a href="sheet-dark.png">어두운 배경</a> / <a href="sheet-checker.png">체커 배경</a> / <a href="native-backgrounds.png">원본 1배</a></p></html>''')
