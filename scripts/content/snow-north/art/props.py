#!/usr/bin/env python3
"""snow_north 야외 소품 — 눈 덮인 가문비·자작, 바위·그루터기·눈더미, 장작더미·훈제 건조대·모피 건조대, 화로·모닥불(움직임),
썰매·스키 걸이·통·상자·자루, 우물, 이정표(글자 없음)·등 기둥·오로라 깃발(추상), 시장 노점 셋, 얼음 벽돌 담·목책·나무 울타리,
얼음 낚시 자리·뒤집힌 배·원뿔 천막·건초·여물통·가마솥·모루·맷돌, 굴뚝 연기(움직임).

3/4: 윗면(밝은 슬래브·눈 덮임, 뒤 가장자리 어두운 선) + 남쪽 앞면(어둡게). 빛 왼쪽 위. 소품 밑 접지 그늘은 짧게(바닥 종류를 가리지 않게).

  python3 props.py      # tiledata/snow-north/props/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, box3, cyl_v, disc
from kit import Reg, contact, OUT
from bparts import plank_wall, icicles, roof_gable, finial, leg, stovepipe
from px import MI

R = Reg('props')
ANIM = []      # (anim id, 이름, [프레임 id…], fps)


def snowcap(c, x, y, w, t=6, lump=True):
    """물건 윗면에 얹힌 눈(가운데 두껍게, 양 끝 얇게, 아래 그늘 한 줄)."""
    for i in range(w):
        u = (i + 0.5) / w
        hh = 1 + (1 if (lump and 0.2 < u < 0.8) else 0)
        for k in range(hh):
            c.P(x + i, y - k, 'snow', t if k == hh - 1 else t - 1)
        c.P(x + i, y + 1, 'snow', 3 if u < 0.7 else 2)


def contact_shadow(c, x, y, w):
    c.HL(x, y, w, 'ink', 2)


def ground_shadow(c, cx, cy, rx, ry):
    """물건 밑 바닥 그늘(위에서 본 타원 — 바닥 면을 읽게 한다)."""
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('snow', 3 if d < 0.75 else 4))


def post_top(c, x, ytop, ybot, w=4, cap=4, snow=True):
    """세운 통나무 기둥 + 위 단면(타원 cap 행, 나이테 — 위에서 보인다) + 단면 뒤쪽 눈."""
    leg(c, x, ytop + cap // 2, ybot, w)
    cx = x + w / 2 - 0.5
    c.ell(cx, ytop + cap / 2 - 0.5, w / 2 + 0.2, cap / 2, lambda X, Y, dx, dy, d: ('log', 1) if d > 0.85 and dy > 0 else ('fur', 5 if d < 0.45 else 4))
    if snow: c.ell(cx - 0.3, ytop + cap / 2 - 1.2, w / 2 - 0.3, cap / 2 - 0.9, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0.2 else 5))


def beam(c, x, y, w, topn=4, front=3, mat='log', snow=True, s=0):
    """가로 들보: 윗면 topn 행(밝음·뒤 어두운 선) + 앞면 front 행. 윗면에 눈 덩이(앞 가장자리 나무는 남김)."""
    box3(c, x, y, w, topn, front, mat)
    if snow:
        for i in range(w):
            k = (i * 7 + s * 3) % 11
            n = topn - 1 if k < 8 else topn - 2
            for j in range(max(1, n)):
                c.P(x + i, y + j, 'snow', 4 if j == 0 else 6 if (i / w) < 0.6 else 5)


# ═══════════════════════ 나무 ═══════════════════════
def _sm(x, s, k=0):
    """부드러운 1차원 잡음 0..1"""
    a = rnd(int(math.floor(x)), k, s); b = rnd(int(math.floor(x)) + 1, k, s)
    f = x - math.floor(x); f = f * f * (3 - 2 * f)
    return a + (b - a) * f


def pine(c, cx, ytop, ybot, half, tiers, s=0, trunk_h=4):
    H = ybot - ytop - trunk_h
    # 바닥 그늘(오른쪽 아래로 끌림, 가장자리 디더)
    c.ell(cx + 2.5, ybot - 1.2, half * 0.9, 2.4, lambda X, Y, dx, dy, d: ('snow', 3) if d < 0.55 else ('snow', 4) if d < 0.85 or (X + Y) % 2 else None)
    for j in range(ybot - trunk_h - 3, ybot):
        c.P(int(cx) - 1, j, 'log', 4); c.P(int(cx), j, 'log', 3); c.P(int(cx) + 1, j, 'log', 1)
        if j % 3 == 0: c.P(int(cx), j, 'log', 2)
    th = H / tiers
    snowmask = set()
    for k in reversed(range(tiers)):
        t0 = ytop + int(k * th * 0.68)
        t1 = ytop + int((k + 1) * th)
        prev_end = ytop + int(k * th) + 1 if k > 0 else t0
        f_vis = (prev_end - t0) / max(1, t1 - t0)
        w_top = max(1.0, half * (k + 0.1) / tiers * 0.7)
        w_bot = half * (k + 1.0) / tiers
        # 아랫선: 가지 덩이(폭 4~5)마다 가운데가 처지고 끝은 바깥으로 뾰족
        def droop(X):
            q = (X - cx) / max(1.0, w_bot)
            cl = (X + k * 2 + s) % 5
            return (1 if cl in (1, 2) else 0) + (1 if abs(q) > 0.75 else 0)
        for j in range(t0, t1 + 3):
            f = (j - t0) / max(1, t1 - t0)
            hw = w_top + (w_bot - w_top) * (min(1.0, f) ** 0.55) + (1.3 if f > 0.82 and k > 0 else 0.6 if f > 0.82 else 0)
            hw += (_sm(j * 0.7, s + k, 3) - 0.35) * 1.4 * (1 if f > 0.25 else 0.4)
            for X in range(int(round(cx - hw - 1)), int(round(cx + hw + 1)) + 1):
                if j > t1 + droop(X) - 1: continue
                dxn = (X + 0.5 - cx) / max(1.0, hw)
                if abs(dxn) > 1.0: continue
                u = (dxn + 1) / 2
                # 덩이: 5칸 단위, 덩이 안 왼쪽 위가 밝다
                cl = (X + k * 2 + s) % 5
                lit = 0.62 * (1 - u) + 0.38 * (1 - min(1.0, f))
                lit += (0.16 if cl in (0, 1) else -0.1 if cl == 4 else 0)
                lit += (rnd(X, j, s + 9) - 0.5) * 0.22
                if j >= t1 + droop(X) - 1: lit -= 0.55
                elif j >= t1 + droop(X) - 3: lit -= 0.25            # 가지 밑 그늘
                g = 1 + int(max(0, min(3.99, lit * 4.4)))
                if (X * 2 + j + k) % 7 == 0 and u < 0.55: g = min(5, g + 1)   # 바늘잎 반짝
                c.P(X, j, 'pine', g)
                # 눈 덩이: 층 윗부분(왼쪽 두껍게) + 물결 경계
                sf = f_vis + (0.34 if k == 0 else 0.2) * (1 - 0.75 * u) + (_sm(X * 0.55, s + k, 7) - 0.5) * 0.18
                if f < sf:
                    depth = sf - f
                    if depth < 0.07: t = 3 if u > 0.5 else 4
                    elif depth < 0.15: t = 4 if u > 0.6 else 5
                    else: t = 6 if u < 0.42 else 5
                    if t == 5 and rnd(X, j, s + 13) < 0.08: t = 6
                    c.P(X, j, 'snow', t); snowmask.add((X, j))
            # 눈 방울(가지 끝 처진 덩이)
        for X in range(int(round(cx - w_bot)), int(round(cx + w_bot)) + 1):
            if (X + k * 3 + s) % 6 == 0 and abs(X - cx) > 1:
                y = t1 - 1 + droop(X) - 1
                if c.on(X, y) and c.get(X, y)[0] == 'pine':
                    c.P(X, y, 'snow', 4)
    # 꼭대기 눈 모자
    c.P(int(cx), ytop - 1, 'snow', 5); c.P(int(cx), ytop, 'snow', 6); c.P(int(cx) - 1, ytop + 1, 'snow', 6); c.P(int(cx) + 1, ytop + 1, 'snow', 4)
    tone_outline(c, ground_rows=4)


def tone_outline(c, ground_rows=4, SNOWTONE=('pine', 0)):
    """실루엣 바깥 1px 을 재질 색조의 짙은 톤으로(잎 → pine 0, 눈 → snow 1, 나무 → log 0, 돌 → stone 1). 바닥 그늘 행은 건너뛴다."""
    from px import MI, MATS
    m0 = c.m.copy(); t0 = c.t.copy(); pts = []
    tone = {'pine': ('pine', 0), 'snow': SNOWTONE, 'log': ('log', 0), 'stone': ('stone', 1), 'birch': ('birch', 0), 'fur': ('fur', 0)}
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] >= 0: continue
            best = None
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < c.w and 0 <= Y < c.h and m0[Y, X] >= 0:
                    mat = MATS[m0[Y, X]]
                    if mat == 'snow' and Y > c.h - ground_rows - 1 and t0[Y, X] <= 4: continue
                    if mat in tone: best = tone[mat]; break
            if best: pts.append((x, y, best))
    for x, y, b in pts: c.P(x, y, *b)


def bush2(c, s=0):
    """덩이 셋 겹친 눈 덮인 덤불."""
    c.ell(9, 13.5, 6.5, 1.8, lambda X, Y, dx, dy, d: ('snow', 3) if d < 0.6 else ('snow', 4))
    for (bx, by, r) in ((5, 9.5, 4.2), (11, 9, 4.6), (8, 6.5, 4.4)):
        c.ell(bx, by, r, r * 0.85, lambda X, Y, dx, dy, d: ('pine', max(1, min(5, int(1 + 4.2 * (0.55 * (1 - (dx + 1) / 2) + 0.45 * (1 - (dy + 1) / 2) + (rnd(X, Y, s) - 0.5) * 0.3))))))
    for (x, y) in ((3, 10), (7, 12), (13, 11), (10, 8), (5, 7)): c.P(x, y, 'pine', 0)
    for (bx, by, r) in ((5, 8.6, 3.6), (11, 7.8, 3.8), (8, 4.8, 3.6)):
        c.ell(bx - 0.3, by, r, r * 0.55, lambda X, Y, dx, dy, d: (('snow', 6 if dx < -0.1 and dy < 0 else 5) if d < 0.75 else ('snow', 4 if dx < 0.4 else 3)) if dy < 0.45 else None)
    c.P(6, 3, 'snow', 6); c.P(12, 6, 'snow', 6)
    tone_outline(c, ground_rows=3)


def boulder2(c, cx, cy, rx, ry, s=0):
    """깎인 면이 있는 바위 + 두꺼운 눈 모자(4단) + 균열."""
    def body(X, Y, dx, dy, d):
        lit = 0.55 * (1 - (dx + 1) / 2) + 0.45 * (1 - (dy + 1) / 2)
        facet = h32(int((X - cx) // 3), int((Y - cy) // 3), s) % 3
        lit += (facet - 1) * 0.08 + (rnd(X, Y, s + 5) - 0.5) * 0.14
        t = 1 + int(max(0, min(4.99, lit * 5.5)))
        if d > 0.8 and dy > 0.2: t = max(1, t - 1)
        return ('stone', t)
    c.ell(cx + 1, cy + ry * 0.75, rx * 0.95, ry * 0.4, lambda X, Y, dx, dy, d: ('snow', 3) if d < 0.7 else ('snow', 4))
    c.ell(cx, cy, rx, ry, body)
    for k in range(3):
        x0 = int(cx + (h32(k, s, 1) % 5) - 2); y0 = int(cy + 1)
        for q in range(int(ry * 0.7)):
            c.P(x0 + (q // 2) * (1 if k % 2 else -1), y0 + q, 'stone', 1)
    c.ell(cx - rx * 0.1, cy - ry * 0.38, rx * 0.88, ry * 0.6,
          lambda X, Y, dx, dy, d: (('snow', 6 if dx < -0.15 and dy < 0.1 else 5 if dx < 0.45 else 4) if d < 0.7 else ('snow', 4 if dx < 0.3 else 3)) if dy < 0.5 + (_sm(X * 0.6, s, 2) - 0.5) * 0.5 else None)
    c.P(int(cx - rx * 0.4), int(cy - ry * 0.75), 'snow', 6)
    tone_outline(c, ground_rows=3, SNOWTONE=('stone', 1))


def outline_dark(c, mat_ok=('pine',)):
    """실루엣 바깥 1px 먹(잎 덩이만)."""
    m0 = c.m.copy(); pts = []
    from px import MI
    ids = {MI[m] for m in mat_ok} | {MI['snow']}
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] >= 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < c.w and 0 <= Y < c.h and m0[Y, X] in ids and not (m0[Y, X] == MI['snow'] and Y > c.h - 5):
                    pts.append((x, y)); break
    for x, y in pts: c.P(x, y, 'ink', 1)


@R.add('pine-s', '어린 가문비(눈 덮임)', 1, 2, 'organic', tags=['나무', '가문비', '숲'], rules='숲 가장자리·길가에 2~4 그루 덩이로. 한 줄로 늘어놓지 않는다.')
def _(c): pine(c, 7.5, 3, 31, 7, 3, s=1, trunk_h=3)


@R.add('pine-m', '가문비(눈 덮임, 중간)', 2, 3, 'organic', tags=['나무', '가문비', '숲'], rules='숲 덩이의 몸통. 간격을 흔들어 3~7 그루 덩이로.')
def _(c): pine(c, 15.5, 4, 46, 12, 4, s=2)


@R.add('pine-l', '큰 가문비(눈 덮임)', 2, 4, 'organic', tags=['나무', '가문비', '숲'], rules='숲 안쪽·마을 뒤 큰 나무. 덩이 가운데에.')
def _(c): pine(c, 15.5, 4, 62, 14, 5, s=3, trunk_h=5)


@R.add('pine-pair', '가문비 두 그루(겹침)', 3, 4, 'organic', tags=['나무', '가문비', '숲'], rules='숲 덩이 메우기. 홀로 두지 않는다.')
def _(c):
    pine(c, 30.5, 10, 62, 13, 4, s=4)
    pine(c, 16.5, 2, 63, 15, 5, s=5, trunk_h=5)
    pass


def birch(c, cx, ytop, ybot, s=0, spread=10, leaves=False):
    """잎 진 자작: 흰 줄기(검은 띠 무늬) + 가늘게 갈라지는 잔가지(눈 얹힘) 덩이."""
    # 그늘
    c.ell(cx + 2, ybot - 1, 6, 1.8, lambda X, Y, dx, dy, d: ('snow', 3 if d < 0.6 else 4))
    tw = 4
    for j in range(ytop + 8, ybot):
        for i in range(tw):
            t = 4 if i == 0 else 4 if i == 1 and j % 3 else 3 if i < 3 else 2
            if h32(j // 2, i, s + 3) % 5 == 0: t = 0 if i < 3 else 1
            elif h32(j // 2, i, s + 3) % 5 == 1 and i in (1, 2): t = 1
            c.P(int(cx) - 1 + i, j, 'birch', t)
    # 가지(재귀 없이 몇 갈래)
    import random
    rr = random.Random(s)
    tips = []
    def branch(x, y, ang, ln, depth):
        x1 = x + math.cos(ang) * ln; y1 = y - math.sin(ang) * ln
        n = max(1, int(ln))
        for q in range(n + 1):
            X = round(x + (x1 - x) * q / n); Y = round(y + (y1 - y) * q / n)
            c.P(X, Y, 'birch', 3 if depth < 1 else 2 if depth < 3 else 1)
            if depth < 2 and math.cos(ang) < 0.4: c.P(X + 1, Y, 'birch', 1)
            if depth >= 1 and q % 3 == 1 and not c.on(X, Y - 1): c.P(X, Y - 1, 'snow', 6 if X < cx else 5)   # 가지 위 눈
        if depth >= 4 or ln < 2.2: tips.append((x1, y1)); return
        for da in (-0.5, 0.45):
            branch(x1, y1, ang + da + rr.uniform(-0.15, 0.15), ln * 0.62, depth + 1)
    base_y = ytop + 14
    branch(cx, base_y + 6, math.pi / 2, (base_y + 6 - ytop) * 0.55, 0)
    for a in (2.2, 0.9):
        branch(cx, base_y + 2, a, spread * 0.7, 1)
    for (x, y) in tips:
        X, Y = int(round(x)), int(round(y))
        c.P(X, Y - 1, 'snow', 6); c.P(X + 1, Y - 1, 'snow', 4)
    tone_outline(c, ground_rows=3, SNOWTONE=('birch', 1))
    c.P(int(cx), ybot - 1, 'birch', 1); c.HL(int(cx) - 2, ybot - 1, 5, 'snow', 5)


@R.add('birch', '잎 진 자작(눈 얹힌 잔가지)', 2, 3, 'organic', tags=['나무', '자작', '겨울나무'], rules='호숫가·마을 길가에 1~3 그루. 가문비 덩이 가장자리에 섞는다.')
def _(c): birch(c, 15.5, 2, 47, s=7, spread=13)


@R.add('birch-s', '어린 자작(가는 줄기 둘)', 1, 3, 'organic', tags=['나무', '자작'], rules='울타리 곁·집 뒤.')
def _(c):
    birch(c, 6.5, 6, 47, s=8, spread=6)
    for j in range(20, 46): c.P(11, j, 'birch', 3 if h32(j, 1, 2) % 4 else 0)
    c.line(11, 20, 14, 14, 'birch', 2); c.P(14, 13, 'snow', 6)


@R.add('bush', '눈 덮인 덤불', 1, 1, 'organic', tags=['덤불', '풀'], rules='집 둘레·길가·바위 곁에 1~3 개.')
def _(c): bush2(c)


def boulder(c, cx, cy, rx, ry, s=0):
    boulder2(c, cx, cy, rx, ry, s)


@R.add('boulder-s', '눈 덮인 바위(작음)', 1, 1, 'organic', tags=['바위', '돌'], rules='숲가·길 모퉁이·호숫가에 덩이로. 길을 막지 않게.')
def _(c): boulder(c, 8, 9.5, 7, 5.5, 1)


@R.add('boulder-l', '눈 덮인 큰 바위', 2, 2, 'organic', tags=['바위', '돌'], rules='들판 가장자리·호숫가의 큰 바위. 둘레에 작은 바위·덤불.')
def _(c):
    boulder(c, 18, 19, 13, 10, 2)
    boulder(c, 7, 24, 6, 5, 3)


@R.add('stump', '눈 덮인 그루터기', 1, 1, 'organic', tags=['그루터기', '나무'], rules='숲 둘레·벌목터·장작더미 곁.')
def _(c):
    cyl_v(c, 3, 6, 10, 9, 5, 'log', base=4)
    disc(c, 8, 8, 5, 2.6, 'fur', 5, band=0, rim=False)
    c.ell(8, 8, 2.4, 1.2, lambda X, Y, dx, dy, d: ('fur', 3) if 0.4 < d else ('fur', 4))
    c.ell(6, 7.5, 3.5, 1.6, lambda X, Y, dx, dy, d: ('snow', 6))
    c.HL(3, 15, 10, 'snow', 4); c.P(2, 14, 'log', 2); c.P(13, 14, 'log', 1)


@R.add('drift', '눈더미(바람에 쌓인 둔덕)', 2, 1, 'organic', tags=['눈', '눈더미'], rules='넓은 눈밭·집 북쪽·울타리 바람받이에. 흰 판을 깨는 데 쓴다. 지나갈 수 없다.')
def _(c):
    for i in range(32):
        hh = int(5 + 5 * math.sin(math.pi * (i + 0.5) / 32) + math.sin(i * 0.6) * 1.2)
        for k in range(hh):
            y = 14 - k
            t = 6 if k == hh - 1 else 5 if k > hh - 4 else 4 if k > 2 else 3
            if i > 22: t -= 1
            c.P(i, y, 'snow', max(2, t))
    c.HL(1, 15, 30, 'snow', 3)
    outline_dark(c, ('snow',))


@R.add('cairn', '돌무더기 이정표(눈 얹힘)', 1, 2, 'structure', tags=['돌무더기', '이정표', '길'], rules='길 갈림목·고갯마루·마을 어귀.')
def _(c):
    for k, (y, rx) in enumerate(((24, 6.5), (17, 5), (11, 3.8), (6, 2.6))):
        c.ell(8, y, rx, rx * 0.65, lambda X, Y, dx, dy, d, k=k: ('stone', (5 if dx < -0.2 else 4 if dx < 0.4 else 2) - (k % 2)))
        c.ell(7.5, y - rx * 0.35, rx * 0.8, rx * 0.3, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))
    c.HL(2, 29, 12, 'snow', 3)
    outline_dark(c, ('stone', 'snow'))


@R.add('rune-stone', '새김 돌(추상 띠 무늬, 글자 없음)', 1, 2, 'structure', tags=['돌', '비석', '전당'], rules='전당 앞마당·고갯길. 글자가 아닌 엮음 띠 무늬.')
def _(c):
    for j in range(5, 29):
        hw = 5 if j > 8 else 5 - (8 - j) * 0.7
        for X in range(int(8 - hw), int(8 + hw) + 1):
            u = (X - (8 - hw)) / (2 * hw)
            c.P(X, j, 'stone', 5 if u < 0.3 else 4 if u < 0.65 else 3)
    for j in range(9, 26):                                    # 엮음 띠(구불구불 두 줄)
        x1 = 8 + round(2.2 * math.sin(j * 0.55)); x2 = 8 - round(2.2 * math.sin(j * 0.55))
        c.P(x1, j, 'red', 2); c.P(x2, j, 'red', 1)
    c.ell(7.5, 6, 4.5, 2.2, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))
    c.HL(3, 29, 11, 'snow', 3)
    outline_dark(c, ('stone', 'snow'))


@R.add('reeds', '얼어붙은 갈대(호숫가)', 1, 1, 'organic', tags=['갈대', '물가', '호수'], rules='호수·강 물가 둑에 줄지어 2~5 개.')
def _(c):
    for k, x in enumerate((3, 5, 7, 9, 11, 13)):
        top = 2 + (k * 5) % 6
        for y in range(top, 15): c.P(x, y, 'tundra', 3 if y < top + 3 else 2)
        c.P(x, top - 1, 'snow', 6); c.P(x - 1 + (k % 2) * 2, top + 2, 'tundra', 4)
    c.HL(2, 15, 12, 'snow', 4)


# ═══════════════════════ 마을 살림 ═══════════════════════
def log_end(c, x, y, r=2.6, s=0):
    """통나무 단면(나이테)."""
    c.ell(x, y, r, r, lambda X, Y, dx, dy, d: ('log', 1) if d > 0.82 else ('fur', 5 if d < 0.25 else 4 if (int(d * 6) % 2) else 5))


@R.add('woodpile', '장작더미(처마 지붕 밑, 단면 나이테)', 2, 2, 'structure', tags=['장작', '땔감', '집'], rules='집 옆벽·뒤뜰. 문을 막지 않게 벽에 붙인다.')
def _(c):
    # 뒤 판자 + 작은 지붕
    plank_wall(c, 2, 6, 28, 20, mat='drift', base=2, s=3)
    for row in range(3):
        for k in range(5 if row % 2 == 0 else 4):
            log_end(c, 6 + k * 5 + (2.5 if row % 2 else 0), 22 - row * 5, 2.5)
    roof_gable(c, 0, 1, 32, 9, s=4, under='drift', peeks=0, inset=1, cornice=3, ice_len=2, barge=True, ridge=True)
    c.HL(1, 27, 30, 'log', 2); c.HL(1, 28, 30, 'ink', 1)
    c.HL(0, 30, 32, 'snow', 4)


@R.add('logs', '장작 한 무더기(눈 얹힘)', 1, 1, 'organic', tags=['장작', '땔감'], rules='장작더미·도끼 받침 곁에 하나.')
def _(c):
    for k, (x, y) in enumerate(((4, 11), (9, 11), (6.5, 7), (11.5, 7.5))):
        c.R(int(x) - 3, int(y) - 2, 6, 5, 'log', 3); c.HL(int(x) - 3, int(y) - 2, 6, 'log', 4)
        log_end(c, x - 3, y, 2.2)
    snowcap(c, 4, 4, 9)
    c.HL(1, 14, 14, 'ink', 2)


@R.add('chopping-block', '도끼 박힌 장작 받침', 1, 1, 'round_body', tags=['장작', '도끼', '대장'], rules='장작더미 곁 한 칸.')
def _(c):
    cyl_v(c, 3, 6, 10, 9, 5, 'log', base=4)
    disc(c, 8, 8, 5, 2.6, 'fur', 5, band=0, rim=False)
    c.line(9, 8, 13, 1, 'log', 4); c.line(10, 8, 14, 1, 'log', 2)
    c.R(6, 6, 5, 3, 'iron', 4); c.HL(6, 6, 5, 'iron', 5); c.P(6, 8, 'iron', 2)
    c.P(4, 7, 'snow', 6); c.P(5, 7, 'snow', 5)
    c.HL(3, 15, 10, 'ink', 2)


def rack_frame(c, x0, x1, ytop, ybot, s=0):
    """건조대 틀: 두 기둥(위 단면 보임) + 굵은 가로 들보(윗면 4행·눈) + 밑 그늘."""
    ground_shadow(c, (x0 + x1) / 2 + 2, ybot - 1, (x1 - x0) / 2 + 3, 2.4)
    for X in (x0, x1): post_top(c, X, ytop - 3, ybot, 4, 4)
    beam(c, x0 - 1, ytop, x1 - x0 + 6, 4, 3, s=s)
    for X in (x0, x1):                                       # 기둥 머리가 들보 위로 솟는다
        cx = X + 1.5
        c.ell(cx, ytop - 1.5, 2.2, 2, lambda X_, Y, dx, dy, d: ('log', 1) if d > 0.85 and dy > 0 else ('fur', 5 if d < 0.45 else 4))
        c.P(int(cx) - 1, ytop - 3, 'snow', 6); c.P(int(cx), ytop - 3, 'snow', 6)


@R.add('fish-rack', '생선 말리는 덕장(대구 줄줄이, 작은 박공 지붕)', 2, 2, 'frame', tags=['생선', '건조대', '부두', '훈제'], rules='훈제막·부두·어부 집 곁. 앞 1칸 비움.')
def _(c):
    ground_shadow(c, 16, 29, 15, 2.4)
    for X in (2, 26): leg(c, X, 6, 30, 4)
    beam(c, 4, 24, 24, 4, 2, snow=False)                      # 아래 가로대(나무 윗면 4행)
    for i in range(6, 14): c.P(i, 25, 'snow', 6)
    c.R(4, 9, 24, 2, 'log', 2)
    for k, X in enumerate(range(7, 26, 3)):
        ln = 7 + (k % 3)
        for j in range(ln):
            t = 4 if j < 2 else 3 if j < ln - 3 else 2
            c.P(X, 11 + j, 'hide', t); c.P(X + 1, 11 + j, 'hide', t - 1)
        c.P(X, 11 + ln, 'hide', 1); c.P(X + 1, 11 + ln, 'hide', 0)
    roof_gable(c, 0, 0, 32, 10, s=11, under='shingle', peeks=1, inset=2, cornice=3, ice_len=2)


@R.add('hide-rack', '모피 펴 말리는 틀', 2, 2, 'frame', tags=['모피', '가죽', '사냥꾼'], rules='사냥꾼 집·시장 모피 노점 곁.')
def _(c):
    rack_frame(c, 2, 26, 6, 30, s=2)
    beam(c, 5, 24, 22, 3, 2, snow=True, s=4)                 # 아래 가로대(윗면)
    c.ell(16, 18.5, 9, 6, lambda X, Y, dx, dy, d: ('fur', 4 if dx + dy < -0.3 else 3 if d < 0.7 else 2) if d < 1 else None)
    for (x, y, x2, y2) in ((9, 14, 7, 13), (23, 14, 25, 13), (9, 23, 7, 24), (23, 23, 25, 24)): c.line(x, y, x2, y2, 'straw', 1)
    for (x, y) in ((13, 16), (19, 19), (15, 21)): c.P(x, y, 'fur', 5)


def brazier(c, fr):
    """쇠 화로: 세 다리 + 위에서 들여다보이는 넓은 그릇(두꺼운 테 + 안쪽 숯 바닥) + 가운데 가는 불꽃 3프레임."""
    ground_shadow(c, 8, 29.5, 6.5, 1.6)
    for (x0, x1) in ((4, 1), (12, 15), (8, 8)):
        c.line(x0, 21, x1, 29, 'iron', 2 if x0 < 8 else 1)
    c.ell(7.5, 20, 6.5, 3, lambda X, Y, dx, dy, d: ('iron', 2 if dx < 0 else 1) if dy > 0 else None)   # 그릇 앞 배
    c.ell(7.5, 17.5, 7.5, 4.2, lambda X, Y, dx, dy, d: ('iron', 5 if dx + dy < -0.5 else 4 if dy < 0.2 else 3) if d > 0.7 else
          ('stone', 1 if dy < -0.35 else 2) if d > 0.45 else ('fire', 2 if dy < 0 else 1))
    c.ell(7.5, 17.5, 7.5, 4.2, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.9 and dy < -0.1 else None)
    for (x, y) in ((5, 18), (10, 17), (7, 19), (9, 19)): c.P(x, y, 'fire', 3)
    flames = [[(6, 4), (8, 7), (10, 3)], [(6, 6), (8, 4), (10, 5)], [(6, 3), (8, 6), (10, 5)]][fr]
    for (fx, fh) in flames:
        for k in range(fh + 2):
            t = 4 if k < 2 else 3 if k < 4 else 2 if k < fh else 1
            c.P(fx, 17 - k, 'fire', t)
            if k < 2: c.P(fx + 1, 17 - k, 'fire', 3)
    c.P(8, 6 + fr, 'fire', 3)


for fr in range(3):
    R.add('brazier' if fr == 0 else 'brazier-f%d' % fr, '쇠 화로(타오름)' + ('' if fr == 0 else ' 프레임 %d' % (fr + 1)), 1, 2, 'container',
          tags=['화로', '불', '광장'], rules='광장·문 앞 양옆·망루 곁. 둘레 1칸 비움.')(lambda c, fr=fr: brazier(c, fr))
ANIM.append(('brazier-anim', '쇠 화로 불꽃', ['brazier', 'brazier-f1', 'brazier-f2'], 6))


def bonfire(c, fr):
    """모닥불: 돌 고리(윗면 보이는 원) + 엇갈린 장작 + 불꽃 3프레임 + 둘레 녹은 눈."""
    c.ell(16, 22, 14, 8, lambda X, Y, dx, dy, d: ('slush', 2 if d < 0.8 else 3))
    for k in range(10):
        a = k / 10 * 2 * math.pi
        x = 16 + math.cos(a) * 10; y = 22 + math.sin(a) * 5.5
        c.ell(x, y, 2.4, 1.8, lambda X, Y, dx, dy, d: ('stone', 5 if dy < 0 else 3))
        c.P(int(x), int(y) - 2, 'snow', 6)
    for (x0, y0, x1, y1) in ((10, 25, 22, 19), (22, 25, 10, 19), (16, 26, 16, 18)):
        c.line(x0, y0, x1, y1, 'log', 2); c.line(x0, y0 - 1, x1, y1 - 1, 'log', 4)
    c.ell(16, 22, 6, 3, lambda X, Y, dx, dy, d: ('fire', 3 if d < 0.5 else 2))
    fl = [[(12, 7), (16, 11), (20, 8)], [(12, 9), (16, 8), (20, 10)], [(13, 8), (16, 12), (19, 7)]][fr]
    for (fx, fh) in fl:
        for k in range(fh + 3):
            hw = max(0, 3 - k // 3)
            for X in range(fx - hw, fx + hw + 1):
                t = 4 if k < 3 else 3 if k < 6 else 2 if k < fh else 1
                c.P(X, 21 - k + (1 if abs(X - fx) == hw and hw else 0), 'fire', t)
    for (sx, sy) in [((14, 5), (19, 3)), ((15, 3), (20, 6)), ((13, 4), (18, 2))][fr]:
        c.P(sx, sy, 'fire', 4)


for fr in range(3):
    R.add('bonfire' if fr == 0 else 'bonfire-f%d' % fr, '모닥불(돌 고리 속 타는 장작)' + ('' if fr == 0 else ' 프레임 %d' % (fr + 1)), 2, 2, 'organic',
          tags=['모닥불', '불', '야영'], rules='광장 가운데·야영지·천막 앞. 둘레 1칸 비우고 통나무 의자.')(lambda c, fr=fr: bonfire(c, fr))
ANIM.append(('bonfire-anim', '모닥불 불꽃', ['bonfire', 'bonfire-f1', 'bonfire-f2'], 6))


def smoke(c, fr):
    """굴뚝 연기(위로 흩어지는 덩이 3프레임) — 굴뚝 칸 바로 위에 놓는다. 사람 위로 그려진다.
    혼자서는 윗면이 없는 효과라 굴뚝 집과 합친 조립 그림(gate_assembled.py)으로 관문을 지난다."""
    for k in range(5):
        y = 30 - k * 6 - (fr * 2) % 6
        x = 7.5 + math.sin((k + fr * 0.7) * 0.9) * 2.0 + k * 0.4
        r = 3.4 + k * 0.5
        if y < 2: continue
        c.ell(x, y, r, r * 0.85, lambda X, Y, dx, dy, d, k=k: ('smoke', (4 if dx + dy < -0.2 else 3 if dx + dy < 0.6 else 2) - (1 if k > 3 else 0)))


for fr in range(3):
    R.add('smoke' if fr == 0 else 'smoke-f%d' % fr, '굴뚝 연기' + ('' if fr == 0 else ' 프레임 %d' % (fr + 1)), 1, 2, 'part',
          tags=['연기', '굴뚝'], rules='건물 굴뚝 칸(chim_cell) 바로 위 두 칸에 놓는다. 머리 위로 그려진다.')(lambda c, fr=fr: smoke(c, fr))
ANIM.append(('smoke-anim', '굴뚝 연기', ['smoke', 'smoke-f1', 'smoke-f2'], 3))


def sled_deck(c, x, y, w, topn=7):
    """위에서 내려다본 썰매 바닥(가로 판자 줄 + 뒤 어두운 선) + 앞 두께 + 남쪽 날 한 줄. 동쪽 머리는 둥글게(위에서 본 모양)."""
    ground_shadow(c, x + w / 2, y + topn + 3, w / 2 + 1, 1.6)
    box3(c, x, y, w, topn, 2, 'log', tt=4, ft=2)
    for j in range(y + 2, y + topn - 1, 2): c.HL(x + 1, j, w - 2, 'log', 3)
    for k in range(topn + 2):                                # 동쪽 둥근 머리
        e = int(round(3 * (1 - abs((k - (topn + 1) / 2) / ((topn + 1) / 2)) ** 2)))
        for i in range(e): c.P(x + w + i, y + k, 'log', 4 if k < topn else 2)
    c.HL(x - 1, y + topn + 2, w + 3, 'iron', 3)                # 남쪽 날
    for X in (x + 3, x + w - 4): c.VL(X, y + topn, 2, 'log', 1)


@R.add('sled', '짐 썰매(나무 바닥·상자와 자루 짐)', 2, 1, 'low_furniture', tags=['썰매', '짐', '운송'], rules='눈길 가·시장·창고 앞. 길 가운데 두지 않는다.')
def _(c):
    sled_deck(c, 2, 4, 24, 8)
    box3(c, 5, 1, 10, 6, 4, 'drift', tt=4)                     # 상자(윗면 판자 줄)
    for j in (3, 5): c.HL(6, j, 8, 'drift', 3)
    for i in range(6, 10): c.P(i, 2, 'snow', 6)
    c.ell(20, 7, 4.5, 3.5, lambda X, Y, dx, dy, d: ('hide', 4 if dx + dy < -0.3 else 3 if d < 0.7 else 2))   # 자루
    c.ell(19.5, 5.2, 2.5, 1.3, lambda X, Y, dx, dy, d: ('snow', 6))
    c.P(20, 4, 'straw', 1)


@R.add('sled-wood', '장작 실은 썰매', 2, 1, 'low_furniture', tags=['썰매', '장작'], rules='장작더미·벌목터 곁.')
def _(c):
    sled_deck(c, 2, 4, 24, 8)
    # 눕힌 통나무 묶음을 위에서 본다: 가로 원통 넷이 앞뒤로 나란히(뒤가 위) — 윗면이 줄무늬 판처럼 보인다
    for k, y in enumerate((2, 4, 6, 8)):
        x0, x1 = 6 + (k % 2), 21 - (k % 2)
        for i in range(x0, x1):
            c.P(i, y, 'log', 5 if (i + k) % 7 else 6); c.P(i, y + 1, 'log', 3)
        c.P(x0 - 1, y, 'fur', 5); c.P(x0 - 1, y + 1, 'fur', 4); c.P(x1, y, 'log', 2); c.P(x1, y + 1, 'log', 1)
    c.HL(6, 10, 15, 'log', 1)
    for i in range(8, 15): c.P(i, 2, 'snow', 6)
    c.HL(10, 3, 1, 'straw', 1); c.VL(13, 2, 8, 'straw', 1)


@R.add('ski-rack', '스키 통(나무 통에 꽂아 세운 스키 셋)', 1, 2, 'container', tags=['스키', '집'], rules='집 문 옆벽에 붙인다(문은 비움).')
def _(c):
    cyl_v(c, 1, 17, 14, 11, 8, 'log', base=4, band=(3, 8))     # 통(위 타원 8행)
    c.ell(8, 21, 7, 4, lambda X, Y, dx, dy, d: ('iron', 3 if dy < 0 else 2) if d > 0.8 else ('log', 0 if dy < 0 else 1))   # 안쪽(어둡다)
    for k, X in enumerate((4, 8, 11)):
        mat = 'red' if k == 1 else 'log'
        for j in range(2 + k, 23): c.P(X, j, mat, 4 if j > 4 else 5); c.P(X + 1, j, mat, 2)
        c.P(X, 1 + k, mat, 5)
    c.ell(4, 18.5, 2.5, 1, lambda X, Y, dx, dy, d: ('snow', 6))
    c.HL(1, 30, 14, 'ink', 2)


@R.add('barrel', '나무 통(눈 뚜껑)', 1, 1, 'round_body', tags=['통', '창고'], rules='가게·부두·선술집 앞에 1~3 개.')
def _(c):
    cyl_v(c, 3, 2, 10, 12, 5, 'log', base=4, band=(3, 9))
    for by in (5, 11):
        c.HL(3, by, 10, 'iron', 3)
    c.ell(8, 4.5, 5, 2.5, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))
    c.HL(3, 15, 10, 'ink', 2)


def barrel_top(c, x0, w=10):
    """sn-barrel 과 같은 통(세운 원통 + 쇠테 + 눈 뚜껑) — 낱개 통이 관문을 지난 그림을 그대로 쓴다."""
    cyl_v(c, x0, 2, w, 12, 5, 'log', base=4, band=(3, 9))
    for by in (5, 11): c.HL(x0, by, w, 'iron', 3)
    c.ell(x0 + w / 2, 4.5, w / 2, 2.5, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))


@R.add('barrels', '통 두 개와 상자', 2, 1, 'round_body', tags=['통', '상자', '창고'], rules='창고·시장 뒤.')
def _(c):
    box3(c, 21, 4, 10, 6, 5, 'drift', tt=4)
    for j in (6, 8): c.HL(22, j, 8, 'drift', 3)
    for i in range(22, 25): c.P(i, 5, 'snow', 6)
    barrel_top(c, 0); barrel_top(c, 10)
    c.HL(0, 15, 31, 'ink', 2)


@R.add('crates', '나무 상자 더미', 2, 2, 'box', tags=['상자', '창고', '시장'], rules='창고·부두·시장 뒤편. 길을 막지 않게 벽 쪽.')
def _(c):
    ground_shadow(c, 16, 29, 15, 2)
    def crate(x, y, w, topn, front):
        box3(c, x, y, w, topn, front, 'drift', tt=4)
        for j in range(y + 2, y + topn - 1, 2): c.HL(x + 1, j, w - 2, 'drift', 3)
        c.line(x + 1, y + topn + 1, x + w - 2, y + topn + front - 2, 'drift', 1)
        c.VL(x + 2, y + topn, front, 'drift', 4); c.VL(x + w - 3, y + topn, front, 'drift', 2)
    crate(2, 13, 14, 7, 10); crate(16, 15, 13, 6, 9)
    crate(7, 2, 13, 7, 9)
    for (x, y, w) in ((8, 3, 6), (3, 14, 4), (21, 16, 5)):
        for i in range(w): c.P(x + i, y, 'snow', 6); c.P(x + i, y + 1, 'snow', 5 if i < w - 1 else 4)


@R.add('sacks', '곡식 자루(눈 얹힘)', 1, 1, 'other', tags=['자루', '곡식', '시장'], rules='방앗간·창고·시장 노점 곁.')
def _(c):
    for (x, y, r) in ((5, 10, 4.5), (11, 10.5, 4.2), (8, 6, 4)):
        c.ell(x, y, r, r * 0.85, lambda X, Y, dx, dy, d: ('straw', 3 if dx + dy < -0.3 else 2 if d < 0.75 else 1))
        c.P(int(x), int(y - r * 0.8), 'log', 1)
    c.ell(7, 3.5, 3, 1.3, lambda X, Y, dx, dy, d: ('snow', 6))
    c.HL(1, 15, 14, 'ink', 2)


@R.add('well', '우물(돌 둘레·눈 지붕·두레박)', 2, 2, 'structure', tags=['우물', '광장', '물'], rules='광장·길 교차 가까이. 둘레 1칸 비움, 진창(sn-at-slush) 작은 덩이.')
def _(c):
    # 돌 둘레(윗면 원 + 앞면 돌)
    for j in range(20, 30):
        for i in range(4, 28):
            k = (i + (3 if (j // 3) % 2 else 0)) % 6
            t = 4 if i < 14 else 3
            if k == 5 or (j - 20) % 3 == 2: t = 1
            c.P(i, j, 'stone', t)
    c.ell(16, 20, 12, 4.5, lambda X, Y, dx, dy, d: ('stone', 5) if d > 0.55 else ('water', 0 if d < 0.3 else 1))
    c.ell(16, 20, 12, 4.5, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5) if d > 0.7 and dy < 0 else None)
    # 기둥 둘 + 도르래 + 작은 지붕
    for X in (5, 25): leg(c, X, 5, 22, 3)
    c.R(6, 8, 21, 2, 'log', 3); c.HL(6, 8, 21, 'log', 5)
    c.VL(16, 10, 8, 'drift', 4); c.R(14, 16, 5, 4, 'log', 2); c.HL(14, 16, 5, 'iron', 3)
    roof_gable(c, 1, 0, 30, 9, s=5, under='shingle', peeks=0, inset=2, cornice=3, ice_len=2)
    c.HL(3, 30, 26, 'ink', 2)


@R.add('signpost', '갈림길 이정표(글자 없는 화살 판)', 1, 2, 'column', tags=['이정표', '길'], rules='길 갈림목·마을 어귀. 길 칸이 아닌 길가에.')
def _(c):
    ground_shadow(c, 8, 29, 6, 2)
    c.ell(8, 28.5, 5, 2.2, lambda X, Y, dx, dy, d: ('stone', 5 if dx + dy < -0.3 else 3))     # 밑동 돌
    leg(c, 5, 6, 28, 5)
    c.ell(7, 4, 3.4, 2.6, lambda X, Y, dx, dy, d: ('log', 1) if d > 0.8 and dy > 0 else ('ink', 1) if d > 0.8 else ('fur', 5 if d < 0.4 else 4))   # 기둥 머리 단면(나이테)
    c.P(6, 3, 'snow', 6); c.P(7, 3, 'snow', 6)
    for (y, d, mat) in ((10, 1, 'log'), (16, -1, 'red'), (22, 1, 'log')):
        x0 = 3 if d > 0 else 0
        box3(c, x0, y, 13, 3, 3, mat)
        tip = x0 + 13 if d > 0 else x0 - 1
        for j in range(1, 5): c.P(tip, y + j, mat, 3 if j < 3 else 2)
        for i in range(x0 + 1, x0 + 7): c.P(i, y + 1, 'snow', 6)


@R.add('lamp-post', '불바구니 기둥(통나무 기둥 위 쇠 불바구니, 위에서 보이는 숯불)', 1, 2, 'column', tags=['등', '횃불', '광장', '길'], rules='광장 모퉁이·다리 끝·회관 앞. 길가에 6~8칸 간격.')
def _(c):
    ground_shadow(c, 8, 30, 6, 1.6)
    c.ell(8, 28.5, 5, 2.2, lambda X, Y, dx, dy, d: ('stone', 5 if dx + dy < -0.3 else 3))
    leg(c, 6, 9, 28, 4)
    for (x0, x1) in ((3, 6), (12, 9)): c.line(x0, 7, x1, 12, 'iron', 2)          # 바구니 받침 쇠살
    c.ell(7.5, 7, 6, 2.6, lambda X, Y, dx, dy, d: ('iron', 2 if dx < 0 else 1) if dy > 0 else None)
    c.ell(7.5, 5.5, 6.5, 3.6, lambda X, Y, dx, dy, d: ('iron', 5 if dx + dy < -0.5 else 4 if dy < 0.2 else 3) if d > 0.68 else
          ('fire', 3 if d < 0.35 else 2 if dy > -0.3 else 1))
    c.ell(7.5, 5.5, 6.5, 3.6, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.9 and dy < -0.1 else None)
    for (x, y) in ((6, 5), (9, 6)): c.P(x, y, 'fire', 4)
    c.P(7, 2, 'fire', 3); c.P(8, 1, 'fire', 2); c.P(8, 3, 'fire', 4)


def banner(c, a, b):
    """벽걸이 오로라 깃발(추상 물결 띠, 글자·문장 없음): 쇠 막대 + 벽에 박은 받침쇠 둘 + 늘어진 천(끝이 갈라진 술). 벽면 칸에 덧그린다."""
    c.HL(1, 2, 14, 'iron', 4); c.HL(1, 3, 14, 'iron', 2)
    for X in (2, 13): c.R(X, 0, 2, 2, 'iron', 3); c.P(X, 0, 'iron', 5)
    c.P(0, 2, 'brass', 3); c.P(15, 2, 'brass', 2)
    for j in range(4, 27):
        for i in range(3, 13):
            w = math.sin((j * 0.35) + i * 0.4)
            mat, t = (a, 3) if w > 0.35 else (b, 2) if w < -0.35 else ('wool', 1)
            if i == 12: t -= 1
            if i == 3: t += 1 if t < 3 else 0
            c.P(i, j, mat, max(0, t))
    for i in range(3, 13):
        if i % 3 != 1: c.P(i, 27, 'wool', 0)
        if i % 3 == 0: c.P(i, 28, 'wool', 0)


@R.add('banner-aurora', '벽걸이 오로라 깃발(청록·보라 물결)', 1, 2, 'wall_mounted', tags=['깃발', '오로라', '축제', '벽'], rules='회관·전당·장터 건물 앞벽 칸(문 양옆)에 덧그린다. 문 칸은 가리지 않는다.')
def _(c): banner(c, 'aur', 'violet')


@R.add('banner-aurora-b', '벽걸이 오로라 깃발(보라·청록 물결, 반대 무늬)', 1, 2, 'wall_mounted', tags=['깃발', '오로라', '축제', '벽'], rules='banner-aurora 와 짝으로 문 반대편 벽에.')
def _(c): banner(c, 'violet', 'aur')


def stall(c, roof_mat, goods):
    """시장 노점 3×2: 비스듬한 천막 지붕(위에서 내려다보이는 줄무늬 천 경사면 + 눈 덮인 뒤쪽 + 앞 드림) + 판매대(윗면 물건) + 기둥."""
    WP = 48
    for X in (2, 43): leg(c, X, 10, 30, 3)
    box3(c, 1, 18, 46, 5, 8, 'drift', tt=4)
    goods(c)
    for j in range(0, 11):                                    # 경사면: 뒤(위)가 밝고 앞으로 갈수록 어둡다
        for i in range(0, WP):
            stripe = (i // 6) % 2 == 0
            mat = roof_mat if stripe else 'hide'
            t = 4 if j < 4 else 3 if j < 8 else 2
            if i > 38: t -= 1
            c.P(i, j, mat, t)
        if j == 0: c.HL(0, 0, WP, 'ink', 1)
    for i in range(1, WP - 1):                                # 뒤쪽 눈(울퉁불퉁한 아랫선)
        hh = 4 + (1 if (i * 5) % 7 < 3 else 0) - (1 if i > 40 else 0)
        for j in range(1, hh + 1): c.P(i, j, 'snow', 6 if j < hh and i < 32 else 5 if j < hh else 4)
    for i in range(WP):                                       # 앞 드림(세로 천, 물결 끝)
        mat = roof_mat if (i // 6) % 2 == 0 else 'hide'
        c.P(i, 11, mat, 1); c.P(i, 12, mat, 1 if i % 6 in (1, 2, 3, 4) else 0) if i % 6 != 0 else None
    c.HL(1, 31, 46, 'ink', 2)


def goods_fish(c):
    for k in range(6):
        x = 5 + k * 6
        c.ell(x + 2, 20, 3, 1.3, lambda X, Y, dx, dy, d: ('ice', 5 if dy < 0 else 3))
        c.P(x + 5, 20, 'ice', 2)
    c.R(36, 16, 8, 4, 'ice', 6); c.HL(36, 16, 8, 'snow', 6)


def goods_fur(c):
    for k, mat in enumerate(('fur', 'hide', 'fur', 'snow')):
        x = 4 + k * 10
        c.R(x, 18, 9, 4, mat, 4 if mat != 'snow' else 5); c.HL(x, 18, 9, mat, 5 if mat != 'snow' else 6); c.HL(x, 21, 9, mat, 2)
    for k in range(4): c.R(6 + k * 10, 13, 5, 6, 'fur', 3 - (k % 2))


def goods_wares(c):
    for k, (mat, t) in enumerate((('brass', 2), ('iron', 4), ('red', 3), ('wool', 3), ('log', 4))):
        x = 4 + k * 8
        c.ell(x + 3, 20, 3, 2, lambda X, Y, dx, dy, d, mat=mat, t=t: (mat, t + (1 if dy < 0 else 0)))


@R.add('stall-fish', '생선 노점(얼음 위 생선, 줄무늬 천막)', 3, 2, 'structure', tags=['시장', '노점', '생선'], rules='시장 광장 가장자리에 줄로(간격 1칸). 앞 1칸은 손님 자리로 비움.')
def _(c): stall(c, 'wool', goods_fish)


@R.add('stall-fur', '모피 노점(모피 더미, 붉은 천막)', 3, 2, 'structure', tags=['시장', '노점', '모피'], rules='시장 광장 가장자리에 줄로.')
def _(c): stall(c, 'red', goods_fur)


@R.add('stall-wares', '살림 노점(그릇·쇠붙이·천, 청록 천막)', 3, 2, 'structure', tags=['시장', '노점', '잡화'], rules='시장 광장 가장자리에 줄로.')
def _(c): stall(c, 'aur', goods_wares)


# ═══════════════════════ 담·울타리 ═══════════════════════
def ice_blocks(c, x0, y0, w, rows=2, top=6):
    """얼음 벽돌 담: 윗면(밝은 슬래브 + 뒤 어두운 선 + 눈) + 앞면 벽돌 줄(엇갈림, 왼쪽 밝게)."""
    c.R(x0, y0, w, top, 'ice', 5); c.HL(x0, y0, w, 'ice', 2); c.HL(x0, y0 + top - 1, w, 'ice', 6)
    for i in range(w):
        if (i + 2) % 7 < 4: c.P(x0 + i, y0 + 2, 'snow', 6); c.P(x0 + i, y0 + 1, 'snow', 5)
    fh = 16 - top - 2
    for j in range(fh):
        row = j // 5; yy = j % 5
        for i in range(w):
            xx = (i + (4 if row % 2 else 0)) % 8
            t = 4 if xx < 3 else 3
            if yy == 4 or xx == 7: t = 1
            if yy == 0 and xx < 5: t = 5
            c.P(x0 + i, y0 + top + j, 'ice', t)
    c.HL(x0, y0 + top + fh, w, 'ink', 1)


@R.add('ice-wall', '얼음 벽돌 담(동서 한 칸)', 1, 1, 'structure', tags=['담', '얼음', '울타리'], rules='얼음집·얼음 마을 둘레를 동서로 이어 찍는다. 끝에는 ice-wall-post.')
def _(c): ice_blocks(c, 0, 0, 16)


@R.add('ice-wall-post', '얼음 담 기둥(끝·모퉁이)', 1, 1, 'structure', tags=['담', '얼음'], rules='얼음 담 끝·모퉁이·남북 줄.')
def _(c):
    ice_blocks(c, 2, 0, 12, top=7)
    c.VL(2, 0, 16, 'ink', 1); c.VL(13, 0, 16, 'ink', 1)
    c.ell(7.5, 2, 5, 2, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))


@R.add('palisade', '목책(뾰족 통나무 셋, 동서 한 칸)', 1, 2, 'part', tags=['목책', '울타리', '방벽'], rules='마을 둘레를 동서로 이어 찍는다(아랫칸이 막힘). 문은 sn-palisade-gate.')
def _(c):
    from buildings import palisade_log
    for X in (0, 5, 11): palisade_log(c, X, 4 + (X % 3), 30, 5, X)
    beam(c, 0, 13, 16, 3, 2, s=8)
    c.HL(0, 31, 16, 'snow', 4)


@R.add('palisade-v', '목책(남북 줄 — 뾰족 머리를 위에서 본다)', 1, 1, 'part', tags=['목책', '울타리'], rules='목책의 남북 줄. 위아래로 이어 찍는다.')
def _(c):
    for k, y in enumerate((1, 6, 11)):
        c.ell(8, y + 2, 5, 2.6, lambda X, Y, dx, dy, d: ('log', 1) if d > 0.8 else ('fur', 5 if d < 0.4 else 4))
        c.P(7, y + 1, 'snow', 6); c.P(8, y + 1, 'snow', 6)
    for j in range(3, 16): c.P(3, j, 'log', 3); c.P(12, j, 'log', 1)
    c.VL(2, 3, 13, 'ink', 1); c.VL(13, 3, 13, 'ink', 1)


@R.add('fence', '가로대 나무 울타리(동서 한 칸)', 1, 1, 'part', tags=['울타리', '밭', '마당'], rules='집 마당·우리 둘레를 이어 찍는다.')
def _(c):
    for X in (1, 12): post_top(c, X, 0, 14, 3, 3)
    beam(c, 0, 4, 16, 2, 2, s=9); beam(c, 0, 9, 16, 2, 2, s=10)
    for X in (1, 12):                                         # 기둥이 가로대 앞을 지난다
        for j in (6, 7, 11, 12): c.P(X, j, 'log', 4); c.P(X + 1, j, 'log', 3); c.P(X + 2, j, 'log', 2)
    c.HL(0, 15, 16, 'snow', 4)


@R.add('fence-v', '가로대 나무 울타리(남북 한 칸)', 1, 1, 'part', tags=['울타리', '마당'], rules='울타리 남북 줄.')
def _(c):
    box3(c, 6, 0, 4, 16, 0, 'log', tt=4, back=False)          # 위에서 본 가로대 윗면(남북으로 이어짐)
    for y in range(16):
        c.P(7, y, 'snow', 6 if (y * 5) % 7 else 5); c.P(8, y, 'snow', 5 if (y * 3) % 5 else 4)
    post_top(c, 5, 5, 13, 6, 4)
    c.HL(5, 14, 6, 'snow', 3)


# ═══════════════════════ 호수·물가 ═══════════════════════
@R.add('fishing-spot', '얼음 낚시 자리(구멍·낚싯대·통 의자·물고기)', 2, 1, 'other', tags=['낚시', '얼음', '호수'], rules='얼음(sn-at-ice 몸통) 위. 낚시 오두막 앞이나 호수 가운데에 2~4 곳, 서로 2칸 이상 띄운다.')
def _(c):
    c.ell(8, 9, 6, 3.6, lambda X, Y, dx, dy, d: ('ice', 6) if d > 0.7 else ('water', 0 if dy < 0.1 else 2))
    c.ell(8, 9, 6, 3.6, lambda X, Y, dx, dy, d: ('ice', 2) if 0.55 < d < 0.72 and dy < 0 else None)
    for (x, y) in ((2, 6), (13, 7), (5, 13)): c.R(x, y, 2, 1, 'snow', 6)
    c.line(9, 9, 16, 1, 'log', 4); c.line(10, 9, 17, 1, 'log', 2)
    c.line(9, 9, 9, 7, 'iron', 4)
    cyl_v(c, 19, 5, 8, 8, 4, 'log', base=3)
    c.ell(23, 7, 4, 2, lambda X, Y, dx, dy, d: ('fur', 4 if dx < 0 else 3))
    c.ell(28, 12, 3, 1.3, lambda X, Y, dx, dy, d: ('ice', 5 if dy < 0 else 3)); c.P(31, 12, 'ice', 2)
    c.HL(19, 14, 8, 'ink', 2)


@R.add('boat', '뒤집어 둔 나무배(배 밑이 위로, 눈 덮임)', 3, 1, 'other', tags=['배', '부두', '호수'], rules='호숫가 눈밭·부두 곁. 물가와 평행하게.')
def _(c):
    ground_shadow(c, 24, 13, 23, 2.4)
    cx, cy, rx, ry = 23.5, 7.5, 22, 5.5
    for X in range(48):
        for Y in range(16):
            dx = (X + 0.5 - cx) / rx
            ell = 1 - dx * dx
            if ell <= 0: continue
            hy = ry * math.sqrt(ell) * (1 - 0.25 * max(0, dx) ** 2)
            if cy - hy <= Y + 0.5 <= cy + hy:                # 뒤집힌 배 밑(위에서 내려다본 볼록면)
                v = (Y + 0.5 - cy) / max(0.8, hy)
                t = 5 if v < -0.45 else 4 if v < 0.15 else 3 if v < 0.6 else 2
                if X > 34: t -= 1
                if int(Y + 0.5 - cy + 50) % 2 == 0 and abs(v) > 0.2: t -= 1
                c.P(X, Y, 'log', max(1, t))
            elif cy + hy < Y + 0.5 <= cy + hy + 2.2 and ell > 0.05:   # 뱃전(앞 두께)
                c.P(X, Y, 'log', 1 if Y + 0.5 > cy + hy + 1.2 else 2)
    c.HL(3, 7, 40, 'log', 5)                                  # 용골
    for X in range(5, 33):
        k = math.sin(X * 0.33) + math.sin(X * 0.11)
        if k > -0.6: c.P(X, 4, 'snow', 6); c.P(X, 5, 'snow', 6 if X < 24 else 5)
        if k > 0.3: c.P(X, 3, 'snow', 5); c.P(X, 6, 'snow', 5)


@R.add('tent', '원뿔 가죽 천막(장대 끝 + 연기 구멍)', 2, 3, 'structure', tags=['천막', '야영', '유목'], rules='야영지·사냥터. 문 앞 모닥불(sn-bonfire)과 1칸 띄운다.', entrance=[0, 1])
def _(c):
    """위에서 비스듬히 본 원뿔 천막: 꼭대기는 크게 보이는 타원 연기 구멍(테 + 어두운 안), 이음매는 크게 휜 타원 호, 밑단은 둥근 타원."""
    AX, AY, BY, RX, RY = 16, 10, 38, 15, 7
    TRX, TRY = 4.5, 2.6
    ground_shadow(c, 17, 41, 15.5, 5)
    for Y in range(0, 48):
        for X in range(32):
            dx = (X + 0.5 - AX)
            if abs(dx) > RX: continue
            ytop = AY - TRY * math.sqrt(max(0, 1 - (dx / TRX) ** 2)) if abs(dx) <= TRX else AY + (abs(dx) - TRX) / (RX - TRX) * (BY - AY)
            if Y + 0.5 < ytop: continue
            ybot = BY + RY * math.sqrt(max(0, 1 - (dx / RX) ** 2))
            if Y + 0.5 > ybot: continue
            f = (Y + 0.5 - AY) / (BY - AY); hw = TRX + (RX - TRX) * max(0, min(1, f))
            u = dx / max(1, hw)
            t = 4 if u < -0.45 else 3 if u < 0.1 else 2 if u < 0.6 else 1
            c.P(X, Y, 'hide', max(0, min(4, t)))
            if Y + 0.5 > ybot - 1.1: c.P(X, Y, 'hide', 0)
    for fb in (0.3, 0.62):
        y0 = AY + fb * (BY - AY); hw = TRX + (RX - TRX) * fb; ry = RY * (0.35 + 0.65 * fb)
        for X in range(int(AX - hw) + 1, int(AX + hw)):
            dx = (X + 0.5 - AX) / hw
            Y = int(y0 + ry * math.sqrt(max(0, 1 - dx * dx)))
            if c.on(X, Y): c.P(X, Y, 'hide', 0 if dx > 0.3 else 1)
    for Y in range(AY, 28):
        f = (Y + 0.5 - AY) / (BY - AY); hw = TRX + (RX - TRX) * f
        for X in range(int(AX - hw), int(AX - hw * 0.2)):
            if c.on(X, Y) and (X * 3 + Y) % 5 and Y < 25 - (AX - X) * 0.3: c.P(X, Y, 'snow', 6 if X < AX - hw * 0.5 else 5)
    c.ell(AX - 0.5, AY - 0.3, TRX, TRY, lambda X, Y, dx, dy, d: ('hide', 4 if dy < 0 else 1) if d > 0.62 else ('ink', 0))
    for (x0, x1) in ((14, 10), (16, 16), (18, 22)): c.line(x0, AY, x1, 0, 'log', 3)
    for Y in range(28, 46):
        hw = 1 + 3.5 * (Y - 28) / 16
        ybot = BY + RY - 1
        if Y + 0.5 > ybot: break
        for X in range(int(17 - hw), int(17 + hw) + 1): c.P(X, Y, 'ink', 0)
        c.P(int(17 + hw) + 1, Y, 'hide', 4)


@R.add('hay', '건초 더미(눈 모자)', 1, 1, 'organic', tags=['건초', '헛간', '농가'], rules='헛간 곁·우리 안.')
def _(c):
    c.ell(8, 9, 7, 6, lambda X, Y, dx, dy, d: ('straw', 3 if dx + dy < -0.3 else 2 if d < 0.7 else 1))
    for (x, y) in ((4, 9), (7, 12), (11, 10), (9, 7)): c.P(x, y, 'straw', 0)
    c.ell(7, 5.5, 5.5, 2.5, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))
    c.HL(2, 15, 12, 'ink', 2)


@R.add('trough', '언 여물통(위에서 들여다본 얼음 물)', 2, 1, 'container', tags=['여물통', '헛간'], rules='헛간 앞 진창 마당.')
def _(c):
    ground_shadow(c, 16, 14, 15, 1.6)
    box3(c, 2, 2, 28, 8, 4, 'log', tt=4)
    c.R(4, 4, 24, 5, 'ice', 4); c.HL(4, 4, 24, 'log', 1)      # 안쪽: 뒤 안벽 그늘 + 얼음 면
    c.HL(4, 5, 24, 'ice', 3)
    for (x, y) in ((8, 6), (15, 7), (22, 6)): c.P(x, y, 'ice', 6); c.P(x + 1, y, 'ice', 6)
    c.line(10, 8, 14, 6, 'ice', 2)
    for i in range(2, 8): c.P(i, 2, 'snow', 6); c.P(i, 3, 'snow', 5)


@R.add('cauldron', '삼발이 가마솥(위에서 보이는 국물, 김 오름)', 1, 2, 'container', tags=['가마솥', '야영', '요리'], rules='야영지·시장 끝·대장간 곁.')
def _(c):
    ground_shadow(c, 8, 30, 7, 1.6)
    for (x0, y0) in ((1, 30), (14, 30)): c.line(x0, y0, 8, 3, 'log', 4 if x0 < 8 else 2)
    c.ell(8, 28, 4, 1.5, lambda X, Y, dx, dy, d: ('fire', 3 if d < 0.5 else 2))
    c.ell(8, 22, 6.5, 5, lambda X, Y, dx, dy, d: ('iron', 3 if dx + dy < -0.3 else 2 if d < 0.7 else 1) if dy > -0.3 else None)
    c.ell(8, 19, 7, 3.4, lambda X, Y, dx, dy, d: ('iron', 5 if dx < -0.2 else 4) if d > 0.66 else ('fur', 4 if dx + dy < -0.2 else 3))
    c.ell(8, 19, 7, 3.4, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.88 and dy < -0.2 else None)
    for (x, y) in ((6, 19), (10, 20)): c.P(x, y, 'fur', 5)
    c.line(8, 4, 8, 15, 'iron', 2)
    for (x, y, r) in ((7, 13, 1.6), (9, 10, 2), (8, 7, 1.4)):
        c.ell(x, y, r, r, lambda X, Y, dx, dy, d: ('smoke', 4 if dx < 0 else 3))


@R.add('anvil', '모루(그루터기 받침)', 1, 1, 'other', tags=['모루', '대장간'], rules='대장간 앞 작업 마당.')
def _(c):
    ground_shadow(c, 8, 14, 6, 1.6)
    cyl_v(c, 4, 7, 8, 7, 4, 'log', base=3)
    box3(c, 2, 2, 11, 5, 3, 'iron')                            # 모루 윗면 5행 + 앞면
    for i in range(3, 9): c.P(i, 3, 'iron', 5)
    for k, (x, y) in enumerate(((13, 3), (14, 3), (15, 4), (13, 4), (14, 4))): c.P(x, y, 'iron', 4 if y == 3 else 3)
    c.P(1, 4, 'iron', 4); c.P(1, 5, 'iron', 3)
    c.R(6, 10, 4, 2, 'iron', 2)
    c.P(4, 2, 'snow', 6); c.P(5, 2, 'snow', 5)


@R.add('millstones', '맷돌 두 짝(눕혀 쌓음)', 2, 1, 'round_body', tags=['맷돌', '방앗간'], rules='방앗간 문 옆.')
def _(c):
    ground_shadow(c, 16, 13, 15, 2)
    disc(c, 11, 8, 9, 4, 'stone', 4, band=3)
    disc(c, 11, 5, 7, 3, 'stone', 5, band=2)
    c.ell(11, 5, 1.6, 0.9, lambda X, Y, dx, dy, d: ('ink', 0))
    disc(c, 25, 9, 5.5, 2.6, 'stone', 4, band=2)
    c.ell(25, 9, 1.2, 0.7, lambda X, Y, dx, dy, d: ('ink', 0))
    c.ell(9, 4, 3, 1.1, lambda X, Y, dx, dy, d: ('snow', 6)); c.ell(23.5, 8.3, 2, 0.8, lambda X, Y, dx, dy, d: ('snow', 6))


@R.add('water-barrel', '물통과 국자(사우나 곁, 위에서 보이는 물)', 1, 1, 'container', tags=['통', '사우나', '물'], rules='사우나 문 옆.')
def _(c):
    ground_shadow(c, 8, 14.5, 6, 1.4)
    cyl_v(c, 3, 2, 10, 9, 7, 'log', base=4)
    c.HL(3, 9, 10, 'iron', 3); c.HL(3, 13, 10, 'iron', 3)
    c.ell(8, 5.5, 4, 2.4, lambda X, Y, dx, dy, d: ('water', 3 if dx + dy < -0.3 else 2) if dy > -0.6 else ('log', 1))
    c.P(6, 5, 'water', 4)
    c.line(9, 6, 14, 0, 'log', 4); c.P(14, 0, 'log', 2); c.ell(8.5, 6.5, 1.2, 0.8, lambda X, Y, dx, dy, d: ('log', 3))


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'props', 'preview.png'), z=z, W=2000, bg=(214, 222, 236))


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'props')
