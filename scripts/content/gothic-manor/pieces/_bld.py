"""건물 공용 도우미(굽기 제외: 이름이 _ 로 시작) — 박공·남북/동서 지붕·벽·버트레스·탑·굴뚝·창 배치."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import Cv, K, OL, OL2, darker   # noqa: E402
from gmdraw import *                       # noqa: E402,F403


def gable_roof(c, xl, xr, cx, y_eave, rise, depth, m='slate', seed=0, coping='stone', far_cross=False):
    """앞 박공(남향) + 뒤로 depth 만큼 이어지는 남북 지붕. 반환: 앞 박공 변 y(x) 함수."""
    half = (xr - xl) / 2

    def yf(x):
        d = abs(x + .5 - cx)
        return y_eave - max(0.0, (half - d)) * rise / half

    def yb(x): return yf(x) - depth
    slate_ns(c, xl - 2, xr + 2, cx, lambda x: yb(x), lambda x: yf(x) + 1, m=m, seed=seed)
    # 뒤 박공 윗변(먼 박공의 갓돌) — 어두운 선 + 한 줄 갓돌
    for x in range(xl - 2, xr + 2):
        y = int(yb(x))
        c.P(x, y, K(coping, 3)); c.P(x, y - 1, K(coping, 2))
    # 처마 끝(남북 방향 처마는 화면에서 세로) — 양옆 1px 어두운 선
    for x in (xl - 2, xr + 1):
        c.VL(x, int(yb(x)), int(yf(x) - yb(x)) + 1, K(m, 1))
    return yf


def gable_face(c, xl, xr, cx, y_eave, yf, m='stone', base=3, seed=0, coping='stone'):
    """앞 박공 삼각 벽면(돌) + 갓돌(밝은 윗면 2px + 그늘 1px)."""
    masonry(c, xl, int(yf(cx)) - 1, xr - xl, y_eave - int(yf(cx)) + 1, m, base, seed=seed, mask=lambda x, y: y >= yf(x) + 2)
    for x in range(xl - 1, xr + 1):
        y = int(yf(x))
        if x < xl or x >= xr: continue
        c.P(x, y - 1, K(coping, 6 if x < cx else 5)); c.P(x, y, K(coping, 5 if x < cx else 4)); c.P(x, y + 1, K(coping, 3 if x < cx else 2))
        c.P(x, y + 2, K(m, 1))


def ashlar(c, x, y, w, h, m='stone', base=3, course=5, seed=0):
    """좁은 기둥용 큰 마름돌: 줄마다 한두 덩이, 왼 빛·오른 그늘."""
    for r in range(0, h, course):
        cut = w // 2 + (1 if (r // course) % 2 else -1) if w >= 6 else w
        for yy in range(y + r, min(y + h, y + r + course)):
            for xx in range(x, x + w):
                lx = xx - x
                t = base + (1 if lx == 0 else -1 if lx == w - 1 else 0)
                if yy == y + r + course - 1 or lx == cut: t = base - 2
                elif yy == y + r: t += 1
                c.P(xx, yy, K(m, t))


def buttress(c, x, y_top, y_bot, w=8, m='stone', pinnacle=True, seed=0):
    """버트레스: 아래 단(폭 w) → 위 단(폭 w-2) 두 단, 단마다 경사 갓(윗면 3행 밝음 + 앞 모서리), 꼭대기 작은 첨탑. 오른쪽 벽에 그림자."""
    mid = (y_top + y_bot) // 2 + 4
    for (yy0, yy1, ww) in ((mid, y_bot, w), (y_top, mid - 3, w - 2)):
        xx = x + (w - ww) // 2
        ashlar(c, xx, yy0, ww, yy1 - yy0, m, 3, seed=seed)
        c.R(xx, yy0 - 3, ww, 3, K(m, 5)); c.HL(xx, yy0 - 3, ww, K(m, 6)); c.HL(xx, yy0 - 1, ww, K(m, 4))
        c.VL(xx + ww, yy0 - 2, yy1 - yy0 + 2, K('ink', 1))           # 벽에 떨어진 그림자
    if pinnacle:
        px = x + w // 2
        for k in range(9):
            hw = 2 if k < 3 else 1 if k < 7 else 0
            c.HL(px - hw - 1, y_top - 4 - k, 2 * hw + 1, K(m, 5))
            c.P(px - hw - 1, y_top - 4 - k, K(m, 6)); c.P(px + hw - 1, y_top - 4 - k, K(m, 3))
        c.P(px - 1, y_top - 13, K(m, 6))


def cross(c, x, y, h=8, m='iron'):
    c.VL(x, y, h, K(m, 3)); c.HL(x - 2, y + 2, 5, K(m, 3)); c.P(x, y, K(m, 5)); c.P(x - 2, y + 2, K(m, 5))


def plinth_band(c, x, y, w, h=4, m='stone'):
    """건물 밑 띠(굵은 돌 + 위 돌출 갓)."""
    masonry(c, x, y, w, h, m, 2, seed=11, course=h, blen=(6, 10))
    c.HL(x, y - 1, w, K(m, 5)); c.HL(x, y, w, K(m, 3))




# ───────────────────────── 동서 용마루 건물 ─────────────────────────
def shade_rows(c, x0, x1, y0, y1, n=1, only_opaque=True):
    """영역을 n 단 어둡게(처마 그림자·땅 습기)."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if c.opaque(x, y): c.P(x, y, darker(c.get(x, y), n))


