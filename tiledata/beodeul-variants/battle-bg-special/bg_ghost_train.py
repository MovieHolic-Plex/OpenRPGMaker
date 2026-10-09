# 전투 배경 1 — 유령 열차 간이역(ghost-train). src/ghost-train/ 복사본의 그림 함수를 부른다.
#   원경: 맑은 낮 하늘 띠 + 손 구름, 먼 전나무·참나무 숲 줄(깊은 숲 전나무 parts5, 버들항 참나무), 숲 앞 본선 철로(autotile-rail) 위 무너진 객차(왼쪽)·전신주·완목 신호기
#   바닥: 자갈 도상(gravel_px) 가운데 + 양 가장자리 풀(버들항 ground.render) 들쭉날쭉
#   가장자리: 왼쪽 아래 버려진 짐 더미·고사리, 오른쪽 급수탑·푸른 가스등, 숲 가장자리 안개(autotile-fog) — 맵과 같은 ghost_grade 로 색을 고른다.
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'ghost-train'))
from bglib import *
from bglib import _h
from gt_base import *
from gt_base import _hash
import gt_auto as AU, gt_train as TR, gt_station as SN
import ground

S = BG('ghost-train')
rng = random.Random(501)
HZ = 96                                     # 본선 철로 아랫변(지평선)

# ---- 바닥: 풀(버들항) 위에 자갈 도상 덩이
grass, _ = ground.render(W1, H1, [], np.zeros((H1, W1), bool), 81)
S.paste_ground(grass)
def ballast_mask(x, y):
    e = 14 + 10 * math.sin(y / 9.0) + (_h(x // 4, y // 4, 7) - .5) * 8
    return y >= HZ - 2 and e < x < W1 - e - 6
S.fill(lambda X, Y: AU.gravel_px(X % 48, Y % 48, 130) if _hash(X % 48, Y % 48, 135) < .988 else LF[2], y0=HZ - 2, mask=ballast_mask)

# ---- 하늘(맑은 낮, 숲 안개빛이 도는 엷은 청색)
S.sky([(18, hx('#5f8cc0')), (36, hx('#78a2cf')), (54, hx('#93b8da')), (72, hx('#aecbe2')), (HZ, hx('#c4d8e8'))], HZ - 12, seed=3)
CL = [hx('#9fb6cc'), hx('#d4e2ee'), hx('#eef4fa'), hx('#ffffff')]
S.cloud(70, 16, 46, 9, CL, seed=4); S.cloud(196, 9, 34, 7, CL, seed=5); S.cloud(272, 24, 40, 8, CL, seed=6)
S.cloud(132, 30, 22, 5, CL, seed=7)

# ---- 원경: 먼 숲 줄(뒤 줄은 한 단 어둡게, 앞 줄 밑동이 철로 위 선에 닿는다)
FIR = [P5.ALL[n]() for n in ('fir_m', 'fir_m2', 'fir_l', 'fir_s')]
x = -10
while x < W1 + 10:                                       # 뒷줄(높다)
    f = FIR[rng.randrange(4)]
    S.put(f, x, HZ - 22 - rng.randrange(0, 5), shadow=False, sorty=0)
    x += rng.randrange(12, 20)
x = -16
while x < W1 + 10:                                       # 앞줄 — 참나무·전나무 섞기
    r = rng.random()
    if r < .3: im = B5.tree_look('oakB', rng.randrange(4))
    elif r < .4: im = B5.tree_look('bushD', rng.randrange(4))
    else: im = FIR[rng.randrange(4)]
    S.put(im, x, HZ - 14 - rng.randrange(0, 3), shadow=False, sorty=1)
    x += rng.randrange(14, 26)

# ---- 본선 철로(동서) 한 줄 + 무너진 객차 + 연결부 + 객차 토막
RC = AU.rail_cell(10)
for cx in range(0, W1, 16): S.put(RC, cx, HZ, shadow=False, sorty=5)
CAR = TR.carriage('b')
S.put(CAR, -62, HZ - 1, sorty=20)
S.put(TR.gangway(), 98, HZ - 1, sorty=20)
# 전신주·전신선(숲 앞, 철로 북쪽), 완목 신호기(오른쪽)
for px_ in (150, 226):
    S.put(SN.telegraph_pole(), px_, HZ - 14, sorty=10)
WIRE = SN.telegraph_wire()
seg = WIRE.resize((76, 16), Image.NEAREST)
S.overlay(seg, 158, HZ - 14 - 78 + 10 - 8)
S.put(SN.semaphore(), 252, HZ - 13, sorty=10)

# ---- 가장자리 물체
S.put(SN.water_tower(), 284, 128)
S.put(SN.gas_lamp(True), 262, 150)
S.put(SN.luggage_pile(), 6, 160)
S.put(SN.sleeper_stack(), 30, 134)
FERN = [P5.ALL['fern_' + k]() for k in 'abc']
for (fx, fy) in ((2, 128), (40, 170), (300, 162), (312, 140), (18, 176), (286, 176)):
    S.put(FERN[rng.randrange(3)], fx, fy, shadow=False)
S.put(SN.lost_hat(), 46, 158, shadow=False)

img = S.compose()
img = ghost_grade(img, 0.55)
# 숲 가장자리 안개(위층 덧그림, 반투명): 철로 위 띠에만
FC = AU.fog_cell(15)
fogl = Image.new('RGBA', (W1, H1), (0, 0, 0, 0))
for cx in range(0, W1, 16):
    for cy in (HZ - 30, HZ - 22):
        if _h(cx, cy, 9) > .45 and not (20 < cx < 110): fogl.alpha_composite(FC, (cx, cy))
fa = np.array(fogl); fa[..., 3] = (fa[..., 3] * .55).astype(np.uint8)
img.alpha_composite(Image.fromarray(fa, 'RGBA'))
# 객차 창 속 푸른 빛·도깨비불(가장자리만)
GC = (150, 205, 255)
for (wx, wy) in ((300, 104), (14, 112)):
    w_ = SN.wisp(wx % 3); img.alpha_composite(glow(28, GC, 60), (wx - 14 + 8, wy - 14 + 10)); img.alpha_composite(w_, (wx, wy))
img.alpha_composite(glow(26, GC, 70), (262 - 5, 150 - 46 - 4))
S.img = img
if __name__ == '__main__':
    S.save(ME)
