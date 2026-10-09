# 미래 폐허 앵커 ③④ + 배경 구조물 — 끊긴 고가 도로(교각·상판 단면·늘어진 철근·매달린 상판 조각), 떨어진 상판,
# 지하 공장 입구(콘크리트 벙커 + 반쯤 올린 셔터 + 안으로 내려가는 경사로), 무너진 고층 건물 그루터기 둘, 돔 잔해 더미.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위. 벽은 반드시 땅에 닿거나 잔해 더미로 끝난다.
import math
import numpy as np
from fr_mat import *
from fr_base import _hash
from fr_props import cyl, steam_puff, conc_chunk, rebar, vent_fan
from fr_ground import asphalt_px, concrete_px, vn_arr


def jag(y, seed, base, amp=4.0, sc=5.0):
    return base + (vnoise(0, y, sc, seed) - .5) * 2 * amp + (_hash(0, y, seed + 1) - .5) * 1.5


def deck(tc, x0, x1, y0, seed=0, ljag=True, rjag=True, lseed=1, rseed=2):
    """고가 상판(앞에서 본 단면): 먼 난간(윗면 3 + 앞면 4) + 도로(16, 아스팔트·차선) + 가까운 난간(윗면 3 + 앞면 4) +
    거더 앞면(14). 끝은 들쭉날쭉 부서졌다(ljag/rjag). 반환: 각 줄의 (왼 끝, 오른 끝) 표."""
    rows = {}
    for y in range(y0, y0 + 44):
        xl = int(jag(y, seed + lseed, x0, 3.5)) if ljag else x0
        xr = int(jag(y, seed + rseed, x1, 4.5)) if rjag else x1
        if rjag and y > y0 + 30: xr -= int((y - y0 - 30) * 0.7)          # 거더 아래가 더 깨져 들어갔다
        if ljag and y > y0 + 32: xl += int((y - y0 - 32) * 0.5)
        rows[y] = (xl, xr)
        for x in range(xl, xr):
            r = y - y0
            if r < 3: mat, k = 'conc', 6 if r == 0 else 5                     # 먼 난간 윗면
            elif r < 7: mat, k = 'conc', 4 if r < 5 else 3                     # 먼 난간 앞면
            elif r < 23:                                                       # 도로
                mat = 'asph'; k = int(asphalt_px(np.array([x]), np.array([y]), seed + 3)[0])
                if r == 7: k = 1
                if r in (8, 21) and (x // 2) % 5 != 0: mat, k = 'conc', 4      # 가장자리 흰 선(바램)
                if r in (14, 15) and (x // 6) % 2 == 0 and _hash(x, y, seed + 4) > .3: mat, k = 'warn', 4
            elif r < 26: mat, k = 'conc', 6 if r == 23 else 5                   # 가까운 난간 윗면
            elif r < 30: mat, k = 'conc', 4 if r < 28 else 3                    # 가까운 난간 앞면
            else:                                                              # 거더 앞면
                mat = 'conc'; k = 4 if r < 33 else 3
                if r == 30: k = 2
                if r >= 42: k = 2
                if r == 43: k = 1
                if (x - x0) % 40 == 39: k = 2
                if (x - x0) % 40 == 0: k = 5
            if mat == 'conc' and x - xl < 2: k += 1
            if mat == 'conc' and xr - x <= 2: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))
        # 깨진 단면(끝 2~3px 거친 면)
        if rjag:
            for i in range(3): tc.px(xr - 1 - i, y, 'conc', 2 + (1 if _hash(xr - i, y, seed) > .6 else 0))
        if ljag:
            for i in range(2): tc.px(xl + i, y, 'conc', 3 + (1 if _hash(xl + i, y, seed) > .6 else 0))
    # 난간 줄눈(16px)
    for y in (y0 + 3, y0 + 4, y0 + 5, y0 + 6, y0 + 26, y0 + 27, y0 + 28, y0 + 29):
        xl, xr = rows[y]
        for x in range(xl + 2, xr - 2):
            if (x - x0) % 16 == 15: tc.px(x, y, 'conc', 2)
    # 거더 아래 녹물 자국(받침 자리)
    return rows


