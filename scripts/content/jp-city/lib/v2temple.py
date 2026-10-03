from v2core import *

def _eave_shadow(c, x, y, w, h=3):
    for j in range(h):
        for i in range(w):
            if (i + j) % 2 == 0 or j == 0: c.P(x + i, y + j, K('aka', -2) if j < h - 1 else K('aka', -3))
def _kumi(c, x, y, w):
    """두공(처마 밑 블록 띠) 2단."""
    c.R(x, y, w, 3, K('aka', -1)); c.HL(x, y, w, K('aka', 1))
    for i in range(x + 1, x + w - 3, 6):
        c.R(i, y, 4, 3, K('shiro', 2)); c.HL(i, y, 4, K('shiro', 4)); c.HL(i, y + 2, 4, K('conc', 0))
def _plinth(c, x, y, w, h=8):
    c.R(x, y, w, h, K('conc', 3)); c.HL(x, y, w, K('shiro', 4)); c.HL(x, y + 1, w, K('shiro', 2)); c.R(x, y + 2, w, h - 2, K('conc', 2)); c.VL(x, y + 1, h - 1, K('conc', 4)); c.VL(x + w - 1, y + 1, h - 1, K('conc', 0))
    for i in range(x + 12, x + w - 6, 20): c.VL(i, y + 3, h - 4, K('conc', 0))
    c.HL(x, y + h - 1, w, K('conc', -1))
def gl2(c, x, y, ch, col):
    """굵은 글자: 오른쪽은 항상 +1px, 아래쪽은 획 사이 빈 줄이 남을 때만 +1px(촘촘한 글자가 뭉개지지 않는다)."""
    g = glyph(ch).astype(bool); h, w = g.shape
    p = np.zeros((h + 3, w + 3), bool); p[:h, :w] = g
    for yy, xx in zip(*np.nonzero(g)):
        c.P(x + xx, y + yy, col)
        if not p[yy, xx + 1]: c.P(x + xx + 1, y + yy, col)
        if not p[yy + 1, xx] and not p[yy + 2, xx]:
            c.P(x + xx, y + yy + 1, col)
            if not p[yy, xx + 1]: c.P(x + xx + 1, y + yy + 1, col)

