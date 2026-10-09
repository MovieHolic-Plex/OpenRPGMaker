# 산악 요새·난쟁이 광산 정문 (mountain-fortress) — 72x56 JRPG 필드. 다시 돌리면 같은 그림.  python3 make_mountain_fortress.py
# 장면 = mf_scene.MScene(버들항 _lib-5/bd5 장면 + 산 땅), 조각 = mf_stone(석조) · mf_props(소품·식생) · mf_ground(땅·오토타일).
# 동선: 남쪽 산길 입구 → 지그재그 오르막(돌계단 둘) → 골짜기 도개교 → 성문 통로 → 앞뜰 → 거대 석문.
import os, sys, math, random, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import numpy as np
from mf_scene import MScene
import mf_ground as G, mf_stone as S, mf_props as P
import mfwl as wl
import parts5b as P5b
import pi, pf
from px2 import _hash
import pz

W, H = 72, 56
s = MScene('mountain-fortress', W, H, seed=73)
rng = random.Random(7301)

def smooth_runs(a, mn):
    ch = True
    while ch:
        ch = False; i = 0
        while i < len(a):
            j = i
            while j + 1 < len(a) and a[j + 1] == a[i]: j += 1
            if j - i + 1 < mn and 0 < i and j < len(a) - 1:
                for k in range(i, j + 1): a[k] = a[i - 1]
                ch = True
            i = j + 1

# ================================================================ 단(높이)
GATE_X0, GATE_X1 = 30, 41          # 석문 12칸
TER_X0, TER_X1 = 9, 62              # 앞뜰 단(lev3) 가로
TER_Y0, TER_Y1 = 11, 19             # 앞뜰 단 세로(19 = 성벽 발치 줄)
GY0, GY1 = 20, 23                   # 골짜기(낭떠러지) 줄
# 산 덩이 아랫선(가운데): 석문 아래는 4, 나머지는 3~5 흔들림
mb = [4 + int(round(1.0 * math.sin(x / 4.3) + 0.6 * math.sin(x / 1.9 + 1))) for x in range(W)]
mb = [min(5, max(3, v)) for v in mb]
for x in range(GATE_X0 - 2, GATE_X1 + 3): mb[x] = 4
smooth_runs(mb, 3)
b1 = [33 + int(round(0.9 * math.sin(x / 5.1 + 0.7) + 0.5 * math.sin(x / 2.3))) for x in range(W)]   # lev2/lev1 경계(앞면 첫 줄)
b2 = [43 + int(round(0.9 * math.sin(x / 4.7 + 2.1) + 0.5 * math.sin(x / 2.9 + 1)))for x in range(W)]  # lev1/lev0
for x in range(16, 22): b1[x] = 33
for x in range(51, 57): b2[x] = 43
smooth_runs(b1, 4); smooth_runs(b2, 4)
for y in range(H):
    for x in range(W):
        if y >= b2[x]: lv = 0
        elif y >= b1[x]: lv = 1
        elif y > GY1: lv = 2
        elif y >= GY0: lv = 1                     # 골짜기 바닥(보이지 않는다)
        else: lv = 3
        s.lev[y][x] = lv
for x in range(W):
    side = x < TER_X0 or x > TER_X1
    for y in range(0, (GY0 if side else mb[x] + 1)):
        s.lev[y][x] = 5; s.rock_top[y][x] = True
# 서·동 산 덩이 끝을 들쭉날쭉: 앞뜰 단 가장자리 몇 칸을 산이 먹는다
for (x, y0, y1) in ((TER_X0, 11, 13), (TER_X0, 18, 19), (TER_X1, 11, 12), (TER_X1, 17, 19), (TER_X0 + 1, 11, 11), (TER_X1 - 1, 11, 11)):
    for y in range(y0, y1 + 1): s.lev[y][x] = 5; s.rock_top[y][x] = True
for y in range(GY0, GY1 + 1):
    for x in range(W): s.chasm[y][x] = True
# 골짜기 낭떠러지 띠(4줄): 한 칸 폭 절벽 조각(mf_chasm) — 같은 변형이 잇달아 오지 않게, 성문 기둥 아래(33·37)는 도개교 받침
import mf_chasm
s.band = {'y0': GY0, 'cols': mf_chasm.pick_cols(W, (33, 37)), 'snowlip': {x for x in range(W) if s.rock_top[GY0 - 1][x]}}
# 돌계단(위 칸 = 앞면 첫 줄)
s.stairs = [(18, 33, 2), (53, 43, 2)]
s._FF = None

