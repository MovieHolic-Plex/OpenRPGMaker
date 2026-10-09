# 렌더 합치기·통행 격자·BFS·빈 바닥 검사·비교 시트.
import os, json
from mc_base import *

GAP = 2   # 두 판 사이 빈 줄(칸)


def empty_stats(om, win=(20, 15)):
    """빈 바닥 = 포장도 소품·건물·나무도 없는 풀 칸. 20×15 창 최악·평균."""
    W, H = om.road.shape[1], om.road.shape[0]
    paved = om.road | om.plaza | om.brick | om.gravel | om.avenue
    e = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            e[y, x] = not paved[y, x] and (x, y) not in om.occ and (x, y) not in om.gpath and (x, y) not in om.block
    worst = (0, None); tot = []
    for y0 in range(0, H - win[1] + 1):
        for x0 in range(0, W - win[0] + 1):
            r = e[y0:y0 + win[1], x0:x0 + win[0]].mean(); tot.append(r)
            if r > worst[0]: worst = (r, (x0, y0))
    return round(worst[0], 2), worst[1], round(float(np.mean(tot)), 2)


def finish(OUT, om, omarks, oimg, im_, imarks, iimg, PARTS):
    OW, OH = oimg.width // T, oimg.height // T
    IW, IH = iimg.width // T, iimg.height // T
    W = max(OW, IW); H = OH + GAP + IH
    canvas = Image.new('RGBA', (W * T, H * T), (12, 10, 16, 255))
    canvas.alpha_composite(oimg, (0, 0)); canvas.alpha_composite(iimg, (0, (OH + GAP) * T))
    canvas.convert('RGB').save(os.path.join(OUT, 'render-1x.png'))
    canvas.resize((W * T * 2, H * T * 2), Image.NEAREST).convert('RGB').save(os.path.join(OUT, 'render-2x.png'))
    grid = [['0'] * W for _ in range(H)]
    for y in range(OH):
        for x in range(OW): grid[y][x] = '1' if om.walk(x, y) else '0'
    for y in range(IH):
        for x in range(IW): grid[OH + GAP + y][x] = '1' if im_.is_walk(x, y) else '0'
    d = om.dist(omarks['entrance'])
    owp = {k: dict(at=list(v), reach=tuple(v) in d, steps=d.get(tuple(v))) for k, v in omarks.items()}
    walk_o = [(x, y) for y in range(OH) for x in range(OW) if om.walk(x, y)]
    iso_o = [c for c in walk_o if c not in d]
    iwp = {k: dict(at=list(v), reach=bool(im_.bfs(imarks['entrance'], v))) for k, v in imarks.items()}
    comps = im_.components()
    es = empty_stats(om)
    data = dict(name='mansion-art-city', tile=T, width=W, height=H, legend={'1': '걷는다', '0': '막힘(벽·물·소품·건물 앞면·판 사이 빈 줄)'},
                maps=[dict(name='outdoor', x=0, y=0, w=OW, h=OH, entrance=list(omarks['entrance']), waypoints=owp,
                           walk_cells=len(walk_o), isolated=len(iso_o), isolated_cells=[list(c) for c in iso_o[:20]],
                           empty_floor_20x15=dict(worst=es[0], at=es[1], mean=es[2])),
                      dict(name='mansion_interior', x=0, y=OH + GAP, w=IW, h=IH, entrance=list(imarks['entrance']), waypoints=iwp,
                           walk_components=len(comps), component_sizes=sorted([len(c) for c in comps], reverse=True)[:4])],
                links=[dict(a=['outdoor', list(omarks['mansion_door'])], b=['mansion_interior', list(imarks['entrance'])], kind='door'),
                       dict(a=['mansion_interior', list(imarks['stair_top'])], b=['mansion_upper', None], kind='stair_up', note='위층(침실층)은 이 판 밖')],
                grid=[''.join(r) for r in grid])
    json.dump(data, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False, indent=1)
    print('outdoor reach', {k: v['reach'] for k, v in owp.items()}, 'isolated', len(iso_o), 'empty', es)
    print('indoor reach', {k: v['reach'] for k, v in iwp.items()}, 'comps', len(comps))
    return data


