#!/usr/bin/env python3
"""modern-tiles QA — 시안 장면을 «구운 실제 칸 번호»로 다시 짜서 맵 JSON(맵 객체 통째)과 그림으로 낸다.

  python3 scripts/content/modern-tiles/qa_scenes.py [composer.json]
    composer.json = qa/compose-street.mts 출력(있으면 60×48 seed 17 거리도 맵 파일로 옮긴다)

출력  tiledata/modern-city/qa/modern-tiles/mt-mc-*.json   (id·name·width·height·tilesetId·tileSize·lowerTiles·lowerOverlayTiles·upperTiles·upperOverlayTiles)
      ~/claude-viz/modern-tiles-proto/baked/mc-*-{1x,4x}.png, mc-compare-*.png(시안 after | 구운 칸)
"""
import json
import os
import sys
import zlib

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEF = json.load(open(os.path.join(ROOT, 'src/assets/modernCityTileset.json')))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')).convert('RGBA')
TPR = DEF['tilesPerRow']
K = {k['id']: k for k in DEF['structureKits']}
GR = {g['id']: g['tileIds'] for g in DEF['tileGroups']}
OUT_MAP = os.path.join(ROOT, 'tiledata/modern-city/qa/modern-tiles')
OUT_IMG = os.path.expanduser('~/claude-viz/modern-tiles-proto/baked')
PROTO = os.path.expanduser('~/claude-viz/modern-tiles-proto')


def h(x, y, k):
    return (zlib.crc32(f'{x},{y},{k}'.encode()) % 100000) / 100000


def var(ids, common, x, y, rare, salt):
    if h(x, y, salt) < rare and len(ids) > common:
        return ids[common + int(h(x, y, salt + 1) * (len(ids) - common))]
    return ids[int(h(x, y, salt + 2) * min(common, len(ids)))]


class Map:
    def __init__(self, mid, name, W, H):
        self.id, self.name, self.W, self.H = mid, name, W, H
        self.L = [GR['mc:paving'][0]] * (W * H); self.L2 = [-1] * (W * H); self.U = [-1] * (W * H); self.U2 = [-1] * (W * H)
        self.bld = set()

    def i(self, x, y):
        return y * self.W + x

    def stamp(self, kid, x, y, dress=True):
        k = K[kid]
        for r, row in enumerate(k['rows']):
            for c in range(k['width']):
                X, Y = x + c, y + r
                if not (0 <= X < self.W and 0 <= Y < self.H):
                    continue
                lo = row['tiles'][c]; up = (row.get('upperTiles') or [-1] * k['width'])[c]
                if lo >= 0:
                    self.L[self.i(X, Y)] = lo
                if up >= 0:
                    i = self.i(X, Y)
                    if self.U[i] >= 0:
                        self.U2[i] = up
                    else:
                        self.U[i] = up
                    if kid.startswith('mc-bld-'):
                        self.bld.add(i)
        return k

    def dress(self, kid, x, y):
        for dx, dy, t in K[kid].get('ai', {}).get('dress', []):
            X, Y = x + dx, y + dy
            if 0 <= X < self.W and 0 <= Y < self.H and self.i(X, Y) not in self.bld:
                self.L2[self.i(X, Y)] = t

    def obj(self):
        return dict(id=self.id, name=self.name, width=self.W, height=self.H, tilesetId='modern_city', tileSize=16,
                    lowerTiles=self.L, lowerOverlayTiles=self.L2, upperTiles=self.U, upperOverlayTiles=self.U2, events=[])


def cell(t):
    return SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))


def render(m):
    W, H = m['width'], m['height']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for key in ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles'):
        for i, t in enumerate(m.get(key) or []):
            if t is not None and t >= 0:
                im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    return im


