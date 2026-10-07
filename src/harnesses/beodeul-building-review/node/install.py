"""Install the buildings a human ALLOWED into the shared bundle as tileset `beodeul_reviewed`.

Reads only the committed decision log (harness-data/.../decisions.json): the latest decision per (candidate, picture sha)
must be Allow, and the picture file must still hash to that sha. Nothing else is installed. Sources are copied into
tiledata/beodeul-reviewed/sources/ so the installer reruns from the repository alone.

Output (all derived, rerunnable): public/assets/beodeul-reviewed/chipset.png, src/assets/beodeulReviewedCatalog.json,
tiledata/beodeul-reviewed/{catalog.json,inspection.json,gallery.png}.
Kit layout is the beodeul_forms convention: body on layer 3, ground shadow layer 2, foundation layer 4, same origin.
Passability: wall cells block (door cell included); roof/overhang cells stay walkable. Wall cells are found per 16px cell by
the share of light plaster/stone colour, forced contiguous up from each column's ground row; log houses use their fixed
wall band. The entrance cell and every bottom-row cell are forced solid; the cell south of the door is outside the kit.
"""
import json, hashlib, os, shutil, sqlite3, sys, colorsys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from profiles import load_profile

ROOT=Path(__file__).resolve().parents[4]
P=load_profile(sys.argv[sys.argv.index('--profile')+1] if '--profile' in sys.argv else None)
B=P['bundle']
SOURCE=ROOT/P['seedDir'];DATA=P['data']
TILEDATA=ROOT/B['tiledata'];SRC=TILEDATA/'sources'
OUT=ROOT/B['publicDir']
CATALOG=ROOT/B['catalog']
IDS=B['ids']
def digest(b):return hashlib.sha256(b).hexdigest()
def round_of(item):
    head=item.split('-')[0];return int(head[1:]) if head[:1]=='r' and head[1:].isdigit() else 0
def kit_id(item):return item.replace('-building-','-')  # r2-building-01 -> r2-01
def candidate_meta(item):
    """Metadata of a candidate: the seed (gate profiles), the review DB (imported profiles) or the committed sources.json."""
    seed=SOURCE/'seed.json'
    if seed.exists():
        found={c['id']:c for c in json.loads(seed.read_text())['candidates']}.get(item)
        if found:return found
    db=DATA/'review.sqlite'
    if db.exists():
        c=sqlite3.connect(db);row=c.execute('select meta from candidates where id=?',(item,)).fetchone();c.close()
        if row:return json.loads(row[0])
    old=json.loads((TILEDATA/'sources.json').read_text()) if (TILEDATA/'sources.json').exists() else {}
    return old.get(item)

def allowed():
    log=json.loads((SOURCE/'decisions.json').read_text())['log'];last={}
    for r in log:last[(r['item'],r['sha'])]=r
    # Rounds that were replaced keep their decision log; only ids still in the seed, or with a stored source, are installable.
    out=[]
    for (item,sha),r in sorted(last.items()):
        if r['decision']!='allow':continue
        # a later deny/pending on the same item with a DIFFERENT sha does not cancel this one, but the same sha does (handled by `last`)
        file=SRC/f'{item}.png';live=DATA/'items'/item/f'{sha}.png'
        if live.exists():raw=live.read_bytes()
        elif file.exists():raw=file.read_bytes()
        else:raise SystemExit(f'missing picture for {item} {sha}')
        if digest(raw)!=sha:raise SystemExit(f'{item}: picture no longer hashes to the allowed sha')
        SRC.mkdir(parents=True,exist_ok=True);file.write_bytes(raw)
        meta=candidate_meta(item)
        if meta is None:raise SystemExit(f'{item}: allowed but not in the seed, the review DB or sources.json')
        out.append((item,sha,meta,Image.open(file).convert('RGBA')))
    return out

def wall_mask(im,meta):
    h,w=im.height//16,im.width//16;a=np.array(im).astype(float)/255;alpha=a[...,3]
    opaque=np.array([[alpha[y*16:y*16+16,x*16:x*16+16].max()>0 for x in range(w)] for y in range(h)])
    mask=np.zeros((h,w),bool)
    if meta.get('material')=='log':
        start=2 if im.width==64 else 4
        mask[start:,:]=opaque[start:,:]
    else:
        mx=a[...,:3].max(-1);mn=a[...,:3].min(-1);sat=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
        light=(alpha>0)&(mx>0.62)&(sat<0.38)
        for y in range(h):
            for x in range(w):
                n=(alpha[y*16:y*16+16,x*16:x*16+16]>0).sum()
                if n and light[y*16:y*16+16,x*16:x*16+16].sum()/n>0.30:mask[y,x]=True
        for x in range(w):
            rows=[y for y in range(h) if opaque[y,x]]
            if not rows:continue
            bottom=max(rows);keep=np.zeros(h,bool);y=bottom
            while y>=0 and opaque[y,x] and mask[y,x]:keep[y]=True;y-=1
            keep[bottom]=True            # ground contact is always solid
            if bottom>0 and opaque[bottom-1,x]:keep[bottom-1]=True
            mask[:,x]=keep
    return mask&opaque,opaque

def ground_lines(mask):
    h,w=mask.shape;low=[max([y for y in range(h) if mask[y,x]],default=-1) for x in range(w)];lines=[];x=0
    while x<w:
        if low[x]<0:x+=1;continue
        x1=x
        while x1+1<w and low[x1+1]==low[x]:x1+=1
        lines.append([x,x1,low[x]]);x=x1+1
    return lines