def wall(c, x0, x1, y_top, y_bot, mat='stone', seed=0, quoins=True, plinth=True, base=3):
    """건물 정면 벽: 석재(마름돌)·벽돌, 모서리 귀돌, 밑 띠, 처마 밑 그림자 3행."""
    if mat == 'brick':
        bricks(c, x0, y_top, x1 - x0, y_bot - y_top, 'brick', base, seed=seed)
    else:
        masonry(c, x0, y_top, x1 - x0, y_bot - y_top, mat, base, seed=seed)
    if quoins:
        qm = 'stone'
        for side in (0, 1):
            r = 0; y = y_top
            while y < y_bot:
                ww = 6 if r % 2 == 0 else 4
                xa = x0 if side == 0 else x1 - ww
                for yy in range(y, min(y_bot, y + 4)):
                    for xx in range(xa, xa + ww):
                        t = 4 if mat == 'brick' else 4
                        if yy == y: t += 1
                        if yy == y + 3: t = 2
                        if side == 1 and xx == x1 - 1: t -= 1
                        if side == 0 and xx == x0: t += 1
                        c.P(xx, yy, K(qm, t))
                y += 4; r += 1
    shade_rows(c, x0, x1, y_top, y_top + 2, 1)
    if plinth:
        plinth_band(c, x0, y_bot - 4, x1 - x0)


def string_course(c, x0, x1, y, m='stone'):
    """층 사이 돌림띠(윗면 1px 밝음 + 앞 1px + 밑 그늘)."""
    c.HL(x0, y, x1 - x0, K(m, 6)); c.HL(x0, y + 1, x1 - x0, K(m, 4)); c.HL(x0, y + 2, x1 - x0, K(m, 1))


def range_roof(c, x0, x1, y_eave, depth, m='slate', seed=0, crest=True, moss=0.0, ends=True, ov=2):
    """동서 용마루 지붕 앞 경사면(가로 코스). 용마루가 실루엣 꼭대기. 양 끝은 박공 갓돌(세로 띠), 용마루에 쇠 장식, 처마 밑 홈통."""
    yr = y_eave - depth
    slate_ew(c, x0 - ov, x1 + ov, yr + 2, y_eave, m=m, seed=seed, moss=moss)
    # 용마루: 갓 기와 2행
    c.HL(x0 - ov, yr, x1 - x0 + 2 * ov, K(m, 2)); c.HL(x0 - ov, yr + 1, x1 - x0 + 2 * ov, K(m, 6))
    for x in range(x0 - ov, x1 + ov, 4): c.P(x, yr + 1, K(m, 4))
    if crest:
        for x in range(x0 + 1, x1 - 1):
            k = (x - x0) % 4
            if k == 0: c.VL(x, yr - 3, 3, K('iron', 2)); c.P(x, yr - 4, K('iron', 4))
            elif k == 2: c.P(x, yr - 1, K('iron', 2))
        c.HL(x0, yr - 1, x1 - x0, K('iron', 1))
    if ends:
        for xe, lit in ((x0 - ov, True), (x1 + ov - 3, False)):
            for y in range(yr, y_eave + 1):
                c.P(xe, y, K('stone', 6 if lit else 4)); c.P(xe + 1, y, K('stone', 5 if lit else 3)); c.P(xe + 2, y, K('stone', 3 if lit else 1))
            c.R(xe, yr - 3, 3, 3, K('stone', 5)); c.HL(xe, yr - 3, 3, K('stone', 6))   # 박공 꼭대기 갓돌
    # 처마 홈통 + 벽에 떨어지는 그림자
    c.HL(x0 - ov, y_eave, x1 - x0 + 2 * ov, K('iron', 1)); c.HL(x0 - ov, y_eave - 1, x1 - x0 + 2 * ov, K(m, 1))
    return yr


