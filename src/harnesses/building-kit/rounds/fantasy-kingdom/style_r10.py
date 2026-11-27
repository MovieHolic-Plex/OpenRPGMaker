"""building-kit fantasy-kingdom style-r10 후보 — 쯔꾸르 정석(RM2000·RMXP·FSM/REFMAP) 지붕·처마 5종.

기존 style-r9 부품을 reuseParts 로 이어받고, r4 의 roof.hip.low · r3 의 roof.hip.tall 을 재수출하며
새 부품 5종(roof.flat · roof.hip.green · extra.gable_dormer · extra.porch_roof · extra.terrace)을
줄 A·B·C 마다 구조·재질을 달리해 그린다. hex 색 금지.
"""
import dot
import style_r3 as R3
import style_r4 as R4

ROUND = 'style-r10'
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
    'v0': ('grass', 0), 'v1': ('grass', 1), 'v2': ('grass', 2), 'v3': ('grass', 3), 'v4': ('grass', 4), 'v5': ('grass', 5), 'v6': ('grass', 6),
    'c0': ('cobble', 0), 'c1': ('cobble', 1), 'c2': ('cobble', 2), 'c3': ('cobble', 3), 'c4': ('cobble', 4), 'c5': ('cobble', 5),
}


def _grid_tokens(rows):
    used = sorted({tok for r in rows for tok in r if tok != '.'})
    syms = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
    t2c = {tok: syms[idx] for idx, tok in enumerate(used)}
    leg = dot.legend(THEME, **{c: TOK[tok] for tok, c in t2c.items()})
    str_rows = [''.join('.' if tok == '.' else t2c[tok] for tok in r) for r in rows]
    return dot.grid(str_rows, leg)


