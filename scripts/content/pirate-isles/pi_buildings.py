"""pirate_isles 건물 — 오두막·통나무집·수상 가옥·술집·창고·항구 사무소·등대·요새 문루·망루·시장 노점·보물 동굴 입구·난파선.

모든 건물은 같은 축척: 문 폭 12 · 높이 23~24(사람 16×24), 벽 높이 ≥ 28, 지붕은 사다리꼴 남쪽 경사면이 위에서 보인다.
문 칸(entrance)은 막힘, 그 바로 아래(조각 밖) 칸이 접근칸이다(approach 가 따로 있으면 그 칸).
"""
import math
from pi_core import *


# ------------------------------------------------------------------ 벽 재질
def wall_planks(c, x, y, w, h, mat='wood', t=0, s=0):
    planks(c, x, y, w, h, mat, t, bw=4, plen=h + 9, s=s, vertical=True, nails=False)
    c.HL(x, y + h - 1, w, K(mat, t - 3)); c.HL(x, y + h - 2, w, K(mat, t - 2))


def wall_bamboo(c, x, y, w, h, s=0, bands=(6, 18)):
    for i in range(w):
        u = (i + s) % 3
        for j in range(h):
            t = (1 if u == 0 else 0 if u == 1 else -2) - (1 if (j + i * 7) % 11 == 0 else 0)
            if (j + (i // 3) * 4) % 9 == 0: t -= 1                    # 대나무 마디
            c.P(x + i, y + j, K('thatch', t))
    for by in bands:
        if by < h:
            c.HL(x, y + by, w, K('wood', -1)); c.HL(x, y + by + 1, w, K('wood', -3))
            for i in range(0, w, 4): c.P(x + i, y + by, K('wood', 1))
    c.HL(x, y + h - 1, w, K('thatch', -3))


def wall_plaster(c, x, y, w, h, s=0, timber=True):
    for j in range(h):
        for i in range(w):
            t = 1 if hsh(i, j, s + 3) % 23 else 0
            if hsh(i // 3, j // 2, s + 5) % 31 == 0: t = 0
            c.P(x + i, y + j, K('plaster', t))
    c.R(x, y + h - 5, w, 5, K('stone', 0)); stones(c, x, y + h - 5, w, 5, 'stone', -1, bh=5, blen=(4, 7), s=s)   # 돌 굽
    c.HL(x, y + h - 6, w, K('plaster', -1))
    if timber:
        c.R(x, y, 3, h - 5, K('dark', 1)); c.VL(x, y, h - 5, K('dark', 2)); c.VL(x + 2, y, h - 5, K('dark', -1))
        c.R(x + w - 3, y, 3, h - 5, K('dark', 0)); c.VL(x + w - 1, y, h - 5, K('dark', -2))


def wall_stone(c, x, y, w, h, s=0, moss=0.08):
    stones(c, x, y, w, h, 'stone', 0, bh=5, blen=(5, 9), s=s, moss=moss)


def under_eave(c, x, y, w, rows=2):
    """처마 밑 그늘: 벽 위 rows 행을 두 단·한 단 어둡게."""
    for j in range(rows):
        for i in range(w):
            col = c.get(x + i, y + j)
            if col is not None: c.P(x + i, y + j, shift_col(col, None, -2 + j))


def step(c, x, y, w, mat='stone'):
    """문 앞 디딤돌(윗면 2 + 앞면 2)."""
    c.R(x, y, w, 2, K(mat, 2)); c.HL(x, y, w, K(mat, 3)); c.R(x, y + 2, w, 2, K(mat, -1)); c.HL(x, y + 3, w, K(mat, -2))


def hanging_sign(c, x, y, icon='mug'):
    """걸린 간판(글자 없음): 쇠 팔 + 나무 판 + 그림 기호."""
    c.HL(x - 1, y, 9, K('iron', 0)); c.P(x - 1, y + 1, K('iron', -1)); c.VL(x + 1, y + 1, 2, K('iron', -1)); c.VL(x + 6, y + 1, 2, K('iron', -1))
    c.R(x, y + 3, 8, 7, K('wood', 0)); c.HL(x, y + 3, 8, K('wood', 2)); c.HL(x, y + 9, 8, K('wood', -2)); c.VL(x + 7, y + 3, 7, K('wood', -2))
    if icon == 'mug':
        c.R(x + 2, y + 5, 3, 4, K('gold', 1)); c.HL(x + 2, y + 5, 3, K('cloth', 3)); c.VL(x + 5, y + 6, 2, K('gold', -1)); c.P(x + 2, y + 8, K('gold', -1))
    elif icon == 'fish':
        c.HL(x + 2, y + 6, 4, K('blue', 2)); c.HL(x + 1, y + 7, 5, K('blue', 0)); c.P(x + 6, y + 5, K('blue', 1)); c.P(x + 6, y + 8, K('blue', 1))
    elif icon == 'anchor':
        c.VL(x + 4, y + 4, 5, K('iron', 1)); c.HL(x + 2, y + 8, 5, K('iron', 0)); c.P(x + 2, y + 7, K('iron', 0)); c.P(x + 6, y + 7, K('iron', 0)); c.HL(x + 3, y + 5, 3, K('iron', 2))


# ------------------------------------------------------------------ 집 틀
def house(c, W, H, wall_h, wall='planks', roof='thatch', door_x=None, wins=(), s=0, inset=None, roof_over=2, base='stone', sign=None, lit=False, door_arch=False):
    """W×H 칸 집. 벽은 아래쪽 wall_h 행(굽 포함), 지붕은 그 위 남은 높이 + 벽 위로 3행 덮음.
    wins = 창 x 목록(창 폭 8). door_x = 문 왼쪽 x(None 이면 가운데)."""
    PW, PH = W * 16, H * 16
    wx0, wx1 = roof_over + 1, PW - roof_over - 1           # 벽 좌우
    wy0 = PH - wall_h; ww = wx1 - wx0
    if wall == 'planks': wall_planks(c, wx0, wy0, ww, wall_h, s=s)
    elif wall == 'bamboo': wall_bamboo(c, wx0, wy0, ww, wall_h, s=s, bands=(5, wall_h - 9))
    elif wall == 'plaster': wall_plaster(c, wx0, wy0, ww, wall_h, s=s)
    elif wall == 'stone': wall_stone(c, wx0, wy0, ww, wall_h, s=s)
    elif wall == 'logs':
        for j in range(wall_h):
            r = j % 4
            for i in range(ww): c.P(wx0 + i, wy0 + j, K('wood', (1 if r == 0 else 0 if r == 1 else -1 if r == 2 else -3) - (1 if hsh(i // 5, j // 4, s) % 5 == 0 and r < 3 else 0)))
        for k in range(0, wall_h, 4): c.R(wx0 - 1, wy0 + k, 3, 3, K('wood', 1)); c.R(wx1 - 2, wy0 + k, 3, 3, K('wood', -1)); c.P(wx0, wy0 + k + 1, K('wood', -2))
    # 벽 양 끝 세로 그늘(입체)
    c.VL(wx0, wy0, wall_h, K('shadow', 2)); c.VL(wx1 - 1, wy0, wall_h, K('shadow', 1))
    for wxw in wins:
        shutter_window(c, wxw, wy0 + 8, 8, 8, 'teal' if wall in ('plaster', 'stone') else 'wood', 'wood' if wall != 'stone' else 'stone', s=s, lit=lit)
    dw, dh = 12, 23
    dx = (PW - dw) // 2 if door_x is None else door_x
    dy = PH - dh - (3 if base else 1)
    door(c, dx, dy, dw, dh, 'wood', 'dark', arch=door_arch, s=s)
    if base:
        step(c, dx - 2, PH - 4, dw + 4, base)
    # 지붕
    rh = wy0 + 4
    hip_roof(c, 0, 0, PW, rh, roof, inset=inset if inset is not None else max(5, PW // 6), s=s)
    under_eave(c, wx0, rh, ww, 2)
    if sign: hanging_sign(c, dx + dw + 3, rh + 2, sign)
    return dict(door=(dx, dy, dw, dh))


@piece('hut-thatch', 'small thatched village hut with bamboo walls and wooden door', 3, 4, 'structure', group='buildings',
       solid=[(x, y) for x in range(3) for y in range(1, 4)], entrance=(1, 3), tags=['집', '오두막', '건물'],
       desc='작은 짚 지붕 오두막(대나무 벽). 문은 맨 아래 가운데.')
def _hut(c):
    house(c, 3, 4, 31, 'bamboo', 'thatch', wins=(6,), s=1)
    c.outline()


@piece('hut-round', 'round thatched hut with conical straw roof', 3, 4, 'structure', group='buildings',
       solid=[(x, y) for x in range(3) for y in range(1, 4)], entrance=(1, 3), tags=['집', '오두막', '건물'],
       desc='둥근 원뿔 짚 지붕 오두막. 문은 맨 아래 가운데.')
def _hut_round(c):
    # 원통 벽(대나무) — 아래 호
    cx = 24
    for y in range(34, 62):
        for x in range(4, 44):
            nx = (x + .5 - cx) / 20
            if abs(nx) > 1: continue
            u = (x // 3) % 3
            t = (1 if nx < -.5 else 0 if nx < .2 else -1 if nx < .7 else -2) + (1 if u == 0 else 0 if u == 1 else -1)
            if (y - 34) % 9 == 4: t -= 1
            c.P(x, y, K('thatch', t))
    c.ellf(cx, 61, 20, 3, lambda x, y, nx, ny, d: K('thatch', -3) if ny > 0 else None)
    for by in (40, 53):
        for x in range(4, 44): c.P(x, by, K('wood', -1 if x % 4 else 1))
    door(c, 18, 38, 12, 23, 'wood', 'dark', arch=True, s=2)
    step(c, 16, 60, 16, 'stone')
    # 원뿔 지붕: 꼭대기 (24,2) → 아래 타원 처마
    for y in range(1, 40):
        f = (y - 1) / 38
        r = 2 + 22 * f
        for x in range(int(cx - r), int(cx + r) + 1):
            nx = (x + .5 - cx) / max(r, 1)
            if abs(nx) > 1: continue
            row = int((y - 1) / 4)
            t = 2 if nx < -.45 else 1 if nx < .1 else 0 if nx < .55 else -1
            if (y - 1) % 4 == 3: t -= 2
            elif (y - 1) % 4 == 0: t += 1
            if hsh(x, row, 3) % 7 == 0: t -= 1
            c.P(x, y, K('thatch', t))
    c.ellf(cx, 39, 23, 3.5, lambda x, y, nx, ny, d: K('thatch', -1 if (x % 2) else -2) if ny > -.2 else None)
    under_eave(c, 5, 42, 38, 2)
    c.R(22, 0, 4, 3, K('wood', 0)); c.HL(22, 0, 4, K('wood', 2))            # 꼭대기 묶음
    c.outline()


@piece('cabin', 'log cabin with thatched hip roof and two shuttered windows', 4, 4, 'structure', group='buildings',
       solid=[(x, y) for x in range(4) for y in range(1, 4)], entrance=(1, 3), tags=['집', '통나무집', '건물'],
       desc='통나무집(짚 모임지붕, 덧창 둘). 문은 맨 아래 왼쪽에서 두 번째 칸.')
def _cabin(c):
    house(c, 4, 4, 32, 'logs', 'thatch', door_x=18, wins=(40, 50), s=3)
    c.outline()


@piece('house-plaster', 'whitewashed colonial house with terracotta tile roof and teal shutters', 4, 5, 'structure', group='buildings',
       solid=[(x, y) for x in range(4) for y in range(1, 5)], entrance=(1, 4), tags=['집', '항구', '건물'],
       desc='회칠 벽 + 붉은 기와 항구 집. 문은 맨 아래 왼쪽에서 두 번째 칸.')
def _house_pl(c):
    house(c, 4, 5, 38, 'plaster', 'terra', door_x=18, wins=(8, 44), s=4)
    # 2층 다락 창(지붕 위 돌출창): 윗면 + 앞면
    c.R(24, 18, 14, 3, K('terra', 2)); c.HL(24, 18, 14, K('terra', 3)); c.R(25, 21, 12, 9, K('plaster', 1)); c.R(28, 22, 6, 6, K('shadow', 0)); c.HL(28, 22, 6, K('shadow', -1))
    c.VL(31, 22, 6, K('dark', 0)); c.HL(27, 28, 8, K('wood', 1)); c.VL(25, 21, 9, K('plaster', 2)); c.VL(36, 21, 9, K('plaster', -1))
    c.outline()


@piece('tavern', 'two-storey harbor tavern with tile roof, timber-framed plaster walls, porch canopy and hanging mug sign', 6, 6, 'structure', group='buildings',
       solid=[(x, y) for x in range(6) for y in range(1, 6)], entrance=(2, 5), tags=['술집', '항구', '건물'],
       desc='2층 항구 술집(기와 지붕·회칠 벽·현관 차양·맥주잔 간판, 글자 없음). 문은 맨 아래 왼쪽에서 세 번째 칸.')
def _tavern(c):
    PW, PH = 96, 96
    wy0 = 40
    wall_plaster(c, 3, wy0, 90, PH - wy0, s=5)
    for px in (30, 64): c.R(px, wy0, 3, PH - wy0 - 5, K('dark', 0)); c.VL(px, wy0, PH - wy0 - 5, K('dark', 1))
    c.HL(3, 66, 90, K('dark', 0)); c.HL(3, 67, 90, K('dark', -2))                     # 2층 마루 들보
    for wx in (10, 40, 52, 76): shutter_window(c, wx, wy0 + 8, 8, 8, 'teal', 'wood', lit=True)
    for wx in (10, 76): shutter_window(c, wx, 72, 8, 9, 'teal', 'wood', lit=True)
    door(c, 42, 70, 12, 23, 'wood', 'dark', s=5)
    step(c, 40, 92, 16, 'stone')
    # 현관 차양(문 위): 윗면 판자 + 앞 들보 + 기둥 둘
    x0, x1 = 36, 60
    planks(c, x0, 61, x1 - x0, 4, 'wood', 1, bw=4, plen=7, s=5, vertical=True, nails=False)
    c.HL(x0, 61, x1 - x0, K('wood', -1)); c.R(x0, 65, x1 - x0, 2, K('dark', 0)); c.HL(x0, 67, x1 - x0, K('shadow', 1))
    for px in (x0 + 1, x1 - 3):
        c.R(px, 67, 2, 26, K('wood', 0)); c.VL(px, 67, 26, K('wood', 2)); c.VL(px + 1, 67, 26, K('wood', -2))
    hanging_sign(c, 66, 70, 'mug')
    hip_roof(c, 0, 0, PW, wy0 + 4, 'terra', inset=14, s=5)
    under_eave(c, 4, wy0 + 4, 88, 2)
    c.VL(3, wy0 + 4, PH - wy0 - 4, K('shadow', 2)); c.VL(92, wy0 + 4, PH - wy0 - 4, K('shadow', 1))
    # 굴뚝(지붕 윗면 위, 윗면 보이는 상자)
    box(c, 70, 8, 8, 3, 7, 'stone', tt=2, ft=0); c.R(71, 8, 6, 2, K('shadow', 0))
    c.outline()


@piece('warehouse', 'wooden harbor warehouse with big double cargo doors and pulley beam', 5, 4, 'structure', group='buildings',
       solid=[(x, y) for x in range(5) for y in range(1, 4)], entrance=(2, 3), tags=['창고', '항구', '건물'],
       desc='항구 창고(큰 두 짝 화물문, 도르래 들보). 문은 맨 아래 가운데.')
def _warehouse(c):
    PW = 80
    wall_planks(c, 3, 26, 74, 38, 'wood', -1, s=6)
    c.VL(3, 26, 38, K('shadow', 2)); c.VL(76, 26, 38, K('shadow', 1))
    # 큰 화물문(두 짝, X 버팀)
    c.R(25, 34, 30, 30, K('dark', -1)); c.HL(25, 34, 30, K('dark', 1))
    for (dx0) in (26, 40):
        planks(c, dx0, 36, 14, 28, 'wood', 0, bw=3, plen=40, vertical=True, s=dx0, nails=False)
        c.line(dx0, 37, dx0 + 13, 62, K('wood', -2)); c.line(dx0 + 13, 37, dx0, 62, K('wood', -2))
        c.HL(dx0, 36, 14, K('wood', -3)); c.R(dx0, 49, 14, 2, K('iron', -1))
    c.VL(40, 36, 28, K('dark', -2)); c.P(38, 48, K('gold', 1)); c.P(42, 48, K('gold', 1))
    shutter_window(c, 9, 38, 8, 8, 'wood', 'wood'); shutter_window(c, 63, 38, 8, 8, 'wood', 'wood')
    hip_roof(c, 0, 0, PW, 30, 'thatch', inset=10, s=6, tier=5)
    under_eave(c, 4, 30, 72, 2)
    # 도르래 들보(지붕 앞으로 튀어나옴)
    c.R(37, 24, 6, 6, K('dark', 1)); c.HL(37, 24, 6, K('dark', 3)); c.R(38, 30, 4, 2, K('dark', -1))
    c.VL(40, 32, 4, K('thatch', -1)); c.R(39, 31, 3, 2, K('iron', 0))
    c.outline()


@piece('harbor-office', 'two-storey stone harbor master house with tile roof and balcony', 5, 6, 'structure', group='buildings',
       solid=[(x, y) for x in range(5) for y in range(1, 6)], entrance=(2, 5), tags=['항구', '관청', '건물'],
       desc='2층 돌 항만 관리소(기와 지붕·발코니·닻 간판). 문은 맨 아래 가운데.')
def _office(c):
    PW, PH = 80, 96
    wall_stone(c, 3, 34, 74, 62, s=7)
    c.VL(3, 34, 62, K('shadow', 2)); c.VL(76, 34, 62, K('shadow', 1))
    for wx in (10, 62): shutter_window(c, wx, 42, 8, 9, 'teal', 'stone')
    for wx in (10, 62): shutter_window(c, wx, 70, 8, 9, 'teal', 'stone')
    # 발코니(2층 문 앞): 윗면 판자 + 난간 + 받침
    c.R(28, 46, 24, 9, K('shadow', 0)); door(c, 34, 44, 12, 14, 'wood', 'dark', s=7)
    c.R(24, 58, 32, 4, K('wood', 1)); c.HL(24, 58, 32, K('wood', 3)); c.R(24, 62, 32, 2, K('wood', -2))
    for i in range(24, 56, 3): c.VL(i, 52, 6, K('wood', 0 if i % 2 else -1))
    c.HL(24, 51, 32, K('wood', 2)); c.HL(24, 52, 32, K('wood', -1))
    for bx in (26, 52): c.line(bx, 64, bx + (3 if bx < 40 else -3), 68, K('dark', 0))
    door(c, 34, 70, 12, 23, 'wood', 'dark', arch=True, s=8)
    step(c, 31, 92, 18, 'stone')
    hanging_sign(c, 50, 70, 'anchor')
    hip_roof(c, 0, 0, PW, 38, 'terra', inset=12, s=8)
    under_eave(c, 4, 38, 72, 2)
    c.HL(4, 65, 72, K('stone', 2)); c.HL(4, 66, 72, K('stone', -2))     # 층 띠돌
    c.outline()


@piece('stilt-hut', 'stilt house on wooden piles over the water with thatched roof and porch deck', 3, 5, 'structure', group='buildings',
       solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3), (0, 4), (2, 4)], entrance=(1, 3), approach=(1, 4),
       tags=['수상 가옥', '오두막', '건물', '물'], desc='물 위 수상 가옥(말뚝 위 짚 지붕 집 + 앞 마루 + 가운데 사다리 계단). 아래 줄 가운데 칸이 계단(걷는다) — 그 아래 칸에 판자 부두를 잇는다. 물 위에 둔다.')
def _stilt(c):
    PW = 48
    # 말뚝(물에 박힘) + 거품
    for px in (5, 14, 31, 40):
        c.R(px, 60, 3, 18, K('dark', 0)); c.VL(px, 60, 18, K('dark', 2)); c.VL(px + 2, 60, 18, K('dark', -2))
        c.HL(px - 1, 77, 5, K('foam', 0)); c.P(px + 1, 77, K('foam', 1)); c.P(px - 2, 78, K('foam', -1)); c.P(px + 4, 78, K('foam', -1))
    c.line(6, 70, 15, 62, K('dark', -1)); c.line(32, 62, 41, 70, K('dark', -1))           # 버팀대
    # 계단(가운데 칸, 아래로) — 윗면 밝은 디딤판
    for k in range(5):
        y = 63 + k * 3
        c.R(18, y, 12, 1, K('wood', 2)); c.R(18, y + 1, 12, 2, K('wood', -1))
    c.VL(17, 62, 18, K('dark', 0)); c.VL(30, 62, 18, K('dark', -1))
    # 앞 마루(윗면 판자 5 + 앞 들보 3)
    planks(c, 1, 52, 46, 6, 'wood', 1, bw=3, plen=11, s=9, nails=False)
    c.HL(1, 52, 46, K('wood', -1)); c.R(1, 58, 46, 3, K('dark', 1)); c.HL(1, 60, 46, K('dark', -2))
    c.HL(1, 58, 46, K('dark', 2))
    c.clear(18, 58, 12, 3); [c.R(18, 58 + k, 12, 1, K('wood', 1 - k)) for k in range(3)]
    # 벽(대나무) + 문
    wall_bamboo(c, 4, 26, 40, 26, s=9, bands=(4, 17))
    c.VL(4, 26, 26, K('shadow', 2)); c.VL(43, 26, 26, K('shadow', 1))
    door(c, 18, 29, 12, 23, 'wood', 'dark', s=9)
    shutter_window(c, 7, 33, 6, 7, 'wood', 'wood', sill=False); shutter_window(c, 36, 33, 6, 7, 'wood', 'wood', sill=False)
    # 난간(마루 양옆)
    for (x0, x1) in ((2, 16), (32, 46)):
        c.HL(x0, 46, x1 - x0, K('wood', 2)); c.HL(x0, 47, x1 - x0, K('wood', -1))
        for i in range(x0, x1, 4): c.VL(i, 47, 6, K('wood', 0)); c.P(i, 47, K('wood', 2))
    hip_roof(c, 0, 0, PW, 30, 'thatch', inset=8, s=9)
    under_eave(c, 5, 30, 38, 2)
    c.outline()


@piece('lighthouse', 'white and red striped stone lighthouse with lantern room and gallery', 2, 6, 'structure', group='buildings',
       solid=[(0, 4), (1, 4), (0, 5), (1, 5), (0, 3), (1, 3)], entrance=(0, 5), tags=['등대', '건물'],
       desc='붉고 흰 줄 등대(위 등실·둘레 난간, 아래 문). 곶·방파제 끝에 둔다. 문은 맨 아래 왼쪽 칸.')
def _lighthouse(c):
    cx = 16
    # 탑(아래 넓고 위 좁은 원통) 띠: 흰/빨강
    for y in range(26, 92):
        f = (y - 26) / 66
        r = 7 + 5 * f
        band = ((y - 26) // 11) % 2
        mat = 'red' if band else 'plaster'
        for x in range(int(cx - r), int(cx + r) + 1):
            nx = (x + .5 - cx) / r
            if abs(nx) > 1: continue
            t = (2 if nx < -.55 else 1 if nx < -.1 else 0 if nx < .45 else -1 if nx < .8 else -2) - (1 if mat == 'red' else 0)
            if (y - 26) % 11 == 0: t -= 1
            c.P(x, y, K(mat, t))
    # 돌 기단(윗면 타원 + 앞면)
    c.ellf(cx, 88, 14, 4, lambda x, y, nx, ny, d: K('stone', 2 if ny < 0 else 0))
    for y in range(88, 95):
        for x in range(2, 31):
            nx = (x + .5 - cx) / 14.5
            if abs(nx) <= 1: c.P(x, y, K('stone', (0 if nx < -.3 else -1 if nx < .5 else -2) - (1 if (y - 88) % 4 == 3 else 0)))
    c.ellf(cx, 94, 14.5, 1.5, lambda x, y, nx, ny, d: K('stone', -3) if ny > 0 else None)
    # 문
    door(c, 10, 66, 12, 22, 'wood', 'dark', arch=True, s=10)
    step(c, 8, 88, 16, 'stone')
    # 작은 창
    c.R(14, 46, 4, 6, K('shadow', 0)); c.HL(14, 46, 4, K('stone', 2)); c.R(13, 30, 3, 5, K('shadow', 0))
    # 난간 받침(윗면 타원) + 등실 + 지붕
    c.ellf(cx, 26, 15, 6, lambda x, y, nx, ny, d: K('stone', 2 if ny < -.2 else 1 if d < .7 else 0))       # 난간 마루(윗면, 넓은 타원)
    c.ellf(cx, 29, 15, 3, lambda x, y, nx, ny, d: K('stone', -2) if ny > .2 else None)
    for x in range(2, 31, 3):
        yb = 26 + int(5.5 * math.sqrt(max(0, 1 - ((x - cx) / 15) ** 2)))
        c.VL(x, yb - 5, 5, K('iron', 0 if x < 16 else -1)); c.P(x, yb - 5, K('iron', 2))
    for x in range(1, 32):
        yb = 26 + int(5.5 * math.sqrt(max(0, 1 - ((x - cx) / 15.5) ** 2)))
        c.P(x, yb - 6, K('iron', 1))
    c.R(10, 11, 13, 10, K('gold', 1))
    for y in range(12, 20):
        for x in range(11, 22):
            c.P(x, y, K('fire', 3 if (x - 11) < 4 and y < 15 else 2 if x < 17 else 1))
    c.VL(16, 9, 12, K('iron', -1)); c.VL(10, 9, 12, K('iron', 0)); c.VL(22, 9, 12, K('iron', -2))
    for y in range(0, 11):                                                         # 원뿔 지붕(위에서 보이는 경사면)
        f = y / 10; r = 1 + 9 * f
        for x in range(int(cx - r), int(cx + r) + 1):
            nx = (x + .5 - cx) / max(r, 1)
            if abs(nx) <= 1: c.P(x, y, K('red', (2 if nx < -.4 else 1 if nx < .2 else -1) - (1 if y % 3 == 2 else 0)))
    c.ellf(cx, 10, 10, 2, lambda x, y, nx, ny, d: K('red', -2) if ny > 0 else None)
    c.P(16, 0, K('iron', 1))
    c.outline()


@piece('fort-gate', 'stone fort gatehouse with arched wooden gate, crenellated top walkway and flag', 4, 5, 'structure', group='buildings',
       solid=[(0, 1), (3, 1), (0, 2), (3, 2), (0, 3), (3, 3), (0, 4), (3, 4), (1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3), (1, 4), (2, 4)],
       entrance=(1, 4), tags=['요새', '문', '건물'], desc='요새 문루(아치 나무 대문 두 짝·윗면 성벽길·여장). 성벽(at-fortwall) 줄 가운데에 끼운다. 문은 맨 아래 가운데 두 칸.')
def _fort_gate(c):
    PW, PH = 64, 80
    # 윗면(성벽길, 사다리꼴로 원근)
    top_h = 22
    for j in range(top_h):
        a = int(4 * (1 - j / top_h)); b = PW - 1 - a
        for i in range(a, b + 1):
            col = K('stone', 1 + (1 if (i // 4 + j // 3) % 5 == 0 else 0) - (1 if hsh(i, j, 3) % 9 == 0 else 0))
            if j % 6 == 5: col = K('stone', -1)
            c.P(i, j, col)
    # 여장(앞·뒤): 윗면 있는 돌 덩이
    for j in range(5, 14):
        for i in range(4, PW - 4): c.P(i, j, K('stone', -1 + (1 if (i // 5 + j // 3) % 4 == 0 else 0) - (1 if j == 5 else 0)))   # 걷는 길(낮고 어둡다)
    for i in range(1, PW - 7, 11):
        box(c, i + 2, 0, 7, 3, 3, 'stone', tt=3, ft=0, sides=True)              # 뒤 여장
    for i in range(0, PW - 8, 11):
        box(c, i + 1, 13, 9, 4, 5, 'stone', tt=3, ft=0, sides=True)             # 앞 여장
        c.R(i + 10, 15, 2, 7, K('shadow', 1))
    # 앞면 돌벽
    stones(c, 0, 22, PW, PH - 22, 'stone', 0, bh=5, blen=(6, 10), s=11, moss=0.08)
    c.HL(0, 22, PW, K('stone', -3)); c.HL(0, 23, PW, K('stone', -2))
    # 아치 문
    ax, aw, ay = 16, 32, 44
    for y in range(ay - 8, PH):
        for x in range(ax - 3, ax + aw + 3):
            dx = (x + .5 - (ax + aw / 2)) / (aw / 2 + 3); dy = (y + .5 - ay) / 11
            if y < ay and dx * dx + dy * dy > 1: continue
            c.P(x, y, K('stone', 2 if x < ax + aw / 2 else 1))         # 아치 테 돌
    for y in range(ay - 6, PH - 2):
        for x in range(ax, ax + aw):
            dx = (x + .5 - (ax + aw / 2)) / (aw / 2); dy = (y + .5 - ay) / 9
            if y < ay and dx * dx + dy * dy > 1: continue
            c.P(x, y, K('dark', 0))
    for dx0 in (ax + 1, ax + aw // 2 + 1):
        planks(c, dx0, ay - 4, aw // 2 - 2, PH - ay + 1, 'wood', -1, bw=3, plen=60, vertical=True, s=dx0, nails=False)
        for hy in (ay, ay + 14, ay + 26):
            c.HL(dx0, hy, aw // 2 - 2, K('iron', -1)); for_x = [c.P(dx0 + k, hy, K('iron', 1)) for k in (1, aw // 2 - 4)]
    # 아치 꼭대기 밖(문짝 사이) 다시 깎기: 아치 안쪽 위 곡선
    for y in range(ay - 9, ay):
        for x in range(ax, ax + aw):
            dx = (x + .5 - (ax + aw / 2)) / (aw / 2); dy = (y + .5 - ay) / 9
            if dx * dx + dy * dy > 1 and dx * dx + dy * dy < 1.25: c.P(x, y, K('stone', -2))
    c.VL(ax + aw // 2, ay - 6, PH - ay + 4, K('dark', -2))
    c.R(ax - 3, PH - 2, aw + 6, 2, K('stone', -2))
    # 깃대 + 해적기(해골 무늬, 글자 없음)
    c.R(54, 0, 2, 20, K('wood', 0)); c.VL(54, 0, 20, K('wood', 2))
    c.R(56, 1, 9 - 1, 7, K('shadow', 1)); c.HL(56, 1, 8, K('shadow', 2))
    c.P(59, 3, K('bone', 3)); c.P(60, 3, K('bone', 3)); c.P(59, 4, K('bone', 1)); c.P(60, 4, K('bone', 1)); c.P(58, 6, K('bone', 2)); c.P(61, 6, K('bone', 2))
    c.outline()


@piece('watchtower', 'tall wooden watchtower on four legs with thatched lookout platform and ladder', 2, 5, 'structure', group='buildings',
       solid=[(0, 4), (1, 4)], tags=['망루', '건물'], desc='나무 망루(네 다리·사다리·짚 지붕 망대). 해변·요새 모퉁이.')
def _watch(c):
    for (x0, x1) in ((5, 7), (25, 23)):
        c.line(x0, 78, x1 + (2 if x0 < 16 else -2), 34, K('dark', 1 if x0 < 16 else -1)); c.line(x0 + 1, 78, x1 + (3 if x0 < 16 else -1), 34, K('dark', 0))
    for (x0, x1) in ((9, 10), (21, 20)):
        c.line(x0, 74, x1, 36, K('dark', -1))
    for y in (46, 60): c.HL(7, y, 18, K('dark', 0)); c.HL(7, y + 1, 18, K('dark', -2))
    c.line(8, 47, 23, 59, K('dark', -1)); c.line(23, 47, 8, 59, K('dark', -2))
    for k in range(8): c.HL(13, 40 + k * 5, 6, K('wood', 1))              # 사다리
    c.VL(13, 36, 42, K('wood', 0)); c.VL(18, 36, 42, K('wood', -1))
    # 망대 마루 + 난간
    for j in range(9):                                                            # 망대 마루 윗면(사다리꼴, 뒤가 좁다)
        a = 4 - j // 3; b = 28 + j // 3
        planks(c, a, 24 + j, b - a, 1, 'wood', 1, bw=5, plen=9, s=12 + j, vertical=True, nails=False)
    c.HL(4, 24, 24, K('wood', -1))
    c.R(1, 33, 30, 3, K('dark', 0)); c.HL(1, 33, 30, K('dark', 2)); c.HL(1, 35, 30, K('dark', -2))
    c.HL(4, 19, 24, K('wood', 2)); c.HL(4, 20, 24, K('wood', -1))                 # 뒤 난간
    for i in range(5, 28, 4): c.VL(i, 20, 4, K('wood', 0))
    for (x, y) in ((8, 27), (20, 29)): crate_like = c.R(x, y, 5, 3, K('wood', 2)); c.R(x, y + 3, 5, 2, K('wood', -1))   # 망대 위 작은 상자
    for px in (4, 26): c.R(px, 12, 2, 13, K('wood', 0)); c.VL(px, 12, 13, K('wood', 2))
    hip_roof(c, 0, 0, 32, 15, 'thatch', inset=9, s=12, tier=4)
    c.outline()


@piece('stall-fruit', 'market stall with striped red awning and fruit baskets on the counter', 2, 2, 'structure', group='buildings',
       solid=[(0, 1), (1, 1)], tags=['시장', '노점'], desc='시장 노점(붉은 줄 차양·과일 바구니). 뒤(북쪽)에서 장사, 앞 칸에서 산다.')
def _stall_f(c): stall(c, 'red', 'fruit', 1)


@piece('stall-fish', 'fish market stall with blue striped awning, fish on ice and baskets', 2, 2, 'structure', group='buildings',
       solid=[(0, 1), (1, 1)], tags=['시장', '노점'], desc='생선 노점(푸른 줄 차양).')
def _stall_fi(c): stall(c, 'blue', 'fish', 2)


@piece('stall-goods', 'trade goods stall with cream canvas awning, pots and rolled cloth', 2, 2, 'structure', group='buildings',
       solid=[(0, 1), (1, 1)], tags=['시장', '노점'], desc='잡화 노점(흰 범포 차양·항아리·천 두루마리).')
def _stall_g(c): stall(c, 'cloth', 'goods', 3)


def stall(c, col, goods, s):
    # 기둥
    for px in (2, 28):
        c.R(px, 6, 2, 26, K('wood', 0)); c.VL(px, 6, 26, K('wood', 2))
    # 계산대(윗면 판 7 + 앞면 9)
    box(c, 1, 16, 30, 7, 9, 'wood', tt=1, ft=-1, tex='planks', s=s)
    for i in range(3, 30, 6): c.VL(i, 24, 8, K('wood', -2))
    # 상품(계산대 윗면 위)
    if goods == 'fruit':
        for (x, mat) in ((5, 'fire'), (13, 'gold'), (21, 'leaf')):
            c.ellf(x + 3, 19, 4, 2.5, lambda xx, yy, nx, ny, d: K('thatch', -1 if d > .6 else 1))
            for k in range(4): lit_blob(c, x + 1 + (k % 2) * 3 + .5, 17.5 + (k // 2) * 1.5, 1.6, 1.4, mat, 0, s=k + x)
    elif goods == 'fish':
        c.R(4, 17, 24, 5, K('foam', 0)); c.HL(4, 17, 24, K('foam', 1))
        for k in range(4):
            x = 5 + k * 6
            c.HL(x, 18 + k % 2, 4, K('blue', 2)); c.HL(x, 19 + k % 2, 4, K('iron', 1)); c.P(x + 4, 18 + k % 2, K('blue', 0)); c.P(x + 4, 20 + k % 2, K('blue', 0))
    else:
        for (x, mat) in ((5, 'terra'), (12, 'terra')):
            lit_blob(c, x + 2, 18, 3, 3, mat, 0, s=x); c.ell(x + 2, 15.5, 1.5, 0.8, K(mat, -2))
        for k in range(3): c.R(19 + k * 3, 16, 3, 5, K(('red', 'blue', 'teal')[k], 1)); c.HL(19 + k * 3, 16, 3, K(('red', 'blue', 'teal')[k], 3))
    # 차양(사다리꼴 천 윗면, 줄무늬) + 앞 술 장식 물결
    for j in range(12):
        a = int(3 * (1 - j / 12)); b = 31 - a
        for i in range(a, b + 1):
            stripe = ((i - a) * 6 // max(1, b - a)) % 2
            mat = col if stripe == 0 else 'cloth'
            t = (2 if j < 3 else 1 if j < 8 else 0) - (0 if mat == 'cloth' else 1)
            if mat == 'cloth' and col == 'cloth': mat, t = 'thatch', t
            c.P(i, j, K(mat, t))
    for i in range(0, 32):
        stripe = (i * 6 // 32) % 2
        mat = col if stripe == 0 else 'cloth'
        if mat == 'cloth' and col == 'cloth': mat = 'thatch'
        c.P(i, 12, K(mat, -1)); c.P(i, 13, K(mat, -2) if i % 4 < 2 else None)
    c.outline()


@piece('cave-entrance', 'treasure cave entrance in a rocky mound with dark arched mouth, vines and skull marker', 3, 3, 'structure', group='buildings',
       solid=[(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (2, 2), (1, 1), (1, 2)], entrance=(1, 2), tags=['동굴', '보물', '건물'],
       desc='보물 동굴 입구(바위 둔덕·검은 아치 굴·덩굴·해골 표식). 문은 맨 아래 가운데.')
def _cave(c):
    # 바위 둔덕: 큰 덩이 여러 개
    for (cx, cy, rx, ry, s) in ((24, 22, 23, 18, 1), (10, 32, 10, 12, 2), (38, 32, 10, 12, 3), (24, 12, 14, 10, 4)):
        lit_blob(c, cx, cy, rx, ry, 'rock', 0, s=s, rough=0.08)
    # 윗면(풀·이끼 덮인 꼭대기) — 위에서 보이는 면
    leafy(c, 24, 9, 13, 6, 'grass', 0, s=5, lumps=3)
    for k in range(10): c.VL(8 + k * 3 + (k % 2), 14 + k % 3, 5 + hsh(k, 1) % 8, K('moss', k % 3 - 1))  # 늘어진 덩굴
    # 굴 입구(아치): 테 돌 + 검은 안
    for y in range(24, 48):
        for x in range(13, 36):
            dx = (x + .5 - 24) / 11.5; dy = (y + .5 - 34) / 12
            if y < 34 and dx * dx + dy * dy > 1: continue
            if abs(dx) > 1: continue
            edge = (dx * dx + (dy if y < 34 else 0) ** 2)
            c.P(x, y, K('rock', -2) if edge > .72 else K('shadow', 0 if edge > .4 else -1))
    for x in range(13, 36): c.P(x, 47, K('rock', -2))
    c.HL(15, 46, 19, K('shadow', 1))
    # 해골 표식(입구 위)
    c.R(22, 20, 5, 4, K('bone', 2)); c.HL(22, 20, 5, K('bone', 3)); c.P(23, 22, K('shadow', 0)); c.P(25, 22, K('shadow', 0)); c.HL(23, 24, 3, K('bone', 0))
    c.P(23, 25, K('bone', -1)); c.P(25, 25, K('bone', -1))
    c.outline()


@piece('shipwreck', 'broken shipwreck hull lying tilted on the sand with exposed ribs and snapped mast', 5, 3, 'structure', group='buildings',
       solid=[(x, y) for x in range(5) for y in range(1, 3)] + [(1, 0), (2, 0), (3, 0)], tags=['난파선', '해변'],
       desc='모래에 박힌 난파선(기운 선체·드러난 갈비뼈·부러진 돛대). 해변에 둔다.')
def _wreck(c):
    # 배 윤곽: 왼쪽 뾰족한 뱃머리(들림) → 오른쪽 부서진 고물. 위에서 비스듬히: 갑판(윗면) + 남쪽 뱃전(앞면).
    def deck_edge(x):           # 갑판 남쪽 가장자리 y
        return 30 - int(10 * max(0, (22 - x) / 22) ** 1.6)
    def deck_back(x):           # 갑판 북쪽 가장자리 y
        w = 16 * math.sqrt(max(0, min(1, (x - 4) / 26)))
        return deck_edge(x) - int(w)
    for x in range(4, 74):
        e, bk = deck_edge(x), deck_back(x)
        for y in range(bk, e):
            row = (y - bk); t = 1 if row % 3 else -1
            if hsh(x // 7, y // 3, 3) % 5 == 0: t -= 1
            if y == bk: t = -2
            c.P(x, y, K('wood', t))
        # 뱃전(앞면): 갑판 가장자리 아래 12px, 판자 줄
        for y in range(e, e + 12 + (2 if x > 20 else 0)):
            r = y - e
            t = (2 if r == 0 else 0 if r < 3 else -1 if r < 8 else -2) - (1 if r % 4 == 3 else 0)
            c.P(x, y, K('dark', t))
    # 부서진 고물(오른쪽): 판자 끝 들쭉날쭉 + 갈비뼈
    for x in range(60, 76):
        for y in range(0, 48):
            if c.has(x, y) and (x - 60) > 6 + hsh(y // 3, 0, 9) % 8: c.clear(x, y)
    for k, rx in enumerate((58, 63, 68, 73)):
        top = 6 + k * 2
        for y in range(top, 40):
            dx = int(round(2.5 * math.sin((y - top) / 34 * math.pi)))
            c.P(rx + dx, y, K('dark', 2 if y < top + 3 else 0)); c.P(rx + dx + 1, y, K('dark', -1))
    # 갑판 구멍
    c.ellf(40, 22, 7, 3.5, lambda x, y, nx, ny, d: K('shadow', 0 if ny > -0.4 else 1))
    for x in range(35, 46, 3): c.VL(x, 20, 3, K('wood', -2))
    # 부러진 돛대(갑판 위에 비스듬히 누움) + 찢어진 돛
    c.line(24, 20, 50, 2, K('dark', 2)); c.line(25, 21, 51, 3, K('dark', 0)); c.line(26, 21, 51, 4, K('dark', -1))
    for k in range(9):
        c.line(44 + k, 4 + k // 2, 46 + k, 12 + k // 3, K('cloth', 1 - k // 3))
    c.R(22, 18, 5, 4, K('dark', 1)); c.HL(22, 18, 5, K('dark', 3))
    c.outline()
    # 모래 둔덕(앞): 뱃전 밑을 묻는다 — 선체 밑 가장자리 바로 아래까지 쌓인 모래
    bots = {}
    for x in range(80):
        ys = [y for y in range(48) if c.has(x, y)]
        if ys: bots[x] = max(ys)
    for x in range(80):
        near = [bots[k] for k in range(max(0, x - 3), min(80, x + 4)) if k in bots]
        if not near: continue
        yb = max(near)
        h = 4 + int(1.5 * math.sin(x / 5.0)) + (1 if hsh(x // 3, 1, 4) % 2 else 0)
        for y in range(yb - h + 1, min(48, yb + 2)):
            c.P(x, y, K('sand', 2 if y == yb - h + 1 else 1 if y < yb else 0))
    return
    c.outline()
