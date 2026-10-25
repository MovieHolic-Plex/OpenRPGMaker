"""wasteland_ruins 여러 층 폐허 판(r56): 4층 판상 아파트 husk-f · 5층 뼈대 탑 husk-g · 3층 상가 블록 husk-h.

좀비 폐허 도시 맵이 「낮은 담만 남은 교외 공터」로 읽혀(맵 VQA r10) 높은 건물 껍데기를 더한다.
같은 3/4 문법(wl_ruins 머리말): 윗면은 위에서 본 판(난간 두께 띠·지붕판·드러난 바닥판), 앞면은 그 아래 남쪽 입면. 옆면 없음.
재질은 서로 다르게 잡아 기존 콘크리트 껍데기(husk-a/b/tall)와 구분한다: 아파트 = 차가운 흰 판넬, 탑 = 민트 회색 판, 상가 = 바랜 노랑 회벽.
"""
from wl_kit import *
from wl_ruins import STRUCT, shade_rect
from wl_ruins_b import fill_poly

# 재질 램프(어두움 → 밝음) — 모두 modern_city 원천 램프 값(새 색 없음)
MAT['pan'] = [S['slate'][1], S['body'][0], S['body'][1], S['body'][2], S['body'][3], S['body'][4], S['body'][5], S['body'][6]]
MAT['mintc'] = [S['teal'][1], S['teal'][2], S['mint'][0], S['mint'][1], S['mint'][2], S['mint'][3], S['mint'][4], S['white'][0]]
MAT['plas'] = [S['bark'][1], S['bark'][3], S['bark'][4], S['amber'][1], S['amber'][2], S['amber'][3], S['amber'][4]]
for _m in ('pan', 'mintc', 'plas'):
    for _c in MAT[_m]: assert _c in ALLOWED, (_m, hex(_c))


def face(c, x, y, w, h, mat, base, seed=0, grime=3, rmin=1):
    """넓은 얼룩 앞면(저주파 ±1, 잔점 없음): 왼쪽 빛 · 오른쪽 그늘 · 아래 습기 때."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            f = vnoise(xx, yy, seed + 40, 8, 64); g = vnoise(xx, yy, seed + 41, 4, 64)
            t = base + (1 if f > 0.64 else -1 if f < 0.28 else 0)
            if g > 0.82 and t <= base: t += 1
            if i == 0: t += 1
            if i == w - 1: t -= 1
            if j >= h - grime: t = max(rmin, base - 1 if j < h - 1 else base - 2)
            c.P(xx, yy, K(mat, t))


def band_top(c, x, y, w, h, mat, seed=0, vertical=False, hi=None):
    """위에서 본 난간·벽 두께: 몸 hi-1, 앞(남)·왼 가장자리 가장 밝게, 뒤 가장자리 한 단 어둡게, 흠 몇 개."""
    hi = len(MAT[mat]) - 1 if hi is None else hi
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            n = h2(xx, yy, seed) % 17
            c.P(xx, yy, K(mat, hi - 1 - (1 if n == 0 else 0) + (1 if n == 1 else 0)))
    if vertical: c.VL(x, y, h, K(mat, hi)); c.VL(x + w - 1, y, h, K(mat, hi - 2))
    else: c.HL(x, y, w, K(mat, hi - 2)); c.HL(x, y + h - 1, w, K(mat, hi))
    for k in range((w * h) // 60):
        xx = x + h2(k, 1, seed) % max(1, w - 2); yy = y + h2(k, 2, seed) % max(1, h - 1)
        c.P(xx, yy, K(mat, hi - 3)); c.P(xx + 1, yy, K(mat, hi - 3)); c.P(xx, yy + 1, K(mat, hi))


def roof_deck(c, x, y, w, h, seed=0):
    """평지붕 윗면: 방수층(roof 갈회 몸 + 두 단 잔점) + 고였던 물 얼룩 + 덧댄 아스팔트 조각."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            n = h2(xx, yy, seed) % 13
            t = 3 + (1 if n == 0 else 0) - (1 if n in (1, 2) else 0)
            f = field(xx, yy, seed + 3, 32)
            if f > 0.72: t -= 1
            elif f < 0.22: t += 1
            c.P(xx, yy, K('roof', max(0, min(4, t))))


def slab_edge(c, x, y, w, mat, seed=0, gaps=()):
    """층 바닥판 모서리(앞으로 1화소): 밝은 윗턱 1 · 앞 두께 1 · 어두운 밑면 1 + 그 아래 벽에 지는 그늘 1."""
    hi = len(MAT[mat]) - 1
    for i in range(w):
        xx = x + i
        if any(a <= xx < b for (a, b) in gaps): continue
        c.P(xx, y, K(mat, hi if h2(xx, y, seed) % 9 else hi - 1)); c.P(xx, y + 1, K(mat, hi - 2)); c.P(xx, y + 2, K(mat, 1))
    shade_rect(c, x, y + 3, w, 1, 1)


