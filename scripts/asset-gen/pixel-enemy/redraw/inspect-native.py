#!/usr/bin/env python3
"""Read-only source replay and PNG/portrait/bounds inspection for all140.

Asset inspection, not a test suite or canonical user project persistence check.
"""
from pathlib import Path
from PIL import Image
import json,hashlib,sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
sys.path.insert(0,str(HERE.parent/'refresh'))
from registry import ENTRIES,draw_entry,helper

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    qa=ROOT/'verify-shots/monster-redraw-all';before=json.loads((qa/'before.json').read_text())
    bounds=json.loads((ROOT/'src/assets/battleContactBounds.json').read_text())
    catalog=json.loads((ROOT/'src/assets/monsterCatalogReview.json').read_text())['entries']
    rows=[];changed=0;kept=0;idle_hashes={}
    for slug,e in ENTRIES.items():
        cell=e['cell'];path=ROOT/'public'/e['path'];portrait=ROOT/'public/assets/generated/pixel-enemy-portraits'/(slug+'.png')
        with Image.open(path) as source:sheet=source.convert('RGBA')
        with Image.open(portrait) as source:idle=source.convert('RGBA')
        assert sheet.size==(cell*3,cell*3) and idle.size==(cell,cell),(slug,'dimensions')
        assert idle.tobytes()==sheet.crop((0,0,cell,cell)).tobytes(),(slug,'portrait')
        frames=[]
        for i,pose in enumerate(helper.POSES):
            frame=sheet.crop((i%3*cell,i//3*cell,(i%3+1)*cell,(i//3+1)*cell))
            painted=draw_entry(slug,pose)
            assert painted.size==frame.size and painted.tobytes()==frame.tobytes(),(slug,pose,'source replay differs')
            box=frame.getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<cell and box[3]<=cell-3,(slug,pose,box)
            frames.append(dict(pose=pose,bbox=box,sha256=hashlib.sha256(frame.tobytes()).hexdigest()))
        assert len({f['sha256'] for f in frames})==9,(slug,'duplicate pose')
        visible={c for n,c in sheet.getcolors(cell*cell*9) if c[3]}
        assert len(visible)<=32 and set(sheet.getchannel('A').tobytes())=={0,255},(slug,'color/alpha')
        assert sha(path)==bounds[e['path']]['sha256'] and bounds[e['path']]['cell']==cell,(slug,'bounds hash/cell')
        for key,index in [('idle',0),('strike',5),('attack',5)]:
            assert bounds[e['path']][key]==[round(v/cell,6) for v in frames[index]['bbox']],(slug,key,'bounds')
        row=catalog[e['resourceId']]
        assert row['sha256']==sha(portrait) and row['nativeSheetSha256']==sha(path) and row['cell']==cell,(slug,'catalog review hash/cell')
        if before[slug]['retained']:
            assert before[slug]['sheetSha256']==sha(path) and before[slug]['portraitSha256']==sha(portrait),(slug,'retained art changed')
            kept+=1
        else:
            assert before[slug]['sheetSha256']!=sha(path) and before[slug]['portraitSha256']!=sha(portrait),(slug,'old rejected art unchanged')
            changed+=1
        idle_hashes.setdefault(frames[0]['sha256'],[]).append(slug)
        rows.append(dict(slug=slug,cell=cell,colors=len(visible),frames=frames,sourceReplayExact=True))
    duplicates=[v for v in idle_hashes.values() if len(v)>1];assert not duplicates,duplicates
    assert changed==135 and kept==5
    report=dict(scope='Native picture/source/metadata inspection only. User acceptance is not implied.',
                totalSpecies=len(rows),freshRedraws=changed,retained=kept,totalPoses=len(rows)*9,
                freshPoses=changed*9,sourceReplayExact=True,uniqueIdleArt=True,maximumColors=max(r['colors'] for r in rows),
                cells={str(c):sum(r['cell']==c for r in rows) for c in sorted({r['cell'] for r in rows})},species=rows)
    (qa/'pixels.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='species'},ensure_ascii=False))

if __name__=='__main__':main()
