"""wasteland_ruins 폐허 건물·벽·판잣집·바리케이드·울타리·문.

3/4 문법: 지붕 없는 폐허는 «위에서 본 벽 두께(밝은 윗면 띠) + 안쪽 바닥(잔해·잡초) + 북쪽 벽 안쪽 면» 이 윗면 판이고,
남쪽 벽 바깥 면이 앞면(빈 창 구멍·어두운 출입구·층 띠·때). 부서진 윗변에서 녹슨 철근이 솟는다.
판잣집은 골강판 지붕(사다리꼴 윗면, 기운 판·덧댄 녹 판·방수포)이 윗면, 고철 판 벽 + 판자 문이 앞면.
"""
from wl_kit import *

STRUCT = 'structure'


def floor_inside(c, x, y, w, h, seed=0, weeds=2):
    """폐허 안 바닥: 깨진 콘크리트 판 + 흙 드러난 곳 + 잔해 + 잡초."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            f = field(xx, yy, seed + 60, 32)
            if f > 0.62: c.P(xx, yy, dirt_px(xx, yy, 0))
            else:
                t = 3 + (1 if hsh(xx, yy, seed) % 6 == 0 else 0) - (1 if hsh(xx, yy, seed + 1) % 9 == 0 else 0)
                c.P(xx, yy, K('conc', t))
    for i in range(0, w, 8): c.VL(x + i, y, h, K('conc', 2)) if hsh(i, seed, 2) % 2 else None   # 판 이음 흔적
    rubble_scatter(c, x + 1, y + 1, w - 2, h - 2, max(3, w * h // 120), seed=seed, shade=K('conc', 1))
    mound(c, x + 6, y + h - 1, 6, 4, seed + 13, dens=0.8)
    for k in range(weeds): tuft(c, x + 3 + hsh(k, 8, seed) % max(1, w - 6), y + 4 + hsh(k, 9, seed) % max(1, h - 5), 'grass' if k % 2 == 0 else 'dry')


def husk(c, W, H, fh, seed=0, gaps=(), door=None, windows=(), band=(), north_gap=None, tall_floors=()):
    """지붕 없는 콘크리트 폐허. W,H 화소, fh = 남쪽 앞면 높이. 벽 두께 4.
    gaps = [(x0, x1, drop)] 남쪽 벽 윗변이 무너진 구간(drop 화소만큼 낮다). north_gap = (x0, x1) 북쪽 벽이 무너진 구간.
    door = (x, w, h) 출입구, windows = [(x, y_from_front_top, w, h)], band = 앞면 층 띠 행(앞면 기준)."""
    ty = H - fh; t = 4
    nwy = 1                                                   # 북쪽 벽 윗면 시작
    inner = 7                                                 # 북쪽 벽 안쪽 면 높이
    # 바닥
    floor_inside(c, t, nwy + t + inner, W - 2 * t, ty - (nwy + t + inner) - t, seed)
    # 북쪽 벽 안쪽 면(남향, 그늘) + 윗면
    conc_face(c, t, nwy + t, W - 2 * t, inner, seed + 1, base=2, grime=2)
    for k in range(t, W - t, 9):                               # 안쪽 면에도 창 구멍 흔적
        if hsh(k, seed, 1) % 2: c.R(k + 2, nwy + t + 1, 4, 3, K('soot', 1)); c.HL(k + 2, nwy + t + 4, 4, K('conc', 4))
    conc_top(c, 0, nwy, W, t, seed)
    # 서·동 벽 윗면(세로 띠)
    conc_top(c, 0, nwy, t, ty - nwy, seed + 2); c.VL(0, nwy, ty - nwy, K('conc', 6)); c.VL(t - 1, nwy + t, ty - nwy - t, K('conc', 3))
    conc_top(c, W - t, nwy, t, ty - nwy, seed + 3); c.VL(W - 1, nwy, ty - nwy, K('conc', 3)); c.VL(W - t, nwy + t, ty - nwy - t, K('conc', 6))
    c.HL(0, nwy, W, K('conc', 4))
    # 남쪽 벽 윗면 + 앞면
    conc_top(c, 0, ty - t, W, t, seed + 4)
    conc_face(c, 0, ty, W, fh, seed + 5, base=3, band=band, grime=3)
    c.HL(0, ty, W, K('conc', 2))                              # 윗턱 밑 그늘
    for (wx, wy, ww, wh) in windows: hole(c, wx, ty + wy, ww, wh, seed + wx)
    ruin_face(c, 0, ty, W, fh, windows, seed)
    if door:
        dx, dw, dh = door
        c.R(dx - 1, H - dh - 2, dw + 2, 2, K('conc', 5)); c.HL(dx - 1, H - dh - 1, dw + 2, K('conc', 2))   # 상인방
        for j in range(dh):
            for i in range(dw):
                c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
        c.VL(dx, H - dh, dh, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    # 북쪽 벽이 무너진 구간: 윗면 띠와 안쪽 면을 잔해 더미로
    if north_gap:
        x0, x1 = north_gap
        for x in range(x0, x1):
            d = 3 + (hsh(x, 1, seed) % 3)
            c.clear(x, 0, 1, d)
            c.P(x, d, K('conc', 5)); c.P(x, d + 1, K('conc', 4))
        mound(c, (x0 + x1) // 2, nwy + t + inner + 3, (x1 - x0) // 2, 5, seed + 9)
        rebar(c, x0 + 1, 5, 4, 1); rebar(c, x1 - 2, 4, 3, -1)
    # 남쪽 벽 무너진 구간: 윗면 띠 지우고 앞면 윗변을 낮춘다(뒤에 바닥이 보임)
    for (x0, x1, drop) in gaps:
        for x in range(x0, x1):
            dd = drop - abs(x - (x0 + x1) // 2) * 2 // max(1, (x1 - x0) // 2) - (hsh(x, 2, seed) % 2)
            dd = max(1, dd)
            for y in range(ty - t, ty + dd):
                fy = y
                if y < ty: c.P(x, y, c.get(x, ty - t - 1) or K('conc', 3))    # 윗면 띠 자리에 뒤 바닥이 보임
                else: c.P(x, y, K('conc', 3) if hsh(x, y, 3) % 3 else K('conc', 2))
            c.P(x, ty + dd - 1, K('conc', 5)); c.P(x, ty + dd, K('conc', 4))     # 깨진 윗변 빛
        for k, x in enumerate(range(x0 + 1, x1 - 1, 3)):
            rebar(c, x, ty + 1, 3 + k % 3, (-1) ** k)
    notch_tops(c, W, nwy, ty, t, seed)
    c.outline()


def ruin_face(c, x, y, w, h, windows, seed=0):
    """앞면 풍화: 창 위 그을음 기둥 · 회반죽이 떨어져 드러난 벽돌 · 금 · 위에서 늘어진 덩굴."""
    for (wx, wy, ww, wh) in windows:                          # 그을음: 창 위 번진 얼룩(위로 갈수록 성기고 옅다)
        if hsh(wx, seed, 4) % 3 == 0: continue
        for j in range(1, min(7, wy)):
            half = ww / 2 + 0.5 - j * 0.45
            for i in range(-1, ww + 1):
                if abs(i - (ww - 1) / 2) > half: continue
                if hsh(wx + i, j, seed) % (2 + j // 2) != 0 and j > 1: continue
                xx, yy = x + wx + i, y + wy - 1 - j
                if c.get(xx, yy) in MAT['conc']: c.P(xx, yy, K('soot', 3 if j < 3 else 4))
    for k in range(max(1, w // 30)):                           # 드러난 벽돌
        bx = x + 3 + hsh(k, seed, 11) % max(1, w - 16); by = y + 3 + hsh(k, seed, 12) % max(1, h - 10)
        bw, bh = 7 + hsh(k, seed, 13) % 5, 4 + hsh(k, seed, 14) % 3
        for j in range(bh):
            for i in range(bw):
                if (i == 0 or i == bw - 1) and (j == 0 or j == bh - 1): continue
                xx, yy = bx + i, by + j
                if c.get(xx, yy) not in MAT['conc']: continue
                mortar = (j % 2 == 1) or ((i + (j // 2) * 2) % 4 == 0)
                c.P(xx, yy, K('brick', 1 if mortar else 3 + (1 if hsh(xx, yy, 7) % 4 == 0 else 0)))
        c.HL(bx + 1, by - 1, bw - 2, K('conc', 6))
    for k in range(max(1, w // 40)):                           # 금
        cx = x + 5 + hsh(k, seed, 21) % max(1, w - 10)
        crack(c, [(cx, y + 2), (cx + 2, y + 6), (cx + 1, y + 10)], K('conc', 1), K('conc', 5))
    for k in range(max(1, w // 32)):                           # 늘어진 덩굴: 줄기 + 2화소 잎 덩이(좌우 번갈아)
        vx = x + 2 + hsh(k, seed, 31) % max(1, w - 8); ln = 7 + hsh(k, seed, 32) % 10
        for j in range(ln):
            xx = vx + (1 if (j // 4) % 2 else 0)
            c.P(xx, y + j, K('plant', 2))
            if j % 2 == 0:
                sx = xx - 2 if (j // 2) % 2 else xx + 1
                c.P(sx, y + j, K('plant', 5)); c.P(sx + 1, y + j, K('plant', 4)); c.P(sx, y + j + 1, K('plant', 3)); c.P(sx + 1, y + j + 1, K('plant', 2))
        c.P(vx, y + ln, K('plant', 1))


def notch_tops(c, W, nwy, ty, t, seed=0):
    """벽 윗면 띠의 깨진 홈: 북쪽·서쪽·동쪽 벽 윗변 몇 군데를 1~2화소 깎고 깨진 면 빛."""
    for k in range(W // 18):
        x0 = 3 + hsh(k, seed, 41) % max(1, W - 10); ln = 3 + hsh(k, seed, 42) % 5
        for x in range(x0, min(W - 1, x0 + ln)):
            d = 1 + (1 if x - x0 in (1, 2) else 0)
            c.clear(x, nwy, 1, d); c.P(x, nwy + d, K('conc', 6))
    for (wx, s2) in ((0, 1), (W - t, 2)):
        for k in range(max(1, (ty - nwy) // 24)):
            y0 = nwy + 6 + hsh(k, seed + s2, 43) % max(1, ty - nwy - 14)
            for y in range(y0, y0 + 4):
                if wx == 0: c.clear(0, y); c.P(1, y, K('conc', 6))
                else: c.clear(W - 1, y); c.P(W - 2, y, K('conc', 3))


@piece('husk-a', '지붕 없는 콘크리트 폐허', 6, 5, STRUCT, en='roofless ruined concrete building seen from above: broken wall tops, rubble-strewn interior floor, front wall with empty window holes and a dark doorway',
       group='ruins', tags=['폐허', '건물'], desc='지붕이 날아간 콘크리트 건물 껍데기. 안쪽 바닥에 잔해, 앞벽에 빈 창 구멍과 어두운 출입구, 부서진 벽 위로 철근.',
       solid=[(x, y) for y in (3, 4) for x in range(6)], door=(2, 4))
def _husk_a(c):
    # r63 축척: 앞면 34(한 층), 문 11x25, 창 9x9(버들항 자)
    husk(c, 96, 80, 34, seed=3, gaps=[(58, 80, 7)], door=(36, 11, 25), north_gap=(66, 84),
         windows=[(6, 8, 9, 9), (20, 8, 9, 9), (60, 12, 9, 9), (78, 8, 9, 9)], band=(4,))


@piece('husk-b', '모서리 무너진 폐허', 5, 6, STRUCT, en='two-storey ruined concrete building whose front corner has collapsed into a rubble ramp reaching the ground, seen from above: broken wall tops, rubble-strewn interior floor, front face with two rows of empty window holes and a dark doorway',
       group='ruins', tags=['폐허', '건물'], desc='한쪽 앞 모서리(동남)가 무너져 땅까지 잔해 비탈이 된 2층 폐허. 지붕 없는 속 바닥이 보이고, 앞면에 빈 창 두 줄, 문은 왼쪽.',
       solid=[(x, y) for y in (4, 5) for x in range(3)], door=(1, 5))
def _husk_b(c):
    """r65: 5x6(80x96), 보이는 높이 86(주인공 24의 3.6배). 윗면(10~35행): 벽 윗면 밝은 4행 띠 · 북벽 안쪽 3행 그늘 · 속 바닥,
    앞면(36~95행) = 2층 x 30(층 띠 30행), 창 9x9 테 두 줄, 문 11x25. 무너진 동남 모서리는 속 바닥 높이에서 땅까지 잔해 비탈."""
    W, H, t = 80, 96, 4
    oy = 10                                                    # 윗면 시작(위 10행은 비움 — 보이는 높이 86)
    ty = 36                                                    # 남벽 앞면 윗줄(앞면 60행 = 2층 x 30)
    fy0, fy1 = oy + t + 3, ty - t                              # 바닥 행 범위
    # 1) 바닥(먼저, 넓게 — 무너진 모서리 뒤까지)
    ruin_floor(c, t, fy0, W - t, fy1 - fy0 + 2, seed=11)
    for x in range(t, W - t):                                  # 북벽 안쪽 면: 3행 그늘
        c.P(x, oy + t, K('conc', 3 if h2(x, 1, 3) % 5 else 2)); c.P(x, oy + t + 1, K('conc', 2)); c.P(x, oy + t + 2, K('conc', 1 if h2(x, 2, 3) % 4 else 2))
    shade_rect(c, t, fy0, W - 2 * t, 2, 1)
    shade_rect(c, t, fy0, 3, fy1 - fy0, 1)                     # 서벽이 바닥에 던지는 그늘
    # 2) 벽 윗면 띠: 북 · 서 · 동(동벽은 25행에서 부러짐) · 남(서쪽 48화소만)
    top_band(c, 0, oy, W, t, seed=1)
    top_band(c, 0, oy, t, ty - oy, seed=2, vertical=True)
    top_band(c, W - t, oy, t, 15, seed=3, vertical=True)
    top_band(c, 0, ty - t, 48, t, seed=4)
    # 3) 남벽 앞면: 동쪽 끝은 위층에서 안으로, 아래층에서 밖으로 계단처럼 깨진다
    def edge(y):                                               # 앞면 동쪽 끝 열(이 열 미만만 벽)
        return 48 if y < ty + 14 else 50 if y < ty + 26 else 53 if y < ty + 40 else 57
    tall_face(c, 0, ty, 58, H - ty, seed=16)
    for (sy, sh) in ((ty + 1, 1), (ty + 30, 0)):                   # 층 바닥판 턱: 밝은 윗턱 2행 + 어두운 밑면 + 벽에 지는 그늘
        c.HL(0, sy, 58, K('conc', 6)); c.HL(0, sy + 1, 58, K('conc', 5)); c.HL(0, sy + 2, 58, K('conc', 1)); shade_rect(c, 0, sy + 3, 58, 2, 1)
        for x in range(0, 58, 7): c.P(x + h2(x, sy, 3) % 5, sy, K('conc', 4))
    for y in range(ty, H): c.clear(edge(y), y, 58 - edge(y))
    c.HL(0, ty, 48, K('conc', 2))
    for y in range(ty, H):                                     # 깨진 단면(빛 턱 + 그늘)
        e = edge(y)
        c.P(e - 1, y, K('conc', 5)); c.P(e - 2, y, K('conc', 4) if h2(e, y, 5) % 3 else K('conc', 3))
    for y in (ty + 14, ty + 26, ty + 40):                      # 계단 턱 윗면(밝음)
        c.HL(edge(y - 1) - 1, y, edge(y) - edge(y - 1) + 1, K('conc', 6))
    wins = [(5, 10, 9, 10), (19, 10, 9, 10), (34, 10, 9, 10), (5, 41, 9, 10), (34, 41, 9, 10)]
    for k, (wx, wy, ww, wh) in enumerate(wins):
        broken_window(c, wx, ty + wy, ww, wh, seed=k + 1)
    for (wx, wy) in ((19, 10), (34, 41), (5, 10)): soot_plume(c, wx, ty + wy, 9, 4, seed=wx + wy)
    dx, dw, dh = 19, 11, 25
    c.R(dx - 1, H - dh - 2, dw + 2, 2, K('conc', 5)); c.HL(dx - 1, H - dh - 1, dw + 2, K('conc', 2))
    for j in range(dh):
        for i in range(dw): c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
    c.VL(dx, H - dh, dh, K('soot', 1)); c.VL(dx + dw - 1, H - dh, dh, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    c.P(dx + 2, H - dh + 3, K('wood', 2)); c.VL(dx + 1, H - dh + 2, 8, K('wood', 1))           # 떨어진 문짝 경첩 자국
    ivy(c, 45, ty + 4, H - 1, seed=3); ivy(c, 2, ty + 34, H - 1, seed=4)
    # 4) 부러진 벽 끝: 남벽 윗면 동쪽 끝 · 동벽 남쪽 끝
    for (yy, xe) in ((ty - 4, 48), (ty - 3, 49), (ty - 2, 48), (ty - 1, 47)):
        c.P(xe - 1, yy, K('conc', 6)); c.P(xe, yy, K('conc', 4))
    for x in range(W - t, W): c.P(x, oy + 15, K('conc', 7)); c.P(x, oy + 16, K('conc', 4)); c.P(x, oy + 17, K('conc', 2))
    for y in range(oy + 18, ty): c.clear(W - 1, y)
    rebar(c, 48, ty - 4, 5, 2); rebar(c, 77, oy + 15, 4, 1); rebar(c, 78, oy + 14, 3, -1); rebar(c, 52, ty + 26, 4, 2)
    # 5) 무너진 모서리: 벽이 사라진 자리로 아래층 속이 어둡게 드러나고(뒤 벽 안쪽 면 · 부러진 위층 바닥판 단면),
    #    그 앞에 위층 바닥 높이에서 땅까지 흘러내린 잔해 비탈(윗선이 오른쪽 아래로 기운다)
    for y in range(ty - t, H):
        for x in range(edge(y) if y >= ty else 48, W):
            if y < ty - 1: c.P(x, y, K('conc', 2 if h2(x, y, 7) % 4 else 1)); continue      # 부러진 바닥판 두께
            d = (y - ty) / float(H - ty)
            n = h2(x, y, 8) % 7
            if d < 0.12: col = K('soot', 0)                                                 # 바닥판 밑 그늘
            elif d < 0.4: col = K('soot', 1 + (n == 0) + (n == 1 and (x + y) % 3 == 0))       # 아래층 뒤 벽(그을린 면)
            else: col = K('conc', 1 + (n < 2)) if n != 6 else K('soot', 2)                  # 아래층 바닥 잔해(어둡게)
            c.P(x, y, col)
    c.HL(48, ty - t, W - 48, K('conc', 5)); c.HL(48, ty - t + 1, W - 48, K('conc', 3))         # 바닥판 깨진 윗변 빛
    for x in range(48, W, 5): c.clear(x + 2, ty - t); c.P(x + 2, ty - t + 1, K('conc', 4))
    for y in range(ty + 2, ty + 22):                                                           # 드러난 동벽 안쪽 면(남은 벽 그루터기)
        for x in range(W - 3, W):
            c.P(x, y, K('conc', 2 if h2(x, y, 11) % 4 else 1))
        c.P(W - 3, y, K('conc', 4))
    c.R(W - 3, ty + 22, 3, 1, K('conc', 4))
    rebar(c, 58, ty, 5, 2); rebar(c, 66, ty, 4, -1); rebar(c, 72, ty + 1, 5, 1)
    def top_at(x):                                                                             # 비탈 윗선: 벽 끝 높이 → 오른쪽 땅
        u = (x - 46) / float(W - 46)
        return int(ty + 6 + 44 * u ** 1.3 + (h2(x // 2, 1, 5) % 3))
    for x in range(46, W):
        yt = top_at(x)
        for y in range(yt, H):
            v = (y - yt) / max(1.0, float(H - yt))
            tt = 5 if v < 0.06 else 4 if v < 0.3 else 3 if v < 0.65 else 2
            if h2(x, y, 5) % 5 == 0: tt -= 1
            c.P(x, y, K('conc', tt))
        c.P(x, yt, K('conc', 6))
    pts = []
    for k in range(34):
        x = 47 + h2(k, 1, 5) % (W - 51)
        y = top_at(x) + h2(k, 2, 5) % max(1, H - top_at(x) - 4)
        pts.append((y, x, k))
    for (y, x, k) in sorted(pts):
        m = ('conc', 'conc', 'brick', 'conc', 'brick')[h2(k, 3, 5) % 5]
        sz = 3 + h2(k, 4, 5) % 4
        if m == 'brick': c.rows(x, y, ['abbb', 'bccc', 'dddd'], {'a': K('brick', 5), 'b': K('brick', 4), 'c': K('brick', 2), 'd': K('brick', 1)})
        else: chunk5(c, x, y, sz + 1, sz, 'conc', max(2, sz // 2 + 1), 5 + k)
    for (x, y, l, d) in ((52, ty + 12, 5, 1), (60, ty + 26, 4, -1), (70, ty + 40, 4, 2)): rebar(c, x, y, l, d)
    for k in range(5):
        x = 48 + h2(k, 7, 5) % (W - 52); y = top_at(x) + 3 + h2(k, 8, 5) % 10
        if y < H - 1: c.P(x, y, K('glass', 5)); c.P(x + 1, y, K('glass', 3))
    tuft(c, 74, H - 2, 'dry'); tuft(c, 50, H - 1, 'grass'); tuft(c, 62, H - 3, 'grass')
    grit(c, 0, ty, 48, H - ty, seed=17, rate=23, cracks=2)
    c.outline()


def shade_rect(c, x, y, w, h, d=1):
    """이미 칠한 화소를 같은 재질 램프에서 d 단 어둡게(그늘)."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            col = c.get(xx, yy)
            if col is None: continue
            for m in ('dirt', 'conc', 'brick', 'plant', 'dry', 'grass', 'soot', 'glass', 'metal', 'rust', 'wood'):
                r = MAT[m]
                if col in r: c.P(xx, yy, r[max(0, r.index(col) - d)]); break


