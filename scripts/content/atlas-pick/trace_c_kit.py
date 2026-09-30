#!/usr/bin/env python3
"""트레이싱 C 조 — 건물 조립 키트 손 도트(32px 칸). 좌표·(램프,단)은 전부 내가 정한다. 밑그림 화소는 읽지 않는다.
단 = 램프 인덱스(7단 램프 0..6, 기본 3 / 5단 램프 0..4, 기본 2). 빛은 왼쪽 위. 면 규칙: 지붕 윗면 +2, 정면 0, 슬래브 밑 -2, 옆면 -2."""
from trace_lib import Cv

# 손으로 정한 8x8 타일 변주표(32px 주기 → 좌우·상하로 이어 붙여도 이음매 없음). + 밝게 · - 어둡게
V = ["00+00-00", "0-00+000", "+000-0+0", "00-0000+", "0+000-00", "000+00-0", "-0+00000", "00000+0-"]


def tile_tex(cv, x, y, w, h, r, base, pitch=8):
    """4px 타일 격자: 줄눈(오른쪽·아래) base-1, 좌상 모서리 광택, 타일별 손 변주."""
    for j in range(h):
        for i in range(w):
            rx, ry = i % pitch, j % pitch
            v = V[(j // pitch) % 8][(i // pitch) % 8]
            dv = 1 if v == '+' else -1 if v == '-' else 0
            if rx == pitch - 1 or ry == pitch - 1:
                t = base - 1
            elif rx == 0 and ry == 0 and dv >= 0:
                t = base + dv + 1
            else:
                t = base + dv
            cv.px(x + i, y + j, r, t)


def diag(cv, x0, y0, x1, y1, r, t):
    """(x0,y0)에서 (x1,y1)까지 내가 정한 두 끝점 사이 비스듬한 선(브레젠험)."""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        cv.px(x0, y0, r, t)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 > -dy: err -= dy; x0 += sx
        if e2 < dx: err += dx; y0 += sy


def glass(cv, x, y, w, h, lit=False):
    """유리(밖에서 본 창). 낮: 위쪽 밝고 대각 반사 2줄 + 오른쪽 아래 스카이라인. 밤: 불 켜진 방 + 커튼."""
    if not lit:
        cv.fill(x, y, w, h, 'garasu', 3)
        cv.fill(x, y, w, h // 2 - 1, 'garasu', 4)
        # 대각 반사(두 줄): 내가 정한 끝점
        for k in (0, 1):
            diag(cv, x + 6 + k, y + h - 2, x + h + 3 + k, y + 1, 'garasu', 5)
        diag(cv, x + 12, y + h - 2, x + h + 8, y + 1, 'garasu', 5)
        # 스카이라인 실루엣(오른쪽 아래 손 블록)
        for bx, bh, bw in ((w - 20, 3, 5), (w - 15, 6, 4), (w - 11, 4, 6), (w - 5, 7, 4), (14, 2, 6)):
            cv.fill(x + bx, y + h - bh, bw, bh, 'garasu', 2)
        cv.hline(x, y + h - 1, w, 'garasu', 2)
    else:
        cv.fill(x, y, w, h, 'mado', 2)
        cv.fill(x, y, w, 2, 'mado', 1)
        cv.fill(x + 2, y + 3, 12, h - 5, 'kinari', 2)          # 커튼
        for i in (5, 8, 11): cv.vline(x + i, y + 3, h - 5, 'kinari', 1)
        cv.fill(x + w - 14, y + 4, 10, 6, 'mado', 4)            # 벽등 번짐
        cv.fill(x + w - 16, y + h - 4, 14, 4, 'mado', 1)


def win_bay(cv, x0, wall_r, wall_t, lit=False, mullion=None):
    """64px 한 칸(x0..x0+63)의 창: 들어간 틀(위 2px·왼 1px 그늘) + 문턱 +2(양쪽 1px 돌출) + 밑 그늘 2px."""
    cv.fill(x0 + 9, 4, 46, 19, 'tekko', 1)                      # 들어간 그늘 틀
    glass(cv, x0 + 10, 6, 44, 16, lit)
    cv.fill(x0 + 9, 22, 46, 2, 'conc', 5)                       # 문턱(+2)
    cv.hline(x0 + 9, 22, 46, 'conc', 6)
    cv.fill(x0 + 9, 24, 46, 2, wall_r, wall_t - 2)              # 문턱 밑 그늘 2px
    if mullion is not None:
        cv.fill(x0 + mullion, 6, 2, 16, 'tekko', 2); cv.vline(x0 + mullion, 6, 16, 'tekko', 3)


def slab_rows(cv, w, ramp='tekko', tones=(4, 3, 3, 1), y=28):
    for k, t in enumerate(tones):
        cv.hline(0, y + k, w, ramp, t)


def d_roof_top():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'conc', 5)
    cv.hline(0, 0, 32, 'conc', 4); cv.vline(0, 0, 32, 'conc', 4)          # 이음 어두운 줄
    cv.hline(1, 1, 31, 'conc', 6); cv.vline(1, 1, 31, 'conc', 6)          # 윗·왼 밝은 입술
    for x, y, t in ((6, 7, 4), (7, 7, 4), (19, 5, 6), (24, 13, 4), (11, 17, 6), (12, 17, 6), (27, 22, 4), (5, 26, 4), (17, 24, 6), (22, 29, 4), (14, 11, 4), (3, 14, 6)):
        cv.px(x, y, 'conc', t)                                            # 손 얼룩 점 12개(자리를 하나씩 정함)
    return cv


def d_roof_parapet():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 10, 'conc', 5)                                      # 지붕 윗면(+2)
    for x, y, t in ((5, 3, 4), (6, 3, 4), (21, 6, 6), (13, 7, 4), (27, 2, 6), (9, 8, 6)):
        cv.px(x, y, 'conc', t)
    cv.hline(0, 10, 32, 'conc', 6)                                        # 파라펫 윗입술
    cv.hline(0, 11, 32, 'conc', 3)                                        # 안쪽 그림자 줄
    cv.fill(0, 12, 32, 2, 'conc', 6)                                      # 띠 윗부분 밝음
    cv.fill(0, 14, 32, 10, 'conc', 5)                                     # 띠 정면
    cv.fill(0, 24, 32, 3, 'conc', 4)                                      # 띠 아랫부분
    cv.hline(0, 27, 32, 'conc', 2)                                        # 띠 아랫변(슬래브 밑 -2)
    cv.vline(31, 12, 15, 'conc', 4)                                       # 띠 이음(오른쪽)
    tile_tex(cv, 0, 28, 32, 4, 'tairu', 2)                                # 아래 벽 그늘
    cv.hline(0, 28, 32, 'tairu', 1); cv.hline(0, 29, 32, 'tairu', 1)
    return cv


def d_roof_rail():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 32, 'conc', 5)
    for x, y, t in ((5, 24, 4), (22, 26, 4), (9, 3, 6), (26, 4, 4)):
        cv.px(x, y, 'conc', t)
    cv.fill(0, 6, 32, 2, 'tekko', 4); cv.hline(0, 6, 32, 'tekko', 5)      # 윗난간
    cv.fill(0, 14, 32, 2, 'tekko', 3); cv.hline(0, 14, 32, 'tekko', 4)    # 아랫난간
    cv.fill(14, 4, 4, 22, 'tekko', 3); cv.vline(14, 4, 22, 'tekko', 4); cv.vline(17, 4, 22, 'tekko', 2)   # 기둥
    cv.fill(12, 24, 8, 3, 'tekko', 2)                                     # 기둥 발
    cv.fill(0, 27, 32, 2, 'conc', 3)                                      # 난간 그림자
    cv.fill(0, 29, 32, 3, 'conc', 4)
    return cv


