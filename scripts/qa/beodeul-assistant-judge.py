# Structural judge for the 버들항 assistant runs (verify-shots/beodeul-assistant/{fresh,existing}): district kits at the original
# origins, cells identical to the original map, walkable cells reached from the main street (62,33), every stamped house
# door front reached, house footprint overlaps. Structure only — looks are judged by eye.  python3 scripts/qa/beodeul-assistant-judge.py
import json,collections,re,sys
TS=json.load(open('src/assets/beodeulCityTileset.json')); PASS=[p['up'] for p in TS['passability']]
ORIG=json.load(open('tiledata/beodeul-city/map.json'))
KITS={k['id']:k for k in TS['structureKits']}
out={}
for l in ('fresh','existing'):
    m=json.load(open(f'verify-shots/beodeul-assistant/{l}/map.json')); t=json.load(open(f'verify-shots/beodeul-assistant/{l}/trace.json'))
    W,H=m['width'],m['height']; lo,u=m['lowerTiles'],m['upperTiles']
    def wk(x,y):
        a=u[y*W+x]
        if a>=0 and not PASS[a]: return False
        return lo[y*W+x]>=0 and PASS[lo[y*W+x]]
    seen={(62,33)} if wk(62,33) else set(); q=collections.deque(seen)
    while q:
        x,y=q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            n=(x+dx,y+dy)
            if 0<=n[0]<W and 0<=n[1]<H and n not in seen and wk(*n): seen.add(n);q.append(n)
    doors=[]
    for s in t:
        if s['name']=='stamp_object' and s['ok']:
            a=json.loads(s['args']); k=KITS.get(a['objectId'].split('/')[-1])
            if not k: continue
            for p in k.get('parts') or []:
                if p['kind']=='entrance': doors.append((k['id'],a['x']+p['dx'],a['y']+p['dy']+1))
            if k['id'] in ('bd-castle','bd-estate','bd-forum','bd-cathedral','bd-windmill','bd-harbour','bd-harbour-west','bd-river-bridge'):
                pass
    # district doors (from original) inside stamped district kits at original coords
    dd=[(d[2],d[0],d[1]+1) for d in ORIG['doors']]
    stampedDistrict=[json.loads(s['args']) for s in t if s['name']=='stamp_object' and s['ok'] and 'bd-' in s['args'] and json.loads(s['args'])['objectId'].split('/')[-1] in ('bd-castle','bd-estate','bd-forum','bd-cathedral','bd-windmill','bd-harbour','bd-harbour-west','bd-river-bridge')]
    distAt={a['objectId'].split('/')[-1]:(a['x'],a['y']) for a in stampedDistrict}
    unreached=[d for d in doors if (d[1],d[2]) not in seen]
    # cells identical to original
    same=sum(1 for i in range(W*H) if lo[i]==ORIG['lowerTiles'][i] and u[i]==ORIG['upperTiles'][i])
    # house overlaps: stamped piece rects that intersect
    rects=[]
    for s in t:
        if s['name']=='stamp_object' and s['ok']:
            a=json.loads(s['args']); k=KITS.get(a['objectId'].split('/')[-1])
            if k and k['id'].startswith('bd-house-'): rects.append((k['id'],a['x'],a['y'],k['width'],k['height']))
    ov=0
    for i in range(len(rects)):
        for j in range(i+1,len(rects)):
            _,x1,y1,w1,h1=rects[i];_,x2,y2,w2,h2=rects[j]
            # footprint rows only (bottom 60%)
            if x1<x2+w2 and x2<x1+w1 and y1+h1*0.4<y2+h2 and y2+h2*0.4<y1+h1: ov+=1
    wkc=sum(1 for y in range(H) for x in range(W) if wk(x,y))
    # paint_tiles tiles used
    painted=collections.Counter()
    for s in t:
        if s['name']=='paint_tiles' and s['ok']: painted[json.loads(s['args']).get('tile')]+=1
    # how many new houses placed in the middle town (not district kits) and their door reach
    out[l]=dict(districts=distAt, allAtOriginal=all(distAt.get(k)==v for k,v in {'bd-castle':(0,0),'bd-estate':(36,2),'bd-forum':(54,34),'bd-cathedral':(82,3),'bd-windmill':(1,34),'bd-harbour':(36,62),'bd-harbour-west':(0,62),'bd-river-bridge':(26,24)}.items()),
        cellsSameAsOriginal=same, ratioSame=round(same/(W*H),3), walkable=wkc, reachFromMain=len(seen), pieceDoors=len(doors), pieceDoorsUnreached=len(unreached), unreachedSamples=unreached[:8],
        housePiecesStamped=len(rects), houseFootprintOverlaps=ov, paintTiles=dict(painted), origDoorsInKits=None)
json.dump(out,open('verify-shots/beodeul-assistant/judge.json','w'),ensure_ascii=False,indent=1)
print(json.dumps(out,ensure_ascii=False,indent=1))