def pier(tc, cx, ytop, ybot, seed=0, w=20):
    """교각: 망치머리 받침(앞면, 폭 w+16) + 원기둥꼴 몸통(cyl 음영) + 기초 판."""
    x0 = int(cx - w / 2)
    for y in range(ytop, ytop + 9):                                   # 망치머리
        for x in range(x0 - 8, x0 + w + 8):
            k = 4 if y < ytop + 3 else 3
            if x < x0 - 6: k += 1
            if x >= x0 + w + 6: k -= 1
            if y == ytop + 8: k = 2
            tc.px(x, y, 'conc', k)
    for y in range(ytop + 9, ybot - 4):                              # 몸통
        for x in range(x0, x0 + w):
            k = cyl_k((x - x0 + .5) / w)
            if y < ytop + 12: k -= 1
            tc.px(x, y, 'conc', k)
    for y in range(ybot - 5, ybot):                                  # 기초
        for x in range(x0 - 3, x0 + w + 3):
            tc.px(x, y, 'conc', 5 if y == ybot - 5 else (4 if x < x0 + w else 3))
    tc.hline(x0 - 3, x0 + w + 3, ybot - 1, 'conc', 1)
    for i in range(4):                                               # 세로 빗물 얼룩·이끼
        xx = x0 + 3 + int(_hash(i, cx, seed) * (w - 6)); l = 8 + int(_hash(i, 3, seed) * 20)
        for y in range(ytop + 10, ytop + 10 + l): tc.shift(xx, y, -1)
    for y in range(ybot - 16, ybot - 4):
        for x in range(x0, x0 + w):
            if vnoise(x, y, 2.5, seed + 9) > .58 - (y - ybot + 16) * .02: tc.px(x, y, 'sick', 2 + int(_hash(x, y, 3) * 2))


