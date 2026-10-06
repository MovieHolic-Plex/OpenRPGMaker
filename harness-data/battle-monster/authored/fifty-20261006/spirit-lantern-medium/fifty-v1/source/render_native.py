"""Read literal pxgrids; render PNGs, inspection boards, exact-palette GIFs.
The only enlargement is nearest-neighbour diagnostic display, never source art.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
palette=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:])) for k,v in palette.items()}
images={}
indexed={}
report=[]
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(row)!=64 for row in rows): raise ValueError(str(path)+' size')
    ink=[(x,y) for y,row in enumerate(rows) for x,k in enumerate(row) if k!='.']
    im=Image.new('RGBA',(64,64))
    im.putdata([(0,0,0,0) if k=='.' else colors[k]+(255,) for row in rows for k in row])
    im.save(OUT/(path.stem+'.png'))
    images[path.stem]=im
    order=['.']+list(palette)
    pim=Image.new('P',(64,64))
    flat=[0,0,0]+[c for k in palette for c in colors[k]]
    pim.putpalette(flat+[0]*(768-len(flat)))
    pim.putdata([order.index(k) for row in rows for k in row])
    pim.info['transparency']=0
    indexed[path.stem]=pim
    bbox=(min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink))
    report.append({'name':path.stem,'ink_bbox':bbox,'ink_pixels':len(ink),'palette_symbols':len(set(''.join(rows))-set('.'))})
(OUT/'dimensions.json').write_text(json.dumps(report,indent=2)+'\n')
base=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
actions=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for group,names in [('poses',base),('actions',actions)]:
    names=[n for n in names if n in images]
    if not names: continue
    for bgname,bg in [('light',(235,232,223)),('dark',(30,33,45)),('checker',None)]:
        for scale in (1,3,4):
            tilew=64*scale+16
            tileh=64*scale+28
            board=Image.new('RGB',(tilew*3,tileh*((len(names)+2)//3)),(115,118,127))
            draw=ImageDraw.Draw(board)
            for i,n in enumerate(names):
                x=(i%3)*tilew+8; y=(i//3)*tileh+4
                surface=Image.new('RGBA',(64,64), bg+(255,) if bg else (210,211,213,255))
                if bg is None:
                    for by in range(0,64,8):
                        for bx in range(0,64,8):
                            if (bx//8+by//8)%2: ImageDraw.Draw(surface).rectangle((bx,by,bx+7,by+7),fill=(153,158,170,255))
                surface.alpha_composite(images[n])
                if scale!=1: surface=surface.resize((64*scale,64*scale),Image.Resampling.NEAREST)
                board.paste(surface,(x,y))
                draw.text((x,y+64*scale+3),n,fill=(255,255,255))
            board.save(OUT/f'{group}-{bgname}-{scale}x.png')
MOTIONS={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,280,120,180,240,360]),
 'hit':(['idle_a','hit','recover','idle_a'],[300,340,240,360]),
 'dead':(['idle_a','hit','dead'],[300,220,1200]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[260,380,280,360,340]),
 'poison':(['poison_a','poison_b'],[460,460]),
 'stun':(['stun_a','stun_b'],[520,520]),
 'sleep':(['sleep_a','sleep_b'],[780,900])
}
for name,(frames,holds) in MOTIONS.items():
    if not all(n in indexed for n in frames): continue
    ims=[indexed[n] for n in frames]
    ims[0].save(OUT/(name+'.gif'),save_all=True,append_images=ims[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    strip=Image.new('RGB',(len(frames)*256,286),(30,33,45))
    for i,n in enumerate(frames):
        surf=Image.new('RGBA',(64,64),(30,33,45,255));surf.alpha_composite(images[n])
        strip.paste(surf.resize((256,256),Image.Resampling.NEAREST),(i*256,0))
        ImageDraw.Draw(strip).text((i*256+4,260),f'{n} {holds[i]}ms',fill=(255,255,255))
    strip.save(OUT/(name+'-sequence.png'))
print(json.dumps(report))
# Preserve the native decoding observations for all eight exported GIFs.
from PIL import ImageSequence
readback=[]
for name,(frames,holds) in MOTIONS.items():
    gifpath=OUT/(name+'.gif')
    if not gifpath.exists() or not all(n in images for n in frames): continue
    gif=Image.open(gifpath)
    observations=[]
    for i,frame in enumerate(ImageSequence.Iterator(gif)):
        actual=frame.convert('RGBA')
        observations.append({
            'pose':frames[i], 'hold_ms':frame.info.get('duration'),
            'rgba_matches_native':actual.tobytes()==images[frames[i]].tobytes()
        })
    readback.append({'motion':name,'native_size':list(gif.size),'frame_count':gif.n_frames,'frames':observations})
(OUT/'gif-readback.json').write_text(json.dumps(readback,indent=2)+'\n')
# Show the actual decoded GIF frames, including each hold, for visual review.
decoded_board=Image.new('RGB',(6*144,8*158),(30,33,45))
decoded_draw=ImageDraw.Draw(decoded_board)
for row,(motion,(names,holds)) in enumerate(MOTIONS.items()):
    gif=Image.open(OUT/(motion+'.gif'))
    for column,frame in enumerate(ImageSequence.Iterator(gif)):
        actual=frame.convert('RGBA')
        surface=Image.new('RGBA',(64,64),(235,232,223,255))
        surface.alpha_composite(actual)
        x=column*144+8; y=row*158
        decoded_board.paste(surface.resize((128,128),Image.Resampling.NEAREST),(x,y))
        decoded_draw.text((x,y+130),names[column]+' '+str(frame.info.get('duration'))+'ms',fill=(255,255,255))
decoded_board.save(OUT/'gif-decoded-frames.png')
# Native 3-column packing preserves every pixel and transparent cell margin.
for group,names in [('poses',base),('actions',actions)]:
    sheet=Image.new('RGBA',(192,192))
    for i,n in enumerate(names):
        if n in images: sheet.paste(images[n],((i%3)*64,(i//3)*64))
    sheet.save(OUT/(group+'-sheet.png'))
