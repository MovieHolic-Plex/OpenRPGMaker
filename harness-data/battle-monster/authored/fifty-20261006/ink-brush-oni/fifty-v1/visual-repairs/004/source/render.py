from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
R=Path(__file__).resolve().parent
P=json.loads((R/'palette.json').read_text())
NAMES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ims={}
report={}
for name in NAMES:
    path=R/('poses' if name in NAMES[:9] else 'actions')/(name+'.pxgrid')
    if not path.exists():continue
    rows=path.read_text().splitlines()
    assert len(rows)==96 and all(len(row)==96 for row in rows),name
    im=Image.new('RGBA',(96,96))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.':
                assert ch in P,(name,ch)
                im.putpixel((x,y),tuple(bytes.fromhex(P[ch][1:]))+(255,))
    box=im.getbbox()
    assert box[0]>=1 and box[1]>=1 and box[2]<=95 and box[3]<=93,(name,box)
    if name=='idle_a':assert box[3]==93
    ims[name]=im
    im.save(R/'previews'/(name+'.png'))
    report[name]={'bounds_exclusive':box,'grid_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'png_sha256':hashlib.sha256((R/'previews'/(name+'.png')).read_bytes()).hexdigest()}
# Diagnostic boards only. Native artwork is unchanged.
for mode in ['light','dark','checker']:
    board=Image.new('RGB',(6*310,3*315),(232,229,220) if mode=='light' else (28,30,36))
    draw=ImageDraw.Draw(board)
    for i,(name,im) in enumerate(ims.items()):
        x=(i%6)*310+10;y=(i//6)*315+20
        bg=Image.new('RGBA',(96,96),(235,231,218,255) if mode=='light' else (34,37,43,255))
        if mode=='checker':
            for yy in range(96):
                for xx in range(96):
                    bg.putpixel((xx,yy),(100,104,112,255) if (xx//8+yy//8)%2 else (155,159,164,255))
        bg.alpha_composite(im)
        board.paste(bg.resize((288,288),Image.Resampling.NEAREST).convert('RGB'),(x,y))
        draw.text((x,y-15),name,fill=(20,20,20) if mode=='light' else (235,235,235))
    board.save(R/'previews'/('board-'+mode+'.png'))
native=Image.new('RGB',(6*120,3*120),(222,220,208))
d=ImageDraw.Draw(native)
for i,(name,im) in enumerate(ims.items()):
    x=i%6*120+12;y=i//6*120+20
    native.paste(im,(x,y),im);d.text((x,y-14),name,fill=(25,25,25))
native.save(R/'previews'/'native.png')
seqs={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[320,280,120,100,220,320]),
'hit':(['idle_a','hit','recover','idle_a'],[400,200,240,400]),
'dead':(['idle_a','hit','dead'],[360,180,1400]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[320,400,180,320,400]),
'poison':(['poison_a','poison_b'],[440,440]),
'stun':(['stun_a','stun_b'],[520,520]),
'sleep':(['sleep_a','sleep_b'],[800,900])}
for name,(order,durs) in seqs.items():
    if any(n not in ims for n in order):continue
    frames=[]
    for n in order:
        bg=Image.new('RGBA',(96,96),(220,217,205,255));bg.alpha_composite(ims[n])
        frames.append(bg.convert('RGB'))
    frames[0].save(R/'previews'/(name+'.gif'),save_all=True,append_images=frames[1:],duration=durs,loop=0,disposal=2,optimize=False)
(R/'previews'/'file-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Rendered',len(ims),'literal frames')
# Reopen the actual encoded GIFs; diagnostic filmstrips use decoded GIF pixels.
gif_board=Image.new('RGB',(6*208,8*222),(35,37,43))
gd=ImageDraw.Draw(gif_board)
enc={}
for row,(name,(order,durs)) in enumerate(seqs.items()):
    path=R/'previews'/(name+'.gif')
    if not path.exists():continue
    gif=Image.open(path);dur=[]
    for i in range(gif.n_frames):
        gif.seek(i);dur.append(gif.info['duration'])
        decoded=gif.convert('RGB')
        gif_board.paste(decoded.resize((192,192),Image.Resampling.NEAREST),(i*208+8,row*222+22))
        gd.text((i*208+8,row*222+5),f'{name} {i+1} {dur[-1]}ms',fill=(238,238,238))
    enc[name]={'frame_count':gif.n_frames,'durations_ms':dur,'gif_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
gif_board.save(R/'previews'/'gif-decoded.png')
(R/'previews'/'gif-report.json').write_text(json.dumps(enc,indent=2)+'\n')
# 3x3 native base sheet plus 3x3 native action sheet.
for outname,names in [('poses-sheet',NAMES[:9]),('actions-sheet',NAMES[9:])]:
    sheet=Image.new('RGBA',(288,288))
    for i,n in enumerate(names):sheet.alpha_composite(ims[n],(i%3*96,i//3*96))
    sheet.save(R/'previews'/(outname+'.png'))
