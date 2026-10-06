"""Read literal pxgrid files and render unchanged RGBA pixels plus diagnostic boards/GIFs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
R=Path(__file__).resolve().parent
P=json.loads((R/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in P.items()}
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
frames={}; report={}
for name in order:
    f=R/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid')
    if not f.exists():continue
    rows=f.read_text().splitlines()
    assert len(rows)==64 and all(len(row)==64 for row in rows),name
    assert all(c=='.' or c in P for row in rows for c in row),name
    ink=[(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
    assert all(1<=x<=62 and 1<=y<=60 for x,y in ink),name
    if name=='idle_a':assert max(y for x,y in ink)==60
    im=Image.new('RGBA',(64,64));im.putdata([RGB.get(c,(0,0,0,0)) for row in rows for c in row])
    im.save(R/'previews'/(name+'.png')); frames[name]=im
    report[name]={'bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'source_sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
# Diagnostic nearest-neighbor enlargement only; authored pixels are never resized in deliverables.
for theme in ['light','dark','checker']:
    board=Image.new('RGB',(6*280,3*300),(225,222,210) if theme=='light' else (35,39,48))
    d=ImageDraw.Draw(board)
    for i,(name,im) in enumerate(frames.items()):
        tile=Image.new('RGBA',(64,64),(237,231,210,255) if theme=='light' else (35,39,48,255))
        if theme=='checker':
            td=ImageDraw.Draw(tile)
            for y in range(0,64,8):
                for x in range(0,64,8):td.rectangle((x,y,x+7,y+7),fill=((180,180,180,255) if (x//8+y//8)%2 else (235,235,235,255)))
        tile.alpha_composite(im)
        x=(i%6)*280;y=(i//6)*300
        board.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x+12,y+26))
        d.text((x+12,y+8),name,fill=(20,20,20) if theme=='light' else (255,255,255))
    board.save(R/'previews'/('board-'+theme+'.png'))
# Native 1x contact sheet, with labels in a diagnostic margin.
native=Image.new('RGB',(6*80,3*88),(220,222,220));d=ImageDraw.Draw(native)
for i,(name,im) in enumerate(frames.items()):
    x=i%6*80;y=i//6*88;native.paste(im,(x+8,y+18),im);d.text((x+2,y+2),name,fill=(20,20,20))
native.save(R/'previews'/'native.png')
(R/'previews'/'pixel-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v['bounds'] for k,v in report.items()}))

MOTIONS={
 'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
 'attack': [('idle_a',240),('windup',280),('move',100),('attack',180),('recover',220),('idle_a',320)],
 'hit': [('idle_a',300),('hit',180),('recover',160),('idle_a',400)],
 'dead': [('idle_a',300),('hit',150),('dead',1400)],
 'skill': [('idle_a',240),('skill_a',360),('skill_b',260),('skill_c',280),('idle_a',320)],
 'poison': [('poison_a',420),('poison_b',420)],
 'stun': [('stun_a',440),('stun_b',440)],
 'sleep': [('sleep_a',650),('sleep_b',650)]
}
# Exact native 3x3 sheets. No enlarged/interpolated frames.
for title,names in [('poses-sheet',order[:9]),('actions-sheet',order[9:])]:
    if not all(n in frames for n in names): continue
    sheet=Image.new('RGBA',(192,192))
    for i,n in enumerate(names):sheet.paste(frames[n],(i%3*64,i//3*64))
    sheet.save(R/'previews'/(title+'.png'))
if len(frames)==18:
    palette=[0,0,0]+[b for rgba in RGB.values() for b in rgba[:3]]
    palette+= [0]*(768-len(palette))
    symbols={s:i+1 for i,s in enumerate(P)}
    contact=Image.new('RGB',(6*144,8*168),(225,227,222));cd=ImageDraw.Draw(contact)
    gif_report={}
    for row,(motion,sequence) in enumerate(MOTIONS.items()):
        imgs=[]
        for name,ms in sequence:
            src=R/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid')
            glyphs=''.join(src.read_text().splitlines())
            im=Image.new('P',(64,64));im.putpalette(palette)
            im.putdata([symbols.get(c,0) for c in glyphs]);im.info['transparency']=0
            imgs.append(im)
        dest=R/'previews'/(motion+'.gif')
        imgs[0].save(dest,save_all=True,append_images=imgs[1:],duration=[ms for name,ms in sequence],loop=0,transparency=0,disposal=2,optimize=False)
        decoded=Image.open(dest)
        assert decoded.n_frames==len(sequence),(motion,decoded.n_frames)
        durations=[]
        for i,(name,ms) in enumerate(sequence):
            decoded.seek(i);rgba=decoded.convert('RGBA')
            assert rgba.tobytes()==frames[name].tobytes(),(motion,i,'decoded pixels')
            assert decoded.info['duration']==ms,(motion,i,'hold')
            durations.append(ms)
            x=i*144;y=row*168
            cd.text((x+4,y+3),motion+' / '+name,fill=(20,20,20))
            cd.text((x+4,y+17),str(ms)+' ms',fill=(20,20,20))
            tile=Image.new('RGBA',(64,64),(225,227,222,255));tile.alpha_composite(rgba)
            contact.paste(tile.resize((128,128),Image.Resampling.NEAREST),(x+8,y+33))
        gif_report[motion]={'frames':[n for n,ms in sequence],'duration_ms':durations,'decoded_native_pixels_match':True,'gif_sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
    contact.save(R/'previews'/'gif-decoded-contact.png')
    (R/'motions.json').write_text(json.dumps(MOTIONS,indent=2)+'\n')
    (R/'previews'/'gif-report.json').write_text(json.dumps(gif_report,indent=2)+'\n')
    print('Rendered 18 native PNGs, two native 3x3 sheets and 8 GIFs; decoded all GIF frames and holds match the literal sources.')