# ================================================================ 길
def hline(g, y, x0, x1):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        if 0 <= x < W and 0 <= y < H: g[y][x] = True
def vline(g, x, y0, y1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        if 0 <= x < W and 0 <= y < H: g[y][x] = True
P_ = s.path
# lev0: 남쪽 입구(14~15, 55) → 북 → 동쪽 길(중간에 한 줄 내려선다) → 계단(53~54)
vline(P_, 14, 49, 55); vline(P_, 15, 49, 55)
hline(P_, 49, 14, 34); hline(P_, 50, 14, 34)
hline(P_, 50, 33, 54); hline(P_, 51, 33, 54)
vline(P_, 53, 46, 51); vline(P_, 54, 46, 51)
# 서쪽 갈래(→ 산길 고개)
hline(P_, 52, 0, 13); hline(P_, 53, 0, 13)
# lev1: 계단 위(53~54,42) → 서쪽 낭떠러지 곁길(난간) → 계단(18~19) / 동쪽 갈래(→ 광산 계곡)
vline(P_, 53, 39, 42); vline(P_, 54, 39, 42)
hline(P_, 40, 30, 54); hline(P_, 41, 30, 54)
hline(P_, 39, 18, 31); hline(P_, 40, 18, 31)
vline(P_, 18, 36, 40); vline(P_, 19, 36, 40)
hline(P_, 38, 55, 71); hline(P_, 39, 55, 71)
# lev2: 계단 위(18~19,32) → 북 → 동쪽 → 다리 머리(34~36,24)
vline(P_, 18, 27, 32); vline(P_, 19, 27, 32)
hline(P_, 27, 18, 36); hline(P_, 28, 18, 36)
for x in (34, 35, 36): vline(P_, x, 24, 28)
# 앞뜰: 성문 통로(34~36,17~19) — 포석이 석문 계단까지
for y in range(TER_Y0 + 1, 17):
    for x in range(29, 43):
        s.court[y][x] = True
for x in range(29, 43):
    if not (33 <= x <= 37): s.court[16][x] = True
for y in range(12, 14):
    for x in range(GATE_X0, GATE_X1 + 1): s.court[y][x] = True
# 다리·통로 칸은 길과 잇는다
for x in (34, 35, 36):
    for y in range(GY0 - 3, GY1 + 1): s.path_join[y][x] = True
# 계단 칸은 길 오토타일이 이어진다(render 가 계단 칸을 이웃으로 침)

# ================================================================ 풀·눈 덩이(땅)
def blob(g, cx, cy, rx, ry, lv=None, cond=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 >= 1: continue
            if lv is not None and s.lev[y][x] != lv: continue
            if cond and not cond(x, y): continue
            g[y][x] = True
from px2 import vnoise
F0 = s.faces()
def open_ground(x, y): return not (s.rock_top[y][x] or s.chasm[y][x] or F0[y][x] or s.path[y][x] or s.court[y][x])
for y in range(H):
    for x in range(W):
        if not open_ground(x, y): continue
        lv = s.lev[y][x]; n = vnoise(x, y, 5.0, 801) * 0.7 + vnoise(x, y, 2.0, 802) * 0.3; n2 = vnoise(x, y, 4.0, 803) * 0.75 + vnoise(x, y, 1.7, 804) * 0.25
        if lv == 0 and n > 0.50: s.grass[y][x] = True
        elif lv == 1 and n > 0.62: s.grass[y][x] = True
        if lv == 2 and n2 > 0.52: s.snow[y][x] = True
        elif lv == 1 and n2 > 0.80: s.snow[y][x] = True
        # 절벽 발치 1~2줄과 군데군데 자갈밭
        foot = y >= 1 and (F0[y - 1][x] or (y >= 2 and F0[y - 2][x] and vnoise(x, y, 3, 805) > 0.5))
        if (foot and vnoise(x, y, 3.0, 806) > 0.38) or vnoise(x, y, 3.0, 807) > 0.80: s.scree[y][x] = True
        if s.grass[y][x] or s.snow[y][x]: s.scree[y][x] = False if not foot else s.scree[y][x]
for y in range(H):
    for x in range(W):
        if s.rock_top[y][x] and (y < 3 or _hash(x // 3, y // 2, 5) > 0.35): s.snow[y][x] = True
        s.snowy_face[y][x] = 0.55 if y < 12 else (0.25 if y < 26 else 0.0)
for y in range(H):
    for x in range(W):
        if s.path[y][x] or s.court[y][x]: s.grass[y][x] = False; s.snow[y][x] = False; s.scree[y][x] = False

# ================================================================ 조각 이미지(한 번 그린다)
IM = {}
def im(name, fn):
    if name not in IM: IM[name] = fn()
    return IM[name]
GATE = im('stone_gate', S.stone_gate)
TOWER_A = im('gate_tower_a', lambda: S.gate_tower(False, False, False))
TOWER_B = im('gate_tower_b', lambda: S.gate_tower(True, True, True))

def occ_rect(x0, y0, x1, y1):
    s.reserve(x0, y0, x1, y1)

# ---- 석문 (12x9칸, 바닥 줄 = 12) : 문짝·기둥 칸 막힘, 계단 줄(12) 걷기
s.at(GATE, GATE_X0, 12, block=[(i, -j) for i in range(12) for j in range(1, 9)], shadow=True)
s.marks['gate_door'] = (35, 12)
occ_rect(GATE_X0, 4, GATE_X1, 12)
# ---- 감시탑 둘 (3x7칸, 바닥 줄 13) : 아래 2줄 막힘, 위는 걷기+가림
for (x, t) in ((26, TOWER_A), (43, TOWER_B)):
    s.at(t, x, 13, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)])
    occ_rect(x, 7, x + 2, 13)
s.marks['tower_w'] = (27, 14); s.marks['tower_e'] = (44, 14)

# ---- 성벽 줄(17~19): 끝은 바위에 묻힌다, 망루 둘, 가운데 성문 통로
WALLROW = 19
def wall_at(img, x, rows_block=(0, -1)):
    wc = img.width // 16
    s.at(img, x, WALLROW, block=[(i, j) for i in range(wc) for j in rows_block])
    occ_rect(x, WALLROW - img.height // 16 + 1, x + wc - 1, WALLROW)
WSEQ = [('wall_end_w', lambda: P.wall_end(3, 'W', 1), 9), ('wall_4a', lambda: S.wall_seg(4, seed=2), 12),
        ('bastion', lambda: S.bastion(0), 16), ('wall_4b', lambda: S.wall_seg(4, seed=4, slits=True), 19),
        ('wall_3_drain', lambda: S.wall_seg(3, seed=5, drain=True), 23), ('wall_4a', None, 26), ('wall_3', lambda: S.wall_seg(3, seed=6), 30),
        ('wall_gatehouse', S.wall_gatehouse, 33), ('wall_3', None, 38), ('wall_4b', None, 41), ('wall_3_drain', None, 45),
        ('wall_4a', None, 48), ('bastion_b', lambda: S.bastion(5), 52), ('wall_4b', None, 55), ('wall_end_e', lambda: P.wall_end(4, 'E', 8), 59)]
for name, fn, x in WSEQ:
    img = im(name, fn) if fn else IM[name]
    if name == 'wall_gatehouse':
        s.at(img, x, WALLROW, block=[(0, 0), (0, -1), (0, -2), (4, 0), (4, -1), (4, -2)] + [(i, -3) for i in range(5)])
        occ_rect(x, WALLROW - 3, x + 4, WALLROW)
    elif name.startswith('bastion'):
        s.at(img, x, WALLROW, block=[(i, j) for i in range(3) for j in (0, -1, -2)])
        occ_rect(x, WALLROW - 4, x + 2, WALLROW)
    else:
        wall_at(img, x, rows_block=(0, -1, -2))
s.marks['gatehouse'] = (35, 18)
# ---- 도개교 (3x5칸, 바닥 줄 23 = 골짜기 남쪽 끝 줄)
DB = im('drawbridge', S.drawbridge)
s.at(DB, 34, GY1, block=None, shadow=False)
BRIDGE = {(x, y) for x in (34, 35, 36) for y in range(GY0, GY1 + 1)}
s.marks['bridge'] = (35, 22)

# ---- 앞뜰 소품: 대장간(서), 창고(동), 화로·횃불
FORGE = im('forge_hearth', P.forge_hearth)
s.at(FORGE, 12, 13, block=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1)]); occ_rect(12, 10, 14, 13)
def put(name, fn, x, y, fw=None, block=True, margin=0, **k):
    img = im(name, fn) if fn else IM[name]
    ok = s.put(img, x, y, fw=fw, margin=margin, block=block, **k)
    if not ok and os.environ.get('MFDBG'): print('put fail', name, x, y)
    return ok
s.marks['forge'] = (13, 14)
put('anvil_block', P.anvil_block, 15, 14)
put('quench_trough', P.quench_trough, 17, 13)
put('tool_rack', P.tool_rack, 19, 12)
put('grindstone', P.grindstone, 21, 14)
put('woodpile_tall', lambda: P.woodpile_tall(3, 281), 10, 16) or put('woodpile_tall', lambda: P.woodpile_tall(3, 281), 10, 15)
put('woodpile_long', lambda: P.woodpile_tall(4, 283), 19, 16)
put('sacks_heap', P.sacks_heap, 13, 16)
put('coal_heap', P.coal_heap, 16, 16)
put('log_bundle', P.log_bundle, 23, 14)
put('weapon_rack', P.weapon_rack, 48, 12)
put('ore_cart', P.ore_cart, 51, 13)
put('ore_heap', P.ore_heap, 54, 12)
put('sacks_stack', P.sacks_stack, 56, 14)
put('ore_heap', None, 49, 16)
put('woodpile_tall', None, 58, 16)
put('crates_lib', lambda: pz.fin(pi.crates()), 53, 16)
put('barrels_lib', lambda: pz.fin(pf.barrels()), 55, 16)
put('log_bundle', None, 51, 16)
put('coal_heap', None, 53, 14) or put('coal_heap', None, 54, 14)
put('sacks_heap', None, 57, 12) or put('sacks_heap', None, 58, 12)
put('weapon_rack', None, 46, 15) or put('weapon_rack', None, 47, 15)
put('grindstone', None, 49, 14)
put('coal_heap', None, 16, 15) or put('coal_heap', None, 17, 15)
for (x, y) in ((29, 13), (42, 13)):
    s.at(im('brazier_iron', S.brazier_iron), x, y); s.reserve(x, y, x, y)
for (x, y) in ((32, 16), (38, 16)):
    s.at(im('torch_post', S.torch_post), x, y); s.reserve(x, y, x, y)

# ---- 골짜기 남쪽 턱: 난간(낭떠러지 쪽) + 다리 머리 횃불
RAIL = s.overlays_rail = []
RAILM = [[False] * W for _ in range(H)]
for x in list(range(24, 33)) + list(range(38, 48)): RAILM[24][x] = True
for x in list(range(24, 46)):
    if s.lev[42][x] == 1 and b2[x] == 43 and not s.path[42][x] and not (31 <= x <= 33): RAILM[42][x] = True
for x in range(26, 33):
    if b1[x] == 33 and not s.path[32][x]: RAILM[32][x] = True
put('torch_post', None, 33, 25); put('torch_post', None, 37, 25)
s.marks['bridge_foot'] = (35, 25)

# ---- 산길 표지: 입구 길표 둘, 굽이마다 돌탑
put('waymarker', P.waymarker, 13, 54); put('waymarker', None, 16, 54)
s.marks['entrance'] = (14, 55)
put('cairn_mark', P.cairn_mark, 52, 48); put('cairn_mark', None, 20, 41); put('cairn_mark', None, 17, 29); put('cairn_mark', None, 56, 41)

# ---- 골짜기 널다리(lev0 작은 틈): 틈 x 30~31, 46~55, 다리 29~32 줄 49~50
CREV = [(30, y) for y in range(47, 56)] + [(31, y) for y in range(48, 54)] + [(29, 53), (29, 54)]
for (x, y) in CREV: s.chasm[y][x] = True
pyb = [y for y in range(46, 56) if s.path[y][30]]
PB = im('plank_bridge', S.plank_bridge)
yb = max(pyb)
s.at(PB, 29, yb, block=None, shadow=False)
PLANK = {(x, y) for x in range(29, 33) for y in (yb - 1, yb)}
s.marks['plank_bridge'] = (30, yb)
s._FF = None

# ================================================================ 식생·바위 (덩이로)
FIR_S3 = im('fir_snow_m', lambda: P.fir_snow(3, 171))
FIR_S4 = im('fir_snow_l', lambda: P.fir_snow(4, 172))
FIR_S2 = im('fir_snow_s', lambda: P.fir_snow(2, 173))
FIR_D = im('fir_dusted', P.fir_dusted)
FIR_D2 = im('fir_dusted_b', lambda: P.fir_dusted(32, 48, 4, 185))
FIR_DL = im('fir_dusted_l', lambda: P.fir_dusted(48, 64, 5, 187))
def tall_ok(x, y, wc, hc):
    for j in range(1, hc):
        for i in range(wc):
            yy = y - j; xx = x + i
            if not (0 <= xx < W and 0 <= yy < H): return False
            if s.path[yy][xx] or s.court[yy][xx] or (xx, yy) in BRIDGE or RAILM[yy][xx]: return False
    return True
def mk(name, wc, hc, margin=0, block=True):
    def f(s_, x, y):
        img = IM[name]
        if x + wc > W or not tall_ok(x, y, wc, hc): return False
        for i in range(wc):
            if RAILM[y][x + i]: return False
        jit = int(_hash(x, y, 4401) * 7) - 3 if name.startswith('fir') else 0
        ok = s.put(img, x, y, fw=wc, margin=margin, block=block, dx=jit)
        if ok and block: soft_block(img, x, y, jit)
        return ok
    return f
def soft_block(img, x, y, dx=0):
    """SPEC §2: 맨 아랫줄 중 아래 반이 실제로 칠해진 칸만 막는다(줄기·밑동). 수관 가장자리 칸은 연다."""
    a = np.array(img)[:, :, 3] > 200
    hh = a.shape[0]
    for i in range(-(-img.width // 16)):
        x0 = i * 16 - dx; sub = a[hh - 8:hh, max(0, x0):max(0, x0 + 16)]
        if 0 <= x + i < W and (sub.size == 0 or sub.mean() < 0.22): s.block[y][x + i] = False
for nm, fn in (('crag_a', lambda: P.crag(0)), ('crag_b', lambda: P.crag(1)), ('outcrop', P.outcrop), ('snowrock_l', lambda: P.snowrock('l')),
               ('snowrock_m', lambda: P.snowrock('m')), ('snowrock_s', lambda: P.snowrock('s')), ('boulders', P.boulders), ('rockfall', P.rockfall),
               ('juniper', P.juniper), ('dead_snag', P.dead_snag), ('scree_a', lambda: P.scree_mtn(0)), ('scree_b', lambda: P.scree_mtn(1)),
               ('snow_patch_s', lambda: P.snow_patch(2, 1, 161)), ('snow_patch_l', lambda: P.snow_patch(3, 2, 163)),
               ('alpine_a', lambda: P5b.alpine(0)), ('alpine_b', lambda: P5b.alpine(1)), ('icicles', P.ice_icicles)):
    im(nm, fn)
Fs3, Fs4, Fs2, Fd, Fd2 = mk('fir_snow_m', 2, 4), mk('fir_snow_l', 2, 4), mk('fir_snow_s', 2, 3), mk('fir_dusted', 2, 3), mk('fir_dusted_b', 2, 3)
Fdl = mk('fir_dusted_l', 3, 4)
Ca, Cb, Oc = mk('crag_a', 2, 3), mk('crag_b', 2, 3), mk('outcrop', 3, 2)
Rl, Rm, Rs, Bo, Rf = mk('snowrock_l', 3, 2), mk('snowrock_m', 2, 2), mk('snowrock_s', 1, 1), mk('boulders', 2, 1), mk('rockfall', 3, 2)
Ju, Dn = mk('juniper', 1, 1), mk('dead_snag', 2, 3)
def deco(name, wc=1):
    def f(s_, x, y):
        if x + wc > W: return False
        for i in range(wc):
            if not s.cell_free(x + i, y, s.lev[y][x]) or RAILM[y][x + i]: return False
        s.at(IM[name], x, y, block=None, shadow=False)
        for i in range(wc): s._occ().add((x + i, y))
        return True
    return f
Sa, Sb, Al, Ab = deco('scree_a'), deco('scree_b'), deco('alpine_a'), deco('alpine_b')
Sps, Spl = deco('snow_patch_s', 2), deco('snow_patch_l', 3)
cl = bd = None
from bd5 import cluster
# 산 덩이 윗면(못 가는 곳): 봉우리·눈 바위·눈 전나무를 빽빽하게
def massif_put(maker, x, y):
    if not (0 <= x < W and 0 <= y < H): return False
    if not s.rock_top[y][x]: return False
    s._ign_rock = True                           # put 의 빈칸 검사에서 산 윗면을 잠깐 놓을 땅으로 본다
    ok = maker(s, x, y)
    s._ign_rock = False
    return ok
def massif_fill():
    cands = [(x, y) for y in range(H) for x in range(W) if s.rock_top[y][x]]
    rng.shuffle(cands)
    makers = [Fs3, Fs4, Fs2, Fs3, Ca, Fs4, Rl, Fs3, Fs2, Cb, Fs4, Oc]
    for (x, y) in cands:
        if (x, y) in s._occ() or _hash(x, y, 33) < 0.42: continue
        m = makers[int(_hash(x, y, 31) * len(makers))]
        massif_put(m, x, y)
massif_fill()
# 전나무 숲 덩이: 2칸 폭 전나무를 엇갈려 빽빽이(줄마다 1칸 어긋남, 일부 빠짐), 가장자리는 작은 나무·바위
def grove(x0, y0, x1, y1, makers, edge, seed, keep=0.78):
    r = random.Random(seed)
    for y in range(y1, y0 - 1, -1):
        x = x0 + (y % 2) + r.randint(0, 1)
        while x < x1:
            step = 2 + (1 if r.random() < 0.45 else 0)
            fx = (x - x0) / max(1, x1 - x0); fy = (y - y0) / max(1, y1 - y0)
            d = ((fx - 0.5) / 0.5) ** 2 + ((fy - 0.5) / 0.5) ** 2 + (vnoise(x, y, 2.5, seed) - 0.5) * 0.8
            if d > 1.0 or r.random() > keep: x += step; continue
            mk_ = r.choice(edge if d > 0.6 else makers)
            mk_(s, x, y); x += step
GROVES = [((1, 45, 12, 51), [Fd, Fd2, Fdl], [Ju, Bo, Fd], 1), ((57, 45, 71, 55), [Fd, Fdl, Fd2], [Ju, Al, Bo], 2), ((37, 52, 48, 55), [Fd2, Fdl, Fd], [Ab, Bo], 3),
          ((0, 35, 11, 41), [Fs3, Fd, Fs2], [Rm, Ju], 4), ((59, 39, 70, 42), [Fd, Fs2], [Ju, Rs], 5), ((40, 35, 50, 38), [Fs2, Fs3], [Rm, Rs], 6),
          ((0, 24, 13, 31), [Fs3, Fs4], [Rl, Rm, Ca], 7), ((50, 24, 71, 31), [Fs4, Fs3, Fs3], [Rl, Cb, Rm], 8), ((22, 29, 30, 31), [Fs2, Fs3], [Rm, Rs], 9),
          ((20, 52, 27, 55), [Fd, Fd2], [Al, Ju], 10)]
for (box, mks, edge, sd) in GROVES: grove(*box, mks, edge, 900 + sd)
for (x, y) in ((3, 46), (60, 46), (34, 46), (20, 46)): Rf(s, x, y)                 # 절벽 발치 낙석
for (x, y) in ((10, 36), (40, 36), (60, 36)): Rf(s, x, y)
cluster(s, rng, 26, 47, 4, 2, 4, [Bo, Al, Sa])
cluster(s, rng, 44, 47, 5, 2, 4, [Bo, Ab, Sb])
cluster(s, rng, 30, 37, 5, 2, 4, [Rm, Rs, Sa])
cluster(s, rng, 46, 31, 4, 2, 3, [Rl, Rm])
cluster(s, rng, 28, 25, 4, 2, 3, [Rm, Rs])
# 빈 화면 메우기: 20x15 창 중 빈 바닥이 많은 곳에 자연 덩이(3~6개)를 하나씩 더한다(일렬 금지: 타원 안 무작위)
MK = {0: [Fd, Fd2, Fd, Fd2, Bo, Al], 1: [Fs2, Fd, Fd2, Rm, Fs3, Bo], 2: [Fs3, Fs4, Rm, Rl, Fs3, Fs2, Oc], 3: [Rs, Sa]}
s.fill = {(x, y) for y in range(H) for x in range(W) if s.grass[y][x] or s.snow[y][x] or s.scree[y][x]}
def autofill(limit=0.36, rounds=60):
    for r in range(rounds):
        worst, (x0, y0), _ = s.density()
        if worst <= limit: return worst
        E = s.empty
        cand = [(x, y) for y in range(y0, min(H, y0 + 15)) for x in range(x0, min(W, x0 + 20)) if E[y][x] and s.lev[y][x] in MK]
        if not cand: return worst
        cx, cy = cand[int(rng.random() * len(cand))]
        cluster(s, rng, cx, cy, 3.2, 2.0, 4 + int(rng.random() * 3), MK[s.lev[cy][cx]])
    return s.density()[0]
print('autofill worst', round(autofill(), 2))
# 고드름: 산 덩이 앞면 위쪽(석문 좌우)
for x in (10, 20, 47, 56, 3, 66):
    y = mb[x] + 1 if TER_X0 <= x <= TER_X1 else GY0
    if 0 <= y < H: s.top_overlays.append((IM['icicles'], x * 16, y * 16))
# 난간(위층 오토타일)
RS = G.autotile_railing()
for y in range(H):
    for x in range(W):
        if not RAILM[y][x]: continue
        n = sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if 0 <= x + dx < W and 0 <= y + dy < H and RAILM[y + dy][x + dx])
        s.objs.append(((y + 1) * 16 - 1, x * 16, y * 16, RS.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), False))
        s.block[y][x] = True

# ================================================================ 통행 정리: 다리·통로·계단
for (x, y) in BRIDGE | PLANK: s.block[y][x] = False
for x in (34, 35, 36):
    for y in (16, 17, 18, 19): s.block[y][x] = False

def walk_grid():
    wg = s.walk_grid()
    for (x, y) in BRIDGE | PLANK: wg[y][x] = True
    for x in (34, 35, 36):
        for y in (17, 18, 19): wg[y][x] = True
    return wg
s._wg = walk_grid
_orig_walk = s.walk_grid
def wg2():
    wg = _orig_walk()
    for (x, y) in BRIDGE | PLANK: wg[y][x] = True
    for x in (34, 35, 36):
        for y in (16, 17, 18, 19): wg[y][x] = True
    return wg
s.walk_grid = wg2
# 다리·통로는 단 차를 건너는 길(성문 통로 lev3 ↔ 다리 lev1 ↔ 다리 머리 lev2): 그 칸들을 같은 단으로 본다
for (x, y) in BRIDGE: s.lev[y][x] = 1
_bfs = s.bfs
def bfs2(start, walk=None):
    from collections import deque
    walk = walk or s.walk_grid(); sc = s.stair_cells(); seen = {start}; q = deque([start])
    link = BRIDGE | {(x, y) for x in (34, 35, 36) for y in (17, 18, 19, 24)} | PLANK
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in seen or not walk[ny][nx]: continue
            a, b = (x, y) in sc, (nx, ny) in sc
            if s.lev[ny][nx] != s.lev[y][x] and not (a or b) and not ((x, y) in link and (nx, ny) in link): continue
            if (a or b) and dx != 0 and not (a and b): continue
            seen.add((nx, ny)); q.append((nx, ny))
    return seen
s.bfs = bfs2

if __name__ == '__main__':
    out = HERE
    img = s.render()
    # 저장(그림·격자)
    os.makedirs(out + '/parts', exist_ok=True)
    img.save(out + '/render-1x.png'); img.resize((img.width * 2, img.height * 2), Image.NEAREST).save(out + '/render-2x.png')
    wg = s.walk_grid()
    targets = {k: v for k, v in s.marks.items() if k not in ('tower_w', 'tower_e')}
    reach = s.bfs(s.marks['entrance'])
    res = {k: (tuple(v) in reach) for k, v in targets.items()}
    res['west_exit'] = (0, 52) in reach; res['east_exit'] = (71, 38) in reach
    print('BFS', res)
    grid = {'w': W, 'h': H, 'tile': 16, 'rows': [''.join('.' if wg[y][x] else '#' for x in range(W)) for y in range(H)],
            'legend': {'.': 'walkable', '#': 'blocked'}, 'marks': {k: list(v) for k, v in s.marks.items()},
            'stairs': [list(t) for t in s.stairs], 'levels': [''.join(str(s.lev[y][x]) for x in range(W)) for y in range(H)],
            'bfs_from_entrance': res}
    json.dump(grid, open(out + '/grid.json', 'w'), ensure_ascii=False)
    d = s.density(); print('density worst %.2f at %s, overall %.2f' % d)
    # 조각 내보내기(새로 그린 것만, crates_lib/barrels_lib = 버들항 기존 그림이라 제외)
    if '--parts' in sys.argv:
        import mf_export
        n = mf_export.export(IM, out)
        print('parts', n)
