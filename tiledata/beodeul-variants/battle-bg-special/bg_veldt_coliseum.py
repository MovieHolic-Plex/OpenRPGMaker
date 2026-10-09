# 전투 배경 3 — 투기장 안(veldt-coliseum). src/veldt-coliseum/ 복사본의 그림 함수를 부른다.
#   원경: 맑은 초원 하늘 + 손 구름, 경기장 북쪽 반의 둥근 관람석(vc_coliseum.build_shell 을 전투 화면 크기 상수로 다시 계산 — 같은 화가 알고리즘·버들항 마름돌),
#         가운데 지도자 발코니(balcony, 앞면 마름돌 줄 몇 줄을 빼서 화면에 맞춤), 윗길 깃대(pennant_pole), 경기장 담 걸개
#   바닥: 경기장 모래(ground_sand 표본: 칩셋 모래 결 + 갈퀴 줄 + 잔 자갈)
#   가장자리: 화로(brazier)·큰 깃발(banner_tall)·무기 걸이·승자 기둥, 떨어진 방패·뼈(바닥 장식)
import os, sys, random
ME = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ME)
sys.path.insert(0, os.path.join(ME, 'src', 'veldt-coliseum'))
from bglib import *
from bglib import _h
from vc_base import *
import vc_coliseum as VC, vc_props as VP, vc_veldt as VV, vc_auto as VA

S = BG('veldt-coliseum')
# ---- 관람석 상수(전투 화면용): 폭 320, 북쪽 반만
VC.W = W1; VC.CX = 159.5; VC.RX = 300.0; VC.RY = 50.0; VC.HW = 40; VC.HS = 36; VC.HP = 14; VC.TOP = 28; VC.NT = 6
VC.CY = VC.TOP + VC.HW + VC.RY; VC.RR = math.sqrt((VC.RX ** 2 + VC.RY ** 2) / 2); VC.H = int(VC.CY) + 4
HZ = int(VC.CY - VC.RY * VC.RHO_A)          # 경기장 담 밑(가운데) ≈ 90

# ---- 바닥: 경기장 모래(표본 이어 깔기)
SAND = VA.ground_sand()
S.tile(SAND, 0, H1)
# ---- 하늘
S.sky([(10, hx('#5a8ed0')), (20, hx('#72a2dc')), (30, hx('#8cb6e4')), (44, hx('#a8c8ea'))], 60, seed=11)
CL = [hx('#a8bcd4'), hx('#dce6f0'), hx('#f4f8fc'), hx('#ffffff')]
S.cloud(48, 12, 40, 8, CL, seed=12); S.cloud(250, 8, 52, 9, CL, seed=13); S.cloud(150, 18, 20, 4, CL, seed=14)

# ---- 관람석(북쪽 반)
sh, lab = VC.build_shell(); sh = pz.fin(sh, 0.70)
S.put(sh, 0, sh.height, shadow=False, sorty=0)
# 윗길 깃대(북쪽 호)
for i, a in enumerate((-176, -160, -146, -134, 134, 146, 160, 176, 180)):
    th = a * math.pi / 180
    gy, gx = VC.ground_y(th, (VC.RHO_S + 1) / 2)
    if not (4 <= gx <= W1 - 12): continue
    p = VC.pennant_pole('red' if i % 2 == 0 else 'shroom', abs(a) % 7)
    S.put(p, int(gx) - 4, int(gy - VC.HW) + 2, shadow=False, sorty=1)
# 지도자 발코니: 앞면 마름돌 가운데 14줄을 빼 높이를 맞춘다(문·덮개·난간은 그대로)
B = VC.balcony(); b = B.height - 1
cut0, cut1 = b - 44, b - 30
Bl = Image.new('RGBA', (B.width, B.height - (cut1 - cut0)))
Bl.alpha_composite(B.crop((0, 0, B.width, cut0)), (0, 0)); Bl.alpha_composite(B.crop((0, cut1, B.width, B.height)), (0, cut0))
S.put(Bl, int(VC.CX - Bl.width / 2) + 1, HZ + 1, shadow=False, sorty=2)
# 경기장 담 걸개(발코니 양옆)
for dx in (-74, 58):
    S.put(roman.banner_hanging('red', 22), int(VC.CX + dx), HZ - 1, shadow=False, sorty=3)

# ---- 가장자리 물체
S.put(VP.brazier(), 14, 122); S.put(VP.brazier(), 290, 124)
S.put(VP.banner_tall(), 36, 112)
S.put(VP.victor_column(), 296, 108)
S.put(VP.weapon_rack(), 2, 160)
S.put(VP.shields_stack(), 288, 168)
S.put(VP.dropped_shield(), 52, 150, shadow=False)
S.put(VV.bones_scatter(), 272, 146, shadow=False)
S.put(VP.sand_marks(), 120, 120, shadow=False)
S.put(VP.sand_marks(), 214, 156, shadow=False, flip=True)
S.compose()
if __name__ == '__main__':
    S.save(ME)
