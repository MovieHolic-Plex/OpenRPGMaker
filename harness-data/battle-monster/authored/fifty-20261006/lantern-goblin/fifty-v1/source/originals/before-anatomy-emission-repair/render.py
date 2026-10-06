"""Read literal grids; bake native PNGs/GIFs and diagnostic nearest-neighbor sheets."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
R=Path(__file__).resolve().parent
P=json.loads((R/'palette.json').read_text())
C={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in P.items()}
ims={}; report={}
for p in sorted(list((R/'poses').glob('*.pxgrid'))+list((R/'actions').glob('*.pxgrid'))):
    ss=p.read_text().splitlines()
    if len(ss)!=96 or any(len(s)!=96 for s in ss): raise ValueError('Canvas '+str(p))
    im=Image.new('RGBA',(96,96))
    im.putdata([C[c] if c!='.' else (0,0,0,0) for s in ss for c in s])
    ims[p.stem]=im; im.save(R/'previews'/(p.stem+'.png'))
    bb=im.getbbox()
    if bb[0]<1 or bb[1]<1 or bb[2]>95 or bb[3]>93: raise ValueError('Margin '+str(p)+str(bb))
    report[p.stem]={'bbox':bb,'sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'imageSHA256':hashlib.sha256((R/'previews'/(p.stem+'.png')).read_bytes()).hexdigest()}
if ims['idle_a'].getbbox()[3]!=93: raise ValueError('Idle baseline')
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for bg,name in [((238,227,203),'light'),((24,28,36),'dark'),(None,'checker')]:
    sheet=Image.new('RGB',(6*300,3*322),(42,42,47)); d=ImageDraw.Draw(sheet)
    native_bg=Image.new('RGB',(6*104,3*116),(42,42,47)); nd=ImageDraw.Draw(native_bg)
    for i,n in enumerate([n for n in order if n in ims]):
        x=(i%6)*300+6;y=(i//6)*322+24
        tile=Image.new('RGBA',(96,96),bg+(255,) if bg else (210,210,215,255))
        if bg is None:
            td=ImageDraw.Draw(tile)
            for yy in range(0,96,8):
                for xx in range(0,96,8):
                    if (xx//8+yy//8)%2: td.rectangle((xx,yy,xx+7,yy+7),fill=(160,160,168,255))
        tile.alpha_composite(ims[n]); sheet.paste(tile.resize((288,288),Image.Resampling.NEAREST),(x,y)); d.text((x,y-17),n,fill='white')
        nx=(i%6)*104+4; ny=(i//6)*116+18
        native_bg.paste(tile,(nx,ny));nd.text((nx,ny-13),n,fill='white')
    sheet.save(R/'previews'/('sheet-'+name+'.png'))
    native_bg.save(R/'previews'/('sheet-native-'+name+'.png'))
native=Image.new('RGB',(6*104,3*116),(238,227,203));d=ImageDraw.Draw(native)
for i,n in enumerate([n for n in order if n in ims]):
    x=i%6*104+4;y=i//6*116+18
    native.paste(ims[n],(x,y),ims[n]);d.text((x,y-13),n,fill=(30,30,35))
native.save(R/'previews'/'sheet-native.png')
SEQS={'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,260,130,170,210,300]),'hit':(['idle_a','hit','recover','idle_a'],[250,300,210,300]),'dead':(['idle_a','hit','dead'],[250,220,1200]),'skill':(['skill_a','skill_b','skill_c','idle_a'],[420,260,350,280]),'poison':(['poison_a','poison_b'],[420,420]),'stun':(['stun_a','stun_b'],[480,480]),'sleep':(['sleep_a','sleep_b'],[650,650])}
for n,(seq,ms) in SEQS.items():
    if not all(s in ims for s in seq):continue
    gs=[]
    for s in seq:
        tile=Image.new('RGBA',(96,96),(24,28,36,255));tile.alpha_composite(ims[s]);gs.append(tile.convert('RGB'))
    gs[0].save(R/'previews'/(n+'.gif'),save_all=True,append_images=gs[1:],duration=ms,loop=0,disposal=2)
(R/'previews'/'source-image-hashes.json').write_text(json.dumps(report,indent=2)+'\n')
print('Rendered',len(ims),'native frames;',len([n for n,(ss,_) in SEQS.items() if all(s in ims for s in ss)]),'GIFs. idle_a bbox:',report['idle_a']['bbox'])
# Native transparent atlases; useful for inspecting the literal 3x3 contract.
for label,names in [('poses',order[:9]),('actions',order[9:])]:
    atlas=Image.new('RGBA',(288,288))
    for i,n in enumerate(names):atlas.paste(ims[n],((i%3)*96,(i//3)*96))
    atlas.save(R/'previews'/(label+'-atlas.png'))
# Decode actual GIF bytes into diagnostic contact strips, keeping saved holds.
gifreport={}
for n,(seq,ms) in SEQS.items():
    with Image.open(R/'previews'/(n+'.gif')) as gif:
        tiles=[];dur=[]
        for idx in range(gif.n_frames):
            gif.seek(idx);tiles.append(gif.convert('RGB').copy());dur.append(gif.info.get('duration'))
        strip=Image.new('RGB',(len(tiles)*202,218),(42,42,47));sd=ImageDraw.Draw(strip)
        for i,t in enumerate(tiles):
            strip.paste(t.resize((192,192),Image.Resampling.NEAREST),(i*202+5,21));sd.text((i*202+5,4),f'{i}: {dur[i]} ms',fill='white')
        strip.save(R/'previews'/('gif-decoded-'+n+'.png'))
        differences=[]
        for frame_name,tile in zip(seq,tiles):
            expected=Image.new('RGBA',(96,96),(24,28,36,255))
            expected.alpha_composite(ims[frame_name])
            differences.append(sum(a!=b for a,b in zip(expected.convert('RGB').getdata(),tile.getdata())))
        gifreport[n]={'frameCount':len(tiles),'durationsMs':dur,'size':list(gif.size),'pixelDifferencesFromSource':differences,'gifSHA256':hashlib.sha256((R/'previews'/(n+'.gif')).read_bytes()).hexdigest()}
(R/'previews'/'gif-decoded-report.json').write_text(json.dumps(gifreport,indent=2)+'\n')
# Read-only connectivity diagnostics: never adds or alters a source pixel.
from collections import deque
conn={}
for n,im in ims.items():
    pts={(x,y) for y in range(96) for x in range(96) if im.getpixel((x,y))[3]};groups=[]
    while pts:
        first=min(pts,key=lambda p:(p[1],p[0]));q=[first];pts.remove(first);one=[]
        while q:
            x,y=q.pop();one.append((x,y))
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                t=(x+dx,y+dy)
                if t in pts:pts.remove(t);q.append(t)
        groups.append({'pixels':len(one),'bboxInclusive':[min(x for x,y in one),min(y for x,y in one),max(x for x,y in one),max(y for x,y in one)]})
    conn[n]=groups
(R/'previews'/'connectivity-diagnostic.json').write_text(json.dumps(conn,indent=2)+'\n')
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>초롱도깨비 원본 검토</title><style>body{margin:24px;background:#24262e;color:#eee;font:16px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}article{padding:16px;background:#333641;border-radius:8px}img{image-rendering:pixelated}article img{width:192px;height:192px}button{padding:8px}p{line-height:1.6}details img{max-width:100%;height:auto}</style><h1>초롱도깨비 · 18 native 자세 / 8동작</h1><p>96×96 원본. 사람 승인 및 독립 검수 결과를 포함하지 않는 저작 후보입니다.</p><main>'''
for n in SEQS:html+=f'<article><h2>{n}</h2><img src="{n}.gif" alt="{n} animation"><p><a href="{n}.gif">GIF 원본</a> · <a href="gif-decoded-{n}.png">저장 프레임 확인판</a></p></article>'
html+='</main><details open><summary>원본 1배</summary><img src="sheet-native.png"></details>'
for n in ['light','dark','checker']:html+=f'<details><summary>{n} · 3배</summary><img src="sheet-{n}.png"></details>'
(R/'previews'/'index.html').write_text(html+'<p><a href="../AUTHORING.md">저작 기록</a> · <a href="../TIMING.md">시간표</a></p></html>')
print('Reopened 8 GIF files for decoded contact strips; source pixels unchanged.')
