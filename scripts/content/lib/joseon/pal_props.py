"""조선 궁 기물 1: 정전 어좌 홀 (일월오봉 병풍·용상·대형 향로·큰 북·종 걸이·등롱·드므).

시점은 실내 v5·후보 B 와 같다 — 앞면 + 윗면 3~5px, 빛은 왼쪽 위. 목재는 마루 바닥보다 밝게, 놋쇠는 persimmon 4·5 단, 쇠는 giwa 2~4 단,
칠은 red 램프, 단청은 dgreen·dblue·red. 조각마다 B.outline(inset 외곽선). 색은 잠긴 팔레트 램프로만 고른다.
"""
from inb_tk import *
import props5 as P5
from inb_props import _top, _front, BR, IR

PN = RGB['pine']
WT = RGB['water']


def _fp(cv, pts, fn):
    fillpoly(cv, pts, fn)

def dragon(cv, x0, y0, L, amp, vertical=False, flip=False, waves=2.2, thick=1.5, hi=None, mid=None, lo=None):
    """금빛 용 문양(꼬리 → 머리): 사인 곡선을 굽이치는 몸통(머리 쪽이 굵다) + 비늘 점 + 뿔 둘·눈·수염의 머리.
    (x0,y0) 꼬리 끝, L 길이(가로면 +x, vertical 이면 +y), amp 굽이 폭, flip 이면 굽이 방향을 뒤집는다."""
    import math
    hi = hi or PS[6]; mid = mid or PS[5]; lo = lo or PS[3]
    N = int(abs(L) * 2)
    pts = []
    for i in range(N + 1):
        t = i / N
        a = amp * math.sin(t * math.pi * waves + 0.5) * (0.5 + 0.5 * t) * (-1 if flip else 1)
        pts.append((x0 + a, y0 + L * t, t) if vertical else (x0 + L * t, y0 + a, t))
    for (x, y, t) in pts:
        r = thick * (0.5 + 0.75 * t)
        disc(cv, x, y, r + 0.4, lo)
    for (x, y, t) in pts:
        r = thick * (0.5 + 0.75 * t)
        disc(cv, x, y, r, mid)
    for k, (x, y, t) in enumerate(pts):
        r = thick * (0.5 + 0.75 * t)
        if k % 2 == 0:
            cv.put(int(x - r * 0.4), int(y - r * 0.6), hi)                               # 윗선 반사
        if k % 3 == 1:
            cv.put(int(x + r * 0.3), int(y + r * 0.5), lo)                               # 비늘 점
    hx, hy, _ = pts[-1]
    sg = 1 if L > 0 else -1
    sx, sy = ((0, sg) if vertical else (sg, 0))
    px, py = (sy, sx)                                                                    # 몸통 직각 방향
    disc(cv, hx + sx * 2, hy + sy * 2, 3.0, lo); disc(cv, hx + sx * 2, hy + sy * 2, 2.4, mid)       # 머리
    cv.rect(int(hx + sx * 4 - (1 if not vertical else 2)), int(hy + sy * 4 - (2 if not vertical else 1)), int(hx + sx * 5 + 2), int(hy + sy * 5 + 2), mid) if False else None
    disc(cv, hx + sx * 5, hy + sy * 5, 1.6, mid)                                         # 주둥이
    cv.put(int(hx + sx * 2 + px * 1.5), int(hy + sy * 2 + py * 1.5), RD[1])             # 눈
    for sgn in (-1, 1):                                                                  # 뿔
        line(cv, int(hx + sx * 1 + px * 2 * sgn), int(hy + sy * 1 + py * 2 * sgn), int(hx - sx * 2 + px * 4 * sgn), int(hy - sy * 2 + py * 4 * sgn), hi)
    return pts



