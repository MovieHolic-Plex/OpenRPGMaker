"""sengoku_edo 건축 부품 그리개 — 지붕(맞배 기와·우진각 팔작·초가·동판)·벽 칸(격자·노렌 문·회벽 무시코창·나마코 벽·장지·판자벽)·기단.

규칙(3/4 탑뷰, 16px = 1m, 사람 16×24):
- 층 높이: 1층 영역 = 2줄(32px) — 들보 3px + 개구부 26px + 기단 3px. 문은 폭 16 × 높이 26.
- 2층(츠시 2층) = 1줄: 회벽·무시코창 9px + 차양(히사시) 7px.
- 지붕은 윗면이 면으로 보인다: 용마루(밝은 마루 + 어두운 밑선) → 기와 골(둥근 기와 3px 밝·중·어 + 평기와 골 2px 어둡게) → 처마 기와 끝 점 → 처마 그늘.
- 빛 왼쪽 위: 왼쪽 면 밝게, 오른쪽 면 어둡게. 윤곽 sumi.
모든 함수는 캔버스 c(px.C) 위 절대 좌표에 그린다.
"""
import math
from px import C, rnd, h32, NT, MI


def clamp(mat, t):
    return max(0, min(NT[MI[mat]] - 1, int(t)))


# ═══════════════════════ 지붕 ═══════════════════════
def _tile_px(mat, i, k, base, course=6, period=4):
    """기와 골 무늬 한 화소(본기와). 둥근 기와 3px(밝·중·어) + 골 1px(어둠) 세로 줄이 주인공이고,
    course 행마다 둥근 기와 머리(밝은 점)와 바로 위 마디(한 단 어둡게)만 살짝 — 네모 격자처럼 보이지 않게."""
    c = i % period
    cy = k % course
    if c == 0: t = base + 1
    elif c == 1: t = base
    elif c == 2: t = base - 1
    else: t = base - 2
    if c in (0, 1):
        if cy == 0: t = base + 2 if c == 0 else base + 1
        elif cy == course - 1: t = base - 1
    return (mat, clamp(mat, t))


def gable_roof(c, x0, y0, w, h, mat='kawara', base=4, ends='LR', oni=True, ridge=7):
    """맞배 기와지붕(용마루가 앞면과 나란한). 앞 경사면이 직사각형으로 보인다.
    ridge 행 용마루 · 경사 · 처마 3행(기와 끝 점 · 그늘 · 윤곽). ends 에 L/R 이 있으면 그쪽 박공 끝(목기와 띠 + 윤곽)."""
    n = NT[MI[mat]]
    for j in range(h):
        for i in range(w):
            x, y = x0 + i, y0 + j
            if j == 0: c.P(x, y, 'sumi', 1); continue
            if j < ridge - 1:
                # 노시 기와 겹 줄무늬: 밝은 윗줄 · 얇은 선 · 몸통
                t = {1: n - 1, 2: base + 1, 3: base - 1, 4: base + 1, 5: base - 1}.get(j, base)
                if j == ridge - 2: t = base - 1
                c.P(x, y, mat, clamp(mat, t)); continue
            if j == ridge - 1: c.P(x, y, mat, clamp(mat, base - 3)); continue   # 용마루 밑 그늘
            k = j - ridge
            if j >= h - 3:
                if j == h - 3:                       # 처마 기와 끝(둥근 마구리)
                    cc = i % 5
                    t = base + 2 if cc == 0 else base + 1 if cc == 1 else base - 2 if cc == 3 else base - 1
                    c.P(x, y, mat, clamp(mat, t))
                elif j == h - 2: c.P(x, y, mat, clamp(mat, base - 3))
                else: c.P(x, y, 'sumi', 1)
                continue
            depth = k / max(1, h - ridge - 3)
            b = base if depth < 0.55 else base - 1
            c.P(x, y, *_tile_px(mat, i, k, b))
    if 'L' in ends:
        for j in range(1, h):
            c.P(x0, y0 + j, 'sumi', 1)
            if j < h - 1: c.P(x0 + 1, y0 + j, mat, clamp(mat, n - 1 if j < ridge else base + 1)); c.P(x0 + 2, y0 + j, mat, clamp(mat, base - 1))
    if 'R' in ends:
        for j in range(1, h):
            c.P(x0 + w - 1, y0 + j, 'sumi', 1)
            if j < h - 1: c.P(x0 + w - 2, y0 + j, mat, clamp(mat, base - 2)); c.P(x0 + w - 3, y0 + j, mat, clamp(mat, base - 3))
    if oni:
        for side in [s for s in 'LR' if s in ends]:
            ox = x0 + 1 if side == 'L' else x0 + w - 7
            onigawara(c, ox, y0, mat, base)


