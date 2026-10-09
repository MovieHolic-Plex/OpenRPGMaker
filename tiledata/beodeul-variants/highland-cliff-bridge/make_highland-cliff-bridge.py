# 고원 절벽과 하늘 다리 (highland-cliff-bridge, 장르 natural-forest-cliff) — 필드 64x48. 다시 돌리면 같은 그림이 나온다.
#   python3 make_highland-cliff-bridge.py          전부(조각·메타·렌더·grid·검사 그림)
#   python3 make_highland-cliff-bridge.py --quick  _qa/map1x.png 만
# 구도: 북쪽 너머와 가운데 협곡으로 하늘이 보인다. 서쪽 고원 ─(가로 널판 다리)→ 동쪽 고원 ─(세로 널판 다리, 동서로 갈라진 틈)→ 남동 바위턱.
# 서쪽 고원 남쪽 절벽은 계단식 밭 비탈(밭 이랑 경사 + 덩굴 비탈)로, 남동 바위턱은 돌 계단으로 아래 마당(밭·쉼터)에 내려간다.
import sys, os, json, math
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import hc_base
import numpy as np
from PIL import Image
from hc_base import _hash, smooth
from hc_scene import Scene
import hc_build as B, hc_props as P, hc_ground as HG

W, H = 64, 48
s = Scene(W, H, seed=7)
HERE = _HERE
L = s.L


def line_cells(pts, w=2):
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            for dx in range(w):
                for dy in range(w):
                    cx, cy = int(math.floor(x - (w - 1) / 2 + dx + .5)), int(math.floor(y - (w - 1) / 2 + dy + .5))
                    if 0 <= cx < W and 0 <= cy < H: out.add((cx, cy))
    return out


# ================================================================ ① 높이: 고원(2) · 아래 마당(1) · 하늘(0)
L[:, :] = 2
def yard_s(x): return 33 if x < 14 else (35 if x < 41 else 34)          # 마당 남쪽 끝 마지막 줄(그 아래 3줄 = 둘째 절벽, 그 밑 = 아랫들)
def north_rim(x):                                                     # 고원 북쪽 끝(하늘과 맞닿는 줄) — 울퉁불퉁
    return 3 + int(round(1.3 * math.sin(x / 4.3 + 1.0) + .8 * math.sin(x / 1.9) + .6 * math.sin(x / 9.0)))
# 서쪽 고원: 동쪽 끝 xe(y) (마지막 땅 칸 + 1), 남쪽 끝 마지막 줄 ys(x)
def west_e(y): return 27 if y < 10 else (28 if y < 17 else 24)
def west_s(x): return 20 if x < 7 else (21 if x < 18 else 20)
def east_w(y): return 36 if y < 10 else (35 if y < 14 else 37)
for x in range(W):
    for y in range(H):
        if y < north_rim(x): L[y, x] = 0
for y in range(H):
    for x in range(W):
        if L[y, x] == 0: continue
        if x < west_e(y) and y <= west_s(x): L[y, x] = 3
        elif west_e(y) <= x < east_w(y) and y <= 26: L[y, x] = 0             # 가운데 협곡(하늘)
        elif x >= east_w(y) and y <= 13: L[y, x] = 3                          # 동쪽 고원(북)
        elif x >= east_w(y) and 14 <= y <= 18: L[y, x] = 0                    # 동서로 갈라진 틈(하늘)
        elif x >= east_w(y) and 19 <= y <= 21: L[y, x] = 3                    # 남동 바위턱
for y in range(19, 27):                                                     # 협곡 남쪽 끝은 조금씩 좁아진다(바위턱 서쪽 가장자리)
    for x in range(26, 37):
        if L[y, x] != 3: L[y, x] = 0
for (x, y) in [(26, 26), (36, 26), (36, 25), (27, 26)]: L[y, x] = 2
for x in range(W):
    for y in range(yard_s(x) + 1, H): L[y, x] = 1
s.build_faces()

