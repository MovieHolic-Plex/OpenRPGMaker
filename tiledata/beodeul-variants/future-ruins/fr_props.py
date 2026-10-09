# 미래 폐허 소품 — 거리·공장 잔해(전봇대·표지·경고등·드럼통·컨테이너·차 잔해·방호벽·가로등·관·환풍기·잔해·철골·전선 릴·철망).
# 모두 톤 캔버스(fr_mat.TC)에 기계 재질 규약대로 손 도트로 찍는다. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위.
import math
from fr_mat import *
from fr_base import _hash


def cyl(tc, cx, cy, rx, ry, h, mat, top=None, base=0, seed=0, topk=None):
    """세운 원통: 윗면 타원(톤 5~6, 테 한 단 어둡게) + 몸통(cyl_k 가로 음영) + 아래 호."""
    top = top or mat
    for y in range(int(cy - ry - 1), int(cy + h + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            u = (x + .5 - cx) / rx
            if abs(u) > 1: continue
            vt = (y + .5 - cy) / ry
            body_bot = cy + h + ry * math.sqrt(max(0, 1 - u * u))
            if u * u + vt * vt <= 1:
                k = (topk if topk is not None else (6 if (u < -.1 and vt < .3) else 5))
                if u * u + vt * vt > .62: k -= 1
                tc.px(x, y, top, clamp(k + base, 1, 6))
            elif cy <= y + .5 <= body_bot:
                k = cyl_k((u + 1) / 2) + base
                if y + .5 > body_bot - 1.2: k -= 1
                tc.px(x, y, mat, clamp(k, 1, 6))


# ================================================================ 전봇대·전선
def power_pole(seed=0, lean=0.0, broken=False):
    """전봇대 2x4(32x64): 콘크리트 기둥(원통 음영) + 꼭대기 강철 완목 + 사기 애자 셋 + 늘어진 전선 끝 둘 + 가운데 강철 함(호박색 등).
    lean = 기울기(px/px). 아랫줄(밑동)만 막힘."""
    W, H = 32, 64; tc = TC(W, H, seed)
    def X(y): return 15.5 + (63 - y) * lean
    for y in range(6, 62):                                        # 기둥
        cx = X(y)
        for x in range(int(cx - 4), int(cx + 4) + 1):
            u = (x + .5 - (cx - 3.5)) / 7.0
            if 0 <= u <= 1: tc.px(x, y, 'conc', cyl_k(u) - (1 if y > 56 else 0))
    for y in range(58, 63):                                       # 밑동 받침
        for x in range(int(X(y) - 4), int(X(y) + 5)):
            tc.px(x, y, 'conc', 4 if x < X(y) - 2 else (3 if x < X(y) + 3 else 2))
    tc.hline(int(X(62) - 4), int(X(62) + 5), 63, 'conc', 1)
    ay = 9                                                        # 완목
    ax = X(ay)
    for x in range(int(ax - 13), int(ax + 13)):
        tc.px(x, ay, 'steel', 6); tc.px(x, ay + 1, 'steel', 4); tc.px(x, ay + 2, 'steel', 3); tc.px(x, ay + 3, 'steel', 1)
    for i in range(6):                                            # 완목 버팀대
        tc.px(ax - 3 - i, ay + 4 + i, 'steel', 4); tc.px(ax + 3 + i, ay + 4 + i, 'steel', 2)
    for (dx, k) in ((-11, 0), (0, 0), (10, 0)):                   # 애자
        x0 = int(ax + dx)
        for i, t in enumerate((5, 6, 4, 5, 3)):
            tc.px(x0 + (i % 2), ay - 1 - i // 2, 'plaster', t)
        tc.px(x0, ay - 4, 'plaster', 6); tc.px(x0 + 1, ay - 4, 'plaster', 4)
    if broken:                                                    # 끊긴 전선 끝: 완목 양 끝에서 늘어진다
        cable(tc, ax - 11, ay - 3, ax - 14, ay + 26, sag=-3)
        cable(tc, ax + 10, ay - 3, ax + 14, ay + 20, sag=3)
    else:
        cable(tc, ax - 11, ay - 3, ax - 15, ay + 6, sag=1)
        cable(tc, ax + 10, ay - 3, ax + 15, ay + 7, sag=1)
    by = 30; bx = int(X(by))                                      # 강철 함 + 호박색 등
    box(tc, bx - 4, by, bx + 5, by + 11, 2, 'steel', base=3, seed=seed)
    tc.px(bx - 1, by + 4, 'amber', 6); tc.px(bx, by + 4, 'amber', 5); tc.px(bx - 1, by + 5, 'amber', 4); tc.px(bx, by + 5, 'amber', 3)
    cable(tc, bx + 4, by + 9, bx + 9, 60, sag=2)                  # 함에서 땅으로 내려가는 선
    for y in range(40, 50):                                       # 기둥에 붙은 오염 이끼
        for x in range(int(X(y) - 3), int(X(y) + 3)):
            if tc.get(x, y) and tc.get(x, y)[0] == 'conc' and vnoise(x, y, 2, seed + 3) > .7 - (y - 40) * .02: tc.px(x, y, 'sick', 2 + int(_hash(y, x, 2) * 2))
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 5)
    tc.grain(.05, mats=('conc',))
    cx = X(63)
    return tc.fin(.6, shadow=(cx, 62, 6, 2, 70))


def cable_droop(w=64, h=32, sag=14, seed=0):
    """늘어진 전선 4x2(64x32, 위층·걷기): 두 전봇대 완목 높이 사이 세 가닥. 맨 위 줄에서 시작해 가운데가 처진다."""
    tc = TC(w, h, seed)
    for i, (y0, y1, s) in enumerate(((2, 3, sag), (4, 3, sag + 3), (3, 7, sag + 7))):
        cable(tc, 0, y0, w - 1, y1, sag=s)
    return tc.img()


# ================================================================ 표지·경고등
def sign_blink(on=True, seed=0):
    """깜빡이는 표지 2x3(32x48): 강철 다리 둘 위 표지 상자(윗면 + 앞면 판), 판에는 글자 없이 빛나는 화살 무늬(아래쪽 갈매기 셋).
    on = 켜진 그림, off = 꺼진 그림(번갈아 놓으면 깜빡인다). 아랫줄(다리 밑동)만 막힘."""
    tc = TC(32, 48, seed)
    for lx in (6, 24):                                            # 다리
        for y in range(24, 47):
            tc.px(lx, y, 'steel', 5); tc.px(lx + 1, y, 'steel', 3)
        hazard(tc, lx - 1, 40, lx + 3, 46, seed + lx)
        tc.px(lx - 1, 47, 'steel', 1); tc.px(lx + 2, 47, 'steel', 1)
    box(tc, 1, 4, 31, 27, 3, 'steel', base=3, seed=seed)          # 상자(윗면 3줄)
    for y in range(9, 25):                                        # 판(앞면 안쪽, 어두운 바탕)
        for x in range(4, 28):
            tc.px(x, y, 'dark', 2 if on else 3)
    col = 'cyan'
    for i in range(3):                                            # 아래를 가리키는 갈매기 셋
        yy = 11 + i * 4
        for d in range(-6, 7):
            y = yy + (6 - abs(d)) // 2
            x = 16 + d - (1 if d <= 0 else 0)
            if on:
                tc.px(x, y, col, 6 if i == 1 else 5); tc.px(x, y + 1, col, 4)
            else:
                tc.px(x, y, 'steel', 2); tc.px(x, y + 1, 'steel', 1)
    if on:                                                        # 판 빛 번짐(가장자리 한 단)
        for y in range(9, 25):
            tc.px(4, y, col, 2); tc.px(27, y, col, 2)
        for x in range(4, 28): tc.px(x, 9, col, 3)
    for (x, y) in ((3, 6), (28, 6)): tc.px(x, y, 'steel', 6)
    rustify(tc, 0, 0, 32, 48, amount=.25, seed=seed + 3)
    im = tc.fin(.6, shadow=(16, 47, 12, 2, 60))
    if on:                                                        # 바닥에 비친 빛(반투명)
        g = D.glow(32, SIGNAL['cyan'][4], 46, 16, 18, 15)
        o = new(32, 48); o.alpha_composite(g, (0, 0)); o.alpha_composite(im); im = o
    return im


def signal_post(on=True, seed=0):
    """경고등 기둥 1x3(16x48): 강철 기둥 + 꼭대기 붉은 회전등(켜짐/꺼짐), 기둥 아래 경고 띠. 밑동만 막힘."""
    tc = TC(16, 48, seed)
    for y in range(10, 46):
        tc.px(7, y, 'steel', 5); tc.px(8, y, 'steel', 4); tc.px(9, y, 'steel', 2)
    hazard(tc, 6, 36, 11, 45, seed)
    box(tc, 4, 44, 13, 48, 1, 'conc', base=3)
    col = 'redl'
    cyl(tc, 8, 6, 4, 2, 4, col if on else 'steel', top=col if on else 'steel', base=0 if on else -2, seed=seed)
    tc.hline(3, 13, 11, 'steel', 3); tc.hline(4, 12, 12, 'steel', 1)
    if on:
        tc.px(6, 6, col, 6); tc.px(7, 6, col, 6); tc.px(6, 7, col, 5)
    im = tc.fin(.6, shadow=(8, 47, 5, 1.5, 60))
    if on:
        g = D.glow(16, SIGNAL['red'][5], 70, 8, 7, 8)
        o = new(16, 48); o.alpha_composite(g, (0, 0)); o.alpha_composite(im); im = o
    return im


# ================================================================ 드럼통·컨테이너
def drum(tc, cx, by, mat='warn', seed=0, rust=.3, dent=False):
    """세운 드럼통 하나(지름 10, 높이 12): 경고 도장 몸통 + 테 두 줄 + 윗면 뚜껑 마개."""
    cyl(tc, cx, by - 13, 5, 2.4, 12, mat, top=mat, seed=seed)
    for yy in (by - 9, by - 5):                                   # 테
        for x in range(int(cx - 5), int(cx + 5)):
            g = tc.get(x, yy)
            if g: tc.px(x, yy, mat, g[1] + 1); tc.px(x, yy + 1, mat, max(1, g[1] - 1))
    tc.px(cx - 2, by - 14, 'steel', 6); tc.px(cx - 1, by - 14, 'steel', 3)
    if dent: tc.ell(cx + 1.5, by - 7, 1.6, 2, mat, 2)


def toxic_drums(seed=0):
    """새는 오염 드럼통 무리 2x2(32x32): 바랜 경고 도장 통 둘(하나는 녹슬어 갈색) + 앞에 쓰러진 통 하나에서 녹색 오염물이 흘러나온다.
    아랫줄만 막힘."""
    tc = TC(32, 32, seed)
    drum(tc, 9, 22, 'warn', seed)
    drum(tc, 20, 19, 'rust', seed + 1)
    # 쓰러진 통(가로 원통: 윗면 = 몸통 위 빛줄, 오른쪽 끝 = 열린 뚜껑 타원)
    for y in range(20, 30):
        k = cyl_k((y - 20 + .5) / 10)
        for x in range(10, 25): tc.px(x, y, 'warn', k)
    for y in range(20, 30):
        for x in range(23, 29):
            if ((x + .5 - 25.5) / 3) ** 2 + ((y + .5 - 25) / 5) ** 2 <= 1: tc.px(x, y, 'warn', 2)
    for y in range(22, 28):
        for x in range(24, 28):
            if ((x + .5 - 25.8) / 1.8) ** 2 + ((y + .5 - 25) / 3) ** 2 <= 1: tc.px(x, y, 'tox', 4)
    for x in range(13, 23, 4):
        for y in range(20, 30): tc.px(x, y, 'warn', max(1, (tc.get(x, y) or ('warn', 3))[1] - 1))
    rustify(tc, 0, 0, 32, 32, amount=.3, seed=seed + 2, mats=('warn',))
    im = tc.fin(.6, shadow=(16, 29, 13, 2.5, 60))
    # 흘러나온 오염물(땅에 고인 웅덩이, 윤곽 없이)
    o = new(32, 32); p = o.load()
    for y in range(24, 32):
        for x in range(20, 32):
            if ((x + .5 - 28) / 4.5) ** 2 + ((y + .5 - 29) / 2.4) ** 2 <= 1:
                p[x, y] = TOX[3 if _hash(x, y, seed) > .2 else 5] + (255,)
    o.alpha_composite(im)
    return o


def drum_single(seed=0, mat='rust'):
    """드럼통 하나 1x1(16x16): 녹슨 통, 옆구리가 찌그러졌다. 칸 막힘."""
    tc = TC(16, 16, seed)
    drum(tc, 8, 15, mat, seed, dent=True)
    rustify(tc, 0, 0, 16, 16, amount=.4, seed=seed + 2, mats=(mat,))
    return tc.fin(.6, shadow=(8, 15, 6, 1.5, 60))


def container(seed=0, mat='paint'):
    """녹슨 화물 컨테이너 4x3(64x48): 윗면(골 판 + 녹 고임) + 긴 앞면(세로 골판 3px 주기, 찌그러짐) + 오른쪽 끝 문 잠금 막대 둘.
    몸통 두 줄(아래 2줄) 막힘, 윗면 줄은 걷기 + 가림."""
    W, H = 64, 48; tc = TC(W, H, seed)
    top = 14
    for y in range(4, 4 + top):                                   # 윗면
        for x in range(1, 63):
            k = 6 if (x - 1) % 6 < 3 else 5
            if y == 4: k = 6
            if x >= 61: k -= 1
            tc.px(x, y, mat, k)
    for y in range(4 + top, 46):                                  # 앞면 골판
        for x in range(1, 63):
            ph = (x - 1) % 4
            k = (4, 5, 3, 3)[ph]
            if x < 3: k += 1
            if y == 4 + top: k = 2
            if y >= 44: k = 1
            if 50 <= x <= 52: k = 2 if x == 52 else 4                # 문 경첩 이음
            tc.px(x, y, mat, clamp(k, 1, 6))
    for lx in (55, 59):                                           # 잠금 막대
        for y in range(4 + top + 2, 44): tc.px(lx, y, 'steel', 5); tc.px(lx + 1, y, 'steel', 2)
        tc.px(lx - 1, 30, 'steel', 6); tc.px(lx + 2, 30, 'steel', 2)
    tc.ell(22, 30, 5, 4, mat, 2); tc.ell(21, 29, 3, 2, mat, 3)    # 찌그러진 자국
    rustify(tc, 0, 0, W, H, amount=.55, seed=seed + 3, mats=(mat,), streak=True)
    for y in range(36, 46):                                       # 아래 녹물·이끼
        for x in range(1, 63):
            if _hash(x, y, seed + 5) < (y - 36) * .04 and tc.get(x, y): tc.px(x, y, 'sick', 2 + int(_hash(y, x, 4) * 2))
    tc.grain(.04)
    return tc.fin(.6, shadow=(32, 46, 30, 2.5, 60))


# ================================================================ 차 잔해·방호벽·가로등
def car_wreck(seed=0):
    """차 잔해 3x2(48x32): 바퀴 없이 주저앉은 각진 차체(바랜 흰 도장 + 녹), 깨진 앞유리·옆창, 지붕에 이끼. 글자·상표 없음.
    아랫줄만 막힘(지붕 줄은 걷기 + 가림)."""
    W, H = 48, 32; tc = TC(W, H, seed)
    # 지붕(윗면) + 앞유리(경사) + 본닛(윗면) + 앞면(옆구리 문 둘)
    tc.poly([(12, 4), (34, 4), (37, 12), (9, 12)], 'plaster', 5)      # 지붕
    for x in range(12, 34): tc.px(x, 4, 'plaster', 6)
    tc.poly([(9, 12), (37, 12), (39, 15), (7, 15)], 'glass', 3)       # 옆창 띠(앞면 위쪽)
    for x in range(7, 40):
        if _hash(x, 13, seed) < .4: tc.px(x, 13, 'dark', 2)
    tc.poly([(34, 4), (44, 9), (44, 13), (37, 12)], 'glass', 4)       # 앞유리(경사, 오른쪽)
    for (x, y) in ((38, 7), (39, 8), (40, 8), (41, 10), (39, 10)): tc.px(x, y, 'dark', 2)   # 깨진 구멍
    tc.px(36, 6, 'glass', 6); tc.px(37, 7, 'glass', 6)
    tc.poly([(44, 9), (47, 12), (47, 16), (44, 13)], 'plaster', 4)    # 본닛 끝
    for y in range(15, 28):                                       # 앞면(옆구리)
        for x in range(4, 47):
            k = 4 if x < 7 else (3 if x < 44 else 2)
            if y == 15: k = 5
            if y in (20,): k -= 1
            if y >= 26: k = 2
            if x in (19, 31) and y < 25: k = 2                    # 문 틈
            tc.px(x, y, 'plaster', clamp(k, 1, 6))
    tc.poly([(4, 15), (9, 12), (9, 15)], 'plaster', 4)            # 뒤 끝
    for (x0, x1) in ((8, 16), (35, 43)):                         # 바퀴 자리(빈 휠하우스, 어두운 반원)
        for y in range(22, 29):
            for x in range(x0, x1):
                if ((x + .5 - (x0 + x1) / 2) / 4.2) ** 2 + ((y + .5 - 28) / 5) ** 2 <= 1: tc.px(x, y, 'dark', 1)
    for x in (12, 14): tc.px(x, 18, 'steel', 6)                   # 손잡이
    rustify(tc, 0, 0, W, H, amount=.45, seed=seed + 3, mats=('plaster',))
    for y in range(4, 10):                                        # 지붕 이끼
        for x in range(13, 30):
            if vnoise(x, y, 3, seed + 6) > .6: tc.px(x, y, 'sick', 3 + (1 if y < 6 else 0))
    tc.grain(.04)
    return tc.fin(.6, shadow=(26, 28, 22, 3, 70))


def jersey_barrier(broken=False, seed=0):
    """콘크리트 방호벽 2x1(32x16): 좁은 윗면 + 비스듬한 앞면(위 좁고 아래 넓다) + 바랜 경고 띠. broken = 오른쪽이 깨져 철근이 삐죽."""
    W, H = 32, 16; tc = TC(W, H, seed)
    xe = 30 if not broken else 21
    for y in range(4, 16):
        for x in range(1, xe + 1):
            if y < 6: k = 6 if y == 4 else 5
            else:
                k = 4 if x < 3 else (3 if x < xe - 1 else 2)
                if 6 <= y < 9: k += 1                             # 위쪽 경사(빛)
                if y == 15: k = 1
            tc.px(x, y, 'conc', k)
    for x in range(2, xe):                                        # 경고 띠
        if ((x // 4) % 2 == 0) and _hash(x, 10, seed) > .25: tc.px(x, 10, 'warn', 4); tc.px(x, 11, 'warn', 3)
    if broken:
        for (x, y) in ((xe + 1, 9), (xe + 2, 8), (xe + 3, 8), (xe + 1, 12), (xe + 2, 13)): tc.px(x, y, 'rust', 4)
        tc.poly([(xe - 3, 4), (xe + 1, 6), (xe - 1, 16), (xe - 4, 16)], 'conc', 2)
        for (x, y, k) in ((25, 14, 3), (26, 15, 4), (28, 15, 3)): tc.px(x, y, 'conc', k)
    tc.grain(.06)
    return tc.fin(.6, shadow=(16, 15, 14, 1.5, 50))


def streetlamp_bent(seed=0):
    """휜 가로등 2x4(32x64): 강철 기둥이 위에서 앞으로 꺾여 등머리가 아래로 매달렸다. 깨진 등갓, 끊긴 전선. 밑동만 막힘."""
    W, H = 32, 64; tc = TC(W, H, seed)
    for y in range(18, 62):                                       # 곧은 아래 기둥
        tc.px(9, y, 'steel', 5); tc.px(10, y, 'steel', 4); tc.px(11, y, 'steel', 2)
    pts = [(10, 18), (11, 13), (14, 9), (18, 7), (22, 8), (25, 11), (26, 15)]
    for (a, b) in zip(pts, pts[1:]):                              # 휜 윗부분
        tc.line(a[0], a[1], b[0], b[1], 'steel', 5); tc.line(a[0] + 1, a[1] + 1, b[0] + 1, b[1] + 1, 'steel', 2)
    box(tc, 22, 15, 31, 22, 2, 'steel', base=3)                   # 매달린 등머리
    tc.hline(23, 30, 22, 'glass', 4); tc.hline(24, 29, 23, 'glass', 2)
    tc.px(25, 22, 'dark', 1); tc.px(28, 23, 'dark', 1)
    cable(tc, 29, 21, 30, 33, sag=1)
    box(tc, 6, 56, 15, 64, 2, 'conc', base=3)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 2)
    return tc.fin(.6, shadow=(10, 63, 6, 1.5, 60))


# ================================================================ 관·환풍기·바닥 환기구
def pipe_run(seed=0):
    """굵은 관 줄 4x2(64x32): 콘크리트 받침 둘 위의 굵은 강철관(지름 12, 32px 마다 볼트 테) + 앞의 가는 놋쇠관(지름 6) + 바퀴 밸브.
    아랫줄(받침)만 막힘."""
    W, H = 64, 32; tc = TC(W, H, seed)
    for sx in (8, 46):                                            # 받침(안장꼴)
        box(tc, sx, 18, sx + 10, 31, 3, 'conc', base=3, seed=seed + sx)
    pipe_h(tc, 0, 64, 15, 12, 'steel', step=32)
    pipe_h(tc, 0, 64, 25, 6, 'brass', step=16)
    # 바퀴 밸브(관 위로 솟은 대 + 붉은 바퀴)
    for y in range(4, 10): tc.px(30, y, 'steel', 4); tc.px(31, y, 'steel', 2)
    for a in range(0, 360, 20):
        r = math.radians(a); tc.px(30.5 + 4 * math.cos(r), 4 + 1.8 * math.sin(r), 'redl', 4 if a > 180 else 3)
    tc.hline(27, 35, 4, 'redl', 5); tc.px(30, 4, 'redl', 6)
    rustify(tc, 0, 0, W, H, amount=.4, seed=seed + 3)
    tc.grain(.04)
    return tc.fin(.6, shadow=(32, 30, 30, 2, 55))


def pipe_elbow(seed=0):
    """땅에서 솟아 꺾인 관 2x3(32x48): 콘크리트 받침에서 올라온 굵은 관이 위에서 왼쪽으로 꺾여 끊겼다(끝 단면 = 어두운 속 + 밝은 테),
    이음 틈에서 김이 샌다. 밑동만 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    pipe_v(tc, 20, 14, 44, 12, 'steel', step=32)
    for y in range(8, 20):                                        # 꺾인 부분(사분원)
        for x in range(10, 27):
            d = math.hypot(x + .5 - 14, y + .5 - 20)
            if 2 <= d <= 13 and x + .5 >= 14 and y + .5 <= 20:
                k = cyl_k((d - 2) / 12.0 * 0.85 + 0.0)
                tc.px(x, y, 'steel', k)
    pipe_h(tc, 4, 14, 14, 12, 'steel', flange=False)
    for y in range(8, 20):                                        # 끊긴 끝 단면(타원)
        for x in range(2, 8):
            e = ((x + .5 - 5) / 2.6) ** 2 + ((y + .5 - 14) / 6.3) ** 2
            if e <= 1: tc.px(x, y, 'steel', 5 if e > .5 else 1)
    box(tc, 12, 40, 30, 48, 2, 'conc', base=3)
    rustify(tc, 0, 0, W, H, amount=.4, seed=seed + 2)
    im = tc.fin(.6, shadow=(20, 47, 10, 2, 60))
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(steam_puff(16, 14, seed), (14, 0))
    return o


def steam_puff(w=16, h=14, seed=0, a=150):
    """반투명 김 덩이(윤곽 없이, 위로 갈수록 옅다)."""
    o = new(w, h); p = o.load()
    for y in range(h):
        for x in range(w):
            d = vnoise(x, y, 3, seed + 41) * .6 + (1 - abs(x + .5 - w / 2) / (w / 2)) * .5 + (y / h) * .25
            if d > .78:
                k = 5 if d > .95 else 4
                p[x, y] = STEEL[k + 1 if k < 6 else 6][:3] + (int(a * (0.45 + 0.55 * y / h)),)
    return o


def vent_fan(seed=0):
    """환풍기 함 2x2(32x32): 강철 상자 윗면에 둥근 팬 창살(날개 넷이 비친다) + 앞면 갈빗살 통풍구. 위로 김 한 덩이.
    아랫줄만 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 2, 10, 30, 31, 10, 'steel', base=3, seed=seed)
    cx, cy = 16, 15
    for y in range(10, 21):                                       # 팬 구멍(타원)
        for x in range(4, 29):
            e = ((x + .5 - cx) / 11) ** 2 + ((y + .5 - cy) / 4.6) ** 2
            if e <= 1:
                a = math.atan2((y + .5 - cy) / 4.6, (x + .5 - cx) / 11)
                blade = math.sin(a * 2 + 0.6) > .35
                k = 4 if blade else 1
                if e > .8: k = 2
                tc.px(x, y, 'steel', k)
    for y in range(10, 21):                                       # 창살(가로줄)
        for x in range(4, 29):
            if (y - 10) % 2 == 0 and ((x + .5 - cx) / 11) ** 2 + ((y + .5 - cy) / 4.6) ** 2 <= 1: tc.px(x, y, 'steel', 5)
    tc.px(16, 15, 'steel', 6)
    for y in range(23, 29, 2):                                    # 앞면 통풍구
        tc.hline(6, 26, y, 'steel', 1); tc.hline(6, 26, y + 1, 'steel', 4)
    rustify(tc, 0, 22, W, H, amount=.15, seed=seed + 3)
    im = tc.fin(.6, shadow=(16, 30, 14, 2, 55))
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(steam_puff(18, 11, seed + 1, 120), (7, 0))
    return o


def floor_vent(seed=0):
    """바닥 환기 창살 1x1(16x16, 걷기·사람 아래): 강철 틀 안 가로 창살, 틈 사이 어둠, 가는 김."""
    tc = TC(16, 16, seed)
    for y in range(2, 14):
        for x in range(1, 15):
            if y in (2, 13) or x in (1, 14): k = 5 if (y == 2 or x == 1) else 2
            else: k = 4 if (y % 3 == 0) else (1 if y % 3 == 1 else 2)
            tc.px(x, y, 'steel', k)
    rustify(tc, 0, 0, 16, 16, amount=.3, seed=seed + 2)
    im = tc.img()
    o = new(); o.alpha_composite(im); o.alpha_composite(steam_puff(10, 8, seed + 3, 90), (3, 1))
    return o


def manhole(seed=0):
    """맨홀 뚜껑 1x1(16x16, 걷기): 둥근 강철 뚜껑(타원) + 방사 홈 + 테. 땅 장식."""
    tc = TC(16, 16, seed)
    tc.ell(8, 9, 7, 5, 'steel', 1)
    tc.ell(8, 9, 6, 4.2, 'steel', lambda x, y: 4 if (x + y) % 3 else 3)
    for a in range(0, 360, 45):
        r = math.radians(a)
        for d in (1.5, 2.5, 3.5):
            tc.px(8 + d * math.cos(r) * 1.4, 9 + d * math.sin(r), 'steel', 2)
    tc.px(5, 7, 'steel', 6); tc.px(6, 6, 'steel', 5)
    rustify(tc, 0, 0, 16, 16, amount=.3, seed=seed + 2)
    return tc.img()


# ================================================================ 잔해·철골·릴·철망
def conc_chunk(tc, x0, y0, w, h, top, seed=0, base=3):
    """콘크리트 덩이: 3/4 상자를 모서리 깨서(위 모서리 깎임) + 철근 한두 가닥."""
    cut = int(_hash(x0, y0, seed) * 3)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y - y0 < cut and x - x0 > w - 1 - (cut - (y - y0)) * 2: continue
            if y - y0 < 2 and x - x0 < (2 - (y - y0)): continue
            if y < y0 + top: k = base + 2 + (1 if (y == y0 or x == x0) else 0)
            else:
                k = base + (1 if x < x0 + 2 else (-1 if x >= x0 + w - 2 else 0))
                if y == y0 + top: k -= 1
                if y == y0 + h - 1: k = 1
            if _hash(x, y, seed + 3) < .08: k -= 1
            tc.px(x, y, 'conc', clamp(k, 1, 6))


def rebar(tc, x0, y0, x1, y1):
    tc.line(x0, y0, x1, y1, 'rust', 4); tc.line(x0 + 1, y0, x1 + 1, y1, 'rust', 2)


def rubble_conc(seed=0):
    """콘크리트 잔해 더미 2x2(32x32): 크기 다른 깨진 덩이 다섯 + 삐죽 튀어나온 녹슨 철근 셋 + 잔 조각. 아랫줄만 막힘."""
    tc = TC(32, 32, seed)
    rebar(tc, 9, 6, 13, 16); rebar(tc, 21, 4, 19, 14); rebar(tc, 27, 12, 24, 20)
    conc_chunk(tc, 3, 14, 13, 13, 5, seed + 1)
    conc_chunk(tc, 15, 11, 12, 11, 4, seed + 2)
    conc_chunk(tc, 18, 21, 12, 9, 4, seed + 3, base=2)
    conc_chunk(tc, 1, 24, 8, 7, 3, seed + 4)
    conc_chunk(tc, 10, 24, 9, 7, 3, seed + 5, base=2)
    for (x, y) in ((29, 30), (14, 31), (2, 31)): tc.px(x, y, 'conc', 4)
    for y in range(20, 32):
        for x in range(0, 32):
            if tc.get(x, y) and _hash(x, y, seed + 9) < .06: tc.px(x, y, 'sick', 4)
    return tc.fin(.6, shadow=(16, 29, 14, 2.5, 60))


def rubble_small(seed=0):
    """작은 잔해 1x1(16x16): 깨진 덩이 둘 + 철근 한 가닥. 칸 막힘."""
    tc = TC(16, 16, seed)
    rebar(tc, 10, 3, 8, 9)
    conc_chunk(tc, 1, 6, 9, 9, 3, seed + 1)
    conc_chunk(tc, 8, 9, 7, 6, 3, seed + 2, base=2)
    return tc.fin(.6, shadow=(8, 14, 7, 1.5, 55))


def girder_pile(seed=0):
    """철골 더미 3x2(48x32): H형강 셋이 엇갈려 쌓였다 — 왼쪽 끝 H 단면(위·아래 플랜지 + 가운데 웨브), 윗 플랜지 빛줄,
    웨브 그늘, 이음판 리벳. 맨 위 하나는 비스듬히 걸쳤다. 아랫줄만 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    def beam(x0, x1, y, k0=0):
        for x in range(x0, x1):
            tc.px(x, y, 'steel', 6 + k0); tc.px(x, y + 1, 'steel', 5 + k0)          # 윗 플랜지 윗면
            tc.px(x, y + 2, 'steel', 3 + k0)                                       # 윗 플랜지 앞 모
            for yy in range(y + 3, y + 7): tc.px(x, yy, 'steel', 1 + k0 + (1 if yy == y + 3 else 0))   # 웨브(안쪽 그늘)
            tc.px(x, y + 7, 'steel', 5 + k0); tc.px(x, y + 8, 'steel', 3 + k0); tc.px(x, y + 9, 'steel', 1)   # 아랫 플랜지
        for (dy, w0, w1, k) in ((0, 0, 7, 6), (1, 0, 7, 5), (2, 0, 7, 4), (3, 2, 5, 4), (4, 2, 5, 4), (5, 2, 5, 3), (6, 2, 5, 3),
                                (7, 0, 7, 5), (8, 0, 7, 4), (9, 0, 7, 2)):  # H 단면(왼쪽 끝 마구리)
            for xx in range(x0 - 7 + w0, x0 - 7 + w1): tc.px(xx, y + dy, 'steel', clamp(k + k0 - (1 if xx == x0 - 1 else 0), 1, 6))
        for x in range(x0 + 7, x1 - 3, 12):                                       # 이음판 리벳
            tc.px(x, y + 4, 'steel', 5); tc.px(x + 1, y + 5, 'steel', 0)
    beam(13, 47, 20)
    beam(9, 40, 11, -1)
    for y in range(3, 28):                                                         # 비스듬히 걸친 셋째(윗면 띠)
        x = 34 + (y - 3) // 2
        for i, k in enumerate((6, 5, 4, 2, 1, 3)): tc.px(x + i, y, 'steel', k)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 2)
    return tc.fin(.6, shadow=(28, 30, 20, 2, 60))


def cable_reel(seed=0):
    """전선 릴 2x2(32x32): 세운 큰 나무 원판 둘(윗판 타원 + 아랫판 앞면) 사이 감긴 검은 전선, 풀린 끝 한 가닥. 아랫줄만 막힘."""
    tc = TC(32, 32, seed)
    cyl(tc, 16, 24, 13, 5, 3, 'wood', seed=seed)                  # 아랫판
    for y in range(12, 25):                                       # 감긴 전선 몸통
        for x in range(7, 26):
            u = (x + .5 - 7) / 19
            k = cyl_k(u)
            if (y + int(u * 3)) % 3 == 0: k -= 1
            tc.px(x, y, 'cable', clamp(k + 0, 1, 6))
    cyl(tc, 16, 9, 13, 5, 3, 'wood', seed=seed + 1)               # 윗판
    tc.ell(16, 9, 3, 1.4, 'wood', 1)                              # 굴대 구멍
    cable(tc, 25, 20, 31, 29, sag=3)
    return tc.fin(.6, shadow=(16, 30, 14, 2, 60))


def fence_chain(seed=0):
    """찢긴 철망 울타리 3x2(48x32): 강철 기둥 셋 사이 마름모 철망(1px), 가운데 칸이 찢겨 말려 있다. 기둥 밑동 줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    for y in range(4, 30):
        for x in range(2, 46):
            on = ((x + y) % 5 == 0) or ((x - y) % 5 == 0)
            torn = (17 < x < 31) and (y > 9) and (((x - 24) / 6) ** 2 + ((y - 20) / 9) ** 2 < 1)
            sag = y < 4 + int(2 * math.sin((x - 2) / 44 * math.pi))
            if on and not torn and not sag: tc.px(x, y, 'steel', 4 if (x + y) % 2 else 3)
    for y in range(9, 24):                                        # 말린 가장자리
        x = 18 + int(3 * math.sin(y / 3.0))
        tc.px(x, y, 'steel', 5); tc.px(x + 13, y, 'steel', 3)
    for px_ in (2, 24, 45):                                       # 기둥
        for y in range(2, 31): tc.px(px_, y, 'steel', 5); tc.px(px_ + 1, y, 'steel', 2)
        tc.px(px_, 1, 'steel', 6)
    tc.hline(2, 47, 4, 'steel', 5)                                # 윗 가로대
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 2)
    return tc.img()


# ================================================================ 땅 장식 (걷기, 사람 아래)
def glass_shards(seed=0):
    """깨진 유리 조각 1x1(16x16, 걷기): 흩어진 삼각 조각(청록 유리, 왼쪽 위 날이 빛난다)."""
    tc = TC(16, 16, seed)
    for i in range(6):
        x = 2 + int(_hash(i, 1, seed) * 11); y = 3 + int(_hash(i, 2, seed) * 10); s = 1 + int(_hash(i, 3, seed) * 3)
        tc.poly([(x, y), (x + s + 1, y + 1), (x + 1, y + s + 1)], 'glass', 4)
        tc.px(x, y, 'glass', 6)
    return tc.img()


def oil_stain(seed=0):
    """기름·오염 얼룩 2x1(32x16, 걷기): 검게 번진 기름 + 가장자리 무지개 막(청록·호박 한 점씩). 윤곽 없음."""
    o = new(32, 16); p = o.load()
    for y in range(16):
        for x in range(32):
            e = ((x + .5 - 16) / 13) ** 2 + ((y + .5 - 8) / 5.5) ** 2 + (vnoise(x, y, 4, seed + 5) - .5) * .6
            if e < 1:
                c = ASPH[1] if e < .75 else ASPH[2]
                if .7 < e < .8 and _hash(x, y, seed) < .3: c = SIGNAL['cyan'][3] if x < 16 else SIGNAL['amber'][3]
                p[x, y] = c + (210,)
    return o


def weeds_sick(seed=0, n=5):
    """오염 잡초 포기 1x1(16x16, 걷기): 금 틈에서 자란 누런 풀 잎 몇 갈래(버들항 풀 잎 모양, 오염 램프)."""
    tc = TC(16, 16, seed)
    for i in range(n):
        bx = 3 + int(_hash(i, 4, seed) * 10); h = 4 + int(_hash(i, 5, seed) * 7); lean = (_hash(i, 6, seed) - .5) * .8
        for j in range(h):
            x = bx + lean * j; y = 15 - j
            tc.px(x, y, 'sick', 3 + (1 if j > h * .5 else 0) + (1 if j == h - 1 else 0))
    return tc.fin(.7)
