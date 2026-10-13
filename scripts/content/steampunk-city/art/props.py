#!/usr/bin/env python3
"""steampunk_city 야외 소품 — 가스등·벤치·짐·석탄·울타리·물탱크·노점·증기 구멍·굴뚝 연기·배관·탈것….

모든 소품은 3/4 탑뷰: 윗면(밝게, 뒤 가장자리 어둡게) + 남쪽 앞면. 아래 가장자리 먹 접지 선. 빛은 왼쪽 위.
애니메이션은 id-fN 프레임 조각(관문은 프레임마다 따로 받는다).

  python3 props.py      # tiledata/steampunk-city/props/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, box3, cyl_v, NT, MI, rivets
from kit import Reg, contact, OUT

R = Reg('props')
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


def post(c, x, y0, y1, mat='iron', w=2):
    c.R(x, y0, w, y1 - y0, mat, 3); c.VL(x, y0, y1 - y0, mat, 5)
    if w > 2: c.VL(x + w - 1, y0, y1 - y0, mat, 1)
    else: c.VL(x + 1, y0, y1 - y0, mat, 2)


def lantern(c, cx, y, lit=True):
    """가스등 머리: 갓(윗면 4행) + 유리 칸(불빛) + 밑 받침. cx = 가운데 x, y = 갓 꼭대기."""
    c.P(cx - 1, y, 'brass', 5); c.P(cx, y, 'brass', 4); c.P(cx - 1, y + 1, 'iron', 3); c.P(cx, y + 1, 'iron', 2)
    c.R(cx - 4, y + 2, 8, 4, 'iron', 5); c.HL(cx - 4, y + 2, 8, 'iron', 3); c.HL(cx - 3, y + 3, 6, 'iron', 6); c.HL(cx - 5, y + 5, 10, 'iron', 2)
    c.P(cx - 5, y + 4, 'iron', 4); c.P(cx + 4, y + 4, 'iron', 2)
    for j in range(7):
        for i in range(-3, 3):
            c.P(cx + i, y + 6 + j, 'lit', 4 if (abs(i + 0.5) < 1.6 and 1 < j < 5) else 3 if j < 5 else 2)
    c.VL(cx - 4, y + 6, 7, 'iron', 3); c.VL(cx + 3, y + 6, 7, 'iron', 1); c.VL(cx - 1, y + 6, 7, 'iron', 2)
    c.HL(cx - 4, y + 13, 8, 'iron', 4); c.HL(cx - 3, y + 14, 6, 'iron', 2); c.HL(cx - 2, y + 15, 4, 'iron', 1)


def plinth(c, cx, y, w=8):
    """기둥 받침(팔각 받침 — 윗면 3행 + 앞면 3행)."""
    x = cx - w // 2
    box3(c, x, y, w, 3, 3, 'iron', tt=5, ft=2)
    c.HL(x, y + 6, w, 'ink', 1)


@R.add('gas-lamp', '가스 가로등(무쇠 기둥·켜진 등)', 1, 3, 'column', tags=['가로등', '거리'], rules='보도 바깥 줄(연석 쪽)에 5~6칸 간격. 문 앞 접근칸·노점 앞에는 두지 않는다.')
def _(c):
    lantern(c, 8, 3)
    c.R(6, 19, 4, 2, 'iron', 2); c.HL(6, 19, 4, 'iron', 4)
    c.HL(3, 21, 10, 'iron', 4); c.HL(3, 22, 10, 'iron', 1); c.P(3, 20, 'iron', 4); c.P(12, 20, 'iron', 3)   # 사다리 받침 팔
    post(c, 7, 23, 40)
    c.R(6, 30, 4, 2, 'iron', 4); c.HL(6, 30, 4, 'iron', 5); c.HL(6, 32, 4, 'iron', 1)
    plinth(c, 8, 40)
    c.HL(4, 47, 8, 'ink', 1)


@R.add('gas-lamp-double', '쌍 가스등(광장용, 등 둘)', 2, 3, 'column', tags=['가로등', '광장'], rules='광장·역 앞 한가운데·모서리. 둘레 1칸 비움.')
def _(c):
    lantern(c, 7, 4); lantern(c, 25, 4)
    # 가로 팔(소용돌이) + 가운데 꼭지
    c.HL(7, 20, 19, 'iron', 4); c.HL(7, 21, 19, 'iron', 1)
    for x in (10, 21): c.ell(x, 18, 2, 1.6, lambda X, Y, dx, dy, d: ('iron', 3) if d > 0.4 else None)
    c.R(14, 6, 4, 4, 'brass', 3); c.HL(14, 6, 4, 'brass', 5); c.P(15, 4, 'brass', 5); c.P(16, 5, 'brass', 4)
    post(c, 14, 10, 40, w=4)
    c.R(13, 24, 6, 2, 'iron', 4); c.HL(13, 24, 6, 'iron', 5); c.HL(13, 26, 6, 'iron', 1)
    plinth(c, 16, 40, w=10)
    c.HL(11, 47, 10, 'ink', 1)


@R.add('bench', '무쇠 다리 나무 벤치', 2, 1, 'seat', tags=['벤치', '광장', '공원'], rules='광장 가장자리·쌈지 공원·승강장. 길 칸 위에는 두지 않는다.')
def _(c):
    # 등받이(뒤, 판자 2줄)
    c.R(2, 0, 28, 2, 'wood', 4); c.HL(2, 0, 28, 'wood', 5); c.R(2, 2, 28, 2, 'wood', 3); c.HL(2, 4, 28, 'wood', 1)
    for x in (2, 27): c.R(x, 0, 3, 6, 'iron', 2); c.VL(x, 0, 6, 'iron', 4)
    # 앉는 판(윗면 4행)
    c.R(1, 5, 30, 5, 'wood', 4)
    for y in (5, 7): c.HL(1, y, 30, 'wood', 5)
    c.HL(1, 9, 30, 'wood', 3); c.HL(1, 10, 30, 'wood', 2)
    # 무쇠 다리(소용돌이)
    for x in (2, 27):
        c.R(x, 10, 3, 5, 'iron', 2); c.VL(x, 10, 5, 'iron', 4); c.P(x + 1, 12, 'iron', 1)
        c.HL(x - 1, 14, 5, 'iron', 3)
    c.HL(0, 15, 32, 'ink', 1)
    for x in range(1, 31, 7): c.P(x, 6, 'wood', 2)


def crate(c, x, y, w, topn, front, s=0):
    """나무 상자: 윗면(판자 + 쇠 모서리) + 앞면(판자 + 대각 버팀)."""
    box3(c, x, y, w, topn, front, 'wood', tt=4, ft=3)
    for i in range(x + 3, x + w - 1, 4): c.VL(i, y + 1, topn - 2, 'wood', 3)
    c.line(x + 1, y + topn + 1, x + w - 2, y + topn + front - 2, 'wood', 4)
    c.VL(x + 1, y + topn, front, 'wood', 4); c.VL(x + w - 2, y + topn, front, 'wood', 1)
    for (px_, py) in ((x, y), (x + w - 2, y), (x, y + topn + front - 2), (x + w - 2, y + topn + front - 2)):
        c.R(px_, py, 2, 2, 'iron', 4)
    c.HL(x, y + topn + front - 1, w, 'ink', 1)


@R.add('crates', '쌓은 나무 상자', 2, 2, 'box', tags=['상자', '짐', '부두', '창고'], rules='창고 화물 문 옆·부두·역 화물칸 곁. 문 앞 접근칸은 비운다.')
def _(c):
    crate(c, 1, 12, 16, 6, 9)
    crate(c, 14, 14, 17, 5, 8)
    crate(c, 5, 1, 14, 5, 7)
    c.HL(0, 31, 32, 'ink', 1)


def barrel(c, x, y, w=12, h=16, mat='wood'):
    """통: 위 타원(뚜껑 판·윗면 4행) + 불룩한 몸(무쇠 테 둘)."""
    for j in range(h - 4):
        bulge = 1 if 2 < j < h - 7 else 0
        for i in range(-bulge, w + bulge):
            u = (i + 0.5) / w
            t = 4 if u < 0.3 else 3 if u < 0.65 else 2 if u < 0.88 else 1
            c.P(x + i, y + 3 + j, mat, t)
    for by in (5, h - 4):
        for i in range(-1, w + 1):
            if c.on(x + i, y + by): c.P(x + i, y + by, 'iron', 4 if i < w / 2 else 2)
    c.ell(x + w / 2, y + 3, w / 2, 3, lambda X, Y, dx, dy, d: (mat, 5 if dx < 0 else 4) if d > 0.55 else (mat, 3 if (X - x) % 3 else 2))
    c.ell(x + w / 2, y + 3, w / 2, 3, lambda X, Y, dx, dy, d: ('iron', 3) if d > 0.8 else None)
    c.HL(x, y + h - 2, w, 'ink', 1)


@R.add('barrels', '나무 통 두 개', 2, 2, 'round_body', tags=['통', '짐', '선술집', '부두'], rules='선술집 문 옆·부두. 접근칸 비움.')
def _(c):
    barrel(c, 2, 10, 13, 20); barrel(c, 16, 12, 13, 19)
    c.HL(1, 31, 30, 'ink', 1)


@R.add('barrel', '나무 통 하나', 1, 2, 'round_body', tags=['통', '짐'], rules='가게 옆·골목 끝.')
def _(c):
    barrel(c, 2, 11, 12, 20)


@R.add('coal-bunker', '석탄 칸(벽돌 세 벽 + 석탄 더미)', 3, 2, 'container', tags=['석탄', '공장', '보일러실'], rules='보일러실·공장 마당. 앞(남쪽)이 트여 삽질한다 — 앞 칸은 비운다.')
def _(c):
    # 뒤 벽(윗면 3행 + 앞면) 과 양 옆 벽(윗면이 보이는 띠) — 남쪽이 트인 ㄷ자
    box3(c, 0, 2, 48, 3, 6, 'brick', tt=5, ft=3)
    for x in (0, 42):
        c.R(x, 5, 6, 22, 'brick', 5); c.HL(x, 5, 6, 'brick', 6); c.VL(x, 5, 22, 'brick', 4); c.VL(x + 5, 5, 22, 'brick', 3)
        c.R(x, 27, 6, 4, 'brick', 2); c.HL(x, 27, 6, 'brick', 3)
    # 석탄 더미(안쪽이 보인다: 덩이 + 반짝임)
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 3)
        t = 2 if (dy < -0.2 and r > 0.4) else 1 if r > 0.3 else 0
        if rnd(X, Y, 8) > 0.93: return ('iron', 5)
        return ('coal', t)
    c.ell(24, 22, 17, 10, coal)
    c.ell(18, 18, 9, 6, coal)
    # 삽(손잡이 나무 + 쇠 날)
    c.line(30, 10, 36, 22, 'wood', 4); c.line(31, 10, 37, 22, 'wood', 2)
    c.R(35, 21, 4, 4, 'iron', 4); c.HL(35, 21, 4, 'iron', 5)
    c.HL(0, 31, 48, 'ink', 1)


@R.add('coal-heap', '석탄 더미', 2, 1, 'organic', tags=['석탄', '공장 마당'], rules='석탄 칸 옆·선로 하역장. 덩이로 1~3개.')
def _(c):
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 11)
        t = 2 if (dy < -0.3 and r > 0.35) else 1 if r > 0.35 else 0
        if rnd(X, Y, 4) > 0.94: return ('iron', 5)
        return ('coal', t)
    c.ell(16, 12, 15, 7, coal); c.ell(11, 9, 8, 5, coal); c.ell(21, 10, 7, 4, coal)
    c.HL(2, 15, 28, 'ink', 1)


def fence_cell(c, end=None, gate=False):
    """낮은 벽돌 담 + 무쇠 창살: 갓돌 윗면 3행 + 담 앞면 + 창살(창끝)."""
    # 창살(뒤): 2px 간격 세로 살, 창끝, 가로 띠
    for x in range(1, 16, 3):
        c.VL(x, 2, 8, 'iron', 2); c.P(x, 1, 'iron', 4); c.P(x, 0, 'iron', 5)
    c.HL(0, 3, 16, 'iron', 3); c.HL(0, 7, 16, 'iron', 2)
    # 갓돌(윗면 3) + 담(앞면 4)
    c.HL(0, 9, 16, 'stone', 3); c.R(0, 10, 16, 2, 'stone', 6); c.HL(0, 11, 16, 'stone', 5)
    c.F(0, 12, 16, 3, lambda wx, wy, i, j: tex_brick(i, j + 12, base=3, mat='brick', s=4))
    c.HL(0, 15, 16, 'ink', 1)
    if end in ('L', 'R'):
        x = 0 if end == 'L' else 11
        box3(c, x, 2, 5, 3, 10, 'stone', tt=5, ft=3)
        c.P(x + 2, 0, 'brass', 4); c.R(x + 1, 1, 3, 1, 'brass', 3)
        c.HL(x, 15, 5, 'ink', 1)


@R.add('fence', '무쇠 창살 담(한 칸, 잇는 조각)', 1, 1, 'frame', tags=['울타리', '담', '공원'], rules='쌈지 공원·공장 마당 둘레를 한 줄로 잇는다. 끝은 fence-post-l/r.')
def _(c): fence_cell(c)


@R.add('fence-post-l', '무쇠 창살 담 왼쪽 끝 기둥', 1, 1, 'frame', tags=['울타리', '담'], rules='담 줄의 왼쪽 끝.')
def _(c): fence_cell(c, 'L')


@R.add('fence-post-r', '무쇠 창살 담 오른쪽 끝 기둥', 1, 1, 'frame', tags=['울타리', '담'], rules='담 줄의 오른쪽 끝.')
def _(c): fence_cell(c, 'R')


@R.add('water-tower', '급수탑(나무 물통 + 무쇠 다리 + 급수관)', 3, 5, 'structure', tags=['급수탑', '선로', '공장'], rules='선로 곁(급수관이 선로 쪽) 또는 공장 마당 모퉁이. 다리 둘레 1칸 비움.')
def _(c):
    # 원뿔 지붕(윗면이 보이는 경사) + 물통
    c.poly([(5, 14), (24, 2), (43, 14), (43, 16), (5, 16)], lambda X, Y: ('slate', 4 if X < 22 else 3 if X < 34 else 2))
    for y in range(3, 16):
        for x in range(5, 44):
            if c.on(x, y) and (x + y * 2) % 7 == 0: c.P(x, y, 'slate', 2)
    c.line(5, 14, 24, 2, 'slate', 5); c.line(24, 2, 43, 14, 'ink', 1); c.HL(4, 16, 41, 'ink', 1)
    c.P(24, 0, 'brass', 5); c.P(24, 1, 'brass', 3)
    # 통 몸(세로 판자 + 무쇠 테 셋)
    for y in range(17, 40):
        for x in range(6, 42):
            u = (x - 6 + 0.5) / 36
            t = 4 if u < 0.25 else 3 if u < 0.6 else 2 if u < 0.85 else 1
            if (x - 6) % 4 == 3: t -= 1
            c.P(x, y, 'wood', t)
    for by in (19, 28, 37): c.HL(6, by, 36, 'iron', 4); c.HL(6, by + 1, 36, 'iron', 1)
    c.VL(5, 17, 23, 'ink', 1); c.VL(42, 17, 23, 'ink', 1); c.HL(6, 40, 36, 'wood', 1)
    # 받침 판(윗면 3) + 무쇠 다리 넷 + 가새
    box3(c, 3, 40, 42, 3, 2, 'iron', tt=4, ft=2)
    for x in (5, 17, 29, 40):
        c.R(x, 45, 3, 33, 'iron', 3); c.VL(x, 45, 33, 'iron', 5); c.VL(x + 2, 45, 33, 'iron', 1)
    c.line(8, 47, 29, 76, 'iron', 2); c.line(40, 47, 19, 76, 'iron', 2); c.line(8, 62, 40, 62, 'iron', 2)
    for x in (4, 16, 28, 39): c.R(x, 76, 5, 3, 'stone', 5); c.HL(x, 76, 5, 'stone', 6); c.HL(x, 79, 5, 'ink', 1)
    # 급수관(오른쪽으로 내려온 팔 + 주둥이)
    c.R(42, 30, 4, 3, 'iron', 3); c.HL(42, 30, 4, 'iron', 5)
    c.R(44, 33, 3, 14, 'iron', 3); c.VL(44, 33, 14, 'iron', 5)
    c.R(43, 47, 5, 3, 'iron', 2); c.HL(43, 47, 5, 'iron', 4)
    c.line(45, 50, 45, 56, 'canvas', 1)


def stall(c, awn, goods):
    """노점 3×3: 줄무늬 차양(윗면 경사가 넓게 보인다) + 판매대(윗면에 물건) + 나무 기둥."""
    a1, t1 = awn
    # 기둥 넷(뒤 둘은 차양에 가려 끝만)
    for x in (3, 43): c.R(x, 14, 2, 30, 'wood', 3); c.VL(x, 14, 30, 'wood', 4)
    # 차양: 뒤(어둡게) → 앞(밝게) 경사, 줄무늬 6px
    for y in range(2, 16):
        for x in range(1 + max(0, 3 - y), 47 - max(0, 3 - y)):
            stripe = ((x - 1) // 6) % 2 == 0
            t = (t1 if stripe else 3) - (1 if y < 6 else 0)
            c.P(x, y, a1 if stripe else 'canvas', t)
    c.HL(2, 1, 44, 'ink', 1)
    for x in range(1, 47):
        stripe = ((x - 1) // 6) % 2 == 0
        c.P(x, 16, a1 if stripe else 'canvas', (t1 if stripe else 3) - 1)
        if (x - 1) % 6 in (1, 2, 3, 4): c.P(x, 17, a1 if stripe else 'canvas', (t1 if stripe else 3) - 2)
    c.HL(1, 18, 46, 'ink', 2)
    # 판매대: 윗면(물건) y26~32 + 앞면 판자 y33~43
    c.R(2, 26, 44, 7, 'wood', 4); c.HL(2, 26, 44, 'wood', 3); c.HL(2, 32, 44, 'wood', 5)
    c.R(2, 33, 44, 10, 'wood', 2)
    for x in range(4, 46, 6): c.VL(x, 33, 10, 'wood', 1)
    c.HL(2, 33, 44, 'wood', 1)
    c.VL(1, 26, 17, 'ink', 1); c.VL(46, 26, 17, 'ink', 1); c.HL(1, 43, 46, 'ink', 1)
    # 뒤 벽 그늘(차양 밑)
    c.R(5, 19, 38, 7, 'wood', 1)
    goods(c)
    c.HL(2, 47, 44, 'ink', 1)
    for x in (3, 43): c.R(x, 43, 2, 4, 'wood', 2)


def g_fruit(c):
    for k, (x, m) in enumerate(((6, 'cloth'), (14, 'brass'), (22, 'paint'), (30, 'cloth'), (38, 'brass'))):
        c.R(x - 1, 27, 7, 4, 'wood', 2); c.HL(x - 1, 27, 7, 'wood', 3)
        for i in range(5):
            c.P(x + i, 27 + (i % 2), m, 3 if i % 2 else 2); c.P(x + i, 28 + (i % 2), m, 2)
            if i % 2 == 0: c.P(x + i, 27, m, 3 if m != 'paint' else 4)


def g_parts(c):
    for k, x in enumerate((7, 17, 27, 37)):
        r = 3 + k % 2
        c.ell(x, 29, r, r * 0.6, lambda X, Y, dx, dy, d: ('brass' if k % 2 else 'copper', 4 if dx < 0 else 2) if d > 0.25 else ('wood', 3))
        for a in range(8):
            ang = a * math.pi / 4
            c.P(round(x + (r + 1) * math.cos(ang)), round(29 + (r * 0.6 + 0.7) * math.sin(ang)), 'brass' if k % 2 else 'copper', 3)
    c.R(40, 27, 4, 3, 'iron', 4); c.HL(40, 27, 4, 'iron', 5)


def g_fish(c):
    c.R(4, 27, 40, 5, 'iron', 4)
    for x in range(5, 43, 2): c.P(x, 28, 'steam', 4)
    for x in (6, 15, 24, 33):
        c.ell(x + 3, 29, 3.5, 1.4, lambda X, Y, dx, dy, d: ('iron', 6 if dy < 0 else 4))
        c.P(x + 7, 29, 'iron', 5); c.P(x, 29, 'ink', 1)


@R.add('stall-fruit', '시장 노점(과일·채소, 빨강 줄무늬 차양)', 3, 3, 'structure', tags=['시장', '노점', '광장'], rules='광장 가장자리에 2~4개 한 줄, 노점 사이 1칸·앞 2칸 비움(손님 자리).')
def _(c): stall(c, ('cloth', 3), g_fruit)


@R.add('stall-parts', '시장 노점(톱니·부품, 초록 차양)', 3, 3, 'structure', tags=['시장', '노점', '부품'], rules='광장·공장 거리 시장.')
def _(c): stall(c, ('paint', 4), g_parts)


@R.add('stall-fish', '시장 노점(생선 얼음판, 남색 차양)', 3, 3, 'structure', tags=['시장', '노점', '부두'], rules='부두 앞 시장.')
def _(c): stall(c, ('navy', 4), g_fish)


# ── 증기 구멍(애니메이션 4프레임) ──
def cloud(c, blobs, dark=False):
    """뭉게 김/연기: 덩이마다 원 세 개를 겹쳐 그리고, 뒤에서 앞으로 칠한다(먼 덩이 = 작고 옅게). 밝은 면은 왼쪽 위."""
    base = (0, 1, 2) if dark else (2, 3, 4)
    for (cx, cy, r) in blobs:
        for (ox, oy, k) in ((-r * 0.45, r * 0.15, 0.72), (r * 0.45, r * 0.2, 0.68), (0, -r * 0.25, 0.8)):
            c.ell(cx + ox, cy + oy, r * k + 0.6, r * k * 0.85 + 0.6,
                  lambda X, Y, dx, dy, d: ('steam', base[2] if (dx < 0 and dy < -0.15 and d < 0.75) else base[1] if d < 0.72 else base[0]))
    # 윤곽 한 단 어둡게(아래·오른쪽 가장자리)
    m0 = c.m.copy()
    for y in range(c.h):
        for x in range(c.w):
            g = c.get(x, y)
            if not g or g[0] != 'steam': continue
            if (y + 1 < c.h and m0[y + 1, x] < 0) or (x + 1 < c.w and m0[y, x + 1] < 0):
                c.P(x, y, 'steam', max(0, g[1] - 1))


STEAM = [  # 프레임마다 김 덩이(cx, cy, r) — 아래에서 위로, 조금 오른쪽으로 흐른다
    [(8, 17, 3.6), (9, 11, 4.4), (8, 4.5, 3.6)],
    [(8, 16, 4.2), (10, 10, 4.6), (9, 3.5, 3.0)],
    [(8, 17, 3.2), (9, 12, 4.2), (11, 6, 4.2)],
    [(8, 16, 3.9), (8, 10, 4.0), (11, 4, 3.8)],
]


@anim('steam-vent', '증기 구멍(쇠 굴뚝 토막에서 김이 오른다)', 4, 1, 2, 'container', tags=['증기', '거리', '공장'], rules='보도 가장자리·공장 마당·배관 끝. 길 칸 위·문 앞에는 두지 않는다.', fps=5)
def steam_vent(c, f):
    cloud(c, STEAM[f])
    # 쇠 토막(지름 12, 위 아가리 타원 + 몸 + 받침 테) — 김보다 앞에 그린다
    cyl_v(c, 2, 19, 12, 9, 6, 'iron', base=3)
    c.ell(8, 22, 6, 3, lambda X, Y, dx, dy, d: ('iron', 5 if dx < 0 else 3) if d > 0.45 else ('coal', 0 if d < 0.2 else 1))
    c.HL(2, 27, 12, 'iron', 1); c.R(1, 28, 14, 2, 'iron', 4); c.HL(1, 28, 14, 'iron', 5); c.HL(1, 30, 14, 'iron', 2); c.HL(1, 31, 14, 'ink', 1)
    c.P(3, 25, 'iron', 6); c.P(12, 25, 'iron', 6)
    for (cx, cy, r) in STEAM[f][:1]:
        c.ell(8, 20, 3, 1.5, lambda X, Y, dx, dy, d: ('steam', 3))


SMOKE = [
    [(9, 29, 3.6), (11, 22, 5.0), (15, 14, 6.0), (21, 6, 5.0)],
    [(8, 28, 4.2), (12, 20, 5.4), (17, 12, 5.6), (23, 5, 4.0)],
    [(9, 29, 3.4), (13, 21, 5.6), (18, 13, 5.0), (24, 7, 4.6)],
    [(8, 28, 4.0), (11, 19, 4.8), (16, 11, 6.0), (22, 4, 3.6)],
]


@anim('stack-smoke', '공장 굴뚝 꼭대기 + 검은 연기(굴뚝 위에 겹쳐 찍는다)', 4, 2, 3, 'column', tags=['굴뚝', '연기', '공장'], rules='공장·보일러실 큰 굴뚝 꼭대기 칸에 맞춰 찍는다(굴뚝 머리 칸 = 이 조각 왼쪽 아래 칸).', fps=4)
def stack_smoke(c, f):
    import buildings as BD
    cloud(c, SMOKE[f], dark=True)
    c.paste(BD.cell('stack.top'), 0, 32)


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'props', 'preview.png'), z=z, W=2000)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'props', len(ANIM), 'anims')
