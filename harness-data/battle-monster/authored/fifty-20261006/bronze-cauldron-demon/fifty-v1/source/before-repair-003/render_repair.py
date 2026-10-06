"""Read before/current literal grids and make labeled diagnostic panels only."""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw
from render import ROOT, OUT, read, backdrop

def main():
    targets = [('poses','windup'),('poses','attack'),('actions','skill_c')]
    for folder, name in targets:
        board = Image.new('RGB',(1152,1120),(46,48,55))
        labels = ImageDraw.Draw(board)
        for row,(state,path) in enumerate([
            ('before',ROOT/'before-repair-002'/folder/(name+'.pxgrid')),
            ('current',ROOT/folder/(name+'.pxgrid')),
        ]):
            im=read(path)
            y=row*560
            labels.text((390,y+46),name+' / '+state,fill=(244,235,211))
            for k,theme in enumerate(('light','dark','checker')):
                bg=backdrop(im,theme)
                board.paste(bg,(k*128,y))
                board.paste(bg.resize((384,384),Image.Resampling.NEAREST),(k*384,y+152))
                labels.text((k*384+5,y+136),theme+' / native 1x above / 3x below',fill=(244,235,211))
        board.save(OUT/(name+'-repair-comparison.png'))
    baseline=json.loads((ROOT/'before-repair-002/source-hashes.json').read_text())
    changes={}
    for rel,old_hash in baseline.items():
        path=ROOT/rel
        new_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        if old_hash!=new_hash:
            old=(ROOT/'before-repair-002'/rel).read_text().splitlines()
            new=path.read_text().splitlines()
            coords=[(x,y) for y in range(128) for x in range(128) if old[y][x]!=new[y][x]]
            changes[rel]={'beforeSha256':old_hash,'currentSha256':new_hash,
                'changedPixels':len(coords),
                'changedBoundsInclusive':[min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords)]}
    manifest=json.loads((OUT/'readback.json').read_text())
    report={'changes':changes,'unchangedOriginalFiles':len(baseline)-len(changes),
        'frames':{n: {'size':v['size'],'inkBoundsExclusive':v['inkBoundsExclusive'],'lowestInkY':v['lowestInkY']} for n,v in manifest['frames'].items()},
        'note':'Local source/render readback only. No independent review or user selection.'}
    (OUT/'repair-readback.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'changed':changes,'unchangedOriginalFiles':report['unchangedOriginalFiles']},indent=2))

if __name__=='__main__':
    main()
