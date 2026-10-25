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
    husk(c, 96, 80, 30, seed=3, gaps=[(58, 80, 7)], door=(36, 11, 18), north_gap=(66, 84),
         windows=[(6, 7, 9, 7), (20, 7, 9, 7), (58, 12, 9, 6), (76, 8, 9, 7), (6, 0, 0, 0)][:4], band=(4,))


@piece('husk-b', '모서리 무너진 폐허', 5, 4, STRUCT, en='ruined concrete building whose front corner has collapsed into a rubble ramp, seen from above with walls, interior floor and front face',
       group='ruins', tags=['폐허', '건물'], desc='한쪽 앞 모서리가 무너져 잔해 비탈이 된 폐허. 문은 왼쪽.',
       solid=[(x, y) for y in (2, 3) for x in range(5)], door=(1, 3))
def _husk_b(c):
    """4판: 지붕 없는 껍데기를 위에서 — 벽 윗면은 밝은 4행 띠(창 없음), 안쪽 바닥은 따뜻하고 어두운 흙·깨진 타일·잔해,
    북벽 안쪽 면은 3행 그늘 띠뿐, 창·문은 남쪽 앞면에만, 무너진 동남 모서리는 바닥에서 땅까지 이어지는 잔해 비탈(투명 없음)."""
    W, H, t = 80, 64, 4
    ty = 40                                                    # 남벽 앞면 윗줄(앞면 24행)
    fy0, fy1 = 1 + t + 3, ty - t                               # 바닥 행 범위
    # 1) 바닥(먼저, 넓게 — 무너진 모서리 뒤까지)
    ruin_floor(c, t, fy0, W - t, fy1 - fy0 + 2, seed=11)
    # 북벽 안쪽 면: 3행 그늘(창 없음) + 바닥에 지는 그늘
    for x in range(t, W - t):
        c.P(x, 1 + t, K('conc', 3 if h2(x, 1, 3) % 5 else 2)); c.P(x, 2 + t, K('conc', 2)); c.P(x, 3 + t, K('conc', 1 if h2(x, 2, 3) % 4 else 2))
    shade_rect(c, t, fy0, W - 2 * t, 2, 1)
    shade_rect(c, t, fy0, 3, fy1 - fy0, 1)                     # 서벽이 바닥 동쪽으로 던지는 그늘
    # 2) 벽 윗면 띠: 북(0~4행) · 서 · 동(동벽은 24행에서 부러짐) · 남(36~39행, 서쪽 50화소만)
    top_band(c, 0, 1, W, t, seed=1)
    top_band(c, 0, 1, t, ty - 1, seed=2, vertical=True)
    top_band(c, W - t, 1, t, 24, seed=3, vertical=True)
    top_band(c, 0, ty - t, 50, t, seed=4)
    # 3) 남벽 앞면(서쪽 50화소): 창 두 개 + 문, 층 띠, 그을음·때
    conc_face(c, 0, ty, 50, 24, seed=16, base=3, band=(12,), grime=3)
    c.HL(0, ty, 50, K('conc', 2))
    wins = [(4, 4, 8, 6), (34, 4, 8, 6)]
    for (wx, wy, ww, wh) in wins: hole(c, wx, ty + wy, ww, wh, seed=wx)
    soot_plume(c, 34, ty + 4, 8, 4, seed=2)
    dx, dw, dh = 18, 10, 17
    c.R(dx - 1, H - dh - 2, dw + 2, 2, K('conc', 5)); c.HL(dx - 1, H - dh - 1, dw + 2, K('conc', 2))
    for j in range(dh):
        for i in range(dw): c.P(dx + i, H - dh + j, K('soot', 0 if j < dh - 4 else 1 if j < dh - 1 else 2))
    c.VL(dx, H - dh, dh, K('soot', 1)); c.HL(dx, H - 1, dw, K('dirt', 2))
    vine(c, 45, ty, 14, seed=3)
    # 4) 부러진 벽 끝: 남벽 동쪽 끝(계단처럼 깨진 단면) · 동벽 남쪽 끝
    for (yy, xe) in ((ty - 4, 50), (ty - 3, 51), (ty - 2, 50), (ty - 1, 49), (ty, 49), (ty + 1, 48), (ty + 2, 48)):
        c.P(xe - 1, yy, K('conc', 6)); c.P(xe, yy, K('conc', 4))
    for y in range(ty + 3, H): c.clear(48, y, 3)
    for y in range(ty + 3, H): c.P(47, y, K('conc', 2))
    for x in range(W - t, W): c.P(x, 25, K('conc', 7)); c.P(x, 26, K('conc', 4)); c.P(x, 27, K('conc', 2))
    rebar(c, 50, ty - 4, 5, 2); rebar(c, 77, 24, 4, 1); rebar(c, 78, 23, 3, -1)
    # 5) 잔해 비탈: 무너진 모서리를 바닥 높이에서 땅까지 메운다(덩이 윗면 밝게, 앞 덩이가 뒤를 덮음)
    rubble_slope(c, 46, W, 26, H, seed=5)
    grit(c, 0, 0, 50, 64, seed=17, rate=23, cracks=2)
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


