"""modern_city 실내 — 앉는 기물 가독성 다시 그림(2026-10-20, 사용자 「형체가 한번에 와닿지 않는다」).

고친 원칙(관문 기준을 낮추지 않고 그림을 바꾼다, 3/4 탑뷰 그대로):
  · 같은 윤곽 가족: 실루엣 1px ink 테(위·옆 ink 1, 바닥 접지선 ink 0) — 다른 mci 가구와 같다.
  · 등받이 윗모서리 1행은 그 재질의 가장 밝은 단(빛 왼쪽 위), 등받이 앞면은 두 단 어둡게.
  · 앉는 판 = 넓은 윗면(밝음) + 앞 모서리 밝은 테 + 앞면 두 단 어둡게 + 판 밑 그늘 1행(ink) — 다리는 짙은 단 + 바닥 접점 ink 0.
  · 나무 의자는 바닥(wood 2~5단)·나무 탁자(wood 3~5단)와 같은 단을 쓰지 않는다: 짙은 호두 틀(wood 0~2) + 세이지 천 방석.
    카페 의자는 검은 쇠 틀 + 붉은 방석, 금속 벤치는 회색 살 사이 짙은 틈(흰 타일 위에서도 보인다).
  · 방향: 등받이는 앉는 사람 등 뒤(s=북·n=남·e=서·w=동)에만 서고, 앉는 판 윗면이 늘 등받이보다 넓게 보인다.
그림 크기·칸은 예전 그림과 같다(번호 그대로 제자리 굽기: rebake_wood_seat.py).
안락의자·3인 소파(네 방향)는 다시 그려 봤지만 나무 바닥 대비가 떨어지거나(안락의자 47→27) 나아지지 않아 예전 그림 그대로 둔다(2026-10-20 2차 대조)."""
from mpx import C, NT, MI


def ol(c, x, y, w, h):
    """사각 테: 위·옆 ink 1, 밑 ink 0(접지)."""
    c.HL(x, y, w, 'ink', 1); c.VL(x, y, h, 'ink', 1); c.VL(x + w - 1, y, h, 'ink', 1); c.HL(x, y + h - 1, w, 'ink', 0)


def seat(c, x, y, w, top, front, mat, tt, ft, rim=None):
    """앉는 판: 윗면 top 행(첫 행 한 단 밝게 = 뒤쪽 빛, 마지막 행 앞 모서리 밝은 테) + 앞면 front 행 + ink 테.
    rim = (재질, 단) 이면 윗면 바깥 1px 를 틀 색으로(나무 틀에 박힌 방석)."""
    n = NT[MI[mat]]
    c.R(x, y, w, top, mat, tt)
    c.HL(x + 1, y + 1, w - 2, mat, min(n - 1, tt + 1))
    c.HL(x, y + top - 1, w, mat, min(n - 1, tt + 1))
    if rim:
        rm, rt = rim
        c.HL(x, y, w, rm, rt); c.VL(x, y, top, rm, rt); c.VL(x + w - 1, y, top, rm, rt)
        c.HL(x, y + top - 1, w, rm, min(NT[MI[rm]] - 1, rt + 2))
    c.R(x, y + top, w, front, mat if not rim else rim[0], ft)
    ol(c, x - 1, y - 1, w + 2, top + front + 2)


def leg(c, x, y, h, mat, t):
    c.VL(x, y, h - 1, mat, t); c.P(x, y + h - 1, 'ink', 0)


# ═══════════════ 나무 의자(식탁) ═══════════════
FR = 'wood'            # 짙은 호두 틀: 0 · 1 · 2 단만(바닥·탁자는 2~5단)
PAD = 'sage'           # 세이지 천 방석


