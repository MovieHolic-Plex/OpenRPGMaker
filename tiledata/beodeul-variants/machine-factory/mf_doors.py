# 앵커 ⑤ 지하 연구소 입구 — 승강기(닫힘·열림)·방폭 철문(열린 문틀·잠긴 문)·경보등(켜짐/꺼짐) + 철 계단(내림·오름·벽 계단 입구).
# fr_mat 톤 캔버스 + 기계 재질 규약. 표시는 갈매기 화살·세모 무늬만(글자·숫자 없음). 3/4 시점, 빛 왼쪽 위.
import math
from mf_kit import *
from mf_kit import _hash
from fr_mech import gauge


def _chevron(tc, cx, cy, up=True, col='amber', k=5):
    for i in range(3):
        y = cy + (i if up else -i)
        tc.px(cx - i, y, col, k); tc.px(cx + i, y, col, k)


def _frame(tc, W, H, inner, seed):
    """승강기·철문 바깥 틀: 강철 두꺼운 테(위·왼쪽 빛), 양 기둥에 경고 띠."""
    x0, y0, x1, y1 = inner
    box(tc, 0, 0, W, H, 2, 'steel', base=3, seed=seed)
    panels(tc, 1, 3, W - 1, H, 'steel', 3, 16, 16, face='front', seed=seed + 1, vary=0, rivets=True)
    hazard(tc, x0 - 4, y0 + 2, x0 - 1, y1, seed=seed + 2)
    hazard(tc, x1 + 1, y0 + 2, x1 + 4, y1, seed=seed + 3)


def elevator_closed(seed=0):
    """승강기 문(닫힘) 3x3(48x48, 벽 앞면 장식 · 앞면 3줄): 경고 띠 두른 두꺼운 강철 틀, 가운데 이음이 있는 미닫이 두 짝(세로 홈·
    작은 창), 위 위·아래 갈매기 화살 표시등(위 켜짐), 오른쪽 기둥에 호출 단추 판. 바로 아래 바닥 칸이 승강기 이동 칸."""
    W, H = 48, 48; tc = TC(W, H, seed)
    _frame(tc, W, H, (11, 10, 37, 48), seed)
    box(tc, 15, 1, 33, 9, 1, 'steel', base=1)
    _chevron(tc, 20, 3, True, 'amber', 6); _chevron(tc, 28, 7, False, 'amber', 2)
    for y in range(10, 48):                                                          # 문 두 짝
        for x in range(11, 37):
            lx = x - 11; side = 0 if x < 24 else 1
            k = 4 if lx in (0, 1) else (2 if x in (35, 36) else 3)
            if x in (23, 24): k = 1 if x == 23 else 5
            if (x - 11) % 13 in (4, 9) and 14 < y < 44: k -= 1                       # 세로 홈
            tc.px(x, y, 'steel', clampk(k))
    for x0 in (14, 27):                                                              # 작은 창
        for y in range(15, 22):
            for x in range(x0, x0 + 6): tc.px(x, y, 'glass', 2 if y > 17 else 3)
        tc.px(x0, 15, 'glass', 6)
    box(tc, 40, 22, 46, 33, 1, 'steel', base=2)                                      # 호출 단추
    lamp(tc, 42, 25, 'amber'); lamp(tc, 42, 29, 'steel', on=False)
    rustify(tc, 0, 0, W, H, amount=.18, seed=seed + 4)
    return tc.fin(.6)


def elevator_open(seed=0):
    """승강기 문(열림) 3x3(48x48, 벽 앞면 장식): 같은 틀, 문짝이 양쪽 기둥 속으로 밀려 끝만 보이고 안에 불 켜진 승강기 칸 —
    흰 판 뒷벽·손잡이 봉·천장 등·철판 바닥 두 줄. 아래 표시등 켜짐. 바로 아래 바닥 칸이 승강기 이동 칸."""
    W, H = 48, 48; tc = TC(W, H, seed)
    _frame(tc, W, H, (11, 10, 37, 48), seed)
    box(tc, 15, 1, 33, 9, 1, 'steel', base=1)
    _chevron(tc, 20, 3, True, 'amber', 2); _chevron(tc, 28, 7, False, 'cyan', 6)
    for y in range(10, 48):
        for x in range(11, 37):
            if x in (11, 12, 35, 36): tc.px(x, y, 'steel', 4 if x < 20 else 2); continue   # 문짝 끝
            ly = y - 10
            if ly < 3: k = 6 if ly == 1 else 5; tc.px(x, y, 'lab', k); continue         # 천장 등
            if y >= 41:                                                                  # 칸 바닥
                k = 3 if (x + y) % 4 else 4
                if y == 41: k = 5
                tc.px(x, y, 'steel', k); continue
            row = (ly - 3) // 14; lx = (x - 13) % 11
            k = 5 if lx else 4
            if (ly - 3) % 14 == 13: k = 3
            if x > 31: k -= 1
            tc.px(x, y, 'lab', k)
    tc.hline(14, 34, 30, 'steel', 6); tc.hline(14, 34, 31, 'steel', 3)                  # 손잡이 봉
    box(tc, 40, 22, 46, 33, 1, 'steel', base=2)
    lamp(tc, 42, 25, 'steel', on=False); lamp(tc, 42, 29, 'cyan')
    return tc.fin(.6)


