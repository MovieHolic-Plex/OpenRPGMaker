#!/usr/bin/env python3
"""prehistoric 소품 — 모닥불·화톳불·꼬치 굽기·건조대·가죽 틀·항아리·바구니·장작·창 걸이·맷돌·통나무 의자·돌 의자,
선돌·고인돌·돌 둘레(환상 열석)·토템·머리뼈 장대·북·횃불 말뚝·제단 돌, 뼈 더미·매머드 머리뼈·갈비뼈 화석·공룡 머리뼈·긴 목 뼈대·화석 바위,
타르 웅덩이·증기 구멍·작은 화산, 밧줄 다리·뗏목·통나무배·통나무 울타리.

움직이는 조각(불·타르 거품·증기)은 프레임마다 따로 등록한다(id-f1, id-f2). 첫 프레임 = 정지 그림.

  python3 props.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, NT, MI
from kit import Reg, contact, OUT
from shapes import seeds, near2, rock_px, rock_hill, lit, tusk_arc
from nature import boulder, foliage

R = Reg('props')
ANIM = []


def done(c):
    c.outline(bottom=('ink', 1))


def ell(c, cx, cy, rx, ry, fn):
    c.ell(cx, cy, rx, ry, fn)


# ═══════════════════════ 기본 부품 ═══════════════════════
def post(c, x, top, bot, w=3, mat='bark', cap=True):
    """세운 기둥: 앞면(왼쪽 빛) + 윗면 자른 단면(타원, 나이테 점)."""
    n = NT[MI[mat]]
    for y in range(top + 2, bot + 1):
        for i in range(w):
            u = (i + 0.5) / w
            c.P(x + i, y, mat, max(0, min(n - 1, (n - 3) + (1 if u < 0.34 else 0 if u < 0.67 else -1))))
    if cap:
        for i in range(w):
            c.P(x + i, top, mat, n - 2); c.P(x + i, top + 1, mat, n - 1 if i < w - 1 else n - 2)
        if w >= 3: c.P(x + w // 2, top + 1, mat, n - 3)


def beam(c, x0, x1, y, mat='bark', th=3):
    """가로 들보(통나무): 윗면 한 줄 밝게 + 앞면 + 밑 그늘."""
    n = NT[MI[mat]]
    for x in range(x0, x1 + 1):
        c.P(x, y, mat, n - 1); c.P(x, y + 1, mat, n - 2)
        for k in range(2, th): c.P(x, y + k, mat, n - 3 - (k == th - 1))
        if (x - x0) % 5 == 3: c.P(x, y + 1, mat, n - 3)


def stone_ring(c, cx, cy, rx, ry, s=0, inner=None):
    """둥근 돌 테(위에서 본 타원): 돌마다 윗면 밝게, 앞쪽 돌은 앞면이 보인다. inner(x, y, dx, dy) 로 속을 칠한다."""
    if inner:
        c.ell(cx, cy, rx - 2, ry - 1.5, lambda x, y, dx, dy, d: inner(x, y, dx, dy))
    nst = max(8, int((rx + ry) * 1.1))
    for k in range(nst):
        a = 2 * math.pi * k / nst + 0.3
        sx, sy = cx + math.cos(a) * (rx - 1), cy + math.sin(a) * (ry - 1)
        front = math.sin(a) > 0.2
        r1 = 1.6 + (h32(k, 1, s) % 2) * 0.5
        for y in range(int(sy - 2), int(sy + 3)):
            for x in range(int(sx - 2), int(sx + 3)):
                dx, dy = (x + 0.5 - sx) / r1, (y + 0.5 - sy) / (r1 * 0.85)
                if dx * dx + dy * dy > 1: continue
                t = 5 if dx + dy < -0.5 else 4 if dy < 0.2 else 2 if front else 3
                c.P(x, y, 'stone', t)
        if front: c.P(round(sx), round(sy + r1), 'stone', 1)


def flame(c, cx, by, h, w, f=0, s=0):
    """불꽃: 밑이 넓고 위로 갈라지는 혀, 속은 밝게(노랑) → 겉은 붉게. f = 프레임(혀 끝이 흔들린다)."""
    for y in range(by - h, by + 1):
        k = (by - y) / max(1, h)
        half = w * (1 - k) ** 0.8 * (1 + 0.2 * math.sin(k * 7 + f * 2.1))
        sway = math.sin(k * 4 + f * 1.7 + s) * k * 2.2
        for x in range(int(cx - half - 1), int(cx + half + 2)):
            dx = (x + 0.5 - cx - sway) / max(0.6, half)
            if abs(dx) > 1: continue
            core = abs(dx) < 0.45 and k < 0.7
            t = 4 if core and k < 0.4 else 3 if core else 2 if abs(dx) < 0.8 else 1
            if k > 0.8: t = min(t, 2)
            c.P(x, y, 'fire', t)
    # 튀는 불티
    for (dx, dy) in (((f * 3 + s) % 5 - 2, -h - 2), ((f * 2 + 3) % 4 - 1, -h - 5)):
        c.P(int(cx + dx), by + dy, 'fire', 3)


def logs_cross(c, cx, cy, ln=5):
    """모닥불 장작(엇갈린 두 통나무, 윗면 밝게, 끝은 탄 숯)."""
    for (dx0, dy0, dx1, dy1) in ((-ln, 1, ln, -1), (-ln, -1, ln, 1)):
        c.line(cx + dx0, cy + dy0, cx + dx1, cy + dy1, 'bark', 3)
        c.line(cx + dx0, cy + dy0 + 1, cx + dx1, cy + dy1 + 1, 'bark', 1)
        c.P(cx + dx0, cy + dy0, 'basalt', 1); c.P(cx + dx1, cy + dy1, 'fire', 2)


# ═══════════════════════ 불 ═══════════════════════
def firepit(c, f=0):
    cx, cy = 8, 10
    stone_ring(c, cx, cy, 7.5, 5, s=1, inner=lambda x, y, dx, dy: ('ash', 1 if dy < -0.2 else 2) if rnd(x, y, 5) > 0.2 else ('fire', 1))
    logs_cross(c, cx, cy + 1, 4)
    flame(c, cx, cy + 1, 9, 3.2, f=f, s=1)
    done(c)


def bonfire(c, f=0):
    cx, cy = 16, 22
    stone_ring(c, cx, cy, 14, 8, s=3, inner=lambda x, y, dx, dy: ('ash', 1 if dy < 0 else 2) if rnd(x, y, 6) > 0.25 else ('fire', 1 + (rnd(x, y, 7) > 0.6)))
    # 세운 장작 원뿔(가운데로 기댄 통나무 다섯)
    for k, (bx, tx) in enumerate(((7, 15), (11, 16), (16, 16), (21, 17), (25, 17))):
        c.line(bx, cy + 4, tx, cy - 10, 'bark', 3 if k < 2 else 2)
        c.line(bx + 1, cy + 4, tx + 1, cy - 10, 'bark', 1)
    flame(c, cx, cy + 3, 22, 7, f=f, s=2)
    flame(c, cx - 5, cy + 3, 12, 3, f=f + 1, s=4)
    flame(c, cx + 5, cy + 3, 13, 3, f=f + 2, s=5)
    done(c)


for base, nm, fn, w, h, kind, tags, rules in (
        ('firepit', '모닥불(돌 테)', firepit, 1, 1, 'container', ['불', '모닥불', '마을'], '움집 앞·동굴 앞 빈터. 둘레 한 칸을 비우고 통나무 의자를 둘러 둔다.'),
        ('bonfire', '큰 화톳불(돌 테 + 세운 장작)', bonfire, 2, 2, 'container', ['불', '광장', '의식'], '마을 한가운데 광장. 둘레 두 칸을 비우고 돌 의자·북·토템을 둘러 둔다.')):
    ids = []
    for fr in range(3):
        i = base if fr == 0 else '%s-f%d' % (base, fr)
        R.add(i, nm + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), w, h, kind, tags=tags, rules=rules)(lambda c, fn=fn, fr=fr: fn(c, fr))
        ids.append(i)
    ANIM.append((base, nm, ids, 6))


def torch(c, f=0):
    post(c, 6, 12, 30, w=4)
    # 횃불 머리: 감은 짚 + 불
    for y in range(9, 14):
        for x in range(5, 11): c.P(x, y, 'thatch', 3 if x < 8 else 2)
    c.HL(5, 11, 6, 'bark', 1)
    flame(c, 8, 9, 8, 2.6, f=f, s=3)
    done(c)


ids = []
for fr in range(3):
    i = 'torch' if fr == 0 else 'torch-f%d' % fr
    R.add(i, '횃불 말뚝' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 2, 'column', tags=['불', '횃불', '길'],
          rules='길가·동굴 입구 양옆·제단 둘레. 문 앞을 막지 않는다.')(lambda c, fr=fr: torch(c, fr))
    ids.append(i)
ANIM.append(('torch', '횃불 말뚝', ids, 6))


@R.add('spit-roast', '고기 꼬치 굽기(Y 기둥 + 꼬챙이)', 2, 1, 'frame', tags=['불', '요리', '고기'], rules='모닥불 곁. 사람이 둘러앉을 칸을 남긴다.')
def _(c):
    stone_ring(c, 16, 11, 9, 4, s=4, inner=lambda x, y, dx, dy: ('fire', 2 if rnd(x, y, 1) < 0.5 else 1) if dy < 0.3 else ('ash', 2))
    for x in (3, 26):
        post(c, x, 2, 14, w=3)
        c.P(x - 1, 1, 'bark', 4); c.P(x + 3, 1, 'bark', 3)
    beam(c, 3, 29, 3, th=2)
    # 고기 덩이(위가 노릇하게 구워졌다)
    for y in range(4, 10):
        for x in range(10, 23):
            dx = (x + 0.5 - 16.5) / 6.5; dy = (y + 0.5 - 6.5) / 3
            if dx * dx + dy * dy <= 1: c.P(x, y, 'ochre', 4 if dy < -0.3 else 3 if dx < 0.3 else 2)
    c.HL(12, 5, 6, 'thatch', 4); c.P(14, 7, 'feather', 1); c.P(19, 6, 'feather', 1)
    done(c)


def rack(c, items, w=32, s=0):
    """건조대: 양 끝 기둥 둘 + 위 들보 + 걸린 것들(items: (x, kind))."""
    post(c, 2, 4, 30, w=3); post(c, w - 5, 4, 30, w=3)
    beam(c, 1, w - 2, 5, th=3)
    beam(c, 1, w - 2, 16, th=2)
    for (x, kind) in items:
        if kind == 'hide':
            for y in range(8, 22):
                k = y - 8
                for i in range(7):
                    if (k > 11 and i in (0, 6)) or (k > 12 and i in (1, 5)): continue
                    c.P(x + i, y, 'hide', 4 if i < 2 else 3 if i < 5 else 2)
            c.HL(x, 8, 7, 'hide', 5)
        elif kind == 'fish':
            for j in range(3):
                fx = x + j * 3
                for y in range(18, 27): c.P(fx, y, 'water', 4 if y < 21 else 3); c.P(fx + 1, y, 'water', 2)
                c.P(fx, 27, 'water', 1); c.P(fx + 1, 27, 'water', 1); c.P(fx, 17, 'bark', 2)
        elif kind == 'fur':
            for y in range(8, 18):
                for i in range(6): c.P(x + i, y, 'fur', 4 if i < 2 else 3 if (i + y) % 2 else 2)
        elif kind == 'herb':
            for y in range(18, 25):
                for i in range(4): c.P(x + i, y, 'grass', 4 if i < 2 else 2) if (y + i) % 3 else c.P(x + i, y, 'thatch', 3)


@R.add('drying-rack', '가죽 말리는 건조대', 2, 2, 'frame', tags=['건조대', '가죽', '마을'], rules='움집 곁·동굴 앞. 앞 한 칸을 비운다.')
def _(c):
    rack(c, [(7, 'hide'), (18, 'fur'), (8, 'fish'), (19, 'herb')]); done(c)


@R.add('fish-rack', '생선 말리는 건조대', 2, 2, 'frame', tags=['건조대', '생선', '물가'], rules='물가 마을.')
def _(c):
    rack(c, [(6, 'fish'), (16, 'fish'), (6, 'herb'), (20, 'hide')]); done(c)


@R.add('hide-frame', '가죽 펴는 틀', 2, 2, 'frame', tags=['가죽', '작업'], rules='작업터. 앞 한 칸을 비운다.')
def _(c):
    # 네모 틀(위·아래 들보 윗면이 보인다) + 끈으로 당긴 가죽
    post(c, 2, 3, 30, w=3); post(c, 27, 3, 30, w=3)
    beam(c, 1, 30, 4, th=3); beam(c, 1, 30, 25, th=3)
    for y in range(9, 24):
        for x in range(7, 25):
            dx = (x + 0.5 - 16) / 9; dy = (y + 0.5 - 16) / 7.5
            if dx * dx * 0.7 + dy * dy > 1: continue
            c.P(x, y, 'hide', 4 if dx + dy < -0.6 else 3 if dx < 0.4 else 2)
    for (x0, y0, x1, y1) in ((5, 8, 8, 10), (27, 8, 24, 10), (5, 24, 8, 22), (27, 24, 24, 22), (16, 7, 16, 9), (16, 24, 16, 23)):
        c.line(x0, y0, x1, y1, 'thatch', 2)
    # 추상 물감 무늬(동그라미 셋)
    for (x, y) in ((12, 14), (16, 18), (20, 14)): c.P(x, y, 'ochre', 2); c.P(x + 1, y, 'ochre', 3)
    done(c)


@R.add('pots', '흙 항아리 셋', 1, 1, 'container', tags=['항아리', '살림'], rules='움집 곁·동굴 안 벽가.')
def _(c):
    for (cx, by, r, h) in ((5, 14, 3.6, 8), (11, 14, 3.2, 7), (8, 15, 3, 5)):
        for y in range(by - h, by + 1):
            k = (y - (by - h)) / h
            half = r * (0.75 + 0.35 * math.sin(math.pi * k))
            for x in range(int(cx - half), int(cx + half) + 1):
                u = (x - (cx - half) + 0.5) / (2 * half + 1)
                c.P(x, y, 'ochre', max(0, min(4, 3 + lit(u))))
        # 아가리(위에서 본 타원, 안 어둡게)
        top = by - h
        for x in range(int(cx - r * 0.7), int(cx + r * 0.7) + 1):
            c.P(x, top - 1, 'ochre', 4); c.P(x, top, 'ink', 1); c.P(x, top + 1, 'ochre', 1)
        c.P(int(cx - r * 0.7), top, 'ochre', 3); c.P(int(cx + r * 0.7), top, 'ochre', 2)
        c.HL(int(cx - r * 0.5), by - h // 2, int(r), 'ochre', 1)
    done(c)


@R.add('basket', '곡식 바구니', 1, 1, 'container', tags=['바구니', '살림', '채집'], rules='움집 곁·건조대 곁.')
def _(c):
    cx, top, by = 8, 4, 14
    for y in range(top + 2, by + 1):
        k = (y - top) / (by - top)
        half = 6 - k * 1.5
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half) + 0.5) / (2 * half + 1)
            t = 3 + lit(u) - (1 if (x + y) % 2 == 0 else 0)
            if (y - top) % 3 == 0: t -= 1
            c.P(x, y, 'thatch', max(0, min(5, t)))
    c.ell(cx, top + 2, 6, 2.6, lambda x, y, dx, dy, d: ('thatch', 5) if d > 0.6 else ('bloom', 2 if (x + y) % 2 else 3) if dy > -0.4 else ('thatch', 1))
    done(c)


@R.add('woodpile', '장작더미', 2, 1, 'organic', tags=['장작', '살림'], rules='움집 옆 벽가.')
def _(c):
    for row, (y, x0, n_) in enumerate(((10, 2, 6), (6, 4, 5), (2, 7, 3))):
        for k in range(n_):
            cx, cy = x0 + k * 4 + 2, y + 2
            for j in range(-2, 3):
                for i in range(-2, 3):
                    if i * i + j * j > 5: continue
                    t = 5 if i + j < -1 else 4 if i * i + j * j < 2 else 3 if i < 1 else 2
                    c.P(cx + i, cy + j, 'bark', t)
            c.P(cx, cy, 'bark', 3)
            # 통나무 몸(뒤로 뻗는다 — 윗면 줄)
    for x in range(1, 31):
        if not c.get(x, 14): continue
        c.P(x, 15, 'bark', 1)
    done(c)


@R.add('spear-rack', '창 걸이(돌창)', 2, 1, 'frame', tags=['창', '사냥', '무기'], rules='족장 집·사냥꾼 움집 앞 벽가.')
def _(c):
    post(c, 2, 4, 15, w=3); post(c, 27, 4, 15, w=3)
    beam(c, 1, 30, 5, th=3)
    for k, x in enumerate((7, 11, 15, 19, 23)):
        c.VL(x, 0, 15, 'bark', 4 if k % 2 else 3)
        c.P(x, 0, 'basalt', 4); c.P(x - 1, 1, 'basalt', 3); c.P(x + 1, 1, 'basalt', 2); c.P(x, 1, 'basalt', 5); c.P(x, 2, 'basalt', 2)
        c.P(x, 4, 'thatch', 3)
    done(c)


@R.add('quern', '맷돌(갈판 + 갈돌)', 1, 1, 'low_furniture', tags=['맷돌', '살림', '곡식'], rules='움집 앞 작업터.')
def _(c):
    # 납작한 갈판: 위에서 보이는 오목한 윗면 + 앞면 두께
    for y in range(4, 11):
        for x in range(1, 15):
            dx = (x + 0.5 - 8) / 7; dy = (y + 0.5 - 7.5) / 3.6
            if dx * dx + dy * dy > 1: continue
            t = 5 if dy < -0.5 else 4
            if dx * dx + dy * dy < 0.4: t = 3
            c.P(x, y, 'stone', t)
    for x in range(2, 14):
        for y in range(11, 14): c.P(x, y, 'stone', 3 if x < 7 else 2 if y < 13 else 1)
    for x in range(4, 12): c.P(x, 6, 'stone', 6 if x < 8 else 5); c.P(x, 7, 'stone', 4)
    c.HL(5, 8, 4, 'bone', 4)
    done(c)


@R.add('log-seat', '통나무 의자', 2, 1, 'seat', tags=['의자', '모닥불'], rules='모닥불 둘레(불에서 한 칸 띄워).')
def _(c):
    for x in range(1, 31):
        for y in range(5, 12):
            t = 5 if y == 5 else 4 if y < 8 else 3 if y < 10 else 1
            if y in (6, 7) and (x * 3) % 7 == 0: t = 3
            c.P(x, y, 'bark', t)
    c.ell(2.5, 8.5, 2.4, 3.5, lambda x, y, dx, dy, d: ('thatch', 4 if d < 0.4 else 3) if d < 0.75 else ('bark', 2))
    c.ell(29.5, 8.5, 2.4, 3.5, lambda x, y, dx, dy, d: ('bark', 2))
    for (x, y) in ((8, 12), (22, 12)): c.P(x, y, 'bark', 1)
    done(c)


@R.add('stone-seat', '돌 의자', 1, 1, 'seat', tags=['의자', '돌'], rules='모닥불·화톳불 둘레.')
def _(c):
    boulder(c, 8, 9, 6.5, 5.2, s=7, top=0.75); done(c)


# ═══════════════════════ 선돌·고인돌·토템 ═══════════════════════
def standing_stone(c, cx, top, bot, w, s=0, mat='stone', carve=False, clean=False):
    n = NT[MI[mat]]
    for y in range(top, bot + 1):
        k = (y - top) / max(1, bot - top)
        half = w / 2 * (0.82 + 0.18 * k) + (0.6 if 0.2 < k < 0.7 else 0)
        if y - top < 2: half -= 1
        for x in range(int(round(cx - half)), int(round(cx + half)) + 1):
            u = (x - (cx - half) + 0.5) / (2 * half + 1)
            t = n - 3 + (1 if u < 0.3 else 0 if u < 0.65 else -1)
            if y - top < 4:
                t = n - 1 if u < 0.6 else n - 2                       # 위에서 보이는 윗면(자른 면)
                if y - top == 3: t = n - 4
            elif not clean and rnd(x // 2, y // 3, s) < 0.12: t -= 1
            elif clean and (y - top) % 7 == 5 and u > 0.3: t -= 1
            c.P(x, y, mat, max(1, min(n - 1, t)))
    if carve:
        for (dx, dy) in ((0, 0), (1, 1), (0, 2), (-1, 3), (0, 4), (1, 5)): c.P(int(cx) + dx, top + 8 + dy, 'ochre', 2)
        c.ell(cx, top + 18, 2.4, 2, lambda x, y, dx, dy, d: ('ochre', 2) if d > 0.45 else None)


@R.add('menhir', '선돌', 1, 2, 'column', tags=['선돌', '돌', '의식'], rules='돌 둘레·길목·무덤 곁.')
def _(c):
    standing_stone(c, 8, 4, 29, 10, s=1); done(c)


@R.add('menhir-tall', '큰 선돌(황토 무늬)', 1, 3, 'column', tags=['선돌', '돌', '의식'], rules='마을 입구·의식터.')
def _(c):
    standing_stone(c, 8, 3, 45, 12, s=2, carve=True); done(c)


@R.add('stone-circle', '돌 둘레(환상 열석)', 4, 3, 'structure', tags=['선돌', '의식', '돌 둘레'], rules='의식터 가운데. 가운데 칸은 걸을 수 있다(바닥 위층 조각).')
def _(c):
    cx, cy, rx, ry = 32, 26, 26, 14
    order = sorted(range(10), key=lambda k: math.sin(2 * math.pi * k / 10))
    for k in order:
        a = 2 * math.pi * k / 10 + 0.15
        sx, sy = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        hgt = 14 + h32(k, 3, 4) % 5
        standing_stone(c, sx, int(sy - hgt), int(sy), 7, s=k, clean=True)
    done(c)


@R.add('dolmen', '고인돌', 3, 2, 'structure', tags=['고인돌', '돌', '무덤'], rules='언덕·의식터 가장자리.')
def _(c):
    for x in (6, 36):
        standing_stone(c, x + 3, 12, 30, 7, s=x)
    # 덮개돌: 넓은 윗면(위에서 보인다) + 두꺼운 앞면
    for y in range(3, 16):
        for x in range(1, 47):
            e = abs((x + 0.5 - 24) / 23)
            if y < 3 + int(e ** 3 * 4) or y > 15 - int(e ** 3 * 3): continue
            top = y < 11 - int(e ** 3 * 3)
            u = x / 47
            t = (6 if u < 0.4 else 5) if top else (3 if u < 0.4 else 2)
            if top and (y == 3 + int(e ** 3 * 4)): t = 4
            if not top and y == 11 - int(e ** 3 * 3): t = 5
            if rnd(x // 3, y // 2, 8) < 0.1: t -= 1
            c.P(x, y, 'stone', t)
    done(c)


def totem(c, s=0, faces=('owl', 'beast', 'eye')):
    """나무 토템 기둥: 추상 얼굴 셋을 층층이 새기고 황토·흰 물감으로 칠했다. 맨 위에 펼친 날개 판(윗면이 보인다)."""
    x0, w = 4, 9
    for y in range(10, 46):
        for i in range(w):
            u = (i + 0.5) / w
            c.P(x0 + i, y, 'bark', max(0, min(5, 3 + lit(u))))
    for k, kind in enumerate(faces):
        y = 12 + k * 11
        c.HL(x0, y + 9, w, 'bark', 1)
        if kind == 'owl':
            for (i, j) in ((2, 2), (6, 2)):
                c.ell(x0 + i + 0.5, y + j + 0.5, 1.8, 1.8, lambda X, Y, dx, dy, d: ('bone', 5) if d > 0.4 else ('ink', 1))
            c.P(x0 + 4, y + 4, 'ochre', 4); c.P(x0 + 4, y + 5, 'ochre', 3)
        elif kind == 'beast':
            c.HL(x0 + 1, y + 2, 3, 'ochre', 3); c.HL(x0 + 5, y + 2, 3, 'ochre', 3)
            c.P(x0 + 2, y + 3, 'ink', 1); c.P(x0 + 6, y + 3, 'ink', 1)
            for i in range(1, 8): c.P(x0 + i, y + 6, 'bone', 5 if i % 2 else 2)
        else:
            c.ell(x0 + 4.5, y + 4, 3, 2, lambda X, Y, dx, dy, d: ('feather', 2) if d > 0.5 else ('bone', 5) if d > 0.15 else ('ink', 0))
    # 날개 판(위)
    for y in range(2, 11):
        half = 3 + (y - 2) * 1.0 if y < 6 else 8 - (y - 6) * 0.5
        for x in range(int(8.5 - half), int(8.5 + half) + 1):
            u = (x - (8.5 - half)) / (2 * half + 1)
            t = 4 if y < 7 else 2
            if y < 7 and u > 0.6: t = 3
            if (x + y) % 4 == 0 and y < 7: t -= 1
            c.P(x, y, 'bark', t)
    c.HL(1, 7, 15, 'feather', 2)
    c.P(8, 1, 'bark', 4); c.P(9, 1, 'bark', 3)
    done(c)


@R.add('totem', '토템 기둥(새·짐승·눈)', 1, 3, 'column', tags=['토템', '주술', '마을'], rules='마을 입구·광장 가장자리·무당 천막 곁.')
def _(c): totem(c)


@R.add('totem-b', '토템 기둥(짐승 넷)', 1, 3, 'column', tags=['토템', '주술'], rules='광장 가장자리.')
def _(c): totem(c, s=3, faces=('beast', 'eye', 'owl'))


@R.add('skull-pole', '머리뼈 장대', 1, 2, 'column', tags=['머리뼈', '주술', '경계'], rules='마을 경계·무당 천막 앞·사냥터 입구.')
def _(c):
    post(c, 7, 12, 30, w=3)
    # 뿔 짐승 머리뼈(위에서 보이는 둥근 정수리)
    for y in range(4, 13):
        for x in range(3, 14):
            dx = (x + 0.5 - 8.5) / 5; dy = (y + 0.5 - 8) / 4.4
            if dx * dx + dy * dy > 1: continue
            t = 5 if dy < -0.35 else 4 if dx < 0.3 else 3
            c.P(x, y, 'bone', t)
    for (x, y) in ((6, 8), (11, 8)): c.P(x, y, 'ink', 0); c.P(x, y + 1, 'ink', 1)
    c.P(8, 11, 'bone', 1); c.P(9, 11, 'bone', 1)
    for (pts, t) in (([(3, 6), (1, 4), (1, 1), (2, 0)], 4), ([(13, 6), (15, 4), (15, 1), (14, 0)], 3)):
        for a, b in zip(pts, pts[1:]): c.line(a[0], a[1], b[0], b[1], 'bone', t)
    for j in range(4): c.P(5, 14 + j, 'feather', 3 - j // 2); c.P(11, 14 + j, 'feather', 2)
    done(c)


@R.add('drum', '가죽 북', 1, 1, 'round_body', tags=['북', '의식', '광장'], rules='화톳불 곁.')
def _(c):
    for y in range(7, 15):
        for x in range(2, 14):
            u = (x - 2 + 0.5) / 12
            t = 3 + lit(u)
            if (x + y) % 4 == 0 and 8 < y < 14: c.P(x, y, 'thatch', 2); continue
            c.P(x, y, 'bark', max(0, min(5, t)))
    c.ell(8, 6, 6, 3, lambda x, y, dx, dy, d: ('hide', 5 if dx + dy < -0.4 else 4) if d < 0.75 else ('hide', 2))
    c.line(10, 2, 13, 5, 'bone', 4)
    done(c)


@R.add('altar', '제단 돌(납작한 돌판)', 2, 1, 'box', tags=['제단', '의식', '돌'], rules='돌 둘레 가운데·동굴 깊은 곳.')
def _(c):
    for y in range(2, 15):
        for x in range(1, 31):
            if y < 9:
                t = 6 if y == 2 else 5 if x < 18 else 4
                if y == 8: t = 6
                if (x, y) in ((8, 5), (9, 5), (20, 4), (21, 6)): t = 3
            else:
                t = 3 if x < 12 else 2
                if y == 14: t = 1
            c.P(x, y, 'stone', t)
    # 붉은 물감 손바닥(추상) + 뼈 제물
    for (x, y) in ((6, 4), (7, 4), (6, 5), (7, 5), (8, 3), (5, 3)): c.P(x, y, 'ochre', 2)
    c.HL(18, 5, 6, 'bone', 5); c.P(17, 4, 'bone', 4); c.P(24, 6, 'bone', 4)
    done(c)


# ═══════════════════════ 뼈·화석 ═══════════════════════
def bone(c, x0, y0, x1, y1, t=4, knob=True, th=2):
    """뼈 한 개: 굵기 th 의 몸(윗줄 밝게 → 밑줄 어둡게) + 양 끝 둥근 마디(두 혹)."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for k in range(n + 1):
        x = round(x0 + (x1 - x0) * k / n); y = round(y0 + (y1 - y0) * k / n)
        for d in range(th): c.P(x, y + d, 'bone', t + 1 if d == 0 else t - 1 if d == th - 1 else t)
        c.P(x, y + th, 'bone', 1)
    if knob:
        for (x, y) in ((x0, y0), (x1, y1)):
            for (i, j, dt) in ((-1, -1, 1), (0, -1, 1), (1, -1, 0), (-1, 0, 1), (1, 0, 0), (-1, th, -1), (0, th, -2), (1, th, -2), (-1, 1, 0), (1, 1, -1)):
                c.P(x + i, y + j, 'bone', max(1, min(5, t + dt)))


