#!/usr/bin/env python3
"""steampunk_city 야외 소품 — 가스등·벤치·짐·석탄·울타리·물탱크·노점·증기 구멍·굴뚝 연기·배관·탈것….

모든 소품은 3/4 탑뷰: 윗면(밝게, 뒤 가장자리 어둡게) + 남쪽 앞면. 아래 가장자리 먹 접지 선. 빛은 왼쪽 위.
애니메이션은 id-fN 프레임 조각(관문은 프레임마다 따로 받는다).

  python3 props.py      # tiledata/steampunk-city/props/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick, box3, cyl_v, NT, MI, rivets, disc
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
    """가스등 머리(위에서 내려다본 육각 등): 넓은 무쇠 버섯 갓(타원 윗면 7행, 왼쪽 위 밝게) + 놋쇠 꼭지 + 유리 등(불빛) + 밑 받침 원반.
    cx = 가운데 x, y = 꼭지 위."""
    # 유리 등(갓 밑) — 먼저 그린다
    for j in range(8):
        for i in range(-4, 4):
            c.P(cx + i, y + 9 + j, 'lit', 4 if (abs(i + 0.5) < 2 and 1 < j < 6) else 3 if j < 6 else 2)
    c.VL(cx - 5, y + 9, 8, 'iron', 4); c.VL(cx + 4, y + 9, 8, 'iron', 1); c.VL(cx - 1, y + 9, 7, 'iron', 2)
    disc(c, cx, y + 18, 4.6, 1.8, 'iron', 4, band=1, bt=2)
    # 버섯 갓(윗면이 넓게 보인다)
    disc(c, cx, y + 6, 7.8, 5.0, 'iron', 5, band=2, bt=2)
    c.ell(cx, y + 5.0, 2.4, 1.4, lambda X, Y, dx, dy, d: ('brass', 5 if dx < 0 else 3))
    c.P(cx - 1, y + 3, 'brass', 5); c.P(cx, y + 3, 'brass', 3)


def plinth(c, cx, y, w=8):
    """둥근 기둥 받침(윗면 타원 + 앞 두께, 맨 밑 먹 선). y = 받침 윗면 가운데 높이."""
    disc(c, cx, y, w / 2, w / 4 + 0.6, 'iron', 5, band=3, bt=2)


@R.add('gas-lamp', '가스 가로등(무쇠 기둥·켜진 등)', 1, 3, 'column', tags=['가로등', '거리'], rules='보도 바깥 줄(연석 쪽)에 5~6칸 간격. 문 앞 접근칸·노점 앞에는 두지 않는다.')
def _(c):
    post(c, 7, 19, 43)
    c.R(6, 30, 4, 2, 'iron', 4); c.HL(6, 30, 4, 'iron', 5); c.HL(6, 32, 4, 'iron', 1)
    lantern(c, 8, 1)
    plinth(c, 8, 42, w=14)


@R.add('plaza-lamp', '광장 가스등(돌 받침대 위 큰 등)', 1, 3, 'column', tags=['가로등', '광장'], rules='광장 네 모퉁이·기념비 둘레·역 앞. 둘레 1칸 비움.')
def _(c):
    box3(c, 1, 31, 14, 6, 10, 'stone', tt=5, ft=3)
    c.R(4, 39, 8, 5, 'stone', 2); c.HL(4, 39, 8, 'stone', 1); c.R(6, 40, 4, 3, 'brass', 3)
    c.HL(1, 47, 14, 'ink', 1)
    post(c, 7, 18, 32)
    c.R(6, 24, 4, 2, 'iron', 4); c.HL(6, 26, 4, 'iron', 1)
    disc(c, 8, 32, 4, 1.6, 'iron', 4, band=1, bt=2, rim=False)
    lantern(c, 8, 0)


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
    """나무 상자: 윗면(판자 줄 + 쇠 모서리, 뒤 가장자리 어둡게) + 앞면(판자 + 대각 버팀)."""
    box3(c, x, y, w, topn, front, 'wood', tt=5, ft=2)
    for j in range(y + 2, y + topn - 1, 2): c.HL(x + 1, j, w - 2, 'wood', 4)
    c.HL(x + 1, y + topn - 1, w - 2, 'wood', 5)
    c.line(x + 1, y + topn + 1, x + w - 2, y + topn + front - 2, 'wood', 3)
    c.VL(x + 1, y + topn, front, 'wood', 3); c.VL(x + w - 2, y + topn, front, 'wood', 1)
    for (px_, py) in ((x, y), (x + w - 2, y), (x, y + topn + front - 2), (x + w - 2, y + topn + front - 2)):
        c.R(px_, py, 2, 2, 'iron', 4)
    c.HL(x, y + topn + front, w, 'ink', 1)


@R.add('crates', '나무 상자 두 개(큰 것 + 작은 것)', 2, 2, 'box', tags=['상자', '짐', '부두', '창고'], rules='창고 화물 문 옆·부두·역 화물칸 곁. 문 앞 접근칸은 비운다.')
def _(c):
    crate(c, 1, 6, 18, 9, 10)
    crate(c, 18, 14, 13, 7, 8)


def barrel(c, x, y, w=12, h=16, mat='wood'):
    """통: 위 타원 뚜껑(윗면 6행 — 판자 줄 + 무쇠 테) + 불룩한 몸(무쇠 테 둘). y = 뚜껑 위 끝."""
    top = 6
    for j in range(h - top // 2):
        bulge = 1 if 2 < j < h - top // 2 - 4 else 0
        for i in range(-bulge, w + bulge):
            u = (i + 0.5) / w
            t = 4 if u < 0.3 else 3 if u < 0.65 else 2 if u < 0.88 else 1
            c.P(x + i, y + top // 2 + j, mat, t)
    for by in (top // 2 + 3, h - 3):
        for i in range(-1, w + 1):
            if c.on(x + i, y + by): c.P(x + i, y + by, 'iron', 4 if i < w / 2 else 2)
    c.ell(x + w / 2, y + top / 2, w / 2, top / 2, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 3) if d > 0.7 else (mat, 5 if (X - x) % 3 else 4))
    c.ell(x + w / 2, y + top / 2, w / 2, top / 2, lambda X, Y, dx, dy, d: ('iron', 2) if (d > 0.7 and dy < -0.3) else None)
    c.HL(x, y + h - 1, w, 'ink', 1)


@R.add('barrels', '나무 통 두 개', 2, 2, 'round_body', tags=['통', '짐', '선술집', '부두'], rules='선술집 문 옆·부두. 접근칸 비움.')
def _(c):
    barrel(c, 2, 6, 13, 21); barrel(c, 17, 9, 13, 19)


@R.add('barrel', '나무 통 하나', 1, 2, 'round_body', tags=['통', '짐'], rules='가게 옆·골목 끝.')
def _(c):
    # 큰 뚜껑 원반(윗면 8행) + 불룩한 몸
    barrel(c, 1, 9, 14, 21)
    disc(c, 8, 13, 7, 4, 'wood', 5, band=0, rim=False)
    c.ell(8, 13, 7, 4, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 2) if d > 0.72 else (('wood', 4) if (X % 3 == 0) else None))
    c.ell(8, 13, 7, 4, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.8 and dy < -0.2 else None)
    c.R(7, 12, 2, 2, 'iron', 3)


@R.add('coal-bunker', '석탄 상자(리벳 철판 통, 위에서 석탄이 보인다)', 2, 2, 'container', tags=['석탄', '공장', '보일러실'], rules='보일러실·공장 마당·선로 하역장. 앞 칸은 비운다(삽질 자리).')
def _(c):
    x, y, w = 1, 4, 30
    # 아가리(위에서 보이는 사각 안쪽): 뒤 벽 안쪽 면(밝음) → 석탄 더미
    c.R(x, y, w, 14, 'iron', 4); c.HL(x, y, w, 'ink', 1)
    c.R(x + 2, y + 2, w - 4, 3, 'iron', 2)                      # 안쪽 뒤 벽(그늘)
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 3)
        t = 2 if (dy < -0.1 and r > 0.4) else 1 if r > 0.3 else 0
        if rnd(X, Y, 8) > 0.93: return ('iron', 6)
        return ('coal', t)
    c.R(x + 2, y + 5, w - 4, 8, 'coal', 1)
    c.ell(x + w / 2, y + 6, w / 2 - 3, 5, coal)
    c.VL(x + 1, y + 1, 12, 'iron', 6); c.VL(x + w - 2, y + 1, 12, 'iron', 3)
    c.HL(x, y + 13, w, 'iron', 6)                                 # 앞 테(빛)
    # 앞면(리벳 철판)
    c.R(x, y + 14, w, 11, 'iron', 3); c.HL(x, y + 14, w, 'iron', 2)
    rivets(c, x + 2, y + 16, w - 3, 1, 4); rivets(c, x + 2, y + 22, w - 3, 1, 4)
    c.VL(x, y + 14, 11, 'iron', 4); c.VL(x + w - 1, y + 14, 11, 'iron', 1)
    c.R(x + 12, y + 18, 6, 3, 'brass', 3); c.HL(x + 12, y + 18, 6, 'brass', 5)   # 놋쇠 손잡이
    c.HL(x, y + 25, w, 'ink', 1)
    # 삽(통에 기댄)
    c.line(x + 24, y + 1, x + 27, y + 12, 'wood', 4); c.R(x + 25, y + 11, 4, 3, 'iron', 5)


@R.add('coal-heap', '석탄 더미', 2, 1, 'organic', tags=['석탄', '공장 마당'], rules='석탄 칸 옆·선로 하역장. 덩이로 1~3개.')
def _(c):
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 11)
        t = 2 if (dy < -0.3 and r > 0.35) else 1 if r > 0.35 else 0
        if rnd(X, Y, 4) > 0.94: return ('iron', 5)
        return ('coal', t)
    c.ell(16, 12, 15, 7, coal); c.ell(11, 9, 8, 5, coal); c.ell(21, 10, 7, 4, coal)
    c.HL(2, 15, 28, 'ink', 1)


def railing_run(c, x0, x1):
    """무쇠 창살 담 한 줄(동서): 창 머리(점) + 윗 가로대(윗면 2행 밝게 + 앞면 1행) + 세로 창살 + 아래 가로대 +
    낮은 돌 받침(윗면 4행 — 뒤 가장자리 어둡게, 앞 테 밝게 + 앞면 2행) + 먹 접지 선."""
    w = x1 - x0
    for x in range(x0 + 1, x1, 3):
        c.P(x, 0, 'iron', 5); c.R(x, 1, 1, 9, 'iron', 2); c.P(x, 1, 'iron', 4)
    c.R(x0, 2, w, 2, 'iron', 5); c.HL(x0, 2, w, 'iron', 6); c.HL(x0, 4, w, 'iron', 2)      # 윗 가로대: 윗면 + 앞면
    c.HL(x0, 7, w, 'iron', 4); c.HL(x0, 8, w, 'iron', 1)                                  # 아래 가로대
    c.HL(x0, 9, w, 'ink', 1)
    c.R(x0, 10, w, 4, 'stone', 5); c.HL(x0, 10, w, 'stone', 3); c.HL(x0, 13, w, 'stone', 6)   # 받침 윗면
    for x in range(x0 + 7, x1, 8): c.VL(x, 11, 2, 'stone', 4)
    c.R(x0, 14, w, 1, 'stone', 2)                                                          # 받침 앞면
    c.HL(x0, 15, w, 'ink', 1)


def pier(c, x, w=8):
    """담 기둥: 넓은 돌 갓(윗면 6행 — 놋쇠 공 머리) + 앞면."""
    box3(c, x, 1, w, 6, 8, 'stone', tt=5, ft=3)
    c.HL(x, 0, w, 'ink', 1)
    disc(c, x + w / 2, 3.6, w / 2 - 1.6, 1.8, 'brass', 4, band=1, bt=2, rim=False)
    c.HL(x, 15, w, 'ink', 1)


@R.add('fence', '무쇠 창살 담(낮은 돌 받침 위, 한 칸 잇는 조각)', 1, 1, 'other', tags=['울타리', '담', '공원'],
       rules='쌈지 공원·공장 마당 둘레 동서 줄. 3칸 이상이면 fence-h3 를 먼저 쓰고 남는 칸만 이것으로.')
def _(c): railing_run(c, 0, 16)


@R.add('fence-h3', '무쇠 창살 담 세 칸(양 끝 돌 기둥)', 3, 1, 'other', tags=['울타리', '담', '공원'],
       rules='쌈지 공원·공장 마당 둘레 동서 줄에 3칸씩. 문(빈칸) 양옆이 기둥이 되게 둔다.')
def _(c):
    railing_run(c, 0, 48)
    pier(c, 0, 9); pier(c, 39, 9)


@R.add('fence-v', '무쇠 창살 담(남북 줄 — 위에서 길게 보이는 받침 갓)', 1, 1, 'other', tags=['울타리', '담', '공원'],
       rules='쌈지 공원·공장 마당 둘레의 서·동 쪽 남북 줄. 위아래로 이어 칠한다.')
def _(c):
    x0, w = 4, 8
    c.R(x0, 0, w, 16, 'stone', 5); c.VL(x0, 0, 16, 'stone', 6); c.VL(x0 + 1, 0, 16, 'stone', 6); c.VL(x0 + w - 1, 0, 16, 'stone', 3)
    c.VL(x0 - 1, 0, 16, 'ink', 1); c.VL(x0 + w, 0, 16, 'ink', 1); c.VL(x0 + w + 1, 0, 16, 'stone', 1)
    c.VL(x0 + 4, 0, 16, 'iron', 2)
    for y in range(1, 16, 3):
        c.R(x0 + 3, y, 2, 2, 'iron', 4); c.P(x0 + 3, y, 'iron', 6); c.P(x0 + 4, y + 1, 'iron', 2); c.P(x0 + 5, y + 2, 'stone', 3)


@R.add('water-tower', '급수탑(나무 물통 + 무쇠 다리 + 급수관)', 3, 5, 'structure', tags=['급수탑', '선로', '공장'], rules='선로 곁(급수관이 선로 쪽) 또는 공장 마당 모퉁이. 다리 둘레 1칸 비움.')
def _(c):
    # 물통 윗면: 넓은 타원 뚜껑(위에서 보인다) + 가운데 낮은 원뿔 지붕(왼쪽 위 밝게) + 점검 뚜껑
    def lid(X, Y, dx, dy, d):
        if d > 0.86: return ('iron', 4 if dx < 0 else 2)
        k = (dx + dy)
        return ('slate', 5 if k < -0.5 else 4 if k < 0.1 else 3 if k < 0.6 else 2)
    c.ell(24, 11, 19, 9, lid)
    for a in range(12):
        ang = a * math.pi / 6
        c.line(24, 11, round(24 + 17 * math.cos(ang)), round(11 + 7.5 * math.sin(ang)), 'slate', 2 if a % 2 else 3)
    c.ell(24, 11, 3, 1.6, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2)); c.P(23, 8, 'brass', 5); c.P(23, 9, 'brass', 3)
    c.ell(24, 11, 19, 9, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.95 and dy < 0 else None)
    # 통 몸(세로 판자 + 무쇠 테 셋)
    for y in range(13, 40):
        for x in range(5, 44):
            dx = (x + 0.5 - 24) / 19
            if dx * dx > 1: continue
            if y < 20 and (((x + 0.5 - 24) / 19) ** 2 + ((y + 0.5 - 11) / 9) ** 2) <= 1: continue
            u = (x - 5 + 0.5) / 39
            t = 4 if u < 0.25 else 3 if u < 0.6 else 2 if u < 0.85 else 1
            if (x - 5) % 4 == 3: t -= 1
            c.P(x, y, 'wood', max(0, t))
    for by in (25, 33): c.HL(5, by, 39, 'iron', 4); c.HL(5, by + 1, 39, 'iron', 1)
    c.VL(5, 12, 28, 'ink', 1); c.VL(43, 12, 28, 'ink', 1); c.HL(6, 39, 37, 'wood', 1)
    # 받침 판(윗면 3) + 무쇠 다리 넷 + 가새
    box3(c, 3, 40, 42, 3, 2, 'iron', tt=4, ft=2)
    for x in (5, 17, 29, 40):
        c.R(x, 45, 3, 31, 'iron', 3); c.VL(x, 45, 31, 'iron', 5); c.VL(x + 2, 45, 31, 'iron', 1)
    c.line(8, 47, 29, 74, 'iron', 2); c.line(40, 47, 19, 74, 'iron', 2); c.line(8, 61, 40, 61, 'iron', 2)
    for x in (4, 16, 28, 39): box3(c, x, 74, 5, 3, 2, 'stone', tt=5); c.HL(x, 79, 5, 'ink', 1)
    # 급수관(오른쪽으로 내려온 팔 + 주둥이)
    c.R(42, 28, 4, 3, 'iron', 3); c.HL(42, 28, 4, 'iron', 5)
    c.R(44, 31, 3, 16, 'iron', 3); c.VL(44, 31, 16, 'iron', 5)
    c.R(43, 47, 5, 3, 'iron', 2); c.HL(43, 47, 5, 'iron', 4)


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


STEAM = [  # 프레임마다 김 덩이(cx, cy, r) — 아가리 뒤에서 위로, 오른쪽으로 흐른다(아가리를 가리지 않는다)
    [(10, 11, 3.4), (10, 7, 4.0), (9, 2.5, 2.6)],
    [(10, 11, 3.6), (11, 6, 4.2), (10, 2, 2.4)],
    [(10, 11, 3.0), (10, 7, 3.8), (12, 3, 3.0)],
    [(10, 11, 3.6), (9, 6, 3.6), (12, 2.5, 2.6)],
]


@anim('steam-vent', '증기 구멍(쇠 굴뚝 토막에서 김이 오른다)', 4, 1, 2, 'container', tags=['증기', '거리', '공장'], rules='보도 가장자리·공장 마당·배관 끝. 길 칸 위·문 앞에는 두지 않는다.', fps=5)
def steam_vent(c, f):
    cloud(c, STEAM[f])
    # 낮고 넓은 쇠 토막: 큰 아가리(타원 9행) — 두꺼운 테 윗면(밝게) + 안쪽 뒤 벽(그늘 진 쇠) + 깊은 구멍
    c.R(1, 22, 14, 6, 'iron', 3); c.VL(1, 22, 6, 'iron', 4); c.VL(2, 22, 6, 'iron', 4); c.VL(13, 22, 6, 'iron', 2); c.VL(14, 22, 6, 'iron', 1)
    c.HL(1, 25, 14, 'iron', 2); c.HL(1, 26, 14, 'iron', 4)
    c.ell(8, 20, 7.5, 4.8, lambda X, Y, dx, dy, d: ('iron', 6 if dx + dy < -0.4 else 5 if dx < 0.3 else 4))
    c.ell(8, 20.6, 5.2, 3.0, lambda X, Y, dx, dy, d: ('iron', 2) if dy < -0.1 else ('coal', 0))
    c.ell(8, 21.4, 3.6, 1.8, lambda X, Y, dx, dy, d: ('coal', 0))
    c.ell(8, 20, 7.5, 4.8, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.82 and dy < -0.1 else None)
    c.HL(1, 28, 14, 'ink', 1); c.R(0, 29, 16, 2, 'iron', 4); c.HL(0, 29, 16, 'iron', 5); c.HL(0, 31, 16, 'ink', 1)


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
