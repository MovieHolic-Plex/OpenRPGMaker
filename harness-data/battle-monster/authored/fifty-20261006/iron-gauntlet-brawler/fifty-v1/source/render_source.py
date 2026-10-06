"""Decode native literal grids and bake review PNGs/GIFs. No art synthesis."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview'
OUT.mkdir(exist_ok=True)
PAL=json.loads((ROOT/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:])) for k,v in PAL.items()}
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
frames={}
for name in ORDER:
    path=ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
    if not path.exists(): continue
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(row)!=64 for row in rows): raise ValueError((name,'dimensions'))
    im=Image.new('RGBA',(64,64))
    im.putdata([(0,0,0,0) if c=='.' else (*RGB[c],255) for row in rows for c in row])
    im.save(OUT/(name+'.png'))
    frames[name]=im
# Only inspection boards are magnified; delivered PNGs/GIFs stay native.
for bgname,bg in [('light',(232,227,215)),('dark',(38,41,51)),('checker',None)]:
    board=Image.new('RGB',(6*272,3*294),(56,60,68))
    draw=ImageDraw.Draw(board)
    for i,name in enumerate(ORDER):
        if name not in frames: continue
        tile=Image.new('RGB',(64,64),bg or (195,198,202))
        if bg is None:
            td=ImageDraw.Draw(tile)
            for y in range(0,64,8):
                for x in range(0,64,8):
                    if (x//8+y//8)%2: td.rectangle((x,y,x+7,y+7),fill=(142,148,158))
        tile.paste(frames[name],mask=frames[name].getchannel('A'))
        bx=(i%6)*272+8; by=(i//6)*294+24
        board.paste(tile.resize((256,256),Image.Resampling.NEAREST),(bx,by))
        draw.text((bx,by-17),name,fill=(245,245,235))
    board.save(OUT/('contact-'+bgname+'.png'))
    native=Image.new('RGB',(6*82,3*87),(bg or (165,170,180)))
    nd=ImageDraw.Draw(native)
    for i,name in enumerate(ORDER):
        if name not in frames: continue
        x=i%6*82+9; y=i//6*87+20
        nd.text((x-5,y-14),name,fill=(125,117,107) if bgname=='light' else (230,230,230))
        native_tile=Image.new('RGB',(64,64),bg or (195,198,202))
        if bg is None:
            nt=ImageDraw.Draw(native_tile)
            for cy in range(0,64,8):
                for cx in range(0,64,8):
                    if (cx//8+cy//8)%2:
                        nt.rectangle((cx,cy,cx+7,cy+7),fill=(142,148,158))
        native_tile.paste(frames[name],(0,0),frames[name])
        native.paste(native_tile,(x,y))
    native.save(OUT/('native-'+bgname+'.png'))
SCENES={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
'hit':(['idle_a','hit','idle_a'],[700,180,900]),
'dead':(['idle_a','hit','dead'],[700,150,1700]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[300,300]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
colors=list(RGB.values())
gifpal=[0,0,0]+[v for rgb in colors for v in rgb]
gifpal += [0]*(768-len(gifpal))
indexed={}
for name,im in frames.items():
    g=Image.new('P',(64,64)); g.putpalette(gifpal)
    g.putdata([0 if p[3]==0 else 1+colors.index(p[:3]) for p in im.getdata()])
    g.info['transparency']=0; indexed[name]=g
for scene,(seq,holds) in SCENES.items():
    if any(name not in indexed for name in seq): continue
    path=OUT/(scene+'.gif')
    indexed[seq[0]].save(path,save_all=True,append_images=[indexed[name] for name in seq[1:]],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    with Image.open(path) as decoded:
        for i,name in enumerate(seq):
            decoded.seek(i)
            if decoded.convert('RGBA').tobytes()!=frames[name].tobytes(): raise ValueError((scene,i,'encoding differs'))
    # Actual GIF frames, decoded and shown in playback order, for inspection.
    strip=Image.new('RGB',(len(seq)*208,226),(232,227,215)); sd=ImageDraw.Draw(strip)
    with Image.open(path) as decoded:
        for i,name in enumerate(seq):
            decoded.seek(i); cel=decoded.convert('RGBA')
            cel=cel.resize((192,192),Image.Resampling.NEAREST)
            strip.paste(cel,(i*208+8,25),cel)
            sd.text((i*208+8,6),name+' '+str(holds[i])+'ms',fill=(40,40,50))
    strip.save(OUT/(scene+'-gif-frames.png'))
(OUT/'timing.json').write_text(json.dumps(SCENES,indent=2)+'\n')
print('Native PNGs:',len(frames),'| GIFs:',sum(all(n in frames for n in seq) for seq,holds in SCENES.values()))
# Native 3x3 sheets are simple packing of literal cels, with no changes to pixels.
for sheet_name, names in [('poses',ORDER[:9]),('actions',ORDER[9:])]:
    sheet=Image.new('RGBA',(192,192))
    for i,name in enumerate(names):
        if name in frames: sheet.paste(frames[name],((i%3)*64,(i//3)*64))
    sheet.save(OUT/(sheet_name+'.png'))
strips=[(name,Image.open(OUT/(name+'-gif-frames.png')).convert('RGB')) for name,(seq,holds) in SCENES.items() if all(n in frames for n in seq)]
if strips:
    board=Image.new('RGB',(max(im.width for name,im in strips),sum(im.height+28 for name,im in strips)),(56,60,68))
    bd=ImageDraw.Draw(board);y=0
    for name,im in strips:
        bd.text((8,y+7),name,fill=(245,245,240));board.paste(im,(0,y+28));y+=im.height+28
    board.save(OUT/'all-gif-decoded.png')
# Read-only source diagnostics. No correction/filling/rating is performed here.
import hashlib
report={'paletteColors':len(PAL),'paletteSha256':hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest(),'frames':{}}
for name,im in frames.items():
    path=ROOT/('poses' if name in ORDER[:9] else 'actions')/(name+'.pxgrid')
    a=path.read_text().splitlines()
    coords=[(x,y) for y,row in enumerate(a) for x,c in enumerate(row) if c!='.']
    bbox=[min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords)]
    report['frames'][name]={'size':[64,64],'inkBoundsInclusive':bbox,'transparentBorder':not any(x in (0,63) or y in (0,63) for x,y in coords),'bottomInkY':bbox[3],'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pngSha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
report['uniqueNativeFrames']=len({im.tobytes() for im in frames.values()})
(OUT/'diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