def d_wall_tile():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 28, 'tairu', 4)
    cv.shade(0, 0, 32, 3, -1)                                             # 위 슬래브가 드리우는 그늘 3px
    slab_rows(cv, 32)
    return cv


def d_win_plain():
    cv = Cv(64, 32)
    tile_tex(cv, 0, 0, 64, 28, 'tairu', 4)
    cv.shade(0, 0, 64, 3, -1)
    win_bay(cv, 0, 'tairu', 4)
    slab_rows(cv, 64)
    return cv


def d_win_lit():
    cv = Cv(64, 32)
    tile_tex(cv, 0, 0, 64, 28, 'tairu', 4)
    cv.shade(0, 0, 64, 3, -1)
    win_bay(cv, 0, 'tairu', 4, lit=True)
    slab_rows(cv, 64)
    return cv


def d_side_face():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 28, 'tairu', 1)                                # 옆면 -2
    cv.shade(0, 0, 32, 3, -1)
    cv.vline(0, 0, 28, 'tairu', 0)                                        # 모서리 짙은 줄
    for x, y, t in ((9, 5, 2), (10, 5, 2)):
        cv.px(x, y, 'tairu', t)
    slab_rows(cv, 32, 'tekko', (2, 1, 1, 0))
    return cv


def d_sf_side():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 29, 'tairu', 1)
    cv.fill(0, 0, 32, 2, 'sumi', 2)
    cv.vline(0, 0, 32, 'tairu', 0)
    cv.fill(8, 8, 16, 14, 'garasu', 0); cv.box(8, 8, 16, 14, 'tekko', 1)  # 옆면 어두운 창
    cv.hline(9, 9, 14, 'garasu', 1)
    cv.fill(0, 29, 32, 3, 'hodo', 1)
    return cv


