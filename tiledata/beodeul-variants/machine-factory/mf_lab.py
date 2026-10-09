# 지하 연구소 조각 — 앵커 ③(유리 배양관 열)·④(제어반 벽)와 연구소 기물.
# fr_mat 톤 캔버스 + 기계 재질 규약(판 줄눈·리벳·관·전선·유리 빛줄). 배양관 속은 비었거나 흐린 그림자만(생물 형체·얼굴 없음).
# 화면·제어반에 글자·숫자 없음(막대·파형 무늬만). 3/4 시점, 빛 왼쪽 위.
import math
from mf_kit import *
from mf_kit import _hash
from fr_props import cyl, steam_puff
from fr_mech import gauge
from mf_factory import handwheel, lever


# ================================================================== 앵커 ③ 유리 배양관
def _tube(seed=0, level=1.0, shade=0.0, broken=False):
    """배양관 2x3(32x48) 공용: 강철 받침(표시등 줄·관 이음) 위 유리 원통(지름 22) 속 초록 배양액(level 0..1, 위 빈 곳은 어두운 유리),
    거품 줄, shade = 가운데 흐린 그림자 세기(윤곽 없는 어두운 덩이), 위 강철 뚜껑에서 천장으로 오르는 관 둘. broken = 앞 유리가
    들쭉날쭉 깨져 액이 빠지고 속이 어둡다."""
    W, H = 32, 48; tc = TC(W, H, seed)
    cx = 16; rx = 11; top = 9; bot = 37
    # 받침
    cyl(tc, cx, 37, 13, 3.4, 6, 'steel', seed=seed)
    for i, x in enumerate(range(8, 25, 4)): lamp(tc, x, 43, ['cyan', 'amber', 'cyan', 'redl', 'cyan'][i], on=not broken or i == 3)
    # 유리 몸통
    lvl_y = bot - (bot - top) * level
    for y in range(top, bot + 1):
        for x in range(cx - rx, cx + rx + 1):
            u = (x + .5 - cx) / rx
            if abs(u) > 1: continue
            t = (u + 1) / 2
            if broken:
                jag = top + 8 + 6 * math.sin(x * 1.7 + seed) + 4 * _hash(x, 0, seed + 3)
                if y > jag and abs(u) < .86 and y < bot - 3 + 2 * math.sin(x * 2.3):
                    tc.px(x, y, 'dark', 1 if abs(u) < .5 else 2); continue
            if y >= lvl_y and not broken:
                k = 3 + (1 if t < .3 else 0) - (1 if t > .78 else 0)
                if y < lvl_y + 1.5: k = 5                                         # 액면 빛
                if shade > 0:
                    d = ((x + .5 - cx) / 5.5) ** 2 + ((y + .5 - (top + bot) / 2 - 2) / 9.0) ** 2
                    if d < 1 and _hash(x, y, seed + 9) < .55 + shade * .4: k = max(1, k - (2 if d < .45 else 1))
                tc.px(x, y, 'bio', k)
            else:
                k = 2 + (1 if t < .25 else 0)
                tc.px(x, y, 'glass', k)
            if abs(t - .2) < .045 or abs(t - .27) < .02: tc.px(x, y, 'glass' if y < lvl_y else 'bio', 6)   # 세로 빛줄
            if t > .93: tc.shift(x, y, -1)
    if not broken:
        for i in range(9):                                                            # 거품
            bx = cx + 3 + int(_hash(i, 1, seed) * 4) - 2; by = bot - 3 - i * 3
            if by > lvl_y + 1: tc.px(bx, by, 'bio', 6); tc.px(bx - 1, by + 1, 'bio', 5)
    else:
        for (x, y) in ((6, 17), (7, 21), (24, 15), (25, 19), (13, 14), (19, 16)): tc.px(x, y, 'glass', 6)
    for y in (top, bot):                                                              # 위아래 강철 테
        for x in range(cx - rx, cx + rx + 1): tc.px(x, y, 'steel', 5 if y == top else 3)
    cyl(tc, cx, 6, 12, 3.2, 3, 'steel', seed=seed)                                    # 뚜껑
    for px_ in (10, 22):
        for y in range(0, 4): tc.px(px_, y, 'steel', 4); tc.px(px_ + 1, y, 'cable', 2)
    tc.grain(.02, mats=('steel',))
    return tc.fin(.6, shadow=(16, 46, 14, 2, 70))

def culture_tube(seed=0): return _tube(seed, 1.0, .7)
def culture_tube_dim(seed=3): return _tube(seed, .82, .25)
def culture_tube_empty(seed=5): return _tube(seed, .18, 0)
def culture_tube_broken(seed=7): return _tube(seed, 0, 0, broken=True)