def win(c, x, y, w, h, mat, seed=0, kind=0, sill=True):
    """빈 창: 어두운 속(위 짙게, 아래 바닥빛) · 남은 창틀(왼·위 빛) · 유리 조각 · 창턱 빛 + 그늘 · 빗물 자국."""
    hi = len(MAT[mat]) - 1
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + j, K('soot', 0 if j < h - 3 else 1))
    c.HL(x, y + h - 1, w, K('soot', 2))
    if kind == 0: c.VL(x + w // 2, y, h, K('metal', 3)); c.HL(x, y, w, K('metal', 4))          # 남은 창살
    elif kind == 1: c.line(x + 1, y + h - 2, x + w - 2, y + 2, K('metal', 3))                    # 기운 창살
    elif kind == 2: c.VL(x + w // 2, y, h // 2, K('metal', 3)); c.HL(x, y, w // 2, K('metal', 4))
    if kind != 3: c.P(x + 1, y + 1, K('glass', 5)); c.P(x + 2, y + 1, K('glass', 3)); c.P(x + 1, y + 2, K('glass', 3))
    if kind == 0: c.P(x + w - 2, y + h - 2, K('glass', 4))
    for k in range(3): c.P(x + w - 3 - k, y + h - 4 + k, K('soot', 2))   # 속 바닥에 비친 빛(대각 3화소)
    if sill:
        c.HL(x - 1, y + h, w + 2, K(mat, hi)); c.HL(x, y + h + 1, w, K(mat, 1))
        for (sx, ln) in ((x, 2 + seed % 4), (x + w - 1, 1 + (seed * 3) % 4)):
            for j in range(2, 2 + min(ln, 2)):
                if c.get(sx, y + h + j) in MAT[mat]: c.P(sx, y + h + j, K(mat, 3))


def drips(c, x, y, ln, mat='brust'):
    for j in range(ln):
        if c.has(x, y + j): c.P(x, y + j, K(mat, 4 if j < 2 else 5))


def plume(c, x, y, w, ln, mats, seed=0):
    """창 위 그을음: 면 재질을 1~3단 어둡게 민 연기 자국(점박이 없이 덩어리로), 위로 갈수록 좁게 옅게."""
    for j in range(1, ln):
        half = w / 2 + 0.5 - j * 0.25
        for i in range(-2, w + 2):
            dxc = abs(i - (w - 1) / 2)
            if dxc > half: continue
            col = c.get(x + i, y - j)
            for m in mats:
                r = MAT[m]
                if col in r:
                    d = 3 if j < 3 and dxc < half - 1 else 2 if j < ln * 0.6 else 1
                    c.P(x + i, y - j, r[max(1, r.index(col) - d)]); break


def leaves(c, x, y0, y1, seed=0, spread=2):
    """늘어진 덩굴(위 y0 에서 아래 y1 으로, 아래로 갈수록 성기게): 줄기 + 잎 덩이 5단."""
    G = [K('plant', 1), K('plant', 3), K('plant', 5), K('plant', 7), K('plant', 8)]
    for y in range(y0, y1):
        u = (y - y0) / max(1, y1 - y0)
        cx = x + int(round(((((y // 5) + seed) % 4) - 1.5) / 1.5))
        c.P(cx, y, G[0] if y % 3 else G[1])
        half = spread if u < 0.4 else max(1, spread - 1)
        for i in range(-half, half + 1):
            if h2(cx + i, y, seed) % (3 if u < 0.5 else 5) == 0:
                xx = cx + i
                c.P(xx, y, G[2]); c.P(xx - 1, y, G[3]) if h2(xx, y, seed + 1) % 2 else None
                c.P(xx, y - 1, G[3]); c.P(xx + 1, y, G[1])


def roof_box(c, x, y, w, top, front, mat, seed=0, door=False):
    """지붕 위 작은 3/4 상자(계단실·실외기): 윗면(밝게) + 앞면 + 바닥 그림자 한 줄."""
    hi = len(MAT[mat]) - 1
    c.R(x, y, w, top, K(mat, hi - 1)); c.HL(x, y, w, K(mat, hi - 2)); c.HL(x, y + top - 1, w, K(mat, hi)); c.VL(x, y, top, K(mat, hi))
    face(c, x, y + top, w, front, mat, 3, seed=seed, grime=1, rmin=1)
    c.HL(x, y + top, w, K(mat, 1))
    if door:
        dx = x + w // 2 - 3
        c.R(dx, y + top + 2, 6, front - 2, K('soot', 0)); c.VL(dx, y + top + 2, front - 2, K('soot', 1)); c.HL(dx, y + top + front - 1, 6, K('soot', 2))
    c.HL(x + 1, y + top + front, w, K('roof', 0))


# ------------------------------------------------------------------ husk-f: 4층 판상 아파트, 동쪽 위 모서리 찢김 + 지붕 내려앉음
@piece('husk-f', '모서리 찢긴 4층 아파트', 5, 7, STRUCT,
       en='abandoned four-storey apartment block seen from above: flat roof with a parapet, a stairwell head box and a caved-in hole at the north-east corner; '
          'tall pale panel front with four rows of dark empty windows and small balconies, the top-floor east corner torn open showing the room floor inside, rubble heap below',
       group='ruins', tags=['폐허', '건물', '고층', '아파트'], desc='4층 판상 아파트. 평지붕 동쪽 귀가 내려앉아 구멍이 났고, 꼭대기 층 동쪽 모서리 벽이 찢겨 방 바닥이 드러났다. 빈 창 네 줄과 작은 발코니.',
       solid=[(x, y) for y in (5, 6) for x in range(5)], door=(1, 6))
def _husk_f(c):
    W, H, t = 80, 112, 4
    ty = 46                                                    # 앞면 윗줄(앞면 66행 = 4층 × 16 + 2)
    # --- 윗면: 평지붕 + 난간 + 계단실 머리 + 동북 귀 내려앉은 구멍
    roof_deck(c, t, 1 + t, W - 2 * t, ty - 2 * t - 1, seed=11)
    shade_rect(c, t, 1 + t, W - 2 * t, 2, 1)                   # 북쪽 난간 그늘
    shade_rect(c, t, 1 + t, 2, ty - 2 * t - 1, 1)              # 서쪽 난간 그늘
    for k in range(4):                                         # 덧댄 방수 천
        px, py = 8 + h2(k, 1, 12) % 30, 10 + h2(k, 2, 12) % 22
        for j in range(3):
            for i in range(4 + (j + k) % 3): c.P(px + i - (j % 2), py + j, K('asph', 2 + (1 if h2(px + i, py + j, 13) % 4 == 0 else 0)))
    roof_box(c, 9, 6, 18, 8, 10, 'pan', seed=14, door=True)    # 계단실 머리
    rebar(c, 26, 7, 3, 1)
    for (x, y) in ((34, 30), (40, 30), (34, 34)):              # 지붕 배기구(작은 상자)
        c.R(x, y, 4, 2, K('metal', 6)); c.R(x, y + 2, 4, 2, K('metal', 3)); c.HL(x, y + 4, 5, K('roof', 0))
    band_top(c, 0, 1, W, t, 'pan', seed=15)
    band_top(c, 0, 1, t, ty, 'pan', seed=16, vertical=True)
    band_top(c, W - t, 1, t, ty, 'pan', seed=17, vertical=True)
    band_top(c, 0, ty - t, W, t, 'pan', seed=18)
    # --- 앞면: 판넬 4층(층 16행) + 판 이음 + 창 4열 + 발코니
    face(c, 0, ty, W, H - ty, 'pan', 3, seed=19, grime=4)
    for x in (20, 40, 60):                                      # 판넬 세로 이음
        for y in range(ty + 1, H - 4):
            if h2(x, y // 4, 20) % 5: c.P(x, y, K('pan', 2))
    floors = [ty, ty + 16, ty + 32, ty + 48]                    # 층 윗줄
    for fy in floors[1:]: slab_edge(c, 0, fy - 1, W, 'pan', seed=fy)
    bays = [5, 25, 45, 65]                                      # 창 x
    kinds = [[3, 0, 1, 9], [2, 3, 0, 1], [0, 1, 3, 2], [1, 9, 2, 0]]
    for fi, fy in enumerate(floors):
        for bi, bx in enumerate(bays):
            k = kinds[fi][bi]
            if fi == 3 and bi == 1: continue                    # 1층 출입구 자리
            win(c, bx, fy + 4, 10, 8, 'pan', seed=fi * 4 + bi, kind=(k if k < 9 else 3))
    for (bx, fy) in ((25, floors[0]), (45, floors[1]), (25, floors[2])):                 # 발코니: 윗면 판 2 + 앞 난간 철살 4
        x0 = bx - 3
        c.HL(x0, fy + 9, 16, K('pan', 7)); c.HL(x0, fy + 10, 16, K('pan', 6))
        c.HL(x0, fy + 11, 16, K('metal', 5))
        for i in range(16):
            bar = i % 3 == 0 and i != (3 + bx) % 15 and not (i == 9 and fy == floors[1])
            for j in range(12, 15): c.P(x0 + i + (1 if bar and j == 12 and i == 12 and fy == floors[2] else 0), fy + j, K('metal', 3) if bar else K('soot', 1) if j < 14 else K('soot', 2))
        c.HL(x0, fy + 15, 16, K('pan', 1))
        drips(c, x0 + 2, fy + 16, 5); drips(c, x0 + 13, fy + 16, 3)
    c.line(23, floors[2] + 15, 31, floors[2] + 12, K('metal', 4))                      # 떨어져 기운 난간 토막
    for (bx, fy) in ((5, floors[1]), (65, floors[2]), (45, floors[3])):
        plume(c, bx, fy + 4, 10, 9, ('pan',), seed=bx + fy)
    # 1층 출입구 + 차양판(3/4: 윗면 3 + 앞 두께 2)
    dx, dw = 26, 10
    c.R(dx - 3, floors[3] + 2, dw + 6, 3, K('pan', 6)); c.HL(dx - 3, floors[3] + 2, dw + 6, K('pan', 5)); c.HL(dx - 3, floors[3] + 4, dw + 6, K('pan', 7))
    c.R(dx - 3, floors[3] + 5, dw + 6, 2, K('pan', 2)); c.HL(dx - 3, floors[3] + 6, dw + 6, K('pan', 1))
    for j in range(H - (floors[3] + 7)):
        for i in range(dw): c.P(dx + i, floors[3] + 7 + j, K('soot', 0 if j < 9 else 1 if j < 12 else 2))
    c.VL(dx, floors[3] + 7, H - floors[3] - 7, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    c.line(dx + 6, H - 2, dx + 9, floors[3] + 9, K('metal', 4)); c.line(dx + 7, H - 2, dx + 10, floors[3] + 9, K('metal', 2))   # 기운 문짝
    # --- 무너진 동쪽 모서리: 지붕 동쪽 귀와 꼭대기 층 앞벽이 함께 떨어져 속이 검게 비었다. 그 안에 부러진 4층 바닥판이 턱으로 남고,
    #     앞벽 윗변은 층 줄을 따라 세 계단으로 깨졌다(계단마다 밝은 윗면 2 · 어두운 깨진 턱 1).
    def ex(y): return (50 if y < 9 else 53 if y < 16 else 55 if y < 24 else 58 if y < 34 else 60) + (h2(y // 2, 5, 26) % 2)   # 남은 지붕판 동쪽 끝(계단 + 들쭉날쭉)
    def yt(x):                                                  # 앞벽 새 윗줄
        if x < 58: return ty - t
        return ty + (6 if x < 65 else 11 if x < 72 else 15) + (h2(x, 7, 21) % 2) + (1 if h2(x, 8, 21) % 5 == 0 else 0)
    for x in range(48, W):
        for y in range(4, yt(x)):
            if x < ex(y): continue
            if x < ex(y) + 2: c.P(x, y, K('soot', 0)); continue                      # 지붕판 끝이 지는 그림자
            if y < 38:                                          # 북벽 안쪽 면이 여러 층 아래로 보임: 층 판 토막(빛 1 · 어둠 1), 아래로 갈수록 어둡게
                k = (y - 4) % 8; band = (y - 4) // 8
                seg = (ex(y) + 2 + (0, 9, 3, 12, 6)[band % 5], ex(y) + 2 + (0, 9, 3, 12, 6)[band % 5] + 6 + band % 3)
                if not (seg[0] <= x < seg[1]) and k in (6, 7): k = 3                # 바닥판 토막은 짧게, 층마다 엇갈려
                if y >= 21:
                    col = K('pan', 2) if k == 6 and h2(x, y, 27) % 4 else K('soot', 0) if k == 7 else K('soot', 2) if h2(x // 2, y, 34) % 3 else K('soot', 1)
                    if 62 <= x <= 64 and 23 <= y <= 27: col = K('soot', 0)                 # 아래층 문 구멍
                    c.P(x, y, col); continue
                if k == 6: col = (K('pan', 3) if y < 13 else K('pan', 2)) if h2(x, y, 27) % 5 else K('pan', 1)
                elif k == 7: col = K('soot', 0)
                else: col = K('pan', 1) if y < 13 and h2(x // 2, y, 33) % 4 else K('soot', 2) if h2(x // 2, y, 33) % 3 else K('soot', 1)
                c.P(x, y, col); continue
            c.P(x, y, K('soot', 0 if y < ty else 1))                                    # 가장 깊은 속(잔해 위 몇 화소만)
    for x in range(61, W - 2):                                  # 깊은 속 아래층 바닥판(밝은 윗면 3 · 깨진 턱 · 두께) + 잔해
        y0 = 39 + (1 if x > 70 else 0) + (h2(x // 3, 9, 37) % 2)
        if x < 63 and h2(x, 1, 37) % 2: continue
        c.P(x, y0, K('pan', 4)); c.P(x, y0 + 1, K('pan', 5)); c.P(x, y0 + 2, K('pan', 6)); c.P(x, y0 + 3, K('pan', 0)); c.P(x, y0 + 4, K('pan', 2))
    for (x, y) in ((64, 37), (71, 38)): chunk5(c, x, y, 4, 3, 'pan', seed=x)
    mound(c, 70, ty + 9, 10, 8, seed=34, mats=('conc', 'conc', 'brick'))      # 속 바닥에 쌓인 잔해(무너진 층들)
    for x in range(56, 74):                                     # 부러진 4층 바닥판 턱(위에서 본 판 4 · 깨진 앞턱 1 · 두께 2)
        e = 72 - (h2(x, 3, 28) % 3) if x > 69 else 74
        if x > e: continue
        y0 = 24 + (h2(x // 2, 4, 28) % 2)
        for y in range(y0, y0 + 4): c.P(x, y, K('pan', 6 if y == y0 + 3 else 5) if h2(x, y, 29) % 6 else K('pan', 4))
        c.P(x, y0 - 1, K('pan', 3)); c.P(x, y0 + 4, K('pan', 0)); c.P(x, y0 + 5, K('pan', 2)); c.P(x, y0 + 6, K('pan', 1))
    for (x, y, l, d) in ((72, 26, 4, 2), (73, 28, 3, 1), (57, 25, 3, -1)): rebar(c, x, y, l, d)
    for x in range(58, 70):                                     # 부러진 3층 바닥판 턱(더 아래, 서쪽에 붙어 짧게)
        if x < ex(34) + 1 or x > 66 + (h2(x, 6, 35) % 2) * 2: continue
        y0 = 34 + (1 if x > 64 else 0)
        c.P(x, y0, K('pan', 5)); c.P(x, y0 + 1, K('pan', 6)); c.P(x, y0 + 2, K('pan', 0)); c.P(x, y0 + 3, K('pan', 1)); c.P(x, y0 + 4, K('soot', 2))
    rebar(c, 68, y0 + 1, 3, 2)
    c.rows(61, 22, ['abbbb', 'bcccc', '_dddd'], {'a': K('pan', 6), 'b': K('pan', 5), 'c': K('pan', 2), 'd': K('pan', 1)})   # 떨어진 판 조각(모난)
    c.rows(66, 26, ['abbb', 'bccc'], {'a': K('brick', 5), 'b': K('brick', 4), 'c': K('brick', 2)})
    for y in range(4, ty - t):                                  # 부러진 지붕판 끝: 빛 턱 + 깨진 면 그늘 + 철근 무더기 둘
        e = ex(y)
        c.P(e - 1, y, K('pan', 6)); c.P(e - 2, y, K('pan', 4)) if y > 4 else None
    for (x, y) in ((51, 8), (52, 10), (56, 17), (57, 19), (58, 35)): rebar(c, ex(y), y, 3, 2)
    for x in range(58, W):                                      # 앞벽 깨진 계단 윗변: 밝은 윗면 2 · 어두운 턱 1
        y = yt(x)
        c.P(x, y - 2, K('pan', 7)); c.P(x, y - 1, K('pan', 6)); c.P(x, y, K('pan', 0))
    for (x, y, l, d) in ((60, yt(60) - 2, 3, -1), (61, yt(61) - 2, 4, 1), (69, yt(69) - 2, 3, 1), (76, yt(76) - 2, 4, -1), (77, yt(77) - 2, 3, 2)):
        rebar(c, x, y, l, d)
    def cut(x):                                                 # 무너진 북동 귀 윗변: 북벽이 계단처럼 내려앉음(이 줄 위는 비움)
        if x < 56: return 0
        return (2 if x < 60 else 4 if x < 67 else 3 if x < 71 else 5) + (h2(x, 2, 38) % 2)
    for x in range(56, W):
        cy = cut(x)
        c.clear(x, 0, 1, cy + 1)
        c.P(x, cy + 1, K('pan', 7)); c.P(x, cy + 2, K('pan', 5)); c.P(x, cy + 3, K('pan', 2))   # 깨진 벽 윗면 토막(빛) + 단면 그늘
        if x % 5 == 1: rebar(c, x, cy + 1, 2 + x % 2, 1 if x % 2 else -1)
    def ecut(y):                                                # 동쪽 벽 무너짐: 위에서 y≈30 까지 세 계단으로 벽 두께가 사라짐
        return W - (4 if y < 5 else 3 if y < 14 else 2 if y < 24 else 1 if y < 31 else 0) - (h2(y // 2, 3, 39) % 2 if y < 31 else 0)
    for y in range(0, 32):
        for x in range(ecut(y), W): c.clear(x, y)
        if ecut(y) < W: c.P(ecut(y) - 1, y, K('pan', 5) if y % 3 else K('pan', 7))
    for (x, y) in ((W - 4, 6), (W - 3, 15), (W - 2, 25)): rebar(c, x, y, 3, 2)
    wx, wy = 65, floors[1] + 4                                  # 2층… 위에서 둘째 층 동쪽 창: 틀 떨어지고 깨짐 + 창턱 잔해
    for j in range(-1, 10):
        for i in range(-1, 11):
            if (i in (-1, 10) or j == -1) and h2(i, j, 36) % 2: c.P(wx + i, wy + j, K('soot', 0))
    for i in range(10): c.P(wx + i, wy, K('soot', 0))
    c.P(wx + 3, wy + 8, K('conc', 6)); c.P(wx + 4, wy + 8, K('conc', 4)); c.P(wx + 7, wy + 8, K('brick', 4))
    crack(c, [(71, yt(71) + 2), (73, yt(71) + 6), (72, wy - 2)], K('pan', 0), K('pan', 5))
    crack(c, [(68, wy + 11), (70, wy + 15), (69, floors[2] + 1)], K('pan', 0), K('pan', 5))
    # 3층 동쪽 창: 크게 터진 구멍(들쭉날쭉 가장자리 + 잔해 창턱)
    bx, by = 63, floors[2] + 2
    for j in range(13):
        l = (h2(j, 1, 31) % 3); r = (h2(j, 2, 31) % 3)
        for i in range(l, 14 - r): c.P(bx + i, by + j, K('soot', 0 if j < 9 else 1))
    c.rows(bx + 2, by + 12, ['abbbab', 'bccbcc'], {'a': K('conc', 6), 'b': K('conc', 4), 'c': K('conc', 2)})
    rebar(c, bx + 10, by + 3, 3, 1)
    for (x, y) in ((14, floors[0] + 13), (55, floors[1] + 3), (16, floors[2] + 13), (57, floors[3] + 3)):   # 벽 얼룩(빗물 때) 층마다 하나
        for j in range(6):
            for i in range(2):
                col = c.get(x + i, y + j)
                if col in MAT['pan'] and h2(x + i, y + j, 32) % 4: c.P(x + i, y + j, K('pan', max(1, MAT['pan'].index(col) - 1)))
    mound(c, 70, H - 3, 12, 6, seed=24, mats=('conc', 'conc', 'brick'))
    for (x, y) in ((60, H - 7), (73, H - 8)): chunk5(c, x, y, 5, 4, 'pan', seed=x)
    leaves(c, 3, ty + 1, ty + 40, seed=5, spread=2)
    leaves(c, 41, floors[1] + 14, floors[1] + 30, seed=2, spread=1)
    grit(c, 0, ty, W, H - ty, mat='pan', seed=25, rate=23, cracks=3)
    c.clear(0, 0, 1, H); c.clear(W - 1, 0, 1, H)                # 양옆 윤곽 자리
    c.outline()


# ------------------------------------------------------------------ husk-g: 5층 좁은 탑, 위 두 층은 벽이 떨어져 뼈대만
@piece('husk-g', '뼈대만 남은 5층 탑', 4, 8, STRUCT,
       en='narrow five-storey ruined office tower seen from above: the roof slab half gone, the remaining slab and the exposed top floor seen as planes with column stubs and bent rebar; '
          'the top two storeys stripped to a bare concrete frame of columns and floor slab edges with dark gutted floors, the three lower storeys keep long strip windows with broken glass',
       group='ruins', tags=['폐허', '건물', '고층', '탑'], desc='5층 좁은 사무 탑. 지붕판이 반쯤 사라져 위층 바닥과 기둥 머리·철근이 보이고, 위 두 층은 벽이 떨어져 기둥과 바닥판 뼈대만, 아래 세 층은 깨진 띠창.',
       solid=[(x, y) for y in (6, 7) for x in range(4)], door=(1, 7))
def _husk_g(c):
    W, H, t = 64, 128, 3
    ty = 44                                                    # 앞면 윗줄(앞면 84행 = 5층 × 16 + 4)
    cols = [(1, 6), (29, 35), (57, 63)]                        # 기둥 x 범위
    # --- 윗면: 벽 윗면 테(북·서·동·남 띠, 군데군데 깨짐) 안에 서쪽 = 남은 지붕판(갈회 방수층, 깨진 구멍) · 동쪽 = 지붕이 없어 드러난 5층 바닥 + 기둥 머리
    def sb(y):                                                  # 남은 지붕판 동쪽 끝(부러진 선)
        return 30 + (y // 3) % 3 + (h2(y // 2, 3, 34) % 4) - (6 if 14 < y < 24 else 0)
    for y in range(1, ty):                                      # 5층 바닥(지붕 없는 쪽): 고른 판 + 성긴 줄눈 + 북벽 그늘
        for x in range(0, W):
            tt = 3 if field(x, y, 30, 32) < 0.62 else 2
            if (x % 10 == 4 or y % 10 == 6) and h2(x // 3, y // 3, 32) % 3: tt -= 1
            c.P(x, y, K('mintc', max(1, tt)))
    for x in range(t, W - t):                                   # 북벽 안쪽 면(남향 그늘 4행)
        for j, tt in enumerate((2, 2, 1, 1)): c.P(x, 1 + t + j, K('mintc', tt))
    for (cx, by, rx, ry) in ((47, 34, 6, 3), (54, 15, 4, 2)):   # 잔해 두 무더기(덩이 모아)
        mound(c, cx, by, rx, ry, seed=cx, mats=('conc', 'conc', 'brick'))
    tuft(c, 40, 37, 'grass'); tuft(c, 58, 33, 'dry')
    roof_deck(c, t, 1 + t, 34, ty - 2 * t - 1, seed=35)           # 남은 지붕판(서쪽): 방수층
    shade_rect(c, t, 1 + t, 34, 2, 1); shade_rect(c, t, 1 + t, 2, ty - 2 * t - 1, 1)
    for y in range(1, ty - t):                                  # 지붕판 동쪽 끝: 끝 너머는 5층 바닥, 끝은 빛 턱 + 바닥에 지는 그림자 2
        e = sb(y)
        if y > t:
            for x in range(e, t + 34): c.P(x, y, K('mintc', 3 if field(x, y, 30, 32) < 0.62 else 2))
        if y > t:
            c.P(e - 1, y, K('roof', 4)); c.P(e, y, K('mintc', 0)); c.P(e + 1, y, K('mintc', 1))
            if y % 5 == 2: rebar(c, e + 1, y + 1, 3, 2)
    for (pts, rb) in (([(6, 10), (10, 8), (14, 9), (13, 12), (9, 14), (5, 13)], (8, 13)),
                      ([(15, 24), (19, 22), (22, 25), (21, 29), (16, 30), (14, 27)], (18, 29)),
                      ([(23, 13), (26, 12), (27, 15), (24, 17)], None)):          # 깨진 구멍: 북 테 = 빛 턱 + 판 두께, 남쪽 = 어둠으로 떨어짐
        fill_poly(c, pts, lambda x, y: K('soot', 0))
        ys = [q[1] for q in pts]; y0 = min(ys)
        for x in range(min(q[0] for q in pts), max(q[0] for q in pts) + 1):
            col = [y for y in range(y0 - 1, max(ys) + 1) if c.get(x, y) == K('soot', 0)]
            if not col: continue
            c.P(x, col[0] - 1, K('roof', 4)); c.P(x, col[0], K('mintc', 2))
            if len(col) > 2: c.P(x, col[0] + 1, K('mintc', 1))
            c.P(x, col[-1], K('soot', 1))
        if rb: c.line(rb[0] - 3, rb[1] - 3, rb[0] + 2, rb[1] - 1, K('rust', 3))
    for (x0, x1) in cols[1:]:                                   # 지붕 없는 쪽 기둥 머리(윗면 밝은 네모) + 솟은 철근
        for (yy, hh) in ((7, 5), (22, 5)):
            c.R(x0, yy, x1 - x0, hh - 1, K('mintc', 6)); c.HL(x0, yy, x1 - x0, K('mintc', 5)); c.HL(x0, yy + hh - 2, x1 - x0, K('mintc', 7))
            c.R(x0, yy + hh - 1, x1 - x0, 3, K('mintc', 3)); c.HL(x0, yy + hh + 1, x1 - x0, K('mintc', 1))
            rebar(c, x0 + 1, yy, 3, -1); rebar(c, x1 - 2, yy, 4, 1)
    band_top(c, 0, 1, W, t, 'mintc', seed=36)                     # 벽 윗면 테
    band_top(c, 0, 1, t, ty, 'mintc', seed=37, vertical=True)
    band_top(c, W - t, 1, t, ty, 'mintc', seed=38, vertical=True)
    band_top(c, 0, ty - 4, W, 4, 'mintc', seed=39)
    for (x, d) in ((12, 1), (13, 2), (14, 2), (44, 2), (45, 3), (46, 3), (47, 2)): c.clear(x, 1, 1, d); c.P(x, 1 + d, K('mintc', 7))
    for y in range(14, 22): c.clear(W - 1, y); c.P(W - 2, y, K('mintc', 4))
    # --- 앞면: 5층(16행), 위 두 층 = 기둥+바닥판 뼈대, 아래 세 층 = 판 + 띠창
    floors = [ty + 16 * k for k in range(5)]
    for fi, fy in enumerate(floors):
        if fi < 2:                                              # 뼈대 층: 속(어둠 · 바닥판 윗면 3행 · 뒤 기둥 그림자)
            for y in range(fy, fy + 16):
                for x in range(W):
                    j = y - fy
                    if j >= 12: c.P(x, y, K('mintc', 4 if j < 15 else 6) if h2(x, y, 38) % 7 else K('mintc', 3))
                    else: c.P(x, y, K('soot', 0 if j < 7 else 1) if h2(x // 6, j, 39 + fi) % 6 else K('soot', 2))
            for x in range(8, W - 8, 11):                       # 속 뒤 기둥(더 어둡게)
                c.R(x, fy + 1, 3, 11, K('teal', 1)); c.VL(x, fy + 1, 11, K('teal', 2))
            rubble_scatter(c, 7, fy + 12, W - 14, 3, 4, seed=40 + fi, mats=('conc', 'brick'), glass=False)
        else:
            face(c, 0, fy, W, 16, 'mintc', 4, seed=41 + fi, grime=0)
            gy = fy + 4                                         # 띠창(가로 긴 유리, 깨진 칸 검게)
            for x in range(3, W - 3):
                if any(a <= x < b for (a, b) in cols): continue
                for j in range(7):
                    br = h2(x // 7, fi, 42) % 3 == 0
                    c.P(x, gy + j, K('soot', 0 if j < 5 else 1) if br else K('teal', 1 if j < 2 else 2 if j < 5 else 1))
                if (x - 3) % 7 == 0: c.VL(x, gy, 7, K('metal', 4))          # 창살 기둥
                elif not h2(x // 7, fi, 42) % 3 == 0 and (x - 3) % 14 == 2: c.P(x, gy + 1, K('teal', 4))
            c.HL(3, gy - 1, W - 6, K('mintc', 2)); c.HL(2, gy + 7, W - 4, K('mintc', 7)); c.HL(3, gy + 8, W - 6, K('mintc', 1))
        for (x0, x1) in cols:                                   # 기둥 앞면(왼 빛 · 몸 · 오른 그늘)
            for y in range(fy, fy + 16):
                for x in range(x0, x1):
                    c.P(x, y, K('mintc', 6 if x == x0 else 3 if x == x1 - 1 else 5 - (1 if h2(x, y, 43) % 7 == 0 else 0)))
        slab_edge(c, 0, fy, W, 'mintc', seed=fy)
    # 뼈대 층 손상: 동쪽 4층 바닥판 끝이 부러져 떨어짐(들쭉날쭉 끝 + 늘어진 철근), 서쪽 뼈대 칸에 남은 벽 조각
    for x in range(50, 57):
        d = 3 if x > 51 else 1 + (x - 50)
        c.clear(x, floors[1], 1, d)
        for y in range(floors[1], floors[1] + d):
            c.P(x, y, K('soot', 0))
        c.P(x, floors[1] + d, K('mintc', 2))
    rebar(c, 51, floors[1] + 4, 4, -1); c.line(54, floors[1] + 1, 55, floors[1] + 7, K('rust', 3)); c.P(55, floors[1] + 7, K('rust', 5))
    face(c, 7, floors[1] + 3, 14, 9, 'mintc', 4, seed=44, grime=0)
    for (x, d) in ((7, 2), (8, 1), (19, 3), (20, 4)): c.clear(x, floors[1] + 3, 1, d)
    c.HL(9, floors[1] + 3, 10, K('mintc', 7))
    win(c, 10, floors[1] + 5, 7, 5, 'mintc', seed=3, kind=3, sill=False)
    for x in range(36, 46):                                     # 5층 바닥판 앞 턱 깨진 홈
        if 38 <= x <= 42: c.clear(x, floors[0]); c.P(x, floors[0] + 1, K('mintc', 6))
    c.line(40, floors[0] + 2, 44, floors[0] + 12, K('rust', 3))                          # 늘어진 철근
    # 1층 출입구(깨진 유리문 칸) + 아래 때
    gy = floors[4]
    for x in range(9, 26):
        for y in range(gy + 3, H - 1):
            c.P(x, y, K('soot', 0 if y < H - 5 else 1))
    for x in (9, 17, 25): c.VL(x, gy + 3, H - gy - 4, K('metal', 4))
    c.HL(9, gy + 3, 17, K('metal', 5)); c.P(11, gy + 5, K('glass', 5)); c.P(12, gy + 6, K('glass', 3)); c.P(23, H - 4, K('glass', 4))
    c.HL(8, H - 1, 19, K('dirt', 2))
    for y in range(floors[2], H - 1):                           # 기둥 아래 녹물·때
        if h2(33, y, 45) % 3 == 0 and c.get(33, y) in MAT['mintc']: c.P(33, y, K('mintc', 2))
    for x in range(W):
        for y in range(H - 4, H):
            col = c.get(x, y)
            if col in MAT['mintc']: c.P(x, y, K('mintc', max(1, MAT['mintc'].index(col) - 2)))
    for (x, y) in ((7, floors[3] + 13), (50, floors[2] + 13), (40, floors[4] + 13)): drips(c, x, y, 6)
    leaves(c, 58, floors[2] + 2, H - 2, seed=4, spread=2)
    mound(c, 48, H - 1, 9, 4, seed=46)
    grit(c, 0, floors[2], W, H - floors[2], mat='mintc', seed=47, rate=25, cracks=2)
    c.clear(0, 0, 1, H); c.clear(W - 1, 0, 1, H)
    c.outline()


# ------------------------------------------------------------------ husk-h: 넓은 3층 상가 블록, 아래 가게 셋 + 위층 동쪽 내려앉음
@piece('husk-h', '위층 무너진 3층 상가', 6, 6, STRUCT,
       en='wide three-storey ruined shop block seen from above: flat roof with a parapet and air-con boxes, the east half of the roof fallen in so a tilted roof slab lies inside the open top floor; '
          'faded yellow plaster upper floors with dark empty windows, the top floor front broken down at the east, and a row of three ground-floor shops with a half-open rolling shutter, a closed dented shutter and a smashed display window under a bare awning frame',
       group='ruins', tags=['폐허', '건물', '상가', '고층'], desc='3층 상가 블록. 지붕 동쪽 반이 내려앉아 기운 지붕판이 3층 속에 걸렸고, 3층 앞벽 동쪽이 무너졌다. 아래는 가게 셋(반쯤 올린 셔터·닫힌 셔터·깨진 진열창).',
       solid=[(x, y) for y in (4, 5) for x in range(6)], door=(1, 5))
def _husk_h(c):
    W, H, t = 96, 96, 4
    ty = 36                                                    # 앞면 윗줄(앞면 60행 = 3층 16 + 2층 16 + 가게 24 + 4)
    # --- 윗면: 서쪽 평지붕(방수층 + 실외기) · 동쪽 내려앉은 지붕(3층 속이 보이고 기운 판이 걸림)
    roof_deck(c, t, 1 + t, W - 2 * t, ty - 2 * t - 1, seed=51)
    shade_rect(c, t, 1 + t, W - 2 * t, 2, 1)
    X1 = 52                                                    # 여기서부터 동쪽 지붕이 내려앉음
    def edge(y): return X1 + (h2(y // 3, 2, 52) % 4) - (3 if 12 < y < 20 else 0)
    for y in range(1 + t, ty - t):
        e = edge(y)
        for x in range(e, W - t):                              # 3층 속: 위 = 북벽 안쪽(그늘), 아래 = 바닥 윗면(잔해·먼지)
            j = y - (1 + t)
            if j < 7: c.P(x, y, K('plas', 1 if j < 5 else 0))
            else:
                n = h2(x, y, 54) % 7
                c.P(x, y, K('dirt', 3 + (1 if n == 0 else 0) - (1 if n == 1 else 0)) if field(x, y, 55, 32) > 0.45 else K('roof', 2 + (n == 2)))
        c.P(e, y, K('roof', 4)); c.P(e - 1, y, K('roof', 3))   # 부러진 지붕 끝(빛 턱)
        if y % 5 == 2: rebar(c, e, y + 1, 3, 2)
    fill_poly(c, [(58, 8), (82, 12), (80, 18), (60, 27)], lambda x, y: K('roof', 3 if h2(x, y, 56) % 6 else 2))   # 북벽에 기대 기운 지붕판
    for k in (1, 2): c.line(60, 27 + k, 80, 18 + k, K('plas', 1 if k == 1 else 0))
    c.line(58, 8, 82, 12, K('roof', 4))
    rubble_scatter(c, 56, 26, 34, 5, 6, seed=57, mats=('conc', 'brick'), shade=K('dirt', 1))
    for (x, y, l, d) in ((70, 13, 4, 1), (78, 15, 3, 2), (63, 20, 4, -1)): rebar(c, x, y, l, d)
    for (x, y) in ((10, 9), (24, 9), (10, 21)):                # 실외기(작은 3/4 상자)
        roof_box(c, x, y, 9, 4, 5, 'pan', seed=x)
        if x == 10 and y == 9: c.HL(x + 2, y + 6, 5, K('metal', 2)); c.HL(x + 2, y + 7, 5, K('metal', 1))
        elif x == 24: c.P(x + 3, y + 6, K('soot', 1)); c.P(x + 5, y + 6, K('soot', 1)); c.P(x + 4, y + 7, K('soot', 1))
    c.R(38, 8, 2, 20, K('metal', 3)); c.VL(38, 8, 20, K('metal', 5))                    # 지붕 위 배관
    band_top(c, 0, 1, W, t, 'plas', seed=58)
    band_top(c, 0, 1, t, ty, 'plas', seed=59, vertical=True)
    band_top(c, W - t, 1, t, ty, 'plas', seed=60, vertical=True)
    band_top(c, 0, ty - t, W, t, 'plas', seed=61)
    for (x, d) in ((64, 1), (65, 2), (66, 2), (80, 1), (81, 2)): c.clear(x, 1, 1, d); c.P(x, 1 + d, K('plas', 6))
    for (gx, gy_, gw, gh) in ((0, 1, W, t), (0, 1, t, ty), (W - t, 1, t, ty), (0, ty - t, W, t)): grit(c, gx, gy_, gw, gh, mat='plas', seed=72, rate=11)
    # --- 앞면: 3층·2층 회벽(층 16) + 층 띠 + 가게 층(24)
    face(c, 0, ty, W, 32, 'plas', 5, seed=62, grime=0, rmin=1)
    for y in range(ty, ty + 32):                                # 회벽 결: 흙손 자국 얼룩(2단 어둡게)과 밝은 덧칠 조각, 낱점 아닌 2~3화소 덩이
        for x in range(W):
            col = c.get(x, y)
            if col not in MAT['plas']: continue
            i = MAT['plas'].index(col); v = vnoise(x, y, 71, 4, 64)
            if v > 0.86: c.P(x, y, K('plas', i - 2))
            elif v > 0.78: c.P(x, y, K('plas', i - 1))
            elif v < 0.1: c.P(x, y, K('plas', 6))
    for fy in (ty + 16,): slab_edge(c, 0, fy - 1, W, 'plas', seed=fy)
    wins = [(6, 0), (22, 0), (38, 0), (6, 1), (22, 1), (38, 1), (54, 1), (70, 1), (86 - 4, 1)]
    for k, (wx, fl) in enumerate(wins):
        win(c, wx, ty + 16 * fl + 4, 8, 8, 'plas', seed=k, kind=k % 4)
    for (wx, fl) in ((22, 0), (54, 1)): plume(c, wx, ty + 16 * fl + 4, 8, 10, ('plas',), seed=wx)
    # 3층 동쪽 앞벽 무너짐(들쭉날쭉 아래로), 그 자리에 방 바닥 윗면이 보임
    def br(x):
        if x < 50: return None
        return ty + (5 if x < 62 else 9 if x < 76 else 12 if x < 88 else 7) + (h2(x, 9, 63) % 2) + (1 if x in (61, 75, 87) else 0)
    for x in range(50, W):
        yb = br(x)
        for y in range(ty - t, yb):
            c.clear(x, y)
            c.P(x, y, (K('soot', 0) if x % 18 in (4, 5, 6, 7, 8) and y > ty - t + 1 else K('plas', 1)) if y < yb - 4 else K('roof', 3 if h2(x, y, 64) % 6 else 2) if y < yb - 1 else K('roof', 4))
        c.P(x, yb, K('plas', 1)); c.P(x, yb + 1, K('plas', 2))
        if x % 4 == 1: rebar(c, x, yb, 3, 1 if x % 8 == 1 else -1)
    for (x, y) in ((56, ty + 3), (70, ty + 6), (82, ty + 4)): chunk5(c, x, y, 4, 3, 'plas', seed=x)
    for x in range(W):                                          # 2층 창 줄 아래 페인트 벗겨진 띠 + 때
        for y in range(ty + 28, ty + 32):
            col = c.get(x, y)
            if col in MAT['plas'] and h2(x, y, 65) % 3: c.P(x, y, K('plas', max(1, MAT['plas'].index(col) - 1)))
    for (x, y, w, h) in ((30, ty + 7, 7, 4), (75, ty + 22, 6, 5)):          # 회벽이 떨어져 드러난 벽돌
        for j in range(h):
            for i in range(w):
                if (i in (0, w - 1)) and (j in (0, h - 1)): continue
                c.P(x + i, y + j, K('brick', 1 if (j % 2 == 1 or (i + (j // 2) * 2) % 4 == 0) else 3))
        c.HL(x + 1, y - 1, w - 2, K('plas', 6))
    # 가게 층 위 처마(콘크리트 턱, 3/4: 윗면 3 + 앞 두께 2)
    gy = ty + 32
    c.R(0, gy, W, 3, K('conc', 6)); c.HL(0, gy, W, K('conc', 5)); c.HL(0, gy + 2, W, K('conc', 7))
    c.R(0, gy + 3, W, 2, K('conc', 3)); c.HL(0, gy + 4, W, K('conc', 1))
    for (x, d) in ((12, 1), (13, 2), (47, 2), (48, 2), (49, 1), (79, 2), (80, 1)): c.clear(x, gy, 1, d); c.P(x, gy + d, K('conc', 7))
    for x in range(58, 70): c.P(x, gy + 3, K('conc', 2)) if h2(x, 1, 69) % 2 else None
    # 가게 셋(각 30 폭, 사이 기둥 3)
    sy = gy + 5
    face(c, 0, sy, W, H - sy, 'conc', 3, seed=66, grime=3)
    for x0 in (0, 31, 63, 93):                                  # 가게 사이 기둥(콘크리트, 왼 빛)
        c.R(x0, sy, 3, H - sy, K('conc', 4)); c.VL(x0, sy, H - sy, K('conc', 6)); c.VL(x0 + 2, sy, H - sy, K('conc', 2))
    # 가게 1: 반쯤 올린 셔터 + 아래 어두운 속 + 앞 맨 차양 틀
    for y in range(sy, H - 1):
        for x in range(3, 31):
            j = y - sy
            if j < 10: c.P(x, y, K('metal', (6 if j % 4 == 0 else 4 if j % 4 == 1 else 3 if j % 4 == 2 else 1) - (1 if x > 26 and j % 4 else 0)))
            else: c.P(x, y, K('soot', 0 if j < H - sy - 4 else 1))
    c.HL(3, sy + 10, 28, K('metal', 6)); c.HL(3, sy + 11, 28, K('metal', 1))
    c.HL(5, H - 7, 22, K('soot', 2)); c.HL(5, H - 6, 22, K('soot', 1))                  # 안 진열 선반(어둠 속 희미하게)
    for x in (8, 15, 22): c.VL(x, H - 9, 2, K('soot', 2))
    for k in range(4): c.P(25 - k, sy + 13 + k, K('soot', 3))                          # 비친 빛
    for (x, y) in ((4, sy + 12), (5, sy + 13), (29, sy + 12), (28, sy + 14), (12, H - 2), (20, H - 3)): c.P(x, y, K('glass', 4))
    c.P(13, H - 2, K('glass', 2)); c.P(8, H - 4, K('wood', 3)); c.P(9, H - 4, K('wood', 2))
    # 가게 2: 닫힌 셔터(찌그러짐 + 녹 줄)
    for y in range(sy, H - 1):
        for x in range(34, 63):
            k = (y - sy) % 4
            dent = 44 <= x <= 52 and sy + 8 <= y <= sy + 13
            c.P(x, y, K('metal', (6 if k == 0 else 4 if k == 1 else 3 if k == 2 else 1) - (1 if dent else 0) - (1 if x > 58 and k else 0)))
    for (x, ln) in ((39, 3), (55, 5)): drips(c, x, sy + 1 + (x % 3), ln)
    for x in range(40, 47): c.P(x, sy + 7 + (x - 40) // 3, K('metal', 6))
    c.R(34, H - 4, 29, 3, K('metal', 1)); c.P(46, H - 3, K('soot', 0)); c.P(47, H - 3, K('soot', 0))
    # 가게 3: 깨진 진열창(빈 틀 + 남은 유리 조각) + 출입구
    for y in range(sy, H - 1):
        for x in range(66, 93):
            c.P(x, y, K('soot', 0 if y < H - 6 else 1))
    c.HL(66, sy, 27, K('metal', 5)); c.VL(66, sy, H - sy - 1, K('metal', 4)); c.VL(80, sy, H - sy - 1, K('metal', 3)); c.VL(92, sy, H - sy - 1, K('metal', 2))
    for k in range(5): c.P(76 - k, sy + 6 + k, K('soot', 3)); c.P(89 - k, sy + 4 + k, K('soot', 2))   # 비친 빛
    for (x, y) in ((79, sy + 3), (79, sy + 4), (78, sy + 5), (81, H - 8), (81, H - 9), (91, sy + 9), (90, sy + 10)): c.P(x, y, K('glass', 4))
    for (x, y, l) in ((67, sy + 1, 4), (67, sy + 2, 2), (78, sy + 1, 2), (81, sy + 1, 5), (90, H - 6, 2)):
        c.HL(x, y, l, K('glass', 4)); c.P(x, y + 1, K('glass', 2))
    c.HL(66, H - 6, 14, K('conc', 5)); c.R(66, H - 5, 14, 4, K('conc', 2))             # 진열대 턱
    for (x, y) in ((70, H - 2), (74, H - 1), (86, H - 2)): c.P(x, y, K('glass', 5)); c.P(x + 1, y, K('glass', 3))
    # 맨 차양 틀(가게 1 앞): 가로 쇠파이프(윗면 빛) + 찢긴 천 토막
    c.HL(2, sy + 1, 30, K('metal', 6)); c.HL(2, sy + 2, 30, K('metal', 2))
    for x in (4, 16, 29): c.VL(x, sy + 1, 6, K('metal', 3))
    for (x, y, ln) in ((9, ty + 14, 5), (41, ty + 30, 4), (25, ty + 30, 6)):            # 창턱 밑 빗물·그을음 자국
        for j in range(ln):
            for i in range(2):
                col = c.get(x + i, y + j)
                if col in MAT['plas']: c.P(x + i, y + j, K('plas', max(1, MAT['plas'].index(col) - 2 + (j > ln // 2))))
    for x in range(46, 52):                                     # 무너진 자리 옆 때
        for y in range(ty, ty + 14):
            col = c.get(x, y)
            if col in MAT['plas'] and h2(x, y, 70) % 3 == 0: c.P(x, y, K('plas', max(1, MAT['plas'].index(col) - 2)))
    leaves(c, 92, ty + 2, ty + 30, seed=6, spread=2)
    leaves(c, 2, ty + 18, gy, seed=1, spread=1)
    mound(c, 80, H - 1, 10, 4, seed=67)
    grit(c, 0, ty, W, 32, mat='plas', seed=68, rate=41, cracks=2)
    c.clear(0, 0, 1, H); c.clear(W - 1, 0, 1, H)
    c.outline()