def d_sf_band():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 4, 'tairu', 4)
    cv.shade(0, 0, 32, 2, -1)
    cv.fill(0, 4, 32, 24, 'tekko', 1)                                     # 간판 틀(어두운 금속)
    cv.hline(0, 4, 32, 'tekko', 3)                                        # 틀 윗입술 빛
    cv.fill(0, 6, 32, 20, 'kii', 3)                                       # 발광 면
    cv.hline(0, 6, 32, 'kii', 5); cv.hline(0, 7, 32, 'kii', 4)            # 안쪽 윗 빛 2줄
    cv.hline(0, 24, 32, 'kii', 1); cv.hline(0, 25, 32, 'kii', 1)          # 안쪽 아랫 그늘
    for x in (0, 31): cv.vline(x, 6, 20, 'kii', 2)
    cv.hline(0, 26, 32, 'tekko', 2)
    cv.hline(0, 27, 32, 'tekko', 0)
    for x in (3, 28): cv.px(x, 7, 'tekko', 5); cv.px(x, 24, 'tekko', 1)   # 리벳
    # 글자 자리(비움): 낮은 홈 두 줄이 이어 붙어도 끊기지 않게 가로 전체
    for x0 in (3, 11, 19, 27):                                            # 글자 자리: 작은 점 획(추상, 글자 아님)
        cv.fill(x0, 12, 3, 3, 'sumi', 2); cv.fill(x0, 18, 3, 2, 'sumi', 2)
    cv.fill(0, 28, 32, 1, 'sumi', 2)
    cv.fill(0, 29, 32, 3, 'sumi', 2)                                      # 처마 밑 그림자 3px
    return cv


def _shop_top(cv, w):
    cv.fill(0, 0, w, 2, 'sumi', 2)                                        # 위 2px 그늘
    cv.fill(0, 2, w, 2, 'tekko', 1)                                       # 안으로 들어간 틀 윗변


def _sill(cv, w):
    cv.fill(0, 28, w, 1, 'conc', 3)
    cv.fill(0, 29, w, 3, 'hodo', 4)                                       # 밑 문턱 3px
    cv.hline(0, 29, w, 'hodo', 5)
    for x in range(4, w, 9):
        cv.px(x, 30, 'hodo', 3)