def tube_spill(seed=0):
    """흘러나온 배양액 2x2(32x32, 바닥 장식·걷기): 깨진 배양관 앞 초록 웅덩이(액면 빛·가장자리 진하게)와 흩어진 유리 조각."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            d = ((x + .5 - 15) / 13) ** 2 + ((y + .5 - 14) / 8.5) ** 2 + (vnoise(x, y, 4, seed + 1) - .5) * .7
            if d < 1:
                k = 2 if d > .72 else (3 if d > .3 else 4)
                if _hash(x, y, seed + 2) < .05: k = 6
                tc.px(x, y, 'bio', k, a=210)
    for (x, y) in ((4, 22), (9, 25), (22, 24), (27, 18), (17, 27)):
        tc.px(x, y, 'glass', 6); tc.px(x + 1, y, 'glass', 4); tc.px(x, y + 1, 'glass', 2)
    return tc.img()


def tube_pod(seed=0):
    """배양관 조작대 1x2(16x32): 세운 강철 받침 위 비스듬한 조작판(초록 파형 화면·단추 줄), 뒤로 나간 전선. 아랫줄 막힘."""
    W, H = 16, 32; tc = TC(W, H, seed)
    box(tc, 3, 14, 13, 31, 2, 'steel', base=3, seed=seed)
    box(tc, 0, 6, 16, 16, 5, 'steel', base=3, seed=seed + 1)
    screen(tc, 2, 7, 14, 11, 'scr', on=True, seed=seed, bars=False)
    button_row(tc, 3, 13, 4, seed)
    lamp(tc, 6, 20, 'cyan')
    return tc.fin(.6, shadow=(8, 31, 6, 1.5, 60))


def cable_floor(seed=0):
    """바닥 전선 다발 2x1(32x16, 바닥 장식·걷기): 굵기 다른 고무 전선 넷이 바닥을 따라 구불구불 지나간다. 가로로 이어 깐다."""
    W, H = 32, 16; tc = TC(W, H, seed)
    for i, (y0, w) in enumerate(((5, 3), (8, 2), (10, 3), (13, 2))):
        for x in range(W):
            y = y0 + math.sin(x / 32 * 2 * math.pi + i * 1.3) * 1.2
            for j in range(w): tc.px(x, y + j, 'cable', 4 if j == 0 else (2 if j < w - 1 else 1))
    return tc.img()


def specimen_shelf(seed=0):
    """표본 선반 2x2(32x32): 강철 선반 두 단에 초록 액 병(크고 작은)·흐린 유리병·상자, 아래 선반 다리. 아랫줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for lx in (1, 29):
        for y in range(2, 31): tc.px(lx, y, 'steel', 4); tc.px(lx + 1, y, 'steel', 2)
    for sy in (2, 14, 26):
        box(tc, 1, sy, 31, sy + 3, 1, 'steel', base=4)
    for (x, w, sy, h, m) in ((4, 5, 13, 8, 'bio'), (10, 4, 13, 6, 'bio'), (16, 6, 13, 9, 'glass'), (24, 4, 13, 5, 'bio'),
                             (4, 6, 25, 7, 'glass'), (12, 5, 25, 9, 'bio'), (19, 8, 25, 6, 'paint')):
        for y in range(sy - h, sy):
            for xx in range(x, x + w):
                k = 4 if xx == x else (2 if xx == x + w - 1 else 3)
                if y == sy - h: k = 5
                tc.px(xx, y, m, k)
        if m in ('bio', 'glass'): tc.hline(x, x + w, sy - h - 1, 'steel', 4); tc.px(x + 1, sy - h + 2, m, 6)
    return tc.fin(.6, shadow=(16, 31, 14, 2, 60))


