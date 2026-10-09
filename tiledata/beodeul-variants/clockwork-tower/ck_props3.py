# 시계탑 소품 — 시계공 작업대·톱니 선반·톱니 상자·기름통·기름 깡통·연장 상자·떨어진 큰 바늘·부러진 톱니·고철 더미·작은 종 걸이·
# 큰 모래시계·천체 시계(오러리)·구리 탱크·놋쇠 등 기둥·구덩이 속 톱니, 바닥 장식(흩어진 톱니·볼트·벽돌 부스러기).
# 3/4 시점(윗면 + 앞면), 빛 왼쪽 위. 글자·숫자 없음.
import math
from ck_base import *
from ck_base import _hash
from mf_factory import gear_face, handwheel
from fr_props import cyl
from fr_mech import gauge
from ck_props1 import gear_top
from ck_props2 import verdigris


def workbench(seed=0):
    """시계공 작업대 3x2: 참나무 상판(윗면 넓게, 놋쇠 모) 위 분해한 톱니 둘·작은 태엽·핀셋·확대경 등(놋쇠 팔 끝 호박빛),
    앞면 서랍 셋(놋쇠 손잡이), 다리. 아랫줄 막힘, 윗면 줄 걷기 + 가림."""
    W, H = 48, 32; tc = TC(W, H, seed)
    box(tc, 2, 10, 46, 30, 9, 'oak', base=3, seed=seed)
    tc.hline(2, 46, 10, 'brass', 5)
    for x0 in (4, 18, 32):
        tc.rect(x0 + 1, 21, x0 + 12, 27, 'oak', 2); tc.hline(x0 + 1, x0 + 12, 21, 'oak', 4)
        tc.px(x0 + 6, 24, 'brass', 6); tc.px(x0 + 7, 24, 'brass', 3)
    for x in (3, 44): tc.rect(x, 29, x + 2, 32, 'oak', 2)
    gear_top(tc, 14, 15, 5, 10, 'brass', .3, spokes=3, ry=2.6)
    gear_top(tc, 24, 16, 3, 8, 'steel', .1, spokes=3, ry=1.8)
    for i in range(20):
        a = i * .55; r = .6 + i * .16; tc.px(31 + math.cos(a) * r, 15 + math.sin(a) * r * .6, 'steel', 5)
    tc.line(6, 14, 10, 17, 'steel', 5)
    tc.line(40, 16, 40, 3, 'brass', 4); tc.line(40, 3, 34, 3, 'brass', 4)
    tc.ell(34, 5, 2.6, 2, 'amber', 6); tc.hline(31, 38, 3, 'brass', 5)
    return tc.fin(.6, shadow=(24, 31, 22, 2, 60))


