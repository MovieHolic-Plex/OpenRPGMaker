"""Diagnostic re-read of final images. No source edits or hole filling."""
from pathlib import Path
from PIL import Image, ImageDraw
import json,hashlib
from collections import deque
ROOT=Path(__file__).resolve().parent
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
       'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
report={'scope':'Author diagnostic, not independent review or user approval',
        'paletteColors':len(pal),'frames':{},'gifs':{}}
for name in ORDER:
    file=ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
    src=file.read_text().splitlines()
    rgba=Image.open(ROOT/'png'/(name+'.png')).convert('RGBA')
    ink=[(x,y) for y,line in enumerate(src) for x,c in enumerate(line) if c!='.']
    mismatches=[]
    for y,line in enumerate(src):
        for x,c in enumerate(line):
            if rgba.getpixel((x,y)) != ((0,0,0,0) if c=='.' else colors[c]):
                mismatches.append([x,y])
    nontransparent=set(ink); seen=set(); groups=[]
    for point in nontransparent:
        if point in seen:continue
        stack=[point];seen.add(point);pts=[]
        while stack:
            x,y=stack.pop();pts.append((x,y))
            for dx,dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                n=(x+dx,y+dy)
                if n in nontransparent and n not in seen:seen.add(n);stack.append(n)
        groups.append({'pixels':len(pts),'bbox':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]})
    report['frames'][name]={
      'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),
      'pngSha256':hashlib.sha256((ROOT/'png'/(name+'.png')).read_bytes()).hexdigest(),
      'rows':len(src),'widths':sorted(set(map(len,src))),
      'bbox':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],
      'borderInk':[[x,y] for x,y in ink if x in (0,95) or y in (0,95)],
      'pngMismatchCount':len(mismatches),'alphaValues':sorted({p[3] for p in rgba.get_flattened_data()}),
      'components8':sorted(groups,key=lambda c:c['pixels'],reverse=True)}
scenes=json.loads((ROOT/'gifs'/'timing.json').read_text())
strip=Image.new('RGB',(576,114*len(scenes)),'#26262E');draw=ImageDraw.Draw(strip)
for row,(name,(sequence,durations)) in enumerate(scenes.items()):
    path=ROOT/'gifs'/(name+'.gif')
    rec={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':[]}
    with Image.open(path) as decoded:
        rec['decodedFrameCount']=decoded.n_frames
        rec['size']=list(decoded.size)
        for j,pose in enumerate(sequence):
            decoded.seek(j);frame=decoded.convert('RGBA')
            authored=Image.open(ROOT/'png'/(pose+'.png')).convert('RGBA')
            rec['frames'].append({'pose':pose,'durationMs':decoded.info.get('duration'),
                'expectedMs':durations[j],'sameRgba':frame.tobytes()==authored.tobytes()})
            bg=Image.new('RGBA',(96,96),'#26262E');bg.alpha_composite(frame)
            strip.paste(bg,(j*96,row*114+18))
            draw.text((j*96+2,row*114+2),pose+' '+str(durations[j]),fill='#EEE7D0')
    report['gifs'][name]=rec
strip.save(ROOT/'png'/'gif-decoded-native.png')
strip.resize((1152,strip.height*2),Image.Resampling.NEAREST).save(ROOT/'png'/'gif-decoded-2x.png')
(ROOT/'preview-readback.json').write_text(json.dumps(report,indent=2)+'\n')
print('Native image readback:',len(report['frames']),'frames;',len(report['gifs']),'GIFs.')
print('Dimensions:',sorted({(v['rows'],tuple(v['widths'])) for v in report['frames'].values()}))
print('Border ink:',sum(len(v['borderInk']) for v in report['frames'].values()))
print('PNG differences:',sum(v['pngMismatchCount'] for v in report['frames'].values()))
print('GIF differences:',sum(not f['sameRgba'] for g in report['gifs'].values() for f in g['frames']))
print('GIF timing differences:',sum(f['durationMs']!=f['expectedMs'] for g in report['gifs'].values() for f in g['frames']))
print('Lowest ink:',{n:v['bbox'][3] for n,v in report['frames'].items()})
print('Small body-frame components:',{n:[g for g in v['components8'] if g['pixels']<100] for n,v in report['frames'].items() if n in ORDER[:9]})
