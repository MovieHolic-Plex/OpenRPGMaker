#!/usr/bin/env python3
"""Paint and export fresh source cells; review enlargement alone uses NEAREST."""
from pathlib import Path
import importlib.util, json, sys, math, hashlib
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
KEEP = {'hydra-three','kappa-01','wolf-grey','bat-cave','skeleton-knight'}
BG = '#202c39'

def module(group):
    sys.path.insert(0, str(HERE))
    spec = importlib.util.spec_from_file_location('redraw_'+group,HERE/(group+'.py'))
    m = importlib.util.module_from_spec(spec); sys.modules[spec.name]=m
    spec.loader.exec_module(m)
    return m

def board(frames,cell):
    pitch=cell*3
    out=Image.new('RGB',(pitch*3,(pitch+18)*3),BG); d=ImageDraw.Draw(out)
    for i,im in enumerate(frames):
        b=Image.new('RGBA',im.size,BG);b.alpha_composite(im)
        x=i%3*pitch;y=i//3*(pitch+18)
        out.paste(b.convert('RGB').resize((pitch,pitch),Image.Resampling.NEAREST),(x,y))
        d.text((x+4,y+pitch+3),POSES[i],fill='#e6e6d8')
    return out

def export(group):
    entries=[e for e in json.loads((HERE/'manifest.json').read_text()) if e['group']==group and e['slug'] not in KEEP]
    art=module(group); reports=[];cards=[]
    qa=ROOT/'verify-shots/monster-redraw-all'/group;qa.mkdir(parents=True,exist_ok=True)
    for e in entries:
        slug,cell=e['slug'],e['cell'];frames=[art.draw(slug,p,cell) for p in POSES]
        hashes=[]; boxes=[];sheet=Image.new('RGBA',(cell*3,cell*3))
        for i,f in enumerate(frames):
            assert f.mode=='RGBA' and f.size==(cell,cell),(slug,POSES[i],f.mode,f.size)
            b=f.getbbox();assert b and b[0]>0 and b[1]>0 and b[2]<cell and b[3]<=cell-3,(slug,POSES[i],b)
            boxes.append(b);hashes.append(hashlib.sha256(f.tobytes()).hexdigest())
            sheet.alpha_composite(f,(i%3*cell,i//3*cell))
        assert len(set(hashes))==9,(slug,'duplicate pose')
        colors={c for n,c in sheet.getcolors(cell*cell*9) if c[3]}
        assert len(colors)<=32 and set(sheet.getchannel('A').tobytes())=={0,255},(slug,'palette',len(colors))
        target=ROOT/'public'/e['path'];target.parent.mkdir(parents=True,exist_ok=True);sheet.save(target)
        portrait=ROOT/'public/assets/generated/pixel-enemy-portraits'/(slug+'.png');portrait.parent.mkdir(parents=True,exist_ok=True);frames[0].save(portrait)
        for file,expected in ((target,sheet),(portrait,frames[0])):
            with Image.open(file) as reloaded:assert reloaded.convert('RGBA').tobytes()==expected.tobytes()
        raw=ROOT/'tiledata/monster-refresh'/slug;raw.mkdir(parents=True,exist_ok=True)
        for p,f in zip(POSES,frames):f.save(raw/(p+'.png'))
        board(frames,cell).save(qa/(slug+'-poses.png'))
        timeline=[0,1,2,1,3,4,5,6,0,7,8];cycle=[]
        for i in timeline:
            b=Image.new('RGBA',frames[i].size,BG);b.alpha_composite(frames[i])
            cycle.append(b.convert('RGB').resize((cell*3,cell*3),Image.Resampling.NEAREST))
        cycle[0].save(qa/(slug+'-cycle.gif'),save_all=True,append_images=cycle[1:],duration=[180]*4+[300,200,380,260,180,420,1000],loop=0,disposal=2,optimize=False)
        reports.append(dict(slug=slug,cell=cell,colors=len(colors),sheetSha256=hashlib.sha256(target.read_bytes()).hexdigest(),portraitSha256=hashlib.sha256(portrait.read_bytes()).hexdigest(),frames={p:dict(bbox=b,sha256=h) for p,b,h in zip(POSES,boxes,hashes)}))
        cards.append((slug,frames[0],frames[5]));print(slug,cell,len(colors),flush=True)
    for page in range(0,len(cards),12):
        batch=cards[page:page+12];rows=math.ceil(len(batch)/3)
        contact=Image.new('RGB',(3*300,rows*228),BG);d=ImageDraw.Draw(contact)
        for j,(slug,idle,attack) in enumerate(batch):
            for k,im in enumerate((idle,attack)):
                scale=2 if im.width==64 else 1
                b=Image.new('RGBA',im.size,BG);b.alpha_composite(im)
                x=j%3*300+k*144+(144-im.width*scale)//2;y=j//3*228+154-im.height*scale
                contact.paste(b.convert('RGB').resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST),(x,y))
            d.text((j%3*300+6,j//3*228+175),slug,fill='#e6e6d8')
            d.text((j%3*300+25,j//3*228+200),'idle                  attack',fill='#98acae')
        contact.save(qa/('contact-'+str(page//12+1)+'.png'))
    (qa/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
    descriptions=getattr(art,'DESCRIPTIONS',{})
    (HERE/(group+'-descriptions.json')).write_text(json.dumps(descriptions,ensure_ascii=False,indent=2)+'\n')
    return reports

if __name__=='__main__':
    export(sys.argv[1])