def cross_gable(c, cx, half, y_eave, rise, depth, m='stone', roof='slate', seed=0, base=3, finial=True):
    """동서 지붕에서 앞으로 튀어나온 박공: 남북 지붕 띠 + 삼각 벽면 + 갓돌 + 꼭대기 장식. 반환 yf(x)."""
    xl, xr = int(cx - half), int(cx + half)
    yf = gable_roof(c, xl, xr, cx, y_eave, rise=rise, depth=depth, m=roof, seed=seed)
    gable_face(c, xl, xr, cx, y_eave, yf, m=m, base=base, seed=seed + 1)
    if finial:
        ay = int(yf(cx))
        c.VL(int(cx) - 1, ay - 6, 5, K('iron', 3)); c.P(int(cx) - 1, ay - 7, K('iron', 5)); c.HL(int(cx) - 2, ay - 4, 3, K('iron', 3))
    return yf


def chimney(c, x, y_top, h, w=7, m='stone', pots=2):
    """굴뚝: 마름돌 몸 + 윗면이 보이는 갓돌(3행) + 토관."""
    ashlar(c, x, y_top + 3, w, h - 3, m, 3, course=4)
    c.R(x - 1, y_top, w + 2, 3, K(m, 5)); c.HL(x - 1, y_top, w + 2, K(m, 6)); c.HL(x - 1, y_top + 2, w + 2, K(m, 2))
    for k in range(pots):
        px = x + 1 + k * (w - 3) // max(1, pots - 1) if pots > 1 else x + w // 2 - 1
        c.R(px, y_top - 3, 2, 3, K('brick', 4)); c.P(px, y_top - 3, K('brick', 6)); c.P(px + 1, y_top - 1, K('brick', 2))
        c.P(px, y_top - 4, K('ink', 2)); c.P(px + 1, y_top - 4, K('ink', 2))


def dormer(c, cx, y_base, w=11, h=11, lit=False, m='stone', roof='slate', seed=0):
    """지붕 위 박공 창: 앞 벽(돌) + 첨두창 + 작은 남북 지붕(띠 3px) + 갓돌. y_base = 지붕면에 닿는 밑변."""
    xl = cx - w // 2
    yf = gable_roof(c, xl - 2, xl + w + 2, cx + .5, y_base - h + 3, rise=8, depth=6, m=roof, seed=seed)
    masonry(c, xl, y_base - h, w, h, m, 3, seed=seed, course=3, blen=(3, 5), mask=lambda x, y: y >= yf(x) + 2)
    for x in range(xl - 1, xl + w + 1):
        y = int(yf(x)); c.P(x, y, K('stone', 6 if x < cx else 4)); c.P(x, y + 1, K('stone', 4 if x < cx else 2))
    lancet(c, xl + 2, y_base - h + 2, w - 4, h - 3, lit=lit, sill=False)
    c.HL(xl - 1, y_base, w + 2, K(roof, 1)); c.HL(xl, y_base - 1, w, K(m, 2))


def window_row(c, x0, x1, y, h, n, w=7, lit=(), mull=False, seed=0):
    """x0..x1 사이에 첨두창 n 개를 고르게. lit = 불 켜진 창 번호들. 창 위에 물받이 몰딩."""
    if n <= 0: return []
    step = (x1 - x0) / n; xs = []
    for i in range(n):
        x = int(x0 + step * (i + .5) - w / 2)
        lancet(c, x, y, w, h, lit=i in lit, mull=mull, seed=seed + i)
        prof, _ = arch_profile(w)
        for k in range(w):               # 물받이(hood) 몰딩
            c.P(x + k, y + prof[k] - 1, K('stone', 5))
        c.P(x - 1, y + prof[0], K('stone', 5)); c.P(x + w, y + prof[-1], K('stone', 4))
        xs.append(x)
    return xs


