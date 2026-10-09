# 기계 공장 층 조각 — 앵커 ②(대형 증기 보일러·피스톤·톱니 기계)와 ①(컨베이어 라인 기계·물건 상자) 그리고 기계실 벽 장식.
# 전부 fr_mat 톤 캔버스(TC)에 future-ruins 「기계 재질 규약」대로 찍는다: 판 줄눈·리벳(panels), 녹(rustify), 관(pipe_h/pipe_v 지름 6·12),
# 3/4 상자(box), 경고 띠(hazard). 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위. 글자·숫자·상표 없음.
import math
from mf_kit import *
from mf_kit import _hash
from fr_props import cyl, steam_puff
from fr_mech import sphere, gauge


# ------------------------------------------------------------------ 공용: 정면 톱니바퀴(벽·기계 앞면에 선 원판), 바퀴 밸브
def gear_face(tc, cx, cy, r, teeth, mat='steel', phase=0.0, spokes=4, thick=2, hub_mat='brass'):
    """남쪽을 향해 선 톱니 원판: 이빨·테·바퀴살·굴대 + 위 두께 띠(3/4 에서 원판 두께의 윗변이 보인다). 빛 왼쪽 위."""
    for y in range(int(cy - r - 4 - thick), int(cy + r + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy
            def inside(dx, dy):
                d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                return d <= r + (2.2 if math.cos(a * teeth + phase) > .2 else 0)
            d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if not inside(dx, dy):
                if any(inside(dx, dy + j) for j in range(1, thick + 1)):            # 두께 띠(윗변)
                    tc.px(x, y, mat, 5 if dx < 0 else 4)
                continue
            light = -(dx * .7 + dy * .7) / max(1.0, d) * .5 + .5
            if d > r - 2.5: k = 4 + (1 if light > .62 else 0) - (1 if light < .32 else 0)
            elif d > r - 4.5: k = 2
            elif d < max(2.5, r * .22): k = 5 if light > .5 else 3; tc.px(x, y, hub_mat, k); continue
            else:
                sp = any(abs(math.sin(a - i * math.pi / spokes)) * d < 1.7 for i in range(spokes))
                if not sp: tc.px(x, y, 'dark', 1); continue
                k = 4 if light > .5 else 3
            tc.px(x, y, mat, k)
    tc.px(int(cx) - 1, int(cy) - 1, hub_mat, 6)


def handwheel(tc, cx, cy, rx=4, ry=2, mat='redl'):
    for a in range(0, 360, 15):
        r = math.radians(a); tc.px(cx + rx * math.cos(r), cy + ry * math.sin(r), mat, 4 if a > 180 else 3)
    tc.hline(int(cx - rx + 1), int(cx + rx), int(cy), mat, 3); tc.px(cx, cy, mat, 6)


def lever(tc, x, y, up=True):
    for j in range(5): tc.px(x, y - j if up else y + j, 'steel', 4)
    tc.px(x, y - 5 if up else y + 5, 'redl', 5); tc.px(x + 1, y - 5 if up else y + 5, 'redl', 3)


# ================================================================== 앵커 ② 대형 증기 보일러 6x5
def boiler_big(seed=0):
    """대형 증기 보일러 6x5(96x80): 콘크리트 받침 위 강철 화실(외장판 32x16·리벳, 가운데 호박빛 화구 창살 문, 재 받이),
    그 위로 누운 큰 강철 드럼(지름 30, 이음 테 셋·볼트, 양 끝 둥근 마개), 드럼 위 증기 돔·안전밸브·굵은 증기관이 뒤 벽으로,
    앞면 압력계 셋(숫자 없음)과 수위 유리관, 오른쪽 급수 펌프 기둥과 붉은 바퀴 밸브. 아래 2줄 막힘, 위는 걷기 + 가림."""
    W, H = 96, 80; tc = TC(W, H, seed)
    box(tc, 2, 66, 94, 80, 4, 'conc', base=3, seed=seed)                          # 받침
    # 화실
    box(tc, 8, 44, 70, 68, 3, 'steel', base=3, seed=seed + 1)
    panels(tc, 9, 48, 69, 67, 'steel', 3, 32, 16, stagger=True, face='front', seed=seed + 2, vary=1)
    for y in range(51, 64):                                                        # 화구 문
        for x in range(27, 51):
            e = x in (27, 50) or y in (51, 63)
            if e: tc.px(x, y, 'steel', 5 if (x == 27 or y == 51) else 2); continue
            k = 5 if (x + y) % 3 else 6
            if (x - 28) % 3 == 0: tc.px(x, y, 'steel', 1); continue                 # 창살
            if y > 59: k = 3
            tc.px(x, y, 'amber', k)
    tc.hline(30, 48, 49, 'steel', 6); tc.hline(30, 48, 50, 'steel', 3)            # 문 손잡이 띠
    for x in (31, 46): tc.px(x, 57, 'steel', 6)
    hazard(tc, 9, 65, 69, 67, seed=seed + 3, k=4)
    # 드럼
    top, dia = 16, 30
    for y in range(top, top + dia):
        k = fcyl((y - top + .5) / dia)
        for x in range(6, 76): tc.px(x, y, 'steel', k)
    for y in range(top, top + dia):                                                 # 둥근 마개(양 끝 3px)
        k = fcyl((y - top + .5) / dia)
        for x in (4, 5): tc.px(x, y, 'steel', clampk(k + (1 if x == 4 else 0)))
        for x in (76, 77): tc.px(x, y, 'steel', clampk(k - (1 if x == 77 else 0)))
    for bx in (18, 40, 62):                                                         # 이음 테 + 볼트
        for y in range(top - 1, top + dia + 1):
            k = fcyl((y - top + 1.5) / (dia + 2))
            tc.px(bx, y, 'steel', clampk(k + 1)); tc.px(bx + 1, y, 'steel', k); tc.px(bx + 2, y, 'steel', clampk(k - 1))
            if (y - top) % 6 == 3: tc.px(bx + 1, y, 'steel', 6)
    for x in range(8, 76, 4): tc.px(x, top + 4, 'steel', 6); tc.px(x + 1, top + 5, 'steel', 2)   # 리벳 줄
    for x in range(8, 76, 4): tc.px(x, top + 24, 'steel', 5); tc.px(x + 1, top + 25, 'steel', 1)
    rustify(tc, 0, top, W, top + dia, amount=.32, seed=seed + 4)
    # 증기 돔 + 안전밸브 + 증기관(뒤 벽으로)
    cyl(tc, 30, 10, 6, 2.2, 8, 'steel', seed=seed)
    tc.ell(30, 10, 3.2, 1.2, 'brass', 5)
    for y in range(3, 12): tc.px(45, y, 'brass', 4); tc.px(46, y, 'brass', 2)
    tc.hline(43, 49, 3, 'brass', 6); tc.hline(43, 49, 4, 'brass', 3)
    pipe_v(tc, 60, 0, top + 2, 8, 'steel', step=16)
    # 압력계 셋 + 수위 유리관
    for (gx, gy) in ((24, 30), (36, 30), (52, 31)):
        gauge(tc, gx, gy, 3.4, seed + gx)
    for y in range(22, 40):
        tc.px(70, y, 'steel', 5); tc.px(73, y, 'steel', 2)
        tc.px(71, y, 'glass', 5 if y < 30 else 3); tc.px(72, y, 'glass', 4 if y < 30 else 2)
    tc.hline(69, 75, 21, 'brass', 5); tc.hline(69, 75, 40, 'brass', 3)
    # 급수 펌프 기둥(오른쪽)
    box(tc, 78, 30, 92, 68, 3, 'paint', base=3, seed=seed + 5)
    panels(tc, 79, 34, 91, 67, 'paint', 3, 12, 16, face='front', seed=seed + 6, vary=0)
    rustify(tc, 78, 30, 92, 68, amount=.4, seed=seed + 7, mats=('paint',))
    pipe_h(tc, 70, 80, 52, 6, 'brass', flange=False)
    handwheel(tc, 85, 28, 5, 2)
    for y in range(28, 31): tc.px(85, y, 'steel', 3)
    lamp(tc, 81, 38, 'amber'); lamp(tc, 86, 38, 'redl', on=False)
    tc.grain(.04)
    im = tc.fin(.6, shadow=(48, 78, 46, 3, 75))
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(steam_puff(16, 12, seed + 2, 130), (39, 0))
    return o


# ================================================================== 앵커 ② 쌍 피스톤 기관 4x4
def piston_engine(seed=0):
    """세운 쌍 피스톤 기관 4x4(64x64): 콘크리트 받침 위 강철 크랭크실(외장판·리벳, 둥근 점검 창 둘), 그 위 굵은 실린더 둘
    (원통 6단 음영·놋쇠 기름컵), 실린더 아래로 드러난 반들거리는 피스톤 막대와 연결 막대, 옆 플라이휠(정면 톱니 원판), 크랭크 축.
    아래 2줄 막힘."""
    W, H = 64, 64; tc = TC(W, H, seed)
    box(tc, 0, 54, 64, 64, 3, 'conc', base=3, seed=seed)
    box(tc, 4, 34, 46, 56, 3, 'steel', base=3, seed=seed + 1)                       # 크랭크실
    panels(tc, 5, 38, 45, 55, 'steel', 3, 20, 16, face='front', seed=seed + 2, vary=1)
    for cx in (15, 34):                                                              # 점검 창
        tc.ell(cx, 46, 4, 3.2, 'steel', 2); tc.ell(cx, 46, 3, 2.3, 'glass', lambda x, y: 4 if x < cx else 2)
        tc.px(cx - 1, 45, 'glass', 6)
    for cx in (15, 34):                                                              # 실린더
        cyl(tc, cx, 9, 7.2, 2.6, 13, 'steel', seed=seed)
        tc.ell(cx, 9, 4, 1.4, 'steel', 3)
        for y in (13, 20): tc.hline(int(cx - 7), int(cx + 8), y, 'steel', 6 if y == 13 else 2)
        cyl(tc, cx + 4, 5, 1.6, .8, 3, 'brass', seed=seed)                          # 기름 컵
        for y in range(25, 34):                                                      # 피스톤 막대(반들)
            tc.px(cx - 1, y, 'steel', 6); tc.px(cx, y, 'steel', 4); tc.px(cx + 1, y, 'steel', 2)
        tc.hline(int(cx - 4), int(cx + 5), 31, 'brass', 5); tc.hline(int(cx - 4), int(cx + 5), 32, 'brass', 2)   # 크로스헤드
    gear_face(tc, 54, 38, 9, 12, 'steel', seed, spokes=4)                            # 플라이휠
    pipe_h(tc, 44, 54, 38, 6, 'steel', flange=False)                                 # 크랭크 축
    box(tc, 49, 48, 60, 56, 2, 'steel', base=2, seed=seed + 3)                       # 축받이
    hazard(tc, 5, 53, 45, 55, seed=seed + 4)
    rustify(tc, 0, 30, W, 56, amount=.25, seed=seed + 5)
    tc.grain(.04)
    return tc.fin(.6, shadow=(32, 62, 30, 2, 70))


# ================================================================== 앵커 ② 톱니 기계 4x4
def gear_works(seed=0):
    """대형 톱니 기계 4x4(64x64): 강철 받침틀 앞에 선 큰 톱니 원판(바퀴살 다섯)과 맞물린 작은 놋쇠 톱니·더 작은 쇠 톱니, 그 사이 사슬,
    틀 위 감속기 상자와 굵은 축, 오른쪽 아래 붉은 바퀴 밸브. 아래 2줄 막힘(받침틀)."""
    W, H = 64, 64; tc = TC(W, H, seed)
    box(tc, 2, 50, 62, 64, 4, 'conc', base=3, seed=seed)
    box(tc, 6, 4, 58, 52, 4, 'steel', base=2, seed=seed + 1)                         # 받침틀(뒤판)
    panels(tc, 7, 9, 57, 51, 'steel', 2, 25, 21, face='front', seed=seed + 2, vary=0)
    box(tc, 36, 0, 58, 14, 4, 'paint', base=3, seed=seed + 3)                        # 감속기 상자
    rustify(tc, 36, 0, 58, 14, amount=.35, seed=seed + 4, mats=('paint',))
    gear_face(tc, 24, 30, 15, 16, 'steel', 0.1, spokes=5)
    gear_face(tc, 47, 22, 7, 10, 'brass', 0.5, spokes=3, hub_mat='steel')
    gear_face(tc, 49, 41, 4.5, 8, 'steel', 0.3, spokes=3)
    for i in range(14):                                                              # 사슬(작은 톱니 ↔ 쇠 톱니)
        y = 22 + i * 1.4; tc.px(55, y, 'steel', 4 if i % 2 else 2); tc.px(56, y, 'steel', 2)
    handwheel(tc, 12, 47, 4, 1.8)
    hazard(tc, 7, 47, 57, 50, seed=seed + 5)
    rustify(tc, 0, 4, W, 52, amount=.2, seed=seed + 6)
    tc.grain(.04)
    return tc.fin(.6, shadow=(32, 62, 30, 2, 70))


# ================================================================== 압력 탱크 · 증기관 기둥
def pressure_tank(seed=0, mat='steel'):
    """세운 압력 탱크 2x3(32x48): 둥근 지붕 원통(이음 테 둘·리벳 줄), 앞 압력계와 꼭지, 아래 짧은 다리 셋, 위로 솟은 안전밸브.
    밑동 줄만 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for lx in (7, 15, 23):
        for y in range(40, 47): tc.px(lx, y, 'steel', 3); tc.px(lx + 1, y, 'steel', 1)
    cyl(tc, 16, 10, 12, 4.2, 28, mat, seed=seed)
    sphere(tc, 16, 10, 12, mat, ry=6)
    for y in (18, 34): tc.hline(4, 28, y, mat, 6); tc.hline(4, 28, y + 1, mat, 2)
    for x in range(6, 27, 4): tc.px(x, 22, mat, 6)
    gauge(tc, 11, 27, 3, seed)
    pipe_v(tc, 22, 24, 34, 4, 'brass', flange=False)
    for y in range(0, 6): tc.px(16, y, 'brass', 4); tc.px(17, y, 'brass', 2)
    tc.hline(14, 20, 0, 'brass', 6)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 2, mats=(mat,))
    tc.grain(.04)
    return tc.fin(.6, shadow=(16, 46, 13, 2, 65))


def steam_stack(seed=0):
    """증기관 기둥 1x3(16x48): 바닥 받침에서 벽 위로 오르는 굵은 세로 관(지름 12, 이음 테·볼트), 가운데 붉은 바퀴 밸브와 새는 김.
    밑동만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    pipe_v(tc, 8, 0, 44, 12, 'steel', step=32)
    box(tc, 1, 40, 15, 48, 2, 'steel', base=2, seed=seed)
    handwheel(tc, 8, 24, 5, 2)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 3)
    im = tc.fin(.6)
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(steam_puff(12, 10, seed + 3, 110), (3, 10))
    return o


# ================================================================== 벽 장식 (앞면 위)
def gauge_board(seed=0):
    """압력계 판 2x1(32x16, 벽 앞면 장식): 볼트 박은 강철판에 압력계 셋(숫자 없음, 바늘 다름)과 작은 표시등 둘, 아래로 내려가는 가는 관."""
    tc = TC(32, 16, seed)
    box(tc, 1, 1, 31, 14, 1, 'steel', base=3, seed=seed)
    for (x, y) in ((3, 3), (28, 3), (3, 12), (28, 12)): bolt(tc, x, y)
    for i, gx in enumerate((8, 16, 24)): gauge(tc, gx, 7, 2.8, seed + i * 7)
    lamp(tc, 12, 12, 'cyan'); lamp(tc, 19, 12, 'amber')
    for y in (14, 15): tc.px(8, y, 'brass', 4); tc.px(24, y, 'brass', 4)
    return tc.fin(.6)


def valve_manifold(seed=0):
    """밸브 묶음 3x1(48x16, 벽 앞면 장식 아래 줄): 가로 굵은 관 하나에서 내려온 짧은 가지 관 셋, 가지마다 붉은 바퀴 밸브, 이음 상자."""
    tc = TC(48, 16, seed)
    pipe_h(tc, 0, 48, 4, 6, 'steel', step=16)
    for i, x in enumerate((8, 24, 40)):
        pipe_v(tc, x, 6, 16, 4, 'brass' if i == 1 else 'steel', flange=False)
        box(tc, x - 3, 2, x + 4, 8, 1, 'steel', base=4)
        handwheel(tc, x, 10, 4, 1.6)
    return tc.fin(.6)


def breaker_box(seed=0):
    """배전함 1x2(16x32, 벽 앞면 장식): 회색 철 함(문 이음·경첩), 번개 세모 무늬(글자 없음), 아래 큰 레버 손잡이, 위로 오르는 전선관."""
    tc = TC(16, 32, seed)
    for y in range(0, 8): tc.px(7, y, 'steel', 4); tc.px(8, y, 'steel', 2)
    box(tc, 1, 7, 15, 30, 2, 'steel', base=3, seed=seed)
    tc.vline(8, 10, 29, 'steel', 2)
    for (x, y) in ((4, 13), (5, 12), (6, 13), (3, 14), (4, 14), (5, 14), (6, 14), (7, 14)): tc.px(x, y, 'warn', 5)   # 세모
    tc.px(5, 13, 'cable', 1)
    tc.px(5, 14, 'cable', 1)
    for y in range(18, 27): tc.px(11, y, 'steel', 5); tc.px(12, y, 'steel', 2)
    tc.hline(9, 14, 18, 'redl', 5); tc.hline(9, 14, 19, 'redl', 3)
    lamp(tc, 3, 24, 'redl')
    rustify(tc, 0, 7, 16, 32, amount=.2, seed=seed + 2)
    return tc.fin(.6)


def cable_bundle(seed=0):
    """전선 다발 1x3(16x48, 벽 앞면 장식): 천장에서 늘어진 굵고 가는 고무 전선 다섯 가닥이 벽을 타고 내려와 강철 전선 받침에 묶이고
    아래 바닥 쪽 관으로 들어간다. 맨 위는 천장 띠에 걸친다."""
    tc = TC(16, 48, seed)
    xs = [(2, 2), (5, 3), (8, 2), (11, 3), (13, 2)]
    for i, (x0, w) in enumerate(xs):
        for y in range(48):
            dx = int(round(math.sin(y / 9.0 + i) * (1.6 if y < 20 else .6)))
            for j in range(w):
                k = 3 if j == 0 else (2 if j < w - 1 else 1)
                tc.px(x0 + dx + j, y, 'cable', k)
    for y in (14, 30):
        box(tc, 0, y, 16, y + 4, 1, 'steel', base=3)
    box(tc, 1, 42, 15, 48, 2, 'steel', base=2)
    return tc.fin(.6)


# ================================================================== 앵커 ① 컨베이어 라인 기계
def hopper_feeder(seed=0):
    """투입 호퍼 2x3(32x48): 컨베이어 첫 칸 위에 서는 깔때기 통 — 위가 넓은 강철 깔때기(안쪽 어둠 속 부품 더미), 경고 띠 테두리,
    아래 좁은 배출구가 벨트 위로, 네 다리. 위층 물체(컨베이어 칸 위에 얹는다, 막힘은 컨베이어가 한다)."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for lx in (3, 27):                                                               # 다리
        for y in range(18, 46): tc.px(lx, y, 'steel', 4); tc.px(lx + 1, y, 'steel', 2)
    for y in range(4, 22):                                                           # 깔때기 앞면(사다리꼴)
        f = (y - 4) / 18.0; xa = int(1 + f * 8); xb = int(31 - f * 8)
        for x in range(xa, xb):
            k = 4 if x < xa + 3 else (2 if x >= xb - 3 else 3)
            tc.px(x, y, 'steel', k)
    panels(tc, 4, 7, 28, 21, 'steel', 3, 12, 14, face='front', seed=seed, vary=0, rivets=True)
    for y in range(4, 22):
        f = (y - 4) / 18.0; xa = int(1 + f * 8); xb = int(31 - f * 8)
        if not (xa < 4 and xb > 28):
            for x in list(range(xa, 4)) + list(range(28, xb)): tc.px(x, y, 'steel', 3)
    tc.ell(16, 4, 15, 4, 'steel', 5); tc.ell(16, 4, 13, 3, 'dark', 1)               # 윗면 입
    for (x, y) in ((10, 4), (13, 3), (18, 4), (21, 5), (15, 5)): tc.px(x, y, 'brass', 4); tc.px(x + 1, y, 'brass', 2)
    hazard(tc, 3, 6, 29, 8, seed=seed + 1)
    for y in range(22, 30):                                                          # 배출구
        for x in range(11, 21): tc.px(x, y, 'steel', 4 if x < 13 else (2 if x > 18 else 3))
    tc.hline(11, 21, 30, 'dark', 1)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 2)
    return tc.fin(.6)


def stamping_press(seed=0):
    """찍기 프레스 3x3(48x48): 벨트를 사이에 두고 선 기둥 넷(뒤 둘은 벨트 위로, 앞 둘은 벨트 앞으로)이 받친 강철 들보, 들보 가운데
    유압 실린더와 반들거리는 막대, 벨트 바로 위 찍기 머리, 기둥 경고 띠, 붉은 표시등. 맨 아랫줄을 컨베이어 줄에 맞춰 얹는 위층 물체."""
    W, H = 48, 48; tc = TC(W, H, seed)
    for lx in (4, 40):                                                               # 뒤 기둥(벨트 윗면까지)
        for y in range(8, 34): tc.px(lx, y, 'steel', 3); tc.px(lx + 1, y, 'steel', 2); tc.px(lx + 2, y, 'steel', 1)
    box(tc, 0, 2, 48, 12, 3, 'steel', base=3, seed=seed)                             # 들보
    panels(tc, 1, 5, 47, 11, 'steel', 3, 16, 6, face='front', seed=seed + 1, vary=0, rivets=True)
    hazard(tc, 1, 9, 47, 11, seed=seed + 2)
    cyl(tc, 24, 12, 6, 2, 8, 'steel', seed=seed)                                     # 유압 실린더
    for y in range(20, 27): tc.px(23, y, 'steel', 6); tc.px(24, y, 'steel', 4); tc.px(25, y, 'steel', 2)
    box(tc, 15, 26, 33, 33, 2, 'steel', base=4, seed=seed + 3)                       # 찍기 머리
    for x in range(16, 33, 3): tc.px(x, 32, 'steel', 1)
    for lx in (2, 42):                                                               # 앞 기둥(바닥까지)
        for y in range(10, 47):
            k = 5 if lx == 2 else 4
            tc.px(lx, y, 'steel', k); tc.px(lx + 1, y, 'steel', k - 1); tc.px(lx + 2, y, 'steel', k - 2); tc.px(lx + 3, y, 'steel', 1)
        hazard(tc, lx, 34, lx + 4, 44, seed=seed + lx)
        box(tc, lx - 1, 44, lx + 5, 48, 1, 'steel', base=2)
    lamp(tc, 8, 4, 'redl', big=True)
    rustify(tc, 0, 0, W, H, amount=.22, seed=seed + 4)
    return tc.fin(.6)


def robot_arm(seed=0, mirror=False):
    """조립 로봇 팔 2x3(32x48): 바닥 볼트 박은 둥근 받침(강철) 위 노란 도장 회전대, 비스듬히 선 아래팔, 굵은 팔꿈치 관절(강철 원통),
    컨베이어 쪽으로 숙인 윗팔과 집게. 관절마다 검은 고무관. 얼굴·눈 없음. 밑동 줄만 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    cyl(tc, 12, 38, 9, 3, 5, 'steel', seed=seed)                                      # 받침
    for (x, y) in ((5, 39), (18, 39), (12, 41)): bolt(tc, x, y)
    cyl(tc, 12, 32, 6, 2.2, 5, 'warn', seed=seed)                                     # 회전대
    for i in range(22):                                                               # 아래팔(비스듬히 위로)
        t = i / 21.0; cx = 12 + t * 4; cy = 33 - t * 21
        for j in range(-3, 4):
            k = 5 if j < -1 else (4 if j < 2 else 2)
            tc.px(cx + j, cy, 'warn', k)
    tc.ell(16, 11, 4.6, 4.6, 'steel', lambda x, y: 5 if (x < 16 and y < 11) else 3)    # 팔꿈치
    tc.ell(16, 11, 1.8, 1.8, 'steel', 2); tc.px(15, 10, 'steel', 6)
    for i in range(14):                                                               # 윗팔(아래로 숙임)
        t = i / 13.0; cx = 18 + t * 9; cy = 11 + t * 9
        for j in range(-2, 3):
            k = 5 if j < 0 else (4 if j < 2 else 2)
            tc.px(cx, cy + j, 'warn', k)
    tc.ell(27, 21, 2.4, 2.4, 'steel', 4)                                              # 손목
    for (x, y) in ((25, 24), (25, 25), (25, 26), (29, 24), (29, 25), (29, 26), (26, 27), (28, 27)): tc.px(x, y, 'steel', 3)   # 집게
    for i in range(10): tc.px(10 + i * .5, 26 - i * 1.6, 'cable', 2)                   # 고무관
    hazard(tc, 6, 33, 18, 35, seed=seed + 2)
    tc.grain(.03)
    im = tc.fin(.6, shadow=(12, 45, 10, 2, 65))
    return flip(im) if mirror else im


def scanner_arch(seed=0):
    """검사 문틀 2x2(32x32): 컨베이어 위에 걸친 낮은 강철 문틀 — 들보 아래 청록 빛 띠가 벨트로 떨어지고, 앞 기둥 둘·표시등.
    컨베이어 칸 위에 얹는 위층 물체(막힘은 컨베이어)."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for lx in (2, 26):
        for y in range(4, 31):
            tc.px(lx, y, 'steel', 5); tc.px(lx + 1, y, 'steel', 4); tc.px(lx + 2, y, 'steel', 3); tc.px(lx + 3, y, 'steel', 1)
    box(tc, 0, 1, 32, 9, 3, 'steel', base=3, seed=seed)
    for x in range(7, 25):
        tc.px(x, 8, 'cyan', 6)
        for y in range(9, 26):
            if (x + y) % 2 == 0 and _hash(x, y, 3) < .5: tc.px(x, y, 'cyan', 4, a=110)
    lamp(tc, 6, 4, 'cyan'); lamp(tc, 24, 4, 'amber')
    return tc.fin(.6)


def crate_belt(seed=0, mat='paint'):
    """벨트 위 상자 1x1(16x16): 벨트 윗면 높이(칸 위에서 10px)에 앉은 작은 강철 상자 — 윗면·앞면, 모서리 띠, 그림자. 컨베이어 칸 위에 얹는다."""
    tc = TC(16, 16, seed)
    box(tc, 3, 1, 13, 10, 3, mat, base=3, seed=seed)
    for y in range(1, 10): tc.px(8, y, mat, 2 if y > 3 else 4)
    tc.hline(3, 13, 6, 'steel', 4)
    rustify(tc, 0, 0, 16, 16, amount=.2, seed=seed + 1, mats=(mat,))
    im = tc.fin(.6)
    return FB.shadow_under(im, 8, 10, 5, 1.5, 60)


def parts_tray(seed=0):
    """벨트 위 부품 판 1x1(16x16): 낮은 강철 쟁반에 담긴 놋쇠 톱니 셋과 볼트(벨트 윗면 높이). 컨베이어 칸 위에 얹는다."""
    tc = TC(16, 16, seed)
    box(tc, 2, 4, 14, 10, 2, 'steel', base=3, seed=seed)
    for (cx, cy, r) in ((5, 5, 2.2), (9, 4.6, 2.6), (12, 6, 1.6)):
        tc.ell(cx, cy, r, r * .6, 'brass', lambda x, y, cx=cx: 5 if x < cx else 3); tc.px(cx, cy, 'dark', 1)
    return FB.shadow_under(tc.fin(.6), 8, 10, 6, 1.5, 55)


def crate_stack(seed=0):
    """강철 상자 더미 2x2(32x32): 경고 띠 두른 강철 짐 상자 셋(아래 둘·위 하나, 판 줄눈·리벳), 위 상자는 붉은 도장. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for (x0, y0, x1, y1, m) in ((1, 16, 16, 31, 'steel'), (16, 14, 31, 31, 'steel'), (6, 2, 23, 17, 'paint')):
        box(tc, x0, y0, x1, y1, 4, m, base=3, seed=seed + x0)
        panels(tc, x0 + 1, y0 + 5, x1 - 1, y1 - 1, m, 3, x1 - x0 - 2, y1 - y0 - 6, face='front', seed=seed + y0, vary=0)
        hazard(tc, x0 + 1, y1 - 4, x1 - 1, y1 - 2, seed=seed + x0)
    rustify(tc, 0, 0, W, H, amount=.25, seed=seed + 3, mats=('steel', 'paint'))
    return tc.fin(.6, shadow=(16, 31, 15, 2, 65))


def parts_bin(seed=0):
    """부품 통 1x1(16x16): 윗면이 열린 강철 통에 담긴 놋쇠 톱니·볼트 더미, 앞 경고 띠. 막힘."""
    tc = TC(16, 16, seed)
    box(tc, 1, 3, 15, 15, 4, 'steel', base=3, seed=seed)
    for y in range(3, 7):
        for x in range(2, 14): tc.px(x, y, 'dark', 1)
    for (x, y) in ((3, 4), (6, 3), (9, 4), (11, 3), (5, 5), (8, 5), (12, 5)):
        tc.px(x, y, 'brass', 5); tc.px(x + 1, y, 'brass', 3); tc.px(x, y + 1, 'brass', 2)
    hazard(tc, 2, 11, 14, 13, seed=seed)
    return tc.fin(.6, shadow=(8, 15, 7, 1.5, 60))


def pallet_load(seed=0):
    """짐 깔판 2x1(32x16): 나무 깔판(버들항 나무 램프) 위에 띠로 묶은 강철 상자 둘과 납작한 판재 더미. 막힘."""
    W, H = 32, 16; tc = TC(W, H, seed)
    box(tc, 1, 11, 31, 16, 1, 'wood', base=3, seed=seed)
    for x in range(3, 30, 6): tc.px(x, 14, 'wood', 1); tc.px(x + 1, 14, 'wood', 1)
    box(tc, 3, 1, 15, 12, 3, 'paint', base=3, seed=seed + 1)
    box(tc, 15, 4, 29, 12, 3, 'steel', base=3, seed=seed + 2)
    for x in range(3, 29): tc.px(x, 8, 'cable', 2)                                    # 묶음 띠
    rustify(tc, 0, 0, W, H, amount=.2, seed=seed + 3, mats=('steel', 'paint'))
    return tc.fin(.6)


def hand_cart(seed=0):
    """손수레 1x1(16x16): 강철 판 바닥 수레(바퀴 둘), 세운 손잡이 관, 실린 상자 하나. 막힘."""
    tc = TC(16, 16, seed)
    for y in range(1, 11): tc.px(13, y, 'warn', 5); tc.px(14, y, 'warn', 3)
    tc.hline(11, 15, 1, 'warn', 6)
    box(tc, 1, 9, 14, 13, 1, 'steel', base=3)
    box(tc, 3, 2, 11, 10, 2, 'paint', base=3, seed=seed)
    for wx in (3, 11): tc.ell(wx, 14, 1.6, 1.6, 'cable', 2); tc.px(wx, 13, 'steel', 5)
    return tc.fin(.6, shadow=(8, 15, 7, 1.5, 55))


def gear_scrap(seed=0):
    """바닥 부품 흩어짐 1x1(16x16, 걷기·사람 아래): 떨어진 작은 톱니 둘·볼트·기름 자국."""
    tc = TC(16, 16, seed)
    for y in range(8, 15):
        for x in range(2, 14):
            if ((x - 8) / 6) ** 2 + ((y - 11) / 3) ** 2 < 1 and _hash(x, y, seed + 3) < .7: tc.px(x, y, 'cable', 1, a=150)
    for (cx, cy, r) in ((5, 10, 2), (11, 12, 1.6)):
        tc.ell(cx, cy, r, r * .6, 'brass', lambda x, y, cx=cx: 5 if x < cx else 3); tc.px(cx, cy, 'dark', 1)
    tc.px(8, 13, 'steel', 6); tc.px(9, 13, 'steel', 3)
    return tc.img()