# ---------------------------------------------------------------------------
# 1. roof.flat (3x2 = 48x32: l[0:16], m[16:32], r[32:48], end=1 — 평지붕·옥상 난간)
# ---------------------------------------------------------------------------
def _make_roof_flat(line):
    # A: 따뜻한 벽돌·석회 옥상(FSM 5번 좌측), B: 밝은 석조 파라펫(성채/관청), C: 목재 테라스 갑판
    if line == 'A':
        cop_h, cop_m, cop_d = 'p4', 'p2', 'r1'
        fl_h, fl_l, fl_m, fl_d = 'p3', 'p2', 'p1', 'g4'
        eave_m, eave_d = 'r2', 'r0'
    elif line == 'B':
        cop_h, cop_m, cop_d = 'k5', 'k4', 'k1'
        fl_h, fl_l, fl_m, fl_d = 'a6', 'a5', 'a4', 'a2'
        eave_m, eave_d = 'a2', 'a0'
    else:
        cop_h, cop_m, cop_d = 'w6', 'w5', 'w1'
        fl_h, fl_l, fl_m, fl_d = 'w6', 'w5', 'w4', 'w2'
        eave_m, eave_d = 'w2', 'w0'

    def floor_px(lx, y):
        # 옥상 타일 바닥(y=3..18): F 관문(top 0..15 밝고 y=16..31 앞 난간/처마 어둡게)
        if line == 'A':
            # 따뜻한 테라코타/석회 격자 타일(x=0/15 대칭)
            b = ((lx + 2) // 4) % 2
            if y in (7, 12, 17):
                return fl_m
            if lx in (3, 12):
                return fl_m
            return fl_h if (b == 0 and y < 12) else fl_l
        if line == 'B':
            # 판석 옥상(8px 돌판, 줄눈 x=7,8 중앙)
            if y in (8, 15):
                return fl_d
            if lx in (7, 8) and y % 2 == 0:
                return fl_d
            return fl_h if y < 10 else fl_l
        # C: 가로 나무 갑판 판자
        if y in (6, 10, 14, 18):
            return fl_d
        if lx in (5, 10) and (y // 4) % 2 == 0:
            return fl_d
        return fl_h if y < 11 else fl_l

    rows = []
    for y in range(32):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # 뒤쪽 난간 갓돌(y=0..2)
                if y == 0:
                    ch = cop_h if (pidx != 2 or lx < 14) else cop_m
                elif y == 1:
                    ch = cop_m if (pidx != 2 or lx < 14) else cop_d
                elif y == 2:
                    ch = cop_d if (line == 'B' and lx % 4 == 2) else fl_d
                # 양옆 난간 벽(l: lx=0..2, r: lx=13..15)
                elif pidx == 0 and lx <= 2 and y <= 23:
                    ch = cop_h if lx == 0 else (cop_m if lx == 1 else cop_d)
                elif pidx == 2 and lx >= 13 and y <= 23:
                    ch = cop_d if lx == 15 else (cop_m if lx == 14 else cop_h)
                # 옥상 평면 바닥(y=3..15 — F 관문 0~15행이 윗면, 16행부터 앞 난간 턱)
                elif y <= 15:
                    ch = floor_px(lx, y)
                # 앞쪽 난간 턱(y=16~18 어두운 윗선/내벽 그림자) + 앞 벽면(y=19..28) + 처마 그늘(y=29..31)
                elif y == 16:
                    ch = fl_d if line != 'C' else eave_d
                elif y <= 18:
                    ch = fl_m if line != 'C' else eave_m
                elif y == 19:
                    ch = cop_m if line != 'B' else cop_h
                elif y <= 22:
                    ch = cop_d if (lx % 8 == 4) else eave_m
                elif y <= 28:
                    if line == 'A':
                        ch = eave_d if (y in (25, 28) or lx in (3, 12)) else eave_m
                    elif line == 'B':
                        # 성가퀴/몰딩 장식
                        ch = eave_d if (y == 28 or (y <= 25 and lx in (4, 5, 10, 11))) else eave_m
                    else:
                        ch = eave_d if (y == 28 or lx in (2, 7, 8, 13)) else eave_m
                else:
                    ch = eave_d
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 평지붕·옥상 난간 ({line})'}


# ---------------------------------------------------------------------------
# 2. roof.hip.green (5x3 = 80x48: l 2x3, m 1x3, r 2x3 — 초록/청록 기와 모임지붕)
# ---------------------------------------------------------------------------
def _make_roof_hip_green(line):
    # 잠금 팔레트(grass + slate + iron)로 RMXP/FSM 초록·청록 기와 구현
    if line == 'A':
        # 밝은 이끼초록 기와(RMXP 우하단 1번 집)
        hi, lit, mid, sh, dk, edge = 'v6', 'v4', 'v2', 'v0', 'c0', 'i0'
    elif line == 'B':
        # 짙은 청록 슬레이트(FSM 마을 여관/RMXP 2번 집)
        hi, lit, mid, sh, dk, edge = 'v5', 'v2', 'v0', 's1', 's0', 'i0'
    else:
        # 짙은 숲초록 비늘기와
        hi, lit, mid, sh, dk, edge = 'v5', 'v3', 'v1', 'v0', 'g0', 'i0'

    def tile_px(gx, y, shade=False):
        b2 = ((gx + 1) // 2) % 4  # x=0/15 대칭
        if y <= 2:
            return hi if b2 != 2 else lit
        if y <= 4:
            return mid if b2 == 2 else lit
        if y >= 44:
            return edge if y >= 46 else dk
        if y >= 32:
            # 아랫단 처마 1칸(y=32..47) 어둡게(F 관문 앞 모서리 대비 + 벽 이음)
            yy = (y - 32) % 4
            if yy == 3:
                return dk
            return dk if shade else sh
        if line == 'A':
            # 세로 골 기와(4px 폭)
            yy = (y - 5) % 6
            if yy == 5:
                return dk if shade else sh
            if b2 == 2:
                return sh if shade else mid
            if shade:
                return sh if yy < 4 else dk
            return hi if (yy == 0 and b2 == 0) else (lit if yy < 3 else mid)
        if line == 'B':
            # 비늘 슬레이트(줄마다 엇갈림, x=0/15 대칭)
            row_i = (y - 5) // 5
            yy = (y - 5) % 5
            col = ((gx + (4 if row_i % 2 else 0) + 1) // 2) % 4
            if yy == 4:
                return dk
            if shade:
                return dk if col == 2 else sh
            return hi if (yy == 0 and col == 0) else (lit if col != 2 else mid)
        # C: 넓은 마름모 비늘 기와
        yy = (y - 5) % 7
        if yy == 6:
            return dk
        if shade:
            return sh if yy < 4 else dk
        return lit if (yy < 4 and b2 in (0, 3)) else mid

    rows = []
    for y in range(48):
        r = ['.'] * 80
        cut_top = 18 if line == 'A' else (17 if line == 'B' else 19)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = sh
            else:
                hip = 22 - (y * 22) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[x] = hi if x == hip else lit
                else:
                    r[x] = tile_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = tile_px(x, y, shade=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = dk
            else:
                hip = 9 + (y * 22) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[48 + x] = dk
                else:
                    r[48 + x] = tile_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 초록/청록 기와 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 3. extra.gable_dormer (2x2 = 32x32 — FSM식 큰 삼각 지붕창 도머, on: roof, top [0,1])
# ---------------------------------------------------------------------------
def _make_extra_gable_dormer(line):
    if line == 'A':
        rf_h, rf_l, rf_m, rf_d = 'r4', 'r3', 'r2', 'r0'
        wl_l, wl_m, wl_d = 'p4', 'p2', 't1'
        tm_m, tm_d = 't4', 't1'
        gl_h, gl_m = 'p4', 's1'
    elif line == 'B':
        rf_h, rf_l, rf_m, rf_d = 's3', 's3', 's2', 's0'
        wl_l, wl_m, wl_d = 'a6', 'a4', 'a1'
        tm_m, tm_d = 'i2', 'i0'
        gl_h, gl_m = 'p4', 's0'
    else:
        rf_h, rf_l, rf_m, rf_d = 'g6', 'g5', 'g3', 'g1'
        wl_l, wl_m, wl_d = 'w6', 'w4', 'w1'
        tm_m, tm_d = 'w3', 'w0'
        gl_h, gl_m = 'p3', 's1'

    rows = []
    for y in range(32):
        r = ['.'] * 32
        # 상단(y=1..15): 굵은 삼각 박공 지붕 윗면(top=[0,1] — 윗면 밝고 아래 처마 어둡게)
        if 1 <= y <= 14:
            if line == 'B':
                # B: 가파른 고딕 도머
                half = min(13, 2 + (y - 1) * 11 // 13)
            elif line == 'C':
                # C: 완만하고 넓은 오두막 도머
                half = min(14, 4 + (y - 1) * 10 // 13)
            else:
                half = min(14, 2 + (y - 1) * 12 // 13)
            x0, x1 = 16 - half, 16 + half
            for x in range(x0, x1):
                if x == x0:
                    r[x] = rf_h if y < 12 else rf_m
                elif x == x1 - 1:
                    r[x] = rf_d
                elif x in (15, 16):
                    r[x] = rf_h if x == 15 else rf_l
                elif x < 15:
                    r[x] = rf_l if (y < 12 and (y % 4 != 3)) else rf_m
                else:
                    r[x] = rf_m if (y < 11 and (y % 4 != 3)) else rf_d
        elif y == 15:
            # 굵은 처마 띠(앞 모서리 어둡게)
            for x in range(2, 30):
                r[x] = rf_d if (x < 4 or x >= 28 or y == 15) else rf_m
        elif 16 <= y <= 29:
            # 하단: 삼각 박공 벽 + 반목조 보 + 다락 창(FSM 3·4번 스타일)
            for x in range(4, 28):
                if x == 4:
                    r[x] = wl_l if y < 27 else wl_d
                elif x == 27 or y == 29:
                    r[x] = wl_d
                elif y == 16:
                    r[x] = tm_d
                elif y == 28:
                    r[x] = tm_d
                elif line == 'A' and (19 <= y <= 26 and 11 <= x <= 20):
                    # A: 2칸 가로 다락창
                    if x in (11, 20, 15, 16) or y in (19, 26):
                        r[x] = tm_d
                    elif (x, y) in ((12, 20), (17, 20)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                elif line == 'B' and (18 <= y <= 26 and 12 <= x <= 19):
                    # B: 아치 다락창
                    if y == 18 and x in (12, 13, 18, 19):
                        r[x] = wl_l if x < 16 else wl_m
                    elif x in (12, 19) or y == 26:
                        r[x] = tm_d
                    elif x == 15 or y == 22:
                        r[x] = tm_m
                    elif x == 13 and y == 20:
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                elif line == 'C' and (20 <= y <= 25 and 9 <= x <= 22):
                    # C: 넓은 통나무 가로창
                    if x in (9, 15, 16, 22) or y in (20, 25):
                        r[x] = tm_d
                    elif (x, y) in ((10, 21), (17, 21)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                else:
                    # 좌/우 반목조 대각선 보
                    if line == 'A' and (x in (7, 24) or y == 27):
                        r[x] = tm_m if x < 16 else tm_d
                    else:
                        r[x] = wl_l if x < 16 else wl_m
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 큰 삼각 박공 도머 ({line})'}


# ---------------------------------------------------------------------------
# 4. extra.porch_roof (2x1 = 32x16 — 1층 나무 현관·층간 띠지붕, on: wall)
# ---------------------------------------------------------------------------
def _make_extra_porch_roof(line):
    if line == 'A':
        # FSM 3·4번식 밝은 나무 널 덧지붕
        hi, lit, mid, dk = 'g6', 'g5', 'g3', 'g0'
        post_l, post_d = 't5', 't1'
    elif line == 'B':
        # 청석 슬레이트 층간 띠지붕(RM2000 1번)
        hi, lit, mid, dk = 's3', 's2', 's1', 's0'
        post_l, post_d = 'a5', 'a0'
    else:
        # 통나무/초가 현관 덧지붕
        hi, lit, mid, dk = 'w6', 'w5', 'w3', 'w0'
        post_l, post_d = 'w4', 'w0'

    rows = []
    for y in range(16):
        r = ['.'] * 32
        if y == 0:
            pass  # 위 귀퉁이 투명(Q)
        elif y == 1:
            for x in range(2, 30):
                r[x] = hi if x < 22 else lit
        elif 2 <= y <= 9:
            # 경사 나무 널 / 슬레이트 지붕 면 (줄마다 홈 간격 차별화)
            step = 4 if line == 'A' else (5 if line == 'B' else 3)
            for x in range(1, 31):
                if (x - 1) % step == 0:
                    r[x] = mid if x < 20 else dk
                elif y <= 4:
                    r[x] = hi if x < 18 else lit
                elif y <= 7:
                    r[x] = lit if x < 22 else mid
                else:
                    r[x] = mid
        elif y in (10, 11):
            # 처마 굵은 앞 턱(어둡게 — CONTRAST 확보)
            for x in range(1, 31):
                r[x] = dk if (y == 11 or x >= 24) else mid
        elif 12 <= y <= 14:
            # 양옆 나무 기둥/까치발
            for x in (2, 3, 4, 27, 28, 29):
                r[x] = post_l if x in (2, 3) else post_d
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 현관·층간 덧지붕 ({line})'}


# ---------------------------------------------------------------------------
# 5. extra.terrace (3x1 = 48x16 — 옥상 화분·테라스 난간, on: roof)
# ---------------------------------------------------------------------------
def _make_extra_terrace(line):
    if line == 'A':
        rail_l, rail_m, rail_d = 't5', 't3', 't0'
        pot_l, pot_d = 'r3', 'r0'
        leaf_l, leaf_d = 'v5', 'v0'
        fl1, fl2 = 'r4', 'r3'
    elif line == 'B':
        rail_l, rail_m, rail_d = 'a6', 'a4', 'a0'
        pot_l, pot_d = 'k4', 'k0'
        leaf_l, leaf_d = 'v4', 'v0'
        fl1, fl2 = 's3', 'p4'
    else:
        rail_l, rail_m, rail_d = 'w6', 'w4', 'w0'
        pot_l, pot_d = 'g5', 'g0'
        leaf_l, leaf_d = 'v6', 'v0'
        fl1, fl2 = 'r4', 'w6'

    rows = []
    for y in range(16):
        r = ['.'] * 48
        # 위 귀퉁이 투명(y=0,1), 화분 4개 + 앞 목재/석조 난간
        pots = (5, 16, 27, 38) if line == 'A' else ((6, 20, 34) if line == 'B' else (4, 15, 29, 40))
        if 2 <= y <= 5:
            # 꽃 + 잎 덩어리(화분 위)
            for px in pots:
                for dx in range(6):
                    x = px + dx
                    if y == 2 and dx in (0, 5):
                        continue
                    if y in (2, 3) and dx in (2, 3):
                        r[x] = fl1 if (px % 2 == 0) else fl2
                    else:
                        r[x] = leaf_l if dx < 4 else leaf_d
        elif 6 <= y <= 10:
            # 난간 상단 횡대(y=8..9) + 화분 몸통(y=6..10)
            for x in range(2, 46):
                if y == 8:
                    r[x] = rail_l if x < 34 else rail_m
                elif y == 9:
                    r[x] = rail_m if x < 32 else rail_d
            for px in pots:
                for dx in range(1, 5):
                    r[px + dx] = pot_l if (dx <= 2 and y <= 8) else pot_d
        elif 11 <= y <= 13:
            # 난간 살대(2px 굵기 → T 관문 통과)
            for x in range(2, 46):
                if x in (2, 3, 44, 45) or (x % 6 in (2, 3)):
                    r[x] = rail_l if x < 24 else rail_d
        elif y == 14:
            # 밑받침 어두운 띠(roof_px 에 안정적 접지 + CONTRAST)
            for x in range(2, 46):
                r[x] = rail_d
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 옥상 화분 테라스 ({line})'}


def _bind(fn, line):
    def _f():
        return fn(line)
    _f.__name__ = f'{fn.__name__}_{line}'
    return _f


CANDIDATES = {
    'roof.hip.low': dict(R4.CANDIDATES['roof.hip.low']),
    'roof.hip.tall': dict(R3.CANDIDATES['roof.hip.tall']),
    'roof.flat': {ln: _bind(_make_roof_flat, ln) for ln in ('A', 'B', 'C')},
    'roof.hip.green': {ln: _bind(_make_roof_hip_green, ln) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer': {ln: _bind(_make_extra_gable_dormer, ln) for ln in ('A', 'B', 'C')},
    'extra.porch_roof': {ln: _bind(_make_extra_porch_roof, ln) for ln in ('A', 'B', 'C')},
    'extra.terrace': {ln: _bind(_make_extra_terrace, ln) for ln in ('A', 'B', 'C')},
}
