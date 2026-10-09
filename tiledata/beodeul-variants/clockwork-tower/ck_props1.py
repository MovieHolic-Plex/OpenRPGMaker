# 시계탑 앵커 조각 — 큰 벽 톱니·시계 문자판 뒷면·탈진기·진자·큰 종·태엽 드럼·톱니 기관·태엽 장치 문·놋쇠 난간 계단.
# 모두 fr_mat 톤 캔버스(TC)에 machine-factory/future-ruins 기계 재질 규약(판 줄눈·리벳·관·box)으로 찍는다. 정면 톱니는 mf_factory.gear_face.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위. 글자·숫자·상표 없음.
import math
from ck_base import *
from ck_base import _hash
from mf_factory import gear_face, handwheel
from fr_props import cyl, steam_puff
from fr_mech import gauge


def gear_top(tc, cx, cy, r, teeth, mat='brass', phase=0.0, spokes=4, ry=None):
    """바닥에 누운 톱니(3/4 윗면 타원 + 아래 두께 2px): 이빨·테·바퀴살·굴대. 빛 왼쪽 위."""
    ry = ry or r * .62
    def inside(x, y):
        dx = (x + .5 - cx) / r; dy = (y + .5 - cy) / ry * 1.0
        d = math.hypot(dx, dy); a = math.atan2(dy, dx)
        return d <= 1 + (.16 if math.cos(a * teeth + phase) > .2 else 0), d, a, dx, dy
    for y in range(int(cy - ry - 4), int(cy + ry + 6)):
        for x in range(int(cx - r - 4), int(cx + r + 4)):
            ins, d, a, dx, dy = inside(x, y)
            if not ins:
                if any(inside(x, y - j)[0] for j in (1, 2)): tc.px(x, y, mat, 2 if dx > 0 else 3)   # 두께(아래)
                continue
            light = -(dx * .7 + dy * .7) / max(.01, d) * .5 + .5
            if d > .84: k = 4 + (1 if light > .6 else 0) - (1 if light < .3 else 0)
            elif d > .7: k = 2
            elif d < .2: k = 5 if dx < 0 else 3
            else:
                sp = any(abs(math.sin(a - i * math.pi / spokes)) * d * r < 1.6 for i in range(spokes))
                if not sp: tc.px(x, y, 'dark', 1); continue
                k = 4 if light > .5 else 3
            tc.px(x, y, mat, k)