def lab_bench(seed=0):
    """실험대 3x2(48x32): 흰 판 윗면(연구소 판)의 강철 실험대 — 플라스크·초록 시험관 꽂이·원심 분리기(둥근 뚜껑)·작은 현미경꼴 기구,
    앞면 서랍 줄. 2줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    box(tc, 0, 12, 48, 32, 7, 'lab', base=4, seed=seed)
    panels(tc, 1, 20, 47, 31, 'steel', 3, 15, 11, face='front', seed=seed + 1, vary=0, rivets=False)
    for x in (8, 23, 38): tc.hline(x - 2, x + 3, 25, 'steel', 6)
    # 원심 분리기
    cyl(tc, 9, 9, 6, 2.4, 5, 'lab', seed=seed); tc.ell(9, 9, 3, 1.2, 'steel', 3); lamp(tc, 8, 14, 'cyan')
    # 시험관 꽂이
    box(tc, 18, 8, 30, 15, 2, 'steel', base=3)
    for i, x in enumerate(range(19, 30, 2)):
        for y in range(3, 9): tc.px(x, y, 'bio' if i % 3 else 'glass', 4 if y > 4 else 6)
    # 플라스크
    for y in range(4, 15):
        w = 1 if y < 8 else min(4, (y - 7))
        for x in range(36 - w, 37 + w): tc.px(x, y, 'glass' if y < 10 else 'bio', 4 if x < 36 else 2)
    tc.px(35, 11, 'bio', 6)
    # 기구
    for y in range(3, 14): tc.px(43, y, 'steel', 4); tc.px(44, y, 'steel', 2)
    box(tc, 40, 2, 47, 6, 2, 'steel', base=4); box(tc, 39, 12, 47, 15, 1, 'steel', base=3)
    return tc.fin(.6, shadow=(24, 31, 23, 2, 60))


def cold_cabinet(seed=0):
    """냉장 보관함 2x3(32x48): 키 큰 흰 판 함(문 둘·손잡이), 서리 낀 창 너머 흐린 병, 위 냉각 팬 창살과 청록 표시등. 아랫줄 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 1, 2, 31, 47, 4, 'lab', base=4, seed=seed)
    tc.vline(16, 7, 46, 'lab', 2)
    for x0 in (4, 19):
        for y in range(12, 28):
            for x in range(x0, x0 + 9):
                k = 4 if (x + y) % 3 else 5
                if y > 20 and (x - x0) in (2, 3, 6): k = 3
                tc.px(x, y, 'glass', k)
        tc.hline(x0, x0 + 9, 12, 'lab', 6)
        tc.vline(x0 + (8 if x0 == 4 else 0), 30, 38, 'steel', 6)
    for y in range(8, 11, 1):
        tc.hline(5, 27, y, 'steel', 2 if y % 2 else 4)
    lamp(tc, 25, 42, 'cyan'); lamp(tc, 5, 42, 'cyan')
    return tc.fin(.6, shadow=(16, 47, 14, 2, 65))


def analysis_machine(seed=0):
    """분석 기계 3x3(48x48): 연구소 흰 판 몸체(외장판 줄눈), 가운데 둥근 유리 창 속 초록 빛 시료 받침, 위 큰 화면(막대 무늬)과
    양옆 냉각 관, 앞 조작 단추 줄, 아래 경고 띠 받침. 아래 2줄 막힘."""
    W, H = 48, 48; tc = TC(W, H, seed)
    box(tc, 2, 40, 46, 48, 2, 'steel', base=2, seed=seed)
    hazard(tc, 3, 44, 45, 47, seed=seed)
    box(tc, 4, 4, 44, 42, 5, 'lab', base=4, seed=seed + 1)
    panels(tc, 5, 9, 43, 41, 'lab', 4, 19, 16, stagger=True, face='front', seed=seed + 2, vary=0, rivets=True)
    box(tc, 9, 10, 39, 20, 1, 'steel', base=2)
    screen(tc, 10, 11, 38, 19, 'scr', on=True, seed=seed + 3, bars=True)
    tc.ell(24, 30, 8, 6.5, 'steel', lambda x, y: 5 if (x < 24 and y < 30) else 3)
    tc.ell(24, 30, 6.5, 5, 'glass', 2)
    tc.ell(24, 32, 4, 2, 'bio', lambda x, y: 6 if x < 24 else 4)
    tc.px(21, 27, 'glass', 6); tc.px(22, 26, 'glass', 6)
    button_row(tc, 9, 38, 10, seed)
    for px_ in (6, 42): pipe_v(tc, px_, 0, 14, 4, 'brass', flange=False)
    return tc.fin(.6)


