"""랜드마크 건물 — 포켓몬센터(곡면 지붕)·마트·체육관(팔각 지붕)·박공 집. 기준 팩의 구조를 읽고 좌표로 다시 그린다."""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402


def _in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-9) + x1:
            inside = not inside
    return inside


def _line(cv, x0, y0, x1, y1, c, w=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / max(1, n)
        x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
        for dx in range(w):
            px.put(cv, x + dx, y, c)


# ---- 포켓몬센터 / 마트 (64×64 = 4칸 × 4칸) -------------------------------------------------------
# 통합 I4 W1: 원작 미로마을(em Oldale) 센터·마트는 4칸 폭 × 4칸 높이, 문 1칸(가운데에서 한 칸 왼쪽 = 둘째 칸)이다.
# 옛 96×96(6×6, 문 2칸)은 원작의 1.5배였다. 재료(곡면 줄무늬 지붕·분홍/흰 벽·강철 틀·유리 문·흰 고리 십자·쇼핑백·MART 간판)는 그대로,
# 비례만 원작으로: 지붕 2줄(가운데 0..30, 끝 0..42) + 벽 2줄, 문장(십자·가방)은 원작처럼 지붕 앞면 가운데에 얹는다(벽 2줄에는 문 위 자리가 없다).
CENTER_N = 4
CENTER_DOOR_COL = 1


def center(P, roof_key="roof_red", mart=False, seed="center", roles=None):
    rf, st, gl, pk = P[roof_key], P["steel"], P["glass"], P["pink"]
    W = H = CENTER_N * T
    cv = px.new(W, H)
    def top(x):
        d = abs(x + 0.5 - 32)
        if d < 5: return 0
        if d < 7: return int(1 + (d - 5))
        return int(3 + (d - 7) * 10 / 25)
    def bot(x):
        d = abs(x + 0.5 - 32) / 32
        return int(42 - 12 * (1 - d ** 1.6))
    wl = pk if not mart else [st[1], st[2], st[3]]
    for y in range(26, H):
        for x in range(3, 61):
            cv.putpixel((x, y), wl[2])
    if not mart:
        # 흰 허리판(가로) + 위 한 줄 진한 분홍 선, 벽돌 줄눈 몇 개(옛 센터와 같은 재료)
        px.rect(cv, 6, 52, 57, 52, pk[1]); px.rect(cv, 6, 53, 57, 59, st[3])
        for (bx, by) in ((7, 45), (10, 48), (7, 50), (34, 53 - 9), (35, 49), (54, 47)):
            px.rect(cv, bx, by, bx + 2, by, pk[1])
    else:
        px.rect(cv, 6, 52, 57, 52, st[1]); px.rect(cv, 6, 53, 57, 57, st[2])            # 아래 연회색 허리 띠(윗선 한 줄 어둡게)
        px.rect(cv, 6, 58, 57, 59, st[3])
    px.rect(cv, 6, 60, 57, 61, st[3]); px.rect(cv, 6, 62, 57, 62, st[2]); px.rect(cv, 6, 63, 57, 63, st[1])   # 바닥: 흰 띠 + 회색 줄
    for x0 in (3, 58):                             # 기둥(3폭: 밝음·중간·어둠)
        px.rect(cv, x0, 40, x0 + 2, 63, st[2]); px.rect(cv, x0, 40, x0, 63, st[3]); px.rect(cv, x0 + 2, 40, x0 + 2, 63, st[1])
    if not mart:
        # 문 오른쪽 유리창(강철 틀 + 유리 2톤 + 가운데 살) — 옛 반원 창 자리(문 위)는 벽 2줄에 없어서 옆으로 옮겼다
        px.rect(cv, 37, 41, 54, 50, st[1]); px.rect(cv, 38, 42, 53, 49, st[2]); px.rect(cv, 38, 42, 53, 42, st[3])
        px.rect(cv, 39, 43, 52, 48, gl[2]); px.rect(cv, 39, 43, 52, 44, gl[1]); px.rect(cv, 39, 47, 52, 48, gl[3])
        px.rect(cv, 45, 43, 46, 48, st[2]); px.rect(cv, 45, 43, 45, 48, st[3])
        px.rect(cv, 38, 51, 53, 51, pk[0])                                          # 창 턱 그림자
    else:
        # 진열창(문 왼쪽): 회색 틀 + 유리 2톤 + 안에 놓인 상품 상자 둘
        px.rect(cv, 6, 42, 14, 51, st[1]); px.rect(cv, 7, 43, 13, 50, gl[2]); px.rect(cv, 7, 43, 13, 44, gl[1])
        px.rect(cv, 7, 48, 13, 50, gl[3])
        for k, c_ in enumerate((P["roof_red"][3], P["gold"][1])):
            bx = 8 + k * 3
            px.rect(cv, bx, 47, bx + 1, 50, c_); px.rect(cv, bx, 47, bx + 1, 47, st[3])
        px.rect(cv, 7, 51, 13, 51, st[2])
        # 간판판(문 오른쪽): 남색 테 + 흰 판 + 파란 글자 「MART」(옛 간판과 같은 글꼴·폭) + 빨간 밑줄
        px.rect(cv, 35, 40, 56, 50, gl[0]); px.rect(cv, 36, 41, 55, 49, st[3]); px.rect(cv, 36, 49, 55, 49, st[2])
        glyph = {"M": ["1...1", "11.11", "1.1.1", "1...1", "1...1"], "A": [".1.", "1.1", "111", "1.1", "1.1"],
                 "R": ["11.", "1.1", "11.", "1.1", "1.1"], "T": ["111", ".1.", ".1.", ".1.", ".1."]}
        gx = 37
        for ch in "MART":
            for j, row in enumerate(glyph[ch]):
                for i, b in enumerate(row):
                    if b == "1":
                        px.put(cv, gx + i, 42 + j, rf[1])
            gx += len(glyph[ch][0]) + 1
        px.rect(cv, 37, 48, 54, 48, P["roof_red"][2])
    # 문 1칸(둘째 칸 x=16..31): 틀 = 바깥 어두운 회색 | 밝은 회색(왼쪽·위 흰 하이라이트) | 남색 유리 윤곽 | 유리.
    # 유리 위 두 줄은 처마 그늘(진한 파랑), 가운데 세로 문틀, 아래는 청록 + 하늘, 그 밑 남색 선. 맨 아래 2행은 열린 바닥(문이 서 있다).
    dx0 = CENTER_DOOR_COL * T
    px.rect(cv, dx0 - 1, 39, dx0 + 16, 63, st[1])
    px.rect(cv, dx0, 40, dx0 + 15, 63, st[2])
    px.rect(cv, dx0, 40, dx0 + 15, 40, st[3]); px.rect(cv, dx0, 40, dx0, 63, st[3])
    px.rect(cv, dx0 + 2, 42, dx0 + 13, 63, gl[0])
    for (cx_, cy_) in ((dx0 - 1, 39), (dx0 + 16, 39)):                      # 위 모서리 깎기
        cv.putpixel((cx_, cy_), wl[2])
    for y in range(43, 61):
        for x in range(dx0 + 3, dx0 + 13):
            c = gl[2]
            if y < 46: c = gl[1]
            if y >= 57: c = gl[3] if y < 59 else gl[4]
            px.put(cv, x, y, c)
    px.rect(cv, dx0 + 7, 43, dx0 + 8, 60, gl[1]); px.rect(cv, dx0 + 7, 43, dx0 + 8, 45, gl[0])
    px.rect(cv, dx0 + 3, 61, dx0 + 12, 61, gl[0])
    for yy_ in (62, 63):
        for xx_ in range(dx0 + 2, dx0 + 14):
            cv.putpixel((xx_, yy_), (0, 0, 0, 0))
    # 곡면 지붕(기준에서 잰 구조, 옛 센터와 같다): 세로 줄무늬 = 몸 6 + 골 2(한 단 어둡게) 주기 8. 몸 톤은 왼쪽 밝음(4) → 가운데(3) → 오른쪽 어둠(2).
    def body_tone(x):
        if x < 15: return 4
        if x < 25: return 3 if (x // 8) % 2 else 4
        if x < 39: return 3
        if x < 44: return 2
        if x < 53: return 3 if (x // 8) % 2 == 0 else 2
        return 2
    for x in range(W):
        t0, b0 = top(x), bot(x)
        ph = (x + 3) % 8
        tone = max(1, body_tone(x) - (1 if ph >= 6 else 0))
        for y in range(t0, b0):
            c = rf[tone]
            if y == t0: c = rf[0] if 26 < x < 37 else rf[1]
            if y >= b0 - 2: c = rf[1]
            if y >= b0 - 1: c = rf[0]
            cv.putpixel((x, y), c)
    px.rect(cv, 0, top(0) + 1, 0, bot(0) - 1, rf[0]); px.rect(cv, W - 1, top(W - 1) + 1, W - 1, bot(W - 1) - 1, rf[0])
    # 처마 밑 그림자: 지붕 바로 아래 벽 두 칸 + 한 칸
    for x in range(W):
        b0 = bot(x)
        if 3 <= x < 61:
            for k_, c_ in enumerate((wl[0], wl[0], wl[1])):
                if b0 + k_ < 44 and cv.getpixel((x, b0 + k_)) in (wl[2], (0, 0, 0, 0)):
                    px.put(cv, x, b0 + k_, c_)
    # 문장(원작처럼 지붕 앞면 가운데): 센터는 흰 고리 + 붉은 십자, 마트는 남색 테 흰 판에 쇼핑백
    if not mart:
        for y in range(13, 31):
            for x in range(22, 42):
                dd = math.hypot(x + 0.5 - 32, y + 0.5 - 22)
                if dd <= 7.3:
                    px.put(cv, x, y, rf[0] if dd > 6.5 else st[2] if dd > 5.6 else st[3])
        px.rect(cv, 31, 18, 32, 25, rf[3]); px.rect(cv, 28, 21, 35, 22, rf[3])
        for (tx_, ty_) in ((31, 18), (32, 18), (28, 21), (28, 22)):
            px.put(cv, tx_, ty_, rf[4])
        for (tx_, ty_) in ((35, 22), (32, 25)):
            px.put(cv, tx_, ty_, rf[2])
    else:
        px.rect(cv, 24, 14, 39, 28, gl[0]); px.rect(cv, 25, 15, 38, 27, st[3])
        bag = ["...1111...", "..1....1..", "..1....1..", "1111111111", "1222222221", "1222222221", "1222222221", "1222222221", "1222222221", "1111111111"]
        for j, row in enumerate(bag):
            for i, b in enumerate(row):
                if b == "1":
                    px.put(cv, 27 + i, 16 + j, rf[1])
                elif b == "2":
                    px.put(cv, 27 + i, 16 + j, rf[3] if i < 4 else rf[2])
        px.rect(cv, 29, 21, 34, 21, st[3])
    # 몬스터 마을 건물 문법(2026-10-07): 실루엣·지붕 처마선·문·창 둘레를 집과 같은 남회색 윤곽으로.
    import buildings as bd
    ol = bd.OL(P)
    for x in range(W):
        px.put(cv, x, bot(x) - 1, ol)
    px.rect(cv, dx0 - 1, 39, dx0 - 1, 61, ol); px.rect(cv, dx0 + 16, 39, dx0 + 16, 61, ol); px.rect(cv, dx0 - 1, 39, dx0 + 16, 39, ol)
    px.rect(cv, dx0 + 2, 61, dx0 + 13, 61, ol)
    boxes = [(37, 41, 54, 50)] if not mart else [(6, 42, 14, 51), (35, 40, 56, 50)]
    for (a, b_, c, d) in boxes:
        px.rect(cv, a, b_, c, b_, ol); px.rect(cv, a, d, c, d, ol); px.rect(cv, a, b_, a, d, ol); px.rect(cv, c, b_, c, d, ol)
    bd.outline_silhouette(cv, ol)
    if roles is not None:
        roof_ymax = max(bot(x) for x in range(W)) - 1
        wall = [[6, 44, 14, 51], [33, 44, 36, 51], [55, 44, 57, 51]] if not mart else [[33, 41, 34, 51], [57, 41, 57, 51], [6, 52, 57, 59]]
        roles.update({"roof_ymax": roof_ymax, "roof_ramp": roof_key, "wall": wall,
                      "openings": [[dx0 - 1, 39, dx0 + 16, 63]] + ([[6, 42, 14, 51], [35, 40, 56, 50]] if mart else [[37, 41, 54, 51]]),
                      "windows": [], "doors": [[dx0 + 2, 42, dx0 + 13, 63]], "frame_zone": [3, 36, 60, 63], "frame_ramp": "pink" if not mart else "steel"})
    return cv


# ---- 체육관 (112×112, 팔각 지붕) -----------------------------------------------------------------
def gym(P, accent="gym_green", seed="gym", roles=None):
    sl, st, gl, ac = P["slate"], P["steel"], P["glass"], P[accent]
    r = random.Random(seed)
    W = H = 112
    cv = px.new(W, H)
    mx = lambda x: W - 1 - x
    # 1) 아래 몸통: 가운데 벽(밝은 포인트색) + 양옆 날개(어두운 윗부분, 계단 진 밝은 아랫부분) + 강철 기둥·모서리
    px.rect(cv, 27, 78, 84, 110, ac[2])
    for side in (0, 1):
        f = (lambda x: x) if side == 0 else mx
        for y in range(58, 112):
            for x in range(6, 27):
                # 날개 윤곽: 바깥 세로 변 x=6 (y<89) 후 아래로 비스듬히 안쪽으로
                lim = 6 if y < 89 else 6 + (y - 89)
                if x < lim or y < 58 + (x - 6) * 1.0 and False:
                    continue
                if y < 58 + int((x - 6) * 1.05):
                    continue
                c = ac[1]
                if y >= 84 and x >= 10: c = ac[2]
                if 84 <= y < 92 and x < 14: c = ac[1]
                px.put(cv, f(x), y, c)
        # 날개 가장자리 강철(바깥 변 + 아래 비스듬한 변)
        for y in range(58, 89):
            px.put(cv, f(6), y, st[3]); px.put(cv, f(7), y, st[2])
        _line(cv, f(6) if side == 0 else mx(6), 89, f(27) if side == 0 else mx(27), 111, st[3], 1)
        _line(cv, f(7), 89, f(28), 111, st[2], 1)
        for x in range(28, 40):                                   # 포인트색 Λ 무늬(문 양옆 아래)
            top = 96 + int(abs(x - 33) * 0.8)
            px.rect(cv, f(x), top, f(x), 109, ac[3])
        for k, (c0) in enumerate((st[3], st[3], st[2], st[1])):   # 기둥
            px.rect(cv, f(24 + k), 77, f(24 + k), 111, c0)
    px.rect(cv, 28, 111, 83, 111, st[1])
    # 2) 지붕 팔각: 슬레이트 + 안쪽 패널 + 어두운 벽돌 자국
    oct_ = [(26, 0), (86, 0), (110, 22), (110, 54), (87, 77), (25, 77), (1, 54), (1, 22)]
    inner = [(28, 5), (84, 5), (105, 24), (105, 51), (85, 70), (27, 70), (6, 51), (6, 24)]
    for y in range(H):
        for x in range(W):
            if _in_poly(x + 0.5, y + 0.5, oct_):
                cv.putpixel((x, y), sl[1])
            if _in_poly(x + 0.5, y + 0.5, inner):
                cv.putpixel((x, y), sl[2])
    for (cx_, cy_) in ((85, 18), (89, 21), (26, 44), (30, 47), (85, 47), (88, 51)):   # 반짝이(+) 군집
        for dx_, dy_ in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            px.put(cv, cx_ + dx_, cy_ + dy_, sl[3])
    for (bx, by) in ((19, 24), (92, 30)):                                           # 세로 벽돌 쌍(2×4)
        px.rect(cv, bx, by, bx + 1, by + 3, sl[3])
    for (bx, by) in ((46, 48), (51, 50), (62, 55), (67, 57)):                        # 아래 가운데 패널 벽돌(6×2)
        px.rect(cv, bx, by, bx + 5, by + 1, sl[2])
    # 3) 포인트색 동심 선(위쪽 2줄 중간색, 아래 비스듬한 줄은 노란 초록)
    for inset, col in ((5, ac[2]), (11, ac[2])):
        pts = [(26 + inset * 0.5, inset * 0.55), (86 - inset * 0.5, inset * 0.55), (110 - inset, 22 + inset * 0.3), (110 - inset, 54 - inset * 0.3),
               (87 - inset * 0.8, 77 - inset), (25 + inset * 0.8, 77 - inset), (1 + inset, 54 - inset * 0.3), (1 + inset, 22 + inset * 0.3)]
        for i in range(len(pts)):
            a_, b_ = pts[i], pts[(i + 1) % len(pts)]
            c_ = ac[3] if (i in (3, 5, 6) and inset == 11) else col
            _line(cv, a_[0], a_[1], b_[0], b_[1], c_)
    # 지붕 윤곽(기준): 위쪽·위 비스듬한 변 = 짙은 남색 / 왼쪽 세로 = 흰 2칸 / 오른쪽 세로 = 회색 2칸 / 아래 비스듬한 변 = 안쪽 밝은 줄 + 바깥 남색
    for i in range(len(oct_)):
        a_, b_ = oct_[i], oct_[(i + 1) % len(oct_)]
        if i == 6:
            _line(cv, a_[0], a_[1], b_[0], b_[1], st[3], 2)
        elif i == 2:
            _line(cv, a_[0] - 1, a_[1], b_[0] - 1, b_[1], st[2], 2)
        elif i in (3, 5):
            _line(cv, a_[0], a_[1] + 1, b_[0], b_[1] + 1, sl[0], 1)
            _line(cv, a_[0], a_[1], b_[0], b_[1], st[3] if i == 5 else st[2], 1)
            _line(cv, a_[0], a_[1] - 1, b_[0], b_[1] - 1, st[2] if i == 5 else st[1], 1)
        else:
            _line(cv, a_[0], a_[1], b_[0], b_[1], sl[0], 1)
    for x in range(26, 87):
        px.put(cv, x, 77, st[2]); px.put(cv, x, 78, st[1])
    # 4) 육각 엠블럼 창(흰 테 + 하늘빛 층 + 포인트색 잎)
    hexp = [(28, 27), (38, 11), (74, 11), (84, 27), (74, 43), (38, 43)]
    hin = [(31, 27), (40, 15), (72, 15), (81, 27), (72, 39), (40, 39)]
    def edge_dist(x_, y_, poly):
        best = 1e9
        for i_ in range(len(poly)):
            (x1, y1), (x2, y2) = poly[i_], poly[(i_ + 1) % len(poly)]
            dx_, dy_ = x2 - x1, y2 - y1
            t = max(0.0, min(1.0, ((x_ - x1) * dx_ + (y_ - y1) * dy_) / (dx_ * dx_ + dy_ * dy_)))
            best = min(best, math.hypot(x_ - (x1 + t * dx_), y_ - (y1 + t * dy_)))
        return best
    for y in range(8, 46):
        for x in range(24, 90):
            if _in_poly(x + 0.5, y + 0.5, hexp):
                cv.putpixel((x, y), st[3])
            if _in_poly(x + 0.5, y + 0.5, hin):
                d_ = edge_dist(x + 0.5, y + 0.5, hin)
                cv.putpixel((x, y), gl[4] if d_ < 2.0 else gl[3] if d_ < 3.4 else gl[2])
    for x in range(40, 73):                                                        # 창 아래 회색 턱
        if _in_poly(x + 0.5, 44.5, [(38, 10), (74, 10), (85, 27), (74, 46), (38, 46)]):
            px.put(cv, x, 45, st[1])
    ang = math.radians(18)                                                         # 기울어진 잎: 흰 테 + 올리브 점선 + 몸통
    for y in range(16, 40):
        for x in range(46, 66):
            ux, uy = x + 0.5 - 56, y + 0.5 - 27.5
            rx_ = ux * math.cos(ang) + uy * math.sin(ang)
            ry_ = -ux * math.sin(ang) + uy * math.cos(ang)
            e = (rx_ / 4.6) ** 2 + (ry_ / 8.6) ** 2
            if e <= 1.0:
                if e > 0.74: c_ = st[3]
                elif e > 0.52 and (x + y) % 2 == 0: c_ = ac[3]
                else: c_ = ac[2]
                cv.putpixel((x, y), c_)
    # 5) 흰 살대
    for a_, b_ in (((28, 0), (38, 11)), ((84, 0), (74, 11)), ((40, 44), (26, 76)), ((72, 44), (86, 76))):
        _line(cv, a_[0], a_[1], b_[0], b_[1], st[3], 3)
    # 6) A자 출입구: 흰 다리 + 강철 안쪽 + 삼각 채광창 + 들보 + 유리 이중문 + 양옆 삼각 유리
    for y in range(66, H):
        half = (y - 66) * 0.43
        for x in range(int(56 - half - 3), int(56 + half + 4)):
            d = abs(x + 0.5 - 56)
            if d > half + 1.0:
                continue
            if d > half - 2.2: c = st[3]
            elif d > half - 4.0: c = st[2]
            else: c = st[1]
            px.put(cv, x, y, c)
    for y in range(74, 84):                                               # 삼각 채광창
        hw = (y - 74) * 0.8 + 0.5
        for x in range(int(56 - hw), int(56 + hw) + 1):
            px.put(cv, x, y, gl[3] if y >= 82 else gl[2])
    px.rect(cv, 49, 84, 62, 84, st[2]); px.rect(cv, 49, 85, 62, 85, st[3]); px.rect(cv, 49, 86, 62, 86, st[2])   # 들보: 회색·흰색·회색(A자 안쪽, 폭 14)
    px.rect(cv, 49, 88, 62, 110, gl[2])                                       # 이중문 유리
    px.rect(cv, 49, 88, 62, 91, gl[1]); px.rect(cv, 49, 87, 62, 87, gl[0])    # 윗부분은 그림자(진한 파랑)
    px.rect(cv, 49, 105, 62, 106, gl[3]); px.rect(cv, 49, 107, 62, 109, gl[4])
    px.rect(cv, 55, 88, 56, 109, gl[1]); px.rect(cv, 55, 88, 56, 91, gl[0])
    px.rect(cv, 48, 87, 48, 110, gl[0]); px.rect(cv, 63, 87, 63, 110, gl[0])      # 유리 남색 윤곽
    px.rect(cv, 47, 87, 47, 110, st[1]); px.rect(cv, 64, 87, 64, 110, st[1])      # 회색 줄
    px.rect(cv, 45, 87, 46, 110, st[3]); px.rect(cv, 65, 87, 66, 110, st[3])      # 흰 문설주 2칸(기준)
    px.rect(cv, 48, 110, 63, 111, st[0])                                          # 바닥 어두운 문턱
    for sd in (0, 1):                                                          # 문 양옆 삼각 유리
        f = (lambda x: x) if sd == 0 else mx
        for y in range(96, 111):
            lo = 56 - ((y - 66) * 0.43 - 4.0)
            for x in range(int(lo) + 1, 47):
                c = gl[0] if y < 106 else gl[3] if y < 108 else gl[4]
                px.put(cv, f(x), y, c)
    import buildings as bd                                                 # 몬스터 마을 건물 문법: 실루엣·문 둘레 남회색 윤곽(2026-10-07)
    ol = bd.OL(P)
    px.rect(cv, 44, 87, 44, 109, ol); px.rect(cv, 67, 87, 67, 109, ol)
    bd.outline_silhouette(cv, ol)
    if roles is not None:
        roles.update({"wall": [[29, 82, 38, 94], [73, 82, 82, 94]], "openings": [[46, 84, 65, 110]], "windows": [], "doors": [[48, 88, 63, 110]], "frame_zone": [24, 78, 87, 111], "frame_ramp": "steel", "glass_ramp": "glass"})
    return cv


# ---- 박공 집 (112×112, 두 경사면 + 금빛 용마루 기둥) ----------------------------------------------
# 기준에서 잰 구조 규칙(이 그림의 「깔끔함」을 만드는 것들):
#  · 벽은 크림 한 톤 + 그림자 한 톤뿐. 균열·점·목조 장식을 얹지 않는다.
#  · 벽 위로 튀어나온 것(보·창틀·문틀·지붕 끝)의 바로 아래 한 칸은 반드시 그림자색(plaster[0]). → _drop_shadow 가 일괄로 깐다.
#  · 창: 틀 3톤 + 안쪽 어두운 테 + 유리(하늘빛 2칸 + 밝은 하이라이트 1칸) 2×2 칸, 가운데 십자 살.
#  · 문: 아치 틀 + 세로 판자 + 금빛 손잡이.
def _drop_shadow(cv, wall, shade, skip):
    """벽색 픽셀 바로 위가 벽·그림자색이 아닌 것(보·창틀·지붕 등)이면 그림자색으로 바꾼다. skip 은 건드리지 않을 색 집합."""
    W, H = cv.size
    src = cv.copy()
    for y in range(1, H):
        for x in range(W):
            if src.getpixel((x, y)) == wall:
                up = src.getpixel((x, y - 1))
                if up[3] == 255 and up != wall and up != shade and up not in skip:
                    cv.putpixel((x, y), shade)


def _eave2(cv, roof_ramp, wall, shade):
    """지붕 맨 아래 픽셀 바로 밑 두 칸을 그림자색으로(기준의 처마 그림자는 2칸)."""
    W, H = cv.size
    rset = set(tuple(c[:3]) for c in roof_ramp)
    for x in range(W):
        ys = [y for y in range(H) if cv.getpixel((x, y))[3] == 255 and tuple(cv.getpixel((x, y))[:3]) in rset]
        if not ys:
            continue
        yb = max(y for y in ys if y < 80) if any(y < 80 for y in ys) else None
        if yb is None:
            continue
        for k in (1, 2):
            if yb + k < H and cv.getpixel((x, yb + k)) == wall:
                cv.putpixel((x, yb + k), shade)


def _post(cv, wd, x0, y_top, y_bot):
    """기둥(기준): 폭 5 = d m m m d, 맨 위 2행은 b 몸, 맨 아래 행은 ddddd."""
    px.rect(cv, x0, y_top, x0 + 4, y_bot, wd[2])
    px.rect(cv, x0, y_top, x0, y_bot, wd[0]); px.rect(cv, x0 + 4, y_top, x0 + 4, y_bot, wd[0])
    px.rect(cv, x0 + 1, y_top, x0 + 3, y_top + 1, wd[1])
    px.rect(cv, x0, y_bot, x0 + 4, y_bot, wd[0])
    px.put(cv, x0 + 2, y_bot - 1, wd[1])                  # 발 바로 위: 가운데 한 칸 어둡게(기준의 dmbmd)


def _window(cv, wd, gl, hi, x0, y0, w=22, h=16):
    """창(기준에서 잰 구조): 바깥 틀 = 어두운 테 1 | 중간 2 | 안쪽 어두운 테 1. 칸 = 하늘빛 2줄 + 밝은 줄 1 + 주황 턱 1.
    윗테만 한 단 밝게(빛이 위에서 온다). 반환: 바깥 사각형(맨 아래 한 줄은 턱 그림자 자리)."""
    px.rect(cv, x0, y0, x0 + w - 1, y0 + h - 1, wd[2])
    px.rect(cv, x0, y0, x0 + w - 1, y0, wd[1]); px.rect(cv, x0, y0 + 1, x0 + w - 1, y0 + 1, wd[3])    # 윗테 + 하이라이트
    px.rect(cv, x0, y0, x0, y0 + h - 1, wd[1]); px.rect(cv, x0 + w - 1, y0, x0 + w - 1, y0 + h - 1, wd[0])
    px.rect(cv, x0, y0 + h - 1, x0 + w - 1, y0 + h - 1, wd[0])
    for gx in (x0 + 3, x0 + 12):
        for gy in (y0 + 3, y0 + 9):
            px.rect(cv, gx, gy, gx + 6, gy, wd[0]); px.rect(cv, gx, gy, gx, gy + 4, wd[0]); px.rect(cv, gx + 6, gy, gx + 6, gy + 4, wd[0])
            px.rect(cv, gx + 1, gy + 1, gx + 5, gy + 2, gl)
            px.rect(cv, gx + 1, gy + 3, gx + 5, gy + 3, hi)
            px.rect(cv, gx + 1, gy + 4, gx + 5, gy + 4, wd[3])
    return (x0, y0, x0 + w - 1, y0 + h)


# 문 — 「틀 안에 들어앉은 문짝」 개념을 규칙으로 그린다(기준 그림의 픽셀 배열을 옮겨 적지 않는다).
# 기준에서 잰 것은 층 구조와 수치뿐이다:
#  · 틀: 위로 둥글게 휘는 고리. 두께 = 바깥 윤곽 1 + 몸 2 + 안쪽 윤곽 1. 윗면 두 행에 밝은 하이라이트, 바깥 윤곽은 위쪽 5행 암(b)·아래 최암(d).
#  · 문짝: 폭 14 = 널빤지 3칸 + 틀 줄 1칸(b) 반복. 틀 안쪽 윤곽(d)에서 한 칸 들어가 있다.
#  · 아치가 문짝에 드리우는 그림자: 아치 안쪽 위에서 4~5행. 널빤지 몸 m→b, 널빤지 줄 b→d. 아랫선은 가운데보다 양옆이 한 행 더 길다.
#  · 아래: 걷어차기 판(밝은 주황 2행, 3칸씩 끊김) → 바닥선(최암 1행) → 그 아래 2행은 틀 다리만, 가운데는 비어 있다.
#  · 손잡이: 크림+금 2×2, 위·양옆·아래에 어두운 테.
def door_slot(x: int, w_old: int = 22) -> int:
    """옛 22px 문 자리 x 를 1칸 폭 문(16px) 자리로: 옛 문 가운데가 든 칸의 왼쪽 끝. 굽기(bake)의 입구 칸 계산과 같은 칸이다.
    원작 집 문은 정확히 한 칸(16px) — 22px 문은 두 칸에 걸쳐 어느 칸이 입구인지 그림으로 정해지지 않았다(적대 검수 L1 N8)."""
    return ((2 * x + w_old - 1) // 2 // T) * T


DOOR_W = 16


def _arch_door(cv, wd, gold, pl, x0, y0, w=DOOR_W, h=26):
    D, B, M, O = wd[0], wd[1], wd[2], wd[3]
    cx = w / 2.0
    arch = 5                                                        # 아치가 둥글게 휘는 행 수
    def half(r):                                                    # 행 r 의 바깥 반폭(원호)
        if r >= arch: return w / 2.0
        t = 1 - r / float(arch)
        return 6.0 + (w / 2.0 - 6.0) * (1 - t * t)
    def outer(r, x):
        return abs(x + 0.5 - cx) <= half(r)
    for r in range(h):
        for x in range(w):
            if not outer(r, x):
                continue
            edge = not outer(r - 1, x) or not outer(r, x - 1) or not outer(r, x + 1) if r < arch + 1 else (x == 0 or x == w - 1)
            if r >= 20 and r < 23 and (x == 0 or x == w - 1):
                c = B                                              # 벽 목재에 닿는 구간은 한 단 밝은 윤곽
            elif edge:
                c = B if r < arch else D
            else:
                c = M
            # 윗면 하이라이트(두 행): 고리 몸 위쪽
            if r in (1, 2) and not edge and 2 <= x <= w - 3 and abs(x + 0.5 - cx) <= half(r) - 2:
                c = O if (r == 1 or x <= 5 or x >= w - 6) else M
            px.put(cv, x0 + x, y0 + r, c)
    # 안쪽 열림(문짝 영역): 열 3..w-4, 아치 안쪽은 바깥보다 4칸 안으로
    left, right = 3, w - 4                                         # 안쪽 윤곽 열
    top_in = 3                                                     # 안쪽 윤곽이 시작되는 행
    def inner(r, x):
        if r < top_in: return False
        hw = half(r) - 4.0 if r < arch + 1 else (right - left) / 2.0
        return abs(x + 0.5 - cx) <= max(hw, 4.0)
    for r in range(top_in, 20):
        for x in range(left, right + 1):
            if not inner(r, x):
                continue
            if x in (left, right) or r == top_in or not inner(r - 1, x):
                px.put(cv, x0 + x, y0 + r, D); continue
            lx = x - (left + 1)                                    # 문짝 안쪽 열 번호 0..13
            seam = lx >= 2 and (lx - 2) % 4 == 0                   # 널빤지 줄: 2, 6, 10 열
            side_extra = 1 if (x <= left + 3 or x >= right - 3) else 0
            shade = r < top_in + 5 + side_extra and r >= top_in + 1
            if shade:
                c = D if seam else B
            else:
                c = B if seam else M
            px.put(cv, x0 + x, y0 + r, c)
    # 바닥 쪽
    for r in (20, 21, 22, 23):
        for x in range(left, right + 1):
            lx = x - (left + 1)
            if x in (left, right):
                px.put(cv, x0 + x, y0 + r, D); continue
            if r == 20:
                c = B if (lx >= 2 and (lx - 2) % 4 == 0) else M
            elif r in (21, 22):
                c = M if (w >= 20 and lx >= 2 and (lx - 2) % 4 == 0) else O      # 걷어차기 판: 3칸씩 끊김(1칸 폭 문은 판자 둘이라 한 줄로 잇는다)
            else:
                c = D                                               # 바닥선
            px.put(cv, x0 + x, y0 + r, c)
    for r in (24, 25):                                               # 다리만 남기고 비운다
        for x in range(w):
            px.put(cv, x0 + x, y0 + r, (0, 0, 0, 0))
        for x in list(range(0, 4)) + list(range(w - 4, w)):
            px.put(cv, x0 + x, y0 + r, D if (r == 25 or x in (0, 3, w - 4, w - 1)) else M)
    return (x0, y0, x0 + w - 1, y0 + h - 1)


def _door_knob(cv, wd, gold, pl, x0, y0, w=DOOR_W):
    """손잡이(벽 그림자 처리가 끝난 뒤 마지막에 찍는다 — 크림 점이 그림자색으로 바뀌지 않게)."""
    D, B, O = wd[0], wd[1], wd[3]
    kx, ky = x0 + w - (8 if w >= 20 else 7), y0 + 14
    for dx_, dy_ in ((0, -1), (1, -1), (-1, 0), (2, 0), (-1, 1), (2, 1), (0, 2), (1, 2)):
        px.put(cv, kx + dx_, ky + dy_, B if dy_ < 1 and dx_ in (-1, 2) else D if dy_ > 0 else B)
    px.put(cv, kx, ky, pl[1]); px.put(cv, kx + 1, ky, gold[1]); px.put(cv, kx, ky + 1, gold[1]); px.put(cv, kx + 1, ky + 1, O)


def gable(P, roof_key="roof_green", seed="gable", roles=None):
    """박공 집 112×112(2026-10-07 다시 그림 — 몬스터 마을 건물 문법, buildings.py 머리말).
    지붕은 앞으로 뻗은 용마루(가운데 세로 기둥) 양쪽 두 경사면: 기와 줄이 처마선과 나란히 비스듬히 내려가고,
    왼쪽 면은 빛을 받아 밝고 오른쪽 면은 한 단 어둡다. 아래는 박공 삼각 벽(창 하나) + 나무 들보 + 1층 벽(창 둘·문).
    창·문 사각형, 문 칸, 칸별 투명 등급은 옛 그림과 같다."""
    import buildings as bd
    rf, wd = P[roof_key], P["wood"]
    ol = bd.OL(P)
    wc, dw, st = bd.pal(P, "wall_cream"), bd.pal(P, "door_wood"), bd.pal(P, "stone")
    W = H = 112
    cv = px.new(W, H)
    cx = 56
    base, shade = wc[2], wc[1]
    def edge_top(x):    # 처마 위쪽 선: 양끝 28 → 가운데 0
        return int(28 * (abs(x + 0.5 - cx) - 5) / (cx - 5)) if abs(x + 0.5 - cx) > 5 else 0
    def edge_bot(x):    # 아래 선: 양끝 78 → 가운데 56
        d = abs(x + 0.5 - cx)
        return int(56 + 22 * max(0, d - 5) / (cx - 5)) if d > 5 else 56
    X0, X1 = 4, W - 5                                                     # 1층 벽 실루엣(옛 그림과 같은 폭)
    # 1) 박공 삼각 벽 + 1층 벽 바탕
    for y in range(52, H - 1):
        for x in range(W):
            if y >= 78 and not (X0 <= x <= X1):
                continue
            cv.putpixel((x, y), base)
    # 2) 지붕 두 면: 처마선과 나란한 기와 줄(높이 4). v = 처마선에서 위로 잰 거리.
    for x in range(W):
        d = abs(x + 0.5 - cx)
        if d < 5:
            continue
        left = x < cx
        t0, b0 = edge_top(x), edge_bot(x)
        tones = (rf[4], rf[3], rf[3], rf[1]) if left else (rf[3], rf[2], rf[2], rf[0])
        for y in range(t0, b0):
            v = b0 - 1 - y
            if v <= 1:                                                    # 처마 판: 윤곽 + 밝은 선
                c = ol if v == 0 else (rf[4] if left else rf[2])
            else:
                rv = v - 2
                row, k = rv // 4, 3 - (rv % 4)                            # k=0 줄 윗선(밝음) … 3 밑선(어두움)
                u = (x + 2 * (row % 2)) % 4
                c = tones[k]
                if k == 2 and u == 0:
                    c = tones[3] if not left else rf[2]
                if k == 3 and u in (1, 2):
                    c = rf[2] if left else rf[1]
            cv.putpixel((x, y), c)
        cv.putpixel((x, t0), ol)
    # 3) 용마루(앞으로 뻗은 기둥): 왼쪽 밝음·오른쪽 어둠, 6행마다 마디, 양끝 둥근 마개
    for y in range(0, 56):
        for i, c in enumerate((ol, rf[4], rf[4], rf[3], rf[3], rf[3], rf[2], rf[2], rf[1], ol)):
            cv.putpixel((cx - 5 + i, y), c)
        if y % 6 == 5:
            for i in range(1, 9):
                cv.putpixel((cx - 5 + i, y), rf[1] if i < 8 else rf[0])
    for (ya, yb) in ((0, 7), (48, 55)):
        px.rect(cv, cx - 4, ya, cx + 3, yb, rf[3]); px.rect(cv, cx - 4, ya, cx - 3, yb, rf[4])
        px.rect(cv, cx + 2, ya, cx + 3, yb, rf[1]); px.rect(cv, cx - 4, ya + 1, cx + 3, ya + 1, rf[4])
        px.rect(cv, cx - 5, ya, cx + 4, ya, ol); px.rect(cv, cx - 5, yb, cx + 4, yb, ol)
    for y in range(0, 56):
        cv.putpixel((cx - 5, y), ol); cv.putpixel((cx + 4, y), ol)
    # 4) 박공 벽: 처마 그늘 2행
    for x in range(W):
        b0 = edge_bot(x) if abs(x + 0.5 - cx) >= 5 else 56
        for k_, c_ in ((0, wc[0]), (1, wc[1])):
            if 0 <= b0 + k_ < 79 and cv.getpixel((x, b0 + k_)) == base:
                cv.putpixel((x, b0 + k_), c_)
    # 5) 나무 들보(1층 지붕선): 처마 바깥으로 2px 내민다
    for yy, c_ in zip(range(78, 84), (ol, dw[3], dw[2], dw[2], dw[1], ol)):
        px.rect(cv, X0 - 2, yy, X1 + 2, yy, c_)
    px.rect(cv, X0 - 2, 78, X0 - 2, 83, ol); px.rect(cv, X1 + 2, 78, X1 + 2, 83, ol)
    for yy in range(84, H):                                               # 들보 밑 처마 바깥(기둥 밖)은 비운다
        for xx in list(range(0, X0)) + list(range(X1 + 1, W)):
            cv.putpixel((xx, yy), (0, 0, 0, 0))
    # 6) 1층 벽: 처마 그늘 · 허리 띠 · 돌 기초 · 모서리 기둥
    last = H - 2
    px.rect(cv, X0, 84, X1, 84, wc[0]); px.rect(cv, X0, 85, X1, 85, wc[1])
    lo = last - 5
    px.rect(cv, X0, lo, X1, last, shade); px.rect(cv, X0, lo, X1, lo, wc[3]); px.rect(cv, X0, lo + 1, X1, lo + 1, wc[0])
    px.rect(cv, X0, last - 2, X1, last - 2, st[3]); px.rect(cv, X0, last - 1, X1, last - 1, st[1])
    for x in range(X0 + 5, X1, 7):
        cv.putpixel((x, last - 2), st[1])
    px.rect(cv, X0, last, X1, last, ol)
    for xp, side in ((X0 + 1, 0), (X1 - 3, 1)):
        px.rect(cv, xp, 84, xp, last - 3, dw[3]); px.rect(cv, xp + 1, 84, xp + 1, last - 3, dw[2]); px.rect(cv, xp + 2, 84, xp + 2, last - 3, dw[1])
        xi = xp + 3 if side == 0 else xp - 1
        px.rect(cv, xi, 84, xi, last - 3, ol)
        px.rect(cv, xp, last - 3, xp + 2, last - 3, dw[0])
    # 7) 창·문(옛 자리 그대로)
    wins = [bd.window(P, cv, 45, 61), bd.window(P, cv, 17, 87), bd.window(P, cv, 73, 87)]
    dx0 = door_slot(45)
    door = bd.door(P, cv, dx0, 86)
    bd.shade_under(cv, base, shade, 0, W - 1, 53, last)
    for y in range(84, last + 1):
        cv.putpixel((X0, y), ol); cv.putpixel((X1, y), ol)
    bd.outline_silhouette(cv, ol)
    if roles is not None:
        roles.update({"door_kind": "wood", "shadow_rgb": list(P["plaster"][0][:3]), "roof_ramp": roof_key, "roof_ymax": 78, "wall": [[34, 72, 78, 79], [14, 86, 98, 102]],
                      "openings": [list(w_) for w_ in wins] + [list(door)],
                      "windows": [list(w_) for w_ in wins], "doors": [list(door)]})
    return cv


def cut(im, prefix):
    out = {}
    for ry in range(im.height // T):
        for cx in range(im.width // T):
            out[f"{prefix}.{cx}.{ry}"] = im.crop((cx * T, ry * T, cx * T + T, ry * T + T))
    return out
