# 미래 폐허 앵커 ② — 녹슨 대형 기계와 부서진 로봇형 잔해(머리 없음·눈 없음 — 기계 몸체만).
# 톤 캔버스(fr_mat.TC)에 기계 재질 규약대로 찍는다. 3/4: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위.
import math
from fr_mat import *
from fr_base import _hash
from fr_props import cyl, steam_puff


def sphere(tc, cx, cy, r, mat, ry=None, base=0):
    ry = ry or r
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx = (x + .5 - cx) / r; dy = (y + .5 - cy) / ry; d = dx * dx + dy * dy
            if d > 1: continue
            nz = math.sqrt(1 - d)
            l = -0.55 * dx - 0.6 * dy + 0.6 * nz
            k = 1.8 + max(0, l) * 4.6 + base
            if d > .86: k -= 1
            tc.px(x, y, mat, clamp(round(k), 1, 6))


def rbox(tc, x0, y0, x1, y1, top, mat, base=3, seed=0, rivets=True, panel=None):
    """둥근 모 상자(3/4): 윗면 top 행 + 앞면. 앞면은 판 줄눈(panel=(pw,ph))·리벳 규약."""
    box(tc, x0, y0, x1, y1, top, mat, base=base, seed=seed)
    if panel:
        panels(tc, x0 + 1, y0 + top + 1, x1 - 1, y1 - 1, mat, base, panel[0], panel[1], stagger=False, rivets=rivets, face='front', seed=seed, vary=0)
    for (x, y) in ((x0, y0), (x1 - 1, y0), (x0, y1 - 1), (x1 - 1, y1 - 1)): tc.m[y, x] = 0      # 모 깎기


def robot_hulk(seed=0):
    """주저앉은 거대 로봇 잔해 5x5(80x80): 다리를 앞으로 뻗고 앉은 채 몸통이 오른쪽으로 기울었다. 머리가 떨어져 나간 목 구멍에서
    끊긴 전선이 늘어지고, 왼팔은 어깨째 뜯겨 나가 빈 관절 구멍만 남았다(떨어진 팔은 robot_arm). 오른팔은 땅을 짚었다.
    바랜 황토 도장 장갑·리벳 판·녹·오염 이끼. 얼굴·눈 없음. 아래 두 줄 막힘, 위는 걷기 + 가림."""
    W, H = 80, 80; P = 'drab'
    up = TC(W, H, seed)                                            # 윗몸(기울일 것)
    for (ex, ey) in ((29, 6), (49, 8)):                             # 등 배기통
        cyl(up, ex, ey, 3.2, 1.4, 11, 'steel', top='dark', seed=seed)
        up.ell(ex, ey, 2, .9, 'dark', 1)
    box(up, 20, 14, 60, 52, 8, P, base=3, seed=seed + 1)            # 몸통
    panels(up, 22, 23, 58, 50, P, 3, 18, 14, rivets=True, face='front', seed=seed + 2, vary=1)
    up.ell(40, 17, 7, 3, 'steel', 4); up.ell(40, 17, 5.4, 2.2, 'dark', 1)   # 목 구멍
    for (x0, x1, sgy) in ((36, 33, 9), (41, 44, 12)):
        cable(up, x0, 17, x1, 17 + sgy, sag=2)
    up.px(44, 30, 'amber', 5)
    for y in range(33, 45):                                         # 찢긴 가슴 장갑(오른쪽 아래, 속 기계)
        for x in range(42, 55):
            if (x - 42) + (44 - y) * .6 < 12 and (x - 42) > (y - 33) * .3: up.px(x, y, 'dark', 1 if y > 35 else 2)
    pipe_v(up, 47, 36, 45, 4, 'brass', flange=False)
    up.line(42, 33, 54, 33, 'rust', 4); up.line(42, 34, 50, 45, 'rust', 3)
    sphere(up, 15, 24, 9, P, ry=8)                                  # 왼 어깨: 뜯긴 관절 구멍
    up.ell(15, 24, 5, 4.4, 'dark', 1); up.ell(15, 23, 3.4, 2.6, 'steel', 2)
    cable(up, 12, 26, 9, 36, sag=-1); cable(up, 16, 27, 18, 39, sag=2)
    sphere(up, 65, 24, 9, P, ry=8)                                  # 오른 어깨
    up.hline(58, 72, 25, P, 2)
    pipe_v(up, 69, 31, 50, 8, 'steel', flange=False)               # 오른 위팔
    for y in (37, 44): up.hline(65, 74, y, 'steel', 2)
    rustify(up, 0, 0, W, H, amount=.5, seed=seed + 7, mats=(P,))
    tc = TC(W, H, seed)
    # 다리(앞으로 뻗었다): 넓적다리 윗면 + 무릎 + 발
    for lx in (21, 45):
        box(tc, lx, 50, lx + 13, 67, 11, P, base=3, seed=seed + lx)
        sphere(tc, lx + 6.5, 62, 6, 'steel', ry=4)
        box(tc, lx - 1, 64, lx + 14, 73, 3, 'steel', base=3, seed=seed + lx + 1)
        box(tc, lx - 3, 69, lx + 16, 80, 4, P, base=3, seed=seed + lx + 2)
        for x in range(lx - 2, lx + 15, 4): tc.px(x, 78, 'steel', 1)
    # 윗몸을 오른쪽으로 기울여(위로 갈수록 오른쪽으로 밀어) 붙인다
    for y in range(H):
        sh = int(round((54 - y) * 0.16)) if y < 54 else 0
        for x in range(W):
            if up.m[y, x]:
                xx = x + sh
                if 0 <= xx < W: tc.m[y, xx] = up.m[y, x]; tc.t[y, xx] = up.t[y, x]
    # 오른팔 아래(팔꿈치·아래팔·땅 짚은 집게) — 기울어진 위팔 끝에 잇는다
    ex = 69 + int(round((54 - 50) * 0.16))
    sphere(tc, ex, 53, 5.5, 'steel')
    box(tc, ex - 7, 56, ex + 6, 71, 3, P, base=3, seed=seed + 70)
    tc.hline(ex - 6, ex + 5, 63, P, 2)
    for dx in (-6, 0, 5):
        x0 = ex + dx
        for j in range(9):
            x = x0 + int(dx * j / 14); y = 71 + j
            if y >= 79: break
            tc.px(x, y, 'steel', 5 if j < 3 else 4); tc.px(x + 1, y, 'steel', 2)
        tc.px(x0 + int(dx * 8 / 14), 78, 'steel', 6)
    rustify(tc, 0, 50, W, H, amount=.45, seed=seed + 9, mats=(P,))
    rustify(tc, 0, 0, W, H, amount=.22, seed=seed + 8, mats=('steel',))
    for y in range(6, 80):                                          # 윗면에 내려앉은 오염 이끼
        for x in range(W):
            g = tc.get(x, y)
            if not g or g[0] not in (P, 'rust') or g[1] < 5: continue
            if vnoise(x, y, 3, seed + 9) > .62: tc.px(x, y, 'sick', 4 + (1 if _hash(x, y, seed) > .6 else 0))
    tc.grain(.04)
    return tc.fin(.6, shadow=(40, 77, 36, 3.5, 75))