def chair_wood(c, facing='s'):
    if facing == 's':                                          # 북쪽 등받이 → 남쪽 식탁을 본다
        # 등받이 위 가로대 = 윗면 4행(가장 밝은 뒤 모서리 → 한 단씩 어둡게) + 앞면 2행, 그 밑 기둥 둘은 짧게(4행) — 등받이 몸이 윗면 없는 세로 판으로 읽히지 않게.
        c.R(3, 6, 10, 4, FR, 2); c.HL(4, 6, 8, FR, 4); c.HL(3, 7, 10, FR, 3); c.HL(3, 9, 10, FR, 2)
        c.R(3, 10, 10, 2, FR, 0); c.HL(4, 10, 8, FR, 1)
        ol(c, 2, 5, 12, 8)
        for x in (3, 12):
            c.VL(x, 13, 4, FR, 1); c.VL(x + (1 if x == 3 else -1), 13, 4, FR, 0)
        for x in (2, 13): c.VL(x, 13, 4, 'ink', 1)
        seat(c, 3, 17, 10, 7, 2, PAD, 4, 1, rim=(FR, 1))
        c.HL(2, 27, 12, 'ink', 0)                                                                         # 판 밑 그늘
        for x in (3, 12): leg(c, x, 27, 4, FR, 0)
    elif facing == 'n':                                        # 남쪽 등받이(뒷면) → 북쪽 식탁을 본다
        seat(c, 3, 6, 10, 9, 2, PAD, 4, 1, rim=(FR, 1))
        c.R(2, 14, 12, 3, FR, 2); c.HL(3, 14, 10, FR, 3)                                                   # 등받이 위 가로대(윗면 밝게)
        ol(c, 1, 13, 14, 5)
        for x in (2, 7, 12):                                                                               # 뒷면 살 셋 — 사이로 바닥이 비친다
            c.VL(x, 18, 6, FR, 1); c.VL(x + 1, 18, 6, FR, 0); c.VL(x - 1, 18, 6, 'ink', 1); c.VL(x + 2, 18, 6, 'ink', 1)
        c.HL(1, 23, 14, 'ink', 0)
        for x in (3, 12): leg(c, x, 24, 6, FR, 0)
    else:                                                      # e: 서쪽 등받이 → 동쪽 식탁을 본다(w 는 뒤집기)
        seat(c, 5, 14, 9, 8, 2, PAD, 4, 1, rim=(FR, 1))
        c.R(2, 4, 3, 21, FR, 1); c.VL(2, 4, 21, FR, 2); c.R(2, 4, 3, 2, FR, 3)                              # 등받이 기둥: 윗면 밝게
        c.VL(4, 7, 17, FR, 0)
        ol(c, 1, 3, 5, 23)
        c.HL(4, 25, 11, 'ink', 0)
        for x in (5, 13): leg(c, x, 25, 5, FR, 0)


def chair_wood_s(c): chair_wood(c, 's')
def chair_wood_n(c): chair_wood(c, 'n')
def chair_wood_e(c): chair_wood(c, 'e')
def chair_wood_w(c): t = C(16, 32); chair_wood(t, 'e'); c.paste(t.flipx(), 0, 0)


# ═══════════════ 카페 의자(쇠 틀 + 붉은 방석) ═══════════════
def cafe_chair_e(c):
    seat(c, 5, 13, 9, 8, 2, 'red', 5, 2)
    for lx in (6, 12): leg(c, lx, 24, 6, 'dark', 2)
    c.HL(4, 24, 11, 'ink', 0)
    c.R(2, 5, 3, 19, 'dark', 2); c.VL(2, 5, 19, 'dark', 4); c.R(2, 5, 3, 2, 'dark', 5); c.VL(4, 7, 17, 'dark', 1)
    ol(c, 1, 4, 5, 21)


def cafe_chair_w(c): t = C(16, 32); cafe_chair_e(t); c.paste(t.flipx(), 0, 0)


# ═══════════════ 사무용 회전의자(남색) ═══════════════
NV = 'navy'


def _arms(c, y, h):
    """회전의자 팔걸이 둘(윗면 밝게 · 짙은 몸) — 바깥 테는 캔버스 안 x=0·15 에 ink."""
    for x, t in ((1, 3), (14, 2)):
        c.VL(x, y, h, 'dark', t); c.P(x, y, 'dark', 5)
    for x in (0, 15): c.VL(x, y - 1, h + 1, 'ink', 1)
    for x in (1, 14): c.P(x, y - 1, 'ink', 1); c.P(x, y + h, 'ink', 0)


