"""Pack the user's selected RGB lookup into shared tree-only sprites; no shape edits."""
from pathlib import Path
from PIL import Image
import json, hashlib
R=Path(__file__).resolve().parents[2]
out=R/'public/assets/beodeul-warm-trees';out.mkdir(exist_ok=True)
source=R/'tiledata/beodeul-ground/tree-palette-studies'
selected=next(p for p in json.loads((source/'palettes.json').read_text()) if p['id']=='warm')
lookup={tuple(p['from']):tuple(p['to']) for p in selected['paletteMapping']}
ground=json.loads((R/'src/assets/beodeulGroundCatalog.json').read_text())
recipes=[];cells=[];proof=[]
def emit(key,im,layer,blocking=None,origin=None):
    rows=[]
    for y in range(im.height//16):
        row=[]
        for x in range(im.width//16):
            tile=im.crop((x*16,y*16,x*16+16,y*16+16))
            if tile.getbbox():row.append(len(cells));cells.append(tile)
            else:row.append(-1)
        rows.append(row)
    recipes.append(dict(id='bdw-'+key,name='따뜻한 황록 · '+key,layer=layer,width=im.width//16,height=im.height//16,rows=rows,blockingCells=blocking or [],source=origin))
    im.save(out/(key+'.png'))
def recolor(im):
    result=im.copy();result.putdata([lookup.get(c,c) for c in im.getdata()])
    assert im.getchannel('A').tobytes()==result.getchannel('A').tobytes()
    return result
for key in ['03a8f7','3e8732','1a786c']:
    old=Image.open(R/f'tiledata/beodeul-ground/tree-studies/current-{key}-body.png').convert('RGBA')
    im=recolor(old)
    assert im.tobytes()==Image.open(source/f'warm-{key}-body.png').convert('RGBA').tobytes()
    emit('tree-'+key,im,3,[[1,3],[2,3]],'current-'+key+'-body.png')
    emit('tree-'+key+'-shadow',Image.open(R/f'tiledata/beodeul-ground/tree-studies/current-{key}-shadow.png').convert('RGBA'),2,origin='current-'+key+'-shadow.png')
    proof.append(dict(id=key,exactSelectedStudy=True,alphaPreserved=True))
for key in ['north','north-open','west','east']:
    old=Image.open(R/f'public/assets/beodeul-ground/woodland-{key}.png').convert('RGBA')
    im=recolor(old)
    original=next(r for r in ground['recipes'] if r['id']=='bdg-woodland-'+key)
    emit('grove-'+key,im,3,original['blockingCells'],original['id'])
    emit('grove-'+key+'-shadow',Image.open(R/f'public/assets/beodeul-ground/woodland-{key}-shadow.png').convert('RGBA'),2,origin=original['id']+'-shadow')
    proof.append(dict(id=key,alphaPreserved=True,blockingCellsPreserved=True))
count=(len(cells)+7)//8*8
atlas=Image.new('RGBA',(128,count//8*16))
for n,im in enumerate(cells):atlas.paste(im,(n%8*16,n//8*16))
atlas.save(out/'chipset.png')
catalog=dict(id='beodeul_warm_trees',texture='tex_beodeul_warm_trees',tileSize=16,tilesPerRow=8,count=count,selection='warm',recipes=recipes)
(R/'src/assets/beodeulWarmTreesCatalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(R/'tiledata/beodeul-ground/warm-trees-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(out/'pixel-proof.json').write_text(json.dumps(dict(proof=proof,sha256=hashlib.sha256(atlas.tobytes()).hexdigest()),indent=2)+'\n')
print(json.dumps(dict(count=count,recipes=len(recipes))))