def robot_arm(seed=0):
    """떨어진 로봇 팔 3x2(48x32): 눕힌 위팔 원통(이음 테·리벳) + 팔꿈치 공 관절 + 굵은 아래팔 장갑 + 벌어진 세 갈래 집게,
    잘린 어깨 끝에서 전선이 쏟아져 나왔다. 아랫줄만 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    P = 'drab'
    pipe_h(tc, 4, 20, 20, 9, 'steel', step=16)                    # 위팔
    for y in range(15, 26):                                       # 잘린 어깨 단면
        for x in range(1, 6):
            e = ((x + .5 - 3.5) / 2.4) ** 2 + ((y + .5 - 20.5) / 5) ** 2
            if e <= 1: tc.px(x, y, 'steel', 5 if e > .55 else 1)
    cable(tc, 2, 22, 0, 30, sag=-2); cable(tc, 4, 23, 7, 31, sag=2)
    sphere(tc, 21, 19, 5.5, 'steel')                              # 팔꿈치
    box(tc, 24, 12, 38, 27, 4, P, base=3, seed=seed)              # 아래팔 장갑
    panels(tc, 25, 17, 37, 26, P, 3, 6, 9, rivets=False, face='front', seed=seed + 1, vary=0)
    for (dy, ang) in ((-5, -0.5), (0, 0.0), (5, 0.55)):            # 집게
        for j in range(10):
            x = 38 + j; y = 19 + dy + int(math.tan(ang) * j * .8) + (1 if j > 6 else 0) * (1 if dy >= 0 else -1)
            tc.px(x, y, 'steel', 5); tc.px(x, y + 1, 'steel', 2)
        tc.px(47, 19 + dy + int(math.tan(ang) * 8), 'steel', 6)
    rustify(tc, 0, 0, W, H, amount=.5, seed=seed + 3, mats=(P,))
    rustify(tc, 0, 0, W, H, amount=.25, seed=seed + 4, mats=('steel',))
    return tc.fin(.6, shadow=(24, 28, 22, 2.5, 65))


def gauge(tc, cx, cy, r=3, seed=0):
    """둥근 압력계(숫자 없음): 흰 판 + 테 + 바늘."""
    tc.ell(cx, cy, r + 1, r + 1, 'steel', 2)
    tc.ell(cx, cy, r, r, 'plaster', lambda x, y: 6 if (x < cx and y < cy) else 5)
    a = 0.6 + _hash(cx, cy, seed) * 2.5
    for d in range(int(r)): tc.px(cx - .5 + math.cos(a) * d, cy - .5 - math.sin(a) * d, 'redl', 3)


def rust_machine(seed=0):
    """녹슨 대형 발전기 4x4(64x64): 콘크리트 받침 위 눕힌 큰 강철 탱크(리벳 테 셋), 위로 솟은 배기 굴뚝, 앞 피스톤 둘,
    압력계 둘(숫자 없음)과 어두운 조작판, 바퀴 밸브, 땅으로 내려가는 관. 아래 두 줄 막힘."""
    W, H = 64, 64; tc = TC(W, H, seed)
    box(tc, 2, 46, 62, 64, 5, 'conc', base=3, seed=seed)          # 받침
    cyl(tc, 50, 6, 4.2, 1.8, 26, 'steel', top='dark', seed=seed)  # 배기 굴뚝
    tc.ell(50, 6, 3, 1.2, 'dark', 1)
    for y in (12, 20): tc.hline(46, 55, y, 'steel', 2)
    # 탱크(가로 원통, 지름 26): 앞면 음영 위→아래
    top, dia = 18, 28
    for y in range(top, top + dia):
        k = cyl_k((y - top + .5) / dia)
        for x in range(6, 58): tc.px(x, y, 'paint', k)
    for x0 in (6, 57):                                            # 양 끝 둥근 마개
        for y in range(top - 1, top + dia + 1):
            tc.px(x0, y, 'steel', 3)
    for bx in (14, 31, 48):                                       # 리벳 테
        for y in range(top - 1, top + dia + 1):
            k = cyl_k((y - top + 1.5) / (dia + 2))
            tc.px(bx, y, 'steel', k + 1); tc.px(bx + 1, y, 'steel', k); tc.px(bx + 2, y, 'steel', max(1, k - 1))
            if (y - top) % 5 == 2: tc.px(bx + 1, y, 'steel', 6)
    rustify(tc, 0, 0, W, H, amount=.6, seed=seed + 2, mats=('paint',))
    # 앞 조작판(탱크 아래 앞면) + 압력계 + 피스톤
    box(tc, 10, 40, 34, 52, 2, 'steel', base=3, seed=seed + 3)
    for x in range(13, 25):
        for y in range(44, 50): tc.px(x, y, 'dark', 2)
    tc.px(14, 45, 'cyan', 4); tc.px(15, 45, 'cyan', 3); tc.px(20, 47, 'redl', 4)
    gauge(tc, 29, 45, 2.6, seed)
    for px_ in (40, 50):
        pipe_v(tc, px_, 42, 56, 5, 'brass', flange=False)
        box(tc, px_ - 4, 38, px_ + 4, 43, 2, 'steel', base=4)
    for a in range(0, 360, 24):                                   # 바퀴 밸브(탱크 위)
        r = math.radians(a); tc.px(24.5 + 4 * math.cos(r), 15 + 1.8 * math.sin(r), 'redl', 4 if a > 180 else 3)
    tc.vline(24, 15, 19, 'steel', 3)
    pipe_v(tc, 58, 30, 62, 5, 'steel', flange=True, step=16)       # 땅으로 내려가는 관
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 5, mats=('steel',))
    tc.grain(.04)
    im = tc.fin(.6, shadow=(32, 62, 30, 3, 70))
    o = new(W, H); o.alpha_composite(im); o.alpha_composite(steam_puff(14, 10, seed + 4, 110), (43, 0))
    return o


def sentry_wreck(seed=0):
    """쓰러진 소형 경비 기계 2x2(32x32): 둥근 몸통 껍데기(강철) + 옆으로 드러난 궤도 바퀴(검은 고무 + 바퀴 넷) + 부러진 안테나·작은 접시.
    눈·얼굴 없음. 아랫줄만 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    for y in range(18, 30):                                       # 궤도(앞면)
        for x in range(4, 28):
            e = abs(x + .5 - 16) / 12; k = 2 if (x + y) % 3 else 3
            if y in (18, 29): k = 1
            if e > .92 and (y < 20 or y > 27): continue
            tc.px(x, y, 'cable', k)
    for wx in (8, 13, 19, 24): tc.ell(wx, 24, 2.3, 2.3, 'steel', lambda x, y: 4 if x < wx else 2); tc.px(wx - 1, 23, 'steel', 6)
    sphere(tc, 15, 14, 10, 'steel', ry=7)                         # 몸통 껍데기
    for x in range(6, 25): tc.px(x, 17, 'steel', 2)               # 이음 줄
    tc.ell(18, 10, 3, 1.4, 'steel', 2)                            # 해치
    for (x, y) in ((22, 7), (23, 5), (24, 4), (25, 2)): tc.px(x, y, 'steel', 4)   # 부러진 안테나
    tc.px(25, 1, 'redl', 4)
    tc.ell(9, 8, 3, 1.5, 'steel', 5); tc.px(9, 9, 'steel', 2)     # 작은 접시
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 2)
    return tc.fin(.6, shadow=(16, 29, 13, 2, 65))
