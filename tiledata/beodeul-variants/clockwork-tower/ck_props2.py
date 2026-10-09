# 시계탑 기계·관·벽 장식 조각 — 구리관 기둥·바닥 관·구리 보일러·피스톤 펌프·레버 판·굴대 기둥·톱니 바닥 원판,
# 벽 장식(압력계 판·밸브 바퀴·추 한 쌍·사슬·밸런스 휠·작은 톱니·벽 등·세로 구리관), 바닥 장식(증기 구멍).
# 구리 = RUST 램프 톤 3~6(녹청 점은 verd), 놋쇠 = BRASS, 무쇠 = STEEL, 나무 = oak. 3/4 시점, 빛 왼쪽 위. 글자·숫자 없음.
import math
from ck_base import *
from ck_base import _hash
from mf_factory import gear_face, handwheel
from fr_props import cyl, steam_puff
from fr_mech import gauge
from ck_props1 import gear_top


def verdigris(tc, x0, y0, x1, y1, p=.06, seed=0):
    """구리 위 녹청 점: 어두운 쪽(톤 ≤4)에만 드문드문."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            g = tc.get(x, y)
            if g and g[0] == 'rust' and g[1] <= 4 and _hash(x, y, seed + 91) < p: tc.px(x, y, 'verd', 3 if g[1] >= 3 else 2)


# ================================================================== 구리관 기둥 1x3 (키 큰 부드러운 물체)
def copper_riser(seed=0):
    """바닥 놋쇠 받침에서 천장으로 오르는 굵은 구리관(지름 8, 이음 테 16px), 가운데 놋쇠 바퀴 밸브, 이음에서 새는 흰 김. 밑동만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    box(tc, 2, 40, 14, 48, 2, 'brass', base=3, seed=seed)
    pipe_v(tc, 8, 0, 41, 8, 'rust', step=16)
    verdigris(tc, 3, 0, 13, 40, .08, seed)
    handwheel(tc, 8, 24, 4, 1.6, 'brass')
    im = tc.fin(.6)
    im.alpha_composite(steam_puff(12, 10, seed + 3, 150), (8, 4))
    return im


def floor_pipe(seed=0):
    """바닥 관 3x1: 낮은 무쇠 받침 둘 위 가로 구리관(지름 8, 이음 테), 가운데 놋쇠 밸브 손잡이, 한쪽 끝은 바닥 속으로 꺾여 들어간다. 막힘."""
    W, H = 48, 16; tc = TC(W, H, seed)
    for x0 in (6, 34): box(tc, x0, 10, x0 + 8, 16, 2, 'steel', base=2, seed=seed + x0)
    pipe_h(tc, 0, 44, 7, 8, 'rust', step=16)
    for y in range(3, 16):
        k = MK.fcyl((y - 3 + .5) / 13)
    for x in range(40, 48):
        for y in range(3, 16):
            tc.px(x, y, 'rust', MK.fcyl((x - 40 + .5) / 8) - (1 if y > 12 else 0))
    tc.hline(39, 48, 15, 'steel', 2)
    verdigris(tc, 0, 3, 48, 12, .07, seed)
    tc.rect(22, 0, 24, 4, 'brass', 4); tc.hline(19, 28, 1, 'brass', 5); tc.hline(19, 28, 2, 'brass', 2)
    return tc.fin(.6)