def top_band(c, x, y, w, h, seed=0, vertical=False):
    """위에서 본 벽 두께(밝은 윗면): 몸 conc 6, 앞(남)·왼 가장자리 빛 7, 뒤 가장자리 5, 오른 가장자리 5, 깨진 흠 몇 개."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            tt = 6
            n = h2(xx, yy, seed) % 17
            if n == 0: tt = 5
            elif n == 1: tt = 7
            c.P(xx, yy, K('conc', tt))
    if vertical:
        c.VL(x, y, h, K('conc', 7)); c.VL(x + w - 1, y, h, K('conc', 5))
    else:
        c.HL(x, y, w, K('conc', 5)); c.HL(x, y + h - 1, w, K('conc', 7))
    for k in range((w * h) // 70):                              # 깨진 홈(작은 어두운 자국 + 빛 턱)
        xx = x + h2(k, 1, seed) % max(1, w - 2); yy = y + h2(k, 2, seed) % max(1, h - 1)
        c.P(xx, yy, K('conc', 4)); c.P(xx + 1, yy, K('conc', 4)); c.P(xx, yy + 1, K('conc', 7))


def ruin_floor(c, x, y, w, h, seed=0):
    """폐허 안 바닥(벽 윗면보다 2~3단 어둡고 따뜻하게): 먼지 흙 + 깨진 바닥 타일(줄눈) + 그을음 + 잔해 + 잡초."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            f = field(xx, yy, seed + 60, 32)
            tile = f < 0.5 and (xx // 6 + yy // 6 + seed) % 5 != 0
            if tile:
                tx, ty_ = xx % 6, yy % 6
                tt = 3 + (1 if ((xx // 6) * 3 + (yy // 6)) % 4 == 0 else 0)
                if (tx == 0 or ty_ == 0) and h2(xx, yy, seed + 9) % 5: tt = 2              # 줄눈(군데군데 끊김)
                elif tx == 1 and ty_ == 1: tt += 1
                elif tx == 5 or ty_ == 5: tt -= 1
                c.P(xx, yy, K('conc', tt))
            else:
                d = dirt_px(xx, yy, seed)
                c.P(xx, yy, d if K('dirt', 6) != d and K('dirt', 7) != d else K('dirt', 5))
    for k in range(3):                                          # 그을음 얼룩(불 탄 자리)
        cx = x + 6 + h2(k, 3, seed) % max(1, w - 12); cy = y + 4 + h2(k, 4, seed) % max(1, h - 8)
        for j in range(-3, 4):
            for i in range(-5, 6):
                if (i / 5.5) ** 2 + (j / 3.5) ** 2 < 1 and h2(cx + i, cy + j, seed) % 3:
                    if c.has(cx + i, cy + j): c.P(cx + i, cy + j, K('soot', 5 if (i / 5.5) ** 2 + (j / 3.5) ** 2 > 0.4 else 4))
    rubble_scatter(c, x + 2, y + 2, w - 4, h - 4, max(4, w * h // 160), seed=seed, shade=K('dirt', 0))
    chunk5(c, x + 10, y + 12, 9, 6, seed=seed + 2)               # 떨어진 큰 판 조각
    chunk5(c, x + 30, y + 6, 6, 5, seed=seed + 3)
    for k, (tx, ty_) in enumerate(((x + 4, y + h - 3), (x + 24, y + 9), (x + 40, y + h - 6), (x + 6, y + 8))):
        tuft(c, tx, ty_, 'grass' if k % 2 == 0 else 'dry', big=(k == 0))


def soot_plume(c, x, y, w, h, seed=0):
    """창 위 그을음: 위로 갈수록 넓고 성긴 연기 자국(이미 칠한 콘크리트 위에만)."""
    for j in range(1, h * 2):
        half = w / 2 + j * 0.35
        for i in range(-3, w + 3):
            if abs(i - (w - 1) / 2) > half: continue
            if j > 2 and h2(x + i, y - j, seed) % (2 + j // 3) != 0: continue
            xx, yy = x + i, y - j
            if c.get(xx, yy) in MAT['conc']:
                c.P(xx, yy, K('soot', 3 if j < 3 else 4 if j < 6 else 5))


def vine(c, x, y, ln, seed=0, mat='plant'):
    """늘어진 덩굴 기둥: 줄기 + 잎 덩이(5단: 그늘 2 · 몸 3·4 · 빛 6 · 끝 7), 아래로 갈수록 성기다."""
    for j in range(ln):
        xx = x + (1 if (j // 4 + seed) % 2 else 0)
        c.P(xx, y + j, K(mat, 2))
        if j % 2 == 0 and h2(j, seed, 1) % 5 != 0:
            sx = xx - 2 if (j // 2 + seed) % 2 else xx + 1
            c.P(sx, y + j, K(mat, 6)); c.P(sx + 1, y + j, K(mat, 4)); c.P(sx, y + j + 1, K(mat, 4)); c.P(sx + 1, y + j + 1, K(mat, 2))
            if j < ln // 2: c.P(sx, y + j - 1, K(mat, 7))


def rubble_slope(c, x0, x1, ytop, ybot, seed=0):
    """무너진 모서리 잔해 비탈: 윗변 들쭉날쭉한 더미 몸(위 밝고 아래 어둡게) + 큰 덩이들(5단) + 벽돌 + 철근 + 유리."""
    def top_at(x):
        u = (x - x0) / max(1, x1 - x0)
        return int(ytop + 10 * (1 - u) ** 2 + 4 * u + (h2(x // 2, 1, seed) % 3))
    for x in range(x0, x1):
        yt = top_at(x)
        for y in range(yt, ybot):
            v = (y - yt) / max(1, ybot - yt)
            tt = 4 if v < 0.15 else 3 if v < 0.5 else 2 if v < 0.85 else 1
            if h2(x, y, seed) % 5 == 0: tt -= 1
            c.P(x, y, K('conc', tt))
        c.P(x, yt, K('conc', 6))
    pts = []
    for k in range(26):
        x = x0 + 1 + h2(k, 1, seed) % max(1, x1 - x0 - 5)
        y = top_at(x) + 1 + h2(k, 2, seed) % max(1, ybot - top_at(x) - 5)
        pts.append((y, x, k))
    for (y, x, k) in sorted(pts):
        m = ('conc', 'conc', 'brick', 'conc')[h2(k, 3, seed) % 4]
        s = 3 + h2(k, 4, seed) % 4
        if m == 'brick':
            c.rows(x, y, ['abbb', 'bccc', 'dddd'], {'a': K('brick', 5), 'b': K('brick', 4), 'c': K('brick', 2), 'd': K('brick', 1)})
        else:
            chunk5(c, x, y, s + 1, s, 'conc', max(2, s // 2 + 1), seed + k)
    for (x, y, l, d) in ((x0 + 8, ytop + 12, 4, 1), (x0 + 20, ytop + 9, 5, -1), (x0 + 14, ybot - 10, 3, 2)): rebar(c, x, y, l, d)
    for k in range(4):
        x = x0 + 3 + h2(k, 7, seed) % max(1, x1 - x0 - 6); y = top_at(x) + 4 + h2(k, 8, seed) % 12
        c.P(x, y, K('glass', 5)); c.P(x + 1, y, K('glass', 3))
    tuft(c, x0 + 26, ybot - 2, 'dry'); tuft(c, x0 + 4, ybot - 1, 'grass')


@piece('husk-tall', '층 남은 고층 폐허 정면', 4, 8, STRUCT, en='tall ruined multi-storey concrete facade remnant: top of the remaining walls and broken upper floor slabs seen from above, tall front face with rows of empty windows',
       group='ruins', tags=['폐허', '건물', '고층'], desc='지붕이 사라진 여러 층 건물의 남은 정면. 위로 부러진 층 바닥판과 벽 윗면이 보이고, 높은 앞면에 빈 창 줄.',
       solid=[(x, y) for y in (6, 7) for x in range(4)], door=(1, 7))
def _husk_tall(c):
    """4판: 층마다 튀어나온 바닥판 모서리(밝은 윗턱 2행 + 어두운 밑면 + 벽에 지는 그늘), 5단 담쟁이 기둥 둘, 창 위 그을음,
    깨진 창틀·유리 조각, 창턱 아래 빗물 자국·녹물 줄 — 고른 잔점 대신 넓은 얼룩. 윗부분은 벽 윗면 띠 + 깊은 속(무너진 바닥판)."""
    W, H = 64, 128                                              # r63 축척: 3층 x 30화소(버들항 자), 문 11x25, 창 9x10
    ty = 38                                                     # 앞면 윗줄
    # --- 윗면: 깊은 속(아래층 바닥이 어둡게) + 걸친 바닥판 + 벽 윗면 띠
    ruin_floor(c, 4, 8, W - 8, ty - 12, seed=21)
    shade_rect(c, 4, 8, W - 8, ty - 12, 2)
    for x in range(4, W - 4):                                   # 북벽 안쪽 면 4행(그늘, 아래로 짙게)
        for j, tt in enumerate((3, 3, 2, 1)): c.P(x, 5 + j, K('conc', tt - (1 if h2(x, j, 7) % 6 == 0 else 0)))
    for (x, y, w) in ((4, 12, 22), (38, 18, 22)):               # 부러진 위층 바닥판: 윗면 4행 + 두께 2행 + 아래 그늘
        top_band(c, x, y, w, 4, seed=x)
        c.R(x, y + 4, w, 2, K('conc', 2)); c.HL(x, y + 5, w, K('conc', 1)); shade_rect(c, x, y + 6, w, 2, 1)
        e = x + w - 1 if x < 30 else x
        for j in range(6): c.clear(e, y + j) if (j + x) % 3 == 0 else c.P(e, y + j, K('conc', 4))
        rebar(c, e + (1 if x < 30 else -1), y + 3, 4, 2 if x < 30 else -2)
    top_band(c, 0, 1, W, 4, seed=31)
    top_band(c, 0, 1, 4, ty, seed=32, vertical=True)
    top_band(c, W - 4, 1, 4, ty, seed=33, vertical=True)
    top_band(c, 0, ty - 4, W, 4, seed=34)
    for x in (10, 11, 12, 30, 31, 46, 47, 48, 49): c.clear(x, 1); c.P(x, 2, K('conc', 7))      # 깨진 윗변
    # --- 앞면: 열 1~62(바닥판은 0~63 으로 1화소 튀어나옴)
    c.clear(0, ty, 1, H - ty); c.clear(W - 1, ty, 1, H - ty)
    tall_face(c, 1, ty, W - 2, H - ty, seed=21)
    slabs = (67, 97)
    wins = [(5, 47), (20, 47), (49, 47), (5, 78), (35, 78), (49, 78), (5, 108), (44, 108)]
    for k, (wx, wy) in enumerate(wins): broken_window(c, wx, wy, 9, 10, seed=k)
    for (wx, wy) in ((20, 47), (35, 78), (5, 108)): soot_plume(c, wx, wy, 9, 5, seed=wx + wy)
    big_hole = (34, 47, 11, 9)                                  # 포탄에 뚫린 큰 구멍(속에 걸린 철근)
    hx, hy, hw, hh = big_hole
    for j in range(hh):
        for i in range(hw):
            l = [3, 1, 0, 0, 1, 0, 2, 1, 4][j]; r = [2, 0, 1, 0, 0, 2, 1, 3, 5][j]       # 들쭉날쭉 깨진 가장자리(둥글지 않게)
            if l <= i < hw - r:
                c.P(hx + i, hy + j, K('soot', 0 if j < hh - 3 else 1))
            elif (i == l - 1 or i == hw - r) and 0 <= i < hw: c.P(hx + i, hy + j, K('conc', 5 if i < hw // 2 else 2))
    for i in range(hw): 
        if c.get(hx + i, hy + hh - 1) == K('soot', 1): c.P(hx + i, hy + hh - 1, K('conc', 5))
    rebar(c, hx + 3, hy + 5, 4, 2); rebar(c, hx + 7, hy + 6, 3, -1)
    for sy in slabs:                                            # 층 바닥판 모서리: 윗턱 2행(빛) + 앞 두께 1행 + 밑면 그늘 + 벽에 지는 그늘
        for x in range(W):
            c.P(x, sy, K('conc', 7 if h2(x, sy, 1) % 9 else 6)); c.P(x, sy + 1, K('conc', 6))
            c.P(x, sy + 2, K('conc', 3)); c.P(x, sy + 3, K('conc', 1))
        shade_rect(c, 1, sy + 4, W - 2, 1, 2); shade_rect(c, 1, sy + 5, W - 2, 1, 1)
        for x in range(3, W - 3, 11):                           # 판 밑 녹물 줄
            for j in range(4, 9 + h2(x, sy, 2) % 6):
                if c.get(x, sy + j) in MAT['conc']: c.P(x, sy + j, K('brust', 4 if j < 6 else 5))
        for x in (17, 18, 44): c.clear(x, sy); c.P(x, sy + 1, K('conc', 7))       # 깨진 턱
    # 출입구(1층) + 상인방
    dx, dw, dh = 20, 11, 25
    c.R(dx - 1, H - dh - 2, dw + 2, 2, K('conc', 6)); c.HL(dx - 1, H - dh - 1, dw + 2, K('conc', 2))
    for j in range(dh):
        for i in range(dw): c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
    c.VL(dx, H - dh, dh, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    c.R(dx + 7, H - dh + 2, 3, dh - 2, K('wood', 2)); c.VL(dx + 7, H - dh + 2, dh - 2, K('wood', 4)); c.P(dx + 7, H - dh + 2, K('wood', 5))   # 떨어져 기운 문짝 쪽
    # 담쟁이 두 기둥(땅에서 위로, 아래 빽빽 · 위 성김)
    ivy(c, 15, ty + 4, H - 1, seed=3)
    ivy(c, 58, slabs[0] + 6, H - 1, seed=8)
    # 홈통 + 실외기
    for y in range(ty + 2, H - 2):
        if c.get(61, y) in MAT['conc'] or c.get(61, y) in MAT['brust']: c.P(61, y, K('metal', 4)); c.P(62, y, K('metal', 2))
    ax, ay = 34, 120
    c.R(ax, ay, 7, 5, K('metal', 3)); c.HL(ax, ay, 7, K('metal', 6)); c.HL(ax, ay + 1, 7, K('metal', 5)); c.VL(ax + 6, ay + 1, 4, K('metal', 1)); c.P(ax + 2, ay + 3, K('soot', 0)); c.P(ax + 3, ay + 3, K('soot', 1))
    c.outline()


def tall_face(c, x, y, w, h, seed=0):
    """고층 앞면 콘크리트: 넓은 얼룩(저주파 ±1, 잔점 없음) · 판 이음(세로 줄 성기게) · 아래 습기 때 · 회반죽이 떨어져 드러난 벽돌 두 곳."""
    for j in range(h):
        for i in range(w):
            xx, yy = x + i, y + j
            f = vnoise(xx, yy, seed + 40, 8, 64)
            g = vnoise(xx, yy, seed + 41, 4, 64)
            tt = 4 if f > 0.62 else 2 if f < 0.3 else 3
            if g > 0.8 and tt < 4: tt += 1
            if i == 0: tt = min(tt + 1, 5)
            if i == w - 1: tt = max(tt - 1, 1)
            if j >= h - 4: tt = 2 if j < h - 1 else 1
            c.P(xx, yy, K('conc', tt))
    for i in range(0, w, 16): c.VL(x + i + 7, y, h, K('conc', 2)) if h2(i, seed, 1) % 2 else None
    for (bx, by, bw, bh) in ((x + 26, y + 26, 8, 5), (x + 2, y + 50, 9, 4)):
        for j in range(bh):
            for i in range(bw):
                if (i in (0, bw - 1)) and (j in (0, bh - 1)): continue
                mortar = (j % 2 == 1) or ((i + (j // 2) * 2) % 4 == 0)
                c.P(bx + i, by + j, K('brick', 1 if mortar else 3 + (1 if h2(bx + i, by + j, 7) % 4 == 0 else 0)))
        c.HL(bx + 1, by - 1, bw - 2, K('conc', 5)); c.HL(bx + 1, by + bh, bw - 2, K('conc', 2))


def broken_window(c, x, y, w, h, seed=0):
    """깨진 창: 어두운 속 + 남은 녹슨 창틀(왼·위 빛) · 부러진 창살 · 구석 유리 조각 · 창턱 빛 + 아래 빗물 자국."""
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + j, K('soot', 0 if j < h - 3 else 1))
    c.HL(x, y + h - 1, w, K('soot', 2))
    kind = seed % 4
    fr = 'rust' if seed % 2 else 'wood'
    c.HL(x, y, w, K(fr, 4)); c.VL(x, y, h, K(fr, 4)); c.VL(x + w - 1, y, h, K(fr, 1))
    if kind == 0: c.VL(x + w // 2, y, h, K(fr, 3))                       # 남은 창살
    elif kind == 1: c.line(x + 1, y + h - 2, x + w - 3, y + 2, K(fr, 3))  # 기운 창살
    elif kind == 2: c.VL(x + w // 2, y, h // 2, K(fr, 3)); c.P(x + w // 2, y + h // 2, K(fr, 5))
    else: c.HL(x, y, w, K('soot', 0)); c.P(x + 2, y, K(fr, 4))           # 틀이 떨어짐
    c.P(x + 1, y + 1, K('glass', 5)); c.P(x + 2, y + 1, K('glass', 3)); c.P(x + 1, y + 2, K('glass', 3))
    if kind in (0, 3): c.P(x + w - 2, y + h - 2, K('glass', 4)); c.P(x + w - 3, y + h - 2, K('glass', 2))
    c.HL(x - 1, y + h, w + 2, K('conc', 6)); c.HL(x, y + h + 1, w, K('conc', 2))
    for (sx, ln) in ((x, 3 + seed % 4), (x + w - 1, 2 + (seed * 3) % 5)):
        for j in range(2, 2 + ln):
            if c.get(sx, y + h + j) in MAT['conc']: c.P(sx, y + h + j, K('conc', 2 if j < 4 else 3))


def ivy(c, x, y0, y1, seed=0):
    """담쟁이 기둥(땅 y1 에서 위 y0 로): 굽이치는 줄기 + 잎 덩이 5단(어둠 1 · 그늘 3 · 몸 5 · 빛 7 · 끝 8), 아래 빽빽 위 성김."""
    G = [K('plant', 1), K('plant', 3), K('plant', 5), K('plant', 7), K('plant', 8)]
    for y in range(y1, y0 - 1, -1):
        u = (y1 - y) / max(1, y1 - y0)                          # 0 아래 … 1 위
        cx = x + int(round(1.5 * ((((y // 5) + seed) % 4) - 1.5) / 1.5))
        c.P(cx, y, G[0] if y % 3 else G[1])
        half = 3 if u < 0.35 else 2 if u < 0.75 else 1
        for i in range(-half, half + 1):
            if h2(cx + i, y, seed) % (3 if u < 0.5 else 5) == 0:
                xx = cx + i
                c.P(xx, y, G[2]); c.P(xx - 1, y, G[3]) if h2(xx, y, seed + 1) % 2 else None
                c.P(xx, y - 1, G[3]); c.P(xx - 1, y - 1, G[4]) if h2(xx, y, seed + 2) % 3 == 0 else None
                c.P(xx + 1, y, G[1]); c.P(xx, y + 1, G[1]) if c.get(xx, y + 1) not in G else None


# ------------------------------------------------------------------ 벽
def wall_block(c, x, y, w, top, front, seed=0, left_break=True, right_break=True):
    """서 있는 벽 토막: 윗면 top 행 + 앞면 front 행, 양 끝이 계단식으로 부서진다."""
    conc_top(c, x, y, w, top, seed)
    conc_face(c, x, y + top, w, front, seed + 1, base=3, band=(front // 2,))
    c.HL(x, y + top, w, K('conc', 2))
    steps = [(0, 5), (3, 3), (6, 1)]
    for side, on in ((0, left_break), (1, right_break)):
        if not on: continue
        for (dx, dy) in steps:
            for xx in range(dx, dx + 3):
                X = x + xx if side == 0 else x + w - 1 - xx
                for yy in range(y, y + dy + 2):
                    c.clear(X, yy)
                c.P(X, y + dy + 2, K('conc', 5)); c.P(X, y + dy + 3, K('conc', 4))
        X = x + 2 if side == 0 else x + w - 3
        rebar(c, X, y + 6, 4, 1 if side == 0 else -1)


@piece('wall-h', '무너진 벽 토막 (가로)', 3, 2, STRUCT, en='freestanding collapsed concrete wall segment running east-west, top of the wall seen from above, broken stepped ends with rebar, front face below',
       group='ruins', tags=['벽', '폐허'], desc='가로로 선 무너진 벽 토막. 양 끝이 계단처럼 부서지고 철근이 솟는다.', solid=[(0, 1), (1, 1), (2, 1)])
def _wall_h(c):
    wall_block(c, 1, 6, 46, 7, 18, seed=4)
    c.P(10, 22, K('soot', 1)); c.R(18, 17, 8, 5, K('soot', 1)); c.HL(18, 22, 8, K('conc', 6))     # 총탄 자국 + 구멍
    for j in range(5):                                                                            # 드러난 벽돌
        for i in range(10):
            mortar = (j % 2 == 1) or ((i + (j // 2) * 2) % 4 == 0)
            c.P(30 + i, 20 + j, K('brick', 1 if mortar else 3 + (1 if h2(i, j, 3) % 4 == 0 else 0)))
    c.HL(30, 19, 10, K('conc', 6))
    for j in range(9): c.P(5 + (j // 3) % 2, 13 + j, K('plant', 3)); c.P(6, 13 + j, K('plant', 5)) if j % 2 else None   # 덩굴
    for (x, y) in ((8, 19), (30, 21), (33, 18), (12, 24)): c.P(x, y, K('conc', 1))
    mound(c, 6, 31, 6, 3, seed=2); mound(c, 41, 31, 6, 3, seed=8)
    grit(c, 0, 0, 48, 32, seed=29, rate=19, cracks=3)
    c.outline()


@piece('wall-v', '무너진 벽 줄 (세로)', 1, 3, STRUCT, en='broken concrete wall running north-south seen from above: three stepped wall blocks receding north, each showing its top surface and short south face, with rebar and weeds',
       group='ruins', tags=['벽', '폐허'], desc='남북으로 뻗은 무너진 벽(부서진 토막 셋이 북쪽으로 이어진다). 맨 아래가 벽 끝 앞면.', solid=[(0, 0), (0, 1), (0, 2)])
def _wall_v(c):
    x, w = 2, 12
    c.shadow([(x + w + 1, y) for y in range(2, 46)] + [(x + w, y) for y in range(46, 48)])
    for k, (y0, top, fr, dx) in enumerate(((0, 10, 5, 1), (13, 11, 5, 0), (27, 12, 8, 0))):    # 뒤 → 앞(앞 토막이 뒤 토막의 끝면을 덮는다)
        conc_top(c, x + dx, y0, w - dx, top, seed=40 + k)
        c.VL(x + dx, y0, top, K('conc', 6)); c.VL(x + w - 1, y0, top, K('conc', 4))
        conc_face(c, x + dx, y0 + top, w - dx, fr, seed=44 + k, base=3, grime=1)
        c.HL(x + dx, y0 + top, w - dx, K('conc', 2)); c.VL(x + w - 1, y0 + top, fr, K('conc', 1))
        for (cx0, d) in ((x + dx + 2 + k, 2), (x + w - 4, 1)):                                    # 깨진 윗변 홈
            c.HL(cx0, y0, 3, K('conc', 2)); c.HL(cx0, y0 + 1, 3, K('conc', 6)) if d > 1 else None
    rebar(c, x + 8, 12, 4, 1); rebar(c, x + 3, 26, 3, -1)
    chunk5(c, x + 6, 32, 4, 3, 'conc', 2, seed=3); tuft(c, x + 2, 22, 'grass'); tuft(c, x + 9, 9, 'dry')
    grit(c, x, 0, w + 1, 48, seed=19, rate=19)
    c.outline()


@piece('wall-stub', '벽 그루터기', 1, 2, STRUCT, en='short broken concrete wall stub: thick top surface seen from above and front face, rebar sticking out',
       group='ruins', tags=['벽', '폐허'], desc='짧게 남은 벽 그루터기.', solid=[(0, 1)])
def _wall_stub(c):
    wall_block(c, 1, 8, 14, 7, 15, seed=12, left_break=False, right_break=True)
    mound(c, 8, 31, 7, 2, seed=3)
    c.outline()


# ------------------------------------------------------------------ 판잣집
def tin_roof(c, x, y, w, h, ins=3, seed=0, patches=(), mat='metal'):
    """골강판 지붕 윗면(사다리꼴: 뒤가 좁다): 가로 판 몇 장(판마다 단 차이·이음 그늘), 세로 골, 덧댄 판 patches=[(x,y,w,h,mat)], 못·녹 흐름."""
    rows = []
    for r in range(h):
        l = int(round(ins * (1 - r / max(1, h - 1)))); rows.append((x + l, x + w - l))
    # 판 경계(가로): 위에서 아래로 판 높이 6~7
    sheet_of = lambda r: r // 7
    for r, (xs, xe) in enumerate(rows):
        sh = sheet_of(r); bt = 4 + (hsh(sh, seed, 1) % 2) - (1 if r < 2 else 0)
        for xx in range(xs, xe):
            k = (xx - x) % 3
            t = bt + (1 if k == 0 else -1 if k == 2 else 0)
            if xx - xs < 1: t += 1
            if xe - 1 - xx < 1: t -= 1
            c.P(xx, y + r, K(mat, t))
        if r % 7 == 6: c.HL(xs, y + r, xe - xs, K(mat, 2))                  # 겹친 판 그늘
        if r % 7 == 0 and r: c.HL(xs, y + r, xe - xs, K(mat, 6))           # 판 끝 빛
    rust_patch(c, x, y, w, h, seed=seed + 4, dens=0.38, on=set(MAT['metal']))
    for (px, py, pw, ph, pm) in patches:
        for j in range(ph):
            for i in range(pw):
                if c.has(x + px + i, y + py + j):
                    if pm == 'tarp': t = 3 + (1 if j == 0 else 0) - (1 if (i + j * 2) % 7 == 0 else 0)
                    elif pm == 'rust': t = 3 + (1 if (i % 3) == 0 else -1 if i % 3 == 2 else 0)
                    else: t = 3 + (1 if i % 3 == 0 else 0)
                    c.P(x + px + i, y + py + j, K(pm, t))
        c.HL(x + px, y + py + ph, pw, K(pm, 1)); c.VL(x + px + pw, y + py, ph, K(pm, 1))
        c.P(x + px, y + py, K('metal', 6)); c.P(x + px + pw - 1, y + py, K('metal', 6))
    c.HL(x, y + h - 1, w, K(mat, 6))                                          # 처마 앞 턱(빛)
    c.HL(x, y + h, w, K(mat, 1))                                              # 처마 밑 두께


def scrap_wall(c, x, y, w, h, seed=0):
    """고철 판 벽 앞면: 세로 골강판·녹 판·판자 판을 섞어 붙이고, 이음마다 그늘, 위 처마 그늘, 아래 때."""
    i = 0; k = 0
    while i < w:
        pw = 6 + hsh(k, seed, 1) % 6
        pw = min(pw, w - i)
        kind = ('metal', 'rust', 'metal', 'wood', 'blue', 'metal')[hsh(k, seed, 2) % 6]
        if kind == 'wood': planks(c, x + i, y, pw, h, 'wood', 2, pw=3, seed=seed + k, nails=False)
        else: corrugated(c, x + i, y, pw, h, kind, base=3 if kind != 'metal' else 3, pitch=3, seed=seed + k)
        c.VL(x + i, y, h, K('metal', 1) if kind != 'wood' else K('wood', 0))
        for j in range(2, h - 2, 6): c.P(x + i + 1, y + j, K('metal', 6))             # 리벳
        i += pw; k += 1
    rust_patch(c, x, y + h // 2, w, h - h // 2, seed=seed + 7, dens=0.3, on=set(MAT['metal']) | set(MAT['blue']))
    c.HL(x, y, w, K('soot', 1)); c.HL(x, y + 1, w, K('soot', 3))             # 처마 그늘
    c.HL(x, y + h - 1, w, K('dirt', 1))


def plank_door(c, x, y, w, h, seed=0, ajar=False):
    planks(c, x, y, w, h, 'wood', 3, pw=3, seed=seed)
    c.HL(x, y + 2, w, K('wood', 1)); c.HL(x, y + h - 4, w, K('wood', 1))      # 띠장
    c.line(x, y + h - 4, x + w - 1, y + 2, K('wood', 1))                      # 사선 빗장
    c.P(x + w - 2, y + h // 2, K('metal', 6))                                 # 손잡이
    c.VL(x - 1, y, h, K('wood', 0)); c.VL(x + w, y, h, K('wood', 0)); c.HL(x - 1, y - 1, w + 2, K('wood', 0))
    if ajar: c.R(x + w - 3, y, 3, h, K('soot', 0)); c.VL(x + w - 4, y, h, K('wood', 4))


# ---- WA1 r64: shack-a 전용 재질 도구(재질마다 5~6단: 겹친 윗변 빛 테 · 골 마루 · 빛 비탈 · 몸 · 골 · 겹침 그늘)
def wa_roof(c, x, y, w, h, ins=3, seed=0, sheets=()):
    """골강판 지붕 윗면(사다리꼴, 뒤가 좁다): 판 sheets=[(sx,sy,sw,sh,mat,base)…] — 판마다 겹친 윗변 빛 테(base+3)·세로 골(마루 +2·빛 비탈 +1·몸·골 -1)·
    아랫변 겹침 그늘(base-2)·오른변 그늘·왼변 빛, 뒤쪽 1/4 한 단 어둡게, 윗변 못과 못에서 흘러내린 녹 줄. 처마 앞 빛 턱 + 처마 두께 1행."""
    def span(r): l = int(round(ins * (1 - r / max(1, h - 1)))); return l, w - l
    for n, (sx, sy, sw, sh, m, b) in enumerate(sheets):
        for j in range(sh):
            r = sy + j
            if r >= h: break
            l, rr = span(r)
            for i in range(sw):
                xx = sx + i
                if xx < l or xx >= rr: continue
                k = (i + n) % 4
                t = b + (2 if k == 0 else 1 if k == 1 else 0 if k == 2 else -1)
                if r < h // 4: t -= 1
                v = hsh(x + xx, y + r, seed + n) % 23
                if v == 0: t -= 1
                elif v == 1: t += 1
                if j == 0: t = b + 3 if k != 3 else b + 2
                elif j == sh - 1: t = b - 2
                elif i == sw - 1: t = min(t, b - 1)
                elif i == 0: t = max(t, b + 1)
                c.P(x + xx, y + r, K(m, t))
        if m in ('metal', 'blue'):
            for i in range(2, sw - 1, 5):
                l, rr = span(sy + 1)
                if not (l <= sx + i < rr): continue
                px, py = x + sx + i, y + sy + 1
                c.P(px, py, K('metal', 7)); c.P(px, py + 1, K('metal', 1))
                ln = 2 + hsh(px, py, seed + 3) % 5
                for d in range(ln):
                    if sy + 3 + d < min(h, sy + sh - 1): c.P(px, py + 2 + d, K('rust', 3 if d < ln - 2 else 2))
    l, rr = span(h - 1)
    c.HL(x + l, y + h - 1, rr - l, K('metal', 6))
    for i in range(w): c.P(x + i, y + h, K('metal', 2 if (i % 4) else 1))


def wa_tarp(c, x, y, w, h, seed=0):
    """덧댄 방수포(비뚤어진 사각): 위 행 밝고 아래로 어두워짐, 사선 주름 빛/그늘, 왼변 박음질, 오른변·아랫변 그늘, 밑 판 위 그림자."""
    for j in range(h):
        o = j // 3
        for i in range(w):
            t = 5 if j == 0 else 4 if j < h // 2 else 3
            f = (i + j * 2 + seed) % 9
            if f == 0: t += 1
            elif f == 1: t -= 1
            if i == w - 1: t -= 1
            if j == h - 1: t = 2
            c.P(x + i + o, y + j, K('tarp', t))
        c.P(x + o, y + j, K('tarp', 6) if j % 2 == 0 else K('tarp', 4))
    shade_rect(c, x + (h - 1) // 3 + 1, y + h, w, 1, d=2)


def wa_wall(c, x, y, w, h, seed=0, sheets=()):
    """고철 판 앞벽: 세로 판 sheets=[(pw,mat,base)…] — 골(마루 +2·빛 비탈 +1·몸·골 -1), 몇 판은 가로 겹침 이음(빛 줄 + 그늘 줄),
    판 이음 어둠, 처마 밑 3행 그늘, 리벳(빛 + 녹 그늘)과 흘러내린 녹 줄, 아래쪽 녹 얼룩, 땅에서 튄 흙."""
    i0 = 0
    for n, (pw, m, b) in enumerate(sheets):
        pw = min(pw, w - i0)
        lap = (h // 2 + hsh(n, seed, 5) % 7 - 3) if (m != 'wood' and n % 2) else -9
        for j in range(h):
            for i in range(pw):
                xx, yy = x + i0 + i, y + j
                if m == 'wood':
                    k = i % 4; pb = b + (hsh(i // 4 + n, seed, 3) % 3) - 1
                    t = pb + (1 if k == 1 else -1 if k == 3 else 0)
                    if hsh(i // 4, j // 2, seed + n) % 13 == 0 and 0 < k < 3: t -= 1
                    if k == 0: t = 0
                else:
                    k = (i + n) % 4
                    t = b + (2 if k == 0 else 1 if k == 1 else 0 if k == 2 else -1)
                    v = hsh(xx, yy, seed) % 29
                    if v == 0: t -= 1
                    elif v == 1: t += 1
                    if j == lap: t = b + 3
                    elif j == lap + 1: t = b - 2
                    if i == 0: t = b - 3
                if j < 3: t -= 3 - j
                c.P(xx, yy, K(m, t))
        if m != 'wood':
            for j in range(4, h - 5, 7):
                px, py = x + i0 + 2, y + j
                c.P(px, py, K('metal', 7)); c.P(px, py + 1, K('rust', 1))
                if hsh(px, py, seed) % 2:
                    for d in range(2, 5 + hsh(px, py, seed + 1) % 5): c.P(px, py + d, K('rust', 3 if d < 4 else 2))
        i0 += pw
    rust_patch(c, x, y + h // 2, w, h - h // 2, seed=seed + 7, dens=0.24, on=set(MAT['metal']) | set(MAT['blue']))
    for i in range(w):
        for j in range(4):
            if hsh(x + i, j, seed + 11) % (j + 2) == 0: c.P(x + i, y + h - 2 - j, K('brust', 2 + j))
    c.HL(x, y + h - 1, w, K('dirt', 1))


def wa_door(c, x, y, w, h, seed=0):
    """판자 문: 판마다 빛 왼줄·몸·그늘 오른줄, 결, 띠장 둘(윗면 빛 + 그늘), 사선 빗장(빛 줄 위·그늘 줄 아래), 못, 손잡이, 문틀·상인방."""
    for i in range(w):
        k = i % 3; pb = 2 + (hsh(i // 3, seed, 2) % 2)
        for j in range(h):
            t = pb + (1 if k == 0 else 0 if k == 1 else -1)
            if hsh(i // 3, j // 2, seed + 5) % 9 == 0 and k == 1: t -= 1
            if j < 2: t -= 2 - j
            c.P(x + i, y + j, K('wood', t))
    for yy in (y + 3, y + h - 7):
        c.HL(x, yy, w, K('wood', 4)); c.HL(x, yy + 1, w, K('wood', 3)); c.HL(x, yy + 2, w, K('wood', 0))
    c.line(x, y + h - 7, x + w - 1, y + 6, K('wood', 0)); c.line(x, y + h - 8, x + w - 1, y + 5, K('wood', 4))
    for yy in (y + 4, y + h - 6): c.P(x + 1, yy, K('metal', 7)); c.P(x + w - 2, yy, K('metal', 7))
    c.P(x + w - 2, y + h // 2, K('metal', 6)); c.P(x + w - 2, y + h // 2 + 1, K('metal', 2))
    c.VL(x - 1, y, h, K('wood', 0)); c.VL(x + w, y, h, K('wood', 0)); c.HL(x - 1, y - 1, w + 2, K('wood', 1)); c.HL(x - 1, y - 2, w + 2, K('wood', 4))


@piece('shack-a', '고철 판잣집', 4, 5, STRUCT, en='small scrap-metal shack: patched corrugated sheet roof seen from above as a sloped top plane, front wall of mixed scrap sheets with a plank door',
       group='shacks', tags=['판잣집', '건물'], desc='골강판 지붕을 여러 금속으로 덧댄 작은 판잣집. 앞벽은 고철 판, 가운데 판자 문.',
       solid=[(cx, cy) for cy in (1, 2, 3, 4) for cx in range(4)], door=(1, 4))
def _shack_a(c):
    """r64 축척(버들항 작은 오두막 64×66 에 맞춤): 지붕 윗면 31행 + 처마 두께, 앞벽 34(처마 밑~땅), 판자 문 11×26, 판자 막은 창 10×10."""
    wa_roof(c, 1, 12, 62, 31, ins=4, seed=4, sheets=[
        (0, 0, 22, 8, 'metal', 3), (22, 0, 16, 8, 'rust', 3), (38, 0, 24, 8, 'metal', 3),
        (0, 8, 14, 8, 'metal', 4), (14, 8, 22, 8, 'metal', 3), (36, 8, 26, 8, 'blue', 3),
        (0, 16, 20, 8, 'rust', 3), (20, 16, 20, 8, 'metal', 4), (40, 16, 22, 8, 'metal', 3),
        (0, 24, 26, 7, 'metal', 3), (26, 24, 14, 7, 'brust', 4), (40, 24, 22, 7, 'metal', 4)])
    rust_patch(c, 1, 12, 62, 31, seed=6, dens=0.16, on=set(MAT['metal']))
    wa_tarp(c, 30, 20, 14, 8, seed=3)
    c.ell(37, 23, 3, 2, K('rubber', 2)); c.ell(37, 23, 2, 1, K('rubber', 4)); c.P(37, 23, K('rubber', 0)); c.HL(35, 21, 4, K('rubber', 6)); c.HL(34, 25, 7, K('rubber', 1))   # 누르는 타이어
    for (bx, by) in ((8, 33), (52, 14)):                                                                                                     # 누르는 벽돌
        c.R(bx, by, 4, 2, K('brick', 4)); c.HL(bx, by, 4, K('brick', 5)); c.HL(bx, by + 2, 4, K('brick', 1)); c.P(bx + 3, by + 1, K('brick', 2))
    wa_wall(c, 2, 44, 60, 34, seed=5, sheets=[(10, 'metal', 3), (9, 'rust', 3), (12, 'wood', 3), (10, 'blue', 3), (9, 'metal', 3), (10, 'rust', 3)])
    wa_door(c, 26, 52, 11, 26, seed=2)
    # 작은 창(판자 십자): 쇠 테(위·왼 빛, 아래·오른 그늘) + 어둠 10×10 + 판자 십자 + 창턱
    c.R(44, 51, 12, 12, K('metal', 4)); c.HL(44, 51, 12, K('metal', 6)); c.VL(44, 51, 12, K('metal', 5)); c.HL(44, 62, 12, K('metal', 2)); c.VL(55, 51, 12, K('metal', 2))
    c.R(45, 52, 10, 10, K('soot', 0)); c.HL(45, 52, 10, K('soot', 2)); c.P(47, 54, K('glass', 4)); c.P(48, 54, K('glass', 3))
    c.HL(45, 56, 10, K('wood', 4)); c.HL(45, 57, 10, K('wood', 2)); c.VL(49, 52, 10, K('wood', 3)); c.VL(50, 52, 10, K('wood', 1))
    c.HL(43, 63, 14, K('wood', 4)); c.HL(43, 64, 14, K('wood', 1))
    # 기댄 녹 판(왼쪽 앞): 윗변 빛, 세로 골, 아래로 어두워짐, 오른변 그늘
    for j in range(16):
        for i in range(8):
            k = i % 3
            t = 3 + (1 if k == 0 else -1 if k == 2 else 0) - (1 if j > 11 else 0)
            if j == 0: t = 5
            c.P(5 + i, 62 + j, K('rust', t))
        c.P(12, 62 + j, K('rust', 1))
    c.outline()


@piece('shack-b', '큰 판잣집', 5, 5, STRUCT, en='larger scrap-metal shack seen from above: patched corrugated roof with a tarp patch and a stovepipe chimney, scrap front wall with plank door and boarded window',
       group='shacks', tags=['판잣집', '건물'], desc='연통과 방수포를 덧댄 큰 판잣집. 앞벽에 판자 문과 판자로 막은 창.',
       solid=[(cx, cy) for cy in (2, 3, 4) for cx in range(5)], door=(3, 4))
def _shack_b(c):
    """r64 축척(버들항 헛간 snowfield-shed 82 에 맞춤): 지붕 윗면 34행, 앞벽 34(처마 밑~땅), 문 11×26, 판자 막은 창 16×12."""
    tin_roof(c, 1, 10, 78, 34, ins=5, seed=9, patches=[(36, 5, 24, 14, 'tarp'), (6, 20, 14, 9, 'rust'), (54, 25, 12, 7, 'blue')])
    # 방수포를 누르는 타이어·밧줄
    c.ell(48, 20, 3, 2, K('rubber', 1)); c.P(48, 20, K('rubber', 0)); c.HL(46, 18, 4, K('rubber', 4))
    c.line(37, 15, 60, 25, K('wood', 4))
    # 연통: 둥근 굴뚝 윗면(타원 입구) + 몸통 + 테
    c.R(14, 1, 6, 17, K('metal', 3)); c.VL(14, 1, 17, K('metal', 5)); c.VL(19, 1, 17, K('metal', 1))
    c.HL(13, 6, 8, K('metal', 6)); c.HL(13, 7, 8, K('metal', 2))
    c.R(14, 1, 6, 2, K('soot', 0)); c.HL(14, 3, 6, K('metal', 6))
    c.R(15, 18, 4, 2, K('soot', 3))
    scrap_wall(c, 2, 45, 76, 34, seed=12)
    plank_door(c, 46, 53, 11, 26, seed=6)
    c.R(9, 51, 18, 14, K('metal', 5)); c.HL(9, 64, 18, K('metal', 2)); c.VL(26, 51, 14, K('metal', 2))   # 창 테
    c.R(10, 52, 16, 12, K('soot', 0)); c.HL(10, 63, 16, K('conc', 5))
    for (yy) in (52, 56, 60): c.HL(9, yy, 18, K('wood', 3)); c.HL(9, yy + 1, 18, K('wood', 1))
    c.R(64, 66, 9, 4, K('wood', 4)); c.HL(64, 66, 9, K('wood', 5)); c.VL(68, 66, 4, K('wood', 3))                                   # 문 옆 나무 상자(윗면)
    planks(c, 64, 70, 9, 8, 'wood', 2, pw=3, seed=15, nails=False); c.HL(64, 77, 9, K('wood', 1))                                      # (앞면)
    grit(c, 0, 0, 80, 45, mat='metal', seed=13, rate=13)
    grit(c, 0, 45, 80, 35, mat='rust', seed=14, rate=19)
    c.outline()


@piece('lean-to', '방수포 차양 움막', 3, 3, STRUCT, en='tarp lean-to shelter: sloped tarp roof seen from above held by poles, open front with dark inside, bedroll and crate',
       group='shacks', tags=['판잣집', '움막'], desc='기둥 두 개에 방수포를 기울여 친 움막. 앞이 트여 속에 깔개·상자가 보인다.',
       solid=[(0, 2), (1, 2), (2, 2), (0, 1), (1, 1), (2, 1)], door=(1, 2))
def _lean_to(c):
    """4판: 방수포를 위에서 본 기운 지붕판으로 — 뒤 높은 가장자리가 가장 밝고 앞 낮은 가장자리로 어두워진다,
    앞 기둥 둘 사이로 처진 앞단(가운데가 내려옴), 기둥 머리에서 뻗는 당김 주름, 덧댄 천, 들쭉날쭉한 옆단,
    기둥 머리(윗면) · 땅 말뚝까지 당김 줄, 처진 앞단 밑 그늘 속에 깔개 두루마리·상자·깡통."""
    W = 48
    FY = 22                                                     # r64: 앞단 기준 행(지붕판을 더 깊게 — 위에서 본 면이 그림의 절반)
    def front(x):                                               # 앞단 행: 기둥(3·44) 사이에서 가운데가 3행 처진다
        u = (x - 4) / 40.0
        return FY + int(round(3.2 * (1 - (2 * u - 1) ** 2))) if 4 <= x <= 44 else FY
    def back(x): return 1 + (1 if h2(x // 3, 0, 5) % 4 == 0 else 0)
    def left(y): return 3 - (y - 2) // 8 + (1 if h2(0, y // 3, 6) % 3 == 0 else 0)
    def right(y): return 45 + (y - 2) // 8 - (1 if h2(1, y // 3, 6) % 3 == 0 else 0)
    # 1) 속(처진 앞단 밑 그늘) — 지붕보다 먼저. 앞단에서 땅(46)까지 트인 키 21~24.
    GY = 46
    for y in range(FY, GY):
        for x in range(3, 45):
            v = y - FY
            if v < 7: col = K('soot', 0 if v < 4 else 1)
            elif v < 10: col = K('soot', 2) if (v < 9 or h2(x, y, 1) % 3) else K('dirt', 0)
            elif v < 13: col = K('dirt', 0) if (v < 12 or h2(x, y, 3) % 2) else K('dirt', 1)
            else: col = dirt_px(x, y, 0) if v > 17 else K('dirt', 1 if h2(x, y, 2) % 2 else 2)
            c.P(x, y, col)
    for x in range(4, 44, 6): c.VL(x + h2(x, 3, 7) % 3, FY + 2, 4 + h2(x, 4, 7) % 3, K('soot', 1))   # 속 뒤쪽 비탈 밑면 주름
    # 깔개 두루마리(동서로 누운 원통을 위에서: 윗면 3행 밝게, 아래 그늘, 서쪽 끝 말린 면) + 베개 자루
    BY = 36
    for x in range(8, 26):
        for j, tt in enumerate((5, 5, 4, 4, 3, 2, 1)): c.P(x, BY + j, K('army', tt - (1 if (x - 8) % 5 == 0 and j > 0 else 0)))
    for (dx, dy, tt) in ((0, 0, 4), (0, 1, 3), (0, 2, 2), (0, 3, 2), (0, 4, 2), (0, 5, 1), (1, 3, 1)): c.P(7 + dx, BY + dy, K('army', tt))
    c.HL(10, BY + 2, 14, K('wood', 2)); c.P(17, BY + 1, K('wood', 4))   # 묶은 끈
    # 상자(13: 윗면 5행 + 앞면 8행)
    CY = 33
    c.R(29, CY, 10, 5, K('wood', 4)); c.HL(29, CY, 10, K('wood', 5)); c.HL(29, CY + 4, 10, K('wood', 3)); c.VL(33, CY, 5, K('wood', 3)); c.P(30, CY + 1, K('wood', 5))
    planks(c, 29, CY + 5, 10, 7, 'wood', 2, pw=3, seed=5, nails=False); c.HL(29, CY + 11, 10, K('wood', 1))
    c.R(40, 39, 3, 2, K('metal', 6)); c.R(40, 41, 3, 4, K('metal', 3)); c.VL(42, 41, 4, K('metal', 1)); c.P(41, 39, K('metal', 7))   # 깡통(윗면 + 몸)
    # 2) 방수포 지붕판
    for y in range(0, FY + 5):
        for x in range(0, W):
            if y < back(x) or y > front(x) or x < left(y) or x > right(y): continue
            d = (y - back(x)) / max(1, front(x) - back(x))           # 0 뒤 … 1 앞
            n = h2(x, y, 9) % 4
            d += 0.035 if n == 0 else -0.035 if n == 1 else 0      # 단 경계 점묘
            tt = 6 if d < 0.1 else 5 if d < 0.3 else 4 if d < 0.55 else 3 if d < 0.8 else 2
            # 당김 주름: 앞 기둥 머리(4,FY)·(43,FY)에서 뒤 가운데 쪽으로 뻗는 빛 줄 + 그 아래 그늘 줄
            for (px, sgn) in ((4, 1), (43, -1)):
                k = (x - px) * sgn - (FY - y) * 1.3
                if 0 <= (x - px) * sgn <= 20 and -0.6 < k < 0.6: tt = min(6, tt + 2)
                elif 0 <= (x - px) * sgn <= 20 and 0.6 <= k < 1.8: tt = max(1, tt - 2)
            if (x + 3 * (y // 6)) % 12 == 0 and 0.15 < d < 0.9: tt = max(1, tt - 1)    # 천 이음 박음질(뒤→앞으로 뻗는 솔기 = 비탈 결)
            if 16 <= x <= 32 and front(x) - 4 <= y <= front(x) - 1 and (x + y) % 5 == 0: tt = max(1, tt - 1)    # 가운데 처짐 잔주름
            c.P(x, y, K('tarp', tt))
    for x in range(0, W):                                       # 뒤 가장자리 빛 테 · 앞단 두께(접힌 단, 아래 그늘)
        b, f = back(x), front(x)
        if left(b) <= x <= right(b): c.P(x, b, K('tarp', 6 if x % 7 else 5))
        if left(f) <= x <= right(f):
            c.P(x, f, K('tarp', 3)); c.P(x, f + 1, K('tarp', 1)); c.P(x, f + 2, K('soot', 0)) if 4 < x < 43 else None
    # 덧댄 천(비뚤어진 네 변 · 가장자리 박음질만) — 군용 녹색 · 바랜 파랑
    for (x, y, w, h, m, sk) in ((13, 6, 8, 6, 'army', 1), (31, 10, 7, 5, 'blue', -1)):
        for j in range(h):
            o = (j * sk) // 2
            for i in range(w - (1 if j == h - 1 else 0)):
                d = (y + j - 2) / 22.0
                tt = (5 if d < 0.3 else 4 if d < 0.6 else 3) - (1 if i == w - 1 else 0) + (1 if i == 0 else 0)
                c.P(x + i + o, y + j, K(m, tt))
            if j % 2 == 0: c.P(x + o, y + j, K(m, 2)); c.P(x + o + w - 1, y + j, K(m, 2))
        for i in range(0, w, 2): c.P(x + i, y, K(m, 2))
        c.HL(x + (h * sk) // 2, y + h, w - 1, K('tarp', 1))
    # 처진 가운데에 고인 빗물(위에서 본 납작한 웅덩이: 짙은 물 + 위쪽 빛 테 + 반짝)
    for j in range(3):
        for i in range(-6 + j * 2 - (1 if j == 0 else 0), 7 - j * 2):
            c.P(24 + i, 20 + j, K('tarp', 1 if j else 2))
    c.HL(20, 19, 9, K('tarp', 5)); c.P(21, 20, K('glass', 6)); c.P(22, 20, K('glass', 4))
    rust_patch(c, 0, 1, W, FY + 3, seed=3, dens=0.12, mat='brust', on=set(MAT['tarp'][:4]))
    # 3) 앞 기둥(머리 윗면 3행 + 몸) · 당김 줄 · 땅 말뚝
    for x in (2, 42):
        c.rows(x, FY - 3, ['abbc', 'bbbc', 'cccd'], {'a': K('wood', 5), 'b': K('wood', 4), 'c': K('wood', 3), 'd': K('wood', 1)})
        for y in range(FY, GY):
            c.P(x, y, K('wood', 1)); c.P(x + 1, y, K('wood', 4)); c.P(x + 2, y, K('wood', 3) if (y - FY) % 7 else K('wood', 2)); c.P(x + 3, y, K('wood', 1))
        c.HL(x, FY, 4, K('wood', 2)); c.HL(x, FY + 1, 4, K('wood', 2))
    c.line(2, FY - 2, 0, GY - 2, K('wood', 4)); c.P(0, GY - 1, K('wood', 2)); c.P(1, GY - 1, K('wood', 4))
    c.line(45, FY - 2, 47, GY - 2, K('wood', 4)); c.P(47, GY - 1, K('wood', 2)); c.P(46, GY - 1, K('wood', 4))
    c.P(8, 2, K('wood', 2)); c.P(8, 1, K('wood', 4)); c.P(39, 2, K('wood', 2)); c.P(39, 1, K('wood', 4))     # 뒤 묶은 매듭
    c.shadow([(x, GY + 1) for x in range(2, 46)] + [(x, GY) for x in range(2, 46)])
    c.outline(top=False)


# ------------------------------------------------------------------ 거처 셋 더(판잣집 동네가 같은 도장 줄로 보이지 않게)
def _inpoly(x, y, pts):
    """점 (x+.5, y+.5) 가 다각형 안인가(짝수-홀수 규칙)."""
    px, py = x + 0.5, y + 0.5; inside = False
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0): inside = not inside
    return inside


def patch_roof(c, x, y, w, h, ins=2, seed=0, sheets=()):
    """조각보 골강판 지붕 윗면(사다리꼴, 뒤가 좁다): 크기가 제각각인 판 sheets=[(sx,sy,sw,sh,mat)…] 을 차례로 덮는다(뒤에 놓은 판이 위).
    mat 'rust' = 붉은 녹(rust 3·4·5), 'brown' = 갈색 녹(brust 3·5·7) — 두 녹 빛이 또렷이 다르다. 판마다 세로 골(붉은 녹 3화소·갈색 녹 4화소),
    판 윗변 빛 줄과 못, 왼변 빛, 아랫변·오른변 겹친 그늘(밑 판 위로 1화소), 뒤쪽 3행 한 단 어둡게."""
    RAMP = {'rust': ('rust', [1, 3, 4, 5, 5]), 'brown': ('brust', [1, 3, 5, 7, 7])}     # 그늘·골 어둠·몸·골 빛·테 빛
    def span(r): l = int(round(ins * (1 - r / max(1, h - 1)))); return l, w - l
    for (sx, sy, sw, sh, m) in sheets:
        mat, (sd, lo, mid, hi, rim) = RAMP[m][0], RAMP[m][1]
        pitch = 3 if m == 'rust' else 4
        for j in range(sh):
            r = sy + j
            if r >= h: break
            l, rr = span(r)
            for i in range(sw):
                xx = sx + i
                if xx < l or xx >= rr: continue
                k = i % pitch
                t = hi if k == 0 else lo if k == pitch - 1 else mid
                if r < 3 and t != lo: t = lo if t == mid else mid
                if hsh(x + xx, y + r, seed + 9) % 27 == 0: t = lo
                if j == 0: t = rim
                elif i == 0: t = hi
                if j == sh - 1 or i == sw - 1: t = sd
                c.P(x + xx, y + r, K(mat, t))
        for i in range(2, sw - 1, 4):                               # 윗변 못
            l, rr = span(sy + 1)
            if l <= sx + i < rr and sy + 1 < h: c.P(x + sx + i, y + sy + 1, K('metal', 6))
    for j in range(h):                                              # 갈색 녹 판 위 붉은 녹 점(쇠판으로 읽히게, 판자와 다르게)
        l, rr = span(j)
        for i in range(l, rr):
            col = c.get(x + i, y + j)
            if col in (K('brust', 5), K('brust', 3)) and hsh(x + i, y + j, seed + 31) % 9 == 0: c.P(x + i, y + j, K('rust', 3 if hsh(i, j, seed) % 2 else 4))
    l, rr = span(h - 1)
    c.HL(x + l, y + h - 1, rr - l, K('rust', 5)); c.HL(x, y + h, w, K('brust', 1))   # 처마 앞 턱(빛) · 처마 밑 두께


@piece('shack-c', '조각보 양철 판잣집', 4, 5, STRUCT, en='scrap shack seen from above: patchwork corrugated tin roof of sheets in two different rust tones (red rust and brown rust) with a tarp patch and a stovepipe, front wall of rusty sheets with a plank door on the left and a small propped-shutter window',
       group='shacks', tags=['판잣집', '건물'], desc='붉은 녹·갈색 녹 두 가지 양철을 조각보처럼 덧댄 판잣집. 방수포 덧댄 지붕, 연통, 앞벽 왼쪽에 판자 문, 오른쪽에 들창.',
       solid=[(cx, cy) for cy in (1, 2, 3, 4) for cx in range(4)], door=(0, 4))
def _shack_c(c):
    """r64 축척(버들항 작은 오두막 64×66 에 맞춤): 지붕 윗면 31행, 앞벽 34(처마 밑~땅), 판자 문 10×26, 들창 구멍 9×9."""
    patch_roof(c, 1, 12, 62, 31, ins=3, seed=21, sheets=[
        (0, 0, 22, 11, 'rust'), (21, 0, 20, 9, 'brown'), (40, 0, 22, 12, 'rust'), (0, 10, 16, 11, 'brown'),
        (15, 8, 26, 10, 'brown'), (40, 11, 22, 10, 'brown'), (0, 20, 19, 11, 'rust'), (18, 17, 25, 14, 'rust'),
        (42, 20, 20, 11, 'brown'), (45, 15, 12, 6, 'rust')])
    # 방수포 덧댄 자리(비뚤어진 사각, 위 행 밝게, 오른·아래 그늘) + 누르는 벽돌 둘
    for j in range(7):
        o = j // 3
        for i in range(14):
            c.P(37 + i + o, 21 + j, K('tarp', (5 if j == 0 else 4 if j < 3 else 3) - (1 if i == 13 else 0) + (1 if (i + 2 * j) % 9 == 0 else 0)))
    c.HL(37 + 2, 28, 14, K('tarp', 1)); c.VL(51 + 1, 22, 6, K('tarp', 2))
    for (bx, by) in ((39, 21), (47, 25)):
        c.R(bx, by, 3, 2, K('brick', 3)); c.HL(bx, by, 3, K('brick', 4)); c.HL(bx, by + 2, 3, K('brick', 1))
    # 연통(왼쪽 뒤): 둥근 입구 윗면 + 몸통 + 테 + 그을음
    c.R(10, 5, 6, 15, K('metal', 3)); c.VL(10, 5, 15, K('metal', 5)); c.VL(15, 5, 15, K('metal', 1))
    c.HL(9, 11, 8, K('metal', 6)); c.HL(9, 12, 8, K('metal', 2))
    c.R(11, 5, 4, 2, K('soot', 0)); c.HL(10, 7, 6, K('metal', 6))
    c.R(10, 20, 6, 2, K('soot', 3))
    # 앞벽: 세로 골강판 판을 붉은 녹·갈색 녹·쇠로 섞어 붙임
    WY, WH = 44, 34
    x = 2; k = 0
    for (pw, m) in ((9, 'brust'), (8, 'rust'), (7, 'metal'), (10, 'rust'), (10, 'brust'), (8, 'metal'), (8, 'rust')):
        corrugated(c, x, WY, pw, WH, m, base=4 if m == 'brust' else 3, pitch=3, seed=30 + k)
        c.VL(x, WY, WH, K('brust', 0) if m != 'metal' else K('metal', 1))
        for j in range(WY + 2, WY + WH, 6): c.P(x + 1, j, K('metal', 6))
        x += pw; k += 1
    rust_patch(c, 2, 58, 60, 20, seed=33, dens=0.3, on=set(MAT['metal']))
    c.HL(2, WY, 60, K('soot', 1)); c.HL(2, WY + 1, 60, K('soot', 3)); c.HL(2, WY + WH - 1, 60, K('dirt', 1))
    plank_door(c, 6, 52, 10, 26, seed=2)
    # 들창(오른쪽): 어두운 구멍 9×9 + 위로 받친 양철 덧문(윗면이 보이게 기울어 나온 판) + 받침 막대
    c.R(38, 53, 11, 11, K('brust', 2)); c.R(39, 54, 9, 9, K('soot', 0)); c.HL(39, 54, 9, K('soot', 2)); c.P(41, 56, K('glass', 4))
    c.R(37, 49, 13, 4, K('brust', 5)); c.HL(37, 49, 13, K('brust', 7)); c.HL(37, 52, 13, K('brust', 2))
    c.line(47, 53, 49, 60, K('wood', 4))
    # 빗물 통(오른쪽 앞): 둥근 윗면 + 몸
    c.R(54, 66, 6, 12, K('blue', 3)); c.VL(54, 66, 12, K('blue', 4)); c.VL(59, 66, 12, K('blue', 2))
    c.ell(56.5, 66, 2, 1, K('blue', 5)); c.P(56, 66, K('glass', 3)); c.HL(54, 70, 6, K('blue', 1)); c.HL(54, 74, 6, K('blue', 1))
    grit(c, 0, WY, 64, WH, mat='rust', seed=34, rate=21)
    c.outline()


@piece('container-home', '컨테이너 집', 5, 5, STRUCT, en='rusted steel shipping container turned into a home, seen from above: flat ribbed container roof as a top plane with corner castings, corrugated front side with a cut-in door under a sagging tarp awning on two poles and a cut-out window with bars',
       group='shacks', tags=['판잣집', '건물', '컨테이너'], desc='녹슨 해상 컨테이너를 고쳐 쓴 집. 납작한 지붕 윗면, 골진 앞면에 잘라 낸 문과 창, 문 위로 장대 두 개에 친 방수포 차양, 지붕 위 물통.',
       solid=[(cx, cy) for cy in (1, 2, 3, 4) for cx in range(5)], door=(1, 4))
def _container_home(c):
    """r64 축척(버들항 헛간급 ~80): 지붕 윗면 28행 + 지붕 위 물통, 앞면 36, 잘라 낸 문 11×26, 창 13×10, 차양 처마 땅 위 30 남짓."""
    X0, X1 = 2, 78                                               # 컨테이너 좌우
    RY, FY, GY = 14, 42, 78                                      # 지붕 윗면 시작 · 앞면 시작 · 앞면 끝(땅)
    # 지붕 윗면: 가로로 긴 판, 세로 얕은 골(5화소마다 빛·그늘), 뒤 가장자리 한 단 어둡게, 앞 테 빛
    for y in range(RY, FY):
        for x in range(X0, X1):
            k = (x - X0) % 5
            t = 4 + (1 if k == 0 else -1 if k == 4 else 0) - (1 if y < RY + 2 else 0)
            if hsh(x, y, 41) % 29 == 0: t -= 1
            c.P(x, y, K('blue', t))
    rust_patch(c, X0, RY, X1 - X0, FY - RY, seed=42, dens=0.34, mat='brust', on=set(MAT['blue']))
    rust_patch(c, X0, RY, X1 - X0, FY - RY, seed=43, dens=0.14, mat='rust', on=set(MAT['blue']) | set(MAT['brust']))
    c.HL(X0, RY, X1 - X0, K('blue', 2)); c.VL(X0, RY, FY - RY, K('blue', 5)); c.VL(X1 - 1, RY, FY - RY, K('blue', 2))
    c.HL(X0, FY - 1, X1 - X0, K('blue', 6))                       # 지붕 앞 테(빛)
    for (cx, cy) in ((X0, RY), (X1 - 3, RY), (X0, FY - 2), (X1 - 3, FY - 2)):   # 모서리 쇠붙이(구멍 난 주물)
        c.R(cx, cy, 3, 2, K('metal', 2)); c.P(cx + 1, cy, K('soot', 0))
    # 지붕 위 짐: 타이어 하나 · 방수포 두루마리
    c.ell(16, 24, 5, 3, K('rubber', 1)); c.ell(16, 24, 4, 2, K('rubber', 3)); c.ell(16, 23, 3, 1, K('rubber', 4))     # 눕힌 타이어: 테 · 고무 윗면 · 빛
    c.ell(16, 24.5, 2, 0.6, K('rubber', 0)); c.HL(14, 25, 5, K('rubber', 0)); c.HL(13, 27, 7, K('rubber', 2))           # 가운데 구멍 · 앞 옆면
    for x in range(28, 42):
        for j, tt in enumerate((5, 5, 4, 3, 2)): c.P(x, 24 + j, K('army', tt))
    c.VL(28, 24, 5, K('army', 2)); c.VL(34, 24, 5, K('wood', 2)); c.VL(38, 24, 5, K('wood', 2))
    # 지붕 위 물통(오른쪽 뒤에 세운 원통): 둥근 윗면(빛 테·뚜껑) + 몸(왼 빛 → 오른 그늘) + 테 두 줄 + 녹 흐름 + 지붕 위 그림자
    TX, TW, TT, TB = 56, 14, 6, 26
    for y in range(TT, TB):
        for i in range(TW):
            u = i / (TW - 1)
            t = 5 if u < 0.15 else 4 if u < 0.35 else 3 if u < 0.6 else 2 if u < 0.85 else 1
            if hsh(TX + i, y, 48) % 19 == 0: t -= 1
            c.P(TX + i, y, K('blue', t))
    for yy in (12, 19): c.HL(TX, yy, TW, K('blue', 5)); c.HL(TX, yy + 1, TW, K('blue', 1))
    rust_patch(c, TX, TT + 4, TW, TB - TT - 4, seed=49, dens=0.3, mat='brust', on=set(MAT['blue']))
    for x in (TX + 3, TX + 8, TX + 11): c.VL(x, TT + 3, 4 + hsh(x, 1, 50) % 6, K('brust', 3))
    c.ell(TX + 6.5, TT, 6, 2, K('blue', 5)); c.ell(TX + 6.5, TT, 5, 1, K('blue', 6)); c.HL(TX + 1, TT + 2, TW - 2, K('blue', 3))
    c.R(TX + 5, TT - 1, 3, 2, K('metal', 3)); c.HL(TX + 5, TT - 1, 3, K('metal', 6))                                     # 뚜껑
    for y in range(TT + 4, TB + 2): c.P(TX + TW, y, K('blue', 1)); c.P(TX + TW + 1, y, K('blue', 2))                      # 지붕 위 그림자
    c.HL(TX, TB, TW + 2, K('blue', 1)); c.HL(TX + 1, TB + 1, TW, K('blue', 2))
    # 앞면: 세로 골(빛·몸·그늘·몸 4화소), 녹 흐름, 위 그늘·아래 레일
    for y in range(FY, GY):
        for x in range(X0, X1):
            k = (x - X0) % 4
            t = 2 + (1 if k == 0 else -1 if k == 2 else 0)
            c.P(x, y, K('blue', t))
    rust_patch(c, X0, FY, X1 - X0, GY - FY, seed=44, dens=0.45, mat='brust', on=set(MAT['blue']))
    rust_patch(c, X0, FY + 12, X1 - X0, GY - FY - 12, seed=45, dens=0.3, mat='rust', on=set(MAT['blue']) | set(MAT['brust']))
    for x in range(X0 + 3, X1 - 2, 7):                             # 녹 흘러내린 줄
        if hsh(x, 3, 46) % 2: c.VL(x, FY + 1, 5 + hsh(x, 4, 46) % 8, K('brust', 3))
    c.HL(X0, FY, X1 - X0, K('blue', 1)); c.HL(X0, FY + 1, X1 - X0, K('blue', 2))
    c.R(X0, GY - 3, X1 - X0, 3, K('metal', 2)); c.HL(X0, GY - 3, X1 - X0, K('metal', 4)); c.HL(X0, GY - 1, X1 - X0, K('metal', 1))
    for x in (X0, X0 + 1, X1 - 2, X1 - 1): c.VL(x, FY, GY - FY - 3, K('metal', 3 if x in (X0, X1 - 2) else 1))   # 모서리 기둥
    # 잘라 낸 문(가운데 왼쪽, 11×26): 자른 테(밝은 쇠) + 안 어둠 + 바깥으로 열린 잘린 판 문
    DY = GY - 26; DX = 24
    c.R(DX, DY, 11, 26, K('soot', 0)); c.R(DX + 1, DY + 2, 9, 24, K('soot', 1))
    c.VL(DX - 1, DY - 1, 27, K('metal', 6)); c.HL(DX - 1, DY - 1, 13, K('metal', 6)); c.VL(DX + 11, DY, 26, K('metal', 5))
    for y in range(DY, GY):                                       # 열린 문짝(왼쪽으로 젖혀 비스듬히: 3화소 폭)
        c.P(DX - 4, y, K('blue', 4)); c.P(DX - 3, y, K('blue', 3)); c.P(DX - 2, y, K('blue', 2))
    for yy in (DY + 5, DY + 13, DY + 21): c.HL(DX - 4, yy, 3, K('metal', 5))
    c.P(DX - 2, DY + 9, K('metal', 6)); c.P(DX - 2, DY + 17, K('metal', 6))
    c.R(DX + 2, GY - 4, 7, 4, K('burlap', 3)); c.HL(DX + 2, GY - 4, 7, K('burlap', 5)); c.HL(DX + 2, GY - 1, 7, K('burlap', 1))   # 문턱 깔개
    # 잘라 낸 창(오른쪽, 어둠 13×10): 테 + 세로 철근 셋 + 걸친 천
    WX, WYY = 50, 54
    c.R(WX, WYY, 13, 10, K('soot', 0)); c.HL(WX, WYY, 13, K('soot', 2))
    c.HL(WX - 1, WYY - 1, 15, K('metal', 6)); c.VL(WX - 1, WYY - 1, 12, K('metal', 6)); c.VL(WX + 13, WYY, 11, K('metal', 3)); c.HL(WX - 1, WYY + 10, 15, K('metal', 3))
    for x in (WX + 3, WX + 6, WX + 9): c.VL(x, WYY, 10, K('rust', 4)); c.P(x, WYY, K('rust', 6))
    for j in range(7): c.HL(WX, WYY + j, 3 - j // 3, K('army', 4 - j // 3))
    # 방수포 차양(문 위): 컨테이너 앞 테에서 앞으로 기울어 나온 판 — 뒤 밝고 앞 어둡게, 앞단 가운데 처짐, 아래 그늘
    AX0, AX1 = 16, 42
    def front(x): u = (x - AX0) / float(AX1 - AX0); return FY + 7 + int(round(1.8 * (1 - (2 * u - 1) ** 2)))
    for x in range(AX0, AX1 + 1):
        f = front(x)
        for y in range(FY, f + 1):
            d = (y - FY) / max(1, f - FY)
            c.P(x, y, K('tarp', 6 if d < 0.15 else 5 if d < 0.45 else 4 if d < 0.75 else 3))
        c.P(x, f, K('tarp', 2))
    for x in range(AX0 + 2, AX1, 5): c.line(x, FY + 1, x + 1, front(x) - 1, K('tarp', 4))      # 처진 주름
    for (x0, y0) in ((26, FY + 2), (34, FY + 3)): c.R(x0, y0, 4, 2, K('tarp', 3))           # 바랜 자국
    for x in (AX0, AX1):                                          # 차양 장대(앞으로 나와 땅이 앞면 끝보다 아래)
        c.VL(x, FY + 8, GY + 2 - FY - 8, K('wood', 3)); c.VL(x + 1 if x == AX0 else x - 1, FY + 9, GY + 2 - FY - 9, K('wood', 1)); c.P(x, FY + 7, K('wood', 5))
    # 오른쪽 앞 상자(13: 윗면 4 + 앞면 8)
    c.R(68, 66, 8, 4, K('wood', 4)); c.HL(68, 66, 8, K('wood', 5)); c.VL(71, 66, 4, K('wood', 3))
    planks(c, 68, 70, 8, 8, 'wood', 2, pw=3, seed=47, nails=False); c.HL(68, 77, 8, K('wood', 1))
    c.shadow([(x, GY) for x in range(X0, X1)] + [(x, GY + 1) for x in range(X0 + 2, X1 - 2)])
    c.outline()


@piece('tent-tarp', '방수포 천막', 3, 3, STRUCT, en='ragged tarp tent seen from above: a patched tarp thrown over a ridge pole on two upright poles, both sloped tarp planes visible from above, open front end showing a crate inside, guy ropes to stakes',
       group='shacks', tags=['판잣집', '움막', '천막'], desc='장대 둘에 걸친 용마루 막대 위로 해진 방수포를 덮은 천막. 위에서 두 비탈면이 보이고 앞이 트여 속에 상자가 있다.',
       solid=[(0, 2), (1, 2), (2, 2), (0, 1), (1, 1), (2, 1)], door=(1, 2))
def _tent_tarp(c):
    """r64(3×3): 용마루가 남북으로 길게 누운 천막을 위에서 — 두 비탈면이 평행사변형으로 크게 보이고(용마루 22행),
    앞 박공은 낮게(15행). 비탈마다 용마루→처마로 5단 명암, 당김 줄 자리 사이로 처진 골(빛 등 · 그늘 골),
    덧댄 천은 비탈 결을 따라 기울고 박음질 · 녹물 얼룩 · 찢긴 구멍, 처마 단은 해져 들쭉날쭉."""
    import math
    MX, GY = 24, 41                                               # 가운데 열 · 땅(앞 처마 끝 행 = GY-1)
    RB, RF = (MX, 4), (MX, 25)                                    # 용마루 뒤·앞 끝
    EL, ER = 3, 45                                                # 처마 좌우
    GH = GY - 1 - RF[1]                                           # 박공 키(= 처마가 용마루보다 내려온 화면 높이)
    L = [RB, RF, (EL, GY - 1), (EL, RB[1] + GH)]; Rr = [RB, RF, (ER, GY - 1), (ER, RB[1] + GH)]
    RL = RF[1] - RB[1]                                            # 용마루 길이(화면 행)
    # 앞 트인 자리(박공 속 어둠 → 바닥) — 먼저
    for y in range(RF[1], GY + 1):
        for x in range(EL, ER + 1):
            if _inpoly(x, y, [RF, (ER + 1, GY + 1), (EL - 1, GY + 1)]):
                v = y - RF[1]
                if v < 5: col = K('soot', 0)
                elif v < 9: col = K('soot', 1) if (v > 5 or h2(x, y, 54) % 2) else K('soot', 0)
                elif v < 12: col = K('soot', 2) if (v > 9 or h2(x, y, 55) % 2) else K('soot', 1)
                else: col = K('dirt', 0 if v < 14 else 1) if h2(x, y, 56) % 3 else K('dirt', 2)
                c.P(x, y, col)
    for x in range(15, 34, 4): c.VL(x + h2(x, 1, 57) % 2, RF[1] + 4, 4, K('soot', 1))   # 뒤쪽 비탈 밑면 주름(속)
    CX, CY = 12, 32                                               # 상자(윗면 4 + 앞면 6)
    c.R(CX, CY, 10, 4, K('wood', 4)); c.HL(CX, CY, 10, K('wood', 5)); c.HL(CX, CY + 3, 10, K('wood', 3)); c.VL(CX + 4, CY, 4, K('wood', 3)); c.P(CX + 1, CY + 1, K('wood', 5))
    planks(c, CX, CY + 4, 10, 5, 'wood', 2, pw=3, seed=51, nails=False); c.HL(CX, CY + 8, 10, K('wood', 1))
    for x in range(27, 37):                                       # 깔개 두루마리(윗면 밝게 · 아래 그늘)
        for j, tt in enumerate((5, 4, 4, 3, 2)): c.P(x, 34 + j, K('army', tt - (1 if (x - 27) % 4 == 3 and j else 0)))
    for j, tt in enumerate((4, 3, 2, 2, 1)): c.P(26, 34 + j, K('army', tt))
    c.VL(31, 34, 5, K('wood', 2))
    # 두 비탈면: s = 용마루(0) → 처마(1), u = 뒤(0) → 앞(1)
    for y in range(0, GY + 1):
        for x in range(0, 48):
            inl, inr = _inpoly(x, y, L), _inpoly(x, y, Rr)
            if not (inl or inr): continue
            s = abs(x - MX) / float(MX - EL)
            u = (y - RB[1] - GH * s) / float(RL)
            n = h2(x, y, 58) % 4
            sd = s + (0.04 if n == 0 else -0.04 if n == 1 else 0)  # 단 경계 점묘
            if inl: t = 6 if sd < 0.1 else 5 if sd < 0.34 else 4 if sd < 0.62 else 3 if sd < 0.88 else 2
            else: t = 4 if sd < 0.1 else 3 if sd < 0.34 else 2 if sd < 0.62 else 1 if sd < 0.9 else 0
            w = math.cos(u * 2 * math.pi * 2)                      # 당김 줄 자리(u=0,.5,1) 사이로 처진 골
            if s > 0.12:
                if w < -0.55: t -= 1
                elif w > 0.8: t += 1
            if 0.42 < s < 0.47 and (x + y) % 3: t -= 1             # 가운데 접힘 선(접어 둔 자국)
            c.P(x, y, K('tarp', max(0, min(6, t))))
    # 처진 골 가장자리 주름(골 위쪽 빛 실선)
    for side in (-1, 1):
        for uu in (0.27, 0.77):
            for k in range(6, MX - EL):
                s = k / float(MX - EL); x = MX + side * k
                y = int(round(RB[1] + GH * s + uu * RL - (s - 0.25) * 3))
                if s > 0.3 and h2(x, y, 59) % 5: c.P(x, y, K('tarp', 5 if side < 0 else 3))
    # 덧댄 천(비탈 결을 따라 기운 평행사변형, 바깥 박음질)
    def patch(side, s0, s1, u0, u1, m, tops):
        for k in range(int(s0 * (MX - EL)), int(s1 * (MX - EL)) + 1):
            s = k / float(MX - EL); x = MX + side * k
            ya = int(round(RB[1] + GH * s + u0 * RL)); yb = int(round(RB[1] + GH * s + u1 * RL))
            for y in range(ya, yb + 1):
                q = (k - s0 * (MX - EL)) / max(1.0, (s1 - s0) * (MX - EL))
                t = tops[0] if q < 0.33 else tops[1] if q < 0.7 else tops[2]
                edge = y in (ya, yb) or k in (int(s0 * (MX - EL)), int(s1 * (MX - EL)))
                c.P(x, y, K(m, t - 2 if edge and (x + y) % 2 else t))
            c.P(x, yb + 1, K('tarp', 0 if side > 0 else 1))
    patch(-1, 0.32, 0.66, 0.18, 0.42, 'army', (5, 4, 3))
    patch(1, 0.28, 0.58, 0.55, 0.78, 'blue', (4, 3, 2))
    for (x, y) in ((33, 13), (34, 13), (34, 14), (35, 14), (35, 15)): c.P(x, y, K('soot', 0))   # 찢긴 틈
    c.P(33, 12, K('tarp', 4)); c.P(36, 15, K('tarp', 0))
    rust_patch(c, 0, 0, 48, GY, seed=52, dens=0.07, mat='brust', on=set(MAT['tarp'][:5]))
    # 테: 용마루(빛 등) · 뒤단 빛 테 · 앞단 접힌 두께 · 처마 해진 단
    for y in range(RB[1], RF[1] + 1):
        c.P(MX, y, K('tarp', 6)); c.P(MX - 1, y, K('tarp', 6 if y % 4 else 5)); c.P(MX + 1, y, K('tarp', 4))
    c.line(RB[0], RB[1], EL, RB[1] + GH, K('tarp', 6)); c.line(RB[0] + 1, RB[1], ER, RB[1] + GH, K('tarp', 4))
    c.line(RF[0] - 1, RF[1] + 1, EL, GY - 1, K('tarp', 2)); c.line(RF[0] - 1, RF[1] + 2, EL + 1, GY, K('tarp', 1))
    c.line(RF[0] + 1, RF[1] + 1, ER, GY - 1, K('tarp', 1)); c.line(RF[0] + 1, RF[1] + 2, ER - 1, GY, K('tarp', 0))
    for (x, side) in ((EL, -1), (ER, 1)):
        for y in range(RB[1] + GH, GY):
            if hsh(x, y, 53) % 5 == 0: c.clear(x, y)
            elif hsh(x, y, 60) % 7 == 0: c.P(x + side, y, K('tarp', 2 if side < 0 else 1))   # 늘어진 술
    # 장대 머리(뒤·앞 용마루 위로 솟음) · 앞 장대 · 당김 줄 · 말뚝
    c.rows(MX - 1, RB[1] - 3, ['ab', 'bc', 'cd'], {'a': K('wood', 5), 'b': K('wood', 4), 'c': K('wood', 3), 'd': K('wood', 1)})
    c.rows(MX - 1, RF[1] - 2, ['ab', 'bc'], {'a': K('wood', 5), 'b': K('wood', 4), 'c': K('wood', 3)})
    c.VL(MX, RF[1] + 1, GY - RF[1] - 1, K('wood', 3)); c.VL(MX + 1, RF[1] + 2, GY - RF[1] - 2, K('wood', 1)); c.VL(MX - 1, RF[1] + 3, GY - RF[1] - 4, K('wood', 4))
    c.line(EL, GY - 1, 1, GY + 4, K('wood', 4)); c.P(1, GY + 5, K('wood', 2)); c.P(0, GY + 5, K('wood', 1))
    c.line(ER, GY - 1, 46, GY + 4, K('wood', 4)); c.P(46, GY + 5, K('wood', 2)); c.P(47, GY + 5, K('wood', 1))
    c.line(EL, RB[1] + GH, 0, RB[1] + GH - 3, K('wood', 3)); c.line(ER, RB[1] + GH, 47, RB[1] + GH - 3, K('wood', 3))
    c.shadow([(x, GY + 1) for x in range(EL + 1, ER)] + [(x, GY + 2) for x in range(EL + 3, ER - 2)])
    c.outline(top=False)


# ------------------------------------------------------------------ 바리케이드·울타리·문
def sandbag(c, x, y, w=8, h=5, mat='burlap'):
    """모래주머니 하나(위에서 비스듬히): 둥근 모서리 · 위 밝은 면 2행 · 앞 그늘 · 가운데 주름."""
    c.R(x + 1, y, w - 2, h, K(mat, 3)); c.VL(x, y + 1, h - 2, K(mat, 3)); c.VL(x + w - 1, y + 1, h - 2, K(mat, 2))
    c.HL(x + 1, y, w - 2, K(mat, 5)); c.HL(x + 1, y + 1, w - 2, K(mat, 4))
    c.HL(x + 1, y + h - 1, w - 2, K(mat, 1)); c.P(x + w // 2, y + 2, K(mat, 2)); c.P(x + 1, y + 1, K(mat, 6))
    if h > 4: c.HL(x + 1, y + h - 2, w - 2, K(mat, 2))
    for i in range(x + 2, x + w - 2, 2): c.P(i, y + 1, K(mat, 6)) if (i + y) % 4 == 0 else None
    c.P(x + w - 2, y + 1, K(mat, 3))


def tyre_stack(c, x, y, n=2, r=6):
    """쌓은 타이어: 맨 위 타이어 윗면(고리 + 가운데 구멍) + 아래 타이어 옆 띠들."""
    cx = x + r
    for k in range(n):                                       # 아래부터
        by = y + 3 + (n - k) * 4
        c.R(x, by - 1, 2 * r + 1, 4, K('rubber', 1)); c.HL(x, by - 1, 2 * r + 1, K('rubber', 3)); c.HL(x, by + 2, 2 * r + 1, K('rubber', 0))
        for i in range(x + 1, x + 2 * r, 3): c.P(i, by, K('rubber', 2))           # 접지면 무늬
    c.ell(cx, y + 3, r, 3, K('rubber', 2))
    c.ell(cx, y + 3, r - 1, 2, K('rubber', 3))
    c.ell(cx, y + 3, r - 3, 1, K('rubber', 0))
    c.HL(cx - r + 2, y, 2 * r - 3, K('rubber', 4))


@piece('barricade-h', '바리케이드 (가로)', 3, 2, STRUCT, en='east-west barricade of stacked sandbags, old tyres and a rusty sheet-metal plate, tops seen from above',
       group='defense', tags=['바리케이드', '방어'], desc='모래주머니·타이어·녹슨 철판을 쌓은 가로 바리케이드.', solid=[(0, 1), (1, 1), (2, 1)])
def _barricade_h(c):
    # 뒤 철판(기울어 선 판: 윗변 두께 보임)
    for j in range(5): c.HL(16 + (4 - j) // 2, 4 + j, 22, K('rust', 5 if j < 2 else 4))           # 철판 윗변(뒤로 기운 판의 두께, 5행)
    c.HL(17, 4, 21, K('rust', 6))
    corrugated(c, 16, 9, 22, 8, 'rust', base=3, pitch=3, seed=2); rust_patch(c, 16, 9, 22, 8, seed=1, dens=0.4, mat='brust')
    c.HL(16, 9, 22, K('rust', 1))
    # 모래주머니 두 단(뒤 단 → 앞 단)
    for i, x in enumerate(range(2, 36, 8)): sandbag(c, x, 15, 8, 5)
    for i, x in enumerate(range(-2, 40, 8)): sandbag(c, max(0, x), 19, 8 if x >= 0 else 6, 6)
    for x in range(0, 40): c.P(x, 25, K('burlap', 0)) if c.has(x, 24) else None
    sandbag(c, 6, 11, 8, 5); sandbag(c, 12, 12, 7, 4)
    tyre_stack(c, 34, 8, n=3, r=6)
    c.outline()


SB_RAMPS = {                                                   # 자루 색 셋(어둠 → 빛, 모두 MAT 값): 갈색 마대 · 회갈 마대 · 군용 녹색
    'tan':  [MAT['wood'][0], MAT['wood'][2], MAT['wood'][3], MAT['wood'][4], MAT['dry'][5]],
    'grey': [MAT['burlap'][0], MAT['burlap'][2], MAT['burlap'][4], MAT['burlap'][5], MAT['burlap'][6]],
    'army': [MAT['army'][1], MAT['army'][2], MAT['army'][3], MAT['army'][4], MAT['army'][5]],
}


def pillow(c, x, y, w, h, ramp='tan', front=0, tie='E'):
    """위에서 본 모래주머니 하나: 둥근 모서리 · 가운데 불룩한 윗면(빛 덩이가 왼쪽 위로 치우침) · 가장자리로 갈수록 어둡게 ·
    가로 박음질 · 묶은 귀(tie 쪽) · front>0 이면 남쪽에 앞면 front 행(어둡게)."""
    r = SB_RAMPS[ramp]
    for j in range(h):
        for i in range(w):
            if (i in (0, w - 1)) and (j in (0, h - 1)): continue
            if w >= 7 and j == 0 and i in (1, w - 2): continue          # 더 둥근 어깨
            side = i in (0, w - 1)
            if j == 0: tt = 2 if side else 3
            elif j == 1: tt = 2 if side else 3 if i in (1, w - 2) else 4 if 2 <= i <= max(2, w // 2) else 3
            elif j == h - 1: tt = 0
            elif j == h - 2: tt = 1
            else: tt = 1 if side and i == w - 1 else 2 if i >= w // 2 + 1 else 3 if i <= 1 or j == 2 else 2
            if i == w - 1 and j > 0: tt = min(tt, 1)
            c.P(x + i, y + j, r[tt])
    if w >= 7: 
        for i in range(2, w - 2, 2): c.P(x + i, y + h // 2 + 1, r[2] if c.get(x + i, y + h // 2 + 1) != r[1] else r[1])    # 박음질
    ex = x + w - 1 if tie == 'E' else x
    c.P(ex + (1 if tie == 'E' else -1), y + h // 2, r[1]); c.P(ex + (1 if tie == 'E' else -1), y + h // 2 - 1, r[2])
    for k in range(front):                                     # 남쪽 끝 앞면: 불룩한 자루 끝(가운데 한 단 밝게), 맨 아래 가장 어둡게
        for i in range(0 if k < front - 1 else 1, w if k < front - 1 else w - 1):
            tt = 0 if k == front - 1 else 2 if (k == 0 and 1 <= i <= w // 2) else 1
            c.P(x + i, y + h + k, r[tt])


def bag_course(c, x, y, w, ramp, top=4, front=3, tie='E'):
    """한 단(남쪽으로 계단처럼 내려가는 자루 한 줄의 한 자루): 둥근 어깨의 불룩한 윗면 top 행(빛 덩이 왼쪽 위)
    + 앞면 front 행(위 밝은 불룩 · 가운데 몸 · 아래 그늘, 끝은 둥글게) — 앞면도 재질 톤, 검정 없음."""
    r = SB_RAMPS[ramp]
    for j in range(top):
        for i in range(w):
            if j == 0 and (i < 1 or i > w - 2): continue
            if j == 0 and w >= 7 and i in (1, w - 2): continue
            tt = 3 if j == 0 else 4 if (j == 1 and 2 <= i <= w // 2) else 3
            if j == top - 1: tt = 3 if i < w - 2 else 2
            if i == 0 or i == w - 1: tt = 2
            c.P(x + i, y + j, r[tt])
    for k in range(front):
        for i in range(w):
            if k == front - 1 and (i == 0 or i == w - 1): continue
            tt = 1 if k < front - 1 else 0
            if k == 0 and 1 <= i <= w // 2: tt = 2
            if i == w - 1 and k < front - 1: tt = max(0, tt - 1)
            c.P(x + i, y + top + k, r[tt])
    if w >= 7:                                                  # 박음질(앞면 첫 줄 따라)
        for i in range(2, w - 2, 3): c.P(x + i, y + top + 1, r[2])
    ex = x + w - 1 if tie == 'E' else x                          # 묶은 귀
    c.P(ex, y + top, r[1]); c.P(ex, y + top - 1, r[2])


@piece('barricade-v', '바리케이드 (세로)', 1, 3, STRUCT, en='north-south barricade line of stacked sandbags seen from above: rows of bags each showing a bulging top and a short front, end face at the bottom',
       group='defense', tags=['바리케이드', '방어'], desc='남북으로 쌓은 모래주머니 줄(위에서 본 띠, 자루마다 윗면 + 앞면).', solid=[(0, 0), (0, 1), (0, 2)])
def _barricade_v(c):
    """5판: 남쪽으로 계단처럼 내려가는 자루 단 — 단마다 불룩한 윗면 4행 + 앞면 3행, 남쪽 끝 단은 앞면 5행.
    북쪽 끝에 기댄 녹 철판(윗변 3행 + 앞면). (타이어 구멍은 «구멍»으로 읽혀 뺐다.) 윤곽은 짙은 나무 톤."""
    c.shadow([(15, y) for y in range(3, 46)] + [(x, 47) for x in range(1, 15)])
    for j in range(3): c.HL(2, j, 12, K('rust', 6 - j))           # 녹 철판 윗변
    corrugated(c, 2, 3, 12, 2, 'rust', base=3, pitch=3, seed=4)
    courses = [  # (y, [(x, w, ramp)])
        (3, [(0, 9, 'tan'), (9, 7, 'grey')]),
        (10, [(0, 6, 'grey'), (6, 10, 'army')]),
        (17, [(0, 10, 'tan'), (10, 6, 'tan')]),
        (24, [(0, 7, 'army'), (7, 9, 'grey')]),
        (31, [(0, 9, 'grey'), (9, 7, 'tan')]),
    ]
    for (y, bags) in courses:
        for (x, w, rp) in bags: bag_course(c, x, y, w, rp, 4, 3, tie='E' if x == 0 else 'W')
    for (x, w, rp) in ((0, 8, 'tan'), (8, 8, 'grey')): bag_course(c, x, 38, w, rp, 4, 5, tie='E' if x == 0 else 'W')
    c.outline(col=K('wood', 0), top=False)


def fence_sheet(c, x, y, w, h, seed=0):
    corrugated(c, x, y, w, h, 'metal', base=3, pitch=3, seed=seed)
    rust_patch(c, x, y, w, h, seed=seed + 5, dens=0.45, on=set(MAT['metal']))


def post_head(c, x, y, h=12):
    """나무 말뚝(5폭): 머리 윗면 4행(밝게, 빛 화소) + 앞면 h 행(왼 빛·몸·오른 그늘) + 밑동."""
    for j, row in enumerate(['NTTTN', 'NTTAN', 'NTAAN', 'NAAAN']):
        for i, ch in enumerate(row):
            c.P(x + i, y + j, {'N': K('wood', 1), 'T': K('wood', 5), 'A': K('wood', 4)}[ch])
    for j in range(h):
        c.P(x, y + 4 + j, K('wood', 1)); c.P(x + 1, y + 4 + j, K('wood', 3)); c.P(x + 2, y + 4 + j, K('wood', 2) if j % 4 != 3 else K('wood', 3))
        c.P(x + 3, y + 4 + j, K('wood', 1)); c.P(x + 4, y + 4 + j, K('wood', 0))
    c.HL(x + 1, y + 4, 3, K('wood', 2))


FENCE_POST = {          # 나무 말뚝: 머리 윗면 4행(T 빛 · A 몸) ↔ 앞면(b · c · d), 옆 윤곽 N, 위 윤곽 없음
    0: "NTTTN", 1: "NTTAN", 2: "NTAAN", 3: "NAAAN", 4: "NcccN", 5: "NbcdN", 6: "NbcdN", 7: "NbcdN", 8: "NccdN",
    9: "NbcdN", 10: "NbcdN", 11: "NbcdN", 12: "NccdN", 13: "NbcdN", 14: "NdddN", 15: ".;;;;",
}
FENCE_RAIL = {          # 골강판 가로대: 윗면 3행(m 빛 앞 가장자리 · M 골 빛 · a 몸) + 앞면 2행(r/s 녹 섞인 몸 · e 아래) + 그림자
    3: "mmmmmmmmmmmmmmmm", 4: "MaMaaMaMaaMaMaaM", 5: "aaaaaaaaaaaaaaaa", 6: "rgrgrsgrgrgsrgrg", 7: "eeeeeeeeeeeeeeee", 8: ";;;;;;;;;;;;;;;;",
    10: "mmmmmmmmmmmmmmmm", 11: "MaaMaMaaMaaMaMaa", 12: "aaaaaaaaaaaaaaaa", 13: "grgsrgrgrgrsgrgr", 14: "eeeeeeeeeeeeeeee", 15: ";;;;;;;;;;;;;;;;",
}
FENCE_STRIP2 = ["nmmmn", "nMaan", "naaan", "naaan", "nrgsn", "neeen"]


def fence_paint(c, rows, x0, w):
    """행 사전 {y: 문자열} 을 열 x0 부터 w 칸만 찍는다. ';' = 땅 그림자, '.' = 건너뜀."""
    pal = {'N': K('wood', 0), 'T': K('wood', 5), 'A': K('wood', 4), 'b': K('wood', 3), 'c': K('wood', 2), 'd': K('wood', 1),
           'n': K('metal', 1), 'm': K('metal', 7), 'M': K('metal', 6), 'a': K('metal', 5), 'g': K('metal', 3), 'r': K('rust', 3), 's': K('rust', 4), 'e': K('metal', 1)}
    for y, row in rows.items():
        for i, ch in enumerate(row[x0:x0 + w] if len(row) > w else row):
            if ch == '.': continue
            if ch == ';': c.shadow([(x0 + i, y)]); continue
            c.P(x0 + i, y, pal[ch])


@piece('fence-h', '고철 울타리 (가로)', 1, 1, 'frame', en='east-west scrap fence section: two rails of folded corrugated sheet metal on a wooden post, rail tops seen from above, tiles into a line',
       group='defense', tags=['울타리'], desc='접은 골강판 띠 두 줄을 나무 말뚝에 박은 가로 울타리 한 칸 — 이어 찍어 줄을 만든다.', solid=[(0, 0)])
def _fence_h(c):
    """4판(버들 농장 울타리 통과 판 그대로): 말뚝 열 5~9(머리 윗면 0~3행, 위 윤곽 없음, 앞면 4~14, 그림자 15),
    가로대 둘(위 3~8 · 아래 10~15: 윗면 3행 + 앞면 2행 + 땅 그림자 1행) = 접은 골강판, 녹은 앞면 행에만."""
    fence_paint(c, FENCE_RAIL, 0, 16)
    fence_paint(c, FENCE_POST, 5, 5)


@piece('fence-v', '고철 울타리 (세로)', 1, 1, 'frame', en='north-south scrap fence section seen from above: a band of overlapping weathered planks with rusty nails running north-south beside a wooden post, each plank showing its top and its south end, tiles into a vertical line',
       group='defense', tags=['울타리'], desc='남북 울타리 한 칸(말뚝 + 서쪽 옆에 겹친 헌 널 띠: 널마다 윗면 4행 + 끝면 2행, 녹슨 못) — 위아래로 이어 찍는다.', solid=[(0, 0)])
def _fence_v(c):
    """6판: 통과한 버들 농장 울타리 v(STRIP2 + POST, 열 0~4 띠 · 열 5~9 말뚝)를 그대로 따른다 — 재질만 헌 널(나무)·녹슨 못."""
    strip = ["NTTTN", "NTAAN", "NAAAN", "NAAAN", "NcccN", "NdddN"]
    fence_paint(c, {y: strip[y % 6] for y in range(16)}, 0, 5)
    fence_paint(c, FENCE_POST, 5, 5)
    for y in (4, 10): c.P(2, y, K('rust', 3))                  # 널 끝면의 녹슨 못
    c.P(3, 2, K('wood', 3)); c.P(1, 8, K('wood', 3)); c.P(2, 14, K('wood', 3))   # 널 윗면 결(갈라짐)


@piece('gate-scrap', '고철 대문', 3, 3, STRUCT, en='open scrap-metal gateway seen from above: two heavy posts with their top caps, a crossbeam with its top surface between them, two corrugated gate leaves swung open flat, walkable opening in the middle',
       group='defense', tags=['문', '울타리'], desc='고철 대문(열림). 가운데로 지나간다(기둥 칸도 막지 않는다 — 양옆 울타리가 막는다).', solid=[], door=None)
def _gate_scrap(c):
    """r63 축척(3×3): 기둥 키 41(머리 윗면 5 + 몸 36), 가로보 밑 트인 키 28~29, 문짝 사이 트인 폭 26."""
    GY = 45                                                       # 땅(기둥 밑동 마지막 행)
    PL, PR = 0, 42                                                # 기둥 왼 끝 x
    # 열어 젖힌 문짝: 경첩(기둥 안쪽)에서 안쪽·앞으로 비스듬히 젖혀진 판 — 위에서 윗변이 대각선 띠(빛 2행)로 보이고,
    # 그 밑으로 안쪽 면(골강판 골 · 가로 띠 · 리벳 · 녹물). 앞으로 갈수록(경첩에서 멀수록) 화면 아래로 내려온다.
    LW = 9                                                        # 문짝 투영 폭
    for (x0, d) in ((PL + 6, 1), (PR - 1, -1)):
        for k in range(LW):
            xx = x0 + d * k
            top = 17 + k                                           # 윗변(대각선)
            bot = GY - 7 + k                                       # 밑변(대각선, 땅에 닿는 선)
            c.P(xx, top, K('metal', 7 if k % 3 else 6)); c.P(xx, top + 1, K('metal', 6)); c.P(xx, top + 2, K('metal', 4))
            rib = (5, 4, 2)[k % 3] - (1 if k > 5 else 0)           # 골강판 골: 등(빛) → 골(그늘), 끝으로 갈수록 그늘
            for j in range(top + 3, bot):
                v = (j - top - 3) / float(max(1, bot - top - 3))
                t = rib + (1 if v < 0.12 else 0) - (1 if v > 0.65 else 0) - (1 if v > 0.88 else 0)
                if h2(xx, j, 41) % 9 == 0: t -= 1
                c.P(xx, j, K('metal', max(1, min(7, t))))
            for j in (top + 7, top + 15): c.P(xx, j, K('metal', 1)); c.P(xx, j + 1, K('metal', 5 if k < 5 else 4))   # 가로 띠(그늘 + 아래 빛)
            if k in (1, 7): c.P(xx, top + 7, K('metal', 7))                                            # 리벳
            c.P(xx, bot, K('metal', 1))
            if k in (2, 5):
                for j in range(top + 9, bot - 1):                                                       # 녹물 줄(띠 밑으로 흘러내림)
                    if h2(xx, j // 3, 42) % 3: c.P(xx, j, K('rust', 2 if j % 4 else 3))
        c.shadow([(x0 + d * k, GY - 6 + k) for k in range(LW)] + [(x0 + d * k, GY - 5 + k) for k in range(1, LW)])
    rust_patch(c, 0, 19, 48, 29, seed=4, dens=0.3, on=set(MAT['metal']))
    # 가로보(기둥 사이, 윗면 4행 + 앞면 3행)
    for x in range(PL + 5, PR + 1):
        for j, t in enumerate((5, 5, 4, 4)):
            g = h2(x // 5, j, 44) % 5                                                                  # 보 윗면 결(가로로 길게 끊기는 줄)
            c.P(x, 10 + j, K('wood', t - (1 if g == 0 else 0) + (1 if g == 1 and t < 5 else 0)))
        c.P(x, 10, K('wood', 3)); c.P(x, 14, K('wood', 3) if x % 7 else K('wood', 4)); c.P(x, 15, K('wood', 2)); c.P(x, 16, K('wood', 1))
    for x in range(PL + 7, PR, 11): c.HL(x, 12, 3, K('wood', 2))                                      # 갈라진 틈
    for x in range(9, 40, 6): c.P(x, 12, K('metal', 6))
    c.R(19, 14, 10, 4, K('rust', 3)); c.HL(19, 14, 10, K('rust', 5)); c.HL(19, 17, 10, K('rust', 1)); c.VL(28, 14, 4, K('rust', 2))   # 보에 박은 녹 판(빈 표지)
    for x in (20, 27): c.P(x, 15, K('metal', 6))
    # 기둥(6폭): 머리 윗면 5행(보보다 위로 솟음) + 몸
    for x in (PL, PR):
        for j, row in enumerate(['NTTTTN', 'NTTTAN', 'NTTAAN', 'NTAAAN', 'NAAAAN']):
            for i, ch in enumerate(row): c.P(x + i, 5 + j, {'N': K('wood', 1), 'T': K('wood', 5), 'A': K('wood', 4)}[ch])
        for j in range(10, GY + 1):
            g = h2(x, j // 4, 43) % 4                                                                  # 나뭇결(세로 줄이 끊겼다 이어짐)
            c.P(x, j, K('wood', 1)); c.P(x + 1, j, K('wood', 5 if g == 0 else 4)); c.P(x + 2, j, K('wood', 3 if g != 1 else 4))
            c.P(x + 3, j, K('wood', 2) if (j + g) % 5 else K('wood', 3)); c.P(x + 4, j, K('wood', 1 if g != 2 else 2)); c.P(x + 5, j, K('wood', 0))
        for (kx, ky) in ((2, 16), (3, 29), (2, 40)):                                                   # 옹이 · 갈라짐
            c.P(x + kx, ky, K('wood', 1)); c.P(x + kx + 1, ky, K('wood', 2)); c.P(x + kx, ky - 1, K('wood', 5))
        c.VL(x + 3, 24, 6, K('wood', 1))
        c.HL(x + 1, 10, 4, K('wood', 2)); c.HL(x + 1, 11, 4, K('wood', 3))
        for j in (22, 34): c.HL(x, j, 6, K('metal', 3)); c.HL(x, j + 1, 6, K('metal', 1)); c.P(x + 2, j, K('metal', 6))   # 쇠 띠
    c.shadow([(PL + 6, j) for j in range(GY - 1, GY + 2)] + [(i, GY + 1) for i in range(PL, PL + 7)] + [(i, GY + 2) for i in range(PL + 1, PL + 7)]
             + [(i, GY + 1) for i in range(PR, PR + 6)] + [(i, GY + 2) for i in range(PR + 1, PR + 6)])
    c.outline()