@piece('husk-tall', '층 남은 고층 폐허 정면', 4, 6, STRUCT, en='tall ruined multi-storey concrete facade remnant: top of the remaining walls and broken upper floor slabs seen from above, tall front face with rows of empty windows',
       group='ruins', tags=['폐허', '건물', '고층'], desc='지붕이 사라진 여러 층 건물의 남은 정면. 위로 부러진 층 바닥판과 벽 윗면이 보이고, 높은 앞면에 빈 창 줄.',
       solid=[(x, y) for y in (4, 5) for x in range(4)], door=(1, 5))
def _husk_tall(c):
    """4판: 층마다 튀어나온 바닥판 모서리(밝은 윗턱 2행 + 어두운 밑면 + 벽에 지는 그늘), 5단 담쟁이 기둥 둘, 창 위 그을음,
    깨진 창틀·유리 조각, 창턱 아래 빗물 자국·녹물 줄 — 고른 잔점 대신 넓은 얼룩. 윗부분은 벽 윗면 띠 + 깊은 속(무너진 바닥판)."""
    W, H = 64, 96
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
    slabs = (56, 75)
    wins = [(5, 42), (20, 42), (49, 42), (5, 61), (35, 61), (49, 61), (5, 81), (44, 81)]
    for k, (wx, wy) in enumerate(wins): broken_window(c, wx, wy, 9, 8, seed=k)
    for (wx, wy) in ((20, 42), (35, 61), (5, 81)): soot_plume(c, wx, wy, 9, 5, seed=wx + wy)
    big_hole = (34, 42, 11, 9)                                  # 포탄에 뚫린 큰 구멍(속에 걸린 철근)
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
    dx, dw, dh = 20, 11, 16
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
    c.R(40, 88, 7, 5, K('metal', 3)); c.HL(40, 88, 7, K('metal', 6)); c.HL(40, 89, 7, K('metal', 5)); c.VL(46, 89, 4, K('metal', 1)); c.P(42, 91, K('soot', 0)); c.P(43, 91, K('soot', 1))
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


@piece('shack-a', '고철 판잣집', 3, 3, STRUCT, en='small scrap-metal shack: patched corrugated sheet roof seen from above as a sloped top plane, front wall of mixed scrap sheets with a plank door',
       group='shacks', tags=['판잣집', '건물'], desc='골강판 지붕을 여러 금속으로 덧댄 작은 판잣집. 앞벽은 고철 판, 가운데 판자 문.',
       solid=[(0, 2), (1, 2), (2, 2), (0, 1), (1, 1), (2, 1)], door=(1, 2))
def _shack_a(c):
    tin_roof(c, 1, 2, 46, 22, ins=3, seed=4, patches=[(6, 6, 10, 7, 'rust'), (27, 12, 12, 6, 'tarp')])
    scrap_wall(c, 2, 25, 44, 21, seed=5)
    plank_door(c, 19, 30, 10, 16, seed=2)
    c.R(36, 30, 6, 5, K('soot', 0)); c.HL(36, 30, 6, K('soot', 2)); c.HL(35, 35, 8, K('wood', 4)); c.VL(39, 30, 5, K('wood', 1))   # 작은 창(판자 십자)
    c.R(5, 40, 5, 6, K('rust', 2)); c.HL(5, 40, 5, K('rust', 4))                                                                    # 기댄 녹 판
    c.outline()


@piece('shack-b', '큰 판잣집', 4, 4, STRUCT, en='larger scrap-metal shack seen from above: patched corrugated roof with a tarp patch and a stovepipe chimney, scrap front wall with plank door and boarded window',
       group='shacks', tags=['판잣집', '건물'], desc='연통과 방수포를 덧댄 큰 판잣집. 앞벽에 판자 문과 판자로 막은 창.',
       solid=[(0, 3), (1, 3), (2, 3), (3, 3), (0, 2), (1, 2), (2, 2), (3, 2)], door=(2, 3))