def skull_small(c, cx, cy, s=0):
    for y in range(cy - 3, cy + 3):
        for x in range(cx - 3, cx + 4):
            dx = (x + 0.5 - cx - 0.5) / 3.6; dy = (y + 0.5 - cy) / 3
            if dx * dx + dy * dy <= 1: c.P(x, y, 'bone', 5 if dy < -0.3 else 4 if dx < 0.3 else 3)
    c.P(cx - 1, cy, 'ink', 0); c.P(cx + 2, cy, 'ink', 0); c.P(cx, cy + 2, 'bone', 1); c.P(cx + 1, cy + 2, 'bone', 1)


@R.add('bone-pile', '뼈 더미', 1, 1, 'debris', tags=['뼈', '잔해'], rules='사냥터·무당 천막 둘레·동굴 앞.')
def _(c):
    bone(c, 2, 11, 12, 8, t=3); bone(c, 3, 6, 12, 11, t=4); bone(c, 2, 13, 11, 13, t=4)
    skull_small(c, 10, 5)
    c.outline(bottom=('ink', 1))


@R.add('bone-pile-l', '큰 뼈 더미(엄니 하나)', 2, 1, 'debris', tags=['뼈', '잔해'], rules='사냥 마당·뼈 집 둘레.')
def _(c):
    tusk_arc(c, 18, 12, 12, 9, 195, 300, width=3)
    for (a, b, cc, d, t) in ((3, 12, 14, 8, 3), (6, 7, 18, 12, 4), (16, 12, 29, 9, 3), (4, 13, 26, 13, 4)):
        bone(c, a, b, cc, d, t=t)
    skull_small(c, 24, 6)
    c.outline(bottom=('ink', 1))


