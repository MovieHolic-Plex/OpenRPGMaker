# 버들항 웨이브 6 — 선술집 지하·주방(european-tavern-cellar), 장르 「유럽풍 시가지·실내」 4번. 다시 돌리면 같은 그림이 나온다.
#   python3 make_european_tavern_cellar.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, check-autotile.png
# 한 맵(44×31)에 방 넷이 통로로 이어진다: 포도주 저장고(서) · 아래 식당(가운데, 위층 선술집 계단) · 주방(동) · 창고(남, 더 아래 지하 계단).
# 저장고·식당·주방은 동서 통로로, 식당↔창고는 남북 통로로, 저장고↔창고·주방↔창고는 ㄱ자 통로로 이어져 고리가 된다(ㅁ자 고립 방 없음).
# 바닥은 맨 바탕 표본 → 바닥 변화(판석 길·젖은 돌) → 오토타일 덩이(웅덩이·재·짚) → 큰 물건 → 소품 순으로 칠한다.
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
from tc_base import *
from tc_base import _hash
import tc_parts as TP
from tc_parts import kit, S, SOFT
import tc_auto as AU
assert OUT.endswith('european-tavern-cellar')

W_, H_ = 44, 31

class CMap(KMap):
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(tc_face_tile(sty, x, n - k, capL, capR, n * T), P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(cellar_ceiling(o8, int(_hash(x, y, 4) * 4)), P)
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im

m = CMap(W_, H_, 'european-tavern-cellar')
BAD = []
def R(x0, y0, x1, y1, kind, wh=3, sty='tc_cellar'):
    m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
def RE(x0, y0, x1, y1, kind):
    """이미 연 칸의 바닥 종류만 바꾼다(벽 높이·양식은 그대로)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if m.fl[y][x] is not None: m.fl[y][x] = kind
def P(name, x, y, block=None, layer=1, check=True):
    """조각을 (x, y)(= 왼쪽 아래 칸)에 놓는다. block 이 없으면 메타의 brows 로 발자국을 잰다."""
    img = S[name]
    br = kit.meta[name]['brows'] if name in kit.meta else 1
    if block is None:
        block = [] if br == 0 else foot(img, br, 10, name in SOFT)
    if check:
        for (bx, by) in block:
            c = (x + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append((name, x + bx, y + by))
    m.props_add(x, y, img, block, layer)
def DEC(name, x, y, on='face'):
    """장식(벽 앞면 위 / 바닥 위). (x, y) = 왼쪽 위 칸."""
    img = S[name]; m.compute_faces(); w = -(-img.width // T); h = -(-img.height // T)
    for j in range(h):
        for i in range(w):
            c = (x + i, y + j)
            ok = (c in m.face) if on == 'face' else (m.inb(*c) and m.fl[c[1]][c[0]] is not None)
            if not ok: BAD.append(('decal:' + name, c[0], c[1]))
    m.decal(x, y, img)
def BLOB(cells, sheet):
    m.under.append((set(cells), sheet))
def blob(cx, cy, rows):
    """rows = 문자열 줄('#' 칸), (cx, cy) = 왼쪽 위."""
    return [(cx + i, cy + j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == '#']

# ---------------------------------------------------------------- 1. 맨 바탕(방·통로를 연다)
R(2, 4, 12, 14, 'tc_cobble', 3, 'tc_damp')        # 포도주 저장고
m.cut(2, 12, 2, 3)                                # 네모 깨기
R(16, 4, 27, 14, 'tc_flag', 3, 'tc_cellar')       # 아래 식당
m.cut(16, 12, 1, 3); m.cut(27, 4, 1, 2)
R(31, 4, 41, 13, 'tc_brick', 3, 'tc_kitchen')     # 주방
m.cut(40, 12, 2, 2)
R(10, 19, 27, 26, 'tc_flag', 3, 'tc_cellar')      # 창고
m.cut(10, 24, 2, 3); m.cut(26, 19, 2, 1)
# 통로(폭 2)
R(13, 9, 15, 10, 'tc_flag', 2)                    # 저장고 ↔ 식당
R(28, 8, 30, 9, 'tc_flag', 2)                     # 식당 ↔ 주방
R(21, 15, 22, 18, 'tc_flag', 2)                   # 식당 ↔ 창고(남북)
R(5, 15, 6, 24, 'tc_wet', 2); R(7, 23, 9, 24, 'tc_wet', 2)           # 저장고 ↔ 창고(ㄱ자, 젖은 통로)
R(36, 14, 37, 21, 'tc_flag', 2); R(28, 20, 35, 21, 'tc_flag', 2)     # 주방 ↔ 창고(ㄱ자)
R(22, 27, 23, 29, 'tc_flag', 2)                   # 더 아래 지하로 내려가는 계단 자리

# ---------------------------------------------------------------- 2. 바닥 변화
RE(3, 9, 12, 10, 'tc_flag')                       # 저장고: 통로에서 들어오는 판석 길
RE(3, 4, 4, 8, 'tc_flag')                         #   북서 계단으로
RE(5, 11, 6, 14, 'tc_flag')                       #   남쪽 젖은 통로로 이어지는 길
RE(31, 8, 35, 9, 'tc_flag'); RE(36, 10, 37, 13, 'tc_flag')            # 주방: 통로 문턱 → 남쪽 통로
def REC(cells, kind):
    for (x, y) in cells:
        if m.inb(x, y) and m.fl[y][x] is not None: m.fl[y][x] = kind

def _stage(tag):
    if len(sys.argv) > 1 and sys.argv[1] == tag:
        im = m.render(); im.save(os.path.join(OUT, '_qa', 'stage-%s.png' % tag)); print('BAD', BAD[:20]); import tc_qa; print('EMPTY', [(round(a, 2), x, y) for a, x, y in tc_qa.emptiness(m)]); sys.exit(0)
_stage('1')

# ---------------------------------------------------------------- 3. 땅 덩이 오토타일(물 웅덩이·재·짚)
PS, AS, SS = TP.PS, TP.AS, TP.SS
BLOB(blob(7, 11, ['.##.', '####', '.###', '..#.']), PS)                                   # 저장고 낮은 쪽 웅덩이
BLOB(blob(5, 19, ['#', '##', '.#']), PS)                                                  # 젖은 통로
BLOB(blob(23, 24, ['.##', '###', '.#.']), PS)                                             # 창고 우물 곁
BLOB(blob(33, 12, ['##', '.#']), PS)                                                      # 주방 개수대 곁
BLOB(blob(35, 5, ['.###.', '####.']), AS)                                        # 난로 앞 재
BLOB(blob(40, 5, ['##', '#.']), AS)                                                       # 빵 화덕 앞 재
BLOB(blob(22, 19, ['...##', '.#####', '######', '.####.', '..##..']), SS)                # 창고 자루·짚단 밑 짚
BLOB(blob(11, 21, ['.##.', '####', '###.', '.##.']), SS)

# ---------------------------------------------------------------- 4. 큰 물건 → 소품
# 포도주 저장고(서)
P('stair_up', 3, 5, block=[])
P('wine_rack', 5, 4); P('bottle_crate', 7, 4); P('wine_rack_half', 8, 4); P('barrel_stack', 10, 6, block=[(i, -j) for i in range(3) for j in range(3)])   # 벽에 붙여 윗 통 줄도 막는다
DEC('hanging_meat', 10, 1); DEC('cobweb', 2, 1); DEC('candle_sconce', 7, 2)
P('keg_tap', 2, 8); P('barrel_cluster', 11, 14); P('barrel_upright', 6, 8); P('sack', 9, 8); P('bottle_crate', 12, 8)
P('barrel_lying', 8, 14); P('crate_stack', 4, 14); P('crate', 3, 11); P('bucket', 7, 14)
DEC('drain', 9, 13, on='floor'); P('crate', 8, 6); P('barrel_upright', 4, 12); P('bucket', 6, 17); P('crate', 5, 23)
# 아래 식당(가운데)
DEC('dish_shelf', 16, 1); P('stair_up', 18, 5, block=[]); DEC('mug_sign', 20, 2)
P('cupboard', 21, 4); DEC('painting', 23, 1); DEC('cellar_window', 24, 1); DEC('candle_sconce', 26, 2)
P('long_table_v_meal', 20, 10); P('chair_e', 19, 7); P('chair_e', 19, 9); P('chair_w', 22, 8); P('chair_w', 22, 10); P('chair_n', 21, 11)
P('long_table_h', 23, 13); P('chair_s', 24, 11); P('chair_s', 26, 11); P('chair_n', 25, 14)
P('small_table', 17, 13); P('stool', 19, 13); P('barrel_upright', 16, 5); P('crate', 17, 5); P('bench', 16, 7); P('barrel_lying', 16, 11); P('pillar', 25, 7); P('keg_tap', 26, 7);
# 주방(동)
P('counter_bowl', 31, 5); P('firewood', 34, 4); P('kitchen_hearth', 36, 4); DEC('fire_glow', 36, 5, on='floor')
P('hearth_tools', 39, 4); P('bread_oven', 40, 4)
DEC('pot_rack', 31, 2); DEC('hanging_garlic', 34, 1); DEC('herb_bundle', 39, 1)
P('cauldron', 37, 9); P('butcher_block', 39, 9); P('counter_prep', 33, 11); P('stool', 34, 12)
P('stone_sink', 31, 13); P('sack', 41, 9); P('barrel_upright', 41, 7); P('sack', 40, 11); P('crate_stack', 41, 11)
# 창고(남)
DEC('cobweb', 10, 16); P('cheese_rack', 12, 19); DEC('cellar_window', 14, 16);
P('crate_stack', 16, 19); P('crate', 17, 19); DEC('candle_sconce', 19, 17)
P('sack_pile', 23, 21); P('hay_bale', 25, 21); P('sack', 26, 22); P('barrel_upright', 27, 23)
P('hay_bale', 12, 23); P('sack', 11, 22); P('broom', 15, 20)
P('cellar_well', 26, 26); P('bucket', 25, 26)
DEC('trapdoor', 15, 24, on='floor'); P('long_table_h_meal', 15, 22); P('pillar', 19, 24); P('crate', 13, 26); P('barrel_lying', 17, 26)
P('stair_down', 22, 29, block=[])
_stage('2')

# ---------------------------------------------------------------- 5. 내보내기
FLOOR_DECALS = {'fire_glow', 'window_light', 'trapdoor', 'drain'}
for n, md in kit.meta.items():
    if md['kind'] in ('floor', 'autotile', 'walk'): md['passable'] = True
    elif md['kind'] == 'decal': md['passable'] = n in FLOOR_DECALS
    else: md['passable'] = False
nparts = kit.save()
ENT = (18, 5); FIN = (22, 29)
WP = {'저장고 계단': (3, 5), '저장고 술통': (4, 8), '식당 식탁': (19, 11), '주방 난로 앞': (37, 6), '주방 솥': (36, 9),
      '창고 우물': (25, 25), '창고 짚단': (24, 23), '젖은 통로': (5, 20), '내려가는 계단': (22, 29)}
data = m.export(OUT, ENT, FIN, WP, extra=dict(parts=nparts, bad_placements=BAD))
AU.check_sheet(os.path.join(OUT, 'check-autotile.png'), [('autotile-puddle 물 웅덩이 (젖은 돌 위)', PS, 'tc_wet'), ('autotile-ash 재 (주방 벽돌 위)', AS, 'tc_brick'), ('autotile-straw 짚 덩이 (판석 위)', SS, 'tc_flag')])
import tc_qa
print('parts', nparts, 'reach', data['reachable'], 'path', data['path_len'], 'comps', data['walk_components'], data['component_sizes'])
print('waypoints', {k: v['reach'] for k, v in data['waypoints'].items()})
print('BAD', BAD)
print('EMPTY', [(round(a, 2), x, y) for a, x, y in tc_qa.emptiness(m)])