def gear_shelf(seed=0):
    """톱니 선반 2x2: 참나무 선반 두 단에 크기 다른 예비 톱니(놋쇠·무쇠)가 세워져 있고 아래 칸에 태엽 통 둘. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 1, 2, 31, 32, 3, 'oak', base=2, seed=seed)
    for y in (16, 29): tc.hline(2, 30, y, 'oak', 4); tc.hline(2, 30, y + 1, 'oak', 1)
    for y in range(5, 16):
        for x in range(3, 29): tc.px(x, y, 'oak', 1)
    for y in range(18, 29):
        for x in range(3, 29): tc.px(x, y, 'oak', 1)
    gear_face(tc, 9, 11, 4, 8, 'brass', .2, spokes=3, hub_mat='steel')
    gear_face(tc, 19, 12, 3, 7, 'steel', .5, spokes=3, hub_mat='brass')
    gear_face(tc, 26, 12, 2.4, 6, 'brass', .1, spokes=3, hub_mat='brass')
    for cx in (9, 21): cyl(tc, cx, 22, 4, 1.6, 5, 'brass', seed=seed + cx)
    return tc.fin(.6)


def gear_crate(seed=0):
    """톱니 상자 1x1: 위가 열린 참나무 상자(놋쇠 모서리쇠)에 담긴 놋쇠 톱니 더미. 막힘."""
    tc = TC(16, 16, seed)
    box(tc, 1, 5, 15, 16, 3, 'oak', base=3, seed=seed)
    for y in range(6, 8):
        for x in range(2, 14): tc.px(x, y, 'oak', 1)
    for (cx, cy, m) in ((5, 6, 'brass'), (10, 5, 'steel'), (8, 7, 'brass')):
        tc.ell(cx, cy, 2.6, 1.6, m, lambda x, y, cx=cx: 5 if x < cx else 3); tc.px(cx, cy, 'dark', 1)
    for (x, y) in ((1, 9), (14, 9), (1, 15), (14, 15)): tc.px(x, y, 'brass', 5)
    return tc.fin(.6)


def oil_barrel(seed=0):
    """기름통 1x1: 놋쇠 테 둘 두른 참나무 통, 윗면 마개와 흘러내린 검은 기름 자국. 막힘."""
    tc = TC(16, 16, seed)
    cyl(tc, 8, 4, 6, 2.4, 9, 'oak', seed=seed)
    for y in (6, 12):
        for x in range(2, 15): tc.px(x, y, 'brass', 5 if x < 7 else 3)
    tc.px(6, 3, 'steel', 2); tc.px(7, 3, 'steel', 1)
    for y in range(5, 11): tc.px(10, y, 'dark', 1)
    return tc.fin(.6, shadow=(8, 15, 7, 2, 60))


def oil_can(seed=0):
    """기름 깡통 1x1: 바닥에 놓인 작은 놋쇠 주둥이 깡통(긴 부리·손잡이 고리). 막힘."""
    tc = TC(16, 16, seed)
    cyl(tc, 7, 9, 4, 1.8, 4, 'brass', seed=seed)
    tc.line(10, 9, 15, 5, 'brass', 4); tc.px(15, 4, 'brass', 6)
    for a in range(200, 341, 15):
        r = math.radians(a); tc.px(7 + 3 * math.cos(r), 8 + 3 * math.sin(r), 'steel', 4)
    return tc.fin(.6, shadow=(7, 15, 5, 1.5, 60))


def toolbox(seed=0):
    """연장 상자 1x1: 무쇠 띠 두른 참나무 상자, 위 놋쇠 손잡이와 삐져나온 렌치 끝. 막힘."""
    tc = TC(16, 16, seed)
    box(tc, 1, 7, 15, 16, 3, 'oak', base=3, seed=seed)
    tc.hline(1, 15, 12, 'steel', 3)
    tc.rect(6, 3, 10, 5, 'brass', 4); tc.vline(5, 3, 8, 'brass', 3); tc.vline(10, 3, 8, 'brass', 3)
    tc.line(11, 8, 14, 4, 'steel', 5); tc.px(14, 3, 'steel', 5); tc.px(15, 4, 'steel', 3)
    return tc.fin(.6, shadow=(8, 15, 7, 2, 60))


def fallen_hand(seed=0):
    """떨어진 큰 시계 바늘 3x1: 바닥에 누운 거대한 놋쇠 분침(가운데 꽃 무늬 고리, 화살 끝, 뒤 꼬리 평형추), 끝이 바닥 판을 긁었다. 막힘."""
    W, H = 48, 16; tc = TC(W, H, seed)
    for x in range(2, 44):
        w = 1.6 if x > 14 else 2.2
        for y in range(int(9 - w), int(9 + w) + 1): tc.px(x, y, 'brass', 5 if y < 9 else 3)
    tc.poly([(40, 3), (47, 9), (40, 15)], 'brass', lambda x, y: 5 if y < 9 else 3)
    for y in range(4, 15):
        for x in range(10, 21):
            dx = x + .5 - 15; dy = (y + .5 - 9) * 1.2
            if 3.4 < math.hypot(dx, dy) < 5.6: tc.px(x, y, 'brass', 6 if dx + dy < 0 else 3)
    tc.ell(4, 9, 3, 3, 'brass', lambda x, y: 6 if x < 4 else 3)
    for x in range(4, 46): tc.px(x, 13 if x < 40 else 15, 'dark', 1) if _hash(x, 0, seed) < .2 else None
    return tc.fin(.6, shadow=(24, 14, 22, 2, 60))


def broken_gear(seed=0):
    """부러진 큰 톱니 2x2: 이빨 몇 개가 빠지고 반쯤 깨진 큰 놋쇠 톱니가 바닥 받침에 기대 섰다, 깨진 조각 하나는 앞 바닥에. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    gear_face(tc, 16, 15, 11, 14, 'brass', .3, spokes=4, hub_mat='steel')
    for y in range(H):                                                              # 오른쪽 위 1/4 이 깨져 나갔다
        for x in range(H):
            dx = x + .5 - 16; dy = y + .5 - 15
            if dx > 1 and dy < -1 and dx - dy > 9 + 3 * math.sin(x * 1.3): tc.m[y, x] = 0
    box(tc, 4, 26, 28, 32, 2, 'steel', base=2, seed=seed)
    tc.poly([(22, 28), (29, 25), (31, 30)], 'brass', 4)
    return tc.fin(.6)


