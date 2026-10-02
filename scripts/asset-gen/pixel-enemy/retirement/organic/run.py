"""Rebuild 34 originals and lossless visual-review evidence (Python + Pillow).
Run from any cwd: python3 scripts/asset-gen/pixel-enemy/retirement/organic/run.py
No user databases or network sources are accessed.
"""
import sys, json, hashlib, time
from pathlib import Path
sys.dont_write_bytecode=True
from PIL import Image, ImageDraw
from draw import CELL, MAP, AIR, draw, NAMES
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'public/assets/generated/pixel-enemies'
QA=ROOT/'verify-shots/legacy-monsters/organic'
BG='#202840'

def board(frames,cols=3,labels=True):
    rows=(len(frames)+cols-1)//cols
    im=Image.new('RGB',(CELL*2*cols,CELL*2*rows),BG)
    for i,f in enumerate(frames):
        c=Image.new('RGBA',(CELL,CELL),BG); c.alpha_composite(f)
        x=i%cols*CELL*2; y=i//cols*CELL*2
        im.paste(c.convert('RGB').resize((CELL*2,CELL*2),Image.Resampling.NEAREST),(x,y))
        d=ImageDraw.Draw(im); d.line((x,y,x,y+CELL*2),fill='#445069')
        if labels: d.text((x+4,y+4),NAMES[i],fill='#d6cddc')
    return im

def main():
    started=time.monotonic(); OUT.mkdir(parents=True,exist_ok=True); QA.mkdir(parents=True,exist_ok=True)
    species=json.loads((HERE/'species.json').read_text()); catalogs=[]; reports=[]; idle=[]
    assert set(MAP)=={x['slug'] for x in species}
    for entry in species:
        slug=entry['slug']; frames=[draw(slug,n).im for n in range(9)]
        sheet=Image.new('RGBA',(CELL*3,CELL*3))
        for i,f in enumerate(frames): sheet.alpha_composite(f,(i%3*CELL,i//3*CELL))
        path=OUT/(slug+'.png'); sheet.save(path)
        with Image.open(path) as reloaded: assert reloaded.convert('RGBA').tobytes()==sheet.tobytes()
        colors={c for count,c in sheet.getcolors(CELL*CELL*9) if c[3]}; alpha=sorted(set(sheet.getchannel('A').tobytes()))
        assert len(colors)<=16 and alpha==[0,255],(slug,len(colors),alpha)
        hashes=[hashlib.sha256(f.tobytes()).hexdigest() for f in frames]
        assert len(set(hashes))==9,(slug,'duplicate pose')
        diffs=[]
        for i,a in enumerate(frames):
            for j in range(i+1,9):
                b=frames[j]; diffs.append((sum(pa!=pb for pa,pb in zip(a.get_flattened_data(),b.get_flattened_data())),NAMES[i],NAMES[j]))
        bboxes=[list(f.getbbox()) for f in frames]
        errors=[]
        for n,b in zip(NAMES,bboxes):
            if b[0]<1 or b[1]<1 or b[2]>CELL-1 or b[3]>CELL-3: errors.append(f'{n}:margin {b}')
            if (slug not in AIR or n=='dead') and b[3]!=CELL-3: errors.append(f'{n}:baseline {b[3]-1}')
        if min(diffs)[0]<12: errors.append(f'small pose delta {min(diffs)}')
        report=dict(slug=slug,cell=CELL,colors=len(colors),alpha=alpha,baseline=CELL-4,airborne=slug in AIR,
                    hash=hashlib.sha256(path.read_bytes()).hexdigest(),uniqueFrames=9,minPairDiff=min(diffs),
                    frames={n:dict(bbox=b,sha256=h) for n,b,h in zip(NAMES,bboxes,hashes)},errors=errors)
        reports.append(report); board(frames).save(QA/(slug+'-poses.png'))
        idle.append(frames[0])
        # exact 2x cycle retained as animated review; includes all 9 poses.
        sequence=[0,1,2,1,0,1,2,1,3,4,5,6,7,8]
        cycle=[board([frames[i]],1,False) for i in sequence]
        durations=[180]*8+[320,200,360,240,400,1000]
        gifpath=QA/(slug+'-cycle.gif')
        cycle[0].save(gifpath,save_all=True,append_images=cycle[1:],duration=durations,loop=0,disposal=2,optimize=False)
        expected=[]
        for im,ms in zip(cycle,durations): expected.extend([im.tobytes()]*(ms//10))
        actual=[]
        with Image.open(gifpath) as gif:
            for i in range(gif.n_frames):
                gif.seek(i); actual.extend([gif.convert('RGB').tobytes()]*(gif.info['duration']//10))
        assert actual==expected,(slug,'GIF timing/pixels')
        report['cycle']=dict(milliseconds=sum(durations),pixelTimingReload=True,scale=2)
        catalogs.append(dict(resourceId=entry['resourceId'],path='assets/generated/pixel-enemies/'+slug+'.png',cell=CELL,motion='stomp' if slug=='ape-stone' else 'swoop' if slug in {'bat-cave','bird-hawk','moth-dust'} else 'float' if slug in AIR else 'dash',idleFrameMs=180))
        print(slug,report['colors'],'colors',report['minPairDiff'][0],'min pixels',errors)
    # 8 species per all-pose page, all 288 frames displayed at exact integer 2x.
    for page in range((len(species)+7)//8):
        gallery=Image.new('RGB',(9*CELL*2+125,len(species[page*8:page*8+8])*(CELL*2+18)),BG); gd=ImageDraw.Draw(gallery)
        for row,entry in enumerate(species[page*8:page*8+8]):
            y=row*(CELL*2+18); gd.text((4,y+8),entry['slug'],fill='#d6cddc')
            frames=[draw(entry['slug'],n).im for n in range(9)]
            gallery.paste(board(frames,9),(125,y+18))
        gallery.save(QA/f'all-poses-{page+1}.png')
    contact=Image.new('RGB',(8*CELL*2,((len(species)+7)//8)*(CELL*2+20)),BG); cd=ImageDraw.Draw(contact)
    for i,(entry,f) in enumerate(zip(species,idle)):
        x=i%8*CELL*2; y=i//8*(CELL*2+20)
        contact.paste(board([f],1,False),(x,y+20)); cd.text((x+3,y+3),entry['slug'],fill='#d6cddc')
    contact.save(QA/'idle-contact.png')
    (HERE/'catalog.json').write_text(json.dumps(catalogs,ensure_ascii=False,indent=2)+'\n')
    validation=dict(species=len(species),frames=len(species)*9,elapsedSeconds=round(time.monotonic()-started,2),reports=reports)
    (QA/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
    assert not any(r['errors'] for r in reports),'See validation.json for drawing issues'
if __name__=='__main__': main()