def _shack_b(c):
    tin_roof(c, 1, 4, 62, 32, ins=4, seed=9, patches=[(30, 4, 20, 13, 'tarp'), (5, 18, 12, 8, 'rust'), (44, 22, 10, 6, 'blue')])
    # 방수포를 누르는 타이어·밧줄
    c.ell(40, 12, 3, 2, K('rubber', 1)); c.P(40, 12, K('rubber', 0)); c.HL(38, 10, 4, K('rubber', 4))
    c.line(31, 8, 50, 16, K('wood', 4))
    # 연통: 둥근 굴뚝 윗면(타원 입구) + 몸통 + 테
    c.R(12, 0, 6, 13, K('metal', 3)); c.VL(12, 0, 13, K('metal', 5)); c.VL(17, 0, 13, K('metal', 1))
    c.HL(11, 4, 8, K('metal', 6)); c.HL(11, 5, 8, K('metal', 2))
    c.R(12, 0, 6, 2, K('soot', 0)); c.HL(12, 2, 6, K('metal', 6))
    c.R(13, 13, 4, 2, K('soot', 3))
    scrap_wall(c, 2, 37, 60, 26, seed=12)
    plank_door(c, 36, 44, 11, 19, seed=6)
    c.R(9, 43, 14, 9, K('soot', 0)); c.HL(9, 51, 14, K('conc', 5))
    for (yy) in (44, 47, 50): c.HL(8, yy, 16, K('wood', 3)); c.HL(8, yy + 1, 16, K('wood', 1))
    c.R(52, 55, 7, 8, K('wood', 2)); c.HL(52, 55, 7, K('wood', 4)); c.HL(52, 56, 7, K('wood', 3)); c.VL(58, 56, 7, K('wood', 1))   # 문 옆 나무 상자
    grit(c, 0, 0, 64, 37, mat='metal', seed=13, rate=13)
    grit(c, 0, 37, 64, 27, mat='rust', seed=14, rate=19)
    c.outline()


@piece('lean-to', '방수포 차양 움막', 3, 2, STRUCT, en='tarp lean-to shelter: sloped tarp roof seen from above held by poles, open front with dark inside, bedroll and crate',
       group='shacks', tags=['판잣집', '움막'], desc='기둥 두 개에 방수포를 기울여 친 움막. 앞이 트여 속에 깔개·상자가 보인다.', solid=[(0, 1), (1, 1), (2, 1)], door=(1, 1))