def cog_pile(seed=0):
    """고철 더미 2x2: 버려진 톱니·축·태엽·관 토막이 쌓인 더미(크기 다른 톱니가 비스듬히 겹친다). 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for i in range(22):
        x = 4 + _hash(i, 1, seed) * 24; y = 18 + _hash(i, 2, seed) * 12 - abs(x - 16) * .3
        m = ('brass', 'steel', 'rust')[int(_hash(i, 3, seed) * 3)]
        r = 1.6 + _hash(i, 4, seed) * 3
        tc.ell(x, y, r, r * .6, m, lambda xx, yy, x=x: 5 if xx < x else 3)
        tc.px(x, y, 'dark', 1)
    gear_face(tc, 14, 14, 5, 9, 'brass', .4, spokes=3, hub_mat='steel')
    gear_face(tc, 22, 18, 3.4, 8, 'steel', .1, spokes=3, hub_mat='brass')
    tc.line(5, 22, 13, 12, 'steel', 4, 2)
    return tc.fin(.6, shadow=(16, 31, 13, 2.5, 60))


def chime_rack(seed=0):
    """작은 종 걸이 2x2: 참나무 틀에 나란히 매달린 크기 다른 놋쇠 종 넷(차임), 위 들보에 작은 망치 줄. 아랫줄 막힘(받침)."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for x0 in (1, 28): box(tc, x0, 2, x0 + 3, 32, 1, 'oak', base=3, seed=seed + x0)
    box(tc, 0, 0, 32, 5, 2, 'oak', base=4, seed=seed)
    box(tc, 2, 27, 30, 32, 2, 'oak', base=2, seed=seed + 1)
    for i, (cx, sz) in enumerate(((7, 5), (13, 4.4), (19, 3.8), (25, 3.2))):
        top = 7 + i
        for y in range(int(top), int(top + sz * 2.4)):
            t = (y - top) / (sz * 2.4); hw = sz * (.55 + .5 * t)
            for x in range(int(cx - hw), int(cx + hw) + 1):
                u = (x + .5 - cx) / max(1, hw)
                tc.px(x, y, 'brass', 5 if u < -.3 else (4 if u < .3 else 3))
        tc.vline(cx, 5, top, 'steel', 3)
    return tc.fin(.6)


