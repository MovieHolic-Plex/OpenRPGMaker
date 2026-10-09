# 전투 배경 7 — 붕괴 후 황폐 필드(wasteland-world). src/wasteland-world/ 복사본의 그림 함수를 부른다.
#   원경: 먼지 낀 맑은 하늘 띠 + 손 구름, 더 먼 붉은 바위 능선(rrock 램프 띠), 균열 협곡 벼랑(ww_base.chasm_render — 버들항 절벽 앞면 3줄을
#         붉은 사암·재 층 지층으로 옮긴 것)과 벼랑을 가르는 깊은 틈(골 바닥 어둠·먼지 안개), 벼랑 위 바위 봉우리·고사목
#   바닥: 갈라진 붉은 흙(ww_base.ground_render — 칩셋 점박이 흙 재칠 + 보로노이 틈 + 다져진 땅 덩이 + 재 쌓인 자리)
#   가장자리: 왼쪽 큰 마른 고목·부러진 기둥·붉은 바위, 오른쪽 기운 고목·그루터기, 바랜 풀·잔돌
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'wasteland-world'))
from bglib import *
from bglib import _h
from ww_base import *
import ww_pieces as V, ww_struct as ST_

S = BG('wasteland-world')
HZ = 92
rng = random.Random(707)

# ---- 바닥: 갈라진 붉은 흙(재 쌓인 자리 덩이는 양 가장자리 앞쪽)
dust = np.zeros((H1, W1), bool); dust[140:, :70] = True; dust[150:, 250:] = True
rgb, lab = ground_render(W1, H1, 31, dust_mask=dust)
S.paste_ground(Image.fromarray(rgb.astype(np.uint8), 'RGB').convert('RGBA'))

# ---- 하늘(먼지 낀 맑은 낮)
S.sky([(12, hx('#6a8cb4')), (26, hx('#8aa4c0')), (40, hx('#a8b8c8')), (54, hx('#c4c4c2'))], 70, seed=41)
CL = [hx('#b4aca6'), hx('#dcd6d0'), hx('#eeeae6'), hx('#f8f6f4')]
S.cloud(70, 10, 50, 8, CL, seed=42); S.cloud(250, 16, 36, 6, CL, seed=43)
# 더 먼 능선(옅은 붉은 바위, 두 단)
RR = [P('rrock')[k] for k in range(7)]
haze = [tuple(int(v) for v in mix(tuple(int(c) for c in RR[k]), (196, 190, 186), .45)) for k in range(7)]
S.ridge(64, 22, [haze[3], haze[4], haze[5]], seed=44, period=70, rough=3, ybot=HZ)

# ---- 균열 협곡 벼랑(맵 지형 함수 그대로): 1줄 윗턱 + 앞면 3줄, 가운데 오른쪽을 가르는 틈
CW, CH_ = W1 // 16, 6
lev = [[0] * CW for _ in range(CH_)]
for x in range(CW): lev[0][x] = 1; lev[1][x] = 1
CRK = [(12, 0), (13, 0), (12, 1), (13, 1)]
for (x, y) in CRK: lev[y][x] = 0
cliff, F = chasm_render(lev, seed=5, void=CRK + [(12, 2), (13, 2), (12, 3), (13, 3)])
ca = np.array(cliff); ca[80:] = 0                       # 앞면 아래(골 바닥 아래 칸)는 버린다 — 전투 바닥이 덮는다
cliff = Image.fromarray(ca, 'RGBA')
S.put(cliff, 0, HZ + 12, shadow=False, sorty=0)
# 벼랑 위 봉우리·고사목(덩이, 일렬 금지)
for (n, x, dy) in (('rock_ridge', 18, 0), ('rock_spire', 58, 1), ('dead_snag', 100, 0), ('rock_ridge', 150, 1), ('rock_spire', 236, 0),
                   ('dead_tree_a', 262, 1), ('rock_spire', 300, 2)):
    im = getattr(V, n)()
    S.put(im, x, HZ + 12 - 80 + 36 + dy, shadow=False, sorty=1, flip=rng.random() < .5)

# ---- 가장자리 물체
S.put(V.dead_tree_big(), -6, 132)
S.put(ST_.broken_pillar(), 40, 112)
S.put(V.red_boulder(), 8, 168)
S.put(V.dead_tree_lean(), 286, 136, flip=True)
S.put(V.dead_stump(), 300, 166)
S.put(V.ash_boulder(), 268, 112)
for (bx, by) in ((50, 150), (30, 178), (296, 178), (312, 122), (276, 160)):
    S.put(V.bleached_grass(), bx, by, shadow=False)
S.put(V.rocks_small(), 92, 170, shadow=False); S.put(V.rocks_small(), 236, 112, shadow=False)
S.compose()
if __name__ == '__main__':
    S.save(ME)