def main():
    items=allowed();OUT.mkdir(parents=True,exist_ok=True);TILEDATA.mkdir(parents=True,exist_ok=True)
    cells=[];priorities=[];passes=[];index={};buildings=[];report=[]
    def pack(im,mask=None):
        grid=[]
        for y in range(im.height//16):
            row=[]
            for x in range(im.width//16):
                c=im.crop((x*16,y*16,x*16+16,y*16+16))
                if not c.getbbox():row.append(-1);continue
                blocked=bool(mask is not None and y<mask.shape[0] and x<mask.shape[1] and mask[y,x])
                key=(c.tobytes(),blocked)
                if key not in index:
                    index[key]=len(cells);cells.append(c);priorities.append('upper')
                    passes.append(dict(up=not blocked,down=not blocked,left=not blocked,right=not blocked))
                row.append(index[key])
            grid.append(row)
        return grid
    sources={}
    for item,sha,meta,im in items:
        w,h=im.width//16,im.height//16;mask,opaque=wall_mask(im,meta)
        e=meta['entrance'];dx,dy,ew,eh=e['x']//16,e['y']//16,max(1,e['w']//16),max(1,e['h']//16)
        for yy in range(dy,dy+eh):
            for xx in range(dx,dx+ew):
                assert opaque[yy,xx],f'{item}: entrance cell {xx},{yy} is empty';mask[yy,xx]=True
        for x in range(w):
            ys=[y for y in range(h) if opaque[y,x]]
            if ys:assert mask[max(ys),x],f'{item}: bottom cell {x},{max(ys)} not solid'
        lines=ground_lines(mask)
        shadow=Image.new('RGBA',((w+1)*16,(h+1)*16));foundation=Image.new('RGBA',shadow.size)
        ds=ImageDraw.Draw(shadow);df=ImageDraw.Draw(foundation)
        for x0,x1,y in lines:
            for xx in range(x0*16,(x1+1)*16):
                foot=(y+1)*16-1
                ds.line((xx,foot,xx+5,foot+4),fill=(44,51,28,44));ds.point((xx,foot),fill=(40,40,25,105))
                if xx%5!=0:df.point((xx,foot),fill='#8b7650');df.point((xx,foot+1),fill='#61703b')
                if xx%11==3:df.point((xx,foot+2),fill='#81983f')
        kid=kit_id(item)
        rows=pack(im,mask)
        buildings.append(dict(id=IDS['house']+kid,source=item,round=meta.get('round') or round_of(item),name=meta['name'],material=meta.get('material','plaster'),
            width=w,height=h,rows=rows,parts=[dict(id='door',kind='entrance',dx=dx,dy=dy,w=ew,h=eh)],sha256=sha,
            blocked=[[x,y] for y in range(h) for x in range(w) if mask[y,x]],groundLines=lines,
            shadowRows=pack(shadow),foundationRows=pack(foundation),
            perspective=dict(nativePixelScale=True,nativeRoofTop=True,sideRequired=False)))
        report.append(dict(id=item,kit=IDS['house']+kid,sha256=sha,size=[w,h],blockedCells=int(mask.sum()),overhangCells=int(opaque.sum()-mask.sum()),entrance=[dx,dy,ew,eh]))
        sources[item]={k:meta[k] for k in ('id','name','width','height','entrance','round','material') if k in meta}
        for suffix,pic in (('',im),('-shadow',shadow),('-foundation',foundation)):pic.save(TILEDATA/f'{kid}{suffix}.png')
    (TILEDATA/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=1)+'\n')
    count=(len(cells)+15)//16*16;sheet=Image.new('RGBA',(256,count))
    for n,c in enumerate(cells):sheet.paste(c,(n%16*16,n//16*16))
    sheet.save(OUT/'chipset.png')
    manifest=dict(id=B['tilesetId'],texture=B['texture'],tileSize=16,tilesPerRow=16,count=count,buildings=buildings,
        priority=priorities+['upper']*(count-len(cells)),passability=passes+[dict(up=True,down=True,left=True,right=True)]*(count-len(cells)))
    CATALOG.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n');(TILEDATA/'catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=1)+'\n')
    # gallery at 1x: shadow, body, foundation exactly as the game layers them
    cols=6;cw=max(b['width'] for b in buildings)*16+40;ch=max(b['height'] for b in buildings)*16+30;rowsN=(len(buildings)+cols-1)//cols
    board=Image.new('RGBA',(cols*cw,rowsN*ch),tuple(B['groundSurface'])+(255,));d=ImageDraw.Draw(board)
    for k,b in enumerate(buildings):
        kid=b['id'][len(IDS['house']):];x=k%cols*cw+16;y=k//cols*ch+8
        for suffix in ('-shadow','','-foundation'):board.alpha_composite(Image.open(TILEDATA/f'{kid}{suffix}.png').convert('RGBA'),(x,y))
        d.text((x,y+b['height']*16+10),kid,fill=(30,40,20,255))
    board.convert('RGB').quantize(128).save(OUT/'gallery.png',optimize=True)
    (TILEDATA/'inspection.json').write_text(json.dumps(dict(buildings=report,installed=len(buildings),tiles=len(cells),sheetTiles=count,
        decisionLog=str((SOURCE/'decisions.json').relative_to(ROOT)),visualVerdict='requires actual image review (gallery.png)'),ensure_ascii=False,indent=1)+'\n')
    print(json.dumps(dict(installed=len(buildings),tiles=len(cells),sheet=count)))
if __name__=='__main__':main()