@R.add('ribcage', '거대 갈비뼈 화석(땅에서 솟은 아치)', 4, 3, 'debris', tags=['화석', '공룡', '뼈'], rules='화석 계곡 가운데. 통째로 막힌다.')
def _(c):
    # 흙 둔덕(묻힌 밑동, 윗면 밝게)
    for x in range(2, 62):
        e = abs((x + 0.5 - 32) / 30)
        top = 39 + int(e * e * 4)
        for y in range(top, 46):
            c.P(x, y, 'dirt', 5 if y == top else 4 if y < top + 3 else 3 if y < 45 else 1)
    # 갈비 아치(뒤에서 앞으로, 앞 쌍이 크다) — 한 아치가 등뼈에서 양쪽 땅으로 내려온다
    tops = []
    for k in range(5):
        cx = 12 + k * 10
        ry = 27 - abs(k - 2) * 2
        tusk_arc(c, cx, 42, 8, ry, 180, 360, width=3)
        tops.append((cx, 42 - ry))
    # 등뼈: 아치 꼭대기를 잇는 마디 줄(돌기가 위로)
    for (x0, y0), (x1, y1) in zip([(4, tops[0][1] + 6)] + tops, tops + [(60, tops[-1][1] + 6)]):
        n = max(1, abs(x1 - x0))
        for i in range(n + 1):
            x = x0 + i; y = round(y0 + (y1 - y0) * i / n)
            c.P(x, y - 1, 'bone', 5); c.P(x, y, 'bone', 4); c.P(x, y + 1, 'bone', 2)
            if x % 3 == 0: c.P(x, y - 2, 'bone', 5); c.P(x, y - 3, 'bone', 3)
    c.outline(bottom=('ink', 1))