def copper_boiler(seed=0):
    """작은 구리 보일러 2x3: 놋쇠 다리 넷 위 둥근 지붕 구리 통(리벳 줄 둘·녹청), 앞 압력계와 호박빛 불 창, 위 굴뚝 관과 안전밸브.
    밑동 줄만 막힘(위 2줄 걷기 + 가림)."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for x in (6, 11, 20, 25): tc.rect(x, 41, x + 2, 48, 'brass', 3); tc.px(x, 41, 'brass', 5)
    cyl(tc, 16, 14, 12, 4, 26, 'rust', seed=seed)
    for y in (22, 34):
        for x in range(4, 29): tc.px(x, y, 'rust', 6 if x % 4 == 1 else 3)
    verdigris(tc, 4, 10, 29, 44, .07, seed)
    gauge(tc, 10, 28, 3, seed)
    tc.rect(17, 30, 25, 38, 'steel', 1)
    for x in range(18, 24):
        for y in range(31, 37): tc.px(x, y, 'amber', 5 if (x + y) % 3 else 6)
    for x in range(18, 25, 2): tc.vline(x, 31, 37, 'steel', 1)
    pipe_v(tc, 21, 0, 12, 4, 'rust', flange=False)
    tc.rect(9, 6, 12, 11, 'brass', 4); tc.px(9, 5, 'brass', 6)
    im = tc.fin(.6, shadow=(16, 46, 13, 2, 60))
    im.alpha_composite(steam_puff(12, 8, seed + 5, 140), (16, 0))
    return im


def piston_pump(seed=0):
    """피스톤 펌프 2x2: 무쇠 받침 상자(리벳) 위 선 놋쇠 실린더 둘과 반들거리는 피스톤 막대, 위 흔들 들보(가운데 굴대), 옆 구리 관. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 1, 18, 31, 32, 4, 'steel', base=2, seed=seed)
    for (x, y) in ((4, 26), (27, 26)): tc.px(x, y, 'brass', 6)
    for cx in (9, 23): cyl(tc, cx, 12, 4, 2, 7, 'brass', seed=seed + cx)
    for cx in (9, 23):
        for y in range(4, 11): tc.px(cx - 1, y, 'steel', 6); tc.px(cx, y, 'steel', 4)
    tc.line(6, 4, 26, 2, 'steel', 4, 2)
    tc.ell(16, 3, 2, 2, 'brass', 6)
    pipe_v(tc, 29, 6, 20, 4, 'rust', flange=False)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def lever_bank(seed=0):
    """레버 판 2x2: 비스듬한 참나무 조작대(놋쇠 테) 윗면에 놋쇠 레버 셋(하나는 내려감)과 작은 압력계, 앞면 놋쇠 판. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 2, 14, 30, 32, 7, 'oak', base=3, seed=seed)
    tc.hline(2, 30, 14, 'brass', 5); tc.hline(2, 30, 21, 'brass', 3)
    tc.rect(8, 23, 24, 29, 'brass', 3); tc.hline(8, 24, 23, 'brass', 5)
    for i, (x, up) in enumerate(((8, True), (14, False), (20, True))):
        for j in range(8):
            yy = 17 - j if up else 17 - j // 2
            tc.px(x + (0 if up else j // 2), yy, 'steel', 5); tc.px(x + 1 + (0 if up else j // 2), yy, 'steel', 3)
        hx_, hy = (x, 9) if up else (x + 4, 13)
        tc.ell(hx_ + .5, hy, 1.8, 1.6, 'brass', 6)
    gauge(tc, 26, 17, 2, seed)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def axle_column(seed=0):
    """굴대 기둥 1x3: 바닥 무쇠 상자(빗톱니 한 쌍이 윗면에 맞물린다)에서 천장으로 오르는 놋쇠 띠 감은 무쇠 굴대. 밑동만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    box(tc, 1, 36, 15, 48, 4, 'steel', base=2, seed=seed)
    for y in range(0, 38):
        for x in range(5, 11):
            k = MK.fcyl((x - 5 + .5) / 6)
            if y % 12 in (0, 1): tc.px(x, y, 'brass', k + (1 if y % 12 == 0 else -1)); continue
            tc.px(x, y, 'steel', k - 1)
    gear_top(tc, 8, 38, 6, 10, 'brass', .3, spokes=3, ry=2.6)
    tc.px(3, 44, 'brass', 6); tc.px(12, 44, 'brass', 6)
    return tc.fin(.6)


def gear_floor_plate(seed=0, big=True):
    """톱니 바닥 원판 3x3(큰) · 2x2(작은): 바닥에 평평하게 박힌 거대한 놋쇠 톱니 원판(위에서 본 타원, 바퀴살 여섯, 살 사이는 무쇠 디딤판),
    가운데 굴대 덮개. 걸을 수 있는 바닥 장식 — 돌아가는 발판 이벤트 자리."""
    W, H = (48, 48) if big else (32, 32); tc = TC(W, H, seed)
    cx, cy = W / 2, H / 2; r = W / 2 - 3
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - cx) / r; dy = (y + .5 - cy) / r; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            teeth = 16 if big else 12
            if d > 1 + (.08 if math.cos(a * teeth + seed) > .2 else -.02): continue
            light = -(dx + dy) * .5 / max(.01, d) * .5 + .5
            if d > .86: k = 4 + (1 if light > .55 else 0)
            elif d > .8: k = 2
            elif d < .16: k = 5 if dx < 0 else 3
            elif d < .22: k = 2
            else:
                sp = any(abs(math.sin(a - i * math.pi / 6)) * d * r < 1.5 for i in range(6))
                if not sp:
                    lx = int(x + y * .5) % 6
                    tc.px(x, y, 'steel', 3 if lx else 2); continue
                k = 4 if light > .5 else 3
            tc.px(x, y, 'brass', k)
    return tc.fin(.7)


