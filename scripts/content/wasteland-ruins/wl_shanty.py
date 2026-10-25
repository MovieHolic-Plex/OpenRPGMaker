"""wasteland_ruins 빽빽한 판잣집 촌 거처·살림(r57).

맵 VQA r11: 판잣집 촌이 정착지와 같은 집·소품이라 구분이 안 됐다. 작고 서로 다른 거처 여섯과 살림 둘을 더한다.
같은 3/4 문법(wl_ruins 머리말): 지붕 = 위에서 본 윗면 판(뒤 어둡고 앞 처마 밝은 턱), 앞벽 = 그 아래 남쪽 입면 + 문. 옆면 없음.
지붕 재질을 기존 판잣집(골강판 녹·청록 방수포)과 다르게 잡는다: 주황 방수포 · 주워 온 문짝 · 합판 · 아연 판 · 겹방수포 · 파랑 방수포.
"""
from wl_kit import *
from wl_ruins import STRUCT, plank_door
from wl_ruins_c import face  # noqa: F401  (MAT['plas'] 등록)

# 재질 램프(어두움 → 밝음) — modern_city 원천 램프 값만
MAT['otarp'] = [S['wine'][1], S['brick'][1], S['brick'][2], S['brick'][3], S['brick'][4], S['amber'][0], S['amber'][1]]   # 바랜 주황 방수포
MAT['ply'] = [S['bark'][0], S['bark'][1], S['bark'][2], S['bark'][3], S['bark'][4], S['amber'][2], S['amber'][3]]       # 합판·팰릿
MAT['zinc'] = [S['road'][1], S['slate'][1], S['slate'][2], S['slate'][3], S['slate'][4], S['mint'][1], S['mint'][3], S['white'][0]]  # 아연 판
MAT['yel'] = [S['bark'][2], S['ginkgo'][0], S['ginkgo'][1], S['ginkgo'][2], S['ginkgo'][3], S['ginkgo'][4]]             # 노랑 플라스틱
MAT['pink'] = [S['wine'][1], S['azalea'][0], S['azalea'][1], S['azalea'][2], S['azalea'][3], S['azalea'][4]]            # 바랜 분홍 천
for _m in ('otarp', 'ply', 'zinc', 'yel', 'pink'):
    for _c in MAT[_m]: assert _c in ALLOWED, (_m, hex(_c))


def trap_rows(x, y, w, h, ins):
    """사다리꼴 윗면(뒤가 좁다) 행마다 (x0, x1)."""
    return [(x + int(round(ins * (1 - r / max(1, h - 1)))), x + w - int(round(ins * (1 - r / max(1, h - 1))))) for r in range(h)]


def roof_plane(c, x, y, w, h, mat, ins=2, seed=0, ribs=0, base=None):
    """위에서 본 지붕판: 뒤 2행 한 단 어둡게, 앞 처마 밝은 턱 + 밑 두께. ribs>0 이면 세로 골(위에서 본 골강판)."""
    r = MAT[mat]; base = len(r) - 3 if base is None else base
    for j, (x0, x1) in enumerate(trap_rows(x, y, w, h, ins)):
        for xx in range(x0, x1):
            t = base
            if ribs: k = (xx - x) % ribs; t += 1 if k == 0 else -1 if k == ribs - 1 else 0
            if j < 2: t -= 1
            if xx == x0: t += 1
            if xx == x1 - 1: t -= 1
            if h2(xx, y + j, seed) % 23 == 0: t -= 1
            c.P(xx, y + j, K(mat, t))
    c.HL(x, y + h - 1, w, K(mat, len(r) - 1)); c.HL(x, y + h, w, K(mat, 1))


def tarp_sheet(c, pts_rows, mat, seed=0, folds=6, lo=1, hi=6):
    """방수포 덮개: rows = [(y, x0, x1)] — 뒤 어둡고 앞 밝게(위에서 본 기운 판), 접힌 주름(빛 줄 + 그늘 줄)이 비스듬히. 단은 lo..hi 로 자른다."""
    ys = [y for y, _, _ in pts_rows]; y0, y1 = min(ys), max(ys)
    for (y, x0, x1) in pts_rows:
        d = (y - y0) / max(1, y1 - y0)
        for x in range(x0, x1):
            t = (2 if d < 0.2 else 3 if d < 0.8 else 4) if hi <= 4 else (5 if d < 0.2 else 4 if d < 0.6 else 3)
            f = (x + y * 2 + seed) % (folds * 2)
            if f == 0: t += 1
            elif f == 1: t -= 1
            if x == x0: t += 1
            if x == x1 - 1: t -= 1
            c.P(x, y, K(mat, max(lo, min(hi, t))))