@R.add('dino-skull', '공룡 머리뼈 화석', 3, 2, 'debris', tags=['화석', '공룡', '뼈'], rules='화석 계곡·발굴터.')
def _(c):
    # 긴 주둥이 머리뼈(옆으로 누웠다): 윗면 밝게, 눈구멍·콧구멍 셋, 이빨 줄
    pts = [(2, 18), (10, 12), (24, 7), (38, 6), (45, 10), (46, 18), (40, 24), (20, 24), (6, 23)]
    c.poly(pts, lambda x, y: ('bone', 5 if y < 11 else 4 if y < 16 else 3 if y < 21 else 2))
    for (cx, cy, rx, ry) in ((34, 12, 4, 3.2), (24, 14, 3, 2.4), (12, 16, 2, 1.6), (41, 17, 2.5, 2.5)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 0) if d < 0.6 else ('bone', 1))
    for x in range(6, 38, 3):
        c.P(x, 24, 'bone', 5); c.P(x, 25, 'bone', 4); c.P(x, 26, 'bone', 2)
    # 아래턱
    c.line(6, 27, 36, 27, 'bone', 4); c.line(6, 28, 36, 28, 'bone', 2); c.line(36, 27, 42, 25, 'bone', 3)
    c.outline(bottom=('ink', 1))