# ================================================================== 벽 장식 (벽 앞면 위, 막힘과 상관없다)
def gauge_panel(seed=0):
    """압력계 판 2x1: 놋쇠 테 무쇠 판에 압력계 둘(숫자 없음)과 아래로 내려가는 가는 구리관."""
    W, H = 32, 16; tc = TC(W, H, seed)
    box(tc, 1, 1, 31, 13, 1, 'steel', base=2, seed=seed)
    tc.hline(1, 31, 1, 'brass', 5); tc.hline(1, 31, 12, 'brass', 2)
    gauge(tc, 9, 7, 3, seed); gauge(tc, 22, 7, 3, seed + 1)
    tc.vline(15, 12, 16, 'rust', 5); tc.vline(16, 12, 16, 'rust', 3)
    return tc.fin(.6)


def valve_wheel(seed=0):
    """벽 밸브 바퀴 1x1: 벽에서 나온 짧은 구리관 끝 놋쇠 바퀴(바퀴살 넷)."""
    tc = TC(16, 16, seed)
    pipe_v(tc, 8, 0, 8, 4, 'rust', flange=False)
    for a in range(0, 360, 10):
        r = math.radians(a); tc.px(8 + 6 * math.cos(r) - .5, 9 + 5 * math.sin(r) - .5, 'brass', 5 if 120 < a < 300 else 3)
    tc.hline(3, 14, 9, 'brass', 4); tc.vline(8, 4, 14, 'brass', 4)
    tc.ell(8, 9, 1.5, 1.5, 'brass', 6)
    return tc.fin(.6)


def counterweights(seed=0):
    """추 한 쌍 1x3: 위 들보 도르래에서 내려온 사슬 둘, 높이가 다른 무쇠 원통 추(놋쇠 띠·고리)."""
    W, H = 16, 48; tc = TC(W, H, seed)
    tc.rect(1, 0, 15, 3, 'oak', 3); tc.ell(8, 3, 3, 2, 'brass', 5)
    for (x, y1) in ((4, 22), (11, 32)):
        for y in range(3, y1): tc.px(x, y, 'steel', 5 if y % 2 else 2)
        for y in range(y1, y1 + 12):
            for xx in range(x - 3, x + 3):
                k = MK.fcyl((xx - x + 3 + .5) / 6) - 1
                if y in (y1 + 2, y1 + 9): tc.px(xx, y, 'brass', k + 1); continue
                tc.px(xx, y, 'steel', k)
        tc.hline(x - 3, x + 3, y1, 'steel', 5)
    return tc.fin(.6)


