# 증기 도시 거리 (steam-city) — 64x48 JRPG 마을 구역(증기·황동·톱니). 다시 돌리면 같은 그림이 나온다.   python3 make_steam_city.py
# 동선: 남쪽 입구(아래 끝 차도) → 남쪽 줄집 사이 골목 → 가운데 시계탑 광장(증기 분수·톱니 기념비) → 시계탑 문.
#       광장 서쪽 = 보일러 집·굴뚝·증기 탱크의 철판 공장 마당(길 위를 건너는 관 다리), 동쪽 = 석탄 깔때기·급수탑의 석탄 마당.
#       북쪽 = 벽돌 줄집·가게 줄(벽을 타는 놋쇠 관), 그 앞 젖은 자갈 큰 길과 가스등.
# 칠하는 순서 = 맨 바탕 표본(자갈 → 보도·광장·철판·재) → 땅 덩이 오토타일(기름·증기 물·석탄 가루) → 건물·소품.
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
from sc_base import *
from sc_scene import Scene
import sc_meta as M
HERE = os.path.dirname(os.path.abspath(__file__))

W, H = 64, 48
s = Scene(W, H, seed=64)
IM = {p[0]: p[1] for p in M.PARTS}
_cache = {}


def img(name, flip=False):
    k = (name, flip)
    if k not in _cache:
        im = IM[name]()
        _cache[k] = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    return _cache[k]


CLASH = []