def onigawara(c, x, y, mat='kawara', base=4):
    """용마루 끝 귀면 기와(6×8): 용마루보다 높이 솟은 은빛 덩이 + 어두운 테 + 둥근 무늬."""
    shape = ['.####.', '######', '##oo##', '#o..o#', '##oo##', '######', '######', '.####.']
    for j, row in enumerate(shape):
        for i, ch in enumerate(row):
            if ch == '.': continue
            X, Y = x + i, y + j
            if ch == 'o': c.P(X, Y, mat, clamp(mat, base - 2)); continue
            if j == 7 or i == 5 or (j > 0 and row[i - 1:i] == '.' and False): c.P(X, Y, 'sumi', 1); continue
            if j == 0 or i == 0: c.P(X, Y, mat, clamp(mat, base + 2)); continue
            c.P(X, Y, mat, clamp(mat, base + 1 if i < 3 else base))


def hip_roof(c, x0, y0, w, h, mat='kawara', base=4, inset=None, gable_frac=0.0, curl=3, ridge=7, oni=True, course=6):
    """우진각/팔작 기와지붕. 윗변(용마루) 폭 w-2*inset 의 사다리꼴, 처마 양끝은 들린다(curl px).
    gable_frac>0 이면 팔작(이리모야): 위쪽 gable_frac 높이까지 옆변이 수직(박공 면), 그 아래부터 귀마루로 벌어진다.
    왼쪽 귀면 밝게·오른쪽 귀면 어둡게."""
    n = NT[MI[mat]]
    inset = inset if inset is not None else max(4, w // 5)
    hg = int(round((h - 4) * gable_frac))
    H = h

    def edge_x(j):
        """행 j 의 왼쪽 경계 x(지붕 안 좌표). 팔작이면 위쪽 박공 구간은 완만하게(inset → 0.72 inset), 그 아래 귀마루는 가파르게 벌어진다."""
        if hg and j <= hg: return inset - inset * 0.28 * (j / max(1, hg))
        i0 = inset * 0.72 if hg else inset
        f = (j - hg) / max(1, H - 4 - hg)
        return max(0, i0 * (1 - min(1, f)))

    def eave_y(i):
        d = min(i, w - 1 - i)
        m = min(14, w // 3)
        lift = curl * max(0.0, (m - d) / m) ** 2 if curl else 0
        return h - 1 - int(round(lift))

    for i in range(w):
        yb = eave_y(i)
        for j in range(h):
            x, y = x0 + i, y0 + j
            if j > yb: continue
            ex = edge_x(min(j, h - 4))
            if i < ex - 0.5 or i > w - 1 - ex + 0.5: continue
            if j == 0: c.P(x, y, 'sumi', 1); continue
            if j <= yb - 3 and j < ridge - 1:
                t = {1: n - 1, 2: base + 1, 3: base - 1, 4: base + 1, 5: base - 1}.get(j, base)
                c.P(x, y, mat, clamp(mat, t)); continue
            if j == ridge - 1 and j <= yb - 3: c.P(x, y, mat, clamp(mat, base - 3)); continue
            if j == yb: c.P(x, y, 'sumi', 1); continue
            if j == yb - 1: c.P(x, y, mat, clamp(mat, base - 3)); continue
            if j == yb - 2:
                cc = i % 5
                t = base + 2 if cc == 0 else base + 1 if cc == 1 else base - 2 if cc == 3 else base - 1
                c.P(x, y, mat, clamp(mat, t)); continue
            k = j - ridge
            depth = k / max(1, h - ridge - 3)
            b = base if depth < 0.55 else base - 1
            # 귀면(사선 바깥 삼각): 왼쪽 밝게 오른쪽 어둡게, 기와 골은 사선을 따라 그대로
            exr = edge_x(j)
            side = None
            if j > hg:
                if i < inset * 0.8: side = 'L'
                if i > w - 1 - inset * 0.8: side = 'R'
            if side == 'L': b += 1
            elif side == 'R': b -= 1
            c.P(x, y, *_tile_px(mat, i, max(0, k), b, course=course))
        # 귀마루(사선 마루): 경계 2px 밝은/어두운 줄
    for j in range(1, h):
        ex = edge_x(min(j, h - 4))
        for side in 'LR':
            i = int(round(ex)) if side == 'L' else int(round(w - 1 - ex))
            if not (0 <= i < w) or j > eave_y(i): continue
            x, y = x0 + i, y0 + j
            c.P(x, y, 'sumi', 1)
            ii = i + 1 if side == 'L' else i - 1
            if j <= hg and j >= ridge - 1:
                # 팔작 박공판(하후): 짙은 나무 2px 사선
                c.P(x0 + ii, y, 'kuro', 4 if side == 'L' else 2)
                i2 = ii + 1 if side == 'L' else ii - 1
                c.P(x0 + i2, y, 'kuro', 3 if side == 'L' else 1)
            elif j < eave_y(ii) - 2:
                c.P(x0 + ii, y, mat, clamp(mat, n - 1 if side == 'L' else base - 3))
    if oni:
        onigawara(c, x0 + inset, y0, mat, base)
        onigawara(c, x0 + w - inset - 6, y0, mat, base)


def chidori_hafu(c, cx, y, half, mat='kawara', face='shikkui', gold=True):
    """지붕 경사면 위 삼각 박공(치도리하후): 밑변 2*half, 높이 ~half*0.7. 흰 면 + 짙은 박공판 ㅅ자 + 위 기와 띠 + 금 장식."""
    hh = max(5, int(half * 0.75))
    for j in range(hh + 3):
        for i in range(-half - 2, half + 3):
            x, yy = cx + i, y + j
            d = abs(i + 0.5) / (half + 0.5)
            ry = j / hh
            if ry < d - 0.02: continue
            if ry > 1.0 + 0.4: continue
            inner = ry - d
            if j >= hh: c.P(x, yy, 'sumi', 1) if j == hh + 2 else c.P(x, yy, mat, clamp(mat, 2)); continue
            if inner < 0.16: c.P(x, yy, mat, clamp(mat, 5 if i < 0 else 3))       # 기와 띠(박공 위)
            elif inner < 0.32: c.P(x, yy, 'kuro', 2 if i >= 0 else 3)                # 박공판
            else:
                t = 4 if j < hh * 0.6 else 3
                c.P(x, yy, face, t)
    c.P(cx - 1, y, 'sumi', 1); c.P(cx, y, 'sumi', 1)
    if gold:
        c.R(cx - 1, y + 2, 2, 2, 'kin', 3); c.P(cx - 1, y + 2, 'kin', 4); c.P(cx, y + 4, 'kin', 2); c.P(cx - 1, y + 4, 'kin', 2)


def thatch_roof(c, x0, y0, w, h, inset=None, base=4, ridge=6, eave=5):
    """초가(억새 지붕) 우진각: 두툼한 사다리꼴, 둥근 윗모서리, 짚 세로 결, 짙은 용마루 덮개 + 까마귀 춤(엇갈린 막대),
    처마는 짚 끝 단면(밝은 띠 + 세로 결) eave 행 + 그늘."""
    inset = inset if inset is not None else max(4, w // 5)

    def ex(j):
        f = j / max(1, h - eave - 1)
        r = inset * (1 - min(1, f) ** 0.8)
        if j < 3: r += (3 - j) * 1.2          # 둥근 윗모서리
        return r

    for j in range(h):
        for i in range(w):
            x, y = x0 + i, y0 + j
            e = ex(min(j, h - eave - 1))
            if i < e - 0.5 or i > w - 1 - e + 0.5: continue
            if j >= h - eave:                       # 처마 단면
                jj = j - (h - eave)
                if jj == eave - 1: c.P(x, y, 'sumi', 1); continue
                if jj == eave - 2: c.P(x, y, 'kaya', 1); continue
                t = 5 if jj == 0 else 4
                if (i + jj) % 3 == 0: t -= 1
                if i % 7 == 3: t -= 1
                c.P(x, y, 'kaya', clamp('kaya', t)); continue
            if j < ridge:                           # 용마루 덮개(짙은 짚 + 대나무 테)
                if j == 0: c.P(x, y, 'sumi', 1); continue
                t = 2 if j in (1,) else 3 if j < ridge - 1 else 1
                if j == ridge - 1: t = 1
                if (i % 8) in (0,) and 1 < j < ridge - 1: c.P(x, y, 'kuro', 4); continue
                c.P(x, y, 'kaya', t); continue
            # 경사면: 짚 결(세로 줄) + 위 밝음 → 처마쪽 어둡게, 왼면 밝게 오른면 어둡게
            k = (j - ridge) / max(1, h - ridge - eave)
            t = base + (1 if k < 0.35 else 0 if k < 0.75 else -1)
            sl = i < inset * (1 - k) + 2
            sr = i > w - 1 - inset * (1 - k) - 2
            if sl: t += 1
            if sr: t -= 1
            v = h32(i, (j // 3), 13) % 5
            if v == 0: t -= 1
            elif v == 4 and (j % 3) != 2: t += 1
            if (i * 7 + j * 3) % 11 == 0: t -= 1
            c.P(x, y, 'kaya', clamp('kaya', t))
    # 까마귀 춤(용마루 위 엇갈린 막대) — 8px 마다 X
    for i in range(int(inset) + 3, w - int(inset) - 3, 8):
        c.P(x0 + i, y0 + 1, 'kuro', 1); c.P(x0 + i + 2, y0 + 1, 'kuro', 1); c.P(x0 + i + 1, y0 + 2, 'kuro', 2)
        c.P(x0 + i, y0 + 3, 'kuro', 3); c.P(x0 + i + 2, y0 + 3, 'kuro', 3)
    # 윤곽
    for j in range(h - eave):
        e = ex(j)
        for side in (int(math.ceil(e - 0.5)), int(w - 1 - math.ceil(e - 0.5))):
            if 0 <= side < w: c.P(x0 + side, y0 + j, 'sumi', 1)
    for j in range(h - eave, h - 1):
        c.P(x0 + int(math.ceil(ex(h - eave - 1) - 0.5)), y0 + j, 'sumi', 1); c.P(x0 + w - 1 - int(math.ceil(ex(h - eave - 1) - 0.5)), y0 + j, 'sumi', 1)


def hisashi(c, x0, y, w, mat='kawara', base=4, ends='LR'):
    """차양(히사시) 7행: 기와 경사 4 + 처마 끝 1 + 그늘 1 + 윤곽 1. 위에 회벽이 닿는다."""
    for i in range(w):
        x = x0 + i
        c.P(x, y, mat, clamp(mat, base + 2))                         # 차양 윗가장자리(벽에 붙는 물림 기와)
        for k in range(1, 4): c.P(x, y + k, *_tile_px(mat, i, k, base, course=9))
        cc = i % 5
        c.P(x, y + 4, mat, clamp(mat, base + 2 if cc == 0 else base + 1 if cc == 1 else base - 2 if cc == 3 else base - 1))
        c.P(x, y + 5, mat, clamp(mat, base - 3))
        c.P(x, y + 6, 'sumi', 1)
    if 'L' in ends:
        for k in range(7): c.P(x0, y + k, 'sumi', 1)
    if 'R' in ends:
        for k in range(7): c.P(x0 + w - 1, y + k, 'sumi', 1)


# ═══════════════════════ 벽 칸(16px 폭) ═══════════════════════
def plaster(c, x, y, w, h, mat='shikkui', base=4, s=0):
    """회벽: 거의 평평 + 드문 얼룩 + 아래로 갈수록 한 단 어둡게(빗물)."""
    for j in range(h):
        for i in range(w):
            t = base
            r = rnd((x + i) % 16, (y + j) % 16, 21 + s)
            if r < 0.04: t -= 1
            elif r > 0.985: t += 1
            if j >= h - 2: t -= 1
            c.P(x + i, y + j, mat, clamp(mat, t))


def post(c, x, y, h, mat='kuro', w=2):
    """기둥: 왼 1px 밝게 · 오른 어둡게."""
    for j in range(h):
        c.P(x, y + j, mat, clamp(mat, 4 if mat == 'kuro' else 4))
        for k in range(1, w): c.P(x + k, y + j, mat, clamp(mat, 2))


def beam(c, x, y, w, mat='kuro', h=3):
    """들보(인방): 윗줄 밝게(윗면) · 몸통 · 밑 그늘."""
    c.HL(x, y, w, mat, clamp(mat, 4 if mat == 'kuro' else 5))
    for k in range(1, h - 1): c.HL(x, y + k, w, mat, clamp(mat, 3))
    c.HL(x, y + h - 1, w, mat, 1)


def base_stone(c, x, y, w):
    """기단 3행: 윗면 밝게 + 앞면 + 밑 윤곽."""
    for i in range(w):
        seg = (x + i) // 8
        t = 5 if h32(seg, 0, 3) % 3 else 4
        c.P(x + i, y, 'ishi', t)
        c.P(x + i, y + 1, 'ishi', 3 if (x + i) % 8 else 2)
        c.P(x + i, y + 2, 'sumi', 1)


def lattice(c, x, y, w, h, mat='kuro'):
    """격자창(코시): 가는 세로 살 2px 주기(살 밝·중 + 틈 어둠), 위·아래 가로 틀."""
    c.R(x, y, w, h, mat, 1)
    for i in range(w):
        k = (x + i) % 3
        for j in range(1, h - 1):
            if k == 0: c.P(x + i, y + j, mat, 4)
            elif k == 1: c.P(x + i, y + j, mat, 3)
            else: c.P(x + i, y + j, 'sumi', 0 if j > 2 else 1)
    c.HL(x, y, w, mat, 4); c.HL(x, y + h - 1, w, mat, 2)
    c.HL(x, y + h // 2, w, mat, 3)


def noren_door(c, x, y, h=26, cloth='ai', panels=3, dark='sumi'):
    """노렌 문(폭 16): 위 들보 아래 천 세 폭(위 9px, 갈라진 틈) + 안쪽 어둠 + 문지방. 글자 없음 — 천 아래 끝에 밝은 띠."""
    c.R(x, y, 16, h, 'kuro', 0)
    for j in range(h):
        for i in range(16):
            t = 1 if j < h - 4 else 0
            c.P(x + i, y + j, 'kuro', t)
    # 안쪽 바닥(흙바닥 도마) 빛
    c.HL(x + 1, y + h - 3, 14, 'michi', 1); c.HL(x + 1, y + h - 2, 14, 'michi', 2)
    nh = 11
    pw = 16 // panels
    n = NT[MI[cloth]]
    for p in range(panels):
        px0 = x + p * pw + (1 if p else 0)
        pw2 = pw - 1 if p < panels - 1 else 16 - p * pw - (1 if p else 0)
        for j in range(nh):
            for i in range(pw2):
                t = n - 2 if i == 0 else n - 3
                if j >= nh - 2: t = n - 4 if j == nh - 1 else n - 3
                if j == 0: t = n - 1
                c.P(px0 + i, y + j, cloth, clamp(cloth, t))
        # 천 가운데 문양 자리(글자 없음): 흰 둥근 점 한 개(가문 문장 아님 — 단순 원)
    c.VL(x, y, h, 'kuro', 3); c.VL(x + 15, y, h, 'kuro', 2)


def itado(c, x, y, h=26, mat='ki', open_=False):
    """판자 미닫이 문(폭 16): 세로 판 4px · 가로 띠 둘 · 손잡이. open_=True 면 반쯤 열려 안쪽 어둠."""
    for j in range(h):
        for i in range(16):
            k = i % 4
            t = 4 if k == 0 else 3 if k in (1, 2) else 2
            if j in (h // 4, h * 3 // 4): t = 5 if mat != 'kuro' else 4
            if j == h // 4 + 1 or j == h * 3 // 4 + 1: t = 2
            c.P(x + i, y + j, mat, clamp(mat, t))
    if open_:
        c.R(x + 8, y, 8, h - 1, 'kuro', 0); c.HL(x + 8, y + h - 3, 8, 'michi', 1)
    c.R(x + (6 if open_ else 12), y + h // 2 - 1, 1, 3, 'ishi', 5)
    c.VL(x, y, h, 'kuro', 3); c.VL(x + 15, y, h, 'kuro', 1)


def shoji(c, x, y, w, h, frame='ki', lit=False):
    """장지(쇼지): 틀 + 흰 종이 칸(가로 4·세로 5px 격자). 아래 판자 허리(4px)."""
    c.R(x, y, w, h, frame, 2)
    paper_h = h - 5
    for j in range(1, paper_h):
        for i in range(1, w - 1):
            gx, gy = (i) % 4, (j) % 5
            if gx == 0 or gy == 0: c.P(x + i, y + j, frame, 4 if gy == 0 else 3)
            else:
                t = 3 if not lit else 3
                if gy == 1: t = 2
                c.P(x + i, y + j, 'washi', t)
    for i in range(w):
        c.P(x + i, y + paper_h, frame, 5); c.P(x + i, y + paper_h + 1, frame, 3)
        c.P(x + i, y + paper_h + 2, frame, 3 if i % 4 else 2); c.P(x + i, y + paper_h + 3, frame, 2); c.P(x + i, y + h - 1, frame, 1)
    c.VL(x, y, h, frame, 5); c.VL(x + w - 1, y, h, frame, 1)


def mushiko(c, x, y, w, h):
    """무시코창: 회벽에 뚫린 세로 살 창(흰 회반죽 살 + 어두운 틈)."""
    c.R(x, y, w, h, 'shikkui', 2)
    for i in range(1, w - 1):
        for j in range(1, h - 1):
            c.P(x + i, y + j, 'shikkui', 5 if i % 3 == 1 else 4) if i % 3 != 0 else c.P(x + i, y + j, 'sumi', 1)
    c.HL(x, y, w, 'shikkui', 1); c.HL(x, y + h - 1, w, 'shikkui', 5)


def namako(c, x, y, w, h):
    """나마코 벽: 회색 기와판 + 흰 줄눈 사선 격자(마름모)."""
    for j in range(h):
        for i in range(w):
            u, v = (x + i + y + j) % 8, (x + i - (y + j)) % 8
            if u == 0 or v == 0:
                c.P(x + i, y + j, 'shikkui', 5 if u == 0 else 4)
            else:
                t = 3 if (u + v) % 8 < 4 else 2
                c.P(x + i, y + j, 'kawara', t)


def boards(c, x, y, w, h, mat='ki', base=3, vertical=False):
    """판자벽: 가로 판 4px(윗줄 밝게·아래 어둡게) + 4칸마다 세로 누름대."""
    for j in range(h):
        for i in range(w):
            if vertical:
                k = (x + i) % 4
                t = base + 1 if k == 0 else base if k < 3 else base - 1
            else:
                k = (y + j) % 4
                t = base + 1 if k == 0 else base if k < 3 else base - 2
                if (x + i) % 16 in (7,): t = base + 1 if k else base
                if (x + i) % 16 == 8: t = base - 2
            c.P(x + i, y + j, mat, clamp(mat, t))


def bars_window(c, x, y, w, h, frame='kuro'):
    """검은 살창(성·창고): 짙은 틀 + 굵은 세로 살 + 안 어둠."""
    c.R(x, y, w, h, frame, 3)
    c.R(x + 1, y + 1, w - 2, h - 2, 'sumi', 0)
    for i in range(x + 2, x + w - 2, 3):
        c.VL(i, y + 1, h - 2, frame, 4)
    c.HL(x, y, w, frame, 5); c.HL(x, y + h - 1, w, frame, 1)


def chochin(c, x, y, mat='washi', band='kuro', h=7, w=5, glow=False):
    """초롱(제등): 둥근 몸통(종이) + 위아래 검은 테 + 가운데 세로 그늘. 글자 없음."""
    c.HL(x + 1, y, w - 2, band, 2)
    for j in range(1, h - 1):
        for i in range(w):
            if (j in (1, h - 2)) and i in (0, w - 1): continue
            t = 3 if i == 1 else 2 if i < w - 1 else 1
            if glow: c.P(x + i, y + j, 'hi', 3 if i < w - 2 else 2)
            else: c.P(x + i, y + j, mat, clamp(mat, t))
    c.HL(x + 1, y + h - 1, w - 2, band, 1)


def torii_draw(c, W, H, px_, pw=6):
    """3/4 도리이: 가사기 = 위에서 내려다본 긴 판(뒤 가장자리가 양 끝 4px 좁은 사다리꼴 윗면 7행, 깊이 방향 결) + 붉은 앞면 3행, 양끝 들림.
    누키 = 윗면 3행 + 앞면 2행(양끝이 기둥 밖으로 나온다). 기둥 밑 둥근 돌 받침(타원 윗면)."""
    import math
    top = 7
    for j in range(top):
        d = int(round(4 * (top - 1 - j) / (top - 1)))
        for i in range(d, W - d):
            e = min(i, W - 1 - i)
            lift = 3 if e < 3 else 2 if e < 7 else 1 if e < 12 else 0
            y = 2 - lift + j
            t = 5 if i < W * 0.6 else 4
            if j == 0: t = 2
            elif (i - d) % 6 == 5 and j < top - 1: t -= 1
            if j == top - 1: t = 5
            c.P(i, y, 'kuro', t)
            if j == 0: c.P(i, y - 1, 'sumi', 1)
    for i in range(W):
        e = min(i, W - 1 - i)
        lift = 3 if e < 3 else 2 if e < 7 else 1 if e < 12 else 0
        y = 2 - lift + top
        for k in range(3): c.P(i, y + k, 'shu', 4 if k == 0 else 3 if k < 2 else 2)
        c.P(i, y + 3, 'sumi', 1)
    for j in range(top):
        d = int(round(4 * (top - 1 - j) / (top - 1)))
        for i in (d - 1, W - d):
            if 0 <= i < W:
                e = min(i, W - 1 - i); lift = 3 if e < 3 else 2 if e < 7 else 1 if e < 12 else 0
                c.P(i, 2 - lift + j, 'sumi', 1)
    nb = 17
    for i in range(1, W - 1):
        c.P(i, nb - 1, 'sumi', 1)
        c.P(i, nb, 'shu', 3 if i % 7 else 4); c.P(i, nb + 1, 'shu', 5); c.P(i, nb + 2, 'shu', 5)   # 누키 윗면 3행
        c.P(i, nb + 3, 'shu', 2); c.P(i, nb + 4, 'shu', 1); c.P(i, nb + 5, 'sumi', 1)
    c.VL(0, nb - 1, 7, 'sumi', 1); c.VL(W - 1, nb - 1, 7, 'sumi', 1)
    m = W // 2
    c.R(m - 3, 13, 6, 4, 'shu', 3); c.R(m - 4, 13, 8, 3, 'kuro', 2); c.HL(m - 4, 13, 8, 'kuro', 4)
    for x in px_:
        for j in range(12, H - 6):
            if nb - 1 <= j <= nb + 5: continue
            c.P(x, j, 'sumi', 1)
            for q in range(pw - 2): c.P(x + 1 + q, j, 'shu', 5 if q == 0 else 4 if q < (pw - 2) // 2 else 3 if q < pw - 3 else 2)
            c.P(x + pw - 1, j, 'sumi', 1)
        c.R(x, H - 11, pw, 5, 'kuro', 2); c.HL(x, H - 11, pw, 'kuro', 4); c.VL(x, H - 11, 5, 'sumi', 1); c.VL(x + pw - 1, H - 11, 5, 'sumi', 1)
        cx = x + pw / 2; cy = H - 5; rx = pw / 2 + 2.5; ry = 2.2
        for xi in range(int(cx - rx), int(cx + rx) + 1):
            dx = (xi + 0.5 - cx) / rx
            if abs(dx) > 1: continue
            yb = cy + ry * math.sqrt(1 - dx * dx)
            for yy in range(int(round(yb)), min(H - 1, int(round(yb)) + 2)): c.P(xi, yy, 'ishi', 3 if dx < 0.3 else 2)
            yt = cy - ry * math.sqrt(1 - dx * dx)
            for yy in range(int(round(yt)), int(round(yb))):
                if not (x <= xi < x + pw and yy < cy - 0.5): c.P(xi, yy, 'ishi', 6 if dx < 0.2 else 5)
            c.P(xi, int(round(yt)) - 1 if not (x <= xi < x + pw) else int(round(yt)), 'sumi', 1) if not (x <= xi < x + pw) else None
            c.P(xi, min(H - 1, int(round(yb)) + 2), 'sumi', 1)
