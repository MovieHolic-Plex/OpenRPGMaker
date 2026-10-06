"""Read literal grids and render PNG/GIF diagnostics. Does not author any sprite pixels."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,180,100,140,200,240]),
'hit':(['idle_a','hit','recover','idle_a'],[300,240,200,300]),
'dead':(['idle_a','hit','dead'],[240,160,1000]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,350,180,280,240]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[480,480]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
def main():
    palette=json.loads((ROOT/'palette.json').read_text())
    rgba={s:tuple(bytes.fromhex(h[1:]))+(255,) for s,h in palette.items()}
    imgs={}
    report={}
    for name in ORDER:
        kind='poses' if ORDER.index(name)<9 else 'actions'
        path=ROOT/kind/(name+'.pxgrid')
        if not path.exists(): continue
        rows=path.read_text().splitlines()
        if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError((name,'dimensions'))
        im=Image.new('RGBA',(64,64))
        for y,row in enumerate(rows):
            for x,s in enumerate(row):
                if s!='.': im.putpixel((x,y),rgba[s])
        bbox=im.getbbox()
        if bbox[0]<1 or bbox[1]<1 or bbox[2]>63 or bbox[3]>61: raise ValueError((name,'margin',bbox))
        if name=='idle_a' and bbox[3]!=61: raise ValueError('idle ground')
        report[name]={'ink_bbox':bbox,'ink_pixels':sum(s!='.' for r in rows for s in r)}
        imgs[name]=im
        im.save(ROOT/'previews'/(name+'.png'))
    native=Image.new('RGBA',(192,384))
    for idx,name in enumerate(ORDER):
        if name in imgs: native.alpha_composite(imgs[name],((idx%3)*64,(idx//3)*64))
    native.save(ROOT/'previews'/'sheet.png')
    for label,bg in [('light','#ece6d8'),('dark','#222b30'),('checker',None)]:
        sheet=Image.new('RGB',(3*272,6*286),bg or '#b4b6b0')
        draw=ImageDraw.Draw(sheet)
        for idx,name in enumerate(ORDER):
            if name not in imgs: continue
            ox,oy=(idx%3)*272,(idx//3)*286
            if bg is None:
                for cy in range(0,256,16):
                    for cx in range(0,256,16):
                        draw.rectangle((ox+8+cx,oy+22+cy,ox+23+cx,oy+37+cy),fill='#d7d8d1' if (cx//16+cy//16)%2 else '#a5aaa5')
            draw.text((ox+8,oy+4),name,fill='#f2e9dc' if label=='dark' else '#26292b')
            sheet.paste(imgs[name].resize((256,256),Image.Resampling.NEAREST),(ox+8,oy+22),imgs[name].resize((256,256),Image.Resampling.NEAREST))
        sheet.save(ROOT/'previews'/('contact-'+label+'.png'))
    # GIF has the exact authored palette, transparent index 0; no quantization.
    palbytes=[0,0,0]+[c for s in palette for c in bytes.fromhex(palette[s][1:])]
    palbytes += [0]*(768-len(palbytes))
    indices={s:i+1 for i,s in enumerate(palette)}
    for motion,(names,holds) in MOTIONS.items():
        if not all(n in imgs for n in names): continue
        frames=[]
        for name in names:
            kind='poses' if ORDER.index(name)<9 else 'actions'
            rows=(ROOT/kind/(name+'.pxgrid')).read_text().splitlines()
            frame=Image.new('P',(64,64),0);frame.putpalette(palbytes)
            frame.putdata([indices.get(s,0) for row in rows for s in row]);frames.append(frame)
        frames[0].save(ROOT/'gifs'/(motion+'.gif'),save_all=True,append_images=frames[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
        reread=Image.open(ROOT/'gifs'/(motion+'.gif'))
        for idx,name in enumerate(names):
            reread.seek(idx)
            if reread.convert('RGBA').tobytes()!=imgs[name].tobytes(): raise ValueError((motion,idx,'GIF pixels'))
            if reread.info['duration']!=holds[idx]: raise ValueError((motion,idx,'GIF timing'))
    (ROOT/'previews'/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'Rendered {len(imgs)} native frames.')
if __name__=='__main__':main()
