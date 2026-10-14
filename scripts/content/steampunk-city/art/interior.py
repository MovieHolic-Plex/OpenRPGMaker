#!/usr/bin/env python3
"""steampunk_city 실내 — 바닥·벽면·천장 + 보일러실·기관실·공방·실험실·여관·선술집 가구.

실내 짜임(구성기 계약): 방 바깥 = 천장(ceiling, 막힘). 방 맨 위 두 줄 = 벽면(<벽>-u 윗줄 + <벽>-d 아랫줄, 막힘). 그 아래가 바닥.
키 큰 가구는 등을 벽면 아랫줄에 대고 바닥 첫 줄부터 선다(그림이 벽면 위로 올라가도 된다). 벽걸이(wall_mounted)는 벽면 줄 위에 투명 바탕으로 얹는다.
위아래 방 사이 통로 = 벽면 두 줄 자리에 wall-door-u/-d.
모든 가구는 3/4 탑뷰: 윗면(밝게, 뒤 가장자리 어두운 선, 앞 모서리 반사 1줄) + 남쪽 앞면(어둡게) + 바닥 먹 접지 선. 빛은 왼쪽 위.

  python3 interior.py      # tiledata/steampunk-city/interior/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, box3, cyl_v, NT, MI, rivets
from kit import Reg, contact, OUT

R = Reg('interior')
ANIM = []      # (id, 이름, [프레임 id], fps)


def anim(id_, name, n, w, h, kind, tags=(), rules='', fps=4):
    def deco(fn):
        ids = []
        for f in range(n):
            fid = id_ if f == 0 else '%s-f%d' % (id_, f)
            R.add(fid, name + ('' if f == 0 else ' (프레임 %d)' % (f + 1)), w, h, kind, tags=tags, rules=rules)(lambda c, f=f: fn(c, f))
            ids.append(fid)
        ANIM.append((id_ + '-anim', name, ids, fps))
        return fn
    return deco


# ═══════════════════════ 바닥 ═══════════════════════
def plank_px(lx, ly, s=3, base=3):
    """가로 판자(4px 폭): 판마다 다른 결 단, 아래 1px 이음 그늘, 두 줄에 한 번만 맞댄 이음, 결 무늬 줄."""
    row = ly // 4; yy = ly % 4
    tone = base + (h32(row, 1, s) % 3) - 1 if base >= 3 else base
    tone = min(tone, base + 1)
    if yy == 3: return ('wood', base - 2)
    if row % 2 == 0 and lx == (h32(row, 0, s) % 10 + 3): return ('wood', base - 2)
    g = h32(lx // 3, row * 4 + yy, s + 2) % 9
    if g == 0: tone -= 1
    elif g == 1 and yy == 0: tone += 1
    return ('wood', tone)


@R.add('floor-plank', '나무 판자 바닥', 1, 1, 'terrain', tags=['실내', '바닥', '판자'], rules='공방·여관 방·선술집 바닥. 넓게 칠한다.')
def _(c): c.F(0, 0, 16, 16, lambda wx, wy, i, j: plank_px(wx % 16, wy % 16))


@R.add('floor-iron', '리벳 철판 바닥', 1, 1, 'terrain', tags=['실내', '바닥', '철판'], rules='기관실·보일러실·실험실 바닥.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        if lx == 15 or ly == 15: return ('iron', 1)
        if lx == 7 or ly == 7: return ('iron', 2)
        if (lx in (1, 13, 9, 5) and ly in (1, 13, 9, 5)) and ((lx < 7) == (lx in (1, 5))) and ((ly < 7) == (ly in (1, 5))):
            pass
        if (lx in (1, 9) and ly in (1, 9)): return ('iron', 5)
        if (lx in (2, 10) and ly in (2, 10)): return ('iron', 1)
        t = 3
        if lx in (0, 8) or ly in (0, 8): t = 4
        if rnd(lx // 2, ly // 2, 21) < 0.08: t = 2
        return ('iron', t)
    c.F(0, 0, 16, 16, f)


@R.add('floor-checker', '흑백 체크 타일 바닥', 1, 1, 'terrain', tags=['실내', '바닥', '타일'], rules='선술집·실험실·여관 현관 바닥.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        light = ((lx // 8) + (ly // 8)) % 2 == 0
        xx, yy = lx % 8, ly % 8
        if light:
            t = 2
            if yy == 7: t = 1
            if (xx, yy) in ((1, 1), (2, 1), (1, 2)): t = 3
            return ('canvas', t)
        t = 1
        if yy == 7: t = 0
        if (xx, yy) in ((1, 1), (2, 1)): t = 2
        return ('stone', t)
    c.F(0, 0, 16, 16, f)


@R.add('floor-herring', '쪽매 마루(바구니 짜임, 여관)', 1, 1, 'terrain', tags=['실내', '바닥', '마루'], rules='여관 응접실·객실 바닥.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        bx, by = lx // 8, ly // 8; xx, yy = lx % 8, ly % 8
        horiz = (bx + by) % 2 == 0
        a, b = (yy, xx) if horiz else (xx, yy)      # a = 판 가로지르는 축
        t = 4 if horiz else 3
        if a % 4 == 3: return ('wood', t - 1)
        if a % 4 == 0 and b in (1, 2, 5): t += 1
        return ('wood', t)
    c.F(0, 0, 16, 16, f)


@R.add('floor-stone', '낡은 돌바닥(보일러실)', 1, 1, 'terrain', tags=['실내', '바닥', '돌'], rules='보일러실·지하 창고 바닥.')
def _(c):
    rows = [[0, 9], [4, 11]]
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        b = rows[(ly // 8) % 2]; yy = ly % 8
        if yy == 7 or lx in (b[0], b[1]) and lx != 0 or (lx == 0 and b[0] == 0): return ('stone', 2)
        t = 3
        if yy == 0 and rnd(lx, ly, 3) < 0.5: t = 4
        if rnd(lx // 3, ly // 3, 9) < 0.1: t = 2
        if rnd(lx, ly, 13) < 0.04: return ('coal', 2)
        return ('stone', t)
    c.F(0, 0, 16, 16, f)


@R.add('rug', '빨강·놋쇠 무늬 깔개', 3, 2, 'flat', tags=['실내', '깔개'], rules='여관 객실·응접실 가운데. 가구 밑에 깔지 않는다.')
def _(c):
    x0, y0, x1, y1 = 3, 3, 45, 29
    for y in range(y0, y1):
        for x in range(x0, x1):
            bx = min(x - x0, x1 - 1 - x); by = min(y - y0, y1 - 1 - y)
            b = min(bx, by)
            if b == 0: c.P(x, y, 'cloth', 1); continue
            if b in (1, 3): c.P(x, y, 'brass', 3 if (x + y) % 2 else 2); continue
            if b == 2: c.P(x, y, 'cloth', 2); continue
            # 가운데 마름모 무늬
            cx, cy = (x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5
            d = abs(x - cx) / 1.6 + abs(y - cy)
            t = 2
            if abs(d - 8) < 0.8: c.P(x, y, 'brass', 3); continue
            if d < 4: c.P(x, y, 'navy', 2 if d > 2 else 3); continue
            if ((x - x0) % 6 == 3 and (y - y0) % 6 == 3): c.P(x, y, 'brass', 2); continue
            c.P(x, y, 'cloth', t + (1 if (x + y) % 7 == 0 else 0))
    for y in range(y0 + 1, y1 - 1, 2):
        c.P(x0 - 1, y, 'canvas', 2); c.P(x0 - 2, y, 'canvas', 1)
        c.P(x1, y, 'canvas', 2); c.P(x1 + 1, y, 'canvas', 1)


# ═══════════════════════ 천장·벽면 ═══════════════════════
@R.add('ceiling', '천장(벽 윗면 덩어리)', 1, 1, 'terrain', tags=['실내', '천장', '벽'], rules='방 바깥 칸 전부. 막힘.')
def _(c):
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16, base=1, mat='soot', mortar=('ink', 1), s=31, var=0))


def wall_brick(c, row, base=3):
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16 + (0 if row == 'u' else 16), base=base, mat='brick', mortar=('brick', 1), s=17))
    if row == 'u':
        c.HL(0, 0, 16, 'ink', 1); c.HL(0, 1, 16, 'brick', 1); c.HL(0, 2, 16, 'brick', 2)       # 천장 밑 그늘
    else:
        c.HL(0, 11, 16, 'wood', 3); c.R(0, 12, 16, 3, 'wood', 2); c.HL(0, 12, 16, 'wood', 4)   # 걸레받이
        c.HL(0, 15, 16, 'ink', 1)


@R.add('wall-brick-u', '벽돌 벽면(윗줄)', 1, 1, 'terrain', tags=['실내', '벽', '벽돌'], rules='방 맨 윗줄. 바로 아래 줄은 wall-brick-d.')
def _(c): wall_brick(c, 'u')


@R.add('wall-brick-d', '벽돌 벽면(아랫줄, 걸레받이)', 1, 1, 'terrain', tags=['실내', '벽', '벽돌'], rules='방 둘째 줄. 바로 아래부터 바닥.')
def _(c): wall_brick(c, 'd')


def wallpaper(c, y0, y1):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        stripe = lx % 8 in (0, 1)
        t = 2 if stripe else 3
        if not stripe and (lx % 8 == 4) and (ly % 6 == 2): return ('brass', 2)
        if not stripe and (lx % 8 in (3, 5)) and (ly % 6 == 3): return ('paint', 2)
        return ('paint', t)
    c.F(0, y0, 16, y1 - y0, f)


@R.add('wall-panel-u', '벽지 벽면(윗줄, 초록 줄무늬 벽지 + 천장 몰딩)', 1, 1, 'terrain', tags=['실내', '벽', '벽지'], rules='여관·선술집 방 맨 윗줄.')
def _(c):
    wallpaper(c, 0, 16)
    c.HL(0, 0, 16, 'ink', 1); c.HL(0, 1, 16, 'wood', 4); c.HL(0, 2, 16, 'wood', 2); c.HL(0, 3, 16, 'paint', 1)


@R.add('wall-panel-d', '나무 징두리 벽면(아랫줄)', 1, 1, 'terrain', tags=['실내', '벽', '나무'], rules='여관·선술집 방 둘째 줄.')
def _(c):
    wallpaper(c, 0, 4)
    c.HL(0, 3, 16, 'wood', 5); c.HL(0, 4, 16, 'wood', 3); c.HL(0, 5, 16, 'wood', 1)          # 의자 높이 띠
    c.R(0, 6, 16, 8, 'wood', 2)
    for x0 in (1, 9):
        c.R(x0, 7, 6, 6, 'wood', 3); c.HL(x0, 7, 6, 'wood', 4); c.VL(x0, 7, 6, 'wood', 4)
        c.HL(x0, 12, 6, 'wood', 1); c.VL(x0 + 5, 7, 6, 'wood', 1)
    c.HL(0, 14, 16, 'wood', 1); c.HL(0, 15, 16, 'ink', 1)


def wall_iron(c, row):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        if lx == 15: return ('iron', 1)
        if lx == 0: return ('iron', 4)
        if row == 'u' and ly == 8 or row == 'd' and ly == 4: return ('iron', 1)
        t = 3 if (lx // 8 + (0 if row == 'u' else 1)) % 2 == 0 else 2
        return ('iron', t)
    c.F(0, 0, 16, 16, f)
    sy = 9 if row == 'u' else 5
    c.HL(0, sy, 15, 'iron', 4)
    for x in (2, 6, 10):
        c.P(x, sy + 1, 'iron', 5); c.P(x + 1, sy + 2, 'iron', 1)
        c.P(x, sy - 3, 'iron', 5); c.P(x + 1, sy - 2, 'iron', 1)
    if row == 'u':
        c.HL(0, 0, 16, 'ink', 1); c.HL(0, 1, 16, 'iron', 1); c.HL(0, 2, 16, 'iron', 2)
    else:
        c.R(0, 11, 16, 4, 'iron', 2); c.HL(0, 11, 16, 'iron', 4); c.HL(0, 15, 16, 'ink', 1)
        for x in (3, 11): c.P(x, 13, 'iron', 5)


@R.add('wall-iron-u', '리벳 철판 벽면(윗줄)', 1, 1, 'terrain', tags=['실내', '벽', '철판'], rules='기관실·보일러실·실험실 맨 윗줄.')
def _(c): wall_iron(c, 'u')


@R.add('wall-iron-d', '리벳 철판 벽면(아랫줄, 발판)', 1, 1, 'terrain', tags=['실내', '벽', '철판'], rules='기관실·보일러실·실험실 둘째 줄.')
def _(c): wall_iron(c, 'd')


@R.add('wall-window-u', '벽돌 벽면 아치 창(윗줄)', 1, 1, 'terrain', tags=['실내', '벽', '창'], rules='벽돌 벽면 윗줄 사이사이. 아래 줄은 wall-window-d.')
def _(c):
    wall_brick(c, 'u')
    for y in range(3, 16):
        for x in range(2, 14):
            dx = x + 0.5 - 8; dy = y + 0.5 - 9
            d = (dx * dx + dy * dy) ** 0.5
            if y < 9 and d > 6.2: continue
            if (y < 9 and d > 5.0) or x in (2, 13):
                c.P(x, y, 'stone', 5 if x < 8 else 3); continue
            t = 4 if y < 7 else 3
            if (x - y) % 7 in (0, 1): t = 4
            if x == 7 or y == 11: c.P(x, y, 'iron', 2); continue
            c.P(x, y, 'glass', t)
    c.P(7, 2, 'stone', 6); c.P(8, 2, 'stone', 6)


@R.add('wall-window-d', '벽돌 벽면 아치 창(아랫줄, 창턱)', 1, 1, 'terrain', tags=['실내', '벽', '창'], rules='wall-window-u 바로 아래.')
def _(c):
    wall_brick(c, 'd')
    for y in range(0, 7):
        for x in range(2, 14):
            if x in (2, 13): c.P(x, y, 'stone', 5 if x < 8 else 3); continue
            if x == 7 or y == 3: c.P(x, y, 'iron', 2); continue
            c.P(x, y, 'glass', 3 if (x - y) % 7 not in (0, 1) else 4)
    c.HL(1, 7, 14, 'stone', 6); c.HL(1, 8, 14, 'stone', 4); c.HL(1, 9, 14, 'brick', 1)


@R.add('wall-door-u', '벽 통로(윗줄, 돌 상인방 + 어두운 틈)', 1, 1, 'terrain', tags=['실내', '벽', '통로'], rules='위아래 방을 잇는 통로 자리 윗줄. 아래 줄은 wall-door-d.')
def _(c):
    wall_brick(c, 'u')
    c.R(1, 3, 14, 3, 'stone', 5); c.HL(1, 3, 14, 'stone', 6); c.HL(1, 6, 14, 'stone', 2)
    c.R(2, 7, 12, 9, 'coal', 1)
    c.R(1, 6, 1, 10, 'stone', 5); c.R(14, 6, 1, 10, 'stone', 3)
    c.HL(2, 7, 12, 'ink', 0)


@R.add('wall-door-d', '벽 통로(아랫줄, 문턱)', 1, 1, 'terrain', tags=['실내', '벽', '통로'], rules='wall-door-u 바로 아래. 걸어 지나가는 칸.')
def _(c):
    c.R(0, 0, 16, 16, 'brick', 3)
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: tex_brick(wx % 16, wy % 16 + 16, base=3, mat='brick', mortar=('brick', 1), s=17))
    c.R(2, 0, 12, 16, 'coal', 1)
    for y in range(6, 16):
        for x in range(2, 14): c.P(x, y, *plank_px(x, y + 3, base=2 if y > 9 else 1))
    c.R(1, 0, 1, 16, 'stone', 5); c.R(14, 0, 1, 16, 'stone', 3)
    c.HL(1, 14, 14, 'stone', 5); c.HL(1, 15, 14, 'stone', 3)


# ═══════════════════════ 보일러실·기관실 ═══════════════════════
FIRE = [  # 화실 불꽃 단 배치(프레임마다 다른 결)
    lambda x, y: 4 if (x + y) % 5 == 0 else 3 if (x * 3 + y) % 4 else 2,
    lambda x, y: 4 if (x + y * 2) % 5 == 1 else 3 if (x + y) % 3 else 2,
    lambda x, y: 4 if (x * 2 + y) % 6 == 2 else 3 if (x + y * 3) % 4 else 2,
]


def fire_fill(c, x0, y0, w, h, f):
    for y in range(h):
        for x in range(w):
            t = FIRE[f % 3](x, y)
            if y < h * 0.35: t = min(t, 3) - (1 if (x + f) % 3 == 0 else 0)
            if y > h * 0.7: t = 4 if (x + f) % 2 else 3
            c.P(x0 + x, y0 + y, 'fire', t)


@anim('boiler', '세운 보일러(리벳 원통 + 화실 문 불빛 + 압력계)', 3, 3, 3, 'round_body', tags=['보일러실', '보일러', '기관실'], rules='보일러실 가운데 또는 북쪽 벽 앞. 화실 문 앞(남쪽) 2칸은 비우고 석탄 칸을 옆에.', fps=5)
def boiler(c, f):
    x0, w = 5, 38
    # 몸통(세로 원통): 왼쪽 밝게 → 오른쪽 어둡게
    for y in range(9, 42):
        for i in range(w):
            u = (i + 0.5) / w
            t = 5 if u < 0.12 else 4 if u < 0.32 else 3 if u < 0.62 else 2 if u < 0.86 else 1
            c.P(x0 + i, y, 'iron', t)
    for by in (18, 30):
        for i in range(w):
            g = c.get(x0 + i, by)[1]
            c.P(x0 + i, by, 'iron', max(0, g - 2)); c.P(x0 + i, by + 1, 'iron', min(6, g + 1))
            if i % 4 == 1: c.P(x0 + i, by - 2, 'iron', min(6, g + 2)); c.P(x0 + i + 1, by - 1, 'iron', max(0, g - 2))
    c.VL(x0, 9, 33, 'ink', 1); c.VL(x0 + w - 1, 9, 33, 'ink', 1)
    # 뚜껑(위 타원, 윗면 12행) + 리벳 테 + 맨홀
    c.ell(24, 9, 19, 7.5, lambda X, Y, dx, dy, d: ('iron', 6 if (dx < -0.2 and dy < -0.1) else 5 if d < 0.55 else 4 if dx < 0.4 else 3))
    c.ell(24, 9, 19, 7.5, lambda X, Y, dx, dy, d: ('iron', 2) if d > 0.86 else None)
    for k in range(16):
        a = k * math.pi / 8
        c.P(round(24 + 15.5 * math.cos(a) - 0.5), round(9 + 6 * math.sin(a) - 0.5), 'iron', 6 if math.cos(a) < 0 else 2)
    c.ell(18, 8, 4, 2, lambda X, Y, dx, dy, d: ('iron', 2) if d > 0.5 else ('iron', 4))
    # 구리 김 관(뚜껑에서 솟아 북동으로)
    c.R(29, 1, 4, 8, 'copper', 3); c.VL(29, 1, 8, 'copper', 4); c.VL(30, 1, 8, 'copper', 5); c.VL(32, 1, 8, 'copper', 1)
    c.R(28, 6, 6, 2, 'brass', 3); c.HL(28, 6, 6, 'brass', 5)
    c.ell(31, 1, 2, 1, lambda X, Y, dx, dy, d: ('coal', 1))
    # 압력계(왼쪽 위 몸)
    c.ell(13, 23, 4, 4, lambda X, Y, dx, dy, d: ('canvas', 3 if d < 0.45 else 2) if d < 0.62 else ('brass', 4 if dx < 0 else 2))
    c.line(13, 23, 15, 21, 'ink', 1); c.P(13, 23, 'cloth', 2)
    # 수위 유리관(오른쪽)
    c.R(36, 20, 2, 8, 'glass', 3); c.VL(36, 24, 4, 'glass', 4); c.P(36, 19, 'brass', 4); c.P(36, 28, 'brass', 3)
    # 화실 문(무쇠 틀 + 살 + 불빛)
    c.R(16, 31, 16, 10, 'iron', 2); c.HL(16, 31, 16, 'iron', 4); c.VL(16, 31, 10, 'iron', 4); c.VL(31, 31, 10, 'iron', 1)
    fire_fill(c, 18, 33, 12, 7, f)
    for x in (20, 23, 26, 29): c.VL(x, 33, 7, 'iron', 1)
    c.R(32, 35, 3, 2, 'brass', 4)
    c.HL(18, 40, 12, 'fire', 1)
    # 받침(윗면 3 + 앞면 3)
    box3(c, 2, 41, 44, 3, 3, 'iron', tt=4, ft=2)
    c.HL(2, 47, 44, 'ink', 1)
    # 불빛 반사(받침 윗면)
    for x in range(18, 30): c.P(x, 42, 'fire', 2 if (x + f) % 3 else 3)


@R.add('furnace', '벽돌 화덕(위가 트인 불 아가리)', 2, 2, 'container', tags=['보일러실', '공방', '화덕'], rules='공방·보일러실 벽 앞. 앞 1칸 비움.')
def _(c):
    # 윗면(벽돌 갓, 12행) + 아가리 타원(불)
    c.R(1, 2, 30, 12, 'brick', 5)
    c.F(1, 2, 30, 12, lambda wx, wy, i, j: tex_brick(i + 1, j + 2, base=5, mat='brick', s=7, course=3, blen=6))
    c.HL(1, 2, 30, 'brick', 2); c.HL(1, 13, 30, 'brick', 6)
    c.ell(16, 8, 11, 4.6, lambda X, Y, dx, dy, d: ('brick', 1) if d > 0.78 else ('fire', 2 if dy < -0.3 else 3 if d > 0.4 else 4))
    for (x, y) in ((12, 8), (18, 9), (15, 7), (21, 8)): c.P(x, y, 'coal', 2)
    c.P(14, 9, 'fire', 4); c.P(20, 7, 'fire', 4)
    # 앞면(벽돌) + 재 문 + 불빛 틈
    c.F(1, 14, 30, 15, lambda wx, wy, i, j: tex_brick(i + 1, j + 14, base=3, mat='brick', s=9))
    c.HL(1, 14, 30, 'brick', 2)
    c.R(10, 19, 12, 8, 'iron', 2); c.HL(10, 19, 12, 'iron', 4); c.VL(10, 19, 8, 'iron', 4)
    fire_fill(c, 12, 21, 8, 4, 1)
    for x in (14, 17): c.VL(x, 21, 4, 'iron', 1)
    c.VL(0, 2, 27, 'ink', 1); c.VL(31, 2, 27, 'ink', 1); c.HL(1, 1, 30, 'ink', 1)
    c.R(1, 29, 30, 2, 'stone', 3); c.HL(1, 29, 30, 'stone', 5); c.HL(0, 31, 32, 'ink', 1)


@R.add('coal-bin', '무쇠 석탄 통(안이 보인다)', 2, 1, 'container', tags=['보일러실', '석탄'], rules='보일러·화덕 옆.')
def _(c):
    # 테두리(윗면) + 안쪽 석탄(7행) + 앞면 리벳 철판
    c.R(1, 0, 30, 9, 'iron', 1)
    c.HL(1, 0, 30, 'iron', 4); c.VL(1, 0, 9, 'iron', 4); c.VL(30, 0, 9, 'iron', 2); c.HL(1, 8, 30, 'iron', 6)
    for y in range(1, 8):
        for x in range(2, 30):
            r = rnd(x // 2, y // 2, 5)
            t = 2 if r > 0.6 else 1 if r > 0.25 else 0
            if y < 3: t = max(0, t - 1)
            c.P(x, y, 'coal', t)
            if rnd(x, y, 9) > 0.95: c.P(x, y, 'iron', 5)
    c.R(1, 9, 30, 6, 'iron', 3); c.HL(1, 9, 30, 'iron', 2)
    for x in range(3, 30, 5): c.P(x, 11, 'iron', 5); c.P(x + 1, 12, 'iron', 1)
    c.VL(1, 9, 6, 'iron', 4); c.VL(30, 9, 6, 'iron', 1)
    c.VL(0, 0, 15, 'ink', 1); c.VL(31, 0, 15, 'ink', 1); c.HL(0, 15, 32, 'ink', 1)


ENG_ANG = [0, 15, 30, 45]


def ring_band(c, x0, w, y, mat, t_hi, t_lo, bow=2):
    """원통 둘레 띠(위에서 내려다본 곡선: 가운데가 아래로 bow 만큼 처진다)."""
    for i in range(w):
        u = (i + 0.5) / w * 2 - 1
        yy = y + round(bow * (1 - u * u))
        c.P(x0 + i, yy, mat, t_hi if u < 0 else t_lo)
        c.P(x0 + i, yy + 1, mat, max(0, t_lo - 1))


def upright_cyl(c, x, y, w, h, mat, capmat=None, ry=None):
    """세운 원통: 몸(왼쪽 밝게) + 위 타원 뚜껑(윗면, 뒤 가장자리 어둡게) + 아래 둥근 밑선."""
    n = NT[MI[mat]]; ry = ry or max(2, w // 4)
    cx = x + w / 2
    for j in range(h):
        for i in range(w):
            u = (i + 0.5) / w
            t = n - 3 if u < 0.15 else n - 4 if u < 0.4 else n - 5 if u < 0.7 else n - 6
            c.P(x + i, y + j, mat, max(1, t))
    c.ell(cx, y + h, w / 2, ry * 0.7, lambda X, Y, dx, dy, d: (mat, 1) if dy > 0 else None)
    cm = capmat or mat; cn = NT[MI[cm]]
    def cap(X, Y, dx, dy, d):
        if d > 0.8: return (cm, cn - 4) if dy < 0 else (cm, cn - 1)      # 뒤 가장자리 어둡게, 앞 테 반사
        return (cm, cn - 1 if (dx < -0.1 and dy < 0.2) else cn - 2)
    c.ell(cx, y, w / 2, ry, cap)
    c.ell(cx, y + 1, w / 2, ry, lambda X, Y, dx, dy, d: (mat, 1) if (dy > 0.75 and not (Y < y + ry)) else None)


@anim('engine', '세운 실린더 증기 기관(받침대 + 뚜껑이 보이는 실린더 + 크로스헤드 + 누운 플라이휠)', 4, 4, 3, 'other', tags=['기관실', '증기 기관'], rules='기관실 가운데. 플라이휠(동쪽) 둘레 1칸 비움, 앞(남쪽)에 통로.', fps=6)
def engine(c, f):
    a0 = math.radians(ENG_ANG[f])
    cx, cy, RX, RY = 46, 24, 14, 8
    # 받침대: 넓은 윗면 13행 + 앞면 7행(무쇠 띠·리벳)
    box3(c, 1, 26, 62, 13, 7, 'stone', tt=5, ft=3)
    c.HL(1, 41, 62, 'iron', 4); c.HL(1, 42, 62, 'iron', 2)
    for x in range(4, 62, 8): c.P(x, 44, 'iron', 5); c.P(x + 1, 45, 'iron', 1)
    c.HL(0, 47, 64, 'ink', 1)
    c.R(cx - 13, 28, 27, 7, 'coal', 0); c.HL(cx - 13, 34, 27, 'stone', 6); c.VL(cx + 13, 28, 7, 'stone', 3)   # 바퀴 구덩이
    # 플라이휠(위에서 비스듬히 본 바퀴 — 납작한 타원 + 위쪽 두꺼운 테 면)
    def ring(ox, oy, mode):
        for y in range(oy - RY - 2, oy + RY + 2):
            for x in range(ox - RX - 2, ox + RX + 2):
                d = math.hypot((x + 0.5 - ox) / RX, (y + 0.5 - oy) / RY)
                if 0.7 <= d <= 1.0:
                    ang = math.atan2((y + 0.5 - oy) / RY, (x + 0.5 - ox) / RX)
                    if mode == 'back': t = 6 if math.sin(ang) < -0.2 and math.cos(ang) < 0.3 else 5 if math.sin(ang) < 0 else 2
                    else:
                        lit = -math.cos(ang + math.pi / 4)
                        t = 5 if lit > 0.5 else 4 if lit > -0.2 else 3
                        if d > 0.92: t = 1
                        elif d < 0.78: t = 2
                    c.P(x, y, 'iron', t)
    for k in range(4): ring(cx, cy - 4 + k, 'back')          # 테 두께(윗면 띠)
    for k in range(6):
        a = a0 + k * math.pi / 3
        for r10 in range(25, int(RX * 0.76 * 10), 5):
            r = r10 / 10
            x = cx + r * math.cos(a) - 0.5; y = cy + r * RY / RX * math.sin(a) - 0.5
            c.P(round(x), round(y), 'iron', 5 if math.sin(a) < 0.2 else 4)
            c.P(round(x), round(y) + 1, 'iron', 2)
    ring(cx, cy, 'front')
    for k in range(12):
        a = a0 + k * math.pi / 6
        c.P(round(cx + (RX - 2) * math.cos(a) - 0.5), round(cy + (RY - 1.2) * math.sin(a) - 0.5), 'brass', 4)
    c.ell(cx, cy, 3, 2, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 and dy < 0 else 3 if d < 0.7 else 1))
    # 크랭크 핀(바퀴 위) + 크로스헤드(실린더 위, 크랭크 따라 위아래)
    px_ = cx + 7 * math.cos(a0 + math.pi * 0.8); py = cy + 4.2 * math.sin(a0 + math.pi * 0.8)
    hy = round(1 + math.sin(a0 * 2))
    # 실린더(세운 원통, 위 뚜껑 타원 9행이 윗면) + 곡선 놋쇠 띠
    upright_cyl(c, 4, 12, 18, 20, 'iron', ry=4.5)
    ring_band(c, 4, 18, 18, 'brass', 4, 2); ring_band(c, 4, 18, 27, 'brass', 4, 2)
    for k in range(10):
        a = k * math.pi / 5
        c.P(round(13 + 7 * math.cos(a) - 0.5), round(12 + 3.5 * math.sin(a) - 0.5), 'brass', 4 if math.sin(a) < 0 else 2)
    # 피스톤 막대 + 크로스헤드(작은 상자, 윗면 보임)
    c.ell(13, 12, 2, 1, lambda X, Y, dx, dy, d: ('iron', 1))                 # 막대 구멍
    c.VL(12, hy + 4, 8 - hy, 'iron', 6); c.VL(13, hy + 4, 8 - hy, 'iron', 3)
    box3(c, 10, hy, 6, 2, 2, 'brass', tt=4, ft=2)
    # 연결 막대(크로스헤드 → 크랭크 핀)
    c.line(16, hy + 2, round(px_), round(py), 'iron', 6)
    c.line(16, hy + 3, round(px_), round(py) + 1, 'iron', 2)
    c.ell(px_ + 0.5, py + 0.5, 1.6, 1.6, lambda X, Y, dx, dy, d: ('brass', 5))
    # 밸브 상자(실린더 옆, 윗면 보이는 놋쇠 상자) + 김 관
    box3(c, 22, 16, 8, 4, 8, 'brass', tt=4, ft=2)
    c.R(24, 12, 3, 4, 'copper', 4); c.VL(24, 12, 4, 'copper', 5)
    c.ell(25.5, 12, 1.6, 0.9, lambda X, Y, dx, dy, d: ('copper', 5))


@R.add('dynamo', '발전기(구리 코일 드럼 + 무쇠 받침 상자)', 2, 2, 'box', tags=['기관실', '실험실', '발전기'], rules='기관 옆, 벽 앞.')
def _(c):
    # 받침 상자(윗면 8행)
    box3(c, 2, 12, 28, 8, 11, 'iron', tt=4, ft=2)
    for x in range(4, 29, 5): c.P(x, 24, 'iron', 5); c.P(x + 1, 25, 'iron', 1)
    c.R(12, 26, 8, 4, 'iron', 1); c.HL(12, 26, 8, 'iron', 3)
    for x in (14, 17): c.VL(x, 27, 3, 'iron', 4)
    c.HL(1, 31, 30, 'ink', 1)
    # 코일 드럼(가로 원통): 구리 감은 줄 + 놋쇠 끝 종
    for y in range(4, 17):
        for x in range(8, 24):
            v = (y - 4) / 12
            t = 5 if v < 0.15 else 4 if v < 0.4 else 3 if v < 0.75 else 2
            if x % 2 == 0: t -= 1
            c.P(x, y, 'copper', max(1, t))
    for x0 in (4, 24):
        c.R(x0, 5, 4, 11, 'brass', 3); c.HL(x0, 5, 4, 'brass', 5); c.HL(x0, 15, 4, 'brass', 1)
        c.VL(x0, 5, 11, 'brass', 4); c.VL(x0 + 3, 5, 11, 'brass', 2)
        c.ell(x0 + 2, 5, 2, 1.2, lambda X, Y, dx, dy, d: ('brass', 5))
    c.HL(4, 4, 24, 'ink', 1)
    # 단자 기둥
    for x in (11, 20):
        c.R(x, 1, 2, 4, 'brass', 4); c.P(x, 0, 'brass', 5); c.P(x + 1, 4, 'brass', 1)


# ── 벽걸이 ──
@R.add('pipe-wall', '벽 구리 배관(밸브 손잡이)', 1, 2, 'wall_mounted', tags=['실내', '벽걸이', '배관'], rules='벽면 두 줄에 얹는다. 보일러실·기관실.')
def _(c):
    c.R(6, 0, 4, 32, 'copper', 3); c.VL(6, 0, 32, 'copper', 4); c.VL(7, 0, 32, 'copper', 5); c.VL(9, 0, 32, 'copper', 1)
    for y in (4, 26):
        c.R(4, y, 8, 2, 'iron', 4); c.HL(4, y, 8, 'iron', 5); c.HL(4, y + 2, 8, 'ink', 1)
    c.R(5, 12, 6, 6, 'brass', 3); c.HL(5, 12, 6, 'brass', 5); c.HL(5, 17, 6, 'brass', 1)
    c.ell(8, 11, 5, 2, lambda X, Y, dx, dy, d: ('cloth', 3 if dx < 0 else 2) if d > 0.4 else None)
    c.R(7, 10, 2, 3, 'iron', 3)
    c.R(5, 20, 6, 2, 'copper', 2); c.HL(5, 20, 6, 'copper', 4)


@R.add('gauge-wall', '벽 압력계 묶음', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '계기'], rules='벽면 윗줄. 보일러·기관 근처.')
def _(c):
    c.R(1, 2, 14, 12, 'iron', 2); c.HL(1, 2, 14, 'iron', 4); c.HL(1, 13, 14, 'ink', 1); c.VL(1, 2, 12, 'iron', 4)
    for (cx, cy, r) in ((5, 7, 3.3), (11.5, 8, 2.6)):
        c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d: ('canvas', 3) if d < 0.5 else ('brass', 4 if dx < 0 else 2))
    c.line(5, 7, 6, 5, 'ink', 1); c.P(11, 8, 'cloth', 3); c.P(12, 7, 'ink', 1)
    c.R(7, 11, 2, 2, 'copper', 3)


@R.add('valve-wheel', '벽 밸브 바퀴', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '밸브'], rules='배관 벽면.')
def _(c):
    c.R(6, 0, 4, 16, 'copper', 3); c.VL(6, 0, 16, 'copper', 4); c.VL(9, 0, 16, 'copper', 1)
    c.R(5, 6, 6, 5, 'brass', 3); c.HL(5, 6, 6, 'brass', 5)
    c.ell(8, 8, 6, 5, lambda X, Y, dx, dy, d: ('cloth', 3 if dx < 0 and dy < 0 else 2) if d > 0.62 else None)
    for a in range(0, 360, 60):
        r = math.radians(a)
        c.line(8, 8, round(8 + 4 * math.cos(r)), round(8 + 3.5 * math.sin(r)), 'cloth', 2)
    c.ell(8, 8, 1.5, 1.5, lambda X, Y, dx, dy, d: ('brass', 5))


@R.add('wall-clock-gear', '톱니 벽시계(글자 없는 눈금)', 1, 2, 'wall_mounted', tags=['실내', '벽걸이', '시계'], rules='벽면 두 줄 가운데. 여관·공방·역 대합실.')
def _(c):
    c.ell(8, 9, 7.4, 7.4, lambda X, Y, dx, dy, d: ('brass', 4 if dx < -0.2 else 3 if dx < 0.4 else 2))
    for k in range(10):
        a = k * math.pi / 5
        c.P(round(8 + 7.6 * math.cos(a) - 0.5), round(9 + 7.6 * math.sin(a) - 0.5), 'brass', 3)
    c.ell(8, 9, 5.4, 5.4, lambda X, Y, dx, dy, d: ('canvas', 3 if d < 0.6 else 2))
    for k in range(12):
        a = k * math.pi / 6
        c.P(round(8 + 4.4 * math.cos(a) - 0.5), round(9 + 4.4 * math.sin(a) - 0.5), 'ink', 2)
    c.line(8, 9, 8, 5, 'ink', 1); c.line(8, 9, 11, 10, 'ink', 1); c.P(8, 9, 'brass', 5)
    # 아래 드러난 톱니 둘 + 진자
    for (cx, cy, r, m) in ((5, 22, 3.4, 'copper'), (11, 24, 2.6, 'brass')):
        c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d, m=m: (m, 4 if dx < 0 else 2) if d > 0.3 else ('iron', 1))
        for k in range(8):
            a = k * math.pi / 4
            c.P(round(cx + (r + 0.9) * math.cos(a) - 0.5), round(cy + (r + 0.9) * math.sin(a) - 0.5), m, 3)
    c.VL(8, 16, 12, 'brass', 3); c.ell(8, 29, 2, 2, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3))


@R.add('tool-rack', '벽 공구 판(렌치·망치·톱)', 2, 1, 'wall_mounted', tags=['실내', '벽걸이', '공방'], rules='공방 벽면 아랫줄 위.')
def _(c):
    c.R(1, 1, 30, 13, 'wood', 3); c.HL(1, 1, 30, 'wood', 4); c.HL(1, 13, 30, 'wood', 1); c.VL(1, 1, 13, 'wood', 4); c.VL(30, 1, 13, 'wood', 1)
    for y in range(3, 13, 3):
        for x in range(3, 30, 3): c.P(x, y, 'wood', 1)
    # 렌치 둘
    for x0 in (4, 8):
        c.VL(x0 + 1, 4, 8, 'iron', 5); c.VL(x0 + 2, 4, 8, 'iron', 3)
        c.R(x0, 3, 4, 2, 'iron', 4); c.P(x0 + 1, 3, 'wood', 3)
    # 망치
    c.R(13, 3, 6, 3, 'iron', 4); c.HL(13, 3, 6, 'iron', 5); c.VL(15, 6, 7, 'wood', 5); c.VL(16, 6, 7, 'wood', 3)
    # 톱
    c.poly([(21, 4), (29, 4), (29, 9), (21, 7)], lambda X, Y: ('iron', 5 if Y < 6 else 4))
    for x in range(21, 29, 2): c.P(x, 8, 'iron', 2)
    c.R(19, 3, 3, 5, 'wood', 4)
    c.HL(1, 14, 30, 'ink', 1)


@R.add('shelf-wall', '벽 선반(약병·단지)', 2, 1, 'wall_mounted', tags=['실내', '벽걸이', '선반'], rules='실험실·약방·선술집 벽면 윗줄.')
def _(c):
    c.R(1, 11, 30, 2, 'wood', 4); c.HL(1, 11, 30, 'wood', 5); c.HL(1, 13, 30, 'wood', 1)
    for x in (3, 27): c.R(x, 13, 2, 2, 'iron', 2)
    for k, (x, m, h) in enumerate(((3, 'verd', 7), (8, 'cloth', 5), (12, 'navy', 8), (17, 'brass', 6), (22, 'verd', 5), (26, 'copper', 7))):
        y0 = 11 - h
        c.R(x, y0 + 2, 3, h - 2, m, 2); c.VL(x, y0 + 2, h - 2, m, 3); c.P(x, y0 + 3, 'steam', 4)
        c.R(x + 1 if h > 6 else x, y0, 1 if h > 6 else 3, 2, 'canvas' if h > 6 else m, 2 if h > 6 else 3)
        c.HL(x, y0 + 2, 3, m, 4 if m != 'navy' else 3)


# ═══════════════════════ 공방 ═══════════════════════
def table_top(c, x, y, w, topn, front, mat='wood', tt=4, ft=2, legs=True):
    box3(c, x, y, w, topn, front, mat, tt=tt, ft=ft)
    if legs:
        for lx in (x + 1, x + w - 3):
            c.R(lx, y + topn + front, 2, 3, mat, ft - 1 if ft > 0 else 0)
        c.HL(x, y + topn + front + 3, w, 'ink', 1)


@R.add('workbench', '공방 작업대(바이스·공구·톱니)', 3, 2, 'low_furniture', tags=['공방', '작업대'], rules='공방 벽 앞(북쪽). 앞(남쪽) 1칸은 비움(서서 일하는 자리).')
def _(c):
    table_top(c, 1, 3, 46, 12, 10, 'wood', tt=4, ft=2, legs=False)
    for x in range(1, 47):
        if (x - 1) % 9 == 8: c.VL(x, 4, 10, 'wood', 3)
    # 서랍 셋(앞면)
    for x0 in (4, 18, 32):
        c.R(x0, 17, 11, 6, 'wood', 3); c.HL(x0, 17, 11, 'wood', 4); c.HL(x0, 22, 11, 'wood', 1)
        c.R(x0 + 4, 19, 3, 1, 'brass', 4)
    c.R(2, 25, 3, 5, 'wood', 1); c.R(43, 25, 3, 5, 'wood', 1); c.HL(1, 30, 46, 'ink', 1)
    # 바이스(왼쪽 끝): 무쇠 턱 + 손잡이
    c.R(3, 4, 8, 6, 'iron', 3); c.HL(3, 4, 8, 'iron', 5); c.R(3, 10, 8, 3, 'iron', 2)
    c.VL(6, 4, 6, 'iron', 1); c.HL(1, 9, 12, 'iron', 4)
    # 망치·렌치·톱니·종이(설계도 조각)
    c.HL(16, 7, 8, 'wood', 5); c.HL(16, 8, 8, 'wood', 2); c.R(24, 5, 3, 5, 'iron', 4); c.HL(24, 5, 3, 'iron', 6)
    c.line(29, 11, 34, 6, 'iron', 5); c.line(30, 11, 35, 6, 'iron', 2)
    c.ell(40, 8, 3.4, 2.4, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3) if d > 0.25 else ('wood', 3))
    for k in range(8):
        a = k * math.pi / 4
        c.P(round(40 + 4.3 * math.cos(a) - 0.5), round(8 + 3.1 * math.sin(a) - 0.5), 'brass', 3)
    c.R(14, 10, 6, 3, 'canvas', 3); c.HL(14, 10, 6, 'canvas', 2)


@R.add('anvil', '나무 그루터기 위 모루(위에서 본 넓은 작업면)', 1, 1, 'other', tags=['공방', '대장간', '모루'], rules='화덕 앞 1칸 띄워.')
def _(c):
    # 그루터기(나이테 윗면 타원 + 껍질 몸)
    c.R(2, 12, 12, 3, 'wood', 2); c.VL(2, 12, 3, 'wood', 3); c.VL(13, 12, 3, 'wood', 1)
    c.ell(8, 12, 6.5, 2.4, lambda X, Y, dx, dy, d: ('wood', 5 if d < 0.3 else 4 if d < 0.75 else 3))
    c.HL(2, 15, 12, 'ink', 1)
    c.R(7, 10, 4, 3, 'iron', 1)                                         # 허리(앞면 그늘 속)
    # 작업면(위에서 본 평면 8행): 오른쪽 사각 몸 + 왼쪽으로 좁아지는 뿔. 왼쪽 위가 가장 밝다.
    c.poly([(0.5, 4.5), (5, 1), (15.5, 1), (15.5, 9), (5, 9), (0.5, 5.5)],
           lambda X, Y: ('iron', 6 if (X + Y < 9) else 5 if X + Y < 17 else 4))
    c.HL(5, 1, 11, 'iron', 3)
    for (x, y) in ((8, 4), (11, 6), (7, 7), (13, 3)): c.P(x, y, 'iron', 4)   # 망치 자국
    c.P(12, 3, 'iron', 1); c.P(13, 4, 'iron', 2)                          # 쇠 구멍
    c.P(9, 5, 'fire', 3); c.P(10, 5, 'fire', 2)
    # 작업면 앞 두께(2행, 어둡게) — 뿔 밑도
    c.R(5, 9, 11, 2, 'iron', 2); c.HL(5, 10, 11, 'iron', 1)
    c.line(1, 6, 5, 9, 'iron', 2); c.line(2, 6, 5, 10, 'iron', 1)


@R.add('lathe', '선반 기계(무쇠 침대 + 주축대 + 심압대)', 3, 2, 'low_furniture', tags=['공방', '선반'], rules='공방 벽 앞. 앞 1칸 비움.')
def _(c):
    # 무쇠 침대(윗면 레일 둘이 보인다)
    box3(c, 6, 10, 36, 6, 6, 'iron', tt=4, ft=2)
    c.HL(6, 11, 36, 'iron', 6); c.HL(6, 14, 36, 'iron', 6); c.HL(6, 12, 36, 'iron', 2)
    # 다리 둘(받침 상자)
    for x0 in (7, 34):
        c.R(x0, 22, 8, 7, 'iron', 2); c.VL(x0, 22, 7, 'iron', 3); c.HL(x0, 22, 8, 'iron', 1)
    c.HL(5, 29, 38, 'ink', 1)
    # 주축대(왼쪽 상자 + 풀리)
    box3(c, 2, 3, 12, 5, 9, 'navy', tt=3, ft=2)
    c.ell(6, 3, 4, 2, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3) if d > 0.3 else ('iron', 2))
    c.R(14, 9, 10, 3, 'iron', 5); c.HL(14, 9, 10, 'iron', 6); c.HL(14, 11, 10, 'iron', 3)       # 깎는 쇠막대
    for x in range(16, 23, 2): c.P(x, 10, 'iron', 3)
    # 공구대 + 심압대
    c.R(24, 7, 5, 5, 'iron', 3); c.HL(24, 7, 5, 'iron', 5)
    box3(c, 33, 5, 8, 4, 6, 'navy', tt=3, ft=2)
    c.R(30, 9, 3, 2, 'iron', 5)
    c.HL(41, 9, 4, 'iron', 4); c.ell(45, 10, 1.5, 2, lambda X, Y, dx, dy, d: ('iron', 3))
    # 쇳밥
    for (x, y) in ((18, 25), (22, 26), (27, 24)): c.P(x, y, 'iron', 5)


@R.add('drill-press', '드릴 프레스(세운 기둥 + 둥근 작업대)', 1, 2, 'tall_furniture', tags=['공방', '드릴'], rules='공방 벽 앞.')
def _(c):
    # 기둥(뒤, 세운 쇠막대)
    c.R(3, 12, 3, 14, 'iron', 4); c.VL(3, 12, 14, 'iron', 5); c.VL(5, 12, 14, 'iron', 2)
    # 머리 윗면(뒤가 좁은 사다리꼴 7행) + 그 위 풀리 통(짧은 세운 원통 — 타원 뚜껑)
    c.poly([(2.5, 1), (13.5, 1), (15, 8), (1, 8)], lambda X, Y: ('iron', 5 if Y > 1 else 3))
    c.HL(1, 7, 14, 'iron', 6)
    for y in range(3, 6):
        c.HL(3, y, 7, 'brass', 3); c.P(3, y, 'brass', 4); c.P(9, y, 'brass', 1)
    c.ell(6.5, 3, 3.5, 1.6, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0.2 else 4) if d < 0.75 else ('brass', 2))
    c.P(6, 3, 'iron', 1)
    c.HL(10, 4, 3, 'canvas', 1); c.HL(10, 5, 3, 'canvas', 1)          # 벨트
    # 머리 앞면(남색 6행)
    c.R(1, 8, 14, 6, 'navy', 2); c.HL(1, 8, 14, 'navy', 3); c.VL(1, 8, 6, 'navy', 3); c.VL(14, 8, 6, 'navy', 1)
    c.HL(1, 13, 14, 'navy', 1)
    for x in range(3, 14, 2): c.P(x, 12, 'brass', 4)
    # 드릴 굴대·척·날 + 손잡이
    c.R(7, 14, 2, 3, 'iron', 5); c.VL(8, 14, 3, 'iron', 3); c.R(6, 17, 4, 1, 'iron', 4); c.P(7, 18, 'iron', 6)
    for (x1, y1) in ((15, 12), (15, 16)):
        c.line(13, 14, x1, y1, 'iron', 5); c.P(x1, y1, 'cloth', 3)
    # 둥근 작업대(위 타원 5행 + 테 두께)
    c.ell(8, 22, 6.5, 2.6, lambda X, Y, dx, dy, d: ('iron', 2))
    c.ell(8, 21, 6.5, 2.6, lambda X, Y, dx, dy, d: ('iron', 6 if (dx < -0.2 and dy < 0) else 5 if d < 0.8 else 4))
    c.P(8, 21, 'iron', 2)
    # 바닥 받침(뒤가 좁은 사다리꼴 윗면 5행 + 앞 2행) + 윗면에 기름통
    c.poly([(2, 24), (14, 24), (15, 29), (1, 29)], lambda X, Y: ('iron', 5 if Y > 24 else 3))
    c.HL(1, 28, 14, 'iron', 6)
    c.R(3, 24, 3, 2, 'iron', 3)
    c.R(1, 29, 14, 2, 'iron', 2); c.HL(1, 30, 14, 'iron', 1)
    c.R(10, 25, 4, 3, 'verd', 2); c.VL(10, 25, 3, 'verd', 3)
    c.ell(12, 25, 2, 1, lambda X, Y, dx, dy, d: ('verd', 4)); c.P(12, 24, 'brass', 4)
    c.HL(0, 31, 16, 'ink', 1)


# ═══════════════════════ 실험실 ═══════════════════════
def flask(c, x, y, liquid, kind='round'):
    """플라스크(유리 몸 + 색 물 + 목 + 반짝)."""
    if kind == 'round':
        c.ell(x + 3, y + 6, 3.2, 3, lambda X, Y, dx, dy, d: ((liquid, 3 if dx < 0 else 2) if dy > -0.1 else ('glass', 4 if dx < 0 else 3)))
        c.R(x + 2, y, 2, 4, 'glass', 4); c.HL(x + 1, y, 4, 'steam', 3)
        c.P(x + 1, y + 5, 'steam', 4)
    else:   # 원뿔(삼각)
        c.poly([(x, y + 9), (x + 2, y + 3), (x + 4, y + 3), (x + 6, y + 9)], lambda X, Y: ((liquid, 3 if X < x + 3 else 2) if Y > y + 5 else ('glass', 4)))
        c.R(x + 2, y, 2, 3, 'glass', 4); c.P(x + 1, y + 7, 'steam', 4)


@R.add('lab-bench', '실험대(플라스크·증류기·놋쇠 버너)', 3, 2, 'low_furniture', tags=['실험실', '실험대'], rules='실험실 가운데 또는 벽 앞. 둘레 1칸 비움.')
def _(c):
    # 윗면(흰 타일 상판) + 앞면(짙은 나무 + 문)
    box3(c, 1, 6, 46, 10, 10, 'canvas', tt=3, fmat='wood', ft=2)
    for x in range(1, 47, 6): c.VL(x, 7, 8, 'canvas', 2)
    c.HL(1, 11, 46, 'canvas', 2)
    for x0 in (4, 26):
        c.R(x0, 19, 18, 6, 'wood', 1); c.HL(x0, 19, 18, 'wood', 3); c.R(x0 + 8, 21, 2, 1, 'brass', 4)
    c.R(2, 26, 3, 4, 'wood', 1); c.R(43, 26, 3, 4, 'wood', 1); c.HL(1, 30, 46, 'ink', 1)
    # 위 물건: 둥근 플라스크 둘, 원뿔 플라스크, 증류기(관), 버너 불, 시험관 대
    flask(c, 4, 2, 'verd'); flask(c, 11, 4, 'cloth', 'cone'); flask(c, 33, 2, 'navy')
    c.line(37, 3, 43, 7, 'glass', 4); c.line(37, 4, 43, 8, 'glass', 3)
    c.R(42, 7, 3, 5, 'glass', 3); c.HL(42, 10, 3, 'navy', 3)
    c.R(21, 9, 5, 4, 'brass', 3); c.HL(21, 9, 5, 'brass', 5); c.P(23, 7, 'fire', 4); c.P(23, 8, 'fire', 3); c.P(22, 8, 'lit', 3)
    c.R(20, 3, 7, 2, 'iron', 4); c.R(21, 1, 5, 2, 'copper', 3); c.HL(21, 1, 5, 'copper', 5)       # 삼발이 위 냄비
    c.R(27, 8, 5, 4, 'wood', 3); c.HL(27, 8, 5, 'wood', 4)
    for (x, m) in ((28, 'verd'), (30, 'cloth')): c.R(x, 4, 1, 5, 'glass', 4); c.VL(x, 6, 3, m, 3)


@anim('tesla-coil', '테슬라 코일(둥근 받침 + 구리 감은 탑 + 꼭대기 놋쇠 도넛 + 불꽃)', 3, 1, 3, 'column', tags=['실험실', '전기'], rules='실험실 모퉁이. 둘레 1칸 비움.', fps=8)
def tesla(c, f):
    # 둥근 받침: 윗면 타원(7행) + 몸 + 먹 선
    c.R(0, 41, 16, 5, 'iron', 3); c.VL(0, 41, 5, 'iron', 4); c.VL(15, 41, 5, 'iron', 1); c.HL(0, 45, 16, 'iron', 1)
    c.ell(8, 41, 8, 3.6, lambda X, Y, dx, dy, d: ('iron', 6 if (dx < -0.2 and dy < -0.1) else 5 if d < 0.8 else 4))
    c.HL(1, 47, 14, 'ink', 1); c.HL(0, 46, 16, 'iron', 1)
    for x in (2, 13): c.P(x, 42, 'brass', 4)
    # 코일 몸(밝은 구리 원통 + 위에서 비스듬히 본 곡선 감은 줄)
    for y in range(15, 40):
        for x in range(3, 13):
            u = (x - 3 + 0.5) / 10
            t = 5 if u < 0.22 else 4 if u < 0.5 else 3 if u < 0.78 else 2
            c.P(x, y, 'copper', t)
    for y0 in range(16, 37, 3):
        for x in range(3, 13):
            u = (x - 3 + 0.5) / 10
            bow = round(2.2 * (1 - (u * 2 - 1) ** 2))
            c.P(x, y0 + bow, 'copper', 1 if u > 0.5 else 2)
    c.ell(8, 39, 5, 1.4, lambda X, Y, dx, dy, d: ('copper', 1) if dy > 0 else None)
    # 꼭대기 도넛(위에서 본 큰 놋쇠 고리 — 넓은 윗면 + 가운데 구멍 + 앞쪽 관 두께) + 가운데 단자
    c.ell(8, 14, 5, 1.5, lambda X, Y, dx, dy, d: ('copper', 5 if dx < 0 else 3))      # 코일 뚜껑
    c.ell(8, 10.5, 7.8, 4, lambda X, Y, dx, dy, d: ('brass', 2 if dy > 0.2 else 3))
    c.ell(8, 9, 7.8, 4, lambda X, Y, dx, dy, d: ('brass', 5 if (dx + dy < -0.4) else 4) if d > 0.28 else ('brass', 1))
    c.ell(8, 9, 7.8, 4, lambda X, Y, dx, dy, d: ('brass', 2) if (d > 0.85 and dy < 0) else None)
    c.VL(8, 6, 3, 'copper', 4); c.P(8, 5, 'lit', 4)
    bolts = [
        [[(2, 7), (1, 4), (2, 2), (0, 0)], [(14, 8), (15, 5), (13, 3), (15, 1)]],
        [[(1, 9), (0, 6), (1, 3), (0, 1)], [(13, 6), (14, 3), (12, 1), (13, 0)], [(14, 11), (15, 13), (14, 15)]],
        [[(3, 6), (2, 3), (4, 1), (3, 0)], [(15, 9), (15, 6), (14, 4), (15, 2)]],
    ]
    for pts in bolts[f]:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for dx, dy in ((1, 0), (0, 1)):
                c.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, 'glass', 4)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            c.line(x0, y0, x1, y1, 'lit', 4)
        c.P(*pts[-1], 'steam', 4)


@R.add('drafting-table', '제도대(설계도 — 선만, 글자 없음)', 2, 2, 'low_furniture', tags=['실험실', '공방', '제도'], rules='창 아래·벽 앞.')
def _(c):
    # 넓은 윗면(뒤가 조금 좁은 사다리꼴 16행) — 나무 결 가로
    c.poly([(4, 2), (28, 2), (31, 18), (1, 18)], lambda X, Y: ('wood', 4 if (Y - 2) % 5 else 3))
    c.HL(4, 2, 24, 'wood', 2); c.HL(1, 17, 30, 'wood', 5)
    # 놓인 설계도(사다리꼴, 남색) — 선만: 큰 톱니 바퀴 윤곽(왼쪽) + 축과 이어진 가로 도면선(오른쪽)
    c.poly([(8, 5), (22, 5), (23, 15), (7, 15)], lambda X, Y: ('navy', 2))
    c.HL(8, 5, 14, 'navy', 3); c.HL(7, 15, 16, 'navy', 1)
    for k in range(16):
        a = k * math.pi / 8
        r = 3.6 if k % 2 == 0 else 2.8
        c.P(round(12 + r * math.cos(a) - 0.5), round(10 + r * 0.8 * math.sin(a) - 0.5), 'steam', 3)
    c.HL(12, 10, 10, 'steam', 2)
    c.HL(17, 7, 5, 'steam', 2); c.HL(17, 13, 5, 'steam', 2); c.VL(21, 7, 7, 'steam', 2)
    # 말린 도면 두 개(누운 원통, 서쪽 끝 원이 보인다)
    for y in (4, 8):
        c.R(2 + (y - 4) // 4, y, 5, 3, 'canvas', 3); c.HL(2, y, 6, 'canvas', 3); c.HL(2, y + 2, 6, 'canvas', 1)
        c.P(2 + (y - 4) // 4, y + 1, 'canvas', 2)
    # 탁상 등(놋쇠 받침 원판 + 팔 + 갓 윗면)
    c.ell(27, 13, 2.5, 1.2, lambda X, Y, dx, dy, d: ('brass', 4))
    c.line(27, 12, 26, 5, 'brass', 3)
    c.ell(24, 5, 3, 1.6, lambda X, Y, dx, dy, d: ('verd', 4 if dx < 0 else 2))
    c.P(24, 7, 'lit', 4); c.P(23, 7, 'lit', 3)
    # 놋쇠 자(T자)
    c.line(9, 16, 20, 16, 'brass', 4)
    # 앞면 3행(서랍) + 다리 + 가로대
    c.R(1, 18, 30, 4, 'wood', 2); c.HL(1, 18, 30, 'wood', 1); c.HL(1, 21, 30, 'wood', 1)
    c.R(12, 19, 8, 2, 'wood', 3); c.P(15, 19, 'brass', 4)
    for x in (2, 28): c.R(x, 22, 2, 8, 'wood', 2); c.VL(x, 22, 8, 'wood', 3)
    c.HL(4, 26, 24, 'wood', 2); c.HL(4, 27, 24, 'wood', 1)
    c.HL(1, 30, 30, 'ink', 1)


def cabinet(c, w, h, top=4, glass=False, fill=None):
    """키 큰 장: 윗면 top 행(밝게, 뒤 어둡게) + 갓 몰딩 + 앞면(문) + 받침 + 먹 선."""
    W, H = w * 16, h * 16
    x, y = 1, 1
    c.R(x, y, W - 2, top, 'wood', 4); c.HL(x, y, W - 2, 'wood', 2); c.HL(x, y + top - 1, W - 2, 'wood', 5)
    c.HL(x - 1, y + top, W, 'wood', 3); c.HL(x - 1, y + top + 1, W, 'wood', 1)           # 갓 몰딩
    fy = y + top + 2; fh = H - fy - 3
    c.R(x, fy, W - 2, fh, 'wood', 2)
    c.VL(x, fy, fh, 'wood', 3); c.VL(x + W - 3, fy, fh, 'wood', 1)
    if fill: fill(c, x + 2, fy + 1, W - 6, fh - 2)
    c.R(x, H - 3, W - 2, 2, 'wood', 1); c.HL(0, H - 1, W, 'ink', 1)
    c.VL(0, y, H - 2, 'ink', 1); c.VL(W - 1, y, H - 2, 'ink', 1); c.HL(x, 0, W - 2, 'ink', 1)


@R.add('curio-cabinet', '진열장(유리문 — 톱니·약병)', 2, 2, 'tall_furniture', tags=['실험실', '여관', '진열장'], rules='벽 앞(벽면 아랫줄에 등을 댄다).')
def _(c):
    def fill(c, x, y, w, h):
        c.R(x, y, w, h, 'glass', 1)
        for sy in (y + 6, y + 13):
            c.HL(x, sy, w, 'wood', 4); c.HL(x, sy + 1, w, 'wood', 1)
        c.VL(x + w // 2, y, h, 'wood', 3)
        c.ell(x + 4, y + 3.5, 2.6, 2.6, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3) if d > 0.25 else ('glass', 1))
        for (bx, m) in ((x + 15, 'verd'), (x + 19, 'cloth'), (x + 22, 'navy')):
            c.R(bx, y + 2, 2, 4, m, 3); c.P(bx, y + 1, 'canvas', 2)
        c.R(x + 3, y + 10, 5, 3, 'copper', 3); c.HL(x + 3, y + 10, 5, 'copper', 5)
        c.ell(x + 19, y + 11, 3, 2, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))
        c.R(x + 2, y + 16, 3, 3, 'canvas', 3); c.R(x + 16, y + 16, 6, 3, 'cloth', 2)
        for i in range(2): c.line(x + 1 + i * 13, y + 1, x + 4 + i * 13, y + 4, 'glass', 4)
    cabinet(c, 2, 2, 4, True, fill)
    c.R(14, 18, 1, 3, 'brass', 5); c.R(17, 18, 1, 3, 'brass', 5)


@R.add('bookshelf', '책장', 2, 2, 'tall_furniture', tags=['실험실', '여관', '서재', '책장'], rules='벽 앞.')
def _(c):
    def fill(c, x, y, w, h):
        c.R(x, y, w, h, 'wood', 0)
        shelves = [y, y + 7, y + 14]
        cols = ('cloth', 'navy', 'verd', 'brass', 'paint', 'copper', 'canvas')
        for k, sy in enumerate(shelves):
            bx = x
            while bx < x + w - 1:
                bw = 2 + h32(bx, k, 3) % 2
                m = cols[h32(bx, k, 5) % len(cols)]
                bh = 5 - h32(bx, k, 7) % 2
                c.R(bx, sy + 6 - bh, bw, bh, m, 2); c.VL(bx, sy + 6 - bh, bh, m, 3)
                c.P(bx, sy + 6 - bh + 1, 'brass', 4) if m not in ('brass', 'canvas') else None
                bx += bw
            c.HL(x, sy + 6, w, 'wood', 4)
    cabinet(c, 2, 2, 4, False, fill)


# ═══════════════════════ 선술집 ═══════════════════════
def mug(c, x, y):
    c.R(x, y + 1, 3, 3, 'iron', 4); c.VL(x, y + 1, 3, 'iron', 5); c.HL(x, y, 3, 'canvas', 3); c.P(x + 3, y + 2, 'iron', 3)


@R.add('bar-counter', '선술집 바(놋쇠 난간 + 잔)', 4, 2, 'low_furniture', tags=['선술집', '바'], rules='선술집 북쪽 벽에서 한 칸 띄워 동서로. 뒤(북쪽)는 바텐더 통로 1칸, 앞에 의자.')
def _(c):
    # 상판(짙게 닦은 나무, 윗면 10행) + 놋쇠 앞 테
    box3(c, 1, 4, 62, 10, 13, 'wood', tt=3, ft=2)
    c.HL(1, 6, 62, 'wood', 4)
    c.HL(1, 13, 62, 'brass', 4); c.HL(1, 14, 62, 'brass', 2)
    # 앞면 판넬
    for x0 in range(4, 60, 12):
        c.R(x0, 17, 9, 8, 'wood', 1); c.HL(x0, 17, 9, 'wood', 3); c.VL(x0, 17, 8, 'wood', 3)
    c.HL(1, 27, 62, 'brass', 4); c.HL(1, 28, 62, 'brass', 1)                   # 발 받침 난간
    c.HL(0, 31, 64, 'ink', 1); c.R(1, 29, 62, 2, 'wood', 1)
    # 위 물건
    for x in (6, 14, 30, 46): mug(c, x, 5)
    for (x, m) in ((22, 'verd'), (25, 'cloth'), (52, 'navy')):
        c.R(x, 4, 2, 6, m, 2); c.VL(x, 4, 6, m, 3); c.R(x, 1, 2, 3, m, 2); c.P(x, 1, 'canvas', 3)
    c.R(38, 7, 5, 3, 'canvas', 3); c.HL(38, 7, 5, 'canvas', 2)
    c.R(56, 5, 4, 4, 'brass', 3); c.HL(56, 5, 4, 'brass', 5); c.R(57, 2, 2, 3, 'brass', 4)   # 맥주 꼭지


@R.add('barrel-rack', '술통 받침대(받침 위 세운 술통 둘 + 꼭지)', 2, 2, 'frame', tags=['선술집', '술통', '지하 창고'], rules='선술집 벽 앞·바 뒤.')
def _(c):
    # 뒤 가로대 + 양옆 기둥(윗면 3행씩)
    c.R(2, 13, 28, 2, 'wood', 2); c.HL(2, 13, 28, 'wood', 3)
    for x0 in (0, 28):
        c.R(x0, 4, 4, 3, 'wood', 5); c.HL(x0, 4, 4, 'wood', 3); c.HL(x0, 6, 4, 'wood', 4)
        c.R(x0, 7, 4, 21, 'wood', 2); c.VL(x0, 7, 21, 'wood', 3); c.VL(x0 + 3, 7, 21, 'wood', 1)
    # 받침 판(윗면 4행 + 앞면)
    c.R(1, 20, 30, 4, 'wood', 4); c.HL(1, 20, 30, 'wood', 3); c.HL(1, 23, 30, 'wood', 5)
    c.R(1, 24, 30, 4, 'wood', 2); c.HL(1, 24, 30, 'wood', 1)
    for x in (8, 23): c.VL(x, 24, 4, 'wood', 1)
    # 세운 술통 둘(위 뚜껑 타원 = 윗면, 곡선 무쇠 테, 앞 놋쇠 꼭지)
    for x0 in (4, 17):
        w = 11
        for j in range(12):
            for i in range(w):
                u = (i + 0.5) / w
                t = 4 if u < 0.3 else 3 if u < 0.65 else 2 if u < 0.88 else 1
                if i in (3, 7): t -= 1
                c.P(x0 + i, 9 + j, 'wood', t)
        c.ell(x0 + w / 2, 21, w / 2, 1.6, lambda X, Y, dx, dy, d: ('wood', 1) if dy > 0 else None)
        ring_band(c, x0, w, 11, 'iron', 4, 2, bow=1.5); ring_band(c, x0, w, 17, 'iron', 4, 2, bow=1.5)
        c.ell(x0 + w / 2, 8.5, w / 2 + 0.3, 4.2, lambda X, Y, dx, dy, d: ('iron', 2 if dy < 0 else 5) if d > 0.74 else ('wood', 5 if (dx + dy < 0.2) else 4))
        c.HL(x0 + 3, 8, 5, 'wood', 3)                                # 뚜껑 판 이음(가로)
        c.P(x0 + 7, 8, 'wood', 1)                                   # 마개
        c.R(x0 + 4, 16, 3, 2, 'brass', 4); c.P(x0 + 4, 16, 'brass', 5); c.P(x0 + 5, 18, 'brass', 2)
    c.HL(0, 28, 32, 'wood', 1); c.HL(0, 31, 32, 'ink', 1)
    for x0 in (0, 28): c.R(x0, 28, 4, 3, 'wood', 1)


@R.add('tavern-table', '선술집 둥근 탁자(잔·촛불)', 2, 2, 'low_furniture', tags=['선술집', '탁자'], rules='선술집 바닥에 2칸씩 띄워 흩어 둔다. 둘레에 의자·걸상.')
def _(c):
    # 둥근 상판(위 타원 14행) + 테 + 기둥 + 받침
    c.ell(16, 11, 14, 8, lambda X, Y, dx, dy, d: ('wood', 5 if (dx < -0.3 and dy < -0.3) else 4 if d < 0.7 else 3))
    c.ell(16, 11, 14, 8, lambda X, Y, dx, dy, d: ('wood', 2) if (d > 0.82 and dy < -0.2) else None)
    for x in range(3, 30):
        y = round(11 + 8 * math.sqrt(max(0, 1 - ((x + 0.5 - 16) / 14) ** 2)))
        c.P(x, y - 1, 'wood', 2); c.P(x, y, 'wood', 1)
    c.R(14, 19, 4, 8, 'wood', 2); c.VL(14, 19, 8, 'wood', 3)
    c.ell(16, 28, 7, 2, lambda X, Y, dx, dy, d: ('wood', 3 if dy < 0 else 1))
    c.HL(9, 31, 14, 'ink', 1)
    mug(c, 9, 8); mug(c, 20, 10)
    c.R(15, 5, 2, 4, 'canvas', 3); c.P(15, 3, 'lit', 4); c.P(15, 4, 'fire', 3); c.R(14, 9, 4, 1, 'brass', 3)


@R.add('stool', '둥근 걸상', 1, 1, 'seat', tags=['선술집', '걸상'], rules='바 앞·탁자 둘레.')
def _(c):
    c.ell(8, 5, 6, 3.5, lambda X, Y, dx, dy, d: ('wood', 5 if (dx < -0.2 and dy < -0.2) else 4 if d < 0.65 else 3))
    c.HL(3, 8, 10, 'wood', 2); c.HL(4, 9, 8, 'wood', 1)
    for x in (4, 11): c.R(x, 9, 1, 6, 'wood', 2)
    c.R(7, 9, 2, 5, 'wood', 1); c.HL(4, 12, 8, 'iron', 3)
    c.HL(3, 15, 10, 'ink', 1)


@R.add('chair', '나무 의자(남향, 등받이 북쪽)', 1, 1, 'seat', tags=['선술집', '여관', '의자'], rules='탁자·책상 북쪽에 남향으로.')
def _(c):
    # 등받이(뒤) + 앉는 판(윗면 4행) + 다리
    c.R(3, 0, 10, 2, 'wood', 4); c.HL(3, 0, 10, 'wood', 5)
    for x in (3, 6, 9, 12): c.VL(x, 2, 5, 'wood', 3 if x < 8 else 2)
    c.R(2, 6, 12, 5, 'wood', 4); c.HL(2, 6, 12, 'wood', 3); c.HL(2, 7, 12, 'wood', 5); c.HL(2, 10, 12, 'wood', 5)
    c.R(2, 11, 12, 2, 'wood', 2)
    for x in (2, 12): c.R(x, 13, 2, 2, 'wood', 1)
    c.HL(2, 15, 12, 'ink', 1)


FL = [  # 벽난로 불꽃 모양(프레임) — (x, 높이)
    [(13, 6), (17, 9), (21, 7), (25, 10), (29, 6), (33, 8)],
    [(13, 8), (17, 6), (21, 10), (25, 7), (29, 9), (33, 6)],
    [(13, 7), (17, 10), (21, 6), (25, 9), (29, 7), (33, 9)],
]


@anim('fireplace', '벽난로(돌 벽난로 + 넓은 선반 + 화덕 바닥 + 불)', 3, 3, 2, 'tall_furniture', tags=['여관', '선술집', '벽난로'], rules='벽면 아랫줄에 등을 댄다. 앞 1칸 비움(깔개·의자는 그 앞).', fps=6)
def fireplace(c, f):
    W = 48
    # 넓은 선반 윗면 7행(뒤 어둡게, 앞 반사) + 선반 앞 두께
    c.R(0, 0, W, 7, 'stone', 5); c.HL(0, 0, W, 'stone', 3); c.HL(0, 1, W, 'stone', 4); c.HL(0, 6, W, 'stone', 6)
    c.R(0, 7, W, 2, 'stone', 3); c.HL(0, 8, W, 'stone', 2)
    # 몸(석재 벽돌)
    c.F(2, 9, 44, 17, lambda wx, wy, i, j: tex_brick(i, j + 1, base=4, mat='stone', s=19, course=5, blen=10))
    # 아궁이: 뒷벽(그을음) + 안쪽 옆벽(왼쪽 밝게) + 안쪽 바닥
    c.R(10, 12, 28, 14, 'coal', 0)
    c.poly([(10, 12), (13, 15), (13, 25), (10, 25)], lambda X, Y: ('stone', 3))
    c.poly([(37, 12), (34, 15), (34, 25), (37, 25)], lambda X, Y: ('stone', 1))
    c.R(13, 15, 21, 7, 'soot', 1); c.HL(13, 15, 21, 'soot', 0)
    c.R(13, 22, 21, 4, 'brick', 2); c.HL(13, 22, 21, 'brick', 1)
    c.HL(10, 12, 28, 'stone', 2)
    # 장작 + 불꽃
    c.R(15, 21, 18, 2, 'wood', 2); c.HL(15, 21, 18, 'wood', 3); c.line(16, 23, 31, 20, 'wood', 1)
    for (x, hgt) in FL[f]:
        x = 14 + (x - 13) * 18 // 20
        for k in range(min(hgt, 8)):
            w = max(1, (hgt - k) // 3 + 1)
            t = 4 if k < 2 else 3 if k < hgt * 0.6 else 2
            c.R(x - w // 2, 21 - k, w, 1, 'fire', t)
    for x in range(14, 34): c.P(x, 24, 'fire', 2 + (x + f) % 2)
    # 선반 위 물건(톱니 시계·촛대·단지 — 윗면 위에 선다)
    c.ell(24, 3, 3, 2.6, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2)); c.P(24, 3, 'canvas', 3)
    for x in (7, 40): c.R(x, 2, 2, 3, 'canvas', 3); c.P(x, 1, 'lit', 4); c.HL(x - 1, 5, 4, 'brass', 3)
    c.R(13, 2, 3, 3, 'verd', 3); c.HL(13, 2, 3, 'verd', 4)
    # 화덕 바닥 석판(앞으로 나온 윗면 4행 + 앞면 1행)
    c.R(0, 26, W, 4, 'stone', 5); c.HL(0, 26, W, 'stone', 3); c.HL(0, 29, W, 'stone', 6)
    for x in (12, 24, 36): c.VL(x, 27, 2, 'stone', 3)
    c.HL(0, 30, W, 'stone', 2); c.HL(0, 31, W, 'ink', 1)


# ═══════════════════════ 여관 ═══════════════════════
@R.add('inn-counter', '여관 접수대(놋쇠 종 + 숙박부)', 3, 2, 'low_furniture', tags=['여관', '접수대'], rules='여관 현관 북쪽. 뒤 1칸 통로, 앞 2칸 비움.')
def _(c):
    box3(c, 1, 4, 46, 10, 13, 'wood', tt=4, ft=2)
    c.HL(1, 13, 46, 'brass', 3)
    for x0 in (4, 18, 32):
        c.R(x0, 17, 12, 9, 'wood', 1); c.HL(x0, 17, 12, 'wood', 3); c.VL(x0, 17, 9, 'wood', 3)
        c.R(x0 + 3, 20, 6, 3, 'wood', 3)
    c.HL(1, 30, 46, 'wood', 1); c.HL(0, 31, 48, 'ink', 1)
    # 숙박부(펼친 책, 글자 없이 옅은 줄)
    c.R(16, 6, 14, 6, 'canvas', 3); c.VL(23, 6, 6, 'canvas', 1); c.HL(16, 11, 14, 'canvas', 2)
    for y in (8, 10): c.HL(17, y, 5, 'canvas', 2); c.HL(25, y, 4, 'canvas', 2)
    # 종(놋쇠 반구) + 열쇠 고리판 + 펜
    c.ell(8, 9, 3, 2.5, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3) if dy < 0.6 else ('brass', 2))
    c.P(8, 6, 'brass', 5); c.HL(5, 11, 7, 'wood', 2)
    c.line(31, 10, 34, 7, 'ink', 2)
    c.R(38, 5, 6, 6, 'wood', 3); c.HL(38, 5, 6, 'wood', 5)
    for (x, y) in ((39, 7), (41, 7), (39, 9), (41, 9)): c.P(x, y, 'brass', 4)


@R.add('bed', '무쇠 틀 침대(누비 이불, 머리판 북쪽)', 2, 3, 'low_furniture', tags=['여관', '객실', '침대'], rules='객실 벽(북쪽)에 머리를 대고. 옆 1칸 비움.')
def _(c):
    W = 32
    # 머리판(무쇠 살 + 놋쇠 꼭지)
    c.HL(2, 2, 28, 'iron', 4); c.HL(2, 3, 28, 'iron', 2)
    for x in range(4, 29, 3): c.VL(x, 4, 6, 'iron', 2)
    for x in (2, 28):
        c.R(x, 1, 2, 12, 'iron', 4); c.VL(x, 1, 12, 'iron', 5)
        c.ell(x + 1, 1, 1.6, 1.6, lambda X, Y, dx, dy, d: ('brass', 5))
    # 매트 윗면 + 베개 + 이불(누비 사각)
    c.R(3, 9, 26, 31, 'canvas', 3)
    c.R(5, 10, 22, 7, 'canvas', 3); c.HL(5, 10, 22, 'canvas', 2); c.HL(6, 11, 20, 'steam', 4)
    c.HL(5, 16, 22, 'canvas', 1)
    for y in range(18, 40):
        for x in range(3, 29):
            q = ((x - 3) // 6 + (y - 18) // 6) % 2
            t = 3 if q else 2
            if (x - 3) % 6 == 0 or (y - 18) % 6 == 0: t = 1
            c.P(x, y, 'cloth', t)
    c.HL(3, 18, 26, 'cloth', 3)
    c.VL(3, 18, 22, 'cloth', 3)
    # 앞면(이불 늘어진 옆) + 발판
    c.R(3, 40, 26, 3, 'cloth', 1); c.HL(3, 40, 26, 'cloth', 2)
    c.HL(2, 43, 28, 'iron', 4); c.HL(2, 44, 28, 'iron', 2)
    for x in (2, 28): c.R(x, 38, 2, 9, 'iron', 4); c.VL(x, 38, 9, 'iron', 5)
    c.HL(1, 47, 30, 'ink', 1)
    c.VL(2, 9, 29, 'iron', 3); c.VL(29, 9, 29, 'iron', 2)


@R.add('wardrobe', '옷장(두 문, 놋쇠 손잡이)', 2, 2, 'tall_furniture', tags=['여관', '객실', '옷장'], rules='객실 벽 앞.')
def _(c):
    def fill(c, x, y, w, h):
        for x0 in (x, x + w // 2 + 1):
            c.R(x0, y, w // 2 - 1, h, 'wood', 3); c.HL(x0, y, w // 2 - 1, 'wood', 4); c.VL(x0, y, h, 'wood', 4)
            c.R(x0 + 2, y + 2, w // 2 - 5, h - 4, 'wood', 2); c.HL(x0 + 2, y + h - 3, w // 2 - 5, 'wood', 4)
        c.VL(x + w // 2, y, h, 'ink', 2)
        c.R(x + w // 2 - 2, y + h // 2, 1, 3, 'brass', 5); c.R(x + w // 2 + 2, y + h // 2, 1, 3, 'brass', 5)
    cabinet(c, 2, 2, 4, False, fill)


@R.add('nightstand', '침대 곁 탁자(기름등)', 1, 1, 'low_furniture', tags=['여관', '객실'], rules='침대 머리 옆.')
def _(c):
    box3(c, 2, 5, 12, 4, 6, 'wood', tt=4, ft=2)
    c.R(5, 11, 6, 2, 'wood', 1); c.P(7, 11, 'brass', 4)
    c.HL(2, 15, 12, 'ink', 1)
    # 기름등: 놋쇠 받침 + 유리 굴뚝(불빛)
    c.R(5, 4, 5, 2, 'brass', 3); c.HL(5, 4, 5, 'brass', 5)
    c.R(6, 0, 3, 4, 'lit', 3); c.P(7, 1, 'lit', 4); c.VL(6, 0, 4, 'glass', 4)


@R.add('dresser', '서랍장(거울 없음, 위에 단지)', 2, 2, 'tall_furniture', tags=['여관', '객실', '서랍장'], rules='객실 벽 앞.')
def _(c):
    # 낮은 서랍장이지만 키 큰 가구 자리: 윗면 6행 + 서랍 넷
    box3(c, 1, 8, 30, 6, 16, 'wood', tt=4, ft=2)
    for k in range(4):
        y = 15 + k * 4
        c.R(3, y, 26, 3, 'wood', 3); c.HL(3, y, 26, 'wood', 4)
        for x in (9, 22): c.R(x, y + 1, 2, 1, 'brass', 5)
    c.R(2, 30, 3, 1, 'wood', 1); c.R(27, 30, 3, 1, 'wood', 1); c.HL(1, 31, 30, 'ink', 1)
    # 위 물건: 단지·촛대·작은 상자
    c.ell(7, 8, 3, 1.4, lambda X, Y, dx, dy, d: ('canvas', 3))
    c.R(5, 3, 5, 6, 'verd', 2); c.VL(5, 3, 6, 'verd', 3); c.HL(5, 3, 5, 'verd', 4)
    c.R(15, 2, 2, 7, 'brass', 3); c.P(15, 1, 'lit', 4); c.R(13, 9, 6, 1, 'brass', 4)
    c.R(21, 6, 7, 4, 'cloth', 2); c.HL(21, 6, 7, 'cloth', 3); c.R(24, 7, 1, 1, 'brass', 5)


# ═══════════════════════ 짐·계단 ═══════════════════════
@R.add('crate-in', '작은 나무 상자', 1, 1, 'box', tags=['실내', '상자', '창고'], rules='벽 모퉁이·선반 옆.')
def _(c):
    box3(c, 1, 1, 14, 6, 8, 'wood', tt=4, ft=2)
    for x in (5, 10): c.VL(x, 2, 4, 'wood', 3)
    c.line(2, 8, 13, 13, 'wood', 3)
    for (px_, py) in ((1, 1), (13, 1), (1, 13), (13, 13)): c.R(px_, py, 2, 2, 'iron', 4)
    c.HL(1, 15, 14, 'ink', 1)


@R.add('sack', '곡식 자루(주둥이를 접어 연, 낟알이 보인다)', 1, 1, 'box', tags=['실내', '자루', '창고'], rules='창고·부엌 벽 앞에 두세 개.')
def _(c):
    # 몸(네모난 자루, 앞면 아래로 갈수록 어둡게, 옆 주름)
    c.R(2, 6, 12, 8, 'canvas', 2); c.VL(2, 6, 8, 'canvas', 3); c.VL(13, 6, 8, 'canvas', 1)
    c.HL(3, 13, 10, 'canvas', 1); c.P(5, 10, 'canvas', 1); c.P(10, 9, 'canvas', 1); c.P(11, 11, 'canvas', 1)
    c.HL(5, 8, 6, 'cloth', 2)                                   # 붉은 띠(무늬 없이)
    # 접은 주둥이(윗면 테 6행) + 안에 낟알
    c.ell(8, 4.5, 6.5, 3.4, lambda X, Y, dx, dy, d: ('canvas', 3 if (dx < 0 and dy < 0) else 2))
    c.ell(8, 4.5, 4.6, 2.2, lambda X, Y, dx, dy, d: ('brass', 4 if (dx < -0.2 and dy < 0) else 3 if d < 0.6 else 2))
    for (x, y) in ((6, 4), (9, 5), (8, 3)): c.P(x, y, 'brass', 5)
    c.HL(2, 7, 12, 'canvas', 1)
    c.HL(2, 14, 12, 'canvas', 1); c.HL(2, 15, 12, 'ink', 1)


def stairs(c, down=False):
    if not down:
        # 북쪽으로 오르는 나무 계단: 디딤판(윗면 밝게) + 챌판(어둡게), 위로 갈수록 좁게 보인다
        # 위층 어둠(맨 위) → 디딤판 6단(앞 모서리 밝게, 아래 챌판 그늘). 위 단일수록 높아 빛이 더 닿는다.
        c.R(4, 0, 24, 6, 'coal', 0); c.HL(4, 5, 24, 'coal', 1)
        y = 6
        for k in range(6):
            hi = 5 if k < 3 else 4
            c.HL(4, y, 24, 'wood', hi); c.R(4, y + 1, 24, 2, 'wood', hi - 1)
            for x in range(6 + k * 3 % 7, 28, 7): c.P(x, y + 1 + k % 2, 'wood', hi - 2)
            c.HL(4, y + 3, 24, 'wood', 1)
            y += 4
        # 옆판(돌) + 놋쇠 난간
        for x0, t in ((0, 4), (28, 2)):
            c.R(x0, 0, 4, 32, 'stone', t); c.VL(x0, 0, 32, 'stone', t + 1); c.VL(x0 + 3, 0, 32, 'stone', t - 2)
            c.HL(x0, 0, 4, 'stone', 6)
            for yy in range(3, 30, 6): c.P(x0 + 1, yy, 'stone', t - 1)
            c.VL(x0 + 1, 1, 30, 'brass', 4 if x0 == 0 else 3); c.VL(x0 + 2, 1, 30, 'brass', 2)
        c.HL(0, 31, 32, 'ink', 1)
    else:
        # 바닥 구멍 + 내려가는 돌계단(아래로 갈수록 어둡게) + 돌 테
        c.R(0, 0, 32, 32, 'stone', 4)
        c.R(3, 3, 26, 27, 'coal', 0)
        y = 4
        for k, (tread, riser) in enumerate(((4, 2), (4, 2), (3, 2), (3, 2), (3, 1))):
            t = max(1, 5 - k)
            c.R(4, y, 24, tread, 'stone', t); c.HL(4, y, 24, 'stone', min(6, t + 1))
            y += tread
            c.R(4, y, 24, riser, 'stone', max(0, t - 3)); y += riser
        c.HL(2, 2, 28, 'stone', 6); c.VL(2, 2, 28, 'stone', 5); c.VL(29, 2, 28, 'stone', 2); c.HL(2, 29, 28, 'stone', 3)
        c.HL(0, 0, 32, 'stone', 3); c.HL(3, 3, 26, 'ink', 1)


@R.add('stairs-up', '오르는 나무 계단(북쪽으로)', 2, 2, 'terrain', tags=['실내', '계단'], rules='방 북쪽 벽 앞 2×2. 맨 위 줄이 이동 칸(위층으로).')
def _(c): stairs(c)


@R.add('stairs-down', '내려가는 돌계단(바닥 구멍)', 2, 2, 'terrain', tags=['실내', '계단', '지하'], rules='바닥 한가운데가 아닌 벽 곁 2×2. 이동 칸은 구멍 칸.')
def _(c): stairs(c, down=True)


GLOW = {'ink', 'lit', 'fire', 'steam', 'glass'}


def rim(c):
    """실루엣 가장자리(위·옆, 4이웃 투명)를 제 재질 가장 어두운 단으로 — 나무 바닥 위에서도 가구 윤곽이 서게. 빛·불·김·유리는 그대로."""
    m0 = c.m.copy(); pts = []
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] < 0: continue
            up = y == 0 or m0[y - 1, x] < 0
            lf = x == 0 or m0[y, x - 1] < 0
            rt = x == c.w - 1 or m0[y, x + 1] < 0
            if up or lf or rt: pts.append((x, y))
    for x, y in pts:
        g = c.get(x, y)
        if g[0] not in GLOW: c.P(x, y, g[0], 0)


for _it in R.items:
    if _it['kind'] not in ('terrain', 'flat'):
        _it['draw'] = (lambda fn: lambda c: (fn(c), rim(c)))(_it['draw'])


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'interior', 'preview.png'), z=z, W=2000, bg=(58, 52, 56))


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'interior', len(ANIM), 'anims')