def overpass_span(seed=0):
    """끊긴 고가 도로 10x6(160x96): 교각 둘 위의 상판 단면 — 먼 난간·차선 바랜 도로·가까운 난간·거더. 양 끝은 부서졌고
    오른쪽 끝에는 녹슨 철근에 매달린 상판 조각이 처졌으며 그 밑에 떨어진 잔해가 쌓였다. 교각 밑동(아랫줄)과 잔해만 막힘,
    상판 아래는 지나갈 수 있다(상판 칸은 걷기 + 가림)."""
    W, H = 160, 96; tc = TC(W, H, seed)
    pier(tc, 36, 50, 96, seed + 1)
    pier(tc, 112, 50, 96, seed + 2)
    rows = deck(tc, 3, 150, 6, seed)
    # 오른쪽 끝: 철근이 삐죽 + 매달린 상판 조각
    for i, y in enumerate((9, 14, 19, 25, 31, 37, 41)):
        xr = rows[y][1]; L = 5 + int(_hash(i, 1, seed) * 7)
        rebar(tc, xr, y, xr + L, y + 2 + i % 3)
    hx0, hy0 = rows[30][1] - 6, 30
    slab = [(hx0, hy0), (hx0 + 12, hy0 + 2), (hx0 + 15, hy0 + 30), (hx0 + 3, hy0 + 27)]
    tc.poly(slab, 'asph', 3)
    for y in range(hy0, hy0 + 31):                                   # 조각 앞 두께(왼쪽 아래 모서리)
        for x in range(hx0 - 1, hx0 + 16):
            g = tc.get(x, y)
            if g and g[0] == 'asph' and not (tc.get(x - 1, y) or ('', 0))[0] == 'asph': tc.px(x - 1, y, 'conc', 4); tc.px(x - 2, y, 'conc', 2)
    tc.line(hx0 + 4, hy0 + 6, hx0 + 8, hy0 + 22, 'warn', 4)
    rebar(tc, hx0 + 2, hy0 - 2, hx0 + 4, hy0 + 4); rebar(tc, hx0 + 9, hy0, hx0 + 10, hy0 + 5)
    for (x, y, w, h, t) in ((128, 82, 13, 11, 4), (141, 86, 12, 9, 3), (120, 88, 9, 7, 3), (150, 89, 9, 6, 2)):
        conc_chunk(tc, x, y, w, h, t, seed + x)
    rebar(tc, 133, 78, 137, 86); rebar(tc, 146, 80, 143, 88)
    # 왼쪽 끝: 짧은 철근
    for i, y in enumerate((10, 22, 34)):
        xl = rows[y][0]; rebar(tc, xl - 5, y + 1, xl, y)
    # 난간 앞면에서 늘어진 오염 넝쿨
    for i in range(7):
        x = 10 + int(_hash(i, 5, seed) * 130); L = 4 + int(_hash(i, 6, seed) * 9)
        if rows[33][0] < x < rows[33][1] - 4:
            for j in range(L): tc.px(x + (j // 4) % 2, 32 + j, 'sick', 3 + (j % 2))
    rustify(tc, 0, 0, W, H, amount=.2, seed=seed + 5, mats=('conc',))
    tc.grain(.05, mats=('conc',))
    im = tc.fin(.6)
    return shadow_under(im, 36, 94, 16, 2.5, 70)


def overpass_pier(seed=0):
    """홀로 남은 교각 3x6(48x96): 망치머리 위에 짧게 남은 상판 토막(양 끝 부서짐, 철근 삐죽), 몸통에 빗물 얼룩·이끼.
    밑동만 막힘."""
    W, H = 48, 96; tc = TC(W, H, seed)
    pier(tc, 24, 50, 96, seed + 1)
    rows = deck(tc, 6, 42, 6, seed + 3)
    for i, y in enumerate((12, 27, 38)):
        rebar(tc, rows[y][1], y, rows[y][1] + 5, y + 2); rebar(tc, rows[y][0] - 4, y + 1, rows[y][0], y)
    tc.grain(.05, mats=('conc',))
    return shadow_under(tc.fin(.6), 24, 94, 13, 2.2, 70)


def deck_fallen(seed=0):
    """떨어진 상판 조각 4x2(64x32): 땅에 비스듬히 박힌 도로 상판(윗면 = 아스팔트·바랜 차선, 앞면 = 콘크리트 두께), 깨진 끝에 철근.
    칸 전체 막힘(높이 2)."""
    W, H = 64, 32; tc = TC(W, H, seed)
    top = [(4, 8), (54, 3), (60, 14), (8, 21)]
    tc.poly(top, 'asph', lambda x, y: int(asphalt_px(np.array([x]), np.array([y]), seed)[0]))
    for x in range(8, 58):                                           # 차선(비스듬히)
        y = 14 - (x - 8) * 0.19
        if (x // 5) % 2 == 0: tc.px(x, y, 'warn', 4)
    tc.line(4, 8, 54, 3, 'conc', 5); tc.line(4, 9, 54, 4, 'conc', 4)
    tc.poly([(8, 21), (60, 14), (60, 22), (9, 30)], 'conc', lambda x, y: 4 if x < 14 else (3 if x < 56 else 2))
    for x in range(9, 60): tc.px(x, 30 - (x - 9) * 0.16, 'conc', 1)
    for (x, y) in ((60, 14), (60, 18), (58, 21)): rebar(tc, x, y, x + 3, y + 3)
    conc_chunk(tc, 0, 22, 9, 9, 3, seed + 1)
    tc.grain(.05, mats=('conc',))
    return tc.fin(.6, shadow=(32, 28, 30, 3, 60))


def factory_gate(seed=0):
    """지하 공장 입구 8x6(128x96): 콘크리트 벙커 — 지붕(윗면: 판 줄눈·환풍 팬 둘·관·안테나), 앞면(엇갈린 콘크리트 판),
    가운데 큰 철문 구멍: 경고 띠 문틀 + 반쯤 올린 셔터 + 안쪽으로 내려가는 경사로(어둠 속 호박색 띠등). 문 위 경고 그림판
    (번개 세모, 글자 없음), 옆 표시등·통풍구·벽 관·김. 앞면 줄은 막힘(문 칸만 걷기), 지붕 줄은 걷기 + 가림."""
    W, H = 128, 96; tc = TC(W, H, seed)
    RT, FT = 6, 30                                                    # 지붕 윗면 시작, 앞면 시작
    # 지붕 윗면
    for y in range(RT, FT):
        for x in range(2, 126):
            Y = y - RT; X = x - 2
            k = 5
            if (X % 32 == 31) or (Y == 11): k = 3
            elif X % 32 == 0 or Y == 12: k = 6
            if y == RT: k = 6
            if y in (RT + 1, RT + 2) or x in (2, 3, 124, 125): k = 6 if (y == RT + 1 or x == 2) else 4      # 둘레 턱
            if y == RT + 3 and 4 <= x < 124: k = 3
            if _hash(x, y, seed) < .05: k -= 1
            tc.px(x, y, 'conc', k)
    # 지붕 위 물건: 환풍 팬 둘, 관 한 줄, 안테나
    for (vx, vy) in ((18, 15), (98, 14)):
        box(tc, vx - 9, vy - 6, vx + 9, vy + 6, 6, 'steel', base=3)
        for y in range(vy - 6, vy):
            for x in range(vx - 8, vx + 8):
                e = ((x + .5 - vx) / 7.5) ** 2 + ((y + .5 - (vy - 3)) / 2.8) ** 2
                if e <= 1: tc.px(x, y, 'steel', 4 if (y % 2 == 0) else 1)
    pipe_h(tc, 30, 88, 12, 6, 'steel', step=16)
    for y in range(0, 14): tc.px(112, y, 'steel', 5); tc.px(113, y, 'steel', 2)
    tc.px(112, 0, 'redl', 5); tc.hline(108, 117, 4, 'steel', 4)
    # 앞면(엇갈린 콘크리트 판 32x16)
    panels(tc, 2, FT, 126, 94, 'conc', 3, 32, 16, stagger=True, rivets=False, face='front', seed=seed + 1, vary=1, joint=2)
    for x in range(2, 126):                                            # 처마 띠
        tc.px(x, FT, 'conc', 6); tc.px(x, FT + 1, 'conc', 5); tc.px(x, FT + 2, 'conc', 2); tc.px(x, FT + 3, 'conc', 1)
    tc.hline(2, 126, 94, 'conc', 1); tc.hline(2, 126, 95, 'conc', 1)
    # 문
    dx0, dx1, dy0 = 38, 90, 46
    hazard(tc, dx0 - 5, dy0 - 5, dx1 + 5, dy0, seed + 2)
    hazard(tc, dx0 - 5, dy0, dx0, 95, seed + 3)
    hazard(tc, dx1, dy0, dx1 + 5, 95, seed + 4)
    tc.vline(dx0 - 6, dy0 - 5, 95, 'conc', 1); tc.vline(dx1 + 5, dy0 - 5, 95, 'conc', 2)
    for y in range(dy0, 96):                                           # 안쪽: 내려가는 경사로
        f = (y - dy0) / (96 - dy0)
        for x in range(dx0, dx1):
            u = (x - dx0 + .5) / (dx1 - dx0)
            wall = abs(u - .5) > .5 - (0.18 * (1 - f) + .02)
            if wall: k = 1 + (1 if u < .5 else 0)
            else:
                k = 1 + int(f * 2.2)
                if (y - dy0) % 6 == 0 and f > .35: k += 1               # 경사로 홈 줄
            tc.px(x, y, 'dark' if f < .5 or wall else 'steel', clamp(k, 1, 4))
    for x in range(dx0 + 14, dx1 - 14):                                # 안쪽 끝 호박색 띠등
        tc.px(x, dy0 + 17, 'amber', 5); tc.px(x, dy0 + 18, 'amber', 3)
    for y in range(dy0, dy0 + 16):                                     # 반쯤 올린 셔터
        for x in range(dx0, dx1):
            k = 4 if (y - dy0) % 3 == 0 else (3 if (y - dy0) % 3 == 1 else 2)
            if x < dx0 + 2: k += 1
            if x >= dx1 - 2: k -= 1
            tc.px(x, y, 'steel', clamp(k, 1, 6))
    tc.hline(dx0, dx1, dy0 + 16, 'steel', 1)
    for x in range(dx0 + 2, dx1 - 2, 9): tc.px(x, dy0 + 15, 'steel', 6)  # 셔터 아래 손잡이 점
    # 문 위 경고 그림판(번개 세모, 글자 없음)
    px0, py0 = 56, 33
    box(tc, px0, py0, px0 + 16, py0 + 9, 1, 'steel', base=3)
    for j in range(6):
        for x in range(px0 + 8 - j, px0 + 9 + j): tc.px(x, py0 + 2 + j, 'warn', 5 if j < 5 else 4)
    for (x, y) in ((px0 + 8, py0 + 3), (px0 + 7, py0 + 4), (px0 + 8, py0 + 5), (px0 + 9, py0 + 5), (px0 + 8, py0 + 6)): tc.px(x, y, 'dark', 1)
    # 표시등(왼 청록 켜짐, 오른 붉은 꺼짐)
    for (lx, col, on) in ((26, 'cyan', True), (98, 'redl', False)):
        box(tc, lx, 52, lx + 6, 60, 1, 'steel', base=2)
        for y in range(54, 59):
            for x in range(lx + 1, lx + 5): tc.px(x, y, col, (5 if y < 56 else 4) if on else 2)
        if on: tc.px(lx + 1, 54, col, 6)
    # 왼쪽 통풍구(갈빗살)
    box(tc, 8, 62, 26, 80, 1, 'steel', base=3)
    for y in range(64, 79, 2): tc.hline(10, 24, y, 'steel', 1); tc.hline(10, 24, y + 1, 'steel', 4)
    # 오른쪽 벽 관 둘(땅으로) + 왼쪽 가로 관(김 샘)
    pipe_v(tc, 108, FT + 4, 95, 6, 'steel', step=16)
    pipe_v(tc, 117, FT + 8, 95, 4, 'brass', flange=False)
    pipe_h(tc, 2, 34, 86, 6, 'steel', step=16)
    rustify(tc, 0, FT, W, H, amount=.25, seed=seed + 6, mats=('steel',))
    rustify(tc, 0, RT, W, FT + 4, amount=.15, seed=seed + 7, mats=('conc',))
    for y in range(FT + 4, FT + 26):                                   # 처마 밑 녹물 자국
        for x in range(4, 124):
            if _hash(x, 0, seed + 8) > .9 and y - FT - 4 < 6 + _hash(x, 1, seed) * 18 and tc.get(x, y) and tc.get(x, y)[0] == 'conc': tc.px(x, y, 'rust', 3)
    for y in range(82, 94):                                            # 밑동 이끼
        for x in range(2, 126):
            g = tc.get(x, y)
            if g and g[0] == 'conc' and vnoise(x, y, 3, seed + 9) > .62 - (y - 82) * .02: tc.px(x, y, 'sick', 2 + int(_hash(x, y, 4) * 3))
    tc.grain(.04, mats=('conc',))
    im = tc.fin(.6)
    o = new(W, H); o.alpha_composite(im)
    o.alpha_composite(steam_puff(16, 12, seed + 1, 130), (10, 0)); o.alpha_composite(steam_puff(16, 12, seed + 2, 120), (90, 0))
    o.alpha_composite(steam_puff(12, 10, seed + 3, 120), (28, 74))
    return o


def ruin_block(floors=4, cols=3, broken=.6, seed=0, tank=False, wall='conc'):
    """무너진 고층 건물 그루터기: 층마다 콘크리트 바닥 띠(위 모 빛) + 창 줄(어두운 구멍, 깨진 유리 조각, 강철 창틀),
    오른쪽 위가 계단꼴로 무너져 철근이 삐죽, 맨 위 남은 바닥 윗면이 보인다. 아래층은 셔터 내린 가게 앞. 밑동 이끼·잔해.
    floors 층, cols 창 열. 폭 = cols*20+12, 높이 = floors*24+28. 앞면(벽) 칸 전부 막힘, 맨 위 윗면 줄은 걷기 + 가림."""
    W = cols * 20 + 12; H = floors * 24 + 30
    W16 = (W + 15) // 16 * 16
    tc = TC(W16, H, seed)
    x0, x1 = 2, W - 2
    base_y = H - 1
    top_y = 8
    # 무너진 윤곽: 열마다 위 끝(오른쪽으로 갈수록 낮아진다, 계단꼴)
    def ytop(x):
        f = (x - x0) / (x1 - x0)
        drop = max(0, f - (1 - broken)) / max(.01, broken)
        return int(top_y + drop * 24 * max(1, floors - 2) * .8 + (vnoise(x, 0, 4, seed) - .5) * 5)
    for x in range(x0, x1):
        yt = ytop(x)
        for y in range(yt, base_y + 1):
            fy = (base_y - y)                                          # 땅에서 위로
            fl = fy // 24; ly = fy % 24
            # 맨 위 남은 바닥 윗면(6px)
            if y < yt + 6 and yt <= top_y + 2:
                tc.px(x, y, 'conc', 5 if y > yt else 6); continue
            if y < yt + 2:
                tc.px(x, y, 'conc', 2); continue                       # 깨진 위 끝(거친 단면)
            k = 4 if x < x0 + 2 else (2 if x >= x1 - 2 else 3)
            if ly in (22, 23): k = 5 if ly == 23 else 4                  # 바닥 띠 위 모
            elif ly in (19, 20, 21): k = 4 if x < x1 - 2 else 3
            elif ly == 18: k = 2
            band = ly >= 18
            if wall != 'conc' and not band: k = k + (1 if wall == 'paint' else 0)
            tc.px(x, y, 'conc' if band else wall, k)
    # 창
    for f in range(1, floors):
        wy1 = base_y - f * 24 - 5; wy0 = wy1 - 12
        for c in range(cols):
            wx0 = x0 + 6 + c * 20; wx1 = wx0 + 12
            if ytop(wx1) > wy0 - 2: continue
            h = _hash(f, c, seed + 3)
            for y in range(wy0, wy1):
                for x in range(wx0, wx1):
                    k = 1 if y > wy0 + 2 else 2
                    tc.px(x, y, 'dark', k)
            tc.hline(wx0 - 1, wx1 + 1, wy1, 'conc', 5)                  # 창턱
            tc.vline(wx0 - 1, wy0, wy1, 'steel', 4); tc.vline(wx1, wy0, wy1, 'steel', 2)
            tc.hline(wx0 - 1, wx1 + 1, wy0 - 1, 'steel', 3)
            if h < .55:                                                # 깨진 유리 조각(모서리에 남은 삼각)
                tc.poly([(wx0, wy0), (wx0 + 4 + int(h * 6), wy0), (wx0, wy0 + 5)], 'glass', 4)
                tc.px(wx0, wy0, 'glass', 6)
                tc.poly([(wx1, wy1), (wx1 - 3, wy1), (wx1, wy1 - 4)], 'glass', 3)
            elif h < .75:                                              # 반쯤 남은 유리(청록 반사)
                for y in range(wy0, wy0 + 6):
                    for x in range(wx0, wx1 - (y - wy0)): tc.px(x, y, 'glass', 3 if (x - wx0) + (y - wy0) != 4 else 5)
            elif h < .88:                                              # 내려앉은 블라인드
                for y in range(wy0, wy0 + 7, 2): tc.hline(wx0, wx1, y, 'plaster', 3)
    # 1층 가게 앞: 내린 셔터
    sy1 = base_y - 1; sy0 = base_y - 17
    for c in range(cols):
        if c == cols - 1 and cols > 2: continue
        sx0 = x0 + 4 + c * 20; sx1 = sx0 + 16
        for y in range(sy0, sy1):
            for x in range(sx0, sx1): tc.px(x, y, 'steel', 3 if (y - sy0) % 2 == 0 else 2)
        tc.hline(sx0, sx1, sy0 - 1, 'steel', 5)
        if _hash(c, 9, seed) < .5:                                     # 찢겨 말린 셔터 아래
            for x in range(sx0 + 3, sx1 - 2):
                for y in range(sy1 - 6, sy1): tc.px(x, y, 'dark', 1)
    if cols > 2:                                                       # 마지막 칸 = 무너진 입구 구멍
        ex0 = x0 + 4 + (cols - 1) * 20
        for y in range(sy0 - 2, sy1):
            for x in range(ex0, ex0 + 14): tc.px(x, y, 'dark', 1 if y > sy0 + 2 else 2)
    # 철근(무너진 위 끝)
    for i in range(6):
        x = x0 + 4 + int(_hash(i, 2, seed) * (x1 - x0 - 8)); y = ytop(x)
        if y > top_y + 4: rebar(tc, x, y, x + 1 + int(_hash(i, 4, seed) * 3), y - 4 - int(_hash(i, 5, seed) * 5))
    if tank and broken < .9:                                           # 지붕 물탱크(남은 쪽)
        cyl(tc, x0 + 10, 3, 6, 2.4, 8, 'steel', seed=seed)
        for x in (x0 + 6, x0 + 14): tc.vline(x, 12, 15, 'steel', 2)
    # 이끼·넝쿨(아래 왼쪽에서 타고 오른다)
    for x in range(x0, x1):
        hgt = int(18 + vnoise(x, 1, 6, seed + 7) * 34 * (1 - (x - x0) / (x1 - x0)) ** 1.2)
        for y in range(base_y - hgt, base_y + 1):
            g = tc.get(x, y)
            if g and g[0] in ('conc', 'steel', wall) and vnoise(x, y, 2.4, seed + 8) > .55: tc.px(x, y, 'sick', 2 + int(_hash(x, y, 5) * 3))
    rustify(tc, 0, 0, W16, H, amount=.25, seed=seed + 4, mats=('steel',))
    tc.grain(.05, mats=('conc',))
    im = tc.fin(.6)
    H16 = (H + 15) // 16 * 16
    o = new(W16, H16); o.alpha_composite(im, (0, H16 - H))
    return o


def dome_rubble(seed=0):
    """돔 잔해 더미 4x2(64x32): 무너진 돔에서 떨어진 휜 철골 둘(호), 큰 유리판 조각 셋(청록·빛 모서리), 콘크리트 덩이. 칸 전체 막힘."""
    W, H = 64, 32; tc = TC(W, H, seed)
    for (x0, x1, y0, sag) in ((4, 44, 20, -12), (20, 62, 26, -9)):
        n = (x1 - x0) * 2
        for i in range(n + 1):
            f = i / n; x = x0 + (x1 - x0) * f; y = y0 + sag * 4 * f * (1 - f)
            tc.px(x, y, 'steel', 5); tc.px(x, y + 1, 'steel', 3); tc.px(x, y + 2, 'steel', 1)
    for (pts, k) in (([(8, 22), (22, 14), (28, 26), (12, 30)], 3), ([(30, 18), (44, 12), (46, 24), (34, 28)], 4), ([(46, 22), (58, 20), (60, 30), (44, 30)], 3)):
        tc.poly(pts, 'glass', k)
        tc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 'glass', 6)
        tc.line(pts[2][0], pts[2][1], pts[3][0], pts[3][1], 'glass', 2)
    conc_chunk(tc, 0, 24, 10, 8, 3, seed + 1); conc_chunk(tc, 52, 25, 11, 7, 3, seed + 2)
    for i in range(10):
        x = int(_hash(i, 7, seed) * 62); y = 24 + int(_hash(i, 8, seed) * 7)
        tc.px(x, y, 'glass', 5); tc.px(x + 1, y, 'glass', 3)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 3)
    return tc.fin(.6, shadow=(32, 30, 30, 2.5, 60))


def ruin_wall(w=3, seed=0):
    """무너진 콘크리트 담 wx2(폭 w칸 x 32): 윗면(갓 4px) + 앞면(엇갈린 판·철근 구멍) — 왼쪽은 기둥 끝으로 맺고,
    오른쪽은 계단꼴로 무너져 잔해 덩이로 끝난다(떠 있는 벽 토막 아님). 앞면 줄(아래 1줄) 막힘, 윗줄은 걷기 + 가림."""
    W, H = w * 16, 32; tc = TC(W, H, seed)
    xe = W - 10
    def ytop(x):
        if x < 6: return 6
        f = max(0, (x - (xe - 18)) / 18.0)
        return int(10 + f * 14 + (vnoise(x, 0, 3, seed) - .5) * 3) if f > 0 else 10
    for x in range(1, xe):
        yt = ytop(x)
        for y in range(yt, 31):
            if y < yt + 4 and yt <= 10: k = 6 if y == yt else 5                     # 갓(윗면)
            elif y < yt + 2: k = 2                                                    # 깨진 단면
            else:
                k = 4 if x < 3 else (2 if x >= xe - 2 else 3)
                if (x + (8 if ((31 - y) // 8) % 2 else 0)) % 16 == 15: k = 2         # 판 줄눈
                if (31 - y) % 8 == 0: k = 2
                if y == 30: k = 1
            tc.px(x, y, 'conc', k)
    for y in range(4, 31):                                                            # 왼쪽 기둥 끝(조금 높다)
        for x in range(0, 6):
            k = 6 if y < 6 else (5 if y < 8 else (4 if x < 2 else 3))
            if y == 30: k = 1
            tc.px(x, y, 'conc', k)
    for i in range(3):                                                                 # 철근 구멍·삐죽 철근
        x = 12 + int(_hash(i, 1, seed) * (xe - 24)); y = 16 + int(_hash(i, 2, seed) * 8)
        tc.px(x, y, 'dark', 1); tc.px(x + 1, y, 'conc', 2)
    for i in range(3):
        x = xe - 16 + i * 5; rebar(tc, x, ytop(x), x + 1, ytop(x) - 5)
    conc_chunk(tc, xe - 6, 20, 9, 11, 3, seed + 1); conc_chunk(tc, xe + 1, 24, 8, 7, 3, seed + 2, base=2)
    for y in range(20, 31):
        for x in range(W):
            g = tc.get(x, y)
            if g and g[0] == 'conc' and vnoise(x, y, 2.5, seed + 4) > .72 - (y - 20) * .012: tc.px(x, y, 'sick', 2 + int(_hash(x, y, 2) * 3))
    tc.grain(.05, mats=('conc',))
    return tc.fin(.6, shadow=(W / 2, 30, W / 2 - 2, 2, 55))


def storage_tank(seed=0, h=50):
    """녹슨 저장 탱크 4x5(64x80): 세운 큰 강철 원통(가로 리벳 테 12px 마다, 녹물이 아래로 흘렀다) + 낮은 둥근 지붕(가운데 맨홀·난간),
    앞 왼쪽 사다리, 아래 오른쪽 관, 콘크리트 받침 고리. 아래 두 줄(몸통 밑동) 막힘, 위는 걷기 + 가림."""
    W, H = 64, 80; tc = TC(W, H, seed)
    cx, rx, ry = 32, 28, 10
    ytop = H - 8 - h - ry
    from fr_props import cyl as _cyl
    _cyl(tc, cx, H - 10, rx + 3, ry + 1.5, 6, 'conc', seed=seed)                     # 받침 고리
    _cyl(tc, cx, ytop, rx, ry, h, 'steel', seed=seed + 1)
    for by in range(int(ytop) + 12, int(ytop) + h, 12):                             # 리벳 테(가로, 몸통 곡면 따라 아래로 휜다)
        for x in range(cx - rx, cx + rx):
            u = (x + .5 - cx) / rx
            y = int(by + ry * math.sqrt(max(0, 1 - u * u)) * .9)
            g = tc.get(x, y)
            if g: tc.px(x, y, 'steel', g[1] + 1); tc.px(x, y + 1, 'steel', max(1, g[1] - 2))
            if (x - cx + rx) % 5 == 2 and g: tc.px(x, y, 'steel', 6)
    for y in range(int(ytop) - int(ry) + 1, int(ytop) + int(ry)):                   # 지붕: 가운데로 살짝 솟은 원뿔 음영
        for x in range(cx - rx, cx + rx):
            e = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - ytop) / ry) ** 2
            if e <= 1:
                k = 5 if (x < cx and y < ytop) else 4
                if e < .25: k += 1
                if .82 < e: k = 3 if y < ytop else 4
                tc.px(x, y, 'steel', k)
    tc.ell(cx + 2, ytop - 1, 5, 2, 'steel', 2); tc.ell(cx + 2, ytop - 1.5, 3.6, 1.3, 'steel', 5)   # 맨홀
    for a in range(200, 345, 9):                                                      # 지붕 난간(뒤쪽 반)
        r = math.radians(a); x = cx + (rx - 2) * math.cos(r); y = ytop + (ry - 1) * math.sin(r)
        tc.px(x, y - 3, 'steel', 5); tc.px(x, y - 2, 'steel', 3); tc.px(x, y - 1, 'steel', 2)
    lx = cx - 16                                                                      # 사다리
    for y in range(int(ytop) + 2, H - 10):
        tc.px(lx, y, 'steel', 5); tc.px(lx + 5, y, 'steel', 3)
        if (y - int(ytop)) % 4 == 0:
            for x in range(lx + 1, lx + 5): tc.px(x, y, 'steel', 4)
    pipe_h(tc, cx + 18, W, H - 18, 6, 'steel', step=16)
    rustify(tc, 0, 0, W, H, amount=.55, seed=seed + 2, mats=('steel',), streak=True)
    for y in range(H - 24, H - 8):
        for x in range(W):
            g = tc.get(x, y)
            if g and g[0] in ('steel', 'rust', 'conc') and vnoise(x, y, 2.5, seed + 4) > .72 - (y - H + 24) * .012: tc.px(x, y, 'sick', 2 + int(_hash(x, y, 3) * 3))
    tc.grain(.04)
    return tc.fin(.6, shadow=(cx, H - 4, rx + 2, 4, 70))


def billboard_frame(seed=0):
    """빈 광고판 틀 4x5(64x80): 격자 강철 다리 둘(지그재그 트러스) + 위 큰 판(반쯤 찢겨 뒤 골조가 보인다, 남은 판은 바랜 색 띠뿐 —
    글자·그림·상표 없음) + 판 아래 좁은 발판과 난간, 꼭대기 깨진 조명 셋. 다리 밑동만 막힘."""
    W, H = 64, 80; tc = TC(W, H, seed)
    for lx in (14, 46):                                                                # 트러스 다리
        for y in range(40, 79):
            tc.px(lx, y, 'steel', 5); tc.px(lx + 4, y, 'steel', 3)
            z = (y - 40) % 8
            tc.px(lx + (z if z < 4 else 8 - z), y, 'steel', 4)
        box(tc, lx - 2, 76, lx + 7, 80, 1, 'conc', base=3)
    box(tc, 2, 36, 62, 40, 1, 'steel', base=3)                                         # 발판
    for x in range(2, 62, 6): tc.vline(x, 31, 36, 'steel', 4)
    tc.hline(2, 62, 31, 'steel', 5)
    for y in range(6, 32):                                                            # 뒤 골조(판이 찢긴 곳에서 보인다)
        for x in range(4, 60):
            if (x - 4) % 14 in (0, 1) or (y - 6) % 9 == 0: tc.px(x, y, 'steel', 2)
    for y in range(6, 32):                                                            # 남은 판(왼쪽 위 → 오른쪽 아래로 찢겼다)
        for x in range(4, 60):
            torn = (x - 4) + (y - 6) * 1.1 > 34 + (vnoise(x, y, 3, seed) - .5) * 10
            if torn and not (x > 50 and y < 12): continue
            band = (y - 6) // 7
            mat, k = (('cyan', 3), ('paint', 5), ('plaster', 4), ('cyan', 2))[band % 4]
            if x < 6: k += 1
            if _hash(x // 3, y // 2, seed + 2) < .12: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    for x in range(3, 61): tc.px(x, 5, 'steel', 5); tc.px(x, 32, 'steel', 2)            # 판 틀
    tc.vline(3, 5, 33, 'steel', 5); tc.vline(60, 5, 33, 'steel', 2)
    for (x, br) in ((12, False), (32, True), (52, True)):                              # 조명
        tc.vline(x, 1, 5, 'steel', 4)
        box(tc, x - 3, 0, x + 3, 3, 1, 'steel', base=3)
        if not br: tc.px(x - 1, 2, 'amber', 5); tc.px(x, 2, 'amber', 4)
    rustify(tc, 0, 0, W, H, amount=.4, seed=seed + 3, mats=('steel',))
    return tc.fin(.6, shadow=(32, 78, 26, 2.5, 60))