def d_sf_glass():
    cv = Cv(64, 32)
    _shop_top(cv, 64)
    cv.fill(0, 4, 64, 24, 'tekko', 2)                                     # 틀
    for gx in (2, 23, 44):                                                # 세 장 유리(20px)
        cv.fill(gx, 5, 19, 22, 'garasu', 3)
        cv.fill(gx, 5, 19, 6, 'garasu', 4)
        cv.fill(gx + 5, 6, 8, 2, 'mado', 4)                               # 천장 조명
        cv.hline(gx, 13, 19, 'tekko', 2); cv.hline(gx, 20, 19, 'tekko', 2)  # 선반 두 단
        for k, (r, t) in enumerate((('aka', 3), ('kii', 3), ('midori', 3), ('sora', 3), ('shiro', 3))):
            cv.fill(gx + 1 + k * 3, 10, 2, 3, r, t)
            cv.fill(gx + 2 + k * 3, 17, 2, 3, r, t + 0)
        cv.fill(gx + 1, 22, 17, 4, 'garasu', 2)                           # 아래 진열대 그림자
        cv.vline(gx, 5, 22, 'garasu', 5)                                  # 왼쪽 빛
    _sill(cv, 64)
    return cv


def d_sf_door_auto():
    cv = Cv(64, 32)
    _shop_top(cv, 64)
    cv.fill(0, 4, 64, 24, 'tekko', 2)
    cv.fill(2, 5, 14, 22, 'garasu', 3); cv.fill(2, 5, 14, 6, 'garasu', 4)
    cv.fill(48, 5, 14, 22, 'garasu', 3); cv.fill(48, 5, 14, 6, 'garasu', 4)
    cv.fill(19, 5, 26, 23, 'tekko', 4)                                    # 자동문 틀
    cv.fill(20, 6, 11, 22, 'garasu', 1); cv.fill(33, 6, 11, 22, 'garasu', 1)   # 짙은 유리 두 짝
    diag(cv, 22, 26, 29, 8, 'garasu', 3); diag(cv, 23, 26, 30, 8, 'garasu', 3)
    diag(cv, 35, 26, 42, 8, 'garasu', 3)
    cv.vline(31, 6, 22, 'tekko', 5); cv.vline(32, 6, 22, 'tekko', 1)      # 가운데 맞물림
    cv.fill(29, 15, 1, 5, 'kinari', 3); cv.fill(34, 15, 1, 5, 'kinari', 3)  # 손잡이 막대
    _sill(cv, 64)
    return cv


def d_sf_pillar():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 28, 'tairu', 5)
    cv.fill(0, 0, 32, 2, 'sumi', 2)
    cv.shade(0, 2, 32, 2, -2)
    cv.fill(0, 28, 32, 1, 'conc', 3); cv.fill(0, 29, 32, 3, 'hodo', 4); cv.hline(0, 29, 32, 'hodo', 5)
    for x in (5, 14, 23): cv.px(x, 30, 'hodo', 3)
    return cv


def d_sf_noren():
    cv = Cv(32, 32)
    tile_tex(cv, 0, 0, 32, 28, 'tairu', 5)
    _shop_top(cv, 32)
    cv.fill(3, 4, 26, 9, 'aka', 3)                                        # 노렌
    for x in (11, 20): cv.vline(x, 5, 8, 'aka', 1)
    cv.hline(3, 4, 26, 'aka', 4)
    cv.fill(3, 13, 26, 2, 'shiro', 3); cv.hline(3, 14, 26, 'shiro', 2)    # 밑단 흰 줄
    cv.fill(4, 15, 24, 13, 'ita', 3)                                      # 나무문
    cv.fill(4, 15, 24, 2, 'ita', 1)                                       # 노렌 그늘
    cv.vline(16, 17, 11, 'ita', 1); cv.vline(15, 17, 11, 'ita', 4)
    for x in (7, 10, 19, 22, 25):
        cv.vline(x, 18, 9, 'ita', 4)                                      # 세로 살
    cv.hline(5, 22, 22, 'ita', 2)
    cv.fill(0, 28, 32, 1, 'conc', 3); cv.fill(0, 29, 32, 3, 'hodo', 4); cv.hline(0, 29, 32, 'hodo', 5)
    return cv