def hourglass(seed=0):
    """큰 모래시계 1x2: 놋쇠 위·아래 판과 세 기둥 사이 잘록한 유리(위 모래 조금, 흘러내리는 줄, 아래 쌓인 모래). 밑동만 막힘."""
    W, H = 16, 32; tc = TC(W, H, seed)
    for y in range(4, 28):
        t = abs(y - 16) / 12.0; hw = 1.2 + 4.6 * t
        for x in range(int(8 - hw), int(8 + hw) + 1):
            sand = (y > 22 and y > 28 - 6 * (1 - abs(x - 8) / 6)) or (8 <= y < 11 and y > 8 + abs(x - 8) * .5)
            tc.px(x, y, 'plaster' if sand else 'glass', (5 if x < 8 else 4) if sand else (4 if x < 7 else 2), a=255 if sand else 200)
    tc.vline(8, 11, 24, 'plaster', 5)
    for (y0, y1) in ((1, 4), (28, 31)): box(tc, 1, y0, 15, y1, 1, 'brass', base=4, seed=seed + y0)
    for x in (2, 13): tc.vline(x, 4, 28, 'brass', 4 if x == 2 else 2)
    return tc.fin(.6, shadow=(8, 31, 6, 1.5, 60))


def orrery(seed=0):
    """천체 시계(오러리) 2x2: 참나무 받침 위 놋쇠 기둥, 가운데 호박빛 해 구슬과 둘레 고리 셋(기운 타원), 고리 끝 작은 행성 구슬. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 6, 24, 26, 32, 3, 'oak', base=3, seed=seed)
    tc.hline(6, 26, 24, 'brass', 5)
    tc.vline(15, 14, 25, 'brass', 5); tc.vline(16, 14, 25, 'brass', 3)
    for i, (rx, ry, ph) in enumerate(((13, 4, 0), (9.5, 3, 1.2), (6, 2, 2.4))):
        for a in range(0, 360, 4):
            r = math.radians(a); x = 16 + rx * math.cos(r); y = 12 + ry * math.sin(r) - rx * .12 * math.cos(r)
            tc.px(x - .5, y - .5, 'brass', 5 if a > 180 else 3)
        r = ph; x = 16 + rx * math.cos(r); y = 12 + ry * math.sin(r) - rx * .12 * math.cos(r)
        tc.ell(x, y, 1.8, 1.8, ('cyan', 'rust', 'stone')[i], lambda xx, yy, x=x: 5 if xx < x else 3)
    tc.ell(16, 12, 3, 3, 'amber', lambda x, y: 6 if (x < 16 and y < 12) else 5)
    return tc.fin(.6, shadow=(16, 31, 10, 2, 60))


def copper_tank(seed=0):
    """구리 압력 탱크 2x3: 둥근 지붕 세운 구리 원통(리벳 줄 둘·녹청), 앞 압력계, 놋쇠 다리 셋, 위 안전밸브와 김. 밑동만 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for lx in (7, 15, 23): tc.rect(lx, 40, lx + 2, 47, 'brass', 3); tc.px(lx, 40, 'brass', 5)
    cyl(tc, 16, 10, 12, 5, 26, 'rust', seed=seed)
    for y in (18, 32):
        for x in range(4, 29): tc.px(x, y, 'rust', 6 if x % 4 == 1 else 2)
    verdigris(tc, 4, 6, 29, 42, .1, seed)
    gauge(tc, 16, 25, 3.4, seed)
    tc.rect(15, 0, 18, 6, 'brass', 4); tc.hline(13, 20, 1, 'brass', 6)
    return tc.fin(.6, shadow=(16, 46, 13, 2, 60))


def lamp_post(seed=0):
    """놋쇠 등 기둥 1x2: 둥근 받침 위 놋쇠 기둥(마디 테 둘) 끝 유리 등갓 속 호박빛 불. 밑동만 막힘(위 칸 걷기 + 가림)."""
    W, H = 16, 32; tc = TC(W, H, seed)
    tc.ell(8, 29, 4.5, 2, 'brass', lambda x, y: 5 if x < 8 else 3)
    for y in range(10, 29): tc.px(7, y, 'brass', 5); tc.px(8, y, 'brass', 3)
    for y in (16, 23): tc.hline(6, 10, y, 'brass', 4)
    tc.ell(7.5, 6, 3.6, 4, 'amber', lambda x, y: 6 if (x < 8 and y < 6) else 5)
    tc.hline(4, 12, 1, 'brass', 5); tc.hline(4, 12, 10, 'brass', 3)
    for x in (4, 11): tc.vline(x, 2, 10, 'brass', 3)
    return tc.fin(.6, shadow=(8, 31, 5, 1.5, 60))