def server_rack(seed=0):
    """서버 선반 2x3(32x48): 검은 강철 장(외장판·리벳) 안 가로 칸 일곱마다 작은 표시등 줄(청록·호박·붉은 — 칸마다 다른 수),
    통풍 창살, 위로 올라간 전선 다발. 아랫줄 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for i in range(4): tc.vline(8 + i * 5, 0, 4, 'cable', 2)
    box(tc, 1, 3, 31, 47, 3, 'steel', base=2, seed=seed)
    for r in range(7):
        y = 8 + r * 5
        tc.hline(3, 29, y, 'steel', 3); tc.hline(3, 29, y + 3, 'steel', 1)
        for x in range(4, 28, 2): tc.px(x, y + 1, 'cable', 2 if x % 4 else 3)
        n = 1 + int(_hash(r, 0, seed + 4) * 4)
        for j in range(n):
            col = ['cyan', 'cyan', 'amber', 'redl'][int(_hash(r, j, seed + 5) * 4)]
            lamp(tc, 18 + j * 3, y + 2, col, on=_hash(r, j, seed + 6) < .8)
    return tc.fin(.6, shadow=(16, 47, 14, 2, 65))


# ================================================================== 앵커 ④ 제어반
def control_wall(seed=0):
    """제어반 벽 4x3(64x48, 벽 앞면 장식 · 앞면 3줄): 볼트 박은 강철 큰 판에 위 화면 셋(막대·파형·꺼짐), 가운데 압력계 둘과
    단추 줄·레버 넷, 표시등 띠, 아래 열린 점검 문 속 전선 다발이 바닥 쪽 전선관으로. 글자 없음."""
    W, H = 64, 48; tc = TC(W, H, seed)
    box(tc, 1, 1, 63, 47, 2, 'steel', base=3, seed=seed)
    panels(tc, 2, 3, 62, 46, 'steel', 3, 30, 22, face='front', seed=seed + 1, vary=0, rivets=True)
    for i, (x0, on, bars) in enumerate(((5, True, True), (25, True, False), (45, False, True))):
        box(tc, x0 - 1, 4, x0 + 16, 17, 1, 'steel', base=1)
        screen(tc, x0, 5, x0 + 15, 16, 'scr', on=on, seed=seed + i, bars=bars)
    gauge(tc, 10, 23, 3.4, seed); gauge(tc, 19, 23, 3.4, seed + 3)
    button_row(tc, 27, 21, 7, seed, step=3); button_row(tc, 27, 25, 7, seed + 9, step=3)
    for i, x in enumerate((50, 54, 58)): lever(tc, x, 27, up=(i != 1))
    for x in range(5, 60, 4): lamp(tc, x, 30, ['cyan', 'amber', 'cyan', 'redl'][(x // 4) % 4], on=_hash(x, 0, seed) < .75)
    for y in range(33, 46):                                                         # 점검 문(열림) 속 전선
        for x in range(6, 30): tc.px(x, y, 'dark', 1)
    for i in range(6):
        x0 = 8 + i * 3.6
        for y in range(33, 46):
            tc.px(x0 + math.sin(y / 3 + i) * 1.2, y, 'cable', 3 if i % 2 else 4)
            tc.px(x0 + 1 + math.sin(y / 3 + i) * 1.2, y, ['redl', 'amber', 'cable', 'cyan', 'cable', 'redl'][i], 2)
    tc.hline(6, 30, 33, 'steel', 5)
    box(tc, 34, 34, 60, 45, 1, 'steel', base=3)
    for x in range(36, 59, 3): tc.vline(x, 36, 44, 'steel', 1)
    return tc.fin(.6)


def monitor_bank(seed=0):
    """감시 화면 묶음 2x2(32x32, 벽 앞면 장식): 강철 틀에 매단 작은 화면 넷(셋 켜짐·하나 꺼짐, 글자 없음)과 아래 늘어진 전선."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for i, (x0, y0) in enumerate(((2, 2), (17, 2), (2, 15), (17, 15))):
        box(tc, x0, y0, x0 + 13, y0 + 12, 1, 'steel', base=2)
        screen(tc, x0 + 1, y0 + 2, x0 + 12, y0 + 11, 'scr', on=(i != 2), seed=seed + i, bars=(i % 2 == 0))
    tc.hline(0, 32, 1, 'steel', 4)
    cable(tc, 8, 27, 24, 27, sag=4)
    return tc.fin(.6)


def console_desk(seed=0):
    """조작 책상 3x2(48x32): 비스듬한 조작판 윗면(화면 둘·단추 줄·레버), 강철 앞면(판 줄눈·통풍구), 아래 발 막이 경고 띠. 아랫줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    box(tc, 1, 6, 47, 31, 11, 'steel', base=3, seed=seed)
    box(tc, 2, 7, 22, 15, 1, 'steel', base=1); screen(tc, 3, 8, 21, 14, 'scr', True, seed, True)
    box(tc, 26, 7, 46, 15, 1, 'steel', base=1); screen(tc, 27, 8, 45, 14, 'cyan', True, seed + 1, False)
    button_row(tc, 4, 15, 6, seed); button_row(tc, 28, 15, 5, seed + 4)
    lever(tc, 44, 16, up=True)
    panels(tc, 2, 18, 46, 30, 'steel', 3, 22, 12, face='front', seed=seed + 2, vary=0)
    for y in range(21, 27, 2): tc.hline(30, 43, y, 'steel', 1)
    hazard(tc, 2, 28, 46, 30, seed=seed)
    return tc.fin(.6, shadow=(24, 31, 23, 2, 60))


def operator_chair(seed=0):
    """조작자 의자 1x1(16x16): 등받이(북)가 있는 검은 쿠션 바퀴 의자, 강철 기둥과 다섯 발. 막힘."""
    tc = TC(16, 16, seed)
    box(tc, 3, 1, 13, 7, 1, 'cable', base=3)
    box(tc, 2, 6, 14, 10, 2, 'cable', base=3)
    tc.vline(8, 10, 13, 'steel', 4)
    for x in (3, 8, 13): tc.px(x, 14, 'steel', 3); tc.px(x, 15, 'cable', 1)
    tc.hline(3, 14, 13, 'steel', 3)
    return tc.fin(.6)
