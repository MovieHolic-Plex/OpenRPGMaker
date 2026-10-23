"""wasteland_ruins 폐허 다양성 판(r55): 3층 껍데기 husk-c · 단층 가게 husk-d · 불탄 벽돌 2층 husk-e · 가로 벽 wall-h2/h3 · 판 잔해 rubble-pile-b.

같은 3/4 문법(wl_ruins 머리말): 윗면은 위에서 본 판(벽 두께 띠·속 바닥·지붕판), 앞면은 그 아래 남쪽 입면.
"""
from wl_kit import *
from wl_ruins import STRUCT, top_band, ruin_floor, shade_rect, soot_plume, vine, rubble_slope, broken_window


def fill_poly(c, pts, col_fn):
    """다각형 속 화소마다 col_fn(x, y) 색(None 이면 건너뜀)."""
    ys = [p[1] for p in pts]; xs = [p[0] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            px, py = x + 0.5, y + 0.5; inside = False
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if (ay > py) != (by > py) and px < ax + (py - ay) * (bx - ax) / (by - ay): inside = not inside
            if inside:
                col = col_fn(x, y)
                if col is not None: c.P(x, y, col)


def brick_face(c, x, y, w, h, seed=0, base=3, burnt=None):
    """벽돌 앞면: 2행 벽돌 + 1행 줄눈, 단마다 반 장 엇갈림. 왼쪽 빛·아래 때. burnt(x,y)->0..2 면 그만큼 검게(그을음)."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            row = j % 3
            if row == 2: t = 1
            else:
                course = j // 3
                if (i + (4 if course % 2 else 0)) % 8 == 0: t = 1
                else:
                    t = base + (1 if row == 0 else 0) + (1 if h2(xx // 8, course, seed) % 5 == 0 else 0) - (1 if h2(xx // 8, course, seed + 1) % 6 == 0 else 0)
            if i == 0: t += 1
            if j >= h - 2: t = min(t, 2)
            b = burnt(xx, yy) if burnt else 0
            if b >= 2: c.P(xx, yy, K('soot', 2 if t > 1 else 1))
            elif b == 1: c.P(xx, yy, K('soot', 4) if t > 2 else K('brick', 0))
            else: c.P(xx, yy, K('brick', max(0, min(5, t))))


def brick_top(c, x, y, w, h, seed=0, vertical=False):
    """벽돌 벽 윗면(위에서 본 벽 두께): 벽돌 머리 4·5 + 줄눈 2, 앞(남)·왼 가장자리 빛."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            joint = (xx % 5 == 0) if not vertical else (yy % 5 == 0)
            t = 2 if joint and h2(xx, yy, seed) % 3 else 4 + (1 if h2(xx, yy, seed + 1) % 4 == 0 else 0)
            c.P(xx, yy, K('brick', t))
    if vertical: c.VL(x, y, h, K('brick', 5)); c.VL(x + w - 1, y, h, K('brick', 2))
    else: c.HL(x, y, w, K('brick', 2)); c.HL(x, y + h - 1, w, K('brick', 5))


def slab_stub(c, x, y, ln, d=1):
    """부러진 바닥판 끝(앞면 위): 윗턱 빛 1행 + 두께 2행 + 철근 둘. d=+1 동쪽으로 튀어나옴."""
    for k in range(ln):
        xx = x + k * d
        c.P(xx, y, K('conc', 7 if k % 3 else 6)); c.P(xx, y + 1, K('conc', 3)); c.P(xx, y + 2, K('conc', 1))
    rebar(c, x + ln * d, y + 1, 3, 2 * d); rebar(c, x + (ln - 2) * d, y + 2, 4, d)


def rust_streaks(c, x, y, w, h, seed=0, n=8, drips=3, pitch=None):
    """녹: 판 결을 따르는 가로 1행 줄(3~8화소, 녹 두 단) + 아래로 흐른 세로 물방울 몇 줄. 닫힌 고리·교차 획 없음(글자처럼 읽히지 않게)."""
    for k in range(n):
        ln = 3 + h2(k, 1, seed) % 6
        xx = x + h2(k, 2, seed) % max(1, w - ln)
        yy = y + h2(k, 3, seed) % max(1, h)
        if pitch: yy = y + ((yy - y) // pitch) * pitch + 1
        for i in range(ln):
            if c.get(xx + i, yy) in MAT['metal']: c.P(xx + i, yy, K('brust', 4 if i in (0, ln - 1) else 6 if i % 3 else 5))
    for k in range(drips):
        xx = x + h2(k, 4, seed) % max(1, w); yy = y + h2(k, 5, seed) % max(1, h // 2)
        for j in range(2 + h2(k, 6, seed) % 3):
            if c.get(xx, yy + j) in MAT['metal']: c.P(xx, yy + j, K('brust', 5 if j == 0 else 4))


# ------------------------------------------------------------------ husk-c: 3층 껍데기, 동쪽 위 모서리 무너짐
@piece('husk-c', '모서리 무너진 3층 껍데기', 5, 7, STRUCT,
       en='three-storey roofless concrete shell seen from above: wall tops and a dark gutted interior with a fallen floor slab and a bare stairwell, tall front face with rows of empty window holes; '
          'the whole east corner has collapsed in a stepped diagonal, so its wall tops and rubble-filled floor sit lower and lower toward the east, with cut floor-slab edges and rebar along the break',
       group='ruins', tags=['폐허', '건물', '고층'], desc='3층 콘크리트 껍데기. 동쪽 모서리가 계단처럼 비스듬히 무너져 내려앉았다(동쪽 끝은 1층만 남음). 속은 검게 비고 무너진 판과 계단실.',
       solid=[(x, y) for y in (5, 6) for x in range(5)], door=(1, 6))
def _husk_c(c):
    W, H, t = 80, 112, 4
    ty = 46                                                    # 3층 앞면 윗줄(앞면 66행 = 22행 × 3층)
    X0 = 36                                                    # 여기서부터 동쪽이 무너짐
    def yb(x):                                                 # 무너진 뒤 남은 앞면 윗줄(계단식 비탈, 층 바닥에서 잠깐 평평)
        if x < X0: return ty
        u = x - X0
        v = ty + int(u * 1.45) + (h2(x // 2, 9, 59) % 2)
        if ty + 18 <= v <= ty + 26 and 50 <= x <= 56: v = ty + 22
        return min(ty + 44, v)
    # --- 속(서쪽): 검게 빈 속 + 무너져 기운 바닥판 + 계단실
    for y in range(1 + t, ty - t):
        for x in range(t, W - t):
            f = field(x, y, 58, 32); n = h2(x, y, 60) % 9
            c.P(x, y, K('soot', 2 + (1 if n == 0 else 0)) if f < 0.6 else K('conc', 1 + (n == 1)))
    for x in range(t, W - t):                                   # 북벽 안쪽 면(그늘, 아래로 짙게) + 끊긴 층 바닥판 자국
        for j, tt in enumerate((3, 3, 2, 2, 1, 1)): c.P(x, 1 + t + j, K('conc', tt - (1 if h2(x, j, 41) % 6 == 0 else 0)))
        c.P(x, 1 + t + 3, K('conc', 5 if h2(x, 3, 42) % 4 else 4))
    top = [(7, 15), (26, 12), (29, 22), (9, 27)]               # 아래층으로 기울어 떨어진 바닥판
    for k in (2, 1): fill_poly(c, [(x, y + k) for (x, y) in top], lambda x, y, k=k: K('conc', 1 if k == 2 else 2))
    fill_poly(c, top, lambda x, y: K('conc', 4 + (1 if h2(x, y, 61) % 6 == 0 else 0) - (1 if h2(x, y, 62) % 8 == 0 else 0)))
    c.line(7, 15, 26, 12, K('conc', 2)); c.line(9, 27, 29, 22, K('conc', 6))
    rebar(c, 26, 12, 4, 2); rebar(c, 7, 16, 3, -1); rebar(c, 18, 13, 3, 1)
    for s in range(6):                                         # 계단실: 남쪽으로 내려가는 단(윗면 빛 1 + 챌판 2)
        y = 12 + s * 3
        c.HL(t + 1, y, 9, K('conc', 5)); c.HL(t + 1, y + 1, 9, K('conc', 3)); c.HL(t + 1, y + 2, 9, K('conc', 2))
    c.VL(t + 10, 12, 18, K('conc', 1))
    for x in range(X0 - 2, W - t):                             # 무너진 쪽 속: 잔해로 메워짐(내려앉아 쌓임)
        for y in range(1 + t + 6, ty - t):
            n = h2(x, y, 63) % 7
            c.P(x, y, K('conc', 3 + (1 if n == 0 else 0) - (1 if n == 1 else 0) + (1 if y > ty - 12 else 0)))
    for k in range(10):
        x = X0 + h2(k, 1, 64) % (W - t - X0 - 5); y = 12 + h2(k, 2, 64) % 24
        chunk5(c, x, y, 4 + k % 3, 3 + k % 2, seed=64 + k) if k % 3 else c.rows(x, y, ['abbb', 'bccc'], {'a': K('brick', 5), 'b': K('brick', 4), 'c': K('brick', 2)})
    top_band(c, 0, 1, W, t, seed=44)
    top_band(c, 0, 1, t, ty, seed=45, vertical=True)
    top_band(c, W - t, 1, t, ty, seed=46, vertical=True)
    top_band(c, 0, ty - t, W, t, seed=47)
    for x in (9, 10, 27, 28, 29): c.clear(x, 1); c.P(x, 2, K('conc', 7))
    # --- 앞면(무너지기 전 전체) — 창은 무너진 선 아래에 온전히 남는 것만
    conc_face(c, 0, ty, W, H - ty, seed=48, base=3, band=(21, 43), grime=3)
    c.HL(0, ty, W, K('conc', 2))
    for (wx, wy) in [(5, ty + 6), (20, ty + 6), (5, ty + 28), (35, ty + 28), (50, ty + 28), (5, ty + 50), (50, ty + 50), (65, ty + 50)]:
        if wy < max(yb(x) for x in range(wx - 1, wx + 11)) + 3: continue
        hole(c, wx, wy, 9, 9, seed=wx + wy)
    broken_window(c, 20, ty + 28, 9, 9, seed=3)
    soot_plume(c, 5, ty + 28, 9, 5, seed=7)
    dx, dw, dh = 22, 12, 17
    c.R(dx - 1, H - dh - 2, dw + 2, 2, K('conc', 6)); c.HL(dx - 1, H - dh - 1, dw + 2, K('conc', 2))
    for j in range(dh):
        for i in range(dw): c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
    c.VL(dx, H - dh, dh, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    vine(c, 2, ty + 2, 30, seed=5)
    grit(c, 0, ty, W, H - ty, seed=49, rate=21, cracks=2)
    # --- 무너짐: 동쪽 칸마다 윗면 전체를 yb(x)-ty 만큼 아래로 내린다(앞면 윗부분은 사라지고 그 자리에 낮아진 벽 윗면·속)
    snap = c.a.copy()
    for x in range(X0, W):
        s = yb(x) - ty
        if s <= 0: continue
        c.a[0:yb(x), x] = 0
        for y in range(0, ty):
            if y + s < H: c.a[y + s, x] = snap[y, x]
        c.P(x, yb(x), K('conc', 6)); c.P(x, yb(x) + 1, K('conc', 3)); c.P(x, yb(x) + 2, K('conc', 1))   # 잘린 층 끝: 빛 턱 + 어두운 밑
    for x in range(X0, W):                                      # 북쪽 윗변 들쭉날쭉(무너진 벽 위가 깨짐)
        s = yb(x) - ty
        if s <= 0: continue
        d = 1 + h2(x, 5, 65) % 3
        c.a[s + 1:s + 1 + d, x] = 0; c.P(x, s + 1 + d, K('conc', 7))
    for x in range(X0 + 2, W - 1, 4):                          # 무너진 선 따라 철근
        rebar(c, x, yb(x) + 1, 3 + (x // 4) % 3, 1 if (x // 4) % 2 else -1)
        rebar(c, x + 1, yb(x) - ty + 4, 3, -1)
    mound(c, 70, H - 1, 9, 4, seed=66)                          # 무너진 모서리 발치 잔해
    c.outline()


# ------------------------------------------------------------------ husk-d: 단층 가게, 평지붕 내려앉음 + 부서진 셔터
@piece('husk-d', '지붕 내려앉은 단층 가게', 4, 4, STRUCT,
       en='low one-storey ruined shop seen from above: flat concrete roof with a parapet, the middle of the roof caved in to a dark hole with sagging broken slabs and rebar; '
          'front face with a blank rusty fascia panel and a wide rolling shutter torn and bent up at one corner',
       group='ruins', tags=['폐허', '건물', '가게'], desc='평지붕 가운데가 내려앉은 단층 가게. 앞에 빈 간판 판(글자 없음)과 찢겨 말려 올라간 셔터.',
       solid=[(x, y) for y in (2, 3) for x in range(4)], door=(2, 3))
def _husk_d(c):
    W, H, t = 64, 64, 3
    ty = 38                                                    # 앞면 윗줄(앞면 26행)
    # --- 지붕: 방수층 아스팔트 결 + 자갈 + 가장자리 난간(파라펫) 윗면
    for y in range(t + 1, ty - t):                             # 지붕판: 따뜻한 회색 몸 + 두 단 잔점(밝·어둠) + 물 고였던 얼룩
        for x in range(t, W - t):
            n = h2(x, y, 61) % 13
            tt = 4 + (1 if n == 0 else 0) - (1 if n in (1, 2) else 0) - (2 if n == 3 else 0)
            if field(x, y, 62, 32) > 0.7: tt -= 1
            c.P(x, y, K('conc', tt))
    shade_rect(c, t, t + 1, W - 2 * t, 2, 1)                   # 북쪽 난간이 지붕에 지는 그늘
    for k in range(5):                                         # 덧댄 방수 천 조각(작고 들쭉날쭉, 결 있음)
        px, py = 6 + h2(k, 1, 63) % 44, 6 + h2(k, 2, 63) % 22
        if 13 < px < 49 and 4 < py < 31: continue
        for j in range(4):
            for i in range(3 + (j + k) % 3):
                c.P(px + i - (j % 2), py + j, K('asph', 2 + (1 if h2(px + i, py + j, 64) % 4 == 0 else 0)))
    top_band(c, 0, 1, W, t, seed=64)
    top_band(c, 0, 1, t, ty, seed=65, vertical=True)
    top_band(c, W - t, 1, t, ty, seed=66, vertical=True)
    top_band(c, 0, ty - t, W, t, seed=67)
    # 내려앉은 구멍: 들쭉날쭉한 테 + 속(아래 가게 바닥 어둡게) + 기운 판 두 장 + 철근
    hole_pts = [(18, 9), (31, 7), (44, 10), (47, 18), (43, 27), (33, 29), (21, 27), (16, 19)]
    fill_poly(c, hole_pts, lambda x, y: K('soot', 0 if y < 16 else 1 if y < 24 else 2))
    for (a, b) in zip(hole_pts, hole_pts[1:] + hole_pts[:1]):   # 구멍 테: 북쪽 테는 판 두께가 보임(남향 단면), 남쪽 테는 빛 턱
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for i in range(n + 1):
            x = round(a[0] + (b[0] - a[0]) * i / n); y = round(a[1] + (b[1] - a[1]) * i / n)
            if y < 18: c.P(x, y, K('conc', 6)); c.P(x, y + 1, K('conc', 3)); c.P(x, y + 2, K('conc', 1))
            else: c.P(x, y, K('asph', 6)); c.P(x, y - 1, K('asph', 5))
    fill_poly(c, [(20, 21), (30, 17), (33, 25), (23, 28)], lambda x, y: K('conc', 5 if (x + 2 * y) % 9 else 4))   # 처진 판 1(남쪽 테에 걸림)
    c.line(23, 28, 33, 25, K('conc', 2)); c.line(20, 21, 30, 17, K('conc', 6))
    fill_poly(c, [(35, 12), (43, 13), (42, 19), (36, 17)], lambda x, y: K('asph', 3 if (x + y) % 7 else 2))      # 처진 판 2(방수층 쪽)
    c.line(36, 17, 42, 19, K('conc', 2)); c.line(35, 12, 43, 13, K('asph', 6))
    for (x, y, l, d) in ((25, 12, 4, 1), (39, 22, 5, -2), (31, 9, 3, 1), (19, 17, 3, -1)): rebar(c, x, y, l, d)
    chunk5(c, 27, 22, 5, 4, seed=68)
    # --- 앞면: 간판 띠(빈 녹슨 판) + 셔터 + 왼쪽 작은 창
    conc_face(c, 0, ty, W, H - ty, seed=69, base=3, grime=2)
    c.HL(0, ty, W, K('conc', 2))
    fx0, fx1 = 2, W - 2                                        # 간판 판: 위 빛·아래 그늘·녹 번짐·볼트(글자 없음)
    for y in range(ty + 2, ty + 8):
        for x in range(fx0, fx1):
            n = h2(x, y, 75) % 7
            c.P(x, y, K('metal', (5 if y == ty + 2 else 1 if y == ty + 7 else 3 + (1 if y == ty + 3 else 0)) + (1 if n == 0 else -1 if n == 1 else 0)))
    rust_streaks(c, fx0 + 1, ty + 3, fx1 - fx0 - 2, 4, seed=70, n=5, drips=3)
    for x in (fx0 + 1, fx1 - 2, (fx0 + fx1) // 2): c.P(x, ty + 4, K('metal', 6))
    for x in range(40, 48): c.P(x, ty + 7 + (x - 40) // 3, K('metal', 2))      # 한쪽이 처진 판 끝
    c.HL(0, ty + 8, W, K('conc', 1))
    sx0, sx1, sy0 = 20, 58, ty + 10                            # 셔터 칸
    for y in range(sy0, H - 1):
        for x in range(sx0, sx1):
            k = (y - sy0) % 3
            c.P(x, y, K('metal', 5 if k == 0 else 3 if k == 1 else 2))
    rust_streaks(c, sx0 + 1, sy0, sx1 - sx0 - 2, H - 2 - sy0, seed=71, n=14, drips=4, pitch=3)
    c.R(sx0 - 1, sy0, 1, H - sy0, K('metal', 6)); c.R(sx1, sy0, 1, H - sy0, K('metal', 1))   # 셔터 레일
    tear = [(44, H - 1), (46, H - 9), (51, H - 13), (56, H - 12), (58, H - 15), (58, H - 1)]  # 찢겨 말려 올라간 동쪽 아래 모서리
    fill_poly(c, tear, lambda x, y: K('soot', 0 if y < H - 4 else 1))
    for (a, b) in zip(tear[:-2], tear[1:-1]):
        c.line(a[0], a[1], b[0], b[1], K('metal', 7)); c.line(a[0], a[1] - 1, b[0], b[1] - 1, K('metal', 4)); c.line(a[0], a[1] - 2, b[0], b[1] - 2, K('metal', 2))
    c.P(50, H - 6, K('glass', 5)); c.P(52, H - 4, K('wood', 3)); c.P(53, H - 4, K('wood', 2))
    hole(c, 4, ty + 12, 11, 8, seed=72)
    c.HL(sx0, H - 1, sx1 - sx0, K('conc', 1))
    grit(c, 0, ty + 9, 20, H - ty - 9, seed=73, rate=17, cracks=1)
    mound(c, 9, H - 1, 6, 3, seed=74)
    c.outline()


# ------------------------------------------------------------------ husk-e: 불탄 벽돌 2층, 위층 바닥판 드러남
@piece('husk-e', '불탄 벽돌 2층 폐허', 4, 5, STRUCT,
       en='burnt-out two-storey brick house ruin seen from above: brick wall tops, the roof gone, the upper floor slab still spanning the south half with a broken edge, '
          'the north half open down to a charred lower floor with burnt beams; soot-blackened brick front with two rows of charred window holes',
       group='ruins', tags=['폐허', '건물', '벽돌'], desc='불탄 벽돌 2층집. 지붕이 없어 위층 바닥판이 드러나고 북쪽 절반은 아래층까지 탔다. 앞면 창 위로 그을음.',
       solid=[(x, y) for y in (3, 4) for x in range(4)], door=(1, 4))
def _husk_e(c):
    W, H, t = 64, 80, 4
    ty = 36                                                    # 앞면 윗줄(앞면 44행 = 2층)
    # --- 윗면 속: 북쪽 = 탄 아래층(깊고 검다) + 탄 들보, 남쪽 = 위층 바닥판(밝은 판, 북쪽 끝 부러짐)
    for y in range(1 + t, ty - t):
        for x in range(t, W - t):
            n = h2(x, y, 81) % 7
            c.P(x, y, K('soot', 2 + (1 if n == 0 else 0) - (1 if n == 1 else 0)) if field(x, y, 82, 16) < 0.55 else K('dirt', 1 + (n == 2)))
    for x in range(t, W - t):                                   # 북벽 안쪽 면(벽돌, 그을음)
        for j in range(6):
            yy = 1 + t + j
            mortar = j % 3 == 2 or (x + (4 if j // 3 else 0)) % 8 == 0
            c.P(x, yy, K('soot', 3) if h2(x, j, 83) % 3 == 0 else K('brick', 0 if mortar else 1 + (j < 3)))
    for (x0, y0, x1, y1) in ((8, 14, 26, 18), (30, 11, 52, 16), (14, 19, 9, 13)):    # 탄 들보(위 빛 1 · 몸 · 그늘)
        c.line(x0, y0, x1, y1, K('wood', 1)); c.line(x0, y0 - 1, x1, y1 - 1, K('wood', 2)); c.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, K('soot', 0))
    for k in range(6):                                         # 숯·재 덩이
        x = t + 3 + h2(k, 1, 84) % (W - 2 * t - 6); y = 1 + t + 7 + h2(k, 2, 84) % 6
        c.P(x, y, K('soot', 4)); c.P(x + 1, y, K('soot', 1))
    sb = 22                                                    # 위층 바닥판 북쪽 끝
    for x in range(t, W - t):
        e = sb + (h2(x // 3, 3, 85) % 4) - (2 if 20 < x < 30 else 0)
        for y in range(e, ty - t):
            n = h2(x, y, 86) % 9
            tt = 5 + (1 if n == 0 else 0) - (1 if n == 1 else 0)
            if field(x, y, 87, 16) > 0.66: tt = 4                            # 그을음 번진 판
            c.P(x, y, K('conc', tt))
        c.P(x, e, K('conc', 7)); c.P(x, e - 1, K('conc', 1)); c.P(x, e - 2, K('soot', 0))   # 판 북쪽 단면(위 빛 · 아래 어둠)
    for k in range(3):
        cx, cy = 10 + k * 16, 26 + (k % 2) * 3
        for j in range(-2, 3):
            for i in range(-4, 5):
                if (i / 4.5) ** 2 + (j / 2.5) ** 2 < 1 and h2(cx + i, cy + j, 88) % 3: c.P(cx + i, cy + j, K('soot', 4))
    rubble_scatter(c, t + 2, sb + 3, W - 2 * t - 4, ty - t - sb - 4, 6, seed=89, mats=('brick', 'conc', 'brick'), shade=K('conc', 2))
    rebar(c, 34, sb + 1, 4, 1); rebar(c, 16, sb + 2, 3, -1)
    # 벽 윗면 띠(벽돌)
    brick_top(c, 0, 1, W, t, seed=90)
    brick_top(c, 0, 1, t, ty, seed=91, vertical=True)
    brick_top(c, W - t, 1, t, ty, seed=92, vertical=True)
    brick_top(c, 0, ty - t, W, t, seed=93)
    for (x, d) in ((12, 2), (13, 2), (14, 1), (40, 1), (41, 2), (42, 3), (43, 2), (44, 1)):   # 무너진 북벽 윗변
        for y in range(1, 1 + d): c.clear(x, y)
        c.P(x, 1 + d, K('brick', 5))
    for y in (14, 15, 16): c.clear(W - 1, y); c.P(W - 2, y, K('brick', 2))
    # --- 앞면: 벽돌 2층 + 층 띠(콘크리트 턱) + 창 위 그을음(불길이 핥은 자리)
    wins = [(8, ty + 6), (24, ty + 6), (40, ty + 6), (8, ty + 28), (40, ty + 28)]
    plumes = [(wx, wy, 9) for (wx, wy) in wins] + [(23, H - 16, 11)]   # 창·문 위로 불길이 핥은 그을음
    def burnt(x, y):
        best = 0
        if y < ty + 4:                                         # 앞면 윗단(난간 밑) 그을음, 위로 짙게·성기게
            best = 2 if y < ty + 2 and h2(x, y, 97) % 3 else 1 if h2(x, y, 98) % 2 else 0
        for (px, py, pw) in plumes:
            dx = abs(x - (px + (pw - 1) / 2)); dy = py - y
            if 0 < dy <= 11 and dx < pw / 2 + 1 + dy * 0.4:
                v = 1.3 - dy / 10 - dx / (pw / 2 + 2 + dy * 0.4) * 0.7 + (h2(x, y, 94) % 5) * 0.07
                if v > 0.55: best = max(best, 2)
                elif v > 0.12 and (dy < 7 or h2(x, y, 99) % 2): best = max(best, 1)
        if not best and h2(x // 8, (y - ty) // 3, 100) % 11 == 0: best = 1                # 군데군데 검게 탄 벽돌
        return best
    brick_face(c, 0, ty, W, H - ty, seed=95, burnt=burnt)
    c.HL(0, ty, W, K('soot', 1))
    for row in (21,):                                          # 층 띠(콘크리트 턱, 그을림)
        for x in range(W):
            c.P(x, ty + row, K('conc', 6) if h2(x, row, 101) % 3 else K('soot', 4)); c.P(x, ty + row + 1, K('conc', 3) if h2(x, row, 102) % 3 else K('soot', 3))
        c.HL(0, ty + row + 2, W, K('brick', 0))
    for k, (wx, wy) in enumerate(wins):
        for j in range(10):
            for i in range(9): c.P(wx + i, wy + j, K('soot', 0 if j < 6 else 1))
        c.VL(wx - 1, wy, 10, K('soot', 2)); c.VL(wx + 9, wy, 10, K('soot', 1))                # 탄 문설주
        if k in (1, 4): c.HL(wx - 1, wy + 10, 11, K('brick', 0))                              # 창턱 떨어져 나감
        else: c.HL(wx - 1, wy + 10, 11, K('soot', 3)); c.HL(wx, wy + 11, 9, K('soot', 2))      # 검게 탄 창턱
        c.HL(wx - 1, wy - 1, 11, K('soot', 3))                                                # 검게 탄 인방
        c.P(wx + 1, wy + 8, K('wood', 1)); c.P(wx + 2, wy + 8, K('wood', 0)); c.P(wx + 6, wy + 9, K('soot', 4))
    dx, dw, dh = 23, 11, 16                                    # 탄 출입구
    c.R(dx - 1, H - dh - 2, dw + 2, 2, K('soot', 3))
    for j in range(dh):
        for i in range(dw): c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
    c.VL(dx - 1, H - dh, dh, K('soot', 2)); c.HL(dx, H - 1, dw, K('dirt', 2))
    c.line(dx + 2, H - 2, dx + 8, H - 9, K('wood', 1)); c.line(dx + 3, H - 2, dx + 9, H - 9, K('wood', 0))   # 쓰러진 탄 문짝
    for (x, y) in ((56, ty + 34), (52, ty + 12), (4, ty + 38)):                      # 떨어져 나간 벽돌 자국
        c.R(x, y, 4, 2, K('brick', 0)); c.HL(x, y + 2, 4, K('brick', 4))
    for (px, py, pw) in plumes:                                 # 그을음 기둥 덧칠: 창 위로 4~10화소, 위로 넓고 성기게(검정 → 숯 → 점묘)
        for dy in range(1, 11):
            half = pw / 2 + 0.5 + dy * 0.45
            for i in range(-6, pw + 6):
                dxc = abs(i - (pw - 1) / 2)
                if dxc > half: continue
                x, y = px + i, py - dy
                if y < ty - 4 or not c.has(x, y): continue
                edge = dxc / half
                if dy == 1: col = K('soot', 3) if i in (-1, pw) else K('brick', 0)
                elif dy <= 4 and edge < 0.7: col = K('soot', 2)
                elif dy <= 7 and edge < 0.8: col = K('soot', 3) if h2(x, y, 105) % 3 else K('soot', 2)
                elif h2(x, y, 106) % (2 if dy < 9 else 3) == 0: col = K('soot', 4)
                else: continue
                if edge > 0.85 and h2(x, y, 107) % 2: continue
                c.P(x, y, col)
    for x in range(W):                                          # 벽 윗면 띠(앞 난간) 그을음
        for y in range(ty - t, ty):
            if h2(x, y, 103) % 3: c.P(x, y, K('soot', 3 if y >= ty - 2 else 4) if h2(x, y, 104) % 2 else K('brick', 1))
    c.outline()


# ------------------------------------------------------------------ 가로 벽 둘(wall-h 와 다른 끊김·높이)
@piece('wall-h2', '철근 드러난 높은 벽 토막 (가로)', 3, 2, STRUCT,
       en='tall freestanding broken concrete wall segment running east-west: wall top seen from above, a deep V-shaped break in the middle with exposed rebar stubs, '
          'an intact square pier at the west end, a slanted broken east end, front face below',
       group='ruins', tags=['벽', '폐허'], desc='가운데가 V자로 깨져 철근이 드러난 높은 벽 토막. 서쪽 끝은 네모 기둥, 동쪽 끝은 비스듬히 부서짐.',
       solid=[(0, 1), (1, 1), (2, 1)])
def _wall_h2(c):
    x0, x1, y0, top, front = 1, 47, 2, 5, 22
    yf = y0 + top                                              # 앞면 윗줄
    def drop(x):                                               # 윗변이 내려앉은 깊이(V 자 + 동쪽 비스듬)
        v = max(0, 9 - abs(x - 25)) * 1.3
        e = max(0, x - 38) * 1.4
        return int(v + e + (h2(x, 1, 101) % 2))
    for x in range(x0, x1):
        d = drop(x)
        for y in range(y0 + d, yf + d):                        # 윗면(내려앉은 만큼 아래로)
            n = h2(x, y, 102) % 9
            tt = 5 + (1 if n == 0 else 0) - (1 if n == 1 else 0)
            c.P(x, y, K('conc', tt))
        c.P(x, y0 + d, K('conc', 4)); c.P(x, yf + d - 1, K('conc', 7))
        for y in range(yf + d, yf + front):                    # 앞면
            j = y - yf
            f = field(x, y * 2, 103, 64)
            tt = 3 + (1 if f > 0.68 else -1 if f < 0.26 else 0)
            if j >= front - 3: tt = 2 if j < front - 1 else 1
            if j == d: tt = 2
            c.P(x, y, K('conc', tt))
    # 서쪽 네모 기둥(벽보다 2행 높고 앞으로 1화소)
    for x in range(x0, x0 + 6):
        for y in range(y0 - 2, yf - 1): c.P(x, y, K('conc', 6 if x > x0 else 7))
        c.P(x, y0 - 2, K('conc', 4))
        for y in range(yf - 1, yf + front): c.P(x, y, K('conc', 4 if x == x0 else 3 if x < x0 + 5 else 2))
    c.VL(x0 + 6, yf, front, K('conc', 1))
    # V 자 깨진 자리 철근(윗변에서 솟는 가닥들) + 부러진 면 빛
    for k, x in enumerate(range(17, 34, 3)):
        d = drop(x)
        rebar(c, x, y0 + d + 1, 4 + k % 3, (-1) ** k)
    for k, x in enumerate((41, 44)):
        rebar(c, x, y0 + drop(x) + 1, 3, 1)
    # 앞면: 거푸집 이음 줄 · 총탄 자국 · 녹물 줄 · 바닥 잔해
    for x in (14, 30): c.VL(x, yf + drop(x) + 2, front - drop(x) - 3, K('conc', 2))
    for (x, y) in ((10, 16), (12, 19), (34, 20), (21, 23)): c.P(x, y, K('soot', 1)); c.P(x + 1, y, K('conc', 5))
    for x in (8, 26, 37):
        for y in range(yf + drop(x) + 1, yf + drop(x) + 7): c.P(x, y, K('brust', 4))
    mound(c, 25, 31, 7, 3, seed=104); mound(c, 44, 31, 4, 2, seed=105)
    grit(c, 0, 0, 48, 32, seed=106, rate=19, cracks=2)
    c.outline()


@piece('wall-h3', '낮은 벽돌 담 토막 (가로)', 3, 2, STRUCT,
       en='low freestanding broken brick wall running east-west: concrete coping on top seen from above, red brick courses on the front face, '
          'a taller pier at the east end, the west half crumbled to a few courses with loose bricks on the ground',
       group='ruins', tags=['벽', '폐허', '벽돌'], desc='낮은 벽돌 담. 위에 콘크리트 갓돌, 동쪽 끝 기둥이 높고 서쪽 절반은 몇 단만 남아 벽돌이 흩어졌다.',
       solid=[(0, 1), (1, 1), (2, 1)])
def _wall_h3(c):
    base = 31                                                  # 앞면 아랫줄
    def front_h(x):                                            # 앞면 높이(벽돌 단): 동쪽 기둥 높고, 서쪽은 무너져 낮다
        if x >= 40: return 15
        if x >= 22: return 11 - (1 if h2(x // 3, 1, 111) % 4 == 0 else 0)
        return max(3, 3 + ((x - 2) // 4) // 1 * 1 // 1 + (h2(x // 4, 2, 111) % 2))
    for x in range(2, 46):
        fh = front_h(x)
        yt = base - fh                                         # 앞면 윗줄
        cap = 4 if x >= 40 else 3                              # 윗면(갓돌·벽돌 머리) 깊이(무너진 쪽도 3행)
        for y in range(yt, base + 1):
            j = y - yt; course = j // 3
            mortar = j % 3 == 2 or (x + (4 if course % 2 else 0)) % 8 == 0
            tt = 1 if mortar else 3 + (1 if j % 3 == 0 else 0) - (1 if h2(x // 8, course, 112) % 5 == 0 else 0)
            if y >= base - 1: tt = min(tt, 2)
            c.P(x, y, K('brick', tt))
        for y in range(yt - cap, yt):                          # 윗면: 남은 높이에 갓돌(콘크리트), 무너진 곳은 벽돌 머리
            if x >= 22: c.P(x, y, K('conc', 6 if y < yt - 1 else 7) if (y > yt - cap) else K('conc', 4))
            else:                                              # 무너진 쪽: 위에서 본 벽돌 머리(벽 두께) — 몸 4·5, 줄눈 3, 앞 턱 가장 밝게
                c.P(x, y, K('brick', 4 if (x + 2 * (y % 2)) % 5 == 0 else 5))
        if x < 22: c.P(x, yt, K('brick', 1))                   # 벽돌 머리 밑 그늘(앞면과 띄움)
        else: c.P(x, yt, K('conc', 2))                         # 갓돌 밑 그늘
    c.VL(40, base - 19, 19, K('brick', 0)); c.VL(45, base - 15, 16, K('brick', 1))   # 기둥 모서리
    for x in range(40, 46): c.P(x, base - 15, K('conc', 2))
    # 서쪽 끝 무너진 단 + 흩어진 벽돌(작은 3/4 덩이: 윗면 빛 + 앞면)
    for (x, d) in ((5, 0), (12, 1), (17, 0)):                   # 무너진 윗변에 얹힌 반 장 벽돌(제 윗면 빛 + 앞면)
        yt = base - front_h(x) - 3
        c.HL(x, yt - 2, 3, K('brick', 5)); c.HL(x, yt - 1, 3, K('brick', 3)); c.P(x + 2, yt - 1, K('brick', 1))
    for (x, y) in ((3, 29), (9, 30), (14, 28), (18, 30), (25, 30)):
        c.HL(x, y - 1, 3, K('brick', 5)); c.HL(x, y, 3, K('brick', 3)); c.P(x + 3, y, K('brick', 1))
    for (x, y) in ((29, 17), (33, 18)): c.P(x, y, K('plant', 4)); c.P(x + 1, y - 1, K('plant', 6)); c.P(x, y - 1, K('plant', 3))
    tuft(c, 12, 31, 'dry'); tuft(c, 37, 31, 'grass')
    c.outline()


# ------------------------------------------------------------------ 판 잔해 더미
@piece('rubble-pile-b', '콘크리트 판 잔해', 2, 2, 'debris',
       en='heap of broken flat concrete floor slabs lying tilted on top of each other, thick slab edges, bent rebar sticking out of the broken edges, dust and small chunks around',
       tags=['잔해'], desc='부서진 콘크리트 바닥판이 비스듬히 포개진 더미. 깨진 판 끝에서 휜 철근이 나온다.', solid=[(0, 1), (1, 1)])
def _rubble_pile_b(c):
    def slab(top, th, seed, tone):
        """기운 판: 윗면 다각형(tone 몸·결) + 남쪽 두께 th 행(앞면, 어둡게) + 윗면 둘레 이음 그늘."""
        for k in range(th, 0, -1):                             # 두께(앞면): 윗면을 k 행 아래로 밀어 칠한 띠
            fill_poly(c, [(x, y + k) for (x, y) in top], lambda x, y, k=k: K('conc', 1 if k == th else 2 if k > 1 else 3))
        fill_poly(c, top, lambda x, y: K('conc', tone + (1 if h2(x, y, seed) % 7 == 0 else 0) - (1 if h2(x, y, seed + 1) % 6 == 0 else 0)))
        for (a, b) in zip(top, top[1:] + top[:1]):              # 뒤(북)·옆 가장자리 그늘, 앞(남) 가장자리 빛 턱
            south = (a[1] + b[1]) / 2 >= max(p[1] for p in top) - 3
            c.line(a[0], a[1], b[0], b[1], K('conc', tone + 2 if south else tone - 2))
    c.shadow([(x, y) for y in (29, 30) for x in range(3, 30)])
    slab([(2, 13), (14, 9), (16, 18), (3, 21)], 3, 121, 4)      # 뒤 판(서쪽, 북으로 들림)
    slab([(16, 8), (30, 12), (29, 19), (17, 16)], 3, 122, 5)     # 뒤 판(동쪽)
    slab([(10, 22), (25, 20), (28, 25), (12, 28)], 2, 123, 6)    # 앞 판(가장 낮게 누움)
    crack(c, [(7, 14), (9, 17), (8, 20)], K('conc', 2), K('conc', 6))
    crack(c, [(22, 11), (24, 15)], K('conc', 2), K('conc', 7))
    for (x, y, l, d) in ((14, 10, 5, 1), (16, 12, 4, 2), (30, 13, 4, 2), (2, 14, 4, -2), (4, 19, 3, -1), (25, 21, 3, 1)): rebar(c, x, y, l, d)
    for (x, y, w, h) in ((2, 25, 4, 3), (5, 27, 3, 2), (28, 27, 3, 2)): chunk5(c, x, y, w, h, seed=x)
    c.P(12, 28, K('glass', 5)); c.P(13, 28, K('glass', 3))
    c.outline()
