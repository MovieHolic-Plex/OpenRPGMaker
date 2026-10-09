# 전투 배경 6 — 원시 마을(prehistoric-village). src/prehistoric-village/ 복사본(+ vendor 의 화산 지대 조각)의 그림 함수를 부른다.
#   원경: 맑은 열대 하늘 띠 + 손 구름, 먼 화산 원뿔(화산재·응회암 램프로 찍은 3단 실루엣, 왼쪽 비탈 볕)과 꼭대기 연기 기둥(vf_mountain.smoke_column),
#         그 앞 짙은 소철빛 숲 띠 + 나무고사리·소철 줄(pv_flora), 숲 가장자리의 가죽 천막·움집(pv_dwell)
#   바닥: 다져진 마당 흙(pv_ground.tex_yard) 가운데, 앞쪽 짙은 흙·자갈(tex_darkearth) 덩이, 양 가장자리 고사리 숲 바닥(tex_fernlitter) — ground_layer 의 둥근 가장자리 그대로
#   가장자리: 왼쪽 모닥불·토기 무리·고사리, 오른쪽 조각 토템·뼈 무더기·속새
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'prehistoric-village'))
from bglib import *
from bglib import _h
from pv_base import *
import pv_flora as PF, pv_dwell as PD, pv_props as PR, pv_ground as PG
import vf_mountain as VM

S = BG('prehistoric-village')
HZ = 92
rng = random.Random(606)
Yy, Xx = np.mgrid[0:H1, 0:W1]

# ---- 바닥: 버들항 풀 → 마당 흙·짙은 흙·고사리 숲 바닥 덮개
grass, _ = ground.render(W1, H1, [], np.zeros((H1, W1), bool), 61)
S.paste_ground(grass)
def emask(f): return np.array([[f(x, y) for x in range(W1)] for y in range(H1)], bool)
YARD = emask(lambda x, y: y >= HZ - 4 and abs(x - 160) < 150 - max(0, 120 - y) * .2)
DARK = emask(lambda x, y: y >= 138 and abs(x - 150) < 110 and (x * 7 + y * 3) % 1 == 0)
LIT = emask(lambda x, y: y >= HZ - 4 and (x < 30 + (y - HZ) * .25 or x > 296 - (y - HZ) * .2))
S.img.alpha_composite(PG.ground_layer('yard', YARD, 41))
S.img.alpha_composite(PG.ground_layer('darkearth', DARK, 42, edge='tuft'))
S.img.alpha_composite(PG.ground_layer('fernlitter', LIT, 43))

# ---- 하늘
S.sky([(14, hx('#4c8ad0')), (30, hx('#66a0da')), (46, hx('#84b6e2')), (62, hx('#a2c8e8'))], 72, seed=31)
CL = [hx('#a6b8cc'), hx('#dce6ee'), hx('#f4f8fa'), hx('#ffffff')]
S.cloud(54, 14, 46, 8, CL, seed=32); S.cloud(140, 8, 30, 6, CL, seed=33)

# ---- 먼 화산(원뿔 실루엣: 왼쪽 비탈 볕 tuff, 오른쪽 그늘 vash, 꼭대기 분화구 턱, 비탈 골 줄)
def volcano(cx, peak, base, hw_base, hw_top):
    p = S.img.load()
    for y in range(peak, base):
        f = (y - peak) / (base - peak)
        hw = hw_top + (hw_base - hw_top) * f ** .8
        jag = (_h(y // 2, 1, 7) - .5) * 2
        for x in range(int(cx - hw + jag), int(cx + hw + jag) + 1):
            if not (0 <= x < W1): continue
            u = (x - cx) / max(1, hw)
            if y == peak or (y == peak + 1 and abs(u) > .6): c = RGB('vash', 2)                      # 분화구 턱
            elif u < -.15: c = RGB('tuff', 4) if (u < -.55 or f < .3) else RGB('tuff', 3)
            elif u < .35: c = RGB('vash', 4)
            else: c = RGB('vash', 3)
            g = (x - cx) * .55 + (y - peak) * .2                                                 # 비탈 골 줄
            if int(g) % 9 == 0 and f > .15 and _h(x // 3, y // 5, 8) > .3: c = RGB('vash', 2)
            if u > .8: c = RGB('vash', 2)
            p[x, y] = c + (255,)
volcano(232, 26, 90, 92, 12)
SM = VM.smoke_column()
S.img.alpha_composite(SM, (232 - SM.width // 2 + 4, 26 - SM.height + 14))
S.img.alpha_composite(flipx(VM.smoke_column(3, 3, 44)), (232 - 10, 26 - 70))

# ---- 숲 띠: 짙은 소철빛 언덕선(뒤) + 나무고사리·소철 줄(앞)
CY_ = R('cycad')
S.ridge(HZ - 10, 10, CY_, seed=34, period=36, rough=2)
xs = -14
while xs < W1 + 10:
    r = rng.random()
    im = PF.tree_fern_tall() if r < .3 else (PF.tree_fern_short() if r < .55 else (PF.cycad_large() if r < .85 else PF.fern_clump()))
    S.put(im, xs, HZ - 6 - rng.randrange(0, 4), shadow=False, sorty=1, flip=rng.random() < .5)
    xs += rng.randrange(16, 30)
# 숲 가장자리 마을
S.put(PD.hide_tent_small(), 34, HZ + 12, sorty=30)
S.put(PD.pit_house_small(), 266, HZ + 14, sorty=30)
S.put(PR.firewood_pile() if hasattr(PR, 'firewood_pile') else PR.stone_seat(), 74, HZ + 8, sorty=30)

# ---- 가장자리 물체
S.put(PR.campfire_small(), 8, 150)
S.put(PR.pottery_group(), 26, 172, shadow=False)
S.put(PR.totem_carved(), 300, 150)
S.put(PR.bone_pile(), 278, 172, shadow=False)
S.put(PF.horsetail(), 288, 132, shadow=False); S.put(PF.horsetail(), 4, 120, shadow=False)
S.put(PF.fern_clump(), 46, 176, shadow=False); S.put(PF.fern_clump(), 304, 176, shadow=False)
S.put(PF.cycad_young(), 290, 112)
S.put(PF.tree_fern_short(), -20, 132)
S.compose()
if __name__ == '__main__':
    S.save(ME)
