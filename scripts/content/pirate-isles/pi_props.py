"""pirate_isles 소품 — 항구·해변·요새·마을 물건. 모두 윗면 + 남쪽 앞면(3/4), 바닥 그림자 없음.
납작한 것(밧줄 사리·그물 더미·금화 무더기)은 debris/flat — 걸어 지나간다.
"""
import math
from pi_core import *


def slab_top(c, x, y, w, h, mat, t=1, inset=1, horiz=True, s=0):
    """원근 윗면: 뒤 모서리가 inset 만큼 좁은 사다리꼴, 가로 판 결, 뒤 모서리 어둡게·앞 모서리 밝게."""
    for j in range(h):
        k = round(inset * (1 - j / max(1, h - 1)))
        tt = t + (1 if j >= h - 2 else 0)
        for i in range(x + k, x + w - k):
            v = tt - (1 if horiz and j % 3 == 2 else 0) - (1 if (hsh(i // 5, j // 3, s) % 7 == 0) else 0)
            c.P(i, y + j, K(mat, v))
        if j == 0: c.HL(x + k, y, w - 2 * k, K(mat, t - 2))
    c.HL(x, y + h - 1, w, K(mat, t + 2))


def crate_draw(c, x, y, w=14, top=6, front=8, mat='wood', s=0, mark=False):
    box(c, x, y, w, top, front, mat, tt=2, ft=-1, tex='planks', s=s)
    fy = y + top
    c.VL(x + 1, fy, front, K(mat, 1)); c.VL(x + w - 2, fy, front, K(mat, -2))
    c.line(x + 2, fy + 1, x + w - 3, fy + front - 2, K(mat, -2)); c.line(x + 2, fy + 2, x + w - 3, fy + front - 1, K(mat, 0))
    c.HL(x, fy + front // 2, w, K(mat, -2))
    if mark:
        c.R(x + w // 2 - 2, y + 2, 4, 2, K('red', 0)); c.P(x + w // 2 - 2, y + 2, K('red', 2))


@piece('barrel', 'wooden barrel seen from above at an angle: big light elliptical lid on top, curved iron hoops', 1, 1, 'round_body', group='props', solid=[(0, 0)], tags=['통', '항구'], desc='나무통(쇠테).')
def _barrel(c):
    cx, top, rx, ry, bh = 8, 1, 6.5, 3.2, 6
    cy = top + ry
    for y in range(int(cy), int(cy + bh + ry) + 1):
        for x in range(1, 16):
            nx = (x + .5 - cx) / rx
            if abs(nx) > 1: continue
            bot = cy + bh + ry * math.sqrt(1 - nx * nx)
            if y > bot: continue
            t = 1 if nx < -.45 else 0 if nx < .1 else -1 if nx < .6 else -2
            if (x - 2) % 3 == 0 and abs(nx) < .9: t -= 1
            c.P(x, y, K('wood', t))
    for dy in (2, 5):
        for x in range(1, 16):
            nx = (x + .5 - cx) / rx
            if abs(nx) > 1: continue
            yy = int(round(cy + dy + ry * 0.9 * math.sqrt(1 - nx * nx)))
            c.P(x, yy, K('iron', 1 if nx < -.3 else -1 if nx > .4 else 0))
    def lid(x, y, nx, ny, d):
        if d > .78: return K('iron', -2) if ny < -.2 else K('wood', 3)
        if (x - 2) % 3 == 0: return K('wood', 1)
        return K('sand', 0 if ny < .2 else -1)
    c.ellf(cx, cy, rx, ry, lid)
    c.outline()


@piece('barrels', 'stack of three wooden barrels, two below and one on top', 2, 2, 'round_body', group='props', solid=[(0, 1), (1, 1)], tags=['통', '항구'],
       desc='쌓은 나무통 셋(아래 둘·위 하나). 아래 줄 막힘.')
def _barrels(c):
    barrel(c, 9, 13, 7, 3, 12, 'wood', s=2); barrel(c, 23, 13, 7, 3, 12, 'wood', s=3)
    barrel(c, 16, 2, 7, 3, 11, 'wood', s=4)
    c.outline()


@piece('keg-powder', 'black powder keg seen from above at an angle: round lid disk with rim and fuse plug on top, red band below', 1, 1, 'round_body', group='props', solid=[(0, 0)], tags=['통', '화약', '요새'], desc='화약통(붉은 띠). 대포 곁.')
def _keg(c):
    barrel(c, 8, 1, 6, 3.5, 7, 'dark', hoop='red', s=5, lid=False)
    def lid(x, y, nx, ny, d):
        if d > .8: return K('iron', -2 if ny < 0 else 1)
        return K('wood', 1 if ny < 0 else 0)
    c.ellf(8, 4.5, 6, 3.5, lid)
    c.R(9, 3, 2, 2, K('iron', 1)); c.P(9, 3, K('iron', 3)); c.P(11, 2, K('thatch', 1))
    c.outline()


@piece('crate', 'wooden cargo crate with cross brace', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['상자', '항구'], desc='나무 화물 상자.')
def _crate(c):
    crate_draw(c, 1, 2, 14, 6, 8, s=1); c.outline()


@piece('crates', 'stack of cargo crates, two below and one on top', 2, 2, 'box', group='props', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['상자', '항구'],
       desc='쌓은 화물 상자(아래 둘·위 하나).')
def _crates(c):
    crate_draw(c, 1, 16, 15, 6, 9, s=2, mark=True); crate_draw(c, 16, 15, 15, 7, 9, s=3)
    crate_draw(c, 7, 2, 16, 7, 8, s=4)
    c.outline()


@piece('sacks', 'open burlap grain sack showing grain inside, with a closed sack behind', 1, 1, 'container', group='props', solid=[(0, 0)], tags=['자루', '항구'], desc='곡식 자루(앞은 열려 곡식이 보이고 뒤는 묶음).')
def _sacks(c):
    lit_blob(c, 11, 5, 4, 4.2, 'cloth', -1, s=7)                                   # 뒤 묶은 자루
    c.R(10, 0, 3, 2, K('cloth', 0)); c.HL(10, 0, 3, K('cloth', 2)); c.HL(9, 2, 5, K('thatch', -2))
    for y in range(8, 16):                                                           # 앞 자루 몸통
        r = 6 + (1 if 9 < y < 14 else 0)
        for x in range(7 - r, 7 + r + 1):
            nx = (x + .5 - 7) / (r + .5)
            t = 1 if nx < -.4 else 0 if nx < .2 else -1 if nx < .7 else -2
            if y == 15: t -= 1
            if (x + y * 2) % 7 == 0: t -= 1
            c.P(x, y, K('cloth', t))
    c.ellf(7, 7.5, 6, 3, lambda x, y, nx, ny, d: K('cloth', 2 if ny < 0 else 1) if d > .62 else
           (K('gold', 1 if (x + y) % 3 else 2) if ny > -.3 else K('gold', -1)))       # 접은 아가리 + 곡식
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
    # 포신: 뒤(위, 멀다·가늘다)에서 앞(아래, 가깝다·굵다)으로 오는 원통 — 남쪽(보는 쪽)을 겨눈다. 윗면 밝은 띠.
    for y in range(3, 27):
        f = (y - 3) / 24
        r = 2.4 + 1.9 * f
        for x in range(int(16 - r - 1), int(16 + r + 2)):
            nx = (x + .5 - 16) / r
            if abs(nx) > 1: continue
            t = 2 if nx < -.4 else 1 if nx < 0 else 0 if nx < .5 else -2
            if y in (8, 17): t -= 1
            if y in (22, 23): t += 1                                                     # 포구 보강 띠
            c.P(x, y, K('iron', t))
    c.ellf(16, 27.5, 5.2, 3.2, lambda x, y, nx, ny, d: K('iron', 2 if ny < -0.2 else 0 if ny < 0.4 else -2))   # 포구 테(앞으로 열린 둥근 입)
    c.ellf(16, 27.8, 3.2, 2.0, lambda x, y, nx, ny, d: K('shadow', 0 if d < .6 else 1))                     # 포구 안 구멍
    c.ellf(16, 2.2, 1.6, 1.4, lambda x, y, nx, ny, d: K('iron', 1 if nx < 0 else -1))                       # 뒤 손잡이(작게)
    c.outline()


@piece('cannonballs', 'low wooden tray holding a pyramid of iron cannonballs', 1, 1, 'other', group='props', solid=[(0, 0)], tags=['대포', '요새'], desc='나무 받침 위 포탄 더미.')
def _balls(c):
    box(c, 0, 6, 16, 6, 4, 'wood', tt=1, ft=-1, tex='planks', s=3)
    for (x, y) in ((4, 9), (8, 9), (12, 9), (6, 6.5), (10, 6.5), (8, 4)):
        lit_blob(c, x, y, 2.3, 2.0, 'iron', 0, s=int(x * 3 + y))
    c.outline()


@piece('flagpole', 'pirate flag on a short pole planted in a big square stone pedestal block seen from above, black flag with white skull', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['깃발', '해적'],
       desc='해적 깃대(넓은 돌 받침·검은 해골 깃발, 글자 없음). 요새·부두 광장.')
def _flag(c):
    slab_top(c, 1, 17, 14, 6, 'stone', 1, inset=1, s=2)
    stones(c, 1, 23, 14, 8, 'stone', -1, bh=4, s=2); c.HL(1, 30, 14, K('stone', -3))
    c.ellf(8, 19.5, 2.5, 1.3, lambda x, y, nx, ny, d: K('shadow', 1))
    c.R(7, 1, 2, 19, K('wood', 0)); c.VL(7, 1, 19, K('wood', 2))
    c.R(6, 0, 4, 2, K('gold', 1)); c.HL(6, 0, 4, K('gold', 3))
    for j in range(8):
        for i in range(7):
            c.P(9 + i, 2 + j + int(round(math.sin((i + 1) / 2.2) * 1.0)), K('shadow', 1 if i < 2 else 2 if (i + j) % 5 else 1))
    sx, sy = 11, 4
    c.R(sx, sy, 3, 2, K('bone', 3)); c.P(sx, sy + 1, K('shadow', 0)); c.P(sx + 2, sy + 1, K('shadow', 0)); c.P(sx + 1, sy + 2, K('bone', 1))
    c.line(sx - 1, sy + 3, sx + 3, sy + 5, K('bone', 2)); c.line(sx + 3, sy + 3, sx - 1, sy + 5, K('bone', 2))
    c.outline()


@piece('lantern-post', 'harbor brazier lamp: iron post with a wide open fire bowl on top seen from above, flame inside the bowl, round stone base', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['등불', '항구'], desc='부두 화로 등(쇠 기둥 위 불 그릇).')
def _lpost(c):
    c.ellf(8, 27, 6, 3, lambda x, y, nx, ny, d: K('stone', 2 if ny < -.2 else 1 if ny < .3 else -1))
    c.ellf(8, 29.5, 6, 2, lambda x, y, nx, ny, d: K('stone', -2) if ny > 0 else None)
    c.R(7, 9, 3, 18, K('iron', 0)); c.VL(7, 9, 18, K('iron', 2)); c.VL(9, 9, 18, K('iron', -2))
    for y in range(6, 11):
        w = 6 - (y - 6)
        c.HL(8 - w, y, 2 * w + 1, K('iron', -1 if y > 7 else 0)); c.P(8 - w, y, K('iron', 1))
    c.ellf(8, 5.5, 6, 3, lambda x, y, nx, ny, d: K('iron', 2 if ny > 0 else 0) if d > .65 else K('fire', 1 if ny < 0 else 0))
    for (x, y, t) in ((8, 0, 2), (7, 1, 2), (9, 1, 3), (8, 2, 3), (6, 3, 1), (10, 3, 1), (7, 4, 3), (9, 4, 2), (8, 5, 3), (5, 5, 0), (11, 5, 0)):
        c.P(x, y, K('fire', t))
    c.outline()


@piece('tiki-torch', 'bamboo tiki torch on a round stone base, flame burning in an open bowl seen from above', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['횃불', '마을'], desc='대나무 횃불(돌 받침·불꽃). 마을 길가·모닥불 곁.')
def _tiki(c):
    c.ellf(8, 27, 6, 3, lambda x, y, nx, ny, d: K('stone', 2 if ny < -.2 else 1 if ny < .3 else -1) if d > .35 or ny > 0 else K('sand', -1))
    c.ellf(8, 29.5, 6, 2, lambda x, y, nx, ny, d: K('stone', -2) if ny > 0 else None)
    for y in range(10, 27):
        c.P(7, y, K('thatch', 1)); c.P(8, y, K('thatch', 0)); c.P(9, y, K('thatch', -2))
        if y % 6 == 0: c.HL(7, y, 3, K('thatch', -2))
    c.R(3, 7, 11, 4, K('thatch', -1)); c.HL(3, 10, 11, K('thatch', -3))
    c.ellf(8.5, 6.5, 5.5, 3, lambda x, y, nx, ny, d: K('thatch', 2 if ny < 0 else 1) if d > .6 else K('shadow', 1))   # 그릇 테 + 아가리
    for (x, y, t) in ((8, 0, 2), (7, 1, 1), (9, 1, 3), (8, 2, 3), (7, 3, 2), (9, 3, 2), (8, 4, 3), (6, 4, 1), (10, 4, 1), (8, 5, 2), (7, 6, 1), (9, 6, 1), (6, 2, 0), (10, 2, 0)):
        c.P(x, y, K('fire', t))
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


@piece('chest-closed', 'closed wooden treasure chest seen from above at an angle: flat plank lid top face, darker front with gold lock', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['보물', '상자'], desc='닫힌 보물 상자(쇠 띠·금 자물쇠).')
def _chest(c):
    slab_top(c, 1, 2, 14, 6, 'wood', 1, inset=1, s=4)
    c.R(1, 8, 14, 7, K('wood', -1)); c.HL(1, 14, 14, K('wood', -3)); c.VL(1, 8, 7, K('wood', 0)); c.VL(14, 8, 7, K('wood', -2))
    for bx in (4, 10):
        for j in range(6): c.P(bx + (1 if j < 3 and bx < 8 else -1 if j < 3 else 0) * 0, 2 + j, K('iron', 1 if j < 5 else 2))
        c.R(bx, 8, 2, 7, K('iron', -1)); c.VL(bx, 8, 7, K('iron', 1))
    c.R(7, 8, 2, 3, K('gold', 2)); c.P(7, 9, K('shadow', 0)); c.P(8, 10, K('gold', 0))
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


@piece('bollard', 'iron mooring bollard bolted on a square stone quay block, mushroom cap seen from above', 1, 1, 'column', group='props', solid=[(0, 0)], tags=['계선주', '항구'], desc='쇠 계선주(돌 받침, 배를 매는 기둥).')
def _bollard(c):
    box(c, 0, 8, 16, 5, 3, 'stone', tt=1, ft=-1, s=5)
    for y in range(5, 12):
        for x in range(5, 11):
            nx = (x + .5 - 8) / 3
            c.P(x, y, K('iron', 1 if nx < -.3 else 0 if nx < .4 else -2))
    c.ellf(8, 4, 5, 3, lambda x, y, nx, ny, d: K('iron', 3 if d < .4 and ny < .2 else 2 if ny < 0 else 0) if d > .0 else None)
    c.ellf(8, 4, 5, 3, lambda x, y, nx, ny, d: K('iron', -2) if d > .8 and ny > .2 else None)
    for k in range(5): c.P(4 + k * 2, 8 + k % 2, K('thatch', 0)); c.P(5 + k * 2, 8 + k % 2, K('thatch', -1))
    c.outline()


@piece('pier-post', 'thick round wooden pier post, sawn top end with tree rings seen from above, rope wrap', 1, 1, 'column', group='props', solid=[(0, 0)], tags=['말뚝', '항구'], desc='굵은 나무 부두 말뚝(밧줄 감김).')
def _ppost(c):
    for y in range(4, 15):
        for x in range(3, 13):
            nx = (x + .5 - 8) / 5
            c.P(x, y, K('dark', (1 if nx < -.4 else 0 if nx < .3 else -2) - (1 if (y + x) % 5 == 0 else 0)))
    c.ellf(8, 15, 5, 1.2, lambda x, y, nx, ny, d: K('dark', -3) if ny > 0 else None)
    c.ellf(8, 4, 5, 3, lambda x, y, nx, ny, d: K('dark', 1) if d > .82 else K('sand', 0 if .4 < d < .6 else 2 if ny < 0 else 1))
    c.P(8, 4, K('sand', -1))
    for k in range(2): c.HL(3, 9 + k * 2, 10, K('thatch', 0 if k % 2 else -1)); c.P(3, 9 + k * 2, K('thatch', 1))
    c.outline()


@piece('signpost', 'square wooden signpost seen from above at an angle: thick post with flat light top face, three blank arrow boards, stone foot', 1, 2, 'column', group='props', solid=[(0, 1)], tags=['푯말', '마을'], desc='갈림길 푯말(빈 화살 판 셋, 글자 없음).')
def _sign(c):
    c.R(2, 25, 12, 3, K('stone', 2)); c.HL(2, 25, 12, K('stone', 0)); c.R(2, 28, 12, 3, K('stone', -1)); c.HL(2, 30, 12, K('stone', -3))
    c.R(5, 6, 6, 20, K('wood', -1)); c.VL(5, 6, 20, K('wood', 0)); c.VL(10, 6, 20, K('wood', -3))
    c.R(5, 2, 6, 4, K('sand', 1)); c.HL(5, 2, 6, K('wood', 0)); c.HL(5, 5, 6, K('sand', 2))           # 윗면(밝은 나뭇결)
    for (y, d, w) in ((8, 1, 5), (13, -1, 5), (18, 1, 5)):
        x0 = 11 if d > 0 else 0
        c.R(x0, y, w, 2, K('sand', 1)); c.HL(x0, y, w, K('wood', 1))
        c.R(x0, y + 2, w, 3, K('wood', 0)); c.HL(x0, y + 4, w, K('wood', -2))
    c.outline()


def fence_rail(c, x, y, w, mat='wood', t=1):
    """울타리 맨 위 가로대: 위에서 본 판(3줄, 뒤 모서리 어둡게) + 앞면 1줄."""
    c.HL(x, y, w, K(mat, t - 2)); c.R(x, y + 1, w, 2, K(mat, t + 1)); c.HL(x, y + 2, w, K(mat, t)); c.HL(x, y + 3, w, K(mat, t - 2))


@piece('fence', 'wooden fence section of round log posts with sawn tops seen from above, two rails', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['울타리', '마을'], desc='나무 울타리 한 칸(가로).')
def _fence(c):
    for y in (7, 11): c.HL(0, y, 32, K('wood', 1)); c.HL(0, y + 1, 32, K('wood', -2))
    for x in range(0, 32, 4):
        top = 3 + (x // 4) % 2
        c.R(x, top + 1, 3, 15 - top - 1, K('wood', 0)); c.VL(x, top + 1, 15 - top - 1, K('wood', 1)); c.VL(x + 2, top + 1, 15 - top - 1, K('wood', -2))
        c.R(x, top - 2, 3, 3, K('sand', 1)); c.P(x + 1, top - 1, K('sand', -1)); c.HL(x, top - 2, 3, K('wood', -1)); c.HL(x, top, 3, K('sand', 2))
    c.outline()


@piece('fence-bamboo', 'bamboo pole fence section, hollow cut bamboo tops seen from above, lashed with rope', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['울타리', '마을'], desc='대나무 울타리 한 칸.')
def _fbamboo(c):
    for x in range(0, 32, 3):
        top = 4 + (x // 3) % 2
        for y in range(top, 15):
            c.P(x, y, K('thatch', 1)); c.P(x + 1, y, K('thatch', -1)); c.P(x + 2, y, K('thatch', -2))
            if (y + x) % 7 == 0: c.HL(x, y, 3, K('thatch', -2))
        c.R(x, top - 2, 3, 3, K('thatch', 2)); c.P(x + 1, top - 1, K('shadow', 1)); c.HL(x, top - 2, 3, K('thatch', 3))   # 자른 대 끝(구멍)
    for y in (7, 11): c.HL(0, y, 32, K('wood', -1)); c.HL(0, y + 1, 32, K('thatch', -3))
    c.outline()


def rack_frame(c, x0, x1, yb, yf, post_h, mat='wood'):
    """3/4 시렁 틀: 뒤 기둥 둘(yb) + 앞 기둥 둘(yf) + 위 가로대 사각(윗면으로 보인다)."""
    for px in (x0, x1 - 2):
        c.R(px, yb, 2, post_h, K(mat, -1)); c.R(px, yf, 2, post_h, K(mat, 0)); c.VL(px, yf, post_h, K(mat, 2))
    c.HL(x0, yb, x1 - x0, K(mat, 1)); c.HL(x0, yb - 1, x1 - x0, K(mat, -1))
    c.R(x0, yf, x1 - x0, 2, K(mat, 1)); c.HL(x0, yf, x1 - x0, K(mat, 3)); c.HL(x0, yf + 2, x1 - x0, K(mat, -2))
    for px in (x0, x1 - 2): c.R(px, yb, 2, yf - yb, K(mat, 1))


@piece('net-rack', 'low wooden drying table seen from above at an angle, slatted top face covered by a spread fishing net, net hanging over the front edge', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['그물', '항구'], desc='그물 말리는 나무 틀(아래 줄 막힘).')
def _netrack(c):
    slab_top(c, 1, 8, 30, 10, 'wood', 0, inset=2, s=7)
    c.R(1, 18, 30, 3, K('wood', -1)); c.HL(1, 20, 30, K('wood', -3))
    for lx in (2, 28): c.R(lx, 21, 2, 8, K('wood', -1)); c.VL(lx, 21, 8, K('wood', 0))
    for y in range(9, 24):
        for x in range(4, 28):
            if y >= 18 and y > 18 + int(6 * math.sin(math.pi * (x - 4) / 24)): continue
            if (x + y) % 3 == 0 or (x - y) % 3 == 0: c.P(x, y, K('teal', 2 if y < 18 else 0 if (x + y) % 2 else -1))
    for (x, y) in ((8, 11), (16, 14), (23, 10), (12, 20), (20, 21)): c.P(x, y, K('red', 2)); c.P(x + 1, y, K('red', 0))
    c.outline()


@piece('fish-rack', 'low wooden fish drying table seen from above at an angle, split fish laid out on the slatted top face', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['생선', '마을'], desc='생선 말리는 시렁(가로대 위 생선).')
def _fishrack(c):
    slab_top(c, 1, 8, 30, 10, 'wood', 0, inset=2, s=8)
    c.R(1, 18, 30, 3, K('wood', -1)); c.HL(1, 20, 30, K('wood', -3))
    for lx in (2, 28): c.R(lx, 21, 2, 8, K('wood', -1)); c.VL(lx, 21, 8, K('wood', 0))
    for k in range(6):
        x = 5 + k * 4; y = 10 + (k % 2)
        c.R(x, y, 3, 6, K('iron', 1)); c.VL(x, y, 6, K('blue', 2)); c.VL(x + 2, y, 6, K('blue', -1)); c.HL(x, y + 5, 3, K('blue', 0)); c.P(x + 1, y + 1, K('coral', 1))
    c.outline()


@piece('hammock', 'woven rope hammock strung between two posts, deep hollow cloth bed seen from above', 2, 1, 'frame', group='props', solid=[(0, 0), (1, 0)], tags=['그물 침대', '해변'], desc='두 기둥 사이 그물 침대.')
def _hammock(c):
    for px in (0, 30):
        c.R(px, 2, 2, 14, K('wood', 0)); c.VL(px, 2, 14, K('wood', 2)); c.R(px, 0, 2, 2, K('sand', 1))
    def bed(x, y, nx, ny, d):
        if d > .84: return K('thatch', -2) if ny < 0 else K('thatch', 2)
        if ny < -.25: return K('thatch', -1)
        if x % 6 == 3: return K('red', 0 if ny < .4 else -1)
        return K('thatch', 1 if (x + y) % 4 else 0)
    c.ellf(16, 8, 13.5, 6, bed)
    c.line(2, 3, 3, 7, K('thatch', -1)); c.line(29, 3, 29, 7, K('thatch', -1))
    c.outline()


@piece('totem', 'carved wooden tiki totem pole with painted faces on a square stone base, flat carved head top', 1, 2, 'figure', group='props', solid=[(0, 1)], tags=['토템', '마을'], desc='새긴 나무 토템(칠한 얼굴). 마을 광장.')
def _totem(c):
    box(c, 0, 24, 16, 5, 3, 'stone', tt=1, ft=-1, s=8)
    for y in range(5, 26):
        for x in range(4, 12):
            nx = (x + .5 - 8) / 4
            c.P(x, y, K('wood', (1 if nx < -.3 else 0 if nx < .4 else -2)))
    c.ellf(8, 4, 5, 3, lambda x, y, nx, ny, d: K('wood', 3 if d < .4 else 2 if ny < .3 else 1))
    c.ellf(8, 4, 5, 3, lambda x, y, nx, ny, d: K('teal', 1) if .55 < d < .75 else None)
    for fy in (8, 17):
        c.R(5, fy, 2, 2, K('bone', 3)); c.R(9, fy, 2, 2, K('bone', 3)); c.P(6, fy + 1, K('shadow', 0)); c.P(10, fy + 1, K('shadow', 0))
        c.R(5, fy + 4, 6, 2, K('red', 1)); c.HL(6, fy + 4, 4, K('bone', 2))
    c.R(1, 14, 3, 2, K('wood', 1)); c.R(12, 14, 3, 2, K('wood', -1))
    c.outline()


@piece('palisade', 'thick log palisade wall section, flat sawn log ends visible along the top', 2, 2, 'frame', group='props', solid=[(0, 1), (1, 1)], tags=['목책', '요새'], desc='통나무 목책 한 칸(가로 2칸, 아래 줄 막힘).')
def _palisade(c):
    for x in range(0, 32, 4):
        for y in range(10, 31):
            for i in range(4):
                t = (1 if i == 0 else 0 if i < 2 else -1 if i < 3 else -3)
                if (y - 10) % 9 == 8: t -= 1
                c.P(x + i, y, K('wood', t))
    c.R(0, 2, 32, 8, K('wood', -3))
    for (row, yy, off) in ((0, 3, 2), (1, 7, 0)):                                   # 윗면: 통나무 마구리 두 줄(뒤·앞)
        for x in range(off, 32, 4):
            for (dx, dy, t) in ((1, -1, 1), (2, -1, 1), (0, 0, 1), (1, 0, 2), (2, 0, 2), (3, 0, 0), (0, 1, 0), (1, 1, 1), (2, 1, 1), (3, 1, -1), (1, 2, -1), (2, 2, -1)):
                c.P(x + dx, yy + dy, K('sand' if t >= 1 else 'wood', t - row))
            c.P(x + 1, yy, K('wood', 1))
    for y in (15, 24): c.HL(0, y, 32, K('thatch', -1)); c.HL(0, y + 1, 32, K('thatch', -3))
    c.outline()


@piece('lobster-traps', 'two stacked slatted wooden lobster traps, slatted lids seen from above', 1, 1, 'box', group='props', solid=[(0, 0)], tags=['통발', '항구'], desc='쌓은 나무 통발.')
def _traps(c):
    box(c, 0, 7, 16, 5, 4, 'wood', tt=1, ft=-1)
    for i in range(1, 16, 3): c.VL(i, 8, 3, K('shadow', 1)); c.VL(i, 12, 3, K('shadow', 1))
    box(c, 2, 0, 11, 5, 4, 'wood', tt=2, ft=-1)
    for i in range(3, 13, 3): c.VL(i, 1, 3, K('shadow', 1)); c.VL(i, 5, 3, K('shadow', 1))
    c.line(13, 2, 15, 9, K('thatch', -1))
    c.outline()


@piece('oar-rack', 'wooden oar stand box seen from above with oars standing upright in it', 1, 2, 'frame', group='props', solid=[(0, 1)], tags=['노', '항구'], desc='세워 둔 노 걸이.')
def _oars(c):
    box(c, 0, 17, 16, 8, 6, 'wood', tt=1, ft=-1, tex='planks', s=9)
    for k in range(4):
        x = 2 + k * 3 + (k % 2)
        y0 = 1 + (k % 2) * 2
        c.R(x, y0, 3, 8, K('wood', 2)); c.VL(x + 2, y0, 8, K('wood', 0)); c.HL(x, y0, 3, K('wood', 3)); c.HL(x, y0 + 7, 3, K('wood', -1))
        c.R(x + 1, y0 + 8, 2, 22 - y0 - 8, K('wood', 1)); c.VL(x + 2, y0 + 8, 22 - y0 - 8, K('wood', -1))
        c.R(x, 21, 4, 2, K('shadow', 1))
    c.outline()


@piece('dock-crane', 'wooden dock crane house with a plank roof seen from above, big treadwheel in front, jib arm with pulley and a hanging crate', 2, 3, 'structure', group='props', solid=[(0, 2), (1, 2), (0, 1)], tags=['기중기', '항구'],
       desc='부두 나무 기중기(판자 지붕 집·바퀴·팔·매단 상자). 방파제 가장자리.')
def _crane(c):
    slab_top(c, 1, 18, 20, 10, 'wood', 1, inset=2, s=9)                  # 집 지붕(윗면)
    c.R(1, 28, 20, 16, K('wood', -1)); c.VL(1, 28, 16, K('wood', 0)); c.VL(20, 28, 16, K('wood', -3)); c.HL(1, 43, 20, K('wood', -3))
    c.ellf(11, 36, 7, 7, lambda x, y, nx, ny, d: K('dark', 1 if ny < 0 else -1) if d > .78 else (K('dark', 0) if abs(nx) < .12 or abs(ny) < .12 else None))
    c.R(10, 35, 2, 2, K('iron', 2))
    c.line(16, 20, 30, 4, K('dark', 1)); c.line(16, 21, 30, 5, K('dark', -1)); c.line(16, 26, 28, 6, K('dark', 0))
    c.ellf(29, 5, 2, 2, lambda x, y, nx, ny, d: K('iron', 2 if ny < 0 else 0)); c.VL(29, 7, 10, K('thatch', -1))
    crate_draw(c, 24, 17, 10, 4, 5, s=3)
    c.outline()


@piece('flowerbed', 'small bed of red and yellow tropical flowers', 1, 1, 'flat', group='props', tags=['꽃', '마을'], desc='열대 꽃밭(바닥, 걸어 지나간다). 집 앞.')
def _flowers(c):
    for k in range(11):
        x = 2 + hsh(k, 3, 5) % 12; y = 3 + hsh(k, 4, 5) % 10
        c.P(x, y + 1, K('grass', -1)); c.P(x - 1, y + 1, K('grass', 0))
        mat = ('red', 'gold', 'coral')[k % 3]
        c.P(x, y, K(mat, 2)); c.P(x + 1, y, K(mat, 0)); c.P(x, y - 1, K(mat, 3))
    c.outline(K('grass', -2))


# ---------------------------------------------------------------- 해변·섬 추가 조각
@piece('treasure-x', 'red painted X mark on the sand with a small dug mound, a buried treasure spot', 1, 1, 'flat', group='props', tags=['보물', '해변'], desc='보물 묻은 자리(모래 위 붉은 X 표시와 작은 흙더미, 걸어 지나간다).')
def _treasure_x(c):
    c.ellf(11, 11, 3.5, 2, lambda x, y, nx, ny, d: K('sand', 1 if ny < 0 else -2))
    for k in range(-4, 5):
        for (dx, dy) in ((0, 0), (1, 0)):
            c.P(7 + k + dx, 7 + k + dy, K('red', 1 if k < 0 else 0)); c.P(7 + k + dx, 7 - k + dy, K('red', 0 if k < 0 else -1))
    c.P(12, 9, K('sand', -1)); c.P(13, 10, K('sand', -2))


@piece('broken-rowboat', 'broken old rowboat half buried in the sand, seen from above with a cracked hull and missing planks', 2, 1, 'debris', group='props', tags=['배', '해변', '난파'], desc='모래에 반쯤 묻힌 부서진 노 젓는 배(걸어 지나간다).')
def _broken_boat(c):
    for x in range(3, 29):
        u = (x - 3) / 26
        hw = 5.5 * (1 if u < .7 else max(0.0, (1 - u) / .3) ** .6)
        top, bot = 8 - hw * .6, 8 + hw * .6
        for y in range(int(round(top)), int(round(bot)) + 1):
            edge = y <= top + 1 or y >= bot - 1
            if not edge and 12 < x < 18: c.P(x, y, K('sand', -1 if (x + y) % 3 else 0)); continue
            c.P(x, y, K('wood', (1 if y <= top + 1 else 0) if edge else (-2 if (x + y) % 4 else -1)))
        if bot + 1 < 16: c.P(x, int(round(bot)) + 1, K('wood', -2))
    for x in (9, 21): c.VL(x, 5, 6, K('wood', 1))
    for (x, y) in ((14, 13), (16, 12), (12, 14), (19, 13)): c.P(x, y, K('sand', 1)); c.P(x + 1, y, K('sand', 0))
    c.outline()
    c.R(13, 12, 5, 2, K('sand', 0)); c.HL(14, 14, 3, K('sand', -1))


@piece('skull-rock', 'large grey sea rock shaped like a skull with two dark hollow eyes, mossy top', 2, 2, 'organic', group='nature', solid=[(0, 1), (1, 1), (0, 0), (1, 0)], tags=['바위', '해적', '보물'],
       desc='해골 바위(눈구멍 둘 난 큰 바위, 이끼 윗면). 보물섬·동굴 곁 표식.')
def _skull_rock(c):
    lit_blob(c, 16, 15, 14, 13, 'rock', 0, s=7)
    c.ellf(16, 8, 10, 5, lambda x, y, nx, ny, d: K('moss', 1 if ny < 0 else 0) if d < .85 and (x + y) % 5 else None)
    for ex in (10, 22):
        c.ellf(ex, 16, 4, 3.5, lambda x, y, nx, ny, d: K('shadow', 0 if d < .6 else 1))
    c.ellf(16, 22, 2, 2, lambda x, y, nx, ny, d: K('shadow', 1))
    for x in range(10, 23, 3): c.R(x, 26, 2, 3, K('rock', 1)); c.VL(x + 2, 26, 3, K('shadow', 1))
    c.outline()


@piece('tide-pool', 'small rock tide pool with clear water and a starfish, flat on the beach', 1, 1, 'flat', group='nature', tags=['해변', '물'], desc='모래 위 작은 바위 웅덩이(물·불가사리, 걸어 지나간다).')
def _tidepool(c):
    c.ellf(8, 9, 7, 5, lambda x, y, nx, ny, d: K('rock', 1 if ny < 0 else -1) if d > .62 else (K('shallow', 1 if (x + y) % 5 else 2) if ny > -.2 else K('shallow', -1)))
    c.P(7, 10, K('coral', 2)); c.P(6, 10, K('coral', 0)); c.P(8, 10, K('coral', 0)); c.P(7, 9, K('coral', 1)); c.P(7, 11, K('coral', 0))
    c.outline()


@piece('palm-stump', 'cut palm tree stump with ringed bark and a flat sawn top seen from above', 1, 1, 'organic', group='nature', solid=[(0, 0)], tags=['야자', '해변'], desc='잘린 야자 그루터기(앉을 수 있다).')
def _stump(c):
    for y in range(6, 14):
        for x in range(4, 13):
            nx = (x + .5 - 8.5) / 4.5
            c.P(x, y, K('sand', (0 if nx < -.3 else -1 if nx < .4 else -2) - (1 if y % 3 == 0 else 0)))
    c.ellf(8.5, 14, 5, 1.5, lambda x, y, nx, ny, d: K('sand', -3) if ny > 0 else None)
    c.ellf(8.5, 6, 4.5, 2.6, lambda x, y, nx, ny, d: K('sand', 2 if d < .3 else 1 if d < .65 else 0) if d < .85 else K('sand', -1))
    c.ellf(8.5, 6, 4.5, 2.6, lambda x, y, nx, ny, d: K('sand', -1) if .45 < d < .55 else None)
    c.line(3, 13, 1, 15, K('grass', 0)); c.line(13, 13, 15, 15, K('grass', -1))
    c.outline()


@piece('bamboo-raft', 'bamboo raft floating on the water seen from above, lashed poles, a paddle and a small crate', 2, 1, 'other', group='boats', solid=[(0, 0), (1, 0)], tags=['배', '뗏목', '물'], desc='대나무 뗏목(물 위, 노·작은 상자).')
def _raft(c):
    for k in range(5):
        y = 3 + k * 2
        for x in range(3, 29):
            c.P(x, y, K('thatch', 2 if k == 0 else 1)); c.P(x, y + 1, K('thatch', -1 if k < 4 else -2))
        c.P(3, y, K('thatch', 3)); c.P(28, y + 1, K('thatch', -2))
    for x in (6, 16, 25): c.VL(x, 3, 10, K('wood', -1))
    c.R(3, 13, 26, 1, K('thatch', -3))
    crate_draw(c, 18, 2, 7, 3, 4, s=2)
    c.line(5, 6, 13, 10, K('wood', 1)); c.R(11, 9, 4, 2, K('wood', 0))
    c.outline()
    from pi_boats import waterline
    waterline(c, 0, 32, s=5)


@piece('crab', 'small red crab on the sand seen from above, claws raised', 1, 1, 'debris', group='nature', tags=['해변', '게'], desc='모래 위 붉은 게(장식, 걸어 지나간다).')
def _crab(c):
    c.ellf(8, 9, 3.5, 2.5, lambda x, y, nx, ny, d: K('red', 2 if ny < -.2 else 1 if ny < .3 else -1))
    for (x0, y0, x1, y1) in ((5, 9, 2, 7), (11, 9, 14, 7), (5, 10, 3, 12), (11, 10, 13, 12), (6, 11, 5, 13), (10, 11, 11, 13)):
        c.line(x0, y0, x1, y1, K('red', -1))
    for (x, y) in ((2, 5), (14, 5)): c.R(x - 1, y, 3, 2, K('red', 1)); c.P(x, y, K('red', 3))
    c.P(7, 7, K('shadow', 0)); c.P(9, 7, K('shadow', 0))
    c.outline()


@piece('log-bench', 'log bench: a split log seat with flat light top seen from above, resting on two stumps', 2, 1, 'seat', group='props', solid=[(0, 0), (1, 0)], tags=['의자', '마을', '모닥불'], desc='통나무 의자(모닥불·광장 곁).')
def _logbench(c):
    for lx in (5, 23): c.R(lx, 10, 4, 5, K('wood', -1)); c.VL(lx, 10, 5, K('wood', 0)); c.HL(lx, 14, 4, K('wood', -3))
    c.R(2, 4, 28, 5, K('sand', 1)); c.HL(2, 4, 28, K('wood', 0)); c.HL(2, 8, 28, K('sand', 2))
    for x in range(5, 28, 7): c.HL(x, 6, 3, K('sand', 0))
    c.R(2, 9, 28, 3, K('wood', -1)); c.HL(2, 11, 28, K('wood', -3))
    c.ellf(2.5, 7.5, 1.5, 3.5, lambda x, y, nx, ny, d: K('sand', 0 if d < .5 else -1)); c.ellf(29.5, 7.5, 1.5, 3.5, lambda x, y, nx, ny, d: K('sand', 0 if d < .5 else -1))
    c.outline()
