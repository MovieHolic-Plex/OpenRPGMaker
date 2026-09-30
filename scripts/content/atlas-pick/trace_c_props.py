#!/usr/bin/env python3
"""트레이싱 C 조 — 옥상 소품·가로 소품·바닥 손 도트. 좌표·(램프,단)은 전부 내가 정한다. 밑그림 화소는 읽지 않는다."""
from trace_lib import Cv
from trace_c_kit import diag


def poly(cv, pts, r, t):
    """내가 정한 꼭짓점 목록의 안쪽을 칠한다(스캔라인, 화소 중심 기준)."""
    ys = [p[1] for p in pts]
    n = len(pts)
    for y in range(min(ys), max(ys)):
        xs = []
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            if y0 == y1: continue
            if min(y0, y1) <= y + 0.5 < max(y0, y1):
                xs.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            for x in range(int(round(a)), int(round(b))):
                cv.px(x, y, r, t)


# ---- 옥상 ---------------------------------------------------------------------------------
def d_rt_tank():
    cv = Cv(64, 64)
    body = [5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
    # 다리 프레임: 짧은 4개 + X 가새
    for lx in (12, 21, 40, 49):
        cv.fill(lx, 38, 3, 24, 'tekko', 2); cv.vline(lx, 38, 24, 'tekko', 4); cv.vline(lx + 2, 38, 24, 'tekko', 1)
    diag(cv, 14, 42, 41, 58, 'tekko', 4); diag(cv, 42, 42, 15, 58, 'tekko', 4)
    diag(cv, 15, 42, 42, 58, 'tekko', 1); diag(cv, 43, 42, 16, 58, 'tekko', 1)
    cv.fill(10, 47, 44, 2, 'tekko', 3); cv.hline(10, 47, 44, 'tekko', 5)
    cv.fill(8, 60, 48, 4, 'conc', 3); cv.hline(8, 60, 48, 'conc', 5)
    # 몸통(원통): 세로 띠 명암, 이음 밴드
    for i, t in enumerate(body): cv.vline(12 + i, 14, 26, 'tekko', t + 1)
    for y in (20, 27, 34): cv.hline(12, y, 40, 'tekko', 1)
    for y, x in ((17, 20), (24, 24), (30, 18), (37, 30)): cv.px(x, y, 'tekko', 6)
    for x in range(12, 52):
        cv.px(x, 39, 'tekko', 0)
    # 원뿔 지붕
    poly(cv, [(10, 14), (32, 2), (54, 14)], 'tekko', 3)
    poly(cv, [(10, 14), (32, 2), (32, 14)], 'tekko', 5)
    poly(cv, [(32, 2), (54, 14), (44, 14)], 'tekko', 2)
    cv.hline(10, 14, 44, 'tekko', 1)
    cv.fill(31, 0, 2, 3, 'tekko', 4)
    cv.fill(53, 26, 2, 34, 'tekko', 3)                                    # 사다리
    for y in range(30, 58, 5): cv.hline(53, y, 2, 'tekko', 5)
    cv.outline(1)
    return cv


def d_rt_ac():
    cv = Cv(32, 32)
    cv.fill(2, 6, 28, 22, 'conc', 5)                                          # 실외기 몸
    cv.hline(2, 6, 28, 'conc', 6); cv.vline(2, 6, 22, 'conc', 6)
    cv.fill(2, 24, 28, 4, 'conc', 3)                                          # 아래 그늘
    cv.fill(26, 6, 4, 22, 'conc', 3)                                          # 오른쪽 면
    cv.ellipse(14, 16, 9, 9, 'tekko', 1)                                      # 팬 구멍
    cv.ellipse(14, 16, 8, 8, 'tekko', 2)
    for k in (0, 1, 2):                                                       # 팬 날개(3장)
        pass
    cv.fill(13, 15, 2, 2, 'tekko', 5)
    diag(cv, 14, 16, 14, 9, 'tekko', 5); diag(cv, 14, 16, 20, 19, 'tekko', 5); diag(cv, 14, 16, 8, 19, 'tekko', 5)
    for y in (10, 13, 19, 22): cv.hline(7, y, 14, 'tekko', 3) if False else None
    cv.ellipse(14, 16, 9, 9, 'tekko', 1) if False else None
    cv.fill(26, 8, 3, 1, 'tekko', 2); cv.fill(26, 11, 3, 1, 'tekko', 2); cv.fill(26, 14, 3, 1, 'tekko', 2)   # 옆 통풍살
    cv.fill(4, 28, 4, 3, 'tekko', 2); cv.fill(24, 28, 4, 3, 'tekko', 2)      # 발
    cv.outline(1)
    return cv


def d_rt_stair():
    cv = Cv(64, 32)
    cv.fill(4, 8, 56, 24, 'conc', 4)                                          # 계단실 정면
    cv.fill(2, 2, 60, 6, 'conc', 6); cv.hline(2, 2, 60, 'conc', 6)            # 옥상 슬래브(윗면 +2, 처마)
    cv.fill(2, 7, 60, 2, 'conc', 2)                                           # 처마 밑 그늘
    cv.vline(4, 9, 23, 'conc', 5)
    cv.fill(24, 12, 16, 20, 'tekko', 3)                                       # 철문
    cv.box(24, 12, 16, 20, 'tekko', 1)
    cv.vline(32, 13, 18, 'tekko', 1); cv.fill(29, 22, 2, 3, 'kinari', 3); cv.fill(34, 22, 2, 3, 'kinari', 3)
    cv.fill(26, 14, 5, 2, 'tekko', 4)
    cv.fill(46, 12, 8, 8, 'tekko', 2); cv.box(46, 12, 8, 8, 'tekko', 1)       # 환기창
    for y in (14, 16, 18): cv.hline(47, y, 6, 'tekko', 4)
    cv.fill(56, 8, 4, 24, 'conc', 3)                                          # 오른쪽 어두운 면
    cv.fill(8, 30, 48, 2, 'conc', 3)
    cv.outline(1)
    return cv


# ---- 가로수·소품 -------------------------------------------------------------------------
def _puffs(cv, spec):
    """spec: (cx, cy, r) 덩이 목록. 뒤(아래)에서 앞(위) 순으로 칠한다. 덩이마다 왼쪽 위가 밝다."""
    for cx, cy, r in spec:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                d2 = (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2
                if d2 <= r * r:
                    # 빛 방향(왼쪽 위): 덩이 안에서 (x-cx)+(y-cy) 가 작을수록 밝다
                    s = ((x + .5 - cx) + (y + .5 - cy)) / (r * 1.6)
                    t = 5 if s < -0.55 else 4 if s < -0.1 else 3 if s < 0.45 else 2
                    if d2 > (r - 1.2) ** 2 and s > 0.1: t = 1 if s > 0.5 else 2
                    cv.px(x, y, 'ki', t)


def _tree(cv, puffs, tx, trunk_top, hi):
    # 줄기: 밑변 폭 = 몸통 폭(밑이 벌어진 뿌리 + 곧은 줄기)
    cv.fill(tx - 4, 86, 9, 10, 'soil', 2)
    cv.fill(tx - 3, trunk_top, 7, 96 - trunk_top, 'soil', 2)
    cv.vline(tx - 3, trunk_top, 96 - trunk_top, 'soil', 3); cv.vline(tx - 4, 86, 10, 'soil', 3)
    cv.vline(tx + 3, trunk_top, 96 - trunk_top, 'soil', 1); cv.vline(tx + 4, 86, 10, 'soil', 1)
    cv.hline(tx - 5, 95, 11, 'soil', 1)
    cv.pat(tx - 6, 84, ["..x.....x..", ".xx.....xx."], {'x': ('soil', 2)})     # 뿌리 갈래
    diag(cv, tx, trunk_top + 6, tx - 9, trunk_top - 8, 'soil', 2)            # 가지 두 갈래
    diag(cv, tx + 1, trunk_top + 6, tx + 10, trunk_top - 7, 'soil', 1)
    _puffs(cv, puffs)
    # 잎 무리 하이라이트(잎 끝 밝은 점): 내가 정한 좌표
    for x, y in hi:
        cv.px(x, y, 'ki', 5); cv.px(x + 1, y, 'ki', 5); cv.px(x, y + 1, 'ki', 4)
    cv.outline(0)


def d_tree1():
    cv = Cv(64, 96)
    p = [(32, 60, 8), (19, 56, 9), (45, 56, 9), (14, 44, 9), (50, 44, 9), (32, 50, 13), (18, 32, 10), (46, 32, 10),
         (32, 36, 13), (24, 20, 9), (40, 20, 9), (32, 12, 9)]
    hi = [(17, 26), (26, 16), (33, 8), (13, 40), (24, 34), (38, 26), (21, 50), (32, 44), (44, 38), (16, 55), (38, 52), (28, 58)]
    _tree(cv, p, 32, 62, hi)
    return cv


def d_tree2():
    cv = Cv(64, 96)
    p = [(32, 62, 7), (20, 58, 8), (44, 58, 8), (32, 52, 12), (17, 44, 8), (47, 44, 8), (26, 40, 11), (38, 40, 11),
         (32, 28, 12), (25, 18, 8), (39, 18, 8), (32, 10, 8)]
    hi = [(19, 41), (30, 36), (24, 26), (34, 20), (28, 12), (13, 52), (33, 48), (42, 40), (21, 56), (40, 54), (36, 30)]
    _tree(cv, p, 32, 64, hi)
    return cv


def _vend(main, shade, dark):
    cv = Cv(32, 64)
    cv.fill(2, 3, 25, 56, main, 2)                                            # 정면
    cv.fill(27, 3, 3, 56, main, 1)                                            # 오른쪽 옆면(-1~-2)
    cv.vline(2, 3, 56, main, 3); cv.hline(2, 3, 25, main, 3)                  # 왼쪽·윗 빛
    cv.hline(3, 4, 24, main, 4) if False else None
    cv.fill(5, 7, 17, 25, 'shiro', 3)                                         # 진열창(흰 배경)
    cv.box(4, 6, 19, 27, 'tekko', 1)
    cols = [('sora', 3), ('midori', 3), ('kii', 3), ('aka', 3), ('daidai', 3)]
    for row, y in enumerate((9, 17, 25)):                                     # 음료 세 줄, 병 한 개 3x5
        for k in range(5):
            r, t = cols[(k + row * 2) % 5]
            x = 6 + k * 3
            cv.fill(x, y, 2, 5, r, t); cv.px(x, y, r, t + 1); cv.px(x, y - 1, 'shiro', 1)
        cv.hline(5, y + 6, 17, 'tekko', 4)                                    # 선반
    cv.fill(24, 8, 3, 3, 'tekko', 1); cv.px(25, 9, 'mado', 3)                 # 동전 표시
    cv.fill(24, 13, 3, 6, 'tekko', 2); cv.px(25, 14, 'kii', 3); cv.px(25, 16, 'aka', 3)   # 버튼
    cv.fill(24, 21, 3, 4, 'shiro', 2)                                         # 투입구
    cv.fill(5, 43, 18, 10, 'tekko', 0)                                        # 취출구
    cv.hline(5, 43, 18, 'tekko', 2); cv.fill(7, 46, 14, 5, 'sumi', 1)
    cv.fill(3, 36, 21, 5, shade if False else main, 1)                         # 하단 띠
    cv.hline(3, 36, 21, main, 3)
    cv.fill(4, 59, 6, 3, 'tekko', 1); cv.fill(20, 59, 6, 3, 'tekko', 1)        # 발
    cv.outline(1)
    return cv


def d_vend_red(): return _vend('aka', 'aka', 'aka')
def d_vend_blue(): return _vend('sora', 'sora', 'sora')


def d_lamp():
    cv = Cv(32, 96)
    cv.fill(10, 88, 12, 6, 'tekko', 2); cv.hline(10, 88, 12, 'tekko', 4)      # 받침
    cv.fill(12, 84, 8, 4, 'tekko', 3); cv.vline(12, 84, 4, 'tekko', 5)
    cv.fill(13, 12, 5, 72, 'tekko', 3)                                        # 기둥(왼 밝고 오른 어둡게)
    cv.vline(13, 12, 72, 'tekko', 5); cv.vline(14, 12, 72, 'tekko', 4); cv.vline(17, 12, 72, 'tekko', 1)
    cv.fill(11, 66, 9, 3, 'tekko', 2); cv.fill(12, 40, 7, 2, 'tekko', 2)      # 마디
    for k, (x, y) in enumerate([(14, 8), (16, 5), (19, 3), (22, 2), (25, 2)]):  # 휜 팔
        cv.fill(x, y, 3, 3, 'tekko', 4 if k < 2 else 3)
    cv.fill(13, 8, 5, 6, 'tekko', 3)
    cv.fill(24, 4, 6, 3, 'tekko', 2); cv.hline(24, 4, 6, 'tekko', 4)          # 등갓
    cv.fill(25, 7, 5, 2, 'mado', 4); cv.hline(25, 9, 5, 'mado', 2)            # 불빛
    cv.outline(1)
    return cv


def d_tlight():
    cv = Cv(32, 96)
    cv.fill(9, 86, 12, 8, 'tekko', 2); cv.hline(9, 86, 12, 'tekko', 4)
    cv.fill(11, 82, 8, 4, 'tekko', 3)
    cv.fill(12, 8, 5, 76, 'tekko', 3)
    cv.vline(12, 8, 76, 'tekko', 5); cv.vline(13, 8, 76, 'tekko', 4); cv.vline(16, 8, 76, 'tekko', 1)
    cv.fill(12, 8, 18, 4, 'tekko', 3); cv.hline(12, 8, 18, 'tekko', 5); cv.hline(12, 11, 18, 'tekko', 1)   # 팔
    cv.fill(20, 12, 10, 26, 'tekko', 1); cv.box(20, 12, 10, 26, 'tekko', 0)   # 신호등 몸체
    cv.fill(21, 13, 8, 24, 'tekko', 1)
    for i, (r, on) in enumerate((('aka', True), ('kii', False), ('midori', False))):
        cy = 18 + i * 8
        cv.ellipse(25, cy, 3.4, 3.4, 'tekko', 0)
        cv.ellipse(25, cy, 2.6, 2.6, r, 3 if on else 0)
        if on: cv.px(24, cy - 1, r, 4)
    cv.outline(1)
    return cv


def d_guardrail():
    cv = Cv(32, 32)
    for y0 in (8, 16):                                                        # 가로 레일 두 줄(사이는 비움)
        cv.fill(0, y0, 32, 5, 'shiro', 2); cv.hline(0, y0, 32, 'shiro', 4); cv.hline(0, y0 + 3, 32, 'shiro', 1)
        cv.hline(0, y0 - 1, 32, 'sumi', 1); cv.hline(0, y0 + 4, 32, 'sumi', 1)
    cv.fill(13, 4, 6, 26, 'shiro', 3); cv.vline(13, 4, 26, 'shiro', 4); cv.vline(18, 4, 26, 'shiro', 1)   # 기둥
    cv.fill(14, 5, 4, 3, 'aka', 2); cv.hline(14, 5, 4, 'aka', 4)                                          # 반사판
    cv.hline(13, 3, 6, 'sumi', 1); cv.vline(12, 4, 26, 'sumi', 1); cv.vline(19, 4, 26, 'sumi', 1)
    cv.fill(11, 29, 10, 3, 'conc', 3); cv.hline(11, 29, 10, 'conc', 5); cv.hline(11, 31, 10, 'sumi', 1)
    return cv


def d_taxi():
    cv = Cv(128, 64)
    # 몸통(왼쪽 = 뒤, 오른쪽 = 앞): 내가 정한 꼭짓점
    poly(cv, [(6, 30), (10, 26), (26, 24), (36, 12), (44, 8), (74, 8), (84, 12), (96, 24), (112, 28), (118, 34), (120, 42), (4, 42)], 'kii', 3)
    poly(cv, [(10, 26), (26, 24), (36, 12), (44, 8), (74, 8), (84, 12), (86, 14), (40, 16), (28, 26)], 'kii', 4)  # 윗면 하이라이트
    cv.fill(4, 38, 116, 6, 'kii', 1)                                          # 아랫부분 그늘
    cv.hline(6, 32, 108, 'kii', 4)                                            # 어깨선 빛
    cv.hline(6, 35, 108, 'aka', 3); cv.hline(6, 36, 108, 'aka', 2); cv.hline(6, 37, 108, 'kii', 2)   # 붉은 띠
    cv.hline(6, 34, 108, 'kii', 2)
    # 유리창
    poly(cv, [(30, 24), (38, 13), (48, 10), (72, 10), (82, 14), (92, 24)], 'garasu', 1)
    poly(cv, [(32, 23), (40, 14), (49, 11), (58, 11), (58, 23)], 'garasu', 3)
    poly(cv, [(62, 11), (72, 11), (81, 15), (89, 23), (62, 23)], 'garasu', 3)
    cv.vline(60, 11, 13, 'kii', 2); cv.vline(61, 11, 13, 'kii', 1)              # B 필러
    diag(cv, 35, 22, 43, 13, 'garasu', 5); diag(cv, 66, 22, 72, 13, 'garasu', 5)
    # 문선·손잡이
    cv.vline(59, 24, 14, 'kii', 1); cv.hline(50, 29, 6, 'kii', 1); cv.hline(66, 29, 6, 'kii', 1)
    cv.fill(78, 26, 4, 2, 'kii', 1)
    # 지붕 등
    cv.fill(54, 2, 10, 6, 'kii', 3); cv.hline(54, 2, 10, 'kii', 4); cv.fill(63, 2, 1, 6, 'kii', 1); cv.box(54, 2, 10, 6, 'sumi', 1) if False else None
    cv.fill(58, 4, 2, 2, 'aka', 3)
    # 범퍼·램프
    cv.fill(2, 36, 5, 8, 'aka', 2); cv.px(2, 36, 'aka', 3)                     # 뒷 등
    cv.fill(2, 42, 8, 4, 'tekko', 1)
    cv.fill(116, 32, 4, 5, 'daidai', 3); cv.px(116, 32, 'daidai', 4)           # 앞 등
    cv.fill(112, 42, 10, 4, 'tekko', 1)
    cv.hline(4, 45, 118, 'sumi', 1)
    # 바퀴(원): 검정 → 회색 휠캡
    for cx in (28, 96):
        cv.ellipse(cx, 46, 12, 12, 'sumi', 1)
        cv.ellipse(cx, 46, 10, 10, 'tekko', 1)
        cv.ellipse(cx, 46, 6.5, 6.5, 'tekko', 4)
        cv.ellipse(cx, 46, 4.5, 4.5, 'tekko', 3)
        cv.px(cx - 1, 45, 'tekko', 6); cv.px(cx, 45, 'tekko', 6)
        for a, b in ((0, -5), (5, 0), (0, 5), (-5, 0)):
            cv.px(cx + a, 46 + b, 'tekko', 5)
    cv.fill(0, 62, 128, 2, 'yoru', 0) if False else None
    cv.outline(1)
    return cv


# ---- 바닥(이어 붙는 타일) ------------------------------------------------------------------
def d_ground_sidewalk():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'hodo', 4)
    cv.hline(0, 0, 32, 'hodo', 5); cv.vline(0, 0, 32, 'hodo', 5)              # 이음 위·왼 빛
    cv.hline(0, 15, 32, 'hodo', 2); cv.hline(0, 31, 32, 'hodo', 2); cv.vline(15, 0, 32, 'hodo', 2)   # 16px 블록 줄눈
    cv.vline(31, 0, 32, 'hodo', 2)
    cv.hline(1, 16, 14, 'hodo', 5) if False else None
    for x, y, t in ((5, 6, 3), (6, 6, 3), (22, 4, 5), (9, 22, 3), (26, 24, 5), (20, 11, 3), (4, 27, 5), (28, 9, 3), (12, 12, 5)):
        cv.px(x, y, 'hodo', t)
    return cv


def d_ground_curb():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'hodo', 3)                                          # 뒤쪽 인도(윗 8줄만 쓰임)
    cv.fill(0, 8, 32, 3, 'conc', 5); cv.hline(0, 8, 32, 'conc', 6)            # 연석 윗면
    cv.fill(0, 11, 32, 2, 'conc', 2)
    cv.hline(0, 13, 32, 'tekko', 1)
    cv.fill(0, 14, 32, 18, 'yoru', 3)                                         # 차도 시작
    cv.hline(0, 14, 32, 'yoru', 1)
    cv.vline(31, 8, 5, 'conc', 3)                                             # 연석 이음
    return cv


