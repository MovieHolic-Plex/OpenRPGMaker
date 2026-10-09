#!/usr/bin/env python3
"""jp_city 기준 단독주택(2층, 下屋+발코니) 손 도트 — modern3 램프만, 16px 칸, 한 층 32px, 문 16x28.
  python3 scripts/content/jp-city/houses/ref_house.py OUT_DIR
규칙 출처: tiledata/atlas-pick/modern-style-bible.md (빛 왼쪽 위·윤곽 sumi·옆면 없음·창은 파인 구멍)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'atlas-pick'))
from modern_style_bible_proof import K, Cv, ac_unit, hero, tree  # noqa: E402

OL = K('sumi', 0)          # 윤곽(보라 검정)


def lerp_x(y, y0, x0, y1, x1):
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def hip_roof(c, x0, x1, ytop, yeave, run, mat='tairu', base=0):
    """寄棟 지붕. 실루엣은 사다리꼴(능선이 맨 위, 隅棟이 처마 모서리로 떨어진다).
    앞 경사면은 4px 기와 줄(윗줄 +1, 몸 0 + 세로 골, 아랫줄 -2). 왼쪽 끝 삼각면 밝게, 오른쪽 어둡게.
    처마 끝(軒先) 3px: 밝은 립 +2, 앞 0, 밑 -2."""
    rl, rr = x0 + run, x1 - run                     # 능선 양 끝
    for y in range(ytop, yeave):
        xl = round(lerp_x(y, ytop, rl, yeave, x0)); xr = round(lerp_x(y, ytop, rr, yeave, x1))
        bl = round(lerp_x(y, ytop, rl, yeave, x0 + run // 2)); br = round(lerp_x(y, ytop, rr, yeave, x1 - run // 2))
        k = (y - ytop) % 4
        up = 1 if (y - ytop) < (yeave - ytop) * 0.45 else 0
        for x in range(xl, xr + 1):
            if x < bl:   t = base + 2 + (0 if k else 0)       # 왼쪽 隅 삼각면(빛)
            elif x > br: t = base - 1                         # 오른쪽 隅 삼각면(그늘)
            else:        t = base + up
            if k == 3: t -= 2                                 # 기와 줄 밑 그림자
            elif k == 0: t += 1
            elif bl <= x <= br and (x + (2 if (y - ytop) // 4 % 2 else 0)) % 4 == 0: t -= 1   # 기와 골
            c.P(x, y, K(mat, t))
        # 隅棟(능선에서 처마 모서리로 내려오는 마루): 밝은 1px + 오른쪽 그늘 1px
        c.P(bl, y, K(mat, base + 3)); c.P(bl + 1, y, K(mat, base - 2))
        c.P(br, y, K(mat, base + 1)); c.P(br - 1, y, K(mat, base - 2))
        c.P(xl, y, K(mat, base - 1)); c.P(xl - 1, y, OL); c.P(xr + 1, y, OL); c.P(xr, y, K(mat, base - 3))
    # 능선(大棟): 3px
    c.HL(rl - 1, ytop - 3, rr - rl + 3, OL)
    c.HL(rl, ytop - 2, rr - rl + 1, K(mat, base + 3)); c.HL(rl, ytop - 1, rr - rl + 1, K(mat, base - 1))
    c.R(rl - 2, ytop - 3, 3, 4, K(mat, base - 2)); c.R(rr, ytop - 3, 3, 4, K(mat, base - 2))   # 鬼瓦(낮게)
    c.HL(rl - 2, ytop - 4, 3, OL); c.HL(rr, ytop - 4, 3, OL); c.VL(rl - 3, ytop - 3, 4, OL); c.VL(rr + 3, ytop - 3, 4, OL)
    c.P(rl - 1, ytop - 3, K(mat, base + 2)); c.P(rr + 1, ytop - 3, K(mat, base + 1))
    eave(c, x0 - 1, x1 + 1, yeave, mat, base)


def eave(c, x0, x1, y, mat, base):
    """軒先 3px + 윤곽."""
    c.HL(x0, y, x1 - x0 + 1, K(mat, base + 2))
    for x in range(x0, x1 + 1):
        c.P(x, y + 1, K(mat, base - 1 if x % 3 else base - 2))       # 軒丸瓦 끝 무늬
    c.HL(x0, y + 2, x1 - x0 + 1, K(mat, base - 3))
    c.HL(x0, y + 3, x1 - x0 + 1, OL)
    c.VL(x0 - 1, y, 3, OL); c.VL(x1 + 1, y, 3, OL)


def lean_to(c, x0, x1, ytop, yeave, mat='tairu', base=0, skip=()):
    """下屋(1층 앞 경사 지붕): 윗면 기와 줄 + 2층 벽과 만나는 물끊기 + 처마."""
    for y in range(ytop, yeave):
        k = (y - ytop) % 4
        for x in range(x0, x1 + 1):
            if any(a <= x <= b for a, b in skip): continue
            t = base + (1 if y - ytop < 4 else 0)
            if k == 3: t -= 2
            elif k == 0: t += 1
            elif (x + (2 if (y - ytop) // 4 % 2 else 0)) % 4 == 0: t -= 1
            c.P(x, y, K(mat, t))
    for x in range(x0, x1 + 1):
        if not any(a <= x <= b for a, b in skip):
            c.P(x, ytop, K('tekko', 1))                  # 벽과 만나는 물끊기 판금
    c.VL(x0 - 1, ytop, yeave - ytop, OL); c.VL(x1 + 1, ytop, yeave - ytop, OL)
    for x in range(x0, x1 + 1):
        if any(a <= x <= b for a, b in skip): continue
        c.P(x, yeave, K(mat, base + 2)); c.P(x, yeave + 1, K(mat, base - 1 if x % 3 else base - 2))
        c.P(x, yeave + 2, K(mat, base - 3)); c.P(x, yeave + 3, OL)
    for e in (x0 - 1, x1 + 1):
        if not any(a <= e <= b for a, b in skip): c.VL(e, yeave, 3, OL)


def siding(c, x0, y0, w, h, mat='kinari', base=1):
    """가로 사이딩 4px 판: 첫 줄 판 밑 그늘(base-1), 나머지 base. 왼쪽 1px 밝음."""
    for j in range(h):
        c.HL(x0, y0 + j, w, K(mat, base - 1 if j % 4 == 0 else base))
    c.VL(x0, y0, h, K(mat, base + 1))


def eave_shadow(c, x0, y, w, mat='kinari', base=1):
    c.HL(x0, y, w, K(mat, base - 3)); c.HL(x0, y + 1, w, K(mat, base - 2)); c.HL(x0, y + 2, w, K(mat, base - 1))


def sash(c, x, y, w, h, mat='kinari', base=1, curtain=False, shutter=True):
    """알루미늄 새시 미닫이창(2장). 파인 구멍: 위 그늘 2 · 왼쪽 그늘 1 · 창턱 +2(좌우 1px 튀어나옴) · 창턱 밑 그림자."""
    if shutter:   # 셔터 상자(雨戸 상자) 3px
        c.R(x - 1, y - 4, w + 2, 3, K('tekko', 1)); c.HL(x - 1, y - 4, w + 2, K('tekko', 3)); c.HL(x - 1, y - 2, w + 2, K('tekko', -1))
        c.VL(x - 2, y - 4, 3, OL); c.VL(x + w + 1, y - 4, 3, OL); c.HL(x - 2, y - 5, w + 4, OL)
    c.R(x, y, w, h, K('tekko', 2))                                 # 알루미늄 틀
    c.R(x + 1, y + 1, w - 2, h - 2, K('garasu', 0))
    c.R(x + 1, y + 1, w - 2, 2, K('garasu', -2))                   # 안쪽 위 그늘
    c.VL(x + 1, y + 1, h - 2, K('garasu', -2))
    mid = x + w // 2
    c.VL(mid, y, h, K('tekko', 1)); c.VL(mid + 1, y, h, K('tekko', 3))   # 미닫이 맞닿는 틀
    if curtain:
        for i in range(x + 2, x + w - 1):
            if i in (mid, mid + 1): continue
            for j in range(y + 3, y + h - 1):
                c.P(i, j, K('shiro', 1 if (i - x) % 3 else 0) if j > y + 3 else K('shiro', -1))
    else:
        for k in range(min(w, h) - 5):
            c.P(x + 3 + k, y + h - 3 - k, K('garasu', 2))          # 대각 반사
        c.HL(x + 2, y + 3, w - 4, K('garasu', 1))
    c.HL(x - 1, y + h, w + 2, K('conc', 2)); c.HL(x - 1, y + h + 1, w + 2, K(mat, base - 3))
    c.HL(x, y + h + 2, w, K(mat, base - 2))
    c.VL(x - 1, y, h, OL); c.VL(x + w, y, h, K('tekko', -1))


def genkan(c, x, y, mat='kinari', base=1):
    """현관: 8px 물러선 감실(24 폭) + 문 16x28 + 문 옆 등 + 문패."""
    W = 24
    c.R(x, y, W, 30, K('conc', -1))                    # 물러선 안벽
    c.R(x, y, W, 3, K('conc', -3)); c.VL(x, y, 30, K('conc', -3)); c.VL(x + 1, y + 3, 27, K('conc', -2))
    dx = x + 4
    c.R(dx, y + 2, 16, 28, K('ita', -2))               # 현관문(짙은 갈색 알루미늄)
    c.R(dx + 1, y + 3, 14, 26, K('ita', -1))
    for j in range(y + 5, y + 28, 4): c.HL(dx + 1, j, 14, K('ita', -2))  # 가로 결
    c.R(dx + 3, y + 5, 3, 20, K('garasu', 0)); c.VL(dx + 3, y + 5, 20, K('garasu', 2)); c.HL(dx + 3, y + 5, 3, K('garasu', -2))
    c.R(dx + 11, y + 14, 2, 6, K('tekko', 3)); c.P(dx + 12, y + 19, K('tekko', 0))       # 손잡이
    c.VL(dx, y + 2, 28, OL); c.VL(dx + 15, y + 2, 28, K('ita', -3))
    c.R(x + 21, y + 8, 2, 4, K('kii', 2)); c.P(x + 21, y + 8, K('kii', 3)); c.P(x + 22, y + 11, K('kii', 0))  # 현관등
    c.VL(x - 1, y, 30, OL); c.VL(x + W, y, 30, K(mat, base - 3))


def foundation(c, x, y, w, vents=()):
    c.HL(x, y, w, K('conc', 1)); c.R(x, y + 1, w, 2, K('conc', 0)); c.HL(x, y + 3, w, K('conc', -2))
    for vx in vents:
        c.R(vx, y + 1, 8, 2, K('tekko', -2)); c.HL(vx, y + 1, 8, K('tekko', -3))


def porch(c, x, y, w):
    """현관 앞 콘크리트 디딤(윗면 4 + 앞면 3)."""
    c.R(x, y, w, 4, K('hodo', 2)); c.HL(x, y, w, K('hodo', 3)); c.R(x, y + 4, w, 2, K('hodo', 0)); c.HL(x, y + 6, w, K('hodo', -2))
    c.VL(x - 1, y, 7, OL); c.VL(x + w, y, 7, OL); c.HL(x - 1, y + 7, w + 2, OL)


def balcony(c, x0, x1, ytop, yfront, glass_x, glass_w, glass_y):
    """2층 발코니: 下屋 자리 위로 1칸 나온 바닥(윗면) + 알루미늄 난간 + 빨래 장대."""
    for y in range(ytop, yfront):
        c.HL(x0, y, x1 - x0 + 1, K('conc', 1 if (y - ytop) % 6 else 0))
    c.HL(x0, ytop, x1 - x0 + 1, K('conc', -2)); c.HL(x0, ytop + 1, x1 - x0 + 1, K('conc', -1))   # 벽 밑 그늘
    # 슬래브 앞면 4px
    c.HL(x0, yfront, x1 - x0 + 1, K('conc', 2)); c.R(x0, yfront + 1, x1 - x0 + 1, 2, K('conc', 1))
    c.HL(x0, yfront + 3, x1 - x0 + 1, OL); c.VL(x0 - 1, ytop, yfront - ytop + 4, OL); c.VL(x1 + 1, ytop, yfront - ytop + 4, OL)
    # 빨래 장대 + 수건
    py = ytop - 9
    c.HL(x0 + 2, py, x1 - x0 - 3, K('tekko', 3)); c.HL(x0 + 2, py + 1, x1 - x0 - 3, K('tekko', -1))
    c.R(x0 + 6, py + 2, 7, 9, K('sora', 2)); c.VL(x0 + 12, py + 2, 9, K('sora', 1)); c.HL(x0 + 6, py + 10, 7, K('sora', 0))
    c.R(x0 + 15, py + 2, 6, 7, K('shiro', 1)); c.VL(x0 + 20, py + 2, 7, K('shiro', -1))
    c.R(x0 + 23, py + 2, 5, 8, K('pinku', 3)); c.VL(x0 + 27, py + 2, 8, K('pinku', 2))
    # 앞 난간(바닥 앞 끝에 선다): 높이 11px
    ry = yfront - 11
    c.HL(x0, ry, x1 - x0 + 1, K('tekko', 3)); c.HL(x0, ry + 1, x1 - x0 + 1, K('tekko', 1))
    for x in range(x0, x1 + 1, 3):
        c.VL(x, ry + 2, 8, K('tekko', 1)); c.VL(x + 1, ry + 2, 8, K('tekko', -1)) if x + 1 <= x1 else None
    c.HL(x0, yfront - 1, x1 - x0 + 1, K('tekko', 0))
    c.HL(x0 - 1, ry - 1, x1 - x0 + 3, OL)
    # 옆 난간(깊이 방향 = 화면 세로)
    for xs in (x0, x1):
        c.VL(xs, ytop - 9, yfront - ytop + 9 - 11, K('tekko', 2 if xs == x0 else -1))
        c.R(xs, ytop - 9, 1, 1, K('tekko', 3))


def house(variant='base'):
    pal = {'base':  dict(roof='tairu', rb=0, wall='kinari', wb=1),
           'white': dict(roof='kawara', rb=-1, wall='shiro', wb=0),
           'blue':  dict(roof='yoru', rb=0, wall='hodo', wb=2)}[variant]
    W, H = 140, 132
    c = Cv(W, H)
    X0, X1 = 14, 125          # 벽(112px = 7칸)
    YR, YE = 12, 40           # 지붕 능선·처마
    Y2, YL = 44, 72           # 2층 벽 시작 · 下屋 시작
    YLE, Y1 = 84, 88          # 下屋 처마 · 1층 벽 시작
    YF = 118                  # 기초 시작(벽 밑)
    wm, wb = pal['wall'], pal['wb']
    # 2층 벽
    siding(c, X0, Y2, X1 - X0 + 1, YL - Y2, wm, wb)
    eave_shadow(c, X0, Y2, X1 - X0 + 1, wm, wb)
    c.VL(X0 - 1, Y2, YL - Y2, OL); c.VL(X1 + 1, Y2, YL - Y2, OL); c.VL(X1, Y2, YL - Y2, K(wm, wb - 2))
    sash(c, 26, 52, 24, 14, wm, wb)                                         # 2층 왼쪽 창
    sash(c, 76, 50, 32, 22, wm, wb, curtain=True)                           # 발코니 掃き出し窓
    # 지붕
    hip_roof(c, X0 - 4, X1 + 4, YR, YE, 34, pal['roof'], pal['rb'])
    # 1층 벽
    siding(c, X0, Y1, X1 - X0 + 1, YF - Y1, wm, wb)
    c.VL(X0 - 1, Y1, YF - Y1, OL); c.VL(X1 + 1, Y1, YF - Y1, OL); c.VL(X1, Y1, YF - Y1, K(wm, wb - 2))
    eave_shadow(c, X0, Y1, X1 - X0 + 1, wm, wb)
    genkan(c, 22, Y1, wm, wb)
    sash(c, 62, 93, 32, 24, wm, wb, curtain=True, shutter=False)            # 거실 掃き出し窓
    sash(c, 104, 96, 12, 10, wm, wb, shutter=False)                          # 작은 창(욕실)
    for gx in range(105, 115, 2): c.VL(gx, 97, 8, K('tekko', 3))            # 방범 격자
    foundation(c, X0, YF, X1 - X0 + 1, vents=(64, 102))
    c.VL(X0 - 1, YF, 4, OL); c.VL(X1 + 1, YF, 4, OL); c.HL(X0 - 1, YF + 4, X1 - X0 + 3, OL)
    # 下屋 + 발코니(오른쪽)
    lean_to(c, X0 - 4, X1 + 4, YL, YLE, pal['roof'], pal['rb'], skip=((70, X1 + 4),))
    balcony(c, 70, X1 + 4, YL, YLE, 76, 32, 50)
    for (ya, yb) in ((YE + 4, YL), (YLE + 4, YF)):          # 雨樋 세로관(왼쪽 모서리)
        c.R(X0 + 1, ya, 2, yb - ya, K('tekko', 1)); c.VL(X0 + 1, ya, yb - ya, K('tekko', 3)); c.VL(X0 + 3, ya, yb - ya, K(wm, wb - 2))
        for yy in range(ya + 6, yb, 10): c.HL(X0 + 1, yy, 2, K('tekko', -1))
    porch(c, 20, YF + 1, 28)
    ac_unit(c, 98, YF - 7)
    return c, dict(ground=YF + 4, x0=X0, x1=X1)


def gravel(S, x0, y0, w, h, mat='hodo', base=1):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            v = (x * 7 + y * 13) % 29
            S.P(x, y, K(mat, base + 1 if v == 0 else base - 1 if v == 11 else base))


def scene(out):
    """주택가 한 줄: 같은 부품, 다른 색 3채 + 자갈 마당 + 블록 담 + 좁은 생활도로 + 사람 눈금."""
    import numpy as np
    S = Cv(480, 240)
    gravel(S, 0, 0, 480, 154, 'hodo', 1)
    S.R(0, 172, 480, 68, K('yoru', 0))
    for x in range(480):
        for y in range(172, 240):
            if (x * 3 + y * 7) % 11 == 0: S.P(x, y, K('yoru', 1))
    S.HL(0, 172, 480, K('yoru', -2)); S.HL(0, 177, 480, K('shiro', 2)); S.HL(0, 178, 480, K('shiro', 0))   # 路側帯 흰 선
    xs = [6, 166, 326]
    for v, hx in zip(('base', 'white', 'blue'), xs):
        hc, m = house(v); img = np.array(hc.img()); msk = img[:, :, 3] > 0
        gy = 146; oy = gy - m['ground']
        for k, y in enumerate(range(gy - 10, gy + 1)):                    # 오른쪽 아래 접지 그림자(땅)
            for x in range(hx + m['x1'] + 2, hx + m['x1'] + 4 + k // 2):
                S.P(x, y, K('hodo', -1 if k < 3 else 0))
        S.a[oy:oy + img.shape[0], hx:hx + img.shape[1]][msk] = img[msk]
        # 블록 담(윗면 2 + 앞면 16, 줄눈 엇갈림) + 대문 기둥 + 우편함·문패
        for x in range(max(0, hx - 6), hx + 160):
            if hx + 20 <= x < hx + 54: continue
            S.P(x, 153, OL); S.P(x, 154, K('conc', 2)); S.P(x, 155, K('conc', 1))
            for y in range(156, 172):
                j = y - 156
                t = -2 if j == 15 else (-1 if (j % 5 == 0 or (x + (5 if j // 5 % 2 else 0)) % 10 == 0) else 0)
                S.P(x, y, K('conc', t))
        for px_ in (hx + 16, hx + 54):
            S.R(px_, 146, 5, 26, K('conc', 1)); S.HL(px_, 146, 5, K('conc', 3)); S.VL(px_ + 4, 147, 25, K('conc', -2)); S.HL(px_, 145, 5, OL)
            S.VL(px_ - 1, 145, 27, OL); S.VL(px_ + 5, 145, 27, OL)
        S.R(hx + 8, 158, 6, 7, K('aka', 0)); S.HL(hx + 8, 158, 6, K('aka', 2)); S.HL(hx + 9, 161, 4, K('aka', -2))   # 우편함
        S.R(hx + 3, 159, 4, 3, K('ita', 2)); S.HL(hx + 3, 162, 4, K('ita', -1))                                     # 문패
        gravel(S, hx + 21, 156, 33, 16, 'hodo', 2)                                                               # 대문 안 바닥
    hb = Cv(16, 24); hero(hb, 0, 0)
    blit(S, hb, 30, 150); blit(S, hb, 214, 186)
    tb = Cv(32, 48); tree(tb, 0, 0)
    blit(S, tb, 144, 108)
    S.save(out)
    return S


def img_mask(img):
    import numpy as np
    return np.array(img)[:, :, 3] > 0


def blit(S, src, x, y):
    import numpy as np
    a = src.a; m = a[:, :, 3] > 0
    S.a[y:y + a.shape[0], x:x + a.shape[1]][m] = a[m]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/jp-ref-house'
    os.makedirs(out, exist_ok=True)
    for v in ('base', 'white', 'blue'):
        house(v)[0].save(os.path.join(out, f'house-{v}.png'))
    scene(os.path.join(out, 'street.png'))
    print(out)
