#!/usr/bin/env python3
"""Bake a complete reusable brush atlas. No finished continent is an input.

Textures/forest/mountain quarters are reused from the current kit source; new
boundary and bridge pixel rows live in authoring/pixels.json. Mask grammar has
all 47 legal blob states and all 16 path connections, not map coordinate crops.
"""
import sys, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tiledata/worldmap-kit/kit/lib'))
import terrain_v4 as V
import terrain_lib as T
P = json.loads((ROOT / 'tiledata/worldmap-kit/authoring/pixels.json').read_text())
tiles, meta, brushes = [], [], []
grounds = [('grass', '초원', V.GRASS), ('sand', '사막', V.SAND), ('snow', '설원', V.SNOW),
           ('dirt', '황무지', V.DIRT), ('swamp', '늪', V.SWAMP), ('tundra', '툰드라', V.TUNDRA),
           ('ash', '화산재', V.ASH), ('red', '붉은 협곡토', V.BADLANDS), ('savanna', '사바나', V.SAVANNA),
           ('jungle', '정글 땅', V.JUNGLE), ('glacier', '빙하', V.GLACIER), ('dune', '모래언덕', V.DUNE),
           ('farm', '밀밭', V.FARM), ('crop', '푸른 밭', V.CROP)]
backgrounds = ['sea', 'grass', 'sand', 'snow']
texture = {key: V.TEX[g].copy() for key, _, g in grounds}
class Sea:
    H = W = 3
    G = np.zeros((3, 3), np.int16)
    def inb(self, x, y): return 0 <= x < 3 and 0 <= y < 3
texture['sea'] = V.water_tile(Sea(), 1, 1, V.SEA)
texture['river'] = T._recolor_river(texture['sea'])
texture['lava'] = V._ramp_recolor(texture['sea'], V.LAVA_R)
texture['toxic'] = V._ramp_recolor(texture['sea'], V.TOXIC_R)

def add(a, kind, background, name, layer='lower', walk=True):
    i = len(tiles); tiles.append(Image.fromarray(a, 'RGBA'))
    meta.append(dict(kind=kind, background=background, label=name, layer=layer, walkable=walk))
    return i

def rgba(rgb): return np.dstack((rgb, np.full((16, 16), 255, np.uint8)))
for key in ['sea', *[g[0] for g in grounds]]:
    add(rgba(texture[key]), key, 'plain', '바다' if key == 'sea' else dict((k,n) for k,n,_ in grounds)[key], walk=key != 'sea')

def canonical(mask):
    for diagonal, first, second in [(16, 1, 2), (32, 2, 4), (64, 4, 8), (128, 8, 1)]:
        if not (mask & first and mask & second): mask &= ~diagonal
    return mask

masks = sorted(set(canonical(m) for m in range(256)))
assert len(masks) == 47
Q = {k: np.array([list(row) for row in rows]) for k, rows in P['quarters'].items()}

def quarter(v, h, d):
    return Q['outer'] if not v and not h else Q['north'] if not v else Q['north'].T if not h else Q['inner'] if not d else Q['body']

def blob(kind, bg, mask):
    # Each quarter reads its outward cardinal and diagonal bits.
    grid = np.full((16, 16), '.', dtype='<U1')
    for qx, qy, vb, hb, db in [(0,0,1,8,128),(1,0,1,2,16),(0,1,4,8,64),(1,1,4,2,32)]:
        q = quarter(bool(mask & vb), bool(mask & hb), bool(mask & db))
        if qx: q = np.fliplr(q)
        if qy: q = np.flipud(q)
        grid[qy*8:qy*8+8,qx*8:qx*8+8] = q
    a = rgba(texture[kind]); a[grid == 'o'] = rgba(texture[bg])[grid == 'o']
    wet = kind in ('river','lava','toxic','sea')
    shore = bg == 'sea' or wet
    rim = (226,206,146) if bg == 'sea' else (150,214,226) if wet else tuple(texture[kind][5,5])
    shade = (28,47,39) if kind not in ('snow','glacier') else (110,164,186)
    a[grid == 'e', :3] = rim if shore else texture[kind][grid == 'e']
    a[grid == 'f', :3] = (214,244,246) if shore else texture[bg][grid == 'f']
    a[grid == 'i', :3] = shade if shore else texture[kind][grid == 'i']
    return a