def put(name, x, y, block='bottom', rows=1, flip=False, walk=(), **kw):
    before = s.block.copy(); occ0 = set(s.occ)
    s.at(img(name, flip), x, y, block=block, rows=rows, name=name, walk=walk, **kw)
    new = s.block & ~before
    hit = [(cx, cy) for cy in range(s.H) for cx in range(s.W) if (s.block[cy, cx] and before[cy, cx] and (cx, cy) in occ0
           and (cx, cy) in {(x + i, y - j) for i in range(-(-img(name, flip).width // 16)) for j in range(rows)})]
    if hit: CLASH.append((name, x, y, hit[:3]))


def house(name, x, y, flip=False):
    kw, d, br = M.HOUSES[name]
    wc = kw['wc']; dd = (wc - 1 - d) if flip else d
    put(name, x, y, rows=br, flip=flip, walk=[(dd, 0)])
    s.marks['door_%s_%d_%d' % (name, x, y)] = (x + dd, y)
    return x + wc


R = lambda k, x0, y0, x1, y1: s.rect(k, x0, y0, x1, y1)

# ================================================================ 1. 맨 바탕 표본 (차도 자갈은 기본값 — 나머지를 덮는다)
# 구역은 직사각형이 아니다: 광장은 모서리를 깎고 남쪽으로 입구 골목까지 판석이 흘러내리고, 공장 마당·석탄 마당은 줄마다 경계가 들쭉날쭉하다.
def rows_mask(key, spans):
    for (y, x0, x1) in spans: R(key, x0, y, x1, y)

PLAZA = []
for y in range(13, 34):
    c = max(0, 2 - (y - 13), 2 - (33 - y))
    PLAZA.append((y, 23 + c, 40 - c))
rows_mask('plaza', PLAZA)
R('plaza', 27, 34, 36, 34)                                             # 광장 앞마당 → 입구 골목
R('plaza', 29, 35, 34, 45)                                             # 입구 골목 판석(입구에서 광장까지 이어진 포장)
XR = {**{y: 17 for y in range(13, 19)}, **{y: 16 for y in range(19, 25)}, **{y: 18 for y in range(25, 30)}, **{y: 15 for y in range(30, 34)}}
rows_mask('plate', [(y, 0, XR[y]) for y in range(13, 34)])            # 서쪽 공장 마당(철판)
XL = {**{y: 47 for y in range(13, 18)}, **{y: 46 for y in range(18, 26)}, **{y: 48 for y in range(26, 30)}, **{y: 47 for y in range(30, 34)}}
rows_mask('cinder', [(y, XL[y], 63) for y in range(13, 34)])          # 동쪽 석탄 마당(재)

# ================================================================ 2. 땅 덩이 오토타일 (불규칙 덩이 — 칸 집합)
def cells(rows, x0, y0):
    return {(x0 + i, y0 + j) for j, r in enumerate(rows) for i, c in enumerate(r) if c == 'X'}

s.blob('autotile-oil-slick', cells([".XX..", "XXXX.", ".XXXX", "..XX."], 5, 25))
s.blob('autotile-oil-slick', cells(["XX.", "XXX", ".X."], 12, 30))
s.blob('autotile-oil-slick', cells([".XXX", "XXX.", "..X."], 50, 34))
s.blob('autotile-oil-slick', cells(["XX.", "XXX", ".XX", ".X."], 19, 31))
s.blob('autotile-steam-puddle', cells(["..XX.", ".XXXX", "XXXX.", ".XX.."], 10, 24))
s.blob('autotile-steam-puddle', cells([".XX", "XXX", "XX."], 26, 24))
s.blob('autotile-coal-dust', cells(["..XXXX..", ".XXXXXXX", "XXXXXXX.", ".XXXXX..", "..XX...."], 48, 21))
s.blob('autotile-coal-dust', cells([".XXX.", "XXXXX", "XXXX.", ".XX.."], 55, 26))
s.blob('autotile-coal-dust', cells(["XX..", "XXXX", ".XXX"], 48, 30))
s.blob('autotile-coal-dust', cells([".XX", "XXX", "XX."], 41, 11))

# ================================================================ 3. 건물 — 줄집은 폭·지붕·물러섬(앞 줄 / 한 칸 뒤)·사이 골목을 섞는다
ALLEY = []                                                             # 집 사이 골목 칸(x, 밑변 y) — 소품을 둔다


def street_row(seq, x, ybase, walk_front):
    """seq = [(이름, 뒤집기, 물러섬 0/1, 뒤 골목 폭)]. 물러선 집 앞 칸은 보도로 메운다."""
    for (n, f, back, gap) in seq:
        wc = M.HOUSES[n][0]['wc']; yb = ybase - back
        house(n, x, yb, f)
        if back: R('walk', x, ybase, x + wc - 1, ybase)
        x += wc
        if gap:
            ALLEY.append((x, ybase, gap)); x += gap
    return x


R('cinder', 0, 0, 63, 8)                                                # 북쪽 줄집 뒤뜰·골목(다진 재)
R('walk', 0, 9, 63, 9)
x = street_row([('house_brick_3', False, 0, 0), ('shop_awning_red_4', False, 0, 1), ('house_brick_balcony_5', False, 1, 0),
                ('house_mansard_verd_4', True, 0, 0), ('shop_awning_verd_3', False, 1, 2), ('house_brick_copper_4', False, 0, 0),
                ('house_brick_3', True, 0, 0), ('shop_awning_red_4', True, 1, 1), ('house_mansard_verd_4', False, 0, 0),
                ('house_brick_balcony_5', True, 0, 2), ('shop_awning_verd_3', True, 1, 0), ('house_brick_copper_4', True, 0, 1),
                ('house_brick_3', False, 1, 0), ('house_mansard_verd_4', True, 0, 0)], 0, 8, 9)
assert x <= 64, x
R('walk', 0, 45, 63, 45)
x = street_row([('tenement_copper_4', False, 0, 0), ('house_brick_3', False, 1, 1), ('shop_awning_red_4', False, 0, 0),
                ('tenement_slate_5', False, 0, 2), ('house_mansard_verd_4', False, 1, 0), ('shop_awning_verd_3', False, 0, 0),
                ('house_brick_3', True, 0, 0)], 0, 44, 45)
assert x <= 29, x
x = street_row([('house_brick_balcony_5', False, 0, 0), ('house_brick_copper_4', True, 1, 2), ('tenement_slate_5', True, 0, 0),
                ('shop_awning_red_4', True, 0, 1), ('house_mansard_verd_4', True, 1, 0), ('tenement_copper_4', True, 0, 0)], 35, 44, 45)
assert x <= 64, x

put('clock_tower', 29, 24, rows=3, walk=[(2, 0)]); s.marks['clock_door'] = (31, 24)
put('boiler_house', 1, 22, rows=4, walk=[(3, 0), (4, 0)]); s.marks['boiler_door'] = (4, 22)
put('brick_chimney', 10, 20, rows=1)
put('steam_tank', 13, 22, rows=2)
put('steam_tank', 13, 32, rows=2, flip=True)
put('coal_hopper', 49, 21, block=[(0, 0), (3, 0)]); s.marks['hopper'] = (50, 21)
put('water_tower', 61, 23, rows=1)
put('coal_shed', 54, 19, rows=2)

# ================================================================ 4. 소품
doors = {v for k, v in s.marks.items() if k.startswith('door_')}


def lamp_at(x, y, name='gas_lamp'):
    for dx in (0, 1, -1, 2):
        if (x + dx, y - 1) not in doors and (x + dx, y - 2) not in doors and not s.block[y, x + dx]:
            put(name, x + dx, y, rows=1); return


# 가스등: 간격을 일부러 흔든다(4~9칸), 일부는 보도 대신 길 건너 광장·마당 가장자리에
for xx in (3, 11, 15, 24, 36, 44, 53, 60): lamp_at(xx, 9)
for xx in (2, 7, 16, 21, 27, 38, 45, 51, 60): lamp_at(xx, 45)
# 집 사이 골목: 상자·통·세움관·자루·바퀴(밑변 줄)
ALLEY_PROPS = ['crates_brass', 'standpipe', 'oil_barrels', 'coal_sacks', 'wheel_lean', 'standpipe', 'gear_scrap', 'steam_hydrant']
for i, (ax, ay, gap) in enumerate(ALLEY):
    n = ALLEY_PROPS[i % len(ALLEY_PROPS)]
    wc = -(-img(n).width // 16)
    if wc <= gap: put(n, ax, ay)
    else: put('standpipe' if i % 2 else 'steam_hydrant', ax, ay)
# 입구 골목(판석, 가운데 4칸 비움): 양쪽 끝에만 거리 시계·우편 기둥
put('street_clock', 29, 38); put('pillar_box', 34, 41); put('gas_lamp', 34, 37); put('gas_lamp', 29, 43)
# 광장
put('steam_fountain', 30, 30, rows=2)
put('gear_monument', 37, 30)
put('gas_lamp_double', 25, 15, block=[(0, 0)]); put('gas_lamp_double', 37, 14, block=[(0, 0)])
put('gas_lamp_double', 24, 31, block=[(0, 0)]); put('gas_lamp_double', 38, 33, block=[(0, 0)])
for (tx, ty) in ((23, 20), (37, 19), (25, 27), (38, 25), (34, 33), (27, 34)): put('tree_grate', tx, ty, block=[(0, 0)])
put('kiosk', 35, 22, rows=2)
put('poster_column', 28, 20)
put('iron_bench', 24, 23); put('iron_bench', 34, 27, flip=True); put('iron_bench', 27, 30); put('iron_bench', 28, 15)
put('bollard_iron', 23, 28); put('bollard_iron', 40, 21); put('bollard_iron', 32, 34); put('bollard_iron', 40, 28)
put('steam_vent', 34, 16)
# 공장 마당
put('steam_engine', 2, 27)
put('standpipe', 9, 22); put('standpipe', 17, 27)
put('pipe_hump', 6, 30); put('pipe_hump', 8, 33)
put('oil_barrels', 15, 29); put('crates_brass', 0, 32); put('crates_brass', 10, 29)
put('gear_scrap', 3, 31); put('coal_barrow', 7, 23)
put('steam_vent', 2, 24); put('steam_vent', 16, 23)
put('pipe_arch', 15, 16, block=[(0, 0), (5, 0)])
put('crates_brass', 12, 15)
# 석탄 마당
put('coal_cart', 50, 24, rows=1); put('coal_cart', 56, 32, rows=1, flip=True)
put('coal_heap', 55, 28); put('coal_heap', 59, 26); put('coal_heap', 50, 32)
put('coal_sacks', 53, 31); put('coal_sacks', 61, 31); put('coal_barrow', 58, 22); put('coal_barrow', 48, 26)
put('wheel_lean', 48, 14); put('crates_brass', 48, 17); put('oil_barrels', 61, 28)
put('gear_scrap', 52, 28)
# 석탄 마당 무쇠 난간: 들쭉날쭉한 서쪽 경계를 따라(들어가는 곳 y20~24 비움), 꺾이는 곳은 가로 칸으로 잇는다
fence = []
for y in range(13, 34):
    if 20 <= y <= 24: continue
    fence.append((XL[y], y))
    if y + 1 < 34 and not (20 <= y + 1 <= 24) and XL[y + 1] != XL[y]:
        for xx in range(min(XL[y], XL[y + 1]), max(XL[y], XL[y + 1]) + 1): fence.append((xx, y if XL[y + 1] > XL[y] else y + 1))
s.fence_line(sorted(set(fence)))
# 남쪽 큰 길·가운데 남북 길
put('steam_vent', 12, 36); put('steam_vent', 53, 36); put('crates_brass', 25, 36); put('oil_barrels', 38, 36)
put('poster_column', 44, 34); put('steam_hydrant', 18, 34)
put('pipe_arch', 40, 26, block=[(0, 0), (5, 0)])
put('coal_cart', 42, 18, rows=1, flip=True)
put('gas_lamp', 21, 20); put('gas_lamp', 19, 28); put('gas_lamp', 44, 31); put('gas_lamp', 43, 14)
put('pillar_box', 22, 25); put('steam_hydrant', 42, 23); put('steam_vent', 20, 14); put('steam_vent', 44, 21)
put('wheel_lean', 22, 31)
put('street_clock', 41, 35); put('iron_bench', 6, 34); put('iron_bench', 57, 35, flip=True)
put('gas_lamp', 24, 35); put('tree_grate', 9, 36, block=[(0, 0)]); put('tree_grate', 60, 36, block=[(0, 0)])
put('coal_barrow', 46, 35); put('crates_brass', 16, 35); put('tree_grate', 4, 36, block=[(0, 0)])

# ================================================================ 5. 땅 장식(걷기)
for (dx, dy, n) in ((6, 11, 'manhole_brass'), (18, 11, 'manhole_brass'), (46, 11, 'manhole_brass'), (58, 11, 'vent_floor'),
                    (33, 11, 'vent_floor'), (12, 35, 'manhole_brass'), (40, 35, 'manhole_brass'), (56, 36, 'vent_floor'),
                    (19, 22, 'manhole_brass'), (44, 28, 'vent_floor'), (19, 40, 'vent_floor'), (31, 46, 'manhole_brass'),
                    (10, 46, 'vent_floor'), (21, 35, 'drain_grate'), (27, 34, 'vent_floor'), (36, 40, 'manhole_brass'), (16, 36, 'manhole_brass'), (50, 47, 'manhole_brass'), (24, 10, 'drain_grate'), (52, 10, 'drain_grate'), (8, 10, 'drain_grate')):
    s.decal(img(n), dx, dy, name=n)

# ================================================================ 6. 렌더 · 통행 검사
s.marks['south_entrance'] = (31, 47)
im = s.render()
seen = s.bfs(s.marks['south_entrance'])
def near(c):
    x, y = c
    return any((x + dx, y + dy) in seen for dx, dy in ((0, 0), (0, 1), (1, 0), (-1, 0), (0, -1)))
reach = {k: near(v) for k, v in s.marks.items()}
g = s.walk_grid()
e = s.empty(); dens = s.worst(e); bare = s.worst(s.bare())
if __name__ == '__main__':
    print('reach fail:', [k for k, v in reach.items() if not v]); print('clash:', CLASH)
    print('walkable', int(g.sum()), 'reached', len(seen), 'isolated', int(g.sum()) - len(seen))
    print('empty window', dens, 'bare window', bare)
    if '--export' not in sys.argv:
        os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
        im.convert('RGB').save(os.path.join(HERE, '_qa', 'render-wip.png'))
    else:
        import sc_export
        print('parts', sc_export.export(s, im, reach, dens, seen))