def d_sign_vert():
    cv = Cv(32, 96)
    cv.fill(6, 0, 20, 96, 'tekko', 1)                                     # 어두운 금속 틀
    cv.vline(6, 0, 96, 'tekko', 3); cv.vline(7, 0, 96, 'tekko', 2)
    cv.fill(9, 2, 14, 92, 'kii', 2)                                       # 발광 면
    cv.vline(9, 2, 92, 'kii', 4); cv.vline(10, 2, 92, 'kii', 3)           # 왼쪽 빛
    cv.vline(22, 2, 92, 'kii', 1); cv.vline(21, 2, 92, 'kii', 1)          # 오른쪽 그늘
    cv.hline(9, 2, 14, 'kii', 4); cv.hline(9, 93, 14, 'kii', 1)
    cv.vline(25, 0, 96, 'tekko', 0)
    for y in range(8, 90, 12): cv.hline(11, y, 10, 'kii', 3)              # 글자 칸 구분(비움)
    for y in (20, 52, 82):                                                # 벽에 거는 쇠 받침
        cv.fill(26, y, 4, 5, 'tekko', 2); cv.hline(26, y, 4, 'tekko', 4)
    for y in (3, 92): cv.px(7, y, 'tekko', 5)
    return cv


# ---- 콘크리트 건물(R 밑그림) --------------------------------------------------------------
def conc_tex(cv, x, y, w, h, base=4):
    cv.fill(x, y, w, h, 'conc', base)
    cv.vline(x, y, h, 'conc', base - 1)                                   # 세로 이음
    for px_, py_, t in ((8, 8, base - 1), (24, 8, base - 1), (8, 20, base - 1), (24, 20, base - 1)):
        cv.px(x + px_, y + py_, 'conc', t)                                # 거푸집 구멍 점


def conc_slab(cv, w, y=28):
    cv.hline(0, y, w, 'conc', 6); cv.hline(0, y + 1, w, 'conc', 5)
    cv.hline(0, y + 2, w, 'conc', 5); cv.hline(0, y + 3, w, 'conc', 2)


def d_wall_conc():
    cv = Cv(32, 32)
    conc_tex(cv, 0, 0, 32, 28)
    cv.shade(0, 0, 32, 3, -1)
    for x, y in ((6, 15), (7, 15), (21, 22), (14, 4)):
        cv.px(x, y, 'conc', 3)                                            # 손 얼룩(녹물 자리)
    conc_slab(cv, 32)
    return cv


def d_win_conc():
    cv = Cv(64, 32)
    conc_tex(cv, 0, 0, 64, 28)
    cv.px(32, 8, 'conc', 4)
    cv.shade(0, 0, 64, 3, -1)
    cv.fill(7, 4, 50, 20, 'tekko', 1)
    glass(cv, 8, 6, 48, 16)
    cv.fill(31, 6, 2, 16, 'tekko', 2); cv.vline(31, 6, 16, 'tekko', 4)    # 가운데 문설주
    cv.fill(7, 22, 50, 2, 'tekko', 3); cv.hline(7, 22, 50, 'conc', 6)     # 문턱
    cv.fill(7, 24, 50, 2, 'conc', 2)
    conc_slab(cv, 64)
    return cv


def d_win_balcony():
    cv = Cv(64, 32)
    conc_tex(cv, 0, 0, 64, 28)
    cv.shade(0, 0, 64, 3, -1)
    cv.fill(7, 4, 50, 20, 'tekko', 1)
    glass(cv, 8, 6, 48, 16)
    cv.fill(31, 6, 2, 16, 'tekko', 2); cv.vline(31, 6, 16, 'tekko', 4)
    cv.fill(4, 14, 56, 2, 'tekko', 4); cv.hline(4, 14, 56, 'tekko', 5)    # 발코니 난간 위
    for x in (4, 22, 40, 58): cv.fill(x, 14, 2, 10, 'tekko', 3)           # 난간 살대
    cv.fill(2, 24, 60, 4, 'conc', 6); cv.hline(2, 24, 60, 'conc', 6)      # 돌출 발코니 바닥 앞면
    cv.fill(2, 26, 60, 2, 'conc', 5)
    conc_slab(cv, 64)
    cv.hline(0, 28, 64, 'conc', 5)
    return cv


