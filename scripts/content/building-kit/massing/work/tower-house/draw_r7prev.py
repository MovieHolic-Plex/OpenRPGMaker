"""tower-house — 원통 망루가 붙은 집(덩어리 모형 15). 2층 회벽 반목조 집(모임지붕) + 오른쪽에 붙은 높은 마름돌 원통 망루
(내쌓기 받침 고리, 좁은 창, 테라코타 원뿔). 9×8 칸(144×128). 문 하나. 다시 돌리면 같은 그림. 난수 없음."""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'guildhall'))
from lib4 import (Canvas, pix, ST, sclamp, fill_walk, cone_eave, tc_cone_radial, warm_cylinder, fill_gap_under,
                  WS_DARK)  # noqa: E402
# 공용 붓은 이 폴더의 common.py(inn·smithy 3차 판 사본) — lib4 가 먼저 들인 guildhall common 과 섞이지 않게 따로 싣는다
import importlib.util as _iu  # noqa: E402
_HERE = os.path.dirname(os.path.abspath(__file__))
_sp = _iu.spec_from_file_location('common_th', os.path.join(_HERE, 'common.py'))
cm = _iu.module_from_spec(_sp)
_sp.loader.exec_module(cm)
roof, hip_side, HIP_LIT, HIP_DARK, eave_shadow, post, beam, brace, window, door, plaster, chimney = (
    cm.roof, cm.hip_side, cm.HIP_LIT, cm.HIP_DARK, cm.eave_shadow, cm.post, cm.beam, cm.brace, cm.window, cm.door,
    cm.plaster, cm.chimney)
sys.path.insert(0, _HERE)
import towerfix as TF  # noqa: E402
from fixups import finalize  # noqa: E402

W, H = 144, 128
c = Canvas(9, 8)
GY = H - 1

# ---------------------------------------------------------------- 집 모임지붕
MX1 = 108
RIDGE_Y = 34
EAVE_Y = 70
RL, RR = 26, 82
KNEE = RIDGE_Y + int((EAVE_Y - RIDGE_Y) * 0.72)
SLL = RL / (EAVE_Y - RIDGE_Y)
SRR = (MX1 - RR) / (EAVE_Y - RIDGE_Y)


def lx(y):
    return RL - (y - RIDGE_Y) * SLL


def rx(y):
    return RR + (y - RIDGE_Y) * SRR


def OUT_L(y):
    return max(0.0, (RL - 3) - (y - RIDGE_Y) * (RL - 3) / (KNEE - RIDGE_Y))


def OUT_R(y):
    return min(MX1 + 0.0, (RR + 3) + (y - RIDGE_Y) * (MX1 - RR - 3) / (KNEE - RIDGE_Y))


roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, 0, MX1, RIDGE_Y + 2, EAVE_Y, vshift=1, hshift=3)
hip_side(c, lambda x, y: OUT_L(y) - 0.5 <= x <= lx(y) + 1, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_LIT)
hip_side(c, lambda x, y: rx(y) - 1 <= x <= OUT_R(y) + 0.5, 0, MX1, RIDGE_Y + 1, EAVE_Y, HIP_DARK, hshift=2)
for y in range(RIDGE_Y + 1, EAVE_Y + 1):
    x = int(round(lx(y)))
    c.put(x, y, 'η')
    c.put(x + 1, y, 'η')
    c.put(x - 1, y, 'σ' if (y % 3) else 'L')
    xr = int(round(rx(y)))
    c.put(xr - 1, y, '_')
    c.put(xr, y, '_')
    c.put(xr + 1, y, 'θ' if (y % 3) else '%')
for y in range(RIDGE_Y + 1, EAVE_Y + 2):
    xo = int(round(OUT_L(y)))
    c.put(xo, y, '-' if y % 2 else 'α')
for x in range(RL - 2, RR + 3):
    c.put(x, RIDGE_Y, 'ζ' if x in (RL - 2, RR + 2) else ('σ' if x % 4 else 'ξ'))
    c.put(x, RIDGE_Y + 1, '-' if x % 4 else 'α')
