#!/usr/bin/env python3
"""Decode the actual PNGs and verify the local art handoff; no game DB writes."""
from pathlib import Path
import hashlib
import json
import runpy
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'source/draw.py'
art=json.loads((ROOT/'review/art-manifest.json').read_text())
sheets=json.loads((ROOT/'sheets.json').read_text())
data=json.loads((ROOT/'data.json').read_text())
ids=json.loads((ROOT.parent/'ids.json').read_text())
module=runpy.run_path(str(SOURCE))
assert art['sourceSha256']==hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert len(sheets)==len(art['sheets'])==len(data['enemies'])==4
report=[]
for metadata,generated in zip(sheets,art['sheets']):
    slug=generated['slug'];cell=metadata['cell']
    path=ROOT/generated['sheet']
    assert metadata['resourceId']==f'jf-enemy-{slug}'
    assert metadata['path']==f'assets/joseon-folklore/monsters/{slug}.png'
    assert cell==(96 if slug=='bronze-dokkaebi' else 64)
    assert metadata['motion'] in ['hop','swoop','stomp','breath','shoot','dash','float']
    assert generated['sha256']==hashlib.sha256(path.read_bytes()).hexdigest()
    with Image.open(path) as actual:
        actual.load()
        assert actual.mode=='RGBA' and actual.size==(cell*3,cell*3)
        px=list(actual.get_flattened_data()) if hasattr(actual,'get_flattened_data') else list(actual.getdata())
        assert {p[3] for p in px}=={0,255}
        assert len({p for p in px if p[3]})<=32
        unique=set();boxes=[]
        regenerate=next(spec[4] for spec in module['SPECIES'] if spec[0]==slug)
        for i,pose in enumerate(module['POSES']):
            frame=actual.crop(((i%3)*cell,(i//3)*cell,(i%3+1)*cell,(i//3+1)*cell))
            box=frame.getbbox();assert box is not None
            # Box max is exclusive. One transparent border pixel at minimum;
            # ground baseline is y=cell-4, inclusive, matching the runtime.
            assert box[0]>=1 and box[1]>=1 and box[2]<=cell-1 and box[3]<=cell-3, (slug,pose,box)
            assert frame.tobytes()==regenerate(pose).tobytes(), (slug,pose,'source reproduction')
            unique.add(hashlib.sha256(frame.tobytes()).hexdigest());boxes.append(list(box))
        assert len(unique)==9
        with Image.open(ROOT/'assets/portraits'/f'{slug}.png') as portrait:
            portrait.load()
            assert portrait.size==(cell,cell)
            assert portrait.tobytes()==actual.crop((0,0,cell,cell)).tobytes()
    enemy=next(e for e in data['enemies'] if e['monsterResourceId']==metadata['resourceId'])
    assert enemy['id']==ids['enemies'][slug]
    assert enemy['rewards']['dropItemId'] in ids['materials'].values()
    report.append(dict(slug=slug,size=[cell*3,cell*3],uniquePoses=len(unique),colors=generated['colors'],
                       sha256=generated['sha256'],groundBaseline=cell-4,bounds=boxes))
result=dict(passed=True,scope='PNG decode/source reproduction/pose geometry/portrait pixels/reserved IDs',
            counts=dict(sheets=4,poses=36,portraits=4),sheets=report,
            limitation='Mechanical asset check does not judge art quality or integrated battle rendering.')
(ROOT/'review/asset-smoke.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(passed=True,sheets=4,poses=36,portraits=4,sourceReproduced=True),ensure_ascii=False))