@R.add('longneck', '긴 목 공룡 뼈대(누운 화석)', 6, 3, 'debris', tags=['화석', '공룡', '뼈대'], rules='화석 계곡의 큰 볼거리. 통째로 막힌다 — 둘레를 걸어 돈다.')
def _(c):
    # 등뼈 곡선(긴 목 → 몸 → 꼬리), 척추 마디마다 돌기 + 갈비 + 다리뼈
    spine = []
    for k in range(80):
        t = k / 79
        x = 4 + t * 88
        y = 30 - 18 * math.exp(-((t - 0.12) / 0.12) ** 2) - 6 * math.sin(t * 3.14) + 4 * t
        spine.append((x, y))
    for k, (x, y) in enumerate(spine):
        r = 1 + (1 if 0.2 < k / 79 < 0.75 else 0) + (1 if 0.3 < k / 79 < 0.6 else 0)
        for d in range(-r, r + 1):
            c.P(round(x), round(y) + d, 'bone', 5 if d < 0 else 4 if d == 0 else 2)
        if k % 3 == 0: c.P(round(x), round(y) - r - 1, 'bone', 5); c.P(round(x), round(y) - r - 2, 'bone', 4)
    # 머리
    hx, hy = spine[0]
    c.ell(hx + 1, hy - 2, 4, 2.6, lambda X, Y, dx, dy, d: ('bone', 5 if dy < 0 else 3)); c.P(round(hx) + 2, round(hy) - 2, 'ink', 0)
    # 갈비
    for k in range(26, 56, 3):
        x, y = spine[k]
        c.line(round(x), round(y) + 2, round(x) - 3, round(y) + 13, 'bone', 5)
        c.line(round(x) + 1, round(y) + 2, round(x) - 2, round(y) + 13, 'bone', 3)
        c.line(round(x) + 2, round(y) + 2, round(x) - 1, round(y) + 13, 'bone', 1)
    # 다리뼈 넷
    for k in (30, 36, 50, 56):
        x, y = spine[k]
        bone(c, round(x), round(y) + 4, round(x) + 3, 43, t=4, th=3)
    c.outline(bottom=('ink', 1))