def escape_wheel(tc, cx, cy, r, teeth=15, mat='brass'):
    """탈진 바퀴: 갈고리 모양 뾰족 이빨(톱날) + 테 + 바퀴살 넷, 남쪽을 향해 선다."""
    for y in range(int(cy - r - 4), int(cy + r + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            ph = ((a / (2 * math.pi) * teeth) % 1.0)
            out = r + 3.2 * (1 - ph)                                        # 톱날(한쪽은 곧게 서고 한쪽은 비스듬히)
            if d > out: continue
            light = -(dx * .7 + dy * .7) / max(1.0, d) * .5 + .5
            if d > r - .5: k = 5 if light > .5 else 3
            elif d > r - 2.5: k = 4 if light > .5 else 3
            elif d < 2.2: k = 6 if light > .5 else 3
            else:
                sp = any(abs(math.sin(a - i * math.pi / 4)) * d < 1.3 for i in range(4))
                if not sp: tc.px(x, y, 'dark', 1); continue
                k = 4 if light > .5 else 3
            tc.px(x, y, mat, k)


# ================================================================== 큰 벽 톱니 4x3 (벽 앞면 장식)
def great_gear_wall(seed=0):
    """벽에 반쯤 박힌 큰 놋쇠 톱니(반지름 22, 이빨 18, 바퀴살 다섯)와 맞물린 쇠 톱니 둘, 굴대 받침 판(리벳)과 아래 굴대 받침대.
    벽 앞면 3줄 위 장식(막힘과 상관없다)."""
    W, H = 64, 48; tc = TC(W, H, seed)
    box(tc, 20, 2, 44, 46, 2, 'steel', base=2, seed=seed)                         # 굴대 받침 판(뒤)
    gear_face(tc, 28, 24, 19, 18, 'brass', .15 + seed * .3, spokes=5, hub_mat='steel')
    gear_face(tc, 53, 12, 8, 10, 'steel', .4, spokes=3, hub_mat='brass')
    gear_face(tc, 54, 35, 6, 8, 'brass', .1, spokes=3, hub_mat='steel')
    for (x, y) in ((22, 5), (41, 5), (22, 43), (41, 43)): tc.px(x, y, 'steel', 6)
    tc.grain(.03)
    return tc.fin(.6)


# ================================================================== 시계 문자판 뒷면 3x3 (벽 앞면 장식)
def clock_dial(seed=0, lit=True):
    """탑 밖 문자판을 안에서 본 둥근 유리창: 해가 비치는 호박빛 유리(가운데 밝고 테 쪽 한 단), 열두 갈래 어두운 창살,
    테 안쪽 시 표지 열두 개(네모 덩이, 글자 없음), 굵은 놋쇠 테(이빨 없는 고리 3px)와 리벳, 가운데 굴대 통과 놋쇠 덩이와
    뒤집혀 보이는 바늘 둘(검은 실루엣). lit=False 는 흐린 날의 어두운 유리."""
    W, H = 48, 48; tc = TC(W, H, seed)
    cx, cy, r = 23.5, 23.5, 22
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if d > r: continue
            if d > r - 3.2:
                light = -(dx * .7 + dy * .7) / d * .5 + .5
                k = 5 if light > .62 else (4 if light > .35 else 2)
                if d > r - 1.0: k -= 1
                tc.px(x, y, 'brass', k); continue
            if d > r - 4.2: tc.px(x, y, 'oak', 1); continue
            seg = (a / (2 * math.pi) * 12) % 1.0
            if min(seg, 1 - seg) * 2 * math.pi * d / 12 < .8 and d > 4: tc.px(x, y, 'steel', 1); continue   # 창살
            if abs(d - (r - 7.5)) < 1.6 and min(seg, 1 - seg) < .07: tc.px(x, y, 'oak', 1); continue   # 시 표지(뒷면)
            if lit:
                k = 6 if d < 6 else (5 if d < r - 9 else 4)
                if (x + y) % 7 == 0 and d < r - 6: k -= 1
                tc.px(x, y, 'amber', k)
            else:
                tc.px(x, y, 'glass', 3 if d < r - 9 else 2)
    # 바늘(뒤에서 본 검은 실루엣): 분침 위 왼쪽으로 길게, 시침 오른쪽 아래로 짧게
    for t in range(2, 17): tc.px(cx - .5 - t * .55, cy - .5 - t * .82, 'steel', 1); tc.px(cx + .5 - t * .55, cy - .5 - t * .82, 'steel', 1)
    for t in range(2, 11): tc.px(cx - .5 + t * .85, cy - .5 + t * .35, 'steel', 1); tc.px(cx - .5 + t * .85, cy + .5 + t * .35, 'steel', 1)
    tc.ell(cx, cy, 3.4, 3.4, 'brass', lambda x, y: 6 if (x < cx and y < cy) else 3)
    tc.px(int(cx) - 1, int(cy) - 1, 'brass', 6)
    for i in range(8):
        a = i * math.pi / 4 + .39
        tc.px(cx + math.cos(a) * (r - 1.6) - .5, cy + math.sin(a) * (r - 1.6) - .5, 'brass', 6)
    return tc.fin(.6)


# ================================================================== 탈진기 4x4 (앵커)
def escapement(seed=0):
    """대형 탈진기: 참나무 받침(윗면 + 앞면, 놋쇠 모) 위 리벳 무쇠 틀 기둥 둘과 위 들보, 틀 가운데 선 톱날 이빨 탈진 바퀴,
    그 위 닻 모양 앵커(두 갈고리가 이빨에 걸친다)와 앵커 굴대, 옆 작은 톱니 둘·사슬. 아래 2줄 막힘(받침), 위는 걷기 + 가림."""
    W, H = 64, 64; tc = TC(W, H, seed)
    box(tc, 2, 44, 62, 64, 5, 'oak', base=3, seed=seed)                          # 참나무 받침
    tc.hline(2, 62, 44, 'brass', 5); tc.hline(2, 62, 49, 'brass', 3)
    for x in (8, 30, 54): tc.px(x, 56, 'brass', 6); tc.px(x + 1, 57, 'oak', 1)
    for x0 in (8, 52):                                                             # 틀 기둥
        box(tc, x0, 6, x0 + 5, 46, 1, 'steel', base=2, seed=seed + x0)
        for y in range(10, 44, 8): tc.px(x0 + 2, y, 'brass', 6)
    box(tc, 6, 2, 59, 9, 2, 'steel', base=3, seed=seed + 1)                        # 위 들보
    for x in range(10, 56, 8): tc.px(x, 6, 'brass', 6)
    escape_wheel(tc, 31, 31, 12, 15)
    # 앵커(닻): 굴대(31,12)에서 좌우로 벌어진 팔, 끝 갈고리가 바퀴 이빨 위로
    for t in range(0, 15):
        for s_ in (-1, 1):
            x = 31 + s_ * t; y = 12 + t * .62
            tc.px(x, y, 'steel', 4 if s_ < 0 else 3); tc.px(x, y + 1, 'steel', 2)
    for s_ in (-1, 1):
        for j in range(4): tc.px(31 + s_ * 14, 21 + j, 'steel', 4 if s_ < 0 else 2)
    for y in range(9, 13): tc.px(30, y, 'steel', 5); tc.px(31, y, 'steel', 3)
    tc.ell(30.5, 12, 2.4, 2.4, 'brass', lambda x, y: 6 if x < 30.5 else 3)
    gear_face(tc, 46, 38, 5, 9, 'brass', .3, spokes=3, hub_mat='steel')
    gear_face(tc, 17, 39, 4, 8, 'steel', .1, spokes=3, hub_mat='brass')
    for i in range(10): tc.px(46 + (i % 2), 26 + i * 1.2, 'steel', 4 if i % 2 else 2)
    tc.grain(.03)
    return tc.fin(.6, shadow=(32, 62, 30, 2, 70))


# ================================================================== 진자 2x6 (구덩이 위 장식)
def pendulum(seed=0, swing=0.0):
    """거대한 진자: 위 끝 = 벽에 박은 무쇠 걸쇠 판(리벳)과 굴대, 놋쇠 막대(2px, 마디 고리 둘)가 아래로, 끝 = 큰 놋쇠 추 원판
    (반지름 12, 3/4 로 보이는 위 두께 띠·가운데 볼록 장식·빛 반사). swing = 기울기(라디안, 흔들린 자리)."""
    W, H = 32, 96; tc = TC(W, H, seed)
    box(tc, 9, 0, 23, 9, 2, 'steel', base=3, seed=seed)                          # 걸쇠 판
    for (x, y) in ((11, 4), (20, 4)): tc.px(x, y, 'brass', 6)
    tc.ell(16, 6, 2.2, 2.2, 'brass', lambda x, y: 6 if x < 16 else 3)
    L = 70; bx = 16 + math.sin(swing) * L; by = 6 + math.cos(swing) * L
    n = 140
    for i in range(n):
        f = i / n; x = 16 + (bx - 16) * f; y = 6 + (by - 6) * f
        tc.px(x - .5, y, 'brass', 5); tc.px(x + .5, y, 'brass', 3)
        if i in (40, 90):
            for j in (-1.5, -.5, .5, 1.5): tc.px(x + j, y, 'brass', 6 if j < 0 else 2); tc.px(x + j, y + 1, 'brass', 2)
    R = 11.5
    for y in range(int(by - R - 3), int(by + R + 2)):
        for x in range(int(bx - R - 1), int(bx + R + 2)):
            dx = x + .5 - bx; dy = y + .5 - by; d = math.hypot(dx, dy)
            if d > R:
                if math.hypot(dx, dy + 2) <= R and dy < 0: tc.px(x, y, 'brass', 6 if dx < 2 else 4)   # 위 두께 띠
                continue
            light = -(dx * .7 + dy * .7) / max(1.0, d) * .5 + .5
            k = 5 if light > .6 else (4 if light > .38 else 3)
            if d > R - 1.5: k -= 1
            if d < 5: k = 5 if light > .5 else 3
            if d < 2: k = 6
            if abs(d - 7.5) < .6: k = 2
            tc.px(x, y, 'brass', k)
    return tc.fin(.6)


# ================================================================== 큰 종 3x4 (앵커)
def great_bell(seed=0):
    """시계탑 큰 종: 참나무 종틀(기둥 둘·위 들보·버팀 사선, 놋쇠 띠쇠) 아래 매달린 청동 종(어깨·허리·벌어진 입, 가로 테 셋,
    왼쪽 위 빛·오른쪽 그늘·입 속 어둠), 종 속 추(혀) 끝이 보인다. 기둥 밑동 두 칸만 막힘, 종 아래는 비어 있어 걷기 + 가림."""
    W, H = 48, 64; tc = TC(W, H, seed)
    for x0 in (3, 40):
        box(tc, x0, 4, x0 + 5, 64, 1, 'oak', base=3, seed=seed + x0)
        for y in (14, 40): tc.hline(x0, x0 + 5, y, 'brass', 4)
    box(tc, 1, 1, 47, 8, 2, 'oak', base=4, seed=seed + 1)
    for x in (8, 39): tc.line(x, 8, x + (6 if x < 20 else -6), 14, 'oak', 3, 2)
    for x in range(6, 44, 9): tc.px(x, 4, 'brass', 6)
    tc.rect(22, 8, 26, 12, 'steel', 3)                                            # 매달기 고리
    for y in range(12, 50):
        t = (y - 12) / 38.0
        hw = 6 + 11 * (t ** 1.6) + (1.5 if y > 46 else 0)
        for x in range(int(24 - hw), int(24 + hw) + 1):
            u = (x + .5 - 24) / max(1, hw)
            k = 5 if u < -.45 else (4 if u < .1 else (3 if u < .6 else 2))
            if y < 14: k += 1
            if y in (20, 36, 45): k += 1 if u < .2 else 0
            if y in (21, 37, 46): k -= 1
            tc.px(x, y, 'brass', clampk(k - (1 if t > .5 else 0) + (0 if u < .2 else 0)))
    for x in range(10, 39):                                                        # 입(속 어둠 타원)
        u = (x + .5 - 24) / 14.0
        if abs(u) < 1:
            for y in range(48, 48 + int(3 * math.sqrt(1 - u * u)) + 1): tc.px(x, y, 'dark', 1)
    tc.rect(23, 48, 25, 52, 'steel', 2); tc.px(23, 52, 'steel', 4)                 # 추 끝
    tc.grain(.03)
    return tc.fin(.6, shadow=(24, 62, 20, 2, 60))


# ================================================================== 태엽 드럼 3x2
def winding_drum(seed=0):
    """태엽 감는 드럼: 무쇠 받침틀 위 누운 참나무 드럼(감긴 사슬 고리 줄), 양 끝 놋쇠 원판, 오른쪽 놋쇠 크랭크 바퀴와 손잡이,
    드럼에서 위로 풀려 나간 사슬. 아랫줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    box(tc, 2, 22, 46, 32, 3, 'steel', base=2, seed=seed)
    for y in range(6, 24):
        t = (y - 6 + .5) / 18
        k = MK.fcyl(t)
        for x in range(7, 36):
            kk = k - 1
            if (x - 7) % 4 in (0, 1) and 8 < y < 22: kk = k + (0 if (x - 7) % 4 == 0 else -1)   # 사슬 고리
            tc.px(x, y, 'oak' if (x - 7) % 4 > 1 else 'steel', clampk(kk))
    for x0 in (4, 36):
        for y in range(4, 26):
            t = (y - 4 + .5) / 22
            tc.px(x0, y, 'brass', clampk(MK.fcyl(t) + 1)); tc.px(x0 + 1, y, 'brass', MK.fcyl(t)); tc.px(x0 + 2, y, 'brass', clampk(MK.fcyl(t) - 1))
    gear_face(tc, 42, 14, 5, 10, 'brass', .2, spokes=4, hub_mat='steel')
    tc.line(42, 14, 46, 6, 'steel', 4); tc.rect(45, 3, 47, 7, 'oak', 4)
    for i in range(7): tc.px(20 + (i % 2), 5 - i * .8, 'steel', 4 if i % 2 else 2)
    return tc.fin(.6, shadow=(24, 30, 20, 2, 60))


# ================================================================== 톱니 기관 4x3
def gear_train(seed=0):
    """톱니 기관(시계 장치 몸통): 리벳 무쇠 상자(윗면이 넓게 보인다) 윗면에 누운 놋쇠 톱니 셋이 맞물려 돌고, 앞면에 작은 선 톱니
    둘과 점검 창(속 톱니가 비친다), 놋쇠 모 띠. 아래 2줄 막힘(몸통), 윗면 줄은 걷기 + 가림."""
    W, H = 64, 48; tc = TC(W, H, seed)
    box(tc, 2, 6, 62, 48, 18, 'steel', base=2, seed=seed)
    panels(tc, 3, 25, 61, 46, 'steel', 2, 29, 21, face='front', seed=seed + 2, vary=0)
    tc.hline(2, 62, 6, 'brass', 5); tc.hline(2, 62, 24, 'brass', 4); tc.hline(2, 62, 25, 'brass', 2)
    gear_top(tc, 18, 14, 12, 14, 'brass', .2 + seed, spokes=4)
    gear_top(tc, 38, 13, 8, 10, 'brass', .6, spokes=3)
    gear_top(tc, 52, 16, 6, 8, 'steel', .1, spokes=3)
    for y in range(30, 42):                                                        # 점검 창
        for x in range(36, 56):
            if x in (36, 55) or y in (30, 41): tc.px(x, y, 'brass', 5 if (x == 36 or y == 30) else 2); continue
            tc.px(x, y, 'dark', 1)
    gear_face(tc, 45.5, 37, 5, 8, 'brass', .3, spokes=3, hub_mat='steel')
    gear_face(tc, 14, 35, 5, 9, 'brass', .5, spokes=3, hub_mat='steel')
    gear_face(tc, 25, 38, 3.2, 7, 'steel', .1, spokes=3, hub_mat='brass')
    tc.grain(.03)
    return tc.fin(.6, shadow=(32, 46, 30, 2, 70))


# ================================================================== 태엽 장치 문 (닫힘 3x3 장식 · 열림 4x4 통로)
def _vault(tc, cx, cy, r, phase=0.0, open_=False):
    """둥근 금고 문: 바깥 톱니 고리(이빨 20), 리벳 판 문짝, 가운데 놋쇠 바퀴(바퀴살 넷)와 빗장 막대 넷."""
    for y in range(int(cy - r - 4), int(cy + r + 4)):
        for x in range(int(cx - r - 4), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            rr = r + (2 if math.cos(a * 20 + phase) > .25 else 0)
            if d > rr: continue
            light = -(dx * .7 + dy * .7) / max(1.0, d) * .5 + .5
            if d > r - 3: k = 5 if light > .6 else (4 if light > .35 else 2); tc.px(x, y, 'brass', k); continue
            if d > r - 4: tc.px(x, y, 'dark', 1); continue
            k = 3 if light > .5 else 2
            if abs(d - (r - 8)) < .6: k = 1 if dy > 0 else 4
            tc.px(x, y, 'steel', k)
    for i in range(8):
        a = i * math.pi / 4 + .39; tc.px(cx + math.cos(a) * (r - 6) - .5, cy + math.sin(a) * (r - 6) - .5, 'brass', 6)
    for i in range(4):                                                             # 빗장 막대
        a = i * math.pi / 2 + .785
        for t in range(3, int(r - 8)):
            tc.px(cx + math.cos(a) * t - .5, cy + math.sin(a) * t - .5, 'brass', 5 if i in (0, 3) else 3)
    gear_face(tc, cx, cy, 4.5, 8, 'brass', .2, spokes=4, hub_mat='steel')


def clockwork_door(seed=0):
    """닫힌 태엽 장치 문 3x3: 벽돌 벽에 박은 무쇠 테 판(리벳) 안 둥근 금고 문(톱니 고리·빗장 넷·가운데 놋쇠 바퀴), 옆 작은 톱니 둘이
    잠금 사슬을 문다. 벽 앞면 장식 — 잠긴 문 이벤트는 문 아래 바닥 칸에."""
    W, H = 48, 48; tc = TC(W, H, seed)
    box(tc, 2, 1, 46, 48, 2, 'steel', base=2, seed=seed)
    for (x, y) in ((5, 6), (42, 6), (5, 44), (42, 44)): tc.px(x, y, 'brass', 6)
    _vault(tc, 24, 25, 17, .3)
    gear_face(tc, 5, 24, 3, 7, 'brass', .1, spokes=3, hub_mat='steel')
    gear_face(tc, 43, 24, 3, 7, 'brass', .4, spokes=3, hub_mat='steel')
    return tc.fin(.6)


def clockwork_gate(seed=0):
    """열린 태엽 장치 문 4x4(통로 위층): 벽을 뚫은 2칸 통로 양옆 놋쇠 띠 무쇠 기둥(톱니 쌓임), 위 아치 상인방에 반쯤 드러난
    큰 톱니(돌아서 열린 자리), 문짝(둥근 금고 문)은 왼쪽 기둥 속으로 굴러 들어가 테만 보인다, 바닥 문 홈 줄.
    가운데 두 열 아래 2줄 = 통로(걷기), 위 2줄 = 걷기 + 가림, 양옆 열 = 벽."""
    W, H = 64, 64; tc = TC(W, H, seed)
    for x0 in (0, 48):
        box(tc, x0, 10, x0 + 16, 64, 2, 'steel', base=2, seed=seed + x0)
        for y in range(16, 62, 12):
            tc.hline(x0 + 1, x0 + 15, y, 'brass', 4); tc.hline(x0 + 1, x0 + 15, y + 1, 'brass', 2)
        gear_face(tc, x0 + 8, 40, 5, 9, 'brass', .3 + x0, spokes=3, hub_mat='steel')
    box(tc, 0, 0, 64, 14, 3, 'steel', base=3, seed=seed + 1)
    tc.hline(0, 64, 13, 'brass', 3)
    for y in range(0, 14):                                                         # 상인방 속 반 톱니
        for x in range(18, 46):
            dx = x + .5 - 32; dy = y + .5 - 14; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if d < 11 + (2 if math.cos(a * 14) > .2 else 0) and dy < 0:
                k = 5 if dx < -2 else (4 if dx < 4 else 3)
                if d < 3: k = 6
                elif 6 < d < 8: k = 2
                tc.px(x, y, 'brass', k)
    for y in range(14, 64):                                                        # 통로 그늘(문 속 어둠 → 아래로 밝게: 바닥 칸은 비움)
        for x in range(16, 48):
            if y < 30: tc.px(x, y, 'dark', 1 if y < 22 else 2, a=255 if y < 26 else 170)
    for y in range(18, 60):                                                        # 왼쪽 기둥 속으로 들어간 문짝 테
        tc.px(15, y, 'brass', 5 if y % 4 else 3); tc.px(14, y, 'brass', 3)
    tc.hline(16, 48, 62, 'steel', 1); tc.hline(16, 48, 63, 'brass', 3)            # 문 홈
    return tc.fin(.6)


# ================================================================== 놋쇠 난간 계단
def stair_up(seed=0):
    """오름 계단 2x3(바닥 위, 북쪽 벽으로 오른다): 참나무 디딤판 여섯 단(위로 갈수록 좁고 밝게, 디딤 모 놋쇠 띠), 양옆 놋쇠 난간
    (손잡이 관 + 기둥 셋, 머리 공). 맨 윗줄 = 위층 이동 칸. 전부 걷기."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for i in range(6):
        y0 = 46 - (i + 1) * 7; y1 = y0 + 7
        for y in range(max(0, y0), y1):
            for x in range(4, 28):
                ly = y - y0
                if ly == 0: tc.px(x, y, 'brass', 5 if x < 16 else 4); continue
                k = (4 if ly < 3 else 3) - (1 if x > 22 else 0) + (i // 3)
                if ly == 6: k = 1
                tc.px(x, y, 'oak', clampk(k))
    for y in range(0, 4):
        for x in range(4, 28): tc.px(x, y, 'dark', 1)
    for x0 in (2, 28):
        for y in range(2, 46): tc.px(x0, y, 'brass', 5 if x0 == 2 else 3); tc.px(x0 + 1, y, 'brass', 2)
        for yp in (8, 24, 40):
            tc.ell(x0 + .5, yp, 1.6, 1.6, 'brass', 6 if x0 == 2 else 4)
    return tc.fin(.6)


def stair_down(seed=0):
    """내림 계단 2x3(바닥에 뚫린 구멍): 놋쇠 턱 안으로 북쪽을 향해 어둠 속 내려가는 참나무 디딤판 여섯 단, 아래로 갈수록 어둡게,
    구멍 양옆과 남쪽 끝 놋쇠 난간(남쪽 끝은 열려 있다 — 들어서는 쪽). 맨 윗줄 = 아래층 이동 칸. 전부 걷기."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for y in range(0, 48):
        for x in range(2, 30):
            if x in (2, 29) or y in (0, 1):
                tc.px(x, y, 'brass', 5 if (x == 2 or y == 0) else 2); continue
            ly = (47 - y) % 7
            step = (47 - y) // 7
            k = 4 - step // 2
            if ly == 6: tc.px(x, y, 'brass', clampk(4 - step // 2, 1, 4)); continue
            if ly == 0: k = 1
            tc.px(x, y, 'oak', clampk(k, 1, 4))
    for y in range(2, 14):
        for x in range(3, 29): tc.px(x, y, 'dark', 1 if y < 9 else 2)
    for x0 in (0, 30):
        for y in range(4, 44): tc.px(x0, y, 'brass', 5 if x0 == 0 else 3); tc.px(x0 + 1, y, 'brass', 2)
        tc.ell(x0 + .5, 44, 1.6, 1.6, 'brass', 6); tc.ell(x0 + .5, 4, 1.6, 1.6, 'brass', 5)
    return tc.fin(.6)


def stair_well(seed=0):
    """벽 계단 입구 2x3(벽 앞면 장식): 벽돌 벽을 뚫은 놋쇠 아치 테 안으로 위층 계단이 오르고 꼭대기에 따뜻한 등불 빛."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            dx = x + .5 - 16; top = 14 - math.sqrt(max(0, 14 * 14 - dx * dx)) * .9 + 2
            if abs(dx) > 14 or y < top - 3: continue
            if abs(dx) > 12 or y < top:
                tc.px(x, y, 'brass', 5 if dx < 0 or y < top - 1 else 3); continue
            step = (47 - y) // 6
            k = 2 + step // 2
            if (47 - y) % 6 == 0: tc.px(x, y, 'brass', clampk(k, 1, 5)); continue
            tc.px(x, y, 'oak' if y > 14 else 'amber', clampk(k if y > 14 else 5, 1, 6))
    return tc.fin(.6)