def blast_gate(seed=0):
    """방폭 철문 문틀(열림) 4x4(64x64, 위층): 벽을 뚫은 2칸 폭 통로 위에 서는 문틀 — 양옆 두꺼운 콘크리트·강철 기둥(경고 띠 사선),
    위로 끌어올린 두꺼운 철문 판(아랫변 경고 띠·톱니 맞물림)과 들보, 들보 가운데 붉은 경보등, 통로 바닥에 문 홈 두 줄.
    가운데 아래 두 줄 2칸 = 지나가는 통로(걷기), 통로 위 두 줄 = 걷기 + 가림. 양옆 기둥 칸은 벽(막힘)."""
    W, H = 64, 64; tc = TC(W, H, seed)
    for (x0, x1) in ((0, 16), (48, 64)):                                             # 기둥
        box(tc, x0, 0, x1, 64, 4, 'conc', base=3, seed=seed + x0)
        panels(tc, x0 + 1, 5, x1 - 1, 63, 'steel', 3, 14, 16, face='front', seed=seed + x0, vary=0, rivets=True)
        hazard(tc, x0 + (11 if x0 == 0 else 1), 8, x0 + (15 if x0 == 0 else 5), 63, seed=seed + x0 + 1)
    box(tc, 14, 0, 50, 10, 4, 'steel', base=3, seed=seed + 3)                        # 들보
    for y in range(10, 30):                                                          # 올린 문 판
        for x in range(16, 48):
            k = 3 if (y - 10) % 8 else 4
            if x < 18: k += 1
            if x > 45: k -= 1
            tc.px(x, y, 'steel', clampk(k))
    for x in range(16, 48, 8):
        for y in range(12, 28, 8): bolt(tc, x + 3, y)
    hazard(tc, 16, 26, 48, 30, seed=seed + 4)
    for x in range(16, 48): tc.px(x, 30, 'steel', 1 if x % 3 else 2); tc.px(x, 31, 'dark', 1)
    tc.ell(32, 4, 3.4, 2.2, 'redl', lambda x, y: 6 if x < 32 and y < 4 else 4)       # 경보등
    for y in range(32, 64):                                                          # 바닥 문 홈
        for x in (17, 46): tc.px(x, y, 'steel', 1)
    tc.hline(16, 48, 62, 'steel', 2)
    rustify(tc, 0, 0, W, H, amount=.22, seed=seed + 5)
    return tc.fin(.6)