# ================================================================ ② 길(맨땅 길 오토타일, 폭 2)
BR_Y = 12
P_W = [(0, 8), (6, 9), (13, 11), (20, 12), (27, BR_Y)]
P_E = [(35, BR_Y), (41, 11), (48, 9), (56, 8), (63, 8)]
P_WS = [(18, 12), (16, 16), (12, 19), (11, 21)]
P_ES = [(46, 10), (52, 11), (53, 13)]
P_ES2 = [(53, 19), (52, 20), (51, 21)]
P_Y = [(11, 25), (13, 29), (20, 32), (28, 31), (36, 30), (44, 28), (50, 25)]
P_YS = [(28, 31), (30, 33), (30, 35)]
P_YS2 = [(30, 39), (31, 44), (31, 47)]
for pts in (P_W, P_E, P_WS, P_ES, P_ES2, P_Y, P_YS, P_YS2):
    s.path |= line_cells(pts, 2)
s.path = {c for c in s.path if s.is_land(*c)}
s.marks['west_entrance'] = (0, 8); s.marks['east_exit'] = (63, 8); s.marks['south_exit'] = (31, 47)

if __name__ == '__main__' and '--terrain' in sys.argv:
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    sys.exit()

# ================================================================ ③ 구조물: 가로 다리 · 세로 다리 · 계단식 밭 비탈 · 돌 계단
s.dry_amount = .16
x0b, x1b = west_e(BR_Y) - 1, east_w(BR_Y)                                   # 다리 양 끝 땅 칸
bw = x1b - x0b + 1
s.at(B.bridge_h(bw), x0b, BR_Y + 2, block=[(i, j) for i in range(bw) for j in (0, -3)], walk=[(i, j) for i in range(bw) for j in (-1, -2)],
     name='bridge_h', shadow=False, sorty=(BR_Y - 1) * 16 + 1)
s.marks['bridge_w'] = (x0b, BR_Y); s.marks['bridge_e'] = (x1b, BR_Y)
VX = 52                                                                    # 세로 다리(동쪽 고원 → 남동 바위턱)
s.at(B.bridge_v(7), VX, 19, block=[(0, j) for j in range(-6, 1)] + [(2, j) for j in range(-6, 1)], walk=[(1, j) for j in range(-6, 1)],
     name='bridge_v', shadow=False, sorty=13 * 16 + 2)
for j in range(13, 20): s.path.discard((VX + 1, j)); s.path.discard((VX, j)); s.path.discard((VX + 2, j))
s.marks['bridge_v_n'] = (VX + 1, 13); s.marks['bridge_v_s'] = (VX + 1, 19)
# 계단식 밭 비탈(서쪽 고원 남쪽 절벽, 앞면 3줄 자리): 덩굴 비탈 2 + 밭 이랑 경사 3 + 덩굴 비탈 2
RX = 10; RT = west_s(RX) + 1
for x in range(RX - 2, RX + 5):
    for j in range(3): s.special[(x, RT + j)] = 'ramp' if RX <= x < RX + 3 else 'slope'
s.decal(B.vine_slope('w'), RX - 2, RT + 2, name='vine_slope_w'); s.decal(B.vine_slope('e'), RX + 3, RT + 2, name='vine_slope_e')
s.decal(B.terrace_ramp(3), RX, RT + 2, name='terrace_ramp')
for x in (RX - 2, RX - 1, RX + 3, RX + 4):
    for j in range(3): s.block[RT + j, x] = True
s.marks['ramp_top'] = (RX + 1, RT - 1); s.marks['ramp_foot'] = (RX + 1, RT + 3)
# 돌 계단(남동 바위턱 남쪽 절벽)
SX = 50; ST_ = 22
for x in (SX, SX + 1):
    for j in range(3): s.special[(x, ST_ + j)] = 'stair'
s.decal(B.stone_stairs(2), SX, ST_ + 2, name='stone_stairs')
s.marks['stairs_top'] = (SX, ST_ - 1); s.marks['stairs_foot'] = (SX, ST_ + 3)
# 둘째 계단식 밭 비탈(마당 → 아랫들)
def terraces(rx, rt, key):
    for x in range(rx - 2, rx + 5):
        for j in range(3): s.special[(x, rt + j)] = 'ramp' if rx <= x < rx + 3 else 'slope'
    s.decal(B.vine_slope('w', seed=rx), rx - 2, rt + 2, name='vine_slope_w'); s.decal(B.vine_slope('e', seed=rx + 1), rx + 3, rt + 2, name='vine_slope_e')
    s.decal(B.terrace_ramp(3, seed=rx), rx, rt + 2, name='terrace_ramp')
    for x in (rx - 2, rx - 1, rx + 3, rx + 4):
        for j in range(3): s.block[rt + j, x] = True
    s.marks[key + '_top'] = (rx + 1, rt - 1); s.marks[key + '_foot'] = (rx + 1, rt + 3)
