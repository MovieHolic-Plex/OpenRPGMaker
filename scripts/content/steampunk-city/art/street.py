#!/usr/bin/env python3
"""steampunk_city 거리·마당·부두 큰 소품 — 시계 기둥·우체통·가판대·광고탑·톱니 기념비·분수·가로수·화분·자루·고철 더미·
압력 탱크·가스 저장탑·신호기·차막이·계선주·밧줄·독립 굴뚝·급수 기둥·소화전·문형 기중기·부두 기중기·비행선 계류탑·계류 비행선·
정류장 지붕.

모두 3/4 탑뷰(윗면 밝게·뒤 가장자리 어둡게 + 남쪽 앞면), 빛은 왼쪽 위, 맨 밑 먹 접지 선.

  python3 street.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, box3, disc, rivets, cyl_v, tex_brick
from kit import Reg, contact, OUT

R = Reg('street')


def post(c, x, y0, y1, mat='iron', w=2):
    c.R(x, y0, w, y1 - y0, mat, 3); c.VL(x, y0, y1 - y0, mat, 5)
    c.VL(x + w - 1, y0, y1 - y0, mat, 1 if w > 2 else 2)


def round_base(c, cx, y, w, mat='iron', t=5):
    disc(c, cx, y, w / 2, w / 4 + 0.6, mat, t, band=3, bt=2)


# ── 시계 기둥 1×3 ──
@R.add('clock-post', '거리 시계 기둥(무쇠 기둥 + 네 면 시계 상자 + 작은 모임지붕)', 1, 3, 'column', tags=['시계', '광장', '거리'],
       rules='광장 모퉁이·역 앞 한 개. 둘레 1칸 비움.')
def _(c):
    post(c, 7, 22, 43)
    c.R(6, 30, 4, 2, 'iron', 4); c.HL(6, 32, 4, 'iron', 1)
    # 시계 상자(윗면 = 녹청 모임지붕 위에서) + 앞면 시계판
    c.poly([(1, 7), (15, 7), (8, 1)], lambda x, y: ('verd', 3)); c.poly([(1, 7), (8, 1), (1, 1)], lambda x, y: None)
    c.R(1, 2, 14, 6, 'verd', 3)
    c.poly([(1, 2), (8, 4), (1, 7)], lambda x, y: ('verd', 4)); c.poly([(15, 2), (8, 4), (15, 7)], lambda x, y: ('verd', 1))
    c.poly([(1, 2), (15, 2), (8, 4)], lambda x, y: ('verd', 2))
    c.line(1, 2, 8, 4, 'copper', 4); c.line(15, 2, 8, 4, 'copper', 2); c.HL(1, 1, 14, 'ink', 1)
    c.R(7, 0, 2, 4, 'brass', 4)
    c.HL(0, 8, 16, 'copper', 4); c.HL(0, 9, 16, 'ink', 1)
    c.R(2, 10, 12, 11, 'iron', 2); c.VL(2, 10, 11, 'iron', 4)
    c.ell(8, 15.5, 5, 5, lambda X, Y, dx, dy, d: ('brass', 4 if dx + dy < 0 else 2) if d > 0.6 else ('canvas', 3))
    c.line(7, 15, 7, 12, 'ink', 1); c.line(7, 15, 10, 16, 'ink', 1)
    c.HL(2, 21, 12, 'ink', 1)
    round_base(c, 8, 42, 12)


# ── 우체통 1×2 ──
@R.add('pillar-box', '빨강 무쇠 우체통(둥근 기둥, 둥근 머리)', 1, 2, 'column', tags=['우체통', '거리'], rules='보도 바깥 줄, 가스등 사이. 문 앞 접근칸은 피한다.')
def _(c):
    cyl_v(c, 3, 10, 10, 17, 4, 'cloth', base=2)
    disc(c, 8, 9, 6, 4.2, 'cloth', 3, band=2, bt=1)
    c.ell(8, 8.4, 2, 1.2, lambda X, Y, dx, dy, d: ('cloth', 3)); c.P(7, 6, 'brass', 4)
    c.R(4, 15, 8, 2, 'ink', 0); c.HL(4, 14, 8, 'cloth', 3)
    c.R(6, 20, 4, 3, 'brass', 3); c.HL(6, 20, 4, 'brass', 4)
    round_base(c, 8, 28, 12, 'cloth', 2)
    c.HL(2, 31, 12, 'ink', 1)


# ── 가판대 2×2 ──
@R.add('kiosk', '거리 가판대(초록 칠 나무, 녹청 모임지붕, 불 켜진 창구)', 2, 2, 'structure', tags=['가판대', '거리', '광장', '역'],
       rules='광장·역 앞 보도 넓은 곳. 창구(남쪽) 앞 1칸 비움.')
def _(c):
    x0, x1, y0, y1 = 1, 30, 1, 15
    ax, ay = 16, 7
    c.poly([(x0, y1), (x1, y1), (ax, ay)], lambda x, y: ('verd', 2))
    c.poly([(x0, y0), (x0, y1), (ax, ay)], lambda x, y: ('verd', 4))
    c.poly([(x1, y0), (x1, y1), (ax, ay)], lambda x, y: ('verd', 1))
    c.poly([(x0, y0), (x1, y0), (ax, ay)], lambda x, y: ('verd', 3))
    for (px_, py) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): c.line(px_, py, ax, ay, 'copper', 4 if px_ < ax else 2)
    c.HL(x0, y0, x1 - x0, 'ink', 1); c.VL(x0, y0, y1 - y0, 'ink', 1); c.VL(x1, y0, y1 - y0, 'ink', 1)
    c.HL(x0, y1, x1 - x0 + 1, 'copper', 4); c.HL(x0, y1 + 1, x1 - x0 + 1, 'ink', 1)
    c.ell(ax, ay - 1, 2, 1.4, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))
    # 몸(앞면): 초록 판자 + 창구(불빛) + 받침 판
    c.R(3, 17, 26, 14, 'paint', 2); c.HL(3, 17, 26, 'paint', 1)
    c.R(6, 18, 20, 6, 'lit', 3); c.R(7, 19, 18, 2, 'lit', 4)
    for x in (12, 19): c.VL(x, 18, 6, 'paint', 1)
    c.R(4, 24, 24, 2, 'wood', 4); c.HL(4, 24, 24, 'wood', 5); c.HL(4, 26, 24, 'wood', 1)
    for x in range(5, 28, 4): c.VL(x, 27, 4, 'paint', 1)
    c.VL(2, 17, 14, 'ink', 1); c.VL(29, 17, 14, 'ink', 1); c.HL(2, 31, 28, 'ink', 1)


# ── 광고탑 1×2 ──
@R.add('poster-column', '둥근 광고탑(빛바랜 포스터 — 글자 없음, 녹청 돔 머리)', 1, 2, 'column', tags=['광고탑', '거리', '광장'], rules='광장 모퉁이·교차로.')
def _(c):
    cyl_v(c, 2, 10, 12, 18, 4, 'stone', base=3)
    for (y, x, w, h, m) in ((14, 3, 5, 6, 'cloth'), (13, 8, 5, 5, 'canvas'), (20, 4, 6, 6, 'navy'), (19, 10, 4, 7, 'brass')):
        for j in range(h):
            for i in range(w):
                if c.on(x + i, y + j):
                    u = (x + i - 2 + 0.5) / 12
                    c.P(x + i, y + j, m, 2 if u > 0.7 else 3)
    c.HL(2, 26, 12, 'iron', 4)
    disc(c, 8, 9, 7, 4.4, 'verd', 3, band=2, bt=1)
    c.ell(8, 7.5, 3, 2, lambda X, Y, dx, dy, d: ('verd', 4 if dx < 0 else 2)); c.R(7, 3, 2, 4, 'brass', 4)
    round_base(c, 8, 28, 14, 'stone', 4)
    c.HL(1, 31, 14, 'ink', 1)


# ── 톱니 기념비 2×3 ──
def gear(c, cx, cy, r, teeth, mat='brass'):
    """정면 톱니바퀴: 극좌표로 이(톱니 r..r+2, 반 주기 사각) + 테 + 바퀴살 넷 + 축. 왼쪽 위 밝게, 바깥 먹 테."""
    R2 = r + 2.2
    for y in range(int(cy - R2 - 1), int(cy + R2 + 2)):
        for x in range(int(cx - R2 - 1), int(cx + R2 + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            rho = math.hypot(dx, dy); th = math.atan2(dy, dx)
            tooth = ((th / (2 * math.pi) * teeth) % 1.0) < 0.5
            if rho > R2 or (rho > r and not tooth): continue
            k = (dx + dy) / max(rho, 0.01)
            t = 4 if k < -0.5 else 3 if k < 0.4 else 2
            if r * 0.55 < rho < r * 0.72: continue                    # 테와 살 사이 빈 곳(아래에서 살로 채운다)
            if rho < r * 0.55: t = 2 if rho > 2.2 else t
            c.P(x, y, mat, t)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        for f in (0.55, 0.62, 0.7):
            c.P(round(cx - 0.5 + r * f * math.cos(a)), round(cy - 0.5 + r * f * math.sin(a)), mat, 3)
    c.ell(cx, cy, 2.2, 2.2, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 2))
    m0 = c.m.copy()
    for y in range(int(cy - R2 - 1), int(cy + R2 + 2)):
        for x in range(int(cx - R2 - 1), int(cx + R2 + 2)):
            g = c.get(x, y)
            if not g or g[0] != mat or math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r - 0.5: continue
            if any(not (0 <= x + ox < c.w and 0 <= y + oy < c.h) or m0[y + oy, x + ox] < 0 for (ox, oy) in ((1, 0), (0, 1))):
                c.P(x, y, mat, 1)


@R.add('gear-monument', '톱니 기념비(돌 단 위 큰 놋쇠 톱니바퀴 둘)', 2, 3, 'figure', tags=['기념비', '광장', '랜드마크'],
       rules='광장 한가운데. 둘레 1칸은 포석으로 비우고 네 모퉁이에 가스등·벤치.')
def _(c):
    # 단(아래 넓은 단: 윗면 6행 + 앞 4행, 위 단: 윗면 5행 + 앞 6행)
    box3(c, 0, 32, 32, 7, 6, 'stone', tt=5, ft=3); c.HL(0, 45, 32, 'ink', 1)
    box3(c, 5, 22, 22, 6, 6, 'stone', tt=5, ft=3)
    c.R(12, 30, 8, 3, 'brass', 3); c.HL(12, 30, 8, 'brass', 4)
    for x in range(1, 32, 6): c.VL(x, 39, 6, 'stone', 2)
    # 톱니 둘(서 있는 판, 단 윗면에 꽂혔다)
    gear(c, 22, 9, 5.5, 9, 'copper')
    gear(c, 12, 12, 8.5, 12)
    c.R(11, 22, 6, 3, 'iron', 2); c.HL(11, 22, 6, 'iron', 4)


# ── 분수 3×2 ──
@R.add('fountain', '광장 분수(둥근 돌 수반 + 놋쇠 증기 꼭지)', 3, 2, 'container', tags=['분수', '광장', '공원'],
       rules='광장·쌈지 공원 한가운데. 둘레 1칸 포석.')
def _(c):
    cx = 24
    # 수반 테(돌 윗면) + 물(안쪽)
    c.ell(cx, 15, 23, 11, lambda X, Y, dx, dy, d: ('stone', 6 if dx + dy < -0.6 else 5 if dy < 0.3 else 4))
    c.ell(cx, 15 + 5, 23, 11, lambda X, Y, dx, dy, d: ('stone', 2 if dx > 0.3 else 3) if dy > 0.2 else None)
    c.ell(cx, 15, 23, 11, lambda X, Y, dx, dy, d: ('stone', 6 if dx + dy < -0.6 else 5 if dy < 0.3 else 4))
    c.ell(cx, 15, 19, 8, lambda X, Y, dx, dy, d: ('water', 4 if ((X + Y * 2) % 7 == 0) else 3 if dy > -0.4 else 2))
    c.ell(cx, 15, 19, 8, lambda X, Y, dx, dy, d: ('stone', 2) if d > 0.86 and dy < 0 else None)
    c.ell(cx, 15, 23, 11, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.92 and dy < 0 else None)
    c.ell(cx, 20, 23, 11, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.92 and dy > 0.3 else None)
    # 가운데 기둥 + 놋쇠 잔 + 물줄기
    c.R(cx - 2, 8, 4, 9, 'stone', 4); c.VL(cx - 2, 8, 9, 'stone', 5); c.VL(cx + 1, 8, 9, 'stone', 2)
    disc(c, cx, 8, 6, 2.6, 'brass', 4, band=2, bt=2)
    c.ell(cx, 8, 4, 1.6, lambda X, Y, dx, dy, d: ('water', 3))
    for (dx, h) in ((-5, 6), (5, 6)):
        c.line(cx + dx, 9, cx + dx * 1.5, 13, 'water', 4)
    c.R(cx - 1, 2, 2, 6, 'steam', 4); c.P(cx - 1, 1, 'steam', 4); c.P(cx, 5, 'steam', 3)


# ── 가로수 2×3 ──
@R.add('plane-tree', '그을린 플라타너스(무쇠 나무 울 + 흙 둘레)', 2, 3, 'organic', tags=['나무', '가로수', '공원', '광장'],
       rules='보도 넓은 곳·쌈지 공원·광장 가장자리. 6~8칸 간격, 가스등과 엇갈리게. 문 앞은 피한다.')
def _(c):
    # 흙 둘레(위에서 본 둥근 흙 + 무쇠 울)
    c.ell(16, 42, 10, 4, lambda X, Y, dx, dy, d: ('soot', 1 if d < 0.6 else 2))
    # 줄기
    c.R(14, 26, 5, 16, 'wood', 2); c.VL(14, 26, 16, 'wood', 3); c.VL(18, 26, 16, 'wood', 1)
    for (y, x) in ((30, 15), (35, 16), (38, 15)): c.P(x, y, 'canvas', 2)
    # 무쇠 울(둥근 테 + 살)
    c.ell(16, 41, 9, 3.5, lambda X, Y, dx, dy, d: ('iron', 4 if dx < 0 else 2) if d > 0.7 else None)
    for x in range(8, 26, 3): c.VL(x, 37, 4, 'iron', 3)
    c.ell(16, 37.5, 9, 3, lambda X, Y, dx, dy, d: ('iron', 5 if dx < 0 else 3) if d > 0.75 and dy < 0 else None)
    # 수관: 덩이 여럿(뒤 → 앞), 왼쪽 위 밝게, 그을린 초록
    blobs = [(9, 12, 8), (23, 11, 8), (16, 7, 8), (12, 20, 8), (21, 20, 8), (16, 15, 9)]
    for (bx, by, r) in blobs:
        def leaf(X, Y, dx, dy, d, bx=bx, by=by):
            k = rnd(X // 2, Y // 2, 17)
            t = 3 if (dx + dy < -0.5) else 2 if (dx + dy < 0.4) else 1
            if k > 0.82 and t < 4: t += 1
            if k < 0.12: t = max(0, t - 1)
            if d > 0.86 and dy > 0: t = 0
            return ('moss', t)
        c.ell(bx, by, r, r * 0.9, leaf)
    c.ell(16, 28, 12, 3, lambda X, Y, dx, dy, d: None)


# ── 화분 1×1 ──
@R.add('planter', '무쇠 화분(다듬은 관목)', 1, 1, 'container', tags=['화분', '거리', '가게 앞'], rules='가게·여관 문 양옆 보도에 한 쌍(문 칸은 비운다).')
def _(c):
    box3(c, 2, 6, 12, 4, 5, 'iron', tt=5, ft=2)
    c.R(3, 7, 10, 2, 'soot', 1)
    rivets(c, 3, 12, 10, 1, 3)
    c.HL(2, 15, 12, 'ink', 1)
    def leaf(X, Y, dx, dy, d):
        k = rnd(X, Y, 5)
        t = 3 if dx + dy < -0.4 else 2 if dx + dy < 0.4 else 1
        return ('moss', t + (1 if k > 0.85 else 0))
    c.ell(8, 4.5, 6, 4.2, leaf)


# ── 자루 1×1 · 고철 2×1 ──
@R.add('sacks', '곡물·석탄 자루 더미', 1, 1, 'organic', tags=['자루', '짐', '부두', '창고'], rules='창고·부두·시장 노점 뒤. 상자·통과 섞어 덩이로.')
def _(c):
    def sack(x, y, w, h):
        # 누운 자루: 둥근 모서리 몸(왼쪽 위 밝게) + 묶은 목(동쪽) + 아래 그늘
        for j in range(h):
            for i in range(w):
                cx = (i + 0.5) / w * 2 - 1; cy = (j + 0.5) / h * 2 - 1
                if cx * cx * cx * cx + cy * cy * cy * cy > 1: continue
                t = 3 if (cx + cy) < -0.6 else 2 if cy < 0.45 else 1
                c.P(x + i, y + j, 'canvas', t)
        c.R(x + w, y + h // 2 - 1, 2, 2, 'canvas', 1); c.P(x + w + 2, y + h // 2 - 1, 'canvas', 2)
        c.HL(x + 1, y + h, w - 2, 'ink', 1)
        c.VL(x + w // 2, y + 1, h - 2, 'canvas', 1)
    sack(1, 6, 7, 6); sack(7, 7, 6, 6); sack(3, 2, 7, 5)


@R.add('scrap-heap', '고철 더미(부서진 톱니·관·철판)', 2, 1, 'debris', tags=['고철', '공장 마당', '공방'], rules='공장 마당 구석·공방 뒤. 길·문 앞을 막지 않는다.')
def _(c):
    def pile(X, Y, dx, dy, d):
        k = rnd(X // 2, Y // 2, 23)
        m = 'iron' if k < 0.55 else 'copper' if k < 0.75 else 'soot'
        t = 4 if dy < -0.3 else 3 if dy < 0.3 else 1
        if m == 'copper': t = min(t, 4)
        return (m, t if rnd(X, Y, 3) > 0.15 else t - 1)
    c.ell(16, 10, 15, 6, pile)
    gear(c, 10, 6, 3, 7, 'brass')
    c.R(18, 4, 9, 2, 'copper', 3); c.HL(18, 4, 9, 'copper', 5); c.HL(18, 6, 9, 'ink', 1)
    c.line(22, 12, 29, 7, 'iron', 5)
    c.HL(3, 15, 26, 'ink', 1)


# ── 압력 탱크 3×2 ──
@R.add('boiler-tank', '누운 압력 탱크(리벳 철판, 돌 받침 위, 압력계·맨홀)', 3, 2, 'round_body', tags=['탱크', '보일러', '공장 마당'],
       rules='보일러실·공장 옆 마당. 배관 끝에 붙이면 좋다. 둘레 1칸 비움.')
def _(c):
    for x in (6, 34): box3(c, x, 20, 8, 4, 6, 'stone', tt=5, ft=3); c.HL(x, 30, 8, 'ink', 1)
    # 몸(누운 원통): 위 넓게 밝고 아래로 어둡다
    for j in range(20):
        u = (j + 0.5) / 20
        t = 4 if u < 0.15 else 5 if u < 0.35 else 4 if u < 0.5 else 3 if u < 0.7 else 2 if u < 0.88 else 1
        c.HL(4, 4 + j, 40, 'iron', t)
    # 둥근 끝(서·동)
    for (ex, s) in ((4, -1), (43, 1)):
        c.ell(ex, 14, 3, 10, lambda X, Y, dx, dy, d, s=s: ('iron', 3 if s < 0 else 1) if dx * s > 0 else None)
    for x in (12, 24, 36): rivets(c, x, 5, 1, 18, 3, axis='v')
    c.HL(4, 3, 40, 'ink', 1); c.HL(4, 24, 40, 'ink', 1)
    # 맨홀(윗면 원판) + 압력계(놋쇠) + 안전밸브
    disc(c, 18, 8, 4, 2, 'iron', 5, band=1, bt=2)
    disc(c, 32, 6, 2.5, 1.4, 'brass', 4, band=3, bt=2)
    c.R(31, 1, 3, 4, 'brass', 3); c.P(31, 0, 'brass', 5)
    c.ell(40, 13, 3, 3, lambda X, Y, dx, dy, d: ('brass', 4) if d > 0.5 else ('canvas', 3))


# ── 가스 저장탑 4×4 ──
@R.add('gasometer', '가스 저장탑(무쇠 기둥 틀 안의 둥근 저장통, 위 뚜껑이 보인다)', 4, 4, 'structure', tags=['가스', '공장', '랜드마크'],
       rules='공장 지대 뒤편·선로 너머. 둘레 1칸 석탄재 마당, 철 울타리로 두르면 좋다.')
def _(c):
    cx = 32
    # 뒤 기둥 넷(뚜껑 뒤로 보이는 틀)
    for x in (6, 22, 40, 56): c.R(x, 0, 3, 18, 'iron', 2); c.VL(x, 0, 18, 'iron', 4)
    c.HL(4, 1, 56, 'iron', 4); c.HL(4, 2, 56, 'iron', 2)
    # 저장통 몸
    for j in range(14, 58):
        for i in range(4, 60):
            u = (i - 4 + 0.5) / 56
            t = 3 if u < 0.2 else 4 if u < 0.38 else 3 if u < 0.6 else 2 if u < 0.85 else 1
            if (j - 14) % 11 == 10: t = max(0, t - 2)
            c.P(i, j, 'slate', t)
    for y in (24, 35, 46): rivets(c, 6, y - 2, 52, 1, 5, 'slate', 5, 1)
    c.VL(3, 14, 44, 'ink', 1); c.VL(60, 14, 44, 'ink', 1)
    # 뚜껑(넓은 타원 윗면 — 낮은 돔, 가운데 밝게) + 테
    def lid(X, Y, dx, dy, d):
        if d > 0.88: return ('iron', 4 if dx < 0 else 2)
        k = dx + dy
        return ('slate', 5 if k < -0.6 else 4 if k < 0 else 3 if k < 0.6 else 2)
    c.ell(cx, 15, 28, 12, lid)
    for a in range(16):
        ang = a * math.pi / 8
        c.line(cx, 15, round(cx + 25 * math.cos(ang)), round(15 + 10.5 * math.sin(ang)), 'slate', 2 if a % 2 else 3)
    disc(c, cx, 15, 4, 2, 'iron', 5, band=2, bt=2)
    c.ell(cx, 15, 28, 12, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.95 and dy < 0 else None)
    # 앞 기둥 둘(통 앞) + 가로대 + 가새
    for x in (12, 49):
        c.R(x, 6, 4, 56, 'iron', 3); c.VL(x, 6, 56, 'iron', 5); c.VL(x + 3, 6, 56, 'iron', 1)
        disc(c, x + 2, 6, 3, 1.4, 'iron', 6, band=1, bt=3, rim=False)
    c.HL(12, 30, 41, 'iron', 4); c.HL(12, 31, 41, 'iron', 1)
    # 받침(돌 테) + 먹 선
    c.R(1, 58, 62, 5, 'stone', 3); c.HL(1, 58, 62, 'stone', 5); c.HL(1, 63, 62, 'ink', 1)


# ── 신호기 1×3 · 차막이 1×2 ──
@R.add('rail-signal', '선로 신호기(날개 신호 + 등, 무쇠 기둥)', 1, 3, 'column', tags=['신호기', '선로', '역'], rules='선로 바로 북쪽 줄(승강장 끝·선로 옆). 선로 칸 위에는 두지 않는다.')
def _(c):
    post(c, 7, 6, 43)
    disc(c, 8, 5, 4, 2.4, 'iron', 5, band=2, bt=2)
    c.R(9, 10, 7, 3, 'cloth', 3); c.HL(9, 10, 7, 'cloth', 4); c.R(13, 10, 2, 3, 'canvas', 3)
    c.ell(6, 15, 2.4, 2.4, lambda X, Y, dx, dy, d: ('iron', 2) if d > 0.5 else ('verd', 4))
    c.R(5, 20, 6, 2, 'iron', 4); c.HL(5, 22, 6, 'iron', 1)
    for y in range(24, 40, 3): c.HL(5, y, 2, 'iron', 4)
    round_base(c, 8, 42, 12)


@R.add('buffer-stop', '선로 끝 차막이(나무 들보 + 빨강 완충기, 동서 선로 두 줄을 막는다)', 1, 2, 'box', tags=['차막이', '선로', '측선'],
       rules='측선·막다른 선로 끝 칸(rail-n·rail-s 두 줄 위). 선로 가운데에는 두지 않는다.')
def _(c):
    # 윗면: 돌 받침 위 나무 들보(남북으로 길게) — 위에서 보인다
    box3(c, 2, 4, 12, 20, 6, 'stone', tt=4, ft=2)
    c.R(4, 6, 8, 16, 'wood', 4); c.VL(4, 6, 16, 'wood', 5); c.VL(11, 6, 16, 'wood', 2); c.HL(4, 6, 8, 'wood', 2)
    for y in (8, 23): c.R(3, y - 3, 10, 2, 'iron', 4)
    # 완충기 둘(동쪽으로 튀어나온 빨강 원판)
    for y in (9, 20):
        c.R(12, y, 3, 3, 'iron', 3); c.ell(14.5, y + 1.5, 1.5, 2.5, lambda X, Y, dx, dy, d: ('cloth', 3 if dy < 0 else 2))
    c.HL(2, 31, 12, 'ink', 1)


# ── 부두 소품 ──
@R.add('bollard', '계선주(무쇠 버섯 머리)', 1, 1, 'column', tags=['계선주', '부두', '운하'], rules='운하 둑·부두 끝 줄, 4~6칸 간격. 바지선 맨 곳 옆.')
def _(c):
    c.R(5, 7, 6, 6, 'iron', 3); c.VL(5, 7, 6, 'iron', 5); c.VL(10, 7, 6, 'iron', 1)
    disc(c, 8, 5.5, 5.4, 3.4, 'iron', 5, band=2, bt=2)
    disc(c, 8, 13, 6, 2, 'iron', 3, band=1, bt=1, rim=False)
    c.HL(2, 15, 12, 'ink', 1)


@R.add('rope-coil', '밧줄 사리(둥글게 감긴 굵은 밧줄)', 1, 1, 'flat', tags=['밧줄', '부두'], rules='계선주·부두 판자 위에 하나씩.')
def _(c):
    for k, r in enumerate((6.5, 5, 3.6, 2.2)):
        c.ell(8, 8.5, r, r * 0.7, lambda X, Y, dx, dy, d, k=k: ('canvas', 3 if dx + dy < -0.3 else 2) if d > 0.55 else None)
    c.ell(8, 8.5, 1, 0.8, lambda X, Y, dx, dy, d: ('wood', 1))
    c.line(13, 10, 15, 13, 'canvas', 2)


@R.add('chimney', '독립 공장 굴뚝(그을린 벽돌 원통, 돌 받침)', 1, 5, 'column', tags=['굴뚝', '공장', '랜드마크'],
       rules='공장 마당 모퉁이·보일러실 옆. 꼭대기에 stack-smoke 를 겹쳐 찍어 연기를 낸다(이 조각 맨 위 칸 = stack-smoke 왼쪽 아래 칸).')
def _(c):
    import buildings as BD
    c.paste(BD.cell('stack.top'), 0, 0)
    for k in range(1, 4): c.paste(BD.cell('stack.mid'), 0, k * 16)
    box3(c, 1, 62, 14, 6, 12, 'stone', tt=5, ft=3)
    c.HL(1, 79, 14, 'ink', 1)
    c.F(3, 64, 10, 1, lambda wx, wy, i, j: ('soot', 1))


@R.add('standpipe', '급수 기둥(기관차 물 넣는 무쇠 기둥 + 팔)', 1, 3, 'column', tags=['급수', '선로', '역'], rules='선로 바로 북쪽 줄, 승강장 끝. 팔이 선로 쪽(남).')
def _(c):
    post(c, 6, 10, 43, w=4)
    disc(c, 8, 9, 4.6, 2.6, 'iron', 5, band=2, bt=2)
    c.R(9, 12, 7, 3, 'iron', 3); c.HL(9, 12, 7, 'iron', 5); c.R(13, 15, 3, 8, 'canvas', 1); c.R(13, 23, 3, 2, 'iron', 4)
    c.ell(5, 26, 3.5, 3.5, lambda X, Y, dx, dy, d: ('cloth', 3) if d > 0.5 else ('iron', 2))
    round_base(c, 8, 42, 14)


@R.add('hydrant', '소화전(빨강 무쇠, 둥근 머리)', 1, 1, 'column', tags=['소화전', '거리'], rules='보도 바깥 줄, 교차로 모퉁이.')
def _(c):
    c.R(5, 6, 6, 7, 'cloth', 2); c.VL(5, 6, 7, 'cloth', 3); c.VL(10, 6, 7, 'cloth', 1)
    c.R(3, 8, 2, 3, 'brass', 3); c.R(11, 8, 2, 3, 'brass', 2)
    disc(c, 8, 5, 4, 2.6, 'cloth', 3, band=2, bt=1); c.P(7, 4, 'brass', 4)
    disc(c, 8, 13, 5, 1.8, 'iron', 4, band=1, bt=2, rim=False)
    c.HL(3, 15, 10, 'ink', 1)


# ── 문형 기중기 5×5 ──
@R.add('gantry-crane', '문형 기중기(무쇠 다리 둘 + 리벳 들보 + 도르래 수레·갈고리)', 5, 5, 'frame', tags=['기중기', '선로', '창고', '공장 마당'],
       rules='측선·화물 하역장을 가로질러(다리 칸 = 맨 아래 줄 양 끝 칸, 그 사이는 지나간다). 다리 아래 줄 가운데 칸은 비운다.')
def _(c):
    # 들보(윗면 8행 — 리벳 줄 + 레일, 앞면 7행)
    box3(c, 0, 6, 80, 8, 7, 'iron', tt=4, ft=2)
    rivets(c, 2, 8, 76, 1, 4, 'iron', 6, 1); rivets(c, 2, 16, 76, 1, 4, 'iron', 5, 0)
    c.HL(0, 10, 80, 'iron', 2); c.HL(0, 12, 80, 'iron', 2)
    c.HL(0, 5, 80, 'ink', 1); c.HL(0, 21, 80, 'ink', 1); c.VL(0, 5, 17, 'ink', 1); c.VL(79, 5, 17, 'ink', 1)
    for x in range(6, 76, 10): c.VL(x, 14, 7, 'iron', 3)
    # 다리(양 끝, 사다리꼴 + 가새) — 맨 아래 줄 칸에 선다
    for x0 in (2, 64):
        for y in range(22, 78):
            w = 10 + (y - 22) // 8
            xs = x0 - (w - 10) // 2
            for i in range(w):
                u = (i + 0.5) / w
                c.P(xs + i, y, 'iron', 4 if u < 0.25 else 3 if u < 0.6 else 2)
            c.P(xs - 1, y, 'ink', 1); c.P(xs + w, y, 'ink', 1)
        for y in range(28, 74, 12): c.line(x0 + 1, y, x0 + 9, y + 10, 'iron', 1); c.line(x0 + 9, y, x0 + 1, y + 10, 'iron', 1)
        box3(c, x0 - 4, 74, 18, 3, 2, 'stone', tt=5); c.HL(x0 - 4, 79, 18, 'ink', 1)
    # 수레(들보 위, 윗면 보이는 상자) + 도르래 + 사슬 + 갈고리 + 매단 상자
    box3(c, 30, 2, 16, 6, 6, 'brass', tt=4, ft=2); c.HL(30, 1, 16, 'ink', 1)
    c.ell(38, 4.5, 3, 1.6, lambda X, Y, dx, dy, d: ('iron', 2))
    for x in (36, 40):
        for y in range(22, 46): c.P(x, y, 'iron', 4 if y % 2 else 2)
    c.ell(38, 47, 3, 2, lambda X, Y, dx, dy, d: ('iron', 4) if d > 0.4 else None)
    box3(c, 30, 49, 16, 5, 8, 'wood', tt=5, ft=2); c.HL(30, 62, 16, 'ink', 1)
    c.line(31, 55, 44, 61, 'wood', 3)


# ── 부두 기중기 3×4 ──
@R.add('jib-crane', '부두 증기 기중기(돌 받침 + 운전실 + 비스듬한 격자 팔·갈고리)', 3, 4, 'structure', tags=['기중기', '부두', '운하'],
       rules='운하 북쪽 둑(quay 바로 위 줄 포석)에 받침 칸이 오게. 팔이 물 쪽(남·동)을 향한다. 하역장 상자 옆.')
def _(c):
    # 받침 돌(윗면 7 + 앞 6)
    box3(c, 2, 49, 26, 7, 7, 'stone', tt=5, ft=3); c.HL(2, 63, 26, 'ink', 1)
    # 운전실(지붕 윗면 7행 + 앞면 — 창 불빛, 굴뚝)
    box3(c, 4, 26, 22, 7, 16, 'slate', tt=4, ft=2, fmat='brick')
    c.F(4, 33, 22, 16, lambda wx, wy, i, j: tex_brick(i, j + 33, base=3, mat='brick', s=8))
    c.R(8, 36, 6, 6, 'lit', 3); c.R(9, 37, 4, 2, 'lit', 4); c.R(17, 36, 6, 12, 'wood', 2)
    c.VL(3, 26, 23, 'ink', 1); c.VL(26, 26, 23, 'ink', 1); c.HL(4, 25, 22, 'ink', 1)
    cyl_v(c, 7, 17, 5, 10, 3, 'iron', base=3); c.ell(9.5, 18.5, 2.5, 1.5, lambda X, Y, dx, dy, d: ('coal', 0))
    # 격자 팔(운전실에서 동쪽 위로)
    for (ax, ay, bx, by) in ((22, 30, 46, 2), (25, 34, 47, 6)):
        c.line(ax, ay, bx, by, 'iron', 4); c.line(ax + 1, ay, bx + 1, by, 'iron', 2)
    for k in range(6):
        t = k / 6
        x1 = round(22 + 24 * t); y1 = round(30 - 28 * t); x2 = round(25 + 22 * (t + 1 / 12)); y2 = round(34 - 28 * (t + 1 / 12))
        c.line(x1, y1, x2, y2, 'iron', 3)
    disc(c, 46, 3, 2.4, 1.6, 'brass', 4, band=1, bt=2, rim=False)
    # 줄 + 갈고리
    c.VL(46, 5, 30, 'canvas', 1)
    c.ell(46, 36, 2, 2, lambda X, Y, dx, dy, d: ('iron', 4) if d > 0.35 else None)


# ── 비행선 계류탑 2×6 ──
@R.add('mooring-mast', '비행선 계류탑(무쇠 격자탑 + 꼭대기 원판 발판 + 놋쇠 계류 원뿔)', 2, 6, 'column', tags=['비행선', '계류탑', '부두', '랜드마크'],
       rules='비행선 정박장 서쪽 끝(airship-docked 바로 서쪽 칸). 맨 아래 줄 받침 둘레 1칸 비움.')
def _(c):
    # 탑(아래 넓고 위 좁은 격자)
    for y in range(14, 88):
        t = (y - 14) / 74
        hw = 4 + t * 9
        x0, x1 = round(16 - hw), round(16 + hw)
        c.P(x0, y, 'iron', 4); c.P(x0 + 1, y, 'iron', 3); c.P(x1 - 1, y, 'iron', 2); c.P(x1, y, 'iron', 1)
    for y in range(18, 86, 8):
        t = (y - 14) / 74; hw = 4 + t * 9
        t2 = (y + 8 - 14) / 74; hw2 = 4 + t2 * 9
        c.line(round(16 - hw), y, round(16 + hw2), y + 8, 'iron', 2); c.line(round(16 + hw), y, round(16 - hw2), y + 8, 'iron', 2)
        c.HL(round(16 - hw), y, round(2 * hw) + 1, 'iron', 4)
    # 계단(가운데 세로)
    for y in range(20, 86, 3): c.HL(15, y, 3, 'wood', 3)
    # 꼭대기 발판(위에서 본 원판 + 난간) + 계류 원뿔
    disc(c, 16, 14, 14, 5, 'iron', 4, band=3, bt=2)
    c.ell(16, 14, 14, 5, lambda X, Y, dx, dy, d: ('iron', 6) if 0.72 < d < 0.86 else None)
    c.poly([(11, 13), (21, 13), (16, 1)], lambda x, y: ('brass', 4 if x < 16 else 2))
    c.ell(16, 12, 5, 2, lambda X, Y, dx, dy, d: ('brass', 3))
    c.P(15, 0, 'brass', 5)
    # 받침(돌, 윗면 5)
    box3(c, 1, 86, 30, 5, 4, 'stone', tt=5, ft=3); c.HL(1, 95, 30, 'ink', 1)


# ── 정박한 비행선 8×5 ──
@R.add('airship-docked', '정박한 비행선(가죽 기낭 + 놋쇠 늑골 + 꼬리 날개, 곤돌라가 나무 받침대 위에 내려앉았다)', 8, 5, 'structure',
       tags=['비행선', '부두', '정박장', '랜드마크'],
       rules='정박장(판자·포석 마당 8×5 이상) 위, 서쪽 끝에 mooring-mast. 곤돌라 문(남쪽 가운데) 앞 1칸은 비워 길로 잇는다. 공중에 띄우지 않는다.')
def _(c):
    W = 128
    # 나무 받침대 넷(땅에 선다) — 먼저
    for x in (34, 50, 76, 92):
        box3(c, x, 66, 8, 4, 8, 'wood', tt=5, ft=2); c.HL(x, 78, 8, 'ink', 1)
    # 곤돌라(윗면 보이는 긴 배 모양 상자: 지붕 6 + 앞면 14)
    box3(c, 30, 44, 72, 6, 16, 'wood', tt=4, ft=2, fmat='navy')
    for x in range(36, 98, 8):
        lit = (x // 8) % 3 != 1
        c.R(x, 53, 5, 5, 'lit' if lit else 'glass', 3 if lit else 2)
    c.R(62, 52, 8, 14, 'wood', 2); c.VL(66, 52, 14, 'wood', 1); c.R(63, 53, 6, 4, 'glass', 2)       # 문(남쪽 가운데)
    c.HL(30, 60, 72, 'brass', 4); c.HL(30, 61, 72, 'brass', 2)
    rivets(c, 32, 63, 68, 1, 4, 'navy', 3, 0)
    c.VL(29, 44, 22, 'ink', 1); c.VL(102, 44, 22, 'ink', 1); c.HL(30, 66, 72, 'ink', 1)
    # 매단 줄(기낭 → 곤돌라)
    for x in (36, 52, 80, 96): c.line(x, 36, x - 2 if x < 64 else x + 2, 44, 'canvas', 1)
    # 기낭(긴 타원, 위에서 비스듬히 — 윗면 넓게 밝고 아래 그늘), 가로 이음 띠 + 놋쇠 늑골
    cx, cy, rx, ry = 62, 22, 58, 18
    def bag(X, Y, dx, dy, d):
        k = dy - 0.15 * dx
        t = 3 if k < -0.55 else 3 if k < -0.2 else 2 if k < 0.25 else 1 if k < 0.6 else 0
        if k < -0.55 and dx < 0.2: t = 3
        if (Y - cy) % 6 == 0 and abs(dy) < 0.85: t = max(0, t - 1)
        return ('canvas', t)
    c.ell(cx, cy, rx, ry, bag)
    for k in range(-4, 5):
        bx = cx + k * 12
        for y in range(4, 41):
            dx = (bx + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 0.98:
                c.P(bx, y, 'brass', 3 if dy < -0.3 else 2 if dy < 0.3 else 1)
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.94 else None)
    # 꼬리 날개(동쪽 끝: 위·아래 지느러미 + 옆 날개)
    c.poly([(108, 14), (124, 4), (127, 6), (117, 20)], lambda x, y: ('cloth', 3))
    c.poly([(108, 30), (124, 40), (127, 38), (117, 24)], lambda x, y: ('cloth', 2))
    c.poly([(110, 21), (127, 20), (127, 25), (110, 24)], lambda x, y: ('cloth', 3))
    c.line(108, 14, 124, 4, 'ink', 1); c.line(124, 40, 108, 30, 'ink', 1)
    # 앞(서쪽) 코 놋쇠 고리(계류탑에 물린다) + 프로펠러(곤돌라 동쪽 끝)
    c.ell(5, 22, 3, 4, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2))
    c.line(0, 22, 4, 22, 'iron', 3)
    c.R(103, 48, 4, 3, 'iron', 3)
    for (dy, dx) in ((-7, 0), (7, 0)): c.line(108, 49, 108 + dx, 49 + dy, 'wood', 3)
    disc(c, 108, 49, 1.6, 1.6, 'brass', 4, band=0, rim=False)


# ── 정류장 지붕 3×2 ──
@R.add('tram-shelter', '전차 정류장 지붕(무쇠 기둥 + 유리 지붕 + 벤치)', 3, 2, 'structure', tags=['정류장', '전차', '거리'],
       rules='궤도 옆 보도(연석 바로 위 줄). 지붕 아래 벤치 앞 1칸은 비워 둔다.')
def _(c):
    # 기둥 넷(뒤 둘은 지붕에 가려)
    for x in (3, 43): c.R(x, 10, 2, 21, 'iron', 3); c.VL(x, 10, 21, 'iron', 5)
    # 벤치(뒤 벽 앞)
    c.R(6, 20, 36, 3, 'wood', 4); c.HL(6, 20, 36, 'wood', 5); c.R(6, 23, 36, 2, 'wood', 2)
    for x in (8, 39): c.R(x, 25, 2, 5, 'iron', 2)
    # 지붕(유리 + 무쇠 살, 윗면 11행) + 앞 처마 장식
    c.R(1, 2, 46, 11, 'glass', 3)
    for j in range(2, 13): c.HL(1, j, 46, 'glass', 4 if j < 4 else 3 if j < 9 else 2)
    for x in range(1, 47, 6): c.VL(x, 2, 11, 'iron', 4)
    c.HL(1, 1, 46, 'ink', 1); c.HL(1, 2, 46, 'iron', 3)
    c.HL(0, 13, 48, 'iron', 5); c.HL(0, 14, 48, 'iron', 2)
    for x in range(1, 47, 4): c.P(x, 15, 'iron', 2); c.P(x + 1, 16, 'iron', 1)
    c.VL(0, 1, 15, 'ink', 1); c.VL(47, 1, 15, 'ink', 1)
    c.HL(2, 31, 44, 'ink', 1)



# ═══════════════════════ 다시 그림(관문 판정: 둥근 몸의 가로 경계는 타원 호, 위 끝은 위에서 본 면) ═══════════════════════
def redraw(id_, name=None, kind=None):
    def deco(fn):
        it = R.by[id_]; it['draw'] = fn
        if name: it['name'] = name
        if kind: it['kind'] = kind
        return fn
    return deco


def arc(c, cx, y, rx, ry, mat, t, th=1):
    """원통 앞면을 두르는 가로 띠(웃는 호): 가운데가 ry 만큼 아래로 처진다."""
    for x in range(int(cx - rx), int(cx + rx) + 1):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        yy = y + ry * math.sqrt(max(0.0, 1 - dx * dx))
        for k in range(th):
            tt = t if isinstance(t, int) else t(dx)
            c.P(x, round(yy) + k, mat, tt)


def vcyl(c, cx, y0, y1, rx, ry, mat, base, top=None, topmat=None, ink=True):
    """세운 원통: 위 뚜껑 타원(밝은 윗면 — 왼쪽 위 더 밝게, 뒤 가장자리 먹) + 몸(왼쪽 밝게) + 밑 호(먹)."""
    for y in range(int(y0), int(y1 + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) > 1: continue
            yb = y1 + ry * math.sqrt(max(0.0, 1 - dx * dx))
            if y > yb: continue
            u = (dx + 1) / 2
            t = base + (1 if u < 0.3 else 0 if u < 0.62 else -1 if u < 0.86 else -2)
            if u < 0.12: t = base
            c.P(x, y, mat, t)
    if ink: arc(c, cx, y1 + 1, rx, ry, 'ink', 1)
    tm = topmat or mat
    tt = (base + 2) if top is None else top
    c.ell(cx, y0, rx, ry, lambda X, Y, dx, dy, d: (tm, tt + (1 if dx + dy < -0.6 else 0) - (1 if dy > 0.55 else 0)))
    c.ell(cx, y0, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.8 and dy < -0.1 else None)


@redraw('clock-post')
def _(c):
    post(c, 7, 24, 42)
    arc(c, 8, 32, 2, 1, 'iron', 5)
    # 시계 상자: 넓은 돌 갓 윗면(6행, 뒤 테 어둡게) + 작은 녹청 꼭지 + 앞면 시계판
    box3(c, 1, 2, 14, 6, 15, 'iron', tt=5, ft=2)
    c.HL(1, 1, 14, 'ink', 1)
    c.R(3, 3, 10, 3, 'verd', 3); c.HL(3, 3, 10, 'verd', 2); c.HL(3, 5, 10, 'verd', 4)
    disc(c, 8, 4, 2, 1.2, 'brass', 4, band=1, bt=2, rim=False)
    c.ell(8, 15.5, 5, 5, lambda X, Y, dx, dy, d: ('brass', 4 if dx + dy < 0 else 2) if d > 0.6 else ('canvas', 3))
    c.line(7, 15, 7, 12, 'ink', 1); c.line(7, 15, 10, 16, 'ink', 1)
    c.HL(1, 23, 14, 'ink', 1)
    disc(c, 8, 42, 6.5, 3.2, 'iron', 5, band=3, bt=2)


@redraw('pillar-box', name='빨강 무쇠 우체통(둥근 기둥, 넓은 둥근 뚜껑이 위에서 보인다)')
def _(c):
    vcyl(c, 8, 12, 26, 5.5, 2.6, 'cloth', 2, top=3)
    arc(c, 8, 14, 5.5, 2.6, 'cloth', 1)
    disc(c, 8, 9, 6.6, 3.6, 'cloth', 3, band=2, bt=1)                       # 넓은 뚜껑(위에서 보인다)
    c.ell(8, 8.4, 2.4, 1.3, lambda X, Y, dx, dy, d: ('cloth', 3 if dx < 0 else 2)); c.P(7, 7, 'brass', 4)
    arc(c, 8, 13, 4, 1.4, 'ink', 0, th=2)                                      # 투입구(호)
    arc(c, 8, 19, 2.6, 1, 'brass', lambda dx: 4 if dx < 0 else 2, th=3)       # 놋쇠 판
    arc(c, 8, 25, 5.5, 2.6, 'cloth', 1)
    disc(c, 8, 29, 7, 2.4, 'cloth', 2, band=1, bt=1)


@redraw('poster-column', name='둥근 광고탑(빛바랜 포스터 — 글자 없음, 녹청 갓)')
def _(c):
    vcyl(c, 8, 10, 26, 6, 2.6, 'stone', 3, top=4)
    for (y, x0, x1, m) in ((13, 2, 8, 'cloth'), (13, 8, 14, 'canvas'), (19, 3, 9, 'navy'), (19, 9, 14, 'brass')):
        for x in range(x0, x1):
            dx = (x + 0.5 - 8) / 6
            if abs(dx) >= 1: continue
            off = 2.6 * math.sqrt(1 - dx * dx)
            for j in range(5):
                c.P(x, round(y + off) + j, m, 2 if dx > 0.4 else 3)
    disc(c, 8, 9, 7.4, 3.8, 'verd', 3, band=2, bt=1)                           # 넓은 갓(윗면)
    c.ell(8, 8.2, 3.6, 1.8, lambda X, Y, dx, dy, d: ('verd', 4 if dx < 0 else 2))
    c.P(7, 6, 'brass', 4); c.P(8, 6, 'brass', 2)
    disc(c, 8, 29, 7.4, 2.4, 'stone', 4, band=1, bt=2)


@redraw('planter', name='무쇠 화분(둥근 통, 흙과 다듬은 관목이 위에서 보인다)')
def _(c):
    vcyl(c, 8, 7, 12, 7, 3.6, 'iron', 3, top=5)
    c.ell(8, 7, 5.6, 2.6, lambda X, Y, dx, dy, d: ('soot', 1 if dy < 0 else 2))       # 흙(아가리 안)
    c.ell(8, 7, 5.6, 2.6, lambda X, Y, dx, dy, d: ('iron', 2) if dy < -0.55 else None)
    def leaf(X, Y, dx, dy, d):
        k = rnd(X, Y, 5)
        return ('moss', (3 if dx + dy < -0.4 else 2) + (1 if k > 0.85 else 0))
    c.ell(7.5, 4.6, 3.4, 2.8, leaf)
    arc(c, 8, 10, 7, 3.6, 'brass', lambda dx: 4 if dx < 0 else 2)


@redraw('sacks', kind='other', name='곡물·석탄 자루 더미(위에서 본 불룩한 자루 셋)')
def _(c):
    def sack(x, y, w, h, fh=3):
        # 누운 자루: 윗면(불룩한 등, 밝게 — 위 2/3) + 앞면 그늘(아래 fh 행) + 묶은 목(동쪽)
        for j in range(h):
            for i in range(w):
                cx = (i + 0.5) / w * 2 - 1; cy = (j + 0.5) / h * 2 - 1
                if cx ** 4 + cy ** 4 > 1: continue
                if j >= h - fh: t = 1
                else: t = 3 if (cx + cy) < -0.5 else 2
                c.P(x + i, y + j, 'canvas', t)
        c.HL(x + 1, y, w - 2, 'ink', 1)
        c.R(x + w, y + h // 2 - 2, 2, 2, 'canvas', 2); c.P(x + w + 1, y + h // 2 - 3, 'canvas', 3)
        c.HL(x + 1, y + h, w - 2, 'ink', 1)
    sack(3, 1, 8, 7); sack(0, 6, 7, 8); sack(7, 7, 7, 8)


@redraw('boiler-tank', kind='other', name='누운 압력 탱크(리벳 철판 원통 — 위가 넓게 보인다, 돌 받침·맨홀·압력계)')
def _(c):
    for x in (6, 34): box3(c, x, 14, 8, 6, 10, 'stone', tt=5, ft=3); c.HL(x, 30, 8, 'ink', 1)
    # 원통 윗면(위에서 비스듬히: 위 2/3 이 넓은 윗면, 아래 1/3 앞면 그늘)
    for j in range(22):
        u = (j + 0.5) / 22
        t = 2 if u < 0.08 else 4 if u < 0.25 else 5 if u < 0.45 else 4 if u < 0.65 else 2 if u < 0.85 else 1
        c.HL(4, 2 + j, 40, 'iron', t)
    for (ex, s) in ((4, -1), (43, 1)):
        c.ell(ex, 13, 3, 11, lambda X, Y, dx, dy, d, s=s: ('iron', 3 if s < 0 else 1) if dx * s > 0 else None)
    for x in (12, 24, 36):
        for y in range(3, 24, 3): c.P(x, y, 'iron', 6 if y < 15 else 3)
    c.HL(4, 1, 40, 'ink', 1); c.HL(4, 24, 40, 'ink', 1)
    disc(c, 18, 9, 4.6, 2.6, 'iron', 5, band=2, bt=2)                        # 맨홀(윗면)
    disc(c, 31, 8, 3, 1.8, 'brass', 4, band=3, bt=2)                         # 압력계 받침
    c.ell(31, 4.5, 2.6, 1.6, lambda X, Y, dx, dy, d: ('brass', 4) if d > 0.5 else ('canvas', 3))
    disc(c, 39, 9, 2, 1.2, 'cloth', 3, band=2, bt=1)                          # 안전밸브


@redraw('rail-signal')
def _(c):
    post(c, 7, 8, 42)
    disc(c, 8, 6, 5, 3, 'iron', 5, band=2, bt=2)                              # 꼭대기 갓(윗면)
    c.R(9, 11, 7, 2, 'cloth', 4); c.R(9, 13, 7, 1, 'cloth', 2); c.R(13, 11, 2, 3, 'canvas', 3)   # 날개(윗면 2 + 앞 1)
    c.ell(5.5, 16, 2.4, 2.4, lambda X, Y, dx, dy, d: ('iron', 2) if d > 0.5 else ('verd', 4))
    disc(c, 8, 21, 3.4, 1.6, 'iron', 4, band=1, bt=2, rim=False)              # 사다리 발판 테
    for y in range(24, 40, 3): c.HL(5, y, 2, 'iron', 4)
    disc(c, 8, 42, 6.5, 3.2, 'iron', 5, band=3, bt=2)


@redraw('bollard')
def _(c):
    c.R(5, 8, 6, 5, 'iron', 3); c.VL(5, 8, 5, 'iron', 5); c.VL(10, 8, 5, 'iron', 1)
    disc(c, 8, 6, 6.2, 4.4, 'iron', 5, band=2, bt=2)
    c.ell(8, 5.4, 2.6, 1.6, lambda X, Y, dx, dy, d: ('iron', 6))
    disc(c, 8, 13, 6.6, 2.2, 'iron', 3, band=1, bt=1, rim=False)


@redraw('standpipe')
def _(c):
    post(c, 6, 12, 42, w=4)
    disc(c, 8, 10, 5.6, 3.4, 'iron', 5, band=2, bt=2)                        # 머리(윗면)
    c.R(9, 13, 7, 2, 'iron', 5); c.HL(9, 15, 7, 'iron', 2)                     # 팔(윗면 2 + 앞 1)
    c.R(13, 16, 3, 8, 'canvas', 1); disc(c, 14.5, 24, 1.8, 1, 'iron', 4, band=1, bt=2, rim=False)
    c.ell(4, 27, 3.4, 2, lambda X, Y, dx, dy, d: ('cloth', 3 if dx < 0 else 2) if d > 0.45 else ('iron', 2))   # 손바퀴(위에서 비스듬히)
    disc(c, 8, 42, 7, 3.2, 'iron', 5, band=3, bt=2)


@redraw('gantry-crane')
def _(c):
    # 들보: 넓은 윗면 통로(10행 — 판자 깔판 + 양쪽 난간 레일, 뒤 가장자리 어둡게) + 앞면 리벳 판(6행)
    c.HL(0, 3, 80, 'ink', 1)
    c.R(0, 4, 80, 10, 'iron', 5); c.HL(0, 4, 80, 'iron', 3); c.HL(0, 13, 80, 'iron', 6)
    c.R(2, 6, 76, 6, 'wood', 4)
    for x in range(2, 78, 4): c.VL(x, 6, 6, 'wood', 3)
    c.HL(2, 6, 76, 'wood', 2)
    c.HL(0, 5, 80, 'iron', 4)
    c.R(0, 14, 80, 6, 'iron', 2); c.HL(0, 14, 80, 'iron', 1)
    rivets(c, 2, 16, 76, 1, 4, 'iron', 5, 0)
    c.HL(0, 20, 80, 'ink', 1); c.VL(0, 3, 18, 'ink', 1); c.VL(79, 3, 18, 'ink', 1)
    # 다리(양 끝, 아래로 넓어지는 격자 + 돌 받침 윗면)
    for x0 in (2, 64):
        for y in range(21, 74):
            w = 10 + (y - 21) // 8
            xs = x0 - (w - 10) // 2
            for i in range(w):
                u = (i + 0.5) / w
                c.P(xs + i, y, 'iron', 4 if u < 0.25 else 3 if u < 0.6 else 2)
            c.P(xs - 1, y, 'ink', 1); c.P(xs + w, y, 'ink', 1)
        for y in range(26, 70, 12): c.line(x0 + 1, y, x0 + 9, y + 10, 'iron', 1); c.line(x0 + 9, y, x0 + 1, y + 10, 'iron', 1)
        box3(c, x0 - 4, 72, 18, 5, 2, 'stone', tt=5); c.HL(x0 - 4, 79, 18, 'ink', 1)
    # 수레(통로 위 — 윗면 보이는 놋쇠 상자) + 사슬 + 갈고리 + 매단 상자
    box3(c, 30, 2, 16, 7, 5, 'brass', tt=4, ft=2); c.HL(30, 1, 16, 'ink', 1)
    disc(c, 38, 5, 3, 1.6, 'iron', 4, band=1, bt=2, rim=False)
    for x in (36, 40):
        for y in range(21, 46): c.P(x, y, 'iron', 4 if y % 2 else 2)
    c.ell(38, 47, 3, 2, lambda X, Y, dx, dy, d: ('iron', 4) if d > 0.4 else None)
    box3(c, 30, 49, 16, 6, 7, 'wood', tt=5, ft=2); c.HL(30, 62, 16, 'ink', 1)
    c.line(31, 56, 44, 61, 'wood', 3)


@redraw('airship-docked')
def _(c):
    # 나무 받침대 넷(윗면 보이는 상자)
    for x in (34, 50, 76, 92):
        box3(c, x, 64, 8, 5, 9, 'wood', tt=5, ft=2); c.HL(x, 78, 8, 'ink', 1)
    # 곤돌라: 넓은 지붕 윗면(11행 — 판자 + 난간, 뒤 가장자리 어둡게) + 앞면 창 줄 + 문
    c.HL(30, 40, 72, 'ink', 1)
    c.R(30, 41, 72, 11, 'wood', 4); c.HL(30, 41, 72, 'wood', 2); c.HL(30, 51, 72, 'wood', 5)
    for x in range(32, 100, 5): c.VL(x, 42, 9, 'wood', 3)
    c.HL(30, 43, 72, 'brass', 3); c.HL(30, 49, 72, 'brass', 4)
    c.R(30, 52, 72, 12, 'navy', 2); c.HL(30, 52, 72, 'navy', 3)
    for x in range(36, 98, 8):
        if 60 <= x <= 70: continue
        lit = (x // 8) % 3 != 1
        c.R(x, 54, 5, 4, 'lit' if lit else 'glass', 3 if lit else 2)
    c.R(62, 53, 8, 11, 'wood', 2); c.VL(66, 53, 11, 'wood', 1); c.R(63, 54, 6, 3, 'glass', 2)
    c.HL(30, 60, 72, 'brass', 3)
    c.VL(29, 40, 24, 'ink', 1); c.VL(102, 40, 24, 'ink', 1); c.HL(30, 64, 72, 'ink', 1)
    # 매단 줄
    for x in (36, 52, 80, 96): c.line(x, 33, x - 2 if x < 64 else x + 2, 40, 'canvas', 1)
    # 기낭: 위에서 비스듬히 본 긴 몸 — 윗면(위 2/3)이 넓게 밝고, 세로 이음은 타원 호(가운데가 아래로 처진다)
    cx, cy, rx, ry = 62, 19, 58, 17
    def bag(X, Y, dx, dy, d):
        k = dy
        t = 3 if k < -0.35 else 3 if k < 0.1 else 2 if k < 0.45 else 1 if k < 0.75 else 0
        if k < -0.1 and dx < -0.2: t = 3
        return ('canvas', t)
    c.ell(cx, cy, rx, ry, bag)
    for k in (-0.55, 0.0, 0.5):                                            # 세로 이음(동서로 긴 호)
        for x in range(int(cx - rx) + 3, int(cx + rx) - 2):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) >= 0.97: continue
            y = cy + ry * k * math.sqrt(max(0.0, 1 - dx * dx)) + 0.0
            c.P(x, round(y), 'canvas', 1 if k > 0.3 else 2)
    for kx in range(-4, 5):                                                # 놋쇠 늑골(남북 고리 — 웃는 호)
        bx = cx + kx * 12
        dxn = (bx + 0.5 - cx) / rx
        if abs(dxn) >= 0.95: continue
        hh = ry * math.sqrt(1 - dxn * dxn)
        for y in range(int(cy - hh) + 1, int(cy + hh)):
            dy = (y + 0.5 - cy) / hh
            sx = bx + round(2.5 * (1 - dy * dy) * (1 if kx >= 0 else -1) * 0)
            c.P(sx, y, 'brass', 4 if dy < -0.3 else 3 if dy < 0.3 else 1)
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.94 else None)
    # 꼬리 날개: 위 지느러미(윗면이 보이는 판) + 옆 날개 둘(수평 — 위에서 넓게 보인다)
    c.poly([(108, 9), (126, 3), (127, 8), (114, 16)], lambda x, y: ('cloth', 3))
    c.poly([(104, 22), (127, 18), (127, 30), (104, 28)], lambda x, y: ('cloth', 3 if y < 25 else 2))
    c.line(104, 22, 127, 18, 'ink', 1); c.line(104, 28, 127, 30, 'ink', 1); c.line(108, 9, 126, 3, 'ink', 1)
    # 코 놋쇠 고리 + 프로펠러
    c.ell(5, 19, 3, 4, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2)); c.line(0, 19, 4, 19, 'iron', 3)
    c.R(103, 45, 4, 3, 'iron', 3)
    for (dy, dx) in ((-7, 0), (7, 0)): c.line(108, 46, 108 + dx, 46 + dy, 'wood', 3)
    disc(c, 108, 46, 1.6, 1.6, 'brass', 4, band=0, rim=False)


@redraw('tram-shelter', name='전차 정류장 지붕(무쇠 기둥 + 녹청 철판 지붕 + 벤치)')
def _(c):
    for x in (3, 43): c.R(x, 14, 2, 17, 'iron', 3); c.VL(x, 14, 17, 'iron', 5)
    c.R(6, 20, 36, 3, 'wood', 4); c.HL(6, 20, 36, 'wood', 5); c.R(6, 23, 36, 2, 'wood', 2)
    for x in (8, 39): c.R(x, 25, 2, 5, 'iron', 2)
    # 지붕: 앞으로 기운 녹청 골판 윗면(11행 — 뒤 어둡게 → 앞 밝게, 세로 골) + 앞 물받이(2행) + 처마 장식
    c.HL(1, 1, 46, 'ink', 1)
    for j in range(11):
        for x in range(1, 47):
            t = 2 if j < 2 else 3 if j < 6 else 4
            if x % 4 == 0: t -= 1
            c.P(x, 2 + j, 'verd', t)
    c.HL(0, 13, 48, 'copper', 4); c.HL(0, 14, 48, 'copper', 2)
    for x in range(1, 47, 4): c.P(x, 15, 'iron', 2); c.P(x + 1, 16, 'iron', 1)
    c.VL(0, 1, 15, 'ink', 1); c.VL(47, 1, 15, 'ink', 1)
    c.HL(2, 31, 44, 'ink', 1)


# ── 3차 다시 그리기(관문 2차 실패분): 머리 = 위에서 보이는 큰 원통·상자 ──
@redraw('clock-post', name='거리 시계 기둥(무쇠 기둥 + 둥근 시계 북 — 넓은 녹청 뚜껑이 위에서 보인다)')
def _(c):
    post(c, 7, 22, 42)
    vcyl(c, 8, 9, 19, 6.5, 3.2, 'iron', 3, top=5)                                # 시계 북(세운 원통)
    disc(c, 8, 7, 7.6, 4.4, 'verd', 3, band=2, bt=1)                             # 넓은 갓(윗면 9행)
    c.ell(8, 6.2, 3.6, 2.0, lambda X, Y, dx, dy, d: ('verd', 4 if dx < 0 else 2))
    disc(c, 8, 5, 1.4, 1, 'brass', 4, band=1, bt=2, rim=False)
    c.ell(7.5, 15, 3.6, 3.4, lambda X, Y, dx, dy, d: ('brass', 4 if dx + dy < 0 else 2) if d > 0.62 else ('canvas', 3 if dx < 0.3 else 2))
    c.line(7, 15, 7, 13, 'ink', 1); c.line(7, 15, 9, 16, 'ink', 1)
    arc(c, 8, 20, 6.5, 3.2, 'ink', 1)
    disc(c, 8, 41, 6.5, 3.2, 'iron', 5, band=3, bt=2)


@redraw('poster-column', name='둥근 광고탑(빛바랜 포스터 — 글자 없음, 넓은 녹청 돔 뚜껑)')
def _(c):
    vcyl(c, 8, 12, 26, 6, 2.8, 'stone', 3, top=4)
    for (y, x0, x1, m) in ((15, 3, 8, 'cloth'), (15, 8, 13, 'canvas'), (21, 3, 8, 'navy'), (21, 8, 13, 'brass')):
        for x in range(x0, x1):
            dx = (x + 0.5 - 8) / 6
            if abs(dx) >= 0.9: continue
            off = 2.8 * math.sqrt(1 - dx * dx)
            for j in range(4):
                c.P(x, round(y + off) + j, m, 2 if dx > 0.4 else 3)
    disc(c, 8, 10, 7.8, 4.6, 'verd', 3, band=2, bt=1)                            # 넓은 갓(윗면)
    disc(c, 8, 7, 4.4, 2.6, 'verd', 4, band=2, bt=2)                             # 돔(작은 원반 위 원반)
    c.ell(7, 5.6, 1.6, 1, lambda X, Y, dx, dy, d: ('verd', 4))
    disc(c, 8, 3.4, 1.2, 0.9, 'brass', 4, band=1, bt=2, rim=False)
    disc(c, 8, 29, 7.4, 2.4, 'stone', 4, band=1, bt=2)


@redraw('planter', name='무쇠 화분(둥근 통 — 흙이 위에서 넓게 보인다, 뒤쪽에 작은 관목)')
def _(c):
    vcyl(c, 8, 6, 11, 7.2, 4.6, 'iron', 3, top=5)
    c.ell(8, 6, 5.8, 3.4, lambda X, Y, dx, dy, d: ('soot', 1 if dy < -0.3 else 2 if dy < 0.3 else 3))       # 흙(아가리 안)
    c.ell(8, 6, 5.8, 3.4, lambda X, Y, dx, dy, d: ('iron', 1) if dy < -0.6 else None)                       # 안벽 그늘(뒤)
    def leaf(X, Y, dx, dy, d):
        k = rnd(X, Y, 5)
        return ('moss', (3 if dx + dy < -0.4 else 2) + (1 if k > 0.85 else 0))
    c.ell(6, 3.6, 2.6, 2.2, leaf); c.ell(10, 4, 2, 1.8, leaf)
    for (x, y) in ((6, 7), (9, 8), (11, 6)): c.P(x, y, 'moss', 2)
    arc(c, 8, 10, 7.2, 4.6, 'brass', lambda dx: 4 if dx < 0 else 2)


@redraw('rail-signal', name='철도 신호등(무쇠 기둥 + 등 상자 — 넓은 윗면 갓, 빨강·초록 등)')
def _(c):
    post(c, 7, 18, 42)
    box3(c, 2, 3, 12, 6, 10, 'iron', tt=5, ft=2)                                 # 등 상자: 윗면 6행 + 앞면 10행
    c.HL(2, 2, 12, 'ink', 1); c.VL(1, 3, 16, 'ink', 1); c.VL(14, 3, 16, 'ink', 1)
    c.R(4, 4, 8, 3, 'iron', 4); disc(c, 8, 5, 1.6, 1, 'iron', 6, band=1, bt=3, rim=False)   # 갓 위 환기통
    c.ell(5.5, 13, 2, 2, lambda X, Y, dx, dy, d: ('cloth', 4 if dx + dy < 0 else 3) if d < 0.75 else ('iron', 1))
    c.ell(10.5, 13, 2, 2, lambda X, Y, dx, dy, d: ('verd', 3 if dx + dy < 0 else 2) if d < 0.75 else ('iron', 1))
    c.HL(2, 18, 12, 'ink', 1)
    for y in range(24, 40, 3): c.HL(5, y, 2, 'iron', 4)
    disc(c, 8, 41, 6.5, 3.2, 'iron', 5, band=3, bt=2)


@redraw('gantry-crane', name='문형 기중기(위에서 보이는 넓은 들보 통로 + 앞뒤 다리 넷 + 수레·매단 상자)')
def _(c):
    def leg(x, y0, y1, w=8):
        c.R(x, y0, w, y1 - y0, 'iron', 3); c.VL(x, y0, y1 - y0, 'iron', 5); c.VL(x + 1, y0, y1 - y0, 'iron', 4)
        c.VL(x + w - 1, y0, y1 - y0, 'iron', 1); c.VL(x - 1, y0, y1 - y0, 'ink', 1); c.VL(x + w, y0, y1 - y0, 'ink', 1)
        for y in range(y0 + 3, y1 - 3, 8): c.line(x + 1, y, x + w - 2, y + 6, 'iron', 2)
    def foot(x, y, w=12):
        box3(c, x, y, w, 4, 3, 'stone', tt=5); c.HL(x, y + 7, w, 'ink', 1)
    # 뒤 다리(북쪽, 짧다 — 들보 뒤 가장자리에서 내려와 위쪽에서 끝난다)
    for x in (14, 58): leg(x, 14, 58, w=6); foot(x - 3, 56)
    # 들보 윗면: 깊은 통로(뒤 거더 · 판자 깔판 · 앞 거더 — 18행) + 앞 거더 옆면(6행)
    c.HL(0, 1, 80, 'ink', 1)
    c.R(0, 2, 80, 4, 'iron', 4); c.HL(0, 2, 80, 'iron', 2); rivets(c, 2, 4, 76, 1, 6, 'iron', 6, 0)  # 뒤 거더 윗면
    c.R(0, 6, 80, 10, 'wood', 4)
    for x in range(1, 80, 5): c.VL(x, 6, 10, 'wood', 3)
    c.HL(0, 6, 80, 'wood', 1); c.HL(0, 7, 80, 'wood', 2)                                              # 뒤 거더 그늘
    c.R(0, 16, 80, 4, 'iron', 5); c.HL(0, 16, 80, 'iron', 6); rivets(c, 2, 18, 76, 1, 6, 'iron', 6, 0)   # 앞 거더 윗면
    c.R(0, 20, 80, 6, 'iron', 2); c.HL(0, 20, 80, 'iron', 1); rivets(c, 3, 22, 74, 1, 6, 'iron', 4, 0)   # 앞 거더 옆면
    c.HL(0, 26, 80, 'ink', 1); c.VL(0, 1, 26, 'ink', 1); c.VL(79, 1, 26, 'ink', 1)
    # 앞 다리(남쪽, 길다)
    for x in (2, 70): leg(x, 27, 72); foot(x - 2, 70)
    # 수레(깔판 위 — 윗면 6행 보이는 놋쇠 상자) + 사슬 + 갈고리 + 매단 상자(윗면 보인다)
    box3(c, 30, 5, 18, 6, 6, 'brass', tt=4, ft=2); c.HL(30, 4, 18, 'ink', 1)
    disc(c, 39, 8, 3.4, 1.8, 'iron', 4, band=1, bt=2, rim=False)
    for x in (37, 41):
        for y in range(26, 44): c.P(x, y, 'iron', 4 if y % 2 else 2)
    c.ell(39, 45, 3, 2, lambda X, Y, dx, dy, d: ('iron', 4) if d > 0.4 else None)
    box3(c, 30, 47, 18, 7, 6, 'wood', tt=5, ft=2); c.HL(30, 60, 18, 'ink', 1); c.HL(30, 46, 18, 'ink', 1)
    for x in range(33, 46, 4): c.VL(x, 48, 5, 'wood', 4)


@redraw('airship-docked', name='계류 비행선(위에서 비스듬히 본 기낭 — 등줄기 빛, 십자 꼬리 날개, 아래 곤돌라)')
def _(c):
    # 곤돌라(기낭 밑 — 지붕 윗면 7행 + 옆 창 줄 7행) + 나무 받침대
    for x in (40, 84):
        box3(c, x, 66, 8, 4, 8, 'wood', tt=5, ft=2); c.HL(x, 78, 8, 'ink', 1)
    c.HL(34, 49, 62, 'ink', 1)
    c.R(34, 50, 62, 7, 'wood', 4); c.HL(34, 50, 62, 'wood', 2); c.HL(34, 56, 62, 'wood', 5)
    for x in range(36, 94, 5): c.VL(x, 51, 5, 'wood', 3)
    c.R(34, 57, 62, 8, 'navy', 2); c.HL(34, 57, 62, 'navy', 3)
    for x in range(38, 92, 7): c.R(x, 59, 4, 3, 'lit' if (x // 7) % 3 else 'glass', 3)
    c.VL(33, 49, 17, 'ink', 1); c.VL(96, 49, 17, 'ink', 1); c.HL(34, 65, 62, 'ink', 1)
    # 기낭: 위에서 본 긴 몸. 등줄기(위 1/3)가 가장 밝고, 세로 이음은 코·꼬리로 모이는 경도선, 놋쇠 늑골은 웃는 호
    cx, cy, rx, ry = 60, 26, 56, 22
    def bag(X, Y, dx, dy, d):
        k = dy
        t = 2 if k < -0.75 else 3 if k < -0.15 else 4 if k < 0.05 else 3 if k < 0.4 else 2 if k < 0.7 else 1
        if k < 0.05 and dx < -0.3: t = min(4, t + 1)
        return ('canvas', t)
    c.ell(cx, cy, rx, ry, bag)
    for k in (-0.6, -0.25, 0.3, 0.65):                                     # 경도선(코·꼬리로 모인다)
        for x in range(int(cx - rx) + 2, int(cx + rx) - 1):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) >= 0.98: continue
            y = cy + ry * k * math.sqrt(max(0.0, 1 - dx * dx))
            c.P(x, round(y), 'canvas', 1 if k > 0.2 else 2)
    for kx in range(-3, 4):                                                # 놋쇠 늑골(남북 — 웃는 호)
        bx = cx + kx * 14
        dxn = (bx + 0.5 - cx) / rx
        hh = ry * math.sqrt(1 - dxn * dxn)
        for y in range(int(cy - hh) + 1, int(cy + hh)):
            dy = (y + 0.5 - cy) / hh
            sx = bx + round(3 * (1 - dy * dy))
            c.P(sx, y, 'brass', 4 if dy < -0.2 else 3 if dy < 0.4 else 1)
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.95 else None)
    # 십자 꼬리: 수평 날개 둘(북·남으로 펼친 판 — 위에서 넓게 보인다) + 등 지느러미(등줄기 위 짧은 판)
    c.poly([(104, 22), (124, 6), (127, 9), (114, 24)], lambda x, y: ('cloth', 3))
    c.poly([(104, 30), (124, 46), (127, 43), (114, 28)], lambda x, y: ('cloth', 2))
    c.line(104, 22, 124, 6, 'ink', 1); c.line(104, 30, 124, 46, 'ink', 1)
    c.R(106, 15, 18, 3, 'cloth', 4); c.HL(106, 18, 18, 'cloth', 1); c.HL(106, 14, 18, 'ink', 1)
    # 코 고리(계류 마스트에 걸린다)
    c.ell(5, 26, 3, 4, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2)); c.line(0, 26, 3, 26, 'iron', 3)


@redraw('airship-docked', name='계류 비행선(위에서 본 기낭 — 넓은 윗면·굽은 늑골, 수평 꼬리 날개 판, 지붕이 보이는 곤돌라)')
def _(c):
    for x in (40, 84):
        box3(c, x, 68, 8, 4, 6, 'wood', tt=5, ft=2); c.HL(x, 78, 8, 'ink', 1)
    # 곤돌라: 기낭 남쪽으로 비켜 매달려 지붕 윗면(6행, 판자 + 난간)과 앞면 창 줄(8행)이 보인다
    box3(c, 36, 50, 58, 7, 9, 'wood', tt=4, ft=2, fmat='navy')
    c.HL(36, 49, 58, 'ink', 1); c.VL(35, 50, 16, 'ink', 1); c.VL(94, 50, 16, 'ink', 1); c.HL(36, 66, 58, 'ink', 1)
    for x in range(38, 92, 4): c.VL(x, 51, 5, 'wood', 3)
    c.HL(36, 51, 58, 'brass', 3); c.HL(36, 55, 58, 'brass', 4)
    for x in range(40, 90, 7): c.R(x, 59, 4, 4, 'lit' if (x // 7) % 3 else 'glass', 3)
    for x in (44, 62, 84): c.line(x, 40, x, 49, 'canvas', 1)
    # 기낭: 윗면(넓고 밝은 평면 타원) + 남쪽 옆구리 띠(어둡다). 코는 왼쪽, 꼬리는 오른쪽.
    cx, cy, rx, ry, side = 60, 18, 56, 15, 11
    c.ell(cx, cy + side, rx, ry, lambda X, Y, dx, dy, d: ('canvas', 1 if dy > 0.5 else 2))
    for x in range(int(cx - rx), int(cx + rx) + 1):
        dx = (x + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        h = ry * math.sqrt(max(0.0, 1 - dx * dx))
        for y in range(round(cy), round(cy + side + h * 0.2)): c.P(x, y, 'canvas', 2)
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('canvas', 4 if (dx * 0.5 + dy) < -0.45 else 3 if dy < 0.55 else 2))
    for kx in range(-3, 4):                                   # 늑골: 윗면에서 코·꼬리 쪽으로 휘는 호 + 옆구리를 두르는 웃는 호
        bx = cx + kx * 14
        dxn = (bx + 0.5 - cx) / rx
        hh = ry * math.sqrt(1 - dxn * dxn)
        bow = 4 * (1 if kx > 0 else -1 if kx < 0 else 0)
        for y in range(int(cy - hh) + 1, int(cy + hh) + 1):
            dy = (y + 0.5 - cy) / hh
            c.P(bx + round(bow * (1 - dy * dy)), y, 'brass', 4 if y < cy else 3)
        for y in range(int(cy + hh), int(cy + hh + side)):
            c.P(bx, y, 'brass', 1)
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.95 and dy < 0 else None)
    c.ell(cx, cy + side, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.95 and dy > -0.2 else None)
    # 수평 꼬리 날개 둘: 위에서 넓게 보이는 판(밝은 윗면 + 앞 두께 1줄) — 북쪽 판은 짧고(멀다) 남쪽 판은 길다(가깝다)
    c.poly([(98, 12), (120, 2), (127, 4), (112, 18)], lambda x, y: ('cloth', 4 if y < 9 else 3))
    c.poly([(98, 26), (114, 22), (127, 42), (118, 46)], lambda x, y: ('cloth', 3 if y < 36 else 2))
    c.line(118, 46, 127, 42, 'cloth', 1); c.line(98, 12, 120, 2, 'ink', 1); c.line(98, 26, 118, 46, 'ink', 1)
    c.line(104, 17, 124, 18, 'ink', 1)                      # 세로 날개는 위에서 보면 등줄기 위 가는 선
    c.ell(5, 19, 3, 3, lambda X, Y, dx, dy, d: ('brass', 4 if dx < 0 else 2)); c.line(0, 19, 3, 19, 'iron', 3)


# 관문 2회 실패 — 다른 조각으로 대신한다(sacks→crate·barrel, boiler-tank→gasometer, standpipe→hydrant)
for _id in ('sacks', 'boiler-tank', 'standpipe'):
    R.items.remove(R.by.pop(_id))


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'street', 'preview.png'), z=z, W=2000)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'street')
