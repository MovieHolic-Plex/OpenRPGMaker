"""market-hall — 기둥 위 시장홀(덩어리 모형 M08). 8×6 칸(128×96). 다시 돌리면 같은 그림. 난수 없음.
1층: 돌기둥 아치 개방 셋(지나갈 수 있음 — 안은 뒷벽 + 좌판·바구니·통·천 차양), 오른쪽 끝 칸은 막힌 벽 + 문(옆 계단 밑).
2층: 반목조 홀(기둥 사이 창), 손 기와 모임지붕, 용마루 가운데 청석 지붕 작은 등탑."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Canvas, moss, plaster, eave_shadow, post, beam, brace, door  # noqa: E402
from slate import plaster_more  # noqa: E402
from bits import darken, outline, fill_pinholes, window  # noqa: E402
from hand import hip_roof, btiles, rubble, barrel  # noqa: E402
import pix  # noqa: E402
from pix import Ashlar, sclamp  # noqa: E402

from nh import cwin  # noqa: E402

W, H = 128, 96
c = Canvas(8, 6)
GY = H - 1

# ---------------------------------------------------------------- 지붕 + 등탑
R_Y, E_Y = 12, 42
hip_roof(c, 0, W - 1, R_Y, E_Y, 34, 93, seed=4)
# 등탑(용마루 가운데): 회벽 몸 + 루버 창 + 청석 모임(피라미드) 지붕 — 밑은 앞 사면 위에 앉아 그늘을 드리운다
LX0, LX1 = 55, 72
for y in range(7, 17):
    for x in range(LX0 + 1, LX1):
        ch = '3' if (x + y) % 6 else 'y'
        if x >= LX1 - 3:
            ch = 'z'
        c.put(x, y, ch)
post(c, LX0, 7, 16, w=3)
post(c, LX1 - 2, 7, 16, w=3)
c.rows(LX0 + 5, 8, ['ζηηηηζ', 'ηDDDEβ', 'ηεεεεβ', 'ηDAAAβ', 'ηεεεεβ', 'ηAABAβ', 'δ____δ'])
for x in range(LX0, LX1 + 1):                    # 밑 함석 + 지붕 그늘
    c.put(x, 17, 'i' if x < 64 else 'Z')
    darken(c, x, 18, 2)
    darken(c, x, 19, 1)
cx = (LX0 + LX1 + 1) / 2.0
for y in range(0, 8):                            # 청석 피라미드 지붕: 왼 밝음 · 오른 그늘, 처마 9
    hw = 1 + (y * (LX1 - LX0 + 4) / 2) / 7
    for x in range(int(cx - hw), int(cx + hw) + 1):
        if not (cx - hw <= x + 0.5 <= cx + hw):
            continue
        left = x + 0.5 < cx
        rowk = y % 3
        if left:                                  # 잿빛 청석(보랏빛 아님): 줄마다 아래 그늘
            ch = 'k' if rowk == 0 and (x + y) % 3 else ('i' if rowk < 2 else 'e')
        else:
            ch = 'e' if rowk == 0 and (x + y) % 3 else ('b' if rowk < 2 else 'X')
        if abs(x + 0.5 - cx) < 1:                 # 모임 마루: 얇은 밝은 마룻돌 · 그늘 쪽 한 화소
            ch = 'n' if left else 'a'
        c.put(x, y, ch)
c.rows(int(cx) - 1, 0, ['KL'])
for x in range(LX0 - 2, LX1 + 3):
    c.put(x, 7, 'e' if x < cx else 'b')

# ---------------------------------------------------------------- 2층 반목조 홀(기둥 사이 창) — 앞으로 내민 보 위
WX0, WX1 = 2, W - 3
U0, U1 = E_Y + 3, 61
eave_shadow(c, WX0, U0, WX1 - WX0 + 1, rows=('-', 'c', 'f', 'l'))
plaster(c, WX0, U0 + 4, WX1 - WX0 + 1, U1 - U0 - 3, ox=3, oy=2)
plaster_more(c, WX0, U0 + 4, WX1, U1, ox=1)
beam(c, WX0, WX1, U0 + 3, h=1)
POSTS = [2, 31, 63, 95, 123]
for px in POSTS:
    post(c, px, U0 + 3, U1)
cwin(c, 10, U0 + 4, w=8, h=10, frame='wood', glint=0)
brace(c, 22, U1 - 1, 28, U0 + 5)
cwin(c, 41, U0 + 4, w=9, h=10, frame='wood', glint=2, box=True, curtain=True)
cwin(c, 73, U0 + 4, w=9, h=10, frame='wood', lit=True)
cwin(c, 105, U0 + 5, w=7, h=9, frame='wood', glint=1, transom=True, sill=2)
brace(c, 99, U1 - 1, 99, U0 + 5) if False else None
# 내민 바닥보(장선 끝이 보인다) + 받침 까치발
for x in range(0, W):
    c.put(x, 62, 'η' if x % 6 else 'ζ')
    c.put(x, 63, 'ε' if x % 6 else 'θ')
    c.put(x, 64, 'β')
    c.put(x, 65, '_' if x % 3 else '-')

# ---------------------------------------------------------------- 1층 아케이드
A0 = 66
PIL = [(0, 5), (29, 34), (61, 66), (93, 98)]
SPRING, APEX = 74, 68


def in_arch(x, y, x0, x1):
    """둥근 아치(납작): 양 기둥 사이 x0..x1, SPRING 위로 반타원."""
    if y >= SPRING:
        return x0 <= x <= x1
    cxm = (x0 + x1 + 1) / 2.0
    hw = (x1 - x0 + 1) / 2.0
    dy = (SPRING - y) / (SPRING - APEX + 0.5)
    return abs(x + 0.5 - cxm) <= hw * (1 - dy * dy) ** 0.5 if dy < 1 else False


BAYS = [(6, 28), (35, 60), (67, 92)]
wall_ash = Ashlar([5, 6, 5, 6], seed=5, widths=[9, 7, 11, 8, 10, 6, 12, 9, 7, 10])
# 아치 위 벽(돌) + 기둥 + 막힌 오른칸 — 먼저 전부 돌벽, 아치 안은 아래에서 덮는다
pix.flat_wall(c, 0, A0, W, GY - A0 + 1, wall_ash, shade=lambda x, y: -1 if y < A0 + 2 else 0)
for (bx0, bx1) in BAYS:
    for y in range(APEX - 1, GY + 1):
        for x in range(bx0, bx1 + 1):
            if not in_arch(x, y, bx0, bx1):
                continue
            # 안: 뒷벽(그늘진 회벽) 위쪽, 바닥 판석 아래쪽
            if y < 86:
                d = y - APEX
                ch = 'Y' if d < 3 else ('c' if (x * 2 + y) % 9 else 'f')
                if (y - APEX) % 7 == 6:
                    ch = 'Y'                       # 뒷벽 돌 줄눈
                if d < 1:
                    ch = 'X'
            else:
                ch = 'n' if (x + (y - 86) * 3) % 9 else 'k'
                if y == 86:
                    ch = 'e'
            c.put(x, y, ch)
    # 홍예 테(아치 둘레 쐐기돌 한 겹: 왼쪽 밝게)
    for y in range(APEX - 2, SPRING + 1):
        for x in range(bx0 - 1, bx1 + 2):
            if in_arch(x, y, bx0 - 1, bx1 + 1) and not in_arch(x, y, bx0, bx1):
                c.put(x, y, 'r' if x < (bx0 + bx1) // 2 else 'j')
# 기둥: 주두(넓은 돌) + 몸(밝은 왼모·그늘 오른모) + 초석
for (px0, px1) in PIL:
    for y in range(A0, GY - 1):
        for x in range(px0, px1 + 1):
            i = x - px0
            n = px1 - px0
            ch = ('k', 'r', 'n', 'm', 'j', 'e')[min(5, i * 6 // (n + 1))]
            if (y - A0) % 9 == 8:
                ch = 'e' if i < n else 'a'
            c.put(x, y, ch)
    c.rows(px0 - 1, SPRING - 1, ['s' + 'r' * (px1 - px0) + 'm', 'n' + 'k' * (px1 - px0) + 'e'])
    c.rows(px0 - 1, GY - 4, ['n' + 'm' * (px1 - px0) + 'j', 'k' + 'j' * (px1 - px0) + 'a'])

# 좌판 1(왼칸): 나무 좌판(위에서 보이는 판 윗면 4줄 + 앞판) + 윗면에 놓인 바구니 셋
BX = 8
for x in range(BX, BX + 19):
    for j, y in enumerate(range(79, 83)):           # 윗면: 뒤가 어둡고 앞모가 밝다
        c.put(x, y, ('ε', 'η', 'ξ', 'σ')[j] if (x - BX) % 7 else ('δ', 'ε', 'η', 'ξ')[j])
    c.put(x, 83, 'ζ')
    for y in range(84, 92):
        c.put(x, y, 'δ' if (x - BX) % 6 == 0 else ('ε' if y % 3 else 'γ'))
c.rows(BX + 1, 75, ['.κ8κ.', 'κ8κ8κ', '8κLκ8', 'ηεεεβ', '.δδδ.'])
c.rows(BX + 7, 75, ['.NOP.', 'NOQON', 'MNONM', 'ηεεεβ', '.δδδ.'])
c.rows(BX + 13, 76, ['.KLK.', 'KτKLK', 'ηεεεβ', '.δδδ.'])
# 좌판 2(가운데칸): 앞으로 내려오는 줄무늬 천 차양(윗면이 보이는 비탈 면, 앞 끝 물결) + 좌판 윗면 위 물건
for y in range(69, 77):
    j = y - 69
    for x in range(35, 61):
        k = (x - 35) // 4
        red = k % 2 == 0
        ch = ('?', '<', '<', '?', '=', '=', '+', '+')[j] if red else ('s', 'r', 'r', 'n', 'm', 'm', 'k', 'j')[j]
        if (x - 35) % 4 == 3:
            ch = DK_ALT.get(ch, ch) if False else ch
        c.put(x, y, ch)
for x in range(35, 61):                           # 앞 끝 물결 + 밑 그늘
    if (x - 35) % 4 in (1, 2):
        c.put(x, 77, '+' if ((x - 35) // 4) % 2 == 0 else 'j')
    darken(c, x, 78 if (x - 35) % 4 in (1, 2) else 77, 1)
for x in (36, 59):                                # 차양 기둥(좌판까지)
    for y in range(77, 92):
        c.put(x, y, 'η' if x == 36 else 'ε')
for x in range(37, 59):
    for j, y in enumerate(range(81, 84)):
        c.put(x, y, ('ε', 'η', 'ξ')[j] if (x - 37) % 7 else ('δ', 'ε', 'η')[j])
    c.put(x, 84, 'ζ')
    for y in range(85, 92):
        c.put(x, y, 'δ' if (x - 38) % 6 == 0 else 'ε')
c.rows(39, 78, ['.GGE.FFE.KKKτ.8+8', 'HGGEFGFEKLKKτ8L8+', 'EEEBEEEB-ττττ+++!'])   # 천 두루마리·치즈·포도주 묶음
# 좌판 3(오른칸): 통 둘(타원 윗면) + 나무 상자(뚜껑 윗면) + 자루(묶은 윗머리)
barrel(c, 69, 78, w=11, h=13)
c.rows(81, 83, ['ζσσσσσξζ', 'ηξσξσξηβ', 'XηηηηηεX', 'ηθεθεθεβ', 'ηθεθεθεβ', 'XεεεεεεX', 'δ______δ'])
c.rows(83, 79, ['.yz.', 'z22y', 'z2yx', 'yxxw', 'wwwu'])

# 오른 막힌 칸: 계단실 벽 + 문(아치 판자문, 돌 문틀) + 위 작은 채광창
DX, DW = 113, 12
for j in range(GY - 1 - 69):
    for i, ch in ((-2, 'n'), (-1, 'k'), (DW, 'j'), (DW + 1, 'h')):
        c.put(DX + i, 69 + j, ch if j % 5 else 'e')
for i in range(-2, DW + 2):
    c.put(DX + i, 68, 'r' if i < DW // 2 else 'm')
door(c, DX, 70, DW, GY - 1 - 70)
c.rows(101, 70, ['.rmj.', 'rDEDj', 'nD^Be', 'nAABe', 'jeeea'])   # 계단실 채광창(작은 아치창)
c.rows(102, 80, ['ζηηζ', 'ηξεβ', 'ηεεβ', 'δ__δ'])                 # 벽 등잔 받침(나무)
c.put(103, 79, 'K')
c.put(104, 79, 'L')
# 땅 닿는 줄(기단)
for x in range(W):
    inbay = any(a <= x <= b for a, b in BAYS)
    if inbay:
        c.put(x, GY, 'k' if x % 5 else 'e')
        continue
    c.put(x, GY - 1, 'a' if x % 7 else 'Y')
    c.put(x, GY, 'X' if x % 6 else 'W')

moss(c, [(4, 34, 2), (118, 30, 0), (60, 36, 2)])
outline(c, 2)
print('pinholes', fill_pinholes(c))
from edgefix import lift_edges  # noqa: E402
print('edges lifted', lift_edges(c))

walk = []
for cy in range(6):
    r = ''
    for cx in range(8):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        if not op:
            r += '.'
        elif cy == 5 and cx == 7:
            r += 'D'
        elif cy == 5:
            r += '*' if cx in (1, 2, 3, 4, 5) else 'X'
        elif cy == 4:
            r += '*' if cx in (1, 2, 3, 4, 5) else 'X'
        else:
            r += '*'
    walk.append(r)
print('\n'.join(walk))
meta = dict(name='기둥 위 시장홀', massing='M08', material='plaster', refs=['bd-house-inn', 'bd-house-cafe'], walk=walk,
            passages=[[x, 5] for x in (1, 2, 3, 4, 5)])
f, w = c.save('market-hall', meta)
print('FAIL', f, 'WARN', w)
