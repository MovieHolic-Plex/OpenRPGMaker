#!/usr/bin/env python3
"""Generate/reload original sheets and lossless all-species review evidence."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import json,hashlib,itertools
from PIL import Image,ImageDraw
from common import NAMES
import slimes,spirits,figures,creatures,objects
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
QA=ROOT/'verify-shots/legacy-monsters/arcane'
DATA=json.loads((HERE/'species.json').read_text())
AIR=set(spirits.GHOSTS)|{'ontology-8da61312','sylph-hornet-transparent','sword-flying','puppet-string','skeleton-bone','spirit-earth'}
BIG={'plant-01','lemora-01','revenant-vengeful','bonepile-crawler','ontology-8da61312','scarecrow-field','puppet-string','totem-cursed','golem-stone','golem-clay','golem-crystal','spirit-earth'}
def render(slug,n):
    if slug in slimes.PALS:return slimes.draw(slug,n)
    if slug in spirits.GHOSTS:return spirits.draw(slug,n)
    if slug in {'skeleton-01','skeleton-bone','revenant-vengeful','ghoul-01','ghoul-grave','bonepile-crawler'}:return figures.draw(slug,n)
    if slug.startswith('golem-'):return objects.golem(slug,n)
    fn={'sylph-hornet-transparent':creatures.hornet,'carbuncle-01':creatures.fox,'plant-01':creatures.plant,'lemora-01':creatures.serpent,
        'ontology-8da61312':objects.rune,'jackolantern-01':objects.pumpkin,'sword-flying':objects.blade,'scarecrow-field':objects.scarecrow,'puppet-string':objects.puppet,'totem-cursed':objects.totem,'spirit-earth':objects.earth}[slug]
    return fn(n)
def display(im):
    bg=Image.new('RGBA',im.size,'#202840');bg.alpha_composite(im)
    return bg.convert('RGB').resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
def main():
    QA.mkdir(parents=True,exist_ok=True);catalog=[];report=[];boards=[];errors=[]
    contact=Image.new('RGB',(8*150,5*158),'#202840');cd=ImageDraw.Draw(contact)
    for i,item in enumerate(DATA):
        slug=item['slug'];cell=64 if slug in BIG else 48
        frames=[render(slug,n).im for n in NAMES]
        assert all(f.size==(cell,cell) for f in frames),slug
        sheet=Image.new('RGBA',(cell*3,cell*3))
        stats={};hashes=[];normalized=[]
        for j,(n,f) in enumerate(zip(NAMES,frames)):
            sheet.paste(f,(j%3*cell,j//3*cell));box=f.getbbox();h=hashlib.sha256(f.tobytes()).hexdigest();hashes.append(h);nh=hashlib.sha256(f.crop(box).tobytes()).hexdigest();normalized.append(nh)
            if not box or not (box[0]>0 and box[1]>0 and box[2]<cell and box[3]<=cell-3):errors.append([slug,n,'bounds',box])
            stats[n]={'bbox':box,'sha256':h,'occupiedBoundsSha256':nh,'opaquePixels':sum(1 for a in f.getchannel('A').tobytes() if a)}
        unique=len(set(hashes))
        if unique!=9:errors.append([slug,'distinct frames',unique])
        if len(set(normalized))!=9:errors.append([slug,'translation-only duplicate frames'])
        colors={c for _,c in sheet.getcolors(cell*cell*9) if c[3]}
        alphas=sorted(set(sheet.getchannel('A').tobytes()))
        if len(colors)>16 or alphas!=[0,255]:errors.append([slug,'palette/alpha',len(colors),alphas])
        out=ROOT/f'public/assets/generated/pixel-enemies/{slug}.png';out.parent.mkdir(parents=True,exist_ok=True);sheet.save(out)
        with Image.open(out) as saved:assert saved.convert('RGBA').tobytes()==sheet.tobytes()
        sh=hashlib.sha256(out.read_bytes()).hexdigest()
        report.append({'slug':slug,'cell':cell,'colors':len(colors),'alpha':alphas,'uniqueFrames':unique,'uniqueOccupiedBoundsFrames':len(set(normalized)),'sheetSha256':sh,'frames':stats})
        catalog.append({'resourceId':item['resourceId'],'path':f'assets/generated/pixel-enemies/{slug}.png','cell':cell,'motion':{'sylph-hornet-transparent':'swoop','carbuncle-01':'dash','bonepile-crawler':'dash','lemora-01':'breath'}.get(slug,'float' if slug in AIR else 'hop' if slug in slimes.PALS else 'stomp'),'idleFrameMs':180})
        board=display(sheet);bd=ImageDraw.Draw(board)
        for j,n in enumerate(NAMES):
            x=j%3*cell*2;y=j//3*cell*2
            bd.line([(x,y),(x+cell*2-1,y)],fill='#68748e');bd.line([(x,y),(x,y+cell*2-1)],fill='#68748e');bd.text((x+3,y+3),n,fill='#dbe1ec')
            bd.line([(x+1,y+(cell-3)*2),(x+cell*2-2,y+(cell-3)*2)],fill='#39465e')
        board.save(QA/f'{slug}-poses.png');boards.append(board)
        # Full-cell placement, all silhouettes at exact same two-fold scale.
        x=i%8*150;y=i//8*158
        contact.paste(display(frames[0]),(x+(150-cell*2)//2,y+20+128-cell*2));cd.text((x+3,y+3),slug,fill='#dbe1ec')
        seq=[0,1,2,1,0,1,2,1,3,4,5,6,7,8];ms=[180]*8+[320,220,360,260,420,1200]
        gif=[display(frames[j]) for j in seq]
        gif[0].save(QA/f'{slug}-cycle.gif',save_all=True,append_images=gif[1:],duration=ms,loop=0,disposal=2,optimize=False)
        with Image.open(QA/f'{slug}-cycle.gif') as g:
            assert g.n_frames==len(seq),slug
            for j,expected in enumerate(gif):
                g.seek(j);assert g.convert('RGB').tobytes()==expected.tobytes(),(slug,j,'GIF lossless');assert g.info['duration']==ms[j]
    contact.save(QA/'idle-contact.png')
    # Six species per paginated board; every frame visible at 2x, no resizing.
    for page in range((len(boards)+5)//6):
        atlas=Image.new('RGB',(3*394,2*410),'#202840');d=ImageDraw.Draw(atlas)
        for slot,board in enumerate(boards[page*6:page*6+6]):
            x=slot%3*394;y=slot//3*410;idx=page*6+slot
            d.text((x+4,y+3),DATA[idx]['slug'],fill='#f1e3b0');atlas.paste(board,(x+(394-board.width)//2,y+22))
        atlas.save(QA/f'pose-review-{page+1:02d}.png')
    (HERE/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
    (QA/'validation.json').write_text(json.dumps({'species':len(DATA),'errors':errors,'results':report},indent=2)+'\n')
    print(json.dumps({'species':len(DATA),'frames':len(DATA)*9,'errors':errors,'maxColors':max(x['colors'] for x in report)}))
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