def _office_base(c, y=26):
    """가스 기둥 + 별 다리(가운데에서 바퀴로 벌어지는 살 넷, 윗면 밝게) + 바퀴 셋 — 상자 테 없이 바닥이 비친다."""
    c.R(7, y - 2, 2, 3, 'dark', 3); c.VL(7, y - 2, 3, 'dark', 5)
    for x0, x1 in ((2, 6), (9, 13)):
        c.HL(x0, y + 1, x1 - x0 + 1, 'dark', 4); c.HL(x0, y + 2, x1 - x0 + 1, 'dark', 1)
    c.R(6, y + 1, 4, 2, 'dark', 3); c.HL(6, y + 1, 4, 'dark', 5)
    c.HL(2, y, 12, 'ink', 1)
    for x in (1, 14): c.VL(x, y + 1, 2, 'ink', 1)
    for x in (2, 7, 12): c.R(x, y + 3, 2, 2, 'ink', 1); c.P(x, y + 3, 'dark', 3)


def chair_office(c, facing='s'):
    if facing == 's':
        _office_base(c)
        # 등받이 = 둥근 윗면 5행(뒤 모서리 가장 밝게 → 한 단씩) + 짧은 앞면 5행(쿠션 주름) — 큰 세로 판이 아니다.
        c.R(4, 4, 8, 5, NV, 5); c.HL(5, 4, 6, NV, 6); c.HL(4, 7, 8, NV, 4); c.HL(4, 8, 8, NV, 4)
        c.R(4, 9, 8, 5, NV, 2); c.VL(4, 9, 5, NV, 3); c.VL(11, 9, 5, NV, 1); c.HL(5, 11, 6, NV, 1)
        ol(c, 3, 3, 10, 12); c.P(3, 3, None); c.P(12, 3, None)
        c.VL(7, 14, 1, 'dark', 3); c.VL(8, 14, 1, 'dark', 2)
        _arms(c, 15, 6)
        seat(c, 2, 15, 12, 7, 2, NV, 4, 1)
    elif facing == 'n':
        _office_base(c)
        seat(c, 2, 6, 12, 9, 2, NV, 4, 1)
        _arms(c, 9, 7)
        c.R(3, 15, 10, 2, NV, 6); c.HL(4, 15, 8, NV, 6)                           # 등받이 윗모서리(남쪽 가장자리)
        c.R(3, 17, 10, 6, NV, 2); c.VL(3, 17, 6, NV, 3); c.VL(12, 17, 6, NV, 1); c.HL(5, 20, 6, NV, 1)   # 뒷면(짙게)
        ol(c, 2, 14, 12, 10); c.P(2, 14, None); c.P(13, 14, None)
    else:                                                      # e: 서쪽 등받이(w 는 뒤집기)
        _office_base(c)
        seat(c, 5, 14, 9, 8, 2, NV, 4, 1)
        c.R(1, 3, 4, 20, NV, 3); c.VL(1, 3, 20, NV, 5); c.R(1, 3, 4, 2, NV, 6); c.VL(4, 5, 18, NV, 2)
        ol(c, 0, 2, 6, 22); c.P(0, 2, None); c.P(5, 2, None)
        c.R(6, 11, 7, 2, 'dark', 4); c.HL(6, 11, 7, 'dark', 5); ol(c, 5, 10, 9, 4)   # 팔걸이(윗면)


def chair_office_s(c): chair_office(c, 's')
def chair_office_n(c): chair_office(c, 'n')
def chair_office_e(c): chair_office(c, 'e')
def chair_office_w(c): t = C(16, 32); chair_office(t, 'e'); c.paste(t.flipx(), 0, 0)


# ═══════════════ 금속 벤치(역·대합실) ═══════════════
def bench_metal(c):
    """2×1: 회색 살 넷(살마다 윗면 밝게 · 사이 짙은 틈) + 앞 모서리 + 짧은 쇠 다리 · 접지 그늘. 흰 타일 위에서도 살이 보인다."""
    W = c.w
    c.R(1, 2, W - 2, 8, 'grey', 3)
    for k in range(4):
        y = 2 + k * 2
        c.HL(1, y, W - 2, 'grey', 5 if k else 6); c.HL(1, y + 1, W - 2, 'grey', 1 if k < 3 else 4)   # 살 윗면 · 틈(마지막은 앞 모서리)
    c.R(1, 10, W - 2, 3, 'grey', 2); c.HL(1, 12, W - 2, 'grey', 1)                                # 앞면 3행
    for x in (2, W // 2, W - 3): c.VL(x, 10, 3, 'grey', 4)                                        # 앞면 받침 쇠
    ol(c, 0, 1, W, 13)
    for x in (3, W - 4): c.VL(x, 13, 2, 'dark', 3); c.P(x, 15, 'ink', 0)
    c.HL(2, 13, W - 4, 'ink', 0)
