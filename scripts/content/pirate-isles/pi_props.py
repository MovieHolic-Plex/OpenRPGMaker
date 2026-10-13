"""pirate_isles 소품 — 항구·해변·요새·마을 물건. 모두 윗면 + 남쪽 앞면(3/4), 바닥 그림자 없음.
납작한 것(밧줄 사리·그물 더미·금화 무더기)은 debris/flat — 걸어 지나간다.
"""
import math
from pi_core import *


def crate_draw(c, x, y, w=14, top=6, front=8, mat='wood', s=0, mark=False):
    box(c, x, y, w, top, front, mat, tt=2, ft=-1, tex='planks', s=s)
    fy = y + top
    c.VL(x + 1, fy, front, K(mat, 1)); c.VL(x + w - 2, fy, front, K(mat, -2))
    c.line(x + 2, fy + 1, x + w - 3, fy + front - 2, K(mat, -2)); c.line(x + 2, fy + 2, x + w - 3, fy + front - 1, K(mat, 0))
    c.HL(x, fy + front // 2, w, K(mat, -2))
    if mark:
        c.R(x + w // 2 - 2, y + 2, 4, 2, K('red', 0)); c.P(x + w // 2 - 2, y + 2, K('red', 2))


@piece('barrel', 'wooden barrel with iron hoops', 1, 1, 'round_body', group='props', solid=[(0, 0)], tags=['통', '항구'], desc='나무통(쇠테).')
def _barrel(c):
    barrel(c, 8, 1, 6, 2.6, 10, 'wood', s=1); c.outline()


@piece('barrels', 'stack of three wooden barrels, two below and one on top', 2, 2, 'round_body', group='props', solid=[(0, 1), (1, 1)], tags=['통', '항구'],
       desc='쌓은 나무통 셋(아래 둘·위 하나). 아래 줄 막힘.')
def _barrels(c):
    barrel(c, 9, 13, 7, 3, 12, 'wood', s=2); barrel(c, 23, 13, 7, 3, 12, 'wood', s=3)
    barrel(c, 16, 2, 7, 3, 11, 'wood', s=4)
    c.outline()


@piece('keg-powder', 'black powder keg with red band', 1, 1, 'round_body', group='props', solid=[(0, 0)], tags=['통', '화약', '요새'], desc='화약통(붉은 띠). 대포 곁.')
def _keg(c):
    barrel(c, 8, 2, 6, 2.6, 9, 'dark', hoop='red', s=5)
    c.R(7, 1, 2, 2, K('iron', 1)); c.outline()


@piece('crate', 'wooden cargo crate with cross brace', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['상자', '항구'], desc='나무 화물 상자.')
def _crate(c):
    crate_draw(c, 1, 2, 14, 6, 8, s=1); c.outline()


@piece('crates', 'stack of cargo crates, two below and one on top', 2, 2, 'box', group='props', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['상자', '항구'],
       desc='쌓은 화물 상자(아래 둘·위 하나).')
def _crates(c):
    crate_draw(c, 1, 16, 15, 6, 9, s=2, mark=True); crate_draw(c, 16, 15, 15, 7, 9, s=3)
    crate_draw(c, 7, 2, 16, 7, 8, s=4)
    c.outline()


@piece('sacks', 'pile of burlap grain sacks', 1, 1, 'organic', group='props', solid=[(0, 0)], tags=['자루', '항구'], desc='곡식 자루 더미.')
def _sacks(c):
    for (cx, cy, rx, ry) in ((5, 11, 4.5, 4), (11, 11, 4.5, 4), (8, 6, 4.5, 3.6)):
        lit_blob(c, cx, cy, rx, ry, 'cloth', -1, s=int(cx * cy))
        c.HL(int(cx) - 1, int(cy - ry) + 1, 3, K('thatch', -2))
    c.outline()


@piece('rope-coil', 'coiled ship rope lying on the deck', 1, 1, 'flat', group='props', tags=['밧줄', '항구'], desc='감아 둔 밧줄 사리(바닥, 걸어 지나간다).')
def _rope(c):
    for r in (6.5, 5, 3.5, 2):
        for k in range(int(r * 9)):
            a = 2 * math.pi * k / (r * 9)
            x = 8 + r * math.cos(a); y = 8.5 + r * 0.7 * math.sin(a)
            c.P(round(x), round(y), K('thatch', (1 if math.sin(a) < 0 and math.cos(a) < .3 else -1 if math.sin(a) > .3 else 0) - (1 if k % 3 == 0 else 0)))
    c.line(13, 10, 15, 13, K('thatch', -1))
    c.outline()


@piece('nets', 'heap of fishing nets with floats lying on the ground', 1, 1, 'debris', group='props', tags=['그물', '항구'], desc='그물 더미(부표 달림, 걸어 지나간다).')
def _nets(c):
    c.ellf(8, 10, 7, 4, lambda x, y, nx, ny, d: (K('teal', 0 if (x + y) % 2 else -1) if (x + 2 * y) % 3 else K('teal', 1)) if d < .9 else K('teal', -2))
    for (x, y) in ((3, 8), (8, 7), (12, 11), (6, 12)):
        c.P(x, y, K('red', 2)); c.P(x + 1, y, K('red', 0))
    c.outline()


@piece('anchor', 'large iron ship anchor lying on the ground', 2, 1, 'debris', group='props', tags=['닻', '항구'], desc='눕힌 큰 쇠닻(걸어 지나간다, 부두·광장 장식).')
def _anchor(c):
    # 자루(가로) — 윗면 밝은 줄
    c.R(6, 7, 19, 3, K('iron', 0)); c.HL(6, 7, 19, K('iron', 2)); c.HL(6, 9, 19, K('iron', -2))
    # 고리(오른쪽 끝)
    c.ellf(27, 8.5, 3, 3, lambda x, y, nx, ny, d: (K('iron', 1 if ny < 0 else -1) if d > .35 else None))
    # 가로대(세로 막대, 고리 옆)
    c.R(21, 2, 3, 13, K('iron', 0)); c.VL(21, 2, 13, K('iron', 2)); c.VL(23, 2, 13, K('iron', -2))
    c.R(20, 1, 5, 2, K('iron', 1)); c.R(20, 14, 5, 2, K('iron', -1))
    # 팔(왼쪽 초승달) + 갈고리 끝
    for k in range(9):
        a = math.pi * (0.5 + k / 8.0)
        x = 8 + 5.5 * math.cos(a); y = 8.5 - 6 * math.sin(a)
        c.R(round(x) - 1, round(y) - 1, 3, 2, K('iron', 1 if y < 8.5 else -1))
    for (x, y) in ((8, 2), (8, 14)):
        c.R(x, y - 1, 3, 3, K('iron', 1 if y < 8 else -1)); c.P(x + 2, y - 1 if y < 8 else y + 1, K('iron', 2))
    c.outline()


@piece('cannon', 'iron cannon on a wooden carriage with wheels, aimed south', 2, 2, 'other', group='props', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['대포', '요새'],
       desc='나무 포가 위 쇠 대포(남쪽 겨눔). 요새 성벽 위·해안 포대.')
def _cannon(c):
    # 포가(윗면 판 + 앞면) + 바퀴(옆)
    box(c, 6, 10, 20, 10, 6, 'wood', tt=1, ft=-1, tex='planks', s=6)
    for wx in (3, 26):
        c.R(wx, 14, 4, 12, K('dark', 0)); c.VL(wx, 14, 12, K('dark', 2)); c.HL(wx, 14, 4, K('dark', 2)); c.HL(wx, 25, 4, K('dark', -2))
        c.R(wx + 1, 19, 2, 2, K('iron', 1))
    # 포신: 뒤(위)에서 앞(아래)으로 오는 원통 — 윗면 밝은 띠
    for y in range(2, 30):
        f = (y - 2) / 28
        r = 3.6 - 0.6 * f
        for x in range(int(16 - r - 1), int(16 + r + 2)):
            nx = (x + .5 - 16) / r
            if abs(nx) > 1: continue
            t = 2 if nx < -.4 else 1 if nx < 0 else 0 if nx < .5 else -2
            if y in (6, 7, 24): t -= 1
            c.P(x, y, K('iron', t))
    c.ellf(16, 29.5, 3.2, 1.8, lambda x, y, nx, ny, d: K('shadow', 0) if d < .5 else K('iron', 2 if ny < 0 else 0))   # 포구
    c.ellf(16, 2, 2.4, 1.6, lambda x, y, nx, ny, d: K('iron', 1))
    c.outline()


@piece('cannonballs', 'pyramid stack of iron cannonballs', 1, 1, 'other', group='props', solid=[(0, 0)], tags=['대포', '요새'], desc='쌓은 포탄 피라미드.')
def _balls(c):
    for (x, y) in ((4, 12), (8, 12), (12, 12), (6, 8.5), (10, 8.5), (8, 5)):
        lit_blob(c, x, y, 2.4, 2.2, 'iron', 0, s=int(x * 3 + y))
    c.outline()


@piece('flagpole', 'tall wooden flagpole flying a black pirate flag with a white skull', 1, 3, 'column', group='props', solid=[(0, 2)], tags=['깃발', '해적'],
       desc='해적 깃대(검은 해골 깃발, 글자 없음). 요새·부두 광장.')
def _flag(c):
    c.R(3, 40, 7, 3, K('stone', 2)); c.HL(3, 40, 7, K('stone', 3)); c.R(3, 43, 7, 3, K('stone', -1)); c.HL(3, 45, 7, K('stone', -2))   # 받침돌(윗면)
    c.R(5, 2, 2, 38, K('wood', 0)); c.VL(5, 2, 38, K('wood', 2))
    c.ell(6, 2, 1.5, 1, K('gold', 2))
    for j in range(9):
        wv = int(round(math.sin(j / 2.5)))
        for i in range(9):
            c.P(7 + i, 3 + j + int(round(math.sin((i + 1) / 2.2) * 1.2)), K('shadow', 1 if i < 3 else 2 if (i + j) % 5 else 1))
    sx, sy = 10, 5
    c.R(sx, sy, 3, 3, K('bone', 3)); c.P(sx, sy + 1, K('shadow', 0)); c.P(sx + 2, sy + 1, K('shadow', 0)); c.P(sx + 1, sy + 3, K('bone', 1))
    c.line(sx - 1, sy + 4, sx + 3, sy + 6, K('bone', 2)); c.line(sx + 3, sy + 4, sx - 1, sy + 6, K('bone', 2))
    c.outline()


@piece('lantern-post', 'wooden lantern post with a glowing oil lamp', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['등불', '항구'], desc='등불 기둥(기름 등).')
def _lpost(c):
    c.R(5, 27, 6, 3, K('stone', 2)); c.HL(5, 27, 6, K('stone', 3)); c.R(5, 30, 6, 2, K('stone', -1))
    c.R(7, 6, 3, 21, K('wood', 0)); c.VL(7, 6, 21, K('wood', 2)); c.VL(9, 6, 21, K('wood', -2))
    c.R(8, 4, 6, 2, K('iron', 0)); c.HL(8, 4, 6, K('iron', 2))
    c.R(10, 6, 5, 7, K('iron', -1)); c.R(11, 7, 3, 5, K('fire', 2)); c.P(11, 8, K('fire', 3)); c.HL(10, 6, 5, K('iron', 1))
    c.ell(12.5, 5, 2, 1, K('iron', 1))
    c.outline()


@piece('tiki-torch', 'bamboo tiki torch with burning flame', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['횃불', '마을'], desc='대나무 횃불(불꽃). 마을 길가·모닥불 곁.')
def _tiki(c):
    for y in range(10, 30):
        c.P(7, y, K('thatch', 1)); c.P(8, y, K('thatch', 0)); c.P(9, y, K('thatch', -2))
        if y % 6 == 0: c.HL(7, y, 3, K('thatch', -2))
    c.ell(8, 30, 3, 1.2, K('rock', -1))
    c.R(5, 6, 7, 5, K('thatch', -1)); c.HL(5, 6, 7, K('thatch', 2)); c.HL(5, 10, 7, K('thatch', -3))
    c.ellf(8.5, 5, 2.5, 1.2, lambda x, y, nx, ny, d: K('shadow', 1))                            # 통 아가리
    for (x, y, t) in ((8, 0, 2), (7, 1, 1), (9, 1, 3), (8, 2, 3), (7, 3, 2), (9, 3, 1), (8, 4, 2), (6, 3, 0), (10, 2, 0)):
        c.P(x, y, K('fire', t + 1))
    c.outline()


@piece('campfire', 'campfire ringed with stones, burning logs', 1, 1, 'container', group='props', solid=[(0, 0)], tags=['모닥불', '마을'], desc='돌을 두른 모닥불.')
def _campfire(c):
    c.ellf(8, 10, 7, 4.2, lambda x, y, nx, ny, d: K('shadow', 1) if d < .55 else None)
    c.ellf(8, 10, 5, 2.6, lambda x, y, nx, ny, d: K('dark', -1) if d < .9 else None)
    for k in range(10):
        a = 2 * math.pi * k / 10
        x = 8 + 6.2 * math.cos(a); y = 10 + 3.6 * math.sin(a)
        lit_blob(c, x, y, 1.8, 1.5, 'stone', 0 if math.sin(a) > 0 else -1, s=k)
    c.line(4, 11, 11, 8, K('wood', 0)); c.line(5, 8, 12, 11, K('wood', -1))
    for (x, y, t) in ((8, 4, 3), (7, 5, 2), (9, 5, 3), (8, 6, 3), (6, 7, 1), (10, 7, 2), (7, 8, 2), (9, 8, 1), (8, 9, 2), (8, 3, 1), (7, 6, 3)):
        c.P(x, y, K('fire', t))
    c.outline()


@piece('well', 'round stone well with wooden roof and bucket', 2, 2, 'container', group='props', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['우물', '마을'],
       desc='돌 우물(나무 지붕·두레박).')
def _well(c):
    # 둘레돌(윗면 고리 + 앞면) + 안쪽 물(아가리)
    for y in range(18, 30):
        for x in range(5, 28):
            nx = (x + .5 - 16) / 11
            if abs(nx) <= 1: c.P(x, y, K('stone', (0 if nx < -.4 else -1 if nx < .4 else -2) - (1 if (y - 18) % 4 == 3 else 0) - (1 if (x + (y // 4) * 3) % 6 == 0 else 0)))
    c.ellf(16, 30, 11, 2, lambda x, y, nx, ny, d: K('stone', -3) if ny > 0 else None)
    c.ellf(16, 18, 11, 5, lambda x, y, nx, ny, d: K('stone', 2 if ny < 0 else 1) if d > .45 else (K('deep', -2) if ny < .1 else K('deep', 0)))
    c.ellf(16, 18, 6.2, 2.6, lambda x, y, nx, ny, d: K('shadow', 1) if ny < -.3 else None)
    # 기둥 + 지붕
    for px in (5, 25): c.R(px, 4, 2, 16, K('wood', 0)); c.VL(px, 4, 16, K('wood', 2))
    c.HL(5, 8, 22, K('wood', -1)); c.ell(16, 8, 2, 2, K('wood', 1))
    c.VL(16, 9, 8, K('thatch', -1)); c.R(14, 13, 4, 4, K('wood', 0)); c.HL(14, 13, 4, K('wood', 2))
    hip_roof(c, 1, 0, 30, 7, 'thatch', inset=4, s=7, tier=3)
    c.outline()


@piece('bench', 'wooden bench', 2, 1, 'seat', group='props', solid=[(0, 0), (1, 0)], tags=['의자', '마을'], desc='나무 긴 의자.')
def _bench(c):
    box(c, 2, 4, 28, 6, 3, 'wood', tt=1, ft=-1, tex='planks', s=8)
    for lx in (4, 25): c.R(lx, 13, 3, 3, K('wood', -2))
    c.outline()


@piece('table-stools', 'round wooden table with two stools', 2, 2, 'low_furniture', group='props', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['탁자', '마을'],
       desc='둥근 나무 탁자 + 걸상 둘(술집 앞·마을 광장).')
def _tstools(c):
    for (sx, sy) in ((3, 18), (23, 18)):
        c.ellf(sx + 3, sy + 2, 3.5, 2, lambda x, y, nx, ny, d: K('wood', 2 if ny < 0 else 1))
        c.R(sx + 1, sy + 4, 5, 5, K('wood', -1)); c.VL(sx + 1, sy + 4, 5, K('wood', 0)); c.HL(sx + 1, sy + 8, 5, K('wood', -3))
    c.ellf(16, 12, 11, 6, lambda x, y, nx, ny, d: K('wood', 2 if d > .8 and ny < 0 else 1 if ny < .3 else 0))
    for y in range(13, 22):
        c.R(10, y, 12, 1, K('wood', -1 if y < 15 else -2)); c.P(10, y, K('wood', 0))
    c.ellf(16, 12, 11, 6, lambda x, y, nx, ny, d: K('wood', 2 if d > .8 and ny < 0 else 1 if ny < .3 else 0))
    c.ellf(16, 18, 11, 2.2, lambda x, y, nx, ny, d: K('wood', -1) if ny > 0 and abs(nx) < .6 else None)
    c.R(14, 18, 4, 9, K('wood', -1)); c.VL(14, 18, 9, K('wood', 0)); c.HL(12, 26, 8, K('wood', -3))
    c.R(12, 9, 3, 4, K('gold', 1)); c.HL(12, 9, 3, K('cloth', 3)); c.P(15, 10, K('gold', -1))    # 잔
    c.outline()


@piece('chest-closed', 'closed wooden treasure chest with iron bands and gold lock', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['보물', '상자'], desc='닫힌 보물 상자(쇠 띠·금 자물쇠).')
def _chest(c):
    # 둥근 뚜껑(윗면) + 몸통(앞면)
    for y in range(2, 8):
        for x in range(1, 15):
            t = 2 if y < 4 else 1 if y < 6 else 0
            c.P(x, y, K('wood', t - (1 if (x % 5 == 0) else 0)))
    c.HL(1, 2, 14, K('wood', 0)); c.HL(2, 1, 12, K('wood', 1))
    c.R(1, 8, 14, 7, K('wood', -1)); c.HL(1, 8, 14, K('wood', -3)); c.HL(1, 14, 14, K('wood', -3))
    for bx in (3, 11):
        c.R(bx, 1, 2, 14, K('iron', 0)); c.VL(bx, 1, 14, K('iron', 2))
    c.R(7, 7, 2, 4, K('gold', 2)); c.P(7, 9, K('shadow', 0)); c.P(8, 7, K('gold', 0))
    c.outline()


@piece('chest-open', 'open treasure chest overflowing with gold coins and jewels', 1, 1, 'container', group='props', solid=[(0, 0)], tags=['보물', '상자'],
       desc='열린 보물 상자(금화·보석이 넘침).')
def _chest_open(c):
    c.R(1, 0, 14, 5, K('wood', -1)); c.HL(1, 0, 14, K('wood', 1)); c.R(1, 5, 14, 2, K('wood', -3))   # 열린 뚜껑(안쪽 보임)
    for bx in (3, 11): c.R(bx, 0, 2, 5, K('iron', -1))
    for y in range(6, 10):                                                                  # 금화 더미(아가리 안)
        for x in range(1, 15):
            c.P(x, y, K('gold', (2 if (x + y) % 3 == 0 else 1 if y < 8 else 0)))
    c.P(5, 7, K('red', 3)); c.P(10, 6, K('teal', 3)); c.P(12, 8, K('blue', 3)); c.P(3, 7, K('gold', 3))
    c.R(1, 10, 14, 5, K('wood', -1)); c.HL(1, 10, 14, K('wood', 1)); c.HL(1, 14, 14, K('wood', -3))
    for bx in (3, 11): c.R(bx, 10, 2, 5, K('iron', 0)); c.VL(bx, 10, 5, K('iron', 2))
    c.P(0, 14, K('gold', 1)); c.P(15, 13, K('gold', 2))
    c.outline()


@piece('gold-pile', 'scattered pile of gold coins and a goblet on the floor', 1, 1, 'debris', group='props', tags=['보물'], desc='바닥에 쌓인 금화 무더기(걸어 지나간다).')
def _gold(c):
    c.ellf(8, 11, 6.5, 3.5, lambda x, y, nx, ny, d: K('gold', (2 if (x + 2 * y) % 5 == 0 else 1 if ny < 0 else 0) - (1 if d > .75 else 0)))
    for (x, y) in ((2, 13), (14, 12), (5, 6)): c.P(x, y, K('gold', 2)); c.P(x + 1, y, K('gold', 0))
    c.R(10, 4, 3, 3, K('gold', 1)); c.HL(10, 4, 3, K('gold', 3)); c.VL(11, 7, 2, K('gold', 0)); c.HL(10, 9, 3, K('gold', -1))
    c.P(6, 10, K('red', 3)); c.P(9, 12, K('teal', 3))
    c.outline()


@piece('bollard', 'iron mooring bollard on the quay', 1, 1, 'column', group='props', solid=[(0, 0)], tags=['계선주', '항구'], desc='쇠 계선주(부두 가장자리에 배를 매는 기둥).')
def _bollard(c):
    c.R(4, 12, 8, 3, K('iron', -1)); c.HL(4, 12, 8, K('iron', 1))
    for y in range(5, 12):
        for x in range(5, 11):
            nx = (x + .5 - 8) / 3
            c.P(x, y, K('iron', 1 if nx < -.3 else 0 if nx < .4 else -2))
    c.ellf(8, 4.5, 4, 2, lambda x, y, nx, ny, d: K('iron', 2 if ny < 0 else 0))
    c.ellf(8, 4.5, 2, 1, lambda x, y, nx, ny, d: K('iron', 3))
    for k in range(5): c.P(4 + k * 2, 8 + k % 2, K('thatch', 0)); c.P(5 + k * 2, 8 + k % 2, K('thatch', -1))   # 감긴 밧줄
    c.outline()


@piece('pier-post', 'thick wooden pier post with rope wrap', 1, 1, 'column', group='props', solid=[(0, 0)], tags=['말뚝', '항구'], desc='굵은 나무 부두 말뚝(밧줄 감김).')
def _ppost(c):
    for y in range(4, 15):
        for x in range(5, 11):
            nx = (x + .5 - 8) / 3
            c.P(x, y, K('dark', (2 if nx < -.3 else 1 if nx < .4 else -1) - (1 if (y + x) % 5 == 0 else 0)))
    c.ellf(8, 4, 3, 1.6, lambda x, y, nx, ny, d: K('wood', 1 if d > .5 else 0 if (x + y) % 2 else -1))
    for k in range(3): c.HL(5, 8 + k * 2, 6, K('thatch', 0 if k % 2 else -1)); c.P(5, 8 + k * 2, K('thatch', 1))
    c.outline()


@piece('signpost', 'wooden signpost with three blank arrow boards', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['푯말', '마을'], desc='갈림길 푯말(빈 화살 판 셋, 글자 없음).')
def _sign(c):
    c.R(7, 4, 3, 26, K('wood', 0)); c.VL(7, 4, 26, K('wood', 2)); c.VL(9, 4, 26, K('wood', -2))
    c.ell(8.5, 4, 1.5, 1, K('wood', 2))
    for (y, d, w) in ((6, 1, 7), (11, -1, 7), (16, 1, 6)):
        x0 = 9 if d > 0 else 1
        c.R(x0, y, w, 4, K('wood', 1)); c.HL(x0, y, w, K('wood', 2)); c.HL(x0, y + 3, w, K('wood', -2))
        tip = x0 + w if d > 0 else x0 - 1
        c.P(tip, y + 1, K('wood', 0)); c.P(tip, y + 2, K('wood', -1))
    c.R(5, 29, 7, 2, K('sand', -1))
    c.outline()


@piece('fence', 'short wooden picket fence section', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['울타리', '마을'], desc='나무 울타리 한 칸(가로).')
def _fence(c):
    for x in range(1, 31, 5):
        c.R(x, 3, 3, 12, K('wood', 0)); c.VL(x, 3, 12, K('wood', 2)); c.VL(x + 2, 3, 12, K('wood', -2))
        c.ell(x + 1.5, 3, 1.5, 1, K('wood', 2))
    for y in (6, 11): c.HL(0, y, 32, K('wood', 1)); c.HL(0, y + 1, 32, K('wood', -2))
    c.outline()


@piece('fence-bamboo', 'bamboo pole fence section lashed with rope', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['울타리', '마을'], desc='대나무 울타리 한 칸.')
def _fbamboo(c):
    for x in range(0, 32, 3):
        h = 10 + (x // 3) % 3
        for y in range(15 - h, 15):
            c.P(x, y, K('thatch', 1)); c.P(x + 1, y, K('thatch', -1))
            if (y + x) % 7 == 0: c.HL(x, y, 2, K('thatch', -2))
        c.P(x, 15 - h, K('thatch', 3)); c.P(x + 1, 15 - h, K('thatch', 2))
    for y in (6, 11): c.HL(0, y, 32, K('wood', -1))
    c.outline()


@piece('net-rack', 'wooden drying rack with fishing nets hanging', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['그물', '항구'], desc='그물 말리는 나무 틀(아래 줄 막힘).')
def _netrack(c):
    for px in (3, 27):
        c.R(px, 6, 3, 24, K('wood', 0)); c.VL(px, 6, 24, K('wood', 2)); c.ell(px + 1.5, 6, 1.5, 1, K('wood', 2))
    c.R(1, 7, 30, 3, K('wood', 1)); c.HL(1, 7, 30, K('wood', 3)); c.HL(1, 9, 30, K('wood', -2))
    for y in range(10, 24):
        for x in range(6, 27):
            sag = int(3 * math.sin(math.pi * (x - 6) / 21))
            if y > 22 + sag - 3 + sag: continue
            if (x + y) % 3 == 0 or (x - y) % 3 == 0: c.P(x, y + sag // 2, K('teal', 1 if (x + y) % 2 else 0))
    for (x, y) in ((9, 21), (16, 24), (23, 21)): c.P(x, y, K('red', 2)); c.P(x + 1, y, K('red', 0))
    c.outline()


@piece('fish-rack', 'fish drying rack with hanging fish', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['생선', '마을'], desc='생선 말리는 시렁(매단 생선).')
def _fishrack(c):
    for px in (3, 27):
        c.R(px, 8, 2, 22, K('wood', 0)); c.VL(px, 8, 22, K('wood', 2))
    c.R(1, 8, 30, 2, K('wood', 1)); c.HL(1, 8, 30, K('wood', 3))
    for k in range(6):
        x = 7 + k * 4; L = 7 + k % 2
        c.VL(x, 10, 2, K('thatch', -1))
        for j in range(L):
            c.P(x - 1, 12 + j, K('blue', 1)); c.P(x, 12 + j, K('iron', 1 if j < L // 2 else 0)); c.P(x + 1, 12 + j, K('blue', -1))
        c.P(x - 1, 12 + L, K('blue', 0)); c.P(x + 1, 12 + L, K('blue', 0))
    c.outline()


@piece('hammock', 'rope hammock strung between two posts', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['그물 침대', '해변'], desc='두 기둥 사이 그물 침대.')
def _hammock(c):
    for px in (1, 29):
        c.R(px, 0, 2, 16, K('wood', 0)); c.VL(px, 0, 16, K('wood', 2)); c.ell(px + 1, 0, 1, 1, K('wood', 2))
    for x in range(3, 29):
        sag = int(5 * math.sin(math.pi * (x - 3) / 26))
        for j in range(4):
            c.P(x, 3 + sag + j, K('cloth', (2 if j == 0 else 1 if j < 3 else -1) - (1 if x % 4 == 0 else 0)))
    c.line(3, 2, 6, 4, K('thatch', -1)); c.line(28, 2, 25, 4, K('thatch', -1))
    c.outline()


@piece('totem', 'carved wooden tiki totem pole with painted face', 1, 2, 'figure', group='props', solid=[(0, 1)], tags=['토템', '마을'], desc='새긴 나무 토템(칠한 얼굴). 마을 광장.')
def _totem(c):
    c.R(3, 27, 10, 3, K('stone', 2)); c.HL(3, 27, 10, K('stone', 3)); c.R(3, 30, 10, 2, K('stone', -1))
    for y in range(4, 27):
        for x in range(4, 12):
            nx = (x + .5 - 8) / 4
            c.P(x, y, K('wood', (1 if nx < -.3 else 0 if nx < .4 else -2)))
    c.ellf(8, 4, 4, 1.8, lambda x, y, nx, ny, d: K('wood', 2))
    for fy in (7, 17):
        c.R(5, fy, 2, 2, K('bone', 3)); c.R(9, fy, 2, 2, K('bone', 3)); c.P(6, fy + 1, K('shadow', 0)); c.P(10, fy + 1, K('shadow', 0))
        c.R(5, fy + 4, 6, 2, K('red', 1)); c.HL(6, fy + 4, 4, K('bone', 2))
        c.HL(4, fy - 1, 8, K('teal', 1))
    c.R(1, 14, 3, 2, K('wood', 1)); c.R(12, 14, 3, 2, K('wood', -1))
    c.outline()


@piece('palisade', 'sharpened log palisade wall section', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['목책', '요새'], desc='뾰족 통나무 목책 한 칸(가로 2칸, 아래 줄 막힘).')
def _palisade(c):
    for x in range(0, 32, 4):
        h = 22 + (x // 4) % 2 * 2
        top = 30 - h
        for y in range(top, 30):
            for i in range(4):
                t = (1 if i == 0 else 0 if i < 2 else -1 if i < 3 else -3)
                if (y - top) % 9 == 8: t -= 1
                c.P(x + i, y, K('wood', t))
        c.P(x + 1, top - 2, K('wood', 2)); c.HL(x + 1, top - 1, 2, K('wood', 1)); c.HL(x, top, 4, K('wood', 0))
        c.ellf(x + 2, top + 1, 2, 1, lambda xx, yy, nx, ny, d: K('wood', 2))
    for y in (12, 22): c.HL(0, y, 32, K('thatch', -1)); c.HL(0, y + 1, 32, K('thatch', -3))
    c.outline()


@piece('lobster-traps', 'stacked wooden lobster traps with rope', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['통발', '항구'], desc='쌓은 나무 통발.')
def _traps(c):
    for (x, y) in ((1, 7), (8, 8), (4, 1)):
        box(c, x, y, 8, 3, 5, 'wood', tt=1, ft=-1)
        for i in range(x + 1, x + 8, 2): c.VL(i, y + 3, 5, K('shadow', 1))
        c.HL(x, y + 5, 8, K('wood', 0))
    c.outline()


@piece('oar-rack', 'rack of leaning oars and a paddle', 1, 2, 'frame', group='props', solid=[(0, 1)], tags=['노', '항구'], desc='세워 둔 노 걸이.')
def _oars(c):
    c.R(1, 22, 14, 3, K('wood', 1)); c.HL(1, 22, 14, K('wood', 3)); c.R(1, 25, 14, 4, K('wood', -1)); c.HL(1, 28, 14, K('wood', -3))
    for k in range(4):
        x = 3 + k * 3
        c.line(x, 22, x + 1, 2, K('wood', 2 - k % 2)); c.R(x, 1, 3, 6, K('wood', 1 - k % 2)); c.HL(x, 1, 3, K('wood', 2))
    c.outline()


@piece('dock-crane', 'wooden dock crane with pulley and hanging cargo net', 2, 3, 'structure', group='props', solid=[(0, 2), (1, 2)], tags=['기중기', '항구'],
       desc='부두 나무 기중기(도르래·매단 화물 그물). 방파제 가장자리.')
def _crane(c):
    box(c, 2, 36, 14, 6, 6, 'wood', tt=1, ft=-1, tex='planks', s=9)
    c.R(7, 4, 4, 32, K('dark', 1)); c.VL(7, 4, 32, K('dark', 3)); c.VL(10, 4, 32, K('dark', -1))
    c.line(9, 6, 29, 4, K('dark', 1)); c.line(9, 7, 29, 5, K('dark', -1)); c.line(9, 20, 26, 5, K('dark', 0))
    c.ell(28, 6, 2, 2, K('iron', 0)); c.P(28, 6, K('iron', 2))
    c.VL(28, 8, 18, K('thatch', -1))
    for y in range(26, 36):
        for x in range(22, 34):
            if ((x - 22) + y) % 3 == 0 or ((x - 22) - y) % 3 == 0:
                if abs(x - 28) <= 6 - (35 - y) // 3: c.P(x, y, K('thatch', 0))
    crate_draw(c, 23, 28, 10, 3, 5, s=3)
    c.outline()


@piece('flowerbed', 'small bed of red and yellow tropical flowers', 1, 1, 'flat', group='props', tags=['꽃', '마을'], desc='열대 꽃밭(바닥, 걸어 지나간다). 집 앞.')
def _flowers(c):
    for k in range(11):
        x = 2 + hsh(k, 3, 5) % 12; y = 3 + hsh(k, 4, 5) % 10
        c.P(x, y + 1, K('grass', -1)); c.P(x - 1, y + 1, K('grass', 0))
        mat = ('red', 'gold', 'coral')[k % 3]
        c.P(x, y, K(mat, 2)); c.P(x + 1, y, K(mat, 0)); c.P(x, y - 1, K(mat, 3))
    c.outline(K('grass', -2))
