#!/usr/bin/env python3
"""현대(강남) 세트: 강남역 맵(modern-gangnam-station)에 쓰인 조각을 기물 단위로 묶어 「v0 현재판」과 맥락 그림을 만든다.
  python3 scripts/content/atlas-pick/make_modern_set.py

읽는 것(읽기만): src/assets/atlasBiomeTilesets.json(biomes.modern.extraTileGroups — 조각 id·칸·층·설명),
  tiledata/atlas-biomes/modern/catalog.json(maps.modern-gangnam-station 칸 배열), public/assets/atlas-biomes/modern-chipset.png.
쓰는 것: tiledata/atlas-pick/items-modern.json, candidates-modern/<slug>/{info.json, v0.png, members.png, ctx-base.png, ctx-under.png, palette.pal},
  palette/modern.pal(현대 칩셋 pal.RAMPS).
기물 = 같은 모양의 색·방향·번호 변형 묶음(버스 3색×2방향 → 「시내버스」 하나). 대표 조각(첫 변형)이 v0, 나머지는 members.png 에 줄로.
건물 블록(gnb-·mob-)은 블록 이름(외벽·골목 간판 층 …, 골목 간판 층은 재료별)으로 묶는다. EasyRPG 칸(0~2729)을 쓰는 조각은 빼다."""
import collections, json, os, re, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

MAP_ID = 'modern-gangnam-station'
FAM = [   # (정규식, 기물 id, 이름)
    (r'^gn-bus-(blue|green|red)-[sn]$', 'gn-bus', '시내버스(간선·지선·광역)'),
    (r'^gn-car-v-', 'gn-car-v', '승용차·택시(세로)'),
    (r'^gn-car-h-', 'gn-car-h', '승용차·택시(가로)'),
    (r'^gn-exit-\d+$', 'gn-exit', '지하철 출구(번호판)'),
    (r'^gn-island-roof-', 'gn-island-roof', '버스 정류장 섬 지붕'),
    (r'^gn-media-pole-', 'gn-media-pole', '미디어폴'),
    (r'^gn-led-', 'gn-led', 'LED 전광판'),
    (r'^gn-vsign-', 'gn-vsign', '세로 돌출 간판'),
    (r'^gn-hoarding-', 'gn-hoarding', '공사 가림막'),
    (r'^gn-bench-', 'gn-bench', '벤치(강남)'),
    (r'^gn-sw-tac-', 'gn-sw-tac', '점자블록'),
    (r'^gn-arrow-', 'gn-arrow', '노면 화살표'),
    (r'^gn-signal-arm-', 'gn-signal-arm', '가로형 신호등'),
    (r'^gn-people-', 'gn-people', '행인 무리'),
    (r'^gn-bus-(w\d|line)', 'gn-bus-lane', '버스전용차로 표시(글자·파란 선)'),
    (r'^mo-lane-', 'mo-lane', '차선(노란 중앙선·흰 점선)'),
    (r'^mo-crosswalk', 'mo-crosswalk', '횡단보도'),
    (r'^mo-stop-', 'mo-stop', '멈춤선'),
]
SCENE = [(r'^(gn-bus|gn-car|gn-delivery)', '차'), (r'^(mo-lane|mo-crosswalk|mo-stop|gn-arrow|gn-bus-lane|gn-hatch|gn-sw-|mo-manhole|mo-drain)', '도로·보도 표시'),
         (r'^(gn-signal|mo-ped-signal|mo-streetlamp|gn-media|gn-route|gn-bus-led)', '신호·가로 시설'), (r'^blk-', '건물 블록'),
         (r'^(gn-exit|gn-mall|gn-island|gn-vent)', '역·정류장'), (r'^(gn-led|gn-vsign|gn-air)', '간판·전광판'), (r'', '거리 소품')]

def pid_of(g): return g['id'].split(':', 1)[1]