def compare(OUT, canvas_path=None):
    """비교 시트: 같은 2x 배율로 [버들항 기준 크롭 | 이 장소 크롭] 을 줄마다 나란히."""
    from PIL import ImageDraw
    ROOT = os.path.abspath(os.path.join(OUT, '..', '..', '..'))
    city = Image.open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA')
    opera = Image.open(os.path.join(OUT, '..', 'opera-stage', 'render-1x.png')).convert('RGBA')
    me = Image.open(os.path.join(OUT, 'render-1x.png')).convert('RGBA')
    OH = 38
    rows = [
        ('beodeul city6_base: noble estate (ref)', city, (600, 40, 880, 330), 'mansion-art-city: noble mansion + forecourt', me, (64, 0, 344, 290)),
        ('beodeul city6_base: forum, fountain, cafe (ref)', city, (880, 540, 1200, 780), 'mansion-art-city: sculpture plaza + gallery + cafe', me, (600, 40, 920, 280)),
        ('beodeul city6_base: houses + street (ref)', city, (400, 660, 700, 880), 'mansion-art-city: art street houses + boulevard', me, (560, 380, 860, 600)),
        ('beodeul city6_base: estate garden (ref)', city, (640, 160, 900, 360), 'mansion-art-city: formal garden, parterres, gate', me, (20, 300, 280, 500)),
        ('opera-stage: lobby marble + stair (ref, wave 2)', opera, (0, 420, 380, 600), 'mansion-art-city: grand hall + stair (interior)', me, (230, (OH + GAP) * 16, 590, (OH + GAP) * 16 + 260)),
        ('opera-stage: box seats + hall walls (ref, wave 2)', opera, (0, 180, 300, 440), 'mansion-art-city: drawing room + library', me, (0, (OH + GAP) * 16, 230, (OH + GAP) * 16 + 340)),
        ('opera-stage: backstage + dressing room (ref, wave 2)', opera, (800, 60, 1240, 300), 'mansion-art-city: dining room + painting corridor', me, (500, (OH + GAP) * 16, 736, (OH + GAP) * 16 + 340)),
    ]
    S = 2; pad = 10; lab = 14
    tiles = []
    for (la, ia, ba, lb, ib, bb) in rows:
        a = ia.crop(ba); b = ib.crop(bb)
        a = a.resize((a.width * S, a.height * S), Image.NEAREST); b = b.resize((b.width * S, b.height * S), Image.NEAREST)
        tiles.append((la, a, lb, b))
    Wl = max(t[1].width for t in tiles); Wr = max(t[3].width for t in tiles)
    Ht = sum(max(t[1].height, t[3].height) + lab + pad for t in tiles) + pad
    sh = Image.new('RGBA', (Wl + Wr + pad * 3, Ht), (28, 30, 34, 255)); d = ImageDraw.Draw(sh)
    y = pad
    for (la, a, lb, b) in tiles:
        d.text((pad, y), la, fill=(220, 220, 220, 255)); d.text((pad * 2 + Wl, y), lb, fill=(220, 220, 220, 255))
        sh.alpha_composite(a, (pad, y + lab)); sh.alpha_composite(b, (pad * 2 + Wl, y + lab))
        y += max(a.height, b.height) + lab + pad
    sh.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
    return sh.size


def compare_fix(OUT, PARTS):
    """보정 패스 비교 시트: 같은 2x 로 [이전 판(_qa/before-render-1x.png) | 새 판] 을 달라진 곳마다 나란히,
    맨 위 줄은 버들항 기준(city6_base 저택 지붕) 옆에 저택 지붕 세 판."""
    from PIL import ImageDraw
    ROOT = os.path.abspath(os.path.join(OUT, '..', '..', '..'))
    city = Image.open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA')
    old = Image.open(os.path.join(OUT, '_qa', 'before-render-1x.png')).convert('RGBA')
    me = Image.open(os.path.join(OUT, 'render-1x.png')).convert('RGBA')
    roofs = Image.new('RGBA', (272 * 3 + 20, 176), (0, 0, 0, 0))
    for i, k in enumerate(('mansion', 'mansion_slate', 'mansion_copper')): roofs.alpha_composite(PARTS[k], (i * 282, 0))
    rows = [
        ('beodeul city6_base: estate roofs (ref)', city, (600, 40, 880, 220), 'roof variants: mansion (old red) | mansion_slate | mansion_copper', roofs, None),
        ('BEFORE: flat basket-brick avenue + house_s1', old, (480, 380, 680, 600), 'AFTER: herringbone avenue + dark border band + junction rotary', me, (480, 380, 680, 600)),
        ('BEFORE: avenue north (flat)', old, (470, 0, 600, 200), 'AFTER: herringbone + border band + cream line', me, (470, 0, 600, 200)),
        ('BEFORE: lower garden = parterres + hedge rows', old, (40, 430, 470, 545), 'AFTER: garden pond (autotile) + 3-colour flowerbed blobs', me, (40, 430, 470, 545)),
        ('BEFORE: mansion red roof', old, (100, 30, 400, 200), 'AFTER: blue-grey slate + stone chimneys with clay pots, leaf-litter under trees', me, (30, 30, 470, 200)),
        ('BEFORE: gallery red roof', old, (660, 50, 820, 180), 'AFTER: gallery copper roof (green verdigris, copper-hooded chimney)', me, (660, 50, 820, 180)),
    ]
    S = 2; pad = 10; lab = 14; tiles = []
    for (la, ia, ba, lb, ib, bb) in rows:
        a = ia.crop(ba); b = ib.crop(bb) if bb else ib
        a = a.resize((a.width * S, a.height * S), Image.NEAREST); b = b.resize((b.width * S, b.height * S), Image.NEAREST)
        tiles.append((la, a, lb, b))
    Wl = max(t[1].width for t in tiles); Wr = max(t[3].width for t in tiles)
    Ht = sum(max(t[1].height, t[3].height) + lab + pad for t in tiles) + pad
    sh = Image.new('RGBA', (Wl + Wr + pad * 3, Ht), (28, 30, 34, 255)); d = ImageDraw.Draw(sh); y = pad
    for (la, a, lb, b) in tiles:
        d.text((pad, y), la, fill=(220, 220, 220, 255)); d.text((pad * 2 + Wl, y), lb, fill=(220, 220, 220, 255))
        if a.mode == 'RGBA': bg = Image.new('RGBA', a.size, (88, 140, 60, 255)); bg.alpha_composite(a); a = bg
        bg = Image.new('RGBA', b.size, (88, 140, 60, 255)); bg.alpha_composite(b); b = bg
        sh.alpha_composite(a, (pad, y + lab)); sh.alpha_composite(b, (pad * 2 + Wl, y + lab))
        y += max(a.height, b.height) + lab + pad
    sh.convert('RGB').save(os.path.join(OUT, 'compare-ref.png'))
    return sh.size