def d_ground_road():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'yoru', 3)
    for x, y, t in ((3, 4, 4), (4, 4, 4), (14, 9, 2), (25, 3, 4), (9, 17, 2), (10, 17, 2), (21, 21, 4), (28, 14, 2), (5, 27, 4), (17, 28, 2), (30, 26, 4), (12, 2, 2), (19, 14, 4), (1, 12, 2)):
        cv.px(x, y, 'yoru', t)
    return cv


def d_ground_lane():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'yoru', 3)
    for x, y, t in ((5, 5, 4), (24, 6, 2), (13, 25, 4), (28, 26, 2), (8, 12, 2), (21, 22, 4)):
        cv.px(x, y, 'yoru', t)
    cv.fill(0, 14, 24, 3, 'kii', 3); cv.hline(0, 14, 24, 'kii', 4); cv.hline(0, 16, 24, 'kii', 2)   # 파선: 24 그리고 8 비움
    return cv


def d_ground_crosswalk():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'yoru', 3)
    for x0 in (0, 16):
        cv.fill(x0, 0, 9, 32, 'shiro', 3)
        cv.vline(x0, 0, 32, 'shiro', 4); cv.vline(x0 + 8, 0, 32, 'shiro', 2)
        for y, dx in ((5, 3), (12, 6), (19, 2), (27, 5)):
            cv.px(x0 + dx, y, 'shiro', 2)                                     # 페인트 닳음 점
    return cv


