# 51개 PAW 맵을 공용 DB 발행용 팩(output/paw-maps-pack.json, gitignored)으로 굽는다.
# 각 맵을 아래층(바닥·벽·천장)과 위층(물건, 투명 배경)으로 따로 렌더해 32px 칸으로 자르고,
# 같은 그림 칸은 하나로 합쳐 한 장의 아틀라스(8열)로 만든다. PAW 그림은 저장소 밖에만 쓴다.
# Usage: python3 scripts/content/paw-maps/pack.py [out.json]
import sys, os, glob, runpy, json, hashlib, io, base64
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pawlib
from PIL import Image, ImageChops

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'output', 'paw-maps-pack.json')
maps = []

def capture(self):
    bad = self.lint()
    if bad: raise AssertionError(f'{self.id} lint: ' + '; '.join(bad[:5]))
    full = self.render()
    up, over = self.up, self.over
    self.up, self.over = [[[] for _ in range(self.w)] for _ in range(self.h)], []
    lower = self.render()
    self.up, self.over = up, over
    upper = Image.new('RGBA', full.size, (0, 0, 0, 0))
    upper.paste(full, (0, 0), Image.eval(ImageChops.difference(full, lower).convert('L'), lambda v: 255 if v else 0))
    maps.append(dict(m=self, lower=lower, upper=upper, full=full))
pawlib.Map.save = capture
for f in sorted(glob.glob(HERE + '/m[0-9][0-9]_*.py')): runpy.run_path(f, run_name='__main__')

tiles, index, atlas_cells = [], {}, []
def intern(cell, solid, layer):
    key = hashlib.sha256(cell.tobytes()).hexdigest()
    i = index.get(key)
    if i is None:
        i = index[key] = len(tiles); tiles.append({'passage': 'passable', 'layer': layer}); atlas_cells.append(cell)
    if solid: tiles[i]['passage'] = 'solid'
    return i

def entry(m):
    if m.cls:
        ds = [(x, y) for y in range(m.h) for x in range(m.w) if m.cls[y][x] == 'D']
        if ds: return max(ds, key=lambda p: p[1])
    return {'x': m.w // 2, 'y': m.h - 1}

KIND = {
    'exterior': ('장소유형:마을·도시', '공간형태:실외'), 'interior': ('장소유형:건물·시설', '공간형태:건물 내부'),
    'worldmap': ('장소유형:자연', '공간형태:실외'),
}
USAGE = {'m0': '도시', 'm1': '도시', 'm2': '주거', 'm3': '상업시설', 'm4': '공공시설', 'm5': '탐험', 'm6': '오락'}
SPECIAL = {'m50': ('장소유형:던전·유적', '공간형태:지하', '탐험'), 'm51': ('장소유형:던전·유적', '공간형태:지하', '탐험'),
           'm52': ('장소유형:자연', '공간형태:실외', '월드맵'), 'm53': ('장소유형:자연', '공간형태:실외', '월드맵'),
           'm59': ('장소유형:건물·시설', '공간형태:건물 내부', '종교'), 'm12': ('장소유형:건물·시설', '공간형태:실외', '종교'),
           'm27': ('장소유형:건물·시설', '공간형태:건물 내부', '목욕탕'), 'm02': ('장소유형:마을·도시', '공간형태:실외', '목욕탕')}

out_maps = []
for rec in maps:
    m = rec['m']; lo_t, up_t = [], []
    for y in range(m.h):
        for x in range(m.w):
            box = (x * 32, y * 32, x * 32 + 32, y * 32 + 32)
            cls = m.cls[y][x] if m.cls else 'F'
            lo_t.append(intern(rec['lower'].crop(box), cls in 'CW', 'lower'))
            u = rec['upper'].crop(box); a = u.getchannel('A')
            if a.getbbox() is None: up_t.append(-1); continue
            cover = sum(1 for p in a.getdata() if p > 128)
            up_t.append(intern(u, cover > 400, 'upper'))
    p = m.id.split('_')[0]
    t, space, use = SPECIAL.get(p) or (*KIND.get(m.kind, KIND['interior']), USAGE.get(p[:2], '시설'))
    e = entry(m); e = e if isinstance(e, dict) else {'x': e[0], 'y': e[1]}
    th = rec['full'].copy(); th.thumbnail((480, 480)); buf = io.BytesIO(); th.convert('RGB').save(buf, 'PNG', optimize=True)
    out_maps.append({'id': m.id, 'name': m.title, 'width': m.w, 'height': m.h, 'lowerTiles': lo_t, 'upperTiles': up_t,
                     'port': e, 'usage': use, 'kind': m.kind, 'tags': [t, space], 'note': m.note, 'sheets': sorted(m.used),
                     'preview': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()})

cols = 8; rows = -(-len(atlas_cells) // cols)
sheet = Image.new('RGBA', (cols * 32, rows * 32), (0, 0, 0, 0))
for i, c in enumerate(atlas_cells): sheet.alpha_composite(c, ((i % cols) * 32, (i // cols) * 32))
buf = io.BytesIO(); sheet.save(buf, 'PNG', optimize=True); raw = buf.getvalue()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'atlas': 'data:image/png;base64,' + base64.b64encode(raw).decode(), 'atlasSha': hashlib.sha256(raw).hexdigest(),
           'count': len(tiles), 'tiles': tiles, 'maps': out_maps}, open(OUT, 'w'), ensure_ascii=False)
print(f'pack {len(out_maps)} maps, {len(tiles)} tiles, atlas {cols * 32}x{rows * 32} {len(raw) // 1024}KB -> {OUT}')