@R.add('fossil-rock', '화석 박힌 바위(암모나이트)', 2, 2, 'organic', tags=['화석', '바위'], rules='화석 계곡·절벽 밑.')
def _(c):
    rock_hill(c, 0, 4, 32, 27, 10, mat='stone', cap='rock', s=12, cell=8)
    # 앞면에 박힌 나선 화석 + 작은 뼈
    cx, cy = 13, 21
    for a in range(0, 720, 20):
        r = 0.6 + a / 150.0
        x = cx + r * math.cos(math.radians(a)); y = cy + r * math.sin(math.radians(a)) * 0.9
        c.P(round(x), round(y), 'bone', 4 if a % 40 else 2)
    bone(c, 21, 24, 28, 22, t=4)
    done(c)


# ═══════════════════════ 타르·증기·화산 ═══════════════════════
def tarpit(c, f=0):
    cx, cy = 24, 17
    for y in range(4, 31):
        for x in range(1, 47):
            dx = (x + 0.5 - cx) / 22.5; dy = (y + 0.5 - cy) / 12.5
            d = dx * dx + dy * dy
            if d > 1 + (rnd(x, y, 3) - 0.5) * 0.12: continue
            if d > 0.78:
                # 둑: 북쪽은 꺼진 벽(어둡게), 남쪽은 밝은 흙 둔덕
                c.P(x, y, 'dirt', 1 if dy < -0.2 else 4 if dy > 0.3 else 2); continue
            t = 1 if dy < -0.4 else 2
            if (x + 2 * y) % 11 == 0 and dy > -0.3: t = 3          # 기름 광택
            c.P(x, y, 'tar', t)
    # 거품(프레임마다 자라고 터진다)
    for (bx, by, ph) in ((14, 16, 0), (30, 19, 1), (22, 23, 2)):
        st = (f + ph) % 3
        if st == 0: c.P(bx, by, 'tar', 3)
        elif st == 1:
            for (i, j) in ((0, -1), (-1, 0), (1, 0), (0, 0)): c.P(bx + i, by + j, 'tar', 3 if j < 0 else 2)
            c.P(bx - 1, by - 1, 'smoke', 2)
        else:
            for (i, j) in ((-1, 0), (1, 0), (0, 1), (0, -1)): c.P(bx + i, by + j, 'tar', 3)
            c.P(bx, by, 'tar', 0)
    # 빠진 뼈
    bone(c, 35, 11, 40, 8, t=4); c.P(34, 12, 'tar', 2)
    tusk_arc(c, 10, 15, 3, 5, 190, 290, width=2)


