"""Decode authored indices, bake native PNG/GIF and nearest-neighbor diagnostics."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
frames={}
for folder in ('poses','actions'):
    for path in sorted((ROOT/folder).glob('*.pxgrid')):
        rows=path.read_text().splitlines()
        assert len(rows)==96 and all(len(r)==96 for r in rows),path
        assert set(''.join(rows))<=set(pal)|{'.'},path
        assert all(c=='.' for c in rows[0]+rows[-1]),path
        assert all(r[0]==r[-1]=='.' for r in rows),path
        assert all(c=='.' for r in rows[93:] for c in r),path
        im=Image.new('RGBA',(96,96))
        im.putdata([colors.get(c,(0,0,0,0)) for r in rows for c in r])
        im.save(ROOT/'previews'/(path.stem+'.png'))
        frames[path.stem]=im
names=list(frames)
for bgname,bg in [('light',(233,227,207)),('dark',(24,31,40)),('checker',None)]:
    sheet=Image.new('RGB',(6*300,((len(names)+5)//6)*326),(40,44,49))
    draw=ImageDraw.Draw(sheet)
    for n,name in enumerate(names):
        cell=Image.new('RGB',(96,96),bg or (150,160,165))
        if bg is None:
            pix=cell.load()
            for y in range(96):
                for x in range(96): pix[x,y]=(150,160,165) if (x//8+y//8)%2==0 else (205,212,211)
        cell.paste(frames[name],mask=frames[name])
        x,y=(n%6)*300,(n//6)*326
        sheet.paste(cell.resize((288,288),Image.Resampling.NEAREST),(x+6,y+26))
        draw.text((x+6,y+6),name,fill=(240,240,220))
    sheet.save(ROOT/'previews'/('sheet-'+bgname+'.png'))
# 1x sheet, explicitly diagnostic backgrounds only.
native=Image.new('RGB',(6*110,((len(names)+5)//6)*122),(70,78,83))
nd=ImageDraw.Draw(native)
for n,name in enumerate(names):
    x,y=(n%6)*110,(n//6)*122
    native.paste(frames[name],(x+7,y+20),frames[name]);nd.text((x+2,y+4),name,fill='white')
native.save(ROOT/'previews'/'sheet-native.png')
if len(frames)==18:
    # fixed palette, transparent index 0, no color quantization.
    cmap={c:i+1 for i,c in enumerate(pal)}
    rgb=[0,0,0]+[v for c in pal for v in colors[c][:3]]
    rgb+= [0]*(768-len(rgb))
    indexed={}
    for name in names:
        path=ROOT/('poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions')/(name+'.pxgrid')
        im=Image.new('P',(96,96));im.putpalette(rgb)
        im.putdata([cmap.get(c,0) for c in path.read_text().replace('\n','')])
        im.info['transparency']=0;indexed[name]=im
    motions={
        'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
        'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,260,130,180,240,240]),
        'hit':(['idle_a','hit','recover','idle_a'],[240,220,220,240]),
        'dead':(['idle_a','hit','dead'],[240,180,900]),
        'skill':(['skill_a','skill_b','skill_c','idle_a'],[350,260,320,240]),
        'poison':(['poison_a','poison_b'],[420,420]),
        'stun':(['stun_a','stun_b'],[420,420]),
        'sleep':(['sleep_a','sleep_b'],[600,600]),
    }
    for name,(seq,times) in motions.items():
        ims=[indexed[n] for n in seq]
        ims[0].save(ROOT/'previews'/(name+'.gif'),save_all=True,append_images=ims[1:],duration=times,loop=0,transparency=0,disposal=2,optimize=False)
    (ROOT/'previews'/'motion-timing.json').write_text(json.dumps(motions,indent=2)+'\n')
print(f'{len(frames)} literal native frames rendered; PNG sheets in previews/')

if len(frames)==18:
    base_order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
    action_order=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
    for out,order in [('poses',base_order),('actions',action_order)]:
        sheet=Image.new('RGBA',(288,288))
        for n,name in enumerate(order): sheet.paste(frames[name],((n%3)*96,(n//3)*96))
        sheet.save(ROOT/'previews'/(out+'.png'))
    import hashlib
    report={'paletteColors':len(pal),'cell':[96,96],'frames':{},'gifs':{}}
    for name in base_order+action_order:
        folder='poses' if name in base_order else 'actions'
        path=ROOT/folder/(name+'.pxgrid')
        im=frames[name];bounds=im.getbbox()
        report['frames'][name]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pngSha256':hashlib.sha256((ROOT/'previews'/(name+'.png')).read_bytes()).hexdigest(),'bboxExclusive':bounds,'lowestInkY':bounds[3]-1}
    # Decode the actual exported GIFs, compare every pixel and every hold.
    for name,(seq,times) in motions.items():
        gif=Image.open(ROOT/'previews'/(name+'.gif'))
        assert gif.n_frames==len(seq),(name,gif.n_frames,len(seq))
        contact=Image.new('RGB',(len(seq)*202,224),(230,224,205))
        cd=ImageDraw.Draw(contact)
        holds=[]
        for n,(pose,ms) in enumerate(zip(seq,times)):
            gif.seek(n);actual=gif.convert('RGBA')
            assert actual.tobytes()==frames[pose].tobytes(),(name,n,pose)
            assert gif.info['duration']==ms,(name,n)
            holds.append(gif.info['duration'])
            cell=Image.new('RGB',(96,96),(230,224,205));cell.paste(actual,mask=actual)
            contact.paste(cell.resize((192,192),Image.Resampling.NEAREST),(n*202+5,26))
            cd.text((n*202+5,6),pose+' '+str(ms)+'ms',fill='black')
        contact.save(ROOT/'previews'/('motion-'+name+'.png'))
        report['gifs'][name]={'decodedFrames':gif.n_frames,'holdsMs':holds,'rgbaMatchesSource':True,'sha256':hashlib.sha256((ROOT/'previews'/(name+'.gif')).read_bytes()).hexdigest()}
    # Explicit frame differences document breathing and status variations.
    pairs=[('idle_a','idle_b'),('idle_b','idle_c'),('poison_a','poison_b'),('stun_a','stun_b'),('sleep_a','sleep_b')]
    report['differentPixels']={a+'/'+b:sum(p!=q for p,q in zip(frames[a].getdata(),frames[b].getdata())) for a,b in pairs}
    (ROOT/'previews'/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('8 GIFs decoded: pixel colors, transparency and holds match the literal sources.')
