#!/usr/bin/env python3
"""steampunk_city 탈것 — 증기 기관차·탄수차·객차·화물칸·석탄 호퍼·노면 증기 전차·운하 바지선·나룻배·광차·손수레.

선로 탈것은 동서 선로(rail-n 줄 + rail-s 줄) 위에 선다: 조각 맨 아래 칸 = rail-s 줄, 바퀴 밑 = 그 칸 y 9(남쪽 레일 머리).
3/4 탑뷰라 지붕·보일러 윗면이 넓게 보이고(뒤 가장자리 어둡게), 남쪽 옆면이 그 아래로 보인다. 빛은 왼쪽 위.

  python3 vehicles.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, box3, disc, rivets, cyl_v
from kit import Reg, contact, OUT

R = Reg('vehicles')
RAIL_Y = 32 + 9          # h=3 조각에서 바퀴 밑(남쪽 레일 머리) y


def wheel(c, cx, cy, r, mat='cloth', spokes=8):
    """옆에서 본 바퀴(남쪽 면): 두꺼운 무쇠 테(왼쪽 위 빛) + 어두운 칠 바탕 + 무쇠 바퀴살 + 놋쇠 축."""
    c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d: ('iron', 5 if dx + dy < -0.7 else 3 if dx + dy < 0.4 else 2) if d > 0.6 else (mat, 1))
    if r >= 5:
        for k in range(spokes):
            a = k * math.pi * 2 / spokes
            c.line(round(cx - 0.5), round(cy - 0.5), round(cx - 0.5 + (r - 2) * math.cos(a)), round(cy - 0.5 + (r - 2) * math.sin(a)), 'iron', 3)
    c.ell(cx, cy, max(1.2, r * 0.3), max(1.2, r * 0.3), lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))
    c.ell(cx, cy, r, r, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.88 and dy > 0.1 else None)


def hcyl(c, x0, x1, y0, y1, mat, hi, bands=(), bmat='brass'):
    """동서로 누운 원통(보일러·탱크): 위 행이 밝고(윗면) 아래로 어두워진다. bands = 띠 x 위치."""
    n = y1 - y0
    for j in range(n):
        u = (j + 0.5) / n
        t = hi if u < 0.12 else hi - 0 if u < 0.3 else hi - 1 if u < 0.5 else hi - 2 if u < 0.78 else hi - 3
        if 0.12 <= u < 0.3: t = hi + 1
        c.HL(x0, y0 + j, x1 - x0, mat, t)
    for bx in bands:
        for j in range(n):
            u = (j + 0.5) / n
            c.P(bx, y0 + j, bmat, 4 if u < 0.3 else 3 if u < 0.6 else 2); c.P(bx + 1, y0 + j, bmat, 2 if u < 0.5 else 1)
    c.HL(x0, y0 - 1, x1 - x0, 'ink', 1); c.HL(x0, y1, x1 - x0, 'ink', 1)


def chassis(c, x0, x1, y, mat='iron'):
    """대차 틀(옆 보) + 완충기."""
    c.R(x0, y, x1 - x0, 3, mat, 2); c.HL(x0, y, x1 - x0, mat, 4); c.HL(x0, y + 3, x1 - x0, 'ink', 1)
    for bx in (x0 - 2, x1):
        c.R(bx, y, 2, 2, 'iron', 4); c.P(bx + (0 if bx < x0 else 1), y, 'brass', 4)


# ── 증기 기관차 5×3 (동쪽이 앞) ──
@R.add('locomotive', '증기 기관차(검은 보일러·놋쇠 띠·빨강 바퀴, 동쪽이 앞)', 5, 3, 'structure', tags=['기차', '기관차', '선로', '역'],
       rules='선로(rail-n·rail-s 두 줄) 위에만. 조각 맨 아래 칸이 rail-s 줄에 오게 찍는다. 뒤(서쪽)에 tender, 그 뒤로 객차·화물칸을 붙인다. 승강장 옆 선로에 세운다.')
def _(c):
    # 발판 윗면(보일러 둘레 — 위에서 보이는 넓은 철판 바닥, 리벳) : 북쪽 띠 + 남쪽 띠
    c.R(20, 1, 58, 26, 'iron', 4); c.HL(20, 0, 58, 'ink', 1); c.HL(20, 1, 58, 'iron', 2)
    rivets(c, 22, 3, 54, 1, 5, 'iron', 6, 2); rivets(c, 22, 24, 54, 1, 5, 'iron', 6, 2)
    c.HL(20, 26, 58, 'iron', 6)
    # 남쪽 옆면(발판 밑 테 + 빨강 띠) + 대차 틀
    c.R(20, 27, 58, 3, 'iron', 2); c.HL(20, 28, 58, 'cloth', 2)
    chassis(c, 4, 76, 30)
    # 보일러 윗면(위에서 본 긴 원통 — 가운데 빛 줄, 위아래로 둥글게 어두워진다) + 놋쇠 띠
    for j in range(16):
        u = (j + 0.5) / 16
        t = 2 if u < 0.1 else 3 if u < 0.25 else 5 if u < 0.42 else 4 if u < 0.65 else 3 if u < 0.85 else 2
        c.HL(24, 5 + j, 44, 'iron', t)
    for bx in (32, 44, 56):
        for j in range(16): c.P(bx, 5 + j, 'brass', 4 if 3 < j < 8 else 3 if j < 12 else 2)
    c.HL(24, 4, 44, 'ink', 1); c.HL(24, 21, 44, 'ink', 1)
    # 연기실(앞): 더 검은 원통 윗면 + 굴뚝 아가리(위에서 본 원)
    for j in range(18):
        u = (j + 0.5) / 18
        c.HL(68, 4 + j, 9, 'iron', 2 if u < 0.2 else 3 if u < 0.5 else 2 if u < 0.8 else 1)
    c.VL(77, 4, 18, 'ink', 1); c.HL(68, 3, 9, 'ink', 1); c.HL(68, 22, 9, 'ink', 1)
    disc(c, 72.5, 9, 4, 3, 'iron', 5, band=3, bt=2)
    c.ell(72.5, 9, 2.4, 1.6, lambda X, Y, dx, dy, d: ('coal', 0))
    # 증기 돔·모래 돔(위에서 본 원반 머리) + 기적
    disc(c, 50, 11, 4.5, 3.2, 'brass', 4, band=2, bt=2)
    disc(c, 38, 12, 3.5, 2.4, 'iron', 5, band=2, bt=2)
    c.R(61, 10, 2, 3, 'brass', 4); c.P(61, 9, 'brass', 5)
    # 앞 등(놋쇠 테 + 불빛) + 배장기
    c.R(77, 10, 3, 5, 'brass', 3); c.R(78, 11, 2, 3, 'lit', 4)
    for k in range(6): c.HL(77, 30 + k, 3 - k // 2, 'cloth', 2 if k < 3 else 1)
    # 운전실(뒤): 지붕 윗면 14행(가운데 밝게, 환기창 둘) + 남쪽 옆면(남색·창·놋쇠 테)
    for j, t in enumerate((2, 3, 4, 5, 5, 5, 5, 5, 4, 4, 4, 3, 3, 3)): c.HL(2, 1 + j, 22, 'iron', t)
    c.HL(2, 0, 22, 'ink', 1); c.HL(1, 15, 24, 'iron', 6); c.HL(1, 16, 24, 'iron', 2)
    for x in (7, 18): c.R(x - 2, 5, 5, 4, 'iron', 2); c.HL(x - 2, 5, 5, 'iron', 1); c.HL(x - 2, 9, 5, 'iron', 6)
    c.R(3, 17, 20, 13, 'navy', 2); c.HL(3, 17, 20, 'navy', 3)
    c.R(6, 18, 6, 5, 'lit', 3); c.R(7, 19, 4, 2, 'lit', 4); c.VL(9, 18, 5, 'navy', 1)
    c.R(15, 18, 5, 5, 'glass', 2); c.HL(15, 18, 5, 'glass', 3)
    c.HL(3, 25, 20, 'brass', 4); c.HL(3, 26, 20, 'brass', 2)
    c.VL(1, 1, 29, 'ink', 1); c.VL(24, 17, 13, 'navy', 1)
    # 바퀴(남쪽 면): 큰 구동 바퀴 셋 + 뒤 작은 바퀴 + 연결 막대
    wheel(c, 12, RAIL_Y - 4.5, 4.5, spokes=6)
    for cx in (32, 47, 62): wheel(c, cx, RAIL_Y - 6.5, 6.5)
    c.HL(31, RAIL_Y - 5, 32, 'brass', 4); c.HL(31, RAIL_Y - 4, 32, 'brass', 2)


# ── 탄수차 3×3 ──
@R.add('tender', '탄수차(위가 트인 석탄 칸 + 물탱크 뚜껑)', 3, 3, 'container', tags=['기차', '탄수차', '선로'],
       rules='기관차 바로 서쪽(뒤)에 붙인다. 같은 선로 줄.')
def _(c):
    for cx in (10, 24, 38): wheel(c, cx, RAIL_Y - 4.5, 4.5, spokes=6)
    chassis(c, 3, 45, 33)
    # 몸: 윗면(석탄 칸 아가리 — 안쪽 뒤 벽 + 석탄 더미, 뒤쪽은 물탱크 뚜껑) 14행 + 남쪽 옆면 12행
    x0, x1 = 2, 46
    c.R(x0, 6, x1 - x0, 15, 'iron', 4); c.HL(x0, 5, x1 - x0, 'ink', 1)
    c.R(x0 + 2, 7, x1 - x0 - 4, 2, 'iron', 2)                       # 안쪽 뒤 벽 그늘
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 7)
        return ('coal', 2 if (dy < -0.2 and r > 0.45) else 1 if r > 0.3 else 0)
    c.R(x0 + 2, 9, 26, 10, 'coal', 1); c.ell(x0 + 15, 12, 13, 6, coal)
    # 뒤(서쪽) 물탱크 뚜껑 + 급수구
    c.R(x0 + 29, 8, 13, 11, 'iron', 5); c.HL(x0 + 29, 8, 13, 'iron', 3); c.VL(x0 + 28, 8, 11, 'iron', 2)
    disc(c, x0 + 35, 12, 4, 2.4, 'brass', 4, band=1, bt=2)
    c.VL(x0, 6, 15, 'iron', 6); c.VL(x1 - 1, 6, 15, 'iron', 3); c.HL(x0, 20, x1 - x0, 'iron', 6)
    # 옆면(검은 철판 + 리벳 + 놋쇠 테)
    c.R(x0, 21, x1 - x0, 12, 'iron', 2); c.HL(x0, 21, x1 - x0, 'iron', 1)
    rivets(c, x0 + 2, 23, x1 - x0 - 3, 1, 4); rivets(c, x0 + 2, 30, x1 - x0 - 3, 1, 4)
    c.HL(x0, 26, x1 - x0, 'brass', 3); c.HL(x0, 27, x1 - x0, 'brass', 1)
    c.VL(x0 - 1, 6, 27, 'ink', 1); c.VL(x1, 6, 27, 'ink', 1)


def coach_body(c, x0, x1, paint, roof='iron'):
    """객차 몸: 넓은 둥근 지붕 윗면(19행 — 뒤 가장자리 어둡게, 가운데 채광 지붕 띠, 환기통 줄) + 남쪽 옆면(창 줄 + 놋쇠 테)."""
    tones = (2, 3, 4, 4, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3)
    for j, t in enumerate(tones): c.HL(x0, 1 + j, x1 - x0, roof, t)
    c.R(x0 + 6, 6, x1 - x0 - 12, 5, 'glass', 2)                                     # 채광 지붕(위에서 보인다)
    c.HL(x0 + 6, 6, x1 - x0 - 12, 'glass', 3); c.HL(x0 + 6, 11, x1 - x0 - 12, roof, 2)
    for x in range(x0 + 8, x1 - 6, 6): c.VL(x, 6, 5, roof, 4)
    for x in range(x0 + 6, x1 - 4, 12): disc(c, x, 15, 2, 1.2, 'iron', 5, band=1, bt=2, rim=False)   # 환기통 줄
    c.HL(x0, 0, x1 - x0, 'ink', 1); c.HL(x0 - 1, 20, x1 - x0 + 2, roof, 6); c.HL(x0 - 1, 21, x1 - x0 + 2, roof, 1)
    pm, pt = paint
    c.R(x0, 22, x1 - x0, 12, pm, pt); c.HL(x0, 22, x1 - x0, pm, pt - 1)
    for k, x in enumerate(range(x0 + 3, x1 - 5, 8)):
        lit = (k * 7 + x0) % 3 == 0
        c.R(x, 23, 5, 5, 'lit' if lit else 'glass', 3 if lit else 2); c.HL(x, 23, 5, 'lit' if lit else 'glass', 4 if lit else 3)
        c.VL(x - 1, 23, 5, 'brass', 3)
    c.HL(x0, 29, x1 - x0, 'brass', 4); c.HL(x0, 30, x1 - x0, 'brass', 2)
    c.R(x0, 31, x1 - x0, 3, pm, pt - 1)
    c.VL(x0 - 1, 1, 33, 'ink', 1); c.VL(x1, 1, 33, 'ink', 1); c.HL(x0, 34, x1 - x0, 'ink', 1)


@R.add('coach', '객차(초록 칠·불 켜진 창·채광 지붕)', 4, 3, 'structure', tags=['기차', '객차', '선로', '역'],
       rules='탄수차 뒤 또는 다른 객차 뒤에 붙인다. 승강장 옆 선로.')
def _(c):
    chassis(c, 3, 61, 34)
    coach_body(c, 2, 62, ('paint', 3))
    for cx in (10, 18, 46, 54): wheel(c, cx, RAIL_Y - 3.5, 3.5, spokes=6)


@R.add('wagon-coal', '석탄 화물칸(위가 트여 석탄이 보인다)', 3, 3, 'container', tags=['기차', '화물', '석탄', '선로'],
       rules='화물 선로·석탄 하역장. 기관차 뒤에 줄줄이.')
def _(c):
    for cx in (10, 38): wheel(c, cx, RAIL_Y - 4.5, 4.5, spokes=6)
    chassis(c, 3, 45, 33)
    x0, x1 = 2, 46
    c.R(x0, 8, x1 - x0, 13, 'wood', 4); c.HL(x0, 7, x1 - x0, 'ink', 1)
    c.R(x0 + 2, 9, x1 - x0 - 4, 2, 'wood', 1)
    def coal(X, Y, dx, dy, d):
        r = rnd(X // 2, Y // 2, 3)
        return ('coal', 2 if (dy < -0.2 and r > 0.45) else 1 if r > 0.3 else 0)
    c.R(x0 + 2, 11, x1 - x0 - 4, 8, 'coal', 1); c.ell(x0 + 21, 13, 19, 6, coal)
    c.VL(x0, 8, 13, 'wood', 5); c.VL(x1 - 1, 8, 13, 'wood', 2); c.HL(x0, 20, x1 - x0, 'wood', 5)
    c.R(x0, 21, x1 - x0, 12, 'wood', 2)
    for x in range(x0 + 4, x1, 6): c.VL(x, 21, 12, 'wood', 1)
    c.line(x0 + 3, 31, x0 + 20, 22, 'iron', 3); c.line(x1 - 4, 31, x1 - 21, 22, 'iron', 3)
    c.R(x0, 21, 3, 12, 'iron', 3); c.R(x1 - 3, 21, 3, 12, 'iron', 2)
    c.VL(x0 - 1, 8, 25, 'ink', 1); c.VL(x1, 8, 25, 'ink', 1); c.HL(x0, 33, x1 - x0, 'ink', 1)


@R.add('wagon-box', '유개 화물칸(나무 판자, 미닫이 문, 둥근 지붕)', 3, 3, 'structure', tags=['기차', '화물', '선로', '창고'],
       rules='화물 선로·창고 앞 측선.')
def _(c):
    for cx in (10, 38): wheel(c, cx, RAIL_Y - 4.5, 4.5, spokes=6)
    chassis(c, 3, 45, 33)
    x0, x1 = 2, 46
    for j, t in enumerate((2, 3, 4, 4, 4, 3, 3, 3)): c.HL(x0, 4 + j, x1 - x0, 'iron', t)
    c.HL(x0, 3, x1 - x0, 'ink', 1); c.HL(x0 - 1, 12, x1 - x0 + 2, 'iron', 5); c.HL(x0 - 1, 13, x1 - x0 + 2, 'iron', 1)
    for x in range(x0 + 4, x1 - 2, 7): c.VL(x, 5, 7, 'iron', 2)
    c.R(x0, 14, x1 - x0, 19, 'brick', 3)
    for x in range(x0, x1, 3): c.VL(x, 14, 19, 'brick', 2)
    c.HL(x0, 14, x1 - x0, 'brick', 4)
    c.R(x0 + 15, 16, 16, 15, 'brick', 2); c.VL(x0 + 15, 16, 15, 'iron', 3); c.VL(x0 + 30, 16, 15, 'iron', 2)
    c.HL(x0 + 13, 15, 20, 'iron', 4); c.R(x0 + 21, 22, 2, 3, 'brass', 4)
    c.line(x0 + 16, 30, x0 + 29, 17, 'brick', 4)
    c.VL(x0 - 1, 4, 29, 'ink', 1); c.VL(x1, 4, 29, 'ink', 1); c.HL(x0, 33, x1 - x0, 'ink', 1)


@R.add('steam-tram', '노면 증기 전차(크림·빨강 칠, 지붕 위 작은 굴뚝)', 4, 3, 'structure', tags=['전차', '노면 전차', '궤도', '거리'],
       rules='차도 안 궤도(tram-n·tram-s 두 줄) 위에만. 조각 맨 아래 칸이 tram-s 줄. 정류장 앞(보도 쪽)에 세운다.')
def _(c):
    for cx in (12, 22, 42, 52): wheel(c, cx, RAIL_Y - 3.5, 3.5, mat='iron', spokes=6)
    c.R(4, 34, 56, 3, 'iron', 2); c.HL(4, 34, 56, 'iron', 4)
    # 지붕(윗면 10행, 가운데 증기 굴뚝·환기)
    x0, x1 = 3, 61
    for j, t in enumerate((1, 2, 3, 3, 3, 3, 3, 2, 2, 2)): c.HL(x0, 6 + j, x1 - x0, 'canvas', t)
    c.HL(x0, 5, x1 - x0, 'ink', 1); c.HL(x0 - 1, 16, x1 - x0 + 2, 'cloth', 3); c.HL(x0 - 1, 17, x1 - x0 + 2, 'cloth', 1)
    cyl_v(c, 26, 0, 6, 9, 3, 'iron', base=3); c.ell(29, 1.5, 3, 1.5, lambda X, Y, dx, dy, d: ('iron', 5) if d > 0.4 else ('coal', 0))
    for x in (12, 46): disc(c, x, 10, 3, 1.4, 'brass', 4, band=1, bt=2, rim=False)
    # 옆면: 크림 위 / 빨강 아래, 창 줄, 가운데 문
    c.R(x0, 18, x1 - x0, 16, 'canvas', 3); c.R(x0, 27, x1 - x0, 7, 'cloth', 2); c.HL(x0, 27, x1 - x0, 'brass', 4)
    for x in range(x0 + 3, x1 - 5, 7):
        if 26 <= x <= 34: continue
        lit = x % 3 == 0
        c.R(x, 19, 5, 6, 'lit' if lit else 'glass', 3 if lit else 2); c.HL(x, 19, 5, 'lit' if lit else 'glass', 4 if lit else 3)
    c.R(27, 19, 8, 15, 'wood', 2); c.VL(31, 19, 15, 'wood', 1); c.R(28, 20, 6, 5, 'glass', 2)
    c.VL(x0 - 1, 6, 28, 'ink', 1); c.VL(x1, 6, 28, 'ink', 1); c.HL(x0, 34, x1 - x0, 'iron', 1)


# ── 물 위 탈것(운하) ──
@R.add('barge', '운하 바지선(석탄 실은 나무 짐배, 동서로 긴)', 5, 2, 'container', tags=['배', '운하', '바지선', '석탄'],
       rules='운하 물 칸 위에만(물 2줄 이상인 곳). 부두·하역장 옆에 댄다. 둑(quay)에 걸치지 않는다.')
def _(c):
    W = 80
    # 배 윗면: 뱃전 테(밝은 나무) + 짐칸 석탄 + 고물 키
    def hull(X, Y, dx, dy, d): return ('wood', 2)
    pts = [(4, 4), (74, 4), (79, 12), (74, 20), (4, 20), (1, 12)]
    c.poly(pts, lambda x, y: ('wood', 4))
    inner = [(8, 7), (71, 7), (74, 12), (71, 17), (8, 17), (5, 12)]
    c.poly(inner, lambda x, y: ('wood', 1))
    def coal(x, y):
        r = rnd(x // 2, y // 2, 9)
        return ('coal', 2 if r > 0.6 else 1 if r > 0.25 else 0)
    c.poly([(16, 8), (60, 8), (62, 12), (60, 16), (16, 16), (14, 12)], coal)
    for x in (24, 38, 52): c.VL(x, 7, 11, 'wood', 3)
    c.line(4, 4, 74, 4, 'ink', 1); c.line(74, 4, 79, 12, 'ink', 1)
    # 남쪽 뱃전 옆면(물 위로 드러난 판자, 아래는 물에 잠김)
    c.poly([(1, 12), (4, 20), (74, 20), (79, 12), (79, 15), (74, 25), (4, 25), (1, 15)], lambda x, y: ('wood', 2 if y < 23 else 1))
    c.HL(4, 21, 70, 'wood', 3); c.HL(4, 25, 70, 'water', 1); c.HL(5, 26, 68, 'water', 2)
    # 키·밧줄 기둥
    c.R(4, 9, 3, 6, 'iron', 3); c.line(3, 12, 0, 12, 'wood', 3)
    for x in (10, 68): disc(c, x, 12, 1.6, 1, 'iron', 5, band=2, bt=2, rim=False)


@R.add('rowboat', '나룻배(작은 나무배)', 2, 1, 'container', tags=['배', '운하', '나룻배'], rules='운하 물 위, 계단·부두 끝 옆에 댄다.')
def _(c):
    c.poly([(3, 2), (26, 2), (31, 7), (26, 12), (3, 12), (1, 7)], lambda x, y: ('wood', 4))
    c.poly([(5, 4), (25, 4), (28, 7), (25, 10), (5, 10), (3, 7)], lambda x, y: ('wood', 1))
    for x in (11, 19): c.R(x, 4, 2, 7, 'wood', 3)
    c.line(3, 2, 26, 2, 'ink', 1)
    c.poly([(1, 7), (3, 12), (26, 12), (31, 7), (31, 9), (26, 14), (3, 14), (1, 9)], lambda x, y: ('wood', 2))
    c.HL(3, 15, 24, 'water', 2)
    c.line(14, 6, 6, 1, 'wood', 3)


@R.add('minecart', '광차(석탄 실은 무쇠 통, 작은 바퀴)', 1, 1, 'container', tags=['광차', '석탄', '공장 마당'], rules='석탄 마당·선로 끝 하역장. 두세 대 한 줄.')
def _(c):
    c.R(1, 3, 14, 6, 'iron', 4); c.HL(1, 2, 14, 'ink', 1)
    def coal(x, y):
        r = rnd(x, y, 5); return ('coal', 2 if r > 0.6 else 1 if r > 0.2 else 0)
    c.poly([(3, 4), (13, 4), (12, 8), (4, 8)], coal)
    c.VL(1, 3, 6, 'iron', 6); c.VL(14, 3, 6, 'iron', 3); c.HL(1, 8, 14, 'iron', 6)
    c.R(2, 9, 12, 4, 'iron', 2); c.HL(2, 9, 12, 'iron', 1); rivets(c, 3, 10, 10, 1, 3)
    c.VL(1, 2, 11, 'ink', 1); c.VL(14, 9, 4, 'ink', 1)
    for cx in (4.5, 11.5): c.ell(cx, 13.5, 2, 2, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 2) if d > 0.3 else ('brass', 3))
    c.HL(2, 15, 12, 'ink', 1)


@R.add('handcart', '손수레(위가 트인 나무 짐칸 + 큰 바퀴 둘 + 손잡이)', 2, 1, 'container', tags=['수레', '시장', '창고'], rules='가게 옆·창고 화물 문 옆·시장. 길 칸을 막지 않는다.')
def _(c):
    # 짐칸 아가리(위에서 본 사각 안쪽): 뒤 판 안쪽 면(그늘 2행) + 판자 바닥 6행 + 작은 자루(동쪽 구석)
    c.HL(2, 0, 24, 'ink', 1)
    c.R(3, 1, 22, 2, 'wood', 1)
    c.R(3, 3, 22, 6, 'wood', 3)
    for x in range(6, 24, 4): c.VL(x, 3, 6, 'wood', 2)
    c.HL(3, 3, 22, 'wood', 2)
    c.ell(21, 5, 2.6, 2, lambda X, Y, dx, dy, d: ('canvas', 3 if dx + dy < -0.3 else 2))
    c.R(2, 1, 1, 9, 'wood', 5); c.R(25, 1, 1, 9, 'wood', 2); c.VL(1, 0, 13, 'ink', 1); c.VL(26, 0, 13, 'ink', 1)
    c.HL(2, 9, 24, 'wood', 5)                                     # 앞 판 윗테(빛)
    c.R(2, 10, 24, 3, 'wood', 2); c.HL(2, 12, 24, 'wood', 1)
    c.R(27, 4, 4, 2, 'wood', 3); c.HL(27, 4, 4, 'wood', 4); c.R(29, 2, 2, 2, 'wood', 4)
    for cx in (7, 21): wheel(c, cx, 12.5, 3.5, mat='wood', spokes=6)
    c.HL(4, 15, 20, 'ink', 1)


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'vehicles', 'preview.png'), z=z, W=1800)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'vehicles')
