"""Read actual native files and GIF frames; report measurements, never repair ink."""
from pathlib import Path
import hashlib
import json
from PIL import Image
from render import ROOT, PALETTE, POSES, ACTIONS, MOTIONS, read_image

def components(ink):
    remaining = set(ink)
    result = []
    while remaining:
        start = min(remaining)
        remaining.remove(start)
        stack, found = [start], [start]
        while stack:
            x,y = stack.pop()
            for dx,dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                q = (x+dx,y+dy)
                if q in remaining:
                    remaining.remove(q)
                    stack.append(q)
                    found.append(q)
        result.append({'pixels':len(found), 'bounds':[min(x for x,y in found),min(y for x,y in found),
            max(x for x,y in found),max(y for x,y in found)]})
    return sorted(result,key=lambda c:-c['pixels'])

report = {'paletteEntries':len(PALETTE), 'frames':{}, 'gifReadback':{}}
for name in POSES+ACTIONS:
    folder = 'poses' if name in POSES else 'actions'
    path = ROOT / folder / (name+'.pxgrid')
    rows = path.read_text().splitlines()
    ink = {(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.'}
    native = read_image(name)
    png_path = ROOT / 'png' / (name+'.png')
    with Image.open(png_path) as png:
        actual = png.convert('RGBA')
        mismatches = sum(a!=b for a,b in zip(native.get_flattened_data(),actual.get_flattened_data()))
        alpha = sorted(set(actual.getchannel('A').get_flattened_data()))
    report['frames'][name] = {
        'rows':len(rows), 'rowWidths':sorted(set(map(len,rows))),
        'bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],
        'borderInk':sum(x in (0,63) or y in (0,63) for x,y in ink),
        'alphaValues':alpha, 'pngDifferentPixels':mismatches,
        'rgbaSha256':hashlib.sha256(native.tobytes()).hexdigest(),
        'pngFileSha256':hashlib.sha256(png_path.read_bytes()).hexdigest(),
        'components8':components(ink),
    }
for motion,sequence in MOTIONS.items():
    records=[]
    with Image.open(ROOT / 'gifs' / (motion+'.gif')) as gif:
        for index in range(gif.n_frames):
            gif.seek(index)
            actual=gif.convert('RGBA')
            pose,hold=sequence[index]
            expected=read_image(pose)
            # Invisible RGB bytes may differ in indexed GIF; compare visible color and alpha.
            different=sum((a[3]!=b[3]) or (a[3] and a[:3]!=b[:3])
                for a,b in zip(actual.get_flattened_data(),expected.get_flattened_data()))
            records.append({'pose':pose,'durationMs':gif.info.get('duration'),
                'authoredHoldMs':hold,'differentVisiblePixels':different})
    report['gifReadback'][motion]=records
(ROOT / 'inspection' / 'measurements.json').write_text(json.dumps(report,indent=2)+'\n')
for name,frame in report['frames'].items():
    print(name, 'bounds', frame['bounds'], 'components', frame['components8'])
print('Read actual PNGs and eight GIFs. Measurements saved to source/inspection/measurements.json.')
