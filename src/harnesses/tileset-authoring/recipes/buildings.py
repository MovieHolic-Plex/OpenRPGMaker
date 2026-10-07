"""몬스터 수집 야외 건물 — 기준 팩의 집 구조(읽은 것)를 좌표로 다시 그린다.

기준 구조: 지붕은 어긋쌓기 벽돌(3톤, 줄눈·바깥 윤곽), 위 두 줄은 먼 쪽이라 어둡고 그 아래 용마루 띠 양끝에 금빛 마감.
처마는 갈색 보, 벽은 크림 회벽 + 목조 기둥(양끝)·모서리 가새, 아치 문, 4칸 유리창(창 밑 그림자).
박공형은 두 경사면(왼쪽 밝고 오른쪽 어두움, 세로 비늘) + 가운데 금빛 용마루 기둥 + 박공 삼각 벽에 창.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402

ROOF_KEYS = ("roof_green", "roof_purple", "roof_red", "roof_blue")
# 지붕 높이(px). 통합 I4 W1: 원작 민가는 4칸 높이(지붕 2줄 + 벽 2줄)다 — 옛 49행 지붕은 집을 5칸으로 키웠다.
# 지붕 33 + 벽 31 = 64 = 4칸. 다른 시트(눈·재 덮개)는 49 를 적지 말고 이 상수를 읽는다.
ROOF_H = 33
WALL_H = 31
HOUSE_H = ROOF_H + WALL_H


def _roof_ramp(P, key):
    return P[key]  # [최암, 암, 중, 명, 최명]


def _bricks(cv, x0, y0, x1, y1, ramp, r, dark=False, jx=10):
    """어긋쌓기 벽돌로 [x0,x1)×[y0,y1) 를 채운다. 줄눈은 암, 벽돌 톤은 중/명(먼 쪽이면 암/중)."""
    base, lite = (ramp[3], ramp[4]) if not dark else (ramp[2], ramp[3])
    joint = ramp[2] if not dark else ramp[1]
    bh = 8
    row = 0
    y = y0
    while y < y1:
        x = x0 - (0 if row % 2 == 0 else r.randint(3, 8))
        while x < x1:
            bw = r.randint(jx, jx + 8)
            tone = lite if r.random() < 0.28 else base
            for yy in range(y, min(y1, y + bh)):
                for xx in range(max(x0, x), min(x1, x + bw)):
                    c = tone
                    if yy == y + bh - 1 or xx == x + bw - 1 or yy >= y1 - 0:
                        c = joint
                    cv.putpixel((xx, yy), c)
            x += bw
        y += bh
        row += 1


# ---- 몬스터 수집 마을 건물 문법(2026-10-07 다시 그림) -------------------------------------------------------
# 사용자 판정: 옛 집(평평한 띠 지붕·주황 판자벽)은 「흔한 기본 칩셋」으로 읽혔다. 새 숲·풀과 같은 문법으로 다시 그린다.
#  · 실루엣 전체와 지붕·벽·창·문 부품마다 1px 짙은 남회색 윤곽(outline).
#  · 지붕: 3~4px 기와 줄(줄마다 밝은 윗선 + 어두운 밑선, 엇갈린 세로 이음, 밑끝은 둥근 비늘), 위에 둥근 용마루, 아래 처마 판 + 벽에 드리운 2행 그림자.
#  · 벽: 크림 회벽 + 아래 한 톤 어두운 허리 띠 + 돌 기초 1줄 + 윤곽. 양끝 나무 모서리 기둥.
#  · 창: 윤곽 + 흰 틀 + 하늘빛 유리 4칸(왼쪽 위 흰 반사) + 창턱. 문: 윤곽 + 나무 문틀 + 판자 문짝 + 작은 유리창 + 금빛 손잡이 + 돌 디딤판.
#  · 빛은 왼쪽 위. 재료마다 3~5톤, 그라데이션·잡티 없음.
# 칸 배치 계약: 그림 크기·칸 이름·문 칸·칸별 투명 등급(빈/일부/불투명)은 옛 그림과 같다(72개 맵이 칸 번호를 참조한다).
#  → 맨 아래 픽셀 행(y = 높이-1)은 늘 비워 둔다(아래 줄 칸이 「일부 투명」으로 남아 땅 위 층에 놓인다). 좌우 끝 2열도 비운다.
_DEF = {
    "outline": ["#383c58"],
    "wall_cream": ["#b8a684", "#dccca4", "#f4ead0", "#fffaee"],
    "window_frame": ["#9c9cb8", "#d8d8e8", "#ffffff"],
    "win_glass": ["#3c64b8", "#5a8ee0", "#88c0f4", "#c4e8ff"],
    "door_wood": ["#5a3018", "#7e4824", "#a06234", "#c4844a"],
    "log": ["#4e2c18", "#704428", "#94603a", "#b88050", "#d8a46c"],
    "stone": ["#66647a", "#8a889c", "#aeacbc", "#d2d0dc"],
}


def pal(P, key):
    """새 건물 색 — 시트 팔레트에 없으면(다른 지역 시트가 이 함수를 부를 때) 기본값."""
    if key in P:
        return P[key]
    return px.ramp(_DEF[key])


def OL(P):
    return pal(P, "outline")[0]


def outline_silhouette(cv, c, skip_bottom=False):
    """불투명 픽셀 중 투명(또는 그림 밖)과 4방향으로 맞닿은 것을 윤곽색으로. 알파는 바꾸지 않는다."""
    W, H = cv.size
    src = cv.load()
    edge = []
    for y in range(H):
        for x in range(W):
            if src[x, y][3] == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H) or src[xx, yy][3] == 0:
                    if skip_bottom and dy == 1:
                        continue
                    edge.append((x, y))
                    break
    for x, y in edge:
        cv.putpixel((x, y), c)


def shade_under(cv, base, shade, x0, x1, y0, y1):
    """[x0,x1]×[y0,y1] 안에서 벽 바탕색 픽셀 바로 위가 벽이 아닌 불투명 픽셀(창턱·틀·기둥 머리)이면 그림자색."""
    src = cv.copy()
    for y in range(max(1, y0), y1 + 1):
        for x in range(x0, x1 + 1):
            if src.getpixel((x, y)) == base:
                up = src.getpixel((x, y - 1))
                if up[3] == 255 and up != base and up != shade:
                    cv.putpixel((x, y), shade)


def roof_flat(P, key, n: int, seed: str, H: int = ROOF_H):
    """정면 지붕 H행 × n칸. 실루엣은 x=1..w-2(좌우 처마가 벽보다 2px 내민다), 위 모서리 둥글게.
    행 구성(H=33): 0 윤곽 | 1~3 둥근 용마루 | 4 용마루 밑 그늘 | 5~28 기와 6줄(줄 높이 4) | 29~31 처마 판 | 32 윤곽."""
    rf = P[key]
    ol = OL(P)
    w = n * T
    cv = px.new(w, H)
    L, R = 1, w - 2
    for y in range(H):
        for x in range(L, R + 1):
            cv.putpixel((x, y), rf[2])
    ridge_y = 1
    sh0 = 5
    eave = H - 4                                                      # 처마 판 첫 행
    # 둥근 용마루: 밝음·중간·어둠 3행 + 밑 그늘
    for x in range(L + 1, R):
        cv.putpixel((x, ridge_y), rf[4]); cv.putpixel((x, ridge_y + 1), rf[3]); cv.putpixel((x, ridge_y + 2), rf[2])
        cv.putpixel((x, ridge_y + 3), rf[0])
    for x in range(L + 4, R - 3, 6):                                  # 용마루 기와 마디
        cv.putpixel((x, ridge_y + 1), rf[2]); cv.putpixel((x, ridge_y + 2), rf[1])
    # 기와 줄(줄 높이 4): 밝은 윗선 · 몸 2행 · 어두운 밑선. 기와 한 장 폭 4, 줄마다 반 장 엇갈림.
    style = "scale"                                    # 띠(band)는 성긴 이음만 — 비늘이 기와로 더 잘 읽혔다
    rows = (eave - sh0) // 4
    for ri in range(rows):
        y0 = sh0 + ri * 4
        far = ri == 0
        hi, body, dk = (rf[3], rf[2], rf[1]) if far else (rf[4], rf[3], rf[1])
        for x in range(L + 1, R):
            if style == "scale":                       # 비늘: 이음 칸이 몸 아래쪽부터 어두워져 밑끝이 둥글다
                u = (x - L - 1 + (2 if ri % 2 else 0)) % 4
                col = (hi, body, body if u else rf[2], dk if u in (0, 3) else rf[2])
            else:                                      # 띠: 성긴 세로 이음만
                u = (x - L - 1 + (8 if ri % 2 else 0)) % 16
                col = (hi, rf[2] if u == 0 else body, body, dk)
            for k in range(4):
                cv.putpixel((x, y0 + k), col[k])
    for y in range(sh0 + rows * 4, eave):                             # 남는 행(있으면) = 마지막 줄 밑선
        for x in range(L + 1, R):
            cv.putpixel((x, y), rf[1])
    # 처마 판: 밝은 윗선 · 몸 · 어두운 밑선
    for x in range(L + 1, R):
        cv.putpixel((x, eave), rf[4]); cv.putpixel((x, eave + 1), rf[3]); cv.putpixel((x, eave + 2), rf[1])
    # 박공 끝판(좌우 세로): 왼쪽은 빛을 받아 밝고 오른쪽은 어둡다
    for y in range(ridge_y, eave + 3):
        cv.putpixel((L + 1, y), rf[4]); cv.putpixel((L + 2, y), rf[3] if y < eave else cv.getpixel((L + 2, y)))
        cv.putpixel((R - 1, y), rf[1]); cv.putpixel((R - 2, y), rf[2] if y < eave else cv.getpixel((R - 2, y)))
    for x in (L + 3, R - 3):                                          # 끝판과 기와 사이 이음
        for y in range(sh0, eave):
            cv.putpixel((x, y), rf[1] if x == R - 3 else rf[2])
    # 윤곽 + 위 모서리 비스듬히(지붕이 뒤로 넘어가는 느낌, 3px)
    for x in range(L + 1, R):
        cv.putpixel((x, 0), ol); cv.putpixel((x, H - 1), ol)
    for y in range(1, H):
        cv.putpixel((L, y), ol); cv.putpixel((R, y), ol)
    for y in range(3):
        for d in range(3 - y):
            cv.putpixel((L + d, y), (0, 0, 0, 0)); cv.putpixel((R - d, y), (0, 0, 0, 0))
    outline_silhouette(cv, ol)
    return cv


def window(P, cv, x0, y0, w=22, h=16):
    """창(그림자 행 포함 h). 윤곽 상자 y0..y0+h-3, 창턱 y0+h-2, 반환 사각형의 맨 아래 행(y0+h)은 벽 그림자 자리."""
    ol, fr, gl = OL(P), pal(P, "window_frame"), pal(P, "win_glass")
    y1 = y0 + h - 3
    px.rect(cv, x0, y0, x0 + w - 1, y1, ol)
    px.rect(cv, x0 + 1, y0 + 1, x0 + w - 2, y1 - 1, fr[2])                        # 흰 틀
    px.rect(cv, x0 + w - 2, y0 + 2, x0 + w - 2, y1 - 1, fr[1]); px.rect(cv, x0 + 2, y1 - 1, x0 + w - 2, y1 - 1, fr[1])
    gx0, gx1, gy0, gy1 = x0 + 2, x0 + w - 3, y0 + 2, y1 - 2
    mid = (gx0 + gx1) // 2
    midy = (gy0 + gy1) // 2
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            if x in (mid, mid + 1) and w >= 16:
                c = fr[2] if x == mid else fr[1]
            elif y == midy and h >= 12:
                c = fr[2] if y == midy else fr[1]
            else:
                pane_top = gy0 if y < midy else midy + 1
                pane_left = gx0 if x < mid else mid + 2
                c = gl[2]
                if y == pane_top:
                    c = gl[1]                                                     # 틀 밑 그늘
                elif y >= (midy - 1 if y < midy else gy1):
                    c = gl[3]
                d = (x - pane_left) + (y - pane_top)
                if d in (2, 3) and y > pane_top and (x - pane_left) <= 3:
                    c = fr[2]                                                     # 왼쪽 위 반사
            cv.putpixel((x, y), c)
    px.rect(cv, x0 - 1, y1 + 1, x0 + w, y1 + 1, fr[1])                                 # 창턱
    cv.putpixel((x0 - 1, y1 + 1), ol); cv.putpixel((x0 + w, y1 + 1), ol)
    px.rect(cv, x0, y1 + 2, x0 + w - 1, y1 + 2, ol)
    return (x0, y0, x0 + w - 1, y0 + h)


def door(P, cv, x0, y0, w=16, h=26):
    """문 한 칸(16 폭): 윤곽 · 나무 문틀 · 판자 문짝 · 작은 유리창 · 금빛 손잡이, 맨 아래 2행은 돌 디딤판.
    반환 사각형은 옛 문과 같다(x0, y0, x0+w-1, y0+h-1)."""
    ol, dw, st, gl, fr = OL(P), pal(P, "door_wood"), pal(P, "stone"), pal(P, "win_glass"), pal(P, "window_frame")
    gold = P["gold"]
    yb = y0 + h - 6                                                               # 문짝 마지막 행(그 밑 문지방 1 · 디딤돌 2 · 윤곽 1, 맨 아래 행은 비운다)
    px.rect(cv, x0, y0, x0 + w - 1, yb + 1, ol)
    px.rect(cv, x0 + 1, y0 + 1, x0 + w - 2, yb, dw[3])                            # 문틀(왼쪽·위 밝음)
    px.rect(cv, x0 + w - 2, y0 + 2, x0 + w - 2, yb, dw[1])
    px.rect(cv, x0 + 2, y0 + 2, x0 + w - 3, yb, ol)                               # 문짝 윤곽
    px.rect(cv, x0 + 3, y0 + 3, x0 + w - 4, yb, dw[2])
    for x in range(x0 + 3, x0 + w - 3):                                           # 위 그늘 + 판자 줄
        cv.putpixel((x, y0 + 3), dw[1])
    for x in (x0 + 6, x0 + 9):
        for y in range(y0 + 4, yb + 1):
            cv.putpixel((x, y), dw[1])
    px.rect(cv, x0 + 3, y0 + 4, x0 + 3, yb, dw[3])                                # 문짝 왼쪽 빛
    # 작은 유리창(가로 2칸)
    wx0, wy0 = x0 + 4, y0 + 5
    px.rect(cv, wx0, wy0, wx0 + 7, wy0 + 4, ol)
    px.rect(cv, wx0 + 1, wy0 + 1, wx0 + 6, wy0 + 3, gl[2])
    px.rect(cv, wx0 + 1, wy0 + 1, wx0 + 6, wy0 + 1, gl[1])
    px.rect(cv, wx0 + 4, wy0 + 1, wx0 + 4, wy0 + 3, fr[2])
    cv.putpixel((wx0 + 2, wy0 + 2), fr[2])
    # 손잡이
    kx, ky = x0 + w - 6, y0 + 13
    cv.putpixel((kx, ky), gold[1]); cv.putpixel((kx + 1, ky), gold[0])
    cv.putpixel((kx, ky + 1), gold[0]); cv.putpixel((kx + 1, ky + 1), ol)
    # 문지방 + 돌 디딤판(문 칸 전체 폭)
    px.rect(cv, x0 + 1, yb + 1, x0 + w - 2, yb + 1, dw[0])
    px.rect(cv, x0, yb + 2, x0 + w - 1, yb + 2, st[3]); px.rect(cv, x0, yb + 3, x0 + w - 1, yb + 3, st[1])
    px.rect(cv, x0, yb + 4, x0 + w - 1, yb + 4, ol)
    for y in (yb + 2, yb + 3):
        cv.putpixel((x0, y), ol); cv.putpixel((x0 + w - 1, y), ol)
    return (x0, y0, x0 + w - 1, y0 + h - 1)


def door_slot(x: int, w_old: int = 22) -> int:
    """옛 22px 문 자리 x → 1칸 문 자리(옛 landmarks.door_slot 과 같은 식 — 입구 칸이 바뀌지 않는다)."""
    return ((2 * x + w_old - 1) // 2 // T) * T


def awning(P, cv, accent, x0, x1, y0=3):
    """줄무늬 차양: 윤곽, 줄무늬 폭 4(포인트색/흰색), 아랫단 둥근 비늘, 밑에 벽 그림자 2행."""
    ac, fr, ol = P[accent], pal(P, "window_frame"), OL(P)
    for x in range(x0, x1 + 1):
        stripe = ((x - x0) // 4) % 2 == 0
        hi, base, lo = (ac[4], ac[3], ac[1]) if stripe else (fr[2], fr[2], fr[0])
        for k in range(8):
            c = hi if k == 1 else lo if k == 6 else base
            if k == 0:
                c = ol
            px.put(cv, x, y0 + k, c)
        u = (x - x0) % 4
        if u in (1, 2):
            px.put(cv, x, y0 + 7, lo); px.put(cv, x, y0 + 8, ol)
        else:
            px.put(cv, x, y0 + 7, ol)
    for k in range(9):
        px.put(cv, x0, y0 + k, ol); px.put(cv, x1, y0 + k, ol)


def wall_kit(P, n, plan, rows=31, ground=True, wall_kind="plaster", accent=None):
    """정면 벽 rows 행 × n칸. 반환 (그림, 창 사각형, 문 사각형). ground=True 면 맨 아래 행은 비우고 그 위 3행이 돌 기초·윤곽.
    ground=False(2층 위층) 면 아래 3행은 층 보(나무)."""
    ol = OL(P)
    wc, dw, st, lg = pal(P, "wall_cream"), pal(P, "door_wood"), pal(P, "stone"), pal(P, "log")
    w = n * T
    cv = px.new(w, rows)
    X0, X1 = 3, w - 4                                                             # 벽 실루엣(지붕이 2px 내민다)
    last = rows - 2 if ground else rows - 1                                       # 마지막 불투명 행
    base, shade = wc[2], wc[1]
    if wall_kind == "plank":                                                      # 통나무 벽: 4px 통나무 줄
        base, shade = lg[2], lg[1]
        for y in range(0, last + 1):
            k = y % 4
            c = (lg[3], lg[2], lg[2], lg[1])[k]
            px.rect(cv, X0, y, X1, y, c)
    else:
        px.rect(cv, X0, 0, X1, last, base)
        lo = last - (5 if ground else 4)                                          # 아래 허리 띠(한 톤 어둡게)
        px.rect(cv, X0, lo, X1, last, shade)
        px.rect(cv, X0, lo, X1, lo, wc[3])                                        # 허리 띠 위 밝은 선(몰딩)
        px.rect(cv, X0, lo + 1, X1, lo + 1, wc[0])
    # 처마 그늘 2행
    px.rect(cv, X0, 0, X1, 0, lg[1] if wall_kind == "plank" else wc[0])
    px.rect(cv, X0, 1, X1, 1, lg[1] if wall_kind == "plank" else wc[1])
    if ground:                                                                    # 돌 기초 2행 + 윤곽
        px.rect(cv, X0, last - 2, X1, last - 2, st[3]); px.rect(cv, X0, last - 1, X1, last - 1, st[1])
        for x in range(X0 + 5, X1, 7):
            cv.putpixel((x, last - 2), st[1])
        px.rect(cv, X0, last, X1, last, ol)
    else:                                                                         # 층 보
        px.rect(cv, X0, last - 2, X1, last - 2, dw[3]); px.rect(cv, X0, last - 1, X1, last - 1, dw[2]); px.rect(cv, X0, last, X1, last, dw[0])
    # 모서리 기둥(3폭 + 안쪽 윤곽)
    post_bot = last - 3 if ground else last - 3
    for xp, side in ((X0 + 1, 0), (X1 - 3, 1)):
        px.rect(cv, xp, 0, xp, post_bot, dw[3]); px.rect(cv, xp + 1, 0, xp + 1, post_bot, dw[2]); px.rect(cv, xp + 2, 0, xp + 2, post_bot, dw[1])
        xi = xp + 3 if side == 0 else xp - 1
        px.rect(cv, xi, 0, xi, post_bot, ol)
        px.rect(cv, xp, post_bot, xp + 2, post_bot, dw[0])
    if wall_kind == "plank":                                                      # 통나무 끝 마구리(기둥 대신 둥근 끝)
        for xp in (X0 + 1, X1 - 3):
            for y in range(0, post_bot + 1):
                k = y % 4
                c = (lg[4], lg[3], lg[2], ol)[k]
                px.rect(cv, xp, y, xp + 2, y, c)
                if k in (1, 2):
                    cv.putpixel((xp + 1, y), lg[2] if k == 1 else lg[1])
    if accent:
        sx = [it[1] for it in plan if it[0] == "S"][0]
        awning(P, cv, accent, sx - 1, sx + 48)
    wins, doors = [], []
    for item in plan:
        kind, x = item[0], item[1]
        if kind == "W":
            wins.append(window(P, cv, x, 6 if not accent else 14))
        elif kind == "S":
            wins.append(window(P, cv, x, 13, h=16))
            wins.append(window(P, cv, x + 26, 13, h=16))
        else:
            doors.append(door(P, cv, door_slot(x), 5))
    shade_under(cv, base, shade if wall_kind != "plank" else lg[1], X0, X1, 2, last)
    for x in (X0, X1):                                                            # 실루엣 윤곽(세로)
        px.rect(cv, x, 0, x, last, ol)
    return cv, wins, doors


def wall_front(P, n: int, plan: list, seed: str, roles: dict | None = None):
    """정면 벽 31px × n칸(평지붕 집). 창·문 사각형은 옛 그림과 같은 자리."""
    cv, wins, doors = wall_kit(P, n, plan)
    if roles is not None:
        roles.update({"windows": [[a, b + ROOF_H, c, d + ROOF_H] for a, b, c, d in wins], "doors": [[a, b + ROOF_H, c, d + ROOF_H] for a, b, c, d in doors]})
    return cv


def house(P, roof_key: str, plan: list, n: int, seed: str, roles: dict | None = None):
    roof = roof_flat(P, roof_key, n, seed)
    wall = wall_front(P, n, plan, seed, roles)
    cv = px.new(n * T, HOUSE_H)
    cv.alpha_composite(wall, (0, ROOF_H))
    cv.alpha_composite(roof, (0, 0))
    if roles is not None:
        roles["roof_ramp"] = roof_key
        roles["door_kind"] = "wood"
        roles["shadow_rgb"] = list(P["plaster"][0][:3])
        roles["roof_ymax"] = ROOF_H - 1
        ws, ds = roles["windows"], roles["doors"]
        edges = sorted([(a, c) for a, _, c, _ in ws + ds])
        walls, prev = [], 8
        for a, c in edges:
            if a - 3 - (prev + 2) >= 3:
                walls.append([prev + 2, ROOF_H + 10, a - 3, ROOF_H + 21])
            prev = c
        if n * T - 10 - (prev + 2) >= 3:
            walls.append([prev + 2, ROOF_H + 10, n * T - 10, ROOF_H + 21])
        roles["wall"] = walls
        roles["openings"] = [list(r) for r in ws + ds]
    return cv


def cut(im, prefix: str) -> dict[str, "px.Image.Image"]:
    out = {}
    for ry in range(im.height // T):
        for cx in range(im.width // T):
            out[f"{prefix}.{cx}.{ry}"] = im.crop((cx * T, ry * T, cx * T + T, ry * T + T))
    return out