ids = []
for fr in range(3):
    i = 'tarpit' if fr == 0 else 'tarpit-f%d' % fr
    R.add(i, '타르 웅덩이(거품·빠진 뼈)' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 3, 2, 'terrain', tags=['타르', '늪', '함정'],
          rules='화석 계곡·늪 가장자리. 걸을 수 없다. 둘레 한 칸을 비운다.')(lambda c, fr=fr: tarpit(c, fr))
    ids.append(i)
ANIM.append(('tarpit', '타르 웅덩이', ids, 3))


def vent(c, f=0):
    # 갈라진 바위 테 구멍(위에서 보이는 아가리) + 피어오르는 김
    c.ell(8, 12, 6.5, 3.6, lambda x, y, dx, dy, d: ('basalt', 4 if dy < -0.3 else 3 if dx < 0.3 else 2) if d > 0.45 else ('lava', 2 if d < 0.15 else 1) if dy > -0.2 else ('basalt', 0))
    c.HL(4, 15, 9, 'basalt', 1)
    for k in range(5):
        y = 9 - k * 2 - (f % 3)
        if y < 0: continue
        r = 1.4 + k * 0.6
        cx = 8 + math.sin(k + f) * 1.2
        c.ell(cx, y, r, r * 0.8, lambda x, yy, dx, dy, d: ('smoke', 4 if dx + dy < -0.3 else 3 if d < 0.6 else 2))


ids = []
for fr in range(3):
    i = 'vent' if fr == 0 else 'vent-f%d' % fr
    R.add(i, '증기 구멍(화산 김)' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 1, 'container', tags=['화산', '김', '증기'],
          rules='화산재 바닥에 드문드문. 길 한가운데는 피한다.')(lambda c, fr=fr: vent(c, fr))
    ids.append(i)
ANIM.append(('vent', '증기 구멍', ids, 4))


