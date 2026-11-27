"""building-kit fantasy-kingdom style-r9 후보 — Lv.1/Lv.2 확장 부품(아치 회랑·쇼윈도·초가/유리 지붕·어닝·발코니·지붕창·간판·왼쪽 외쪽).

기존 style-r8(→style-r5) 부품을 reuseParts 로 이어받고, r5 의 gable.step·roof.gf.back·roof.lean.side 를
그대로 재수출하며 새 Lv.2 부품 8종 + roof.lean.left 를 줄 A·B·C 마다 구조·재질을 달리해 그린다. hex 색 금지.
"""
import dot
import style_r5 as R5

ROUND = 'style-r9'
WAVE = 'style'
NOTES = {}
THEME = 'fantasy-kingdom'

TOK = {
    'r0': ('roof', 0), 'r1': ('roof', 1), 'r2': ('roof', 2), 'r3': ('roof', 3), 'r4': ('roof', 4),
    's0': ('slate', 0), 's1': ('slate', 1), 's2': ('slate', 2), 's3': ('slate', 3),
    'g0': ('shingle', 0), 'g1': ('shingle', 1), 'g2': ('shingle', 2), 'g3': ('shingle', 3),
    'g4': ('shingle', 4), 'g5': ('shingle', 5), 'g6': ('shingle', 6),
    'p0': ('plaster', 0), 'p1': ('plaster', 1), 'p2': ('plaster', 2), 'p3': ('plaster', 3), 'p4': ('plaster', 4),
    't0': ('timber', 0), 't1': ('timber', 1), 't2': ('timber', 2), 't3': ('timber', 3),
    't4': ('timber', 4), 't5': ('timber', 5), 't6': ('timber', 6),
    'w0': ('wood', 0), 'w1': ('wood', 1), 'w2': ('wood', 2), 'w3': ('wood', 3),
    'w4': ('wood', 4), 'w5': ('wood', 5), 'w6': ('wood', 6),
    'k0': ('stone', 0), 'k1': ('stone', 1), 'k2': ('stone', 2), 'k3': ('stone', 3), 'k4': ('stone', 4), 'k5': ('stone', 5),
    'a0': ('ashlar', 0), 'a1': ('ashlar', 1), 'a2': ('ashlar', 2), 'a3': ('ashlar', 3),
    'a4': ('ashlar', 4), 'a5': ('ashlar', 5), 'a6': ('ashlar', 6),
    'i0': ('iron', 0), 'i1': ('iron', 1), 'i2': ('iron', 2), 'i3': ('iron', 3),
    'v0': ('grass', 0), 'v1': ('grass', 1), 'v2': ('grass', 2), 'v3': ('grass', 3), 'v5': ('grass', 5),
}


def _grid_tokens(rows, token_map):
    used = sorted({tok for r in rows for tok in r if tok != '.'})
    syms = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
    t2c = {tok: syms[idx] for idx, tok in enumerate(used)}
    leg = dot.legend(THEME, **{c: token_map[tok] for tok, c in t2c.items()})
    str_rows = [''.join('.' if tok == '.' else t2c[tok] for tok in r) for r in rows]
    return dot.grid(str_rows, leg)