def ply_top(c, rows, seed=0, seams=(), y0=None, calm=False):
    """위에서 본 합판 면(rows = [(y, x0, x1)]): 뒤 어둡고 앞 밝은 결(4~6단), 넓은 얼룩(물 자국 −1·−2, 햇빛 바램 +1),
    가로 나뭇결 토막, 옹이 빛 점, 판 이음 seams=[x…](그늘 줄 + 빛 줄)."""
    ys = [y for y, _, _ in rows]; ya, yb = min(ys), max(ys)
    for (y, x0, x1) in rows:
        d = (y - ya) / max(1, yb - ya)
        for x in range(x0, x1):
            t = 2 if d < 0.12 else 3 if d < 0.45 else 4
            f = vnoise(x, y, seed + 70, 8, 64); g = vnoise(x, y, seed + 71, 4, 64)
            if f < 0.25: t -= 1
            if f < 0.12: t -= 1
            if f > (0.86 if calm else 0.72): t += 1
            if g > 0.8 and t < 5 and not calm: t += 1
            if (x + seed) % 9 < 3 and (y * 3 + x // 9) % 5 == 0: t -= 1          # 나뭇결 토막
            if h2(x, y, seed + 72) % 41 == 0: t += 1 if calm else 2              # 옹이·흠 빛
            if x == x0: t += 1
            if x == x1 - 1: t -= 1
            c.P(x, y, K('ply', max(0, min(4 if calm else 6, t))))
    for sx in seams:
        for (y, x0, x1) in rows:
            if x0 <= sx < x1 - 1: c.P(sx, y, K('ply', 1)); c.P(sx + 1, y, K('ply', 5))


def rope(c, x0, y0, x1, y1):
    c.line(x0, y0, x1, y1, K('dry', 3))
    c.P(x0, y0, K('dry', 5)); c.P(x1, y1, K('dry', 1))


def weight_tyre(c, cx, cy):
    """지붕 누름 타이어(위에서 본 고리)."""
    c.ell(cx, cy, 3, 2, K('rubber', 2)); c.ell(cx, cy, 2, 1, K('rubber', 3)); c.P(cx, cy, K('rubber', 0)); c.P(cx - 1, cy, K('rubber', 0))
    c.HL(cx - 2, cy - 2, 4, K('rubber', 5))


def brick_s(c, x, y, sh=None, mat='brick'):
    """눌러 둔 벽돌·돌덩이(위에서): 밝은 윗면 행 · 몸 · 앞 그늘 + 오른 아래로 떨어진 그림자 sh."""
    hi = len(MAT[mat]) - 1
    c.HL(x, y, 4, K(mat, hi - 1)); c.HL(x, y + 1, 4, K(mat, hi - 2)); c.HL(x, y + 2, 4, K(mat, 1)); c.P(x, y, K(mat, hi))
    if sh is not None: c.HL(x + 1, y + 3, 4, sh); c.P(x + 4, y + 1, sh); c.P(x + 4, y + 2, sh)


def brick_w(c, x, y):
    c.R(x, y, 4, 2, K('brick', 3)); c.HL(x, y, 4, K('brick', 5)); c.HL(x, y + 2, 4, K('brick', 1))


# ==== WC-HELPERS-BEGIN
def wc_grade(c, x, y, w, h, mat, seed=0, top=0, bot=0, mot=True, lo=0, hi=None, cell=6, back=0, front=0):
    """r64 화풍 보정(WC 조각 전용): 이미 칠한 mat 램프 화소를 한 번 더 민다 — 위 top 행은 처마 그늘(맨 위 −2, 다음 −1),
    아래 bot 행은 흙때(−1), 넓은 값 잡음 얼룩(밝은 바램 +1 · 젖은 얼룩 −1), back/front = 윗면의 뒤 행 −1 · 앞 행 +1.
    재질마다 명암 단을 5단 이상으로 늘리고 넓은 평면 채움을 깬다."""
    r = MAT[mat]; idx = {col: i for i, col in enumerate(r)}; hi = len(r) - 1 if hi is None else hi
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            col = c.get(xx, yy)
            if col not in idx: continue
            t = idx[col]; j = yy - y; d = 0
            if j < top: d -= 2 if j == 0 else 1
            if y + h - 1 - yy < bot: d -= 1
            if j < back: d -= 1
            if y + h - 1 - yy < front: d += 1
            if mot:
                f = vnoise(xx, yy, seed, cell, 64)
                if f > 0.8: d += 1
                elif f < 0.2: d -= 1
            c.P(xx, yy, K(mat, max(lo, min(hi, t + d))))


def wc_streaks(c, x, y, w, h, seed=0, mat='brust', n=6, on=None):
    """녹물 줄(위에서 아래로 흘러내린 2~6화소 세로 줄, 머리 어둡게 꼬리 밝게)."""
    for k in range(n):
        sx = x + h2(k, 3, seed) % max(1, w); sy = y + h2(k, 4, seed) % max(1, h // 2); ln = 3 + h2(k, 5, seed) % 5
        for j in range(ln):
            col = c.get(sx, sy + j)
            if col is None or (on is not None and col not in on): break
            c.P(sx, sy + j, K(mat, 2 + (j * 3) // ln))


def wc_pallet(c, x, y, w, h, seed=0):
    """세워 박은 팰릿 앞면(WC): 가로 널 3행(빛 결 · 몸 · 아래 그늘) + 사이 어둠 1행, 결 토막과 옹이, 받침 토막 셋(빛 모서리 · 몸 · 그늘), 못 머리."""
    c.R(x, y, w, h, K('soot', 1))
    n = (h - 1) // 4
    for k in range(n):
        yy = y + 1 + k * 4
        for i in range(w):
            g = vnoise(x + i, yy, seed + k, 4, 64)
            bv = (0, 1, -1, 0, 1)[(k + seed) % 5]                                 # 널마다 다른 바램
            top = (6 if g > 0.75 else 5 if g > 0.3 else 4) + (bv if bv < 0 else 0)
            mid = (4 if g > 0.55 else 3) + bv
            if (i + k * 3 + seed) % 11 == 0: mid = 2                       # 결 토막
            elif (i * 2 + k + seed) % 9 == 0: mid = min(5, mid + 1)          # 결 빛
            if h2(x + i, yy, seed + 5) % 13 == 0: top -= 1
            c.P(x + i, yy, K('ply', top)); c.P(x + i, yy + 1, K('ply', mid)); c.P(x + i, yy + 2, K('ply', 2 if g > 0.25 else 1))
        c.P(x + (k * 7 + seed) % w, yy + 1, K('bark', 1))                   # 옹이
    for bx in (x, x + w // 2 - 1, x + w - 3):
        for j in range(h):
            c.P(bx, y + j, K('ply', 4)); c.P(bx + 1, y + j, K('ply', 3)); c.P(bx + 2, y + j, K('ply', 1))
        for k in range(n):
            c.P(bx + 1, y + 2 + k * 4, K('metal', 6)); c.P(bx + 1, y + 3 + k * 4, K('metal', 2))   # 못 머리 · 그늘


def wc_door_lid_v(c, x, y, w, h, mat, seed=0, lo=1, hi=6, sk=0.0):
    """위에서 본, 앞뒤로 길게 눕혀 지붕에 얹은 헌 문짝(WC): 칠한 틀(왼 모서리 빛 · 오른 그늘) · 앞뒤로 놓인 오목한 판 둘
    (안쪽 위·왼 그늘 턱 · 아래·오른 빛 턱) · 깊이(뒤 끝 −1 → 앞 끝 +1) · 칠 얼룩 · 벗겨진 칠 밑 합판 · 경첩 · 앞 끝 마구리 두께 · 오른쪽 떨어진 그늘.
    sk = 행마다 비껴 놓인 기울기(아무렇게나 던져 얹은 문짝 — 서 있는 문 입면으로 읽히지 않게)."""
    K2 = lambda t: K(mat, max(lo, min(hi, t)))
    o = lambda j: int(round((j - h / 2) * sk))
    for j in range(h):
        dz = -1 if j < h * 0.3 else 1 if j > h * 0.72 else 0
        for i in range(w):
            t = 5                                                                 # 도드라진 틀(빛 받는 면)
            if i == 0: t = 6
            elif i == w - 1: t = 2
            elif i == w - 2: t = 4
            if 2 <= i <= w - 3 and (2 <= j <= h // 2 - 2 or h // 2 + 1 <= j <= h - 3):
                top = j in (2, h // 2 + 1); bot = j in (h // 2 - 2, h - 3)
                if top or i == 2: t = 1 if (top and i == 2) else 2               # 틀이 드리운 안쪽 그늘 턱
                elif bot or i == w - 3: t = 5                                     # 아래·오른 턱 빛
                else:
                    t = 3 + (1 if i == 3 else 0)                                  # 판 몸 + 왼쪽 윤기
                    if (i * 5 + seed + j // 4) % 4 == 0 and h2(x + i, (y + j) // 3, seed) % 3: t -= 1   # 세로 나뭇결
            elif 0 < i < w - 2 and (i * 3 + seed + j // 5) % 7 == 0: t -= 1          # 틀 결
            f = vnoise(x + i, y + j, seed + 90, 4, 64)
            if f > 0.8: t += 1
            elif f < 0.2: t -= 1
            if h2(x + i, y + j, seed + 93) % 17 == 0: t -= 1                      # 긁힌 자국
            c.P(x + i + o(j), y + j, K2(t + dz))
        c.P(x + w + o(j), y + j, K('soot', 2))                                    # 오른쪽 떨어진 그늘
    for k in range(4):                                                            # 벗겨진 칠 → 밑 나무(빛 테 · 몸 · 그늘)
        px, py = 1 + h2(k, 1, seed) % (w - 4), 2 + h2(k, 2, seed) % (h - 5)
        for (dx, dy, tt) in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3), (2, 1, 2), (1, 2, 2)):
            c.P(x + px + dx + o(py + dy), y + py + dy, K('ply', tt))
    for hy in (3, h - 5): c.HL(x + o(hy), y + hy, 3, K('metal', 5)); c.HL(x + o(hy + 1), y + hy + 1, 3, K('metal', 2))   # 경첩
    c.HL(x + o(h), y + h, w, K('ply', 6 if seed % 2 else 5)); c.P(x + o(h) + w - 1, y + h, K('ply', 3))   # 앞 끝 마구리(문 두께)
    c.HL(x + o(h + 1) + 1, y + h + 1, w, K('soot', 2))


# ==== WC-HELPERS-END


# ------------------------------------------------------------------ 1. 주황 방수포 덮은 골강판 오두막 (4×4)
@piece('hut-sheet', '주황 방수포 골강판 오두막', 4, 4, STRUCT,
       en='small corrugated-sheet hut seen from above: flat tin roof almost covered by a faded orange tarp tied down with ropes and weighed with bricks, front wall of vertical grey corrugated sheets with a dark doorway hung with a blue cloth curtain and a small mesh window',
       group='shacks', tags=['판잣집', '건물'], desc='골강판 오두막. 지붕 대부분을 바랜 주황 방수포로 덮고 밧줄·벽돌로 눌렀다. 앞벽은 회색 골강판, 파랑 천 걸린 출입구와 철망 창.',
       solid=[(x, y) for y in (1, 2, 3) for x in range(4)], door=(0, 3))
def _hut_sheet(c):
    # r64 축척(버들항 설원 오두막 64×66): 지붕 윗면 y 1..30(30행) ≥ 앞벽 y 32..61(30행) · 문 안 11×25 · 그림자 62..63
    roof_plane(c, 1, 1, 62, 30, 'metal', ins=7, seed=3, ribs=3)
    wc_grade(c, 1, 1, 62, 30, 'metal', seed=9, back=3, front=4, lo=1)
    tr = trap_rows(1, 1, 62, 30, 7)
    rows = []
    for j in range(2, 29):
        x0, x1 = tr[j]
        rows.append((1 + j, x0 + 3 + (1 if h2(0, j // 2, 4) % 3 == 0 else 0), x1 - 10 - (1 if h2(1, j // 2, 4) % 3 == 0 else 0)))
    tarp_sheet(c, rows, 'otarp', seed=2, folds=6, lo=1, hi=4)
    wc_grade(c, 1, 3, 62, 27, 'otarp', seed=12, front=6, cell=7, lo=1, hi=5)
    for x in range(rows[-1][1], rows[-1][2]):                     # 방수포 앞단 처짐(처마 넘어 늘어짐)
        c.P(x, 29, K('otarp', 5)); c.P(x, 30, K('otarp', 4))
        if (x // 4) % 2: c.P(x, 31, K('otarp', 2))
    for rx in (16, 31, 45):                                       # 앞뒤로 맨 밧줄 셋: 어두운 심 + 왼쪽 빛 + 매듭 마디
        for y in range(3, 31):
            c.P(rx, y, K('bark', 2)); c.P(rx - 1, y, K('dry', 4 if y % 4 == 0 else 3)) if y % 2 == 0 else None
            if y % 7 == 3: c.P(rx, y, K('dry', 2)); c.P(rx + 1, y, K('otarp', 1))
        c.P(rx, 31, K('bark', 1)); c.P(rx + 1, 30, K('bark', 1))
    brick_s(c, 21, 6, K('otarp', 1), 'conc'); brick_s(c, 7, 14, K('otarp', 1), 'conc'); brick_s(c, 36, 15, K('otarp', 1), 'conc')
    brick_s(c, 23, 22, K('otarp', 1), 'conc'); brick_s(c, 47 - 10, 5, K('otarp', 1), 'conc')
    weight_tyre(c, 11, 24); c.HL(9, 27, 5, K('otarp', 1))
    # 앞벽(y 32..61)
    corrugated(c, 2, 32, 60, 30, 'metal', base=3, pitch=3, seed=5)
    wc_grade(c, 2, 32, 60, 30, 'metal', seed=13, top=0, bot=3, lo=1, hi=6)
    rust_patch(c, 3, 47, 20, 14, seed=6, dens=0.42, on=set(MAT['metal']))
    rust_patch(c, 34, 50, 26, 11, seed=7, dens=0.32, on=set(MAT['metal']))
    rust_patch(c, 40, 33, 16, 5, seed=8, dens=0.18, on=set(MAT['metal']))
    wc_streaks(c, 2, 34, 60, 20, seed=14, mat='rust', n=9, on=set(MAT['metal']))
    c.HL(2, 32, 60, K('soot', 1)); c.HL(2, 33, 60, K('soot', 3)); c.HL(2, 34, 60, K('metal', 1)); c.HL(2, 61, 60, K('dirt', 1))
    for x in (2, 22, 42, 61): c.VL(x, 34, 27, K('metal', 1))
    for x in (23, 43): c.VL(x, 34, 27, K('metal', 6))
    c.HL(3, 47, 58, K('metal', 1)); c.HL(3, 48, 58, K('metal', 5))      # 판 겹 이음(가로)
    for x in range(5, 60, 6): c.P(x, 48, K('metal', 7)); c.P(x, 49, K('metal', 1))   # 이음 리벳
    # 출입구(안 폭 11 × 높이 25) + 파랑 천 휘장(왼쪽 반 걷음)
    c.R(6, 36, 11, 25, K('soot', 0)); c.R(7, 52, 9, 7, K('soot', 1)); c.HL(6, 59, 11, K('soot', 2)); c.HL(6, 60, 11, K('soot', 1))
    c.VL(5, 35, 26, K('wood', 2)); c.VL(17, 35, 26, K('wood', 1)); c.HL(5, 35, 13, K('wood', 4)); c.HL(5, 34, 13, K('wood', 2))
    for y in range(36, 59):
        w = 7 - (1 if y > 46 else 0) - (1 if y > 53 else 0)
        for i in range(w):
            t = 3 + (1 if i == 0 else -1 if (i + y) % 3 == 0 else 0) + (1 if i == 1 and y % 5 < 2 else 0)
            c.P(17 - w + i, y, K('blue', t))
    c.HL(10, 36, 7, K('blue', 5)); c.P(9, 47, K('blue', 2)); c.P(10, 48, K('bark', 2))   # 걷어 묶은 끈
    # 오른쪽 창(철망, 안 10×9)
    c.R(31, 38, 11, 10, K('soot', 0)); c.HL(30, 37, 13, K('metal', 6)); c.HL(30, 48, 13, K('metal', 4)); c.HL(30, 49, 13, K('metal', 1))
    c.VL(30, 37, 12, K('metal', 5)); c.VL(42, 37, 12, K('metal', 2))
    for x in (33, 35, 37, 39): c.VL(x, 38, 10, K('metal', 4))
    for y in (41, 44): c.HL(31, y, 11, K('metal', 3))
    c.P(32, 39, K('glass', 4))
    # 앞 양동이(오른쪽)
    c.R(51, 54, 7, 7, K('zinc', 4)); c.ell(54.0, 54, 3, 1, K('zinc', 6)); c.ell(54.0, 54, 2, 0, K('oil', 2)); c.VL(51, 55, 6, K('zinc', 5)); c.VL(57, 55, 6, K('zinc', 2))
    c.HL(51, 58, 7, K('zinc', 2)); c.HL(51, 60, 7, K('zinc', 1)); c.line(51, 53, 54, 51, K('metal', 5)); c.line(54, 51, 57, 53, K('metal', 3))
    c.shadow([(x, 62) for x in range(2, 62)] + [(x, 63) for x in range(4, 60)])
    c.outline()


# ------------------------------------------------------------------ 2. 문짝·팰릿 기운 움막 (4×4)
def door_panel(c, x, y, w, h, mat, seed=0, lo=1, hi=6):
    """위에서 본, 동서로 눕힌 문짝(기와처럼 겹친 덮개): 문틀 테(한 단 어둡게) · 오목한 판 둘(속 어둡게, 아래·오른 턱 밝게) ·
    한쪽 끝 놋 손잡이 · 앞 두께 밑 그늘. 칠 벗겨진 자리 둘."""
    K2 = lambda t: K(mat, max(lo, min(hi, t)))
    for j in range(h):
        for i in range(w):
            t = 4
            if j == 0 or i == 0 or i == w - 1 or j == h - 1: t = 3                 # 문틀
            if j == 0 and 0 < i < w - 1: t = 3
            if i == 0: t = 5
            if h2(x + i, y + j, seed + 3) % 31 == 0: t -= 1
            c.P(x + i, y + j, K2(t))
    pw = (w - 9) // 2
    for px in (x + 3, x + 3 + pw + 3):
        c.R(px, y + 1, pw, h - 2, K2(2)); c.HL(px, y + h - 2, pw, K2(5)); c.VL(px + pw - 1, y + 1, h - 2, K2(5))
        c.HL(px, y + 1, pw, K2(1))
    c.R(x + w - 3, y + h // 2 - 1, 2, 2, K('amber', 1)); c.P(x + w - 2, y + h // 2, K('bark', 1))     # 놋 손잡이(끝)
    c.HL(x, y + h, w, K('soot', 1))                                                        # 앞 두께 밑 그늘(밑 문짝 위에 얹힘)
    for k in range(2):
        px, py = x + 3 + h2(k, 1, seed) % (w - 6), y + 1 + h2(k, 2, seed) % (h - 2)
        c.P(px, py, K('ply', 4)); c.P(px + 1, py, K('ply', 3))


def pallet_face(c, x, y, w, h, seed=0, n=4):
    """세워 박은 팰릿 앞면: 가로 널(2행: 위 빛·아래 그늘) n장, 사이 1행 어둠, 양 끝·가운데 2화소 받침 토막."""
    c.R(x, y, w, h, K('soot', 1))
    for k in range(n):
        yy = y + k * 3 + 1
        if yy + 1 >= y + h: break
        for i in range(w):
            c.P(x + i, yy, K('ply', 5 if (i + k) % 7 else 4)); c.P(x + i, yy + 1, K('ply', 3 if (i + k * 2) % 5 else 2))
        c.P(x + (k * 5 + seed) % w, yy + 1, K('metal', 3))                                 # 못
    for bx in (x, x + w // 2 - 1, x + w - 2):
        c.R(bx, y, 2, h, K('ply', 2)); c.VL(bx, y, h, K('ply', 3))
        for k in range(n): c.HL(bx, y + k * 3 + 1, 2, K('ply', 4))


@piece('lean-doors', '문짝·팰릿 움막', 4, 4, STRUCT,
       en='lean-to built from salvaged doors and pallets seen from above: roof of old paneled doors in faded blue, white, green and orange laid flat side by side as a sloped top plane, front wall of stood-up wooden pallets stacked two high with a dark gap entrance under a plank lintel, a tied sack inside',
       group='shacks', tags=['판잣집', '움막'], desc='주워 온 문짝 넷(바랜 파랑·흰색·초록·주황)을 겹쳐 얹은 지붕, 두 단으로 세워 박은 팰릿 앞벽, 가운데 판자 인방 밑 틈 입구와 마대 자루.',
       solid=[(x, y) for y in (1, 2, 3) for x in range(4)], door=(1, 3))
def _lean_doors(c):
    # r64 축척: 지붕 윗면 y 1..31(문짝 두 줄, 뒤 줄 좁고 어둡게 → 앞 줄 넓고 밝게, 기와처럼 겹침) ≥ 앞벽 y 34..61 · 입구 안 18×25
    # 받침 판(문짝 밑으로 비치는 합판 지붕 바탕): 사다리꼴
    rows = [(1 + j, x0, x1) for j, (x0, x1) in enumerate(trap_rows(1, 1, 62, 31, 6))]
    ply_top(c, rows, seed=61, calm=True)
    # 문짝 다섯을 앞뒤로 길게 눕혀 나란히 얹음(오른쪽부터 깔아 왼 문짝이 오른 문짝 위에 겹쳐 그늘을 떨어뜨린다)
    for (x, ys, w, m, sd, hi, sk) in reversed(((2, 4, 13, 'otarp', 4, 6, 0.12), (14, 1, 13, 'blue', 1, 6, -0.1), (26, 5, 12, 'body', 2, 7, 0.06), (37, 2, 13, 'army', 3, 6, -0.13), (49, 4, 13, 'blue', 5, 6, 0.1))):
        wc_door_lid_v(c, x, ys, w, 27 - ys, m, seed=sd, hi=hi, sk=sk)
    for j, (x0, x1) in enumerate(trap_rows(1, 1, 62, 31, 9)):          # 지붕 윤곽을 사다리꼴로 깎는다(뒤 좁고 옆 처마 비스듬히)
        c.clear(0, 1 + j, x0, 1); c.clear(x1, 1 + j, 64 - x1, 1)
        if j < 27: c.P(x0, 1 + j, K('ply', 5)); c.P(x1 - 1, 1 + j, K('ply', 2))
    c.clear(0, 0, 64, 1)
    for (ax, bx) in ((19, 13), (45, 51)):                              # 앞뒤로 비스듬히 맨 밧줄(빛 · 심) — 뒤 처마에서 앞 처마로
        c.line(ax, 2, bx, 29, K('dry', 4)); c.line(ax + 1, 2, bx + 1, 29, K('bark', 1))
        for t in (8, 17, 25): c.P(ax + (bx - ax) * (t - 2) // 27, t, K('dry', 2))
    for (bx, by, m) in ((22, 10, 'blue'), (39, 6, 'army'), (29, 21, 'body'), (5, 20, 'otarp')):
        brick_s(c, bx, by, K(m, 1), 'conc')
    weight_tyre(c, 53, 15)
    # 처마(앞 문짝 두께 + 밑 그늘)
    for x in range(1, 63): c.P(x, 29, K('ply', 3) if x % 6 else K('ply', 2)); c.P(x, 30, K('ply', 2)); c.P(x, 31, K('ply', 1))
    c.HL(1, 32, 62, K('soot', 0)); c.HL(4, 33, 56, K('soot', 2))
    # 앞벽(y 34..61, 28행): 팰릿 두 단 + 가운데 입구(판자 인방 밑, 안 폭 18 × 높이 25)
    for (px, sd) in ((4, 11), (42, 12)):                              # 앞벽이 처마보다 양옆 3px 들어간다(처마 밑 그늘이 보이게)
        wc_pallet(c, px, 34, 18, 13, seed=sd)
        wc_pallet(c, px, 48, 18, 13, seed=sd + 7)
        c.HL(px, 47, 18, K('soot', 0)); c.HL(px, 61, 18, K('dirt', 1))
        for wy in (40, 54): c.P(px + 8, wy, K('bark', 2)); c.P(px + 9, wy, K('dry', 4)); c.P(px + 9, wy + 1, K('dry', 2))   # 묶은 철사
    c.R(22, 34, 20, 28, K('soot', 0)); c.R(23, 48, 18, 14, K('soot', 1)); c.R(24, 55, 16, 6, K('soot', 2))
    for bx in range(24, 40, 3):                                        # 안쪽 뒷벽 판자(어둠 속에 겨우 보이는 결)
        c.VL(bx, 39, 10, K('soot', 1))
        if h2(bx, 1, 62) % 2: c.P(bx, 42, K('soot', 2))
    for x in range(26, 40):                                            # 입구로 든 빛이 바닥에 진 띠
        for y in (58, 59, 60): c.P(x, y, K('dirt', 2 if (x + y) % 4 else 1))
    planks(c, 22, 34, 20, 4, 'wood', 3, pw=2, vertical=False, seed=13)  # 인방(가로 판자)
    c.HL(22, 34, 20, K('wood', 5)); c.HL(22, 37, 20, K('wood', 1)); c.HL(22, 38, 20, K('soot', 0))
    c.R(25, 57, 9, 4, K('army', 3)); c.HL(25, 57, 9, K('army', 5)); c.HL(25, 60, 9, K('army', 2)); c.VL(25, 58, 2, K('army', 4))   # 안 깔개
    c.rows(30, 46, ['...bb...', '..bccb..', '.baccbb.', 'baacccbd', 'bacccbdd', 'acccccbd', 'acccccbd', 'bcccccdd', 'bccccddd', '.dddddd.'],
           {'a': K('burlap', 6), 'b': K('burlap', 4), 'c': K('burlap', 3), 'd': K('burlap', 1)})      # 묶은 마대 자루
    c.P(33, 45, K('dry', 2)); c.P(34, 45, K('dry', 4)); c.P(32, 50, K('burlap', 5)); c.P(33, 52, K('burlap', 2))
    c.VL(22, 38, 24, K('ply', 1)); c.VL(41, 38, 24, K('ply', 1))
    # 기댄 막대(지붕 받침)
    for px in (23, 39): c.VL(px, 38, 23, K('wood', 4)); c.VL(px + 1, 38, 23, K('wood', 2))
    c.HL(4, 61, 56, K('dirt', 1))
    c.shadow([(x, 62) for x in range(3, 61)] + [(x, 63) for x in range(5, 59)] + [(x, y) for y in (34, 35) for x in (3, 60)])
    c.outline()


# ------------------------------------------------------------------ 3. 타이어 벽 합판 오두막 (2×3)
@piece('hut-tyre', '타이어 벽 합판 오두막', 2, 3, STRUCT,
       en='narrow shack seen from above: big plywood sheet roof as a top plane with nailed seams, weighed down by a brick and stones, front wall built of stacked old tyres in rows packed with dirt, a plywood door in the middle',
       group='shacks', tags=['판잣집', '건물'], desc='좁고 깊은 오두막. 못 박은 합판 지붕을 벽돌·돌로 눌렀고, 앞벽은 흙을 채운 헌 타이어를 줄줄이 쌓았다. 가운데 합판 문.',
       solid=[(0, 2), (1, 2), (0, 1), (1, 1)], door=(1, 2))
def _hut_tyre(c):
    # 합판 지붕(y 2..26): 판 둘, 얼룩·결, 판 이음
    rows = [(2 + j, x0, x1) for j, (x0, x1) in enumerate(trap_rows(1, 2, 30, 25, 2))]
    ply_top(c, rows, seed=7, seams=(17,), calm=True)
    for (y, x0, x1) in rows:
        if y > 3: c.P(x1 - 1, y, K('ply', 1))
    for (gx, gy, ln) in ((4, 6, 4), (10, 13, 5), (6, 21, 3), (21, 9, 4), (25, 16, 3), (20, 22, 5)): c.HL(gx, gy, ln, K('ply', 2))   # 나뭇결 획
    for y in (4, 10, 16, 22): c.P(16, y, K('metal', 2)); c.P(19, y, K('metal', 2))                              # 이음 못(어두운 머리)
    for x in range(4, 30, 6): c.P(x, 4, K('metal', 2)); c.P(x, 25, K('metal', 2))
    rust_patch(c, 1, 2, 30, 25, seed=21, dens=0.12, mat='brust', on=set(MAT['ply']))
    brick_s(c, 7, 8, K('ply', 1))
    for (x, y) in ((24, 7), (6, 19)):
        pebble(c, x, y, 3, mat='conc', shade=K('ply', 1)); c.P(x + 3, y + 1, K('ply', 1)); c.P(x + 3, y + 2, K('ply', 1))
    # 지붕 누름 타이어(위에서 본 고리: 검은 고무 테 · 흙 찬 속 · 왼쪽 위 빛 · 오른 아래 그림자)
    c.rows(21, 17, ['.abbbc.', 'ab...cd', 'b.eee.d', 'c.efe.d', '.cdddd.'], {'a': K('rubber', 6), 'b': K('rubber', 4), 'c': K('rubber', 2), 'd': K('rubber', 0), 'e': K('dirt', 4), 'f': K('dirt', 2)})
    c.rows(22, 18, ['ef.', ' ..'], {'e': K('dirt', 3), 'f': K('dirt', 3)})
    c.HL(23, 22, 5, K('ply', 1)); c.P(28, 21, K('ply', 1))
    c.HL(1, 26, 30, K('ply', 4)); c.HL(1, 27, 30, K('ply', 1))
    # 타이어 벽(y 28..45): 눕혀 쌓은 헌 타이어 앞모습(타이어 더미 tyres 와 같은 rubber 램프) — 한 개 5행:
    # 위 테(어둠) · 옆벽 빛 띠(왼쪽 반짝) · 대각 접지 무늬 2행 · 아래 테(가장 어둠). 끝은 2·1화소로 둥글게, 이웃과 맞닿고 세모 틈에만 흙.
    c.R(1, 28, 30, 18, K('dirt', 2))
    for x in range(1, 31):
        for y in range(28, 46):
            if h2(x, y, 25) % 4 == 0: c.P(x, y, K('dirt', 3))
    for row in range(4):
        y0 = 28 + row * 4
        x = 1 - (row * 5) % 11
        k = 0
        while x < 31:
            w = (11, 10, 12, 10, 11, 12)[(row * 2 + k) % 6]
            dy = 1 if h2(row, k, 26) % 3 == 0 and row < 3 else 0
            for i in range(w):
                xx = x + i
                if not (1 <= xx < 31): continue
                for j in range(5):
                    cut = 2 if j in (0, 4) else 1 if j in (1, 3) else 0
                    if i < cut or i >= w - cut: continue
                    if j == 0: t = 2
                    elif j == 1: t = 6 if 2 <= i <= 4 else 5 if i < w - 3 else 4
                    elif j in (2, 3): t = 1 if (i + (1 if j == 2 else 0)) % 3 == 0 else 3 if i < w - 2 else 2
                    else: t = 0
                    if i == cut and j in (1, 2, 3): t = min(6, t + 1) if j == 1 else 2
                    c.P(xx, y0 + j + dy, K('rubber', t))
            x += w; k += 1
    c.HL(1, 28, 30, K('soot', 1))
    # 합판 문(가운데 오른쪽, x 17..25)
    c.R(16, 30, 11, 16, K('ply', 1))
    planks(c, 17, 31, 9, 15, 'ply', 4, pw=9, seed=23, nails=False)
    c.HL(17, 31, 9, K('ply', 4)); c.VL(17, 31, 15, K('ply', 4)); c.VL(25, 31, 15, K('ply', 2))
    c.P(24, 38, K('metal', 6)); c.P(24, 39, K('metal', 2))
    c.HL(1, 45, 30, K('dirt', 1))
    c.shadow([(x, 46) for x in range(1, 31)] + [(x, 47) for x in range(3, 29)])
    c.outline()


# ------------------------------------------------------------------ 4. 사다리 단 2층 고철 판잣집 (4×6)
@piece('shack-2f', '사다리 2층 판잣집', 4, 6, STRUCT,
       en='two-level scrap shack seen from above: a small upper room with a blue tarp roof and its own front wall with a window and a doorway sits on the back of the flat plywood roof of the lower room, the lower roof forms a walkable deck in front of it with a short rail and a water drum, a wooden ladder leans on the lower front wall of rusty sheets and planks with a door and a window',
       group='shacks', tags=['판잣집', '건물', '2층'], desc='아래층 납작한 합판 지붕 뒤쪽에 파랑 방수포 지붕의 작은 위층 방을 얹었다. 앞은 난간 달린 지붕 마루, 아래층 앞벽에 사다리와 문.',
       solid=[(x, y) for y in (2, 3, 4, 5) for x in range(4)], door=(0, 5))
def _shack_2f(c):
    # r64 축척: 위층 지붕 y 0..16 · 위층 앞벽 y 18..45(28행) · 마루(아래층 지붕) y 26..59 · 아래층 앞벽 y 60..93(34행) · 문 10×25
    ply_top(c, [(y, 1, 63) for y in range(26, 58)], seed=31, seams=(13, 27, 41, 55))
    wc_grade(c, 1, 26, 62, 32, 'ply', seed=71, back=2, front=3, cell=7, lo=1, hi=6)
    rust_patch(c, 1, 26, 62, 32, seed=32, dens=0.16, mat='brust', on=set(MAT['ply']))
    grit(c, 1, 26, 62, 31, mat='ply', seed=77, rate=8, cracks=4)                       # 합판 마루 결 알·잔금
    for x in range(3, 62, 7): c.P(x, 28, K('metal', 2)); c.P(x, 55, K('metal', 2))
    c.HL(1, 57, 62, K('ply', 6)); c.HL(1, 58, 62, K('ply', 3)); c.HL(1, 59, 62, K('ply', 1))
    # 위층 방(x 24..61): 파랑 방수포 지붕 y 0..16 + 녹 판 앞벽 y 18..45
    roof_plane(c, 24, 0, 38, 16, 'blue', ins=3, seed=33, base=4)
    wc_grade(c, 24, 0, 38, 16, 'blue', seed=72, back=2, front=3, cell=5, lo=1, hi=6)
    for x in range(27, 59, 7): c.line(x, 1, x + 3, 13, K('blue', 2)); c.line(x + 1, 1, x + 4, 13, K('blue', 5))
    grit(c, 24, 0, 38, 15, mat='blue', seed=78, rate=14)   # 처진 주름(그늘 + 빛)
    c.R(30, 3, 9, 5, K('army', 3)); c.HL(30, 3, 9, K('army', 5)); c.VL(30, 4, 4, K('army', 4)); c.HL(30, 7, 9, K('army', 2)); c.HL(30, 8, 9, K('blue', 1))   # 덧댄 천
    for x in range(31, 38, 2): c.P(x, 5, K('dry', 3))
    brick_w(c, 50, 4); brick_w(c, 44, 10)
    corrugated(c, 25, 18, 36, 28, 'rust', base=3, pitch=3, seed=34)
    wc_grade(c, 25, 18, 36, 28, 'rust', seed=73, top=0, bot=2, lo=1, hi=5)
    c.HL(25, 17, 36, K('blue', 1)); c.HL(25, 18, 36, K('soot', 1)); c.HL(25, 19, 36, K('soot', 3)); c.HL(25, 45, 36, K('rust', 1))
    c.HL(25, 31, 36, K('rust', 1)); c.HL(25, 32, 36, K('rust', 5))                   # 판 겹 이음
    for x in range(27, 60, 5): c.P(x, 32, K('rust', 6))
    c.R(28, 23, 9, 9, K('soot', 0)); c.HL(27, 22, 11, K('wood', 4)); c.HL(27, 32, 11, K('wood', 2)); c.HL(27, 33, 11, K('wood', 1))  # 창(안 9×9)
    c.VL(27, 22, 11, K('wood', 3)); c.VL(37, 22, 11, K('wood', 1)); c.VL(32, 23, 9, K('wood', 2)); c.HL(28, 27, 9, K('wood', 2)); c.P(29, 24, K('glass', 4)); c.P(34, 29, K('glass', 3))
    c.R(46, 21, 11, 25, K('soot', 0)); c.R(47, 38, 9, 7, K('soot', 1))
    c.VL(45, 20, 26, K('wood', 3)); c.VL(57, 20, 26, K('wood', 1)); c.HL(45, 20, 13, K('wood', 4))  # 위층 입구(안 11×25)
    for y in range(21, 40):                                                                                          # 걷어 묶은 천
        for i in range(6 - (y - 21) // 4): c.P(51 + i + (y - 21) // 4, y, K('pink', 4 if i == 0 else 3 if (i + y) % 3 else 2))
    c.P(55, 40, K('bark', 2)); c.HL(46, 44, 11, K('soot', 2))
    grit(c, 25, 18, 36, 28, mat='rust', seed=38, rate=11)
    c.HL(25, 46, 37, K('ply', 1)); c.HL(26, 47, 36, K('ply', 2))                     # 위층 방이 마루에 드리운 그늘
    c.VL(23, 26, 20, K('ply', 1)); c.VL(22, 27, 19, K('ply', 2))                       # 위층 방 왼쪽 그늘(빛은 왼쪽 위 → 오른쪽이 아니라 방 앞·왼 밑 바닥이 어둡다)
    # 마루 위 살림: 물통(위에서 본 뚜껑) · 빨래 대야
    c.R(5, 30, 8, 11, K('blue', 3)); c.ell(8.5, 30, 3.5, 1.5, K('blue', 5)); c.ell(8.5, 30, 1.5, 0.5, K('glass', 3)); c.VL(12, 31, 10, K('blue', 2)); c.VL(5, 31, 10, K('blue', 4))
    c.HL(5, 35, 8, K('blue', 2)); c.HL(5, 36, 8, K('blue', 4)); c.HL(5, 40, 8, K('blue', 1)); c.HL(6, 41, 8, K('ply', 1))
    c.ell(16, 48, 4, 1.5, K('zinc', 6)); c.ell(16, 48, 3, 0.5, K('zinc', 3)); c.HL(13, 50, 7, K('ply', 2))
    # 마루 난간(앞 가장자리 왼쪽): 기둥 머리 + 가로대
    for x in (2, 10, 18): c.R(x, 44, 2, 14, K('wood', 2)); c.HL(x, 44, 2, K('wood', 5)); c.VL(x, 45, 13, K('wood', 3))
    c.HL(2, 46, 18, K('wood', 4)); c.HL(2, 47, 18, K('wood', 1)); c.HL(2, 52, 18, K('wood', 3)); c.HL(2, 53, 18, K('wood', 1))
    # 아래층 앞벽(y 60..93): 녹 판 · 판자 · 쇠 판
    corrugated(c, 2, 60, 18, 34, 'brust', base=4, pitch=3, seed=35)
    planks(c, 20, 60, 21, 34, 'wood', 3, pw=3, seed=36)
    corrugated(c, 41, 60, 21, 34, 'metal', base=3, pitch=3, seed=37)
    wc_grade(c, 2, 60, 18, 34, 'brust', seed=74, bot=3, lo=1, hi=7)
    wc_grade(c, 20, 60, 21, 34, 'wood', seed=75, bot=3, lo=1, hi=5)
    wc_grade(c, 41, 60, 21, 34, 'metal', seed=76, bot=3, lo=1, hi=6)
    c.HL(2, 60, 60, K('soot', 1)); c.HL(2, 61, 60, K('soot', 3)); c.HL(2, 93, 60, K('dirt', 1))
    c.HL(41, 76, 21, K('metal', 1)); c.HL(41, 77, 21, K('metal', 5)); c.HL(20, 78, 21, K('wood', 1))
    grit(c, 2, 60, 60, 34, mat='brust', seed=39, rate=13); grit(c, 2, 60, 60, 34, mat='metal', seed=40, rate=13); grit(c, 2, 60, 60, 34, mat='wood', seed=41, rate=15)
    rust_patch(c, 42, 80, 19, 13, seed=42, dens=0.3, on=set(MAT['metal']))
    wc_streaks(c, 41, 62, 21, 20, seed=43, mat='rust', n=6, on=set(MAT['metal']))
    plank_door(c, 6, 68, 10, 25, seed=8)
    c.R(25, 69, 9, 9, K('soot', 0)); c.HL(24, 68, 11, K('wood', 4)); c.HL(24, 78, 11, K('wood', 2)); c.HL(24, 79, 11, K('wood', 1))   # 아래 창(안 9×9)
    c.VL(24, 68, 11, K('wood', 3)); c.VL(34, 68, 11, K('wood', 1)); c.VL(28, 69, 9, K('ply', 3)); c.VL(29, 69, 9, K('ply', 2)); c.P(26, 70, K('glass', 4))
    # 사다리(오른쪽, 땅 → 마루 앞단 위로 솟음)
    for x in (45, 53): c.VL(x, 48, 45, K('wood', 4)); c.VL(x + 1, 48, 45, K('wood', 2))
    for y in range(52, 92, 5): c.HL(47, y, 6, K('wood', 5)); c.HL(47, y + 1, 6, K('wood', 2)); c.HL(47, y + 2, 6, K('soot', 2))
    c.P(45, 48, K('wood', 5)); c.P(53, 48, K('wood', 5))
    c.shadow([(x, 94) for x in range(2, 62)] + [(x, 95) for x in range(4, 60)])
    c.outline()


# ------------------------------------------------------------------ 5. 연통 아연 판 오두막 (4×4)
@piece('hut-stove', '연통 아연 판 오두막', 4, 4, STRUCT,
       en='small sheet-metal hut seen from above: flat pale zinc roof of standing-seam plates with riveted overlapping laps as a top plane, a tall stovepipe with a cone cap and a soot stain, front wall of riveted grey metal plates with a hinged metal door, a small window and a stack of firewood',
       group='shacks', tags=['판잣집', '건물'], desc='아연 판을 리벳으로 이어 덮은 납작한 지붕, 고깔 갓 씌운 높은 연통과 그을음. 리벳 박은 쇠판 앞벽에 경첩 쇠문과 작은 창, 앞에 장작더미.',
       solid=[(x, y) for y in (1, 2, 3) for x in range(4)], door=(3, 3))
def _hut_stove(c):
    # r64 축척: 지붕 윗면 y 3..29(27행) · 처마 y 30..31 · 앞벽 y 32..61(30행) · 쇠문 안 11×25 · 그림자 62..63
    # 아연 지붕: 앞뒤로 흐르는 판(폭 10), 세운 이음 = 왼쪽 빛 + 오른쪽 그늘, 깊이(뒤 어둡게 → 앞 밝게) 4단 + 얼룩, 가로 겹 이음 둘 + 리벳 + 녹물
    tr = trap_rows(1, 3, 62, 27, 6)
    for j, (x0, x1) in enumerate(tr):
        y = 3 + j
        s = 0 if y < 12 else 1 if y < 21 else 2; sy0 = (3, 12, 21)[s]; dl = (y - sy0) / 8.0     # 겹 이음 사이 판 한 장(앞뒤 9행)
        for x in range(x0, x1):
            u = (x - 2) % 10; k = (x - 2) // 10
            t = (3, 4, 4)[s] + (0, 1, -1, 0, 1, -1)[(k + s * 2) % 6]                      # 판마다 바랜 정도가 다르다
            t += -1 if dl < 0.25 else 0 if dl < 0.62 else 1                              # 판 한 장 안에서도 뒤(위 판 밑) 어둡고 앞 밝게
            f = vnoise(x, y, 41, 3, 64)
            if f > 0.82: t += 1
            elif f < 0.18: t -= 1
            if h2(x, y, 44) % 13 == 0: t += 1 if h2(x, y, 45) % 2 else -1                   # 산화 반점
            if u == 0: t = min(7, t + 2)
            elif u == 1: t = max(1, t - 2)
            if x == x0: t += 1
            if x == x1 - 1: t -= 1
            c.P(x, y, K('zinc', max(1, min(7, t))))
    for ly in (12, 21):                                                # 겹 이음: 뒤 판 끝 빛 + 밑 그늘 + 리벳
        x0, x1 = tr[ly - 3]
        for x in range(x0 + 1, x1 - 1):
            c.P(x, ly, K('zinc', 6 if (x - 2) % 10 else 7)); c.P(x, ly + 1, K('zinc', 1))
        for x in range(x0 + 5, x1 - 2, 5): c.P(x, ly - 1, K('zinc', 7)); c.P(x + 1, ly - 1, K('zinc', 2))
    for (dx, dy, ln) in ((6, 8, 3), (12, 17, 2), (27, 9, 3), (33, 25, 2), (52, 16, 3), (22, 26, 3), (15, 5, 2)): c.HL(dx, dy, ln, K('zinc', 2)); c.HL(dx, dy + 1, ln, K('zinc', 6))  # 찍힌 자국
    rust_patch(c, 1, 3, 62, 27, seed=42, dens=0.18, mat='brust', on=set(MAT['zinc']))
    wc_streaks(c, 1, 13, 62, 15, seed=47, mat='brust', n=8, on=set(MAT['zinc']))
    c.HL(1, 29, 62, K('zinc', 7)); c.HL(1, 30, 62, K('zinc', 4)); c.HL(1, 31, 62, K('zinc', 1))
    # 연통(x 46..49): 지붕 위 밑 고리 + 그을음 + 오른 아래 그림자 · 검은 쇠 몸(4단) · 이음 테 둘 · 고깔 갓
    c.ell(47.5, 19, 4, 1.5, K('soot', 2)); c.ell(47.5, 19, 2.5, 1, K('soot', 1))
    for (x, y) in ((42, 17), (43, 20), (52, 18), (41, 15), (53, 21), (44, 22)): c.P(x, y, K('soot', 3))
    c.HL(50, 19, 4, K('zinc', 1)); c.HL(50, 20, 5, K('zinc', 2)); c.HL(51, 21, 4, K('zinc', 2))
    for y in range(4, 19):
        c.P(46, y, K('rubber', 5)); c.P(47, y, K('rubber', 4)); c.P(48, y, K('rubber', 2)); c.P(49, y, K('rubber', 1))
    for ry in (8, 14): c.HL(46, ry, 4, K('rubber', 6)); c.HL(46, ry + 1, 4, K('rubber', 0))
    c.HL(46, 3, 4, K('soot', 0))
    c.rows(43, 0, ['...ab...', '..aabc..', '.aabbcc.', 'aabbbccd', '.dddddd.'], {'a': K('rubber', 6), 'b': K('rubber', 4), 'c': K('rubber', 2), 'd': K('rubber', 0)})
    # 앞벽(y 32..61): 리벳 쇠판 4장 × 위아래 2단 — 판마다 베벨(위·왼 빛, 아래·오른 그늘) + 얼룩
    for k, (x, w, b) in enumerate(((2, 15, 3), (17, 15, 2), (32, 15, 3), (47, 15, 2))):
        for tier, (ty, th) in enumerate(((32, 15), (47, 15))):
            b2 = b + (0, 1, -1, 1, 0, -1, 1, 0)[k * 2 + tier]                               # 판마다 다른 바램
            for j in range(th):
                for i in range(w):
                    t = b2 + (1 if i == 0 or j == 0 else -1 if i == w - 1 or j == th - 1 else 0) + (1 if j == 1 and 0 < i < w - 1 else 0)
                    if h2(x + i, ty + j, 46) % 11 == 0: t += 1 if h2(x + i, ty + j, 47) % 2 else -1
                    f = vnoise(x + i, ty + j, 43 + k + tier * 5, 3, 64)
                    if f > 0.78: t += 1
                    elif f < 0.22: t -= 1
                    if tier == 1 and j > th - 4: t -= 1
                    c.P(x + i, ty + j, K('zinc', max(1, min(6, t))))
            for (rx, ry) in ((x + 2, ty + 2), (x + w - 3, ty + 2), (x + 2, ty + th - 3), (x + w - 3, ty + th - 3), (x + w // 2, ty + 2)):
                c.P(rx, ry, K('zinc', 7)); c.P(rx, ry + 1, K('zinc', 1))
    rust_patch(c, 3, 48, 34, 13, seed=44, dens=0.32, on=set(MAT['zinc']))
    rust_patch(c, 20, 34, 12, 6, seed=45, dens=0.2, on=set(MAT['zinc']))
    wc_streaks(c, 2, 34, 60, 22, seed=46, mat='brust', n=9, on=set(MAT['zinc']))
    c.HL(2, 32, 60, K('soot', 1)); c.HL(2, 33, 60, K('soot', 3)); c.HL(2, 61, 60, K('dirt', 1))
    # 경첩 쇠문(오른쪽, 안 11 × 25)
    for j in range(25):
        for i in range(11):
            t = 3 + (2 if i == 0 else 1 if j == 0 else -2 if i == 10 else 0)
            f = vnoise(48 + i, 36 + j, 48, 3, 64)
            if 0 < i < 10 and f > 0.75: t += 1
            elif 0 < i < 10 and f < 0.25: t -= 1
            c.P(48 + i, 36 + j, K('zinc', t))
    c.VL(47, 35, 26, K('soot', 1)); c.VL(59, 35, 26, K('soot', 1)); c.HL(47, 35, 13, K('soot', 1))
    c.HL(49, 47, 9, K('zinc', 1)); c.HL(49, 48, 9, K('zinc', 6)); c.HL(49, 49, 9, K('zinc', 4))       # 문 가운데 덧댄 띠
    c.line(49, 59, 57, 50, K('zinc', 2)); c.line(49, 58, 57, 49, K('zinc', 5))                     # 사선 보강대
    for y in (39, 56): c.HL(46, y, 5, K('rubber', 2)); c.P(50, y, K('rubber', 5)); c.P(46, y + 1, K('rubber', 0))
    c.R(56, 46, 1, 4, K('amber', 1)); c.P(56, 45, K('amber', 3))
    for (rx, ry) in ((50, 37), (56, 37), (50, 59), (56, 59)): c.P(rx, ry, K('zinc', 7))
    rust_patch(c, 48, 52, 11, 9, seed=49, dens=0.3, on=set(MAT['zinc']))
    # 작은 창(안 10×9, 쇠틀)
    c.R(26, 38, 10, 9, K('soot', 0)); c.HL(25, 37, 12, K('zinc', 6)); c.HL(25, 47, 12, K('zinc', 5)); c.HL(25, 48, 12, K('zinc', 1))
    c.VL(25, 37, 11, K('zinc', 5)); c.VL(36, 37, 11, K('zinc', 2))
    c.VL(30, 38, 9, K('zinc', 4)); c.VL(31, 38, 9, K('zinc', 2)); c.HL(26, 42, 10, K('zinc', 4)); c.P(27, 39, K('glass', 4)); c.P(28, 39, K('glass', 3)); c.P(33, 44, K('glass', 3))
    c.P(28, 45, K('fire', 3)); c.P(34, 40, K('fire', 2))                                          # 안 난롯불 빛
    # 장작더미(왼쪽 앞): 통나무 마구리 원(빛 테 · 나이테 · 어두운 심) 세 단 + 위에서 본 통나무 윗면
    logp = {'a': K('wood', 5), 'b': K('wood', 3), 'c': K('wood', 4), 'd': K('bark', 1), 'e': K('wood', 2), 'f': K('bark', 2)}
    c.rows(2, 56, ['.aab.aab.aab.aab.aab', 'abcdacbdabcdacbdabcd', 'bcedbcedbcedbcedbced', '.dd..dd..dd..dd..dd.'], logp)
    c.rows(4, 53, ['.aab.aab.aab.aab', 'abcdacbdabcdacbd', 'bcedbcedbcedbced'], logp)
    c.rows(6, 50, ['.aab.aab.aab', 'abcdacbdabcd', 'bcedbcedbced'], logp)
    c.HL(7, 49, 10, K('wood', 4)); c.HL(8, 48, 8, K('wood', 5)); c.HL(6, 49, 1, K('bark', 2))
    c.shadow([(x, 62) for x in range(2, 62)] + [(x, 63) for x in range(4, 60)])
    c.outline()


# ------------------------------------------------------------------ 6. 천 걸린 방수포 장터 쉼막 (3×4)
@piece('market-shelter', '천 걸린 장터 쉼막', 3, 4, STRUCT, style='prop',
       en='open market shelter seen from above: sagging roof sewn from orange and green tarp strips as a large top plane on four poles, a row of hanging cloths and rags in pink, yellow, blue and white along the front eave, rolled rugs and bundles on the ground below, no counter',
       group='shacks', tags=['판잣집', '장터', '천막'], desc='주황·초록 방수포 띠를 이어 붙인 처진 지붕을 기둥 넷에 쳤다. 앞 처마에 분홍·노랑·파랑·흰 천이 줄줄이 걸리고, 밑에 말아 둔 깔개와 보따리.',
       solid=[(0, 3), (2, 3)])  # 문 없음: 열린 쉼막이라 가운데 앞 칸은 걸어 들어가는 칸
def _market_shelter(c):
    # r64 축척: 지붕 윗면 y 1..29(29행) ≥ 처마 밑 y 31..61 · 처마 밑 높이 30(주인공 24 가 선 채로 들어선다)
    for y in range(31, 62):                                          # 처마 밑 그늘(뒤 어둠 → 앞 땅 4단 + 흙 결)
        for x in range(2, 46):
            if y < 46: col = K('soot', 1 if y < 37 else 2 if y < 42 else 3)
            else:
                t = 2 + (1 if y > 51 else 0) + (1 if y > 57 else 0) + (1 if h2(x, y, 51) % 5 == 0 else 0) - (1 if h2(x, y, 52) % 7 == 0 else 0)
                col = K('dirt', t)
            c.P(x, y, col)
    for px in (7, 39):                                             # 뒤 기둥(밑동이 처마 깊이만큼 위에 선다)
        c.R(px, 31, 2, 15, K('wood', 1)); c.VL(px, 31, 15, K('wood', 2)); c.HL(px, 45, 2, K('soot', 0))
    c.HL(2, 46, 44, K('soot', 2))
    for (x, m) in ((5, 'pink'), (13, 'blue'), (30, 'army')):        # 말아 둔 깔개(마구리 소용돌이 + 몸 4단)
        for i in range(8):
            for j, tt in enumerate((5, 4, 4, 3, 2, 1)): c.P(x + i, 52 + j, K(m, tt - (1 if (i + j) % 4 == 0 and 0 < j < 5 else 0)))
        c.VL(x, 52, 6, K(m, 5)); c.P(x, 54, K(m, 2)); c.P(x + 1, 53, K(m, 3)); c.P(x + 1, 55, K(m, 4))
        c.HL(x + 1, 58, 8, K('dirt', 1))
    c.R(38, 49, 7, 9, K('burlap', 3)); c.HL(38, 49, 7, K('burlap', 6)); c.HL(38, 50, 7, K('burlap', 5)); c.P(41, 48, K('burlap', 4)); c.P(42, 48, K('dry', 2))
    c.HL(38, 57, 7, K('burlap', 1)); c.VL(38, 50, 7, K('burlap', 4)); c.VL(44, 50, 7, K('burlap', 2)); c.P(40, 53, K('burlap', 2)); c.P(42, 55, K('burlap', 4))
    c.R(22, 51, 6, 7, K('burlap', 4)); c.HL(22, 51, 6, K('burlap', 6)); c.HL(22, 57, 6, K('burlap', 1)); c.VL(27, 52, 5, K('burlap', 2)); c.P(24, 54, K('dry', 3))
    # 지붕(y 1..29): 동서로 이어 박은 방수포 띠(주황·초록 번갈아, 띠마다 뒤 이음 그늘 · 앞 접힌 단 빛), 살 셋이 앞뒤로 받쳐 사이가 처진다
    rows = trap_rows(0, 1, 48, 29, 5)
    bands = ((0, 6, 'army'), (6, 13, 'otarp'), (13, 20, 'army'), (20, 29, 'otarp'))
    ribs = lambda j: [rows[j][0], 16 - (5 - j // 6) // 2, 32 + (5 - j // 6) // 2, rows[j][1] - 1]
    for j, (x0, x1) in enumerate(rows):
        y = 1 + j
        b0, b1, m = next(bd for bd in bands if bd[0] <= j < bd[1])
        for x in range(x0, x1):
            rb = ribs(j); k = max(r for r in rb if r <= x); k1 = min([r for r in rb if r > x] or [x1]); u = (x - k) / max(1, k1 - k)
            sag = 1 - (2 * u - 1) ** 2
            t = 4 - (1 if sag > 0.75 else 0) - (1 if sag > 0.95 else 0) + (1 if u < 0.15 else 0)
            if j == b0: t -= 1
            if j == b1 - 1: t += 1
            if j < 3: t -= 1
            if j > 22: t += 1
            f = vnoise(x, y, 53, 5, 64)
            if f > 0.82: t += 1
            elif f < 0.18: t -= 1
            if (x + y * 2) % 9 == 0 and j not in (b0, b1 - 1): t -= 1        # 비스듬한 주름 결
            c.P(x, y, K(m, max(1, min(6, t))))
        for r in ribs(j)[1:3]: c.P(r, y, K('wood', 4 if j % 3 else 3))
    for (b0, b1, m) in bands[1:]:                                       # 이음 박음질
        for x in range(rows[b0][0] + 2, rows[b0][1] - 2, 3): c.P(x, 1 + b0, K('dry', 3))
    for j in range(7):                                                 # 덧댄 파랑 천
        for i in range(9): c.P(33 + i + j // 3, 8 + j, K('blue', 5 if j == 0 else 4 if j < 3 else 3 if i < 7 else 2))
    c.HL(34, 15, 9, K('blue', 1))
    for (rx, ry) in ((10, 4), (37, 21), (21, 13)): c.P(rx, ry, K('dry', 4)); c.P(rx + 1, ry + 1, K('dry', 2))   # 기운 자리 매듭
    c.HL(0, 29, 48, K('otarp', 6)); c.HL(0, 30, 48, K('otarp', 3))
    # 앞 처마 밑 걸린 천들(길이·색 제각각, 위 접힌 단 밝게, 주름 4단)
    x = 3
    for k, (w, ln, m) in enumerate(((6, 11, 'pink'), (5, 9, 'yel'), (6, 10, 'blue'), (5, 8, 'wpaint'), (6, 11, 'yel'))):
        hi = len(MAT[m]) - 1
        for j in range(ln):
            for i in range(w):
                if j == ln - 1 and (i + k) % 2: continue
                t = (hi if j == 0 else hi - 1) - (1 if i == w - 1 else 0) - (1 if (i + j + k) % 4 == 0 and j else 0) - (1 if j > ln // 2 and i > w // 2 else 0)
                c.P(x + i, 31 + j, K(m, max(0, t)))
        x += w + 3
    c.HL(0, 31, 48, K('dry', 3))
    for px in (1, 45):                                             # 앞 기둥
        c.R(px, 28, 2, 34, K('wood', 2)); c.VL(px, 28, 34, K('wood', 4)); c.HL(px, 27, 2, K('wood', 5)); c.HL(px, 60, 2, K('wood', 1))
    c.shadow([(x, 62) for x in range(2, 46)] + [(x, 63) for x in range(4, 44)])
    c.outline(top=False)


# ------------------------------------------------------------------ 7. 빨랫줄 (3×2)
@piece('wash-line', '넝마 빨랫줄', 3, 2, 'frame',
       en='washing line between two wooden poles seen from above: pole tops as small caps, a sagging rope with faded cloths folded over it so the back halves show as lit top surfaces and the front halves hang down, a zinc washtub with water on the ground and cloth shadows below',
       group='props', tags=['살림', '빨래'], desc='나무 장대 둘 사이 처진 줄에 바랜 넝마·천을 널었다.', solid=[])
def _wash_line(c):
    """빨래는 줄에 걸쳐 넘긴 모양: 줄 뒤로 넘어간 반쪽이 위에서 보이는 밝은 윗면(3행), 줄 자리 접힌 금, 앞으로 늘어진 반쪽.
    장대 24px(주인공 키), 천 10~12행. 밑 땅에 빨래 그림자와 물 담긴 아연 대야(타원 윗면)."""
    c.shadow([(x, y) for y in (27, 28, 29) for x in range(5, 44)])
    # 대야(오른쪽 앞): 테 타원 + 물 + 몸
    c.R(30, 26, 10, 3, K('zinc', 3)); c.VL(30, 26, 3, K('zinc', 5)); c.VL(39, 26, 3, K('zinc', 1)); c.HL(30, 29, 10, K('zinc', 1))
    c.ell(34.5, 25, 4.5, 1.5, K('zinc', 6)); c.R(31, 24, 8, 2, K('glass', 3)); c.P(32, 24, K('glass', 5)); c.P(36, 25, K('glass', 4))
    for px in (0, 45):
        c.R(px, 7, 3, 23, K('wood', 2)); c.VL(px, 7, 23, K('wood', 4)); c.VL(px + 2, 7, 23, K('wood', 1))
        c.R(px, 4, 3, 3, K('wood', 5)); c.HL(px, 4, 3, K('wood', 4)); c.P(px + 1, 5, K('wood', 3)); c.HL(px, 7, 3, K('wood', 1))   # 장대 머리 윗면(나이테)
        c.HL(px, 29, 3, K('wood', 1))
    def ly(x): u = (x - 3) / 42.0; return 8 + int(round(3 * (1 - (2 * u - 1) ** 2)))
    for x in range(3, 45): c.P(x, ly(x), K('dry', 3))
    x = 5
    for k, (w, back, front, m) in enumerate(((7, 3, 8, 'blue'), (6, 3, 7, 'wpaint'), (6, 3, 8, 'pink'), (8, 3, 7, 'army'), (5, 3, 8, 'yel'))):
        hi = len(MAT[m]) - 1
        for i in range(w):
            yl = ly(x + i)
            for j in range(1, back + 1):                                    # 뒤로 넘어간 반쪽(윗면)
                c.P(x + i, yl - j, K(m, hi - (1 if j == back else 0) - (1 if i == w - 1 else 0)))
            c.P(x + i, yl, K(m, hi - 3))                                    # 줄 자리 접힌 금
            for j in range(1, front + 1):                                   # 앞으로 늘어진 반쪽(앞면, 어둡게)
                if j == front and (i + k) % 2: continue
                c.P(x + i, yl + j, K(m, max(0, hi - 2 - (1 if i == w - 1 else 0) - (1 if (i + j + k) % 3 == 0 else 0))))
        x += w + 1
    c.outline(top=False)


# ------------------------------------------------------------------ 8. 플라스틱 상자·양동이 더미 (2×1)
def pcrate(c, x, y, w, top, front, mat):
    """플라스틱 상자: 위가 트인 윗면(테 밝게, 속 어둡게 + 바닥 격자) + 앞면 구멍 줄."""
    hi = len(MAT[mat]) - 1
    c.R(x, y, w, top, K(mat, hi - 1)); c.R(x + 1, y + 1, w - 2, top - 2, K(mat, 1))
    for i in range(x + 2, x + w - 1, 2): c.P(i, y + top - 2, K(mat, 0))
    c.HL(x, y + top - 1, w, K(mat, hi))
    c.R(x, y + top, w, front, K(mat, hi - 2)); c.VL(x, y + top, front, K(mat, hi - 1)); c.VL(x + w - 1, y + top, front, K(mat, 1))
    for i in range(x + 2, x + w - 2, 2):
        c.VL(i, y + top + 1, max(1, front - 3), K(mat, 0))
    c.HL(x, y + top + front - 1, w, K(mat, 1))


def bucket(c, cx, y, mat, h=5):
    hi = len(MAT[mat]) - 1
    c.R(cx - 2, y + 1, 5, h, K(mat, hi - 2)); c.VL(cx - 2, y + 1, h, K(mat, hi - 1)); c.VL(cx + 2, y + 1, h, K(mat, 1))
    c.ell(cx, y + 1, 2, 1, K(mat, hi)); c.R(cx - 1, y + 1, 3, 1, K(mat, 1))
    c.HL(cx - 2, y + h, 5, K(mat, 1))


@piece('crates-plastic', '플라스틱 상자·양동이 더미', 2, 1, 'box',
       en='pile of old plastic crates and buckets seen from above: open-topped blue and green crates stacked two high with slotted fronts, a yellow crate, a white and a red bucket with round rims',
       group='props', tags=['살림', '상자'], desc='파랑·초록 플라스틱 상자 두 단, 노랑 상자 하나, 흰·빨강 양동이.', solid=[(0, 0)])
def _crates_plastic(c):
    pcrate(c, 1, 0, 11, 4, 5, 'army')                              # 위 단(아래 상자 위에 얹힘)
    c.R(1, 9, 11, 6, K('blue', 2)); c.VL(1, 9, 6, K('blue', 3)); c.VL(11, 9, 6, K('blue', 1))      # 아래 단 앞면
    for i in range(3, 10, 2): c.VL(i, 10, 3, K('blue', 0))
    c.HL(1, 9, 11, K('blue', 4)); c.HL(1, 14, 11, K('blue', 1))
    pcrate(c, 13, 4, 9, 4, 7, 'yel')
    bucket(c, 25, 3, 'body', h=8)
    bucket(c, 29, 7, 'brick', h=7)
    c.shadow([(x, 15) for x in range(2, 31)])
    c.outline()
