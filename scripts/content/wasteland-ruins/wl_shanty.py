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


# ------------------------------------------------------------------ 1. 주황 방수포 덮은 골강판 오두막 (2×2)
@piece('hut-sheet', '주황 방수포 골강판 오두막', 3, 3, STRUCT,
       en='small corrugated-sheet hut seen from above: flat tin roof almost covered by a faded orange tarp tied down with ropes and weighed with bricks, front wall of vertical grey corrugated sheets with a dark doorway hung with a blue cloth curtain and a small mesh window',
       group='shacks', tags=['판잣집', '건물'], desc='골강판 오두막. 지붕 대부분을 바랜 주황 방수포로 덮고 밧줄·벽돌로 눌렀다. 앞벽은 회색 골강판, 파랑 천 걸린 출입구와 철망 창.',
       solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], door=(0, 2))
def _hut_sheet(c):
    # 지붕(y 1..15) — 앞벽(y 16..45, 30행)이 주인공(24)보다 높은 한 층
    roof_plane(c, 1, 1, 46, 14, 'metal', ins=3, seed=3, ribs=3)
    rows = []
    for y in range(2, 15):
        x0 = 4 + (1 if y < 5 else 0) + (1 if h2(0, y // 2, 4) % 3 == 0 else 0)
        x1 = 41 - (1 if y < 4 else 0) - (1 if h2(1, y // 2, 4) % 3 == 0 else 0)
        rows.append((y, x0, x1))
    tarp_sheet(c, rows, 'otarp', seed=2, folds=5, lo=1, hi=4)
    for x in range(4, 41):                                        # 방수포 앞단 처짐(처마 넘어 늘어짐)
        c.P(x, 14, K('otarp', 4))
        if (x // 3) % 2: c.P(x, 15, K('otarp', 2))
    for rx in (12, 24, 35):                                       # 앞뒤로 맨 밧줄 셋: 어두운 심 + 왼쪽 빛
        for y in range(2, 16):
            c.P(rx, y, K('bark', 2)); c.P(rx - 1, y, K('dry', 3)) if y % 2 == 0 else None
        c.P(rx, 16, K('bark', 1)); c.P(rx + 1, 15, K('bark', 1))       # 처마 매듭
    brick_s(c, 16, 5, K('otarp', 1), 'conc'); brick_s(c, 5, 9, K('otarp', 1), 'conc'); brick_s(c, 28, 9, K('otarp', 1), 'conc')
    brick_s(c, 37, 4, K('otarp', 1), 'conc')
    c.R(41, 3, 4, 10, K('metal', 4)); c.VL(44, 3, 10, K('metal', 2)); c.VL(42, 3, 10, K('metal', 5))   # 덮이지 않은 쇠 띠
    # 앞벽(y 16..45)
    corrugated(c, 2, 16, 44, 30, 'metal', base=3, pitch=3, seed=5)
    rust_patch(c, 3, 30, 16, 14, seed=6, dens=0.42, on=set(MAT['metal']))
    rust_patch(c, 25, 35, 19, 9, seed=7, dens=0.3, on=set(MAT['metal']))
    rust_patch(c, 30, 17, 12, 4, seed=8, dens=0.15, on=set(MAT['metal']))
    c.HL(2, 16, 44, K('soot', 1)); c.HL(2, 17, 44, K('soot', 3)); c.HL(2, 45, 44, K('dirt', 1))
    for x in (2, 23, 45): c.VL(x, 16, 30, K('metal', 1))
    c.HL(3, 30, 42, K('metal', 1)); c.HL(3, 31, 42, K('metal', 5))      # 판 겹 이음(가로)
    # 출입구(안 폭 11 × 높이 25) + 파랑 천 휘장(왼쪽 반 걷음)
    c.R(5, 20, 11, 25, K('soot', 0)); c.HL(5, 43, 11, K('soot', 2)); c.HL(5, 44, 11, K('soot', 1))
    c.VL(4, 19, 27, K('wood', 2)); c.VL(16, 19, 27, K('wood', 1)); c.HL(4, 19, 13, K('wood', 3))
    for y in range(20, 43):
        w = 6 - (1 if y > 30 else 0) - (1 if y > 38 else 0)
        for i in range(w): c.P(16 - w + i, y, K('blue', 3 + (1 if i == 0 else -1 if (i + y) % 3 == 0 else 0)))
    c.HL(10, 20, 6, K('blue', 5)); c.P(9, 31, K('blue', 2)); c.P(10, 32, K('bark', 2))   # 걷어 묶은 끈
    # 오른쪽 창(철망, 안 9×9)
    c.R(29, 23, 10, 9, K('soot', 0)); c.HL(28, 22, 12, K('metal', 6)); c.HL(28, 32, 12, K('metal', 5))
    c.VL(28, 22, 11, K('metal', 5)); c.VL(39, 22, 11, K('metal', 2))
    for x in (31, 33, 35, 37): c.VL(x, 23, 9, K('metal', 4))
    for y in (26, 29): c.HL(29, y, 10, K('metal', 3))
    c.shadow([(x, 46) for x in range(2, 46)] + [(x, 47) for x in range(4, 44)])
    c.outline()


# ------------------------------------------------------------------ 2. 문짝·팰릿 기운 움막 (3×2)
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


@piece('lean-doors', '문짝·팰릿 움막', 3, 3, STRUCT,
       en='lean-to built from salvaged doors and pallets seen from above: roof of old paneled doors in faded blue, white, green and orange laid side by side as a sloped top plane, front wall of stood-up wooden pallets stacked two high with a dark gap entrance under a plank lintel, a tied sack inside',
       group='shacks', tags=['판잣집', '움막'], desc='주워 온 문짝 넷(바랜 파랑·흰색·초록·주황)을 겹쳐 얹은 지붕, 두 단으로 세워 박은 팰릿 앞벽, 가운데 판자 인방 밑 틈 입구와 마대 자루.',
       solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], door=(1, 2))
def _lean_doors(c):
    # 지붕: 동서로 눕힌 문짝 넷을 앞뒤로 계단처럼 겹쳐 덮음(뒤 줄 먼저, 앞 줄이 위), 끝을 동서로 엇갈림
    for (x, y, w, h, m, sd, lo, hi) in ((2, 1, 25, 7, 'blue', 1, 1, 6), (26, 1, 20, 7, 'body', 2, 1, 6), (1, 8, 19, 7, 'army', 3, 1, 6), (19, 8, 27, 7, 'otarp', 4, 1, 4)):
        door_panel(c, x, y, w, h, m, seed=sd, lo=lo, hi=hi)
    brick_s(c, 12, 3, K('blue', 1), 'conc'); brick_s(c, 33, 10, K('otarp', 1), 'conc')
    c.HL(1, 16, 45, K('ply', 1))                                         # 처마 밑 그늘(문짝 두께)
    for x in range(1, 46): c.P(x, 15, K('ply', 4) if x % 5 else K('ply', 2))
    # 앞벽(y 17..46, 30행): 팰릿을 두 단으로 세워 박음 + 가운데 입구(판자 인방 밑 안 폭 12 × 높이 26)
    for (px, sd) in ((2, 11), (32, 12)):
        pallet_face(c, px, 17, 14, 15, seed=sd, n=5)
        pallet_face(c, px, 32, 14, 15, seed=sd + 7, n=5)
        c.HL(px, 31, 14, K('soot', 0)); c.HL(px, 32, 14, K('ply', 1))
        for wy in (24, 39): c.P(px + 6, wy, K('bark', 2)); c.P(px + 7, wy, K('dry', 3))    # 묶은 철사
    c.R(16, 17, 16, 30, K('soot', 0)); c.R(17, 34, 14, 13, K('soot', 1))
    planks(c, 16, 17, 16, 4, 'wood', 3, pw=2, vertical=False, seed=13)  # 인방(가로 판자)
    c.HL(16, 17, 16, K('wood', 5)); c.HL(16, 20, 16, K('wood', 1)); c.HL(16, 21, 16, K('soot', 0))
    c.R(18, 42, 7, 4, K('army', 3)); c.HL(18, 42, 7, K('army', 5)); c.HL(18, 45, 7, K('army', 2))          # 안 깔개
    c.rows(23, 35, ['..bb..', '.bccb.', 'baccbb', 'acccbd', 'acccbd', 'acccbd', 'bcccdd', 'bcccdd', '.dddd.'],
           {'a': K('burlap', 5), 'b': K('burlap', 4), 'c': K('burlap', 3), 'd': K('burlap', 1)})     # 묶은 마대 자루
    c.P(25, 34, K('dry', 2)); c.P(26, 34, K('dry', 2))
    c.VL(16, 17, 30, K('ply', 1)); c.VL(31, 17, 30, K('ply', 1))
    # 기댄 막대(지붕 받침)
    c.VL(17, 21, 26, K('wood', 3)); c.VL(30, 21, 26, K('wood', 3)); c.VL(18, 21, 26, K('wood', 1))
    c.HL(2, 46, 44, K('dirt', 1))
    c.shadow([(x, 47) for x in range(2, 46)])
    c.outline()
    for y in range(8, 16): c.P(46, y, K('bark', 0))                     # 주황 문짝 끝 윤곽: 검붉은 띠 대신 짙은 갈색


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


# ------------------------------------------------------------------ 4. 사다리 단 2층 고철 판잣집 (3×5)
@piece('shack-2f', '사다리 2층 판잣집', 3, 5, STRUCT,
       en='two-level scrap shack seen from above: a small upper room with a blue tarp roof and its own front wall with a window and a doorway sits on the back of the flat plywood roof of the lower room, the lower roof forms a walkable deck in front of it with a short rail and a water drum, a wooden ladder leans on the lower front wall of rusty sheets and planks with a door and a window',
       group='shacks', tags=['판잣집', '건물', '2층'], desc='아래층 납작한 합판 지붕 뒤쪽에 파랑 방수포 지붕의 작은 위층 방을 얹었다. 앞은 난간 달린 지붕 마루, 아래층 앞벽에 사다리와 문.',
       solid=[(0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3), (0, 4), (1, 4), (2, 4)], door=(0, 4))
def _shack_2f(c):
    # 층 높이(주인공 24px): 위층 앞벽 y 11..39(29행 + 처마) · 아래층 앞벽 y 48..77(30행). 문 25행.
    # 아래층 지붕 = 마루(y 26..46): 합판 판 넷 + 얼룩·결
    ply_top(c, [(y, 1, 47) for y in range(26, 46)], seed=31, seams=(12, 24, 36))
    rust_patch(c, 1, 26, 46, 20, seed=32, dens=0.18, mat='brust', on=set(MAT['ply']))
    c.HL(1, 45, 46, K('ply', 6)); c.HL(1, 46, 46, K('ply', 3)); c.HL(1, 47, 46, K('ply', 1))
    # 위층 방(x 18..45): 지붕 y 0..10(파랑 방수포) + 앞벽 y 11..39(녹 판)
    roof_plane(c, 18, 0, 28, 10, 'blue', ins=2, seed=33, base=4)
    for x in range(20, 44, 6): c.line(x, 1, x + 2, 8, K('blue', 2))                   # 처진 주름
    c.R(23, 2, 7, 4, K('army', 3)); c.HL(23, 2, 7, K('army', 5)); c.HL(23, 6, 7, K('blue', 1))   # 덧댄 천
    brick_w(c, 37, 3)
    corrugated(c, 19, 11, 26, 29, 'rust', base=3, pitch=3, seed=34)
    c.HL(19, 11, 26, K('soot', 1)); c.HL(19, 12, 26, K('soot', 3)); c.HL(19, 39, 26, K('rust', 1))
    c.HL(19, 25, 26, K('rust', 1)); c.HL(19, 26, 26, K('rust', 5))                   # 판 겹 이음
    c.R(22, 18, 8, 9, K('soot', 0)); c.HL(21, 17, 10, K('wood', 4)); c.HL(21, 27, 10, K('wood', 3))  # 창(안 8×9)
    c.VL(21, 17, 11, K('wood', 3)); c.VL(30, 17, 11, K('wood', 2)); c.VL(26, 18, 9, K('wood', 2)); c.HL(22, 22, 8, K('wood', 2))
    c.R(34, 15, 10, 25, K('soot', 0)); c.VL(33, 14, 26, K('wood', 3)); c.VL(44, 14, 26, K('wood', 1)); c.HL(33, 14, 12, K('wood', 4))  # 위층 입구(안 10×25)
    for y in range(15, 33):                                                                                           # 걷어 묶은 천
        for i in range(5 - (y - 15) // 4): c.P(39 + i + (y - 15) // 4, y, K('pink', 4 if i == 0 else 3 if (i + y) % 3 else 2))
    c.P(42, 33, K('bark', 2)); c.HL(34, 38, 10, K('soot', 2))
    grit(c, 19, 11, 26, 29, mat='rust', seed=38, rate=11)
    c.HL(19, 40, 26, K('ply', 1)); c.HL(20, 41, 25, K('ply', 2))                     # 위층 방이 마루에 드리운 그늘
    # 마루 위 살림: 물통 · 빨래 대야
    c.R(5, 30, 6, 9, K('blue', 3)); c.ell(7.5, 30, 2.5, 1, K('blue', 5)); c.P(8, 30, K('glass', 3)); c.VL(10, 31, 8, K('blue', 2)); c.VL(5, 31, 8, K('blue', 4))
    c.HL(5, 34, 6, K('blue', 2)); c.HL(5, 38, 6, K('blue', 1))
    c.ell(13, 41, 3, 1, K('zinc', 6)); c.ell(13, 41, 2, 0, K('zinc', 3))
    # 마루 난간(앞 가장자리 왼쪽 절반): 기둥 머리 + 가로대
    for x in (2, 9, 16): c.R(x, 33, 2, 12, K('wood', 2)); c.HL(x, 33, 2, K('wood', 5)); c.VL(x, 34, 11, K('wood', 3))
    c.HL(2, 35, 16, K('wood', 4)); c.HL(2, 36, 16, K('wood', 1)); c.HL(2, 40, 16, K('wood', 3)); c.HL(2, 41, 16, K('wood', 1))
    # 아래층 앞벽(y 48..77): 녹 판 · 판자 · 쇠 판
    corrugated(c, 2, 48, 14, 30, 'brust', base=4, pitch=3, seed=35)
    planks(c, 16, 48, 15, 30, 'wood', 3, pw=3, seed=36)
    corrugated(c, 31, 48, 15, 30, 'metal', base=3, pitch=3, seed=37)
    c.HL(2, 48, 44, K('soot', 1)); c.HL(2, 49, 44, K('soot', 3)); c.HL(2, 77, 44, K('dirt', 1))
    c.HL(31, 62, 15, K('metal', 1)); c.HL(31, 63, 15, K('metal', 5)); c.HL(16, 64, 15, K('wood', 1))
    grit(c, 2, 48, 44, 30, mat='brust', seed=39, rate=13); grit(c, 2, 48, 44, 30, mat='metal', seed=40, rate=13); grit(c, 2, 48, 44, 30, mat='wood', seed=41, rate=15)
    rust_patch(c, 32, 66, 13, 10, seed=42, dens=0.3, on=set(MAT['metal']))
    plank_door(c, 4, 53, 10, 25, seed=8)
    c.R(20, 55, 8, 9, K('soot', 0)); c.HL(19, 54, 10, K('wood', 4)); c.HL(19, 64, 10, K('wood', 2))           # 아래 창(안 8×9)
    c.VL(19, 54, 11, K('wood', 3)); c.VL(28, 54, 11, K('wood', 1)); c.VL(23, 55, 9, K('ply', 3)); c.VL(24, 55, 9, K('ply', 2))
    # 사다리(오른쪽, 땅 → 마루 앞단 위로 솟음)
    for x in (35, 42): c.VL(x, 37, 41, K('wood', 4)); c.VL(x + 1, 37, 41, K('wood', 2))
    for y in range(40, 77, 4): c.HL(37, y, 5, K('wood', 5)); c.HL(37, y + 1, 5, K('wood', 1))
    c.P(35, 37, K('wood', 5)); c.P(42, 37, K('wood', 5))
    c.shadow([(x, 78) for x in range(2, 46)] + [(x, 79) for x in range(4, 44)])
    c.outline()


# ------------------------------------------------------------------ 5. 연통 아연 판 오두막 (2×2)
@piece('hut-stove', '연통 아연 판 오두막', 3, 3, STRUCT,
       en='small sheet-metal hut seen from above: flat pale zinc roof plates with riveted overlapping seams as a top plane, a tall stovepipe with a cone cap and a soot stain, front wall of riveted grey metal plates with a hinged metal door, a small window and a stack of firewood',
       group='shacks', tags=['판잣집', '건물'], desc='아연 판을 리벳으로 이어 덮은 납작한 지붕, 고깔 갓 씌운 높은 연통과 그을음. 리벳 박은 쇠판 앞벽에 경첩 쇠문과 작은 창, 앞에 장작더미.',
       solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], door=(2, 2))
def _hut_stove(c):
    # 지붕 판 3장(y 4..17): 판 톤 4/5/4 번갈아, 겹친 이음 = 어두운 줄 + 밝은 줄, 판마다 찍힌 자국
    for j, (x0, x1) in enumerate(trap_rows(1, 4, 46, 14, 2)):
        y = 4 + j
        for x in range(x0, x1):
            k = (x - 1) // 15; u = (x - 1) % 15
            t = (5 if k == 1 else 4) + (1 if u == 1 else 0)
            if j < 2: t -= 1
            if j >= 11: t += 1
            if h2(x, y, 41) % 19 == 0: t -= 1
            c.P(x, y, K('zinc', t))
    for x in (16, 31):
        for y in range(4, 18): c.P(x, y, K('zinc', 2)); c.P(x + 1, y, K('zinc', 6))
        for y in range(6, 17, 4): c.P(x + 1, y, K('zinc', 7))
    for (dx, dy) in ((5, 8), (9, 13), (20, 7), (24, 14), (40, 8), (43, 13), (12, 6)): c.HL(dx, dy, 2, K('zinc', 3))   # 찍힌 자국
    rust_patch(c, 1, 4, 46, 14, seed=42, dens=0.2, mat='brust', on=set(MAT['zinc']))
    c.HL(1, 17, 46, K('zinc', 7)); c.HL(1, 18, 46, K('zinc', 1))
    # 연통(이음에서 비켜 x 37..39): 지붕 위 밑 고리 + 그을음 + 오른 아래 그림자 · 검은 쇠 몸 · 이음 테 · 고깔 갓
    c.ell(38, 12, 2.5, 1, K('soot', 2)); c.HL(36, 11, 5, K('soot', 3))
    for (x, y) in ((35, 10), (34, 12), (36, 13), (40, 10), (33, 9)): c.P(x, y, K('soot', 3))
    c.HL(40, 13, 2, K('zinc', 2)); c.HL(39, 14, 3, K('zinc', 2))
    c.R(37, 4, 3, 8, K('rubber', 2)); c.VL(37, 4, 8, K('rubber', 4)); c.VL(39, 4, 8, K('rubber', 1)); c.HL(37, 8, 3, K('rubber', 5))
    c.HL(37, 3, 3, K('soot', 0))
    c.rows(35, 0, ['...a...', '..abc..', '.aabcc.', 'aabbccd'], {'a': K('rubber', 5), 'b': K('rubber', 3), 'c': K('rubber', 2), 'd': K('rubber', 1)})
    # 앞벽(y 19..46, 28행): 리벳 쇠판 3장 × 위아래 2단
    for k, (x, w, b) in enumerate(((2, 15, 3), (17, 14, 2), (31, 15, 3))):
        for j in range(28):
            for i in range(w):
                t = b + (1 if i == 0 else -1 if i == w - 1 else 0) + (1 if h2(x + i, j, 43 + k) % 13 == 0 else 0)
                if j == 13: t -= 1
                if j == 14: t += 1
                c.P(x + i, 19 + j, K('zinc', t))
        for y in (20, 31, 34, 45): c.P(x + 1, y, K('zinc', 6)); c.P(x + w - 2, y, K('zinc', 6))
    rust_patch(c, 4, 34, 26, 11, seed=44, dens=0.3, on=set(MAT['zinc']))
    rust_patch(c, 18, 20, 10, 5, seed=45, dens=0.2, on=set(MAT['zinc']))
    c.HL(2, 19, 44, K('soot', 1)); c.HL(2, 46, 44, K('dirt', 1))
    # 경첩 쇠문(오른쪽, 11 × 25)
    c.R(33, 22, 11, 25, K('zinc', 3)); c.VL(33, 22, 25, K('zinc', 5)); c.VL(43, 22, 25, K('zinc', 1)); c.HL(33, 22, 11, K('zinc', 6))
    c.VL(32, 21, 26, K('soot', 1)); c.VL(44, 21, 26, K('soot', 1)); c.HL(32, 21, 13, K('soot', 1))
    c.HL(34, 33, 9, K('zinc', 2)); c.HL(34, 34, 9, K('zinc', 5))            # 문 가운데 덧댄 띠
    for y in (25, 41): c.HL(32, y, 4, K('rubber', 2)); c.P(35, y, K('rubber', 4))
    c.R(41, 32, 1, 3, K('amber', 1)); c.P(41, 31, K('amber', 3))
    for (rx, ry) in ((35, 23), (41, 23), (35, 45), (41, 45)): c.P(rx, ry, K('zinc', 7))
    # 작은 창(안 9×8, 쇠틀)
    c.R(19, 23, 9, 8, K('soot', 0)); c.HL(18, 22, 11, K('zinc', 6)); c.HL(18, 31, 11, K('zinc', 6)); c.VL(18, 22, 10, K('zinc', 5)); c.VL(28, 22, 10, K('zinc', 2))
    c.VL(23, 23, 8, K('zinc', 4)); c.HL(19, 26, 9, K('zinc', 4)); c.P(20, 24, K('glass', 3)); c.P(25, 28, K('glass', 3))
    # 장작더미(왼쪽 앞): 통나무 마구리 원(빛 테 · 어두운 심) 세 단
    logp = {'a': K('wood', 5), 'b': K('wood', 3), 'c': K('wood', 4), 'd': K('bark', 1), 'e': K('wood', 1)}
    c.rows(2, 42, ['.aab.aab.aab.aab', 'abcdacbdabcdacbd', 'bcedbcedbcedbced', '.dd..dd..dd..dd.'], logp)
    c.rows(4, 39, ['.aab.aab.aab', 'abcdacbdabcd', 'bcedbcedbced'], logp)
    c.rows(6, 36, ['.aab.aab', 'abcdacbd', 'bcedbced'], logp)
    c.HL(7, 35, 6, K('wood', 3))
    c.shadow([(x, 47) for x in range(2, 46)])
    c.outline()


# ------------------------------------------------------------------ 6. 천 걸린 방수포 장터 쉼막 (3×3)
@piece('market-shelter', '천 걸린 장터 쉼막', 3, 3, STRUCT, style='prop',
       en='open market shelter seen from above: sagging roof sewn from orange and green tarp strips as a top plane on four poles, a row of hanging cloths and rags in pink, yellow, blue and white along the front eave, rolled rugs and bundles on the ground below, no counter',
       group='shacks', tags=['판잣집', '장터', '천막'], desc='주황·초록 방수포 띠를 이어 붙인 처진 지붕을 기둥 넷에 쳤다. 앞 처마에 분홍·노랑·파랑·흰 천이 줄줄이 걸리고, 밑에 말아 둔 깔개와 보따리.',
       solid=[(0, 2), (2, 2)])  # 문 없음: 열린 쉼막이라 가운데 앞 칸은 걸어 들어가는 칸(문 칸은 막힌 칸이어야 한다는 정의 검사)
def _market_shelter(c):
    # 처마 높이: 지붕 앞단 y 16, 땅 y 46 → 처마 밑 29px(주인공 24 가 허리 굽히지 않고 들어선다)
    # 바닥 그늘(지붕 밑 어둠 → 앞 땅) + 뒤 기둥 + 말아 둔 깔개·보따리(지붕보다 먼저)
    for y in range(17, 47):
        for x in range(2, 46):
            c.P(x, y, K('soot', 1 if y < 26 else 2) if y < 33 else K('dirt', 2 + (1 if h2(x, y, 51) % 3 == 0 else 0) + (1 if y > 41 else 0)))
    for px in (6, 40):                                             # 뒤 기둥(밑동이 처마 깊이만큼 위에 선다)
        c.R(px, 17, 2, 16, K('wood', 1)); c.VL(px, 17, 16, K('wood', 2)); c.HL(px, 32, 2, K('soot', 0))
    c.HL(2, 33, 44, K('soot', 2))
    for (x, m) in ((6, 'pink'), (13, 'blue'), (31, 'army')):
        for i in range(7):
            for j, tt in enumerate((4, 4, 3, 2, 1)): c.P(x + i, 39 + j, K(m, tt))
        c.VL(x, 39, 5, K(m, 5)); c.P(x, 41, K(m, 2)); c.P(x + 1, 40, K(m, 3))
        c.HL(x + 1, 44, 7, K('dirt', 1))
    c.R(39, 36, 6, 7, K('burlap', 3)); c.HL(39, 36, 6, K('burlap', 5)); c.P(41, 35, K('burlap', 4)); c.P(42, 35, K('dry', 2)); c.HL(39, 42, 6, K('burlap', 1)); c.VL(39, 37, 5, K('burlap', 4))
    c.R(22, 37, 5, 6, K('burlap', 4)); c.HL(22, 37, 5, K('burlap', 5)); c.HL(22, 42, 5, K('burlap', 1)); c.VL(26, 38, 4, K('burlap', 2))
    # 지붕(y 1..16): 동서로 이어 박은 방수포 띠(주황·초록 번갈아, 띠마다 뒤 그늘·앞 빛), 살 셋이 앞뒤로 받쳐 사이가 처진다
    rows = trap_rows(0, 1, 48, 16, 4)
    bands = ((0, 3, 'army'), (3, 7, 'otarp'), (7, 11, 'army'), (11, 16, 'otarp'))
    ribs = lambda j: [rows[j][0], 16 - (3 - j // 5) // 2, 32 + (3 - j // 5) // 2, rows[j][1] - 1]
    for j, (x0, x1) in enumerate(rows):
        y = 1 + j
        b0, b1, m = next(bd for bd in bands if bd[0] <= j < bd[1])
        for x in range(x0, x1):
            rb = ribs(j); k = max(r for r in rb if r <= x); k1 = min([r for r in rb if r > x] or [x1]); u = (x - k) / max(1, k1 - k)
            sag = 1 - (2 * u - 1) ** 2                                 # 살 사이 가운데가 처진다(그늘)
            t = 4 - (1 if sag > 0.7 else 0) + (1 if u < 0.15 else 0)
            if j == b0: t -= 1                                         # 띠 뒤 이음 그늘
            if j == b1 - 1: t += 1                                     # 띠 앞 접힌 단 빛
            if j < 2: t -= 1
            if h2(x, y, 52) % 23 == 0: t -= 1
            c.P(x, y, K(m, max(1, t)))
        for r in ribs(j)[1:3]: c.P(r, y, K('wood', 4 if j % 3 else 3))
    for j in range(2, 15, 3):                                          # 이음 박음질
        for x in range(rows[j][0] + 2, rows[j][1] - 2, 3):
            if any(bd[0] == j + 1 for bd in bands): c.P(x, 1 + j, K('dry', 3))
    for j in range(5):                                                 # 덧댄 파랑 천
        for i in range(7): c.P(36 + i + j // 3, 5 + j, K('blue', 4 if j < 2 else 3))
    c.HL(37, 10, 7, K('blue', 1))
    c.HL(0, 16, 48, K('otarp', 6))
    # 앞 처마 밑 걸린 천들(길이·색 제각각, 위 접힌 단 밝게) — 천 아래로 주인공 머리 높이가 남는다
    x = 4
    for k, (w, ln, m) in enumerate(((6, 9, 'pink'), (5, 7, 'yel'), (6, 8, 'blue'), (5, 6, 'wpaint'), (6, 9, 'yel'))):
        for j in range(ln):
            for i in range(w):
                if j == ln - 1 and (i + k) % 2: continue                 # 해진 끝
                hi = len(MAT[m]) - 1
                t = (hi if j == 0 else hi - 1) - (1 if i == w - 1 else 0) - (1 if (i + j + k) % 4 == 0 and j else 0)
                c.P(x + i, 17 + j, K(m, max(0, t)))
        x += w + 3
    c.HL(0, 17, 48, K('dry', 3))                                   # 빨랫줄
    for px in (1, 45):                                             # 앞 기둥
        c.R(px, 15, 2, 32, K('wood', 2)); c.VL(px, 15, 32, K('wood', 4)); c.HL(px, 14, 2, K('wood', 5))
    c.shadow([(x, 47) for x in range(2, 46)])
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
