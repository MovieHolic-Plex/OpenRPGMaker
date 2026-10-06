"""Read literal grids and render losslessly. Enlargements are diagnostics only."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
import json, hashlib
ROOT=Path(__file__).resolve().parent
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ORDER=POSES+ACTIONS
CLIPS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_b'],[240,260,110,180,200,240]),
'hit':(['idle_a','hit','recover','idle_a'],[280,220,180,300]),
'dead':(['idle_a','hit','dead'],[240,160,1000]),
'skill':(['skill_a','skill_b','skill_c','idle_a'],[380,260,300,240]),
'poison':(['poison_a','poison_b'],[430,430]),
'stun':(['stun_a','stun_b'],[480,480]),
'sleep':(['sleep_a','sleep_b'],[700,700])}
def main():
    colors=json.loads((ROOT/'palette.json').read_text())
    rgb={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in colors.items()}
    out=ROOT/'previews';out.mkdir(exist_ok=True)
    imgs={};summary={};grids={}
    symbols=['.']+list(colors)
    indexed={c:i for i,c in enumerate(symbols)}
    gif_palette=[0,0,0]+[v for c in colors for v in rgb[c][:3]]
    gif_palette+=[0]*(768-len(gif_palette))
    for name in ORDER:
        p=ROOT/('poses' if name in POSES else 'actions')/(name+'.pxgrid')
        if not p.exists():continue
        rows=p.read_text().splitlines()
        if len(rows)!=128 or any(len(row)!=128 for row in rows):raise ValueError(name+' dimensions')
        grids[name]=rows
        im=Image.new('RGBA',(128,128));im.putdata([rgb[c] if c!='.' else (0,0,0,0) for row in rows for c in row])
        im.save(out/(name+'.png'));imgs[name]=im
        summary[name]={'bbox':im.getbbox(),'gridSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'pngSha256':hashlib.sha256((out/(name+'.png')).read_bytes()).hexdigest()}
    for bgname in ['dark','light','checker']:
        sheet=Image.new('RGB',(3*394,6*414),'#1D2636' if bgname=='dark' else '#EEE7DA')
        draw=ImageDraw.Draw(sheet)
        for i,(name,im) in enumerate(imgs.items()):
            x=(i%3)*394;y=(i//3)*414
            if bgname=='checker':
                for yy in range(0,384,16):
                    for xx in range(0,384,16):draw.rectangle((x+xx,y+yy+22,x+xx+15,y+yy+37),fill='#384454' if (xx//16+yy//16)%2 else '#647084')
            draw.text((x+4,y+4),name,fill='white' if bgname!='light' else 'black')
            big=im.resize((384,384),Image.Resampling.NEAREST);sheet.paste(big,(x,y+22),big)
        sheet.save(out/(bgname+'-3x.png'))
    native=Image.new('RGB',(6*144,3*150),'#C6BFAE');d=ImageDraw.Draw(native)
    for i,(name,im) in enumerate(imgs.items()):
        x=(i%6)*144;y=(i//6)*150;d.text((x+2,y+2),name,fill='#18232B');native.paste(im,(x,y+18),im)
    native.save(out/'native-1x.png')
    for name,(seq,holds) in CLIPS.items():
        if not all(k in imgs for k in seq):continue
        frames=[]
        for k in seq:
            frame=Image.new('P',(128,128));frame.putpalette(gif_palette)
            frame.putdata([indexed[c] for row in grids[k] for c in row]);frames.append(frame)
        frames[0].save(out/(name+'.gif'),save_all=True,append_images=frames[1:],duration=holds,loop=0,disposal=2,transparency=0,background=0,optimize=False)
    for sheetname,seq in [('battle-sheet',POSES),('actions-sheet',ACTIONS)]:
        if all(k in imgs for k in seq):
            sheet=Image.new('RGBA',(384,384))
            for i,k in enumerate(seq):sheet.paste(imgs[k],((i%3)*128,(i//3)*128))
            sheet.save(out/(sheetname+'.png'))
    contacts=Image.new('RGB',(864,1200),'#C6BFAE');d=ImageDraw.Draw(contacts)
    gif_info={}
    for row,clip in enumerate(CLIPS):
        path=out/(clip+'.gif')
        if not path.exists():continue
        frames=[];holds=[]
        with Image.open(path) as gif:
            for f in ImageSequence.Iterator(gif):
                rgba=f.convert('RGBA')
                bg=Image.new('RGBA',(128,128),'#C6BFAE');bg.alpha_composite(rgba)
                frames.append(bg.convert('RGB'));holds.append(f.info.get('duration'))
        seqsheet=Image.new('RGB',(len(frames)*144,150),'#C6BFAE');sd=ImageDraw.Draw(seqsheet)
        for i,f in enumerate(frames):
            seqsheet.paste(f,(144*i,20));sd.text((144*i+2,3),f'{clip} {i} {holds[i]}ms',fill='#18232B')
            contacts.paste(f,(144*i,row*150+20));d.text((144*i+2,row*150+3),f'{clip} {i} {holds[i]}ms',fill='#18232B')
        seqsheet.save(out/(clip+'-decoded-1x.png'))
        gif_info[clip]={'sequence':CLIPS[clip][0],'decodedFrames':len(frames),'decodedHoldsMs':holds,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    contacts.save(out/'eight-gifs-decoded-1x.png')
    (out/'gif-decoding.json').write_text(json.dumps(gif_info,indent=2)+'\n')
    (out/'pixels.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