def steps(c, cx, w, y_bot, n=2, m='stone'):
    """문 앞 돌계단(디딤면 밝음 + 챌면 어둠), 아래 단이 넓다."""
    for k in range(n):
        ww = w + (n - 1 - k) * 4
        y = y_bot - (n - k) * 3
        c.R(cx - ww // 2, y, ww, 2, K(m, 5)); c.HL(cx - ww // 2, y, ww, K(m, 6)); c.HL(cx - ww // 2, y + 2, ww, K(m, 2))
        c.VL(cx - ww // 2, y, 3, K(m, 4)); c.VL(cx + ww - ww // 2 - 1, y, 3, K(m, 2))


# ───────────────────────── 탑 ─────────────────────────
def spire_square(c, cx, y_base, half, h, m='slate', seed=0, finial=True):
    """사각뿔 첨탑: 앞면 삼각(가로 코스) + 양옆 얇은 면(왼 밝음·오른 어둠). 밑 처마 2px 돌출."""
    for k in range(h):
        y = y_base - k
        hw = half * (1 - k / h)
        if hw < .5: hw = .5
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            side_l = x <= x0 + (1 if hw > 3 else 0)
            side_r = x >= x1 - (1 if hw > 3 else 0)
            row = k % 3
            t = 4 if side_l else 1 if side_r else (3 if row else 2)
            if not side_l and not side_r and row == 1 and hsh(x // 3, k // 3, seed) > .8: t = 4
            c.P(x, y, K(m, t))
    c.HL(int(cx - half) - 1, y_base + 1, int(2 * half) + 3, K(m, 1))
    if finial:
        c.VL(int(cx), y_base - h - 6, 7, K('iron', 3)); c.P(int(cx), y_base - h - 7, K('iron', 5))
        c.HL(int(cx) - 1, y_base - h - 3, 3, K('iron', 3))


def spire_cone(c, cx, y_base, rx, h, m='slate', seed=0, finial=True):
    """원뿔 지붕(둥근 탑): 비늘 기와가 밑 타원을 따라 휘고, 왼쪽 밝고 오른쪽 어둡다."""
    ry = max(2, rx * .35)
    for y in range(int(y_base - h), int(y_base + ry) + 1):
        f = (y - (y_base - h)) / h        # 0 꼭대기 → 1 처마
        if f < 0: continue
        w = rx * min(1, f)
        for x in range(int(cx - w), int(math.ceil(cx + w))):
            u = (x + .5 - (cx - w)) / max(.5, 2 * w)       # 0 왼 → 1 오른
            # 처마 아래 곡선 밖은 칠하지 않는다
            dx = (x + .5 - cx) / rx
            if f >= 1 and y > y_base + ry * math.sqrt(max(0, 1 - dx * dx)): continue
            base = 5 if u < .25 else 4 if u < .5 else 3 if u < .75 else 2
            arc = ry * math.sqrt(max(0, 1 - dx * dx)) * min(1, f)
            row = int((y - arc + 100) // 3)
            col = int((u * 10 + (row % 2) * .5))
            ry_ = int((y - arc + 100)) % 3
            t = base - (2 if ry_ == 2 else 0) + (1 if ry_ == 0 and hsh(col, row, seed) > .6 else 0)
            c.P(x, y, K(m, t))
    if finial:
        c.VL(int(cx), int(y_base - h) - 6, 7, K('iron', 3)); c.P(int(cx), int(y_base - h) - 7, K('iron', 5))


def round_wall(c, cx, rx, y_top, y_bot, m='stone', seed=0):
    """둥근 탑 몸: 휘는 돌 코스(밑 타원 따라), 왼 밝음 → 오른 어둠."""
    ry = max(2, rx * .35)
    for x in range(int(cx - rx), int(math.ceil(cx + rx))):
        dx = (x + .5 - cx) / rx
        if abs(dx) > 1: continue
        arc = ry * math.sqrt(1 - dx * dx)
        u = (dx + 1) / 2
        base = 5 if u < .2 else 4 if u < .45 else 3 if u < .7 else 2 if u < .9 else 1
        ang = math.asin(max(-1, min(1, dx)))
        for y in range(y_top, int(y_bot + arc)):
            yy = y - arc
            row = int((yy - y_top + 200) // 4)
            bl = int((ang * rx * 1.3 + (row % 2) * 3 + 200) // 6)
            t = base + (1 if hsh(bl, row, seed) > .85 else -1 if hsh(bl, row, seed + 3) < .15 else 0)
            if int(yy - y_top + 200) % 4 == 3: t = min(t, base) - 2
            elif int(ang * rx * 1.3 + (row % 2) * 3 + 200) % 6 == 5: t -= 1
            c.P(x, y, K(m, t))