def pit_gears(seed=0):
    """구덩이 속 톱니 4x3(바닥 장식, 톱니 구덩이 칸 위에만): 깊은 어둠 속에서 맞물려 도는 큰 놋쇠 톱니 둘과 무쇠 톱니 하나, 축,
    밑에서 올라오는 흐린 호박빛(한두 단 어둡게)."""
    W, H = 64, 48; tc = TC(W, H, seed)
    gear_face(tc, 20, 26, 15, 16, 'brass', .2, spokes=5, hub_mat='steel')
    gear_face(tc, 45, 20, 9, 12, 'steel', .5, spokes=3, hub_mat='brass')
    gear_face(tc, 52, 38, 6, 9, 'brass', .1, spokes=3, hub_mat='steel')
    tc.t = np.where(tc.m > 0, np.clip(tc.t - 2, 1, 6), tc.t)                     # 깊이(두 단 어둡게)
    im = tc.fin(.5)
    return im


# ================================================================== 바닥 장식 (걷기, 사람 아래)
def spare_gears(seed=0):
    """흩어진 톱니 2x1: 바닥에 떨어진 작은 놋쇠 톱니 셋·무쇠 톱니 하나·볼트 몇, 기름 자국 하나."""
    W, H = 32, 16; tc = TC(W, H, seed)
    tc.ell(22, 11, 4, 1.8, 'dark', 1)
    for (cx, cy, r, m) in ((6, 8, 3.2, 'brass'), (13, 11, 2.2, 'steel'), (20, 6, 2.6, 'brass'), (27, 10, 1.8, 'brass')):
        for y in range(16):
            for x in range(32):
                dx = (x + .5 - cx) / r; dy = (y + .5 - cy) / (r * .65); d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                if d <= 1 + (.25 if math.cos(a * 8) > .2 else 0):
                    tc.px(x, y, m, 1 if d < .3 else (5 if dx < 0 else 3))
    for (x, y) in ((10, 4), (16, 13), (29, 4)): tc.px(x, y, 'steel', 5); tc.px(x + 1, y, 'steel', 2)
    return tc.fin(.7)


def bolt_scatter(seed=0):
    """볼트·태엽 조각 1x1: 바닥에 흩어진 볼트 넷과 끊어진 작은 태엽 한 가닥."""
    tc = TC(16, 16, seed)
    for i in range(4):
        x = 2 + _hash(i, 1, seed) * 11; y = 3 + _hash(i, 2, seed) * 10
        tc.px(x, y, 'steel', 5); tc.px(x + 1, y, 'steel', 3); tc.px(x, y + 1, 'steel', 2)
    for i in range(14):
        a = i * .6; r = .5 + i * .22; tc.px(9 + math.cos(a) * r, 9 + math.sin(a) * r * .6, 'brass', 4)
    return tc.fin(.7)


def brick_rubble(seed=0):
    """벽돌 부스러기 1x1: 떨어진 벽돌 조각 셋(윗면 + 앞면)과 모르타르 가루 점."""
    tc = TC(16, 16, seed)
    for (x0, y0, w, h) in ((2, 8, 6, 4), (9, 10, 5, 3), (6, 4, 4, 3)):
        box(tc, x0, y0, x0 + w, y0 + h, 1, 'brick', base=3, seed=seed + x0)
    for i in range(6): tc.px(1 + _hash(i, 3, seed) * 14, 2 + _hash(i, 4, seed) * 13, 'stone', 4)
    return tc.fin(.7)