def d_side_conc():
    cv = Cv(32, 32)
    cv.fill(0, 0, 32, 28, 'conc', 1)
    cv.vline(0, 0, 32, 'conc', 0)
    for x, y in ((9, 8), (22, 18), (14, 4)):
        cv.px(x, y, 'conc', 2)
    cv.shade(0, 0, 32, 3, -1)
    cv.hline(0, 28, 32, 'conc', 3); cv.hline(0, 29, 32, 'conc', 2); cv.hline(0, 30, 32, 'conc', 2); cv.hline(0, 31, 32, 'conc', 0)
    return cv


def d_wall_conc_g():
    cv = Cv(32, 64)
    conc_tex(cv, 0, 0, 32, 56)
    cv.shade(0, 0, 32, 3, -1)
    cv.fill(0, 56, 32, 8, 'hodo', 3)                                      # 화강암 밑단
    cv.hline(0, 56, 32, 'hodo', 5)
    for x, y in ((3, 58), (9, 60), (16, 57), (22, 61), (28, 59)):
        cv.px(x, y, 'hodo', 2); cv.px(x + 1, y, 'hodo', 4)
    cv.vline(0, 56, 8, 'hodo', 1)
    return cv


def d_ent_conc():
    cv = Cv(64, 64)
    cv.fill(0, 0, 64, 56, 'tekko', 2)                                     # 어두운 판 벽
    for y in range(0, 56, 14): cv.hline(0, y + 13, 64, 'tekko', 1)
    for x in (0, 31, 63): cv.vline(x, 0, 56, 'tekko', 1)
    cv.shade(0, 0, 64, 2, -1)
    cv.fill(10, 6, 44, 50, 'tekko', 1)                                    # 들어간 입구
    cv.fill(12, 8, 40, 48, 'tekko', 4)                                    # 문틀
    cv.fill(13, 9, 17, 47, 'garasu', 1); cv.fill(34, 9, 17, 47, 'garasu', 1)   # 짙은 유리 두 짝
    cv.fill(6, 8, 6, 48, 'mado', 2); cv.fill(52, 8, 6, 48, 'mado', 2)         # 옆 로비 불빛 창
    cv.fill(7, 10, 4, 14, 'mado', 3); cv.fill(53, 10, 4, 14, 'mado', 3)
    diag(cv, 15, 40, 26, 12, 'garasu', 3); diag(cv, 16, 40, 27, 12, 'garasu', 3)
    diag(cv, 36, 40, 47, 12, 'garasu', 3)
    cv.vline(31, 9, 47, 'tekko', 5); cv.vline(32, 9, 47, 'tekko', 5); cv.vline(33, 9, 47, 'tekko', 1)
    cv.fill(28, 30, 2, 6, 'kinari', 3); cv.fill(35, 30, 2, 6, 'kinari', 3)
    cv.fill(28, 5, 8, 2, 'mado', 4)                                       # 처마 밑 등
    cv.fill(0, 56, 64, 8, 'hodo', 3); cv.hline(0, 56, 64, 'hodo', 5)
    for x, y in ((4, 59), (12, 61), (22, 58), (40, 60), (50, 62), (58, 58)):
        cv.px(x, y, 'hodo', 2); cv.px(x + 1, y, 'hodo', 4)
    return cv


def d_shutter():
    cv = Cv(64, 64)
    conc_tex(cv, 0, 0, 64, 56)
    cv.shade(0, 0, 64, 3, -1)
    cv.fill(6, 6, 52, 50, 'tekko', 1)                                     # 들어간 틀
    for y in range(8, 56, 3):                                             # 셔터 판 3px 간격
        cv.hline(8, y, 48, 'tairu', 3); cv.hline(8, y + 1, 48, 'tairu', 2); cv.hline(8, y + 2, 48, 'tairu', 1)
    cv.fill(8, 8, 1, 47, 'tairu', 4)
    cv.fill(14, 52, 6, 2, 'tekko', 4); cv.fill(44, 52, 6, 2, 'tekko', 4)  # 손잡이 판
    cv.fill(0, 56, 64, 8, 'hodo', 3); cv.hline(0, 56, 64, 'hodo', 5)
    for x, y in ((6, 59), (18, 61), (33, 58), (47, 60), (57, 62)):
        cv.px(x, y, 'hodo', 2); cv.px(x + 1, y, 'hodo', 4)
    return cv