def chain_hang(seed=0):
    """늘어진 사슬 1x3: 천장 고리에서 내려와 아래 갈고리로 끝나는 무쇠 사슬(고리 엇갈림)."""
    W, H = 16, 48; tc = TC(W, H, seed)
    for y in range(0, 40):
        x = 8 + (1 if (y // 3) % 2 else 0) * (1 if y % 3 != 1 else 0)
        tc.px(x, y, 'steel', 5 if y % 3 != 2 else 2); tc.px(x + 1, y, 'steel', 3 if y % 3 == 0 else 1)
    for (x, y) in ((8, 40), (9, 41), (9, 42), (8, 43), (7, 43), (6, 42), (6, 41)): tc.px(x, y, 'steel', 4)
    return tc.fin(.6)


def balance_wheel(seed=0):
    """밸런스 휠 2x2: 벽 받침 판 위 놋쇠 고리 바퀴(바퀴살 셋)와 가운데 감긴 헤어스프링 소용돌이, 위 작은 받침 다리."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 3, 2, 29, 30, 1, 'steel', base=2, seed=seed)
    cx, cy = 16, 17
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy)
            if 10 < d < 12.6: tc.px(x, y, 'brass', 5 if dx + dy < 0 else 3)
    for i in range(3):
        a = i * 2.094 + .3
        for t in range(3, 11): tc.px(cx + math.cos(a) * t - .5, cy + math.sin(a) * t - .5, 'brass', 4)
    for i in range(70):
        a = i * .32; r = 1 + i * .095
        tc.px(cx + math.cos(a) * r - .5, cy + math.sin(a) * r - .5, 'steel', 5 if i % 3 else 3)
    tc.rect(12, 2, 20, 5, 'brass', 4); tc.hline(12, 20, 2, 'brass', 6)
    return tc.fin(.6)


def small_gear_wall(seed=0):
    """작은 벽 톱니 1x1: 벽 굴대에 박힌 놋쇠 톱니 하나(바퀴살 셋)."""
    tc = TC(16, 16, seed)
    gear_face(tc, 8, 8, 4.5, 9, 'brass' if seed % 2 == 0 else 'steel', seed * .7, spokes=3, hub_mat='steel' if seed % 2 == 0 else 'brass')
    return tc.fin(.6)


def wall_lamp(seed=0, on=True):
    """벽 등 1x1: 놋쇠 받침 팔 끝 둥근 유리 갓 속 호박빛 불(꺼짐 = 어두운 유리)."""
    tc = TC(16, 16, seed)
    tc.rect(7, 12, 10, 16, 'brass', 3); tc.hline(4, 12, 11, 'brass', 5)
    tc.ell(8, 7, 3.6, 4, 'amber' if on else 'glass', lambda x, y: (6 if (x < 8 and y < 7) else 5) if on else 2)
    tc.hline(5, 12, 2, 'brass', 5); tc.px(8, 1, 'brass', 6)
    for y in (4, 8): tc.hline(5, 12, y, 'brass', 3)
    return tc.fin(.6)


def wall_pipe(seed=0):
    """벽 세로 구리관 1x3: 벽을 따라 내려오는 구리관(지름 6, 받침쇠 둘), 아래에서 앞으로 꺾여 바닥으로."""
    W, H = 16, 48; tc = TC(W, H, seed)
    pipe_v(tc, 8, 0, 44, 6, 'rust', step=16)
    for y in (10, 30): tc.rect(4, y, 13, y + 2, 'steel', 3); tc.hline(4, 13, y, 'steel', 5)
    tc.rect(5, 43, 12, 48, 'rust', 3); tc.hline(5, 12, 43, 'rust', 5)
    verdigris(tc, 4, 0, 13, 48, .08, seed)
    return tc.fin(.6)


# ================================================================== 바닥 장식 (걷기)
def steam_vent(seed=0):
    """증기 구멍 1x1: 바닥에 박힌 놋쇠 테 둥근 창살 구멍(속 어둠, 방사형 살)과 위로 피어오르는 흰 김 덩이."""
    tc = TC(16, 16, seed)
    for y in range(16):
        for x in range(16):
            dx = (x + .5 - 8) / 6.5; dy = (y + .5 - 10) / 4.2; d = math.hypot(dx, dy)
            if d > 1: continue
            if d > .78: tc.px(x, y, 'brass', 5 if dy < 0 else 3); continue
            a = math.atan2(dy, dx)
            tc.px(x, y, 'brass' if abs(math.sin(a * 3)) < .25 else 'dark', 2 if abs(math.sin(a * 3)) < .25 else 1)
    im = tc.fin(.7)
    im.alpha_composite(steam_puff(12, 9, seed + 7, 130), (2, 0))
    return im


def floor_hatch(seed=0):
    """놋쇠 점검 뚜껑 1x1: 바닥 판 가운데 둥근 놋쇠 뚜껑(작은 톱니 테·누운 고리 손잡이)."""
    tc = TC(16, 16, seed)
    for y in range(16):
        for x in range(16):
            dx = (x + .5 - 8) / 6.5; dy = (y + .5 - 8) / 5; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if d > 1 + (.1 if math.cos(a * 10) > .3 else 0): continue
            k = 5 if dx + dy < -.3 else (4 if dx + dy < .4 else 3)
            if .66 < d < .78: k = 2
            tc.px(x, y, 'brass', k)
    for (x, y) in ((6, 8), (7, 9), (8, 9), (9, 9), (10, 8)): tc.px(x, y, 'steel', 4)
    return tc.fin(.7)