def save(m, short):
    os.makedirs(OUT_MAP, exist_ok=True); os.makedirs(OUT_IMG, exist_ok=True)
    json.dump(m, open(os.path.join(OUT_MAP, m['id'] + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    im = render(m)
    im.save(os.path.join(OUT_IMG, f'mc-{short}-1x.png'))
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUT_IMG, f'mc-{short}-4x.png'))
    return im


def compare(short, proto_png, baked, scale=2, title=''):
    p = Image.open(proto_png).convert('RGBA')
    pw = p.resize((p.width * scale, p.height * scale), Image.NEAREST); bw = baked.resize((baked.width * scale, baked.height * scale), Image.NEAREST)
    o = Image.new('RGBA', (pw.width + bw.width + 24, max(pw.height, bw.height) + 28), (40, 42, 48, 255))
    o.alpha_composite(pw, (0, 28)); o.alpha_composite(bw, (pw.width + 24, 28))
    d = ImageDraw.Draw(o); d.text((4, 6), 'PROTOTYPE (approved)', fill=(255, 255, 255, 255)); d.text((pw.width + 28, 6), 'BAKED ids ' + title, fill=(255, 255, 255, 255))
    o.save(os.path.join(OUT_IMG, f'mc-compare-{short}.png'))


def finish(m, grass_rows=None):
    """composer finishGround 와 같은 규칙: 변형 섞기 + 잔디/보도 경계석."""
    asph, pav, grs = GR['mc:asphalt'], GR['mc:paving'], GR['mc:grass']
    gset = set(grs) | set(GR.get('mc:lawn', [])) | set(GR.get('mc:green', [])); pset = set(pav)
    before = list(m.L)
    for y in range(m.H):
        for x in range(m.W):
            i = m.i(x, y); t = before[i]
            if t == asph[0]:
                m.L[i] = var(asph, 5, x, y, .05, 21)
            elif t == pav[0]:
                m.L[i] = var(pav, 4, x, y, .04, 31)
            elif t == grs[0]:
                m.L[i] = var(grs, 4, x, y, .08, 11)
            n = before[i - m.W] if y > 0 else -1; s = before[i + m.W] if y + 1 < m.H else -1
            if t in gset and s in pset:
                m.L[i] = GR['mc:grass-edge-s'][int(h(x, y, 41) * 3)]
            elif t in gset and n in pset:
                m.L[i] = GR['mc:grass-edge-n'][int(h(x, y, 42) * 2)]
            elif t in pset and n in gset:
                m.L[i] = GR['mc:paving-under-grass'][int(h(x, y, 43) * 3)]


def ground_scene():
    """시안 ground/src/build.py scene() 20×18 — 같은 배치를 구운 칸으로."""
    m = Map('mt-mc-ground', 'modern-tiles QA · 바닥 장면 20×18', 20, 18)
    sec = K['mc-street-ew-section']['rows']
    gut_n, gut_s = sec[3]['tiles'][0], sec[8]['tiles'][0]
    cross = {9, 10}
    for r in range(18):
        for c in range(20):
            i = m.i(c, r)
            if r <= 8:
                m.L[i] = GR['mc:grass'][0]
            elif r == 9:
                m.L[i] = GR['mc:tactile'][0] if c in cross else GR['mc:paving'][0]
            elif r == 10:
                m.L[i] = 9
            elif r == 17:
                m.L[i] = 10
            else:
                rr = r - 11
                m.L[i] = {0: gut_n, 2: 77, 3: 78, 5: gut_s}.get(rr, GR['mc:asphalt'][0])
                if c in cross and 1 <= rr <= 4:
                    m.L[i] = 5
    places = [('mc-bld-low3-A-roof-lgray', 1, 1), ('mc-bld-office-B-roof-teal', 8, 2), ('mc-bld-conv-B-roof-brick', 15, 4)]
    for kid, x, y in places:
        k = K[kid]; m.stamp(kid, x, y)
    finish(m)
    # 시안처럼 점자 블록은 그대로
    for c in cross:
        m.L[m.i(c, 9)] = GR['mc:tactile'][0]
    for kid, x, y in places:
        m.dress(kid, x, y)
    return m


def outline_scene():
    """시안 outline/src/scene.py 26×16 — 같은 배치(나무 = 보도 나무 구덩이 판)."""
    m = Map('mt-mc-street', 'modern-tiles QA · 거리 장면 26×16', 26, 16)
    for ty in range(16):
        for tx in range(26):
            m.L[m.i(tx, ty)] = GR['mc:grass'][0] if ty < 10 else GR['mc:paving'][0] if ty < 12 else GR['mc:asphalt'][0]
    finish(m)
    blds = [('mc-bld-house-modern-C', 1, 4), ('mc-bld-low3-A', 7, 2), ('mc-bld-cafe-A', 14, 4)]
    for kid, x, y in blds:
        m.stamp(kid, x, y)
    for kid, x, y in blds:
        m.dress(kid, x, y)
    trees = [('mc-prop-street-tree-pit-a', 6, 8), ('mc-prop-street-tree-pit-b', 13, 8), ('mc-prop-keyaki-pit-b', 20, 6), ('mc-prop-street-tree-pit-a', 24, 8)]
    props = [('mc-prop-bench-a', 2, 11), ('mc-prop-stall-a', 10, 10), ('mc-prop-bench-a', 17, 11), ('mc-prop-vending-a', 19, 10), ('mc-veh-sedan-a-red', 9, 12)]
    for kid, x, y in trees + props:
        if kid in K:
            m.stamp(kid, x, y)
    return m


def composer_map(path):
    d = json.load(open(path))['maps']
    mid = next(k for k in d if k.startswith('mcs-60x48-s17'))
    s = d[mid]
    return dict(id='mt-mc-composer-60x48-s17', name='modern-tiles QA · 거리 구성기 60×48 seed 17', width=s['width'], height=s['height'], tilesetId='modern_city', tileSize=16,
                lowerTiles=s['lower'], lowerOverlayTiles=s['lower2'] or [-1] * (s['width'] * s['height']), upperTiles=s['upper'],
                upperOverlayTiles=s['upper2'] or [-1] * (s['width'] * s['height']), events=[], transit=(s.get('transit') or None))


def sidewalk_vs_beodeul():
    """보도 20×6 판(구운 칸, 구성기와 같은 변형 섞기) | 버들항 포장 20×6 — 1배·4배."""
    pav = GR['mc:paving']
    a = Image.new('RGBA', (320, 96))
    for y in range(6):
        for x in range(20):
            a.alpha_composite(cell(var(pav, 4, x, y, .04, 31)), (x * 16, y * 16))
    BD = json.load(open(os.path.join(ROOT, 'src/assets/beodeulCityTileset.json')))
    bs = Image.open(os.path.join(ROOT, 'public/assets/beodeul-city/beodeul-city-chipset.png')).convert('RGBA')
    bt = BD['tilesPerRow']; bp = next(g['tileIds'] for g in BD['tileGroups'] if g['id'] == 'beodeul:paving')
    b = Image.new('RGBA', (320, 96))
    for y in range(6):
        for x in range(20):
            t = bp[int(h(x, y, 7) * len(bp))]
            b.alpha_composite(bs.crop(((t % bt) * 16, (t // bt) * 16, (t % bt) * 16 + 16, (t // bt) * 16 + 16)), (x * 16, y * 16))
    for sc in (1, 4):
        o = Image.new('RGBA', (320 * sc * 2 + 16 * sc, 96 * sc + 20), (40, 42, 48, 255))
        o.alpha_composite(a.resize((320 * sc, 96 * sc), Image.NEAREST), (0, 20)); o.alpha_composite(b.resize((320 * sc, 96 * sc), Image.NEAREST), (320 * sc + 16 * sc, 20))
        d = ImageDraw.Draw(o); d.text((4, 4), 'modern_city mc:paving (baked)', fill=(255, 255, 255, 255)); d.text((320 * sc + 16 * sc + 4, 4), 'beodeul:paving', fill=(255, 255, 255, 255))
        o.save(os.path.join(OUT_IMG, f'mc-compare-sidewalk-beodeul-{sc}x.png'))


if __name__ == '__main__':
    sidewalk_vs_beodeul()
    g = ground_scene().obj(); gi = save(g, 'ground')
    compare('ground', os.path.join(PROTO, 'ground/scene-after-1x.png'), gi, 2, '(ground 20x18)')
    s = outline_scene().obj(); si = save(s, 'street')
    compare('street', os.path.join(PROTO, 'outline/img/scene-mc-after-1x.png'), si, 2, '(street 26x16)')
    if len(sys.argv) > 1:
        c = composer_map(sys.argv[1]); c.pop('transit', None); save(c, 'composer-60x48-s17')
    print('ok', OUT_MAP, OUT_IMG)
