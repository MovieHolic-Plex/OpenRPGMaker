"""Read-only diagnostic display and measured diffs; no source pixel synthesis."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
from render import ROOT, RGB

NAMES = ['idle_a','idle_b','idle_c','recover','windup','skill_b']
ARCHIVE = ROOT/'revisions'/'low-stance-claws-before'


def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA',(64,64))
    im.putdata([(0,0,0,0) if s=='.' else (*RGB[s],255)
                for row in rows for s in row])
    return im


def main():
    report = {}
    for label,bg in [('light',(233,225,206)),('dark',(24,28,36)),('checker',None)]:
        sheet = Image.new('RGB',(4*208,3*300),bg or (40,43,49))
        draw = ImageDraw.Draw(sheet)
        for i,name in enumerate(NAMES):
            rel = Path('actions' if name=='skill_b' else 'poses')/(name+'.pxgrid')
            for version,path in [('before',ARCHIVE/rel),('current',ROOT/rel)]:
                x = ((i%2)*2+(version=='current'))*208+8
                y = (i//2)*300
                draw.text((x,y+4),name+' '+version,
                          fill=(110,100,90) if label=='light' else (235,230,215))
                if bg is None:
                    for yy in range(64):
                        for xx in range(64):
                            c=(76,80,88) if (xx//8+yy//8)%2 else (108,112,116)
                            draw.point((x+xx,y+22+yy),fill=c)
                            draw.rectangle((x+xx*3,y+94+yy*3,x+xx*3+2,y+96+yy*3),fill=c)
                im = read(path)
                sheet.paste(im,(x,y+22),im)
                enlarged = im.resize((192,192),Image.Resampling.NEAREST)
                sheet.paste(enlarged,(x,y+94),enlarged)
        sheet.save(ROOT/'preview'/f'low-stance-claws-{label}.png')
    hashes = json.loads((ARCHIVE/'hashes.json').read_text())
    for folder in ('poses','actions'):
        for path in (ROOT/folder).glob('*.pxgrid'):
            rel = path.relative_to(ROOT)
            old_path = ARCHIVE/rel
            current_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            if old_path.exists():
                before = old_path.read_text().splitlines()
                after = path.read_text().splitlines()
                edits = [{'x':x,'y':y,'before':a,'after':b}
                         for y,(old,new) in enumerate(zip(before,after))
                         for x,(a,b) in enumerate(zip(old,new)) if a!=b]
                report[str(rel)] = {
                    'changed_pixels':len(edits),
                    'bounds':[min(e['x'] for e in edits),min(e['y'] for e in edits),
                              max(e['x'] for e in edits),max(e['y'] for e in edits)],
                    'edits':edits,
                    'sha256_before':hashes[str(rel)],'sha256_current':current_hash,
                }
            elif current_hash!=hashes[str(rel)]:
                raise ValueError(('Unexpected change',str(rel)))
    if hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest()!=hashes['palette.json']:
        raise ValueError('Unexpected palette change')
    (ROOT/'low-stance-claws-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:{'changed_pixels':v['changed_pixels'],'bounds':v['bounds']}
                      for k,v in report.items()},indent=2))


if __name__=='__main__':
    main()