def _lean_to(c):
    """4판: 방수포를 위에서 본 기운 지붕판으로 — 뒤 높은 가장자리가 가장 밝고 앞 낮은 가장자리로 어두워진다,
    앞 기둥 둘 사이로 처진 앞단(가운데가 내려옴), 기둥 머리에서 뻗는 당김 주름, 덧댄 천, 들쭉날쭉한 옆단,
    기둥 머리(윗면) · 땅 말뚝까지 당김 줄, 처진 앞단 밑 그늘 속에 깔개 두루마리·상자·깡통."""
    W = 48
    def front(x):                                               # 앞단 행: 기둥(3·44) 사이에서 가운데가 3행 처진다
        u = (x - 4) / 40.0
        return 17 + int(round(3.2 * (1 - (2 * u - 1) ** 2))) if 4 <= x <= 44 else 17
    def back(x): return 2 + (1 if h2(x // 3, 0, 5) % 4 == 0 else 0)
    def left(y): return 3 - (y - 2) // 6 + (1 if h2(0, y // 3, 6) % 3 == 0 else 0)
    def right(y): return 45 + (y - 2) // 6 - (1 if h2(1, y // 3, 6) % 3 == 0 else 0)
    # 1) 속(처진 앞단 밑 그늘) — 지붕보다 먼저
    for y in range(17, 31):
        for x in range(3, 45):
            v = y - 17
            if v < 5: col = K('soot', 0 if v < 3 else 1)
            elif v < 8: col = K('soot', 2) if h2(x, y, 1) % 3 else K('dirt', 0)
            else: col = dirt_px(x, y, 0) if v > 10 else K('dirt', 1 if h2(x, y, 2) % 2 else 2)
            c.P(x, y, col)
    # 깔개 두루마리(동서로 누운 원통을 위에서: 윗면 3행 밝게, 아래 그늘, 서쪽 끝 말린 면) + 베개 자루
    for x in range(8, 24):
        for j, tt in enumerate((5, 4, 4, 3, 2, 1)): c.P(x, 23 + j, K('army', tt - (1 if (x - 8) % 5 == 0 and j > 0 else 0)))
    for (dx, dy, tt) in ((0, 0, 4), (0, 1, 3), (0, 2, 2), (0, 3, 2), (0, 4, 1), (1, 2, 1)): c.P(7 + dx, 23 + dy, K('army', tt))
    c.HL(10, 25, 12, K('wood', 2)); c.P(16, 24, K('wood', 4))   # 묶은 끈
    # 상자(윗면 4행 + 앞면 3행)
    c.R(29, 22, 9, 4, K('wood', 4)); c.HL(29, 22, 9, K('wood', 3)); c.HL(29, 25, 9, K('wood', 5)); c.VL(33, 22, 4, K('wood', 3))
    planks(c, 29, 26, 9, 3, 'wood', 2, pw=3, seed=5, nails=False); c.HL(29, 28, 9, K('wood', 1))
    c.R(39, 25, 3, 2, K('metal', 6)); c.R(39, 27, 3, 2, K('metal', 3)); c.P(41, 27, K('metal', 1)); c.P(40, 25, K('metal', 7))   # 깡통(윗면 + 몸)
    # 2) 방수포 지붕판
    for y in range(1, 22):
        for x in range(0, W):
            if y < back(x) or y > front(x) or x < left(y) or x > right(y): continue
            d = (y - back(x)) / max(1, front(x) - back(x))           # 0 뒤 … 1 앞
            tt = 6 if d < 0.12 else 5 if d < 0.32 else 4 if d < 0.58 else 3 if d < 0.85 else 2
            # 당김 주름: 앞 기둥 머리(4,17)·(43,17)에서 뒤 가운데 쪽으로 뻗는 빛 줄 + 그 아래 그늘 줄
            for (px, sgn) in ((4, 1), (43, -1)):
                k = (x - px) * sgn - (17 - y) * 1.6
                if 0 <= (x - px) * sgn <= 18 and -0.6 < k < 0.6: tt = min(6, tt + 2)
                elif 0 <= (x - px) * sgn <= 18 and 0.6 <= k < 1.8: tt = max(1, tt - 2)
            if 16 <= x <= 32 and front(x) - 4 <= y <= front(x) - 1 and (x + y) % 5 == 0: tt = max(1, tt - 1)    # 가운데 처짐 잔주름
            c.P(x, y, K('tarp', tt))
    for x in range(0, W):                                       # 뒤 가장자리 빛 테 · 앞단 두께(접힌 단, 아래 그늘)
        b, f = back(x), front(x)
        if left(b) <= x <= right(b): c.P(x, b, K('tarp', 6 if x % 7 else 5))
        if left(f) <= x <= right(f):
            c.P(x, f, K('tarp', 3)); c.P(x, f + 1, K('tarp', 1)); c.P(x, f + 2, K('soot', 0)) if 4 < x < 43 else None
    # 덧댄 천(비뚤어진 네 변 · 가장자리 박음질만) — 군용 녹색 · 바랜 파랑
    for (x, y, w, h, m, sk) in ((13, 5, 8, 5, 'army', 1), (31, 8, 7, 4, 'blue', -1)):
        for j in range(h):
            o = (j * sk) // 2
            for i in range(w - (1 if j == h - 1 else 0)):
                d = (y + j - 2) / 17.0
                tt = (5 if d < 0.3 else 4 if d < 0.6 else 3) - (1 if i == w - 1 else 0) + (1 if i == 0 else 0)
                c.P(x + i + o, y + j, K(m, tt))
            if j % 2 == 0: c.P(x + o, y + j, K(m, 2)); c.P(x + o + w - 1, y + j, K(m, 2))
        for i in range(0, w, 2): c.P(x + i, y, K(m, 2))
        c.HL(x + (h * sk) // 2, y + h, w - 1, K('tarp', 1))
    # 처진 가운데에 고인 빗물(위에서 본 납작한 웅덩이: 짙은 물 + 위쪽 빛 테 + 반짝)
    for j in range(3):
        for i in range(-6 + j * 2 - (1 if j == 0 else 0), 7 - j * 2):
            c.P(24 + i, 15 + j, K('tarp', 1 if j else 2))
    c.HL(20, 14, 9, K('tarp', 5)); c.P(21, 15, K('glass', 6)); c.P(22, 15, K('glass', 4))
    rust_patch(c, 0, 1, W, 20, seed=3, dens=0.12, mat='brust', on=set(MAT['tarp'][:4]))
    # 3) 앞 기둥(머리 윗면 3행 + 몸) · 당김 줄 · 땅 말뚝
    for x in (2, 42):
        c.rows(x, 14, ['abbc', 'bbbc', 'cccd'], {'a': K('wood', 5), 'b': K('wood', 4), 'c': K('wood', 3), 'd': K('wood', 1)})
        for y in range(17, 31):
            c.P(x, y, K('wood', 1)); c.P(x + 1, y, K('wood', 4)); c.P(x + 2, y, K('wood', 3)); c.P(x + 3, y, K('wood', 1))
        c.HL(x, 17, 4, K('wood', 2)); c.HL(x, 18, 4, K('wood', 2))
    c.line(2, 15, 0, 29, K('wood', 4)); c.P(0, 30, K('wood', 2)); c.P(1, 30, K('wood', 4))
    c.line(45, 15, 47, 29, K('wood', 4)); c.P(47, 30, K('wood', 2)); c.P(46, 30, K('wood', 4))
    c.P(8, 2, K('wood', 2)); c.P(8, 1, K('wood', 4)); c.P(39, 2, K('wood', 2)); c.P(39, 1, K('wood', 4))     # 뒤 묶은 매듭
    c.shadow([(x, 31) for x in range(2, 46)] + [(x, 30) for x in range(5, 42)])
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


@piece('gate-scrap', '고철 대문', 2, 2, STRUCT, en='open scrap-metal gateway seen from above: two heavy posts with their top caps, a crossbeam with its top surface between them, two corrugated gate leaves swung open flat, walkable opening in the middle',
       group='defense', tags=['문', '울타리'], desc='고철 대문(열림). 가운데로 지나간다(기둥 칸도 막지 않는다 — 양옆 울타리가 막는다).', solid=[], door=None)
def _gate_scrap(c):
    # 열어 젖힌 문짝(바닥 쪽으로 눕듯 젖혀진 판: 윗변 두께 3행 + 판 6행)
    for (x0, d) in ((7, 1), (24, -1)):
        for k in range(7):
            xx = x0 + (k if d > 0 else -k)
            top = 19 + k // 2
            c.P(xx, top, K('metal', 6)); c.P(xx, top + 1, K('metal', 6)); c.P(xx, top + 2, K('metal', 5))
            for j in range(3, 9): c.P(xx, top + j, K('metal', 3 + (1 if (xx % 3) == 0 else 0) - (1 if j > 6 else 0)))
            c.P(xx, top + 9, K('metal', 1))
    rust_patch(c, 0, 18, 32, 14, seed=4, dens=0.4, on=set(MAT['metal']))
    # 가로보(기둥 사이, 윗면 5행 + 앞면 3행)
    for x in range(5, 27):
        for j, t in enumerate((4, 5, 5, 4, 5)): c.P(x, 6 + j, K('wood', t if (x + j * 3) % 9 else t - 1))
        c.P(x, 6, K('wood', 3)); c.P(x, 11, K('wood', 3)); c.P(x, 12, K('wood', 2)); c.P(x, 13, K('wood', 1))
    for x in range(8, 26, 6): c.P(x, 8, K('metal', 6))
    c.R(12, 12, 8, 3, K('rust', 3)); c.HL(12, 12, 8, K('rust', 5)); c.HL(12, 14, 8, K('rust', 1))     # 매단 녹 판(빈 표지)
    c.shadow([(x, 14) for x in range(5, 12)] + [(x, 15) for x in range(20, 27)])
    # 기둥(6폭): 머리 윗면 5행(보보다 위로 솟음) + 몸
    for x in (0, 26):
        for j, row in enumerate(['NTTTTN', 'NTTTAN', 'NTTAAN', 'NTAAAN', 'NAAAAN']):
            for i, ch in enumerate(row): c.P(x + i, 1 + j, {'N': K('wood', 1), 'T': K('wood', 5), 'A': K('wood', 4)}[ch])
        for j in range(6, 30):
            c.P(x, j, K('wood', 1)); c.P(x + 1, j, K('wood', 4)); c.P(x + 2, j, K('wood', 3)); c.P(x + 3, j, K('wood', 2) if j % 5 else K('wood', 3)); c.P(x + 4, j, K('wood', 1)); c.P(x + 5, j, K('wood', 0))
        c.HL(x + 1, 6, 4, K('wood', 2))
        c.shadow([(x + 6, j) for j in range(29, 32)] + [(x + i, 30) for i in range(6)] + [(x + i, 31) for i in range(1, 7)])
    c.outline()
