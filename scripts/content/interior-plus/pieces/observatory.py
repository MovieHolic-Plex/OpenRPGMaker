"""천문대 — 큰 굴절 망원경·지붕 관측 틈·별자리 원판 도표·렌즈 작업대·관측 발판.

v5 에 이미 있는 작은 삼각대 망원경(telescope)·천체 모형(orrery)·지구본(globe)·별자리표(star chart, 1칸 액자)·서고 사다리는
그대로 쓰고 새로 그리지 않는다. 여기 것은 천문대 큰 방의 중심 기물과 그 둘레다(폴른 스타 fs_observatory).
빛은 왼쪽 위. 놋쇠·나무 램프는 v6 팔레트 그대로.
"""
import math
from iplib import REG, K, box, cyl, ring, Cv, hnoise, poly, line

TAGS = ['천문대', '관측실']


def _tube(c, E, O, radius, mat, bands=(), band_mat='brass', t_from=0.0, t_to=None):
    """비스듬히 누운 원통(3/4): 축 E→O. 축 왼쪽 위(빛 쪽)가 윗면이라 밝다. radius(t) 는 축 길이 t 의 반지름.
    bands = [(t0, t1)] 그 구간은 band_mat(놋쇠 띠)."""
    ex, ey = E; ox, oy = O
    L = math.hypot(ox - ex, oy - ey)
    dx, dy = (ox - ex) / L, (oy - ey) / L
    nx, ny = -dy, dx                       # 축의 오른쪽 아래(그늘 쪽)
    if nx + ny < 0: nx, ny = -nx, -ny
    t_to = L if t_to is None else t_to
    xs = [ex, ox]; ys = [ey, oy]
    R = 8
    for y in range(int(min(ys)) - R, int(max(ys)) + R + 1):
        for x in range(int(min(xs)) - R, int(max(xs)) + R + 1):
            px, py = x + .5 - ex, y + .5 - ey
            t = px * dx + py * dy; s = px * nx + py * ny
            if t < t_from or t > t_to: continue
            r = radius(t)
            if r is None or abs(s) > r: continue
            m = band_mat if any(a <= t <= b for a, b in bands) else mat
            u = s / r                                   # -1 빛 쪽 … +1 그늘 쪽
            k = 6 if u < -.5 else 5 if u < -.12 else 4 if u < .3 else 3 if u < .66 else 2
            if m == mat and mat in ('wood', 'dwood'):
                # 나무 경통: 결(축 방향 줄)
                if hnoise(int(t // 4), int((u + 1) * 2), 7) > .9: k -= 1
            c.p(x, y, K(m, k))
    return (dx, dy), (nx, ny), L


@REG.piece('great telescope', '큰 굴절 망원경(5×6 — 천문대 중심)', 'observatory', 'floor', 5, 2, 64, 'other',
           '둥근 나무 단 위 돌기둥 받침에 놋쇠 집게로 물린 긴 굴절 망원경 — 나무 경통·놋쇠 띠·이슬막이·보조 망원경, 북쪽 하늘 틈을 향해 비스듬히 선다.',
           TAGS + ['망원경', '중심 기물'],
           '천문대 큰 방 가운데, 북쪽 벽 관측 틈(dome slit) 바로 아래. 발밑 5×2칸은 막힌다. 앞 1줄 비운다.',
           ['dome slit', 'observing platform', 'lens bench'], use=('read',), facing='N')
def great_telescope(c):
    # 캔버스 80×96. 발밑 칸 = y 64..95(5×2, 막힘). 위 4칸(0..63)은 플레이어 위에 그린다.
    c.shadow(8, 88, 72, 95)
    # ① 둥근 나무 단(윗면 타원이 넓게 보인다) — 판자 결 + 놋쇠 테
    cy = cyl(c, 40, 71, 34, 10, 6, 'wood', t0=5, body=(5, 4, 4, 3, 2))
    for y in range(71, 93):
        for x in range(4, 77):
            if ((x - 40) / 34.5) ** 2 + ((y - cy) / 10.5) ** 2 <= 1:
                k = 5 if (x - 40) < 18 else 4
                if (x + 1) % 7 == 0: k = 3                     # 판자 이음
                elif hnoise(x, y // 2, 3) > .86: k -= 1
                c.p(x, y, K('wood', k))
    ring(c, 40, cy, 34, 10, K('wood', 3))
    ring(c, 40, cy, 31, 8.6, K('brass', 4))
    for a in (200, 235, 270, 305, 340):                         # 테 리벳
        r = math.radians(a)
        c.p(int(round(40 + 31 * math.cos(r))), int(round(cy + 8.6 * math.sin(r))), K('brass', 6))
    # ② 돌기둥 받침(벽돌 몸통 + 몸통보다 넓은 머리 판 — 윗면 타원이 보인다)
    for y in range(54, 79):
        for x in range(31, 52):
            u = (x - 31) / 20
            k = 5 if u < .18 else 4 if u < .55 else 3 if u < .85 else 2
            row = (y - 54) // 4
            if (y - 54) % 4 == 3: k -= 1                                     # 가로 줄눈
            elif (x + (row % 2) * 5) % 9 == 0: k -= 1                         # 세로 줄눈(엇갈림)
            c.p(x, y, K('stone', k))
    c.vl(30, 54, 78, K('stone', 1)); c.vl(52, 54, 78, K('stone', 0))
    c.ell(41.5, 79, 10.5, 2.2, None, only=lambda x, y: K('stone', 2) if y >= 79 else None)
    c.hl(31, 51, 73, K('brass', 4)); c.hl(31, 51, 74, K('brass', 2))       # 기둥 밑 놋쇠 고리
    pc = cyl(c, 41.5, 46, 13.5, 5, 3, 'stone', t0=5, body=(5, 5, 4, 3, 2))  # 머리 판
    ring(c, 41.5, pc, 13.5, 5, K('stone', 3))
    c.hl(28, 55, 55, K('stone', 2))
    # ③ 집게 기둥(놋쇠) — 받침 윗면에서 경통 축까지
    c.rect(39, 30, 44, 51, K('brass', 4)); c.vl(39, 30, 51, K('brass', 6)); c.vl(40, 30, 51, K('brass', 5)); c.vl(44, 30, 51, K('brass', 2))
    c.ell(41.5, 51, 5.5, 2, None, only=lambda x, y: K('brass', 5 if x < 41 else 3))
    for a in (45, 135, 225, 315):
        r = math.radians(a); c.p(int(round(41.5 + 10 * math.cos(r))), int(round(51 + 3.4 * math.sin(r))), K('iron', 5))
    # ④ 경통 — 눈 쪽(왼쪽 아래)에서 대물 쪽(오른쪽 위, 북쪽 하늘)
    E, O = (9.0, 60.0), (62.0, 8.5)
    def rad(t):
        if t < 6: return 3.0          # 접안경
        if t < 14: return 4.3         # 끌어당기는 관
        if t < 60: return 7.0         # 나무 경통
        return 8.4                    # 이슬막이
    (dx, dy), (nx, ny), L = _tube(c, E, O, rad, 'dwood',
                                  bands=((0, 6), (6, 14), (14, 17), (34, 37), (56, 60), (60, 90)), band_mat='brass')
    # 접안 끝 단면(눈이 대는 동그라미)
    # 접안 끝(놋쇠 테 + 갈색 그늘 속, 유리 반짝임 한 점)
    c.ell(E[0] + .5, E[1] + .5, 2.6, 2.2, None, only=lambda x, y: K('brass', 4 if x + y < E[0] + E[1] + 1 else 2))
    c.ell(E[0] + .5, E[1] + .5, 1.3, 1.1, None, only=lambda x, y: K('dwood', 2))
    c.p(int(E[0]), int(E[1]), K('glass', 5))
    # 대물 끝 단면(위로 향한 이슬막이 아가리 — 가는 타원, 속은 어두운 렌즈)
    ox, oy = O
    for a in range(0, 360, 3):
        r = math.radians(a)
        x = ox + 8.2 * math.cos(r) * nx + 2.2 * math.sin(r) * dx
        y = oy + 8.2 * math.cos(r) * ny + 2.2 * math.sin(r) * dy
        c.p(int(round(x)), int(round(y)), K('brass', 6 if math.cos(r) < 0 else 3))
    for k in range(-6, 7):
        x = ox + k * nx * .85; y = oy + k * ny * .85
        c.p(int(round(x)), int(round(y)), K('blue', 1 if k > -2 else 3))
    c.p(int(round(ox - 4 * nx)), int(round(oy - 4 * ny)), K('glass', 6))
    # ⑤ 보조 망원경(파인더) — 경통 빛 쪽 위에 나란히
    for t in range(22, 44):
        for off, k in ((11.6, 6), (10.6, 5), (9.6, 3)):
            x = E[0] + t * dx - off * nx; y = E[1] + t * dy - off * ny
            c.p(int(round(x)), int(round(y)), K('brass', k))
    for t in (25, 40):                                          # 파인더 받침 다리
        x = E[0] + t * dx - 8.4 * nx; y = E[1] + t * dy - 8.4 * ny
        c.p(int(round(x)), int(round(y)), K('iron', 2))
    x = E[0] + 22 * dx - 10.6 * nx; y = E[1] + 22 * dy - 10.6 * ny
    c.p(int(round(x)), int(round(y)), K('dwood', 2))
    # ⑥ 집게 고리 + 축 손잡이(오른쪽 그늘 쪽 놋쇠 꼭지)
    t = 45.0
    cxp, cyp = E[0] + t * dx, E[1] + t * dy
    for off, k in ((8.0, 4), (9.2, 3)):
        c.p(int(round(cxp + off * nx)), int(round(cyp + off * ny)), K('brass', k))
    c.ell(cxp + 10.6 * nx, cyp + 10.6 * ny, 1.5, 1.5, None, only=lambda x, y: K('brass', 5 if x + y < cxp + cyp + 21 else 3))
    c.outline(dark=K('wood', 1))


@REG.piece('dome slit', '관측 틈(별 하늘 창, 2칸)', 'observatory', 'hang', 2, 0, 0, 'wall_mounted',
           '천문대 북쪽 벽을 세로로 가른 관측 틈 — 돌 문설주와 아치 머릿돌, 양옆으로 연 미닫이 덧문, 밤하늘(별·초승달), 돌 창턱.',
           TAGS + ['창', '밤하늘'],
           '북쪽 벽면 두 줄(윗줄에 건다). 벽 머리 갓돌은 문설주 머리에서 끝난다. 바로 아래에 큰 망원경.', ['great telescope', 'celestial chart'],
           use=('light',))
def dome_slit(c):
    # 캔버스 32×32 = 벽면 두 줄. 맨 위 2줄은 비워 벽 머리 갓돌이 그대로 보이게 하고, 문설주 머리가 갓돌을 받아 끝낸다.
    # 하늘: 위가 깊고 아래로 밝다 — 경계는 손으로 흔든 계단(바둑 무늬 없음)
    edge1 = [11, 12, 11, 10, 11, 12, 12, 11, 10, 10, 11, 12, 11, 11]     # 0단 → 1단 경계(열마다)
    edge2 = [20, 19, 19, 20, 21, 21, 20, 19, 19, 20, 21, 20, 19, 20]     # 1단 → 2단
    for y in range(4, 27):
        for i, x in enumerate(range(9, 23)):
            k = 0 if y < edge1[i] else 1 if y < edge2[i] else 2
            c.p(x, y, K('blue', k) if k > 0 else K('dwood', 0))
    for (x, y, col) in ((11, 7, ('white', 6)), (17, 6, ('yellow', 5)), (14, 11, ('white', 5)), (20, 13, ('yellow', 4)),
                        (10, 16, ('white', 5)), (16, 18, ('yellow', 6)), (21, 21, ('white', 4)), (12, 23, ('yellow', 4)), (18, 24, ('white', 5))):
        c.p(x, y, K(*col))
    for (x, y) in ((14, 11), (16, 18)):                                   # 십자 반짝임
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.p(x + dx, y + dy, K('blue', 4))
    c.ell(18.5, 8, 2.2, 2.2, None, only=lambda x, y: K('yellow', 6))     # 초승달
    c.ell(19.6, 7.2, 2, 2, None, only=lambda x, y: K('dwood', 0) if y < edge1[min(13, x - 9)] else K('blue', 1))
    # 아치 머릿돌(위 가장자리 둥글게, 윗면 밝은 띠)
    for x in range(7, 25):
        top = 3 + (1 if x in (7, 8, 23, 24) else 0)
        c.p(x, top, K('stone', 6)); c.p(x, top + 1, K('stone', 4))
    for x in range(9, 23):
        if x in (9, 22): c.p(x, 5, K('stone', 3))
    # 덧문(양옆으로 연 판자 문, 세로 결) — 문설주 바깥
    for x0, sh in ((2, 0), (25, -1)):
        for y in range(4, 27):
            for i in range(5):
                k = (5, 4, 3, 4, 3)[i] + sh
                if i == 2 or (y - 4) % 7 == 0: k -= 1
                c.p(x0 + i, y, K('dwood', k))
        for y in (8, 20):
            for i in range(5): c.p(x0 + i, y, K('iron', 4 if i < 3 else 3))
            c.p(x0 + (1 if sh == 0 else 3), y, K('iron', 6))
    # 돌 문설주(머리가 위 2줄까지 솟아 벽 갓돌을 받는다 — 머리 윗면 2줄)
    for x0 in (7, 23):
        for y in range(2, 27):
            for i in range(2):
                k = (5 if i == 0 else 3) if y > 3 else (6 if y == 2 else 5)
                if y > 3 and (y - 4) % 6 == 5: k -= 1
                c.p(x0 + i, y, K('stone', k))
    # 돌 창턱(윗면 3줄 + 앞면 2줄)
    for y in range(27, 32):
        for x in range(1, 31):
            k = (6, 5, 5, 3, 2)[y - 27]
            if x >= 28: k -= 1
            if y >= 30 and x % 8 == 3: k -= 1
            c.p(x, y, K('stone', k))
    c.outline(dark=K('wood', 1))


@REG.piece('celestial chart', '별자리 원판 도표(2칸)', 'observatory', 'hang', 2, 0, 0, 'wall_mounted',
           '두루마리 양피지에 그린 둥근 별자리 원판(남색 하늘·별·금빛 테)과 아래 달의 위상 여섯 개. 위아래 나무 막대.',
           TAGS + ['별자리표', '도표'],
           '천문대·학자 서재 벽면 윗줄. 큰 망원경·지구본 곁.', ['dome slit', 'star chart', 'globe'], use=('read',))
def celestial_chart(c):
    # 양피지
    for y in range(4, 28):
        for x in range(3, 29):
            k = 5 if hnoise(x // 2, y // 2, 9) > .2 else 4
            if x in (3, 28): k = 3
            c.p(x, y, K('straw', k + 1) if k == 5 else K('straw', k))
    # 위·아래 나무 막대(끝에 놋쇠 꼭지)
    for y0 in (2, 27):
        c.hl(2, 29, y0, K('dwood', 5)); c.hl(2, 29, y0 + 1, K('dwood', 3))
        c.p(1, y0, K('brass', 5)); c.p(1, y0 + 1, K('brass', 3)); c.p(30, y0, K('brass', 4)); c.p(30, y0 + 1, K('brass', 2))
    # 별자리 원판
    cx, cy = 15.5, 14
    c.ell(cx, cy, 8.4, 8.4, None, only=lambda x, y: K('gold', 4 if x + y < cx + cy else 2))
    c.ell(cx, cy, 7.2, 7.2, None, only=lambda x, y: K('blue', 1 if (x - cx) ** 2 + (y - cy) ** 2 > 30 else 2))
    pts = [(12, 10), (14, 12), (17, 11), (19, 14), (16, 17), (13, 18)]
    for (a, b) in zip(pts, pts[1:]): line(c, a[0], a[1], b[0], b[1], K('blue', 4))
    for (x, y) in pts: c.p(x, y, K('white', 6))
    for (x, y) in ((11, 15), (20, 10), (18, 19), (15, 8)): c.p(x, y, K('yellow', 5))
    c.p(15, 14, K('gold', 5))                               # 북극성 축
    # 달의 위상(아래 줄)
    for i, ph in enumerate((0, 1, 2, 3, 2, 1)):
        x0 = 5 + i * 4
        c.p(x0, 24, K('linen', 3)); c.p(x0 + 1, 24, K('linen', 3))
        if ph >= 1: c.p(x0 + 1, 24, K('yellow', 6))
        if ph >= 2: c.p(x0, 24, K('yellow', 6))
        if ph == 3: c.p(x0, 25, K('yellow', 5)); c.p(x0 + 1, 25, K('yellow', 5))
        else: c.p(x0, 25, K('linen', 3)); c.p(x0 + 1, 25, K('linen', 3))
    c.outline()
    for x in range(2, 30): c.p(x, 30, (0x1c, 0x14, 0x18, 80))


@REG.piece('lens bench', '렌즈 작업대(3×2)', 'observatory', 'floor', 3, 2, 0, 'low_furniture',
           '렌즈를 갈고 맞추는 소나무 작업대 — 윗면에 크고 작은 렌즈·받침에 세운 렌즈·놋쇠 캘리퍼스·줄과 망치·광 내는 천, 앞 서랍.',
           TAGS + ['작업대', '렌즈'],
           '천문대 큰 방 가장자리, 망원경 옆. 발밑 3×2칸은 막힌다. 앞 1줄 비운다.', ['great telescope', 'orrery'], use=('search',), surface=True)
def lens_bench(c):
    c.shadow(1, 28, 47, 31)
    box(c, 2, 9, 44, 10, 7, 'pine', t0=5, f0=3)
    for x in (3, 4, 43, 44): c.vl(x, 27, 28, K('pine', 2))                 # 다리
    c.hl(3, 44, 27, K('pine', 1))
    for x0 in (8, 30):                                                     # 서랍 둘
        c.rect(x0, 21, x0 + 9, 24, K('pine', 3)); c.hl(x0, x0 + 9, 21, K('pine', 2)); c.p(x0 + 4, 23, K('brass', 6)); c.p(x0 + 5, 23, K('brass', 4))
    # 판자 결
    for y in range(10, 18):
        for x in range(3, 45):
            if (x + 2) % 11 == 0: c.p(x, y, K('pine', 4))
    # 광 내는 천(펼친 리넨)
    c.rect(4, 11, 12, 15, K('linen', 6)); c.hl(4, 12, 15, K('linen', 4)); c.vl(12, 11, 15, K('linen', 4))
    # 천 위 렌즈(큰)
    c.ell(8, 13, 3, 1.8, None, only=lambda x, y: K('glass', 3 if x > 8 else 4))
    ring(c, 8, 13, 3.4, 2.1, K('brass', 3)); c.p(7, 12, K('white', 6)); c.p(6, 13, K('glass', 6))
    # 작은 렌즈 셋(놋쇠 테)
    for (x, y, r) in ((16, 12, 1.6), (19, 15, 1.3), (22, 12, 1.1)):
        c.ell(x, y, r + .4, r * .6 + .2, None, only=lambda xx, yy: K('glass', 3))
        ring(c, x, y, r + .8, r * .6 + .7, K('brass', 5))
        c.p(int(x - .5), int(y - .5), K('white', 6))
    # 받침에 세운 렌즈(위로 솟는다)
    c.vl(28, 10, 15, K('brass', 3)); c.ell(28, 16, 2.5, 1, None, only=lambda x, y: K('brass', 4))
    c.ell(28, 6, 3.6, 3.6, None, only=lambda x, y: K('brass', 5 if x + y < 33 else 3))
    c.ell(28, 6, 2.4, 2.4, None, only=lambda x, y: K('glass', 6 if x + y < 33 else 4))
    c.p(27, 5, K('white', 6))
    # 놋쇠 캘리퍼스(V 자)
    line(c, 33, 11, 37, 15, K('brass', 5)); line(c, 33, 11, 39, 13, K('brass', 4)); c.p(33, 11, K('brass', 6))
    # 줄(쇠)과 작은 망치
    line(c, 40, 16, 44, 12, K('iron', 5)); c.p(40, 16, K('wood', 4)); c.p(41, 16, K('wood', 3))
    c.rect(35, 16, 38, 16, K('wood', 5)); c.rect(38, 15, 39, 17, K('iron', 4)); c.p(38, 15, K('iron', 6))
    c.outline()


@REG.piece('observing platform', '관측 발판(난간 두른 높은 단과 사다리, 2×2)', 'observatory', 'floor', 2, 2, 16, 'other',
           '망원경 접안경 곁에 세운 높은 나무 단 — 판자 윗면, 세 변에 놋쇠 난간, 앞에 가로대가 보이는 사다리.',
           TAGS + ['발판', '사다리'],
           '큰 망원경 바로 왼쪽(접안경 옆) 2×2칸. 발밑은 막힌다.', ['great telescope'], use=('block',))
def observing_platform(c):
    # 캔버스 32×48. 발밑 칸 = y16..47(2×2). 위에서 내려다본 넓은 단 윗면(y17..32) + 낮은 앞면 + 앞으로 기댄 사다리 + 가는 놋쇠 난간.
    m = 'wood'
    c.shadow(1, 42, 31, 47)
    # 단 앞면 y33..40 — 가로 판 두 장, 모서리 기둥, 놋쇠 모서리 쇠
    for y in range(33, 41):
        for x in range(2, 30):
            k = 4 if y < 37 else 3
            if y == 36: k = 2                                              # 판 이음
            if x in (2, 3): k = 5 if x == 2 else 4                         # 왼 기둥(빛)
            elif x in (28, 29): k = 2                                      # 오른 기둥(그늘)
            elif hnoise(x // 3, y, 41) > .86: k -= 1
            c.p(x, y, K(m, k))
    c.hl(2, 29, 40, K(m, 2))
    for x in (2, 28): c.p(x, 33, K('brass', 6 if x == 2 else 4)); c.p(x + 1, 33, K('brass', 4 if x == 2 else 3))
    # 단 윗면 y17..32 — 동서로 놓인 널 5장(3줄씩), 뒤 어둡게 → 앞 밝게, 널 끝 이음·못, 앞 입술
    for y in range(17, 33):
        j = y - 17
        for x in range(2, 30):
            k = 4 if j < 3 else 5 if j < 9 else 6
            if j % 3 == 2: k -= 1
            elif x == (7 + 9 * (j // 3)) % 25 + 3: k -= 2
            elif hnoise(x // 4, y, 43) > .87: k -= 1
            if x >= 27: k -= 1
            c.p(x, y, K(m, k))
    c.hl(2, 29, 32, K(m, 7)); c.hl(2, 29, 16, K(m, 3))
    for (x, y) in ((6, 21), (21, 24), (12, 27), (25, 30)): c.p(x, y, K('iron', 5))
    # 사다리 — 앞 입술에 걸쳐 바닥으로 기댄다(아래로 갈수록 앞으로 나와 살짝 벌어진다)
    for y in range(30, 47):
        f = (y - 30) / 16
        xl = int(round(17 - f)); xr = int(round(26 + f))
        c.p(xl, y, K('pine', 6)); c.p(xl + 1, y, K('pine', 4))
        c.p(xr, y, K('pine', 5)); c.p(xr + 1, y, K('pine', 3))
    for y in range(33, 46, 4):
        f = (y - 30) / 16
        x0 = int(round(19 - f)); x1 = int(round(25 + f))
        c.hl(x0, x1, y, K('pine', 7)); c.hl(x0, x1, y + 1, K('pine', 3))   # 가로대 윗면 + 밑 그늘
    c.p(17, 29, K('brass', 6)); c.p(26, 29, K('brass', 5))                 # 사다리 갈고리
    c.outline(dark=K('wood', 1))
    # 난간(윤곽 뒤에 그려 가로대 사이가 비어 보이게) — 낮은 난간: 뒤 기둥 셋, 윗면이 보이는 굵은 손잡이 가로대(밝은 윗면 2줄 + 그늘 1줄),
    # 양옆 손잡이(뒤 → 앞으로 세로로 보인다, 2px 폭으로 윗면 빛 + 그늘)
    br = 'brass'
    for x, k in ((3, 5), (15, 5), (28, 4)):
        c.vl(x, 11, 16, K(br, k)); c.vl(x + 1, 12, 16, K(br, 2))
    c.hl(2, 29, 9, K(br, 6)); c.hl(2, 29, 10, K(br, 5)); c.hl(2, 29, 11, K(br, 2))
    for x in (1, 29):
        c.vl(x, 9, 31, K(br, 6 if x == 1 else 4)); c.vl(x + 1, 10, 31, K(br, 3 if x == 1 else 2))
    c.p(1, 32, K(br, 3)); c.p(30, 32, K(br, 1))