@R.add('volcano-s', '작은 화산 언덕(빛나는 분화구)', 5, 4, 'organic', tags=['화산', '용암', '언덕'], rules='화산 골짜기 북쪽 끝. 통째로 막힌다.')
def _(c):
    # 원뿔 언덕: 위에서 보이는 분화구 타원(빛나는 용암) + 현무암 비탈(왼쪽 밝게), 비탈을 타고 흐른 용암 줄기
    W, H = 80, 64
    cx = 40
    for y in range(10, 63):
        k = (y - 10) / 52
        half = 12 + k * 27
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - (cx - half) + 0.5) / (2 * half + 1)
            t = 3 + lit(u)
            if rnd(x // 3, y // 2, 5) < 0.15: t -= 1
            if (x + y * 2) % 13 == 0: t -= 1
            c.P(x, y, 'basalt', max(0, min(5, t)))
    c.ell(cx, 12, 13, 5, lambda x, y, dx, dy, d: ('basalt', 5 if dy < 0 else 4) if d > 0.62 else ('lava', 4 if d < 0.2 else 3 if d < 0.4 else 2))
    for (x0, pts) in ((34, [(34, 16), (31, 26), (33, 36), (29, 48), (31, 60)]), (47, [(46, 16), (49, 28), (47, 40), (52, 54)])):
        for a, b in zip(pts, pts[1:]):
            c.line(a[0], a[1], b[0], b[1], 'lava', 3); c.line(a[0] + 1, a[1], b[0] + 1, b[1], 'lava', 2)
    for (x, y, r) in ((36, 5, 3), (42, 2, 2.5), (39, -1, 2)):
        c.ell(x, y + 2, r, r * 0.8, lambda X, Y, dx, dy, d: ('smoke', 3 if dx < 0 else 2))
    done(c)


# ═══════════════════════ 물 위 ═══════════════════════
def bridge_tile(c, horiz=True):
    """밧줄 다리 판자(물 위 걸음 칸): 판자 사이 틈으로 물이 비치고, 양 가장자리에 밧줄 난간(윗줄 밝게)."""
    import terrain as T
    for y in range(16):
        for x in range(16):
            c.P(x, y, *T.p_water(x, y))
    if horiz:
        for x in range(16):
            k = x % 4
            for y in range(3, 13):
                if k == 3: c.P(x, y, 'bark', 0); continue
                t = 4 if k == 0 else 3
                if y == 3: t = 5
                if y == 12: t = 1
                c.P(x, y, 'bark', t)
        for y, t in ((1, 5), (2, 3), (13, 4), (14, 2)):
            for x in range(16): c.P(x, y, 'thatch', t if x % 3 else t - 1)
    else:
        for y in range(16):
            k = y % 4
            for x in range(3, 13):
                if k == 3: c.P(x, y, 'bark', 0); continue
                t = 4 if k == 0 else 3
                if x == 3: t += 1
                if x == 12: t = 1
                c.P(x, y, 'bark', t)
        for x, t in ((1, 4), (2, 3), (13, 3), (14, 2)):
            for y in range(16): c.P(x, y, 'thatch', t if y % 3 else t - 1)


@R.add('bridge-h', '밧줄 다리(동서, 물 위 판자)', 1, 1, 'terrain', tags=['다리', '밧줄', '물'], rules='강·늪 물 위에 동서로 이어 칠한다. 걸을 수 있다. 양 끝은 bridge-post 기둥.')
def _(c): bridge_tile(c, True)


@R.add('bridge-v', '밧줄 다리(남북, 물 위 판자)', 1, 1, 'terrain', tags=['다리', '밧줄', '물'], rules='강·늪 물 위에 남북으로 이어 칠한다. 걸을 수 있다.')
def _(c): bridge_tile(c, False)


@R.add('bridge-post', '다리 기둥(밧줄 감은 말뚝 한 쌍)', 1, 2, 'column', tags=['다리', '밧줄'], rules='밧줄 다리 양 끝 둑(땅) 칸에 위아래로 하나씩.')
def _(c):
    post(c, 6, 4, 30, w=4)
    for y in (9, 12, 15): c.HL(5, y, 6, 'thatch', 4); c.HL(5, y + 1, 6, 'thatch', 2)
    c.line(10, 10, 15, 13, 'thatch', 3)
    done(c)


@R.add('raft', '통나무 뗏목', 2, 2, 'flat', tags=['뗏목', '물', '배'], rules='물 위 덧그림(위층). 둑에 닿게 둔다.')
def _(c):
    # 동서로 누운 통나무 여섯: 통나무마다 윗줄 밝게·밑줄 어둡게, 양 끝 자른 면(나이테), 끈 두 줄 + 장대
    for k in range(6):
        y0 = 3 + k * 4 + (k % 2)
        x0, x1 = 3 + (k * 3) % 4, 28 - (k * 2) % 3
        for x in range(x0, x1 + 1):
            for i in range(4):
                tt = 5 if i == 0 else 4 if i == 1 else 3 if i == 2 else 1
                c.P(x, y0 + i, 'bark', tt)
        for (ex, sh) in ((x0, 4), (x1, 3)):
            for i in range(4): c.P(ex, y0 + i, 'thatch', sh if i in (1, 2) else sh - 1)
            c.P(ex, y0 + 1, 'thatch', 2)
    for x in (9, 21):
        for y in range(3, 29): c.P(x, y, 'thatch', 4 if y % 2 else 2)
    c.line(5, 29, 26, 1, 'bark', 4); c.line(6, 29, 27, 1, 'bark', 2)


@R.add('canoe', '통나무배(속을 판)', 3, 1, 'container', tags=['배', '물'], rules='물가 둑이나 얕은 물 위. 위층.')
def _(c):
    for y in range(2, 15):
        for x in range(1, 47):
            dx = (x + 0.5 - 24) / 23; dy = (y + 0.5 - 8) / 6
            d = dx * dx * dx * dx * 0.7 + dx * dx * 0.3 + dy * dy
            if d > 1: continue
            inner = dx * dx * dx * dx * 0.9 + dx * dx * 0.3 + ((y + 0.5 - 7) / 3.6) ** 2 < 0.8
            if inner:
                c.P(x, y, 'bark', 1 if y < 7 else 2)
            else:
                c.P(x, y, 'bark', 5 if y < 6 else 4 if y < 10 else 3 if y < 13 else 1)
    c.line(30, 6, 42, 10, 'bark', 4); c.ell(43, 10, 2, 1.4, lambda x, y, dx, dy, d: ('bark', 3))
    done(c)


@R.add('palisade', '통나무 울타리(한 칸)', 1, 2, 'column', tags=['울타리', '통나무', '마을'], rules='마을 둘레 동서 울타리. 칸마다 이어 놓는다(사이 틈은 길).')
def _(c):
    for k, x in enumerate((0, 4, 8, 12)):
        top = 4 + (h32(k, 1, 9) % 3)
        for y in range(top + 3, 31):
            for i in range(4):
                c.P(x + i, y, 'bark', 4 if i == 0 else 3 if i == 1 else 2 if i == 2 else 1)
        for i in range(4):
            c.P(x + i, top, 'bark', 4); c.P(x + i, top + 1, 'thatch', 3 if i < 2 else 2); c.P(x + i, top + 2, 'bark', 5 if i < 3 else 3)
        c.P(x + 1, top + 1, 'thatch', 4)
    c.HL(0, 14, 16, 'thatch', 3); c.HL(0, 15, 16, 'thatch', 1)
    done(c)


if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items if '-f' not in it['id']]
    contact(ims, os.path.join(OUT, 'props', 'preview.png'), z=3, W=1900, bg=(138, 95, 58))
    print(len(R.items), 'props')
