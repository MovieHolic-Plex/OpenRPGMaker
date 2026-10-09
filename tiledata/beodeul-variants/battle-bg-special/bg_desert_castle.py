# 전투 배경 5 — 사막 성 앞(desert-castle). src/desert-castle/ 복사본(+ 그것이 읽는 desert-pyramid 모래·야자)의 그림 함수를 부른다.
#   원경: 맑은 사막 하늘 띠 + 손 구름, 사암 성벽(wall_front — 성가퀴·층 띠·화살 구멍·걸린 천)과 양 끝 둥근 탑(round_tower, 몸통 마름돌 32줄을 빼서 화면에 맞춤),
#         성벽 밑에 바람이 쌓은 모래 비탈(sand_bank), 양 끝 먼 모래 언덕(dune_ridge)
#   바닥: 모래(dp_art.sand_rgb — 결·잔돌·바람 잔물결, 맵과 같은 비주기 잡음)
#   가장자리: 왼쪽 아래 오아시스 가장자리(맵의 오아시스 못 물 램프·풀밭 테두리·젖은 모래·풀 싹 규칙 그대로) + 야자 셋·갈대,
#             오른쪽 모래 바위·덤불·해골, 뒤쪽 무너진 망루 그루터기
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'desert-castle'))
from bglib import *
from bglib import _h
from dc_base import *
import dc_castle as DC, dc_court as CT
import ground
from scipy import ndimage as ndi

S = BG('desert-castle')
HZ = 96
Yy, Xx = np.mgrid[0:H1, 0:W1]

# ---- 오아시스 모양(화소): 왼쪽 아래 구석에 걸친 못과 그 둘레 풀밭
def blob(cx, cy, rx, ry, seed, rough):
    ang = np.arctan2(Yy + .5 - cy, Xx + .5 - cx)
    r = 1 + rough * (np.sin(ang * 3 + seed) * .6 + np.sin(ang * 5 + seed * 2.1) * .4) + (A.vn_full(W1, H1, 20, seed + 9) - .5) * .12
    return ((Xx + .5 - cx) / rx) ** 2 + ((Yy + .5 - cy) / ry) ** 2 < r * r
LAWN = blob(10, 176, 86, 46, 2, .12)
WATER = blob(4, 180, 54, 26, 5, .10)

# ---- 바닥: 버들항 풀(풀밭) 위에 모래(render_out 과 같은 순서·규칙)
grass, _ = ground.render(W1, H1, [], np.zeros((H1, W1), bool), 73)
S.paste_ground(grass)
nz = A.Noise(W1, H1)
rip = np.full((H1, W1), .45) * (.6 + .6 * A.vn_full(W1, H1, 40, 7))
rip[:HZ - 6] = .9
sand = A.sand_rgb(Xx, Yy, nz, rip, seed=731)
damp = ndi.binary_dilation(LAWN, iterations=1) & ~LAWN
sand = np.where(damp[..., None], A.P('sand')[2], sand)
near = ndi.binary_dilation(LAWN, iterations=3) & ~LAWN
tuft = near & (wl.hash2(Xx, Yy, 43) > .80)
LW = np.array([hx(c) for c in ('#4b8232', '#579f35', '#73b83e', '#8fd24a')])
sand = np.where(tuft[..., None], LW[(wl.hash2(Xx, Yy, 44) * 4).astype(int).clip(0, 3)], sand)
S.img.alpha_composite(Image.fromarray(np.dstack([sand.astype(np.uint8), np.where(LAWN, 0, 255).astype(np.uint8)]), 'RGBA'))
# 오아시스 못(물 램프·깊이 띠·잔물결·물가 밝은 테)
dist = ndi.distance_transform_edt(WATER)
wt = np.where(dist < 2, 4, np.where(dist < 5, 3, np.where(dist < 10, 2, 1)))
rip_w = (np.mod(Yy + np.rint(np.sin(Xx / 6.0) * 1.2), 6) == 0) & (A.vn_full(W1, H1, 7, 63) > .62) & (dist > 2)
wt = np.where(rip_w, np.minimum(wt + 2, 5), wt); wt = np.where((dist >= 1) & (dist < 1.5), 6, wt)
S.img.alpha_composite(Image.fromarray(np.dstack([A.P('oasis')[np.clip(wt, 0, 6)].astype(np.uint8), np.where(WATER, 255, 0).astype(np.uint8)]), 'RGBA'))

# ---- 하늘
S.sky([(12, hx('#4f86cc')), (26, hx('#6a9ad6')), (42, hx('#86b0e0')), (60, hx('#a6c6e8'))], 66, seed=21)
CL = [hx('#b4c4d8'), hx('#e2eaf2'), hx('#f6f8fb'), hx('#ffffff')]
S.cloud(150, 10, 44, 7, CL, seed=22); S.cloud(36, 20, 26, 5, CL, seed=23); S.cloud(286, 14, 34, 6, CL, seed=24)
# 먼 모래 언덕(양 끝, 성벽 뒤)
S.img.alpha_composite(PP.dune_ridge_l(), (-30, 44)); S.img.alpha_composite(flipx(PP.dune_ridge_l()), (262, 40))

# ---- 성벽·둥근 탑(바닥 112 에 세우고 밑을 모래 비탈로 덮는다)
WB_ = 112
def short_tower(flip=False):
    t = DC.round_tower(flip=flip); b = t.height
    c0, c1 = 56, 88                                       # 몸통 가운데 마름돌 32줄(4켜)을 뺀다 — 창·윗단·밑단은 그대로
    o = Image.new('RGBA', (t.width, b - (c1 - c0)))
    o.alpha_composite(t.crop((0, 0, t.width, c0)), (0, 0)); o.alpha_composite(t.crop((0, c1, t.width, b)), (0, c0))
    return o
TL, TR_ = short_tower(), short_tower(True)
WALL = DC.wall_front(9, seed=2, banners=((40, 'crimson'), (104, 'indigo')))
px = Px(W1, H1); px.paste(S.img, 0, 0)
px.paste(WALL, 82, WB_ - WALL.height)
px.paste(TL, 22, WB_ - TL.height + 4); px.paste(TR_, 234, WB_ - TR_.height + 4)
# 성벽 밑 모래 비탈(기둥마다 높이: 가운데 낮고 양 끝 탑 밑은 깊게, 바람 굽이)
def bank_h(x):
    return int(20 + 6 * math.sin(x / 23.0 + 1.3) + 4 * math.sin(x / 9.0) + (8 if x < 60 or x > 262 else 0))
DC.sand_bank(px, 0, W1, WB_, bank_h, 31)
S.img = px.im

# ---- 가장자리 물체
for (n, x, yb, fl) in (('palm_tall', -8, 150, False), ('palm_lean', 26, 168, False), ('palm_short', 52, 176, True)):
    S.put(getattr(PP, n)(), x, yb, flip=fl)
for (rx, ry) in ((60, 160), (68, 172), (8, 128)): S.put(PP.reeds(), rx, ry, shadow=False)
S.put(PP.palm_young(), 2, 120)
S.put(DC.watchtower_stump(), 296, 118)
S.put(PP.sand_boulder(), 288, 156); S.put(PP.scrub(), 312, 170, shadow=False); S.put(PP.skull(), 270, 172, shadow=False)
S.put(PP.cactus_column(), 302, 140)
S.put(PP.dry_tuft(), 248, 160, shadow=False); S.put(PP.pebbles(), 92, 168, shadow=False)
S.compose()
if __name__ == '__main__':
    S.save(ME)