terraces(29, yard_s(29) + 1, 'ramp2')
for (x, y) in [(x, y) for y in range(yard_s(29) + 1, yard_s(29) + 4) for x in range(27, 34)]: s.path.discard((x, y))

if __name__ == '__main__' and '--struct' in sys.argv:
    s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    print(sorted((k, v in s.bfs(s.marks['west_entrance'])) for k, v in s.marks.items()))
    sys.exit()

# ================================================================ ④ 마당: 밭(밭 이랑 오토타일) · 울타리 · 맨땅 마당
import hc_props as P
FIELDS = [["  #####  ", " ####### ", "#########", " ####### ", "  #####  "],
          ["  ######   ", " ######### ", "###########", " ########  ", "  #####    "]]
for (fx, fy, rows) in ((1, 26, FIELDS[0]), (36, 40, FIELDS[1])):
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c == '#' and s.is_land(fx + i, fy + j) and (fx + i, fy + j) not in s.path: s.crop.add((fx + i, fy + j))
s.marks['field_w'] = (5, 25); s.marks['field_s'] = (41, 39)
for (x, y) in [(x, y) for y in range(25, 28) for x in range(9, 15)]:                       # 비탈 발치 맨땅 마당(밭일 하는 자리)
    if s.is_land(x, y) and (x, y) not in s.crop and _hash(x, y, 3) < .85 - .25 * (y == 28): s.dirt.add((x, y))
s.dirt -= s.path
s.path |= s.dirt                                                          # 맨땅 바탕 표본 위에 같은 결의 길 오토타일 → 가장자리가 풀에 들쭉날쭉 먹힌다


# 마른 고원 풀 덩이(땅 덩이 오토타일): 고원·마당 빈 풀밭에 얼룩처럼
DRY_NZ = smooth(W, H, 5, 331) * .65 + smooth(W, H, 2, 332) * .35
for y in range(H):
    for x in range(W):
        if s.is_land(x, y) and (x, y) not in s.path and (x, y) not in s.crop and (x, y) not in s.special and DRY_NZ[y, x] > (.56 if s.L[y, x] == 3 else .6):
            s.dry.add((x, y))