def group(kind, name, bg, fn, layer='lower', walk=True, neighborhood=8):
    used = {}; variants = {}
    for mask in range(256 if neighborhood == 8 else 16):
        m = canonical(mask) if neighborhood == 8 else mask
        if m not in used: used[m] = add(fn(m), kind, bg, name, layer, walk)
        variants[str(mask)] = used[m]
    brushes.append(dict(id=f'worldmap-brush-{kind}-{bg}', name=name, kind=kind, background=bg,
                        layer=layer, neighborhood=neighborhood, tiles=list(used.values()), variantMap=variants))

for bg in backgrounds:
    for key, name, _ in grounds:
        if key != bg: group(key, name + (' 해안' if bg == 'sea' else ''), bg, lambda m,k=key,b=bg: blob(k,b,m))
    if bg != 'sea':
        for key, name in [('sea','바다·호수'),('river','강'),('lava','용암'),('toxic','독수')]:
            group(key, name, bg, lambda m,k=key,b=bg: blob(k,b,m), walk=False)
        def road(mask, b=bg):
            a = rgba(texture[b]); fill = np.zeros((16,16), bool)
            # Composite the authored pixel parts; connected arms open the cap.
            edges = np.zeros((16,16), bool)
            for label, bit in [('center',0),('north',1),('east',2),('south',4),('west',8)]:
                if bit and not mask & bit: continue
                rows = np.array([list(row) for row in P['roadParts'][label]])
                edges |= rows == 'e'
                fill |= rows == 'w'
            a[edges, :3] = (130,106,63)
            a[fill, :3] = (199,174,113)
            return a
        group('road', '길', bg, road, neighborhood=4)

for kind, name, k in [('forest','활엽수 숲',V.BROAD),('conifer','침엽수 숲',V.CONIFER),('jungleforest','정글 숲',V.JUNGLEF),
                      ('deadforest','고사목 숲',V.DEAD),('snowforest','눈 숲',V.SNOWF),('mountain','산맥',V.MOUNT),
                      ('snowmountain','눈 산맥',V.SMOUNT),('volcano','화산 산맥',V.VOLC),('mesa','붉은 산맥',V.MESA)]:
    def obj(mask, k=k):
        a = np.zeros((16,16,4), np.uint8)
        for qx,qy,vb,hb,db in [(0,0,1,8,128),(1,0,1,2,16),(0,1,4,8,64),(1,1,4,2,32)]:
            role = 'iso' if mask == 0 else T.pick_role(bool(mask & vb), bool(mask & hb), bool(mask & db), qx, qy)
            rgb, alpha = V.obj_cell4(k, role)
            ys,xs = slice(qy*8,qy*8+8), slice(qx*8,qx*8+8)
            a[ys,xs,:3] = rgb[ys,xs]; a[ys,xs,3] = alpha[ys,xs].astype(np.uint8)*255
        return a
    group(kind, name, 'any', obj, layer='upper', walk=False)

for direction in ['horizontal','vertical']:
    a = rgba(texture['river'])
    grid = np.array([list(row) for row in P['bridgeHorizontal']])
    if direction == 'vertical': grid = grid.T
    for c, color in [('d',(82,53,31)),('l',(201,155,87)),('w',(157,106,54))]: a[grid == c,:3] = color
    tile = add(a, 'bridge-'+direction, 'water', '다리 · '+('가로' if direction == 'horizontal' else '세로'))
    brushes.append(dict(id='worldmap-brush-bridge-'+direction, name=meta[tile]['label'],kind=meta[tile]['kind'],background='water',layer='lower',tiles=[tile]))

cols = 12
sheet = Image.new('RGBA', (cols*16, ((len(tiles)+cols-1)//cols)*16))
for i,tile in enumerate(tiles): sheet.paste(tile, ((i%cols)*16,(i//cols)*16))
out = ROOT/'public/assets/worldmap-icons/worldmap-authoring.png'; out.parent.mkdir(parents=True,exist_ok=True); sheet.save(out)
data = dict(version=1,tileSize=16,tilesPerRow=cols,count=len(tiles),tiles=meta,brushes=brushes,
            sha256=hashlib.sha256(out.read_bytes()).hexdigest())
(ROOT/'src/assets/worldmapAuthoringSheet.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
preview = Image.new('RGBA', (8*64, ((len(brushes)+7)//8)*64), (28,36,44,255))
for i,b in enumerate(brushes): preview.paste(tiles[b.get('variantMap',{}).get('0',b['tiles'][0])].resize((64,64),Image.Resampling.NEAREST),((i%8)*64,(i//8)*64))
preview.save(ROOT/'tiledata/worldmap-kit/authoring/brushes.png')
print(json.dumps(dict(count=len(tiles),brushes=len(brushes),output=str(out))))