def _roof_body(c, x0, y0, w, h, inset, flare=2, hi=0.55, ramp='tairu', hip=True):
    """기와 지붕면 2단 명암: 윗단(밝음) / 처마 끝(어두움). 아랫 flare 줄은 처마가 바깥으로 들린다."""
    hi_rows = int(h * hi)
    for j in range(h):
        ins = inset(j)
        fl = max(0, j - (h - 1 - flare))
        xs, xe = x0 + ins - fl, x0 + w - ins + fl
        base = 1 if j < hi_rows else 0
        if j >= h - 2: base = -2 if j == h - 2 else -3
        for x in range(xs, xe):
            k = (x - xs + (j // 4 % 2)) % 3
            t = base + (1 if k == 0 else -1 if k == 2 else 0)
            if j % 4 == 3 and j < h - 2: t -= 1
            if j == 0: t += 2
            if x - xs < 2: t += 1
            if xe - x <= 2: t -= 1
            if hip and (x - xs < 1 or xe - x <= 1) and j > 1: t -= 2
            c.P(x, y0 + j, K(ramp, t))

def _chimi(c, x, y, left=True):
    """용마루 끝 치미: 능선 위에 서서 안쪽으로 휜다 (x = 바깥쪽 모서리, y = 용마루 윗선 근처)."""
    R = 10; wd = 5
    for r in range(R):
        xs = x if left else x - wd + 1
        c.R(xs, y - R + r, wd, 1, K('tekko', 2))
        c.P(xs if left else xs + wd - 1, y - R + r, K('tekko', 4) if left else K('tekko', -1))
        if r < 3:                                                    # 안쪽으로 굽은 끝
            ix = xs + wd if left else xs - 1
            c.P(ix, y - R + r, K('tekko', 3 if left else 0))
            if r == 0: c.P(ix + (1 if left else -1), y - R + r, K('tekko', 3 if left else 0))
        if r == R - 1: c.HL(xs, y - R + r, wd, K('tekko', 0))
    kx = x + 2 if left else x - 2
    c.P(kx, y - 5, K('kii', 3)); c.P(kx, y - 4, K('kii', 1))

def _gable(c, x0, y0, w, h, top_in=5, flare=4):
    """맞배(切妻) 지붕: 윗폭이 살짝 좁은 지붕면 + 양 끝 박공판(처마보다 바깥으로 돌출) + 용마루 + 치미."""
    taper = max(1, h - 8)
    inset = lambda j: max(0, top_in - (j * top_in) // taper)
    _roof_body(c, x0, y0, w, h, inset, flare, hip=False)
    for j in range(1, h - 1):
        fl = max(0, j - (h - 1 - flare)); ins = inset(j)
        xs, xe = x0 + ins - fl, x0 + w - ins + fl
        for d, t in ((1, 0), (2, 2), (3, 3)): c.P(xs - d, y0 + j, K('ita', t))
        for d, t in ((0, -1), (1, -2), (2, -3)): c.P(xe + d, y0 + j, K('ita', t))
    ins0 = inset(0); rx0, rx1 = x0 + ins0 - 3, x0 + w - ins0 + 3
    c.R(rx0, y0 - 4, rx1 - rx0, 4, K('tairu', 1)); c.HL(rx0, y0 - 4, rx1 - rx0, K('tairu', 3)); c.HL(rx0, y0 - 1, rx1 - rx0, K('tairu', -2))
    for i in range(rx0 + 5, rx1 - 5, 5): c.VL(i, y0 - 3, 2, K('tairu', -1))
    _chimi(c, rx0 - 2, y0 - 3, True); _chimi(c, rx1 + 1, y0 - 3, False)

def _nio(c, cx, y, h):
    """감실 인왕: 머리·치켜든 팔·어깨·가슴·치마·다리의 단순 실루엣 (크기는 감실 높이에 비례)."""
    F = h - 8
    hh = max(4, round(F * .17)); hw = hh + 2
    shh = max(3, round(F * .08)); th = round(F * .30); sk = round(F * .2); lg = max(2, F - hh - shh - th - sk)
    aw = max(2, hh // 2); sw = hw * 3; tw = hw * 2
    ay = y + hh; ty = ay + shh; sy = ty + th; ly = sy + sk
    c.R(cx - sw // 2, y + 1, aw, shh + th // 2 + hh - 1, K('daidai', 1)); c.VL(cx - sw // 2, y + 1, shh + th // 2 + hh - 1, K('daidai', 3))   # 치켜든 팔
    c.R(cx - sw // 2 - 1, y - 1, aw + 2, 3, K('daidai', 2)); c.HL(cx - sw // 2 - 1, y - 1, aw + 2, K('daidai', 4))                      # 주먹
    c.R(cx + sw // 2 - aw, ty, aw, th + 3, K('daidai', 0)); c.VL(cx + sw // 2 - 1, ty, th + 3, K('daidai', -1))                           # 내린 팔
    c.R(cx - tw // 2, ty, tw, th, K('aka', 1)); c.R(cx - tw // 2, ty, tw // 2, th, K('aka', 2)); c.VL(cx - tw // 2, ty, th, K('aka', 4))   # 가슴
    c.HL(cx - tw // 2 + 1, ty + th // 2, tw - 2, K('aka', -1)); c.VL(cx, ty + 1, th // 2, K('aka', -1))
    c.R(cx - sw // 2 + aw, ay, sw - 2 * aw, shh, K('aka', 3)); c.HL(cx - sw // 2 + aw, ay, sw - 2 * aw, K('aka', 5))                  # 어깨
    c.R(cx - tw // 2 - 1, sy, tw + 2, sk, K('aka', -1)); c.HL(cx - tw // 2 - 1, sy, tw + 2, K('aka', 0))                                # 치마
    for q in range(cx - tw // 2 + 2, cx + tw // 2 - 1, 4): c.VL(q, sy + 1, sk - 1, K('aka', -2))
    lw = max(3, hw // 2 + 1)
    c.R(cx - tw // 2, ly, lw, lg, K('daidai', 1)); c.R(cx + tw // 2 - lw, ly, lw, lg, K('daidai', 0))                                  # 다리
    c.R(cx - tw // 2 - 1, ly + lg - 1, lw + 2, 1, K('daidai', -1)); c.R(cx + tw // 2 - lw - 1, ly + lg - 1, lw + 2, 1, K('daidai', -1))
    c.R(cx - hw // 2, y, hw, hh, K('daidai', 2)); c.VL(cx - hw // 2, y, hh, K('daidai', 4)); c.VL(cx + hw // 2 - 1, y, hh, K('daidai', 0))   # 얼굴
    c.HL(cx - hw // 2, y, hw, K('sumi', 1))                                                                                          # 머리카락
    c.HL(cx - hw // 2 + 1, y + 2, hw - 2, K('sumi', 1)); c.HL(cx - 1, y + hh - 1, 3, K('aka', -1))                                    # 눈썹, 입

def _niche(c, x, y, w, h, fig_col='aka'):
    c.R(x, y, w, h, K('tekko', -2)); c.HL(x, y, w, K('kii', 2)); c.VL(x, y, h, K('tekko', 0)); c.VL(x + w - 1, y, h, K('tekko', -3))
    _nio(c, x + w // 2, y + 5, h)
    for yy in range(y + 4, y + h - 1, 9): c.HL(x + 1, yy, w - 2, K('tekko', 0))                  # 앞 격자(성기게)
    for xx in range(x + 5, x + w - 1, 8): c.VL(xx, y + 1, h - 2, K('tekko', 0))
def _lantern_big(c, cx, y, w, h, text):
    chochin(c, cx, y, w, h, 'aka')
    for k, ch in enumerate(text): gl(c, cx - 8, y + 5 + k * 17, ch, K('sumi', 0))

def kaminarimon():
    """12x9칸 (192x144). 切妻 평입: 맞배 지붕(양 끝 박공판·처마 돌출) + 용마루 치미."""
    W, H = 192, 144; c = Cv(W, H)
    _gable(c, 8, 16, W - 16, 28)
    _eave_shadow(c, 8, 44, W - 16, 2)
    _kumi(c, 8, 46, W - 16)
    c.R(10, 49, W - 20, 78, K('aka', -2))
    for x in (12, 42, 70, W - 74, W - 46, W - 16): pillar(c, x, 49, 78, 5)
    _niche(c, 20, 60, 40, 60); _niche(c, W - 60, 60, 40, 60)
    c.R(76, 52, W - 152, 70, K('tekko', -3))
    c.R(70, 49, W - 140, 5, K('aka', 0)); c.HL(70, 49, W - 140, K('aka', 3))
    _lantern_big(c, W // 2, 62, 40, 56, '雷門')
    c.VL(W // 2, 52, 10, K('tekko', 3))
    _plinth(c, 0, H - 17, W, 17)
    return ink2(c)

def hozomon():
    """14x10칸 (224x160). 2층 입모야: 위층 맞배 + 보 띠 + 아래 처마(裳階, 양끝 접힘)."""
    W, H = 224, 160; c = Cv(W, H)
    _gable(c, 8, 16, W - 16, 26)
    _eave_shadow(c, 8, 42, W - 16, 2)
    _kumi(c, 14, 46, W - 28)
    c.R(16, 49, W - 32, 26, K('shiro', 1)); c.VL(16, 49, 26, K('shiro', 3)); c.VL(W - 17, 49, 26, K('shiro', 0))                   # 회벽
    for b in range(4):                                                                                                         # 창은 2개씩 묶는다
        bx = 18 + b * 48
        for wx in (bx + 3, bx + 25):
            c.R(wx, 55, 14, 12, K('tekko', -2)); c.HL(wx, 55, 14, K('tekko', 1)); c.R(wx + 1, 56, 12, 10, K('garasu', -1)); c.VL(wx + 7, 56, 10, K('tekko', 2))
    for x in range(14, W - 14, 48): pillar(c, x, 49, 33, 4)
    # 상층 바닥 보 띠 (상층이 하층 지붕 위에 얹혀 이어진다)
    c.R(16, 75, W - 32, 8, K('aka', -2)); c.HL(16, 75, W - 32, K('aka', 2)); c.HL(16, 76, W - 32, K('aka', 0))
    for x in range(14, W - 14, 48): c.R(x - 2, 77, 8, 5, K('aka', 0)); c.VL(x - 2, 77, 5, K('aka', 2))
    c.HL(16, 82, W - 32, K('aka', -3))
    # 아래층 처마 (양끝이 접히는 사다리꼴)
    _roof_body(c, 3, 83, W - 6, 23, lambda j: max(0, 12 - j // 2), flare=3)
    _eave_shadow(c, 4, 106, W - 8, 3)
    _kumi(c, 10, 109, W - 20)
    c.R(12, 112, W - 24, 34, K('aka', -2))
    for x in (14, 56, 168, W - 18): pillar(c, x, 112, 34, 5)
    _niche(c, 22, 114, 40, 30); _niche(c, W - 62, 114, 40, 30)
    c.R(88, 114, W - 176, 32, K('tekko', -3))
    chochin(c, W // 2, 111, 36, 33, 'aka')                                                                                      # 대제등
    for k, ch in enumerate('宝蔵'): gl(c, W // 2 - 8, 112 + k * 15, ch, K('sumi', 0), bold=True)
    _plinth(c, 0, H - 14, W, 14)
    return ink2(c)

def pagoda():
    """오층탑 6x14칸 (96x224). 층마다 지붕 폭이 한 단씩 줄고, 지붕은 윗단/처마 끝 2단 명암."""
    W, H = 96, 224; c = Cv(W, H)
    c.R(45, 2, 6, 6, K('kii', 3)); c.HL(45, 2, 6, K('kii', 4)); c.R(43, 8, 10, 3, K('kii', 1)); c.R(47, 11, 2, 12, K('kii', 2))
    for y in (13, 16, 19): c.R(44, y, 8, 2, K('kii', 1)); c.HL(44, y, 8, K('kii', 3))
    y = 24
    RW = (22, 26, 31, 36, 41); BW = (13, 16, 19, 22, 25); DD = (7, 9, 11, 13, 15); WW = (4, 5, 6, 6, 7)
    for k in range(5):
        rw, bw = RW[k], BW[k]
        x0 = 48 - rw
        _roof_body(c, x0, y, 2 * rw, 13, lambda j, rw=rw: max(0, 7 - j // 2), flare=2)
        _eave_shadow(c, x0 + 4, y + 13, 2 * rw - 8, 2)
        bx = 48 - bw
        c.R(bx, y + 15, 2 * bw, 20, K('aka', -2))
        for i in (-1, 0, 1):
            wc = 48 + i * DD[k]; ww = WW[k]; wx = wc - ww // 2
            c.R(wx, y + 18, ww, 10, K('shiro', 2)); c.HL(wx, y + 18, ww, K('shiro', 4)); c.VL(wx + ww - 1, y + 19, 9, K('conc', 0))
        pillar(c, bx, y + 15, 20, 3); pillar(c, 48 + bw - 3, y + 15, 20, 3)
        c.R(bx - 2, y + 35, 2 * bw + 4, 2, K('aka', -2)); c.HL(bx - 2, y + 35, 2 * bw + 4, K('aka', 1))
        y += 38
    c.R(0, 206, 96, 18, K('conc', 3)); c.HL(0, 206, 96, K('shiro', 4)); c.R(0, 208, 96, 14, K('conc', 2)); c.VL(0, 207, 17, K('conc', 4)); c.VL(95, 207, 17, K('conc', 0)); c.HL(0, 222, 96, K('conc', -1))
    for x in range(10, 90, 16): c.VL(x, 211, 9, K('conc', 0))
    return ink2(c)

def honden(w=18):
    W = 16 * w; H = 192; c = Cv(W, H)
    _gable(c, 22, 17, W - 44, 31)                                                   # 위: 맞배 지붕 (14..47)
    _eave_shadow(c, 24, 48, W - 48, 3)
    _roof_body(c, 6, 53, W - 12, 35, lambda j: max(0, 16 - j // 2), flare=3)       # 아래: 우진각 치마 (53..87)
    _eave_shadow(c, 6, 88, W - 12, 4)
    _kumi(c, 22, 94, W - 44)
    c.R(26, 97, W - 52, 58, K('aka', -2))
    c.R(W // 2 - 44, 102, 88, 53, K('tekko', -3))                                                                               # 내진
    c.R(W // 2 - 46, 97, 92, 5, K('aka', 0)); c.HL(W // 2 - 46, 97, 92, K('aka', 3)); c.HL(W // 2 - 46, 101, 92, K('aka', -2))   # 내진 위 보
    for x in range(28, W - 30, 24):
        if not (W // 2 - 48 < x < W // 2 + 44): pillar(c, x, 97, 58, 5)
    ax = W // 2
    c.R(ax - 16, 144, 32, 11, K('aka', 0)); c.HL(ax - 16, 144, 32, K('aka', 3)); c.VL(ax - 16, 144, 11, K('aka', 2)); c.VL(ax + 15, 144, 11, K('aka', -2))   # 제단
    c.R(ax - 8, 135, 16, 9, K('kii', 1)); c.HL(ax - 8, 135, 16, K('kii', 3)); c.VL(ax - 8, 135, 9, K('kii', 3)); c.VL(ax + 7, 136, 8, K('kii', -1))      # 금패(제단 위)
    px0, px1 = ax - 52, ax + 52
    _roof_body(c, px0, 111, px1 - px0, 18, lambda j: max(0, 8 - j // 2), flare=2)                                                     # 향배 지붕
    _eave_shadow(c, px0 + 4, 129, px1 - px0 - 8, 3)
    c.R(px0 + 10, 132, px1 - px0 - 20, 4, K('aka', 0)); c.HL(px0 + 10, 132, px1 - px0 - 20, K('aka', 3)); c.HL(px0 + 10, 135, px1 - px0 - 20, K('aka', -2))   # 보
    pillar(c, px0 + 6, 132, 23, 5); pillar(c, px1 - 11, 132, 23, 5)
    _plinth(c, 8, 155, W - 16, 10)
    for k in range(4):
        c.R(px0 - 2 + k, 165 + k * 3, px1 - px0 + 4 - 2 * k, 3, K('conc', 3 - k % 2)); c.HL(px0 - 2 + k, 165 + k * 3, px1 - px0 + 4 - 2 * k, K('shiro', 3)); c.HL(px0 - 2 + k, 167 + k * 3, px1 - px0 + 4 - 2 * k, K('conc', 0))
    return ink2(c)

def nakamise_stall(v=0, back=False):
    """5x6칸 (80x96). 구리 지붕(처마 돌출 + 경사), 전식 간판 띠(일반 문구, 2px 획), 상품 진열(낮)."""
    W, H = 80, 96; c = Cv(W, H)
    cu = 'tairu'
    for j in range(18):                                           # 지붕 경사 사다리꼴
        ins = max(0, 5 - j // 3)
        for i in range(ins, W - ins):
            t = (1 if (i - ins) % 3 == 0 else -1 if (i - ins) % 3 == 2 else 0) + (-1 if j % 4 == 0 else 0) + (2 if j < 2 else 0) - (2 if j >= 17 else 0)
            c.P(i, 2 + j, K(cu, t))
    c.R(0, 20, W, 3, K('aka', -2)); c.HL(0, 20, W, K('aka', 1)); _eave_shadow(c, 1, 23, W - 2, 3)
    if back:
        c.R(0, 26, W, 63, K('aka', 0))
        for yy in range(27, 88, 3): c.HL(1, yy, W - 2, K('aka', -1))                               # 판벽 가로줄 (3px 간격)
        for x in (10, 44): c.R(x - 1, 39, 14, 11, K('aka', 0)); c.R(x, 40, 12, 9, K('tekko', 0)); c.HL(x, 40, 12, K('hodo', 3)); [c.VL(x + i, 41, 7, K('tekko', 2)) for i in range(2, 12, 3)]
        c.VL(33, 26, 62, K('aka', 1)); c.VL(34, 26, 62, K('aka', -1))                              # 창 사이 벽 기둥
        c.VL(5, 26, 62, K('aka', 1)); c.VL(6, 26, 62, K('aka', -1))
        c.R(62, 29, 4, 59, K('hodo', 2)); c.VL(62, 29, 59, K('hodo', 4)); c.VL(65, 29, 59, K('hodo', 0)); c.R(60, 29, 8, 3, K('hodo', 3))
        c.R(22, 56, 20, 32, K('hodo', 1)); c.HL(22, 56, 20, K('hodo', 3)); c.VL(31, 56, 32, K('hodo', 0)); c.R(37, 70, 3, 3, K('kii', 2))
        c.VL(0, 26, 63, K('aka', -2)); c.VL(W - 1, 26, 63, K('aka', -2))                         # 벽 좌우 외곽
    else:
        c.R(0, 26, W, 20, K('shiro', 3)); c.HL(0, 26, W, K('shiro', 4)); c.HL(0, 45, W, K('shiro', 0))                          # 간판 띠 (글자 높이 16 + 여백)
        names = ['菓子', '土産', '人形', '煎餅'][v % 4]; cols = [('aka', 0), ('sora', -1), ('midori', -1), ('kon', 0)][v % 4]
        for k, ch in enumerate(names): gl2(c, 20 + k * 22, 28, ch, K(*cols))
        c.R(0, 46, W, 43, K('aka', 0)); c.VL(1, 46, 43, K('aka', 2)); c.VL(0, 46, 43, K('aka', -2)); c.VL(W - 1, 46, 43, K('aka', -2))
        c.R(5, 49, W - 10, 26, K('tekko', -2)); c.HL(5, 49, W - 10, K('tekko', 1))                                              # 개구
        gc = [['aka', 'kii', 'sora'], ['kii', 'midori', 'shiro'], ['daidai', 'pinku', 'kii'], ['sora', 'shiro', 'aka']][v % 4]
        for row, y in enumerate((52, 63)):
            c.HL(7, y + 7, W - 14, K('ita', 1))
            for k in range(9): c.R(9 + k * 7, y + 2, 5, 5, K(gc[(k + row) % 3], 1)); c.HL(9 + k * 7, y + 2, 5, K(gc[(k + row) % 3], 3))
        c.R(3, 75, W - 6, 6, K('ita', 0)); c.HL(3, 75, W - 6, K('ita', 3)); c.R(3, 80, W - 6, 2, K('ita', -2))                  # 카운터 상판(윗면)
        for k in range(5): c.R(8 + k * 14, 82, 8, 5, K(gc[k % 3], 0))                                                           # 카운터 앞 상품 상자
    c.R(0, 88, W, 8, K('conc', 3)); c.HL(0, 88, W, K('shiro', 4)); c.HL(0, 95, W, K('conc', -1))
    return ink2(c)

def censer():
    """청동 향로 3/4: 둥근 몸통 + 윗면 타원 + 뚜껑 보주 + 다리 3개 + 기단."""
    c = Cv(48, 64)
    c.R(6, 53, 36, 8, K('conc', 3)); c.HL(6, 53, 36, K('shiro', 4)); c.R(6, 55, 36, 5, K('conc', 2)); c.VL(6, 54, 7, K('conc', 4)); c.HL(6, 60, 36, K('conc', -1))
    for x in (11, 22, 34): c.R(x, 46, 4, 8, K('ita', 0)); c.VL(x, 46, 8, K('ita', 2)); c.VL(x + 3, 46, 8, K('ita', -2))
    ellipse(c, 24, 36, 17, 12, K('ita', 0), K('ita', 2), K('ita', -2))
    for j in range(4):                                                         # 몸통 왼쪽 위 밝은 단
        c.HL(11 + j, 29 + j, 4 - j + 2, K('ita', 3))
    ellipse(c, 24, 26, 14, 5, K('ita', -2), K('ita', -1), K('ita', -3))               # 윗면 타원(안쪽 어두움)
    c.R(17, 14, 14, 9, K('ita', 1)); c.HL(17, 14, 14, K('ita', 3)); c.VL(17, 14, 9, K('ita', 3)); c.VL(30, 15, 8, K('ita', -2))   # 뚜껑
    disc(c, 24, 10, 4.6, K('kii', 2), K('kii', 4), K('kii', -1), split=.35)                                          # 보주 (구형 하이라이트)
    c.P(22, 8, K('kii', 5)); c.P(23, 8, K('kii', 5))
    for x in (7, 40): ellipse(c, x, 34, 3, 3, K('ita', 1), K('ita', 3), K('ita', -1))                                  # 손잡이
    return ink2(c)

def chozuya():
    """오미즈야 6x4칸: 회흑 기와 지붕 + 기둥 4 + 안쪽 판벽 + 물받이(물 윗면) + 국자 + 기단."""
    W, H = 96, 64; c = Cv(W, H)
    tile_roof(c, 4, 6, W - 8, 20, lambda j: max(0, 10 - j // 2), 'tairu', 0, ridge=True, onigawara=False)
    c.R(2, 25, W - 4, 3, K('tairu', -2)); _eave_shadow(c, 4, 28, W - 8, 3)
    c.R(8, 30, W - 16, 22, K('tekko', -1))
    for yy in range(35, 52, 4): c.HL(8, yy, W - 16, K('tekko', -2))                       # 안쪽 판벽 줄
    for x in (8, 24, W - 28, W - 12): pillar(c, x, 31, 21, 4)
    c.R(8, 31, W - 16, 3, K('aka', 0)); c.HL(8, 31, W - 16, K('aka', 3))
    c.R(26, 43, 44, 9, K('conc', 3)); c.VL(26, 43, 9, K('conc', 4)); c.VL(69, 43, 9, K('conc', 0))                     # 물받이 몸체
    c.HL(26, 50, 44, K('conc', 1)); c.HL(26, 51, 44, K('conc', -1))                    # 앞면 아래 어두운 단
    ellipse(c, 48, 42, 22, 5, K('conc', 4), K('shiro', 5), K('conc', 2))               # 윗면 테두리
    ellipse(c, 48, 42, 19, 3, K('garasu', 1), K('garasu', 2), K('garasu', 0))          # 물 윗면
    c.HL(36, 41, 8, K('garasu', 4))
    for i in range(8): c.P(58 + i, 40 - i // 2, K('ita', 2))                                 # 국자 자루
    c.R(56, 40, 3, 2, K('ita', 0)); c.HL(56, 40, 3, K('ita', 3))
    _plinth(c, 2, 52, W - 4, 10)
    return ink2(c)

def lantern_post():
    c = Cv(16, 48)
    c.R(6, 22, 4, 24, K('tekko', 1)); c.VL(6, 22, 24, K('tekko', 3)); c.VL(9, 22, 24, K('tekko', -1)); c.R(3, 44, 10, 3, K('hodo', 3)); c.HL(3, 44, 10, K('hodo', 5))
    c.R(2, 17, 12, 3, K('tekko', 2)); c.HL(2, 17, 12, K('tekko', 4))
    chochin(c, 8, 3, 12, 15, 'aka')
    return ink2(c)

def stone_lantern():
    c = Cv(16, 32)
    c.R(4, 28, 8, 3, K('conc', 4)); c.HL(4, 28, 8, K('shiro', 4)); c.R(6, 19, 4, 9, K('conc', 3)); c.VL(6, 19, 9, K('conc', 5)); c.VL(9, 19, 9, K('conc', 0))
    c.R(3, 16, 10, 4, K('conc', 4)); c.HL(3, 16, 10, K('shiro', 4)); c.R(4, 8, 8, 8, K('conc', 3)); c.R(6, 10, 4, 4, K('kii', 3)); c.P(6, 10, K('kii', 4))
    c.VL(4, 8, 8, K('conc', 5)); c.VL(10, 8, 8, K('conc', 0)); c.VL(11, 8, 8, K('conc', -1)); c.VL(9, 19, 9, K('conc', -1))
    c.R(1, 5, 14, 4, K('conc', 4)); c.HL(1, 5, 14, K('shiro', 4)); c.HL(1, 8, 14, K('conc', -1)); c.R(5, 2, 6, 3, K('conc', 3)); c.P(7, 1, K('conc', 5)); c.P(8, 1, K('conc', 2))
    # 오른쪽 어두운 단 (竿·中台·받침) + 笠 아래 그림자
    c.VL(8, 19, 9, K('conc', 0)); c.VL(9, 19, 9, K('conc', -2))
    c.VL(12, 16, 4, K('conc', 0)); c.VL(11, 11, 2, K('conc', -2))
    c.VL(11, 28, 3, K('conc', 0)); c.VL(10, 28, 3, K('conc', 1))
    c.HL(4, 9, 8, K('conc', 0))
    return ink2(c)

def sanmon(w=6):
    W = 16 * w; H = 96; c = Cv(W, H)
    _gable(c, 8, 17, W - 16, 21, top_in=4, flare=3)                                       # 14..37
    _eave_shadow(c, 8, 38, W - 16, 2)
    c.R(6, 40, W - 12, 5, K('aka', -1)); c.HL(6, 40, W - 12, K('aka', 1))                  # 윗 보
    c.R(16, 45, W - 32, 5, K('aka', 0)); c.HL(16, 45, W - 32, K('aka', 3)); c.HL(16, 49, W - 32, K('aka', -2))   # 기둥 사이 보 (기둥에 붙인다)
    for x in (8, W - 18): pillar(c, x, 45, 41, 8)
    c.R(16, 50, W - 32, 36, K('tekko', -2))                                                  # 개구 안쪽 벽
    c.R(16, 78, W - 32, 8, K('hodo', -1)); c.HL(16, 78, W - 32, K('hodo', 1))                # 바닥 암시
    c.R(16, 50, 4, 28, K('tekko', -3)); c.R(W - 20, 50, 4, 28, K('tekko', -3))               # 기둥 그림자
    c.R(W // 2 - 19, 52, 38, 20, K('ita', -2)); c.HL(W // 2 - 19, 52, 38, K('kii', 2)); c.HL(W // 2 - 19, 71, 38, K('kii', -1))   # 편액
    c.VL(W // 2 - 19, 52, 20, K('kii', 1)); c.VL(W // 2 + 18, 52, 20, K('kii', -1))
    for k, ch in enumerate('山門'): gl2(c, W // 2 - 18 + k * 18, 54, ch, K('kii', 3))
    _plinth(c, 2, 86, W - 4, 9)
    return ink2(c)

def string_lanterns(n=4):
    c = Cv(16 * n, 16)
    W = 16 * n
    # 양끝·가운데 고정 못, 2칸 폭마다 한 번 처지는 매끈한 줄
    anchors = [2, W // 2, W - 3]
    def rope_y(x):
        for a, b in zip(anchors, anchors[1:]):
            if a <= x <= b:
                u = (x - a) / (b - a); return 1.0 + 3.0 * 4 * u * (1 - u)
        return 1.0
    for x in range(anchors[0], anchors[-1] + 1):
        yy = int(round(rope_y(x)))
        c.P(x, yy, K('tekko', 2)); c.P(x, yy + 1, K('tekko', 0))
    for a in anchors:
        c.R(a - 1, 0, 3, 3, K('hodo', 2)); c.HL(a - 1, 0, 3, K('hodo', 4))
    spans = [(anchors[i], anchors[i + 1]) for i in range(len(anchors) - 1)]
    k = 0
    for a, b in spans:
        for f in (0.28, 0.72):
            cx = int(round(a + f * (b - a))); ry = int(round(rope_y(cx))) + 1
            drop = (1, 2, 1, 3)[k % 4]; h = (6, 7, 6, 6)[k % 4]; wd = (7, 7, 8, 7)[k % 4]
            c.VL(cx, ry + 1, drop + 1, K('tekko', 2))
            chochin(c, cx, ry + 2 + drop, wd, h, 'aka')
            if k == 2: c.VL(cx, ry + 2 + drop + h + 2, 2, K('kii', 2))
            k += 1
    return ink2(c, ext=False)
