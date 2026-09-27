# 공용 SQLite 에 올라간 pixel-art-world-maps-51-local 만으로 51맵을 다시 그려 갤러리 PNG 와 비교한다.
# 두 경로를 모두 본다: (1) 층 장소의 GameMap(아래층 + 위층 + 위층 겹침), (2) 장소 구획 킷(아래층 + 위층 두 줄).
# 오브젝트 킷은 미리보기 그림과 칸 그림이 같은지 본다. 채널 차이 4/255 를 넘으면 실패한다.
# Usage: python3 scripts/content/paw-maps/verify_published.py
import os, io, json, base64, sqlite3, sys
from PIL import Image, ImageChops

DB = os.path.expanduser('~/.local/share/oprn/shared-content.sqlite')
LIB = 'pixel-art-world-maps-51-local'
GAL = os.path.expanduser('~/claude-viz/paw-maps')
def png(url): return Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGBA')

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
lib = json.loads(con.execute('SELECT payload FROM content_libraries WHERE id=?', (LIB,)).fetchone()[0])
atlas = {tid: png(lib['assets'][t['image']['id']]['dataUrl']) for tid, t in lib['tilesets'].items()}
def cell(tid, i):
    t = lib['tilesets'][tid]; c = t['tilesPerRow']
    return atlas[tid].crop(((i % c) * 32, (i // c) * 32, (i % c) * 32 + 32, (i // c) * 32 + 32))
def diff(a, b): return max(x[1] for x in ImageChops.difference(a.convert('RGB'), b.convert('RGB')).getextrema())

worst, rows, bad = 0, [], []
for root in lib['roots']:
    floor = lib['places'][root]['children'][0]['source']['id']
    place = lib['places'][floor]; m = lib['maps'][floor]; tid = m['tilesetId']; W, H = m['width'], m['height']
    kit = next(k for k in lib['tilesets'][place['exterior']['tilesetId']]['structureKits'] if k['id'] == place['exterior']['kitId'])
    a = Image.new('RGBA', (W * 32, H * 32), (0, 0, 0, 255)); b = a.copy()
    stacks = {int(k): v for k, v in (m.get('upperTileStacks') or {}).items()}
    for k in range(W * H):
        pos = ((k % W) * 32, (k // W) * 32)
        for i in (m['lowerTiles'][k], m['upperTiles'][k], *stacks.get(k, [])):
            if i >= 0: a.alpha_composite(cell(tid, i), pos)
        r = kit['rows'][k // W]
        for i in (r['tiles'][k % W], r['upperTiles'][k % W]):
            if i >= 0: b.alpha_composite(cell(tid, i), pos)
    ref = Image.open(os.path.join(GAL, place['provenance']['sourceId'] + '.png'))
    d = max(diff(a, ref), diff(b, ref)); worst = max(worst, d)
    rows.append((place['provenance']['sourceId'], tid, W, H, d))
    if d > 4: bad.append(place['provenance']['sourceId'])
obj_bad = 0; n_obj = 0
for tid, t in lib['tilesets'].items():
    for k in t['structureKits']:
        if not k['id'].startswith('shared_paw51_obj_'): continue
        n_obj += 1
        pv = Image.new('RGBA', (k['width'] * 32, k['height'] * 32))
        for y, r in enumerate(k['rows']):
            for x, i in enumerate(r['upperTiles']):
                if i >= 0: pv.alpha_composite(cell(tid, i), (x * 32, y * 32))
        if pv.tobytes() != png(lib['previews'][k['id']]).tobytes(): obj_bad += 1
print(json.dumps({'maps': len(rows), 'worstChannelDiff': worst, 'failedMaps': bad, 'objects': n_obj, 'objectPreviewMismatch': obj_bad}, ensure_ascii=False))
sys.exit(1 if bad or obj_bad or len(rows) != 51 else 0)
