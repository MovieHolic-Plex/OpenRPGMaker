#!/usr/bin/env python3
"""sky_island 실내 — 오두막·신전·비공정 선실·천문대. 바닥 4종 · 벽 4양식(윗줄·아랫줄·창) · 천장(void)과 가장자리 · 가구.

벽은 북쪽 두 줄(32px): 윗줄(머리 띠 + 벽), 아랫줄(벽 + 걸레받이). 동·서·남 경계는 천장 칸 void-* 가 테를 두른다.
가구는 3/4: 윗면 밝은 판(뒤 가장자리 어두운 선) + 앞면 한두 단 어둡게 + 바닥 접촉 가장 어두운 줄.

  python3 interior.py   → tiledata/sky-island/interior/_gate/*.png + items.jsonl
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, clamp, blob, box3, NT, MI
from kit import Reg

R = Reg('interior')
A = R.add


# ═══════════════════════ 바닥 ═══════════════════════
def floor_wood(c, s=1):
    for y in range(16):
        row = y // 4; yy = y % 4
        for x in range(16):
            seg = (x + (5 if row % 2 else 0) + row * 3) % 16
            b = 4 + (1 if h32(row, (x + (5 if row % 2 else 0)) // 16, 7) % 3 == 0 else 0)
            t = b
            if yy == 3: t = 2
            elif yy == 0: t = b + 1
            if seg == 0 and yy < 3: t = 2
            if rnd(x, y, s) < 0.05 and yy in (1, 2): t = b - 1
            c.P(x, y, 'plank', clamp(t, 0, 5))


def floor_stone(c, s=1):
    for y in range(16):
        for x in range(16):
            gx, gy = x // 8, y // 8; lx, ly = x % 8, y % 8
            v = h32(gx, gy, 3) % 3
            t = 4 + (1 if v == 0 else 0)
            if lx == 7 or ly == 7: t = 2
            elif lx == 0 or ly == 0: t = 5 + (1 if v == 0 else 0)
            if rnd(x, y, s) < 0.04: t -= 1
            c.P(x, y, 'stone', t)


def floor_deck(c, s=1):
    """비공정 갑판 바닥: 세로 널(밝은 갑판재) + 널 이음 + 드문 놋쇠 못."""
    for x in range(16):
        k = x // 4; lx = x % 4
        for y in range(16):
            t = 4 if k % 2 else 3
            if lx == 3: t = 1
            elif lx == 0: t += 1
            if (y + k * 7) % 16 == 0 and lx < 3: t = 1
            if rnd(x, y, s + 9) < 0.04 and lx in (1, 2): t -= 1
            c.P(x, y, 'plank', t)
    for (x, y) in ((1, 2), (9, 9)): c.P(x, y, 'brass', 4)


def floor_mosaic(c, s=1):
    """천문대 바닥: 짙은 청 큰 판석(칸 하나) + 왼·위 가는 금 줄눈 + 판석 결. 별 점은 칸마다 하나."""
    for y in range(16):
        for x in range(16):
            n = rnd(x // 3, y // 3, s + 4)
            t = 2 if n < 0.7 else 1
            if x == 1 or y == 1: t = 3
            c.P(x, y, 'roofb', t)
    c.HL(0, 0, 16, 'gold', 2); c.VL(0, 0, 16, 'gold', 2); c.P(0, 0, 'gold', 4)
    c.P(11, 6, 'cream', 5)


A('floor-wood', '마루 바닥', 1, 1, 'flat', ['바닥', '오두막'], '오두막·관리소 바닥.', pc='floor', gate_name='wooden plank floor tile (flat)')(lambda c: floor_wood(c, 1))
A('floor-stone', '돌 바닥', 1, 1, 'flat', ['바닥', '신전'], '신전 바닥.', pc='floor', gate_name='stone slab floor tile (flat)')(lambda c: floor_stone(c, 1))
A('floor-deck', '선실 갑판 바닥', 1, 1, 'flat', ['바닥', '비공정'], '비공정 선실 바닥.', pc='floor', gate_name='ship deck plank floor tile (flat)')(lambda c: floor_deck(c, 1))
A('floor-mosaic', '별 무늬 바닥', 1, 1, 'flat', ['바닥', '천문대'], '천문대 바닥.', pc='floor', gate_name='dark blue mosaic floor with gold grid and star dots (flat)')(lambda c: floor_mosaic(c, 1))


# ═══════════════════════ 벽 ═══════════════════════
WALL = {
    # 이름: (벽 재질, 벽 단, 머리 띠 (재질, 단), 걸레받이 (재질, 단))
    'plaster': ('cream', 5, ('wood', 2), ('wood', 3)),
    'stone': ('stone', 4, ('gold', 3), ('stone', 2)),
    'wood': ('wood', 3, ('brass', 3), ('wood', 1)),
    'star': ('roofb', 2, ('gold', 3), ('roofb', 0)),
}


def wall_px(c, style, x, y, yy):
    m, b, _, _ = WALL[style]
    t = b
    if style == 'plaster':
        if rnd(x, yy, 3) < 0.06: t = b - 1
    elif style == 'stone':
        row = yy // 6; ly = yy % 6
        lx = (x + (5 if row % 2 else 0)) % 10
        if ly == 5 or lx == 9: t = b - 2
        elif ly == 0: t = b + 1
    elif style == 'wood':
        lx = x % 5
        if lx == 4: t = b - 2
        elif lx == 0: t = b + 1
        if rnd(x, yy // 2, 7) < 0.06: t = b - 1
    elif style == 'star':
        if rnd(x, yy, 11) < 0.04: c.P(x, y, 'cream', 6); return
        if rnd(x, yy, 12) < 0.03: c.P(x, y, 'crystal', 4); return
    c.P(x, y, m, t)


def wall_upper(c, style, window=None):
    m, b, (hm, ht), _ = WALL[style]
    for y in range(16):
        for x in range(16): wall_px(c, style, x, y, y)
    # 머리 띠(천장 가장자리 아래)
    c.HL(0, 0, 16, 'sumi', 0); c.HL(0, 1, 16, hm, ht + 1); c.HL(0, 2, 16, hm, ht); c.HL(0, 3, 16, m, max(0, b - 2))
    if style == 'wood':
        for x in (2, 13): c.P(x, 2, 'brass', 5)
    if window == 'window':
        x0, y0, w, h = 3, 5, 10, 11
        c.R(x0 - 1, y0 - 1, w + 2, h + 1, 'wood', 2)
        for j in range(h):
            for i in range(w):
                t = 5 if j < 3 else 4 if j < 7 else 3
                if (i + j) % 6 in (0, 1) and j > 1: t = 6
                c.P(x0 + i, y0 + j, 'sky', t)
        c.VL(x0 + w // 2, y0, h, 'wood', 3); c.HL(x0, y0 + 5, w, 'wood', 3)
        c.HL(x0 - 1, y0 - 1, w + 2, 'wood', 4)
    elif window == 'porthole':
        c.ell(8, 9.5, 5.5, 5.5, lambda x, y, dx, dy, d: ('brass', 5 if dx + dy < -0.3 else 3) if d > 0.55 else ('sky', 5 if dy < -0.2 else 4 if dx < 0.3 else 3))
        for (x, y) in ((8, 4), (3, 9), (13, 9), (8, 15)): c.P(x, y, 'brass', 6)
    elif window == 'arch':
        x0, w = 4, 8
        for y in range(5, 16):
            for x in range(x0, x0 + w):
                if y < 7 and (x in (x0, x0 + w - 1) or (y == 5 and x in (x0 + 1, x0 + w - 2))): continue
                c.P(x, y, 'crystal', 4 if y < 9 else 3 if (x + y) % 5 else 5)
        c.VL(x0 + w // 2, 6, 10, 'gold', 3)
    elif window == 'skylight':
        for y in range(4, 16):
            for x in range(3, 13):
                c.P(x, y, 'roofb', 1 if (x + y) % 9 else 0)
        for (x, y) in ((5, 6), (10, 8), (7, 12), (11, 13), (4, 14)): c.P(x, y, 'cream', 6)
        c.R(2, 4, 1, 12, 'gold', 3); c.R(13, 4, 1, 12, 'gold', 2)


def wall_lower(c, style, window=None):
    m, b, _, (bm, bt) = WALL[style]
    for y in range(16):
        for x in range(16): wall_px(c, style, x, y, y + 16)
    if style == 'plaster':
        # 아래 반은 나무 판벽
        for y in range(6, 16):
            for x in range(16):
                t = 3 if x % 4 else 2
                if y == 6: t = 4
                c.P(x, y, 'wood', t)
    if window == 'window':
        c.R(2, 0, 12, 3, 'wood', 3); c.HL(2, 0, 12, 'wood', 5); c.HL(2, 2, 12, 'wood', 1)
    c.HL(0, 13, 16, bm, bt + 1); c.HL(0, 14, 16, bm, bt); c.HL(0, 15, 16, 'sumi', 1)


for st, ko, gn in (('plaster', '회벽', 'plaster wall with wood beam'), ('stone', '돌벽', 'stone block wall with gold trim'),
                   ('wood', '널벽', 'wooden plank cabin wall with brass rivets'), ('star', '별 벽', 'dark blue starry wall')):
    A('wall-%s' % st, '%s 윗줄' % ko, 1, 1, 'wall_mounted', ['벽', st], '방 북쪽 벽 윗줄(천장 바로 아래). 막힘.', pc='solidfloor',
      gate_name='%s, upper interior wall tile (wall_mounted)' % gn)(lambda c, st=st: wall_upper(c, st))
    A('wall-%s-low' % st, '%s 아랫줄' % ko, 1, 1, 'wall_mounted', ['벽', st], '방 북쪽 벽 아랫줄(바닥 바로 위). 막힘.', pc='solidfloor',
      gate_name='%s, lower interior wall tile with baseboard (wall_mounted)' % gn)(lambda c, st=st: wall_lower(c, st))

A('wall-plaster-win', '회벽 창(윗줄)', 1, 1, 'wall_mounted', ['벽', '창'], '오두막 북벽 윗줄에 1~2개, 아랫줄은 wall-plaster-low-win.', pc='solidfloor', gate_name='plaster wall with a window (wall_mounted)')(lambda c: wall_upper(c, 'plaster', 'window'))
A('wall-plaster-low-win', '회벽 창턱(아랫줄)', 1, 1, 'wall_mounted', ['벽', '창'], 'wall-plaster-win 바로 아래.', pc='solidfloor', gate_name='plaster wall with window sill (wall_mounted)')(lambda c: wall_lower(c, 'plaster', 'window'))
A('wall-wood-port', '널벽 둥근 창', 1, 1, 'wall_mounted', ['벽', '창', '비공정'], '선실 북벽 윗줄. 2~3칸 띄워 반복.', pc='solidfloor', gate_name='cabin wall with round brass porthole (wall_mounted)')(lambda c: wall_upper(c, 'wood', 'porthole'))
A('wall-stone-arch', '돌벽 아치 창', 1, 1, 'wall_mounted', ['벽', '창', '신전'], '신전 북벽 윗줄, 제단 양옆.', pc='solidfloor', gate_name='stone wall with tall arched crystal window (wall_mounted)')(lambda c: wall_upper(c, 'stone', 'arch'))
A('wall-star-sky', '별 벽 하늘창', 1, 1, 'wall_mounted', ['벽', '창', '천문대'], '천문대 북벽 윗줄 가운데.', pc='solidfloor', gate_name='observatory wall with a night-sky window (wall_mounted)')(lambda c: wall_upper(c, 'star', 'skylight'))


# ═══════════════════════ 천장(void)과 가장자리 ═══════════════════════
def void(c, edge=''):
    c.R(0, 0, 16, 16, 'sumi', 0)
    for (x, y) in ((3, 4), (11, 9), (7, 13)): c.P(x, y, 'sumi', 1)
    # 가장자리 = 벽 윗면 테(위에서 본 벽 두께): 밝은 두 줄 + 어두운 안쪽 줄
    if 'w' in edge:      # 바닥이 동쪽 → 테가 동쪽 끝
        c.R(12, 0, 3, 16, 'stone', 4); c.VL(12, 0, 16, 'stone', 5); c.VL(15, 0, 16, 'stone', 1)
    if 'e' in edge:      # 바닥이 서쪽 → 테가 서쪽 끝
        c.R(1, 0, 3, 16, 'stone', 4); c.VL(1, 0, 16, 'stone', 5); c.VL(0, 0, 16, 'stone', 1)
    if 's' in edge:      # 바닥이 북쪽(남벽) → 테가 북쪽 끝 + 앞면 조금
        c.R(0, 0, 16, 3, 'stone', 5); c.HL(0, 0, 16, 'stone', 3); c.R(0, 3, 16, 3, 'stone', 3); c.HL(0, 5, 16, 'stone', 1)
        if 'w' in edge: c.R(12, 0, 4, 6, 'stone', 4)
        if 'e' in edge: c.R(0, 0, 4, 6, 'stone', 4)


A('void', '천장(빈 어둠)', 1, 1, 'flat', ['천장'], '방 밖 모든 칸. 막힘.', pc='solidfloor', gate_name='dark interior void ceiling tile (flat)')(lambda c: void(c))
A('void-w', '천장 테(바닥 동쪽)', 1, 1, 'flat', ['천장', '벽'], '방 서쪽 경계: 바닥 바로 서쪽 칸.', pc='solidfloor', gate_name='interior wall top rim seen from above (flat)')(lambda c: void(c, 'w'))
A('void-e', '천장 테(바닥 서쪽)', 1, 1, 'flat', ['천장', '벽'], '방 동쪽 경계: 바닥 바로 동쪽 칸.', pc='solidfloor', gate_name='interior wall top rim seen from above (flat)')(lambda c: void(c, 'e'))
A('void-s', '남벽 윗면', 1, 1, 'flat', ['천장', '벽'], '방 남쪽 경계: 바닥 바로 남쪽 칸(문 칸 제외).', pc='solidfloor', gate_name='south interior wall top rim seen from above (flat)')(lambda c: void(c, 's'))
A('void-sw', '남벽 윗면(서쪽 모서리)', 1, 1, 'flat', ['천장', '벽'], '남서 모서리.', pc='solidfloor', gate_name='interior wall corner top seen from above (flat)')(lambda c: void(c, 'sw'))
A('void-se', '남벽 윗면(동쪽 모서리)', 1, 1, 'flat', ['천장', '벽'], '남동 모서리.', pc='solidfloor', gate_name='interior wall corner top seen from above (flat)')(lambda c: void(c, 'se'))


@A('exit-mat', '나가는 문 깔개', 1, 1, 'flat', ['문', '출입'], '남벽 문 칸(바닥 칸). 나가는 이벤트를 여기에.', pc='floor', gate_name='doormat at the room exit (flat decal)')
def _(c):
    floor_wood(c, 2)
    c.R(1, 4, 14, 10, 'clothr', 2); c.R(2, 5, 12, 8, 'clothr', 3)
    for x in range(2, 14, 2): c.VL(x, 5, 8, 'clothr', 2)
    c.HL(1, 13, 14, 'clothr', 1)
    c.R(0, 14, 16, 2, 'sumi', 0)


# ═══════════════════════ 가구 ═══════════════════════
def legs(c, xs, y0, y1, mat='wood', t=1):
    for x in xs: c.R(x, y0, 2, y1 - y0, mat, t)


@A('bed', '침대(이불)', 1, 2, 'structure', ['침대', '오두막'], '벽에 머리를 붙인다(북벽 아랫줄 바로 아래). 막힘.', gate_name='wooden bed with pillow and quilt seen from above-front')
def _(c):
    box3(c, 1, 0, 14, 4, 4, 'wood', tt=5, ft=3)                     # 머리판
    c.R(2, 6, 12, 20, 'cream', 6); c.HL(2, 6, 12, 'cream', 5)
    c.R(3, 7, 10, 5, 'cream', 6); c.HL(3, 11, 10, 'cream', 4); c.VL(3, 7, 5, 'cream', 5)       # 베개
    for y in range(13, 26):
        for x in range(2, 14):
            q = ((x // 4) + (y // 4)) % 2
            c.P(x, y, 'clothb' if q else 'clothr', 3 if y < 24 else 2)
    c.HL(2, 13, 12, 'clothb', 4)
    c.R(1, 26, 14, 4, 'wood', 3); c.HL(1, 26, 14, 'wood', 4); c.HL(1, 29, 14, 'wood', 1)
    c.VL(1, 4, 26, 'wood', 2); c.VL(14, 4, 26, 'wood', 1); c.HL(1, 31, 14, 'sumi', 1) if False else None
    legs(c, (1, 13), 30, 32, 'wood', 0)


def table(c, x, y, w, top, front, mat='plank'):
    box3(c, x, y, w, top, 2, mat, tt=5, ft=3)
    legs(c, (x + 1, x + w - 3), y + top + 2, y + top + 2 + front, 'wood', 2)


@A('table', '네모 탁자', 2, 1, 'structure', ['탁자'], '방 가운데. 의자를 양옆에. 막힘.', gate_name='wooden table seen from above-front')
def _(c):
    table(c, 1, 1, 30, 9, 4)
    c.ell(9, 5, 3, 1.6, lambda x, y, dx, dy, d: ('cream', 6 if dy < 0 else 4))
    c.R(18, 3, 6, 4, 'gold', 3); c.HL(18, 3, 6, 'gold', 4)


@A('table-round', '둥근 탁자', 1, 1, 'structure', ['탁자'], '구석·창 앞. 막힘.', gate_name='small round wooden table')
def _(c):
    c.ell(8, 6, 7, 4, lambda x, y, dx, dy, d: ('plank', 5 if d < 0.6 else 4))
    c.ell(8, 6, 7, 4, lambda x, y, dx, dy, d: ('plank', 2) if dy > 0.6 else None)
    c.R(7, 10, 3, 5, 'wood', 2); c.HL(4, 15, 9, 'wood', 1)
    c.ell(6, 5, 2, 1.2, lambda x, y, dx, dy, d: ('roofr', 5))


@A('chair', '의자', 1, 1, 'structure', ['의자'], '탁자 옆. 막힘.', gate_name='wooden chair with backrest')
def _(c):
    c.R(4, 0, 8, 7, 'wood', 4); c.HL(4, 0, 8, 'wood', 5); c.VL(11, 0, 7, 'wood', 2)
    for x in (6, 9): c.VL(x, 2, 4, 'wood', 2)
    box3(c, 3, 7, 10, 3, 2, 'wood', tt=5, ft=3)
    legs(c, (3, 11), 12, 16, 'wood', 1)


@A('stool', '나무 걸상', 1, 1, 'seat', ['의자'], '화덕·작업대 앞.', gate_name='round wooden stool seen from above-front: large oval seat top clearly visible')
def _(c):
    for x in (3, 7, 11): c.R(x, 9, 2, 6, 'wood', 2)
    c.HL(3, 15, 10, 'wood', 0)
    c.R(1, 7, 14, 3, 'wood', 3); c.HL(1, 9, 14, 'wood', 1)
    c.ell(8, 6, 7, 4.5, lambda x, y, dx, dy, d: ('wood', 6 if (dx < 0 and dy < 0) else 5) if d < 0.75 else ('wood', 4))
    c.ell(8, 6, 7, 4.5, lambda x, y, dx, dy, d: ('wood', 3) if d > 0.88 and dy < 0 else None)


@A('cupboard', '찬장', 1, 2, 'tall_furniture', ['수납', '오두막'], '북벽에 붙인다. 막힘.', gate_name='tall wooden kitchen cupboard seen from above-front: deep flat top surface with jars on it, shelves with plates')
def _(c):
    tall_top(c, 1, 14, 'wood', [(3, 'roofb', 3), (9, 'cream', 4)])
    c.R(1, 6, 14, 25, 'wood', 3); c.VL(1, 6, 25, 'wood', 4); c.VL(14, 6, 25, 'wood', 1)
    for y in (12, 18):
        c.HL(2, y, 12, 'wood', 1); c.R(2, y - 5, 12, 5, 'wood', 2)
        for x in range(3, 13, 3): c.ell(x + 1, y - 2, 1.4, 1.8, lambda xx, yy, dx, dy, d: ('cream', 6 if dx < 0 else 4))
    c.R(2, 20, 12, 10, 'wood', 2); c.VL(8, 20, 10, 'wood', 1); c.P(7, 25, 'brass', 5); c.P(9, 25, 'brass', 5)
    c.HL(1, 31, 14, 'sumi', 1)


@A('bookshelf', '책장', 1, 2, 'tall_furniture', ['책', '천문대'], '북벽에 붙인다. 막힘. 글자 없음.', gate_name='tall wooden bookshelf seen from above-front: deep flat top with a book lying on it, shelves full of books')
def _(c):
    tall_top(c, 1, 14, 'wood', [(4, 'roofr', 3), (8, 'clothb', 3)])
    c.R(1, 6, 14, 25, 'wood', 2); c.VL(1, 6, 25, 'wood', 4); c.VL(14, 6, 25, 'wood', 1)
    cols = ('roofr', 'clothb', 'leaf', 'gold', 'cream', 'amethyst')
    for y0 in (7, 15, 23):
        c.HL(2, y0 + 6, 12, 'wood', 4)
        x = 2; k = int(rnd(y0, 1, 3) * 6)
        while x < 14:
            w = 1 + (h32(x, y0, 5) % 2); m = cols[(k + x) % 6]; hh = 6 - (h32(x, y0, 6) % 2)
            for i in range(w):
                if x + i < 14: c.VL(x + i, y0 + 6 - hh, hh, m, 3 if i == 0 else 2)
            x += w + (1 if h32(x, y0, 9) % 4 == 0 else 0)
    c.HL(1, 31, 14, 'sumi', 1)


def _hearth(c, f=0):
    """무쇠 난로(벽 앞): 벽돌 받침(윗면 6행이 보이는 낮은 단) + 난로(윗판 5행 — 주전자, 앞 불창) + 벽으로 들어가는 연통."""
    # 벽돌 받침 단
    box3(c, 1, 20, 30, 7, 5, 'roofr', tt=4, ft=2)
    for x in range(3, 30, 5): c.VL(x, 27, 4, 'roofr', 1)
    c.HL(1, 31, 30, 'sumi', 1)
    # 연통(난로 뒤에서 위로)
    c.R(14, 0, 5, 8, 'iron', 2); c.VL(14, 0, 8, 'iron', 3); c.HL(13, 2, 7, 'iron', 3)
    # 난로 몸통: 윗판(5행) + 앞면
    box3(c, 6, 6, 20, 5, 13, 'iron', tt=4, ft=2)
    c.R(10, 13, 12, 7, 'sumi', 0)
    for k in range(4):
        fx = 12 + k * 3 + (1 if (k + f) % 2 else 0)
        hgt = 3 + ((k * 3 + f * 2) % 3)
        for j in range(hgt):
            c.P(fx, 19 - j, 'glow', 4 if j < 2 else 3); c.P(fx + 1, 19 - j, 'glow', 3 if j < 1 else 2)
    c.HL(10, 13, 12, 'iron', 3); c.R(10, 13, 1, 7, 'iron', 3); c.R(21, 13, 1, 7, 'iron', 1)
    for x in (7, 24): c.R(x, 19, 2, 2, 'iron', 1)
    # 윗판 위 주전자
    c.ell(20, 7, 3, 1.6, lambda x, y, dx, dy, d: ('brass', 5 if dy < 0 else 4)); c.R(17, 7, 7, 2, 'brass', 3); c.P(24, 7, 'brass', 3)
    c.R(9, 7, 3, 2, 'iron', 6)


A('hearth', '무쇠 난로(불)', 2, 2, 'tall_furniture', ['난로', '화덕', '오두막'], '북벽 바로 앞(벽 아랫줄 아래 두 줄). 막힘. 앞 한 칸 비움.', frames=3,
  gate_name='cast-iron stove on a low brick platform seen from above-front: flat stove top plate with kettle clearly visible, brick platform top, fire window')(_hearth)


@A('rug', '둥근 깔개', 2, 2, 'flat', ['깔개'], '방 가운데 바닥 덧그림(걷는다).', pc='flat', gate_name='round woven rug on the floor (flat decal)')
def _(c):
    c.ell(16, 16, 15, 12, lambda x, y, dx, dy, d: ('clothr', 3 if d > 0.82 else 2 if d > 0.7 else 4 if d < 0.2 else 3 if d < 0.45 else 2))
    c.ell(16, 16, 15, 12, lambda x, y, dx, dy, d: ('gold', 3) if 0.55 < d < 0.62 else None)
    c.ell(16, 16, 15, 12, lambda x, y, dx, dy, d: ('clothr', 1) if d > 0.93 else None)


@A('rug-long', '긴 깔개(신전 길)', 1, 2, 'flat', ['깔개', '신전'], '신전 입구에서 제단까지 가운데 줄(걷는다).', pc='flat', gate_name='long ceremonial carpet runner (flat decal)')
def _(c):
    c.R(2, 0, 12, 32, 'clothb', 3); c.VL(2, 0, 32, 'gold', 3); c.VL(13, 0, 32, 'gold', 2)
    c.VL(3, 0, 32, 'clothb', 2); c.VL(12, 0, 32, 'clothb', 2)
    for y in range(4, 32, 8):
        c.P(8, y, 'gold', 4); c.P(7, y + 1, 'gold', 3); c.P(9, y + 1, 'gold', 3); c.P(8, y + 2, 'gold', 3)


@A('altar', '신전 제단(수정)', 3, 2, 'structure', ['제단', '신전'], '신전 북벽 가운데 아랫줄 바로 아래. 막힘. 앞 줄 비움.', gate_name='stone altar with glowing crystal on top')
def _(c):
    box3(c, 2, 14, 44, 6, 11, 'stone', tt=6, ft=4)
    c.HL(2, 21, 44, 'gold', 3); c.HL(2, 29, 44, 'gold', 2); c.HL(2, 31, 44, 'stone', 0)
    for x in (6, 24, 40):
        c.R(x, 22, 3, 7, 'stone', 3)
    c.ell(24, 16, 6, 2.2, lambda x, y, dx, dy, d: ('gold', 4 if dy < 0 else 3))
    for y in range(0, 16):
        u = y / 15
        half = 5 * (u / 0.6 if u < 0.6 else (1 - u) / 0.4 + 0.2)
        for x in range(int(round(24 - half)), int(round(24 + half)) + 1):
            v = (x - (24 - half)) / max(1, 2 * half)
            c.P(x, y, 'crystal', 5 if v < 0.3 else 4 if v < 0.55 else 2)
    c.VL(23, 2, 11, 'crystal', 5)
    for (x, y) in ((14, 6), (34, 4), (12, 12), (37, 11)): c.P(x, y, 'glow', 4)
    for x in (8, 38):
        c.R(x, 9, 3, 6, 'cream', 6); c.P(x + 1, 7, 'glow', 4); c.P(x + 1, 8, 'glow', 3)


@A('offering', '헌금 궤', 1, 1, 'structure', ['신전'], '제단 앞 한 칸 띄워 가운데. 막힘.', gate_name='small wooden offering box with slotted top')
def _(c):
    box3(c, 1, 3, 14, 5, 7, 'wood', tt=5, ft=3)
    for x in range(3, 14, 2): c.VL(x, 4, 3, 'wood', 1)
    c.HL(1, 9, 14, 'gold', 3); c.HL(1, 14, 14, 'gold', 2); c.HL(1, 15, 14, 'sumi', 1)


@A('lantern-floor', '신전 등롱', 1, 2, 'column', ['등불', '신전'], '긴 깔개 양옆에 짝으로. 막힘.', gate_name='stone shrine lantern seen from above-front: stacked square blocks each with a visible flat top - wide cap top, ledge under the light box, deep base top')
def _(c):
    box3(c, 0, 22, 16, 7, 3, 'stone', tt=6, ft=3); c.HL(0, 31, 16, 'stone', 0)
    c.R(6, 18, 4, 5, 'stone', 3); c.VL(6, 18, 5, 'stone', 5)
    box3(c, 2, 14, 12, 4, 2, 'stone', tt=6, ft=3)
    c.R(3, 9, 10, 6, 'stone', 2); c.R(5, 10, 6, 4, 'glow', 3); c.R(6, 10, 3, 2, 'glow', 4)
    box3(c, 0, 0, 16, 7, 2, 'stone', tt=6, ft=3)
    c.R(6, 2, 4, 3, 'gold', 4); c.HL(6, 4, 4, 'gold', 2)


@A('cushion', '방석', 1, 1, 'flat', ['신전', '방석'], '제단 앞·깔개 옆 바닥(걷는다).', pc='flat', gate_name='square floor cushion (flat decal)')
def _(c):
    c.R(2, 3, 12, 10, 'clothr', 3); c.HL(2, 3, 12, 'clothr', 4); c.HL(2, 12, 12, 'clothr', 1); c.VL(2, 3, 10, 'clothr', 2); c.VL(13, 3, 10, 'clothr', 1)
    c.P(7, 7, 'gold', 4); c.P(8, 8, 'gold', 3)
    for (x, y) in ((2, 3), (13, 3), (2, 12), (13, 12)): c.P(x, y, 'gold', 3)


@A('incense', '향로', 1, 1, 'container', ['신전'], '제단 옆. 막힘.', gate_name='bronze incense burner seen from above: wide round mouth with ash visible inside, three legs')
def _(c):
    for y in range(8, 13):
        hw = 7 - (y - 8) * 0.8
        for x in range(int(8 - hw), int(8 + hw)):
            v = (x - (8 - hw)) / (2 * hw)
            c.P(x, y, 'brass', 5 if v < 0.3 else 4 if v < 0.6 else 2)
    for x in (4, 7, 11): c.R(x, 13, 2, 2, 'brass', 2)
    c.HL(3, 15, 11, 'sumi', 1)
    c.ell(8, 6, 7.5, 4.5, lambda x, y, dx, dy, d: ('brass', 6 if dy < 0 else 5) if d > 0.55 else ('stone', 2 if dy < 0 else 3))
    c.P(8, 6, 'glow', 3); c.P(8, 2, 'cloud', 5); c.P(9, 1, 'cloud', 4); c.P(8, 0, 'cloud', 5)


@A('helm', '비공정 키', 1, 2, 'other', ['비공정', '선실'], '선실 앞(북쪽) 가운데, 해도 탁자와 마주. 막힘.', gate_name="ship's steering wheel on a wooden stand with a square base whose flat top is visible")
def _(c):
    box3(c, 1, 22, 14, 5, 4, 'wood', tt=5, ft=3); c.HL(1, 31, 14, 'sumi', 1)
    c.R(6, 14, 4, 9, 'wood', 3); c.VL(6, 14, 9, 'wood', 5)
    c.R(5, 12, 6, 3, 'wood', 5); c.HL(5, 12, 6, 'wood', 6)
    c.ell(8, 8, 7, 7, lambda x, y, dx, dy, d: ('wood', 4 if dx + dy < 0 else 2) if d > 0.62 else None)
    for k in range(8):
        a = k * math.pi / 4
        c.line(8, 8, round(8 + math.cos(a) * 8.5), round(8 + math.sin(a) * 8.5), 'wood', 3)
    c.ell(8, 8, 2, 2, lambda x, y, dx, dy, d: ('brass', 5 if dx < 0 else 3))


@A('chart-table', '해도 탁자', 2, 1, 'structure', ['비공정', '선실', '지도'], '선실 가운데. 막힘. 글자 없음.', gate_name='chart table with a map and brass compass')
def _(c):
    table(c, 1, 1, 30, 9, 4, 'wood')
    c.R(4, 2, 22, 6, 'cream', 5); c.HL(4, 2, 22, 'cream', 6)
    for (x, y) in ((8, 4), (9, 5), (10, 4), (15, 5), (16, 4), (20, 3), (21, 4)): c.P(x, y, 'roofb', 3)
    c.line(9, 5, 20, 4, 'clothr', 3)
    c.ell(27, 5, 2.5, 2, lambda x, y, dx, dy, d: ('brass', 5) if d > 0.4 else ('cream', 6))


@A('hammock', '그물 침대', 2, 1, 'low_furniture', ['비공정', '선실', '침대'], '선실 벽 기둥 사이. 막힘.', gate_name='canvas hammock seen from above: wide fabric bed surface with a pillow, slung between two posts with flat tops')
def _(c):
    for x in (0, 28):
        c.R(x, 3, 4, 13, 'wood', 3); c.VL(x, 3, 13, 'wood', 5)
        c.R(x, 0, 4, 3, 'wood', 6); c.HL(x, 0, 4, 'wood', 4)
    for x in range(4, 28):
        u = (x - 4) / 23
        sag = int(3 * math.sin(math.pi * u))
        for y in range(2 + sag, 12 + sag):
            t = 6 if y < 4 + sag else 5 if (x + y) % 4 else 4
            c.P(x, y, 'cream', t)
        c.P(x, 12 + sag, 'cream', 2); c.P(x, 2 + sag, 'cream', 3)
    c.R(6, 4, 6, 5, 'clothb', 4); c.HL(6, 4, 6, 'clothb', 5)
    c.line(4, 4, 3, 2, 'gold', 3); c.line(27, 4, 28, 2, 'gold', 3)


@A('chest', '선원 궤짝', 1, 1, 'box', ['수납', '비공정'], '침대 발치·벽 옆. 막힘.', gate_name='wooden sea chest seen from above-front: large flat lid top with brass bands clearly visible')
def _(c):
    box3(c, 1, 1, 14, 7, 7, 'wood', tt=5, ft=3)
    for x in (3, 12): c.VL(x, 1, 14, 'brass', 4)
    c.R(7, 8, 2, 3, 'brass', 5); c.HL(1, 15, 14, 'sumi', 1)


@A('telescope', '큰 망원경', 2, 3, 'other', ['천문대', '망원경'], '천문대 하늘창 아래 가운데. 아래 두 칸 막힘.', gate_name='large brass telescope on a round wooden platform seen from above (platform top clearly visible), tube pointing up')
def _(c):
    c.R(2, 40, 28, 5, 'wood', 3); c.HL(2, 44, 28, 'wood', 1)
    c.ell(16, 39, 14, 6, lambda x, y, dx, dy, d: ('plank', 5 if dy < -0.2 else 4) if d < 0.8 else ('plank', 3))
    for (x0, x1) in ((16, 7), (16, 25), (16, 16)): c.line(x0, 26, x1, 40, 'wood', 2)
    c.R(13, 24, 7, 4, 'brass', 3); c.HL(13, 24, 7, 'brass', 5)
    for k in range(28):
        x = 10 + k * 0.6; y = 30 - k
        r = 2.5 + k * 0.08
        for o in range(-int(r), int(r) + 1):
            c.P(round(x + o), round(y), 'brass', 5 if o < -1 else 4 if o < 1 else 2)
    c.ell(27, 3, 4.5, 2.5, lambda x, y, dx, dy, d: ('brass', 6) if d > 0.4 else ('crystal', 4))
    for k in (8, 20): c.HL(round(10 + k * 0.6) - 3, 30 - k, 7, 'brass', 1)


@A('orrery', '천체 모형', 1, 2, 'figure', ['천문대'], '천문대 구석·책장 옆. 막힘.', gate_name='brass orrery on a square wooden plinth whose flat top is clearly visible')
def _(c):
    box3(c, 1, 22, 14, 6, 4, 'wood', tt=5, ft=3); c.HL(1, 31, 14, 'sumi', 1)
    c.R(7, 12, 2, 12, 'brass', 3)
    c.ell(8, 12, 7.5, 3, lambda x, y, dx, dy, d: ('brass', 4) if d > 0.8 else None)
    c.ell(8, 12, 3, 3, lambda x, y, dx, dy, d: ('glow', 4 if dx + dy < 0 else 3))
    c.ell(1.5, 12, 1.6, 1.6, lambda x, y, dx, dy, d: ('crystal', 4)); c.ell(13, 14, 1.6, 1.6, lambda x, y, dx, dy, d: ('roofr', 4))
    c.ell(8, 5, 5, 2, lambda x, y, dx, dy, d: ('brass', 3) if d > 0.7 else None)
    c.ell(12, 4, 1.4, 1.4, lambda x, y, dx, dy, d: ('leaf', 5))


@A('globe', '지구본', 1, 1, 'figure', ['천문대', '서재'], '책상 옆. 막힘.', gate_name='globe on a square wooden base whose flat top is clearly visible')
def _(c):
    box3(c, 2, 10, 12, 4, 2, 'wood', tt=5, ft=3)
    c.R(7, 9, 2, 2, 'brass', 3)
    c.ell(8, 5, 4.5, 4.5, lambda x, y, dx, dy, d: ('water', 5 if dx + dy < -0.5 else 4 if dx + dy < 0.4 else 3))
    for (x, y) in ((6, 3), (7, 3), (6, 4), (9, 6), (10, 6), (5, 7)): c.P(x, y, 'leaf', 4)
    c.ell(8, 5, 6, 6, lambda x, y, dx, dy, d: ('brass', 3) if d > 0.85 and dx > 0 else None)


@A('desk', '별자리 책상', 2, 1, 'structure', ['천문대', '책상'], '창·벽 앞. 막힘. 글자 없음.', gate_name='writing desk with star charts and candle')
def _(c):
    table(c, 1, 2, 30, 8, 4, 'wood')
    c.R(4, 3, 12, 5, 'roofb', 2); c.HL(4, 3, 12, 'roofb', 3)
    for (x, y) in ((6, 5), (9, 4), (12, 6), (14, 4)): c.P(x, y, 'cream', 6)
    c.line(6, 5, 9, 4, 'gold', 3)
    c.R(24, 2, 2, 5, 'cream', 6); c.P(24, 0, 'glow', 4); c.P(24, 1, 'glow', 3); c.R(22, 6, 6, 2, 'brass', 3)
    c.R(18, 4, 3, 3, 'cream', 4)


@A('ladder', '사다리', 1, 2, 'structure', ['사다리', '천문대'], '벽에 기댄다(북벽 앞). 위층 이동 이벤트를 아래 칸에.', gate_name='wooden ladder leaning against the wall')
def _(c):
    for x in (3, 11): c.R(x, 0, 2, 32, 'wood', 4); c.VL(x + 1, 0, 32, 'wood', 2)
    for y in range(3, 32, 5): c.HL(5, y, 6, 'wood', 4); c.HL(5, y + 1, 6, 'wood', 1)


@A('lamp', '선 등', 1, 2, 'column', ['등불'], '방 구석·침대 옆. 막힘.', gate_name='standing oil lamp seen from above-front: round base with visible top, shade with an oval top opening')
def _(c):
    c.R(3, 28, 10, 2, 'brass', 2); c.HL(3, 30, 10, 'sumi', 1)
    c.ell(8, 28, 5, 2.5, lambda x, y, dx, dy, d: ('brass', 6 if dy < 0 else 5))
    c.R(7, 12, 2, 16, 'brass', 3); c.VL(7, 12, 16, 'brass', 5)
    c.poly([(2, 12), (4, 4), (12, 4), (14, 12)], lambda x, y: ('cream', 6 if x < 7 else 5 if x < 11 else 4))
    c.HL(2, 12, 13, 'cream', 3)
    c.ell(8, 4, 4, 1.8, lambda x, y, dx, dy, d: ('glow', 4) if d < 0.6 else ('cream', 3))
    c.R(5, 12, 6, 2, 'glow', 3)


@A('wardrobe', '옷장', 2, 2, 'tall_furniture', ['수납', '오두막'], '북벽에 붙인다. 막힘.', gate_name='tall double-door wooden wardrobe seen from above-front: deep flat top surface with a hat box on it')
def _(c):
    tall_top(c, 1, 30, 'wood', [(5, 'roofb', 3), (22, 'clothr', 3)])
    c.R(1, 6, 30, 25, 'wood', 3); c.VL(1, 6, 25, 'wood', 4); c.VL(30, 6, 25, 'wood', 1)
    c.VL(16, 6, 25, 'wood', 1)
    for x in (4, 19):
        c.R(x, 9, 10, 9, 'wood', 2); c.R(x, 20, 10, 9, 'wood', 2)
        c.HL(x, 9, 10, 'wood', 4); c.HL(x, 20, 10, 'wood', 4)
    c.P(14, 19, 'brass', 5); c.P(18, 19, 'brass', 5); c.HL(1, 31, 30, 'sumi', 1)


@A('counter', '접수대', 3, 1, 'structure', ['부두', '가게'], '관리소 방을 가로지른다(뒤로 한 칸 길). 막힘.', gate_name='long wooden service counter')
def _(c):
    box3(c, 0, 1, 48, 5, 9, 'wood', tt=5, ft=3)
    for x in range(2, 47, 8): c.VL(x, 6, 9, 'wood', 2)
    c.R(6, 2, 6, 3, 'cream', 6); c.R(34, 1, 5, 4, 'brass', 4); c.HL(0, 15, 48, 'sumi', 1)


@A('basin', '세숫대', 1, 1, 'structure', ['오두막'], '벽 옆. 막힘.', gate_name='washstand with ceramic basin and jug')
def _(c):
    table(c, 1, 5, 14, 5, 4, 'wood')
    c.ell(6, 6, 4, 1.8, lambda x, y, dx, dy, d: ('cream', 6) if d > 0.4 else ('water', 4))
    c.R(11, 1, 3, 6, 'roofb', 4); c.P(11, 1, 'roofb', 5); c.P(14, 2, 'roofb', 3)


@A('clock', '괘종시계', 1, 2, 'tall_furniture', ['오두막', '시계'], '북벽에 붙인다. 막힘.', gate_name='tall grandfather clock seen from above-front: deep flat top surface visible, round face, pendulum')
def _(c):
    tall_top(c, 2, 12, 'wood')
    c.R(3, 6, 10, 25, 'wood', 3); c.VL(3, 6, 25, 'wood', 4); c.VL(12, 6, 25, 'wood', 1)
    c.ell(8, 11, 3.5, 3.5, lambda x, y, dx, dy, d: ('cream', 6) if d < 0.7 else ('brass', 4))
    c.line(8, 11, 8, 9, 'sumi', 1); c.line(8, 11, 10, 11, 'sumi', 1)
    c.R(5, 16, 6, 12, 'wood', 1); c.VL(8, 16, 9, 'brass', 3); c.ell(8, 25, 1.6, 1.6, lambda x, y, dx, dy, d: ('brass', 5))
    c.HL(3, 31, 10, 'sumi', 1)


@A('banner-wall', '벽 걸개(문장)', 1, 1, 'wall_mounted', ['벽', '신전'], '북벽 윗줄 위 덧그림. 글자 없음(별 문장).', pc='solid', gate_name='hanging cloth banner with star emblem (wall_mounted)')
def _(c):
    c.HL(2, 1, 12, 'wood', 3)
    for y in range(2, 15):
        for x in range(3, 13):
            if y > 11 and abs(x - 7.5) < (y - 11): continue
            c.P(x, y, 'clothb', 3 if x < 7 else 2)
    c.P(8, 6, 'gold', 4); c.P(7, 7, 'gold', 3); c.P(9, 7, 'gold', 3); c.P(8, 8, 'gold', 3); c.P(8, 7, 'gold', 4)


@A('plant', '화분 식물', 1, 1, 'structure', ['식물'], '방 구석·문 옆(문 칸 제외).', gate_name='potted leafy plant')
def _(c):
    blob(c, [(5, 6, 4), (11, 6, 4), (8, 3, 4)], 'leaf', 3, 21, rim=0)
    for y in range(9, 15):
        hw = 5 - (y - 9) * 0.3
        for x in range(int(8 - hw), int(8 + hw)):
            v = (x - (8 - hw)) / (2 * hw)
            c.P(x, y, 'roofr', 5 if v < 0.3 else 4 if v < 0.65 else 2)
    c.HL(3, 9, 10, 'roofr', 6); c.HL(4, 15, 8, 'sumi', 1)


def tall_top(c, x, w, mat='wood', items=()):
    """키 큰 가구 윗판(6행): 뒤 가장자리 어두운 줄, 밝은 판, 앞 모서리 하이라이트 + 위에 놓인 물건."""
    c.R(x, 0, w, 6, mat, 5); c.HL(x, 0, w, mat, 3); c.HL(x, 5, w, mat, 6); c.VL(x, 0, 6, mat, 4); c.VL(x + w - 1, 0, 6, mat, 3)
    for (ix, im, it) in items:
        c.R(ix, 1, 3, 3, im, it); c.HL(ix, 1, 3, im, it + 1)


if __name__ == '__main__':
    rows = R.export()
    print(len(R.items), 'pieces', len(rows), 'pngs')