# ----------------------------------------------------------------------------------------------------- 일월오봉 병풍 7×3
def ilwol_byeongpung():
    """일월오봉도 병풍(대형 112×48): 붉은 칠 틀, 짙은 청 바탕, 왼쪽 붉은 해·오른쪽 흰 달, 다섯 봉우리(가운데가 가장 높다), 물결, 양끝 소나무."""
    W_, H_ = 112, 48
    cv = Cv(W_, H_)
    # 틀: 윗 널(윗면이 보인다) + 붉은 칠 테두리
    cv.rect(0, 2, W_, 46, RD[3])
    cv.hl(0, W_, 2, RD[6]); cv.hl(0, W_, 3, RD[5]); cv.hl(0, W_, 4, RD[4])
    cv.vl(0, 2, 46, RD[5]); cv.vl(1, 4, 46, RD[4]); cv.vl(W_ - 1, 2, 46, RD[1]); cv.vl(W_ - 2, 4, 46, RD[2])
    cv.hl(0, W_, 44, RD[2]); cv.hl(0, W_, 45, RD[1])
    # 청 바탕(안쪽): 윗부분이 밝은 하늘
    x0, x1, y0, y1 = 5, W_ - 5, 8, 42
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = 3 if y < y0 + 7 else (2 if y < y0 + 17 else 1)
            q = rnd(x, y, 1010)
            cv.put(x, y, DB[t + (1 if q > 0.93 else 0) - (1 if (q < 0.08 and t > 1) else 0)])
    cv.hl(x0 - 1, x1 + 1, y0 - 1, PS[3]); cv.hl(x0 - 1, x1 + 1, y1, PS[3])               # 금박 안테두리
    cv.vl(x0 - 1, y0 - 1, y1 + 1, PS[3]); cv.vl(x1, y0 - 1, y1 + 1, PS[2])
    # 해(왼쪽)·달(오른쪽)
    disc(cv, 27, 17, 5.2, RD[5]); disc(cv, 26, 16, 3.2, PS[5]); disc(cv, 25, 15, 1.4, PS[6])
    disc(cv, 85, 17, 5.2, PL[5]); disc(cv, 84, 16, 3.4, PL[6]); cv.put(87, 19, PL[4]); cv.put(86, 20, PL[4])
    # 다섯 봉우리: (중심 x, 높이, 반폭) 바깥으로 갈수록 낮다. 밑선 y=34.
    base = 36
    peaks = [(56, 24, 12), (38, 18, 10), (74, 18, 10), (22, 12, 8), (90, 12, 8)]
    for (cx, hh, hw) in sorted(peaks, key=lambda p: p[1]):
        top = base - hh
        pts = [(cx, top), (cx + hw, base), (cx - hw, base)]
        _fp(cv, pts, lambda x, y, cx=cx, top=top, hh=hh: (DG[5] if (x < cx - 1 and (y - top) < hh * 0.5) else (DG[4] if x < cx else (DG[2] if (y - top) > hh * 0.4 else DG[3]))))
        for k in range(0, hh * 2 // 3, 3):                                               # 주름(윗부분은 밝은 돌, 아래는 숲 점)
            cv.put(cx - 2 - k // 3, top + 3 + k, DG[6] if k % 2 == 0 else DG[3])
        cv.hl(cx - 1, cx + 2, top, PL[5])                                                # 봉우리 꼭대기 흰 기운
        cv.put(cx, top - 1, PL[4]) if False else None
    # 물결: 두 줄 부채꼴
    for y0w, tone in ((base - 1, 0), (base + 3, 1)):
        for x in range(x0, x1):
            ph = (x + tone * 4) % 8
            yy = y0w + (0 if ph < 4 else 1)
            cv.put(x, yy, PL[5] if ph in (1, 2) else DB[5])
            cv.put(x, yy + 1, DB[4] if ph < 4 else DB[3])
            cv.put(x, yy + 2, DB[3] if ph < 4 else DB[2])
    # 양끝 소나무(붉은 줄기 + 층층 솔잎: 세 층 삼각 부채, 왼쪽이 밝다)
    for tx in (11, W_ - 12):
        cv.rect(tx - 1, 26, tx + 2, 40, WD[3]); cv.vl(tx - 1, 26, 40, WD[4]); cv.vl(tx + 1, 26, 40, WD[2])
        for (y0t, hh, hw) in ((11, 8, 7), (17, 8, 8), (23, 9, 9)):
            _fp(cv, [(tx, y0t), (tx + hw, y0t + hh), (tx - hw, y0t + hh)],
                lambda x, y, tx=tx, y0t=y0t, hh=hh: (PN[5] if (x < tx - 2 and (y - y0t) < hh - 3) else (PN[4] if x < tx else (PN[2] if (y - y0t) > hh - 3 else PN[3]))))
    # 병풍 마디(8폭): 윗 널 아래에서 아랫 널 위까지 이음 선(1px, 한 단 어둡게)
    for k in range(1, 8):
        sx = x0 + (x1 - x0) * k // 8
        for y in range(y0, y1):
            c = tuple(cv.a[y, sx, :3])
            cv.put(sx, y, step(c, 1))
    # 아래 받침(발) 두 개
    for fx in (10, W_ - 18):
        cv.rect(fx, 44, fx + 8, 48, WD[3]); cv.hl(fx, fx + 8, 44, WD[5]); cv.hl(fx, fx + 8, 47, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 용상 3×2
def yongsang():
    """용상(왕의 의자) 48×32: 금박 두른 붉은 높은 등받이 + 용 문양, 금 팔걸이, 붉은 비단 방석, 밑에 족좌."""
    W_, H_ = 48, 32
    cv = Cv(W_, H_)
    # 등받이(가운데가 솟은 구름 모양 머리)
    for y in range(0, 18):
        hw = 16 if y > 3 else 10 + y * 2
        for x in range(24 - hw, 24 + hw):
            f = (x - (24 - hw)) / max(1, 2 * hw - 1)
            cv.put(x, y, RD[5] if f < 0.2 else (RD[4] if f < 0.6 else RD[3]))
    cv.hl(8, 40, 3, PS[5]); cv.hl(8, 40, 4, PS[3])                              # 윗 금테
    cv.hl(14, 34, 0, PS[6]); cv.hl(14, 34, 1, PS[4])
    cv.vl(8, 4, 18, PS[5]); cv.vl(9, 4, 18, PS[3]); cv.vl(38, 4, 18, PS[3]); cv.vl(39, 4, 18, PS[2])
    # 용: 꼬리(왼쪽)에서 머리(오른쪽 위)까지 굽이치는 금빛 용 한 마리 + 구름 점
    dragon(cv, 11, 11, 23, 3.4, thick=1.7, waves=1.8)
    disc(cv, 24, 6, 1.7, PS[6]); cv.put(23, 5, PL[6])                                               # 여의주
    for (cx, cy) in ((11, 5), (33, 14), (19, 15)):
        cv.rect(cx - 1, cy, cx + 2, cy + 2, PS[3]); cv.put(cx, cy - 1, PS[4])                                                 # 구름
    # 팔걸이(금 장식 붉은 기둥) — 윗면 2px + 앞면
    for (ax, lit) in ((3, True), (39, False)):
        cv.rect(ax, 12, ax + 6, 22, RD[4]); cv.hl(ax, ax + 6, 12, PS[6]); cv.hl(ax, ax + 6, 13, PS[4])
        cv.vl(ax, 14, 22, RD[5] if lit else RD[3]); cv.vl(ax + 5, 14, 22, RD[2])
        cv.hl(ax, ax + 6, 21, PS[3])
    # 방석(윗면)과 앞면
    for y in range(16, 22):
        for x in range(9, 39):
            cv.put(x, y, RD[6] if (y == 16 or x == 9) else RD[5])
    cv.hl(9, 39, 21, PS[4])
    for x in range(9, 39):
        cv.put(x, 22, RD[3]); cv.put(x, 23, RD[3] if (x // 4) % 2 else RD[2]); cv.put(x, 24, RD[2])
    cv.hl(9, 39, 25, PS[4]); cv.hl(9, 39, 26, PS[2])
    for x in range(12, 38, 4):                                                       # 앞 판 금 문양(작은 마름모)
        cv.rect(x, 22, x + 2, 24, PS[4]) if False else cv.put(x + 1, 23, PS[5])
    # 족좌 + 발
    for y in range(27, 31):
        for x in range(13, 35):
            cv.put(x, y, RD[4] if y == 27 else (RD[3] if y < 29 else RD[1]))
    cv.hl(13, 35, 27, RD[6]); cv.hl(13, 35, 28, PS[3])
    for fx in (9, 37):
        cv.rect(fx, 26, fx + 3, 31, PS[3]); cv.vl(fx, 26, 31, PS[5])
    cv.hl(6, 42, 31, RD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 대형 향로 2×2
def hyangro(kind='a'):
    """대형 향로(32×32): 세 발 달린 놋쇠 솥 + 두 귀 + 뚜껑(a) 또는 열린 화구(b), 위로 향 연기."""
    cv = Cv(32, 32)
    ramp = ST if kind == 'a' else BR
    body_t = (5, 4, 3, 2) if kind == 'a' else (4, 3, 2, 1)
    # 발(밑 3개)
    for fx in (6, 15, 24):
        cv.rect(fx, 28, fx + 3, 31, BR[3]); cv.vl(fx, 28, 31, BR[5])
    # 솥 몸통
    P5.cyl(cv, 16, 17, 11, 8, ramp, top=(6, 5), body=body_t)
    # 허리 띠(금색 문양 띠)
    for x in range(6, 27):
        cv.put(x, 22, PS[4]); cv.put(x, 23, PS[3] if x % 3 else PS[5])
    # 귀(손잡이) 양쪽
    for (ex, s) in ((3, -1), (28, 1)):
        cv.rect(ex, 14, ex + 2, 20, BR[4]); cv.hl(ex, ex + 2, 14, BR[6]); cv.rect(ex + (0 if s < 0 else -1), 20, ex + 3, 22, BR[2])
    if kind == 'a':                                                                   # 뚜껑 돔 + 꼭지(사자)
        P5.ell(cv, 16, 14, 7, 4.2, lambda x, y, u, v: BR[5] if (u < -0.3 and v < 0.1) else (BR[4] if v < 0.5 else BR[3]))
        cv.rect(14, 8, 18, 11, BR[5]); cv.hl(14, 18, 8, BR[6]); cv.put(15, 9, PS[6]); cv.put(17, 10, BR[2])
        for k in range(5):                                                            # 뚜껑 구멍(연기가 나오는)
            cv.put(12 + k * 2, 13 + (k % 2), BR[1])
        smoke = ((16, 5, 2.2, PL[5]), (18, 3, 2.0, GI[6]), (15, 1, 2.4, PL[4]), (19, 0, 1.6, GI[5]))
    else:                                                                             # 열린 화구: 재와 불씨, 향 연기 두 줄기
        P5.ell(cv, 16, 14, 8.2, 3.6, lambda x, y, u, v: BR[6] if (u < -0.4 and v < 0.2) else (BR[5] if v < 0.4 else BR[4]))
        P5.ell(cv, 16, 14.3, 6.2, 2.3, lambda x, y, u, v: GI[2] if v > 0.2 else GI[3])
        for (x, y, c) in ((13, 14, PS[5]), (16, 13, RD[5]), (18, 14, PS[6]), (15, 15, RD[4]), (20, 14, RD[5])):
            cv.rect(x, y, x + 2, y + 1, c)
        smoke = ((13, 9, 2.0, PL[5]), (12, 6, 2.2, GI[6]), (14, 3, 2.0, PL[4]), (20, 8, 2.0, GI[5]), (21, 5, 2.2, PL[5]), (19, 2, 1.8, GI[6]))
    for (sx, sy, r, c) in smoke:
        disc(cv, sx, sy, r, c)
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 큰 북 2×3
def buk_big():
    """큰 북(32×48): 나무 틀 두 기둥과 윗 가로대에 줄로 매단 붉은 큰 북. 가죽 면에 삼태극, 금 못, 아래 마루 받침."""
    W_, H_ = 32, 48
    cv = Cv(W_, H_)
    # 틀: 기둥 둘 + 윗 가로대(윗면 3px)
    for (px, lit) in ((2, True), (26, False)):
        cv.rect(px, 5, px + 4, 43, WD[4]); cv.vl(px, 5, 43, WD[5] if lit else WD[4]); cv.vl(px + 3, 5, 43, WD[2])
    _top(cv, 1, 1, 30, 4, WD)
    for x in range(1, 31):
        cv.put(x, 5, WD[4]); cv.put(x, 6, WD[3]); cv.put(x, 7, WD[2])
    # 단청 끝(가로대 양끝 작은 띠)
    for x in range(1, 7):
        cv.put(x, 6, DG[4] if x % 2 else RD[4])
    for x in range(25, 31):
        cv.put(x, 6, DB[4] if x % 2 else RD[4])
    # 북(몸통은 두께가 보이는 원통, 앞은 가죽 면)
    cx, cy = 16, 26
    P5.ell(cv, cx, cy - 2, 12.4, 12.4, lambda x, y, u, v: RD[4] if (u + v) < 0.3 else RD[3])                    # 뒷 몸통(두께)
    P5.ell(cv, cx, cy, 11.6, 11.6, lambda x, y, u, v: RD[5] if (u < -0.4 and v < -0.2) else RD[3])                # 붉은 테
    P5.ell(cv, cx, cy, 9.0, 9.0, lambda x, y, u, v: PL[6] if (u * u + v * v) < 0.55 and (u < -0.2) else (PL[5] if (u * u + v * v) < 0.7 else SW[5]))   # 가죽 면
    for k in range(12):                                                                                       # 금 못
        a = k * 3.14159 / 6
        import math
        px, py = int(round(cx + 10.3 * math.cos(a))), int(round(cy + 10.3 * math.sin(a)))
        cv.put(px, py, PS[6] if k < 6 else PS[4])
    for (dx, dy, c) in ((-1, -2, RD[5]), (0, -2, RD[5]), (1, -2, RD[5]), (-2, 0, DB[4]), (-1, 0, DB[4]), (-2, 1, DB[4]), (1, 0, PS[5]), (2, 0, PS[5]), (1, 1, PS[5]), (0, 2, DB[4]), (-1, 2, RD[5]), (1, 2, RD[5])):
        cv.put(cx + dx, cy + dy, c)                                                                            # 삼태극
    # 매다는 줄
    line(cv, 8, 8, 9, 15, SW[4]); line(cv, 24, 8, 23, 15, SW[3])
    # 받침 마루
    for y in range(41, 47):
        for x in range(0, 32):
            cv.put(x, y, WD[5] if y == 41 else (WD[4] if y < 44 else WD[2]))
    cv.hl(0, 32, 47, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 종 걸이 3×3
def jong_geori():
    """종 걸이(48×48): 두 기둥과 윗 가로대(단청 끝)에 용뉴로 매단 놋쇠 큰 종 + 앞에 매단 당목(치는 통나무), 마루 받침."""
    W_, H_ = 48, 48
    cv = Cv(W_, H_)
    for (px, lit) in ((3, True), (41, False)):
        cv.rect(px, 8, px + 5, 43, WD[4]); cv.vl(px, 8, 43, WD[5] if lit else WD[4]); cv.vl(px + 4, 8, 43, WD[2])
        cv.hl(px - 1, px + 6, 8, WD[6]) if lit else cv.hl(px - 1, px + 6, 8, WD[5])
    _top(cv, 1, 2, 46, 5, WD)
    for x in range(1, 47):
        cv.put(x, 7, WD[4]); cv.put(x, 8, WD[3]); cv.put(x, 9, WD[2])
    for x in range(1, 47):                                                           # 가로대 앞면에 단청 마디
        k = (x // 4) % 4
        cv.put(x, 7, (DG[5], RD[5], DB[5], RD[5])[k]); cv.put(x, 8, (DG[4], RD[4], DB[4], RD[4])[k])
    # 종: 위 용뉴(고리), 어깨 둥글고 아래로 넓어지는 놋쇠 몸통, 아래 입술 두께
    cx = 24
    cv.rect(cx - 2, 10, cx + 3, 14, BR[5]); cv.vl(cx - 2, 10, 14, BR[6]); cv.hl(cx - 2, cx + 3, 10, BR[6]); cv.vl(cx + 2, 10, 14, BR[3])
    cv.put(cx - 3, 13, BR[4]); cv.put(cx + 3, 13, BR[3])
    for y in range(14, 38):
        t = (y - 14) / 23.0
        hw = (5, 7, 8)[y - 14] if y < 17 else 8 + int(round(2.6 * t ** 3))
        for x in range(cx - hw, cx + hw + 1):
            f = (x - (cx - hw)) / max(1, 2 * hw)
            c = BR[6] if f < 0.12 else (BR[5] if f < 0.4 else (BR[4] if f < 0.7 else (BR[3] if f < 0.9 else BR[2])))
            cv.put(x, y, c)
    for (y, hw) in ((21, 8), (28, 9)):                                               # 허리 띠(음각 두 줄)
        cv.hl(cx - hw, cx + hw + 1, y, BR[2]); cv.hl(cx - hw, cx + hw + 1, y + 1, BR[6])
    for (x, y) in ((cx - 5, 17), (cx - 1, 17), (cx + 3, 17), (cx - 5, 24), (cx - 1, 24), (cx + 3, 24)):             # 유두(젖꼭지 돌기)
        cv.rect(x - 1, y, x + 1, y + 2, BR[6]); cv.put(x + 1, y + 1, BR[2])
    cv.hl(cx - 12, cx + 13, 36, BR[6]); cv.hl(cx - 12, cx + 13, 37, BR[2])             # 종 입술
    cv.hl(cx - 11, cx + 12, 38, BR[1])
    # 당목(앞 오른쪽에 줄로 매단 통나무)
    for y in range(31, 35):
        for x in range(20, 45):
            cv.put(x, y, WD[6] if y == 31 else (WD[4] if y < 34 else WD[2]))
    cv.vl(44, 31, 35, WD[1])
    line(cv, 30, 9, 30, 30, SW[3]); line(cv, 40, 9, 40, 30, SW[3])
    # 받침
    for y in range(41, 47):
        for x in range(0, 48):
            cv.put(x, y, WD[5] if y == 41 else (WD[4] if y < 44 else WD[2]))
    cv.hl(0, 48, 47, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 등롱(서 있는 것·벽 걸이)
def deungnong_stand(kind='a'):
    """서 있는 등롱 1×2: 나무 기둥 위 종이 등. a=붉은 사등, b=청·홍 사초롱(위 푸른 띠). 안에 노란 불빛."""
    cv = Cv(16, 32)
    cv.rect(7, 12, 9, 28, WD[4]); cv.vl(7, 12, 28, WD[5]); cv.vl(8, 12, 28, WD[3])
    for x in range(3, 13):
        cv.put(x, 28, WD[4] if x < 8 else WD[3]); cv.put(x, 29, WD[2])
    cv.hl(2, 14, 30, WD[1]); cv.hl(4, 12, 27, WD[5])
    # 등(타원 몸통 + 위아래 뚜껑)
    P5.ell(cv, 8, 7, 5.2, 5.4, lambda x, y, u, v: (DB[4] if (kind == 'b' and v < -0.35) else (RD[6] if (u < -0.35 and v < 0) else (RD[5] if u < 0.35 else RD[3]))))
    P5.ell(cv, 8, 7, 2.8, 3.6, lambda x, y, u, v: PS[6] if (u * u + v * v) < 0.35 else PS[5])
    for yy in (4, 7, 10):                                                                  # 대살 가로 띠
        cv.hl(4, 13, yy, RD[2] if kind == 'a' else DB[2])
    cv.hl(5, 12, 1, WD[2]); cv.hl(6, 11, 0, WD[1]); cv.hl(5, 12, 2, WD[5]); cv.hl(6, 11, 12, WD[2]); cv.hl(5, 12, 11, WD[4])
    cv.put(8, 13, RD[4]); cv.put(7, 14, RD[3]); cv.put(9, 14, RD[3])                          # 매듭 술
    B.outline(cv)
    return cv


def hang_deungnong(kind='a'):
    """벽에 거는 등롱 1×1(벽면 윗줄): 쇠 팔에 매단 등. 밑에 술(2px 폭)."""
    cv = Cv(16, 16)
    cv.hl(3, 13, 0, IR[4]); cv.hl(3, 13, 1, IR[2]); cv.rect(3, 0, 5, 4, IR[3]); cv.rect(11, 0, 13, 4, IR[3])
    P5.ell(cv, 8, 8, 4.8, 5.0, lambda x, y, u, v: (RD[6] if (u < -0.35 and v < 0) else (RD[5] if u < 0.35 else RD[3])) if kind == 'a' else (DB[5] if (u < -0.35 and v < 0) else (DB[4] if u < 0.35 else DB[3])))
    P5.ell(cv, 8, 8, 2.6, 3.4, lambda x, y, u, v: PS[6] if (u * u + v * v) < 0.35 else PS[5])
    for yy in (6, 9):
        cv.hl(4, 13, yy, RD[2] if kind == 'a' else DB[2])
    cv.hl(5, 12, 3, WD[2]); cv.hl(5, 12, 13, WD[2])
    cv.rect(7, 14, 10, 16, RD[4]); cv.put(7, 15, RD[3])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 드므 2×2
def deumeu(kind='a'):
    """드므(불을 막는 큰 물독) 2×2: 돌 받침 위 넓적한 청동 독, 위 윗면에 물. a=맑은 물, b=낙엽이 뜬 물."""
    cv = Cv(32, 32)
    # 돌 받침
    for y in range(24, 31):
        for x in range(4, 28):
            cv.put(x, y, ST[5] if (y == 24 or x < 8) else (ST[4] if x < 20 else ST[3]))
    cv.hl(4, 28, 30, ST[1]); cv.hl(5, 27, 25, ST[6])
    P5.cyl(cv, 16, 13, 13, 9, IR, top=(5, 4), body=(5, 4, 3, 2), open_ring=(0.78, WT[3], WT[4]))
    # 물 반짝임 / 변형
    cv.rect(10, 11, 14, 12, WT[5]); cv.put(11, 10, PL[6])
    if kind == 'b':
        for (x, y) in ((17, 13), (20, 12), (15, 15)):
            cv.rect(x, y, x + 3, y + 1, PS[4]); cv.put(x + 1, y + 1, PS[3])
    else:
        cv.hl(18, 22, 14, WT[5]); cv.hl(13, 17, 15, WT[2])
    # 몸통 띠(두 줄 돌기)
    for x in range(4, 29):
        cv.put(x, 17, IR[5] if x < 12 else IR[3]); cv.put(x, 18, IR[2])
    for (x, y) in ((8, 20), (16, 22), (23, 20)):                                       # 도깨비 얼굴 흉내 점
        cv.put(x, y, IR[5])
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['pal_ilwol_byeongpung'] = ilwol_byeongpung()
    d['pal_yongsang'] = yongsang()
    d['pal_hyangro_a'] = hyangro('a')
    d['pal_hyangro_b'] = hyangro('b')
    d['pal_buk_big'] = buk_big()
    d['pal_jong_geori'] = jong_geori()
    d['pal_deungnong_a'] = deungnong_stand('a')
    d['pal_deungnong_b'] = deungnong_stand('b')
    d['pal_hang_deungnong_a'] = hang_deungnong('a')
    d['pal_hang_deungnong_b'] = hang_deungnong('b')
    d['pal_deumeu_a'] = deumeu('a')
    d['pal_deumeu_b'] = deumeu('b')
    return d