def steel_door(seed=0):
    """잠긴 방폭 철문 2x3(32x48, 벽 앞면 장식): 둥근 모 두꺼운 철문 판(리벳 테·가로 보강 띠), 가운데 붉은 바퀴 손잡이,
    경고 띠 틀, 위 꺼진 표시등. 열리지 않는 문(뒤에 방 없음) — 장식 또는 잠긴 문 이벤트."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 0, 2, 32, 48, 2, 'steel', base=2, seed=seed)
    hazard(tc, 1, 4, 4, 48, seed=seed); hazard(tc, 28, 4, 31, 48, seed=seed + 1)
    for y in range(7, 48):
        for x in range(5, 27):
            k = 3 if x < 24 else 2
            if x == 5 or y == 7: k = 5
            if (y - 7) % 13 in (0, 1) and y > 8: k = 4 if (y - 7) % 13 == 0 else 2
            tc.px(x, y, 'steel', k)
    for y in range(9, 47, 4): bolt(tc, 7, y); bolt(tc, 23, y)
    for a in range(0, 360, 12):
        r = math.radians(a); tc.px(16 + 6 * math.cos(r), 27 + 4.4 * math.sin(r), 'redl', 5 if a > 180 else 3)
    for a in (0, 60, 120):
        r = math.radians(a)
        for d in range(-5, 6): tc.px(16 + d * math.cos(r), 27 + d * .74 * math.sin(r), 'redl', 4)
    tc.ell(16, 27, 1.6, 1.4, 'steel', 6)
    lamp(tc, 15, 3, 'redl', on=False)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 2)
    return tc.fin(.6)


def alarm_light(on=True, seed=0):
    """경보등 1x1(16x16, 벽 앞면 장식): 벽 받침 위 붉은 돔(쇠 철망 씌움). on = 빛나는 돔 + 양옆 빛살, off = 어두운 붉은 유리."""
    tc = TC(16, 16, seed)
    box(tc, 3, 11, 13, 15, 1, 'steel', base=3)
    for y in range(3, 12):
        for x in range(3, 13):
            d = ((x + .5 - 8) / 5) ** 2 + ((y + .5 - 11) / 8) ** 2
            if d > 1: continue
            k = (6 if d < .3 else 5) if on else (3 if d < .3 else 2)
            if x < 7 and on: k = 6
            tc.px(x, y, 'redl', k)
    for x in (5, 8, 11): tc.vline(x, 4, 11, 'steel', 2)
    tc.hline(3, 13, 7, 'steel', 2)
    im = tc.fin(.6)
    if on:
        o = new(); o.alpha_composite(im); p = o.load()
        for (x, y) in ((1, 6), (0, 6), (14, 6), (15, 6), (1, 3), (14, 3), (2, 9), (13, 9)):
            p[x, y] = R('redl', 6) + (200,)
        return o
    return im

def alarm_on(): return alarm_light(True)
def alarm_off(): return alarm_light(False)


def stair_down(seed=0):
    """내림 철 계단 2x3(32x48, 걷기): 바닥에 뚫린 네모 구멍(강철 테·경고 띠 턱) 안 북쪽으로 어둠 속 아래층으로 내려가는 강철 디딤판
    일곱 단(미끄럼 홈·코 빛, 아래로 갈수록 어둡다), 양옆 노란 난간. 맨 윗줄 = 아래층 이동 칸."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            tc.px(x, y, 'dark', 1)
    steps = 7
    for i in range(steps):                                                           # 남쪽(가까움)이 밝고 북쪽(깊음)이 어둡다
        y1 = 46 - i * 6; y0 = y1 - 5
        bright = 5 - i * .65
        for y in range(y0, y1):
            for x in range(5, 27):
                k = bright if y < y0 + 2 else bright - 1.5
                if y == y0: k = bright + 1
                if (x % 3 == 0) and y >= y0 + 2: k -= 1
                tc.px(x, y, 'steel', clampk(round(k), 1, 6))
    for x in range(W):                                                               # 남쪽 턱
        tc.px(x, 47, 'steel', 2)
    for xs in ((0, 5), (27, 32)):                                                     # 양옆 테
        for y in range(H):
            for x in range(*xs):
                k = 4 if x == xs[0] else 3
                if x == xs[1] - 1: k = 2
                tc.px(x, y, 'steel', k)
    hazard(tc, 0, 0, 32, 3, seed=seed)
    for (rx) in (2, 29):                                                             # 난간
        tc.vline(rx, 2, 47, 'warn', 5); tc.vline(rx + 1, 2, 47, 'warn', 3)
        for y in (8, 24, 40): tc.px(rx, y, 'steel', 6)
    return tc.fin(.6)


def stair_up(seed=0):
    """오름 철 계단 2x3(32x48, 걷기): 북쪽 벽 앞면 바로 아래 바닥 위에서 위로 오르는 강철 디딤판 여섯 단(위로 갈수록 밝고 작아진다),
    양옆 노란 손잡이 관과 기둥. 맨 윗줄 = 위층 이동 칸. 바로 위 벽 앞면에 stair_well."""
    W, H = 32, 48; tc = TC(W, H, seed)
    for i in range(6):
        y0 = 40 - i * 8; y1 = y0 + 8
        for y in range(max(0, y0), y1):
            for x in range(4, 28):
                ly = y - y0
                k = 5 if ly < 3 else 3                                                 # 디딤판 윗면 + 챌판
                if ly == 0: k = 6
                if ly >= 6: k = 2
                if ly < 3 and x % 3 == 0: k -= 1
                k += (i // 3)
                tc.px(x, y, 'steel', clampk(k))
    for rx in (2, 28):
        for y in range(0, 48):
            tc.px(rx, y, 'warn', 5 if rx == 2 else 4); tc.px(rx + 1, y, 'warn', 3)
        for y in range(4, 48, 12):
            tc.px(rx, y, 'steel', 6); tc.px(rx + 1, y, 'steel', 2)
    return tc.fin(.6)


def stair_well(seed=0):
    """벽 계단 입구 2x3(32x48, 벽 앞면 장식): 콘크리트 벽을 뚫은 네모 문틀(강철 테·경고 띠 상인방) 안으로 계단이 위층으로 이어지고
    꼭대기에 흰 빛. stair_up 바로 위 같은 열에만."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 0, 0, 32, 48, 2, 'steel', base=3, seed=seed)
    hazard(tc, 2, 3, 30, 6, seed=seed)
    for y in range(7, 48):
        for x in range(4, 28):
            ly = y - 7
            t = ly / 40.0
            step = (47 - y) // 6
            k = 1 + (6 - step) * .0
            if ly < 4: tc.px(x, y, 'lab', 6 - ly); continue                              # 꼭대기 빛
            sy = (y - 11) % 6
            k = (4 if sy < 2 else 2) - (1 if t < .4 else 0)
            tc.px(x, y, 'steel', clampk(k))
    for rx in (4, 26):
        tc.vline(rx, 10, 48, 'warn', 4); tc.vline(rx + 1, 10, 48, 'warn', 2)
    return tc.fin(.6)
