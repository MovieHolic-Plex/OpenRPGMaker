"""Independent content audit; no test runner and no DB mutation."""
from pathlib import Path
from PIL import Image
import json, hashlib
D = Path('verify-shots/slates-astra-v3')
layout = json.loads((D/'layout.json').read_text())
bundle = json.loads((D/'bundle.json').read_text())
modules = {m['id']: m for m in json.load(open('docs/experiments/slates-astra-v2/modules.json'))['modules']}
sources = {p: Image.open(p).convert('RGBA') for p in ['public/assets/slates/slates-v2-32px.png','public/assets/slates/slates-v1-32px.png']}
canvas = Image.new('RGBA', (1600,1600)); owners = {}; overlaps = []
for building in layout['buildings']:
    module = modules[building['module']]; ox,oy = building['offsetPx']; cells = set()
    for op in module['operations']:
        if op['layer'] in ['floor','shadow']: continue
        sx,sy,w,h = op['sourceRect']; dx,dy = op['destination']
        canvas.alpha_composite(sources[op['source']].crop((sx,sy,sx+w,sy+h)), (ox+dx,oy+dy))
    # Includes the documented half-cell art offset's separately authored ground footprint.
    for x,y,w,h in building['footprint']:
        cells.update((x+i,y+j) for j in range(h) for i in range(w))
    for c in cells:
        if c in owners: overlaps.append([list(c),owners[c],building['id']])
        owners[c] = building['id']
x,y,w,h = layout['interiorRect']
alpha = sum(canvas.crop((x*32,y*32,(x+w)*32,(y+h)*32)).getchannel('A').get_flattened_data())/255
m = bundle['map']; t = bundle['tileset']; walk = []
for i in range(2500):
    lo,up = m['lowerTiles'][i],m['upperTiles'][i]
    k = lo if up < 0 or (t['priority'][up]=='upper' and all(t['passability'][up].values())) else up
    walk.append(all(t['passability'][k].values()))
empty = []; best = (0,None)
for yy in range(y,y+h):
    for xx in range(x,x+w):
        if not walk[yy*50+xx]: continue
        mw = x+w-xx
        for hh in range(1,y+h-yy+1):
            ww = 0
            while ww < mw and walk[(yy+hh-1)*50+xx+ww]: ww += 1
            mw = ww
            if not ww: break
            if ww*hh > best[0]: best = (ww*hh,[xx,yy,ww,hh])
        if xx+5<=x+w and yy+5<=y+h and all(walk[(yy+j)*50+xx+i] for j in range(5) for i in range(5)):
            empty.append([xx,yy,5,5])
ops = json.loads((D/'map-operations.json').read_text())['operations']; bad = []
for i,op in enumerate(ops):
    sx,sy,ww,hh = op['sourceRect']; aw,ah = sources[op['source']].size
    if sx<0 or sy<0 or ww<=0 or hh<=0 or sx+ww>aw or sy+hh>ah: bad.append(i)
result = {'bundleSha256':hashlib.sha256((D/'bundle.json').read_bytes()).hexdigest(),
    'independentAlphaPixels':alpha, 'independentDensityPercent':alpha/(w*h*1024)*100,
    'buildingCount':len(layout['buildings']), 'buildingFootprintOverlaps':overlaps,
    'walkableEmpty5x5':empty, 'largestWalkableRectangle':best,
    'sourceOperations':len(ops),'invalidSourceRects':bad,
    'method':'Supervisor independently replayed original module source rectangles with Pillow alpha-over; inspected authored footprints and encoded bundle collision. Fixed interior [3,4,44,42].'}
assert 50 <= result['independentDensityPercent'] <= 65
assert not overlaps and not empty and not bad
reported = json.loads((D/'metrics.json').read_text())['alphaUnionPercent']
assert abs(reported-result['independentDensityPercent']) < 0.00001
(D/'supervisor-density-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