def fam_of(g):
    p = pid_of(g)
    for rx, fid, name in FAM:
        if re.search(rx, p): return fid, name
    if p.startswith(('gnb-', 'mob-')):
        n = g['name'].replace('현대 도시 · ', '').split(' · '); code = n[-1]
        if code.startswith('gb.al.'):
            mat = code.split('.')[2]; return f'blk-al-{mat}', f'{n[0]} · {dict(brk="벽돌", con="콘크리트", til="타일").get(mat, mat)}'
        return 'blk-' + re.sub(r'[^a-z0-9]+', '-', '.'.join(code.split('.')[:2]).lower()).strip('-'), n[0] + (' (' + '.'.join(code.split('.')[:2]) + ')' if n[0] in ('외벽', '평지붕', '옥상 설비', '현관', '건물 그늘 인도') else '')
    return p, g['name'].replace('현대 도시 · ', '')

def main():
    sys.path.insert(0, MODERN_LIB); import pal
    groups = json.load(open(os.path.join(ROOT, 'src/assets/atlasBiomeTilesets.json'), encoding='utf-8'))['biomes']['modern']['extraTileGroups']
    m = json.load(open(os.path.join(ROOT, 'tiledata/atlas-biomes/modern/catalog.json'), encoding='utf-8'))['maps'][MAP_ID]
    W, H = m['width'], m['height']; low = np.array(m['lowerTiles']).reshape(H, W); up = np.array(m['upperTiles']).reshape(H, W)
    used = set(low.ravel().tolist()) | set(up.ravel().tolist())
    sheet = Image.open(MODERN_SHEET).convert('RGBA')
    cell = {}
    def C(t):
        if t not in cell: cell[t] = sheet.crop(((t % 30) * 16, (t // 30) * 16, (t % 30) * 16 + 16, (t // 30) * 16 + 16))
        return cell[t]
    def piece_img(g):
        pm = g['previewMap']; w, h = pm['width'], pm['height']; im = Image.new('RGBA', (w * 16, h * 16)); ids = set(g['tileIds'])
        for k in range(w * h):
            for lay in ('lowerTiles', 'upperTiles'):
                t = pm[lay][k]
                if t in ids: im.alpha_composite(C(t), ((k % w) * 16, (k // w) * 16))
        return im
    def render(x0, y0, x1, y1, skip=frozenset()):
        im = Image.new('RGBA', ((x1 - x0) * 16, (y1 - y0) * 16), (0, 0, 0, 255))
        for y in range(y0, y1):
            for x in range(x0, x1):
                for L in (low, up):
                    t = int(L[y, x])
                    if t >= 0 and (x, y, t) not in skip: im.alpha_composite(C(t), ((x - x0) * 16, (y - y0) * 16))
        return im
    def locate(g):
        """조각이 맵에 처음 놓인 자리(왼쪽 위 칸). 대표 칸 = previewMap 첫 조각 칸."""
        pm = g['previewMap']; w = pm['width']; ids = set(g['tileIds'])
        for k in range(len(pm['lowerTiles'])):
            for lay, L in (('upperTiles', up), ('lowerTiles', low)):
                t = pm[lay][k]
                if t in ids:
                    ys, xs = np.nonzero(L == t)
                    if len(xs):
                        return int(xs[0]) - k % w, int(ys[0]) - k // w
        return None

    fams = collections.OrderedDict()
    for g in groups:
        if not set(g['tileIds']) & used: continue
        if min(g['tileIds']) <= EASYRPG_LAST: continue   # EasyRPG 칸을 쓰는 조각은 목록에서 뺀다
        fid, name = fam_of(g)
        fams.setdefault(fid, dict(name=name, members=[]))['members'].append(g)
    cd = os.path.join(BASE, 'candidates-modern'); os.makedirs(cd, exist_ok=True)
    # 팔레트: 현대 칩셋 RAMPS (강남 조각이 쓰는 색 그대로)
    lines = ['// 현대 세트 팔레트 — scripts/content/lib/modern/pal.py RAMPS(현대 시트 자기 칸에서 뽑은 색). make_modern_set.py 가 만든다.', '']
    lines += ['@rampc m%-7s ' % n + ' '.join('#' + h for h in r) for n, r in pal.RAMPS.items()]
    lines += ['', '~ #141218 110', '- #141218 58', '% #fff8d0 120', '# #e040c0']
    # 강남 조각 v0 는 팔레트 밖 색(시트에서 구운 그림자 등)도 쓴다 — 후보가 v0 색을 그대로 쓸 수 있게 v0 색을 한 글자 색으로 더하지 않고, 검사가 v0 색을 허용한다
    os.makedirs(PAL_DIR, exist_ok=True); atomic_write(os.path.join(PAL_DIR, 'modern.pal'), '\n'.join(lines) + '\n')
    items = []
    for fid, f in fams.items():
        rep = f['members'][0]; s = slug(fid); d = os.path.join(cd, s); os.makedirs(d, exist_ok=True)
        pm = rep['previewMap']; w, h = pm['width'], pm['height']
        layer = 'ground' if rep['cellLayers'] and all(l == 'lower' for l in rep['cellLayers']) else 'object'
        piece_img(rep).save(os.path.join(d, 'v0.png'))
        # 변형 줄: 한 줄에 폭 합 ≤ 24칸, 조각 사이 4px
        ims = [piece_img(g) for g in f['members']]; rows = [[]]; acc = 0; G = 0 if fid.startswith('blk-') else 4   # 블록은 붙여서(칸끼리 이어 보이게)
        for im in ims:
            if acc and acc + im.width > 24 * 16: rows.append([]); acc = 0
            rows[-1].append(im); acc += im.width + G
        RW = max(sum(i.width + G for i in r) for r in rows); RH = [max(i.height for i in r) for r in rows]
        mem = Image.new('RGBA', (RW, sum(RH) + G * len(rows))); y = 0
        for r, rh in zip(rows, RH):
            x = 0
            for im in r: mem.alpha_composite(im, (x, y + rh - im.height)); x += im.width + G
            y += rh + G
        mem.save(os.path.join(d, 'members.png'))
        ctx = None; at = locate(rep)
        if at:
            x, y = at; x0, y0 = max(0, x - 3), max(0, y - 3); x1, y1 = min(W, x + w + 3), min(H, y + h + 3)
            ids = set(rep['tileIds'])
            skip = {(xx, yy, int(L[yy, xx])) for yy in range(y, min(H, y + h)) for xx in range(x, min(W, x + w)) for L in (low, up) if int(L[yy, xx]) in ids}
            render(x0, y0, x1, y1).save(os.path.join(d, 'ctx-base.png'))
            under = render(x0, y0, x1, y1, skip).crop(((x - x0) * 16, (y - y0) * 16, (x - x0 + w) * 16, (y - y0 + h) * 16))
            under.save(os.path.join(d, 'ctx-under.png'))
            ctx = dict(at=[(x - x0) * 16, (y - y0) * 16], map=MAP_ID, cell=[x, y])
        shutil.copyfile(os.path.join(PAL_DIR, 'modern.pal'), os.path.join(d, 'palette.pal'))
        sc = next(n for rx, n in SCENE if re.search(rx, fid))
        it = dict(id=fid, slug=s, name=f['name'], scene=sc, cells=[w, h], canvas=[w * 16, h * 16], layer=layer, layer_ko=LAYERS[layer][0],
                  description=(rep.get('description') or '').strip(), palette_hint='현대 칩셋 m* 램프 + v0 가 쓰는 색', worker='-',
                  members=[pid_of(g) for g in f['members']], tiles=sorted({t for g in f['members'] for t in g['tileIds']}), ctx=ctx)
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n'); items.append(it)
    items.sort(key=lambda i: ([n for _, n in SCENE].index(i['scene']), i['id']))
    atomic_write(os.path.join(BASE, 'items-modern.json'), json.dumps(dict(version=1, set='modern', map=MAP_ID,
        note='강남역 맵에 쓰인 현대 조각을 기물(변형 묶음) 단위로. v0 = 지금 시트 판. make_modern_set.py 가 만든다.', items=items), ensure_ascii=False, indent=1) + '\n')
    print(len(items), '기물 ·', sum(len(i['members']) for i in items), '조각 ·', collections.Counter(i['scene'] for i in items))

if __name__ == '__main__':
    main()
