"""modern_city 실내 — 바닥·벽면·문·창·벽걸이 그림(코드 손 도트, Opus 2026-10-14).
바닥은 주기 그림(세계 좌표 그대로, 칸 경계에서 이어진다), 벽면은 32px 높이(윗줄·아랫줄) 주기 그림.
문 그림 16×32 는 칸막이 틈 아래 벽면 높이 두 줄에 서는 열린 문틀(가운데는 투명 — 바닥이 비친다)."""
import math
from mpx import C, rnd, h32, slab, panel, glass, screen, NT, MI


# ═══════════════ 바닥 ═══════════════
def floor_carpet_office(c):
    """사무실 카펫 타일: 16px 판마다 결 방향이 바뀌는 청회색 털 결(부드럽게) + 판 이음 그늘."""
    for y in range(c.h):
        for x in range(c.w):
            tile = ((x // 16) + (y // 16)) % 2
            r = rnd(x // 4, y, 11) if tile == 0 else rnd(x, y // 4, 12)
            q = rnd(x, y, 13)
            t = 3
            if r < 0.12: t = 2
            if q > 0.992: t = 4
            if tile and (x // 2) % 2 == 0 and r < 0.3: t = 2
            if x % 16 == 15 or y % 16 == 15: t = 2
            c.P(x, y, 'slate', t)


def floor_stone_lobby(c):
    """로비 대리석: 32×16 판(줄마다 16px 엇갈림), 크림 바탕에 사선 결 + 판 위왼 빛 + 반사 사선."""
    for y in range(c.h):
        for x in range(c.w):
            row = y // 16
            xs = x + (16 if row % 2 else 0)
            px, py = xs % 32, y % 16
            k = (xs // 32) % 4
            base = 4 if (k + row) % 3 else 3
            t = base
            v = math.sin((xs * 0.35 + y * 0.9) + h32(k, row, 3) % 7) + math.sin(xs * 0.11 - y * 0.23 + k)
            if 1.55 < v < 1.75: t = base - 1
            if rnd(x, y, 21) < 0.03: t = base - 1
            if px == 0 or py == 0: t = 2
            elif px == 1 or py == 1: t = 5
            elif (px + py * 2) % 23 in (0, 1) and 4 < py < 12: t = 5
            c.P(x, y, 'beige', t)


def floor_vinyl_store(c):
    """편의점 흰 비닐 타일: 16px 판, 회색 줄눈, 판마다 위왼 빛과 옅은 점."""
    for y in range(c.h):
        for x in range(c.w):
            px, py = x % 16, y % 16
            alt = (h32(x // 16, y // 16, 5) % 4 == 0)
            t = 4 if alt else 5
            if rnd(x, y, 6) < 0.035: t = 4
            if px == 15 or py == 15: t = 3
            elif px == 0 or py == 0: t = 6
            c.P(x, y, 'grey', t)


def floor_wood_oak(c):
    """아파트 마루: 높이 4px 판, 판 길이 20~40px 엇갈림(판 끝 자리는 2026-10-14 그대로). 가로로만 이어진다(rowShift).
    2026-10-20 색 규칙(A안 「나무 바닥이 아쉽다」): 판 사이 틈은 그 판보다 한 단만 어둡게(예전엔 모든 띠 밑줄이 가장 어두운 단 →
    화소 31% 가 틈이라 골덴 줄무늬로 읽혔다), 판 끝 이음만 가장 어두운 단. 띠 윗줄 전체 밝은 선은 없앴다.
    판마다 톤 8갈래(같은 wood 램프 2~4단 + 가끔 amber 꿀색 판). 판 안 명암은 줄 전체가 아니라 덩이로: 윗줄 끊긴 빛(4px 덩이 절반),
    긴 결(5px 덩이), 드문 옹이(두 단 어둡게), 몇 판에만 왁스 광택 — 판 하나에 4~5단이 보이되 띠 전체를 긋는 줄은 틈 한 단뿐이다."""
    W = c.w
    for y in range(c.h):
        band = y // 4; ly = y % 4
        # 이 띠의 판 끝 자리(주기 W 안에서)
        ends = []; pos = (h32(band, 7, 2) % 24)
        while pos < W + 40:
            ends.append(pos % W); pos += 20 + h32(pos, band, 3) % 21
        last = sum(1 for e in ends if e <= W - 1)
        for x in range(W):
            k = sum(1 for e in ends if e <= x)
            if x < min(ends): k = last                       # 주기 끝을 넘어 이어지는 판은 같은 판(색이 끊기지 않는다)
            hv = h32(k, band, 4)
            base = (3, 3, 4, 2, 3, 4, 3, 2)[hv % 8]
            honey = (hv >> 9) % 9 == 0
            t = base
            if ly == 0 and rnd(x // 4, band, 33) < 0.5: t = min(5, base + 1)                       # 끊긴 윗 빛
            if ly in (1, 2) and rnd(x // 5, y, 8 + band) < 0.14: t = base - 1                         # 결
            if ly == 1 and (hv >> 5) % 4 == 0 and rnd(x // 6, band, 31) < 0.3: t = min(5, base + 2)   # 왁스 광택
            if ly in (1, 2) and rnd(x, band, 37) < 0.025: t = max(1, base - 2)                        # 옹이
            if ly == 3: t = base - 1
            if x in ends: t = 1
            fl = rnd(x, y, 39)
            if honey and t >= 2 and x not in ends and ly != 3: c.P(x, y, 'amber', t - 1); continue
            if ly in (1, 2) and x not in ends and fl < 0.035: c.P(x, y, 'beige', min(5, t + 1)); continue     # 마른 결 점(옅은 회갈)
            if ly in (1, 2) and x not in ends and fl > 0.975: c.P(x, y, 'brick', max(1, t - 1)); continue     # 붉은 결 점
            c.P(x, y, 'wood', max(1, t))


def floor_wood_dark(c):
    """카페 짙은 마루: 헤링본(8px 폭 지그재그 판, 짜임은 2026-10-14 그대로).
    2026-10-20 색(A안): 붉은 rose 판 대신 갈색 호두 — 판 rose 1 이 바탕, 가끔 wood 0(짙은 호두)·rose 2, 판 머리 짧은 wood 1 광택, 틈 rose 0.
    벽돌 벽(brick 1~4 단)과 같은 색을 쓰지 않아 벽과 바닥이 갈린다."""
    for y in range(c.h):
        for x in range(c.w):
            bx = x // 8; lx = x % 8
            k = (y + lx // 2) if bx % 2 == 0 else (y + 3 - lx // 2)
            slat = k // 4
            col = (('rose', 1), ('wood', 0), ('rose', 1), ('rose', 2), ('rose', 1), ('wood', 0), ('rose', 1), ('rose', 2))[h32(slat, bx, 9) % 8]
            q = k % 4
            if q == 3 or lx == 7: col = ('rose', 0)
            elif q == 0 and lx in (2, 3) and col == ('rose', 2): col = ('wood', 1)                       # 판 머리 광택
            elif q == 0 and lx in (1, 2, 3, 4) and col == ('rose', 1): col = ('rose', 2)                  # 판 머리 한 단 밝게
            elif q == 2 and lx == 6 and col != ('wood', 0): col = (col[0], col[1] - 1) if col[1] else col   # 판 오른끝 그늘
            elif rnd(x, y, 45) < 0.05 and col == ('rose', 2): col = ('rose', 3)                            # 결 점
            elif rnd(x, y, 46) < 0.035 and col == ('rose', 1): col = ('brick', 0)                          # 짙은 결 점
            elif rnd(x, y, 47) < 0.03 and col == ('wood', 0): col = ('roof', 1)                            # 호두 회갈 점
            c.P(x, y, *col)


def floor_vinyl_hospital(c):
    """병원 연녹 시트 바닥: 덩이 얼룩(2~3px) + 32px 마다 용접 줄."""
    for y in range(c.h):
        for x in range(c.w):
            r = rnd(x // 3 + (y // 3) % 2, y // 3, 14); q = rnd(x, y, 15)
            t = 5
            if r < 0.18: t = 4
            elif r > 0.88: t = 6
            if q < 0.02: t = 4
            if x % 32 == 0: t = 4
            c.P(x, y, 'sage', t)


def floor_tile_concourse(c):
    """지하 통로 화강암 판: 16px 판(두 톤 번갈아), 검은·흰 점, 짙은 줄눈."""
    for y in range(c.h):
        for x in range(c.w):
            px, py = x % 16, y % 16
            base = 3 if ((x // 16) + (y // 16)) % 2 else 2
            t = base
            r = rnd(x, y, 16)
            if r < 0.07: t = base - 1
            elif r > 0.95: t = base + 2
            if px == 15 or py == 15: t = 1
            elif px == 0 or py == 0: t = base + 1
            c.P(x, y, 'grey', t)


def floor_concrete(c):
    """창고 콘크리트: 덩이 얼룩 + 작은 기름 자국 + 64px 마다 줄눈(어두운 선 + 밝은 턱)."""
    for y in range(c.h):
        for x in range(c.w):
            r = rnd(x // 4, y // 4, 17); q = rnd(x, y, 18)
            t = 4
            if r < 0.2: t = 3
            elif r > 0.85: t = 5
            if q < 0.05: t = 3
            elif q > 0.98: t = 5
            if x % 64 == 63 or y % 64 == 63: t = 1
            elif x % 64 == 0 or y % 64 == 0: t = 5
            c.P(x, y, 'body', t)
    # 기름 자국 둘
    for (cx, cy, rx, ry) in ((20, 40, 4.5, 2.5), (46, 14, 3, 2)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('body', 2 if d < 0.45 else 3))


def floor_tile_small(c):
    """주방·화장실 작은 흰 타일: 8px 판, 회색 줄눈, 판 위왼 빛."""
    for y in range(c.h):
        for x in range(c.w):
            px, py = x % 8, y % 8
            t = 5 if h32(x // 8, y // 8, 19) % 5 else 4
            if px == 7 or py == 7: t = 3
            elif px == 0 and py == 0: t = 6
            c.P(x, y, 'grey', t)


# ═══════════════ 벽면 (32px 높이) ═══════════════
def skirting(c, y, mat, t):
    n = NT[MI[mat]]
    c.HL(0, y, c.w, mat, min(n - 1, t + 1)); c.R(0, y + 1, c.w, 2, mat, t); c.HL(0, y + 3, c.w, 'ink', 1)


def wall_office(c):
    """사무실 벽: 밝은 회색 칠 + 32px 마다 판 이음 + 허리 위 가는 몰딩 + 짙은 걸레받이."""
    for y in range(28):
        for x in range(c.w):
            t = 5
            if rnd(x, y, 22) < 0.03: t = 4
            if x % 32 == 31: t = 4
            c.P(x, y, 'grey', t)
    c.HL(0, 18, c.w, 'grey', 6); c.HL(0, 19, c.w, 'grey', 3)
    skirting(c, 28, 'dark', 3)


def wall_lobby(c):
    """로비 석재 판벽: 32×20 베이지 판(줄눈·위왼 빛·결) + 황동 띠 + 짙은 석재 걸레받이."""
    for y in range(22):
        for x in range(c.w):
            px = x % 32
            t = 4
            v = math.sin(x * 0.3 + y * 0.7 + (x // 32) * 2)
            if v > 0.93: t = 3
            if px == 31: t = 2
            elif px == 0 or y == 0: t = 5
            c.P(x, y, 'beige', t)
    c.HL(0, 22, c.w, 'amber', 4); c.HL(0, 23, c.w, 'amber', 1)
    for y in range(24, 28):
        for x in range(c.w): c.P(x, y, 'beige', 3 if (x % 32) else 2)
    skirting(c, 28, 'roof', 1)


def wall_store(c):
    """편의점 벽: 흰 패널 + 빨강 띠(위·아래 테) + 회색 아랫판 + 걸레받이."""
    for y in range(28):
        for x in range(c.w):
            t = 2 if (x % 32) else 0
            if y > 21: t = 1
            c.P(x, y, 'white', t)
    c.HL(0, 12, c.w, 'red', 2); c.R(0, 13, c.w, 3, 'red', 5); c.HL(0, 13, c.w, 'red', 6); c.HL(0, 16, c.w, 'red', 2)
    c.HL(0, 21, c.w, 'grey', 4)
    skirting(c, 28, 'grey', 2)


def wall_home(c):
    """집 벽: 크림 벽지(4px 마다 옅은 세로 줄) + 나무 허리 몰딩 + 아래 한 단 짙은 벽지 + 나무 걸레받이."""
    for y in range(28):
        for x in range(c.w):
            t = 3 if x % 4 else 2
            if y >= 20: t = 2 if x % 4 else 1
            if rnd(x, y, 23) < 0.025: t -= 1
            c.P(x, y, 'cream', max(0, t))
    c.HL(0, 18, c.w, 'wood', 5); c.HL(0, 19, c.w, 'wood', 2)
    skirting(c, 28, 'wood', 2)


def wall_hospital(c):
    """병원 벽: 흰 칠 위 + 세이지 허리판 아래 + 회색 손잡이 난간(받침 쇠) + 걸레받이."""
    for y in range(17):
        for x in range(c.w): c.P(x, y, 'grey', 6 if rnd(x, y, 24) > 0.03 else 5)
    for y in range(17, 28):
        for x in range(c.w): c.P(x, y, 'sage', 5 if (x % 32) else 4)
    c.HL(0, 17, c.w, 'sage', 3)
    c.HL(0, 14, c.w, 'grey', 6); c.HL(0, 15, c.w, 'grey', 4); c.HL(0, 16, c.w, 'grey', 2)
    for bx in range(8, c.w, 32): c.P(bx, 17, 'grey', 2); c.P(bx, 18, 'grey', 3)
    skirting(c, 28, 'sage', 2)


def wall_brick(c):
    """카페 벽돌 벽: 4px 코스 · 8px 벽돌 엇갈림, 벽돌마다 한 단 차이, 회색 줄눈 + 짙은 나무 걸레받이."""
    for y in range(28):
        row = y // 4; yy = y % 4
        for x in range(c.w):
            xs = x + (4 if row % 2 else 0); col = xs // 8; xx = xs % 8
            if yy == 3 or xx == 7: c.P(x, y, 'roof', 2); continue
            v = h32(col, row, 25) % 6
            t = 2 + (1 if v in (0, 1) else 0) - (1 if v == 5 else 0)
            if yy == 0 and xx < 3: t += 1
            c.P(x, y, 'brick', t)
    skirting(c, 28, 'wood', 1)


def wall_tile(c):
    """지하 통로 벽: 흰 직사각 타일(8×4 엇갈림) + 청록 띠 두 줄 + 짙은 걸레받이."""
    for y in range(28):
        row = y // 4; yy = y % 4
        for x in range(c.w):
            xs = x + (4 if row % 2 else 0); xx = xs % 8
            if yy == 3 or xx == 7: c.P(x, y, 'grey', 4); continue
            c.P(x, y, 'grey', 6 if (yy == 0 or xx == 0) else 5)
    c.R(0, 20, c.w, 3, 'teal', 3); c.HL(0, 20, c.w, 'teal', 4); c.HL(0, 23, c.w, 'teal', 1)
    skirting(c, 28, 'dark', 2)


def wall_metal(c):
    """창고 골판 철판(4px 골) + 위 테 + 아래 시멘트 블록 허리."""
    for y in range(20):
        for x in range(c.w):
            t = (4, 5, 3, 2)[x % 4]
            if y == 0: t = 1
            elif y == 1: t = 5
            c.P(x, y, 'body', t)
    c.HL(0, 20, c.w, 'body', 1)
    for y in range(21, 28):
        for x in range(c.w):
            xx = (x + (8 if (y - 21) // 4 % 2 else 0)) % 16
            t = 3 if xx and (y - 21) % 4 != 3 else 1
            c.P(x, y, 'body', t)
    skirting(c, 28, 'dark', 2)


# ═══════════════ 천장(별도 정의는 mkit.default_ceiling) ═══════════════

# ═══════════════ 문 (16×32) ═══════════════
def _jambs(c, mat, t):
    n = NT[MI[mat]]
    for x in (0, 1):
        c.VL(x, 0, 32, mat, t + (1 if x == 1 else 0))
    for x in (14, 15):
        c.VL(x, 0, 32, mat, max(0, t - (1 if x == 15 else 0)))
    c.VL(0, 0, 32, 'ink', 1); c.VL(15, 0, 32, 'ink', 1)
    c.R(0, 0, 16, 2, mat, min(n - 1, t + 1)); c.HL(0, 0, 16, 'ink', 1); c.HL(2, 2, 12, 'ink', 0)


def door_wood(c):
    """나무 문: 짙은 나무 문틀 + 왼쪽으로 열린 문짝(옆으로 보이는 두께 3px, 손잡이) + 문지방."""
    _jambs(c, 'wood', 2)
    c.R(2, 3, 4, 27, 'wood', 3); c.VL(2, 3, 27, 'wood', 4); c.VL(5, 3, 27, 'wood', 1)
    c.HL(2, 10, 4, 'wood', 2); c.HL(2, 21, 4, 'wood', 2)
    c.P(4, 16, 'amber', 4); c.P(4, 17, 'amber', 1)
    c.VL(6, 3, 27, 'ink', 0)
    c.HL(2, 30, 12, 'wood', 4); c.HL(2, 31, 12, 'wood', 1)


def door_glass(c):
    """유리 자동문: 은색 틀, 양옆으로 밀린 유리 두 장(사선 반사), 위 센서 상자, 바닥 레일."""
    _jambs(c, 'grey', 4)
    c.R(4, 2, 8, 2, 'grey', 2); c.HL(4, 2, 8, 'grey', 5); c.P(7, 3, 'red', 5)
    for x0 in (2, 11):
        glass(c, x0, 4, 3, 26, 'teal', 3, s=x0)
        c.VL(x0 + (2 if x0 == 2 else 0), 4, 26, 'grey', 5)
    c.HL(2, 30, 12, 'grey', 6); c.HL(2, 31, 12, 'grey', 2)


def door_steel(c):
    """철문(창고·비상): 회청 철 문틀, 안쪽으로 열린 철문 두께, 위 표시등(빛 점만), 문지방."""
    _jambs(c, 'slate', 3)
    c.R(6, 2, 4, 1, 'leaf', 5)
    c.R(12, 3, 2, 27, 'slate', 2); c.VL(12, 3, 27, 'slate', 4)
    c.P(13, 16, 'grey', 6)
    c.HL(2, 30, 12, 'slate', 4); c.HL(2, 31, 12, 'slate', 1)


def door_hospital(c):
    """병원 미닫이: 흰 틀, 오른쪽으로 밀린 넓은 문짝(세로 손잡이·작은 유리창), 바닥 레일."""
    _jambs(c, 'grey', 5)
    c.R(10, 3, 4, 27, 'sage', 5); c.VL(10, 3, 27, 'sage', 6); c.VL(13, 3, 27, 'sage', 3)
    glass(c, 11, 6, 2, 6, 'teal', 3)
    c.VL(10, 15, 5, 'grey', 2)
    c.HL(2, 30, 12, 'grey', 6); c.HL(2, 31, 12, 'grey', 3)


def sidedoor_wood(c):
    """옆문 16×48: 위 두 줄은 칸막이 끝 벽면 위 문 머리(나무 인방·벽 그늘), 셋째 줄은 통로 칸의 열린 문짝(바닥에 비친 문 두께)."""
    c.R(0, 0, 16, 4, 'wood', 1); c.HL(0, 0, 16, 'ink', 1); c.HL(0, 1, 16, 'wood', 4); c.HL(0, 3, 16, 'ink', 0)
    for y in range(4, 32):
        c.HL(0, y, 2, 'wood', 2); c.HL(14, y, 2, 'wood', 1)
    c.VL(0, 0, 48, 'ink', 1); c.VL(15, 0, 48, 'ink', 1)
    c.R(2, 32, 12, 3, 'wood', 3); c.HL(2, 32, 12, 'wood', 4); c.HL(2, 34, 12, 'wood', 1)
    c.HL(2, 35, 12, 'ink', 0)


# ═══════════════ 창·벽걸이 (벽면 윗줄부터 2줄 = 32px) ═══════════════
def _frame(c, x, y, w, h, mat='grey', t=5):
    c.R(x, y, w, h, mat, t)
    c.HL(x, y, w, 'ink', 1); c.HL(x, y + h - 1, w, 'ink', 1); c.VL(x, y, h, 'ink', 1); c.VL(x + w - 1, y, h, 'ink', 1)


def window_city(c):
    """도시 창(2칸): 은색 틀 4칸 유리 너머 빌딩 실루엣(창 불빛 점)·하늘, 아래 창턱 윗면."""
    _frame(c, 0, 1, 32, 24, 'grey', 5)
    for y in range(3, 23):
        for x in range(2, 30):
            t = 4 if y < 9 else 3
            c.P(x, y, 'blue', t)
    # 빌딩 실루엣
    for (bx, bw, top, mat) in ((2, 5, 10, 'navy'), (7, 4, 6, 'navy'), (11, 6, 12, 'slate'), (17, 5, 8, 'navy'), (22, 4, 13, 'slate'), (26, 4, 9, 'navy')):
        for y in range(top, 23):
            for x in range(bx, min(30, bx + bw)):
                c.P(x, y, mat, 1 if x == bx + bw - 1 else 2)
        for y in range(top + 2, 22, 3):
            for x in range(bx + 1, min(29, bx + bw - 1), 2):
                if h32(x, y, 31) % 3: c.P(x, y, 'amber', 3)
    for x in (15, 16): c.VL(x, 2, 22, 'grey', 5 if x == 15 else 3)
    c.HL(1, 12, 30, 'grey', 4)
    c.HL(0, 25, 32, 'grey', 6); c.HL(0, 26, 32, 'grey', 4); c.HL(0, 27, 32, 'grey', 2); c.HL(0, 28, 32, 'ink', 1)


def window_blind(c):
    """블라인드 창(2칸): 흰 틀 + 반쯤 내린 가로 블라인드(살마다 빛·그늘) + 아래 유리 하늘 + 창턱."""
    _frame(c, 0, 1, 32, 24, 'grey', 6)
    for y in range(3, 23):
        for x in range(2, 30):
            if y < 14:
                c.P(x, y, 'grey', 6 if (y - 3) % 2 == 0 else 4)
            else:
                c.P(x, y, 'blue', 4 if y < 18 else 3)
                if (x + y) % 9 in (0, 1): c.P(x, y, 'navy', 6)
    c.HL(2, 14, 28, 'grey', 3)
    c.VL(8, 3, 11, 'grey', 3); c.VL(23, 3, 11, 'grey', 3)
    c.VL(16, 2, 22, 'grey', 5)
    c.HL(0, 25, 32, 'grey', 6); c.HL(0, 26, 32, 'grey', 4); c.HL(0, 27, 32, 'grey', 2); c.HL(0, 28, 32, 'ink', 1)


def window_curtain(c):
    """커튼 창(2칸): 나무 틀 유리(하늘·구름) + 양쪽 묶은 커튼(주름) + 커튼봉 + 창턱."""
    _frame(c, 3, 3, 26, 21, 'wood', 4)
    for y in range(5, 22):
        for x in range(5, 27):
            c.P(x, y, 'blue', 4 if y < 12 else 3)
    c.R(9, 7, 6, 2, 'white', 2); c.R(11, 6, 3, 1, 'white', 2); c.R(19, 10, 5, 2, 'white', 1)
    c.VL(16, 4, 19, 'wood', 3)
    c.HL(0, 1, 32, 'dark', 3); c.HL(0, 2, 32, 'dark', 1); c.P(0, 1, 'ink', 1); c.P(31, 1, 'ink', 1)
    for x0, side in ((0, 1), (25, -1)):
        for y in range(3, 25):
            for i in range(7):
                fold = (i + (0 if side > 0 else 1)) % 3
                t = (4, 3, 2)[fold]
                if y > 18 and ((i < 3) if side > 0 else (i > 3)): continue
                c.P(x0 + i, y, 'rose', t + 1)
        c.HL(x0 + (2 if side > 0 else 1), 16, 4, 'amber', 2)
    c.HL(2, 24, 28, 'wood', 5); c.HL(2, 25, 28, 'wood', 2); c.HL(2, 26, 28, 'ink', 1)


def wall_clock(c):
    """벽시계(1칸): 흰 판 + 짙은 테 + 시·분침, 숫자 없음."""
    c.ell(8, 11, 6.5, 6.5, lambda x, y, dx, dy, d: ('dark', 2) if d > 0.70 else ('grey', 6 if dx + dy < -0.2 else 5))
    c.ell(8, 11, 6.5, 6.5, lambda x, y, dx, dy, d: ('ink', 1) if d > 0.88 else None)
    for k in range(4):
        a = k * math.pi / 2
        c.P(int(8 + math.cos(a) * 4), int(11 + math.sin(a) * 4), 'dark', 2)
    c.line(8, 11, 8, 7, 'ink', 1); c.line(8, 11, 11, 12, 'dark', 1); c.P(8, 11, 'red', 4)


def tv_wall(c):
    """벽걸이 평면 TV(2칸): 얇은 검은 테 + 꺼진 화면의 사선 반사 + 아래 막대 스피커."""
    c.R(1, 4, 30, 18, 'dark', 1)
    c.HL(1, 4, 30, 'dark', 3); c.VL(1, 4, 18, 'dark', 3)
    for y in range(6, 20):
        for x in range(3, 29):
            t = 2 if (x + y) % 11 > 1 else 4
            c.P(x, y, 'dark', t)
    c.P(28, 20, 'leaf', 5)
    c.HL(1, 3, 30, 'ink', 1); c.HL(1, 22, 30, 'ink', 1); c.VL(0, 4, 18, 'ink', 1); c.VL(31, 4, 18, 'ink', 1)
    c.R(8, 24, 16, 2, 'dark', 2); c.HL(8, 24, 16, 'dark', 4); c.HL(8, 26, 16, 'ink', 1)


def art_frame(c):
    """추상화 액자(2칸): 나무 액자 + 색 덩이(하늘·주황·청록) 추상 그림, 글자 없음."""
    _frame(c, 2, 3, 28, 20, 'wood', 3)
    c.HL(3, 4, 26, 'wood', 4)
    for y in range(6, 20):
        for x in range(5, 27): c.P(x, y, 'cream', 3)
    c.ell(12, 13, 5, 5, lambda x, y, dx, dy, d: ('amber', 1 if d > 0.6 else 3))
    c.R(17, 8, 7, 9, 'teal', 4); c.VL(17, 8, 9, 'teal', 2)
    c.R(6, 16, 9, 3, 'navy', 4)
    c.line(6, 8, 14, 7, 'red', 4)


def whiteboard(c):
    """화이트보드(2칸): 은색 틀 흰 판 + 색 펜 선·막대 그래프(글자 없음) + 아래 펜 받침."""
    _frame(c, 0, 2, 32, 21, 'grey', 4)
    for y in range(4, 21):
        for x in range(2, 30): c.P(x, y, 'white', 2 if (x + y) % 13 else 1)
    for i, (x, h, m) in enumerate(((5, 5, 'blue'), (8, 8, 'red'), (11, 6, 'leaf'))):
        c.R(x, 18 - h, 2, h, m, 3)
    c.line(16, 15, 20, 11, 'blue', 2); c.line(20, 11, 24, 13, 'blue', 2); c.line(24, 13, 27, 7, 'blue', 2)
    c.HL(16, 6, 9, 'dark', 3); c.HL(16, 8, 6, 'dark', 3); c.HL(4, 6, 8, 'red', 3)
    c.HL(1, 23, 30, 'grey', 5); c.HL(1, 24, 30, 'grey', 2); c.HL(1, 25, 30, 'ink', 1)
    c.R(6, 22, 3, 1, 'red', 4); c.R(10, 22, 3, 1, 'blue', 4); c.R(22, 22, 4, 1, 'white', 2)


def ac_wall(c):
    """벽걸이 에어컨(2칸): 흰 몸통 윗면 + 앞판 + 바람 날개 틈 + 작은 불빛."""
    c.R(1, 5, 30, 4, 'grey', 6); c.HL(1, 5, 30, 'ink', 1)
    c.R(1, 9, 30, 9, 'grey', 5); c.HL(1, 9, 30, 'grey', 4)
    c.HL(3, 14, 26, 'grey', 2); c.HL(3, 15, 26, 'dark', 3); c.HL(3, 16, 26, 'grey', 3)
    c.VL(0, 5, 13, 'ink', 1); c.VL(31, 5, 13, 'ink', 1); c.HL(1, 18, 30, 'ink', 1)
    c.P(26, 11, 'leaf', 5)


def menu_board(c):
    """카페 메뉴 칠판(2칸): 나무 틀 짙은 판 + 분필 줄·컵 그림(글자 없음)."""
    _frame(c, 1, 2, 30, 22, 'wood', 2)
    for y in range(4, 22):
        for x in range(3, 29): c.P(x, y, 'dark', 2 if rnd(x // 2, y // 2, 33) > 0.15 else 3)
    for y in (7, 10, 13, 16, 19):
        c.HL(5, y, 9 + (y % 3) * 2, 'white', 0)
        c.HL(19, y, 3, 'amber', 4)
    c.R(23, 6, 4, 4, 'white', 1); c.P(27, 7, 'white', 1); c.HL(22, 10, 6, 'white', 0)


def notice_board(c):
    """코르크 게시판(1칸): 나무 틀 + 색 종이 넷 + 압정."""
    _frame(c, 1, 3, 14, 18, 'wood', 3)
    for y in range(5, 19):
        for x in range(3, 13): c.P(x, y, 'amber', 1 if rnd(x, y, 34) > 0.2 else 0)
    for (x, y, w, h, m, t) in ((3, 6, 5, 5, 'white', 2), (9, 5, 4, 6, 'blue', 4), (4, 12, 4, 5, 'red', 5), (9, 13, 4, 4, 'white', 1)):
        c.R(x, y, w, h, m, t); c.P(x + w // 2, y, 'red', 2)
