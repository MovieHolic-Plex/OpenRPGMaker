#!/usr/bin/env python3
"""Embed losslessly indexed copies of source sheets into the review fragment."""
from pathlib import Path
from PIL import Image
import base64,io,json,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]

def compact_png(im):
    # Codec conversion only: every RGBA value including transparent pixels is exact.
    im=im.convert('RGBA');unique=list(dict.fromkeys(im.getdata()));assert len(unique)<=256
    lookup={c:i for i,c in enumerate(unique)}
    indexed=Image.new('P',im.size);indexed.putpalette([v for c in unique for v in c[:3]]+[0]*(768-len(unique)*3))
    indexed.putdata([lookup[c] for c in im.getdata()]);indexed.info['transparency']=bytes([c[3] for c in unique])
    stream=io.BytesIO();indexed.save(stream,format='PNG',optimize=True)
    assert Image.open(io.BytesIO(stream.getvalue())).convert('RGBA').tobytes()==im.tobytes()
    return 'data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode()

def main():
    target=Path(sys.argv[1]);manifest=json.loads((HERE/'manifest.json').read_text())
    catalog=json.loads((ROOT/'src/assets/monsterCatalogData.json').read_text());data=[]
    for e in manifest:
        with Image.open(ROOT/'public'/e['path']) as im:
            assert im.size==(e['cell']*3,e['cell']*3),(e['slug'],im.size,e['cell'])
            png=compact_png(im)
        data.append(dict(slug=e['slug'],cell=e['cell'],name=catalog[e['resourceId']]['name'],png=png))
    fragment=(HERE/'gallery.html').read_text().replace('__MONSTERS_DATA__',json.dumps(data,ensure_ascii=False,separators=(',',':')))
    assert len(fragment.encode())<1_000_000,len(fragment.encode())
    target.parent.mkdir(parents=True,exist_ok=True);target.write_text(fragment)
    assert target.read_text()==fragment
    print(target,len(fragment.encode()),len(data),'species')

if __name__=='__main__':main()