for x in range(0, MX1 + 1):
    c.put(x, EAVE_Y + 1, '&' if x % 4 else '9')
    c.put(x, EAVE_Y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
c.put(0, EAVE_Y + 1, 'α')
chimney(c, 30, RIDGE_Y - 14, RIDGE_Y + 6, cw=8, start=4, slope=1)

# ---------------------------------------------------------------- 2층 회벽 반목조
WX0, WX1 = 1, 118          # 벽은 원통 뒤까지 이어진다(땅 접합에 틈 없음)
UY0 = EAVE_Y + 3
eave_shadow(c, WX0, UY0, WX1 - WX0 + 1)
UY1 = 99
plaster(c, WX0, UY0 + 5, WX1 - WX0 + 1, UY1 - UY0 - 4, ox=7, oy=4)
for px in (1, 24, 54, 84):
    post(c, px, UY0 + 2, UY1)
beam(c, WX0, WX1, UY0 + 4)
for n, wx in enumerate((34, 64)):          # 창마다 다르게(⑰)
    window(c, wx, 80, w=11, h=11, box=(n == 0), look=1 + n * 2)
brace(c, 6, 96, 19, 80)
brace(c, 89, 80, 100, 96)
for (x, y) in [(10, 86), (48, 92), (77, 84), (93, 90)]:
    c.put(x, y, 'z')
# 내민 보(층 사이)
for x in range(WX0, WX1 + 1):
    c.put(x, 100, 'η' if x % 7 else 'ζ')
    c.put(x, 101, 'ε')
    c.put(x, 102, 'β')
    c.put(x, 103, '_' if x % 6 else '-')
for x in range(4, WX1 - 2, 8):
    c.put(x, 102, 'δ')
    c.put(x + 1, 102, 'δ')

# ---------------------------------------------------------------- 1층 회벽 반목조 + 문
LY0 = 104
plaster(c, WX0, LY0, WX1 - WX0 + 1, GY - 1 - LY0, ox=2, oy=6)
for px in (1, 30, 50, 84):
    post(c, px, LY0, GY - 2)
beam(c, WX0, WX1, GY - 4, h=1)
DX0, DW = 34, 13
DY0 = 103
door(c, DX0, DY0, DW, GY - DY0)
for y in range(DY0 + 1, GY - 1):
    c.put(DX0 - 1, y, 'η')
    c.put(DX0 + DW, y, 'β')
window(c, 62, 108, w=12, h=11, box=True, shutters=True, look=4)
brace(c, 5, GY - 5, 26, LY0 + 2)
# 문 위 작은 차양(널 + 받침)
for x in range(DX0 - 3, DX0 + DW + 3):
    c.put(x, DY0 - 3, 'σ' if x % 3 else 'ξ')
    c.put(x, DY0 - 2, 'η')
    c.put(x, DY0 - 1, '-')
# 문 옆 등불
c.rows(28, 106, ['.UU', '.X.', 'XYX', 'KLK', 'KKτ', 'XUX'])
# 기초
for x in range(WX0, WX1 + 1):
    c.put(x, GY - 1, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
    c.put(x, GY, 'U' if x % 6 else 'T')
for x in range(DX0 - 1, DX0 + DW + 1):
    c.put(x, GY - 1, 'r' if x % 4 else 'm')
    c.put(x, GY, 'Z')
# 화분 둘(문 오른쪽 벽 밑)
c.rows(52, GY - 7, ['.NON.', 'NOPON', 'MNONM', 'κνκνκ', 'λκνκλ', '.λλλ.'])

# ---------------------------------------------------------------- 원통 망루(따뜻한 크림·회갈 돌)
TCX = 121.0
R = 21.0
SAG = 6
TOP = 50
# 몸통: 작은 막돌, 왼쪽 밝음 → 오른쪽 어두움 세로 명암 단계, 줄눈은 밑 타원 따라 휜다(⑲)
TF.shaft(c, TCX, R, TOP - 6, GY, SAG, start=5)
TF.plinth(c, TCX, R, GY, SAG, rows=4, out=1.5, start=2)   # 짙은 돌 받침 — 땅을 딛는다
# 내쌓기 고리(받침돌 두 단, 몸통보다 1px 바깥) — 원뿔 처마 바로 밑, 밑에 그늘
RING = 48
TF.ring_band(c, TCX, R, RING, SAG, rows=4, out=1.2)
TF.ring_band(c, TCX, R, RING + 4, SAG, rows=2, out=0.4)
for x in range(int(TCX - R), int(TCX + R) + 1):      # 고리가 몸통에 드리우는 그늘 2줄
    dx = x + 0.5 - TCX
    if abs(dx) > R:
        continue
    cosv = math.sqrt(max(0.0, 1 - (dx / R) ** 2))
    y0 = RING + 6 - SAG + round(SAG * cosv)
    for d, k in ((0, 3), (1, 2), (2, 1)):
        g = c.get(x, y0 + d)
        if g in TF.WARM:
            c.put(x, y0 + d, TF.WARM[min(10, TF.WARM.index(g) + k)])
# 좁은 창 셋(서로 다르게)
for k, (sx, sy) in enumerate([(113, 62), (129, 78), (112, 96)]):
    TF.slit(c, sx - 3, sy, k)
# 원뿔(작은 비늘, 꼭대기로 좁아진다) — 앞 처마가 고리 위에 얹힌다
CONE_BASE = 38
HW = R + 5
TF.cone(c, TCX, 3, CONE_BASE, HW, 6, start=2)
TF.cone_eave(c, TCX, CONE_BASE, HW, 6)
# 처마와 고리 사이 그늘
for x in range(int(TCX - R) - 1, int(TCX + R) + 2):
    dx = x + 0.5 - TCX
    if abs(dx) > R + 1:
        continue
    f = dx / (R + 1.2)
    cosv = math.sqrt(max(0.0, 1 - min(1.0, f * f)))
    ye = int(round(CONE_BASE + 6 * math.sqrt(max(0, 1 - (dx / HW) ** 2)))) + 2
    yr = RING - SAG + round(SAG * cosv)
    for y in range(ye, yr):
        c.put(x, y, 'J' if f > 0.2 else 't')
ix = int(TCX)
c.rows(ix - 2, 0, ['.KK..', '..X..', '.KLK.'])
finalize(c)

walk = ['.......**', '.......**', '*********', '*********', '*********', 'XXXXXXXXX', 'XXDXXXXXX', 'XXDXXXXXX']
meta = {'name': '원통 망루가 붙은 집', 'massing': '15', 'material': 'plaster',
        'refs': ['bd-manor-tower', 'bd-mpart-tower'], 'walk': fill_walk(c, walk)}
fails, warns = c.save('tower-house', meta)
print('fails', fails, 'warns', warns)