for _ in range(2):
    drop = {c for c in s.dry if sum(((c[0] + dx, c[1] + dy) in s.dry) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1}
    s.dry -= drop

# ================================================================ ⑤ 나무·덤불·바위(덩이로, 통행 검사)
def _unreached():
    seen_ = s.bfs(s.marks['west_entrance']); g_ = s.walk_grid()
    return all(tuple(v) in seen_ for v in s.marks.values()), int(g_.sum()) - len(seen_)
UNR0 = [_unreached()[1]]
def _reach_ok():
    ok, u = _unreached()
    if ok and u <= UNR0[0]: UNR0[0] = u; return True
    return False
def _snap(): return (len(s.objs), s.block.copy(), set(s.occ), dict(s.count))
def _undo(sn):
    import collections
    s.objs = s.objs[:sn[0]]; s.block = sn[1]; s.occ = sn[2]; s.count = collections.Counter(sn[3])

KEEP = set()
for k, v in s.marks.items():
    for dx in range(-1, 2):
        for dy in range(-1, 2): KEEP.add((v[0] + dx, v[1] + dy))
def free(x, y, w=1, h=1, base_only=False):
    for i in range(w):
        for j in range(h if not base_only else 1):
            c = (x + i, y - j)
            if not s.is_land(*c) or c in s.path or c in s.crop or c in s.dirt or c in s.special or c in KEEP or s.block[c[1], c[0]] or c in s.occ: return False
    return True
def canopy_ok(x, y, w, h):
    """수관 칸이 하늘·절벽 위에 걸려도 되지만 길 바로 위 2줄은 덮지 않는다."""
    for i in range(w):
        for j in range(1, min(3, h)):
            if (x + i, y - j) in s.path: return False
    return True
def place(im, x, y, base, name, check=True):
    w = im.width // 16; h = im.height // 16
    if not free(x, y, w, 1) or not canopy_ok(x, y, w, h): return False
    for i in range(w):
        for j in range(1, h):
            if (x + i, y - j) in s.occ: return False
    sn = _snap()
    s.at(im, x, y, block=[(i, 0) for i in base], name=name, occ=True)
    if not check or _reach_ok(): return True
    _undo(sn); return False

# 앵커: 서쪽 고원 전망 큰 나무(협곡 가장자리) · 동쪽 바위턱 돌무더기 · 마당 길 갈림 표지
place(P.oak_big(1), 20, 7, (1,), 'oak_big'); s.marks['lookout'] = (23, 8)
place(P.log_fallen(2), 21, 9, (0, 1, 2), 'log_fallen')
place(P.cairn(3), SX + 3, ST_ - 1, (0,), 'cairn'); place(P.cairn(13), 33, 34, (0,), 'cairn')
place(P.signpost(4), 26, 30, (0,), 'signpost'); place(P.signpost(5), 19, 13, (0,), 'signpost')
place(P.bridge_post(6), x0b - 1, BR_Y - 1, (0,), 'bridge_post'); place(P.bridge_post(7), x1b + 1, BR_Y - 1, (0,), 'bridge_post')
place(P.bridge_post(8), VX - 1, 12, (0,), 'bridge_post'); place(P.bridge_post(9), VX + 3, 12, (0,), 'bridge_post')

# 덩이: (중심, 반경, 종류 목록)
GROVES = [((5, 14), 4, 'oak'), ((10, 5), 4, 'fir'), ((24, 18), 3, 'fir'), ((44, 5), 4, 'fir'), ((60, 11), 3, 'oak'), ((41, 20), 3, 'mix'),
          ((58, 20), 2, 'fir'), ((46, 36), 5, 'oak'), ((58, 40), 4, 'fir'), ((3, 44), 3, 'mix'), ((24, 44), 3, 'oak'), ((38, 44), 3, 'mix'),
          ((60, 29), 3, 'mix'), ((22, 26), 2, 'rock'), ((18, 30), 3, 'mix'), ((8, 41), 4, 'oak'), ((21, 44), 3, 'fir'), ((50, 45), 3, 'mix'),
          ((40, 29), 2, 'rock'), ((2, 11), 2, 'fir'), ((13, 39), 3, 'mix'), ((4, 46), 2, 'fir'), ((16, 46), 2, 'rock'),
          ((54, 31), 3, 'mix'), ((46, 27), 2, 'rock'), ((60, 20), 2, 'mix'), ((5, 38), 2, 'oak'), ((17, 32), 2, 'rock'), ((11, 31), 2, 'mix')]
def kit(kind, i, seed):
    if kind == 'oak': return (P.oak_big(seed), (1,), 'oak_big') if i % 3 == 0 else (P.oak_small(seed), (0, 1), 'oak_small')
    if kind == 'fir': return (P.fir_tall(seed), (0,), 'fir_tall') if i % 2 == 0 else (P.fir_young(seed), (0,), 'fir_young')
    if kind == 'rock': return (P.boulder_dan(seed), (0, 1), 'boulder_dan') if i % 2 == 0 else (P.bush_autumn(seed), (0, 1), 'bush_autumn')
    return [(P.oak_small(seed), (0, 1), 'oak_small'), (P.fir_tall(seed), (0,), 'fir_tall'), (P.bush_round(seed), (0, 1), 'bush_round'),
            (P.bush_autumn(seed), (0, 1), 'bush_autumn')][i % 4]
for gi, ((cx, cy), r, kind) in enumerate(GROVES):
    n = 0
    for i in range(30):
        if n >= r + 2: break
        x = cx + int(round((_hash(gi, i, 41) - .5) * 2 * r)); y = cy + int(round((_hash(gi, i, 42) - .5) * 1.6 * r))
        im, base, name = kit(kind, n, 100 + gi * 10 + i)
        if place(im, x, y, base, name): n += 1
# 덤불·바위 잔 덩이(빈 땅에 드문드문, 길가 피해서)
for y in range(H):
    for x in range(W):
        h = _hash(x, y, 61)
        if h < .012: place(P.bush_round(x + y), x, y, (0, 1), 'bush_round')
        elif h < .02: place(P.bush_small(x * 3 + y), x, y, (0,), 'bush_small')
        elif h < .026: place(P.rock_small(x + y * 5), x, y, (0,), 'rock_small')
        elif h < .03: place(P.rock_pair(x + y), x, y, (0, 1, 2), 'rock_pair')
        elif h < .034: place(P.bush_autumn(x * 7 + y), x, y, (0, 1), 'bush_autumn')
        elif h < .037: place(P.stump(x + y), x, y, (0,), 'stump')
# 절벽 발치 떨어진 바위(마당 쪽 절벽 밑 1~2줄)
for (x, y) in s.face:
    if s.face[(x, y)][2] == 2 and s.L[y, x] >= 1 and _hash(x, y, 71) < .16:
        place(P.boulder_dan(x + y) if _hash(x, y, 72) < .5 else P.rock_small(x), x, y + 1 + int(_hash(x, y, 73) * 2), (0, 1) if _hash(x, y, 72) < .5 else (0,),
              'boulder_dan' if _hash(x, y, 72) < .5 else 'rock_small')
# 밭 울타리(밭 북쪽·서쪽에 짧게)
place(P.fence_short(1, 3), 2, 25, (0, 1, 2), 'fence_short'); place(P.fence_short(2, 4), 37, 39, (0, 1, 2, 3), 'fence_short')
print('objs', dict(s.count))

# ================================================================ ⑥ 땅 장식 · 절벽 덩굴 · 하늘 구름
for y in range(H):
    for x in range(W):
        if not s.is_land(x, y) or (x, y) in s.crop or (x, y) in s.path or (x, y) in s.dirt or (x, y) in s.special: continue
        h = _hash(x, y, 81)
        if (x, y) in s.occ:
            if h < .5: s.gz[(x, y)] = 'mottle'
            continue
        if h < .05: s.decal(P.tallgrass(x + y), x, y, name='tallgrass')
        elif h < .075: s.decal(P.flowers_white(x * 3 + y), x, y, name='flowers_white')
        elif h < .09: s.decal(P.pebbles(x + y * 7), x, y, name='pebbles')
        elif h < .42: s.gz[(x, y)] = 'tuft'
        elif h < .6: s.gz[(x, y)] = 'mottle'
        elif h < .64: s.gz[(x, y)] = 'flower'
for (x, y), (top, up, j) in s.face.items():
    if j == 0 and (x, y) not in s.special:
        h = _hash(x, top, 91)
        if h < .14: s.decal(P.hanging_vines(x), x, top + 1, name='hanging_vines')
        elif h < .2: s.decal(P.cliff_roots(x), x, top + 1, dy=4, name='cliff_roots')
for (cx, cy, w, sd) in ((2, 1, 4, 1), (44, 1, 5, 2), (29, 6, 3, 3), (31, 22, 4, 4), (56, 1, 3, 5), (16, 0, 3, 6)):
    s.decal(P.cloud_bank(sd, w, 2), cx, cy, name='cloud_bank', top=True)

# ================================================================ 렌더 · 검사 · 내보내기
seen = s.bfs(s.marks['west_entrance'])
reach = {k: (tuple(v) in seen) for k, v in s.marks.items()}
e = s.empty()
(wr, wx, wy), mean = s.worst(e)
g = s.walk_grid()
print('reach', reach)
print('walkable', int(g.sum()), 'reached', len(seen))
print('empty window worst %.3f at (%d,%d), mean %.2f' % (wr, wx, wy, mean))
if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    if '--quick' in sys.argv:
        s.render().convert('RGB').save(os.path.join(HERE, '_qa', 'map1x.png'))
    else:
        import hc_export
        img = hc_export.stages(s)
        n = hc_export.export(s, img, reach, ((wr, (wx, wy)), mean), seen)
        print('parts', n)