def d_manhole():
    cv = Cv(32, 32)
    cv.ellipse(16, 16, 15, 7, 'tekko', 1)
    cv.ellipse(16, 15, 14, 6, 'tekko', 2)
    cv.ellipse(16, 15, 11, 4, 'tekko', 3)
    for x in range(7, 26, 3): cv.vline(x, 12, 7, 'tekko', 1)                  # 무늬 홈
    cv.hline(9, 14, 14, 'tekko', 4)
    cv.hline(10, 11, 12, 'tekko', 4) if False else None
    return cv


def d_tactile():
    cv = Cv(32, 32)
    cv.fill(0, 12, 32, 8, 'kii', 2)                                           # 노란 점자블록 띠
    cv.hline(0, 12, 32, 'kii', 3)
    cv.hline(0, 19, 32, 'kii', 1)
    for x in range(1, 32, 4):
        for y in (13, 17):
            cv.fill(x, y, 2, 2, 'kii', 4 if False else 3); cv.px(x, y, 'kii', 4); cv.px(x + 1, y + 1, 'kii', 1)
    return cv


def d_shadow_wall():
    """건물 밑 바닥 그림자(가로 이어짐). 인도 위에 얹는다: hodo -2 6px, 끝 1px 는 -1."""
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 5, 'hodo', 2); cv.hline(0, 5, 32, 'hodo', 3)
    for x in range(0, 32, 4): cv.px(x, 4, 'hodo', 1)
    return cv


def d_shadow_tree():
    cv = Cv(64, 32)
    cv.ellipse(32, 14, 22, 7, 'hodo', 2); cv.ellipse(32, 14, 15, 4, 'hodo', 1)
    return cv


def d_shadow_car():
    cv = Cv(128, 32)
    cv.ellipse(64, 16, 58, 7, 'yoru', 1); cv.ellipse(64, 16, 46, 4, 'yoru', 0)
    return cv