# ---------------------------------------------------------------------------
# 1. roof.lean.left (7x1 = 112x16: lb2[0:32], hi[32:48], m[48:64], lo[64:80], lf2[80:112])
# ---------------------------------------------------------------------------
def _make_lean_left(line):
    if line == 'A':
        dark, mid, lit, hi_c = 'r0', 'r1', 'r2', 'r3'
        wall_dark, wall_mid, wall_lit = 't1', 'p1', 'p3'
    elif line == 'B':
        dark, mid, lit, hi_c = 's0', 's1', 's2', 's3'
        wall_dark, wall_mid, wall_lit = 'a1', 'a3', 'a5'
    else:
        dark, mid, lit, hi_c = 'g1', 'g3', 'g4', 'g5'
        wall_dark, wall_mid, wall_lit = 'w1', 'w3', 'w4'

    def slope_px(x, y, band_kind):
        # y=0 과 y=15 가 모두 중간톤이 되도록 위상 이동(세로 반복 S 이음 매끄럽게)
        if line == 'A':
            col = (x + 2) // 4
            xx = (x + 2) % 4
            yy = (y + 1 + 2 * (col % 2)) % 4
            if band_kind == 'hi' and x == 15:
                return mid
            if band_kind == 'lo' and x == 0:
                return mid
            if yy == 2 or xx == 3:
                return mid
            if xx == 0 and yy == 1:
                return hi_c
            return lit
        if line == 'B':
            # 슬레이트: y=2,6,10,14 에 줄눈(y=0,15 둘 다 lit)
            yy = (y + 2) % 4
            row_i = ((y + 2) // 4) % 2
            xx = (x + 2 + 4 * row_i) % 8
            if yy == 0 or xx == 0:
                return mid
            if yy == 1 and xx in (2, 3):
                return hi_c
            return lit
        # C: 너와 나무 널(y=2,6,10,14 에 어두운 줄눈, x=0/15 및 y=0/15 모두 lit)
        yy = (y + 2) % 4
        row_i = ((y + 2) // 4) % 2
        xx = (x + 2 * row_i) % 4
        if yy == 0:
            return mid
        if yy == 1 and xx == 2:
            return hi_c
        return lit if xx in (0, 3) else mid

    rows = []
    for y in range(16):
        r = ['.'] * 112
        for x in range(32):
            edge = (31 - x) * 10 // 31
            if y < edge:
                r[x] = '.'
            elif y == edge:
                r[x] = hi_c if x > 8 else mid
            elif y == edge + 1:
                r[x] = lit
            else:
                r[x] = slope_px(x % 16, y, 'lo' if x < 16 else 'hi')
        for x in range(16):
            r[32 + x] = slope_px(x, y, 'hi')
            r[48 + x] = slope_px(x, y, 'm')
            r[64 + x] = slope_px(x, y, 'lo')
        for x in range(32):
            eave = 2 + (31 - x) * 9 // 31
            if y < eave - 1:
                r[80 + x] = slope_px(x % 16, y, 'lo' if x < 16 else 'hi')
            elif y == eave - 1:
                r[80 + x] = hi_c if x > 4 else mid
            elif y in (eave, eave + 1):
                r[80 + x] = dark
            elif y == 15:
                r[80 + x] = wall_dark
            else:
                if line == 'A':
                    r[80 + x] = wall_dark if x in (0, 1, 15, 16, 30, 31) else (wall_lit if x < 18 else wall_mid)
                elif line == 'B':
                    r[80 + x] = wall_dark if (x % 8 == 0 or y % 4 == 0) else wall_lit
                else:
                    r[80 + x] = wall_dark if y % 3 == 0 else wall_mid
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 왼쪽 외쪽 지붕 ({line})'}


# ---------------------------------------------------------------------------
# 2. wall.arcade (5x2 = 80x32: l, m, w, d, r — 1층 아치 회랑)
# ---------------------------------------------------------------------------
def _make_wall_arcade(line):
    if line == 'A':
        pier_d, pier_m, pier_l, pier_h = 'k0', 'k2', 'k3', 'k4'
        trim, void_d, void_m = 't1', 't0', 'k1'
        door_d, door_m, door_l = 't1', 't3', 't5'
    elif line == 'B':
        pier_d, pier_m, pier_l, pier_h = 'a0', 'a2', 'a4', 'a5'
        trim, void_d, void_m = 'i0', 'i0', 'a1'
        door_d, door_m, door_l = 'i0', 'i2', 'i3'
    else:
        pier_d, pier_m, pier_l, pier_h = 'w1', 'w3', 'w4', 'w5'
        trim, void_d, void_m = 'w0', 'w0', 'w2'
        door_d, door_m, door_l = 'w1', 'w3', 'w5'

    def arch_cut(lx, y):
        if line == 'A':
            dx, dy = lx - 7.5, y - 13.5
            return (y >= 14 and 3 <= lx <= 12) or (y >= 8 and (dx * dx + dy * dy) <= 23.0)
        if line == 'B':
            half = max(0, min(5, (y - 5) // 2 + 1)) if y >= 5 else -1
            return (y >= 15 and 3 <= lx <= 12) or (6 <= y < 15 and abs(lx - 7.5) <= half)
        if y < 8:
            return False
        if y < 12:
            inset = 12 - y
            return (2 + inset) <= lx <= (13 - inset)
        return 2 <= lx <= 13

    def cell_px(piece_idx, lx, y):
        if y == 0:
            return trim
        if y == 1:
            return pier_d
        if y >= 30:
            if piece_idx == 3 and 4 <= lx <= 11:
                return pier_m if y == 30 else pier_d
            return pier_d if y == 31 else (pier_m if lx % 4 != 0 else pier_d)
        if y in (2, 3):
            if lx in (7, 8) and y == 3:
                return pier_h
            return pier_l if y == 2 else pier_m
        if piece_idx == 3:
            if arch_cut(lx, y):
                if y == 9 or lx in (3, 12):
                    return door_d
                if y in (16, 23):
                    return 'i1' if line != 'C' else door_d
                if lx == 7:
                    return door_d
                if lx == 10 and y == 20:
                    return 'r4' if line == 'A' else 'k4'
                return door_l if lx < 7 else door_m
            if y >= 5 and (arch_cut(lx - 1, y) or arch_cut(lx + 1, y) or arch_cut(lx, y + 1)):
                return pier_h if lx <= 7 else pier_m
            return pier_l if lx < 6 else pier_m
        if piece_idx in (0, 4):
            if (piece_idx == 0 and lx == 0) or (piece_idx == 4 and lx == 15):
                return pier_d
            if y in (10, 18, 26):
                return pier_d if lx % 3 == 0 else pier_m
            if piece_idx == 0 and lx in (4, 5, 6) and 11 <= y <= 19:
                return void_d if lx == 4 else void_m
            if piece_idx == 4 and lx in (9, 10, 11) and 11 <= y <= 19:
                return void_d if lx == 11 else void_m
            return pier_h if (lx < 8 and (y // 4 + lx // 4) % 2 == 0) else pier_m
        if arch_cut(lx, y):
            if y >= 27:
                return void_m if y == 27 else pier_d
            if piece_idx == 2 and y in (14, 15, 16) and lx in (7, 8):
                return 'r4' if line == 'A' else ('s3' if line == 'B' else 'g5')
            if piece_idx == 2 and y >= 22 and 4 <= lx <= 11:
                return door_m if y % 2 == 0 else door_d
            return void_d if (y < 18 or lx < 5) else void_m
        if arch_cut(lx - 1, y) or arch_cut(lx + 1, y) or arch_cut(lx, y + 1):
            return pier_h if lx <= 7 else pier_d
        if lx in (0, 15):
            return pier_d if y % 4 == 0 else pier_m
        if lx in (1, 2):
            return pier_h if y % 5 != 0 else pier_l
        return pier_m if lx > 11 else pier_l

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 1층 아치 회랑 벽 ({line})'}


# ---------------------------------------------------------------------------
# 3. wall.shop (5x2 = 80x32: l, m, w, d, r — 상점 쇼윈도 벽)
# ---------------------------------------------------------------------------
def _make_wall_shop(line):
    if line == 'A':
        wd, wm, wl = 't1', 't3', 't5'
        bg_l, bg_m, bg_d = 'p3', 'p1', 'k1'
        gl_d, gl_m, gl_h = 's1', 's2', 'p4'
        goods = ('r3', 'r4', 'g5')
    elif line == 'B':
        wd, wm, wl = 'a1', 'a3', 'a5'
        bg_l, bg_m, bg_d = 'a4', 'a2', 'a0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        goods = ('s3', 'k4', 'i2')
    else:
        wd, wm, wl = 'w1', 'w3', 'w5'
        bg_l, bg_m, bg_d = 'w4', 'w2', 'w0'
        gl_d, gl_m, gl_h = 's1', 's2', 'p3'
        goods = ('g6', 'r3', 'v3')

    def cell_px(pidx, lx, y):
        if y == 0:
            return wd
        if y == 1:
            return bg_d
        if y >= 30:
            if pidx == 3 and 4 <= lx <= 11:
                return 'k2' if y == 30 else 'k0'
            return 'k0' if y == 31 else 'k2'
        # 모든 조각 경계 열(lx=0, 15)을 같은 기둥(wm/wd)으로 맞춰 가로 이음 J 보장
        if pidx == 0 and lx == 15:
            return wm if y % 4 != 0 else wd
        if pidx == 4 and lx == 0:
            return wm if y % 4 != 0 else wd
        if pidx in (0, 4):
            if (pidx == 0 and lx in (0, 1)) or (pidx == 4 and lx in (14, 15)):
                return wd if y % 4 == 0 else wm
            if y in (6, 22):
                return wd
            if y > 22:
                return wm if lx % 3 != 0 else wd
            return bg_l if lx < 8 else bg_m
        if pidx == 3:
            if lx in (0, 15):
                return wm if y % 4 != 0 else wd
            if lx in (1, 14):
                return wm
            if y in (3, 4, 9, 10):
                return wd
            if 5 <= y <= 8 and 3 <= lx <= 12:
                return gl_h if (lx + y) % 5 == 0 else gl_m
            if 11 <= y <= 29 and 3 <= lx <= 12:
                if lx in (3, 12):
                    return wd
                if 13 <= y <= 19 and 5 <= lx <= 10:
                    return gl_h if (lx == 6 and y == 14) else gl_d
                if lx == 10 and y == 23:
                    return 'r4' if line == 'A' else 'k5'
                return wl if lx < 7 else wm
            return bg_m
        if pidx == 2:
            if lx in (0, 15):
                return wm if y % 4 != 0 else wd
            if y in (4, 5, 21, 22):
                return wl if y in (4, 21) else wd
            if 6 <= y <= 20 and 2 <= lx <= 13:
                if line == 'A' and (lx in (6, 9) or y == 13):
                    return wm
                if line == 'B' and (lx == 7 or y in (10, 15)):
                    return 'i1'
                if line == 'C' and (lx in (5, 10) or y == 14):
                    return wd
                if y in (17, 18, 19) and lx in (3, 4, 8, 9, 11, 12):
                    return goods[(lx + y) % len(goods)]
                if (lx + y) in (13, 14) or (lx == 4 and y == 8):
                    return gl_h
                return gl_m if lx < 8 else gl_d
            if y > 22:
                if lx in (2, 7, 8, 13) or y == 28:
                    return wd
                return wl if lx < 7 else wm
            return bg_l if y < 4 else bg_m
        if lx in (0, 15):
            return wm if y % 4 != 0 else wd
        if y in (5, 22):
            return wd
        if y > 22:
            return wm if lx % 4 != 0 else wd
        if 9 <= y <= 17 and 4 <= lx <= 11:
            return wl if y == 9 else (wm if y == 17 else bg_m)
        return bg_l if lx < 8 else bg_m

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 상점 쇼윈도 벽 ({line})'}


# ---------------------------------------------------------------------------
# 4. roof.thatch (5x3 = 80x48: l 2x3, m 1x3, r 2x3 — 초가 모임지붕)
# ---------------------------------------------------------------------------
def _make_roof_thatch(line):
    # 줄 A·B·C 마다 실루엣·결 구조를 뚜렷이 다르게(R 통과 + 1px 잡티 N 최소화)
    if line == 'A':
        hi, lit, mid, sh, dk, edge = 'r4', 'g6', 'g5', 'g3', 'g1', 'g0'
    elif line == 'B':
        hi, lit, mid, sh, dk, edge = 'p3', 'a5', 'a4', 'a2', 'a1', 'a0'
    else:
        hi, lit, mid, sh, dk, edge = 'w6', 'w5', 'w4', 'w2', 'w1', 'w0'

    def thatch_fill(gx, y, shade_side=False):
        # x=0 과 x=15 가 같은 위상이 되도록 16px 대칭/주기 정렬(S 가로 이음 0)
        b2 = ((gx + 1) // 2) % 4   # x=0 -> 0, x=15 -> 0
        b4 = ((gx + 2) // 4) % 2   # x=0 -> 0, x=15 -> 0
        if line == 'A':
            # 3단 겹친 황금 짚단 + 용마루 굵은 묶음
            if y <= 3:
                return hi if b2 != 2 else lit
            if y <= 7:
                return mid if b2 == 2 else lit
            if y >= 43:
                return edge if y >= 46 else dk
            if y >= 32:
                yy = (y - 32) % 6
                if yy == 5:
                    return dk
                return sh if shade_side else (mid if b2 != 2 else sh)
            yy = (y - 8) % 8
            if yy == 7:
                return sh if shade_side else mid
            if yy in (0, 1):
                return mid if shade_side else (hi if b2 == 1 else lit)
            return sh if shade_side else (lit if b2 != 2 else mid)
        if line == 'B':
            # 갈대 초가: 상단 교차 목조 뼈대 + 촘촘한 세로 빗질 결
            if y <= 5:
                if b2 == 2:
                    return dk
                return hi if y <= 2 else lit
            if y >= 42:
                return edge if y >= 45 else dk
            if y >= 32:
                return dk if (y in (36, 41) or (shade_side and b2 in (1, 3))) else sh
            if y in (15, 24, 31):
                return sh if shade_side else mid
            if shade_side:
                return sh if b2 in (0, 2) else mid
            return lit if b2 in (0, 2) else (hi if y < 15 else mid)
        # C: 이끼 낀 거친 통나무 용마루 + 두툼한 계단식 초가
        if y <= 2:
            return mid
        if y <= 6:
            return hi if y <= 4 else lit
        if y >= 44:
            return edge if y >= 46 else dk
        if y >= 32:
            if 34 <= y <= 37 and (gx % 16) in (4, 5, 6, 7):
                return 'v1' if shade_side else 'v2'
            return dk if y >= 39 else sh
        yy = (y - 7) % 5
        if yy == 4:
            return dk if shade_side else sh
        if yy == 0 and b4 == 1:
            return mid if shade_side else hi
        return sh if shade_side else (lit if b4 == 0 else mid)

    rows = []
    for y in range(48):
        r = ['.'] * 80
        cut_top = 18 if line == 'A' else (17 if line == 'B' else 19)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = dk
            else:
                hip = (22 if line == 'A' else 18) - (y * (20 if line == 'A' else 16)) // 47
                if abs(x - hip) <= 1 and y >= 4:
                    r[x] = hi if x == hip else mid
                else:
                    r[x] = thatch_fill(x, y, shade_side=False)
        for x in range(16):
            r[32 + x] = thatch_fill(x, y, shade_side=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = edge
            else:
                hip = (9 if line == 'A' else 13) + (y * (20 if line == 'A' else 16)) // 47
                if abs(x - hip) <= 1 and y >= 4:
                    r[48 + x] = dk
                else:
                    r[48 + x] = thatch_fill(x, y, shade_side=(x > hip))
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 초가 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 5. roof.glass (5x3 = 80x48: l 2x3, m 1x3, r 2x3 — 유리 온실 모임지붕)
# ---------------------------------------------------------------------------
def _make_roof_glass(line):
    if line == 'A':
        fr_d, fr_m, fr_l = 'i0', 'i1', 'i2'
        gl_h, gl_l, gl_m, gl_d = 'p4', 's3', 's2', 's1'
    elif line == 'B':
        fr_d, fr_m, fr_l = 'i0', 'i1', 'i3'
        gl_h, gl_l, gl_m, gl_d = 'p4', 's3', 's2', 's0'
    else:
        # C: 먹 윤곽(t0) 대신 나무 중간·어두운 단(t1~t4) 사용
        fr_d, fr_m, fr_l = 't1', 't3', 't5'
        gl_h, gl_l, gl_m, gl_d = 'p4', 'p3', 's2', 's1'

    def glass_fill(gx, y, shade_side=False):
        if y <= 3:
            return fr_l if y in (1, 2) else fr_m
        if y >= 44:
            return fr_d if y >= 46 else fr_m
        if line == 'A':
            # 아치형 채광 온실: 가로 멀리언 y=14,28,38 · 세로 멀리언 x=4,12 (경계 x=0,15 유리 유지 → S 통과)
            if y in (14, 28, 38) or (gx % 8 == 4):
                return fr_m if y < 32 else fr_d
            if y >= 32:
                return gl_d
            if shade_side:
                return gl_m if ((gx // 2 + y // 2) % 4 == 0) else gl_d
            if (gx // 2 + y // 2) % 5 == 0:
                return gl_h
            return gl_l if y < 22 else gl_m
        if line == 'B':
            # 고딕 촘촘한 철제 온실: 가로 y=10,20,30,39 · 세로 x=2,6,10,14 (경계 유리 유지)
            if y in (10, 20, 30, 39) or (gx % 4 == 2):
                return fr_m if y < 32 else fr_d
            if y >= 32:
                return gl_d
            if shade_side:
                return gl_d
            if y < 18 and (gx // 2) % 2 == 0:
                return gl_h
            return gl_l if y < 26 else gl_m
        # C: 넓은 목재 온실(가로 들보 y=18,34 · 세로 기둥 x=7,8 굵은 목재 + 대각 반사 띠)
        if y in (18, 19, 34, 35) or (gx % 16 in (7, 8)):
            return fr_l if (y < 20 and gx % 16 == 7) else (fr_m if y < 32 else fr_d)
        if y >= 32:
            return gl_d
        if shade_side:
            return gl_m if y < 18 else gl_d
        if ((gx + y) // 2) % 6 == 0:
            return gl_h
        return gl_l if y < 24 else gl_m

    rows = []
    for y in range(48):
        r = ['.'] * 80
        cut_top = 18 if line == 'A' else (19 if line == 'B' else 17)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = fr_m if line == 'C' else fr_d
            else:
                hip = 20 - (y * 20) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[x] = fr_l if x == hip else fr_m
                else:
                    r[x] = glass_fill(x, y, shade_side=False)
        for x in range(16):
            r[32 + x] = glass_fill(x, y, shade_side=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = fr_d
            else:
                hip = 11 + (y * 20) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[48 + x] = fr_d
                else:
                    r[48 + x] = glass_fill(x, y, shade_side=(x > hip))
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 유리 온실 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 6. extra.awning (2x1 = 32x16 — 줄무늬 차양/어닝, on: wall)
# ---------------------------------------------------------------------------
def _make_extra_awning(line):
    if line == 'A':
        c1_l, c1_m, c1_d = 'r3', 'r2', 'r0'
        c2_l, c2_m, c2_d = 'p4', 'p2', 'k0'
        br_l, br_d = 'i3', 'i0'
    elif line == 'B':
        c1_l, c1_m, c1_d = 's3', 's2', 's0'
        c2_l, c2_m, c2_d = 'p4', 'a4', 'a0'
        br_l, br_d = 'i3', 'i0'
    else:
        c1_l, c1_m, c1_d = 'v5', 'v3', 'v0'
        c2_l, c2_m, c2_d = 'g6', 'g4', 'g0'
        br_l, br_d = 'w5', 'w0'

    rows = []
    for y in range(16):
        r = ['.'] * 32
        for x in range(32):
            if y == 0:
                continue
            if y == 1 and (x < 3 or x > 28):
                continue
            if y == 2 and (x < 2 or x > 29):
                continue
            if y <= 12:
                if x < 1 or x > 30:
                    continue
                stripe_w = 4 if line == 'A' else (5 if line == 'B' else 3)
                is_c1 = ((x - 1) // stripe_w) % 2 == 0
                if y == 1:
                    r[x] = br_l if x < 24 else br_d
                elif y <= 8:
                    r[x] = (c1_l if x < 22 else c1_m) if is_c1 else (c2_l if x < 22 else c2_m)
                elif y <= 10:
                    r[x] = (c1_l if x <= 4 else c1_m) if is_c1 else (c2_l if x <= 4 else c2_m)
                elif y == 11:
                    sc = (x - 1) % stripe_w
                    r[x] = '.' if sc == 0 else (c1_m if x <= 3 else (c1_d if is_c1 else c2_d))
                else:
                    sc = (x - 1) % stripe_w
                    r[x] = '.' if sc == 0 else c1_d
            elif y in (13, 14):
                if x in (2, 3, 28, 29):
                    r[x] = br_d
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 줄무늬 어닝 ({line})'}


# ---------------------------------------------------------------------------
# 7. extra.balcony (2x1 = 32x16 — 2층 발코니 난간, on: wall)
# ---------------------------------------------------------------------------
def _make_extra_balcony(line):
    if line == 'A':
        rail_l, rail_m, rail_d = 't5', 't3', 't1'
        deck_l, deck_d = 't4', 't1'
        fl_g, fl_b = 'v3', 'r3'
    elif line == 'B':
        rail_l, rail_m, rail_d = 'i3', 'i2', 'i0'
        deck_l, deck_d = 'a5', 'a1'
        fl_g, fl_b = 'v2', 's3'
    else:
        rail_l, rail_m, rail_d = 'w6', 'w4', 'w1'
        deck_l, deck_d = 'w5', 'w2'
        fl_g, fl_b = 'v5', 'r4'

    rows = []
    for y in range(16):
        r = ['.'] * 32
        for x in range(32):
            if y < 2 or x < 1 or x > 30:
                continue
            if y == 2:
                if 2 <= x <= 29:
                    r[x] = rail_l if x < 20 else rail_m
            elif y == 3:
                if 2 <= x <= 29:
                    r[x] = rail_m if x < 20 else rail_d
            elif 4 <= y <= 9:
                if x in (2, 3, 28, 29):
                    r[x] = rail_l if x < 16 else rail_d
                elif line == 'A' and x % 4 in (2, 3):
                    r[x] = rail_m if x % 4 == 2 else rail_d
                elif line == 'B' and (x % 4 in (0, 1) or (y in (6, 7) and 4 <= x <= 27)):
                    r[x] = rail_l if (x < 16 and x % 4 == 0) else rail_d
                elif line == 'C' and (x % 5 in (2, 3) or y in (6, 7)):
                    r[x] = rail_m
                if line != 'B' and y in (5, 6) and x in (11, 12, 13, 18, 19, 20):
                    r[x] = fl_b if (y == 5 and x in (12, 19)) else fl_g
            elif y == 10:
                if 1 <= x <= 30:
                    r[x] = deck_l if x < 20 else rail_m
            elif y in (11, 12):
                if 1 <= x <= 30:
                    r[x] = deck_d if y == 12 else rail_m
            elif 13 <= y <= 15:
                if x in (4, 5, 15, 16, 26, 27):
                    r[x] = rail_m if (x < 16 and y == 13) else rail_d
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 2층 발코니 ({line})'}


# ---------------------------------------------------------------------------
# 8. extra.dormer (1x2 = 16x32 — 지붕창 도머, on: roof, top [0,1])
# ---------------------------------------------------------------------------
def _make_extra_dormer(line):
    if line == 'A':
        rf_h, rf_l, rf_m, rf_d = 'r4', 'r3', 'r2', 'r0'
        wl_l, wl_m, wl_d = 'p3', 'p1', 't1'
        gl_h, gl_m = 'p4', 's1'
    elif line == 'B':
        rf_h, rf_l, rf_m, rf_d = 's3', 's3', 's2', 's0'
        wl_l, wl_m, wl_d = 'a6', 'a4', 'a1'
        gl_h, gl_m = 'p4', 'i0'
    else:
        rf_h, rf_l, rf_m, rf_d = 'g6', 'g5', 'g3', 'g1'
        wl_l, wl_m, wl_d = 'w5', 'w3', 'w1'
        gl_h, gl_m = 'p3', 's1'

    rows = []
    for y in range(32):
        r = ['.'] * 16
        if line == 'C':
            # C: 평평한 외쪽(shed) 지붕창 도머 + 넓은 2칸 다락창(B 와 뚜렷이 다른 실루엣)
            if 5 <= y <= 14:
                x0 = 2 if y >= 7 else 3
                x1 = 14 if y >= 7 else 13
                for x in range(x0, x1):
                    if y == 14:
                        r[x] = rf_d
                    elif y <= 8:
                        r[x] = rf_h if x < 8 else rf_l
                    elif x < 8:
                        r[x] = rf_l if y < 12 else rf_m
                    else:
                        r[x] = rf_m
            elif y == 15:
                for x in range(1, 15):
                    r[x] = rf_d
            elif 16 <= y <= 27:
                for x in range(2, 14):
                    if x == 2:
                        r[x] = wl_l if y < 25 else wl_d
                    elif x == 13 or y == 27:
                        r[x] = wl_d
                    elif 18 <= y <= 24 and 4 <= x <= 11:
                        if x in (4, 11, 7, 8) or y in (18, 24):
                            r[x] = wl_d
                        elif (x, y) in ((5, 19), (9, 19)):
                            r[x] = gl_h
                        else:
                            r[x] = gl_m
                    else:
                        r[x] = wl_l if x < 8 else wl_m
        elif line == 'B':
            # B: 가파른 고딕 첨탑 지붕창 도머 + 좁은 세로창
            if 1 <= y <= 14:
                half = min(5, max(1, (y + 1) // 3))
                for x in range(8 - half, 8 + half):
                    if y == 14:
                        r[x] = rf_d
                    elif x in (7, 8):
                        r[x] = rf_h if x == 7 else rf_l
                    elif x < 7:
                        r[x] = rf_l if y < 12 else rf_m
                    else:
                        r[x] = rf_m if y < 11 else rf_d
            elif y == 15:
                for x in range(3, 13):
                    r[x] = rf_d
            elif 16 <= y <= 29:
                for x in range(4, 12):
                    if x == 4:
                        r[x] = wl_l if y < 27 else wl_d
                    elif x == 11 or y == 29:
                        r[x] = wl_d
                    elif 18 <= y <= 26 and 6 <= x <= 9:
                        if y == 18:
                            r[x] = wl_d if x in (6, 9) else gl_h
                        elif y == 26:
                            r[x] = wl_d
                        elif x == 7 and y == 20:
                            r[x] = gl_h
                        else:
                            r[x] = gl_m
                    else:
                        r[x] = wl_l if x < 8 else wl_m
        else:
            # A: 전통 박공 지붕창 도머
            if 2 <= y <= 14:
                half = min(6, (y - 2) // 2 + 2)
                for x in range(8 - half, 8 + half):
                    if y == 14:
                        r[x] = rf_d
                    elif x in (7, 8):
                        r[x] = rf_h if x == 7 else rf_l
                    elif x < 7:
                        r[x] = rf_l if y < 12 else rf_m
                    else:
                        r[x] = rf_m if y < 11 else rf_d
            elif y == 15:
                for x in range(2, 14):
                    r[x] = rf_d
            elif 16 <= y <= 28:
                for x in range(3, 13):
                    if x == 3:
                        r[x] = wl_l if y < 26 else wl_d
                    elif x == 12 or y == 28:
                        r[x] = wl_d
                    elif 18 <= y <= 25 and 5 <= x <= 10:
                        if x in (5, 10) or y in (18, 25):
                            r[x] = wl_d
                        elif x == 7 or y == 21:
                            r[x] = wl_m
                        elif x == 6 and y == 19:
                            r[x] = gl_h
                        else:
                            r[x] = gl_m
                    else:
                        r[x] = wl_l if x < 8 else wl_m
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 지붕창 도머 ({line})'}


# ---------------------------------------------------------------------------
# 9. extra.sign (1x1 = 16x16 — 걸린 쇠 간판, on: wall)
# ---------------------------------------------------------------------------
def _make_extra_sign(line):
    if line == 'A':
        ir_l, ir_d = 'i3', 'i0'
        bd_l, bd_m, bd_d = 't6', 't4', 't1'
        emblem = 'r4'
    elif line == 'B':
        ir_l, ir_d = 'i3', 'i0'
        bd_l, bd_m, bd_d = 's3', 's2', 's0'
        emblem = 'p4'
    else:
        ir_l, ir_d = 'w6', 'w1'
        bd_l, bd_m, bd_d = 'w6', 'w4', 'w1'
        emblem = 'r4'

    rows = []
    for y in range(16):
        r = ['.'] * 16
        if y == 2:
            for x in range(2, 13):
                r[x] = ir_l if x < 10 else ir_d
        elif y == 3:
            for x in range(2, 13):
                r[x] = ir_l if x in (2, 5, 10) else ir_d
        elif y == 4:
            r[2], r[3] = ir_l, ir_d
            r[5], r[10] = ir_l, ir_d
        elif 5 <= y <= 13:
            if y <= 7:
                r[2] = ir_l if y == 5 else ir_d
            x0, x1 = 4, 12
            if line == 'B' and y >= 11:
                x0 += (y - 10)
                x1 -= (y - 10)
            if line == 'C' and y in (5, 13):
                x0 += 1
                x1 -= 1
            for x in range(x0, x1):
                if y == 5 or x == x0:
                    r[x] = bd_l
                elif x == x1 - 1 or y == 13:
                    r[x] = bd_d
                elif y in (8, 9, 10) and x in (7, 8):
                    r[x] = emblem
                else:
                    r[x] = bd_l if x < 8 else bd_m
        rows.append(r)
    return _grid_tokens(rows, TOK), {'note': f'Lv.2 걸린 쇠 간판 ({line})'}


def _bind(fn, line):
    def _f():
        return fn(line)
    _f.__name__ = f'{fn.__name__}_{line}'
    return _f


CANDIDATES = {
    'gable.step': dict(R5.CANDIDATES['gable.step']),
    'roof.gf.back': dict(R5.CANDIDATES['roof.gf.back']),
    'roof.lean.side': dict(R5.CANDIDATES['roof.lean.side']),
    'roof.lean.left': {ln: _bind(_make_lean_left, ln) for ln in ('A', 'B', 'C')},
    'wall.arcade': {ln: _bind(_make_wall_arcade, ln) for ln in ('A', 'B', 'C')},
    'wall.shop': {ln: _bind(_make_wall_shop, ln) for ln in ('A', 'B', 'C')},
    'roof.thatch': {ln: _bind(_make_roof_thatch, ln) for ln in ('A', 'B', 'C')},
    'roof.glass': {ln: _bind(_make_roof_glass, ln) for ln in ('A', 'B', 'C')},
    'extra.awning': {ln: _bind(_make_extra_awning, ln) for ln in ('A', 'B', 'C')},
    'extra.balcony': {ln: _bind(_make_extra_balcony, ln) for ln in ('A', 'B', 'C')},
    'extra.dormer': {ln: _bind(_make_extra_dormer, ln) for ln in ('A', 'B', 'C')},
    'extra.sign': {ln: _bind(_make_extra_sign, ln) for ln in ('A', 'B', 'C')},
}
